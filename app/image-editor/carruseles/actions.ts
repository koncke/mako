'use server';

// =============================================================================
// El explorador de carruseles del Image Editor: guardar, búsquedas guardadas y el resumen de la portada
// =============================================================================
// La misma puerta que el editor (`puerta`, lib/image-editor/server.ts: sesión + la tab Image en su capa + un negocio).
// Lo que escriben es del NEGOCIO (sus referencias), con compare-and-set (lib/carruseles/explorar-servidor.ts). Leer y
// escribir lo hacen también la API de MaKo (lib/api-mako/areas/imagen.*): son las mismas funciones.
// ⚠️ En un archivo 'use server' sólo se exportan funciones async (AGENTS.md).
// =============================================================================

import { puerta } from '@/lib/image-editor/server';
import { borrarBusqueda, guardarBusqueda, guardarCarrusel, leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { ordenarCarruseles, tendenciasDeLaSemana, type BusquedaGuardada, type Carrusel, type PasoExplorador } from '@/lib/carruseles/explorar';

type Mal = { ok: false; error: string };
const NO_ENTRA: Mal = { ok: false, error: 'Abre el Image Editor desde tu negocio para usar esto.' };

/** Guarda o saca un carrusel de las referencias del negocio. */
export async function guardarCarruselAction(id: number, guardar: boolean): Promise<{ ok: true; ids: number[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await guardarCarrusel(Number(id), !!guardar);
  return r.ok ? { ok: true, ids: r.valor.map((g) => g.id) } : r;
}

/** Guarda la búsqueda de ahora con un nombre. */
export async function guardarBusquedaAction(nombre: string, query: string): Promise<{ ok: true; busquedas: BusquedaGuardada[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await guardarBusqueda(String(nombre ?? ''), String(query ?? ''));
  return r.ok ? { ok: true, busquedas: r.valor } : r;
}

/** Borra una búsqueda guardada. */
export async function borrarBusquedaAction(id: string): Promise<{ ok: true; busquedas: BusquedaGuardada[] } | Mal> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await borrarBusqueda(String(id ?? ''));
  return r.ok ? { ok: true, busquedas: r.valor } : r;
}

/**
 * Lo que muestra la franja de «Nuevo diseño»: los que mejor funcionan de esta semana (y, si esta semana no hay, los de
 * mayor outlier), o el paso en que está el negocio. Se pide desde el navegador: la portada abre sin esperarlo.
 */
export async function resumenCarruselesAction(): Promise<
  { ok: true; paso: PasoExplorador; frase: string; accion: { texto: string; ruta: string } | null; carruseles: Carrusel[]; semana: boolean; total: number } | Mal
> {
  if ((await puerta()) instanceof Response) return NO_ENTRA;
  const r = await leerExplorador();
  if (!r.ok) return { ok: false, error: 'No pude leer los carruseles de las cuentas que sigues.' };
  const visibles = r.carruseles.filter((c) => c.medio !== 'imagen');
  const semana = tendenciasDeLaSemana(visibles, 6);
  const carruseles = semana.length >= 3 ? semana : ordenarCarruseles(visibles, 'outlier').slice(0, 6);
  return { ok: true, paso: r.paso, frase: r.frase, accion: r.accion, carruseles, semana: semana.length >= 3, total: visibles.length };
}
