// =============================================================================
// graficos-tablero — dónde vive el tablero de «Mis gráficos» de cada persona
// =============================================================================
// Es POR PERSONA Y POR WORKSPACE, a propósito: el super admin mira a cada cliente con `?ws=N`
// y la agencia ws13 mira a sus clientes. Guardado por workspace, armar un gráfico mirando a
// otro le cambiaría la vista al dueño de esa cuenta. Por eso la clave lleva el usuario y el
// setting vive en el workspace de la pestaña (`setSetting` lo resuelve con
// `getWorkspaceActual`, que ya respeta el `?ws=`).
//
// `app_settings` no hereda entre workspaces (lib/settings.ts lee sólo el de la pestaña), así
// que un tablero no se le aparece a nadie más.
//
// ⚠️ «No pude leer» NO es «no armó ninguno»: con la lectura caída se dibuja el inicial pero
// NO se deja guardar, o el primer cambio pisaría el tablero que la persona ya tenía.
//
// ── LA API DE MaKo (11/10/2026) ───────────────────────────────────────────────────────────
// Martín: «TODO el Dashboard se consume por la API de MaKo; la API trabaja sobre el informe de la
// persona que se nombre». Un runner de la API NO tiene cookie: `leerTablero()` / `guardarTablero()`
// le devolvían el inicial (o tiraban) sin avisar. Por eso las de sesión DELEGAN en las que reciben el
// `sub` (= usuarios.id): una sola lectura y una sola escritura, con dos puertas.
//
// ⚠️ DOS ESCRITORES CON RITMOS DISTINTOS. El editor autoguarda el informe ENTERO (EditorInforme.tsx) y
//    la API escribe una pieza. La API escribe con COMPARE-AND-SET (`guardarTableroSi`): si el informe
//    cambió entre que se propuso el cambio y el «sí», no escribe encima. La versión es la huella del
//    texto guardado (no la hora: un autoguardado idéntico no es un cambio) y el candado es la hora de la
//    fila (`updated_at`), que es atómico en la base. NO se compara el `value` en el filtro: un informe
//    son decenas de KB y un `eq` con eso viaja en la URL, que el proxy corta.
// ⚠️ Y lo que NO resuelve esto: una pestaña del editor ABIERTA con el informe viejo lo pisa en su
//    próximo autoguardado (es un upsert ciego). Ver docs/hallazgos-api-mako.md.

import 'server-only';
import { createHash } from 'node:crypto';
import { getUsuarioActual } from './auth';
import { getSettingEstricto, setSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { sanearTablero, type Tablero } from './graficos-catalogo';
import { tableroInicial } from './graficos-plantillas';

const clave = (sub: string) => `graficos.tablero.${sub}`;
/** El prefijo de `clave`: para listar los informes guardados de un workspace. */
const PREFIJO_CLAVE = 'graficos.tablero.';

export type LecturaTablero =
  | { estado: 'propio'; tablero: Tablero }
  | { estado: 'inicial'; tablero: Tablero }
  | { estado: 'error'; tablero: Tablero };

/** El informe de la persona con sesión (la pantalla). Delega en `leerTableroDe`. */
export async function leerTablero(): Promise<LecturaTablero> {
  const s = await getUsuarioActual();
  if (!s) return { estado: 'error', tablero: tableroInicial() };
  return leerTableroDe(s.sub);
}

/** El informe de la persona `sub` en el workspace en curso. Sin sesión: lo usa la API de MaKo. */
export async function leerTableroDe(sub: string): Promise<LecturaTablero> {
  try {
    const raw = await getSettingEstricto(clave(sub));
    if (raw == null) return { estado: 'inicial', tablero: tableroInicial() };
    const t = sanearTablero(JSON.parse(raw));
    return t ? { estado: 'propio', tablero: t } : { estado: 'inicial', tablero: tableroInicial() };
  } catch (e) {
    console.error(`[graficos] no pude leer el tablero: ${e instanceof Error ? e.message : String(e)}`);
    return { estado: 'error', tablero: tableroInicial() };
  }
}

/** Guarda el tablero ya saneado. Devuelve lo que quedó guardado. */
export async function guardarTablero(raw: unknown): Promise<Tablero> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  return guardarTableroDe(s.sub, raw);
}

/** Guarda (sin mirar la versión) el tablero de `sub` en el workspace en curso. */
export async function guardarTableroDe(sub: string, raw: unknown): Promise<Tablero> {
  const t = sanearTablero(raw);
  if (!t) throw new Error('Tablero inválido');
  await setSetting(clave(sub), JSON.stringify(t));
  return t;
}

// ── Con versión: lo que usa la API de MaKo ─────────────────────────────────────────────────

/** La huella de lo guardado. `null` = la persona no guardó nada. */
export const versionDe = (raw: string | null): string | null =>
  (raw == null ? null : createHash('sha256').update(raw).digest('hex').slice(0, 32));

