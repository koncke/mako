// =============================================================================
// /vsl/classroom — Classroom, el curso y la comunidad de tus alumnos, con la ESTRUCTURA y el DISEÑO de la portada de Circle
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el diseño):
//   https://circle.so/  (leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px; Circle sirve ese día la versión que
//   redirige a circle.so/b, con el titular que gira, y su texto de abajo es el mismo de la otra: «The complete community platform»)
// El diseño copiado vive en ./disenos/classroom.tsx, con los valores medidos de la referencia en su cabecera.
// Su orden, que se respeta aquí: el titular que gira («Run your community business on Circle») con su renglón chico y su botón → su
// cinta de casos con cifras → «Where all-in-one meets best-in-class» (pestañas sobre una captura grande, en el azul noche) y «What is
// Circle?» → «Yes, you really can run everything on Circle» y sus grupos (Community, Branded app, Payments…: título, bajada, píldoras y
// el panel de color con su lista y su captura) → «Great communities transform people» (la grilla de tarjetas blancas) → «Loved by the
// best» (sus testimonios) → «Join thousands and build your home on Circle today» → su pie.
//
// POR QUÉ ÉSTA. docs/competencia/landings-por-funcion.md eligió Skool el 11/11/2026 (la comunidad de MaKo copia la de Skool tal cual,
// app/_comunidad/Comunidad.tsx), pero Skool no tiene una página de producto: su portada es el directorio de comunidades
// (leída el 16/11/2026: «Discover communities or create your own»), /about son dos párrafos y /pricing, dos tarjetas. Circle es la
// plataforma de comunidad y cursos con la landing más completa de las que MaKo reemplaza (app/vsl/_sitio/reemplaza.ts: Skool, Kajabi,
// Hotmart y Circle; Kajabi no tiene página de comunidades, da 404), y su portada vende lo mismo: el curso, la comunidad y el acceso
// en un solo lugar.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su cinta de casos («$1.9M revenue per cohort», Ali Abdaal…) son clientes y cifras suyas: no van. En su lugar, con la misma
//     tarjeta, de dónde puede venir el video de cada clase, contado del código (PROVEEDORES_EMBED de lib/embeds.ts).
//   · Su formulario de email del hero es el botón de MaKo (./cta.ts); sus estrellas y «70k+ reviews», no (no hay reseñas).
//   · «Built for pros. Chosen by the best.» (diez creadores famosos) no va: MaKo no tiene esos clientes. «Loved by the best» es el
//     caso de Mauricio, que tiene su Classroom en MaKo (el mismo de todas las landings, ./marca.tsx).
//   · Sus seis grupos son tres: Comunidad, Cursos y Acceso. Su app con tu marca en las tiendas, su IA, su email y su constructor de
//     sitios no van: MaKo no publica una app con tu marca, y el email y las páginas son otras landings (/vsl/email, /vsl/web-generator).
//   · Sus capturas son de su producto; las de MaKo, el portal REAL del alumno (app/compartido/curso/[token]/PortalAlumno.tsx y la
//     comunidad de app/_comunidad) con un curso de ejemplo de nombres ficticios y el video que Mauricio dejó en su Classroom:
//     C:/dev/bancos-portada/banco-classroom-landing (fotos.mjs).
//   · Su pie es el del sitio (PieGlobal); su barra, la del sitio (BarraGlobal), como en todas las landings.
// Lo que NO se promete: que sea ilimitado en Essential (un curso; ilimitados en Pro: TOPES de lib/topes-plan.ts), que la comunidad sea de
// los dos planes (es de Pro: 'comunidad' en FUNCIONES_SOLO_PRO), una app propia en las tiendas, ni cobrar adentro del curso (el cobro es
// del CRM: /vsl/cobranza).
// =============================================================================

import { PROVEEDORES_EMBED } from '@/lib/embeds';
import { NIVEL_MAX } from '@/lib/comunidad-niveles';
import { TOPES } from '@/lib/topes-plan';
import { seVendeEnPro } from './solo-pro';
import type { LandingCompetencia } from './tipos';

/** La comunidad es de MaKo Pro ('comunidad' en FUNCIONES_SOLO_PRO): el aviso sale de ahí, no se escribe. */
export const AVISO_COMUNIDAD = seVendeEnPro('comunidad') ? ' La comunidad, con MaKo Pro.' : '';

/** Cuántos cursos trae cada plan (TOPES de lib/topes-plan.ts: null = ilimitado). Si cambia el tope, cambia la frase. */
const cursos = (n: number | null) => (n == null ? 'cursos ilimitados' : n === 1 ? 'un curso' : `${n} cursos`);
export const CURSOS_POR_PLAN = `Con MaKo Essential, ${cursos(TOPES.completo['classroom.cursos'])}; con MaKo Pro, ${cursos(TOPES.agencia['classroom.cursos'])}.`;

