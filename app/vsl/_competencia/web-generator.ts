// =============================================================================
// /vsl/web-generator — el Web Generator, con la ESTRUCTURA y el DISEÑO de la página de HighLevel AI Studio (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA, el orden, el storytelling, el DISEÑO (./disenos/web-generator.tsx, con los valores medidos
// en docs/diseno/landings-competencia/web-generator.md) y, desde el 12/11/2026, SUS TEXTOS:
//   https://www.gohighlevel.com/ai-studio  (leída el 11/11/2026 y otra vez el 12/11/2026 con Chromium)
// Su orden (la noche del 11/11 la página ya no tenía «Built with AI Studio» ni «Meet your 24/7 AI Team»), que se respeta
// aquí bloque por bloque: hero «Websites powered by AI Studio» → «They typed a sentence. Here's what came out» (una galería
// de lo que armaron sus usuarios, con «Yours could be next») → «Trusted by businesses using AI to grow» (contadores) →
// «What is AI Studio?» (lo describes y lo arma · más que landings · conectado el día que sale) → «What can AI Studio
// build?» (seis tipos) → «Why Businesses Use It» (tres razones, cada una con un testimonio al lado) → «Who is AI Studio
// for?» → preguntas frecuentes → cierre. Por qué ganó: docs/competencia/landings-por-funcion.md → «Web Generator».
//
// TEXTOS COPIADOS TAL CUAL de la referencia, traducidos (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas
// tal cual»): la cejilla «Your website is one sentence away» → «Tu landing está a una frase de distancia»; el titular
// «Websites powered by AI Studio» → «Landings impulsadas por Web Generator» (MaKo arma landings y presentaciones, no sitios
// de varias páginas); su bajada «Describe what you need. AI Studio designs it, writes it, and connects it to your CRM,
// calendars…» (sin «workflows»); «They typed a sentence. Here's what came out»; «What is AI Studio?» con su bajada y sus tres
// «You describe it, it builds it» / «More than landing pages» / «Connected the day it goes live»; «What can AI Studio build?
// Pick a project type…» con sus títulos («Complete pages, not just a layout», «Forms that land in your CRM»…); «Why Businesses
// Use It» con «One build, already connected» y «Build it once, then do it again…»; «Who is AI Studio for? Any business that
// takes bookings or leads. Pick yours.»; sus preguntas.
// Y lo que suma MaKo, porque es de lo más vistoso que tiene (12/11/2026, Martín: «en la parte de landing, tal vez no pusiste
// lo de replicar, que eso está buenísimo»): «Replicar» va en la bajada del hero y como la segunda pestaña de «What can AI
// Studio build?», que es donde la referencia muestra lo que se arma. Lo que dice sale de lib/editor-landing/replicar.ts,
// replicar-partes.ts (diseño, estructura, ángulos, texto literal), replicar-reglas.ts (Landing, Presentación, Página web) y
// copia-identica.ts (lo que no se copia: el JavaScript y que el formulario copiado no envía).
//
// Lo que se cambió de la referencia, y por qué:
//   · Su prueba de 14 días y su botón de la barra no van: el cierre de /vsl es la llamada, y no se escribe un precio.
//   · Su galería de lo que armaron sus usuarios es suya: en ese lugar van los diseños con los que arranca una landing
//     (lib/editor-landing/disenos-landing.ts). Sus testimonios, al lado de cada razón de «Why Businesses Use It», son suyos:
//     ahí va la prueba de MaKo, el caso de Mauricio (el mismo de todas), por eso el bloque `caso` va después de las razones.
//   · Sus contadores son de USO (700K sitios, 85K negocios). Van los números de lo que la función TRAE, contados del
//     código: los diseños, las plantillas de landing y de presentación, y los bloques del menú «/».
//   · De sus seis tipos, «Dashboards» y «Storefronts» no existen en el Web Generator: en su lugar, las presentaciones y
//     el botón de pago (los dos, del código). Su «Ready to publish · 5.7s» y sus «3 a 6 semanas contra esta noche» son
//     tiempos suyos: no se dicen. Sus citas de usuarios, tampoco.
//   · «Who is AI Studio for?» elige por rubro; MaKo, por objetivo: las plantillas que captan leads o agendas
//     (lib/editor-landing/plantillas.ts). Su cadena «After they hit submit» (cita, cuadrilla avisada) se dice sólo hasta
//     donde llega MaKo: lo que dejan en el formulario entra a tu CRM (lib/funciones-mako.ts → `conecta`, y
//     app/api/track/optin/route.ts, que recibe el formulario de una página publicada).
//   · Su video de producto debajo del hero es, en MaKo, el Panel real grabado (elegir diseño y objetivo, y la landing que sale). De sus nueve preguntas sale la de
//     agencias: no está medido qué hace el Web Generator para el cliente de una.
// 14/11/2026, noche (Martín: «que la copia salga muy fiel a todas las animaciones… los videos, los hover, todo»): el DISEÑO se rehízo
// contra la versión de hoy, con sus movimientos (el constructor del hero que se escribe solo, la galería que se arma con el scroll,
// los contadores, el deslizador antes/después, la lista con su barra, la cadena del formulario). Lo que se ve en cada marco es REAL:
// las landings que arma Web Generator con cada diseño y objetivo, fotografiadas de su render público, y la grabación de «Replicar».
// Detalle: la cabecera de ./disenos/web-generator.tsx.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['landing-writer']) y del editor (lib/editor-landing/,
// app/web-generator/): crear con IA en dos pasos, editar por secciones y bloques, replicar, publicar en hola-mako.site o
// en tu dominio (lib/editor-landing/dominios.ts), el SEO de Publicar (lib/editor-landing/seo-pagina.ts) y «Duplicar»
// (app/web-generator/menu-contextual-landings.ts).
// =============================================================================

