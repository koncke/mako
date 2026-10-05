// =============================================================================
// tablas-de-inquilino — dónde vive lo que es DE UN CLIENTE
// =============================================================================
// Toda tabla de `public` con una columna `workspace_id`, MENOS `usuarios`. Es la
// respuesta a «qué hay que vaciar para que de este inquilino no quede nada», y la
// usan las dos operaciones que lo hacen: el reset del cliente de prueba y el
// borrado de un cliente.
//
// ⚠️ `usuarios` NO ESTÁ, y no es un olvido: las PERSONAS no son datos del
// inquilino. El reset las conserva a propósito (si se fueran, al cliente de
// prueba no podría entrar nadie) y el borrado las elimina aparte, con su propio
// guard — no se puede dejar a la plataforma sin su último admin.
//
// ⚠️ ESTA LISTA SE MIDIÓ CONTRA PRODUCCIÓN, no contra las migraciones, y la
// diferencia no es teórica: al medirla el 29/09/2026 la lista escrita a mano del
// reset nombraba 70 tablas, de las cuales CUATRO no existen (`archivero`,
// `branding`, `contratos`, `meta_health_history` — nombres plausibles que ningún
// compilador mira) y le faltaban 24 que sí. O sea que «vaciar un workspace»
// vaciaba 66 de 90, y las otras 24 se arrastraban a la corrida siguiente sin que
// nada lo dijera. Un `delete` de supabase-js sobre una tabla que no existe
// devuelve error y el reintento lo cuenta como «falló por una FK».
//
// CÓMO SE REMIDE cuando alguien agregue una tabla (las migraciones NO alcanzan:
// hay migraciones escritas que nunca se aplicaron):
//
//   select c.table_name from information_schema.columns c
//   join information_schema.tables t
//     on t.table_name = c.table_name and t.table_schema = 'public'
//    and t.table_type = 'BASE TABLE'
//   where c.table_schema = 'public' and c.column_name = 'workspace_id'
//   order by 1;
//
// Sin `server-only` a propósito: lo importa un test, que es lo único que puede
// avisar de que la lista tiene un duplicado o perdió una tabla crítica.

/**
 * Las 91 tablas de inquilino, en orden alfabético.
 *
 * ⚠️ EL ORDEN NO ES EL DE BORRADO. 39 de las 87 claves foráneas que apuntan a
 * `workspaces` no cascadean, y adentro de un inquilino hay hijos antes que padres
 * (`lead_audit` antes que `leads`). Por eso quien vacía reintenta en pasadas en
 * vez de confiar en un orden: un orden a mano es una lista más que se queda vieja.
 */
export const TABLAS_DE_INQUILINO = [
  'ad_transcripts', 'adset_budget_daily', 'agente_consentimiento', 'agente_sesiones',
  'anthropic_usage', 'api_llamadas', 'app_settings', 'archivero_files',
  'avisos_cola', 'branding_assets', 'chart_chats', 'chart_sessions',
  'chat_agent_handoffs', 'cliente_entrega', 'closing_analyses', 'closing_jobs',
  'contenido_posts', 'creative_transcripts', 'credenciales', 'credenciales_auditoria',
  'cs_clientes', 'cs_respuestas', 'email_broadcast_envios', 'email_broadcasts', 'evolution_contactos',
  'evolution_instancias', 'evolution_labels', 'evolution_stage_labels', 'experimento_tareas',
  'experimentos', 'flow_puentes', 'flow_trabajos', 'formatos',
  'funnel_config', 'funnel_ofertas', 'funnels', 'identidades_fiscales',
  'ig_conversaciones', 'ig_mensajes', 'kpi_registros', 'kpis',
  'landing_analyses', 'landing_drafts', 'landing_visits', 'lead_audit',
  'lead_insights', 'lead_magnets', 'lead_respuestas', 'leads',
  'mako_acciones_pendientes', 'mako_confirmaciones', 'mako_doer_buffer', 'mako_doer_conv',
  'mako_doer_lock', 'mako_knowledge', 'marketing_metrics_daily', 'meta_campaign_drafts',
  'montaje_trabajos', 'nutricion_envios', 'nutricion_inscripciones', 'nutricion_secuencias',
  'objectives', 'oferta_productos', 'ofertas', 'pagos',
  'pipeline_stages', 'plan_dependencias', 'plan_propuestas', 'plan_proyectos',
  'plan_reprios', 'plan_tareas', 'producto_entrega', 'productos',
  'propuestas', 'retros', 'review_queue', 'script_analyses',
  'script_drafts', 'service_incidents', 'setting_audios', 'shares', 'tarea_categorias',
  'vsl_events', 'wa_bloqueados', 'wa_borradores', 'wa_mensajes',
  'wa_ocultos', 'webhook_routing', 'whatsapp_template_drafts', 'workspace_telefonos',
  'zernio_workspace',] as const;

export type TablaDeInquilino = (typeof TABLAS_DE_INQUILINO)[number];
