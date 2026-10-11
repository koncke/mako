// =============================================================================
// Los ESCENARIOS del ensayo del onboarding del Chatbot
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
// ── Lo que cambió en la v2, y por qué ────────────────────────────────────────
// El ensayo era un bucle infinito de objeciones. Tres causas, las tres acá:
//
//  1. `comoEvoluciona` era UNA línea estática que entraba idéntica en cada turno.
//     "te resistes una vez y después aflojas" no tiene contador: el modelo la
//     releía como si siempre fuera la primera vez, así que se resistía para
//     siempre. Ahora la evolución es un GUION POR TURNO (`evolucion[]`) y la
//     ruta inyecta solo el renglón del turno que toca.
//  2. No existía ningún final. Ahora cada caso declara su `desenlace` y el
//     ÚLTIMO renglón de `evolucion` es siempre el turno de cierre — de ahí sale
//     el tope de turnos, así que no pueden contradecirse.
//  3. Nada decía qué temas NO son de este caso, y el prompt encima le regalaba
//     al modelo la frase textual a repetir («solo quiero saber el precio»). Por
//     eso el caso de silencio terminaba hablando del precio. Ahora está
//     `fueraDeTema`, y en el guion no hay ni una frase entrecomillada.
//
// Sin 'server-only': la ruta arma el prompt con esto y el cliente pinta los
// títulos y las semillas (mismo motivo que lib/setting-estrategia.ts).

import { type ClaveAudio, defDeClave, audiosDe } from './audios-paso';
import type { EntradaId } from './pipeline';
import type { CanalId } from './fase-diagnostico';

/**
 * Cómo terminó un caso del ensayo. `abierto` es el borde: se acabaron los
 * turnos y el modelo no dejó veredicto — decirle al dueño que salió mal sin
 * saberlo sería inventarle un resultado.
 */
export type Desenlace = 'positivo' | 'negativo' | 'abierto';