import { DISENOS_LANDING } from '@/lib/editor-landing/disenos-landing';
import { PLANTILLAS } from '@/lib/editor-landing/plantillas';
import { PLANTILLAS_PRESENTACION } from '@/lib/editor-landing/plantillas-presentaciones';
import { BLOQUES } from '@/lib/editor-landing/catalogo-bloques';
import type { LandingCompetencia } from './tipos';

const I = {
  web: ['M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z', 'M3 9h18', 'M7 6.5h.01', 'M10 6.5h.01'],
  frase: ['M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1', 'M8 10h8', 'M8 13h5'],
  capas: ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
  crm: ['M20 6v12a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z', 'M10 16h6', 'M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 8h3', 'M4 12h3', 'M4 16h3'],
  pagina: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  diapo: ['M3 4h18', 'M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10', 'M12 16v4', 'M9 20h6', 'M8 12l3 -3l2 2l3 -3'],
  form: ['M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1z', 'M5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1z', 'M7 7h4', 'M7 17h4'],
  quiz: ['M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4', 'M12 19l0 .01'],
  agenda: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M16 3v4', 'M8 3v4', 'M4 11h16', 'M9 15l2 2l4 -4'],
  pago: ['M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z', 'M3 10h18', 'M7 15h.01', 'M11 15h2'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  duplicar: ['M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z', 'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1'],
  objetivo: ['M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  copiar: ['M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z', 'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1', 'M11 14l2 2l4 -4'],
  estilo: ['M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25', 'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
};

// Lo que la función TRAE, contado del código (no de uso).
const N_DISENOS = DISENOS_LANDING.length;
const N_LANDINGS = PLANTILLAS.length;
const N_PRESENTACIONES = PLANTILLAS_PRESENTACION.length;
const N_BLOQUES = BLOQUES.length;

// «Who is AI Studio for?»: la referencia dice «Any business that takes bookings or leads». Son las plantillas de esas
// categorías (agendar, captar contactos y eventos), con el nombre y la descripción que ve la persona en el Panel.
const CATEGORIAS_QUE_CAPTAN: readonly string[] = ['Agendar', 'Captar contactos', 'Eventos'];
const QUE_CAPTAN = PLANTILLAS.filter((p) => CATEGORIAS_QUE_CAPTAN.includes(p.categoria));

export const LANDING_WEB_GENERATOR: LandingCompetencia = {
  slug: 'web-generator',
  nombre: 'Web Generator',
  icono: I.web,
  referencia: { nombre: 'HighLevel AI Studio — el creador de sitios con IA', url: 'https://www.gohighlevel.com/ai-studio', leida: '2026-11-12' },
  metaTitle: 'Web Generator de MaKo: tu landing está a una frase de distancia',
  metaDesc: 'Describes la landing o la presentación que necesitas y MaKo la arma por secciones, con tu funnel y tu negocio. O replicas una landing que ya funciona. Lo que dejan en el formulario entra a tu CRM.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Tu landing está a una frase de distancia',
      titulo: 'Landings impulsadas por <em>Web Generator</em>',
      bajada: 'Describe lo que necesitas. Web Generator la diseña, la escribe y la conecta a tu CRM y a tu agenda. <strong>O pega el link de una landing que ya funciona y la replica.</strong>',
      visual: { tipo: 'propio', slug: 'web-generator' },
    },
    {
      tipo: 'tarjetas',
      titulo: 'Escribes una frase. <em>Sale con uno de estos diseños.</em>',
      bajada: 'Cada landing arranca con uno de estos diseños, y el objetivo que elijas pone el texto. La tuya podría ser la próxima.',
      items: DISENOS_LANDING.map((d) => ({ icono: I.estilo, titulo: d.nombre, texto: d.descripcion })),
    },
    {
      tipo: 'cifras',
      titulo: 'Lo que trae <em>Web Generator</em> hoy',
      items: [
        { valor: String(N_DISENOS), label: 'diseños para arrancar tu landing' },
        { valor: String(N_LANDINGS), label: 'plantillas de landing, una por objetivo' },
        { valor: String(N_PRESENTACIONES), label: 'plantillas de presentación' },
        { valor: String(N_BLOQUES), label: 'bloques para insertar en una sección' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: '¿Qué es <em>Web Generator</em>?',
      bajada: 'Web Generator es el creador de landings con IA de MaKo. Describes la página que necesitas con tus palabras y la arma entera: <strong>el diseño, el texto y las secciones</strong>, y el formulario y la agenda que la hacen funcionar.',
      items: [
        { icono: I.frase, titulo: 'Lo describes y lo arma', texto: 'No hay hoja en blanco ni secciones que armar a mano. MaKo ya sabe qué hace tu negocio y a quién le vende: te propone el esquema, lo editas y escribe las secciones. Después cambias lo que quieras <strong>pidiéndoselo</strong>, como le dirías a un diseñador qué arreglar.' },
        { icono: I.capas, titulo: 'Más que landings', texto: 'Las landings son el punto de partida. Web Generator también arma presentaciones, con sus propias plantillas, y un quiz con diagnóstico, en el mismo editor.' },
        { icono: I.crm, titulo: 'Conectado el día que sale', texto: 'Como la publicas desde MaKo, cada formulario <strong>entra a tu CRM</strong> desde el momento en que la publicas. Nada que exportar, nada que volver a conectar.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: '¿Qué puede armar <em>Web Generator</em>?',
      bajada: 'Elige un tipo de proyecto para verlo.',
      items: [
        { icono: I.pagina, titulo: 'Páginas completas, no sólo un diseño', texto: `El diseño y el texto generados juntos, listos para publicar: ${N_LANDINGS} plantillas de landing, vestidas con uno de los ${N_DISENOS} diseños.` },
        { icono: I.copiar, titulo: 'Réplicas de una landing que ya funciona', texto: 'Pegas su link, MaKo la lee y eliges qué copiar: el diseño, la estructura, los ángulos o el texto literal. Sale como landing, presentación o página web, editable en el editor. Su JavaScript no se copia, y un formulario copiado tal cual se ve pero no envía.' },
        { icono: I.quiz, titulo: 'Un quiz que califica por ti', texto: 'Las preguntas que haría tu equipo, con puntos y un resultado distinto según lo que contestan.' },
        { icono: I.form, titulo: 'Formularios que llegan a tu CRM', texto: 'Cada persona que deja sus datos entra a tu CRM como un lead.' },
        { icono: I.agenda, titulo: 'Tu agenda, dentro de la página', texto: 'Insertas tu Calendly o tu Cal.com para que agenden ahí mismo, sin salir de tu landing.' },
        { icono: I.diapo, titulo: 'Presentaciones', texto: 'Un pitch, una propuesta comercial, un informe mensual o un caso de éxito, armados igual que una landing.' },
        { icono: I.pago, titulo: 'Un botón que cobra', texto: 'El botón de pago cobra un producto de tu catálogo desde la misma página.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Por qué los negocios <em>lo usan</em>',
      items: [
        { icono: I.reloj, titulo: 'Sin semanas de ida y vuelta', texto: 'Una página nueva suele ser semanas de ir y venir. Describes lo que necesitas, MaKo arma un borrador que funciona y pasas de la idea a publicada mientras la idea sigue fresca.' },
        { icono: I.crm, titulo: 'Una sola página, ya conectada', texto: 'Una landing hecha en otra herramienta hay que conectarla a tu CRM. Web Generator la arma dentro de MaKo: <strong>el formulario, el lead y tu CRM están en el mismo lugar</strong>.' },
        { icono: I.duplicar, titulo: 'Hazla una vez y repítela en el próximo lanzamiento', texto: 'La primera gran landing no tiene por qué ser la última: la duplicas desde su menú y partes de ahí, en vez de empezar de cero.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: '¿Para quién es <em>Web Generator</em>?',
      bajada: 'Cualquier negocio que capta agendas o leads. Elige el tuyo: <strong>lo que dejan en el formulario entra a tu CRM.</strong>',
      items: QUE_CAPTAN.map((p) => ({ icono: I.objetivo, titulo: p.nombre, texto: p.descripcion, meta: p.categoria })),
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas <em>frecuentes</em>',
      items: [
        { p: '¿Qué es Web Generator?', r: 'El editor de landings y presentaciones de MaKo. Describes la página que necesitas y MaKo la arma: el diseño, el texto y las secciones. Después la editas por secciones y bloques.' },
        { p: '¿En qué se diferencia de otros creadores de páginas con IA?', r: 'Vive dentro de MaKo: arranca de lo que sabe de tu funnel y tu negocio, y lo que dejan en el formulario entra a tu CRM.' },
        { p: '¿Escribe el texto de mi landing?', r: 'Sí. MaKo te propone el esquema, lo editas, y escribe las secciones.' },
        { p: '¿Puedo replicar una landing que ya funciona?', r: 'Sí. Pegas su link y eliges qué copiar: el diseño, la estructura, los ángulos o el texto literal. Sale como landing, presentación o página web, y la editas como cualquier otra. Su JavaScript no se copia, y un formulario copiado tal cual se ve pero no envía.' },
        { p: '¿Puedo editarla después?', r: 'Sí: por secciones y bloques, con el menú «/», los temas, los comentarios y el historial. Y le puedes pedir cualquier cambio a MaKo.' },
        { p: '¿Pueden agendar desde la página?', r: 'Sí: insertas tu agenda de Calendly o de Cal.com en la landing.' },
        { p: '¿El formulario llega a mi CRM?', r: 'Sí: los datos que dejan en el formulario entran a tu CRM.' },
        { p: '¿Puedo publicarla en mi dominio?', r: 'Sí: la publicas en hola-mako.site o conectas tu propio dominio.' },
        { p: '¿Sirve para SEO?', r: 'En Publicar → SEO le pones el título y la descripción con que la leen Google y WhatsApp.' },
      ],
    },
  ],
};
