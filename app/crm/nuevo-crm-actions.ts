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
import { getRolWsEfectivo } from '@/lib/workspace';
import { TAG } from '@/lib/cache';
import { siembraDeCrm } from '@/lib/pipeline';
import { crearCrm } from '@/lib/nuevo-crm';

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
): Promise<{ funnelId: number; etapasDelTipo: boolean } | { error: string }> {
  try {
    if (!(await haySesion())) return { error: 'Sin sesión.' };
    if ((await getRolWsEfectivo()) !== 'admin') return { error: 'Solo el administrador puede crear un CRM.' };
    const siembra = siembraDeCrm(eleccion ?? {});
    if ('error' in siembra) return { error: siembra.error };
    const r = await crearCrm(typeof nombre === 'string' ? nombre : '', siembra);
    bust();
    revalidatePath('/crm');
    revalidatePath('/funnel');
    revalidatePath('/automations');
    return { funnelId: r.funnelId, etapasDelTipo: r.etapasDelTipo };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo crear el CRM.' };
  }
}
