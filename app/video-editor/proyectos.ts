// =============================================================================
// Los proyectos del Video Editor en la tarjeta de MaKo: la lista, el último y la URL (27/10/2026)
// =============================================================================
// Pedido de Martín (27/10/2026), textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo,
// para que se pueda editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los
// "proyectos" se vean en la barra del costado, y que no cambie de ruta». La tarjeta de la izquierda es el chat o la lista
// de proyectos (como la de landings del Web Generator, app/web-generator/editor/paneles/PanelLandings.tsx), y abrir otro
// proyecto o crear uno lo cambia EN EL LUGAR (_opencut/marco.tsx): la URL se acompaña con `history.replaceState`, para
// que recargar vuelva a abrir el mismo.
//
// Lo de acá es puro y no toca el motor (que no carga en node: AGENTS.md, «En el Video Editor, un import de VALOR de
// `_opencut/wasm` no carga fuera del navegador»): lo prueba tests/video-editor-marco.test.ts EJECUTÁNDOLO.
// =============================================================================

import { conWs, wsDeBusqueda } from '@/lib/ws-tab';

/** Lo que la lista necesita de un proyecto (un `TProjectMetadata` del motor lo cumple). */
export type ProyectoDeLista = {
  id: string;
  name: string;
  updatedAt: Date | string | number;
  thumbnail?: string;
};

/** La ruta de un proyecto; `null` es la tab sin proyecto. */
export function rutaProyecto(id: string | null): string {
  return id ? `/video-editor/${encodeURIComponent(id)}` : '/video-editor';
}

/**
 * La URL que queda en la barra al abrir un proyecto SIN navegar: su ruta con el `?ws=` de la pestaña y nada más. El
 * `?propuesta=`, el `?desde=` y el `?plantilla=` eran de la apertura: recargar con ellos volvería a enfocar una
 * propuesta de otro proyecto o a armar la plantilla dos veces.
 */
export function urlDelProyecto(id: string | null, search: string): string {
  return conWs(rutaProyecto(id), wsDeBusqueda(search));
}

const msDe = (f: ProyectoDeLista['updatedAt']): number => {
  const ms = f instanceof Date ? f.getTime() : typeof f === 'number' ? f : Date.parse(f);
  return Number.isFinite(ms) ? ms : 0;
};

/** Sin mayúsculas ni acentos: «Promoción» se encuentra escribiendo «promocion». */
const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Lo que muestra la lista: lo que coincide con la búsqueda, el último que se tocó primero. */
export function proyectosDeLaLista<T extends ProyectoDeLista>(proyectos: readonly T[], busca: string): T[] {
  const q = plano(busca.trim());
  return proyectos
    .filter((p) => !q || plano(p.name || '').includes(q))
    .sort((a, b) => msDe(b.updatedAt) - msDe(a.updatedAt));
}

/**
 * El proyecto con que abre `/video-editor` (la ruta sin proyecto): el último que se tocó. `null` = no hay ninguno, y el
 * editor muestra «Crear proyecto» en su lugar.
 */
export function ultimoProyecto<T extends ProyectoDeLista>(proyectos: readonly T[]): T | null {
  return proyectosDeLaLista(proyectos, '')[0] ?? null;
}
