// =============================================================================
// graficos-catalogo — qué se puede dibujar en «Mis gráficos» y con qué datos
// =============================================================================
// Pedido de Martín (10/10/2026): «Lo que quiero ahora es poder PERSONALIZAR la tab. Poder
// elegir gráficos y atarle datos… Puedes copiar la app de Google Data Studio para esto.»
//
// El molde es Looker Studio: cada gráfico es un TIPO (número, línea, barras, torta, tabla)
// atado a una FUENTE de datos, con un «rango por» (la fecha que decide qué filas entran),
// UNA dimensión (verde: cómo se agrupa) y una o más MÉTRICAS (azul: qué se suma).
//
// ⚠️ SIN `server-only` A PROPÓSITO: lo importan la pantalla (para dibujar los selectores),
// el server (para validar lo que llega) y los tests. Sólo datos y funciones puras: ningún
// valor de acá toca la base.
//
// ⚠️ NADA DE SQL LIBRE. La persona elige entre los campos que esta lista declara, y el server
// valida cada gráfico contra ella (`sanearGrafico`) antes de leer: un id que no está acá no
// llega nunca a una consulta. Agregar un campo es agregarlo acá Y enseñarle al lector
// (`lib/graficos-datos.ts`) a llenarlo; si falta lo segundo, el campo sale en cero —por eso
// el test cruza las dos listas.

export type TipoGrafico = 'numero' | 'linea' | 'barras' | 'torta' | 'tabla';
export type FuenteId = 'meta' | 'leads' | 'pagos';
export type Formato = 'numero' | 'usd' | 'pct';
export type ClaseDim = 'tiempo' | 'categoria';

export type Dimension = { id: string; nombre: string; clase: ClaseDim };
/**
 * Una métrica es una SUMA de lo que cada fila aporta, o una RAZÓN entre dos sumas.
 * Una razón NUNCA se promedia fila por fila: se divide lo sumado del grupo (el CTR de una
 * campaña es clics ÷ impresiones de la campaña, no el promedio de los CTR diarios).
 */
export type Metrica = { id: string; nombre: string; formato: Formato; razon?: { num: string; den: string; factor: number } };
export type Fuente = {
  id: FuenteId;
  nombre: string;
  /** Las fechas que pueden decidir qué filas entran al rango («Date range dimension»). */
  fechas: Array<{ id: string; nombre: string }>;
  dimensiones: Dimension[];
  metricas: Metrica[];
};

/** Las tres del tiempo: las comparten todas las fuentes, y son lo único que acepta una línea. */
const TIEMPO: Dimension[] = [
  { id: 'dia', nombre: 'Día', clase: 'tiempo' },
  { id: 'semana', nombre: 'Semana', clase: 'tiempo' },
  { id: 'mes', nombre: 'Mes', clase: 'tiempo' },
];

