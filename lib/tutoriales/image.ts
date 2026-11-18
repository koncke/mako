// El tutorial de Image (/image-editor). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §17.
// La pantalla de crear de Image, con sus plantillas (sus `aria-label` salen del catálogo de plantillas). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_IMAGE: TutorialPestana = {
  pestana: 'image',
  nombre: 'Image',
  ruta: '/image-editor',
  intro: '¿Quieres carruseles que la gente guarde y miniaturas que inviten a entrar?',
  pasos: [
    {
      sel: 'span[aria-label="Lista o tips: portada"]',
      titulo: 'Con tu marca',
      texto: 'El nombre de tu negocio ya está puesto en cada lámina.',
      sub: 'Toca aquí, en la portada de Lista o tips: ya trae el nombre de tu negocio.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Ver un ejemplo de Lista o tips"]',
      titulo: 'Ver ejemplo',
      texto: 'El carrusel completo, lámina por lámina, como queda publicado.',
      sub: 'Toca aquí, en Ver ejemplo, y mira cómo queda la pieza terminada.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Lista o tips"]',
      titulo: 'Tu primer carrusel',
      texto: 'Una idea por lámina: el más simple para empezar.',
      sub: 'Empieza por un carrusel: toca aquí, en Usar plantilla.',
      lado: 'derecha',
      haz: 'Haz clic en «Usar plantilla»',
      clic: true,
    },
  ],
};
