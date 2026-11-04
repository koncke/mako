// =============================================================================
// contenido-diseno — lo que dibuja la hoja Contenido e IA con su DISEÑO PROPIO (la copia de Orrery), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/contenido-orrery/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la
// hoja (`hoja.diseno.piezas`, lib/graficos-plantillas-generales.ts, «ia-contenido»). La pregunta: «¿cuánta IA gastamos y en qué?».
//   · la cabecera: la frase de cuántas veces se usó la IA y cuánto cambió contra el período anterior;
//   · las cuatro tarjetas: el costo de la IA y el costo por llamada (con su línea de cada día), qué parte de lo pedido a Flow
//     salió bien (con su barra) y cuántos pedidos le hizo MaKo a Flow, con los que fallaron;
//   · «Lo gastado por día» («Requests per hour»): el área del costo de cada día del período;
//   · «Videos e imágenes» («Model status»): cada tipo de pedido a Flow con su franja de lo que salió bien y lo que falló;
//   · «Qué modelo cuesta más» («Spend by model»): el costo de cada modelo y su parte del total;
//   · «Para qué se usa» («Recent requests»): cuántas llamadas hizo cada función de MaKo;
//   · «Quién le escribe a MaKo» («Quickstart»): los mensajes de cada persona, en el recuadro gris.
//
// LO QUE ORRERY TIENE Y MaKo NO MIDE NO SE INVENTA: el estado de cada modelo y su tiempo en línea de 90 días (MaKo no mide la
// disponibilidad de un proveedor), la latencia, el tope de gasto del mes y su pronóstico, los pedidos uno por uno en vivo y el
// código para empezar. La franja de «Videos e imágenes» es la PARTE de lo que salió bien y no los días: lo dice el subtítulo.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaContenido.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { cambioDe, entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const parte = (n: number | null, de: number | null) => (n != null && de != null && de > 0 ? (n / de) * 100 : null);
/** Las filas de verdad: sin «(sin dato)» ni «Otros». */
const filasDe = (r: Resultado) => r.filas.filter((f) => f.etiqueta && f.clave !== SIN_DATO && f.clave !== OTROS);

/** «US$1,463», con centavos debajo de US$100 («US$14.40») y con cuatro decimales debajo de 10 centavos («US$0.0021»). */
export function dolares(n: number): string {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a > 0 && a < 0.1) return `${s}US$${a.toFixed(4)}`;
  return `${s}US$${a < 100 ? a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(a).toLocaleString('en-US')}`;
}

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «Usaste la IA 1,240 veces · 12% más que el período anterior.» */
export function fraseContenido(llamadas: number | null, anterior: number | null): Trozo[] {
  if (llamadas == null) return [];
  if (llamadas === 0) return [{ tipo: 'texto', s: 'No usaste la IA en este período.' }];
  const out: Trozo[] = [{ tipo: 'texto', s: 'Usaste la IA ' }, { tipo: 'fuerte', s: entero(llamadas) }, { tipo: 'texto', s: llamadas === 1 ? ' vez' : ' veces' }];
  const c = anterior != null ? cambioDe('pct', llamadas, anterior) : null;
  if (c && c.d !== 0) out.push({ tipo: 'texto', s: ` · ${Math.abs(c.d)}% ${c.d > 0 ? 'más' : 'menos'} que el período anterior` });
  else if (c) out.push({ tipo: 'texto', s: ' · igual que el período anterior' });
  out.push({ tipo: 'texto', s: '.' });
  return out;
}

// ── las cuatro tarjetas ─────────────────────────────────────────────────────────────────────────────────────────
/** Un cambio contra el período anterior: el texto («+12%») y si es BUENO (gastar más en IA es malo). */
export type Delta = { texto: string; bueno: boolean } | null;
export function deltaCosto(actual: number | null, anterior: number | null): Delta {
  const c = actual != null && anterior != null ? cambioDe('pct', actual, anterior) : null;
  return c ? { texto: c.texto, bueno: c.d <= 0 } : null;
}
/** Los valores de cada día (la `serie` del número), sin los que faltan. */
export const lineaDe = (r: Resultado | null): number[] => (r?.serie ?? []).map((p) => num(p.valor) ?? 0);

