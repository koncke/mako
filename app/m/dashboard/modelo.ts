// =============================================================================
// /m/dashboard — lo PURO: los tipos que bajan a la pantalla, el período, la variación y la
// geometría del gráfico
// =============================================================================
// Sin `server-only` y sin importar VALORES de lib/graficos-*: lo leen el server (./datos.ts) y
// los componentes de cliente, y el catálogo del Dashboard no tiene nada que hacer en el bundle
// del teléfono. Los números llegan YA formateados desde el server con el `fmtValor` de escritorio
// (lib/graficos-agregar.ts): acá sólo se elige, se compara y se dibuja.
//
// ⚠️ LA VARIACIÓN SE DIBUJA CON UNA FLECHA DE COLOR Y EL NÚMERO EN TINTA (--dim), nunca texto verde
//    o rojo: --good y --bad como texto a 13 px no pasan AA (docs/diseno-mako-mobile-v2.md).
// =============================================================================

import type { Preset } from '@/lib/graficos-catalogo';

// ── El período ──────────────────────────────────────────────────────────────────────────────

export type PeriodoM = {
  id: Preset;
  /** El título de la lista de números: «Últimos 30 días». */
  nombre: string;
  /** El botón del período, arriba del gráfico: «30 días». */
  corto: string;
  /** Lo que sigue al total del gráfico: «248 en 30 días», «248 este mes». */
  en: string;
};

/**
 * Los períodos del teléfono: los cuatro del prototipo, todos presets de escritorio
 * (lib/graficos-catalogo.ts → PRESETS). Más largos no entran como barras legibles en 330 px.
 */
export const PERIODOS_MOVIL: readonly PeriodoM[] = [
  { id: 'ult7', nombre: 'Últimos 7 días', corto: '7 días', en: 'en 7 días' },
  { id: 'ult30', nombre: 'Últimos 30 días', corto: '30 días', en: 'en 30 días' },
  { id: 'este_mes', nombre: 'Este mes', corto: 'Este mes', en: 'este mes' },
  { id: 'ult90', nombre: 'Últimos 90 días', corto: '90 días', en: 'en 90 días' },
];

/** Los de escritorio que una hoja PROPIA puede traer de entrada (Closing arranca en «Todo»). */
const PERIODOS_EXTRA: readonly PeriodoM[] = [
  { id: 'ult14', nombre: 'Últimos 14 días', corto: '14 días', en: 'en 14 días' },
  { id: 'ult28', nombre: 'Últimos 28 días', corto: '28 días', en: 'en 28 días' },
  { id: 'mes_pasado', nombre: 'El mes pasado', corto: 'Mes pasado', en: 'el mes pasado' },
  { id: 'este_anio', nombre: 'Este año', corto: 'Este año', en: 'este año' },
  { id: 'ult12m', nombre: 'Últimos 12 meses', corto: '12 meses', en: 'en 12 meses' },
  { id: 'anio_pasado', nombre: 'El año pasado', corto: 'Año pasado', en: 'el año pasado' },
  { id: 'todo', nombre: 'Todo', corto: 'Todo', en: 'en total' },
];

export const PERIODO_DEFAULT: Preset = 'ult30';

const TODOS = [...PERIODOS_MOVIL, ...PERIODOS_EXTRA];
export const periodoDe = (id: Preset | string | null | undefined): PeriodoM | null => TODOS.find((p) => p.id === id) ?? null;

/**
 * El período pedido en la URL, si es uno que ESTA pantalla ofrece; si no, el de entrada.
 * `ofrecidos` = los cuatro del teléfono (+ el de entrada de una hoja propia).
 */
export function periodoDeParam(raw: unknown, ofrecidos: readonly PeriodoM[], porDefecto: Preset): PeriodoM {
  const pedido = typeof raw === 'string' ? ofrecidos.find((p) => p.id === raw) : undefined;
  return pedido ?? periodoDe(porDefecto) ?? PERIODOS_MOVIL[1];
}

/** Los períodos para una hoja: los cuatro del teléfono y, si la hoja arranca en otro, ése primero. */
export function periodosParaHoja(porDefecto: Preset | null): PeriodoM[] {
  const propio = porDefecto && !PERIODOS_MOVIL.some((p) => p.id === porDefecto) ? periodoDe(porDefecto) : null;
  return propio ? [...PERIODOS_MOVIL, propio] : [...PERIODOS_MOVIL];
}

// ── Lo que baja a la pantalla ───────────────────────────────────────────────────────────────

