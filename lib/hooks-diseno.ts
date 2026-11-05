// =============================================================================
// hooks-diseno — lo que dibuja la hoja «Hooks y retención» con su DISEÑO PROPIO (la copia de Ondra), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/hooks-ondra/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, HOOKS), todos de los guiones analizados de tus anuncios. La pregunta
// de la hoja es «¿en qué parte del video se van, y qué gancho los retiene?»:
//   · la cabecera → cuántos vieron los 3 primeros segundos, la mitad y el video entero (la frase de apertura);
//   · «Performance» → el hook rate, los que llegan al llamado, el ThruPlay y los guiones analizados, con su cambio contra el período
//     anterior y su curva día por día (la línea punteada es el promedio del período anterior: no hay su curva día por día);
//   · «Where it came from» → qué tipo de gancho retiene: cada uno con su hook rate, los que llegan al llamado o el ThruPlay;
//   · «Running now» → cada guion, del que más retiene al que menos;
//   · «Checkout funnel» → en qué parte del video se van: 3 segundos, un cuarto, la mitad, tres cuartos y el video entero;
//   · «Hottest leads» → el hook rate por avatar;
//   · «October budget» → tu gancho contra el bueno (28%, el mismo del veredicto), con los que llegan al llamado y el ThruPlay;
//   · «Team activity» → lo que escribió MaKo sobre qué gancho funciona (la caja de IA de la hoja, que nunca corre al abrir).
//
// LO QUE ONDRA TIENE Y MaKo NO HACE NO SE INVENTA: el rango de 7, 30 y 90 días (el período es el de la hoja), los lanzamientos de
// campaña sobre la curva, el filtro por canal del embudo, el interruptor que pausa una campaña y el presupuesto del mes. Y la
// retención es por CUARTILES del video (los p25…p100 que manda Meta), no segundo a segundo: ésa no se mide todavía.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaHooks.tsx) y el test. Lo que no llegó es `null`, nunca
// un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { HOLD_MID, HOOK_MID } from './ads-analyst-patrones';
import { rotuloDia } from './marketing-diseno';
import { marcasDelEje, topeDe } from './curso-diseno';
import { cambio, type Cambio } from './anuncio-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const SIN = '(sin dato)';

