// =============================================================================
// /vsl/offer — Offer, tu oferta trabajada en un chat, con la ESTRUCTURA y el DISEÑO de la página de Atlas AI de DFY
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el diseño):
//   https://go.doneforyou.com/offer-formula  (leída el 11/11/2026 con Chromium, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/offer.tsx; los valores medidos de la referencia (fuentes, escala, colores, espacios),
// en docs/diseno/landings-competencia/offer.md.
// Su orden, que se respeta aquí: «For Anyone Tired of Guessing What to Sell» (la cejilla) → «How I Build Profitable OFFERS
// in Hours — Not Months», su bajada, el VSL y el botón → (su precio) → «This Is Exactly How…»: mientras todos usan la IA
// para sacar posts, los que la usan bien arman su oferta → «Without…» (sin buscar nicho, sin seguidores, sin copywriter,
// sin construir lo que nadie quiere), en la MISMA tarjeta → «Here's Everything You're Getting» (seis piezas) y el botón →
// (su calificación y su garantía de 30 días) → el botón final. Por qué ganó: docs/competencia/landings-por-funcion.md → «Offer».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su VSL no va: Offer no tiene uno. En su lugar (14/11/2026), la grabación REAL de la pestaña: el chat pregunta, se contesta y la
//     oferta se arma al costado hasta el PDF con su nota (banco C:/dev/bancos-portada/banco-offer, un negocio ficticio de las plantillas).
//   · Su precio (7 días gratis, después US$97), su cupón y su garantía de devolución de 30 días NO van: ninguna landing de
//     /vsl escribe un precio a mano y MaKo no tiene una garantía. El cierre es la llamada.
//   · Su «4.7 / 5 de 398 alumnos» es suyo: en ese lugar va la prueba de MaKo, el caso de Mauricio (el mismo de todas).
//   · Su «en horas, no en meses» y su «en menos de una hora» son tiempos suyos: no se dicen. Tampoco su «$391 billion».
//   · Sus seis piezas son un curso y cinco plantillas; las de MaKo salen de lo que Offer hace hoy (lib/funciones-mako.ts,
//     keys: ['offer'], estado «parcial»): las plantillas de «Nueva oferta» (lib/offer-plantillas.ts), el chat que pregunta
//     por cada pieza (lib/offer-marco.ts → PIEZAS), la rúbrica (DIMENSIONES), la oferta nueva sin datos inventados
//     (MARCA_COMPLETAR), el cambio como experimento («Probarlo», app/offer/Conclusion.tsx) y el PDF y «Guardar».
//   · Con el diseño copiado (11/11/2026): el «sin / con» se escribe como los párrafos de su tarjeta blanca («While everyone
//     else is using AI…»), y lo que no necesitas, como su lista de una línea por renglón («Without…»): por eso los textos de
//     esos dos bloques se acortaron y el «sin / con» perdió su etiqueta (la tarjeta de la referencia no tiene).
// Lo que NO se promete: que Offer cambie el precio que cobras (eso se corrige en el Second Brain, `noHace`). La palabra de
// la pieza de devolución de la oferta del dueño no se escribe: el test de /vsl la toma por una promesa de MaKo.
//
// LOS TEXTOS DE DONE FOR YOU, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «For Anyone Tired of Guessing What to Sell» (ya estaba); «How I Build Profitable OFFERS in Hours — Not Months» →
//     «Cómo armar tu OFERTA en una conversación, no en meses» (sin «rentables» ni «en horas»: no están medidos);
//   · «…Even If You've Never Sold Online, Don't Have A Niche, Or Hate Writing Sales Copy» → «aunque nunca hayas vendido en
//     línea, no tengas un nicho u odies escribir textos de venta» (sin «In Minutes»);
//   · «While everyone else is using AI to crank out posts, "build a following," or chase the next viral trend…» y
//     «…clarity — before they even worry about traffic», con su lista «Without spending months trying to "find your
//     niche"», «Without needing followers, funnels, or ads», «Without hiring a copywriter or marketing agency», «Without
//     wasting time building things people don't want», cada una con lo que hace MaKo;
//   · «Here's Everything You're Getting» / «Here's the complete system that helps entrepreneurs, coaches, and creators stop
//     guessing what to sell» (sin «profitable offers in hours»), y sus piezas: «Atlas AI Offer Builder» → «Tu arquitecto de
//     ofertas con IA» («does the heavy lifting»), «AI Offer Packaging Blueprint» → «Tu oferta, empaquetada como un
//     profesional» (el nombre y la promesa), «Fast Action Sales System» → «Prueba y valida tu oferta». Su masterclass, su
//     «Traffic-To-Offer», su precio y su garantía no van.
// =============================================================================

