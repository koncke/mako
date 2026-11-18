// El tutorial del Ops Center (/second-brain): día 1 del reto. Sus pasos son las frases con `sel` de su video (public/tutoriales/
// manifiesto.json, key `ops-center`), en su orden y con el mismo sel; el `sub` es la frase (los arma
// C:/dev/artefactos-pestanas/pasos-desde-manifiesto.mts). Las marcas `sb-*` son las de su guía (app/second-brain/guia-ops-center.ts,
// con `ancla()`); «¿Qué hago hoy?», la de lib/tutoriales/marcas.ts. En el teléfono (/m/second-brain) todavía no está medido.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_OPS_CENTER: TutorialPestana = {
  pestana: 'ops-center',
  nombre: 'Ops Center',
  ruta: '/second-brain',
  intro: 'Imagina un equipo que trabaja para tu negocio todo el día.',
  pasos: [
    {
      sel: '[data-recorrido="sb-nuevo"]',
      titulo: 'Un chat por tema',
      texto: 'Abre uno para cada asunto: ventas, contenido, cobros. Cada uno guarda lo suyo.',
      sub: 'Toca aquí, en Nuevo chat, para abrir uno por tema, así nada se mezcla.',
      lado: 'derecha',
    },
    {
      sel: '[data-recorrido="sb-escribir"]',
      titulo: 'Pídeselo',
      texto: 'Escríbele lo que necesitas, como a una persona de tu equipo.',
      sub: 'Mira aquí, Escribe a Ops Center: tu pedido va por escrito o en una nota de voz.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="tour-ops-center-que-hago-hoy"]',
      titulo: '¿Qué hago hoy?',
      texto: 'MaKo mira lo que tienes pendiente y te dice por dónde empezar.',
      sub: 'Para arrancar, toca aquí, en ¿Qué hago hoy?: MaKo mira tu negocio y te ordena el día.',
      lado: 'abajo',
      haz: 'Haz clic en «¿Qué hago hoy?»',
      clic: true,
    },
  ],
};
