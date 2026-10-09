// =============================================================================
// API: crear (o agrandar) una automatización del Chatbot con IA, desde un pedido escrito
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md; el diseño completo, en el
// relevo R5 de esa tanda.
//
// POST { pedido, secuenciaId, modo: 'crear' | 'editar', pasos? } → STREAM NDJSON de `EventoIA`
// (lib/flujo-ia.ts): fases REALES, que es lo que exige `GRAMATICA.analizando`:
//   {t:'fase', fase:'contexto', leyendo, texto}  — lo que se leyó («tu perfil · 4 etapas · 3 audios»)
//   {t:'fase', fase:'modelo'}                     — el modelo está escribiendo
//   {t:'fase', fase:'revision', reparadas}        — cuántas cosas reparó el código
//   {t:'listo', …} | {t:'error', error}
// Los errores de ANTES del stream (403, 400, 409) salen como JSON plano.
//
//   · CREAR exige que la automatización esté VACÍA (la de «＋ Nueva», `crear_vacia`) y la deja
//     GUARDADA y PAUSADA: `setSecuenciaPasos` + el disparador + el nombre. Guardar en vez de dejar
//     un borrador local es a propósito: lo no publicado se pierde al cambiar de automatización.
//   · EDITAR sólo AGREGA (v1) y NO guarda: devuelve los pasos para el borrador local del lienzo
//     (UNA foto de deshacer y Publicar, como cualquier cambio). `pasos` es ese borrador, que puede
//     tener cambios sin publicar; sin él, se parte de lo guardado.
//
// ⚠️ NUNCA POR CLAUDE. La llamada es `chatCheapCascade` sobre CASCADA_DOCS (Gemini primero), con
// el pin de /modelos-ia salvo que apunte a Anthropic: es el molde de `escribir()` en
// app/api/chat-agent/onboarding/guion-audio/route.ts. `chatClaude` sin `fallback: []` caería a
// Sonnet PAGO, y la feature no tiene fila en CLAUDE_PERMITIDO.
//
// ⚠️ LAS ETIQUETAS NUEVAS SE CREAN RECIÉN CUANDO TODO VALIDÓ, y antes se mira que la persona no
// haya cancelado (`req.signal`): un pedido cancelado MIENTRAS EL MODELO ESCRIBE no deja nada
// escrito. Después de la fase 'revision' la señal ya no se mira y el server termina de guardar
// (revisión, 09/10/2026): por eso la caja no dibuja «Cancelar» en esa fase, y el 409 de crear trae
// lo guardado (`GuardadoIA`) para que una pantalla que quedó vieja no se quede sin salida.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { chatCheapCascade, CASCADA_DOCS, MODELO_DOCS, errorDeCascada, type ProvName } from '@/lib/ai-cheap';
import { overrideDeFeature } from '@/lib/model-registry';
import { getPromptText } from '@/lib/prompt-render';
import { parseJsonObject } from '@/lib/json-del-modelo';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getVozGuia } from '@/lib/nutricion-generator';
import { setSecuenciaPasos, setSecuenciaActiva, PasosInvalidosError, type PasoSecuencia } from '@/lib/nutricion';
import {
  productosConEtapas, renombrarSecuencia, nombreDeSecuencia, setTriggerSecuencia, TriggerInvalidoError,
} from '@/lib/setting-secuencias';
import { listarEtiquetas, crearEtiqueta } from '@/lib/etiquetas';
import { listAudios } from '@/lib/setting-audios';
import { listarAdjuntos } from '@/lib/setting-adjuntos';
import { accionesParaFlujo } from '@/lib/api-mako/flujo';
import { getEntregables } from '@/lib/entregable';
import { getSetting } from '@/lib/settings';
import { KEY_LINK_VIDEO } from '@/lib/audios-paso';
import { eventTypeDeReunion } from '@/lib/calendly-agenda';
import { TRIGGERS } from '@/lib/email-marketing';
import { seccionesDisparo, pedidoDisparo, valorDisparo } from '@/lib/flujo-conversacion';
import { ordenarAvisos } from '@/lib/flujo-ia-cliente';
import { validarGrafo, type PasoGrafo } from '@/lib/flujo-grafo';
import { marcasDeVoseo } from '@/lib/puestas-data';
import {
  FEATURE_CREAR_IA, LISTA_BLANCA_IA, CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE,
  deIA, deIAEdicion, disparadoresParaIA, numerosEn, validarIA, erroresNuevos, ordenDeRevelado, conEtiquetasReales, disparadorReal, refsSinResolver,
  userDeCrear, userDeEditar, leyendoDe, leyendoTexto, normNombre,
  type CtxIA, type EventoIA, type ResultadoIA, type ResultadoEdicion, type LinkIA, type GuardadoIA,
} from '@/lib/flujo-ia';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/**
 * El tope de la función. Gemini Flash escribe un flujo de 3-5k tokens en 10-40 s; con un respaldo
 * de proveedor, el pedido de «copia como JSON válido» y un reintento con los errores, 300 da aire.
 * El cliente corta a 300 + margen (`AbortSignal.timeout`, app/chatbot/CrearConIA.tsx).
 */
