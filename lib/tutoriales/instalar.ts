// El tutorial de Settings › Instalar la app (/perfil/instalar: app/perfil/instalar/InstalarApp.tsx). Sus tres grupos llevan marca. Sin
// video todavía: el `sub` es una propuesta para su guion. En el teléfono es /m/cuenta/instalar (otra pantalla), sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_INSTALAR: TutorialPestana = {
  pestana: 'instalar',
  nombre: 'Instalar la app',
  ruta: '/perfil/instalar',
  intro: 'MaKo va contigo: en la computadora, en el teléfono y en el navegador.',
  pasos: [
    {
      sel: conMarca(MARCA.instalarComputadora),
      titulo: 'En tu computadora',
      texto: 'La app para Windows o Mac. Con ella ves el CRM y el Plan aunque se corte internet.',
      sub: 'En tu computadora, MaKo es una app: ves tu CRM y tu Plan aunque se corte internet.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.instalarTelefono),
      titulo: 'En tu teléfono',
      texto: 'En el iPhone, desde Safari: Compartir y «Agregar a inicio». En Android, desde Chrome: «Instalar app».',
      sub: 'En el teléfono la agregas a tu pantalla de inicio desde el navegador.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.instalarNavegador),
      titulo: 'En tu navegador',
      texto: 'La extensión de MaKo para Chrome.',
      sub: 'Y en Chrome, la extensión de MaKo.',
      lado: 'izquierda',
    },
  ],
};
