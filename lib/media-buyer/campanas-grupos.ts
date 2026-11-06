// =============================================================================
// Media Buyer — Campañas: las tres columnas por ESTADO, con un desplegable de producto (PURO: lo prueban los tests)
// =============================================================================
// Martín, 6/11/2026: «el gráfico de 3 no lo dividiría por CRM, sino que se pueda seleccionar un CRM tipo desplegable, pero fíjate luego
// qué poner en cada columna, tiene que tener sentido… Mira cómo se ve con el de Mauricio, todas las campañas en una columna, no tiene
// sentido». Hasta el 6/11 cada columna era un producto del CRM: con un solo producto, todas las campañas caían en una columna; con seis,
// bajaban de fila. Ahora el producto es un FILTRO y las columnas dicen lo que hay que hacer con cada campaña:
//   · Funcionan: cuestan menos que lo que busca el negocio, con resultados suficientes para creerlo → candidatas a subir.
//   · Por decidir: todavía no hay con qué decidir (pocos resultados, o está dentro del margen) → se las deja correr.
//   · Para revisar: caras, o gastaron lo que cuesta un resultado y no trajeron ninguno, o Meta las retuvo → mirarlas hoy.
// Las pausadas van aparte (no se les pide nada). Es la misma vara del motor (objetivo de costo, y poco gasto no decide: ver
// docs/conocimiento/anuncios-high-ticket.md → «Cuándo apagar»).
// =============================================================================

import type { CampanaDeLienzo, ProductoDeLienzo } from './productos';

export type Grupo = 'funcionan' | 'prueba' | 'revisar';

/** Con menos resultados que éstos, un costo no dice nada: se espera. */
export const MIN_RESULTADOS = 3;
/** Cuánto por encima de lo buscado es «caro» (la misma tolerancia de `tonoDe`, lib/media-buyer/productos.ts). */
export const TOLERANCIA_CARO = 1.2;
/** Sin objetivo propio, la vara es el promedio de la cuenta: «bien» es 10% mejor y «caro» es 50% peor. */
const MEJOR_QUE_PROMEDIO = 0.9;
const CARO_VS_PROMEDIO = 1.5;
/** Cuántas tarjetas se ven por columna antes de «Ver N más». Con 40 campañas, la pantalla no se rompe. */
export const TOPE_POR_COLUMNA = 6;

export const COLUMNAS: ReadonlyArray<{ id: Grupo; titulo: string; ayuda: string; vacia: string }> = [
  { id: 'funcionan', titulo: 'Funcionan', ayuda: 'Cuestan menos que tu objetivo', vacia: 'Todavía ninguna' },
  { id: 'prueba', titulo: 'Por decidir', ayuda: 'Cerca del objetivo o con pocos datos', vacia: 'Ninguna por decidir' },
  { id: 'revisar', titulo: 'Para revisar', ayuda: 'Caras, sin resultados o retenidas', vacia: 'Nada para revisar' },
];

export type Reparto = {
  grupos: Record<Grupo, CampanaDeLienzo[]>;
  pausadas: CampanaDeLienzo[];
  /** Con qué se comparó: el objetivo del negocio, el promedio de la cuenta, o nada (no hay con qué). */
  referencia: { valor: number; de: 'objetivo' | 'promedio' } | null;
};

/** El costo con el que se compara: el objetivo si lo hay; si no, el promedio de lo que gastó y trajo la cuenta. */
export function referenciaDeCosto(campanas: readonly CampanaDeLienzo[], objetivo: number | null): Reparto['referencia'] {
  if (objetivo && objetivo > 0) return { valor: objetivo, de: 'objetivo' };
  const vivas = campanas.filter((c) => c.prendida && c.resultados > 0);
  const gasto = vivas.reduce((a, c) => a + c.gasto, 0);
  const res = vivas.reduce((a, c) => a + c.resultados, 0);
  // Con una sola campaña con resultados, compararla consigo misma no dice nada.
  return vivas.length >= 2 && res > 0 && gasto > 0 ? { valor: gasto / res, de: 'promedio' } : null;
}

/** A qué columna va una campaña. */
export function grupoDe(c: CampanaDeLienzo, ref: Reparto['referencia']): Grupo {
  if (c.retenida) return 'revisar';
  if (!ref) return 'prueba';
  // Gastó lo que cuesta un resultado y no trajo ninguno: eso sí se mira (poco gasto sin resultado no dice nada).
  if (c.resultados === 0) return c.gasto >= ref.valor ? 'revisar' : 'prueba';
  if (c.resultados < MIN_RESULTADOS) return 'prueba';
  const costo = c.costo ?? c.gasto / c.resultados;
  const [bien, mal] = ref.de === 'objetivo' ? [1, TOLERANCIA_CARO] : [MEJOR_QUE_PROMEDIO, CARO_VS_PROMEDIO];
  return costo <= ref.valor * bien ? 'funcionan' : costo > ref.valor * mal ? 'revisar' : 'prueba';
}

/** Las campañas visibles según el desplegable: 'todos', 'sin' (sin producto) o el id de un producto. */
export function visiblesPorProducto(productos: readonly ProductoDeLienzo[], sinProducto: readonly CampanaDeLienzo[], producto: string): CampanaDeLienzo[] {
  if (producto === 'sin') return [...sinProducto];
  if (producto === 'todos') return [...productos.flatMap((p) => p.campanas), ...sinProducto];
  return [...(productos.find((p) => p.id === producto)?.campanas ?? [])];
}

/** Reparte las campañas visibles en las tres columnas (más gasto, primero) y las pausadas aparte. */
export function repartirCampanas(campanas: readonly CampanaDeLienzo[], objetivo: number | null): Reparto {
  // La vara se mide con TODAS las visibles: sacar las pausadas la movería, y con ella a qué columna cae cada una.
  const referencia = referenciaDeCosto(campanas, objetivo);
  const grupos: Reparto['grupos'] = { funcionan: [], prueba: [], revisar: [] };
  const pausadas: CampanaDeLienzo[] = [];
  const porGasto = (a: CampanaDeLienzo, b: CampanaDeLienzo) => b.gasto - a.gasto || a.nombre.localeCompare(b.nombre, 'es');
  for (const c of [...campanas].sort(porGasto)) {
    if (!c.prendida && !c.retenida) pausadas.push(c);
    else grupos[grupoDe(c, referencia)].push(c);
  }
  return { grupos, pausadas, referencia };
}

/** El desplegable: «Todos los productos» y uno por producto con campañas; «Sin producto» sólo si hay. Con un solo producto no se dibuja. */
export function opcionesDeProducto(productos: readonly ProductoDeLienzo[], sinProducto: readonly CampanaDeLienzo[]): Array<{ id: string; nombre: string; n: number }> {
  const con = productos.filter((p) => p.campanas.length > 0).map((p) => ({ id: p.id, nombre: p.nombre, n: p.campanas.length }));
  const todas = [...con, ...(sinProducto.length ? [{ id: 'sin', nombre: 'Sin producto', n: sinProducto.length }] : [])];
  return todas.length > 1 ? [{ id: 'todos', nombre: 'Todos los productos', n: todas.reduce((a, x) => a + x.n, 0) }, ...todas] : [];
}

/** Lo que dice el pie de cada columna cuando hay más campañas que el tope. */
export const verMas = (total: number, visibles: number): string | null => (total > visibles ? `Ver ${total - visibles} más` : null);
