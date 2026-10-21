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
import { leerTodo, type ConsultaPaginada } from '@/lib/supabase-paginado';
import { tzActual } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { cobroDelCliente, type CobroTarjeta, type CobroParaTarjeta } from './aviso-tarjeta';

type FilaCobro = CobroParaTarjeta & { lead_id: number | null };
/** Un `.in()` viaja en la URL: de a tandas, como `ultimoContactoDeClientes` (lib/cs-cartera.ts). */
const TANDA = 150;
type FilaCuota = { lead_id: number | null; fecha_esperada: string | null };

export async function cobrosDeLaCartera(leadIds: readonly number[]): Promise<Record<number, CobroTarjeta> | null> {
  const ids = [...new Set(leadIds)];
  if (!ids.length) return {};
  try {
    const db = await getTenantDb();
    // «Hoy» en la zona del negocio: una cuota que vence hoy todavía no está vencida.
    const hoy = hoyEnTz(await tzActual());
    // ⚠️ DE A TANDAS Y PAGINADO (revisión del 21/10/2026): con cientos de clientes el `.in()` pasaba el tope de la URL
    // (las dos lecturas fallaban y ninguna tarjeta avisaba), y PostgREST corta en 1.000 filas sin avisar (`.limit` no
    // levanta ese techo): un fallido viejo adentro y su pago posterior afuera era un «Pago rechazado» falso.
    const tandas: number[][] = [];
    for (let i = 0; i < ids.length; i += TANDA) tandas.push(ids.slice(i, i + TANDA));
    const [cobros, cuotas, rechazosLeidos] = await Promise.all([
      Promise.all(tandas.map((t) => leerTodo<FilaCobro>(db, 'cobros', 'id, lead_id, estado, created_at, updated_at, pagado_at, tipo, suscripcion_estado, motivo', {
        orden: 'id', filtros: (q) => q.in('lead_id', t).in('estado', ['fallido', 'pagado']) as unknown as ConsultaPaginada,
      }))).then((x) => x.flat()),
      Promise.all(tandas.map((t) => leerTodo<FilaCuota>(db, 'pagos', 'id, lead_id, fecha_esperada', {
        orden: 'id', filtros: (q) => q.in('lead_id', t).eq('pagado', false).lt('fecha_esperada', hoy) as unknown as ConsultaPaginada,
      }))).then((x) => x.flat()),
      // CUÁNDO SE RECHAZÓ: el evento que escribe sólo el rechazo (`aplicarPagoFallido`). La renovación tiene su regla aparte.
      Promise.all(tandas.map((t) => leerTodo<{ lead_id: number | null; valor_nuevo: string | null; created_at: string }>(db, 'lead_audit', 'id, lead_id, valor_nuevo, created_at', {
        orden: 'id', filtros: (q) => q.in('lead_id', t).eq('campo', 'Pago rechazado') as unknown as ConsultaPaginada,
      }))).then((x) => x.flat()),
    ]);
    const rechazosDe = new Map<number, string[]>();
    for (const f of rechazosLeidos) {
      if (f.lead_id == null || /^Renovación de /.test(f.valor_nuevo ?? '')) continue;
      rechazosDe.set(Number(f.lead_id), [...(rechazosDe.get(Number(f.lead_id)) ?? []), f.created_at]);
    }
    const cobrosDe = new Map<number, FilaCobro[]>();
    for (const f of cobros) if (f.lead_id != null) cobrosDe.set(Number(f.lead_id), [...(cobrosDe.get(Number(f.lead_id)) ?? []), f]);
    const cuotasDe = new Map<number, FilaCuota[]>();
    for (const f of cuotas) if (f.lead_id != null) cuotasDe.set(Number(f.lead_id), [...(cuotasDe.get(Number(f.lead_id)) ?? []), f]);
    const out: Record<number, CobroTarjeta> = {};
    for (const id of ids) out[id] = cobroDelCliente(cobrosDe.get(id) ?? [], cuotasDe.get(id) ?? [], hoy, rechazosDe.get(id));
    return out;
  } catch (e) {
    console.warn('[cs] no pude leer los cobros de la cartera:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
