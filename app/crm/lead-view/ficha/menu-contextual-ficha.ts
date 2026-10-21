// =============================================================================
// menu-contextual-ficha — QUÉ ofrece el clic derecho dentro de la FICHA de un lead (puro)
// =============================================================================
// Martín (14/10/2026), textual: «E implementa el click derecho en todo el CRM para diferentes acciones dependiendo donde
// clickee». El tablero y la lista lo tienen desde el 14/10 (app/crm/menu-contextual-crm.ts); la ficha quedó para después
// (docs/pedidos-crm.md, D3). Acá no se inventa ninguna acción: son las del «⋯» de la ficha (AI Analyst, el link, los
// exports, el historial, la guía, MaKo Partners) más las rápidas del lead que ya tiene la tarjeta (WhatsApp, copiar el
// teléfono o el email). QUÉ HACE cada una es de la pantalla (`elegirMenuFicha` en FichaPorBloques.tsx), que las cruza
// con estos ids (tests/crm-ficha-clic-derecho.test.ts).
//
// ⚠️ SOBRE LO EDITABLE, UN LINK O TEXTO SELECCIONADO, EL MENÚ ES EL DEL NAVEGADOR (`menuPropioEn`): ahí lo que se quiere
//    es copiar, pegar o abrir el link, y un menú propio se lo quitaría.
// =============================================================================

import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export type IdOpcionFicha =
  | 'analyst' | 'whatsapp' | 'copiar_telefono' | 'copiar_email' | 'copiar_link'
  | 'exportar_csv' | 'exportar_pdf' | 'historial' | 'guia' | 'partners_llevar' | 'partners_ver';

export type ContextoFicha = {
  conTelefono: boolean;
  conEmail: boolean;
  /** Hay historial de la ficha de este CRM (el «⋯» lo ofrece con lo mismo). */
  conHistorial: boolean;
  /** Quien mira puede editar la ficha: la guía de edición. */
  puedeEditar: boolean;
  /** MaKo Partners: null = no se ofrece (no es agencia o no es su admin). */
  partners: 'llevar' | 'ver' | null;
};

export const OPCION_FICHA: Readonly<Record<IdOpcionFicha, { texto: string; icono: NombreIconoMenu }>> = {
  analyst: { texto: 'AI Analyst', icono: 'mako' },
  whatsapp: { texto: 'Escribir por WhatsApp', icono: 'whatsapp' },
  copiar_telefono: { texto: 'Copiar teléfono', icono: 'telefono' },
  copiar_email: { texto: 'Copiar email', icono: 'email' },
  copiar_link: { texto: 'Copiar el link', icono: 'link' },
  exportar_csv: { texto: 'Exportar (CSV)', icono: 'descargar' },
  exportar_pdf: { texto: 'Exportar (PDF)', icono: 'descargar' },
  historial: { texto: 'Historial de la ficha', icono: 'reloj' },
  guia: { texto: 'Guía de edición', icono: 'pregunta' },
  partners_llevar: { texto: 'Llevar a MaKo Partners', icono: 'cliente' },
  partners_ver: { texto: 'Ver en MaKo Partners', icono: 'cliente' },
};

/** Las opciones, en orden; `null` = un separador (sin separadores colgando). */
export function opcionesFicha(c: ContextoFicha): Array<IdOpcionFicha | null> {
  const xs: Array<IdOpcionFicha | null> = [
    ...(c.conTelefono ? ['whatsapp', 'copiar_telefono'] as const : []),
    ...(c.conEmail ? ['copiar_email' as const] : []),
    'copiar_link',
    null,
    'analyst',
    null,
    'exportar_csv', 'exportar_pdf',
    null,
    ...(c.conHistorial ? ['historial' as const] : []),
    ...(c.puedeEditar ? ['guia' as const] : []),
    null,
    ...(c.partners === 'llevar' ? ['partners_llevar' as const] : c.partners === 'ver' ? ['partners_ver' as const] : []),
  ];
  const out: Array<IdOpcionFicha | null> = [];
  for (const x of xs) {
    if (x === null && (out.length === 0 || out[out.length - 1] === null)) continue;
    out.push(x);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** ¿El clic cayó donde el menú propio corresponde? No sobre algo editable, un link, ni con texto seleccionado. */
export function menuPropioEn(objetivo: { closest?: (sel: string) => unknown } | null, haySeleccion: boolean): boolean {
  if (haySeleccion) return false;
  if (!objetivo || typeof objetivo.closest !== 'function') return true;
  return !objetivo.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], a[href]');
}
