// El tutorial del Ops Center (/second-brain): día 1 del reto. Guion: docs/reto-7-dias/tutoriales-por-pestana.md §1.
// Las marcas `sb-*` son las de su guía (app/second-brain/guia-ops-center.ts, puestas con `ancla()`); «¿Qué hago hoy?», la de
// lib/tutoriales/marcas.ts. En el teléfono (/m/second-brain) todavía no está medido: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_OPS_CENTER: TutorialPestana = {
  pestana: 'ops-center',
  nombre: 'Ops Center',
  ruta: '/second-brain',
  intro: 'Aquí no se busca nada: se pide.',
  pasos: [
    {
      sel: conMarca('sb-nuevo'),
      titulo: 'Un chat por tema',
      texto: 'Abre uno para cada asunto: ventas, contenido, cobros. Cada uno guarda lo suyo.',
      sub: 'Un tema, un chat. Así Máko no mezcla una conversación con otra.',
      lado: 'derecha',
    },
    {
      sel: 'button[title="Tu plan de la semana"]',
      titulo: 'Tu plan de la semana',
      texto: 'Lo dejó listo el onboarding. Si algo cambió, díselo en este chat.',
      sub: 'Tu plan de esta semana tiene su propio chat. Los cambios se piden ahí mismo.',
      lado: 'derecha',
    },
    {
      sel: 'button[aria-label="Grabar una nota de voz"]',
      titulo: 'Por audio',
      texto: 'Graba lo que necesitas: vale igual que un mensaje escrito.',
      sub: '¿Estás en la calle? Grábale una nota de voz.',
      lado: 'arriba',
    },
    {
      sel: conMarca('sb-uso'),
      titulo: 'Uso',
      texto: 'Tus cuentas de IA conectadas y lo que gastó cada una.',
      sub: 'En Uso ves qué cuenta de IA trabaja para ti y cuánto lleva gastado.',
      lado: 'derecha',
    },
    {
      sel: conMarca(MARCA.opsCenterQueHagoHoy),
      titulo: '¿Qué hago hoy?',
      texto: 'MaKo mira lo que tienes pendiente y te dice por dónde empezar.',
      sub: 'Y para arrancar, toca «¿Qué hago hoy?». Máko mira tu negocio y te ordena el día.',
      lado: 'abajo',
      haz: 'Haz clic en «¿Qué hago hoy?»',
      clic: true,
    },
  ],
};
