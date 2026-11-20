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
      // Sin `?ver=`, la pestaña abre los outliers (o el editor): las marcas son de «Nuevo video». Desde los outliers, el motor toca
      // «＋ Crear desde cero» y sigue ahí (20/11, auditoría de las pausas: video-3 a 5). Si no está, se saltea como siempre.
      antes: 'a[href="/video-editor?ver=crear"]',
      titulo: 'Pídelo en una línea',
      texto: 'Un reel de 30 segundos sobre tu programa, y MaKo lo arma.',
      sub: 'Mira aquí, la caja de arriba: escribe en una línea lo que quieres.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Ver un ejemplo de Anuncio con gancho"]',
      titulo: 'Ver ejemplo',
      texto: 'Así queda terminado, antes de que armes el tuyo.',
      sub: 'Toca aquí, en Ver ejemplo, para ver un anuncio terminado antes de usar su plantilla.',
      lado: 'arriba',
    },
    {
      sel: 'button[aria-label="Usar la plantilla Mensaje para…"]',
      titulo: 'Mensaje para…',
      texto: 'Replica un video que funcionó, paso a paso, con MaKo en el chat del editor.',
      sub: 'Para el primero, toca aquí, en Mensaje para…: le hablas a tu cliente ideal en 30 segundos.',
      lado: 'derecha',
      haz: 'Haz clic en «Mensaje para…»',
      clic: true,
    },
  ],
};
