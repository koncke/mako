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
// Y QUITAR o AGREGAR UNA cuota (revisión del 16/10/2026). Antes iban por `guardarCuotasAction` con la lista ENTERA
// de impagas que tenía la pantalla: si otra pestaña (o MaKo por su API) había cambiado una cuota en el medio, quitar
// otra le volvía a escribir su valor viejo, sin aviso. Acá se manda SÓLO la cuota que se toca: la que se quita es la
// única «vista» (`vistos`), y la que se agrega entra sin ninguna vista, así las demás no se casan ni se escriben.
//
// ⚠️ Sin sesión, nada (sin cookie el workspace cae al ws1, un cliente), y el lead tiene que ser de este negocio.
// ⚠️ 'use server': sólo funciones async (y tipos).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getUsuarioActual } from '@/lib/auth';
import { anotarEnHistorial, asegurarLeadDelNegocio, getPagosByLead, guardarCuotasPorId, proteccionesDeCuotas } from '@/lib/pagos';
import { esCuotaDevuelta } from '@/lib/cobrado-lead';
import { avisoDeConservadas, lineasDeCuotas, type Proteccion } from '@/lib/pagos-campo';

async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}
async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}
const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
function revalidar(leadId: number) {
  try { updateTag(TAG.pagos); updateTag(TAG.leads); } catch { /* vence por TTL */ }
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm');
  revalidatePath('/customer-success');
  revalidatePath('/dashboard');
  revalidatePath('/general');
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

/**
 * Quita UNA cuota impaga. Si tiene un link sin pagar o un recordatorio corriendo, no se quita y se dice por qué
 * (`motivo`). Las demás cuotas no se tocan.
 */
export async function quitarCuotaAction(leadId: number, pagoId: number): Promise<{ ok: true; quitada: boolean; motivo: string | null } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId) || !idValido(pagoId)) return { ok: false, error: 'Cuota inválida.' };
    await asegurarLeadDelNegocio(leadId);
    const cambios = await guardarCuotasPorId(leadId, [], { vistos: new Set([pagoId]) });
    const quitada = cambios.borrar.some((b) => b.id === pagoId);
    const conservada = cambios.conservar.filter((c) => c.id === pagoId);
    await anotarEnHistorial(leadId, lineasDeCuotas(cambios), await autor());
    if (quitada) revalidar(leadId);
    return { ok: true, quitada, motivo: avisoDeConservadas({ ...cambios, conservar: conservada }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Agrega UNA cuota futura (monto en dólares y vencimiento). Las demás cuotas no se tocan. */
export async function agregarCuotaAction(leadId: number, cuota: { monto: number; fecha: string }): Promise<{ ok: true; numero: number | null } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: SIN_SESION };
    if (!idValido(leadId)) return { ok: false, error: 'Lead inválido.' };
    const monto = Number(cuota?.monto);
    if (!Number.isFinite(monto) || monto <= 0 || monto > 100_000_000) return { ok: false, error: 'El monto tiene que ser mayor a cero.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cuota?.fecha ?? ''))) return { ok: false, error: 'La fecha tiene que ser AAAA-MM-DD.' };
    await asegurarLeadDelNegocio(leadId);
    const cambios = await guardarCuotasPorId(leadId, [{ id: null, monto_usd: monto, fecha_esperada: cuota.fecha }], { vistos: new Set() });
    await anotarEnHistorial(leadId, lineasDeCuotas(cambios), await autor());
    revalidar(leadId);
    return { ok: true, numero: cambios.insertar[0]?.numero ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
