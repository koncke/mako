// =============================================================================
// model-registry — qué MODELO / IA usa cada tarea (config-driven, editable)
// =============================================================================
// Como el prompt-registry pero para el MODELO: cada "feature" (tag de gasto) tiene
// un modelo por default (del código / recomendación del audit) que se puede pisar
// desde la tab de SuperAdmin. chatClaude/chatCheap leen el override en runtime:
// cambiar acá el modelo o la IA re-rutea las llamadas de verdad, sin tocar código.
//
// provider: 'anthropic' (Claude) | 'groq' | 'openai'. Cambiar de provider a uno
// barato solo tiene sentido en tareas SIMPLES (ver `recomendado`); las de
// razonamiento/voz de marca/PII se quedan en Claude.

import 'server-only';
import { getSetting, setSetting } from '@/lib/settings';
import { OWNER_WS, runWithWorkspace } from '@/lib/workspace';

export type Proveedor = 'anthropic' | 'groq' | 'openai';
export type ModeloRef = { provider: Proveedor; model: string };
export type FeatureModelo = {
  feature: string;          // tag de gasto (el que se pasa a chatClaude/chatCheap)
  label: string;            // nombre legible
  grupo: string;            // agrupador para la UI
  def: ModeloRef;           // modelo por default (lo que usa hoy el código)
  recomendado?: ModeloRef;  // sugerencia del audit (si conviene mover a barato)
  pii?: boolean;            // el prompt lleva datos de clientes
  nota?: string;
};

const CLAUDE = (model = 'claude-opus-4-8'): ModeloRef => ({ provider: 'anthropic', model });
const SONNET: ModeloRef = { provider: 'anthropic', model: 'claude-sonnet-5' };
const GROQ = (model = 'openai/gpt-oss-20b'): ModeloRef => ({ provider: 'groq', model });
const GROQ_WHISPER: ModeloRef = { provider: 'groq', model: 'whisper-large-v3-turbo' };

