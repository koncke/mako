// El tutorial de Automations (/automations; en el teléfono /m/automations). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §5.
// La lista y «Nueva automatización» se buscan como las busca su recorrido de siempre (app/automations/recorrido-automations.ts, `DONDE`): `aside[aria-label=…]` y `button.chb-nueva`. En el teléfono, la lista vacía (`.m-vacio`); el lienzo, la ayuda y crear son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_AUTOMATIONS: TutorialPestana = {
  pestana: 'automations',
  nombre: 'Automations',
  ruta: '/automations',
  rutaMovil: '/m/automations',
  intro: 'Cada lead que no contestas a tiempo es una venta que se enfría.',
  pasos: [
    {
      sel: 'aside[aria-label="Tus automatizaciones"], .m-vacio',
      titulo: 'Tus automatizaciones',
      texto: 'Cada una nace de un momento del lead: entró, agendó, no vino, pagó.',
      sub: 'Aquí viven los mensajes que salen solos: cuando alguien agenda, cuando no se presenta o cuando vence una cuota.',
      lado: 'derecha',
    },
    {
      sel: '[data-lienzo-vacio="true"]',
      titulo: 'El lienzo',
      texto: 'Aquí ves el flujo entero. Usa «Probar» antes de publicarlo.',
      sub: 'Cada una se arma en este lienzo, tarjeta por tarjeta. Nada se envía hasta que la publicas y la activas. Antes, la pruebas como si fueras el lead.',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="au-ayuda"]',
      titulo: 'El tutorial del lienzo',
      texto: 'Abre el recorrido botón por botón, con una automatización abierta.',
      sub: 'El tutorial de cada botón del lienzo está en este signo.',
      lado: 'derecha',
      soloComputadora: true,
    },
    {
      sel: 'aside[aria-label="Tus automatizaciones"] button.chb-nueva',
      titulo: 'Nueva automatización',
      texto: 'Pídela por escrito o en audio, o elige una de la galería.',
      sub: 'Toca Nueva automatización: dile a Máko qué necesitas, o elige una plantilla.',
      lado: 'derecha',
      haz: 'Haz clic en «＋ Nueva automatización»',
      clic: true,
      soloComputadora: true,
    },
  ],
};
