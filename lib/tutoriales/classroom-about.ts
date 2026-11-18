// El tutorial de Classroom › About (/classroom/about: app/_comunidad/About.tsx). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `classroom-about`): la sub-tab de Classroom (`que-es`: el link de ClientsShell, que lleva la
// ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija el manifiesto
// (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · LA COMUNIDAD ES SÓLO DE MaKo Pro (lib/comunidad-solo-pro.ts): con MaKo Essential, y en su prueba, la pantalla es el candado
//   (CartelSoloPro) y el motor saltea todo menos la sub-tab. Se midió dibujando la comunidad como la ve un negocio con Pro.
// · «Reglas», «Publican desde» y «Guardar About» viven ADENTRO del editor que abre «Editar»: sus pasos lo abren antes (`antes`).
//   Medidos en el editor dibujado aparte. «Publican desde» lo ve sólo quien configura la comunidad. «Guardar About» va sin `clic`:
//   se apaga mientras guarda.
// · En el teléfono (/m/comunidad), sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_ABOUT: TutorialPestana = {
  pestana: 'classroom-about',
  nombre: 'About',
  ruta: '/classroom/about',
  intro: '¿Qué lee primero quien entra a tu comunidad?',
  pasos: [
    {
      sel: '.cls-tab[href^="/classroom/about"]',
      titulo: 'About',
      texto: 'De qué se trata tu comunidad y qué se espera de cada miembro.',
      sub: 'About, otra pestaña de Classroom, cuenta de qué se trata y qué se espera de cada miembro.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.classroomAboutEditar),
      titulo: 'Editar',
      texto: 'El nombre de la comunidad, una descripción corta y de qué se trata.',
      sub: 'Toca aquí, en Editar, y escribe el nombre y una descripción corta.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.classroomAboutReglas),
      antes: conMarca(MARCA.classroomAboutEditar),
      titulo: 'Reglas',
      texto: 'Qué se puede publicar y qué no.',
      sub: 'Mira aquí, Reglas: deja claro qué se puede publicar.',
      lado: 'arriba',
    },
    {
      sel: conMarca(MARCA.classroomAboutPublican),
      antes: conMarca(MARCA.classroomAboutEditar),
      titulo: 'Publican desde',
      texto: 'Todos, o sólo quienes llegaron a un nivel.',
      sub: 'Mira aquí, Publican desde: elige quién escribe, todos o quienes llegaron a un nivel.',
      lado: 'arriba',
    },
    {
      sel: conMarca(MARCA.classroomAboutGuardar),
      antes: conMarca(MARCA.classroomAboutEditar),
      titulo: 'Guardar About',
      texto: 'Quien entre a tu comunidad ya sabe a qué viene.',
      sub: 'Cuando termines, toca aquí, en Guardar About, y quien entre ya sabe a qué viene.',
      lado: 'arriba',
    },
  ],
};
