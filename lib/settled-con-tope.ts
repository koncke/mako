// =============================================================================
// settled-con-tope — `Promise.allSettled` con un tope de cuántas corren a la vez
// =============================================================================
// Sin `server-only`, a propósito: lo usa la barra de lote del Ads Manager (un
// componente cliente) y lo prueba un test.
//
// EL CASO (13/10/2026, del relevo del Ads Manager). Pausar, activar o cambiar el
// presupuesto de N filas mandaba los N pedidos a /api/meta-write de golpe, y cada uno
// son dos llamadas a Meta (de quién es el objeto + la escritura). Meta topea por
// cuenta publicitaria y contesta el exceso con un error por fila, así que un lote
// grande podía dejar la mitad sin hacer. Con un tope, la ráfaga se reparte.
//
// ⚠️ Lo que NO hace: bajar el TOTAL de llamadas. El cupo de Meta se cuenta en una
// ventana de tiempo; un lote enorme puede agotarlo igual, y ahí el error de cada fila
// sigue saliendo por `avisarFallos` (app/ads-manager/CampanasBrowser.tsx). No medido
// contra Meta: la cuenta de MaKo todavía no tiene los permisos de anuncios.
// =============================================================================

/** Cuántas escrituras a Meta salen a la vez desde la barra de lote. */
export const TOPE_LOTE_META = 4;

/**
 * Igual que `Promise.allSettled(items.map(fn))` —mismo orden y misma forma de cada
 * resultado—, pero con `tope` como máximo en vuelo. Un `fn` que tira queda como
 * `rejected` y no frena a los demás.
 */
export async function allSettledConTope<T, R>(
  items: readonly T[],
  tope: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let siguiente = 0;
  const trabajador = async (): Promise<void> => {
    while (siguiente < items.length) {
      const i = siguiente++;
      try {
        out[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: 'rejected', reason };
      }
    }
  };
  const n = Math.max(1, Math.min(Math.floor(tope) || 1, items.length));
  await Promise.all(Array.from({ length: n }, trabajador));
  return out;
}
