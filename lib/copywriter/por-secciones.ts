// =============================================================================
// copywriter/por-secciones — una pieza LARGA se escribe sección por sección, cada una con su largo (PURO, 18/11/2026)
// =============================================================================
// El hueco medido el 18/11/2026 (docs/hallazgos-copywriter.md, «El VSL Generator ya era el Copywriter»): «Editar» escribe la
// pieza entera en UN pedido, y en un pedido entran 2.000 palabras (`PALABRAS_POR_PEDIDO`, ./ia-reglas.ts), unos 13 minutos
// dichos. Las estructuras de VSL (lib/vsl-estructuras.ts) son de 20 a 45 minutos: la «Clase gratuita · 42 min» pide 6.300
// palabras, salía con 2.000 como mucho, la segunda pasada la daba por buena desde 1.500 y el aviso callaba arriba de 1.200.
//
// Lo que hace esto, cuando la pieza pide más de lo que entra en un pedido (`esLargaParaUnPedido`):
//   1. el PRESUPUESTO de cada sección sale de la GUÍA de su estructura: cada bloque trae sus minutos («CLAVE UNO (7-15 min)»),
//      y el reparto se escala a la duración de la página (`presupuestoPorSeccion`). Una guía que no dice los minutos de un
//      bloque le da el promedio de los otros; una que no dice ninguno, partes iguales;
//   2. la primera pasada de «Editar» es el BORRADOR (la pieza entera, corta): sus secciones que quedaron debajo del 75 % de su
//      presupuesto se piden de nuevo, en TANDAS de hasta `PALABRAS_POR_PEDIDO` cada una (`tandasDeSecciones`), una tanda por
//      llamada, en orden y de a una (en paralelo contra una sola clave es un 429 seguro, y un 429 degrada de proveedor);
//   3. lo que vuelve REEMPLAZA a la sección del borrador en el mismo lugar de la lista de operaciones, y sólo si es más largo
//      (`reemplazarSecciones`): la propuesta que se construye a la vista escribe cada sección una vez;
//   4. el aviso de duración mide contra el largo REAL de la pieza (no contra el tope de un pedido) y nombra las secciones que
//      quedaron cortas (`avisoDeDuracionPorSecciones`).
//
// Lo que NO hace, a propósito:
//   · no toca una sección que la primera pasada no escribió: puede ser lo que la persona ya tenía («Cambias SÓLO lo que se
//     pidió», lib/copywriter/ia-editar.ts);
//   · no sube el tope por pedido: cada llamada sigue entrando en lo que entra. Lo que cambia es que una pieza son varias;
//   · no corre si no queda tiempo para otra llamada (`quedaTiempo`), y corta en la primera que falla o que se queda sin saldo
//     (`esSinSaldo`): sin saldo no hay otra llamada que lo arregle, y un proveedor caído no se va a levantar a la tanda siguiente.
//
// ⚠️ N LLAMADAS = N COBROS (AGENTS.md, «Toda llamada a un modelo descuenta MaKo Tokens»). Cada tanda es una llamada a la IA del
// Copywriter, y el medidor reserva y liquida cada una por separado (lib/mako-tokens-medidor.ts). La clase de 42 minutos es el
// borrador más unas 5 tandas. Lo dice la fila de `copywriter-ia` en lib/mako-tokens-costos.ts, y `llamadas` lo devuelve.
//
// ⚠️ NADA SE GUARDA ACÁ (AGENTS.md, «Lo que se puede cortar y reintentar…»): «Editar» devuelve operaciones y la pantalla las
// construye como propuesta. Si el pedido se corta a la mitad no queda nada escrito, y reintentar no duplica: no hay nada que
// adoptar. Los ids de los bloques los pone el saneo de cada respuesta (`sanearOperaciones`), una vez, y la lista final los lleva.
//
// SIN server-only: lo ejecuta su test con un modelo de mentira (tests/copywriter-por-secciones.test.ts).
// =============================================================================

import { PALABRAS_POR_PEDIDO } from './ia-reglas';
import { nombreDeSeccion } from './doc';
import { palabrasDe } from './outliers';
import type { BloqueIA, OperacionIA } from './operaciones';

/** Palabras dichas por minuto (la misma cuenta que `objetivoDeDuracion`: 2,5 por segundo). */
export const PALABRAS_POR_MINUTO = 150;

