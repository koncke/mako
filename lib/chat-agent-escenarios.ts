// =============================================================================
// Los ESCENARIOS del ensayo del onboarding del Chat Agent
// =============================================================================
// El ensayo dejó de ser "un chat" para ser una serie de casos con nombre. El
// motivo es concreto: cuando la IA elegía la situación Y redactaba el primer
// mensaje, salía siempre una frase explicativa del tipo "vi tu video sobre lo
// del equipo pero no llegué a agendar" — el modelo NARRABA la situación en vez
// de encarnarla. Nadie escribe así por WhatsApp: escribe "cuanto cuesta?", o
// contesta "ok", o directamente no contesta.
//
// Por eso el PRIMER mensaje del lead es una semilla LITERAL de este archivo y la
// IA recién toma el turno 2. Las semillas están escritas con el registro real:
// minúsculas, sin tildes, sin punto final.
//
// Sin 'server-only': la ruta arma el prompt con esto y el cliente pinta los
// títulos y las semillas (mismo motivo que lib/setting-estrategia.ts).

import { type ClaveAudio, defDeClave } from './audios-paso';

export type Escenario = {
  id: string;
  /** Título de la slide. Español neutro, formato «<Audio>: <qué hace el lead>». */
  titulo: string;
  /** Qué define el dueño respondiendo esto, en una línea. */
  objetivo: string;
  /** De cuál de los 3 audios arranca. Misma clave que lib/audios-paso.ts. */
  audio: ClaveAudio;
  /** Para el prompt: quién es, qué le pasa, qué hace y cómo evoluciona. */
  quien: string;
  quePasa: string;
  queHace: string;
  comoEvoluciona: string;
  /**
   * Semillas del PRIMER mensaje del lead: se elige una al azar en el cliente.
   * Vacío = el lead no escribe nada (escenario de silencio).
   */
  primerMensaje: string[];
  /** Solo el de no-respuesta: los saltos de tiempo que se muestran. */
  silencio?: { chips: string[] };
  /** Cuántas respuestas del dueño hacen falta para poder avanzar. */
  minRespuestas: number;
  /** false → se puede saltar con un link discreto bajo el chat. */
  obligatorio: boolean;
  /**
   * El escenario habla de un video de preparación: solo tiene sentido si el
   * workspace configuró el link. Sin link se saca del recorrido en silencio —
   * ensayar cómo conseguir que vea un video que no existe no enseña nada.
   */
  requiereVideo?: boolean;
};

