// =============================================================================
// api-mako/areas/integraciones.run — los cuerpos del área `integraciones`
// =============================================================================
// Un runner por id de integraciones.def.ts. Solo lecturas: el área expone ESTADO,
// nunca valores. Todo corre adentro de runWithWorkspace(ctx.ws).
//
// Lo que no se ve leyendo las libs y gobierna este archivo:
//
//  1. NUNCA SE COPIA estadoCampo TAL CUAL. Su `mask` trae los últimos 4 del secreto
//     y, para las claves `*_ACCOUNT`, el email ENTERO de la cuenta. Aquí solo sale
//     configurado / ilegible.
//  2. verificarServicio SE LLAMA CON `{}`. Aceptar valores del agente sería pegar
//     secretos en un chat, y un campo `host` enviado junto a secretos guardados es
//     el vector de exfiltración que la función rechaza. Y sus `facts` NO salen:
//     traen teléfonos, emails de la cuenta, títulos de llamadas con nombres de
//     leads y el uso en USD de OpenRouter.
//  3. getUsageSummary LEE EL SALDO DE CLAUDE DEL WS 1 para un cliente sin key propia
//     (getSaldo → wsDeProveedor cae a OWNER_WS). Mostrarlo sería darle a un cliente
//     el saldo de otro cliente (OWNER_WS es Mauricio, no la plataforma). Aquí se
//     anula salvo que el workspace sea el 1 o tenga su ANTHROPIC_API_KEY.
//  4. permisoCalendarioGoogle devuelve conectado:false TAMBIÉN cuando Google no
//     respondió (catch). Con token guardado no se dice «nunca se conectó».
//  5. El deep-link de /integraciones es `?abrir=<key>`, no `?servicio=`
//     (IntegracionesBoard.tsx). Con otro parámetro la página abre sin el modal.
// =============================================================================

import 'server-only';
import type { Runners, SalidaLectura } from '../tipos';
import { TEXTO_ALCANCE } from '../alcance';
import { servicioDelWs, keysServiciosDelWs, tarjetasDelWs } from './integraciones.helpers';
import { getIntegraciones } from '@/lib/integraciones';
import { servicioMetodo } from '@/lib/metodo-catalogo';
import { estadoCampo, integracionConectada, credDelCliente } from '@/lib/credenciales';
import { esClaveDeCuenta, MAX_KEYS } from '@/lib/ia-keys';
import { verificarServicio } from '@/lib/metodo-verificar';
import { permisoCalendarioGoogle, googleCalendarConectado } from '@/lib/google-calendar';
import { cuotasProveedores, cuentasDe } from '@/lib/ia-cuotas';
import { getUsageSummary } from '@/lib/anthropic-usage';
import { tabActivacion, TABS_ACTIVACION } from '@/lib/tab-activacion';
import { tokenAgenteVisible } from '@/lib/agente-token';
import { linkPantalla } from '../link';
import { OWNER_WS } from '@/lib/workspace';

const J = (o: unknown): string => JSON.stringify(o);
const fallo = (error: string, disponibles?: unknown): SalidaLectura =>
  ({ content: J({ ok: false, error, ...(disponibles ? { disponibles } : {}) }), isError: true });
const str = (input: Record<string, unknown>, k: string): string =>
  (typeof input[k] === 'string' ? (input[k] as string).trim().toLowerCase() : '');
const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const linkIntegracion = (key: string): string => linkPantalla(`/integraciones?abrir=${encodeURIComponent(key)}`);

