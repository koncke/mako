// =============================================================================
// /vsl/mako — el Ops Center (MaKo, el chat que conoce tu negocio), con la ESTRUCTURA de la portada de Holo (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling, el DISEÑO y, desde el 12/11/2026, SUS TEXTOS):
//   https://tryholo.ai/  (leída el 11/11/2026 y otra vez el 12/11/2026 con Chromium)
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
// TEXTOS COPIADOS TAL CUAL de Holo, traducidos (12/11/2026, Martín: «en Holo dice Your Marketing Department One Hire… eso
// estaría bueno copiarlo, porque es cierto, dentro de MaKo tenés tu departamento de marketing. Y en lugar de tú apruebas, no
// tiene sentido eso ahí»): el titular «Your Marketing Department. One Hire.» → «Tu departamento de marketing. Una sola
// contratación.» (sin el «Tú apruebas» de antes); su bajada con lo que MaKo hace de verdad en cada área (los anuncios: Ads
// Writer y Ads Manager; el contenido: Copywriting, Image y Video; las landings: Web Generator; las automatizaciones que
// conversan: lib/funciones-mako.ts → `setting`); sus cuatro «Ads that sell. Socials that grow. SEO that ranks. Emails that
// convert.» con la palabra cambiada donde MaKo no hace eso (SEO → landings); «while you run the actual business»; «How it
// works? It's as easy as 1, 2, 3…» con su bajada («No briefs to write, no tools to learn, no one to hire») y sus pasos;
// «Proactive. No prompt needed.»; «Any niche… / Any integration, what you already use.»; «Early signals, first tweaks»;
// «Inside your new marketing department.» con «Chat.» y «All channels.»; «With great powers comes great privacy.» con
// «Full Data Ownership»; «Skeptical? Good. Read this.» con sus preguntas («Isn't this just ChatGPT with extra steps?»,
// «What do I actually have to do each week?», «How fast until something actually ships?», «What if I hate what it makes?»).
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
  referencia: { nombre: 'Holo — portada', url: 'https://tryholo.ai/', leida: '2026-11-12' },
  metaTitle: 'MaKo: tu departamento de marketing. Una sola contratación.',
  metaDesc: 'MaKo lee tu CRM, tus chats y tus llamadas, te contesta con tus números y te deja lo que hay que hacer en una tarjeta que confirmas. Con tu Second Brain, el mapa de tu negocio.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'MaKo, el chat que conoce tu negocio',
      titulo: 'Tu departamento<br>de marketing.<br><em>Una sola contratación.</em>',
      bajada: 'Cuéntale tu negocio: MaKo planea y escribe tus anuncios, tu contenido, tus emails y tus landings, y sus automatizaciones conversan con tus leads por WhatsApp. <strong>Lo que cambia algo, lo confirmas con un toque.</strong>',
      puntos: ['<strong>En un solo lugar</strong> Lo que hablas con MaKo en cada tab', '<strong>Tus datos son tuyos</strong> Te los llevas cuando quieras'],
      visual: { tipo: 'detalle', slug: 'mako' },
    },
    {
      // Sus cuatro tarjetas «Ads that sell. Socials that grow. SEO that ranks. Emails that convert.», con el área de MaKo que hace
      // eso (lib/funciones-mako.ts): la palabra cambia donde MaKo no lo hace (no hace SEO; no mide que un anuncio «venda» solo).
      // El dibujo de cada tarjeta lo elige el diseño en este mismo orden (./disenos/mako.tsx → DIBUJO_DEPARTAMENTO).
      tipo: 'filas',
      titulo: 'Anuncios, contenido, landings y mensajes, <em>mientras tú llevas el negocio.</em>',
      slug: 'mako',
      items: [
        { titulo: 'Anuncios medidos por lo que venden.', texto: 'MaKo escribe tus guiones en Ads Writer, arma la campaña de Meta con lo que le cuentas y te muestra cada anuncio <strong>con lo que vendió en tu CRM</strong>.', puntos: ['Lo nuevo se publica en pausa: lo prendes tú'] },
        { titulo: 'Contenido que copia lo que funciona.', texto: 'Los carruseles que mejor les funcionan a las cuentas que sigues, con su outlier, en <strong>tu versión editable</strong>. Y los guiones de tus reels, stories y emails, en Copywriting.' },
        { titulo: 'Landings que captan leads.', texto: 'La describes y Web Generator la arma, o replica una que ya funciona. Lo que dejan en el formulario <strong>entra a tu CRM</strong>.' },
        { titulo: 'Mensajes que contestan.', texto: 'Tus automatizaciones conversan con tus leads por WhatsApp, email, Instagram y Messenger, les recuerdan la reunión y <strong>te los pasan cuando hace falta una persona</strong>.' },
      ],
    },
    {
      // 14/11/2026: Holo pasó a CINCO pasos alrededor de su centro (1 arriba, 2 y 5 a los costados, 3 y 4 abajo, con flechas).
      tipo: 'pasos',
      fondo: true,
      titulo: '¿Cómo funciona?<br><em>Así de fácil: 1, 2, 3…</em>',
      bajada: 'Sin briefs que escribir, sin herramientas que aprender, sin nadie que contratar. Le hablas y confirmas desde el teléfono.',
      pasos: [
        { titulo: 'Cuéntale tu negocio', texto: 'Qué vendes, cómo cobras y cómo te llegan los clientes. MaKo arma tu Second Brain.' },
        { titulo: 'Recibe tu diagnóstico', texto: 'Offer diagnostica tu oferta y escribe la nueva.' },
        { titulo: 'Arma tu plan', texto: 'El Funnel Coach elige cómo conseguir clientes y calcula el presupuesto de anuncios.' },
        { titulo: 'Confirma con un toque', texto: 'Lo que cambia algo te llega en una tarjeta, en la computadora o en el teléfono.' },
        { titulo: 'Mide lo que aceptaste', texto: `A los ${DIAS_HECHA} días vuelve a mirar el dato y te dice si cambió.` },
      ],
    },
    {
      // «Holo runs your ads, email, social, and SEO end to end…» (14/11/2026): el titular con las cuatro palabras que se encienden
      // letra por letra al bajar (van en <em>) y sus tres columnas. Lo que MaKo lee de verdad desde el chat del Ops Center.
      tipo: 'tarjetas',
      titulo: 'MaKo lee tu <em>CRM</em>, tus <em>chats</em>, tus <em>anuncios</em> y a tu <em>competencia</em> de punta a punta: te contesta con tus números, te propone lo que sigue y, con tu sí, lo hace, mientras tú llevas el negocio.',
      items: [
        { icono: I.aprende, titulo: 'Aprende con cada conversación.', texto: 'Lo que hablas, lo que aceptas y lo que descartas le enseña qué sirve en tu negocio.' },
        { icono: I.conversaciones, titulo: 'Todo tu negocio, en un chat.', texto: 'Spy, CRM, Automations, tus anuncios y tu Second Brain, sin abrir ocho pestañas.' },
        { icono: I.equipo, titulo: 'Hecho para dueños, no para marketers.', texto: 'Le preguntas con tus palabras y confirmas con un toque: llevar el marketing se parece más a revisar que a hacer.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Proactivo. <em>No hace falta pedírselo.</em>',
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
        { icono: I.mapa, titulo: 'Cualquier negocio, <em>de un coach a una inmobiliaria.</em>', texto: 'MaKo aprende cómo habla y vende tu mercado: tu Second Brain conecta tu oferta, tus clientes y tu funnel con lo que MaKo dedujo, y de ahí saca lo que necesita para contestarte.' },
        { icono: I.equipo, titulo: 'Todo tu equipo, <em>cada uno con lo suyo.</em>', texto: 'Tu closer y tu setter también le escriben a MaKo desde su propia cuenta, y ven lo que les toca.' },
        { icono: I.telefono, titulo: 'Con lo que ya usas, <em>sin migrar nada.</em>', texto: 'Conectas tu IA, tus redes, tu agenda, tus grabaciones y tu pasarela de pago en Integraciones: Meta, Calendly, Fathom, Stripe…' },
      ],
    },
    {
      // «Strategy set, campaigns live» → «Every month beats the last» (14/11/2026): cuatro etapas que pasan solas cada 5 s; el
      // titular y el texto son los de la etapa activa (el título del bloque es el de la primera). Las etapas son lo que MaKo
      // aprende de verdad: lo que se habla, lo que se descarta (lib/recomendaciones-reglas.ts) y la medición a los DIAS_HECHA días.
      tipo: 'pasos',
      fondo: true,
      titulo: 'Tu negocio, leído',
      pasos: [
        { titulo: 'Tu negocio, leído', texto: 'Le cuentas tu negocio y MaKo arma tu Second Brain: tu oferta, tus clientes y tu funnel.' },
        { titulo: 'Primeras señales, primeros ajustes', texto: 'Lo que hablas, lo que aceptas y lo que descartas le enseña qué sirve en tu negocio.' },
        { titulo: 'Deja de proponer lo que no sirve', texto: 'Si a dos sugerencias del mismo tipo les dices «No aplica» y no aceptaste ninguna, deja de proponerlas.' },
        { titulo: 'Mide lo que aceptaste', texto: 'De una sugerencia que aceptaste, vuelve a mirar el dato. Si sigue igual, te lo dice.' },
      ],
    },
    {
      // «Inside your new marketing department.» (14/11/2026): su riel de ocho cajas con video. Cada caja es la grabación REAL de
      // una herramienta que el Ops Center tiene a mano (public/vsl-assets/sitio/, las de la portada), con su nombre: ninguna
      // pantalla se muestra como si fuera otra.
      tipo: 'tarjetas',
      titulo: 'Adentro de tu nuevo departamento de marketing.',
      items: [
        { titulo: 'Referentes', texto: 'Eliges con quién hablar en el chat de MaKo, como Alex Hormozi, y te contesta con su método, llevado a tu negocio.' },
        { titulo: 'Second Brain', texto: 'El mapa de tu negocio: tu oferta, tus clientes, tu funnel y tu mensaje, conectados.' },
        { titulo: 'Competitor Spy', texto: 'Lo que publica tu competencia, con su gancho y su ángulo, para que hagas tu versión.' },
        { titulo: 'CRM', texto: 'Cada lead en su etapa, con su ficha y su historia.' },
        { titulo: 'Chats', texto: 'WhatsApp, Instagram, Messenger y email en una sola bandeja: donde están tus clientes, sin abrir ocho pestañas.' },
        { titulo: 'Cobranza', texto: 'Las cuotas de cada cliente, con lo que pagó y lo que falta.' },
        { titulo: 'Video', texto: 'Tus cortes, tus subtítulos y tu edición, en el editor de MaKo.' },
        { titulo: 'Copywriting', texto: 'Los guiones de tus reels, tus anuncios y tus emails, con lo que ya le funciona a otros.' },
      ],
    },
    {
      // Su cinta de habilidades (14/11/2026, «Fill your calendar · Lock your brand voice…»): dos filas que corren en sentidos
      // contrarios (52 s y 60 s) y se arrastran. Cada tarjeta es algo que MaKo hace hoy (lib/funciones-mako.ts); el título del
      // bloque va sólo para el lector de pantalla, como en Holo (la cinta no tiene título a la vista).
      tipo: 'tarjetas',
      titulo: 'Lo que MaKo hace por ti',
      items: [
        { icono: I.mapa, titulo: 'Espía a tu competencia', texto: 'Sus anuncios, sus videos y su funnel, con su gancho.' },
        { icono: I.coach, titulo: 'Arma tu oferta', texto: 'Offer la diagnostica y escribe la nueva.' },
        { icono: I.rayo, titulo: 'Calcula tu presupuesto', texto: 'El Funnel Coach elige cómo conseguir clientes y cuánto invertir.' },
        { icono: I.pagina, titulo: 'Escribe tus guiones', texto: 'Reels, anuncios y emails, en Copywriting.' },
        { icono: I.marca, titulo: 'Replica lo que funciona', texto: 'Un carrusel que rinde, en tu versión editable.' },
        { icono: I.pagina, titulo: 'Arma tu landing', texto: 'Web Generator la arma o replica una que ya funciona.' },
        { icono: I.rayo, titulo: 'Mide tus anuncios', texto: 'Cada anuncio con lo que vendió en tu CRM.' },
        { icono: I.equipo, titulo: 'Ordena tu CRM', texto: 'Tus leads por etapa, con su historia.' },
        { icono: I.chat, titulo: 'Conversa con tus leads', texto: 'Automatizaciones que contestan por WhatsApp.' },
        { icono: I.agenda, titulo: 'Recuerda tus llamadas', texto: 'Un WhatsApp antes de cada reunión.' },
        { icono: I.reloj, titulo: 'Sigue tus cuotas', texto: 'Te avisa cuando una cuota vence.' },
        { icono: I.aprende, titulo: 'Arma tus tableros', texto: 'Tus números de marketing y ventas, en una hoja.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Un gran poder trae <em>una gran privacidad.</em>',
      items: [
        { icono: I.mako, titulo: 'Con tu propia IA', texto: 'Para escribir por ti, MaKo usa tu Claude o tu ChatGPT, conectado a tu cuenta.' },
        { icono: I.candado, titulo: 'Cada uno ve lo suyo', texto: 'El mapa del negocio es del admin. En el chat, tu closer y tu setter no ven tus objetivos ni tus números del negocio.' },
        { icono: I.descarga, titulo: 'Tus datos son tuyos', texto: 'Tu contenido y tu estrategia son tuyos: bajas tu Second Brain cuando quieras, en un ZIP de archivos que se abren con cualquier editor de texto, y con Obsidian.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: '¿Dudas?<br>Bien. Lee esto.',
      items: [
        { p: '¿No es ChatGPT con pasos de más?', r: 'No. ChatGPT no sabe nada de tu negocio: MaKo lee tu CRM, tus chats y tus llamadas para contestarte, y lo que cambia algo te lo deja en una tarjeta. Para escribir sí usa tu IA: tu Claude o tu ChatGPT.' },
        { p: '¿Qué tengo que hacer yo cada semana?', r: 'Preguntarle, y decir sí o no a lo que te propone. Cada tarjeta dice qué va a cambiar antes del botón.' },
        { p: '¿Cuánto tarda en servirme de verdad?', r: 'Desde la primera conversación: lo que le cuentas de tu negocio es lo que usa para contestarte.' },
        { p: '¿Y si no me gusta lo que hace?', r: `No la confirmas: «No ejecutar la acción». A una sugerencia le dices «Ahora no» (vuelve en ${DIAS_AHORA_NO} días) o «No aplica» (no vuelve).` },
        { p: '¿Publica anuncios o posts por mí?', r: 'No. MaKo no publica nada por su cuenta: te contesta, te sugiere y, con tu sí, hace lo que dice la tarjeta.' },
        { p: '¿Y si MaKo no puede hacer algo?', r: 'Te lo dice y abre un ticket solo, con lo que pasó. Cuando se arregla, te avisa en esa misma conversación.' },
      ],
    },
  ],
};
