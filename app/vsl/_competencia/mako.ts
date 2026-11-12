// =============================================================================
// /vsl/mako — el Ops Center (MaKo, el chat que conoce tu negocio), con la ESTRUCTURA de la portada de Holo (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, el DISEÑO):
//   https://tryholo.ai/  (leída el 11/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/mako.tsx y los valores medidos de Holo, en docs/diseno/landings-competencia/mako.md.
// Su orden, que se respeta acá: hero «Your Marketing Department. One Hire.» / «You just tap approve.» → (contadores de uso
// e inversores) → «Ads that sell. Socials that grow. SEO that ranks. Emails that convert.» → «How it works? It's as easy as
// 1, 2, 3…» (y lo que ahorras) → «Proactive. No prompt needed.» → «Real customer results» → para quién («Any niche… Any
// integration») → «Early signals, first tweaks» / «Doubling down on what works» (semana a semana) → «Inside your new
// marketing department» → (testimonios) → (premios) y privacidad → (inversores) → «Skeptical? Good. Read this.» → cierre
// «Approve your first week…» (la banda de la llamada). Por qué ganó: docs/competencia/landings-por-funcion.md → «Ops Center
// / Second Brain». Al copiar el diseño (11/11/2026) se midió que su sección semana a semana va ANTES de «Inside…»: el bloque
// «Cuanto más lo usas» se pasó adelante. Los títulos llevan su segunda mitad en <em>, que el diseño pinta en gris como Holo.
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus contadores, su «4.6/5», sus premios, sus inversores y lo que ahorras contra una agencia (87 %, 11x, 23 h, 51 %) son
//     de uso o de antes y después: MaKo no tiene un número propio que mostrar ahí, así que no van. Sus testimonios tampoco:
//     la prueba es el caso de Mauricio, en el lugar de «Real customer results».
//   · Holo publica solo («on autopilot») y mueve el presupuesto por su cuenta. MaKo NO: propone, y lo que cambia algo deja una
//     tarjeta que confirma la persona. Su ángulo «tú solo apruebas» es el del chat, sin el piloto automático.
//   · Sus ejemplos de «Proactive» son las señales que MaKo mide hoy (lib/recomendaciones-senales.ts, las que salen en el
//     Ops Center), con sus umbrales leídos del código. Su «Every month beats the last» es lo que MaKo aprende de verdad:
//     lo que se habla, lo que se descarta y la medición a los `DIAS_HECHA` días (lib/recomendaciones-reglas.ts).
//   · Su «Support 24/7» es, en MaKo, el ticket que abre solo un «no pude» (lib/no-pude.ts) y que avisa al cerrarse
//     (lib/tickets-cierre.ts). Su «Can I cancel?» no va: es del plan, y ninguna landing de /vsl habla de cobro.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['mako', 'second-brain']); la tarjeta y su «No ejecutar la acción», de
// app/_chat/TarjetaAccion.tsx y app/m/mako/chat-ui.ts; la estrella en cada tab, de app/_chat/EstrellaDeLaApp.tsx; lo que
// ve un closer o un setter, de `sinLaPlata` (lib/cerebro-union.ts); el ZIP, de app/api/second-brain/exportar; «tu propia
// IA», de lib/aperturas/ops.ts. Lo que no hace (`noHace`): la guía señalando fuera del Ops Center no se promete.
// =============================================================================

import { UMBRALES } from '@/lib/recomendaciones-senales';
import { DIAS_AHORA_NO, DIAS_HECHA } from '@/lib/recomendaciones-reglas';
import type { LandingCompetencia } from './tipos';

