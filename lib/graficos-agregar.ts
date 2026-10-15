// =============================================================================
// graficos-agregar — de filas sueltas a lo que dibuja un gráfico del Dashboard
// =============================================================================
// Puro y sin `server-only`, para que tenga test: el lector (`lib/graficos-datos.ts`) trae las
// filas de la base ya normalizadas y esto las agrupa por la dimensión del gráfico.
//
// Las decisiones que no se ven en la firma:
//   · Una RAZÓN se calcula sobre lo SUMADO del grupo, nunca promediando filas (el CTR de una
//     campaña es sus clics ÷ sus impresiones). Y una cuenta de DISTINTOS se cuenta en el grupo:
//     las personas de una semana no son la suma de las personas de cada día.
//   · El TIEMPO se rellena: un día sin filas es un cero dibujado, no un día que falta. Una
//     línea que saltea el martes se lee como si el lunes y el miércoles fueran seguidos.
//   · «Otros» SUMA las bases y recalcula la razón, igual que cualquier otro grupo. Y el TOTAL
//     sale de todas las filas, no de las que entraron al gráfico.
//   · El DESGLOSE (la segunda dimensión) arma una tabla de cruce sobre la PRIMERA métrica: es
//     lo que dibujan las columnas apiladas por categoría, la tabla dinámica y el sankey.
//
// Lo que sumó el v5 (12/10/2026, contrato docs/relevo/dashboard-v5.md):
//   · Una métrica PERCENTIL (`Metrica.percentil`) guarda la LISTA de valores por fila de la métrica de
//     la que sale y elige el de la posición `floor(p/100 · (n−1))` de la lista ordenada: la MISMA vara
//     que `getSCL` (lib/queries.ts) usó siempre para el P90 del ciclo de venta.
//   · Una razón con `minimo` y un denominador más chico NO da un porcentaje: da null (se dibuja «—») y
//     viaja aparte como «X de Y» (`muestraChica`). Un 100% sobre 2 casos se lee como un dato firme.
//   · Una dimensión con VALORES FIJOS (`Dimension.valores`) va en ese orden, con las categorías sin filas
//     en cero y sin recorte: es una escala (Alta/Media/Baja, los cortes de 5% del video), como el tiempo.
//   · Un ATRIBUTO (`sinTotal`) que ninguna fila del grupo trae es null, no 0: un proyecto sin evaluar no
//     es un proyecto de impacto 0, y la dispersión lo tiene que poder saltear.
//   · Las opciones de tabla (`Grafico.tabla`): sin períodos vacíos, del más nuevo al más viejo (con eso el
//     `limite` cuenta también para el tiempo: las últimas N) y dimensiones EXTRA como columnas (`extra`).
//     El `colorPor` de la dispersión viaja por el mismo camino: es otra dimensión de cada grupo.
//   · `imagen` (las Tarjetas) y `geo` (las ciudades del mapa) salen de las filas, como `ref`.

import { dimensionDe, fuenteDe, hastaDe, metricaDe, tipoDe, type Dimension, type Formato, type Grafico, type Metrica } from './graficos-catalogo';
import { diasAntes, lunesDeFecha } from './date-utils';

/**
 * Una fila ya normalizada por el lector: su fecha, sus etiquetas, sus números, sus claves distintas y sus
 * REFERENCIAS: `r[dim]` es el id de lo que nombra `d[dim]` (`r.anuncio` = el ad_id del anuncio, `r.cliente`
 * = el lead_id del cliente de una cuota). Se agrupa por el TEXTO, como siempre — dos campañas con el mismo
 * nombre son una para quien mira el gráfico —, y la referencia viaja aparte para que una acción sepa sobre
 * QUÉ actuar (lib/graficos-acciones.ts).
 *
 * `img`: la miniatura de lo que la fila nombra (el creativo de un anuncio), para las Tarjetas. `geo`: dónde
 * está (una visita con su ciudad), para el mapa: el grupo lleva el PROMEDIO de sus filas.
 */
export type Fila = {
  f: string | null; d: Record<string, string | null>; v: Record<string, number>; u?: Record<string, string | null>; r?: Record<string, string | null>;
  img?: string | null; geo?: { lat: number; lon: number } | null;
};

/** «X de Y»: el numerador y el denominador de una razón cuyo denominador no llegó al `minimo`. */
export type MuestraChica = { num: number; den: number };

