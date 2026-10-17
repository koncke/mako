// =============================================================================
// menu-contextual-crm — QUÉ ofrece el clic derecho del tablero del CRM, según dónde cae (puro)
// =============================================================================
// Pedido de Martín (14/10/2026), textual: «E implementa el click derecho en todo el CRM para
// diferentes acciones dependiendo donde clickee...». Esta tanda es el TABLERO (el Kanban y la tabla);
// la ficha del lead va después.
//
// Acá se decide sólo QUÉ sale y en qué orden (`opcionesCrm`) y cómo se arma cada renglón con los datos
// de la pantalla (`itemsCrm`). CÓMO se abre es de la pieza de la casa (app/_ui/MenuContextual.tsx) y QUÉ
// HACE cada opción es de la pantalla (`elegirContextual` en app/crm/CrmBoard.tsx), que no inventa
// ninguna: junta donde está el cursor las que el tablero ya tenía — el arrastre (`handleDrop`), la
// casilla, el tacho de la fila, la barra de lote (`ManijaLote`), el «⋯» de la columna y el «⋯» de la
// barra. tests/crm-menu-contextual.test.ts cruza cada id con su `case`.
//
// Cuatro lugares:
//   · una TARJETA del Kanban o una FILA de la tabla: el mismo menú (es el mismo lead);
//   · la CABECERA o el cuerpo de una COLUMNA (no sobre una tarjeta): lo del «⋯» de esa columna;
//   · el FONDO del tablero: lo del «⋯» de la barra.
// ⚠️ CON SELECCIÓN, EL CLIC SOBRE UN SELECCIONADO ACTÚA SOBRE LA SELECCIÓN: es lo que hace cualquier
//    explorador de archivos, y el menú de un solo lead sobre uno de doce tildados movería uno solo
//    pareciendo que mueve los doce. El clic sobre uno NO seleccionado es el menú de ese lead.
// ⚠️ LO QUE NO SE PUEDE, NO SALE (no se dibuja apagado): «si no se puede eliminar, no pongas
//    directamente esa opción, no la dejes en gris» (Martín, 29/09/2026). Y «Eliminar» va al final,
//    separado y en rojo. La única excepción son las flechas de una columna en la punta: van de a dos en
//    una línea, y esconder una dejaría la otra suelta; la que no puede ir se apaga.
// ⚠️ EL ROL NO ENTRA ACÁ: el tablero no lo recibe (app/crm/page.tsx no lo manda) y la barra de lote
//    tampoco lo mira. Lo que un rol no puede, lo rechaza el server, igual que desde los botones.
// =============================================================================

import type { ReactElement } from 'react';
import type { EntradaMenuContextual, ItemMenuContextual } from '@/app/_ui/MenuContextual';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export type IdOpcionCrm =
  // un lead
  | 'abrir' | 'mover_etapa' | 'whatsapp' | 'copiar_telefono' | 'copiar_email' | 'seleccionar' | 'quitar_seleccion' | 'eliminar'
  // la selección (las de app/crm/AccionesLoteLeads.tsx)
  | 'lote_etapa' | 'lote_etiqueta' | 'lote_closer' | 'lote_setter' | 'lote_funnel' | 'lote_limpiar' | 'lote_eliminar'
  // una columna (las del «⋯» de su cabecera, más el «＋ Nuevo lead» de su carril)
  | 'col_nuevo_lead' | 'col_izquierda' | 'col_derecha' | 'col_campanas' | 'col_curso_prender' | 'col_curso_apagar'
  | 'col_renombrar' | 'col_agregar' | 'col_eliminar'
  // el fondo (las del «⋯» de la barra)
  | 'nuevo_lead' | 'importar' | 'exportar' | 'editar_etapas';

