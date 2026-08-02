// =============================================================================
// En qué situación está el lead de cada etapa
// =============================================================================
// El wizard preguntaba "¿Qué buscamos?" con la etapa ya elegida y nada más. Pero
// el objetivo correcto DEPENDE de en qué situación está esa persona, y eso el
// dueño no lo tiene presente cuando está armando la secuencia: alguien que no
// agendó hace 4 meses no se trata igual que alguien que faltó a una reunión
// ayer, aunque a los dos "haya que escribirles".
//
// Así que antes de preguntar, se explica. El texto describe al lead —qué le pasó,
// qué recuerda, qué temperatura tiene— y de ahí se cae solo cuál es el objetivo
// razonable, que además viene sugerido.
//
// Archivo PURO (sin 'server-only'): lo lee el wizard en el cliente.

import type { Objetivo } from './setting-estrategia';

export type ContextoEtapa = {
  /** La situación del lead, en 2-4 frases. Se muestra arriba de la pregunta. */
  situacion: string;
  /** El objetivo que MaKo recomienda para esta etapa, y por qué. */
  sugerido: Objetivo;
  porque: string;
};

export const CONTEXTO_ETAPA: Record<string, ContextoEtapa> = {
  lead: {
    situacion: 'Acaba de dejar sus datos en el formulario del anuncio y todavía no agendó nada. Es el momento más caliente que vas a tener con esta persona: vio tu anuncio hace minutos y todavía se acuerda de qué prometía. También es el momento en que menos te conoce, así que no sabe si sos confiable.',
    sugerido: 'agendar',
    porque: 'Está caliente y sin reunión: lo único que hace falta es que dé el siguiente paso antes de enfriarse.',
  },
  nutri: {
    situacion: 'Dejó sus datos pero no agendó, y ya pasó el primer contacto. Sigue interesado en el tema —por algo llenó el formulario— pero algo lo frenó: no era el momento, no entendió qué le ofreces, o no le alcanzó la confianza para dar el paso.',
    sugerido: 'agendar',
    porque: 'Ya mostró interés y no llegó a la reunión: falta destrabar lo que lo frenó, no volver a explicarle todo.',
  },
  agenda: {
    situacion: 'Tiene una reunión agendada y todavía no ocurrió. Acá el riesgo no es que no le interese: es que no aparezca. La mitad de las ausencias se evitan con un mensaje que le recuerde para qué es la reunión y qué se lleva.',
    sugerido: 'preparar',
    porque: 'La reunión ya está: lo que falta es que llegue, y que llegue sabiendo de qué se trata.',
  },
  agendaj2: {
    situacion: 'Ya tuvo la primera reunión y tiene agendada la segunda. Te conoce, escuchó tu propuesta y decidió seguir — pero entre una reunión y otra es donde se enfría y donde aparecen las dudas que no dijo en voz alta.',
    sugerido: 'preparar',
    porque: 'Viene avanzando: el trabajo es sostener el impulso hasta la segunda reunión.',
  },
  noshow_r1: {
    situacion: 'Agendó la primera reunión y no apareció. Ojo con la lectura fácil: la mayoría de las ausencias no son desinterés, son olvido o un imprevisto. Alguien que reservó un horario ya te dio la señal más fuerte que existe. Escribirle con reproche lo pierde; escribirle con naturalidad lo recupera.',
    sugerido: 'agendar',
    porque: 'Ya quiso reunirse una vez: lo que falta es volver a poner fecha, sin hacerlo sentir mal.',
  },
  noshow_r2: {
    situacion: 'Faltó a la segunda reunión, después de haber tenido la primera. Este ya te conoce y escuchó la propuesta, así que la ausencia dice algo más que un olvido: puede ser una duda que no te planteó, o que perdió la urgencia.',
    sugerido: 'cualificar',
    porque: 'Faltar después de conocerte suele ser una objeción sin decir: conviene averiguarla antes de volver a agendar.',
  },
  noshow_r3: {
    situacion: 'Faltó de nuevo. Es el último intento antes de dejarlo descansar, y hay que tratarlo como tal: sin insistir, dándole una salida digna y dejando la puerta abierta para más adelante.',
    sugerido: 'reactivar',
    porque: 'Ya faltó varias veces: forzar otra reunión lo quema. Mejor un último mensaje que valga por sí solo.',
  },
  nocompro: {
    situacion: 'Tuvo la reunión completa y no compró. Sabe exactamente qué vendes, cuánto cuesta y qué incluye — no le falta información, le faltó una razón. Repetirle la oferta no cambia nada; lo que puede cambiar algo es entender qué lo detuvo.',
    sugerido: 'cualificar',
    porque: 'Ya tiene toda la información: lo que falta es saber qué lo frenó para poder responderlo.',
  },
  nopaga: {
    situacion: 'Dijo que sí y no pagó. Es la etapa más frágil de todas: la decisión ya está tomada y lo que queda es fricción —el link que no abrió, el comprobante que no mandó, la transferencia que dejó para después—. Cada día que pasa la decisión se enfría.',
    sugerido: 'confirmar_pago',
    porque: 'Ya decidió comprar: lo único que falta es sacarle la fricción de encima, rápido.',
  },
  reactivacion: {
    situacion: 'Hace semanas o meses que nadie le escribe. Trátalo como un lead frío: es muy probable que no recuerde tu anuncio, ni tu landing, ni la conversación que tuvieron. Retomar como si nada quedó pendiente ayer suena falso. Acá lo único que se busca es que vuelva a responder — cualquier otra cosa viene después.',
    sugerido: 'reactivar',
    porque: 'Está frío y no te recuerda: pedirle una reunión de entrada es pedir demasiado. Primero que conteste.',
  },
  manual: {
    situacion: 'Lo pusiste vos a mano en nutrición, así que la situación la conoces mejor que nadie. Estos leads no entran por ninguna regla automática: alguien decidió que había que escribirles.',
    sugerido: 'reactivar',
    porque: 'Entró a mano, sin una etapa que lo explique: conviene un objetivo amplio.',
  },
  reunion_excepcional: {
    situacion: 'Está en una reunión fuera del recorrido normal. Es un estacionamiento, no una etapa del funnel: lo que corresponda depende del caso puntual.',
    sugerido: 'preparar',
    porque: 'Hay una reunión de por medio: lo importante sigue siendo que llegue.',
  },
  facturando: {
    situacion: 'Ya es cliente y está pagando. Escribirle acá no es vender: es entrega, soporte o la puerta a que compre algo más. Cuidado con tratarlo como un lead — es lo que más rápido rompe la confianza de alguien que ya te pagó.',
    sugerido: 'preparar',
    porque: 'Ya compró: el trabajo es sostener la relación, no volver a venderle lo mismo.',
  },
  ganado: {
    situacion: 'Cerró y terminó su ciclo. Cualquier mensaje acá es de relación o de recompra, nunca de captación.',
    sugerido: 'reactivar',
    porque: 'El ciclo terminó: si se le escribe, es para abrir uno nuevo.',
  },
};

/** El contexto de una etapa, o null si no hay uno escrito para ella. */
export const contextoDe = (etapa: string): ContextoEtapa | null => CONTEXTO_ETAPA[etapa] ?? null;

/** Dónde se guardan los objetivos que el dueño escribió con la opción "Otro". */
export const KEY_OBJETIVOS_CUSTOM = 'chat_agent.objetivos_custom';