export type FilaResultado = {
  clave: string; etiqueta: string; valores: Array<number | null>; desde?: string; hasta?: string;
  /** El id de lo que es este grupo, SÓLO si todas sus filas traen el mismo (un anuncio, un lead). */
  ref?: string;
  /**
   * Cuántas cosas distintas quedaron bajo esta etiqueta (dos clientes que se llaman igual; las filas sin id
   * cuentan como una más). Con esto no hay `ref`: si una rama puede decir «ambiguo», no termina en `[0]`.
   */
  ambiguo?: number;
  /** La miniatura de la fila MÁS RECIENTE del grupo que trae una (las Tarjetas). */
  imagen?: string;
  /** El promedio de las coordenadas de sus filas (las ciudades del mapa, como burbujas). */
  geo?: { lat: number; lon: number };
  /**
   * Las dimensiones EXTRA de este grupo (`Grafico.tabla.columnas` y el `colorPor`), por id: el valor si todas
   * sus filas dicen lo mismo; si dicen varios, los dos más frecuentes y «+N». Sin filas, null.
   */
  extra?: Record<string, string | null>;
  /** Alineado con `valores`: las razones con denominador bajo su `minimo` («X de Y»); el resto, null. */
  muestraChica?: Array<MuestraChica | null>;
};
export type Resultado = {
  /** Una por métrica del gráfico, en su orden. */
  columnas: Array<{ id: string; nombre: string; formato: Formato }>;
  /** Una por grupo, ya ordenadas y recortadas al límite (salvo el tiempo, que va entero). */
  filas: FilaResultado[];
  /** Sobre TODAS las filas del rango. */
  totales: Array<number | null>;
  /** Cuántos grupos no entraron (fueron a «Otros» o se recortaron). */
  fuera: number;
  /** La clase de la dimensión, para que la pantalla sepa si es una serie de tiempo. */
  clase: 'tiempo' | 'categoria' | null;
  /** El cruce con el desglose, sobre la primera métrica: celdas[i][j] = fila i, columna j. */
  cruce?: { claves: string[]; celdas: Array<Array<number | null>> };
  /** La evolución diaria de la primera métrica (el cuadro de resultados con tendencia). */
  serie?: Array<{ clave: string; etiqueta: string; valor: number | null }>;
  /**
   * Los totales del período ANTERIOR del mismo largo, cuando el gráfico pide compararse
   * (el chip «↑ 1,3×» de las KPI viejas). Mismo orden que `totales`.
   */
  anterior?: Array<number | null>;
  /** Alineado con `totales`: las razones del total con denominador bajo su `minimo` («X de Y»). */
  muestraChica?: Array<MuestraChica | null>;
  /** Las dimensiones extra que traen las filas en `extra` (las columnas de más de una tabla, el `colorPor`). */
  columnasExtra?: Array<{ id: string; nombre: string }>;
  /** La métrica chica de un cuadro de resultados (`Grafico.secundaria`, «14 cierres»): su total. */
  secundaria?: { id: string; nombre: string; formato: Formato; valor: number | null };
  /**
   * Es de EJEMPLO (lib/graficos-muestra.ts: la miniatura de la galería y el arnés): lo que se dibuja con datos propios
   * (el mapa de calor) dibuja su muestra ficticia en vez de pedir los del negocio.
   */
  muestra?: true;
};

/**
 * ¿No hay nada que dibujar? Sin filas, todos los totales en cero o vacíos; con filas, todos sus valores. Es la regla
 * con que la tarjeta dice «Sin datos en este período» (app/dashboard/Grafico.tsx) y con la que una plantilla se arma
 * sin los gráficos vacíos (lib/graficos-con-datos.ts): con dos reglas, la plantilla podría quitar lo que la tarjeta
 * dibuja, o dejar lo que dibuja vacío.
 */
export function sinDatos(r: Resultado): boolean {
  return !r.filas.length ? r.totales.every((v) => !v) : r.filas.every((f) => f.valores.every((v) => !v));
}

export const SIN_DATO = '(sin dato)';
export const OTROS = 'Otros';
/** Las columnas del desglose que entran antes de juntar el resto en «Otros». */
export const MAX_COLUMNAS_DESGLOSE = 8;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La clave del grupo de tiempo de una fecha `YYYY-MM-DD`. */
export function claveTiempo(dim: string, fecha: string): string {
  if (dim === 'semana') return lunesDeFecha(fecha);
  if (dim === 'mes') return `${fecha.slice(0, 7)}-01`;
  return fecha;
}

/** Cómo se lee esa clave en un eje: «03/10» o «oct 26». */
export function etiquetaTiempo(dim: string, clave: string): string {
  const [y, mo, d] = clave.split('-');
  if (dim === 'mes') return `${MESES[Number(mo) - 1] ?? mo} ${y.slice(2)}`;
  return `${d}/${mo}`;
}

/** Todas las claves de tiempo entre dos fechas, incluidas las puntas. */
export function clavesDelRango(dim: string, desde: string, hasta: string): string[] {
  const out: string[] = [];
  let f = claveTiempo(dim, desde);
  // Tope defensivo: un rango de años en días ya no es un gráfico que se pueda leer.
  for (let i = 0; i < 4000 && f <= hasta; i++) {
    out.push(f);
    if (dim === 'mes') {
      const [y, mo] = f.split('-').map(Number);
      f = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    } else f = diasAntes(f, dim === 'semana' ? -7 : -1);
  }
  return out;
}

/**
 * Parte los días de `desde` a `hasta` (los dos incluidos) en hasta `n` tramos CONTIGUOS de días enteros,
 * sin huecos ni días repetidos: el último termina siempre en `hasta`. Es lo que le permite a `leer`
 * (lib/graficos-lectura.ts) traer un período en tramos A LA VEZ: `leerTodo` pagina en serie con OFFSET, y
 * 45.122 eventos del VSL en 30 días eran 46 páginas y 34 s (medido el 11/10/2026, ws1).
 */
export function tramosDeDias(desde: string, hasta: string, n: number): Array<{ desde: string; hasta: string }> {
  const ms = (f: string) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const dias = Math.round((ms(hasta) - ms(desde)) / 86_400_000) + 1;
  if (!Number.isFinite(dias) || dias <= 1 || n <= 1) return [{ desde, hasta }];
  const k = Math.min(Math.trunc(n), dias);
  const tam = Math.ceil(dias / k);
  const out: Array<{ desde: string; hasta: string }> = [];
  for (let i = 0; i < dias; i += tam) {
    out.push({ desde: diasAntes(desde, -i), hasta: i + tam >= dias ? hasta : diasAntes(desde, -(i + tam - 1)) });
  }
  return out;
}

/**
 * Lo acumulado de un grupo: las sumas, los conjuntos de distintos, sus fechas extremas y los ids de lo que
 * nombra (`refs`; `sinRef` = alguna fila no traía id). «Otros» no junta ids: no es una cosa.
 *
 * `n`: cuántas filas TRAJERON cada atributo (un atributo que ninguna trajo es null, no 0). `l`: las listas
 * de valores de las métricas percentil. `img`/`imgF`: la miniatura de la fila más reciente que trae una.
 * `geo`: la suma de las coordenadas y cuántas. `x`: por dimensión extra, cuántas filas dicen cada valor.
 */
