// =============================================================================
// LA LLEGADA AL OPS CENTER, EN EL CHAT «ONBOARDING» (20/11/2026, OD-05): lo puro (app/second-brain/BienvenidaOpsCenter.tsx dibuja)
// =============================================================================

/** Lo que dura la pantalla oscura con MaKo escribiendo, como en el onboarding (MS_ESCRIBE de app/onboarding/ChatArranqueV2.tsx). */
export const MS_ESCRIBE_LLEGADA = 1800;
/** El id con que el motor anota que vio el recorrido del Ops Center (`tutorial-<pestaña>`, app/_ui/tutorial/MotorTutorial.tsx). */
export const ID_RECORRIDO = 'tutorial-ops-center';
/** El mensaje de MaKo con el video del recorrido (la maqueta, b-entra). */
export const textoLlegada = (nombre: string): string =>
  `Te doy la bienvenida a tu Ops Center${nombre ? `, ${nombre}` : ''}. Dale play: te muestro dónde está cada cosa.`;
