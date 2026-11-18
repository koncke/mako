// El tutorial de Web Generator (/web-generator; en el teléfono /m/landing). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §11.
// La portada de outliers (app/web-generator/OutliersLandings.tsx), la misma en el teléfono: «Mis landings» (la marca) allá es el link «Tus landings» acá (`?ver=lista`: su texto lo fija un test). Las plantillas y «Replicar» son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_WEB: TutorialPestana = {
  pestana: 'web',
  nombre: 'Web Generator',
  ruta: '/web-generator',
  rutaMovil: '/m/landing',
  intro: 'Antes de diseñar tu página, mira las que ya convierten.',
  pasos: [
    {
      sel: '[aria-label="Tipo de página"]',
      titulo: 'Tipo de página',
      texto: 'Si vendes con una clase gratis, mira los Webinar. Si es con video, los VSL.',
      sub: 'Toca aquí, en VSL, Webinar o Página de venta, para ver sólo ese tipo.',
      lado: 'abajo',
    },
    {
      sel: 'input[aria-label^="Buscar páginas"]',
      titulo: 'Pega un link',
      texto: 'Cualquier página pública: MaKo la trae para replicarla.',
      sub: 'Mira aquí, el buscador: pega el link de una página que te gustó para replicarla.',
      lado: 'abajo',
    },
    {
      sel: 'a[href^="/web-generator?replicar="]',
      titulo: 'Replicar',
      texto: 'Toma el orden de esa página y lo escribe para tu negocio.',
      sub: 'Elige una y toca aquí, en Replicar: se vuelve a armar para tu negocio y queda en Mis landings.',
      lado: 'arriba',
      haz: 'Haz clic en Replicar',
      clic: true,
      soloComputadora: true,
    },
  ],
};
