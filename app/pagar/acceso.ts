// =============================================================================
// acceso — lo que leen de la base las rutas públicas del comprador (/pagar/<token>)
// =============================================================================
// Las comparten la página de retorno (app/pagar/[token]/listo/page.tsx) y el cambio de email
// (app/api/pagar/email/route.ts). Las dos son PÚBLICAS: no hay sesión ni workspace en el request,
// así que todo va con el cliente de servicio y el id EXPLÍCITO que trae el cobro (nunca
// getTenantDb, que sin contexto cae al ws1 —Mauricio, un cliente—). Ninguna lee cookies.

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { getWorkspace } from '@/lib/workspace';
import type { Cobro } from '@/lib/cobros-tipos';
import type { UsuarioDelAlta } from './cambio-email';

/** El nombre del negocio que cobra, para que el comprador sepa a quién le pagó. Sólo dibuja: si falla, null. */
export async function nombreDelNegocio(ws: number): Promise<string | null> {
  try {
    return (await getWorkspace(ws))?.nombre?.trim() || null;
  } catch (e) {
    console.error(`[pagar] no pude leer el nombre del workspace ${ws}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * El admin que creó el alta automática de este cobro: la fila de `usuarios` del workspace nuevo con
 * `invitado_por = 'pago:<pasarela>'` (lo escribe `altaSiCorresponde`, lib/cobros.ts). Se busca por
 * el WORKSPACE y no por el email del cobro: después del primer cambio, el email del pago y el del
 * acceso ya no son el mismo.
 *
 * ⚠️ ESTRICTA: si la base no contesta, TIRA. Con esto se decide si se puede cambiar un email, y «no
 * pude leer» no es «no existe» (AGENTS.md «No pude leer es un tercer estado»). Con dos filas que
 * cumplen, null: no se elige a cuál cambiarle el email.
 */
export async function usuarioDelAlta(c: Pick<Cobro, 'alta_ws' | 'proveedor'>): Promise<UsuarioDelAlta | null> {
  if (c.alta_ws == null) return null;
  const { data, error } = await getSupabaseServer()
    .from('usuarios').select('id, email, ultimo_login')
    .eq('workspace_id', c.alta_ws).eq('rol_ws', 'admin').eq('invitado_por', `pago:${c.proveedor}`)
    .order('id', { ascending: true }).limit(2);
  if (error) throw new Error(`No pude leer la cuenta del alta: ${error.message}`);
  const filas = (data ?? []) as Array<{ id: number; email: string; ultimo_login: string | null }>;
  if (filas.length !== 1) return null;
  return { id: Number(filas[0].id), email: String(filas[0].email), ultimo_login: filas[0].ultimo_login ?? null };
}
