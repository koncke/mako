// =============================================================================
// llamadas-modelo — lo que la hoja Closing sabe de una llamada, sin React y sin server
// =============================================================================
// Martín, 11/10/2026: Closing Analyst va COMPLETO al Dashboard y la tab se elimina. Lo que la tab hacía
// adentro de sus componentes (app/closing/ClosingBrowser.tsx: el nombre de una llamada, la búsqueda y el
// orden de la lista, el reproductor de Fathom, el salto al segundo, las marcas del transcript, el puntaje
// que se recalcula al revisar) vive acá, PURO, para que tenga test y para que el nombre de una llamada sea
// UNO en la lista, en el detalle de un número y en la ficha.
//
// Lo usan: el bloque «Las llamadas» (./BloquesClosing.tsx), la ficha (./FichaLlamada.tsx), el lector del
// conjunto `llamadas_venta` (lib/graficos-datos-extra.ts), el del bloque (lib/graficos-bloques-extra.ts) y
// GET /api/closing/llamada (`fichaDe`).
//
// ⚠️ Sin 'use client' (lo importa el server) y sin server-only (lo importan la pantalla y los tests). Los
//    tipos de lib/closing.ts entran con `import type`, que se borra al compilar.

import type { ClosingAnalysisRow, ClosingAnnotation, ClosingDim, DimGroup, Tone } from '@/lib/closing';
import type { FilaLlamada } from '@/lib/graficos-bloques-extra-catalogo';
import { embedDe } from '@/lib/embeds';

// ── Cuánto se espera a cada ruta ─────────────────────────────────────────────────────────

/**
 * El tope de cada pedido de la ficha y del bloque: el `maxDuration` de su ruta más un margen. Un tope que
 * vive en la RUTA no protege a la pantalla (AGENTS.md): sin `signal`, una conexión caída deja el giro para
 * siempre. tests/graficos-closing.test.ts lee el `maxDuration` de cada ruta y exige que esto lo supere.
 */
export const TOPE_MS = {
  /** GET /api/closing/llamada (maxDuration 30): una fila de closing_analyses. */
  llamada: 35_000,
  /** GET /api/closing/transcript (30): el transcript se baja de Fathom EN VIVO. */
  transcript: 35_000,
  /** POST /api/closing/analyze (120): barre Fathom y vuelve a correr el análisis con IA. */
  analizar: 125_000,
  /** POST /api/closing/revise (120): «Re-evaluar con MaKo» es otra corrida con IA. */
  revisar: 125_000,
  /** POST /api/closing/sync (300): trae y analiza las llamadas nuevas. */
  sincronizar: 305_000,
} as const;

export type ResultadoTarea = { ok: true; j: Record<string, unknown> } | { ok: false; error: string };
/**
 * Una TAREA de Closing (sincronizar, re-analizar, revisar): POST con su tope. Las rutas contestan
 * `{ ok, error }` (app/api/closing/*); un `ok: false` trae el motivo tal cual, que dice qué arreglar.
 * ⚠️ Vencido el tope NO se afirma que falló: el server puede haber terminado igual (la respuesta es lo que
 * se perdió), y eso es lo que dice el mensaje.
 */
export async function postearTarea(url: string, cuerpo: unknown, topeMs: number): Promise<ResultadoTarea> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo ?? {}), signal: AbortSignal.timeout(topeMs) });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!r.ok || !j || j.ok !== true) return { ok: false, error: (j && typeof j.error === 'string' && j.error.trim()) || `No se pudo (error ${r.status})` };
    return { ok: true, j };
  } catch (e) {
    const nombre = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '';
    return nombre === 'TimeoutError' || nombre === 'AbortError'
      ? { ok: false, error: 'Tardó demasiado. Puede que haya terminado igual: revísalo en unos minutos.' }
      : { ok: false, error: 'Sin conexión con MaKo. Prueba de nuevo.' };
  }
}

