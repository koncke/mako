// =============================================================================
// /vsl/agenda — la Agenda de MaKo (tu Calendly o Cal.com conectado al CRM, y Calendar), con la ESTRUCTURA de iClosed
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO):
//   https://www.iclosed.io/  (leída el 11/11/2026 con Chromium, y otra vez el 14/11/2026: el hero ahora es una demo)
// El diseño copiado (barra, hero, secciones, tipografía, espacios, pie) es ./disenos/agenda.tsx; los valores medidos
// con getComputedStyle a 1440 y 390 px, en docs/diseno/landings-competencia/agenda.md.
// Su orden, que se respeta acá: hero «Triple your leads using high-converting scheduler» → tres citas cortas → «Keep the
// same funnels. Change the scheduler, make more profit.» (Qualify & Route, Engage, Measure, AI Agent) → «You already
// follow them» → «The money's already in your funnel. Plug in. Take it back.» y sus tres pasos → «Everything your booking
// page should've done all along» → «Your whole team, closing in one inbox» → «Coaches, agencies, creators» → «Drops into
// the stack you already have» → «Proof, in their own words» → «The lift, measured in cold dollars» → «Book a 5-min demo»
// → el cierre. Por qué ganó: docs/competencia/landings-por-funcion.md → «Agenda».
//
// 14/11/2026, la copia FIEL: el orden y los bloques siguen su página de ese día. Las pestañas de «Keep the same funnels» son tres
// (cada una con su lista que se marca: `puntos`, «título|texto»), «Everything your booking page…» tiene cinco tarjetas en SU orden
// (la tercera, la de los flujos para quien no vino; la quinta, el tablero), y «Your whole team» es su ventana grande, sin tarjetas
// (`items: []`): lo que dice va en la bajada. «Drops into the stack…» son las cuatro integraciones que tocan la agenda: Calendly y
// Cal.com (los webhooks), Meta (el «Schedule» que manda el webhook de Calendly: lib/meta-schedule-pagina.ts) y los grabadores de
// reuniones (lib/grabadores: Fathom, Zoom, tl;dv, Fireflies y Otter). Las pantallas de cada pieza viven en ./disenos/agenda.tsx.
//
// Lo que se cambió de la referencia, y por qué:
//   · iClosed CALIFICA antes de mostrar horarios, descarta a los que no compran y rutea al mejor closer. MaKo no: no
//     reemplaza tu agenda, la conecta. Esas piezas no van, ni su «triple your leads», ni su «close 34% more», ni su «AI
//     Agent». Lo que sí: cada reserva cae en la etapa del funnel vinculada a su evento (lib/agenda-evento-etapa.ts).
//   · Sus «Keep the same funnels» se dice al revés y es lo mismo: tu misma agenda, ahora conectada a tu embudo.
//   · Sus citas, sus creadores, sus casos en dólares y su «Join 20,000 high ticket funnels» no van: la prueba es el caso de
//     Mauricio, en el lugar de «Proof, in their own words».
//   · Su bandeja compartida (iMessage, WhatsApp, SMS) es Chats en MaKo, otra función: «Your whole team» queda como las
//     llamadas de todo el equipo en Calendar (lib/calendario-llamadas.ts).
//   · Sus públicos (coaches, agencias, creadores) no van: la agenda de MaKo hace lo mismo para todos.
//   · Sus integraciones no van como fila de logos: en /vsl-assets/logos hay Calendly y no Cal.com, y una fila sin Cal.com
//     diría que sólo conecta Calendly. Lo dicen el hero y los pasos. Su «Book a demo» y su cierre son la banda de la
//     llamada de todas las landings. No tiene preguntas frecuentes, y esta landing tampoco.
//   · Los recordatorios, el aviso de cada reserva y el mensaje a quien faltó salen por Automations, con las plantillas
//     «Un Lead Agendó Llamada» y «Un Lead No Asistió» (lib/plantillas-automatizaciones.ts): se nombran como tales.
//   · Agenda no tenía landing en /vsl: el visual de la portada es propio (./visuales-propios/agenda.tsx), y no lleva filas.
//   · Con Calendly, la reserva NUEVA entra sólo si la cuenta tiene el aviso (una suscripción de webhook a MaKo), que Calendly
//     no deja crear desde su pantalla: va por su API, en planes pagos (lib/calendly-aviso-reglas.ts). El paso 1 lo dice. Cal.com
//     lo crea el cliente en su pantalla, con la contraseña que pega en MaKo (lib/metodo-catalogo.ts, CALCOM_WEBHOOK_SECRET).
//
// De dónde sale lo que se afirma: lib/funciones-mako.ts (keys: ['calendario']), app/api/webhooks/calendly y
// app/api/webhooks/calcom (el lead, lo que contestó, el link de la reunión, la R2 que no crea un lead, la cancelación),
// lib/agenda-evento-etapa.ts y app/crm/EventosDeEtapaModal.tsx («Vincular evento»), lib/reagenda-no-show.ts,
// lib/calendario-llamadas.ts (la lista, sus estados y el filtro por persona), lib/cuentas-integracion.ts (varias cuentas).
//
// LOS TEXTOS DE ICLOSED, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «Triple your leads using high-converting Scheduler» → «Ordena tus leads usando tu misma agenda» (el «triplica» y el
//     «que convierte» no están medidos; MaKo no reemplaza tu agenda, la conecta);
//   · «…the conversion-first scheduler that recovers drop-offs and follows up in the right channel» → con Automations
//     recuperas a los que no terminaron de agendar y les das seguimiento por el canal correcto (la plantilla de quien dejó
//     el formulario sin agendar); sin «to maximize profit»;
//   · «Keep the same funnels. Change the scheduler, make more profit.» → «Mantén los mismos funnels y tu misma agenda»
//     (tu agenda no cambia, y la ganancia no está medida); «The money's already in your funnel. Plug in. Take it back.» →
//     «Las reservas ya están en tu funnel. Conéctalas…», con «One embed on the funnel you already run» y «No rebuild»;
//   · «Everything your booking page should've done all along.» (→ «Todo lo que tu agenda debió hacer desde el principio», en dos
//     renglones como el suyo), «The most accurate scheduling tracker» / «Every contact,
//     activity and outcome synced in one place and pushed straight to your CRM» (→ «Todo, directo a tu CRM», sin «el más
//     preciso»), «SMS & email workflows, reduce no-shows» (→ «Flujos de WhatsApp y email para quien no vino»: MaKo no manda SMS y las inasistencias evitadas no están medidas);
//   · «Your whole team, closing in one inbox.» → «Todo tu equipo, con sus llamadas en un solo lugar» (la bandeja de
//     mensajes es Chats, otra función).
// =============================================================================

