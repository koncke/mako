// =============================================================================
// Cuántas tarjetas dibuja una columna del Kanban (22/10/2026, ver app/crm/FinDeColumna.tsx). Puro: lo prueba
// tests/crm-columna-por-tandas.test.ts.
// =============================================================================

/** Las que se dibujan de entrada, y las que suma cada vuelta. 30 llenan el alto de cualquier pantalla (entran 6 o 7) y
 *  dejan margen para que la tanda siguiente llegue antes del fondo. Era 60 (22/10/2026): con 1.169 en 8 columnas eran 480
 *  tarjetas y 6.190 nodos, y en el Chrome de Martín cada nodo cuesta ~7 veces lo que en el arnés (ver la cabecera del test). */
export const TANDA_COLUMNA = 30;

/** Cuántas dibujar de `total`, con las tandas que la persona ya pidió (`pedidas`, sin pedir: una). */
export const cuantasDibujar = (total: number, pedidas: number | undefined): number =>
  Math.max(0, Math.min(total, Math.max(TANDA_COLUMNA, pedidas ?? TANDA_COLUMNA)));

/** «Ver 30 más · quedan 990»: cuántas trae el toque y cuántas faltan en total. */
export const rotuloVerMas = (quedan: number): string => `Ver ${Math.min(TANDA_COLUMNA, quedan)} más · quedan ${quedan.toLocaleString('es-MX')}`;
