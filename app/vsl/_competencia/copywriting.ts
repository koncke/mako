// =============================================================================
// /vsl/copywriting — Copywriting (las páginas de MaKo), con la ESTRUCTURA y el DISEÑO de The Copy Machine
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling, el diseño y, desde el 12/11/2026, SUS TEXTOS):
//   https://theoperatorstack.io/copy-machine  (leída el 11/11/2026 y otra vez el 12/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/copywriting.tsx; los valores medidos de la referencia (fuentes, escala, colores,
// espacios), en docs/diseno/landings-competencia/copywriting.md.
// Su orden, que se respeta aquí: hero «100 years of copywriting, installed into your AI» → «What's inside, at a glance» →
// «See what the Copy Machine does to a real page» (3 páginas) → «What buyers wrote back» → «Start with the copy you need
// next» (por tipo de negocio) → «Copy only you can run» (el «papel tapiz») → «Who built it» → «What you get» (7 skills) →
// «Your first hour» → «Who it's for» y «Who it isn't for» → «The math» → «The offer» → los agregados → preguntas → cierre.
// Por qué ganó: docs/competencia/landings-por-funcion.md → «Copywriting».
//
// TEXTOS COPIADOS TAL CUAL de la referencia, traducidos (12/11/2026, Martín: «lo atractivo de la página original era 100 años de
// copywriting instalado en tu inteligencia artificial. En este caso podríamos aprovechar la cantidad de gurús que hemos
// analizado… y ahí después podemos poner… las caricaturas»):
//   · el titular «100 years of copywriting, installed into your AI» → «N referentes del marketing, instalados en tu IA», con
//     N = ASESORES.length (lib/asesores/catalogo.ts, CONTADO: hoy 32). Cada uno tiene su ficha destilada de su curso y su
//     caricatura (public/asesores/<id>.png); en el chat de MaKo («Nuevo chat» → «O habla con un gurú»,
//     app/second-brain/GaleriaDeGurus.tsx) eliges con cuál hablar y su ficha viaja en cada mensaje a tu IA
//     (lib/asesores/contexto.ts → contextoDeReferente, app/api/mako/chat/route.ts → contextoDelChat). El chat de las
//     páginas de Copywriting NO lleva fichas de referentes (lib/copywriter/ia.ts): por eso la landing dice «en el chat de
//     MaKo», nunca «en tus páginas». Donde la referencia pone sus 14 libros, van las caricaturas con «Inspirado en» y que
//     ninguno participa en MaKo ni la respalda (la regla de lib/asesores/catalogo.ts);
//   · su bajada («Your AI writes like everyone else's because it knows nothing about you»), sus checks («Copy you'd put your
//     name on», «Works in your own Claude, ChatGPT…») y su «You're not getting a prompt…», en la tarjeta del hero;
//   · «What's inside, at a glance», «Start with the copy you need next» / «Something else to write? Bring it too», el texto
//     de «Copy only you can run», «What you get» con sus títulos («Your customers hand you the hooks», «It kills every line a
//     competitor could sign», «It learns your business», «Thirty of the greatest copywriters…», «It won't invent your
//     numbers»), «Your first hour», sus cinco «Who it's for», sus tres «Who it isn't for» y su cierre «Traffic is an
//     expensive place to find the weak line».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su banner de Black Friday, «The math», «The offer» (el precio y su garantía de 14 días) y los agregados pagos no van:
//     ninguna landing de /vsl escribe un precio a mano ni promete una devolución. El cierre es la llamada, como en todas.
//     Su primer check («It beats your copy, or I rewrite it myself… get your $47 back») y el último («Pay once») tampoco.
//   · «What's inside» son los números de lo que Copywriting TRAE, contados del código (lib/copywriter/plantillas.ts, las
//     estructuras de lib/guion-estructuras.ts y lib/vsl-estructuras.ts, los ángulos de lib/guion-angulos.ts) y los referentes.
//   · Sus 3 páginas reescritas (el original al lado de su reescritura) son, en MaKo (14/11/2026), DOS piezas reales de Alex
//     Hormozi replicadas con «Replicar» (REPLICAS, abajo: su short y su anuncio, con lo que escribió MaKo). Antes eran las
//     plantillas con su ejemplo ficticio, con el recuadro de «falta» en cada pestaña. Se dice que no son clientes ni resultados
//     medidos (como dice ella de las suyas).
//   · Sus 11 reseñas son suyas: la prueba de MaKo es el caso de todas las landings. «Who built it» (su fundador) no va.
//   · «Start with the copy you need next» va por los grupos de plantillas de «Nueva», no por tipo de negocio.
//   · Su «It catches the weak line before a customer reads it» (el Chief que revisa) es, en MaKo, la propuesta que se
//     acepta, se descarta o se reintenta (app/copywriter/PanelMaKo.tsx). Su «Grok» no va: tu IA es tu Claude, tu ChatGPT o
//     tu Gemini (PROVS_SU_IA). Sus «14 volumes distilled from 30+ legends, Hopkins to Hormozi» son las fichas de los
//     referentes, sin libros.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['copywriter']), de docs/diseno-copywriter.md (D5, D9, D11-D13) y del
// método del experto (lib/copywriter/experto.ts: las tres preguntas y [DATO: …]).
// =============================================================================

