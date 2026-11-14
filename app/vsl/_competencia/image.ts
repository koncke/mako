// =============================================================================
// /vsl/image — Image, el editor de diseño de MaKo (copiado de Canva), con la ESTRUCTURA de la portada de PostNitro
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling, el DISEÑO, las animaciones y, desde el 12/11, SUS TEXTOS):
//   https://postnitro.ai/es  (leída el 11/11 y el 12/11; RELEÍDA el 14/11/2026 con Chromium a 1440 y 390, sección por sección:
//   side-session-notes/…/referencias-landings/image/relevo.md). El diseño vive en ./disenos/image.tsx; los valores medidos, en
//   docs/diseno/landings-competencia/image.md.
// Su orden (14/11), que se respeta acá bloque por bloque: hero (cejilla, titular, bajada, botón, nota, «Publica en», el marco
// «Plantillas · 4:5» con cuatro láminas y su kit de marca, y la tarjeta negra «Dale acceso a tu agente» a lo ancho) → la franja
// de prueba social → «Pruébalo, no es un video» (el editor en un marco) → «Más de 100 plantillas, todas editables» (seis en fila)
// → «De la idea a la publicación programada en tres pasos» → «01 Diseño» (cuatro filas con su marco y una grilla de seis) →
// «02 Cronograma» → «03 Automatizar» (cuatro tarjetas negras y una grilla) → testimonios → «Lo que realmente hace…» → pie.
//
// TEXTOS COPIADOS TAL CUAL de PostNitro (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual, porque
// coinciden con MaKo»): la cejilla, el titular (con «diseña y programa» cambiado por «replica lo que funciona»: Image no
// programa), la bajada sin «vídeos animados» ni «programados», «…todas editables», «De la idea a… en tres pasos», «Trae la
// idea», «Hazlo tuyo», «Cada parte de la publicación es tuya…», «Pídelo por chat o abre el lienzo…», «…para esos días en que un
// carrusel es más de lo que la idea requiere», «… lo diseña contigo», «Empieza por cualquier cosa», «Primero, aprueba…», «Edita
// preguntando», «Rediseña preguntando», «Tu kit de marca hace el trabajo de diseño», «Luego abre el lienzo…», «Cualquier tamaño
// de lienzo», «Guárdalo como plantilla», «El mismo motor, como sea que lo conduzcas», «Lo que realmente hace…».
//
// Lo que se cambió de la referencia, y por qué:
//   · Su aviso de Black Friday no va: MaKo no tiene promo. Su «Comienza gratis · sin tarjeta» es la regla de la prueba (../cta.ts).
//   · Image NO publica ni programa (lo diseñado se descarga en PNG, JPG, PDF o SVG y lo subes tú): su «Publica en» pasa a
//     «Diseña para» (los tamaños de cada red, lib/image-editor/tamanos.ts) y su CRONOGRAMA (02, el planificador del mes) no va.
//     El Calendario de MaKo publica una imagen o un video sueltos (lib/calendario-publicar-reglas.ts), no un carrusel.
//   · Su tarjeta negra «Dale acceso a tu agente» (Claude, ChatGPT, la terminal) es, en MaKo, «Pídeselo a MaKo por WhatsApp» con
//     la API de MaKo (lib/api-mako/areas/imagen.def.ts): lo que existe de verdad.
//   · Su prueba social (5.0, 86.000 creadores, 200 plataformas) es de uso: van los números de lo que Image TRAE, contados del
//     código, y los formatos de descarga en lugar de sus socios.
//   · «Pruébalo, no es un video» es su editor en vivo sin cuenta: /vsl no tiene uno. En su lugar va la grabación REAL de
//     «Editar» (los carruseles que funcionan de la biblioteca y la réplica que armó Image, public/vsl-assets/sitio/carruseles.webm).
//   · Su «Más de 100 plantillas» es, en MaKo, «Carruseles que funcionan» (12/11/2026, Martín: «podés traer los montón de
//     carruseles de la competencia y podés ver super outliers»): seis outliers VERDADEROS de la biblioteca, con su @ y el link al
//     original (la regla de la memoria «carruseles-ejemplos-sin-top-carousels»), no plantillas dibujadas.
//   · De su grilla de extras quedan afuera las imágenes de IA por diapositiva y elegir el modelo: el chat de Image no genera
//     imágenes (lib/image-editor/chat/catalogo.ts → NO_SE_PUEDE_CHAT_IMAGEN). Va lo que trae la portada de Image.
//   · Sus testimonios son suyos: la prueba de MaKo es el caso de todas las landings. Las preguntas son las de la portada.
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
import { PREGUNTAS_SITIO } from '../_sitio/preguntas';

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

