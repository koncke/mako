// =============================================================================
// grabar-llamada — la llamada que se graba DESDE MaKo: guardarla, transcribirla y analizarla
// =============================================================================
// Pedido de Martín (04/11/2026): «quiero que implementes el botón de "grabar" en el detail de un lead y en un dashboard
// template que sea "Call Calling"». La pantalla graba en partes de 3 minutos (lib/grabar-llamada-reglas.ts) y las manda a
// /api/crm/llamadas-grabadas apenas se cierran; acá se guardan en el bucket privado, cada una se transcribe POR SU LADO con la IA
// del negocio, y cuando llegaron todas, el Closing la analiza para ESE lead (lib/closing.ts → `analizarReunionDeLead`). El
// análisis queda en `closing_analyses` con `lead_id`: lo ven la ficha («Lo que salió de la llamada»), el Dashboard y la API.
//
// Lo que no se ve en la firma:
//   · LA IA LA PAGA EL NEGOCIO, y sin ella NO se pierde nada: la transcripción usa SU cuenta (`transcribirAudio` con `pii`: es la
//     voz de un cliente, no va a ninguna IA gratis que entrene) y el análisis SU Claude. Sin la primera queda `sin_ia` con el
//     audio guardado; sin la segunda queda `lista` con la transcripción y la frase de qué falta. Las dos se pueden reintentar.
//   · TODO CORRE ADENTRO de `runWithWorkspace` (y, desde la ruta, de `conSuIADelNegocio`): lo de fondo (`after()`) no tiene por
//     qué ver las cookies, y el Closing escribe con `getTenantDb()`.
//   · DOS ESCRITORES, DOS FILAS: cada parte escribe SU transcripción en SU fila (`llamadas_grabadas_partes`). El análisis lo toma
//     UNO solo, con compare-and-set del estado (transcribiendo → analizando): la última parte y el «Terminar» llegan casi juntos.
//   · SIN LAS TABLAS (la migración 0390 sin aplicar) no se graba: `SinTablaError` dice que la grabación todavía no está lista acá.
// =============================================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { getTenantDb, runWithWorkspace } from './workspace';
import {
  MAX_PARTES, SIN_CLAUDE_PARA_ANALIZAR, SIN_IA_PARA_TRANSCRIBIR, TOPE_BYTES_PARTE, claveDeGrabacion, esIdGrabacion, esResultado,
  mimeDeBytes, queSigue, reunionDeGrabacion, rutaDeParte, sePuedeReintentar,
  type EstadoGrabacion, type FilaGrabacion, type FuenteAudio, type OrigenGrabacion, type ParteGuardada, type ResultadoLlamada,
} from './grabar-llamada-reglas';

export const BUCKET_LLAMADAS = 'llamadas-grabadas';
const TABLA = 'llamadas_grabadas';
const PARTES = 'llamadas_grabadas_partes';

/** La migración 0390 todavía no está en este negocio: no se graba (se dice, no se rompe). */
export class SinTablaError extends Error {
  constructor() { super('La grabación de llamadas todavía no está lista en tu cuenta. Avísanos y la activamos.'); }
}
const faltaTabla = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/llamadas_grabadas/.test(e.message ?? '') && /does not exist|not find/i.test(e.message ?? '')));
const fallo = (que: string, e: { code?: string; message?: string } | null | undefined): Error =>
  (faltaTabla(e) ? new SinTablaError() : new Error(`${que}: ${e?.message ?? 'sin respuesta'}`));

const ahora = () => new Date().toISOString();

export type GrabacionDeLead = FilaGrabacion & {
  fuente: FuenteAudio; resultado: ResultadoLlamada | null; motivo: string | null; transcribio: string | null; clave: number | null;
  /** Las partes, en orden, con su URL firmada (10 min) para escucharlas y su texto. */
  partes: Array<{ n: number; inicio_seg: number; segundos: number | null; estado: ParteGuardada['estado']; texto: string | null; url: string | null }>;
};