import { DIMENSIONES, PIEZAS, PUNTOS_CONTROL } from '@/lib/offer-marco';
import { PLANTILLAS_OFERTA } from '@/lib/offer-plantillas';
import type { LandingCompetencia } from './tipos';

const I = {
  oferta: ['M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z'],
  cliente: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  clip: ['M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5'],
  lapiz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  matraz: ['M9 3l6 0', 'M10 9l4 0', 'M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6'],
  plantilla: ['M4 4h16v6h-16z', 'M4 14h6v6h-6z', 'M14 14h6v6h-6z'],
  chat: ['M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1', 'M8 10h8', 'M8 13h5'],
  nota: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 12l3 -3', 'M12 7v.01', 'M7 12h.01', 'M17 12h.01'],
  pdf: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 13h6', 'M9 17h4'],
};

// Lo que Offer TRAE, contado del código.
const N_PIEZAS = PIEZAS.length;
const N_DIMENSIONES = DIMENSIONES.length;
const N_PUNTOS = PUNTOS_CONTROL.length;
const N_PLANTILLAS = PLANTILLAS_OFERTA.length;
/** Las primeras partes de la rúbrica, con el nombre que se ve en pantalla. */
/** Algunas plantillas de «Nueva oferta», con el nombre que se ve en pantalla. */
const PLANTILLAS_EJEMPLO = ['cohorte-rapida', 'servicio-hecho', 'preventa-etapas', 'continuidad-egresados']
  .map((id) => PLANTILLAS_OFERTA.find((p) => p.id === id)?.nombre).filter(Boolean).join(', ');
const DIM_EJEMPLO = DIMENSIONES.slice(0, 3).map((d) => d.label.toLowerCase()).join(', ');

