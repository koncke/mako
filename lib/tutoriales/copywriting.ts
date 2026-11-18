// El tutorial de Copywriting (/copywriter; en el teléfono /m/copywriter). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §10.
// La portada de outliers (app/copywriter/OutliersCopy.tsx), la misma en el teléfono. Las plantillas (`#copy-plantillas`) son de la computadora.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_COPYWRITING: TutorialPestana = {
  pestana: 'copywriting',
  nombre: 'Copywriting',
  ruta: '/copywriter',
  rutaMovil: '/m/copywriter',
  intro: 'El copy que vende casi nunca nace de una hoja en blanco.',
  pasos: [
    {
      sel: '[aria-label="Qué ver"]',
      titulo: 'Por formato',
      texto: 'Anuncios, reels o YouTube: el número dice cuántos hay de cada uno.',
      sub: 'Aquí tienes los outliers de las cuentas que sigues: anuncios, reels y videos de YouTube.',
      lado: 'abajo',
    },
    {
      sel: 'button[aria-label="Orden"]',
      titulo: 'Mayor outlier',
      texto: 'Primero los que más rindieron contra lo normal de su cuenta.',
      sub: 'Arriba quedan los que más superaron a su autor.',
      lado: 'abajo',
    },
    {
      sel: '#copy-plantillas',
      titulo: 'Plantillas con estructura',
      texto: 'Anuncios, reels, stories, carruseles y emails, cada uno con su ejemplo.',
      sub: '¿Prefieres partir de una base? Las plantillas ya traen la estructura: gancho, cuerpo y cierre.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: conMarca(MARCA.copywritingPegar),
      titulo: 'Pegar link o texto',
      texto: 'Trae uno de afuera para replicarlo igual que los de la grilla.',
      sub: 'Si viste uno afuera, pega su link o su texto.',
      lado: 'abajo',
    },
    {
      sel: '[aria-label="Outliers de copy"] button',
      titulo: 'Replicar',
      texto: 'Conserva la estructura que funcionó y la llena con lo tuyo.',
      sub: 'Elige uno, toca Replicar, y Máko lo reescribe para lo que vendes.',
      lado: 'derecha',
      haz: 'Haz clic en Replicar',
      clic: true,
    },
  ],
};