/** Dónde cayó el clic y qué se sabe ahí. Lo arma la pantalla; acá no se lee el DOM. */
export type ContextoCrm =
  | {
    sobre: 'tarjeta' | 'fila';
    /** Hay número para wa.me (`telefonoNorm`). */
    conWhatsapp: boolean;
    conTelefono: boolean;
    conEmail: boolean;
    /** Este lead está tildado. */
    seleccionado: boolean;
    /** Cuántos tildados que todavía existen (`elegidos`). */
    seleccionados: number;
    /** Hay equipo: sin nadie, «Asignar closer» sería una lista vacía (la barra tampoco lo dibuja). */
    hayEquipo: boolean;
    /** Hay OTRO funnel al que agregar (`destinosDeLote`). */
    hayOtroFunnel: boolean;
  }
  | {
    sobre: 'columna';
    /** El MISMO predicado que el arrastre de la columna (`seArrastraCol`). */
    mover: boolean;
    /** Es la etapa de entrada: ahí van las campañas de Meta. */
    entrada: boolean;
    /** La invitación al curso al ganar: `null` = no se ofrece (no es Ganado, o el producto no tiene clases). */
    curso: boolean | null;
    /** Lo que el server sabe borrar (`colsBorrables`). */
    borrable: boolean;
  }
  | { sobre: 'fondo'; seleccionados: number };

/** Hay acciones de LOTE cuando el clic cae sobre un tildado y hay más de uno. Con uno solo, es su menú. */
export const esLote = (c: ContextoCrm): boolean =>
  (c.sobre === 'tarjeta' || c.sobre === 'fila') && c.seleccionado && c.seleccionados > 1;

