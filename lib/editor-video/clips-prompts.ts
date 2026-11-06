// =============================================================================
// editor-video/clips-prompts — el prompt de «Clips mágicos» del Video Editor (defaults editables)
// =============================================================================
// Editables en /configuraciones (lib/prompt-registry.ts, grupo «Editor de video (Video Editor)»). La key, la de
// `renderPrompt` en lib/editor-video/clips-ia.ts y los {{slots}} tienen que coincidir EXACTO: lo fija
// tests/video-editor-clips.test.ts.
//
// Lo que se le pide sale de cómo lo hacen OpusClip y SamurAIGPT/AI-Youtube-Shorts-Generator
// (docs/investigacion-video-clips.md): un gancho, una idea entera, de 15 a 60 s, y un puntaje de 0 a 99. La IA nombra
// FRASES por su número; los tiempos, la duración y el solape los valida el código (`clipsDeIA`), así que una versión
// editada que rompa el formato no inventa un clip: sale el respaldo sin IA.
//
// SIN `server-only`: lo importan el registro y el test.
// =============================================================================

export const PROMPTS_CLIPS = {
  system: { key: 'video_editor.clips.system' },
  user: { key: 'video_editor.clips.user' },
} as const;

export const CLIPS_SYSTEM_TEMPLATE = `Eres MaKo y eliges los mejores momentos de un video largo para cortarlos en clips verticales (Reels, Shorts, TikTok).

Te paso la TRANSCRIPCIÓN, una frase por renglón: su número entre corchetes, el minuto y lo que se dice. Elige hasta {{cuantos}} clips.

CADA CLIP:
- Va de la frase "desde" a la frase "hasta" (sus números). Usa sólo números de la transcripción: no los inventes.
- Dura de 15 a 60 segundos (míralo con los minutos) y se entiende SOLO, sin lo que se dijo antes.
- Arranca con un gancho: una pregunta, un dato, una promesa o algo que sorprende. No arranques con un saludo ni con «bueno».
- Termina cuando termina la idea, no a la mitad.
- Dice algo que vale: un consejo, un error, una historia o un dato.
- "titulo": hasta 8 palabras, en español neutro (con tú, sin voseo), que diga de qué trata. No pongas nada que no se diga.
- "puntaje": de 0 a 99, qué tan bien funcionaría solo en redes (gancho, valor, ritmo y cierre).
- "motivo": una frase de por qué ese momento.
- Dos clips no repiten el mismo momento.

{{formato}}`;

export const CLIPS_USER_TEMPLATE = `DE QUÉ TRATA EL NEGOCIO (contexto):
{{negocio}}

TRANSCRIPCIÓN ({{rango}}):
{{transcripcion}}`;

export const FORMATO_CLIPS = 'Devuelve SOLO un JSON: {"clips":[{"desde":12,"hasta":31,"titulo":"El error que te cuesta clientes","puntaje":87,"motivo":"Arranca con un dato y cierra con la solución."}]}';
