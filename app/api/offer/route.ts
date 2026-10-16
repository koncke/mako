// =============================================================================
// POST /api/offer — la tab Offer: conversar, leer documentos, diagnosticar y armar la oferta
// =============================================================================
// Pedido de Martín (11/10/2026): Offer Analyst + Offer Generator en una sola tab, «muy de IA… algo
// simple como un chat… y que el resultado final sea que te dé un PDF con la conclusión». v2 (el mismo día):
// las ofertas atadas a los FUNNELS del CRM, el chat que pide primero un documento o el link de la web, el
// audio, y el diagnóstico de fase preguntado adentro del chat (lib/offer-reglas.ts).
//
// Body: { action, ... } → siempre { ok: true, ... } | { ok: false, error } (el error dice de quién es la
// culpa y qué hacer). Las acciones:
//   · 'arbol'                                    → { arbol }   (funnel → ofertas → conversaciones)
//   · 'abrir'          { id }                    → { sesion }
//   · 'nueva'          { funnelId, ofertaBaseId|null } → { sesion }  (atada al funnel; con oferta base es
//                                                   modo 'analizar'. Si ya hay una vacía igual, devuelve ésa)
//   · 'subir-url'      { nombre, mime, tamano }  → { path, signedUrl }  (el navegador hace PUT del binario
//                                                   a signedUrl con 'x-upsert: true'; molde:
//                                                   app/api/onboarding/archivero/upload-url/route.ts). Sirve
//                                                   también para el AUDIO del turno.
//   · 'leer'           { sesionId|null, path, nombre, mime, funnelId? } → { sesion, doc }  (crea la sesión si
//                                                   hace falta; baja el archivo y lo pasa a texto. El binario de
//                                                   un ARCHIVO va después, por detrás, a El Archivero; el resto
//                                                   se BORRA)
//   · 'descartar-subida' { path } → { borrado }  (un binario que al final no se usa)
//   · 'leer-link'      { sesionId|null, url, funnelId? } → { sesion, doc }  (baja la web con la descarga
//                                                   SSRF-segura de lib/landing-fetch.ts y la guarda como documento)
//   · 'turno'          { sesionId|null, texto, docIds, audio?, respuesta?, funnelId?, reintentar? } → { sesion }
//                                                   texto puede venir vacío con audio, documentos o respuesta.
//                                                   audio = { path, mime, secs } subido con 'subir-url'; se
//                                                   transcribe y el binario NO se borra (se reproduce).
//                                                   respuesta = { preguntaId, idx } al tocar una opción de una
//                                                   pregunta del diagnóstico.
//   · 'diagnosticar'   { sesionId }              → { ok: true }  (deja el diagnóstico en el borrador)
//   · 'generar'        { sesionId }              → { sesion }  (versión nueva de la conclusión, y en el chat un
//                                                   mensaje de MaKo con el PDF de esa versión: `pdf: { version }`)
//   · 'guardar-oferta' { sesionId }              → { ofertaId, sesion, aviso?, avisoReintentable? }  (fila
//                                                   NUEVA de `ofertas`, ligada al funnel de la conversación.
//                                                   `aviso` = no se pudo ligar; `avisoReintentable` dice si
//                                                   volver a tocar «Guardar» lo puede arreglar)
//   · 'renombrar'      { id, titulo }            → { sesion }
//   · 'borrar'         { id }                    → { ok: true }  (borra también los audios)
//   ('listar' de la v1 se reemplazó por 'arbol'.)
//
// ⚠️ GATE: `adminDeWorkspaceActual()`, NO `resolverWsAdmin` — aquél le devuelve el ws1 (de Mauricio, un
//    CLIENTE) al super admin que no está mirando a nadie, y la tab escribiría en la cuenta de otro.
// ⚠️ ANTI-IDOR en 'leer' y en el audio del turno: el `path` lo manda el navegador, así que se exige que sea
//    de ESTE workspace y de esta tab (`<ws>/offer/<uuid>`) antes de bajarlo. Un path ajeno no se toca.
// ⚠️ EL BINARIO DE UN DOCUMENTO NUNCA QUEDA SUELTO. Desde la decisión de Martín (Ticketera, 15/10/2026 05:32,
//    ref `offer-archivero`: «¿El Archivero del chat guarda el archivo y paga una extracción por documento? →
//    A · Sí»), un ARCHIVO leído y guardado en la conversación pasa POR DETRÁS (`after`) a El Archivero:
//    `registrarDocumentoSinPisar` se hace cargo y, al terminar, o quedó con su fila o lo borró. En todo
//    otro caso (la lectura falló, la conversación no lo aceptó, un audio subido como documento) se borra
//    en el `finally`, como antes. El de un AUDIO del dueño no: el mensaje lo reproduce (GET
//    /api/offer/audio). Se borra con la conversación.
// ⚠️ GUARDARLO EN EL ARCHIVERO PAGA (una extracción de campos por documento, la del Archivero) y NO FRENA
//    NI ENSUCIA EL CHAT: la lectura para la conversación es la de siempre, el registro corre después de
//    responder, y si falla el chat sigue y el porqué queda escrito en el chip del archivo (`archivero` en
//    el documento y en los adjuntos que lo llevan). La IA de la conversación nunca lo lee.
// ⚠️ UN TURNO QUE FALLA NO GUARDA UN MENSAJE DE MaKo: el cartel de error no es algo que MaKo «dijo»
//    (AGENTS.md «Un cartel de la PLATAFORMA no es un turno de la conversación»). El mensaje del dueño sí
//    queda guardado, y la respuesta de error lleva la sesión para que la pantalla no la pierda. La única
//    excepción es la pregunta OBLIGATORIA del diagnóstico: si ninguna IA la adapta, sale la ORIGINAL (no es
//    un cartel: es la pregunta de lib/fase-diagnostico.ts, escrita por una persona).
// ⚠️ EL DIAGNÓSTICO NO SE MUESTRA EN EL CHAT: cuando el dueño contesta la última pregunta, se calcula con
//    `diagnosticar` y se guarda en el negocio SÓLO si no tenía uno (`asegurarFaseGuardada`, insert-if-absent),
//    y MaKo sigue con lo suyo. El resultado va al PDF (lib/offer-pdf.ts).
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { registrarDocumentoSinPisar, type RegistroArchivero } from '@/lib/archivero';
import { MAX_ARCHIVO_BYTES, formatosLegibles, puedeLeerse } from '@/lib/formatos-archivo';
import { marcarPasoTab } from '@/lib/tab-onboarding-state';
import { transcribirAudio, SttSinEscucha, errorDeCascada } from '@/lib/ai-cheap';
import { extraerLanding } from '@/lib/landing-fetch';
import { leerFunnels } from '@/lib/funnels';
import { listarOfertas } from '@/lib/ofertas';
import { guardarFaseSiNoHay } from '@/lib/fase-store';
import type { Diagnostico } from '@/lib/fase-diagnostico';
import { MARCA_COMPLETAR, faltanMinimas, type ArchiveroDoc, type ConclusionOferta } from '@/lib/offer-marco';
import {
  MAX_DOCS_SESION, TOPE_TEXTO_DOC, adjuntoDe, avisosAntesDelDiagnostico, calcularDiagnostico, canalParaElNegocio, conArchivero, conRespuestaInferida,
  diagnosticoFaltante, diagnosticoParaPrompt, docsDeLaConversacion, estadoDiagnostico, faltanTexto, faseDeSetting,
  faseVigenteDe, linkParaLeer, mensajeDeMako, mensajePdf, mergePiezas, motivoArchivoOffer, planDiagnostico, primerMensaje, primerMensajeFunnel, provisionalDe, recortar,
  repartirTranscripcion, respuestaDiagnostico, respuestaSinIA, seArchivaDesdeOffer, armadoEnCurso, pasoInicialDelArmado,
  type AudioGuardado, type DocumentoGuardado, type MensajeGuardado,
} from '@/lib/offer-reglas';
import { contextoOffer, type ContextoOffer } from '@/lib/offer-contexto';
import { avisarOfertaLista } from '@/lib/oferta-lista-server';
import { FEATURE_OFFER, diagnosticoOffer, propuestaOffer, turnoOffer } from '@/lib/offer-ia';
import {
  ConflictoCAS, ErrorOffer, TITULO_DEFAULT, actualizarSesion, arbolOffer, audiosDe, borrarSesion, crearSesion, guardarComoOferta,
  leerFila, nombreNegocioOffer, sesionVaciaDe, vistaSesion, type FilaOffer,
} from '@/lib/offer-sesiones';

