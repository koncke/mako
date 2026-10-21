// =============================================================================
// plan-columnas-server — leer y cambiar las columnas del Plan de un negocio (20/10/2026)
// =============================================================================
// La regla vive en ./plan-columnas.ts; esto es la puerta a `app_settings`, por negocio (el workspace del contexto).
// ⚠️ Leer para DIBUJAR es tolerante: si falla, el tablero sale con las columnas de siempre (que no es un error que se
// vea roto). Leer para ESCRIBIR es estricto y con compare-and-set: una lectura caída leída como «sin nada» guardaría
// sólo el cambio y BORRARÍA los demás nombres y columnas, y dos personas cambiando a la vez no se pisan.
// =============================================================================

import 'server-only';
import { getSetting, getSettingEstricto, cambiarSettingSi } from '@/lib/settings';
import {
  CLAVE_COLUMNAS_PLAN, aplicarCambioColumnas, etiquetaDeColumna, parsearColumnasPlan, serializarColumnasPlan,
  type CambioColumnas, type ConfigColumnasPlan, type NombresColumnasPlan,
} from './plan-columnas';
import type { EstadoTarea } from './todo-estados';

export async function leerColumnasPlan(): Promise<ConfigColumnasPlan> {
  try {
    return parsearColumnasPlan(await getSetting(CLAVE_COLUMNAS_PLAN));
  } catch (e) {
    console.warn('[plan] no pude leer las columnas:', e instanceof Error ? e.message : String(e));
    return { nombres: {}, propias: [] };
  }
}

/** Sólo los nombres de las de siempre (lo que necesita quien no dibuja columnas propias). */
export async function leerNombresColumnasPlan(): Promise<NombresColumnasPlan> {
  return (await leerColumnasPlan()).nombres;
}

/** Para la API de MaKo y los avisos del server: el nombre de cada columna de siempre, leído una vez. */
export async function etiquetasDeColumnasPlan(): Promise<(e: EstadoTarea) => string> {
  const nombres = await leerNombresColumnasPlan();
  return (e) => etiquetaDeColumna(nombres, e);
}

export async function cambiarColumnasPlan(cambio: CambioColumnas): Promise<{ ok: true; config: ConfigColumnasPlan } | { ok: false; error: string }> {
  for (let intento = 0; intento < 3; intento++) {
    const crudo = await getSettingEstricto(CLAVE_COLUMNAS_PLAN);
    const r = aplicarCambioColumnas(parsearColumnasPlan(crudo), cambio);
    if (!r.ok) return r;
    if (await cambiarSettingSi(CLAVE_COLUMNAS_PLAN, crudo, serializarColumnasPlan(r.config))) return r;
  }
  return { ok: false, error: 'Alguien más estaba cambiando las columnas. Prueba de nuevo.' };
}
