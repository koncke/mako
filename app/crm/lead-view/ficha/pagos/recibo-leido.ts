// =============================================================================
// Lo que /api/extract-receipt leyó de un comprobante, para el formulario de «Marcar pagada» (21/10/2026, Pagos)
// =============================================================================
// ⚠️ EL MONTO SE LLAMA `monto_usd` (revisión adversarial del 21/10/2026, medio): la ruta lo devuelve con ese nombre —el
//    prompt RECEIPT_EXTRACT_DEFAULT pide el monto EN DÓLARES, convertido si el comprobante está en otra moneda, con el
//    tipo de cambio en `nota`— y la pantalla leía `j.monto`. El monto no llegaba nunca: el campo quedaba con el valor de
//    la cuota, no aparecía «Faltan US$200» y, guardado así, un pago de menos saldaba la cuota entera. Lo fija un test que
//    pasa por la ruta REAL (tests/pagos-recibo-leido.test.ts), no por un mock con el nombre que espera la pantalla.
// Puro: lo usa piezas.tsx y lo corre el test.

export type ReciboLeido = { montoUsd: number | null; fecha: string | null; hora: string | null; nota: string | null; nombre: string | null };

/** La respuesta de la ruta, leída. `{ error }` si la ruta dijo que no pudo. */
export function reciboLeido(j: unknown): ReciboLeido | { error: string } {
  const o = j && typeof j === 'object' ? (j as Record<string, unknown>) : {};
  if (typeof o.error === 'string' && o.error) return { error: o.error };
  const monto = typeof o.monto_usd === 'number' && Number.isFinite(o.monto_usd) && o.monto_usd > 0 ? o.monto_usd : null;
  const fecha = typeof o.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.fecha) ? o.fecha.slice(0, 10) : null;
  const hora = typeof o.hora === 'string' && /^\d{1,2}:\d{2}/.test(o.hora) ? o.hora.padStart(5, '0').slice(0, 5) : null;
  const nota = typeof o.nota === 'string' && o.nota.trim() ? o.nota.trim() : null;
  const nombre = typeof o.comprobante_nombre === 'string' && o.comprobante_nombre ? o.comprobante_nombre : null;
  return { montoUsd: monto, fecha, hora, nota, nombre };
}
