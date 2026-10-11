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

import { dimensionDe, fuenteDe, metricaDe, tipoDe, type Formato, type Grafico, type Metrica } from './graficos-catalogo';
import { diasAntes, lunesDeFecha } from './date-utils';

/**
 * Una fila ya normalizada por el lector: su fecha, sus etiquetas, sus números, sus claves distintas y sus
 * REFERENCIAS: `r[dim]` es el id de lo que nombra `d[dim]` (`r.anuncio` = el ad_id del anuncio, `r.cliente`
 * = el lead_id del cliente de una cuota). Se agrupa por el TEXTO, como siempre — dos campañas con el mismo
 * nombre son una para quien mira el gráfico —, y la referencia viaja aparte para que una acción sepa sobre
 * QUÉ actuar (lib/graficos-acciones.ts).
 */
export type Fila = { f: string | null; d: Record<string, string | null>; v: Record<string, number>; u?: Record<string, string | null>; r?: Record<string, string | null> };

export type FilaResultado = {
  clave: string; etiqueta: string; valores: Array<number | null>; desde?: string; hasta?: string;
  /** El id de lo que es este grupo, SÓLO si todas sus filas traen el mismo (un anuncio, un lead). */
  ref?: string;
  /**
   * Cuántas cosas distintas quedaron bajo esta etiqueta (dos clientes que se llaman igual; las filas sin id
   * cuentan como una más). Con esto no hay `ref`: si una rama puede decir «ambiguo», no termina en `[0]`.
   */
  ambiguo?: number;
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
};

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
 */
type Acum = { s: Record<string, number>; u: Record<string, Set<string>>; fmin?: string; fmax?: string; refs?: Set<string>; sinRef?: boolean };
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

/** Las bases que hacen falta para calcular las métricas pedidas (una razón pide dos). */
function basesDe(mets: Metrica[], fuenteMets: Metrica[]): { sumas: string[]; distintos: string[] } {
  const sumas = new Set<string>();
  const distintos = new Set<string>();
  const anotar = (id: string) => {
    const mm = fuenteMets.find((x) => x.id === id);
    if (mm?.distinto) distintos.add(id); else sumas.add(id);
  };
  for (const mm of mets) {
    if (mm.razon) { anotar(mm.razon.num); anotar(mm.razon.den); } else anotar(mm.id);
  }
  return { sumas: [...sumas], distintos: [...distintos] };
}

function sumar(a: Acum, fila: Fila, b: { sumas: string[]; distintos: string[] }) {
  for (const k of b.sumas) a.s[k] = (a.s[k] ?? 0) + (Number.isFinite(fila.v[k]) ? fila.v[k] : 0);
  for (const k of b.distintos) {
    const clave = fila.u?.[k];
    if (clave == null || clave === '') continue;
    (a.u[k] ??= new Set()).add(clave);
  }
  if (fila.f) {
    if (!a.fmin || fila.f < a.fmin) a.fmin = fila.f;
    if (!a.fmax || fila.f > a.fmax) a.fmax = fila.f;
  }
}
function juntar(destino: Acum, otro: Acum) {
  for (const [k, v] of Object.entries(otro.s)) destino.s[k] = (destino.s[k] ?? 0) + v;
  for (const [k, set] of Object.entries(otro.u)) { const d = (destino.u[k] ??= new Set()); for (const x of set) d.add(x); }
  if (otro.fmin && (!destino.fmin || otro.fmin < destino.fmin)) destino.fmin = otro.fmin;
  if (otro.fmax && (!destino.fmax || otro.fmax > destino.fmax)) destino.fmax = otro.fmax;
}
function base(id: string, a: Acum, fuenteMets: Metrica[]): number {
  return fuenteMets.find((x) => x.id === id)?.distinto ? a.u[id]?.size ?? 0 : a.s[id] ?? 0;
}
function valor(mm: Metrica, a: Acum, fuenteMets: Metrica[]): number | null {
  if (!mm.razon) return base(mm.id, a, fuenteMets);
  const den = base(mm.razon.den, a, fuenteMets);
  return den ? (base(mm.razon.num, a, fuenteMets) / den) * mm.razon.factor : null;
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
  if (!dim) return { columnas, filas: [], totales, fuera: 0, clase: null, ...(serie ? { serie } : {}) };

  const grupos = new Map<string, Acum>();
  for (const f of filas) {
    const k = claveDe(dim.id, dim.clase, f);
    if (k == null) continue;
    const a = grupos.get(k) ?? nuevo();
    sumar(a, f, b);
    // Un día no es una cosa con id: la referencia es sólo de las categorías.
    if (dim.clase === 'categoria') anotarRef(a, f.r?.[dim.id]);
    grupos.set(k, a);
  }

  // ── el orden y el recorte ──
  let lista: Array<{ clave: string; a: Acum }>;
  let fuera = 0;
  if (dim.clase === 'tiempo') {
    lista = clavesDelRango(dim.id, desde, hasta).map((k) => ({ clave: k, a: grupos.get(k) ?? nuevo() }));
  } else {
    const mOrden = mets.find((x) => x.id === g.ordenMetrica) ?? mets[0];
    const signo = g.ordenAsc ? 1 : -1;
    const ord = [...grupos.entries()].map(([clave, a]) => ({ clave, a, o: mOrden ? valor(mOrden, a, fm) : 0 }));
    ord.sort((x, y) => {
      if (x.clave === SIN_DATO || y.clave === SIN_DATO) return x.clave === SIN_DATO ? 1 : -1;
      // Unos tramos con orden propio (la edad) se leen en ese orden, no del que más al que menos.
      if (dim.ordenEtiqueta) return x.clave.localeCompare(y.clave, 'es', { numeric: true });
      if (x.o == null || y.o == null) return x.o == null ? (y.o == null ? 0 : 1) : -1;
      return signo * (x.o - y.o) || x.clave.localeCompare(y.clave);
    });
    lista = ord;
    // El histograma necesita TODOS los grupos para repartirlos en franjas.
    // El mapa tampoco se recorta: un estado que queda afuera se dibujaría «Sin datos» teniendo datos.
    const limite = g.tipo === 'histograma' || g.tipo === 'mapa' ? Infinity : Math.max(1, g.limite);
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
    filas: lista.map((x) => ({
      clave: x.clave,
      etiqueta: dim.clase === 'tiempo' ? etiquetaTiempo(dim.id, x.clave) : x.clave,
      valores: mets.map((mm) => valor(mm, x.a, fm)),
      ...(x.a.fmin ? { desde: x.a.fmin, hasta: x.a.fmax } : {}),
      ...refDeGrupo(x.a),
    })),
    ...(serie ? { serie } : {}),
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
    // Las columnas que más pesan primero; el resto, juntas en «Otros».
    const cols = [...porColumna.entries()]
      .map(([k, a]) => ({ k, o: valor(mets[0], a, fm) ?? 0 }))
      .sort((x, y) => (x.k === SIN_DATO ? 1 : y.k === SIN_DATO ? -1 : y.o - x.o));
    const quedan = cols.slice(0, MAX_COLUMNAS_DESGLOSE).map((x) => x.k);
    const hayResto = cols.length > MAX_COLUMNAS_DESGLOSE;
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
