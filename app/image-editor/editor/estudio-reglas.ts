// =============================================================================
// Las reglas puras del estudio del Image Editor (./Estudio.tsx): qué se abre al entrar y qué muestra la lista
// =============================================================================
// Sin React ni el motor: las prueba tests/image-editor-estudio.test.ts.

import type { ResumenDiseno } from '@/lib/image-editor/tipos';

/**
 * Al entrar a /image-editor sin un diseño en la URL, se abre el ÚLTIMO editado (como el Web Generator abre una landing);
 * sin ninguno, null: la vista de crear. La base ya los manda por `updated_at` y acá se vuelve a ordenar igual, para no
 * depender de eso.
 */
export function disenoAlEntrar(disenos: readonly ResumenDiseno[]): string | null {
  let mejor: ResumenDiseno | null = null;
  for (const d of disenos) {
    if (!mejor || (Date.parse(d.actualizado) || 0) > (Date.parse(mejor.actualizado) || 0)) mejor = d;
  }
  return mejor?.id ?? null;
}

const normal = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** La lista de la tarjeta: los que tienen la búsqueda en el nombre, sin tildes ni mayúsculas. «Sin título» también cuenta. */
export function disenosDeLaLista(disenos: readonly ResumenDiseno[], busca: string): ResumenDiseno[] {
  const q = normal(busca);
  if (!q) return [...disenos];
  return disenos.filter((d) => normal(d.titulo || 'Diseño sin título').includes(q));
}
