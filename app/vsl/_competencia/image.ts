// =============================================================================
// /vsl/image — Image, el editor de diseño de MaKo (copiado de Canva), con la ESTRUCTURA de la portada de PostNitro
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling, el DISEÑO y, desde el 12/11/2026, SUS TEXTOS):
//   https://postnitro.ai/es  (leída el 11/11/2026 y otra vez el 12/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/image.tsx; los valores medidos, en docs/diseno/landings-competencia/image.md.
// Su orden, que se respeta acá: hero «El creador de carruseles con IA que diseña y programa tus publicaciones» → «Publica
// en» (6 redes) → «Dale acceso a PostNitro a tu agente» → prueba social (5.0, creadores, plataformas) → «Pruébalo, no es
// un video» → «Más de 100 plantillas, todas editables» → «De la idea a la publicación programada en tres pasos» → «Cada
// parte de la publicación es tuya» (formatos, Nitro Chat, kit de marca, lienzo) → cronograma → «El mismo motor, como sea
// que lo conduzcas» → testimonios → «Lo que realmente hace PostNitro» (preguntas). Por qué ganó:
// docs/competencia/landings-por-funcion.md → «Image (carruseles y creativos)».
//
// TEXTOS COPIADOS TAL CUAL de PostNitro, traducidos (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal
// cual, porque coinciden con MaKo»): la cejilla «El motor de diseño para publicaciones en redes sociales»; el titular, con
// «diseña y programa tus publicaciones» cambiado (Image no programa) por lo más vistoso que tiene: «replica lo que funciona»
// (los carruseles que funcionan y su «Editar», que abre el guiado de app/image-editor/carruseles/ReplicarGuiado.tsx); la
// bajada del hero
// sin «vídeos animados» ni «programados para…»; «…todas editables» (su sección de plantillas, ahora con los carruseles que
// funcionan); «De la idea a… en tres pasos» con «Trae la idea», «Hazlo tuyo» y su «…y publicarla tú mismo»; «Cada parte de
// la publicación es tuya para que la moldees a tu gusto» y «Pídelo por chat o abre el lienzo y configúralo tú mismo»; su
// «…para esos días en que un carrusel es más de lo que la idea requiere»; «Nitro Chat lo diseña contigo» (MaKo), «Un agente
// de IA junto al lienzo», «Empieza por cualquier cosa», «Primero, aprueba…», «Edita preguntando», «Rediseña preguntando»;
// «Tu kit de marca hace el trabajo de diseño»; «Luego abre el lienzo y colócalo exactamente donde quieras», «Cualquier tamaño
// de lienzo» y «Guárdalo como plantilla»; «El mismo motor, como sea que lo conduzcas»; «Lo que realmente hace…».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su aviso de Black Friday y su «Comienza gratis, sin tarjeta» no van: MaKo no tiene ni promo ni precio escrito acá.
//   · «Publica en» (6 redes) pasa a un renglón del hero: Image NO publica ni programa; lo diseñado se descarga en PNG, JPG,
//     PDF o SVG y lo subes tú. Por lo mismo, su CRONOGRAMA (el planificador del mes) no va.
//   · Su «Más de 100 plantillas, todas editables» es, en MaKo, «Carruseles que funcionan» (12/11/2026, Martín: «podés traer
//     los montón de carruseles de la competencia y podés ver super outliers»): la portada de Image
//     (app/image-editor/carruseles/ExplorarCarruseles.tsx, lib/carruseles/explorar.ts), con lo que hace de verdad. Los 8
//     tipos de carrusel de antes pasaron a la fila «Formatos». La captura de esa pantalla NO va todavía: el 12/11/2026 el
//     `next dev` de la sesión no tenía AUTH_SECRET ni la base (no se pudo entrar a /image-editor), y no se arma a mano.
//   · «Dale acceso a tu agente» (su adelanto) no se repite arriba: va completo en su lugar, el de «El mismo motor», con lo
//     que MaKo tiene de verdad (WhatsApp y la API de MaKo, lib/api-mako/areas/imagen.def.ts).
//   · Su prueba social (5.0, 86.000 creadores, 200 plataformas) es de uso: van los números de lo que Image TRAE, contados
//     del código (los tipos de carrusel, las plantillas con su ejemplo, los tamaños).
//   · «Pruébalo, no es un video» es un editor en vivo sin cuenta: /vsl no tiene uno (la página es sin JavaScript). No va.
//   · De su grilla de extras quedan afuera las imágenes de IA por diapositiva y elegir el modelo: el chat de Image no genera
//     imágenes (lib/image-editor/chat/catalogo.ts → NO_SE_PUEDE_CHAT_IMAGEN). «Aprende tu voz» es, en MaKo, «Editar un
//     ejemplo» (el texto lo escribe tu IA para tu negocio), y va en el chat.
//   · Sus testimonios son suyos: la prueba de MaKo es el caso de todas las landings. Sus preguntas de precio, soporte y
//     cancelación no van.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['image-editor']), del explorador (app/image-editor/carruseles/), del
// chat (app/image-editor/mako/chat/: «Original | Modificado», «Aceptar», «Restaurar», «Discutir»), de las plantillas del
// negocio (app/creaciones/usePlantillasPropias.ts) y de los kits de marca (lib/marca/kits.ts, app/second-brain/MarcaView.tsx).
// Lo que no hace (`noHace`): pedirle fotos a un banco de imágenes (todavía no) y copiar las palabras de un ejemplo.
// =============================================================================

