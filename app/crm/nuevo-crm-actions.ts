'use server';

// =============================================================================
// nuevo-crm-actions — «Nuevo CRM» desde el desplegable del tablero (14/10/2026)
// =============================================================================
// El modal elige un TIPO (`TIPOS_CRM`, lib/pipeline.ts) o «Otro, lo armo yo» con el canal y las
// entradas a mano. Las dos cosas pasan por acá y por `crearCrm` (lib/nuevo-crm.ts), el mismo
// camino que usa la op `crear_crm` de la API de MaKo.
//
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { TopeDelPlanError, frenarAltaPorTope } from '@/lib/topes-crm';
import { TAG } from '@/lib/cache';
import { siembraDeCrm } from '@/lib/pipeline';
import { crearCrm } from '@/lib/nuevo-crm';
import { TIPO_CRM_NEWSLETTER } from '@/lib/newsletter-reglas';

/**
 * ⚠️ SIN SESIÓN NO SE CREA NADA: sin cookie `getWorkspaceActual()` cae al ws1, que es un cliente.
 * Es el corte de app/crm/mako-confirm-actions.ts (tests/acciones-sin-sesion.test.ts).
 */
async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}

function bust() {
  try { updateTag(TAG.leads); updateTag(TAG.pipeline); } catch { /* la caché vence sola por su TTL */ }
}

/**
 * Crea el CRM y devuelve su embudo. Devuelve el error en vez de tirarlo: lo llama un modal abierto
 * encima del tablero, y una excepción ahí sube al error boundary y se lleva la pantalla entera.
 *
 * ⚠️ SÓLO EL ADMIN: crear un CRM escribe la config del negocio (un embudo con sus etapas y cómo
 * llega la gente). La entrada ya lo exigía (`declararEntradasAction`), y antes un closer creaba el
 * CRM y la entrada se perdía sin aviso.
 */
export async function crearCrmAction(
  nombre: string,
  eleccion: { tipo: string; canal?: string | null; entradas?: string[] },
): Promise<{ funnelId: number } | { error: string; pasarAPro?: boolean }> {
  try {
    if (!(await haySesion())) return { error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { error: 'Solo el administrador puede crear un CRM.' };
    // «Newsletter» (14/11/2026): el CRM de la tab Newsletters, con sus etapas (Suscripto, Lee, Dormido, Dado de baja, Compró). Si
    // el negocio ya tiene uno, se abre ése: la tab trabaja con UN newsletter.
    if (eleccion?.tipo === TIPO_CRM_NEWSLETTER) {
      const wsN = await getWorkspaceActual();
      const { crmDelNewsletter, asegurarCrmNewsletter } = await import('@/lib/newsletter');
      const ya = await crmDelNewsletter().catch(() => null);
      if (!ya && wsN != null) await frenarAltaPorTope(wsN, 'crm.funnels');
      const crm = ya ?? await asegurarCrmNewsletter(typeof nombre === 'string' ? nombre : '');
      bust();
      revalidatePath('/crm');
      revalidatePath('/email');
      return { funnelId: crm.id };
    }
    const siembra = siembraDeCrm(eleccion ?? {});
    if ('error' in siembra) return { error: siembra.error };
    // El tope del plan (23/10/2026): MaKo Esencial tiene UN CRM. Se dice y se ofrece «Pasar a Pro»; no se borra nada.
    const ws = await getWorkspaceActual();
    if (ws != null) await frenarAltaPorTope(ws, 'crm.funnels');
    const r = await crearCrm(typeof nombre === 'string' ? nombre : '', siembra);
    bust();
    revalidatePath('/crm');
    revalidatePath('/funnel');
    revalidatePath('/automations');
    return { funnelId: r.funnelId };
  } catch (e) {
    if (e instanceof TopeDelPlanError) return { error: e.message, pasarAPro: true };
    return { error: e instanceof Error ? e.message : 'No se pudo crear el CRM.' };
  }
}
