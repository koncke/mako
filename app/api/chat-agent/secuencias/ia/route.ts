// =============================================================================
// API: crear (o agrandar) una automatización del Chatbot con IA, desde un pedido escrito
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md; el diseño completo, en el
// relevo R5 de esa tanda.
//
// POST { pedido, secuenciaId?, modo: 'crear' | 'editar', pasos?, respuestas?, historial? } → STREAM NDJSON de
// `EventoIA` (lib/flujo-ia.ts) o `EventoPreguntaIA` (lib/automatizacion-chat.ts): fases REALES, que es lo que exige
// `GRAMATICA.analizando`:
//   {t:'fase', fase:'contexto', leyendo, texto}  — lo que se leyó («tu perfil · 4 etapas · 3 audios»)
//   {t:'fase', fase:'modelo'}                     — el modelo está escribiendo
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
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { getPromptText } from '@/lib/prompt-render';
import { valorDisparo } from '@/lib/flujo-conversacion';
import { ordenarAvisos } from '@/lib/flujo-ia-cliente';
import { esColumnaInexistente } from '@/lib/nutricion-grafo-motor';
import {
  EDITAR_IA_SYSTEM_TEMPLATE, deIAEdicion, erroresEdicion, ordenDeRevelado, conEtiquetasReales, refsSinResolver, disparadorReal,
  userDeEditar, leyendoDe, leyendoTexto,
  type EventoIA, type ResultadoEdicion, type GuardadoIA,
} from '@/lib/flujo-ia';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { disparadorDeValorIA, valorIADeDisparador, type Disparador } from '@/lib/disparadores';
import { disparadoresDeSecuencia } from '@/lib/disparadores-canales';
import { armarContexto, crearNuevas, generar, crearFlujoConIA } from '@/lib/flujo-ia-crear';
import {
  sanearRespuestas, aplicarRespuestas, turnoDelUsuario, mensajeChat, mensajeDePregunta, textoDeCreada, respuestaDelCron,
} from '@/lib/flujo-ia-preguntas';
import { sanearChat, type EventoPreguntaIA, type MensajeChatMako, type PreguntaMako } from '@/lib/automatizacion-chat';
import { leerChat, agregarAlChat } from '@/lib/automatizacion-chat-db';

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

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Body = { pedido?: unknown; secuenciaId?: unknown; modo?: unknown; pasos?: unknown; respuestas?: unknown; historial?: unknown };

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

// ── POST: crear o editar ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const ws = await adminDelWs();
  if (ws == null) {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede crear automatizaciones.' }, { status: 403 });
  }
  let body: Body = {};
  try { body = ((await req.json()) ?? {}) as Body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 2000) : '';
  const modo = body.modo === 'editar' ? 'editar' : body.modo === 'crear' ? 'crear' : null;
  // CREAR sin `secuenciaId` (décima tanda): la fila nace al guardar. Editar siempre lo necesita.
  const sinId = modo === 'crear' && (body.secuenciaId == null || body.secuenciaId === '');
  const secuenciaId = sinId ? null : Number(body.secuenciaId);
  // Lo que la persona contestó y el chat de la galería: saneados y con tope (lo malformado se descarta).
  const respuestas = sanearRespuestas(body.respuestas);
  const historial = sanearChat({ v: 1, mensajes: Array.isArray(body.historial) ? body.historial : [] }).mensajes;
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
        await anotar([turnoDelUsuario(pedido, respuestas, historial, 'app')]);

        if (modo === 'crear') {
          // UNA función para las dos puertas (lib/flujo-ia-crear.ts): sus fases son el stream. Cancelado mientras el
          // modelo escribía (`req.signal`): no escribió nada y no hay a quién contestarle.
          const r = await crearFlujoConIA({ ws, pedido, secuenciaId, inicio, plazoMs: PLAZO_MODELO_MS, signal: req.signal, alFase: send, respuestas, historial, via: 'app' });
          if (!r.ok && 'pregunta' in r) { await preguntar(r.pregunta); return; }
          if (!r.ok) {
            if (!r.cancelado) await fallar(r.error, r.link);
            return;
          }
          // Sin id el chat lo volcó `crearConIA` al nacer la fila; con id, lo cierra la ruta.
          await anotar([mensajeChat('mako', textoDeCreada(r.nombre), 'app', { avisos: r.avisos })]);
          send({ t: 'listo', modo, secuenciaId: r.secuenciaId, pasos: r.pasos, nombre: r.nombre, orden: r.orden, avisos: r.avisos, etiquetasNuevas: r.etiquetasNuevas, disparador: r.disparador });
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

        const [leido, disparadorActual] = await Promise.all([armarContexto(ws, pedido), cronGuardado()]);
        const { perfil, voz } = leido;
        const leyendo = leyendoDe(leido.ctx, perfil);
        send({ t: 'fase', fase: 'contexto', leyendo, texto: leyendoTexto(leyendo) });
        // Lo que contestó (una condición, «Otra cosa») va al pedido; el canal, a `canalElegido`. El CRON que ya tiene
        // decide el ámbito de las condiciones y si un DM puede salir sin preguntar (`cronActual`, lib/flujo-ia.ts).
        const { ctx, pedido: pedidoEditar } = aplicarRespuestas({ ...leido.ctx, disparadorActual }, pedido, respuestas);

        // Sin slots: lo variable va en el `user` (un override guardado no conoce bloques nuevos).
        const system = await getPromptText('chatbot.editar-ia.system', EDITAR_IA_SYSTEM_TEMPLATE);
        const user = userDeEditar(ctx, { perfil, voz, pedido: pedidoEditar }, base);
        const traducir = (obj: Record<string, unknown>): { r: ResultadoEdicion; errores: string[] } => {
          const r = deIAEdicion(obj, base, ctx);
          return { r, errores: erroresEdicion(base, r, ctx) };
        };

        send({ t: 'fase', fase: 'modelo' });
        const g = await generar({ system, user, hastaMs: inicio + PLAZO_MODELO_MS, traducir, motivo: 'Editar una automatización con IA' });
        if ('error' in g) {
          await anotar([mensajeChat('mako', g.error, 'app')]);
          send({ t: 'error', error: g.error, ...(g.link ? { link: g.link } : {}) });
          return;
        }
        const r = g.r;
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
        const resumen = r.resumen || (disparadores ? 'Cambié qué la dispara' : r.pregunta ? '' : 'Listo');
        const texto = [resumen, r.pregunta?.texto].filter(Boolean).join('. ');
        await anotar([mensajeChat('mako', texto, 'app', {
          avisos: ordenados, cambios: { cambiadas: r.cambiadas.length, quitadas: r.quitadas.length, agregadas: r.agregadas.length },
          ...(r.pregunta ? { pregunta: r.pregunta } : {}),
        })]);
        send({
          t: 'listo', modo, secuenciaId: secuenciaId!, pasos, nombre: nombreSec,
          orden: ordenDeRevelado(pasos).filter((id) => agregadas.has(id)), avisos: ordenarAvisos(avisos), etiquetasNuevas: creadas,
          resumen, cambiadas: r.cambiadas, quitadas: r.quitadas,
          ...(r.pregunta ? { pregunta: r.pregunta } : {}),
          ...(disparadores ? { disparadores } : {}),
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
