// =============================================================================
// actividad-registro — los dos escritores de la medición de uso (mig 0398, Admin › Activity, 5/11/2026)
// =============================================================================
// Aparte de lib/actividad.ts (el lector) para que el choke point de la API de MaKo (lib/api-mako/ejecutar.ts) no cargue
// lo que lee la pantalla de Admin. Los dos NUNCA rompen lo que la persona estaba haciendo: no tiran, no se esperan, y un
// error queda en la consola (un registro que falla no es un error de la persona).
//   · `registrarActividad`: el lote del navegador (app/_components/MedidorDeUso.tsx → POST /api/actividad), que suma
//     pantallas y acciones por persona, tab y día con `sumar_actividad` (atómica);
//   · `registrarAccionMako`: cada operación de la API de MaKo (los tres canales pasan por ejecutarOperacion).
// ⚠️ SIN CONTENIDO: la tab, el id de la operación, el canal y si salió. Nunca la URL, ni los parámetros, ni un texto.
// ⚠️ NO SE MIDE lo que corre en el negocio de la plataforma (el super admin global lo corta la ruta, antes).
// ⚠️ EL DÍA ES EL DE LA PLATAFORMA (su zona, en memoria 10 minutos): «hoy» en Admin es el día de Martín, no el UTC.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { zonaDelNegocio } from './timezone';
import { hoyEnTz } from './date-utils';
import type { EntradaLote } from './actividad-reglas';

let zonaEnMemoria: { tz: string; hasta: number } | null = null;
export async function hoyDeLaPlataforma(ahora = new Date()): Promise<string> {
  if (!zonaEnMemoria || zonaEnMemoria.hasta < ahora.getTime()) {
    const tz = await zonaDelNegocio(await wsSuperAdmin()).catch(() => 'UTC');
    zonaEnMemoria = { tz, hasta: ahora.getTime() + 10 * 60_000 };
  }
  return hoyEnTz(zonaEnMemoria.tz, ahora);
}

/** ¿Falta la tabla (la migración no se aplicó)? Es un «todavía no hay datos», no un error. */
export const faltaLaTabla = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message ?? ''));

/** Suma un lote del navegador. Nunca tira. */
export async function registrarActividad(usuarioId: number, ws: number | null, lote: readonly EntradaLote[]): Promise<void> {
  try {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0 || lote.length === 0) return;
    if (ws != null && ws === (await wsSuperAdmin())) return;
    const dia = await hoyDeLaPlataforma();
    const db = getSupabaseServer();
    for (const e of lote) {
      const { error } = await db.rpc('sumar_actividad', { p_dia: dia, p_usuario: usuarioId, p_ws: ws, p_tab: e.tab, p_pantallas: e.pantallas, p_acciones: e.acciones });
      if (error) { if (!faltaLaTabla(error)) console.error('[actividad] no pude sumar el lote:', error.message); return; }
    }
  } catch (e) {
    console.error('[actividad] no pude sumar el lote:', e instanceof Error ? e.message : String(e));
  }
}

/** Lo que hizo MaKo (una operación de la API). Nunca tira y nadie lo espera. */
export function registrarAccionMako(a: { ws: number; usuario: string | null | undefined; operacion: string; area: string | null; canal: string; tipo: 'lectura' | 'accion' | 'control'; ok: boolean }): void {
  void (async () => {
    try {
      if (a.ws === (await wsSuperAdmin())) return;
      const usuario = a.usuario && /^\d+$/.test(a.usuario) ? Number(a.usuario) : null;
      const { error } = await getSupabaseServer().from('actividad_acciones').insert({
        usuario_id: usuario, workspace_id: a.ws, operacion: a.operacion.slice(0, 80), area: a.area?.slice(0, 40) ?? null,
        canal: a.canal.slice(0, 20), tipo: a.tipo, ok: a.ok,
      });
      if (error && !faltaLaTabla(error)) console.error('[actividad] no pude anotar la acción de MaKo:', error.message);
    } catch (e) {
      console.error('[actividad] no pude anotar la acción de MaKo:', e instanceof Error ? e.message : String(e));
    }
  })();
}

