// =============================================================================
// Los audios que graba el dueño en el onboarding del Chat Agent
// =============================================================================
// No es "un audio de bienvenida" y ya: son SITUACIONES distintas, y usar el de
// una en la otra rompe la naturalidad al instante. La diferencia que más importa
// entre `agenda_con_bienvenida` y `agenda_primer_contacto` es que los dos le
// llegan a alguien que acaba de agendar, pero en el primero ya hablaron
// —presentarse otra vez suena a robot— y en el segundo es la primera vez que esa
// persona escucha su voz.
//
// Catálogo PURO, sin 'server-only': lo importan la UI del paso Y la ruta que
// genera el ejemplo con la IA. Las dos TIENEN que decir lo mismo — si el bullet
// de la pantalla y el que ve el modelo divergen, el ejemplo deja de ser ejemplo.
//
// OJO, y es la restricción que manda sobre todos los guiones: UN AUDIO NO ADMITE
// VARIABLES. Las plantillas sustituyen {{nombre}} en texto, no dentro de un
// archivo de voz: el mismo binario le llega a todos los leads de esa situación.
// Por eso ningún guion puede decir el nombre del lead, ni la fecha ni la hora de
// la reunión. (La dirección y el día de un taller SEMANAL sí: son constantes del
// negocio, no datos del lead. Ver `evento` en guionDe.)
//
// ⚠️ QUÉ AUDIO SE PIDE DEPENDE DEL FUNNEL, Y ESE ERA EL BUG. El catálogo entero
// asumía el funnel del dueño de la agencia: anuncio → formulario → agenda sola →
// llamada. Una clienta que prospecta en frío por WhatsApp y cierra en un taller
// presencial grabó los tres, y el primero le dice a un desconocido «vi que
// dejaste tus datos en el anuncio». Sus leads tienen `meta_lead_id = 0`: ninguno
// dejó datos en ningún lado.
//
// Y lo que hace que esto sea una REGLA y no un consejo: la premisa del origen no
// se le pide al modelo, se resuelve en `guionDe` — igual que el bullet del video.
// Un dato en el prompt pierde contra un imperativo del guion quince líneas más
// abajo; eso ya pasó y por eso el catálogo se lee así.

import { ENCUENTRO_POR_CANAL, type EntradaId } from './pipeline';
import type { CanalId } from './fase-diagnostico';

export type ClaveAudio =
  | 'bienvenida'
  | 'bienvenida_landing'
  | 'apertura_fria'
  | 'respuesta_entrante'
  | 'agenda_con_bienvenida'
  | 'agenda_primer_contacto'
  | 'evento_confirmado';

export type AudioPasoDef = {
  clave: ClaveAudio;
  n: number;
  titulo: string;
  /** A quién le llega. Es lo que decide el guion, así que se muestra siempre. */
  situacion: string;
  /** Qué tiene que decir, en orden. */
  guion: string[];
  /** Solo la bienvenida ofrece el video: es el único que llega desde el anuncio. */
  pideVideo?: boolean;
  /**
   * El audio le habla a alguien que AGENDÓ una reunión. Si el funnel del
   * negocio no tiene ninguna etapa de reunión (venta directa, checkout), esa
   * situación no existe: pedirle al dueño que grabe un audio para una llamada
   * que nunca va a ocurrir traba el onboarding con una tarea imposible.
   */
  requiereReunion?: boolean;
  /**
   * De qué ENTRADA es este audio. Si el negocio no declaró esa entrada, la
   * situación no existe y el audio no se pide. Sin `entrada`, el audio no
   * depende de cómo llegó el lead.
   */
  entrada?: EntradaId;
  /**
   * Quién pone la fecha del encuentro. `'lead'` = agenda solo (Calendly y
   * parientes); `'fija'` = la pone el negocio (el taller de todos los miércoles).
   * Son situaciones excluyentes: «vi que agendaste» no existe donde nadie agenda.
   */
  requiereAgenda?: 'lead' | 'fija';
  /** El guion incluye dónde es, si el negocio declaró un lugar. */
  pideLugar?: boolean;
  /** El guion pide avisar si no va, porque hay cupo declarado. */
  pideCupo?: boolean;
};

