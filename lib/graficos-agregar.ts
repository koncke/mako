// =============================================================================
// graficos-agregar — de filas sueltas a lo que dibuja un gráfico de «Mis gráficos»
// =============================================================================
// Puro y sin `server-only`, para que tenga test: el lector (`lib/graficos-datos.ts`) trae
// las filas de la base ya normalizadas y esto las agrupa por la dimensión del gráfico.
//
// Tres decisiones que no se ven en la firma:
//   · Una RAZÓN se calcula sobre lo SUMADO del grupo, nunca promediando filas (el CTR de una
//     campaña es sus clics ÷ sus impresiones).
//   · El TIEMPO se rellena: un día sin filas es un cero dibujado, no un día que falta. Una
//     línea que saltea el martes se lee como si el lunes y el miércoles fueran seguidos.
//   · «Otros» SUMA las bases y recalcula la razón, igual que cualquier otro grupo. Y el
//     TOTAL sale de todas las filas, no de las que entraron al gráfico: una torta de las 5
//     campañas que más gastaron no cambia cuánto se gastó.

import {
  dimensionDe, fuenteDe, metricaDe, type Formato, type Grafico, type Metrica,
} from './graficos-catalogo';
import { diasAntes, lunesDeFecha } from './date-utils';

/** Una fila ya normalizada por el lector: su fecha (la del «rango por»), sus etiquetas y sus números. */
export type Fila = { f: string | null; d: Record<string, string | null>; v: Record<string, number> };

export type Resultado = {
  /** Una por métrica del gráfico, en su orden. */
  columnas: Array<{ id: string; nombre: string; formato: Formato }>;
  /** Una por grupo, ya ordenadas y recortadas al límite (salvo el tiempo, que va entero). */
  filas: Array<{ clave: string; etiqueta: string; valores: Array<number | null> }>;
  /** Sobre TODAS las filas del rango. */
  totales: Array<number | null>;
  /** Cuántos grupos no entraron (fueron a «Otros» o se recortaron). */
  fuera: number;
  /** La clase de la dimensión, para que la pantalla sepa si es una serie de tiempo. */
  clase: 'tiempo' | 'categoria' | null;
};

export const SIN_DATO = '(sin dato)';
export const OTROS = 'Otros';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La clave del grupo de tiempo de una fecha `YYYY-MM-DD`. */
export function claveTiempo(dim: string, fecha: string): string {
  if (dim === 'semana') return lunesDeFecha(fecha);
  if (dim === 'mes') return `${fecha.slice(0, 7)}-01`;
  return fecha;
}

/** Cómo se lee esa clave en un eje: «03/10», «sem 29/09», «oct 26». */
export function etiquetaTiempo(dim: string, clave: string): string {
  const [y, m, d] = clave.split('-');
  if (dim === 'mes') return `${MESES[Number(m) - 1] ?? m} ${y.slice(2)}`;
  return `${d}/${m}`;
}

/** Todas las claves de tiempo entre dos fechas, incluidas las puntas. */
export function clavesDelRango(dim: string, desde: string, hasta: string): string[] {
  const out: string[] = [];
  let f = claveTiempo(dim, desde);
  // Tope defensivo: un rango de 20 años en días son 7.300 puntos, y eso ya no es un gráfico.
  for (let i = 0; i < 4000 && f <= hasta; i++) {
    out.push(f);
    if (dim === 'mes') {
      const [y, m] = f.split('-').map(Number);
      f = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    } else f = diasAntes(f, dim === 'semana' ? -7 : -1);
  }
  return out;
}

type Sumas = Record<string, number>;

/** Las bases que hacen falta para calcular las métricas pedidas (las razones piden dos). */
function basesDe(mets: Metrica[]): string[] {
  const s = new Set<string>();
  for (const m of mets) {
    if (m.razon) { s.add(m.razon.num); s.add(m.razon.den); } else s.add(m.id);
  }
  return [...s];
}

function sumar(acc: Sumas, fila: Fila, bases: string[]) {
  for (const b of bases) acc[b] = (acc[b] ?? 0) + (Number.isFinite(fila.v[b]) ? fila.v[b] : 0);
}

function valor(m: Metrica, s: Sumas): number | null {
  if (!m.razon) return s[m.id] ?? 0;
  const den = s[m.razon.den] ?? 0;
  return den ? ((s[m.razon.num] ?? 0) / den) * m.razon.factor : null;
}

