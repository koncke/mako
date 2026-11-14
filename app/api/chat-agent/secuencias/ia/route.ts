// =============================================================================
// API: crear (o agrandar) una automatización del Chatbot con IA, desde un pedido escrito
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md; el diseño completo, en el
// relevo R5 de esa tanda.
//
// POST { pedido, secuenciaId?, modo: 'crear' | 'editar', pasos?, respuestas?, historial?, intencion? } → STREAM NDJSON de
// `EventoIA` (lib/flujo-ia.ts) o `EventoPreguntaIA` (lib/automatizacion-chat.ts): fases REALES, que es lo que exige
// `GRAMATICA.analizando`:
//   {t:'fase', fase:'contexto', leyendo, texto}  — lo que se leyó («tu perfil · 4 etapas · 3 audios»)
//   {t:'fase', fase:'modelo'}                     — el modelo está escribiendo
//   {t:'fase', fase:'respuesta'}                  — una PREGUNTA: MaKo contesta y el borrador vuelve tal cual
//   {t:'fase', fase:'revision', reparadas}        — cuántas cosas reparó el código
//   {t:'pregunta', pregunta, mensaje}             — MaKo pregunta en vez de armar (después, el stream termina)
//   {t:'listo', …} | {t:'error', error}
// Los errores de ANTES del stream (403, 400, 409) salen como JSON plano.
// GET ?secuenciaId= → { ok, mensajes }: el chat con MaKo de esa automatización (sólo admin, con el ws del pedido).
//
//   · CREAR, desde la décima tanda (11/10/2026), vive en lib/flujo-ia-crear.ts (`crearFlujoConIA`): la MISMA función
//     que llama la API de MaKo («Pídeselo a MaKo» por WhatsApp). Esta ruta convierte sus fases en el stream.
//     SIN `secuenciaId` (la caja «Pídeselo a MaKo» del modal «Nueva automatización») la fila nace AL GUARDAR, pausada:
//     un «Cancelar» o un fallo no deja una vacía huérfana. CON `secuenciaId` exige que esté VACÍA y PAUSADA, y escribe
//     encima (la caja del lienzo vacío, que desde la décima tanda no se dibuja: docs/diseno-automations-galeria-v2.md §1).
//   · EDITAR (duodécima tanda, §2.6) cambia, quita y agrega, y NO guarda: devuelve los pasos para el borrador local del
//     lienzo (UNA foto de deshacer y Publicar, como cualquier cambio). `pasos` es ese borrador, que puede tener cambios
//     sin publicar; sin él, se parte de lo guardado. El CRON tampoco se guarda acá: viaja en `disparadores` y lo guarda
//     la pantalla por la acción del CRON, recién cuando la persona toca una opción.
//
// DUODÉCIMA TANDA (12/10/2026, docs/diseno-duodecima-tanda.md §2.4, §2.5 y §3.4):
//   · LAS PREGUNTAS: `respuestas` trae lo que la persona contestó; las impone el código (lib/flujo-ia-preguntas.ts).
//     Editar con la respuesta del CRON (`sobre: 'cron'`) NO llama al modelo; con `valor: 'igual'` no toca nada.
//   · EL CHAT: con `secuenciaId`, el turno de la persona se escribe al EMPEZAR y lo que dijo MaKo (la pregunta, el
//     resumen con los avisos, o el error) al TERMINAR. Sin `secuenciaId` (crear) lo vuelca `crearConIA` al nacer la fila,
//     con el `historial` de la galería. Un chat que no se guarda nunca tumba el pedido.
//
// ⚠️ NUNCA POR CLAUDE, NI POR NADA QUE COBRE: la cascada gratis vive en lib/flujo-ia-crear.ts (`generar`), con su
// historia (la falla de producción del 09/10/2026).
//
// ⚠️ LAS ETIQUETAS NUEVAS SE CREAN RECIÉN CUANDO TODO VALIDÓ, y antes se mira que la persona no
// haya cancelado (`req.signal`): un pedido cancelado MIENTRAS EL MODELO ESCRIBE no deja nada
// escrito. Después de la fase 'revision' la señal ya no se mira y el server termina de guardar
// (revisión, 09/10/2026): por eso la caja no dibuja «Cancelar» en esa fase, y el 409 de crear trae
// lo guardado (`GuardadoIA`) para que una pantalla que quedó vieja no se quede sin salida.
//
// ⚠️ CREAR SOBRE LA FILA YA NO MIRA `req.signal` (14/11/2026, la llamada con Julio): es un trabajo del servidor (`after`)
// que termina aunque se cierre la pestaña, y lo corta sólo la marca de «Cancelar» (`modo: 'cancelar'`,
// lib/flujo-ia-trabajo-reglas.ts). Editar sigue mirando `req.signal`.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { canceladaDesde, claveCancelada, MIRAR_CANCELADA_MS, pushDeTrabajo } from '@/lib/flujo-ia-trabajo-reglas';
import { getPromptText } from '@/lib/prompt-render';
import { valorDisparo } from '@/lib/flujo-conversacion';
import { ordenarAvisos } from '@/lib/flujo-ia-cliente';
import { sanearAdjuntos, bloqueDeAdjuntos } from '@/lib/chat-adjuntos-automatizacion';
import { esColumnaInexistente } from '@/lib/nutricion-grafo-motor';
import {
  EDITAR_IA_SYSTEM_TEMPLATE, ordenDeRevelado, conEtiquetasReales, refsSinResolver, disparadorReal,
  userDeEditar, leyendoDe, leyendoTexto, aIA,
  type EventoIA, type ResultadoEdicion, type GuardadoIA,
} from '@/lib/flujo-ia';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { disparadorDeValorIA, valorIADeDisparador, type Disparador } from '@/lib/disparadores';
import { disparadoresDeSecuencia } from '@/lib/disparadores-canales';
import { armarContexto, crearNuevas, generar, crearFlujoConIA } from '@/lib/flujo-ia-crear';
import { esConsulta, deIARespuesta, userDeExplicar, EXPLICAR_IA_SYSTEM_TEMPLATE } from '@/lib/flujo-ia-consulta';
import { intencionDe, extrasDelUser, vaAExplicar, esPreguntaDirecta, lugarInventado } from '@/lib/flujo-ia-intencion';
import { revisarEdicion, etapaQueNoExiste, textoEtapaQueNoExiste } from '@/lib/flujo-ia-revision-editar';
import {
  sanearRespuestas, aplicarRespuestas, turnoDelUsuario, mensajeChat, mensajeDePregunta, respuestaDelCron, textosDeRespuestas,
} from '@/lib/flujo-ia-preguntas';
import { sanearChat, type EventoPreguntaIA, type MensajeChatMako, type PreguntaMako } from '@/lib/automatizacion-chat';
import { leerChat, agregarAlChat } from '@/lib/automatizacion-chat-db';
import { textoDeQuienContesto } from '@/lib/quien-contesto';
import { getUsuarioActual } from '@/lib/auth';
import { lineaDelPedido } from '@/lib/no-existe';
import { ticketDeNoExiste } from '@/lib/no-existe-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/**
 * El tope de la función. Gemini Flash escribe un flujo de 3-5k tokens en 10-40 s; con un respaldo
 * de proveedor, el pedido de «copia como JSON válido» y un reintento con los errores, 300 da aire.
 * El cliente corta a 300 + margen (`AbortSignal.timeout`, app/automations/stream-ia.ts).
 */
