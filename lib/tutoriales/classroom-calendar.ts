// El tutorial de Classroom › Calendar (/classroom/calendar: app/_comunidad/Calendario.tsx y su editor, EditorEvento.tsx). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `classroom-calendar`): la sub-tab de Classroom (`que-es`: el link de ClientsShell, que lleva la
// ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija el manifiesto
// (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · LA COMUNIDAD ES SÓLO DE MaKo Pro (lib/comunidad-solo-pro.ts): con MaKo Essential, y en su prueba, la pantalla es el candado
//   (CartelSoloPro) y el motor saltea todo menos la sub-tab. Se midió dibujando la comunidad como la ve un negocio con Pro.
// · «Quién entra» y «Crear evento» viven ADENTRO del editor que abre «Nuevo evento»: sus pasos lo abren antes (`antes`). Medidos en
//   el editor dibujado aparte. «Crear evento» va sin `clic`: se apaga mientras guarda.
// · En el teléfono (/m/comunidad), sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_CALENDAR: TutorialPestana = {
  pestana: 'classroom-calendar',
  nombre: 'Calendar',
  ruta: '/classroom/calendar',
  intro: 'Una llamada en grupo cada semana le da ritmo a tu programa.',
  pasos: [
    {
      sel: '.cls-tab[href^="/classroom/calendar"]',
      titulo: 'Calendar',
      texto: 'Las citas en grupo con tus alumnos: llamadas, clases en vivo, encuentros.',
      sub: 'El Calendar del curso arma esas citas con tus alumnos.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.classroomCalendarNuevo),
      titulo: 'Nuevo evento',
      texto: 'Una cita con tus alumnos. Puede repetirse sola, cada semana o cada mes.',
      sub: 'Toca aquí, en Nuevo evento: cada uno puede repetirse solo.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.classroomCalendarQuienEntra),
      antes: conMarca(MARCA.classroomCalendarNuevo),
      titulo: 'Quién entra',
      texto: 'Todos, quienes llegaron a un nivel, o quienes tienen un módulo del curso.',
      sub: 'Toca aquí, en Quién entra, y elige si es para todos, desde un nivel o para quien tenga un módulo.',
      lado: 'arriba',
    },
    {
      sel: conMarca(MARCA.classroomCalendarCrear),
      antes: conMarca(MARCA.classroomCalendarNuevo),
      titulo: 'Crear evento',
      texto: 'Con el link de Zoom o Meet, o la dirección si es en persona, queda en el calendario de tus alumnos.',
      sub: 'Suma el link de Zoom o Meet, o la dirección si es en persona, y toca aquí, en Crear evento.',
      lado: 'arriba',
    },
  ],
};
