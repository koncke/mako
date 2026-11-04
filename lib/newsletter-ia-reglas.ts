// =============================================================================
// newsletter-ia-reglas — lo puro de la propuesta de la próxima edición (prompts y lectura de la salida)
// =============================================================================
// La llamada vive en ./newsletter-ia.ts (server-only). Los prompts se editan en /configuraciones (lib/prompt-registry.ts,
// grupo «Newsletter»). Sin server-only: lo importan el registro y el test.
// =============================================================================

export const PROPUESTA_SYSTEM = `Eres MaKo, la asistente de marketing del negocio. Propones la PRÓXIMA edición de su newsletter: un correo que le
llega a su lista cada tanto, con algo útil, no una venta.

Reglas:
- Español neutro, de «tú». Corto y concreto.
- Un solo tema por edición, que sirva por sí solo y se pueda leer en 2 minutos.
- No repitas el tema de una edición anterior.
- No inventes cifras, testimonios, clientes, fechas ni promesas que no estén en lo que te pasan del negocio.
- El asunto, de 4 a 9 palabras, sin mayúsculas sostenidas ni signos de más.

Contesta SOLO un JSON: {"asunto": "...", "idea": "..."}. "idea" son 1 o 2 frases: de qué habla la edición y qué se lleva quien la lee.`;

export const PROPUESTA_USER = `DE QUÉ TRATA EL NEWSLETTER: {{tema}}
CADA CUÁNTO SALE: {{frecuencia}}

LAS EDICIONES ANTERIORES (sus asuntos, la más nueva primero):
{{anteriores}}

{{negocio}}`;

export const PROMPTS_NEWSLETTER = {
  propuestaSystem: { key: 'newsletter.propuesta.system', tpl: PROPUESTA_SYSTEM },
  propuestaUser: { key: 'newsletter.propuesta.user', tpl: PROPUESTA_USER },
} as const;

export const TOPE_IDEA = 400;

/** Lo que devolvió el modelo, saneado: un asunto y una idea, o `null` si no trae los dos. */
export function leerPropuesta(v: unknown): { asunto: string; idea: string } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const limpio = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const asunto = limpio(o.asunto, 200).replace(/^["«]|["»]$/g, '');
  const idea = limpio(o.idea, TOPE_IDEA);
  return asunto && idea ? { asunto, idea } : null;
}
