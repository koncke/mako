// =============================================================================
// CUÁNTO ESCRIBE MaKo ANTES DE UN MENSAJE: UNA SOLA FUNCIÓN PARA TODOS LOS CHATS (20/11/2026)
// =============================================================================
// La auditoría de los chats (el Cerebro, 20/11: onboarding-4, reto-8 y videos-4): los puntitos duraban lo que tardaba el servidor, o
// 1,2, 1,4 y 1,8 s fijos, nunca según el largo del mensaje. La maqueta los retiene hasta 3,5 s (cuerpo.html, el paso «escribe»;
// Martín, 16/11: «que tarde un poquito más»). Desde aquí, todos: la cola de salida (app/_chat/useColaDeSalida.ts), la entrada de los
// coaches y de cada día del reto (app/_ui/tutorial/EntradaEscribiendo.tsx) y la llegada al reto (app/second-brain/LlegadaAlReto.tsx).
// Puro y sin React.
// =============================================================================

export const MS_ESCRIBE_BASE = 600;
export const MS_ESCRIBE_POR_LETRA = 20;
/** El tope: el de la maqueta (3,5 s). */
export const MS_ESCRIBE_TOPE = 3500;

/** Los puntitos antes de un mensaje: 600 ms + 20 ms por letra, con tope de 3,5 s. Sin texto que medir (null), el tope, como la maqueta. */
export function msEscribiendo(texto: string | null | undefined): number {
  if (texto == null) return MS_ESCRIBE_TOPE;
  return Math.min(MS_ESCRIBE_TOPE, MS_ESCRIBE_BASE + MS_ESCRIBE_POR_LETRA * texto.length);
}