export const maxDuration = 300;

/** Lo que tiene la cascada para contestar (deja ~60 s para reparar, guardar y cerrar el stream). */
const PLAZO_MODELO_MS = 220_000;
/** Lo que MaKo lee de un pedido (lo mismo que llega al prompt: lib/flujo-ia.ts, «EL PEDIDO DEL DUEÑO»). */
const TOPE_PEDIDO = 2000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Body = { pedido?: unknown; secuenciaId?: unknown; modo?: unknown; pasos?: unknown; respuestas?: unknown; historial?: unknown; intencion?: unknown; adjuntos?: unknown };

/**
 * EL GUARD DE LAS DOS (POST y GET): el workspace del pedido y que sea su ADMINISTRADOR. El chat de una automatización
 * se lee con ESTE ws (la clave vive por workspace en `app_settings`): nunca con uno que venga del body o de la URL.
 */
async function adminDelWs(): Promise<number | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  return ws != null && rol === 'admin' ? ws : null;
}

// ── GET: el chat con MaKo de una automatización ────────────────────────────────────

export async function GET(req: NextRequest) {
  const ws = await adminDelWs();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el administrador del workspace puede ver este chat.' }, { status: 403 });
  const secuenciaId = Number(req.nextUrl.searchParams.get('secuenciaId'));
  if (!Number.isInteger(secuenciaId) || secuenciaId <= 0) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
  try {
    const chat = await leerChat(ws, secuenciaId);
    return Response.json({ ok: true, mensajes: chat.mensajes });
  } catch (e) {
    console.error(`[api:secuencias/ia GET] ${msg(e)}`);
    return Response.json({ ok: false, error: 'No pude leer el chat.' }, { status: 500 });
  }
}

