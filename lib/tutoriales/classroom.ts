// El tutorial de Classroom (/classroom; en el teléfono /m/curso). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §14.
// Las marcas del curso son las de su recorrido de siempre (app/customer-success/curso/recorridos-curso.ts); en el teléfono cada módulo lleva la misma `modulo` (app/m/curso/CursoM.tsx). Editar, ver como alumno e invitar son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM: TutorialPestana = {
  pestana: 'classroom',
  nombre: 'Classroom',
  ruta: '/classroom',
  intro: 'Quien llega al resultado renueva y te recomienda.',
  pasos: [
    {
      sel: '[data-recorrido="nuevo-modulo"]',
      titulo: 'Nuevo módulo',
      texto: 'Escribe el nombre y queda creado, con su etapa en Clients.',
      sub: 'Mira aquí, Nuevo módulo: cada uno suma su etapa al tablero de Clients.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="vista-alumno"]',
      titulo: 'Vista del alumno',
      texto: 'El curso tal como lo ve quien te compró.',
      sub: 'Mira aquí, Vista del alumno: lo ves tal como lo ve tu cliente.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="invitar"]',
      titulo: 'Invitar alumnos',
      texto: 'Elige entre tus clientes o suma a alguien nuevo.',
      sub: 'Tu turno: completa tu curso y toca aquí, en Invitar alumnos.',
      lado: 'abajo',
      haz: 'Haz clic en «Invitar alumnos»',
      clic: true,
      // Si tocaron «Vista del alumno» (la frase de arriba es una «Mira aquí», pero se puede tocar), «Invitar» no está en la vista
      // previa: el motor toca «← Volver a editar» (20/11, la verificación de classroom-5). Sin tocar nada, «Invitar» está y esto no corre.
      antes: 'a[href^="/classroom?producto="]',
      soloComputadora: true,
    },
  ],
};
