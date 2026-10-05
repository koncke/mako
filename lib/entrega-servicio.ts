// =============================================================================
// entrega-servicio — las etapas de entrega de cada producto, contra Supabase
// =============================================================================
// La parte PURA (el catálogo, el default, el saneo) vive en lib/servicio-etapas.ts,
// sin `server-only`, para que la pantalla la pueda importar y los tests la puedan
// ejecutar. Acá está lo que toca la base.
//
// Lo que ESCRIBE la asignación de un cliente a una etapa no está acá: vive en
// lib/cs-mover-etapa.ts, que es el ÚNICO camino de escritura de `cliente_entrega`.
// Separado a propósito — si el guardado viviera al lado de las lecturas, el día que
// alguien necesite «mover» desde otra pantalla va a escribir un segundo camino en
// vez de llamar al que ya existe.
//
// ⚠️ TODAS LAS LECTURAS DE `cliente_entrega` PAGINAN. La tabla crece con los
// clientes y con los productos que cada uno compró, así que un `.select()` suelto
// anda perfecto hasta las 1000 filas y desde ahí pierde tarjetas SIN UN LOG: el
// kanban dibuja menos clientes y eso se lee como «no tengo clientes ahí».
//
// ⚠️ Y NINGUNA LECTURA SE COME SU ERROR. Un `select` de PostgREST con UNA columna
// que no existe rechaza la consulta ENTERA y `data` vuelve `undefined`: sin leer el
// error, «no hay filas» y «no pude leerlas» son el mismo `[]`.

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import {
  entregaPorDefecto, normalizarEtapas, conteoDeEtapas,
  type EntregaConfig, type EtapaEntrega,
} from './servicio-etapas';

const COLS_CATALOGO = 'producto_id, data, declarado';
const COLS_CLIENTE = 'id, lead_id, producto_id, etapa, etapa_desde, por';

/** Una fila de `cliente_entrega`: un cliente en una etapa de la entrega de un producto. */
export type ClienteEnEntrega = {
  id: number;
  lead_id: number;
  producto_id: number;
  /** La CLAVE de la etapa, nunca el rótulo. */
  etapa: string;
  etapa_desde: string;
  por: string;
};

type FilaCatalogo = { producto_id: number; data: unknown; declarado: boolean | null };

/**
 * Fila → config. `origen` sale de `declarado`, NUNCA del contenido de `data`.
 *
 * Una fila que nace con `'{}'::jsonb` es truthy en JS, así que mirar el contenido
 * leería «declarado» donde no se declaró nada — y la pantalla perdería la única
 * forma de decir «todavía no configuraste la entrega de este producto».
 */
function filaAEntrega(f: FilaCatalogo): EntregaConfig {
  const etapas = f.declarado
    ? normalizarEtapas((f.data as { etapas?: unknown } | null)?.etapas)
    : null;
  // Un `declarado: true` con un jsonb que no se puede sanear cae al default: un
  // tablero sin columnas no se puede dibujar, y la lista a medias es peor que el
  // default porque esconde clientes sin avisar (ver `normalizarEtapas`).
  if (!etapas) return entregaPorDefecto(f.producto_id);
  return { productoId: f.producto_id, etapas, origen: 'declarado' };
}

/**
 * Las etapas de entrega de VARIOS productos, de una sola consulta.
 *
 * Devuelve una entrada por cada id pedido — los que no tienen fila salen con su
 * default. Es la forma que necesita el kanban: la barra lista todos los productos y
 * no puede quedarse sin columnas para el que nadie configuró todavía.
 */
export async function entregasDeProductos(ids: readonly number[]): Promise<Map<number, EntregaConfig>> {
  const pedidos = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  const out = new Map<number, EntregaConfig>(pedidos.map((id) => [id, entregaPorDefecto(id)]));
  if (!pedidos.length) return out;

  const db = await getTenantDb();
  const { data, error } = await db.from('producto_entrega').select(COLS_CATALOGO).in('producto_id', pedidos);
  if (error) {
    // Fail-closed RUIDOSO: se devuelven los defaults (el tablero se dibuja) y queda
    // dicho que no se pudo leer, porque «no configuró» y «no pude leer» son dos cosas.
    console.error(`[entrega-servicio] no pude leer el catálogo de ${pedidos.length} producto(s): ${error.message}`);
    return out;
  }
  for (const f of (data ?? []) as FilaCatalogo[]) out.set(f.producto_id, filaAEntrega(f));
  return out;
}