export type TonoDelta = 'good' | 'bad' | 'neutro';
export type DeltaM = {
  dir: 'up' | 'down' | 'igual';
  /** El color de la FLECHA (no del texto). */
  tono: TonoDelta;
  /** «12%», «0,4», «2». */
  texto: string;
  /** Para el lector de pantalla: «Sube 12% contra el período anterior». */
  etiqueta: string;
};
export type NumeroM = { id: string; k: string; v: string; delta: DeltaM | null };
export type BarraM = {
  clave: string;
  /** Debajo del eje: «11 oct». */
  eje: string;
  /** Arriba del gráfico al tocarla: «11 oct», «Sem. del 6 oct». */
  titulo: string;
  valor: number;
  /** El valor escrito: «7 leads», «US$1.500». */
  texto: string;
};
export type GraficoM = {
  titulo: string;
  barras: BarraM[];
  /** A la derecha de la cabecera del gráfico: «248 en 30 días». */
  total: string;
  /** El eje en dinero (sin «US$»: no entra) o en conteos enteros (sin «0,5» en el eje). */
  moneda: boolean;
  entero: boolean;
};
export type CobroM = {
  leadId: number;
  pagoId: number;
  nombre: string;
  /** «US$500 · vence el jue». */
  linea: string;
  urgencia: 'vencida' | 'pronto' | null;
};
export type HojaM = {
  id: string;
  nombre: string;
  grafico: GraficoM | null;
  /**
   * ¿El gráfico mira el período que se elige? En Marketing y Comercial sí; en una hoja propia, un
   * gráfico con período PROPIO (la «Tendencia del score» de 12 meses) no se mueve con el botón, y
   * entonces el botón va con la lista de números.
   */
  graficoSiguePeriodo: boolean;
  /** null = no hay error; un texto = no se pudo leer (y se dice). */
  graficoError: string | null;
  numeros: NumeroM[];
  numerosError: string | null;
  /** Sólo Comercial: «A quién cobrarle». */
  cobranza: { filas: CobroM[]; tz: string } | null;
  cobranzaError: string | null;
};

export const ERROR_LECTURA = 'No pudimos leer estos números. No es nada tuyo.';

// ── La variación contra el período anterior ─────────────────────────────────────────────────

/**
 * Cómo se escribe la variación de cada número (el prototipo): dinero y conteos grandes en %,
 * las razones («3x») y los conteos chicos (cierres) en diferencia absoluta.
 *   pct  → «12%»   (sin período anterior con algo, no hay variación: dividir por cero no es un dato)
 *   abs  → «2»     (enteros)
 *   abs1 → «0,4»   (un decimal)
 *   pts  → «3,5 pts» (un porcentaje contra otro)
 */
export type ModoDelta = 'pct' | 'abs' | 'abs1' | 'pts';

const num1 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num0 = (n: number) => Math.round(n).toLocaleString('es-AR');

/**
 * `subeEsBueno`: true = subir es bueno (flecha verde al subir), false = subir es malo (el CAC),
 * null = no se juzga (flecha gris).
 */
export function deltaDe(ahora: number | null | undefined, antes: number | null | undefined, modo: ModoDelta, subeEsBueno: boolean | null): DeltaM | null {
  if (ahora == null || antes == null || !Number.isFinite(ahora) || !Number.isFinite(antes)) return null;
  let d: number;
  let texto: string;
  if (modo === 'pct') {
    if (!(antes > 0)) return null;
    d = Math.round(((ahora - antes) / antes) * 100);
    texto = `${num0(Math.abs(d))}%`;
  } else if (modo === 'abs') {
    d = Math.round(ahora - antes);
    texto = num0(Math.abs(d));
  } else {
    d = Math.round((ahora - antes) * 10) / 10;
    texto = modo === 'pts' ? `${num1(Math.abs(d))} pts` : num1(Math.abs(d));
  }
  if (d === 0) return { dir: 'igual', tono: 'neutro', texto: modo === 'pct' ? '0%' : texto, etiqueta: 'Igual que el período anterior' };
  const dir = d > 0 ? 'up' : 'down';
  const tono: TonoDelta = subeEsBueno == null ? 'neutro' : (dir === 'up') === subeEsBueno ? 'good' : 'bad';
  return { dir, tono, texto, etiqueta: `${dir === 'up' ? 'Sube' : 'Baja'} ${texto} contra el período anterior` };
}

// ── Las fechas de las barras y de «A quién cobrarle» ────────────────────────────────────────

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Lo que dice una barra según cómo se agrupa: `clave` es 'YYYY-MM-DD' (el lunes, o el día 1). */
export function etiquetaBarra(dim: 'dia' | 'semana' | 'mes', clave: string): { eje: string; titulo: string } {
  const [y, m, d] = clave.split('-').map(Number);
  const mes = MESES[(m || 1) - 1] ?? '';
  if (dim === 'mes') return { eje: `${mes} ${String(y).slice(2)}`, titulo: `${mes} ${y}` };
  const dia = `${d} ${mes}`;
  return dim === 'semana' ? { eje: dia, titulo: `Sem. del ${dia}` } : { eje: dia, titulo: dia };
}

