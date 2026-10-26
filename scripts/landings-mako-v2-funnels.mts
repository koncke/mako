// =============================================================================
// Las landings de MaKo por funcionalidad y por avatar, con los ángulos de la competencia (25/10/2026, tanda 2)
// =============================================================================
// Martín (25/10): «investigues al 100% como lo venden otros». La investigación del Cerebro propone, para cada landing, su
// titular, su ángulo y su prueba (§6b). Esto las arma con las MISMAS piezas y el mismo diseño de la principal
// (scripts/landings-mako-v2.mts: el de 100ads, con los colores de MaKo), cada una con su portada y sus secciones propias, y
// con lo común (tu IA, los precios, las preguntas, el cierre y el pie) igual en todas.
//
// SON DOCUMENTOS NUEVOS, con su slug (mako-…): las ocho de la tanda del 23/10 (crear-landings, coaches…) pueden estar en
// anuncios corriendo, y no se pisan. Cada slug está en LANDINGS_MAKO (lib/origen-cuenta.ts) con su avatar o su
// funcionalidad: lo lee el alta de la cuenta.
//
// LAS REGLAS son las de la principal (ver su cabecera): nada inventado, el precio nunca escrito a mano, «tú», y sólo lo que
// MaKo hace hoy. Por eso dos se arman y NO se suben (`pausada`, con su motivo): la del media buyer (todavía no está en
// producción) y la de avatares con IA (en pausa desde el 23/10: no se confirmó que un cliente lo use).
//
// Uso (como la principal; `--subir` escribe en PRODUCCIÓN y pide el permiso de Martín):
//   node --conditions=react-server --import tsx scripts/landings-mako-v2-funnels.mts --salida <carpeta> [--solo <slug>]
//   node --conditions=react-server --import tsx scripts/landings-mako-v2-funnels.mts --subir [--solo <slug>] [--doc <id>]
// =============================================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANDINGS_MAKO } from '../lib/origen-cuenta';
import {
  CSS_MAKO_V2, PREGUNTAS, botones, caso, cierre, circuito, documentoDeSecciones, encabezado, esc, nav, pie, precios, preguntasCon, tuIa,
  type DocumentoLanding,
} from './landings-mako-v2.mjs';

type Item = [string, string];

// ─────────────────────────────────────────────────────────────────────────────
// Los bloques (los de la principal, con lo que cambia en cada landing)
// ─────────────────────────────────────────────────────────────────────────────

function portada(slug: string, etiqueta: string, h1: string, serif: string, bajada: string): string {
  return `<section class="mkv mkv-portada" id="inicio"><div class="mkv-in">
    <p class="mkv-etiqueta mkv-centro">${esc(etiqueta)}</p>
    <h1 class="mkv-h1">${esc(h1)}<br><em class="mkv-serif">${esc(serif)}</em></h1>
    <p class="mkv-portada-bajada">${esc(bajada)}</p>
    ${botones(slug)}
  </div></section>`;
}

function tarjetas(id: string, etiqueta: string, titulo: string, bajada: string, items: Item[], opts: { gris?: boolean; remate?: string } = {}): string {
  const cols = items.length === 2 || items.length === 4 ? 2 : 3;
  return `<section class="mkv mkv-sec${opts.gris ? ' mkv-sec-gris' : ''}" id="${id}"><div class="mkv-in">
    ${encabezado(etiqueta, titulo, bajada)}
    <div class="mkv-grilla mkv-grilla-${cols}">
      ${items.map(([t, x]) => `<div class="mkv-tarjeta${opts.gris ? ' mkv-tarjeta-blanca' : ''}"><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></div>`).join('\n      ')}
    </div>${opts.remate ? `\n    <p class="mkv-remate"><em class="mkv-serif">${esc(opts.remate)}</em></p>` : ''}
  </div></section>`;
}

