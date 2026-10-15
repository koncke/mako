// =============================================================================
// contrasena-restablecer — el link de «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// Circuito 3 de docs/diseno-login-contrasena.md: el correo → un link de UN solo uso que vence a los 30
// minutos → la contraseña nueva, y ADEMÁS el segundo factor si la cuenta lo tiene (decisión 2, opción A:
// construida así mientras Martín no conteste, porque es la segura; con el link solo, quien roba el correo
// cambia la contraseña con un clic).
//
// ⚠️ EL TOKEN VIAJA EN EL FRAGMENTO del link (`#t=…`), nunca en la query: así no queda en ningún log de
// servidor ni sale en el Referer. La página lo lee en el navegador y lo manda por POST. En la base vive
// sólo su HMAC, con un prefijo propio (`restablecer:`) para que no se confunda con un código del 2FA.
// =============================================================================

import 'server-only';
import crypto from 'node:crypto';
import { getSupabaseServer } from './supabase';
import { APP_BASE_URL } from './app-url';

const sb = () => getSupabaseServer();
export const VENCE_MINUTOS = 30;
/** Pedidos por cuenta en la ventana: más que esto es abuso (o un bucle), y el mail lo paga la plataforma. */
export const MAX_PEDIDOS = 3;
export const VENTANA_PEDIDOS_MIN = 15;
/** Intentos de segundo factor sobre UN link: después se cierra y hay que pedir otro. */
export const MAX_INTENTOS_LINK = 5;

function hmacToken(token: string): string {
  const s = process.env.AUTH_SECRET;
  if (!s || !s.trim()) throw new Error('restablecer: falta AUTH_SECRET');
  return crypto.createHmac('sha256', s).update(`restablecer:${token}`).digest('hex');
}

/** El link que va en el mail. El token, en el fragmento. */
export function linkDeRestablecer(token: string): string {
  return `${APP_BASE_URL}/login/restablecer#t=${token}`;
}

/**
 * Crea un link para esta persona, si no pidió demasiados. Cierra el anterior. null = frenado o no se
 * pudo (quien llama contesta lo mismo de siempre: no cuenta qué correos existen).
 */
export async function crearLinkDeRestablecer(usuarioId: number): Promise<{ link: string } | { frenado: true } | null> {
  const desde = new Date(Date.now() - VENTANA_PEDIDOS_MIN * 60_000).toISOString();
  const { count, error } = await sb().from('contrasena_restablecer')
    .select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId).gte('created_at', desde);
  if (error) return null;
  if ((count ?? 0) >= MAX_PEDIDOS) return { frenado: true };
  const ahora = new Date().toISOString();
  // Uno vivo por persona: un link viejo que quedó en otro mail deja de servir.
  await sb().from('contrasena_restablecer').update({ usado_at: ahora }).eq('usuario_id', usuarioId).is('usado_at', null);
  const token = crypto.randomBytes(32).toString('base64url');
  const { error: e2 } = await sb().from('contrasena_restablecer').insert({
    usuario_id: usuarioId, token_hash: hmacToken(token),
    expira_at: new Date(Date.now() + VENCE_MINUTOS * 60_000).toISOString(),
  });
  if (e2) return null;
  return { link: linkDeRestablecer(token) };
}

export type LinkVivo = { id: number; usuarioId: number; intentos: number };

/** El link, si sigue vivo: no usado, no vencido y con intentos. null = venció, se usó o no existe. */
export async function leerLinkDeRestablecer(token: unknown): Promise<LinkVivo | null> {
  if (typeof token !== 'string' || token.length < 30 || token.length > 100) return null;
  const { data, error } = await sb().from('contrasena_restablecer')
    .select('id, usuario_id, intentos, expira_at, usado_at').eq('token_hash', hmacToken(token)).maybeSingle();
  if (error || !data) return null;
  const f = data as { id: number; usuario_id: number; intentos: number; expira_at: string; usado_at: string | null };
  if (f.usado_at || Date.parse(f.expira_at) <= Date.now() || f.intentos >= MAX_INTENTOS_LINK) return null;
  return { id: f.id, usuarioId: f.usuario_id, intentos: f.intentos };
}

/** Un intento fallido del segundo factor sobre este link. Al llegar al tope, el link muere. */
export async function sumarIntentoAlLink(l: LinkVivo): Promise<void> {
  await sb().from('contrasena_restablecer').update({ intentos: l.intentos + 1 }).eq('id', l.id).eq('intentos', l.intentos)
    .then(() => {}, () => {});
}

/** Lo GASTA, con compare-and-set: dos pestañas con el mismo link no cambian la contraseña dos veces. */
export async function gastarLink(l: LinkVivo): Promise<boolean> {
  const { data, error } = await sb().from('contrasena_restablecer').update({ usado_at: new Date().toISOString() })
    .eq('id', l.id).is('usado_at', null).select('id');
  return !error && (data ?? []).length === 1;
}
