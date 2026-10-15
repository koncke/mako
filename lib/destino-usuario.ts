// =============================================================================
// destino-usuario — ADÓNDE se le escribe a una persona de `usuarios` (15/10/2026)
// =============================================================================
// La usa la tarjeta «Email a la persona del evento» de Automations (SuperAdmin): el evento trae
// `usuario_id` y declara su PROPÓSITO en su fila de `EVENTOS_MAKO`; la dirección sale SIEMPRE de
// acá, nunca de un dato del evento. Acordado con el chat de Automations el 15/10/2026.
//
// Los tres propósitos van a correos DISTINTOS a propósito:
//   · 'restablecer' (el link de «Olvidé mi contraseña») → el correo de la CUENTA (`usuarios.email`):
//     es el único que la persona sabe que es suyo. El link solo no alcanza para cambiarla (pide
//     además el segundo factor si la cuenta lo tiene: docs/diseno-login-contrasena.md).
//   · 'aviso' («¿No has sido tú?», «se cambió tu contraseña») → también `usuarios.email`.
//   · 'codigo' (el 2FA por correo, tanda 2) → SÓLO el correo de RESPALDO verificado y activo
//     (`usuario_mfa.email_respaldo`), que por regla es distinto del de Google: un código al mismo
//     correo con el que se entra no es un segundo factor.
//
// null = esa persona no tiene destino para ese propósito (no sale nada). TIRA = no se pudo leer:
// quien llama lo dice distinto, porque «no tiene» y «no sé» son dos cosas.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type PropositoDestino = 'restablecer' | 'aviso' | 'codigo';

export async function destinoDeUsuario(usuarioId: number, canal: 'email', proposito: PropositoDestino): Promise<string | null> {
  if (canal !== 'email') return null;
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;
  const sb = getSupabaseServer();
  if (proposito === 'codigo') {
    const { data, error } = await sb.from('usuario_mfa').select('email_respaldo, email_activo').eq('usuario_id', usuarioId).maybeSingle();
    if (error) throw new Error(`destinoDeUsuario: ${error.message}`);
    const f = data as { email_respaldo: string | null; email_activo: boolean } | null;
    return f?.email_activo && f.email_respaldo ? f.email_respaldo : null;
  }
  const { data, error } = await sb.from('usuarios').select('email, estado').eq('id', usuarioId).maybeSingle();
  if (error) throw new Error(`destinoDeUsuario: ${error.message}`);
  const u = data as { email: string | null; estado: string | null } | null;
  // A una cuenta suspendida no se le manda un link para entrar; un aviso, sí (es su correo).
  if (!u?.email || (proposito === 'restablecer' && u.estado === 'suspendido')) return null;
  return u.email;
}
