// El tutorial de Ticketera (/second-brain?ticketera=tickets). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §2.
// La Ticketera del negocio vive adentro del Ops Center (`?ticketera=tickets`, TicketeraDelCliente → ChatSoporte). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_TICKETERA: TutorialPestana = {
  pestana: 'ticketera',
  nombre: 'Ticketera',
  ruta: '/second-brain?ticketera=tickets',
  intro: 'Un error bien contado se arregla mucho antes.',
  pasos: [
    {
      sel: '[data-recorrido="sb-escribir"]',
      titulo: 'Caja de abajo',
      texto: 'Cuéntale qué pasó, en qué pantalla y qué esperabas.',
      sub: 'Mira aquí, la caja de abajo: cuéntale qué pasó, en qué pantalla y qué esperabas.',
    },
    {
      sel: 'button[aria-label="Más opciones"]',
      titulo: 'Una captura',
      texto: 'Adjunta la imagen de la pantalla: el equipo la ve tal cual.',
      sub: 'Toca aquí, en el «+», y súmale una captura de la pantalla.',
      lado: 'arriba',
    },
    {
      // Con tickets, el aria-label es «Tus tickets (3)»: «empieza con» (20/11, ticketera-5).
      sel: 'button[aria-label^="Tus tickets"]',
      titulo: 'Tus tickets',
      texto: 'Todo lo que reportaste, con su estado y lo que te contestaron.',
      sub: 'Pruébalo ya: toca aquí, en Tus tickets, para seguir su estado y la respuesta.',
      lado: 'abajo',
    },
  ],
};