import { NOMBRE_PROVEEDOR, PROVEEDORES_AGENDA } from '@/lib/agenda-evento-etapa';
import { plantillaPorId } from '@/lib/plantillas-automatizaciones';
import type { LandingCompetencia } from './tipos';

const I = {
  agenda: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16', 'M8 15h2v2h-2z'],
  etapa: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  campana: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
  check: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  ficha: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  link: ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'],
  dos: ['M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1z', 'M10 9h4', 'M10 13h4'],
  otra: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  falta: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 8v4', 'M12 16h.01'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  equipo: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
};

/** «Calendly o Cal.com»: los proveedores de agenda que MaKo conecta, del código. */
const AGENDAS = PROVEEDORES_AGENDA.map((p) => NOMBRE_PROVEEDOR[p]).join(' o ');

/** Las plantillas de Automations que siguen a quien agenda y a quien falta, con su nombre tal cual. */
const AGENDO = plantillaPorId('lead-agendo')?.nombre ?? 'Un Lead Agendó Llamada';
const NO_ASISTIO = plantillaPorId('lead-no-asistio')?.nombre ?? 'Un Lead No Asistió';

export const LANDING_AGENDA: LandingCompetencia = {
  slug: 'agenda',
  nombre: 'Agenda',
  icono: I.agenda,
  referencia: { nombre: 'iClosed — la agenda para equipos de venta high ticket', url: 'https://www.iclosed.io/', leida: '2026-11-14' },
  metaTitle: `Agenda de MaKo: ordena tus leads usando tu misma agenda de ${AGENDAS}`,
  metaDesc: `Conectas tu ${AGENDAS} y quien reserva entra a tu CRM con lo que contestó, en la etapa del funnel que elegiste. Tu equipo ve todas sus llamadas en Calendar.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: `Tu ${AGENDAS}, conectado a tu CRM`,
      titulo: 'Ordena tus leads <em>usando tu misma agenda</em>',
      bajada: `MaKo conecta tu <strong>${AGENDAS}</strong> a tu CRM: quien reserva entra con lo que contestó, en la etapa del funnel que elegiste, y con Automations recuperas a los que no terminaron de agendar y les das seguimiento por el canal correcto.`,
      visual: { tipo: 'propio', slug: 'agenda' },
    },
    {
      // Las tres pestañas de «Keep the same funnels» (cada una con su grabación en ./disenos/agenda.tsx) y su lista que se va marcando.
      tipo: 'tarjetas',
      titulo: 'Mantén los mismos funnels y tu misma agenda. <em>Ahora, conectada a tu CRM.</em>',
      items: [
        {
          icono: I.etapa, titulo: 'Cada reserva, en su etapa',
          texto: 'Vinculas cada evento de tu agenda a una etapa de reunión, y quien lo reserva cae ahí, en ese funnel.',
          puntos: [
            'Vinculas el evento|Desde el «⋯» de la etapa, eliges el evento de tu agenda.',
            'Cae en esa etapa|Quien lo reserva entra a ese funnel, en esa etapa.',
            'Si ya era tu lead|MaKo lo suma a ese funnel sin cambiarle el que ya tenía.',
          ],
        },
        {
          icono: I.campana, titulo: 'El seguimiento, con Automations',
          texto: `La plantilla «${AGENDO}» le escribe por WhatsApp a quien agenda, le recuerda la reunión y te avisa en tu grupo.`,
          puntos: [
            'Confirma la reunión|Le escribe por WhatsApp apenas agenda.',
            'Se la recuerda|Un día antes, una hora antes y 15 minutos antes, con el link para entrar.',
            'Te avisa|En tu grupo de WhatsApp, cuando alguien agenda y si no confirmó.',
          ],
        },
        {
          icono: I.check, titulo: 'Quién vino y quién no',
          texto: 'En Calendar, las llamadas de venta de todo tu equipo, y la asistencia se marca en la misma fila.',
          puntos: [
            'Las de todo el equipo|Próximas, pasadas y canceladas, con su closer y su setter.',
            'Filtras por persona|Cada closer o setter arranca en las suyas.',
            'Marcas si asistió|Y queda en su ficha del CRM.',
          ],
        },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      etiqueta: 'Para vender high ticket',
      titulo: 'Las reservas ya están en tu funnel. <em>Conéctalas y caen en su lugar.</em>',
      bajada: 'Una conexión sobre el funnel que ya tienes, sin rehacer nada ni cambiar tu página de reservas.',
      pasos: [
        { titulo: 'Conecta tu agenda', texto: `Conectas tu ${AGENDAS} en Integraciones. Con Calendly, el aviso de cada reserva pide uno de sus planes pagos.` },
        { titulo: 'Vincula cada evento a su etapa', texto: 'Desde el menú de una etapa de reunión de tu CRM eliges qué evento cae ahí, o lo creas ahí mismo.' },
        { titulo: 'Cada reserva entra sola', texto: 'Quien reserva entra a tu CRM en esa etapa, con <strong>lo que contestó al agendar</strong> y el link de la llamada.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Lo que hace',
      titulo: 'Todo lo que tu agenda <em>debió hacer desde el principio</em>',
      cta: true,
      items: [
        { icono: I.dos, titulo: 'La primera llamada y la de cierre', texto: 'Cada evento sabe si es tu R1 o tu R2: la segunda se suma al lead que ya tienes y nunca crea uno nuevo.' },
        { icono: I.link, titulo: 'El link de la reunión, guardado', texto: 'La tarjeta de la reunión trae lo que contestó al agendar y, minutos antes, «Entrar a la reunión» con su link.' },
        { icono: I.falta, titulo: 'Flujos de WhatsApp y email para quien no vino', texto: `La plantilla «${NO_ASISTIO}» le escribe a quien faltó para buscar otro horario y te avisa en tu grupo.` },
        { icono: I.otra, titulo: 'Cancela o vuelve a agendar', texto: 'Si cancela, la reunión queda cancelada en su ficha y en Calendar. Si vuelve a agendar después de faltar, se limpia su «no asistió».' },
        { icono: I.ficha, titulo: 'Todo, directo a tu CRM', texto: 'Cada contacto, su reunión y cómo terminó, en un solo lugar: llegas a la llamada sabiendo con quién hablas.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Todo tu equipo, <em>con sus llamadas en un solo lugar</em>',
      bajada: 'En Calendar, las llamadas de venta de todo tu equipo: cada closer o setter arranca en las suyas, tú filtras por persona y marcas quién vino.',
      items: [],
    },
    {
      // «Drops into the stack you already have»: la marquesina de logos y cuatro destacadas (las que tocan la agenda, con lo que hacen).
      tipo: 'tarjetas',
      etiqueta: 'Integraciones',
      titulo: 'Se conecta con <em>lo que ya usas</em>',
      bajada: 'Tu agenda, tus anuncios, tu WhatsApp y tu grabador de reuniones, conectados a tu CRM.',
      cta: true,
      items: [
        { titulo: 'Calendly', texto: 'Cada reserva entra a tu CRM, en la etapa de su evento.' },
        { titulo: 'Cal.com', texto: 'Lo mismo con Cal.com: el lead, lo que contestó y el link de la llamada.' },
        { titulo: 'Meta', texto: 'Cada reserva le llega a Meta como «Schedule».' },
        { titulo: 'Fathom', texto: 'La grabación de la llamada queda en la ficha del lead.' },
      ],
    },
    { tipo: 'caso' },
  ],
};
