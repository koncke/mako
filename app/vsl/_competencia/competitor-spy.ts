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
  metaTitle: 'Competitor Spy de MaKo: lo que publica tu competencia, guardado y leído',
  metaDesc: 'Sumas a tus competidores con su web, su Instagram y su YouTube, y MaKo lee lo que publican: su oferta, el funnel que usan y el guion de sus reels. Guardas sus anuncios con un clic desde Chrome.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Competitor Spy: lo que hace tu competencia',
      titulo: 'Lo que publica tu competencia, guardado y leído.',
      bajada: 'Sumas a cada competidor con su web, su Instagram y su YouTube. MaKo lee lo que publica, te dice <strong>qué funnel usa</strong> y guarda los anuncios que encuentras.',
      puntos: ['Guarda sus anuncios de Meta con un clic desde Chrome', 'Su oferta, leída y con su nota'],
      visual: { tipo: 'propio', slug: 'competitor-spy' },
    },
    {
      tipo: 'contraste',
      titulo: 'Tu nueva forma de mirar a la competencia',
      sin: {
        titulo: 'Antes…',
        texto: 'Capturas sueltas en el chat, links que ya no abren y nadie recuerda desde cuándo corría ese anuncio.',
      },
      con: {
        titulo: 'Con Competitor Spy',
        texto: 'Cada competidor con sus piezas, y cada pieza con la fecha desde que MaKo la vio.',
      },
    },
    {
      // La cabeza «Research & Inspiration» de la referencia: sin tarjetas.
      tipo: 'tarjetas',
      etiqueta: 'Investigación',
      titulo: 'Lo que le funciona a tu competencia, a la vista.',
      bajada: 'Guardas sus anuncios y sigues cada uno de sus canales. Todo queda en la ficha de su competidor, con la fecha desde que MaKo lo vio.',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Anuncios',
      titulo: 'Guarda los anuncios de donde los veas',
      items: [
        { icono: I.guardar, titulo: 'Desde Chrome, con un clic', texto: 'En la Biblioteca de Anuncios de Meta, con la extensión de MaKo, tocas <strong>«Guardar en Spy»</strong> y se guardan sus anuncios.' },
        { icono: I.pegar, titulo: 'O lo pegas', texto: 'Pegas el anuncio en la ficha de su competidor y queda guardado ahí.' },
        { icono: I.reloj, titulo: 'Desde cuándo está a la vista', texto: 'Cada pieza dice desde cuándo la ve MaKo: lo que dura mucho al aire es lo que le funciona.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Competidores',
      titulo: 'Cada competidor, canal por canal',
      items: [
        { icono: I.personas, titulo: 'Sumas a tus competidores', texto: 'Cada uno con sus canales: su web, su Instagram y su YouTube.' },
        { icono: I.web, titulo: 'MaKo lee lo que publican', texto: 'Su sitio, sus reels y sus videos, con los números que pudo medir. Lo que no pudo leer lo dice: nunca es un cero.' },
        { icono: I.idea, titulo: 'Te sugiere a quién mirar', texto: 'Competidores que MaKo ya mira, para sumarlos sin gastar nada.' },
      ],
    },
    {
      tipo: 'pasos',
      etiqueta: 'Extensión de Chrome',
      titulo: 'Guardar en Spy, desde Chrome',
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
      etiqueta: 'Análisis y producción',
      titulo: 'Entiende lo que le funciona, y haz tu versión.',
      bajada: 'MaKo lee el funnel, la oferta y el guion de lo que publica tu competencia, y sus anuncios te esperan en Image para hacer el tuyo.',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Análisis',
      titulo: 'Lo que hay detrás de cada pieza',
      items: [
        { icono: I.embudo, titulo: 'Qué funnel usa', texto: 'Evento presencial, webinar, VSL, aplicación y llamada, reto… <strong>citando lo que lo delata</strong> en sus piezas.' },
        { icono: I.nota, titulo: 'Su oferta, con nota', texto: 'MaKo lee la oferta de su web con el analista de Offer: sus nueve notas y su puntaje.' },
        { icono: I.texto, titulo: 'El guion de sus reels', texto: 'Al abrir su detalle, MaKo transcribe lo que dice cada reel.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Producción',
      titulo: 'Y lo que haces con lo que ves',
      items: [
        { icono: I.editar, titulo: 'Tu versión, en Image', texto: 'Sus carruseles y anuncios aparecen en Image para hacer <strong>tu versión editable</strong>, con tu negocio y tu marca.' },
        { icono: I.pagina, titulo: 'Sus páginas, a la vista', texto: 'Cada página con su vista previa, también las que cuelgan de su página de enlaces.' },
        { icono: I.reloj, titulo: 'Lo que todavía no', texto: 'Todavía no revisa solo todos los días: lee al agregar a un competidor y al abrir su ficha.' },
      ],
    },
  ],
};
