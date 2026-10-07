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
  entregaPorDefecto, normalizarEtapas, normalizarFases, conteoDeEtapas,
  type EntregaConfig, type EtapaEntrega, type FaseEntrega,
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
  // Las FASES saben caer solas: vacío es su estado legítimo, así que una lista rota
  // deja el servicio sin tramos y con los colores propios de cada etapa — nunca sin
  // columnas. Por eso no participa del fallback de arriba.
  const fases = normalizarFases((f.data as { fases?: unknown } | null)?.fases);
  return { productoId: f.producto_id, etapas, fases, origen: 'declarado' };
}

/**
 * Las etapas de entrega de VARIOS productos, de una sola consulta.
 *
 * Devuelve una entrada por cada id pedido — los que no tienen fila salen con su
 * default. Es la forma que necesita el kanban: la barra lista todos los productos y
 * no puede quedarse sin columnas para el que nadie configuró todavía.
 */
export async function entregasDeProductos(
  ids: readonly number[],
  /**
   * `estricto` TIRA en vez de caer a los defaults. Lo pide quien decide A QUIÉN se le
   * escribe (la cohorte de una secuencia de entrega): con el catálogo caído, la «primera
   * etapa» sería la de fábrica y no la que el negocio declaró, y un cliente sin fila caería
   * en una columna que su tablero no tiene.
   */
  opts: { estricto?: boolean } = {},
): Promise<Map<number, EntregaConfig>> {
  const pedidos = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  const out = new Map<number, EntregaConfig>(pedidos.map((id) => [id, entregaPorDefecto(id)]));
  if (!pedidos.length) return out;

  // Fail-closed RUIDOSO: si la lectura falla se devuelven los defaults (el tablero se
  // dibuja) y queda dicho en el log, porque «no configuró» y «no pude leer» son dos cosas.
  // ⚠️ Esto sirve para DIBUJAR. Para DECIDIR (validar una etapa antes de escribirla) va
  // `entregaDeProductoEstricta`, que no cae al default: ver ahí por qué. Y quien decide A
  // QUIÉN se le escribe (la cohorte de una secuencia) pide `estricto`, que tira.
  const filas = await leerCatalogo(pedidos);
  if (!filas && opts.estricto) throw new Error('producto_entrega: no pude leer el catálogo');
  for (const f of filas ?? []) out.set(f.producto_id, filaAEntrega(f));
  return out;
}

/** Las filas del catálogo de esos productos, o `null` si la consulta falló (nunca `[]`). */
async function leerCatalogo(pedidos: readonly number[]): Promise<FilaCatalogo[] | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('producto_entrega').select(COLS_CATALOGO).in('producto_id', [...pedidos]);
  if (error) {
    console.error(`[entrega-servicio] no pude leer el catálogo de ${pedidos.length} producto(s): ${error.message}`);
    return null;
  }
  return (data ?? []) as FilaCatalogo[];
}

/** Las etapas de entrega de UN producto (su default si no declaró nada). */
export async function entregaDeProducto(productoId: number): Promise<EntregaConfig> {
  const m = await entregasDeProductos([productoId]);
  return m.get(productoId) ?? entregaPorDefecto(productoId);
}

/**
 * Las etapas de UN producto para DECIDIR algo con ellas. `null` = NO SE PUDIERON LEER.
 *
 * ⚠️ LA DIFERENCIA CON `entregaDeProducto` ES LO QUE PASA CUANDO LA CONSULTA FALLA. Aquélla
 * cae a las etapas DEFAULT (onboarding, arranque, hito1…), que es lo correcto para dibujar un
 * tablero y es un dato INVENTADO para validar: el choke point (lib/cs-mover-etapa.ts) daba
 * por buena «onboarding» sobre un producto que ya tenía sus nueve etapas declaradas, la
 * escribía, y el cliente quedaba en una columna que el kanban no dibuja — sin un error en
 * pantalla. Es la causa probable de la clienta huérfana del ws1 (relevo del 06/10/2026).
 *
 * Sin fila SÍ es el default, y es legítimo: un producto que nadie configuró se dibuja con
 * esas etapas, así que validar contra ellas es validar contra lo que la pantalla muestra.
 */
export async function entregaDeProductoEstricta(productoId: number): Promise<EntregaConfig | null> {
  const filas = await leerCatalogo([productoId]);
  if (!filas) return null;
  const f = filas.find((x) => Number(x.producto_id) === productoId);
  return f ? filaAEntrega(f) : entregaPorDefecto(productoId);
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
export async function guardarEtapasEntrega(
  productoId: number,
  etapas: readonly EtapaEntrega[],
  /**
   * ⚠️ SIN DEFAULT, A PROPÓSITO. Un `= []` deja que un llamador se olvide las fases y,
   * como el `data` se reemplaza entero, eso las BORRA: el color de cada columna se
   * perdería en el próximo guardado de cualquier otra cosa, sin un error y sin un log.
   * Exigirlo hace que el compilador enumere los call sites el día que aparezca el segundo.
   */
  fases: readonly FaseEntrega[],
): Promise<boolean> {
  const limpias = normalizarEtapas(etapas);
  if (!limpias) {
    console.error(`[entrega-servicio] etapas inválidas para el producto ${productoId}: no se guardó nada`);
    return false;
  }
  // ⚠️ LAS FASES SE ESCRIBEN EN EL MISMO UPSERT, no en una llamada aparte. El `data`
  // se reemplaza entero, así que guardar las etapas sin mandar las fases las BORRA —
  // y lo que se borraría es el color de cada columna, en el próximo guardado de
  // cualquier otra cosa. Es el modo de falla de los mappers de lectura, del lado de
  // la escritura.
  const tramos = normalizarFases(fases);
  const db = await getTenantDb();
  const { error } = await db.from('producto_entrega').upsert(
    { producto_id: productoId, data: { etapas: limpias, fases: tramos }, declarado: true, updated_at: new Date().toISOString() },
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
 * Cuántos clientes están HOY en la entrega de un producto. `null` = no se pudo leer.
 *
 * ⚠️ DEVUELVE `null` Y NO `0` CUANDO FALLA, y es la razón por la que existe en vez de
 * un `clientesEnEntrega(id).length`: esa función devuelve `[]` ante un error —correcto
 * para dibujar un tablero— y acá el número va adentro de la frase que alguien lee
 * ANTES de confirmar algo irreversible. Un «0 clientes» sobre una consulta caída es
 * exactamente la clase de afirmación que hace que se apriete el botón.
 *
 * Es un `count` y no una lectura: no hace falta traer las filas para contarlas.
 */
export async function cuantosEnEntrega(productoId: number): Promise<number | null> {
  const db = await getTenantDb();
  const { count, error } = await db
    .from('cliente_entrega').select('id', { count: 'exact', head: true })
    .eq('producto_id', productoId);
  if (error) {
    console.error(`[entrega-servicio] no pude contar los clientes en la entrega de ${productoId}: ${error.message}`);
    return null;
  }
  return count ?? 0;
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
