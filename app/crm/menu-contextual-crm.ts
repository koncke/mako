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
import { ICONO_FUNNEL } from '@/app/_ui/icono-funnel';
import { NOMBRE_TIPO_ETAPA, TIPOS_ETAPA, type TipoEtapa } from '@/lib/etapa-reunion';
import { ORDEN_KANBAN, type OrdenKanban } from './orden-kanban';
import { textoDifusionDeColumna } from './seleccion-difusion';

export type IdOpcionCrm =
  // un lead
  | 'abrir' | 'mover_etapa' | 'whatsapp' | 'copiar_telefono' | 'copiar_email' | 'seleccionar' | 'quitar_seleccion' | 'eliminar'
  // el asistente «¿Qué hacer ahora?» (24/10/2026): una nutrición manual vencida o una reunión que pasó sin desenlace
  | 'que_hacer'
  // la TARJETA del Kanban (21/10/2026): el pop-up de «Personalizar tarjetas» del «⋯» de la barra
  | 'personalizar_tarjeta'
  // el lead en una automatización (22/10/2026): sacarlo de todas las que le corren (app/crm/automatizacion-lead.ts)
  | 'frenar_automatizacion'
  // MaKo Partners (17/10/2026): sólo el admin de una agencia
  | 'partners_llevar' | 'partners_ver'
  // la selección (las de app/crm/AccionesLoteLeads.tsx)
  | 'lote_etapa' | 'lote_etiqueta' | 'lote_closer' | 'lote_setter' | 'lote_funnel' | 'lote_frenar' | 'lote_limpiar' | 'lote_eliminar'
  // una columna (las del «⋯» de su cabecera; «Nuevo lead» vive ahí desde el 21/10/2026)
  | 'col_nuevo_lead' | 'col_ordenar' | 'col_difusion' | 'col_izquierda' | 'col_derecha' | 'col_campanas' | 'col_evento' | 'col_cobro' | 'col_tipo' | 'col_curso_prender' | 'col_curso_apagar'
  | 'col_renombrar' | 'col_agregar' | 'col_eliminar'
  // el fondo (las del «⋯» de la barra)
  | 'nuevo_lead' | 'importar' | 'exportar' | 'editar_etapas' | 'personalizar_tarjetas';

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
    /**
     * MaKo Partners (Martín, 17/10/2026: «si un usuario se unió al programa de "MaKo Partners", que le aparezca la
     * opción en el CRM para llevarlos allí»). `llevar` = abrirle su cuenta; `ver` = ya la tiene (`leads.cliente_ws`).
     * Ausente o null: no se ofrece — el workspace no es agencia, o quien mira no es su admin (/partners y
     * `llevarAPartnersAction` lo exigen).
     */
    partners?: 'llevar' | 'ver' | null;
    /** Este lead está en una automatización (22/10/2026): se ofrece «Frenar automatización». */
    enAutomatizacion?: boolean;
    /** Tiene algo que decidir (24/10/2026): nutrición manual vencida o reunión pasada sin desenlace. Se ofrece «¿Qué hacer ahora?». */
    queHacer?: boolean;
    /** Cuántos de los tildados están en una automatización: con alguno, el lote ofrece «Frenar automatización». */
    loteEnAutomatizacion?: number;
  }
  | {
    sobre: 'columna';
    /** El MISMO predicado que el arrastre de la columna (`seArrastraCol`). */
    mover: boolean;
    /** Es la etapa de entrada: ahí van las campañas de Meta. */
    entrada: boolean;
    /** Es una etapa de reunión: ahí se asigna el evento de agenda cuyas reservas caen en ella. */
    reunion?: boolean;
    /** Es Ganado (22/10/2026): ahí se vincula el producto que cobra («Vincular cobro», app/crm/CobroDeEtapaModal.tsx). */
    ganado?: boolean;
    /** Lleva «Tipo de etapa» (21/10/2026; `columnaConTipo`, lib/etapa-reunion.ts): ni la entrada, ni el cierre, ni las terminales. */
    tipo?: boolean;
    /** La invitación al curso al ganar: `null` = no se ofrece (no es Ganado, o el producto no tiene clases). */
    curso: boolean | null;
    /** Lo que el server sabe borrar (`colsBorrables`). */
    borrable: boolean;
    /** «Mandar mensaje de difusión» (29/10/2026): cuántas tarjetas se ven y si hay filtros. null = no se ofrece (columna vacía,
     *  o no es el admin: la difusión es sólo del admin, app/automations/difusion/actions.ts). */
    difusion?: { visibles: number; filtrado: boolean } | null;
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
    // El MISMO orden que el «⋯» de la barra (`AccionesHeader`): lo que trae leads, lo que los saca, y la configuración.
    return compactar(['nuevo_lead', null, 'importar', 'exportar', null, 'editar_etapas', 'personalizar_tarjetas', null, ...(c.seleccionados > 0 ? ['lote_limpiar' as const] : [])]);
  }
  if (c.sobre === 'columna') {
    // ⚠️ POR SECCIONES (22/10/2026, Martín: «Ordena las opciones del desplegable de los 3 puntos... Ya no se entienden si
    // son tantas, ponlas en secciones»). Es el MISMO menú en el «⋯» y en el clic derecho: el «⋯» abre esta lista. Los
    // títulos los pone `SECCION_COLUMNA` (en `itemsCrm`), así que entre secciones no va `null`: la raya la pone el título.
    // ⚠️ EL ORDEN ES EL DEL 24/10/2026. Martín, textual: «En los 3 puntos de cada columna, lo primero debe ser nuevo lead. Y
    // el editor de columnas abajo del todo, claro que eliminar siempre por ultimo. Y que no diga "Cambiar EL nombre", solo
    // "Cambiar nombre". Y ahí pon la opción de "ordenar"». Hasta ahí las flechas iban PRIMERO (30/09/2026: «debería estar
    // primero de todos ese botón»); el pedido nuevo lo da vuelta.
    //   · Leads: «Nuevo lead» primero, «Ordenar ›» (lo de esta columna, app/crm/orden-kanban.ts) y las campañas que entran.
    //   · Etapa: lo de ESTA etapa (su nombre, su tipo, su evento, su cobro, el curso al ganar).
    //   · Columnas, abajo del todo: las flechas en UNA línea (`EN_LINEA`) y «Agregar etapa», que también cambia las columnas.
    //   · «Eliminar etapa», sola al final y en rojo.
    return compactar([
      'col_nuevo_lead',
      'col_ordenar',
      // La difusión a la columna entera (Leila, 29/10/2026): «Leads», porque es a quiénes le llega, no a la etapa.
      ...(c.difusion ? ['col_difusion' as const] : []),
      ...(c.entrada ? ['col_campanas' as const] : []),
      'col_renombrar',
      ...(c.tipo ? ['col_tipo' as const] : []),
      ...(c.reunion ? ['col_evento' as const] : []),
      ...(c.ganado ? ['col_cobro' as const] : []),
      ...(c.curso === null ? [] : [c.curso ? 'col_curso_apagar' as const : 'col_curso_prender' as const]),
      ...(c.mover ? ['col_izquierda', 'col_derecha'] as const : []),
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
      ...((c.loteEnAutomatizacion ?? 0) > 0 ? ['lote_frenar' as const] : []),
      null,
      'lote_limpiar',
      null,
      'lote_eliminar',
    ]);
  }
  // «Seleccionar» va con abrir y mover (24/10/2026, Martín: «revisa el orden y los botones de los desplegables, tal vez sobran
  // botones o estan desordenados»): solo entre dos rayas era un grupo de un renglón.
  return compactar([
    'abrir', ...(c.queHacer ? ['que_hacer' as const] : []), 'mover_etapa', c.seleccionado ? 'quitar_seleccion' : 'seleccionar',
    null,
    ...(c.conWhatsapp ? ['whatsapp' as const] : []),
    ...(c.conTelefono ? ['copiar_telefono' as const] : []),
    ...(c.conEmail ? ['copiar_email' as const] : []),
    null,
    ...(c.partners === 'llevar' ? ['partners_llevar' as const] : c.partners === 'ver' ? ['partners_ver' as const] : []),
    null,
    // «Si le doy click derecho a las cards, debería poder ver la opción de "Personalizar tarjeta"» (Martín, 21/10/2026).
    // Sólo en la TARJETA: la fila de la lista no es una tarjeta.
    ...(c.sobre === 'tarjeta' ? ['personalizar_tarjeta' as const] : []),
    null,
    ...(c.enAutomatizacion ? ['frenar_automatizacion' as const] : []),
    null,
    'eliminar',
  ]);
}