export type FlowPr = { pedidos: number; listos: number; fallidos: number; tasa: number | null };
export type TarjetasCt = {
  costo: { valor: string | null; delta: Delta; linea: number[] };
  prom: { valor: string | null; delta: Delta; linea: number[] };
  exito: { valor: string | null; barra: number; listos: number | null; pedidos: number | null; fallidos: number | null };
  pedidos: { valor: string | null; fallidos: number | null; linea: number[] };
};
export function tarjetasDe(costo: Resultado | null, prom: Resultado | null, pedidos: Resultado | null, exito: Resultado | null, flow: FlowPr | null): TarjetasCt {
  const c = total(costo, 'costo'), p = total(prom, 'costo_prom'), n = total(pedidos, 'trabajos'), t = total(exito, 'tasa_exito');
  return {
    costo: { valor: c == null ? null : dolares(c), delta: deltaCosto(c, anteriorDe(costo, 'costo')), linea: lineaDe(costo) },
    prom: { valor: p == null ? null : dolares(p), delta: deltaCosto(p, anteriorDe(prom, 'costo_prom')), linea: lineaDe(prom) },
    exito: {
      valor: t == null ? null : `${Math.round(t)}%`, barra: t == null ? 0 : Math.max(0, Math.min(100, t)) / 100,
      listos: flow?.listos ?? null, pedidos: flow?.pedidos ?? null, fallidos: flow?.fallidos ?? null,
    },
    pedidos: { valor: n == null ? null : entero(n), fallidos: flow?.fallidos ?? null, linea: lineaDe(pedidos) },
  };
}

// ── lo gastado por día ───────────────────────────────────────────────────────────────────────────────────────────
export type GastoCt = { puntos: Array<{ clave: string; rotulo: string; valor: number }>; total: number; tope: number; marcas: number[]; paso: PasoTiempo; rotulos: Array<{ i: number; texto: string }> };
/** El tope del eje: el primer número «redondo» que cubre el máximo (1, 2, 2.5 o 5 por una potencia de 10). */
export function topeDe(max: number): number {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= max) return k * p;
  return 10 * p;
}
/** Hasta `n` rótulos del eje de abajo, repartidos: el primero y el último siempre. */
export function rotulosDe(cuantos: number, n = 6): number[] {
  if (cuantos <= 0) return [];
  if (cuantos <= n) return Array.from({ length: cuantos }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < n; k++) out.add(Math.round((k * (cuantos - 1)) / (n - 1)));
  return [...out];
}
export function gastoDe(r: Resultado | null): GastoCt | null {
  if (!r) return null;
  const puntos = r.filas.map((f) => ({ clave: f.clave, rotulo: '', valor: enFila(r, f, 'costo') ?? 0 }));
  if (!puntos.length) return { puntos: [], total: 0, tope: 1, marcas: [1, 2 / 3, 1 / 3, 0], paso: 'dia', rotulos: [] };
  const paso = pasoDe(puntos.map((p) => p.clave));
  for (const p of puntos) p.rotulo = rotuloDia(p.clave, paso);
  const tope = topeDe(Math.max(...puntos.map((p) => p.valor)));
  return {
    puntos, total: total(r, 'costo') ?? puntos.reduce((a, p) => a + p.valor, 0), tope, marcas: [tope, (tope * 2) / 3, tope / 3, 0], paso,
    rotulos: rotulosDe(puntos.length).map((i) => ({ i, texto: puntos[i].rotulo })),
  };
}

