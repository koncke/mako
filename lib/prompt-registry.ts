// =============================================================================
// prompt-registry — única fuente de verdad de TODOS los prompts editables
// =============================================================================
// Lista cada prompt "impuesto en código" con su contexto, sus variables (slots
// {{...}} para los dinámicos) y su default. La resolución (valor vigente, guardar,
// restaurar, volver al default) se rutea según la fuente del prompt:
//   - 'persona' / 'modo' → store existente de lib/mako-prompts (con historial)
//   - 'fase'             → app_settings 'mako.fase.*' (sin historial, default vacío)
//   - 'override'         → store nuevo de lib/prompt-render (con historial)
// Lo usa solo la ruta /api/mako/config-prompts (server). Nada de esto cambia el
// comportamiento si no se edita: cada default es idéntico al texto original.
// =============================================================================

import 'server-only';

import {
  getPrompts as getModoPrompts,
  savePrompt as saveModoPrompt,
  restorePrompt as restoreModoPrompt,
  resetPrompt as resetModoPrompt,
} from './mako-prompts';
import { MAKO_NUCLEO } from './mako-prompts';
import { FASES, getFases, setFase } from './mako-fases';
import {
  readOverrideStore,
  savePromptOverride,
  restorePromptOverride,
  resetPromptOverride,
  type PromptVersion,
  type OverrideStore,
} from './prompt-render';

// Defaults de prompts grandes (viven en su archivo de origen) ──────────────────
import { SYSTEM_ANALISIS, CLOSING_USER_TEMPLATE } from './closing';
import {
  SCRIPT_ANALYSIS_SYSTEM_TEMPLATE,
  SCRIPT_ANALYSIS_USER_TEMPLATE,
  SCRIPT_VALORACION_SYSTEM_TEMPLATE,
  SCRIPT_VALORACION_USER_TEMPLATE,
} from './script-analyst';
import { TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE, TEMPLATE_VALIDATOR_USER_TEMPLATE } from './template-validator';
import { LEAD_INSIGHTS_SYSTEM_TEMPLATE, LEAD_INSIGHTS_USER_TEMPLATE } from './lead-insights';
import {
  WA_ADVISOR_SYSTEM_TEMPLATE,
  WA_ADVISOR_RECOMMEND_USER_TEMPLATE,
  WA_ADVISOR_TEMPLATE_SYSTEM_TEMPLATE,
  WA_ADVISOR_TEMPLATE_USER_TEMPLATE,
} from './whatsapp-advisor';
import { META_RULES_TEXT, VALIDATOR_RUBRIC } from './meta-rules';
import { ONBOARDING_EXTRACT_TEMPLATE } from './onboarding';
import { STRUCTURE_SYSTEM_BASE, IMAGE_PROMPT_BASE } from './transcribe';
import {
  CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE,
  CAMPAIGN_SUGGEST_USER_TEMPLATE,
  CAMPAIGN_ADJUST_SYSTEM_TEMPLATE,
  CAMPAIGN_ADJUST_USER_TEMPLATE,
} from './campaign-structurer';
// Defaults de fragmentos cortos ───────────────────────────────────────────────
import {
  CHART_PROMPT_ANALISIS_DEFAULT,
  CHART_PROMPT_SALUDO_DEFAULT,
  CHART_TITULO_DEFAULT,
  MAKO_CTX_GENERAL_DEFAULT,
  MAKO_CTX_CHART_DEFAULT,
  MAKO_CTX_WHATSAPP_DEFAULT,
  CONTRACT_EXTRACT_DEFAULT,
  RECEIPT_EXTRACT_DEFAULT,
} from './prompt-defaults';

export type PromptSource = 'persona' | 'modo' | 'fase' | 'override';
export type PromptScope = 'full' | 'static-only';
export type PromptVar = { name: string; desc: string };

