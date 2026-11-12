// =============================================================================
// /vsl/video — Video, el editor de video de MaKo, con la ESTRUCTURA de la portada de Cherry Studio (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, el DISEÑO):
//   https://cherrysweet.app/  (leída el 11/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/video.tsx; los valores medidos, en docs/diseno/landings-competencia/video.md.
// Su orden, que se respeta acá: hero con cuatro chips («Corta las pausas», «Subtítulos al ritmo»…) → «Lo que Cherry hace
// por ti» → (su video en acción y su simulador) → «Arrastra y mira lo que le quita a tu video» (antes / después) → «Y todo lo
// que rodea al video también lo tiene» → (publicar sola, conectar Instagram) → «Tres pasos y tienes tu primer reel» →
// (con qué trabaja, sus precios) → «Lo que más nos preguntan» → el cierre. Por qué ganó: docs/competencia/landings-por-funcion.md
// → «Video (editor)». No tiene testimonios, así que esta landing tampoco lleva el caso.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su video de demo y su simulador para probar sin cuenta: MaKo no tiene ninguno de los dos para mostrar. No van.
//   · «Publica sola», «Tu semana de contenido se publica sola» y «Conecta tu Instagram»: Video no publica ni se conecta a
//     Instagram (exporta el video). No van; la pregunta «¿Lo publica en Instagram?» lo dice.
//   · Sus precios: ninguna landing de /vsl escribe un precio a mano (el cierre es la llamada).
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['video-editor', 'ai-avatar']) y del editor (la «Edición automática» de
// app/video-editor/_opencut/enjambre/, los lienzos y las plantillas de app/video-editor/plantillas-crear.ts). Lo que todavía no
// (guardar en la nube, filmar sola los clips) va en las preguntas con «Todavía no».
// =============================================================================

import { PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import type { LandingCompetencia } from './tipos';

const I = {
  video: ['M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z', 'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'],
  varita: ['M6 21l15 -15l-3 -3l-15 15l3 3', 'M15 6l3 3', 'M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2', 'M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2'],
  tijera: ['M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M8.6 8.6l10.4 10.4', 'M8.6 15.4l10.4 -10.4'],
  texto: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  capas: ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
  volumen: ['M15 8a5 5 0 0 1 0 8', 'M17.7 5a9 9 0 0 1 0 14', 'M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5'],
  chat: ['M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1'],
  rayo: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  avatar: ['M10 9a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M4 8v-2a2 2 0 0 1 2 -2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2 -2v-2', 'M8 16a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2'],
  guion: ['M14 3v4a1 1 0 0 0 1 1h4', 'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z', 'M9 9l1 0', 'M9 13l6 0', 'M9 17l6 0'],
  formato: ['M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M9 4v16'],
  guia: ['M9 11l3 3l8 -8', 'M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9'],
};

export const LANDING_VIDEO: LandingCompetencia = {
  slug: 'video',
  nombre: 'Video',
  icono: I.video,
  referencia: { nombre: 'Cherry Studio — editor de reels con IA', url: 'https://cherrysweet.app/', leida: '2026-11-11' },
  metaTitle: 'Video de MaKo: sube tu clip y MaKo lo edita contigo',
  metaDesc: 'Un editor como CapCut con MaKo al lado: la Edición automática quita las pausas, subtitula, propone B-roll y deja el volumen listo. Replica un video que funciona o crea tu personaje con IA.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Video: tus reels y tus anuncios, editados con IA',
      // <em> marca la palabra que Cherry pone en su pastilla de color (allá, «Cherry Studio»).
      titulo: 'Súbelo como salió del celular. <em>MaKo</em> lo edita contigo.',
      bajada: 'Un editor como CapCut con MaKo al lado. La <strong>Edición automática</strong> quita las pausas, subtitula, propone B-roll y deja el volumen listo, y todo lo ves pasar en la línea de tiempo.',
      puntos: ['Quita las pausas y los silencios', 'Subtítulos que siguen tu voz', 'Replica un video que ya funciona'],
      visual: { tipo: 'propio', slug: 'video' },
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Lo que hace',
      titulo: 'Lo que MaKo hace <em>por tu video</em>',
      items: [
        { icono: I.varita, titulo: 'Edición automática', texto: 'Un equipo de agentes trabaja tu video <strong>a la vista</strong>: lo ves avanzar paso por paso en el editor.' },
        { icono: I.tijera, titulo: 'Quita las pausas', texto: 'Corta los silencios y los tiempos muertos para que el video vaya al ritmo.' },
        { icono: I.texto, titulo: 'Subtítulos', texto: 'Escucha lo que dices y lo pone en pantalla, con estilos para elegir.' },
        { icono: I.capas, titulo: 'B-roll de MaKo', texto: 'Te propone las tomas de apoyo para los momentos que lo piden.' },
        { icono: I.volumen, titulo: 'El volumen, listo', texto: 'Deja el audio parejo de punta a punta, sin que toques un control.' },
        { icono: I.chat, titulo: 'Pídeselo a MaKo', texto: 'Le escribes el cambio y te lo muestra: <strong>original y modificado</strong>, y lo aceptas tú.' },
      ],
    },
    {
      tipo: 'contraste',
      etiqueta: 'Antes y después',
      titulo: 'Mira lo que le quita <em>a tu video</em>',
      sin: {
        titulo: 'El clip como salió del celular',
        texto: 'Silencios al principio, pausas para pensar, nada escrito en pantalla y el volumen que sube y baja. <strong>Así, la gente pasa al siguiente.</strong>',
      },
      con: {
        titulo: 'El mismo clip, editado con MaKo',
        texto: 'Sin pausas, con subtítulos que siguen tu voz, B-roll donde hace falta y el audio parejo. Y si algo no te gusta, lo cambias a mano en la línea de tiempo.',
      },
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Además del editor',
      titulo: 'Y todo lo que rodea al video también lo tiene',
      items: [
        { icono: I.rayo, titulo: 'Encuentra tu siguiente outlier', texto: 'Videos que funcionan, para <strong>replicarlos con tu mensaje</strong> con un toque.' },
        { icono: I.guia, titulo: '«Mensaje para…»', texto: 'Una plantilla guiada: MaKo te pide en el chat la referencia, tu guion, tu foto, tu voz y el fondo, paso a paso.' },
        { icono: I.avatar, titulo: 'Tu personaje con IA', texto: `Tu avatar con tu cara, en una de ${PLANTILLAS_AVATAR.length} escenas, diciendo tu guion.` },
        { icono: I.video, titulo: 'Generar con IA', texto: 'Tus guiones pasan a tomas y montaje, generados con Google Flow, y de ahí al editor.' },
        { icono: I.formato, titulo: 'El formato de cada red', texto: 'Arrancas en Reel o TikTok, YouTube, cuadrado o post, o desde una plantilla de anuncio.' },
        { icono: I.guion, titulo: 'Tus guiones', texto: 'Los escribes con MaKo en Copywriting y los grabas o los generas desde Video.' },
      ],
    },
    {
      tipo: 'pasos',
      etiqueta: 'Cómo empiezas',
      titulo: 'Tres pasos y tienes tu primer video',
      pasos: [
        { titulo: 'Elige de dónde arrancas', texto: 'Un video que funciona para replicar, una plantilla o un formato vacío.' },
        { titulo: 'Sube tu clip', texto: 'Tal como salió del celular, o crea las tomas con tu personaje o con IA.' },
        { titulo: 'Edítalo con MaKo y expórtalo', texto: 'La Edición automática hace el trabajo pesado, ajustas lo que quieras y lo descargas.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Lo que más <em>nos preguntan</em>',
      items: [
        { p: '¿Necesito saber editar?', r: 'No. Las plantillas guiadas abren en un modo simple, con menos botones. Si quieres todo, está «Todas las herramientas».' },
        { p: '¿Puedo editar a mano?', r: 'Sí: línea de tiempo con cortes y keyframes, como en CapCut. Lo que hace MaKo lo puedes cambiar.' },
        { p: '¿Lo publica en Instagram?', r: 'No. Video exporta el archivo y lo publicas tú donde quieras.' },
        { p: '¿Filma los clips sola?', r: 'Todavía no: en «Mensaje para…» las tomas se arman con tu personaje con IA y con el Video Generator.' },
        { p: '¿Dónde se guardan mis proyectos?', r: 'En tu navegador. Todavía no se guardan en la nube.' },
      ],
    },
  ],
};
