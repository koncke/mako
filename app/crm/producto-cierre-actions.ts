'use server';

// =============================================================================
// «¿Qué compró?» al cerrar en Ganado — el catálogo para el paso del asistente (24/10/2026)
// =============================================================================
// Decisión de Martín (agosto 2026, memoria «productos-catalogo-crm»): elegir el producto al cerrar es OBLIGATORIO, con un
// «Otro / personalizado» para los casos sueltos, y el cierre hereda del producto el tipo de venta y el monto. El paso vive en
// ./StageMoveDialog.tsx; lo que se elige se guarda en `leads.producto_id` (mig 0117, hasta hoy una columna que nadie escribía)
// por `completeStageMoveAction`, que lo valida contra el catálogo de este negocio.

import { exigirSesion } from '@/lib/sesion-accion';
import { listProductos } from '@/lib/productos';

export type ProductoCierre = { id: number; nombre: string; tipo: 'unico' | 'suscripcion'; montoUsd: number | null; meses: number | null };

/** Los productos ACTIVOS del negocio, en su orden. Sin catálogo (o si no se pudo leer), vacío: el paso no se ofrece. */
export async function productosParaCierreAction(): Promise<ProductoCierre[]> {
  await exigirSesion();
  try {
    return (await listProductos(true)).map((p) => ({
      id: Number(p.id), nombre: p.nombre, tipo: p.tipo === 'suscripcion' ? 'suscripcion' : 'unico',
      montoUsd: p.monto_usd != null ? Number(p.monto_usd) : null, meses: p.suscripcion_meses != null ? Number(p.suscripcion_meses) : null,
    }));
  } catch (e) {
    console.error('[producto-cierre] no pude leer el catálogo:', e instanceof Error ? e.message : String(e));
    return [];
  }
}
