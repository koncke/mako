// =============================================================================
// general-vistas — dónde viven las vistas de /general de cada persona
// =============================================================================
// El molde es el del Dashboard (lib/graficos-tablero.ts), y por las mismas razones:
//
//   · POR PERSONA Y POR WORKSPACE. El super admin mira a cada cliente con `?ws=N`: guardado por workspace, armar
//     una vista mirando a un cliente le cambiaría la /general al dueño de esa cuenta. La clave lleva el usuario
//     (`general.vistas.<sub>`) y la fila vive en el workspace de la pestaña.
//   · «NO PUDE LEER» NO ES «NO ARMÓ NINGUNA». Con la lectura caída se dibuja la vista por defecto pero NO se deja
//     guardar (`estado: 'error'`, sin versión): el primer cambio pisaría las vistas que la persona ya tenía.
//   · COMPARE-AND-SET. La pantalla manda la versión que leyó; si otra pestaña guardó en el medio, no se escribe
//     (`{ ok: false }`) y la pantalla lo dice. La versión es la huella del texto guardado (no la hora: un guardado
//     idéntico no es un cambio) y el candado, `updated_at`, que es atómico en la base. El `value` NO va en el
//     filtro: viajaría en la URL de PostgREST (AGENTS.md, duodécima tanda de Automations).
//
// ⚠️ EL WORKSPACE SALE DE `getWorkspaceActual()` Y SI NO HAY, TIRA. `lib/settings.ts` cae al ws 1 sin pestaña, y
//    el ws 1 es Mauricio, un cliente.

import 'server-only';
import { createHash } from 'node:crypto';
import { getUsuarioActual } from './auth';
import { getSupabaseServer } from './supabase';
import { getWorkspaceActual } from './workspace';
import { sanearVistas, vistasIniciales, type VistasGeneral } from './general-vistas-modelo';

const clave = (sub: string) => `general.vistas.${sub}`;

export type LecturaVistas =
  | { estado: 'propio' | 'inicial'; vistas: VistasGeneral; version: string | null }
  | { estado: 'error'; vistas: VistasGeneral; version: null };

/** La huella de lo guardado. `null` = la persona no guardó nada. */
export const versionDeVistas = (raw: string | null): string | null =>
  (raw == null ? null : createHash('sha256').update(raw).digest('hex').slice(0, 32));

async function wsEnCurso(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('general-vistas: sin workspace en curso');
  return ws;
}

type Fila = { value: string | null; updated_at: string | null };

async function filaDe(ws: number, sub: string): Promise<Fila | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value, updated_at')
    .eq('workspace_id', ws).eq('key', clave(sub)).maybeSingle();
  if (error) throw new Error(`No pude leer las vistas: ${error.message}`);
  return (data as Fila | null) ?? null;
}

/** Las vistas de la persona con sesión. Nunca tira: con la lectura caída devuelve `error` y la de por defecto. */
export async function leerVistasGeneral(): Promise<LecturaVistas> {
  try {
    const s = await getUsuarioActual();
    if (!s) return { estado: 'error', vistas: vistasIniciales(), version: null };
    return await leerVistasDe(s.sub);
  } catch (e) {
    console.error(`[general] no pude leer las vistas: ${e instanceof Error ? e.message : String(e)}`);
    return { estado: 'error', vistas: vistasIniciales(), version: null };
  }
}

/** Las vistas de `sub` en el workspace en curso. ⚠️ Una lectura que falla TIRA. */
export async function leerVistasDe(sub: string): Promise<LecturaVistas> {
  const ws = await wsEnCurso();
  const f = await filaDe(ws, sub);
  const raw = f?.value ?? null;
  const version = versionDeVistas(raw);
  if (raw == null) return { estado: 'inicial', vistas: vistasIniciales(), version };
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  return { estado: 'propio', vistas: sanearVistas(parsed), version };
}

export type ResultadoGuardarVistas = { ok: true; vistas: VistasGeneral; version: string } | { ok: false };

/** Guarda las vistas de la persona con sesión SÓLO si lo guardado sigue en `version`. */
export async function guardarVistasGeneral(raw: unknown, version: string | null): Promise<ResultadoGuardarVistas> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  return guardarVistasDe(s.sub, raw, version);
}

/** El compare-and-set. `{ ok: false }` = alguien guardó en el medio: no se escribe nada. El error de escritura TIRA. */
export async function guardarVistasDe(sub: string, raw: unknown, version: string | null): Promise<ResultadoGuardarVistas> {
  const v = sanearVistas(raw);
  const ws = await wsEnCurso();
  const actual = await filaDe(ws, sub);
  if (versionDeVistas(actual?.value ?? null) !== version) return { ok: false };
  const ahora = new Date().toISOString();
  const db = getSupabaseServer();
  const valor = JSON.stringify(v);
  const nueva = versionDeVistas(valor)!;
  if (!actual) {
    // No había fila: se crea sólo si sigue sin haberla (dos guardados a la vez crean UNA).
    const { data, error } = await db.from('app_settings')
      .upsert({ workspace_id: ws, key: clave(sub), value: valor, updated_at: ahora }, { onConflict: 'workspace_id,key', ignoreDuplicates: true })
      .select('key');
    if (error) throw new Error(`No pude guardar las vistas: ${error.message}`);
    return data?.length ? { ok: true, vistas: v, version: nueva } : { ok: false };
  }
  let q = db.from('app_settings').update({ value: valor, updated_at: ahora }).eq('workspace_id', ws).eq('key', clave(sub));
  q = actual.updated_at == null ? q.is('updated_at', null) : q.eq('updated_at', actual.updated_at);
  const { data, error } = await q.select('key');
  if (error) throw new Error(`No pude guardar las vistas: ${error.message}`);
  return data?.length ? { ok: true, vistas: v, version: nueva } : { ok: false };
}
