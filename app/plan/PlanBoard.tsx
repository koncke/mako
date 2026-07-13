'use client';

// =============================================================================
// PlanBoard — adapter del board /todo para el super-admin (localStorage)
// =============================================================================
// Toda la UI vive en board/BoardShell (compartida con el cliente). Acá solo:
// el SEED (fuente de verdad del backlog), la carga/persistencia en localStorage,
// y el Repo que implementa create/save/delete sobre el array local.

import { useEffect, useState } from 'react';
import { BoardShell } from './board/BoardShell';
import { useBoard } from './board/useBoard';
import { type BoardTask, type Label, type Repo, type BoardUser, type Prio, type Hist, scoreFromPrio, prioFromScore, clampScore, spreadProjScores } from './board/types';

const K5 = 'mako_plan_v5', K4 = 'mako_plan_v4', K_PROJS = 'mako_plan_projs_v3';
const SEED_TS = Date.parse('2026-07-01T12:00:00Z');
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

const P = (id: string, emoji: string, name: string, color: string, score: number, detalle: string, scoreRazon: string): Label => ({ id, emoji, name, color, score, scoreRazon, detalle, historial: [{ id: 'seedp' + id, ts: SEED_TS, actor: 'ia', text: 'Creó el proyecto' }] });

// ── Descripciones de los proyectos, escritas a mano y con formato (HTML) ──────────
const D_DOER = '<b>Que MaKo deje de ser un dashboard pasivo y pase a ser DOER.</b> No solo te muestra datos: te dice <b>qué hacer hoy</b>, te reclama lo que no hiciste y <u>cierra el loop</u>.<div><br></div>Junta las piezas que hoy están sueltas:<div>• la <b>Retro real</b> — detecta fugas y patrones con la metodología Recon;</div><div>• el <b>pulso diario</b> — una vista "Hoy" que avisa por campanita y WhatsApp;</div><div>• la <b>rendición de cuentas</b> — verifica lo que ejecutaste contra lo que prometiste;</div><div>• el <b>semáforo vivo</b> con alertas de IA;</div><div>• el <b>CRM automático</b> que mueve leads solos.</div><div><br></div>Es la capa que convierte todo lo que ya existe en <u>algo que mueve la aguja sin que se lo pidas</u>.';
const D_PLAT = '<b>La base técnica que sostiene el producto entero.</b> Cuentas y perfiles, el <b>CRM y la ficha del lead</b> (7 tabs), el panel de equipo con roles, el aislamiento <b>multi-tenant</b> por workspace, la capa de <b>ciberseguridad</b> (auditorías + fixes) y el <b>Ads Manager</b> con escritura a Meta y USD.<div><br></div>Casi todo está hecho y en producción; lo que queda es <u>endurecer, depurar y proteger</u> sin interrumpir a los usuarios (protocolo de beta, performance, traspaso de cuentas).';
const D_CANALES = '<b>Todos los caminos por los que MaKo le habla al lead y al cliente.</b> Email transaccional y de nutrición (Resend), <b>WhatsApp</b> oficial (Meta) y no oficial (Evolution), el motor de <b>nutrición automática</b> con reglas anti-baneo, los reportes por WhatsApp/email y la importación/exportación de leads.<div><br></div>Los motores <u>están construidos</u>; lo pendiente es el <b>go-live real</b> (dominios, secrets, templates aprobados) y que los crons iteren todos los workspaces, no solo el del dueño.';
const D_ANALY = '<b>El cerebro analítico y creativo de MaKo.</b> Los <b>analistas</b> que leen una fuente y devuelven decisiones (Landing, VSL, CS/churn, Market/competencia, Offer) y los <b>generadores</b> que producen copy y creativos (Ads Writer, generador de creativos y de landings, cursos en Conocimiento/RAG).<div><br></div>Multiplican el criterio de MaKo y le dan escala, pero la mayoría todavía son <u>stubs "coming soon"</u>: altísimo valor a futuro, poco entregado hoy.';
const D_GROWTH = '<b>Vender MaKo hacia afuera.</b> La oferta por planes (Cebolla), los <b>ads por cada funcionalidad</b>, la landing de venta (/vsl), los testimonios, las thank-you pages, los demos por feature y el mapa de calor de uso.<div><br></div>Es <u>marketing del producto, no producto</u>. Importa para crecer, pero recién cuando el producto esté DOER de verdad: <b>vender algo a medio hacer quema pólvora</b> y reputación.';
const D_UX = '<b>La experiencia: que MaKo se entienda de un vistazo y no abrume.</b> El rediseño completo de la app, el <b>Modo Simple por default</b> (3 tareas + experimentos, con el kanban movido a Avanzado) y el administrador de eventos.<div><br></div>Es <u>transversal y continuo</u>: acompaña a todo el resto en lugar de competir por el primer lugar.';
const PROJS_DEFAULT: Label[] = [
  P('doer', '🔴', 'Hacer MaKo DOER', '#D0504A', 10, D_DOER,
    'Es el norte de todo ahora: sin la capa DOER, MaKo es un dashboard más. Todo lo demás sostiene esto o espera.'),
  P('plat', '🧱', 'Plataforma & Núcleo', '#2F6FED', 8, D_PLAT,
    'Es el piso: si la base falla, no hay DOER ni canales que valgan. Alto, pero ya bastante maduro.'),
  P('canales', '💬', 'Canales & Mensajería', '#7C5CFB', 6, D_CANALES,
    'Es el brazo ejecutor del DOER, pero está a un paso del go-live: mueve la aguja cuando se enciende, no antes.'),
  P('analy', '🔍', 'Analysts & Generadores', '#0E9B8E', 5, D_ANALY,
    'Multiplican el criterio de MaKo, pero la mayoría son stubs: valor alto a futuro, todavía no hoy.'),
  P('growth', '📈', 'Growth · Vender MaKo', '#C8870C', 4, D_GROWTH,
    'Importa para crecer, pero primero el producto tiene que estar DOER: vender algo a medio hacer quema pólvora.'),
  P('ux', '✨', 'UX & Diseño', '#D6489B', 3, D_UX,
    'Hace todo usable, pero es transversal y continuo: acompaña al resto, no compite por el primer lugar.'),
];
// Detalles con formato (HTML) — el usuario los pidió "bonitos" y con negritas.
const SEED_DETALLE: Record<string, string> = { doer: D_DOER, plat: D_PLAT, canales: D_CANALES, analy: D_ANALY, growth: D_GROWTH, ux: D_UX };
// Razonamiento del perro por proyecto, para BACKFILL de localStorage viejo (que no
// tiene scoreRazon) sin pisar nada de lo que el usuario haya editado.
const SEED_RAZON: Record<string, string> = Object.fromEntries(PROJS_DEFAULT.map((p) => [p.id, p.scoreRazon ?? '']));

