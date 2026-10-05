import 'server-only';

// =============================================================================
// entrega — lo que la pantalla necesita para dibujar el kanban de la entrega
// =============================================================================
// Una sola lectura para TODOS los servicios, por lo mismo que el trabajo de la
// cartera viaja con el HTML: el kanban no puede tener estado de carga. Cambiar de
// servicio en el selector no pide nada — es un filtro sobre lo que ya llegó.
//
// ⚠️ LO QUE NO SE PUDO LEER SE DICE. `ok: false` NO es «este workspace no entrega
// nada»: son dos pantallas distintas, y un tablero vacío sobre una lectura caída le
// afirma a alguien que no tiene clientes en entrega.

import { listProductos } from '@/lib/productos';
import { entregasDeProductos, clientesEnEntrega, type ClienteEnEntrega } from '@/lib/entrega-servicio';
import type { EtapaEntrega } from '@/lib/servicio-etapas';

/** Un servicio que se puede entregar, con las columnas de SU entrega. */
export type Servicio = {
  productoId: number;
  nombre: string;
  etapas: EtapaEntrega[];
  /** `default` = nadie configuró estas etapas. La pantalla lo tiene que DECIR. */
  origen: 'declarado' | 'default';
};

export type CarteraEnEntrega =
  | { ok: true; servicios: Servicio[]; porServicio: Record<number, Record<number, ClienteEnEntrega>> }
  | { ok: false; error: string };

/**
 * Los servicios del workspace y en qué etapa está cada cliente en cada uno.
 *
 * ⚠️ SÓLO LOS PRODUCTOS ACTIVOS. Un producto dado de baja no es un servicio que se
 * esté entregando, y ofrecerlo en el selector obliga a quien mira a descartar a mano
 * las opciones muertas. Las filas de `cliente_entrega` de un producto dado de baja NO
 * se borran: el histórico del cliente dice lo que pasó.
 */
export async function carteraEnEntrega(): Promise<CarteraEnEntrega> {
  try {
    const productos = await listProductos(true);
    if (!productos.length) return { ok: true, servicios: [], porServicio: {} };

    const ids = productos.map((p) => p.id);
    const catalogos = await entregasDeProductos(ids);

    // Una consulta por servicio, en paralelo. Son tan pocas como productos activos
    // tenga el negocio (hoy, entre uno y un puñado) y cada una está indexada por
    // (workspace_id, producto_id, etapa) — el índice del tablero de la mig 0188.
    const filas = await Promise.all(ids.map(async (id) => [id, await clientesEnEntrega(id)] as const));

    const porServicio: Record<number, Record<number, ClienteEnEntrega>> = {};
    for (const [id, cs] of filas) {
      const m: Record<number, ClienteEnEntrega> = {};
      for (const c of cs) m[c.lead_id] = c;
      porServicio[id] = m;
    }

    const servicios: Servicio[] = productos.map((p) => {
      const cat = catalogos.get(p.id);
      return {
        productoId: p.id,
        nombre: p.nombre,
        etapas: cat?.etapas ?? [],
        origen: cat?.origen ?? 'default',
      };
    });
    return { ok: true, servicios, porServicio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer la entrega de tus servicios.' };
  }
}