// Catálogo de TODOS los procesos de IA de la app (del audit). Cada `feature` es el
// tag REAL que el call-site le pasa a chatClaude/chatCheap: si no coincide, el
// override no aplica. Regla de tiers: PII + razonamiento fino → Claude (Opus o
// Sonnet); voz de marca → Claude (probar Sonnet); simple sin PII → Groq.
export const CATALOGO_MODELOS: FeatureModelo[] = [
  // ── MaKo conversacional / agentes con herramientas ──────────────────────────
  // El doer usa el ROUTER (lib/mako-router): elige por turno barato/Sonnet/Opus.
  // El default acá es el "piso" (Sonnet) cuando lo pin-eás; el router escala a Opus
  // solo para razonamiento/copy/media. Menos Opus por default.
  { feature: 'mako-doer-in', label: 'MaKo en WhatsApp (Hola MaKo)', grupo: 'MaKo', def: SONNET, pii: true, nota: 'Doer con herramientas. El router elige por turno: charla → barato, dato/acción → Sonnet, análisis → Opus.' },
  { feature: 'mako-doer', label: 'MaKo Doer — acciones en la web', grupo: 'MaKo', def: SONNET, nota: 'Agente con herramientas. Sonnet por default.' },
  { feature: 'mako-chat', label: 'MaKo — chat sobre un gráfico', grupo: 'MaKo', def: SONNET, nota: 'Chat sobre un dashboard. Sonnet alcanza.' },
  { feature: 'mako-guardian', label: 'Perro Guardián — cerebro de priorización (/plan)', grupo: 'MaKo', def: SONNET, nota: 'Debate prioridades, re-prioriza el plan y detecta duplicados. Razonamiento fino en Claude (Sonnet).' },
  { feature: 'checklist-coach', label: 'MaKo te ayuda (tareas y proyectos)', grupo: 'MaKo', def: SONNET, nota: 'Genera preguntas, optimiza la tarea y propone el proyecto en /plan.' },

  // ── Análisis pesado sobre datos reales → OPUS (los únicos que se quedan) ─────
  { feature: 'closing', label: 'Análisis de llamadas de venta', grupo: 'Análisis', def: CLAUDE(), pii: true, recomendado: CLAUDE(), nota: 'Transcript + decisión comercial sobre PII. El análisis insignia: Opus.' },
  { feature: 'lead_insights', label: 'Insight 360 del lead', grupo: 'Análisis', def: CLAUDE(), pii: true, recomendado: CLAUDE(), nota: 'Síntesis multi-fuente sobre PII. Opus.' },
  { feature: 'experimentos', label: 'Experimentos / Retro del negocio', grupo: 'Análisis', def: CLAUDE(), recomendado: CLAUDE(), nota: 'El análisis más pesado del producto. Opus.' },
  { feature: 'script-analyst', label: 'Analizar guion de anuncio', grupo: 'Análisis', def: SONNET, nota: 'Lectura estructural creativa. Sonnet.' },
  { feature: 'script-valorador', label: 'Valorar guion nuevo', grupo: 'Análisis', def: SONNET },
  { feature: 'plan-fathom', label: 'Extraer tareas de una reunión (Fathom)', grupo: 'Análisis', def: SONNET, nota: 'El problema NO era el modelo sino que se cortaba el transcript (14k→completo): con la reunión entera, Sonnet saca los 16 action items reales igual que Opus, y más barato. 1 vez por reunión (cacheada).' },

  // ── Copywriting / voz de marca → Sonnet por default (bajó de Opus) ──────────
  { feature: 'campaign-suggest', label: 'Estructurar campaña de Meta', grupo: 'Copywriting', def: SONNET, nota: 'Estrategia + voz de marca. Sonnet.' },
  { feature: 'ads-writer', label: 'Escribir copy de anuncios', grupo: 'Copywriting', def: SONNET },
  { feature: 'wa-advisor', label: 'Asesor de WhatsApp — sugerir respuesta a un lead', grupo: 'Copywriting', def: SONNET, pii: true, nota: 'Analiza la charla real y propone el próximo mensaje (datos del cliente).' },
  { feature: 'wa-advisor-chat', label: 'Asesor de WhatsApp — conversar con MaKo sobre el lead', grupo: 'Copywriting', def: SONNET, pii: true, nota: 'Ida y vuelta de preguntas sobre el lead (datos del cliente).' },
  { feature: 'wa-template', label: 'Generar plantilla de WhatsApp (asesor)', grupo: 'Copywriting', def: SONNET },
  { feature: 'nutri-destilar-voz', label: 'MaKo aprende tu voz (nutrición)', grupo: 'Copywriting', def: SONNET },
  { feature: 'nutri-generar', label: 'MaKo escribe la secuencia de nutrición', grupo: 'Copywriting', def: SONNET },
  { feature: 'email-generar', label: 'Escribir email de nutrición', grupo: 'Copywriting', def: SONNET },

  // ── Simples / sin PII → Groq por default (barato, no entrena) ───────────────
  { feature: 'ads-rename', label: 'Ordenar nombres de campañas de Meta', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Extracción sin datos de clientes → Groq.' },
  { feature: 'validador', label: 'Validar plantilla de WhatsApp vs reglas de Meta', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Clasificación contra rúbrica fija → Groq.' },
  { feature: 'nutri-plantilla', label: 'Copy → plantilla de WhatsApp (nutrición)', grupo: 'Simples', def: SONNET, recomendado: GROQ() },
  { feature: 'avisos', label: 'Redactar aviso al dueño (semáforo)', grupo: 'Simples', def: SONNET, pii: true, recomendado: SONNET, nota: 'Rellena una plantilla con datos del evento (incluye nombres) → Claude Sonnet, más barato que Opus.' },
  { feature: 'Título de chat', label: 'Título de una sesión de chat', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Titulación pura. Ya en barato.' },
  { feature: 'onboarding-extract', label: 'Extraer campos del onboarding', grupo: 'Simples', def: { provider: 'openai', model: 'gpt-4o-mini' }, recomendado: GROQ() },
  { feature: 'ia-barata', label: 'IA barata genérica', grupo: 'Simples', def: GROQ(), recomendado: GROQ() },

  // ── STT (voz → texto) ────────────────────────────────────────────────────────
  { feature: 'MaKo · nota de voz', label: 'Transcribir nota de voz (Hola MaKo)', grupo: 'STT', def: GROQ_WHISPER, recomendado: GROQ_WHISPER },
  { feature: 'stt-nota-voz', label: 'Transcribir nota de voz (grupo)', grupo: 'STT', def: GROQ_WHISPER, recomendado: GROQ_WHISPER },
];

const KEY = 'mako.modelos'; // override JSON: { [feature]: { provider, model } }

async function leerOverrides(): Promise<Record<string, ModeloRef>> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSetting(KEY));
  if (!raw) return {};
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

/** Modelo efectivo de una feature: override del usuario > default del catálogo > null. */
export async function modeloDeFeature(feature?: string): Promise<ModeloRef | null> {
  if (!feature) return null;
  const ov = await leerOverrides();
  if (ov[feature]?.provider && ov[feature]?.model) return ov[feature];
  return CATALOGO_MODELOS.find((f) => f.feature === feature)?.def ?? null;
}

/** Solo el override MANUAL del dueño (null si está usando el default del catálogo).
 *  El router lo respeta como pin: si el dueño fijó un modelo, no lo pisa. */
export async function overrideDeFeature(feature?: string): Promise<ModeloRef | null> {
  if (!feature) return null;
  const ov = await leerOverrides();
  return (ov[feature]?.provider && ov[feature]?.model) ? ov[feature] : null;
}

/** Fija (o limpia) el modelo de una feature. model vacío → vuelve al default. */
export async function setModeloFeature(feature: string, ref: ModeloRef | null): Promise<void> {
  await runWithWorkspace(OWNER_WS, async () => {
    const ov = await leerOverrides();
    if (ref) ov[feature] = ref; else delete ov[feature];
    await setSetting(KEY, JSON.stringify(ov));
  });
}

/** Catálogo + el modelo efectivo (con override aplicado) para la UI de SuperAdmin. */
export async function getModelosConfig(): Promise<Array<FeatureModelo & { actual: ModeloRef; overrideado: boolean }>> {
  const ov = await leerOverrides();
  return CATALOGO_MODELOS.map((f) => {
    const o = ov[f.feature];
    const actual = (o?.provider && o?.model) ? o : f.def;
    return { ...f, actual, overrideado: !!(o?.provider && o?.model) };
  });
}
