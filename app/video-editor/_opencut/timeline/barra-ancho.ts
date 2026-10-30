// =============================================================================
// La barra de herramientas de la línea de tiempo según su ANCHO: nada queda fuera de la vista
// =============================================================================
// Martín, 30/10/2026 («revisa bien todo»). La barra iba en un ScrollArea con la barra de scroll OCULTA: lo que no entraba
// quedaba fuera de la vista sin aviso. Medido en el banco (la barra real con las herramientas que registran los paquetes,
// el motor reemplazado): las herramientas ocupan 983 px, y el centro del editor mide 950 a 1366 con el chat abierto
// («Acercar» afuera), 864 a 1280 (el deslizador y «Acercar») y 688 a 1280 con la barra lateral fija (siete afuera).
//
// Ahora: con menos de ANCHO_CON_PRESCINDIBLES se esconde primero lo `prescindible` (el deslizador del zoom: − y + hacen lo
// mismo, y «Hacer zoom para ajustar» queda), y si aun así no entra, la barra se PARTE en dos filas (CSS, sin medir): la
// derecha baja y queda a la derecha. Así ninguna herramienta nueva puede volver a quedar afuera.
//
// Sin imports: lo carga el test en node.

/** Desde qué ancho de barra (px) entran las herramientas prescindibles: las 983 medidas el 30/10, con aire. */
export const ANCHO_CON_PRESCINDIBLES = 1000;

/** Si la barra muestra las prescindibles. Sin medir todavía (0), sí: lo de siempre. */
export const conPrescindibles = (ancho: number): boolean => ancho <= 0 || ancho >= ANCHO_CON_PRESCINDIBLES;
