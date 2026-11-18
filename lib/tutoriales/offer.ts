// El tutorial de Offer (/offer; en el teléfono /m/offer): día 2 del reto. Guion: docs/reto-7-dias/tutoriales-por-pestana.md §7.
// La charla y la flecha de los proyectos son de la pantalla de crear (app/_crear/PantallaCrear.tsx); en el teléfono, el hilo y el
// selector de funnel de app/m/offer. «Tu oferta» (el documento de la derecha) no existe en el teléfono.
import { conMarca, marcaCrear } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_OFFER: TutorialPestana = {
  pestana: 'offer',
  nombre: 'Offer',
  ruta: '/offer',
  rutaMovil: '/m/offer',
  intro: 'Lo que le contaste a Máko en el onboarding sigue aquí, en la misma conversación.',
  pasos: [
    {
      sel: conMarca(marcaCrear('Offer', 'charla')),
      titulo: 'La misma charla',
      texto: 'MaKo sigue desde lo que contaste en el onboarding: no hace falta repetirlo.',
      sub: 'Lo que le contaste a Máko en el onboarding sigue aquí, en la misma conversación.',
      lado: 'derecha',
    },
    {
      sel: '[aria-label="Tu oferta"]',
      titulo: 'Tu oferta',
      texto: 'Para quién es, qué logra, qué entregas y el precio. Se completa mientras respondes.',
      sub: 'A la derecha, tu oferta se arma sola con cada respuesta. De ahí salen tu landing y tus guiones.',
      lado: 'izquierda',
      soloComputadora: true,
    },
    {
      sel: conMarca(marcaCrear('Offer', 'proyectos')),
      titulo: 'Tus proyectos',
      texto: 'Cada funnel con sus ofertas y sus análisis anteriores.',
      sub: 'Con la flecha ves tus funnels, sus ofertas y cada análisis.',
      lado: 'derecha',
    },
    {
      sel: '[aria-label="Respuestas rápidas"] button',
      titulo: 'Analizar tu oferta',
      texto: 'Te pide dos datos: cuántas personas te compraron y cuántas lograron el resultado.',
      sub: 'Cuando quieras ir a fondo, toca Analicemos mi oferta. Te marca qué la hace fuerte, qué le falta para vender más y te arma la versión mejorada, en PDF.',
      lado: 'arriba',
      haz: 'Haz clic en «Analicemos mi oferta»',
      clic: true,
    },
  ],
};