export const dynamic = 'force-dynamic';
/**
 * Una propuesta larga en la cascada gratis puede tardar 2-3 minutos; los plazos de lib/offer-ia.ts quedan por debajo.
 * 800 (como /api/retro) por el ARMADO EN EL SERVIDOR: diagnóstico (≤285 s) + oferta (≤288 s) corren seguidos en el
 * `after()` de 'armar', en una sola invocación. Las demás acciones tienen sus propios plazos, más cortos.
 */
export const maxDuration = 800;
export const runtime = 'nodejs';

const BUCKET = 'archivero';
/** Lo más largo que se acepta escrito en el chat. Más que eso es un documento, y se sube como tal. */
const TOPE_MENSAJE = 12_000;
/** Lo más largo que se acepta de un link. */
const TOPE_URL = 2_000;
/**
 * Hasta cuándo puede correr la extracción del Archivero, contado desde que llegó el pedido: el
 * `maxDuration` (300 s) menos lo que hace falta para mover el binario, escribir la fila y anotar el chip.
 */
const PLAZO_ARCHIVERO_MS = 240_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ok = (datos: Record<string, unknown> = {}) => Response.json({ ok: true, ...datos });
const no = (status: number, error: string, extra: Record<string, unknown> = {}) => Response.json({ ok: false, error, ...extra }, { status });
const entero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};
const cadena = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
/** La ruta de un binario de ESTE workspace y de esta tab. Lo que no calce, no se toca. */
const esPathDeOffer = (ws: number, path: string): boolean => new RegExp(`^${ws}/offer/[0-9a-f-]{36}$`).test(path);

/** El paso del onboarding de la tab. Nunca tira: si el catálogo todavía no tiene la tab, se anota y se sigue. */
async function marcar(paso: 'of_contar' | 'of_conclusion'): Promise<void> {
  try { await marcarPasoTab('offer', paso); } catch (e) { console.warn(`[offer:onboarding] no pude marcar ${paso}: ${msg(e)}`); }
}

/** Quién abrió la conversación (sólo para auditar). */
async function quien(): Promise<string | null> {
  const s = await getUsuarioActual().catch(() => null);
  return s ? (s.email || s.sub || null) : null;
}

/**
 * Una conversación nueva, con lo que MaKo ya sabe y su primer mensaje (sin IA). Con funnel (v2) nace atada
 * a él: pide el documento o el link y, si analiza una oferta, siembra las piezas desde ESA oferta.
 */
async function sesionNueva(
  ctx: ContextoOffer, documentos: DocumentoGuardado[] = [],
  atada: { funnelId?: number | null; ofertaBaseId?: number | null } = {},
): Promise<FilaOffer> {
  const conFunnel = atada.funnelId != null;
  const piezas = conFunnel ? ctx.semillaSesion : ctx.semilla;
  return crearSesion({
    piezas,
    mensajes: [conFunnel
      ? primerMensajeFunnel(piezas, { modo: atada.ofertaBaseId != null ? 'analizar' : 'crear', ofertaBaseNombre: ctx.ofertaBase?.nombre })
      : primerMensaje(piezas, { hayContexto: !!ctx.texto.trim() })],
    creadoPor: await quien(),
    documentos,
    funnelId: atada.funnelId ?? null,
    ofertaBaseId: atada.ofertaBaseId ?? null,
  });
}

/** null si el funnel es de este negocio y está activo; si no, la respuesta de error. */
async function validarFunnel(funnelId: number): Promise<Response | null> {
  const funnels = await leerFunnels();
  if (funnels == null) return no(502, 'No pude leer tus funnels (falló la base de MaKo, no es nada tuyo). Prueba de nuevo en un momento.');
  return funnels.some((f) => f.id === funnelId) ? null : no(404, 'No encontré ese funnel. Puede que lo hayan archivado.');
}

/**
 * El diagnóstico de fase de esta conversación, guardado en el negocio (es la misma entidad que el
 * onboarding) si quedó completo y el negocio NO tenía uno. Nunca tira: si no se pudo, se intenta en el
 * turno siguiente (y al armar la oferta), y el PDF lo lleva igual desde los mensajes.
 *
 * El «sólo si no había» y su porqué viven en `guardarFaseSiNoHay` (lib/fase-store.ts), que es el dueño
 * del setting: acá estaba el mecanismo entero con la clave COPIADA, y un test vigilaba que las dos
 * cadenas no se separaran. Lo único que decide esta función es CUÁL diagnóstico se guarda.
 *
 * ⚠️ El canal que se guarda es el del NEGOCIO (`canalParaElNegocio`): el canal propio de un funnel
 *    secundario no es «dónde cierra la venta» de todo el negocio.
 */
async function asegurarFaseGuardada(f: FilaOffer, ctx: ContextoOffer): Promise<void> {
  if (ctx.faseGuardada) return;
  const e = estadoDiagnostico(f.mensajes, { canal: ctx.canal, yaGuardado: false });
  if (!e.diag) return;
  const d: Diagnostico = { ...e.diag, canal: canalParaElNegocio(e, ctx.funnel) };
  try {
    const vigente = await guardarFaseSiNoHay(d);
    if (vigente) ctx.faseGuardada = vigente;
  } catch (err) {
    console.error('[offer:fase] no pude guardar el diagnóstico de fase en el negocio:', msg(err));
  }
}

