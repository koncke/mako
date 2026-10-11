// =============================================================================
// POST /api/offer — la tab Offer: conversar, leer documentos, diagnosticar y armar la oferta
// =============================================================================
// Pedido de Martín (11/10/2026): Offer Analyst + Offer Generator en una sola tab, «muy de IA… algo
// simple como un chat… y que el resultado final sea que te dé un PDF con la conclusión».
//
// Body: { action, ... } → siempre { ok: true, ... } | { ok: false, error } (el error dice de quién es la
// culpa y qué hacer). Las acciones:
//   · 'listar'                                   → { sesiones }
//   · 'abrir'          { id }                    → { sesion }
//   · 'subir-url'      { nombre, mime, tamano }  → { path, signedUrl }  (el navegador hace PUT del binario
//                                                   a signedUrl con 'x-upsert: true'; molde:
//                                                   app/api/onboarding/archivero/upload-url/route.ts)
//   · 'leer'           { sesionId|null, path, nombre, mime } → { sesion, doc }  (crea la sesión si hace falta;
//                                                   baja el archivo, lo pasa a texto y BORRA el binario)
//   · 'turno'          { sesionId|null, texto, docIds } → { sesion }  (crea la sesión si hace falta)
//   · 'diagnosticar'   { sesionId }              → { ok: true }  (deja el diagnóstico en el borrador)
//   · 'generar'        { sesionId }              → { sesion }  (versión nueva de la conclusión)
//   · 'guardar-oferta' { sesionId }              → { ofertaId, sesion }  (fila NUEVA de `ofertas`)
//   · 'renombrar'      { id, titulo }            → { sesion }
//   · 'borrar'         { id }                    → { ok: true }
//
// ⚠️ GATE: `adminDeWorkspaceActual()`, NO `resolverWsAdmin` — aquél le devuelve el ws1 (de Mauricio, un
//    CLIENTE) al super admin que no está mirando a nadie, y la tab escribiría en la cuenta de otro.
// ⚠️ ANTI-IDOR en 'leer': el `path` lo manda el navegador, así que se exige que sea de ESTE workspace y
//    de esta tab (`<ws>/offer/<uuid>`) antes de bajarlo. Un path ajeno no se baja ni se borra.
// ⚠️ EL BINARIO SE BORRA SIEMPRE, también si la lectura falla: lo que queda es el texto, en la fila.
// ⚠️ UN TURNO QUE FALLA NO GUARDA UN MENSAJE DE MaKo: el cartel de error no es algo que MaKo «dijo»
//    (AGENTS.md «Un cartel de la PLATAFORMA no es un turno de la conversación»). El mensaje del dueño sí
//    queda guardado, y la respuesta de error lleva la sesión para que la pantalla no la pierda.
// =============================================================================

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/supabase';
import { archivoATexto } from '@/lib/archivo-a-texto';
import { MAX_ARCHIVO_BYTES, formatosLegibles, puedeLeerse } from '@/lib/formatos-archivo';
import { marcarPasoTab } from '@/lib/tab-onboarding-state';
import { MARCA_COMPLETAR, faltanMinimas, type ConclusionOferta, type OfferMensaje } from '@/lib/offer-marco';
import {
  MAX_DOCS_SESION, TOPE_TEXTO_DOC, adjuntoDe, alertaFoco, calcularDiagnostico, faltanTexto,
  docsDeLaConversacion, mergePiezas, opcionesConCierre, primerMensaje, recortar, type DocumentoGuardado,
} from '@/lib/offer-reglas';
import { contextoOffer, type ContextoOffer } from '@/lib/offer-contexto';
import { diagnosticoOffer, propuestaOffer, turnoOffer } from '@/lib/offer-ia';
import {
  ErrorOffer, TITULO_DEFAULT, actualizarSesion, borrarSesion, crearSesion, guardarComoOferta, leerFila,
  leerSesion, listarSesionesOffer, vistaDe, type FilaOffer,
} from '@/lib/offer-sesiones';

