// El tutorial de Web Generator (/web-generator; en el teléfono /m/landing). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §11.
// La portada de outliers (app/web-generator/OutliersLandings.tsx), la misma en el teléfono: «Mis landings» (la marca) allá es el link «Tus landings» acá (`?ver=lista`: su texto lo fija un test). Las plantillas y «Replicar» son de la computadora.
import { MARCA, conMarca } from './marcas';
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
      sub: 'Filtra por tipo: VSL, webinar, página de venta o agendar llamada.',
      lado: 'abajo',
    },
    {
      sel: 'a[aria-label^="Ver la página de "]',
      titulo: 'La página entera',
      texto: 'Arriba dice de quién es. Si es tu competencia, abre su ficha de Spy.',
      sub: 'Pasa el cursor por una y la página baja entera, de punta a punta.',
      lado: 'derecha',
    },
    {
      sel: 'input[aria-label^="Buscar páginas"]',
      titulo: 'Pega un link',
      texto: 'Cualquier página pública: MaKo la trae para replicarla.',
      sub: '¿Te gustó la de alguien más? Su link va en el buscador.',
      lado: 'abajo',
    },
    {
      sel: '#wg-plantillas',
      titulo: 'Plantillas',
      texto: 'Nueve diseños listos, con y sin video.',
      sub: 'Si prefieres un diseño limpio, parte de una plantilla.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: `${conMarca(MARCA.webMisLandings)}, a[href$="?ver=lista"]`,
      titulo: 'Mis landings',
      texto: 'Tus páginas, empezando por la última que tocaste. Cada una abre su editor.',
      sub: 'Tus páginas quedan en Mis landings.',
      lado: 'abajo',
    },
    {
      sel: 'a[href^="/web-generator?replicar="]',
      titulo: 'Replicar',
      texto: 'Toma el orden de esa página y lo escribe para tu negocio.',
      sub: 'Y con Replicar, la página se vuelve a armar para tu negocio, con tus textos.',
      lado: 'arriba',
      haz: 'Haz clic en Replicar',
      clic: true,
      soloComputadora: true,
    },
  ],
};
