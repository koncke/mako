// El tutorial de Classroom (/classroom; en el teléfono /m/curso). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §14.
// Las marcas del curso son las de su recorrido de siempre (app/customer-success/curso/recorridos-curso.ts); en el teléfono cada módulo lleva la misma `modulo` (app/m/curso/CursoM.tsx). Editar, ver como alumno e invitar son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM: TutorialPestana = {
  pestana: 'classroom',
  nombre: 'Classroom',
  ruta: '/classroom',
  rutaMovil: '/m/curso',
  intro: 'Quien llega al resultado renueva y te recomienda. El curso es el camino.',
  pasos: [
    {
      sel: '[data-recorrido="modulo"]',
      titulo: 'Módulos = etapas',
      texto: 'Onboarding, Arranque, Hitos y Entregado. Arrástralos para cambiar el orden.',
      sub: 'Cada módulo es una etapa de tu entrega: del onboarding hasta el final.',
      lado: 'derecha',
    },
    {
      sel: '[data-recorrido="nuevo-modulo"]',
      titulo: 'Nuevo módulo',
      texto: 'Escribe el nombre y queda creado, con su etapa en Clients.',
      sub: 'Suma uno y su etapa aparece sola en el tablero de Clients.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="vista-alumno"]',
      titulo: 'Vista del alumno',
      texto: 'El curso tal como lo ve quien te compró.',
      sub: 'Antes de mandarlo, míralo como lo ve tu cliente.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'a[href="/classroom/clients"]',
      titulo: 'Clients',
      texto: 'El tablero de tu entrega: cada cliente en su etapa.',
      sub: 'En Clients sigues en qué etapa está cada persona.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="invitar"]',
      titulo: 'Invitar alumnos',
      texto: 'Elige entre tus clientes o suma a alguien nuevo.',
      sub: 'Y cuando el curso esté listo, invita a tus clientes desde aquí.',
      lado: 'abajo',
      haz: 'Haz clic en «Invitar alumnos»',
      clic: true,
      soloComputadora: true,
    },
  ],
};
