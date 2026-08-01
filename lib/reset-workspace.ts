// =============================================================================
// reset-workspace — dejar un workspace de prueba como recién creado
// =============================================================================
// Vacía TODO lo que un cliente puede haber generado: sus tablas, su
// configuración, sus credenciales, sus archivos y su sesión de WhatsApp. Lo que
// NO toca, nunca: la fila del workspace, sus usuarios y sus roles — si se
// fueran, el cliente de prueba quedaría inaccesible y habría que crearlo de nuevo.
//
// Tres cinturones para que jamás corra contra el dueño:
//   1. Este archivo tira si el destino es OWNER_WS, antes de mirar nada más.
//   2. La ruta valida el id antes de llamar.
//   3. El botón no se ofrece parado en el workspace del dueño.
// El que vale es el primero; los otros dos son comodidad.
//
// Y una regla de implementación: se usa getSupabaseServer() CRUDO, con el
// .eq('workspace_id', ws) escrito a mano en un solo helper. getTenantDb()
// scopearía al workspace del REQUEST, que no tiene por qué ser el destino — un
// admin impersonando al cliente A podría vaciar al B sin enterarse.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './auth-session';

/**
 * Orden de borrado: los hijos antes que los padres. Si igual queda una FK
 * colgada, `resetearWorkspace` reintenta en pasadas sucesivas, así que este
 * orden es una ayuda y no una obligación exacta.
 */
const TABLAS_RESET = [
  // ── Hijos de leads ──
  'lead_respuestas', 'lead_insights', 'lead_audit', 'pagos', 'identidades_fiscales',
  'nutricion_envios', 'nutricion_inscripciones',
  'email_broadcast_envios',
  // ── Cabeceras ──
  'leads', 'email_broadcasts', 'nutricion_secuencias',
  // ── Conversaciones y canales ──
  'wa_mensajes', 'wa_borradores', 'wa_bloqueados', 'wa_ocultos', 'whatsapp_template_drafts',
  'evolution_contactos', 'evolution_labels', 'evolution_stage_labels', 'evolution_instancias',
  'workspace_telefonos',
  // ── MaKo, conocimiento y contexto ──
  'mako_acciones_pendientes', 'mako_confirmaciones', 'mako_doer_conv', 'mako_knowledge',
  'archivero_files', 'setting_audios',
  // ── Plan y retros ──
  'plan_tareas', 'plan_proyectos', 'plan_propuestas', 'tarea_categorias', 'retros', 'review_queue',
  // ── Análisis ──
  'closing_analyses', 'script_analyses', 'script_drafts',
  'ad_transcripts', 'creative_transcripts',
  // ── Métricas e ingesta ──
  'marketing_metrics_daily', 'adset_budget_daily', 'meta_health_history', 'service_incidents',
  'anthropic_usage', 'landing_visits', 'vsl_events',
  // ── Experimentos y charts ──
  'experimento_tareas', 'experimentos', 'chart_chats', 'chart_sessions',
  // ── Config y pertenencias ──
  'pipeline_stages', 'funnel_config',
  'shares', 'branding_assets',
  // ── Credenciales: primero la auditoría, después la credencial ──
  'credenciales_auditoria', 'credenciales', 'webhook_routing',
  // ── Y al final la configuración entera, recibos de datos-mau incluidos ──
  'app_settings',
] as const;

/** Buckets con binarios prefijados por `<ws>/`. `avatars` NO: es por usuario. */
const BUCKETS = ['archivero', 'wa-media', 'contratos', 'branding'] as const;

export type ResultadoReset = {
  borrado: Record<string, number>;
  archivos: number;
  avisos: string[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lista recursiva de un prefijo de storage, paginando de a 1000. */
async function listarRecursivo(bucket: string, prefijo: string, prof = 0): Promise<string[]> {
  if (prof > 4) return [];
  const sb = getSupabaseServer();
  const out: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefijo, { limit: 1000, offset });
    if (error || !data || !data.length) break;
    for (const it of data) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
      // Sin `id` es una "carpeta" (prefijo virtual): hay que bajar.
      if (it.id) out.push(ruta);
      else out.push(...await listarRecursivo(bucket, ruta, prof + 1));
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return out;
}

/**
 * Vacía el workspace `ws`. Conserva la fila del workspace, sus usuarios y sus
 * roles: el cliente sigue existiendo y se puede entrar, solo que sin nada
 * adentro.
 */
export async function resetearWorkspace(ws: number): Promise<ResultadoReset> {
  if (!Number.isInteger(ws)) throw new Error('Workspace inválido.');
  if (ws === OWNER_WS) throw new Error('El workspace del dueño no se resetea. Nunca.');

  const sb = getSupabaseServer();
  const borrado: Record<string, number> = {};
  const avisos: string[] = [];

  // ── 1. Cortar la sesión de WhatsApp en el servidor de Evolution ──
  // Borrar la fila de evolution_instancias no desconecta nada: la sesión sigue
  // viva allá con el número pegado, y el próximo "conectar" encuentra la
  // instancia y nunca muestra un QR nuevo.
  try {
    const { runWithWorkspace } = await import('./workspace');
    const { desconectar } = await import('./evolution');
    await runWithWorkspace(ws, () => desconectar());
  } catch (e) {
    avisos.push(`WhatsApp no oficial: no se pudo cerrar la sesión (${msg(e)}). Si el QR no aparece, desconectá a mano desde la tab.`);
  }

  // ── 2. Tablas, en pasadas: lo que falla por una FK se reintenta ──
  let pendientes: string[] = [...TABLAS_RESET];
  for (let pasada = 0; pasada < 3 && pendientes.length; pasada++) {
    const fallaron: string[] = [];
    for (const tabla of pendientes) {
      try {
        const { count, error } = await sb.from(tabla).delete({ count: 'exact' }).eq('workspace_id', ws);
        if (error) { fallaron.push(tabla); if (pasada === 2) avisos.push(`${tabla}: ${error.message}`); continue; }
        if (count) borrado[tabla] = (borrado[tabla] ?? 0) + count;
      } catch (e) {
        fallaron.push(tabla);
        if (pasada === 2) avisos.push(`${tabla}: ${msg(e)}`);
      }
    }
    pendientes = fallaron;
  }

  // ── 3. Binarios ──
  let archivos = 0;
  for (const bucket of BUCKETS) {
    try {
      const rutas = await listarRecursivo(bucket, String(ws));
      for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await sb.storage.from(bucket).remove(rutas.slice(i, i + 100));
        if (error) { avisos.push(`${bucket}: ${error.message}`); break; }
        archivos += Math.min(100, rutas.length - i);
      }
    } catch (e) {
      avisos.push(`${bucket}: ${msg(e)}`);
    }
  }

  // Lo que este botón NO puede limpiar, dicho de frente en vez de prometido.
  avisos.push('La campanita y los borradores de campañas de Meta no guardan a qué workspace pertenecen, así que quedan como estaban: no son del cliente de prueba.');

  return { borrado, archivos, avisos };
}
