'use server';

// =============================================================================
// MaKo Partners — las acciones de la pantalla (y de la opción del CRM «Llevar a MaKo Partners»)
// =============================================================================
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el typecheck y TIRA EL
//    BUILD (AGENTS.md). Los tipos viven en lib/partners.ts.
//
// La primera línea de cada una es la PUERTA. Hacerse partner y cambiar dónde cobra: el ADMIN del negocio. «Marcar pagado»:
// el super admin. Abrir la cuenta de un cliente (el panel de agencia, /agency): el ADMIN de una agencia
// (`adminDeWorkspaceActual`; el super admin parado en la agencia también); que la agencia sea del programa lo repregunta el
// núcleo (`esAgencia`, lib/partners.ts). Esconder el botón no protege nada.

import { revalidatePath } from 'next/cache';
import { adminDeWorkspaceActual, estaImpersonando } from '@/lib/workspace';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { abrirCuentaDePartner, leadParaPartners, type CuentaAbierta } from '@/lib/partners';
import { cambiarCobroPartner, cambiarCodigoPartner, hacermePartner, registrarPagoAPartner, type ResultadoAlta } from '@/lib/partners-programa';

/**
 * «Hacerme partner» (25/10/2026): el último paso del onboarding corto de /partners (app/partners/AltaPartner.tsx). Guarda lo
 * que contestó y devuelve su link (`hacermePartner`: dos veces no duplica nada). Sólo el ADMIN del negocio, como el panel;
 * la plataforma nunca es partner.
 */
export async function hacermePartnerAction(respuestas: unknown): Promise<ResultadoAlta> {
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sólo el admin del negocio puede hacerlo partner.' };
  const r = await hacermePartner(ws, respuestas);
  if (r.ok) revalidatePath('/partners');
  return r;
}

/** «Cambiar» el código del panel del partner (27/10/2026): el nuevo, único; el viejo sigue acreditándole. Sólo el admin. */
export async function cambiarCodigoPartnerAction(codigo: string): Promise<{ ok: true; codigo: string; link: string } | { ok: false; error: string }> {
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sólo el admin del negocio puede cambiarlo.' };
  const r = await cambiarCodigoPartner(ws, codigo);
  if (r.ok) revalidatePath('/partners');
  return r;
}

/** «Dónde te transferimos» del panel del partner: el alias, el CBU o el email de PayPal. */
export async function cambiarCobroPartnerAction(cobro: string): Promise<{ ok: true; cobro: string | null } | { ok: false; error: string }> {
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sólo el admin del negocio puede cambiarlo.' };
  const r = await cambiarCobroPartner(ws, cobro);
  if (r.ok) revalidatePath('/partners');
  return r;
}

/**
 * «Marcar pagado» del panel del programa (25/10/2026): el super admin anota que le transfirió a un partner lo que tenía a
 * cobrar. SÓLO el super admin y sin estar parado en un cliente (es el panel de la plataforma). No mueve plata: la
 * transferencia se hace afuera; esto la anota en el libro y le avisa al partner.
 */
export async function marcarPagoPartnerAction(datos: { ws: number; montoUsd?: number | null; nota?: string | null }): Promise<
  { ok: true; resumen: string } | { ok: false; error: string }
> {
  const sesion = await getSesionAdmin();
  if (!sesion || (await estaImpersonando())) return { ok: false, error: 'Sólo el super admin, desde el panel del programa.' };
  const ws = Number(datos?.ws);
  if (!Number.isInteger(ws) || ws <= 0) return { ok: false, error: 'Falta el partner.' };
  const monto = datos?.montoUsd == null ? null : Number(datos.montoUsd);
  const r = await registrarPagoAPartner({ ws, montoUsd: monto, nota: datos?.nota ?? null, autor: sesion.nombre || sesion.email || 'MaKo' });
  if (r.ok) revalidatePath('/partners');
  return r.ok ? { ok: true, resumen: r.resumen } : r;
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
      revalidatePath('/agency');
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