/** Lo que dice el aviso de una columna sin su vínculo (el «⋯» y el renglón que lo arregla). */
export const AVISO_VINCULO = { evento: 'Sin evento vinculado', cobro: 'Sin cobro vinculado' } as const;

/** El título de la sección de cada opción de una columna (22/10/2026). «Eliminar etapa» no lleva: va sola, separada. */
export const SECCION_COLUMNA: Partial<Record<IdOpcionCrm, string>> = {
  col_izquierda: 'Columnas', col_derecha: 'Columnas', col_agregar: 'Columnas',
  col_nuevo_lead: 'Leads', col_ordenar: 'Leads', col_difusion: 'Leads', col_campanas: 'Leads',
  col_renombrar: 'Etapa', col_tipo: 'Etapa', col_evento: 'Etapa', col_cobro: 'Etapa', col_curso_prender: 'Etapa', col_curso_apagar: 'Etapa',
};

/** El ícono de cada tipo de etapa (el submenú de «Tipo de etapa» y su pop-up). */
export const ICONO_TIPO_ETAPA: Readonly<Record<TipoEtapa, NombreIconoMenu>> = { etapa: 'etapa', reunion: 'evento', nutricion: 'repetir' };

/** El ícono de cada criterio de «Ordenar ›». */
export const ICONO_ORDEN: Readonly<Record<OrdenKanban, NombreIconoMenu>> = {
  manual: 'mover', llegada: 'arriba', antiguos: 'abajo', nombre: 'texto', respondio: 'check', monto: 'dinero', reunion: 'evento', vence: 'cronometro',
};

