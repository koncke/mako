// El tutorial de Calendar (/calendario). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §4.
// Las marcas `calendario-*` son las de su guía (app/calendario/guia-calendario.ts). La llamada R1 es la PRIMERA de la semana (`aria-label` «R1 con …»). Sólo computadora por ahora.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CALENDAR: TutorialPestana = {
  pestana: 'calendar',
  nombre: 'Calendar',
  ruta: '/calendario',
  intro: 'Tu semana entera en un solo lugar: llamadas de venta, publicaciones, entregas y lo que vence en el Plan.',
  pasos: [
    {
      sel: '[data-recorrido="calendario-usos"]',
      titulo: 'Qué ver',
      texto: 'Cada nombre prende o apaga ese tipo. El + de al lado crea uno nuevo.',
      sub: 'Toca un nombre para esconderlo y quedarte con lo que importa hoy.',
      lado: 'abajo',
    },
    {
      sel: '[aria-label^="R1 con "]',
      titulo: 'Desde el CRM',
      texto: 'Llegó sola desde el CRM, con el lead y su reunión.',
      sub: 'Las reuniones que se agendan en el CRM aparecen aquí solas, con el nombre del lead.',
      lado: 'derecha',
    },
    {
      sel: 'a[href="/calendario?vista=llamadas"]',
      titulo: 'Llamadas',
      texto: 'Todas tus llamadas de venta en una lista, una debajo de otra.',
      sub: 'En Llamadas ves todas juntas, sin nada alrededor.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="calendario-llamada"]',
      titulo: 'Nueva llamada de venta',
      texto: 'Anota la que no entró por tu agenda, así no se pierde.',
      sub: '¿Una llamada que no pasó por la agenda? Anótala con este más.',
      lado: 'abajo',
      haz: 'Haz clic en el + de Ventas',
      clic: true,
    },
  ],
};
