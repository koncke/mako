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
 * Las tablas de inquilino (119 al 08/10/2026: las dos de etiquetas de la mig 0224 y la biblioteca
 * de archivos de la mig 0225; 120 el 09/10/2026 con `email_entrantes`, mig 0245; 121 el 11/10/2026 con
 * `dashboard_analisis`, mig 0247; 123 el mismo día con `notificaciones`, mig 0250, y las conversaciones
 * de la tab Offer, `offer_sesiones`, mig 0254; 126 con `cobros` y `pasarela_eventos` de la pasarela, mig
 * 0255; 129 el mismo día con las tres del editor de landings, mig 0246; 130 el 13/10/2026 con `calendario_eventos`, mig 0271; las del Image Editor, `image_disenos` e
 * `image_subidos`, mig 0278, el 14/10; las tres de la tab Chats, `chat_estado`, `chat_leidos` y `chat_eventos`, mig 0284; y el hilo
 * del chat del Video Editor, `video_editor_chats`, mig 0298, la copia de sus proyectos, `video_editor_proyectos`, mig 0299, y lo
 * que la API propone en ellos, `video_editor_propuestas`, mig 0302, el 16/10; y `plan_reuniones_descartadas`, mig 0300, y
 * `plan_repriorizaciones`, mig 0301, el mismo día; y el hilo del chat del Image Editor, `image_editor_chats`, mig 0303; y el
 * canal email de Chats, `email_mensajes`, mig 0312, el 17/10; y los vínculos de «Vincular cobro», `cobro_etapa_vinculos`, mig 0326, el
 * 22/10), en orden alfabético.
 *
 * ⚠️ EL ORDEN NO ES EL DE BORRADO. 39 de las 87 claves foráneas que apuntan a
 * `workspaces` no cascadean, y adentro de un inquilino hay hijos antes que padres
 * (`lead_audit` antes que `leads`). Por eso quien vacía reintenta en pasadas en
 * vez de confiar en un orden: un orden a mano es una lista más que se queda vieja.
 */
