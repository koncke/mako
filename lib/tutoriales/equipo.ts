// El tutorial de Settings › Equipo (/equipo: app/equipo/EquipoView.tsx). Un negocio nuevo tiene una sola persona (quien lo abrió,
// admin): el rol y las acciones son las de esa fila (sus `aria-label` llevan el email: el paso toma la primera). «Invitar» lleva su
// marca. En el teléfono (/m/configuraciones/equipo) es otra pantalla, todavía sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_EQUIPO: TutorialPestana = {
  pestana: 'equipo',
  nombre: 'Equipo',
  ruta: '/equipo',
  intro: 'Aquí sumas a quien vende contigo, y cada uno ve sólo lo suyo.',
  pasos: [
    {
      sel: 'button[aria-label^="Rol de "]',
      titulo: 'Cada uno, su rol',
      texto: 'Admin ve todo tu negocio. El Closer, el CRM y WhatsApp. El Setter, también Email y Automations.',
      sub: 'Cada persona tiene un rol, y el rol decide qué ve.',
      lado: 'izquierda',
    },
    {
      sel: 'button[aria-label^="Acciones sobre "]',
      titulo: 'Sus acciones',
      texto: 'Reenviarle el acceso, suspenderla o quitarla del equipo.',
      sub: 'Si alguien se va, lo suspendes o lo quitas desde aquí.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.equipoInvitar),
      titulo: 'Invitar',
      texto: 'Su nombre, su email y su rol. Le llega el acceso por email.',
      sub: 'Para sumar a tu closer o a tu setter, toca Invitar.',
      lado: 'abajo',
      haz: 'Haz clic en Invitar',
      clic: true,
    },
  ],
};
