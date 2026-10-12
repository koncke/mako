# Los desplegables de /admin/dev

Relevamiento del **2026-08-08** sobre el código: **208 piezas** en 6 familias.
Las familias son las de `app/_components/nav.ts` — no se inventó ninguna división nueva.

`🟢 funciona` · `🟡 parcial` · `⚪ por construir`  ·  **A** = agente (corre solo)

Cada pieza va a tener su **Roadmap** (derivado de las tareas del plan) y su **Change History**
(derivado de `git log` sobre los archivos de `vive`). Ninguno de los dos se inventa.

---

## Operate  ·  90 piezas

### General

- 🟢 **General**  `/general`  · ícono `general`  
  La casa del cliente al entrar: hero de la meta, resumen del mes, semáforo del negocio y worklist de pendientes.  
  <sub>app/general/page.tsx · app/general/actions.ts · lib/queries.ts · lib/pagos.ts</sub>
- 🟢 **Goal Tracker**  `/general`  · ícono `rayo`  
  El hero oscuro «Camino a los N cierres» con el progreso contra el objetivo y el popover de editar la meta.  
  <sub>app/general/page.tsx · app/general/EditarMeta.tsx · app/general/actions.ts</sub>
- 🟢 **Month Summary**  `/general`  · ícono `graphics`  
  Comparativo MTD (inversión, agendas, cierres, cash) con drill-down por anuncio y por lead.  
  <sub>app/general/page.tsx · app/_components/Desglose.tsx · lib/queries.ts · lib/pagos.ts</sub>
- 🟢 **Business Traffic Light**  `/general`  · ícono `dot`  
  Las alertas accionables verde/ámbar/rojo del negocio (fatiga de adsets, tramo R1→R2, salud de Meta). El registro del semáforo como concepto ya existe aparte.  
  <sub>app/general/page.tsx · lib/meta-health.ts · lib/meta-health-ui.ts · lib/mako-gramatica.ts</sub>
- 🟢 **Pending Data Card**  `/general`  · ícono `help`  
  «Leads sin marcar bloquean la confiabilidad»: el contador de pendientes que empuja a la vista Unmarked Data del CRM.  
  <sub>app/general/page.tsx · lib/queries.ts</sub>
