// El tutorial de Dashboard (/dashboard; en el teléfono /m/dashboard). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §13.
// El Dashboard vacío de un negocio nuevo: la caja para pedir, las plantillas y las hojas. En el teléfono, sólo las hojas (`.m-seg[aria-label="Hoja"]`).
import type { TutorialPestana } from './tipos';

export const TUTORIAL_DASHBOARD: TutorialPestana = {
  pestana: 'dashboard',
  nombre: 'Dashboard',
  ruta: '/dashboard',
  intro: '¿Qué miras cada mañana para saber cómo va tu negocio?',
  pasos: [
    {
      sel: '[data-caja-pedido]',
      titulo: 'Pídela con tus palabras',
      texto: 'MaKo arma la hoja con los datos de tu negocio. Por escrito o dictado.',
      sub: 'Mira aquí, la caja: pídele una hoja a MaKo, como «lo que tengo que hacer hoy y a quién cobrarle».',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'input[aria-label="Buscar plantilla"]',
      titulo: 'Más plantillas',
      texto: 'Agencia, curso, Instagram, cobranza y más: escribe el tema.',
      sub: 'Mira aquí, Buscar plantilla: escribe agencia, curso o Instagram para encontrar la tuya.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: '[data-plantilla="general"]',
      titulo: 'General',
      texto: 'Lo cobrado contra lo invertido, quién te necesita y tus próximas llamadas.',
      sub: 'Para empezar, toca aquí, en General: lo que entró, lo que invertiste y quién te necesita.',
      lado: 'arriba',
      haz: 'Haz clic en la plantilla General',
      clic: true,
      soloComputadora: true,
    },
  ],
};
