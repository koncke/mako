// =============================================================================
// curso-papelera-reglas — cuánto vive lo borrado del curso antes de la purga (puro)
// =============================================================================
// Las clases y los módulos que se borran desde el editor van a la PAPELERA (mig 0223): quedan con su
// marca (`borrada_at` / `borrado_at`), invisibles para todo lo demás, para que el «Deshacer» de 5
// segundos los devuelva con la MISMA identidad. Lo que lleva más de `DIAS_PAPELERA` días ahí se borra
// de verdad (lib/curso-papelera.ts, desde el cron diario /api/cron/curso-purga).
//
// ⚠️ POR QUÉ UNA SEMANA Y NO LOS 5 SEGUNDOS DEL TOAST: el «Deshacer» es la salida de quien se equivoca
// en el acto; la semana es la de quien se da cuenta al otro día (y de soporte). Más tiempo es más
// disco: el video de una clase borrada sigue en el bucket mientras su fila exista (la purga de los
// buckets no toca un archivo que una fila nombra), y el Storage es uno para toda la plataforma.
//
// Sin 'server-only', a propósito: lo ejecuta tests/curso-papelera.test.ts.

/** Cuántos días vive algo en la papelera del curso antes de borrarse de verdad. */
export const DIAS_PAPELERA = 7;

/** El instante de corte: lo borrado ANTES de esto se purga. ISO, para compararlo en la base. */
export function corteDePapelera(ahoraMs: number, dias: number = DIAS_PAPELERA): string {
  return new Date(ahoraMs - dias * 86_400_000).toISOString();
}

/**
 * ¿Esto ya se puede purgar? Sólo lo que TIENE marca y la tiene desde antes del corte. Sin marca (vivo) o
 * con una marca que no se entiende, NO: ante la duda no se borra nada. (Una marca del futuro, un reloj
 * corrido, tampoco: queda después del corte por construcción, sin una línea aparte que la mire.)
 */
export function vencidoEnPapelera(borradoAt: string | null | undefined, ahoraMs: number, dias: number = DIAS_PAPELERA): boolean {
  if (!borradoAt) return false;
  const t = Date.parse(borradoAt);
  if (!Number.isFinite(t)) return false;
  return t < ahoraMs - dias * 86_400_000;
}