- ⚪ **Today**  · ícono `rayo`  
  La pantalla de foco con sus seis campos (prioridad, razón, resultado esperado, responsable, progreso, próxima revisión). No existe: nav.ts ya matchea /focus y declara que la key `general` pasará a ser ella (tarea #523).  
  <sub>app/_components/nav.ts (item `general`, comentario del bloque Operate) · lib/plan-proyectos-catalogo.ts (proyecto «Foco»)</sub>

### Plan

- 🟢 **Plan**  `/plan`  · ícono `todo`  
  El tablero de tareas. Misma UI en dos adapters: cliente (/plan → TodoBoard, Supabase por workspace) y super-admin sin impersonar (/plan/agencia → PlanBoard).  
  <sub>app/plan/page.tsx · app/plan/TodoBoard.tsx · app/plan/PlanBoard.tsx · app/plan/agencia/page.tsx</sub>
- 🟢 **Priorities**  `/plan`  · ícono `rayo`  
  Vista por defecto: el Objetivo Principal a la izquierda y las tarjetas top por score. Nunca se queda vacía.  
  <sub>app/plan/board/BoardShell.tsx (Prioridades)</sub>
- 🟢 **Kanban**  `/plan`  · ícono `grid`  
  Cuatro columnas por prioridad derivada del score, con filtro por proyecto/estado/origen y orden configurable.  
  <sub>app/plan/board/BoardShell.tsx (Kanban, CardTile, FilterMenu)</sub>
- 🟢 **Projects**  `/plan`  · ícono `contexto`  
  Cards de proyecto ordenadas por prioridad, con su progreso agregado; el catálogo de proyectos es cerrado.  
  <sub>app/plan/board/BoardShell.tsx (ProyectosView, ProjCard) · lib/plan-proyectos-catalogo.ts · lib/todo-proyectos-catalogo.ts</sub>
- 🟢 **Graphics**  `/plan`  · ícono `graphics`  
  Los gráficos del tablero: distribución por proyecto, avance y ritmo de cierre de tareas.  
  <sub>app/plan/board/Graphics.tsx</sub>
- 🟢 **Task Detail**  `/plan`  · ícono `notepencil`  
  El modal de la tarjeta: título, detalle con molde, score y razón, deadline, checklist de MaKo, historial y acciones.  
  <sub>app/plan/board/BoardShell.tsx (TaskModal) · app/plan/board/DetalleDoc.tsx · app/plan/board/RichText.tsx · app/plan/board/MakoChecklist.tsx</sub>
- 🟢 **Project Detail**  `/plan`  · ícono `contexto`  
  El modal del proyecto: sus tareas, progreso, prioridad debatible y el detalle que MaKo puede reescribir.  
  <sub>app/plan/board/BoardShell.tsx (ProjectDetailModal) · app/plan/board/NotasLista.tsx</sub>
- 🟢 **New Task**  `/plan`  · ícono `pen`  
  Crear una tarea a mano; al confirmar pasa por el Perro Guardián, que puntúa, rutea y puede preguntar.  
  <sub>app/plan/board/CrearTareaModal.tsx · app/plan/board/guardian-form.tsx · lib/preguntas-contrato.ts</sub>
- 🟢 **New Project**  `/plan`  · ícono `tag`  
  Crear un proyecto (nombre con prefijo del catálogo, emoji, color, prioridad).  
  <sub>app/plan/board/CrearProyecto.tsx · app/plan/board/EmojiPicker.tsx · lib/plan-proyectos-catalogo.ts</sub>
- 🟡 **Task Search**  `/plan`  · ícono `search`  
  Buscador por campos + búsqueda con IA que devuelve ids y explica por qué. Tiene UI pendiente (queda cortado en el header).  
  <sub>app/plan/board/BuscadorTareas.tsx · app/plan/board/BoardShell.tsx (buscarConIA)</sub>
- 🟢 **Priority Debate**  `/plan`  · ícono `chats`  
  Discutir el score de una tarea con el Perro Guardián y aplicar el nuevo con su razón (con undo).  
  <sub>app/plan/board/DebateModal.tsx</sub>
- 🟢 **Deadline Debate**  `/plan`  · ícono `chats`  
  Discutir la fecha límite: el Perro propone deadline + razón contra el resto de las fechas y nunca pisa una puesta a mano sin avisar.  
  <sub>app/plan/board/FechaDebateModal.tsx</sub>
- 🟢 **Project Priority Debate**  `/plan`  · ícono `chats`  
  Lo mismo pero a nivel proyecto: reordena la prioridad del proyecto contra los demás.  
  <sub>app/plan/board/ProyectoDebateModal.tsx</sub>
- 🟢 **Meetings**  `/plan`  · ícono `closing`  
  El selector de reuniones de Fathom y la extracción: MaKo lee la transcripción troceada y arma el borrador de tareas.  
  <sub>app/plan/board/ReunionExtractModal.tsx · lib/plan-fathom.ts · lib/fathom-api.ts · lib/reunion-clasificar.ts</sub>
- 🟢 **Meeting Tasks**  `/plan`  · ícono `check`  
  El reparto de lo que salió de una reunión: cada tarea va al plan de SU responsable, con dedup contra lo que ya existe.  
  <sub>app/plan/board/ReunionTareas.tsx · lib/reunion-destinatarios.ts · lib/reunion-cliente.ts · lib/detalle-fusion.ts</sub>
- 🟢 **Pending Tasks Inbox**  `/plan`  · ícono `bell`  
  Lo que MaKo dejó esperando confirmación (borradores de reunión propios o mandados por otro). Nada se crea hasta que se confirma acá.  
  <sub>app/plan/board/TareasRecibidasModal.tsx · app/plan/board/ListaElegible.tsx · lib/plan-inbox.ts</sub>
- 🟢 **Created Tasks**  `/plan`  · ícono `check`  
  La bienvenida «MaKo cargó N tareas» tras una carga, reabrible desde el botón ✨ del header.  
  <sub>app/plan/board/TareasCreadasModal.tsx</sub>
- 🟢 **Import Files**  `/plan`  · ícono `contexto`  
  Bandeja multi-archivo (notas, PDFs, capturas, audios) de la que MaKo saca tareas; el que falla dice por qué sin llevarse a los otros.  
  <sub>app/plan/board/ImportarModal.tsx · lib/archivo-a-texto.ts · lib/formatos-archivo.ts · lib/importar-en-segundo-plano.ts</sub>
- 🟢 **Export Board**  `/plan`  · ícono `logout`  
  Bajarse el tablero desde el estado en memoria (anda igual en el board del dueño y en el del cliente).  
  <sub>app/plan/board/ExportarModal.tsx · app/plan/board/exportar.ts</sub>
- 🟢 **Missing Data**  `/plan`  · ícono `help`  
  Las tarjetas con deadline o checklist sin marcar; el botón del header con el warn que titila es la única forma de reabrirlo.  
  <sub>app/plan/board/DatosModal.tsx</sub>
- 🟡 **Assign Project**  `/plan`  · ícono `tag`  
  Mover una tarea de proyecto. Le falta búsqueda, filtro y orden en el selector.  
  <sub>app/plan/board/AsignarProyecto.tsx</sub>
- 🟢 **Delete**  `/plan`  · ícono `trash`  
  Borrado con confirmación de tarea o proyecto (y qué pasa con las tareas del proyecto).  
  <sub>app/plan/board/EliminarModal.tsx</sub>
- 🟢 **MaKo Project Writer**  `/plan`  · ícono `mako`  
  MaKo reescribe nombre, emoji y detalle de un proyecto; el cambio queda en el historial con actor IA.  
  <sub>app/plan/board/MakoProyecto.tsx</sub>
- 🟢 **Draft Review**  `/plan/revisar/[id]`  · ícono `check`  
  La pantalla a la que lleva el link que MaKo manda por WhatsApp: se contestan las preguntas de a una y recién ahí se crean las tareas.  
  <sub>app/plan/revisar/[id]/page.tsx · app/plan/revisar/[id]/RevisarPropuesta.tsx · app/plan/revisar/[id]/ContextoDelBorrador.tsx · app/plan/revisar/[id]/NoEsTuyo.tsx</sub>
- 🟢 **Watchdog** **A**  · ícono `agente`  
  El Perro Guardián: puntúa 1-100, pone deadline con razón, rutea al proyecto del catálogo, deduplica y arma la checklist. Corre al INGRESO de toda tarea, venga de donde venga.  
  <sub>lib/mako-guardian.ts · lib/todo-guardian.ts · lib/todo-rutear.ts · lib/preguntas-contrato.ts</sub>
- 🟢 **Meeting Reader** **A**  · ícono `closing`  
  Lee las reuniones de Fathom solo, saca los compromisos, los reparte por persona y deja el borrador esperando. Termina cuando entrega el borrador.  
  <sub>lib/plan-fathom.ts · lib/fathom-auto.ts · lib/reunion-auto.ts · lib/reunion-destinatarios.ts</sub>
- 🟡 **Auto-Close** **A**  · ícono `check`  
  Cierra solas las tarjetas cuyo trabajo ya está hecho según las señales del producto. Corre en el seed del board y en un cron; no propone evidencia en la UI todavía.  
  <sub>lib/todo-seeds.ts (autocompletarPorSenales) · lib/plan-senales.ts · app/api/cron/tareas-verificar/route.ts</sub>
- 🟢 **Startup Plan Seed** **A**  · ícono `idea`  
  El plan de arranque del cliente nuevo: se siembra si el board está vacío, recortado por fase y canal, y con lo ya resuelto marcado hecho.  
  <sub>lib/todo-seeds.ts · lib/todo-seed-ia.ts · lib/plan-senales.ts</sub>

### CRM

- 🟢 **CRM**  `/crm`  · ícono `crm`  
  Los leads del negocio: kanban por etapa, tabla, worklist de datos sin marcar y la ficha.  
  <sub>app/crm/page.tsx · app/crm/CrmBoard.tsx · app/crm/CrmToolbar.tsx · app/crm/crm-map.ts</sub>
- 🟢 **Kanban**  `/crm`  · ícono `grid`  
  Las columnas por etapa del funnel con bandas plegables y drag&drop; soltar en otra columna abre el wizard de movimiento.  
  <sub>app/crm/CrmBoard.tsx · lib/pipeline.ts</sub>
- 🟢 **Table**  `/crm`  · ícono `script`  
  La misma cartera en filas, con buscador, filtros por etapa/origen y conteo de visibles sobre el total.  
  <sub>app/crm/CrmBoard.tsx · app/crm/CrmToolbar.tsx</sub>
- 🟢 **Unmarked Data**  `/crm`  · ícono `help`  
  El worklist de leads a los que les falta un dato para que el tablero sea confiable, con higiene en lote.  
  <sub>app/crm/CrmBoard.tsx (SinMarcar, BulkHigiene) · lib/queries.ts (getPendientesDeMarcar)</sub>
- 🟢 **Lead Sheet**  `/crm`  · ícono `perfil`  
  La ficha en modal, de solo lectura, con tabs Resumen / Cobranza / Actividad. La edición linkea a /crm/[id].  
  <sub>app/crm/LeadSheet.tsx · app/crm/LeadEditModal.tsx · app/crm/lead-view/LeadTabs.tsx · app/crm/lead-view/InfoPrincipalCard.tsx</sub>
- 🟢 **Lead Detail**  `/crm/[id]`  · ícono `notepencil`  
  La ficha como página completa, con la tab Editar que es donde se escribe de verdad.  
  <sub>app/crm/[id]/page.tsx · app/crm/[id]/LeadDetailBody.tsx · app/crm/[id]/EditLeadForm.tsx · app/crm/edit-logic.ts</sub>
- 🟢 **New Lead**  `/crm/new`  · ícono `pen`  
  Alta manual: nombre + un canal de contacto como mínimo, fechas opcionales.  
  <sub>app/crm/new/page.tsx · app/crm/new/NewLeadForm.tsx</sub>
- 🟢 **Stage Move**  `/crm`  · ícono `funnel`  
  El wizard con más ramas de la app: completa lo que la etapa destino exige (¿hubo R1?, Fathom, motivo de salida, plan de cuotas) antes de mover.  
  <sub>app/crm/StageMoveDialog.tsx · lib/stage-requirements.ts · app/crm/motivos-salida.ts · app/_components/WizardShell.tsx</sub>
- 🟢 **Time Slot Picker**  `/crm`  · ícono `closing`  
  El desplegable de horarios modelo Google Calendar (07:00–22:00, paso 15) para agendar y reagendar; lee la agenda real y avisa cuando no quedan slots.  
  <sub>app/crm/SelectorHora.tsx · app/crm/horarios-respuesta.ts · app/crm/calendly-widget.ts · app/api/crm/horarios</sub>
- 🟢 **Import Leads**  `/crm`  · ícono `contexto`  
  Importar CSV con mapeo de columnas y resumen de qué entró, qué se actualizó y qué se rechazó.  
  <sub>app/crm/ImportarLeadsModal.tsx · app/crm/leads-importar.ts · app/crm/importar-server.ts</sub>
- 🟢 **Export Leads**  `/crm`  · ícono `logout`  
  Bajarse la cartera filtrada en CSV o markdown.  
  <sub>app/crm/ExportarLeadsModal.tsx · app/crm/leads-exportar.ts · app/crm/leads-markdown.ts</sub>
- 🟢 **Journey Timeline**  `/crm`  · ícono `analytics`  
  La línea de tiempo del lead: por qué etapas pasó, cuándo y qué lo movió.  
  <sub>app/crm/JourneyTimeline.tsx · lib/journey.ts</sub>
- 🟡 **Deal Details**  `/crm`  · ícono `tag`  
  Producto, monto, cuotas y estado de cobranza del trato. Quedaron campos del rediseño sin backend.  
  <sub>app/crm/[id]/DealDetailsCard.tsx · app/crm/[id]/deal-actions.ts · lib/pagos.ts</sub>
- 🟡 **Tracking Timeline**  `/crm`  · ícono `spy`  
  Los eventos de tracking del lead (visitas, VSL, UTMs). La cadena de identificación tiene tramos que no siempre resuelven a un lead.  
  <sub>app/crm/lead-view/TrackingTimelineCard.tsx · lib/leads.ts (getTrackingEvents)</sub>
- 🟢 **Audit History**  `/crm`  · ícono `eye`  
  Quién tocó qué campo y cuándo, con MaKo como actor explícito cuando fue la IA.  
  <sub>app/crm/lead-view/AuditHistory.tsx · app/crm/lead-view/DatosSinMarcarCard.tsx</sub>
- 🟢 **Lead Insights** **A**  `/crm`  · ícono `mako`  
  MaKo genera el diagnóstico del lead cruzando su ficha, sus llamadas y su comportamiento; avisa qué datos le faltan para poder hacerlo.  
  <sub>app/crm/lead-view/GeneratedInsightCard.tsx · app/crm/insights-actions.ts · lib/lead-insights.ts · lib/closing.ts</sub>
- 🟡 **CRM Automation** **A**  `/crm`  · ícono `agente`  
  El motor que mueve leads de etapa solo por sus reglas T1..T6. Motor y aplicación están hechos pero gateados por flag por workspace.  
  <sub>app/crm/CrmAutoToggle.tsx · app/crm/auto-actions.ts · lib/crm-auto.ts · lib/crm-auto-plan.ts</sub>
- 🟢 **MaKo Confirmations**  `/crm`  · ícono `check`  
  El gate donde MaKo pide permiso antes de aplicar lo que decidió sobre un lead; vive en el shell pero se ve sobre todo en el CRM.  
  <sub>app/_components/MakoConfirmGate.tsx · app/crm/mako-confirm-actions.ts · lib/mako-confirmaciones.ts · app/crm/mako-setter.ts</sub>

### Ads Manager

- 🟢 **Ads Manager**  `/ads-manager`  · ícono `grid`  
  La réplica del Ads Manager de Meta adentro de la app: estado en vivo + rendimiento cruzado con el CRM, y las escrituras a Meta.  
  <sub>app/ads-manager/page.tsx · app/ads-manager/AdsManagerView.tsx · app/api/ads-manager/ · app/api/meta-health/route.ts</sub>
- 🟢 **Campaigns Table**  `/ads-manager`  · ícono `ads`  
  La tabla de tres niveles (campañas/conjuntos/anuncios) con selección cruzada, columnas configurables, orden, encender-apagar y editar presupuesto en la celda.  
  <sub>app/ads-manager/CampanasBrowser.tsx · lib/meta-health.ts · lib/meta-health-ui.ts</sub>
- 🟢 **Campaign Detail**  `/ads-manager`  · ícono `analytics`  
  El modal de UNA campaña: serie diaria por métrica, desgloses (demografía, plataforma, región) y el cruce con cierres y cash del CRM.  
  <sub>app/ads-manager/EntityDetalle.tsx · app/api/entity-insights · app/marketing/ad-charts.tsx</sub>
- 🟢 **Adset Detail**  `/ads-manager`  · ícono `analytics`  
  El mismo modal a nivel conjunto (level='adset'): rendimiento del público y sus recomendaciones de Meta.  
  <sub>app/ads-manager/EntityDetalle.tsx</sub>
- 🟢 **Ad Detail**  `/ads-manager/[adId]`  · ícono `tvad`  
  El detalle del anuncio con sus tabs (rendimiento, creativo, guion). Tiene deep link propio y también se abre inline desde la tabla.  
  <sub>app/ads-manager/[adId]/page.tsx · app/ads-manager/ad-resolver.ts · app/marketing/ad-charts.tsx (AdDetailTabs)</sub>
- 🟢 **New Campaign**  `/ads-manager`  · ícono `hammer`  
  El wizard prompt → creativos → público/destino → MaKo arma la estructura → revisión → publicar EN PAUSA. Tiene modo 'existente' para subir creativos a una campaña que ya está.  
  <sub>app/ads-manager/NuevaCampanaModal.tsx · app/api/ads-manager/campaign-create · app/api/ads-manager/campaign-suggest · app/api/ads-manager/campaign-preview</sub>
- 🟢 **Add Adset**  `/ads-manager`  · ícono `grid`  
  Agregar un conjunto a una campaña existente; nace en pausa.  
  <sub>app/ads-manager/AgregarConjuntoModal.tsx · app/api/ads-manager/adset-add</sub>
- 🟢 **Add Ad**  `/ads-manager`  · ícono `video`  
  Agregar un anuncio a un conjunto existente, reusando creativos ganadores o subiendo nuevos; nace en pausa.  
  <sub>app/ads-manager/AgregarAnuncioModal.tsx · app/api/ads-manager/ad-add · app/api/ads-manager/analyze-creatives</sub>
- 🟢 **Edit Audience**  `/ads-manager`  · ícono `crm`  
  Editar el público de un conjunto (targeting); al guardar, Meta vuelve a revisar.  
  <sub>app/ads-manager/EditarPublicoModal.tsx · app/api/ads-manager/adset-targeting · app/api/ads-manager/targeting · app/api/ads-manager/audience-create</sub>
- 🟢 **Edit Ad Copy**  `/ads-manager`  · ícono `escribir`  
  Editar los textos de un anuncio ya publicado; al guardar vuelve a revisión de Meta.  
  <sub>app/ads-manager/EditarTextosModal.tsx · app/api/ads-manager/ad-edit</sub>
- 🟢 **Creative Upload**  `/ads-manager`  · ícono `imagegen`  
  La subida de imágenes y videos a Meta con URL firmada; la comparten Nueva campaña y Agregar anuncio.  
  <sub>app/ads-manager/creativeUpload.ts · app/api/ads-manager/creative-upload · app/api/ads-manager/creative-signurl</sub>
- 🟢 **Bulk Rename**  `/ads-manager`  · ícono `pen`  
  Renombrar en lote por plantilla con variables ({nnn}, {mes}, {padre}…) y preview antes de escribir a Meta.  
  <sub>app/ads-manager/CampanasBrowser.tsx (RenameModal, applyTemplate) · app/api/ads-manager/rename-suggest</sub>
- 🟡 **Meta Recommendations**  `/ads-manager`  · ícono `meta`  
  El modal «Analizar (Meta)» con el Opportunity Score y las recomendaciones de la API. Meta a menudo no devuelve nada y la pantalla lo explica en vez de inventar.  
  <sub>app/ads-manager/CampanasBrowser.tsx (RecosModal) · app/api/meta-recommendations</sub>
- 🟢 **Ad Issues**  `/ads-manager`  · ícono `help`  
  El modal de anuncios con problema (rechazado, en revisión, retenido) con el atajo a editar los textos.  
  <sub>app/ads-manager/CampanasBrowser.tsx (ProblemaModal) · app/api/ads-manager/ad-aprobacion</sub>
- 🟢 **Meta Approval Tutorial**  `/ads-manager`  · ícono `soporte`  
  El paso a paso para destrabar el «peer approval» de Meta, que no tiene API: hay que hacerlo a mano en el Business Manager.  
  <sub>app/ads-manager/TutorialAprobacionMeta.tsx</sub>
- ⚪ **Ads Optimizer Bot** **A**  · ícono `agente`  
  El agente que vigila y mueve la pauta solo: sube y baja presupuesto, apaga lo que no rinde y avisa. No existe todavía; el trabajo vive en el proyecto homónimo del catálogo.  
  <sub>lib/plan-proyectos-catalogo.ts (proyecto «Ads Optimizer Bot», familia agente)</sub>

### WhatsApp

- 🟢 **WhatsApp**  `/whatsapp`  · ícono `whatsapp`  
  El canal de todos los días con los leads: dos bandejas (oficial y de empresa), secuencias automáticas y plantillas.  
  <sub>app/whatsapp/page.tsx · app/whatsapp/WhatsAppApp.tsx · app/whatsapp/_shared/ · lib/chatwoot.ts</sub>
- 🟢 **Official Inbox**  `/whatsapp`  · ícono `meta`  
  La bandeja del número oficial (Chatwoot/Meta): tres columnas, hilo, composer con plantillas y la ventana de 24h.  
  <sub>app/whatsapp/WhatsAppApp.tsx · app/whatsapp/_shared/ChatHilo.tsx · app/whatsapp/_shared/Ticks.tsx · app/whatsapp/_shared/VoiceRecorder.tsx</sub>
- 🟢 **Business Inbox**  `/whatsapp`  · ícono `chats`  
  La bandeja del número no oficial (Evolution, por QR), espejada en nuestra DB con acento índigo para que nunca se confunda con la oficial.  
  <sub>app/whatsapp/EmpresaInbox.tsx · lib/evolution.ts · lib/evolution-envio.ts · app/api/whatsapp/evolution/mensajes</sub>
- 🟢 **Automated Sequences**  `/whatsapp`  · ícono `funnel`  
  Las secuencias de nutrición por etapa: pasos, esperas, plantilla asociada y activar/desactivar.  
  <sub>app/whatsapp/WhatsAppApp.tsx (view sequences) · lib/nutricion.ts · lib/nutricion-desenlace.ts</sub>
- 🟢 **Templates**  `/whatsapp`  · ícono `script`  
  Editor de plantillas de Meta con validación en vivo de MaKo (riesgo + regla citada + aplicar correcciones), variables del lead, envío a aprobación y estado.  
  <sub>app/whatsapp/PlantillasPanel.tsx · lib/plantillas.ts · lib/nutricion-plantillas.ts</sub>
- 🟢 **Ask MaKo**  `/whatsapp`  · ícono `mako`  
  El chat de MaKo dentro de la tab, con el contexto de secuencias y plantillas cargado.  
  <sub>app/whatsapp/WhatsAppApp.tsx (seqTab 'mako') · app/_components/MakoChat.tsx</sub>
- 🟢 **WhatsApp Advisor** **A**  `/whatsapp`  · ícono `agente`  
  MaKo en el panel del chat: lee la conversación real, la etapa y la ventana de 24h y recomienda qué escribirle a ESTE lead. Dos modos, Consejo y Chat, con historial por contacto.  
  <sub>app/whatsapp/WhatsAppAdvisor.tsx · lib/whatsapp-advisor.ts</sub>
- 🟡 **Nutrition Writer** **A**  `/whatsapp`  · ícono `escribir`  
  MaKo escribe las secuencias en la voz del negocio y el usuario solo aprueba. Falta el go-live del envío real.  
  <sub>app/_components/NutricionGenerar.tsx · lib/nutricion-generator.ts · lib/envio-flags.ts</sub>
- 🟢 **Evolution Connect**  `/whatsapp`  · ícono `plug`  
  El chip de estado y el modal de vinculación por QR del número de empresa, con polling y refresco del QR.  
  <sub>app/whatsapp/EvolutionConnect.tsx · lib/evolution.ts</sub>
- 🟢 **Chatwoot Health**  `/whatsapp`  · ícono `dot`  
  El chip «API Oficial» con salud real del webhook: si el problema es reparable lo registra solo; si no, explica y deja reintentar.  
  <sub>app/whatsapp/ChatwootWebhookChip.tsx · lib/chatwoot.ts · app/api/webhooks/chatwoot</sub>
- 🟢 **WhatsApp Onboarding**  `/whatsapp`  · ícono `onboarding`  
  El tramo Conectar → Contexto → Ensayo de esta tab. Es el mismo wizard del Chat Agent parametrizado: lo que se hace acá queda hecho allá.  
  <sub>app/whatsapp/OnboardingCanalWhatsApp.tsx · app/automations/OnboardingChatAgent.tsx · lib/tab-onboarding-state.ts</sub>

### Email

- 🟢 **Email**  `/email`  · ícono `email`  
  El canal de email: secuencias por etapa del motor de nutrición y broadcasts puntuales, sobre Resend.  
  <sub>app/email/page.tsx · app/email/EmailApp.tsx · app/api/email/ · lib/resend.ts</sub>
- 🟢 **Sequences**  `/email`  · ícono `newsletter`  
  Las secuencias de email por etapa y trigger, con sus pasos editables y el toggle de activa; comparten tabla con las de WhatsApp.  
  <sub>app/email/EmailApp.tsx (SequencesView) · app/api/email/secuencias · lib/nutricion.ts</sub>
- 🟡 **Broadcasts**  `/email`  · ícono `sonido`  
  Envíos puntuales a un segmento, con estados borrador/programado/enviando/enviado/cancelado. El envío real está gateado por workspace.  
  <sub>app/email/EmailApp.tsx (BroadcastsView) · app/api/email/broadcasts · lib/envio-flags.ts</sub>
- 🟡 **Sending Domain**  `/email`  · ícono `web`  
  El mini-setup del dominio de envío: remitente, registros DNS y estado de verificación en Resend. Hoy el plan es un dominio único.  
  <sub>app/email/EmailApp.tsx (DominioSetup) · app/api/email/dominio · lib/resend.ts</sub>
- 🟢 **Email Writer** **A**  `/email`  · ícono `escribir`  
  MaKo escribe o reescribe asunto, preheader y cuerpo desde una instrucción, dentro del compositor del broadcast.  
  <sub>app/api/email/generar · app/email/EmailApp.tsx</sub>
- 🟢 **Email Onboarding**  `/email`  · ícono `onboarding`  
  El tramo de email del wizard compartido: conectar el dominio y probar que el correo llega.  
  <sub>app/email/OnboardingCanalEmail.tsx · app/automations/OnboardingChatAgent.tsx · lib/tab-onboarding-state.ts</sub>

### Instagram

- ⚪ **Instagram**  `/instagram`  · ícono `instagram`  
  Hoy es un ComingSoon con guard de rol. El alcance previsto: conectar la cuenta, leer DMs y publicar desde la app.  
  <sub>app/instagram/page.tsx · app/_components/ComingSoon.tsx · app/_components/nav.ts (comingSoon: true) · lib/plan-proyectos-catalogo.ts (proyecto «Instagram»)</sub>
- ⚪ **Instagram Inbox**  · ícono `chats`  
  La bandeja de DMs de Instagram. No existe ni un archivo: sale del alcance declarado del proyecto «Instagram» en el catálogo.  
  <sub>lib/plan-proyectos-catalogo.ts (proyecto «Instagram»)</sub>

### Operate (transversal)

- 🟢 **Tab Activation Panel**  · ícono `plug`  
  La pantalla que reemplaza a la tab cuando le falta la integración que la alimenta (CRM sin Meta ni Calendly, WhatsApp sin canal, Email sin Resend). El orden con el onboarding importa y ya mordió.  
  <sub>app/_components/PanelActivacion.tsx · lib/tab-activacion.ts · lib/credenciales.ts</sub>
- 🟢 **Tab Access Gate**  · ícono `admin`  
  El gate server-side de cada tab de Operate: capa contratada, rol dentro del workspace y onboarding bloqueante. Esconder el botón no protege nada; el que decide es el server.  
  <sub>lib/tab-access.ts · lib/capas.ts · lib/ws-tab.ts · proxy.ts</sub>
- 🟢 **Date Filter**  · ícono `config`  
  El rango de fechas que gobierna Ads Manager y las vistas de rendimiento, con validación del rango y default al mes en curso.  
  <sub>app/_components/FechaFiltro.tsx · app/_components/FechaFiltroGlobal.tsx · lib/date-utils.ts</sub>

## Analyze  ·  26 piezas

### Second Brain

- 🟡 **Second Brain**  `/second-brain`  · ícono `cerebro`  
  El hero de Analyze: hoy es el grafo del negocio + el mismo hub de 11 tabs del onboarding (lo que el cliente le cargó a MaKo); todavía no conecta señales ni saca conclusiones propias.  
  <sub>app/second-brain/page.tsx · app/second-brain/Grafo.tsx · app/second-brain/fisica.ts · lib/cerebro-grafo.ts</sub>
- 🟢 **Business Graph**  `/second-brain`  · ícono `grid`  
  El mapa de nodos estilo Obsidian con lo que MaKo entendió del negocio del CLIENTE (no el grafo de graphify sobre el código): física propia, color opt-in y foco no cromático.  
  <sub>app/second-brain/Grafo.tsx · app/second-brain/fisica.ts · lib/cerebro-grafo.ts · lib/cerebro-modelo.ts</sub>
- ⚪ **Context Selector**  · ícono `contexto`  
  El selector de contexto (negocio · producto · oferta · funnel) que decide sobre qué mira MaKo; sale de la tarea #522 y está declarado como pendiente en la cabecera de app/second-brain/page.tsx.  
  <sub>app/second-brain/page.tsx</sub>

### Dashboard

- 🟢 **Dashboard**  `/dashboard`  · ícono `graphics`  
  *(Reescrita a mano el 11/10/2026; el 08/08 era el shell que redirigía a /marketing.)* Un editor de informes estilo Looker Studio: Marketing y Comercial son las dos hojas del informe inicial (sus rutas traen con `?hoja=`), y Ads Analyst, Landing, Closing y Productividad son plantillas de hoja. `?hoja=<plantilla>` abre la hoja con esa firma o la AGREGA al informe (`hojaDestino`, lib/graficos-plantillas.ts). El closer lo ve con SÓLO la hoja Closing, en memoria y sin editar.  
  <sub>app/dashboard/page.tsx · app/dashboard/EditorInforme.tsx · lib/graficos-plantillas.ts · app/api/graficos/route.ts</sub>
- 🟢 **Marketing Dashboard**  `/marketing`  · ícono `graphics`  
  KPIs estrella, salud del funnel en trapezoides, tendencias, anuncios ganadores y los desgloses de toda la cuenta de Meta (edad/género, plataforma, mapa). Gateado por PanelActivacion si Meta no está conectado.  
  <sub>app/marketing/page.tsx · app/marketing/ResumenCreativos.tsx · app/marketing/AnuncioCard.tsx · app/marketing/ad-charts.tsx</sub>
- 🟢 **Commercial Dashboard**  `/comercial`  · ícono `funnel`  
  En la app se llama «Comercial»: revenue (Sold/Cash/Outstanding + a quién cobrarle), funnel comercial Agenda→Asistió→Calificado→Cierre, CAC, SCL (ciclo de venta) y cohortes semanales/mensuales con madurez.  
  <sub>app/comercial/page.tsx · app/comercial/RevenueKpis.tsx · app/comercial/RevenueMensualChart.tsx · app/comercial/CobrarTable.tsx</sub>
- 🟡 **Meta Account Health**  `/marketing/salud`  · ícono `integraciones`  
  El estado de entrega de la cuenta de Meta + las recomendaciones de MaKo. La ruta HOY solo redirige a /integraciones y SaludBoard.tsx quedó huérfano, aunque sigue citado como «ver en app» del área semáforo.  
  <sub>app/marketing/salud/page.tsx · app/marketing/salud/SaludBoard.tsx · lib/meta-health.ts · lib/meta-health-ui.ts</sub>

### Analyze

> **Nota del 11/10/2026** (escrita a mano sobre este relevamiento del 08/08): Offer dejó de ser
> un ítem del grupo Analysts y es un ítem SUELTO de Analyze, en el lugar que dejó Análisis
> (entre Second Brain y Dashboard). Análisis se mudó adentro de Experiments como su cuarta tab.
> Las fichas de Offer y de Experiments están al día con eso; el resto del documento sigue siendo
> la foto del 08/08.

- 🟡 **Offer**  `/offer`  · ícono `tag`  
  Offer Analyst y Offer Generator en UNA tab: un chat donde MaKo pregunta por las piezas de la oferta, la diagnostica con una rúbrica y escribe la oferta nueva, descargable en PDF; cada cambio propuesto se puede probar como experimento («Probarlo» abre el alta en Experiments con la hipótesis escrita). La key del nav sigue siendo `offer` y `/offer-analyst` redirige a `/offer`. Los dos proyectos del tablero (Offer Analyst y Offer Generator) siguen separados.  
  <sub>app/offer/page.tsx · app/offer/OfferApp.tsx · app/api/offer/route.ts · app/api/offer/pdf/route.ts · lib/offer-marco.ts · lib/offer-ia.ts · lib/offer-pdf.ts</sub>
- ⚪ **Competitor Spy**  `/competitor-spy`  · ícono `spy`  
  Vigilar lo que hacen los demás (anuncios y ofertas de la competencia); es la única de Analyze que no analiza un activo propio. Hoy es ComingSoon; /market-analyst es la ruta vieja que redirige y la nav key sigue siendo 'market-an'.  
  <sub>app/competitor-spy/page.tsx · app/market-analyst/page.tsx · app/_components/ComingSoon.tsx</sub>

### Experiments

- 🟢 **Experiments**  `/experimentos`  · ícono `experiments`  
  El shell de cuatro tabs (Retro · Experiments · Conclusions · Análisis) con el estado de datos, el toast y el modo demo local sin Supabase. Sin Meta, el PanelActivacion ocupa Retro, Experiments y Conclusions (miden contra Meta) y Análisis sigue andando: sale del CRM. *(11/10/2026: antes eran tres tabs, y sin Meta el panel tapaba la pantalla entera.)*  
  <sub>app/experimentos/page.tsx · app/experimentos/ExperimentosApp.tsx · app/experimentos/tabs.ts · app/experimentos/ui.tsx · app/experimentos/_demo.ts</sub>
- 🟢 **Retro** **A**  `/experimentos`  · ícono `mako`  
  El agente que corre 8 fases (memoria → recolección → auditoría → diagnóstico paralelo por área → cruces → cerebro → verificación → redacción) sobre un período y devuelve el reporte v3 (Overview · Plan · Detail) con hallazgos, plan encadenado a experimentos y tareas, gate del Perro y ejecución en vivo por stream NDJSON.  
  <sub>app/experimentos/RetroTab.tsx · app/experimentos/RetroReport.tsx · lib/retro.ts · lib/retro-pipeline.ts</sub>
- 🟢 **Experiments Board**  `/experimentos`  · ícono `experiments`  
  Los experimentos en curso y propuestos: creación guiada (hipótesis en texto → MaKo la convierte en métrica del catálogo + dirección + ventana + criterio) y el ciclo iniciar / cerrar / descartar contra el dato real.  
  <sub>app/experimentos/ExperimentsTab.tsx · lib/experimentos.ts · app/api/experimentos/route.ts · app/api/experimentos/suggest/route.ts</sub>
- 🟢 **Conclusions**  `/experimentos`  · ícono `check`  
  Las verdades del negocio ya validadas: experimentos cerrados con veredicto (validada / refutada / no concluyente), su serie de datos y el filtro por veredicto. Es el único lugar del producto donde se declara una verdad.  
  <sub>app/experimentos/ConclusionsTab.tsx · lib/experimentos.ts</sub>
- 🟢 **Análisis**  `/experimentos?tab=analisis`  · ícono `analytics`  
  *(Entra el 11/10/2026: hasta ese día era su propia tab, `/analisis`, que hoy redirige acá con su query.)* El informe del período en el orden en que se pregunta: advertencias arriba, la cascada de costos, los que asistieron sin calificar, los creativos y qué haría falta para la meta. El rango viaja en la URL para poder compartirlo. `/analisis/trimestre` (el informe congelado del ws1) se quedó en su ruta.  
  <sub>app/experimentos/VistaAnalisis.tsx · lib/analisis-negocio.ts · lib/analisis-modelo.ts · app/analisis/page.tsx · app/analisis/trimestre/page.tsx</sub>

### Analysts

> **Nota del 11/10/2026** (escrita a mano sobre este relevamiento del 08/08): Ads Analyst, Landing
> Analyst y Closing Analyst SALIERON de la sidebar (decisiones 4, 5 y 6 de Martín de ese día), como
> antes Productivity Analyst. Lo que era análisis son HOJAS del Dashboard (`/dashboard?hoja=ads-analyst`,
> `?hoja=landing`, `?hoja=closing`); las tareas se mudaron: valorar un guion a Ads Writer
> (`/ads-writer?tab=analizar`), analizar una página a Landing Generator (`/landing-generator/analizar`),
> y las de Closing (sincronizar, re-analizar, revisar) van COMPLETAS a la hoja Closing, con la ficha de
> cada llamada. El closer ve el Dashboard con SÓLO esa hoja. Las rutas viejas redirigen
> (`/closing?call=<id>` → `?hoja=closing&llamada=<id>`) y las keys del nav (`script`, `landing-an`,
> `closing`) se quedaron en las capas y en los gating de la API. Las fichas de abajo están al día con
> eso; el grupo Analysts quedó con VSL, Chat y CS Analyst (los tres por construir).

- 🟢 **Ads Analyst**  `/dashboard?hoja=ads-analyst`  · ícono `notepencil`  
  Cruza el análisis cualitativo de Claude sobre el guion (ángulo, gancho, beats) con las métricas Meta×CRM de todo el histórico del anuncio; arriba viven Patrones (ganadores/a cortar/de proceso) y el Cuadrante de Retención. Sin filtro de fecha y gateado por Meta. *(11/10/2026: ya no es una tab; es la hoja «Ads Analyst» del Dashboard y `/ads-analyst` redirige ahí.)*  
  <sub>lib/graficos-plantillas-analysts.ts · app/dashboard/bloques/extra/BloquesAds.tsx · lib/ads-analyst.ts · lib/script-angles.ts · app/ads-analyst/page.tsx (redirect)</sub>
- 🟢 **Landing Analyst**  `/landing-generator/analizar`  · ícono `web`  
  Baja la landing del cliente, le lee el copy y lo cruza con el comportamiento real de esa URL (beacon + agendas del CRM): lista de landings a la izquierda, diagnóstico con hallazgos por severidad a la derecha. A propósito NO se gatea por integración: con pegar una URL alcanza. *(11/10/2026: ya no es una tab; analizar es «Diagnóstico», dentro de Landing Generator, y el pulso y el mapa de calor son la hoja «Landing» del Dashboard. `/landing-analyst` redirige.)*  
  <sub>app/landing-generator/analizar/page.tsx · app/landing-analyst/LandingAnalystApp.tsx · lib/landing-analyst.ts · app/api/landing-analyst/</sub>
- ⚪ **VSL Analyst**  `/vsl-analyst`  · ícono `video`  
  En qué tramo se cae el espectador del VSL, contra qué parte del guion, y qué pasó después con ese lead en el CRM. Hoy es ComingSoon.  
  <sub>app/vsl-analyst/page.tsx · app/_components/ComingSoon.tsx</sub>
- ⚪ **Chat Analyst**  `/chat-analyst`  · ícono `chats`  
  Lo que Closing Analyst hace con las llamadas, pero con las conversaciones (WhatsApp, Email, Instagram): dónde se cae el chat, qué objeción aparece y qué responde mejor. Hoy es ComingSoon; visible para rol setter.  
  <sub>app/chat-analyst/page.tsx · app/_components/ComingSoon.tsx</sub>
- 🟢 **Closing Analyst**  `/dashboard?hoja=closing`  · ícono `closing`  
  Trae las llamadas de Fathom, las matchea con los leads del CRM y analiza al closer en las de VENTA (R1/R2) con método SPIN; las de entrega de servicio, internas y de prueba se detectan y se excluyen. *(11/10/2026: ya no es una tab; es la hoja «Closing» del Dashboard, con la ficha de cada llamada y sus tareas. El closer ve SÓLO esa hoja, sin editar.)*  
  <sub>lib/graficos-plantillas-analysts.ts · app/dashboard/bloques/extra/BloquesClosing.tsx · app/dashboard/bloques/extra/FichaLlamada.tsx · lib/closing.ts · app/api/closing/ · app/closing/page.tsx (redirect)</sub>
- ⚪ **CS Analyst**  `/cs-analyst`  · ícono `cs`  
  Retención y customer success: anticipar la baja de un cliente ya cerrado. Hoy es ComingSoon.  
  <sub>app/cs-analyst/page.tsx · app/_components/ComingSoon.tsx</sub>
- ⚪ **YouTube Analyst**  · ícono `youtube`  
  El analista del canal de YouTube del cliente: qué video retiene, qué trae suscriptores y qué convierte. NO existe como ruta, carpeta ni entrada de nav — solo como proyecto del tablero /plan (estaba con 5 tareas y huérfano hasta que se lo sumó al catálogo).  
  <sub>lib/plan-proyectos-catalogo.ts</sub>
- 🟢 **Script Detail**  `/ads-analyst`  · ícono `tvad`  
  El modal de embudo de UN guion: retención beat por beat sobre los cuartiles de Meta, veredicto, override manual de ángulo y avatar, reanálisis, y las pestañas Rendimiento/Audiencia/Guion del anuncio (AdDetailTabs).  
  <sub>app/ads-analyst/ScriptsBrowser.tsx · app/marketing/ad-charts.tsx · app/api/ads-analyst/analyze/route.ts · app/api/ads-analyst/angle-override/route.ts</sub>
- 🟢 **All Scripts**  `/ads-analyst/guiones`  · ícono `script`  
  La ruta «ver todos»: la tab previsualiza 8 guiones y ésta muestra los N con el mismo toggle tabla/tarjetas y el mismo modal de embudo. Solo lee.  
  <sub>app/ads-analyst/guiones/page.tsx · app/ads-analyst/ScriptsBrowser.tsx</sub>
- 🟢 **New Script Check**  `/ads-writer?tab=analizar`  · ícono `pen`  
  «Analizá un guion nuevo»: se pega un guion que todavía no está en Meta, MaKo lo compara contra lo que ya funciona y devuelve valoración + qué esperar; los intentos quedan en un historial de borradores borrable.  
  <sub>app/ads-analyst/ScriptsBrowser.tsx · app/api/ads-analyst/valorar/route.ts · lib/ads-analyst.ts</sub>
- 🟢 **Angles & Avatars**  `/ads-analyst`  · ícono `tools`  
  El CRUD de la taxonomía de ángulos y avatares (color, nombre y la descripción que además guía a la IA al clasificar). Se abre desde Ads Analyst y desde el onboarding: misma data, un solo componente.  
  <sub>app/components/TaxonomyManager.tsx · app/api/ads-analyst/angles/route.ts · app/api/ads-analyst/avatares/route.ts · lib/script-angles.ts</sub>
- 🟢 **Closing Metrics**  `/dashboard?hoja=closing`  · ícono `analytics`  
  La vista «Métricas» del panorama agregado: KPIs, tendencia del score, embudo, factores (gap ganadas↔perdidas por dimensión) y el ranking de closers. *(11/10/2026: son los bloques y gráficos de la hoja Closing; los calcula el server con las copias de lib/api-mako/areas/closing.helpers.ts.)*  
  <sub>lib/graficos-plantillas-analysts.ts · app/dashboard/bloques/extra/BloquesClosing.tsx · lib/graficos-bloques-extra.ts</sub>
- 🟢 **Calls**  `/dashboard?hoja=closing&llamada=`  · ícono `mic`  
  La lista de llamadas y el detalle de una — grabación con deep-link al segundo, dimensiones, momentos, objeciones, transcript anotado, revisión manual e historial de ediciones. *(11/10/2026: la ficha es un modal del Dashboard; `?llamada=<recording_id>` la abre, y el `?call=` de la ruta vieja se traduce a eso.)*  
  <sub>app/dashboard/bloques/extra/FichaLlamada.tsx · app/api/closing/transcript/route.ts · app/api/closing/revise/route.ts</sub>

## Sales Machine  ·  17 piezas

### Sales Machine

- 🟢 **Landing Generator**  `/landing-generator`  · ícono `web`  
  Desde el 11/10/2026, el editor de landings copiado de Gamma 5: Panel, «Crear con IA» en dos pasos, edición por secciones y bloques, temas, exportar y publicar en hola-mako.com/l/<slug> (docs/diseno-editor-landing.md). La pantalla vieja (LandingWriterApp.tsx) se retiró.  
  <sub>app/landing-generator/ · app/api/landing-generator/ · app/l/ · lib/editor-landing/ · app/landing-writer/page.tsx (redirect de la ruta vieja, con la query)</sub>
- ⚪ **VSL Generator**  `/vsl-generator`  · ícono `video`  
  Escribir el guion de un VSL. Hoy es un ComingSoon puro; no hay lib ni API (lib/vsl-estructuras.ts existe pero lo consume el Landing Analyst, no esto).  
  <sub>app/vsl-generator/page.tsx (ComingSoon) · app/vsl-writer/page.tsx (redirect) · app/_components/nav.ts (key 'vsl-writer', comingSoon: true)</sub>
- ⚪ **Lead Magnet Generator**  `/lead-magnet-generator`  · ícono `leadmagnet`  
  Producir el lead magnet entregable. ComingSoon sin backend; el CONTENIDO del entregable ya se define en el onboarding (EntregableView), así que esta tab es la que lo materializa.  
  <sub>app/lead-magnet-generator/page.tsx (ComingSoon) · app/_components/nav.ts (comingSoon: true)</sub>
- 🟢 **Automations** (ex Chatbot, renombrada el 09/10/2026)  `/automations`  · ícono `chatbot` · key `setting`  
  El cockpit del agente que conversa: secuencias de mensajes con estrategia, simulación como lead, métricas y hand-off al humano. Su H1 en pantalla todavía dice «Chat Agent».  
  <sub>app/automations/page.tsx · app/automations/ChatAgentApp.tsx · app/chatbot/page.tsx · app/chat-bot/page.tsx · app/chat-agent/page.tsx · app/setting/page.tsx (redirects) · lib/ruta-automations.ts · lib/setting-estrategia.ts</sub>
- ⚪ **Sales Email**  `/sales-email`  · ícono `salesemail`  
  Escribir los emails de venta. ComingSoon sin backend; distinto de /email (Operate), que es la bandeja de todos los días.  
  <sub>app/sales-email/page.tsx (ComingSoon) · app/_components/nav.ts (comingSoon: true)</sub>
- ⚪ **Newsletters**  `/newsletters`  · ícono `newsletter`  
  Escribir newsletters recurrentes a la lista. ComingSoon sin backend.  
  <sub>app/newsletters/page.tsx (ComingSoon) · app/_components/nav.ts (comingSoon: true)</sub>
- ⚪ **Closing Script**  `/closing-script`  · ícono `closingscript`  
  El guion que usa el closer en la llamada. ComingSoon; su contraparte de ANÁLISIS (/closing, Closing Analyst) sí existe y funciona, así que el bucle natural es que ésta se alimente de aquélla.  
  <sub>app/closing-script/page.tsx (ComingSoon) · app/_components/nav.ts (rolesWs ['closer'], comingSoon: true)</sub>
- ⚪ **Sales Roleplay**  `/sales-roleplay`  · ícono `roleplay`  
  Entrenar la llamada contra MaKo haciendo de prospecto. ComingSoon; el patrón de «MaKo hace de cliente» ya está resuelto en el paso ④ ensayo del Chatbot y es de donde debería copiarse.  
  <sub>app/sales-roleplay/page.tsx (ComingSoon) · app/automations/OnboardingChatAgent.tsx (el ensayo, como referencia)</sub>

### Landing Generator

- 🟢 **Landing Versions**  · ícono `contexto`  
  Hasta el 11/10/2026, el panel «Tus versiones» del generador anterior (landing_drafts). Hoy sus filas se ofrecen en el Panel del editor como «Importar → Del generador anterior» y se convierten con specADoc.  
  <sub>lib/editor-landing/server.ts (borradoresViejos, importarBorrador) · lib/editor-landing/spec-a-doc.ts · lib/landing-writer.ts (listarDrafts, que usa la API de MaKo)</sub>

### Chatbot

- 🟢 **Sequences**  · ícono `whatsapp`  
  La vista por defecto: las secuencias de mensajes listadas como CONTACTOS de WhatsApp, con el hilo simulado que se reproduce solo al entrar y un composer real (texto, emoji, nota de voz) contra MaKo-setter.  
  <sub>app/automations/SimuladorWhatsApp.tsx · app/whatsapp/_shared/ChatHilo.tsx · app/api/chat-agent/simulador/</sub>
- 🟢 **Sequence Profile**  · ícono `chats`  
  El perfil de UNA secuencia, cubriendo el chat: diagrama de cómo juega paso a paso, edición de estrategia (objetivo/gancho/preguntas/desenlace), activar-pausar y prueba real a tu teléfono o mail. El setter la ve en solo lectura.  
  <sub>app/automations/SecuenciaPerfil.tsx · lib/setting-estrategia.ts</sub>
- 🟢 **New Sequence Wizard**  · ícono `hammer`  
  El wizard de 9 pasos que arma una secuencia (a quién → objetivo → ¿lead magnet? → cuál → preguntas → MaKo redacta → desenlace → prueba → activar), con el mismo chrome fullscreen del onboarding.  
  <sub>app/automations/SecuenciaWizard.tsx · app/_components/WizardShell.tsx · app/_components/PanelMarketing.tsx · lib/etapas-contexto.ts</sub>
- 🟢 **Chatbot Dashboard**  · ícono `graphics`  
  KPIs del agente, serie diaria de envíos/respuestas/aperturas a 30 días y la comparativa por secuencia (recharts, mismo sistema de charts del repo).  
  <sub>app/automations/DashboardChatAgent.tsx · lib/setting-metricas.ts</sub>
- 🟢 **Handoffs** **A**  · ícono `help`  
  Los casos que MaKo no supo manejar: cuando el lead escribe algo fuera de todo escenario, el agente calla, avisa y deja el mensaje acá para que el dueño le enseñe la respuesta — que queda como escenario nuevo de esa secuencia.  
  <sub>app/automations/HandoffsPanel.tsx · lib/chat-agent-escenarios.ts</sub>
- 🟢 **Chatbot Onboarding**  · ícono `onboarding`  
  El único onboarding de tab realmente RENDERIZADO del producto: 11 pasos en 3 recorridos elegibles (Todo / Solo WhatsApp / Solo Email) siguiendo Conectar → Contexto → Ensayo; del ensayo salen las secuencias.  
  <sub>app/automations/OnboardingChatAgent.tsx · app/automations/ChatAgentApp.tsx (ElegirRecorrido) · lib/tab-onboarding-state.ts (defs 'setting','whatsapp','email') · app/api/chat-agent/onboarding/route.ts</sub>
- 🟢 **Voice Notes**  · ícono `mic`  
  Texto o nota de voz se decide POR MENSAJE y se graba ahí mismo, dentro del wizard o del perfil. La biblioteca (setting_audios) sigue existiendo por debajo pero ya no es una sub-tab: reutiliza los audios entre secuencias.  
  <sub>app/automations/PasoAudioControl.tsx · app/automations/GrabadorAudioPaso.tsx · app/whatsapp/_shared/VoiceRecorder.tsx · lib/audios-paso.ts</sub>

## Content Machine  ·  16 piezas

### Content Machine

- ⚪ **Ideas**  `/ideas`  · ícono `idea`  
  De qué hablar, antes de que haya pieza; va suelto arriba porque no es de ningún canal. ComingSoon, pero el norte ya está escrito: «un input suelto al estilo Mila que se guía hasta convertirse en guion».  
  <sub>app/ideas/page.tsx (ComingSoon) · app/admin/dev/ads-writer/bitacora.ts (PARTES → «IDEAS», estado 'sigue')</sub>

### Ads

- 🟢 **Ads Writer**  `/ads-writer`  · ícono `escribir`  
  La fábrica de guiones de anuncios: una sola acción primaria («Escribir el próximo guion»), cobertura arriba y dos vistas montadas en paralelo (Anuncios y Guiones). En pantalla se titula «Content Machine».  
  <sub>app/ads-writer/page.tsx · app/ads-writer/AdsWriterApp.tsx · lib/razones.ts · lib/guion-estado.ts</sub>
- ⚪ **Image Generator**  `/image-generator`  · ícono `imagegen`  
  Generar la imagen del anuncio. ComingSoon; sus dos insumos ya existen (Brand Persona con las fotos y el formato de imagen elegido en el Ad Detail), falta el generador.  
  <sub>app/image-generator/page.tsx (ComingSoon) · lib/persona.ts (insumo) · app/admin/dev/ads-writer/bitacora.ts (PARTES → «Imagen y video por celda»)</sub>
- ⚪ **Video Generator**  `/video-generator`  · ícono `videogen`  
  Generar el video del anuncio a partir del guion. ComingSoon; el guion y el formato de video ya salen de la Matriz.  
  <sub>app/video-generator/page.tsx (ComingSoon) · app/admin/dev/ads-writer/bitacora.ts (PARTES → «Imagen y video por celda»)</sub>
- 🟢 **Ads Matrix**  · ícono `grid`  
  La vista «Anuncios»: un carril por avatar y una tarjeta por razón de compra — cada celda es un anuncio en potencia. Sólido = ya tiene guion, punteado = un clic y MaKo lo escribe. Es el MISMO componente que la tab Matriz del onboarding.  
  <sub>app/onboarding/MatrizView.tsx · app/ads-writer/AdsWriterApp.tsx (la monta con sinCabecera) · lib/razones.ts</sub>
- 🟡 **Ad Detail**  · ícono `tvad`  
  El pop-up de una celda, con tabs Contexto · Guiones · Imagen · Video. Contexto y Guiones están completos; Imagen y Video sólo ELIGEN un formato de la biblioteca — el creativo todavía no se genera desde acá.  
  <sub>app/onboarding/MatrizView.tsx (TabModal, AnguloTab) · lib/angulos-data.ts · app/admin/dev/ads-writer/bitacora.ts (PARTES → «Imagen y video por celda», estado 'cola')</sub>
- 🟢 **Scripts Gallery**  · ícono `script`  
  La vista «Guiones»: todos los guiones del negocio aplanados fuera de su celda, con el avatar y la motivación de la que salieron, filtro por estado (el pipeline es a la vez resumen y filtro) y por fecha.  
  <sub>app/ads-writer/GuionesGlobal.tsx · app/ads-writer/GuionCard.tsx · app/onboarding/guion-ui.ts</sub>
- 🟢 **Script Reader**  · ícono `notepencil`  
  Leer y editar un guion partido en tarjetas por bloque (GANCHO, HISTORIA, CTA…), cambiar su estado del pipeline y borrarlo. Las etiquetas de bloque son contrato con el parser.  
  <sub>app/ads-writer/GuionLector.tsx · app/components/SeccionCard.tsx · lib/guion-estructuras.ts</sub>
- 🟢 **Script Angles**  `/admin/dev/ads-writer`  · ícono `tag`  
  Biblioteca GLOBAL de ángulos de guion (el enfoque del anuncio): requisitos, hooks de ejemplo, guía de cuerpo y CTA, reglas siempre/nunca, preguntas al dueño y estructuras compatibles. Sólo la edita el super-admin; la ven todos los clientes al generar.  
  <sub>lib/guion-angulos.ts · lib/guion-angulos-store.ts · app/admin/guiones/GuionesAdminView.tsx · app/admin/guiones/page.tsx (redirect a /admin/dev/ads-writer)</sub>
- 🟢 **Script Structures**  `/admin/dev/ads-writer`  · ícono `tools`  
  Biblioteca GLOBAL de estructuras (PAS, AIDA, BAB…): el esqueleto de bloques del guion. Sus etiquetas son CONTRATO con el parser que parte el guion en tarjetas — renombrar una rompe el render de guiones ya guardados.  
  <sub>lib/guion-estructuras.ts · lib/guion-estructuras-store.ts · app/admin/guiones/GuionesAdminView.tsx</sub>
- ⚪ **Ads Writer Onboarding**  · ícono `onboarding`  
  El onboarding de la tab Ads Writer: NO EXISTE. lib/tab-onboarding-state.ts sólo define whatsapp, email, setting, landing-an y landing-writer; sin entrada no hay estado que alimente a MaKo, y la regla del producto dice que toda tab tiene onboarding.  
  <sub>lib/tab-onboarding-state.ts (TAB_ONBOARDINGS — falta la key 'ads-writer') · .claude/skills/tab-onboarding/SKILL.md (el molde de las 3 etapas)</sub>

### Instagram

- ⚪ **Reels**  `/reels`  · ícono `videogen`  
  Guion y formato de reel de Instagram. ComingSoon sin backend.  
  <sub>app/reels/page.tsx (ComingSoon) · app/_components/nav.ts (grupo 'ig-formatos')</sub>
- ⚪ **Carousels**  `/carousels`  · ícono `carousel`  
  Armar carruseles de Instagram lámina por lámina. ComingSoon sin backend.  
  <sub>app/carousels/page.tsx (ComingSoon) · app/_components/nav.ts (grupo 'ig-formatos')</sub>
- ⚪ **Stories**  `/stories`  · ícono `stories`  
  Secuencias de historias de Instagram. ComingSoon sin backend.  
  <sub>app/stories/page.tsx (ComingSoon) · app/_components/nav.ts (grupo 'ig-formatos')</sub>

### YouTube

- ⚪ **YouTube Writer**  `/youtube-writer`  · ícono `escribir`  
  Escribir el guion de un video de YouTube. ComingSoon sin backend.  
  <sub>app/youtube-writer/page.tsx (ComingSoon) · app/_components/nav.ts (grupo 'yt-formatos')</sub>
- ⚪ **Thumbnails**  `/thumbnails`  · ícono `thumbnail`  
  Generar las miniaturas del video. ComingSoon sin backend.  
  <sub>app/thumbnails/page.tsx (ComingSoon) · app/_components/nav.ts (grupo 'yt-formatos')</sub>

## MaKo  ·  26 piezas

### MaKo Doer

- 🟢 **MaKo Doer** **A**  · ícono `agente`  
  El agente que ESCUCHA en los grupos de WhatsApp y actúa: decide si contesta (modo libre vs. ventana), muestra «escribiendo…», elige el tier del modelo por turno y corre el loop de tools. NO es el chat dentro de la app (eso es «Preguntale a MaKo»).  
  <sub>lib/mako-doer-in.ts · lib/mako-router.ts · app/api/webhooks/evolution/route.ts · app/api/admin/mako-doer/route.ts</sub>
- 🟢 **Doer Message Buffer**  · ícono `chats`  
  El lote: encolar → reclamar el candado del grupo → esperar el silencio (8s texto / 20s audio, tope 90s) y contestar UNA vez. Es lo que impide que 16 mensajes en 4 segundos disparen 16 corridas.  
  <sub>lib/mako-doer-buffer.ts · app/api/cron/doer-flush/route.ts</sub>
- 🟢 **Doer Conversation Memory**  · ícono `contexto`  
  El historial por grupo que se re-inyecta en cada respuesta (mig 0086), con corte a 48 horas para que un «sí, dale» no se pegue a una charla de hace días.  
  <sub>lib/mako-doer-conv.ts</sub>
- 🟢 **Doer Read Tools**  · ícono `search`  
  El registro de herramientas de LECTURA del doer (leads, WhatsApp, reuniones, conocimiento, experimentos, tareas), todas por getTenantDb. Solo consulta: no manda ni escribe nada.  
  <sub>lib/mako-tools.ts</sub>
- 🟢 **Doer Write Actions**  · ícono `check`  
  El catálogo de ESCRITURAS: cada tool `proponer_*` no ejecuta, propone — mover etapa, activar secuencia, escribir en Meta, crear tareas y borradores del plan. La escritura real solo corre tras `confirmar_accion`.  
  <sub>lib/mako-doer-acciones.ts</sub>
- 🟢 **Pending Actions**  · ícono `dot`  
  El libro de acciones pendientes con vencimiento (mig 0085): crear, matchear el «sí» con la más reciente vigente, ejecutar, vencer sola. Es lo que evita que un OK viejo dispare algo por accidente.  
  <sub>lib/mako-pendientes.ts</sub>
- 🟢 **Voice Notes & Files**  · ícono `mic`  
  Lo que entra por WhatsApp que no es texto: notas de voz (se transcriben antes de razonar) y archivos adjuntos, leídos con el MISMO lector del importador del tablero.  
  <sub>lib/ai-cheap.ts · lib/archivo-a-texto.ts · lib/formatos-archivo.ts · lib/evolution-media.ts</sub>

### MaKo on WhatsApp

- 🟢 **WhatsApp de MaKo**  `/agencia`  · ícono `whatsapp`  
  La tab del canal PROPIO de la agencia: la línea de MaKo por QR, sus grupos y sus plantillas. No es preview de ningún cliente ni el /whatsapp del producto.  
  <sub>app/agencia/page.tsx · app/agencia/AgenciaTabs.tsx</sub>
- 🟢 **Groups Chat**  `/agencia`  · ícono `chats`  
  La sub-tab «Chat» de /agencia: SOLO los grupos de la instancia de la voz de MaKo (SuperAdmin, «MaKo <> cliente», prueba), con hilo real, media, composer y borrador por grupo.  
  <sub>app/agencia/ChatGruposPanel.tsx · app/whatsapp/_shared/ChatHilo.tsx · lib/mako-chat.ts · app/api/admin/mako-chats/route.ts</sub>
- 🟢 **Group Detail**  `/agencia`  · ícono `perfil`  
  El detalle de un grupo, al estilo WhatsApp: editar foto, nombre, descripción y participantes. Se abre desde la topbar del chat y cubre todo el hilo.  
  <sub>app/agencia/GrupoDetalleModal.tsx · app/api/admin/mako-chats/grupo/route.ts</sub>
- 🟢 **Templates**  `/agencia`  · ícono `notepencil`  
  La sub-tab «Plantillas»: las ~48 cosas que MaKo le puede decir al dueño (reportes, avisos, acciones, preguntas), listadas como chat con la preview que se escribe sola. CRUD sobre catálogo + custom.  
  <sub>app/agencia/PlantillasView.tsx · lib/avisos-catalogo.ts · app/api/admin/plantillas/route.ts</sub>
- 🟢 **Template Detail**  `/agencia`  · ícono `escribir`  
  El detalle de una plantilla: editar el texto y el ejemplo, activar/desactivar y probar cómo la redacta la IA. Cubre todo el chat.  
  <sub>app/agencia/TemplateDetalleModal.tsx</sub>
- 🟡 **Flow Editor**  `/agencia`  · ícono `funnel`  
  El flujo de una plantilla: CUÁNDO dispara (evento / manual) y QUÉ pasos ejecuta (mensaje / acción / esperar), reordenables. Se edita y se guarda, pero no hay motor que lo corra en producción.  
  <sub>app/agencia/FlujoEditor.tsx · lib/flujos-tipos.ts</sub>
- 🟢 **MaKo Channel**  `/agencia`  · ícono `plug`  
  Conectar/desconectar la línea propia por QR (instancia Evolution `mako_superadmin`). Lo que se conecta acá pasa a ser la voz de MaKo automáticamente. Vive como desplegable en la barra de tabs, visible en las dos sub-tabs.  
  <sub>app/agencia/CanalMaKoPanel.tsx · lib/mako-canal.ts · app/api/admin/mako-canal/route.ts</sub>
- 🟢 **MaKo Groups**  · ícono `whatsapp`  
  El grupo «MaKo <> {cliente}» por workspace y el grupo SuperAdmin: crearlos, guardar su JID y resolver desde qué instancia habla MaKo (la voz). Es el destino de todo aviso.  
  <sub>lib/mako-grupo.ts · app/api/admin/mako-grupo/route.ts</sub>
- 🟢 **Plan Draft Review**  `/plan/revisar/[id]`  · ícono `todo`  
  El puente WhatsApp → plan: MaKo manda un link en vez de preguntar por chat, y acá el dueño (o el cliente) contesta el borrador de a una pregunta, revisa las bajas sugeridas y confirma. Las respuestas viajan como contexto al Perro.  
  <sub>app/plan/revisar/[id]/page.tsx · app/plan/revisar/[id]/RevisarPropuesta.tsx · app/plan/revisar/[id]/ContextoDelBorrador.tsx · lib/plan-propuesta.ts</sub>

### MaKo Brain

- 🟡 **MaKo Doer Chat**  `/mako-doer`  · ícono `agente`  
  La misma pantalla de chat apuntada a /api/mako-doer, o sea con tool-use de lectura. Existe como ruta pero SALIÓ de la barra: para el usuario eran dos tabs que hacen lo mismo.  
  <sub>app/mako-doer/page.tsx · app/mako-doer/MakoDoerTab.tsx · app/api/mako-doer/route.ts</sub>
- 🟢 **Contexto de MaKo**  `/contexto`  · ícono `contexto`  
  La tab donde la agencia le carga el cerebro a MaKo: Conocimiento (RAG), Fases y Prompts. No es configuración de tu cuenta.  
  <sub>app/contexto/page.tsx · app/contexto/ContextoTabs.tsx</sub>
- 🟢 **Modelos IA**  `/modelos-ia`  · ícono `mako`  
  Qué modelo/IA corre cada tarea de la app, con la recomendación del audit y el override que re-rutea las llamadas de verdad en runtime. Es el control de COSTO, no la infraestructura.  
  <sub>app/modelos-ia/page.tsx · app/modelos-ia/ModelosIA.tsx · lib/model-registry.ts · app/api/admin/modelos/route.ts</sub>
- 🟢 **Preguntale a MaKo** **A**  `/mako`  · ícono `mako`  
  El agente conversacional dentro de la app: chat general + la lista de TODAS las conversaciones (una por gráfico). Es capacidad global, no una tab más. NO es el chat por WhatsApp (eso es MaKo Doer).  
  <sub>app/mako/page.tsx · app/mako/MakoTab.tsx · app/api/mako/route.ts</sub>
- 🟢 **MaKo Chat**  · ícono `chats`  
  El widget de conversación que reusan /mako, /mako-doer y el chat de cada gráfico: sesiones, markdown, sugerencias y el endpoint como parámetro.  
  <sub>app/_components/MakoChat.tsx · app/_components/MakoBrand.tsx</sub>
- 🟢 **Knowledge (RAG)**  `/contexto`  · ícono `cerebro`  
  La sub-tab de metodología indexada: CRUD de entradas + estado de indexado, y la búsqueda semántica top-k por coseno que se le inyecta a cada respuesta. Multi-tenant: el método curado del dueño se sirve read-only a todos.  
  <sub>lib/mako-knowledge.ts · lib/mako-knowledge-seed.ts · lib/embeddings.ts · app/api/mako/knowledge/route.ts</sub>
- 🟢 **Fases**  `/contexto`  · ícono `funnel`  
  La sub-tab que define cómo cambia la instrucción de MaKo según la fase del negocio (1-5): qué prioriza y qué ignora en cada una.  
  <sub>lib/mako-fases.ts · lib/fase-store.ts · lib/fase-diagnostico.ts</sub>
- 🟢 **Prompts**  `/contexto`  · ícono `escribir`  
  La sub-tab de los módulos editables y versionados (persona/voz + modos del consultor), con historial y restaurar. El NÚCLEO de reglas duras vive en código y no se edita desde acá.  
  <sub>lib/mako-prompts.ts · lib/mako-persona.ts · lib/prompt-registry.ts · lib/prompt-defaults.ts</sub>
- 🟢 **Context Builder**  · ícono `contexto`  
  Lo que ARMA el system prompt en cada llamada: persona + núcleo + perfil del negocio + fase + instrucción de la sección + RAG + datos del gráfico. Cada pieza es opcional; si falla, se omite.  
  <sub>lib/mako-context.ts · lib/etapas-contexto.ts</sub>
- 🟢 **MaKo Capabilities**  · ícono `tools`  
  La lista CERRADA de qué se puede hacer adentro de MaKo y en qué tab: la usa el Perro para decir «esto lo resolvés acá» y darte el botón, en vez de mandarte a resolverlo afuera.  
  <sub>lib/mako-capacidades.ts</sub>

## Admin & Platform  ·  33 piezas

### Creative Factory

- 🟢 **Avatars**  `/onboarding`  · ícono `perfil`  
  El «¿a quién?» de la fábrica: 3 avatares SEGMENTABLES EN META (rubro, tamaño, ubicación), no retratos psicológicos. MaKo hace preguntas cerradas de segmentación antes de proponerlos. Es el eje vertical de la Matriz.  
  <sub>app/onboarding/AvataresView.tsx · lib/avatares.ts · app/api/onboarding/avatares/</sub>
- 🟢 **Buying Reasons**  `/onboarding`  · ícono `cerebro`  
  El «¿por qué compra?»: las motivaciones distintas por las que el MISMO avatar compra (el curso de inglés: mejor salario, un viaje, un ascenso). No son hooks ni dolor/deseo. Es el eje horizontal de la Matriz — mismo dato que ella, otra vista.  
  <sub>app/onboarding/RazonesView.tsx · lib/razones.ts · app/api/onboarding/razones/route.ts</sub>
- 🟢 **Brand Persona**  `/onboarding`  · ícono `eye`  
  La cara de la marca: 5 o más fotos del vocero más una descripción de apariencia, estilo y tono, para que la IA genere después las imágenes de los creativos con esa persona.  
  <sub>app/onboarding/PersonaView.tsx · lib/persona.ts · app/api/onboarding/persona/</sub>
- 🟢 **Lead Magnet**  `/onboarding`  · ícono `leadmagnet`  
  El elemento TANGIBLE de la oferta (ex «El Gancho», hoy «Entregable»): MaKo pregunta de a una, adaptando la siguiente pregunta, y propone 1-3 entregables con su línea de FOMO. Es lo que el New Sequence Wizard ofrece entregar en el paso ③.  
  <sub>app/onboarding/EntregableView.tsx · lib/entregable.ts · app/api/onboarding/entregable/</sub>
- 🟢 **Creative Formats**  `/onboarding`  · ícono `creativos`  
  La tab que en la UI se llama «Ángulos» pero son los FORMATOS de creativo (cómo se VE: comparación, testimonio con capturas, demo). Biblioteca fija que el cliente no edita; MaKo recomienda de ahí y justifica. Es lo que eligen las tabs Imagen y Video del Ad Detail.  
  <sub>app/onboarding/FormatosView.tsx · lib/angulos-formatos.ts · lib/angulos-data.ts · app/api/onboarding/formatos/</sub>
- 🟢 **Brand Voice**  `/onboarding`  · ícono `sonido`  
  El quiz de Personalidad: pares de frases reales de anuncio, eliges la que dirías vos y MaKo deduce tu voz. Reemplazó al selector de adjetivos porque «a un argentino le escribía de tú»; entra al prompt de todo guion.  
  <sub>app/onboarding/PersonalidadView.tsx · lib/personalidad.ts · lib/personalidad-store.ts · app/api/onboarding/personalidad/</sub>

### Alerts & Reports

- 🟢 **Alerts Engine**  · ícono `bell`  
  El choke point único «evento → aviso al dueño»: escribe el feed in-app y manda al grupo de WhatsApp que corresponda, con dedup temporal para que el cron horario no repita la misma alerta cada hora.  
  <sub>lib/avisos.ts · lib/notificaciones.ts</sub>
- 🟢 **Alerts Catalog**  · ícono `notepencil`  
  La biblioteca de VOZ: las ~48 entradas (reporte / aviso / acción / pregunta) con su ejemplo, su semáforo y su prioridad. Data pura, sin server-only, para poder demostrarla desde la app.  
  <sub>lib/avisos-catalogo.ts · app/api/admin/avisos-demo/route.ts</sub>
- 🟢 **Reports**  · ícono `graphics`  
  El texto de los reportes horario, diario y semanal: cada sección en su try/catch para que una fuente caída no tumbe el cron. Salen por WhatsApp y por email.  
  <sub>lib/reportes.ts · lib/reporte-template.ts · app/api/cron/reporte-horario/route.ts · app/api/cron/reporte-diario/route.ts</sub>
- 🟢 **Notifications**  · ícono `bell`  
  La campanita in-app: el feed de notificaciones que escribe el motor de avisos, con su severidad y su lectura. Las preferencias por canal se eligen en Configuraciones → Notificaciones.  
  <sub>lib/notificaciones.ts · app/_components/NotificationsProvider.tsx · app/api/notificaciones/route.ts</sub>

### Admin

- 🟢 **Clientes**  `/admin`  · ícono `admin`  
  El panel de la agencia: alta de cliente (workspace + su usuario admin de una), estado, capa contratada, y cada fila se expande con el equipo del cliente para ver y revocar.  
  <sub>app/admin/page.tsx · app/admin/AdminView.tsx · app/api/admin/workspaces/route.ts · lib/capas.ts</sub>
- 🟢 **Conocimientos**  `/conocimientos`  · ícono `contexto`  
  El portal de formación interna (curso AVATARHYPE y hermanos): hub multi-curso con navegación por URL, capa oscura autocontenida. Es fuente de RAG, no el /conocimiento del RAG.  
  <sub>app/conocimientos/page.tsx · app/conocimientos/Conocimientos.tsx · app/conocimientos/curso.ts · app/conocimientos/curso-vsl.ts</sub>
- 🟢 **Conocimiento**  `/conocimiento`  · ícono `cerebro`  
  El conocimiento de MaKo organizado por CURSOS: importar un curso curado con un click, agregar texto a mano, o subir un video/audio que se transcribe y se revisa antes de guardar. Escribe sobre la misma tabla que el RAG.  
  <sub>app/conocimiento/page.tsx · app/conocimiento/ConocimientoView.tsx · lib/mako-knowledge.ts</sub>
- ⚪ **Partners & Referrals**  · ícono `sales`  
  El programa de referidos y partners: comisiones, contrato, incentivos y su seguimiento. No existe ninguna pantalla ni tabla; hoy solo hay tareas en el board bajo «Vender MaKo: Referidos».  
  <sub>lib/plan-proyectos-catalogo.ts · scripts/reordenar-plan-superadmin.ts</sub>
- 🟢 **Super Admins**  `/admin`  · ícono `perfil`  
  La segunda tab de /admin: los admins de la APP (rol global 'admin'), alta por email y baja. No pertenecen a ningún cliente. Los guards duros (no quedarse sin super admin) viven en el API.  
  <sub>app/admin/AdminView.tsx · app/api/admin/usuarios/route.ts · lib/usuarios.ts</sub>
- 🟢 **Impersonation**  · ícono `eye`  
  «Entrar como» un cliente: la sesión firmada, el workspace por PESTAÑA (?ws=) validado solo en proxy.ts, y el header interno que se borra en cada request. Es lo que hace que el admin abra varios clientes a la vez sin cruzarlos.  
  <sub>app/api/admin/impersonate/route.ts · lib/ws-tab.ts · lib/workspace.ts · proxy.ts</sub>
- 🟢 **Course Portal**  `/conocimientos`  · ícono `video`  
  El hub de un curso y el detalle de clase / de recurso. Vive aparte porque lo comparte con /compartido/<token>: el invitado ve exactamente esta pantalla, no un resumen.  
  <sub>app/conocimientos/CursoPortal.tsx · app/conocimientos/Compartir.tsx · app/compartido/ · app/api/compartir/route.ts</sub>
- ⚪ **User Behavior Alerts**  · ícono `spy`  
  Que la agencia se entere de cómo usan la app sus clientes: quién no entra hace días, quién se trabó en el onboarding, qué tab nadie abre — y que MaKo avise. Hoy no hay eventos de producto ni detección; el motor de avisos ya existiría para despacharlo.  
  <sub>lib/avisos.ts · lib/avisos-catalogo.ts · app/admin/AdminView.tsx</sub>

### Dev

- 🟢 **Documentación**  `/admin/docs`  · ícono `contexto`  
  AGENTS.md y docs/*.md renderizados DESDE el repo (sin copia propia), agrupados, con buscador y la ficha de git de cada documento. Todo el estado vive en la URL.  
  <sub>app/admin/docs/page.tsx · app/admin/docs/DocsView.tsx · app/admin/docs/catalogo.ts · app/admin/docs/git-meta.ts</sub>
- 🟢 **MaKo UX/UI**  `/admin/ui`  · ícono `config`  
  El sistema de diseño renderizado de verdad, en ocho sub-tabs: Roadmap, Sidebar, Íconos, Marca, Fundamentos, Piezas, Estados y Gramática de MaKo. /admin/rediseno redirige acá.  
  <sub>app/admin/ui/page.tsx · app/admin/ui/CatalogoUI.tsx · app/admin/ui/Barra.tsx · app/admin/ui/Gramatica.tsx</sub>
- 🟢 **Grafo**  `/api/admin/graph`  · ícono `graphics`  
  El grafo de dependencias del repo entero, servido como HTML directo en pestaña nueva. Mira todo el código, no un área.  
  <sub>app/api/admin/graph/route.ts · app/api/admin/graph/graph.html</sub>
- 🟡 **Dev Registry**  `/admin/dev/[area]`  · ícono `hammer`  
  El molde de todo registro por área: Roadmap arriba, Change History plegado abajo, con el contenido en el bitacora.ts de cada una. Hoy hay 6 áreas y el pedido es tener TODAS las piezas del producto.  
  <sub>app/admin/dev/areas.ts · app/admin/dev/registros.ts · app/admin/dev/paneles.tsx · app/admin/dev/[area]/page.tsx</sub>

### Account

- 🟢 **Perfil**  `/perfil`  · ícono `perfil`  
  Los datos de quien sos: nombre, contacto, cargo, zona horaria y la foto (Supabase Storage). Las preferencias de notificaciones ya NO viven acá.  
  <sub>app/perfil/page.tsx · app/perfil/PerfilTabs.tsx · app/api/perfil/route.ts · lib/perfil.ts</sub>
- 🟢 **Configuraciones**  `/configuraciones`  · ícono `config`  
  El contenedor de la configuración del workspace: una sola fila de tabs con Notificaciones, Identidades fiscales y Equipo cargando en el lugar, más el link a Método.  
  <sub>app/configuraciones/page.tsx · app/configuraciones/ConfigInnerTabs.tsx · app/configuraciones/Configuraciones.tsx</sub>
- 🟢 **Integraciones**  `/integraciones`  · ícono `integraciones`  
  El estado de los servicios conectados (medidor de salud, «Requiere tu atención», servicios por categoría), el Costo de MaKo por proveedor y proceso, y el historial de problemas de Meta.  
  <sub>app/integraciones/page.tsx · app/integraciones/IntegracionesBoard.tsx · app/integraciones/ServicioConfigForm.tsx · app/integraciones/ProbarTracking.tsx</sub>
- 🟢 **Método**  `/metodo`  · ícono `tools`  
  La conexión guiada de integraciones, un servicio por pantalla: el tutorial para conseguir cada token, probar la conexión y guardarla. El catálogo de campos vive en lib/metodo-catalogo.ts.  
  <sub>app/metodo/page.tsx · app/metodo/MetodoWizard.tsx · lib/metodo-catalogo.ts · app/api/metodo/route.ts</sub>
- 🟢 **Login**  `/login`  · ícono `logout`  
  Google SSO y nada más, como overlay full-screen. Con la sesión ya abierta no muestra el formulario: te dice quién sos y te lleva a /inicio.  
  <sub>app/login/page.tsx · app/login/LoginForm.tsx · app/login/YaLogueado.tsx · lib/auth.ts</sub>
- ⚪ **Reportar problema**  `/tickets`  · ícono `soporte`  
  Hoy es un ComingSoon a propósito: no hay tabla de tickets ni destino al que mandarlos. El nombre es la acción, no el objeto del sistema.  
  <sub>app/tickets/page.tsx · app/_components/ComingSoon.tsx</sub>
- ⚪ **Tickets Portal**  · ícono `soporte`  
  El backend y el portal de lo anterior: tickets con estado, votación de features y triaje automático. Sale del proyecto del plan «Feature: Feedback y errores», que hoy no tiene ni una línea de código.  
  <sub>lib/plan-proyectos-catalogo.ts · app/tickets/page.tsx</sub>
- 🟢 **Notificaciones**  `/configuraciones`  · ícono `bell`  
  Qué te avisa MaKo y por dónde: los canales (WhatsApp / email / Telegram), los reportes que querés recibir y los destinatarios.  
  <sub>app/perfil/NotificacionesPanel.tsx · app/perfil/DestinatariosModal.tsx · lib/perfil.ts</sub>
- 🟢 **Identidades fiscales**  `/configuraciones`  · ícono `tag`  
  Las identidades con las que se factura: datos fiscales del workspace, usados por los contratos y los recibos.  
  <sub>app/configuraciones/IdentidadesFiscalesPanel.tsx</sub>
- 🟢 **Equipo**  `/equipo`  · ícono `crm`  
  El equipo del cliente: invitar por email (la cuenta se activa sola al entrar con Google), asignar rol_ws (admin / closer / setter), suspender. Se renderiza embebido en Configuraciones y también tiene ruta propia.  
  <sub>app/equipo/page.tsx · app/equipo/EquipoView.tsx · app/api/equipo/route.ts · lib/tab-access.ts</sub>
- 🟢 **Inicio**  `/inicio`  · ícono `general`  
  El repartidor por rol: admin sin impersonar → /admin, closer/setter → /crm, admin-cliente con onboarding pendiente → el wizard, el resto → /general. No pinta nada, solo redirige.  
  <sub>app/inicio/page.tsx · lib/onboarding-state.ts · lib/workspace.ts</sub>
