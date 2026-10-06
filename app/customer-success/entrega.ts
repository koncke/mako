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
import { getTenantDb } from '@/lib/workspace';
import { secuenciasPorEtapaDeEntrega } from '@/lib/nutricion';
import { entregasDeProductos, clientesEnEntrega, type ClienteEnEntrega } from '@/lib/entrega-servicio';
import type { EtapaEntrega, FaseEntrega } from '@/lib/servicio-etapas';
import { leerTodo } from '@/lib/supabase-paginado';
import { casaDeCliente } from './pertenencia';

/** Un servicio que se puede entregar, con las columnas de SU entrega. */
export type Servicio = {
  productoId: number;
  nombre: string;
  etapas: EtapaEntrega[];
  /**
   * Los tramos que agrupan a las columnas. Vacío es el caso normal.
   *
   * ⚠️ VIAJA CON LAS ETAPAS, no aparte: el color de una columna sale de las dos cosas
   * juntas (`colorDeEtapa`), así que una pantalla que reciba las etapas sin las fases
   * dibuja los colores propios — o sea el estado de ANTES de agrupar, que se lee como
   * que agrupar no hizo nada.
   */
  fases: FaseEntrega[];
  /** `default` = nadie configuró estas etapas. La pantalla lo tiene que DECIR. */
  origen: 'declarado' | 'default';
  /** Es el producto del embudo PRINCIPAL del CRM: no se puede eliminar (sí renombrar). */
  principal: boolean;
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
      /**
       * El producto de la CASA de cada cliente ganado: el de su embudo del CRM
       * (`casaDeCliente`, ./pertenencia.ts). Un cliente es de un producto si es su casa o
       * si tiene una fila ahí — ver la cabecera de pertenencia.ts.
       *
       * ⚠️ `null` = no tiene casa que se ofrezca y vive sólo donde lo pusieron. Un lead
       * ausente del mapa (la lectura de embudos falló) también da `null`, y entonces cada
       * tablero muestra sólo a los que tienen fila: de menos, nunca a todos en todos.
       */
      casaPorLead: Record<number, number | null>;
    }
  | { ok: false; error: string };

/**
 * Los productos que esta pantalla ofrece como servicio: los activos MENOS los que el
 * CRM eliminó.
 *
 * ⚠️ «ACTIVO» NO ALCANZA, y lo midió Martín con una captura (05/10/2026): «haz puesto
 * otros que no existen… En el CRM de Mauricio, solo hay esos 2». Eliminar un producto en
 * el CRM ARCHIVA su embudo (`funnels.activo = false`, ver `archivarFunnel`) y deja el
 * producto con `activo = true`, así que leyendo sólo `productos` esta pantalla seguía
 * ofreciendo «Sistema DOS», que en el CRM vive en «Productos eliminados».
 *
 * La regla, en positivo: se ofrece todo producto activo que NO esté atado únicamente a
 * embudos archivados. Un producto SIN embudo se sigue ofreciendo — hay workspaces cuyos
 * productos nacieron en el catálogo antes de la cadena producto → oferta → embudo
 * (medido: el ws13 tiene tres, y una entrega real sobre uno), y exigir el embudo les
 * borraría el tablero. Restaurar el embudo desde el CRM lo devuelve acá sin hacer nada.
 *
 * Nunca tira: si la vista falla, se cae a «activos» como antes — mostrar de más es
 * recuperable; un tablero vacío sobre una lectura caída afirma que no hay servicios.
 */
type Ofrecibles = {
  productos: Awaited<ReturnType<typeof listProductos>>;
  principales: Set<number>;
  /** embudo → producto, para la CASA de cada cliente. El primero del catálogo si un
   *  embudo vende varios. */
  productoDeFunnel: Map<number, number>;
  /** El embudo principal, si está atado a algún producto (si no, no resuelve nada). */
  funnelDefault: number | null;
};

