// =============================================================================
// El filtro de la barra del Ops Center (22/10/2026, feedback 4 de Martín)
// =============================================================================
// Martín: la barra del Ops Center, la del super admin y la del cliente, «parecida a lo que tenemos en Automations»: arriba la
// búsqueda, el tutorial y el filtro. El filtro es el de Automations (app/automations/FiltroLista.tsx → el Dropdown de la casa
// con `secciones`, casillas y «Quitar filtros» abajo), con las secciones de los CHATS:
//   · «Área»: el chat jefe de cada uno (lo de antes de « › » en su nombre: «Offer › Mi oferta» es de Offer);
//   · «Estado» (sólo el super admin, que lo sabe por chat): los que trabajan y los que esperan su respuesta.
// Dentro de una sección vale cualquiera de lo marcado; entre secciones, todas.
// Sin React ni servidor: la barra sólo dibuja (tests/ops-center-barra.test.ts).
// =============================================================================

import type { DropdownGroup, DropdownOption } from '@/app/components/Dropdown';
import { partesDelNombre } from './centro-chats';

/** Lo que el filtro necesita de una fila: su nombre y, si se sabe, su estado. */
export type ChatFiltrable = { titulo: string; trabajando?: boolean; espera?: boolean };

const normal = (s: string) => s.trim().toLocaleLowerCase('es');
/** El área de un chat: su jefe. */
export const areaDe = (titulo: string): string => partesDelNombre(titulo).jefe;

export const VALOR_FILTRO = {
  area: (jefe: string) => `area:${normal(jefe)}`,
  trabajando: 'estado:trabajando',
  espera: 'estado:espera',
} as const;

/** ¿Pasa la fila? Dentro de una sección, cualquiera de lo marcado; entre secciones, todas. Sin nada marcado, todas pasan. */
export function pasaFiltroChats(f: ChatFiltrable, valores: readonly string[]): boolean {
  const areas = valores.filter((v) => v.startsWith('area:'));
  const estados = valores.filter((v) => v.startsWith('estado:'));
  if (areas.length && !areas.includes(VALOR_FILTRO.area(areaDe(f.titulo)))) return false;
  if (estados.length && !estados.some((v) => (v === VALOR_FILTRO.trabajando ? f.trabajando : v === VALOR_FILTRO.espera ? f.espera : false))) return false;
  return true;
}

/** Marcar o desmarcar uno. */
export const alternarFiltroChats = (valores: readonly string[], v: string): string[] =>
  valores.includes(v) ? valores.filter((x) => x !== v) : [...valores, v];

/**
 * Las secciones del Dropdown: cada área (en el orden en que aparece, con cuántos tiene) y, con `conEstado`, el estado. Lo
 * marcado que ya no tiene filas se sigue ofreciendo, así se puede desmarcar.
 */
export function seccionesDelFiltroChats(filas: readonly ChatFiltrable[], valores: readonly string[], conEstado: boolean): DropdownGroup[] {
  const areas = new Map<string, { jefe: string; n: number }>();
  for (const f of filas) {
    const jefe = areaDe(f.titulo);
    const v = VALOR_FILTRO.area(jefe);
    const a = areas.get(v);
    if (a) a.n += 1; else areas.set(v, { jefe, n: 1 });
  }
  for (const v of valores) if (v.startsWith('area:') && !areas.has(v)) areas.set(v, { jefe: v.slice(5), n: 0 });
  const opArea: DropdownOption[] = [...areas].map(([value, a]) => ({ value, label: `${a.jefe} · ${a.n}`, icono: 'mako' }));
  const cuantas = (p: (f: ChatFiltrable) => boolean) => filas.filter(p).length;
  const opEstado: DropdownOption[] = [
    { value: VALOR_FILTRO.espera, label: `Esperan tu respuesta · ${cuantas((f) => !!f.espera)}`, icono: 'pregunta' },
    { value: VALOR_FILTRO.trabajando, label: `Trabajando · ${cuantas((f) => !!f.trabajando)}`, icono: 'reloj' },
  ];
  /** Lo que dice la sección en la raíz: «Todas», lo marcado, o cuántos. Como el filtro de Automations. */
  const resumen = (ops: DropdownOption[]): string => {
    const marcados = ops.filter((o) => valores.includes(o.value));
    if (!marcados.length) return 'Todas';
    if (marcados.length === 1) return marcados[0].label.replace(/ · \d+$/, '');
    return `${marcados.length} elegidas`;
  };
  const activo = (ops: DropdownOption[]) => ops.some((o) => valores.includes(o.value));
  return [
    { title: 'Área', icono: 'mako', options: opArea, resumen: resumen(opArea), activo: activo(opArea) },
    ...(conEstado ? [{ title: 'Estado', icono: 'reloj', options: opEstado, resumen: resumen(opEstado), activo: activo(opEstado) }] : []),
  ];
}
