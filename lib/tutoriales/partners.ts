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
import type { TutorialPestana } from './tipos';

export const TUTORIAL_PARTNERS: TutorialPestana = {
  pestana: 'partners',
  nombre: 'MaKo Partners',
  ruta: '/partners',
  intro: 'Cada negocio que traes a MaKo te deja el 30 por ciento de lo que paga, todos los meses, para siempre.',
  pasos: [
    {
      sel: '[data-recorrido="tour-partners-hacerme"]',
      titulo: 'Hacerme partner',
      texto: 'Es gratis: tres preguntas, y tu link aparece en el acto.',
      sub: 'Mira aquí, Hacerme partner: es gratis, son tres preguntas y tu link aparece al instante.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-partners-a-cobrar"]',
      titulo: 'A cobrar',
      texto: 'Lo que ganaste y todavía no te transferimos: cada mes que el negocio que trajiste paga, se suma tu parte.',
      sub: 'Toca aquí, en A cobrar: cada mes que ese negocio paga, se suma a lo tuyo.',
      lado: 'abajo',
    },
  ],
};
