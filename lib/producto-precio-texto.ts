// =============================================================================
// producto-precio-texto — cómo dice el precio la tarjeta que confirma un producto (6/11/2026)
// =============================================================================
// `guardar_producto` (lib/api-mako/areas/crm.run.ts) dejaba en el resumen SÓLO el precio nuevo: quien confirmaba en
// /mako/revisar aprobaba «200 USD» sin ver que antes eran 2.000. Ahora el resumen —el título de esa pantalla— suma el precio
// de ANTES. ⚠️ Sólo el de antes junto al pedido (la revisión del 6/11/2026): el monto se edita en el formulario, así que un
// «2000 → 200» quedaría viejo si la persona lo corrige a 300; lo de antes no cambia, y el producto (`id`) queda fijo al revisar.
// Sin `server-only`: lo prueba tests/producto-precio-texto.test.ts.
// =============================================================================

const precio = (v: number | null | undefined, alMes: boolean): string => (v != null ? `${String(v)} USD${alMes ? ' al mes' : ''}` : 'sin precio');

/** El precio del resumen: el pedido, y «antes …» cuando se edita y cambia. */
export function precioDelResumen(o: {
  /** El producto como está guardado; undefined al crear. */
  antes?: { monto_usd: number | null; suscripcion: boolean };
  ahora: { monto_usd: number | null; suscripcion: boolean };
}): string {
  const queda = precio(o.ahora.monto_usd, o.ahora.suscripcion);
  if (!o.antes) return queda;
  const habia = precio(o.antes.monto_usd, o.antes.suscripcion);
  return habia === queda ? queda : `${queda}; antes ${habia}`;
}