export const dynamic = 'force-dynamic';
/** Una propuesta larga en la cascada gratis puede tardar 2-3 minutos; los plazos de lib/offer-ia.ts quedan por debajo. */
export const maxDuration = 300;
export const runtime = 'nodejs';

const BUCKET = 'archivero';
/** Lo más largo que se acepta escrito en el chat. Más que eso es un documento, y se sube como tal. */
const TOPE_MENSAJE = 12_000;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ok = (datos: Record<string, unknown> = {}) => Response.json({ ok: true, ...datos });
const no = (status: number, error: string, extra: Record<string, unknown> = {}) => Response.json({ ok: false, error, ...extra }, { status });
const entero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
};
const cadena = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** El paso del onboarding de la tab. Nunca tira: si el catálogo todavía no tiene la tab, se anota y se sigue. */
async function marcar(paso: 'of_contar' | 'of_conclusion'): Promise<void> {
  try { await marcarPasoTab('offer', paso); } catch (e) { console.warn(`[offer:onboarding] no pude marcar ${paso}: ${msg(e)}`); }
}

/** Quién abrió la conversación (sólo para auditar). */
async function quien(): Promise<string | null> {
  const s = await getUsuarioActual().catch(() => null);
  return s ? (s.email || s.sub || null) : null;
}

/** Una conversación nueva, con lo que MaKo ya sabe del negocio y su primer mensaje (sin IA). */
async function sesionNueva(ctx: ContextoOffer, documentos: DocumentoGuardado[] = []): Promise<FilaOffer> {
  return crearSesion({
    piezas: ctx.semilla,
    mensajes: [primerMensaje(ctx.semilla, { hayContexto: !!ctx.texto.trim() })],
    creadoPor: await quien(),
    documentos,
  });
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
        case 'listar':
          return ok({ sesiones: await listarSesionesOffer() });

        case 'abrir': {
          const id = entero(body.id);
          if (!id) return no(400, 'Falta qué conversación abrir.');
          const sesion = await leerSesion(id);
          return sesion ? ok({ sesion }) : no(404, 'No encontré esa conversación. Puede que la hayan borrado.');
        }

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
          return await leer(ws, body);

        case 'turno':
          return await turno(body, inicio);

        case 'diagnosticar': {
          const id = entero(body.sesionId);
          if (!id) return no(400, 'Falta la conversación a diagnosticar.');
          const fila = await leerFila(id);
          if (!fila) return no(404, 'No encontré esa conversación.');
          if (faltanMinimas(fila.piezas).length) return no(409, `Antes de armar la oferta falta: ${faltanTexto(fila.piezas)}. Sigue la conversación con MaKo.`);
          const ctx = await contextoOffer({ conEmbudo: true });
          const ia = await diagnosticoOffer({ mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes), contexto: ctx.texto, embudo: ctx.embudo, inicio });
          if (!ia.ok) return no(502, ia.error);
          const calculo = calcularDiagnostico(ia.valor.dimensiones, { foco: alertaFoco(ctx.foco) });
          const at = new Date().toISOString();
          await actualizarSesion(id, (f) => {
            // Si el dueño escribió mientras MaKo diagnosticaba, este diagnóstico ya no describe la conversación.
            if (f.mensajes.length !== fila.mensajes.length) throw new ErrorOffer('La conversación cambió mientras MaKo la leía. Vuelve a tocar «Armar mi oferta».', 409);
            return { borrador: { diagnostico: ia.valor, calculo, modelo: ia.modelo, at } };
          });
          return ok();
        }

        case 'generar':
          return await generar(body, inicio);

        case 'guardar-oferta': {
          const id = entero(body.sesionId);
          if (!id) return no(400, 'Falta la conversación a guardar.');
          const { ofertaId, fila } = await guardarComoOferta(id);
          return ok({ ofertaId, sesion: vistaDe(fila) });
        }

        case 'renombrar': {
          const id = entero(body.id);
          const titulo = cadena(body.titulo).replace(/\s+/g, ' ');
          if (!id) return no(400, 'Falta qué conversación renombrar.');
          if (!titulo) return no(400, 'Escribe un nombre.');
          const fila = await actualizarSesion(id, () => ({ titulo: titulo.slice(0, 80) }));
          return ok({ sesion: vistaDe(fila) });
        }

        case 'borrar': {
          const id = entero(body.id);
          if (!id) return no(400, 'Falta qué conversación borrar.');
          return (await borrarSesion(id)) ? ok() : no(404, 'No encontré esa conversación. Puede que ya la hayan borrado.');
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
  listar: 'listar tus conversaciones', abrir: 'abrir la conversación', 'subir-url': 'preparar la subida',
  leer: 'leer el documento', turno: 'guardar tu mensaje', diagnosticar: 'diagnosticar la oferta',
  generar: 'armar la oferta', 'guardar-oferta': 'guardar la oferta', renombrar: 'renombrar la conversación',
  borrar: 'borrar la conversación',
};

