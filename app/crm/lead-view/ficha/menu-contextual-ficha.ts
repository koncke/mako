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
//
// ⚠️ DESDE EL 24/10/2026 EL «⋯» DE AL LADO DE «EDITAR» ABRE ESTE MISMO MENÚ, por SECCIONES, con lo de la hoja abierta. Martín:
//    «no pongas la flechita con esas opciones, para eso ya tenemos los 3 puntos al lado de "editar", que ese desplegable de
//    los 3 puntos tambien esta desordenado». Era un `Dropdown` con su propia lista (AI Analyst / Copiar el link / Exportar
//    CSV / Exportar PDF / Historial de la ficha / Guía de edición) y el clic derecho, otra: dos listas, como las de una
//    columna del tablero hasta el 22/10 (app/crm/menu-contextual-crm.ts). Ahora es una, en este orden:
//      · «AI Analyst», primero y solo: es lo que más se usa de acá;
//      · Lead: escribirle y copiar sus datos, y MaKo Partners;
//      · Compartir: el link y los dos exports;
//      · Esta hoja: lo que hacía la flechita de la tab (nombre, templates, duplicar, moverla, volver a su template);
//      · Ficha: su historial y la guía de edición;
//      · «Eliminar hoja», última, sola y en rojo.
// =============================================================================

import type { ReactElement } from 'react';
import type { EntradaMenuContextual, ItemMenuContextual } from '@/app/_ui/MenuContextual';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export type IdOpcionFicha =
  | 'analyst' | 'whatsapp' | 'copiar_telefono' | 'copiar_email' | 'copiar_link'
  | 'exportar_csv' | 'exportar_pdf' | 'historial' | 'guia' | 'partners_llevar' | 'partners_ver'
  // La hoja abierta (24/10/2026): lo que hacía la flechita de su tab.
  | 'hoja_renombrar' | 'hoja_templates' | 'hoja_duplicar' | 'hoja_izquierda' | 'hoja_derecha' | 'hoja_volver' | 'hoja_eliminar';

/**
 * Lo que se puede hacer con la hoja abierta. null = nada (quien mira no edita, o es el Historial, que no es una hoja).
 * ⚠️ LO QUE NO SE PUEDE, NO SALE (Martín, 29/09/2026): Duplicar con el tope de hojas lleno, «Volver a su template» sin nada
 *    que volver. Sólo las flechas van de a dos en una línea, y la que no tiene a dónde ir se apaga.
 */
export type HojaDelMenu = {
  renombrar: boolean;
  templates: boolean;
  duplicar: boolean;
  /** Una hoja propia con otra al lado: hacia dónde se puede mover. null = no se mueve (las cuatro del CRM, o es la única). */
  mover: { izquierda: boolean; derecha: boolean } | null;
  volver: boolean;
  eliminar: boolean;
};

export type ContextoFicha = {
  conTelefono: boolean;
  conEmail: boolean;
  /** Hay historial de la ficha de este CRM (el «⋯» lo ofrece con lo mismo). */
  conHistorial: boolean;
  /** Quien mira puede editar la ficha: la guía de edición. */
  puedeEditar: boolean;
  /** MaKo Partners: null = no se ofrece (no es agencia o no es su admin). */
  partners: 'llevar' | 'ver' | null;
  /** La hoja abierta. Ausente o null: sin la sección «Esta hoja». */
  hoja?: HojaDelMenu | null;
};

export const OPCION_FICHA: Readonly<Record<IdOpcionFicha, { texto: string; icono: NombreIconoMenu }>> = {
  analyst: { texto: 'AI Analyst', icono: 'mako' },
  whatsapp: { texto: 'Escribir por WhatsApp', icono: 'whatsapp' },
  copiar_telefono: { texto: 'Copiar teléfono', icono: 'telefono' },
  copiar_email: { texto: 'Copiar email', icono: 'email' },
  // Sin artículo ni paréntesis (24/10/2026, como «Cambiar nombre»: «que no diga "Cambiar EL nombre"»).
  copiar_link: { texto: 'Copiar link', icono: 'link' },
  exportar_csv: { texto: 'Exportar CSV', icono: 'descargar' },
  exportar_pdf: { texto: 'Exportar PDF', icono: 'descargar' },
  historial: { texto: 'Historial de la ficha', icono: 'reloj' },
  guia: { texto: 'Guía de edición', icono: 'pregunta' },
  partners_llevar: { texto: 'Abrirle su cuenta de MaKo', icono: 'cliente' },
  partners_ver: { texto: 'Ver en Agency Dashboard', icono: 'cliente' },
  hoja_renombrar: { texto: 'Cambiar nombre', icono: 'renombrar' },
  hoja_templates: { texto: 'Templates', icono: 'archivo' },
  hoja_duplicar: { texto: 'Duplicar', icono: 'duplicar' },
  hoja_izquierda: { texto: 'Mover a la izquierda', icono: 'mover' },
  hoja_derecha: { texto: 'Mover a la derecha', icono: 'mover' },
  hoja_volver: { texto: 'Volver a su template', icono: 'restaurar' },
  hoja_eliminar: { texto: 'Eliminar hoja', icono: 'borrar' },
};