/** Debajo de esto, una sección del borrador se vuelve a pedir (el mismo umbral que `cortaParaSuDuracion`). */
export const UMBRAL_ALARGAR = 0.75;

/** Debajo de esto, la sección se nombra en el aviso (el mismo umbral que `avisoDeDuracion`). */
export const UMBRAL_AVISO = 0.6;

/** Lo mínimo que se le pide a una sección: un bloque corto de una estructura larga no baja de esto. */
const MINIMO_POR_SECCION = 40;

/** La estructura, como la lee esto: sus etiquetas en orden y la guía con los minutos de cada una. */
export type EstructuraConGuia = { etiquetas: readonly string[]; guia: string };

/** Lo que se le pide a una sección: su etiqueta exacta y sus palabras. */
export type Presupuesto = { seccion: string; palabras: number };

/** ¿La pieza pide más palabras de las que entran en un pedido? */
export function esLargaParaUnPedido(segundos: number | null | undefined): boolean {
  return typeof segundos === 'number' && Number.isFinite(segundos) && segundos > 0
    && Math.round(segundos * PALABRAS_POR_MINUTO / 60) > PALABRAS_POR_PEDIDO;
}

const numero = (s: string) => Number(s.replace(',', '.'));

/**
 * Los segundos que la guía le da a un bloque, de lo que dice entre paréntesis después de su etiqueta. Entiende las formas que
 * usa la casa: «(2-6 min)» (las VSL), «(1:30-3:00)» (YouTube), «(30-40 segundos)» y «(3 segundos)» (los reels). null = no lo
 * dice (o lo dice de una forma que no se entiende: el bloque toma el promedio de los otros).
 */
export function segundosDeLaGuia(guia: string, etiqueta: string): number | null {
  const linea = guia.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith(`${etiqueta} (`));
  const dentro = linea?.slice(etiqueta.length).match(/^\s*\(([^)]*)\)/)?.[1];
  if (!dentro) return null;
  const min = dentro.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*min/);
  if (min) return Math.max(0, numero(min[2]) - numero(min[1])) * 60 || null;
  const reloj = dentro.match(/(\d+):(\d{2})\s*-\s*(\d+):(\d{2})/);
  if (reloj) return Math.max(0, (Number(reloj[3]) * 60 + Number(reloj[4])) - (Number(reloj[1]) * 60 + Number(reloj[2]))) || null;
  const rango = dentro.match(/(\d+)\s*-\s*(\d+)\s*s(?:egundos)?(?!\p{L})/u);
  if (rango) return (Number(rango[1]) + Number(rango[2])) / 2 || null;
  const uno = dentro.match(/(\d+)\s*s(?:egundos)?(?!\p{L})/u);
  if (uno) return Number(uno[1]) || null;
  return null;
}

/**
 * Las palabras de cada sección para una pieza de `segundos`: el reparto de la guía, escalado al largo de la página (la VSL de 30
 * minutos de la estructura, en una página de 20, reparte 3.000 palabras en la misma proporción). Ninguna pasa de lo que entra en
 * un pedido: una sección se escribe entera en una llamada.
 */
export function presupuestoPorSeccion(e: EstructuraConGuia, segundos: number): Presupuesto[] {
  const etiquetas = [...new Set(e.etiquetas.map((x) => x.trim()).filter(Boolean))];
  if (!etiquetas.length || !(segundos > 0)) return [];
  const leidos = etiquetas.map((et) => segundosDeLaGuia(e.guia, et));
  const conDato = leidos.filter((x): x is number => x != null && x > 0);
  const promedio = conDato.length ? conDato.reduce((a, b) => a + b, 0) / conDato.length : 1;
  const pesos = leidos.map((x) => (x != null && x > 0 ? x : promedio));
  const suma = pesos.reduce((a, b) => a + b, 0);
  const total = Math.round(segundos * PALABRAS_POR_MINUTO / 60);
  return etiquetas.map((seccion, i) => ({
    seccion,
    palabras: Math.min(PALABRAS_POR_PEDIDO, Math.max(MINIMO_POR_SECCION, Math.round(total * pesos[i] / suma))),
  }));
}

/** Las palabras de lo que se DICE en unos bloques (texto, listas y celdas; los separadores no dicen nada). */
export function palabrasDeBloques(bloques: readonly BloqueIA[]): number {
  return bloques.reduce((n, b) => {
    if ('texto' in b) return n + palabrasDe(b.texto);
    if ('items' in b) return n + palabrasDe(b.items.join('\n'));
    if ('filas' in b) return n + palabrasDe(b.filas.map((f) => f.join(' ')).join('\n'));
    return n;
  }, 0);
}