/** De dónde puede venir el video de una clase: los alojadores que el curso reconoce (el `videoTipo` y el `proveedor` de lib/curso.ts),
 *  con el nombre que les da lib/embeds.ts. Fathom también es «video» en embeds, pero es de las llamadas, no de las clases: no va. */
export const VIDEOS_DE_CLASE: readonly { id: keyof typeof PROVEEDORES_EMBED; nombre: string }[] = (
  ['youtube', 'vimeo', 'loom', 'drive', 'panda', 'wistia', 'bunny', 'cloudflare'] as const
).map((id) => ({ id, nombre: PROVEEDORES_EMBED[id].nombre }));

/** Los candados de un módulo o una clase, con las palabras del editor del curso (app/customer-success/curso/bloqueo-editor.ts, `TEXTO`;
 *  no se exporta: el test los busca en ese archivo). «Abierto» es el de siempre y no va en la lista. */
export const CANDADOS: readonly string[] = ['Al terminar el anterior', 'Días después de entrar', 'En una fecha', 'Con la tarea de otra clase', 'Con un nivel de la comunidad', 'A mano'];

/** Los textos del diseño que no son un bloque (el renglón del hero que gira, el título de los grupos y el cierre). */
export const TEXTOS_CLASSROOM = {
  /** Lo que gira en «Aloja tu … en MaKo», como sus «community, coaching, course…». */
  gira: ['curso', 'comunidad', 'programa', 'mentoría'],
  grupos: { titulo: 'Sí, puedes entregar todo tu programa en MaKo', bajada: 'La única app que tus alumnos necesitan para hacer tu programa.' },
  cierre: 'Aloja tu curso y tu comunidad en MaKo hoy',
} as const;

const I = {
  // «school» de Tabler (MIT), como los demás íconos de las landings.
  classroom: ['M22 9l-10 -4l-10 4l10 4l10 -4v6', 'M6 10.6v5.4a6 3 0 0 0 12 0v-5.4'],
};