export const maxDuration = 300;

/** Lo que tiene la cascada para contestar (deja ~60 s para reparar, guardar y cerrar el stream). */
const PLAZO_MODELO_MS = 220_000;
/** Lo mínimo que tiene que quedar para intentar un escalón más (reparar o corregir). */
const MIN_PARA_OTRO_MS = 45_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Body = { pedido?: unknown; secuenciaId?: unknown; modo?: unknown; pasos?: unknown };
type Traducido = { r: ResultadoIA | ResultadoEdicion; errores: string[] };

// ── El contexto: lo que el negocio tiene configurado ─────────────────────────────

/**
 * El link de AGENDA: el del event type de la R1 de Calendly (`CALENDLY_EVENT_TYPE_J1`), que es lo
 * que el negocio configuró para que lo agenden. Medido el 08/10/2026: no hay otro link de agenda
 * guardado en ningún workspace. Sin Calendly, o si tarda más de 5 s, no hay link de agenda y la IA
 * no lo promete (`LINKS` va sin esa clave).
 */
async function linkDeAgenda(): Promise<string | null> {
  try {
    const et = await Promise.race([
      eventTypeDeReunion('R1'),
      new Promise<null>((r) => setTimeout(() => r(null), 5_000)),
    ]);
    const u = (et?.schedulingUrl ?? '').trim();
    return /^https?:\/\//i.test(u) ? u : null;
  } catch {
    return null;
  }
}

/** Las otras automatizaciones del negocio (para un «Ir a»), sin las archivadas. */
async function automatizaciones(): Promise<Array<{ id: number; nombre: string }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre').is('archivada_at', null);
  if (error) throw new Error(`automatizaciones: ${error.message}`);
  return ((data ?? []) as Array<{ id: number; nombre: string }>).map((s) => ({ id: Number(s.id), nombre: String(s.nombre ?? '') }));
}

/**
 * Arma `CtxIA`. ⚠️ LAS ETIQUETAS SE LEEN ESTRICTAS (AGENTS.md: una lectura que cae al default sirve
 * para dibujar, nunca para decidir): con la lectura caída, `deIA` las tomaría a todas por NUEVAS y
 * crearía duplicados. Lo demás puede faltar: lo que no está se saca del flujo y queda en `avisos`.
 */
