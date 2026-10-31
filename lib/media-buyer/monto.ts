// =============================================================================
// Media Buyer — un monto como lo escribe una persona (PURO: lo prueban los tests)
// =============================================================================
// La pantalla muestra la plata con separador de miles («$1,250», lib/format.ts → fmtDinero) y la gente escribe como lee:
// `Number('1,500'.replace(',', '.'))` daba 1,5. Lo usan «Editar» de una decisión, los Ajustes (objetivo, tope y metas) y el
// arranque (ticket, costo e inversión, que además vienen de pastillas escritas con fmtDinero). Revisión de tren-l, falla 4.
// =============================================================================

import { saltoPresupuesto } from '@/lib/presupuesto-cambio';

/**
 * El monto de «Editar», leído como lo escribe una persona: «1,500» y «1.500» son mil quinientos (separador de miles, como
 * los muestra la pantalla: «MX$1,250»), «1,5» y «1.5» son uno y medio, «1,234.50» y «1.234,50» también se entienden.
 * null = no se entiende (la pantalla no lo lanza). Antes, `Number('1,500'.replace(',', '.'))` daba 1,5 por día.
 */
export function leerMonto(txt: string): number | null {
  const t = txt.trim().replace(/[^\d.,]/g, '');
  let n: number;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) n = Number(t.replace(/,/g, ''));
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if (/^\d+([.,]\d{1,2})?$/.test(t)) n = Number(t.replace(',', '.'));
  else return null;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** El primer monto de un texto suelto («$1,000 al mes», «US$ 1.500 cada venta»): sus dígitos con sus separadores. */
export function montoDelTexto(texto: string): number | null {
  const m = texto.match(/\d[\d.,]*\d|\d/);
  return m ? leerMonto(m[0]) : null;
}


export type RevisionMonto = { ok: true } | { ok: false; error: string; confirmar?: 'baja' };

/**
 * ¿Se escribe el presupuesto que una persona editó en «Editar»? Un salto de ×5 o más contra el de hoy (lib/presupuesto-cambio.ts)
 * frena, en las dos direcciones, pero no igual:
 *   · SUBIR cinco veces o más no sale: es casi siempre un cero de más, y la plata se gasta antes de que alguien lo vea;
 *   · BAJAR 80% o más sí se puede, con una confirmación clara (`bajaConfirmada`): es una decisión que alguien toma a propósito
 *     («esta campaña la dejo al mínimo»). Hasta el 27/10 se frenaba igual que la subida y el mensaje culpaba al separador de
 *     miles, que `leerMonto` ya entiende (verificación de tren-m: «la baja de 80% ya no se puede hacer desde MaKo»).
 */
export function revisarMontoEditado(nuevo: number, actual: number | null, o: { bajaConfirmada?: boolean; fmt: (n: number) => string }): RevisionMonto {
  if (!(nuevo > 0)) return { ok: false, error: 'El presupuesto tiene que ser mayor que cero.' };
  const salto = saltoPresupuesto(nuevo, actual);
  if (!salto || actual == null) return { ok: true };
  if (salto.sube) return { ok: false, error: `${o.fmt(nuevo)} por día es ${salto.veces} veces el de hoy (${o.fmt(actual)}). Revisa el monto.` };
  if (o.bajaConfirmada) return { ok: true };
  const pct = Math.round((1 - nuevo / actual) * 100);
  return { ok: false, confirmar: 'baja', error: `Bajarlo de ${o.fmt(actual)} a ${o.fmt(nuevo)} por día es ${pct}% menos.` };
}
