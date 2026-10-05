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
import { secuenciasPorEtapaDeEntrega } from '@/lib/nutricion';
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
  | {
      ok: true;
      servicios: Servicio[];
      porServicio: Record<number, Record<number, ClienteEnEntrega>>;
      /**
       * Cuántas SECUENCIAS cuelgan de cada etapa de cada servicio.
       *
       * Lo necesita el editor: borrar una columna no sólo deja clientes sin lugar,
       * también deja secuencias apuntando a una etapa que no existe — y ésas dejan
       * de dispararse sin que nada avise. «Sacar algo de un catálogo no es borrarlo:
       * hay gente APUNTÁNDOLE», y los clientes eran sólo la mitad de esa gente.
       *
       * ⚠️ `null` = NO SE PUDO LEER, y hay que tratarlo distinto de un mapa vacío:
       * decir «ninguna secuencia» sobre una consulta caída es la afirmación que hace
       * apretar el botón. Las etapas sin secuencias vienen AUSENTES, no en cero: el
       * universo de etapas es de acá, no de la nutrición.
       */
      secuenciasPorServicio: Record<number, Record<string, number> | null>;
    }
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
    if (!productos.length) return { ok: true, servicios: [], porServicio: {}, secuenciasPorServicio: {} };

    const ids = productos.map((p) => p.id);
    const catalogos = await entregasDeProductos(ids);

    // Una consulta por servicio, en paralelo. Son tan pocas como productos activos
    // tenga el negocio (hoy, entre uno y un puñado) y cada una está indexada por
    // (workspace_id, producto_id, etapa) — el índice del tablero de la mig 0188.
    const filas = await Promise.all(ids.map(async (id) => [id, await clientesEnEntrega(id)] as const));
    // Las secuencias de cada servicio, en la misma tanda. Son una consulta chica por
    // producto y viajan con el HTML por lo mismo que todo lo demás de esta pantalla:
    // el editor se abre encima del tablero y no puede tener estado de carga.
    const secs = await Promise.all(ids.map(async (id) => [id, await secuenciasPorEtapaDeEntrega(id)] as const));

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
    return { ok: true, servicios, porServicio, secuenciasPorServicio: Object.fromEntries(secs) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer la entrega de tus servicios.' };
  }
}
