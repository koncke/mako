// =============================================================================
// producto-precio-texto — cómo dice el precio la tarjeta que confirma un producto (6/11/2026)
// =============================================================================
// `guardar_producto` (lib/api-mako/areas/crm.run.ts) dejaba en el resumen SÓLO el precio nuevo: quien confirmaba desde el
// chat o la bandeja aprobaba «200 USD» sin ver que antes eran 2.000. Un cambio de precio dice lo que había y lo que queda.
// Sin `server-only`: lo prueba tests/producto-precio-texto.test.ts.
// =============================================================================

const precio = (v: number | null | undefined, alMes: boolean): string => (v != null ? `${String(v)} USD${alMes ? ' al mes' : ''}` : 'sin precio');

/** El precio del resumen: «antes → ahora» cuando se edita y cambia; si no, el que queda. */
export function precioDelResumen(o: {
  /** El producto como está guardado; undefined al crear. */
  antes?: { monto_usd: number | null; suscripcion: boolean };
  ahora: { monto_usd: number | null; suscripcion: boolean };
}): string {
  const queda = precio(o.ahora.monto_usd, o.ahora.suscripcion);
  if (!o.antes) return queda;
  const habia = precio(o.antes.monto_usd, o.antes.suscripcion);
  return habia === queda ? queda : `precio: ${habia} → ${queda}`;
}