export const AUDIOS_PASO: AudioPasoDef[] = [
  {
    // ⚠️ NO SE TOCA: ws1 tiene este audio grabado y el mapa `chat_agent.audios_clave`
    // apunta a su binario. Cambiarle la clave, la situación o el guion le pide al
    // dueño que regrabe algo que está bien. Lo único que cambió es que ahora
    // declara de qué entrada es, y con eso deja de pedírsele a quien no la tiene.
    clave: 'bienvenida', n: 1, titulo: 'Bienvenida', pideVideo: true, entrada: 'formulario_anuncio',
    situacion: 'Dejó sus datos en el anuncio y todavía no agendó. Es el primer mensaje que recibe de ti.',
    guion: [
      'Saluda y di tu nombre completo.',
      'Menciona de dónde llegó su dato: dejó sus datos en el anuncio.',
      'Deja tu número disponible para lo que necesite.',
      'Cierra con una sola pregunta abierta: a qué se dedica su negocio.',
    ],
  },
  {
    // El gemelo del anterior para quien capta con una landing o un lead magnet.
    // Es un audio aparte y no una variante del mismo porque la frase que se
    // ESCUCHA es distinta —«en el anuncio» vs «en mi página»— y esa media frase
    // es justo lo que hace que el audio no suene a spam.
    clave: 'bienvenida_landing', n: 2, titulo: 'Bienvenida (desde tu página)', pideVideo: true, entrada: 'landing',
    situacion: 'Llenó un formulario en tu página o descargó tu material. Es el primer mensaje que recibe de ti.',
    guion: [
      'Saluda y di tu nombre completo.',
      'Menciona de dónde llegó su dato: llenó el formulario de tu página.',
      'Deja tu número disponible para lo que necesite.',
      'Cierra con una sola pregunta abierta: a qué se dedica su negocio.',
    ],
  },
  {
    // Prospección: vos escribís primero y del otro lado no te esperaba nadie. La
    // diferencia con una bienvenida no es de tono, es de contenido: no hay ningún
    // dato que él haya dejado, así que el audio tiene que decir por qué le
    // escribís justo a él, o suena a lista comprada.
    clave: 'apertura_fria', n: 3, titulo: 'Le escribes tú primero (en frío)', entrada: 'chat_saliente',
    situacion: 'Nunca oyó hablar de ti. Le escribes tú, sin que él haya dejado ningún dato ni te haya buscado.',
    guion: [
      'Saluda y di tu nombre completo.',
      'Di en una frase POR QUÉ le escribes justo a él: qué viste de su negocio o qué tienen en común.',
      'Deja claro en una frase a qué te dedicas, sin vender nada todavía.',
      'Cierra con una sola pregunta abierta y fácil de contestar sobre su negocio.',
    ],
  },
  {
    // Te escribió él: lo peor que puede hacer acá el audio es presentarse como si
    // nada hubiera pasado. Ya hizo el esfuerzo de escribir; hay que retomar lo suyo.
    clave: 'respuesta_entrante', n: 4, titulo: 'Te escribieron ellos primero', entrada: 'chat_entrante',
    situacion: 'Te escribió él primero, sin que lo contactaras. Es tu primera respuesta.',
    guion: [
      'Saluda y di tu nombre completo: todavía no sabe con quién habla.',
      'Agradécele que haya escrito y dale a entender que leíste lo que te dijo.',
      'Deja tu número disponible para lo que necesite.',
      'Cierra con una sola pregunta abierta para entender qué está buscando.',
    ],
  },
  {
    clave: 'agenda_con_bienvenida', n: 5, titulo: 'Agendó después de tu bienvenida', requiereReunion: true, requiereAgenda: 'lead',
    situacion: 'Ya recibió tu audio de bienvenida y conversaron. Ahora agendó la reunión.',
    guion: [
      'No te presentes: ya sabe quién eres.',
      'Retoma la conversación que tuvieron y confirma que viste la reunión agendada.',
      'Di qué van a ver en la reunión y con qué se va a quedar.',
      'Pide una sola cosa concreta para llegar preparado, y que te la conteste por acá.',
      'Cierra ofreciéndote para cualquier duda, natural y en corto.',
    ],
  },
  {
    clave: 'agenda_primer_contacto', n: 6, titulo: 'Agendó sin haber hablado contigo',
    requiereReunion: true, requiereAgenda: 'lead', entrada: 'agenda_sola',
    situacion: 'Agendó directamente, sin contacto previo. Es el primer mensaje que recibe de ti.',
    guion: [
      'Saluda y di tu nombre completo: es la primera vez que te escucha.',
      'Menciona que viste su reunión agendada y que le escribes tú mismo.',
      'Deja tu número disponible para lo que necesite.',
      'Di qué van a ver en la reunión y con qué se va a quedar.',
      // Pedirle algo concreto ANTES de la reunión hace dos cosas a la vez: llega
      // con el dato a mano y, sobre todo, contestar es la confirmación de que
      // va a ir. El audio 2 ya lo pedía; el 3 se había quedado sin ese cierre.
      'Pide una sola cosa concreta para llegar preparado, y que te la conteste por acá.',
      'Cierra natural, como le hablarías a un conocido: nada de fórmulas ni de "quedo atento".',
    ],
  },
  {
    // El encuentro de fecha FIJA: el taller de todos los miércoles, el webinar
    // semanal. Nadie «agendó» nada — quedó en ir. Por eso no hay audio de
    // «agendaste» acá, y por eso este audio sí puede decir dónde y cuándo: el día
    // y la dirección son constantes del negocio, no datos del lead.
    clave: 'evento_confirmado', n: 7, titulo: 'Quedó en ir a tu sesión',
    requiereReunion: true, requiereAgenda: 'fija', pideLugar: true, pideCupo: true,
    situacion: 'Ya hablaron y quedó en ir a tu sesión. Es lo último que escucha antes de aparecer.',
    guion: [
      'No te presentes de cero: ya hablaron.',
      'Confirma que lo esperas, con la misma naturalidad con la que se lo dirías en persona.',
      'Di qué se va a llevar de la sesión, en una frase concreta.',
      'Cierra ofreciéndote para cualquier duda, en corto.',
    ],
  },
];

