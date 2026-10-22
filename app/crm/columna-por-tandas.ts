// =============================================================================
// Cuántas tarjetas dibuja una columna del Kanban (22/10/2026, ver app/crm/FinDeColumna.tsx). Puro: lo prueba
// tests/crm-columna-por-tandas.test.ts.
// =============================================================================

/** Las que se dibujan de entrada, y las que suma cada vuelta: con 60, una columna llena el alto de cualquier pantalla. */
export const TANDA_COLUMNA = 60;

/** Cuántas dibujar de `total`, con las tandas que la persona ya pidió (`pedidas`, sin pedir: una). */
export const cuantasDibujar = (total: number, pedidas: number | undefined): number =>
  Math.max(0, Math.min(total, Math.max(TANDA_COLUMNA, pedidas ?? TANDA_COLUMNA)));

/** «Ver 60 más · quedan 990»: cuántas trae el toque y cuántas faltan en total. */
export const rotuloVerMas = (quedan: number): string => `Ver ${Math.min(TANDA_COLUMNA, quedan)} más · quedan ${quedan.toLocaleString('es-MX')}`;