/** El workspace en curso, o tira: acá NO se cae al ws 1 (lib/settings.ts sí lo hace, y el 1 es un cliente). */
async function wsDeLaLectura(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('graficos-tablero: sin workspace en curso');
  return ws;
}

type FilaSetting = { value: string | null; updated_at: string | null };

async function filaDe(ws: number, sub: string): Promise<FilaSetting | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value, updated_at')
    .eq('workspace_id', ws).eq('key', clave(sub)).maybeSingle();
  if (error) throw new Error(`No pude leer el informe: ${error.message}`);
  return (data as FilaSetting | null) ?? null;
}

export type TableroVersionado = {
  estado: 'propio' | 'inicial';
  tablero: Tablero;
  /** La huella de lo guardado (`versionDe`); null = no guardó nada (se le muestra el inicial). */
  version: string | null;
  /** Cuándo se guardó por última vez, o null. */
  actualizado: string | null;
};

/** El informe de `sub` con su versión. ⚠️ Una lectura que falla TIRA: «no pude leer» no es «no guardó». */
export async function leerTableroVersionado(sub: string): Promise<TableroVersionado> {
  const ws = await wsDeLaLectura();
  const f = await filaDe(ws, sub);
  const raw = f?.value ?? null;
  const version = versionDe(raw);
  if (raw == null) return { estado: 'inicial', tablero: tableroInicial(), version, actualizado: f?.updated_at ?? null };
  let t: Tablero | null = null;
  try { t = sanearTablero(JSON.parse(raw)); } catch { t = null; }
  return t
    ? { estado: 'propio', tablero: t, version, actualizado: f?.updated_at ?? null }
    : { estado: 'inicial', tablero: tableroInicial(), version, actualizado: f?.updated_at ?? null };
}

/**
 * Guarda el tablero de `sub` SÓLO si lo guardado sigue siendo la versión `version` (compare-and-set).
 * `{ ok: false }` = alguien lo cambió en el medio (otra pestaña autoguardó): no se escribe nada.
 * ⚠️ El error de escritura NO se traga: tira, y el que llama lo dice.
 */
export async function guardarTableroSi(sub: string, raw: unknown, version: string | null): Promise<{ ok: true; tablero: Tablero } | { ok: false }> {
  const t = sanearTablero(raw);
  if (!t) throw new Error('Tablero inválido');
  const ws = await wsDeLaLectura();
  const actual = await filaDe(ws, sub);
  if (versionDe(actual?.value ?? null) !== version) return { ok: false };
  const ahora = new Date().toISOString();
  const db = getSupabaseServer();
  const valor = JSON.stringify(t);
  if (!actual) {
    // No había fila: se crea sólo si sigue sin haberla (dos «sí» a la vez crean UNA).
    const { data, error } = await db.from('app_settings')
      .upsert({ workspace_id: ws, key: clave(sub), value: valor, updated_at: ahora }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
      .select('key');
    if (error) throw new Error(`No pude guardar el informe: ${error.message}`);
    return data?.length ? { ok: true, tablero: t } : { ok: false };
  }
  let q = db.from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', clave(sub));
  q = actual.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', actual.updated_at);
  const { data, error } = await q.select('key');
  if (error) throw new Error(`No pude guardar el informe: ${error.message}`);
  return data?.length ? { ok: true, tablero: t } : { ok: false };
}

export type InformeGuardadoCrudo = { sub: string; raw: string | null; actualizado: string | null };

/**
 * Los informes guardados en el workspace en curso, uno por persona (`sub`). Con `conContenido`, trae el
 * JSON (para listar sus hojas). ⚠️ Una lectura que falla TIRA. Sin tope de filas: es uno por persona que
 * alguna vez guardó, y el tope de 200 se DICE si se alcanza.
 */
export async function listarTablerosGuardados(opts: { conContenido?: boolean } = {}): Promise<{ informes: InformeGuardadoCrudo[]; recortado: boolean }> {
  const ws = await wsDeLaLectura();
  const TOPE = 200;
  const { data, error } = await getSupabaseServer().from('app_settings')
    .select(opts.conContenido ? 'key, value, updated_at' : 'key, updated_at')
    .eq('workspace_id', ws).like('key', `${PREFIJO_CLAVE}%`).order('key', { ascending: true }).limit(TOPE);
  if (error) throw new Error(`No pude listar los informes: ${error.message}`);
  const filas = (data ?? []) as unknown as Array<{ key: string; value?: string | null; updated_at: string | null }>;
  return {
    informes: filas.map((f) => ({ sub: f.key.slice(PREFIJO_CLAVE.length), raw: f.value ?? null, actualizado: f.updated_at })),
    recortado: filas.length >= TOPE,
  };
}
