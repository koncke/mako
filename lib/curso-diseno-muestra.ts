// =============================================================================
// curso-diseno-muestra — los datos de EJEMPLO de la hoja «Curso o comunidad» (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/curso-vitrea/), inventados: ninguna persona ni número real. Tienen la
// FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts) y del Calendario de General, así la
// miniatura pasa por el mismo `vistaCurso` que la hoja de verdad. Las cifras cierran entre tarjetas: los alumnos por estado y por
// área suman los alumnos activos, las clases de cada semana suman las del período y los tramos suman los clientes de la cartera.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { ItemCalendario } from './calendario-modelo';
import type { CalendarioDeGeneral } from './curso-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Los alumnos que vieron alguna clase cada día de los últimos 30.
const POR_DIA = [21, 24, 19, 17, 26, 31, 28, 22, 20, 25, 33, 30, 27, 23, 19, 22, 29, 35, 32, 26, 24, 22, 27, 30, 36, 33, 28, 25, 27, 31];
// Las clases vistas cada semana (las últimas cinco): suman las del período.
const POR_SEMANA = [96, 118, 104, 131, 142];
// [estado, alumnos]: suman los activos (148).
const ESTADOS: Array<[string, number]> = [['Al día', 71], ['Empezando', 38], ['Atrasado', 22], ['Sin empezar', 11], ['Terminó', 6]];
// [área, alumnos]: suman los activos.
const AREAS: Array<[string, number]> = [['Ventas', 42], ['Marketing', 34], ['Contenido', 27], ['Finanzas', 19], ['Mentalidad', 16], ['Operaciones', 10]];
// [tramo, clientes]: suman la cartera (64).
const TRAMOS: Array<[string, number]> = [['0-7 días', 29], ['8-14 días', 14], ['15-30 días', 11], ['Más de 30 días', 7], ['Nunca', 3]];
// [cliente, señal, último contacto]: los que piden atención primero.
const QUIEN: Array<[string, string, string]> = [
  ['Ana Ruiz', 'Atención', 'Más de 30 días'], ['Diego Paz', 'Atención', '15-30 días'], ['Laura Méndez', 'Atención', '15-30 días'],
  ['Carlos Ibarra', 'Bien', '8-14 días'], ['Marta Solís', 'Bien', '0-7 días'],
];

export function datosCursoMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, r: Resultado) => { if (k) out[k] = { resultado: r }; };
  const activos = ESTADOS.reduce((a, e) => a + e[1], 0), clases = POR_SEMANA.reduce((a, b) => a + b, 0);
  const cartera = TRAMOS.reduce((a, t) => a + t[1], 0), atencion = QUIEN.filter((q) => q[1] === 'Atención').length;
  const uno = (metrica: string, v: number, antes?: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], ...(antes != null ? { anterior: [antes] } : {}), fuera: 0, clase: null });
  const cat = (metrica: string, fs: Array<[string, number]>, tot: number): Resultado => ({ columnas: col([metrica]), totales: [tot], fuera: 0, clase: 'categoria', filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) });
  poner(p.apertura, uno('clases', clases, 528));
  poner(p.alumnos, uno('alumnos', activos, 136));
  poner(p.ventas, uno('cierres', 9, 7));
  poner(p.cobrado, uno('cobrado', 14250, 12900));
  poner(p.atencion, uno('atencion', atencion));
  poner(p.avance, uno('avance', 62));
  poner(p.tendencia, { columnas: col(['alumnos']), totales: [activos], fuera: 0, clase: 'tiempo', filas: POR_DIA.map((v, i) => { const d = dia(hoy, i - (POR_DIA.length - 1)); return { clave: d, etiqueta: d, valores: [v] }; }) });
  poner(p.semana, { columnas: col(['clases']), totales: [clases], fuera: 0, clase: 'tiempo', filas: POR_SEMANA.map((v, i) => { const d = dia(hoy, -7 * (POR_SEMANA.length - 1 - i)); return { clave: d, etiqueta: d, valores: [v] }; }) });
  poner(p.estado, cat('alumnos', ESTADOS, activos));
  poner(p.area, cat('alumnos', AREAS, activos));
  poner(p.contacto, cat('clientes', TRAMOS, cartera));
  poner(p.quien, {
    columnas: col(['atencion', 'deuda_vencida_usd', 'sesiones']), totales: [atencion, 0, 0], fuera: 0, clase: 'categoria',
    filas: QUIEN.map(([nombre, senal, tramo], i) => ({ clave: nombre, etiqueta: nombre, valores: [senal === 'Atención' ? 1 : 0, 0, 4 - (i % 3)], extra: { senal, tramo_contacto: tramo } })),
  });
  return out;
}

/** El Calendario de ejemplo: tres publicaciones que vienen y lo de hoy (la primera ya pasó). Las horas son en UTC, la zona del ejemplo. */
export function calendarioCursoMuestra(hoy: string): CalendarioDeGeneral {
  const item = (id: string, capa: ItemCalendario['capa'], titulo: string, detalle: string, d: string, hhmm: string, min: number | null, hecho?: boolean): ItemCalendario => {
    const inicio = `${d}T${hhmm}:00.000Z`;
    return { id, fuente: 'propio', capa, titulo, detalle, inicio, fin: min ? new Date(Date.parse(inicio) + min * 60000).toISOString() : null, diaCompleto: false, href: null, ...(hecho ? { hecho } : {}) };
  };
  const items = [
    item('h1', 'llamadas', 'Sesión de preguntas en vivo', '45 min · Ventas', hoy, '09:30', 45, true),
    item('h2', 'publicaciones', 'Reel: tres errores al cobrar', 'Reel', hoy, '12:00', null),
    item('h3', 'llamadas', 'Mentoría con el grupo de Marketing', '60 min · Marketing', hoy, '16:00', 60),
    item('h4', 'entregas', 'Subir el módulo 4', 'Contenido', hoy, '18:30', null),
    item('p1', 'publicaciones', 'Carrusel: cómo armar tu primera oferta', 'Carrusel', dia(hoy, 1), '10:00', null),
    item('p2', 'publicaciones', 'Correo a los alumnos atrasados', 'Correo', dia(hoy, 2), '09:00', null),
  ];
  return { calendario: { ok: true, d: { items, tz: 'UTC', hoy, falla: false } } };
}