// [num, title, project, prioridad, prog, detalle, enPrioridad]
type Row = [number, string, string, Prio, number, string, boolean];
const SEED: Row[] = [
  [42, 'Retro & Planning: la tab-cerebro', 'doer', 'alta', 100, 'Base hecha. Casa del programa DOER: reportes + plan, ligada a Experiments.', false],
  [55, 'Catálogo de fugas: que Retro detecte los patrones', 'doer', 'alta', 0, 'Catálogo (la IA juzga): escalar no-ganadores, gasto↑/resultados↓, poca variedad, huecos del funnel, escalado incorrecto, muchos cambios, cobranza recurrente. Metodología Recon (2 señales). Spec: docs/superpowers/specs/2026-07-10-retro-doer-accountability-design.md', true],
  [56, 'Rendición de cuentas: verificar ejecución + reclamo', 'doer', 'alta', 0, 'MaKo joinea experimento_tareas por retro_id, distingue aceptado-vs-HECHO, reclama. Spec S1 · Sección 2.', true],
  [54, 'El pulso: que la app te diga QUÉ HACER (vista Hoy)', 'doer', 'alta', 0, 'Chequeo diario barato que reclama/avisa por campanita+WhatsApp y surfacea en el semáforo. Spec S1 · Sección 3.', true],
  [53, 'Modo Simple por default + Avanzado', 'doer', 'alta', 0, 'Default SIMPLE (3 tareas + experimentos). El kanban va a Avanzado.', false],
  [4, 'Onboarding progresivo por tab (SIMPLE)', 'doer', 'alta', 55, 'Onboarding inicial: lo básico (Meta) + veredicto con Experiments. Después MaKo te manda a la tab cuando detecta una fuga. Base hecha; falta el modelo progresivo.', false],
  [57, 'Atribución de cash por anuncio', 'doer', 'alta', 0, 'meta_ad_id × pagos, granular. Hoy solo ROAS agregado. Combustible del cerebro.', false],
  [58, 'Minería de objeciones (closing_analyses)', 'doer', 'media', 0, 'Objeciones recurrentes que matan cierres. La data ya se guarda.', false],
  [59, 'Semáforo vivo (alertas con IA)', 'doer', 'media', 0, 'Junta señales + tendencia + Claude razona alertas nuevas. Donde surfacea el pulso.', false],
  [18, 'MaKo embebido en todas las tabs', 'doer', 'media', 30, 'WhatsApp ya tiene MaKo. Falta funnel, leads, experimentos, email, closing.', false],
  [14, 'CRM Automático (leads que avanzan solos)', 'doer', 'alta', 40, 'Motor T1-T6 hecho pero APAGADO. Backlog: esquema de cuándo mover un lead, pop-up de confirmación, Datos sin Marcar auto-completados, etapa Reactivación. Terminar Onboarding + FUNNEL.', false],

  [3, 'Perfil de Usuario', 'plat', 'alta', 100, 'Hecho: /perfil.', false],
  [5, 'Usuarios + vista de Admin', 'plat', 'alta', 100, 'Hecho: /admin.', false],
  [6, 'Método: tokens + tutorial', 'plat', 'alta', 100, 'Hecho: /metodo.', false],
  [28, 'Panel de Equipo (Closers/Setters)', 'plat', 'media', 100, 'Hecho: /equipo.', false],
  [2, 'Ficha del lead (CRM)', 'plat', 'alta', 100, 'Hecho: 7 tabs. La tab Chat es solo lectura.', false],
  [12, 'Ads Manager: crear/editar campañas + USD', 'plat', 'media', 100, 'Hecho (12+40+50). Todo en PAUSA. CREATE de Meta no probado en vivo.', false],
  [33, "API 'Analizar' de Meta", 'plat', 'baja', 100, 'Código completo. Recos nativas vacías por bloqueo de pago, no del código.', false],
  [7, 'Ciberseguridad + eficiencia', 'plat', 'alta', 80, 'Auditoría hecha, HIGH+MEDIUM fixeados. Falta performance (LOW) + depurar (continuo).', false],
  [30, 'Protocolo de Beta y versiones', 'plat', 'media', 0, 'Mejorar sin interrumpir a los usuarios.', false],
  [52, 'Usar SKILLS en todo el código', 'plat', 'baja', 25, 'Instaladas brainstorming/plans/grill/decision-maker + repo. Falta aplicarlas.', false],
  [17, 'Traspaso de cuentas Mauricio → mías', 'plat', 'baja', 0, 'Supabase/Vercel/dominio. No prioridad.', false],
  [32, 'Dominio propio + ruteo', 'plat', 'baja', 0, 'Landing en la raíz, no en /vsl.', false],

  [8, 'Email Marketing (Resend)', 'canales', 'media', 90, 'Código completo. Falta go-live: dominio + RESEND_WEBHOOK_SECRET.', false],
  [9, 'Nutrición Automática', 'canales', 'media', 70, 'Motor completo (3 canales, anti-baneo), APAGADO. Falta go-live: flags + dominio + templates WA.', false],
  [20, 'Reportes por WhatsApp', 'canales', 'media', 90, 'Hecho para el dueño. Falta que los crons iteren workspaces.', false],
  [41, 'WhatsApp + Email NO oficial dentro de MaKo', 'canales', 'media', 30, 'Evolution existe. Falta que ambos vivan cómodos en MaKo.', false],
  [43, "Responder 'Datos sin Marcar' desde WhatsApp", 'canales', 'media', 0, '', false],
  [51, 'Listas de Difusión', 'canales', 'media', 0, '', false],
  [19, 'Importar/exportar leads (→ nutrición)', 'canales', 'media', 0, 'No existe bulk. Falta parser + mapeo + enrolar en nutrición.', false],
  [16, 'Calendly + back-end multi-tenant', 'canales', 'futuro', 60, 'UTM/UUID ok. Falta config multi-tenant (hoy hardcoded a Mauricio).', false],
  [21, 'Reportes a leads/clientes post-reunión', 'canales', 'futuro', 0, '', false],

  [24, 'Landing Analyst', 'analy', 'futuro', 0, 'PostHog/Clarity: session replay + heatmaps. Stub comingSoon.', false],
  [25, 'VSL Analyst', 'analy', 'futuro', 0, 'Telemetría VSL ya existe; el analista no. Stub.', false],
  [13, 'CS Analyst (Customer Success)', 'analy', 'futuro', 0, 'Closing ya distingue servicio; falta analista de churn. Stub.', false],
  [34, 'Market Analyst (competencia)', 'analy', 'futuro', 0, 'Proceso recurrente + aviso por WhatsApp cuando un competidor saca algo. Stub.', false],
  [39, 'Offer Analyst', 'analy', 'futuro', 0, 'Que audite/mejore la oferta en el onboarding, no solo la guarde.', false],
  [26, 'Ads Writer / GhostWriter', 'analy', 'baja', 100, 'Cubierto por Ads Writer (lib/ad-copy.ts).', false],
  [29, 'Generador de creativos (masa)', 'analy', 'futuro', 0, 'Estilo Claudio Conde.', false],
  [49, 'Generador de Landing Pages', 'analy', 'futuro', 0, '', false],
  [47, 'Generador de Contratos', 'analy', 'baja', 0, '', false],
  [31, 'Cursos en Conocimiento (RAG)', 'analy', 'baja', 80, 'Pipeline funcional. Solo Levanta Muertos pre-seedeado.', false],

  [46, 'Oferta Cebolla (planes por nivel)', 'growth', 'futuro', 0, 'Venderle a TODO el que corra VSL Funnel limitando acceso por planes según la situación del lead.', false],
  [45, 'Ads por cada funcionalidad', 'growth', 'futuro', 0, 'Claudio Conde 60k con 1 feature. Miles de ads por cada feature.', false],
  [1, 'Copy de features en la landing (/vsl)', 'growth', 'futuro', 0, 'Marketing, no feature. Cuando vuelva a Baires.', false],
  [22, 'Thank You Page (post-agenda)', 'growth', 'futuro', 0, 'Página que fuerza instrucciones o se cancela la llamada (estilo confirmar.lovable.app).', false],
  [15, 'Testimonios', 'growth', 'futuro', 0, '', false],
  [27, 'Costos internos + cliente', 'growth', 'futuro', 0, 'Cuando vuelva a Baires.', false],
  [23, 'Loom demo por feature', 'growth', 'futuro', 0, '', false],
  [35, 'Mapa de calor de uso', 'growth', 'futuro', 0, '', false],

  [36, 'Rediseño completo de la app', 'ux', 'alta', 70, 'Falta: Script/Closing Analyst + Experiments + Perfil + Onboarding.', false],
  [37, 'UX SIMPLE (la experiencia)', 'ux', 'alta', 60, 'El norte de UX. Falta: Closing/Script Analyst + Funnel + Onboarding.', false],
  [44, 'Administrador de Eventos', 'ux', 'baja', 0, '', false],

  // ── Roadmap minado de la memoria (F/G/skills/WhatsApp/seguimiento) — jul-2026 ──
  [60, "MaKo con números vivos (funnel + snapshot)", "doer", "alta", 25, "snapshotFunnelTexto() existe pero no está enchufado y buildSystemPrompt() de mako-context no lee funnel_config: el chat de /mako opina sin datos reales del workspace. MaKo tiene que ver la data del workspace antes de responder.", false],
  [61, "Tool-Use Core de MaKo (loop agéntico)", "doer", "alta", 40, "El candado del doer: chatClaude hoy es one-shot sin tools. chatClaudeTools() ya existe en lib/anthropic.ts pero sin pushear ni cablear. Es el cimiento de todo lo accionable.", false],
  [62, "MaKo propone y acciona con tu OK (borradores + MCP bridge)", "doer", "media", 20, "La fase de LECTURA ya está pusheada (loop + 6 tools tenant-scoped en /mako-doer). Falta la Opción 2: exponer integraciones como tools (send_whatsapp/meta_write/book_meeting) que ruteen a cada lib con gating dry-run + permiso + workspace, y proponer borradores WA (crearBorrador), campaña en PAUSA owner-only y preview de nutrición. Nunca send* pelado.", false],
  [63, "Bandeja proactiva de Propuestas de MaKo", "doer", "media", 0, "Surfacing proactivo cuando no estás mirando el chat: badge en campanita + bandeja 'Propuestas de MaKo' + línea en el digest de WhatsApp. Sin modal bloqueante salvo el auto-CRM.", false],
  [64, "Score 'a quién llamar hoy' (termómetro del lead)", "doer", "media", 0, "Score compuesto derivado en lectura (recencia WA × clic email × re-visita VSL × tono del outcome) que unifique las 4 temperaturas hoy contradictorias, con umbrales desde funnel_config. Es el 'qué hacer' del pulso diario.", false],
  [65, "Encender los modos de MaKo (Analista/Comparador/Closer)", "doer", "media", 30, "Los 'modos' de lib/mako-prompts.ts están escritos pero sin usar; por eso el 'sistema multi-agente' que vende la landing es hoy falso (un solo prompt). Encenderlos es D1.", false],
  [66, "Motor de conclusiones por tab (precomputado)", "doer", "media", 25, "retro-fuentes.ts/retro-datos.ts son los building blocks (80%) para una conclusión accionable por tab, precomputada tras la ingesta diaria en vez de correr la Retro cara on-demand.", false],
  [67, "Auto-cierre de experimentos + destrabar /ideas", "doer", "media", 25, "cerrarExperimento ya existe reusable, pero no hay cron de auto-cierre; /api/experimentos/ideas (idearExperimentos) quedó huérfano sin consumidor y los buckets propuesto/descartado están muertos en la UI.", false],
  [68, "T5: auto-completar Datos sin Marcar desde el contrato", "doer", "media", 33, "La regla T5 auto-resuelve 'Datos sin marcar' leyendo el contrato (/api/extract-contract ya existe). Es la versión automática del wizard 'Solucionar' que hoy es manual.", false],
  [69, "Briefings accionables (matutino + pre-llamada)", "doer", "media", 0, "Briefing matutino '3 jugadas de hoy por plata' + briefing pre-llamada del lead (junta VSL%, Calendly y atribución en una sola pantalla). Cuelgan del tool-use core.", false],
  [70, "Experimentos: motor de hipótesis medible", "doer", "baja", 90, "lib/experimentos.ts convierte una hipótesis en experimento medible (baseline, medición en vivo, veredicto al cerrar); 'MaKo nunca concluye, sugiere abrir experimento' vive en MAKO_NUCLEO. Tabla mig 0047 + shell 3 tabs. Falta sostener la regla en cada touchpoint nuevo.", false],
  [71, "Vista de inspección del dry-run del CRM auto", "doer", "baja", 0, "Poder ver el plan que produce el motor CRM en dry-run sin correr el cron, para auditar qué haría antes del go-live.", false],
  [72, "Persistir histórico de veredictos de ads", "doer", "baja", 0, "ReconVeredicto (ad validado/apagar) se calcula en lib/queries.ts pero no se persiste histórico; los detectores de 'quema de dinero' necesitan esa serie guardada.", false],
  [73, "Diagnóstico del cuello de botella (qué tocar primero)", "doer", "baja", 0, "MaKo señala el cuello del funnel y dice 'qué toco primero'. Complementa el semáforo vivo.", false],
  [74, "Board /plan: cerrar pendientes de dev", "doer", "baja", 0, "Quitar el dismissableGauntlet temporal del super-admin (repo.dismissableGauntlet en PlanBoard + estado dismissed en BoardShell) al cerrar el desarrollo, y dar coherencia prioridad-vs-deadline en el orden.", false],
  [75, "patchLeadAction única (sustrato MaKo tool-use)", "doer", "futuro", 30, "Consolidar las escrituras al lead en UNA acción con validación estricta-para-humanos / laxa-para-webhooks, como sustrato para que MaKo escriba y proponga sobre leads. Especulativo.", false],
  [76, "Board /plan: adjuntar archivos + fixes menores", "doer", "futuro", 0, "Opcional: adjuntar archivos a las tareas (Storage). Fixes v5: restaurar un borrado no reengancha retro_id/experimento_id; asignar una etiqueta recién creada antes de reconciliar su id la puede descartar.", false],
  [77, "Cerrar leaks cross-tenant restantes", "plat", "alta", 25, "mako_knowledge/meta_health/anthropic-usage ya se cerraron (mig 0071), pero ANTES de onboardear clientes reales: webhook Chatwoot matchea leads global, tracking VSL/landing usa getSupabaseServer crudo, y las vistas v_cohortes no tienen workspace_id.", false],
  [78, "Preservar meta_form_respuestas + adset/campaign", "plat", "alta", 0, "URGENTE: guardar meta_form_respuestas + adset_id/campaign_id/created_time. Meta borra a los 90 días (pérdida irreversible) y adset_id_origen es columna muerta desde mig 0001.", false],
  [79, "Flags de envío por workspace (no global)", "plat", "alta", 33, "NUTRICION_SEND_ENABLED/EMAIL_SEND_ENABLED/CRM_AUTO_ENABLED son globales por deploy (dry-run). Prender uno impacta a TODOS los clientes y 'quema' pasos de WhatsApp como simulado. Hacerlos por workspace para un go-live selectivo y seguro.", false],
  [80, "Cerrar acciones operativas de la auditoría de seguridad", "plat", "alta", 0, "Acciones requeridas OWASP+STRIDE: setear CHATWOOT_WEBHOOK_SECRET en Vercel (sin él el webhook rechaza en prod y deja de pausar nutrición), aplicar mig 0061 (índices/perf + email lowercase) y opcional VSL_ALLOWED_ORIGINS.", false],
  [81, "Funnel-agnóstico: hardcoding restante", "plat", "media", 25, "NIVEL/worklist ya es funnel-agnóstico, pero falta deriveStageKey con keys custom (leads mal ubicados en funnels VSL/3+ reuniones), queries comerciales que asumen fecha_junta_1/R2/'ganado', y AUTO_UMBRALES + tipo de cambio USD/MXN por workspace.", false],
  [82, "Multi-tenant plumbing restante", "plat", "media", 25, "Los crons de nutrición ya iteran workspaces, pero el webhook de Fathom solo matchea leads del dueño (OWNER_WS), INTERNAL_EMAILS/META_PAGE_ID están hardcodeados, y varios fallbacks caen a OWNER_WS cuando ws=null.", false],
  [83, "Métricas/embudo dinámicos sobre funnel_config", "plat", "media", 0, "getResumenComercialMaduras está clavado a 4 etapas fijas; si agregás una etapa al funnel, los dashboards la ignoran y mienten. Derivar el embudo de funnel_config.", false],
  [84, "SLAs por etapa + audit log de transiciones", "plat", "media", 0, "time_limit_days + exit criteria por etapa y una tabla pipeline_audit que registre las transiciones, base para alertas de SLA vencido.", false],
  [85, "Ficha 360: journey unificado", "plat", "media", 0, "Integrar closing_analyses (score/summary/next_step/objeciones, ya indexado por lead_id) + nutrición (0034) + último mensaje WA en la ficha, todo por buildJourney y no como cards sueltas. Cero IA nueva, solo queries.", false],
  [86, "Dolor/objeciones por lead en la ficha", "plat", "media", 33, "closing_analyses.dims ya extrae SPIN (Situación/Problema con quote); falta el mapper dims→lead con un modelo único {fuente, quote, handled, note} unificado con WhatsApp. Distinto de la minería agregada de objeciones.", false],
  [87, "Journey del lead desde funnel_config", "plat", "media", 0, "buildJourney (lib/journey.ts) y las reglas de etapa hardcodean el funnel canónico R1/R2 e ignoran funnel_config; para funnels custom hay que derivarlo con fixtures.", false],
  [88, "CAPI: disparar eventos reales a Meta (Purchase + retención VSL)", "plat", "media", 30, "La infra meta-capi.ts ya acepta cualquier evento; faltan los callers. Al confirmar ganado+monto disparar Purchase con value real (nunca 0, dedup por meta_ad_id), y agregar en app/api/track/vsl el evento 'vio VSL' que hoy no se manda. Optimiza campañas con la data real del CRM.", false],
  [89, "Satélite 'agendas' (fuente de verdad de reuniones)", "plat", "media", 0, "Tabla agendas (URI Calendly + hora + estado) como fuente de verdad de reuniones; Fathom matchea por ventana horaria (arregla el which R1/R2 heurístico) y habilita el trigger 'canceló sin reagendar'.", false],
  [90, "Cerrar bautismo del visitor_id (VSL)", "plat", "media", 40, "Camino 1 backend (stampVisitorOnLead) y Caminos 2/3 (Calendly) ya están; falta que la landing Lovable lea ?l y lo mande en los beacons, el flujo WhatsApp con ?l={{meta_lead_id}}, y el contador de visitas en la ficha grande. Hoy ~5 leads con visitor_id vs 383 eventos.", false],
  [91, "Recomendaciones de cuenta derivadas por MaKo", "plat", "media", 40, "La API de Meta devuelve recomendaciones vacías (recommendations/opportunity_score en {}), así que la dirección es derivarlas en MaKo. Existe el botón 'Analizar cuenta con MaKo'; falta hacerlas proactivas y completas.", false],
  [92, "Mini-onboardings por tab (sacar del wizard)", "plat", "media", 30, "Mini-onboardings al abrir cada tab por primera vez (email ya tiene el de dominio) y sacar del wizard principal email, fathom→/closing, panda/youtube→VSL y calendly; Meta+WhatsApp quedan en el wizard.", false],
  [93, "Cron server-side que reanuda la extracción del onboarding", "plat", "media", 33, "Hoy la extracción histórica del onboarding solo avanza si el cliente tiene la pestaña abierta. Falta un cron nocturno que corra tickExtracción server-side para reanudar las que quedan a mitad, respetando el lease anti doble-runner.", false],
  [94, "Verificar que las migraciones estén aplicadas en prod", "plat", "media", 30, "Bug caro (2026-07-10): 0075/0076 nunca se corrieron y los insert a wa_mensajes fallaban en silencio (supabase-js no lanza). Al crear una migración, aplicarla a mano (scripts/apply-migration.mjs) + NOTIFY pgrst.", false],
  [95, "Eficiencia del CRM (SELECT * y seq scans)", "plat", "media", 25, "Los índices de leads ya entraron (mig 0072), pero getPendientesDeMarcar hace SELECT * de TODOS los leads en cada /leads y en los crons, getObjetivoProgreso filtra fecha en JS y el board carga visitas/VSL que no usa.", false],
  [96, "Paginar y virtualizar el tablero CRM (P-6/P-13)", "plat", "media", 0, "Falta paginación real de listLeads y virtualización del board con react-window; hasta ahora solo se agregó el índice.", false],
  [97, "Cablear las fuentes faltantes del funnel (SourceStrip)", "plat", "media", 40, "El SourceStrip solo vigila 5 fuentes: 'Email' y 'Landing (Claude)' son humo (solo Lovable está cableado) y falta listar YouTube.", false],
  [98, "Tests del CRM multi-tenant", "plat", "baja", 25, "Ya hay tests de stage-requirements y planLeadAuto, pero falta cubrir getTenantDb scoping (tablas/vistas fuera de TENANT_TABLES), el contrato TENANT_TABLES↔workspace_id y faltantesDeLead con funnels custom.", false],
  [99, "Canasta de enriquecimiento fill-if-empty", "plat", "baja", 0, "Backfills baratos (<1h c/u): closer desde deriveCloser de Fathom, fecha_junta_* desde recording_start_time, teléfono E.164 verificado de Chatwoot, respondio_at/clic en nutrición.", false],
  [100, "Cola única de sin-match (review_queue)", "plat", "baja", 0, "Una review_queue única para todo lo que no matchea a un lead (Fathom/Meta/Chatwoot), en vez de perderse en silencio.", false],
  [101, "Agregar en DB los eventos de VSL/landing (P-2)", "plat", "baja", 0, "Hoy se traen filas crudas de vsl_events/landing_visits y se cuentan en JS; falta una view/RPC o precómputo en la fila del lead.", false],
  [102, "Endurecer CSP con nonces + idempotencia de webhooks", "plat", "baja", 0, "Falta CSP con nonces en script-src/style-src (requiere testeo en browser) y dedup anti-replay de webhooks por event_id.", false],
  [103, "Depurar código muerto de la ficha", "plat", "baja", 0, "/api/lead-plan quedó huérfano y saveCuotasAction hereda de saveLeadPlanManual que FUERZA estado 'ganado'. Limpieza notada en auditoria-ficha-lead.", false],
  [104, "Autodetectar closer desde Chatwoot", "plat", "baja", 50, "El closer ya se autodetecta desde Fathom + foto/nombre del equipo; falta mapear el assignee de Chatwoot ('Asignado a X por Y') en lib/chatwoot mapConv para sugerirlo.", false],
  [105, "Google Calendar como 3ra fuente (go-live)", "plat", "baja", 80, "OAuth propio + lib/google-calendar + buscarEventosGoogle ya integrados a auto-reuniones. Falta que Martín conecte la cuenta y registre el redirect URI en Google Cloud Console.", false],
  [106, "Tracking granular en Lovable (go-live)", "plat", "baja", 80, "El snippet actualizado está en docs/lovable-tracking.md (pageview con landing_url/referrer; VSL con vsl_titulo). Falta que Martín lo pegue en Lovable con el dominio real y setee VSL_ALLOWED_ORIGINS en Vercel.", false],
  [107, "Tab Teléfonos del workspace", "plat", "baja", 80, "En /configuraciones se cargan los números desde los que se contacta a los leads (mig 0065: número, etiqueta, fuente, setters), con fuente auto-sugerida por Chatwoot. Falta la fuente 'API WhatsApp no oficial'.", false],
  [108, "Registrar prompts de Experimentos/Retro en /configuraciones", "plat", "baja", 25, "Los prompts experimentos.* (incluidos experimentos.retro.system/user) usan getPromptText/renderPrompt pero todavía no están en el registro editable, así que no se pueden editar desde /configuraciones sin deploy.", false],
  [109, "Corregir 'núcleo no editable' en /contexto", "plat", "baja", 0, "En /contexto el núcleo MAKO_NUCLEO todavía se muestra como 'no editable' aunque desde Configuraciones ya sí se puede editar. Falta actualizar el copy/estado.", false],
  [110, "Onboarding wizard bloqueante del cliente nuevo", "plat", "baja", 100, "Wizard full-screen que bloquea hasta terminar: integraciones probadas (Meta/WhatsApp) → extracción histórica en vivo → config de tabs → negocio → Retro inicial. Hecho (commit 4bd809b).", false],
  [111, "Renombrar campañas + nomenclatura MaKo en lote", "plat", "baja", 100, "Ads Manager: edición inline del nombre (op:'name' en /api/meta-write) + MaKo template-driven con numeración jerárquica 001/001.01/001.01.a y filtro por rango de fecha. Hecho y verificado con 27 campañas.", false],
  [112, "Estado de Meta: salud de cuenta + semáforo", "plat", "baja", 100, "/marketing/salud responde '¿el sistema está entregando?': banner de pago, resumen de entrega y alerta ROJA en el Semáforo si la cuenta está UNSETTLED/DISABLED. Hecho.", false],
  [113, "Configuraciones: todos los prompts de IA editables", "plat", "baja", 100, "/configuraciones centraliza los 33 prompts de IA (10 grupos) editables con slots {{}}, historial de 30 versiones y advertencia en los delicados. Fuente de verdad prompt-registry.ts + overrides en app_settings. Entregado.", false],
  [114, "Migrar embeddings del RAG a pgvector", "plat", "futuro", 0, "Hoy los embeddings de mako_knowledge se guardan como jsonb y la similitud es coseno en JS (sin pgvector). A escala conviene pgvector para búsqueda vectorial nativa.", false],
  [115, "Auditar modelo de IA por feature (OpenAI vs Claude)", "plat", "futuro", 30, "La regla es OpenAI para tareas simples (transcribir) y Claude para análisis/interpretación. Falta una pasada que verifique que cada call de IA use el modelo correcto.", false],
  [116, "Trackear la fuente de cada reunión", "plat", "futuro", 33, "Persistir 'se agendó fuera de Calendly' como dato sin marcar requiere trackear la FUENTE de cada reunión en la ingesta (webhook Calendly vs Google/Fathom) + campo + motor. El flujo manual ya captura el motivo; bajo valor/frecuencia.", false],
  [117, "Cerrar pendientes del creador de campañas", "plat", "futuro", 0, "El creador 'Nueva campaña' con MaKo está hecho pero quedan menores: form builder de lead ads (hoy solo reusa formularios existentes), idempotencia server-side completa y video grande/async vs maxDuration del plan.", false],
  [118, "Recordatorios de juntas nativos en la app (24h/1h/15m)", "canales", "alta", 30, "El no-show es el asesino nº1. Hoy los recordatorios de Calendly (T-1h y 24h/1h/15m) corren en n8n vía Chatwoot. La hora del webhook de Calendly ya se captura; falta programarlos y enviarlos por el canal propio, y retirar el workflow de n8n.", false],
  [119, "Motor de seguimiento/follow-up del lead (FU1-3) en la app", "canales", "alta", 0, "Los follow-ups FU1-3 viven en n8n ('Follow Ups', cron 15min) APAGADOS sobre otro Supabase. El feature 'seguimiento' figura 'en activación': el envío automático al aprobar plantillas todavía no corre. Reconstruir el seguimiento dentro de la app (reusa el motor de nutrición), encenderlo y retirar el de n8n.", false],
  [120, "Go-live del WhatsApp no oficial (Evolution)", "canales", "alta", 20, "F2 está COMPLETA en código (conexión, espejo, envío, borradores) pero apagada: falta cargar EVOLUTION_* en Vercel, conectar un chip de descarte, tocar 'Reparar espejo' y prender envioWhatsappHabilitado por ws.", false],
  [121, "Señales de WhatsApp en el lead", "canales", "media", 0, "Un solo UPDATE en el webhook de Chatwoot que setee ultima_respuesta_wa_at + ultimo_mensaje_wa. Habilita el no_responde automático, SLA y el orden del worklist.", false],
  [122, "Nutrición por funnel (secuencias derivadas de funnel_config)", "canales", "media", 40, "Los 5 templates de nutrición (mig 0069) cubren los funnels comunes pero una etapa custom del funnel no deriva su nutrición. Definir una secuencia por plantilla de funnel y hacerla funnel-agnóstica, enganchada al motor existente y enrolando al lead según su etapa.", false],
  [123, "Cobranza/dunning por WhatsApp (secuencia nopaga desde pagos)", "canales", "media", 0, "La cobranza (Sold/Cash/Outstanding + plan de cuotas) ya está en lib/pagos.ts pero nada dispara el seguimiento. Usar la tabla pagos como trigger: cuota vencida → secuencia nopaga automática por WhatsApp, que corta al confirmarse el pago.", false],
  [124, "MaKo inbound por WhatsApp (responder + 'sí hazlo' + PDF)", "canales", "media", 20, "El outbound al dueño (apertura reporte_mako, ventana 24h) ya está OK. Falta el handler entrante del número del dueño: MaKo responde, y ante 'sí, hazlo' resuelve mako_confirmaciones y ejecuta /api/meta-write (p.ej. pausar campañas); además adjuntar PDF. Lo toca el otro Claude → coordinar.", false],
  [125, "Onboarding doer de WhatsApp", "canales", "media", 0, "Que /whatsapp, al detectar la primera vez (nada conectado + sin plantillas), lance un onboarding que genere toda la nutrición de todas las etapas y el usuario solo apruebe/conecte; para probarlo hay que desconectar ws1 de Mauricio al arrancar.", false],
  [126, "Bloquear contacto + ticks de entrega (no oficial)", "canales", "media", 25, "F4 pendiente: falta el bloqueo de lead/teléfono (endpoint + modal) en EmpresaInbox y el componente de ticks compartido; la columna wa_mensajes.status ya existe pero el webhook messages.update aún no pinta el estado.", false],
  [127, "Abrir el chat del lead desde el CRM (deep-link ?lead=)", "canales", "media", 0, "Falta soportar ?lead= en EmpresaInbox para que el botón del CRM/ficha abra directo la conversación del lead.", false],
  [128, "Hardening del WhatsApp no oficial (deuda F2)", "canales", "media", 0, "El webhook usa un secret GLOBAL (falta token random por instancia), getConversacionesNoOficial agrupa una ventana global de 600 (pasar a SQL distinct-on), togglear canal desmonta el inbox y el envío manual no atribuye autor.", false],
  [129, "Reenganche tras baneo del número", "canales", "media", 0, "Regla del PDF: si banean el número, chip nuevo + QR + mensaje de reenganche personalizado armado desde el historial espejado. El espejo total ya existe; falta el flujo de reenganche.", false],
  [130, "Unificar arquitectura n8n: app=cerebro, n8n=brazos", "canales", "media", 0, "Split brain: dos Supabase distintos (app: leads/vsl; n8n: mae_leads/log_lead_chat) que no se cruzan, con Calendly procesado por ambos. La app decide la nutrición con funnel+VSL y n8n solo ejecuta WhatsApp/Telegram.", false],
  [131, "Webhook Chatwoot: distinguir dueño de lead", "canales", "media", 0, "El webhook de Chatwoot no diferencia si el mensaje entrante es del dueño o de un lead, lo que rompe las notificaciones accionables y el ruteo por workspace.", false],
  [132, "MaKo escribe la nutrición en la voz del cliente", "canales", "media", 85, "F3 COMPLETO: destilador de voz (ad_transcripts + marca), generador que reescribe cada paso y puente que manda las plantillas WA a Meta. Falta el go-live real (flags de envío por ws + probar el submit de plantilla en vivo con las creds del cliente).", false],
  [133, "Desacoplar el envío de Telegram del hardcode a Mauricio", "canales", "media", 0, "La ingesta ya es por-workspace, pero los crons que MANDAN (email-broadcasts y reportes) siguen owner-only y Telegram está hardcodeado a MB.", false],
  [134, "Mostrar en el Chat qué número contactó a cada lead", "canales", "media", 0, "En el tab Chat de la ficha, indicar desde qué número del workspace se contactó al lead — requiere mapear conversación→inbox de Chatwoot (el inbox de la app es único).", false],
  [135, "Follow-up post-llamada redactado por MaKo", "canales", "media", 0, "Que MaKo redacte el follow-up justo después de la llamada (distinto del reporte post-reunión al lead).", false],
  [136, "Nutrición sugerida por MaKo (no configurada)", "canales", "media", 40, "Los clientes conocen su pipeline pero dejan la nutrición 'abierta' (su punto ciego). Sugerírsela con plantillas por tipo de negocio, lista para WhatsApp/Email, en vez de pedirles que la armen. El cerebro de copy ya existe (F3); falta el layer de plantillas por negocio.", false],
  [137, "Seguimiento granular por lead (persistir toques)", "canales", "media", 0, "Hoy Lead solo tiene nutricion_realizada:boolean; no existe tabla de toques por lead ni se editan toques individuales. Crear lead_nutriciones + action y cablearla en la ficha para el follow-up granular, enrolándola en el motor de nutrición.", false],
  [138, "Agendó sin ver el VSL → mandárselo automático", "canales", "baja", 0, "El lead que agendó sin ver el VSL (visitor_id) recibe el VSL automáticamente antes de la llamada.", false],
  [139, "Inbound-first: wa.me con keyword + QR en vivo", "canales", "baja", 0, "El PDF pide inbound-first (links wa.me con keyword y QR en vivo para que el lead escriba primero) porque baja el riesgo de baneo ~90%.", false],
  [140, "Respetar límites de entrega de Meta (131049) en la nutrición", "canales", "baja", 0, "El error 131049 ('healthy ecosystem engagement') es el límite de frecuencia de marketing de Meta al mismo usuario, no un problema de formato; la nutrición debería respetarlo para no quemar entregas.", false],
  [141, "Inbox de email por lead", "canales", "futuro", 33, "Hoy no existe inbox de email (Resend = nutrición/broadcast) y el botón Email de la ficha queda en mailto. Falta un inbox por lead + historial de envíos email en la ficha.", false],
  [142, "Bot de contención oficial para tráfico frío de ads", "canales", "futuro", 0, "El tercer número del esquema: bot oficial (Cloud API + Chatwoot) que recibe el tráfico frío de ads con plantillas y contiene antes de pasar al no oficial.", false],
  [143, "Escalar la infra de mensajería (keys propias por ws)", "canales", "futuro", 20, "Hoy Resend y Evolution usan una cuenta única de MaKo (Opción A); al escalar hace falta el plan pago de Resend (100/día por cuenta) y dejar cargar key propia por workspace vía credenciales.", false],
  [144, "Estado de leído server-side (no localStorage)", "canales", "futuro", 40, "El unread_count de Chatwoot viene siempre 0, así que hoy 'mensaje nuevo' se detecta por la dirección del último mensaje y el 'leído' se trackea en localStorage por cliente; falta un estado de leído robusto del lado del server.", false],
  [145, "Chat de Instagram integrado", "canales", "futuro", 0, "Ruta /instagram existe como stub <ComingSoon/> en el grupo Chats del sidebar. Falta el canal real.", false],
  [146, "MaKo produce documentos con skills runtime (Vía B)", "analy", "media", 0, "Hoy MaKo solo LEE/extrae docs, nunca PRODUCE. Vía B (sin migrar a Agent SDK): Messages API + header skills-2025-10-02 + code_execution + Files API → helper generateDocWithSkill(), sube al bucket 'contratos' que ya existe. Desbloquea contrato+Anexo A, xlsx, recibos, reportes/Retro branded.", false],
  [147, "Deck de propuesta (J2) desde el transcript de R1", "analy", "media", 0, "Con skills runtime (Vía B) + la skill propuesta-v2: generar el deck de propuesta de la R2 desde el transcript de R1. Ataca la mayor fuga del funnel (R1→propuesta).", false],
  [148, "Closing Analyst (venta vs servicio)", "analy", "baja", 100, "/closing trae las llamadas de Fathom, las matchea con leads por email, clasifica venta R1/R2 vs entrega de servicio y scorea SPIN + momentos + objeciones con Claude (v2, migr 0038, grabación embebida). HECHO; sin card en el SEED.", false],
  [149, "Scripts Analyst (guiones de video ads)", "analy", "baja", 100, "/script-analyst cruza el análisis cualitativo de Claude (ángulo/hook/beats) con la retención de Meta + agendas/cierres del CRM: Patrones, Cuadrante de retención, valorar guion nuevo y Guiones. HECHO (migr 0039-0042, 55 guiones). Sin card en el SEED.", false],
  [150, "Cerebro de copywriting (metodología + swipe)", "analy", "baja", 90, "HECHO: metodología curada (AIDA/PAS/BAB, gatillos) en mako_knowledge área 'mensajes' + swipe de ejemplos reales (área 'ejemplos', few-shot) que elevan el generador y el wa-advisor. Falta que Martín cargue más ejemplos de swipe.", false],
  [151, "Sistema de Contexto de MaKo (RAG + Fases + Prompts + Onboarding)", "analy", "baja", 90, "buildSystemPrompt() ensambla de forma aditiva persona + núcleo + perfil del negocio + RAG + datos. Pantallas /contexto (Conocimiento/Fases/Prompts) y /onboarding (Oferta·Avatar·Personaje, extrae con OpenAI). Construido; se sigue extendiendo el wiring.", false],
  [152, "Asesor de WhatsApp (Levanta Muertos)", "analy", "baja", 85, "WhatsAppAdvisor lee la conversación en vivo + etapa + ventana 24h y recomienda 2-3 mensajes (ángulo/tono, 'Usar' inserta en el compositor) con la metodología area='mensajes'; incluye 'Redactar con MaKo' (plantilla Meta-safe) y chat por lead. Reemplazó 'Plantillas rápidas'.", false],
  [153, "Depurar muertos de Script Analyst", "analy", "baja", 0, "Código huérfano: el AnglesManager viejo de ScriptsBrowser (lo reemplazó TaxonomyManager) y app/script-analyst/AnunciosBrowser.tsx, que ya no se importan.", false],
  [154, "Más skills runtime de MaKo", "analy", "futuro", 20, "El cerebro de copywriting es la primera skill runtime del producto (inspirada en skills.sh); falta extender el patrón a más skills que guíen al generador y a los analistas.", false],
  [155, "Board por veredicto en Script Analyst", "analy", "futuro", 0, "Una vista kanban alternativa al cuadrante, agrupada por veredicto (Escalar/Reescribir/Mejorar/Repensar).", false],
  [156, "Conocimiento area='ads' para alimentar creativos", "analy", "futuro", 0, "El campo area de mako_knowledge define dónde se enchufa (mensajes/ads/general). 'ads' está previsto para creativos pero marcado como futuro: falta que el RAG por area=ads alimente la generación de creativos y curar cursos de ads.", false],
  [157, "VSL Writer (guiones de VSL)", "analy", "futuro", 0, "Ruta /vsl-writer es stub <ComingSoon/>. Escritor de guiones de VSL con el patrón writer (metodología como knowledge, no skills hot-loaded).", false],
  [158, "DM Writer (redacción de DMs)", "analy", "futuro", 0, "Ruta /dm-writer es stub <ComingSoon/> en el grupo Tools. Generador de DMs con el patrón writer.", false],
  [159, "Analytics de cierre (closers, cierre ganado, curva VSL)", "analy", "futuro", 0, "Quick-wins sobre data existente: Scorecard de closers y ranking por $ real cobrado + descuento promedio (join closing × pagos), Perfil del cierre ganado (Calendly vs cierre) y Curva de retención del VSL vs cierre.", false],
  [160, "Lead Score predictivo", "analy", "futuro", 0, "Score predictivo del lead para priorizar a quién atender (D3, I5).", false],
  [161, "Agente de Ads (gasto ↔ cierre real)", "analy", "futuro", 0, "Agente que conecta el gasto con el cierre real, con presupuesto dinámico por cash y escritura a Meta (copiloto Ads con write). Depende del tool-use core y de las escrituras a Meta.", false],
  [162, "A/B testing de VSL medido por cierres", "analy", "futuro", 0, "A/B de VSL que mide CIERRES reales, no solo retención. Reusa el A/B de Panda + crons.", false],
  [163, "Loop analizar → escribir → producir", "analy", "futuro", 0, "El wedge más diferenciado (Vía C): explota Script Analyst → Ads Writer → generador de creativo en un solo loop cerrado.", false],
  [164, "Video Ad Factory (Remotion)", "analy", "futuro", 0, "Vía C, estudio creativo: fábrica de video ads con Remotion (necesita render infra). Distinto del generador de creativos estáticos.", false],
  [165, "CRO Auditor", "analy", "futuro", 0, "Vía C: auditor de conversión (CRO) que revisa la landing/funnel y recomienda mejoras. Complementa al Landing Analyst.", false],
  [166, "VoC Miner (voz del cliente)", "analy", "futuro", 0, "Vía C, intel: minar la voz del cliente desde llamadas/mensajes para alimentar copy y oferta.", false],
  [167, "Copiloto en vivo de la llamada (STT)", "analy", "futuro", 0, "Moonshot (D5): copiloto en tiempo real de la llamada con STT streaming. Es lo único que pega contra algo inexistente en el stack.", false],
  [168, "MaKo CSM sobre la cartera", "analy", "futuro", 0, "Moonshot: MaKo como Customer Success Manager sobre toda la cartera (más amplio que el CS Analyst por llamada).", false],
  [169, "Cards de features reales sin card en la landing", "growth", "futuro", 0, "Features implementadas y vendibles sin card: Revenue/Cobranza, Vista General 'tu norte', Comercial (cohortes/SCL), Contrato firmado leído por IA, Pendientes (calidad del dato) y 'la IA propone vos decidís' (review queue + audit log).", false],
  [170, "Completar las páginas de detalle de la landing", "growth", "futuro", 40, "Las 15 rutas /vsl/<slug> están construidas pero con placeholders: faltan las capturas/demos por feature (heroImg/img), llenar el array TESTIMONIOS y que las cards del grid superior linkeen a /vsl/<slug> (hoy van a anclas #m-<slug>).", false],
  [171, "Limpiar el sidebar (ComingSoon + koncke)", "ux", "media", 0, "~10 entradas ComingSoon en el sidebar (4 analysts, 4 writers, Instagram, CS) inflan la sensación de 'mucho'. Ocultar/agrupar lo no entregado y sacar /martinkoncke del nav.", false],
  [172, "Minimizar config: defaults + plantillas por negocio", "ux", "media", 20, "La menor config manual posible. Orden preferido: default sano out-of-the-box → plantillas por tipo de negocio → sugerencias automáticas → generación IA; el editor manual es el último recurso.", false],
  [173, "Simplificar el editor de funnel (no canvas)", "ux", "media", 20, "El editor visual drag-to-connect es 'rebuscado': una pantalla que se usa una vez no justifica tanta interacción. Migrarlo a lista/forms simples.", false],
  [174, "Branding MaKo (logo, voz, ChartIA)", "ux", "baja", 80, "Toda IA se marca 'MaKo' (MakoLogo/MakoStar/MakoIntro en MakoBrand.tsx) con voz rioplatense (lib/mako-persona.ts) y cada gráfico se envuelve en <ChartIA>. Falta envolver los gráficos que todavía no tienen IA+branding.", false],
  [175, "Limpiar public/mako.svg deprecado", "ux", "baja", 0, "El raster viejo public/mako.svg quedó deprecado (reemplazado por MakoBrand). Falta eliminar el asset y las referencias muertas.", false],
  [176, "Migrar los <select> nativos viejos al Dropdown custom", "ux", "baja", 60, "Ya existe app/components/Dropdown.tsx y está en varios lados. Quedan selects viejos por migrar en LeadDetail y new lead.", false],
  [177, "Terminar la migración de labels J1/J2 → R1/R2", "ux", "baja", 90, "En texto visible las juntas se llaman R1/R2, nunca J1/J2. Quedan labels viejos en el inbox de WhatsApp (derivarEtapa) y en textoCohorteJ1 de lib/leads.ts. Solo strings de UI, NO tocar columnas/keys internas.", false],
  [178, "Modales de Nutrición/reunión al wizard MaKo", "ux", "baja", 40, "Los modales de Nutrición Manual y de reunión del tablero ya usan tokens modernos + ✦ MaKo; convertirlos al wizard MaKo completo quedó como decisión de UX (preguntar a Martín).", false],
  [179, "Multi-inquilino: aislamiento base + admin + credenciales por ws", "plat", "alta", 100, "La base multi-tenant (mig 0054/0055/0057) está HECHA y no tiene card propia: getTenantDb autoinyecta workspace_id (con AsyncLocalStorage para la caché), panel /admin con 'entrar como', y credenciales/ingesta por cliente (Fase 2/2b). Sale de multi-tenant-workspaces + aislamiento-workspace-usuarios; las cards nuevas solo cubren lo que FALTA (leaks, plumbing, tests).", false],
  [180, "Saldo IA + gasto de IA por operación", "plat", "baja", 100, "HECHO y sin card: tabla anthropic_usage (mig 0043/0082 con motivo), costFor por modelo, chip 'Saldo IA' en el sidebar (restante = saldo cargado a mano − gasto real) e historial de gasto con motivo. La API de Anthropic NO expone el saldo prepago en cuentas individuales, por eso se carga a mano. Sale de ia-uso-saldo.", false],
  [181, "Auto-etiquetas de WhatsApp por etapa (Evolution)", "canales", "baja", 90, "HECHO y sin card: catálogo evolution_labels + mapeo evolution_stage_labels (mig 0077) + tab 'Etiquetas WhatsApp' en /configuraciones; al mover un lead, updateLead/setPipelineStage recomputan derivarEtapa y dejan la etiqueta de la etapa en el chat no-oficial (idempotente). Sale de whatsapp-no-oficial-evolution.", false],
  [182, "Board /plan del cliente: persistir metadata + Fathom por cliente", "doer", "baja", 10, "Pendientes del Perro Guardián que las cards de board nuevas no cubren: Label.scoreRazon/Label.deadline son IN-MEMORY en el board del cliente (API/DB) y se recomputan por sesión (falta columna/migración); y G3/G4 usan la Fathom key de la AGENCIA, así que un cliente no puede extraer tareas de SU Fathom sin su propia key + prender fathomExtract en TodoBoard. Sale de perro-guardian-todo-board.", false],
];

