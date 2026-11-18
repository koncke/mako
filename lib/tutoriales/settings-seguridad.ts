// El tutorial de Settings › Seguridad (/perfil/seguridad: app/perfil/seguridad/SeguridadCuenta.tsx). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `settings-seguridad`): el link del índice (`que-es`) y un paso por cada frase con marca, en
// su orden, con la marca que fija el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · El índice lleva `tour-settings-<clave>` (app/_ui/Ajustes.tsx); la fila «Verificación en 2 pasos» de «Cómo entras», su marca.
// · «Configurar» vive ADENTRO del detalle de la verificación (`?ver=app`, otra vista): su paso toca antes la fila que lo abre (`antes`;
//   si ya se tocó, la fila no está y se sigue). Medido a 1440 en la entrada sólo su `antes`; la marca, en el detalle dibujado aparte.
// · Las dos últimas frases («Guarda tus diez códigos…» y el cierre) no marcan nada: sin paso. Por eso no hay `clic`.
// · En el teléfono es /m/cuenta/seguridad (otra pantalla), sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SETTINGS_SEGURIDAD: TutorialPestana = {
  pestana: 'settings-seguridad',
  nombre: 'Seguridad',
  ruta: '/perfil/seguridad',
  intro: 'Si alguien consigue tu correo, no debería entrar a tu negocio.',
  pasos: [
    {
      sel: '[data-recorrido="tour-settings-seguridad-2-pasos"]',
      titulo: 'Verificación en 2 pasos',
      texto: 'Además de tu correo, entrar te pide un código de tu celular.',
      sub: 'Toca aquí, en Verificación en 2 pasos, para que entrar pida un código de tu celular.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-settings-seguridad-configurar"]',
      titulo: 'Configurar',
      texto: 'Te muestra un QR: lo escaneas con Google Authenticator o Microsoft Authenticator y escribes el código.',
      sub: 'Mira aquí, en Configurar: escaneas el código con tu app de autenticación.',
      lado: 'izquierda',
      antes: '[data-recorrido="tour-settings-seguridad-2-pasos"]',
    },
  ],
};
