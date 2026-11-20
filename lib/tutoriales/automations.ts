// El tutorial de Automations (/automations; en el teléfono /m/automations). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §5.
// La lista y «Nueva automatización» se buscan como las busca su recorrido de siempre (app/automations/recorrido-automations.ts, `DONDE`): `aside[aria-label=…]` y `button.chb-nueva`. En el teléfono, la lista vacía (`.m-vacio`); el lienzo, la ayuda y crear son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_AUTOMATIONS: TutorialPestana = {
  pestana: 'automations',
  nombre: 'Automations',
  ruta: '/automations',
  intro: 'Cada lead que no contestas a tiempo es una venta que se enfría.',
  pasos: [
    {
      // El contenedor del lienzo, siempre (20/11, automations-3): `data-lienzo-vacio` sólo existe sin ninguna automatización.
      sel: '[data-recorrido="au-lienzo"]',
      titulo: 'El lienzo',
      texto: 'Aquí ves el flujo entero. Usa «Probar» antes de publicarlo.',
      sub: 'Mira aquí, el lienzo: ahí se arma cada una, y nada sale hasta que la publicas y la activas.',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="au-ayuda"]',
      titulo: 'El tutorial del lienzo',
      texto: 'Abre el recorrido botón por botón, con una automatización abierta.',
      sub: 'Mira aquí, el «?»: cada botón del lienzo te muestra su tutorial.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: 'aside[aria-label="Tus automatizaciones"] button.chb-nueva',
      titulo: 'Nueva automatización',
      texto: 'Pídela por escrito o en audio, o elige una de la galería.',
      sub: 'Tu turno: toca aquí, en Nueva automatización, y pídesela a MaKo.',
      lado: 'derecha',
      haz: 'Haz clic en «＋ Nueva automatización»',
      clic: true,
      soloComputadora: true,
    },
  ],
};
