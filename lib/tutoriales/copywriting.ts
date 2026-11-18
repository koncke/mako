// El tutorial de Copywriting (/copywriter; en el teléfono /m/copywriter). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §10.
// La portada de outliers (app/copywriter/OutliersCopy.tsx), la misma en el teléfono. Las plantillas (`#copy-plantillas`) son de la computadora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_COPYWRITING: TutorialPestana = {
  pestana: 'copywriting',
  nombre: 'Copywriting',
  ruta: '/copywriter',
  rutaMovil: '/m/copywriter',
  intro: 'El copy que vende casi nunca nace de una hoja en blanco.',
  pasos: [
    {
      sel: '#copy-plantillas',
      titulo: 'Plantillas con estructura',
      texto: 'Anuncios, reels, stories, carruseles y emails, cada uno con su ejemplo.',
      sub: 'Toca aquí, en Plantillas, si prefieres una base que ya trae gancho, cuerpo y cierre.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: '[data-recorrido="tour-copywriting-pegar"]',
      titulo: 'Pegar link o texto',
      texto: 'Trae uno de afuera para replicarlo igual que los de la grilla.',
      sub: 'Toca aquí, en Pegar link o texto, si viste uno afuera que quieres usar.',
      lado: 'abajo',
    },
    {
      sel: '[aria-label="Outliers de copy"] button',
      titulo: 'Replicar',
      texto: 'Conserva la estructura que funcionó y la llena con lo tuyo.',
      sub: 'Listo: toca aquí, en Replicar, y MaKo reescribe ese copy para lo que vendes.',
      lado: 'derecha',
      haz: 'Haz clic en Replicar',
      clic: true,
    },
  ],
};