/** Las que van JUNTAS en una línea (las flechas de la columna), con el rótulo «Mover la etapa» a la izquierda (`conRotulo`). */
export const EN_LINEA: ReadonlyArray<readonly [IdOpcionCrm, IdOpcionCrm]> = [['col_izquierda', 'col_derecha']];

/**
 * Cómo se lee y con qué ícono va cada opción (el set de la casa, AGENTS.md: «un desplegable lleva ícono»).
 * Corto: es texto que se dibuja. Español neutro con tuteo, como el resto de la pantalla.
 * ⚠️ Los de la columna son LOS MISMOS del «⋯» de la cabecera (tests/crm-menu-contextual.test.ts los cruza).
 */
export const OPCION_CRM: Readonly<Record<IdOpcionCrm, { texto: string; icono: NombreIconoMenu; peligro?: true }>> = {
  abrir: { texto: 'Abrir ficha', icono: 'ver' },
  que_hacer: { texto: '¿Qué hacer ahora?', icono: 'pregunta' },
  mover_etapa: { texto: 'Mover a etapa', icono: 'etapa' },
  whatsapp: { texto: 'Escribir por WhatsApp', icono: 'whatsapp' },
  copiar_telefono: { texto: 'Copiar teléfono', icono: 'telefono' },
  copiar_email: { texto: 'Copiar email', icono: 'email' },
  partners_llevar: { texto: 'Abrirle su cuenta de MaKo', icono: 'cliente' },
  partners_ver: { texto: 'Ver en Agency Dashboard', icono: 'cliente' },
  seleccionar: { texto: 'Seleccionar', icono: 'check' },
  quitar_seleccion: { texto: 'Quitar de la selección', icono: 'quitar' },
  eliminar: { texto: 'Eliminar', icono: 'borrar', peligro: true },
  personalizar_tarjeta: { texto: 'Personalizar tarjeta', icono: 'configurar' },
  frenar_automatizacion: { texto: 'Frenar automatización', icono: 'pausar', peligro: true },
  lote_etapa: { texto: 'Mover a etapa', icono: 'etapa' },
  lote_etiqueta: { texto: 'Agregar etiqueta', icono: 'etiqueta-mas' },
  lote_closer: { texto: 'Asignar closer', icono: 'persona' },
  lote_setter: { texto: 'Asignar setter', icono: 'persona' },
  lote_funnel: { texto: 'Agregar a un funnel', icono: ICONO_FUNNEL },
  lote_limpiar: { texto: 'Quitar selección', icono: 'quitar' },
  lote_frenar: { texto: 'Frenar automatización', icono: 'pausar', peligro: true },
  lote_eliminar: { texto: 'Eliminar', icono: 'borrar', peligro: true },
  col_nuevo_lead: { texto: 'Nuevo lead', icono: 'persona-mas' },
  col_ordenar: { texto: 'Ordenar', icono: 'ordenar' },
  col_difusion: { texto: 'Mandar mensaje de difusión', icono: 'enviar' },
  col_izquierda: { texto: 'Mover a la izquierda', icono: 'mover' },
  col_derecha: { texto: 'Mover a la derecha', icono: 'mover' },
  // «Asignar campañas» desde el 16/10/2026, como el «⋯» (que lleva el logo de Meta; acá van sólo los íconos de la casa).
  col_campanas: { texto: 'Asignar campañas', icono: 'anuncio' },
  // «Asignar evento» pasa a llamarse «Vincular evento» (Martín, 22/10/2026), como «Vincular cobro».
  col_evento: { texto: 'Vincular evento', icono: 'evento' },
  col_cobro: { texto: 'Vincular cobro', icono: 'dinero' },
  col_tipo: { texto: 'Tipo de etapa', icono: 'etapa' },
  col_curso_prender: { texto: 'Invitar al curso al ganar', icono: 'curso' },
  col_curso_apagar: { texto: 'Dejar de invitar al curso', icono: 'curso' },
  col_renombrar: { texto: 'Cambiar nombre', icono: 'renombrar' },
  col_agregar: { texto: 'Agregar etapa', icono: 'agregar' },
  col_eliminar: { texto: 'Eliminar etapa', icono: 'borrar', peligro: true },
  nuevo_lead: { texto: 'Nuevo lead', icono: 'persona-mas' },
  importar: { texto: 'Importar leads', icono: 'subir' },
  exportar: { texto: 'Exportar leads', icono: 'descargar' },
  editar_etapas: { texto: 'Editar etapas', icono: 'etapa' },
  personalizar_tarjetas: { texto: 'Personalizar tarjetas', icono: 'configurar' },
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
  /** Lo que le falta a la columna (22/10/2026): el renglón que lo arregla lleva el aviso (`AVISO_VINCULO`). */
  avisos?: Partial<Record<IdOpcionCrm, string>>;
  /** El logo de Meta de «Asignar campañas» («La primera opción debería decir "Asignar campañas" y con el logo de Meta»,
   *  Martín, 16/10/2026): un dibujo de la pantalla, como las flechas. Sin él, el ícono del set. */
  logoMeta?: ReactElement;
  /** El tipo de la columna HOY (22/10/2026): «Tipo de etapa ›» abre los tres, con el actual tildado, y se cambia ahí. */
  tipoActual?: TipoEtapa | null;
  /** «Ordenar ›» de la columna (24/10/2026): los criterios que tiene con qué (`ordenesDeColumna`) y el de hoy, tildado. */
  orden?: { opciones: ReadonlyArray<OrdenKanban>; actual: OrdenKanban };
  /** Las flechas de la columna: hacia dónde se puede ir, y con qué dibujo (el mismo del «⋯»). */
  flechas?: { izquierda: boolean; derecha: boolean; iconoIzquierda?: ReactElement; iconoDerecha?: ReactElement };
  /** La difusión de la columna: con filtros dice «los N que se ven» (`textoDifusionDeColumna`). */
  difusion?: { visibles: number; filtrado: boolean } | null;
};