export type Escenario = {
  id: string;
  /** Título de la slide. Español neutro, formato «<Audio>: <qué hace el lead>». */
  titulo: string;
  /** Qué define el dueño respondiendo esto, en una línea. */
  objetivo: string;
  /** De cuál de los 3 audios arranca. Misma clave que lib/audios-paso.ts. */
  audio: ClaveAudio;
  /** Para el prompt: quién es y qué le pasa. */
  quien: string;
  quePasa: string;
  queHace: string;
  /**
   * El guion del lead, UN RENGLÓN POR TURNO suyo. La ruta inyecta `evolucion[n]`
   * y nada más, así el personaje AVANZA en vez de releer la misma instrucción.
   *
   * El ÚLTIMO renglón es siempre el turno de cierre: dice que esta conversación
   * termina acá y cómo. De ahí sale `maxTurnosDe()`, y por eso el tope no puede
   * quedar desalineado con el guion.
   */
  evolucion: string[];
  /**
   * Cómo termina bien y cómo termina mal, en TERCERA persona: el prompt lo usa
   * como «el lead <positivo>» y la pantalla muestra ese mismo texto cuando el
   * caso cierra. Una sola redacción del mismo hecho, en los dos lados.
   */
  desenlace: { positivo: string; negativo: string };
  /**
   * Temas que pertenecen a OTROS casos. Van al prompt como prohibición explícita:
   * "no cambies de tema" es abstracto, "no preguntes el precio" es accionable.
   */
  fueraDeTema: string[];
  /**
   * 'avatar' → el lead ES el cliente ideal del workspace y sus cifras tienen que
   * ser coherentes con él. 'fuera_del_avatar' → NO califica, y eso es el punto
   * del caso: la incoherencia es deliberada, no un invento del modelo.
   */
  encarna: 'avatar' | 'fuera_del_avatar';
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
    // gana siempre, el dueño no aprende qué funciona — solo se frustra.
    evolucion: [
      'sigues sin contestar, salvo que este mensaje te dé algo NUEVO y concreto: un dato que te sirva, un recurso sin compromiso, o una observación puntual sobre tu tipo de empresa. Si solo insiste, saluda otra vez o pregunta si viste el anterior, no contestas.',
      'si te dieron algo de valor, contestas corto y todavía desconfiado. Si volvieron a insistir sin nada nuevo, sigues sin contestar.',
      'último mensaje tuyo. Si en algún momento te dieron una razón concreta, contestas y aceptas hablar. Si nunca pasó de la insistencia, no contestas nunca más.',
    ],
    desenlace: {
      positivo: 'rompe el silencio y acepta hablar',
      // Cubre las dos formas de perderlo: el silencio y el "gracias, ahora no".
      negativo: 'se va sin aceptar hablar',
    },
    fueraDeTema: ['preguntar el precio', 'pedir cambiar el día de una reunión', 'decir que no recuerdas haber dejado tus datos'],
    encarna: 'avatar',
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
    evolucion: [
      'insistes con el número una sola vez. Si te devolvieron una pregunta, la esquivas y vuelves a pedir la cifra, pero con tus propias palabras.',
      'aflojas: contestas lo que te preguntaron, aunque dejes claro que sigues queriendo saber cuánto cuesta. Ya no vuelves a insistir con el precio.',
      'último mensaje tuyo. Si te dieron una razón concreta para hablar antes del número, aceptas la llamada. Si te tiraron una cifra pelada o te presionaron, cortas.',
    ],
    desenlace: {
      positivo: 'acepta la llamada antes de saber el precio',
      negativo: 'corta la conversación por el precio',
    },
    fueraDeTema: ['no acordarte de haber dejado tus datos', 'pedir cambiar el día de una reunión', 'decir que estás ocupado'],
    encarna: 'avatar',
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
    quePasa: 'tienes una empresa andando y algo que no te termina de funcionar, pero no lo tienes ordenado en la cabeza.',
    queHace: 'contestas la pregunta del audio con poco detalle y desordenado.',
    evolucion: [
      'si te devolvieron una observación concreta sobre lo que contaste, te abres y das un dato más. Si te respondieron algo genérico o te empujaron a la llamada de una, contestas seco.',
      'si la conversación te está aportando algo, cuentas el problema de fondo. Si no, empiezas a despedirte.',
      'último mensaje tuyo. Si entendiste que hablar te sirve, aceptas la reunión. Si sentiste que solo te querían vender, quedas en que lo piensas y no vuelves.',
    ],
    desenlace: {
      positivo: 'acepta la reunión',
      negativo: 'queda en pensarlo y no vuelve',
    },
    fueraDeTema: ['preguntar el precio', 'no acordarte de haber dejado tus datos', 'pedir cambiar el día de una reunión'],
    encarna: 'avatar',
    primerMensaje: ['tengo una firma de servicios aqui, somos como 30', 'una constructora, ya varios años', 'tenemos una empresa de software, unos 20 en el equipo'],
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
    queHace: 'confirmas la reunión y sueltas contexto de tu empresa, incluido lo que te duele.',
    evolucion: [
      'si te hicieron UNA sola pregunta buena, contestas con gusto y con detalle. Si te hicieron tres juntas o te mandaron un texto largo, contestas en corto.',
      'das el dato más incómodo (números, tamaño del equipo, cuánto te está costando) solo si hasta aquí te trataron bien.',
      'último mensaje tuyo. Confirmas que llegas a la reunión y quedas en algo concreto, o dices que mejor lo dejas para más adelante.',
    ],
    desenlace: {
      positivo: 'confirma la reunión y llega preparado',
      negativo: 'deja la reunión para más adelante',
    },
    fueraDeTema: ['preguntar el precio', 'no acordarte de haber dejado tus datos'],
    encarna: 'avatar',
    primerMensaje: ['si ya quede para el jueves. tengo una firma de ingenieria, somos 35', 'va. mira mi tema es que todo me pasa por el escritorio'],
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
    evolucion: [
      'si te propusieron un horario concreto, aceptas a medias. Si te mandaron un texto largo o te dejaron la pelota a ti, contestas con una palabra.',
      'último mensaje tuyo. Si hay un horario concreto sobre la mesa, lo confirmas. Si no, dices que tú escribes y no vuelves a escribir.',
    ],
    desenlace: {
      positivo: 'confirma un horario concreto',
      negativo: 'queda en escribir después y no vuelve',
    },
    fueraDeTema: ['preguntar el precio', 'contar tu problema de negocio en detalle'],
    encarna: 'avatar',
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
    evolucion: [
      'si te reconocieron el origen del dato con precisión (dónde, cuándo, con qué anuncio), te relajas. Si lo evadieron o te empezaron a vender, te molestas.',
      'último mensaje tuyo. Ya relajado, sigues la charla y preguntas de qué se trata. Molesto, pides que no te escriban más.',
    ],
    desenlace: {
      positivo: 'se relaja y sigue la conversación',
      negativo: 'pide que no le escriban más',
    },
    fueraDeTema: ['preguntar el precio', 'pedir cambiar el día de una reunión'],
    encarna: 'avatar',
    primerMensaje: ['quien eres?', 'y esto que es? no recuerdo haber dejado mis datos', 'de donde sacaste mi numero'],
    minRespuestas: 1,
    obligatorio: false,
  },
  {
    id: 'bienvenida_no_califica',
    titulo: 'Audio de bienvenida: no es tu cliente',
    objetivo: 'Define cómo cierras con quien no califica, sin regalarle una reunión.',
    audio: 'bienvenida',
    quien: 'dejaste tus datos por curiosidad. NO eres el cliente de este negocio y eso tiene que notarse en lo que cuentas.',
    quePasa: 'te interesa el tema pero no estás en posición de contratar nada.',
    queHace: 'cuentas tu situación real, que deja claro que no calificas.',
    evolucion: [
      'das el dato que te descalifica sin darte cuenta de que te descalifica: tu tamaño real, tu facturación real, o que la decisión no es tuya.',
      'último mensaje tuyo. Si te empujaron la reunión igual, la agendas sin ganas y avisas que capaz no llegas. Si te explicaron con respeto que todavía no es para ti, agradeces y quedas bien.',
    ],
    desenlace: {
      positivo: 'se va bien, entendiendo que todavía no es para su empresa',
      negativo: 'agenda una reunión a la que no va a llegar',
    },
    fueraDeTema: ['preguntar el precio', 'pedir cambiar el día de una reunión'],
    // El único caso que NO encarna al avatar, y es todo el punto: el dueño tiene
    // que ver cómo cierra con alguien que está claramente fuera de su cliente.
    encarna: 'fuera_del_avatar',
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
    evolucion: [
      'si te volvieron a escribir sin un motivo nuevo, sigues en monosílabos. Si te dieron una razón concreta (que sin el video la reunión rinde la mitad, o cuánto dura), preguntas algo.',
      'último mensaje tuyo. Con una razón concreta, te comprometes a verlo antes. Sin ella, contestas «va» y no lo ves.',
    ],
    desenlace: {
      positivo: 'se compromete a ver el video antes de la reunión',
      negativo: 'contesta de compromiso y no lo ve',
    },
    fueraDeTema: ['preguntar el precio', 'no acordarte de haber dejado tus datos'],
    encarna: 'avatar',
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
    evolucion: [
      'si te propusieron dos horarios concretos, eliges uno. Si te mandaron solo un link de agenda o te preguntaron cuándo puedes, contestas vago.',
      'último mensaje tuyo. Con un horario concreto sobre la mesa, lo confirmas. Sin él, dices que después lo ves y no reprogramas nunca.',
    ],
    desenlace: {
      positivo: 'elige un horario nuevo y queda confirmado',
      negativo: 'no reprograma nunca',
    },
    fueraDeTema: ['preguntar el precio', 'no acordarte de haber dejado tus datos'],
    encarna: 'avatar',
    primerMensaje: ['oye se me empalmo una junta, podemos otro dia?', 'puedo mover la cita?'],
    minRespuestas: 1,
    obligatorio: false,
  },

  // ── Prospección en frío ────────────────────────────────────────────────────
  // ⚠️ Estos tres NO son variantes de los de arriba. En los anteriores el lead
  // dejó un dato y espera que lo contacten; acá no espera nada y la primera
  // reacción es la desconfianza. Tan es así que «no me acuerdo de haber dejado
  // mis datos» —que en los escenarios de anuncio está PROHIBIDO por fuera de
  // tema— es la reacción número uno de este lado y hay que saber contestarla.
  {
    id: 'fria_quien_sos',
    titulo: 'Mensaje en frío: «¿quién eres?»',
    objetivo: 'Define cómo te presentas cuando del otro lado no te esperaba nadie.',
    audio: 'apertura_fria',
    quien: 'recibiste una nota de voz de alguien que no conoces, sin haber pedido nada.',
    quePasa: 'desconfías: no sabes de dónde salió tu número ni por qué te escriben justo a ti.',
    queHace: 'preguntas quién es y de dónde sacó tu contacto, medio cortante.',
    evolucion: [
      'si te dieron una razón CONCRETA de por qué te escribieron a ti —algo que vieron de tu negocio, no una frase genérica— aflojas y preguntas de qué se trata. Si te contestaron algo vago o te esquivaron la pregunta del número, te pones más seco.',
      'si aflojaste, contestas algo real de tu situación pero sin comprometerte a nada. Si seguían vagos, dices que no te interesa.',
      'último mensaje tuyo. Si en algún momento te dieron algo útil sin pedirte nada a cambio, aceptas seguir la charla. Si solo te vendieron, cortas.',
    ],
    desenlace: {
      positivo: 'acepta seguir la conversación',
      negativo: 'corta por desconfianza',
    },
    fueraDeTema: ['preguntar el precio', 'pedir cambiar el día de una reunión', 'decir que ya conocías el negocio'],
    encarna: 'avatar',
    primerMensaje: ['quien eres?', 'de donde sacaste mi numero', 'perdon nos conocemos?'],
    minRespuestas: 3,
    obligatorio: true,
  },
  {
    id: 'fria_no_interesa',
    titulo: 'Mensaje en frío: «no me interesa»',
    objetivo: 'Define cómo respondes un no rotundo sin insistir ni desaparecer.',
    audio: 'apertura_fria',
    quien: 'recibiste una nota de voz de alguien que no conoces ofreciéndote algo.',
    quePasa: 'estás ocupado y tu reflejo con cualquier mensaje comercial es cortarlo rápido.',
    queHace: 'contestas que no te interesa, en dos palabras.',
    evolucion: [
      'si te insistieron con la oferta, no contestas más. Si en cambio te preguntaron algo puntual de tu negocio sin venderte nada, contestas corto — te dio curiosidad.',
      'si te preguntaron bien, das un dato real de tu situación. Si te siguieron vendiendo, cortas definitivamente.',
      'último mensaje tuyo. Si la charla se volvió sobre TU problema y no sobre su producto, aceptas escuchar. Si no, te vas.',
    ],
    desenlace: {
      positivo: 'cambia de idea y acepta escuchar',
      negativo: 'se va sin interés',
    },
    fueraDeTema: ['preguntar el precio', 'pedir cambiar el día de una reunión'],
    encarna: 'avatar',
    primerMensaje: ['no gracias', 'no me interesa', 'no estoy interesado gracias'],
    minRespuestas: 2,
    obligatorio: true,
  },
  {
    id: 'entrante_que_ofrecen',
    titulo: 'Te escribieron: «¿qué ofrecen?»',
    objetivo: 'Define cómo explicas lo que haces a alguien que llegó por su cuenta.',
    audio: 'respuesta_entrante',
    quien: 'escribiste tú al negocio porque viste algo de ellos y te dio curiosidad.',
    quePasa: 'no tienes claro qué venden exactamente ni si es para ti.',
    queHace: 'preguntas qué es lo que ofrecen, en general.',
    evolucion: [
      'si te explicaron en criollo y te devolvieron una pregunta sobre tu situación, la contestas. Si te tiraron un discurso largo o lleno de nombres raros, respondes con un «ah, ok» y nada más.',
      'si la charla te está sirviendo, cuentas tu problema real. Si no, dices que lo vas a pensar.',
      'último mensaje tuyo. Si entendiste qué te resuelve a TI, aceptas dar el siguiente paso. Si sigues sin entenderlo, te vas amablemente.',
    ],
    desenlace: {
      positivo: 'entiende la propuesta y acepta el siguiente paso',
      negativo: 'se va sin entender qué le resuelve',
    },
    fueraDeTema: ['pedir cambiar el día de una reunión', 'decir que no recuerdas haber escrito'],
    encarna: 'avatar',
    primerMensaje: ['hola, que ofrecen?', 'buenas, me pasas info?', 'hola! como es el tema?'],
    minRespuestas: 2,
    obligatorio: true,
  },
  {
    id: 'evento_no_puedo_ir',
    titulo: 'Sesión: «esta semana no puedo»',
    objetivo: 'Define qué haces cuando confirma que va y después se cae.',
    audio: 'evento_confirmado',
    quien: 'habías quedado en ir a la sesión y ya te confirmaron que te esperan.',
    quePasa: 'se te complicó a último momento y no vas a poder ir.',
    queHace: 'avisas que esta vez no llegas.',
    evolucion: [
      'si te ofrecieron la siguiente fecha concreta, dices que sí o que lo ves. Si solo te dijeron «cuando puedas», no vuelves a escribir.',
      'último mensaje tuyo. Con una fecha concreta encima, confirmas que vas. Sin ella, la charla se apaga.',
    ],
    desenlace: {
      positivo: 'queda confirmado para la próxima fecha',
      negativo: 'se pierde sin volver a aparecer',
    },
    fueraDeTema: ['preguntar el precio', 'no acordarte de haber hablado antes'],
    encarna: 'avatar',
    primerMensaje: ['oye esta semana no voy a poder', 'se me complico, no llego', 'perdon, no puedo ir'],
    minRespuestas: 1,
    obligatorio: false,
  },
];