export const LANDING_OFFER: LandingCompetencia = {
  slug: 'offer',
  nombre: 'Offer',
  icono: I.oferta,
  referencia: { nombre: 'Atlas AI de Done For You — The Offer Creation Formula', url: 'https://go.doneforyou.com/offer-formula', leida: '2026-11-14' },
  metaTitle: 'Offer de MaKo: cómo armar tu OFERTA en una conversación, no en meses',
  metaDesc: `MaKo te pregunta por cada pieza de tu oferta, la diagnostica con una rúbrica de ${N_DIMENSIONES} partes y te escribe la oferta nueva, descargable en PDF, aunque nunca hayas vendido en línea, no tengas un nicho u odies escribir textos de venta.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Para quien ya se cansó de adivinar qué vender',
      titulo: 'Cómo armar tu OFERTA en una conversación, no en meses',
      bajada: `MaKo te pregunta por cada pieza, la diagnostica con una rúbrica y te escribe la oferta nueva en un PDF, <strong>aunque nunca hayas vendido en línea, no tengas un nicho u odies escribir textos de venta</strong>.`,
      // Los dos primeros, en su tarjeta (donde la referencia pone su precio); el tercero, debajo del video (su «The Offer Creation
      // Formula combines…»). El diseño los ubica así: ./disenos/offer.tsx.
      puntos: [
        `${N_PIEZAS} piezas de una oferta, de tu cliente a tu precio`,
        `Una rúbrica de ${N_DIMENSIONES} partes, cada una con su nota de 0 a 10`,
        `Offer junta un chat que te pregunta por cada pieza, una rúbrica de ${N_DIMENSIONES} partes que la puntúa y la oferta nueva en un PDF. Tú contestas y tu oferta se arma al costado, aunque nunca hayas armado un funnel ni escrito un texto de venta.`,
      ],
      visual: { tipo: 'propio', slug: 'offer' },
    },
    {
      tipo: 'contraste',
      titulo: 'Primero la oferta. Después, a quién se la muestras.',
      sin: {
        titulo: 'Mientras todos usan la IA para sacar posts, «hacer comunidad» o perseguir la próxima tendencia viral,',
        texto: 'la oferta sigue igual: una promesa vaga, un precio que no sale del valor y nadie que te diga qué le falta.',
      },
      con: {
        titulo: 'Con MaKo, primero trabajas tu oferta, antes de preocuparte por el tráfico:',
        texto: `te pregunta por cada pieza —tu cliente, el problema, el resultado, el precio—, la diagnostica con una rúbrica de ${N_DIMENSIONES} partes y te escribe la oferta nueva. Ves qué ya está bien y qué conviene subir, parte por parte.`,
      },
    },
    {
      // Como su lista «Without…»: una línea por renglón, dentro de la misma tarjeta que el «sin / con».
      tipo: 'tarjetas',
      titulo: 'Para tener claridad en tu oferta:',
      // Su párrafo de cierre, debajo de la lista («People using The Offer Creation Formula are creating profitable offers…»).
      bajada: 'Con Offer armas tu oferta, la pruebas como experimento y la guardas en el funnel donde la vendes, en vez de seguir acumulando contenido.',
      columnas: 2,
      items: [
        { icono: I.cliente, titulo: 'Sin pasar meses tratando de «encontrar tu nicho»', texto: 'la rúbrica mide qué tan específico es tu cliente ideal.' },
        { icono: I.clip, titulo: 'Sin necesitar seguidores, funnels ni anuncios', texto: 'partes de tu guion, tu propuesta o el link de tu landing.' },
        { icono: I.lapiz, titulo: 'Sin contratar a un copywriter ni a una agencia de marketing', texto: 'MaKo la escribe y cada versión queda guardada.' },
        { icono: I.matraz, titulo: 'Sin perder tiempo construyendo algo que nadie quiere', texto: 'cada cambio lo pruebas como experimento.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Esto es todo lo que tienes',
      // Su subtítulo de 42 px («Inside The Offer Creation Formula + Atlas AI Tool»).
      etiqueta: 'Dentro de Offer, en MaKo',
      bajada: 'El sistema completo que ayuda a emprendedores, coaches y creadores a dejar de adivinar qué vender.',
      cta: true,
      items: [
        { icono: I.plantilla, titulo: `${N_PLANTILLAS} plantillas con su ejemplo completo`, texto: `${PLANTILLAS_EJEMPLO}…: cada una con su forma y un ejemplo armado de punta a punta.` },
        { icono: I.chat, titulo: 'Tu arquitecto de ofertas con IA', texto: 'Hace el trabajo pesado: te pregunta por cada pieza de tu oferta, de tu cliente a tu precio. Le puedes escribir, adjuntar un documento o mandarle una nota de voz.' },
        { icono: I.nota, titulo: 'El diagnóstico, con su nota', texto: `${N_DIMENSIONES} partes —${DIM_EJEMPLO} y más— con su nota de 0 a 10, lo que ya está bien y lo que conviene subir. Y ${N_PUNTOS} chequeos antes de decirte que está lista para vender.` },
        { icono: I.lapiz, titulo: 'Tu oferta, empaquetada como un profesional', texto: 'El nombre, la frase, la ruta por fases, lo que incluye y la inversión. Lo que no le dijiste queda <strong>marcado para completar</strong>: MaKo no inventa casos, cifras ni cupos.' },
        { icono: I.matraz, titulo: 'Prueba y valida tu oferta', texto: 'Los tres cambios con más impacto, del más importante al menos. Con «Probarlo» abres el experimento para medirlo.' },
        { icono: I.pdf, titulo: 'Tu PDF, y otro para tu cliente', texto: 'Descargas el PDF con el diagnóstico y la oferta, y otro con la oferta sola para mostrársela a tu cliente. Y la guardas en el funnel donde la vendes.' },
      ],
    },
    { tipo: 'caso' },
  ],
};
