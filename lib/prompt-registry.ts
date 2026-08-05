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
} from './ads-analyst';
import { LANDING_ANALYZE_SYSTEM_TEMPLATE, LANDING_ANALYZE_USER_TEMPLATE } from './landing-analyst';
import {
  LANDING_SUGGEST_SYSTEM_TEMPLATE,
  LANDING_SUGGEST_USER_TEMPLATE,
  LANDING_ADJUST_SYSTEM_TEMPLATE,
  LANDING_ADJUST_USER_TEMPLATE,
} from './landing-writer';
import { TEMPLATE_VALIDATOR_SYSTEM_TEMPLATE, TEMPLATE_VALIDATOR_USER_TEMPLATE } from './template-validator';
import { SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE, SETTING_CRITERIO_TEMPLATE } from './setting-secuencias';
import { SETTING_SIMULADOR_SYSTEM_TEMPLATE } from './setting-simulador';
import { SETTING_ENSAYO_SYSTEM_TEMPLATE } from '@/app/api/chat-agent/onboarding/ensayo/route';
import { VOZ_SEGMENTAR_TEMPLATE, VOZ_ANALISIS_SYSTEM_TEMPLATE, VOZ_ANALISIS_USER_TEMPLATE, VOZ_PREGUNTAS_TEMPLATE } from './chat-agent-voz';
import { VARIANTES_SYSTEM_TEMPLATE } from './secuencias-variantes';
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
import {
  AD_COPY_SUGGEST_SYSTEM_TEMPLATE,
  AD_COPY_SUGGEST_USER_TEMPLATE,
  AD_COPY_ADJUST_SYSTEM_TEMPLATE,
  AD_COPY_ADJUST_USER_TEMPLATE,
} from './ad-copy';
import { NUTRI_VOZ_SYSTEM_TEMPLATE, NUTRI_VOZ_USER_TEMPLATE, NUTRI_GEN_SYSTEM_TEMPLATE, NUTRI_GEN_USER_TEMPLATE } from './nutricion-generator';
import { POST_LLAMADA_SYSTEM_TEMPLATE, POST_LLAMADA_USER_TEMPLATE } from './post-llamada';
import { NUTRI_PLANTILLA_SYSTEM_TEMPLATE, NUTRI_PLANTILLA_USER_TEMPLATE } from './nutricion-plantillas';
import {
  CHECKLIST_ASK_SYSTEM_TEMPLATE, CHECKLIST_ASK_USER_TEMPLATE,
  CHECKLIST_PROPOSE_SYSTEM_TEMPLATE, CHECKLIST_PROPOSE_USER_TEMPLATE,
  PROYECTO_SYSTEM_TEMPLATE, PROYECTO_USER_TEMPLATE,
} from './checklist-coach';
import { PLAN_FATHOM_SYSTEM_TEMPLATE, PLAN_FATHOM_USER_TEMPLATE, PLAN_FATHOM_DEDUP_SYSTEM_TEMPLATE, PLAN_FATHOM_DEDUP_USER_TEMPLATE, PLAN_FATHOM_PREGUNTAS_SYSTEM_TEMPLATE, PLAN_FATHOM_PREGUNTAS_USER_TEMPLATE } from './plan-fathom';
import { GUARDIAN_SYSTEM_TEMPLATE, GUARDIAN_USER_TEMPLATE, GUARDIAN_DEBATE_SYSTEM_TEMPLATE, GUARDIAN_DEBATE_USER_TEMPLATE, GUARDIAN_PROJ_DEBATE_SYSTEM_TEMPLATE, GUARDIAN_PROJ_DEBATE_USER_TEMPLATE, ELIMINAR_SYSTEM_TEMPLATE, ELIMINAR_USER_TEMPLATE, DUP_SYSTEM_TEMPLATE, DUP_USER_TEMPLATE } from './mako-guardian';
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
    group: 'Nutrición — voz del negocio (MaKo)',
    icon: '🗣️',
    blurb: 'MaKo aprende cómo comunica el cliente (de sus anuncios + el perfil de marca) para escribir la nutrición en su voz. Esta guía de voz se destila una vez y se puede editar.',
    entries: [
      {
        key: 'nutri.voz.system', source: 'override',
        label: 'Destilador de voz (system)', kind: 'system', dynamic: false,
        variables: [], scope: 'static-only', sensitive: false,
        default: NUTRI_VOZ_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a destilar una "guía de voz" (tono, vocabulario, muletillas, qué nunca hace, ejemplos) a partir del perfil de marca y las transcripciones de los anuncios del cliente. Priorizá la fidelidad al estilo real por sobre el marketing genérico.',
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
        key: 'setting.ensayo', source: 'override',
        label: 'Onboarding — MaKo hace de CLIENTE (system)', kind: 'system', dynamic: true,
        variables: [v('perfil', 'perfil del negocio'), v('funnel', 'proceso comercial del negocio')], scope: 'static-only', sensitive: false,
        default: SETTING_ENSAYO_SYSTEM_TEMPLATE,
        context: 'El ensayo del onboarding: MaKo se pone del lado del LEAD y el dueño responde. Es el INVERSO del simulador. No borres los slots ni las reglas de "escribís como escribe la gente por WhatsApp".',
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
    group: 'Análisis y valoración de guiones de ads (Ads Analyst)',
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
    group: 'Diagnóstico de la landing (Landing Analyst)',
    icon: '🌐',
    blurb: 'MaKo baja tu landing, le lee el copy y lo cruza con el comportamiento real de esa página (visitas, retención del video, agendas) para decirte qué cambiar primero.',
    entries: [
      {
        key: 'landing_analyst.analyze.system', source: 'override',
        label: 'Instrucciones de diagnóstico de landing (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: LANDING_ANALYZE_SYSTEM_TEMPLATE,
        context: 'El cerebro del Landing Analyst: las 5 dimensiones que puntúa (Claridad, Promesa, Prueba, Llamado a la acción, Fricción), la regla de que cada hallazgo va CITADO con texto literal de la página, la prohibición de inventar métricas y la forma EXACTA del JSON. Si cambiás los labels de las dimensiones o el esquema, la pantalla deja de poder leer el análisis.',
      },
      {
        key: 'landing_analyst.analyze.user', source: 'override',
        label: 'Página + comportamiento medido (user)', kind: 'user', dynamic: true,
        variables: [v('meta', 'URL, título y meta descripción de la página'), v('comportamiento', 'visitas, visitantes, retención y agendas REALES de esa URL'), v('negocio', 'funnel + perfil del negocio'), v('copy', 'el copy de la página en orden de lectura')], scope: 'full', sensitive: false,
        default: LANDING_ANALYZE_USER_TEMPLATE,
        context: 'Le pasa a MaKo la página bajada y las métricas reales de esa misma URL. El bloque de comportamiento lo calcula el CÓDIGO (nunca la IA): es lo que le permite decir "la promesa se entiende pero el 70% se va antes del botón". Conservá los slots y la cláusula de seguridad del copy.',
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
        context: 'Pone a MaKo a escribir el copy terminado de la página, derivando el CTA del funnel. NO borres el bloque "PROHIBIDO INVENTAR": es lo que impide que salga una landing con testimonios y cifras falsas, que es un problema legal y no una sugerencia. Conservá los slots {{metodologia}}/{{jsonShape}} y el esquema del JSON o la pantalla de revisión no puede leer la propuesta.',
      },
      {
        key: 'landing_writer.suggest.user', source: 'override',
        label: 'Pedido + contexto + diagnóstico (user)', kind: 'user', dynamic: true,
        variables: [v('pedido', 'lo que pidió el usuario'), v('objetivo', 'objetivo de la página y su criterio'), v('contexto', 'funnel + perfil + método'), v('diagnostico', 'diagnóstico del Landing Analyst si esa URL ya se analizó')], scope: 'full', sensitive: false,
        default: LANDING_SUGGEST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el pedido y el contexto real del negocio. El slot {{diagnostico}} es el que cierra el loop analizar → reescribir: cuando la URL ya pasó por el Landing Analyst, entran sus hallazgos para que la versión nueva los resuelva. Conservá los slots.',
      },
      {
        key: 'landing_writer.adjust.system', source: 'override',
        label: 'Ajuste de la landing (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: LANDING_ADJUST_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario pide cambios sobre una propuesta, MaKo aplica SOLO lo pedido y conserva el resto palabra por palabra. Conservá el slot {{jsonShape}} y la regla de no reescribir bloques que no se pidieron.',
      },
      {
        key: 'landing_writer.adjust.user', source: 'override',
        label: 'Spec actual + cambio pedido (user)', kind: 'user', dynamic: true,
        variables: [v('specActual', 'el LandingSpec actual en JSON'), v('instruccion', 'el cambio que pide el usuario'), v('contexto', 'contexto del negocio')], scope: 'full', sensitive: false,
        default: LANDING_ADJUST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el spec actual y el cambio pedido. Mantené los slots y el pedido de devolver el JSON COMPLETO (si devuelve solo el bloque cambiado, se pierde el resto de la página).',
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
        key: 'archivero.extract.system', source: 'override',
        label: 'Extractor de campos de El Archivero', kind: 'system', dynamic: true,
        variables: [v('lista', 'los campos pedidos (clave: qué pide)')], scope: 'static-only', sensitive: true,
        default: ARCHIVERO_EXTRACT_TEMPLATE,
        context: 'Lee UN documento del cliente (de a uno, para atribuir qué campo salió de qué archivo) y completa los campos del negocio, devolviendo JSON con un "razonamiento" de UNA frase sobre qué aportó ese documento. Regla clave: si un dato no aparece, lo omite (NO inventa). Conservá el formato JSON {"campos":{…},"razonamiento":"…"}, el slot {{lista}} y la regla de "no inventar".',
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
  {
    group: 'Ads Writer (copy de anuncios)',
    icon: '✍️',
    blurb: 'MaKo escribe variantes de copy de anuncios de Meta aterrizadas en los datos reales del negocio (oferta, avatar, funnel, ganadores), cada una con un ángulo distinto. El copy sale en español mexicano; la voz de MaKo va solo en la nota.',
    entries: [
      {
        key: 'ads_writer.suggest.system', source: 'override',
        label: 'Escribir copy de anuncios (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: AD_COPY_SUGGEST_SYSTEM_TEMPLATE,
        context: 'Pone a MaKo a escribir variantes de copy de anuncios de Meta a partir del pedido y el brief del negocio. Define las reglas de copy y de idioma (español mexicano en el anuncio, voz rioplatense solo en la nota). No borres el slot {{jsonShape}} ni cambies el esquema del JSON o la pantalla deja de poder mostrar las variantes.',
      },
      {
        key: 'ads_writer.suggest.user', source: 'override',
        label: 'Pedido + contexto del negocio (user)', kind: 'user', dynamic: true,
        variables: [v('prompt', 'lo que pidió el usuario'), v('contexto', 'brief del negocio: funnel + perfil + KPIs + ganadores')], scope: 'full', sensitive: false,
        default: AD_COPY_SUGGEST_USER_TEMPLATE,
        context: 'Le pasa a MaKo el pedido del usuario y el contexto real del negocio. Conservá los slots {{prompt}}/{{contexto}} y el pedido final del JSON.',
      },
      {
        key: 'ads_writer.adjust.system', source: 'override',
        label: 'Ajuste de copy (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: AD_COPY_ADJUST_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario pide un cambio a variantes ya escritas, MaKo aplica SOLO lo pedido y conserva el resto, manteniendo las reglas de copy e idioma. Conservá el slot {{jsonShape}} y el esquema del JSON.',
      },
      {
        key: 'ads_writer.adjust.user', source: 'override',
        label: 'Variantes actuales + cambio pedido (user)', kind: 'user', dynamic: true,
        variables: [v('setActual', 'las variantes actuales en JSON'), v('instruccion', 'el cambio que pide el usuario'), v('contexto', 'brief del negocio')], scope: 'full', sensitive: false,
        default: AD_COPY_ADJUST_USER_TEMPLATE,
        context: 'Le pasa a MaKo las variantes actuales y el cambio pedido. Mantené los slots {{setActual}}/{{instruccion}}/{{contexto}} y el pedido de devolver el JSON completo.',
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
    blurb: 'Cómo el guardián puntúa proyectos (1-5) y tareas (1-100) para decidir qué mueve la aguja.',
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
        context: 'Cuando el usuario debate la prioridad (1-10) de un PROYECTO, MaKo compara contra los demás y decide (última palabra). No borres el slot {{jsonShape}} ni cambies el esquema.',
      },
      {
        key: 'guardian.proj-debate.user', source: 'override',
        label: 'Argumento del proyecto (user)', kind: 'user', dynamic: true,
        variables: [v('scoreActual', 'prioridad actual 1-10'), v('proyecto', 'el proyecto'), v('plan', 'los demás proyectos'), v('argumento', 'lo que argumenta el usuario')], scope: 'full', sensitive: false,
        default: GUARDIAN_PROJ_DEBATE_USER_TEMPLATE,
        context: 'Le pasa el proyecto, los demás proyectos y el argumento. No borres los slots {{scoreActual}}/{{proyecto}}/{{plan}}/{{argumento}}.',
      },
      {
        key: 'retro.gate.system', source: 'override',
        label: 'Gate de la Retro: juzgar la excusa (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: GATE_SYSTEM_TEMPLATE,
        context: 'Cuando querés correr una Retro nueva dejando cosas sin hacer de la anterior, el Perro decide si tu motivo se sostiene. Bajale el filo y el gate se vuelve decorativo. No borres el slot {{jsonShape}}.',
      },
      {
        key: 'retro.gate.user', source: 'override',
        label: 'Gate de la Retro: la deuda y el motivo (user)', kind: 'user', dynamic: true,
        variables: [v('dias', 'días desde la última Retro'), v('total', 'cuántas aceptaste'), v('hechas', 'cuántas completaste'), v('pendientes', 'cuántas quedaron'), v('pendiente', 'los títulos que quedaron colgados'), v('motivo', 'por qué querés correr una igual')], scope: 'full', sensitive: false,
        default: GATE_USER_TEMPLATE,
        context: 'Le pasa la deuda real de la Retro anterior y tu motivo. No borres los slots {{dias}}/{{total}}/{{hechas}}/{{pendientes}}/{{pendiente}}/{{motivo}}.',
      },
      {
        key: 'guardian.eliminar.system', source: 'override',
        label: 'Decidir si borrar (system)', kind: 'system', dynamic: true,
        variables: [v('tipo', 'tarea | proyecto'), v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: ELIMINAR_SYSTEM_TEMPLATE,
        context: 'Cuando el usuario quiere borrar algo, MaKo decide si vale la pena (borrar es destructivo). No borres los slots {{tipo}}/{{jsonShape}}.',
      },
      {
        key: 'guardian.eliminar.user', source: 'override',
        label: 'Qué se quiere borrar (user)', kind: 'user', dynamic: true,
        variables: [v('que', 'el elemento'), v('motivo', 'por qué lo borra'), v('plan', 'resto del plan')], scope: 'full', sensitive: false,
        default: ELIMINAR_USER_TEMPLATE,
        context: 'Le pasa el elemento, el motivo y el plan. No borres los slots {{que}}/{{motivo}}/{{plan}}.',
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
        variables: [v('jsonShape', 'forma EXACTA del JSON')], scope: 'static-only', sensitive: true,
        default: RUTEAR_SYSTEM_TEMPLATE,
        context: 'Al cargar tareas, MaKo decide POR TAREA a qué proyecto EXISTENTE va cada una (o si es trabajo nuevo), así no crea proyectos duplicados. Es preferible "nuevo" antes que forzar una tarea a un proyecto sólo parecido. No borres el slot {{jsonShape}}.',
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
      {
        key: 'plan-fathom.preguntas.system', source: 'override',
        label: 'Preguntas de contexto de la reunión (system)', kind: 'system', dynamic: true,
        variables: [v('jsonShape', 'forma EXACTA del JSON de salida')], scope: 'static-only', sensitive: true,
        default: PLAN_FATHOM_PREGUNTAS_SYSTEM_TEMPLATE,
        context: 'Las preguntas CERRADAS que MaKo hace antes de cargar las tareas de una reunión. Regla que no se toca: nunca pregunta por prioridad (eso lo decide el Perro), solo hechos que no puede deducir.',
      },
      {
        key: 'plan-fathom.preguntas.user', source: 'override',
        label: 'Reunión + tareas para preguntar (user)', kind: 'user', dynamic: true,
        variables: [v('reunion', 'título de la reunión'), v('tareas', 'lista de tareas propias')], scope: 'full', sensitive: false,
        default: PLAN_FATHOM_PREGUNTAS_USER_TEMPLATE,
        context: 'No borres los slots {{reunion}}/{{tareas}}.',
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
        context: 'Le pasa la hipótesis, el contexto opcional y el snapshot del funnel. Conservá los slots; sin ellos MaKo elige peor la métrica.',
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
        context: 'Le pasa el snapshot del funnel y los experimentos en curso (para no repetir). Conservá los slots.',
      },
      {
        key: 'experimentos.close.system', source: 'override',
        label: 'Cerrar un experimento (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: EXP_CLOSE_SYSTEM_DEFAULT,
        context: 'Acá MaKo SÍ concluye — pero solo sobre el dato medido, nunca sobre la intuición. Define el veredicto y el aprendizaje. Conservá la forma del JSON de salida.',
      },
      {
        key: 'experimentos.close.user', source: 'override',
        label: 'Datos del experimento cerrado (user)', kind: 'user', dynamic: true,
        variables: [v('titulo', 'título'), v('hipotesis', 'hipótesis'), v('cambio', 'qué se cambió'), v('metrica_label', 'métrica medida'), v('direccion', 'subir/bajar'), v('criterio', 'criterio de éxito'), v('baseline_rango', 'rango del baseline'), v('baseline', 'valor baseline'), v('resultado_rango', 'rango del resultado'), v('resultado', 'valor resultado'), v('objetivo', 'objetivo numérico'), v('delta', 'variación %'), v('serie', 'serie temporal medida')], scope: 'full', sensitive: false,
        default: EXP_CLOSE_USER_DEFAULT,
        context: 'Le pasa el experimento y su medición (baseline comparable + resultado + serie) para que el veredicto compare manzanas con manzanas. Conservá los 13 slots o el texto se desalinea.',
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
        context: 'Cómo MaKo diagnostica UN área del negocio para la retro, usando SOLO los números medidos (JSON "datos") como fuente de verdad. Conservá la forma del JSON de salida.',
      },
      {
        key: 'retro3.cruces.system', source: 'override',
        label: 'Cruces entre áreas (system)', kind: 'system', dynamic: false, variables: [], scope: 'static-only', sensitive: true,
        default: RETRO3_CRUCES_SYSTEM,
        context: 'Cómo MaKo busca insights que NINGUNA pestaña muestra sola (cruces entre áreas). Conservá el esquema JSON de salida.',
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
        context: 'El verificador que contrasta el borrador del reporte contra los números medidos antes de publicarlo. Conservá el esquema JSON de salida.',
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
