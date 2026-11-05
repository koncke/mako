// =============================================================================
// admin-errores — el lector de Admin › Errors: los errores agrupados y los reportes (tickets) de todos los negocios (5/11/2026)
// =============================================================================
// Las reglas, en lib/admin-errores-reglas.ts. ⚠️ CRUZA NEGOCIOS: sólo el super admin (lo pregunta quien llama). Lee
// `errores_app` (ya saneado al guardarse: sin emails ni números largos, lib/errores-app-reglas.ts `sinDatos`), los tickets
// que esos errores abrieron y los últimos reportes de las personas. Nunca el contenido de un negocio.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { leerPorPaginas } from './supabase-paginado';
import { listarWorkspaces } from './workspace';
import { filaDeError, type FilaError } from './admin-errores-reglas';

/** Cuántos errores (los vistos más recientes) se leen: la lista es para mirar, no un archivo. */
export const TOPE_ERRORES = 500;
/** Cuántos reportes de personas se muestran. */
export const TOPE_REPORTES = 40;

export type Reporte = {
  id: number; titulo: string; tipo: string; estado: string; prioridad: string; canal: string;
  creado: string; quien: string; negocio: string | null; ws: number;
};

export type VistaErrores = {
  errores: FilaError[];
  /** Si había más de `TOPE_ERRORES` (se dice: no se cortan en silencio). */
  hayMas: boolean;
  reportes: Reporte[];
  nombres: Record<number, string>;
  avisos: string[];
};

export async function vistaDeErrores(): Promise<VistaErrores> {
  const db = getSupabaseServer();
  const avisos: string[] = [];
  type Fila = { id: number; titulo: string; origen: string; veces: number; primera_vez: string; ultima_vez: string; ejemplo: unknown; afectados: unknown; ticket_id: number | null };
  const filas: Fila[] = [];
  let hayMas = false;
  // Paginado y con tope a propósito (`false` corta: AGENTS.md, «El techo de 1000 filas»), los vistos más recientes primero.
  await leerPorPaginas<Fila>(db, 'errores_app', 'id, titulo, origen, veces, primera_vez, ultima_vez, ejemplo, afectados, ticket_id', (pag) => {
    for (const f of pag) { if (filas.length >= TOPE_ERRORES) { hayMas = true; return false; } filas.push(f); }
    return true;
  }, { orden: [{ col: 'ultima_vez', asc: false }, { col: 'id', asc: false }] });

  const ids = [...new Set(filas.map((f) => f.ticket_id).filter((x): x is number => x != null).map(Number))];
  const tickets = new Map<number, { estado: string; resuelto_at: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from('tickets').select('id, estado, resuelto_at').in('id', ids.slice(i, i + 200));
    if (error) { avisos.push(`el estado de los tickets: ${error.message}`); break; }
    for (const t of (data ?? []) as Array<{ id: number; estado: string; resuelto_at: string | null }>) tickets.set(Number(t.id), t);
  }

  const [reportesCrudos, wss] = await Promise.all([
    Promise.resolve(db.from('tickets').select('id, titulo, tipo, estado, prioridad, canal, created_at, usuario_nombre, usuario_email, workspace_id')
      .order('created_at', { ascending: false }).limit(TOPE_REPORTES))
      .then(({ data, error }) => { if (error) throw new Error(error.message); return (data ?? []) as Array<Record<string, unknown>>; })
      .catch((e: unknown) => { avisos.push(`los reportes: ${e instanceof Error ? e.message : String(e)}`); return [] as Array<Record<string, unknown>>; }),
    listarWorkspaces().catch((e) => { avisos.push(`los nombres de los negocios: ${e instanceof Error ? e.message : String(e)}`); return []; }),
  ]);
  const nombres: Record<number, string> = {};
  for (const w of wss) nombres[w.id] = w.nombre;
  const reportes: Reporte[] = reportesCrudos.map((t) => ({
    id: Number(t.id), titulo: String(t.titulo ?? ''), tipo: String(t.tipo ?? ''), estado: String(t.estado ?? ''),
    prioridad: String(t.prioridad ?? ''), canal: String(t.canal ?? ''), creado: String(t.created_at ?? ''),
    quien: String((t.usuario_nombre as string) || (t.usuario_email as string) || ''),
    negocio: nombres[Number(t.workspace_id)] ?? null, ws: Number(t.workspace_id),
  }));
  return {
    errores: filas.map((f) => filaDeError(f, f.ticket_id != null ? tickets.get(Number(f.ticket_id)) ?? null : null)),
    hayMas, reportes, nombres, avisos,
  };
}
