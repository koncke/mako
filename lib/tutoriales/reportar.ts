// El tutorial de «Report a problem» (/tickets, en el menú de la foto): app/tickets/page.tsx dibuja el MISMO chat de Soporte que la
// Ticketera del Ops Center (app/tickets/soporte/ChatSoporte.tsx), con los mismos controles. Sus pasos son los de la Ticketera (una sola
// fuente). En el teléfono todavía no está medido: sin `rutaMovil`.
import { TUTORIAL_TICKETERA } from './ticketera';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_REPORTAR: TutorialPestana = {
  pestana: 'reportar',
  nombre: 'Reportar problema',
  ruta: '/tickets',
  intro: TUTORIAL_TICKETERA.intro,
  pasos: TUTORIAL_TICKETERA.pasos,
};