type Acum = {
  s: Record<string, number>; u: Record<string, Set<string>>; fmin?: string; fmax?: string; refs?: Set<string>; sinRef?: boolean;
  n?: Record<string, number>; l?: Record<string, number[]>; img?: string; imgF?: string | null;
  geo?: { lat: number; lon: number; k: number }; x?: Record<string, Map<string, number>>;
};
const nuevo = (): Acum => ({ s: {}, u: {} });

function anotarRef(a: Acum, ref: string | null | undefined) {
  if (ref == null || ref === '') a.sinRef = true; else (a.refs ??= new Set()).add(ref);
}
/**
 * La referencia de un grupo: el id si es UNO y todas las filas lo traen; si no, cuántos hay. Un grupo cuyas
 * filas no traen ningún id (el lector no lo declara para esa dimensión) no dice nada.
 */
function refDeGrupo(a: Acum): Pick<FilaResultado, 'ref' | 'ambiguo'> {
  if (!a.refs?.size) return {};
  const n = a.refs.size + (a.sinRef ? 1 : 0);
  if (n === 1) return { ref: [...a.refs][0] };
  return { ambiguo: n };
}

/**
 * De qué sale el valor POR FILA de una métrica percentil. Una razón vale num ÷ den en cada fila que tiene
 * denominador (el ciclo de UN lead: sus días sobre su 1); una suma vale lo que la fila trae. Un distinto no
 * tiene valor por fila: no se acepta.
 */
type Percentil = { id: string; p: number; de: Metrica };

/** Las bases que hacen falta para calcular las métricas pedidas (una razón pide dos; un percentil, su lista). */
type Bases = { sumas: string[]; distintos: string[]; atributos: string[]; percentiles: Percentil[] };
function basesDe(mets: Metrica[], fuenteMets: Metrica[]): Bases {
  const sumas = new Set<string>();
  const distintos = new Set<string>();
  const atributos = new Set<string>();
  const percentiles: Percentil[] = [];
  const anotar = (id: string) => {
    const mm = fuenteMets.find((x) => x.id === id);
    if (mm?.distinto) distintos.add(id); else sumas.add(id);
    if (mm?.sinTotal && !mm.razon) atributos.add(id);
  };
  for (const mm of mets) {
    if (mm.percentil) {
      const de = fuenteMets.find((x) => x.id === mm.percentil!.de);
      if (de && !de.distinto && !de.percentil) percentiles.push({ id: mm.id, p: mm.percentil.p, de });
    } else if (mm.razon) { anotar(mm.razon.num); anotar(mm.razon.den); } else anotar(mm.id);
  }
  return { sumas: [...sumas], distintos: [...distintos], atributos: [...atributos], percentiles };
}

/** El valor de la métrica `de` en UNA fila, o null si esa fila no aporta a la lista. */
function valorDeFila(de: Metrica, fila: Fila): number | null {
  const v = (k: string): number | null => (Object.prototype.hasOwnProperty.call(fila.v, k) && Number.isFinite(fila.v[k]) ? fila.v[k] : null);
  if (de.razon) {
    const n = v(de.razon.num), d = v(de.razon.den);
    return n != null && d != null && d !== 0 ? (n / d) * de.razon.factor : null;
  }
  return v(de.id);
}

