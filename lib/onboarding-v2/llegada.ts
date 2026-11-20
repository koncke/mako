// =============================================================================
// LA LLEGADA AL OPS CENTER (20/11/2026, OD-05): lo puro (app/second-brain/LlegadaAlReto.tsx dibuja; es el primer mensaje del chat del reto)
// =============================================================================
// Los puntitos ya no duran un tiempo fijo (eran 1,8 s): los de la cola de salida, según el largo del mensaje (app/_chat/useColaDeSalida.ts →
// msEscribiendo). La presentación del reto en el chat «Onboarding» (OD-09, «¡Listo tu onboarding…!») se fue con la llegada: ahora la
// llegada ES el primer mensaje del chat del reto (Martín, 20/11).

/** El id con que el motor anota que vio el recorrido del Ops Center (`tutorial-<pestaña>`, app/_ui/tutorial/MotorTutorial.tsx). */
export const ID_RECORRIDO = 'tutorial-ops-center';
/** El mensaje de MaKo con el video del recorrido (la maqueta, b-entra). */
export const textoLlegada = (nombre: string): string =>
  `Te doy la bienvenida a tu Ops Center${nombre ? `, ${nombre}` : ''}. Dale play: te muestro dónde está cada cosa.`;
