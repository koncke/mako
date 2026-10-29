// =============================================================================
// topes-plan-server — ¿a este negocio se le aplican los topes de su plan? (29/10/2026)
// =============================================================================
// Los topes (lib/topes-plan.ts) corren SÓLO para quien MaKo le cobra el plan: nunca al ws1 ni a un acuerdo a mano. Hasta este
// día la pregunta era `suscripcionDeMakoDe(ws) != null` (el plan que se vendió en /planes, atado por `alta_ws`), y dejaba
// afuera a las cuentas de los clientes de una AGENCIA (cobradas por `cliente_ws`): todas usaban todo lo de Pro (llamada con
// Thiago, 10:24: «son los mismos planes, de 47 y 97»). Ahora la pregunta es una sola, y la hacen todos los topes.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { suscripcionDeMakoDe } from './cobros';

/** true = se le aplican los topes de su plan: MaKo le cobra el plan por la pasarela, o es la cuenta de un cliente de agencia. */
export async function aplicanTopes(ws: number): Promise<boolean> {
  if ((await suscripcionDeMakoDe(ws)) != null) return true;
  const { data, error } = await getSupabaseServer().from('agencia_clientes').select('estado').eq('cliente_ws', ws).neq('estado', 'revocado').limit(1);
  if (error) throw new Error(`No pude leer si es cliente de una agencia: ${error.message}`);
  return (data ?? []).length > 0;
}
