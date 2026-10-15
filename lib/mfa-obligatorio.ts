// =============================================================================
// mfa-obligatorio — desde cuándo un NEGOCIO exige el segundo factor (14/10/2026)
// =============================================================================
// Pedido de Martín: el 2FA obligatorio para TODOS, con plazo. No se desloguea a nadie a
// una hora: el negocio guarda una FECHA (`workspaces.mfa_obligatorio_desde`, mig 0283) y
// `requiereSegundoFactor` (lib/mfa-reglas.ts) la calcula en cada pedido. La escribe la
// acción «Exigir el 2FA desde una fecha» del registro de la API (área equipo, sólo la
// plataforma), que corre una automatización de SuperAdmin.
//
// La leen tres lugares, y los tres por acá: el login (callback de Google), la sesión de cada
// pedido (`getUsuarioActual`) y /perfil/seguridad.
//
// ⚠️ LA LECTURA NO TIRA y, si falla, contesta «no exige». Es la política de
// `getUsuarioActual` (fail-open ante la base caída para no desloguear a todos por un
// error transitorio), y se corrige sola: el próximo pedido que lea bien la vuelve a pedir.
// Una columna que todavía no existe (el código desplegado antes que la 0281) también es
// «no exige», y así ese orden de despliegue no deja afuera a nadie.
// =============================================================================

import 'server-only';
import { cache } from 'react';
import { getSupabaseServer } from './supabase';

/** La fecha (ISO) desde la que el negocio exige el 2FA, o null. Memoizada por pedido. */
export const obligatorioDesdeDe = cache(async (ws: number | null | undefined): Promise<string | null> => {
  if (ws == null || !Number.isInteger(ws) || ws <= 0) return null;
  try {
    const { data, error } = await getSupabaseServer()
      .from('workspaces').select('mfa_obligatorio_desde').eq('id', ws).maybeSingle();
    if (error) {
      if (!/mfa_obligatorio_desde/.test(error.message)) console.error(`[mfa] no pude leer la exigencia del ws ${ws}:`, error.message);
      return null;
    }
    return (data as { mfa_obligatorio_desde?: string | null } | null)?.mfa_obligatorio_desde ?? null;
  } catch (e) {
    console.error(`[mfa] no pude leer la exigencia del ws ${ws}:`, e instanceof Error ? e.message : e);
    return null;
  }
});

export type ExigenciaNegocio = {
  ws: number; nombre: string; desde: string | null;
  /** usuarios que entran (no suspendidos) y cuántos de ellos todavía no tienen un factor */
  usuarios: number; sinSegundoFactor: number;
};

/**
 * El estado de TODOS los negocios: la fecha y cuántos usuarios quedarían afuera hasta enrolar.
 * Lo usan la lectura y el «preparar» de la acción. TIRA si no puede leer: ahí un cero
 * inventado se leería como «nadie queda afuera».
 */
export async function exigenciasPorNegocio(): Promise<ExigenciaNegocio[]> {
  const sb = getSupabaseServer();
  const [ws, us, mfa, pk] = await Promise.all([
    sb.from('workspaces').select('id, nombre, mfa_obligatorio_desde').order('id'),
    sb.from('usuarios').select('id, workspace_id, estado'),
    sb.from('usuario_mfa').select('usuario_id, totp_activo, whatsapp_activo, email_activo'),
    sb.from('usuario_passkeys').select('usuario_id'),
  ]);
  for (const r of [ws, us, mfa, pk]) if (r.error) throw new Error(r.error.message);
  // Lo mismo que cuenta `cantidadFactores` (lib/mfa.ts): los códigos de recuperación no son un método.
  const conFactor = new Set<number>([
    ...((mfa.data ?? []) as Array<{ usuario_id: number; totp_activo: boolean; whatsapp_activo: boolean; email_activo: boolean }>)
      .filter((f) => f.totp_activo || f.whatsapp_activo || f.email_activo).map((f) => f.usuario_id),
    ...((pk.data ?? []) as Array<{ usuario_id: number }>).map((p) => p.usuario_id),
  ]);
  const usuarios = ((us.data ?? []) as Array<{ id: number; workspace_id: number | null; estado: string | null }>)
    .filter((u) => u.estado !== 'suspendido' && u.workspace_id != null);
  return ((ws.data ?? []) as Array<{ id: number; nombre: string | null; mfa_obligatorio_desde: string | null }>).map((w) => {
    const suyos = usuarios.filter((u) => u.workspace_id === w.id);
    return {
      ws: w.id, nombre: w.nombre ?? `#${w.id}`, desde: w.mfa_obligatorio_desde ?? null,
      usuarios: suyos.length, sinSegundoFactor: suyos.filter((u) => !conFactor.has(u.id)).length,
    };
  });
}

/** Escribe la fecha de cada negocio (null = deja de exigir). Devuelve cuántos cambió. */
export async function fijarObligatorioDesde(asignaciones: ReadonlyArray<{ ws: number; desde: string | null }>): Promise<number> {
  const sb = getSupabaseServer();
  let n = 0;
  for (const a of asignaciones) {
    const { data, error } = await sb.from('workspaces').update({ mfa_obligatorio_desde: a.desde }).eq('id', a.ws).select('id');
    if (error) throw new Error(`ws ${a.ws}: ${error.message}`);
    n += (data ?? []).length;
  }
  return n;
}