async function armarContexto(ws: number, secuenciaId: number, pedido: string): Promise<{ ctx: CtxIA; perfil: string; voz: string | null }> {
  const [etiquetas, productos, audios, archivos, accionesWs, entregables, video, agenda, autos, perfil, voz] = await Promise.all([
    listarEtiquetas({ incluirArchivadas: true }),
    productosConEtapas().catch(() => []),
    listAudios().catch(() => []),
    listarAdjuntos().catch(() => []),
    accionesParaFlujo(ws).catch(() => []),
    getEntregables().catch(() => []),
    getSetting(KEY_LINK_VIDEO).catch(() => null),
    linkDeAgenda(),
    automatizaciones().catch(() => []),
    perfilNegocioTexto().catch(() => ''),
    getVozGuia().catch(() => null),
  ]);

  // LOS LINKS: clave → URL. La URL NO viaja al modelo (`userDeCrear` manda la clave y el «para»).
  const links: Record<string, LinkIA> = {};
  if (agenda) links.agenda = { url: agenda, para: 'el link para que agende la llamada' };
  const v = (video ?? '').trim();
  if (/^https?:\/\//i.test(v)) links.video = { url: v, para: 'el video que conviene ver antes de hablar' };
  entregables.filter((e) => /^https?:\/\//i.test((e.enlace ?? '').trim())).forEach((e, k) => {
    links[`material:${k + 1}`] = { url: e.enlace!.trim(), para: `${e.nombre}${e.tipo ? ` (${e.tipo})` : ''}` };
  });

  const prods = productos.map((p) => ({
    funnelId: p.funnelId, productoId: p.productoId, nombre: p.nombre, esDefault: p.esDefault,
    etapas: p.etapas, etapasEntrega: p.etapasEntrega,
  }));
  // EL DISPARADOR: el mismo catálogo cerrado que el desplegable del CRON, aplanado CON EL PRODUCTO
  // en el rótulo (`disparadoresParaIA`: con dos productos con la misma etapa, el rótulo pelado
  // elegía el embudo equivocado). `manual` no inscribe a nadie: se saca (la secuencia vacía nace
  // con él y la sección «La que tiene puesta» lo trae).
  const disparadores = disparadoresParaIA(seccionesDisparo({
    disparadores: TRIGGERS, productos: prods, etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, archivada_at: e.archivada_at })),
    actual: { trigger_tipo: 'manual' }, textoActual: 'manual',
  })).filter((o) => o.value !== 'trigger:manual');

  // LA LISTA BLANCA, cruzada con lo que la capa del workspace ve, y otra vez contra gratis y
  // reversible por si el registro cambia (el test lo cruza también).
  const acciones = accionesWs
    .filter((a) => LISTA_BLANCA_IA.includes(a.id) && a.costo === 'gratis' && a.reversible)
    .map((a) => ({ id: a.id, titulo: a.titulo, parametros: a.parametros }));

  const ctx: CtxIA = {
    etiquetas: etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, archivada: !!e.archivada_at })),
    productos: prods,
    disparadores,
    audios: audios.map((a) => ({ id: a.id, titulo: a.titulo, transcript: a.transcript })),
    archivos: archivos.map((a) => ({ id: a.id, titulo: a.titulo, mime: a.media_mime })),
    acciones,
    links,
    automatizaciones: autos,
    secuenciaId,
    usaVoseo: !!voz && marcasDeVoseo(voz).length > 0,
    // Un MONTO de una acción sólo vale si lo escribió una persona: en el perfil o en el pedido.
    numerosPermitidos: numerosEn(`${perfil}\n${pedido}`),
  };
  return { ctx, perfil, voz };
}

// ── Las etiquetas nuevas, recién al final ─────────────────────────────────────────

/**
 * Crea las etiquetas nuevas y devuelve ref → id real. Si una ya existe con ese nombre (otra
 * pestaña la creó en el medio), se usa ésa: lo que se buscaba era la etiqueta, no crear una.
 */
async function crearNuevas(nuevas: ResultadoIA['etiquetasNuevas']): Promise<{ ids: Map<number, number>; creadas: Array<{ id: number; nombre: string }> }> {
  const ids = new Map<number, number>();
  const creadas: Array<{ id: number; nombre: string }> = [];
  for (const n of nuevas) {
    try {
      const { etiqueta } = await crearEtiqueta({ nombre: n.nombre });
      ids.set(n.ref, etiqueta.id);
      creadas.push({ id: etiqueta.id, nombre: etiqueta.nombre });
    } catch (e) {
      const ya = (await listarEtiquetas({ incluirArchivadas: false })).find((x) => normNombre(x.nombre) === normNombre(n.nombre));
      if (!ya) throw new Error(`No pude crear la etiqueta «${n.nombre}»: ${msg(e)}`);
      ids.set(n.ref, ya.id);
    }
  }
  return { ids, creadas };
}

