import 'server-only';

// =============================================================================
// Área «operaciones» — los cuerpos. Lecturas, y el ✓ de un «Completado» (ver operaciones.def.ts).
// =============================================================================

import type { Runners, SalidaLectura } from '../tipos';
import { cancelarRespuestasDe, leerCarteros, listarPedidos } from '@/lib/operaciones';
import { leerTurnos, leerUltimosTurnos } from '@/lib/centro-turnos-db';
import { leerYaVistosDe, marcarYaVistoDe } from '@/lib/centro-ya-vistos-db';
import { ignorarPregunta, leerPreguntas } from '@/lib/centro-preguntas-chat-db';
import { estaAbierta } from '@/lib/centro-preguntas-chat';
import {
  agruparAvances, chatsPorNombre, completadoSinVer, completadosDeLasCuentas, completadosSinVer, lineasDeConversacion, lineasParaLaApi, pedidoDelCompletado,
  pedidosDelCompletado, piezaParaLaApi, sinMarkdown, nodoDeCompletado, type CompletadoDeChat, type LineaChat, type YaVistos,
} from '@/lib/centro-chats';
import { ESTADOS, ROTULO, carteroVivo, type EstadoPedido, type TurnoChat } from '@/lib/operaciones-reglas';
import { cierreComoClaude, listasEnRenglones } from '@/lib/respuesta-como-claude';

const json = (o: unknown): string => JSON.stringify(o);
const cuentaN = (c: string | null) => (c ? `cuenta ${c.replace('claude', '')}` : 'cuenta desconocida');
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Los chats que dicen «Completado», con lo mismo que la lista del Ops Center, y el ✓ de cada uno. null = no se pudieron leer los
 *  ✓ (no se inventa). */
async function completados(): Promise<{ lista: CompletadoDeChat[]; vistos: YaVistos } | null> {
  const [{ carteros }, ultimos, vistos] = await Promise.all([leerCarteros(), leerUltimosTurnos(), leerYaVistosDe()]);
  return vistos ? { lista: completadosDeLasCuentas(carteros, ultimos, vistos), vistos } : null;
}
/** Un «Completado», como lo muestra el bloque de arriba de la caja: cuándo, su título, lo que respondía (y quién lo pidió), la
 *  respuesta ENTERA y su página. */
function resumen(lineas: readonly LineaChat[], t: TurnoChat) {
  const instante = Date.parse(t.at);
  const n = nodoDeCompletado(t, instante);
  const p = pedidoDelCompletado(lineas, t);
  return {
    termino: new Date(instante).toISOString(),
    titulo: n?.titulo && n.titulo !== 'Ya está' ? sinMarkdown(n.titulo) : 'Completado',
    pedido: p?.texto ?? null,
    pidio: p ? p.de ?? 'Martín' : null,
    // Como el bloque (26/10/2026): TODO lo que le dijo Martín en ese tramo, cada mensaje por su lado, del más viejo al más nuevo.
    contexto: pedidosDelCompletado(lineas, t).map((x) => ({ de: x.de ?? 'Martín', texto: x.texto })),
    // Como se dibuja (26/10/2026): un «1) … 2) …» corrido, en renglones (lib/respuesta-como-claude.ts).
    respuesta: listasEnRenglones(t.texto),
    revisar: n?.revisar?.pagina ?? null,
  };
}
/** El de ese nombre (sin mayúsculas ni tildes; «Cerebro» también por su nombre de antes). */
const elDe = (lista: readonly CompletadoDeChat[], chat: string) => lista.find((c) => normal(c.titulo) === normal(chat) || c.clave === `nombre:${normal(chat)}`);