export async function POST(req: NextRequest) {
  const inicio = Date.now();
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return no(403, 'Sólo el admin del negocio puede usar Offer. Entra a la cuenta del negocio.');
  let body: Record<string, unknown>;
  try {
    const b = await req.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('no es un objeto');
    body = b as Record<string, unknown>;
  } catch {
    return no(400, 'El pedido llegó mal armado. Recarga la página y vuelve a intentarlo.');
  }
  const action = cadena(body.action);

  return runWithWorkspace(ws, async () => {
    try {
      switch (action) {
        case 'arbol':
          return ok({ arbol: await arbolOffer() });

        case 'abrir': {
          const id = entero(body.id);
          if (!id) return no(400, 'Falta qué conversación abrir.');
          const fila = await leerFila(id);
          return fila ? ok({ sesion: await vistaSesion(fila) }) : no(404, 'No encontré esa conversación. Puede que la hayan borrado.');
        }

        case 'nueva':
          return await nueva(body);

        case 'subir-url': {
          const nombre = cadena(body.nombre).slice(0, 200);
          const mime = cadena(body.mime);
          const tamano = typeof body.tamano === 'number' ? body.tamano : Number(body.tamano);
          if (!nombre) return no(400, 'Falta el nombre del archivo.');
          if (Number.isFinite(tamano) && tamano > MAX_ARCHIVO_BYTES) return no(413, `«${nombre}» pesa más de 25 MB. Súbelo más liviano o pega el texto en el chat.`);
          if (!puedeLeerse(nombre, mime)) return no(415, `MaKo no sabe leer «${nombre}». Sube uno de estos formatos: ${formatosLegibles()}.`);
          const path = `${ws}/offer/${randomUUID()}`;
          const { data, error } = await getSupabaseServer().storage.from(BUCKET).createSignedUploadUrl(path);
          if (error || !data) {
            console.error('[offer:subir-url]', error?.message);
            return no(502, 'No pude preparar la subida del archivo (falló el almacenamiento de MaKo, no es tu archivo). Prueba de nuevo en un momento.');
          }
          return ok({ path, signedUrl: data.signedUrl });
        }

        case 'leer':
          return await leer(ws, body, inicio);

        // Un binario subido que al final no se usa (el dueño descarta la nota de voz, o cambia de
        // conversación mientras algo sube). Antes 'leer' era lo ÚNICO que borraba, y en esos dos
        // caminos ya no se llamaba: el archivo quedaba suelto en Storage para siempre, pagando.
        // Misma validación de path que 'leer': el navegador lo escribe, así que sólo se borra uno de
        // ESTE workspace y de esta tab. Nunca falla hacia afuera — no borrar no es algo que el dueño
        // pueda arreglar, y un error acá taparía la acción que sí le importa.
        case 'descartar-subida': {
          const path = cadena(body.path);
          if (!esPathDeOffer(ws, path)) return no(400, 'Ese archivo no es de esta cuenta.');
          const { error } = await getSupabaseServer().storage.from(BUCKET).remove([path]);
          if (error) console.error('[offer:descartar-subida] no pude borrar', path, error.message);
          return ok({ borrado: !error });
        }

        case 'leer-link':
          return await leerLink(body);

        case 'turno':
          return await turno(ws, body, inicio);

        // Los dos pasos sueltos: los sigue usando MaKo Mobile (app/m/offer). Escritorio y el onboarding usan 'armar'.
        case 'diagnosticar': {
          const id = entero(body.sesionId);
          if (!id) return no(400, 'Falta la conversación a diagnosticar.');
          const r = await diagnosticarSesion(id, inicio);
          return r.ok ? ok() : no(r.status, r.error);
        }

        case 'armar':
          return await armar(ws, body);

        case 'generar':
          return await generar(body, inicio);

        case 'guardar-oferta': {
          const id = entero(body.sesionId);
          if (!id) return no(400, 'Falta la conversación a guardar.');
          const { ofertaId, fila, aviso, avisoReintentable } = await guardarComoOferta(id);
          return ok({ ofertaId, sesion: await vistaSesion(fila), ...(aviso ? { aviso, avisoReintentable: avisoReintentable === true } : {}) });
        }

        case 'renombrar': {
          const id = entero(body.id);
          const titulo = cadena(body.titulo).replace(/\s+/g, ' ');
          if (!id) return no(400, 'Falta qué conversación renombrar.');
          if (!titulo) return no(400, 'Escribe un nombre.');
          const fila = await actualizarSesion(id, () => ({ titulo: titulo.slice(0, 80) }));
          return ok({ sesion: await vistaSesion(fila) });
        }

        case 'borrar': {
          const id = entero(body.id);
          if (!id) return no(400, 'Falta qué conversación borrar.');
          const fila = await leerFila(id);
          if (!fila || !(await borrarSesion(id))) return no(404, 'No encontré esa conversación. Puede que ya la hayan borrado.');
          // Los audios se reproducían desde el mensaje: sin la conversación, sobran. Sólo los de ESTE workspace.
          const audios = audiosDe(fila).filter((p) => esPathDeOffer(ws, p));
          if (audios.length) {
            const { error } = await getSupabaseServer().storage.from(BUCKET).remove(audios).catch((e) => ({ error: { message: msg(e) } }));
            if (error) console.warn(`[offer:borrar] no pude borrar ${audios.length} audio(s) de la conversación #${id}: ${error.message}`);
          }
          return ok();
        }

        default:
          return no(400, `Acción desconocida: «${action || 'ninguna'}».`);
      }
    } catch (e) {
      if (e instanceof ErrorOffer) return no(e.status, e.message);
      console.error(`[offer:${action || 'sin-accion'}]`, e);
      return no(500, `Algo falló de nuestro lado al ${QUE[action] ?? 'procesar el pedido'}: ${msg(e)}. Prueba de nuevo en un momento.`);
    }
  });
}

/** Cómo se nombra cada acción en un error 500 («Algo falló de nuestro lado al …»). */
const QUE: Record<string, string> = {
  arbol: 'leer tus funnels y conversaciones', abrir: 'abrir la conversación', nueva: 'empezar la conversación',
  'subir-url': 'preparar la subida', leer: 'leer el documento', 'leer-link': 'leer tu página', turno: 'guardar tu mensaje',
  diagnosticar: 'diagnosticar la oferta', generar: 'armar la oferta', 'guardar-oferta': 'guardar la oferta',
  renombrar: 'renombrar la conversación', borrar: 'borrar la conversación',
};

// ── nueva ────────────────────────────────────────────────────────────────────

async function nueva(body: Record<string, unknown>): Promise<Response> {
  const funnelId = entero(body.funnelId);
  if (!funnelId) return no(400, 'Elige el funnel de la oferta.');
  const ofertaBaseId = body.ofertaBaseId == null ? null : entero(body.ofertaBaseId);
  if (body.ofertaBaseId != null && !ofertaBaseId) return no(400, 'La oferta a analizar no es válida.');
  const malFunnel = await validarFunnel(funnelId);
  if (malFunnel) return malFunnel;
  if (ofertaBaseId != null && !(await listarOfertas()).some((o) => o.id === ofertaBaseId)) {
    return no(404, 'No encontré esa oferta. Puede que la hayan borrado.');
  }
  // «Nueva oferta» dos veces seguidas no deja dos conversaciones vacías.
  const vacia = await sesionVaciaDe(funnelId, ofertaBaseId);
  if (vacia) return ok({ sesion: await vistaSesion(vacia) });
  const ctx = await contextoOffer({ funnelId, ofertaBaseId });
  const fila = await sesionNueva(ctx, [], { funnelId, ofertaBaseId });
  return ok({ sesion: await vistaSesion(fila) });
}

// ── leer / leer-link ─────────────────────────────────────────────────────────

/**
 * La conversación a la que va un documento: la que viene, o una nueva (atada al funnel, si viene).
 * `sesionId` = en cuál quedó (null si no quedó): lo necesita quien después le anota el Archivero.
 */
