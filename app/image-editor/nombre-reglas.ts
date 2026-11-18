// =============================================================================
// Qué nombre sirve al cambiarlo (PURO; 18/11/2026, F50): lo usa ./NombreModal.tsx y lo prueba tests/image-editor-nombre.test.ts
// =============================================================================

/** Los topes que guardan la base y el server: el título de un diseño (mig 0278, 200) y una búsqueda guardada (lib/carruseles/explorar.ts, 60). */
export const TOPE_NOMBRE_DISENO = 200;
export const TOPE_NOMBRE_BUSQUEDA = 60;

/**
 * El nombre limpio que se guarda, o null si no hay nada que guardar: vacío (sólo espacios), o igual al de antes. Los espacios
 * de más se juntan en uno, como hace el server al guardarlo (`sanearTitulo`), y pasado el tope se corta igual que él.
 */
export function nombreValido(antes: string, escrito: string, tope: number): string | null {
  const limpio = escrito.replace(/\s+/g, ' ').trim().slice(0, tope).trim();
  if (!limpio) return null;
  return limpio === antes.replace(/\s+/g, ' ').trim() ? null : limpio;
}