export const RUNNERS: Runners = {
  ver_pedidos_operaciones: {
    leer: async (input): Promise<SalidaLectura> => {
      const estado = ESTADOS.includes(input.estado as EstadoPedido) ? (input.estado as EstadoPedido) : null;
      const limite = typeof input.limite === 'number' && input.limite >= 1 ? Math.min(50, Math.floor(input.limite)) : 20;
      const todos = await listarPedidos(estado ? 100 : limite);
      const pedidos = (estado ? todos.filter((p) => p.estado === estado) : todos).slice(0, limite);
      return json({
        pedidos: pedidos.map((p) => ({
          id: p.id,
          creado: p.created_at,
          chat: p.destino_titulo ?? p.destino,
          cuenta: cuentaN(p.destino_cuenta),
          estado: ROTULO[p.estado],
          texto: p.texto.length > 300 ? `${p.texto.slice(0, 300)}…` : p.texto,
          ...(p.voz ? { audio: { segundos: p.voz.segundos } } : {}),
          motivo: p.motivo,
          // Como se dibuja (26/10/2026): un «1) … 2) …» corrido, en renglones (lib/respuesta-como-claude.ts).
          cierre: p.cierre ? cierreComoClaude(p.cierre) : null,
        })),
        nota: pedidos.length
          ? 'Escrito ≠ entregado ≠ hecho ≠ comprobado: «entregado» quiere decir que salió hacia el chat, no que lo terminó.'
          : 'No hay pedidos con ese filtro.',
      });
    },
  },
  ver_carteros_operaciones: {
    leer: async (): Promise<SalidaLectura> => {
      const { carteros, tokenPista } = await leerCarteros();
      const ahora = Date.now();
      return json({
        carteros: carteros.map((k) => ({
          cuenta: cuentaN(k.cuenta),
          vivo: carteroVivo(k, ahora),
          ultimaVuelta: k.vistoAt,
          // Con el servicio de la PC, la PC da noticias sin Runner (30/10/2026): `vivo` y `ultimaVuelta` son del Runner.
          ultimaNoticiaDeLaPc: k.noticiasAt ?? k.vistoAt,
          version: k.version,
          chatsAbiertos: k.chats.filter((c) => c.vivo).map((c) => c.titulo),
          clavesAceptadas: k.claves.length,
        })),
        token: tokenPista ? 'configurado' : 'sin token: se crea en /admin/operaciones → Runners → Nuevo Runner',
        nota: carteros.length ? 'Un trabajo a una cuenta cuyo Runner no está activo espera: se arregla abriendo el chat Runner en la app de Claude.' : 'Ningún Runner se conectó todavía: se conecta desde /admin/operaciones → Runners → Nuevo Runner.',
      });
    },
  },
  ver_completados_operaciones: {
    leer: async (input): Promise<SalidaLectura> => {
      const leido = await completados();
      if (!leido) return json({ error: 'No pude leer qué «Completado» ya viste. Vuelve a intentarlo en un rato.' });
      const todos = leido.lista;
      const chat = typeof input.chat === 'string' && input.chat.trim() ? input.chat.trim() : null;
      const lista = chat ? todos.filter((c) => c === elDe(todos, chat)) : todos;
      // La respuesta ENTERA y lo que pidió Martín: los turnos completos de sus sesiones (la lista trae sólo el renglón).
      const detalle = await Promise.all(lista.map(async (c) => {
        const lineas: LineaChat[] = (await leerTurnos(c.locales)).map((t) => ({ tipo: 'turno', instante: Date.parse(t.at), turno: t }));
        const t = completadoSinVer(lineas, c.instante - 1);
        // Los de antes que tampoco vio, del más viejo al más nuevo: el bloque los muestra de a uno, con las flechas (25/10/2026).
        const antes = completadosSinVer(lineas, leido.vistos[c.clave]).filter((x) => x.uuid !== t?.uuid);
        return {
          chat: c.titulo, cuenta: cuentaN(c.cuenta),
          ...(t ? resumen(lineas, t) : { termino: new Date(c.instante).toISOString(), titulo: 'Completado', pedido: null, pidio: null, respuesta: null, revisar: null }),
          anteriores: antes.map((x) => resumen(lineas, x)),
        };
      }));
      return json({
        completados: detalle,
        nota: detalle.length
          ? 'Cada chat sigue diciendo «Completado» hasta que Martín lo da por visto (en la pantalla, «Ya lo vi»; por aquí, `marcar_visto_operaciones`, que da por vistos también sus `anteriores`).'
          : chat ? `«${chat}» no dice «Completado».` : 'Ningún chat dice «Completado»: todo lo terminado ya está visto.',
      });
    },
  },
  ver_mensajes_operaciones: {
    leer: async (input): Promise<SalidaLectura> => {
      const chat = typeof input.chat === 'string' ? input.chat.trim() : '';
      if (!chat) return json({ error: 'Falta el chat: su nombre, como en el Ops Center («Cerebro», «CRM»).' });
      const limite = typeof input.limite === 'number' && input.limite >= 1 ? Math.min(100, Math.floor(input.limite)) : 30;
      const { carteros } = await leerCarteros();
      const chats = chatsPorNombre(carteros);
      const c = chats.find((x) => normal(x.titulo) === normal(chat) || x.clave === `nombre:${normal(chat)}`);
      if (!c) return json({ error: `No encontré el chat «${chat}».`, chats: chats.map((x) => x.titulo).slice(0, 40) });
      // Lo MISMO que dibuja la pantalla: sus turnos y lo que Martín le mandó desde el Ops Center (`lineasParaLaApi`), la
      // conversación (`lineasDeConversacion`) y los avances seguidos en un grupo (`agruparAvances`, 25/10/2026). Los turnos
      // enteros: ninguno se pierde adentro de un grupo. Una nota de voz sale como audio, con su transcripción (26/10/2026).
      const [turnos, pedidos, preguntas] = await Promise.all([leerTurnos(c.locales), listarPedidos(100), leerPreguntas(c.locales)]);
      const lineas = lineasParaLaApi(turnos, pedidos.filter((p) => c.locales.includes(p.destino)), preguntas);
      const piezas = agruparAvances(lineasDeConversacion(lineas)).slice(-limite);
      return json({
        chat: c.titulo, cuenta: cuentaN(c.cuenta),
        mensajes: piezas.map((p) => piezaParaLaApi(p, c.titulo)),
        nota: 'Un grupo («avances») es una sola burbuja en la pantalla: `ultimo` se ve entero y `anteriores` (del más nuevo al más viejo) se abren tocándolos.',
      });
    },
  },
  marcar_visto_operaciones: {
    preparar: async (input) => {
      const chat = typeof input.chat === 'string' ? input.chat.trim() : '';
      if (!chat) return { error: 'Falta el chat: el nombre del que dice «Completado».', faltan: ['chat'] };
      const leido = await completados();
      if (!leido) return { error: 'No pude leer qué «Completado» ya viste. Vuelve a intentarlo en un rato.', falla: true };
      const c = elDe(leido.lista, chat);
      if (!c) return { error: `«${chat}» no dice «Completado».`, disponibles: leido.lista.map((x) => x.titulo) };
      return { payload: { clave: c.clave, instante: c.instante, chat: c.titulo }, resumen: `Dar por visto el «Completado» de ${c.titulo}.` };
    },
    ejecutar: async (payload) => {
      const clave = typeof payload.clave === 'string' ? payload.clave : '';
      const instante = typeof payload.instante === 'number' && Number.isFinite(payload.instante) ? payload.instante : NaN;
      if (!clave.startsWith('nombre:') || !Number.isFinite(instante)) return { ok: false, resumen: 'No sé qué «Completado» marcar: pide la lista de nuevo.' };
      await marcarYaVistoDe(clave, instante);
      return { ok: true, resumen: `Listo: el «Completado» de ${typeof payload.chat === 'string' ? payload.chat : 'ese chat'} ya está visto.` };
    },
  },

  // El DEBUG de un negocio desde el grupo de SuperAdmin (29/10/2026): ver operaciones.def.ts. Las lecturas de integraciones son las
  // MISMAS que usa ese negocio (su `ver_integraciones`, `ver_ia_del_negocio`, `ver_conexion_meta`), corridas con SU workspace: lo que
  // ve MaKo es lo que vería él. Cada parte por su lado: una que falla dice su error y las demás salen igual.
  diagnosticar_negocio: {
    leer: async (input, ctx): Promise<SalidaLectura> => {
      const { wsSuperAdmin, runWithWorkspace } = await import('@/lib/workspace');
      if (ctx.ws !== (await wsSuperAdmin())) return { content: 'Diagnosticar otro negocio es sólo de la plataforma.', isError: true };
      const { vistaDeClientes } = await import('@/lib/clientes-plataforma');
      const { buscarNegocio } = await import('@/lib/diagnostico-negocio');
      const v = await vistaDeClientes();
      const pedido = typeof input.negocio === 'string' ? input.negocio.trim() : '';
      const cand = buscarNegocio(pedido, v.filas.map((f) => ({ ws: f.ws, nombre: f.nombre })));
      if (cand.length !== 1) {
        return json(cand.length
          ? { encontrado: false, candidatos: cand, nota: `«${pedido}» calza con más de un negocio: pregunta cuál.` }
          : { encontrado: false, nota: `No hay un negocio que se llame «${pedido}». Pregunta de cuál es.`, negocios: v.filas.slice(0, 40).map((f) => ({ ws: f.ws, nombre: f.nombre })) });
      }
      const ws = cand[0].ws;
      const fila = v.filas.find((f) => f.ws === ws)!;
      const ctxDelNegocio = { ...ctx, ws };
      const { RUNNERS: INTEG } = await import('./integraciones.run');
      const deSuLectura = async (id: 'ver_integraciones' | 'ver_ia_del_negocio' | 'ver_conexion_meta'): Promise<unknown> => {
        try {
          const run = INTEG[id];
          if (!run || !('leer' in run)) return { error: `${id} no es una lectura` };
          const r = await runWithWorkspace(ws, () => run.leer({}, ctxDelNegocio));
          const texto = typeof r === 'string' ? r : r.content;
          try { return JSON.parse(texto); } catch { return texto; }
        } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
      };
      const { getSupabaseServer } = await import('@/lib/supabase');
      const { ticketsDelNegocio } = await import('@/lib/tickets-db');
      const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const [integraciones, ia, meta, errores, tickets] = await Promise.all([
        deSuLectura('ver_integraciones'), deSuLectura('ver_ia_del_negocio'), deSuLectura('ver_conexion_meta'),
        getSupabaseServer().from('errores_app').select('titulo, origen, veces, ultima_vez, ejemplo, ticket_id')
          .contains('afectados', [{ ws }]).gte('ultima_vez', desde).order('ultima_vez', { ascending: false }).limit(10)
          .then((r) => (r.error ? { error: r.error.message } : (r.data ?? []).map((e) => ({
            titulo: e.titulo, origen: e.origen, veces: e.veces, ultima_vez: e.ultima_vez, ticket: e.ticket_id,
            pantalla: (e.ejemplo as { ruta?: string } | null)?.ruta ?? null,
          })))),
        ticketsDelNegocio(ws, 0, 8).then((r) => (r.ok ? r.datos.map((t) => ({ numero: t.id, estado: t.estado, titulo: t.titulo })) : { error: r.error })).catch((e) => ({ error: String(e) })),
      ]);
      return json({
        negocio: {
          ws, nombre: fila.nombre, plan: fila.capa, estado: fila.estado, en_riesgo: fila.riesgo, por_que_en_riesgo: fila.motivoRiesgo,
          dias_sin_entrar: fila.sinEntrar, onboarding_hecho: fila.onboardingHecho, leads: fila.leads,
        },
        integraciones, ia, meta, errores_7_dias: errores, tickets_abiertos: tickets,
        nota: 'Es lo que ve MaKo de ESE negocio, ahora. Contesta con estos hechos (qué tiene conectado, qué falla y desde cuándo), sin consejos genéricos. Si es un bug de MaKo, abre el ticket con esta evidencia.',
      });
    },
  },

  // Las aprobaciones de las apps de MaKo (4/11/2026): ver operaciones.def.ts. Lee lo que guardó el vigía en su última vuelta.
  ver_aprobaciones_pendientes: {
    leer: async (_input, ctx): Promise<SalidaLectura> => {
      const { wsSuperAdmin } = await import('@/lib/workspace');
      if (ctx.ws !== (await wsSuperAdmin())) return { content: 'Las aprobaciones de las tiendas son sólo de la plataforma.', isError: true };
      const { listaGuardadaDeAprobaciones } = await import('@/lib/vigia-aprobaciones-server');
      const { ultimaVuelta, filas } = await listaGuardadaDeAprobaciones();
      return json({
        ultima_revision: ultimaVuelta,
        esperando: filas.filter((f) => f.esperando),
        aprobadas: filas.filter((f) => !f.esperando).map((f) => ({ nombre: f.nombre, version: f.version, desde: f.desde, detalle: f.detalle })),
        nota: ultimaVuelta
          ? 'Es lo que leyó el vigía en su última revisión (la hora está en ultima_revision). «Hay que mirarlo a mano» es que no hay API o falta la credencial: no sé su estado, no lo inventes. Da los links tal cual.'
          : 'El vigía todavía no corrió: no hay nada leído. Dilo así, sin inventar estados.',
      });
    },
  },

  // «Ignorar» una pregunta (5/11/2026): lo mismo que el botón del bloque (app/admin/operaciones/acciones.ts → ignorarPreguntaAction).
  ignorar_pregunta_operaciones: {
    preparar: async (input) => {
      const chat = typeof input.chat === 'string' ? input.chat.trim() : '';
      const id = typeof input.pregunta === 'string' ? input.pregunta.trim().toLowerCase() : '';
      const volver = input.volver === true;
      if (!chat || !id) return { error: 'Falta el chat o el id de la pregunta (lo da `ver_mensajes_operaciones`).', faltan: [!chat ? 'chat' : 'pregunta'] };
      if (!/^[0-9a-f]{8}[0-9a-f-]{0,28}$/.test(id)) return { error: 'El id es el de la pregunta: sus primeros 8 caracteres o el entero.' };
      const { carteros } = await leerCarteros();
      const chats = chatsPorNombre(carteros);
      const c = chats.find((x) => normal(x.titulo) === normal(chat) || x.clave === `nombre:${normal(chat)}`);
      if (!c) return { error: `No encontré el chat «${chat}».`, disponibles: chats.map((x) => x.titulo).slice(0, 40) };
      const todas = (await leerPreguntas(c.locales)).filter((p) => p.id.startsWith(id));
      if (todas.length > 1) return { error: 'Hay más de una pregunta que empieza así: pasa el id entero.' };
      const p = todas[0];
      if (!p) return { error: `No encontré esa pregunta en «${c.titulo}».` };
      if (volver ? !p.ignorada : !!p.ignorada) return { error: volver ? 'Esa pregunta no está ignorada.' : 'Ya está ignorada.', yaEstaba: true };
      if (!volver && !estaAbierta(p)) return { error: p.respuesta ? 'Ya la contestaste.' : 'Ya no espera tu respuesta: el chat siguió.' };
      return {
        payload: { local: p.local, id: p.id, volver, chat: c.titulo },
        resumen: `${volver ? 'Volver a mostrar' : 'Ignorar'} la pregunta de ${c.titulo}: «${p.pregunta.slice(0, 120)}». Al chat no le llega nada.`,
      };
    },
    ejecutar: async (payload) => {
      const local = typeof payload.local === 'string' ? payload.local : '';
      const id = typeof payload.id === 'string' ? payload.id : '';
      const volver = payload.volver === true;
      const r = await ignorarPregunta(local, id, !volver);
      if (!r.ok) return { ok: false, resumen: r.error };
      if (!volver) await cancelarRespuestasDe(local, id).catch(() => 0);
      const chat = typeof payload.chat === 'string' ? payload.chat : 'ese chat';
      return { ok: true, resumen: volver ? `Listo: la pregunta de ${chat} vuelve a esperar tu respuesta.` : `Listo: la pregunta de ${chat} está en «Ignoradas». Al chat no le llegó nada.` };
    },
  },
};