async function guardarDocumento(body: Record<string, unknown>, doc: DocumentoGuardado): Promise<{ res: Response; sesionId: number | null }> {
  const sesionId = body.sesionId == null ? null : entero(body.sesionId);
  const funnelId = entero(body.funnelId);
  let fila: FilaOffer;
  try {
    fila = sesionId
      ? await actualizarSesion(sesionId, (f) => {
        if (f.documentos.length >= MAX_DOCS_SESION) throw new ErrorOffer(`Esta conversación ya tiene ${MAX_DOCS_SESION} documentos. Empieza otra para subir más.`, 409);
        return { documentos: [...f.documentos, doc] };
      })
      : await sesionNueva(await contextoOffer({ funnelId }), [doc], { funnelId });
  } catch (e) {
    // El binario se borra (un documento que la conversación no aceptó no va al Archivero): que el error diga
    // CUÁL archivo hay que volver a subir.
    if (e instanceof ConflictoCAS) return { res: no(409, `No pude guardar «${doc.nombre}»: había otros archivos guardándose en esta conversación a la vez. Vuelve a subirlo.`), sesionId: null };
    throw e;
  }
  return { res: ok({ sesion: await vistaSesion(fila), doc: adjuntoDe(doc) }), sesionId: fila.id };
}

/** Las validaciones que van ANTES de bajar nada: la conversación existe y tiene lugar, el funnel es del negocio. */
async function antesDeLeer(body: Record<string, unknown>): Promise<Response | null> {
  const sesionId = body.sesionId == null ? null : entero(body.sesionId);
  if (body.sesionId != null && !sesionId) return no(400, 'La conversación no es válida.');
  if (sesionId) {
    const fila = await leerFila(sesionId);
    if (!fila) return no(404, 'No encontré esa conversación.');
    if (fila.documentos.length >= MAX_DOCS_SESION) return no(409, `Esta conversación ya tiene ${MAX_DOCS_SESION} documentos. Empieza otra para subir más.`);
    return null;
  }
  const funnelId = entero(body.funnelId);
  return funnelId ? validarFunnel(funnelId) : null;
}

async function leer(ws: number, body: Record<string, unknown>, inicio: number): Promise<Response> {
  const path = cadena(body.path);
  const nombre = cadena(body.nombre).slice(0, 200) || 'documento';
  const mime = cadena(body.mime);
  // El path lo escribe el navegador: sólo uno de ESTE workspace y de esta tab. Uno ajeno no se toca.
  if (!esPathDeOffer(ws, path)) return no(400, 'Ese archivo no es de esta cuenta. Vuelve a subirlo.');
  const storage = getSupabaseServer().storage.from(BUCKET);
  // true = el binario pasó a El Archivero (`archivarDespues`), que desde ahí es su dueño: no se borra acá.
  let entregado = false;
  try {
    const previo = await antesDeLeer(body);
    if (previo) return previo;
    const { data, error } = await storage.download(path);
    if (error || !data) return no(400, `No encontré «${nombre}» en la subida. Vuelve a subirlo.`);
    const contenido = new Uint8Array(await data.arrayBuffer());
    const file = new File([contenido], nombre, { type: mime || data.type || '' });
    // Con la red: Offer es de la primera semana de un cliente nuevo, que no trae una API (16/10/2026).
    const lectura = await archivoATexto(file, { feature: 'offer', motivo: `Offer: leer «${nombre}»`, redDePlataforma: true });
    const texto = (lectura.texto ?? '').trim();
    if (!texto) return no(422, lectura.warning || `No pude sacar texto de «${nombre}». Si es una foto o un escaneo borroso, prueba con otra versión o pega el texto en el chat.`);
    const recortado = texto.length > TOPE_TEXTO_DOC;
    const doc: DocumentoGuardado = {
      id: randomUUID(), nombre, via: lectura.via, texto: texto.slice(0, TOPE_TEXTO_DOC), chars: texto.length,
      ...(lectura.warning ? { aviso: recortar(lectura.warning, 200) } : recortado ? { aviso: `Leí sólo el principio (${TOPE_TEXTO_DOC.toLocaleString('es-MX')} de ${texto.length.toLocaleString('es-MX')} caracteres).` } : {}),
      at: new Date().toISOString(),
    };
    const { res, sesionId } = await guardarDocumento(body, doc);
    // Recién con el documento EN la conversación: uno que no quedó no va a ningún lado.
    if (sesionId != null && seArchivaDesdeOffer(lectura.via)) {
      entregado = true;
      await archivarDespues(ws, { sesionId, docId: doc.id, origen: path, contenido, nombre, mime: file.type, texto, inicio });
    }
    return res;
  } finally {
    // También si algo de arriba tiró: lo que no pasó al Archivero no se guarda (lo que queda es el texto).
    if (!entregado) {
      const { error } = await storage.remove([path]).catch((e) => ({ error: { message: msg(e) } }));
      if (error) console.warn(`[offer:leer] no pude borrar ${path}: ${error.message}`);
    }
  }
}

/**
 * El archivo, también en El Archivero (decisión de Martín, Ticketera 15/10/2026 05:32, ref `offer-archivero`).
 * POR DETRÁS (`after`): la respuesta de 'leer' sale ya, y el turno no espera una extracción. Fuera de un
 * pedido (un script) `after` tira y se hace en línea (molde: lib/curso-avance.ts).
 *
 * `registrarDocumentoSinPisar` es dueño del binario desde acá y nunca tira. Lo que pasó se anota en el
 * documento y en los adjuntos que lo llevan (`conArchivero`): si falló, el chip lo dice.
 */
async function archivarDespues(ws: number, p: {
  sesionId: number; docId: string; origen: string; contenido: Uint8Array; nombre: string; mime: string; texto: string; inicio: number;
}): Promise<void> {
  const trabajo = () => runWithWorkspace(ws, async () => {
    let r: RegistroArchivero;
    try {
      r = await registrarDocumentoSinPisar(ws, {
        origen: p.origen, contenido: p.contenido, nombre: p.nombre, mime: p.mime, texto: p.texto,
        motivo: motivoArchivoOffer(p.nombre), hastaMs: p.inicio + PLAZO_ARCHIVERO_MS,
      });
    } catch (e) {
      // No debería: registrarDocumentoSinPisar devuelve sus fallos. Si igual tira, el binario no queda suelto.
      await getSupabaseServer().storage.from(BUCKET).remove([p.origen]).catch(() => null);
      r = { ok: false, motivo: 'algo falló de nuestro lado al guardarlo' };
      console.error('[offer:archivero]', e);
    }
    if (!r.ok) console.error(`[offer:archivero] «${p.nombre}» (conversación #${p.sesionId}) no quedó en El Archivero: ${r.motivo}`);
    await anotarArchivero(p.sesionId, p.docId, r.ok ? { ok: true, id: r.id, ...(r.aviso ? { aviso: r.aviso } : {}) } : { ok: false, motivo: r.motivo });
  });
  try {
    after(trabajo);
    return;
  } catch { /* sin pedido: en línea */ }
  await trabajo();
}

/** Lo que pasó en El Archivero, en el documento de la conversación. Nunca tira: el registro ya está hecho. */
async function anotarArchivero(sesionId: number, docId: string, estado: ArchiveroDoc): Promise<void> {
  try {
    await actualizarSesion(sesionId, (f) => conArchivero(f, docId, estado));
  } catch (e) {
    // La conversación pudo borrarse mientras tanto (404): no hay dónde anotarlo, y El Archivero quedó igual.
    console.error(`[offer:archivero] no pude anotar el resultado en la conversación #${sesionId}:`, msg(e));
  }
}