function sumar(a: Acum, fila: Fila, b: Bases) {
  for (const k of b.sumas) a.s[k] = (a.s[k] ?? 0) + (Number.isFinite(fila.v[k]) ? fila.v[k] : 0);
  for (const k of b.atributos) if (Object.prototype.hasOwnProperty.call(fila.v, k) && Number.isFinite(fila.v[k])) (a.n ??= {})[k] = (a.n?.[k] ?? 0) + 1;
  for (const k of b.distintos) {
    const clave = fila.u?.[k];
    if (clave == null || clave === '') continue;
    (a.u[k] ??= new Set()).add(clave);
  }
  for (const pc of b.percentiles) {
    const x = valorDeFila(pc.de, fila);
    if (x != null) ((a.l ??= {})[pc.id] ??= []).push(x);
  }
  if (fila.f) {
    if (!a.fmin || fila.f < a.fmin) a.fmin = fila.f;
    if (!a.fmax || fila.f > a.fmax) a.fmax = fila.f;
  }
}
/** Lo que no es un número del grupo sino una propiedad de sus filas: la miniatura, el lugar y las columnas extra. */
function anotarExtras(a: Acum, fila: Fila, extras: Dimension[]) {
  if (fila.img && (a.img === undefined || (fila.f ?? '') >= (a.imgF ?? ''))) { a.img = fila.img; a.imgF = fila.f; }
  if (fila.geo && Number.isFinite(fila.geo.lat) && Number.isFinite(fila.geo.lon)) {
    const g = (a.geo ??= { lat: 0, lon: 0, k: 0 });
    g.lat += fila.geo.lat; g.lon += fila.geo.lon; g.k++;
  }
  for (const d of extras) {
    const k = d.clase === 'tiempo' ? (fila.f ? claveTiempo(d.id, fila.f) : null) : (fila.d[d.id]?.trim() || null);
    if (k == null) continue;
    const m = ((a.x ??= {})[d.id] ??= new Map());
    m.set(k, (m.get(k) ?? 0) + 1);
  }
}
function juntar(destino: Acum, otro: Acum) {
  for (const [k, v] of Object.entries(otro.s)) destino.s[k] = (destino.s[k] ?? 0) + v;
  for (const [k, v] of Object.entries(otro.n ?? {})) (destino.n ??= {})[k] = (destino.n?.[k] ?? 0) + v;
  for (const [k, set] of Object.entries(otro.u)) { const d = (destino.u[k] ??= new Set()); for (const x of set) d.add(x); }
  for (const [k, l] of Object.entries(otro.l ?? {})) ((destino.l ??= {})[k] ??= []).push(...l);
  if (otro.fmin && (!destino.fmin || otro.fmin < destino.fmin)) destino.fmin = otro.fmin;
  if (otro.fmax && (!destino.fmax || otro.fmax > destino.fmax)) destino.fmax = otro.fmax;
}
function base(id: string, a: Acum, fuenteMets: Metrica[]): number {
  return fuenteMets.find((x) => x.id === id)?.distinto ? a.u[id]?.size ?? 0 : a.s[id] ?? 0;
}
/** El percentil `p` de una lista: la posición `floor(p/100 · (n−1))` de la lista ordenada (la de `getSCL`). */
export function percentilDe(lista: readonly number[], p: number): number | null {
  const xs = lista.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!xs.length) return null;
  const q = Math.min(100, Math.max(0, p)) / 100;
  return xs[Math.floor(q * (xs.length - 1))];
}
function valor(mm: Metrica, a: Acum, fuenteMets: Metrica[]): number | null {
  if (mm.percentil) return percentilDe(a.l?.[mm.id] ?? [], mm.percentil.p);
  if (!mm.razon) {
    // Un atributo que ninguna fila trajo es «no se sabe» (un proyecto sin evaluar), nunca un 0.
    if (mm.sinTotal && !mm.distinto && !(a.n?.[mm.id])) return null;
    return base(mm.id, a, fuenteMets);
  }
  const den = base(mm.razon.den, a, fuenteMets);
  // Con un denominador bajo el mínimo no hay porcentaje que mostrar: va «X de Y» (`muestraChicaDe`).
  if (mm.razon.minimo != null && den < mm.razon.minimo) return null;
  return den ? (base(mm.razon.num, a, fuenteMets) / den) * mm.razon.factor : null;
}
/** «X de Y» de una razón cuyo denominador (mayor que cero) no llegó a su `minimo`; null en cualquier otro caso. */
function muestraChicaDe(mm: Metrica, a: Acum, fuenteMets: Metrica[]): MuestraChica | null {
  if (!mm.razon || mm.razon.minimo == null) return null;
  const den = base(mm.razon.den, a, fuenteMets);
  return den > 0 && den < mm.razon.minimo ? { num: base(mm.razon.num, a, fuenteMets), den } : null;
}
/** El valor de una dimensión extra en un grupo: el único, o los dos más frecuentes y cuántos más hay. */
function textoExtra(m: Map<string, number> | undefined, d: Dimension): string | null {
  if (!m || !m.size) return null;
  const orden = [...m.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es', { numeric: true }));
  const rot = (k: string) => (d.clase === 'tiempo' ? etiquetaTiempo(d.id, k) : k);
  if (orden.length === 1) return rot(orden[0][0]);
  const dos = orden.slice(0, 2).map(([k]) => rot(k)).join(', ');
  return orden.length > 2 ? `${dos} +${orden.length - 2}` : dos;
}

/** La etiqueta con la que se AGRUPA una categoría: recortada, y lo vacío como «(sin dato)». El filtro usa la misma. */
export function claveCategoria(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : SIN_DATO;
}
function claveDe(dimId: string, clase: 'tiempo' | 'categoria', f: Fila): string | null {
  if (clase === 'tiempo') return f.f ? claveTiempo(dimId, f.f) : null;
  return claveCategoria(f.d[dimId]);
}

/** Un filtro de un control, ya traducido a la dimensión del conjunto (lib/graficos-catalogo.ts, efectivoDe). */
export type Filtro = { dimension: string; valores?: string[]; texto?: string };

/**
 * Deja las filas que pasan TODOS los filtros (Y entre filtros; dentro de una lista, O entre valores).
 * Compara con la MISMA normalización que agrupa (`claveCategoria`): con un `===` propio, elegir
 * «(sin dato)» o un valor con espacios no traería ninguna fila. Una lista vacía no filtra (el «todos»
 * se manda como ausencia, nunca como `[]`). La búsqueda no distingue mayúsculas ni acentos.
 */
export function filtrarFilas(filas: Fila[], filtros: Filtro[]): Fila[] {
  const activos = filtros.filter((x) => (x.valores && x.valores.length) || (x.texto && x.texto.trim()));
  if (!activos.length) return filas;
  // Sin acentos: se separan las marcas (NFD) y se sacan las combinantes (de U+0300 a U+036F).
  const plano = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const pruebas = activos.map((x) => {
    if (x.valores && x.valores.length) { const set = new Set(x.valores.map((v) => claveCategoria(v))); return (fl: Fila) => set.has(claveCategoria(fl.d[x.dimension])); }
    const t = plano(x.texto!.trim());
    return (fl: Fila) => plano(claveCategoria(fl.d[x.dimension])).includes(t);
  });
  return filas.filter((fl) => pruebas.every((p) => p(fl)));
}

/** El orden de los grupos de una categoría: «(sin dato)» al final; una escala con orden propio por su etiqueta; si no, por la métrica. */
function ordenarGrupos(entradas: Array<{ clave: string; a: Acum; o: number | null }>, dim: Dimension, asc: boolean): void {
  const signo = asc ? 1 : -1;
  entradas.sort((x, y) => {
    if (x.clave === SIN_DATO || y.clave === SIN_DATO) return x.clave === SIN_DATO ? (y.clave === SIN_DATO ? 0 : 1) : -1;
    // Unos tramos con orden propio (la edad) se leen en ese orden, no del que más al que menos.
    if (dim.ordenEtiqueta) return x.clave.localeCompare(y.clave, 'es', { numeric: true });
    if (x.o == null || y.o == null) return x.o == null ? (y.o == null ? 0 : 1) : -1;
    return signo * (x.o - y.o) || x.clave.localeCompare(y.clave);
  });
}

/** Los tipos que no se recortan al `limite`: necesitan todos los grupos para decir lo que dicen. */
const SIN_RECORTE: ReadonlySet<string> = new Set([
  // El histograma reparte TODOS los grupos en franjas.
  'histograma',
  // El mapa: un estado que queda afuera se dibujaría «Sin datos» teniendo datos.
  'mapa',
  // La dispersión no junta en «Otros»: recortada a 10, el tablero del dueño perdía 61 de sus 71 proyectos
  // sin avisar (medido el 11/10/2026, relevo v5).
  'dispersion', 'burbujas',
]);

export function agregar(g: Grafico, filas: Fila[], desde: string, hasta: string): Resultado {
  const fuente = fuenteDe(g.fuente);
  const vacio: Resultado = { columnas: [], filas: [], totales: [], fuera: 0, clase: null };
  if (!fuente) return vacio;
  const fm = fuente.metricas;
  const mets = g.metricas.map((id) => metricaDe(fuente, id)).filter((x): x is Metrica => !!x);
  const b = basesDe(mets, fm);
  const columnas = mets.map((x) => ({ id: x.id, nombre: x.nombre, formato: x.formato }));
  const info = tipoDe(g.tipo);

  const total = nuevo();
  for (const f of filas) sumar(total, f, b);
  // Lo que no se suma entre filas (el alcance) no tiene total: sumado, contaría dos veces a quien está en dos grupos.
  const totales = mets.map((x) => (x.sinTotal ? null : valor(x, total, fm)));
  const mcTotal = mets.map((x) => (x.sinTotal ? null : muestraChicaDe(x, total, fm)));
  const muestraTotal = mcTotal.some((x) => x != null) ? { muestraChica: mcTotal } : {};

  // La métrica chica de un cuadro de resultados («14 cierres»): una lectura de las MISMAS filas.
  const mSec = typeof g.secundaria === 'string' ? metricaDe(fuente, g.secundaria) : undefined;
  let secundaria: Resultado['secundaria'];
  if (mSec) {
    const bs = basesDe([mSec], fm);
    const a = nuevo();
    for (const f of filas) sumar(a, f, bs);
    secundaria = { id: mSec.id, nombre: mSec.nombre, formato: mSec.formato, valor: mSec.sinTotal ? null : valor(mSec, a, fm) };
  }
  const conSecundaria = secundaria ? { secundaria } : {};

  // La evolución de la primera métrica para el cuadro con tendencia: por día, o por semana si
  // el período es largo (90 puntos ya no se leen en una tarjeta chica).
  let serie: Resultado['serie'];
  if (g.tipo === 'numero_tendencia' && mets[0]) {
    const largo = clavesDelRango('dia', desde, hasta).length;
    const dimT = largo > 60 ? 'semana' : 'dia';
    const porT = new Map<string, Acum>();
    for (const f of filas) { if (!f.f) continue; const k = claveTiempo(dimT, f.f); const a = porT.get(k) ?? nuevo(); sumar(a, f, b); porT.set(k, a); }
    serie = clavesDelRango(dimT, desde, hasta).map((k) => ({ clave: k, etiqueta: etiquetaTiempo(dimT, k), valor: valor(mets[0], porT.get(k) ?? nuevo(), fm) }));
  }

  const dim = dimensionDe(fuente, g.dimension);
  if (!dim) return { columnas, filas: [], totales, fuera: 0, clase: null, ...(serie ? { serie } : {}), ...muestraTotal, ...conSecundaria };

  // Las dimensiones EXTRA de cada grupo: las columnas de más de una tabla y la que pinta una dispersión.
  // `fecha` no es una dimensión del conjunto: es la fecha de las filas del grupo (una llamada, su día).
  const idsExtra = [...new Set([...(g.tabla?.columnas ?? []), ...(typeof g.colorPor === 'string' ? [g.colorPor] : [])])].filter((id) => id !== dim.id);
  const extras: Dimension[] = idsExtra
    .map((id): Dimension | undefined => (id === 'fecha' ? { id: 'fecha', nombre: 'Fecha', clase: 'tiempo' } : dimensionDe(fuente, id)))
    .filter((x): x is Dimension => !!x);

  const grupos = new Map<string, Acum>();
  for (const f of filas) {
    const k = claveDe(dim.id, dim.clase, f);
    if (k == null) continue;
    const a = grupos.get(k) ?? nuevo();
    sumar(a, f, b);
    // Un día no es una cosa con id: la referencia es sólo de las categorías.
    if (dim.clase === 'categoria') anotarRef(a, f.r?.[dim.id]);
    anotarExtras(a, f, extras);
    grupos.set(k, a);
  }

  // ── el orden y el recorte ──
  let lista: Array<{ clave: string; a: Acum }>;
  let fuera = 0;
  const mOrden = mets.find((x) => x.id === g.ordenMetrica) ?? mets[0];
  const conOrden = (claves: Array<[string, Acum]>) => claves.map(([clave, a]) => ({ clave, a, o: mOrden ? valor(mOrden, a, fm) : 0 }));
  if (dim.clase === 'tiempo') {
    let claves = clavesDelRango(dim.id, desde, hasta);
    const t = g.tabla;
    // Las cohortes de «Todo» son 82 meses casi vacíos: «sin vacíos» deja los que tienen filas.
    if (t?.sinVacios) claves = claves.filter((k) => grupos.has(k));
    if (t?.descendente) claves = [...claves].reverse();
    // Con un orden de tabla, el `limite` cuenta también para el tiempo: las N más NUEVAS.
    const n = Math.max(1, g.limite);
    if ((t?.sinVacios || t?.descendente) && claves.length > n) {
      fuera = claves.length - n;
      claves = t?.descendente ? claves.slice(0, n) : claves.slice(-n);
    }
    lista = claves.map((k) => ({ clave: k, a: grupos.get(k) ?? nuevo() }));
  } else if (dim.valores?.length) {
    // ⚠️ UNA ESCALA CON VALORES FIJOS VA EN SU ORDEN, CON LOS VACÍOS EN CERO, Y SIN RECORTE: «Alta, Media,
    // Baja, A futuro» ordenada por la métrica salía alfabética o por tamaño, y una banda sin tareas
    // desaparecía (relevo v5, la pirámide). Lo que no está en la escala NO se esconde: va después, en su
    // orden de siempre, y «(sin dato)» al final.
    const fijos = [...new Set(dim.valores.map((v) => claveCategoria(v)))];
    const enEscala = new Set(fijos);
    const resto = conOrden([...grupos.entries()].filter(([k]) => !enEscala.has(k)));
    ordenarGrupos(resto, dim, g.ordenAsc);
    lista = [...fijos.map((k) => ({ clave: k, a: grupos.get(k) ?? nuevo() })), ...resto];
  } else {
    const ord = conOrden([...grupos.entries()]);
    ordenarGrupos(ord, dim, g.ordenAsc);
    lista = ord;
    const limite = SIN_RECORTE.has(g.tipo) ? Infinity : Math.max(1, g.limite);
    if (lista.length > limite) {
      const conOtros = info?.grupo === 'Circular' || info?.grupo === 'Barras' || info?.grupo === 'Gráfico de rectángulos';
      if (conOtros) {
        const resto = lista.slice(limite - 1);
        const otros = nuevo();
        for (const x of resto) juntar(otros, x.a);
        lista = [...lista.slice(0, limite - 1), { clave: OTROS, a: otros }];
        fuera = resto.length;
      } else {
        fuera = lista.length - limite;
        lista = lista.slice(0, limite);
      }
    }
  }

  const out: Resultado = {
    columnas, totales, fuera, clase: dim.clase,
    filas: lista.map((x) => {
      const mc = mets.map((mm) => muestraChicaDe(mm, x.a, fm));
      return {
        clave: x.clave,
        etiqueta: dim.clase === 'tiempo' ? etiquetaTiempo(dim.id, x.clave) : x.clave,
        valores: mets.map((mm) => valor(mm, x.a, fm)),
        ...(x.a.fmin ? { desde: x.a.fmin, hasta: x.a.fmax } : {}),
        ...refDeGrupo(x.a),
        ...(x.a.img ? { imagen: x.a.img } : {}),
        ...(x.a.geo && x.a.geo.k ? { geo: { lat: x.a.geo.lat / x.a.geo.k, lon: x.a.geo.lon / x.a.geo.k } } : {}),
        ...(extras.length ? { extra: Object.fromEntries(extras.map((d) => [d.id, textoExtra(x.a.x?.[d.id], d)])) } : {}),
        ...(mc.some((y) => y != null) ? { muestraChica: mc } : {}),
      };
    }),
    ...(serie ? { serie } : {}),
    ...muestraTotal,
    ...conSecundaria,
    ...(extras.length ? { columnasExtra: extras.map((d) => ({ id: d.id, nombre: d.nombre })) } : {}),
  };

  // ── el cruce con el desglose, sobre la primera métrica ──
  const desg = dimensionDe(fuente, g.desglose);
  if (desg && mets[0]) {
    const visibles = new Set(lista.map((x) => x.clave));
    const celdas = new Map<string, Map<string, Acum>>();
    const porColumna = new Map<string, Acum>();
    for (const f of filas) {
      let kf = claveDe(dim.id, dim.clase, f);
      if (kf == null) continue;
      if (!visibles.has(kf)) { if (visibles.has(OTROS)) kf = OTROS; else continue; }
      const kc = claveDe(desg.id, 'categoria', f)!;
      const fila = celdas.get(kf) ?? new Map<string, Acum>();
      const a = fila.get(kc) ?? nuevo();
      sumar(a, f, b);
      fila.set(kc, a);
      celdas.set(kf, fila);
      const c = porColumna.get(kc) ?? nuevo();
      sumar(c, f, b);
      porColumna.set(kc, c);
    }
    // Las columnas que más pesan primero; el resto, juntas en «Otros». Un desglose con valores FIJOS
    // (Ganada / Perdida, las bandas de prioridad) va en su orden, con sus vacíos, antes que lo demás.
    const fijosDesg = desg.valores?.length ? [...new Set(desg.valores.map((v) => claveCategoria(v)))] : [];
    const cols = [
      ...fijosDesg.map((k) => ({ k, o: 0 })),
      ...[...porColumna.entries()]
        .filter(([k]) => !fijosDesg.includes(k))
        .map(([k, a]) => ({ k, o: valor(mets[0], a, fm) ?? 0 }))
        .sort((x, y) => (x.k === SIN_DATO ? 1 : y.k === SIN_DATO ? -1 : y.o - x.o)),
    ];
    const tope = Math.max(MAX_COLUMNAS_DESGLOSE, fijosDesg.length);
    const quedan = cols.slice(0, tope).map((x) => x.k);
    const hayResto = cols.length > tope;
    const claves = hayResto ? [...quedan, OTROS] : quedan;
    out.cruce = {
      claves,
      celdas: lista.map((x) => {
        const fila = celdas.get(x.clave) ?? new Map<string, Acum>();
        const resto = nuevo();
        if (hayResto) for (const [k, a] of fila) if (!quedan.includes(k)) juntar(resto, a);
        return claves.map((k) => (k === OTROS && hayResto ? valor(mets[0], resto, fm) : valor(mets[0], fila.get(k) ?? nuevo(), fm)));
      }),
    };
  }
  return out;
}

/** Una COSA del detalle (un anuncio, un lead, una cuota) con sus números y sus ids. */
export type FilaEntidad = {
  /** El id que la identifica (`Fila.r[ref]`). */
  id: string;
  /** Sus etiquetas: si cambiaron en el período (un anuncio renombrado), las de su fila más reciente. */
  d: Record<string, string | null>;
  /** Los ids que la entidad tiene UNO solo en todas sus filas; el que tiene varios no viaja. */
  r: Record<string, string>;
  valores: Array<number | null>;
  desde?: string;
  hasta?: string;
};
export type ResultadoEntidades = {
  columnas: Resultado['columnas'];
  filas: FilaEntidad[];
  /** Cuántas entidades aportaban y no entraron por el tope. */
  fuera: number;
  /** Las filas que no traían id: no se pueden listar como una cosa, y se cuentan para no esconderlas. */
  sinId: number;
};

/**
 * Lo que hay ATRÁS de un número: las filas agrupadas por la ENTIDAD (`Fila.r[ref]`) y no por su nombre —
 * dos anuncios que se llaman igual son dos filas de la lista, y cada una sabe su id. Las métricas se calculan
 * con las MISMAS reglas que `agregar` (una razón sobre lo sumado, los distintos contados en el grupo), así el
 * detalle suma lo que dice el número.
 *
 * Entra la entidad que APORTA a la primera métrica (gasto ≠ 0, un lead que agendó, una cuota cobrada): el
 * detalle de «Agendas» no lista a los que no agendaron. Orden: la primera métrica de mayor a menor, después
 * lo más reciente.
 */
export function agregarPorRef(fuenteId: string, metricas: string[], filas: Fila[], ref: string, limite = 50): ResultadoEntidades {
  const fuente = fuenteDe(fuenteId);
  if (!fuente) return { columnas: [], filas: [], fuera: 0, sinId: 0 };
  const fm = fuente.metricas;
  const mets = metricas.map((id) => metricaDe(fuente, id)).filter((x): x is Metrica => !!x);
  const b = basesDe(mets, fm);
  const columnas = mets.map((x) => ({ id: x.id, nombre: x.nombre, formato: x.formato }));

  type G = { a: Acum; d: Record<string, string | null>; fd: string | null; refs: Map<string, Set<string>> };
  const grupos = new Map<string, G>();
  let sinId = 0;
  for (const f of filas) {
    const id = f.r?.[ref];
    if (id == null || id === '') { sinId++; continue; }
    const g = grupos.get(id) ?? { a: nuevo(), d: {}, fd: null, refs: new Map() };
    sumar(g.a, f, b);
    // La etiqueta de la fila más reciente (o la primera, si no traen fecha).
    if (!Object.keys(g.d).length || (f.f && (!g.fd || f.f >= g.fd))) { g.d = { ...f.d }; g.fd = f.f ?? g.fd; }
    for (const [k, v] of Object.entries(f.r ?? {})) if (v != null && v !== '') { const s = g.refs.get(k) ?? new Set<string>(); s.add(v); g.refs.set(k, s); }
    grupos.set(id, g);
  }

  const primera = mets[0];
  const aporta = (a: Acum): boolean => {
    if (!primera) return true;
    if (primera.razon) return base(primera.razon.num, a, fm) !== 0 || base(primera.razon.den, a, fm) !== 0;
    return base(primera.id, a, fm) !== 0;
  };
  const lista = [...grupos.entries()].filter(([, g]) => aporta(g.a)).map(([id, g]) => {
    const r: Record<string, string> = {};
    for (const [k, s] of g.refs) if (s.size === 1) r[k] = [...s][0];
    return { id, d: g.d, r, valores: mets.map((mm) => valor(mm, g.a, fm)), ...(g.a.fmin ? { desde: g.a.fmin, hasta: g.a.fmax } : {}) };
  });
  lista.sort((x, y) => {
    const a = x.valores[0], c = y.valores[0];
    if (a == null || c == null) { if (a != null) return -1; if (c != null) return 1; }
    else if (a !== c) return c - a;
    return (y.hasta ?? '').localeCompare(x.hasta ?? '') || x.id.localeCompare(y.id);
  });
  const tope = Math.max(1, limite);
  return { columnas, filas: lista.slice(0, tope), fuera: Math.max(0, lista.length - tope), sinId };
}

/** Las franjas de un histograma: cuántos grupos caen en cada tramo de valores. */
export function histograma(valores: number[], franjas = 10): Array<{ etiqueta: string; desde: number; hasta: number; cuantos: number }> {
  const vs = valores.filter((v) => Number.isFinite(v));
  if (!vs.length) return [];
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  if (min === max) return [{ etiqueta: String(min), desde: min, hasta: max, cuantos: vs.length }];
  const n = Math.min(franjas, vs.length);
  const ancho = (max - min) / n;
  const out = Array.from({ length: n }, (_, i) => ({ desde: min + i * ancho, hasta: min + (i + 1) * ancho, cuantos: 0, etiqueta: '' }));
  for (const v of vs) out[Math.min(n - 1, Math.floor((v - min) / ancho))].cuantos++;
  return out;
}

/** Cómo se escribe un valor: «US$1.234», «12,5%», «2,3x». `null` = no se puede calcular. */
export function fmtValor(v: number | null, formato: Formato, compacto = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (formato === 'pct') return `${v.toLocaleString('es-AR', { maximumFractionDigits: compacto ? 0 : 1 })}%`;
  if (formato === 'veces') return `${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}x`;
  if (formato === 'segundos' && !compacto && Math.abs(v) >= 60) {
    const min = Math.floor(v / 60);
    return `${min} min ${Math.round(v % 60)} s`;
  }
  const abs = Math.abs(v);
  let num: string;
  if (compacto) {
    num = abs >= 1_000_000
      ? `${(v / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
      : abs >= 1000
        ? `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })} k`
        : v.toLocaleString('es-AR', { maximumFractionDigits: abs < 10 ? 1 : 0 });
  } else {
    // Centavos sólo donde dicen algo: «US$83,18» sí, «US$0,00» y «US$80,00» no.
    const conCentavos = formato === 'usd' && abs < 100 && Math.round(abs * 100) % 100 !== 0;
    const conDecimal = formato === 'numero' && abs < 100 && Math.round(abs * 10) % 10 !== 0;
    const dec = conCentavos ? 2 : conDecimal ? 1 : 0;
    num = v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  if (formato === 'usd') return `US$${num}`;
  if (formato === 'segundos') return `${num} s`;
  return num;
}

/** El período del mismo largo que termina el día antes de `desde`. */
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const dias = Math.max(1, Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1);
  const h = diasAntes(desde, 1);
  return { desde: diasAntes(h, dias - 1), hasta: h };
}

/**
 * El chip de las KPI viejas: el valor de ahora sobre el del período anterior del mismo largo,
 * «↑ 1,3×» / «↓ 0,8×». Sin período anterior con algo, no hay chip: dividir por cero no es un dato.
 */
export function chipComparar(ahora: number | null, antes: number | null): string | null {
  if (ahora == null || antes == null || !(antes > 0) || !Number.isFinite(ahora)) return null;
  const f = ahora / antes;
  return `${f >= 1 ? '↑' : '↓'} ${f.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
}