export const LANDING_CLASSROOM: LandingCompetencia = {
  slug: 'classroom',
  nombre: 'Classroom · tu curso y tu comunidad',
  icono: I.classroom,
  referencia: { nombre: 'Circle · The complete community platform', url: 'https://circle.so/', leida: '16/11/2026' },
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Classroom',
      // Su titular grande gira («Run your community / coaching / course… business on Circle»): éste es el que lee Google y el lector
      // de pantalla; el diseño lo dibuja con la palabra que gira (TEXTOS_CLASSROOM.gira).
      titulo: 'Aloja tu curso y tu comunidad en MaKo',
      // Su renglón chico («The #1 AI platform for community, learning, and coaching businesses.»), con el aviso de Pro.
      bajada: `El curso y la comunidad de tus alumnos, adentro de la app con la que les vendes.${AVISO_COMUNIDAD}`,
      visual: { tipo: 'detalle', slug: 'classroom' },
    },
    {
      // Donde va su cinta de casos: de dónde viene el video de cada clase (el título no se ve, como su cinta, que no lleva).
      tipo: 'tarjetas',
      titulo: 'El video de cada clase, de donde ya lo tienes',
      items: [
        ...VIDEOS_DE_CLASE.map((v) => ({ titulo: v.nombre, texto: 'en cada clase', meta: 'Video' })),
        { titulo: 'Tu archivo', texto: 'subido a MaKo', meta: 'Video' },
      ],
    },
    {
      // «Where all-in-one meets best-in-class»: sus pestañas sobre una captura grande. Cada una, una pantalla del portal del alumno.
      tipo: 'tarjetas',
      titulo: 'Todo tu programa, en un solo lugar',
      bajada: 'No necesitas otra app: tu curso, sus tareas y tu comunidad viven al lado de tu CRM.',
      items: [
        { titulo: 'Curso', texto: 'La portada del curso en el portal del alumno: sus módulos con su portada, el último con candado, y lo que avanzó.' },
        { titulo: 'Clase', texto: 'Una clase con su video de YouTube en su reproductor y «Marcar como hecha».' },
        { titulo: 'Tarea', texto: 'La tarea de una clase: una respuesta larga, una opción y un archivo para subir.' },
        { titulo: 'Comunidad', texto: 'La comunidad: las publicaciones con sus categorías, likes y comentarios, y el ranking de 30 días al costado.' },
        { titulo: 'Ranking', texto: 'El ranking: el nivel de la alumna, los nueve niveles y las tablas de 7 días, 30 días y de siempre.' },
      ],
    },
    {
      // «What is Circle?»: la captura a un lado, y su título, su renglón en negrita, su párrafo y su botón al otro.
      tipo: 'tarjetas',
      titulo: '¿Qué es Classroom?',
      cta: true,
      items: [{
        titulo: 'Classroom es la casa de tus alumnos adentro de MaKo.',
        texto: `Desde el curso hasta la comunidad, con las tareas de cada clase y lo que avanza cada alumno: todo lo que necesitas para entregar lo que vendiste, en la misma app donde lo vendiste. ${CURSOS_POR_PLAN}`,
      }],
    },
    {
      // Sus grupos: título, bajada y píldoras; cada píldora cambia el panel de color (su frase, su lista y su captura).
      tipo: 'tarjetas',
      titulo: 'Comunidad',
      bajada: `Publicaciones con categorías, comentarios y likes, un calendario para tus llamadas en vivo y un ranking que premia a los que más aportan.${AVISO_COMUNIDAD}`,
      items: [
        {
          titulo: 'Publicaciones', meta: 'Dales a tus alumnos un lugar al que quieran volver.', texto: 'La comunidad del portal del alumno',
          puntos: ['Publicaciones con sus categorías', 'Comentarios, likes y menciones', 'Lo importante, fijado arriba', 'Búsqueda de publicaciones y de miembros'],
        },
        {
          titulo: 'Ranking', meta: 'Puntos y niveles para que sigan aportando.', texto: 'El ranking de la comunidad',
          puntos: [`${NIVEL_MAX} niveles, con el nombre que les pongas`, 'Cada like que recibe, un punto', 'El ranking de 7 días, de 30 días y de siempre', 'Clases que se abren al llegar a un nivel'],
        },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Cursos',
      bajada: `Módulos y clases con su video, tareas en cada clase y candados para abrir cada parte cuando corresponde. ${CURSOS_POR_PLAN}`,
      items: [
        {
          titulo: 'Clases', meta: 'El video de cada clase, de donde ya lo tienes.', texto: 'Una clase con su video',
          puntos: ['YouTube, Vimeo, Loom y Drive', 'Panda Video, Wistia, Bunny y Cloudflare Stream', 'O tu archivo, subido a MaKo', '«Marcar como hecha» en cada clase'],
        },
        {
          titulo: 'Tareas', meta: 'Lo que tu alumno contesta en cada clase.', texto: 'La tarea de una clase',
          puntos: ['Textos, opciones, archivos, audios y videos', 'Una escala, una lista para tildar o un quiz con nota', 'Agendar una llamada desde la tarea', 'Publicar o comentar en la comunidad'],
        },
        {
          titulo: 'Candados', meta: 'Cada módulo y cada clase se abre cuando corresponde.', texto: 'Los módulos del curso, el último con candado',
          puntos: [...CANDADOS],
        },
        {
          titulo: 'Tu marca', meta: 'Con tus colores, tu letra y tus portadas.', texto: 'Los módulos del curso con sus portadas',
          puntos: ['El color de tu marca', 'La letra que elijas', 'Una portada para cada módulo y cada clase', 'Lo mismo que ves tú lo ve tu alumno'],
        },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Acceso',
      bajada: 'Tus alumnos entran con su link personal, sin crear una cuenta, y sólo ven las clases de lo que te compraron.',
      items: [
        {
          titulo: 'Al ganar la venta', meta: 'Cierras la venta en el CRM y MaKo invita a tu cliente a su curso.', texto: 'El portal del alumno',
          puntos: ['Se prende por funnel, si lo quieres', 'Le llega por email y por WhatsApp', 'Desde tu email, si lo conectas', 'Queda anotado en el historial del lead'],
        },
        {
          titulo: 'Su link personal', meta: 'Entra a su curso sin usuario ni contraseña.', texto: 'El portal del alumno',
          puntos: ['Un link firmado para cada alumno', 'Sólo ve las clases de sus productos', 'Le cortas el acceso cuando quieras'],
        },
      ],
    },
    {
      // «Great communities transform people»: su grilla de tarjetas blancas (dos, tres y dos).
      tipo: 'tarjetas',
      titulo: 'Un buen programa transforma a tus alumnos',
      bajada: 'MaKo junta todo lo que necesitas para que te enfoques en entregar.',
      fondo: true,
      items: [
        { titulo: 'Ordena tu programa en módulos y clases', texto: 'curso' },
        { titulo: 'Cada clase, con su video', texto: 'clase' },
        { titulo: 'Tareas que tu alumno contesta en la clase', texto: 'tarea' },
        { titulo: 'Cada parte se abre cuando corresponde', texto: 'candados' },
        { titulo: 'Una comunidad para preguntar y compartir', texto: 'comunidad' },
        { titulo: 'Niveles que premian a los que más aportan', texto: 'ranking' },
        { titulo: 'Entran sólo los que te compraron', texto: 'acceso' },
      ],
    },
    // «Loved by the best»: el caso de Mauricio, que tiene su Classroom en MaKo.
    { tipo: 'caso' },
  ],
  metaTitle: 'Classroom de MaKo: tu curso y tu comunidad, en la app con la que vendes',
  metaDesc: `Aloja tu curso y tu comunidad en MaKo: módulos y clases con su video, tareas, candados, un ranking con niveles y la invitación de cada alumno cuando ganas la venta en tu CRM. ${CURSOS_POR_PLAN}${AVISO_COMUNIDAD}`,
};