export const escenarioPorId = (id: string): Escenario | null => ESCENARIOS.find((e) => e.id === id) ?? null;

/**
 * Cuántos mensajes escribe el lead como MÁXIMO. Sale del guion, no de un número
 * suelto: el último renglón de `evolucion` ES el turno de cierre, así que tope y
 * guion no pueden contradecirse.
 */
/**
 * UN ESCENARIO SIN AUDIO (AI Step v2, décima tanda: el ensayo de objeciones de un AI Step, lib/ai-step-ensayo.ts).
 * El del onboarding arranca de una nota de voz del negocio; el de un AI Step, de un mensaje del LEAD. Reusar
 * `bloqueEscenario` con `audio` obligatorio le decía al modelo «el negocio te mandó una nota de voz» cuando no
 * se la mandó nadie (docs/diseno-ai-step-v2.md §11). Un `Escenario` del catálogo entra igual.
 */
export type EscenarioEnsayo = Omit<Escenario, 'audio'> & { audio?: ClaveAudio };

export const maxTurnosDe = (e: EscenarioEnsayo): number => e.evolucion.length;

/** El renglón del guion que toca en este turno (0-based). El último se sostiene. */
export const guionDelTurno = (e: EscenarioEnsayo, turno: number): string =>
  e.evolucion[Math.min(Math.max(turno, 0), e.evolucion.length - 1)];

