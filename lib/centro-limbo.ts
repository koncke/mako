// =============================================================================
// Los mensajes que esperan un chat cerrado: cuándo vencen y con qué motivo (30/10/2026; puro, con test)
// =============================================================================
// Un mensaje de Martín a un chat cerrado se quedaba `escrito` sin que nadie se enterara y, a los 15 días, vencía sin avisar. Medido
// el 30/10: 11 ahí, el más viejo del 24/10. Lo único que lo decía era una línea adentro de ESE chat, que él ya no abre.
//
// ⚠️ EL CARTEL ROJO SE SACÓ EL 31/10/2026 («elimina el cartel rojo», Martín) Y SU LÓGICA SE BORRÓ EL 18/11/2026 (pendiente T5 de
//    docs/pendientes-verificados-17-11.md). `mensajesEnLimbo`, `queHacer`, `textoDelCartel`, `textoDeVence`, `originalParaReenviar` y
//    `chatsParaMandarle`, más `descartarDelLimboAction`, quedaron tres semanas sin una sola pantalla que los llamara: sólo los tests. Lo que
//    espera un chat cerrado hoy se lo dice el Runner al Cerebro (lib/limbo-al-cerebro.ts, cartero 1.26.0), el estado de la PC va en el Uso
//    (`estadoDeLaPc`), y el mensaje sigue en su conversación con su estado hasta que el chat se abre o vence. Si vuelve una pantalla que
//    REFIRME un mensaje de la cola, su regla está en AGENTS.md: se refirma lo que Martín firmó (`firmado`), nunca la columna `texto`.
// ⚠️ SIN `server-only`: lo usan el servidor (al vencer) y la pantalla (al dibujar las edades).

/** A los cuántos días vence un mensaje sin entregar. Lo aplica lib/operaciones.ts en cada vuelta del Runner. */
export const VENCE_PEDIDO_DIAS = 15;
export const VENCE_PEDIDO_MS = VENCE_PEDIDO_DIAS * 86_400_000;
/** El motivo con el que queda un mensaje vencido: es lo que lo distingue de los otros `no_entregado`. */
export const MOTIVO_VENCIO = 'Venció con el chat cerrado: ábrelo y vuelve a mandarlo';
/** Desde cuántos días antes de vencer el Runner se lo vuelve a decir al Cerebro (`etapa: 'vence'`, lib/limbo-al-cerebro.ts). */
export const VENCE_PRONTO_DIAS = 3;

/** «hace 6 días», «hace 3 horas», «hace 20 minutos». */
export function haceCuanto(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return d === 1 ? 'hace 1 día' : `hace ${d} días`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return m === 1 ? 'hace 1 minuto' : `hace ${m} minutos`;
}
