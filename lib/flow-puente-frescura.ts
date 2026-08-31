// =============================================================================
// ¿El navegador del cliente está vivo AHORA?
// =============================================================================
// Una sola pregunta, un solo lugar. La contestan tres consumidores que no pueden
// contestarla distinto: el aviso de la tab, el gate que decide si se puede
// empezar un anuncio, y el guard que impide que conectar un navegador nuevo
// desconecte al que está trabajando.
//
// ⚠️ SIN `server-only`, a propósito: la importan un componente cliente y una
// server action. Con el guard puesto, el cliente no podría y la regla terminaría
// duplicada — que es exactamente cómo se paga después.
//
// El plazo existe porque `!!ultimoVisto` medía «alguna vez llamó»: el dueño
// desinstaló la extensión y los pasos siguieron en verde con una última señal de
// 35 horas antes. Un campo con fecha usado como booleano deja de medir el
// presente y pasa a medir el pasado.

/** Cuánto puede pasar sin señal antes de dar el navegador por caído. */
export const VIVO_MS = 2 * 60 * 1000;

/**
 * `ahora` puede ser `null`: es el primer render, cuando el reloj del navegador
 * todavía no arrancó. Ahí se conserva lo que el server trajo — parpadear a
 * «desconectado» durante un instante es peor que esperar 100 ms, y además un
 * `Date.now()` en el render sería un mismatch de hidratación garantizado.
 */
export function estaVivo(ultimoVisto: string | null | undefined, ahora: number | null): boolean {
  if (!ultimoVisto) return false;
  if (ahora == null) return true;
  return ahora - new Date(ultimoVisto).getTime() < VIVO_MS;
}