/**
 * Un conjunto que depende de una integración que no está conectada (la audiencia sin Meta). Su mensaje
 * llega TAL CUAL a la tarjeta: «no hay datos» y «no está conectado» son dos cosas, y la segunda se arregla.
 */
export class SinConexionError extends Error {}

// ── Hasta dónde se lee: el corte en HOY, en UN lugar (contrato v5) ──────────────────────────
// Hasta el 12/10/2026 seis puertas cortaban el período en hoy cada una a mano (la ruta en sus dos
// acciones, la página, el link compartido, la API de MaKo en tres operaciones y el AI Analyst), y los
// bloques no se cortaban. Una fecha que mira hacia ADELANTE (`futuro`: el vencimiento de una cuota) no
// podía existir: la cuota que vence el viernes no aparecía en ningún gráfico. La REGLA es `hastaDe` (el
// modelo, lib/graficos-catalogo.ts); acá se le suman la fecha por defecto y el «ayer» de la pauta, y la
// llama `hastaDeFuente` (lib/graficos-datos.ts) adentro de `datosDeGraficos`, de `detalleDeGrafico` y de
// `valoresDeCampo`. Quien necesita MOSTRAR el período ya cortado llama a `cortarEnHoy`.

/** Las fuentes cuyo día en curso todavía no llegó (la pauta de Meta entra por cron): se leen hasta AYER. */
const HASTA_AYER: ReadonlySet<string> = new Set(['meta', 'negocio', 'presupuesto']);

