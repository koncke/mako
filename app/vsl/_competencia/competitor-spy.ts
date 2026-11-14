// =============================================================================
// /vsl/competitor-spy — Competitor Spy, con la ESTRUCTURA y el DISEÑO de la portada de Foreplay (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el DISEÑO):
//   https://www.foreplay.co/  (leída el 11/11/2026 con Chromium, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/competitor-spy.tsx; los valores medidos de la referencia (Inter e Inter Display,
// la escala, los blancos con transparencia sobre #020308, las cajas, los radios y los botones), en
// docs/diseno/landings-competencia/competitor-spy.md.
// Su orden, que se respeta aquí: hero «The Complete Winning Ad Workflow» → (su tira de logos) → «Your new secret weapon
// for ads»: antes (chats, links vencidos) y después → la cabeza «Research & Inspiration» → la fila «Save ads from
// anywhere, forever» → la fila «Automatically track competitors» → (su buscador) → la banda de la extensión → la cabeza
// «Creative Analytics & Production» → la fila «Lens» → la fila «Briefs» → (colaborar, compartir, «Miles beyond the
// status quo») → el cierre. Por qué ganó: docs/competencia/landings-por-funcion.md → «Competitor Spy».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su «Powering +10,000 Social Ad Teams», su contador de anuncios y sus reseñas son de uso: MaKo no tiene uno. No van.
//     En el lugar de la tira de logos van la etiqueta y los dos renglones del hero.
//   · Su buscador de anuncios de todo el mercado, sus tableros para colaborar y compartir y su grilla «Miles beyond the
//     status quo» (perfiles de expertos, app y API de su biblioteca): Competitor Spy no tiene nada de eso (mira sólo a los
//     competidores que sumas). No van.
//   · «Automatically track competitors 24/7»: Spy lee al agregar un competidor y al abrir su ficha; revisar solo todos los
//     días es un «Todavía no» de lib/funciones-mako.ts, y así se dice.
//   · No tiene testimonios, así que esta landing tampoco lleva el caso.
//   · Sus dos cabezas de sección («Research & Inspiration», «Creative Analytics & Production») son bloques de tarjetas SIN
//     tarjetas (sólo etiqueta, título y bajada): cada fila de la referencia es un bloque de tres tarjetas, que el diseño
//     dibuja como sus pestañas.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['market-an']) y de la extensión de MaKo («Guardar en Spy»,
// extension/spy-leer.js y lib/spy-captura.ts). Lo que se hace con lo guardado (los carruseles y los anuncios de la
// competencia en Image) sale de la entrada de 'image-editor'.
//
// LOS TEXTOS DE FOREPLAY, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»),
// traducidos a español neutro de tú:
//   · «The Complete Winning Ad Workflow» → «El flujo completo para anuncios ganadores» (en MaKo: guardas en Spy, haces tu
//     versión en Image, la publicas en Ads Manager y la mides en el Dashboard); su bajada «Everything you need to
//     predictably make ads that convert, from the first spark of inspiration saving ads from facebook ad library to the
//     final performance report» → sin «predictably», hasta «tu versión, lista para editar en Image»;
//   · «Your new secret weapon for ads», «Before… Group chats, expired links and fragmented reports», «After Foreplay» (→
//     «Después de MaKo»); sin su «Trade guesswork for the creative process used by the world's fastest growing brands»;
//   · «Research & Inspiration» / «Spark creative genius and crush competitors.» / «Ad creative research is your shortcut
//     to success. Reverse engineer ads that are already crushing…» (sin «identify trends»: no lo hace);
//   · «Save ads from anywhere» (sin «forever»), «Automatically track competitors» → «Sigue a tus competidores» (revisar
//     solo todos los días es un «Todavía no»), «Save ads from Meta, TikTok & LinkedIn Ad Libraries» → sólo la de Meta
//     (lib/spy-captura.ts);
//   · «Creative Analytics & Production» / «Identify winning patterns and replicate success.» / «Instantly turn insights
//     into action…», «Know what's working and why», «Go from concept to launched, faster» (→ «a tu anuncio»), y el cierre
//     «Ready to ship more winning ads?» (en ./disenos/competitor-spy.tsx).
// =============================================================================

import type { LandingCompetencia } from './tipos';

