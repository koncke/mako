// =============================================================================
// El CATÁLOGO de modelos — qué IA usa cada tarea, como dato puro
// =============================================================================
// Vive separado de `model-registry.ts` por una razón concreta: aquél importa
// `server-only` (lee el override de la base), y un módulo con `server-only` no lo
// puede importar ningún test. La regla que gobierna el gasto —«un default que
// cobra es un cobro silencioso»— quedaría sin red justo donde más duele.
//
// Es el mismo criterio de AGENTS.md → «Un guard sobre algo destructivo se escribe
// en POSITIVO»: la condición va en un módulo sin `server-only`, para que se pueda
// testear. Ver `tests/model-registry.test.ts`.
//
// Nadie importa este archivo directo: `model-registry.ts` lo re-exporta entero, así
// que los call-sites siguen escribiendo `from '@/lib/model-registry'`.

export type Proveedor = 'anthropic' | 'groq' | 'openai' | 'gemini';
export type ModeloRef = { provider: Proveedor; model: string };
export type FeatureModelo = {
  feature: string;          // tag de gasto (el que se pasa a chatClaude/chatCheap)
  label: string;            // nombre legible
  grupo: string;            // agrupador para la UI
  def: ModeloRef;           // modelo por default (lo que usa hoy el código)
  recomendado?: ModeloRef;  // sugerencia del audit (si conviene mover a barato)
  pii?: boolean;            // el prompt lleva datos de clientes
  nota?: string;
  /**
   * OBLIGATORIO si `def` es un proveedor que cobra. Por qué esta feature vale la
   * plata, en una frase. Lo exige un test — ver la regla debajo.
   */
  pagoPorque?: string;
};

/**
 * ⚠️ UN DEFAULT QUE COBRA ES UN COBRO SILENCIOSO.
 *
 * El default no es «lo que usa hoy el código»: es **lo que va a pagar cualquier
 * feature que nadie se acordó de configurar**. `/modelos-ia` solo escribe un
 * override cuando alguien toca el botón, así que una feature nueva con `def:
 * SONNET` cobra desde el día uno y no lo dice en ningún lado.
 *
 * Pasó y llegó a la pantalla del dueño: `plan-fathom` —que corre SOLA en cada
 * reunión nueva, con transcripts de 42k tokens partidos en 4— nunca tuvo override
 * y pagó Sonnet en cada corrida. Con ella otras cuatro. El reclamo fue «el Perro
 * sigue usando Claude para tareas simples», y el Perro no tenía nada que ver: era
 * el default de al lado.
 *
 * La regla, con las dos capas que pide AGENTS.md:
 *   1. El default de una feature es un proveedor GRATIS, salvo que se justifique.
 *   2. Si cobra, `pagoPorque` dice por qué — y `tests/model-registry.test.ts`
 *      falla si falta. Sin la segunda capa esto es una expresión de deseo.
 *
 * Que una feature esté ruteada a Gemini NO la deja sin red: si el proveedor falla
 * se recorre la cascada gratis entera y recién ahí se paga (`chatCheapCascade`),
 * dejando la nota del fallback visible en el historial.
 */
export const REGLA_DEFAULT_GRATIS = 'El default de una feature es gratis; cobrar se justifica en `pagoPorque`.';

/** Los proveedores que facturan por token. El test mira esto, no una lista suelta. */
export const PROVEEDORES_PAGOS: Proveedor[] = ['anthropic', 'openai'];

const CLAUDE = (model = 'claude-opus-4-8'): ModeloRef => ({ provider: 'anthropic', model });
const SONNET: ModeloRef = { provider: 'anthropic', model: 'claude-sonnet-5' };
const GROQ = (model = 'openai/gpt-oss-20b'): ModeloRef => ({ provider: 'groq', model });
const GROQ_WHISPER: ModeloRef = { provider: 'groq', model: 'whisper-large-v3-turbo' };
// Gemini Flash: 1M de contexto + function-calling. BYOK por cliente (su propia key).
// El free entrena; para datos de clientes va key paga (ver metodo-catalogo).
const GEMINI = (model = 'gemini-flash-latest'): ModeloRef => ({ provider: 'gemini', model });

