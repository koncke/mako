// =============================================================================
// /vsl/crm — el CRM de MaKo, con la ESTRUCTURA de la portada de GoHighLevel (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA, el orden, el storytelling y el DISEÑO (./disenos/crm.tsx, con los valores medidos en
// docs/diseno/landings-competencia/crm.md):
//   https://www.gohighlevel.com/  (leída el 11/11/2026 con Chromium)
// Su orden, que se respeta acá: hero → contadores → «Your all-in-one solution for business growth», el ciclo del cliente
// en cinco partes (Capture, Nurture, Close, Evangelize, Reactivate) → tres principios (all-in-one, la IA como base, la
// comunidad) → «What's included» → (precios) → testimonios y cierre. Por qué ganó: docs/competencia/landings-por-funcion.md
// → «CRM».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus contadores son de toda su plataforma. Los de MaKo salen de la landing anterior de esta ruta: los 1.400
//     movimientos en nueve días del CRM de Mauricio, medidos y ya publicados.
//   · Su ciclo tiene «Evangelize» (reseñas); el de MaKo, en ese lugar, cobra: el plan de cuotas con su contrato.
//   · Su principio «comunidad» es su red de agencias; el de MaKo es el aviso por WhatsApp, que es lo que vive el dueño.
//   · Sus precios no van (ninguna landing de /vsl escribe un precio a mano) y la prueba es el caso de Mauricio.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['crm']) y de la landing anterior; el mini-VSL de Panda sigue en el hero.
//
// LOS TEXTOS DE GOHIGHLEVEL, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»),
// traducidos a español neutro de tú (las pestañas se leyeron haciendo clic en cada una):
//   · «Power up your business with AI» → «Potencia tu negocio con IA»; «The AI-powered business operating system» →
//     «El sistema operativo de tu negocio, con IA» (MaKo es eso: CRM, chats, agenda, anuncios y automatizaciones);
//   · «All the tools you need to capture, nurture and close new leads into bookings, sales, reviews and repeat
//     customers!» → «…en reuniones, ventas y cuotas cobradas» (las reseñas y la recompra no son de MaKo);
//   · «We're in the business of helping you grow your business», «Your all-in-one solution for business growth» / «All
//     the tools you need in one AI-powered platform»;
//   · sus pestañas Capture / Nurture / Close / Reactivate con su titular y su bajada: «Get more leads in the door» /
//     «Attract the right people, turn interest into leads and keep your pipeline full», «Build relationships that
//     convert» / «The tools you need to follow up, stay relevant and build trust», «Close deals with less back-and-forth»
//     / «Remove friction and turn conversations into paying customers», «Get back on their radar» / «Re-engage past
//     leads…» (sin «that drive repeat sales»: no está medido; lo de MaKo es la difusión a una columna, lib/difusion.ts).
//     «Evangelize» (reseñas, referidos) no es de MaKo: en su lugar, «Cobrar»;
//   · «We exist to remove friction from growth and give business owners the systems they need to operate, scale and win»
//     y sus principios «All-in-one» / «AI as the foundation» con su línea; «Community-driven» (su red de agencias) no es
//     de MaKo y queda el aviso por WhatsApp; «What's included with HighLevel» → «Lo que incluye MaKo».
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  crm: ['M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z', 'M10 16h6', 'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 8h3', 'M4 12h3', 'M4 16h3'],
  entra: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-4', 'M10 17l5 -5l-5 -5', 'M15 12h-12'],
  sigue: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5'],
  cierra: ['M4 14v-3a8 8 0 1 1 16 0v3', 'M18 19a2 2 0 0 1 -2 2h-3a1 1 0 0 1 -1 -1', 'M20 15a2 2 0 0 0 -2 -2h-1a1 1 0 0 0 -1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 0 2 -2z', 'M4 15a2 2 0 0 1 2 -2h1a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-1a2 2 0 0 1 -2 -2z'],
  cobra: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1', 'M12 6v2', 'M12 16v2'],
  ordena: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  todo: ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  wa: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  tablero: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v6h-4z'],
  ficha: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  producto: ['M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z'],
  papelera: ['M4 7l16 0', 'M10 11l0 6', 'M14 11l0 6', 'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12', 'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3'],
};