export const FUENTES: readonly Fuente[] = [
  {
    id: 'meta',
    nombre: 'Anuncios de Meta',
    fechas: [{ id: 'fecha', nombre: 'Fecha' }],
    dimensiones: [
      ...TIEMPO,
      { id: 'campana', nombre: 'Campaña', clase: 'categoria' },
      { id: 'conjunto', nombre: 'Conjunto', clase: 'categoria' },
      { id: 'anuncio', nombre: 'Anuncio', clase: 'categoria' },
    ],
    metricas: [
      { id: 'gasto', nombre: 'Gasto', formato: 'usd' },
      { id: 'impresiones', nombre: 'Impresiones', formato: 'numero' },
      { id: 'clics', nombre: 'Clics', formato: 'numero' },
      { id: 'leads', nombre: 'Leads', formato: 'numero' },
      { id: 'agendas', nombre: 'Agendas', formato: 'numero' },
      { id: 'ctr', nombre: 'CTR', formato: 'pct', razon: { num: 'clics', den: 'impresiones', factor: 100 } },
      { id: 'cpc', nombre: 'Costo por clic', formato: 'usd', razon: { num: 'gasto', den: 'clics', factor: 1 } },
      { id: 'cpm', nombre: 'CPM', formato: 'usd', razon: { num: 'gasto', den: 'impresiones', factor: 1000 } },
      { id: 'cpl', nombre: 'Costo por lead', formato: 'usd', razon: { num: 'gasto', den: 'leads', factor: 1 } },
      { id: 'cpa', nombre: 'Costo por agenda', formato: 'usd', razon: { num: 'gasto', den: 'agendas', factor: 1 } },
    ],
  },
  {
    id: 'leads',
    nombre: 'Leads del CRM',
    fechas: [
      { id: 'alta', nombre: 'Entró' },
      { id: 'agenda', nombre: 'Reunión' },
      { id: 'cierre', nombre: 'Cierre' },
    ],
    dimensiones: [
      ...TIEMPO,
      { id: 'etapa', nombre: 'Etapa', clase: 'categoria' },
      { id: 'producto', nombre: 'Producto', clase: 'categoria' },
      { id: 'origen', nombre: 'Origen', clase: 'categoria' },
      { id: 'campana', nombre: 'Campaña', clase: 'categoria' },
      { id: 'anuncio', nombre: 'Anuncio', clase: 'categoria' },
      { id: 'closer', nombre: 'Closer', clase: 'categoria' },
      { id: 'setter', nombre: 'Setter', clase: 'categoria' },
      { id: 'motivo', nombre: 'Motivo de pérdida', clase: 'categoria' },
    ],
    metricas: [
      { id: 'leads', nombre: 'Leads', formato: 'numero' },
      { id: 'agendas', nombre: 'Agendaron', formato: 'numero' },
      { id: 'asistencias', nombre: 'Asistieron', formato: 'numero' },
      { id: 'calificados', nombre: 'Calificados', formato: 'numero' },
      { id: 'cierres', nombre: 'Cerraron', formato: 'numero' },
      { id: 'vendido', nombre: 'Vendido', formato: 'usd' },
      { id: 'cobrado', nombre: 'Cobrado', formato: 'usd' },
      { id: 'tasa_asistencia', nombre: 'Tasa de asistencia', formato: 'pct', razon: { num: 'asistencias', den: 'agendas', factor: 100 } },
      { id: 'tasa_cierre', nombre: 'Tasa de cierre', formato: 'pct', razon: { num: 'cierres', den: 'asistencias', factor: 100 } },
      { id: 'ticket', nombre: 'Ticket promedio', formato: 'usd', razon: { num: 'vendido', den: 'cierres', factor: 1 } },
    ],
  },
  {
    id: 'pagos',
    nombre: 'Pagos',
    fechas: [
      { id: 'vencimiento', nombre: 'Vencimiento' },
      { id: 'pago', nombre: 'Pagado' },
    ],
    dimensiones: [
      ...TIEMPO,
      { id: 'estado', nombre: 'Estado', clase: 'categoria' },
      { id: 'cliente', nombre: 'Cliente', clase: 'categoria' },
      { id: 'cuota', nombre: 'Cuota', clase: 'categoria' },
    ],
    metricas: [
      { id: 'monto', nombre: 'Monto', formato: 'usd' },
      { id: 'cobrado', nombre: 'Cobrado', formato: 'usd' },
      { id: 'pendiente', nombre: 'Pendiente', formato: 'usd' },
      { id: 'pagos', nombre: 'Cuotas', formato: 'numero' },
    ],
  },
];

export type InfoTipo = {
  id: TipoGrafico;
  nombre: string;
  /** Cuántas métricas acepta. */
  maxMetricas: number;
  /** Qué dimensión pide: ninguna (un número), sólo tiempo (una línea), sólo categoría (una torta). */
  dimension: 'ninguna' | 'tiempo' | 'categoria' | 'cualquiera';
  /** Tamaño con el que nace en la grilla de 12 columnas. */
  w: number;
  h: number;
};

// Los nombres son los de Looker Studio, que es lo que se copió (pedido de Martín, 10/10/2026).
export const TIPOS: readonly InfoTipo[] = [
  { id: 'numero', nombre: 'Cuadro de resultados', maxMetricas: 1, dimension: 'ninguna', w: 3, h: 3 },
  { id: 'linea', nombre: 'Serie temporal', maxMetricas: 3, dimension: 'tiempo', w: 6, h: 7 },
  { id: 'barras', nombre: 'Gráfico de barras', maxMetricas: 2, dimension: 'cualquiera', w: 6, h: 7 },
  { id: 'torta', nombre: 'Gráfico circular', maxMetricas: 1, dimension: 'categoria', w: 4, h: 7 },
  { id: 'tabla', nombre: 'Tabla', maxMetricas: 4, dimension: 'cualquiera', w: 6, h: 7 },
];

export type Grafico = {
  id: string;
  tipo: TipoGrafico;
  /** Vacío = el título se arma solo con la métrica y la dimensión (`tituloDe`). */
  titulo: string;
  fuente: FuenteId;
  fecha: string;
  dimension: string | null;
  metricas: string[];
  /** Cuántos grupos se muestran (barras, torta, tabla); el resto va a «Otros» o se recorta. */
  limite: number;
  /** El «Ordenar» de Looker: por qué métrica (null = la primera) y hacia dónde. El tiempo va siempre en orden. */
  ordenMetrica: string | null;
  ordenAsc: boolean;
  // La posición en la grilla de 12 columnas (react-grid-layout).
  x: number; y: number; w: number; h: number;
};
/**
 * El INFORME, como en Looker: su nombre, las fuentes de datos que se le agregaron («Agregar
 * datos») y sus gráficos. Una fuente que usa un gráfico está siempre, aunque no se haya
 * agregado a mano: sin eso, un gráfico quedaría atado a una fuente que el panel no muestra.
 */
