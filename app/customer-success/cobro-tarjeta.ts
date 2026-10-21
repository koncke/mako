// =============================================================================
// cobro-tarjeta — el cobro de cada cliente, para su tarjeta, en UNA lectura (20/10/2026)
// =============================================================================
// «Pago fallido» del prototipo (docs/pedidos-crm.md B2). Antes no llegaba al tablero porque el cobro se leía de a un
// cliente; acá van dos consultas para TODA la cartera, a la vez (los cobros de la pasarela y las cuotas vencidas sin
// pagar), y decide la regla pura (`cobroDelCliente`, ./aviso-tarjeta.ts). Lo usan la computadora (./pantalla.tsx) y
// el teléfono (app/m/cs/page.tsx).
// ⚠️ NUNCA TIRA: si algo no se puede leer devuelve null y la tarjeta no avisa nada. Un «Pago rechazado» inventado
// por una lectura caída es peor que no avisar.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { tzActual } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { cobroDelCliente, type CobroTarjeta } from './aviso-tarjeta';

type FilaCobro = { lead_id: number | null; estado: string | null; created_at: string | null; pagado_at: string | null };
type FilaCuota = { lead_id: number | null; fecha_esperada: string | null };

export async function cobrosDeLaCartera(leadIds: readonly number[]): Promise<Record<number, CobroTarjeta> | null> {
  const ids = [...new Set(leadIds)];
  if (!ids.length) return {};
  try {
    const db = await getTenantDb();
    // «Hoy» en la zona del negocio: una cuota que vence hoy todavía no está vencida.
    const hoy = hoyEnTz(await tzActual());
    const [cobros, cuotas] = await Promise.all([
      db.from('cobros').select('lead_id, estado, created_at, pagado_at').in('lead_id', ids).in('estado', ['fallido', 'pagado']).limit(10000),
      db.from('pagos').select('lead_id, fecha_esperada').in('lead_id', ids).eq('pagado', false).lt('fecha_esperada', hoy).limit(10000),
    ]);
    if (cobros.error) throw new Error(`cobros: ${cobros.error.message}`);
    if (cuotas.error) throw new Error(`cuotas: ${cuotas.error.message}`);
    const cobrosDe = new Map<number, FilaCobro[]>();
    for (const f of (cobros.data ?? []) as FilaCobro[]) if (f.lead_id != null) cobrosDe.set(Number(f.lead_id), [...(cobrosDe.get(Number(f.lead_id)) ?? []), f]);
    const cuotasDe = new Map<number, FilaCuota[]>();
    for (const f of (cuotas.data ?? []) as FilaCuota[]) if (f.lead_id != null) cuotasDe.set(Number(f.lead_id), [...(cuotasDe.get(Number(f.lead_id)) ?? []), f]);
    const out: Record<number, CobroTarjeta> = {};
    for (const id of ids) out[id] = cobroDelCliente(cobrosDe.get(id) ?? [], cuotasDe.get(id) ?? [], hoy);
    return out;
  } catch (e) {
    console.warn('[cs] no pude leer los cobros de la cartera:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
