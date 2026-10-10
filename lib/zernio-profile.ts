// =============================================================================
// zernio-profile — con qué profile de Zernio habla un negocio que tiene cuenta PROPIA
// =============================================================================
// Puro y sin `server-only` a propósito: lo llama `profileIdEfectivo` (lib/zernio.ts, que no se puede
// importar desde un test) y el test lo ejecuta.
//
// ⚠️ EL PROFILE GUARDADO PUEDE SER DE OTRA CUENTA (medido en producción el 10/10/2026). ws11 tiene en
// `zernio_workspace.profile_id` el `mako_ws_11` (6a8059dc…): lo acuñó la rama SIN key propia de
// `ensureProfile` el 15/08, en la cuenta de la AGENCIA, y la key propia del negocio llegó el 28/08.
// Desde entonces se le pedían a la cuenta del negocio las cuentas conectadas y el OAuth de un profile
// que no es suyo: la tarjeta decía «Conectar», conectar fallaba, y el webhook nunca se registraba
// (sólo se registra con alguna cuenta conectada). Un profile guardado vale sólo si está en la lista
// que devuelve la cuenta de ESA key.

export type ProfileDeZernio = { _id: string; isDefault?: boolean };

/**
 * El profile con el que se habla y si hay que SOLTAR el guardado (porque no es de esta cuenta).
 * El guardado gana si está en la lista; si no, el Default de la cuenta (o el primero); sin profiles,
 * ninguno.
 */
export function profileDeLaCuenta(
  guardado: string | null,
  lista: readonly ProfileDeZernio[],
): { profileId: string | null; soltarGuardado: boolean } {
  const propio = guardado ? lista.find((p) => p._id === guardado) : undefined;
  const elegido = propio ?? lista.find((p) => p.isDefault) ?? lista[0];
  return { profileId: elegido?._id ?? null, soltarGuardado: guardado != null && !propio };
}
