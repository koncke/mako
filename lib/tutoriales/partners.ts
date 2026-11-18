// El tutorial de MaKo Partners (/partners). Cuadra con el guion de su video (C:/dev/tutoriales-video/guiones.json, id `partners`): el
// paso de `que-es` y un paso por cada frase con marca, en su orden, con la marca que fija el manifiesto (lib/tutoriales/marcas.ts); el
// `sub` es la frase.
// · El menú de la foto (donde vive «MaKo Partners») está cerrado al entrar: el primer paso marca el título de la landing
//   (app/mako-partners/LandingPartners.tsx, la que ve quien todavía no es partner).
// · «Hacerme partner» sale tres veces en la landing: la marca va sólo en el de arriba, y sólo adentro de la app con el alta (los tests
//   de la landing fijan el HTML de los tres botones de la página pública).
// · «A cobrar» NO SE PUDO MEDIR al entrar: es el número del PANEL del partner (app/partners/PanelPartner.tsx), que sale recién después de
//   sumarse (otra vista de la misma ruta). En la landing el motor lo saltea; ya partner, saltea el título y «Hacerme partner».
// · El cierre («Listo: comparte tu link…») no marca nada: sin paso. «A cobrar» es una «toca» que no es el cierre: sin `clic`.
// · En el teléfono (/m/partners), sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_PARTNERS: TutorialPestana = {
  pestana: 'partners',
  nombre: 'MaKo Partners',
  ruta: '/partners',
  intro: 'Cada negocio que traes a MaKo te deja su primer mes entero, en dinero.',
  pasos: [
    {
      sel: '.mp-hero h1',
      titulo: 'MaKo Partners',
      texto: 'Recomiendas MaKo y te llevas el primer mes entero de cada negocio que traes.',
      sub: 'MaKo Partners, en el menú de tu foto, te paga por recomendar MaKo.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.partnersHacerme),
      titulo: 'Hacerme partner',
      texto: 'Es gratis: tres preguntas, y tu link aparece en el acto.',
      sub: 'Mira aquí, Hacerme partner: es gratis, son tres preguntas y tu link aparece al instante.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.partnersACobrar),
      titulo: 'A cobrar',
      texto: 'Lo que ganaste y todavía no te transferimos: entra cuando el negocio que trajiste paga su segundo mes.',
      sub: 'Toca aquí, en A cobrar: lo ganas cuando ese negocio paga su segundo mes.',
      lado: 'abajo',
    },
  ],
};
