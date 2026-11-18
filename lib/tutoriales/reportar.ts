// El tutorial de «Report a problem» (/tickets: app/tickets/page.tsx → el chat de Soporte, app/tickets/soporte/ChatSoporte.tsx). Cuadra con
// el guion de su video (key `report-problem`: v3 para la entrada y las frases de acción del manifiesto v4). Todo con atributos que el
// código ya escribe: el link vive en el menú de la foto (se abre antes, con la foto), la caja tiene su `aria-label` y el ticket armado su
// `data-tarjeta="ticket"`. El ticket y «Mandárselo al equipo» aparecen recién cuando MaKo lo arma: al entrar, el motor los saltea.
// En el teléfono todavía no está medido: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_REPORTAR: TutorialPestana = {
  pestana: 'report-problem',
  nombre: 'Report a problem',
  ruta: '/tickets',
  intro: 'Si algo no anda o te falta una función, que el equipo lo sepa.',
  pasos: [
    {
      sel: 'textarea[aria-label="Cuéntale a MaKo qué pasó"]',
      titulo: 'Cuéntale qué pasó',
      texto: 'Con tus palabras: MaKo te ayuda a dejarlo claro.',
      sub: 'Mira aquí, Cuéntale a MaKo qué pasó: escríbelo con tus palabras.',
      lado: 'arriba',
    },
    {
      sel: '[data-tarjeta="ticket"]',
      titulo: 'El ticket',
      texto: 'Lo que MaKo le va a mandar al equipo. Revísalo antes.',
      sub: 'Mira aquí, el ticket que arma MaKo: revisa que diga lo que pasó antes de mandarlo.',
      lado: 'arriba',
    },
    {
      sel: '[data-tarjeta="ticket"] button.co-chip--primario',
      titulo: 'Mandárselo al equipo',
      texto: 'Si te preguntan algo, el ticket dice «Espera tu respuesta».',
      sub: 'Cuando esté claro, toca aquí, en Mandárselo al equipo: si te preguntan algo, verás Espera tu respuesta.',
      lado: 'arriba',
    },
  ],
};
