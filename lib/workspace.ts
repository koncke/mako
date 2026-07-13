// =============================================================================
// workspace — aislamiento multi-inquilino de la capa de datos
// =============================================================================
// getWorkspaceActual() resuelve QUÉ workspace ve el request; getTenantDb()
// devuelve un cliente Supabase que auto-filtra por ese workspace. El scoping
// vive acá (un solo lugar) en vez de recordar .eq('workspace_id') en 300+
// queries: el service_role bypassa RLS, así que la frontera es de la app.
//
// Resolución del workspace (getWorkspaceActual):
//   · usuario logueado            → su workspace_id
//   · admin impersonando          → el workspace de la cookie mako_ws
//   · admin SIN impersonar        → null  (ve el panel /admin, no data de nadie)
//   · sesión legacy / dev         → workspace 1 (dueño = Mauricio)
//   · sin sesión (cron/webhook)   → workspace 1 (dueño)
//
// getTenantDb() aplica ese workspace: filtra los SELECT/UPDATE/DELETE y estampa
// los INSERT/UPSERT de las tablas de datos. Si el workspace es null (admin sin
// impersonar) → fail-closed: 0 filas en lecturas, error de FK en escrituras.

import 'server-only';
import { cache } from 'react';
import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase';
import { getUsuarioActual } from './auth';
import { IMPERSONATE_COOKIE, LEGACY_COOKIE, OWNER_WS, SESSION_COOKIE, firmarImpersonacion, leerImpersonacion, type RolWorkspace } from './auth-session';

export { firmarImpersonacion, IMPERSONATE_COOKIE, OWNER_WS };

// Contexto de workspace por-request. Lo usa la caché (lib/cache.ts): dentro de
// unstable_cache NO se puede llamar cookies(), así que el workspace se fija acá
// antes de ejecutar la lectura cacheada y getWorkspaceActual lo lee de acá.
const wsStore = new AsyncLocalStorage<number | null>();
export function runWithWorkspace<T>(ws: number | null, fn: () => T): T {
  return wsStore.run(ws, fn);
}

// Tablas de datos por-cliente que el proxy scopea. app_settings, funnel_config
// y credenciales NO están acá: se manejan con scoping explícito en sus libs
// (settings.ts, leads.ts, credenciales.ts) por su semántica de key/singleton.
const TENANT_TABLES = new Set<string>([
  'ad_transcripts', 'adset_budget_daily', 'anthropic_usage', 'chart_chats', 'chart_sessions',
  'closing_analyses', 'email_broadcast_envios', 'email_broadcasts', 'evolution_contactos', 'evolution_instancias', 'evolution_labels', 'evolution_stage_labels', 'experimento_tareas',
  'experimentos', 'landing_visits', 'lead_audit', 'leads', 'marketing_metrics_daily',
  'identidades_fiscales', 'lead_insights', 'lead_respuestas', 'mako_confirmaciones', 'mako_knowledge', 'meta_health_history', 'nutricion_envios', 'nutricion_inscripciones', 'nutricion_secuencias', 'pagos',
  'pipeline_stages', 'retros', 'review_queue', 'script_analyses', 'script_drafts',
  'tarea_categorias', 'vsl_events', 'wa_bloqueados', 'wa_borradores', 'wa_mensajes', 'wa_ocultos', 'whatsapp_template_drafts', 'workspace_telefonos',
]);

// Resolución desde cookies (memoizada por request). Solo se llama FUERA de
// unstable_cache; adentro se usa el AsyncLocalStorage.
const resolverDesdeCookies = cache(async (): Promise<number | null> => {
  const sesion = await getUsuarioActual();
  if (sesion) {
    if (sesion.legacy) return OWNER_WS;        // login compartido viejo / dev → dueño
    if (sesion.rol === 'admin') {
      const store = await cookies();
      return leerImpersonacion(store.get(IMPERSONATE_COOKIE)?.value); // ws o null
    }
    return sesion.ws ?? null;                   // usuario → su workspace
  }
  // Sin sesión resuelta: distinguir "no hay cookie de sesión" (cron / webhook /
  // público → dueño) de "hay cookie pero su fila ya no vale" (usuario suspendido
  // o eliminado cuyo token sigue firmado → FAIL-CLOSED: nunca caer al dueño).
  const store = await cookies();
  const tieneCookieSesion = Boolean(store.get(SESSION_COOKIE)?.value || store.get(LEGACY_COOKIE)?.value);
  return tieneCookieSesion ? null : OWNER_WS;
});

/** Workspace efectivo del request, o null si un admin no está impersonando. */
export async function getWorkspaceActual(): Promise<number | null> {
  const enContexto = wsStore.getStore();
  if (enContexto !== undefined) return enContexto; // dentro de la caché
  return resolverDesdeCookies();
}

/**
 * true si el request opera sobre el workspace dueño (Mauricio). En Fase 1 las
 * integraciones (Meta/Chatwoot/etc.) son globales del dueño: las vistas EN VIVO
 * (WhatsApp, insights de Meta) solo se sirven al dueño para no filtrarle sus
 * datos a un cliente nuevo. Las integraciones por-cliente son Fase 2.
 */