// ── Crear ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** ¿El lead es de ESTE negocio? (getTenantDb pone el workspace en un insert, no comprueba que el lead sea de ahí: AGENTS.md). */
async function leadDelNegocio(leadId: number): Promise<{ id: number; nombre: string } | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`leads: ${error.message}`);
  return data ? { id: Number((data as { id: number }).id), nombre: String((data as { nombre?: string }).nombre ?? '') } : null;
}

export async function crearGrabacion(o: {
  ws: number; leadId: number; origen: OrigenGrabacion; fuente: FuenteAudio; mime: string; usuarioId: number | null; autor: string | null;
}): Promise<{ id: string } | { error: string; status: number }> {
  if (!(await leadDelNegocio(o.leadId))) return { error: 'No encuentro ese lead.', status: 404 };
  const db = await getTenantDb();
  // El id lo pone el server para escribir la clave del Closing EN LA MISMA escritura (es la que ata el análisis a ESTA llamada).
  const id = randomUUID();
  const { error } = await db.from(TABLA).insert({
    id, lead_id: o.leadId, origen: o.origen, fuente: o.fuente, mime: o.mime.slice(0, 80), clave: claveDeGrabacion(id),
    usuario_id: o.usuarioId, autor: o.autor?.slice(0, 120) ?? null, estado: 'grabando',
  });
  if (error) throw fallo('No pude empezar la grabación', error);
  return { id };
}

async function filaDe(id: string): Promise<(FilaGrabacion & { partes_total: number | null; clave: number | null; motivo: string | null }) | null> {
  if (!esIdGrabacion(id)) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA)
    .select('id, lead_id, origen, autor, estado, duracion_seg, created_at, terminada_at, partes_total, clave, motivo')
    .eq('id', id).maybeSingle();
  if (error) throw fallo('No pude leer la grabación', error);
  return (data as never) ?? null;
}

// ── Las partes ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Guarda UNA parte: el archivo al bucket y su fila (`pendiente`). Idempotente por número: un reintento de la subida pisa el
 * mismo archivo y la misma fila. Devuelve `null` si quedó guardada; si no, el motivo para la pantalla.
 */
export async function guardarParte(o: {
  ws: number; grabacionId: string; n: number; bytes: Uint8Array; inicioSeg: number; segundos: number | null;
}): Promise<{ error: string; status: number } | null> {
  const f = await filaDe(o.grabacionId);
  if (!f) return { error: 'No encuentro esa grabación.', status: 404 };
  if (!Number.isInteger(o.n) || o.n < 0 || o.n >= MAX_PARTES) return { error: 'La grabación es demasiado larga (2 horas como mucho).', status: 400 };
  if (o.bytes.length === 0) return { error: 'Llegó una parte vacía.', status: 400 };
  if (o.bytes.length > TOPE_BYTES_PARTE) return { error: 'Llegó una parte demasiado pesada.', status: 413 };
  const mime = mimeDeBytes(o.bytes);
  if (!mime) return { error: 'Eso no es un audio que MaKo sepa guardar.', status: 400 };
  const ruta = rutaDeParte(o.ws, o.grabacionId, o.n, mime);
  if (!ruta) return { error: 'Pedido inválido.', status: 400 };
  const { error: eSubir } = await getSupabaseServer().storage.from(BUCKET_LLAMADAS).upload(ruta, o.bytes, { contentType: mime, upsert: true });
  if (eSubir) throw new Error(`No pude guardar el audio: ${eSubir.message}`);
  const db = await getTenantDb();
  const { error } = await db.from(PARTES).upsert({
    grabacion_id: o.grabacionId.toLowerCase(), n: o.n, ruta, mime, bytes: o.bytes.length,
    inicio_seg: Math.max(0, Math.floor(o.inicioSeg)), segundos: o.segundos == null ? null : Math.max(0, Math.round(o.segundos)),
    estado: 'pendiente', texto: null, motivo: null, updated_at: ahora(),
  }, { onConflict: 'grabacion_id,n' });
  if (error) throw fallo('No pude guardar la parte', error);
  return null;
}

