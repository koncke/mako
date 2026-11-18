// El tutorial de Video (/video-editor). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §16.
// La pantalla de crear de Video, con sus plantillas (sus `aria-label` salen del catálogo de plantillas). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_VIDEO: TutorialPestana = {
  pestana: 'video',
  nombre: 'Video',
  ruta: '/video-editor',
  intro: 'Para tu próximo video, parte de uno que ya funcionó.',
  pasos: [
    {
      sel: '[data-caja-pedido]',
      titulo: 'Pídelo en una línea',
      texto: 'Un reel de 30 segundos sobre tu programa, y MaKo lo arma.',
      sub: '¿Ya sabes lo que quieres? Escríbelo en una línea y Máko lo arma.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Ver un ejemplo de Anuncio con gancho"]',
      titulo: 'Ver ejemplo',
      texto: 'Así queda terminado, antes de que armes el tuyo.',
      sub: 'Cada plantilla de anuncio tiene su ejemplo: míralo antes de usarla.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Tu personaje con IA"]',
      titulo: 'Tu personaje con IA',
      texto: 'Desde tu foto, sin grabarte.',
      sub: '¿Sin ganas de ponerte frente a la cámara? Tu personaje con IA lo hace por ti.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Mensaje para…"]',
      titulo: 'Mensaje para…',
      texto: 'Replica un video que funcionó, paso a paso, con MaKo en el chat del editor.',
      sub: 'Y Mensaje para te lleva de la mano: Máko te pide la referencia, tu guion, tu foto y tu voz. El guion va en seis bloques, y cada uno te dice cuánto dura su clip.',
      lado: 'derecha',
      haz: 'Haz clic en «Mensaje para…»',
      clic: true,
    },
  ],
};
