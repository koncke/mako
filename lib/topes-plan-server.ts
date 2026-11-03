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
import { rigeElPlanDeAgenciaEn, soltadaPorSuAgencia } from './plan-esencial';
import { WS_SIN_PLAN_DE_PASARELA } from './plan-esencial-reglas';

/** true = se le aplican los topes de su plan: MaKo le cobra el plan por la pasarela, es la cuenta de un cliente de agencia, o
 *  una que su agencia soltó (`sin-agencia`). */
export async function aplicanTopes(ws: number): Promise<boolean> {
  // El ws1 (el acuerdo de Mauricio) nunca, esté donde esté (verificación independiente, H6): los topes del CRM y del equipo no
  // tenían guarda propia, y una fila suya en una cartera alcanzaba para toparlo.
  if (WS_SIN_PLAN_DE_PASARELA.has(ws)) return false;
  if ((await suscripcionDeMakoDe(ws)) != null) return true;
  const { data, error } = await getSupabaseServer().from('agencia_clientes').select('estado').eq('cliente_ws', ws).neq('estado', 'revocado').limit(1);
  if (error) throw new Error(`No pude leer si es cliente de una agencia: ${error.message}`);
  // La que su agencia soltó y todavía usa lo que pagó (la pausa programada): sus topes siguen (tercera pasada de la revisión).
  if (!(data ?? []).length && !(await soltadaPorSuAgencia(ws))) return false;
  // Las de antes, sin el plan elegido, siguen sin topes, como Pro (H1 de la verificación independiente).
  return rigeElPlanDeAgenciaEn(ws);
}