/** La fecha con la que se lee el gráfico: la pedida, o la primera del conjunto (lo mismo que `sanearGrafico`). */
const fechaDeLectura = (g: { fuente: string; fecha?: string | null }) => {
  const f = fuenteDe(g.fuente);
  return f?.fechas.find((x) => x.id === g.fecha) ?? f?.fechas[0];
};

/**
 * El `hasta` cortado en HOY, salvo que la fecha del gráfico mire hacia adelante (`futuro`). Un período que
 * empieza después de hoy queda en su primer día (no se da vuelta). Es lo que se MUESTRA como período leído;
 * la lectura de verdad además corta la pauta en ayer (`hastaDeLectura`). La REGLA es `hastaDe` del modelo
 * (lib/graficos-catalogo.ts, con su test): acá sólo se le pone la fecha por defecto del conjunto.
 */
export function cortarEnHoy(g: { fuente: string; fecha?: string | null }, desde: string, hasta: string, hoy: string): string {
  return hastaDe(g.fuente, fechaDeLectura(g)?.id ?? '', desde, hasta, hoy);
}

/**
 * Hasta dónde se lee una fuente: `cortarEnHoy` y, para la pauta y lo que la cruza, AYER — con hoy adentro,
 * toda línea de gasto termina en un desplome a cero que no pasó (medido el 10/10 sobre el ws1), y el CAC
 * de hoy saldría regalado.
 */