async function productosOfrecibles(): Promise<Ofrecibles> {
  const productos = await listProductos(true);
  const principales = new Set<number>();
  const productoDeFunnel = new Map<number, number>();
  let funnelDefault: number | null = null;
  if (!productos.length) return { productos, principales, productoDeFunnel, funnelDefault };
  try {
    const db = await getTenantDb();
    const ids = productos.map((p) => p.id);
    const { data: vp, error } = await db.from('v_funnel_productos').select('funnel_id, producto_id').in('producto_id', ids);
    if (error) throw new Error(error.message);
    const links = (vp ?? []) as Array<{ funnel_id: number; producto_id: number }>;
    if (!links.length) return { productos, principales, productoDeFunnel, funnelDefault };
    // En el orden del catálogo, para que un embudo que vende dos productos caiga siempre
    // en el mismo — y en el mismo que el selector muestra primero.
    const orden = new Map(productos.map((p, i) => [p.id, i]));
    for (const l of [...links].sort((a, b) => (orden.get(Number(a.producto_id)) ?? 0) - (orden.get(Number(b.producto_id)) ?? 0))) {
      if (!productoDeFunnel.has(Number(l.funnel_id))) productoDeFunnel.set(Number(l.funnel_id), Number(l.producto_id));
    }
    const fids = [...new Set(links.map((l) => Number(l.funnel_id)))];
    const { data: fs, error: e2 } = await db.from('funnels').select('id, activo, es_default').in('id', fids);
    if (e2) throw new Error(e2.message);
    const filasF = (fs ?? []) as Array<{ id: number; activo: boolean; es_default: boolean }>;
    const vivo = new Map(filasF.map((f) => [Number(f.id), f.activo !== false]));
    // El producto del embudo PRINCIPAL no se puede eliminar (`archivarFunnel` lo frena):
    // la pantalla lo necesita para no dibujar un botón cuya única respuesta es «no».
    const defaults = new Set(filasF.filter((f) => f.es_default === true).map((f) => Number(f.id)));
    for (const l of links) if (defaults.has(Number(l.funnel_id))) principales.add(Number(l.producto_id));
    funnelDefault = [...defaults][0] ?? null;
    // producto → ¿tiene AL MENOS un embudo vivo? Los que no tienen ninguno no entran
    // al mapa y se ofrecen igual (ver arriba).
    const algunoVivo = new Map<number, boolean>();
    for (const l of links) {
      const pid = Number(l.producto_id);
      algunoVivo.set(pid, (algunoVivo.get(pid) ?? false) || (vivo.get(Number(l.funnel_id)) ?? false));
    }
    return { productos: productos.filter((p) => algunoVivo.get(p.id) !== false), principales, productoDeFunnel, funnelDefault };
  } catch (e) {
    console.warn('[entrega] no pude cruzar productos con embudos; se ofrecen todos los activos:', e instanceof Error ? e.message : e);
    return { productos, principales, productoDeFunnel, funnelDefault };
  }
}

/**
 * La casa de cada cliente ganado (ver `casaDeCliente`).
 *
 * ⚠️ UNA LECTURA DE `leads` APARTE, y no un campo más de `clientesGanados()`: esa lista la
 * comparten el picker del tablero y /admin, y el embudo de un cliente sólo le importa a
 * esta pantalla. Paginada por `id` (más de 1000 ganados no es imposible).
 *
 * Nunca tira: si falla, el mapa vuelve vacío y cada tablero muestra sólo a los que tienen
 * fila — de menos y no a todos en todos, que era el bug.
 */
async function casaDeLaCartera(
  ofrecidos: readonly number[],
  productoDeFunnel: ReadonlyMap<number, number>,
  funnelDefault: number | null,
  porServicio: Readonly<Record<number, Readonly<Record<number, unknown>>>>,
): Promise<Record<number, number | null>> {
  try {
    const db = await getTenantDb();
    const filas = await leerTodo<{ id: number; funnel_id: number | null }>(db, 'leads', 'id, funnel_id',
      { orden: 'id', eq: { estado_lead: 'ganado' } });
    const out: Record<number, number | null> = {};
    for (const l of filas) {
      const tieneFilas = ofrecidos.some((p) => porServicio[p]?.[l.id] !== undefined);
      out[l.id] = casaDeCliente({
        funnelId: l.funnel_id == null ? null : Number(l.funnel_id),
        funnelDefault, productoDeFunnel, ofrecidos, tieneFilas,
      });
    }
    return out;
  } catch (e) {
    console.warn('[entrega] no pude leer el embudo de los clientes:', e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * Los servicios del workspace y en qué etapa está cada cliente en cada uno.
 *
 * ⚠️ SÓLO LOS PRODUCTOS QUE SE OFRECEN (`productosOfrecibles`). Un producto dado de baja
 * —o eliminado en el CRM— no es un servicio que se esté entregando, y ofrecerlo en el
 * selector obliga a quien mira a descartar a mano las opciones muertas. Las filas de
 * `cliente_entrega` de un producto dado de baja NO se borran: el histórico del cliente
 * dice lo que pasó.
 */
export async function carteraEnEntrega(): Promise<CarteraEnEntrega> {
  try {
    const { productos, principales, productoDeFunnel, funnelDefault } = await productosOfrecibles();
    if (!productos.length) return { ok: true, servicios: [], porServicio: {}, secuenciasPorServicio: {}, casaPorLead: {} };

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
        fases: cat?.fases ?? [],
        origen: cat?.origen ?? 'default',
        principal: principales.has(p.id),
      };
    });
    const casaPorLead = await casaDeLaCartera(ids, productoDeFunnel, funnelDefault, porServicio);
    return { ok: true, servicios, porServicio, secuenciasPorServicio: Object.fromEntries(secs), casaPorLead };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer la entrega de tus servicios.' };
  }
}