// ── El nombre, los formatos y los colores ────────────────────────────────────────────────

const limpio = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

/** Cómo se nombra una llamada (el `callName` de la tab): el lead, si no el email del invitado, si no el título. */
export function nombreDeLlamada(c: { lead_nombre?: string | null; invitee_email?: string | null; title?: string | null }): string | null {
  return limpio(c.lead_nombre) ?? limpio(c.invitee_email) ?? limpio(c.title)?.slice(0, 80) ?? null;
}

/** El puntaje con un decimal siempre («7.0», «6.5»), como lo escribía la tab. */
export const fmtPuntaje = (s: number | null | undefined): string => {
  if (s == null || !Number.isFinite(s)) return '—';
  const r = Math.round(s * 10) / 10;
  return Number.isInteger(r) ? `${r}.0` : String(r);
};
export const fechaDdMm = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}` : '—';
};
export const enMinutos = (m: number | null | undefined): string => (m == null ? '—' : `${m} min`);
export function mmss(seg: number | null | undefined): string {
  const s = Math.max(0, Math.round(seg ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const TONO_ROTULO: Record<Tone, string> = { good: 'Ganada', warn: 'En proceso', bad: 'Perdida' };
/** El color de un desenlace, con los tokens de la app (se dan vuelta en el tema oscuro). */
export const colorDeTono = (t: string | null | undefined): string => (t === 'good' ? 'var(--good)' : t === 'bad' ? 'var(--bad)' : 'var(--warn)');
export const GRUPOS_DIM: ReadonlyArray<{ key: DimGroup; label: string }> = [
  { key: 'spin', label: 'Método SPIN' },
  { key: 'exec', label: 'Ejecución de venta' },
];
export function promedio(xs: ReadonlyArray<number | null | undefined>): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}
/** El resumen partido en su primera frase (la que va grande) y el resto. */
export function partirResumen(s: string | null | undefined): { primera: string; resto: string } {
  const t = (s ?? '').trim();
  const partes = t.split(/(?<=[.!?])\s+/);
  return { primera: partes[0] ?? '', resto: partes.slice(1).join(' ') };
}

// ── Fathom: el reproductor y el salto a un segundo ───────────────────────────────────────

const TOKEN = /^[A-Za-z0-9_-]{4,200}$/;
export const esLinkHttp = (u: unknown): u is string => {
  if (typeof u !== 'string' || !u) return false;
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:'; } catch { return false; }
};

/**
 * El token de la grabación: el guardado, si no el del link de Compartir (`/share/<token>`). Va ADENTRO de
 * una URL (el embed y la miniatura), así que sólo pasa si son letras, números, `-` o `_`.
 */
export function tokenFathom(shareUrl: string | null | undefined, embedToken: string | null | undefined): string | null {
  const t = limpio(embedToken) ?? limpio(shareUrl)?.match(/\/share\/([^/?#]+)/)?.[1] ?? null;
  return t && TOKEN.test(t) ? t : null;
}

/**
 * Lo que dibuja el reproductor de la ficha: el iframe y la miniatura, los DOS del mismo token (si salieran de
 * dos lados, la foto y el video podrían ser de dos grabaciones). El token sale de `embedDe` (lib/embeds.ts),
 * que reconoce las formas del link de Fathom (/share/, /embed/, con o sin www); si no lo reconoce, el que
 * guardó el análisis, como lo hacía la tab. La URL la arma esto con el token ya limpio.
 * ⚠️ En un iframe sólo entra el /embed/: el link de Compartir (/share/) manda X-Frame-Options SAMEORIGIN.
 */
export function reproductorFathom(shareUrl: string | null | undefined, embedToken: string | null | undefined): { src: string; miniatura: string } | null {
  const e = typeof shareUrl === 'string' && shareUrl ? embedDe(shareUrl) : null;
  const delEmbed = e?.src.match(/^https:\/\/fathom\.video\/embed\/([^/?#]+)/)?.[1] ?? null;
  const token = delEmbed && TOKEN.test(delEmbed) ? delEmbed : tokenFathom(shareUrl, embedToken);
  if (!token) return null;
  return { src: `https://fathom.video/embed/${token}?autoplay=1`, miniatura: `https://fathom.video/share/${token}/thumbnail` };
}