// ── leer ─────────────────────────────────────────────────────────────────────

async function leer(ws: number, body: Record<string, unknown>): Promise<Response> {
  const path = cadena(body.path);
  const nombre = cadena(body.nombre).slice(0, 200) || 'documento';
  const mime = cadena(body.mime);
  // El path lo escribe el navegador: sólo uno de ESTE workspace y de esta tab. Uno ajeno no se toca.
  if (!new RegExp(`^${ws}/offer/[0-9a-f-]{36}$`).test(path)) return no(400, 'Ese archivo no es de esta cuenta. Vuelve a subirlo.');
  const storage = getSupabaseServer().storage.from(BUCKET);
  try {
    const sesionId = body.sesionId == null ? null : entero(body.sesionId);
    if (body.sesionId != null && !sesionId) return no(400, 'La conversación no es válida.');
    if (sesionId) {
      const fila = await leerFila(sesionId);
      if (!fila) return no(404, 'No encontré esa conversación.');
      if (fila.documentos.length >= MAX_DOCS_SESION) return no(409, `Esta conversación ya tiene ${MAX_DOCS_SESION} documentos. Empieza otra para subir más.`);
    }
    const { data, error } = await storage.download(path);
    if (error || !data) return no(400, `No encontré «${nombre}» en la subida. Vuelve a subirlo.`);
    const file = new File([await data.arrayBuffer()], nombre, { type: mime || data.type || '' });
    const lectura = await archivoATexto(file, { feature: 'offer', motivo: `Offer: leer «${nombre}»` });
    const texto = (lectura.texto ?? '').trim();
    if (!texto) return no(422, lectura.warning || `No pude sacar texto de «${nombre}». Si es una foto o un escaneo borroso, prueba con otra versión o pega el texto en el chat.`);
    const recortado = texto.length > TOPE_TEXTO_DOC;
    const doc: DocumentoGuardado = {
      id: randomUUID(), nombre, via: lectura.via, texto: texto.slice(0, TOPE_TEXTO_DOC), chars: texto.length,
      ...(lectura.warning ? { aviso: recortar(lectura.warning, 200) } : recortado ? { aviso: `Leí sólo el principio (${TOPE_TEXTO_DOC.toLocaleString('es-MX')} de ${texto.length.toLocaleString('es-MX')} caracteres).` } : {}),
      at: new Date().toISOString(),
    };
    const fila = sesionId
      ? await actualizarSesion(sesionId, (f) => {
        if (f.documentos.length >= MAX_DOCS_SESION) throw new ErrorOffer(`Esta conversación ya tiene ${MAX_DOCS_SESION} documentos. Empieza otra para subir más.`, 409);
        return { documentos: [...f.documentos, doc] };
      })
      : await sesionNueva(await contextoOffer(), [doc]);
    return ok({ sesion: vistaDe(fila), doc: adjuntoDe(doc) });
  } finally {
    // SIEMPRE, también si algo de arriba tiró: el binario no se guarda (lo que queda es el texto).
    const { error } = await storage.remove([path]).catch((e) => ({ error: { message: msg(e) } }));
    if (error) console.warn(`[offer:leer] no pude borrar ${path}: ${error.message}`);
  }
}

