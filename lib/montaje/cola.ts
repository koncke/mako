// =============================================================================
// Las reglas de la cola de montaje: cuándo vence un trabajo y qué falla se reintenta
// =============================================================================
// Las usa el cron que procesa la cola (app/api/cron/montaje/route.ts) y la
// pantalla que la espera (app/video-generator/PasoMontaje.tsx). Viven acá, sin
// `server-only` y sin base, para que las dos lean LAS MISMAS y un test las fije.

/**
 * Cuántas horas puede esperar un trabajo en la fila antes de darlo de baja.
 *
 * ⚠️ POR QUÉ HACE FALTA. El 20/10/2026 la pantalla decía «Lleva 68.646 minutos
 * esperando turno»: un trabajo del 01/09 que nadie iba a tomar nunca, porque el
 * proceso que ejecuta la cola no se había desplegado. Una fila sin vencimiento
 * convierte cualquier caída del proceso en una espera eterna que se lee igual
 * que una fila larga.
 *
 * ⚠️ POR QUÉ SEIS Y NO MENOS. Con la cola sana, un trabajo espera minutos. Lo más
 * que puede tardar uno vivo es el peor caso de los reintentos: tres tomas
 * colgadas, cada una rescatada a los 20 minutos (`montaje_tomar`, mig 0151) ⇒ ~1
 * hora. Seis horas no corta nunca a uno que todavía tiene chance, y a esa altura
 * la persona ya se fue de la pantalla.
 */
export const VENCE_HORAS = 6;

/** El motivo con el que queda un trabajo vencido. Lo lee la pantalla para el texto. */
export const MOTIVO_VENCIDO = 'vencido';

/** Lo que queda escrito en el trabajo vencido. La pantalla tiene el suyo, más corto. */
export const ERROR_VENCIDO =
  `Quedó en la fila más de ${VENCE_HORAS} horas sin que nadie lo tomara y se dio de baja. ` +
  'Fue un problema nuestro: al montarlo de nuevo arranca en el momento.';

/** Desde cuándo un `pendiente` ya está vencido. */
export function corteDeVencimiento(ahora: number = Date.now()): string {
  return new Date(ahora - VENCE_HORAS * 3_600_000).toISOString();
}

export type MotivoFalla = 'material' | 'verificacion' | 'transitorio' | 'interno';

/**
 * Qué clase de falla es. Es lo que decide si se reintenta (mig 0151: el motivo
 * es una clasificación, no texto libre).
 *
 *   · `material`     un clip mudo, corrupto o que ya no existe. Reintentar da lo mismo.
 *   · `verificacion` el montaje salió pero perdió texto: no se entrega.
 *   · `transitorio`  la red, la transcripción o el storage no contestaron.
 *   · `interno`      un bug nuestro.
 */
export function clasificar(e: unknown): MotivoFalla {
  const x = (e ?? {}) as { message?: unknown; stderr?: unknown };
  const t = `${String(x.message ?? '')} ${String(x.stderr ?? '')}`;
  if (/Invalid data found|moov atom not found|llegó vacío|does not contain any stream|no se pudo bajar \((404|403|410)\)/i.test(t)) return 'material';
  if (/VERIFICACION|palabras perdidas|texto no coincide/i.test(t)) return 'verificacion';
  // `GROQ 429` es el tope por minuto de la transcripción: en el ciclo siguiente pasa.
  if (/timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|GROQ 429|\b5\d\d\b/i.test(t)) return 'transitorio';
  return 'interno';
}

/**
 * ¿Se da por perdido ya, o vuelve a la fila?
 *
 * ⚠️ `interno` VUELVE, y no es un descuido: el tope lo pone `montaje_tomar`, que
 * suma un intento cada vez que lo toma y lo marca fallido al tercero. Un bug
 * nuestro cuesta tres montajes y no infinitos; y un bug que depende del estado
 * (un /tmp lleno en una instancia) sale bien en otra.
 */
export function esDefinitiva(motivo: string): boolean {
  return motivo === 'material' || motivo === 'verificacion';
}

/** Cuánto lleva esperando, dicho como lo diría una persona. */
export function textoEspera(minutos: number): string {
  if (minutos < 60) return `Lleva ${minutos} minutos esperando turno. Escríbenos si sigue así.`;
  const h = Math.floor(minutos / 60);
  return `Lleva ${h === 1 ? 'una hora' : `${h} horas`} esperando turno. Escríbenos si sigue así.`;
}
