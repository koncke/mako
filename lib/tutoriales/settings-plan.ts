// El tutorial de Settings › Tu plan (/configuraciones/plan: app/configuraciones/plan/PlanPanel.tsx). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `settings-plan`): el link del índice (`que-es`) y un paso por cada frase con marca, en su
// orden, con la marca que fija el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · El índice lleva `tour-settings-<clave>` (app/_ui/Ajustes.tsx).
// · «Tu primer mes» salió del guion (18/11): la fila sale sólo durante el primer mes PAGADO (`lineaDelPrimerMes`), no en la prueba; lo
//   que se cobra ya lo dice el paso del índice.
// · «Empezar mi plan ya» (el cierre) lleva `clic`: la fila no se apaga (mientras corre otra acción deja de ser botón, y en el tutorial
//   no corre ninguna). Tocarla abre el pago. Sin prueba (ya se cobra) no existe y el motor saltea el paso.
// · En el teléfono (/m/configuraciones/plan) no hay ninguna de estas filas (el teléfono no vende): sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_SETTINGS_PLAN: TutorialPestana = {
  pestana: 'settings-plan',
  nombre: 'Tu plan',
  ruta: '/configuraciones/plan',
  intro: 'Cero sorpresas el día del cobro.',
  pasos: [
    {
      sel: '[data-recorrido="tour-settings-plan-pro"]',
      titulo: 'Pasar a MaKo Pro',
      texto: 'Lo pides aquí y te lo cambiamos antes de que termine tu prueba. Pedirlo no cobra nada.',
      sub: 'Mira aquí, Pasar a MaKo Pro: si quieres más, pídelo y te lo cambiamos antes de que termine tu prueba.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-settings-plan-empezar"]',
      titulo: 'Empezar mi plan ya',
      texto: 'Pagas desde hoy y se van los topes de la prueba.',
      sub: 'Si te convenció, toca aquí, en Empezar mi plan ya: pagas desde hoy y se van los topes de la prueba.',
      lado: 'abajo',
      haz: 'Haz clic en Empezar mi plan ya',
      clic: true,
    },
  ],
};
