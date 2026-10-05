// =============================================================================
// en-etapa — hace cuánto que un cliente está en su etapa de entrega (puro)
// =============================================================================
// Sin 'use client' ni 'server-only' a propósito: lo leen el kanban y la tabla de
// Customer Success, y un test lo ejecuta (tests/cs-en-etapa.test.ts).
//
// ⚠️ EXISTE PARA QUE LAS DOS VISTAS DIGAN LO MISMO. Hasta el 05/10/2026 la cuenta vivía
// adentro de `KanbanEntrega.tsx` (`hace` + `DIAS_TRABADO`, sin exportar), y la tabla
// necesitó el mismo dato para su columna «En la etapa». Escrita dos veces, la primera
// corrección —cambiar el umbral de «trabado», o cómo se dice «recién»— deja a la tarjeta
// y a la fila del MISMO cliente contando cosas distintas. Desde el commit 42d91a41 el
// kanban también lo importa de acá: ya no queda una segunda copia.

/** A partir de cuántos días sin moverse se dice en rojo. El mismo número que el kanban. */
export const DIAS_TRABADO = 21;

export type TiempoEnEtapa = {
  /** Una sola unidad y sin «hace»: «3 días», «5 h», «recién». Para una columna que ya
   *  se llama «En la etapa». */
  corto: string;
  /** La frase entera: «hace 3 días», «recién». Para un chip suelto. Con el «hace» del lado
   *  del que llama, el caso corto saldría «hace recién». */
  frase: string;
  /** Días con decimales: lo que decide el «trabado». */
  dias: number;
  trabado: boolean;
};

/**
 * Hace cuánto que está en su etapa.
 *
 * `null` = no hay dato que decir: sin fecha (un cliente sin fila nunca se movió, y su reloj
 * no arrancó), una fecha ilegible o una del FUTURO (un reloj de servidor corrido). En los
 * tres casos inventar un «recién» sería afirmar algo que nadie midió.
 *
 * ⚠️ `ahora` ES UN PARÁMETRO para que el test no dependa del reloj; la pantalla no lo pasa.
 */
export function tiempoEnEtapa(iso: string | null | undefined, ahora: number = Date.now()): TiempoEnEtapa | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ms = ahora - t;
  if (ms < 0) return null;
  const dias = ms / 86_400_000;
  const d = Math.floor(dias);
  let corto: string;
  if (d >= 1) corto = `${d} ${d === 1 ? 'día' : 'días'}`;
  else {
    const h = Math.floor(ms / 3_600_000);
    corto = h >= 1 ? `${h} h` : 'recién';
  }
  return { corto, frase: corto === 'recién' ? corto : `hace ${corto}`, dias, trabado: dias >= DIAS_TRABADO };
}
