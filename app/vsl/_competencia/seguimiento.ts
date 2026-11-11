// =============================================================================
// /vsl/seguimiento — Automations, tu setter con IA, con la ESTRUCTURA de la landing de SetSmart (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones y el storytelling; la cara es la de /vsl):
//   https://setsmart.io/es  (leída el 11/11/2026 con Chromium)
// Su orden, que se respeta acá: hero con la bandeja → integraciones → «La solución»: el lead que se enfría contra el que
// avanza → lo que dicen los clientes → «Todo lo que hace tu setter IA» → «Automatiza el agendamiento…» (cómo trabaja,
// paso del lead a la reunión) → «Operativo en menos de 10 minutos» (3 pasos) → «Controla SetSmart desde tu propia IA» →
// preguntas. Por qué ganó: docs/competencia/landings-por-funcion.md → «Automations / setter con IA».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus testimonios y sus «500+ coaches» son suyos: la prueba de MaKo es el caso de Mauricio, el de todas sus landings.
//   · Su tabla contra el setter humano, la calculadora de ROI y las «estadísticas en vivo» son números que MaKo no tiene
//     medidos: no van (nada se inventa).
//   · «Agenda dentro del chat» no se promete: lib/funciones-mako.ts dice que MaKo le RECUERDA la reunión al lead y lo
//     mueve de etapa. Tampoco el «riesgo de baneo» de sus preguntas: no se vende el ritmo de envío como protección.
//   · Su «controla SetSmart desde tu propia IA» (MCP) es, en MaKo, la API: crear_automatizacion_desde_plantilla y
//     crear_automatizacion_con_ia (lib/api-mako/areas/chatbot.def.ts).
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['setting']); los gráficos, de la landing anterior de este slug.
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  setter: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
  comentario: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
  voz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  ramas: ['M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M7 8l0 8', 'M9 18h6a2 2 0 0 0 2 -2v-5', 'M14 14l3 -3l3 3'],
  reunion: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16'],
  crm: ['M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z', 'M10 16h6', 'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 8h3', 'M4 12h3', 'M4 16h3'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
};