async function partesDe(grabacionId: string): Promise<Array<ParteGuardada & { ruta: string; mime: string }>> {
  const db = await getTenantDb();
  const { data, error } = await db.from(PARTES)
    .select('n, inicio_seg, segundos, estado, texto, motivo, ruta, mime')
    .eq('grabacion_id', grabacionId.toLowerCase())
    .order('n', { ascending: true });
  if (error) throw fallo('No pude leer las partes', error);
  return (data ?? []) as never;
}

/**
 * Transcribe UNA parte con la IA del negocio y escribe el resultado en SU fila. No tira: lo que no se pudo queda en la fila
 * (`sin_ia` si no hay con qué, `error` si la IA no contestó), y se puede reintentar.
 */
export async function transcribirParte(grabacionId: string, n: number): Promise<void> {
  const db = await getTenantDb();
  const p = (await partesDe(grabacionId)).find((x) => x.n === n);
  if (!p || p.estado === 'lista') return;
  let estado: ParteGuardada['estado'] = 'lista';
  let texto: string | null = null;
  let motivo: string | null = null;
  let quien: string | null = null;
  try {
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_LLAMADAS).download(p.ruta);
    if (error || !data) throw new Error(`No pude leer el audio: ${error?.message ?? 'vacío'}`);
    const b64 = Buffer.from(await data.arrayBuffer()).toString('base64');
    const { transcribirAudio, SttSinEscucha } = await import('./ai-cheap');
    try {
      texto = (await transcribirAudio(b64, p.mime, {
        language: 'es', feature: 'Llamada grabada · transcribir', motivo: 'Transcribir una llamada grabada en MaKo',
        // La voz de un cliente del negocio: con SU IA, nunca con una gratis que entrena (AGENTS.md).
        pii: true, alEscuchar: (q) => { quien = q; },
      })).trim();
    } catch (e) {
      // Sin ninguna IA que escuche (ni una clave del negocio): el audio queda y se dice qué falta.
      if (e instanceof SttSinEscucha && e.errores.length === 0) { estado = 'sin_ia'; motivo = SIN_IA_PARA_TRANSCRIBIR; }
      else { estado = 'error'; motivo = 'La IA no pudo transcribir el audio. Vuelve a intentarlo.'; }
      console.error(`[grabar-llamada] parte ${n} de ${grabacionId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  } catch (e) {
    estado = 'error';
    motivo = 'No pude leer el audio guardado. Vuelve a intentarlo.';
    console.error(`[grabar-llamada] parte ${n} de ${grabacionId}: ${e instanceof Error ? e.message : String(e)}`);
  }
  await db.from(PARTES).update({ estado, texto, motivo, updated_at: ahora() }).eq('grabacion_id', grabacionId.toLowerCase()).eq('n', n);
  if (quien) await db.from(TABLA).update({ transcribio: String(quien).slice(0, 80) }).eq('id', grabacionId.toLowerCase());
}

// ── Terminar y analizar ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Al cortar: cuántas partes mandó la pantalla, cuánto duró y cómo terminó. Pasa a `transcribiendo`. */
export async function terminarGrabacion(o: { grabacionId: string; partesTotal: number; duracionSeg: number; resultado: ResultadoLlamada | null }): Promise<{ error: string; status: number } | null> {
  const f = await filaDe(o.grabacionId);
  if (!f) return { error: 'No encuentro esa grabación.', status: 404 };
  if (!Number.isInteger(o.partesTotal) || o.partesTotal < 0 || o.partesTotal > MAX_PARTES) return { error: 'Pedido inválido.', status: 400 };
  const db = await getTenantDb();
  const { error } = await db.from(TABLA).update({
    partes_total: o.partesTotal, duracion_seg: Math.max(0, Math.round(o.duracionSeg)),
    ...(o.resultado ? { resultado: o.resultado } : {}),
    estado: f.estado === 'grabando' ? 'transcribiendo' : f.estado, terminada_at: f.terminada_at ?? ahora(), updated_at: ahora(),
  }).eq('id', o.grabacionId.toLowerCase());
  if (error) throw fallo('No pude cerrar la grabación', error);
  return null;
}

export async function marcarResultado(grabacionId: string, resultado: ResultadoLlamada | null): Promise<boolean> {
  if (resultado != null && !esResultado(resultado)) return false;
  if (!(await filaDe(grabacionId))) return false;
  const db = await getTenantDb();
  const { error } = await db.from(TABLA).update({ resultado, updated_at: ahora() }).eq('id', grabacionId.toLowerCase());
  if (error) throw fallo('No pude guardar cómo terminó', error);
  return true;
}

/** Cambia el estado SÓLO si sigue en `desde` (compare-and-set). true = lo tomó esta corrida. */
async function tomar(id: string, desde: EstadoGrabacion, a: EstadoGrabacion, extra: Record<string, unknown> = {}): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA).update({ estado: a, updated_at: ahora(), ...extra }).eq('id', id).eq('estado', desde).select('id');
  if (error) throw fallo('No pude actualizar la grabación', error);
  return (data ?? []).length > 0;
}

/**
 * Si la llamada terminó y todas sus partes se transcribieron, la analiza (UNA vez: la toma con compare-and-set). Si alguna parte
 * se trabó, la llamada queda con ese motivo. No tira.
 */
export async function quizasAnalizar(grabacionId: string): Promise<void> {
  const id = grabacionId.toLowerCase();
  try {
    const f = await filaDe(id);
    if (!f || f.estado !== 'transcribiendo') return;
    const partes = await partesDe(id);
    const sigue = queSigue(partes, f.partes_total);
    if (sigue.tipo === 'esperar') return;
    if (sigue.tipo === 'trabada') { await tomar(id, 'transcribiendo', sigue.sinIa ? 'sin_ia' : 'error', { motivo: sigue.motivo }); return; }
    if (sigue.vacia) { await tomar(id, 'transcribiendo', 'lista', { motivo: 'No se oyó ninguna voz en la grabación.' }); return; }
    if (!(await tomar(id, 'transcribiendo', 'analizando', { motivo: null }))) return;
    const { analizarReunionDeLead, conQueAnalizaElClosing } = await import('./closing');
    const con = await conQueAnalizaElClosing();
    if (con === 'no') { await tomar(id, 'analizando', 'lista', { motivo: SIN_CLAUDE_PARA_ANALIZAR }); return; }
    if (con === 'no-se') { await tomar(id, 'analizando', 'error', { motivo: 'No pude comprobar tu Claude. Vuelve a intentarlo.' }); return; }
    const reunion = reunionDeGrabacion(f, partes);
    await anotarClave(reunion.clave, id, reunion.titulo, reunion.inicio);
    const r = await analizarReunionDeLead(reunion, f.lead_id);
    if (r.suCuenta || r.status === 'error') {
      await tomar(id, 'analizando', 'error', { motivo: r.suCuenta ? 'Tu Claude no pudo analizar la llamada. Revisa tu clave y vuelve a intentarlo.' : 'El análisis falló. Vuelve a intentarlo.' });
      return;
    }
    await tomar(id, 'analizando', 'lista', { motivo: null });
  } catch (e) {
    console.error(`[grabar-llamada] analizar ${id}: ${e instanceof Error ? e.message : String(e)}`);
    // Lo que se cortó a mitad no vuelve a «transcribiendo» solo: queda en error con su «Volver a intentar».
    await tomar(id, 'analizando', 'error', { motivo: 'El análisis se cortó. Vuelve a intentarlo.' }).catch(() => false);
  }
}

/** La clave de la llamada → esta grabación (tabla `grabador_reuniones`): lo que deja al Closing volver a abrirla por su número. */
async function anotarClave(clave: number, id: string, titulo: string, inicio: string | null): Promise<void> {
  try {
    const db = await getTenantDb();
    await db.from('grabador_reuniones').upsert({ clave, grabador: 'grabadora', grabacion_id: id, titulo, inicio }, { onConflict: 'workspace_id,clave', ignoreDuplicates: true });
  } catch { /* best-effort: la fila del Closing ya lleva la clave y el lead */ }
}

/**
 * Lo de fondo de una grabación: transcribir lo que falta (o lo que se trabó, si `reintentar`) y, si ya está todo, analizarla.
 * Corre en el workspace de la grabación, también desde `after()`.
 */
export async function procesarGrabacion(ws: number, grabacionId: string, o: { reintentar?: boolean; soloParte?: number } = {}): Promise<void> {
  await runWithWorkspace(ws, async () => {
    const id = grabacionId.toLowerCase();
    const f = await filaDe(id);
    if (!f) return;
    if (o.reintentar) {
      // Lo trabado, y una llamada que quedó sin análisis porque faltaba su Claude. Nunca una analizada: se pagaría otra vez.
      if (!sePuedeReintentar(f.estado) && !(f.estado === 'lista' && f.motivo === SIN_CLAUDE_PARA_ANALIZAR)) return;
      // Lo trabado vuelve a la cola: las partes que no se transcribieron, y la llamada a «transcribiendo».
      const db = await getTenantDb();
      await db.from(PARTES).update({ estado: 'pendiente', motivo: null, updated_at: ahora() }).eq('grabacion_id', id).in('estado', ['sin_ia', 'error']);
      await db.from(TABLA).update({ estado: 'transcribiendo', motivo: null, updated_at: ahora() }).eq('id', id).in('estado', ['sin_ia', 'error', 'lista']);
    }
    const partes = await partesDe(id);
    const pendientes = partes.filter((p) => p.estado === 'pendiente' && (o.soloParte == null || p.n === o.soloParte));
    // De a una: la cuota de la IA del negocio es por minuto, y varias partes a la vez la llenan.
    for (const p of pendientes) await transcribirParte(id, p.n);
    await quizasAnalizar(id);
  });
}

// ── Leer ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Las grabaciones de UN lead, la más nueva primero, con las URLs firmadas de su audio (10 minutos). */
export async function grabacionesDeLead(leadId: number, o: { conAudio?: boolean } = {}): Promise<GrabacionDeLead[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from(TABLA)
    .select('id, lead_id, origen, autor, estado, fuente, duracion_seg, resultado, motivo, transcribio, clave, created_at, terminada_at')
    .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50);
  if (error) { if (faltaTabla(error)) return []; throw new Error(`No pude leer las grabaciones: ${error.message}`); }
  const filas = (data ?? []) as Array<Omit<GrabacionDeLead, 'partes'>>;
  if (!filas.length) return [];
  const { data: ps, error: e2 } = await db.from(PARTES)
    .select('grabacion_id, n, inicio_seg, segundos, estado, texto, ruta')
    .in('grabacion_id', filas.map((f) => f.id)).order('n', { ascending: true });
  if (e2) throw new Error(`No pude leer las partes: ${e2.message}`);
  const partes = (ps ?? []) as Array<{ grabacion_id: string; n: number; inicio_seg: number; segundos: number | null; estado: ParteGuardada['estado']; texto: string | null; ruta: string }>;
  const urls = new Map<string, string>();
  if (o.conAudio !== false && partes.length) {
    const { data: firmadas } = await getSupabaseServer().storage.from(BUCKET_LLAMADAS).createSignedUrls(partes.map((p) => p.ruta), 600);
    for (const x of firmadas ?? []) if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl);
  }
  return filas.map((f) => ({
    ...f,
    partes: partes.filter((p) => p.grabacion_id === f.id).map((p) => ({ n: p.n, inicio_seg: p.inicio_seg, segundos: p.segundos, estado: p.estado, texto: p.texto, url: urls.get(p.ruta) ?? null })),
  }));
}

/** La llamada de una grabación como reunión (lo que pide el Closing por su clave): lib/grabadores/grabadora.ts. */
export async function reunionDeId(grabacionId: string) {
  const f = await filaDe(grabacionId);
  if (!f) return null;
  return reunionDeGrabacion(f, await partesDe(grabacionId));
}
