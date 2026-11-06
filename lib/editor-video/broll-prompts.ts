// =============================================================================
// editor-video/broll-prompts — el prompt del B-roll del Video Editor (defaults editables)
// =============================================================================
// Editables en /configuraciones (lib/prompt-registry.ts, grupo «Editor de video (Video Editor)»). La key, la de
// `renderPrompt` en lib/editor-video/broll-ia.ts y los {{slots}} tienen que coincidir EXACTO: lo fija
// tests/video-editor-broll.test.ts.
//
// La IA ELIGE entre huecos que armó el código (lib/editor-video/broll.ts) y escribe la búsqueda de cada uno: nunca
// escribe un tiempo. Lo que devuelve se valida igual (`eleccionDeIA`), así que una versión editada que rompa el formato
// no cambia nada en el video: sale el respaldo sin IA.
//
// SIN `server-only`: lo importan el registro y el test.
// =============================================================================

export const PROMPTS_BROLL = {
  system: { key: 'video_editor.broll.system' },
  user: { key: 'video_editor.broll.user' },
} as const;

export const BROLL_SYSTEM_TEMPLATE = `Eres MaKo y eliges el B-roll de un video corto: las imágenes que se ven encima de la persona que habla, mientras dice algo que se puede mostrar.

Te paso los HUECOS posibles: cada uno con su número, lo que se dice ahí ("frase") y sus palabras más fuertes. Elige hasta {{objetivo}} huecos y, para cada uno, escribe la búsqueda de una foto en un banco de imágenes.

REGLAS:
- Usa sólo números de la lista. No inventes huecos ni tiempos.
- Elige lo que se puede MOSTRAR: un objeto, un lugar, una acción, una persona haciendo algo. Saltea lo abstracto si no tiene una imagen clara.
- La búsqueda va en INGLÉS, de 2 a 4 palabras, concreta y visual (por ejemplo «empty restaurant tables», «woman counting money»).
- Nada de marcas, logos, textos, personas famosas ni la cara de la persona que habla.
- No repitas la misma búsqueda.
- "motivo": una frase corta en español neutro (con tú, sin voseo) de por qué esa imagen ahí.

{{formato}}`;

export const BROLL_USER_TEMPLATE = `DE QUÉ TRATA EL NEGOCIO (contexto, para elegir imágenes que le queden):
{{negocio}}

HUECOS (JSON):
{{huecos}}`;

export const FORMATO_BROLL = 'Devuelve SOLO un JSON: {"broll":[{"hueco":3,"busqueda":"empty restaurant tables","motivo":"Habla de las mesas vacías."}]}';