/**
 * LA SEÑAL DEL TRABAJO DE CREAR (14/11/2026): la corta sólo la marca de «Cancelar» (`modo: 'cancelar'`), nunca la pestaña
 * que se cierra. Se mira cada `MIRAR_CANCELADA_MS`; el core la lee después del modelo, antes de escribir nada.
 */
function senalDeCancelar(ws: number, secuenciaId: number, inicio: number): { signal: AbortSignal; parar: () => void } {
  const ctrl = new AbortController();
  const t = setInterval(() => {
    void runWithWorkspace(ws, () => getSetting(claveCancelada(secuenciaId)))
      .then((v) => { if (canceladaDesde(v, inicio)) ctrl.abort(); })
      .catch(() => { /* sin poder leerla, sigue: cancelar es lo raro */ });
  }, MIRAR_CANCELADA_MS);
  return { signal: ctrl.signal, parar: () => clearInterval(t) };
}

// ── POST: crear o editar ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const ws = await adminDelWs();
  if (ws == null) {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede crear automatizaciones.' }, { status: 403 });
  }
  let body: Body = {};
  try { body = ((await req.json()) ?? {}) as Body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  // «CANCELAR» DE VERDAD (14/11/2026): crear ya no se corta con la pestaña (es un trabajo del servidor), así que la caja
  // lo dice con una marca. El trabajo la mira mientras el modelo escribe y, si la ve, no escribe nada.
  if (body.modo === 'cancelar') {
    const id = Number(body.secuenciaId);
    if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
    try {
      await setSetting(claveCancelada(id), String(Date.now()));
      return Response.json({ ok: true });
    } catch (e) {
      console.error(`[api:secuencias/ia] cancelar #${id}: ${msg(e)}`);
      return Response.json({ ok: false, error: 'No pude cancelar.' }, { status: 500 });
    }
  }

  // ⚠️ UN PEDIDO LARGO NO SE CORTA EN SILENCIO (22/10/2026, la prueba de los chats del Cerebro, 3 de 3): con 8.304 caracteres
  // (los mensajes y el CRON al final) se cortaba a 2.000 y MaKo armaba OTRA cosa, con mensajes, condiciones y un AI Step
  // inventados. Lo que no entra se dice, con cuánto entra.
  const crudo = typeof body.pedido === 'string' ? body.pedido.trim() : '';
  if (crudo.length > TOPE_PEDIDO) {
    return Response.json({ ok: false, error: `Tu mensaje tiene ${crudo.length.toLocaleString('es-MX')} caracteres y MaKo lee hasta ${TOPE_PEDIDO.toLocaleString('es-MX')}. Pega sólo los mensajes y lo que quieres que haga, o mándalo en partes.` }, { status: 400 });
  }
  const pedido = crudo;
  const modo = body.modo === 'editar' ? 'editar' : body.modo === 'crear' ? 'crear' : null;
  // CREAR sin `secuenciaId` (décima tanda): la fila nace al guardar. Editar siempre lo necesita.
  const sinId = modo === 'crear' && (body.secuenciaId == null || body.secuenciaId === '');
  const secuenciaId = sinId ? null : Number(body.secuenciaId);
  // Lo que la persona contestó y el chat de la galería: saneados y con tope (lo malformado se descarta).
  const respuestas = sanearRespuestas(body.respuestas);
  // «Discutir» o «Editar» (22/10/2026, lib/flujo-ia-intencion.ts). Sin elegir (la API, un cliente viejo): lo de antes.
  const intencion = intencionDe(body.intencion);
  const historial = sanearChat({ v: 1, mensajes: Array.isArray(body.historial) ? body.historial : [] }).mensajes;
  // LO ADJUNTADO CON EL «+» (23/10/2026, AU4), ya leído a texto (`/adjunto`): al modelo como un bloque aparte del pedido,
  // así el control de lo pedido sigue mirando sólo lo que escribió (lib/chat-adjuntos-automatizacion.ts).
  const adjuntos = sanearAdjuntos(body.adjuntos);
  const conAdjuntos = (t: string) => (adjuntos.length ? `${t}\n\n${bloqueDeAdjuntos(adjuntos)}` : t);
  if (!pedido) return Response.json({ ok: false, error: 'Escribe qué quieres que haga.' }, { status: 400 });
  if (secuenciaId != null && (!Number.isInteger(secuenciaId) || secuenciaId <= 0)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
  if (!modo) return Response.json({ ok: false, error: 'modo inválido' }, { status: 400 });

  const db = await getTenantDb();
  let sec: Record<string, unknown> | null = null;
  let guardados: PasoGrafo[] = [];
  if (secuenciaId != null) {
    // Con `etapas` (mig 0230, punto 14) y sin ella si todavía no está: es para decir el disparador del
    // 409, y una columna que falta no puede tirar la creación entera (`esColumnaInexistente`).
    const leerSec = async (cols: string) => {
      const r = await db.from('nutricion_secuencias').select(cols).eq('id', secuenciaId).maybeSingle();
      return { data: r.data as unknown as Record<string, unknown> | null, error: r.error };
    };
    let { data, error: errSec } = await leerSec('id, nombre, pasos, activa, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id');
    if (errSec && esColumnaInexistente(errSec)) ({ data, error: errSec } = await leerSec('id, nombre, pasos, activa, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id'));
    if (errSec) return Response.json({ ok: false, error: `No pude leer la automatización: ${errSec.message}` }, { status: 500 });
    if (!data) return Response.json({ ok: false, error: 'Esa automatización no existe en este negocio.' }, { status: 404 });
    sec = data;
    guardados = Array.isArray((sec as { pasos?: unknown }).pasos) ? (sec as { pasos: PasoGrafo[] }).pasos : [];
  }
  /**
   * EL CRON QUE TIENE, como valor de la IA (duodécima tanda): el PRIMERO de la lista (`disparadores`, mig 0241, con
   * `disparadoresDeSecuencia`, la misma lectura de Publicar), con el subtipo de un evento (`instagram:dm`). Las columnas
   * solas daban `trigger:instagram`, sin el evento. Lo usan el 409 de crear y editar (`ctx.disparadorActual`: sin él,
   * «cambia WhatsApp por Instagram» preguntaba «¿Cambio qué la dispara?» aunque ya fuera de Instagram). null = no se
   * pudo leer: el 409 cae a las columnas y editar pregunta igual.
   */
  const cronGuardado = async (): Promise<string | null> => {
    if (secuenciaId == null) return null;
    try {
      const lista = await disparadoresDeSecuencia(secuenciaId);
      return lista[0] ? valorIADeDisparador(lista[0]) : null;
    } catch (e) {
      console.error(`[api:secuencias/ia] el CRON de #${secuenciaId}: ${msg(e)}`);
      return null;
    }
  };
  // CREAR escribe encima: sólo sobre una VACÍA. Pisar un flujo con leads adentro no es crear.
  // ⚠️ Y EL 409 TRAE LO GUARDADO (`GuardadoIA`, revisión 09/10/2026): si la pantalla pide crear sobre
  // una que ya tiene tarjetas es porque su copia quedó vieja (Cancelar en «Revisando» llega tarde y
  // el server guarda igual). Con lo guardado, la caja se lo pasa al lienzo en vez de quedar sin salida.
  if (modo === 'crear' && guardados.length) {
    const s = sec as { nombre?: unknown; trigger_tipo?: unknown; etapa?: unknown; etapas?: unknown; funnel_id?: unknown; producto_id?: unknown; etiqueta_id?: unknown };
    const actual = await cronGuardado();
    const guardado: GuardadoIA = {
      pasos: guardados, nombre: String(s.nombre ?? ''), orden: ordenDeRevelado(guardados),
      disparador: actual ?? valorDisparo({
        trigger_tipo: String(s.trigger_tipo ?? 'manual'), etapa: s.etapa == null ? null : String(s.etapa),
        etapas: Array.isArray(s.etapas) ? s.etapas.map(String) : null,
        funnel_id: s.funnel_id == null ? null : Number(s.funnel_id), producto_id: s.producto_id == null ? null : Number(s.producto_id),
        etiqueta_id: s.etiqueta_id == null ? null : Number(s.etiqueta_id),
      }),
    };
    return Response.json({ ok: false, error: 'Esta automatización ya tiene tarjetas: pídele un cambio.', guardado }, { status: 409 });
  }
  // ⚠️ Y PAUSADA (decisión 14: la caja es para una automatización «vacía y PAUSADA»; revisión,
  // 09/10/2026). Una secuencia lineal de antes, activa, a la que le borraron todas las tarjetas y
  // publicaron, queda con `pasos: []` y ACTIVA: crear le escribía encima un flujo de la IA con
  // acciones que corren sin confirmación.
  if (modo === 'crear' && (sec as { activa?: unknown } | null)?.activa === true) {
    return Response.json({ ok: false, error: 'Pausa esta automatización primero.' }, { status: 409 });
  }
  // EDITAR parte del borrador local de la pantalla (puede tener cambios sin publicar).
  const base: PasoGrafo[] = modo === 'editar' && Array.isArray(body.pasos) ? (body.pasos as PasoGrafo[]) : guardados;
  const nombreSec = String((sec as { nombre?: unknown } | null)?.nombre ?? '');

  /**
   * EL CHAT DE UNA FILA QUE YA EXISTE (§2.5). Nunca tumba el pedido: si no se guarda, queda en el log. Sin
   * `secuenciaId` no hay dónde (crear lo vuelca al nacer la fila).
   */
  const anotar = async (mensajes: Array<MensajeChatMako | null>) => {
    const lista = mensajes.filter((m): m is MensajeChatMako => m != null);
    if (secuenciaId == null || !lista.length) return;
    try { await agregarAlChat(ws, secuenciaId, lista); } catch (e) { console.error(`[api:secuencias/ia] el chat de #${secuenciaId}: ${msg(e)}`); }
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: EventoIA | EventoPreguntaIA) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* cerrado */ } };
      /** MaKo pregunta: el evento, y en el chat si la fila existe. Después, el stream termina. */
      const preguntar = async (pregunta: PreguntaMako) => {
        const mensaje = mensajeDePregunta(pregunta, 'app');
        await anotar([mensaje]);
        send({ t: 'pregunta', pregunta, mensaje });
      };
      /** El error: al stream, y en el chat si la fila existe. */
      const fallar = async (error: string, link?: string) => {
        await anotar([mensajeChat('mako', error, 'app')]);
        send({ t: 'error', error, ...(link ? { link } : {}) });
      };
      try {
        // EL TURNO DE LA PERSONA, AL EMPEZAR (con la fila: editar, o crear sobre una vacía).
        const yo = turnoDelUsuario(pedido, respuestas, historial, 'app');
        // Lo adjuntado queda en el mensaje (sus nombres): al recargar, el hilo lo muestra.
        await anotar([yo && adjuntos.length ? { ...yo, adjuntos: adjuntos.map((a) => a.nombre) } : yo]);

        if (modo === 'crear') {
          // ⚠️ CREAR SOBRE UNA FILA ES UN TRABAJO DEL SERVIDOR (14/11/2026, la llamada con Julio: si se cerraba o se recargaba
          // la pestaña mientras el modelo escribía, `req.signal` cortaba y no quedaba nada). Con `secuenciaId` (la fila nace
          // en el modal) el trabajo corre con `after` y la pestaña que se va NO lo corta: lo corta sólo «Cancelar», que deja
          // una marca (`modo: 'cancelar'`, `senalDeCancelar`). Al terminar, el chat de la fila lo dice (la pantalla que vuelve
          // lo lee) y, si nadie miraba, un push a quien lo pidió. Sin `secuenciaId` (la API de MaKo) sigue atado al pedido.
          const deServidor = secuenciaId != null;
          const corte = deServidor ? senalDeCancelar(ws, secuenciaId, inicio) : null;
          const quienPidio = deServidor ? await getUsuarioActual().catch(() => null) : null;
          /** Nadie estaba mirando cuando terminó: un push a quien lo pidió (lib/flujo-ia-trabajo-reglas.ts). */
          const siSeFue = async (fin: Parameters<typeof pushDeTrabajo>[0]) => {
            if (!deServidor || !req.signal.aborted || !quienPidio?.sub) return;
            try {
              const { enviarPushAMiembros } = await import('@/lib/push');
              await enviarPushAMiembros([Number(quienPidio.sub)], { tipo: 'mako-trabajo', ...pushDeTrabajo(fin), ruta: `/automations?sec=${secuenciaId}`, tag: `automatizacion-ia:${secuenciaId}` });
            } catch (e) { console.error(`[api:secuencias/ia] el push de #${secuenciaId}: ${msg(e)}`); }
          };
          const trabajo = (async () => {
            try {
              // UNA función para las dos puertas (lib/flujo-ia-crear.ts): sus fases son el stream (si alguien mira).
              const r = await crearFlujoConIA({ ws, pedido: conAdjuntos(pedido), secuenciaId, inicio, plazoMs: PLAZO_MODELO_MS, signal: corte?.signal ?? req.signal, alFase: send, respuestas, historial, via: 'app' });
              if (!r.ok && 'pregunta' in r) { await preguntar(r.pregunta); await siSeFue({ t: 'pregunta', nombre: nombreSec, pregunta: r.pregunta.texto }); return; }
              if (!r.ok) {
                if (!r.cancelado) { await fallar(r.error, r.link); await siSeFue({ t: 'error', nombre: nombreSec, error: r.error }); }
                return;
              }
              // Sin id el chat lo volcó `crearConIA` al nacer la fila; con id, lo cierra la ruta.
              // Lo que dice MaKo lo armó el core con lo guardado (20/10/2026: cuándo sale, a quién y qué manda).
              // Y QUÉ IA LO ESCRIBIÓ (27/10/2026, lib/quien-contesto.ts): el chat lo dice («Con tu Claude»).
              const ia = textoDeQuienContesto(r.quien);
              await anotar([mensajeChat('mako', r.texto, 'app', { avisos: r.avisos, ...(ia ? { ia } : {}) })]);
              send({ t: 'listo', modo, secuenciaId: r.secuenciaId, pasos: r.pasos, nombre: r.nombre, orden: r.orden, avisos: r.avisos, etiquetasNuevas: r.etiquetasNuevas, disparador: r.disparador, texto: r.texto, ...(r.cron ? { cron: r.cron } : {}), ...(ia ? { ia } : {}) });
              await siSeFue({ t: 'listo', nombre: r.nombre });
            } catch (err) {
              console.error(`[api:secuencias/ia] ${msg(err)}`);
              await fallar(msg(err));
              await siSeFue({ t: 'error', nombre: nombreSec, error: msg(err) });
            } finally {
              corte?.parar();
            }
          })();
          if (deServidor) after(() => trabajo);
          await trabajo;
          return;
        }

        // EDITAR CON LA RESPUESTA DEL CRON («¿Cambio qué la dispara?»): NO llama al modelo (§3.4).
        const delCron = [...respuestas].reverse().find((x) => x.sobre === 'cron');
        if (delCron) {
          const listo = respuestaDelCron(delCron, historial);
          await anotar([mensajeChat('mako', listo.texto, 'app')]);
          send({
            t: 'listo', modo, secuenciaId: secuenciaId!, pasos: base, nombre: nombreSec, orden: [], avisos: listo.avisos, etiquetasNuevas: [],
            resumen: listo.texto, cambiadas: [], quitadas: [], ...(listo.disparadores ? { disparadores: listo.disparadores } : {}),
          });
          return;
        }

        // ⚠️ CON EL CRON DEL ANUNCIO GUARDADO, EL CONTEXTO LO TRAE (la revisión del Cerebro, 28/10/2026): el anuncio entra al
        // catálogo sólo si el pedido lo nombra (el techo de Groq), y «¿Qué hace esta automatización?» no lo nombra: el rótulo
        // del CRON no se encontraba y MaKo contestaba «no tiene CRON».
        const disparadorActual = await cronGuardado();
        const leido = await armarContexto(ws, pedido, { anuncio: /:anuncio$/.test(disparadorActual ?? ''), mencion: /:mencion$/.test(disparadorActual ?? ''), textos: textosDeRespuestas(respuestas) });
        const { perfil, voz } = leido;
        const leyendo = leyendoDe(leido.ctx, perfil);
        send({ t: 'fase', fase: 'contexto', leyendo, texto: leyendoTexto(leyendo) });
        // Lo que contestó (una condición, «Otra cosa») va al pedido; el canal, a `canalElegido`. El CRON que ya tiene
        // decide el ámbito de las condiciones y si un DM puede salir sin preguntar (`cronActual`, lib/flujo-ia.ts).
        const { ctx, pedido: pedidoEditar } = aplicarRespuestas({ ...leido.ctx, disparadorActual }, pedido, respuestas);

        /** MaKo CONTESTÓ (una pregunta): al chat, y el borrador vuelve tal cual, sin una tarjeta tocada. */
        // `falta` (24/10/2026, f23): lo que pidió y no está en MaKo. Desde el 27/10/2026 (ticket 874749710-14 de Leandro) el
        // pedido sale SOLO a la Ticketera, como en todos los chats de MaKo (lib/no-existe-server.ts), y la línea que lo dice la
        // escribe el código. El botón «Pedírselo al equipo» (./falta/route.ts) queda sólo si no se pudo levantar.
        // `ia`: qué IA lo contestó (lib/quien-contesto.ts); lo que se contesta sin el modelo no lo lleva.
        const contestar = async (respuestaIA: string, faltaPedida?: string, ia?: string | null) => {
          if (req.signal.aborted) return;
          let respuesta = respuestaIA;
          let falta = faltaPedida;
          if (falta) {
            const sesion = await getUsuarioActual().catch(() => null);
            const id = sesion?.email ? await ticketDeNoExiste(falta, {
              ws, actor: sesion.email, nombre: sesion.nombre ?? '', chat: `automations «${nombreSec || `#${secuenciaId}`}»`,
              ruta: `/automations?sec=${secuenciaId}`, pedido,
            }) : null;
            if (id) { respuesta = `${respuesta.trim()}\n\n${lineaDelPedido(id)}`; falta = undefined; }
          }
          await anotar([mensajeChat('mako', respuesta, 'app', { ...(falta ? { falta } : {}), ...(ia ? { ia } : {}) })]);
          send({
            t: 'listo', modo, secuenciaId: secuenciaId!, pasos: base, nombre: nombreSec, orden: [], avisos: [], etiquetasNuevas: [],
            resumen: respuesta, cambiadas: [], quitadas: [], ...(falta ? { falta } : {}), ...(ia ? { ia } : {}),
          });
        };
        // ⚠️ UNA PREGUNTA NO PASA POR EDITAR (15/10/2026, lib/flujo-ia-consulta.ts): «¿Qué hace esta automatización? No
        // cambies nada, sólo explícamelo.» terminaba en «Cambié 1», con el texto del video de #198 reescrito. Va a un prompt
        // que sólo puede devolver {"respuesta"}; con respuestas a una pregunta de MaKo, es un pedido y sigue abajo.
        // ⚠️ Y DESDE EL 22/10/2026 LO ELIGE LA PERSONA (lib/flujo-ia-intencion.ts): «Discutir» va siempre acá, «Editar»
        // nunca; sin elegir, lo de antes. En los tres, lo último de la charla viaja (sin eso «como te dije» no existía).
        // UNA ETAPA QUE NO EXISTE se dice ANTES del modelo (22/10/2026, el arnés contra producción: el modelo no devolvía nada y
        // salía «No cambió nada»). Sin inventarla ni poner otra a escondidas: el CRON no se toca (lib/flujo-ia-revision-editar.ts).
        const sinEtapa = respuestas.length === 0 ? etapaQueNoExiste(pedido, ctx) : null;
        if (sinEtapa) { await contestar(textoEtapaQueNoExiste(sinEtapa)); return; }
        const extras = [...extrasDelUser(intencion, historial), ...(adjuntos.length ? [bloqueDeAdjuntos(adjuntos)] : [])];
        if (vaAExplicar(intencion, respuestas.length > 0, esConsulta(pedido), esPreguntaDirecta(pedido))) {
          const system = await getPromptText('chatbot.explicar-ia.system', EXPLICAR_IA_SYSTEM_TEMPLATE);
          const cron = ctx.disparadores.find((x) => x.value === disparadorActual)?.label ?? null;
          const user = [userDeExplicar({ cron, flujo: JSON.stringify(aIA(base, ctx)), pregunta: pedido }), ...extras].join('\n\n');
          send({ t: 'fase', fase: 'respuesta' });
          // Y un lugar de Configuraciones que no existe es un error, como en Editar (24/10/2026, f22: `lugarInventado`).
          const traducirRespuesta = (obj: Record<string, unknown>) => {
            const x = deIARespuesta(obj);
            const falso = x.r.respuesta ? lugarInventado(x.r.respuesta) : null;
            return falso ? { ...x, errores: [...x.errores, falso] } : x;
          };
          const g = await generar({ system, user, hastaMs: inicio + PLAZO_MODELO_MS, traducir: traducirRespuesta, motivo: 'Contestar una pregunta sobre una automatización' });
          if ('error' in g) {
            await anotar([mensajeChat('mako', g.error, 'app')]);
            send({ t: 'error', error: g.error, ...(g.link ? { link: g.link } : {}) });
            return;
          }
          await contestar(g.r.respuesta, g.r.falta, textoDeQuienContesto(g.quien));
          return;
        }

        // Sin slots: lo variable va en el `user` (un override guardado no conoce bloques nuevos).
        const system = await getPromptText('chatbot.editar-ia.system', EDITAR_IA_SYSTEM_TEMPLATE);
        const user = [userDeEditar(ctx, { perfil, voz, pedido: pedidoEditar }, base), ...extras].join('\n\n');
        // Cada intento del modelo pasa por la misma revisión (lib/flujo-ia-revision-editar.ts, la prueban sus tests con la
        // respuesta grabada): en «Editar» contestar sin cambiar es un error salvo lo que vale (`errorDeRespuestaEnEditar`);
        // pedir SUMAR y cambiar lo que había, también; y «hazlo» con lo pedido ya hecho se contesta en vez de «No cambió nada».
        // Y EL CONTROL DE LO PEDIDO (22/10/2026, Martín: «creó a la mitad las cosas que le pedí»): lo pegado entre comillas que
        // no quedó en el flujo es un error la PRIMERA vez (`control`, uno por turno) y después se dice en ROJO (`noHecho`).
        const control = { yaPidioLoQueFalta: false };
        const traducir = (obj: Record<string, unknown>): { r: ResultadoEdicion; errores: string[] } =>
          revisarEdicion({ obj, base, ctx, pedido, historial, intencion, control });

        send({ t: 'fase', fase: 'modelo' });
        const g = await generar({
          system, user, hastaMs: inicio + PLAZO_MODELO_MS, traducir, motivo: 'Editar una automatización con IA',
          alIntento: (n) => { if (n > 1) send({ t: 'fase', fase: 'modelo', intento: n }); },
        });
        if ('error' in g) {
          await anotar([mensajeChat('mako', g.error, 'app')]);
          send({ t: 'error', error: g.error, ...(g.link ? { link: g.link } : {}) });
          return;
        }
        const r = g.r;
        const ia = textoDeQuienContesto(g.quien);
        // La capa 2 de la consulta: el modelo de editar contestó en vez de cambiar (`deIAEdicion` no aplicó nada).
        if (r.respuesta) { await contestar(r.respuesta, r.falta, ia); return; }
        send({ t: 'fase', fase: 'revision', reparadas: r.avisos.length });

        // Cancelado mientras el modelo escribía: no queda nada escrito.
        if (req.signal.aborted) return;

        const { ids, creadas } = await crearNuevas(r.etiquetasNuevas);
        const pasos = conEtiquetasReales(r.pasos, ids);
        if (refsSinResolver(pasos).length) throw new Error('Quedó una etiqueta sin crear.');
        const avisos = [...r.avisos];
        // EL CRON que pidió el modelo, como lo guarda la pantalla (`disparadorDeValorIA`). No se guarda acá.
        let disparadores: Disparador[] | undefined;
        const valor = r.disparador ? disparadorReal(r.disparador, ids) : null;
        if (valor) {
          const lista = disparadorDeValorIA(valor);
          if (lista.length) disparadores = lista;
          else avisos.push('No pude cambiar qué la dispara: elígelo en el CRON');
        }
        const agregadas = new Set(r.agregadas);
        const ordenados = ordenarAvisos(avisos);
        // Lo pedido que no se hizo va aparte, en rojo (`noHecho`): con algo ahí, nunca «Listo».
        const noHecho = r.noHecho ?? [];
        const resumen = r.resumen || (disparadores ? 'Cambié qué la dispara' : r.pregunta ? '' : noHecho.length ? 'No pude hacer todo lo que pediste' : 'Listo');
        const texto = [resumen, r.pregunta?.texto].filter(Boolean).join('. ');
        await anotar([mensajeChat('mako', texto, 'app', {
          avisos: ordenados, cambios: { cambiadas: r.cambiadas.length, quitadas: r.quitadas.length, agregadas: r.agregadas.length },
          ...(r.pregunta ? { pregunta: r.pregunta } : {}),
          ...(noHecho.length ? { noHecho } : {}),
          ...(ia ? { ia } : {}),
        })]);
        send({
          t: 'listo', modo, secuenciaId: secuenciaId!, pasos, nombre: nombreSec,
          orden: ordenDeRevelado(pasos).filter((id) => agregadas.has(id)), avisos: ordenarAvisos(avisos), etiquetasNuevas: creadas,
          resumen, cambiadas: r.cambiadas, quitadas: r.quitadas,
          ...(r.pregunta ? { pregunta: r.pregunta } : {}),
          ...(disparadores ? { disparadores } : {}),
          ...(noHecho.length ? { noHecho } : {}),
          ...(ia ? { ia } : {}),
        });
      } catch (err) {
        console.error(`[api:secuencias/ia] ${msg(err)}`);
        await fallar(msg(err));
      } finally {
        try { controller.close(); } catch { /* ya cerrado */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
