'use server';

// =============================================================================
// Las actions de la pantalla de Competitor Spy
// =============================================================================
// Todo lo que toca la base vive en lib/spy.ts. Acá sólo está el guard y lo que viaja al navegador.
//
// ⚠️ El guard se escribe EN ESTE ARCHIVO y no se importa de otro `use server`: exportar un guard
// desde un archivo 'use server' lo convierte en una server action llamable desde el navegador, o
// sea publicar el chequeo de permisos como endpoint.
//
// ⚠️ El `id` de un competidor NO es un secreto y no hace falta que lo sea: `getTenantDb()` le
// inyecta el `workspace_id` a cada consulta, así que el id de otro negocio simplemente no existe
// para estas lecturas y devuelve «no encontré».

import {
  agregarCompetidor, analizarCompetidor, etapaDePieza, guardarAnuncioPegado, leerCompetidor,
  listarCompetidores, listarPiezas, mirarCompetidor, quitarCompetidor, resumenDePiezas,
  type Competidor, type LecturaCanalSpy, type Pieza, type ResumenPiezas,
} from '@/lib/spy';
import { nombresDe } from '@/lib/landing-snapshot';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { marcarActosSpy } from '@/lib/spy-actos';
import { getRolWsEfectivo } from '@/lib/workspace';
import type { CanalSpy, EtapaTendencia } from '@/lib/spy-reglas';

/** null = entra. `getRolWsEfectivo` da 'admin' al admin del workspace y a la agencia. */
async function soloAdmin(): Promise<string | null> {
  return (await getRolWsEfectivo()) === 'admin' ? null : 'Solo el administrador del workspace puede usar esta tab.';
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Una pieza como la dibuja la pantalla: con su etapa ya calculada, y con nombre lo que su sitio tiene. */
export type PiezaVista = Pieza & { etapa: EtapaTendencia | null; piezasDePagina?: string[] };

export async function competidoresAction(): Promise<{ ok: true; competidores: Competidor[]; resumen: Record<number, ResumenPiezas> } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    const r = await listarCompetidores();
    if (!r.ok) return r;
    return { ok: true, competidores: r.competidores, resumen: await resumenDePiezas() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function piezasAction(id: number, canal?: CanalSpy): Promise<{ ok: true; piezas: PiezaVista[] } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    const piezas = await listarPiezas(id, canal);
    return {
      ok: true,
      piezas: piezas.map((p) => ({
        ...p, etapa: etapaDePieza(p),
        ...(p.canal === 'landing' ? { piezasDePagina: nombresDe(p.etiquetas ?? []) } : {}),
      })),
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Agregar es navegar: UN campo. Se pega un @, un canal o un sitio, el código resuelve qué es, y la
 * pantalla abre la ficha. Si ya existía, el upsert por nombre devuelve la misma fila.
 */
export async function sumarCompetidorAction(pegado: string, nombre?: string): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    const r = await agregarCompetidor(pegado, nombre);
    if (!r.ok) return r;
    const c = r.competidor;
    await marcarActosSpy(c.instagram || c.youtube_id || c.landing_url ? ['spy_primero', 'spy_canales'] : ['spy_primero']);
    return { ok: true, id: c.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Le suma un canal al competidor que ya está: el upsert por nombre escribe sobre la MISMA fila. */
export async function sumarCanalAction(id: number, pegado: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try {
    const c = await leerCompetidor(id);
    if (!c) return { ok: false, error: 'No encontré a ese competidor.' };
    const r = await agregarCompetidor(pegado, c.nombre);
    if (!r.ok) return r;
    await marcarActosSpy(['spy_primero', 'spy_canales']);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function revisarAction(id: number): Promise<{ ok: boolean; canales: LecturaCanalSpy[]; error?: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, canales: [], error: no };
  try {
    const r = await mirarCompetidor(id);
    if (r.ok) await marcarActosSpy(['spy_primero', 'spy_canales', 'spy_lectura']);
    return r;
  } catch (e) {
    return { ok: false, canales: [], error: msg(e) };
  }
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

export async function quitarCompetidorAction(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const no = await soloAdmin();
  if (no) return { ok: false, error: no };
  try { return await quitarCompetidor(id); } catch (e) { return { ok: false, error: msg(e) }; }
}