// ── La llamada al modelo, con sus tres escalones ──────────────────────────────────

/**
 * UNA pasada por la cascada GRATIS. `traducir` es la segunda capa (parsea + `deIA` + `validarIA` +
 * `validarGrafo`) y va como `validar`: una salida inservible prueba el proveedor siguiente en vez
 * de llegar a la pantalla. Devuelve el resultado bueno, o lo que hace falta para el escalón
 * siguiente: los textos que no parsearon y los errores de la última salida que sí.
 */
async function pasada(p: {
  system: string; user: string; motivo: string; hastaMs: number;
  traducir: (obj: Record<string, unknown>) => Traducido;
  provs: ProvName[]; modelos: Partial<Record<ProvName, string>>; errores: string[];
}): Promise<{ bueno: ResultadoIA | ResultadoEdicion | null; crudos: string[]; ultimo: string[] | null }> {
  const out: { bueno: ResultadoIA | ResultadoEdicion | null; crudos: string[]; ultimo: string[] | null } = { bueno: null, crudos: [], ultimo: null };
  await chatCheapCascade({
    system: p.system, user: p.user, json: true, maxTokens: 6000, temperature: 0.4,
    feature: FEATURE_CREAR_IA, motivo: p.motivo,
    provs: p.provs, modelos: p.modelos, timeoutMs: 100_000, hastaMs: p.hastaMs,
    erroresOut: p.errores,
    validar: (t) => {
      let obj: Record<string, unknown>;
      try { obj = parseJsonObject(t); } catch { out.crudos.push(t); return false; }
      const tr = p.traducir(obj);
      if (tr.errores.length) { out.ultimo = tr.errores; return false; }
      out.bueno = tr.r;
      return true;
    },
  }).catch((e) => { p.errores.push(msg(e)); return ''; });
  return out;
}

/**
 * Los TRES escalones (molde: `objetoDelPlan` de lib/video-planner.ts, más el reintento con los
 * errores del relevo R5):
 *   1. la cascada, con `parseJsonObject` (repara sin red) adentro del `validar`;
 *   2. si algún proveedor escribió un JSON que no se pudo leer, la cascada lo COPIA como JSON
 *      válido (no se le pide que piense) y se vuelve a traducir;
 *   3. si lo que se leyó tenía errores de validación, UN reintento listándolos («corrige esto»).
 * Si nada sirve, el error honesto: `errorDeCascada` cuando nadie contestó, o qué quedó mal.
 */
