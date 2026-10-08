// =============================================================================
// API: secuencias de setting (tab /setting)
// =============================================================================
// GET  → { secuencias, rolAdmin, objetivos, etapas, leadMagnets } — admin y setter
//        del workspace (setter solo lectura; el POST se lo niega).
// POST → admin-only:
//        { action:'crear', etapa, nombre }                → secuencia nueva (wizard paso 1)
//        { action:'sugerir-gancho'|'sugerir-preguntas', objetivo, etapa } → { sugerencias }
//        { action:'guardar-estrategia', secuenciaId, estrategia }         → { ok }
//        { action:'probar', secuenciaId }                 → prueba en vivo al admin
//        { action:'trigger', id, trigger_tipo, etapa?, producto_id?, funnel_id?, etiqueta_id? }
//                                                          → «qué lo dispara» (400 si no se puede)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import {
  getSettingData, guardarEstrategia, crearSecuenciaDesdeEtapa, probarSecuencia,
  muestraParaCriterio, muestraATexto, productosConEtapas, setDisparadorEtapa, setDisparadorEntrega, renombrarSecuencia, setCronSecuencia,
  setTriggerSecuencia, TriggerInvalidoError,
  SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE, SETTING_CRITERIO_TEMPLATE,
} from '@/lib/setting-secuencias';
import { parseEstrategia, parseCriterio, OBJETIVOS } from '@/lib/setting-estrategia';
// El catálogo de disparadores vive en UN lugar (lib/email-marketing.ts, junto al de
// etapas) y viaja en el payload: un componente cliente no puede importar un módulo con
// `server-only`, y copiar las 18 etiquetas acá es crear la segunda copia que se desfasa.
import { TRIGGERS } from '@/lib/email-marketing';
import { chatCheapCascade } from '@/lib/ai-cheap';
import { chatClaude } from '@/lib/anthropic';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getFunnelDefault } from '@/lib/funnels';
import { huecosDeSecuencias, archivarSecuencias, desarchivarSecuencia } from '@/lib/secuencias-huecos';
import { tzActual } from '@/lib/timezone';
import { generarVariantes } from '@/lib/secuencias-variantes';
import { handoffsPendientes, resolverHandoff } from '@/lib/chat-agent-handoff';
import { getEntregables, setEntregables } from '@/lib/entregable';
import { getInstanciaRow, motivoCaida } from '@/lib/evolution';
import { envioWhatsappHabilitadoEstricto } from '@/lib/envio-flags';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null && rol === 'admin') {
    // Admin de agencia sin impersonar: no hay workspace del que leer secuencias.
    return Response.json({ ok: false, error: 'Entra al workspace de un cliente (impersonando) para ver su Setting.' }, { status: 400 });
  }
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso a Setting en este workspace.' }, { status: 403 });
  }
  try {
    const [{ secuencias, serie }, funnel, leadMagnets, wsRow, huecos, instancia] = await Promise.all([
      getSettingData(),
      // DEFAULT hoy: la pantalla trabaja sobre el funnel del negocio. Cuando haya
      // varios, acá entra el desplegable y el funnel elegido.
      getFunnelDefault().catch(() => null),
      getEntregables().catch(() => []),
      getWorkspace(ws).catch(() => null),
      // Las etapas de nutrición que quedaron sin secuencia. Reemplaza al seed:
      // antes se creaban solas con copy de relleno; ahora se avisa que faltan.
      huecosDeSecuencias().catch(() => []),
      // ⚠️ El estado del NÚMERO, que la pantalla de trabajo no miraba nunca.
      // Vivía solo en el onboarding, así que en cuanto el dueño lo terminaba
      // dejaba de verlo — y una secuencia en verde sobre un número caído se
      // lee como que está funcionando. Medido el 08/09/2026 en el ws1: la
      // sesión se cayó el 3/09, la secuencia decía «Activa» cinco días, y el
      // único envío real terminó en 'fallo'.
      // El `undefined` del catch NO es 'desconectado': es «no pudimos
      // preguntarlo», y la pantalla no puede afirmar lo primero cuando pasó
      // lo segundo.
      getInstanciaRow().catch(() => undefined),
    ]);
    // Tres respuestas distintas, no dos: nunca lo vinculó / se cayó / no sé.
    // POR QUE se cayo, no solo QUE se cayo. «Tu WhatsApp esta desconectado» le
    // hizo abrir WhatsApp en el telefono, encontrarlo perfecto y contestar «no
    // entiendo». Su telefono estaba bien: lo que se cayo es el DISPOSITIVO
    // VINCULADO, y eso solo se ve en «Dispositivos vinculados».
    const motivo = instancia && instancia.estado !== 'conectado'
      ? await motivoCaida(instancia.instance_name, 4000).catch(() => null)
      : null;
    const canal = instancia === undefined
      ? { estado: 'desconocido' as const, desde: null, desvinculado: false }
      : instancia === null
        ? { estado: 'sin_vincular' as const, desde: null, desvinculado: false }
        : {
          estado: instancia.estado,
          // La fecha de la CAIDA le gana a la de la ultima conexion: es la que
          // el dueno puede cruzar con lo que vio pasar ese dia.
          desde: motivo?.cuando ?? instancia.ultima_conexion_at,
          desvinculado: motivo?.desvinculado ?? false,
        };
    // Etapas elegibles para colgar una secuencia de mensajes: nutrición + pipeline (sin salidas).
    const etapas = (funnel?.stages ?? [])
      .filter((s) => (s.band ?? 'pipeline') !== 'salidas')
      .map((s) => ({ value: s.key, label: s.label }));
    // Los PRODUCTOS con sus etapas: lo que el desplegable del disparador necesita.
    // `etapas` (arriba) sigue siendo el del embudo del NEGOCIO y no se saca: lo usa el
    // wizard que crea una secuencia, y romperlo de paso no es parte de este cambio.
    const productos = await productosConEtapas().catch(() => []);
    return Response.json({
      // ⚠️ LA ZONA VIAJA. El texto del horario la nombra a propósito: de los 10
      // workspaces activos SEIS no tienen `mako.timezone` y caen a America/Tijuana,
      // así que un «a las 9» sin zona es una afirmación que nadie verificó.
      ok: true, secuencias, serie, rolAdmin: rol === 'admin', objetivos: OBJETIVOS, etapas, productos, disparadores: TRIGGERS,
      tz: await tzActual().catch(() => null),
      leadMagnets: leadMagnets.map((l) => ({ id: l.id, nombre: l.nombre })),
      negocio: wsRow?.nombre ?? '', huecos, handoffs: await handoffsPendientes().catch(() => []),
      canal,
      // El interruptor del envío REAL (#328). Lo leía sólo /whatsapp, y el comentario de
      // WhatsAppApp ya decía que venía acá: no venía. `null` = no se pudo leer.
      envioWhatsapp: await envioWhatsappHabilitadoEstricto().catch(() => null),
    });
  } catch (e) {
    console.error(`[api:setting/secuencias GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

async function sugerir(template: string, key: string, objetivo: string, etapa: string): Promise<string[]> {
  const perfil = await perfilNegocioTexto().catch(() => '');
  const user = await renderPrompt(key, template, {
    objetivo: objetivo || '(sin objetivo)', etapa: etapa || '(sin etapa)', perfil: perfil || '(sin perfil cargado)',
  });
  // Cascada y no `chatCheap`: un 429 del único proveedor dejaba la pantalla sin
  // sugerencias (y tiraba 500) con otras cuatro IA gratis conectadas sin usar.
  const raw = await chatCheapCascade({
    system: 'Eres MaKo. Devuelve EXCLUSIVAMENTE un objeto JSON {"sugerencias": [...strings]} en el español neutro del negocio. Sin markdown ni texto alrededor.',
    user, json: true, feature: 'setting-sugerencias', maxTokens: 600,
  });
  try {
    const o = JSON.parse(raw.replace(/```(?:json)?/gi, '').trim()) as { sugerencias?: unknown };
    const arr = Array.isArray(o?.sugerencias) ? o.sugerencias : (Array.isArray(o) ? (o as unknown[]) : []);
    return arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede editar secuencias.' }, { status: 403 });
  }
  let body: {
    action?: string; secuenciaId?: unknown; estrategia?: unknown; objetivo?: unknown; etapa?: unknown; nombre?: unknown; ids?: unknown; enlace?: unknown;
    handoffId?: unknown; escenario?: unknown; funnelId?: unknown; productoId?: unknown; clase?: unknown; cron?: unknown;
    id?: unknown; trigger_tipo?: unknown; producto_id?: unknown; funnel_id?: unknown; etiqueta_id?: unknown;
  };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    /**
     * «QUÉ LO DISPARA», el desplegable de la tarjeta del CRON (08/10/2026, punto 5). Uno solo
     * para todos los disparadores, con el dato que trae cada uno (etapa, producto, etiqueta). La
     * validación vive en `setTriggerSecuencia`; lo que no se puede guardar contesta 400.
     */
    if (body.action === 'trigger') {
      const id = Number(body.id ?? body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
      const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
      try {
        await setTriggerSecuencia(id, {
          trigger_tipo: String(body.trigger_tipo ?? ''),
          etapa: body.etapa == null ? null : String(body.etapa),
          producto_id: num(body.producto_id), etiqueta_id: num(body.etiqueta_id),
          // «No vino» no es «null» (= todos los embudos): sin la clave, el embudo no se toca.
          ...('funnel_id' in body ? { funnel_id: num(body.funnel_id) } : {}),
        });
      } catch (e) {
        if (e instanceof TriggerInvalidoError) return Response.json({ ok: false, error: e.message }, { status: 400 });
        throw e;
      }
      return Response.json({ ok: true });
    }

    // El NOMBRE, que se edita tocándolo en el lienzo (mismo gesto que en /mensajes).
    if (body.action === 'nombre') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      await renombrarSecuencia(id, String(body.nombre ?? ''));
      return Response.json({ ok: true });
    }

    /**
     * EL HORARIO: la mitad «POR TIEMPO» del disparador (mig 0192).
     *
     * `cron: null` la devuelve a disparar por una ACCIÓN. Son dos acciones distintas y
     * no una con un flag, porque las dos mitades viven en columnas distintas y elegir
     * una tiene que APAGAR la otra — dejar las dos puestas sería una secuencia
     * disparada por las dos cosas con la pantalla diciendo una.
     */
    if (body.action === 'cron') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      await setCronSecuencia(id, body.cron ?? null);
      return Response.json({ ok: true });
    }

    // El disparador de una secuencia: «si un lead cae en ESTA etapa de ESTE producto».
    if (body.action === 'disparador') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      // `funnelId` ausente o null = «todos los productos», que es una elección y no un
      // olvido: la pantalla la ofrece como opción con ese nombre.
      // `clase` dice de QUÉ etapa se trata: la del embudo (venta) o la de la entrega del
      // servicio. No se deduce de la key —las dos listas las edita el cliente y pueden
      // chocar—, así que la manda la pantalla, que es la que sabe de qué sección salió.
      if (body.clase === 'entrega') {
        const pid = Number(body.productoId);
        if (!Number.isFinite(pid)) return Response.json({ ok: false, error: 'Elegí de qué producto es la entrega.' }, { status: 400 });
        await setDisparadorEntrega(id, String(body.etapa ?? ''), pid);
        return Response.json({ ok: true });
      }
      const fid = body.funnelId == null || body.funnelId === '' ? null : Number(body.funnelId);
      if (fid != null && !Number.isFinite(fid)) return Response.json({ ok: false, error: 'producto inválido' }, { status: 400 });
      await setDisparadorEtapa(id, String(body.etapa ?? ''), fid);
      return Response.json({ ok: true });
    }

    if (body.action === 'crear') {
      const etapa = String(body.etapa ?? '').trim();
      const nombre = String(body.nombre ?? '').trim();
      if (!etapa || !nombre) return Response.json({ ok: false, error: 'Faltan la etapa y el nombre de la secuencia de mensajes.' }, { status: 400 });
      const id = await crearSecuenciaDesdeEtapa(etapa, nombre);
      return Response.json({ ok: true, secuenciaId: id });
    }
    if (body.action === 'resolver-handoff') {
      // El dueño le enseñó el caso: el escenario se suma a la secuencia y la
      // inscripción vuelve a correr.
      const id = Number(body.handoffId);
      const e = body.escenario as { titulo?: unknown; cuando?: unknown; comoResponder?: unknown } | undefined;
      const titulo = String(e?.titulo ?? '').trim();
      const cuando = String(e?.cuando ?? '').trim();
      if (!Number.isFinite(id) || !titulo || !cuando) return Response.json({ ok: false, error: 'Falta el nombre del caso o cuándo aplica.' }, { status: 400 });
      await resolverHandoff(id, { titulo, cuando, comoResponder: String(e?.comoResponder ?? '').trim() });
      return Response.json({ ok: true });
    }
    if (body.action === 'variantes') {
      // Se generan UNA vez, al terminar de armar la secuencia, y el motor
      // sortea entre ellas en cada envío: mandar el mismo texto palabra por
      // palabra a cientos de personas es lo que WhatsApp busca para restringir
      // un número, y además se lee como un bot.
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
      const r = await generarVariantes(id);
      return Response.json({ ok: true, ...r });
    }
    if (body.action === 'crear-lead-magnet') {
      // El lead magnet se carga ACÁ, en el paso que lo pide. Mandarlo a otra
      // pantalla a mitad del wizard es la forma más rápida de que no vuelva.
      const nombre = String(body.nombre ?? '').trim();
      const enlace = String(body.enlace ?? '').trim();
      if (!nombre || !enlace) return Response.json({ ok: false, error: 'Falta el nombre o el enlace.' }, { status: 400 });
      // Solo http(s): un enlace con otro esquema (javascript:, data:) termina
      // pegado en un mensaje que sale a un desconocido.
      if (!/^https?:\/\//i.test(enlace)) return Response.json({ ok: false, error: 'El enlace tiene que empezar con http:// o https://' }, { status: 400 });
      const lista = await getEntregables();
      const nuevoLm = { id: `lm-${Date.now().toString(36)}`, nombre, tipo: 'Lead magnet', queEs: '', fomo: '', enlace };
      await setEntregables([...lista, nuevoLm]);
      return Response.json({ ok: true, id: nuevoLm.id });
    }
    if (body.action === 'archivar') {
      // Sin ids = archivar TODAS las vigentes. Es la salida para el dueño que
      // se encontró con las secuencias sembradas y quiere empezar de cero.
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(Number).filter(Number.isFinite) : undefined;
      const r = await archivarSecuencias(ids);
      return Response.json({ ok: true, ...r });
    }
    if (body.action === 'desarchivar') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
      await desarchivarSecuencia(id);
      return Response.json({ ok: true });
    }
    if (body.action === 'sugerir-criterio') {
      // MaKo deduce el criterio de calificación de los leads YA evaluados del
      // CRM (respuestas del formulario + calificado + cierres). Propuesta para
      // que el dueño corrija, no verdad revelada.
      const filas = await muestraParaCriterio();
      const perfil = await perfilNegocioTexto().catch(() => '');
      const user = await renderPrompt('setting.criterio', SETTING_CRITERIO_TEMPLATE, {
        perfil: perfil || '(sin perfil cargado)',
        datos: muestraATexto(filas),
      });
      // Deducir un patrón de datos reales es ANÁLISIS → Claude, no la IA barata
      // (Groq tampoco valida este JSON). Parseo tolerante: si viene con prosa
      // alrededor, igual rescatamos el objeto.
      const raw = await chatClaude(
        'Eres MaKo. Devuelves EXCLUSIVAMENTE un objeto JSON {"califica":[...],"descalifica":[...]} con strings en español. Sin markdown ni texto alrededor.',
        [{ role: 'user', content: user }],
        { effort: 'medium', maxTokens: 900, feature: 'setting-criterio' },
      );
      let criterio = { califica: [] as string[], descalifica: [] as string[] };
      try {
        const limpio = raw.replace(/```(?:json)?/gi, '').trim();
        const ini = limpio.indexOf('{');
        const fin = limpio.lastIndexOf('}');
        if (ini >= 0 && fin > ini) criterio = parseCriterio(JSON.parse(limpio.slice(ini, fin + 1)));
      } catch { /* sin criterio: la UI lo dice */ }
      return Response.json({ ok: true, criterio, muestra: filas.length });
    }
    if (body.action === 'sugerir-gancho' || body.action === 'sugerir-preguntas') {
      const [tpl, key] = body.action === 'sugerir-gancho'
        ? [SETTING_GANCHO_TEMPLATE, 'setting.gancho']
        : [SETTING_PREGUNTAS_TEMPLATE, 'setting.preguntas'];
      const sugerencias = await sugerir(tpl, key, String(body.objetivo ?? ''), String(body.etapa ?? ''));
      return Response.json({ ok: true, sugerencias });
    }
    if (body.action === 'guardar-estrategia') {
      const id = Number(body.secuenciaId);
      const est = parseEstrategia(body.estrategia);
      if (!Number.isFinite(id) || !est) return Response.json({ ok: false, error: 'estrategia inválida' }, { status: 400 });
      await guardarEstrategia(id, est);
      return Response.json({ ok: true });
    }
    if (body.action === 'probar') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      const r = await probarSecuencia(id);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
      return Response.json({ ok: true, enviadosWa: r.enviadosWa, enviadosEmail: r.enviadosEmail, avisos: r.avisos });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:setting/secuencias POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
