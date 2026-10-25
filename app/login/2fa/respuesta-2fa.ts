// =============================================================================
// Qué pinta el segundo paso ante una respuesta que no es «ok» (25/10/2026)
// =============================================================================
// Martín (25/10 ~12:55): «me logee con SuperAdmin y me dijo "No coincide" el codigo de la app de verificacion y luego me dejo
// entrar igual». No era un bypass (mfa_eventos: un solo intento, y bueno): un SEGUNDO envío salía mientras la página ya se
// iba, sin el paso intermedio (lo cierra `ponerSesion`), y el 401 «vencido» se pintaba con el comodín «No coincide.». El
// porqué entero: docs/hallazgos-seguridad.md → «El 2FA del login».
//   · el servidor ya dice qué pasó con un código malo («Ese código no coincide.»): acá no se inventa ningún «No coincide»;
//   · el paso intermedio vencido (401) no pinta nada: la pantalla ya se está yendo al login (`vencido`);
//   · sin texto del servidor, lo genérico: «No se pudo. Vuelve a probar.».

export type Respuesta = { ok: boolean; error?: string; vencido?: boolean; next?: string; codigos?: string[]; destino?: string; [k: string]: unknown };

export const SIN_TEXTO = 'No se pudo. Vuelve a probar.';

/** El texto a pintar, o null si no hay nada que decir (salió bien, o el paso venció y ya se está yendo). */
export function textoDelFallo(j: Pick<Respuesta, 'ok' | 'error' | 'vencido'>): string | null {
  if (j.ok || j.vencido) return null;
  return j.error?.trim() || SIN_TEXTO;
}