// ── turno ────────────────────────────────────────────────────────────────────

async function turno(body: Record<string, unknown>, inicio: number): Promise<Response> {
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  const docIds = Array.isArray(body.docIds) ? [...new Set(body.docIds.filter((x): x is string => typeof x === 'string' && !!x.trim()))].slice(0, MAX_DOCS_SESION) : [];
  // REINTENTAR: si la IA falló, el mensaje del dueño YA quedó guardado (paso 1) y el
  // 502 devolvió la sesión. Volver a mandar el texto lo duplicaría en la conversación
  // (y, en una conversación nueva, crearía otra sesión). Con `reintentar` se corre la
  // IA sobre lo guardado, sin agregar nada.
  const reintentar = body.reintentar === true && body.sesionId != null;
  if (reintentar) return reintentarTurno(body, inicio);
  if (!texto && !docIds.length) return no(400, 'Escribe algo o adjunta un documento.');
  if (texto.length > TOPE_MENSAJE) return no(413, 'El mensaje es muy largo para el chat. Súbelo como documento y MaKo lo lee entero.');
  const sesionIdRaw = body.sesionId == null ? null : entero(body.sesionId);
  if (body.sesionId != null && !sesionIdRaw) return no(400, 'La conversación no es válida.');
  if (!sesionIdRaw && docIds.length) return no(400, 'Los documentos van con una conversación. Recarga la página y vuelve a intentarlo.');

  let ctx: ContextoOffer | null = null;
  let id = sesionIdRaw;
  if (!id) {
    ctx = await contextoOffer();
    id = (await sesionNueva(ctx)).id;
  }
  const sesionId = id;

  // 1) El mensaje del dueño se guarda YA: si la IA falla, lo que escribió no se pierde.
  // Una caja y no un let: TypeScript no ve la asignación adentro del callback y la daría por false.
  const primero = { era: false };
  const conMensaje = await actualizarSesion(sesionId, (f) => {
    const porId = new Map(f.documentos.map((d) => [d.id, d] as const));
    const faltan = docIds.filter((d) => !porId.has(d));
    if (faltan.length) throw new ErrorOffer('Uno de los documentos ya no está en esta conversación. Vuelve a subirlo.', 400);
    primero.era = !f.mensajes.some((m) => m.de === 'yo');
    const adjuntos = docIds.map((d) => adjuntoDe(porId.get(d) as DocumentoGuardado));
    const m: OfferMensaje = { id: randomUUID(), de: 'yo', texto, at: new Date().toISOString(), ...(adjuntos.length ? { adjuntos } : {}) };
    // Un mensaje nuevo vacía el borrador: un diagnóstico de la conversación de antes ya no la describe.
    return { mensajes: [...f.mensajes, m], borrador: null };
  });
  if (primero.era) await marcar('of_contar');

  // 2) La respuesta de MaKo.
  ctx = ctx ?? (await contextoOffer());
  const ia = await turnoOffer({
    mensajes: conMensaje.mensajes, piezas: conMensaje.piezas, docs: docsDeLaConversacion(conMensaje.documentos, conMensaje.mensajes, docIds), nuevos: docIds,
    contexto: ctx.texto, inicio,
  });
  if (!ia.ok) return no(502, ia.error, { sesion: vistaDe(conMensaje) });

  // 3) Se agrega a la fila de ESTE momento (CAS): las piezas se funden con las que haya ahora.
  //    La fuente es 'doc' si el turno trajo documentos: de ahí sale casi todo lo que se anota en él.
  const fuente = docIds.length ? 'doc' : 'chat';
  const final = await actualizarSesion(sesionId, (f) => {
    const piezas = mergePiezas(f.piezas, ia.valor.piezas, fuente);
    const opciones = opcionesConCierre(ia.valor.opciones, faltanMinimas(piezas).length === 0);
    const m: OfferMensaje = { id: randomUUID(), de: 'mako', texto: ia.valor.respuesta, at: new Date().toISOString(), ...(opciones.length ? { opciones } : {}) };
    return { mensajes: [...f.mensajes, m], piezas };
  });
  return ok({ sesion: vistaDe(final) });
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
  if (!ultimo || ultimo.de !== 'yo') return ok({ sesion: vistaDe(fila) });
  const nuevos = (ultimo.adjuntos ?? []).map((a) => a.id);
  const ctx = await contextoOffer();
  const ia = await turnoOffer({
    mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes, nuevos), nuevos,
    contexto: ctx.texto, inicio,
  });
  if (!ia.ok) return no(502, ia.error, { sesion: vistaDe(fila) });
  const fuente = nuevos.length ? 'doc' : 'chat';
  const final = await actualizarSesion(sesionId, (f) => {
    // Si mientras tanto llegó otra respuesta de MaKo, no se agrega una segunda.
    const u = f.mensajes[f.mensajes.length - 1];
    if (!u || u.de !== 'yo') return null;
    const piezas = mergePiezas(f.piezas, ia.valor.piezas, fuente);
    const opciones = opcionesConCierre(ia.valor.opciones, faltanMinimas(piezas).length === 0);
    const m: OfferMensaje = { id: randomUUID(), de: 'mako', texto: ia.valor.respuesta, at: new Date().toISOString(), ...(opciones.length ? { opciones } : {}) };
    return { mensajes: [...f.mensajes, m], piezas };
  });
  return ok({ sesion: vistaDe(final) });
}

