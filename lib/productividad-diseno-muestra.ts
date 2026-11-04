// =============================================================================
// productividad-diseno-muestra — los datos de EJEMPLO de la hoja Productividad (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/productividad-fernly/), inventados: ningún proyecto ni tarea real.
// Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa
// por el mismo `vistaProductividad` que la hoja de verdad. Las cifras cierran entre tarjetas: la frase, el medio arco y la
// prioridad salen de la misma cuenta de tareas.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const numero = (metrica: string, v: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], fuera: 0, clase: null });

// [proyecto, avance]
const PROYECTOS: Array<[string, number]> = [
  ['Página de precios nueva', 86], ['Guía de bienvenida', 72], ['Encuesta a clientes', 58],
  ['Campaña de otoño', 41], ['Plantillas de propuesta', 33], ['Curso para el equipo', 20], ['Biblioteca de casos', 12],
];
// [tarea, días sin tocar, veces que se corrió el deadline]
const QUIETAS: Array<[string, number, number]> = [
  ['Revisar el guion del video de ventas', 19, 1], ['Grabar los testimonios del curso', 14, 3], ['Ordenar la carpeta de contratos', 11, 0],
  ['Escribir el correo de bienvenida', 9, 2], ['Cotizar el nuevo hosting', 6, 0], ['Actualizar la página de preguntas', 3, 0],
];
// Lo que vence en las próximas semanas (abiertas por semana, desde el lunes de esta semana).
const VENCE = [6, 9, 3, 0, 4];
const ACTIVAS = 34, EN_CURSO = 8, HECHAS = 23, ALTA = 9, MEDIA = 14, BAJA = 8, FUTURO = 3;

const lunesDe = (hoy: string) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function datosProductividadMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, r: Resultado) => { if (k) out[k] = { resultado: r }; };
  poner(p.apertura, { columnas: col(['activas', 'en_curso', 'hechas']), filas: [], totales: [ACTIVAS, EN_CURSO, HECHAS], fuera: 0, clase: null });
  poner(p.avance, numero('avance_proyectos', Math.round(PROYECTOS.reduce((a, x) => a + x[1], 0) / PROYECTOS.length)));
  poner(p.estancadas, numero('estancadas', QUIETAS.filter((q) => q[1] > 7).length));
  poner(p.alta, numero('alta_sin_deadline', 3));
  poner(p.cumplimiento, numero('cumplimiento', 78));
  const l = lunesDe(hoy);
  poner(p.vence, {
    columnas: col(['abiertas']), fuera: 0, clase: 'tiempo', totales: [VENCE.reduce((a, b) => a + b, 0)],
    filas: VENCE.map((n, i) => { const d = new Date(l); d.setUTCDate(d.getUTCDate() + 7 * i); const k = iso(d); return { clave: k, etiqueta: k, valores: [n] }; }),
  });
  poner(p.huele, {
    columnas: col(['dias_quieta', 'movidas_deadline', 'activas']), fuera: 0, clase: 'categoria', totales: [null, QUIETAS.reduce((a, q) => a + q[2], 0), QUIETAS.length],
    filas: QUIETAS.map(([t, d, m], i) => ({ clave: t, etiqueta: t, ref: String(7001 + i), valores: [d, m, 1] })),
  });
  poner(p.proyectos, {
    columnas: col(['avance_proyectos']), fuera: 0, clase: 'categoria', totales: [null],
    filas: PROYECTOS.map(([n, a]) => ({ clave: n, etiqueta: n, valores: [a] })),
  });
  poner(p.piramide, {
    columnas: col(['activas']), fuera: 0, clase: 'categoria', totales: [ALTA + MEDIA + BAJA + FUTURO],
    filas: ([['Alta', ALTA], ['Media', MEDIA], ['Baja', BAJA], ['A futuro', FUTURO]] as const).map(([k, n]) => ({ clave: k, etiqueta: k, valores: [n] })),
  });
  return out;
}
