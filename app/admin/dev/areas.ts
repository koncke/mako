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
    vive: ['app/plan/page.tsx', 'app/plan/TodoBoard.tsx', 'app/plan/PlanBoard.tsx', 'app/plan/agencia/page.tsx', 'app/plan/board/BoardShell.tsx', 'app/plan/board/useBoard.ts', 'lib/todo.ts', 'lib/plan-board.ts'],
    proyectos: ['Feature: Plan'],
  },
  {
    slug: 'perro-guardian', titulo: 'Perro Guardián', familia: 'Operate', grupo: 'Plan',
    estado: 'listo', agente: true,
    alcance: 'El agente que puntúa el plan 1-100, le pone fecha y razón a cada tarea, la rutea a su proyecto, caza duplicados y te discute cuando querés subir una prioridad o borrar algo.',
    vive: ['lib/mako-guardian.ts', 'app/api/mako-guardian/route.ts', 'lib/preguntas-contrato.ts', 'lib/todo-guardian.ts', 'lib/todo-rutear.ts', 'app/plan/board/guardian-form.tsx', 'app/plan/board/DebateModal.tsx'],
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
    vive: ['app/crm/page.tsx', 'app/crm/CrmBoard.tsx', 'app/crm/CrmToolbar.tsx', 'app/crm/crm-map.ts', 'app/crm/actions.ts', 'lib/leads.ts', 'lib/pipeline.ts'],
    proyectos: ['Feature: CRM'],
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
    estado: 'por-construir', verEnApp: '/instagram',
    alcance: 'Hoy es un ComingSoon con guard de rol. El alcance previsto: conectar la cuenta, leer DMs y publicar desde la app.',
    vive: ['app/instagram/page.tsx', 'app/_components/ComingSoon.tsx', 'app/_components/nav.ts', 'lib/plan-proyectos-catalogo.ts'],
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
    vive: ['app/second-brain/page.tsx', 'app/second-brain/Grafo.tsx', 'app/second-brain/fisica.ts', 'lib/cerebro-grafo.ts', 'lib/cerebro-modelo.ts', 'lib/cerebro-layout.ts'],
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
    slug: 'cs-analyst', titulo: 'CS Analyst', familia: 'Analyze', grupo: 'Analysts',
    estado: 'por-construir', verEnApp: '/cs-analyst',
    alcance: 'Retención y customer success: anticipar la baja de un cliente ya cerrado. Hoy es ComingSoon.',
    vive: ['app/cs-analyst/page.tsx', 'app/_components/ComingSoon.tsx'],
    proyectos: ['Feature: CS Analyst'],
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
    vive: ['app/api/track/vsl/route.ts', 'lib/vsl-retencion.ts', 'app/api/cron/tracking-vigilante/route.ts', 'lib/landing-token.ts', 'lib/panda.ts', 'supabase/migrations/0121_vsl_events_segundos.sql', 'tests/vsl-retencion.test.ts'],
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
    alcance: 'Escribir el guion de un VSL. Hoy es un ComingSoon puro; no hay lib ni API (lib/vsl-estructuras.ts existe pero lo consume el Landing Analyst, no esto).',
    vive: ['app/vsl-generator/page.tsx', 'app/vsl-writer/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: VSL Generator'],
  },
  {
    slug: 'lead-magnet-generator', titulo: 'Lead Magnet Generator', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/lead-magnet-generator',
    alcance: 'Producir el lead magnet entregable. ComingSoon sin backend; el CONTENIDO del entregable ya se define en el onboarding (EntregableView), así que esta tab es la que lo materializa.',
    vive: ['app/lead-magnet-generator/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: Lead Magnet Generator'],
  },
  {
    slug: 'sales-email', titulo: 'Sales Email', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/sales-email',
    alcance: 'Escribir los emails de venta. ComingSoon sin backend; distinto de /email (Operate), que es la bandeja de todos los días.',
    vive: ['app/sales-email/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: Sales Email'],
  },
  {
    slug: 'newsletters', titulo: 'Newsletters', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/newsletters',
    alcance: 'Escribir newsletters recurrentes a la lista. ComingSoon sin backend.',
    vive: ['app/newsletters/page.tsx', 'app/_components/nav.ts'],
  },
  {
    slug: 'closing-script', titulo: 'Closing Script', familia: 'Sales Machine',
    estado: 'por-construir', verEnApp: '/closing-script',
    alcance: 'El guion que usa el closer en la llamada. ComingSoon; su contraparte de ANÁLISIS (/closing, Closing Analyst) sí existe y funciona, así que el bucle natural es que ésta se alimente de aquélla.',
    vive: ['app/closing-script/page.tsx', 'app/_components/nav.ts'],
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
    estado: 'por-construir', verEnApp: '/video-generator',
    alcance: 'Generar el video del anuncio a partir del guion. ComingSoon; el guion y el formato de video ya salen de la Matriz.',
    vive: ['app/video-generator/page.tsx', 'app/admin/dev/ads-writer/bitacora.ts'],
    proyectos: ['Feature: Video Generator'],
  },
  {
    slug: 'reels', titulo: 'Reels', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'por-construir', verEnApp: '/reels',
    alcance: 'Guion y formato de reel de Instagram. ComingSoon sin backend.',
    vive: ['app/reels/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: Reels'],
  },
  {
    slug: 'carousels', titulo: 'Carousels', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'por-construir', verEnApp: '/carousels',
    alcance: 'Armar carruseles de Instagram lámina por lámina. ComingSoon sin backend.',
    vive: ['app/carousels/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: Carousels'],
  },
  {
    slug: 'stories', titulo: 'Stories', familia: 'Content Machine', grupo: 'Instagram',
    estado: 'por-construir', verEnApp: '/stories',
    alcance: 'Secuencias de historias de Instagram. ComingSoon sin backend.',
    vive: ['app/stories/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: Stories'],
  },
  {
    slug: 'youtube-writer', titulo: 'YouTube Writer', familia: 'Content Machine', grupo: 'YouTube',
    estado: 'por-construir', verEnApp: '/youtube-writer',
    alcance: 'Escribir el guion de un video de YouTube. ComingSoon sin backend.',
    vive: ['app/youtube-writer/page.tsx', 'app/_components/nav.ts'],
    proyectos: ['Feature: YouTube Writer'],
  },
  {
    slug: 'thumbnails', titulo: 'Thumbnails', familia: 'Content Machine', grupo: 'YouTube',
    estado: 'por-construir', verEnApp: '/thumbnails',
    alcance: 'Generar las miniaturas del video. ComingSoon sin backend.',
    vive: ['app/thumbnails/page.tsx', 'app/_components/nav.ts'],
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
    vive: ['lib/mako-doer-in.ts', 'lib/mako-router.ts', 'app/api/webhooks/evolution/route.ts', 'app/api/admin/mako-doer/route.ts'],
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
    vive: ['lib/anthropic.ts', 'lib/ai-cheap.ts', 'lib/model-registry.ts', 'lib/model-catalogo.ts', 'app/modelos-ia/ModelosIA.tsx', 'app/api/admin/modelos/route.ts'],
    hallazgos: 'hallazgos-ia',
    nota: 'Las «916 líneas» son lib/anthropic.ts (301) + lib/ai-cheap.ts (615), verificado. Dos trampas: el override de /modelos-ia SOLO aplica si el caller no pasó `model` explícito (cualquier `chatClaude(..., { model })` se saltea el registro entero), y el catálogo vive aparte en lib/model-catalogo.ts —sin `server-only`, para poder testearlo— pero nadie lo importa directo: model-registry.ts lo re-exporta. El fallback pago está adentro de chatClaude, no en el registro: si toda la cascada gratis falla cae a claude-sonnet-5 y deja la nota visible en el historial.',
  },
  {
    slug: 'ai-spend-cuotas', titulo: 'AI Spend & Cuotas', familia: 'MaKo',
    estado: 'parcial',
    alcance: 'El medidor: una fila en anthropic_usage por llamada, el precio por modelo, el saldo cargado a mano y cuánto queda de cada free tier. Se ve en Integraciones › Costo de MaKo.',
    vive: ['lib/anthropic-usage.ts', 'lib/ia-cuotas.ts', 'lib/costos-ia.ts', 'app/api/anthropic-usage/route.ts', 'app/api/costos-ia/route.ts', 'app/integraciones/IntegracionesBoard.tsx', 'app/_components/IaUsageToast.tsx', 'lib/ia-labels.ts'],
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
    vive: ['lib/capas.ts', 'lib/tab-access.ts', 'lib/ws-tab.ts', 'app/_components/nav.ts', 'app/admin/AdminView.tsx', 'supabase/migrations/0092_workspace_capa.sql'],
    proyectos: ['Feature: Cobros y planes'],
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
    vive: ['app/vsl/estrategia/Estrategia.tsx', 'app/admin/dev/pricing/modelo.ts', 'app/admin/dev/pricing/Pricing.tsx', 'docs/costos-ia-y-planes.md', 'app/vsl/landing-html.ts'],
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
    alcance: 'El estado de los servicios conectados (medidor de salud, «Requiere tu atención», servicios por categoría), el Costo de MaKo por proveedor y proceso, y el historial de problemas de Meta.',
    vive: ['app/integraciones/page.tsx', 'app/integraciones/IntegracionesBoard.tsx', 'app/integraciones/ServicioConfigForm.tsx', 'app/integraciones/ProbarTracking.tsx', 'app/api/integraciones/credencial/route.ts', 'app/api/anthropic-usage/route.ts', 'lib/metodo-catalogo.ts'],
    proyectos: ['Feature: Integraciones'],
  },
  {
    slug: 'conocimientos', titulo: 'Conocimientos', familia: 'Platform',
    estado: 'listo', verEnApp: '/conocimientos',
    alcance: 'El portal de formación interna (curso AVATARHYPE y hermanos): hub multi-curso con navegación por URL, capa oscura autocontenida. Es fuente de RAG, no el /conocimiento del RAG.',
    vive: ['app/conocimientos/page.tsx', 'app/conocimientos/Conocimientos.tsx', 'app/conocimientos/curso.ts', 'app/conocimientos/curso-vsl.ts', 'app/conocimientos/curso-producto-app.ts'],
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
    alcance: 'El programa de adopción: 2 de 9 partes, 7.680 estilos inline sueltos.',
    vive: ['app/globals.css'],
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
    vive: ['app/admin/ui/page.tsx', 'app/admin/ui/CatalogoUI.tsx', 'app/admin/ui/Barra.tsx', 'app/admin/ui/Gramatica.tsx', 'app/admin/ui/Marca.tsx', 'app/admin/ui/bitacora.ts', 'app/_ui/'],
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
    vive: ['lib/cerrar-por-commits.ts', 'app/admin/dev/'],
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
    vive: ['lib/credenciales.ts', 'lib/cripto-credenciales.ts', 'app/api/integraciones/credencial/route.ts', 'app/integraciones/ServicioConfigForm.tsx', 'lib/metodo-catalogo.ts', 'instrumentation.ts', 'scripts/recifrar-credenciales.mjs', 'supabase/migrations/0055_credenciales_por_workspace.sql'],
    hallazgos: 'hallazgos-seguridad',
    nota: 'El cifrado vive aparte a propósito: lib/cripto-credenciales.ts NO importa \'server-only\' ni nada de Next, para poder correrlo suelto con scripts/test-cripto.mjs. El backfill v1→v2 (scripts/recifrar-credenciales.mjs) es seco por defecto y hace compare-and-swap con el criptograma viejo en el WHERE. Trampa del catálogo: el campo `env` de lib/metodo-catalogo.ts tiene que coincidir EXACTO con lo que lee cada lib, si no credWs devuelve null en silencio. Y ojo con instrumentation.ts: register() no se espera antes del primer request en Vercel, hay que leer por envCred()/credencialesListas().',
  },
  {
    slug: 'rate-limiting', titulo: 'Rate Limiting', familia: 'Infra', grupo: 'Seguridad',
    estado: 'parcial',
    alcance: 'Limitador en memoria por instancia, que muere en cada cold start, usado en UNA sola ruta de toda la app: el beacon público del VSL. Ningún otro endpoint tiene techo.',
    vive: ['lib/rate-limit.ts', 'app/api/track/vsl/route.ts'],
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
    slug: 'transactional-email', titulo: 'Transactional Email', familia: 'Infra', grupo: 'Runtime',
    estado: 'listo',
    alcance: 'Resend no es solo la tab de Email Marketing: es el transporte de reportes, invitaciones de share y avisos, con firma HMAC de baja, One-Click de Gmail y un remitente sandbox que solo entrega al dueno de la cuenta.',
    vive: ['lib/notify.ts', 'app/api/email/unsubscribe/', 'app/api/webhooks/resend/', 'lib/app-url.ts'],
  },
  {
    slug: 'build-deploy', titulo: 'Build & Deploy', familia: 'Infra', grupo: 'Entrega',
    estado: 'listo',
    alcance: 'El typecheck fuera del build costó 109 horas de CPU en una semana.',
    vive: ['next.config.ts', 'AGENTS.md', '.vercel/'],
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
    alcance: '45 archivos de test con node --test + tsx (npm test) y un pre-push en .git/hooks que corre el typecheck y el sync del contrato — pero no corre los tests, y no se versiona.',
    vive: ['tests', 'package.json', '.git/hooks/pre-push', 'next.config.ts', 'scripts/sync-contrato-detalle.mjs', 'tests/tenant-tables-contract.test.ts', 'AGENTS.md'],
    hallazgos: 'hallazgos-infra',
    nota: 'El pre-push es la ÚNICA red de tipos (next.config.ts tiene typescript.ignoreBuildErrors: true para no pagar Build CPU en Vercel) y vive en .git/hooks, o sea que un reclon lo borra en silencio; el contenido para recrearlo está en AGENTS.md:20-42. Ese mismo AGENTS.md avisa que el hook NO corre `npm test`. Trampas del runner (docs/hallazgos-infra.md, «Tests y entorno local»): tsx no resuelve el alias @/ (imports relativos), \'server-only\' revienta al importarse y hay que parchear Module._load, y los guards de texto leen de más en Windows si no normalizás CRLF.',
  },
  {
    slug: 'local-dev-environment', titulo: 'Local Dev Environment', familia: 'Infra', grupo: 'Entrega',
    estado: 'listo',
    alcance: 'El entorno local apunta a la base de PRODUCCION y el boot le escribe: es la fuente de accidentes mas silenciosa del proyecto, y ademas es la superficie que usan los propios agentes de desarrollo.',
    vive: ['.env.local', 'instrumentation.ts', 'app/api/auth/dev-login/route.ts', 'AGENTS.md', '.claude/skills/'],
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