export const TABLAS_DE_INQUILINO = [
  // La medición de uso de Admin › Activity (mig 0398, 5/11/2026): vaciar o borrar el negocio se la lleva. No va en
  // TENANT_TABLES: la escribe y la lee lib/actividad*.ts con el cliente de servicio y el workspace explícito.
  'actividad_acciones', 'actividad_uso',
  'ad_transcripts', 'adset_budget_daily',
  // Los eventos de Calendly o Cal.com vinculados a una etapa de reunión (mig 0293, 16/10/2026).
  'agenda_evento_etapa',
  'agente_consentimiento', 'agente_sesiones',
  'anthropic_usage', 'api_llamadas', 'app_settings', 'archivero_files',
  // Los avisos programados, las corridas de flujos y las insistencias (migs 0180, 0183, 0186): estaban en
  // TENANT_TABLES y NO acá, así que vaciar un negocio las dejaba. Medido contra producción el 17/10/2026
  // (las tres existen, con FK a workspaces en cascada). tests/tenant-tables-contract.test.ts → INVERSO 1.
  'avisos_cola', 'avisos_programados', 'branding_assets', 'calendario_eventos',
  // «Traer tu outlier» (migs 0413 y 0414, 11/11/2026): la biblioteca de ejemplos es GLOBAL (`workspace_id` null), y lo que un
  // negocio trajo por su link lleva su número. Vaciar o borrar el negocio se lleva SÓLO lo suyo. No va en TENANT_TABLES: las
  // lee el server con service_role y filtra quién ve qué (`seMuestraA`, `seVeThumbnail`).
  'carruseles_biblioteca_piezas',
  'chart_chats', 'chart_sessions',
  'chat_agent_handoffs', 'chat_estado', 'chat_eventos', 'chat_leidos', 'cliente_entrega', 'cliente_entrega_fuera', 'cliente_entrega_orden', 'closing_analyses', 'closing_jobs', 'cobro_etapa_vinculos', 'cobros',
  'comunidad_ajustes', 'comunidad_baneos', 'comunidad_categorias', 'comunidad_comentarios',
  'comunidad_evento_avisos', 'comunidad_eventos', 'comunidad_likes', 'comunidad_notificaciones',
  'comunidad_perfiles', 'comunidad_posts', 'comunidad_seguimientos', 'comunidad_votos', 'comprobantes_leidos',
  'contenido_posts', 'creative_transcripts', 'credenciales', 'credenciales_auditoria', 'crm_etiquetas', 'crm_lead_etiquetas',
  'cs_clientes', 'cs_respuestas', 'curso_accesos', 'curso_adjuntos', 'curso_clase_notas', 'curso_clases', 'curso_desbloqueos', 'curso_estilo', 'curso_modulos', 'curso_progreso', 'curso_sesiones',
  // El «AI Analyst» del Dashboard (mig 0247, 11/10/2026): el análisis y el horario de cada hoja, por
  // persona. Se vacía con el negocio igual que el informe (`graficos.tablero.<sub>`, en app_settings).
  'dashboard_analisis',
  'dashboard_ia_elementos',
  'email_broadcast_envios', 'email_broadcasts',
  // Los emails que LLEGAN (mig 0245, sexta tanda). `workspace_id` admite null (lo que no es de nadie
  // queda escrito igual): el reset y el borrado vacían sólo los de este inquilino. No va en
  // TENANT_TABLES: nadie la lee con getTenantDb.
  'email_entrantes', 'email_mensajes', 'evolution_contactos',
  'evolution_instancias', 'evolution_labels', 'evolution_stage_labels', 'experimento_tareas',
  'experimentos', 'flow_puentes', 'flow_trabajos', 'flujo_corridas', 'formatos',
  // De la clave de una reunión a su grabador (mig «reuniones_de_cualquier_grabador», sin número, 26/10/2026).
  'grabador_reuniones',
  'funnel_config', 'funnel_ofertas', 'funnels',
  // El grupo del negocio dentro de la app (mig 0372, 3/11/2026): el hilo, los invitados y lo que leyó cada persona. ⚠️ NUNCA en TENANT_TABLES: `getTenantDb()` le daría a un
  // invitado SU negocio y estamparía su ws en el mensaje. Las lee lib/grupo-app.ts con el cliente de servicio y el ws de la URL ya autorizada.
  // ⚠️ La 0372 se aplica ANTES del deploy: el reset del cliente de prueba borra de acá y una tabla que no existe da error.
  'grupo_invitados', 'grupo_leidos', 'grupo_mensajes',
  // La IA del cliente en SU computadora (migs 0320 y 0321, 21/10/2026): los códigos, las PC y los turnos, por negocio.
  // `ia_pc_llamadas` no tiene `workspace_id`: se va con su turno (on delete cascade). No van en TENANT_TABLES: las lee
  // lib/ia-pc.ts con el service role.
  'ia_pc_codigos', 'ia_pc_dispositivos', 'ia_pc_turnos',
  'identidades_fiscales',
  'ig_conversaciones', 'ig_mensajes', 'image_disenos', 'image_editor_chats', 'image_subidos', 'insistencias', 'kpi_registros', 'kpis',
  'landing_analyses', 'landing_doc_comentarios', 'landing_doc_versiones', 'landing_docs', 'landing_drafts', 'landing_sugerencias', 'landing_visits', 'lead_audit',
  'lead_funnel', 'lead_insights', 'lead_magnets', 'lead_orden', 'lead_respuestas', 'leads',
  // La papelera del CRM (mig 0340). ⚠️ La 0340 va ANTES del deploy: el reset del cliente de prueba borra de acá y una tabla
  // que no existe da error.
  'leads_papelera',
  // Lo que se borró (mig 0356). ⚠️ Vaciar `leads` escribe acá (es un trigger): `vaciarTablas` la barre otra vez al final.
  'leads_bajas',
  // Las llamadas grabadas desde MaKo (mig 0390, 04/11/2026): la ficha del lead y Cold Calling. Las partes se van también con su
  // llamada (on delete cascade), y van igual acá: tienen su `workspace_id`.
  'llamadas_grabadas', 'llamadas_grabadas_partes',
  'mako_acciones_pendientes', 'mako_confirmaciones', 'mako_doer_buffer', 'mako_doer_conv',
  // MaKo Tokens (mig 0412, 7/11/2026): el saldo de generación del negocio y su ledger. Van acá porque son SUYOS —si
  // se vacía o se borra el negocio, su saldo y sus movimientos se van con él—. ⚠️ El ledger guarda lo que gastó y
  // cuándo: dejarlo huérfano no sería sólo basura, sería el registro de consumo de un negocio que ya no existe.
  'mako_tokens_saldo', 'mako_tokens_movimientos',
  'mako_doer_lock', 'mako_knowledge', 'marketing_metrics_daily',
  // El Media Buyer (mig 0332, 25/10/2026): su configuración y el registro de sus decisiones, por negocio. No van en
  // TENANT_TABLES: las lee y escribe lib/media-buyer/store.ts con el cliente de servicio y el ws explícito (corre en un cron).
  // ⚠️ La 0332 se aplica ANTES del deploy: el reset del cliente de prueba borra de estas dos y una tabla que no existe da error.
  'media_buyer_config', 'media_buyer_decisiones',
  'meta_campaign_drafts',
  'montaje_trabajos', 'notificaciones', 'nutricion_envios', 'nutricion_inscripciones', 'nutricion_secuencias',
  'objectives', 'oferta_productos', 'ofertas', 'offer_sesiones', 'pagos',
  // El código de MaKo Partners de cada negocio (mig 0330): vaciar o borrar el negocio se lleva su código. No va en TENANT_TABLES:
  // la lee y escribe lib/partners-programa.ts con el cliente de servicio, siempre con el ws de la sesión.
  'partner_codigos',
  // Los códigos que un partner dejó de usar y le siguen acreditando (mig 0341, 27/10/2026). Igual que el de arriba.
  // ⚠️ La 0341 se aplica ANTES del deploy: el reset del cliente de prueba borra de acá y una tabla que no existe da error.
  'partner_codigos_anteriores',
  // Los avisos de Stripe y Mercado Pago (mig 0255): `workspace_id` admite null, como email_entrantes.
  // No va en TENANT_TABLES: nadie la lee con getTenantDb. `cobros` sí está en las dos.
  'pasarela_eventos',
  // Los recibos que un negocio emite a sus clientes y su numeración (mig 0399, 5/11/2026): vaciar el negocio los borra y el
  // próximo vuelve a ser el 0001.
  'recibos_negocio', 'recibos_negocio_numeracion',
  // El libro del recolector del Second Brain (mig 0333): vaciar o borrar el negocio se lleva lo que ya leyó.
  'second_brain_recolectado',
  'pipeline_stages', 'plan_dependencias', 'plan_propuestas', 'plan_proyectos',
  // Las pruebas A/B (mig «pruebas_ab», sin número todavía, 25/10/2026): la prueba, sus ramas, quién vio qué, las lecturas y
  // el porqué. No van en TENANT_TABLES: las lee y escribe lib/pruebas/store.ts con el cliente de servicio y el ws explícito
  // (la página pública de una landing y el cron no tienen sesión). Sin la migración, el reset avisa y sigue.
  'prueba_asignaciones', 'prueba_historial', 'prueba_lecturas', 'prueba_variantes', 'pruebas',
  // Las reuniones de Fathom que el cron descartó por tipo, con su motivo (mig 0300, 16/10/2026), y
  // los trabajos de «Re-priorizar todo» (mig 0301, el mismo día).
  'plan_repriorizaciones', 'plan_reprios', 'plan_reuniones_descartadas', 'plan_tareas', 'producto_entrega', 'productos',
  'propuestas', 'prospeccion_busquedas', 'prospectos',
  // Las grabaciones de sesión de las landings (mig 0191): en TENANT_TABLES y no acá hasta el 17/10/2026.
  'replay_lotes', 'replay_sesiones',
  'retros', 'review_queue', 'script_analyses',
  'script_drafts', 'service_incidents', 'setting_adjuntos', 'setting_audios', 'shares',
  // Lo escrito sin conexión que ya se subió (MaKo sin conexión, T2, mig 0346, 28/10/2026): la llave de idempotencia de cada
  // cambio. No va en TENANT_TABLES: la lee app/_sin-conexion/acciones.ts con la PERSONA (usuario_id) y el id del cambio.
  'sin_conexion_aplicadas',
  // Competitors Spy (mig 0359): los competidores que vigila el negocio y sus piezas. Vaciar el
  // negocio o borrarlo se los lleva; `spy_piezas` también se va con su competidor (on delete cascade).
  'spy_competidores', 'spy_piezas',
  // Los cambios de una suscripción (mig 0401, 5/11/2026): montos desde un mes, cortes y vueltas (lib/suscripcion-meses.ts).
  // ⚠️ La 0401 se aplica ANTES del deploy: sin la tabla, el reset del cliente de prueba vacía igual y avisa «no existe».
  'suscripcion_movimientos',
  'tarea_categorias',
  // Las miniaturas de YouTube traídas por un negocio (mig 0414): ver `carruseles_biblioteca_piezas` arriba. El canal lleva el
  // negocio que lo trajo (el cron no lo relee); borrarlo se lleva sus videos (on delete cascade).
  'thumbnails_canales', 'thumbnails_videos',
  // Los tickets que levantan las personas del negocio al equipo de MaKo (mig 0311, 17/10/2026). `ticket_eventos` no
  // tiene `workspace_id`: se va con su ticket (on delete cascade). No va en TENANT_TABLES: la lee lib/tickets-db.ts.
  'tickets',
  'video_editor_chats', 'video_editor_propuestas', 'video_editor_proyectos', 'vsl_events', 'wa_bloqueados', 'wa_borradores', 'wa_mensajes',
  'wa_ocultos', 'webhook_routing', 'whatsapp_template_drafts', 'workspace_telefonos',
  'zernio_workspace',] as const;

export type TablaDeInquilino = (typeof TABLAS_DE_INQUILINO)[number];
