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
import { getRolWsEfectivo } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { TAG } from '@/lib/cache';
import { sanearIds, sanearApagados, NO_IGNORABLES } from '@/lib/datos-aviso';
import { apagadosDelNegocio, guardarApagados, escribirDatosIgnorados } from '@/lib/datos-aviso-config';
import { apagadosDeFunnel, cambiarFichaDeFunnel } from '@/lib/ficha/config-server';
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
 * Las dos puertas de la pantalla (el dato suelto de la ficha y la ✕ del lead en «A revisar») escriben
 * por `escribirDatosIgnorados` (lib/datos-aviso-config.ts), la MISMA función que usa la API de MaKo
 * (`ignorar_datos_sin_marcar`): hasta el 14/10/2026 la API escribía `pendientes_ignorados` (el lead
 * entero, mig 0109) y lo que ignoraba MaKo no aparecía en «Ver más» ni se podía volver a mostrar.
 *
 * Quien llama ya cortó sin sesión y ya saneó `pasos` (ids que existen, sin los NO_IGNORABLES).
 */
async function escribirIgnorados(leadId: number, pasos: readonly StepId[], ignorar: boolean): Promise<ResultadoIgnorar> {
  const r = await escribirDatosIgnorados(leadId, pasos, ignorar, await autor());
  if (!r.ok) return r;
  if (r.cambio) { bust(); revalidatePath('/crm'); }
  return { ok: true, ignorados: r.ignorados };
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

/**
 * Qué tipos de dato NO avisan, y si quien mira los puede cambiar.
 *
 * Desde el 14/10/2026 los avisos son POR FUNNEL (decisión 1 de docs/diseno-ficha-bloques.md): con
 * `funnelId` (la casa del lead; null = el producto del negocio) son los de la ficha de ese funnel, que
 * es lo que de verdad cuenta el lead. Sin `funnelId` (undefined), los del negocio: el respaldo que se
 * suma a todos los funnels.
 */
export async function avisosDatosAction(funnelId?: number | null): Promise<{ apagados: StepId[]; puedeEditar: boolean }> {
  if (!(await haySesion())) return { apagados: [], puedeEditar: false };
  const [apagados, rol] = await Promise.all([
    funnelId === undefined ? apagadosDelNegocio() : apagadosDeFunnel(funnelId),
    getRolWsEfectivo().catch(() => null),
  ]);
  return { apagados, puedeEditar: rol === 'admin' };
}

/**
 * Guarda qué tipos de dato NO avisan. Sólo el admin: el worklist, «A revisar» y los avisos de MaKo de
 * todo el equipo cuentan con esto. Con `funnelId`, en la ficha de ese funnel (sólo lo que difiere de su
 * plantilla); sin él, en el respaldo del negocio.
 */
export async function guardarAvisosDatosAction(apagados: string[], funnelId?: number | null): Promise<{ ok: true; apagados: StepId[] } | { ok: false; error: string }> {
  try {
    if (!(await haySesion())) return { ok: false, error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiarlo.' };
    let limpios: StepId[];
    if (funnelId === undefined) limpios = await guardarApagados(apagados);
    else {
      const r = await cambiarFichaDeFunnel(funnelId, { op: 'avisos', apagados: sanearApagados(apagados) });
      if (!r.ok) return r;
      limpios = r.ficha.efectiva.apagados;
    }
    bust();
    revalidatePath('/crm');
    return { ok: true, apagados: limpios };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar.' };
  }
}
