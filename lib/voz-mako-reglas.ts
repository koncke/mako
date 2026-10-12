// =============================================================================
// voz-mako-reglas — la VOZ DE MAKO: qué voz es, qué se le puede pedir y cuánto (puro)
// =============================================================================
// Pedido de Martín (11/10/2026, decisión 2 de la décima), textual: «en audios, que se pueda configurar con
// ElevenLabs que salga la voz de MaKo. La que usamos para crear los VSL de la landing.» Es el ÚNICO audio de
// una tarjeta «MaKo en WhatsApp» (lib/mako-tarjeta.ts): grabar con el micrófono o usar un audio del negocio
// sería suplantar al dueño. El diseño, en docs/diseno-undecima-tanda.md §2 (decisión 2) y §9.20.
//
// LA VOZ: «David» de ElevenLabs, la de los VSL (MaKo-VSL/funnel/funnel.md:6 y _voz-martin.md:66-67). El id
// es `id7LQ3n0ft94moeTT1ER` —el «id» del principio es PARTE del id: el de 18 caracteres no existe, medido el
// 11/10—, una voz COMPARTIDA de la biblioteca de ElevenLabs (su dueño público abajo). No está en la cuenta de
// la plataforma: la agrega scripts/voz-mako-agregar.mts. Los ajustes son los del VSL, uno por uno.
//
// QUIÉN PAGA: la plataforma, con una env PROPIA (`MAKO_ELEVENLABS_API_KEY`, lib/voz-mako.ts). Nunca la
// `ELEVENLABS_API_KEY` de siempre: `hidratarCredenciales` pisa process.env con las filas del ws1, así que el
// día que Mauricio conecte su ElevenLabs la Voz de MaKo se le cobraría a él.
//
// PURO y sin `server-only`: lo usan lib/voz-mako.ts, la ruta, el editor (ola 2) y tests/voz-mako.test.ts.
// =============================================================================

import { partirTextoParaVoz, TOPE_TEXTO_AUDIO } from './ai-step-voz';
import type { FalloEleven } from './elevenlabs-fallo';

/** La voz de los VSL, con sus ajustes. Cambiar uno cambia cómo suena MaKo: se cambia a oído, nunca «para modernizar». */
export const VOZ_MAKO = {
  voiceId: 'id7LQ3n0ft94moeTT1ER',
  modelo: 'eleven_multilingual_v2',
  ajustes: { stability: 0.35, similarity_boost: 0.85, style: 0.5, use_speaker_boost: true, speed: 1.08 },
  formato: 'mp3_44100_128',
} as const;

/** El dueño público de «David» en la biblioteca de ElevenLabs (para agregarla a la cuenta: `/v1/voices/add/<dueño>/<id>`). */
export const DUENO_PUBLICO_VOZ_MAKO = 'e340aad478e652ffe83f8412e6960d222773590b4d0638d4dbd31242460eed39';

/** La env de la key de la PLATAFORMA para la Voz de MaKo. Una sola, leída en un solo lugar (lib/voz-mako.ts). */
export const ENV_VOZ_MAKO = 'MAKO_ELEVENLABS_API_KEY';

/** El origen de sus audios en `setting_audios` (mig 0257). No se listan en «Audios guardados». */
export const ORIGEN_VOZ_MAKO = 'voz_mako' as const;

/**
 * El tope por NEGOCIO y por MES, en caracteres (decisión §9.20): ≈US$0,50 con multilingual_v2 (1 crédito por
 * carácter, ~US$0,10 los 1.000). Un audio repetido sale de la caché y no cuenta.
 */
export const TOPE_VOZ_MAKO_MES = 5000;

/** El largo de un audio, en el mismo tope que el AI Step (~70 palabras): lo que no entra no se corta. */
export { TOPE_TEXTO_AUDIO };

/** Los caracteres que cobra ElevenLabs (por punto de código, no por unidad UTF-16). */
export const caracteresVoz = (t: string): number => [...(t ?? '')].length;

/** ¿Entra `nuevo` en el tope del mes, con `usado` ya gastado? */
export const cabeEnElMes = (usado: number, nuevo: number): boolean => usado + nuevo <= TOPE_VOZ_MAKO_MES;

/** El primer instante del mes de `ahora`, en UTC (el corte del tope; unas horas de zona no cambian nada). */
export const inicioDelMes = (ahora: Date): string => new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();

/** Un dato `{{…}}`: no se dice en voz alta, va en un mensaje de texto. */
const DATO = /\{\{[^}]*\}\}/;

/**
 * LO QUE DICE LA VOZ, o por qué no. Rechaza (no corta):
 *   · un dato `{{…}}`: el audio se genera UNA vez y sale igual a todos, así que no lleva datos;
 *   · un link: leído en voz alta no sirve (va en un mensaje);
 *   · más de `TOPE_TEXTO_AUDIO` caracteres.
 * Saca los emojis (`partirTextoParaVoz`, la misma partición que el AI Step) y dice «MaKo» como «Máko».
 */
export function textoParaVozMaKo(t: string): { ok: true; hablado: string } | { ok: false; error: string } {
  const crudo = (t ?? '').trim();
  if (!crudo) return { ok: false, error: 'Escribe qué tiene que decir.' };
  if (DATO.test(crudo)) return { ok: false, error: 'Un audio no lleva datos: van en un mensaje.' };
  const { hablado, pie } = partirTextoParaVoz(crudo);
  if (pie.trim()) return { ok: false, error: 'Un audio no lleva links: van en un mensaje.' };
  const dicho = hablado.replace(/\bmako\b/gi, 'Máko').trim();
  if (!dicho) return { ok: false, error: 'Escribe qué tiene que decir.' };
  const n = caracteresVoz(dicho);
  if (n > TOPE_TEXTO_AUDIO) return { ok: false, error: `Muy largo para un audio (${n} de ${TOPE_TEXTO_AUDIO}).` };
  return { ok: true, hablado: dicho };
}

/** El título del audio guardado (no se lista; lo ve quien lo busque por id). */
export const tituloVozMaKo = (hablado: string): string => {
  const t = hablado.replace(/\s+/g, ' ').trim();
  return `Voz de MaKo: ${t.length > 60 ? `${t.slice(0, 60)}…` : t}`;
};

/**
 * POR QUÉ NO SALIÓ LA VOZ, en una frase que nombra a ElevenLabs y NUNCA a la cuenta del cliente.
 *
 * ⚠️ NO ES `textoEleven` (lib/elevenlabs-fallo.ts): ése habla de «tu cuenta de ElevenLabs» porque la voz
 * clonada es BYOK. La Voz de MaKo la paga la plataforma: «pago pendiente en tu cuenta» mandaría al cliente
 * a revisar una cuenta que no es suya.
 */
export function textoFalloVozMaKo(motivo: FalloEleven): string {
  switch (motivo) {
    case 'sin_key': return 'La Voz de MaKo todavía no está conectada a ElevenLabs.';
    case 'sin_permiso': return 'ElevenLabs no deja usar la Voz de MaKo todavía.';
    case 'impago': return 'ElevenLabs frenó la Voz de MaKo por un pago pendiente.';
    case 'cuota': return 'ElevenLabs agotó la cuota de la Voz de MaKo.';
    case 'voz_muerta': return 'ElevenLabs no encuentra la Voz de MaKo.';
    case 'proveedor': return 'ElevenLabs no está respondiendo. Prueba en un rato.';
    case 'nuestra': return 'ElevenLabs no aceptó el pedido.';
  }
}