export type Tablero = { v: 1; nombre: string; fuentes: FuenteId[]; graficos: Grafico[] };
export const NOMBRE_INICIAL = 'Mis gráficos';

export const COLS = 12;
export const MAX_GRAFICOS = 40;
export const LIMITES = [5, 10, 20, 50] as const;

export const fuenteDe = (id: string): Fuente | undefined => FUENTES.find((f) => f.id === id);
export const tipoDe = (id: string): InfoTipo | undefined => TIPOS.find((t) => t.id === id);
export const metricaDe = (f: Fuente, id: string): Metrica | undefined => f.metricas.find((m) => m.id === id);
export const dimensionDe = (f: Fuente, id: string | null): Dimension | undefined => (id ? f.dimensiones.find((d) => d.id === id) : undefined);

/** Las dimensiones que un tipo acepta, en el orden de la fuente. */
export function dimensionesPara(f: Fuente, tipo: TipoGrafico): Dimension[] {
  const t = tipoDe(tipo);
  if (!t || t.dimension === 'ninguna') return [];
  if (t.dimension === 'cualquiera') return f.dimensiones;
  return f.dimensiones.filter((d) => d.clase === t.dimension);
}

/**
 * Las métricas que un tipo acepta. Una torta parte un TOTAL en porciones, así que sólo
 * acepta lo que se puede sumar: un CTR o un costo por lead partido en porciones no suma
 * 100% de nada, y el gráfico afirmaría una proporción que no existe.
 */
export function metricasPara(f: Fuente, tipo: TipoGrafico): Metrica[] {
  return tipo === 'torta' ? f.metricas.filter((m) => !m.razon) : f.metricas;
}

const entero = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};

/**
 * Lo que llega del navegador (o de la base) pasa por acá antes de valer nada. Corrige en vez
 * de rechazar —un gráfico al que se le cambió el tipo conserva lo que todavía sirve— y
 * devuelve null sólo si no hay de dónde sacar una fuente.
 */
export function sanearGrafico(raw: unknown): Grafico | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fuente = fuenteDe(String(r.fuente ?? ''));
  if (!fuente) return null;
  const tipo = (tipoDe(String(r.tipo ?? ''))?.id ?? 'barras') as TipoGrafico;
  const info = tipoDe(tipo)!;
  const id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/i.test(r.id) ? r.id : nuevoId();
  const fecha = fuente.fechas.some((x) => x.id === r.fecha) ? String(r.fecha) : fuente.fechas[0].id;

  const dims = dimensionesPara(fuente, tipo);
  let dimension: string | null = null;
  if (dims.length) {
    const pedida = typeof r.dimension === 'string' ? r.dimension : '';
    dimension = dims.some((d) => d.id === pedida) ? pedida : dims[0].id;
  }

  const validas = metricasPara(fuente, tipo).map((m) => m.id);
  const pedidas = Array.isArray(r.metricas) ? r.metricas.map(String) : [];
  let metricas = [...new Set(pedidas.filter((m) => validas.includes(m)))].slice(0, info.maxMetricas);
  if (!metricas.length) metricas = [validas[0]];
  // Se ordena por una métrica del gráfico; si la elegida ya no está, por la primera.
  const ordenMetrica = typeof r.ordenMetrica === 'string' && metricas.includes(r.ordenMetrica) ? r.ordenMetrica : null;

  return {
    id, tipo,
    titulo: typeof r.titulo === 'string' ? r.titulo.trim().slice(0, 80) : '',
    fuente: fuente.id, fecha, dimension, metricas,
    limite: entero(r.limite, 3, 50, 10),
    ordenMetrica, ordenAsc: r.ordenAsc === true,
    x: entero(r.x, 0, COLS - 1, 0),
    y: entero(r.y, 0, 999, 0),
    w: entero(r.w, 2, COLS, info.w),
    h: entero(r.h, 2, 16, info.h),
  };
}

