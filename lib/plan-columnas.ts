// =============================================================================
// plan-columnas — las columnas del Plan de cada negocio: sus nombres y las PROPIAS (20/10/2026)
// =============================================================================
// Martín, 18/10 pt 9: «columnas editables como en el CRM» (docs/pedidos-crm.md B1). Las columnas de siempre son el
// ESTADO de la tarea (lib/todo-estados.ts): la base tiene el juego en un CHECK y ~10 lectores deciden con él (qué es
// pendiente, qué se completa). Así que:
//   · las de siempre se RENOMBRAN, como una etapa del sistema en el CRM: la clave no cambia nunca;
//   · las PROPIAS (como «Agregar etapa») son un paso dentro de un estado: «En revisión» agregada después de «En
//     proceso» es trabajo en curso. La tarea guarda en qué columna está (`columna`, mig 0317) y su estado sigue siendo
//     el de esa columna; si la columna ya no existe o no es de su estado (se completó por el avance, la movió MaKo),
//     se dibuja en la de su estado. Nada se pierde por borrar una columna.
// Cada negocio guarda esto en `app_settings` (`plan.columnas`). Sin `server-only`: lo leen el tablero, el teléfono,
// la API de MaKo y el test.
// =============================================================================

import { ESTADOS, esEstado, etiquetaEstado, type EstadoTarea } from './todo-estados';

export const CLAVE_COLUMNAS_PLAN = 'plan.columnas';
/** Lo que entra en la cabecera de una columna sin cortarse. */
export const TOPE_NOMBRE_COLUMNA = 30;
/** Más columnas propias que esto no se leen en un tablero: el kanban es el FLUJO, no una clasificación. */
export const TOPE_COLUMNAS_PROPIAS = 8;

/** Los nombres que un negocio le puso a sus columnas de siempre. Ausente = el de siempre. */
export type NombresColumnasPlan = Partial<Record<EstadoTarea, string>>;
/** Una columna que agregó el negocio: un paso dentro de un estado. */
export type ColumnaPropia = { id: string; nombre: string; estado: EstadoTarea };
export type ConfigColumnasPlan = { nombres: NombresColumnasPlan; propias: ColumnaPropia[] };
export const CONFIG_COLUMNAS_VACIA: ConfigColumnasPlan = { nombres: {}, propias: [] };

