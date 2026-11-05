// =============================================================================
// actividad — medir el uso de MaKo (mig 0398) y leerlo para Admin › Activity (5/11/2026)
// =============================================================================
// Las cuentas, en lib/actividad-reglas.ts; los dos escritores, en lib/actividad-registro.ts. Acá, el lector,
// `vistaDeActividad`, que cruza negocios: sólo el super admin (lo pregunta quien llama).
//
// ⚠️ SIN CONTENIDO (AGENTS.md, el encargo): la tab, el id de la operación, el canal y si salió. Nunca la URL (trae ids), ni
//    los parámetros, ni un texto.
// ⚠️ NO SE MIDE: el super admin global (su uso no es de un negocio y, mirando a un cliente, ensuciaría el del cliente) ni lo
//    que corre en el negocio de la plataforma.
// ⚠️ EL DÍA ES EL DE LA PLATAFORMA (su zona, `zonaDelNegocio(wsSuperAdmin())`, en memoria 10 minutos): «hoy» en Admin es el
//    día de Martín, no el UTC.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { leerPorPaginas } from './supabase-paginado';
import { listarWorkspaces, wsSuperAdmin } from './workspace';
import { porId } from './api-mako/registro';
import { listarUsuarios } from './usuarios';
import { faltaLaTabla, hoyDeLaPlataforma } from './actividad-registro';
import type { FilaUso, Persona } from './actividad-reglas';

/** Lo que hizo MaKo: `titulo` es el de la operación en el registro (lo que se lee), `operacion` su id (para la API). */
export type AccionMako = { creado: string; usuario: number | null; ws: number | null; operacion: string; titulo: string; area: string | null; canal: string; tipo: string; ok: boolean };

export type VistaActividad = {
  hoy: string;
  /** `false` = la migración 0398 no está: no hay medición todavía (se dice, y lo de `ultimo_login` igual se muestra). */
  medido: boolean;
  /** El primer día con datos (desde cuándo se mide). */
  desde: string | null;
  filas: FilaUso[];
  acciones: AccionMako[];
  personas: Persona[];
  nombres: Record<number, string>;
  avisos: string[];
};

/** Cuántos días de uso se leen: el ciclo de vida mira 8 semanas, más la anterior. */
export const DIAS_LEIDOS = 70;

export async function vistaDeActividad(ahora = new Date()): Promise<VistaActividad> {
  const db = getSupabaseServer();
  const avisos: string[] = [];
  const hoy = await hoyDeLaPlataforma(ahora);
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - DIAS_LEIDOS * 86_400_000).toISOString().slice(0, 10);
  let medido = true;
  const filas: FilaUso[] = [];
  try {
    await leerPorPaginas<{ dia: string; usuario_id: number; workspace_id: number | null; tab: string; pantallas: number; acciones: number }>(
      db, 'actividad_uso', 'dia, usuario_id, workspace_id, tab, pantallas, acciones',
      (pag) => { for (const f of pag) filas.push({ dia: String(f.dia), usuario: Number(f.usuario_id), ws: f.workspace_id == null ? null : Number(f.workspace_id), tab: f.tab, pantallas: Number(f.pantallas) || 0, acciones: Number(f.acciones) || 0 }); },
      { filtros: (q) => q.gte('dia', desde), orden: ['dia', 'usuario_id', 'tab'] },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (faltaLaTabla({ message: msg })) medido = false; else avisos.push(`el uso por pantalla: ${msg}`);
  }
  let acciones: AccionMako[] = [];
  if (medido) {
    const { data, error } = await db.from('actividad_acciones').select('creado, usuario_id, workspace_id, operacion, area, canal, tipo, ok')
      .order('creado', { ascending: false }).limit(100);
    if (error) { if (!faltaLaTabla(error)) avisos.push(`lo que hizo MaKo: ${error.message}`); }
    else acciones = (data ?? []).map((a: Record<string, unknown>) => ({
      creado: String(a.creado), usuario: a.usuario_id == null ? null : Number(a.usuario_id), ws: a.workspace_id == null ? null : Number(a.workspace_id),
      operacion: String(a.operacion), titulo: porId(String(a.operacion))?.titulo ?? String(a.operacion), area: (a.area as string | null) ?? null, canal: String(a.canal), tipo: String(a.tipo), ok: a.ok === true,
    }));
  }
  const [usuarios, wss, plataforma] = await Promise.all([
    listarUsuarios().catch((e) => { avisos.push(`las personas: ${e instanceof Error ? e.message : String(e)}`); return []; }),
    listarWorkspaces().catch((e) => { avisos.push(`los nombres de los negocios: ${e instanceof Error ? e.message : String(e)}`); return []; }),
    wsSuperAdmin().catch(() => null),
  ]);
  const nombres: Record<number, string> = {};
  for (const w of wss) nombres[w.id] = w.nombre;
  // Las personas de la plataforma (el equipo de MaKo) no se miden: no son uso de un negocio.
  const personas: Persona[] = usuarios.filter((u) => plataforma == null || u.workspace_id !== plataforma).map((u) => ({
    id: u.id, nombre: u.nombre, email: u.email, ws: u.workspace_id, negocio: u.workspace_id != null ? (nombres[u.workspace_id] ?? null) : null,
    creado: u.created_at, ultimoLogin: u.ultimo_login, rol: u.rol, estado: u.estado,
  }));
  const primero = filas.reduce<string | null>((m, f) => (m == null || f.dia < m ? f.dia : m), null);
  return { hoy, medido, desde: primero, filas, acciones, personas, nombres, avisos };
}
