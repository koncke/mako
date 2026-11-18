// El tutorial de Ticketera (/second-brain?ticketera=tickets). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §2.
// La Ticketera del negocio vive adentro del Ops Center (`?ticketera=tickets`, TicketeraDelCliente → ChatSoporte). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_TICKETERA: TutorialPestana = {
  pestana: 'ticketera',
  nombre: 'Ticketera',
  ruta: '/second-brain?ticketera=tickets',
  intro: 'Un buen reporte se arregla mucho más rápido.',
  pasos: [
    {
      sel: 'textarea[aria-label="Cuéntale a MaKo qué pasó"]',
      titulo: 'Qué pasó',
      texto: 'Una o dos frases alcanzan: qué hiciste, qué viste y dónde.',
      sub: 'Cuéntale qué pasó, en qué pantalla y qué esperabas que pasara.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Más opciones"]',
      titulo: 'Una captura',
      texto: 'Adjunta la imagen de la pantalla: el equipo la ve tal cual.',
      sub: 'Si tienes una captura, súmala desde el más: ahorra preguntas.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="sb-hilo"]',
      titulo: 'El ticket se arma solo',
      texto: 'MaKo completa lo que falta con preguntas cortas y lo manda al equipo.',
      sub: 'Máko te pregunta lo que falte y lo arma como un ticket para el equipo.',
    },
    {
      sel: 'button[aria-label="Tus tickets"]',
      titulo: 'Tus tickets',
      texto: 'Todo lo que reportaste, con su estado y lo que te contestaron.',
      sub: 'En Tus tickets sigues cada uno, con su estado y la respuesta. Las ideas de mejora entran por el mismo lugar que los errores.',
      lado: 'abajo',
    },
  ],
};