const I = {
  mako: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  agenda: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16'],
  duda: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 8v4', 'M12 16h.01'],
  rayo: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  pagina: ['M4 5a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z', 'M4 8h16', 'M8 4v4'],
  mapa: ['M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.7 10.7l6.6 -3.4', 'M8.7 13.3l6.6 3.4'],
  equipo: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
  telefono: ['M7 6a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
  conversaciones: ['M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10', 'M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'],
  aprende: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  documento: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 13l6 0', 'M9 17l6 0'],
  marca: ['M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25', 'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  coach: ['M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  candado: ['M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z', 'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0', 'M8 11v-4a4 4 0 1 1 8 0v4'],
  descarga: ['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 11l5 5l5 -5', 'M12 4l0 12'],
};

// Los umbrales de las sugerencias, del código: lo que la landing dice es lo que MaKo mide.
const HORAS_PRIMERA = UMBRALES.respuestaLenta.horas === 1 ? 'una hora' : `${UMBRALES.respuestaLenta.horas} horas`;
const HORAS_ESPERANDO = UMBRALES.esperando.horas;
const PCT_NO_SHOW = Math.round(UMBRALES.noShow.tasa * 100);

export const LANDING_MAKO: LandingCompetencia = {
  slug: 'mako',
  nombre: 'Ops Center',
  icono: I.mako,
  referencia: { nombre: 'Holo — portada', url: 'https://tryholo.ai/', leida: '2026-11-11' },
  metaTitle: 'Ops Center de MaKo: el chat que conoce tu negocio y te propone qué hacer',
  metaDesc: 'MaKo lee tu CRM, tus chats y tus llamadas, te contesta con tus números y te deja lo que hay que hacer en una tarjeta que confirmas. Con tu Second Brain, el mapa de tu negocio.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'MaKo, el chat que conoce tu negocio',
      titulo: 'Tu negocio,<br>en un chat.<br><em>Tú apruebas.</em>',
      bajada: 'MaKo lee tu CRM, tus chats y tus llamadas, te contesta con tus números y te deja lo que hay que hacer en una tarjeta. <strong>Nada se ejecuta sin tu sí.</strong>',
      puntos: ['<strong>En un solo lugar</strong> Lo que hablas con MaKo en cada tab', '<strong>Con tu propia IA</strong> Tu Claude o tu ChatGPT'],
      visual: { tipo: 'detalle', slug: 'mako' },
    },
    {
      tipo: 'filas',
      titulo: 'Te contesta. Te propone. Está en cada tab.',
      slug: 'mako',
      items: [
        { grafico: 0, titulo: 'Te contesta con tus números', texto: 'Le preguntas lo que sea de tu negocio y te contesta con lo que hay en tu CRM, tus chats y tus llamadas, <strong>no con un consejo de manual</strong>.' },
        {
          grafico: 3,
          titulo: 'Te propone, y tú apruebas',
          texto: 'Mover un lead de etapa, agendar una reunión, armar una automatización: te llega en una tarjeta que dice qué va a cambiar, <strong>antes del botón</strong>.',
          puntos: ['Una automatización que arma MaKo nace pausada', 'Las tareas para tu Plan las revisas en una pantalla antes de que entren'],
        },
        { grafico: 4, titulo: 'El mismo MaKo en cada tab', texto: 'La estrella de MaKo está en todas tus pantallas, también en tu CRM. Le escribes desde ahí y la conversación queda en tu Ops Center.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: '¿Cómo funciona?<br><em>Así de fácil: 1, 2, 3.</em>',
      bajada: 'Sin llenar formularios ni aprender otra herramienta: le hablas y apruebas.',
      pasos: [
        { titulo: 'Le cuentas tu negocio', texto: 'En una conversación: qué vendes, cómo cobras y cómo te llegan los clientes. Con eso MaKo arma tu Second Brain.' },
        { titulo: 'Le preguntas, o te sugiere', texto: 'Le escribes desde el Ops Center o desde la estrella de cualquier tab. Y cuando un dato de tu negocio lo amerita, te sugiere qué hacer.' },
        { titulo: 'Apruebas con un toque', texto: 'Cada tarjeta dice qué va a cambiar. La confirmas o la descartas, desde la computadora o desde el teléfono.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Te sugiere. <em>Sin que se lo pidas.</em>',
      bajada: 'Sólo cuando un dato de tu negocio lo sostiene, con el número a la vista. <strong>Si no hay nada que decir, MaKo no dice nada.</strong>',
      items: [
        { icono: I.reloj, titulo: 'Contesta antes', texto: `Si quienes te escriben por primera vez esperan más de ${HORAS_PRIMERA} tu respuesta, te propone una bienvenida que conteste al instante.`, meta: 'De tus chats de WhatsApp' },
        { icono: I.chat, titulo: 'Que nadie quede esperando', texto: `Si hay personas que te escribieron y siguen sin respuesta hace más de ${HORAS_ESPERANDO} horas, te lo dice, empezando por quien más espera.`, meta: 'De tus chats de WhatsApp' },
        { icono: I.agenda, titulo: 'Menos llamadas vacías', texto: `Si más del ${PCT_NO_SHOW} % de tus llamadas no se presenta, te propone confirmarlas por WhatsApp el día anterior y una hora antes.`, meta: 'De la asistencia de tu CRM' },
        { icono: I.duda, titulo: 'La objeción que más te cuesta', texto: 'Si un motivo de pérdida se repite, te propone contestarlo en tu oferta y en tu guion, antes de que te lo digan.', meta: 'De tus ventas perdidas' },
        { icono: I.rayo, titulo: 'Una automatización que falla', texto: 'Si una automatización falla al mandar, o casi nadie le contesta, te lleva a abrirla para arreglarla.', meta: 'De tus automatizaciones' },
        { icono: I.pagina, titulo: 'Una página que no convierte', texto: 'Si mucha gente entra a tu página y casi nadie deja sus datos, te propone poner el formulario arriba de todo.', meta: 'De tu Pixel de MaKo y tu CRM' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Hecho para tu negocio, no para uno de ejemplo',
      items: [
        { icono: I.mapa, titulo: 'Tu oferta, <em>tus clientes y tu funnel.</em>', texto: 'Tu Second Brain conecta lo que le contaste y lo que MaKo dedujo. De ahí saca lo que necesita para contestarte.' },
        { icono: I.equipo, titulo: 'Para ti <em>y para tu equipo.</em>', texto: 'Tu closer y tu setter también le escriben a MaKo desde su propia cuenta.' },
        { icono: I.telefono, titulo: 'En la computadora <em>y en el teléfono.</em>', texto: 'Le escribes desde donde estés y confirmas sus tarjetas desde el teléfono.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: 'Cuanto más lo usas, mejor te conoce',
      bajada: 'Lo que hablas, lo que aceptas y lo que descartas le enseña qué sirve en tu negocio.',
      pasos: [
        { titulo: 'Cada conversación suma', texto: 'Lo que le cuentas en cada tab queda en tu Ops Center, y lo que sumas a tu Second Brain lo usa para contestarte.' },
        { titulo: 'Aprende de lo que descartas', texto: 'Si a dos sugerencias del mismo tipo les dices «No aplica» y no aceptaste ninguna, deja de proponerlas.' },
        { titulo: `A los ${DIAS_HECHA} días, mide`, texto: 'De una sugerencia que aceptaste, vuelve a mirar el dato. <strong>Si sigue igual, te lo dice.</strong>' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Adentro de tu Ops Center',
      items: [
        { icono: I.conversaciones, titulo: 'Tus conversaciones, juntas', texto: 'Lo que hablas con MaKo en cada tab queda aquí, en una sola lista.' },
        { icono: I.mapa, titulo: 'El Second Brain', texto: 'El mapa de tu negocio: tu oferta, tus clientes, tu funnel y tu mensaje. Si un dato de tu oferta está mal, lo tocas y lo corriges.' },
        { icono: I.aprende, titulo: '«Aprende solo»', texto: 'Si lo prendes, MaKo aprende de tus conversaciones de WhatsApp con leads: sus objeciones y sus pedidos. Ves de qué aprendió y cuándo.' },
        { icono: I.documento, titulo: 'Sumar un documento', texto: 'Lo pegas o lo adjuntas en el chat: queda en El Archivero y te muestra lo que va a tu perfil antes de que digas que sí.' },
        { icono: I.marca, titulo: 'Tu marca', texto: 'Subes tu manual de marca y MaKo saca tus colores, tus fuentes y tu logo. Los usan Image, Video y Web Generator.' },
        { icono: I.coach, titulo: 'Funnel Coach', texto: 'Un chat que trabaja tu oferta contigo y después arma cómo conseguir clientes, con el presupuesto de anuncios calculado.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Tus datos y tus decisiones, tuyos',
      items: [
        { icono: I.mako, titulo: 'Con tu propia IA', texto: 'Para escribir por ti, MaKo usa tu Claude o tu ChatGPT, conectado a tu cuenta.' },
        { icono: I.candado, titulo: 'Cada uno ve lo suyo', texto: 'El mapa del negocio es del admin. En el chat, tu closer y tu setter no ven tus objetivos ni tus números del negocio.' },
        { icono: I.descarga, titulo: 'Te lo llevas cuando quieras', texto: 'Bajas tu Second Brain en un ZIP de archivos que se abren con cualquier editor de texto, y con Obsidian.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: '¿Dudas?<br>Bien. Lee esto.',
      items: [
        { p: '¿No es ChatGPT con otro nombre?', r: 'No. ChatGPT no sabe nada de tu negocio: MaKo lee tu CRM, tus chats y tus llamadas para contestarte, y lo que cambia algo te lo deja en una tarjeta. Para escribir sí usa tu IA: tu Claude o tu ChatGPT.' },
        { p: '¿Qué tengo que hacer yo?', r: 'Preguntarle, y decir sí o no a lo que te propone. Cada tarjeta dice qué va a cambiar antes del botón.' },
        { p: '¿Cuánto tarda en servirme?', r: 'Desde la primera conversación: lo que le cuentas de tu negocio es lo que usa para contestarte.' },
        { p: '¿Y si no me gusta lo que propone?', r: `No la confirmas: «No ejecutar la acción». A una sugerencia le dices «Ahora no» (vuelve en ${DIAS_AHORA_NO} días) o «No aplica» (no vuelve).` },
        { p: '¿Publica anuncios o posts por mí?', r: 'No. MaKo no publica nada por su cuenta: te contesta, te sugiere y, con tu sí, hace lo que dice la tarjeta.' },
        { p: '¿Y si MaKo no puede hacer algo?', r: 'Te lo dice y abre un ticket solo, con lo que pasó. Cuando se arregla, te avisa en esa misma conversación.' },
      ],
    },
  ],
};