/** Lo que dice cada sección según las operaciones (la ÚLTIMA `escribir_seccion` de cada una: reemplaza el cuerpo entero). */
export function palabrasPorSeccion(ops: readonly OperacionIA[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const op of ops) if (op.op === 'escribir_seccion') out.set(op.seccion, palabrasDeBloques(op.bloques));
  return out;
}

/**
 * Las secciones agrupadas en tandas de hasta `tope` palabras, en orden y sin partir una sección. Cada tanda es UNA llamada.
 * Una sección que sola ya llega al tope va sola (el presupuesto ya está topeado en `presupuestoPorSeccion`).
 */
export function tandasDeSecciones<T extends Presupuesto>(secciones: readonly T[], tope: number = PALABRAS_POR_PEDIDO): T[][] {
  const out: T[][] = [];
  let actual: T[] = [];
  let suma = 0;
  for (const s of secciones) {
    if (actual.length && suma + s.palabras > tope) { out.push(actual); actual = []; suma = 0; }
    actual.push(s);
    suma += s.palabras;
  }
  if (actual.length) out.push(actual);
  return out;
}

/** Una sección de una tanda: lo que se le pide y lo que el borrador ya dice. */
export type SeccionDeTanda = Presupuesto & { escritas: number };

/**
 * El pedido de una tanda, para el MISMO chat de la primera pasada (va después de su respuesta): reescribir SÓLO esas secciones,
 * cada una con su largo. Lo que vuelve se sanea como cualquier respuesta de «Editar», y del resultado se toman sólo las
 * `escribir_seccion` de estas secciones (el resto de lo que devuelva, se ignora).
 */
export function pedidoDeSecciones(tanda: readonly SeccionDeTanda[], segundos: number): string {
  const lineas = tanda.map((s) => `- ${s.seccion}: unas ${s.palabras} palabras (ahora tiene ${s.escritas}).`);
  return [
    `La pieza dura ${Math.round(segundos / 60)} minutos (unas ${PALABRAS_POR_MINUTO} palabras dichas por minuto) y estas secciones quedaron cortas para su largo:`,
    ...lineas,
    'Reescribe SÓLO esas secciones, cada una ENTERA y con su largo (entre el 85 % y el 100 % de lo pedido, sin contar los títulos), siguiendo la GUÍA de cada una y lo que ya dice el resto de la pieza: lo que se dice, entero, no un resumen de lo que habría que decir. No repitas lo que otra sección ya dijo.',
    'Las demás secciones quedan como están: no las devuelvas. Devuelve el MISMO formato JSON, con un «escribir_seccion» por cada una de esas secciones y nada más.',
  ].join('\n');
}

/**
 * Las operaciones con las secciones nuevas en el LUGAR de las del borrador. Una nueva entra sólo si es de una sección que el
 * borrador escribió y si dice más que la de antes (una tanda que vuelve más corta no empeora la pieza).
 */
export function reemplazarSecciones(ops: readonly OperacionIA[], nuevas: readonly OperacionIA[]): { ops: OperacionIA[]; reemplazadas: string[] } {
  const out = [...ops];
  const reemplazadas: string[] = [];
  for (const n of nuevas) {
    if (n.op !== 'escribir_seccion') continue;
    const i = out.findIndex((o) => o.op === 'escribir_seccion' && o.seccion === n.seccion);
    if (i < 0) continue;
    const vieja = out[i] as Extract<OperacionIA, { op: 'escribir_seccion' }>;
    if (palabrasDeBloques(n.bloques) <= palabrasDeBloques(vieja.bloques)) continue;
    out[i] = n;
    if (!reemplazadas.includes(n.seccion)) reemplazadas.push(n.seccion);
  }
  return { ops: out, reemplazadas };
}

export type ResultadoPorSecciones = {
  /** Las operaciones finales: las del borrador con las secciones alargadas en su lugar. */
  ops: OperacionIA[];
  /** Cuántas llamadas de más se hicieron (cada una se cobra aparte). */
  llamadas: number;
  /** Las secciones que se alargaron. */
  alargadas: string[];
  /** Las que siguen debajo del 60 % de su presupuesto (las que nombra el aviso). */
  faltan: string[];
  /** Por qué se cortó antes de terminar: null = terminó. */
  corte: null | 'tiempo' | 'saldo' | 'falla';
  /** El texto del corte para la persona (el del medidor si fue el saldo); null si no hay que decir nada. */
  motivo: string | null;
};