// ── Checklists escritas a mano por tarea (feedback: "escribí todas las checklist").
// El avance de cada tarea se DERIVA de estos flags (ya no del % viejo). Si están mal,
// se editan en la ficha. Key = num de la tarea. ──────────────────────────────────
const SEED_CL: Record<number, Array<[string, boolean]>> = {
  // doer
  42: [['Diseñar la tab Retro & Planning', true], ['Ligar reportes + plan a Experiments', true], ['Publicar la vista base', true]],
  55: [['Definir los 7 patrones de fuga', false], ['Implementar el juez IA (metodología Recon, 2 señales)', false], ['Conectar al spec de Retro', false], ['Probar con datos reales de un cliente', false]],
  56: [['Joinear experimento_tareas por retro_id', false], ['Distinguir "aceptado" de "HECHO"', false], ['Reclamar automáticamente lo que no se ejecutó', false]],
  54: [['Definir el chequeo diario barato (vista Hoy)', false], ['Reclamo/aviso por campanita + WhatsApp', false], ['Surfacear el pulso en el semáforo', false]],
  53: [['Default SIMPLE (3 tareas + experimentos)', false], ['Mover el kanban a Avanzado', false], ['Toggle Simple ⇄ Avanzado', false]],
  4: [['Onboarding inicial con Meta', true], ['Veredicto con Experiments', true], ['Detección de fuga que manda a la tab', false], ['Modelo progresivo por tab completo', false]],
  57: [['Cruzar meta_ad_id × pagos', false], ['Atribución de cash por anuncio (granular)', false], ['Exponer el ROAS por creativo', false]],
  58: [['Leer objeciones de closing_analyses', false], ['Detectar las objeciones recurrentes que matan cierres', false], ['Surfacearlas en el cerebro', false]],
  59: [['Juntar señales + tendencia', false], ['Claude razona alertas nuevas', false], ['Mostrarlas en el semáforo vivo', false]],
  18: [['MaKo embebido en WhatsApp', true], ['Embeber en funnel y leads', false], ['Embeber en experimentos, email y closing', false]],
  14: [['Motor CRM T1-T6 construido', true], ['Esquema de cuándo mover un lead', false], ['Pop-up de confirmación + Datos sin Marcar auto', false], ['Etapa Reactivación + prender el motor', false]],
  // plat
  3: [['Diseñar /perfil (tabs)', true], ['Notificaciones + reportes', true], ['Publicar', true]],
  5: [['Roles y sesión firmada', true], ['Vista /admin + entrar-como', true], ['Publicar', true]],
  6: [['Tokens cifrados', true], ['Tutorial de /metodo', true], ['Publicar', true]],
  28: [['Roles closer/setter por workspace', true], ['Panel /equipo', true], ['Publicar', true]],
  2: [['7 tabs de la ficha del lead', true], ['Tab Chat (lectura)', true], ['Publicar', true]],
  12: [['Crear/editar campañas + USD', true], ['Escrituras a Meta (en pausa)', true], ['Probar CREATE en vivo', false]],
  33: [['Integrar la API "Analizar" de Meta', true], ['Manejar el bloqueo de pago', true], ['Recos nativas (bloqueadas por pago, no código)', true]],
  7: [['Auditoría OWASP + STRIDE', true], ['Fixear HIGH + MEDIUM', true], ['Performance (LOW)', false], ['Depurar continuo', false]],
  30: [['Definir protocolo de beta y versiones', false], ['Mejorar sin interrumpir a los usuarios', false]],
  52: [['Instalar skills (brainstorming/plans/grill/…)', true], ['Aplicarlas en el código existente', false], ['Volverlo hábito', false], ['Documentar el uso', false]],
  17: [['Traspasar Supabase', false], ['Traspasar Vercel', false], ['Traspasar dominio', false]],
  32: [['Comprar/configurar dominio propio', false], ['Rutear la landing a la raíz (no /vsl)', false]],
  // canales
  8: [['Motor de email (Resend) completo', true], ['Configurar dominio de envío', false], ['Setear RESEND_WEBHOOK_SECRET', false], ['Go-live real', false]],
  9: [['Motor de nutrición (3 canales, anti-baneo)', true], ['Aprobar templates de WhatsApp', false], ['Prender flags + dominio', false], ['Go-live', false]],
  20: [['Reportes por WhatsApp para el dueño', true], ['Que los crons iteren todos los workspaces', false], ['Go-live multi-tenant', false]],
  41: [['Evolution (no oficial) integrado', true], ['Que WhatsApp y email no-oficial vivan cómodos en MaKo', false], ['Borradores + anti-ban', false]],
  43: [['Diseñar el flujo "Datos sin Marcar" por WhatsApp', false], ['Responder desde WhatsApp', false]],
  51: [['Modelo de listas de difusión', false], ['UI para crear/enviar', false], ['Anti-baneo', false]],
  19: [['Parser de import/export de leads', false], ['Mapeo de columnas', false], ['Enrolar en nutrición', false]],
  16: [['UTM/UUID de Calendly', true], ['Config multi-tenant (hoy hardcodeado a Mauricio)', false], ['Probar por workspace', false]],
  21: [['Definir el reporte post-reunión', false], ['Enviarlo al lead/cliente', false]],
  // analy
  24: [['Conectar PostHog/Clarity', false], ['Session replay + heatmaps', false], ['Convertir el stub en analista real', false]],
  25: [['Usar la telemetría VSL existente', false], ['Construir el analista', false], ['Sacar el stub coming-soon', false]],
  13: [['Aprovechar que Closing distingue servicio', false], ['Analista de churn (CS)', false], ['Sacar el stub', false]],
  34: [['Proceso recurrente de scraping de competencia', false], ['Aviso por WhatsApp cuando un competidor mueve', false], ['Sacar el stub', false]],
  39: [['Que audite la oferta en el onboarding', false], ['Que la mejore, no solo la guarde', false]],
  26: [['Ads Writer (lib/ad-copy.ts)', true], ['GhostWriter cubierto', true]],
  29: [['Pipeline de generación de creativos en masa', false], ['Estilo Claudio Conde', false], ['Publicar', false]],
  49: [['Generador de landing pages', false], ['Plantillas + edición', false]],
  47: [['Generador de contratos', false], ['Plantillas legales', false]],
  31: [['Pipeline de cursos en Conocimiento (RAG)', true], ['Transcripción', true], ['Pre-seedear más cursos (hoy solo Levanta Muertos)', false], ['Asesor WhatsApp sobre el RAG', false]],
  // growth
  46: [['Diseñar la Oferta Cebolla (planes por nivel)', false], ['Limitar acceso por situación del lead', false], ['Venderle a todo el que corra el VSL Funnel', false]],
  45: [['Definir 1 feature por ad', false], ['Producir miles de ads por feature', false]],
  1: [['Escribir el copy de features en /vsl', false], ['Marketing, no producto', false]],
  22: [['Thank You Page post-agenda', false], ['Forzar instrucciones o cancelar la llamada', false]],
  15: [['Juntar testimonios', false], ['Mostrarlos', false]],
  27: [['Costos internos', false], ['Costos por cliente', false]],
  23: [['Grabar Loom demo por feature', false]],
  35: [['Mapa de calor de uso', false]],
  // ux
  36: [['Rediseñar Script/Closing Analyst', true], ['Rediseñar Experiments + Perfil', true], ['Rediseñar Onboarding', false], ['Cerrar el rediseño completo', false]],
  37: [['Modo Simple base', true], ['Simplificar Closing/Script Analyst', false], ['Simplificar Funnel + Onboarding', false]],
  44: [['Administrador de eventos', false], ['Publicar', false]],
  // ── checklists del roadmap minado ──
  60: [["snapshotFunnelTexto() ya existe", true], ["Enchufar el snapshot al chat de /mako", false], ["buildSystemPrompt() lee funnel_config", false], ["Números vivos en todas las respuestas de MaKo", false]],
  61: [["chatClaudeTools() con loop agéntico (built)", true], ["Envolver queries.ts/leads.ts/pagos.ts/closing.ts como tools", false], ["Pushear y cablear a un call-site real", false], ["Probar el loop con la API en vivo", false]],
  62: [["Loop chatClaudeTools + 6 tools de lectura", true], ["Definir tools de acción (WhatsApp/Meta/Calendly) que ruteen a cada lib", false], ["Proponer borrador WA + campaña PAUSA + preview de nutrición", false], ["Confirmación del usuario + scoping por workspace antes de ejecutar", false]],
  63: [["Badge de propuestas en la campanita", false], ["Bandeja 'Propuestas de MaKo'", false], ["Línea de propuestas en el digest de WhatsApp", false], ["Sin modal bloqueante salvo auto-CRM", false]],
  64: [["Unificar las 4 temperaturas contradictorias", false], ["Score compuesto (WA × email × VSL × tono)", false], ["Umbrales desde funnel_config", false], ["Surfacear en la vista Hoy", false]],
  65: [["Prompts de los modos ya escritos", true], ["Cablear los modos a chatClaude/chatClaudeTools", false], ["Exponerlos en la UI del chat de MaKo", false]],
  66: [["retro-fuentes/retro-datos como building blocks", true], ["Precomputar el insight tras la ingesta diaria", false], ["Conclusión accionable por cada tab", false], ["Cachear + refrescar sin quemar tokens", false]],
  67: [["cerrarExperimento reusable ya existe", true], ["Cron gateado de auto-cierre de experimentos", false], ["Destrabar /api/experimentos/ideas (hoy huérfano)", false], ["Historial + buckets propuesto/descartado en la UI", false]],
  68: [["extract-contract ya disponible", true], ["Auto-completar Datos sin Marcar por contrato", false], ["fill-if-empty + rastro en lead_audit", false]],
  69: [["Briefing pre-llamada del lead (1 pantalla)", false], ["Briefing matutino con las 3 jugadas de plata", false], ["Avisar por campanita/WhatsApp", false]],
  70: [["Motor hipótesis→experimento medible (lib/experimentos.ts)", true], ["Tabla experimentos (mig 0047) + vista 3 tabs", true], ["Veredicto al cerrar (validada/refutada) + aprendizaje", true], ["Respetar 'hipótesis, no verdades' en cada touchpoint nuevo", false]],
  71: [["Exponer el plan dry-run del cron", false], ["Inspeccionarlo sin correr el cron", false]],
  72: [["Definir esquema de histórico de ReconVeredicto", false], ["Persistir el veredicto en cada corrida", false], ["Alimentar los detectores de quema de dinero", false]],
  73: [["Detectar el cuello de botella del funnel", false], ["Priorizar 'qué toco primero'", false], ["Surfacearlo en el semáforo/pulso", false]],
  74: [["Quitar el dismissableGauntlet del super-admin", false], ["Coherencia prioridad-vs-deadline en el orden", false]],
  75: [["Unificar los writes del lead en patchLeadAction", false], ["Validación estricta (humanos) / laxa (webhooks)", false], ["Exponerla como tool para que MaKo actúe", false]],
  76: [["Adjuntar archivos a las tareas (Storage)", false], ["Restaurar borrado reengancha retro_id/experimento_id", false], ["Arreglar el race de etiqueta recién creada", false]],
  77: [["mako_knowledge/meta_health/anthropic-usage cerrados", true], ["Webhook Chatwoot: scopear el match de leads", false], ["Tracking VSL/landing: sacar getSupabaseServer crudo", false], ["Vistas v_cohortes con workspace_id", false]],
  78: [["Guardar meta_form_respuestas", false], ["Guardar adset_id/campaign_id/created_time", false], ["Revivir adset_id_origen (columna muerta)", false]],
  79: [["Flags globales por deploy hoy (dry-run)", true], ["NUTRICION/EMAIL/CRM_AUTO por workspace", false], ["Go-live selectivo sin quemar pasos como simulado", false]],
  80: [["Aplicar migración 0061 (índices + email lowercase)", false], ["Setear CHATWOOT_WEBHOOK_SECRET en Vercel + URL de Chatwoot", false], ["Setear VSL_ALLOWED_ORIGINS (opcional) para forzar Origin del beacon", false]],
  81: [["NIVEL/worklist ya funnel-agnóstico + índices", true], ["deriveStageKey soporta keys custom", false], ["Queries comerciales sin asumir fecha_junta/ganado", false], ["AUTO_UMBRALES + tipo de cambio por workspace", false]],
  82: [["Crons de nutrición ya iteran workspaces", true], ["Webhook Fathom multi-tenant (no solo OWNER_WS)", false], ["Sacar INTERNAL_EMAILS/META_PAGE_ID hardcodeados", false], ["Cerrar fallbacks a OWNER_WS + integración por ws", false]],
  83: [["getResumenComercialMaduras deja de asumir 4 etapas", false], ["Embudo derivado de funnel_config", false], ["Dashboards que no mienten al agregar etapas", false]],
  84: [["time_limit_days + exit criteria por etapa", false], ["Tabla pipeline_audit de transiciones", false], ["Alertas de SLA vencido", false]],
  85: [["Integrar closing_analyses por lead_id", false], ["Sumar nutrición + último WA al journey", false], ["Mostrarlo por buildJourney, no cards sueltas", false]],
  86: [["closing_analyses.dims ya extrae SPIN", true], ["Mapper dims→lead", false], ["Modelo único {fuente,quote,handled,note} con WA", false]],
  87: [["Derivar buildJourney de funnel_config", false], ["Sacar el hardcode R1/R2 de las reglas de etapa", false], ["Fixtures para funnels no canónicos", false], ["Verificar con un funnel custom real", false]],
  88: [["Infra meta-capi.ts completa (acepta cualquier evento)", true], ["Disparar Purchase al confirmar ganado+monto (value real, dedup meta_ad_id)", false], ["Caller de 'vio VSL' en app/api/track/vsl", false], ["Verificar recepción en pixel/CAPI", false]],
  89: [["Tabla agendas (URI Calendly + hora + estado)", false], ["Fathom matchea por ventana horaria (which R1/R2)", false], ["Trigger 'canceló sin reagendar'", false]],
  90: [["Camino 1 backend (stampVisitorOnLead)", true], ["Caminos 2 y 3 (Calendly)", true], ["Landing Lovable lee ?l y lo manda en los beacons", false], ["Flujo WhatsApp con ?l={{meta_lead_id}}", false], ["Contador de visitas en la ficha grande", false]],
  91: [["Botón 'Analizar cuenta con MaKo' en /marketing/salud", true], ["Derivar recos cuando la API de Meta viene vacía", false], ["Surfacearlas proactivas en el Semáforo", false]],
  92: [["Mini-onboarding de dominio en /email", true], ["Mini-onboardings de fathom, VSL y calendly", false], ["Sacar esos pasos del wizard principal", false]],
  93: [["La extracción depende del navegador del cliente hoy", true], ["Detectar extracciones en estado incompleto", false], ["Cron nocturno que reanuda tickExtracción server-side", false], ["Respetar el lease anti doble-runner", false]],
  94: [["Auditar migraciones aplicadas vs archivos", false], ["Aplicar las pendientes a mano + reload schema", false], ["Chequear el {error} de supabase-js en inserts críticos", false]],
  95: [["Índices de leads (mig 0072)", true], ["getPendientesDeMarcar sin SELECT * de todos los leads", false], ["getObjetivoProgreso filtra en SQL, no en JS", false], ["El board deja de cargar visitas/VSL que no usa", false]],
  96: [["Paginación real de listLeads (hoy trae todo)", false], ["Virtualizar el tablero CRM (react-window)", false], ["Validar que no cambie la semántica del board", false]],
  97: [["Lovable cableado en el SourceStrip", true], ["Cablear Email como fuente real", false], ["Cablear Landing (Claude)", false], ["Listar YouTube como fuente", false]],
  98: [["stage-requirements + planLeadAuto ya testeados", true], ["Test de getTenantDb scoping (tablas/vistas)", false], ["Contrato TENANT_TABLES↔workspace_id", false], ["faltantesDeLead con funnels custom", false]],
  99: [["Closer desde deriveCloser de Fathom", false], ["Backfill fecha_junta_* desde recording_start_time", false], ["Teléfono E.164 desde Chatwoot", false], ["respondio_at/clic en nutrición", false]],
  100: [["review_queue única (Fathom/Meta/Chatwoot)", false], ["UI para resolver los sin-match", false]],
  101: [["View/RPC o precómputo de conteos por visitor_id", false], ["Reemplazar el conteo en JS por la agregación en DB", false]],
  102: [["CSP script-src/style-src con nonces", false], ["Idempotencia/anti-replay de webhooks (dedup por event_id)", false]],
  103: [["Retirar /api/lead-plan huérfano", false], ["Arreglar saveCuotasAction que fuerza 'ganado'", false], ["Barrido de muertos residuales de edit-logic", false]],
  104: [["Foto+nombre del equipo (match por nombre)", true], ["Detección del closer desde Fathom", true], ["Mapear assignee en lib/chatwoot mapConv", false], ["Sugerir closer desde la asignación de Chatwoot", false]],
  105: [["Código OAuth + integración a auto-reuniones", true], ["Registrar redirect URI en Google Cloud Console", false], ["Conectar la cuenta de Google", false], ["Verificar triple matcheo (Calendly+Fathom+GCal)", false]],
  106: [["Backend /api/track/vsl + tab Tracking (migr 0061)", true], ["Pegar el snippet en Lovable con el dominio real", false], ["Setear VSL_ALLOWED_ORIGINS en Vercel", false], ["Verificar eventos con múltiples landings/VSL", false]],
  107: [["Tabla workspace_telefonos (mig 0065)", true], ["Fuente auto-sugerida por chatwootConfigurado()", true], ["Setters por número desde el equipo del workspace", true], ["Implementar la fuente 'API WhatsApp no oficial'", false]],
  108: [["Los prompts ya usan getPromptText/renderPrompt", true], ["Sumar experimentos.* a prompt-registry.ts", false], ["Exponerlos como grupo editable en /configuraciones", false]],
  109: [["Detectar el label 'no editable' del núcleo en /contexto", false], ["Reflejar que el núcleo es editable desde Configuraciones", false]],
  110: [["Paso Integraciones con Meta/WhatsApp probadas", true], ["Extracción histórica con panel lateral en vivo", true], ["Config de tabs + negocio + Retro inicial streameada", true], ["Gating server-side + exención de ws1 (Mauricio)", true]],
  111: [["op:'name' en /api/meta-write + edición inline (NameEditor)", true], ["MaKo en lote con plantilla + variables semánticas", true], ["Numeración jerárquica anclada al padre", true], ["Filtro por rango de fecha de creación", true]],
  112: [["Vista /marketing/salud (Estado de Meta)", true], ["getMetaAccountHealth para el Semáforo de /general", true], ["Alerta roja por cuenta impaga/inhabilitada", true]],
  113: [["Registro central prompt-registry.ts", true], ["Store de overrides + historial (30 versiones)", true], ["UI /configuraciones (33 prompts, 10 grupos)", true]],
  114: [["Habilitar pgvector en Supabase", false], ["Migrar columna de embeddings jsonb→vector", false], ["Reemplazar coseno-en-JS por búsqueda nativa", false]],
  115: [["Regla OpenAI-simple / Claude-análisis vigente", true], ["Inventariar cada call de IA y su modelo", false], ["Corregir los que usen el modelo equivocado", false]],
  116: [["El flujo manual ya captura el motivo", true], ["Trackear la fuente en la ingesta (Calendly vs Google/Fathom)", false], ["Campo + motor 'agendó fuera de Calendly'", false]],
  117: [["Form builder de lead ads (hoy solo reusa)", false], ["Idempotencia server-side completa", false], ["Manejo de video grande/async vs maxDuration", false]],
  118: [["La hora de Calendly ya se captura", true], ["Programar recordatorios 24h/1h/15m + T-1h en la app", false], ["Enviar por el canal de mensajería propio", false], ["Retirar el workflow de n8n (evitar duplicado)", false]],
  119: [["Modelar FU1-3 sobre los leads de la app", false], ["Motor de disparo + deadlines (reusa nutrición)", false], ["Aprobar plantillas de seguimiento en Meta", false], ["Disparar el envío automático al aprobarlas", false], ["Encenderlo y retirar el de n8n", false]],
  120: [["Cargar EVOLUTION_BASE_URL/API_KEY/WEBHOOK_SECRET (+APP_BASE_URL) en Vercel", false], ["Conectar chip de descarte y validar QR/espejo/envío", false], ["Reparar espejo (verificar webhook end-to-end)", false], ["Prender envioWhatsappHabilitado por workspace", false]],
  121: [["ultima_respuesta_wa_at (UPDATE en webhook Chatwoot)", false], ["ultimo_mensaje_wa", false], ["Habilitar no_responde auto + SLA + orden del worklist", false]],
  122: [["5 templates cubren funnels comunes", true], ["Mapear una secuencia por plantilla de funnel", false], ["Derivar nutrición de etapas custom (funnel-agnóstica)", false], ["Enrolar al lead según su etapa del funnel", false]],
  123: [["Tabla pagos como trigger (detectar cuota vencida / a quién cobrar)", false], ["Secuencia nopaga/dunning por WhatsApp", false], ["Cortar al confirmarse el pago", false]],
  124: [["Outbound/apertura 24h ya OK", true], ["Handler de WhatsApp entrante para el número del dueño", false], ["MaKo responde y acciona (pausar campañas via meta-write)", false], ["Resolver mako_confirmaciones ('sí hazlo') + adjuntar PDF", false]],
  125: [["Detectar primera vez (sin conexión + sin plantillas)", false], ["Generar toda la nutrición de todas las etapas (reusa F3.2)", false], ["Registrar + VERIFICAR el webhook (evitar fallo silencioso)", false], ["Desconectar ws1 al arrancar para poder probar", false]],
  126: [["Columna wa_mensajes.status (migración)", true], ["Webhook messages.update → status en la burbuja", false], ["Componente Ticks compartido (_shared)", false], ["Bloquear lead/teléfono (endpoint + modal)", false]],
  127: [["Soportar ?lead= en EmpresaInbox", false], ["Botón 'abrir chat' en la ficha del lead", false], ["Resolver lead→chatJid y seleccionar la conversación", false]],
  128: [["Token random por instancia (columna nueva)", false], ["getConversacionesNoOficial → SQL distinct-on", false], ["No desmontar EmpresaInbox al togglear canal", false], ["Atribuir autor en el envío manual", false]],
  129: [["Detectar baneo / desconexión del número", false], ["Alta de chip nuevo + QR guiado", false], ["Generar mensaje de reenganche desde el historial", false]],
  130: [["Decidir la dirección (app = cerebro)", false], ["Unificar/puentear los dos Supabase", false], ["Dejar n8n solo como brazos (Chatwoot/Telegram)", false]],
  131: [["Detectar el teléfono del dueño vs. lead", false], ["Rutear al flujo correcto (acción vs. inbox)", false]],
  132: [["Destilador de voz (F3.1)", true], ["Generador + revisar/aprobar (F3.2/3.4)", true], ["Plantillas WA a Meta + toggle de canal (F3.3)", true], ["Go-live: probar submit de plantilla en vivo", false]],
  133: [["Parametrizar el chat de Telegram por workspace", false], ["Loopear email-broadcasts por workspace activo", false], ["Validar el envío punta a punta con un cliente real", false], ["Respetar rate limits reales al disparar por cuenta", false]],
  134: [["Mapear conversación → inbox de Chatwoot", false], ["Resolver el número del workspace por conversación", false], ["Mostrarlo en el header del Chat de la ficha", false]],
  135: [["Detectar fin de llamada (Fathom/Calendly)", false], ["MaKo redacta el follow-up con contexto del lead", false], ["Enviarlo con tu OK por WhatsApp/email", false]],
  136: [["MaKo redacta la nutrición (cerebro de copy)", true], ["Plantillas de nutrición por tipo de negocio", false], ["Dejarla lista para aprobar, no para configurar", false]],
  137: [["Crear tabla lead_nutriciones (toques por lead)", false], ["Action para registrar/editar toques individuales", false], ["Cablear la edición de toques en la ficha del lead", false], ["Enrolar el seguimiento en el motor de nutrición", false]],
  138: [["Detectar 'agendó sin ver el VSL'", false], ["Enviarle el VSL automáticamente", false]],
  139: [["Generar links wa.me con keyword por campaña", false], ["QR en vivo para captar inbound", false], ["Enrolar el inbound en la nutrición", false]],
  140: [["Detectar/registrar 131049 por lead", false], ["Backoff de frecuencia de marketing por usuario", false]],
  141: [["Hoy el botón Email es mailto", true], ["Inbox de email por lead", false], ["Historial de envíos email en la ficha", false]],
  142: [["Diseñar el bot de contención (plantillas de entrada)", false], ["Recibir tráfico frío de ads en el número oficial", false], ["Handoff al canal no oficial cuando calienta", false]],
  143: [["Puerta a key propia por ws (Resend/Evolution)", true], ["Plan pago de Resend al escalar", false], ["Documentar límites por cuenta", false]],
  144: [["Detección de nuevo por dirección (ultimoEntrante)", true], ["Leído en localStorage por chat", true], ["Estado de leído server-side compartido", false]],
  145: [["Conectar la API de Instagram/Meta", false], ["Bandeja de DMs en /instagram", false], ["Sacar el stub coming-soon", false]],
  146: [["Helper generateDocWithSkill() (skills runtime)", false], ["Generar contrato + Anexo A (cierra el loop de extract-contract)", false], ["Export xlsx / recibos", false], ["Reportes/Retro branded", false]],
  147: [["Tomar el transcript de R1 (Fathom)", false], ["Generar el deck de propuesta con la skill", false], ["Entregarlo listo para la R2", false]],
  148: [["Matcheo Fathom↔lead + clasificación venta/servicio", true], ["Score SPIN + momentos + objeciones con Claude", true], ["Vistas Métricas + Llamadas con grabación embebida", true], ["Sync + cron + re-análisis", true]],
  149: [["Cualitativo estable + métricas vivas (sin filtro fecha)", true], ["Patrones + Cuadrante de retención", true], ["Valorar guion nuevo + historial", true], ["Ángulos/avatares editables + soporte imágenes", true]],
  150: [["Sembrar metodología ('mensajes')", true], ["Swipe de ejemplos (few-shot, área 'ejemplos')", true], ["Cargar más ejemplos reales al swipe", false]],
  151: [["buildSystemPrompt aditivo (persona+núcleo+perfil+RAG+datos)", true], ["RAG mako_knowledge + fases por sección + prompts", true], ["Onboarding wizard (Oferta/Avatar/Personaje) con extracción", true], ["Extender el wiring a nuevos touchpoints", false]],
  152: [["Recomienda 2-3 mensajes desde la conversación en vivo", true], ["'Redactar con MaKo' → plantilla Meta-safe", true], ["Prompts registrados en el registro editable", true], ["Afinar con datos reales por cliente", false]],
  153: [["Borrar el AnglesManager viejo de ScriptsBrowser", false], ["Borrar AnunciosBrowser.tsx huérfano", false]],
  154: [["Definir el patrón de skill runtime (curada + swipe)", true], ["Sumar skills nuevas (más metodologías/áreas)", false], ["Enchufarlas a los generadores/analistas", false]],
  155: [["Diseñar el kanban por veredicto", false], ["Reusar verdictOf existente", false], ["Ofrecerlo como vista alternativa al cuadrante", false]],
  156: [["area='ads' ya existe en el esquema (mig 0049)", true], ["Enchufar el RAG area=ads al generador de creativos", false], ["Curar/sembrar cursos de ads", false]],
  157: [["Metodología de guion de VSL como knowledge runtime", false], ["Generador con el patrón scaffold-mako-writer", false], ["Activar /vsl-writer (sacar el stub)", false]],
  158: [["Generador de DMs (patrón writer)", false], ["Activar /dm-writer (sacar el stub)", false]],
  159: [["Scorecard de closers", false], ["Ranking por $ real + descuento (join closing×pagos)", false], ["Perfil del cierre ganado (Calendly vs cierre)", false], ["Curva de retención VSL vs cierre", false]],
  160: [["Definir features del score (VSL%, atribución, comportamiento)", false], ["Modelo de scoring predictivo", false], ["Surfacearlo en el CRM/pulso", false]],
  161: [["Conectar gasto de ads con cierre real", false], ["Presupuesto dinámico según cash disponible", false], ["Acciona sobre ads con tu OK (write a Meta)", false]],
  162: [["Variantes de VSL en el funnel", false], ["Medir por cierres reales, no solo retención", false], ["Veredicto ligado a Experimentos", false]],
  163: [["Script Analyst detecta qué mejorar del guion", false], ["Ads Writer reescribe en base a eso", false], ["Generador produce el creativo", false]],
  164: [["Infra de render (Remotion)", false], ["Plantillas de video ad", false], ["Generación en masa", false]],
  165: [["Auditar la landing/funnel contra criterios de CRO", false], ["Devolver recomendaciones accionables", false]],
  166: [["Extraer frases/objeciones/deseos de llamadas y chats", false], ["Alimentar copy y oferta con la VoC", false]],
  167: [["STT streaming de la llamada", false], ["Sugerencias en vivo al closer", false]],
  168: [["Health score de churn por cuenta", false], ["MaKo prioriza y acciona sobre la cartera", false]],
  169: [["Card de Cobranza / Revenue", false], ["Card de Contrato leído por IA", false], ["Card de Pendientes + 'IA propone, vos decidís'", false]],
  170: [["15 rutas de detalle construidas", true], ["Cargar capturas/demos por feature", false], ["Llenar TESTIMONIOS reales", false], ["Linkear las cards del grid a /vsl/<slug>", false]],
  171: [["Identificar las ~10 entradas ComingSoon", false], ["Ocultar/agrupar lo no entregado", false], ["Sacar /martinkoncke del nav", false]],
  172: [["Default sano out-of-the-box del funnel", false], ["Plantillas por tipo de negocio", false], ["Resaltar lo que el usuario suele omitir", false]],
  173: [["Reemplazar el canvas drag-to-connect", false], ["Editor simple de lista/forms", false]],
  174: [["Identidad visual MakoBrand (logo/chispa/intro)", true], ["Voz/persona rioplatense en las respuestas", true], ["Envolver los gráficos restantes en <ChartIA>", false]],
  175: [["Confirmar que ningún chat usa public/mako.svg", false], ["Eliminar el asset y referencias muertas", false]],
  176: [["Dropdown custom usado en CRM/worklist/funnel", true], ["Migrar el <select> de LeadDetail", false], ["Migrar el <select> de new lead", false]],
  177: [["Migrado en casi toda la app", true], ["Arreglar labels del inbox WhatsApp (derivarEtapa)", false], ["Arreglar textoCohorteJ1 en lib/leads.ts", false]],
  178: [["Tokens modernos + ✦ MaKo en los modales", true], ["Decidir con Martín si va el wizard completo", false], ["Convertir al patrón wizard progresivo", false]],
  179: [["getTenantDb + workspace_id NOT NULL en cada tabla (Fase 1)", true], ["Panel /admin (Clientes/Usuarios) + impersonación firmada", true], ["credWs: credenciales cifradas por workspace (Fase 2)", true], ["Crons de ingesta iteran workspaces con correrPorWorkspace (Fase 2b)", true]],
  180: [["Tabla anthropic_usage + costFor (PRICING por modelo)", true], ["chatClaude/chatClaudeTools registran tokens/costo por feature+motivo", true], ["Chip 'Saldo IA' en el sidebar + carga manual de saldo", true], ["Historial de gasto con motivo legible por operación", true]],
  181: [["Catálogo evolution_labels + evolution_stage_labels (mig 0077)", true], ["Config de mapeo etapa→label en /configuraciones", true], ["Hook fire-and-forget en updateLead/setPipelineStage", true], ["Resolver handleLabel 200-sin-aplicar (bug LID #2524)", false]],
  182: [["Migración para persistir scoreRazon/deadline del board del cliente", false], ["Extracción Fathom por cliente (key propia + fathomExtract en TodoBoard)", false], ["Reconciliar el gating rolesWs entre /plan (todo) y /experimentos", false]],
};
const buildCL = (num: number): BoardTask['checklist'] => (SEED_CL[num] ?? []).map(([text, done], i) => ({ id: `sc${num}_${i}`, text, done }));
const clProgress = (cl: BoardTask['checklist'], fallback: number) => (cl.length ? Math.round((cl.filter((c) => c.done).length / cl.length) * 100) : fallback);