export const LANDING_SEGUIMIENTO: LandingCompetencia = {
  slug: 'seguimiento',
  nombre: 'Automations · tu setter con IA',
  icono: I.setter,
  referencia: { nombre: 'SetSmart — setter con IA para coaches', url: 'https://setsmart.io/es', leida: '2026-11-11' },
  metaTitle: 'Automations de MaKo: tu setter con IA para WhatsApp, Instagram y email',
  metaDesc: 'Un agente que contesta por WhatsApp, Instagram, Messenger y email, le recuerda la reunión al lead, lo mueve de etapa en tu CRM y te lo pasa cuando hace falta una persona. Tú solo cierras en la llamada.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Tu setter con IA',
      titulo: 'Tu setter con IA contesta y sigue a cada lead. Tú solo cierras en la llamada.',
      bajada: 'Un agente que contesta por <strong>WhatsApp, Instagram, Messenger y email</strong>, le recuerda la reunión al lead, lo mueve de etapa en tu CRM y te lo pasa cuando hace falta una persona.',
      puntos: ['Arrancas de una plantilla o se la pides a MaKo en palabras', 'Nace pausada: la pruebas antes de prenderla'],
      visual: { tipo: 'detalle', slug: 'seguimiento' },
    },
    {
      tipo: 'logos',
      titulo: 'Contesta y sigue por',
      items: [
        { logo: 'whatsapp.png', nombre: 'WhatsApp' },
        { logo: 'meta.png', nombre: 'Instagram y Messenger' },
        { logo: 'gmail.png', nombre: 'Email' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'La solución',
      titulo: 'El lead que nadie sigue se enfría. El que MaKo sigue, avanza.',
      sin: {
        titulo: 'Te escribe, contestas tarde, y se enfrió',
        texto: 'Llega un mensaje a la noche o en medio de una llamada. Cuando lo ves, el lead ya se distrajo. Y al que agendó y no vino, o al que vio tu video y no agendó, <strong>nadie le vuelve a escribir</strong>: ahí se queda la plata.',
      },
      con: {
        titulo: 'MaKo contesta, le recuerda y lo empuja al siguiente paso',
        texto: 'La automatización contesta con la voz de tu negocio, le recuerda la reunión al que agendó y le escribe al que se quedó en el camino. Lo mueve de etapa en tu CRM y, cuando hace falta una persona, <strong>te lo pasa</strong>.',
      },
      cta: true,
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que hace tu setter con IA',
      items: [
        { icono: I.comentario, titulo: 'Del comentario al mensaje directo', texto: 'Arranca con un comentario en tu publicación, tu Reel o tu En vivo, con la respuesta a una historia o con un mensaje directo. Y puede mandar el mensaje con botones debajo.' },
        { icono: I.voz, titulo: 'Escribe con la voz de tu negocio', texto: 'Las secuencias las escribe MaKo en la voz de tu negocio, no en la de una plantilla genérica.' },
        { icono: I.ramas, titulo: 'Ramas, condiciones y horarios', texto: 'Si contestó, si agendó, qué etiqueta tiene: cada lead sigue el camino que le toca, en el horario que pones.' },
        { icono: I.reunion, titulo: 'Le recuerda la reunión', texto: 'Al que agendó le escribe antes de la llamada, para que llegue.' },
        { icono: I.crm, titulo: 'Mueve al lead en tu CRM', texto: 'Lo que pasa en la conversación cambia la etapa del lead, sin que nadie la toque a mano.' },
        { icono: I.persona, titulo: 'Te lo pasa cuando hace falta una persona', texto: 'Cuando la conversación necesita a alguien de tu equipo, la automatización se corre y la sigue una persona.' },
      ],
    },
    {
      tipo: 'filas',
      fondo: true,
      titulo: 'Del primer mensaje a la reunión, sin que se te escape nadie',
      slug: 'seguimiento',
      items: [
        { grafico: 0, titulo: 'Arranca en el momento justo del lead', texto: 'Cada automatización tiene su disparador: una <strong>etapa de tu CRM</strong>, una etiqueta que se le agrega al lead o un evento. Así le escribe al que se trabó en ese paso, no a todos igual.' },
        { grafico: 1, titulo: 'Le escribe al que se quedó en el camino', texto: 'Al que dejó el formulario sin agendar o al que faltó a la llamada le llega el mensaje de su momento, por WhatsApp o por email.' },
        { grafico: 2, titulo: 'Si el lead contesta, se corta', texto: 'Con la condición «Contestó», la respuesta del lead corta la secuencia en el acto: <strong>no le sigue escribiendo a alguien que ya te respondió</strong>.' },
      ],
    },
    {
      tipo: 'pasos',
      titulo: 'Andando en 3 pasos',
      pasos: [
        { titulo: 'Elige la plantilla o pídesela a MaKo', texto: 'Arrancas de la galería de plantillas o le dices a MaKo en palabras qué quieres que haga. La automatización nace pausada.' },
        { titulo: 'Conecta tus canales', texto: 'Tu WhatsApp, tu Instagram o tu Messenger, y tu email para las secuencias.' },
        { titulo: 'Pruébala como si fueras el lead y actívala', texto: 'Simulas la conversación de punta a punta, ves cómo contesta y recién ahí la prendes.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Y la manejas desde tu propia IA',
      bajada: 'Con la API de MaKo, tu Claude puede ver tus plantillas, crear una automatización desde una plantilla o desde un pedido en palabras, duplicarla y cambiar su configuración.',
      columnas: 2,
      items: [
        { icono: I.setter, titulo: 'Desde una plantilla', texto: 'Le dices a tu IA cuál de la galería quieres y la crea en tu MaKo.' },
        { icono: I.voz, titulo: 'Desde un pedido en palabras', texto: '«Una automatización que le escriba al que agendó y no vino»: la arma con su disparador y nace pausada.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿Por qué canales contesta?', r: 'Por WhatsApp, Instagram, Messenger y email. Ves todas las conversaciones juntas en Chats.' },
        { p: '¿Tengo que armar los flujos de cero?', r: 'No. Arrancas de una plantilla de la galería o se la pides a MaKo en palabras. Después la ajustas: ramas, condiciones, horarios, etiquetas y acciones.' },
        { p: '¿Puedo probarla antes de que le escriba a un lead?', r: 'Sí. La automatización nace pausada y puedes simular la conversación como si fueras el lead antes de activarla.' },
        { p: '¿Qué pasa cuando el lead necesita hablar con una persona?', r: 'La automatización te pasa la conversación y la sigue alguien de tu equipo.' },
        { p: '¿Quién escribe los mensajes?', r: 'MaKo escribe las secuencias en la voz de tu negocio, y tú las editas cuando quieras.' },
      ],
    },
  ],
};
