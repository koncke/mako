// =============================================================================
// /vsl/seguimiento — Automations, tu setter con IA, con la ESTRUCTURA de la landing de SetSmart (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://setsmart.io/es  (leída el 11/11/2026 con Chromium)
// El diseño copiado (barra, hero, secciones, tipografía, espacios, pie) es ./disenos/seguimiento.tsx; los valores medidos
// con getComputedStyle a 1440 y 390 px, en docs/diseno/landings-competencia/seguimiento.md.
// Su orden, que se respeta acá: hero con la bandeja → integraciones → «La solución»: el lead que se enfría contra el que
// avanza → lo que dicen los clientes → «Todo lo que hace tu setter IA» → «Automatiza el agendamiento…» (cómo trabaja,
// paso del lead a la reunión) → «Operativo en menos de 10 minutos» (3 pasos) → «Controla SetSmart desde tu propia IA» →
// preguntas. Por qué ganó: docs/competencia/landings-por-funcion.md → «Automations / setter con IA».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus testimonios y sus «500+ coaches» son suyos: la prueba de MaKo es el caso de Mauricio, el de todas sus landings.
//   · Su tabla contra el setter humano, la calculadora de ROI y las «estadísticas en vivo» son números que MaKo no tiene
//     medidos: no van (nada se inventa). Tampoco su «Crea tu IA en solo unos clics» (el asistente por nicho), su grilla
//     «Funciona con tu stack», su cita suelta ni su badge de Meta: no tienen contenido de MaKo.
//   · «Agenda dentro del chat» no se promete: lib/funciones-mako.ts dice que MaKo le RECUERDA la reunión al lead y lo
//     mueve de etapa. Tampoco el «riesgo de baneo» de sus preguntas: no se vende el ritmo de envío como protección.
//   · Su «controla SetSmart desde tu propia IA» (MCP) es, en MaKo, la API: crear_automatizacion_desde_plantilla y
//     crear_automatizacion_con_ia (lib/api-mako/areas/chatbot.def.ts).
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['setting']); los gráficos, de la landing anterior de este slug.
//
// LOS TEXTOS DE SETSMART, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · el titular «Tu AI setter convierte tus DM de Instagram en llamadas de venta calificadas», igual («AI setter» →
//     «setter con IA»): MaKo califica con el criterio de la estrategia (lib/setting-estrategia.ts → CriterioCalificacion,
//     evaluado en lib/nutricion.ts con evaluarCalificacion) y su AI Step tiene el objetivo «Que agende una llamada»;
//   · la bajada sin «Entrenado con 2,9M de conversaciones» (su número), sin «24/7» y con «los lleva a agendar» en lugar
//     de «agenda tus llamadas» (MaKo no reserva en el chat); «Tú solo cierras en la llamada. También en WhatsApp y
//     Messenger» (+ email);
//   · «Hecho para coaches…», «Se integra con», «La solución», «Gestionar tus DM con SetSmart» (→ MaKo) y «Responde
//     demasiado lento y tus leads se enfrían, y te dejan en visto para siempre»;
//   · «Todo lo que hace tu setter IA» / «Del primer comentario a la llamada reservada» (sin «100% automático»: hay
//     paso a una persona), con «Del comentario al DM, automático», «Califica a cada prospecto» y «Seguimientos
//     automáticos» con sus frases; «Suena 100% humana» → «Con tu tono y tu estilo» (sin «nunca parece una IA»);
//   · «Automatiza el agendamiento de citas con IA conversacional» y su bajada (script → criterio de calificación);
//   · «Operativo en menos de 10 minutos» → «en 3 pasos» (el tiempo no está medido), «Sin prompts complicados, sin código.
//     Simple, rápido, claro.», «Crea tu IA», «Conecta Instagram», «La IA agenda tus llamadas» (→ «lleva a agendar»);
//   · «Controla SetSmart desde tu propia IA.» (→ MaKo, por la API: crear_automatizacion_desde_plantilla,
//     crear_automatizacion_con_ia y duplicar_automatizacion, que PROPONEN y nacen pausadas), sin «el primer AI setter con
//     soporte MCP nativo»;
//   · sus preguntas «¿Qué es un setter con IA?», «¿Qué canales soporta…?», «¿Es difícil crear mi asistente de IA?»,
//     «¿Puedo mantener el control de las conversaciones?», «¿Funciona para ofertas high-ticket y llamadas de venta?».
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
  metaTitle: 'Automations de MaKo: tu setter con IA convierte tus DM de Instagram en llamadas de venta calificadas',
  metaDesc: 'Tu setter con IA responde tus DM de Instagram, califica a tus prospectos con tus propios criterios y los lleva a agendar su llamada de venta. Tú solo cierras en la llamada. También en WhatsApp, Messenger y email.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Hecho para',
      titulo: 'Tu setter con IA convierte tus DM de Instagram en <em>llamadas de venta calificadas</em>',
      bajada: 'Tu setter con IA responde tus DM de Instagram, <strong>califica a tus prospectos con tus propios criterios</strong> y los lleva a agendar su llamada de venta. Tú solo cierras en la llamada. También en WhatsApp, Messenger y email.',
      puntos: ['Arrancas de una plantilla o se la pides a MaKo en palabras', 'Nace pausada: la pruebas antes de prenderla'],
      visual: { tipo: 'detalle', slug: 'seguimiento' },
    },
    {
      tipo: 'logos',
      titulo: 'Se integra con',
      items: [
        { logo: 'whatsapp.png', nombre: 'WhatsApp' },
        { logo: 'meta.png', nombre: 'Instagram y Messenger' },
        { logo: 'gmail.png', nombre: 'Email' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
      ],
    },
    {
      // Como su «Gestionar tus DM tú solo / con SetSmart» (14/11/2026, noche): el título termina distinto según el interruptor
      // (sin.titulo / con.titulo), la bajada es una sola (sin.texto) y con.texto va debajo de los chats, con los íconos de los canales.
      tipo: 'contraste',
      etiqueta: 'La solución',
      titulo: 'Gestiona tus DM',
      sin: {
        titulo: 'tú solo',
        texto: 'Respondes demasiado lento y tus leads se enfrían, y te dejan en visto para siempre.',
      },
      con: {
        titulo: 'con MaKo',
        texto: 'Funciona en todos tus canales',
      },
      cta: true,
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      titulo: 'Todo lo que hace tu setter con IA',
      bajada: 'Del primer comentario a la llamada reservada.',
      items: [
        { icono: I.comentario, titulo: 'Del comentario al DM, automático', texto: 'Cuando alguien comenta tu publicación, tu Reel o tu En vivo, o responde a una historia, la IA responde y abre la conversación por DM automáticamente. Y puede mandar el mensaje con botones debajo.' },
        { icono: I.persona, titulo: 'Califica a cada prospecto', texto: 'Cada prospecto se califica con tus propios criterios —las señales de tu cliente ideal y las que lo descartan— antes de que una llamada llegue a tu agenda: si la charla lo descarta, MaKo lo marca «No calificado» en tu CRM y te avisa.' },
        { icono: I.reunion, titulo: 'Le recuerda la reunión', texto: 'Al que agendó le escribe antes de la llamada, para que llegue.' },
        { icono: I.ramas, titulo: 'Seguimientos automáticos', texto: 'Reactiva a los prospectos inactivos en el momento justo para no perder ninguna oportunidad: si contestó, si agendó, qué etiqueta tiene, cada lead sigue su camino, en el horario que pones.' },
        { icono: I.voz, titulo: 'Con tu tono y tu estilo', texto: 'Las secuencias las escribe MaKo en la voz de tu negocio, con tu tono y tu estilo, no en la de una plantilla genérica.' },
        { icono: I.crm, titulo: 'Te lo pasa cuando hace falta una persona', texto: 'Cuando la conversación necesita a alguien de tu equipo, la automatización se corre y la sigue una persona. Y lo que pasa en la conversación cambia la etapa del lead en tu CRM.' },
      ],
    },
    {
      tipo: 'filas',
      fondo: true,
      titulo: 'Automatiza el agendamiento de citas con IA conversacional',
      bajada: 'La IA sigue tu criterio de calificación y lleva a los prospectos calificados a agendar su llamada.',
      slug: 'seguimiento',
      items: [
        { grafico: 0, titulo: 'Arranca en el momento justo del lead', texto: 'Cada automatización tiene su disparador: una <strong>etapa de tu CRM</strong>, una etiqueta que se le agrega al lead o un evento. Así le escribe al que se trabó en ese paso, no a todos igual.' },
        { grafico: 1, titulo: 'Le escribe al que se quedó en el camino', texto: 'Al que dejó el formulario sin agendar o al que faltó a la llamada le llega el mensaje de su momento, por WhatsApp o por email.' },
        { grafico: 2, titulo: 'Si el lead contesta, se corta', texto: 'Con la condición «Contestó», la respuesta del lead corta la secuencia en el acto: <strong>no le sigue escribiendo a alguien que ya te respondió</strong>.' },
      ],
    },
    {
      tipo: 'pasos',
      titulo: 'Operativo en 3 pasos',
      bajada: 'Sin prompts complicados, sin código. Simple, rápido, claro.',
      pasos: [
        { titulo: 'Crea tu IA', texto: 'Arrancas de la galería de plantillas o le dices a MaKo en palabras qué quieres que haga. Tu automatización está lista sin prompt técnico, y nace pausada.' },
        { titulo: 'Conecta Instagram', texto: 'Conectas tu cuenta de Instagram (y WhatsApp, Messenger o tu email si quieres). Sin técnica, sin código.' },
        { titulo: 'La IA lleva a tus prospectos a agendar', texto: 'Responde tus DM, califica a tus prospectos y los lleva a agendar su llamada. Antes de prenderla, la pruebas como si fueras el lead. Tú solo cierras en la llamada.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Controla MaKo desde tu propia IA.',
      bajada: 'Con la API de MaKo, tu Claude ve tus plantillas, crea una automatización desde una plantilla o desde un pedido en palabras, la duplica y cambia su configuración, desde el chat.',
      columnas: 2,
      items: [
        { icono: I.setter, titulo: 'Crea la automatización de recordatorio de la reunión, desde la galería.', texto: 'Lista para confirmar: nace en pausa, con todas sus tarjetas.' },
        { icono: I.voz, titulo: 'Arma una automatización que le escriba al que agendó y no vino.', texto: 'Lista para confirmar: con su disparador, en pausa.' },
        { icono: I.ramas, titulo: 'Duplica la automatización de bienvenida.', texto: 'Lista para confirmar: «Copia de…», con los mismos pasos, en pausa.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿Qué es un setter con IA?', r: 'Un agente que contesta los mensajes de tus leads, los califica con tus criterios y los lleva a agendar la llamada de venta, para que tú solo cierres.' },
        { p: '¿Qué canales soporta MaKo?', r: 'WhatsApp, Instagram, Messenger y email. Ves todas las conversaciones juntas en Chats.' },
        { p: '¿Es difícil crear mi asistente de IA?', r: 'No. Arrancas de una plantilla de la galería o se la pides a MaKo en palabras. Después la ajustas: ramas, condiciones, horarios, etiquetas y acciones.' },
        { p: '¿Puedo mantener el control de las conversaciones?', r: 'Sí. La automatización nace pausada y puedes simular la conversación como si fueras el lead antes de activarla. Y cuando hace falta una persona, te pasa la conversación.' },
        { p: '¿Funciona para ofertas high ticket y llamadas de venta?', r: 'Sí: MaKo está hecho para vender High Ticket por llamada. Tu setter lleva al lead a agendar, le recuerda la reunión y lo mueve de etapa en tu CRM.' },
        { p: '¿Quién escribe los mensajes?', r: 'MaKo escribe las secuencias en la voz de tu negocio, y tú las editas cuando quieras.' },
      ],
    },
  ],
};

/** «Hecho para …»: lo que se escribe y se borra en la cejilla del hero, como su «coaches fitness / coaches de pérdida de peso…». */
export const NICHOS_SEGUIMIENTO = ['coaches', 'consultores', 'mentores', 'agencias', 'expertos'] as const;

/**
 * Los dos chats del interruptor «Sin MaKo / Con MaKo» (sus tarjetas de Julie Martin: «10h · Lead perdido» y «30s · Reservado»).
 * El lead es Tomás Ríos, el contacto inventado de la grabación del hero (banco C:/dev/bancos-portada/banco-flujo/): comenta «GUÍA»
 * en un Reel y el DM con la guía es el de esa toma (el link es el «Scaling Roadmap» de Alex Hormozi). Con MaKo sale la plantilla
 * «Te Escribieron por Instagram» (lib/plantillas-automatizaciones.ts: el DM y el aviso «… te escribió por Instagram» por WhatsApp);
 * no se dice en cuánto tiempo, porque no está medido. Sin MaKo, el negocio contesta a mano diez horas después.
 */
export type LineaChat =
  | { tipo: 'nota'; texto: string }
  | { tipo: 'lead' | 'negocio'; texto: string }
  | { tipo: 'pausa'; texto: string }
  | { tipo: 'visto'; texto: string }
  | { tipo: 'aviso'; titulo: string; texto: string };
export const CHATS_SEGUIMIENTO: { lead: { nombre: string; usuario: string }; sin: { lineas: LineaChat[]; pie: [string, string] }; con: { lineas: LineaChat[]; pie: [string, string] } } = {
  lead: { nombre: 'Tomás Ríos', usuario: '@tomas.rios' },
  sin: {
    lineas: [
      { tipo: 'nota', texto: 'Comentó tu Reel · 22:47' },
      { tipo: 'lead', texto: 'GUÍA' },
      { tipo: 'pausa', texto: '10h después' },
      { tipo: 'negocio', texto: '¡Hola! Perdón por la demora. Aquí tienes la guía.' },
      { tipo: 'pausa', texto: '2 días después' },
      { tipo: 'negocio', texto: '¿Pudiste verla? Si quieres, lo hablamos.' },
      { tipo: 'visto', texto: 'Sin respuesta' },
    ],
    pie: ['10h', 'Lead perdido'],
  },
  con: {
    lineas: [
      { tipo: 'nota', texto: 'Comentó tu Reel · 22:47' },
      { tipo: 'lead', texto: 'GUÍA' },
      { tipo: 'negocio', texto: '¡Hola Tomás! 👋 Vi que comentaste GUÍA. Aquí tienes la guía 👇 acquisition.com/roadmap' },
      { tipo: 'lead', texto: '¡Gracias! 🙌' },
      { tipo: 'aviso', titulo: 'MaKo te avisa por WhatsApp', texto: 'Tomás Ríos te escribió por Instagram' },
    ],
    pie: ['Automático', 'Respondido'],
  },
};
