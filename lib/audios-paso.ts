// =============================================================================
// Los 3 audios que graba el dueño en el onboarding del Chat Agent
// =============================================================================
// No es "un audio de bienvenida" y ya: son TRES situaciones distintas, y usar el
// de una en la otra rompe la naturalidad al instante. La diferencia que más
// importa es entre el 2 y el 3: los dos le llegan a alguien que acaba de agendar
// una reunión, pero en el 2 ya hablaron —presentarse otra vez suena a robot— y
// en el 3 es la primera vez que esa persona escucha su voz.
//
// Catálogo PURO, sin 'server-only': lo importan la UI del paso Y la ruta que
// genera el ejemplo con la IA. Las dos TIENEN que decir lo mismo — si el bullet
// de la pantalla y el que ve el modelo divergen, el ejemplo deja de ser ejemplo.
//
// OJO, y es la restricción que manda sobre todos los guiones: UN AUDIO NO ADMITE
// VARIABLES. Las plantillas sustituyen {{nombre}} en texto, no dentro de un
// archivo de voz: el mismo binario le llega a todos los leads de esa situación.
// Por eso ningún guion puede decir el nombre del lead, ni la fecha ni la hora de
// la reunión.

export type ClaveAudio = 'bienvenida' | 'agenda_con_bienvenida' | 'agenda_primer_contacto';

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
};

export const AUDIOS_PASO: AudioPasoDef[] = [
  {
    clave: 'bienvenida', n: 1, titulo: 'Bienvenida', pideVideo: true,
    situacion: 'Dejó sus datos en el anuncio y todavía no agendó. Es el primer mensaje que recibe de ti.',
    guion: [
      'Saluda y di tu nombre completo.',
      'Menciona de dónde llegó su dato: dejó sus datos en el anuncio.',
      'Deja tu número disponible para lo que necesite.',
      'Cierra con una sola pregunta abierta: a qué se dedica su negocio.',
    ],
  },
  {
    clave: 'agenda_con_bienvenida', n: 2, titulo: 'Agendó después de tu bienvenida', requiereReunion: true,
    situacion: 'Ya recibió tu audio de bienvenida y conversaron. Ahora agendó la reunión.',
    guion: [
      'No te presentes: ya sabe quién eres.',
      'Retoma la conversación que tuvieron y confirma que viste la reunión agendada.',
      'Di qué van a ver en la reunión y con qué se va a quedar.',
      'Pide una sola cosa concreta para llegar preparado.',
      'Cierra ofreciéndote para cualquier duda antes de la reunión.',
    ],
  },
  {
    clave: 'agenda_primer_contacto', n: 3, titulo: 'Agendó sin haber hablado contigo', requiereReunion: true,
    situacion: 'Agendó directamente, sin contacto previo. Es el primer mensaje que recibe de ti.',
    guion: [
      'Saluda y di tu nombre completo: es la primera vez que te escucha.',
      'Menciona que viste su reunión agendada y que le escribes tú mismo.',
      'Deja tu número disponible para lo que necesite.',
      'Di qué van a ver en la reunión y con qué se va a quedar.',
      'Cierra con una sola pregunta abierta: a qué se dedica su negocio.',
    ],
  },
];

// El bullet del video NO vive en el guion base: solo aparece si el workspace
// configuró el link. Un audio que dice "te dejo el link" sin link es una mentira
// que sale a un desconocido.
export const BULLET_VIDEO = 'Dile que le dejas el link del video por escrito, y en una frase por qué le conviene verlo antes de hablar.';

/** Los audios que este negocio SÍ tiene que grabar, según su funnel. */
export const audiosDe = (hayReunion: boolean): AudioPasoDef[] =>
  AUDIOS_PASO.filter((a) => !a.requiereReunion || hayReunion);

export const CLAVES_AUDIO = AUDIOS_PASO.map((a) => a.clave);
export const defDeClave = (c: string): AudioPasoDef | null => AUDIOS_PASO.find((a) => a.clave === c) ?? null;
export const esClaveAudio = (x: unknown): x is ClaveAudio => typeof x === 'string' && (CLAVES_AUDIO as string[]).includes(x);

/** El guion final del audio, ya resuelto contra el funnel del negocio. */
export function guionDe(def: AudioPasoDef, linkVideo: string | null): string[] {
  if (!def.pideVideo || !linkVideo) return def.guion;
  // El video se ofrece cuando ya sabe quién eres, no de entrada: va antes del
  // cierre, nunca como primera frase.
  return [...def.guion.slice(0, -1), BULLET_VIDEO, def.guion[def.guion.length - 1]];
}

/** Dónde vive el mapa clave → id del audio grabado, y el link del video. */
export const KEY_AUDIOS_CLAVE = 'chat_agent.audios_clave';
export const KEY_LINK_VIDEO = 'chat_agent.link_video';