export const ESCENARIOS: Escenario[] = [
  {
    id: 'bienvenida_silencio',
    titulo: 'Audio de bienvenida: no responde',
    objetivo: 'Escribe los mensajes de seguimiento que enviarías cuando nadie contesta.',
    audio: 'bienvenida',
    quien: 'dejaste tus datos en un anuncio hace unas horas y escuchaste la nota de voz.',
    quePasa: 'no te dio para contestar: no era prioridad, se te pasó, o todavía no decides si te interesa.',
    queHace: 'no contestas nada.',
    // El premio tiene que ser FIABLE, no una posibilidad remota: si el silencio
    // gana siempre, el dueño no aprende qué funciona — solo se frustra. La regla
    // se escribe como un interruptor, no como una tendencia.
    comoEvoluciona: 'aplica esta regla en cada mensaje que te llegue, sin excepción. Si el mensaje SOLO insiste, saluda otra vez, pregunta si viste el anterior o repite lo mismo con otras palabras: NO contestas. Pero si el mensaje te da algo NUEVO y concreto —un dato que te sirve, un recurso sin compromiso, una observación puntual sobre tu tipo de negocio—, entonces SÍ contestas: corto, todavía desconfiado, pero contestas. No te quedes en silencio cuando te dieron algo de valor real.',
    primerMensaje: [],
    silencio: { chips: ['Pasaron 24 horas. Sigue sin responder.', 'Pasaron 3 días. Sigue sin responder.'] },
    minRespuestas: 3,
    obligatorio: true,
  },
  {
    id: 'bienvenida_precio',
    titulo: 'Audio de bienvenida: pregunta el precio',
    objetivo: 'Define cómo respondes el precio sin enfriar al lead.',
    audio: 'bienvenida',
    quien: 'dejaste tus datos en un anuncio hace un rato y acabas de escuchar la nota de voz.',
    quePasa: 'no te interesa la charla: quieres saber cuánto cuesta y decidir rápido.',
    queHace: 'preguntas el precio de una, sin contestar lo que te preguntó el audio.',
    comoEvoluciona: 'si te dan una cifra sin contexto, te enfrías y cortas. Si te devuelven una pregunta antes del precio, te resistes una vez («solo quiero saber el precio») y recién después aflojas.',
    primerMensaje: ['cuanto cuesta?', 'que precio manejas', 'y eso como cuanto sale'],
    minRespuestas: 2,
    obligatorio: true,
  },
  {
    id: 'bienvenida_cuenta',
    titulo: 'Audio de bienvenida: cuenta a qué se dedica',
    objetivo: 'Define qué le aportas antes de proponerle la llamada.',
    audio: 'bienvenida',
    quien: 'dejaste tus datos en un anuncio y escuchaste la nota de voz.',
    quePasa: 'tienes un negocio andando y algo que no te termina de funcionar, pero no lo tienes ordenado en la cabeza.',
    queHace: 'contestas la pregunta del audio con poco detalle y desordenado.',
    comoEvoluciona: 'si te responden algo genérico o te empujan a la llamada de una, te enfrías. Si te devuelven una observación concreta sobre lo que contaste, te abres y das un dato más.',
    primerMensaje: ['tengo un taller mecanico aqui en hermosillo', 'una constructora chica, somos 9', 'vendo material de curacion, ya tengo como 3 años'],
    minRespuestas: 2,
    obligatorio: true,
  },
  {
    id: 'agenda_cuenta',
    titulo: 'Reunión agendada: cuenta de su negocio',
    objetivo: 'Define cómo calificas y preparas al lead antes de la reunión.',
    audio: 'agenda_primer_contacto',
    quien: 'agendaste una reunión directo desde el anuncio, nunca hablaste con esta persona.',
    quePasa: 'te interesa, pero llegas con dudas y con un problema concreto que te está costando dinero.',
    queHace: 'confirmas la reunión y sueltas contexto de tu negocio, incluido lo que te duele.',
    comoEvoluciona: 'si te hacen una sola pregunta buena, contestas con gusto. Si te hacen tres juntas o te mandan un texto largo, contestas en corto.',
    primerMensaje: ['si ya quede para el jueves. tengo una clinica dental, somos 6', 'va. mira mi tema es que no logro pasar de los 300 al mes'],
    minRespuestas: 2,
    obligatorio: true,
  },
  {
    id: 'bienvenida_ahorita_no',
    titulo: 'Audio de bienvenida: dice que ahora no puede',
    objetivo: 'Define qué haces con un «después te escribo».',
    audio: 'bienvenida',
    quien: 'dejaste tus datos y escuchaste la nota de voz en un mal momento.',
    quePasa: 'estás ocupado de verdad, pero tampoco te urge.',
    queHace: 'contestas que ahora no puedes y que escribes luego.',
    comoEvoluciona: 'si te proponen un horario concreto, aceptas a medias. Si te mandan un texto largo, no vuelves a escribir.',
    primerMensaje: ['ahorita ando ocupado, al rato te escribo', 'estoy en una junta, luego te marco', 'ando manejando'],
    minRespuestas: 1,
    obligatorio: false,
  },
  {
    id: 'bienvenida_no_recuerda',
    titulo: 'Audio de bienvenida: no recuerda haber dejado sus datos',
    objetivo: 'Define cómo explicas de dónde salieron sus datos.',
    audio: 'bienvenida',
    quien: 'llenaste un formulario hace días y ya lo olvidaste.',
    quePasa: 'te llega una nota de voz de un desconocido y te incomoda.',
    queHace: 'preguntas quién es o de dónde sacó tu número.',
    comoEvoluciona: 'si te reconocen el origen del dato con precisión, te relajas y sigues la charla. Si lo evaden o te venden algo, te molestas y cortas.',
    primerMensaje: ['quien eres?', 'y esto que es? no recuerdo haber dejado mis datos', 'de donde sacaste mi numero'],
    minRespuestas: 1,
    obligatorio: false,
  },
  {
    id: 'bienvenida_no_califica',
    titulo: 'Audio de bienvenida: no es tu cliente',
    objetivo: 'Define cómo cierras con quien no califica, sin regalarle una reunión.',
    audio: 'bienvenida',
    quien: 'dejaste tus datos por curiosidad; no eres el cliente de este negocio.',
    quePasa: 'te interesa el tema pero no estás en posición de contratar nada.',
    queHace: 'cuentas tu situación real, que deja claro que no calificas.',
    comoEvoluciona: 'si te empujan la llamada igual, la agendas y NO llegas. Si te explican con respeto que todavía no es para ti, agradeces y quedas bien.',
    primerMensaje: ['apenas voy a empezar mi negocio, todavia no facturo', 'soy estudiante, nomas quiero aprender', 'yo trabajo en una empresa, no soy el dueño'],
    minRespuestas: 1,
    obligatorio: false,
  },
  {
    id: 'agenda_ok_seco',
    titulo: 'Reunión agendada: contesta «ok» y no ve el video',
    objetivo: 'Define cómo consigues que llegue preparado a la reunión.',
    audio: 'agenda_con_bienvenida',
    quien: 'ya venías conversando y agendaste. Te acaban de pedir que veas un video antes.',
    quePasa: 'no tienes ganas de tarea previa; piensas que en la llamada te explican.',
    queHace: 'contestas en monosílabos y no ves el video.',
    comoEvoluciona: 'si te vuelven a escribir sin un motivo nuevo, sigues en monosílabos. Si te dan una razón concreta (que sin el video la reunión rinde la mitad), preguntas cuánto dura.',
    primerMensaje: ['ok', 'va', '👍'],
    minRespuestas: 1,
    obligatorio: false,
    requiereVideo: true,
  },
  {
    id: 'agenda_reprograma',
    titulo: 'Reunión agendada: quiere cambiar el día',
    objetivo: 'Define cómo reprogramas sin perder al lead.',
    audio: 'agenda_primer_contacto',
    quien: 'agendaste y se te cruzó otra cosa.',
    quePasa: 'sigues interesado, pero si se complica lo dejas pasar.',
    queHace: 'pides mover la cita.',
    comoEvoluciona: 'si te mandan solo el link de la agenda, no reprogramas nunca. Si te proponen dos horarios concretos, eliges uno.',
    primerMensaje: ['oye se me empalmo una junta, podemos otro dia?', 'puedo mover la cita?'],
    minRespuestas: 1,
    obligatorio: false,
  },
];

export const escenarioPorId = (id: string): Escenario | null => ESCENARIOS.find((e) => e.id === id) ?? null;

/** Los escenarios que corresponden a este workspace. */
export function escenariosDe(hayVideo: boolean): Escenario[] {
  return ESCENARIOS.filter((e) => !e.requiereVideo || hayVideo);
}

/**
 * El slot {{escenario}} del prompt. Se arma SIEMPRE desde el catálogo: el
 * cliente manda un id, nunca texto libre — si mandara el texto, cualquiera
 * podría reescribirle el personaje al modelo desde el navegador.
 */
export function bloqueEscenario(e: Escenario): string {
  const audio = defDeClave(e.audio);
  return [
    `LO QUE ACABA DE PASAR: el negocio te mandó una nota de voz. ${audio ? `Es su audio de «${audio.titulo}»: ${audio.situacion}` : ''}`,
    `QUIÉN ERES: ${e.quien}`,
    `QUÉ TE PASA: ${e.quePasa}`,
    `QUÉ HACES: ${e.queHace}`,
    `CÓMO EVOLUCIONAS: ${e.comoEvoluciona}`,
  ].join('\n');
}
