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
// ⚠️ Y lo que NO resolvía esto hasta v5: una pestaña del editor ABIERTA con el informe viejo lo pisaba en
//    su próximo autoguardado (era un upsert ciego). Ver docs/hallazgos-api-mako.md.
//
// ── v5 (12/10/2026): EL EDITOR TAMBIÉN MANDA LA VERSIÓN ───────────────────────────────────────────────
// La pantalla lee el informe CON su versión (`leerTablero` → `version`) y el autoguardado escribe con
// `guardarTableroVersion`, el MISMO compare-and-set que la API: si otro escritor guardó en el medio (otra
// pestaña, la API de MaKo, el deploy de al lado), no se escribe y la pantalla se entera. Es lo que impide
// que una pestaña abierta con el deploy anterior BORRE los campos nuevos de v5 (conectores, pop-ups, la
// sección, el botón de MaKo): su saneo no los conoce y el autoguardado manda el informe ENTERO.
// `guardarTablero` (sin versión) queda sólo por compatibilidad: la ruta del autoguardado la deja de usar.

import 'server-only';
import { createHash } from 'node:crypto';
import { getUsuarioActual } from './auth';
import { setSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { sanearTablero, type Tablero } from './graficos-catalogo';
import { tableroInicial } from './graficos-plantillas';
import { informeGeneralInicial } from './general-plantillas';

const clave = (sub: string) => `graficos.tablero.${sub}`;
/** El prefijo de `clave`: para listar los informes guardados de un workspace. */
const PREFIJO_CLAVE = 'graficos.tablero.';

/**
 * DE QUÉ INFORME (14/10/2026): desde que la tab General es el mismo editor que el Dashboard, cada persona tiene DOS
 * informes, el del Dashboard y el de General, con la misma forma, la misma lectura y el mismo compare-and-set. El de
 * General vive en `general.informe.<sub>`, que NO empieza con `graficos.tablero.`: `listarTablerosGuardados` (la API de
 * MaKo del Dashboard) no lo lista como si fuera otro Dashboard.
 */
export type Informe = 'dashboard' | 'general';
const claveDe = (sub: string, informe: Informe) => (informe === 'general' ? `general.informe.${sub}` : clave(sub));
const inicialDe = (informe: Informe) => (informe === 'general' ? informeGeneralInicial() : tableroInicial());

/**
 * Lo que lee la pantalla. `version` es la huella de lo GUARDADO (`versionDe`; null = no guardó nada): el
 * autoguardado la devuelve tal cual para escribir con compare-and-set (`guardarTableroVersion`). Con la
 * lectura caída no hay versión: la pantalla no guarda.
 */
export type LecturaTablero =
  | { estado: 'propio'; tablero: Tablero; version: string | null }
  | { estado: 'inicial'; tablero: Tablero; version: string | null }
  | { estado: 'error'; tablero: Tablero; version: null };

/** El informe de la persona con sesión (la pantalla). Delega en `leerTableroDe`. */
export async function leerTablero(): Promise<LecturaTablero> {
  const s = await getUsuarioActual();
  if (!s) return { estado: 'error', tablero: tableroInicial(), version: null };
  return leerTableroDe(s.sub);
}

/**
 * El informe de la persona `sub` en el workspace en curso, con su versión. Sin sesión: lo usa la API de MaKo.
 * ⚠️ Lee por `leerTableroVersionado` (la MISMA fila y el mismo workspace que escribe `guardarTableroSi`): una
 *    versión sacada de otra lectura podría no ser la de la fila que se compara al guardar.
 */
export async function leerTableroDe(sub: string): Promise<LecturaTablero> {
  try {
    const v = await leerTableroVersionado(sub);
    return { estado: v.estado, tablero: v.tablero, version: v.version };
  } catch (e) {
    console.error(`[graficos] no pude leer el tablero: ${e instanceof Error ? e.message : String(e)}`);
    return { estado: 'error', tablero: tableroInicial(), version: null };
  }
}

/**
 * Guarda el tablero ya saneado, SIN mirar la versión. Devuelve lo que quedó guardado.
 * @deprecated v5: el autoguardado del editor va por `guardarTableroVersion` (un upsert ciego es lo que dejaba
 * que una pestaña vieja borrara lo que otra guardó). Queda para quien todavía la llame.
 */
export async function guardarTablero(raw: unknown): Promise<Tablero> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  return guardarTableroDe(s.sub, raw);
}