// El proyecto DOER es la iniciativa impulsada por MaKo → esas tarjetas se
// atribuyen a MaKo (ícono IA + "MaKo" en el change history).
const seedTasks = (): BoardTask[] => SEED.map((d) => {
  const esIA = d[2] === 'doer';
  const checklist = buildCL(d[0]);
  return {
    id: 't' + d[0], num: d[0], title: d[1], detalle: d[5], priority: d[3], score: scoreFromPrio[d[3]], progress: clProgress(checklist, d[4]),
    deadline: '', labels: [d[2]], checklist, enPrioridad: d[6],
    origen: esIA ? 'ia' as const : 'user' as const,
    historial: [{ id: 'seed' + d[0], ts: SEED_TS, actor: esIA ? 'ia' : 'user', text: 'Creó la tarjeta' } as Hist],
  };
});

// Asegura que cada entrada de historial tenga id (localStorage viejo puede no tenerlo).
const normHist = (h: unknown[]): Hist[] => (Array.isArray(h) ? h : []).map((e) => {
  const o = (e ?? {}) as Record<string, unknown>;
  return { ...o, id: typeof o.id === 'string' && o.id ? o.id : 'h' + (Number(o.ts) || 0) } as Hist;
});
const normTask = (t: BoardTask): BoardTask => {
  // score = fuente de verdad; si el localStorage viejo no lo tiene, se deriva de la columna.
  const s = typeof t.score === 'number' && t.score > 0 ? clampScore(t.score) : scoreFromPrio[t.priority] ?? 62;
  // BACKFILL: tarea del SEED que todavía no tiene checklist → le inyectamos la escrita
  // a mano y DERIVAMOS el avance de ella (arregla los % viejos, sin pisar lo editado).
  let checklist = Array.isArray(t.checklist) ? t.checklist : [];
  let progress = t.progress;
  if (checklist.length === 0 && SEED_CL[t.num]) {
    checklist = buildCL(t.num);
    progress = clProgress(checklist, t.progress);
  }
  return { ...t, score: s, priority: prioFromScore(s), checklist, progress, historial: normHist(t.historial as unknown[]) };
};
const normLabel = (l: Label): Label => ({ ...l, score: typeof l.score === 'number' && l.score >= 1 ? Math.min(10, Math.round(l.score)) : 5, detalle: typeof l.detalle === 'string' ? l.detalle : '', scoreRazon: typeof l.scoreRazon === 'string' && l.scoreRazon.trim() ? l.scoreRazon : (SEED_RAZON[l.id] ?? undefined), historial: normHist((l.historial as unknown[]) || []) });