// ── generar ──────────────────────────────────────────────────────────────────

async function generar(body: Record<string, unknown>, inicio: number): Promise<Response> {
  const id = entero(body.sesionId);
  if (!id) return no(400, 'Falta la conversación.');
  const fila = await leerFila(id);
  if (!fila) return no(404, 'No encontré esa conversación.');
  const borrador = fila.borrador;
  if (!borrador) return no(409, 'Falta el diagnóstico de esta conversación. Vuelve a tocar «Armar mi oferta».');
  const ctx = await contextoOffer();
  const ia = await propuestaOffer({
    mensajes: fila.mensajes, piezas: fila.piezas, docs: docsDeLaConversacion(fila.documentos, fila.mensajes), contexto: ctx.texto,
    diagnostico: borrador.diagnostico, calculo: borrador.calculo, inicio,
  });
  if (!ia.ok) return no(502, ia.error);
  const nombre = ia.valor.nombre.trim();
  const final = await actualizarSesion(id, (f) => {
    if (!f.borrador || f.borrador.at !== borrador.at) {
      throw new ErrorOffer('La conversación cambió mientras MaKo armaba la oferta. Vuelve a tocar «Armar mi oferta».', 409);
    }
    const version = f.conclusiones.reduce((max, c) => Math.max(max, c.version), 0) + 1;
    const conclusion: ConclusionOferta = {
      diagnostico: borrador.diagnostico,
      calculo: borrador.calculo,
      propuesta: ia.valor,
      version,
      at: new Date().toISOString(),
      modelo: borrador.modelo === ia.modelo ? ia.modelo : `diagnóstico: ${borrador.modelo} · oferta: ${ia.modelo}`,
    };
    // La conversación toma el nombre de la oferta la primera vez, si nadie la renombró a mano.
    const titulo = f.titulo === TITULO_DEFAULT && nombre && !nombre.includes(MARCA_COMPLETAR) ? nombre.slice(0, 80) : undefined;
    return { conclusiones: [...f.conclusiones, conclusion], estado: 'concluida', borrador: null, ...(titulo ? { titulo } : {}) };
  });
  await marcar('of_conclusion');
  return ok({ sesion: vistaDe(final) });
}
