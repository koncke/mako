// El tutorial de Offer (/offer; en el teléfono /m/offer): día 2 del reto. Cuadra con el guion de su video
// (public/tutoriales/manifiesto.json, key `offer`): un paso por cosa nombrada, en su orden, y el `sub` es la frase del guion.
// La charla y la flecha de los proyectos son de la pantalla de crear (app/_crear/PantallaCrear.tsx); en el teléfono, el hilo y el
// selector de funnel de app/m/offer. «Tu oferta» (el documento de la derecha) no existe en el teléfono.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_OFFER: TutorialPestana = {
  pestana: 'offer',
  nombre: 'Offer',
  ruta: '/offer',
  rutaMovil: '/m/offer',
  intro: '¿Tu oferta convence a la primera, o la explicas diez veces?',
  pasos: [
    {
      sel: '[data-recorrido="tour-offer-charla"]',
      titulo: 'La misma charla',
      texto: 'MaKo sigue desde lo que contaste en el onboarding: no hace falta repetirlo.',
      sub: 'Mira aquí, el chat: contestas, y tu oferta se completa sola, a la derecha.',
      lado: 'derecha',
    },
    {
      sel: '[data-recorrido="tour-offer-proyectos"]',
      titulo: 'Tus proyectos',
      texto: 'Cada funnel con sus ofertas y sus análisis anteriores.',
      sub: 'Toca aquí, en la flecha, para ver tus funnels, sus ofertas y cada análisis.',
      lado: 'derecha',
    },
    {
      sel: '[aria-label="Respuestas rápidas"] button',
      titulo: 'Analicemos mi oferta',
      texto: 'Te pide dos datos: cuántas personas te compraron y cuántas lograron el resultado.',
      sub: 'Para ir a fondo, toca aquí, en Analicemos mi oferta: te marca qué falta y la mejora, en PDF.',
      lado: 'arriba',
      haz: 'Haz clic en «Analicemos mi oferta»',
      clic: true,
    },
  ],
};
