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
import { ENTREGA_SYSTEM_TEMPLATE, ENTREGA_USER_TEMPLATE } from './closing-entrega-contrato';
import { PROPUESTA_SYSTEM_TEMPLATE, PROPUESTA_USER_TEMPLATE } from './curso-propuesta';
import {
  SCRIPT_ANALYSIS_SYSTEM_TEMPLATE,
  SCRIPT_ANALYSIS_USER_TEMPLATE,
  SCRIPT_VALORACION_SYSTEM_TEMPLATE,
  SCRIPT_VALORACION_USER_TEMPLATE,
} from './ads-analyst';
import { LANDING_ANALYZE_SYSTEM_TEMPLATE, LANDING_ANALYZE_USER_TEMPLATE } from './landing-analyst';
import { PRODUCTOS_SYSTEM_TEMPLATE, PRODUCTOS_USER_TEMPLATE } from './productos-ia';
import { OFERTAS_SYSTEM_TEMPLATE, OFERTAS_USER_TEMPLATE } from './ofertas-ia';
import {
  OFFER_TURNO_SYSTEM_TEMPLATE, OFFER_TURNO_USER_TEMPLATE,
  OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE, OFFER_DIAGNOSTICO_USER_TEMPLATE,
  OFFER_PROPUESTA_SYSTEM_TEMPLATE, OFFER_PROPUESTA_USER_TEMPLATE,
} from './offer-ia';
import { EMAIL_GEN_SYSTEM_TEMPLATE } from '@/app/api/email/generar/route';
import {
  LANDING_SUGGEST_SYSTEM_TEMPLATE,
  LANDING_SUGGEST_USER_TEMPLATE,
  LANDING_ADJUST_SYSTEM_TEMPLATE,
  LANDING_ADJUST_USER_TEMPLATE,
} from './landing-writer';
import {
  ESQUEMA_SYSTEM_TEMPLATE as LANDING_EDITOR_ESQUEMA_SYSTEM, ESQUEMA_USER_TEMPLATE as LANDING_EDITOR_ESQUEMA_USER,
  SECCIONES_SYSTEM_TEMPLATE as LANDING_EDITOR_SECCIONES_SYSTEM, SECCIONES_USER_TEMPLATE as LANDING_EDITOR_SECCIONES_USER,
  EDITAR_SYSTEM_TEMPLATE as LANDING_EDITOR_EDITAR_SYSTEM, EDITAR_USER_TEMPLATE as LANDING_EDITOR_EDITAR_USER,
  TEXTO_SYSTEM_TEMPLATE as LANDING_EDITOR_TEXTO_SYSTEM, TEXTO_USER_TEMPLATE as LANDING_EDITOR_TEXTO_USER,
  DISENOS_SYSTEM_TEMPLATE as LANDING_EDITOR_DISENOS_SYSTEM, DISENOS_USER_TEMPLATE as LANDING_EDITOR_DISENOS_USER,
  NOTAS_SYSTEM_TEMPLATE as LANDING_EDITOR_NOTAS_SYSTEM, NOTAS_USER_TEMPLATE as LANDING_EDITOR_NOTAS_USER,
} from './editor-landing/ia-reglas';
import { TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE, TEMPLATE_VALIDATOR_USER_TEMPLATE } from './template-validator';
import { SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE, SETTING_CRITERIO_TEMPLATE } from './setting-secuencias';
import { SETTING_SIMULADOR_SYSTEM_TEMPLATE } from './setting-simulador';
import { SETTING_ENSAYO_SYSTEM_TEMPLATE } from '@/app/api/chat-agent/onboarding/ensayo/route';
import { VOZ_SEGMENTAR_TEMPLATE, VOZ_ANALISIS_SYSTEM_TEMPLATE, VOZ_ANALISIS_USER_TEMPLATE, VOZ_PREGUNTAS_TEMPLATE } from './chat-agent-voz';
import { VARIANTES_SYSTEM_TEMPLATE } from './secuencias-variantes';
import { PASO_IA_SYSTEM_TEMPLATE } from './paso-ia';
import { GUION_PASO_SYSTEM_TEMPLATE } from './guion-audio';
import { CREAR_IA_SYSTEM_TEMPLATE, EDITAR_IA_SYSTEM_TEMPLATE } from './flujo-ia';
import { ARMAR_AI_STEP_SYSTEM_TEMPLATE } from './ai-step-armar';
import { OBJECIONES_SYSTEM_TEMPLATE } from './ai-step-ensayo';
import { HOJA_IA_SYSTEM_TEMPLATE } from './graficos-ia';
import { ANALISTA_SYSTEM_TEMPLATE } from './graficos-analisis';
import { LEAD_INSIGHTS_SYSTEM_TEMPLATE, LEAD_INSIGHTS_USER_TEMPLATE } from './lead-insights';
import {
  WA_ADVISOR_SYSTEM_TEMPLATE,
  WA_ADVISOR_RECOMMEND_USER_TEMPLATE,
  WA_ADVISOR_TEMPLATE_SYSTEM_TEMPLATE,
  WA_ADVISOR_TEMPLATE_USER_TEMPLATE,
} from './whatsapp-advisor';
import { META_RULES_TEXT, VALIDATOR_RUBRIC } from './meta-rules';
import { ONBOARDING_EXTRACT_TEMPLATE, ARCHIVERO_EXTRACT_TEMPLATE } from './onboarding';
import { STRUCTURE_SYSTEM_BASE, IMAGE_PROMPT_BASE } from './transcribe';
import {
  CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE,
  CAMPAIGN_SUGGEST_USER_TEMPLATE,
  CAMPAIGN_ADJUST_SYSTEM_TEMPLATE,
  CAMPAIGN_ADJUST_USER_TEMPLATE,
} from './campaign-structurer';
import { NUTRI_VOZ_SYSTEM_TEMPLATE, NUTRI_VOZ_USER_TEMPLATE, NUTRI_GEN_SYSTEM_TEMPLATE, NUTRI_GEN_USER_TEMPLATE } from './nutricion-generator';
import { POST_LLAMADA_SYSTEM_TEMPLATE, POST_LLAMADA_USER_TEMPLATE } from './post-llamada';
import { NUTRI_PLANTILLA_SYSTEM_TEMPLATE, NUTRI_PLANTILLA_USER_TEMPLATE } from './nutricion-plantillas';
import {
  CHECKLIST_ASK_SYSTEM_TEMPLATE, CHECKLIST_ASK_USER_TEMPLATE,
  CHECKLIST_PROPOSE_SYSTEM_TEMPLATE, CHECKLIST_PROPOSE_USER_TEMPLATE,
  PROYECTO_SYSTEM_TEMPLATE, PROYECTO_USER_TEMPLATE,
} from './checklist-coach';
import { CRITERIO_JUEZ_SYSTEM_TEMPLATE, CRITERIO_JUEZ_USER_TEMPLATE } from './plan-criterio-reglas';
import { PLAN_FATHOM_SYSTEM_TEMPLATE, PLAN_FATHOM_USER_TEMPLATE, PLAN_FATHOM_DEDUP_SYSTEM_TEMPLATE, PLAN_FATHOM_DEDUP_USER_TEMPLATE } from './plan-fathom';
import { GUARDIAN_SYSTEM_TEMPLATE, GUARDIAN_USER_TEMPLATE, GUARDIAN_DEBATE_SYSTEM_TEMPLATE, GUARDIAN_DEBATE_USER_TEMPLATE, GUARDIAN_PROJ_DEBATE_SYSTEM_TEMPLATE, GUARDIAN_PROJ_DEBATE_USER_TEMPLATE, DUP_SYSTEM_TEMPLATE, DUP_USER_TEMPLATE } from './mako-guardian';
import { CRUCE_SYSTEM_TEMPLATE, CRUCE_USER_TEMPLATE, RUTEAR_SYSTEM_TEMPLATE, RUTEAR_USER_TEMPLATE } from './mako-guardian';
import { GATE_SYSTEM_TEMPLATE, GATE_USER_TEMPLATE } from './retro-gate';
import {
  EXP_SUGGEST_SYSTEM_DEFAULT, EXP_SUGGEST_USER_DEFAULT,
  EXP_IDEAS_SYSTEM_DEFAULT, EXP_IDEAS_USER_DEFAULT,
  EXP_CLOSE_SYSTEM_DEFAULT, EXP_CLOSE_USER_DEFAULT,
} from './experimentos';
import { RETRO3_AREA_SYSTEM, RETRO3_CRUCES_SYSTEM, RETRO3_CEREBRO_SYSTEM, RETRO3_VERIF_SYSTEM } from './retro-pipeline';
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
        context: 'La personalidad base de MaKo: cómo se presenta, el voseo rioplatense, el tono directo y en qué cree. Va al principio de CADA respuesta de MaKo en todo el dashboard (chat de gráficos, secuencias, etc.). Si lo editas, cambias de cuajo cómo suena MaKo en todos lados.',
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
      context: `Le dice a MaKo en qué enfocarse cuando analiza un gráfico de la sección ${f.label}. Si lo dejas vacío, MaKo no recibe instrucción de sección y se comporta de forma genérica ahí.`,
    })),
  },
  {
    group: 'Modos del consultor MaKo',
    icon: '🎛️',
    blurb: 'Instrucciones de "sombrero" (analista, comparador, etc.) ya editables. Todavía no están cableadas al chat, así que editarlas no cambia nada visible aún.',
    entries: [
      { key: 'mako.modo.analista', storeKey: 'analista', source: 'modo', label: 'Modo Analista', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "analista": mira el dato, encuentra la causa, dale el próximo paso, números antes que opiniones. Aún no está cableado al chat.' },
      { key: 'mako.modo.comparador', storeKey: 'comparador', source: 'modo', label: 'Modo Comparador', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "comparador": contrasta períodos, anuncios o cohortes y resalta qué cambió y por qué importa. Aún no está cableado al chat.' },
      { key: 'mako.modo.guiones', storeKey: 'guiones', source: 'modo', label: 'Modo Guiones / VSL', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "guiones": analiza el creativo (hook, oferta, CTA) y propón mejoras al guion o al VSL. Aún no está cableado al chat.' },
      { key: 'mako.modo.consultor', storeKey: 'consultor', source: 'modo', label: 'Modo Consultor', kind: 'instruction', dynamic: false, variables: [], scope: 'full', sensitive: false, default: '', context: 'Sombrero de "consultor": piensa en orden (oferta → adquisición → sistematización → escala) y di qué tocar primero. Aún no está cableado al chat.' },
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
        context: 'El mensaje que la app le manda a MaKo apenas abres un chat sobre un gráfico. Define que la primera respuesta sea un insight corto (2-4 líneas) y no un resumen completo.',
      },
      {
        key: 'chart_insights.prompt_saludo', source: 'override',
        label: 'Primer mensaje sin gráfico (saludo)', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: false,
        default: CHART_PROMPT_SALUDO_DEFAULT,
        context: 'El mensaje de arranque cuando abres un chat general sin datos de gráfico: MaKo se presenta y dice en qué ayuda.',
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
        context: 'Cuando entras al chat de "whatsapp-secuencias", MaKo se vuelve consultor de WhatsApp. Esta es la instrucción de encuadre; las reglas de Meta y el estado real de tus secuencias se inyectan automáticamente después.',
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
        context: 'Base de conocimiento (categorías, formato, variables, motivos de rechazo) compilada de la documentación oficial de Meta. Se inyecta al validador de plantillas Y al chat de secuencias (un cambio aquí afecta ambos). Editarla mal puede hacer que el validador apruebe plantillas que Meta rechaza.',
      },
      {
        key: 'meta.rules.rubric', source: 'override',
        label: 'Rúbrica de riesgo de rechazo (Meta)', kind: 'instruction', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: VALIDATOR_RUBRIC,
        context: 'La checklist que el validador aplica al pie de la letra para decir si una plantilla tiene riesgo ALTO/MEDIO/BAJO. Define códigos (B1, S4, M3…) que después aparecen citados en los hallazgos. Si cambias los códigos, cambia lo que se cita.',
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
        context: 'Le pasa al auditor el borrador a evaluar como JSON. Casi no hay nada que editar; si lo tocas, mantén el slot {{entrada}} y el pedido de devolver JSON.',
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
        context: 'Le pasa a MaKo el objetivo y la etapa para redactar la plantilla, y le pide el JSON con name/category/body/footer/variables. Mantén el esquema del JSON.',
      },
    ],
  },
  {
    group: 'Nutrición — voz del negocio (MaKo)',
    icon: '🗣️',
    blurb: 'MaKo aprende cómo comunica el cliente (de sus anuncios + el perfil de marca) para escribir la nutrición en su voz. Esta guía de voz se destila una vez y se puede editar.',
    entries: [
      {
        key: 'nutri.voz.system', source: 'override',
        label: 'Destilador de voz (system)', kind: 'system', dynamic: false,
        variables: [], scope: 'static-only', sensitive: false,
        default: NUTRI_VOZ_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a destilar una "guía de voz" (tono, vocabulario, muletillas, qué nunca hace, ejemplos) a partir del perfil de marca y las transcripciones de los anuncios del cliente. Prioriza la fidelidad al estilo real por sobre el marketing genérico.',
      },
      {
        key: 'nutri.voz.user', source: 'override',
        label: 'Materia prima de la voz (user)', kind: 'user', dynamic: true,
        variables: [v('marca', 'perfil de marca declarado (tono/frase/qué-nunca/valores)'), v('transcripts', 'transcripciones literales de los anuncios del cliente')], scope: 'static-only', sensitive: true,
        default: NUTRI_VOZ_USER_TEMPLATE,
        context: 'Le pasa a MaKo la marca declarada y las transcripciones de los ads (texto literal). No borres los slots {{marca}}/{{transcripts}}.',
      },
    ],
  },
  {
    group: 'Nutrición — generador (MaKo escribe la secuencia)',
    icon: '✍️',
    blurb: 'MaKo escribe el copy de cada secuencia de nutrición en la voz del negocio, aplicando la metodología de copywriting y los ejemplos cargados. Devuelve un borrador para revisar y aprobar.',
    entries: [
      {
        key: 'nutri.gen.system', source: 'override',
        label: 'Generador de nutrición (system)', kind: 'system', dynamic: true,
        variables: [v('voz', 'guía de voz destilada del negocio'), v('metodologia', 'metodología de copywriting (RAG área mensajes)'), v('ejemplos', 'ejemplos swipe de referencia')], scope: 'static-only', sensitive: false,
        default: NUTRI_GEN_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a reescribir el copy de una secuencia respetando canal/orden/tiempos y solo cambiando el texto. No borres los slots {{voz}}/{{metodologia}}/{{ejemplos}} ni las reglas de placeholders ([tu link de agenda] se deja literal).',
      },
      {
        key: 'nutri.gen.user', source: 'override',
        label: 'Secuencia a escribir (user)', kind: 'user', dynamic: true,
        variables: [v('nombre', 'nombre de la secuencia'), v('contexto', 'cohorte / a quién le escribe'), v('pasos', 'pasos actuales en JSON con [placeholders]')], scope: 'static-only', sensitive: false,
        default: NUTRI_GEN_USER_TEMPLATE,
        context: 'Le pasa a MaKo la secuencia y sus pasos. No borres los slots {{nombre}}/{{contexto}}/{{pasos}} ni el formato JSON de salida exigido.',
      },
    ],
  },
  {
    group: 'Nutrición — plantilla WhatsApp para Meta (MaKo)',
    icon: '📩',
    blurb: 'MaKo convierte el copy de un paso de WhatsApp oficial en una plantilla aprobable por Meta (reabridora, sin links ni corchetes) y la manda a aprobar. El copy con el link se envía cuando el lead responde.',
    entries: [
      {
        key: 'nutri.plantilla.system', source: 'override',
        label: 'Conversión a plantilla Meta (system)', kind: 'system', dynamic: true,
        variables: [v('metodologia', 'metodología de mensajes (RAG)'), v('metaRules', 'reglas de plantillas de Meta'), v('voz', 'guía de voz del negocio'), v('vars', 'variables de lead disponibles')], scope: 'static-only', sensitive: false,
        default: NUTRI_PLANTILLA_SYSTEM_TEMPLATE,
        context: 'Convierte un mensaje de nutrición en una plantilla WhatsApp Meta-safe: sin links ni [corchetes], solo variables nombradas del catálogo, CTA que invita a responder. No borres los slots {{metodologia}}/{{metaRules}}/{{voz}}/{{vars}}.',
      },
      {
        key: 'nutri.plantilla.user', source: 'override',
        label: 'Mensaje a convertir (user)', kind: 'user', dynamic: true,
        variables: [v('objetivo', 'cohorte / a quién apunta'), v('copy', 'el copy del paso a convertir')], scope: 'static-only', sensitive: false,
        default: NUTRI_PLANTILLA_USER_TEMPLATE,
        context: 'Le pasa a MaKo el copy del paso y el cohorte. No borres los slots {{objetivo}}/{{copy}} ni el formato JSON de salida.',
      },
    ],
  },
  {
    group: 'Email marketing (MaKo escribe el email)',
    icon: '✉️',
    blurb: 'El botón "generar" de /email: asunto, preheader y cuerpo escritos con el perfil, la voz y el funnel REALES del negocio del workspace.',
    entries: [
      {
        key: 'email.generar.system', source: 'override',
        label: 'Copy de email marketing (system)', kind: 'system', dynamic: true,
        variables: [v('perfil', 'el perfil del negocio del workspace'), v('voz', 'la guía de voz destilada del Chatbot'), v('funnel', 'el funnel REAL del workspace')], scope: 'full', sensitive: true,
        default: EMAIL_GEN_SYSTEM_TEMPLATE,
        context: 'Este prompt tenía hardcodeado "escribiendo para Mauricio Bustos (Negocio que Escala™)" y su link de Calendly, para TODOS los workspaces: cualquier cliente que tocara "generar" recibía copy del negocio de otro. Conserva los slots {{perfil}}/{{voz}}/{{funnel}} y el bloque PROHIBIDO INVENTAR — sin él vuelven los links inventados y el dialecto por default (voseo a una audiencia mexicana).',
      },
    ],
  },
  {
    group: 'Setting — wizard de secuencias de mensajes',
    icon: '🎯',
    blurb: 'Sugerencias del wizard de la tab Setting: ganchos (lead magnet / oferta) y preguntas de cualificación por cohorte. Corren con la IA barata.',
    entries: [
      {
        key: 'setting.gancho', source: 'override',
        label: 'Sugerir ganchos (user)', kind: 'user', dynamic: true,
        variables: [v('objetivo', 'objetivo de la secuencia de mensajes'), v('etapa', 'etapa del lead en el funnel'), v('perfil', 'perfil del negocio')], scope: 'static-only', sensitive: false,
        default: SETTING_GANCHO_TEMPLATE,
        context: 'Tres ganchos concretos derivados del perfil del negocio. No borres los slots {{objetivo}}/{{etapa}}/{{perfil}} ni el formato de salida (array JSON).',
      },
      {
        key: 'setting.preguntas', source: 'override',
        label: 'Sugerir preguntas de cualificación (user)', kind: 'user', dynamic: true,
        variables: [v('objetivo', 'objetivo de la secuencia de mensajes'), v('etapa', 'etapa del lead en el funnel'), v('perfil', 'perfil del negocio')], scope: 'static-only', sensitive: false,
        default: SETTING_PREGUNTAS_TEMPLATE,
        context: 'Cuatro preguntas cerradas y cortas, en orden de setter. No borres los slots ni el formato de salida (array JSON).',
      },
      {
        key: 'setting.criterio', source: 'override',
        label: 'Deducir el criterio de calificación (user)', kind: 'user', dynamic: true,
        variables: [v('perfil', 'perfil del negocio'), v('datos', 'leads ya calificados/cerrados del CRM con sus respuestas')], scope: 'static-only', sensitive: false,
        default: SETTING_CRITERIO_TEMPLATE,
        context: 'MaKo deduce qué separa a un cliente ideal mirando los leads YA evaluados. No borres los slots {{perfil}}/{{datos}}, la orden de no inventar umbrales, ni el formato de salida.',
      },
      {
        key: 'chatagent.voz.segmentar', source: 'override',
        label: 'Onboarding — separar la etapa de venta del soporte (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: VOZ_SEGMENTAR_TEMPLATE,
        context: 'Corta cada conversación donde termina la venta y empieza el soporte o la entrega. Sin esto, el análisis aprende a "vender" leyendo chats de posventa. No borres la regla de responder 0 ante la duda ni el formato JSON.',
      },
      {
        key: 'chatagent.voz.analisis.system', source: 'override',
        label: 'Onboarding — analizar cómo vende (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: VOZ_ANALISIS_SYSTEM_TEMPLATE,
        context: 'Saca los 5 bloques de la voz. Lo más importante es la regla de devolver "hay": false cuando no hay evidencia, y las citas textuales: el código las VERIFICA contra el material y descarta el bloque si no aparecen. No borres ninguna de las dos ni el formato JSON.',
      },
      {
        key: 'chatagent.voz.analisis.user', source: 'override',
        label: 'Onboarding — analizar cómo vende (user)', kind: 'user', dynamic: true,
        variables: [v('perfil', 'perfil del negocio'), v('material', 'los tramos de venta de las conversaciones elegidas')], scope: 'static-only', sensitive: false,
        default: VOZ_ANALISIS_USER_TEMPLATE,
        context: 'No borres los slots {{perfil}} ni {{material}}.',
      },
      {
        key: 'chatagent.voz.preguntas', source: 'override',
        label: 'Onboarding — preguntar lo que no se dedujo (system)', kind: 'system', dynamic: true,
        variables: [v('conocido', 'lo que sí se dedujo de sus conversaciones'), v('faltantes', 'los bloques sin evidencia')], scope: 'static-only', sensitive: false,
        default: VOZ_PREGUNTAS_TEMPLATE,
        context: 'Cuando un bloque queda sin evidencia se pregunta en vez de inventarlo. La regla clave es que las opciones SEAN la frase que el dueño diría, no una descripción de su estilo: nadie reconoce "tono cercano", pero cualquiera reconoce su propia frase.',
      },
      {
        key: 'chatagent.variantes', source: 'override',
        label: 'Variantes anti-repetición de un mensaje (system)', kind: 'system', dynamic: true,
        variables: [v('voz', 'guía de voz destilada del negocio')], scope: 'static-only', sensitive: false,
        default: VARIANTES_SYSTEM_TEMPLATE,
        context: 'El mismo mensaje dicho de formas distintas, generadas UNA vez al armar la secuencia. Sin esto el motor manda el texto idéntico a todos, que es lo que WhatsApp busca para restringir un número. No borres la regla de conservar los placeholders y los enlaces: una variante que los pierde sale sin personalizar o promete un link que no manda.',
      },
      {
        key: 'chatbot.paso-ia', source: 'override',
        label: 'Paso de secuencia en modo IA (system)', kind: 'system', dynamic: true,
        variables: [v('voz', 'guía de voz destilada del negocio')], scope: 'static-only', sensitive: false,
        default: PASO_IA_SYSTEM_TEMPLATE,
        context: 'Reescribe el mensaje de un paso para cada persona, al momento de mandarlo, cuando la tarjeta tiene la IA prendida. No borres la regla de dejar los placeholders, los links y los números TAL CUAL: el motor lo comprueba (lib/texto-critico.ts) y, si se pierde uno, el mensaje sale con el texto base en vez del escrito. Y no lo pases a voseo: le llega al cliente del negocio, no a Martín.',
      },
      {
        key: 'chatbot.guion-audio', source: 'override',
        label: 'Guion para leer al grabar un audio (system)', kind: 'system', dynamic: true,
        variables: [v('perfil', 'perfil del negocio'), v('secuencia', 'objetivo + gancho + preguntas de la secuencia'), v('voz', 'guía de voz destilada del negocio')], scope: 'static-only', sensitive: false,
        default: GUION_PASO_SYSTEM_TEMPLATE,
        context: 'El botón «Escríbeme el guion» al grabar la nota de voz de un mensaje: lo que el dueño lee en voz alta. No borres las reglas de no leer links ni datos entre llaves, ni el largo de 30 a 60 segundos: el código lo comprueba (lib/guion-audio.ts → revisarGuion) y descarta el guion que no cumple. Y no lo pases a voseo: lo escucha el cliente del negocio.',
      },
      // Crear con IA (08/10/2026, decisión 14). SIN slots, a propósito: el negocio, sus listas y el
      // pedido viajan en el mensaje `user` (lib/flujo-ia.ts → userDeCrear / userDeEditar), porque un
      // override guardado desde /configuraciones no conoce bloques nuevos y los perdería en
      // silencio. Los `{{nombre}}` y `{{negocio}}` del texto NO son slots: son las variables del
      // motor que el modelo tiene que escribir tal cual en los mensajes.
      {
        key: 'chatbot.crear-ia.system', source: 'override',
        label: 'Crear una automatización con IA (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: CREAR_IA_SYSTEM_TEMPLATE,
        context: 'La caja «Generar con IA» de una automatización nueva: el modelo devuelve el flujo como un JSON propio con NOMBRES, y el código lo traduce y lo repara (lib/flujo-ia.ts → deIA). No borres la forma del JSON ni las reglas duras: el código saca lo que no las cumple y, si queda roto, prueba otro proveedor. No le pidas links ni ids: los pone el código, y el disparador va por su clave corta (d1, d2…). No le agregues «ir_a»: la IA no arma saltos (el código los saca). No borres el "objetivo" de "si_responde": es el del AI Step que arma el código (lib/flujo-ia.ts → objetivoDeIA), y sin él no se publica. No borres la regla 8 (una automatización por categoría: recordatorios con antes_de_reunion, el aviso al equipo con avisar_al_equipo y UN si_responde) ni los datos que permite la regla 2: los de la reunión sólo detrás de una espera antes de la reunión o de la condición reunion_en (el código los rechaza en otro lado), y los del equipo sólo en avisar_al_equipo. El ejemplo de la categoría del pedido (la plantilla de la galería) viaja en el mensaje user, no aquí. No lo alargues: cada token de más le resta salida a Groq y lo deja afuera de la cascada. Y no lo pases a voseo: los mensajes le llegan al cliente del negocio.',
      },
      // El AI Step (décima tanda; uno por objetivo desde la undécima, docs/diseno-undecima-tanda.md §6): «✦ Armar» y
      // las objeciones del ensayo. Un slot (`medio`); el objetivo, el negocio, los escenarios y el catálogo van en el
      // mensaje user (un override no los pierde).
      {
        key: 'automations.ai_step.armar', source: 'override',
        label: 'AI Step — armar los escenarios desde el objetivo (system)', kind: 'system', dynamic: true,
        variables: [v('medio', 'por dónde contesta la tarjeta: WhatsApp, Instagram o Messenger')], scope: 'static-only', sensitive: false,
        default: ARMAR_AI_STEP_SYSTEM_TEMPLATE,
        context: '«✦ Armar» y «✦ Otro con MaKo» de un AI Step: con el objetivo, el modelo arma los escenarios (de 2 a 6, o uno más) con su nombre, cuándo entra, cómo responder y su libertad, y qué pasa con «Lo demás», como un JSON {"escenarios":[…],"lo_demas":…}. El código lo repara (lib/ai-step-armar.ts → repararArmado): nombres que no se repiten, «cuándo» obligatorio, nunca «sola» si habla de plata ni en «Lo demás», hasta 10. No borres la forma del JSON. Y no lo pases a voseo: lo que escribe le llega al cliente del negocio.',
      },
      {
        key: 'automations.ai_step.objeciones', source: 'override',
        label: 'AI Step — las objeciones del ensayo (system)', kind: 'system', dynamic: true,
        variables: [v('medio', 'por dónde le escribe el lead: WhatsApp, Instagram o Messenger')], scope: 'static-only', sensitive: false,
        default: OBJECIONES_SYSTEM_TEMPLATE,
        context: 'El ensayo de objeciones de un AI Step: con el objetivo y TODOS sus escenarios, el modelo propone el primer mensaje del lead y 4 objeciones de ESTE negocio, como un JSON (lib/ai-step-ensayo.ts → leerObjeciones). Después MaKo hace de lead con el prompt del ensayo de siempre (setting.ensayo). No borres la forma del JSON.',
      },
      // El Dashboard (11/10/2026). SIN slots: el catálogo y lo que muestran los gráficos viajan en el
      // mensaje user, así un override guardado no pierde un conjunto nuevo.
      {
        key: 'dashboard.hoja-ia.system', source: 'override',
        label: 'Armar una hoja del Dashboard con IA (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: HOJA_IA_SYSTEM_TEMPLATE,
        context: '«Pídeselo a MaKo» al crear una hoja del Dashboard. El modelo elige conjuntos, tipos y métricas POR SU ID del catálogo que le llega; el código descarta lo que no existe y acomoda la grilla (lib/graficos-ia.ts → deIAHoja). No le pidas ids ni posiciones: los pone el código.',
      },
      {
        key: 'dashboard.analista.system', source: 'override',
        label: 'AI Analyst del Dashboard (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: ANALISTA_SYSTEM_TEMPLATE,
        context: 'El botón «AI Analyst» del Dashboard y su análisis programado: MaKo lee lo que muestran los gráficos de una hoja y dice qué pasa y qué conviene hacer. No le pidas que invente números: sólo puede citar los que le llegan (lib/graficos-analisis.ts).',
      },
      {
        key: 'chatbot.editar-ia.system', source: 'override',
        label: 'Agregarle tarjetas a una automatización con IA (system)', kind: 'system', dynamic: true,
        variables: [], scope: 'static-only', sensitive: false,
        default: EDITAR_IA_SYSTEM_TEMPLATE,
        context: 'La barra «Pídele un cambio» de una automatización que ya existe. Sólo AGREGA tramos colgados de una salida vacía, de un camino en paralelo o de «Si responde»: nunca cambia ni borra una tarjeta (ahí puede haber leads parados). No borres la forma de "agregar" ni la regla de no pisar una salida ocupada: el código la comprueba (lib/flujo-ia.ts → deIAEdicion).',
      },
      {
        key: 'setting.ensayo', source: 'override',
        label: 'Onboarding — MaKo hace de CLIENTE (system)', kind: 'system', dynamic: true,
        variables: [v('perfil', 'perfil del negocio'), v('funnel', 'proceso comercial del negocio')], scope: 'static-only', sensitive: false,
        default: SETTING_ENSAYO_SYSTEM_TEMPLATE,
        context: 'El ensayo del onboarding: MaKo se pone del lado del LEAD y el dueño responde. Es el INVERSO del simulador. No borres los slots ni las reglas de "escribes como escribe la gente por WhatsApp".',
      },
      {
        key: 'setting.simulador', source: 'override',
        label: 'Simulador — MaKo como setter (system)', kind: 'system', dynamic: true,
        variables: [v('voz', 'guía de voz destilada del negocio'), v('secuencia', 'objetivo + gancho + preguntas de la secuencia de mensajes')], scope: 'static-only', sensitive: false,
        default: SETTING_SIMULADOR_SYSTEM_TEMPLATE,
        context: 'El cerebro del setter en el simulador de /setting (y la base del Setter IA). No borres los slots {{voz}}/{{secuencia}} ni las reglas de placeholders [tu link …].',
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
        context: 'El cerebro del Closing Analyst: cómo clasificar la llamada (Venta R1/R2 vs Entrega de servicio vs Interna), cómo puntuar SPIN y ejecución del 0 al 10, y la forma EXACTA del JSON de salida (con citas que llevan el segundo del transcript). Conserva las categorías de clasificación, los nombres de dimensión SPIN/ejecución y el esquema JSON o el análisis se rompe.',
      },
      {
        key: 'closing.analyze.user', source: 'override',
        label: 'Datos de la llamada (user)', kind: 'user', dynamic: true,
        variables: [v('metadatos', 'título/fecha/duración/host'), v('leadCtx', 'contexto del lead en el CRM'), v('summary', 'resumen de Fathom'), v('actions', 'action items'), v('transcript', 'transcript con segundos'), v('feedbackBlock', 'revisión humana (si la hay)')], scope: 'full', sensitive: false,
        default: CLOSING_USER_TEMPLATE,
        context: 'Arma el pedido con todo lo de la llamada. Si alguien revisa la llamada y deja un comentario, se inyecta en {{feedbackBlock}} para que MaKo reanalice. Conserva los slots; sin ellos MaKo pierde el contexto.',
      },
      {
        key: 'closing.entrega.system', source: 'override',
        label: 'Sesiones de entrega — resumen, riesgos y próximos pasos (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: ENTREGA_SYSTEM_TEMPLATE,
        context: 'Cómo MaKo lee una sesión con un cliente que YA compró (coaching, acompañamiento, seguimiento) y lo que deja en la pestaña Llamadas de su ficha. Conserva la forma EXACTA del JSON (resumen, riesgos con riesgo/cita/t_seconds/gravedad, proximos_pasos con que/quien) y los valores alta/media/baja y cliente/equipo: lo que no cumpla el contrato se descarta (lib/closing-entrega-contrato.ts). Y no le pongas el nombre de un negocio: corre para todos los clientes.',
      },
      {
        key: 'closing.entrega.user', source: 'override',
        label: 'Sesiones de entrega — datos de la sesión (user)', kind: 'user', dynamic: true,
        variables: [v('metadatos', 'título/fecha/duración/quien dio la sesión'), v('cliente', 'nombre y empresa del cliente en el CRM, si se sabe'), v('resumenFathom', 'resumen de Fathom'), v('transcript', 'transcript con segundos')], scope: 'full', sensitive: false,
        default: ENTREGA_USER_TEMPLATE,
        context: 'Le pasa a MaKo la sesión entera. Conserva los slots: sin {{transcript}} no hay de dónde sacar las citas, y el código las verifica contra la grabación.',
      },
    ],
  },
  {
    group: 'Curso del servicio — la IA reescribe la tarea (Customer Success)',
    icon: '📝',
    blurb: 'Después de cada sesión de entrega, MaKo reescribe las respuestas del curso que el cliente ya mandó con lo que se habló en la llamada. Su versión queda AL LADO de la del cliente, que la aprueba o la corrige en su portal: nunca se pisa lo que él escribió.',
    entries: [
      {
        key: 'curso.propuesta.system', source: 'override',
        label: 'Reescribir la tarea con lo hablado (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: PROPUESTA_SYSTEM_TEMPLATE,
        context: 'Cómo MaKo reescribe las respuestas del cliente con lo que se habló en la sesión. Conserva la forma EXACTA del JSON ({"propuestas": [{"clase", "area", "valores"}]}) y la regla de respetar la forma de cada campo: lo que no cumpla el formulario de su clase se descarta (lib/curso-propuesta.ts). Y no le pongas el nombre de un negocio: corre para todos los clientes.',
      },
      {
        key: 'curso.propuesta.user', source: 'override',
        label: 'Reescribir la tarea — datos de la sesión (user)', kind: 'user', dynamic: true,
        variables: [v('metadatos', 'título/fecha/duración/quien dio la sesión'), v('resumen', 'resumen del análisis de la sesión y el de Fathom'), v('respuestas', 'las respuestas que el cliente mandó antes de la sesión, con su formulario'), v('transcript', 'transcript con segundos')], scope: 'full', sensitive: false,
        default: PROPUESTA_USER_TEMPLATE,
        context: 'Le pasa a MaKo la sesión y las respuestas a reescribir. Conserva los slots: sin {{respuestas}} no hay nada que reescribir, y sin {{transcript}} no hay de dónde sacar lo hablado.',
      },
    ],
  },
  {
    group: 'Follow-up post-llamada (MaKo)',
    icon: '📲',
    blurb: 'Cuando termina una llamada de venta, MaKo usa el análisis del Closing Analyst (dolores, objeciones, próximo paso) para redactar el follow-up en la voz del negocio y lo deja como borrador de WhatsApp: el setter lo revisa y lo envía con un clic. Nunca sale automático.',
    entries: [
      {
        key: 'postllamada.followup.system', source: 'override',
        label: 'Redactor del follow-up (system)', kind: 'system', dynamic: true,
        variables: [v('voz', 'guía de voz destilada del negocio'), v('metodologia', 'metodología de mensajes (RAG área mensajes)')], scope: 'static-only', sensitive: false,
        default: POST_LLAMADA_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a escribir el WhatsApp post-llamada: corto, en la voz del negocio, retomando el dolor de la charla y la objeción que quedó abierta, con una sola CTA hacia el próximo paso real. No borres los slots {{voz}}/{{metodologia}} ni la regla de devolver solo el texto del mensaje.',
      },
      {
        key: 'postllamada.followup.user', source: 'override',
        label: 'Datos de la llamada (user)', kind: 'user', dynamic: true,
        variables: [v('lead', 'nombre/empresa/estado del prospecto'), v('llamada', 'reunión (R1/R2) y fecha'), v('analisis', 'análisis del Closing Analyst: resumen, objeciones, próximo paso')], scope: 'static-only', sensitive: false,
        default: POST_LLAMADA_USER_TEMPLATE,
        context: 'Le pasa a MaKo el prospecto, la llamada y el análisis de la charla. No borres los slots {{lead}}/{{llamada}}/{{analisis}}.',
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
        context: 'El cerebro del botón "Generar insights" de la ficha del lead: qué priorizar (dolor, señales de compra, objeciones, próxima acción) y la forma EXACTA del JSON de salida. Conserva el esquema JSON o la ficha no puede mostrar el análisis.',
      },
      {
        key: 'lead_insights.user', source: 'override',
        label: 'Datos del lead (user)', kind: 'user', dynamic: true,
        variables: [v('hoy', 'fecha de hoy'), v('etapa', 'etapa actual del pipeline'), v('ficha', 'datos del CRM'), v('reuniones', 'R1/R2 y asistencias'), v('respuestas', 'forms de Calendly'), v('llamadas', 'análisis de Fathom'), v('chat', 'mensajes de WhatsApp'), v('anuncio', 'transcript del ad de origen'), v('tracking', 'landing/VSL'), v('deal', 'cobranza y servicio')], scope: 'full', sensitive: false,
        default: LEAD_INSIGHTS_USER_TEMPLATE,
        context: 'Arma el pedido con todas las fuentes del lead. Conserva los slots; sin ellos MaKo pierde contexto y el análisis empeora.',
      },
    ],
  },
  {
    group: 'Análisis y valoración de guiones de ads (Ads Analyst)',
    icon: '🎬',
    blurb: 'MaKo lee guiones de video ads, los disecciona en bloques y valora guiones nuevos contra lo que ya rinde.',
    entries: [
      {
        key: 'script_analyst.analysis.system', source: 'override',
        label: 'Anatomía del guion (system)', kind: 'system', dynamic: true,
        variables: [v('angleBullets', 'lista de ángulos vigentes (clave: desc)'), v('anglePipe', 'ángulos separados por |')], scope: 'static-only', sensitive: true,
        default: SCRIPT_ANALYSIS_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a leer el guion de un video ad y devolver su anatomía (clasificar, partir en bloques, diagnosticar) sin inventar métricas. No cambies los vocabularios cerrados (hook_type, tags, beats) ni el esquema JSON o el guardado se rompe. Conserva los slots {{angleBullets}} y {{anglePipe}}.',
      },
      {
        key: 'script_analyst.analysis.user', source: 'override',
        label: 'Datos del anuncio + transcript (user)', kind: 'user', dynamic: true,
        variables: [v('ad_name', 'nombre del anuncio'), v('tipo', 'tipo de creativo'), v('idioma', 'idioma'), v('duracion', 'duración del video'), v('cuerpo', 'el guion (secciones o transcript)')], scope: 'full', sensitive: false,
        default: SCRIPT_ANALYSIS_USER_TEMPLATE,
        context: 'Le pasa a MaKo los datos del anuncio y el texto del guion. Mantén el bloque de metadatos, el {{cuerpo}} y el pedido final del JSON.',
      },
      {
        key: 'script_analyst.valoracion.system', source: 'override',
        label: 'Valoración de guion nuevo (system)', kind: 'system', dynamic: true,
        variables: [v('anglePipe', 'ángulos separados por |')], scope: 'static-only', sensitive: true,
        default: SCRIPT_VALORACION_SYSTEM_TEMPLATE,
        context: 'Cuando subes un guion que TODAVÍA no corrió en Meta, compara contra el perfil real de la cuenta y predice un veredicto (escalar / mejorar gancho / reescribir cuerpo / repensar ángulo / promesa-pero-validar). Conserva las opciones de veredicto y el esquema JSON.',
      },
      {
        key: 'script_analyst.valoracion.user', source: 'override',
        label: 'Guion nuevo + perfil de la cuenta (user)', kind: 'user', dynamic: true,
        variables: [v('duracion', 'duración estimada'), v('guion', 'el guion nuevo'), v('perfil', 'perfil real de la cuenta en JSON')], scope: 'full', sensitive: false,
        default: SCRIPT_VALORACION_USER_TEMPLATE,
        context: 'Le pasa a MaKo el guion nuevo y el perfil real de la cuenta en JSON, y le pide valorar uno contra el otro. Mantén los slots y el pedido final del JSON.',
      },
    ],
  },
  {
    group: 'Diagnóstico de la landing (Landing Analyst)',
    icon: '🌐',
    blurb: 'MaKo baja tu landing, le lee el copy y lo cruza con el comportamiento real de esa página (visitas, retención del video, agendas) para decirte qué cambiar primero.',
    entries: [
      {
        key: 'landing_analyst.analyze.system', source: 'override',
        label: 'Instrucciones de diagnóstico de landing (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: LANDING_ANALYZE_SYSTEM_TEMPLATE,
        context: 'El cerebro del Landing Analyst: las 5 dimensiones que puntúa (Claridad, Promesa, Prueba, Llamado a la acción, Fricción), la regla de que cada hallazgo va CITADO con texto literal de la página, la prohibición de inventar métricas y la forma EXACTA del JSON. Si cambias los labels de las dimensiones o el esquema, la pantalla deja de poder leer el análisis.',
      },
      {
        key: 'landing_analyst.analyze.user', source: 'override',
        label: 'Página + comportamiento medido (user)', kind: 'user', dynamic: true,
        variables: [v('meta', 'URL, título y meta descripción de la página'), v('comportamiento', 'visitas, visitantes, retención y agendas REALES de esa URL'), v('negocio', 'funnel + perfil del negocio'), v('copy', 'el copy de la página en orden de lectura')], scope: 'full', sensitive: false,
        default: LANDING_ANALYZE_USER_TEMPLATE,
        context: 'Le pasa a MaKo la página bajada y las métricas reales de esa misma URL. El bloque de comportamiento lo calcula el CÓDIGO (nunca la IA): es lo que le permite decir "la promesa se entiende pero el 70% se va antes del botón". Conserva los slots y la cláusula de seguridad del copy.',
      },
    ],
  },
  {
    group: 'Escritor de landings (Landing Generator)',
    icon: '✍️',
    blurb: 'MaKo escribe la página entera —estructura y copy terminado— desde tu funnel, tu oferta y, si ya la analizaste, el diagnóstico de la landing actual.',
    entries: [
      {
        key: 'landing_writer.suggest.system', source: 'override',
        label: 'Propuesta de landing (system)', kind: 'system', dynamic: true,
        variables: [v('metodologia', 'método de páginas de conversión'), v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: LANDING_SUGGEST_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a escribir el copy terminado de la página, derivando el CTA del funnel. NO borres el bloque "PROHIBIDO INVENTAR": es lo que impide que salga una landing con testimonios y cifras falsas, que es un problema legal y no una sugerencia. Conserva los slots {{metodologia}}/{{jsonShape}} y el esquema del JSON o la pantalla de revisión no puede leer la propuesta.',
      },
      {
        key: 'landing_writer.suggest.user', source: 'override',
        label: 'Pedido + contexto + diagnóstico (user)', kind: 'user', dynamic: true,
        variables: [v('pedido', 'lo que pidió el usuario'), v('objetivo', 'objetivo de la página y su criterio'), v('contexto', 'funnel + perfil + método'), v('diagnostico', 'diagnóstico del Landing Analyst si esa URL ya se analizó')], scope: 'full', sensitive: false,
        default: LANDING_SUGGEST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el pedido y el contexto real del negocio. El slot {{diagnostico}} es el que cierra el loop analizar → reescribir: cuando la URL ya pasó por el Landing Analyst, entran sus hallazgos para que la versión nueva los resuelva. Conserva los slots.',
      },
      {
        key: 'landing_writer.adjust.system', source: 'override',
        label: 'Ajuste de la landing (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: LANDING_ADJUST_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario pide cambios sobre una propuesta, MaKo aplica SOLO lo pedido y conserva el resto palabra por palabra. Conserva el slot {{jsonShape}} y la regla de no reescribir bloques que no se pidieron.',
      },
      {
        key: 'landing_writer.adjust.user', source: 'override',
        label: 'Spec actual + cambio pedido (user)', kind: 'user', dynamic: true,
        variables: [v('specActual', 'el LandingSpec actual en JSON'), v('instruccion', 'el cambio que pide el usuario'), v('contexto', 'contexto del negocio')], scope: 'full', sensitive: false,
        default: LANDING_ADJUST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el spec actual y el cambio pedido. Mantén los slots y el pedido de devolver el JSON COMPLETO (si devuelve solo el bloque cambiado, se pierde el resto de la página).',
      },
    ],
  },
  {
    // El editor copiado de Gamma (lib/editor-landing/ia.ts; los defaults viven en
    // lib/editor-landing/ia-reglas.ts, portados de presenton con su aviso Apache-2.0).
    // Las keys y los slots los fija tests/editor-landing-ia.test.ts contra PROMPTS_EDITOR.
    group: 'Editor de landings (Landing Generator)',
    icon: '🧩',
    blurb: 'MaKo en el editor de landings: arma el esquema, escribe las secciones con su diseño, edita con IA la landing o una sección, reescribe textos, propone otros diseños y escribe las notas del orador.',
    entries: [
      {
        key: 'landing_editor.esquema.system', source: 'override',
        label: 'Esquema de la landing (system)', kind: 'system', dynamic: true,
        variables: [v('idioma', 'el idioma del copy (español neutro de México por default)'), v('formato', 'forma EXACTA del JSON del esquema')], scope: 'static-only', sensitive: true,
        default: LANDING_EDITOR_ESQUEMA_SYSTEM,
        context: 'Arma la lista de secciones que la persona revisa antes de generar. NO borres «PROHIBIDO INVENTAR» ni la regla de que los AJUSTES mandan: el texto pegado o importado puede traer instrucciones adentro y son datos. Conserva {{idioma}} y {{formato}}, o la pantalla no puede leer el esquema.',
      },
      {
        key: 'landing_editor.esquema.user', source: 'override',
        label: 'Ajustes + contenido + contexto (user)', kind: 'user', dynamic: true,
        variables: [v('ajustes', 'cantidad de secciones, idioma, objetivo, audiencia, tono y cantidad de texto'), v('contenido', 'el pedido, el texto pegado o la página importada'), v('instrucciones', 'instrucciones extra y el modo de texto'), v('contexto', 'funnel + perfil + método del negocio'), v('diagnostico', 'diagnóstico del Landing Analyst si la landing ya se analizó')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_ESQUEMA_USER,
        context: 'Le pasa a MaKo los ajustes y el material. Conserva los slots: {{contenido}} llega delimitado como dato no confiable.',
      },
      {
        key: 'landing_editor.secciones.system', source: 'override',
        label: 'Secciones con su diseño (system)', kind: 'system', dynamic: true,
        variables: [v('gramatica', 'los bloques que la IA puede escribir (sale del código)'), v('texto', 'la cantidad de texto por sección'), v('modoTexto', 'Generar · Condensar · Conservar'), v('idioma', 'el idioma del copy'), v('formato', 'forma del JSON de este pedido')], scope: 'static-only', sensitive: true,
        default: LANDING_EDITOR_SECCIONES_SYSTEM,
        context: 'Escribe hasta 3 secciones por pedido con la gramática de bloques del editor. {{gramatica}} sale del código (las listas cerradas del documento): si se borra, la IA no sabe qué bloques existen y nada se puede convertir. NO borres «PROHIBIDO INVENTAR».',
      },
      {
        key: 'landing_editor.secciones.user', source: 'override',
        label: 'Esquema + secciones pedidas (user)', kind: 'user', dynamic: true,
        variables: [v('ajustes', 'los ajustes de la generación'), v('esquema', 'la página entera por títulos, con las pedidas marcadas'), v('pedidas', 'el detalle de las secciones a escribir'), v('instrucciones', 'instrucciones extra'), v('contexto', 'funnel + perfil + método del negocio')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_SECCIONES_USER,
        context: 'Le pasa a MaKo el esquema completo (para que no repita) y el detalle solo de las secciones de esta tanda. Conserva los slots.',
      },
      {
        key: 'landing_editor.editar.system', source: 'override',
        label: 'Edición con IA (system)', kind: 'system', dynamic: true,
        variables: [v('gramatica', 'los bloques que la IA puede escribir'), v('idioma', 'el idioma del copy'), v('formato', 'forma del JSON de la edición')], scope: 'static-only', sensitive: true,
        default: LANDING_EDITOR_EDITAR_SYSTEM,
        context: 'Aplica la instrucción de la persona sobre la landing o una sección. Conserva las reglas de devolver cada sección ENTERA con su id y de no tocar las bloqueadas: si se borran, una edición pierde el resto de la sección. Las bloqueadas igual se descartan en código.',
      },
      {
        key: 'landing_editor.editar.user', source: 'override',
        label: 'Instrucción + secciones (user)', kind: 'user', dynamic: true,
        variables: [v('instruccion', 'lo que pidió la persona'), v('alcance', 'la landing entera o una sección'), v('secciones', 'las secciones actuales en la gramática (las bloqueadas, solo el título)'), v('contexto', 'funnel + perfil + método del negocio')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_EDITAR_USER,
        context: 'Le pasa a MaKo la instrucción y las secciones actuales. Conserva los slots.',
      },
      {
        key: 'landing_editor.texto.system', source: 'override',
        label: 'Acciones de texto (system)', kind: 'system', dynamic: true,
        variables: [v('accion', 'qué hacer: mejorar, corregir, acortar, ampliar, simplificar, más específico, tono, traducir o continuar'), v('idioma', 'el idioma de la respuesta')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_TEXTO_SYSTEM,
        context: 'Reescribe la selección con la acción elegida en la barra. Conserva {{accion}} (la escribe el código según el botón) y la regla de devolver SOLO el texto: lo que vuelve reemplaza la selección tal cual.',
      },
      {
        key: 'landing_editor.texto.user', source: 'override',
        label: 'Texto + contexto (user)', kind: 'user', dynamic: true,
        variables: [v('texto', 'la selección'), v('contexto', 'la sección donde está el texto, si la hay')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_TEXTO_USER,
        context: 'Le pasa a MaKo el texto seleccionado. Conserva los slots.',
      },
      {
        key: 'landing_editor.disenos.system', source: 'override',
        label: 'Probar nuevo diseño (system)', kind: 'system', dynamic: true,
        variables: [v('gramatica', 'los bloques que la IA puede escribir'), v('formato', 'forma del JSON de las alternativas')], scope: 'static-only', sensitive: true,
        default: LANDING_EDITOR_DISENOS_SYSTEM,
        context: 'Propone hasta 3 formas distintas de la misma sección. Conserva la regla de que el TEXTO se conserva: las alternativas que cambian el texto se descartan en código y no llegan a la persona.',
      },
      {
        key: 'landing_editor.disenos.user', source: 'override',
        label: 'Sección actual (user)', kind: 'user', dynamic: true,
        variables: [v('seccion', 'la sección actual en la gramática')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_DISENOS_USER,
        context: 'Le pasa a MaKo la sección actual. Conserva el slot.',
      },
      {
        key: 'landing_editor.notas.system', source: 'override',
        label: 'Notas del orador (system)', kind: 'system', dynamic: true,
        variables: [v('idioma', 'el idioma de las notas')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_NOTAS_SYSTEM,
        context: 'Escribe lo que la persona diría al presentar la sección. Texto plano: el modo Presentar lo muestra tal cual.',
      },
      {
        key: 'landing_editor.notas.user', source: 'override',
        label: 'Sección (user)', kind: 'user', dynamic: true,
        variables: [v('seccion', 'el texto de la sección')], scope: 'full', sensitive: false,
        default: LANDING_EDITOR_NOTAS_USER,
        context: 'Le pasa a MaKo el texto de la sección. Conserva el slot.',
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
        context: 'Le pasa a MaKo el pedido del usuario, los creativos y el contexto real del negocio. Conserva los slots {{prompt}}/{{creativos}}/{{contexto}} y el pedido final del JSON.',
      },
      {
        key: 'campaign.adjust.system', source: 'override',
        label: 'Ajuste de campaña (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: CAMPAIGN_ADJUST_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario pide cambios a una campaña ya propuesta, MaKo aplica SOLO lo pedido y conserva el resto. Conserva el slot {{jsonShape}} y el esquema del JSON.',
      },
      {
        key: 'campaign.adjust.user', source: 'override',
        label: 'Spec actual + cambio pedido (user)', kind: 'user', dynamic: true,
        variables: [v('specActual', 'el CampaignSpec actual en JSON'), v('instruccion', 'el cambio que pide el usuario'), v('contexto', 'contexto del negocio')], scope: 'full', sensitive: false,
        default: CAMPAIGN_ADJUST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el spec actual y el cambio pedido. Mantén los slots {{specActual}}/{{instruccion}}/{{contexto}} y el pedido de devolver el JSON completo.',
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
        context: 'Toma la transcripción del video y la divide en secciones con títulos cortos (Hook, Problema, Oferta, CTA…) repartiendo el texto LITERAL, sin resumir, y devuelve JSON. Conserva el pedido de JSON {"secciones":[{"titulo","texto"}]} y la regla de no inventar/no resumir.',
      },
      {
        key: 'transcribe.analyze_image.user', source: 'override',
        label: 'Análisis de imagen del anuncio (GPT-4o visión)', kind: 'vision', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: IMAGE_PROMPT_BASE,
        context: 'Cuando el anuncio es imagen (no video), transcribe TODO el texto visible literal, describe lo que se ve y parte el mensaje en secciones, devolviendo JSON. Conserva el esquema JSON {"texto","descripcion","secciones"} o el guardado se rompe.',
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
        context: 'Lee un documento del cliente y completa los campos del onboarding (oferta, avatar, marca), devolviendo JSON. Regla clave: si un dato no aparece, lo omite (NO inventa). Conserva el formato JSON {"campos":{…}}, el slot {{lista}} y la regla de "no inventar".',
      },
      {
        key: 'archivero.extract.system', source: 'override',
        label: 'Extractor de campos de El Archivero', kind: 'system', dynamic: true,
        variables: [v('lista', 'los campos pedidos (clave: qué pide)')], scope: 'static-only', sensitive: true,
        default: ARCHIVERO_EXTRACT_TEMPLATE,
        context: 'Lee UN documento del cliente (de a uno, para atribuir qué campo salió de qué archivo) y completa los campos del negocio, devolviendo JSON con un "razonamiento" de UNA frase sobre qué aportó ese documento. Regla clave: si un dato no aparece, lo omite (NO inventa). Conserva el formato JSON {"campos":{…},"razonamiento":"…"}, el slot {{lista}} y la regla de "no inventar".',
      },
      {
        key: 'productos.system', source: 'override',
        label: 'Catálogo de productos del negocio (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: PRODUCTOS_SYSTEM_TEMPLATE,
        context: 'El paso "Tus productos" del onboarding: MaKo arma el catálogo leyendo el brief y El Archivero, para que el dueño CORRIJA en vez de redactar. Reglas que no se tocan: máximo 4, "no inventes una escalera de valor que no existe", y `monto_usd` en null cuando el contexto no dice el precio — una cifra inventada aquí termina siendo el pricing de un cierre real. Conserva la forma EXACTA del JSON o el paso no puede leer la respuesta.',
      },
      {
        key: 'productos.user', source: 'override',
        label: 'Brief + Archivero + lo ya cargado (user)', kind: 'user', dynamic: true,
        variables: [v('brief', 'el perfil del negocio del onboarding'), v('panorama', 'lo que MaKo entendió de tus documentos de El Archivero'), v('existentes', 'los productos ya cargados, enteros, para completarlos sin pisarlos')], scope: 'full', sensitive: false,
        default: PRODUCTOS_USER_TEMPLATE,
        context: 'El slot {{existentes}} lleva los productos YA cargados enteros (en JSON) para que MaKo complete lo vacío sin reescribir lo que el dueño escribió a mano. La garantía de que no se pisa NO es este texto: es el merge campo a campo de app/api/onboarding/productos/route.ts. Conserva los tres slots.',
      },
      {
        key: 'ofertas.system', source: 'override',
        label: 'La oferta del negocio (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: OFERTAS_SYSTEM_TEMPLATE,
        context: 'El paso "Tu oferta" del onboarding: MaKo la arma leyendo el brief y El Archivero, para que el dueño CORRIJA en vez de redactar. La regla que NO se toca es la de la urgencia: sólo se declara si el contexto documenta una restricción REAL, nunca se deduce — una fecha límite inventada aquí termina en un anuncio que le miente a un lead. Tampoco se parsea un precio de una frase: el rango va a "precio_nota". Conserva la forma EXACTA del JSON o el paso no puede leer la respuesta.',
      },
      {
        key: 'ofertas.user', source: 'override',
        label: 'Brief + Archivero + la oferta ya cargada (user)', kind: 'user', dynamic: true,
        variables: [v('brief', 'el perfil del negocio del onboarding'), v('panorama', 'lo que MaKo entendió de tus documentos de El Archivero'), v('actual', 'la oferta ya cargada, entera, para completarla sin pisarla')], scope: 'full', sensitive: false,
        default: OFERTAS_USER_TEMPLATE,
        context: 'El slot {{actual}} lleva la oferta YA cargada entera (en JSON) para que MaKo complete lo vacío sin reescribir lo que el dueño escribió a mano. La garantía de que no se pisa NO es este texto: es el merge campo a campo de app/api/onboarding/ofertas/route.ts. Conserva los tres slots.',
      },
      {
        key: 'contracts.extract_payment_plan.user', source: 'override',
        label: 'Extractor del contrato (pagos + Deal Details)', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: CONTRACT_EXTRACT_DEFAULT,
        context: 'Lee un contrato (PDF o imagen) y saca el plan de pagos (total USD, duración, fechas, cuotas) más las secciones del Deal Details (datos fiscales, servicio, promesa, obligaciones), resumidas en lenguaje simple, en JSON. Solo rellena campos VACÍOS del lead; nunca pisa lo cargado. Conserva la forma EXACTA del JSON o el autollenado del CRM se rompe.',
      },
      {
        key: 'contracts.extract_receipt.user', source: 'override',
        label: 'Extractor de comprobantes de pago', kind: 'user', dynamic: false, variables: [], scope: 'full', sensitive: true,
        default: RECEIPT_EXTRACT_DEFAULT,
        context: 'Lee un comprobante de pago (imagen o PDF) y saca monto en USD, fecha y hora en JSON, para prellenar el pop-up de "Marcar pagada" de una cuota. Conserva la forma EXACTA del JSON o el prellenado se rompe.',
      },
    ],
  },
  {
    group: 'Coach de checklist de tareas (MaKo)',
    icon: '✅',
    blurb: 'MaKo hace preguntas para entender la tarea y luego propone los ítems de la checklist en el tablero /todo.',
    entries: [
      {
        key: 'checklist.ask.system', source: 'override',
        label: 'Preguntas de encuadre multiple-choice (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de preguntas')], scope: 'static-only', sensitive: true,
        default: CHECKLIST_ASK_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a hacer 2-4 preguntas multiple-choice para entender la tarea. No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'checklist.ask.user', source: 'override',
        label: 'Datos de la tarea (user)', kind: 'user', dynamic: true,
        variables: [v('tarea', 'título/descripción de la tarea'), v('contexto', 'lo que el usuario ya contestó')], scope: 'full', sensitive: false,
        default: CHECKLIST_ASK_USER_TEMPLATE,
        context: 'Le pasa la tarea y las respuestas previas. No borres los slots {{tarea}}/{{contexto}}.',
      },
      {
        key: 'checklist.propose.system', source: 'override',
        label: 'Optimizar tarea: título+detalle+checklist (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: CHECKLIST_PROPOSE_SYSTEM_TEMPLATE,
        context: 'MaKo reescribe título y detalle y propone la checklist, todo como JSON. No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'checklist.propose.user', source: 'override',
        label: 'Respuestas + tarea (user)', kind: 'user', dynamic: true,
        variables: [v('tarea', 'la tarea'), v('respuestas', 'las respuestas del usuario a las preguntas')], scope: 'full', sensitive: false,
        default: CHECKLIST_PROPOSE_USER_TEMPLATE,
        context: 'Le pasa la tarea y las respuestas. No borres los slots {{tarea}}/{{respuestas}}.',
      },
      {
        key: 'proyecto.sugerir.system', source: 'override',
        label: 'Sugerir proyecto: nombre+emoji (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: PROYECTO_SYSTEM_TEMPLATE,
        context: 'MaKo propone nombre y emoji de un proyecto a partir de una descripción. No borres el slot {{jsonShape}}.',
      },
      {
        key: 'proyecto.sugerir.user', source: 'override',
        label: 'Descripción del proyecto (user)', kind: 'user', dynamic: true,
        variables: [v('descripcion', 'lo que el usuario describe del proyecto')], scope: 'full', sensitive: false,
        default: PROYECTO_USER_TEMPLATE,
        context: 'Le pasa la descripción del proyecto. No borres el slot {{descripcion}}.',
      },
    ],
  },
  {
    group: 'MaKo Perro Guardián (prioridades)',
    icon: '🛡️',
    blurb: 'Cómo el guardián puntúa proyectos y tareas (los dos 1-100) para decidir qué mueve la aguja.',
    entries: [
      {
        key: 'guardian.puntuar.system', source: 'override',
        label: 'Criterios del guardián (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: GUARDIAN_SYSTEM_TEMPLATE,
        context: 'Los criterios con los que MaKo prioriza (impacto, urgencia, esfuerzo/retorno, dependencias) y los rangos de score→columna. No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'guardian.puntuar.user', source: 'override',
        label: 'Plan a priorizar (user)', kind: 'user', dynamic: true,
        variables: [v('contexto', 'brief del negocio'), v('plan', 'proyectos+tareas en JSON, con id')], scope: 'full', sensitive: false,
        default: GUARDIAN_USER_TEMPLATE,
        context: 'Le pasa el negocio y el plan (con ids). No borres los slots {{contexto}}/{{plan}}.',
      },
      {
        key: 'guardian.debate.system', source: 'override',
        label: 'Debate de prioridad (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: GUARDIAN_DEBATE_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario debate la prioridad de una tarea, MaKo escucha, es exigente y decide el score (última palabra). No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'guardian.debate.user', source: 'override',
        label: 'Argumento del usuario (user)', kind: 'user', dynamic: true,
        variables: [v('scoreActual', 'score actual'), v('tarea', 'la tarea'), v('plan', 'resto del plan para comparar'), v('argumento', 'lo que argumenta el usuario')], scope: 'full', sensitive: false,
        default: GUARDIAN_DEBATE_USER_TEMPLATE,
        context: 'Le pasa la tarea, el plan y el argumento. No borres los slots {{scoreActual}}/{{tarea}}/{{plan}}/{{argumento}}.',
      },
      {
        key: 'guardian.proj-debate.system', source: 'override',
        label: 'Debate de prioridad de proyecto (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: GUARDIAN_PROJ_DEBATE_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario debate la prioridad (1-100) de un PROYECTO, MaKo compara contra los demás y decide (última palabra). No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'guardian.proj-debate.user', source: 'override',
        label: 'Argumento del proyecto (user)', kind: 'user', dynamic: true,
        variables: [v('scoreActual', 'prioridad actual 1-100'), v('proyecto', 'el proyecto'), v('plan', 'los demás proyectos'), v('argumento', 'lo que argumenta el usuario')], scope: 'full', sensitive: false,
        default: GUARDIAN_PROJ_DEBATE_USER_TEMPLATE,
        context: 'Le pasa el proyecto, los demás proyectos y el argumento. No borres los slots {{scoreActual}}/{{proyecto}}/{{plan}}/{{argumento}}.',
      },
      {
        key: 'retro.gate.system', source: 'override',
        label: 'Gate de la Retro: juzgar la excusa (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: GATE_SYSTEM_TEMPLATE,
        context: 'Cuando quieres correr una Retro nueva dejando cosas sin hacer de la anterior, el Perro decide si tu motivo se sostiene. Bájale el filo y el gate se vuelve decorativo. No borres el slot {{jsonShape}}.',
      },
      {
        key: 'retro.gate.user', source: 'override',
        label: 'Gate de la Retro: la deuda y el motivo (user)', kind: 'user', dynamic: true,
        variables: [v('dias', 'días desde la última Retro'), v('total', 'cuántas aceptaste'), v('hechas', 'cuántas completaste'), v('pendientes', 'cuántas quedaron'), v('pendiente', 'los títulos que quedaron colgados'), v('motivo', 'por qué quieres correr una igual')], scope: 'full', sensitive: false,
        default: GATE_USER_TEMPLATE,
        context: 'Le pasa la deuda real de la Retro anterior y tu motivo. No borres los slots {{dias}}/{{total}}/{{hechas}}/{{pendientes}}/{{pendiente}}/{{motivo}}.',
      },
      {
        key: 'guardian.cruce.system', source: 'override',
        label: 'Cruzar candidatas con el plan (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: CRUCE_SYSTEM_TEMPLATE,
        context: 'Al extraer tareas de una reunión/archivo, MaKo decide cuáles ya existen en el plan para enriquecerlas en vez de duplicar. No borres el slot {{jsonShape}}.',
      },
      {
        key: 'guardian.cruce.user', source: 'override',
        label: 'Cruzar candidatas con el plan (user)', kind: 'user', dynamic: true,
        variables: [v('candidatas', 'las tareas recién sacadas'), v('plan', 'las tareas del plan actual')], scope: 'full', sensitive: false,
        default: CRUCE_USER_TEMPLATE,
        context: 'Le pasa las candidatas y el plan actual. No borres los slots {{candidatas}}/{{plan}}.',
      },
      {
        key: 'guardian.rutear.system', source: 'override',
        label: 'Rutear tareas nuevas a proyectos existentes (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON'), v('reglaNombre', 'cómo se llama un proyecto nuevo (el prefijo «Feature: »)')], scope: 'static-only', sensitive: true,
        default: RUTEAR_SYSTEM_TEMPLATE,
        context: 'Al cargar tareas, MaKo decide POR TAREA a qué proyecto EXISTENTE va cada una (o si es trabajo nuevo), así no crea proyectos duplicados. Es preferible "nuevo" antes que forzar una tarea a un proyecto sólo parecido. No borres los slots {{jsonShape}}/{{reglaNombre}} — el segundo trae la regla del nombre, que vive en lib/plan-proyectos-catalogo.ts para que sea la misma aquí, en WhatsApp y en la skill.',
      },
      {
        key: 'guardian.rutear.user', source: 'override',
        label: 'Tareas nuevas + plan (user)', kind: 'user', dynamic: true,
        variables: [v('tareas', 'las tareas nuevas con el grupo que propuso MaKo'), v('plan', 'los proyectos que ya existen')], scope: 'full', sensitive: false,
        default: RUTEAR_USER_TEMPLATE,
        context: 'Le pasa las tareas nuevas y los proyectos existentes. No borres los slots {{tareas}}/{{plan}}.',
      },
      {
        key: 'guardian.duplicados.system', source: 'override',
        label: 'Buscar duplicados (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: DUP_SYSTEM_TEMPLATE,
        context: 'Encuentra tareas que sean el mismo trabajo aunque estén escritas distinto. No borres el slot {{jsonShape}}.',
      },
      {
        key: 'guardian.duplicados.user', source: 'override',
        label: 'Tarea + lista (user)', kind: 'user', dynamic: true,
        variables: [v('tarea', 'la posible duplicada'), v('lista', 'las demás tareas con id')], scope: 'full', sensitive: false,
        default: DUP_USER_TEMPLATE,
        context: 'Le pasa la tarea y la lista de otras. No borres los slots {{tarea}}/{{lista}}.',
      },
    ],
  },
  {

    group: 'MaKo · Reunión → Plan (Fathom)',
    icon: '🎙️',
    blurb: 'Cómo MaKo lee una reunión de Fathom y saca los action items concretos para el plan de ejecución.',
    entries: [
      {
        key: 'plan-fathom.extraer.system', source: 'override',
        label: 'Extraer tareas de reunión (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: PLAN_FATHOM_SYSTEM_TEMPLATE,
        context: 'Qué cuenta como action item del equipo (y qué no) al leer una reunión, y cómo sugiere proyecto+prioridad. No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'plan-fathom.extraer.user', source: 'override',
        label: 'Reunión + proyectos (user)', kind: 'user', dynamic: true,
        variables: [v('yo', 'quién mira el tablero (nombre + email)'), v('participantes', 'invitados de la reunión con nombre y email'), v('glosario', 'términos/nombres propios del negocio'), v('proyectos', 'lista de proyectos con id'), v('reunion', 'resumen + transcripción')], scope: 'full', sensitive: false,
        default: PLAN_FATHOM_USER_TEMPLATE,
        context: 'Le pasa quién mira el tablero (para el dueño de cada tarea), los participantes (para atribuirle a cada uno sus tareas por email), el glosario (para entender la jerga y corregir la transcripción), los proyectos y la reunión. No borres los slots {{yo}}/{{participantes}}/{{glosario}}/{{proyectos}}/{{reunion}}.',
      },
      {
        key: 'plan-fathom.dedup.system', source: 'override',
        label: 'Fusionar tareas repetidas (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: PLAN_FATHOM_DEDUP_SYSTEM_TEMPLATE,
        context: 'Segunda pasada sobre la lista YA extraída: agrupa las tareas que son la MISMA dicha en distintos momentos de la reunión (la fusionada se queda con todos los minutos). Ojo al aflojar las reglas duras: si agrupa de más, se pierden tareas reales.',
      },
      {
        key: 'plan-fathom.dedup.user', source: 'override',
        label: 'Lista de tareas a revisar (user)', kind: 'user', dynamic: true,
        variables: [v('tareas', 'lista numerada con minuto, título y detalle')], scope: 'full', sensitive: false,
        default: PLAN_FATHOM_DEDUP_USER_TEMPLATE,
        context: 'La lista numerada que se revisa. No borres el slot {{tareas}}.',
      },
      // ⛔ Las dos de «plan-fathom.preguntas» se fueron con el paso de preguntas del alta
      // (05/10/2026). Un override guardado con esas claves queda huérfano: no lo lee nadie.
      {
        key: 'plan-criterio.juez.system', source: 'override',
        label: 'Juzgar con el criterio de compromisos del cliente (system)', kind: 'system', dynamic: true,
        variables: [v('criterio', 'el criterio de compromisos del workspace (setting plan.criterio)'), v('dueno', 'el dueño del tablero'), v('jsonShape', 'forma EXACTA del JSON de salida')],
        scope: 'static-only', sensitive: true,
        default: CRITERIO_JUEZ_SYSTEM_TEMPLATE,
        context: 'Solo corre en los workspaces con criterio cargado. NO extrae: pone cada tarea ya extraída en su cubeta. El criterio en sí NO se edita aquí: es el setting plan.criterio del workspace. ⚠️ No saques que la cita es obligatoria y literal: el código la verifica contra la transcripción y la que no aparece baja la tarea a descartado.',
      },
      {
        key: 'plan-criterio.juez.user', source: 'override',
        label: 'Tareas + reunión a juzgar (user)', kind: 'user', dynamic: true,
        variables: [v('dueno', 'el dueño del tablero'), v('participantes', 'quiénes hablaron'), v('tareas', 'lista numerada de tareas'), v('reunion', 'la transcripción entera')],
        scope: 'full', sensitive: false,
        default: CRITERIO_JUEZ_USER_TEMPLATE,
        context: 'No borres los slots {{dueno}}/{{participantes}}/{{tareas}}/{{reunion}}.',
      },
    ],
  },
  {
    group: 'Experimentos (MaKo)',
    icon: '🧪',
    blurb: 'Cómo MaKo convierte una hipótesis en un experimento medible, propone experimentos desde el funnel y cierra un experimento concluyendo SOLO sobre el dato.',
    entries: [
      {
        key: 'experimentos.suggest.system', source: 'override',
        label: 'Sugerir experimento desde una hipótesis (system)', kind: 'system', dynamic: true,
        variables: [v('catalogo', 'catálogo de métricas disponibles')], scope: 'static-only', sensitive: true,
        default: EXP_SUGGEST_SYSTEM_DEFAULT,
        context: 'Convierte una hipótesis de Martín en un experimento honesto (métrica, cambio, criterio de éxito) y define la forma EXACTA del JSON de salida. No borres el slot {{catalogo}} ni cambies el esquema JSON o la propuesta se rompe.',
      },
      {
        key: 'experimentos.suggest.user', source: 'override',
        label: 'Hipótesis + contexto (user)', kind: 'user', dynamic: true,
        variables: [v('hipotesis', 'la hipótesis de Martín'), v('contexto', 'lo que vio / por qué lo cree (opcional)'), v('snapshot', 'foto del funnel real')], scope: 'full', sensitive: false,
        default: EXP_SUGGEST_USER_DEFAULT,
        context: 'Le pasa la hipótesis, el contexto opcional y el snapshot del funnel. Conserva los slots; sin ellos MaKo elige peor la métrica.',
      },
      {
        key: 'experimentos.ideas.system', source: 'override',
        label: 'Proponer experimentos desde el funnel (system)', kind: 'system', dynamic: true,
        variables: [v('catalogo', 'catálogo de métricas disponibles'), v('n', 'cuántas ideas proponer')], scope: 'static-only', sensitive: true,
        default: EXP_IDEAS_SYSTEM_DEFAULT,
        context: 'MaKo mira el funnel y propone experimentos (nunca conclusiones), devolviendo un array JSON. No borres los slots {{catalogo}}/{{n}} ni cambies el esquema.',
      },
      {
        key: 'experimentos.ideas.user', source: 'override',
        label: 'Snapshot del funnel + en curso (user)', kind: 'user', dynamic: true,
        variables: [v('snapshot', 'foto del funnel real'), v('enCurso', 'experimentos activos/propuestos'), v('n', 'cuántas ideas')], scope: 'full', sensitive: false,
        default: EXP_IDEAS_USER_DEFAULT,
        context: 'Le pasa el snapshot del funnel y los experimentos en curso (para no repetir). Conserva los slots.',
      },
      {
        key: 'experimentos.close.system', source: 'override',
        label: 'Cerrar un experimento (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: EXP_CLOSE_SYSTEM_DEFAULT,
        context: 'Aquí MaKo SÍ concluye — pero solo sobre el dato medido, nunca sobre la intuición. Define el veredicto y el aprendizaje. Conserva la forma del JSON de salida.',
      },
      {
        key: 'experimentos.close.user', source: 'override',
        label: 'Datos del experimento cerrado (user)', kind: 'user', dynamic: true,
        variables: [v('titulo', 'título'), v('hipotesis', 'hipótesis'), v('cambio', 'qué se cambió'), v('metrica_label', 'métrica medida'), v('direccion', 'subir/bajar'), v('criterio', 'criterio de éxito'), v('baseline_rango', 'rango del baseline'), v('baseline', 'valor baseline'), v('resultado_rango', 'rango del resultado'), v('resultado', 'valor resultado'), v('objetivo', 'objetivo numérico'), v('delta', 'variación %'), v('serie', 'serie temporal medida')], scope: 'full', sensitive: false,
        default: EXP_CLOSE_USER_DEFAULT,
        context: 'Le pasa el experimento y su medición (baseline comparable + resultado + serie) para que el veredicto compare manzanas con manzanas. Conserva los 13 slots o el texto se desalinea.',
      },
    ],
  },
  {
    group: 'Retro (MaKo · retrospectivas v3)',
    icon: '🔁',
    blurb: 'El pipeline de la retrospectiva: MaKo diagnostica cada área, busca cruces entre áreas, organiza el reporte y lo verifica contra los números.',
    entries: [
      {
        key: 'retro3.area.system', source: 'override',
        label: 'Diagnóstico por área (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: RETRO3_AREA_SYSTEM,
        context: 'Cómo MaKo diagnostica UN área del negocio para la retro, usando SOLO los números medidos (JSON "datos") como fuente de verdad. Conserva la forma del JSON de salida.',
      },
      {
        key: 'retro3.cruces.system', source: 'override',
        label: 'Cruces entre áreas (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: RETRO3_CRUCES_SYSTEM,
        context: 'Cómo MaKo busca insights que NINGUNA pestaña muestra sola (cruces entre áreas). Conserva el esquema JSON de salida.',
      },
      {
        key: 'retro3.cerebro.system', source: 'override',
        label: 'Cerebro organizador del reporte (system)', kind: 'system', dynamic: true,
        variables: [v('catalogo', 'catálogo de métricas disponibles')], scope: 'static-only', sensitive: true,
        default: RETRO3_CEREBRO_SYSTEM,
        context: 'El cerebro que arma el reporte final de la retro a partir de todo lo recolectado (dato duro, hallazgos, cruces, perspectiva de Martín). No borres el slot {{catalogo}} ni cambies el esquema JSON.',
      },
      {
        key: 'retro3.verificacion.system', source: 'override',
        label: 'Verificador del reporte (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: RETRO3_VERIF_SYSTEM,
        context: 'El verificador que contrasta el borrador del reporte contra los números medidos antes de publicarlo. Conserva el esquema JSON de salida.',
      },
    ],
  },
  // La tab Offer (11/10/2026): Offer Analyst + Offer Generator en un chat. El MARCO viaja por el slot
  // {{marco}} y no pegado en el texto, a propósito: un override guardado desde /configuraciones no
  // congela una versión vieja del marco (lib/offer-marco.ts es la única fuente). Lo que el código
  // corrige sobre la salida (una pregunta por turno, el total, el cuello, lo que el dueño no dio) vive
  // en lib/offer-reglas.ts: aunque el texto se edite, esa segunda capa no se apaga.
  {
    group: 'Offer (MaKo conversa, diagnostica y arma la oferta)',
    icon: '🎯',
    blurb: 'La tab Offer: MaKo le pregunta al dueño por su oferta de a una pregunta, la diagnostica con la rúbrica de 9 dimensiones y escribe la oferta nueva para el PDF.',
    entries: [
      {
        key: 'offer.turno.system', source: 'override',
        label: 'La conversación: cómo pregunta MaKo (system)', kind: 'system', dynamic: true,
        variables: [v('marco', 'el marco de oferta entero: piezas, rúbrica y reglas (lib/offer-marco.ts)'), v('guia', 'las preguntas de la guía, en orden de prioridad')], scope: 'static-only', sensitive: true,
        default: OFFER_TURNO_SYSTEM_TEMPLATE,
        context: 'Cada turno del chat de Offer. Reglas que no se tocan: UNA pregunta por mensaje, nunca re-preguntar lo que ya se sabe, pedir primero un documento o el link de la web, construir con preguntas cerradas lo que falta, opciones cerradas a medida del negocio, «sin dato» sólo si ni con opciones lo define, las preguntas del diagnóstico de fase ADAPTADAS sin cambiar sus números ni su orden (y sin decirle al dueño el resultado), preguntar SIEMPRE y temprano si vende otras ofertas (entra al aviso de foco), pulir la oferta después del PDF empezando por lo que propone ese mensaje, y el JSON exacto. El código corta una segunda pregunta, decide cuándo una pregunta del diagnóstico es obligatoria, devuelve a la opción original la adaptada que cambie un número y decide solo cuándo ofrecer «Armar mi oferta» (lib/offer-reglas.ts). Conserva los slots {{marco}} y {{guia}}. Y no lo pases a voseo: lo lee el cliente.',
      },
      {
        key: 'offer.turno.user', source: 'override',
        label: 'La conversación: lo que MaKo lee en cada turno (user)', kind: 'user', dynamic: true,
        variables: [v('contexto', 'lo que el negocio ya tenía cargado (perfil, Archivero, el funnel y sus ofertas, productos, avatares, razones, fase)'), v('piezas', 'lo que ya se sabe de cada pieza'), v('faltan', 'las piezas que faltan'), v('documentos', 'el texto de los documentos y las webs que mandó el dueño'), v('diagnostico', 'la próxima pregunta del diagnóstico de fase con sus 5 opciones originales, y si es obligatoria (la decide el código)'), v('conversacion', 'los últimos 30 mensajes, con quién dijo qué')], scope: 'full', sensitive: false,
        default: OFFER_TURNO_USER_TEMPLATE,
        context: 'Los datos del turno. Lo que viene del dueño va envuelto como dato no confiable; el bloque del diagnóstico NO (lo escribe el código y trae la orden de si la pregunta es obligatoria). Conserva los seis slots y la orden del JSON del final: un modelo chico pesa más lo último que lee.',
      },
      {
        key: 'offer.diagnostico.system', source: 'override',
        label: 'El diagnóstico de la oferta actual (system)', kind: 'system', dynamic: true,
        variables: [v('marco', 'el marco de oferta entero: piezas, rúbrica y reglas (lib/offer-marco.ts)')], scope: 'static-only', sensitive: true,
        default: OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE,
        context: 'Las 9 notas con su porqué citando al dueño, la tesis, lo más fuerte y 3 cambios como HIPÓTESIS para probar en Experiments (con menos, el código completa los que faltan con «[completar]»). El total, el cuello de botella y si está lista los calcula el código, no el modelo. Conserva la forma EXACTA del JSON (las 9 dimensiones) o el diagnóstico se descarta.',
      },
      {
        key: 'offer.diagnostico.user', source: 'override',
        label: 'El diagnóstico: lo que MaKo lee (user)', kind: 'user', dynamic: true,
        variables: [v('contexto', 'lo que el negocio ya tenía cargado'), v('embudo', 'el embudo de los últimos 90 días'), v('alertas', 'los avisos que calculó el código antes del diagnóstico: foco, margen, dónde se cortan las ventas y cuándo subir el precio'), v('piezas', 'lo que se sabe de cada pieza'), v('documentos', 'el texto de los documentos'), v('conversacion', 'los últimos 30 mensajes')], scope: 'full', sensitive: false,
        default: OFFER_DIAGNOSTICO_USER_TEMPLATE,
        context: 'Los datos del diagnóstico. El embudo va para que MaKo diga primero dónde se corta antes de culpar a la oferta, y los avisos los calcula el código ANTES para que la IA que pone las notas los vea (el de foco pesa en D9). Conserva los seis slots y la orden del JSON del final.',
      },
      {
        key: 'offer.propuesta.system', source: 'override',
        label: 'La oferta nueva (system)', kind: 'system', dynamic: true,
        variables: [v('marco', 'el marco de oferta entero: piezas, rúbrica y reglas (lib/offer-marco.ts)')], scope: 'static-only', sensitive: true,
        default: OFFER_PROPUESTA_SYSTEM_TEMPLATE,
        context: 'La plantilla de la oferta, sección por sección, con «[completar]» donde falte un dato que el dueño no dio. La regla que NO se toca: nunca inventar testimonios, cifras de casos, valores de bonos, cupos ni fechas. El código igual revisa cada cifra contra lo que dio el negocio (la prueba, los bonos, el valor total y los cupos, y las cifras de resultados de la frase, los mensajes, los escenarios y la ecuación), corta las listas a los topes del marco, corrige los nombres del método y marca la garantía incondicional, la duración fuera de 90 a 180 días y el precio por debajo de 1.000 USD. «propuestoPorMako» va a una sección aparte del PDF. Conserva la forma EXACTA del JSON o la pantalla y el PDF no pueden leerla.',
      },
      {
        key: 'offer.propuesta.user', source: 'override',
        label: 'La oferta nueva: lo que MaKo lee (user)', kind: 'user', dynamic: true,
        variables: [v('contexto', 'lo que el negocio ya tenía cargado'), v('piezas', 'lo que dio el dueño de cada pieza'), v('diagnostico', 'el diagnóstico con el cálculo del sistema'), v('documentos', 'el texto de los documentos'), v('conversacion', 'los últimos 30 mensajes')], scope: 'full', sensitive: false,
        default: OFFER_PROPUESTA_USER_TEMPLATE,
        context: 'Los datos para escribir la oferta nueva, con el diagnóstico de la actual. Conserva los cinco slots y la orden del JSON del final.',
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
