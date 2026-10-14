'use server';

// =============================================================================
// datos-sin-marcar-actions — ignorar datos de un lead (uno, o todos), y qué tipos de dato avisan
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

type ResultadoIgnorar = { ok: true; ignorados: StepId[] } | { ok: false; error: string };

/**
 * LA escritura de lo ignorado, una sola para las dos puertas: el dato suelto (la ficha) y el lead
 * entero (la ✕ de «A revisar»). No completa nada: el dato sigue faltando y mover de etapa lo sigue
 * pidiendo. Lo que cambia es que no avisa, y queda en `leads.datos_ignorados` (mig 0270), que es
 * de donde sale el «Ver más» con su «volver a avisar».
 *
 * Quien llama ya cortó sin sesión y ya saneó `pasos` (ids que existen, sin los NO_IGNORABLES).
 *
 * ⚠️ READ-MODIFY-WRITE de un array chico, por lead: dos pestañas ignorando dos datos del mismo
 * lead en el mismo instante pueden pisarse una a la otra. Es una preferencia de aviso, se ve en
 * pantalla y se vuelve a ignorar en un clic: no justifica una función de base.
 */
async function escribirIgnorados(leadId: number, pasos: readonly StepId[], ignorar: boolean): Promise<ResultadoIgnorar> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('datos_ignorados').eq('id', leadId).limit(1);
  if (error) return { ok: false, error: 'No se pudo leer el lead.' };
  const fila = ((data ?? []) as Array<{ datos_ignorados: unknown }>)[0];
  if (!fila) return { ok: false, error: 'Ese lead no es de esta cuenta.' };
  let nuevos = sanearIds(fila.datos_ignorados);
  for (const paso of pasos) nuevos = conIgnorado(nuevos, paso, ignorar);
  const { error: e2 } = await db.from('leads').update({ datos_ignorados: nuevos }).eq('id', leadId);
  if (e2) return { ok: false, error: 'No se pudo guardar.' };
  const nombres = pasos.map((p) => DATOS_AVISABLES.find((d) => d.id === p)?.label ?? p).join(' · ');
  await logLeadEvent(leadId, 'Datos sin marcar', `${ignorar ? 'ignorado' : 'vuelve a avisar'}: ${nombres}`, await autor()).catch(() => {});
  bust();
  revalidatePath('/crm');
  return { ok: true, ignorados: nuevos };
}

/** Ignora (o deja de ignorar) UN dato sin marcar de UN lead: el desplegable de la ficha. */
export async function ignorarDatoAction(leadId: number, id: string, ignorar: boolean): Promise<ResultadoIgnorar> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Lead inválido.' };
    const [paso] = sanearIds([id]);
    if (!paso) return { ok: false, error: 'Ese dato no existe.' };
    if (NO_IGNORABLES.has(paso)) return { ok: false, error: 'Ese dato no se puede ignorar.' };
    return await escribirIgnorados(leadId, [paso], ignorar);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}

/**
 * Ignora (o vuelve a avisar) TODOS los datos que se le pasan de UN lead, de una vez: la ✕ y el
 * «volver a avisar» de «A revisar», que desde el 14/10/2026 es una fila por lead (Martín: «No
 * pongas muchas filas del mismo lead... Y el botón de ignorar que sea una X»).
 *
 * ⚠️ LOS NO_IGNORABLES SE SACAN ACÁ, no sólo en la pantalla: la asistencia a una reunión que ya
 * pasó sigue avisando aunque el navegador la mande (lib/datos-aviso.ts). Si no queda nada, no se
 * escribe.
 */
export async function ignorarDatosDelLeadAction(leadId: number, ids: string[], ignorar: boolean): Promise<ResultadoIgnorar> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: 'Lead inválido.' };
    const pasos = sanearIds(ids).filter((p) => !NO_IGNORABLES.has(p));
    if (!pasos.length) return { ok: false, error: 'Nada que ignorar.' };
    return await escribirIgnorados(leadId, pasos, ignorar);
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
