// =============================================================================
// Las áreas del producto — un registro de construcción por cada una
// =============================================================================
// La idea es la que ya funciona en «MaKo UX/UI»: mientras se trabaja un pedazo del
// producto queda escrito qué se decidió, qué se rompió y qué falta. Después,
// cambiar o debuguear ese pedazo no arranca de cero.
//
// Existe sobre todo para DOS AGENTES que se van a construir encima: el que marca
// tareas como completadas solo, y el que desarrolla y debuguea. Si un área no está
// acá, esos agentes son ciegos ahí — por eso la lista es exhaustiva y no bonita.
//
// QUÉ ES UN ÁREA (y qué no). Un área tiene tareas propias en el plan, o código
// propio con decisiones propias. Las vistas internas, los modales y los wizards NO
// son áreas: son entradas del Roadmap de la suya. El criterio se aplicó sobre un
// relevamiento de 208 piezas del producto y dio 122 áreas, que cubren los 68
// proyectos del tablero y sus 438 tareas abiertas sin dejar ninguna afuera.
//
// El número NO se escribe en la UI a mano: sale de `AREAS.length`. Acá quedó en
// 121 un rato porque lo conté con `grep -c`, que cuenta LÍNEAS y no ocurrencias.
//
// LOS NOMBRES VAN EN INGLÉS, salvo dos casos: los que ya existen en español en
// `nav.ts` (`Contexto de MaKo`, `Conocimientos`) y **Perro Guardián**, que es nombre
// propio. Traducirlos rompe el match con la tab y con el proyecto del plan.
//
// DE DÓNDE SALEN LOS DOS PANELES, y por qué no están escritos a mano:
//   · El ROADMAP sale del plan. Cada área declara sus `proyectos` y la pantalla lee
//     las tareas abiertas de la base. Un roadmap escrito a mano se queda viejo el
//     martes; éste es el tablero, que es donde el trabajo ya vive.
//   · El CHANGE HISTORY sale de git. `scripts/gen-dev-historial.mjs` corre
//     `git log` sobre las rutas de `vive` y deja `_historial.generado.ts`.
//     Las bitácoras escritas a mano (`<area>/bitacora.ts`) NO se reemplazan:
//     tienen el pedido TEXTUAL del dueño y el porqué, que ningún commit contiene.
//     Donde existen, mandan ellas. Cuáles son sale de `registros.ts`, nunca de una
//     lista escrita al lado: acá decía «las seis» cuando ya eran siete.
//
// Eso es deliberado y es la única forma de que 122 registros no sean 122 mentiras.
// La versión anterior de este archivo lo decía así: «nacen vacíos a propósito; uno
// inventado de antemano es peor que ninguno: se lee como verdad y no lo es». Sigue
// valiendo — por eso lo único escrito a mano acá es lo que ningún código deduce:
// el alcance, dónde vive y la trampa que espera adentro.
//
// ⚠️ `vive` lo mira `tests/dev-areas.test.ts` contra el disco. Una ruta plausible
// pero inexistente no rompe nada y no la ve el compilador: manda al próximo agente
// a leer un archivo que no está, con la confianza de que el registro dice la verdad.
//
// La excepción son las rutas de ENTORNO (`RUTAS_DE_ENTORNO`, acá abajo): las tiene un
// clon configurado y ningún checkout limpio. El test no las exige porque NADIE las
// puede crear haciendo lo que el test pide — en un worktree `.git` es un ARCHIVO que
// apunta al gitdir, así que `.git/hooks/pre-push` no puede existir ahí ni queriendo.
//
// ⚠️ Y ojo con lo que se concluye de eso: el hook IGUAL CORRE desde un worktree, porque
// git resuelve `hooks/` contra el git dir COMÚN (`git rev-parse --git-path hooks/pre-push`
// devuelve el del clon principal). La ruta relativa no existe y la guarda está viva:
// por eso `existsSync` era la pregunta equivocada, y no que el hook «falte» ahí.

/**
 * Lo que un clon configurado tiene y un checkout limpio no: fuera de git a propósito.
 * `tests/dev-areas.test.ts` no exige que existan, pero SÍ exige que cada una siga
 * declarada en algún `vive` — si no, la excepción le sobrevive a su motivo y termina
 * tapando una ruta futura que se llame igual.
 *
 * Van EXACTAS y no por prefijo: sumar una ruta de entorno tiene que ser una decisión,
 * no algo que se cuele por empezar con un punto.
 */
export const RUTAS_DE_ENTORNO: readonly string[] = [
  '.git/hooks/pre-push', // el hook no se versiona; AGENTS.md dice cómo recrearlo
  '.env.local',          // secretos, y apunta a la base de PRODUCCIÓN
  '.vercel/',            // la deja `vercel link`, es de quien linkeó
];

export type EstadoArea = 'listo' | 'parcial' | 'por-construir';

export type AreaDev = {
  slug: string;
  titulo: string;
  /** La familia del sidebar: Operate, Analyze, Sales Machine, Content Machine… */
  familia: string;
  /** Sub-desplegable dentro de la familia (Analysts, Ads, Dev…). Opcional. */
  grupo?: string;
  /** listo = cerrado · parcial = anda pero tiene tareas abiertas · por-construir. */
  estado: EstadoArea;
  /** Corre solo, sin que nadie apriete nada. Se audita distinto que una pantalla. */
  agente?: boolean;
  /** Qué parte del producto cubre, para que el registro no se solape con otro. */
  alcance: string;
  /** La ruta del producto, para saltar del registro a la pantalla real. */
  verEnApp?: string;
  /** Dónde vive el código: es lo primero que se pregunta un agente. VERIFICADO. */
  vive: string[];
  /** Los proyectos del tablero de los que sale su Roadmap. */
  proyectos?: string[];
  /** El documento de hallazgos que ya cubre parte de esto, sin `docs/` ni `.md`. */
  hallazgos?: string;
  /** La trampa que espera adentro: lo que sorprendió al relevarla. */
  nota?: string;
};