const I = {
  spy: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M12 3v2', 'M12 19v2', 'M3 12h2', 'M19 12h2'],
  guardar: ['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z'],
  pegar: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z'],
  reloj: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
  personas: ['M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
  web: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'],
  idea: ['M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7', 'M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3', 'M9.7 17l4.6 0'],
  embudo: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  nota: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 12l2 2l4 -4'],
  texto: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  editar: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  pagina: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z'],
};

export const LANDING_COMPETITOR_SPY: LandingCompetencia = {
  slug: 'competitor-spy',
  nombre: 'Competitor Spy',
  icono: I.spy,
  referencia: { nombre: 'Foreplay — biblioteca de anuncios ganadores', url: 'https://www.foreplay.co/', leida: '2026-11-11' },
  metaTitle: 'Competitor Spy de MaKo: el flujo completo para anuncios ganadores',
  metaDesc: 'Todo lo que necesitas para hacer anuncios que conviertan, desde la primera chispa de inspiración guardando anuncios de la Biblioteca de Anuncios de Meta hasta tu versión en Image.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Competitor Spy: lo que hace tu competencia',
      titulo: 'El flujo completo para anuncios ganadores',
      bajada: 'Todo lo que necesitas para hacer anuncios que conviertan, desde la primera chispa de inspiración <strong>guardando anuncios de la Biblioteca de Anuncios de Meta</strong> hasta tu versión, lista para editar en Image.',
      puntos: ['Guarda sus anuncios de Meta con un clic desde Chrome', 'Su funnel, su oferta y el guion de sus reels, leídos'],
      visual: { tipo: 'propio', slug: 'competitor-spy' },
    },
    {
      tipo: 'contraste',
      titulo: 'Tu nueva arma secreta para tus anuncios',
      sin: {
        titulo: 'Antes…',
        texto: 'Chats de grupo, links vencidos y capturas sueltas. Y nadie recuerda desde cuándo corría ese anuncio.',
      },
      con: {
        titulo: 'Después de MaKo',
        texto: 'Cada competidor con sus piezas, cada pieza con la fecha desde que MaKo la vio, y tu versión a un toque en Image.',
      },
    },
    {
      // La cabeza «Research & Inspiration» de la referencia: sin tarjetas.
      tipo: 'tarjetas',
      etiqueta: 'Investigación e inspiración',
      titulo: 'Despierta tu genio creativo y gánale a tu competencia.',
      bajada: 'Investigar sus anuncios es tu atajo. Desarma los anuncios que ya le están funcionando y descubre qué funnel usa.',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Anuncios',
      titulo: 'Guarda anuncios de donde los veas',
      items: [
        { icono: I.guardar, titulo: 'Desde Chrome, con un clic', texto: 'En la Biblioteca de Anuncios de Meta, con la extensión de MaKo, tocas <strong>«Guardar en Spy»</strong> y se guardan sus anuncios.' },
        { icono: I.pegar, titulo: 'O lo pegas', texto: 'Pegas el anuncio en la ficha de su competidor y queda guardado ahí.' },
        { icono: I.reloj, titulo: 'Desde cuándo está a la vista', texto: 'Cada anuncio dice cuántos días lleva activo, a dónde manda y cuáles lanzó el mismo día: el que sigue activo de su tanda es el ganador.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Competidores',
      titulo: 'Sigue a tus competidores',
      items: [
        { icono: I.personas, titulo: 'Sumas a tus competidores', texto: 'Cada uno con sus canales: su web, su Instagram y su YouTube.' },
        { icono: I.web, titulo: 'MaKo lee lo que publican', texto: 'Su sitio, sus reels y sus videos, con los números que pudo medir. Lo que no pudo leer lo dice: nunca es un cero.' },
        { icono: I.idea, titulo: 'Te sugiere a quién mirar', texto: 'Competidores que MaKo ya mira, para sumarlos sin gastar nada.' },
      ],
    },
    {
      tipo: 'pasos',
      etiqueta: 'Extensión de Chrome',
      titulo: 'Guarda anuncios de la Biblioteca de Anuncios de Meta',
      bajada: 'La extensión de MaKo lee lo que la página ya te muestra, sólo cuando la tocas.',
      pasos: [
        { titulo: 'Instala la extensión de MaKo', texto: 'La misma extensión de Chrome que usa MaKo para tus otras funciones.' },
        { titulo: 'Abre sus anuncios', texto: 'En la Biblioteca de Anuncios de Meta, con los de tu competidor a la vista.' },
        { titulo: 'Toca «Guardar en Spy»', texto: 'Sus anuncios quedan en Competitor Spy, listos para leerlos y usarlos.' },
      ],
    },
    {
      // La cabeza «Creative Analytics & Production» de la referencia: sin tarjetas.
      tipo: 'tarjetas',
      etiqueta: 'Análisis creativo y producción',
      titulo: 'Identifica los patrones ganadores y replica el éxito.',
      bajada: 'Convierte lo que ves en acción: MaKo lee el funnel, la oferta y el guion de lo que publica tu competencia, y sus anuncios te esperan en Image para hacer el tuyo.',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Análisis',
      titulo: 'Entiende qué le funciona y por qué',
      items: [
        { icono: I.embudo, titulo: 'Qué funnel usa', texto: 'Evento presencial, webinar, VSL, aplicación y llamada, reto… <strong>citando lo que lo delata</strong> en sus piezas.' },
        { icono: I.nota, titulo: 'Su oferta, con nota', texto: 'MaKo lee la oferta de su web con el analista de Offer: sus nueve notas y su puntaje.' },
        { icono: I.texto, titulo: 'El guion de sus reels', texto: 'Al abrir su detalle, MaKo transcribe lo que dice cada reel.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Producción',
      titulo: 'Pasa de la idea a tu anuncio, más rápido',
      items: [
        { icono: I.editar, titulo: 'Tu versión, en Image', texto: 'Sus carruseles y anuncios aparecen en Image para hacer <strong>tu versión editable</strong>, con tu negocio y tu marca.' },
        { icono: I.pagina, titulo: 'Sus páginas, a la vista', texto: 'Cada página con su vista previa, también las que cuelgan de su página de enlaces.' },
        { icono: I.reloj, titulo: 'Lo que todavía no', texto: 'Todavía no revisa solo todos los días: lee al agregar a un competidor y al abrir su ficha.' },
      ],
    },
  ],
};