function pasos(id: string, etiqueta: string, titulo: string, bajada: string, items: Item[]): string {
  return `<section class="mkv mkv-sec mkv-sec-gris" id="${id}"><div class="mkv-in">
    ${encabezado(etiqueta, titulo, bajada)}
    <div class="mkv-grilla mkv-grilla-${items.length === 4 ? 2 : 3}">
      ${items.map(([t, x], i) => `<div class="mkv-tarjeta mkv-tarjeta-blanca"><p class="mkv-numero">Paso ${i + 1}</p><p class="mkv-tarjeta-titulo">${esc(t)}</p><p class="mkv-texto">${esc(x)}</p></div>`).join('\n      ')}
    </div>
  </div></section>`;
}

/** Una conversación de ejemplo (sin cifras: es cómo conversa, no un resultado), y cómo termina. */
function chat(id: string, etiqueta: string, titulo: string, bajada: string, mensajes: Array<['el' | 'mako', string]>, final: string): string {
  return `<section class="mkv mkv-sec" id="${id}"><div class="mkv-in">
    ${encabezado(etiqueta, titulo, bajada)}
    <div class="mkv-paso-tarjeta mkv-chat mkv-chat-grande">
      <p class="mkv-mini">WhatsApp · ejemplo de conversación</p>
      ${mensajes.map(([quien, t]) => `<p class="mkv-burbuja mkv-burbuja-${quien}">${esc(t)}</p>`).join('\n      ')}
      <p class="mkv-chat-final">${esc(final)}</p>
    </div>
  </div></section>`;
}

