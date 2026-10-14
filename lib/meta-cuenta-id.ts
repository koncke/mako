// =============================================================================
// meta-cuenta-id — la FORMA de META_AD_ACCOUNT_ID. Sin `server-only`, a propósito.
// =============================================================================
// Meta nombra la misma cuenta publicitaria de DOS maneras y las devuelve juntas,
// en la misma respuesta de `/me/adaccounts`:
//
//     { "id": "act_1357728489423123", "account_id": "1357728489423123" }
//
// Todo este repo consume la primera: `GET /{version}/{META_AD_ACCOUNT_ID}` arma
// la URL pegando el valor tal cual (lib/meta-health.ts, lib/meta-ads.ts,
// lib/meta-ads-create.ts — «ya viene como act_<id>»). El panel de Business
// Manager, en cambio, le muestra al cliente la SEGUNDA, que es la que tiene a
// mano para copiar. Las dos son ciertas y solo una funciona.
//
// EL CASO (2026-08-21). Un cliente pegó a mano el id pelado. La verificación dio
// VERDE —el ping de `lib/metodo-verificar.ts` normaliza antes de pegarle a la
// API— y lo que se GUARDÓ fue el crudo. De ahí en adelante
// `GET /v24.0/1357728489423123` contesta 400 «Object with ID does not exist»…
// con la cuenta perfectamente ACTIVA del otro lado.
//
// Es, textual, lo que ya advertía el comentario pegado a ese mismo guardado (en
// app/api/integraciones/credencial/route.ts, escrito sobre el id de Clarity):
// «verificar una cosa y guardar otra es cómo se llega a una credencial que pasó
// la prueba y no funciona». La regla estaba escrita; le faltaba este campo.
//
// Vive en su propio módulo y sin `server-only` por la regla de la casa: la misma
// normalización la necesitan el GUARDADO (un route handler), la VERIFICACIÓN, el
// DESCUBRIMIENTO y un test — y un módulo con `server-only` no lo puede importar
// ningún test, que es justo donde esto se quedaría sin red.
// =============================================================================

/**
 * `1357728489423123` → `act_1357728489423123`. Idempotente.
 *
 * ⚠️ Toca SOLO lo que es inequívocamente un id de cuenta —dígitos pelados—. Todo
 * lo demás vuelve intacto, a propósito: una credencial rara tiene que fallar A LA
 * VISTA en la verificación, no desaparecer en silencio adentro del normalizador.
 * Un saneo que se traga lo que no entiende es un `console.warn` con otra cara.
 */
export function normalizarCuentaMeta(crudo: string | null | undefined): string {
  const v = (crudo ?? '').trim();
  return /^\d+$/.test(v) ? `act_${v}` : v;
}

/**
 * ¿El objeto de Meta (campaña, conjunto o anuncio) es de la cuenta publicitaria de
 * ESTE workspace? Meta devuelve el `account_id` de un objeto PELADO (`1357…`) y la
 * credencial se guarda como `act_1357…`: se comparan normalizados.
 *
 * EL CASO (13/10/2026, del relevo del Ads Manager). Leer o editar el público de un
 * conjunto, los textos de un anuncio o pausar/borrar algo se hacía con el id que
 * mandaba el navegador —o el modelo, por la API de MaKo— y el token del workspace.
 * Con un token que llega a VARIAS cuentas (una agencia, un usuario de sistema con
 * cuentas de varios clientes), un id equivocado leía o pisaba el de otra cuenta, y
 * Meta lo hacía sin error: el token tenía permiso.
 *
 * Fail-closed: un lado vacío o con otra forma da `false`. Sin saber de quién es,
 * no se lee ni se escribe.
 */
export function esDeLaCuenta(accountIdDelObjeto: unknown, cuentaDelWs: string | null | undefined): boolean {
  const crudo = typeof accountIdDelObjeto === 'string' || typeof accountIdDelObjeto === 'number' ? String(accountIdDelObjeto) : '';
  const obj = normalizarCuentaMeta(crudo);
  return /^act_\d+$/.test(obj) && obj === normalizarCuentaMeta(cuentaDelWs);
}
