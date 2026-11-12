// =============================================================================
// /vsl/web-generator — el Web Generator, con la ESTRUCTURA y el DISEÑO de la página de HighLevel AI Studio (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA, el orden, el storytelling y el DISEÑO (./disenos/web-generator.tsx, con los valores medidos
// en docs/diseno/landings-competencia/web-generator.md):
//   https://www.gohighlevel.com/ai-studio  (leída el 11/11/2026 con Chromium)
// Su orden (la noche del 11/11 la página ya no tenía «Built with AI Studio» ni «Meet your 24/7 AI Team»), que se respeta
// aquí bloque por bloque: hero «Websites powered by AI Studio» → «They typed a sentence. Here's what came out» (una galería
// de lo que armaron sus usuarios, con «Yours could be next») → «Trusted by businesses using AI to grow» (contadores) →
// «What is AI Studio?» (lo describes y lo arma · más que landings · conectado el día que sale) → «What can AI Studio
// build?» (seis tipos) → «Why Businesses Use It» (tres razones, cada una con un testimonio al lado) → «Who is AI Studio
// for?» → preguntas frecuentes → cierre. Por qué ganó: docs/competencia/landings-por-funcion.md → «Web Generator».
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
//   · Su video de producto debajo del hero no va (no hay un video del Web Generator). De sus nueve preguntas sale la de
//     agencias: no está medido qué hace el Web Generator para el cliente de una.
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
  referencia: { nombre: 'HighLevel AI Studio — el creador de sitios con IA', url: 'https://www.gohighlevel.com/ai-studio', leida: '2026-11-11' },
  metaTitle: 'Web Generator de MaKo: tu landing está a una frase de distancia',
  metaDesc: 'Describes la landing o la presentación que necesitas y MaKo la arma por secciones, con tu funnel y tu negocio. Lo que dejan en el formulario entra a tu CRM.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Landings y presentaciones con IA',
      titulo: 'Tu landing está <em>a una frase</em> de distancia.',
      bajada: 'Describes lo que necesitas y MaKo la diseña, la escribe y la arma por secciones, con lo que sabe de tu funnel y tu negocio. <strong>Lo que dejan en el formulario entra a tu CRM.</strong>',
      visual: { tipo: 'propio', slug: 'web-generator' },
    },
    {
      tipo: 'tarjetas',
      titulo: 'Los diseños de <em>Web Generator</em>',
      bajada: 'Cada landing arranca vestida con uno de estos diseños, y el objetivo que elijas pone el texto.',
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
      bajada: 'Es el editor de landings y presentaciones de MaKo. Le dices qué página necesitas, con tus palabras, y la arma entera: <strong>el diseño, el texto y las secciones</strong>, con el formulario que capta a tus leads.',
      items: [
        { icono: I.frase, titulo: 'Lo describes y lo arma', texto: 'No arrancas de una hoja en blanco: MaKo te propone el esquema, lo editas y escribe las secciones. Después cambias lo que quieras <strong>pidiéndoselo</strong>, como a un diseñador.' },
        { icono: I.capas, titulo: 'Más que landings', texto: 'También presentaciones, con sus propias plantillas, y un quiz con diagnóstico. Y si te gusta una página de afuera, la replicas por partes en el editor.' },
        { icono: I.crm, titulo: 'Conectado el día que sale', texto: 'Como la publicas desde MaKo, lo que dejan en su formulario <strong>entra a tu CRM</strong>. No hay un código que pegar ni algo que exportar.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: '¿Qué puedes armar con <em>Web Generator</em>?',
      items: [
        { icono: I.pagina, titulo: 'Páginas completas, no sólo un diseño', texto: `${N_LANDINGS} plantillas de landing, cada una con su texto y sus secciones, vestidas con uno de los ${N_DISENOS} diseños.` },
        { icono: I.quiz, titulo: 'Un quiz que diagnostica', texto: 'Preguntas con puntos y un resultado distinto según lo que contestan.' },
        { icono: I.form, titulo: 'Formularios que entran a tu CRM', texto: 'Cada persona que deja sus datos entra a tu CRM como un lead.' },
        { icono: I.agenda, titulo: 'Tu agenda, dentro de la página', texto: 'Insertas tu Calendly o tu Cal.com para que agenden ahí mismo, sin salir de tu landing.' },
        { icono: I.diapo, titulo: 'Presentaciones', texto: 'Un pitch, una propuesta comercial, un informe mensual o un caso de éxito, armados igual que una landing.' },
        { icono: I.pago, titulo: 'Un botón que cobra', texto: 'El botón de pago cobra un producto de tu catálogo desde la misma página.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Por qué los negocios <em>usan Web Generator</em>',
      items: [
        { icono: I.reloj, titulo: 'Sin semanas de ida y vuelta', texto: 'Una página nueva suele ser un ir y venir con un diseñador. Aquí describes lo que necesitas, MaKo arma el borrador y lo publicas cuando quieras, mientras la idea sigue fresca.' },
        { icono: I.crm, titulo: 'Una sola página, ya conectada', texto: 'Una landing hecha en otra herramienta hay que conectarla a tu CRM. La de Web Generator ya vive en MaKo: <strong>el formulario, el lead y tu CRM están en el mismo lugar</strong>.' },
        { icono: I.duplicar, titulo: 'La haces una vez y la duplicas', texto: '¿Otro lanzamiento u otro producto? Duplicas la landing desde su menú y partes de ahí, en vez de empezar de cero.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: '¿Para quién es <em>Web Generator</em>?',
      bajada: 'Para cualquier negocio que capta leads o agendas con una página. Elige la tuya: <strong>lo que dejan en el formulario entra a tu CRM.</strong>',
      items: QUE_CAPTAN.map((p) => ({ icono: I.objetivo, titulo: p.nombre, texto: p.descripcion, meta: p.categoria })),
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas <em>frecuentes</em>',
      items: [
        { p: '¿Qué es Web Generator?', r: 'El editor de landings y presentaciones de MaKo. Describes la página que necesitas y MaKo la arma: el diseño, el texto y las secciones. Después la editas por secciones y bloques.' },
        { p: '¿En qué se diferencia de otros creadores de páginas con IA?', r: 'Vive dentro de MaKo: arranca de lo que sabe de tu funnel y tu negocio, y lo que dejan en el formulario entra a tu CRM.' },
        { p: '¿Escribe el texto de mi landing?', r: 'Sí. MaKo te propone el esquema, lo editas, y escribe las secciones.' },
        { p: '¿Puedo editarla después?', r: 'Sí: por secciones y bloques, con el menú «/», los temas, los comentarios y el historial. Y le puedes pedir cualquier cambio a MaKo.' },
        { p: '¿Pueden agendar desde la página?', r: 'Sí: insertas tu agenda de Calendly o de Cal.com en la landing.' },
        { p: '¿El formulario llega a mi CRM?', r: 'Sí: los datos que dejan en el formulario entran a tu CRM.' },
        { p: '¿Puedo publicarla en mi dominio?', r: 'Sí: la publicas en hola-mako.site o conectas tu propio dominio.' },
        { p: '¿Sirve para SEO?', r: 'En Publicar → SEO le pones el título y la descripción con que la leen Google y WhatsApp.' },
      ],
    },
  ],
};
