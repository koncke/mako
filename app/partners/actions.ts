'use server';

// =============================================================================
// MaKo Partners — las acciones de la pantalla (y de la opción del CRM «Llevar a MaKo Partners»)
// =============================================================================
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el typecheck y TIRA EL
//    BUILD (AGENTS.md). Los tipos viven en lib/partners.ts.
//
// La primera línea de cada una es la PUERTA: quien abre una cuenta de un cliente es el ADMIN de una agencia
// (`adminDeWorkspaceActual`; el super admin parado en la agencia también). Que la agencia sea del programa lo repregunta
// el núcleo (`esAgencia`, lib/partners.ts). Esconder el botón no protege nada.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminDeWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { abrirCuentaDePartner, leadParaPartners, type CuentaAbierta } from '@/lib/partners';
import { codigoDe } from '@/lib/partners-programa';

/** A dónde vuelve «Unirme»: el tablero de la computadora, o /partners (el teléfono lo abre como /m/partners). */
const VUELTAS_DE_UNIRME = new Set(['/partners/referidos', '/partners']);

/**
 * «Unirme a MaKo Partners» (24/10/2026): la landing de la tab se ve hasta que el negocio se une, y unirse es tener su
 * código (`codigoDe`, que lo crea la primera vez y devuelve el mismo después: dos clics no hacen dos). Sólo el ADMIN del
 * negocio, como el tablero; la plataforma nunca es partner. Un formulario sin JavaScript: termina en un redirect.
 */
export async function unirmeAPartnersAction(datos: FormData): Promise<void> {
  const pedida = String(datos.get('volver') ?? '');
  const volver = VUELTAS_DE_UNIRME.has(pedida) ? pedida : '/partners/referidos';
  const ws = await adminDeWorkspaceActual();
  if (ws == null || ws === (await wsSuperAdmin())) redirect(await rutaConWs('/partners'));
  const codigo = await codigoDe(ws).catch((e) => { console.warn(`[partners] no pude unir al negocio ${ws}:`, e instanceof Error ? e.message : e); return null; });
  revalidatePath('/partners/referidos');
  redirect(await rutaConWs(codigo ? volver : `${volver}?unirme=error`));
}

/**
 * Abrirle su cuenta de MaKo a un cliente de la agencia: desde un lead del CRM (`leadId`, cualquier etapa) o desde
 * cero. Devuelve el link del primer mes, que es lo que la habilita.
 */
export async function llevarAPartnersAction(datos: { leadId?: number | null; nombre?: string; email: string }): Promise<CuentaAbierta> {
  try {
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede abrirle una cuenta a un cliente.' };
    const pagador = await getUsuarioActual().then((u) => u?.email ?? null).catch(() => null);
    const r = await abrirCuentaDePartner({
      agenciaWs,
      nombre: String(datos?.nombre ?? ''),
      email: String(datos?.email ?? ''),
      leadId: datos?.leadId != null ? Number(datos.leadId) : null,
      pagador,
    });
    if (r.ok) {
      revalidatePath('/partners');
      // El lead pasó a tener cuenta: la ficha del CRM y la de Clients dicen «En MaKo Partners».
      if (datos?.leadId != null) { revalidatePath('/crm'); revalidatePath('/clients'); }
    }
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo abrir la cuenta.' };
  }
}

/** Lo que el modal del CRM necesita del lead: su nombre, su email y si ya tiene cuenta. */
export async function leadParaPartnersAction(leadId: number): Promise<
  { ok: true; nombre: string; email: string | null; clienteWs: number | null } | { ok: false; error: string }
> {
  try {
    if (!(await adminDeWorkspaceActual())) return { ok: false, error: 'Sólo el admin de la cuenta puede hacerlo.' };
    const l = await leadParaPartners(Number(leadId));
    if (!l) return { ok: false, error: 'Ese lead no es de tu CRM.' };
    return { ok: true, nombre: l.nombre, email: l.email, clienteWs: l.clienteWs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el lead.' };
  }
}
