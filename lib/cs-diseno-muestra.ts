// =============================================================================
// cs-diseno-muestra — los datos de EJEMPLO de la hoja CS Analyst (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/cs-mender/mako.html), inventados: ningún cliente ni número real. Tienen
// la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa por el
// mismo `vistaCs` que la hoja de verdad. Las cifras cierran entre tarjetas: los carriles, las etapas, la señal, el último
// contacto y la frase salen de la misma lista de clientes.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));

/** Las etapas de la entrega del servicio de ejemplo, en su orden. */
export const ETAPAS_MUESTRA = ['Bienvenida', 'Arranque', 'En marcha', 'Cierre'] as const;

// [nombre, etapa, señal, motivo de la señal, último contacto, deuda vencida, estado, sesiones]
type Cli = [string, (typeof ETAPAS_MUESTRA)[number], 'Atención' | 'Bien' | 'Sin datos', string, string, number, string, number];
const CLIENTES: Cli[] = [
  ['Ana Robles', 'Bienvenida', 'Atención', 'Nunca hablaron', 'Nunca', 0, 'Activo', 0],
  ['Bruno Salas', 'Bienvenida', 'Bien', 'Recién cerrado', '0-7 días', 0, 'Activo', 1],
  ['Carla Méndez', 'Bienvenida', 'Bien', 'Recién cerrado', '0-7 días', 0, 'Activo', 1],
  ['Diego Fuentes', 'Bienvenida', 'Atención', 'Cuota vencida', '8-14 días', 450, 'Activo', 1],
  ['Elena Paz', 'Bienvenida', 'Sin datos', 'Sin datos', '15-30 días', 0, 'Activo', 0],
  ['Fabián Ortega', 'Arranque', 'Bien', 'Al día', '0-7 días', 0, 'Activo', 3],
  ['Gabriela Ríos', 'Arranque', 'Atención', 'Silencio', 'Más de 30 días', 0, 'Activo', 1],
  ['Héctor Lara', 'Arranque', 'Bien', 'Al día', '8-14 días', 0, 'Activo', 2],
  ['Irene Campos', 'Arranque', 'Bien', 'Al día', '0-7 días', 0, 'Activo', 4],
  ['Jorge Medina', 'En marcha', 'Atención', 'Cuota vencida', '15-30 días', 900, 'Activo', 2],
  ['Karen Solís', 'En marcha', 'Bien', 'Al día', '0-7 días', 0, 'Activo', 5],
  ['Luis Navarro', 'En marcha', 'Bien', 'Al día', '8-14 días', 0, 'Pausado', 3],
  ['Marta Ibarra', 'Cierre', 'Bien', 'Al día', '0-7 días', 0, 'Graduado', 6],
  ['Nicolás Vera', 'Cierre', 'Sin datos', 'Sin datos', 'Más de 30 días', 0, 'Baja', 4],
];
const PRODUCTO = 'Mentoría 1 a 1';
const ref = (i: number) => String(9001 + i);
const cuenta = <K extends string>(valor: (c: Cli) => K | null) => {
  const m = new Map<K, number>();
  for (const c of CLIENTES) { const k = valor(c); if (k != null) m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
};
const porCategoria = (m: Map<string, number>, orden?: readonly string[]): Resultado => {
  const claves = orden ? orden.filter((k) => m.has(k)) : [...m.keys()].sort((a, b) => (m.get(b) ?? 0) - (m.get(a) ?? 0));
  return {
    columnas: col(['clientes']), fuera: 0, clase: 'categoria', totales: [[...m.values()].reduce((a, b) => a + b, 0)],
    filas: claves.map((k) => ({ clave: k, etiqueta: k, valores: [m.get(k) ?? 0] })),
  };
};

export function datosCsMuestra(hoja: Pick<Hoja, 'diseno'>): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const atencion = CLIENTES.filter((c) => c[2] === 'Atención').length;
  const deuda = CLIENTES.reduce((a, c) => a + c[5], 0);
  const sesiones = CLIENTES.reduce((a, c) => a + c[7], 0);
  const bajas = CLIENTES.filter((c) => c[6] === 'Baja').length;
  const etapas = cuenta((c) => c[1]);
  // Los carriles: cada cliente con su etapa en el cruce (columnas = las etapas, de la que más tiene a la que menos).
  const columnas = [...etapas.keys()].sort((a, b) => (etapas.get(b) ?? 0) - (etapas.get(a) ?? 0));
  const carriles: Resultado = {
    columnas: col(['clientes']), fuera: 0, clase: 'categoria', totales: [CLIENTES.length],
    filas: CLIENTES.map((c, i) => ({ clave: c[0], etiqueta: c[0], valores: [1], ref: ref(i) })),
    cruce: { claves: columnas, celdas: CLIENTES.map((c) => columnas.map((e) => (e === c[1] ? 1 : 0))) },
  };
  const tabla: Resultado = {
    columnas: col(['atencion', 'deuda_vencida_usd', 'sesiones']), fuera: 0, clase: 'categoria', totales: [atencion, deuda, sesiones],
    columnasExtra: [{ id: 'senal', nombre: 'Señal' }, { id: 'estado', nombre: 'Estado' }, { id: 'tramo_contacto', nombre: 'Último contacto' }, { id: 'producto', nombre: 'Funnel' }],
    filas: CLIENTES.map((c, i) => ({
      clave: c[0], etiqueta: c[0], ref: ref(i), valores: [c[2] === 'Atención' ? 1 : 0, c[5], c[7]],
      extra: { senal: c[2], estado: c[6], tramo_contacto: c[4], producto: PRODUCTO },
    })),
  };
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string, r: Resultado) => { const id = p[k]; if (id) out[id] = { resultado: r }; };
  poner('apertura', { columnas: col(['atencion', 'clientes', 'deuda_vencida_usd']), filas: [], fuera: 0, clase: null, totales: [atencion, CLIENTES.length, deuda] });
  poner('sesiones', { columnas: col(['llamadas']), filas: [], fuera: 0, clase: null, totales: [sesiones], anterior: [sesiones - 4] });
  poner('bajas', { columnas: col(['clientes']), filas: [], fuera: 0, clase: null, totales: [bajas] });
  poner('carriles', carriles);
  poner('etapas', porCategoria(etapas));
  poner('tabla', tabla);
  poner('motivos', porCategoria(cuenta((c) => (c[2] === 'Atención' ? c[3] : null))));
  poner('senal', porCategoria(cuenta((c) => c[2]), ['Atención', 'Bien', 'Sin datos']));
  poner('contacto', porCategoria(cuenta((c) => c[4]), ['0-7 días', '8-14 días', '15-30 días', 'Más de 30 días', 'Nunca']));
  return out;
}
