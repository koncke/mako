'use server';

// =============================================================================
// Las actions de la pantalla de Competitor Spy
// =============================================================================
// Todo lo que toca la base vive en lib/spy.ts. Acá sólo está el guard y lo que viaja al navegador.
//
// ⚠️ El guard se escribe EN ESTE ARCHIVO y no se importa de otro `use server`: exportar un guard
// desde un archivo 'use server' lo convierte en una server action llamable desde el navegador, o
// sea publicar el chequeo de permisos como endpoint. Es la misma nota que está en las actions del
// onboarding.
//
// ⚠️ El `id` de un competidor NO es un secreto y no hace falta que lo sea: `getTenantDb()` le
// inyecta el `workspace_id` a cada consulta, así que el id de otro negocio simplemente no existe
// para estas lecturas y devuelve «no encontré».

import {
  analizarCompetidor, etapaDePieza, guardarAnuncioPegado, listarCompetidores, listarPiezas,
  mirarCompetidor, type Competidor, type LecturaCanalSpy, type Pieza,
} from '@/lib/spy';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { getRolWsEfectivo } from '@/lib/workspace';
import type { CanalSpy, EtapaTendencia } from '@/lib/spy-reglas';

/** null = entra. `getRolWsEfectivo` da 'admin' al admin del workspace y a la agencia. */
async function soloAdmin(): Promise<string | null> {
  return (await getRolWsEfectivo()) === 'admin' ? null : 'Solo el administrador del workspace puede usar esta tab.';
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Una pieza como la dibuja la pantalla: con su etapa ya calculada. */
export type PiezaVista = Pieza & { etapa: EtapaTendencia | null };

export async function competidoresAction(): Promise<{ ok: true; competidores: Competidor[] } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try { return await listarCompetidores(); } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function piezasAction(id: number, canal?: CanalSpy): Promise<{ ok: true; piezas: PiezaVista[] } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    const piezas = await listarPiezas(id, canal);
    return { ok: true, piezas: piezas.map((p) => ({ ...p, etapa: etapaDePieza(p) })) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function revisarAction(id: number): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, canales: [], error: no };
  try { return await mirarCompetidor(id); } catch (e) { return { ok: false, canales: [], error: msg(e) }; }
}

export async function analizarAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    // Lo que vende ESTE negocio es la mitad del análisis: sin eso sale «este competidor promete X»,
    // que es la Biblioteca de Anuncios con otro CSS. El cruce es lo que ninguna herramienta de
    // afuera puede hacer, porque ninguna conoce el negocio.
    const brief = await perfilNegocioTexto().catch(() => '');
    const r = await analizarCompetidor(id, brief);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function guardarAnuncioAction(id: number, enlace: string, copy?: string): Promise<{ ok: true; nuevo: boolean } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try { return await guardarAnuncioPegado(id, enlace, copy); } catch (e) { return { ok: false, error: msg(e) }; }
}
