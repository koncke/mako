// =============================================================================
// menu-contextual-landings — QUÉ ofrece el clic derecho de un renglón de la lista del Panel del Web Generator (puro)
// =============================================================================
// Pedido de Leandro (24/10/2026, f26): el clic derecho «casi que en toda la app». El clic derecho de un renglón (y
// mantenerlo presionado) y su «⋯» abren ESTE menú (Inicio.tsx, «El menú de un renglón»):
//   · una página analizada: Diagnóstico, Abrir la página, y Eliminar al final;
//   · una landing o una presentación: Abrir, Diagnóstico, Cambiar nombre, Duplicar, Copiar enlace público (si está
//     publicada), y Archivar y Eliminar al final.
//
// ⚠️ DESDE EL 18/11/2026 EL «⋯» ABRE ESTE MENÚ (AGENTS.md, «El "⋯" y el clic derecho de lo mismo son un menú»; el F119 de
//    docs/pendientes-verificados-17-11.md). Del 27/10 a ese día el «⋯» era un `MenuFlotante` con su propia lista, que
//    tests/clic-derecho-listas cruzaba con ésta rótulo por rótulo: ahora hay una sola. La lista de la tarjeta del editor
//    (editor/paneles/PanelLandings.tsx) no tiene «⋯»: sin menú.
// =============================================================================
import type { EntradaMenuContextual } from '@/app/_ui/MenuContextual';
import type { FilaPanel } from './panel-reglas';

export type IdOpcionLanding =
  | 'diagnostico' | 'abrir_pagina' | 'abrir' | 'renombrar' | 'duplicar' | 'copiar_enlace' | 'archivar' | 'eliminar';

/** ¿La landing tiene enlace público? La MISMA condición que el «⋯»: un slug y publicada alguna vez. */
export const tieneEnlacePublico = (d: { slug?: string | null; publicadoAt?: string | null }): boolean => !!d.slug && !!d.publicadoAt;

export function itemsRenglonLanding(f: FilaPanel): EntradaMenuContextual[] {
  if (f.tipo === 'analizada') {
    return [
      { id: 'diagnostico', label: 'Diagnóstico', icono: 'grafico' },
      { id: 'abrir_pagina', label: 'Abrir la página', icono: 'web' },
      null,
      { id: 'eliminar', label: 'Eliminar', icono: 'borrar', peligro: true },
    ];
  }
  return [
    { id: 'abrir', label: 'Abrir', icono: 'ver' },
    { id: 'diagnostico', label: 'Diagnóstico', icono: 'grafico' },
    { id: 'renombrar', label: 'Cambiar nombre', icono: 'renombrar' },
    { id: 'duplicar', label: 'Duplicar', icono: 'duplicar' },
    ...(tieneEnlacePublico(f.doc) ? [{ id: 'copiar_enlace', label: 'Copiar enlace público', icono: 'link' } as const] : []),
    null,
    { id: 'archivar', label: 'Archivar', icono: 'archivar' },
    { id: 'eliminar', label: 'Eliminar', icono: 'borrar', peligro: true },
  ];
}
