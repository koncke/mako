'use server';

// =============================================================================
// datos-sin-marcar-actions — ignorar UN dato de un lead, y qué tipos de dato avisan
// =============================================================================
// Feedback del detalle del lead (Martín, 13/10/2026, punto 1). La regla de qué se hace con lo
// que falta vive en lib/datos-aviso.ts; acá sólo se escribe.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getTenantDb, getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { logLeadEvent } from '@/lib/leads';
import { TAG } from '@/lib/cache';
import { conIgnorado, sanearIds, DATOS_AVISABLES, NO_IGNORABLES } from '@/lib/datos-aviso';
import { apagadosDelNegocio, guardarApagados } from '@/lib/datos-aviso-config';
import type { StepId } from '@/lib/stage-requirements';

/** El worklist y el contador viven en la caché de leads: sin esto, lo ignorado sigue contando. */
function bust() {
  try { updateTag(TAG.leads); } catch { /* la caché vence sola por su TTL */ }
}

/**
 * ⚠️ SIN SESIÓN NO SE HACE NADA. «A revisar» las monta el LAYOUT raíz (MakoConfirmGate), así que
 * su id viaja en todas las páginas — y sin cookie `getWorkspaceActual()` cae al ws1, un cliente.
 * Es el mismo corte que app/crm/mako-confirm-actions.ts (tests/acciones-sin-sesion.test.ts).
 */
async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

async function autor(): Promise<string> {
  try { return (await getUsuarioActual())?.email?.trim() || 'CRM'; } catch { return 'CRM'; }
}

/**
 * Ignora (o deja de ignorar) UN dato sin marcar de UN lead. No completa nada: el dato sigue
 * faltando y mover de etapa lo sigue pidiendo. Lo que cambia es que no avisa.
 *
 * ⚠️ READ-MODIFY-WRITE de un array chico, por lead: dos pestañas ignorando dos datos del mismo
 * lead en el mismo instante pueden pisarse una a la otra. Es una preferencia de aviso, se ve en
 * pantalla y se vuelve a ignorar en un clic: no justifica una función de base.
 */
export async function ignorarDatoAction(leadId: number, id: string, ignorar: boolean): Promise<{ ok: true; ignorados: StepId[] } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Lead inválido.' };
    const [paso] = sanearIds([id]);
    if (!paso) return { ok: false, error: 'Ese dato no existe.' };
    if (NO_IGNORABLES.has(paso)) return { ok: false, error: 'Ese dato no se puede ignorar.' };
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('datos_ignorados').eq('id', leadId).limit(1);
    if (error) return { ok: false, error: 'No se pudo leer el lead.' };
    const fila = ((data ?? []) as Array<{ datos_ignorados: unknown }>)[0];
    if (!fila) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
    const nuevos = conIgnorado(fila.datos_ignorados, paso, ignorar);
    const { error: e2 } = await db.from('leads').update({ datos_ignorados: nuevos }).eq('id', leadId);
    if (e2) return { ok: false, error: 'No se pudo guardar.' };
    const nombre = DATOS_AVISABLES.find((d) => d.id === paso)?.label ?? paso;
    await logLeadEvent(leadId, 'Datos sin marcar', `${ignorar ? 'ignorado' : 'vuelve a avisar'}: ${nombre}`, await autor()).catch(() => {});
    bust();
    revalidatePath('/crm');
    return { ok: true, ignorados: nuevos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/** Qué tipos de dato tiene apagados el negocio, y si quien mira los puede cambiar. */
export async function avisosDatosAction(): Promise<{ apagados: StepId[]; puedeEditar: boolean }> {
  if (!(await haySesion())) return { apagados: [], puedeEditar: false };
  const [apagados, rol] = await Promise.all([apagadosDelNegocio(), getRolWsEfectivo().catch(() => null)]);
  return { apagados, puedeEditar: rol === 'admin' };
}

/**
 * Guarda qué tipos de dato NO avisan. Sólo el admin: es del negocio entero (el worklist, «A
 * revisar» y los avisos de MaKo de todo el equipo cuentan con esto).
 */
export async function guardarAvisosDatosAction(apagados: string[]): Promise<{ ok: true; apagados: StepId[] } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiarlo.' };
    const limpios = await guardarApagados(apagados);
    bust();
    revalidatePath('/crm');
    return { ok: true, apagados: limpios };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