/**
 * Alarga las secciones cortas del borrador, de a una tanda por llamada.
 *
 * `pedir` hace UNA llamada con el pedido de la tanda y devuelve sus operaciones YA SANEADAS (en ./ia.ts: el mismo chat, la misma
 * reparación del JSON y el mismo saneo que la primera pasada). `quedaTiempo` se pregunta antes de cada tanda. `esSinSaldo` dice si
 * el error es «no hay MaKo Tokens» (lib/mako-tokens-medidor.ts → `esSinSaldoDeMt`, que acá no se importa: es server-only).
 */
export async function escribirPorSecciones(p: {
  ops: readonly OperacionIA[];
  presupuesto: readonly Presupuesto[];
  segundos: number;
  pedir: (mensaje: string, tanda: readonly SeccionDeTanda[]) => Promise<OperacionIA[]>;
  quedaTiempo: () => boolean;
  esSinSaldo: (e: unknown) => boolean;
  tope?: number;
}): Promise<ResultadoPorSecciones> {
  let ops = [...p.ops];
  // Sólo lo que el borrador escribió: una sección que no tocó puede ser lo que la persona ya tenía.
  const escritas = palabrasPorSeccion(ops);
  const delBorrador = p.presupuesto.filter((s) => escritas.has(s.seccion));
  const cortas: SeccionDeTanda[] = delBorrador
    .map((s) => ({ ...s, escritas: escritas.get(s.seccion) ?? 0 }))
    .filter((s) => s.escritas < s.palabras * UMBRAL_ALARGAR);
  let llamadas = 0;
  const alargadas: string[] = [];
  let corte: ResultadoPorSecciones['corte'] = null;
  let motivo: string | null = null;
  for (const tanda of tandasDeSecciones(cortas, p.tope)) {
    if (!p.quedaTiempo()) { corte = 'tiempo'; break; }
    try {
      llamadas += 1;
      const pedidas = new Set(tanda.map((s) => s.seccion));
      const vueltas = (await p.pedir(pedidoDeSecciones(tanda, p.segundos), tanda)).filter((o) => o.op === 'escribir_seccion' && pedidas.has(o.seccion));
      const r = reemplazarSecciones(ops, vueltas);
      ops = r.ops;
      for (const s of r.reemplazadas) if (!alargadas.includes(s)) alargadas.push(s);
    } catch (e) {
      if (p.esSinSaldo(e)) { corte = 'saldo'; motivo = e instanceof Error ? e.message : String(e); }
      else corte = 'falla';
      break;
    }
  }
  const finales = palabrasPorSeccion(ops);
  const faltan = delBorrador.filter((s) => (finales.get(s.seccion) ?? 0) < s.palabras * UMBRAL_AVISO).map((s) => s.seccion);
  return { ops, llamadas, alargadas, faltan, corte, motivo };
}

/**
 * El aviso de la duración de una pieza escrita por secciones: contra el largo REAL de la pieza (no contra el tope de un pedido,
 * que es lo que medía `avisoDeDuracion` y por eso callaba en una VSL de 42 minutos con 1.300 palabras), nombrando lo que falta.
 * null = está bien (las secciones que escribió llegan al 60 % de lo suyo, y la pieza también).
 */
export function avisoDeDuracionPorSecciones(palabras: number, segundos: number, faltan: readonly string[]): string | null {
  const objetivo = Math.round(segundos * PALABRAS_POR_MINUTO / 60);
  if (!faltan.length && palabras >= objetivo * UMBRAL_AVISO) return null;
  const dichos = Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO));
  const pieza = `Dura unos ${dichos} minutos dichos y la pieza es de ${Math.round(segundos / 60)}`;
  if (!faltan.length) return `${pieza}: pídele a MaKo que la complete.`;
  const nombres = faltan.map((s) => `«${nombreDeSeccion(s)}»`);
  const lista = nombres.length <= 3
    ? (nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`)
    : `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} ${nombres.length - 3 === 1 ? 'sección' : 'secciones'} más`;
  return `${pieza}: pídele a MaKo que alargue ${lista}.`;
}
