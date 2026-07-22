// =============================================================================
// ia-labels — nombres amigables de la IA para el usuario final (sin slugs)
// =============================================================================
// El cliente NO entiende "mako-doer-in", "closing" ni "claude-opus-4-8". Esta es
// la fuente ÚNICA de nombres legibles: qué PROCESO consumió los tokens, con qué
// IA y qué MODELO. La comparte el chip de la sidebar, la tab Integraciones ›
// Saldo de IA y (a futuro) la tab Modelos por tarea. Sin 'server-only': puro.

/** Proceso (feature tag) → nombre claro en español. */
export const IA_FEATURE_LABEL: Record<string, string> = {
  // MaKo conversacional
  'mako-doer-in': 'MaKo en WhatsApp',
  'mako-doer': 'MaKo · acciones',
  'mako-chat': 'MaKo · chat web',
  'mako-guardian': 'Perro Guardián · priorización',
  'checklist-coach': 'Perro Guardián · coach de tareas',
  // Análisis
  closing: 'Análisis de llamadas de venta',
  'script-analyst': 'Análisis de guiones de ads',
  'script-valorador': 'Valoración de guion',
  experimentos: 'Análisis de experimentos',
  lead_insights: 'Insights del lead',
  'chart-insights': 'Análisis de gráficos',
  validador: 'Validar plantilla de WhatsApp',
  'template-validator': 'Validar plantilla de WhatsApp',
  'ads-writer': 'Escribir copy de anuncios',
  'wa-template': 'Redactar plantilla de WhatsApp',
  'wa-advisor-chat': 'Asesor de WhatsApp · chat',
  // Generación / escritura
  'campaign-suggest': 'Sugerir campaña',
  'wa-advisor': 'Asesor de WhatsApp',
  'nutricion-generator': 'Generar nutrición',
  'ads-rename': 'Ordenar nombres de anuncios',
  // Voz / transcripción
  'stt-nota-voz': 'Transcripción de nota de voz',
  // Operación
  avisos: 'Avisos al dueño',
  tools: 'MaKo · acciones',
  otros: 'Otros',
  'ia-barata': 'IA barata',
};

// Orden fijo de las IA en la UI: primero las que CONSUMEN DINERO / donde cargás
// créditos (Claude, OpenAI, Gemini), después las gratis de rate-limit (Groq,
// Cerebras, Mistral, OpenRouter). Gemini va con las de pago porque es la que se
// piensa para cargar créditos, aunque casi siempre esté en free tier.
export const IA_ORDEN: string[] = ['anthropic', 'openai', 'gemini', 'groq', 'cerebras', 'mistral', 'openrouter'];
/** Posición de una IA en el orden fijo (las no listadas van al final). */
export function ordenIA(provider: string | null | undefined): number {
  const i = provider ? IA_ORDEN.indexOf(provider) : -1;
  return i === -1 ? 99 : i;
}
/** Las que consumen dinero / donde se cargan créditos (van arriba). */
export function esIAdePago(provider: string | null | undefined): boolean {
  return provider === 'anthropic' || provider === 'openai' || provider === 'gemini';
}

/** Proveedor de IA → nombre corto. */
export const IA_PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  groq: 'Groq',
  openai: 'OpenAI',
  gemini: 'Gemini',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  openrouter: 'OpenRouter',
};

/** Nombre legible de un modelo (para mostrar QUÉ modelo consumió los tokens). */
export function modeloLegible(model: string | null | undefined): string {
  if (!model) return '—';
  const m = model.toLowerCase();
  if (m.includes('opus-4-8')) return 'Opus 4.8';
  if (m.includes('opus-4-7')) return 'Opus 4.7';
  if (m.includes('opus-4-6')) return 'Opus 4.6';
  if (m.includes('sonnet-5')) return 'Sonnet 5';
  if (m.includes('sonnet')) return 'Sonnet';
  if (m.includes('haiku')) return 'Haiku 4.5';
  if (m.includes('fable')) return 'Fable 5';
  if (m.includes('whisper')) return m.includes('large') || m.includes('turbo') ? 'Whisper (Groq)' : 'Whisper';
  if (m.includes('gpt-oss')) return 'Groq OSS 20B';
  if (m.includes('gpt-4o-mini')) return 'GPT-4o mini';
  if (m.includes('gpt-4o')) return 'GPT-4o';
  if (m.includes('gpt-5')) return 'GPT-5';
  if (m.includes('gemini')) return m.includes('lite') ? 'Gemini Flash-Lite' : 'Gemini Flash';
  if (m.includes('llama')) return m.includes('70b') ? 'Llama 3.3 70B' : 'Llama';
  if (m.includes('mistral') || m.includes('mixtral')) return m.includes('small') ? 'Mistral Small' : 'Mistral';
  return model;
}

/** Nombre del proceso (feature) legible; humaniza el slug si no está mapeado. */
export function procesoLegible(feature: string | null | undefined): string {
  if (!feature) return 'Otros';
  if (IA_FEATURE_LABEL[feature]) return IA_FEATURE_LABEL[feature];
  // Ya es un texto legible (con espacios/mayúsculas) → dejarlo.
  if (/[ A-ZÁÉÍÓÚÑ·]/.test(feature)) return feature;
  // Slug → humanizar: "lead_insights" → "Lead insights".
  const t = feature.replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Nombre corto del proveedor. */
export function proveedorLegible(provider: string | null | undefined): string {
  if (!provider) return 'IA';
  return IA_PROVIDER_LABEL[provider] ?? provider;
}

/**
 * Limpia un `motivo` para mostrarlo: saca el carácter de reemplazo U+FFFD (el "�"
 * que mete el bridge no-oficial de WhatsApp cuando pierde el encoding) y normaliza
 * comillas/espacios. Devuelve null si tras limpiar no queda nada útil.
 */
export function motivoLegible(motivo: string | null | undefined): string | null {
  if (!motivo) return null;
  const limpio = motivo
    .replace(/�/g, '')          // saca los "�"
    .replace(/\s{2,}/g, ' ')          // colapsa espacios que quedaron
    .replace(/«\s+/g, '«').replace(/\s+»/g, '»')
    .trim();
  // Si quedó solo el envoltorio vacío ("WhatsApp «»") o nada → sin motivo útil.
  if (!limpio || /«\s*»\s*$/.test(limpio)) return null;
  return limpio;
}