// ── videos e imágenes ────────────────────────────────────────────────────────────────────────────────────────────
export const CELDAS = 30;
export type TipoFlow = { clave: string; nombre: string; pedidos: number; listos: number; fallidos: number; tasa: number | null; bien: boolean; malas: number[] };
/** Qué celdas de la franja van en ámbar: tantas como la parte que falló (al menos una si falló algo), repartidas. */
export function celdasMalas(fallidos: number, pedidos: number): number[] {
  if (pedidos <= 0 || fallidos <= 0) return [];
  const k = Math.min(CELDAS, Math.max(1, Math.round((fallidos / pedidos) * CELDAS)));
  return Array.from({ length: k }, (_, j) => Math.min(CELDAS - 1, Math.floor(((j + 0.5) * CELDAS) / k)));
}
/** «Bien» desde el 90% de lo pedido que salió (el «Operational» de Orrery); debajo, «Con fallas». */
export const UMBRAL_BIEN = 90;
export function flowDe(r: Resultado | null): { tipos: TipoFlow[]; totales: FlowPr } | null {
  if (!r) return null;
  const tipos = filasDe(r).map((f) => {
    const pedidos = enFila(r, f, 'trabajos') ?? 0, listos = enFila(r, f, 'listos') ?? 0, fallidos = enFila(r, f, 'fallidos') ?? 0;
    const tasa = enFila(r, f, 'tasa_exito') ?? parte(listos, pedidos);
    return { clave: f.clave, nombre: f.etiqueta, pedidos, listos, fallidos, tasa, bien: tasa != null && tasa >= UMBRAL_BIEN, malas: celdasMalas(fallidos, pedidos) };
  });
  const pedidos = total(r, 'trabajos'), listos = total(r, 'listos'), fallidos = total(r, 'fallidos');
  return { tipos, totales: { pedidos: pedidos ?? 0, listos: listos ?? 0, fallidos: fallidos ?? 0, tasa: total(r, 'tasa_exito') ?? parte(listos, pedidos) } };
}

// ── las listas: los modelos, las funciones y quién escribe ───────────────────────────────────────────────────────
export type FilaCt = { clave: string; nombre: string; valor: number; parte: number | null; tono: 1 | 2 | 3 | 4 };
/** Las primeras `n` filas con su parte del TOTAL de la pieza (no de las que se ven), y cuántas más hay. */
export function listaDe(r: Resultado | null, metrica: string, n: number): { filas: FilaCt[]; mas: number; total: number | null } | null {
  if (!r) return null;
  const todas = filasDe(r);
  const tot = total(r, metrica);
  const filas = todas.slice(0, n).map((f, i) => {
    const v = enFila(r, f, metrica) ?? 0;
    return { clave: f.clave, nombre: f.etiqueta, valor: v, parte: parte(v, tot), tono: ((i % 4) + 1) as FilaCt['tono'] };
  });
  return { filas, mas: Math.max(0, todas.length - n) + r.fuera, total: tot };
}
export const FILAS_MODELOS = 4, FILAS_FUNCIONES = 6, FILAS_QUIEN = 6;

// ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaContenido = {
  frase: Trozo[];
  tarjetas: TarjetasCt;
  gasto: GastoCt | null;
  flow: { tipos: TipoFlow[]; totales: FlowPr } | null;
  modelos: ReturnType<typeof listaDe>;
  funciones: ReturnType<typeof listaDe>;
  quien: ReturnType<typeof listaDe>;
  problemas: Partial<Record<'frase' | 'tarjetas' | 'gasto' | 'flow' | 'modelos' | 'funciones' | 'quien', string>>;
};
export function vistaContenido(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>): VistaContenido {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaContenido['problemas'] = {};
  if (err(p.apertura)) problemas.frase = 'No pude leer cuánto usaste la IA.';
  if (err(p.costo) || err(p.prom) || err(p.pedidos) || err(p.listos)) problemas.tarjetas = 'No pude leer algunos números.';
  if (err(p.dias)) problemas.gasto = 'No pude leer lo gastado por día.';
  if (err(p.flow)) problemas.flow = 'No pude leer los pedidos a Flow.';
  if (err(p.modelos)) problemas.modelos = 'No pude leer el costo de cada modelo.';
  if (err(p.funciones)) problemas.funciones = 'No pude leer para qué se usa la IA.';
  if (err(p.quien)) problemas.quien = 'No pude leer quién le escribe a MaKo.';
  const ap = res(datos, p.apertura);
  const flow = flowDe(res(datos, p.flow));
  return {
    frase: fraseContenido(total(ap, 'llamadas'), anteriorDe(ap, 'llamadas')),
    tarjetas: tarjetasDe(res(datos, p.costo), res(datos, p.prom), res(datos, p.pedidos), res(datos, p.listos), flow?.totales ?? null),
    gasto: gastoDe(res(datos, p.dias)),
    flow,
    modelos: listaDe(res(datos, p.modelos), 'costo', FILAS_MODELOS),
    funciones: listaDe(res(datos, p.funciones), 'llamadas', FILAS_FUNCIONES),
    quien: listaDe(res(datos, p.quien), 'mensajes', FILAS_QUIEN),
    problemas,
  };
}