const medida = (k: keyof typeof TAMANOS_API) => `${TAMANOS_API[k].ancho} × ${TAMANOS_API[k].alto}`;

export const LANDING_IMAGE: LandingCompetencia = {
  slug: 'image',
  nombre: 'Image',
  icono: I.imagen,
  referencia: { nombre: 'PostNitro — creador de carruseles con IA (es)', url: 'https://postnitro.ai/es', leida: '2026-11-14' },
  metaTitle: 'Image de MaKo: los carruseles que funcionan, en tu versión editable',
  metaDesc: `Los carruseles de las cuentas que sigues, con su outlier, y tu versión editable con un clic. Un editor como Canva con el chat de MaKo al lado, tu kit de marca y descarga en ${DESCARGAS_TXT}.`,
  bloques: [
    {
      // Su hero. El marco «Plantillas · 4:5», la franja del kit, «Diseña para» y la tarjeta negra los dibuja ./disenos/image.tsx.
      tipo: 'hero',
      etiqueta: 'El motor de diseño para publicaciones en redes sociales',
      titulo: 'El creador de carruseles con IA que replica lo que funciona.',
      bajada: 'Carruseles, publicaciones, historias, anuncios y miniaturas: diseñados con IA o a mano en un editor de arrastrar y soltar de formato libre, en tu kit de marca, a partir de los carruseles que mejor les funcionan a las cuentas que sigues.',
      visual: { tipo: 'propio', slug: 'image' },
    },
    {
      // Su franja de prueba social: lo que Image trae, contado del código.
      tipo: 'cifras',
      titulo: 'Lo que trae Image hoy',
      items: [
        { valor: String(N_TIPOS), label: 'tipos de carrusel' },
        { valor: String(N_REALES), label: 'plantillas con su ejemplo' },
        { valor: String(N_TAMANOS), label: 'tamaños en blanco' },
        { valor: String(DESCARGAS.length), label: `formatos de descarga: ${DESCARGAS.join(', ')}` },
      ],
    },
    {
      // Su «Pruébalo, no es un video»: la grabación REAL de «Editar» (public/vsl-assets/sitio/carruseles.webm).
      tipo: 'tarjetas',
      etiqueta: 'Editar',
      titulo: 'Eliges uno que funciona y MaKo arma el tuyo.',
      bajada: 'Con «Editar» tienes tu versión del carrusel: su mismo diseño y el texto escrito para tu negocio, lámina por lámina, lista para cambiar en el editor.',
      items: [],
    },
    {
      // Su «PLANTILLAS — Más de 100 plantillas, todas editables»: en MaKo, la portada de Image, «Carruseles que funcionan»
      // (app/image-editor/carruseles/ExplorarCarruseles.tsx), con seis outliers de verdad de la biblioteca.
      tipo: 'tarjetas',
      etiqueta: 'Carruseles que funcionan',
      titulo: 'Los carruseles que funcionan, todos editables.',
      bajada: 'Los de las cuentas que sigues en Competitor Spy y los de una biblioteca de ejemplos, cada uno con su <strong>outlier</strong>: cuántas veces la mediana de su cuenta.',
      items: [],
    },
    {
      tipo: 'pasos',
      titulo: 'De la idea al carrusel listo en tres pasos',
      pasos: [
        { titulo: 'Trae la idea', texto: 'Un carrusel que funciona, un tema, un texto que ya hayas escrito o un ejemplo de la biblioteca. Eliges un tipo de carrusel y nace con sus láminas.' },
        { titulo: 'Hazlo tuyo', texto: 'Tu kit de marca ya está aplicado. Edita cualquier lámina, modifica un titular o déjalo como está y continúa.' },
        { titulo: 'Descárgalo', texto: 'En PNG o JPG, una imagen por lámina, o el carrusel entero en PDF, y publícalo tú mismo.' },
      ],
    },
    {
      // «01 DISEÑO»: la cabecera del grupo. Sus cuatro filas son los cuatro bloques que siguen.
      tipo: 'tarjetas',
      etiqueta: 'Diseño',
      titulo: 'Cada parte de la publicación es tuya para que la moldees a tu gusto.',
      bajada: 'Pídelo por chat o abre el lienzo y configúralo tú mismo. Los carruseles de MaKo salen con tus fuentes, tus colores y tu logo.',
      items: [],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Formatos',
      titulo: 'Carruseles, publicaciones, historias y miniaturas',
      bajada: 'Todos los formatos desde una misma plataforma: eliges el tamaño que pide cada red.',
      items: [
        { icono: I.capas, titulo: 'Carruseles', texto: `De varias láminas, con ${N_TIPOS} tipos para empezar (${TIPOS_TXT}…). Se descargan lámina por lámina en PNG o como un solo PDF.`, meta: `${ANCHO_CARRUSEL} × ${ALTO_CARRUSEL}` },
        { icono: I.vertical, titulo: 'Publicaciones e historias', texto: 'La cuadrada, la vertical y la historia de Instagram, para esos días en que un carrusel es más de lo que la idea requiere.', meta: `${medida('publicacion_instagram')} · ${medida('publicacion_vertical')} · ${medida('historia')}` },
        { icono: I.video, titulo: 'Anuncios y miniaturas', texto: 'El anuncio de Facebook y la miniatura de YouTube, en su tamaño.', meta: `${medida('anuncio_facebook')} · ${medida('miniatura_youtube')}` },
        { icono: I.presentacion, titulo: 'Presentaciones', texto: 'Varias diapositivas en un diseño, y las presentas desde el editor.', meta: medida('presentacion') },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Chat de MaKo',
      titulo: 'MaKo lo diseña contigo',
      bajada: 'Un agente de IA junto al lienzo, siempre abierto. Describe la publicación o pega el texto que ya escribiste; luego, sigue hablando para cambiar cualquier lámina, cualquier color o cualquier diseño.',
      items: [
        { icono: I.ia, titulo: 'Empieza por cualquier cosa', texto: 'Un tema, tu texto, una foto o un PDF. O un ejemplo que te gustó: con «Editar», su mismo diseño con el texto escrito para tu negocio.' },
        { icono: I.ojo, titulo: 'Primero, aprueba el cambio.', texto: 'Cada pedido vuelve como «Original | Modificado». El diseño no se toca hasta que eliges Aceptar, y «Restaurar» lo vuelve atrás.' },
        { icono: I.lapiz, titulo: 'Edita preguntando', texto: 'Cambia un texto, mueve o borra un elemento, suma o saca una lámina. En todo el diseño o sólo en lo que elegiste.' },
        { icono: I.paleta, titulo: 'Rediseña preguntando', texto: 'Colores, fondos, fuentes y tamaños. Y en «Discutir», MaKo te contesta sobre tu diseño sin tocar nada.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Kit de marca',
      titulo: 'Tu kit de marca hace el trabajo de diseño.',
      bajada: 'Subes tu manual de marca una sola vez: MaKo saca tus colores, tus fuentes y tu logo, y tú lo confirmas antes de guardarlo. Cada carrusel de MaKo sale con tu identidad visual.',
      items: [
        { icono: I.paleta, titulo: 'Colores que guardaste', texto: 'Con su rol: el principal, el secundario, el de acento, el del fondo y el del texto.' },
        { icono: I.letra, titulo: 'Tus fuentes', texto: 'Una para los títulos y otra para el texto.' },
        { icono: I.logo, titulo: 'Tu logo', texto: 'En cada carrusel de MaKo, junto con tus colores y tus fuentes.' },
        { icono: I.carpeta, titulo: 'Un kit por marca', texto: 'Si llevas varias marcas, guardas un kit por cada una, y pasar de un cliente a otro es tan sencillo como elegir otro kit.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Lienzo',
      titulo: 'Luego abre el lienzo y colócalo exactamente donde quieras.',
      bajada: 'El chat te ayuda casi por completo. En el lienzo, el diseño libre toma el control, como en Canva.',
      items: [
        { icono: I.tamano, titulo: 'Cualquier tamaño de lienzo', texto: 'Los más pedidos de cada red, o a medida.' },
        { icono: I.formas, titulo: 'Texto, formas, imágenes y marcos', texto: 'Y códigos QR, cada uno en su capa, con recortes, filtros y animaciones.' },
        { icono: I.paginas, titulo: 'Varias páginas en un diseño', texto: 'Un carrusel o una presentación entera, lámina por lámina.' },
        { icono: I.carpeta, titulo: 'Guárdalo como plantilla', texto: 'Convierte tu mejor diseño en una plantilla del negocio: queda en «Crear desde cero».' },
      ],
    },
    {
      // Su grilla de seis debajo de las filas de «01 Diseño»: lo que trae la portada de Image (ExplorarCarruseles).
      tipo: 'tarjetas',
      titulo: 'Lo que trae la portada de Image',
      columnas: 3,
      items: [
        { icono: I.outlier, titulo: 'Su outlier', texto: 'Cuántas veces la mediana de su cuenta. Ordenas por «Mayor outlier» y lo que mejor le funcionó a cada cuenta sale primero.' },
        { icono: I.lupa, titulo: 'Busca y vuelve', texto: 'Por tema o por @cuenta, y guardas la búsqueda para volver.' },
        { icono: I.filtro, titulo: 'Filtra', texto: 'Por fecha, cantidad de láminas, tipo de carrusel y cuentas.' },
        { icono: I.cta, titulo: 'El CTA, a la vista', texto: 'Si el carrusel pide comentar una palabra («Comenta GUÍA»), la tarjeta lo dice.' },
        { icono: I.anuncio, titulo: 'Anuncios de la competencia', texto: 'Los que trajo Competitor Spy de las cuentas que sigues, ordenados por cuántos días llevan al aire.' },
        { icono: I.guardar, titulo: 'Guardados', texto: 'Los carruseles que te sirven quedan guardados, y las láminas se pasan dentro de la tarjeta.' },
      ],
    },
    {
      // «02 AUTOMATIZAR» (su 03: su 02 es el cronograma, que Image no tiene): sus cuatro tarjetas negras.
      tipo: 'tarjetas',
      etiqueta: 'Automatizar',
      titulo: 'El mismo motor, como sea que lo conduzcas.',
      bajada: 'Diseña a mano en el editor o deja que el chat, WhatsApp o tu propio código lo hagan por ti. Las mismas plantillas y los mismos diseños para todos ellos.',
      items: [
        { icono: I.formas, titulo: 'A mano', meta: 'Arrastrar y soltar', texto: 'En el lienzo, como en Canva: texto, formas, imágenes, marcos y capas.' },
        { icono: I.ia, titulo: 'En el chat del editor', meta: 'Original | Modificado', texto: 'Al lado del lienzo, con el diseño abierto. Nada cambia hasta que eliges Aceptar.' },
        { icono: I.wa, titulo: 'Por WhatsApp', meta: 'Te devuelve el link', texto: 'Le pides a MaKo un diseño desde una plantilla o que le cambie los textos, y te devuelve el link para abrirlo.' },
        { icono: I.api, titulo: 'Con la API de MaKo', meta: 'crear_diseno_imagen', texto: 'Tu sistema ve tus diseños, crea uno desde una plantilla y le cambia los textos, con tu token.' },
      ],
    },
    {
      // Su grilla de nueve debajo de las tarjetas negras: lo que la API de MaKo hace con Image (lib/api-mako/areas/imagen.def.ts).
      tipo: 'tarjetas',
      titulo: 'Lo que la API de MaKo hace con tus diseños',
      columnas: 3,
      items: [
        { icono: I.paginas, titulo: 'Ver tus diseños', texto: 'Del más nuevo al más viejo, con su tamaño, sus páginas y el link para abrirlo.' },
        { icono: I.lista, titulo: 'Leer sus textos', texto: 'Los textos de cada página, en orden, para cambiarlos tal como están.' },
        { icono: I.capas, titulo: 'Crear uno desde una plantilla', texto: 'En blanco, de un tamaño con nombre o a medida, o desde una plantilla con su ejemplo.' },
        { icono: I.lapiz, titulo: 'Cambiar los textos', texto: 'Cada texto pasa a ser el nuevo, en todas las páginas, con su mismo estilo.' },
        { icono: I.carpeta, titulo: 'Hacer una copia', texto: 'Con «(copia)» en el título, y te devuelve su link.' },
        { icono: I.outlier, titulo: 'Buscar carruseles que funcionan', texto: 'Por tema o por @cuenta, con su creador, el link al original y su outlier.' },
      ],
    },
    { tipo: 'caso' },
    {
      // Las preguntas son las de la portada (../_sitio/preguntas.ts; Martín, 14/11/2026: «tienen que ser siempre las mismas»):
      // las ponen el registro y LandingCompetencia; van acá también para quien lea LANDING_IMAGE suelto.
      tipo: 'preguntas',
      titulo: 'Lo que realmente hace Image',
      items: PREGUNTAS_SITIO.map((q) => ({ p: q.p, r: q.r })),
    },
  ],
};