/**
 * El AUTOGUARDADO del editor (v5): guarda el informe de la persona con sesión SÓLO si lo guardado sigue en la
 * `version` que leyó la pantalla (la de `leerTablero`, o la que devolvió el guardado anterior). `{ ok: false }`
 * = alguien guardó en el medio: no se escribe nada y la pantalla lo dice (no pisa). Delega en `guardarTableroSi`,
 * el mismo compare-and-set que la API de MaKo: una sola escritura con versión, con dos puertas.
 */
export async function guardarTableroVersion(raw: unknown, version: string | null): Promise<ResultadoGuardar> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  return guardarTableroSi(s.sub, raw, version);
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

async function filaDe(ws: number, sub: string, informe: Informe = 'dashboard'): Promise<FilaSetting | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value, updated_at')
    .eq('workspace_id', ws).eq('key', claveDe(sub, informe)).maybeSingle();
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
export async function leerTableroVersionado(sub: string, informe: Informe = 'dashboard'): Promise<TableroVersionado> {
  const ws = await wsDeLaLectura();
  const f = await filaDe(ws, sub, informe);
  const raw = f?.value ?? null;
  const version = versionDe(raw);
  if (raw == null) return { estado: 'inicial', tablero: inicialDe(informe), version, actualizado: f?.updated_at ?? null };
  let t: Tablero | null = null;
  try { t = sanearTablero(JSON.parse(raw)); } catch { t = null; }
  return t
    ? { estado: 'propio', tablero: t, version, actualizado: f?.updated_at ?? null }
    : { estado: 'inicial', tablero: inicialDe(informe), version, actualizado: f?.updated_at ?? null };
}

/**
 * Lo que contesta un guardado con versión. `version` es la huella de lo que quedó guardado: el que guarda la
 * usa en el PRÓXIMO guardado (si no, su segundo autoguardado chocaría contra el primero).
 */
export type ResultadoGuardar = { ok: true; tablero: Tablero; version: string } | { ok: false };

/**
 * Guarda el tablero de `sub` SÓLO si lo guardado sigue siendo la versión `version` (compare-and-set).
 * `{ ok: false }` = alguien lo cambió en el medio (otra pestaña autoguardó): no se escribe nada.
 * ⚠️ El error de escritura NO se traga: tira, y el que llama lo dice.
 */
export async function guardarTableroSi(sub: string, raw: unknown, version: string | null, informe: Informe = 'dashboard'): Promise<ResultadoGuardar> {
  const t = sanearTablero(raw);
  if (!t) throw new Error('Tablero inválido');
  const ws = await wsDeLaLectura();
  const actual = await filaDe(ws, sub, informe);
  if (versionDe(actual?.value ?? null) !== version) return { ok: false };
  const ahora = new Date().toISOString();
  const db = getSupabaseServer();
  const valor = JSON.stringify(t);
  // La versión nueva es la huella de lo que se escribe (la fila queda con ESTE texto, tal cual).
  const nueva = versionDe(valor)!;
  if (!actual) {
    // No había fila: se crea sólo si sigue sin haberla (dos «sí» a la vez crean UNA).
    const { data, error } = await db.from('app_settings')
      .upsert({ workspace_id: ws, key: claveDe(sub, informe), value: valor, updated_at: ahora }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
      .select('key');
    if (error) throw new Error(`No pude guardar el informe: ${error.message}`);
    return data?.length ? { ok: true, tablero: t, version: nueva } : { ok: false };
  }
  let q = db.from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', claveDe(sub, informe));
  q = actual.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', actual.updated_at);
  const { data, error } = await q.select('key');
  if (error) throw new Error(`No pude guardar el informe: ${error.message}`);
  return data?.length ? { ok: true, tablero: t, version: nueva } : { ok: false };
}

// ── El informe de General (14/10/2026): las mismas dos puertas, con la otra clave ──────────────────────────────

/** El informe de General de la persona con sesión, con su versión. Sin nada guardado, el inicial de General. */
export async function leerInformeGeneral(): Promise<LecturaTablero> {
  const s = await getUsuarioActual();
  if (!s) return { estado: 'error', tablero: informeGeneralInicial(), version: null };
  try {
    const v = await leerTableroVersionado(s.sub, 'general');
    return { estado: v.estado, tablero: v.tablero, version: v.version };
  } catch (e) {
    console.error(`[general] no pude leer el informe: ${e instanceof Error ? e.message : String(e)}`);
    return { estado: 'error', tablero: informeGeneralInicial(), version: null };
  }
}

/** El autoguardado del editor en General: el MISMO compare-and-set que el del Dashboard, sobre el informe de General. */
export async function guardarInformeGeneralVersion(raw: unknown, version: string | null): Promise<ResultadoGuardar> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  return guardarTableroSi(s.sub, raw, version, 'general');
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