/** El id de una columna propia: lo acuña el server (`nuevoIdColumna`). Nunca choca con una clave de estado. */
export const esIdColumnaPropia = (s: unknown): s is string => typeof s === 'string' && /^c_[a-z0-9]{6,16}$/.test(s);
export const nuevoIdColumna = (): string => `c_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

const limpio = (s: unknown): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const comparable = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Lo guardado, saneado. Lee las dos formas: la de la primera parte (`{ estado: nombre }`) y la de ahora
 * (`{ v: 2, nombres, propias }`). Sólo claves que existen, nombres con texto, propias con id válido y sin repetir.
 */
export function parsearColumnasPlan(raw: string | null | undefined): ConfigColumnasPlan {
  if (!raw) return { nombres: {}, propias: [] };
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { nombres: {}, propias: [] }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { nombres: {}, propias: [] };
  const o = obj as Record<string, unknown>;
  const crudos = o.v === 2 ? (o.nombres && typeof o.nombres === 'object' ? o.nombres as Record<string, unknown> : {}) : o;
  const nombres: NombresColumnasPlan = {};
  for (const [k, v] of Object.entries(crudos)) {
    const n = limpio(v).slice(0, TOPE_NOMBRE_COLUMNA);
    if (esEstado(k) && n && n !== etiquetaEstado(k)) nombres[k] = n;
  }
  const propias: ColumnaPropia[] = [];
  for (const p of o.v === 2 && Array.isArray(o.propias) ? o.propias : []) {
    const x = p as Record<string, unknown>;
    const nombre = limpio(x?.nombre).slice(0, TOPE_NOMBRE_COLUMNA);
    if (!esIdColumnaPropia(x?.id) || !esEstado(x?.estado) || x.estado === 'no_cumple' || !nombre || propias.some((q) => q.id === x.id)) continue;
    propias.push({ id: x.id, nombre, estado: x.estado });
    if (propias.length >= TOPE_COLUMNAS_PROPIAS) break;
  }
  return { nombres, propias };
}

/** Lo que se guarda: siempre la forma de ahora. */
export const serializarColumnasPlan = (c: ConfigColumnasPlan): string => JSON.stringify({ v: 2, nombres: c.nombres, propias: c.propias });

/** Compatibilidad con la primera parte: sólo los nombres. */
export const parsearNombresColumnas = (raw: string | null | undefined): NombresColumnasPlan => parsearColumnasPlan(raw).nombres;

/** El nombre que se DIBUJA de una columna de siempre: el del negocio, o el de siempre. */
export const etiquetaDeColumna = (nombres: NombresColumnasPlan | null | undefined, e: EstadoTarea): string =>
  nombres?.[e]?.trim() || etiquetaEstado(e);

/** Una columna como la dibuja el tablero. `clave` es el estado (las de siempre) o el id (las propias). */
export type ColumnaDelPlan = { clave: string; estado: EstadoTarea; label: string; propia: boolean };

/**
 * TODAS las columnas en orden: cada una de siempre y, a su derecha, las propias de ese estado en el orden en que se
 * agregaron. `conNoCumple` decide si existe «No cumplen tu criterio» (sólo si tiene tareas: `columnasDelKanban`).
 */
export function columnasEnOrden(c: ConfigColumnasPlan | null | undefined, conNoCumple: boolean): ColumnaDelPlan[] {
  const out: ColumnaDelPlan[] = [];
  for (const s of ESTADOS) {
    if (s.key === 'no_cumple' && !conNoCumple) continue;
    out.push({ clave: s.key, estado: s.key, label: etiquetaDeColumna(c?.nombres, s.key), propia: false });
    for (const p of c?.propias ?? []) if (p.estado === s.key) out.push({ clave: p.id, estado: p.estado, label: p.nombre, propia: true });
  }
  return out;
}

/** El nombre de una columna por su clave (de siempre o propia). */
export function etiquetaDeClave(c: ConfigColumnasPlan | null | undefined, clave: string): string {
  if (esEstado(clave)) return etiquetaDeColumna(c?.nombres, clave);
  return c?.propias.find((p) => p.id === clave)?.nombre ?? clave;
}

/**
 * EN QUÉ COLUMNA SE DIBUJA UNA TAREA: su columna propia si existe y es de SU estado; si no, la de su estado. Es lo que
 * hace que borrar una columna, completar por el avance o que MaKo la mueva nunca deje una tarea sin columna.
 */
export function claveDeTarea(t: { estado: EstadoTarea; columna?: string | null }, c: ConfigColumnasPlan | null | undefined): string {
  const p = t.columna ? c?.propias.find((x) => x.id === t.columna) : undefined;
  return p && p.estado === t.estado ? p.id : t.estado;
}

/** El nombre de la columna PROPIA donde se dibuja una tarea, o null si está en la de su estado. */
export function nombreDeColumnaPropia(c: ConfigColumnasPlan | null | undefined, estado: EstadoTarea, columna: string | null | undefined): string | null {
  const clave = claveDeTarea({ estado, columna }, c);
  return clave === estado ? null : etiquetaDeClave(c, clave);
}

/** A qué estado y columna va una tarea soltada en `clave`. null = esa columna no existe. */
export function destinoDeClave(c: ConfigColumnasPlan | null | undefined, clave: string): { estado: EstadoTarea; columna: string | null } | null {
  if (esEstado(clave)) return { estado: clave, columna: null };
  const p = c?.propias.find((x) => x.id === clave);
  return p ? { estado: p.estado, columna: p.id } : null;
}

type Resultado = { ok: true; config: ConfigColumnasPlan } | { ok: false; error: string };

/** ¿Otra columna ya se llama así? Sin importar mayúsculas ni acentos: dos «Hecho» no dicen a cuál se mueve. */
function choca(c: ConfigColumnasPlan, clave: string, nombre: string): string | null {
  const k = comparable(nombre);
  const otra = columnasEnOrden(c, true).find((x) => x.clave !== clave && comparable(x.label) === k);
  return otra ? `Ya hay una columna que se llama «${otra.label}».` : null;
}

/**
 * Renombrar una columna. En una de siempre, vacío (o su nombre de siempre) la VUELVE al de siempre; una propia no tiene
 * nombre de siempre, así que vacío es un error.
 */
export function conNombreDeColumna(c: ConfigColumnasPlan, clave: string, nombre: string | null): Resultado {
  const n = limpio(nombre);
  if (n.length > TOPE_NOMBRE_COLUMNA) return { ok: false, error: `El nombre puede tener hasta ${TOPE_NOMBRE_COLUMNA} letras.` };
  if (esEstado(clave)) {
    const resto = { ...c.nombres };
    delete resto[clave];
    if (!n || n === etiquetaEstado(clave)) return { ok: true, config: { ...c, nombres: resto } };
    const error = choca(c, clave, n);
    return error ? { ok: false, error } : { ok: true, config: { ...c, nombres: { ...resto, [clave]: n } } };
  }
  if (!c.propias.some((p) => p.id === clave)) return { ok: false, error: 'Esa columna ya no existe.' };
  if (!n) return { ok: false, error: 'La columna necesita un nombre.' };
  const error = choca(c, clave, n);
  return error ? { ok: false, error } : { ok: true, config: { ...c, propias: c.propias.map((p) => (p.id === clave ? { ...p, nombre: n } : p)) } };
}

/**
 * AGREGAR UNA COLUMNA a la derecha de `despuesDe` (como «Agregar etapa» del CRM): es un paso del MISMO estado que esa
 * columna. No después de «No cumplen tu criterio» (no es un paso del flujo: es lo que el criterio no dejó pasar).
 */
export function conColumnaPropia(c: ConfigColumnasPlan, despuesDe: string, nombre: string, id: string): Resultado {
  const n = limpio(nombre);
  if (!esIdColumnaPropia(id) || c.propias.some((p) => p.id === id)) return { ok: false, error: 'No pude crear la columna. Prueba de nuevo.' };
  const ancla = destinoDeClave(c, despuesDe);
  if (!ancla) return { ok: false, error: 'Esa columna ya no existe.' };
  if (ancla.estado === 'no_cumple') return { ok: false, error: 'Después de «No cumplen tu criterio» no va otra columna.' };
  if (c.propias.length >= TOPE_COLUMNAS_PROPIAS) return { ok: false, error: `Puedes tener hasta ${TOPE_COLUMNAS_PROPIAS} columnas propias.` };
  if (!n) return { ok: false, error: 'La columna necesita un nombre.' };
  if (n.length > TOPE_NOMBRE_COLUMNA) return { ok: false, error: `El nombre puede tener hasta ${TOPE_NOMBRE_COLUMNA} letras.` };
  const error = choca(c, id, n);
  if (error) return { ok: false, error };
  const nueva: ColumnaPropia = { id, nombre: n, estado: ancla.estado };
  // Después de una propia: justo a su derecha. Después de una de siempre: primera de su grupo.
  const i = ancla.columna ? c.propias.findIndex((p) => p.id === ancla.columna) + 1 : c.propias.findIndex((p) => p.estado === ancla.estado);
  const propias = [...c.propias];
  propias.splice(i < 0 ? propias.length : i, 0, nueva);
  return { ok: true, config: { ...c, propias } };
}

/** QUITAR UNA COLUMNA PROPIA. Sus tareas no se tocan: se dibujan en la de su estado (`claveDeTarea`). */
export function sinColumnaPropia(c: ConfigColumnasPlan, id: string): Resultado {
  if (!c.propias.some((p) => p.id === id)) return { ok: false, error: 'Esa columna ya no existe.' };
  return { ok: true, config: { ...c, propias: c.propias.filter((p) => p.id !== id) } };
}

/** Lo que pide la pantalla: como `CambioColumnas`, sin el id de una columna nueva (lo acuña el server). */
export type PedidoColumnas =
  | { tipo: 'renombrar'; clave: string; nombre: string | null }
  | { tipo: 'agregar'; despuesDe: string; nombre: string }
  | { tipo: 'quitar'; id: string };

/** Un cambio a las columnas, como lo aplica el server y MaKo. */
export type CambioColumnas =
  | { tipo: 'renombrar'; clave: string; nombre: string | null }
  | { tipo: 'agregar'; despuesDe: string; nombre: string; id: string }
  | { tipo: 'quitar'; id: string };

export function aplicarCambioColumnas(c: ConfigColumnasPlan, cambio: CambioColumnas): Resultado {
  if (cambio.tipo === 'renombrar') return conNombreDeColumna(c, cambio.clave, cambio.nombre);
  if (cambio.tipo === 'agregar') return conColumnaPropia(c, cambio.despuesDe, cambio.nombre, cambio.id);
  return sinColumnaPropia(c, cambio.id);
}