export const LANDING_CRM: LandingCompetencia = {
  slug: 'crm',
  nombre: 'CRM',
  icono: I.crm,
  referencia: { nombre: 'GoHighLevel — portada', url: 'https://www.gohighlevel.com/', leida: '2026-11-11' },
  metaTitle: 'MaKo: el sistema operativo de tu negocio High Ticket, con IA',
  metaDesc: 'Todas las herramientas que necesitas para captar, nutrir y cerrar leads nuevos y convertirlos en reuniones, ventas y cuotas cobradas, con tu CRM en el centro.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Potencia tu negocio con IA',
      titulo: 'El sistema operativo de tu negocio, con IA',
      bajada: 'Todas las herramientas que necesitas para captar, nutrir y cerrar leads nuevos y convertirlos en reuniones, ventas y cuotas cobradas, <strong>con tu CRM en el centro</strong>.',
      visual: { tipo: 'detalle', slug: 'crm' },
    },
    {
      tipo: 'cifras',
      titulo: 'Estamos en el negocio de ayudarte a hacer crecer tu negocio',
      items: [
        { valor: '1.400+', label: 'movimientos de MaKo en el CRM de Mauricio' },
        { valor: '9 de 10', label: 'de los movimientos de ese CRM, en nueve días' },
        { valor: '0', label: 'tarjetas arrastradas a mano' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Tu solución todo en uno para hacer crecer tu negocio',
      bajada: 'Todas las herramientas que necesitas, en una plataforma con IA.',
      items: [
        { icono: I.entra, meta: 'Captar', titulo: 'Haz que entren más leads', texto: 'Atrae a la gente correcta, convierte el interés en leads y mantén tu pipeline lleno. Cada lead que entra por tu anuncio, tu landing o tu WhatsApp <strong>llega con su ficha creada</strong>, en la etapa que elegiste.' },
        { icono: I.sigue, meta: 'Nutrir', titulo: 'Construye relaciones que convierten', texto: 'Las herramientas que necesitas para dar seguimiento, seguir presente y generar confianza. La nutrición de cada etapa le escribe sola, en la voz de tu negocio, y le recuerda la reunión.' },
        { icono: I.cierra, meta: 'Cerrar', titulo: 'Cierra tratos con menos ida y vuelta', texto: 'Quita la fricción y convierte conversaciones en clientes que pagan. Agenda y se mueve a la etapa que toca; termina la reunión y MaKo engancha la grabación, y si no se presentó, también lo sabe.' },
        { icono: I.cobra, meta: 'Cobrar', titulo: 'Cobra cada cuota desde su ficha', texto: 'El plan de pagos por cuotas vive en la ficha, con el contrato y los comprobantes leídos por IA.' },
        { icono: I.ordena, meta: 'Reactivar', titulo: 'Vuelve a estar en su radar', texto: 'Reactiva leads pasados con un mensaje a tiempo: eliges una columna entera o los leads que quieras y les mandas una <strong>difusión por WhatsApp, email o Instagram</strong>.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Existimos para quitarle la fricción al crecimiento y darles a los dueños de negocio los sistemas que necesitan para operar, escalar y ganar',
      items: [
        { icono: I.todo, titulo: 'Todo en uno', texto: 'Una plataforma de verdad todo en uno, hecha para quienes operan el negocio: las conversaciones del lead, sus reuniones y sus automatizaciones, junto a tu CRM.' },
        { icono: I.ia, titulo: 'La IA como base', texto: 'IA integrada a fondo en todo el ciclo del negocio: en cada ficha, <strong>MaKo Analyst</strong> cruza la ficha, las llamadas y el comportamiento del lead, y te da el diagnóstico.' },
        { icono: I.wa, titulo: 'Te avisa por WhatsApp', texto: 'Entró un lead, agendó, vino o no se presentó: te llega en tu WhatsApp, no en una pestaña más.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Lo que incluye MaKo',
      items: [
        { icono: I.tablero, titulo: 'Kanban y tabla', texto: 'Tus leads por etapa, o en una tabla para filtrar y ordenar.' },
        { icono: I.ficha, titulo: 'La ficha del lead', texto: 'Su historia, sus llamadas y su plan de pagos, en una sola ficha.' },
        { icono: I.producto, titulo: 'Productos y ofertas', texto: 'Cada producto con su precio, para saber qué compró cada uno.' },
        { icono: I.cobra, titulo: 'Cobranza por cuotas', texto: 'El plan de cuotas, con el contrato y los comprobantes leídos por IA.' },
        { icono: I.ordena, titulo: 'Acciones en bloque', texto: 'Mover de etapa, descalificar con motivo, pasar a otro funnel, etiquetar, asignar y eliminar.' },
        { icono: I.papelera, titulo: 'La papelera', texto: 'Lo que eliminas se recupera tal cual durante 30 días.' },
      ],
    },
    { tipo: 'caso' },
  ],
};