export async function esWorkspaceDueno(): Promise<boolean> {
  return (await getWorkspaceActual()) === OWNER_WS;
}

/** true si un admin está impersonando a un cliente (cookie de impersonación activa).
 *  Sirve para distinguir "admin viendo su propio panel" de "admin metido en un
 *  cliente": p.ej. el board /plan muestra el PlanBoard del dueño solo si NO impersona,
 *  y el tablero del cliente (incl. Mauricio/ws1) cuando sí. */
export async function estaImpersonando(): Promise<boolean> {
  const sesion = await getUsuarioActual();
  if (sesion?.rol !== 'admin') return false;
  const store = await cookies();
  return leerImpersonacion(store.get(IMPERSONATE_COOKIE)?.value) != null;
}

/**
 * Rol EFECTIVO dentro del workspace que ve el request, para gatear tabs:
 *   · admin de agencia (impersonando o no) → 'admin' (acceso total a las tabs;
 *     el aislamiento de DATOS lo hace getWorkspaceActual, no este rol)
 *   · owner / legacy / dev                 → 'admin'
 *   · usuario cliente                      → su rol_ws (null → 'admin' por backfill)
 *   · sin sesión                           → null
 * OJO: es distinto del rol GLOBAL. Un admin-cliente devuelve 'admin' pero jamás
 * ve el shell /admin de la agencia (eso lo decide el rol GLOBAL en el Sidebar).
 */
export async function getRolWsEfectivo(): Promise<RolWorkspace | null> {
  const sesion = await getUsuarioActual();
  if (!sesion) return null;
  if (sesion.legacy) return 'admin';
  if (sesion.rol === 'admin') return 'admin';
  return sesion.rolWs ?? 'admin';
}

/**
 * Cliente Supabase con scoping automático por workspace. Drop-in de
 * getSupabaseServer() para las libs de datos por-cliente.
 */
export async function getTenantDb(): Promise<SupabaseClient> {
  const ws = await getWorkspaceActual();
  return scopedClient(getSupabaseServer(), ws);
}

function scopedClient(real: SupabaseClient, ws: number | null): SupabaseClient {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => scopedFrom(target.from(table), table, ws);
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  }) as SupabaseClient;
}

// Estampa/filtra por workspace en el query builder de una tabla tenant.
// ws null (admin sin impersonar) → id imposible: lecturas vacías, escrituras
// fallan por FK (fail-closed). Tablas no-tenant → passthrough sin tocar.
type Chain = { eq: (c: string, v: unknown) => Chain };
type QB = ReturnType<SupabaseClient['from']>;
function scopedFrom(builder: QB, table: string, ws: number | null): QB {
  if (!TENANT_TABLES.has(table)) return builder;
  const wsId = ws ?? -1;
  const b = builder as unknown as {
    select: (...a: unknown[]) => Chain;
    insert: (rows: unknown, opts?: unknown) => unknown;
    upsert: (rows: unknown, opts?: unknown) => unknown;
    update: (vals: unknown, opts?: unknown) => Chain;
    delete: (opts?: unknown) => Chain;
  };
  const stamp = (rows: unknown): unknown =>
    Array.isArray(rows)
      ? rows.map((r) => ({ ...(r as object), workspace_id: wsId }))
      : { ...(rows as object), workspace_id: wsId };

  const origSelect = b.select.bind(b);
  b.select = (...a: unknown[]) => origSelect(...a).eq('workspace_id', wsId);
  const origUpdate = b.update.bind(b);
  b.update = (vals: unknown, opts?: unknown) => origUpdate(vals, opts).eq('workspace_id', wsId);
  const origDelete = b.delete.bind(b);
  b.delete = (opts?: unknown) => origDelete(opts).eq('workspace_id', wsId);
  const origInsert = b.insert.bind(b);
  b.insert = (rows: unknown, opts?: unknown) => origInsert(stamp(rows), opts);
  const origUpsert = b.upsert.bind(b);
  b.upsert = (rows: unknown, opts?: unknown) => origUpsert(stamp(rows), opts);
  return builder;
}

// ── CRUD de workspaces (para el panel de admin, cliente crudo cross-workspace) ─

export type Workspace = {
  id: number;
  nombre: string;
  slug: string | null;
  estado: 'activo' | 'pausado';
  created_at: string;
};

const WS_COLS = 'id, nombre, slug, estado, created_at';

export async function listarWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces').select(WS_COLS).order('id', { ascending: true });
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data ?? []) as Workspace[];
}

export async function getWorkspace(id: number): Promise<Workspace | null> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces').select(WS_COLS).eq('id', id).maybeSingle();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data as Workspace | null) ?? null;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cliente';

export async function crearWorkspace(nombre: string): Promise<Workspace> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .insert({ nombre: nombre.trim(), slug: slugify(nombre), estado: 'activo' })
    .select(WS_COLS).single();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return data as Workspace;
}

export async function actualizarWorkspace(
  id: number, patch: Partial<Pick<Workspace, 'nombre' | 'estado'>>,
): Promise<Workspace> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select(WS_COLS).single();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return data as Workspace;
}
