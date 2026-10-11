// Las pestañas de /admin/offer-playbook. Módulo aparte y SIN imports a propósito: lo importa la fila
// de tabs, que es cliente, y si viniera de secciones.ts arrastraría MarkdownDoc (el parser entero) al
// navegador, que es justo lo que MarkdownDoc evita no llevando 'use client'.

export type TabPlaybook = 'criterio' | 'precio' | 'errores' | 'autores' | 'discrepancias' | 'fuentes';

/** El orden de las tabs y su rótulo. Máximo seis (regla de app/_ui/Tabs.tsx). */
export const TABS_PLAYBOOK: ReadonlyArray<{ id: TabPlaybook; label: string }> = [
  { id: 'criterio', label: 'Criterio' },
  { id: 'precio', label: 'Precio y garantías' },
  { id: 'errores', label: 'Errores comunes' },
  { id: 'autores', label: 'Autores' },
  { id: 'discrepancias', label: 'Discrepancias' },
  { id: 'fuentes', label: 'Fuentes' },
];

export const esTabPlaybook = (v: unknown): v is TabPlaybook =>
  typeof v === 'string' && TABS_PLAYBOOK.some((t) => t.id === v);