// Los bullets que dependen de un dato DECLARADO no viven en el guion base: solo
// aparecen si el workspace lo configuró. Un audio que dice "te dejo el link" sin
// link, o que da una dirección que nadie cargó, es una mentira que sale a un
// desconocido.
export const BULLET_VIDEO = 'Dile que le dejas el link del video por escrito, y en una frase por qué le conviene verlo antes de hablar.';
export const BULLET_CUPO = 'Pídele que te avise por acá si al final no puede ir, porque los lugares son limitados.';

/** Dónde y cuándo ocurre el encuentro de fecha fija. Espeja `EventoFunnel` de lib/leads. */
export type EventoAudio = { lugar?: string | null; dias?: number[]; hora?: string | null; cupo?: number | null };

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «los miércoles a las 19:00» — solo con lo que esté declarado, nunca inventado. */
export function cuandoTexto(ev: EventoAudio | null | undefined): string | null {
  if (!ev) return null;
  const dias = (ev.dias ?? []).filter((d) => d >= 0 && d <= 6).map((d) => DIAS[d]);
  const cuando = dias.length === 1 ? `los ${dias[0]}` : dias.length > 1 ? `los ${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}` : '';
  const hora = ev.hora?.trim() ? `a las ${ev.hora.trim()}` : '';
  const txt = [cuando, hora].filter(Boolean).join(' ');
  return txt || null;
}

/**
 * Los audios que este negocio SÍ tiene que grabar.
 *
 * ⚠️ SIN DEFAULTS. Antes era `audiosDe(hayReunion = true)` y ese default era el
 * problema entero: cualquier caller que no supiera el funnel recibía el del dueño
 * de la agencia. Con `entradas: []` («no declarado») no devuelve nada, y la
 * pantalla tiene que pedir que se declare — que es lo correcto: es preferible un
 * paso más a que el cliente grabe tres audios que no puede usar.
 */
export function audiosDe(entradas: EntradaId[], canal: CanalId | null): AudioPasoDef[] {
  // Sin ninguna entrada declarada no se pide NADA, ni siquiera los audios que no
  // dependen de la entrada (como el de «ya hablamos y agendaste»). No es un
  // tecnicismo: si no sabemos por dónde llega la gente, tampoco sabemos si la
  // conversación previa que ese audio da por hecha existió. Grabar de más cuesta
  // el tiempo del cliente y termina en un audio que no se puede usar.
  if (!entradas.length) return [];
  const agenda = ENCUENTRO_POR_CANAL[canal as CanalId]?.agenda ?? null;
  const hayReunion = agenda !== null;
  return AUDIOS_PASO.filter((a) => {
    if (a.requiereReunion && !hayReunion) return false;
    if (a.requiereAgenda && a.requiereAgenda !== agenda) return false;
    if (a.entrada && !entradas.includes(a.entrada)) return false;
    return true;
  });
}

