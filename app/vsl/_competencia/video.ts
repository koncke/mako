// =============================================================================
// /vsl/video — Video, el editor de video de MaKo, con la ESTRUCTURA de la portada de Cherry Studio (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, el DISEÑO):
//   https://cherrysweet.app/  (leída el 11/11/2026 y otra vez el 14/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/video.tsx; los valores medidos, en docs/diseno/landings-competencia/video.md.
// Su orden, RELEÍDO el 14/11/2026 (Cherry cambió su portada: la versión B, sin video de ventas): hero con su vitrina de cuatro
// tarjetas y calcomanías → (su calendario: «Tu semana de contenido se publica sola») → la fila de dos tarjetas («Conecta tu
// Instagram» + «Tres pasos») → «Lo que Cherry hace por ti» → (virales, plantillas, conector, simulador) → «Arrastra y mira lo que
// le quita a tu video» (sigue en su página, escondida) → la banda «Y todo lo que rodea al video también lo tiene» → (con qué
// trabaja, precios) → «Lo que más nos preguntan» → la banda final. Acá: el comparador ocupa la tarjeta izquierda de su fila de
// dos (la de Instagram, que MaKo no tiene) y los tres pasos la derecha, como en Cherry. El relevo sección por sección, con las
// capturas y los videos de sus animaciones: side-session-notes/…/referencias-landings/video-cherry/relevo.md.
// Por qué ganó: docs/competencia/landings-por-funcion.md → «Video (editor)». No tiene testimonios, así que esta landing tampoco.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su simulador para probar sin cuenta, su conector con Claude y ChatGPT y «Marcas que se hicieron virales» (los números
//     de sus clientes): MaKo no tiene nada de eso para mostrar. No van.
//   · «Tu semana de contenido se publica sola» (su calendario) y «Conecta tu Instagram»: Video no publica ni se conecta a
//     Instagram (exporta el video). No van; su lugar en la fila de dos tarjetas lo toma el comparador.
//   · «Tu IA puede hacer videos así» (el mosaico de sus plantillas que corre con el scroll): las imágenes de las escenas de
//     AI Avatar (public/formatos/presets/) muestran a un hombre que se parece a Mauricio, que es cliente, y no hay otras tomas
//     de MaKo para llenarlo. No va hasta tener videos hechos con MaKo por Martín.
//   · «Cherry Studio trabaja con» (la cinta de logos) y sus precios: ninguna landing de /vsl escribe un precio a mano.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['video-editor', 'ai-avatar']) y del editor (la «Edición automática» de
// app/video-editor/_opencut/enjambre/, los lienzos y las plantillas de app/video-editor/plantillas-crear.ts). Lo que todavía no
// (guardar en la nube, filmar sola los clips) va en las preguntas con «Todavía no».
//
// LOS TEXTOS DE CHERRY, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «ESTUDIO DE CONTENIDO CON IA»; «[Cherry Studio] tu contenido, de la idea a los resultados» → «[MaKo] tu contenido,
//     de la idea al video listo» (Video no mide los resultados de tus videos: exporta);
//   · su cierre «Súbelo tal cual salió y míralo volver cortado, con subtítulos y con tu voz de estudio» como bajada, sin
//     la voz de estudio (MaKo deja el volumen listo y quita el ruido);
//   · sus chips «Corta las pausas», «Subtítulos al ritmo»; «Publica sola» y «Te dice qué grabar» no son de MaKo → «Replica
//     lo que funciona» (los outliers) y «Tu personaje con IA»;
//   · «Lo que Cherry hace por ti» (→ MaKo) con sus pasos «Edita tu reel sola» (su frase: «Subes los clips tal cual salen
//     del celular… Corta las pausas, que es donde la gente desliza»), «Pone los efectos y los gráficos» (→ los subtítulos
//     que «caen justo cuando dices cada palabra» y el B-roll), «Te dice qué grabar para crecer» (→ «Te muestra qué
//     grabar»: los outliers; no lee estadísticas); «Publica tus reels por ti» no va;
//   · «Mira lo que le quita a tu video» con «Tal cual salió» / «Con MaKo»; «Antes y después de grabar» / «Y todo lo que
//     rodea al video también lo tiene» con «Guiones» («Con tu tono y tus frases, a mano o con ayuda de la IA») y «Voz y
//     sonido» (→ el ruido y el volumen: «Reducir el ruido» de app/video-editor/_opencut/audio/);
//   · «Cómo empiezas» / «Tres pasos y tienes tu primer reel», «Sube tu video tal cual salió» / «Con las pausas, los
//     errores y todo», «Revísalo y publícalo» (→ «descárgalo»); «Lo que más nos preguntan» con «¿Tengo que saber editar?»
//     (su respuesta tal cual) y «¿Tengo que conectar mi Instagram?».
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
  referencia: { nombre: 'Cherry Studio — editor de reels con IA', url: 'https://cherrysweet.app/', leida: '2026-11-14' },
  metaTitle: 'Video de MaKo: tu contenido, de la idea al video listo',
  metaDesc: 'Súbelo tal cual salió y míralo volver cortado y con subtítulos. Un editor como CapCut con MaKo al lado, los videos que funcionan para replicarlos y tu personaje con IA.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Estudio de contenido con IA',
      // <em> marca la palabra que Cherry pone en su pastilla de color (allá, «Cherry Studio»).
      titulo: '<em>MaKo</em> tu contenido, de la idea al video listo',
      bajada: 'Súbelo tal cual salió y míralo volver cortado y con subtítulos. La <strong>Edición automática</strong> quita las pausas, subtitula, propone B-roll y deja el volumen listo, y todo lo ves pasar en la línea de tiempo.',
      puntos: ['Corta las pausas', 'Subtítulos al ritmo', 'Replica lo que funciona', 'Tu personaje con IA'],
      visual: { tipo: 'propio', slug: 'video' },
    },
    {
      tipo: 'contraste',
      // El comparador de Cherry («Pruébalo tú», escondido en su portada desde el 12/11) con la línea de tiempo REAL del editor antes
      // y después de la Edición automática; ocupa la tarjeta izquierda de su fila de dos.
      etiqueta: 'Pruébalo tú',
      titulo: 'Arrastra y mira lo que le quita <em>a tu video</em>',
      sin: {
        titulo: 'Tal cual salió',
        texto: 'Silencios al principio, pausas para pensar, nada escrito en pantalla y el volumen que sube y baja. <strong>Así, la gente pasa al siguiente.</strong>',
      },
      con: {
        titulo: 'Con MaKo',
        texto: 'Sin pausas, con subtítulos que siguen tu voz, B-roll donde hace falta y el audio parejo. Y si algo no te gusta, lo cambias a mano en la línea de tiempo.',
      },
    },
    {
      tipo: 'pasos',
      etiqueta: 'Cómo empiezas',
      titulo: 'Tres pasos y tienes tu primer reel',
      pasos: [
        { titulo: 'Elige de dónde arrancas', texto: 'Un video que funciona para replicar, una plantilla o un formato vacío.' },
        { titulo: 'Sube tu video tal cual salió', texto: 'Con las pausas, los errores y todo. O crea las tomas con tu personaje o con IA.' },
        { titulo: 'Revísalo y descárgalo', texto: 'MaKo hace el trabajo pesado. Tú decides qué queda y lo exportas.' },
      ],
    },
    {
      tipo: 'tarjetas',
      etiqueta: 'Lo que hace',
      titulo: 'Lo que MaKo hace <em>por ti</em>',
      // `meta`: la calcomanía que Cherry pega sobre el marco del paso abierto (su data-pega).
      items: [
        { icono: I.varita, meta: 'Corta las pausas', titulo: 'Edita tu reel solo', texto: 'Subes el clip tal cual sale del celular y MaKo corta las pausas, que es donde la gente desliza, y deja el volumen listo. Un equipo de agentes lo hace <strong>a la vista</strong>, paso por paso en el editor.' },
        { icono: I.texto, meta: 'Subtítulos al ritmo', titulo: 'Pone los subtítulos y el B-roll', texto: 'Los subtítulos caen justo cuando dices cada palabra, con estilos para elegir, y en los momentos que lo piden te propone tomas de apoyo.' },
        { icono: I.rayo, meta: 'Replica lo que funciona', titulo: 'Te muestra qué grabar', texto: 'Abre con «Encuentra tu siguiente outlier»: videos que funcionan, para <strong>replicarlos con tu mensaje</strong> con un toque.' },
        { icono: I.chat, meta: 'Original y modificado', titulo: 'Lo cambias con MaKo', texto: 'Le escribes el cambio y te lo muestra: <strong>original y modificado</strong>, y lo aceptas tú. Y si quieres, lo haces a mano en la línea de tiempo.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Antes y después de grabar',
      titulo: 'Y todo lo que rodea al video también lo tiene',
      items: [
        { icono: I.guion, titulo: 'Guiones', texto: 'Con tu tono y tus frases, a mano o con ayuda de la IA, en Copywriting.' },
        { icono: I.volumen, titulo: 'Voz y sonido', texto: 'Quita el ruido de fondo y deja el volumen parejo de punta a punta.' },
        { icono: I.guia, titulo: '«Mensaje para…»', texto: 'Una plantilla guiada: MaKo te pide en el chat la referencia, tu guion, tu foto, tu voz y el fondo, paso a paso.' },
        { icono: I.avatar, titulo: 'Tu personaje con IA', texto: `Tu avatar con tu cara, en una de ${PLANTILLAS_AVATAR.length} escenas, diciendo tu guion.` },
        { icono: I.video, titulo: 'Generar con IA', texto: 'Tus guiones pasan a tomas y montaje, generados con Google Flow, y de ahí al editor.' },
        { icono: I.formato, titulo: 'El formato de cada red', texto: 'Arrancas en Reel o TikTok, YouTube, cuadrado o post, o desde una plantilla de anuncio.' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: 'Lo que más <em>nos preguntan</em>',
      items: [
        { p: '¿Tengo que saber editar?', r: 'No. Subes el video como salió del celular y MaKo hace el trabajo pesado. Tú lo revisas y decides qué sale. Las plantillas guiadas abren en un modo simple, con menos botones; si quieres todo, está «Todas las herramientas».' },
        { p: '¿Puedo editar a mano?', r: 'Sí: línea de tiempo con cortes y keyframes, como en CapCut. Lo que hace MaKo lo puedes cambiar.' },
        { p: '¿Tengo que conectar mi Instagram?', r: 'No. Video exporta el archivo y lo publicas tú donde quieras: no publica en Instagram.' },
        { p: '¿Filma los clips sola?', r: 'Todavía no: en «Mensaje para…» las tomas se arman con tu personaje con IA y con el Video Generator.' },
        { p: '¿Dónde se guardan mis proyectos?', r: 'En tu navegador. Todavía no se guardan en la nube.' },
      ],
    },
  ],
};
