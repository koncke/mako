'use server';

// =============================================================================
// ficha/pagos/cuotas-actions — qué protege a cada cuota impaga (un link sin pagar, un recordatorio corriendo)
// =============================================================================
// El server no deja cambiar el monto de una cuota con un link vivo, ni editar una con un recordatorio de cobro en
// curso (lib/pagos.ts, `editarCuota`): dice «córtalo para editarla». Hasta el 16/10/2026 la tab no tenía dónde
// cortarlo, y el error era un callejón sin salida. Con esta lectura el renglón lo dice ANTES («Link enviado»,
// «Recordatorio en curso»), no ofrece editar lo que no se puede, y ofrece «Cortar el recordatorio»
// (`cortarRecordatoriosCuotaAction`, app/crm/[id]/pagos-campo-actions.ts).
//
// ⚠️ Sin sesión, nada (sin cookie el workspace cae al ws1, un cliente), y el lead tiene que ser de este negocio.
// ⚠️ 'use server': sólo funciones async (y tipos).
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { asegurarLeadDelNegocio, getPagosByLead, proteccionesDeCuotas } from '@/lib/pagos';
import { esCuotaDevuelta } from '@/lib/cobrado-lead';
import type { Proteccion } from '@/lib/pagos-campo';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

/** Por cuota impaga, lo que la protege. Una que no aparece no tiene nada. Nunca tira: sin leer, `{}`. */
export async function proteccionesDeCuotasAction(leadId: number): Promise<Record<number, Proteccion[]>> {
  try {
    if (!(await haySesion())) return {};
    if (!Number.isInteger(leadId) || leadId <= 0) return {};
    await asegurarLeadDelNegocio(leadId);
    const impagas = (await getPagosByLead(leadId)).filter((q) => !q.pagado && !esCuotaDevuelta(q)).map((q) => q.id);
    return Object.fromEntries(await proteccionesDeCuotas(leadId, impagas));
  } catch (e) {
    console.error(`[pagos] protecciones de las cuotas del lead ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}