export function agregar(g: Grafico, filas: Fila[], desde: string, hasta: string): Resultado {
  const fuente = fuenteDe(g.fuente);
  const vacio: Resultado = { columnas: [], filas: [], totales: [], fuera: 0, clase: null };
  if (!fuente) return vacio;
  const mets = g.metricas.map((id) => metricaDe(fuente, id)).filter((m): m is Metrica => !!m);
  const bases = basesDe(mets);
  const columnas = mets.map((m) => ({ id: m.id, nombre: m.nombre, formato: m.formato }));

  const total: Sumas = {};
  for (const f of filas) sumar(total, f, bases);
  const totales = mets.map((m) => valor(m, total));

  const dim = dimensionDe(fuente, g.dimension);
  if (!dim) return { columnas, filas: [], totales, fuera: 0, clase: null };

  const grupos = new Map<string, Sumas>();
  for (const f of filas) {
    let clave: string;
    if (dim.clase === 'tiempo') {
      if (!f.f) continue;
      clave = claveTiempo(dim.id, f.f);
    } else {
      const v = f.d[dim.id];
      clave = v && v.trim() ? v.trim() : SIN_DATO;
    }
    const acc = grupos.get(clave) ?? {};
    sumar(acc, f, bases);
    grupos.set(clave, acc);
  }

  if (dim.clase === 'tiempo') {
    const claves = clavesDelRango(dim.id, desde, hasta);
    return {
      columnas, totales, fuera: 0, clase: 'tiempo',
      filas: claves.map((c) => ({ clave: c, etiqueta: etiquetaTiempo(dim.id, c), valores: mets.map((m) => valor(m, grupos.get(c) ?? {})) })),
    };
  }

  // Por categoría: según el «Ordenar» del gráfico (por defecto, la primera métrica de mayor a
  // menor); lo que no se puede calcular va después de todo lo que sí, y «(sin dato)» al final.
  const mOrden = mets.find((m) => m.id === g.ordenMetrica) ?? mets[0];
  const signo = g.ordenAsc ? 1 : -1;
  const lista = [...grupos.entries()].map(([clave, s]) => ({ clave, s, orden: mOrden ? valor(mOrden, s) : 0 }));
  lista.sort((a, b) => {
    if (a.clave === SIN_DATO || b.clave === SIN_DATO) return a.clave === SIN_DATO ? 1 : -1;
    if (a.orden == null || b.orden == null) return a.orden == null ? (b.orden == null ? 0 : 1) : -1;
    return signo * (a.orden - b.orden) || a.clave.localeCompare(b.clave);
  });

  const limite = Math.max(1, g.limite);
  let visibles = lista;
  let fuera = 0;
  if (lista.length > limite) {
    if (g.tipo === 'torta' || g.tipo === 'barras') {
      // Los primeros N-1 y el resto sumado en «Otros», así la torta sigue sumando el total.
      visibles = lista.slice(0, limite - 1);
      const resto = lista.slice(limite - 1);
      const s: Sumas = {};
      for (const r of resto) for (const b of bases) s[b] = (s[b] ?? 0) + (r.s[b] ?? 0);
      visibles = [...visibles, { clave: OTROS, s, orden: 0 }];
      fuera = resto.length;
    } else {
      visibles = lista.slice(0, limite);
      fuera = lista.length - limite;
    }
  }
  return {
    columnas, totales, fuera, clase: 'categoria',
    filas: visibles.map((r) => ({ clave: r.clave, etiqueta: r.clave, valores: mets.map((m) => valor(m, r.s)) })),
  };
}

/**
 * Cómo se escribe un valor: «US$1.234», «US$83,18», «12,5%», «1.234». `null` = no se puede
 * calcular. `compacto` es para los ejes: sin centavos y con «k» desde mil, o el rótulo no entra.
 */
export function fmtValor(v: number | null, formato: Formato, compacto = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (formato === 'pct') return `${v.toLocaleString('es-AR', { maximumFractionDigits: compacto ? 0 : 1 })}%`;
  const abs = Math.abs(v);
  let num: string;
  if (compacto) {
    num = abs >= 1000
      ? `${(v / 1000).toLocaleString('es-AR', { maximumFractionDigits: abs >= 10_000 ? 0 : 1 })}k`
      : v.toLocaleString('es-AR', { maximumFractionDigits: abs < 10 ? 1 : 0 });
  } else {
    // Centavos sólo donde dicen algo: «US$83,18» sí, «US$0,00» y «US$80,00» no.
    const conCentavos = formato === 'usd' && abs < 100 && Math.round(abs * 100) % 100 !== 0;
    num = v.toLocaleString('es-AR', { minimumFractionDigits: conCentavos ? 2 : 0, maximumFractionDigits: conCentavos ? 2 : 0 });
  }
  return formato === 'usd' ? `US$${num}` : num;
}
