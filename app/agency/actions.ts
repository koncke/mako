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
import { headers } from 'next/headers';
import { paisDelVisitante } from '@/lib/compra-plan-reglas';
import { planCuentaDe } from '@/lib/agencia-cobro-reglas';
import { cambiarPlanDeCliente } from '@/lib/agencia-plan';
import { apagarMensualidad, corregirRelojDeCliente, marcarEntradaPagada, marcarMesPagado, prenderMensualidad, quitarMesPagado } from '@/lib/agencia-mes';

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
export async function abrirCuentaClienteAction(datos: { leadId?: number | null; nombre?: string; email: string; paga?: string | null; plan?: string | null }): Promise<CuentaAbierta> {
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
      // Su plan (29/10/2026: «son los mismos planes, de 47 y 97») y el país de quien la abre, que decide la pasarela.
      plan: planCuentaDe(datos?.plan),
      pais: paisDelVisitante((await headers()).get('x-vercel-ip-country')),
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

/** Cambiar el plan (Esencial ↔ Pro) de la cuenta de un cliente (29/10/2026, lib/agencia-plan.ts): sólo el admin de la agencia. */
export async function cambiarPlanClienteAction(clienteWs: number, plan: string): Promise<{ ok: true; resumen: string } | { ok: false; error: string }> {
  try {
    const agenciaWs = await adminDeWorkspaceActual();
    if (!agenciaWs) return { ok: false, error: 'Sólo el admin de la cuenta puede cambiar el plan de un cliente.' };
    const sesion = await getUsuarioActual();
    const r = await cambiarPlanDeCliente({ agenciaWs, clienteWs: Number(clienteWs), plan: planCuentaDe(plan), autor: sesion?.nombre || sesion?.email || 'la agencia' });
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo cambiar el plan.' };
  }
}

// ── La MENSUALIDAD de la agencia (Martín, 5/11/2026; lib/agencia-mes.ts) ─────────────────────────────────────────────────
// Todo lo que escribe es del SUPER ADMIN parado en la agencia: marcar un mes o una entrada pagados, corregir el reloj de un
// cliente y prender o apagar la mensualidad. La agencia la LEE (viene con el HTML de la página); no anota sus propios pagos.

type ResultadoMensualidad = { ok: true; resumen: string; yaEstaba?: true } | { ok: false; error: string };

/** La puerta: el super admin, parado en una agencia (su `?ws=`). Devuelve la agencia y quién firma, o el error. */
async function superAdminEnLaAgencia(): Promise<{ agenciaWs: number; autor: string } | { error: string }> {
  const sesion = await getSesionAdmin();
  if (!sesion) return { error: 'Sólo el super admin anota la mensualidad.' };
  const agenciaWs = await adminDeWorkspaceActual();
  if (!agenciaWs) return { error: 'Entra a la agencia desde Agency Dashboard para anotar su mensualidad.' };
  return { agenciaWs, autor: (await emailDeQuienMira()) ?? 'super admin' };
}

/** Marca un mes «Pagado», con el día en que entró. */
export async function marcarMesPagadoAction(mes: string, pagadoEl: string): Promise<ResultadoMensualidad> {
  try {
    const p = await superAdminEnLaAgencia();
    if ('error' in p) return { ok: false, error: p.error };
    const r = await marcarMesPagado({ agenciaWs: p.agenciaWs, mes: String(mes), pagadoEl: String(pagadoEl), autor: p.autor });
    if (r.ok) revalidatePath('/agency');
    return r.ok ? { ok: true, resumen: r.resumen, ...(r.yaEstaba ? { yaEstaba: true as const } : {}) } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude marcarlo pagado.' };
  }
}

/** Saca la marca de «Pagado» (el «Deshacer»): sólo si sigue con la fecha que se marcó. */
export async function quitarMesPagadoAction(mes: string, pagadoEl: string | null): Promise<ResultadoMensualidad> {
  try {
    const p = await superAdminEnLaAgencia();
    if ('error' in p) return { ok: false, error: p.error };
    const r = await quitarMesPagado({ agenciaWs: p.agenciaWs, mes: String(mes), pagadoEl: pagadoEl ? String(pagadoEl) : null });
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude sacar la marca.' };
  }
}

/** Marca la ENTRADA de un cliente pagada (sus días hasta el próximo 5), con el día en que entró. Si estaba en pausa, vuelve a entrar. */
export async function marcarEntradaPagadaAction(clienteWs: number, pagadoEl: string): Promise<ResultadoMensualidad> {
  try {
    const p = await superAdminEnLaAgencia();
    if ('error' in p) return { ok: false, error: p.error };
    const r = await marcarEntradaPagada({ agenciaWs: p.agenciaWs, clienteWs: Number(clienteWs), pagadoEl: String(pagadoEl), autor: p.autor });
    if (r.ok) revalidatePath('/agency');
    return r.ok ? { ok: true, resumen: r.resumen, ...(r.yaEstaba ? { yaEstaba: true as const } : {}) } : { ok: false, error: r.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude marcar la entrada.' };
  }
}

/** Corrige desde qué día corren los 14 días de un cliente (`null`: desde la invitación). */
export async function corregirRelojAction(clienteWs: number, dia: string | null): Promise<ResultadoMensualidad> {
  try {
    const p = await superAdminEnLaAgencia();
    if ('error' in p) return { ok: false, error: p.error };
    const r = await corregirRelojDeCliente({ agenciaWs: p.agenciaWs, clienteWs: Number(clienteWs), dia: dia ? String(dia) : null });
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude corregir la fecha.' };
  }
}

/** Prende la mensualidad desde un mes (`AAAA-MM`), o la apaga con `desde: null`. */
export async function mensualidadPrendidaAction(desde: string | null): Promise<ResultadoMensualidad> {
  try {
    const p = await superAdminEnLaAgencia();
    if ('error' in p) return { ok: false, error: p.error };
    const r = desde ? await prenderMensualidad({ agenciaWs: p.agenciaWs, desde: String(desde), autor: p.autor }) : await apagarMensualidad({ agenciaWs: p.agenciaWs });
    if (r.ok) revalidatePath('/agency');
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude cambiar la mensualidad.' };
  }
}
