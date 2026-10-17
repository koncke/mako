// =============================================================================
// paginas-reglas — las reglas puras de las PÁGINAS de una landing: la ruta libre, cuál es la de inicio, la copia
// =============================================================================
// Vivían en app/web-generator/editor/PanelPaginas.tsx, que es 'use client', y la API de MaKo
// (lib/api-mako/areas/landing-contenido.helpers.ts) no podía importarlas (un módulo del server recibe una
// referencia de cliente, no la función): las tenía COPIADAS, con un test que comparaba las dos (deuda de la tanda 7,
// docs/relevo/landing-generator.md). Desde el 17/10/2026 viven acá y las dos las importan.
// Sin 'use client' ni 'server-only': las usan el panel, la API y los tests.
// =============================================================================

import { TOPES, nuevoId, rutaValida, slugDe, type DocPagina, type JsonNodo, type Pagina } from './doc';

/** Una ruta libre a partir de un texto: el slug, y si está tomada o es corta, con sufijo. */
export function rutaLibre(texto: string, usadas: readonly string[]): string {
  let base = slugDe(texto).slice(0, 50).replace(/-+$/g, '');
  if (!rutaValida(base)) base = 'pagina';
  const tomadas = new Set(usadas);
  if (!tomadas.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const r = `${base}-${i}`;
    if (!tomadas.has(r)) return r;
  }
  return `${base}-${nuevoId('').slice(0, 6)}`;
}

/**
 * La página `id` pasa a ser la de inicio (ruta '' y primera de la lista); la que era de inicio
 * recibe una ruta libre derivada de su título. Nunca quedan dos de inicio.
 */
export function hacerInicio(paginas: readonly Pagina[], id: string): Pagina[] {
  const elegida = paginas.find((p) => p.id === id);
  if (!elegida) return [...paginas];
  const usadas = paginas.filter((p) => p.id !== id && p.ruta).map((p) => p.ruta);
  const resto = paginas.filter((p) => p.id !== id).map((p) => {
    if (p.ruta !== '') return p;
    const ruta = rutaLibre(p.titulo || 'pagina', usadas);
    usadas.push(ruta);
    return { ...p, ruta };
  });
  return [{ ...elegida, ruta: '' }, ...resto];
}

/** Por qué una ruta no sirve para la página `id` (texto corto), o null si sirve. */
export function motivoRuta(ruta: string, id: string, paginas: readonly Pagina[]): string | null {
  if (ruta === '') return null;
  if (!rutaValida(ruta)) return 'De 3 a 60: a-z, 0-9 y guiones';
  if (paginas.some((p) => p.id !== id && p.ruta === ruta)) return 'Esa ruta ya existe';
  return null;
}

/** Copia de una página con ids nuevos (de la página y de cada sección) y una ruta libre. */
export function duplicarPagina(p: Pagina, paginas: readonly Pagina[], docVivo?: DocPagina | null): Pagina {
  const doc = JSON.parse(JSON.stringify(docVivo ?? p.doc)) as DocPagina;
  doc.content = (doc.content ?? []).map((t: JsonNodo) => ({ ...t, attrs: { ...(t.attrs ?? {}), id: nuevoId('t') } }));
  const titulo = `${p.titulo || 'Página'} (copia)`.slice(0, TOPES.titulo);
  return { ...p, id: nuevoId('p'), titulo, ruta: rutaLibre(titulo, paginas.map((x) => x.ruta).filter(Boolean)), doc };
}
