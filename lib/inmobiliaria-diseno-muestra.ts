// =============================================================================
// inmobiliaria-diseno-muestra — los datos de EJEMPLO de la hoja «Inmobiliaria» (la miniatura de «Nueva hoja» y el arnés de la captura)
// =============================================================================
// Inventados: ningún proyecto, interesado, asesor ni número real. Tienen la FORMA de lo que devuelven las piezas de la plantilla
// (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa por el mismo `vistaInmobiliaria` que la hoja de verdad. Las cifras cierran
// entre tarjetas: los interesados de los proyectos, de los orígenes y de las semanas suman los de la cabecera, y las etapas también.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// [proyecto, interesados, visitas, compras]
const PROYECTOS: Array<[string, number, number, number]> = [
  ['Torre Mirador', 62, 24, 6], ['Residencial Las Palmas', 48, 19, 4], ['Lofts del Centro', 37, 12, 2], ['Casas del Bosque', 21, 8, 1], ['Terrazas del Lago', 12, 0, 0],
];
const LEADS = PROYECTOS.reduce((a, p) => a + p[1], 0), AGENDAS = PROYECTOS.reduce((a, p) => a + p[2], 0), CIERRES = PROYECTOS.reduce((a, p) => a + p[3], 0);
// [etapa, interesados]: suman LEADS.
const ETAPAS: Array<[string, number]> = [['Nuevo', 74], ['Contactado', 47], ['Visita agendada', 26], ['Visitó', 18], ['Compró', 13], ['Perdido', 2]];
const ORIGENES: Array<[string, number]> = [['Meta Ads', 78], ['Portal inmobiliario', 46], ['Referido', 27], ['Google', 19], ['Orgánico', 10]];
const NOMBRES = ['Ana Ruiz', 'Diego Paz', 'Carla Soto', 'Luis Vega', 'Marta Gil', 'Pablo Ríos', 'Elena Mora', 'Raúl Cano', 'Sofía León', 'Hugo Prado', 'Inés Lara', 'Tomás Rey', 'Julia Font', 'Mario Sanz', 'Nora Vidal', 'Iván Ortiz', 'Lucía Peña', 'Óscar Gil', 'Rosa Luna', 'Saúl Mena'];
const ASESORES: Array<[string, number, number, number]> = [['Valeria Núñez', 21, 6, 1_140_000], ['Andrés Castro', 18, 4, 760_000], ['Paula Ibarra', 14, 2, 410_000], ['Jorge Medina', 10, 1, 190_000]];
const MOTIVOS: Array<[string, number]> = [['Precio fuera de su presupuesto', 9], ['Compró en otro proyecto', 6], ['Sin crédito aprobado', 4], ['No respondió más', 3], ['Ubicación', 2]];

export function datosInmobiliariaMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const kpi = (metrica: string, v: number, antes?: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], ...(antes != null ? { anterior: [antes] } : {}), fuera: 0, clase: null });
  const una = (metrica: string, fs: Array<[string, number]>): Resultado => ({ columnas: col([metrica]), fuera: 0, clase: 'categoria', totales: [fs.reduce((a, f) => a + f[1], 0)], filas: fs.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })) });

  poner(p.apertura, { columnas: col(['leads', 'agendas', 'cierres']), filas: [], totales: [LEADS, AGENDAS, CIERRES], fuera: 0, clase: null });
  poner(p.asistencia, kpi('tasa_asistencia', 74.6, 69.2));
  poner(p.cierre, kpi('tasa_cierre', 31.8, 34.1));
  poner(p.ticket, kpi('ticket', 192_000));
  poner(p.ciclo, kpi('ciclo_cierre', 23));
  // Trece semanas que suben hacia hoy, escaladas para sumar los interesados y las visitas de la cabecera.
  const ola = Array.from({ length: 13 }, (_, k) => 9 + Math.sin(k / 1.6) * 3 + k * 0.7);
  const repartir = (total: number) => { const s = ola.reduce((a, b) => a + b, 0); let resto = total; return ola.map((x, k) => { const n = k === 12 ? resto : Math.round((x * total) / s); resto -= n; return n; }); };
  const l = repartir(LEADS), a = repartir(AGENDAS);
  poner(p.semanas, { columnas: col(['leads', 'agendas']), fuera: 0, clase: 'tiempo', totales: [LEADS, AGENDAS], filas: l.map((n, k) => { const c = dia(hoy, -7 * (12 - k)); return { clave: c, etiqueta: c, valores: [n, a[k]] }; }) });
  poner(p.proyectos, { columnas: col(['leads', 'agendas', 'cierres']), fuera: 0, clase: 'categoria', totales: [LEADS, AGENDAS, CIERRES], filas: PROYECTOS.map(([k, x, y, z]) => ({ clave: k, etiqueta: k, valores: [x, y, z] })) });
  poner(p.origen, una('leads', ORIGENES));
  poner(p.etapa, una('leads', ETAPAS));
  poner(p.asesores, {
    columnas: col(['asistencias', 'cierres', 'tasa_cierre', 'vendido']), fuera: 0, clase: 'categoria', totales: [63, 13, 20.6, 2_500_000],
    filas: ASESORES.map(([k, v, c, d]) => ({ clave: k, etiqueta: k, valores: [v, c, Math.round((c / v) * 1000) / 10, d] })),
  });
  poner(p.motivos, una('leads', MOTIVOS));
  // El tablero: veinte interesados repartidos en las etapas, cada uno con su proyecto y su asesor.
  const etapaDe = (i: number) => ETAPAS[i % 5][0];
  poner(p.tablero, {
    columnas: col(['leads', 'agendas', 'cierres']), fuera: 0, clase: 'categoria', totales: [NOMBRES.length, null, null],
    columnasExtra: [{ id: 'etapa', nombre: 'Etapa' }, { id: 'producto', nombre: 'Funnel' }, { id: 'closer', nombre: 'Closer' }],
    filas: NOMBRES.map((n, i) => {
      const e = etapaDe(i), compro = e === 'Compró', agendo = compro || e === 'Visitó' || e === 'Visita agendada';
      return { clave: `lead-${i + 1}`, etiqueta: n, valores: [1, agendo ? 1 : 0, compro ? 1 : 0], extra: { etapa: e, producto: PROYECTOS[i % 4][0], closer: i % 7 === 0 ? '(sin dato)' : ASESORES[i % 4][0] } };
    }),
  });
  return out;
}