import { TIPOS_CARRUSEL } from '@/lib/carruseles/tipos';
import { ALTO_CARRUSEL, ANCHO_CARRUSEL } from '@/lib/carruseles/documento';
import { PLANTILLAS_IMAGEN } from '@/lib/image-editor/plantillas-reales';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { PLANTILLAS_NUEVO_DISENO } from '@/app/image-editor/plantillas-crear';
import type { LandingCompetencia } from './tipos';

const I = {
  imagen: ['M15 8h.01', 'M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z', 'M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5', 'M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3'],
  capas: ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
  lista: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  pasos: ['M11 6h9', 'M11 12h9', 'M12 18h8', 'M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4', 'M6 10v-6l-2 2'],
  historia: ['M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0', 'M3 6l0 13', 'M12 6l0 13', 'M21 6l0 13'],
  cambio: ['M21 17l-18 0', 'M6 10l-3 -3l3 -3', 'M3 7l18 0', 'M18 20l3 -3l-3 -3'],
  mito: ['M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7', 'M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3', 'M9.7 17l4.6 0'],
  opinion: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
  numeros: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
  preguntas: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 17l0 .01', 'M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4'],
  vertical: ['M7 4m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
  video: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  presentacion: ['M3 4l18 0', 'M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10', 'M12 16l0 4', 'M9 20l6 0', 'M8 12l3 -3l2 2l3 -3'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  ojo: ['M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6'],
  lapiz: ['M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4', 'M13.5 6.5l4 4'],
  conversa: ['M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10', 'M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2'],
  paleta: ['M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25', 'M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  letra: ['M4 20l3 0', 'M14 20l7 0', 'M6.9 15l6.9 0', 'M10.2 6.3l5.8 13.7', 'M5 20l6 -16l2 0l7 16'],
  logo: ['M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5', 'M12 12l8 -4.5', 'M12 12l0 9', 'M12 12l-8 -4.5'],
  carpeta: ['M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2'],
  tamano: ['M3 11v8a1 1 0 0 0 1 1h8m-9 -14v-1a1 1 0 0 1 1 -1h1m5 0h2m5 0h1a1 1 0 0 1 1 1v1m0 5v2m0 5v1a1 1 0 0 1 -1 1h-1', 'M4 12h7a1 1 0 0 1 1 1v7'],
  formas: ['M3 5a2 2 0 0 1 2 -2h3a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-3a2 2 0 0 1 -2 -2z', 'M17 17m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M17.5 3l3.5 6h-7z'],
  paginas: ['M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z', 'M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'],
  wa: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  api: ['M7 8l-4 4l4 4', 'M17 8l4 4l-4 4', 'M14 4l-4 16'],
  outlier: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
  lupa: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  filtro: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227z'],
  guardar: ['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4z'],
  cta: ['M8 9h8', 'M8 13h6', 'M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z'],
  anuncio: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'],
  biblioteca: ['M5 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z', 'M9 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z', 'M5 8h4', 'M9 16h4', 'M13.803 4.56l2.184 -.53c.562 -.135 1.133 .19 1.282 .732l3.695 13.418a1.02 1.02 0 0 1 -.634 1.219l-.133 .041l-2.184 .53c-.562 .135 -1.133 -.19 -1.282 -.732l-3.695 -13.418a1.02 1.02 0 0 1 .634 -1.219l.133 -.041z'],
};

/** Lo que se descarga desde el editor (lib/funciones-mako.ts → «Presentar y descargar en PNG, JPG, PDF o SVG»). */
const DESCARGAS = ['PNG', 'JPG', 'PDF', 'SVG'] as const;
const DESCARGAS_TXT = `${DESCARGAS.slice(0, -1).join(', ')} o ${DESCARGAS[DESCARGAS.length - 1]}`;

const N_TIPOS = TIPOS_CARRUSEL.length;
/** «lista, paso a paso, historia…»: los primeros tipos, como se leen en «Nuevo diseño». */
const TIPOS_TXT = TIPOS_CARRUSEL.slice(0, 3).map((t) => t.nombre.toLowerCase()).join(', ');
const N_REALES = PLANTILLAS_IMAGEN.length;
/** Los tamaños en blanco de «Nuevo diseño»: lo que no es un carrusel por tipo ni una plantilla real. */
const N_TAMANOS = PLANTILLAS_NUEVO_DISENO.filter((p) => !p.carrusel && !p.real).length;

/** «miniaturas de YouTube, publicaciones, historias, anuncios y presentaciones»: los grupos de las plantillas reales. */
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const GRUPOS_REALES = [...new Set(PLANTILLAS_IMAGEN.map((p) => p.grupo))].map(minuscula);
const GRUPOS_REALES_TXT = GRUPOS_REALES.length > 1 ? `${GRUPOS_REALES.slice(0, -1).join(', ')} y ${GRUPOS_REALES[GRUPOS_REALES.length - 1]}` : GRUPOS_REALES.join('');

const medida = (k: keyof typeof TAMANOS_API) => `${TAMANOS_API[k].ancho} × ${TAMANOS_API[k].alto}`;

export const LANDING_IMAGE: LandingCompetencia = {
  slug: 'image',
  nombre: 'Image',
  icono: I.imagen,
  referencia: { nombre: 'PostNitro — creador de carruseles con IA (es)', url: 'https://postnitro.ai/es', leida: '2026-11-12' },
  metaTitle: 'Image de MaKo: los carruseles que funcionan, en tu versión editable',
  metaDesc: `Los carruseles de las cuentas que sigues, con su outlier, y tu versión editable con un clic. Un editor como Canva con el chat de MaKo al lado, tu kit de marca y descarga en ${DESCARGAS_TXT}.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'El motor de diseño para publicaciones en redes sociales',
      titulo: 'El creador de carruseles con IA que replica lo que funciona.',
      bajada: 'Carruseles, publicaciones, historias, anuncios y miniaturas: diseñados con IA o a mano en un editor de arrastrar y soltar de formato libre, en tu kit de marca, a partir de <strong>los carruseles que mejor les funcionan a las cuentas que sigues</strong>.',
      puntos: [`Lo descargas en ${DESCARGAS_TXT} y lo publicas tú`],
      visual: { tipo: 'propio', slug: 'image' },
    },
    {
      tipo: 'cifras',
      titulo: 'Lo que trae Image hoy',
      items: [
        { valor: String(N_TIPOS), label: 'tipos de carrusel con su estructura, lámina por lámina' },
        { valor: String(N_REALES), label: 'plantillas con su ejemplo lleno' },
        { valor: String(N_TAMANOS), label: 'tamaños listos para empezar en blanco' },
        { valor: String(DESCARGAS.length), label: `formatos de descarga: ${DESCARGAS.join(', ')}` },
      ],
    },
    {
      // Su «PLANTILLAS — Más de 100 plantillas, todas editables»: en MaKo, la portada de Image, «Encuentra tu siguiente
      // OUTLIER» (app/image-editor/carruseles/ExplorarCarruseles.tsx). Lo que dice cada tarjeta es lo que hace esa pantalla.
      tipo: 'tarjetas',
      etiqueta: 'Carruseles que funcionan',
      titulo: 'Los carruseles que funcionan, todos editables.',
      bajada: 'Los de las cuentas que sigues en Competitor Spy, cada uno con su <strong>outlier</strong>: cuántas veces la mediana de su cuenta. Con «Editar» tienes tu versión, con su mismo diseño y el texto escrito para tu negocio.',
      items: [
        { icono: I.outlier, titulo: 'Su outlier', texto: 'Cuántas veces la mediana de su cuenta. Ordenas por «Mayor outlier» y lo que mejor le funcionó a cada cuenta sale primero.', meta: 'Outlier' },
        { icono: I.lupa, titulo: 'Busca', texto: 'Por tema o por @cuenta, y guardas la búsqueda para volver.', meta: 'Buscar' },
        { icono: I.filtro, titulo: 'Filtra', texto: 'Por fecha, cantidad de láminas, tipo de carrusel y cuentas.', meta: 'Filtros' },
        { icono: I.guardar, titulo: 'Guarda', texto: 'Los carruseles que te sirven quedan en «Guardados». Y las láminas se pasan dentro de la tarjeta.', meta: 'Guardados' },
        { icono: I.cta, titulo: 'El CTA, a la vista', texto: 'Si el carrusel pide comentar una palabra («Comenta GUÍA»), la tarjeta lo dice.', meta: 'CTA' },
        { icono: I.anuncio, titulo: 'Anuncios de la competencia', texto: 'Los que trajo Competitor Spy de las cuentas que sigues, ordenados por cuántos días llevan al aire.', meta: 'Anuncios' },
        { icono: I.biblioteca, titulo: 'Una biblioteca de ejemplos', texto: 'Carruseles públicos de Instagram, con su @creador y el link al original. Se ve aunque no sigas a nadie.', meta: 'Ejemplos' },
        { icono: I.lapiz, titulo: 'Editar', texto: 'Tu versión editable: su mismo diseño, el texto escrito para tu negocio por tu IA y tu foto donde el ejemplo tiene una persona.', meta: 'Editar' },
      ],
    },
    {
      tipo: 'pasos',
      fondo: true,
      titulo: 'De la idea al carrusel listo en tres pasos',
      pasos: [
        { titulo: 'Trae la idea', texto: 'Un carrusel que funciona de una cuenta que sigues, un tema, un texto que ya hayas escrito o un ejemplo de la biblioteca. Eliges un tipo de carrusel y nace con sus láminas; el texto se lo pides a MaKo.' },
        { titulo: 'Hazlo tuyo', texto: 'Tu kit de marca ya está aplicado. Edita cualquier lámina, modifica un titular o una foto, o déjalo como está y continúa.' },
        { titulo: 'Descárgalo', texto: 'En PNG o JPG, una imagen por lámina, o el carrusel entero en PDF, y publícalo tú mismo.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Diseño',
      titulo: 'Cada parte de la publicación es tuya para que la moldees a tu gusto.',
      bajada: 'Pídelo por chat o abre el lienzo y configúralo tú mismo. Los carruseles de MaKo salen con tus fuentes, tus colores y tu logo.',
      columnas: 2,
      items: [
        { icono: I.capas, titulo: 'Carruseles', texto: `De varias láminas, con ${N_TIPOS} tipos para empezar (${TIPOS_TXT}…). Se descargan lámina por lámina en PNG o como un solo PDF.`, meta: `${ANCHO_CARRUSEL} × ${ALTO_CARRUSEL}` },
        { icono: I.vertical, titulo: 'Publicaciones e historias', texto: 'La cuadrada, la vertical y la historia de Instagram, para esos días en que un carrusel es más de lo que la idea requiere.', meta: `${medida('publicacion_instagram')} · ${medida('publicacion_vertical')} · ${medida('historia')}` },
        { icono: I.video, titulo: 'Anuncios y miniaturas', texto: 'El anuncio de Facebook y la miniatura de YouTube, en su tamaño.', meta: `${medida('anuncio_facebook')} · ${medida('miniatura_youtube')}` },
        { icono: I.presentacion, titulo: 'Presentaciones', texto: 'Varias diapositivas en un diseño, y las presentas desde el editor.', meta: medida('presentacion') },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Chat de MaKo',
      titulo: 'MaKo lo diseña contigo',
      bajada: 'Un agente de IA junto al lienzo, siempre abierto. Describe la publicación o pega el texto que ya escribiste; luego, sigue hablando para cambiar cualquier lámina, cualquier color o cualquier diseño.',
      columnas: 2,
      items: [
        { icono: I.ia, titulo: 'Empieza por cualquier cosa', texto: 'Un tema, tu texto, una foto o un PDF. O un ejemplo que te gustó: con «Editar» tienes tu versión, con su mismo diseño y <strong>el texto escrito para tu negocio</strong>.' },
        { icono: I.ojo, titulo: 'Primero, aprueba el cambio.', texto: 'Cada pedido vuelve como «Original | Modificado». El diseño no se toca hasta que eliges <strong>Aceptar</strong>, y «Restaurar» lo vuelve atrás.' },
        { icono: I.lapiz, titulo: 'Edita preguntando', texto: 'Cambia un texto, mueve o borra un elemento, suma o saca una lámina. En todo el diseño o sólo en lo que elegiste.' },
        { icono: I.paleta, titulo: 'Rediseña preguntando', texto: 'Colores, fondos, fuentes y tamaños. Y en «Discutir», MaKo te contesta sobre tu diseño sin tocar nada.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Kit de marca',
      titulo: 'Tu kit de marca hace el trabajo de diseño.',
      bajada: 'Subes tu manual de marca una sola vez: MaKo saca tus colores, tus fuentes y tu logo, y tú lo confirmas antes de guardarlo. Cada carrusel de MaKo sale con tu identidad visual.',
      columnas: 2,
      items: [
        { icono: I.paleta, titulo: 'Colores que guardaste', texto: 'Con su rol: el principal, el secundario, el de acento, el del fondo y el del texto.' },
        { icono: I.letra, titulo: 'Tus fuentes', texto: 'Una para los títulos y otra para el texto.' },
        { icono: I.logo, titulo: 'Tu logo', texto: 'En cada carrusel de MaKo, junto con tus colores y tus fuentes.' },
        { icono: I.carpeta, titulo: 'Un kit por marca', texto: 'Si llevas varias marcas, guardas un kit por cada una, y pasar de un cliente a otro es tan sencillo como elegir otro kit.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Lienzo',
      titulo: 'Luego abre el lienzo y colócalo exactamente donde quieras.',
      bajada: 'El chat te ayuda casi por completo. En el lienzo, el diseño libre toma el control, como en Canva.',
      columnas: 2,
      items: [
        { icono: I.tamano, titulo: 'Cualquier tamaño de lienzo', texto: 'Los más pedidos de Canva, o a medida.' },
        { icono: I.formas, titulo: 'Texto, formas, imágenes y marcos', texto: 'Y códigos QR, cada uno en su capa, con recortes, filtros y animaciones.' },
        { icono: I.paginas, titulo: 'Varias páginas en un diseño', texto: 'Un carrusel o una presentación entera, lámina por lámina.' },
        { icono: I.carpeta, titulo: 'Guárdalo como plantilla', texto: 'Convierte tu mejor diseño en una plantilla del negocio: queda en «Crear desde cero».' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Automatizar',
      titulo: 'El mismo motor, como sea que lo conduzcas.',
      bajada: 'Diseña a mano en el editor o deja que el chat, WhatsApp o tu propio código lo hagan por ti. Las mismas plantillas y los mismos diseños para todos ellos.',
      items: [
        { icono: I.ia, titulo: 'En el chat del editor', texto: 'Al lado del lienzo, con el diseño abierto.' },
        { icono: I.wa, titulo: 'Por WhatsApp', texto: 'Le pides a MaKo un diseño desde una plantilla o que le cambie los textos, y te devuelve el link para abrirlo.' },
        { icono: I.api, titulo: 'Con la API de MaKo', texto: 'Tu sistema ve tus diseños, crea uno desde una plantilla y le cambia los textos, con tu token. El diseño final y la descarga se hacen en el editor.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'preguntas',
      titulo: 'Lo que realmente hace Image',
      items: [
        { p: '¿Qué es Image?', r: 'El editor de diseño de MaKo, tan simple como Canva: diseños de varias páginas con texto, formas, imágenes, marcos, QR y capas, con el chat de MaKo al lado. Abre con los carruseles que funcionan de las cuentas que sigues.' },
        { p: '¿De dónde salen los carruseles que funcionan?', r: 'De las cuentas que sigues en Competitor Spy, y de una biblioteca de ejemplos de Instagram que es la misma para todos. Cada uno trae su outlier: cuántas veces la mediana de su cuenta.' },
        { p: '¿Copia las palabras de los carruseles?', r: 'No. Con «Editar» copia el diseño, y el texto lo escribe tu IA para tu negocio. Sin tu IA, cada lámina trae una guía de qué va.' },
        { p: '¿Para qué plataformas puedo diseñar? ¿MaKo lo publica?', r: 'Diseñas carruseles, publicaciones e historias de Instagram, anuncios, miniaturas de YouTube y presentaciones. MaKo no publica ni programa: descargas el diseño y lo subes tú.' },
        { p: '¿Qué puedo exportar?', r: `Cada diseño en ${DESCARGAS_TXT}.` },
        { p: '¿MaKo crea las imágenes con IA?', r: 'No. MaKo escribe y acomoda los textos, cambia colores y letras y usa las fotos que subes. Pedirle fotos a un banco de imágenes, todavía no.' },
        { p: '¿Puedo usar mi propia marca?', r: 'Sí. Subes tu manual de marca y los carruseles de MaKo salen con tus colores, tus fuentes y tu logo. Con varios kits, eliges cuál.' },
        { p: '¿Se puede usar por WhatsApp o por la API?', r: 'Sí: le pides a MaKo un diseño desde una plantilla, que le cambie los textos o que haga una copia, y te devuelve el link. El diseño final y la descarga se hacen en el editor.' },
        { p: '¿Cuántas plantillas hay?', r: `${N_TIPOS} carruseles por tipo, ${N_REALES} plantillas con su ejemplo (${GRUPOS_REALES_TXT}) y ${N_TAMANOS} tamaños en blanco. Y las que guardes tú.` },
      ],
    },
  ],
};