async function generar(p: {
  system: string; user: string; inicio: number;
  traducir: (obj: Record<string, unknown>) => Traducido;
}): Promise<{ r: ResultadoIA | ResultadoEdicion } | { error: string }> {
  const pin = await overrideDeFeature(FEATURE_CREAR_IA).catch(() => null);
  const usaPin = pin != null && pin.provider !== 'anthropic';
  const provs: ProvName[] = usaPin ? [pin.provider as ProvName] : CASCADA_DOCS;
  const modelos: Partial<Record<ProvName, string>> = usaPin ? ({ [pin.provider]: pin.model } as Partial<Record<ProvName, string>>) : MODELO_DOCS;
  const hastaMs = p.inicio + PLAZO_MODELO_MS;
  const quedan = () => hastaMs - Date.now();
  const errores: string[] = [];

  const uno = await pasada({ ...p, motivo: 'Crear una automatización con IA', hastaMs, provs, modelos, errores });
  if (uno.bueno) return { r: uno.bueno };
  let ultimo = uno.ultimo;

  // 2. Un JSON que no se pudo leer: que la cascada lo copie bien.
  if (uno.crudos.length && quedan() > MIN_PARA_OTRO_MS) {
    const crudo = uno.crudos[uno.crudos.length - 1];
    console.error('[secuencias/ia] JSON inválido del modelo (2000):', crudo.slice(0, 2000));
    const copia = await chatCheapCascade({
      system: 'Recibes un texto que pretende ser un JSON pero tiene errores de sintaxis. Devuelve EXACTAMENTE el mismo contenido como JSON válido: mismas claves, mismos valores, mismo orden. No agregues, no quites, no comentes. Solo el JSON.',
      user: crudo.slice(0, 60_000), json: true, maxTokens: 8000, temperature: 0,
      feature: FEATURE_CREAR_IA, motivo: 'reparar el JSON de la automatización', provs, modelos, hastaMs, erroresOut: errores,
      validar: (t) => { try { parseJsonObject(t); return true; } catch { return false; } },
    }).catch((e) => { errores.push(msg(e)); return ''; });
    if (copia) {
      try {
        const tr = p.traducir(parseJsonObject(copia));
        if (!tr.errores.length) return { r: tr.r };
        ultimo = tr.errores;
      } catch { /* sigue al reintento o al error */ }
    }
  }

  // 3. Lo que se leyó tenía errores: un reintento diciéndole cuáles.
  if (ultimo && quedan() > MIN_PARA_OTRO_MS) {
    const corregir = `${p.user}\n\nTU RESPUESTA ANTERIOR TENÍA ESTOS PROBLEMAS. Corrígelos y devuelve el JSON COMPLETO:\n${ultimo.slice(0, 12).map((e) => `- ${e}`).join('\n')}`;
    const dos = await pasada({ ...p, user: corregir, motivo: 'Corregir la automatización con IA', hastaMs, provs, modelos, errores });
    if (dos.bueno) return { r: dos.bueno };
    if (dos.ultimo) ultimo = dos.ultimo;
  }

  if (ultimo) {
    // ⚠️ EL DETALLE VA AL LOG, NO A LA PANTALLA (revisión, 09/10/2026): los errores de
    // `validarGrafo` traen ids internos («tarjetas sueltas: m2»), que no le dicen nada a nadie.
    console.error('[secuencias/ia] la salida no pasó la revisión:', ultimo.join(' | '));
    return { error: 'MaKo armó el flujo pero quedó mal. Prueba de nuevo o cambia una palabra del pedido.' };
  }
  if (uno.crudos.length) return { error: 'MaKo escribió el flujo pero se cortó al leerlo. Prueba de nuevo.' };
  return { error: await errorDeCascada(errores, 'armar la automatización') };
}

