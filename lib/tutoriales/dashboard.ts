// El tutorial de Dashboard (/dashboard; en el teléfono /m/dashboard). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §13.
// El Dashboard vacío de un negocio nuevo: la caja para pedir, las plantillas y las hojas. En el teléfono, sólo las hojas (`.m-seg[aria-label="Hoja"]`).
import type { TutorialPestana } from './tipos';

export const TUTORIAL_DASHBOARD: TutorialPestana = {
  pestana: 'dashboard',
  nombre: 'Dashboard',
  ruta: '/dashboard',
  rutaMovil: '/m/dashboard',
  intro: 'Tu Dashboard arranca vacío a propósito: tú eliges qué mirar cada mañana.',
  pasos: [
    {
      sel: '[data-caja-pedido]',
      titulo: 'Pídela con tus palabras',
      texto: 'MaKo arma la hoja con los datos de tu negocio. Por escrito o dictado.',
      sub: 'Pídele una hoja a Máko con tus palabras. Por ejemplo: lo que tengo que hacer hoy y a quién cobrarle.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'input[aria-label="Buscar plantilla"]',
      titulo: 'Más plantillas',
      texto: 'Agencia, curso, Instagram, cobranza y más: escribe el tema.',
      sub: 'Hay plantillas para agencias, cursos, Instagram y más. Búscalas por nombre.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: 'nav[aria-label="Hojas del Dashboard"], .m-seg[aria-label="Hoja"]',
      titulo: 'Tus hojas',
      texto: 'Focus es la primera. Cada hoja nueva queda al lado.',
      sub: 'Cada hoja que armes suma una pestaña arriba, para pasar de una a otra.',
      lado: 'abajo',
    },
    {
      sel: '[data-plantilla="general"]',
      titulo: 'General',
      texto: 'Lo cobrado contra lo invertido, quién te necesita y tus próximas llamadas.',
      sub: 'Para empezar, usa General: lo que entró, lo que invertiste y quién te necesita.',
      lado: 'arriba',
      haz: 'Haz clic en la plantilla General',
      clic: true,
      soloComputadora: true,
    },
  ],
};
