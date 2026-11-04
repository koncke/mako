import 'server-only';

// =============================================================================
// cs-diseno-server — lo que la hoja CS Analyst con diseño (la copia de Mender) lee además de sus piezas
// =============================================================================
// El ORDEN de las etapas de la entrega: los carriles de «Tu cartera por etapa» van en el orden del servicio (Bienvenida →
// Arranque → …), como el kanban de Clients, y la pieza de las etapas las ordena de la que más clientes tiene a la que menos.
// Es el catálogo de etapas de cada servicio (lib/entrega-servicio.ts), el mismo que dibuja Clients: los NOMBRES, en orden, sin
// repetir (dos servicios con una etapa que se llama igual comparten carril, como en la pieza). Sin poder leerlo, null: los
// carriles van como los ordena la pieza (lib/cs-diseno.ts), nunca se inventa un orden.
// =============================================================================

import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { entregasDeProductos } from './entrega-servicio';

export async function etapasDeLaEntregaEnOrden(): Promise<string[] | null> {
  try {
    const productos = await productosDeLaEntrega();
    const catalogos = await entregasDeProductos(productos.map((p) => p.id));
    const out: string[] = [];
    for (const p of productos) for (const e of catalogos.get(p.id)?.etapas ?? []) if (e.label && !out.includes(e.label)) out.push(e.label);
    return out;
  } catch {
    return null;
  }
}