/**
 * La web o la landing del dueño como documento de la conversación. La baja `extraerLanding`
 * (lib/landing-fetch.ts): sólo http/https, todas las IPs del host públicas, cada redirect revalidado, la
 * IP clavada (sin DNS rebinding) y techo de tamaño y de tiempo. NO hay otro fetch de URLs de usuarios acá.
 * Después de esto, la pantalla manda un 'turno' con `docIds: [doc.id]` (el texto puede ir vacío).
 */
async function leerLink(body: Record<string, unknown>): Promise<Response> {
  const url = cadena(body.url).slice(0, TOPE_URL);
  if (!url) return no(400, 'Pega el link de tu web o de tu landing.');
  // Se baja LA página que pegó, tal cual: `linkParaLeer` le saca sólo los parámetros de seguimiento y
  // `extraerLanding(..., { talCual: true })` conserva el www y el querystring. Un `?page_id=245` ES la
  // página, no ruido de medición: normalizarlo bajaba la home y la IA anotaba piezas de otra oferta.
  const link = linkParaLeer(url);
  if (!link.ok) return no(422, link.error);
  const previo = await antesDeLeer(body);
  if (previo) return previo;
  let pagina: Awaited<ReturnType<typeof extraerLanding>>;
  try {
    pagina = await extraerLanding(link.leida, { talCual: true });
  } catch (e) {
    const cual = link.leida === url.trim() ? '' : ` (${link.leida})`;
    return no(422, `No pude abrir esa página${cual}: ${msg(e)} Si es privada o pide iniciar sesión, copia su texto y pégalo aquí.`);
  }
  // `bloqueada` sólo MIDE que hay poco texto en los titulares, párrafos y botones: el porqué no se sabe,
  // así que no se afirma uno (AGENTS.md «Un DIAGNÓSTICO escrito de antemano deja de ser cierto sin avisar»).
  if (pagina.bloqueada || !pagina.texto.trim()) {
    return no(422, 'Entré a tu página pero casi no encontré texto para leer. Copia el texto de la página y pégalo aquí.');
  }
  let host = url;
  try { host = new URL(pagina.urlFinal).host; } catch { /* queda el link tal cual */ }
  const texto = [`Página: ${pagina.urlFinal}`, pagina.titulo ? `# ${pagina.titulo}` : '', pagina.descripcion, pagina.texto].filter(Boolean).join('\n\n');
  const doc: DocumentoGuardado = {
    id: randomUUID(),
    nombre: recortar(pagina.titulo ? `${pagina.titulo} (${host})` : host, 200),
    via: 'web', texto: texto.slice(0, TOPE_TEXTO_DOC), chars: texto.length,
    ...(avisoLink(texto.length) ?? {}),
    at: new Date().toISOString(),
  };
  return (await guardarDocumento(body, doc)).res;
}

/**
 * El aviso del documento de un link: hoy, sólo si se leyó el principio.
 *
 * Tenía un segundo aviso —«leí la página sin el www.»— que dejó de tener sentido cuando `extraerLanding`
 * aprendió a bajar la URL tal cual: ya no se lee una página parecida, se lee la que pegó. Un aviso que
 * describe algo que ya no pasa es peor que ninguno.
 */
function avisoLink(chars: number): { aviso: string } | null {
  if (chars <= TOPE_TEXTO_DOC) return null;
  return { aviso: `Leí sólo el principio (${TOPE_TEXTO_DOC.toLocaleString('es-MX')} de ${chars.toLocaleString('es-MX')} caracteres).` };
}

// ── turno ────────────────────────────────────────────────────────────────────

/** El audio que manda el navegador: de este workspace, de esta tab y con un tipo de audio. */
function leerAudio(ws: number, raw: unknown): AudioGuardado | 'invalido' | null {
  if (raw == null) return null;
  if (typeof raw !== 'object') return 'invalido';
  const o = raw as Record<string, unknown>;
  const path = cadena(o.path);
  const mime = cadena(o.mime).toLowerCase();
  if (!esPathDeOffer(ws, path)) return 'invalido';
  if (!/^(audio\/|video\/webm)/.test(mime)) return 'invalido';
  const secs = typeof o.secs === 'number' && Number.isFinite(o.secs) ? Math.min(3_600, Math.max(0, Math.round(o.secs))) : 0;
  return { path, mime, secs };
}

/**
 * Transcribe el audio del dueño. El texto lo eligen los errores de SUS keys (AGENTS.md «Los errores de
 * NUESTRAS credenciales no eligen el texto que lee el cliente»): `SttSinEscucha.errores`, no los de la red.
 *  · Ninguna IA pudo → 502 con el mensaje de lib/ia-mensajes.ts (de quién es la culpa y qué hacer). El
 *    binario NO se borra: la pantalla puede reintentar con el mismo audio.
 *  · Alguien escuchó y no había voz ('') → 422 que dice que es el audio, y el binario se borra (no sirve).
 */
async function transcribir(audio: AudioGuardado): Promise<{ ok: true; texto: string } | { ok: false; res: Response }> {
  const storage = getSupabaseServer().storage.from(BUCKET);
  const { data, error } = await storage.download(audio.path);
  if (error || !data) return { ok: false, res: no(400, 'No encontré tu audio en la subida. Vuelve a grabarlo.') };
  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.byteLength > MAX_ARCHIVO_BYTES) return { ok: false, res: no(413, 'El audio pesa más de 25 MB. Grábalo más corto o escríbemelo.') };
  let texto = '';
  try {
    texto = (await transcribirAudio(buf.toString('base64'), audio.mime, { language: 'es', feature: FEATURE_OFFER, motivo: 'Offer: transcribir un audio del dueño' })).trim();
  } catch (e) {
    console.error('[offer:audio] STT:', msg(e));
    const delNegocio = e instanceof SttSinEscucha ? e.errores : [msg(e)];
    return { ok: false, res: no(502, await errorDeCascada(delNegocio, 'escuchar tu audio')) };
  }
  if (!texto) {
    await storage.remove([audio.path]).catch(() => null);
    return { ok: false, res: no(422, 'Escuché tu audio pero no le entendí nada: grábalo de nuevo un poco más cerca del micrófono, o escríbemelo.') };
  }
  return { ok: true, texto };
}