/**
 * Abrir la grabación en Fathom en ese segundo. El embed NO salta a un segundo (ni por URL ni por
 * postMessage: se probó en su player); el link de Compartir con `timestamp` sí.
 */
export function linkAlSegundo(shareUrl: string | null | undefined, seg: number): string | null {
  if (!esLinkHttp(shareUrl)) return null;
  const u = new URL(shareUrl);
  u.searchParams.set('timestamp', String(Math.max(0, Math.round(Number.isFinite(seg) ? seg : 0))));
  return u.toString();
}

// ── La ficha ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que GET /api/closing/llamada le manda a la ficha, y NADA más (`fichaDe` copia sólo esto): ni el modelo
 * que analizó ni los contadores internos. Va el `error` del análisis porque es lo único que dice qué arreglar
 * (sin saldo, sin key de IA, Fathom caído).
 */
export const CAMPOS_FICHA = [
  'recording_id', 'share_url', 'embed_token', 'title', 'call_date', 'duration_min', 'closer', 'invitee_email',
  'lead_id', 'lead_nombre', 'lead_empresa', 'category', 'tipo', 'score', 'outcome', 'outcome_tone', 'summary', 'next_step',
  'dims', 'moments', 'recs', 'strengths', 'weaknesses', 'objections', 'annotations', 'has_transcript', 'edit_history', 'status', 'error',
] as const;
export type LlamadaFicha = Pick<ClosingAnalysisRow, (typeof CAMPOS_FICHA)[number]>;
export function fichaDe(c: ClosingAnalysisRow): LlamadaFicha {
  const fila = c as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of CAMPOS_FICHA) out[k] = fila[k] ?? null;
  return out as unknown as LlamadaFicha;
}

const CATEGORIA: Record<string, string> = {
  entrega_servicio: 'Entrega del servicio', interna: 'Llamada interna', test: 'Llamada de prueba', sin_clasificar: 'Sin clasificar',
};
export type EstadoFicha = { tono: 'bad' | 'warn' | 'dim'; texto: string; detalle: string | null };
/**
 * Lo que la ficha avisa arriba cuando la llamada NO es una venta analizada: la ficha se abre también desde el
 * conjunto `llamadas` (todas las categorías y estados) y desde un link viejo. `null` = venta analizada.
 */
export function estadoDeLlamada(c: Pick<LlamadaFicha, 'category' | 'status' | 'error' | 'has_transcript'>): EstadoFicha | null {
  if (c.status === 'error') {
    const e = limpio(c.error);
    return { tono: 'bad', texto: 'No se pudo analizar', detalle: e ? (e.length > 200 ? `${e.slice(0, 200)}…` : e) : null };
  }
  if (c.category !== 'venta') return { tono: 'dim', texto: `${CATEGORIA[c.category] ?? 'Otra llamada'}: no se analiza`, detalle: null };
  if (c.status === 'pendiente') return { tono: 'warn', texto: 'Sin transcript: se reintenta al sincronizar', detalle: null };
  if (c.status === 'descartada') return { tono: 'dim', texto: 'Descartada: no se analiza', detalle: null };
  if (c.has_transcript === false) return { tono: 'warn', texto: 'Sin transcript', detalle: null };
  return null;
}

/**
 * El puntaje que va quedando mientras se revisa a mano: el promedio de las dimensiones con un decimal, la
 * MISMA cuenta que hace `reviseAnalysis` (lib/closing.ts) al guardar. Sin dimensiones, el que había.
 */
