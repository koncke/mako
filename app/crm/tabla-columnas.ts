// =============================================================================
// Las columnas de la vista LISTA de /crm, según el ancho que hay (21/10/2026)
// =============================================================================
// EL CASO (Martín, 21/10/2026): /crm en lista, en un escritorio chico (su Chrome al 60 % de 1920×1080 con escala 125 % =
// unos 934×639 px de CSS). Los encabezados se pisaban («¿AGENDÓMONTCREADO»), la etapa «Nutrición – Reactivación» se montaba
// sobre la fecha y el nombre y el email se cortaban a 8 letras («Daniel F…»). La tabla repartía SIETE columnas en
// fracciones fijas (`34px 2fr 1.4fr 1.5fr 1.25fr .95fr .95fr .8fr 64px`): con la barra lateral abierta le quedan unos
// 600 px, y 1fr eran 41 px.
//
// La regla, en positivo:
//  · cada columna tiene un MÍNIMO con el que se lee (el nombre, 170 px: un nombre y un apellido; la etapa, 140) y una
//    PRIORIDAD. Entran en orden de prioridad mientras quepan con su mínimo; las demás se ocultan (la ficha las tiene);
//  · la Empresa que no entra pasa a la FILA, debajo del nombre, junto al email: no se pierde un dato que se lee de corrido;
//  · el nombre, la etapa y las acciones están SIEMPRE;
//  · la primera columna que no entra corta: no se salta a una más chica de menos prioridad;
//  · lo que entra se dibuja en el orden de siempre, no en el de prioridad;
//  · sin medir todavía (el primer render), entran todas: es lo de siempre en un escritorio grande.
// PURO: lo usan app/crm/CrmBoard.tsx y tests/crm-lista-escritorio-chico.test.ts.
// =============================================================================

export type ColumnaLista = 'nombre' | 'empresa' | 'origen' | 'etapa' | 'agenda' | 'monto' | 'creado';

type DefColumna = { min: number; fr: number };

/** El mínimo con que se LEE cada columna (px) y su parte del sobrante. */
const COLUMNAS: Readonly<Record<ColumnaLista, DefColumna>> = {
  nombre: { min: 170, fr: 2 },
  empresa: { min: 120, fr: 1.4 },
  origen: { min: 110, fr: 1.3 },
  etapa: { min: 140, fr: 1.4 },
  // «¿AGENDÓ?» en versalitas con su espaciado mide ~70 px; con la flecha de orden, ~82.
  agenda: { min: 92, fr: 0.95 },
  monto: { min: 84, fr: 0.9 },
  // «21/10/2026» y «CREADO» con su flecha.
  creado: { min: 88, fr: 0.8 },
};

/** El orden en pantalla: el de siempre. */
export const ORDEN_EN_PANTALLA: readonly ColumnaLista[] = ['nombre', 'empresa', 'origen', 'etapa', 'agenda', 'monto', 'creado'];

/** Quién entra primero cuando no hay lugar para todas. */
export const PRIORIDAD: readonly ColumnaLista[] = ['nombre', 'etapa', 'agenda', 'creado', 'empresa', 'monto', 'origen'];

/** Las que están siempre: sin el nombre no se sabe de quién es la fila; sin la etapa, la lista del CRM no dice nada. */
const SIEMPRE: ReadonlySet<ColumnaLista> = new Set(['nombre', 'etapa']);

/** Lo fijo de la fila: la casilla, las acciones, el espacio entre columnas y el relleno de los costados. */
export const FIJO = { casilla: 34, acciones: 64, hueco: 12, relleno: 22 } as const;

/**
 * Las columnas que entran en una tabla de `ancho` px (el ancho del recuadro, con su relleno), en el orden de pantalla.
 * `null` = todavía no se midió: entran todas.
 */
export function columnasQueEntran(ancho: number | null): ColumnaLista[] {
  if (ancho == null || !Number.isFinite(ancho)) return [...ORDEN_EN_PANTALLA];
  // Lo que queda para las columnas: el recuadro menos el relleno, la casilla, las acciones y sus dos huecos.
  let libre = ancho - FIJO.relleno * 2 - FIJO.casilla - FIJO.acciones - FIJO.hueco * 2;
  const entran = new Set<ColumnaLista>();
  for (const c of PRIORIDAD) {
    const costo = COLUMNAS[c].min + (entran.size ? FIJO.hueco : 0);
    if (SIEMPRE.has(c) || costo <= libre) { entran.add(c); libre -= costo; continue; }
    // La primera que no entra corta: una de menos prioridad no ocupa el lugar de otra que importa más (a 1024 px con la
    // barra abierta entraba «Monto» y no «Creado»).
    break;
  }
  return ORDEN_EN_PANTALLA.filter((c) => entran.has(c));
}

/** El `grid-template-columns` de esas columnas: el MISMO para el encabezado y para cada fila. */
export function plantillaDeColumnas(cols: readonly ColumnaLista[]): string {
  const medio = cols.map((c) => `minmax(${COLUMNAS[c].min}px, ${COLUMNAS[c].fr}fr)`);
  return [`${FIJO.casilla}px`, ...medio, `${FIJO.acciones}px`].join(' ');
}

/** El ancho mínimo de la fila con esas columnas: si el recuadro es más chico (sólo las de siempre), la tabla scrollea de costado. */
export function anchoMinimo(cols: readonly ColumnaLista[]): number {
  return FIJO.relleno * 2 + FIJO.casilla + FIJO.acciones + cols.reduce((s, c) => s + COLUMNAS[c].min, 0) + FIJO.hueco * (cols.length + 1);
}
