// =============================================================================
// landing-diseno — lo que dibuja la hoja Landing con su DISEÑO PROPIO (la copia de Corbel), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/landing-corbel/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, LANDING). La pregunta de la hoja es «¿hasta dónde bajan y dónde
// hacen clic?»:
//   · la cabecera: cuántas visitas y personas entraron y si son más que antes; en lugar del «live now», las visitas de HOY;
//   · los cuatro números de Corbel, con su cambio y su dibujo chico: las visitas (las últimas tres columnas), los que llegan a la
//     mitad (su línea), los que llegan al final (el anillo: de los que llegan a la mitad, cuántos siguen) y los que tocan un botón
//     (sus barras de los últimos días);
//   · el medidor («Sales performance»): el puntaje del diagnóstico de la página, su veredicto en palabras y el porqué (la página
//     más floja y la mejor);
//   · las columnas («Revenue»): las visitas (o las personas) de cada día del período, la de hoy en negro y el promedio;
//   · «Cuándo entran» («Visits by time»): las visitas por franja horaria y día de la semana, en cinco tonos;
//   · «De dónde llegan» («Total visits»): las visitas y su reparto entre los orígenes, con el anillo del primero.
//
// LO QUE CORBEL TIENE Y MaKo NO HACE NO SE INVENTA: el pronóstico del mes que viene (la columna punteada), la meta del anillo
// (acá el anillo es una proporción medida) y el «live now» (el Pixel no cuenta presencia: se dice cuántas visitas hubo hoy).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaLanding.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { cambioDe, corto, entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';
import { DIAS_SEMANA, FRANJAS_HORA } from './visitas-momento';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** «48%»; debajo de 10, con un decimal («4.8%»): un porcentaje chico sin decimales no se distingue. */
export const pct = (v: number) => (Math.abs(v) < 10 ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${Math.round(v)}%`);

// ── los cuatro números ──────────────────────────────────────────────────────────────────────────────────────────
export type IdTile = 'visitas' | 'mitad' | 'final' | 'tocan';
export type TileLanding = {
  id: IdTile;
  titulo: string;
  valor: number | null;
  texto: string | null;
  cambio: string | null;
  /** Hacia dónde se movió (la flecha) y si eso es bueno (el color): en las cuatro, más es mejor. */
  sube: boolean | null;
  /** El link de abajo: a las páginas, al diagnóstico o a la grilla (donde están el embudo y los clics). */
  link: { texto: string; a: 'paginas' | 'diagnostico' | 'grilla' };
  /** Las barras de las visitas: las últimas tres columnas, de 0 a 1 contra la más alta. */
  barras?: number[] | null;
  /** La línea de los que llegan a la mitad: cada día, de 0 a 1 entre el mínimo y el máximo. */
  linea?: Array<number | null> | null;
  /** El anillo: de los que llegan a la mitad, cuántos llegan al final (0 a 100). */
  anillo?: number | null;
  /** Las barras finas de los que tocan un botón: los últimos diez días, de 0 a 1 contra el más alto. */
  finas?: number[] | null;
};

function cambioTile(dif: 'pct' | 'puntos', actual: number | null, anterior: number | null): { cambio: string | null; sube: boolean | null } {
  const c = actual != null && anterior != null ? cambioDe(dif, actual, anterior) : null;
  return { cambio: c?.texto ?? null, sube: c ? (c.d > 0 ? true : c.d < 0 ? false : null) : null };
}
const relativos = (vs: number[], min0 = true): number[] | null => {
  if (!vs.length) return null;
  const max = Math.max(...vs), min = min0 ? 0 : Math.min(...vs);
  return max > min ? vs.map((v) => (v - min) / (max - min)) : vs.map(() => (max > 0 ? 1 : 0));
};

export function tilesDe(ap: Resultado | null, columnas: ColumnasLanding | null, mitad: Resultado | null, final: Resultado | null, scroll: Resultado | null, tocan: Resultado | null): TileLanding[] {
  const visitas = total(ap, 'visitas');
  const ultimas = columnas ? columnas.columnas.slice(-3).map((c) => c.visitas ?? 0) : [];
  const vMitad = total(mitad, 'pct_50'), vFinal = total(final, 'pct_100'), vTocan = total(tocan, 'personas');
  const serieMitad = (mitad?.serie ?? []).map((s) => num(s.valor));
  const conValor = serieMitad.filter((v): v is number => v != null);
  const rango = conValor.length ? [Math.min(...conValor), Math.max(...conValor)] : null;
  const llegan50 = total(scroll, 'llegaron_50'), llegan100 = total(scroll, 'llegaron_100');
  const finas = (tocan?.serie ?? []).slice(-10).map((s) => num(s.valor) ?? 0);
  return [
    { id: 'visitas', titulo: 'Visitas', valor: visitas, texto: visitas != null ? entero(visitas) : null, ...cambioTile('pct', visitas, anteriorDe(ap, 'visitas')),
      link: { texto: 'Ver tus páginas', a: 'paginas' }, barras: ultimas.length === 3 ? relativos(ultimas) : null },
    { id: 'mitad', titulo: 'Llegan a la mitad', valor: vMitad, texto: vMitad != null ? pct(vMitad) : null, ...cambioTile('puntos', vMitad, anteriorDe(mitad, 'pct_50')),
      link: { texto: 'Ver hasta dónde bajan', a: 'grilla' },
      linea: rango && conValor.length >= 2 ? serieMitad.map((v) => (v == null ? null : rango[1] > rango[0] ? (v - rango[0]) / (rango[1] - rango[0]) : 0.5)) : null },
    { id: 'final', titulo: 'Llegan al final', valor: vFinal, texto: vFinal != null ? pct(vFinal) : null, ...cambioTile('puntos', vFinal, anteriorDe(final, 'pct_100')),
      link: { texto: 'Ver el diagnóstico', a: 'diagnostico' }, anillo: llegan50 && llegan100 != null ? Math.min(100, Math.round((llegan100 / llegan50) * 100)) : null },
    { id: 'tocan', titulo: 'Tocan un botón', valor: vTocan, texto: vTocan != null ? entero(vTocan) : null, ...cambioTile('pct', vTocan, anteriorDe(tocan, 'personas')),
      link: { texto: 'Ver qué tocan', a: 'grilla' }, finas: finas.length >= 2 ? relativos(finas) : null },
  ];
}

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «Entraron 1,240 visitas de 980 personas, 12% más que el período anterior.» En UN renglón. */
export function fraseLanding(visitas: number | null, personas: number | null, anterior: number | null): Trozo[] {
  if (visitas == null) return [];
  if (visitas === 0) return [{ tipo: 'texto', s: 'No entró nadie a tus páginas en este período.' }];
  const t: Trozo[] = [{ tipo: 'texto', s: 'Entraron ' }, { tipo: 'fuerte', s: `${entero(visitas)} ${visitas === 1 ? 'visita' : 'visitas'}` }];
  if (personas != null) t.push({ tipo: 'texto', s: ' de ' }, { tipo: 'fuerte', s: `${entero(personas)} ${personas === 1 ? 'persona' : 'personas'}` });
  const c = anterior ? Math.round(((visitas - anterior) / anterior) * 100) : null;
  if (c != null && c !== 0) t.push({ tipo: 'texto', s: ', ' }, { tipo: 'fuerte', s: `${Math.abs(c)}% ${c > 0 ? 'más' : 'menos'}` }, { tipo: 'texto', s: ' que el período anterior' });
  else if (c === 0) t.push({ tipo: 'texto', s: ', igual que el período anterior' });
  t.push({ tipo: 'texto', s: '.' });
  return t;
}

// ── el medidor ──────────────────────────────────────────────────────────────────────────────────────────────────
export type PuntajeLanding = { valor: number | null; veredicto: string; porque: string | null; analizada: boolean };
export function veredictoDePuntaje(p: number): string {
  return p >= 80 ? 'Bien armada' : p >= 60 ? 'Se puede mejorar' : 'Hay que arreglarla';
}
export function puntajeDe(r: Resultado | null, diagnostico: Resultado | null): PuntajeLanding {
  const v = total(r, 'puntaje');
  if (v == null) return { valor: null, veredicto: 'Sin diagnóstico', porque: 'MaKo todavía no analizó tu página.', analizada: false };
  const valor = Math.round(v);
  const paginas = (diagnostico?.filas ?? [])
    .map((f) => ({ nombre: f.etiqueta, p: enFila(diagnostico!, f, 'puntaje') }))
    .filter((x): x is { nombre: string; p: number } => x.p != null && x.nombre !== '(sin dato)' && x.nombre !== 'Otros')
    .sort((a, b) => a.p - b.p);
  let porque: string | null = null;
  if (paginas.length >= 2) {
    const peor = paginas[0], mejor = paginas[paginas.length - 1];
    porque = `La más floja es ${peor.nombre} (${Math.round(peor.p)} de 100); la mejor, ${mejor.nombre} (${Math.round(mejor.p)}).`;
  } else if (paginas.length === 1) porque = `Es el diagnóstico de ${paginas[0].nombre}.`;
  return { valor, veredicto: veredictoDePuntaje(valor), porque, analizada: true };
}

// ── las columnas ────────────────────────────────────────────────────────────────────────────────────────────────
export type ColumnaLanding = { clave: string; rotulo: string; dia: string; mes: string; visitas: number | null; personas: number | null; ahora: boolean };
export type ColumnasLanding = {
  columnas: ColumnaLanding[];
  paso: PasoTiempo;
  /** Las visitas de todo el período (no sólo las columnas que se ven). */
  total: number | null;
  /** Las columnas que no entran (las más viejas): se ven las últimas doce. */
  fuera: number;
};
/** Las doce columnas: las últimas del período, la de hoy (o la de esta semana o este mes) marcada. */
export function columnasDe(r: Resultado | null, hoy: string): ColumnasLanding | null {
  if (!r || r.clase !== 'tiempo' || !r.filas.length) return null;
  const paso = pasoDe(r.filas.map((f) => f.clave));
  const todas = r.filas.map((f) => {
    const rot = rotuloDia(f.clave, paso);
    const [dia, mes = ''] = rot.split(' ');
    return { clave: f.clave, rotulo: rot, dia, mes, visitas: enFila(r, f, 'visitas'), personas: enFila(r, f, 'visitantes'), ahora: false };
  });
  const ultima = todas[todas.length - 1];
  // «Ahora» es la columna que contiene hoy: el día, la semana (de lunes) o el mes.
  const contiene = (c: ColumnaLanding) => (paso === 'dia' ? c.clave.slice(0, 10) === hoy : paso === 'mes' ? c.clave.slice(0, 7) === hoy.slice(0, 7) : c.clave.slice(0, 10) <= hoy && hoy < masDias(c.clave, 7));
  if (ultima && contiene(ultima)) ultima.ahora = true;
  const columnas = todas.slice(-12);
  return { columnas, paso, total: total(r, 'visitas'), fuera: todas.length - columnas.length };
}
function masDias(clave: string, n: number): string {
  const d = new Date(`${clave.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** El tope del eje: el primer número redondo (1, 1.5, 2, 2.5, 3 o 5 × 10^k, como los 15k de Corbel) que, por cuatro, cubre el máximo. */
export function escalaColumnas(max: number): { tope: number; paso: number } {
  if (!(max > 0)) return { tope: 4, paso: 1 };
  const base = 10 ** Math.floor(Math.log10(max / 4));
  for (const k of [1, 1.5, 2, 2.5, 3, 5, 10]) { const p = k * base; if (p * 4 >= max) return { tope: p * 4, paso: p }; }
  return { tope: base * 40, paso: base * 10 };
}
export const rotuloEje = (v: number) => corto(v);

// ── cuándo entran ───────────────────────────────────────────────────────────────────────────────────────────────
export type CuandoLanding = {
  dias: string[];
  franjas: string[];
  /** franjas × días: las visitas (null = no llegó). */
  valores: Array<Array<number | null>>;
  /** El tono de cada celda: 0 (nada) a 4 (lo más). */
  tonos: number[][];
  max: number;
};
export function tonoDe(v: number | null, max: number): number {
  if (v == null || v <= 0 || max <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((v / max) * 4)));
}
export function cuandoDe(r: Resultado | null): CuandoLanding | null {
  if (!r || !r.cruce || !r.filas.length) return null;
  const cols = r.cruce.claves.map(normal);
  const valores = FRANJAS_HORA.map((fr) => {
    const i = r.filas.findIndex((f) => normal(f.etiqueta) === normal(fr) || normal(f.clave) === normal(fr));
    return DIAS_SEMANA.map((d) => {
      const j = cols.indexOf(normal(d));
      if (i < 0) return 0;
      return j < 0 ? 0 : num(r.cruce!.celdas[i]?.[j]) ?? 0;
    });
  });
  const max = Math.max(0, ...valores.flat().map((v) => v ?? 0));
  if (max <= 0) return { dias: DIAS_CORTOS, franjas: [...FRANJAS_HORA], valores, tonos: valores.map((f) => f.map(() => 0)), max: 0 };
  return { dias: DIAS_CORTOS, franjas: [...FRANJAS_HORA], valores, tonos: valores.map((f) => f.map((v) => tonoDe(v, max))), max };
}

// ── de dónde llegan ─────────────────────────────────────────────────────────────────────────────────────────────
export type OrigenLanding = { total: number | null; partes: Array<{ clave: string; nombre: string; valor: number; pct: number; otros: boolean }> };
export function origenDe(r: Resultado | null): OrigenLanding | null {
  if (!r || !r.filas.length) return null;
  const tot = total(r, 'visitas');
  const filas = r.filas
    .map((f) => ({ clave: f.clave, nombre: f.etiqueta === '(sin dato)' ? 'Sin origen' : f.etiqueta, valor: enFila(r, f, 'visitas') ?? 0, otros: f.etiqueta === 'Otros' }))
    .filter((f) => f.valor > 0);
  if (!filas.length || !tot) return { total: tot, partes: [] };
  const propias = filas.filter((f) => !f.otros).sort((a, b) => b.valor - a.valor);
  // Tres partes, como Corbel. Con más de tres orígenes (o con los que el gráfico ya juntó en «Otros»), los dos primeros y «Otros»
  // con el resto: las partes suman el total, nunca una porción de lo que se ve.
  const todasCaben = propias.length <= 3 && !filas.some((f) => f.otros);
  const elegidas = todasCaben ? propias : propias.slice(0, 2);
  const resto = todasCaben ? 0 : tot - elegidas.reduce((a, b) => a + b.valor, 0);
  const partes = [...elegidas, ...(resto > 0 ? [{ clave: 'Otros', nombre: 'Otros', valor: resto, otros: true }] : [])];
  return { total: tot, partes: partes.map((x) => ({ ...x, pct: (x.valor / tot) * 100 })) };
}

// ── la hoja ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaLanding = {
  frase: Trozo[];
  /** Las visitas de hoy (en lugar del «live now»): null si el período no llega a hoy o no se leyó. */
  hoy: number | null;
  tiles: TileLanding[];
  puntaje: PuntajeLanding;
  columnas: ColumnasLanding | null;
  cuando: CuandoLanding | null;
  origen: OrigenLanding | null;
  /** El cambio de las visitas contra el período anterior (el chip de «De dónde llegan»). */
  cambioVisitas: { cambio: string | null; sube: boolean | null };
  /** Lo que no se pudo leer, por pieza (para decirlo en su tarjeta, nunca dibujar ceros). */
  fallos: Partial<Record<'columnas' | 'cuando' | 'origen' | 'puntaje', string>>;
};

