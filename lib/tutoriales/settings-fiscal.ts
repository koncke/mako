// El tutorial de Settings › Identidades fiscales (/configuraciones/fiscal: app/configuraciones/IdentidadesFiscalesPanel.tsx). Cuadra con
// el guion de su video (C:/dev/tutoriales-video/guiones.json, id `settings-fiscal`): el link del índice (`que-es`) y un paso por cada
// frase con marca, en su orden, con la marca que fija el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · El índice lleva `tour-settings-<clave>` (app/_ui/Ajustes.tsx); «Agregar» (el del título, no el del pie del formulario), su marca.
// · «Llenar desde un PDF o una foto» vive ADENTRO de la ventana que abre «Agregar»: su paso la abre antes (`antes`). Se apaga mientras
//   lee el documento, pero es una «mira»: sin `clic`. Medido a 1440 en la entrada sólo su `antes`; la marca, en la ventana dibujada aparte.
// · El cierre («Después, en cada venta del CRM…») no marca nada (Facturado por es de la ficha del lead): sin paso, y sin `clic`.
// · En el teléfono es /m/configuraciones/fiscal (otra pantalla), sin medir: sin `rutaMovil`.
import { MARCA, conMarca, marcaSettings } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SETTINGS_FISCAL: TutorialPestana = {
  pestana: 'settings-fiscal',
  nombre: 'Identidades fiscales',
  ruta: '/configuraciones/fiscal',
  intro: 'Tus datos fiscales se cargan una vez y sirven en cada venta.',
  pasos: [
    {
      sel: conMarca(marcaSettings('fiscal')),
      titulo: 'Identidades fiscales',
      texto: 'Tu moneda y los datos de cada empresa con la que facturas.',
      sub: 'Identidades fiscales, en Configuración, guarda tu moneda y cada empresa con la que facturas.',
      lado: 'derecha',
    },
    {
      sel: conMarca(MARCA.fiscalAgregar),
      titulo: 'Agregar',
      texto: 'Una empresa con su identificación fiscal (RFC, CUIT o NIT), su domicilio y su correo.',
      sub: 'Toca aquí, en Agregar, para sumar una empresa con su RFC, CUIT o NIT, su domicilio y su correo.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.fiscalLlenar),
      antes: conMarca(MARCA.fiscalAgregar),
      titulo: 'Llenar desde un PDF',
      texto: 'Subes tu constancia y MaKo completa lo que esté vacío. Lo revisas antes de guardar.',
      sub: 'Mira aquí, Llenar desde un PDF o una foto: MaKo completa los campos por ti.',
      lado: 'abajo',
    },
  ],
};