/** Sin separadores al principio, al final ni dos seguidos (los grupos que quedan vacíos no dejan raya). */
function compactar(xs: ReadonlyArray<IdOpcionCrm | null>): Array<IdOpcionCrm | null> {
  const out: Array<IdOpcionCrm | null> = [];
  for (const x of xs) {
    if (x === null && (out.length === 0 || out[out.length - 1] === null)) continue;
    out.push(x);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** Las opciones, en orden. `null` = un separador. Vacío = no hay menú propio (sale el del navegador). */
export function opcionesCrm(c: ContextoCrm): Array<IdOpcionCrm | null> {
  if (c.sobre === 'fondo') {
    return compactar(['nuevo_lead', null, 'importar', 'exportar', null, 'editar_etapas', null, ...(c.seleccionados > 0 ? ['lote_limpiar' as const] : [])]);
  }
  if (c.sobre === 'columna') {
    return compactar([
      // Las flechas primero, como en el «⋯»: «debería estar primero de todos ese botón» (Martín,
      // 30/09/2026). Las dos van en UNA línea (`EN_LINEA`).
      ...(c.mover ? ['col_izquierda', 'col_derecha'] as const : []),
      null,
      'col_nuevo_lead',
      null,
      ...(c.entrada ? ['col_campanas' as const] : []),
      ...(c.curso === null ? [] : [c.curso ? 'col_curso_apagar' as const : 'col_curso_prender' as const]),
      'col_renombrar',
      'col_agregar',
      null,
      ...(c.borrable ? ['col_eliminar' as const] : []),
    ]);
  }
  if (esLote(c)) {
    return compactar([
      'lote_etapa', 'lote_etiqueta',
      ...(c.hayEquipo ? ['lote_closer', 'lote_setter'] as const : []),
      ...(c.hayOtroFunnel ? ['lote_funnel' as const] : []),
      null,
      'lote_limpiar',
      null,
      'lote_eliminar',
    ]);
  }
  return compactar([
    'abrir', 'mover_etapa',
    null,
    ...(c.conWhatsapp ? ['whatsapp' as const] : []),
    ...(c.conTelefono ? ['copiar_telefono' as const] : []),
    ...(c.conEmail ? ['copiar_email' as const] : []),
    null,
    c.seleccionado ? 'quitar_seleccion' : 'seleccionar',
    null,
    'eliminar',
  ]);
}

/** Las que van JUNTAS en una línea de botones sin rótulo (las flechas de la columna). */
export const EN_LINEA: ReadonlyArray<readonly [IdOpcionCrm, IdOpcionCrm]> = [['col_izquierda', 'col_derecha']];

/**
 * Cómo se lee y con qué ícono va cada opción (el set de la casa, AGENTS.md: «un desplegable lleva ícono»).
 * Corto: es texto que se dibuja. Español neutro con tuteo, como el resto de la pantalla.
 * ⚠️ Los de la columna son LOS MISMOS del «⋯» de la cabecera (tests/crm-menu-contextual.test.ts los cruza).
 */
export const OPCION_CRM: Readonly<Record<IdOpcionCrm, { texto: string; icono: NombreIconoMenu; peligro?: true }>> = {
  abrir: { texto: 'Abrir ficha', icono: 'ver' },
  mover_etapa: { texto: 'Mover a etapa', icono: 'etapa' },
  whatsapp: { texto: 'Escribir por WhatsApp', icono: 'whatsapp' },
  copiar_telefono: { texto: 'Copiar teléfono', icono: 'telefono' },
  copiar_email: { texto: 'Copiar email', icono: 'email' },
  seleccionar: { texto: 'Seleccionar', icono: 'check' },
  quitar_seleccion: { texto: 'Quitar de la selección', icono: 'quitar' },
  eliminar: { texto: 'Eliminar', icono: 'borrar', peligro: true },
  lote_etapa: { texto: 'Mover a etapa', icono: 'etapa' },
  lote_etiqueta: { texto: 'Agregar etiqueta', icono: 'etiqueta-mas' },
  lote_closer: { texto: 'Asignar closer', icono: 'persona' },
  lote_setter: { texto: 'Asignar setter', icono: 'persona' },
  lote_funnel: { texto: 'Agregar a un funnel', icono: 'producto' },
  lote_limpiar: { texto: 'Quitar la selección', icono: 'quitar' },
  lote_eliminar: { texto: 'Eliminar', icono: 'borrar', peligro: true },
  col_nuevo_lead: { texto: 'Nuevo lead', icono: 'persona-mas' },
  col_izquierda: { texto: 'Mover a la izquierda', icono: 'mover' },
  col_derecha: { texto: 'Mover a la derecha', icono: 'mover' },
  // «Asignar campañas» desde el 16/10/2026, como el «⋯» (que lleva el logo de Meta; acá van sólo los íconos de la casa).
  col_campanas: { texto: 'Asignar campañas', icono: 'anuncio' },
  col_curso_prender: { texto: 'Invitar al curso al ganar', icono: 'curso' },
  col_curso_apagar: { texto: 'Dejar de invitar al curso', icono: 'curso' },
  col_renombrar: { texto: 'Cambiar el nombre', icono: 'renombrar' },
  col_agregar: { texto: 'Agregar etapa', icono: 'agregar' },
  col_eliminar: { texto: 'Eliminar etapa', icono: 'borrar', peligro: true },
  nuevo_lead: { texto: 'Nuevo lead', icono: 'persona-mas' },
  importar: { texto: 'Importar leads', icono: 'subir' },
  exportar: { texto: 'Exportar leads', icono: 'descargar' },
  editar_etapas: { texto: 'Editar las etapas', icono: 'etapa' },
};

/**
 * El título del menú: sobre CUÁNTOS actúa, cuando no es obvio. Sólo el de lote lo lleva — con doce
 * tildados en cuatro columnas, «Eliminar» sin el número no dice qué se va.
 */
export const tituloCrm = (c: ContextoCrm): string | undefined =>
  (esLote(c) && (c.sobre === 'tarjeta' || c.sobre === 'fila') ? `${c.seleccionados} leads` : undefined);

/** El id con que viaja el funnel del negocio en «Agregar a un funnel» (el mismo `'default'` del desplegable de la barra). */
export const FUNNEL_DEL_NEGOCIO = 'default';

/** Lo que la pantalla sabe y los submenús necesitan. */
export type DatosMenuCrm = {
  /** Las etapas del embudo, en el orden del desplegable «Etapa» de la barra, con su color. */
  etapas: ReadonlyArray<{ key: string; label: string; color: string }>;
  /** Dónde está el lead del clic: esa etapa no sale en «Mover a etapa» (soltarlo ahí no hace nada). */
  etapaActual?: string | null;
  /** El equipo, con su foto (una persona va con su avatar, no con un ícono). */
  equipo: ReadonlyArray<{ nombre: string; foto: string | null }>;
  /** Las etiquetas vivas del negocio. `null` = todavía no llegaron. */
  etiquetas: ReadonlyArray<{ id: number; nombre: string; color: string }> | null;
  /** Lo que dice el submenú de etiquetas vacío (cargando, o no se pudieron leer). */
  sinEtiquetas?: string;
  /** A qué funnels se puede AGREGAR la selección (`destinosDeLote`: todos menos el que se mira). */
  funnels: ReadonlyArray<{ fid: number | null; nombre: string }>;
  /** Las flechas de la columna: hacia dónde se puede ir, y con qué dibujo (el mismo del «⋯»). */
  flechas?: { izquierda: boolean; derecha: boolean; iconoIzquierda?: ReactElement; iconoDerecha?: ReactElement };
};

function renglon(id: IdOpcionCrm): ItemMenuContextual {
  const o = OPCION_CRM[id];
  return { id, label: o.texto, icono: o.icono, ...(o.peligro ? { peligro: true } : {}) };
}

function conDatos(id: IdOpcionCrm, d: DatosMenuCrm): ItemMenuContextual {
  const base = renglon(id);
  switch (id) {
    case 'mover_etapa':
    case 'lote_etapa': {
      // En lote, todas: los tildados están en etapas distintas, y la barra tampoco saca ninguna.
      const actual = id === 'mover_etapa' ? d.etapaActual ?? null : null;
      return { ...base, hijos: d.etapas.filter((s) => s.key !== actual).map((s) => ({ id: s.key, label: s.label, color: s.color })) };
    }
    case 'lote_closer':
    case 'lote_setter':
      return { ...base, hijos: d.equipo.map((m) => ({ id: m.nombre, label: m.nombre, avatar: m.foto })) };
    case 'lote_etiqueta':
      return {
        ...base,
        hijos: (d.etiquetas ?? []).map((e) => ({ id: String(e.id), label: e.nombre, color: e.color })),
        vacio: d.sinEtiquetas ?? (d.etiquetas ? 'Sin etiquetas' : 'Cargando…'),
      };
    case 'lote_funnel':
      return { ...base, hijos: d.funnels.map((f) => ({ id: f.fid == null ? FUNNEL_DEL_NEGOCIO : String(f.fid), label: f.nombre })) };
    case 'col_izquierda':
      return { ...base, ...(d.flechas?.iconoIzquierda ? { icono: d.flechas.iconoIzquierda } : {}), deshabilitado: d.flechas ? !d.flechas.izquierda : false };
    case 'col_derecha':
      return { ...base, ...(d.flechas?.iconoDerecha ? { icono: d.flechas.iconoDerecha } : {}), deshabilitado: d.flechas ? !d.flechas.derecha : false };
    default:
      return base;
  }
}

/**
 * Los renglones que dibuja la pieza de la casa, en el orden de `opcionesCrm`: cada id con su texto, su
 * ícono y, si abre submenú, sus hijos. Elegir un hijo llega a la pantalla como `(hijo, padre)`: el padre
 * es la opción (`lote_closer`) y el hijo, el valor (el nombre de la persona).
 */
export function itemsCrm(ids: ReadonlyArray<IdOpcionCrm | null>, d: DatosMenuCrm): EntradaMenuContextual[] {
  const out: EntradaMenuContextual[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id === null) { out.push(null); continue; }
    const par = EN_LINEA.find(([a]) => a === id);
    if (par && ids[i + 1] === par[1]) {
      out.push({ id: `${par[0]}+${par[1]}`, label: 'Mover la etapa', enLinea: [conDatos(par[0], d), conDatos(par[1], d)] });
      i++;
      continue;
    }
    out.push(conDatos(id, d));
  }
  return out;
}
