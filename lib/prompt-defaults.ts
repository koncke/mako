// =============================================================================
// prompt-defaults — defaults de prompts cortos que no tienen otro "hogar" natural
// =============================================================================
// Módulo liviano (sin imports pesados): lo comparten el registro de prompts
// (lib/prompt-registry.ts) y los call sites (rutas /api, lib/mako-context).
// Los prompts grandes (closing, script-analyst, validador, etc.) viven en su
// propio archivo y se exportan desde ahí; estos son los fragmentos chicos.
// =============================================================================

// ── Chat de gráficos (app/api/chart-insights/route.ts) ───────────────────────
export const CHART_PROMPT_ANALISIS_DEFAULT =
  'Mirá el gráfico y tirame SOLO lo más importante: el insight que más impacta, en 2-4 líneas, con tu voz. Nada de resumen completo ni listar todo.';

export const CHART_PROMPT_SALUDO_DEFAULT =
  'Presentate en 1-2 líneas como MaKo y decime en qué me podés ayudar con los datos del negocio. Breve, con tu voz.';

export const CHART_TITULO_DEFAULT =
  'Devolvé SOLO un título corto (3 a 6 palabras, en español, sin comillas ni punto final) que resuma de qué trata esto. Nada más que el título.';

// ── Encuadres del system prompt de MaKo (lib/mako-context.ts) ────────────────
export const MAKO_CTX_GENERAL_DEFAULT =
  'CONTEXTO: chat general del dashboard del negocio de Martín. Ayudá con lo que pregunte; si te pega datos, analizalos.';

// {{titulo}} = nombre del gráfico · {{contexto}} = datos del gráfico (recortados)
export const MAKO_CTX_CHART_DEFAULT =
  'CONTEXTO: estás mirando el gráfico "{{titulo}}" del PROPIO negocio de Martín. Ya tenés los datos abajo, analizá directo.\n\nDATOS DEL GRÁFICO:\n{{contexto}}';

export const MAKO_CTX_WHATSAPP_DEFAULT =
  'SOS CONSULTOR DE SECUENCIAS Y PLANTILLAS DE WHATSAPP. Cuando Martín te proponga una secuencia o un mensaje, evaluá si Meta lo aprobaría (citá la regla), sugerí mejoras concretas y pensá el timing/copy en función del funnel. Sé directo y accionable.';

// ── Extracción del plan de pagos de un contrato (app/api/extract-contract) ───
export const CONTRACT_EXTRACT_DEFAULT =
  'Eres un asistente que extrae el PLAN DE PAGOS de un contrato de servicios profesionales. Lee el documento y devuelve SOLO JSON con esta forma exacta: {"total_usd": number|null, "duracion_meses": number|null, "fecha_cierre": "dd/mm/aaaa"|null, "fecha_inicio": "dd/mm/aaaa"|null, "cuotas": [{"monto": number, "fecha": "dd/mm/aaaa"}]}. Definiciones: total_usd = monto total del plan/contrato en USD (solo el número); duracion_meses = duración del servicio en meses; fecha_cierre = fecha de firma o cierre del contrato; fecha_inicio = fecha de inicio del servicio; cuotas = cada pago previsto (incluye el pago inicial si lo hay) con su monto en USD y su fecha. Convierte fechas a dd/mm/aaaa. Si un dato no aparece, usa null (o [] para cuotas). No inventes datos que no estén en el documento.';
