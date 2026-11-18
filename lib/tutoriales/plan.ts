// El tutorial de Plan (/plan; en el teléfono /m/plan). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §12.
// El objetivo y su razón son de la computadora. La primera prioridad: `[data-prioridad]` (computadora) o `.m-plan-item` (teléfono); completar: la primera casilla de cada uno.
import { MARCA, conMarca } from './marcas';
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
      sub: 'A la izquierda, tu Objetivo Principal: el proyecto que más mueve tu negocio ahora.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: '[data-razon-objetivo]',
      titulo: 'Por qué va primero',
      texto: 'El perro lo deja escrito para que no dudes.',
      sub: 'El perro te explica por qué lo eligió, en una línea.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: '[data-prioridad], .m-plan-item',
      titulo: 'Las cinco de ahora',
      texto: 'Ordenadas por lo que más acerca el objetivo, sin las bloqueadas.',
      sub: 'A la derecha, las cinco tareas que tocan ahora, en orden.',
      lado: 'izquierda',
    },
    {
      sel: `${conMarca(MARCA.planVistas)}, .m-seg[aria-label="Vista"]`,
      titulo: 'Las vistas',
      texto: 'El mismo Plan, mirado de cuatro formas.',
      sub: 'Tus proyectos, las tareas sueltas y lo que se repite están en estas vistas.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label^="Marcar «"], button.m-casilla[aria-label^="Completar: "]',
      titulo: 'Completar',
      texto: 'Al marcarla, la siguiente sube a su lugar.',
      sub: '¿Terminaste una? Toca Completar y sube la siguiente.',
      lado: 'izquierda',
      haz: 'Haz clic en Completar',
      clic: true,
    },
  ],
};