import { catalogosLite, conVsl } from '@/lib/copywriter/catalogos';
import { gruposDePlantillas, plantillasDe, plantillasVisibles } from '@/lib/copywriter/plantillas';
import { ESTRUCTURAS_GUION_DEFAULT } from '@/lib/guion-estructuras';
import { ANGULOS_GUION_DEFAULT } from '@/lib/guion-angulos';
import { ASESORES } from '@/lib/asesores/catalogo';
import type { LandingCompetencia } from './tipos';

const I = {
  copy: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  anuncio: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  redes: ['M7 4m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
  vsl: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  largo: ['M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M10 9l5 3l-5 3z'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  cita: ['M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5', 'M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5'],
  ojo: ['M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6'],
  negocio: ['M3 21l18 0', 'M5 21v-14l8 -4v18', 'M19 21v-10l-6 -4', 'M9 9l0 .01', 'M9 12l0 .01', 'M9 15l0 .01', 'M9 18l0 .01'],
  estructura: ['M4 4m0 1a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1z', 'M4 12m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z', 'M16 12l4 0', 'M16 16l4 0', 'M16 20l4 0'],
  dato: ['M12 9v4', 'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z', 'M12 16h.01'],
  si: ['M5 12l5 5l10 -10'],
  no: ['M18 6l-12 12', 'M6 6l12 12'],
};

/** Las plantillas de «Nueva» con la biblioteca de fábrica (la que ve un negocio que no la cambió). */
const CATALOGO = catalogosLite(ANGULOS_GUION_DEFAULT, conVsl(ESTRUCTURAS_GUION_DEFAULT));
const PLANTILLAS = plantillasVisibles(plantillasDe(CATALOGO));
const CON_EJEMPLO = PLANTILLAS.filter((p) => p.ejemplo);
const N_PLANTILLAS = CON_EJEMPLO.length;
/** Las estructuras de guion y de VSL que trae la biblioteca, y los ángulos (sólo los prendidos de fábrica). */
const N_ESTRUCTURAS = conVsl(ESTRUCTURAS_GUION_DEFAULT).filter((e) => e.activo).length;
const N_ANGULOS = ANGULOS_GUION_DEFAULT.filter((a) => a.activo).length;
/** Los referentes del marketing que MaKo tiene, CONTADOS del catálogo (cada uno con su ficha y su caricatura). */
const N_REFERENTES = ASESORES.length;
const GRUPOS = gruposDePlantillas(CON_EJEMPLO);
const N_GRUPOS = GRUPOS.length;
/** «anuncios, redes sociales, email, VSL y video largo»: los grupos de «Nueva», como se leen en la tarjeta. */
const enMinuscula = (g: string) => (g === g.toUpperCase() ? g : g.charAt(0).toLowerCase() + g.slice(1));
const NOMBRES_GRUPOS = GRUPOS.map((g) => enMinuscula(g.grupo));
const GRUPOS_TXT = NOMBRES_GRUPOS.length > 1 ? `${NOMBRES_GRUPOS.slice(0, -1).join(', ')} y ${NOMBRES_GRUPOS[NOMBRES_GRUPOS.length - 1]}` : NOMBRES_GRUPOS.join('');

const ICONO_GRUPO: Record<string, string[]> = { Anuncios: I.anuncio, 'Redes sociales': I.redes, Email: I.email, VSL: I.vsl, 'Video largo': I.largo };

/**
 * Las piezas de la banda de ejemplos (14/11/2026), donde la referencia pone «Three real pages and ads, rewritten»: su original a la
 * izquierda y su reescritura a la derecha. En MaKo son dos piezas REALES de Alex Hormozi que leyó Competitor Spy y lo que escribió
 * Copywriting con «Replicar» en el negocio de MaKo (ws 9), para dos ofertas de MaKo. Nada se escribió a mano:
 *   · el short «When someone asks for a discount:» (spy_piezas 6, 105.615 vistas) → el guion de la animación de la portada
 *     (public/vsl-assets/sitio/copywriting.webm, de C:/dev/bancos-portada/banco-carruseles-replica/salida/copy-reel.html; la corrida,
 *     en las notas de la sesión: copy-reel-hormozi/). El video muestra el original y lo que escribió, como su comparación;
 *   · el anuncio «Learn How to Scale Your Business» (spy_piezas 3318, Biblioteca de anuncios de Meta, 19/8/2026) → la página
 *     g49hpdqrw69 del 13/11/2026, 12:56 («WhatsApp Ads Funnel: Convierte tu tráfico en clientes»), copiada tal cual de las notas
 *     probar-copy-1311/replicas-lado-a-lado.html (su chat: «Repliqué la estructura y el ritmo del original de Hormozi —gancho
 *     directo, historia corta de descubrimiento, CTA con objeción—, pero con tu oferta WhatsApp Ads Funnel»).
 * Hay dos y no tres (la referencia tiene tres): no hay otra réplica de Hormozi limpia; las demás de esa prueba son de otros
 * creadores o mezclan el voseo.
 */
export const REPLICAS: {
  titulo: string; meta: string; icono: string[]; cambio: string;
  video?: { src: string; poster: string };
  original: { rotulo: string; pie: string; titulo?: string; texto?: string[]; destino?: string };
  mako: { rotulo: string; pie: string; titulo?: string; secciones?: [string, string][] };
}[] = [
  {
    titulo: 'Un short',
    meta: 'Short de YouTube · @AlexHormozi',
    icono: I.redes,
    cambio: 'El original es una escena (alguien que pide un descuento) y su moraleja. MaKo tomó esa estructura, no la idea del descuento, y la llevó a la oferta «MaKo Acelerador».',
    video: { src: '/vsl-assets/sitio/copywriting.webm', poster: '/vsl-assets/sitio/copywriting.jpg' },
    original: { rotulo: 'Original: su short', pie: '@AlexHormozi · 105.615 vistas' },
    mako: { rotulo: 'Lo que escribió MaKo', pie: 'Reel · 45 s · con «MaKo Acelerador»' },
  },
  {
    titulo: 'Un anuncio',
    meta: 'Anuncio de Meta · @AlexHormozi',
    icono: I.anuncio,
    cambio: 'El original invita a un taller en Las Vegas. MaKo tomó su estructura y su ritmo (un gancho directo, una historia corta y el llamado) y escribió el anuncio de la oferta «WhatsApp Ads Funnel».',
    original: {
      rotulo: 'Original: su anuncio',
      pie: 'Biblioteca de anuncios de Meta · 19/8/2026',
      titulo: 'Learn How to Scale Your Business',
      texto: ['We’re hosting a workshop at Acquisition.com’s Las Vegas HQ to show entrepreneurs the exact methods we use to scale businesses. Want to be in the room? Click below to see if you’re a fit.'],
      destino: 'acquisition.com',
    },
    mako: {
      rotulo: 'Lo que escribió MaKo',
      pie: 'Anuncio · 45 s · Gancho → Historia → CTA',
      titulo: 'WhatsApp Ads Funnel: Convierte tu tráfico en clientes',
      secciones: [
        ['Gancho', 'La mayoría de tus anuncios genera clics, pero no ventas. ¿Qué pasaría si cada contacto llegara directo a una conversación que vende?'],
        ['Historia', 'Descubrimos que el problema no es el tráfico. Es que lo mandas a un lugar donde la gente no compra. WhatsApp es donde sí lo hace: conversación directa, sin ruido, con una sola razón de estar ahí. Ese es el funnel que faltaba.'],
        ['CTA', 'No necesitas más tráfico ni mejores anuncios. Necesitas dónde llevarlos. Mira cómo armar tu WhatsApp Ads Funnel abajo.'],
      ],
    },
  },
];

export const LANDING_COPYWRITING: LandingCompetencia = {
  slug: 'copywriting',
  nombre: 'Copywriting',
  icono: I.copy,
  referencia: { nombre: 'The Copy Machine — The Operator Stack', url: 'https://theoperatorstack.io/copy-machine', leida: '2026-11-12' },
  metaTitle: `Copywriting de MaKo: ${N_REFERENTES} referentes del marketing, instalados en tu IA`,
  metaDesc: `Anuncios, reels, stories, emails, VSL y videos de YouTube en páginas como las de Notion: MaKo lee tu negocio, te pregunta lo que falta y escribe en la página. Y en su chat, ${N_REFERENTES} referentes del marketing para elegir a cuál seguir.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'El copywriter de MaKo para tu IA',
      titulo: `${N_REFERENTES} referentes del marketing, <em>instalados en <strong>tu</strong> IA.</em>`,
      bajada: 'Tu IA escribe como la de todos porque no sabe nada de ti. MaKo lee tu negocio, te pregunta lo que falta y escribe <strong>en tu página</strong>. Y en el chat de MaKo eliges a qué referente seguir: <strong>te contesta con su método</strong>.',
      puntos: [
        '<strong>Copy que firmarías con tu nombre.</strong> Cada línea que podría firmar un competidor la cambia por un dato tuyo antes de entregarte la pieza.',
        '<strong>Funciona con tu propio Claude, ChatGPT o Gemini.</strong> El que conectas a tu negocio en Integraciones.',
        '<strong>No inventa lo que no sabe.</strong> Lo que tu negocio no dice queda marcado para que lo completes.',
      ],
      visual: { tipo: 'propio', slug: 'copywriting' },
    },
    {
      tipo: 'cifras',
      titulo: 'Lo que trae Copywriting, de un vistazo',
      items: [
        { valor: String(N_REFERENTES), label: 'referentes del marketing, cada uno con su método' },
        { valor: String(N_PLANTILLAS), label: 'plantillas, cada una con su ejemplo completo' },
        { valor: String(N_ESTRUCTURAS), label: 'estructuras de guion: PAS, AIDA, reel, stories, VSL y YouTube' },
        { valor: String(N_ANGULOS), label: 'ángulos para el gancho: dolor, testimonio, comparación y más' },
        { valor: String(N_GRUPOS), label: `tipos de pieza: ${GRUPOS_TXT}` },
      ],
    },
    {
      // Su banda «Three real pages and ads, rewritten» / «See the original next to my rewrite.», que se abre en «See what the Copy
      // Machine does to a real page.»: las piezas de Hormozi y lo que escribió MaKo (REPLICAS, arriba).
      tipo: 'tarjetas',
      etiqueta: 'Mira el original al lado de lo que escribió MaKo.',
      titulo: 'Dos piezas reales de Alex Hormozi, replicadas',
      bajada: 'Tomamos dos piezas que le funcionaron a Alex Hormozi, tocamos «Replicar» y MaKo escribió la suya con la misma estructura, para una oferta de MaKo.',
      items: REPLICAS.map((r) => ({ icono: r.icono, titulo: r.titulo, texto: r.cambio, meta: r.meta })),
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      etiqueta: 'Pon a MaKo a escribir',
      titulo: 'Empieza por el próximo copy que necesitas.',
      bajada: '¿Otra cosa que escribir? Tráela también: empiezas con una página en blanco, como en Notion.',
      items: GRUPOS.map((g) => ({
        icono: ICONO_GRUPO[g.grupo] ?? I.copy,
        titulo: g.grupo,
        texto: g.plantillas.map((p) => p.nombre).join(' · '),
        meta: g.plantillas.length === 1 ? '1 plantilla' : `${g.plantillas.length} plantillas`,
      })),
    },
    {
      // Como su banda oscura «Copy only you can run»: la pregunta del titular y un párrafo que sigue de corrido.
      tipo: 'contraste',
      etiqueta: 'Copy que solo tú puedes firmar',
      titulo: '¿Un competidor podría pegar tu titular en su página sin que nadie lo note? Si la respuesta es sí, no tienes copy. <em>Tienes relleno.</em>',
      sin: {
        titulo: 'El copy de la IA suena bien y podría ser de cualquiera,',
        texto: 'porque nada de lo que escribe sabe algo de ti. Un prompt mejor no lo arregla, y tampoco un modelo más grande.',
      },
      con: {
        titulo: 'El copy que solo tú puedes firmar empieza por lo que es verdad solo de ti.',
        texto: 'MaKo te lo pregunta, y marca cada línea que todavía espera un dato tuyo.',
      },
    },
    {
      tipo: 'tarjetas',
      titulo: 'Lo que te llevas',
      // Su «Seven skills · one copy department», a la derecha del titular.
      etiqueta: 'Siete cosas que hace · un solo copywriter',
      items: [
        { icono: I.copy, titulo: 'Escribe tus anuncios, tus reels, tus emails y tus VSL.', texto: 'Guiones a cámara, textos de anuncio, 10 ganchos, reels, stories, carruseles, emails, secuencias, VSL y videos de YouTube, cada uno con su estructura y sus secciones.' },
        { icono: I.cita, titulo: 'Tus clientes te dan los ganchos.', texto: 'Si tu negocio no lo dice, te pregunta a quién le hablas y con qué frase te cuenta su problema. El gancho sale de ahí, no de una frase hecha.' },
        { icono: I.ojo, titulo: 'Primero pregunta, después escribe.', texto: 'Al replicar, MaKo te pregunta <strong>para qué oferta</strong> es y cómo adaptarlo, y escribe la pieza entera, con el original al lado. Si quieres otra versión, se la pides en el chat.' },
        { icono: I.estructura, titulo: 'Saca cada línea que podría firmar un competidor.', texto: 'A cada parte le hace tres preguntas: ¿se puede imaginar?, ¿se puede comprobar?, <strong>¿la podría firmar un competidor?</strong> Si la podría firmar, la cambia por un dato de tu negocio.' },
        { icono: I.negocio, titulo: 'Aprende tu negocio.', texto: 'Lee lo que MaKo ya sabe de ti y te pregunta, de a una, lo que falta: qué vendes y a cuánto, a quién le hablas, qué prueba tienes.' },
        { icono: I.ia, titulo: `${N_REFERENTES} referentes del marketing, en tu chat.`, texto: `Cada uno con su método, de ${ASESORES[0].completo} a ${ASESORES[N_REFERENTES - 1].completo}: en el chat de MaKo eliges con cuál hablar y te contesta con su método. Es «Inspirado en»: ninguno participa en MaKo ni la respalda.` },
        { icono: I.dato, titulo: 'No inventa tus números.', texto: 'Una cifra, un testimonio, una fecha o un cupo que tu negocio no tiene queda como <strong>[DATO: …]</strong>, y la página te dice cuántos quedan por completar.' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: 'Tu primera hora',
      bajada: 'Dile qué necesitas escribir. MaKo empieza a escribir en el acto.',
      pasos: [
        { titulo: 'Elige qué vas a crear', texto: 'En «Nueva», una plantilla o una página en blanco. La página nace con sus secciones y una guía en cada una.' },
        { titulo: 'Dile para qué es', texto: 'MaKo te pregunta para qué es la pieza y a qué oferta adaptarla, con botones. Si prefieres, la escribes tú.' },
        { titulo: 'Acepta lo que escribe', texto: 'Escribe en la página, sección por sección. Aceptas, descartas o le pides que lo intente de nuevo, y sigues editando como en Notion.' },
      ],
    },
    {
      // Como sus dos tarjetas «Who it's for» / «Who it isn't for»: una línea por punto, el comienzo en negrita.
      tipo: 'tarjetas',
      titulo: '¿Para quién es?',
      columnas: 2,
      items: [
        { icono: I.si, titulo: 'Llevas el negocio y el marketing lo haces tú.', texto: 'Los anuncios, los reels, los emails y la VSL caen en ti.' },
        { icono: I.si, titulo: 'Necesitas que te encuentre más gente de la correcta,', texto: 'así que cada anuncio y cada página tiene que hacer que un desconocido se detenga y te elija.' },
        { icono: I.si, titulo: 'No tienes horas para sentarte a escribir.', texto: 'Le pasas el trabajo a MaKo, revisas la pieza y sigues con el negocio.' },
        { icono: I.si, titulo: 'Escribes para clientes o para un equipo,', texto: 'y cada pieza tiene que pasar su revisión: le compartes la página y la edita ahí.' },
        { icono: I.si, titulo: 'Te llevas lo más fuerte que puedes decir con honestidad,', texto: 'con una marca en lo que todavía tienes que respaldar.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: '¿Para quién no es?',
      columnas: 2,
      items: [
        { icono: I.no, titulo: 'Ya te gusta lo que escribe tu IA.', texto: 'Si un chat cualquiera ya te entrega páginas que venden, sigue usándolo.' },
        { icono: I.no, titulo: 'Quieres un curso.', texto: 'MaKo escribe la página contigo, y si te preguntas por qué una sección va así, te lo explica.' },
        { icono: I.no, titulo: 'No le vas a contar de tu negocio.', texto: 'Escribe desde tu oferta y tu cliente: sin eso sale el mismo texto genérico de siempre.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Preguntas frecuentes',
      items: [
        { p: '¿No me lo escribe igual Claude o ChatGPT?', r: 'Te escribe algo que suena bien. Lo que no tiene es tu negocio: MaKo lee lo que ya sabe de ti, sigue la estructura de cada pieza y te pregunta lo que falta antes de escribir.' },
        { p: '¿Quiénes son los referentes?', r: `${N_REFERENTES} referentes del marketing (oferta, anuncios, contenido, ventas, lanzamientos…), cada uno con su método destilado de un curso suyo. En el chat de MaKo, en «Nuevo chat», eliges con cuál hablar. Es «Inspirado en»: ninguno participa en MaKo ni la respalda.` },
        { p: '¿Qué IA necesito?', r: 'La que conectas a tu negocio en Integraciones: tu Claude, tu ChatGPT o tu Gemini. MaKo escribe con ella.' },
        { p: '¿Escribe con mi voz?', r: 'Si le das un borrador tuyo, conserva su ángulo y sus palabras y arregla la estructura. Lo que se dice a cámara lo escribe para que suene natural con el acento de tu negocio.' },
        { p: '¿Inventa cifras o testimonios?', r: 'No los completa: lo que tu negocio no tiene queda como [DATO: …] y lo completas tú. En un anuncio de Meta tampoco afirma nada sobre la salud, el cuerpo o la situación financiera de quien lo lee.' },
        { p: '¿En qué español escribe?', r: 'En español neutro, de tú, sin voseo.' },
        { p: '¿Es un curso?', r: 'No: escribe la página contigo. Si te preguntas por qué una sección va así, te lo explica en una línea.' },
        { p: '¿Mi cliente puede editar la página?', r: 'Sí. Compartes la página con un link y tu cliente la edita sin cuenta de MaKo. La página te dice quién la editó y cuándo.' },
        { p: '¿Publica o envía lo que escribe?', r: 'No. Te entrega el texto en la página: lo copias o lo compartes.' },
      ],
    },
  ],
};
