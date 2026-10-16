// =============================================================================
// Los nombres de las tabs de MaKo: los que puede tener un chat jefe (16/10/2026)
// =============================================================================
// Martín: «Quiero chats con los nombres de las tabs que sean "jefes"». La convención del jefe (AGENTS.md → el Centro de
// Operaciones) es que se llama como la tab; un chat cuyo jefe no se llama como ninguna («dashboard-marketing-7d», que es
// el nombre de la carpeta, o un título que inventó la app) va a «Sin asignar» (lib/centro-chats.ts → seccionesDeChats).
//
// Los nombres salen de dos registros que ya existen: las etiquetas de la barra (la del cliente, la de MaKo y la del super
// admin, app/_components/nav.ts) y los títulos de las áreas del producto (app/admin/dev/areas.ts), que nombran también lo
// que no tiene tab propia («MaKo Mobile», «Closing Analyst»). Se calculan en el SERVIDOR y viajan como una lista chica: el
// registro de áreas es grande y no tiene por qué ir al navegador.

import { ADMIN_NAV, MAKO_NAV, TODOS_LOS_ITEMS } from '@/app/_components/nav';
import { AREAS } from '@/app/admin/dev/areas';

export function nombresDeTabs(): string[] {
  const todos = [...TODOS_LOS_ITEMS, ...MAKO_NAV, ...ADMIN_NAV].map((i) => i.label).concat(AREAS.map((a) => a.titulo));
  return [...new Set(todos.map((n) => n.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}