export function puntajeEnVivo(dims: ReadonlyArray<Pick<ClosingDim, 'label' | 'score'>>, puntajes: Readonly<Record<string, number>>, actual: number | null): number | null {
  const vals = dims.map((d) => puntajes[d.label] ?? d.score);
  return promedio(vals) ?? actual;
}

export type LineaTranscript = { t_seconds: number; speaker: string | null; text: string };
/**
 * Las marcas del análisis sobre el transcript: cada una va a la línea MÁS CERCANA en el tiempo, si está a
 * 30 s o menos (los segundos los estimó el modelo). Si dos caen en la misma línea, queda la última.
 */
export function marcasDeTranscript(lineas: ReadonlyArray<LineaTranscript>, anotaciones: ReadonlyArray<ClosingAnnotation> | null | undefined): Map<number, { tone: 'good' | 'bad'; label: string }> {
  const out = new Map<number, { tone: 'good' | 'bad'; label: string }>();
  const marcas = (anotaciones ?? []).filter((a) => a && Number.isFinite(a.t_seconds)).slice().sort((a, b) => a.t_seconds - b.t_seconds);
  for (const mk of marcas) {
    let mejor = -1;
    let dif = Infinity;
    lineas.forEach((l, i) => { const d = Math.abs(l.t_seconds - mk.t_seconds); if (d < dif) { dif = d; mejor = i; } });
    if (mejor >= 0 && dif <= 30) out.set(mejor, { tone: mk.tone, label: mk.label });
  }
  return out;
}

// ── La lista ─────────────────────────────────────────────────────────────────────────────

export type OrdenLlamadas = 'fecha' | 'puntaje' | 'duracion';
export type FiltroLlamadas = { q: string; tipo: 'todas' | 'R1' | 'R2'; closer: string | null; tono: Tone | null; orden: OrdenLlamadas };
export const FILTRO_INICIAL: FiltroLlamadas = { q: '', tipo: 'todas', closer: null, tono: null, orden: 'fecha' };

const sinAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * La lista con los filtros de la tab: texto (lead, empresa, título y email, sin distinguir acentos), R1 o R2,
 * closer y desenlace; ordenada por fecha (lo más nuevo primero, sin fecha al final), puntaje o duración
 * (lo que no tiene número, al final). El empate lo rompe el id: dos pintadas dan el mismo orden.
 */
export function filtrarLlamadas(xs: ReadonlyArray<FilaLlamada>, f: FiltroLlamadas): FilaLlamada[] {
  const q = sinAcentos(f.q.trim());
  const out = xs.filter((c) => {
    if (f.tipo !== 'todas' && c.tipo !== f.tipo) return false;
    if (f.closer != null && c.closer !== f.closer) return false;
    if (f.tono != null && c.tono !== f.tono) return false;
    if (q && !sinAcentos([c.nombre, c.empresa, c.titulo, c.email].filter(Boolean).join(' ')).includes(q)) return false;
    return true;
  });
  return out.sort((a, b) => {
    if (f.orden === 'puntaje') return (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.id - a.id;
    if (f.orden === 'duracion') return (b.minutos ?? -1) - (a.minutos ?? -1) || b.id - a.id;
    return (a.fecha == null ? 1 : 0) - (b.fecha == null ? 1 : 0) || String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')) || b.id - a.id;
  });
}

/** Los closers de la lista, sin repetir y en orden alfabético (el desplegable de la lista). */
export const closersDeLista = (xs: ReadonlyArray<FilaLlamada>): string[] =>
  [...new Set(xs.map((c) => c.closer).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'es'));

/** Lo que dice la línea del bloque después de sincronizar (la respuesta de POST /api/closing/sync). */
export function textoDeSync(j: { ventas?: unknown; servicio?: unknown; restantes?: unknown }): string {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return `${n(j.ventas)} de venta · ${n(j.servicio)} de servicio${n(j.restantes) > 0 ? ` · quedan ${n(j.restantes)}` : ''}`;
}
