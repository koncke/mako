// =============================================================================
// notificaciones — el feed de avisos POR WORKSPACE (tabla notificaciones, mig 0250)
// =============================================================================
// Una fila por aviso o reporte que salió (o que el negocio apagó: el registro queda igual,
// ver lib/avisos.ts). Lo lee el «Avisos» del Inbox de MaKo Mobile por GET /api/notificaciones.
//
// ⚠️ CON `workspace_id`, SIEMPRE EXPLÍCITO. La 0048 (nunca aplicada) no lo tenía y aplicada
// habría mostrado a cada cliente los avisos de todos. Acá se escribe y se lee con el
// workspace que pasa quien llama —los dos escritores lo tienen en la mano: lib/avisos.ts y
// lib/notify.ts—, con `getSupabaseServer()` y el `.eq('workspace_id', ws)` a la vista, sin
// depender del contexto ni de TENANT_TABLES.
//
// ⚠️ EL LEÍDO ES POR PERSONA: una marca de agua en `usuarios.perfil.notifVistoHasta`
// (lib/perfil.ts). El booleano `leido` de la tabla quedó muerto (era uno por fila y lo
// compartía todo el equipo). También murió la cola de WhatsApp (`canal_wa`), que leía las
// filas de TODOS los workspaces: se borró con el WhatsApp oficial.
//
// Nunca rompe al caller (un fallo del feed no tumba un cron), pero tampoco calla: una tabla
// AUSENTE se loguea fuerte y distinto de un error cualquiera.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';

export type NotifSeveridad = 'info' | 'ok' | 'warn' | 'urgente';

export type Notificacion = {
  id: number;
  tipo: string;
  severidad: NotifSeveridad;
  titulo: string;
  descripcion: string | null;
  /** La ruta de ESCRITORIO que abre (el móvil la traduce con `rutaMovil`, lib/movil-rutas.ts). */
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  origen: string;
  createdAt: string;
};

type Row = {
  id: number;
  tipo: string;
  severidad: string;
  titulo: string;
  descripcion: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: unknown;
  origen: string | null;
  created_at: string;
};

const COLS = 'id, tipo, severidad, titulo, descripcion, link, entity_type, entity_id, payload, origen, created_at';

function rowToNotif(r: Row): Notificacion {
  return {
    id: Number(r.id),
    tipo: r.tipo,
    severidad: (['info', 'ok', 'warn', 'urgente'].includes(r.severidad) ? r.severidad : 'info') as NotifSeveridad,
    titulo: r.titulo,
    descripcion: r.descripcion,
    link: r.link,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {},
    origen: r.origen ?? 'sistema',
    createdAt: r.created_at,
  };
}

export type NuevaNotificacion = {
  /** El workspace DEL AVISO: el de quien lo va a leer (ver lib/avisos.ts, `alDueno`). */
  ws: number;
  tipo: string;
  severidad?: NotifSeveridad;
  titulo: string;
  descripcion?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  origen?: string;
};

// La TABLA que falta (PGRST205 de PostgREST, 42P01 de Postgres), no una columna.
const tablaAusente = (e: { code?: string } | null | undefined) => !!e && (e.code === 'PGRST205' || e.code === '42P01');

const g = globalThis as typeof globalThis & { __makoNotifSinTabla?: number };
function avisarSinTabla(donde: string) {
  // Una vez por minuto: un cron que emite 40 avisos no tiene que escupir 40 líneas iguales.
  const ahora = Date.now();
  if (g.__makoNotifSinTabla && ahora - g.__makoNotifSinTabla < 60_000) return;
  g.__makoNotifSinTabla = ahora;
  console.error(`[notificaciones] ⛔ ${donde}: NO EXISTE la tabla notificaciones (aplicar supabase/migrations/0250_notificaciones_ws.sql). El feed de avisos está escribiendo al vacío.`);
}

/** Inserta una notificación en el feed de `n.ws`. Devuelve el id, o null si falló (no lanza). */
export async function crearNotificacion(n: NuevaNotificacion): Promise<number | null> {
  if (!Number.isFinite(n.ws) || n.ws <= 0) {
    // Sin workspace no hay de quién es: escribirla sería la fuga de la 0048.
    console.error(`[notificaciones] crear sin workspace (${n.tipo}): no se escribe.`);
    return null;
  }
  try {
    const { data, error } = await getSupabaseServer()
      .from('notificaciones')
      .insert({
        workspace_id: n.ws,
        tipo: n.tipo,
        severidad: n.severidad ?? 'info',
        titulo: n.titulo,
        descripcion: n.descripcion ?? null,
        link: n.link ?? null,
        entity_type: n.entityType ?? null,
        entity_id: n.entityId ?? null,
        payload: n.payload ?? {},
        origen: n.origen ?? 'sistema',
      })
      .select('id')
      .single();
    if (error) {
      if (tablaAusente(error)) { avisarSinTabla(`crear ${n.tipo}`); return null; }
      throw new Error(error.message);
    }
    return Number((data as { id: number }).id);
  } catch (err) {
    console.error(`[notificaciones] crear ${n.tipo} (ws ${n.ws}) falló: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Los avisos del feed de `ws`, el más nuevo primero. `antesDe` pagina hacia atrás (un `createdAt`). */
export async function listNotificaciones(ws: number, opts: { limite?: number; antesDe?: string | null } = {}): Promise<Notificacion[]> {
  const limite = Math.min(Math.max(1, Math.floor(opts.limite ?? 30)), 100);
  try {
    let q = getSupabaseServer().from('notificaciones').select(COLS)
      .eq('workspace_id', ws)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .limit(limite);
    if (opts.antesDe && !Number.isNaN(Date.parse(opts.antesDe))) q = q.lt('created_at', opts.antesDe);
    const { data, error } = await q;
    if (error) {
      if (tablaAusente(error)) { avisarSinTabla('listar'); return []; }
      throw new Error(error.message);
    }
    return ((data ?? []) as Row[]).map(rowToNotif);
  } catch (err) {
    console.error(`[notificaciones] listar (ws ${ws}) falló: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Cuántos avisos de `ws` son posteriores a la marca de agua de la persona. Sin marca
 * (nunca abrió el feed) se cuentan los de la última semana: el feed empezó a escribirse el
 * 11/10/2026, y una persona que entra a un workspace con meses de historia no tiene por
 * qué arrancar con un número que no va a leer nunca.
 *
 * `null` = no se pudo contar (la pantalla no dibuja un 0 que no midió).
 */
export async function contarNoVistas(ws: number, vistoHasta: string | null): Promise<number | null> {
  const desde = vistoHasta && !Number.isNaN(Date.parse(vistoHasta))
    ? vistoHasta
    : new Date(Date.now() - 7 * 86_400_000).toISOString();
  try {
    const { count, error } = await getSupabaseServer()
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws)
      .gt('created_at', desde);
    if (error) {
      // ⚠️ Con `head: true` una tabla inexistente contesta `count: null`, que se leería como
      // «vacía». Por eso se mira el error y se devuelve null, nunca 0.
      if (tablaAusente(error)) { avisarSinTabla('contar'); return null; }
      throw new Error(error.message);
    }
    return count ?? null;
  } catch (err) {
    console.error(`[notificaciones] contar (ws ${ws}) falló: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