async function turno(ws: number, body: Record<string, unknown>, inicio: number): Promise<Response> {
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  const docIds = Array.isArray(body.docIds) ? [...new Set(body.docIds.filter((x): x is string => typeof x === 'string' && !!x.trim()))].slice(0, MAX_DOCS_SESION) : [];
  // REINTENTAR: si la IA falló, el mensaje del dueño YA quedó guardado (paso 1) y el
  // 502 devolvió la sesión. Volver a mandar el texto lo duplicaría en la conversación
  // (y, en una conversación nueva, crearía otra sesión). Con `reintentar` se corre la
  // IA sobre lo guardado, sin agregar nada.
  const reintentar = body.reintentar === true && body.sesionId != null;
  if (reintentar) return reintentarTurno(body, inicio);
  const audio = leerAudio(ws, body.audio);
  if (audio === 'invalido') return no(400, 'Ese audio no es de esta cuenta. Vuelve a grabarlo.');
  const respuestaPedida = body.respuesta && typeof body.respuesta === 'object' ? body.respuesta as { preguntaId?: unknown; idx?: unknown } : null;
  if (!texto && !docIds.length && !audio && !respuestaPedida) return no(400, 'Escribe algo, dicta un audio o adjunta un documento.');
  if (texto.length > TOPE_MENSAJE) return no(413, 'El mensaje es muy largo para el chat. Súbelo como documento y MaKo lo lee entero.');
  const sesionIdRaw = body.sesionId == null ? null : entero(body.sesionId);
  if (body.sesionId != null && !sesionIdRaw) return no(400, 'La conversación no es válida.');
  if (!sesionIdRaw && (docIds.length || respuestaPedida)) return no(400, 'Eso va con una conversación. Recarga la página y vuelve a intentarlo.');
  const funnelId = entero(body.funnelId);
  if (!sesionIdRaw && funnelId) {
    const malFunnel = await validarFunnel(funnelId);
    if (malFunnel) return malFunnel;
  }

  // 0) El audio se transcribe ANTES de guardar nada: si nadie lo puede escuchar, no queda un mensaje mudo.
  let transcripcion = '';
  if (audio) {
    const t = await transcribir(audio);
    if (!t.ok) return t.res;
    transcripcion = t.texto;
  }

  let id = sesionIdRaw;
  if (!id) id = (await sesionNueva(await contextoOffer({ funnelId }), [], { funnelId })).id;
  const sesionId = id;
  const antes = await leerFila(sesionId);
  if (!antes) return no(404, 'No encontré esa conversación. Puede que la hayan borrado.');
  const ctx = await contextoOffer({ funnelId: antes.funnelId, ofertaBaseId: antes.ofertaBaseId });
  const optsDiag = { canal: ctx.canal, yaGuardado: !!ctx.faseGuardada };

  // 1) El mensaje del dueño se guarda YA: si la IA falla, lo que escribió no se pierde.
  // Cajas y no lets: TypeScript no ve la asignación adentro del callback y la daría por su valor inicial.
  const primero = { era: false };
  // ⚠️ Una nota de voz larga NO se corta en silencio al tope del chat: si no entra, la transcripción ENTERA
  // viaja como documento de la conversación y el mensaje lleva el principio (`repartirTranscripcion`). El id
  // es fijo afuera del CAS: el callback puede correr varias veces.
  const docAudio = { id: randomUUID(), creado: false };
  const conMensaje = await actualizarSesion(sesionId, (f) => {
    const porId = new Map(f.documentos.map((d) => [d.id, d] as const));
    const faltan = docIds.filter((d) => !porId.has(d));
    if (faltan.length) throw new ErrorOffer('Uno de los documentos ya no está en esta conversación. Vuelve a subirlo.', 400);
    primero.era = !f.mensajes.some((m) => m.de === 'yo');
    const at = new Date().toISOString();
    const reparto = transcripcion
      ? repartirTranscripcion(texto, transcripcion, { tope: TOPE_MENSAJE, topeDoc: TOPE_TEXTO_DOC, docsLibres: MAX_DOCS_SESION - f.documentos.length })
      : { cuerpo: texto, doc: null };
    const transcripta: DocumentoGuardado | null = reparto.doc
      ? { id: docAudio.id, nombre: 'Transcripción del audio', via: 'audio', texto: reparto.doc.texto, chars: reparto.doc.chars, ...(reparto.doc.aviso ? { aviso: reparto.doc.aviso } : {}), at }
      : null;
    docAudio.creado = !!transcripta;
    const adjuntos = [...docIds.map((d) => adjuntoDe(porId.get(d) as DocumentoGuardado)), ...(transcripta ? [adjuntoDe(transcripta)] : [])];
    // La opción tocada de una pregunta del diagnóstico: se valida contra lo que MaKo preguntó de verdad.
    const r = respuestaDiagnostico(f.mensajes, respuestaPedida, estadoDiagnostico(f.mensajes, optsDiag));
    const cuerpo = reparto.cuerpo || (r?.texto ?? '');
    if (!cuerpo && !adjuntos.length) throw new ErrorOffer('Esa pregunta ya no está abierta. Escribe tu respuesta.', 409);
    const m: MensajeGuardado = {
      id: randomUUID(), de: 'yo', texto: cuerpo, at,
      ...(adjuntos.length ? { adjuntos } : {}),
      ...(audio ? { audio } : {}),
      ...(r ? { respuesta: { preguntaId: r.preguntaId, idx: r.idx } } : {}),
    };
    // Un mensaje nuevo vacía el borrador: un diagnóstico de la conversación de antes ya no la describe.
    return { mensajes: [...f.mensajes, m], borrador: null, ...(transcripta ? { documentos: [...f.documentos, transcripta] } : {}) };
  });
  if (primero.era) await marcar('of_contar');

  // «Así está bien» después del PDF de una versión: lo contesta el CÓDIGO (no hay nada que preguntar, y
  // pagar un modelo por un «perfecto» no le compra nada al dueño).
  const sinIA = !audio && !docIds.length ? respuestaSinIA(conMensaje.mensajes, texto, { id: randomUUID(), at: new Date().toISOString() }) : null;
  if (sinIA) {
    const final = await actualizarSesion(sesionId, (f) => {
      const u = f.mensajes[f.mensajes.length - 1];
      return u && u.de === 'yo' ? { mensajes: [...f.mensajes, sinIA] } : null;
    });
    return ok({ sesion: await vistaSesion(final) });
  }

  return responder({ sesionId, fila: conMensaje, ctx, nuevos: docAudio.creado ? [...docIds, docAudio.id] : docIds, inicio });
}

/** La respuesta de MaKo a un mensaje del dueño que quedó sin contestar (la IA falló). */
async function reintentarTurno(body: Record<string, unknown>, inicio: number): Promise<Response> {
  const sesionId = entero(body.sesionId);
  if (!sesionId) return no(400, 'La conversación no es válida.');
  const fila = await leerFila(sesionId);
  if (!fila) return no(404, 'No encontré esa conversación.');
  const ultimo = fila.mensajes[fila.mensajes.length - 1];
  // Sólo se reintenta un mensaje del dueño sin respuesta: si MaKo ya contestó (otra
  // pestaña, un doble clic), reintentar sería contestar dos veces lo mismo.
  if (!ultimo || ultimo.de !== 'yo') return ok({ sesion: await vistaSesion(fila) });
  const ctx = await contextoOffer({ funnelId: fila.funnelId, ofertaBaseId: fila.ofertaBaseId });
  return responder({ sesionId, fila, ctx, nuevos: (ultimo.adjuntos ?? []).map((a) => a.id), inicio });
}

/**
 * La respuesta de MaKo al último mensaje del dueño (turno y reintento pasan por acá).
 *
 *  2) Qué pregunta del diagnóstico toca (`planDiagnostico`) y la IA del turno.
 *  3) Se agrega a la fila de ESTE momento (CAS): las piezas se funden con las que haya ahora, la respuesta
 *     que MaKo leyó en las palabras del dueño se pega a su mensaje, y el mensaje de MaKo lo arma el CÓDIGO
 *     (`mensajeDeMako`). Si mientras tanto otra pestaña ya contestó, no se contesta dos veces.
 *  Antes y después: si el diagnóstico quedó completo, se guarda en el negocio. El resultado NO va al chat.
 */
