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
      sel: '[data-recorrido="spy-tab-anuncios"]',
      // Las pestañas viven ADENTRO de un competidor abierto; con 0 o con 2 o más, la página muestra la lista. Si no están, el motor abre
      // el primero (20/11, la auditoría de las pausas: spy-3/4).
      antes: '.spy-ccard[role="button"]',
      titulo: 'Anuncios y funnel',
      texto: 'En Anuncios, lo que paga para mostrar. En Funnel, su oferta y sus páginas.',
      sub: 'Toca aquí, en Anuncios, y mira los que tiene activos.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="spy-tab-contenido"]',
      titulo: 'Contenido',
      texto: 'Para volver a todo lo que publica.',
      sub: 'Toca aquí, en Contenido, para volver a todo lo que publica.',
    },
    {
      sel: '[data-recorrido="spy-grilla"] div[role="button"]',
      // La grilla es la de Contenido: si quedó en Anuncios (pasó con «Siguiente»), el motor toca Contenido (spy-5).
      antes: '[data-recorrido="spy-tab-contenido"]',
      titulo: 'Hacer uno así',
      texto: 'Adentro ves sus números y su guion. Al pie está «Hacer uno así».',
      sub: 'Pruébalo ya: toca aquí, en una pieza, y después en Hacer uno así: MaKo escribe el tuyo con tu oferta.',
      lado: 'arriba',
      haz: 'Haz clic en la primera pieza',
      clic: true,
    },
  ],
};
