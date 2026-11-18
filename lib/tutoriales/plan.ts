// El tutorial de Plan (/plan; en el teléfono /m/plan). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §12.
// El objetivo y su razón son de la computadora. La primera prioridad: `[data-prioridad]` (computadora) o `.m-plan-item` (teléfono); completar: la primera casilla de cada uno.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_PLAN: TutorialPestana = {
  pestana: 'plan',
  nombre: 'Plan',
  ruta: '/plan',
  rutaMovil: '/m/plan',
  intro: 'Cuando todo parece urgente, el Plan te dice qué va primero.',
  pasos: [
    {
      sel: '.mako-prio-obj',
      titulo: 'Objetivo Principal',
      texto: 'El proyecto que manda ahora. Tócalo para ver sus tareas.',
      sub: 'Toca aquí, en el Objetivo Principal: el perro del Plan, tu asistente, te dice por qué lo eligió.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: '[data-prioridad]',
      titulo: 'Las cinco de ahora',
      texto: 'Ordenadas por lo que más acerca el objetivo, sin las bloqueadas.',
      sub: 'Toca aquí, en la primera de tus cinco tareas, para ver qué te toca hacer.',
      lado: 'izquierda',
    },
    {
      sel: 'button[aria-label^="Marcar «"], button.m-casilla[aria-label^="Completar: "]',
      titulo: 'Completar',
      texto: 'Al marcarla, la siguiente sube a su lugar.',
      sub: 'Cuando la termines, toca aquí, en Completar, y sube la siguiente.',
      lado: 'izquierda',
      haz: 'Haz clic en Completar',
      clic: true,
    },
  ],
};