type OldV4 = { id: string; n: number; text: string; project: string; priority: Prio; prog?: number; detalle?: string; foco?: boolean; deadline?: string; checklist?: unknown; origen?: string; historial?: unknown };
const fromV4 = (t: OldV4): BoardTask => {
  const priority = (['alta', 'media', 'baja', 'futuro'] as string[]).includes(t.priority) ? t.priority : 'media';
  return {
    id: t.id ?? 't' + uid(), num: typeof t.n === 'number' ? t.n : 0, title: t.text ?? '', detalle: t.detalle ?? '',
    priority, score: scoreFromPrio[priority],
    progress: Math.max(0, Math.min(100, Math.round(t.prog ?? 0))), deadline: t.deadline ?? '',
    labels: t.project ? [t.project] : [], checklist: Array.isArray(t.checklist) ? t.checklist as BoardTask['checklist'] : [],
    historial: Array.isArray(t.historial) ? t.historial as Hist[] : [], origen: t.origen === 'ia' ? 'ia' : 'user', enPrioridad: !!t.foco,
  };
};

// Backfill de una vez: agrega al localStorage existente las tareas NUEVAS del SEED
// (el roadmap minado de la memoria) que todavía no estén, sin resucitar lo borrado
// (gate por versión). Bumpear la key para volver a sembrar si el SEED crece de nuevo.
const SEED_MERGE_KEY = 'mako_seed_roadmap_v1';
function mergeSeedRoadmap(tasks: BoardTask[]): BoardTask[] {
  try {
    if (localStorage.getItem(SEED_MERGE_KEY)) return tasks;
    localStorage.setItem(SEED_MERGE_KEY, '1');
    const have = new Set(tasks.map((t) => t.num));
    const faltan = seedTasks().filter((s) => !have.has(s.num));
    if (faltan.length) return [...tasks, ...faltan];
  } catch { /* no-op */ }
  return tasks;
}
function loadTasks(): BoardTask[] {
  let tasks: BoardTask[] = seedTasks();
  try {
    const v5 = localStorage.getItem(K5);
    if (v5) tasks = (JSON.parse(v5) as BoardTask[]).map(normTask);
    else { const v4 = localStorage.getItem(K4); if (v4) tasks = (JSON.parse(v4) as OldV4[]).map(fromV4).map(normTask); }
  } catch { /* seed */ }
  return mergeSeedRoadmap(tasks);
}
function loadLabels(): Label[] {
  let labels = PROJS_DEFAULT;
  try { const p = localStorage.getItem(K_PROJS); if (p) labels = (JSON.parse(p) as Label[]).map(normLabel); } catch { /* default */ }
  // Una sola vez: repartir los scores de proyecto en 1-10 SIN empatar (el guardián los
  // amontonaba/empataba). 0 tokens; después las prioridades debatidas se respetan.
  try {
    if (!localStorage.getItem('mako_proj_spread_v1') && labels.length > 1) {
      const spread = spreadProjScores(labels);
      labels = labels.map((l) => ({ ...l, score: spread[l.id] ?? l.score }));
      localStorage.setItem('mako_proj_spread_v1', '1');
    }
  } catch { /* no-op */ }
  // Una sola vez: aplicar los detalles con formato (bonitos) a los 6 proyectos del seed.
  try {
    if (!localStorage.getItem('mako_proj_detalle_v1')) {
      labels = labels.map((l) => (SEED_DETALLE[l.id] ? { ...l, detalle: SEED_DETALLE[l.id] } : l));
      localStorage.setItem('mako_proj_detalle_v1', '1');
    }
  } catch { /* no-op */ }
  return labels;
}

export function PlanBoard({ user }: { user: BoardUser }) {
  const repo: Repo = {
    labelMode: 'single', labelSingular: 'Proyecto', labelPlural: 'Proyectos',
    dismissableGauntlet: true, // TEMPORAL (solo super-admin, mientras se desarrolla)
    fathomExtract: true,       // "Extraer de una reunión" (G3) — usa la Fathom key de la agencia

    createTask: async (d) => d, saveTask: async () => {}, deleteTask: async () => {},
    createLabel: async (l) => l, saveLabel: async () => {}, deleteLabel: async () => {},
  };
  const board = useBoard([], [], user, repo);
  const [hydrated, setHydrated] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { board.reset(loadTasks(), loadLabels()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K5, JSON.stringify(board.tasks)); } catch { /* no-op */ } }, [board.tasks, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(K_PROJS, JSON.stringify(board.labels)); } catch { /* no-op */ } }, [board.labels, hydrated]);

  if (!hydrated) return <main style={{ flex: 1 }} />;
  return <BoardShell board={board} />;
}
