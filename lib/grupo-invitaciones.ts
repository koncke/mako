// =============================================================================
// grupo-invitaciones — la invitación al grupo de la app que esperaba una cuenta (4/11/2026)
// =============================================================================
// Al ENTRAR con un email (`registrarLogin`, lib/usuarios.ts), las filas de `grupo_invitados` anotadas a ese email sin cuenta pasan a esta persona. Es al
// entrar y no al crear la cuenta porque recién ahí consta que el email es suyo (el link del mail, Google o su contraseña). Lo demás del grupo, en
// lib/grupo-app.ts (`invitarAlGrupo`).
//
// ⚠️ SÓLO IMPORTA LA BASE, a propósito: lib/usuarios.ts lo llaman las rutas del login y de la sesión, y lib/grupo-app.ts llega a una IA por el grafo de
// imports (tests/d6b-rutas.test.ts: «auth/me no le pide nada a una IA»).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cuántas invitaciones se ataron. Nunca tira; sin la tabla (0372), nada. `desde_id` no se toca: ve desde que la invitaron. */
export async function atarInvitacionesAlEntrar(usuarioId: number, emailCrudo: string): Promise<number> {
  const email = String(emailCrudo ?? '').trim().toLowerCase();
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0 || !EMAIL_RE.test(email)) return 0;
  try {
    const { data, error } = await getSupabaseServer().from('grupo_invitados').update({ usuario_id: usuarioId })
      .eq('email', email).is('usuario_id', null).is('salio_at', null).select('workspace_id');
    if (error) {
      if (error.code !== '42P01' && error.code !== 'PGRST205') console.error(`[grupo-invitaciones] no pude atar las invitaciones de ${email}: ${error.message}`);
      return 0;
    }
    return (data ?? []).length;
  } catch (e) {
    console.error(`[grupo-invitaciones] no pude atar las invitaciones de ${email}: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}
