// =============================================================================
// El mazo de decisiones (lógica pura, con test): la cola, la respuesta marcada y el gesto
// =============================================================================
// Martín, 14/10/2026: «quiero que diseñes esto como si fuera "tinder" en donde hay tarjetas y yo
// puedo ir desplazando a la derecha o la izquierda para aprobar o ignorar. Y que en el medio
// cargue mi respuesta... Y claro pueda ver el detalle».
//
// Es la MISMA fuente que /admin/runway (admin_decisiones, lib/admin-decisiones.ts) y la misma
// acción para contestar: lo que se contesta acá aparece contestado allá y al revés.
//
// El modelo del gesto, y por qué:
//   · Deslizar a la DERECHA MANDA la respuesta MARCADA. Viene marcada la recomendada (o la única
//     opción); si no hay, se marca tocando una en el medio. 37 de las 55 primeras decisiones no
//     traían recomendada: «derecha = la recomendada» habría dejado el gesto muerto en dos de cada
//     tres tarjetas.
//   · Tocar una opción la MARCA, no la manda. El que manda es el gesto (o el botón ✓): un toque
//     de paso, haciendo scroll, no puede contestar una decisión.
//   · Deslizar a la IZQUIERDA es «después»: NO contesta nada. La tarjeta pasa a una pila aparte y
//     vuelve cuando el mazo se termina. Si volviera al final de la cola, el mazo no se terminaría
//     nunca y no habría pantalla de «listo».
// =============================================================================
import { OTRA, URGENCIAS, motivoRespuestaInvalida, repartir, type Decision } from '@/app/admin/runway/decisiones';

/** Las pendientes en el orden del tablero: primero lo que frena a un chat, al final los avisos. */
export function colaInicial(ds: readonly Decision[]): Decision[] {
  const { pendientes } = repartir(ds);
  return URGENCIAS.flatMap((u) => pendientes[u.clave]);
}

/**
 * Lo que viene marcado al mostrar una tarjeta: lo que ya contestó (si vuelve con «Cambiar»), la
 * recomendada, la única opción, o escribir (si no tiene opciones). Si no, nada: la elige él.
 */
export function marcadaInicial(d: Pick<Decision, 'opciones' | 'recomendada' | 'respuesta'>): string | null {
  if (d.respuesta) return d.respuesta;
  if (d.opciones.length === 0) return OTRA;
  if (d.recomendada && d.opciones.some((o) => o.clave === d.recomendada)) return d.recomendada;
  if (d.opciones.length === 1) return d.opciones[0].clave;
  return null;
}

/** ¿Se puede mandar lo marcado? La misma regla que valida el server (`motivoRespuestaInvalida`). */
export function puedeMandar(d: Pick<Decision, 'opciones'>, marcada: string | null, texto: string): boolean {
  if (!marcada) return false;
  return motivoRespuestaInvalida(d, marcada, marcada === OTRA ? texto : '') === null;
}

/** El rótulo del botón ✓ (y del sello al arrastrar): corto, y dice QUÉ se manda. */
export function rotuloMandar(d: Pick<Decision, 'recomendada'>, marcada: string | null): string {
  if (!marcada) return 'Elige una';
  if (marcada === OTRA) return 'Mandar';
  return marcada === d.recomendada ? 'Aprobar' : `Mandar ${marcada}`;
}

/**
 * ¿El arrastre cuenta? Por distancia (un cuarto largo de la tarjeta, nunca menos de 96 px) o por
 * un tirón rápido (≥ 0,6 px/ms) que ya salió del lugar (≥ 40 px). Llevarla lejos y TIRAR para
 * atrás al soltar (> 0,3 px/ms) la devuelve: es arrepentirse. Un temblor del dedo no cuenta.
 */
export function veredictoGesto(p: { dx: number; vx: number; ancho: number }): 'derecha' | 'izquierda' | null {
  const umbral = Math.max(96, p.ancho * 0.28);
  const lado = p.dx > 0 ? 'derecha' : 'izquierda';
  const vuelve = Math.sign(p.vx) === -Math.sign(p.dx) && Math.abs(p.vx) > 0.3;
  if (Math.abs(p.dx) >= umbral && !vuelve) return lado;
  if (Math.abs(p.dx) >= 40 && Math.abs(p.vx) >= 0.6 && Math.sign(p.vx) === Math.sign(p.dx)) return lado;
  return null;
}

/** Saca una decisión de una lista (por id). */
export function sinLa(lista: readonly Decision[], id: number): Decision[] {
  return lista.filter((d) => d.id !== id);
}

/** Pone una decisión al frente (la que vuelve con «Cambiar»), sin duplicarla. */
export function alFrente(lista: readonly Decision[], d: Decision): Decision[] {
  return [d, ...sinLa(lista, d.id)];
}
