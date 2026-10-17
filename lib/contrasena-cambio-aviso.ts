// =============================================================================
// contrasena-cambio-aviso — EL EMISOR de «tu contraseña cambió» (17/10/2026)
// =============================================================================
// Los circuitos 1, 3 y 4 de docs/diseno-login-contrasena.md (crear, restablecer y cambiar la contraseña) prometían un
// aviso por correo y no existía: si alguien le cambiaba la contraseña a otro —con una sesión robada o con el link de
// restablecer de un correo tomado—, el dueño de la cuenta no se enteraba.
//
// El mismo contrato que `avisarPedidoDeRestablecer` (lib/restablecer-aviso.ts): el mail lo manda la automatización de
// SuperAdmin «Tu Contraseña Cambió» (todo por Automations, nada por detrás), emitida en el ws de la PLATAFORMA, con
// `usuario_id` para el destino (el correo de la CUENTA, propósito `aviso` de lib/destino-usuario.ts). Sin dedup: cada
// cambio es un hecho. Sin datos secretos.
//
// Nunca tira: lo llaman las rutas DESPUÉS de guardar, adentro de un `after()`. El resultado va al registro de la
// persona (`mfa_eventos`) con su motivo, como el del pedido.
// =============================================================================

import 'server-only';
import { emitirDelCatalogo } from './avisos';
import { wsSuperAdmin } from './workspace';
import { registrarEvento } from './mfa';

export type AvisoDeCambio = 'corrio' | 'apagado' | 'ilegible';

export async function avisarContrasenaCambiada(usuarioId: number): Promise<AvisoDeCambio> {
  let res: AvisoDeCambio = 'ilegible';
  try {
    if (Number.isInteger(usuarioId) && usuarioId > 0) {
      const r = await emitirDelCatalogo('seguridad-contrasena-cambiada', {
        ws: await wsSuperAdmin(),
        datos: { usuario_id: String(usuarioId) },
      });
      res = !r.ok ? 'ilegible' : (r as { apagado?: boolean }).apagado ? 'apagado' : 'corrio';
    }
  } catch { res = 'ilegible'; }
  await registrarEvento(usuarioId, 'contrasena-cambio-aviso', res === 'corrio', res).catch(() => undefined);
  return res;
}