/**
 * Los escenarios que corresponden a este workspace.
 *
 * Cada escenario cuelga de un AUDIO, así que la regla es una sola y no se puede
 * desincronizar: si el audio no está entre los que este negocio graba, el
 * escenario tampoco va. Ensayar cómo preparar una llamada que nunca ocurre no
 * enseña nada — y ensayar contra un lead que «dejó sus datos en un anuncio»
 * cuando nadie los deja es peor, porque entrena el reflejo equivocado.
 *
 * ⚠️ SIN DEFAULT en `entradas` ni en `canal`, por lo mismo que `audiosDe`: el
 * `hayReunion = true` que había acá le daba a cualquier caller distraído los
 * escenarios del funnel del dueño de la agencia.
 */
export function escenariosDe(hayVideo: boolean, entradas: EntradaId[], canal: CanalId | null): Escenario[] {
  const claves = new Set(audiosDe(entradas, canal).map((a) => a.clave));
  return ESCENARIOS.filter((e) => {
    if (e.requiereVideo && !hayVideo) return false;
    return claves.has(e.audio as ClaveAudio);
  });
}

/**
 * El slot {{escenario}} del prompt. Se arma SIEMPRE desde el catálogo: el
 * cliente manda un id, nunca texto libre — si mandara el texto, cualquiera
 * podría reescribirle el personaje al modelo desde el navegador.
 *
 * `turno` es cuántos mensajes lleva escritos el lead. De él salen el renglón del
 * guion y, en el último, la orden de cerrar. Sin esto el modelo releía la misma
 * instrucción para siempre y la conversación no avanzaba nunca.
 */
