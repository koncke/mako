// El tutorial de AI Avatar (/ai-avatar; en el teléfono /m/ai-avatar). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §15.
// El estudio (app/ai-avatar/Estudio.tsx y app/m/ai-avatar/EstudioM.tsx): «Antes de generar» y «Generar» con la misma marca en los dos; los proyectos, la de la pantalla de crear.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_AVATAR: TutorialPestana = {
  pestana: 'avatar',
  nombre: 'AI Avatar',
  ruta: '/ai-avatar',
  rutaMovil: '/m/ai-avatar',
  intro: 'Tu cara, en escenas que nunca grabaste: el auto, un podcast, la cocina.',
  pasos: [
    {
      sel: 'button[aria-label="Usar el preset Charla en el auto"]',
      titulo: 'Presets',
      texto: 'Cada uno trae el lugar, la luz y la cámara. Filtra por categoría arriba.',
      sub: 'Toca aquí, en Charla en el auto o en otro preset, que trae la escena armada.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Personaje: tu foto"]',
      titulo: 'Personaje',
      texto: 'Sube una foto tuya. MaKo usa tu cara en la escena.',
      sub: 'Mira aquí, Personaje: ahí va tu foto, de frente y con buena luz.',
      lado: 'arriba',
    },
    {
      sel: 'textarea[aria-label="Describe la escena"]',
      titulo: 'La escena',
      texto: 'Qué haces y qué hay alrededor, en una o dos frases.',
      sub: 'Mira aquí, Describe la escena: cuenta lo que pasa.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="tour-avatar-generar"]',
      titulo: 'Generar',
      texto: 'Se prende cuando no falta nada. Si falta algo, el botón te dice qué.',
      sub: 'Cuando esté todo, toca aquí, en Generar, y mírate en esa escena.',
      lado: 'arriba',
    },
  ],
};
