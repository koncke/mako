// =============================================================================
// Lo que /api/extract-receipt leyó de un comprobante, para el formulario de «Marcar pagada» (21/10/2026, Pagos)
// =============================================================================
// ⚠️ LA PANTALLA LEÍA `monto` Y LA RUTA DECÍA `monto_usd` (revisión del 21/10/2026): el monto no llegaba nunca. Y al
//    arreglarlo apareció lo de fondo: ese `monto_usd` lo CONVERTÍA la IA con una tasa inventada, así que un pago entero de
//    MX$5.000 llenaba «Faltan US$11,24» (y al guardar nacía esa cuota) o un cobro de más. Ahora la ruta devuelve el monto
//    y la MONEDA del comprobante, sin convertir, y `plataDeRecibo` decide: en dólares se llena; en la moneda del negocio
//    se llena el monto en esa moneda y el valor en dólares queda vacío, o sea el de la cuota (`pagoEnMoneda`); en otra,
//    no se llena y se dice. Nunca una tasa de la IA (AGENTS.md: el valor en dólares lo declara quien cobra). Lo fija un
//    test que pasa por la ruta REAL (tests/pagos-recibo-leido.test.ts).
// Puro: lo usa piezas.tsx y lo corre el test.

export type ReciboLeido = { monto: number | null; moneda: string | null; fecha: string | null; hora: string | null; nota: string | null; nombre: string | null };

/** La respuesta de la ruta, leída. `{ error }` si la ruta dijo que no pudo. */
export function reciboLeido(j: unknown): ReciboLeido | { error: string } {
  const o = j && typeof j === 'object' ? (j as Record<string, unknown>) : {};
  if (typeof o.error === 'string' && o.error) return { error: o.error };
  const monto = typeof o.monto === 'number' && Number.isFinite(o.monto) && o.monto > 0 ? o.monto : null;
  const moneda = monto != null && typeof o.moneda === 'string' && /^[A-Za-z]{3}$/.test(o.moneda) ? o.moneda.toUpperCase() : null;
  const fecha = typeof o.fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(o.fecha) ? o.fecha.slice(0, 10) : null;
  const hora = typeof o.hora === 'string' && /^\d{1,2}:\d{2}/.test(o.hora) ? o.hora.padStart(5, '0').slice(0, 5) : null;
  const nota = typeof o.nota === 'string' && o.nota.trim() ? o.nota.trim() : null;
  const nombre = typeof o.comprobante_nombre === 'string' && o.comprobante_nombre ? o.comprobante_nombre : null;
  return { monto, moneda, fecha, hora, nota, nombre };
}

/** Qué llena lo leído en los campos de plata de «Marcar pagada» (`usd` vacío = vale el de la cuota). `aviso`: lo que no. */
export function plataDeRecibo(r: ReciboLeido, monedaNegocio: string): { plata: { moneda: string; monto: string; usd: string } | null; aviso: string | null } {
  if (r.monto == null) return { plata: null, aviso: null };
  const delNegocio = monedaNegocio.toUpperCase();
  if (r.moneda === 'USD') return { plata: { moneda: 'USD', monto: String(r.monto), usd: '' }, aviso: null };
  if (r.moneda && r.moneda === delNegocio) return { plata: { moneda: delNegocio, monto: String(r.monto), usd: '' }, aviso: null };
  return {
    plata: null,
    aviso: r.moneda ? `el comprobante está en ${r.moneda}: carga el monto a mano` : 'el comprobante no dice la moneda: carga el monto a mano',
  };
}