async function responder(p: { sesionId: number; fila: FilaOffer; ctx: ContextoOffer; nuevos: string[]; inicio: number }): Promise<Response> {
  const { fila, ctx } = p;
  const optsDiag = { canal: ctx.canal, yaGuardado: !!ctx.faseGuardada };
  await asegurarFaseGuardada(fila, ctx);
  const duenos = (ms: MensajeGuardado[]) => ms.filter((m) => m.de === 'yo').length;
  const e = estadoDiagnostico(fila.mensajes, optsDiag);
  const plan = planDiagnostico(e, { puedeConcluir: faltanMinimas(fila.piezas).length === 0, mensajesDelDueno: duenos(fila.mensajes), conDocumentosNuevos: p.nuevos.length > 0 });
  const ia = await turnoOffer({
    mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes, p.nuevos), nuevos: p.nuevos,
    contexto: ctx.texto, inicio: p.inicio, diagnostico: diagnosticoParaPrompt(plan, e), diagnosticoObligatorio: plan.modo === 'forzar',
    voz: ctx.voz,
  });
  // Sin IA sólo se sigue si la pregunta que toca es la obligatoria del diagnóstico (sale la original).
  if (!ia.ok && plan.modo !== 'forzar') return no(502, ia.error, { sesion: await vistaSesion(fila) });
  const turnoIA = ia.ok ? ia.valor : null;

  // La fuente es 'doc' si el turno trajo documentos: de ahí sale casi todo lo que se anota en él.
  const fuente = p.nuevos.length ? 'doc' : 'chat';
  const final = await actualizarSesion(p.sesionId, (f) => {
    // Si mientras tanto llegó otra respuesta de MaKo, no se agrega una segunda.
    const u = f.mensajes[f.mensajes.length - 1];
    if (!u || u.de !== 'yo') return null;
    const piezas = turnoIA ? mergePiezas(f.piezas, turnoIA.piezas, fuente) : f.piezas;
    const puede = faltanMinimas(piezas).length === 0;
    const inferida = conRespuestaInferida(f.mensajes, estadoDiagnostico(f.mensajes, optsDiag), turnoIA?.diagnosticoRespuesta);
    // Si MaKo leyó la respuesta en las palabras del dueño, la pregunta que toca ahora es otra.
    const planFinal = inferida.preguntaId
      ? planDiagnostico(estadoDiagnostico(inferida.mensajes, optsDiag), { puedeConcluir: puede, mensajesDelDueno: duenos(inferida.mensajes), conDocumentosNuevos: p.nuevos.length > 0 })
      : plan;
    const m = mensajeDeMako({
      turno: turnoIA, plan: planFinal, piezas, puedeConcluir: puede, id: randomUUID(), at: new Date().toISOString(),
      diagPara: plan.modo === 'no' ? null : plan.pregunta.id,
    });
    return { mensajes: [...inferida.mensajes, m], piezas };
  });
  await asegurarFaseGuardada(final, ctx);
  return ok({ sesion: await vistaSesion(final) });
}

// ── diagnosticar ─────────────────────────────────────────────────────────────

/**
 * El paso del DIAGNÓSTICO: lee la conversación, corre la IA y deja el resultado en `borrador` (lo consume el
 * paso de la oferta). Lo usan la acción 'diagnosticar' y el armado en el servidor. Los fallos que el dueño
 * puede leer vuelven como `{ ok: false }`; un 409 del CAS tira `ErrorOffer`.
 */
async function diagnosticarSesion(id: number, inicio: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const fila = await leerFila(id);
  if (!fila) return { ok: false, status: 404, error: 'No encontré esa conversación.' };
  if (faltanMinimas(fila.piezas).length) return { ok: false, status: 409, error: `Antes de armar la oferta falta: ${faltanTexto(fila.piezas)}. Sigue la conversación con MaKo.` };
  const ctx = await contextoOffer({ conEmbudo: true, funnelId: fila.funnelId, ofertaBaseId: fila.ofertaBaseId, mensajes: fila.mensajes });
  await asegurarFaseGuardada(fila, ctx);
  // Los avisos del CÓDIGO van ANTES de la IA: la que pone la nota de Foco tiene que ver el de foco
  // (tarjeta «foco», 12/10/2026), y los de margen, embudo y precio pesan en D6 y D7. La banda de
  // facturación sale del diagnóstico de fase que VALE ahora (releído después de asegurarlo).
  const faseAhora = faseVigenteDe(ctx);
  const banda = faseAhora && Number.isInteger(faseAhora.respuestas?.[0]) ? faseAhora.respuestas[0] : ctx.foco.bandaFacturacion;
  const avisos = avisosAntesDelDiagnostico({ foco: { ...ctx.foco, bandaFacturacion: banda }, piezas: fila.piezas, tasas: ctx.tasasEmbudo });
  const ia = await diagnosticoOffer({
    mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes), contexto: ctx.texto, embudo: ctx.embudo, inicio,
    alertas: [...(avisos.foco ? [avisos.foco] : []), ...avisos.otras],
  });
  if (!ia.ok) return { ok: false, status: 502, error: ia.error };
  // Con las PIEZAS: sin ellas no hay control final, y «lista para vender» volvería a mirar sólo las notas.
  const calculo = calcularDiagnostico(ia.valor.dimensiones, { foco: avisos.foco, otras: avisos.otras, piezas: fila.piezas });
  const at = new Date().toISOString();
  await actualizarSesion(id, (f) => {
    // Si el dueño escribió mientras MaKo diagnosticaba, este diagnóstico ya no describe la conversación.
    if (f.mensajes.length !== fila.mensajes.length) throw new ErrorOffer('La conversación cambió mientras MaKo la leía. Vuelve a tocar «Armar mi oferta».', 409);
    return { borrador: { diagnostico: ia.valor, calculo, modelo: ia.modelo, at } };
  });
  return { ok: true };
}

// ── armar (en el servidor) ───────────────────────────────────────────────────

/**
 * «Armar mi oferta», en el SERVIDOR (16/10/2026). Antes el navegador esperaba los dos pasos y, si la persona
 * cerraba la pestaña en el primero, la oferta no se hacía nunca. Ahora esto anota el armado en la fila
 * (`armado`, mig 0296), contesta al toque con la conversación y corre los dos pasos en un `after()`: la pantalla
 * sólo relee hasta que aparece la conclusión. Al terminar, el evento de la plataforma «oferta_lista» (el aviso
 * por WhatsApp lo arma la automatización del SuperAdmin, no este código).
 *
 * Idempotente: si ya hay uno corriendo, devuelve la conversación sin arrancar otro (un doble clic, la
 * pestaña del onboarding que se vuelve a montar, dos pestañas). Si el diagnóstico ya estaba hecho y falló
 * la oferta, arranca desde la oferta (`pasoInicialDelArmado`).
 */
async function armar(ws: number, body: Record<string, unknown>): Promise<Response> {
  const id = entero(body.sesionId);
  if (!id) return no(400, 'Falta la conversación.');
  const fila = await leerFila(id);
  if (!fila) return no(404, 'No encontré esa conversación.');
  if (faltanMinimas(fila.piezas).length) return no(409, `Antes de armar la oferta falta: ${faltanTexto(fila.piezas)}. Sigue la conversación con MaKo.`);
  const origen = body.origen === 'arranque' ? 'arranque' : 'tab';
  const intento = randomUUID();
  let arranco = false;
  const final = await actualizarSesion(id, (f) => {
    if (armadoEnCurso(f.armado, Date.now())) return null;
    arranco = true;
    return { armado: { desde: new Date().toISOString(), paso: pasoInicialDelArmado(!!f.borrador), origen, intento } };
  });
  if (arranco) {
    const trabajo = () => runWithWorkspace(ws, () => armarPorDetras(ws, id, intento));
    try { after(trabajo); } catch { void trabajo(); }
  }
  return ok({ sesion: await vistaSesion(final) });
}