export const AREAS: AreaDev[] = [

  // ─────────────────────────────────────────────────────────── Operate
  {
    slug: 'general', titulo: 'General', familia: 'Operate', grupo: 'General',
    estado: 'listo', verEnApp: '/general',
    alcance: 'La casa del cliente al entrar: hero de la meta, resumen del mes, semáforo del negocio y worklist de pendientes.',
    vive: ['app/general/page.tsx', 'app/general/actions.ts', 'lib/queries.ts', 'lib/pagos.ts', 'lib/meta-health.ts'],
    proyectos: ['Feature: General'],
  },
  {
    slug: 'foco-hoy', titulo: 'Foco / Hoy', familia: 'Operate', grupo: 'General',
    estado: 'por-construir', verEnApp: '/focus',
    alcance: 'Qué hacer AHORA: la vista Hoy, la acción de la semana y el briefing de la mañana. No existe todavía: el nav ya matchea /focus pero no hay carpeta ni pantalla.',
    vive: [],
    proyectos: ['Feature: Foco'],
    nota: 'El ruteo llega antes que la pantalla: app/_components/nav.ts:127 ya matchea starts(\'/focus\') dentro del item \'General\', pero no existe app/focus. Lo único más que aparece es la ficha del proyecto en lib/plan-proyectos-catalogo.ts:84 (\'Foco\') y un \'cuello: foco\' en lib/fase-diagnostico.ts:233, que es otra cosa (el cuello de botella del diagnóstico).',
  },
  {
    slug: 'mindset', titulo: 'Mindset', familia: 'Operate', grupo: 'General',
    estado: 'por-construir',
    alcance: 'Diagnóstico psicológico del dueño (tests tipo LOT-R), cómo ese perfil pega en su negocio concreto y las prácticas para trabajarlo. Solo existe como proyecto del tablero: cero código.',
    vive: [],
    proyectos: ['Feature: Mindset'],
    nota: 'Cero código pero SÍ está en el catálogo CERRADO de proyectos (lib/plan-proyectos-catalogo.ts:108), así que el ruteo de tareas ya le manda trabajo a un área que no tiene dónde vivir. Además el nombre está hardcodeado como ejemplo en los comentarios del ruteo (lib/plan-board.ts:295, lib/todo-rutear.ts:109, lib/mako-guardian.ts:531): si el proyecto se renombra, esos comentarios quedan mintiendo.',
  },
  {
    slug: 'plan', titulo: 'Plan', familia: 'Operate', grupo: 'Plan',
    estado: 'listo', verEnApp: '/plan',
    alcance: 'El tablero de tareas. Misma UI en dos adapters: cliente (/plan → TodoBoard, Supabase por workspace) y super-admin sin impersonar (/plan/agencia → PlanBoard).',
    vive: ['app/plan/page.tsx', 'app/plan/TodoBoard.tsx', 'app/plan/PlanBoard.tsx', 'app/plan/agencia/page.tsx', 'app/plan/board/BoardShell.tsx', 'app/plan/board/useBoard.ts', 'app/plan/board/types.ts', 'app/plan/board/dependencias.ts', 'app/plan/board/DependenciasBloque.tsx', 'app/plan/board/envejecer.ts', 'lib/todo.ts', 'lib/plan-board.ts', 'lib/plan-proyecto-vacio.ts', 'app/api/cron/plan-recurvar/route.ts', 'supabase/migrations/0140_plan_dependencias.sql', 'supabase/migrations/0141_plan_score_base.sql'],
    proyectos: ['Feature: Plan'],
  },
  {
    slug: 'perro-guardian', titulo: 'Perro Guardián', familia: 'Operate', grupo: 'Plan',
    estado: 'listo', agente: true,
    alcance: 'El agente que puntúa el plan 1-100, le pone fecha y razón a cada tarea, la rutea a su proyecto, caza duplicados y te discute cuando querés subir una prioridad o borrar algo.',
    vive: ['lib/mako-guardian.ts', 'app/api/mako-guardian/route.ts', 'lib/preguntas-contrato.ts', 'lib/todo-guardian.ts', 'lib/todo-rutear.ts', 'app/plan/board/guardian-form.tsx', 'app/plan/board/AudienciaModal.tsx', 'app/plan/board/metodologia.ts', 'lib/plan-prueba.ts', 'lib/plan-reprio.ts', 'app/plan/board/dependencias.ts', 'scripts/recurvar-plan.mts'],
    proyectos: ['Agente: Perro Guardián'],
    hallazgos: 'hallazgos-plan',
    nota: 'El Perro NO se dispara principalmente desde /api/mako-guardian: la corrida real sobre tareas nuevas es priorizarNuevasOwner() en lib/plan-board.ts:448 (llamada desde lib/plan-propuesta.ts, lib/mako-doer-acciones.ts y app/api/plan-board/route.ts), y tiene un GEMELO para el board del cliente en lib/todo-guardian.ts. Tocar solo mako-guardian.ts arregla la mitad. Ojo también: lib/preguntas-contrato.ts va SIN \'server-only\' a propósito, porque lo comparten servidor y cliente.',
  },
  {
    slug: 'meeting-reader', titulo: 'Meeting Reader', familia: 'Operate', grupo: 'Plan',
    estado: 'listo', agente: true,
    alcance: 'Lee las reuniones de Fathom solo, saca los compromisos, los reparte por persona y deja el borrador esperando. Termina cuando entrega el borrador.',
    vive: ['lib/plan-fathom.ts', 'lib/fathom-auto.ts', 'lib/reunion-auto.ts', 'lib/reunion-destinatarios.ts', 'lib/auto-reuniones.ts'],
    proyectos: ['Agente: Lector de reuniones'],
  },
  {
    slug: 'auto-close', titulo: 'Auto-Close', familia: 'Operate', grupo: 'Plan',
    estado: 'parcial', agente: true,
    alcance: 'Cierra solas las tarjetas cuyo trabajo ya está hecho según las señales del producto. Corre en el seed del board y en un cron; no propone evidencia en la UI todavía.',
    vive: ['lib/todo-seeds.ts', 'lib/plan-senales.ts', 'app/api/cron/tareas-verificar/route.ts'],
    proyectos: ['Agente: Cierre automático'],
  },
  {
    slug: 'startup-plan-seed', titulo: 'Startup Plan Seed', familia: 'Operate', grupo: 'Plan',
    estado: 'listo', agente: true,
    alcance: 'El plan de arranque del cliente nuevo: se siembra si el board está vacío, recortado por fase y canal, y con lo ya resuelto marcado hecho.',
    vive: ['lib/todo-seeds.ts', 'lib/todo-seed-ia.ts', 'lib/plan-senales.ts'],
  },
  {
    slug: 'crm', titulo: 'CRM', familia: 'Operate', grupo: 'CRM',
    estado: 'listo', verEnApp: '/crm',
    alcance: 'Los leads del negocio: kanban por etapa, tabla, worklist de datos sin marcar y la ficha.',
    vive: ['app/crm/page.tsx', 'app/crm/CrmBoard.tsx', 'app/crm/CrmToolbar.tsx', 'app/crm/crm-map.ts', 'app/crm/actions.ts', 'app/crm/LeadSheet.tsx', 'app/crm/StageMoveDialog.tsx', 'app/crm/ImportarLeadsModal.tsx', 'app/crm/TablaRevisionLeads.tsx', 'app/crm/leads-exportar.ts', 'app/crm/calendly-widget.ts', 'app/crm/[id]/page.tsx', 'app/crm/[id]/resumen/page.tsx', 'app/crm/lead-view/ComportamientoCard.tsx', 'app/crm/revisar/page.tsx', 'app/crm/revisar/[id]/RevisarLead.tsx', 'app/api/agente/lead/route.ts', 'app/api/track/optin/route.ts', 'lib/leads.ts', 'lib/pipeline.ts', 'lib/leads-duplicados.ts', 'lib/stage-requirements.ts', 'lib/propuestas.ts', 'lib/lead-resumen.ts', 'lib/closing-job-estado.ts', 'supabase/migrations/0128_propuestas.sql', 'supabase/migrations/0130_closing_jobs.sql'],
    proyectos: ['Feature: CRM'],
    hallazgos: 'hallazgos-crm',
    nota: 'El vive[] estaba recortado al tablero (7 archivos) y por eso el panel de historial no veía nada del trabajo de agosto, que cayó casi todo AL COSTADO: la ficha (app/crm/[id]), el resumen para el celular (app/crm/[id]/resumen), la bandeja de propuestas (app/crm/revisar) y el alta (lib/leads-duplicados.ts, app/api/track/optin). Ampliado el 17/08 por la regla «una ruta que apunta a la nada». OJO con el solape: app/crm/lead-view/GeneratedInsightCard.tsx pertenece a `lead-insights`, y app/crm/[id]/deal-actions.ts + DealDetailsCard a `contracts-receipts` — no se listan acá a propósito.',
  },
  {
    slug: 'lead-insights', titulo: 'Lead Insights', familia: 'Operate', grupo: 'CRM',
    estado: 'listo', agente: true, verEnApp: '/crm',
    alcance: 'MaKo genera el diagnóstico del lead cruzando su ficha, sus llamadas y su comportamiento; avisa qué datos le faltan para poder hacerlo.',
    vive: ['app/crm/lead-view/GeneratedInsightCard.tsx', 'app/crm/insights-actions.ts', 'lib/lead-insights.ts', 'lib/closing.ts'],
  },
  {
    slug: 'crm-automation', titulo: 'CRM Automation', familia: 'Operate', grupo: 'CRM',
    estado: 'parcial', agente: true, verEnApp: '/crm',
    alcance: 'El motor que mueve leads de etapa solo por sus reglas T1..T6. Motor y aplicación están hechos pero gateados por flag por workspace.',
    vive: ['app/crm/CrmAutoToggle.tsx', 'app/crm/auto-actions.ts', 'lib/crm-auto.ts', 'lib/crm-auto-plan.ts', 'lib/envio-flags.ts'],
    proyectos: ['Agente: CRM automático'],
  },
  {
    slug: 'funnel-editor', titulo: 'Funnel Editor', familia: 'Operate', grupo: 'CRM',
    estado: 'listo', verEnApp: '/funnel',
    alcance: 'Fuente de verdad de las etapas. Pantalla real SIN entrada en el nav.',
    vive: ['app/funnel/page.tsx', 'app/funnel/FunnelEditor.tsx', 'lib/pipeline.ts', 'lib/leads.ts', 'supabase/migrations/0025_funnel_config.sql'],
    hallazgos: 'hallazgos-crm',
    nota: 'El funnel es UNO por workspace por CONSTRUCCIÓN, no por convención: índice único funnel_config_ws_uk (0054:95) + TRES upserts con onConflict:\'workspace_id\' (saveFunnel, clonarConfigDelDueno, datos-mau) + un .maybeSingle() en getFunnel que con dos filas devuelve PGRST116 y el catch lo convierte en DEFAULT_PIPELINE SIN UN SOLO LOG. Y el diagnóstico obvio es el equivocado: el funnel NO ubica los leads — deriveStageKey (lib/pipeline.ts:887) es un switch puro con 11 keys canónicas que no lee funnel_config. El editor autoguarda el jsonb ENTERO con debounce de 500ms por tecla y está embebido en tres pantallas más (/funnel, /onboarding, /second-brain). El plan de multi-funnel, en docs/modelo-oferta-producto-funnel.md.',
  },
  {
    slug: 'products-offers', titulo: 'Products & Offers', familia: 'Operate', grupo: 'CRM',
    estado: 'parcial',
    alcance: 'Qué vende el negocio y por dónde: el catálogo de PRODUCTOS (lo que se entrega y se factura), las OFERTAS (cómo se presenta cada uno para que se compre) y su relación N:M con los funnels. MaKo los propone leyendo el brief y El Archivero; el CRM referencia uno al cerrar y hereda su pricing.',
    vive: ['lib/productos.ts', 'lib/productos-ia.ts', 'app/onboarding/ProductosView.tsx', 'app/api/onboarding/productos/route.ts', 'supabase/migrations/0117_productos.sql', 'docs/modelo-oferta-producto-funnel.md', 'docs/productos-y-funnels-plan.md'],
    proyectos: ['Feature: CRM'],
    hallazgos: 'hallazgos-crm',
    nota: 'OFERTA ≠ PRODUCTO, y confundirlos costó un rediseño entero del plan (10/8): el producto es lo que se ENTREGA y se factura, la oferta es cómo se PRESENTA para que se compre (promesa, garantía, bonos, urgencia, lead magnet). Decisión del dueño: la oferta NO se depreca a favor del catálogo — y hay un dato que lo respalda, perfilNegocioTexto() alimenta ~20 features y el catálogo productos solo 2 (lib/agente-contexto.ts); lib/mako-context.ts no lee productos en absoluto. Sigue sin cablearse leads.producto_id (mig 0117:34): la columna existe y NINGUNA línea de TypeScript la lee ni la escribe — no está en el tipo Lead, ni en LISTA_COLS, ni en COLS_FILTRO. Va sin RLS: se scopea por getTenantDb (\'productos\' está en TENANT_TABLES). El modelo completo de lo que falta, con el DDL de 0125 a 0131, en docs/modelo-oferta-producto-funnel.md.',
  },
  {
    slug: 'contracts-receipts', titulo: 'Contracts & Receipts', familia: 'Operate', grupo: 'CRM',
    estado: 'parcial',
    alcance: 'El plan de cobranza por cuotas del lead y los papeles que lo respaldan: contrato, comprobante y datos fiscales, subidos a Storage y leídos por IA para autocompletar el deal.',
    vive: ['lib/pagos.ts', 'app/crm/[id]/deal-actions.ts', 'app/crm/[id]/DealDetailsCard.tsx', 'app/api/extract-contract/route.ts', 'app/api/extract-receipt/route.ts', 'app/api/extract-deal-fiscal/route.ts', 'app/api/extract-fiscal/route.ts', 'app/api/doc/route.ts'],
    hallazgos: 'hallazgos-crm',
    nota: 'Son CUATRO rutas extract-*, no cinco: la quinta que aparece al grepear es app/api/mako/onboarding/extract, que pertenece al onboarding. Y sigue viva la trampa: saveLeadPlanManual (lib/pagos.ts:210) hard-setea estado_lead=\'ganado\' y cerro=true, así que guardar cuotas CIERRA el lead — por eso DealDetailsCard solo la llama si cuotasDirty. El doc de hallazgos-crm ubica ese bug en app/leads/[id]/deal-actions.ts: esa ruta ya no existe, hoy es app/crm/[id]/deal-actions.ts.',
  },
  {
    slug: 'ads-manager', titulo: 'Ads Manager', familia: 'Operate', grupo: 'Ads Manager',
    estado: 'listo', verEnApp: '/ads-manager',
    alcance: 'La réplica del Ads Manager de Meta adentro de la app: estado en vivo + rendimiento cruzado con el CRM, y las escrituras a Meta.',
    vive: ['app/ads-manager/page.tsx', 'app/ads-manager/AdsManagerView.tsx', 'app/api/ads-manager/', 'app/api/meta-health/route.ts'],
    proyectos: ['Feature: Ads Manager'],
  },
  {
    slug: 'ads-optimizer-bot', titulo: 'Ads Optimizer Bot', familia: 'Operate', grupo: 'Ads Manager',
    estado: 'por-construir', agente: true,
    alcance: 'El agente que vigila y mueve la pauta solo: sube y baja presupuesto, apaga lo que no rinde y avisa. No existe todavía; el trabajo vive en el proyecto homónimo del catálogo.',
    vive: ['lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Agente: Ads Optimizer Bot'],
  },
  {
    slug: 'meta-platform', titulo: 'Meta Platform', familia: 'Operate', grupo: 'Ads Manager',
    estado: 'parcial',
    alcance: 'La app de Meta: BM, App Review, OAuth, multi-cuenta. Distinto de la ingesta.',
    vive: ['lib/meta-ads.ts', 'lib/meta-write.ts', 'lib/meta-descubrir.ts', 'lib/meta-capi.ts', 'lib/meta-leads.ts', 'lib/meta-templates.ts', 'app/api/webhooks/meta-leads'],
  },
  {
    slug: 'whatsapp', titulo: 'WhatsApp', familia: 'Operate', grupo: 'Comunicación',
    estado: 'listo', verEnApp: '/whatsapp',
    alcance: 'El canal de todos los días con los leads: dos bandejas (oficial y de empresa), secuencias automáticas y plantillas.',
    vive: ['app/whatsapp/page.tsx', 'app/whatsapp/WhatsAppApp.tsx', 'app/whatsapp/_shared/', 'lib/chatwoot.ts', 'lib/evolution.ts'],
    proyectos: ['Feature: WhatsApp'],
  },
  {
    slug: 'whatsapp-advisor', titulo: 'WhatsApp Advisor', familia: 'Operate', grupo: 'Comunicación',
    estado: 'listo', agente: true, verEnApp: '/whatsapp',
    alcance: 'MaKo en el panel del chat: lee la conversación real, la etapa y la ventana de 24h y recomienda qué escribirle a ESTE lead. Dos modos, Consejo y Chat, con historial por contacto.',
    vive: ['app/whatsapp/WhatsAppAdvisor.tsx', 'lib/whatsapp-advisor.ts'],
  },
  {
    slug: 'nutrition-writer', titulo: 'Nutrition Writer', familia: 'Operate', grupo: 'Comunicación',
    estado: 'listo', agente: true, verEnApp: '/whatsapp',
    alcance: 'MaKo escribe las secuencias en la voz del negocio y el usuario solo aprueba. Falta el go-live del envío real.',
    vive: ['app/_components/NutricionGenerar.tsx', 'lib/nutricion-generator.ts', 'lib/envio-flags.ts'],
  },
  {
    slug: 'whatsapp-labels-etapas', titulo: 'WhatsApp Labels ↔ Etapas', familia: 'Operate', grupo: 'Comunicación',
    estado: 'parcial',
    alcance: 'Mapea cada etapa del funnel a una etiqueta del WhatsApp no oficial: cuando el lead cambia de etapa, Evolution le pone o le saca la etiqueta en el celular del setter.',
    vive: ['lib/evolution-labels.ts', 'app/configuraciones/EtiquetasWhatsAppPanel.tsx', 'app/api/whatsapp/evolution/labels/route.ts', 'lib/wa-etapas.ts', 'supabase/migrations/0077_evolution_contactos_labels.sql', 'app/api/webhooks/evolution/route.ts', 'lib/leads.ts'],
    hallazgos: 'hallazgos-comunicacion',
    nota: 'El backend corre (lib/leads.ts llama actualizarEtiquetaLead al mover el lead), pero la UI está huérfana: grep de EtiquetasWhatsAppPanel en app y lib devuelve una sola línea, su propia definición. ConfigInnerTabs no la monta. Las etiquetas NO se crean acá: se crean en el WhatsApp Business del celular y entran por findLabels o por el evento labels.edit del webhook.',
  },
  {
    slug: 'workspace-phone-numbers', titulo: 'Workspace Phone Numbers', familia: 'Operate', grupo: 'Comunicación',
    estado: 'parcial',
    alcance: 'CONSTRUIDO Y DESENCHUFADO: tiene migración propia (0065) y nadie lo monta.',
    vive: ['supabase/migrations/0065_workspace_telefonos.sql', 'app/configuraciones/TelefonosPanel.tsx', 'app/configuraciones/telefonos-actions.ts', 'lib/chatwoot.ts', 'lib/evolution.ts'],
  },
  {
    slug: 'email', titulo: 'Email', familia: 'Operate', grupo: 'Comunicación',
    estado: 'listo', verEnApp: '/email',
    alcance: 'El canal de email: secuencias por etapa del motor de nutrición y broadcasts puntuales, sobre Resend.',
    vive: ['app/email/page.tsx', 'app/email/EmailApp.tsx', 'app/api/email/', 'lib/resend.ts'],
    proyectos: ['Feature: Email'],
  },
  {
    slug: 'email-writer', titulo: 'Email Writer', familia: 'Operate', grupo: 'Comunicación',
    estado: 'listo', agente: true, verEnApp: '/email',
    alcance: 'MaKo escribe o reescribe asunto, preheader y cuerpo desde una instrucción, dentro del compositor del broadcast.',
    vive: ['app/api/email/generar', 'app/email/EmailApp.tsx'],
  },
  {
    slug: 'email-delivery-bajas', titulo: 'Email Delivery & Bajas', familia: 'Operate', grupo: 'Comunicación',
    estado: 'parcial',
    alcance: 'Lo que pasa después de apretar enviar: verificación del dominio en Resend, webhook Svix de abiertos, clics y rebotes, y la baja del lead por el link del footer o por One-Click.',
    vive: ['app/api/webhooks/resend/route.ts', 'lib/resend.ts', 'app/api/email/unsubscribe/route.ts', 'app/api/email/dominio/route.ts', 'lib/email-marketing.ts', 'supabase/migrations/0046_email_marketing.sql'],
    hallazgos: 'hallazgos-comunicacion',
    nota: 'El webhook valida UN solo signing secret, el de la cuenta de MaKo (Opción A). Un cliente que cargue su propia RESEND_API_KEY sigue enviando pero pierde todo el tracking de abiertos, clics y rebotes, y por lo tanto la supresión automática. Está anotado en lib/resend.ts como pendiente F2. La supresión por rebote (suprimirPorRebote) y la baja manual escriben la misma columna: leads.email_opt_out.',
  },
  {
    slug: 'instagram', titulo: 'Instagram', familia: 'Operate', grupo: 'Comunicación',
    estado: 'parcial', verEnApp: '/instagram',
    alcance: 'El canal de Instagram, construido el 15/08 sobre Zernio (que envuelve la Graph API): conectar la cuenta, bandeja de DMs que se contestan como borrador del Chat Agent, y publicaciones de feed/reel/story/carrusel con la programación nativa del proveedor. Falta el webhook para el cliente con key propia: hoy BYOK publica pero no recibe.',
    vive: ['app/instagram/page.tsx', 'app/instagram/InstagramApp.tsx', 'app/instagram/InboxDms.tsx', 'app/instagram/Publicaciones.tsx', 'app/instagram/OnboardingInstagram.tsx', 'app/instagram/actions.ts', 'app/instagram/ig-datos.ts', 'lib/zernio.ts', 'lib/ig-chatbot.ts', 'lib/ig-contenido.ts', 'app/api/webhooks/zernio/route.ts', 'supabase/migrations/0136_instagram_zernio.sql', 'app/_components/nav.ts', 'lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Feature: Instagram'],
  },
  {
    slug: 'onboarding', titulo: 'Onboarding Wizard', familia: 'Operate', grupo: 'Onboarding',
    estado: 'listo', verEnApp: '/onboarding',
    alcance: 'El shell bloqueante. Es el proyecto con MÁS tareas abiertas del tablero.',
    vive: ['app/onboarding/page.tsx', 'app/onboarding/OnboardingWizard.tsx', 'app/onboarding/OnboardingTabs.tsx', 'app/_components/WizardShell.tsx', 'app/_components/wizard-progreso.ts', 'lib/onboarding-state.ts', 'lib/onboarding.ts', 'lib/onboarding-extract.ts'],
    proyectos: ['Feature: Onboarding'],
  },
  {
    slug: 'el-archivero', titulo: 'El Archivero', familia: 'Operate', grupo: 'Onboarding',
    estado: 'listo',
    alcance: 'Los documentos del negocio: de ahí sale casi todo el contexto de MaKo.',
    vive: ['app/onboarding/Archivero.tsx', 'app/onboarding/ResumenView.tsx', 'lib/onboarding-extract.ts'],
  },
  {
    slug: 'fase-y-norte', titulo: 'Fase y Norte', familia: 'Operate', grupo: 'Onboarding',
    estado: 'listo',
    alcance: 'Las 6 preguntas que ubican al negocio en una fase 1-5 con su cuello de botella y su hito. Es el Norte: entra en el contexto de MaKo y ordena avatares, ángulos y prioridades.',
    vive: ['lib/fase-diagnostico.ts', 'lib/fase-store.ts', 'app/onboarding/DiagnosticoView.tsx', 'app/onboarding/FaseUI.tsx', 'app/api/onboarding/fase/route.ts', 'lib/mako-context.ts', 'app/conocimientos/AnalisisNegocio.tsx'],
    hallazgos: 'hallazgos-onboarding',
    nota: 'Falso amigo caro: lib/mako-fases.ts y /api/mako/fases NO son esta área — son las instrucciones de MaKo por sección del dashboard. La fase del negocio vive en fase-diagnostico.ts + fase-store.ts, y las dos entran juntas a lib/mako-context.ts (faseNegocioTexto vs getFaseInstruccion), que es donde más fácil se confunden. Ojo con la numeración: se muestran como 1..5 pero el array, los votos y la mediana son índice 0-4. No hay tabla: el diagnóstico se guarda en app_settings bajo la key negocio.fase.diagnostico.',
  },
  {
    slug: 'calendar-scheduling', titulo: 'Calendar & Scheduling', familia: 'Operate', grupo: 'Agenda y flujos',
    estado: 'parcial',
    alcance: 'De dónde entra una reunión (webhook de Calendly, widget embebido en el CRM) y cómo se mueve: el reagendado escribe en Google Calendar, no en Calendly.',
    vive: ['lib/google-calendar.ts', 'app/api/webhooks/calendly/route.ts', 'lib/calendly.ts', 'app/api/crm/horarios/route.ts', 'app/crm/horarios-respuesta.ts', 'app/api/integraciones/google-calendar', 'app/configuraciones/GoogleCalendarPanel.tsx', 'app/crm/calendly-widget.ts'],
    hallazgos: 'hallazgos-crm',
    nota: 'Reagendar toca Google a propósito: Calendly no tiene endpoint de reschedule, y menos sobre un evento que ya pasó, así que la única forma de que el invitado se entere es mover el evento en Google. Dos trampas más: la conexión de Google es global del dueño (OAuth offline guardado en app_settings, todavía no por workspace), y /api/crm/horarios NUNCA falla con error: un problema con Google vuelve como 200 con otro `codigo` y la grilla completa, así que hay que leer la respuesta por app/crm/horarios-respuesta.ts o la pantalla pinta horarios ocupados como libres.',
  },
  {
    slug: 'flow-editor', titulo: 'Flow Editor', familia: 'Operate', grupo: 'Agenda y flujos',
    estado: 'parcial', verEnApp: '/agencia',
    alcance: 'Editor y motor se rompen juntos: lib/flujos.ts entra al mismo área.',
    vive: ['app/agencia/FlujoEditor.tsx', 'lib/flujos-tipos.ts'],
  },

  // ─────────────────────────────────────────────────────────── Analyze
  {
    slug: 'dashboard', titulo: 'Dashboard', familia: 'Analyze',
    estado: 'listo', verEnApp: '/dashboard',
    alcance: 'El shell de los dos tableros de números: /dashboard solo redirige a /marketing y la barra GraphicsTabs conmuta entre Marketing y Comercial conservando el filtro de fecha (?desde&hasta).',
    vive: ['app/dashboard/page.tsx', 'app/_components/GraphicsTabs.tsx', 'app/_components/FechaFiltro.tsx'],
    proyectos: ['Feature: Dashboard'],
  },
  {
    slug: 'second-brain', titulo: 'Second Brain', familia: 'Analyze',
    estado: 'listo', verEnApp: '/second-brain',
    alcance: 'El hero de Analyze: hoy es el grafo del negocio + el mismo hub de 11 tabs del onboarding (lo que el cliente le cargó a MaKo); todavía no conecta señales ni saca conclusiones propias.',
    vive: ['app/second-brain/page.tsx', 'app/second-brain/VistaCerebro.tsx', 'app/second-brain/Grafo.tsx', 'app/second-brain/fisica.ts', 'app/second-brain/AreasHub.tsx', 'app/second-brain/BuscadorCerebro.tsx', 'app/second-brain/FiltroMapa.tsx', 'app/second-brain/ExportarCerebro.tsx', 'app/second-brain/BotonExportar.tsx', 'app/second-brain/BotonClaude.tsx', 'app/api/second-brain/', 'lib/cerebro-grafo.ts', 'lib/cerebro-modelo.ts', 'lib/cerebro-layout.ts', 'lib/cerebro-filtro.ts', 'lib/buscar-cerebro.ts', 'lib/vault.ts', 'lib/vault-modelo.ts', 'lib/bienvenida-cerebro.ts', 'scripts/medir-grafo.mjs', 'scripts/probar-grafo.mjs', 'scripts/probar-solape.mjs'],
    proyectos: ['Feature: Second Brain'],
  },
  {
    slug: 'competitor-spy', titulo: 'Competitor Spy', familia: 'Analyze',
    estado: 'por-construir', verEnApp: '/competitor-spy',
    alcance: 'Vigilar lo que hacen los demás (anuncios y ofertas de la competencia); es la única de Analyze que no analiza un activo propio. Hoy es ComingSoon; /market-analyst es la ruta vieja que redirige y la nav key sigue siendo \'market-an\'.',
    vive: ['app/competitor-spy/page.tsx', 'app/market-analyst/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: Competitor Spy'],
  },
  {
    slug: 'experiments', titulo: 'Experiments', familia: 'Analyze',
    estado: 'listo', verEnApp: '/experimentos',
    alcance: 'El shell de tres tabs (Retro · Experiments · Conclusions) con el estado de datos, el toast y el modo demo local sin Supabase. Gateado por PanelActivacion si Meta no está conectado, porque la Retro necesita métricas contra qué medir.',
    vive: ['app/experimentos/page.tsx', 'app/experimentos/ExperimentosApp.tsx', 'app/experimentos/ui.tsx', 'app/experimentos/_demo.ts', 'lib/experimentos.ts', 'app/api/experimentos/route.ts'],
    proyectos: ['Feature: Experiments'],
  },
  {
    slug: 'retro', titulo: 'Retro', familia: 'Analyze',
    estado: 'listo', agente: true, verEnApp: '/experimentos',
    alcance: 'El agente que corre 8 fases (memoria → recolección → auditoría → diagnóstico paralelo por área → cruces → cerebro → verificación → redacción) sobre un período y devuelve el reporte v3 (Overview · Plan · Detail) con hallazgos, plan encadenado a experimentos y tareas, gate del Perro y ejecución en vivo por stream NDJSON.',
    vive: ['app/experimentos/RetroTab.tsx', 'app/experimentos/RetroReport.tsx', 'lib/retro.ts', 'lib/retro-pipeline.ts', 'lib/retro-reporte.ts', 'lib/retro-datos.ts', 'lib/retro-fuentes.ts', 'lib/retro-gate.ts', 'lib/retro-seguimiento.ts', 'app/api/retro/route.ts'],
    proyectos: ['Agente: Retro'],
  },
  {
    slug: 'ads-analyst', titulo: 'Ads Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'listo', verEnApp: '/ads-analyst',
    alcance: 'Cruza el análisis cualitativo de Claude sobre el guion (ángulo, gancho, beats) con las métricas Meta×CRM de todo el histórico del anuncio; arriba viven Patrones (ganadores/a cortar/de proceso) y el Cuadrante de Retención. Sin filtro de fecha y gateado por Meta.',
    vive: ['app/ads-analyst/page.tsx', 'app/ads-analyst/ScriptsBrowser.tsx', 'lib/ads-analyst.ts', 'lib/script-angles.ts', 'lib/script-avatares.ts', 'app/api/ads-analyst/'],
    proyectos: ['Feature: Ads Analyst'],
  },
  {
    slug: 'landing-analyst', titulo: 'Landing Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'listo', verEnApp: '/landing-analyst',
    alcance: 'Baja la landing del cliente, le lee el copy y lo cruza con el comportamiento real de esa URL (beacon + agendas del CRM): lista de landings a la izquierda, diagnóstico con hallazgos por severidad a la derecha. A propósito NO se gatea por integración: con pegar una URL alcanza.',
    vive: ['app/landing-analyst/page.tsx', 'app/landing-analyst/LandingAnalystApp.tsx', 'lib/landing-analyst.ts', 'app/api/landing-analyst/'],
    proyectos: ['Feature: Landing Analyst'],
  },
  {
    slug: 'closing-analyst', titulo: 'Closing Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'listo', verEnApp: '/closing',
    alcance: 'Trae las llamadas de Fathom, las matchea con los leads del CRM y analiza al closer en las de VENTA (R1/R2) con método SPIN; las de entrega de servicio, internas y de prueba se detectan y se excluyen. Sin Fathom muestra PanelActivacion. Visible para rol closer.',
    vive: ['app/closing/page.tsx', 'app/closing/ClosingBrowser.tsx', 'lib/closing.ts', 'app/api/closing/'],
    proyectos: ['Feature: Closing Analyst'],
  },
  {
    slug: 'offer-analyst', titulo: 'Offer Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'por-construir', verEnApp: '/offer-analyst',
    alcance: 'Analizar la oferta del cliente (precio, promesa, garantía, qué la hace comprable). Hoy es ComingSoon puro: la page solo monta el placeholder.',
    vive: ['app/offer-analyst/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: Offer Analyst'],
  },
  {
    slug: 'vsl-analyst', titulo: 'VSL Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'por-construir', verEnApp: '/vsl-analyst',
    alcance: 'En qué tramo se cae el espectador del VSL, contra qué parte del guion, y qué pasó después con ese lead en el CRM. Hoy es ComingSoon.',
    vive: ['app/vsl-analyst/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: VSL Analyst'],
  },
  {
    slug: 'chat-analyst', titulo: 'Chat Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'por-construir', verEnApp: '/chat-analyst',
    alcance: 'Lo que Closing Analyst hace con las llamadas, pero con las conversaciones (WhatsApp, Email, Instagram): dónde se cae el chat, qué objeción aparece y qué responde mejor. Hoy es ComingSoon; visible para rol setter.',
    vive: ['app/chat-analyst/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: Chat Analyst'],
  },
  {
    slug: 'customer-success', titulo: 'Customer Success', familia: 'Analyze', grupo: 'Analysts',
    estado: 'parcial', verEnApp: '/customer-success', hallazgos: 'hallazgos-customer-success',
    alcance: 'Lo que pasa DESPUÉS del pago, para cualquier workspace. CONSTRUIDO (/customer-success): la cartera (los leads ganados del CRM), cuál necesita atención hoy y por qué (lib/cs-senal.ts, que además ORDENA la pantalla), qué dice el contrato, el trabajo abierto de ese cliente en el tablero, y el estado en la entrega —activo, pausado, graduado, baja—, que es una DECISIÓN que se marca a mano. SIN CONSTRUIR: el CS Analyst (/cs-analyst, ComingSoon), que anticipa una baja leyendo las llamadas de entrega, y los casos de éxito.',
    vive: ['app/customer-success/page.tsx', 'app/customer-success/ClientesApp.tsx', 'app/customer-success/DetalleCliente.tsx', 'app/customer-success/TrabajoCliente.tsx', 'app/customer-success/actions.ts', 'app/customer-success/trabajo.ts', 'app/customer-success/cruce.ts', 'lib/cs-cartera.ts', 'lib/cs-senal.ts', 'lib/cs-contrato.ts', 'lib/api-mako/areas/cs.def.ts', 'lib/api-mako/areas/cs.run.ts', 'lib/api-mako/areas/cs.helpers.ts', 'app/cs-analyst/page.tsx', 'app/_components/ComingSoon.tsx', 'app/admin/dev/customer-success/roadmap-cs.ts', 'docs/sprint-servicio-mauricio.md', 'public/vsl-assets/mako-cs.html'],
    proyectos: ['Feature: Customer Success'],
    nota: '⚠️ LA TAB SE REHÍZO DESDE CERO EL 26/09/2026 Y ESTA ENTRADA DECÍA OTRA COSA: figuraba «por-construir» apuntando a /cs-analyst (ComingSoon) cuando /customer-success existe y está desplegada desde el 11/08. Lo que se fue ese día es el programa de 44 clases de Mauricio —su temario, el cuestionario que su cliente contestaba por un link, su curso en Whop, los casos de otros clientes suyos y el banco de material—, junto con `app/customer-success/programa/`, once libs (`programa-catalogo`, `cs-respuestas`, `cs-avance`, `cs-reescritura`, `banco-skills`…), el webhook de Whop y las rutas del cuestionario. La tab ya no corta con `esWorkspaceDueno()`: es `requireCapa(\'customer-success\')` y lee con `getTenantDb()`. Por MaKo quedan TRES operaciones (ver_cartera_cs, ver_cliente_cs, marcar_estado_cliente_cs) y ninguna es `soloWs1`. ⚠️ Su Roadmap es PROPIO (`roadmapPropioDe` en paneles.tsx) y quedó VIEJO: su grupo «El bucle de entrega» describe el programa borrado. Pendiente: reescribirlo o retirarlo.',
  },
  {
    slug: 'youtube-analyst', titulo: 'YouTube Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'por-construir',
    alcance: 'El analista del canal de YouTube del cliente: qué video retiene, qué trae suscriptores y qué convierte. NO existe como ruta, carpeta ni entrada de nav — solo como proyecto del tablero /plan (estaba con 5 tareas y huérfano hasta que se lo sumó al catálogo).',
    vive: ['lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Feature: YouTube Analyst'],
  },
  {
    slug: 'meta-ads-ingest', titulo: 'Meta Ads Ingest', familia: 'Analyze', grupo: 'Ingesta de datos',
    estado: 'parcial',
    alcance: 'La tubería que trae el gasto y las métricas de Meta. Sin área, nadie la audita.',
    vive: ['app/api/cron/meta-daily/route.ts', 'lib/meta-ads.ts', 'lib/meta-descubrir.ts', 'app/api/ad-insights/route.ts', 'app/api/account-insights/route.ts', 'scripts/backfill-meta.ts'],
  },
  {
    slug: 'video-metrics-ingest', titulo: 'Video Metrics Ingest', familia: 'Analyze', grupo: 'Ingesta de datos',
    estado: 'parcial',
    alcance: 'Los dos crons que traen las métricas de video: YouTube para el orgánico y Panda para el VSL. Sin pantalla que diga si corrieron ni qué devolvieron.',
    vive: ['app/api/cron/youtube-daily/route.ts', 'app/api/cron/panda-daily/route.ts', 'lib/youtube.ts', 'lib/youtube-analytics.ts', 'lib/panda.ts', 'lib/vsl-retencion.ts', 'app/api/admin/youtube-check/route.ts', 'scripts/backfill-youtube-analytics.ts'],
  },
  {
    slug: 'vsl-tracking', titulo: 'VSL Tracking', familia: 'Analyze', grupo: 'Ingesta de datos',
    estado: 'parcial',
    alcance: 'El beacon público /api/track/vsl que recibe play, hitos y abandono desde la landing del cliente, la curva de retención que sale de vsl_events y el cron que avisa cuando una landing dejó de mandar.',
    // ⚠️ Este `vive` declaraba SIETE archivos y dejaba afuera casi todo el trabajo real
    // del área: el opt-in, el snippet del Pixel visto desde la pantalla que lo entrega,
    // la identidad de una página, los videos, Clarity y las cinco migraciones de agosto.
    // Entre el 13 y el 16/08 hubo ~35 commits y la mitad caía en rutas invisibles para
    // este panel. Es la regla de AGENTS.md «Una ruta que apunta a la nada»: el `vive`
    // cubre dónde cae el trabajo de verdad, no solo el endpoint que le da nombre al área.
    vive: [
      'app/api/track/vsl/route.ts', 'app/api/track/optin/route.ts',
      'lib/landing-token.ts', 'lib/landing-paginas.ts', 'lib/landing-videos.ts',
      'lib/landing-analisis.ts', 'lib/landing-config.ts', 'lib/vsl-retencion.ts', 'lib/panda.ts', 'lib/clarity.ts',
      'app/integraciones/ProbarTracking.tsx', 'app/integraciones/NombrarVideos.tsx',
      'app/integraciones/escuchando/page.tsx', 'app/integraciones/landing-actions.ts',
      'app/integraciones/landing-config-actions.ts', 'app/api/integraciones/landing/estado/route.ts',
      'app/api/cron/tracking-vigilante/route.ts', 'app/api/cron/clarity-vigilante/route.ts',
      'app/api/cron/prueba-grabacion/route.ts',
      'supabase/migrations/0121_vsl_events_segundos.sql', 'supabase/migrations/0133_vsl_events_detalle.sql',
      'supabase/migrations/0134_marcador_de_prueba.sql', 'supabase/migrations/0135_landing_visits_sv.sql',
      'supabase/migrations/0136_vsl_events_auto.sql', 'supabase/migrations/0137_vsl_events_landing_url.sql',
      'tests/vsl-retencion.test.ts', 'tests/landing-optin.test.ts',
      'tests/landing-paginas.test.ts', 'tests/landing-videos.test.ts', 'tests/clarity.test.ts',
    ],
    hallazgos: 'hallazgos-landing',
    nota: 'El beacon responde 200 aunque descarte el evento (falla en silencio por diseño) y el player de Panda no manda la duración en cada tick: el % se deriva server-side y un abandono sin % se guarda NULL, nunca 0. El vigilante NO puede usar correrPorWorkspace(\'landing\') porque «landing conectada» se define como «hay eventos recientes» — se excluiría justo al workspace roto; itera por landing_token.',
  },
  {
    slug: 'data-freshness', titulo: 'Data Freshness', familia: 'Analyze', grupo: 'Ingesta de datos',
    estado: 'por-construir',
    alcance: 'Los tres estados de cada fuente —fresca, sin datos recientes, apagada— y qué muestra la pantalla cuando el dato falta, para no dibujar un cero que en realidad es «no estamos midiendo».',
    vive: ['lib/sources.ts', 'lib/integraciones.ts', 'lib/tab-activacion.ts', 'app/_components/SourceStrip.tsx', 'app/_components/DashboardHeader.tsx', 'app/marketing/page.tsx', 'app/_components/PanelActivacion.tsx'],
    hallazgos: 'hallazgos-ui',
    nota: 'La ficha la da por construir, pero el motor ya existe y funciona: lib/sources.ts devuelve ok/stale/off. Lo que falta es el cableado — SourceStrip existe y está desmontado, DashboardHeader no tiene UN solo consumidor (grep verificado), y el único que llama getDataSources() hoy es app/marketing/page.tsx. La pieza que hay que construir es la UI, no la lógica.',
  },

  // ───────────────────────────────────────────────────── Sales Machine
  {
    slug: 'chatbot', titulo: 'Chatbot', familia: 'Sales Machine',
    estado: 'listo', agente: true, verEnApp: '/chatbot',
    alcance: 'El cockpit del agente que conversa: secuencias de mensajes con estrategia, simulación como lead, métricas y hand-off al humano. Su H1 en pantalla todavía dice «Chat Agent».',
    vive: ['app/chatbot/page.tsx', 'app/chatbot/ChatAgentApp.tsx', 'app/chat-bot/page.tsx', 'app/chat-agent/page.tsx', 'app/setting/page.tsx', 'lib/setting-estrategia.ts', 'lib/nutricion.ts', 'app/api/chat-agent/secuencias/route.ts'],
    proyectos: ['Agente: Chatbot'],
  },
  {
    slug: 'landing-generator', titulo: 'Landing Generator', familia: 'Sales Machine',
    estado: 'listo', verEnApp: '/landing-generator',
    alcance: 'MaKo escribe la página entera (estructura + copy bloque por bloque) desde el funnel y, si esa URL ya pasó por el Landing Analyst, sus hallazgos; con refinado por instrucción y guardado.',
    vive: ['app/landing-generator/page.tsx', 'app/landing-generator/LandingWriterApp.tsx', 'app/landing-writer/page.tsx', 'lib/landing-writer.ts', 'lib/landing-spec.ts', 'app/api/landing-writer/route.ts'],
    proyectos: ['Feature: Landing Generator'],
  },
  {
    slug: 'vsl-generator', titulo: 'VSL Generator', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/vsl-generator',
    alcance: 'Escribir el guion de un VSL. La pantalla es un ComingSoon y no hay lib propia ni API, pero el cimiento SÍ existe: lib/vsl-estructuras.ts (5 estructuras de VSL largo) se escribió para esta tab —el commit que lo creó dice «arrancando el VSL Writer»— y hoy además lo consume el Landing Analyst.',
    // ⚠️ Este `vive` eran tres archivos (page, redirect y nav) y dejaba afuera lo único
    // que el área tiene construido, así que su historial derivado de git no veía nada.
    vive: ['app/vsl-generator/page.tsx', 'app/vsl-writer/page.tsx', 'app/_components/nav.ts', 'lib/vsl-estructuras.ts', 'tests/vsl-estructuras.test.ts'],
    proyectos: ['Feature: VSL Generator'],
  },
  {
    slug: 'lead-magnet-generator', titulo: 'Lead Magnet Generator', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/lead-magnet-generator',
    alcance: 'Producir el lead magnet entregable. ComingSoon sin backend; el CONTENIDO del entregable ya se define en el onboarding (EntregableView), así que esta tab es la que lo materializa.',
    // El trabajo real del lead magnet NO cae en la tab: cae en el paso «Entregable»
    // del onboarding. Con solo page.tsx + nav.ts el historial del área eran commits
    // del sidebar y ni uno del entregable — un área movida que se leía tranquila.
    vive: ['app/lead-magnet-generator/page.tsx', 'app/_components/ComingSoon.tsx', 'app/_components/nav.ts', 'lib/entregable.ts', 'app/onboarding/EntregableView.tsx', 'app/api/onboarding/entregable/', 'lib/plan-proyectos-catalogo.ts', 'docs/modelo-oferta-producto-funnel.md'],
    proyectos: ['Feature: Lead Magnet Generator'],
  },
  {
    slug: 'sales-email', titulo: 'Sales Email', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/sales-email',
    alcance: 'Escribir los emails de venta. ComingSoon sin backend; distinto de /email (Operate), que es la bandeja de todos los días.',
    // La tab no tiene backend, pero el trabajo de «escribir el email de venta» SÍ
    // existe y cae en el escritor del compositor y en el generador de nutrición.
    // Sin esas rutas el historial del área eran commits del sidebar y ninguno de un email.
    vive: ['app/sales-email/page.tsx', 'app/_components/ComingSoon.tsx', 'app/_components/nav.ts', 'app/api/email/generar', 'lib/nutricion-generator.ts', 'lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Feature: Sales Email'],
    nota: 'El copy de venta ya se escribe entero en el compositor de /email (app/api/email/generar) y en el generador de nutrición. Antes de construir esta tab hay que contestar qué hace que aquello no haga: dos lugares para lo mismo garantizan que uno quede viejo.',
  },
  {
    slug: 'newsletters', titulo: 'Newsletters', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/newsletters',
    alcance: 'Escribir newsletters recurrentes a la lista. ComingSoon sin backend.',
    // Una newsletter, mirada desde el código, es un broadcast que se repite: el envío
    // a una lista, la baja y el dominio por cliente ya existen. Sin estas rutas el
    // historial del área eran commits del sidebar y ninguno de un envío.
    vive: ['app/newsletters/page.tsx', 'app/_components/ComingSoon.tsx', 'app/_components/nav.ts', 'app/api/email/broadcasts', 'lib/email-marketing.ts', 'lib/resend.ts', 'lib/plan-proyectos-catalogo.ts'],
    nota: 'Es la única de las ocho tabs de Sales Machine sin proyecto propio en lib/plan-proyectos-catalogo.ts: la fila «Sales Email» dice que cubre «el generador de emails de venta y las newsletters para el cliente», así que una tarea de newsletter no tiene lugar propio donde rutearse.',
  },
  {
    slug: 'closing-script', titulo: 'Closing Script', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/closing-script',
    alcance: 'El guion que usa el closer en la llamada. ComingSoon; su contraparte de ANÁLISIS (/closing, Closing Analyst) sí existe y funciona, así que el bucle natural es que ésta se alimente de aquélla.',
    // ⚠️ Este `vive` eran dos rutas: el stub (UN commit en toda su vida) y nav.ts
    // (68). El Change History automático mostraba 12 commits y ninguno hablaba del
    // área. Es el gemelo de «Una ruta que apunta a la nada»: una que apunta a TODO
    // tapa igual, y encima el panel parece lleno. Se amplió al escribir la bitácora
    // con los lugares donde SÍ cayó el trabajo de un área que todavía no existe: el
    // proyecto del catálogo, las preguntas que la definen, el mapa relevado y el
    // precio ya medido.
    vive: ['app/closing-script/page.tsx', 'app/_components/nav.ts', 'lib/plan-proyectos-catalogo.ts', 'docs/preguntas-para-llenar-proyectos.md', 'docs/dev-tabs-mapa.md', 'app/admin/dev/pricing/modelo.ts', 'app/admin/dev/closing-script/bitacora.ts'],
    proyectos: ['Feature: Closing Script'],
  },
  {
    slug: 'sales-roleplay', titulo: 'Sales Roleplay', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/sales-roleplay',
    alcance: 'Entrenar la llamada contra MaKo haciendo de prospecto. ComingSoon; el patrón de «MaKo hace de cliente» ya está resuelto en el paso ④ ensayo del Chatbot y es de donde debería copiarse.',
    vive: ['app/sales-roleplay/page.tsx', 'app/chatbot/OnboardingChatAgent.tsx'],
    proyectos: ['Feature: Sales Roleplay'],
  },
  {
    slug: 'post-call-follow-up', titulo: 'Post-Call Follow-up', familia: 'Sales Machine',
    estado: 'parcial', agente: true,
    alcance: 'Webhook de Fathom → borrador. Falta el go-live.',
    vive: ['lib/post-llamada.ts', 'lib/closing.ts'],
  },

  // ─────────────────────────────────────────────────── Content Machine
  {
    slug: 'ideas', titulo: 'Ideas', familia: 'Content Machine',
    estado: 'por-construir', verEnApp: '/ideas',
    alcance: 'De qué hablar, antes de que haya pieza; va suelto arriba porque no es de ningún canal. ComingSoon, pero el norte ya está escrito: «un input suelto al estilo Mila que se guía hasta convertirse en guion».',
    vive: ['app/ideas/page.tsx', 'app/admin/dev/ads-writer/bitacora.ts'],
    proyectos: ['Feature: Ideas'],
  },
  {
    slug: 'transcription-pipeline', titulo: 'Transcription Pipeline', familia: 'Content Machine',
    estado: 'listo',
    alcance: 'Audio→texto: lo usan WhatsApp, reuniones y los analysts. Compartido y sin dueño.',
    vive: ['lib/transcribe.ts', 'app/api/cron/transcribe-ads/route.ts', 'app/api/regenerate-transcript/route.ts', 'app/api/mako/knowledge/transcribe/route.ts', 'scripts/backfill-transcripts.ts', 'scripts/check-transcripts.mjs'],
  },
  {
    slug: 'ads-writer', titulo: 'Ads Writer', familia: 'Content Machine', grupo: 'Ads',
    estado: 'listo', verEnApp: '/ads-writer',
    alcance: 'La fábrica de guiones de anuncios: una sola acción primaria («Escribir el próximo guion»), cobertura arriba y dos vistas montadas en paralelo (Anuncios y Guiones). En pantalla se titula «Content Machine».',
    vive: ['app/ads-writer/page.tsx', 'app/ads-writer/AdsWriterApp.tsx', 'lib/razones.ts', 'lib/guion-estado.ts', 'app/api/onboarding/razones/route.ts'],
    proyectos: ['Feature: Ads Writer'],
  },
  {
    slug: 'creative-factory', titulo: 'Creative Factory', familia: 'Content Machine', grupo: 'Ads',
    estado: 'listo',
    alcance: 'Las capas que arman los creativos: avatares segmentables, razones de compra, la matriz avatar×razón con su copy y guion, el entregable tangible, la cara de marca y la biblioteca de formatos.',
    vive: ['lib/razones.ts', 'lib/avatares.ts', 'app/onboarding/MatrizView.tsx', 'app/api/onboarding/razones/route.ts', 'lib/angulos-formatos.ts', 'lib/entregable.ts', 'lib/persona.ts', 'app/onboarding/OnboardingTabs.tsx'],
    proyectos: ['Feature: Fábrica de creativos'],
    hallazgos: 'hallazgos-ia',
    nota: 'El código NO vive en una tab propia: vive bajo app/onboarding/ y se monta dos veces (OnboardingWizard para el cliente nuevo, OnboardingTabs para el Archivero), y MatrizView además se reusa desde app/ads-writer/AdsWriterApp.tsx — tocarla impacta tres pantallas. Ojo con el shape RazonCelda: está duplicado en 4 archivos y ya divergió. Las decisiones de producto de la fábrica están en hallazgos-ads, no en hallazgos-ia.',
  },
  {
    slug: 'image-generator', titulo: 'Image Generator', familia: 'Content Machine', grupo: 'Ads',
    estado: 'por-construir', verEnApp: '/image-generator',
    alcance: 'Generar la imagen del anuncio. ComingSoon; sus dos insumos ya existen (Brand Persona con las fotos y el formato de imagen elegido en el Ad Detail), falta el generador.',
    vive: ['app/image-generator/page.tsx', 'lib/persona.ts', 'app/admin/dev/ads-writer/bitacora.ts'],
    proyectos: ['Feature: Image Generator'],
  },
  {
    slug: 'video-generator', titulo: 'Video Generator', familia: 'Content Machine', grupo: 'Ads',
    estado: 'parcial', verEnApp: '/video-generator',
    alcance: 'El anuncio en video, de punta a punta: guiones cargados → tomas y montaje → el pedido que sale por el puente a Google Flow → el editor de cortes y la descarga. La GENERACIÓN no pasa por acá: la hace el puente (área «Puente a Google Flow»), que es lo que habla con Flow.',
    // ⚠️ Este `vive` declaraba `page.tsx` y `app/admin/dev/ads-writer/bitacora.ts`, y
    // el área tenía 35 archivos. Es la trampa que ya documenta `reels` acá abajo, en
    // su peor forma: la bitácora de OTRA área es de las más calientes del repo, así
    // que el Change History derivado se llenaba con los 12 commits de ads-writer y no
    // había un solo commit de video-generator adentro. No es que faltara historia:
    // estaba DESPLAZADA por un archivo prestado, y el área figuraba «por-construir»
    // mientras era la más movida del mes.
    vive: ['app/video-generator', 'lib/video-planner.ts', 'lib/puestas-data.ts'],
    proyectos: ['Feature: Video Generator'],
    hallazgos: 'hallazgos-generativa',
  },
  {
    slug: 'reels', titulo: 'Reels', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'parcial', verEnApp: '/reels',
    alcance: 'El GUION del reel de Instagram, construido el 15/08: pedido (tema + objetivo + duración) → guion tipado (gancho con frase, título en pantalla y visual · escenas con locución e indicación de cámara · moraleja · CTA con palabra clave · caption) → borrador en /instagram. Falta historial durable y que los prompts sean editables desde /configuraciones.',
    // ⚠️ Este `vive` declaraba DOS rutas y una de ellas era app/_components/nav.ts,
    // que es de las más calientes del repo: el Change History derivado se queda con
    // los últimos 12 commits, así que nav.ts se los comía TODOS. Medido el 17/08 en
    // _historial.generado.ts: los 12 de `reels` son sha por sha los mismos que los de
    // `carousels`, y ninguno habla de ninguna de las dos tabs. Un archivo compartido
    // adentro de un `vive` no suma historia: DESPLAZA la propia.
    vive: [
      'app/reels/page.tsx', 'app/reels/ReelsApp.tsx', 'app/reels/actions.ts',
      'app/reels/reel-pedido.ts', 'app/reels/reels-datos.ts',
      'lib/ig-writer.ts', 'lib/ig-formatos.ts', 'lib/ig-contenido.ts',
      'lib/model-catalogo.ts', 'lib/tab-onboarding-state.ts', 'app/_components/nav.ts',
    ],
    proyectos: ['Feature: Reels'],
    hallazgos: 'hallazgos-comunicacion',
    nota: 'El motor NO vive acá: lib/ig-writer.ts lo comparten las tres tabs del grupo Instagram (Reels, Carousels, Stories) y lib/ig-formatos.ts es la fuente única de límites técnicos y metodología — tocar cualquiera de los dos impacta las tres. Dos trampas propias: el tag `reels-writer` tiene que existir idéntico en lib/model-catalogo.ts o la llamada queda VETADA (no hay modelo por default), y generarPieza corta el pedido a 4.000 caracteres EN SILENCIO, por eso reel-pedido.ts topea campo por campo antes de componer.',
  },
  {
    slug: 'carousels', titulo: 'Carousels', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'parcial', verEnApp: '/carousels',
    alcance: 'El carrusel de Instagram lámina por lámina, construido el 15/08: pedido (tema + tipo educativo/storytelling/venta) → slides tipadas (texto dentro de la imagen + escena visual) + caption → borrador en /instagram. El historial se pierde al recargar y los prompts todavía no son editables.',
    // ⚠️ Mismo caso que reels: el `vive` declaraba DOS rutas, una de ellas
    // app/_components/nav.ts, y el Change History derivado (últimos 12 commits) se
    // llenaba con commits de la barra. Medido el 17/08: el bloque `"carousels"` de
    // _historial.generado.ts es idéntico al de `"reels"` y no habla de ninguna tab.
    vive: [
      'app/carousels/page.tsx', 'app/carousels/CarouselsApp.tsx',
      'app/carousels/OnboardingCarousels.tsx', 'app/carousels/actions.ts',
      'lib/ig-writer.ts', 'lib/ig-formatos.ts', 'lib/ig-contenido.ts',
      'lib/model-catalogo.ts', 'lib/tab-onboarding-state.ts', 'app/_components/nav.ts',
    ],
    proyectos: ['Feature: Carousels'],
    hallazgos: 'hallazgos-comunicacion',
    nota: 'El motor (lib/ig-writer.ts) y la metodología (lib/ig-formatos.ts) los comparte con Reels y Stories: tocarlos impacta las tres. Lo propio de esta tab: METODOLOGIA_CARRUSEL abre con un AVISO de que los cursos comprados casi no tienen material de carrusel —la taxonomía educativo/storytelling/venta de actions.ts es criterio general, NO doctrina de curso—; el saneo RECHAZA con menos de 2 slides y RECORTA con más de 10, a propósito y por motivos distintos; y quedan dos desvíos respecto de sus tabs hermanas: el paso `carousels_instagram` nunca se marca (reels y stories usan la key compartida `conectar`) y CarouselsApp.tsx importa solo Pagina y Button de app/_ui, estilando el resto a mano.',
  },
  {
    slug: 'stories', titulo: 'Stories', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'parcial', verEnApp: '/stories',
    alcance: 'El DÍA de stories de Instagram: una sola idea, el objetivo (conexión / venta / interacción), el storyboard frame por frame con su indicación de producción, y cada frame como borrador en /instagram. Construida el 15/08 sobre el motor compartido con Reels y Carousels; sin historial durable (la secuencia vive en memoria de la página) y con los prompts todavía no editables.',
    vive: [
      'app/stories/page.tsx', 'app/stories/StoriesApp.tsx', 'app/stories/Storyboard.tsx',
      'app/stories/actions.ts', 'app/stories/objetivos.ts', 'app/stories/OnboardingStories.tsx',
      'lib/ig-formatos.ts', 'lib/ig-writer.ts', 'lib/ig-contenido.ts',
      'app/_components/nav.ts',
    ],
    proyectos: ['Feature: Stories'],
  },
  {
    slug: 'youtube-writer', titulo: 'YouTube Writer', familia: 'Content Machine', grupo: 'YouTube',
    estado: 'por-construir', verEnApp: '/youtube-writer',
    alcance: 'Escribir el guion de un video de YouTube. ComingSoon sin backend.',
    // ⚠️ Mismo caso que Closing Script: eran el stub (UN commit) y nav.ts (68), así
    // que el Change History automático se llenaba con la barra del super admin y el
    // área quedaba invisible. Se amplió con donde SÍ cayó su trabajo. Y ojo con el
    // nombre: `lib/youtube*.ts` y el cron `youtube-daily` NO son esta área, son el
    // canal propio de la agencia (`gtm-youtube`).
    vive: ['app/youtube-writer/page.tsx', 'app/_components/nav.ts', 'lib/plan-proyectos-catalogo.ts', 'docs/preguntas-para-llenar-proyectos.md', 'docs/dev-tabs-mapa.md', 'app/admin/dev/pricing/modelo.ts', 'app/admin/dev/youtube-writer/bitacora.ts'],
    proyectos: ['Feature: YouTube Writer'],
  },
  {
    slug: 'thumbnails', titulo: 'Thumbnails', familia: 'Content Machine', grupo: 'YouTube',
    estado: 'por-construir', verEnApp: '/thumbnails',
    alcance: 'Generar las miniaturas del video. ComingSoon sin backend: la ruta son 8 líneas. Lo único decidido es el lugar (Content Machine · YouTube) y la economía — US$0,068 las 2 variantes, 160 MT, cobrado por INTENTO (app/admin/dev/pricing/modelo.ts). Los 12 thumbnails/mes del Growth son un supuesto sin medir.',
    // ⚠️ El área NO tiene código propio más allá del ComingSoon, así que su Change
    // History automático se llena de commits de `nav.ts` que no son suyos (12 medidos,
    // ninguno del área). Lo que sí es suyo está en su bitácora escrita a mano — por eso
    // va en `vive`, igual que Ideas / Image / Video Generator apuntan a la de ads-writer.
    vive: ['app/thumbnails/page.tsx', 'app/admin/dev/thumbnails/bitacora.ts', 'app/_components/nav.ts'],
    proyectos: ['Feature: Thumbnails'],
  },

  // ────────────────────────────────────────────────────────────── MaKo
  {
    slug: 'preguntale-a-mako', titulo: 'Preguntale a MaKo', familia: 'MaKo',
    estado: 'listo', agente: true, verEnApp: '/mako',
    alcance: 'El agente conversacional dentro de la app: chat general + la lista de TODAS las conversaciones (una por gráfico). Es capacidad global, no una tab más. NO es el chat por WhatsApp (eso es MaKo Doer).',
    vive: ['app/mako/page.tsx', 'app/mako/MakoTab.tsx', 'app/api/mako/knowledge/route.ts', 'app/api/mako/prompts/route.ts', 'lib/mako-context.ts'],
    proyectos: ['Feature: Preguntale a MaKo'],
  },
  {
    slug: 'mako-doer', titulo: 'MaKo Doer', familia: 'MaKo',
    estado: 'parcial', agente: true,
    alcance: 'El agente que ESCUCHA en los grupos de WhatsApp y actúa: decide si contesta (modo libre vs. ventana), muestra «escribiendo…», elige el tier del modelo por turno y corre el loop de tools. NO es el chat dentro de la app (eso es «Preguntale a MaKo»).',
    vive: ['lib/mako-doer-in.ts', 'lib/mako-router.ts', 'lib/mako-intencion.ts', 'lib/mako-doer-acciones.ts', 'lib/mako-doer-buffer.ts', 'lib/mako-doer-conv.ts', 'lib/respuesta-doer.ts', 'lib/puntos-mensaje.ts', 'lib/vcard.ts', 'app/api/webhooks/evolution/route.ts', 'app/api/admin/mako-doer/route.ts', 'app/api/cron/doer-flush/route.ts'],
    proyectos: ['Agente: MaKo Doer'],
  },
  {
    slug: 'whatsapp-de-mako', titulo: 'WhatsApp de MaKo', familia: 'MaKo',
    estado: 'listo', verEnApp: '/agencia',
    alcance: 'La tab del canal PROPIO de la agencia: la línea de MaKo por QR, sus grupos y sus plantillas. No es preview de ningún cliente ni el /whatsapp del producto.',
    vive: ['app/agencia/page.tsx', 'app/agencia/AgenciaTabs.tsx'],
    proyectos: ['Feature: WhatsApp de MaKo'],
  },
  {
    slug: 'contexto-de-mako', titulo: 'Contexto de MaKo', familia: 'MaKo',
    estado: 'listo', verEnApp: '/contexto',
    alcance: 'La tab donde la agencia le carga el cerebro a MaKo: Conocimiento (RAG), Fases y Prompts. No es configuración de tu cuenta.',
    vive: ['app/contexto/page.tsx', 'app/contexto/ContextoTabs.tsx'],
    proyectos: ['Feature: Contexto de MaKo'],
  },
  {
    slug: 'modelos-ia', titulo: 'Modelos IA', familia: 'MaKo',
    estado: 'listo', verEnApp: '/modelos-ia',
    alcance: 'Qué modelo/IA corre cada tarea de la app, con la recomendación del audit y el override que re-rutea las llamadas de verdad en runtime. Es el control de COSTO, no la infraestructura.',
    vive: ['app/modelos-ia/page.tsx', 'app/modelos-ia/ModelosIA.tsx', 'lib/model-registry.ts', 'app/api/admin/modelos/route.ts'],
    proyectos: ['Feature: Modelos IA'],
  },
  {
    slug: 'semaforo', titulo: 'El semáforo', familia: 'MaKo',
    estado: 'listo',
    alcance: 'El verde/ámbar/rojo/gris que atraviesa el producto —la salud de Meta, el estado de una campaña— y el motor de avisos que lo pone en palabras: un solo choke point y 49 mensajes de catálogo.',
    vive: ['lib/mako-gramatica.ts', 'lib/meta-health-ui.ts', 'lib/meta-health.ts', 'lib/avisos-catalogo.ts', 'lib/avisos.ts'],
    proyectos: ['Avisos y reportes'],
  },
  {
    slug: 'ai-runtime-cascada', titulo: 'AI Runtime & Cascada', familia: 'MaKo',
    estado: 'listo',
    alcance: 'El motor que ejecuta toda llamada de IA: chatClaude y el loop de tool-use, la cascada de proveedores gratis antes de pagar, y el override de qué modelo usa cada feature desde /modelos-ia.',
    vive: ['lib/anthropic.ts', 'lib/ai-cheap.ts', 'lib/veto-claude.ts', 'lib/model-registry.ts', 'lib/model-catalogo.ts', 'lib/ia-keys.ts', 'lib/ia-keys-ws.ts', 'lib/ia-mensajes.ts', 'app/modelos-ia/ModelosIA.tsx', 'app/api/admin/modelos/route.ts', 'app/_components/ErrorIA.tsx', 'app/_components/ConectarIA.tsx', 'tests/veto-claude.test.ts', 'tests/model-registry.test.ts', 'tests/ia-mensajes.test.ts', 'tests/ia-keys.test.ts'],
    hallazgos: 'hallazgos-ia',
    nota: 'Las «916 líneas» son lib/anthropic.ts (301) + lib/ai-cheap.ts (615), verificado. Dos trampas: el override de /modelos-ia SOLO aplica si el caller no pasó `model` explícito (cualquier `chatClaude(..., { model })` se saltea el registro entero), y el catálogo vive aparte en lib/model-catalogo.ts —sin `server-only`, para poder testearlo— pero nadie lo importa directo: model-registry.ts lo re-exporta. El fallback pago está adentro de chatClaude, no en el registro: si toda la cascada gratis falla cae a claude-sonnet-5 y deja la nota visible en el historial.',
  },
  {
    slug: 'ai-spend-cuotas', titulo: 'AI Spend & Cuotas', familia: 'MaKo',
    estado: 'parcial',
    alcance: 'El medidor: una fila en anthropic_usage por llamada, el precio por modelo, el saldo cargado a mano y cuánto queda de cada free tier. Se ve en Integraciones › Costo de MaKo.',
    // ⚠️ Ampliado el 17/08 (regla «Una ruta que apunta a la nada»): el trabajo de
    // agosto —rotación multi-cuenta, la cuota medida POR CUENTA, el veto de Claude
    // y el mensaje que lee el que se quedó sin IA— cae casi todo en archivos que
    // NO estaban acá ni en ningún otro `vive[]`, así que el panel de historial del
    // área veía una fracción de sus commits. Se suman la maquinaria de keys por
    // cuenta (`ia-keys*`), la migración que la sostiene (0132), el texto y la
    // salida que ve el usuario (`ia-mensajes`, `ConectarIA`, `ErrorIA`) y la única
    // puerta de gasto a Claude (`veto-claude`, que escribe su propia fila de US$0
    // en el medidor).
    vive: ['lib/anthropic-usage.ts', 'lib/ia-cuotas.ts', 'lib/costos-ia.ts', 'lib/ia-keys.ts', 'lib/ia-keys-ws.ts', 'lib/ia-mensajes.ts', 'lib/veto-claude.ts', 'app/api/anthropic-usage/route.ts', 'app/api/costos-ia/route.ts', 'app/api/ia/proveedores/route.ts', 'app/integraciones/IntegracionesBoard.tsx', 'app/_components/IaUsageToast.tsx', 'app/_components/ConectarIA.tsx', 'app/_components/ErrorIA.tsx', 'supabase/migrations/0132_uso_por_cuenta.sql', 'lib/ia-labels.ts'],
    hallazgos: 'hallazgos-ia',
    nota: 'El «cortarlo» del alcance NO existe todavía: `ordenarPorCuota` (lib/ia-cuotas.ts:86-93) reordena proveedores pero nunca saca ninguno, y todos los `recordUsage` son POSTERIORES a la llamada — el enforcement hay que escribirlo entero y pre-flight. Y el «por cliente» tampoco: getSaldo/setSaldo clavan `.eq(\'workspace_id\', OWNER_WS)` y getUsageSummary lee anthropic_usage sin filtro de workspace, aunque las keys ya sean BYOK. Ojo con el solape: el área `pricing` de /admin/dev ya declara lib/costos-ia.ts, lib/anthropic-usage.ts, lib/ia-cuotas.ts y app/api/costos-ia/ — pricing es el modelo de negocio, esta área es el medidor.',
  },

  // ────────────────────────────────────────────────────────── Business
  {
    // Va PRIMERA del grupo a propósito: es el análisis que decide los precios, y
    // las otras tres son la maquinaria que los cobra. Sin esto, «Free / Pro /
    // Growth» son tres números elegidos a ojo.
    slug: 'pricing', titulo: 'Pricing', familia: 'Business', grupo: 'Cobros y planes',
    estado: 'parcial',
    alcance: 'Cuánto cuesta la IA de verdad y qué plan la aguanta: el costo medido por acción, los escenarios de ruteo, los cupos de MaKo Tokens y lo que falta para poder cobrarlos.',
    verEnApp: '/integraciones#saldo-ia',
    vive: ['app/admin/dev/pricing/modelo.ts', 'app/admin/dev/pricing/Pricing.tsx', 'lib/costos-ia.ts', 'app/api/costos-ia/route.ts', 'docs/costos-ia-y-planes.md'],
    proyectos: ['Feature: Cobros y planes'],
    hallazgos: 'hallazgos-ia',
    nota: 'El hallazgo que decide no es de costos sino de PRECIO: ChartMogul mide 23% de retención bruta anual en productos AI-native de menos de US$50/mes (45% entre 50 y 249, 70% arriba de 250), o sea que el Pro a US$47 cae en la peor banda por dos dólares. Y una reunión de venta cuesta US$666-900 contra un ACV de US$564. Ojo con el solape: esta área es el MODELO DE NEGOCIO; el medidor de consumo es `ai-spend-cuotas`. Cada número de modelo.ts dice si es medido, publicado o supuesto — y hay uno marcado «no usar» que circula por ocho sitios sin estudio primario detrás.',
  },
  {
    slug: 'plans-entitlements', titulo: 'Plans & Entitlements', familia: 'Business', grupo: 'Cobros y planes',
    estado: 'parcial',
    alcance: 'Free / Pro / Growth. La maquinaria YA corre con 3 capas hardcodeadas en lib/capas.ts y sin noción de plan.',
    vive: ['lib/capas.ts', 'lib/tab-access.ts', 'lib/ws-tab.ts', 'app/_components/nav.ts', 'app/admin/AdminView.tsx', 'app/api/admin/usuarios/route.ts', 'app/api/admin/workspaces/route.ts', 'lib/usuarios.ts', 'lib/invitaciones.ts', 'lib/invitacion-aviso.ts', 'app/equipo/EquipoView.tsx', 'app/api/equipo/route.ts', 'app/_ui/Estados.tsx', 'docs/costos-ia-y-planes.md', 'supabase/migrations/0092_workspace_capa.sql', 'supabase/migrations/0138_usuarios_invitacion_enviada.sql'],
    proyectos: ['Feature: Cobros y planes'],
    hallazgos: 'hallazgos-ia',
    nota: 'El vive[] listaba solo el gating y por eso el área se veía muerta: el trabajo de agosto cayó en el ALTA de una persona —lo único que hoy existe entre el pago y el primer login— y en el diseño de los planes (docs/costos-ia-y-planes.md). Ampliado el 17/08 por la regla «una ruta que apunta a la nada». Dos cosas que conviene saber antes de tocar: la capa hace de entitlement SIN saberlo (una categoría de integración que no está en capas.ts → categoriasIntegraciones no se ve, y ausencia y prohibición se ven igual), y PermissionState de app/_ui/Estados.tsx ya tiene el motivo «plan» que hoy NADIE emite, porque no hay estado de suscripción por workspace.',
  },
  {
    slug: 'payment-gateway', titulo: 'Payment Gateway', familia: 'Business', grupo: 'Cobros y planes',
    estado: 'por-construir',
    alcance: 'Cobrarle al cliente de verdad: Stripe, el checkout, los webhooks de pago y los recibos. Hoy no hay una sola línea de eso en el repo.',
    vive: [],
    nota: 'El grep de «stripe» da exactamente dos falsos positivos, y conviene saberlo para no perder el tiempo: el regex que TAPA claves sk_live_… en lib/agente-redaccion.ts:43, y un caso de prueba del ruteo del Perro en scripts/probe-perro-gemini.ts:28. El proyecto del tablero al que rutean estas tareas se llama «Cobros y planes» (lib/plan-proyectos-catalogo.ts:145), no «Payment Gateway».',
  },
  {
    slug: 'subscriptions-billing', titulo: 'Subscriptions & Billing', familia: 'Business', grupo: 'Cobros y planes',
    estado: 'por-construir',
    alcance: 'El ciclo de vida de la suscripción a MaKo: alta, trial, upgrade, downgrade, dunning y baja. Nada de eso existe; lo único decidido son los planes y sus cupos.',
    vive: [],
    nota: 'Los planes YA están definidos con números en app/admin/dev/pricing/modelo.ts (PLANES: Free US$0/1.500 MT, Pro US$47/12.000 MT, Growth US$97/25.000 MT), pero eso es una proyección para decidir precio, no un motor de facturación: no hay estado de suscripción por workspace, ni trial, ni dunning. TRAMPA DE NOMBRE: «Suscripciones recurrentes» (#363, getMrrActivo / suscripcion_monto_usd en app/comercial y app/crm) son las suscripciones que el CLIENTE le cobra a SUS clientes desde el CRM — no las nuestras. Y ojo con duplicar: /admin/dev ya tiene un área con slug `pricing` (app/admin/dev/areas.ts) que reclama el costo y los cupos de IA.',
  },
  {
    slug: 'saas-metrics', titulo: 'SaaS Metrics', familia: 'Business', grupo: 'Cobros y planes',
    estado: 'por-construir',
    alcance: 'Los números del negocio MaKo: MRR, churn, LTV y CAC propios. Hoy no se mide ninguno — sin suscripciones no hay qué medir, y lo que hay son benchmarks para proyectar precios.',
    vive: [],
    nota: 'El MRR que sí existe en el código es el del CLIENTE (getMrrActivo de lib/queries, pintado en app/comercial/page.tsx): es su CRM, no nuestro negocio. Confundirlos es el error fácil acá. Lo que sí está investigado y con fuente citada es ECONOMIA en app/admin/dev/pricing/modelo.ts (retención por banda de precio de ChartMogul, LTV:CAC mediana 4,1×, margen bruto 53% de ICONIQ) — sirve de insumo, no es medición. Y «Unit economics: CAC, churn y payback» figura como pendiente abierto en app/admin/dev/pricing/bitacora.ts, con la nota de que la venta con llamada encarece el CAC muchísimo frente a self-serve.',
  },
  {
    slug: 'legal-compliance', titulo: 'Legal & Compliance', familia: 'Business', grupo: 'Legal',
    estado: 'por-construir',
    alcance: 'Los papeles del negocio: términos, privacidad, tratamiento de datos, LLC y fiscal. Cero código: no hay /terminos ni /privacidad, y el footer de la landing pública no linkea ninguno.',
    vive: [],
    proyectos: ['Legal y fiscal'],
    nota: 'Verificado: no existe ninguna ruta legal bajo app/, no hay PDFs ni textos en public/, y el bloque FOOTER de app/vsl/landing-html.ts es solo el logo — sin un solo link. La landing /vsl es pública y agenda por Calendly (datos personales de un tercero) sin términos ni política de privacidad a la vista. Antecedente útil: el Perro repartía lo legal por palabra suelta (los ToS caían en «Vender MaKo: Landing y VSL», la LLC en «Cobros y planes»); scripts/mover-legales.ts las reubicó al proyecto «Legal y fiscal» del catálogo (lib/plan-proyectos-catalogo.ts:176), que es transversal y explícitamente NO es la pantalla de cobros.',
  },
  {
    slug: 'account-offboarding', titulo: 'Account Offboarding', familia: 'Business', grupo: 'Legal',
    estado: 'por-construir',
    alcance: 'Que el cliente se baje sus datos y borre su cuenta. Ninguna de las dos existe de cara al usuario: lo único que vacía un workspace es el reset del cliente de prueba.',
    vive: [],
    hallazgos: 'hallazgos-infra',
    nota: 'La máquina que habría que reusar es lib/reset-workspace.ts (borra 50+ tablas y 4 buckets de storage), pero está gateada al ws 3 por exigirClienteDePrueba (lib/auth-session.ts) tras el incidente en que el botón de vaciar estaba disponible en todos los clientes reales (hallazgos-seguridad). LA TRAMPA que hundiría un «borrar mi cuenta» construido encima: su lista TABLAS_RESET NO coincide con TENANT_TABLES de lib/workspace.ts (hallazgos-infra:321), así que quedarían datos vivos del cliente que dijo que se iba. Del lado del export, lo único que hay es app/crm/leads-exportar.ts, que baja leads y nada más.',
  },
  {
    slug: 'public-site', titulo: 'Public Site', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'listo',
    alcance: 'La landing + las 25 páginas de detalle. Lo único que ve un prospecto antes de pagar.',
    vive: ['app/page.tsx', 'app/vsl/Landing.tsx', 'app/vsl/landing-html.ts', 'app/vsl/showcase.ts', 'app/vsl/_detalle/FeatureDetail.tsx', 'app/vsl/_detalle/features.ts', 'app/vsl/estrategia/Estrategia.tsx'],
    proyectos: ['Vender MaKo: Landing y VSL'],
  },
  {
    slug: 'gtm-ads', titulo: 'GTM: Ads', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'parcial',
    alcance: 'La publicidad paga de MaKo para MaKo: la campaña de mensajes a WhatsApp que corre hoy, su plan de gasto, y el VSL Funnel propio con ads que espera a que haya caja.',
    vive: ['app/vsl/estrategia/Estrategia.tsx', 'lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Vender MaKo: Ads'],
    hallazgos: 'hallazgos-landing',
    nota: 'El único código propio es el doc interno /vsl/estrategia (app/vsl/estrategia/Estrategia.tsx): el canal B «campaña de mensajes» con su escalerita de métricas —8 de las 15 llamadas agendadas, US$125 por agenda, US$500 por cliente, 3× de retorno— y el plan de gasto US$1.000 de ads sobre US$10.000 facturados. El canal E (VSL Funnel propio + ads) queda para cuando la campaña dé señal. La ejecución vive fuera del repo, en el Ads Manager de Meta. NO CONFUNDIR con app/ads-manager, app/marketing ni app/ads-writer: eso es el producto que se le vende al cliente.',
  },
  {
    slug: 'gtm-instagram', titulo: 'GTM: Instagram', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'por-construir',
    alcance: 'La cuenta de Instagram propia de MaKo: perfil, bio, reels, historias, destacadas y calendario de publicación. No hay nada en el repo, ni siquiera una sección en el doc de estrategia.',
    vive: [],
    proyectos: ['Vender MaKo: Orgánico Instagram'],
    nota: 'HOMONIMIA PELIGROSA: app/instagram/page.tsx sí existe, pero es un <ComingSoon> del PRODUCTO (una tab del cliente), no la cuenta propia — quien busque por nombre va a aterrizar ahí y va a creer que encontró el área. Lo único de MaKo es el proyecto «Vender MaKo: Orgánico Instagram» declarado en lib/plan-proyectos-catalogo.ts:182 y, de refilón, el canal D «Orgánico + Lead Magnet» del doc de estrategia, que es genérico (los mismos creativos de la campaña + ManyChat) y está en la lista de futuros.',
  },
  {
    slug: 'gtm-youtube', titulo: 'GTM: YouTube', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'por-construir',
    alcance: 'El canal de YouTube propio de MaKo: banner, bio, videos largos, el video pilar y los CTA. Cero código, y ni siquiera figura como canal en el doc de estrategia.',
    vive: [],
    proyectos: ['Vender MaKo: Orgánico YouTube'],
    nota: 'Misma homonimia que Instagram: app/youtube-writer/page.tsx es un <ComingSoon> del producto para el cliente, no el canal propio. El área existe solo como proyecto del tablero en lib/plan-proyectos-catalogo.ts:183. De los siete canales que enumera /vsl/estrategia (A prospección, B campaña de mensajes, C referidos, D orgánico+lead magnet, E VSL funnel+ads, F webinar, G infoproductores), YouTube no es ninguno — es el área con menos base escrita de todo el bloque GTM.',
  },
  {
    slug: 'gtm-prospeccion', titulo: 'GTM: Prospección', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'parcial',
    alcance: 'Salir a buscar clientes de a uno: listas, mensajes en frío, un Loom VSL por lead y el seguimiento. Es el canal A, costo cero, y hoy trae 7 de las 15 llamadas del mes proyectado.',
    vive: ['app/vsl/estrategia/Estrategia.tsx', 'lib/plan-proyectos-catalogo.ts'],
    proyectos: ['Vender MaKo: Prospección'],
    nota: 'Todo lo escrito está en el doc interno /vsl/estrategia: el motor A (círculo rojo + leads 100% fríos), la regla de que la prospección es personalizada —un Loom VSL por cada lead— y tasas de respuesta a propósito distintas a las del canal pago. No hay herramienta: la ejecución es manual y los leads entran por el Calendly propio (calendly.com/koncke/asesoria, cableado en app/vsl/Landing.tsx:25) que cae al CRM por el webhook genérico del producto.',
  },
  {
    slug: 'gtm-oferta-y-precios', titulo: 'GTM: Oferta y precios', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'parcial',
    alcance: 'Qué vende MaKo y a cuánto: la escalera 1a1 US$4.000 / Grupal US$1.500 con ticket de US$2.000, los planes Free/Pro 47/Growth 97 con cupo de MaKo Tokens, y el «precio de fundador» de la landing.',
    // ⚠️ Este `vive` declaraba cinco archivos y dejaba invisible justo dónde cayó
    // el trabajo de agosto: docs/embudo-y-high-ticket.md (el modelo económico
    // entero, 127 KB), Piezas.tsx (los gráficos de CAC por canal) y el test que
    // guarda los números. Se amplió al escribir la bitácora — la regla de AGENTS.md
    // «Una ruta que apunta a la nada»: el vive[] cubre dónde cae el trabajo de
    // verdad, no solo los componentes de la pantalla.
    vive: ['app/vsl/estrategia/Estrategia.tsx', 'app/vsl/estrategia/page.tsx', 'app/admin/dev/pricing/modelo.ts', 'app/admin/dev/pricing/Pricing.tsx', 'app/admin/dev/pricing/Piezas.tsx', 'tests/pricing-modelo.test.ts', 'docs/costos-ia-y-planes.md', 'docs/embudo-y-high-ticket.md', 'app/vsl/landing-html.ts'],
    proyectos: ['Vender MaKo: Oferta y precios'],
    hallazgos: 'hallazgos-landing',
    nota: 'Está partido en dos mitades que no se hablan, y es lo primero que hay que entender: (1) la oferta high-ticket con llamada vive en /vsl/estrategia —MIX, unit economics, la escalera para que «cualquier lead compre algo»—; (2) los planes de software con cupo de MaKo Tokens viven en app/admin/dev/pricing/modelo.ts, que ya tiene su propio registro en /admin/dev con slug `pricing` (app/admin/dev/areas.ts) — no duplicarlo. Regla del archivo modelo.ts: cada número declara si es `medido` (de anthropic_usage en prod), `publicado` (precio de lista con fecha) o `supuesto`; un número sin origen no se agrega. La única superficie pública de precio es el bloque «Precio de fundador» de app/vsl/landing-html.ts, que no da cifra.',
  },
  {
    slug: 'referrals', titulo: 'Referrals', familia: 'Business', grupo: 'Go-to-Market',
    estado: 'por-construir',
    alcance: '«Ganá dinero con MaKo»: que los clientes traigan clientes, con su incentivo y su seguimiento. No existe ni la cara del cliente ni la nuestra; hay un párrafo de intención y nada más.',
    vive: [],
    proyectos: ['Vender MaKo: Referidos'],
    nota: 'Lo único escrito es el canal C «Referidos» de la lista FUTURO en app/vsl/estrategia/Estrategia.tsx: cuatro líneas, «costo cero», pedirlos a mano a la red, a los clientes y a cada persona prospectada tenga o no interés propio. Cero programa, cero código de referido, cero atribución, cero liquidación. Dependencia dura: sin pasarela (payment-gateway, que tampoco existe) no hay con qué pagar un incentivo, así que este área no puede ir antes que aquella. El proyecto del tablero es «Vender MaKo: Referidos» (lib/plan-proyectos-catalogo.ts:185).',
  },

  // ────────────────────────────────────────────────────────── Platform
  {
    slug: 'admin', titulo: 'Clientes', familia: 'Platform',
    estado: 'listo', verEnApp: '/admin',
    alcance: 'El panel de la agencia: alta de cliente (workspace + su usuario admin de una), estado, capa contratada, y cada fila se expande con el equipo del cliente para ver y revocar.',
    vive: ['app/admin/page.tsx', 'app/admin/AdminView.tsx', 'app/api/admin/workspaces/route.ts', 'lib/capas.ts'],
    proyectos: ['Feature: Admin y clientes'],
  },
  {
    slug: 'integraciones', titulo: 'Integraciones', familia: 'Platform',
    estado: 'listo', verEnApp: '/integraciones',
    alcance: 'El estado de los servicios conectados (medidor de salud, «Requiere tu atención», servicios por categoría), el Costo de MaKo por proveedor y proceso, el historial de problemas de Meta, y el Pixel de MaKo: instalarlo sobre la página elegida, activarle Clarity, nombrar sus videos y probarlo en vivo.',
    // ⚠️ Este `vive` declaraba SIETE archivos y por eso el trabajo de agosto era
    // medio invisible: todo el recorrido del Pixel (SelectorLanding, ConfigClarity,
    // NombrarVideos, las server actions, la ventana de prueba) y sus libs
    // (landing-analisis, landing-config, landing-paginas, landing-videos, clarity)
    // no estaban en ninguna área. Es la regla de AGENTS.md «Una ruta que apunta a
    // la nada»: la omisión no da error, da un punto ciego.
    vive: ['app/integraciones/page.tsx', 'app/integraciones/IntegracionesBoard.tsx', 'app/integraciones/ServicioConfigForm.tsx', 'app/integraciones/ProbarTracking.tsx', 'app/integraciones/SelectorLanding.tsx', 'app/integraciones/ConfigClarity.tsx', 'app/integraciones/NombrarVideos.tsx', 'app/integraciones/landing-actions.ts', 'app/integraciones/landing-config-actions.ts', 'app/integraciones/escuchando/page.tsx', 'app/api/integraciones/credencial/route.ts', 'app/api/integraciones/landing', 'app/api/anthropic-usage/route.ts', 'app/api/cron/clarity-vigilante/route.ts', 'lib/metodo-catalogo.ts', 'lib/integraciones-catalogo.ts', 'lib/metodo-verificar.ts', 'lib/servicio-slides.ts', 'lib/clarity.ts', 'lib/landing-config.ts', 'lib/landing-paginas.ts', 'lib/landing-analisis.ts', 'lib/landing-videos.ts'],
    proyectos: ['Feature: Integraciones'],
  },
  {
    slug: 'conocimientos', titulo: 'Conocimientos', familia: 'Platform',
    estado: 'listo', verEnApp: '/conocimientos',
    alcance: 'El portal de formación interna (24 cursos) Y el pipeline que los mete: bajar, transcribir, subir a Drive y generar la ficha. El grueso del trabajo del área NO está en app/conocimientos/ sino en scripts/curso-* y en public/cono-*. Es fuente de RAG, no el /conocimiento del RAG.',
    // ⚠️ Este `vive` declaraba CINCO archivos de app/conocimientos/ y por eso el panel
    // de historial veía 11 commits de 68: todo el pipeline (scripts/), los assets
    // generados (public/cono-*) y la vista del link compartido quedaban invisibles, y
    // un barrido de «qué se trabajó y no quedó anotado» declaró tranquila el área más
    // movida del mes. Es el caso testigo de «Una ruta que apunta a la nada» en AGENTS.md.
    vive: [
      'app/conocimientos/page.tsx', 'app/conocimientos/Conocimientos.tsx',
      'app/conocimientos/CursoPortal.tsx', 'app/conocimientos/CursoReplica.tsx',
      'app/conocimientos/catalogo.ts', 'app/conocimientos/curso.ts',
      'app/conocimientos/curso-vsl.ts', 'app/conocimientos/curso-producto-app.ts',
      'app/compartido/[token]/CursoCompartido.tsx',
      'public/cono-tx', 'public/cono-doc', 'public/cono-ugc', 'public/cono-portadas',
      'scripts/curso-comun.mjs', 'scripts/curso-perfil.ps1', 'scripts/curso-sniff.mjs',
      'scripts/curso-abrir.mjs', 'scripts/curso-plan.mjs', 'scripts/curso-plan-vip.mjs',
      'scripts/curso-bajar.mjs', 'scripts/curso-audio.mjs', 'scripts/curso-transcribir-sa.mjs',
      'scripts/curso-a-drive.mjs', 'scripts/curso-drive-fusionar.mjs',
      'scripts/curso-recursos-vip.mjs', 'scripts/curso-pdfs.mjs',
      'scripts/curso-portada-manual.mjs', 'scripts/curso-a-portal.mjs', 'scripts/curso-pipeline.mjs',
      'scripts/avatarhype-plan.mjs', 'scripts/avatarhype-css.mjs', 'scripts/avatarhype-doc.mjs',
      'scripts/avatarhype-media.mjs', 'scripts/avatarhype-doc-portal.mjs',
    ],
    hallazgos: 'hallazgos-conocimiento',
    proyectos: ['Feature: Conocimientos'],
  },
  {
    slug: 'perfil', titulo: 'Perfil', familia: 'Platform',
    estado: 'listo', verEnApp: '/perfil',
    alcance: 'Los datos de quien sos: nombre, contacto, cargo, zona horaria y la foto (Supabase Storage). Las preferencias de notificaciones ya NO viven acá.',
    vive: ['app/perfil/page.tsx', 'app/perfil/PerfilTabs.tsx', 'app/api/perfil/route.ts', 'lib/perfil.ts'],
  },
  {
    slug: 'configuraciones', titulo: 'Configuraciones', familia: 'Platform',
    estado: 'listo', verEnApp: '/configuraciones',
    alcance: 'El contenedor de la configuración del workspace: una sola fila de tabs con Notificaciones, Identidades fiscales y Equipo cargando en el lugar, más el link a Método.',
    vive: ['app/configuraciones/page.tsx', 'app/configuraciones/ConfigInnerTabs.tsx', 'app/configuraciones/Configuraciones.tsx'],
    proyectos: ['Feature: Configuraciones y equipo'],
  },
  {
    slug: 'reportar-problema', titulo: 'Reportar problema', familia: 'Platform',
    estado: 'por-construir', verEnApp: '/tickets',
    alcance: 'Hoy es un ComingSoon a propósito: no hay tabla de tickets ni destino al que mandarlos. El nombre es la acción, no el objeto del sistema.',
    vive: ['app/tickets/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: Feedback y errores'],
  },
  {
    slug: 'branding-mako', titulo: 'Branding MaKo', familia: 'Platform',
    estado: 'listo',
    alcance: '93 MB de material que a propósito NO viven en el repo. Bucket privado, links firmados.',
    vive: ['app/conocimientos/BrandingMaKo.tsx', 'lib/branding.ts', 'app/api/branding/route.ts', 'app/api/branding/descargar/route.ts', 'scripts/subir-branding.mjs', 'supabase/migrations/0098_branding_shares.sql', 'app/conocimientos/Compartir.tsx'],
  },
  {
    slug: 'shared-links', titulo: 'Shared Links', familia: 'Platform',
    estado: 'listo',
    alcance: 'La ÚNICA superficie que sirve datos sin sesión. Tocar auth sin saber que existe la abre.',
    vive: ['app/compartido/[token]/page.tsx', 'app/compartido/[token]/Galeria.tsx', 'app/compartido/[token]/AnalisisCompartido.tsx', 'app/compartido/[token]/CursoCompartido.tsx', 'lib/shares.ts', 'app/api/compartir/route.ts', 'app/api/compartido/archivo/route.ts', 'app/conocimientos/Compartir.tsx', 'lib/branding.ts'],
  },
  {
    slug: 'workspace-lifecycle', titulo: 'Workspace Lifecycle', familia: 'Platform',
    estado: 'listo',
    alcance: 'Reset, clonar y sembrar un workspace. El guard que casi borra clientes reales vive acá.',
    vive: ['lib/reset-workspace.ts', 'lib/clonar-config.ts', 'lib/datos-mau.ts', 'app/api/datos-mau/route.ts', 'app/api/admin/workspaces/route.ts', 'tests/reset-workspace.test.ts'],
  },
  {
    slug: 'design-system', titulo: 'Design System', familia: 'Platform',
    estado: 'parcial',
    alcance: 'El programa de adopción: 2 de 9 partes, y 8.906 estilos inline sueltos (medidos el 17/08 sobre app/**/*.tsx). Incluye los tokens, el dorado de la marca y la paleta del rebrand con sus dos modos.',
    vive: [
      'app/globals.css',
      'app/_ui/LEEME.md',
      'lib/temas-candidatos.ts',
      'app/_components/TemaCandidato.tsx',
      'app/_components/TemaOscuro.tsx',
      'app/_components/InterruptorModo.tsx',
      'app/_components/MakoBrand.tsx',
    ],
    hallazgos: 'hallazgos-ui',
    proyectos: ['Diseño de la app'],
  },
  {
    slug: 'documentacion', titulo: 'Documentación', familia: 'Platform', grupo: 'Dev',
    estado: 'listo', verEnApp: '/admin/docs',
    alcance: 'AGENTS.md y docs/*.md renderizados DESDE el repo (sin copia propia), agrupados, con buscador y la ficha de git de cada documento. Todo el estado vive en la URL.',
    vive: ['app/admin/docs/page.tsx', 'app/admin/docs/DocsView.tsx', 'app/admin/docs/catalogo.ts', 'app/admin/docs/git-meta.ts'],
  },
  {
    slug: 'mako-ux-ui', titulo: 'MaKo UX/UI', familia: 'Platform', grupo: 'Dev',
    estado: 'listo', verEnApp: '/admin/ui',
    alcance: 'El sistema de diseño renderizado de verdad, en ocho sub-tabs: Roadmap, Sidebar, Íconos, Marca, Fundamentos, Piezas, Estados y Gramática de MaKo. /admin/rediseno redirige acá.',
    vive: [
      'app/admin/ui/page.tsx', 'app/admin/ui/CatalogoUI.tsx', 'app/admin/ui/Barra.tsx',
      'app/admin/ui/Gramatica.tsx', 'app/admin/ui/Marca.tsx', 'app/admin/ui/Temas.tsx',
      'app/admin/ui/bitacora.ts', 'app/_ui/',
      // La pieza y su contrato: el catálogo dibuja lo que estos tres definen.
      'app/_ui/Mako.tsx', 'app/_ui/Modal.tsx', 'app/_ui/ui.css',
      'lib/mako-gramatica.ts', 'lib/mako-capacidades.ts',
    ],
    hallazgos: 'hallazgos-ui',
  },
  {
    slug: 'grafo', titulo: 'Grafo', familia: 'Platform', grupo: 'Dev',
    estado: 'listo', verEnApp: '/api/admin/graph',
    alcance: 'El grafo de dependencias del repo entero, servido como HTML directo en pestaña nueva. Mira todo el código, no un área.',
    vive: ['app/api/admin/graph/route.ts', 'app/api/admin/graph/graph.html'],
  },
  {
    slug: 'agent-gateway', titulo: 'Agent Gateway', familia: 'Platform', grupo: 'Dev',
    estado: 'listo',
    alcance: 'La puerta por la que entra el Claude Code del cliente. Token y skill propios.',
    vive: ['app/api/agente/plan/route.ts', 'app/api/agente/token/route.ts', 'lib/plan-propuesta.ts'],
  },
  {
    slug: 'self-healing-dev-agent', titulo: 'Self-Healing Dev Agent', familia: 'Platform', grupo: 'Dev',
    estado: 'por-construir', agente: true,
    alcance: 'JUSTAMENTE el agente que esta sección viene a alimentar. Todavía no existe.',
    vive: ['lib/cerrar-por-commits.ts', 'lib/github-commits.ts', 'app/api/cron/cerrar-por-commits/route.ts', 'app/admin/dev/', 'scripts/gen-dev-historial.mjs', 'tests/dev-areas.test.ts', 'docs/dev-areas.mjs', 'docs/dev-tabs-mapa.md'],
  },

  // ───────────────────────────────────────────────────────────── Infra
  {
    slug: 'auth-session', titulo: 'Auth & Session', familia: 'Infra', grupo: 'Seguridad',
    estado: 'listo',
    alcance: 'Login con Google, token firmado, roles. El inventario tenía la pantalla, no el mecanismo.',
    vive: ['lib/auth-session.ts', 'lib/auth.ts', 'app/api/auth/google/route.ts', 'app/api/auth/callback/google/route.ts', 'app/api/auth/logout/route.ts', 'app/api/auth/me/route.ts', 'app/api/auth/dev-login/route.ts'],
  },
  {
    slug: 'access-gate', titulo: 'Access Gate', familia: 'Infra', grupo: 'Seguridad',
    estado: 'parcial',
    alcance: 'proxy.ts + tab-access: quién ve qué. Un error acá es un IDOR.',
    vive: ['lib/ws-tab.ts'],
  },
  {
    slug: 'multi-tenant-isolation', titulo: 'Multi-Tenant Isolation', familia: 'Infra', grupo: 'Seguridad',
    estado: 'parcial',
    alcance: 'workspace.ts, RLS, TENANT_TABLES. Ya hubo 15 tablas abiertas al rol anon.',
    vive: ['lib/ws-tab.ts', 'lib/cache.ts', 'tests/tenant-tables-contract.test.ts', 'docs/auditoria-aislamiento-workspace.md'],
    proyectos: ['Seguridad y multi-inquilino'],
  },
  {
    slug: 'credentials-vault-byok', titulo: 'Credentials Vault (BYOK)', familia: 'Infra', grupo: 'Seguridad',
    estado: 'parcial',
    alcance: 'Las llaves BYOK de cada cliente: cifrado AES-GCM con dos formatos vivos (gcm1 y gcm2 HKDF+AAD), hidratación env↔base en cada cold start, y el alta/borrado/prueba por campo desde /integraciones.',
    // ⚠️ Este `vive` no incluía las cuentas múltiples (lib/ia-keys*.ts), el segundo
    // catálogo (lib/integraciones-catalogo.ts), la prueba por campo ni el otro camino
    // de guardado (/metodo) — o sea que el trabajo de agosto sobre el vault caía casi
    // entero fuera del panel. Regla «Una ruta que apunta a la nada» de AGENTS.md.
    vive: ['lib/credenciales.ts', 'lib/cripto-credenciales.ts', 'lib/ia-keys.ts', 'lib/ia-keys-ws.ts', 'app/api/integraciones/credencial/route.ts', 'app/integraciones/ServicioConfigForm.tsx', 'lib/metodo-catalogo.ts', 'lib/integraciones-catalogo.ts', 'lib/metodo-verificar.ts', 'app/api/metodo/route.ts', 'instrumentation.ts', 'scripts/recifrar-credenciales.mjs', 'scripts/test-cripto.mjs', 'supabase/migrations/0055_credenciales_por_workspace.sql'],
    hallazgos: 'hallazgos-seguridad',
    nota: 'El cifrado vive aparte a propósito: lib/cripto-credenciales.ts NO importa \'server-only\' ni nada de Next, para poder correrlo suelto con scripts/test-cripto.mjs. El backfill v1→v2 (scripts/recifrar-credenciales.mjs) es seco por defecto y hace compare-and-swap con el criptograma viejo en el WHERE. Trampa del catálogo: el campo `env` de lib/metodo-catalogo.ts tiene que coincidir EXACTO con lo que lee cada lib, si no credWs devuelve null en silencio. Y ojo con instrumentation.ts: register() no se espera antes del primer request en Vercel, hay que leer por envCred()/credencialesListas().',
  },
  {
    slug: 'rate-limiting', titulo: 'Rate Limiting', familia: 'Infra', grupo: 'Seguridad',
    estado: 'parcial',
    alcance: 'Limitador en memoria por instancia, que muere en cada cold start, usado en UNA sola ruta de toda la app: el beacon público del VSL. Ningún otro endpoint tiene techo.',
    // `lib/landing-token.ts` está acá porque los ÚNICOS topes que se escribieron
    // en agosto viven en el snippet (40 clicks por carga, 10 idas y vueltas), no
    // en el limitador — sin esa ruta, el historial del área no ve ni un commit de
    // los diez días en que se movió. `scripts/proponer-seguridad-legal.ts` es la
    // parte en cola: el techo por workspace de las rutas que gastan IA.
    vive: ['lib/rate-limit.ts', 'app/api/track/vsl/route.ts', 'lib/landing-token.ts', 'scripts/proponer-seguridad-legal.ts'],
    hallazgos: 'hallazgos-ia',
    nota: 'Grep verificado: `rateLimit`/`clientIp` se importan en un único archivo de todo el repo (app/api/track/vsl/route.ts:47), con dos cubetas — `vsl:<ip>` 300/min y `vslstamp:<ip>` 15/min. El propio módulo avisa que el estado no se comparte entre instancias: para un tope duro hace falta Upstash/Redis. NO confundir con el gasto de IA: lib/ia-cuotas.ts reordena proveedores pero nunca bloquea, y los presupuestos de closing.ts/ads-analyst.ts topean una corrida, no a un cliente.',
  },
  {
    slug: 'database-migrations', titulo: 'Database & Migrations', familia: 'Infra', grupo: 'Datos',
    estado: 'listo',
    alcance: '131 migraciones sin un lugar donde leer por qué existe cada una.',
    vive: ['supabase/validations/', 'scripts/apply-migration.mjs', 'scripts/check-migrations.mjs', '.claude/skills/author-numbered-migration/'],
  },
  {
    slug: 'file-storage', titulo: 'File Storage', familia: 'Infra', grupo: 'Datos',
    estado: 'listo',
    alcance: 'Los buckets privados de Supabase Storage y las URLs firmadas de vida corta: nada se sirve directo, cada descarga pasa por un route handler que autoriza primero.',
    vive: ['lib/archivero.ts', 'lib/branding.ts', 'lib/persona.ts', 'lib/evolution-media.ts', 'lib/setting-audios.ts', 'lib/reset-workspace.ts', 'app/api/ads-manager/creative-upload/route.ts', 'app/api/ads-manager/creative-signurl/route.ts'],
  },
  {
    slug: 'caching-revalidation', titulo: 'Caching & Revalidation', familia: 'Infra', grupo: 'Datos',
    estado: 'parcial',
    alcance: 'Hay una capa de cache cross-request con tags e invalidacion, aislada por workspace mediante AsyncLocalStorage — si se rompe, un cliente ve datos de otro o datos viejos, y no figura en ningun lado.',
    vive: ['lib/cache.ts', 'lib/queries.ts', 'lib/pagos.ts'],
  },
  {
    slug: 'cron-scheduler', titulo: 'Cron Scheduler', familia: 'Infra', grupo: 'Runtime',
    estado: 'parcial',
    alcance: '18 trabajos corren solos en producción y ninguna pantalla dice si fallan.',
    vive: ['lib/cron-auth.ts', 'lib/cron-workspaces.ts', '.claude/skills/add-cron-job/'],
  },
  {
    slug: 'webhook-gateway', titulo: 'Webhook Gateway', familia: 'Infra', grupo: 'Runtime',
    estado: 'parcial',
    alcance: 'Fathom, Chatwoot, Meta, Evolution, Resend, Calendly: 6 puertas, un router.',
    vive: ['app/api/webhooks/calendly/route.ts', 'app/api/webhooks/resend/route.ts', 'app/api/webhooks/fathom/route.ts', 'app/api/webhooks/evolution/route.ts', 'supabase/migrations/0090_webhook_routing.sql', '.claude/skills/add-webhook-receiver/'],
  },
  {
    slug: 'puente-flow', titulo: 'Puente a Google Flow', familia: 'Infra', grupo: 'Runtime',
    estado: 'parcial',
    alcance: 'La extensión de Chrome que MaKo instala en la máquina del cliente y que le pide a Google Flow la imagen y el video del anuncio: el protocolo (BOQ), la cola, las plantillas, el diagnóstico de por qué un pedido no salió, y la versión que la app exige. Es lo que hace REAL a Video Generator; el wizard y el editor son la otra mitad y viven en esa área.',
    vive: [
      'extension',
      'app/api/flow/puente/route.ts',
      'lib/flow-protocolo.ts', 'lib/flow-operaciones.ts', 'lib/flow-cola.ts',
      'lib/flow-plantillas.ts', 'lib/flow-imagen.ts', 'lib/flow-media.ts',
      'lib/flow-boq-patch.ts', 'lib/flow-boq-respuesta.ts', 'lib/flow-diagnostico.ts',
      'lib/flow-fallo-texto.ts', 'lib/flow-puede-filmar.ts', 'lib/flow-puente-frescura.ts',
      'lib/flow-clip-referencias.ts', 'lib/extension-version.ts', 'public/mako-puente.sha',
    ],
    hallazgos: 'hallazgos-generativa',
    nota: 'Es el área más movida del repo desde el 18/08 (89 commits solo sobre extension/manifest.json) y hasta el 07/09 NO EXISTÍA acá: todo su código quedaba fuera de los `vive` de las 122 áreas, así que ni el Change History derivado ni el barrido de «qué se trabajó y no se anotó» la veían. El conocimiento sí está escrito —docs/hallazgos-generativa.md, ~6.900 líneas— pero el registro no lo encontraba. Dos trampas propias que ese documento detalla: el payload de BOQ es POSICIONAL (un campo de más corre todo y Flow acepta el pedido sin devolver imagen), y el token de reCAPTCHA es de un solo uso (repetirlo da rechazo, y se lee como una regresión sin serlo).',
  },
  {
    slug: 'transactional-email', titulo: 'Transactional Email', familia: 'Infra', grupo: 'Runtime',
    estado: 'listo',
    alcance: 'Resend no es solo la tab de Email Marketing: es el transporte de reportes, invitaciones de share y avisos, con firma HMAC de baja, One-Click de Gmail y un remitente sandbox que solo entrega al dueno de la cuenta.',
    vive: ['lib/notify.ts', 'app/api/email/unsubscribe/', 'app/api/webhooks/resend/', 'lib/app-url.ts'],
  },
  {
    slug: 'build-deploy', titulo: 'Build & Deploy', familia: 'Infra', grupo: 'Entrega',
    estado: 'listo',
    alcance: 'Cómo se compila esta app y cómo llega a producción: el build de Next, el escaneo de Tailwind, el pre-push que es la única red de tipos, el enganche GitHub→Vercel, quién autoriza un deploy y la factura que todo eso genera.',
    vive: [
      'next.config.ts',
      'app/globals.css',
      'vercel.json',
      '.vercel/',
      'package.json',
      '.git/hooks/pre-push',
      'scripts/sync-contrato-detalle.mjs',
      'scripts/sync-gramatica-doc.mjs',
      'scripts/generar-plugin.mjs',
      'AGENTS.md',
      'docs/hallazgos-infra.md',
    ],
    hallazgos: 'hallazgos-infra',
    proyectos: ['Infraestructura y versionado'],
  },
  {
    slug: 'app-versioning', titulo: 'App Versioning', familia: 'Infra', grupo: 'Entrega',
    estado: 'por-construir',
    alcance: 'Que la pestaña abierta se entere de que hay build nuevo y se refresque sola, con cartel no-cerrable cuando el cambio no aplica en caliente, más numeración de versiones. Cero código hoy.',
    vive: [],
    hallazgos: 'hallazgos-infra',
    nota: 'No hay ni una línea: cero `buildId`, cero lectura de VERCEL_GIT_COMMIT_SHA, cero endpoint de versión. Lo único escrito son las tres tarjetas del proyecto «versionado-actualizaciones» (#140, #141, #142) dentro de app/plan/PlanBoard.tsx — eso es DATO del tablero, no la feature, y no debería listarse como su código. El pendiente ya está anotado en docs/hallazgos-infra.md:1113 (sección «Build, deploy y entrega»).',
  },
  {
    slug: 'observability-errors', titulo: 'Observability & Errors', familia: 'Infra', grupo: 'Entrega',
    estado: 'por-construir',
    alcance: 'Enterarse de que algo se rompió en producción: cero Sentry, cero error.tsx en toda app/, cero tabla de errores. Hoy un error solo deja un console.error en el log de Vercel.',
    vive: [],
    nota: 'Verificado por búsqueda: no existe ningún error.tsx, global-error.tsx ni not-found.tsx en app/; «Sentry» solo aparece dentro de transcripciones de curso en app/conocimientos/curso.ts (es el stack de un competidor, no nuestro); no hay onRequestError en instrumentation.ts ni tabla de errores en supabase/migrations. La pieza más parecida es agente_sesiones (supabase/migrations/0124_agente_telemetria.sql), pero es telemetría del Claude Code DEL CLIENTE, no errores de la app — no la tomes como base.',
  },
  {
    slug: 'tests-qa', titulo: 'Tests & QA', familia: 'Infra', grupo: 'Entrega',
    estado: 'listo',
    alcance: '96 archivos de test con node --test + tsx (npm test) y un pre-push en .git/hooks que corre CUATRO chequeos (tipos, contrato del detalle, gramática de marca, plugin público) — pero no corre los tests, y no se versiona.',
    vive: ['tests', 'package.json', 'tsconfig.json', '.git/hooks/pre-push', 'next.config.ts', 'scripts/sync-contrato-detalle.mjs', 'scripts/sync-gramatica-doc.mjs', 'scripts/generar-plugin.mjs', 'tests/tenant-tables-contract.test.ts', 'AGENTS.md'],
    hallazgos: 'hallazgos-infra',
    nota: 'El pre-push es la ÚNICA red de tipos (next.config.ts tiene typescript.ignoreBuildErrors: true para no pagar Build CPU en Vercel) y vive en .git/hooks, o sea que un reclon lo borra en silencio; el contenido para recrearlo está en AGENTS.md:20-42. Ese mismo AGENTS.md avisa que el hook NO corre `npm test`. Trampas del runner (docs/hallazgos-infra.md, «Tests y entorno local»): tsx no resuelve el alias @/ (imports relativos), \'server-only\' revienta al importarse y hay que parchear Module._load, y los guards de texto leen de más en Windows si no normalizás CRLF.',
  },
  {
    slug: 'local-dev-environment', titulo: 'Local Dev Environment', familia: 'Infra', grupo: 'Entrega',
    estado: 'listo',
    alcance: 'El entorno local apunta a la base de PRODUCCION y el boot le escribe: es la fuente de accidentes mas silenciosa del proyecto, y ademas es la superficie que usan los propios agentes de desarrollo.',
    vive: ['.env.local', 'instrumentation.ts', 'app/api/auth/dev-login/route.ts', 'AGENTS.md', 'CLAUDE.md', '.claude/skills/', '.claude/CLAUDE.md', '.claude/launch.json', '.claude/settings.local.json', '.git/hooks/pre-push', 'skills-lock.json', 'plugin/', 'scripts/sync-contrato-detalle.mjs', 'scripts/sync-gramatica-doc.mjs', 'scripts/generar-plugin.mjs', 'docs/hallazgos-infra.md', 'docs/dos-cuentas.md', 'docs/chats.md', 'docs/corridas-multiagente.md'],
  },
  {
    slug: 'orphaned-ui-dead-routes', titulo: 'Orphaned UI & Dead Routes', familia: 'Infra', grupo: 'Entrega',
    estado: 'por-construir',
    alcance: '7 componentes construidos que ninguna página monta, y redirects que apuntan a pantallas muertas.',
    vive: ['app/configuraciones/TelefonosPanel.tsx', 'app/configuraciones/EtiquetasWhatsAppPanel.tsx', 'app/marketing/salud/page.tsx', 'app/onboarding/OnboardingForm.tsx', 'app/_components/DashboardHeader.tsx', 'app/_components/SourceStrip.tsx', 'app/dm-writer/page.tsx'],
  },
];

export const areaDe = (slug: string) => AREAS.find((a) => a.slug === slug) ?? null;

/** Las familias en el orden en que se muestran. */
export const FAMILIAS = ['Operate', 'Analyze', 'Sales Machine', 'Content Machine', 'MaKo', 'Business', 'Platform', 'Infra'] as const;

export const areasDeFamilia = (familia: string) => AREAS.filter((a) => a.familia === familia);

/** Agrupadas por sub-desplegable. Las que no tienen grupo van bajo la clave ''. */
export function porGrupo(familia: string): Array<{ grupo: string; areas: AreaDev[] }> {
  const mapa = new Map<string, AreaDev[]>();
  for (const a of areasDeFamilia(familia)) {
    const g = a.grupo ?? '';
    const previas = mapa.get(g);
    if (previas) previas.push(a); else mapa.set(g, [a]);
  }
  return Array.from(mapa, ([grupo, areas]) => ({ grupo, areas }));
}
