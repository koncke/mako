// =============================================================================
// plan-columnas — el NOMBRE de cada columna del Plan, por negocio (20/10/2026)
// =============================================================================
// Martín, 18/10 pt 9: «columnas editables como en el CRM» (docs/pedidos-crm.md B1). Las columnas del Plan son el
// ESTADO de la tarea (lib/todo-estados.ts): la base tiene el juego en un CHECK y ~10 lectores deciden con él (qué es
// pendiente, qué se completa). Así que se edita lo que en el CRM se edita de una etapa del sistema: el NOMBRE. La
// clave no cambia nunca; cada negocio guarda sus nombres en `app_settings` (`plan.columnas`) y lo que no renombró
// sale con el de siempre (`etiquetaEstado`).
// Agregar o borrar columnas propias (como «Agregar etapa» del CRM) necesita una columna nueva en las dos tablas del
// Plan: es la segunda parte, con su migración.
// Sin `server-only`: lo leen el tablero, el teléfono, la API de MaKo y el test.
// =============================================================================

import { ESTADOS, esEstado, etiquetaEstado, type EstadoTarea } from './todo-estados';

export const CLAVE_COLUMNAS_PLAN = 'plan.columnas';
/** Lo que entra en la cabecera de una columna sin cortarse. */
export const TOPE_NOMBRE_COLUMNA = 30;

/** Los nombres que un negocio le puso a sus columnas. Ausente = el de siempre. */
export type NombresColumnasPlan = Partial<Record<EstadoTarea, string>>;

const limpio = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const comparable = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Lo guardado, saneado: sólo claves que existen y nombres que no están vacíos ni son el de siempre. */
export function parsearNombresColumnas(raw: string | null | undefined): NombresColumnasPlan {
  if (!raw) return {};
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return {}; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: NombresColumnasPlan = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = limpio(v).slice(0, TOPE_NOMBRE_COLUMNA);
    if (esEstado(k) && n && n !== etiquetaEstado(k)) out[k] = n;
  }
  return out;
}

/** El nombre que se DIBUJA de una columna: el del negocio, o el de siempre. */
export const etiquetaDeColumna = (nombres: NombresColumnasPlan | null | undefined, e: EstadoTarea): string =>
  nombres?.[e]?.trim() || etiquetaEstado(e);

/**
 * Renombrar una columna. Vacío (o el nombre de siempre) la VUELVE al de siempre. No puede llamarse como otra columna
 * (con otras mayúsculas o acentos también): dos «Hecho» en el tablero no dicen a cuál se mueve la tarjeta.
 */
export function conNombreDeColumna(nombres: NombresColumnasPlan, e: EstadoTarea, nombre: string | null): { ok: true; nombres: NombresColumnasPlan } | { ok: false; error: string } {
  const n = limpio(nombre);
  if (n.length > TOPE_NOMBRE_COLUMNA) return { ok: false, error: `El nombre puede tener hasta ${TOPE_NOMBRE_COLUMNA} letras.` };
  const resto = { ...nombres };
  delete resto[e];
  if (!n || n === etiquetaEstado(e)) return { ok: true, nombres: resto };
  const choca = ESTADOS.find((s) => s.key !== e && comparable(etiquetaDeColumna(nombres, s.key)) === comparable(n));
  if (choca) return { ok: false, error: `Ya hay una columna que se llama «${etiquetaDeColumna(nombres, choca.key)}».` };
  return { ok: true, nombres: { ...resto, [e]: n } };
}