/**
 * Los dos pasos, uno detrás del otro, con su propio plazo cada uno (`inicio` de cada paso: los de lib/offer-ia.ts
 * cuentan desde ahí). Cada cambio del armado va por CAS y SÓLO si sigue siendo este intento: uno viejo que
 * termina tarde no pisa el de uno nuevo. Nunca tira: un fallo queda escrito en `armado.error` para el dueño.
 */
async function armarPorDetras(ws: number, id: number, intento: string): Promise<void> {
  const esteIntento = (f: FilaOffer) => f.armado?.intento === intento;
  const anotar = async (cambio: (a: NonNullable<FilaOffer['armado']>) => FilaOffer['armado']) => {
    await actualizarSesion(id, (f) => (f.armado && esteIntento(f) ? { armado: cambio(f.armado) } : null)).catch((e) => {
      console.error(`[offer:armar] no pude anotar el armado de #${id}: ${msg(e)}`);
    });
  };
  const fallar = (error: string) => anotar((a) => ({ ...a, error }));
  try {
    const arranque = await leerFila(id);
    if (!arranque?.armado || arranque.armado.intento !== intento) return;
    if (arranque.armado.paso === 'diagnostico') {
      const d = await diagnosticarSesion(id, Date.now());
      if (!d.ok) { await fallar(d.error); return; }
      await anotar((a) => ({ ...a, paso: 'oferta' }));
    }
    const g = await generarSesion(id, Date.now());
    if (!g.ok) { await fallar(g.error); return; }
    // Listo: el armado se borra en su propio CAS (la conclusión ya quedó en el de `generarSesion`).
    let origen: 'arranque' | 'tab' = 'tab';
    await actualizarSesion(id, (f) => {
      if (!esteIntento(f)) return null;
      origen = f.armado?.origen ?? 'tab';
      return { armado: null };
    }).catch((e) => console.error(`[offer:armar] no pude cerrar el armado de #${id}: ${msg(e)}`));
    await avisarOfertaLista(ws, g.final);
  } catch (e) {
    // Un 409 del CAS (la persona escribió mientras armaba) trae su mensaje; cualquier otra cosa, uno genérico.
    await fallar(e instanceof ErrorOffer ? e.message : 'Algo falló de nuestro lado mientras armaba tu oferta. Vuelve a tocar «Armar mi oferta».');
    if (!(e instanceof ErrorOffer)) console.error(`[offer:armar] #${id}:`, e);
  }
}

// ── generar ──────────────────────────────────────────────────────────────────

async function generar(body: Record<string, unknown>, inicio: number): Promise<Response> {
  const id = entero(body.sesionId);
  if (!id) return no(400, 'Falta la conversación.');
  const r = await generarSesion(id, inicio);
  return r.ok ? ok({ sesion: await vistaSesion(r.final) }) : no(r.status, r.error);
}

/**
 * El paso de la OFERTA: arma la propuesta sobre el diagnóstico guardado (`borrador`) y la agrega como versión,
 * con su PDF en el chat, en un CAS. Lo usan la acción 'generar' y el armado en el servidor. Los fallos que el
 * dueño puede leer vuelven como `{ ok: false }`; un 409 del CAS tira `ErrorOffer`.
 */
async function generarSesion(id: number, inicio: number): Promise<{ ok: true; final: FilaOffer } | { ok: false; status: number; error: string }> {
  const fila = await leerFila(id);
  if (!fila) return { ok: false, status: 404, error: 'No encontré esa conversación.' };
  const borrador = fila.borrador;
  if (!borrador) return { ok: false, status: 409, error: 'Falta el diagnóstico de esta conversación. Vuelve a tocar «Armar mi oferta».' };
  const ctx = await contextoOffer({ funnelId: fila.funnelId, ofertaBaseId: fila.ofertaBaseId, mensajes: fila.mensajes });
  await asegurarFaseGuardada(fila, ctx);
  // El diagnóstico de fase que va al PDF, con la MISMA regla que el contexto de los prompts (`faseVigenteDe`:
  // gana el guardado en el negocio), releída después de `asegurarFaseGuardada`. Si no hay ninguno porque el
  // dueño armó la oferta con preguntas pendientes, la conclusión lo dice y el PDF también (no se omite en
  // silencio).
  const fase = faseVigenteDe(ctx);
  const faltante = fase ? null : diagnosticoFaltante(estadoDiagnostico(fila.mensajes, { canal: ctx.canal, yaGuardado: !!ctx.faseGuardada }));
  // Las cifras que SÍ dio el negocio salen de lo que escribió el dueño, sus documentos y lo que tenía cargado
  // (las piezas las suma el parse): toda otra cifra de resultados, de prueba, de bonos o de valor pasa a
  // «[completar]» (tarjeta «cifras», 12/10/2026). El nombre del negocio no puede ir en el del método.
  const fuentes = [
    ...fila.mensajes.filter((m) => m.de === 'yo').map((m) => m.texto),
    ...fila.documentos.map((d) => d.texto),
    ctx.texto,
  ];
  const negocio = await nombreNegocioOffer().catch(() => '');
  const ia = await propuestaOffer({
    mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes), contexto: ctx.texto,
    diagnostico: borrador.diagnostico, calculo: borrador.calculo, inicio, reglas: { fuentes, negocio }, voz: ctx.voz,
  });
  if (!ia.ok) return { ok: false, status: 502, error: ia.error };
  const nombre = ia.valor.nombre.trim();
  // Con el cliente ideal o la promesa en 3 o menos, precio y bonos salen PROVISIONALES (tarjeta «rehacer»: C).
  const provisional = provisionalDe(borrador.diagnostico);
  const final = await actualizarSesion(id, (f) => {
    if (!f.borrador || f.borrador.at !== borrador.at) {
      throw new ErrorOffer('La conversación cambió mientras MaKo armaba la oferta. Vuelve a tocar «Armar mi oferta».', 409);
    }
    const version = f.conclusiones.reduce((max, c) => Math.max(max, c.version), 0) + 1;
    const at = new Date().toISOString();
    const conclusion: ConclusionOferta = {
      diagnostico: borrador.diagnostico,
      calculo: borrador.calculo,
      propuesta: ia.valor,
      version,
      at,
      modelo: borrador.modelo === ia.modelo ? ia.modelo : `diagnóstico: ${borrador.modelo} · oferta: ${ia.modelo}`,
      fase,
      ...(faltante ? { diagnosticoFaltante: faltante } : {}),
      ...(provisional ? { provisional } : {}),
    };
    // El PDF de ESTA versión vuelve al chat, con la propuesta de pulirla (pedido de Martín, 12/10/2026). Lo
    // agrega el CÓDIGO en el mismo CAS que la conclusión: no hay una versión sin su mensaje ni al revés.
    const conPdf = mensajePdf({
      version, dimensiones: borrador.diagnostico.dimensiones, cuello: borrador.calculo.cuello, lista: borrador.calculo.lista,
      id: randomUUID(), at,
    });
    // La conversación toma el nombre de la oferta la primera vez, si nadie la renombró a mano.
    const titulo = f.titulo === TITULO_DEFAULT && nombre && !nombre.includes(MARCA_COMPLETAR) ? nombre.slice(0, 80) : undefined;
    return {
      conclusiones: [...f.conclusiones, conclusion], mensajes: [...f.mensajes, conPdf],
      estado: 'concluida', borrador: null, ...(titulo ? { titulo } : {}),
    };
  });
  await marcar('of_conclusion');
  return { ok: true, final };
}
