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

function loadTasks(): BoardTask[] {
  try {
    const v5 = localStorage.getItem(K5);
    if (v5) return (JSON.parse(v5) as BoardTask[]).map(normTask);
    const v4 = localStorage.getItem(K4);
    if (v4) return (JSON.parse(v4) as OldV4[]).map(fromV4).map(normTask);
  } catch { /* seed */ }
  return seedTasks();
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