/** Una comparación en tabla: lo de afuera contra MaKo, sin marcas ni precios de MaKo escritos. */
function comparacion(id: string, etiqueta: string, titulo: string, bajada: string, cabeza: [string, string, string], filas: Array<[string, string, string]>): string {
  return `<section class="mkv mkv-sec" id="${id}"><div class="mkv-in">
    ${encabezado(etiqueta, titulo, bajada)}
    <div class="mkv-tabla-caja"><table class="mkv-tabla mkv-tabla-3">
      <thead><tr>${cabeza.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${filas.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="mkv-tabla-mako-celda">${esc(c)}</td></tr>`).join('\n        ')}
      </tbody>
    </table></div>
  </div></section>`;
}

/** La prueba de que lo dice en serio: una tarjeta grande con una frase cierta. */
function prueba(id: string, etiqueta: string, titulo: string, texto: string): string {
  return `<section class="mkv mkv-sec mkv-sec-gris" id="${id}"><div class="mkv-in">
    <div class="mkv-tarjeta mkv-tarjeta-blanca mkv-prueba"><p class="mkv-etiqueta">${esc(etiqueta)}</p><p class="mkv-cifra">${esc(titulo)}</p><p class="mkv-texto">${esc(texto)}</p></div>
  </div></section>`;
}

const q = (...claves: string[]): Array<[string, string]> => claves.map((k) => {
  const p = PREGUNTAS[k];
  if (!p) throw new Error(`no está la pregunta ${k}`);
  return p;
});

// ─────────────────────────────────────────────────────────────────────────────
// Las landings (§6b de la investigación del 25/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

export type LandingFunnel = {
  slug: string;
  titulo: string;
  seo: string;
  seoDescripcion: string;
  /** No se sube: lo que promete todavía no está para los clientes. */
  pausada?: string;
  /** Las secciones propias (entre la portada y lo común). */
  propias: (slug: string) => string[];
  portada: { etiqueta: string; h1: string; serif: string; bajada: string };
  /** Las preguntas: las del catálogo (claves) y las suyas. */
  preguntas: Array<[string, string]>;
  /** Con el caso de Mauricio (las que venden llamadas). */
  conCaso?: boolean;
};

const DOLOR_LLAMADAS: Item[] = [
  ['El anuncio que vendía se quemó', 'La semana pasada funcionaba. Hoy cuesta el doble y no tienes el siguiente listo.'],
  ['No saber qué anuncio trajo la venta', 'Meta te dice clics y tu CRM te dice ventas. Nadie te dice cuál llevó a cuál.'],
  ['El mensaje que nadie contestó', 'Alguien escribió por tu anuncio de noche y para la mañana ya habló con otro.'],
];

export const FUNNELS: readonly LandingFunnel[] = [
  {
    slug: 'mako-paginas-de-venta',
    titulo: 'MaKo · Páginas de venta',
    seo: 'MaKo · Tu página de venta armada con IA',
    seoDescripcion: 'Cuéntale a MaKo qué vendes y sal con tu página de venta armada, editable y publicada con tu dominio.',
    portada: { etiqueta: 'Páginas de venta con IA', h1: 'Cuéntale a MaKo qué vendes', serif: 'y sal con tu página armada.', bajada: 'MaKo escribe tu página de venta con tu oferta, la editas como un documento y la publicas con tu dominio. Después ves quién la visitó y quién vio tu video.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', 'Una página que tarda semanas es una campaña que no sale.', 'Lo que le pasa a casi todos los que venden con anuncios.', [
        ['El programador que no contesta', 'Cada cambio de texto es un pedido y una espera.'],
        ['La plantilla que no habla de tu oferta', 'Llenas los huecos y queda igual a todas.'],
        ['No saber qué pasa adentro', 'Te entran visitas y no sabes quién vio el video ni dónde se fue.'],
      ]),
      pasos('como-funciona', 'Cómo funciona', 'De tu oferta a tu página, en tres pasos.', 'Sin programador y sin plantillas que llenar.', [
        ['Cuéntale qué vendes', 'Tu oferta, a quién se la vendes y qué promete.'],
        ['Edítala como un documento', 'Cambias un texto, una imagen o una sección a la vista, o le pides a MaKo que lo haga.'],
        ['Publícala y mídela', 'Con tu dominio, y con el Pixel de MaKo para saber quién la vio.'],
      ]),
      tarjetas('incluye', 'Lo que incluye', 'Todo lo que necesita una página que vende.', 'Y sigue siendo tuya: la cambias cuando quieras.', [
        ['Secciones con diseño', 'Bloques listos para tu video, tus testimonios y tus precios.'],
        ['Tu dominio', 'La publicas con tu propio dominio.'],
        ['Quién vio tu video', 'Sabes quién llegó a la página y hasta dónde vio el video.'],
        ['El diagnóstico de tu página actual', 'Si ya tienes una, MaKo te dice qué arreglar.'],
      ]),
      prueba('prueba', 'La prueba', 'Esta página la armó MaKo.', 'La escribimos con MaKo y la editamos en el mismo editor que vas a usar tú.'),
    ],
    preguntas: [
      ['¿Necesito saber diseñar o programar?', 'No. Le cuentas a MaKo qué vendes y arma la página. Cambias lo que quieras a la vista, como en un documento.'],
      ['¿Puedo usar mi dominio?', 'Sí. La publicas con tu propio dominio.'],
      ['¿Y si ya tengo una página?', 'MaKo la analiza y te dice qué arreglar. También puedes armar una nueva al lado y comparar.'],
      ...q('ia', 'permanencia'),
    ],
  },
  {
    slug: 'mako-setter',
    titulo: 'MaKo · Setter para WhatsApp',
    seo: 'MaKo · Ningún contacto esperando hasta mañana',
    seoDescripcion: 'MaKo contesta cada WhatsApp, hace el seguimiento hasta que responden y le pasa tu agenda al que califica.',
    portada: { etiqueta: 'Setter con IA para WhatsApp', h1: 'Ningún contacto esperando', serif: 'hasta mañana.', bajada: 'MaKo le contesta a cada persona que te escribe, le hace el seguimiento hasta que responde y, si califica, le pasa tu agenda. Sale de tu número, como si lo mandaras tú.' },
    propias: () => [
      chat('conversa', 'Así conversa', 'En dos respuestas, la llamada queda en tu agenda.', 'Pregunta lo justo para saber si califica, y no insiste con quien no.', [
        ['el', 'Hola, vi tu anuncio. ¿Cuánto cuesta?'],
        ['mako', '¡Hola! Depende de lo que necesites. ¿Ya vendes por llamada o estás empezando?'],
        ['el', 'Ya vendo, pero me cuesta llenar la agenda.'],
        ['mako', 'Te entiendo. Lo vemos en una llamada corta: aquí eliges el horario que te quede bien.'],
      ], 'Llamada agendada'),
      comparacion('contra', 'Contra un setter', 'Lo que hace un setter, sin que tengas que entrenar a otro.', 'Un setter cuesta entre US$800 y US$2.000 al mes, y cuando se va, vuelves a empezar.', ['', 'Un setter', 'MaKo'], [
        ['Contesta de madrugada', 'Si está despierto', 'Sí'],
        ['Hace el seguimiento', 'Si se acuerda', 'Con los mensajes que tú dibujas'],
        ['Cuando se va', 'Entrenas a otro', 'No se va'],
      ]),
      pasos('como-funciona', 'Cómo se arma', 'Lo dibujas una vez y queda andando.', 'Tú ves cada conversación y entras cuando quieras.', [
        ['Dibuja cómo le escribes', 'Los mensajes de apertura y de seguimiento, una sola vez.'],
        ['Conecta tu WhatsApp', 'Tu número de siempre, con un código QR.'],
        ['MaKo hace el resto', 'Contesta, hace el seguimiento y agenda.'],
      ]),
    ],
    preguntas: q('cierra', 'numero', 'bloqueo', 'equivoca', 'ia', 'permanencia'),
  },
  {
    slug: 'mako-tableros',
    titulo: 'MaKo · Tableros',
    seo: 'MaKo · Sabe qué anuncio te trajo cada venta',
    seoDescripcion: 'Tus anuncios, tus páginas, tus llamadas y tus cobros en un mismo lugar: qué anuncio trae clientes que pagan.',
    conCaso: true,
    portada: { etiqueta: 'Tableros de tu negocio', h1: 'Sabe qué anuncio', serif: 'te trajo cada venta.', bajada: 'Tus anuncios, tus páginas, tus llamadas y tus cobros en un mismo lugar. Ves qué anuncio trae clientes que pagan, no sólo clics.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', '¿Te suena?', 'Lo que le pasa a casi todos los que pautan.', [
        ['Meta te dice clics', 'Y tu CRM te dice ventas. Ninguno te dice cuál llevó a cuál.'],
        ['Planillas que nadie actualiza', 'Cada número vive en otra pestaña.'],
        ['Decidir a ciegas', 'Subes el presupuesto y esperas a ver qué pasa.'],
      ]),
      circuito(),
      prueba('pregunta', 'Y si no quieres mirar tableros', 'Pregúntale a MaKo cómo va tu negocio.', 'Le escribes y te contesta con tus números de hoy.'),
    ],
    preguntas: q('tecnologia', 'ia', 'permanencia', 'datos'),
  },
  {
    slug: 'mako-creativos',
    titulo: 'MaKo · Creativos',
    seo: 'MaKo · Cuando el anuncio se cansa, ya tienes los siguientes',
    seoDescripcion: 'MaKo arma los ángulos de venta de tu oferta y de cada uno saca imágenes y videos con tu marca para tus anuncios.',
    portada: { etiqueta: 'Fábrica de creativos con IA', h1: 'Cuando el anuncio que vendía se cansa,', serif: 'ya tienes los siguientes.', bajada: 'MaKo arma los ángulos de venta de tu oferta y de cada uno saca imágenes y videos con tu marca, listos para tus anuncios.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', 'Meta se come los anuncios más rápido de lo que los haces.', 'No es tu producto: es que produces de a uno.', [
        ['El anuncio que se quema', 'Lo que vendía la semana pasada hoy cuesta el doble.'],
        ['Hacerlos de a uno', 'Horas para sacar cinco piezas. Mañana necesitas otras cinco.'],
        ['El diseñador caro y lento', 'Unos US$1.500 al mes por un puñado de piezas, y cada corrección tarda días.'],
      ], { remate: 'Más ángulos para probar, menos adivinanza.' }),
      pasos('como-funciona', 'Cómo funciona', 'De tu oferta a tus anuncios.', 'Lo que creas queda guardado en MaKo para tu próxima campaña.', [
        ['Cuéntale tu oferta', 'A quién le vendes y por qué te compran.'],
        ['MaKo arma los ángulos', 'Para cada tipo de cliente, sus motivos de compra.'],
        ['Salen las piezas', 'Imágenes y videos con tu marca, de cada ángulo.'],
      ]),
    ],
    preguntas: [
      ['¿Necesito saber diseñar o escribir prompts?', 'No. Le cuentas a MaKo tu oferta y arma los ángulos y las piezas. Tú eliges cuáles usar.'],
      ...q('ia', 'permanencia', 'datos'),
    ],
  },
  {
    slug: 'mako-avatares',
    titulo: 'MaKo · Avatares con IA',
    seo: 'MaKo · Videos con tu marca sin grabarte cada vez',
    seoDescripcion: 'Escribes el guion y MaKo arma el video con tu avatar. Tú lo revisas antes de usarlo en tus anuncios.',
    pausada: 'En pausa desde el 23/10 (Ventas): no se confirmó que un cliente use AI Avatar.',
    portada: { etiqueta: 'Avatares con IA', h1: 'Videos con tu marca', serif: 'sin grabarte cada vez.', bajada: 'Escribes el guion y MaKo arma el video con tu avatar. Tú lo revisas antes de usarlo en tus anuncios.' },
    propias: () => [
      pasos('como-funciona', 'Cómo funciona', 'Del guion al video.', 'Siempre lo apruebas tú antes de que salga.', [
        ['Escribe el guion', 'O pídele a MaKo que lo arme con tu oferta.'],
        ['MaKo arma el video', 'Con tu avatar y tu marca.'],
        ['Revísalo y úsalo', 'Lo editas ahí mismo y lo usas en tus anuncios.'],
      ]),
    ],
    preguntas: q('ia', 'permanencia', 'datos'),
  },
  {
    slug: 'mako-media-buyer',
    titulo: 'MaKo · Media buyer',
    seo: 'MaKo · Tu media buyer revisa tu cuenta y te pregunta antes de tocar el dinero',
    seoDescripcion: 'Pones los límites; MaKo propone cada cambio con su porqué y lo puedes deshacer. Decide con las llamadas y las ventas de tu CRM.',
    pausada: 'El media buyer todavía no está en producción (el Cerebro, 25/10).',
    portada: { etiqueta: 'Media buyer con IA', h1: 'Tu media buyer nuevo revisa tu cuenta todos los días', serif: 'y te pregunta antes de tocar el dinero.', bajada: 'Pones los límites; MaKo propone cada cambio, te explica por qué y lo puedes deshacer. Decide con las llamadas y las ventas de tu CRM, no con los clics.' },
    propias: () => [
      tarjetas('control', 'El control', 'Tú pones los límites. MaKo los respeta.', 'Cuánto puede subir por día, el gasto máximo y un interruptor que apaga todo.', [
        ['Revisar o aplicar', 'Eliges si te pregunta antes de cada cambio o si los aplica dentro de tus límites.'],
        ['Cada cambio, explicado', 'Queda anotado con el porqué y lo puedes deshacer.'],
        ['Mira ventas, no clics', 'Decide con las llamadas agendadas y las ventas de tu CRM.'],
      ]),
      circuito(),
    ],
    preguntas: [
      ['¿Cada cuánto mira mi cuenta?', 'Una vez por día.'],
      ['¿Para quién no es?', 'Si no cargas tus ventas en el CRM, decide sólo con lo que reporta Meta.'],
      ...q('ia', 'permanencia'),
    ],
  },
  {
    slug: 'mako-closing',
    titulo: 'MaKo · Análisis de llamadas',
    seo: 'MaKo · Sabe en qué parte se te cae cada venta',
    seoDescripcion: 'MaKo escucha tus llamadas grabadas con Fathom, puntúa cada parte del diagnóstico al cierre y te dice qué mejorar.',
    portada: { etiqueta: 'Análisis de llamadas de venta', h1: 'Sabe en qué parte', serif: 'se te cae cada venta.', bajada: 'MaKo escucha tus llamadas grabadas con Fathom, puntúa cada parte, del diagnóstico al cierre, y te dice qué mejorar en la próxima.' },
    propias: () => [
      tarjetas('para-quien', 'Para quién es', 'Para el que cierra y para el que dirige a los que cierran.', 'El mismo criterio para todas las llamadas.', [
        ['Si cierras tú', 'Ves en qué parte de la llamada se enfría el cliente y qué objeción no respondiste.'],
        ['Si tienes closers', 'Comparas las llamadas de tu equipo con el mismo criterio.'],
      ]),
      pasos('como-funciona', 'Cómo funciona', 'Grabas como siempre. MaKo hace el resto.', 'Va en MaKo Pro.', [
        ['Conecta Fathom', 'Graba tus llamadas como siempre.'],
        ['MaKo las analiza', 'Siete partes, del diagnóstico a los siguientes pasos, con su puntaje.'],
        ['Mejora la próxima', 'Con lo que faltó en cada una.'],
      ]),
    ],
    preguntas: [
      ['¿Necesito Fathom?', 'Sí. MaKo analiza las llamadas que graba Fathom.'],
      ...q('ia', 'permanencia', 'datos'),
    ],
  },
  {
    slug: 'mako-cursos',
    titulo: 'MaKo · Cursos y comunidad',
    seo: 'MaKo · Tu escuela y tu comunidad, cobrando con tu Mercado Pago',
    seoDescripcion: 'Tu curso y tu comunidad en un solo lugar, cobrando con tu propia cuenta. MaKo no se queda con una comisión de tus ventas.',
    portada: { etiqueta: 'Cursos y comunidad', h1: 'Tu escuela y tu comunidad,', serif: 'cobrando con tu Mercado Pago.', bajada: 'Tus alumnos entran a tu curso y a tu comunidad en un solo lugar, y les cobras con tu propia cuenta de Mercado Pago o de Stripe. MaKo no se queda con una comisión de tus ventas.' },
    propias: () => [
      pasos('camino', 'El camino completo', 'Captar, vender, enseñar y retener, en un solo lugar.', 'Otras plataformas se quedan con un porcentaje de cada venta. Aquí cobras con tu cuenta.', [
        ['Captar', 'Tu página y tus anuncios traen a los interesados.'],
        ['Vender', 'MaKo les contesta y los lleva a la compra.'],
        ['Enseñar', 'Tu curso, con sus clases y sus tareas.'],
        ['Retener', 'Tu comunidad, para que se queden.'],
      ]),
    ],
    preguntas: [
      ['¿MaKo cobra comisión por mis ventas?', 'No. Les cobras a tus alumnos con tu propia cuenta de Mercado Pago o de Stripe. MaKo cobra su plan, nada más.'],
      ...q('tecnologia', 'ia', 'permanencia'),
    ],
  },
  {
    slug: 'mako-coaches',
    titulo: 'MaKo · Para coaches',
    seo: 'MaKo para coaches · Tú das las sesiones, MaKo te llena la agenda',
    seoDescripcion: 'MaKo contesta tus mensajes de WhatsApp, califica y agenda. Y si vendes un curso, lo cobras con tu Mercado Pago.',
    conCaso: true,
    portada: { etiqueta: 'Para coaches', h1: 'Tú das las sesiones.', serif: 'MaKo te llena la agenda.', bajada: 'Contesta tus mensajes de WhatsApp, califica y agenda. Y si vendes un curso, lo cobras con tu Mercado Pago, sin comisión de plataforma.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', '¿Te suena?', 'Lo que le pasa a casi todos los coaches que venden por llamada.', [
        ['Coach, setter y community manager a la vez', 'Contestas mensajes entre sesión y sesión.'],
        ['La agenda con huecos', 'Los interesados escriben y se enfrían antes de la llamada.'],
        ['Curiosos en vez de clientes', 'Llamadas con gente que no estaba lista para comprar.'],
      ]),
      pasos('como-funciona', 'Cómo funciona', 'Tus mensajes, tu agenda y tus cobros, conectados.', 'Tú das las sesiones; MaKo hace lo de alrededor.', [
        ['MaKo contesta', 'Cada mensaje de WhatsApp, a toda hora.'],
        ['Califica y agenda', 'Al que está listo le pasa tu agenda.'],
        ['Cobras tu curso', 'Con tu Mercado Pago, sin comisión de plataforma.'],
      ]),
    ],
    preguntas: q('cierra', 'numero', 'ia', 'permanencia'),
  },
  {
    slug: 'mako-infoproductores',
    titulo: 'MaKo · Para infoproductores',
    seo: 'MaKo para infoproductores · Más llamadas agendadas por la misma inversión',
    seoDescripcion: 'Creativos nuevos cuando el anterior se cansa, y tableros que miran llamadas y ventas, no clics.',
    conCaso: true,
    portada: { etiqueta: 'Para infoproductores', h1: 'Más llamadas agendadas', serif: 'por la misma inversión en anuncios.', bajada: 'Creativos nuevos cuando el anterior se cansa, y tableros que miran llamadas y ventas, no clics.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', '¿Te suena?', 'Lo que le pasa a casi todos los que venden un programa con anuncios.', DOLOR_LLAMADAS),
      circuito(),
      prueba('cursos', 'Y tu curso, en el mismo lugar', 'Tu escuela y tu comunidad también viven en MaKo.', 'Les cobras a tus alumnos con tu propia cuenta, sin comisión de plataforma.'),
    ],
    preguntas: q('tecnologia', 'cierra', 'ia', 'permanencia'),
  },
  {
    slug: 'mako-inmobiliarias',
    titulo: 'MaKo · Para inmobiliarias',
    seo: 'MaKo para inmobiliarias · Cada interesado atendido al instante',
    seoDescripcion: 'MaKo contesta, pregunta qué busca y agenda la visita. Funciona al lado de tu sistema de propiedades.',
    portada: { etiqueta: 'Para inmobiliarias', h1: 'El que escribe a las once de la noche,', serif: 'atendido antes de que llame a otra inmobiliaria.', bajada: 'MaKo contesta, pregunta qué busca y agenda la visita. Funciona al lado de tu sistema de propiedades: no lo reemplaza.' },
    propias: () => [
      tarjetas('dolor', 'El cuello de botella', '¿Te suena?', 'Lo que le pasa a casi todas las inmobiliarias que pautan.', [
        ['El interesado de la noche', 'Escribe por el anuncio y nadie le contesta hasta el otro día.'],
        ['Las mismas preguntas', 'Precio, zona, si acepta crédito: lo mismo cien veces.'],
        ['El seguimiento que no se hace', 'El interesado se enfría entre mensaje y mensaje.'],
      ]),
      chat('conversa', 'Así conversa', 'Pregunta qué busca y agenda la visita.', 'Tus asesores reciben al que ya está listo para ver la propiedad.', [
        ['el', 'Hola, vi el departamento de dos ambientes. ¿Sigue disponible?'],
        ['mako', '¡Hola! Sí. ¿Lo buscas para vivir o para invertir?'],
        ['el', 'Para vivir, y me gustaría verlo esta semana.'],
        ['mako', 'Perfecto. ¿Te queda bien el sábado por la mañana? Aquí eliges el horario.'],
      ], 'Visita agendada'),
    ],
    preguntas: [
      ['¿Reemplaza a mi sistema de propiedades?', 'No. Sigues usándolo como siempre: MaKo atiende a los interesados y agenda las visitas.'],
      ...q('numero', 'bloqueo', 'ia', 'permanencia'),
    ],
  },
  {
    slug: 'mako-agencias',
    titulo: 'MaKo · Para agencias',
    seo: 'MaKo para agencias · Los negocios de tus clientes, desde tu cuenta',
    seoDescripcion: 'Cada cliente tiene su espacio y paga su plan; tú cobras tu servicio encima, y entras a cada uno sin cambiar de cuenta.',
    portada: { etiqueta: 'Para agencias', h1: 'Maneja los negocios de tus clientes', serif: 'desde tu cuenta de MaKo.', bajada: 'Cada cliente tiene su espacio y paga su plan; tú cobras tu servicio encima. Entras a cada uno sin cambiar de cuenta.' },
    propias: () => [
      tarjetas('como-funciona', 'Cómo funciona', 'Una cuenta para tu agencia, un espacio por cliente.', 'Va en MaKo Pro.', [
        ['Un espacio por cliente', 'Su CRM, su WhatsApp, sus páginas y sus anuncios, separados.'],
        ['Tu equipo adentro', 'Cada persona con su usuario.'],
        ['Tú cobras tu servicio', 'MaKo no se mete en lo que le cobras a tu cliente.'],
      ]),
      prueba('partners', 'MaKo Partners', 'Y si nos recomiendas, sumas crédito.', 'Por cada negocio que traigas a MaKo.'),
    ],
    preguntas: [
      ['¿Para quién no es?', 'Si todavía no tienes clientes, empieza con tu propio negocio y súmalos cuando lleguen.'],
      ...q('equipo', 'ia', 'permanencia'),
    ],
  },
];

/** Las secciones de una landing, en orden: la barra, la portada, las suyas, el caso (si va) y lo común. */
export function seccionesDeFunnel(f: LandingFunnel): Array<[string, string]> {
  const propias = f.propias(f.slug).map((h, i): [string, string] => [`propia${i + 1}`, h]);
  return [
    ['nav', nav(f.slug)],
    ['inicio', portada(f.slug, f.portada.etiqueta, f.portada.h1, f.portada.serif, f.portada.bajada)],
    ...propias,
    ...(f.conCaso ? [['resultados', caso()] as [string, string]] : []),
    ['tu-ia', tuIa()],
    ['planes', precios(f.slug)],
    ['preguntas', preguntasCon(f.preguntas)],
    ['empezar', cierre(f.slug)],
    ['pie', pie()],
  ];
}

export async function documentoDeFunnel(f: LandingFunnel): Promise<DocumentoLanding> {
  return documentoDeSecciones(f.titulo, f.seo, f.seoDescripcion, seccionesDeFunnel(f));
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const esPrincipal = import.meta.url === new URL(`file:///${process.argv[1]?.replace(/\\/g, '/').replace(/^\/+/, '')}`).href;

