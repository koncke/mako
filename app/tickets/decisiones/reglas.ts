// =============================================================================
// La Ticketera (lógica pura, con test): la cola, la respuesta marcada y cuándo cuenta un gesto
// =============================================================================
// Martín, 14/10/2026: «quiero que diseñes esto como si fuera "tinder" en donde hay tarjetas y yo
// puedo ir desplazando a la derecha o la izquierda para aprobar o ignorar. Y que en el medio
// cargue mi respuesta... Y claro pueda ver el detalle». Y después: se llama «Ticketera», el mazo
// es LA vista (la lista es la secundaria) y hace falta «Resuelta».
//
// Es la MISMA fuente que la lista (admin_decisiones, lib/admin-decisiones.ts) y la misma acción
// para contestar: lo que se contesta en una vista aparece contestado en la otra.
//
// El modelo, y por qué:
//   · Deslizar a la DERECHA MANDA la respuesta MARCADA. Viene marcada la recomendada (o la única
//     opción); si no hay, se marca tocando una en el medio. 37 de las 55 primeras decisiones no
//     traían recomendada: «derecha = la recomendada» habría dejado el gesto muerto en dos de cada
//     tres tarjetas.
//   · Tocar una opción la MARCA, no la manda: un toque de paso, haciendo scroll, no contesta nada.
//   · Deslizar a la IZQUIERDA es «después»: NO contesta. La tarjeta pasa a una pila aparte y vuelve
//     cuando el mazo se termina (si volviera al final de la cola, no habría pantalla de «listo»).
//   · «Resuelta» (botón, no gesto) la saca sin elegir opción: se contesta con RESUELTA.
// =============================================================================
import { OTRA, URGENCIAS, motivoRespuestaInvalida, repartir, type Decision } from '@/app/admin/runway/decisiones';

/** Las dos vistas de la Ticketera. El mazo es la de entrada; la lista, la secundaria. */
export const TICKETERA = '/tickets/decisiones';
export const TICKETERA_LISTA = '/tickets/decisiones/lista';

/** Las pendientes en el orden del tablero: primero lo que frena a un chat, al final los avisos. */
export function colaInicial(ds: readonly Decision[]): Decision[] {
  const { pendientes } = repartir(ds);
  return URGENCIAS.flatMap((u) => pendientes[u.clave]);
}

/**
 * Lo que llegó al REFRESCAR (tirar hacia abajo en el teléfono, o la revalidación después de
 * contestar) y el mazo nunca vio: va al FINAL de la cola, en su orden. Lo que ya pasó por el mazo
 * —en la cola, en «después», contestado o deshecho— no vuelve por acá: rearmar la cola con las props
 * nuevas haría volver una «después» (15/10/2026: sin esto, refrescar el mazo no traía nada nuevo).
 */
export function nuevasParaElMazo(ds: readonly Decision[], vistas: ReadonlySet<Decision['id']>): Decision[] {
  return colaInicial(ds).filter((d) => !vistas.has(d.id));
}

/** Cuántas quedan POR DECIDIR: un aviso («para saber») no es una decisión y no se cuenta. */
export function porDecidir(cola: readonly Pick<Decision, 'urgencia'>[]): number {
  return cola.filter((d) => d.urgencia !== 'aviso').length;
}

/**
 * Lo que viene marcado al mostrar una tarjeta: lo que ya contestó (si vuelve con «Cambiar»), la
 * recomendada, la única opción, o escribir (si no tiene opciones). Si no, nada: la elige él.
 */
export function marcadaInicial(d: Pick<Decision, 'opciones' | 'recomendada' | 'respuesta'>): string | null {
  if (d.respuesta && (d.respuesta === OTRA || d.opciones.some((o) => o.clave === d.respuesta))) return d.respuesta;
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
 * ¿El arrastre cuenta? Lo que mide el dedo lo da la librería del gesto (`motion`: `info.offset.x`
 * en px y `info.velocity.x` en px/s). La regla es la de siempre en un mazo tipo Tinder: cuenta si
 * se llevó LEJOS (un cuarto largo de la tarjeta, nunca menos de 100 px) o si fue un TIRÓN rápido
 * (≥ 500 px/s) que ya salió del lugar (≥ 40 px) para el mismo lado. Llevarla lejos y tirar para
 * atrás al soltar (> 300 px/s) la devuelve: es arrepentirse.
 */
export function veredictoGesto(p: { dx: number; vx: number; ancho: number }): 'derecha' | 'izquierda' | null {
  const umbral = Math.max(100, p.ancho * 0.28);
  const lado = p.dx > 0 ? 'derecha' : 'izquierda';
  const vuelve = Math.sign(p.vx) === -Math.sign(p.dx) && Math.abs(p.vx) > 300;
  if (Math.abs(p.dx) >= umbral && !vuelve) return lado;
  if (Math.abs(p.dx) >= 40 && Math.abs(p.vx) >= 500 && Math.sign(p.vx) === Math.sign(p.dx)) return lado;
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