export function bloqueEscenario(e: EscenarioEnsayo, turno: number, avatar: string): string {
  const audio = e.audio ? defDeClave(e.audio) : null;
  const ultimo = turno >= maxTurnosDe(e) - 1;
  // La primera línea SÓLO si el escenario arranca de una nota de voz (los del onboarding). Uno de un AI Step
  // (sin `audio`) arranca de un mensaje del lead: decirle que le mandaron un audio le mentía al modelo.
  const partes = e.audio ? [
    `LO QUE ACABA DE PASAR: el negocio te mandó una nota de voz. ${audio ? `Es su audio de «${audio.titulo}»: ${audio.situacion}` : ''}`,
  ] : [];

  // El perfil real ancla las CIFRAS. Sin esto el modelo inventaba una
  // facturación cualquiera (salió un lead de 3.000 USD al mes para un negocio
  // cuyo cliente factura millones al año), y el ensayo dejaba de parecerse a
  // los leads que de verdad le escriben al dueño.
  if (avatar.trim()) {
    partes.push(
      e.encarna === 'avatar'
        ? `TU PERFIL REAL — eres exactamente esta clase de cliente:\n${avatar}\nTu rubro, tu tamaño de equipo y tus números tienen que caer DENTRO de ese perfil. No inventes cifras fuera de ese rango.`
        : `EL CLIENTE QUE ESTE NEGOCIO BUSCA (y que tú NO eres):\n${avatar}\nTú estás claramente por debajo o por fuera de eso, y es a propósito: los datos que sueltes tienen que dejarlo en evidencia.`,
    );
  }

  partes.push(
    `QUIÉN ERES: ${e.quien}`,
    `QUÉ TE PASA: ${e.quePasa}`,
    `QUÉ HACES: ${e.queHace}`,
    `EN ESTE MENSAJE (es el número ${turno + 1} que escribes): ${guionDelTurno(e, turno)}`,
    `CÓMO TERMINA ESTO — bien para el negocio: el lead ${e.desenlace.positivo}. Mal: el lead ${e.desenlace.negativo}.`,
  );

  if (e.fueraDeTema.length) {
    partes.push(`LO QUE NUNCA HACES EN ESTE CASO (es el tema de otra conversación, no de esta): ${e.fueraDeTema.join('; ')}.`);
  }

  // El cierre ocurre SIEMPRE en el último turno y nunca antes. Dejar que el
  // modelo cerrara "cuando llegara el final natural" salía peor que el bucle que
  // vino a arreglar: cerraba en el turno 1 con un «ok, no me interesa» y el
  // dueño no llegaba a practicar nada. Con el arco fijo, los turnos del guion se
  // juegan enteros y el resultado se decide recién al final, cuando ya hay algo
  // que juzgar.
  // El marcador se define con el desenlace DE ESTE CASO, nunca con "aceptar".
  // Escrito como "BIEN = aceptas lo que te proponen" quedaba INVERTIDO justo en
  // el caso que más importa: en «no es tu cliente», aceptar la reunión es el mal
  // resultado (el dueño regaló una reunión a alguien que no califica) y decir que
  // no es el bueno. La app lo felicitaba en verde por el error y lo pintaba en
  // rojo por el acierto.
  partes.push(
    ultimo
      ? [
        'ESTE ES TU ÚLTIMO MENSAJE. La conversación termina aquí: no dejes nada abierto ni hagas una pregunta nueva.',
        'Tu respuesta TERMINA con una línea que es exactamente [FIN:BIEN] o exactamente [FIN:MAL], y nada después.',
        `Pones [FIN:BIEN] si el lead ${e.desenlace.positivo}.`,
        `Pones [FIN:MAL] si el lead ${e.desenlace.negativo}.`,
      ].join('\n')
      : `Todavía NO cierres la conversación: te quedan ${maxTurnosDe(e) - turno - 1} mensajes después de este. No escribas ningún marcador.`,
  );

  return partes.join('\n');
}
