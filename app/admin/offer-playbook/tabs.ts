// Las pestañas de /admin/offer-playbook. Módulo aparte y SIN imports a propósito: lo importa la fila
// de tabs, que es cliente, y si viniera de secciones.ts arrastraría MarkdownDoc (el parser entero) al
// navegador, que es justo lo que MarkdownDoc evita no llevando 'use client'.
//
// Pedido de Martín (11/10/2026, tarde): «elimina las sub tab de "precio y garantías" y "Fuentes" si
// para eso ya está la de autores» y «ponme una tab de "A definir"». Precio y garantías (§6-§7) quedó
// como desplegable de Criterio; Fuentes (§10), como desplegable al final de Autores.

export type TabPlaybook = 'definir' | 'criterio' | 'autores' | 'discrepancias' | 'errores';

/** El orden de las tabs y su rótulo. Máximo seis (regla de app/_ui/Tabs.tsx). */
export const TABS_PLAYBOOK: ReadonlyArray<{ id: TabPlaybook; label: string }> = [
  { id: 'definir', label: 'A definir' },
  { id: 'criterio', label: 'Criterio' },
  { id: 'autores', label: 'Autores' },
  { id: 'discrepancias', label: 'Discrepancias' },
  { id: 'errores', label: 'Errores comunes' },
];

/** La que abre sin `?tab=`: la primera de la fila. */
export const TAB_INICIAL: TabPlaybook = TABS_PLAYBOOK[0].id;

export const esTabPlaybook = (v: unknown): v is TabPlaybook =>
  typeof v === 'string' && TABS_PLAYBOOK.some((t) => t.id === v);

/**
 * Las tabs que se fueron el 11/10 y adónde quedó su contenido: un link viejo (`?tab=precio`)
 * abre donde ahora vive eso, no la primera tab sin explicación.
 */
const MUDADAS: Readonly<Record<string, TabPlaybook>> = { precio: 'criterio', fuentes: 'autores' };

/** El `?tab=` de la URL → la tab que se dibuja. */
export function tabDeParam(v: unknown): TabPlaybook {
  if (esTabPlaybook(v)) return v;
  if (typeof v === 'string' && MUDADAS[v]) return MUDADAS[v];
  return TAB_INICIAL;
}

/** La URL de una tab. La inicial va sin `?tab=`. */
export const hrefDeTab = (t: TabPlaybook): string =>
  t === TAB_INICIAL ? '/admin/offer-playbook' : `/admin/offer-playbook?tab=${t}`;