export function vistaLanding(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaLanding {
  const p = hoja.diseno?.piezas ?? {};
  const ap = res(datos, p.apertura);
  const columnas = columnasDe(res(datos, p.visitas), hoy);
  const fallos: VistaLanding['fallos'] = {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  if (err(p.visitas)) fallos.columnas = 'No pude leer las visitas día por día.';
  if (err(p.cuando)) fallos.cuando = 'No pude leer cuándo entran.';
  if (err(p.origen)) fallos.origen = 'No pude leer de dónde llegan.';
  if (err(p.puntaje)) fallos.puntaje = 'No pude leer el diagnóstico.';
  const visitas = total(ap, 'visitas');
  const hoyCol = columnas?.columnas.find((c) => c.ahora && columnas.paso === 'dia');
  return {
    frase: fraseLanding(visitas, total(ap, 'visitantes'), anteriorDe(ap, 'visitas')),
    hoy: hoyCol ? hoyCol.visitas : null,
    tiles: tilesDe(ap, columnas, res(datos, p.mitad), res(datos, p.final), res(datos, p.scroll), res(datos, p.tocan)),
    puntaje: puntajeDe(res(datos, p.puntaje), res(datos, p.diagnostico)),
    columnas,
    cuando: cuandoDe(res(datos, p.cuando)),
    origen: origenDe(res(datos, p.origen)),
    cambioVisitas: cambioTile('pct', visitas, anteriorDe(ap, 'visitas')),
    fallos,
  };
}