/** La consola: arma, guarda y sube (sin await de primer nivel: un test importa este módulo). */
async function main(): Promise<void> {
  const solo = arg('--solo');
  const lista = FUNNELS.filter((f) => !solo || f.slug === solo);
  if (solo && !lista.length) throw new Error(`no hay una landing ${solo}`);
  for (const f of lista) if (!LANDINGS_MAKO[f.slug]) throw new Error(`${f.slug} no está en LANDINGS_MAKO (lib/origen-cuenta.ts): el alta no sabría de dónde vino`);
  const salida = arg('--salida');
  const docs = await Promise.all(lista.map(async (f) => ({ f, doc: await documentoDeFunnel(f) })));
  if (salida) {
    mkdirSync(salida, { recursive: true });
    for (const { f, doc } of docs) {
      writeFileSync(join(salida, `${f.slug}.json`), JSON.stringify(doc));
      const html = doc.contenido.paginas[0].doc.content.map((t) => (t.content?.[0]?.attrs as { html?: string } | undefined)?.html ?? '').join('\n');
      writeFileSync(join(salida, `${f.slug}.html`), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.titulo)}</title><style>body{margin:0}${CSS_MAKO_V2}</style></head><body>${html}</body></html>`);
      console.log(`${f.slug}${f.pausada ? ' (en pausa)' : ''}: ${doc.contenido.paginas[0].doc.content.length} secciones → ${salida}`);
    }
  }
  if (args.includes('--subir')) {
    const { subir } = await import('./landing-mako-a-web-generator.mjs');
    for (const { f, doc } of docs) {
      if (f.pausada) { console.log(`${f.slug}: NO se sube (${f.pausada})`); continue; }
      await subir(doc as never, solo ? arg('--doc') : undefined, f.slug, false);
    }
  }
}

if (esPrincipal) main().catch((e) => { console.error(e); process.exit(1); });