export function hastaDeLectura(g: { fuente: string; fecha?: string | null }, desde: string, hasta: string, hoy: string): string {
  const h = cortarEnHoy(g, desde, hasta, hoy);
  if (!HASTA_AYER.has(g.fuente) || fechaDeLectura(g)?.futuro) return h;
  const ayer = diasAntes(hoy, 1);
  return h > ayer ? (ayer < desde ? desde : ayer) : h;
}

// ── El plazo blando de una lectura (contrato v5, «la hoja Landing lenta») ───────────────────

/** Una lectura que no contestó a tiempo. Su mensaje llega tal cual a la tarjeta («Tardó demasiado: …»). */
export class PlazoVencidoError extends Error {}

/**
 * La promesa, o un `PlazoVencidoError(mensaje)` a los `ms`. ⚠️ El tope de /api/graficos es del PEDIDO entero
 * (60 s): una lectura lenta lo pasaba, Vercel contestaba 504 y TODOS los gráficos de la hoja decían «No pude
 * leer los datos», también los baratos. Con un plazo por lectura, la lenta dice que tardó y el resto llega.
 * La lectura sigue corriendo atrás (no hay forma de cancelar un fetch de supabase-js desde acá): lo que se
 * corta es la ESPERA. Su rechazo posterior no queda suelto: `Promise.race` ya lo tiene escuchado.
 */
export function conPlazo<T>(p: Promise<T>, ms: number, mensaje: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return p;
  let t: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => { t = setTimeout(() => rechazar(new PlazoVencidoError(mensaje)), ms); });
  return Promise.race([p, plazo]).finally(() => clearTimeout(t));
}
