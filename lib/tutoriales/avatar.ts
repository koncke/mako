// El tutorial de AI Avatar (/ai-avatar; en el teléfono /m/ai-avatar). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §15.
// El estudio (app/ai-avatar/Estudio.tsx y app/m/ai-avatar/EstudioM.tsx): «Antes de generar» y «Generar» con la misma marca en los dos; los proyectos, la de la pantalla de crear.
import { MARCA, conMarca, marcaCrear } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_AVATAR: TutorialPestana = {
  pestana: 'avatar',
  nombre: 'AI Avatar',
  ruta: '/ai-avatar',
  rutaMovil: '/m/ai-avatar',
  intro: 'Tu cara, en escenas que nunca grabaste: en el auto, en un podcast, en la cocina.',
  pasos: [
    {
      sel: conMarca(MARCA.avatarAntes),
      titulo: 'Antes de generar',
      texto: 'La extensión, la conexión, Google Flow y tu foto. Se marca cada uno cuando lo haces.',
      sub: 'Primero, lo que falta para generar. Son cuatro pasos, y la pantalla te marca cuál sigue.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar el preset Charla en el auto"]',
      titulo: 'Presets',
      texto: 'Cada uno trae el lugar, la luz y la cámara. Filtra por categoría arriba.',
      sub: 'Elige un preset: cada uno trae la escena armada.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Personaje: tu foto"]',
      titulo: 'Personaje',
      texto: 'Sube una foto tuya. MaKo usa tu cara en la escena.',
      sub: 'En Personaje va tu foto, de frente y con buena luz.',
      lado: 'arriba',
    },
    {
      sel: 'textarea[aria-label="Describe la escena"]',
      titulo: 'La escena',
      texto: 'Qué haces y qué hay alrededor, en una o dos frases.',
      sub: 'Cuenta lo que pasa en la escena.',
      lado: 'arriba',
    },
    {
      sel: conMarca(marcaCrear('AI Avatar', 'proyectos')),
      titulo: 'Tus looks',
      texto: 'Cada generación queda aquí: recrear, descargar o borrar.',
      sub: 'Cada look que generes queda guardado detrás de esta flecha.',
      lado: 'derecha',
    },
    {
      sel: conMarca(MARCA.avatarGenerar),
      titulo: 'Generar',
      texto: 'Se prende cuando no falta nada. Si falta algo, el botón te dice qué.',
      sub: 'Y cuando esté todo, toca Generar.',
      lado: 'arriba',
    },
  ],
};
