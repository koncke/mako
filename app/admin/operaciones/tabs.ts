// =============================================================================
// Los nombres de las tabs de MaKo: los que puede tener un chat jefe (16/10/2026)
// =============================================================================
// Martín: «Quiero chats con los nombres de las tabs que sean "jefes"». La convención del jefe (AGENTS.md → el Centro de
// Operaciones) es que se llama como la tab; un chat cuyo jefe no se llama como ninguna («dashboard-marketing-7d», que es
// el nombre de la carpeta, o un título que inventó la app) iba a «Sin asignar»; desde el 17/10/2026 va en la misma lista
// (Martín: «No entiendo el desplegable de "Sin asignar"... elimínalo»), y renombrándolo pasa a su jefe.
//
// Los nombres salen de dos registros que ya existen: las etiquetas de la barra (la del cliente, la de MaKo y la del super
// admin, app/_components/nav.ts) y los títulos de las áreas del producto (app/admin/dev/areas.ts), que nombran también lo
// que no tiene tab propia («MaKo Mobile», «Closing Analyst»). Se calculan en el SERVIDOR y viajan como una lista chica: el
// registro de áreas es grande y no tiene por qué ir al navegador.

import { ADMIN_NAV, MAKO_NAV, TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { AREAS } from '@/app/admin/dev/areas';
import { ENTRADAS } from '@/lib/funciones-mako';
import type { TabDelIndice } from '@/lib/centro-chats';

const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * DE QUÉ TAB ES CADA NOMBRE (10/11/2026, Martín: «La idea era tener un chat por cada tab de MaKo o cada funcionalidad»). El Ops Center
 * agrupa la lista por tab: la fila es la tab y sus chats de tarea van adentro (lib/centro-chats.ts → `tabDeChat`). Cada tab con los
 * nombres que la nombran, sacados de los registros que ya existen —nada escrito acá a mano—:
 *   · su etiqueta de la barra y la de su jefe (nav.ts: «Image», «Ops Center»/«Second Brain»);
 *   · el área de app/admin/dev/areas.ts que es ella (`slugDev` de lib/funciones-mako.ts: «Image Editor» es «Image») y las áreas cuyo
 *     `grupo` se llama como ella («Lead Insights», del grupo «CRM»);
 *   · cómo le dice la gente (`alias` de lib/funciones-mako.ts), sólo los de dos palabras o más: uno suelto («imagen», «copy», «error»)
 *     agruparía cualquier tarea.
 * Un área que no es ninguna tab queda como su propia tab («Closing Analyst», «MaKo Mobile»).
 */
export function indiceDeTabs(): TabDelIndice[] {
  const porClave = new Map<string, { tab: string; nombres: Set<string> }>();
  const tomar = (tab: string) => {
    const k = normal(tab);
    let t = porClave.get(k);
    if (!t) { t = { tab: tab.trim(), nombres: new Set([k]) }; porClave.set(k, t); }
    return t;
  };
  const deNombre = new Map<string, string>();
  const sumar = (tab: string, nombre: string) => {
    const n = normal(nombre);
    if (!n || deNombre.has(n)) return;
    deNombre.set(n, normal(tab));
    tomar(tab).nombres.add(n);
  };
  // 1. La barra (la del producto primero: «CRM» es /crm antes que /admin/dev/crm).
  const items = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV];
  const tabDeKey = new Map<string, string>();
  for (const i of items) {
    const tab = (i.jefe ?? i.label).trim();
    if (!tab) continue;
    if (!tabDeKey.has(i.key)) tabDeKey.set(i.key, tab);
    sumar(tab, tab);
    sumar(tab, i.label);
  }
  // 2. Lo que dice funciones-mako de cada una: su área y los alias de varias palabras.
  const tabDeSlug = new Map<string, string>();
  for (const e of ENTRADAS) {
    const tab = tabDeKey.get(e.keys[0]);
    if (!tab) continue;
    if (e.slugDev) tabDeSlug.set(e.slugDev, tab);
    for (const a of e.alias) if (normal(a).includes(' ')) sumar(tab, a);
  }
  // 3. Las áreas: la que es una tab, la de un grupo que se llama como una tab, y la que no es ninguna (su propia tab).
  for (const a of AREAS) {
    const tab = tabDeSlug.get(a.slug) ?? (a.grupo && porClave.has(normal(a.grupo)) ? porClave.get(normal(a.grupo))!.tab : null) ?? deNombre.get(normal(a.titulo)) ?? a.titulo;
    sumar(porClave.get(normal(tab))?.tab ?? tab, a.titulo);
  }
  return [...porClave.values()].map((t) => ({ tab: t.tab, nombres: [...t.nombres] }));
}

export function nombresDeTabs(): string[] {
  // El nombre del JEFE si la fila se llama distinto (nav.ts → `jefe`, 18/10/2026: el Second Brain de cada negocio se
  // llama «Ops Center» en la barra y su jefe sigue siendo «Second Brain»).
  const todos = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV].map((i) => i.jefe ?? i.label).concat(AREAS.map((a) => a.titulo));
  return [...new Set(todos.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}
