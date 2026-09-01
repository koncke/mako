// =============================================================================
// El prompt de VIDEO de cada formato — VALIDADO, textual, y en español
// =============================================================================
// Gemelo de `lib/prompts-imagen.ts`, y por la misma razón: estos prompts no los
// escribe un modelo, los escribió Martín probando contra Flow hasta que el clip
// salió bien, y llegan acá tal cual.
//
// ── Qué reemplazan ─────────────────────────────────────────────────────────
// `lib/video-planner.ts` le pide a un modelo, entre otras cosas, «el prompt
// completo listo para pegar», y eso es lo que se venía mandando. Salía en inglés
// y describiendo la toma desde cero —«Close-up selfie angle filmed with a
// handheld smartphone inside a parked car…»—, o sea volviendo a inventar la
// escena que la IMAGEN DE REFERENCIA ya tiene resuelta.
//
// Ahí está el error de fondo: el clip NO se genera de la nada, se anima DESDE la
// imagen del escenario, que ya trae el auto, la luz, el encuadre y la cara. Un
// prompt que vuelve a describir todo eso compite con la imagen en vez de
// apoyarse en ella. El prompt de un clip con referencia sólo tiene que decir QUÉ
// HACE la persona.
//
// ── Por qué éste es corto y el de imagen es largo ──────────────────────────
// No es una inconsistencia: son dos trabajos distintos. El de imagen tiene que
// fijar una fotografía completa —exposición, dirección de la luz, ventanillas,
// enfoque— porque ahí no hay nada previo. El de video hereda todo eso y sólo
// agrega movimiento. Alargarlo sería volver a pelearle a la imagen.
//
// ⚠️ EN ESPAÑOL, por pedido de Martín, con la misma apuesta consciente anotada en
// el módulo de imagen. La forma de saldarla es filmar la misma toma con la MISMA
// SEMILLA en los dos idiomas y mirar los dos clips — no discutirlo.
//
// ⚠️ EL ACENTO NO VA ACÁ. Lo agrega el sistema al final, con las palabras exactas
// que eligió el cliente (`conAcento` en `lib/puestas-data.ts`). Es la regla que
// este repo ya tiene cosechada: cuando el texto lo va a DECIR una persona, el
// acento es un campo y no un default — y el guion de un cliente mexicano ya salió
// una vez con voz rioplatense por no respetarla.

import type { ClipPlan } from './video-planner';

/**
 * El prompt de video de cada formato, por id de puesta. Recibe lo que se dice.
 *
 * Ausente = ese formato todavía no tiene un prompt probado, y se usa el que
 * escribió el modelo. Se prefiere eso a copiar el de otro formato: éste habla de
 * la palanca de cambios y de conducir, y en una oficina eso no es un detalle de
 * más, es una instrucción falsa.
 */
export const PROMPT_VIDEO: Record<string, (voz: string) => string> = {
  // Car Talks. Textual como lo escribió Martín, con el guion de la toma adentro.
  'selfie-movimiento': (voz) =>
    `Esta persona dice: "${voz}", con micromovimientos naturales, como gestos con las manos o moviendo la palanca de cambio que no sale en el plano. De vez en cuando mira a la cámara, pero no por mucho tiempo ya que está conduciendo. Todo natural.`,
};

/** ¿Este formato tiene prompt de video probado? Lo usa la pantalla para decirlo. */
export function tienePromptVideoPropio(puestaId: string): boolean {
  return typeof PROMPT_VIDEO[puestaId] === 'function';
}

/**
 * El acento que el sistema le había puesto al prompt del modelo.
 *
 * ⚠️ SE RESCATA DEL PROMPT VIEJO en vez de leerlo del perfil, y la diferencia
 * importa: el acento que vale es el que estaba elegido CUANDO SE ESCRIBIÓ EL
 * PLAN. Leerlo del perfil haría que cambiarlo hoy le cambiara la voz a un anuncio
 * que ya tiene tres tomas filmadas con la otra — mitad y mitad, sin avisar.
 *
 * `conAcento` borra cualquier línea de acento anterior y agrega la suya al final,
 * así que hay exactamente una y es la última. Se toma la última de todos modos:
 * si un prompt viejo tuviera dos, la que se mandó a Flow fue la de abajo.
 */
export function acentoDe(prompt: string): string {
  const todas = [...(prompt ?? '').matchAll(/Spoken in [^.\n]+\./gi)];
  return todas.length ? todas[todas.length - 1][0] : '';
}

