// =============================================================================
// agencia-habilitar — un cliente de agencia queda habilitado: por la firma del super admin o por el PAGO (#866)
// =============================================================================
// Hasta el 17/10/2026 un cliente nuevo de una agencia esperaba a que Martín lo aprobara en /admin. Martín, en la llamada
// «Revisión de MaKo» con Código Inmobiliario (16/10, 1:51:21): «en la vista de clientes, de cargar nuevo cliente, te va a
// aparecer ahí directamente el link de mercado pago para pagar la suscripción de ese cliente... ya se habilita
// automáticamente... yo ya ni siquiera lo voy a tener que aceptar».
//
// Son DOS caminos al mismo hecho y por eso viven juntos:
//   · la firma del super admin (app/api/admin/agencia/route.ts) → `avisarClienteAprobado`;
//   · el pago del primer mes (lib/cobros.ts, `aplicarPagoAprobado`) → `habilitarClienteDeAgencia`, que aprueba la cartera
//     y manda el MISMO aviso. Dos textos para el mismo acceso son cómo uno de los dos se queda viejo.
//
// ⚠️ NO importa lib/cobros.ts: lo importa él. Recibe del cobro sólo lo que necesita.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin, getWorkspace } from './workspace';
import { listarUsuarios } from './usuarios';
import { invitarPorEmail } from './invitaciones';
import { esWsValido } from './agencia-cartera';

export type AvisoAprobacion = { tono: 'ok' | 'warn'; texto: string };

/**
 * APROBAR ES EL MOMENTO EN QUE EL CLIENTE SE ENTERA (lo que vivía en la ruta del super admin).
 *
 * ⚠️ ANTES NO PASABA NADA, y se midió: Código abrió una cuenta el 28/09, el super admin la aprobó, y no le llegó nada a
 * nadie. El alta CREA a su admin (silencioso) y la aprobación —la firma o el pago— le manda el acceso. Avisarle antes
 * sería contarle que tiene un acceso que todavía no está autorizado.
 *
 * ⚠️ Y EL MAIL NO PUEDE TUMBAR LA APROBACIÓN: si falla, se dice y se ofrece reenviarlo desde su equipo.
 */
export async function avisarClienteAprobado(clienteWs: number): Promise<AvisoAprobacion> {
  try {
    const admin = (await listarUsuarios()).find(
      (u) => u.workspace_id === clienteWs && (u.rol_ws ?? 'admin') === 'admin',
    );
    if (!admin) return { tono: 'warn', texto: 'Aprobado, pero ese cliente no tiene ningún usuario: nadie puede entrar todavía.' };
    // Ya se le avisó alguna vez: no se le escribe de nuevo por una re-aprobación.
    if (admin.invitacion_enviada_at) return { tono: 'ok', texto: `Aprobado. A ${admin.email} ya se le había mandado el acceso.` };
    const ws = await getWorkspace(clienteWs);
    const inv = await invitarPorEmail({ email: admin.email, nombre: admin.nombre, workspace: ws?.nombre, rolWs: admin.rol_ws });
    // ⚠️ `inv.enviado`, NO `inv`: `invitarPorEmail` devuelve SIEMPRE un objeto, también cuando el mail no salió.
    return inv.enviado
      ? { tono: 'ok', texto: `Aprobado. Se le mandó el acceso a ${admin.email}.` }
      : { tono: 'warn', texto: `Aprobado, pero no pude mandarle el acceso a ${admin.email}${inv.error ? ` (${inv.error})` : ''}. Reenvíaselo desde su equipo.` };
  } catch (e) {
    return { tono: 'warn', texto: `Aprobado, pero falló el aviso al cliente: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * El PAGO del primer mes de un cliente de agencia lo habilita (#866): la cartera pasa de `pendiente` a `aprobado`,
 * firmada por la pasarela, y al cliente le llega el acceso.
 *
 * ⚠️ En POSITIVO y con lo leído de la base: sólo un cobro de la PLATAFORMA, pagado, de pago único (el primer mes; una
 * renovación no aprueba nada) y con el par agencia/cliente de la mig 0308.
 * ⚠️ Compare-and-set `pendiente → aprobado`: un aviso repetido o el cron no lo aprueban dos veces, y una cartera que el
 * super admin REVOCÓ no la reabre un pago (lo revocado lo decidió una persona). Idempotente: lo llaman el aviso y el cron.
 * Nunca tira: la plata ya entró; si falla, lo dice el log y el cron lo vuelve a intentar.
 */
export async function habilitarClienteDeAgencia(c: { id: number; workspace_id: number; estado: string; tipo: string; proveedor: string }): Promise<void> {
  if (c.estado !== 'pagado' || c.tipo !== 'unico') return;
  try {
    if (c.workspace_id !== (await wsSuperAdmin())) return;
    const db = getSupabaseServer();
    const { data, error } = await db.from('cobros').select('agencia_ws, cliente_ws').eq('id', c.id).eq('workspace_id', c.workspace_id).maybeSingle();
    if (error) throw new Error(error.message);
    const par = data as { agencia_ws: number | null; cliente_ws: number | null } | null;
    const agenciaWs = Number(par?.agencia_ws);
    const clienteWs = Number(par?.cliente_ws);
    if (!esWsValido(agenciaWs) || !esWsValido(clienteWs)) return;
    const { data: aprobada, error: e2 } = await db.from('agencia_clientes')
      .update({ estado: 'aprobado', decidido_por: `pago:${c.proveedor}`, decidido_at: new Date().toISOString(), motivo: null })
      .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).eq('estado', 'pendiente')
      .select('cliente_ws').maybeSingle();
    if (e2) throw new Error(e2.message);
    if (!aprobada) return; // ya estaba aprobada (otro aviso llegó primero), o revocada: no se toca
    const aviso = await avisarClienteAprobado(clienteWs);
    if (aviso.tono === 'warn') console.warn(`[agencia] cliente ${clienteWs} habilitado por el pago del cobro ${c.id}: ${aviso.texto}`);
  } catch (e) {
    console.error(`[agencia] no pude habilitar al cliente del cobro ${c.id}:`, e instanceof Error ? e.message : String(e));
  }
}