/** `null` = no es un tablero (lo que vino no se entiende); un tablero vacío es `{graficos: []}`. */
export function sanearTablero(raw: unknown): Tablero | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { graficos?: unknown; nombre?: unknown; fuentes?: unknown };
  const lista = r.graficos;
  if (!Array.isArray(lista)) return null;
  const vistos = new Set<string>();
  const graficos: Grafico[] = [];
  for (const g of lista.slice(0, MAX_GRAFICOS)) {
    const s = sanearGrafico(g);
    if (!s) continue;
    // Dos gráficos con el mismo id son una sola key en la grilla: el segundo se pisaría con
    // el primero al arrastrar. Se le da otro.
    if (vistos.has(s.id)) s.id = nuevoId();
    vistos.add(s.id);
    graficos.push(s);
  }
  const nombre = typeof r.nombre === 'string' && r.nombre.trim() ? r.nombre.trim().slice(0, 80) : NOMBRE_INICIAL;
  return { v: 1, nombre, fuentes: fuentesDe(Array.isArray(r.fuentes) ? r.fuentes : [], graficos), graficos };
}

/** Las fuentes del informe: las agregadas a mano más las que usa algún gráfico, en el orden del catálogo. */
export function fuentesDe(agregadas: unknown[], graficos: Grafico[]): FuenteId[] {
  const s = new Set<string>([...agregadas.map(String), ...graficos.map((g) => g.fuente)]);
  return FUENTES.filter((f) => s.has(f.id)).map((f) => f.id);
}

let contador = 0;
export function nuevoId(): string {
  contador = (contador + 1) % 1000;
  return `g${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** El primer hueco libre: abajo de todo. La grilla compacta hacia arriba sola. */
export function abajoDeTodo(graficos: Grafico[]): number {
  return graficos.reduce((m, g) => Math.max(m, g.y + g.h), 0);
}

/** Un gráfico nuevo del tipo pedido, con datos atados que ya muestran algo. */
export function nuevoGrafico(tipo: TipoGrafico, graficos: Grafico[], fuenteId: FuenteId = 'meta'): Grafico {
  const info = tipoDe(tipo)!;
  const base: Record<string, unknown> = { id: nuevoId(), tipo, fuente: fuenteId, w: info.w, h: info.h, x: 0, y: abajoDeTodo(graficos) };
  if (tipo === 'linea') base.dimension = 'dia';
  if (tipo === 'torta' || tipo === 'barras' || tipo === 'tabla') base.dimension = fuenteId === 'pagos' ? 'estado' : 'campana';
  if (tipo === 'tabla' && fuenteId === 'meta') base.metricas = ['gasto', 'leads', 'cpl'];
  return sanearGrafico(base)!;
}

/** El título que se ve cuando la persona no escribió uno: «Gasto por campaña». */
export function tituloDe(g: Grafico): string {
  if (g.titulo) return g.titulo;
  const f = fuenteDe(g.fuente);
  if (!f) return 'Gráfico';
  const mets = g.metricas.map((m) => metricaDe(f, m)?.nombre ?? m);
  const dim = dimensionDe(f, g.dimension);
  const que = mets.length > 2 ? `${mets.slice(0, 2).join(', ')} y más` : mets.join(' y ');
  return dim ? `${que} por ${dim.nombre.toLowerCase()}` : que;
}

/**
 * El tablero con el que arranca quien nunca armó el suyo. Arriba los números que se miran
 * todos los días; abajo, la plata de la pauta en el tiempo y en porciones —la torta de
 * «a dónde se va la plata» que pidió Martín, con datos reales—.
 */
export function tableroInicial(): Tablero {
  const g = (r: Record<string, unknown>) => sanearGrafico({ id: nuevoId(), ...r })!;
  return {
    v: 1,
    nombre: NOMBRE_INICIAL,
    fuentes: ['meta', 'leads'],
    graficos: [
      g({ tipo: 'numero', fuente: 'meta', metricas: ['gasto'], x: 0, y: 0, w: 3, h: 3 }),
      g({ tipo: 'numero', fuente: 'leads', fecha: 'alta', metricas: ['leads'], x: 3, y: 0, w: 3, h: 3 }),
      g({ tipo: 'numero', fuente: 'meta', metricas: ['cpa'], x: 6, y: 0, w: 3, h: 3 }),
      g({ tipo: 'numero', fuente: 'leads', fecha: 'cierre', metricas: ['vendido'], x: 9, y: 0, w: 3, h: 3 }),
      g({ tipo: 'linea', fuente: 'meta', dimension: 'dia', metricas: ['gasto'], x: 0, y: 3, w: 8, h: 7 }),
      g({ tipo: 'torta', fuente: 'meta', dimension: 'campana', metricas: ['gasto'], limite: 5, x: 8, y: 3, w: 4, h: 7 }),
      g({ tipo: 'barras', fuente: 'leads', fecha: 'alta', dimension: 'origen', metricas: ['leads'], x: 0, y: 10, w: 6, h: 7 }),
      g({ tipo: 'tabla', fuente: 'meta', dimension: 'campana', metricas: ['gasto', 'leads', 'cpl'], x: 6, y: 10, w: 6, h: 7 }),
    ],
  };
}
