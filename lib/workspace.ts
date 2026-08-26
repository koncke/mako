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
import { cookies, headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase';
import { getSesionAdmin, getUsuarioActual } from './auth';
import { CAPA_DEFAULT, capaDef, esCapaValida, type CapaId } from './capas';
import { IMPERSONATE_COOKIE, LEGACY_COOKIE, OWNER_WS, SESSION_COOKIE, firmarImpersonacion, leerImpersonacion, type RolWorkspace } from './auth-session';
import { WS_HEADER, conWs, parseWs } from './ws-tab';

export { firmarImpersonacion, IMPERSONATE_COOKIE, OWNER_WS };

/**
 * El workspace de ESTA pestaña, si el super admin abrió un cliente con `?ws=N`.
 *
 * Lo pone `proxy.ts` como header interno DESPUÉS de verificar contra la sesión
 * firmada que quien pide es admin de agencia — y lo borra en cada request antes
 * de decidir. Acá se lee y ya: si el header está, es porque el proxy lo puso.
 * Nunca leer `?ws=` directo de la URL en el resto de la app: eso saltearía la
 * validación y sería un IDOR.
 *
 * Gana sobre la cookie de impersonación porque es lo que el usuario está mirando
 * AHORA en esta pestaña; la cookie es del navegador entero y no distingue.
 */
async function wsDePestana(): Promise<number | null> {
  return parseWs((await headers()).get(WS_HEADER));
}

/**
 * Un destino interno CON el `?ws=` de esta pestaña. **Para todo `redirect()` del server.**
 *
 * ⚠️ `redirect('/loquesea')` PIERDE la pestaña, y el modo en que falla no se parece a un
 * bug: te deja mirando OTRA cuenta. El caso que lo destapó — el dueño abrió el Cliente de
 * Prueba, el guard del onboarding lo mandó a `redirect('/onboarding')` sin el `?ws=`, y
 * aterrizó en SU propio onboarding, sin barra de agencia y sin forma de volver a entrar.
 * Desde afuera se lee como «la app se rompió», no como «me cambió de cliente».
 *
 * El repo ya tenía la regla escrita para links y `fetch` (`app/_ui/Link`, `WsFetch`), y le
 * faltaba justo la tercera forma de navegar. Un redirect ES navegación.
 *
 * Devuelve el href intacto cuando no hay pestaña, así que ponerlo de más no cuesta nada:
 * para un cliente normal —que nunca tiene `?ws=`— es exactamente el string de antes.
 */
export async function rutaConWs(href: string): Promise<string> {
  return conWs(href, await wsDePestana());
}

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
  // `agente_sesiones` va acá para que el CLIENTE, cuando mire su propio panel de «lo
  // que tu agente le contó a MaKo», vea solo lo suyo. El panel del DUEÑO la lee con
  // el cliente de servicio y sin scope, a propósito: es el único lugar del sistema
  // donde el aislamiento se cruza, y está declarado en la migración 0124.
  'agente_sesiones',
  'archivero_files',
  'ad_transcripts', 'adset_budget_daily', 'anthropic_usage', 'chart_chats', 'chart_sessions',
  'chat_agent_handoffs',
  'closing_analyses', 'closing_jobs', 'creative_transcripts', 'cs_clientes', 'cs_respuestas', 'email_broadcast_envios', 'email_broadcasts', 'evolution_contactos', 'evolution_instancias', 'evolution_labels', 'evolution_stage_labels', 'experimento_tareas',
  'experimentos', 'flow_puentes', 'flow_trabajos', 'landing_analyses', 'landing_drafts', 'landing_visits', 'lead_audit', 'leads', 'marketing_metrics_daily',
  'identidades_fiscales', 'lead_insights', 'lead_respuestas', 'mako_acciones_pendientes', 'mako_confirmaciones', 'mako_doer_buffer', 'mako_doer_conv', 'mako_doer_lock', 'mako_knowledge', 'meta_health_history', 'nutricion_envios', 'nutricion_inscripciones', 'nutricion_secuencias', 'pagos',
  'pipeline_stages', 'plan_dependencias', 'plan_propuestas', 'plan_reprios', 'propuestas', 'plan_proyectos', 'plan_tareas', 'productos', 'retros', 'review_queue', 'script_analyses', 'script_drafts', 'service_incidents', 'setting_audios',
  'tarea_categorias', 'vsl_events', 'wa_bloqueados', 'wa_borradores', 'wa_mensajes', 'wa_ocultos', 'whatsapp_template_drafts', 'workspace_telefonos',
  // Canal Instagram vía Zernio (mig 0136). zernio_workspace es el mapeo
  // ws→profile: lib/zernio.ts lo lee con el cliente crudo y ws EXPLÍCITO (corre
  // en webhooks/crons), pero va acá igual para que cualquier lectura por
  // getTenantDb quede scopeada.
  'contenido_posts', 'ig_conversaciones', 'ig_mensajes', 'zernio_workspace',
  // Vistas de cohortes: getTenantDb NO scopea vistas por sí solo, pero estas
  // exponen workspace_id (mig 0084) y solo se LEEN (select) → el proxy inyecta
  // .eq('workspace_id', ws) y corta el leak del agregado global. OJO: scripts de
  // mantenimiento owner-side que las lean con `sql` crudo verán todos los ws.
  'v_cohortes_semanales', 'v_cohortes_mensuales',
]);

