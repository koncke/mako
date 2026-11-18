// El tutorial de Classroom › Community (/classroom/community: app/_comunidad/Feed.tsx, adentro de ComunidadEquipo). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `classroom-community`): la sub-tab de Classroom (`que-es`: el link de ClientsShell, que lleva la
// ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija el manifiesto
// (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · LA COMUNIDAD ES SÓLO DE MaKo Pro (lib/comunidad-solo-pro.ts): con MaKo Essential, y en su prueba, la pantalla es el candado
//   (CartelSoloPro) y el motor saltea todo menos la sub-tab. Se midió dibujando la comunidad como la ve un negocio con Pro.
// · «Categorías» marca la fila de categorías del feed (con el lápiz «Categorías» al final, que abre su editor). El menú del post es
//   el del PRIMER post del feed (Feed.tsx le pasa la marca a su `Menu`): sin ningún post no existe y el motor saltea el paso.
// · «Escribe algo» es el botón que abre el compositor (el campo con ese texto vive adentro). Va sin `clic`: el botón se apaga para
//   el alumno que no llegó al nivel para publicar (al equipo nunca, pero el componente es el mismo).
// · En el teléfono (/m/comunidad), sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_COMMUNITY: TutorialPestana = {
  pestana: 'classroom-community',
  nombre: 'Community',
  ruta: '/classroom/community',
  intro: 'Tus alumnos avanzan más cuando se acompañan.',
  pasos: [
    {
      sel: '[data-recorrido="tour-classroom-community-categorias"]',
      titulo: 'Categorías',
      texto: 'Los temas de tu comunidad. Con el lápiz las creas, las ordenas y eliges quién publica en cada una.',
      sub: 'Toca aquí, en Categorías, para ordenar los temas de tu comunidad.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-classroom-community-menu-post"]',
      titulo: 'Fijar arriba',
      texto: 'En el menú de cada post, «Fijar arriba» lo deja primero para todos.',
      sub: 'Toca aquí, en el menú de un post, y elige Fijar arriba para lo que nadie se puede perder.',
      lado: 'izquierda',
    },
    {
      sel: '[data-recorrido="tour-classroom-community-escribir"]',
      titulo: 'Escribe algo',
      texto: 'Tu post, con un video, una encuesta o un archivo.',
      sub: 'Abre la conversación tú: toca aquí, en Escribe algo, y suma un video, una encuesta o un archivo.',
      lado: 'abajo',
    },
  ],
};
