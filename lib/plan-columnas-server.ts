// =============================================================================
// plan-columnas-server — leer y guardar los nombres de las columnas del Plan (20/10/2026)
// =============================================================================
// La regla vive en ./plan-columnas.ts; esto es la puerta a `app_settings`, por negocio (el workspace del contexto).
// ⚠️ Leer para DIBUJAR es tolerante: si falla, el tablero sale con los nombres de siempre (que no es un error que se
// vea roto). Leer para ESCRIBIR es estricto y con compare-and-set: una lectura caída leída como «sin nombres»
// guardaría sólo el nuevo y BORRARÍA los demás, y dos personas renombrando a la vez no se pisan.
// =============================================================================

import 'server-only';
import { getSetting, getSettingEstricto, cambiarSettingSi } from '@/lib/settings';
import { CLAVE_COLUMNAS_PLAN, conNombreDeColumna, etiquetaDeColumna, parsearNombresColumnas, type NombresColumnasPlan } from './plan-columnas';
import type { EstadoTarea } from './todo-estados';

export async function leerNombresColumnasPlan(): Promise<NombresColumnasPlan> {
  try {
    return parsearNombresColumnas(await getSetting(CLAVE_COLUMNAS_PLAN));
  } catch (e) {
    console.warn('[plan] no pude leer los nombres de las columnas:', e instanceof Error ? e.message : String(e));
    return {};
  }
}

/** Para la API de MaKo y los avisos del server: el nombre de cada columna, leído una vez. */
export async function etiquetasDeColumnasPlan(): Promise<(e: EstadoTarea) => string> {
  const nombres = await leerNombresColumnasPlan();
  return (e) => etiquetaDeColumna(nombres, e);
}

export async function renombrarColumnaPlan(e: EstadoTarea, nombre: string | null): Promise<{ ok: true; nombres: NombresColumnasPlan } | { ok: false; error: string }> {
  for (let intento = 0; intento < 3; intento++) {
    const crudo = await getSettingEstricto(CLAVE_COLUMNAS_PLAN);
    const r = conNombreDeColumna(parsearNombresColumnas(crudo), e, nombre);
    if (!r.ok) return r;
    if (await cambiarSettingSi(CLAVE_COLUMNAS_PLAN, crudo, JSON.stringify(r.nombres))) return r;
  }
  return { ok: false, error: 'Alguien más estaba cambiando las columnas. Prueba de nuevo.' };
}