/**
 * El guion como se DICE, sin las marcas que existen para LEERLO.
 *
 * ⚠️ MEDIDO EL 31/08/2026: 12 de los 14 clips del historial traen `**énfasis**`
 * adentro de `voz`. Lo escribe el planificador para que la persona vea qué frase
 * carga el peso al revisar el guion, y ahí está bien.
 *
 * Lo que no puede pasar es que esos asteriscos lleguen al modelo de video. Antes
 * no llegaban POR CASUALIDAD: el prompt lo redactaba el mismo modelo, que al
 * copiar la línea adentro de `Script: "…"` los dejaba afuera. Desde que el guion
 * se interpola VERBATIM en la plantilla del formato, ese accidente desaparece —
 * y `"apagando una **bronca que ya existía** desde…"` es un texto que el modelo
 * puede leer en voz alta o directamente romper.
 *
 * Es la frontera de siempre: lo que se muestra y lo que se dice no son el mismo
 * texto. `deCorrido` conserva las marcas —ahí sirven, se leen en pantalla— y acá
 * se sacan, porque acá el texto se pronuncia.
 */
export function comoSeDice(voz: string): string {
  return (voz ?? '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // Lo que haya quedado suelto: un par sin cerrar no es énfasis, es un
    // carácter que el modelo va a tener que interpretar.
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El prompt que se le manda a Flow para animar una toma.
 *
 * El del formato GANA ENTERO cuando existe: no se mezcla con el del modelo ni se
 * le agregan bloques. Mezclar dos prompts que describen lo mismo de dos maneras
 * es cómo se consiguen clips que no obedecen a ninguno de los dos.
 *
 * Se cae al del modelo en tres casos, y los tres son «acá no aplica»:
 *  · el formato no tiene prompt probado;
 *  · la persona NO habla en este clip (voz en off) — la plantilla arranca con
 *    «Esta persona dice», que sobre un clip mudo sería una instrucción falsa;
 *  · no hay guion que poner.
 *
 * ⚠️ Lo usan LOS DOS: el que filma (`generarTomaAction`) y el que muestra el plan
 * como texto (`video-pedido.ts`). Si cada uno resolviera el suyo, la pantalla
 * mostraría un prompt y Flow recibiría otro — y el día que un clip saliera raro,
 * el texto que se mira para entender por qué sería el equivocado.
 */
/**
 * Convierte el prompt guardado de un formato del cliente en la misma función que
 * usan los de fábrica.
 *
 * ⚠️ EL HUECO ES `{{voz}}` Y ES OBLIGATORIO. Un prompt de video sin la línea que
 * la persona dice no produce un clip mudo: produce uno donde el modelo INVENTA
 * qué decir, que es peor —sale un video plausible que dice otra cosa—. Sin el
 * hueco se devuelve `undefined` y el que llama cae al prompt del modelo, que al
 * menos trae el guion adentro.
 */
function plantillaDelCliente(txt?: string): ((voz: string) => string) | undefined {
  const t = (txt ?? '').trim();
  if (!t || !t.includes('{{voz}}')) return undefined;
  return (voz: string) => t.split('{{voz}}').join(voz);
}

export function promptDeClip(
  puestaId: string,
  clip: Pick<ClipPlan, 'voz' | 'habla' | 'prompt'>,
  /**
   * Lo que escribió la persona a mano, si escribió algo.
   *
   * ⚠️ GANA SOBRE TODO, incluso sobre el prompt validado del formato. Es la única
   * precedencia posible: alguien que abrió el prompt, lo leyó y lo cambió sabe
   * algo de ESTA toma que ninguna plantilla puede saber. Si el sistema le pisara
   * el texto, el paso de editarlo sería un formulario decorativo.
   */
  propio?: string,
  /**
   * El prompt validado de un formato que creó el CLIENTE.
   *
   * ⚠️ POR PARÁMETRO Y NO POR `PROMPT_VIDEO`: ese mapa es una constante de
   * código y los formatos del cliente viven en la base, por workspace. Es una
   * FUNCIÓN de `(voz) => string` igual que las de fábrica, así que el texto que
   * llega tiene que traer un `{{voz}}` donde va la línea — se reemplaza abajo.
   */
  delFormato?: string,
): string {
  const aMano = (propio ?? '').trim();
  if (aMano) return aMano;

  const plantilla = PROMPT_VIDEO[puestaId] ?? plantillaDelCliente(delFormato);
  const voz = comoSeDice(clip.voz ?? '');
  if (!plantilla || !clip.habla || !voz) return clip.prompt;

  const acento = acentoDe(clip.prompt);
  const base = plantilla(voz);
  return acento ? `${base}\n${acento}` : base;
}