export const CLAVES_AUDIO = AUDIOS_PASO.map((a) => a.clave);
export const defDeClave = (c: string): AudioPasoDef | null => AUDIOS_PASO.find((a) => a.clave === c) ?? null;
export const esClaveAudio = (x: unknown): x is ClaveAudio => typeof x === 'string' && (CLAVES_AUDIO as string[]).includes(x);

/**
 * El guion final del audio, ya resuelto contra los activos DECLARADOS del negocio.
 *
 * Acá es donde la regla deja de ser una expresión de deseo: lo que el negocio no
 * declaró no genera bullet, así que no hay nada que el modelo pueda completar mal.
 * La otra mitad —prohibirle al modelo que lo invente igual— vive en PROHIBICIONES,
 * en la ruta que arma el prompt.
 */
export function guionDe(def: AudioPasoDef, opts: { linkVideo?: string | null; evento?: EventoAudio | null } = {}): string[] {
  let g = [...def.guion];
  // El lugar y el día van ARRIBA (es la información por la que se escucha el
  // audio), el video y el cupo abajo, antes del cierre.
  if (def.pideLugar) {
    const cuando = cuandoTexto(opts.evento);
    const lugar = opts.evento?.lugar?.trim();
    if (lugar || cuando) {
      const detalle = [lugar ? `dónde es (${lugar})` : null, cuando ? `cuándo (${cuando})` : null].filter(Boolean).join(' y ');
      g = [g[0], `Di ${detalle}, con esas palabras exactas.`, ...g.slice(1)];
    } else {
      // Sin nada declarado no se calla el tema: se dice la verdad, que es que se
      // lo pasás por escrito. Callarlo deja al lead sin saber a dónde ir.
      g = [g[0], 'Dile que le pasas por acá la dirección y el horario exactos.', ...g.slice(1)];
    }
  }
  if (def.pideCupo && (opts.evento?.cupo ?? 0) > 0) g = [...g.slice(0, -1), BULLET_CUPO, g[g.length - 1]];
  // El video se ofrece cuando ya sabe quién eres, no de entrada: va antes del
  // cierre, nunca como primera frase.
  if (def.pideVideo && opts.linkVideo) g = [...g.slice(0, -1), BULLET_VIDEO, g[g.length - 1]];
  return g;
}

/** Dónde vive el mapa clave → id del audio grabado, y el link del video. */
export const KEY_AUDIOS_CLAVE = 'chat_agent.audios_clave';
export const KEY_LINK_VIDEO = 'chat_agent.link_video';

/**
 * A quién le habla el audio. No es un dato decorativo: en español cada
 * adjetivo se marca en género, y un audio que dice "los que están cansados"
 * a una audiencia de mujeres suena escrito para otra persona. Con "mixto"
 * —el default— el guion se escribe sin marcar género, que es lo más difícil
 * de lograr por accidente y lo que el modelo hace peor si nadie se lo pide.
 */
export const KEY_PUBLICO = 'chat_agent.publico';
export type PublicoGenero = 'masculino' | 'femenino' | 'mixto';
export const PUBLICOS: Array<{ v: PublicoGenero; label: string }> = [
  { v: 'mixto', label: 'Mixto' },
  { v: 'masculino', label: 'Sobre todo hombres' },
  { v: 'femenino', label: 'Sobre todo mujeres' },
];
export const esPublico = (x: unknown): x is PublicoGenero =>
  typeof x === 'string' && PUBLICOS.some((p) => p.v === x);

/** La instrucción de género que entra al prompt del guion. */
export function bloquePublico(p: PublicoGenero): string {
  if (p === 'masculino') return 'A QUIÉN LE HABLAS: una audiencia mayormente de hombres. Puedes usar el masculino con naturalidad.';
  if (p === 'femenino') return 'A QUIÉN LE HABLAS: una audiencia mayormente de mujeres. Usa el femenino con naturalidad; NO uses el masculino genérico.';
  return 'A QUIÉN LE HABLAS: una audiencia mixta. Escribe SIN marcar género: reformula en vez de usar el masculino genérico y no uses "@" ni "x" ni "e" inclusivas, que en un audio no se pueden pronunciar.';
}