/**
 * Cuándo vence la próxima cuota, en palabras cortas. `dias` = días desde hoy (negativo = ya venció),
 * el mismo que arma `armarCobranza` (lib/datos-comercial.ts).
 */
export function textoVence(vence: string | null, dias: number | null): string {
  if (!vence || dias == null) return 'sin fecha';
  if (dias < -1) return `venció hace ${dias * -1} días`;
  if (dias === -1) return 'venció ayer';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  const [y, m, d] = vence.slice(0, 10).split('-').map(Number);
  if (dias < 7) return `vence el ${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
  return `vence el ${d} ${MESES[m - 1] ?? ''}`;
}

// ── El gráfico ──────────────────────────────────────────────────────────────────────────────

export const LIENZO = { W: 330, H: 150, ARRIBA: 8, BASE: 124, IZQ: 30 } as const;
/** Una barra nunca más gruesa que esto (dataviz: el aire que sobra es aire, no barra). */
const BARRA_MAX = 24;

/** El paso «lindo» del eje: 1, 2, 2,5 o 5 por una potencia de 10, para unas tres o cuatro líneas. */
export function pasoLindo(max: number, entero: boolean): number {
  if (!(max > 0) || !Number.isFinite(max)) return 1;
  const crudo = max / 3;
  const pot = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= crudo) ?? 10 * pot;
  return entero ? Math.max(1, Math.round(paso)) : paso;
}

export type Geometria = {
  techo: number;
  ticks: number[];
  /** El ancho del lugar de cada barra (la barra va centrada adentro). */
  hueco: number;
  barras: Array<{ x: number; y: number; w: number; h: number }>;
  /** Los índices que llevan fecha debajo: el primero, el del medio y el último. */
  marcas: number[];
};

export function geometria(valores: readonly number[], entero: boolean): Geometria {
  const { W, ARRIBA, BASE, IZQ } = LIENZO;
  const n = Math.max(1, valores.length);
  const max = Math.max(0, ...valores.map((v) => (Number.isFinite(v) ? v : 0)));
  const paso = pasoLindo(max, entero);
  const techo = max > 0 ? Math.ceil(max / paso) * paso : paso;
  const ticks: number[] = [];
  for (let v = 0, i = 0; v <= techo + paso / 1000 && i < 12; v += paso, i++) ticks.push(Math.round(v * 1000) / 1000);
  const hueco = (W - IZQ) / n;
  const sep = n > 12 ? 2 : 8;
  const w = Math.max(1, Math.min(BARRA_MAX, hueco - sep));
  const barras = valores.map((v, i) => {
    const alto = techo > 0 ? (Math.max(0, Number.isFinite(v) ? v : 0) / techo) * (BASE - ARRIBA) : 0;
    return { x: IZQ + i * hueco + (hueco - w) / 2, y: BASE - alto, w, h: alto };
  });
  const marcas = [...new Set([0, Math.floor((valores.length - 1) / 2), valores.length - 1])].filter((i) => i >= 0);
  return { techo, ticks, hueco, barras, marcas };
}

/** El camino de una barra: 4 px redondeados arriba, recta en la base. */
export function caminoBarra(b: { x: number; y: number; w: number; h: number }): string {
  const r = Math.min(4, b.w / 2, b.h);
  const f = (n: number) => n.toFixed(1);
  const base = b.y + b.h;
  return `M${f(b.x)},${f(base)} V${f(b.y + r)} Q${f(b.x)},${f(b.y)} ${f(b.x + r)},${f(b.y)} H${f(b.x + b.w - r)} Q${f(b.x + b.w)},${f(b.y)} ${f(b.x + b.w)},${f(b.y + r)} V${f(base)} Z`;
}

/** El número del eje, corto (sin «US$»: no entra en 30 px): «2k», «1,5k», «12». */
export function ejeCompacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`;
  if (a >= 1000) return `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString('es-AR', { maximumFractionDigits: a < 10 ? 1 : 0 });
}

/** El índice de la barra bajo un punto del lienzo (en unidades del viewBox). */
export function indiceEn(xLienzo: number, n: number): number {
  if (n <= 0) return 0;
  const i = Math.floor((xLienzo - LIENZO.IZQ) / ((LIENZO.W - LIENZO.IZQ) / n));
  return Math.max(0, Math.min(n - 1, i));
}
