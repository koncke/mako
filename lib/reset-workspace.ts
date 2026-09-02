// =============================================================================
// reset-workspace — dejar un workspace de prueba como recién creado
// =============================================================================
// Vacía TODO lo que un cliente puede haber generado: sus tablas, su
// configuración, sus credenciales, sus archivos y su sesión de WhatsApp. Lo que
// NO toca, nunca: la fila del workspace, sus usuarios y sus roles — si se
// fueran, el cliente de prueba quedaría inaccesible y habría que crearlo de nuevo.
//
// Tres cinturones para que jamás corra contra un cliente real:
//   1. Este archivo tira si el destino no es WS_PRUEBA, antes de mirar nada más.
//   2. La ruta exige el mismo workspace antes de llamar.
//   3. El botón no se ofrece fuera del cliente de prueba.
// El que vale es el primero; los otros dos son comodidad.
//
// ⚠️ Los tres decían «que no sea el del dueño», que es una condición NEGATIVA:
// protegía a Mauricio y dejaba pasar a todos los demás. Vaciar el workspace de
// Leandro o de Leila estaba a un click de distancia y no había nada que lo
// frenara. Un guard contra lo destructivo se escribe en positivo —«solo ESTE»—
// porque la lista de lo que hay que proteger crece sola con cada cliente nuevo,
// y la de lo que se puede tocar no.
//
// Y una regla de implementación: se usa getSupabaseServer() CRUDO, con el
// .eq('workspace_id', ws) escrito a mano en un solo helper. getTenantDb()
// scopearía al workspace del REQUEST, que no tiene por qué ser el destino — un
// admin impersonando al cliente A podría vaciar al B sin enterarse.

import 'server-only';
import { getSupabaseServer } from './supabase';
import { exigirClienteDePrueba } from './auth-session';

/**
 * Orden de borrado: los hijos antes que los padres. Si igual queda una FK
 * colgada, `resetearWorkspace` reintenta en pasadas sucesivas, así que este
 * orden es una ayuda y no una obligación exacta.
 */
const TABLAS_RESET = [
  // ── Hijos de leads ──
  'lead_respuestas', 'lead_insights', 'lead_audit', 'pagos', 'identidades_fiscales',
  'nutricion_envios', 'nutricion_inscripciones',
  'email_broadcast_envios', 'cs_respuestas', 'cs_clientes',
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
  'landing_analyses', 'landing_drafts',
  'ad_transcripts', 'creative_transcripts',
  // ── Métricas e ingesta ──
  'marketing_metrics_daily', 'adset_budget_daily', 'meta_health_history', 'service_incidents',
  'anthropic_usage', 'landing_visits', 'vsl_events',
  // ── Experimentos y charts ──
  'experimento_tareas', 'experimentos', 'chart_chats', 'chart_sessions',
  // ── Config y pertenencias ──
  // 'productos' es el catálogo comercial del cliente: un reset que lo deja en pie
  // devuelve un workspace "vacío" que igual arrastra las ofertas del anterior, y
  // el paso de onboarding lo encuentra ya cargado y no vuelve a preguntar.
  'pipeline_stages', 'funnel_config', 'productos',
  'shares', 'branding_assets',
  // ── Credenciales: primero la auditoría, después la credencial ──
  'credenciales_auditoria', 'credenciales', 'webhook_routing',
  // ── Y al final la configuración entera, recibos de datos-mau incluidos ──
  'app_settings',
] as const;

/** Buckets con binarios prefijados por `<ws>/`. `avatars` NO: es por usuario. */
const BUCKETS = ['archivero', 'wa-media', 'contratos', 'branding', 'ig-media', 'ads-creatives', 'video-clips'] as const;

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
  // La condición vive en auth-session.ts (sin `server-only`) para que se pueda
  // testear: ver tests/reset-workspace.test.ts.
  exigirClienteDePrueba(ws);

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
    avisos.push(`WhatsApp no oficial: no se pudo cerrar la sesión (${msg(e)}). Si el código QR no aparece, desconecta el número manualmente desde la sección de WhatsApp.`);
  }

  // ── 1b. Borrar el clon de voz de la cuenta de ElevenLabs ──
  //
  // ⚠️ ANTES DE VACIAR `app_settings`, Y NO DESPUÉS. El `voiceId` vive ahí: si se
  // borra primero la fila, el clon se queda en la cuenta de la PLATAFORMA para
  // siempre y sin el id nadie lo puede volver a encontrar. Los slots de voz de un
  // plan son un techo de cuántos clientes entran, así que cada huérfano se paga.
  //
  // Y el `catch` AVISA en vez de callar: un catch mudo acá es exactamente lo que
  // produce el huérfano — el reset diría «listo» y el slot seguiría ocupado.
  try {
    const { runWithWorkspace } = await import('./workspace');
    const { getVozCliente } = await import('../app/video-generator/voz-cliente');
    const { borrarVoz } = await import('./elevenlabs');
    const voz = await runWithWorkspace(ws, () => getVozCliente());
    if (voz.clon?.voiceId) {
      const r = await borrarVoz(voz.clon.voiceId);
      if (!r.ok) {
        avisos.push(`Voz clonada: no se pudo borrar de ElevenLabs (${r.error}). Queda ocupando un espacio de voz en la cuenta de la plataforma; bórrala a mano — su identificador es ${voz.clon.voiceId}.`);
      }
    }
  } catch (e) {
    avisos.push(`Voz clonada: no se pudo comprobar si había una (${msg(e)}). Revisa las voces de la cuenta de ElevenLabs por si quedó una huérfana.`);
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
  avisos.push('Las notificaciones y los borradores de campañas de Meta no registran a qué workspace pertenecen, así que se conservan sin cambios.');

  return { borrado, archivos, avisos };
}