/** Las etapas de entrega de UN producto (su default si no declaró nada). */
export async function entregaDeProducto(productoId: number): Promise<EntregaConfig> {
  const m = await entregasDeProductos([productoId]);
  return m.get(productoId) ?? entregaPorDefecto(productoId);
}

/**
 * Guarda las etapas de un producto y lo marca como DECLARADO.
 *
 * Escribe la lista ENTERA a propósito: las etapas son un orden, y un merge por
 * clave no puede expresar «esta columna va antes que aquélla» ni un borrado. Lo que
 * protege de perder algo es que quien llama arme la lista desde lo que leyó —y que
 * `nuevaClaveEtapa` nunca reuse una clave borrada, para que las filas viejas de
 * `cliente_entrega` no reaparezcan dentro de una columna nueva.
 */
export async function guardarEtapasEntrega(productoId: number, etapas: readonly EtapaEntrega[]): Promise<boolean> {
  const limpias = normalizarEtapas(etapas);
  if (!limpias) {
    console.error(`[entrega-servicio] etapas inválidas para el producto ${productoId}: no se guardó nada`);
    return false;
  }
  const db = await getTenantDb();
  const { error } = await db.from('producto_entrega').upsert(
    { producto_id: productoId, data: { etapas: limpias }, declarado: true, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,producto_id' },
  );
  if (error) {
    console.error(`[entrega-servicio] no pude guardar las etapas del producto ${productoId}: ${error.message}`);
    return false;
  }
  return true;
}

/** Los clientes que están en la entrega de un producto (las tarjetas del kanban). */
export async function clientesEnEntrega(productoId: number): Promise<ClienteEnEntrega[]> {
  const db = await getTenantDb();
  try {
    return await leerTodo<ClienteEnEntrega>(db, 'cliente_entrega', COLS_CLIENTE, {
      eq: { producto_id: productoId },
    });
  } catch (e) {
    console.error(`[entrega-servicio] no pude leer los clientes del producto ${productoId}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/**
 * En qué etapa está UN cliente, en cada producto que le estemos entregando.
 *
 * Son N y no una: `leads.producto_id` es el producto con el que se CERRÓ la venta
 * (mig 0117), y el pedido es explícito —«pueden tener muchos productos»—, así que un
 * cliente puede estar en varias entregas a la vez.
 */
export async function entregasDeCliente(leadId: number): Promise<ClienteEnEntrega[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('cliente_entrega').select(COLS_CLIENTE).eq('lead_id', leadId);
  if (error) {
    console.error(`[entrega-servicio] no pude leer las entregas del cliente ${leadId}: ${error.message}`);
    return [];
  }
  return (data ?? []) as ClienteEnEntrega[];
}

/** La fila de un cliente en la entrega de un producto, o `null` si no está adentro. */
export async function entregaDeCliente(leadId: number, productoId: number): Promise<ClienteEnEntrega | null> {
  const db = await getTenantDb();
  // ⚠️ Nunca `.maybeSingle()`: el índice único garantiza una fila, pero si algún día
  // dejara de garantizarla, `maybeSingle` contesta PGRST116 y el catch lo convierte en
  // «no está en la entrega» sin un log. `.limit(1)` explícito y el error se lee.
  const { data, error } = await db
    .from('cliente_entrega').select(COLS_CLIENTE)
    .eq('lead_id', leadId).eq('producto_id', productoId)
    .order('id', { ascending: true }).limit(1);
  if (error) {
    console.error(`[entrega-servicio] no pude leer la entrega del cliente ${leadId} / producto ${productoId}: ${error.message}`);
    return null;
  }
  return ((data ?? []) as ClienteEnEntrega[])[0] ?? null;
}

/**
 * Cuántos clientes hay en cada etapa de la entrega de un producto.
 *
 * ⚠️ LA CUENTA LA HACE `conteoDeEtapas` (módulo puro, con test) y no un `reduce` de
 * acá. La pantalla cuenta lo mismo sobre lo que ya tiene en memoria, y dos
 * implementaciones de la misma cuenta es cómo el editor de etapas termina diciendo
 * «3 en Hito 1» sobre una columna que muestra 2. Lo que esa función garantiza —y es
 * la razón de ser de las dos— es que el contador se inicializa con el UNIVERSO: sin
 * eso, una columna vacía no entra al mapa y `undefined` deja de significar «no se
 * pudo leer».
 */
export async function conteoPorEtapa(productoId: number, etapas: readonly EtapaEntrega[]): Promise<Record<string, number>> {
  const filas = await clientesEnEntrega(productoId);
  return conteoDeEtapas(etapas, filas.map((c) => c.etapa));
}
