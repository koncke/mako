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
const GROQ = (model = 'openai/gpt-oss-20b'): ModeloRef => ({ provider: 'groq', model });

// Catálogo (del audit de los 55 usos de IA). No es exhaustivo: son las tareas que
// más importan para el costo. Feature no listado → usa el modelo que le pase el
// call-site (sin override).
export const CATALOGO_MODELOS: FeatureModelo[] = [
  // ── Razonamiento / voz de marca / PII → se quedan en Claude ──────────────────
  { feature: 'closing', label: 'Análisis de llamadas de venta', grupo: 'Análisis', def: CLAUDE(), pii: true, nota: 'Transcript + decisión comercial. Claude.' },
  { feature: 'lead_insights', label: 'Insight 360 del lead', grupo: 'Análisis', def: CLAUDE(), pii: true, nota: 'Síntesis multi-fuente sobre PII. Claude.' },
  { feature: 'experimentos', label: 'Experimentos / Retro', grupo: 'Análisis', def: CLAUDE(), nota: 'Diagnóstico + plan con evidencia. Claude.' },
  { feature: 'script-analyst', label: 'Analizar guion de anuncio', grupo: 'Análisis', def: CLAUDE(), nota: 'Lectura estructural creativa. Claude.' },
  { feature: 'script-valorador', label: 'Valorar guion nuevo', grupo: 'Análisis', def: CLAUDE(), nota: 'Predicción + crítica creativa. Claude.' },
  { feature: 'campaign-suggest', label: 'Estructurar campaña de Meta', grupo: 'Copywriting', def: CLAUDE(), nota: 'Estrategia + voz de marca. Claude.' },
  { feature: 'wa-advisor', label: 'Asesor de WhatsApp (mensajes)', grupo: 'Copywriting', def: CLAUDE(), pii: true, nota: 'Copy en voz de marca sobre una charla real. Claude.' },
  { feature: 'wa-advisor-chat', label: 'Asesor de WhatsApp (chat)', grupo: 'Copywriting', def: CLAUDE(), pii: true },
  { feature: 'mako-chat', label: 'MaKo — chat de la app', grupo: 'MaKo', def: CLAUDE(), nota: 'Análisis conversacional. Claude.' },
  { feature: 'mako-doer', label: 'MaKo Doer (web)', grupo: 'MaKo', def: CLAUDE() },
  { feature: 'mako-doer-in', label: 'MaKo — WhatsApp (Hola MaKo)', grupo: 'MaKo', def: CLAUDE(), pii: true, nota: 'Doer conversacional con tools. Claude.' },
  { feature: 'mako-escribe', label: 'MaKo escribe la nutrición', grupo: 'Copywriting', def: CLAUDE() },
  // ── Tareas simples → recomendado Groq (barato, no entrena) ───────────────────
  { feature: 'Título de chat', label: 'Título de una sesión de chat', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Titulación pura. Ya en barato.' },
  { feature: 'ia-barata', label: 'IA barata genérica', grupo: 'Simples', def: GROQ(), recomendado: GROQ() },
  { feature: 'ads-rename', label: 'Ordenar nombres de campañas', grupo: 'Simples', def: CLAUDE(), recomendado: GROQ(), nota: 'Extracción/inferencia sin PII → Groq.' },
  { feature: 'template-validator', label: 'Validar plantilla vs reglas Meta', grupo: 'Simples', def: CLAUDE(), recomendado: GROQ(), nota: 'Clasificación contra rúbrica fija → Groq.' },
  { feature: 'checklist-coach', label: 'Proponer nombre+emoji de proyecto', grupo: 'Simples', def: CLAUDE(), recomendado: GROQ() },
  { feature: 'mako-guardian', label: 'Detectar tareas duplicadas', grupo: 'Simples', def: CLAUDE(), recomendado: GROQ(), nota: 'Dedup semántico — probar A/B.' },
  { feature: 'nutricion-plantilla', label: 'Copy → plantilla de WhatsApp', grupo: 'Simples', def: CLAUDE(), recomendado: GROQ() },
  { feature: 'onboarding-extract', label: 'Extraer campos del onboarding', grupo: 'Simples', def: { provider: 'openai', model: 'gpt-4o-mini' }, recomendado: GROQ() },
  // ── STT ──────────────────────────────────────────────────────────────────────
  { feature: 'MaKo · nota de voz', label: 'Transcribir nota de voz', grupo: 'STT', def: { provider: 'groq', model: 'whisper-large-v3-turbo' }, recomendado: { provider: 'groq', model: 'whisper-large-v3-turbo' } },
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
