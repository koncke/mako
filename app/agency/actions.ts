'use server';

// =============================================================================
// Agency Dashboard — las acciones de la pantalla (y del «Abrirle su cuenta» del CRM)
// =============================================================================
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el typecheck y TIRA EL
//    BUILD (AGENTS.md). Los tipos viven en lib/agency.ts y lib/partners.ts.
//
// La primera línea de cada una es la PUERTA: el ADMIN del negocio (`adminDeWorkspaceActual`; el super admin parado en
// la agencia también). Que el negocio pueda (plan Pro activo) o sea Agency lo repregunta el núcleo. Esconder el botón no
// protege nada.

import { revalidatePath } from 'next/cache';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { sumarseComoAgency, type ResultadoSumarse } from '@/lib/agency';
import { abrirCuentaDePartner, leadParaPartners, type CuentaAbierta } from '@/lib/partners';
import { quienPagaDe } from '@/lib/agency-reglas';
import { getSesionAdmin } from '@/lib/auth';
import { aplicarPlantillaACliente, type ResultadoPlantilla } from '@/lib/plantillas-modelo';
import { esModeloCliente } from '@/lib/plantillas-modelo-reglas';
import { darDeBajaClienteDeAgencia } from '@/lib/agencia-baja';

const emailDeQuienMira = () => getUsuarioActual().then((u) => u?.email ?? null).catch(() => null);

/** «Sumarme como Agency»: lo que contó en las preguntas y la fila en `agencias`. Después, el dashboard. */
export async function sumarmeComoAgencyAction(perfil: { clientes?: string | null; rubro?: string; pagaHoy?: string | null }): Promise<ResultadoSumarse> {
  try {
    const ws = await adminDeWorkspaceActual();
    if (!ws) return { ok: false, error: 'Sólo el admin de la cuenta puede sumarla como Agency.' };
    const r = await sumarseComoAgency({ ws, quien: await emailDeQuienMira(), perfil });
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude sumarte como Agency.' };
  }
}

/**
 * Abrirle su cuenta de MaKo a un cliente de la agencia: desde un lead del CRM (`leadId`, cualquier etapa) o desde cero, y
 * eligiendo quién la paga. Devuelve el link del primer mes (si paga la agencia, lo paga ahí mismo).
 */
export async function abrirCuentaClienteAction(datos: { leadId?: number | null; nombre?: string; email: string; paga?: string | null }): Promise<CuentaAbierta> {
  try {
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede abrirle una cuenta a un cliente.' };
    const r = await abrirCuentaDePartner({
      agenciaWs,
      nombre: String(datos?.nombre ?? ''),
      email: String(datos?.email ?? ''),
      leadId: datos?.leadId != null ? Number(datos.leadId) : null,
      pagador: await emailDeQuienMira(),
      paga: quienPagaDe(datos?.paga),
    });
    if (r.ok) {
      revalidatePath('/agency');
      // El lead pasó a tener cuenta: la ficha del CRM dice «Ver en Agency Dashboard».
      if (datos?.leadId != null) revalidatePath('/crm');
    }
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo abrir la cuenta.' };
  }
}

/** Lo que el alta necesita del lead del CRM: su nombre, su email y si ya tiene cuenta. */
export async function leadParaAgencyAction(leadId: number): Promise<
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

/**
 * Aplicarle a un cliente la plantilla de su modelo de negocio (MAU-01): funnel, tablero y la guía en su Plan
 * (lib/plantillas-modelo.ts). La puerta: el admin de la agencia o el super admin; la cartera la repregunta el núcleo.
 */
export async function aplicarPlantillaAction(clienteWs: number, modelo: string): Promise<ResultadoPlantilla> {
  try {
    if (!esModeloCliente(modelo)) return { ok: false, error: 'Esa plantilla no existe.' };
    const superAdmin = (await getSesionAdmin()) != null;
    const agenciaWs = superAdmin ? null : await adminDeWorkspaceActual();
    if (!superAdmin && !agenciaWs) return { ok: false, error: 'Sólo el admin de la agencia aplica plantillas.' };
    const r = await aplicarPlantillaACliente({ agenciaWs, superAdmin }, Number(clienteWs), modelo);
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude aplicar la plantilla.' };
  }
}

/**
 * «Dar de baja» la cuenta de un cliente (29/10/2026, lib/agencia-baja.ts): sólo el admin de la AGENCIA dueña de esa fila de
 * la cartera (el super admin parado en la agencia también). Cancela el cobro, revoca la cartera, pausa la cuenta del cliente
 * sin borrar nada y le avisa.
 */
export async function darDeBajaClienteAction(clienteWs: number): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  try {
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede dar de baja a un cliente.' };
    const sesion = await getUsuarioActual();
    const r = await darDeBajaClienteDeAgencia({ agenciaWs, clienteWs: Number(clienteWs), autor: sesion?.nombre || sesion?.email || 'la agencia' });
    if (r.ok) revalidatePath('/agency');
    return r.ok ? { ok: true, resumen: r.resumen } : r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo dar de baja.' };
  }
}