/** El título de la sección de cada opción. «AI Analyst» va primero y sin título; «Eliminar hoja», sola al final. */
export const SECCION_FICHA: Partial<Record<IdOpcionFicha, string>> = {
  whatsapp: 'Lead', copiar_telefono: 'Lead', copiar_email: 'Lead', partners_llevar: 'Lead', partners_ver: 'Lead',
  copiar_link: 'Compartir', exportar_csv: 'Compartir', exportar_pdf: 'Compartir',
  hoja_renombrar: 'Esta hoja', hoja_templates: 'Esta hoja', hoja_duplicar: 'Esta hoja', hoja_izquierda: 'Esta hoja',
  hoja_derecha: 'Esta hoja', hoja_volver: 'Esta hoja',
  historial: 'Ficha', guia: 'Ficha',
};

/**
 * Las opciones, en orden; `null` = un separador (sin separadores colgando). Entre secciones no va `null`: la raya la pone el
 * título de la sección (`itemsFicha`), como en el «⋯» de una columna.
 */
export function opcionesFicha(c: ContextoFicha): Array<IdOpcionFicha | null> {
  const h = c.hoja ?? null;
  const xs: Array<IdOpcionFicha | null> = [
    'analyst',
    ...(c.conTelefono ? ['whatsapp', 'copiar_telefono'] as const : []),
    ...(c.conEmail ? ['copiar_email' as const] : []),
    ...(c.partners === 'llevar' ? ['partners_llevar' as const] : c.partners === 'ver' ? ['partners_ver' as const] : []),
    'copiar_link', 'exportar_csv', 'exportar_pdf',
    ...(h?.renombrar ? ['hoja_renombrar' as const] : []),
    ...(h?.templates ? ['hoja_templates' as const] : []),
    ...(h?.duplicar ? ['hoja_duplicar' as const] : []),
    ...(h?.mover && (h.mover.izquierda || h.mover.derecha) ? ['hoja_izquierda', 'hoja_derecha'] as const : []),
    ...(h?.volver ? ['hoja_volver' as const] : []),
    ...(c.conHistorial ? ['historial' as const] : []),
    ...(c.puedeEditar ? ['guia' as const] : []),
    null,
    ...(h?.eliminar ? ['hoja_eliminar' as const] : []),
  ];
  const out: Array<IdOpcionFicha | null> = [];
  for (const x of xs) {
    if (x === null && (out.length === 0 || out[out.length - 1] === null)) continue;
    out.push(x);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/**
 * Los renglones que dibuja la pieza de la casa (app/_ui/MenuContextual.tsx): cada id con su texto, su ícono, el título de
 * su sección en el primero de cada una, y las flechas de la hoja en UNA línea (la que no tiene a dónde ir, apagada).
 */
export function itemsFicha(ids: ReadonlyArray<IdOpcionFicha | null>, d: { hoja?: HojaDelMenu | null; iconoIzquierda?: ReactElement; iconoDerecha?: ReactElement } = {}): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [];
  let seccion: string | null = null;
  const renglon = (id: IdOpcionFicha): ItemMenuContextual => ({
    id, label: OPCION_FICHA[id].texto, icono: OPCION_FICHA[id].icono, ...(id === 'hoja_eliminar' ? { peligro: true } : {}),
  });
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id === null) { out.push(null); continue; }
    let it: ItemMenuContextual = renglon(id);
    if (id === 'hoja_izquierda' && ids[i + 1] === 'hoja_derecha') {
      const m = d.hoja?.mover;
      it = {
        id: 'hoja_izquierda+hoja_derecha', label: 'Mover la hoja', conRotulo: true,
        enLinea: [
          { ...renglon('hoja_izquierda'), ...(d.iconoIzquierda ? { icono: d.iconoIzquierda } : {}), deshabilitado: !m?.izquierda },
          { ...renglon('hoja_derecha'), ...(d.iconoDerecha ? { icono: d.iconoDerecha } : {}), deshabilitado: !m?.derecha },
        ],
      };
      i++;
    }
    const s = SECCION_FICHA[id] ?? null;
    if (s && s !== seccion) { seccion = s; it = { ...it, seccion: s }; }
    out.push(it);
  }
  return out;
}

/** ¿El clic cayó donde el menú propio corresponde? No sobre algo editable, un link, ni con texto seleccionado. */
export function menuPropioEn(objetivo: { closest?: (sel: string) => unknown } | null, haySeleccion: boolean): boolean {
  if (haySeleccion) return false;
  if (!objetivo || typeof objetivo.closest !== 'function') return true;
  return !objetivo.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], a[href]');
}