type Entry = {
  key: string;            // id estable (lo usa la UI y, en 'override', el store)
  storeKey?: string;      // clave en el store legacy (persona/modo/fase)
  label: string;
  context: string;        // explicación para el usuario (qué hace, qué cuidar)
  kind: string;           // system | user | instruction | whisper | vision
  dynamic: boolean;       // ¿interpola datos en runtime?
  variables: PromptVar[]; // slots {{...}} disponibles (vacío si estático)
  scope: PromptScope;     // full | static-only
  sensitive: boolean;     // mostrar advertencia (define JSON / es baranda)
  source: PromptSource;
  default: string;        // texto default (para 'override' y para preview de reset)
  placeholder?: string;   // sugerencia de UI (fases: el "ejemplo", default real es vacío)
};

type Group = { group: string; icon: string; blurb: string; entries: Entry[] };

// Atajos para variables comunes.
const v = (name: string, desc: string): PromptVar => ({ name, desc });

export const REGISTRY: Group[] = [
  {
    group: 'Persona y voz de MaKo',
    icon: '🎭',
    blurb: 'La voz, el tono y las reglas de estilo del consultor IA que habla en todo el dashboard.',
    entries: [
      {
        key: 'mako.persona', storeKey: 'persona', source: 'persona',
        label: 'Persona / voz de MaKo', kind: 'system', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: '',
        context: 'La personalidad base de MaKo: cómo se presenta, el voseo rioplatense, el tono directo y en qué cree. Va al principio de CADA respuesta de MaKo en todo el dashboard (chat de gráficos, secuencias, etc.). Si lo editás, cambiás de cuajo cómo suena MaKo en todos lados.',
      },
      {
        key: 'mako.nucleo', source: 'override',
        label: 'Núcleo de formato y tono (reglas duras)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: MAKO_NUCLEO,
        context: 'Las barandas de formato que MaKo respeta siempre: primer mensaje breve, nunca terminar con una pregunta, no inventar datos, usar negritas/viñetas con criterio. Acompaña a la persona en cada respuesta. Editarlo mal puede hacer que MaKo se desvíe (muros de texto, terminar preguntando, inventar).',
      },
    ],
  },
  {
    group: 'Secciones del dashboard (qué mira MaKo en cada vista)',
    icon: '🧭',
    blurb: 'Una instrucción por sección que le dice a MaKo en qué enfocarse cuando analiza esa parte del negocio. Vacío = se comporta de forma genérica.',
    entries: FASES.map((f) => ({
      key: `mako.fase.${f.key}`, storeKey: f.key, source: 'fase' as const,
      label: `Sección ${f.label}`, kind: 'instruction', dynamic: false, variables: [], scope: 'full' as const, sensitive: false,
      default: '', placeholder: f.ejemplo,
      context: `Le dice a MaKo en qué enfocarse cuando analiza un gráfico de la sección ${f.label}. Si lo dejás vacío, MaKo no recibe instrucción de sección y se comporta de forma genérica ahí.`,
    })),
  },
  {
    group: 'Modos del consultor MaKo',
    icon: '🎛️',
    blurb: 'Instrucciones de "sombrero" (analista, comparador, etc.) ya editables. Todavía no están cableadas al chat, así que editarlas no cambia nada visible aún.',
    entries: [
      { key: 'mako.modo.analista', storeKey: 'analista', source: 'modo', label: 'Modo Analista', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "analista": mirá el dato, encontrá la causa, dale el próximo paso, números antes que opiniones. Aún no está cableado al chat.' },
      { key: 'mako.modo.comparador', storeKey: 'comparador', source: 'modo', label: 'Modo Comparador', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "comparador": contrastá períodos, anuncios o cohortes y resaltá qué cambió y por qué importa. Aún no está cableado al chat.' },
      { key: 'mako.modo.guiones', storeKey: 'guiones', source: 'modo', label: 'Modo Guiones / VSL', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "guiones": analizá el creativo (hook, oferta, CTA) y proponé mejoras al guion o al VSL. Aún no está cableado al chat.' },
      { key: 'mako.modo.consultor', storeKey: 'consultor', source: 'modo', label: 'Modo Consultor', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "consultor": pensá en orden (oferta → adquisición → sistematización → escala) y decí qué tocar primero. Aún no está cableado al chat.' },
      { key: 'mako.modo.closer', storeKey: 'closer', source: 'modo', label: 'Modo Leads / Closer', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "closer": por qué un lead está trabado y qué decir/hacer en la próxima llamada para avanzarlo. Aún no está cableado al chat.' },
    ],
  },
  {
    group: 'Chat de gráficos (MaKo)',
    icon: '💬',
    blurb: 'Cómo arranca cada conversación con MaKo sobre un gráfico y los textos que encuadran su system prompt.',
    entries: [
      {
        key: 'chart_insights.prompt_analisis', source: 'override',
        label: 'Primer mensaje cuando hay gráfico', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: CHART_PROMPT_ANALISIS_DEFAULT,
        context: 'El mensaje que la app le manda a MaKo apenas abrís un chat sobre un gráfico. Define que la primera respuesta sea un insight corto (2-4 líneas) y no un resumen completo.',
      },
      {
        key: 'chart_insights.prompt_saludo', source: 'override',
        label: 'Primer mensaje sin gráfico (saludo)', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: CHART_PROMPT_SALUDO_DEFAULT,
        context: 'El mensaje de arranque cuando abrís un chat general sin datos de gráfico: MaKo se presenta y dice en qué ayuda.',
      },
      {
        key: 'chart_insights.titulo_generation', source: 'override',
        label: 'Generador de título de la sesión', kind: 'system', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: CHART_TITULO_DEFAULT,
        context: 'Después de la primera respuesta, la app le pide a MaKo (modo barato, sin razonamiento) un título corto para nombrar el chat. Si falla, el chat simplemente queda sin título.',
      },
      {
        key: 'mako.context.general_fallback', source: 'override',
        label: 'Encuadre: chat general (sin gráfico)', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: MAKO_CTX_GENERAL_DEFAULT,
        context: 'Frase que se agrega al final del system prompt cuando NO hay datos de gráfico, para encuadrar el chat libre.',
      },
      {
        key: 'mako.context.chart_standard', source: 'override',
        label: 'Encuadre: hay gráfico (con datos)', kind: 'instruction', dynamic: true,
        variables: [v('titulo', 'nombre del gráfico'), v('contexto', 'los datos del gráfico (recortados)')], scope: 'full', sensitive: false,
        default: MAKO_CTX_CHART_DEFAULT,
        context: 'Frase que encuadra a MaKo cuando SÍ hay datos del gráfico. No borres los slots {{titulo}} y {{contexto}} o MaKo se queda sin saber qué gráfico mira ni con qué datos.',
      },
      {
        key: 'mako.context.whatsapp_consultor', source: 'override',
        label: 'Modo consultor de WhatsApp (secuencias)', kind: 'instruction', dynamic: false, variables: [], scope: 'static-only', sensitive: false,
        default: MAKO_CTX_WHATSAPP_DEFAULT,
        context: 'Cuando entrás al chat de "whatsapp-secuencias", MaKo se vuelve consultor de WhatsApp. Esta es la instrucción de encuadre; las reglas de Meta y el estado real de tus secuencias se inyectan automáticamente después.',
      },
    ],
  },
  {
    group: 'Conocimiento y reglas que MaKo usa',
    icon: '📚',
    blurb: 'Las reglas de Meta que se le inyectan al validador de plantillas y a MaKo en el chat de secuencias.',
    entries: [
      {
        key: 'meta.rules.text', source: 'override',
        label: 'Reglas de Meta para plantillas de WhatsApp', kind: 'instruction', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: META_RULES_TEXT,
        context: 'Base de conocimiento (categorías, formato, variables, motivos de rechazo) compilada de la documentación oficial de Meta. Se inyecta al validador de plantillas Y al chat de secuencias (un cambio acá afecta ambos). Editarla mal puede hacer que el validador apruebe plantillas que Meta rechaza.',
      },
      {
        key: 'meta.rules.rubric', source: 'override',
        label: 'Rúbrica de riesgo de rechazo (Meta)', kind: 'instruction', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: VALIDATOR_RUBRIC,
        context: 'La checklist que el validador aplica al pie de la letra para decir si una plantilla tiene riesgo ALTO/MEDIO/BAJO. Define códigos (B1, S4, M3…) que después aparecen citados en los hallazgos. Si cambiás los códigos, cambia lo que se cita.',
      },
    ],
  },
  {
    group: 'Validador de plantillas de WhatsApp',
    icon: '✅',
    blurb: 'El auditor que predice si Meta va a aprobar o rechazar una plantilla antes de mandarla.',
    entries: [
      {
        key: 'template_validator.system', source: 'override',
        label: 'Auditor de plantillas (system)', kind: 'system', dynamic: true,
        variables: [v('metaRules', 'reglas de Meta (editables aparte)'), v('rubric', 'rúbrica de riesgo (editable aparte)'), v('vars', 'variables del lead que la app sabe rellenar')], scope: 'static-only', sensitive: true,
        default: TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE,
        context: 'Pone a Claude como auditor que predice si Meta aprobará o rechazará una plantilla y propone una corregida. Define la forma EXACTA del JSON de respuesta. No borres los slots {{metaRules}}/{{rubric}}/{{vars}} ni cambies el esquema del JSON o la pantalla de resultados deja de mostrar los hallazgos.',
      },
      {
        key: 'template_validator.user', source: 'override',
        label: 'Entrada de la plantilla a validar', kind: 'user', dynamic: true,
        variables: [v('entrada', 'borrador de plantilla en JSON')], scope: 'full', sensitive: false,
        default: TEMPLATE_VALIDATOR_USER_TEMPLATE,
        context: 'Le pasa al auditor el borrador a evaluar como JSON. Casi no hay nada que editar; si lo tocás, mantené el slot {{entrada}} y el pedido de devolver JSON.',
      },
    ],
  },
  {
    group: 'Asesor de WhatsApp (MaKo · Levanta Muertos)',
    icon: '💬',
    blurb: 'MaKo lee la conversación real con un lead y recomienda qué escribirle (metodología Levanta Muertos) o redacta una plantilla de Meta. La metodología sale del conocimiento con área "mensajes".',
    entries: [
      {
        key: 'wa.advisor.system', source: 'override',
        label: 'Asesor de mensajes (system)', kind: 'system', dynamic: true,
        variables: [v('metodologia', 'metodología de mensajes cargada en Conocimiento (area=mensajes)'), v('metaRules', 'reglas de entrega de Meta (editables aparte)')], scope: 'static-only', sensitive: true,
        default: WA_ADVISOR_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo como asesor de reactivación por WhatsApp: le inyecta la metodología (Levanta Muertos y lo que cargues en Conocimiento con área "mensajes") y las reglas de la ventana de 24h de Meta. No borres los slots {{metodologia}}/{{metaRules}}. Acompaña tanto a las recomendaciones como al chat del lead.',
      },
      {
        key: 'wa.advisor.recommend.user', source: 'override',
        label: 'Pedido de recomendaciones (user)', kind: 'user', dynamic: true,
        variables: [v('lead', 'nombre/empresa del lead'), v('etapa', 'etapa del funnel'), v('ventana', 'estado de la ventana de 24h'), v('transcript', 'la conversación real con el lead')], scope: 'static-only', sensitive: true,
        default: WA_ADVISOR_RECOMMEND_USER_TEMPLATE,
        context: 'Le pasa a MaKo la conversación real y le pide 2-3 mensajes listos para enviar en JSON (diagnóstico + sugerencias con ángulo/tono). No borres los slots ni el esquema del JSON o el panel de WhatsApp deja de poder mostrar las sugerencias.',
      },
      {
        key: 'wa.advisor.template.system', source: 'override',
        label: 'Redactor de plantillas Levanta Muertos (system)', kind: 'system', dynamic: true,
        variables: [v('metodologia', 'metodología de mensajes'), v('metaRules', 'reglas de Meta'), v('vars', 'variables del lead que la app sabe rellenar')], scope: 'static-only', sensitive: true,
        default: WA_ADVISOR_TEMPLATE_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a redactar una plantilla de WhatsApp que sigue Levanta Muertos Y pasa la revisión de Meta. No borres los slots {{metodologia}}/{{metaRules}}/{{vars}}.',
      },
      {
        key: 'wa.advisor.template.user', source: 'override',
        label: 'Pedido de plantilla (user)', kind: 'user', dynamic: true,
        variables: [v('objetivo', 'objetivo de la plantilla'), v('etapa', 'etapa del lead a la que apunta'), v('contexto', 'perfil del negocio')], scope: 'full', sensitive: false,
        default: WA_ADVISOR_TEMPLATE_USER_TEMPLATE,
        context: 'Le pasa a MaKo el objetivo y la etapa para redactar la plantilla, y le pide el JSON con name/category/body/footer/variables. Mantené el esquema del JSON.',
      },
    ],
  },
  {
    group: 'Análisis de llamadas de cierre (Closing Analyst)',
    icon: '📞',
    blurb: 'MaKo escucha las grabaciones de venta y entrega, las clasifica y puntúa al closer con citas del transcript.',
    entries: [
      {
        key: 'closing.analyze.system', source: 'override',
        label: 'Instrucciones de análisis de cierres (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: SYSTEM_ANALISIS,
        context: 'El cerebro del Closing Analyst: cómo clasificar la llamada (Venta R1/R2 vs Entrega de servicio vs Interna), cómo puntuar SPIN y ejecución del 0 al 10, y la forma EXACTA del JSON de salida (con citas que llevan el segundo del transcript). Conservá las categorías de clasificación, los nombres de dimensión SPIN/ejecución y el esquema JSON o el análisis se rompe.',
      },
      {
        key: 'closing.analyze.user', source: 'override',
        label: 'Datos de la llamada (user)', kind: 'user', dynamic: true,
        variables: [v('metadatos', 'título/fecha/duración/host'), v('leadCtx', 'contexto del lead en el CRM'), v('summary', 'resumen de Fathom'), v('actions', 'action items'), v('transcript', 'transcript con segundos'), v('feedbackBlock', 'revisión humana (si la hay)')], scope: 'full', sensitive: false,
        default: CLOSING_USER_TEMPLATE,
        context: 'Arma el pedido con todo lo de la llamada. Si alguien revisa la llamada y deja un comentario, se inyecta en {{feedbackBlock}} para que MaKo reanalice. Conservá los slots; sin ellos MaKo pierde el contexto.',
      },
    ],
  },
  {
    group: 'Insights del lead (ficha del CRM)',
    icon: '🔎',
    blurb: 'MaKo junta TODO lo que se sabe de un lead (reuniones, forms, llamadas, chat, anuncio, tracking, cobranza) y genera un análisis comercial accionable en la tab Insights.',
    entries: [
      {
        key: 'lead_insights.system', source: 'override',
        label: 'Instrucciones de insights del lead (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: LEAD_INSIGHTS_SYSTEM_TEMPLATE,
        context: 'El cerebro del botón "Generar insights" de la ficha del lead: qué priorizar (dolor, señales de compra, objeciones, próxima acción) y la forma EXACTA del JSON de salida. Conservá el esquema JSON o la ficha no puede mostrar el análisis.',
      },
      {
        key: 'lead_insights.user', source: 'override',
        label: 'Datos del lead (user)', kind: 'user', dynamic: true,
        variables: [v('hoy', 'fecha de hoy'), v('etapa', 'etapa actual del pipeline'), v('ficha', 'datos del CRM'), v('reuniones', 'R1/R2 y asistencias'), v('respuestas', 'forms de Calendly'), v('llamadas', 'análisis de Fathom'), v('chat', 'mensajes de WhatsApp'), v('anuncio', 'transcript del ad de origen'), v('tracking', 'landing/VSL'), v('deal', 'cobranza y servicio')], scope: 'full', sensitive: false,
        default: LEAD_INSIGHTS_USER_TEMPLATE,
        context: 'Arma el pedido con todas las fuentes del lead. Conservá los slots; sin ellos MaKo pierde contexto y el análisis empeora.',
      },
    ],
  },
  {
    group: 'Análisis y valoración de guiones de ads (Script Analyst)',
    icon: '🎬',
    blurb: 'MaKo lee guiones de video ads, los disecciona en bloques y valora guiones nuevos contra lo que ya rinde.',
    entries: [
      {
        key: 'script_analyst.analysis.system', source: 'override',
        label: 'Anatomía del guion (system)', kind: 'system', dynamic: true,
        variables: [v('angleBullets', 'lista de ángulos vigentes (clave: desc)'), v('anglePipe', 'ángulos separados por |')], scope: 'static-only', sensitive: true,
        default: SCRIPT_ANALYSIS_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a leer el guion de un video ad y devolver su anatomía (clasificar, partir en bloques, diagnosticar) sin inventar métricas. No cambies los vocabularios cerrados (hook_type, tags, beats) ni el esquema JSON o el guardado se rompe. Conservá los slots {{angleBullets}} y {{anglePipe}}.',
      },
      {
        key: 'script_analyst.analysis.user', source: 'override',
        label: 'Datos del anuncio + transcript (user)', kind: 'user', dynamic: true,
        variables: [v('ad_name', 'nombre del anuncio'), v('tipo', 'tipo de creativo'), v('idioma', 'idioma'), v('duracion', 'duración del video'), v('cuerpo', 'el guion (secciones o transcript)')], scope: 'full', sensitive: false,
        default: SCRIPT_ANALYSIS_USER_TEMPLATE,
        context: 'Le pasa a MaKo los datos del anuncio y el texto del guion. Mantené el bloque de metadatos, el {{cuerpo}} y el pedido final del JSON.',
      },
      {
        key: 'script_analyst.valoracion.system', source: 'override',
        label: 'Valoración de guion nuevo (system)', kind: 'system', dynamic: true,
        variables: [v('anglePipe', 'ángulos separados por |')], scope: 'static-only', sensitive: true,
        default: SCRIPT_VALORACION_SYSTEM_TEMPLATE,
        context: 'Cuando subís un guion que TODAVÍA no corrió en Meta, compara contra el perfil real de la cuenta y predice un veredicto (escalar / mejorar gancho / reescribir cuerpo / repensar ángulo / promesa-pero-validar). Conservá las opciones de veredicto y el esquema JSON.',
      },
      {
        key: 'script_analyst.valoracion.user', source: 'override',
        label: 'Guion nuevo + perfil de la cuenta (user)', kind: 'user', dynamic: true,
        variables: [v('duracion', 'duración estimada'), v('guion', 'el guion nuevo'), v('perfil', 'perfil real de la cuenta en JSON')], scope: 'full', sensitive: false,
        default: SCRIPT_VALORACION_USER_TEMPLATE,
        context: 'Le pasa a MaKo el guion nuevo y el perfil real de la cuenta en JSON, y le pide valorar uno contra el otro. Mantené los slots y el pedido final del JSON.',
      },
    ],
  },
  {
    group: 'Creador de campañas (Ads Manager · Nueva campaña)',
    icon: '🚀',
    blurb: 'MaKo propone la estructura de una campaña nueva (objetivo, conjuntos, anuncios, segmentación) a partir de tu funnel y tus datos, y la ajusta con tus pedidos. Todo se publica en PAUSA.',
    entries: [
      {
        key: 'campaign.suggest.system', source: 'override',
        label: 'Propuesta de campaña (system)', kind: 'system', dynamic: true,
        variables: [v('metodologia', 'método de estructura/escala (intención + ritmo)'), v('objetivos', 'objetivos disponibles y su optimización'), v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a proponer la estructura de una campaña nueva (campaña → conjuntos → anuncios) eligiendo el objetivo según el funnel. Define la forma EXACTA del JSON. No borres los slots {{metodologia}}/{{objetivos}}/{{jsonShape}} ni cambies el esquema del JSON o el modal de revisión deja de poder leer la propuesta.',
      },
      {
        key: 'campaign.suggest.user', source: 'override',
        label: 'Pedido + contexto del negocio (user)', kind: 'user', dynamic: true,
        variables: [v('prompt', 'lo que pidió el usuario'), v('creativos', 'creativos provistos (subidos o ganador elegido)'), v('contexto', 'funnel + perfil + KPIs + ganadores + presupuesto')], scope: 'full', sensitive: false,
        default: CAMPAIGN_SUGGEST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el pedido del usuario, los creativos y el contexto real del negocio. Conservá los slots {{prompt}}/{{creativos}}/{{contexto}} y el pedido final del JSON.',
      },
      {
        key: 'campaign.adjust.system', source: 'override',
        label: 'Ajuste de campaña (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: CAMPAIGN_ADJUST_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario pide cambios a una campaña ya propuesta, MaKo aplica SOLO lo pedido y conserva el resto. Conservá el slot {{jsonShape}} y el esquema del JSON.',
      },
      {
        key: 'campaign.adjust.user', source: 'override',
        label: 'Spec actual + cambio pedido (user)', kind: 'user', dynamic: true,
        variables: [v('specActual', 'el CampaignSpec actual en JSON'), v('instruccion', 'el cambio que pide el usuario'), v('contexto', 'contexto del negocio')], scope: 'full', sensitive: false,
        default: CAMPAIGN_ADJUST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el spec actual y el cambio pedido. Mantené los slots {{specActual}}/{{instruccion}}/{{contexto}} y el pedido de devolver el JSON completo.',
      },
    ],
  },
  {
    group: 'Transcripción y estructura de anuncios',
    icon: '🎙️',
    blurb: 'Convierte videos e imágenes de ads en texto y lo parte en bloques (Hook, Oferta, CTA…).',
    entries: [
      {
        key: 'transcribe.whisper.prompt', source: 'override',
        label: 'Glosario para la transcripción (Whisper)', kind: 'whisper', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: '',
        context: 'Glosario global opcional que sesga cómo Whisper escribe nombres y términos (ej.: "el producto se llama Marketing Koncept, no marketing concept"). Si está vacío, no se manda nada. Una instrucción puntual de un anuncio tiene prioridad sobre este glosario.',
      },
      {
        key: 'transcribe.structure.system', source: 'override',
        label: 'Partir el guion en secciones (GPT-4o-mini)', kind: 'system', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: STRUCTURE_SYSTEM_BASE,
        context: 'Toma la transcripción del video y la divide en secciones con títulos cortos (Hook, Problema, Oferta, CTA…) repartiendo el texto LITERAL, sin resumir, y devuelve JSON. Conservá el pedido de JSON {"secciones":[{"titulo","texto"}]} y la regla de no inventar/no resumir.',
      },
      {
        key: 'transcribe.analyze_image.user', source: 'override',
        label: 'Análisis de imagen del anuncio (GPT-4o visión)', kind: 'vision', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: IMAGE_PROMPT_BASE,
        context: 'Cuando el anuncio es imagen (no video), transcribe TODO el texto visible literal, describe lo que se ve y parte el mensaje en secciones, devolviendo JSON. Conservá el esquema JSON {"texto","descripcion","secciones"} o el guardado se rompe.',
      },
    ],
  },
  {
    group: 'Extracción de documentos (onboarding y contratos)',
    icon: '📄',
    blurb: 'Lee documentos subidos y autocompleta el onboarding y el plan de pagos del CRM.',
    entries: [
      {
        key: 'onboarding.extract.system', source: 'override',
        label: 'Extractor de campos del onboarding', kind: 'system', dynamic: true,
        variables: [v('lista', 'los campos pedidos (clave: qué pide)')], scope: 'static-only', sensitive: true,
        default: ONBOARDING_EXTRACT_TEMPLATE,
        context: 'Lee un documento del cliente y completa los campos del onboarding (oferta, avatar, marca), devolviendo JSON. Regla clave: si un dato no aparece, lo omite (NO inventa). Conservá el formato JSON {"campos":{…}}, el slot {{lista}} y la regla de "no inventar".',
      },
      {
        key: 'contracts.extract_payment_plan.user', source: 'override',
        label: 'Extractor del contrato (pagos + Deal Details)', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: CONTRACT_EXTRACT_DEFAULT,
        context: 'Lee un contrato (PDF o imagen) y saca el plan de pagos (total USD, duración, fechas, cuotas) más las secciones del Deal Details (datos fiscales, servicio, promesa, obligaciones), resumidas en lenguaje simple, en JSON. Solo rellena campos VACÍOS del lead; nunca pisa lo cargado. Conservá la forma EXACTA del JSON o el autollenado del CRM se rompe.',
      },
      {
        key: 'contracts.extract_receipt.user', source: 'override',
        label: 'Extractor de comprobantes de pago', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: RECEIPT_EXTRACT_DEFAULT,
        context: 'Lee un comprobante de pago (imagen o PDF) y saca monto en USD, fecha y hora en JSON, para prellenar el pop-up de "Marcar pagada" de una cuota. Conservá la forma EXACTA del JSON o el prellenado se rompe.',
      },
    ],
  },
];

// ── Vista resuelta para la UI ────────────────────────────────────────────────

export type PromptView = {
  key: string;
  label: string;
  context: string;
  kind: string;
  dynamic: boolean;
  variables: PromptVar[];
  scope: PromptScope;
  sensitive: boolean;
  source: PromptSource;
  hasHistory: boolean;       // las fases no tienen historial de versiones
  placeholder?: string;
  current: string;
  isDefault: boolean;
  versions: PromptVersion[];
};
export type PromptGroupView = { group: string; icon: string; blurb: string; prompts: PromptView[] };

const ALL = REGISTRY.flatMap((g) => g.entries);
const byKey = new Map(ALL.map((e) => [e.key, e] as const));

/** Resuelve el valor vigente, isDefault y versiones de cada prompt para la UI. */
export async function getAllPrompts(): Promise<PromptGroupView[]> {
  const [modos, fases, overrides] = await Promise.all([
    getModoPrompts().catch(() => []),
    getFases().catch(() => ({} as Record<string, string>)),
    readOverrideStore().catch((): OverrideStore => ({})),
  ]);
  const modoByKey = new Map(modos.map((m) => [m.key, m] as const));

  const resolve = (e: Entry): PromptView => {
    const base = {
      key: e.key, label: e.label, context: e.context, kind: e.kind, dynamic: e.dynamic,
      variables: e.variables, scope: e.scope, sensitive: e.sensitive, source: e.source, placeholder: e.placeholder,
    };
    if (e.source === 'persona' || e.source === 'modo') {
      const m = modoByKey.get(e.storeKey ?? '');
      return { ...base, hasHistory: true, current: m?.current ?? e.default, isDefault: m?.isDefault ?? true, versions: m?.versions ?? [] };
    }
    if (e.source === 'fase') {
      const val = fases[e.storeKey ?? ''] ?? '';
      return { ...base, hasHistory: false, current: val, isDefault: val.trim() === '', versions: [] };
    }
    // override
    const o = overrides[e.key];
    return { ...base, hasHistory: true, current: o?.current ?? e.default, isDefault: !o, versions: o?.versions ?? [] };
  };

  return REGISTRY.map((g) => ({ group: g.group, icon: g.icon, blurb: g.blurb, prompts: g.entries.map(resolve) }));
}

// ── Mutaciones ruteadas por fuente ───────────────────────────────────────────

export async function savePromptByKey(key: string, text: string): Promise<void> {
  const e = byKey.get(key);
  if (!e) throw new Error(`prompt desconocido: ${key}`);
  if (e.source === 'persona' || e.source === 'modo') return saveModoPrompt(e.storeKey ?? key, text);
  if (e.source === 'fase') return setFase(e.storeKey ?? key, text);
  return savePromptOverride(key, text, e.default);
}

export async function restorePromptByKey(key: string, ts: string): Promise<void> {
  const e = byKey.get(key);
  if (!e) throw new Error(`prompt desconocido: ${key}`);
  if (e.source === 'persona' || e.source === 'modo') return restoreModoPrompt(e.storeKey ?? key, ts);
  if (e.source === 'fase') return; // las fases no tienen historial
  return restorePromptOverride(key, ts);
}

export async function resetPromptByKey(key: string): Promise<void> {
  const e = byKey.get(key);
  if (!e) throw new Error(`prompt desconocido: ${key}`);
  if (e.source === 'persona' || e.source === 'modo') return resetModoPrompt(e.storeKey ?? key);
  if (e.source === 'fase') return setFase(e.storeKey ?? key, '');
  return resetPromptOverride(key);
}
