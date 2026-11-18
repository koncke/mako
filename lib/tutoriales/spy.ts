// El tutorial de Competitor Spy (/competitor-spy; en el teléfono /m/competitor-spy). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §9.
// Adentro de un competidor (su ficha). Las marcas `spy-*` son las de su recorrido de siempre (app/competitor-spy/recorrido-spy.ts). En el teléfono no hay «Volver» (lo pone la cabecera) y «Ordenar» es «Filtrar y ordenar».
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SPY: TutorialPestana = {
  pestana: 'spy',
  nombre: 'Competitor Spy',
  ruta: '/competitor-spy',
  rutaMovil: '/m/competitor-spy',
  intro: 'No adivines qué publicar: mira qué ya le funciona a tu competencia.',
  pasos: [
    {
      sel: '[data-recorrido="spy-volver"]',
      titulo: 'Competidores',
      texto: 'Vuelve a la lista para sumar otra cuenta o cambiar de competidor.',
      sub: 'Desde Competidores sumas a quien quieras mirar.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'section[aria-label="Vistas por día de publicación"]',
      titulo: 'Sus outliers',
      texto: 'Pasa el cursor por un punto para ver qué pieza es y cuántas vistas hizo.',
      sub: 'Cada punto es una pieza. Las que quedan muy por arriba son outliers: rindieron varias veces más que su mediana.',
    },
    {
      sel: '[data-recorrido="spy-tab-anuncios"], section[aria-label="Sus anuncios activos y su formato"]',
      titulo: 'Anuncios y funnel',
      texto: 'En Anuncios, lo que paga para mostrar. En Funnel, su oferta y sus páginas.',
      sub: 'Sus anuncios y su funnel tienen pestaña propia.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="spy-grilla"] button[aria-label="Ordenar"], .m-competitor-spy__filtro button',
      titulo: 'Ordenar',
      texto: 'Por más vistas, lo mejor queda primero. También filtras por rendimiento mínimo.',
      sub: 'Abajo está todo lo que publica. Ordénalo por más vistas.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="spy-grilla"] div[role="button"]',
      titulo: 'Hacer uno así',
      texto: 'Adentro ves sus números y su guion. Al pie está «Hacer uno así».',
      sub: 'Abre una pieza y toca Hacer uno así: Máko escribe el tuyo con tu oferta.',
      lado: 'arriba',
      haz: 'Haz clic en la primera pieza',
      clic: true,
    },
  ],
};
