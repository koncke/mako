// =============================================================================
// voz-coach-reglas — la VOZ de los coaches (Offer Coach, Funnel Coach): qué voz, qué texto y cuánto por mes (puro)
// =============================================================================
// Martín (18/11/2026), textual: «ponerle voz también a Offer Coach… tal vez una voz que no sea la mía… para que vaya narrando lo que va
// preguntando… Si tarda muchísimo, no. Si es rápido, sí… Y tal vez incluso ya las preguntas están predefinidas, ya sí o sí ya ponerlas
// con voz». MEDIDO el 18/11 con streaming (docs/hallazgos-ia.md, «La voz de los coaches»):
//   · primer audio 0,32–0,42 s con Flash v2.5 (una pregunta de 121 caracteres y una respuesta de 314); el audio entero de la respuesta,
//     0,66–0,93 s; la primera llamada en frío, 3,4 s;
//   · costo (cabecera `character-cost`): 27 la pregunta, 69 la respuesta (~0,22 por carácter).
// Así que va también lo PERSONALIZADO, no sólo las preguntas fijas.
//
// LA VOZ: «Fernando Martínez», de la biblioteca de ElevenLabs (latino neutro, «rápido y persuasivo»; lib/ai-avatar/voces-galeria.ts).
// NO es la de Martín ni imita a Hormozi ni a ninguna persona real: Hormozi es la inspiración del coach, no su voz. Cambiarla es esta
// línea. La paga la PLATAFORMA con la misma env que la Voz de MaKo (`MAKO_ELEVENLABS_API_KEY`, lib/voz-mako.ts): sin ella, el botón
// no se muestra (nada a medias).
//
// PURO y sin `server-only`: lo usan la ruta (app/api/voz-coach/route.ts), el botón (app/_ui/voz-coach/BotonVozCoach.tsx) y el test.
// =============================================================================

export const VOZ_COACH = {
  voiceId: 'dlGxemPxFMTY7iXagmOj',
  nombre: 'Fernando Martínez',
  /** El de baja latencia: el mismo tiempo que Turbo v2.5 en la medición, y la mitad de créditos que Multilingual. */
  modelo: 'eleven_flash_v2_5',
  formato: 'mp3_44100_64',
  ajustes: { stability: 0.5, similarity_boost: 0.75 },
} as const;

/** Lo más largo que se lee en UN audio: una respuesta del coach son 4 o 5 frases (~300-500 caracteres). Lo más largo no se lee. */
export const TOPE_TEXTO_VOZ_COACH = 900;
/** Caracteres por negocio y por mes que paga la plataforma (un onboarding entero con voz son ~3.000). */
export const TOPE_VOZ_COACH_MES = 15_000;

/**
 * Lo que dice la voz: el texto del mensaje sin lo que no se lee (markdown, links, emojis, viñetas). null si no queda nada o si es
 * más largo que `TOPE_TEXTO_VOZ_COACH`: ese mensaje no lleva botón (no se corta a mitad de frase).
 */
export function textoParaVozCoach(texto: string | null | undefined): string | null {
  let t = String(texto ?? '');
  t = t.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1');       // [texto](link) → texto
  t = t.replace(/https?:\/\/\S+/g, '');                                     // links sueltos
  t = t.replace(/[*_`~#>]+/g, '');                                          // markdown
  t = t.replace(/^\s*(?:[-•·]|\d+[.)])\s+/gm, '');                          // viñetas y listas numeradas
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');       // emojis
  // Un salto de línea es una pausa: después de «:» o de un punto, sólo un espacio; si no, un punto.
  t = t.replace(/([.:;,!?])?\s*\n+\s*/g, (_m, p: string | undefined) => (p ? `${p} ` : '. ')).replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
  if (!t || !/\p{L}/u.test(t)) return null;
  return t.length > TOPE_TEXTO_VOZ_COACH ? null : t;
}

/** La clave del uso del mes en los ajustes del negocio (app_settings): `mako.voz_coach.mes.2026-11`. */
export const claveDelMesVozCoach = (fecha: Date = new Date()): string => `mako.voz_coach.mes.${fecha.toISOString().slice(0, 7)}`;
/** Lo usado, leído de su ajuste (un número; cualquier otra cosa es 0). */
export const usadoDelMes = (valor: unknown): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
export const cabeEnElMesVozCoach = (usado: number, nuevo: number): boolean => usado + nuevo <= TOPE_VOZ_COACH_MES;

/** El nombre del audio guardado de una pregunta FIJA: el mismo texto con la misma voz y el mismo modelo es el mismo audio. */
export function rutaDeLaFija(hashHex: string): string {
  return `voz-coach/${VOZ_COACH.voiceId}/${VOZ_COACH.modelo}/${hashHex}.mp3`;
}
/** Lo que se hashea para la ruta de una fija (con la voz y el modelo: cambiar de voz no reproduce el audio viejo). */
export const firmaDeLaFija = (texto: string): string => `${VOZ_COACH.voiceId}|${VOZ_COACH.modelo}|${texto}`;

/** Las preferencias del botón, en el navegador de cada persona. */
export const CLAVE_AUTO_VOZ_COACH = 'mako.vozCoach.auto';
export const CLAVE_SONADOS_VOZ_COACH = 'mako.vozCoach.sonados';
/** Cuántos mensajes recuerda como «ya sonó» (los más nuevos). */
export const TOPE_SONADOS = 200;

/** ¿Suena solo? Sólo si la persona no lo apagó, si el mensaje lo pide (el último del coach) y si nunca sonó. */
export function sueneSolo(p: { autoplay: boolean; apagado: boolean; yaSono: boolean }): boolean {
  return p.autoplay && !p.apagado && !p.yaSono;
}

/** Los ids que ya sonaron, leídos con cuidado (lo guardado puede estar roto) y con tope. */
export function leerSonados(crudo: string | null | undefined): string[] {
  try {
    const v = JSON.parse(crudo ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-TOPE_SONADOS) : [];
  } catch {
    return [];
  }
}
export const conSonado = (sonados: readonly string[], id: string): string[] => [...sonados.filter((x) => x !== id), id].slice(-TOPE_SONADOS);