/** «31.4%» (un decimal: el hook rate se mueve de a décimas). */
export const tasa = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)}%`;
/** «122k», «72.6k», «9,201»: como el embudo de Ondra. */
export const corto = (v: number) => (v >= 1e4 ? `${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}k` : Math.round(v).toLocaleString('en-US'));
/** Las iniciales de un nombre («Mamá emprendedora» → «ME»): dos letras, con su tilde. */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter((x) => /\p{L}/u.test(x));
  const letra = (s: string) => [...s].find((c) => /\p{L}/u.test(c))?.toUpperCase() ?? '';
  return p.length === 0 ? '·' : p.length === 1 ? [...p[0]].filter((c) => /\p{L}/u.test(c)).slice(0, 2).join('').toUpperCase() : letra(p[0]) + letra(p[1]);
}

// ── «Performance» → los cuatro números y su curva ───────────────────────────────────────────────────────────────────
export type IdNumero = 'hook' | 'cta' | 'thruplay' | 'guiones';
export type NumeroHk = {
  id: IdNumero; nombre: string; valor: number | null; texto: string | null;
  /** El del período anterior, escrito («vs 29.8%»), o null si no llegó. */
  antes: string | null; anterior: number | null; cambio: Cambio | null;
  /** Día por día (la curva): null en un día sin dato, nunca 0. */
  dias: Array<{ clave: string; rotulo: string; valor: number | null }>;
  esTasa: boolean;
};
const NUMEROS: ReadonlyArray<{ id: IdNumero; nombre: string; metrica: string; esTasa: boolean }> = [
  { id: 'hook', nombre: 'Hook rate', metrica: 'hook_rate', esTasa: true },
  { id: 'cta', nombre: 'Llegan al llamado', metrica: 'ret_cta', esTasa: true },
  { id: 'thruplay', nombre: 'ThruPlay', metrica: 'thruplay_rate', esTasa: true },
  { id: 'guiones', nombre: 'Guiones analizados', metrica: 'guiones', esTasa: false },
];
export function numerosDe(piezas: Record<IdNumero, Resultado | null>): NumeroHk[] {
  return NUMEROS.map((n) => {
    const r = piezas[n.id], valor = total(r, n.metrica), anterior = anteriorDe(r, n.metrica);
    const escribir = (v: number) => (n.esTasa ? tasa(v) : Math.round(v).toLocaleString('en-US'));
    return {
      id: n.id, nombre: n.nombre, valor, texto: valor == null ? null : escribir(valor),
      antes: anterior == null ? null : `vs ${escribir(anterior)}`, anterior, cambio: cambio(valor, anterior),
      dias: (r?.serie ?? []).map((p) => ({ clave: p.clave, rotulo: rotuloDia(p.clave), valor: num(p.valor) })),
      esTasa: n.esTasa,
    };
  });
}
export type CurvaHk = { tope: number; marcas: number[]; puntos: Array<number | null>; anterior: number | null };
/** La curva de un número: el tope del eje (redondo, con el promedio de antes adentro) y qué días llevan rótulo (hasta 10). */
export function curvaDe(n: NumeroHk): CurvaHk | null {
  if (!n.dias.length) return null;
  const max = Math.max(0, ...n.dias.map((d) => d.valor ?? 0), n.anterior ?? 0);
  return { tope: topeDe(max * 1.15), marcas: marcasDelEje(n.dias.length, 10), puntos: n.dias.map((d) => d.valor), anterior: n.anterior };
}

// ── «Where it came from» → qué gancho retiene ───────────────────────────────────────────────────────────────────────
export type Tono = 'gold' | 'moss' | 'sea' | 'steel' | 'slate' | 'rose' | 'ember' | 'pine' | 'clay';
/** Los tonos de Ondra, en el orden en que pinta sus canales. */
export const TONOS: readonly Tono[] = ['gold', 'moss', 'sea', 'steel', 'slate', 'rose', 'ember', 'pine', 'clay'];
export type GanchoHk = { clave: string; nombre: string; guiones: number; parte: number; hook: number | null; cta: number | null; thru: number | null; tono: Tono };
export type GanchosHk = { filas: GanchoHk[]; hook: number | null; cta: number | null; thru: number | null; guiones: number | null; pasan: number };
/** Cuántos tipos de gancho se dibujan (Ondra dibuja seis canales). */
export const GANCHOS = 6;
export function ganchosDe(r: Resultado | null): GanchosHk | null {
  if (!r) return null;
  const todas = r.filas.filter((f) => f.clave !== SIN).map((f) => ({
    clave: f.clave, nombre: f.etiqueta || f.clave, guiones: enFila(r, f, 'guiones') ?? 0,
    hook: enFila(r, f, 'hook_rate'), cta: enFila(r, f, 'ret_cta'), thru: enFila(r, f, 'thruplay_rate'),
  })).filter((f) => f.guiones > 0).slice(0, GANCHOS);
  const suma = todas.reduce((a, f) => a + f.guiones, 0);
  return {
    filas: todas.map((f, i) => ({ ...f, parte: suma ? Math.round((f.guiones / suma) * 100) : 0, tono: TONOS[i % TONOS.length] })),
    hook: total(r, 'hook_rate'), cta: total(r, 'ret_cta'), thru: total(r, 'thruplay_rate'), guiones: total(r, 'guiones'),
    pasan: todas.filter((f) => (f.hook ?? 0) >= HOOK_MID).length,
  };
}

// ── «Running now» → cada guion ──────────────────────────────────────────────────────────────────────────────────────
export type GuionHk = { clave: string; nombre: string; detalle: string; hook: number | null; cta: number | null; thru: number | null; tono: Tono };
export type GuionesHk = { filas: GuionHk[]; total: number };
/** Cuántos guiones se dibujan (Ondra dibuja seis campañas). */
export const GUIONES = 6;
export function guionesDe(r: Resultado | null): GuionesHk | null {
  if (!r) return null;
  const tonos = new Map<string, Tono>();
  const filas = r.filas.filter((f) => f.clave !== SIN).slice(0, GUIONES).map((f) => {
    const gancho = f.extra?.gancho ?? null, formato = f.extra?.formato ?? null;
    const k = gancho ?? '';
    if (!tonos.has(k)) tonos.set(k, TONOS[tonos.size % TONOS.length]);
    return {
      clave: f.clave, nombre: f.etiqueta || f.clave, detalle: [gancho, formato].filter((x) => x && x !== SIN).join(' · '),
      hook: enFila(r, f, 'hook_rate'), cta: enFila(r, f, 'ret_cta'), thru: enFila(r, f, 'thruplay_rate'), tono: tonos.get(k)!,
    };
  });
  return { filas, total: r.filas.filter((f) => f.clave !== SIN).length + r.fuera };
}

// ── «Checkout funnel» → en qué parte del video se van ───────────────────────────────────────────────────────────────
export type PasoHk = { nombre: string; valor: number; tasa: number | null; ancho: number };
export type CaidaHk = { pasos: PasoHk[]; fuga: number };
const PASOS: ReadonlyArray<[string, string]> = [['plays_3s', '3 segundos'], ['p25', 'Un cuarto'], ['p50', 'La mitad'], ['p75', 'Tres cuartos'], ['p100', 'El video entero']];
/** El ancho de cada barra: max(.035, (el paso / el primero) ^ .42), la receta del embudo de Ondra (las de abajo se siguen viendo). */
export function caidaDe(r: Resultado | null): CaidaHk | null {
  if (!r) return null;
  const valores = PASOS.map(([m]) => total(r, m));
  const primero = valores[0];
  if (!primero) return null;
  const pasos = PASOS.map(([, nombre], i) => {
    const v = valores[i] ?? 0, antes = i ? valores[i - 1] ?? 0 : null;
    return { nombre, valor: v, tasa: i ? (antes ? (v / antes) * 100 : null) : null, ancho: Math.max(0.035, (v / primero) ** 0.42) };
  });
  // La caída más grande: el paso que retiene menos del anterior (Ondra la marca «Biggest drop»).
  const fuga = pasos.slice(1).reduce((m, p, i) => ((p.tasa ?? Infinity) < (pasos[m].tasa ?? Infinity) ? i + 1 : m), 1);
  return { pasos, fuga };
}

// ── «Hottest leads» → el hook rate por avatar ───────────────────────────────────────────────────────────────────────
export type AvatarHk = { clave: string; nombre: string; iniciales: string; hook: number | null; cta: number | null; guiones: number; bueno: boolean; tono: Tono };
/** Cuántos avatares se dibujan (Ondra dibuja cinco leads). */
export const AVATARES = 5;
const TONOS_AV: readonly Tono[] = ['rose', 'clay', 'sea', 'gold', 'moss'];
export function avataresDe(r: Resultado | null): AvatarHk[] | null {
  if (!r) return null;
  return r.filas.filter((f) => f.clave !== SIN && (enFila(r, f, 'guiones') ?? 0) > 0)
    .map((f) => ({ f, hook: enFila(r, f, 'hook_rate') }))
    .sort((a, b) => (b.hook ?? -1) - (a.hook ?? -1))
    .slice(0, AVATARES)
    .map(({ f, hook }, i) => ({
      clave: f.clave, nombre: f.etiqueta || f.clave, iniciales: iniciales(f.etiqueta || f.clave), hook, cta: enFila(r, f, 'ret_cta'),
      guiones: enFila(r, f, 'guiones') ?? 0, bueno: (hook ?? 0) >= HOOK_MID, tono: TONOS_AV[i % TONOS_AV.length],
    }));
}

// ── «October budget» → tu gancho contra el bueno ────────────────────────────────────────────────────────────────────
/** El tope del medidor: el doble del buen gancho, así la marca del bueno cae arriba, en el medio del arco. */
export const TOPE_MEDIDOR = HOOK_MID * 2;
export type FilaRef = { nombre: string; texto: string | null; estado: 'arriba' | 'abajo' | null; nota: string | null };
export type MedidorHk = { valor: number | null; parte: number; marca: number; filas: FilaRef[] };
const contra = (v: number | null, ref: number | null): Pick<FilaRef, 'estado' | 'nota'> => {
  if (v == null || ref == null) return { estado: null, nota: v == null ? null : tasa(v) };
  const d = Math.round((v - ref) * 10) / 10;
  return d >= 0 ? { estado: 'arriba', nota: d === 0 ? 'En el bueno' : `${d.toFixed(1)} arriba` } : { estado: 'abajo', nota: `${Math.abs(d).toFixed(1)} abajo` };
};
export function medidorDe(hook: number | null, cta: number | null, thru: number | null): MedidorHk {
  return {
    valor: hook, parte: hook == null ? 0 : Math.min(1, Math.max(0, hook / TOPE_MEDIDOR)), marca: HOOK_MID / TOPE_MEDIDOR,
    filas: [
      { nombre: `Gancho (el bueno: ${HOOK_MID}%)`, texto: hook == null ? null : tasa(hook), ...contra(hook, HOOK_MID) },
      { nombre: `Llegan al llamado (el bueno: ${HOLD_MID}%)`, texto: cta == null ? null : tasa(cta), ...contra(cta, HOLD_MID) },
      { nombre: 'ThruPlay', texto: thru == null ? null : tasa(thru), estado: null, nota: thru == null ? null : tasa(thru) },
    ],
  };
}

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type AperturaHk = { tres: number | null; mitad: number | null; entero: number | null };
export const aperturaDe = (r: Resultado | null): AperturaHk => ({ tres: total(r, 'plays_3s'), mitad: total(r, 'p50'), entero: total(r, 'p100') });

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaHooks = {
  apertura: AperturaHk;
  numeros: NumeroHk[];
  ganchos: GanchosHk | null;
  guiones: GuionesHk | null;
  caida: CaidaHk | null;
  avatares: AvatarHk[] | null;
  medidor: MedidorHk;
  /** Lo que todavía se está leyendo (la tarjeta muestra su esqueleto). */
  cargando: boolean;
  /** Si no hay ni un guion analizado: la hoja lo dice y lleva a Ads Writer. */
  vacia: boolean;
};
export function vistaHooks(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>): VistaHooks {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const numeros = numerosDe({ hook: r('hook'), cta: r('cta'), thruplay: r('thruplay'), guiones: r('guiones') });
  const valor = (id: IdNumero) => numeros.find((n) => n.id === id)?.valor ?? null;
  const ganchos = ganchosDe(r('gancho')), caida = caidaDe(r('video'));
  // Vacía: ningún guion analizado (el número dice 0), o los ganchos y el video llegaron y no traen nada. Lo que no llegó no la vacía.
  const vacia = valor('guiones') === 0 || (ganchos != null && !ganchos.filas.length && !ganchos.guiones && r('video') != null && caida == null);
  return {
    apertura: aperturaDe(r('apertura')),
    numeros,
    ganchos,
    guiones: guionesDe(r('tabla')),
    caida,
    avatares: avataresDe(r('avatar')),
    medidor: medidorDe(valor('hook'), valor('cta'), valor('thruplay')),
    cargando: Object.entries(p).some(([k, id]) => k !== 'ia' && datos[id]?.cargando),
    vacia,
  };
}