// Resolución desde cookies (memoizada por request). Solo se llama FUERA de
// unstable_cache; adentro se usa el AsyncLocalStorage.
const resolverDesdeCookies = cache(async (): Promise<number | null> => {
  const sesion = await getUsuarioActual();
  if (sesion) {
    if (sesion.legacy) return OWNER_WS;        // login compartido viejo / dev → dueño
    if (sesion.rol === 'admin') {
      // 1) LA PESTAÑA manda. `?ws=N` es lo que el admin está mirando acá y ahora,
      //    y es lo único que le permite tener varios clientes abiertos a la vez.
      const pestana = await wsDePestana();
      if (pestana) return pestana;
      // 2) La cookie de impersonación, que es del navegador ENTERO. Queda por las
      //    sesiones que ya la tienen puesta; la UI no la escribe más.
      const store = await cookies();
      const imp = leerImpersonacion(store.get(IMPERSONATE_COOKIE)?.value);
      // 3) Si no hay nada, el admin cae a SU PROPIO workspace (si tiene uno
      //    asignado) → un super-admin con espacio propio entra a lo suyo por
      //    default, sin pisar al dueño. null solo si el admin no tiene workspace
      //    → ve el panel /admin (contrato de siempre).
      return imp ?? sesion.ws ?? null;
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

/**
 * Guard para acciones de la AGENCIA sobre su propia cuenta: mover plata en Meta,
 * leer el gasto de IA, conectar la agenda del dueño.
 *
 * Por qué NO alcanza esWorkspaceDueno() a secas: solo dice "el workspace actual
 * es el principal", y NO mira el rol. El workspace principal tiene closers y
 * setters adentro (ws1 tiene 3 cuentas), así que cualquiera de ellos pasaba ese
 * gate y llegaba a publicar, pausar, renombrar, cambiar presupuesto y BORRAR
 * campañas con plata puesta. No es cross-tenant: es plata real.
 *
 * Pasan dos: el admin de la agencia (aunque no impersone) y el admin del
 * workspace principal. Un closer/setter, no.
 *
 * Vive acá y no copiado en cada ruta a propósito: el bug fue justamente que el
 * chequeo del rol estaba en UN solo lugar (/api/anthropic-usage) y las otras 14
 * puertas se olvidaron de repetirlo.
 */
export async function esDuenoAdmin(): Promise<boolean> {
  if (await getSesionAdmin()) return true;
  return (await esWorkspaceDueno()) && (await getRolWsEfectivo()) === 'admin';
}

/** true si un admin está metido adentro de un cliente, en ESTA pestaña.
 *  Sirve para distinguir "admin viendo su propio panel" de "admin metido en un
 *  cliente": p.ej. el board /plan muestra el PlanBoard del dueño solo si NO impersona,
 *  y el tablero del cliente (incl. Mauricio/ws1) cuando sí.
 *
 *  ⚠️ Tiene que mirar lo MISMO que `getWorkspaceActual`, y en el mismo orden. Si
 *  uno mirara la pestaña y el otro solo la cookie, la app quedaría mostrando los
 *  datos de un cliente con el chrome del panel de admin (o al revés), que es la
 *  clase de incoherencia que nadie reporta como bug: se lee como "se ve raro". */
export async function estaImpersonando(): Promise<boolean> {
  const sesion = await getUsuarioActual();
  if (sesion?.rol !== 'admin') return false;
  if (await wsDePestana()) return true;
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
  /** Qué capa de la oferta compró (mig 0092). El catálogo vive en lib/capas.ts. */
  capa: CapaId;
  created_at: string;
};

const WS_COLS = 'id, nombre, slug, estado, capa, created_at';

export async function listarWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await getSupabaseServer()
    .from('workspaces').select(WS_COLS).order('id', { ascending: true });
  if (error) throw new Error(`workspaces: ${error.message}`);
  return (data ?? []) as Workspace[];
}

/**
 * El workspace del SUPER-ADMIN, resuelto por su capa y no por un número.
 *
 * OJO CON `OWNER_WS`: vale 1 y ese es **Mauricio, un cliente** — el nombre engaña y ya
 * se llevó puestas varias cosas. El tablero de desarrollo, las credenciales de la
 * plataforma y el catálogo de proyectos del producto viven en el workspace con
 * `capa: 'superadmin'`, que hoy es el 9.
 *
 * Se resuelve por capa a propósito: si mañana ese id cambia, esto sigue andando, y el
 * que lo lee entiende POR QUÉ es ese y no otro.
 */
let cacheSuper: number | null = null;
export async function wsSuperAdmin(): Promise<number> {
  if (cacheSuper != null) return cacheSuper;
  const { data } = await getSupabaseServer()
    .from('workspaces').select('id').eq('capa', 'superadmin').order('id').limit(1).maybeSingle();
  // Sin fila con esa capa el fallback es 9, que es el que existe hoy: es preferible
  // eso a devolver OWNER_WS y terminar leyendo las credenciales de un cliente.
  cacheSuper = Number((data as { id?: unknown } | null)?.id ?? 9);
  return cacheSuper;
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

export async function crearWorkspace(nombre: string, capa: CapaId = CAPA_DEFAULT): Promise<Workspace> {
  // Fail-closed: una capa inventada haría que el gating la trate como 'completo'
  // (capaDef cae al default) y el cliente vería tabs que no compró.
  if (!esCapaValida(capa)) throw new Error(`capa inválida: ${capa}`);
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .insert({ nombre: nombre.trim(), slug: slugify(nombre), estado: 'activo', capa })
    .select(WS_COLS).single();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return data as Workspace;
}

/**
 * Capa del workspace ACTUAL — de acá salen las tabs visibles, los pasos del
 * onboarding y los seeds. Sin workspace (agencia sin impersonar, cron) → la capa
 * completa: el dueño ve todo. `cache` = una sola query por request.
 */
export const getCapaActual = cache(async (): Promise<CapaId> => {
  const ws = await getWorkspaceActual();
  if (ws == null) return CAPA_DEFAULT;
  const { data } = await getSupabaseServer()
    .from('workspaces').select('capa').eq('id', ws).maybeSingle();
  return capaDef((data as { capa?: string } | null)?.capa).id;
});

export async function actualizarWorkspace(
  id: number, patch: Partial<Pick<Workspace, 'nombre' | 'estado' | 'capa'>>,
): Promise<Workspace> {
  if (patch.capa != null && !esCapaValida(patch.capa)) throw new Error(`capa inválida: ${patch.capa}`);
  const { data, error } = await getSupabaseServer()
    .from('workspaces')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).select(WS_COLS).single();
  if (error) throw new Error(`workspaces: ${error.message}`);
  return data as Workspace;
}
