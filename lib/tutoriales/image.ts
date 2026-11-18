// El tutorial de Image (/image-editor). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §17.
// La pantalla de crear de Image, con sus plantillas (sus `aria-label` salen del catálogo de plantillas). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_IMAGE: TutorialPestana = {
  pestana: 'image',
  nombre: 'Image',
  ruta: '/image-editor',
  intro: 'De aquí salen los carruseles que la gente guarda y las miniaturas que invitan a entrar.',
  pasos: [
    {
      sel: '[data-caja-pedido]',
      titulo: 'Pide la pieza',
      texto: 'Algo como: un post para anunciar tu promo de esta semana.',
      sub: 'Con una frase en la caja de arriba, Máko te arma la pieza.',
      lado: 'abajo',
    },
    {
      sel: 'span[aria-label="Lista o tips: portada"]',
      titulo: 'Con tu marca',
      texto: 'El nombre de tu negocio ya está puesto en cada lámina.',
      sub: 'Cada plantilla ya trae el nombre de tu negocio. Sólo cambias el contenido.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Ver un ejemplo de Lista o tips"]',
      titulo: 'Ver ejemplo',
      texto: 'El carrusel completo, lámina por lámina, como queda publicado.',
      sub: 'Con el ejemplo ves cómo queda terminada.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Miniatura · Resultado con cara · Coach"]',
      titulo: 'Miniaturas de YouTube',
      texto: 'Cada plantilla te da dos versiones para comparar.',
      sub: 'Las miniaturas de YouTube vienen en dos versiones, para que pruebes cuál se toca más.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Lista o tips"]',
      titulo: 'Tu primer carrusel',
      texto: 'Una idea por lámina: el más simple para empezar.',
      sub: 'Empieza por un carrusel: toca Usar plantilla.',
      lado: 'derecha',
      haz: 'Haz clic en «Usar plantilla»',
      clic: true,
    },
  ],
};