function renglon(id: IdOpcionCrm): ItemMenuContextual {
  const o = OPCION_CRM[id];
  return { id, label: o.texto, icono: o.icono, ...(o.peligro ? { peligro: true } : {}) };
}

function conDatos(id: IdOpcionCrm, d: DatosMenuCrm): ItemMenuContextual {
  const base = { ...renglon(id), ...(d.avisos?.[id] ? { aviso: d.avisos[id] } : {}) };
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
    case 'col_campanas':
      return d.logoMeta ? { ...base, icono: d.logoMeta } : base;
    case 'col_tipo':
      // «Al apretar o pasar el cursor me debería abrir un segundo desplegable allí mismo para ver el tipo de etapa actual y
      // poder cambiarlo» (Martín, 22/10/2026). Sin el tipo actual (no se sabe), el renglón abre el pop-up de siempre.
      return d.tipoActual ? {
        ...base,
        hijos: TIPOS_ETAPA.map((t) => ({ id: t, label: NOMBRE_TIPO_ETAPA[t], icono: ICONO_TIPO_ETAPA[t], marcado: t === d.tipoActual })),
      } : base;
    case 'col_ordenar': {
      const o = d.orden;
      return o ? { ...base, hijos: o.opciones.map((x) => ({ id: x, label: ORDEN_KANBAN[x], icono: ICONO_ORDEN[x], marcado: x === o.actual })) } : base;
    }
    case 'col_difusion':
      return d.difusion ? { ...base, label: textoDifusionDeColumna(d.difusion.visibles, d.difusion.filtrado) } : base;
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
  // El título va en el PRIMER renglón de cada sección que quedó (una sección sin renglones no deja título).
  let seccion: string | null = null;
  const conSeccion = (id: IdOpcionCrm, it: ItemMenuContextual): ItemMenuContextual => {
    const s = SECCION_COLUMNA[id] ?? null;
    if (!s || s === seccion) return it;
    seccion = s;
    return { ...it, seccion: s };
  };
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id === null) { out.push(null); continue; }
    const par = EN_LINEA.find(([a]) => a === id);
    if (par && ids[i + 1] === par[1]) {
      out.push(conSeccion(id, { id: `${par[0]}+${par[1]}`, label: 'Mover la etapa', conRotulo: true, enLinea: [conDatos(par[0], d), conDatos(par[1], d)] }));
      i++;
      continue;
    }
    out.push(conSeccion(id, conDatos(id, d)));
  }
  return out;
}