// ── La ruta ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede crear automatizaciones.' }, { status: 403 });
  }
  let body: Body = {};
  try { body = ((await req.json()) ?? {}) as Body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 2000) : '';
  const secuenciaId = Number(body.secuenciaId);
  const modo = body.modo === 'editar' ? 'editar' : body.modo === 'crear' ? 'crear' : null;
  if (!pedido) return Response.json({ ok: false, error: 'Escribe qué quieres que haga.' }, { status: 400 });
  if (!Number.isInteger(secuenciaId) || secuenciaId <= 0) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
  if (!modo) return Response.json({ ok: false, error: 'modo inválido' }, { status: 400 });

  const db = await getTenantDb();
  const { data: sec, error: errSec } = await db.from('nutricion_secuencias')
    .select('id, nombre, pasos, activa, trigger_tipo, etapa, funnel_id, producto_id, etiqueta_id').eq('id', secuenciaId).maybeSingle();
  if (errSec) return Response.json({ ok: false, error: `No pude leer la automatización: ${errSec.message}` }, { status: 500 });
  if (!sec) return Response.json({ ok: false, error: 'Esa automatización no existe en este negocio.' }, { status: 404 });
  const guardados = (Array.isArray((sec as { pasos?: unknown }).pasos) ? (sec as { pasos: PasoGrafo[] }).pasos : []);
  // CREAR escribe encima: sólo sobre una VACÍA. Pisar un flujo con leads adentro no es crear.
  // ⚠️ Y EL 409 TRAE LO GUARDADO (`GuardadoIA`, revisión 09/10/2026): si la pantalla pide crear sobre
  // una que ya tiene tarjetas es porque su copia quedó vieja (Cancelar en «Revisando» llega tarde y
  // el server guarda igual). Con lo guardado, la caja se lo pasa al lienzo en vez de quedar sin salida.
  if (modo === 'crear' && guardados.length) {
    const s = sec as { nombre?: unknown; trigger_tipo?: unknown; etapa?: unknown; funnel_id?: unknown; producto_id?: unknown; etiqueta_id?: unknown };
    const guardado: GuardadoIA = {
      pasos: guardados, nombre: String(s.nombre ?? ''), orden: ordenDeRevelado(guardados),
      disparador: valorDisparo({
        trigger_tipo: String(s.trigger_tipo ?? 'manual'), etapa: s.etapa == null ? null : String(s.etapa),
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
  if (modo === 'crear' && (sec as { activa?: unknown }).activa === true) {
    return Response.json({ ok: false, error: 'Pausa esta automatización primero.' }, { status: 409 });
  }
  // EDITAR parte del borrador local de la pantalla (puede tener cambios sin publicar).
  const base: PasoGrafo[] = modo === 'editar' && Array.isArray(body.pasos) ? (body.pasos as PasoGrafo[]) : guardados;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: EventoIA) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* cerrado */ } };
      try {
        const { ctx, perfil, voz } = await armarContexto(ws, secuenciaId, pedido);
        const leyendo = leyendoDe(ctx, perfil);
        send({ t: 'fase', fase: 'contexto', leyendo, texto: leyendoTexto(leyendo) });

        // Sin slots: lo variable va en el `user` (un override guardado no conoce bloques nuevos).
        const system = modo === 'crear'
          ? await getPromptText('chatbot.crear-ia.system', CREAR_IA_SYSTEM_TEMPLATE)
          : await getPromptText('chatbot.editar-ia.system', EDITAR_IA_SYSTEM_TEMPLATE);
        const datos = { perfil, voz, pedido };
        const user = modo === 'crear' ? userDeCrear(ctx, datos) : userDeEditar(ctx, datos, base);
        const traducir = (obj: Record<string, unknown>): Traducido => {
          if (modo === 'crear') {
            const r = deIA(obj, ctx);
            const errores = [...validarIA(r.pasos, ctx), ...validarGrafo(r.pasos)];
            if (!r.pasos.some((x) => !x.nodo)) errores.unshift('el flujo quedó sin ningún mensaje ni acción');
            return { r, errores };
          }
          const r = deIAEdicion(obj, base, ctx);
          const errores = [...validarIA(r.pasos, ctx, new Set(r.agregadas)), ...erroresNuevos(base, r.pasos)];
          if (!r.agregadas.length) errores.unshift('no agregó ninguna tarjeta');
          return { r, errores };
        };

        send({ t: 'fase', fase: 'modelo' });
        const g = await generar({ system, user, inicio, traducir });
        if ('error' in g) { send({ t: 'error', error: g.error }); return; }
        const r = g.r;
        send({ t: 'fase', fase: 'revision', reparadas: r.avisos.length });

        // Cancelado mientras el modelo escribía: no queda nada escrito.
        if (req.signal.aborted) return;

        const { ids, creadas } = await crearNuevas(r.etiquetasNuevas);
        const pasos = conEtiquetasReales(r.pasos, ids);
        if (refsSinResolver(pasos).length) throw new Error('Quedó una etiqueta sin crear.');
        const avisos = [...r.avisos];

        if (modo === 'editar') {
          const agregadas = new Set((r as ResultadoEdicion).agregadas);
          send({
            t: 'listo', modo, secuenciaId, pasos, nombre: String((sec as { nombre?: unknown }).nombre ?? ''),
            orden: ordenDeRevelado(pasos).filter((id) => agregadas.has(id)), avisos: ordenarAvisos(avisos), etiquetasNuevas: creadas,
          });
          return;
        }

        // CREAR: guardar PAUSADA. Se vuelve a mirar que siga vacía (otra pestaña pudo escribir).
        const { data: otra } = await db.from('nutricion_secuencias').select('pasos').eq('id', secuenciaId).maybeSingle();
        if (Array.isArray((otra as { pasos?: unknown } | null)?.pasos) && (otra as { pasos: unknown[] }).pasos.length) {
          send({ t: 'error', error: 'Alguien le puso tarjetas mientras tanto: no la pisé.' });
          return;
        }
        // ⚠️ PRIMERO PAUSAR, DESPUÉS ESCRIBIR (revisión, 09/10/2026). Al revés, si pausar fallaba
        // después de guardar, el flujo de la IA quedaba guardado y ACTIVO. Así, si lo que sigue
        // falla, queda pausada y vacía, que no hace daño.
        await setSecuenciaActiva(secuenciaId, false);
        try {
          await setSecuenciaPasos(secuenciaId, pasos as unknown as PasoSecuencia[]);
        } catch (e) {
          if (e instanceof PasosInvalidosError) { send({ t: 'error', error: `No pude guardar el flujo: ${e.message}` }); return; }
          throw e;
        }

        const valor = disparadorReal((r as ResultadoIA).disparador, ids);
        const pedidoTrigger = valor ? pedidoDisparo(valor, secuenciaId) : null;
        // El que quedó PUESTO viaja en `listo` para que la tarjeta CRON lo dibuje sin recargar.
        let puesto: string | null = null;
        if (pedidoTrigger) {
          try {
            await setTriggerSecuencia(secuenciaId, {
              trigger_tipo: String(pedidoTrigger.trigger_tipo ?? ''),
              etapa: pedidoTrigger.etapa == null ? null : String(pedidoTrigger.etapa),
              producto_id: pedidoTrigger.producto_id == null ? null : Number(pedidoTrigger.producto_id),
              etiqueta_id: pedidoTrigger.etiqueta_id == null ? null : Number(pedidoTrigger.etiqueta_id),
              // Ausente = no toca el embudo (`setTriggerSecuencia`); sólo una etapa de venta lo trae.
              ...('funnel_id' in pedidoTrigger ? { funnel_id: pedidoTrigger.funnel_id == null ? null : Number(pedidoTrigger.funnel_id) } : {}),
            });
            puesto = valor;
          } catch (e) {
            if (!(e instanceof TriggerInvalidoError)) throw e;
            avisos.push(`No pude poner qué la dispara (${e.message}): elígelo en el CRON`);
          }
        } else {
          avisos.push('Elige qué la dispara en el CRON');
        }

        let nombre = String((sec as { nombre?: unknown }).nombre ?? '');
        const propuesto = nombreDeSecuencia((r as ResultadoIA).nombre ?? '');
        if (propuesto) { await renombrarSecuencia(secuenciaId, propuesto); nombre = propuesto; }

        // Lo que quedó GUARDADO, no lo que se mandó: `setSecuenciaPasos` normaliza (ids, campos del
        // flujo), y el lienzo tiene que dibujar lo mismo que va a leer el motor.
        const { data: final } = await db.from('nutricion_secuencias').select('pasos').eq('id', secuenciaId).maybeSingle();
        const guardado = Array.isArray((final as { pasos?: unknown } | null)?.pasos) ? (final as { pasos: PasoGrafo[] }).pasos : pasos;
        // Los avisos van ORDENADOS por lo que cambian en lo que sale (`ordenarAvisos`): la pantalla
        // muestra el primero, y «Elige qué la dispara» se agrega recién acá, al final.
        send({ t: 'listo', modo, secuenciaId, pasos: guardado, nombre, orden: ordenDeRevelado(guardado), avisos: ordenarAvisos(avisos), etiquetasNuevas: creadas, disparador: puesto });
      } catch (err) {
        console.error(`[api:secuencias/ia] ${msg(err)}`);
        send({ t: 'error', error: msg(err) });
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
