// =============================================================================
// tono — el TONO y la PERSONALIDAD del creador (la voz de sus anuncios)
// =============================================================================
// Lo que HUMANIZA los guiones: cómo habla de verdad la persona que sale en los
// creativos — directa o formal, con qué energía, si usa humor, sus muletillas y
// los ejemplos que siempre usa. Sin esto, todos los guiones suenan a la misma IA.
//
// DATOS PUROS (sin 'server-only'): el catálogo de preguntas lo consume el wizard
// en el browser. La persistencia vive en lib/tono-store.ts (patrón
// fase-diagnostico.ts / fase-store.ts).
//
// Futuro (pedido explícito): conectar Meta y transcribir/analizar los anuncios
// reales del creador para DERIVAR el tono en vez de preguntarlo — las preguntas
// son el arranque manual, la transcripción lo refina después.

export type Tono = {
  /** Respuesta elegida por pregunta cerrada (key → opción literal). */
  respuestas: Record<string, string>;
  /** Muletillas o frases que SIEMPRE dice. */
  muletillas: string;
  /** Ejemplos, analogías o referencias que le gusta usar. */
  ejemplos: string;
};

export const TONO_VACIO: Tono = { respuestas: {}, muletillas: '', ejemplos: '' };

export type TonoPregunta = { key: string; emoji: string; pregunta: string; opciones: string[] };

export const TONO_PREGUNTAS: TonoPregunta[] = [
  {
    key: 'formalidad', emoji: '🗣️', pregunta: '¿Cómo le hablas a tu audiencia?',
    opciones: ['Directo y sin filtro', 'Cercano e informal', 'Profesional pero cálido', 'Formal y corporativo'],
  },
  {
    key: 'energia', emoji: '⚡', pregunta: '¿Con qué energía hablas en cámara?',
    opciones: ['Alta energía, intenso', 'Conversacional, tranquilo', 'Pausado y serio'],
  },
  {
    key: 'humor', emoji: '😏', pregunta: '¿Usas humor o picante?',
    opciones: ['Sí, humor ácido y picante', 'Humor suave de vez en cuando', 'Casi nunca — voy en serio'],
  },
  {
    key: 'trato', emoji: '🤝', pregunta: '¿Le hablas de "tú" o de "usted"?',
    opciones: ['De tú, como a un amigo', 'De usted, con respeto'],
  },
];

export type TonoCampoTexto = { key: 'muletillas' | 'ejemplos'; emoji: string; label: string; placeholder: string };

export const TONO_TEXTOS: TonoCampoTexto[] = [
  { key: 'muletillas', emoji: '💬', label: 'Muletillas o frases que SIEMPRE dices', placeholder: 'ej: "ojo con esto", "te lo juro", "va de nuevo"…' },
  { key: 'ejemplos', emoji: '🧩', label: 'Ejemplos o analogías que te gusta usar', placeholder: 'ej: analogías de futbol, historias de clientes reales, comida…' },
];

/** ¿Contestó todas las preguntas cerradas? (los textos libres son opcionales). */
export function tonoCompleto(t: Tono): boolean {
  return TONO_PREGUNTAS.every((p) => (t.respuestas[p.key] ?? '').trim().length > 0);
}

/** El tono como texto para inyectar en prompts de generación (guiones, copy). */
export function tonoTexto(t: Tono): string {
  const partes: string[] = [];
  for (const p of TONO_PREGUNTAS) {
    const r = (t.respuestas[p.key] ?? '').trim();
    if (r) partes.push(`- ${p.pregunta.replace(/[¿?]/g, '')}: ${r}`);
  }
  if (t.muletillas.trim()) partes.push(`- Muletillas/frases típicas (usá 1-2, natural, sin forzar): ${t.muletillas.trim()}`);
  if (t.ejemplos.trim()) partes.push(`- Ejemplos/analogías que le gustan: ${t.ejemplos.trim()}`);
  return partes.join('\n');
}

export function normalizarTono(v: unknown): Tono {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const resp = (o.respuestas && typeof o.respuestas === 'object' ? o.respuestas : {}) as Record<string, unknown>;
  const limpio: Record<string, string> = {};
  for (const p of TONO_PREGUNTAS) {
    const r = typeof resp[p.key] === 'string' ? (resp[p.key] as string).trim() : '';
    // Solo respuestas que EXISTEN en el catálogo: si mañana se edita una opción,
    // la respuesta vieja simplemente queda sin contestar (no rompe nada).
    if (r && p.opciones.includes(r)) limpio[p.key] = r;
  }
  return {
    respuestas: limpio,
    muletillas: typeof o.muletillas === 'string' ? o.muletillas.trim().slice(0, 500) : '',
    ejemplos: typeof o.ejemplos === 'string' ? o.ejemplos.trim().slice(0, 500) : '',
  };
}