// Catálogo de TODOS los procesos de IA de la app (del audit). Cada `feature` es el
// tag REAL que el call-site le pasa a chatClaude/chatCheap: si no coincide, el
// override no aplica. Regla de tiers: PII + razonamiento fino → Claude (Opus o
// Sonnet); voz de marca → Claude (probar Sonnet); simple sin PII → Groq.
export const CATALOGO_MODELOS: FeatureModelo[] = [
  // ── MaKo conversacional / agentes con herramientas ──────────────────────────
  // El doer usa el ROUTER (lib/mako-router): elige por turno barato/Sonnet/Opus.
  // El default acá es el "piso" (Sonnet) cuando lo pin-eás; el router escala a Opus
  // solo para razonamiento/copy/media. Menos Opus por default.
  { feature: 'mako-doer-in', label: 'MaKo en WhatsApp (Hola MaKo)', grupo: 'MaKo', def: GEMINI(), pii: true, nota: 'Doer con herramientas. El router elige por turno: charla → barato, dato/acción → Sonnet, análisis → Opus.' },
  { feature: 'mako-doer', label: 'MaKo Doer — acciones en la web', grupo: 'MaKo', def: GEMINI(), nota: 'Agente con herramientas. Sonnet por default.' },
  { feature: 'mako-chat', label: 'MaKo — chat sobre un gráfico', grupo: 'MaKo', def: GEMINI(), nota: 'Chat sobre un dashboard. Sonnet alcanza.' },
  // EL PERRO CORRE EN GEMINI. Es el proceso de IA que más se dispara del producto —
  // cada lote de tareas lo llama tres veces (puntuar, describir+checklist, rutear) y
  // un lote son 40 tareas — así que era el que más gastaba, y su trabajo es
  // clasificar contra una rúbrica escrita, no razonar sobre datos de clientes.
  // Además NO lleva PII: ve títulos y detalles de tareas del propio negocio.
  { feature: 'mako-guardian', label: 'Perro Guardián — cerebro de priorización (/plan)', grupo: 'MaKo', def: GEMINI(), recomendado: GEMINI(), nota: 'Puntúa, rutea a proyectos y detecta duplicados. Clasificación contra rúbrica, sin datos de clientes → Gemini Flash. Si alguna vez afloja el criterio, se vuelve a Sonnet desde acá sin tocar código.' },
  { feature: 'checklist-coach', label: 'MaKo te ayuda (tareas y proyectos)', grupo: 'MaKo', def: GEMINI(), recomendado: GEMINI(), nota: 'Escribe la descripción y la checklist de cada tarea nueva. Es la llamada más voluminosa del Perro (una por lote, con todas las tareas adentro) → Gemini Flash.' },

  // ── Análisis pesado sobre datos reales → OPUS (los únicos que se quedan) ─────
  { feature: 'closing', label: 'Análisis de llamadas de venta', grupo: 'Análisis', def: CLAUDE(), pii: true, recomendado: CLAUDE(), pagoPorque: 'Transcript completo de una llamada de venta + juicio comercial sobre PII. Es el análisis insignia y lo que el cliente compra: la diferencia de criterio se nota y se paga a propósito.', nota: 'Transcript + decisión comercial sobre PII. El análisis insignia: Opus.' },
  { feature: 'lead_insights', label: 'Insight 360 del lead', grupo: 'Análisis', def: CLAUDE(), pii: true, recomendado: CLAUDE(), pagoPorque: 'Síntesis multi-fuente sobre datos personales del lead (chat, llamadas, CRM). El razonamiento cruzado es el producto; un modelo flojo acá inventa relaciones que no están.', nota: 'Síntesis multi-fuente sobre PII. Opus.' },
  { feature: 'experimentos', label: 'Experimentos / Retro del negocio', grupo: 'Análisis', def: CLAUDE(), recomendado: CLAUDE(), pagoPorque: 'El análisis más pesado del producto: lee el negocio entero y propone qué probar. Corre pocas veces y su salida gobierna decisiones de plata.', nota: 'El análisis más pesado del producto. Opus.' },
  { feature: 'ads-analyst', label: 'Analizar guion de anuncio', grupo: 'Análisis', def: GEMINI(), nota: 'Lectura estructural creativa sobre un guion público. Si Gemini falla, la cascada gratis sigue antes de pagar.' },
  { feature: 'script-valorador', label: 'Valorar guion nuevo', grupo: 'Análisis', def: GEMINI() },
  { feature: 'landing-analyst', label: 'Diagnosticar una landing', grupo: 'Análisis', def: GEMINI(), nota: 'Lee el copy de la página y lo cruza con el comportamiento medido (visitas, retención, agendas). Sin PII: la landing es pública y las métricas van agregadas.' },
  // Se agrega SOLO porque lib/todo-seed-ia.ts lee `overrideDeFeature('plan-seed-ia')` y
  // le pasa el pin a chatCheapCascade (que por su cuenta NO mira este registro). Sin ese
  // pin, la entrada sería un verde mudo: se elegiría un modelo acá y seguiría corriendo
  // otro — el mismo antipatrón de la key BYOK que se pintaba conectada y no se usaba.
  { feature: 'plan-seed-ia', label: 'Plan de arranque del cliente nuevo', grupo: 'Análisis', def: GEMINI(), recomendado: GEMINI(), nota: 'Escribe el plan inicial desde el onboarding del cliente. Corre UNA vez por cliente, con la key del PROPIO cliente (cascada de IA barata), así que no le cuesta a la agencia.' },
  // Mismo trato que plan-seed-ia: lib/productos-ia.ts pasa el pin a chatCheapCascade.
  { feature: 'productos', label: 'Armar el catálogo de productos', grupo: 'Análisis', def: GEMINI(), recomendado: GEMINI(), nota: 'El paso "Tus productos" del onboarding: lee el brief y El Archivero y propone el catálogo. Corre a pedido del cliente, con la key del PROPIO cliente. Default GRATIS: es una extracción, no copy.' },
  // La MÁS cara de todas y la que disparó la regla: corre sola en cada reunión
  // nueva, con el transcript entero partido en 4 partes de ~40k tokens. En Sonnet
  // eran ~US$1 por reunión y nadie lo había pedido. Gemini Flash tiene 1M de
  // contexto —le entra la reunión entera sin partir— y es exactamente el caso de
  // uso para el que el troceo se inventó.
  // GRATIS Y NO NEGOCIABLE: corre una vez POR BLOQUE ABIERTO, por cada junta, de
  // cada cliente. Un cliente con 8 bloques abiertos son 8 llamadas por sesión.
  // Es exactamente el perfil de gasto silencioso de `plan-fathom` (US$37 en 30
  // días por caer en su default sin que nadie lo mirara), pero multiplicado.
  { feature: 'cs-reescritura', label: 'Mejorar la tarea del cliente con lo hablado en la junta', grupo: 'Análisis', def: GEMINI(), nota: 'Reescribe la respuesta de un bloque con el resumen de la sesión. Es reescritura sobre material dado, no juicio: no hace falta pagar. Y corre en tanda, así que sale por la cascada gratis y no por un fallback que cobre al primer 429.' },
  { feature: 'plan-fathom', label: 'Extraer tareas de una reunión (Fathom)', grupo: 'Análisis', def: GEMINI(), nota: 'El problema NUNCA fue el modelo sino que se cortaba el transcript (14k→completo): con la reunión entera cualquier modelo con contexto saca los 16 action items. 1 vez por reunión (cacheada).' },

  // ── Copywriting / voz de marca → Sonnet por default (bajó de Opus) ──────────
  { feature: 'campaign-suggest', label: 'Estructurar campaña de Meta', grupo: 'Copywriting', def: GEMINI(), nota: 'Estrategia + voz de marca. Sonnet.' },
  { feature: 'landing-writer', label: 'Escribir la landing (Landing Generator)', grupo: 'Copywriting', def: GEMINI(), nota: 'Escribe la estructura y el copy de la página entera desde el funnel, el perfil y —si lo hay— el diagnóstico del Landing Analyst. Voz de marca sin PII.' },
  { feature: 'wa-advisor', label: 'Asesor de WhatsApp — sugerir respuesta a un lead', grupo: 'Copywriting', def: GEMINI(), pii: true, nota: 'Analiza la charla real y propone el próximo mensaje (datos del cliente).' },
  { feature: 'wa-advisor-chat', label: 'Asesor de WhatsApp — conversar con MaKo sobre el lead', grupo: 'Copywriting', def: GEMINI(), pii: true, nota: 'Ida y vuelta de preguntas sobre el lead (datos del cliente).' },
  { feature: 'wa-template', label: 'Generar plantilla de WhatsApp (asesor)', grupo: 'Copywriting', def: GEMINI() },
  { feature: 'post-llamada', label: 'Follow-up post-llamada (borrador de WhatsApp)', grupo: 'Copywriting', def: GEMINI(), pii: true, nota: 'Redacta el WhatsApp post-llamada con el análisis del Closing Analyst, en la voz del negocio. Queda como borrador para el setter (nunca sale automático). ⚠️ Lleva PII: va con la key PAGA de Gemini, que no entrena (la free sí).' },
  { feature: 'nutri-destilar-voz', label: 'MaKo aprende tu voz (nutrición)', grupo: 'Copywriting', def: GEMINI() },
  { feature: 'nutri-generar', label: 'MaKo escribe la secuencia de nutrición', grupo: 'Copywriting', def: GEMINI() },
  { feature: 'email-generar', label: 'Escribir email de nutrición', grupo: 'Copywriting', def: GEMINI() },

  // ── Simples / sin PII → Groq por default (barato, no entrena) ───────────────
  { feature: 'ads-rename', label: 'Ordenar nombres de campañas de Meta', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Extracción sin datos de clientes → Groq.' },
  { feature: 'validador', label: 'Validar plantilla de WhatsApp vs reglas de Meta', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Clasificación contra rúbrica fija → Groq.' },
  { feature: 'nutri-plantilla', label: 'Copy → plantilla de WhatsApp (nutrición)', grupo: 'Simples', def: GEMINI(), recomendado: GROQ() },
  { feature: 'avisos', label: 'Redactar aviso al dueño (semáforo)', grupo: 'Simples', def: GEMINI(), pii: true, recomendado: SONNET, nota: 'Rellena una plantilla con datos del evento (incluye nombres) → Claude Sonnet, más barato que Opus.' },
  { feature: 'Título de chat', label: 'Título de una sesión de chat', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Titulación pura. Ya en barato.' },
  { feature: 'onboarding-extract', label: 'Extraer campos del onboarding', grupo: 'Simples', def: GROQ(), recomendado: GROQ(), nota: 'Saca campos sueltos de un documento. El default era gpt-4o-mini y cobraba; el propio audit ya recomendaba Groq.' },
  { feature: 'ia-barata', label: 'IA barata genérica', grupo: 'Simples', def: GROQ(), recomendado: GROQ() },

  // ── STT (voz → texto) ────────────────────────────────────────────────────────
  { feature: 'MaKo · nota de voz', label: 'Transcribir nota de voz (Hola MaKo)', grupo: 'STT', def: GROQ_WHISPER, recomendado: GROQ_WHISPER },
  { feature: 'stt-nota-voz', label: 'Transcribir nota de voz (grupo)', grupo: 'STT', def: GROQ_WHISPER, recomendado: GROQ_WHISPER },
];
