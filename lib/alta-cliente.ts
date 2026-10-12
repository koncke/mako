// =============================================================================
// alta-cliente — dar de alta un cliente de MaKo (workspace + su admin + el mail de acceso)
// =============================================================================
// Extraído de app/api/admin/workspaces/route.ts (case 'crear') el 11/10/2026 para que lo llamen DOS
// puertas: el panel del super admin y el pago de un plan de MaKo (lib/cobros.ts, decisión de Martín:
// «alta automática»). docs/hallazgos-planes-y-cobro.md ya lo decía: «El alta completa YA existe: lo
// que falta es el disparador». No se reescribe: se mueve con el ORDEN que ya estaba pagado.
//
// EL ORDEN, y por qué cada paso está donde está:
//   1. El email único ANTES de la primera escritura: `usuarios.email` es único, y fallar después deja
//      un workspace huérfano — un alta a medias que nadie limpia.
//   2. crearWorkspace.
//   3. Sembrar el onboarding ADENTRO de runWithWorkspace(ws): sin el contexto, setSetting escribe en
//      el workspace de la cookie (o en el ws1, Mauricio). No fatal.
//   4. Crear el usuario admin; si falla, se BORRA el workspace (rollback).
//   5. El mail de acceso, NO fatal: si Resend falla, el cliente YA existe y su fila YA lo autoriza a
//      entrar (el login es sólo Google y la fila en `usuarios` ES la invitación). Revertir un alta
//      buena por un mail que no salió es peor que el mail que no salió.
//
// ⚠️ SÓLO CAPAS VENDIBLES. La ruta vieja aceptaba cualquier `esCapaValida`, incluida `superadmin`:
// darla le muda la identidad de MaKo a un cliente (lib/capas.ts, CAPAS_VENDIBLES; el case 'capa' de
// la misma ruta ya lo cerraba). Por un pago, con más razón: el plan sale de una fila que escribió el
// super admin, y aun así se valida acá.

import 'server-only';
import { crearWorkspace, runWithWorkspace, type Workspace } from './workspace';
import { crearUsuario, listarUsuarios } from './usuarios';
import { getSupabaseServer } from './supabase';
import { setSetting } from './settings';
import { estadoInicial, setEstadoOnboarding } from './onboarding-state';
import { hoyEnTijuana } from './date-utils';
import { CAPAS_VENDIBLES, capaDef, type CapaId } from './capas';
import { invitarPorEmail, type ResultadoInvitacion } from './invitaciones';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoAlta =
  | { ok: true; workspace: Workspace; invitacion: ResultadoInvitacion }
  | { ok: false; error: string; status: number; yaExiste?: boolean };

export const esCapaVendible = (capa: string): capa is CapaId => CAPAS_VENDIBLES.some((c) => c.id === capa);

export async function darDeAltaCliente(a: {
  nombre: string;
  capa: string;
  adminEmail: string;
  adminNombre?: string | null;
  invitadoPor: string;
}): Promise<ResultadoAlta> {
  const nombre = (a.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Pon un nombre de cliente.', status: 400 };
  const adminEmail = (a.adminEmail ?? '').trim().toLowerCase();
  // ⚠️ EL EMAIL ES OBLIGATORIO (27/09/2026): «el email NO puede ser opcional… si justamente le llega
  // la invitación por ahí». Sin él quedaba un workspace sin una sola fila en `usuarios`.
  if (!adminEmail) return { ok: false, error: 'Pon el email de su admin: por ahí le llega el acceso.', status: 400 };
  if (!EMAIL_RE.test(adminEmail)) return { ok: false, error: 'Email del admin inválido.', status: 400 };
  const capa = (a.capa ?? '').trim();
  if (!esCapaVendible(capa)) return { ok: false, error: 'Elige un tipo de cliente válido.', status: 400 };

  // 1. Email único ANTES de escribir nada.
  const existe = (await listarUsuarios()).some((u) => u.email === adminEmail);
  if (existe) return { ok: false, error: 'Ya existe un usuario con ese email.', status: 400, yaExiste: true };

  // 2. El workspace.
  const def = capaDef(capa);
  const ws = await crearWorkspace(nombre, capa);

  // 3. Seed inicial SEGÚN LA CAPA: sólo se siembra lo que el cliente compró. A uno de Project Manager
  //    no le sirve un objetivo de cierres (no tiene ni ads ni CRM).
  try {
    await runWithWorkspace(ws.id, async () => {
      await setEstadoOnboarding(estadoInicial('pending'));
      if (def.integracionesRequeridas.includes('meta')) {
        // objetivo_desde ancla el progreso del objetivo en /general; sin esto usaría la fecha de
        // arranque del dueño.
        await setSetting('objetivo_desde', hoyEnTijuana());
      }
    });
  } catch (e) {
    console.error('[alta-cliente] seed onboarding falló (no fatal):', e);
  }

  // 4. El usuario admin del cliente, con rollback del workspace si falla.
  try {
    await crearUsuario({
      email: adminEmail,
      nombre: a.adminNombre ?? undefined,
      rol: 'usuario',
      rol_ws: 'admin',
      workspace_id: ws.id,
      invitado_por: a.invitadoPor,
    });
  } catch (e) {
    await getSupabaseServer().from('workspaces').delete().eq('id', ws.id);
    return { ok: false, error: `No se pudo crear el admin del cliente: ${e instanceof Error ? e.message : e}`, status: 500 };
  }

  // 5. El mail, después del alta y sin poder deshacerla. Quien dio de alta se entera por `invitacion`
  //    (enviado / error / enlace para pasarlo a mano).
  const invitacion = await invitarPorEmail({
    email: adminEmail,
    nombre: a.adminNombre ?? undefined,
    workspace: ws.nombre,
    rolWs: 'admin',
  });
  return { ok: true, workspace: ws, invitacion };
}
