// El tutorial de Calendar (/calendario). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §4.
// Las marcas `calendario-*` son las de su guía (app/calendario/guia-calendario.ts). La llamada R1 es la PRIMERA de la semana (`aria-label` «R1 con …»). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CALENDAR: TutorialPestana = {
  pestana: 'calendar',
  nombre: 'Calendar',
  ruta: '/calendario',
  intro: 'Tu semana entera de un vistazo: llamadas, publicaciones, entregas y vencimientos.',
  pasos: [
    {
      sel: '[data-recorrido="calendario-usos"]',
      titulo: 'Qué ver',
      texto: 'Cada nombre prende o apaga ese tipo. El + de al lado crea uno nuevo.',
      sub: 'Toca aquí, en Publicaciones, Plan, Ventas o Entregas, para esconder los que no necesitas hoy.',
      lado: 'abajo',
    },
    {
      sel: 'a[href="/calendario?vista=llamadas"]',
      titulo: 'Llamadas',
      texto: 'Todas tus llamadas de venta en una lista, una debajo de otra.',
      sub: 'Toca aquí, en Llamadas, y las ves todas juntas, sin nada alrededor.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="calendario-llamada"]',
      titulo: 'Nueva llamada de venta',
      texto: 'Anota la que no entró por tu agenda, así no se pierde.',
      sub: 'Si tuviste una llamada fuera de la agenda, toca aquí, en el botón «+» de Ventas, y anótala.',
      lado: 'abajo',
      haz: 'Haz clic en el + de Ventas',
      clic: true,
      // Si tocaron Llamadas (la frase de arriba es una «Mira aquí», pero se puede tocar), el «+» no está en esa lista: el motor vuelve
      // a la semana (20/11, la verificación de calendar-5). Sin tocar nada, el «+» está y esto no corre.
      antes: 'a[href^="/calendario?vista=semana"]',
    },
  ],
};