export const RUNNERS: Runners = {
  ver_integraciones: {
    leer: async () => {
      const lista = await getIntegraciones();
      const integraciones = lista.map((i) => {
        // `detalle` trae nombres de variables de entorno («Falta configurar: META_ACCESS_TOKEN»):
        // es copy técnico. Se traduce a las etiquetas que la persona ve en el formulario.
        const m = /^Falta configurar: (.+)$/.exec(i.detalle);
        if (!m) return { key: i.key, nombre: i.nombre, categoria: i.categoria, estado: i.estado, detalle: i.detalle };
        const campos = servicioMetodo(i.key)?.campos ?? [];
        const faltan = m[1].split(',').map((env) => campos.find((c) => c.env === env.trim())?.label ?? 'un campo');
        return { key: i.key, nombre: i.nombre, categoria: i.categoria, estado: i.estado, detalle: 'Faltan campos por configurar.', faltan_campos: faltan };
      });
      return J({
        conectadas: integraciones.filter((i) => i.estado === 'conectada').length,
        faltan: integraciones.filter((i) => i.estado === 'falta').length,
        integraciones,
        avisos: [
          '«conectada» significa que las credenciales están cargadas, no que funcionen: pruébala con probar_conexion_integracion.',
          'Google Calendar figura conectada si hay un permiso guardado, aunque Google ya lo haya rechazado: confirma con ver_estado_google_calendar.',
          'Pixel de MaKo figura conectada solo si llegaron eventos recientes de la landing.',
        ],
      });
    },
  },

  ver_integracion: {
    leer: async (input, ctx) => {
      const key = str(input, 'servicio');
      const s = await servicioDelWs(key, ctx.ws);
      if (!s) return fallo(`La integración «${key}» no existe para este negocio (o no tiene campos que cargar: Google Calendar, Pixel de MaKo y Claude se conectan desde su link).`, await keysServiciosDelWs(ctx.ws));
      const estados = await Promise.all(s.campos.map(async (c) => {
        try { return { c, e: await estadoCampo(c.env, ctx.ws) }; } catch { return { c, e: null }; }
      }));
      // Las cuentas EXTRA de una IA gratis son hasta 2×(MAX_KEYS−1) campos opcionales:
      // se resumen en un número en vez de listarlas una por una.
      const principales = estados.filter(({ c }) => (c.slot ?? 1) === 1);
      const extras = estados.filter(({ c }) => (c.slot ?? 1) > 1 && !esClaveDeCuenta(c.env));
      return J({
        key: s.key, nombre: s.nombre, categoria: s.categoria, para_que: s.paraQue,
        conectada: await integracionConectada(s.key, ctx.ws),
        campos: principales.map(({ c, e }) => ({
          campo: c.label,
          obligatorio: !c.opcional,
          // null = no se pudo leer el estado (no es lo mismo que «no está cargado»)
          configurado: e ? e.configurado : null,
          ilegible: e ? e.ilegible : null,
          lo_completa_mako: !!c.auto,
        })),
        ...(extras.length ? { cuentas_extra_cargadas: extras.filter(({ e }) => e?.configurado).length, cuentas_extra_max: extras.length } : {}),
        paso_externo: s.pasoExterno ? { titulo: s.pasoExterno.titulo, porque: s.pasoExterno.porque, valor: s.pasoExterno.valor, donde: s.pasoExterno.donde, ojo: s.pasoExterno.ojo ?? [] } : null,
        ilegible_significa: 'la credencial está guardada pero ya no se puede leer: hay que volver a pegarla.',
        link: linkIntegracion(s.key),
      });
    },
  },

  probar_conexion_integracion: {
    leer: async (input, ctx) => {
      const key = str(input, 'servicioKey');
      const s = await servicioDelWs(key, ctx.ws);
      if (!s) return fallo(`La integración «${key}» no existe para este negocio.`, await keysServiciosDelWs(ctx.ws));
      const r = await verificarServicio(s.key, {});
      if (!r.ok && r.error === 'servicio inválido') {
        return fallo(`«${s.nombre}» no tiene prueba de conexión desde aquí. Revisa su estado con ver_integracion.`);
      }
      return J({
        key: s.key, nombre: s.nombre,
        anda: r.ok,
        detalle: r.ok ? (r.detalle ?? 'Conectada.') : null,
        motivo: r.ok ? null : (r.error ?? 'No se pudo verificar.'),
        nota: 'Prueba las credenciales guardadas en este negocio. Si falla, pasa el link para corregirlas: nunca pidas la key por el chat.',
        link: linkIntegracion(s.key),
      });
    },
  },

  ver_estado_google_calendar: {
    leer: async () => {
      const p = await permisoCalendarioGoogle();
      // conectado:false también sale cuando Google no respondió: si hay un permiso
      // guardado, NO es «nunca se conectó».
      const hayPermisoGuardado = p.conectado ? true : await googleCalendarConectado().catch(() => false);
      const estado = p.conectado
        ? (p.puedeMover ? 'completa' : 'solo_lectura')
        : (hayPermisoGuardado ? 'rechazada_o_sin_respuesta' : 'sin_conectar');
      const queHacer: Record<string, string> = {
        completa: 'Nada: MaKo cruza las reuniones y puede mover eventos.',
        solo_lectura: 'El permiso es viejo y solo deja leer: hay que volver a conectar Google para poder reagendar.',
        rechazada_o_sin_respuesta: 'Hay un permiso guardado pero Google no lo aceptó (los permisos caducan) o no respondió: hay que volver a conectar Google.',
        sin_conectar: 'Nunca se conectó una agenda: hay que entrar con Google desde el link.',
      };
      return J({
        estado, conectada: p.conectado, puede_mover_reuniones: p.conectado && p.puedeMover,
        que_hacer: queHacer[estado],
        link: linkIntegracion('google'),
      });
    },
  },

  ver_cuotas_ia: {
    leer: async (_input, ctx) => {
      // Misma ventana que usoHoyPorCuenta: medianoche en la hora del SERVIDOR (UTC en producción).
      const dia = new Date(); dia.setHours(0, 0, 0, 0);
      const cuotas = await cuotasProveedores();
      const proveedores = await Promise.all(cuotas.map(async (c) => {
        const cargadas = await cuentasDe(c.provider, ctx.ws).catch(() => null);
        return {
          proveedor: c.provider, nombre: c.label,
          // null = no se pudo contar; 0 = no tiene ninguna cuenta cargada
          cuentas_cargadas: cargadas,
          cuentas_max: MAX_KEYS,
          pedidos_hoy: c.requests, tokens_hoy: c.tokens,
          tope_pedidos_dia: c.rpd ?? null, tope_tokens_dia: c.tokensDia ?? null,
          consumido_pct: Math.round(c.pct * 100),
          agotada: cargadas === 0 ? null : c.agotado,
          nota: c.nota ?? null,
          por_cuenta: cargadas === 0 ? [] : (c.cuentas ?? []).map((k) => ({ cuenta: k.cuenta, pedidos_hoy: k.requests, tokens_hoy: k.tokens, consumido_pct: Math.round(k.pct * 100), agotada: k.agotado })),
        };
      }));
      return J({
        ventana: { desde: dia.toISOString(), hasta: new Date().toISOString() },
        proveedores,
        avisos: [
          'Los topes diarios son aproximados (los planes gratis cambian seguido). Sin tope declarado, consumido_pct queda en 0.',
          'Las cuotas NO se suman entre cuentas: una IA está agotada solo si todas sus cuentas lo están. Desde el 90% se trata como agotada.',
          'agotada null = el negocio no tiene esa IA conectada.',
        ],
      });
    },
  },

  ver_gasto_ia: {
    leer: async (_input, ctx) => {
      const u = await getUsageSummary();
      // El saldo de Claude de un cliente sin key propia es el del ws 1 (ver encabezado, 3).
      const claudePropio = ctx.ws === OWNER_WS || !!(await credDelCliente('ANTHROPIC_API_KEY', ctx.ws).catch(() => null));
      const ahora = new Date();
      const mes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
      const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
      const porProceso = u.porFeature.filter((f) => f.costUsd > 0 || f.tokens > 0);
      return J({
        ventana: { mes_desde: mes.toISOString(), hoy_desde: hoy.toISOString(), hasta: ahora.toISOString() },
        gasto_mes_usd: r4(u.gastadoMesUsd),
        por_proveedor: u.porProveedor.map((p) => {
          const ocultarSaldo = p.provider === 'anthropic' && !claudePropio;
          return {
            proveedor: p.provider,
            gratis: p.gratis,
            gasto_mes_usd: r4(p.costMesUsd),
            tokens_mes: p.tokens,
            tokens_hoy: p.tokensHoy,
            // null = no hay saldo cargado a mano (distinto de 0)
            saldo_cargado_usd: ocultarSaldo ? null : (p.saldo ? r4(p.saldo.usd) : null),
            restante_usd: ocultarSaldo || p.restanteUsd == null ? null : r4(p.restanteUsd),
            ...(p.provider === 'openrouter' && p.cuentas?.length ? { restante_por_cuenta_usd: p.cuentas.map((c) => ({ cuenta: c.cuenta, restante_usd: r4(c.restanteUsd) })) } : {}),
            ...(ocultarSaldo ? { nota: 'Claude corre con la cuenta de la agencia: su saldo no es de este negocio.' } : {}),
          };
        }),
        por_proceso: porProceso.slice(0, 10).map((f) => ({ proceso: f.feature, gasto_usd: r4(f.costUsd), tokens: f.tokens })),
        ...(porProceso.length > 10 ? { procesos_fuera_de_la_lista: porProceso.length - 10 } : {}),
        ultima_operacion: u.ultimaOp ? { proceso: u.ultimaOp.feature, gasto_usd: r4(u.ultimaOp.costUsd), tokens: u.ultimaOp.tokens, cuando: u.ultimaOp.at } : null,
        avisos: [
          'Es un PISO: la búsqueda semántica, la transcripción y el análisis de creativos gastan sin registrarse.',
          // El aviso de «la lectura corta en 1000 llamadas» se sacó el 17/09:
          // getUsageSummary pagina (leerTodo) y el gasto ya es completo.
          'Las IA gratis (Groq, Mistral, OpenRouter sin créditos, Gemini sin saldo) cuentan 0 USD.',
          'restante_usd de OpenRouter lo informa OpenRouter; si no respondió, queda null.',
        ],
      });
    },
  },

  ver_activacion_tab: {
    leer: async (input, ctx) => {
      const key = str(input, 'key');
      const t = tabActivacion(key);
      // Las disponibles salen del catálogo, no de una copia: la copia seguía ofreciendo
      // 'whatsapp' después de que esa entrada se fue con el WhatsApp oficial (09/10/2026).
      if (!t) return fallo(`La tab «${key}» no tiene activación declarada.`, Object.keys(TABS_ACTIVACION));
      const conectada = t.servicio ? await integracionConectada(t.servicio, ctx.ws).catch(() => null) : null;
      return J({
        tab: t.key, titulo: t.titulo,
        integracion: t.servicio ?? null,
        // null = esta tab no depende de una integración (o no se pudo leer)
        integracion_conectada: conectada,
        que_falta: t.queFalta,
        ademas: t.ademas ?? null,
        a_donde_ir: t.cta
          ? { texto: t.cta.label.replace(/\s*→\s*$/, ''), url: linkPantalla(t.cta.href, ctx.ws) }
          : { texto: 'Conectar la integración', url: linkIntegracion(t.servicio ?? '') },
        nota: 'integracion_conectada true no garantiza datos: lee «ademas».',
      });
    },
  },

  ver_estado_agente_claude: {
    leer: async (_input, ctx) => {
      // El token es un SECRETO y desde el 09/10/2026 ni siquiera está guardado: lo que hay es
      // su hash y su PISTA (el prefijo y los últimos 4), que es lo único que sale de acá.
      const token = await tokenAgenteVisible(ctx.ws);
      const alcance = token?.alcance ?? null;
      return J({
        conectado: !!token,
        pista: token?.pista ?? null,
        alcance,
        alcance_titulo: alcance ? TEXTO_ALCANCE[alcance].titulo : null,
        que_permite: alcance ? TEXTO_ALCANCE[alcance].que : null,
        nota: token
          ? 'Tener el token no prueba que Claude lo esté usando: solo que el negocio lo generó. Cambiar el alcance exige generar uno nuevo desde el link.'
          : 'Todavía no se generó el token: se genera desde el link, y ahí mismo se instala la skill.',
        link: linkIntegracion('agente'),
      });
    },
  },

  link_configurar_integracion: {
    leer: async (input, ctx) => {
      const key = str(input, 'servicio');
      const tarjetas = await tarjetasDelWs(ctx.ws);
      const t = tarjetas.find((d) => d.key === key);
      if (!t) return fallo(`La integración «${key}» no existe para este negocio.`, tarjetas.map((d) => d.key));
      return J({
        key: t.key, nombre: t.nombre,
        url: linkIntegracion(t.key),
        instruccion: 'Pásale el link TAL CUAL: ahí la persona pega la credencial o autoriza con Google. Solo un admin del negocio puede abrirlo. No pidas la key por el chat.',
      });
    },
  },
};
