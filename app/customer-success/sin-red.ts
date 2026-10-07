// =============================================================================
// sin-red — una server action que NO LLEGA se lee como un error más, nunca como un crash
// =============================================================================
// Medido en el arnés el 06/10/2026 abortando el POST de la acción: una server action sin
// red RECHAZA la promesa, y adentro de una transición (`useTransition`) ese rechazo llega
// al error boundary — la pantalla entera pasa a «Esta pantalla se rompió al dibujarse».
// Es lo que vería alguien que se queda sin red justo al soltar una tarjeta. Afuera de una
// transición no tumba nada, pero deja el `.then` sin correr: un guardado que falla en
// silencio, y quien escribió se va creyendo que quedó.
//
// ⚠️ UNA FUNCIÓN Y NO UN `.catch` POR LLAMADA. Hasta hoy había dos handlers que lo
// atajaban a mano y seis que no, en el mismo archivo: la regla escrita en cada call site
// cubre los que existían el día que se escribió. Con un nombre, el guard de
// tests/cs-kanban-ficha-ui.test.ts puede exigir que TODA llamada a una acción en
// ClientesApp y FichaCliente pase por acá.
//
// ⚠️ EL TEXTO QUE SE MUESTRA ES EL NUESTRO, NO EL DEL RECHAZO. Lo que trae el error es
// «Failed to fetch», «Load failed» o —en producción— el párrafo genérico de Next sobre
// un render del server: en inglés, técnico y distinto en cada navegador. Y tampoco se
// afirma una causa que no se midió («revisa tu conexión» sería cierto a veces): se dice
// qué no pasó. El rechazo crudo va a la consola, que es donde se diagnostica.
//
// Sin `'use client'` ni `server-only`: lo importan dos componentes de cliente y un test.

/** La forma de un fallo de las acciones de esta pantalla: `{ ok: false, error }`. */
export type FalloAtajado = { ok: false; error: string };

/**
 * La promesa de una acción, con el rechazo convertido en `{ ok: false, error }`.
 *
 * `error` es lo que la pantalla dice si la acción no llegó: corto y en español
 * («No se pudo mover.»). Si la acción SÍ llegó y contestó `ok: false`, manda su propio
 * texto, que es el que sabe qué pasó.
 */
export function atajar<T>(p: Promise<T>, error: string): Promise<T | FalloAtajado> {
  return p.catch((e: unknown): FalloAtajado => {
    console.error('[customer-success] la acción no llegó:', e instanceof Error ? e.message : e);
    return { ok: false, error };
  });
}
