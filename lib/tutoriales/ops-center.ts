// El tutorial del Ops Center (/second-brain): día 1 del reto. Cuadra con el guion de su video (public/tutoriales/manifiesto.json,
// key `ops-center`): cada cosa que el video nombra tiene SU paso, en el mismo orden, y su `sub` es la frase del guion (el video es
// sólo texto con la voz de Martín: dónde tocar lo muestra el motor). Las marcas `sb-*` son las de su guía
// (app/second-brain/guia-ops-center.ts, con `ancla()`); «¿Qué hago hoy?», la de lib/tutoriales/marcas.ts. El chat «Reto de 7 días»
// lo crea el onboarding (si no está, el motor saltea el paso). En el teléfono (/m/second-brain) todavía no está medido.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_OPS_CENTER: TutorialPestana = {
  pestana: 'ops-center',
  nombre: 'Ops Center',
  ruta: '/second-brain',
  intro: 'Aquí no se busca nada: se pide.',
  pasos: [
    {
      sel: conMarca('sb-escribir'),
      titulo: 'Pídeselo',
      texto: 'Escríbele lo que necesitas, como a una persona de tu equipo.',
      sub: 'Aquí no se busca nada: se pide.',
      lado: 'arriba',
    },
    {
      sel: conMarca('sb-nuevo'),
      titulo: 'Un chat por tema',
      texto: 'Abre uno para cada asunto: ventas, contenido, cobros. Cada uno guarda lo suyo.',
      sub: 'Un tema, un chat. Así MaKo no mezcla una conversación con otra.',
      lado: 'derecha',
    },
    {
      sel: 'button[title="Reto de 7 días"]',
      titulo: 'Reto de 7 días',
      texto: 'El chat del reto: cada día, su video y lo que toca hacer.',
      sub: 'El reto tiene su propio chat, Reto de 7 días: ahí te espera el video de cada día.',
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
      sub: 'Y para arrancar, toca «¿Qué hago hoy?». MaKo mira tu negocio y te ordena el día.',
      lado: 'abajo',
      haz: 'Haz clic en «¿Qué hago hoy?»',
      clic: true,
    },
  ],
};
