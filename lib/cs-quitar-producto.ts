import 'server-only';

// =============================================================================
// cs-quitar-producto — sacar a un cliente de UN producto, y devolverlo
// =============================================================================
// «Quitar de este producto» de la ficha de Customer Success (06/10/2026: «solo para los leads que
// estén en más de 1 producto») y su deshacer. Vivían adentro de las server actions
// (app/customer-success/actions.ts) y se mudaron acá el 23/10/2026 para que los use también la API de
// MaKo (P0-5 de la auditoría de la API): un runner no llama server actions, y una segunda copia de la
// regla es la que se queda vieja. Las actions siguen haciendo lo suyo —la puerta, que el lead sea un
// cliente de este negocio, el `revalidatePath`— y delegan acá.
//
// Dos caminos según CÓMO es de ese producto (app/customer-success/pertenencia.ts):
//   · por una FILA de entrega → se borra la fila (`sacarClienteDeEntrega`, con su historial);
//   · porque es su CASA (el embudo del CRM) → la casa se deriva y no hay nada que borrar, así que se
//     escribe en `cliente_entrega_fuera` (mig 0196). Si además tenía fila, se borra.
//
// ⚠️ SE VUELVE A CONTAR con la misma regla que la pantalla (`productosDelCliente`): con uno solo,
// sacarlo lo dejaría en ningún tablero — que es lo que el pedido excluye. Esconder el botón no protege
// nada, y por la API no hay botón.
// =============================================================================

import { getTenantDb } from './workspace';
import { moverClienteDeEtapa, sacarClienteDeEntrega } from './cs-mover-etapa';
import { entregaDeProducto } from './entrega-servicio';
import { campoEntrega } from './servicio-etapas';
import { productosDelCliente } from '@/app/customer-success/entrega';

/**
 * Lo que se sacó, para DESHACER: la etapa y el reloj de la fila que había, y si era su casa. Deshacer
 * sin el reloj volvería a arrancarlo hoy (ver `relojDeVuelta`).
 */
export type QuitadoDeProducto = { ok: true; eraCasa: boolean; etapa: string | null; reloj: string | null } | { ok: false; error: string };

/** Saca al cliente de ESE producto. Quien llama ya comprobó que es un cliente de este negocio. `por` firma el historial. */
export async function quitarClienteDeProducto(leadId: number, productoId: number, por: string): Promise<QuitadoDeProducto> {
  const { productos, casa } = await productosDelCliente(leadId);
  if (!productos.includes(productoId)) return { ok: false, error: 'No está en ese producto.' };
  if (productos.length < 2) return { ok: false, error: 'Es su único producto.' };

  const db = await getTenantDb();
  const { data: fila, error: errFila } = await db.from('cliente_entrega')
    .select('etapa, etapa_desde').eq('lead_id', leadId).eq('producto_id', productoId).maybeSingle();
  if (errFila) return { ok: false, error: errFila.message };
  const previa = fila as { etapa: string; etapa_desde: string } | null;
  const eraCasa = casa === productoId;

  if (eraCasa) {
    const { error } = await db.from('cliente_entrega_fuera')
      .upsert([{ lead_id: leadId, producto_id: productoId, por }],
        { onConflict: 'workspace_id,lead_id,producto_id', ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
  }
  if (previa) {
    // El borrado de la fila deja SU línea de historial y cierra lo que esa etapa tenía
    // agendado: es el mismo camino que el deshacer del primer movimiento.
    const r = await sacarClienteDeEntrega(leadId, productoId, por);
    if (!r.ok) return { ok: false, error: r.motivo ?? 'No se pudo quitar.' };
  } else {
    // Sin fila no hay nada que el choke point registre, y salir de un producto es un hecho:
    // la línea se escribe acá, con la etapa en la que estaba por regla (la primera).
    await historialDeProducto(leadId, productoId, 'salio', por);
  }
  return { ok: true, eraCasa, etapa: previa?.etapa ?? null, reloj: previa?.etapa_desde ?? null };
}

/**
 * El DESHACER de «Quitar de este producto»: lo devuelve como estaba. Si era su casa se borra la marca de
 * «fuera»; si tenía fila, se repone con su etapa y SU reloj (`reloj` null = el reloj arranca hoy).
 */
export async function volverClienteAProducto(
  leadId: number, productoId: number, etapa: string | null, reloj: string | null, por: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const { error } = await db.from('cliente_entrega_fuera').delete().eq('lead_id', leadId).eq('producto_id', productoId);
  if (error) return { ok: false, error: error.message };
  if (etapa) {
    const m = await moverClienteDeEtapa({ leadId, productoId, etapa, relojPrevio: reloj, por });
    if (!m.ok) return { ok: false, error: m.motivo ?? 'No se pudo devolver.' };
  } else {
    await historialDeProducto(leadId, productoId, 'volvio', por);
  }
  return { ok: true };
}

/**
 * La línea de historial de entrar o salir de un producto que era su CASA y no tenía fila:
 * el único caso que el choke point no registra, porque no hay fila que mover ni borrar.
 * Mismo formato que el resto («Entrega: <producto>», la etapa de un lado y `null` del otro).
 * No tira: el rastro no puede frenar lo que ya se hizo.
 */
async function historialDeProducto(leadId: number, productoId: number, que: 'salio' | 'volvio', por: string): Promise<void> {
  try {
    const db = await getTenantDb();
    const { data: prods } = await db.from('productos').select('nombre').eq('id', productoId).limit(1);
    const nombre = ((prods ?? []) as Array<{ nombre: string }>)[0]?.nombre ?? '';
    const primera = (await entregaDeProducto(productoId)).etapas[0]?.label ?? null;
    const { error } = await db.from('lead_audit').insert([{
      lead_id: leadId, campo: campoEntrega(nombre),
      valor_anterior: que === 'salio' ? primera : null,
      valor_nuevo: que === 'salio' ? null : primera,
      autor: por,
    }]);
    if (error) console.error(`[cs] no pude registrar en el historial la ${que === 'salio' ? 'salida' : 'vuelta'} del cliente ${leadId}: ${error.message}`);
  } catch (e) {
    console.error('[cs] no pude escribir el historial del producto:', e instanceof Error ? e.message : String(e));
  }
}
