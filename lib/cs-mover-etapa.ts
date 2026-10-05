// =============================================================================
// cs-mover-etapa — EL CHOKE POINT de la entrega de un servicio
// =============================================================================
// `moverClienteDeEtapa()` es el ÚNICO camino de escritura de `cliente_entrega`
// (mig 0188). Por acá pasan el arrastre del kanban, el desplegable de la ficha, el
// alta de un cliente en una entrega y cualquier automatismo que venga después.
//
// POR QUÉ UN CHOKE POINT ACÁ Y NO EN EL CRM: en el CRM la etapa de un lead se
// DERIVA de señales (`pipelineStageOf`), así que no hay un único momento en el que
// «se mueve» — por eso allá el historial se audita por DIFF (`logLeadChanges`) y el
// comentario de lib/leads.ts dice, textual, «La ETAPA se calcula, no se diffea».
// Acá es lo contrario: la etapa de entrega es un HECHO DECLARADO — alguien dice
// «este cliente llegó a hito 2» — así que sí existe el instante del movimiento, y
// por eso se puede tener lo que el CRM no puede: un solo lugar donde engancharse.
//
// ⚠️ LO QUE VALE PARA TODOS LOS MOVIMIENTOS SE ESCRIBE ACÁ, no en cada pantalla.
// Es la regla de la casa («lo que vale para TODOS los cambios se escribe donde pasan
// todos»): el historial, el enrolamiento de secuencias y lo que venga mañana se
// cuelgan de esta función y los hereda la pantalla que todavía no existe.
//
// ─────────────────────────────────────────────────────────────────────────────
// DE ACÁ SALEN LAS SECUENCIAS DE ENTREGA, Y POR QUÉ CON UN EVENTO PROPIO
// ─────────────────────────────────────────────────────────────────────────────
// El enrolamiento está enganchado en el único `return` de éxito de abajo y SÓLO con
// `cambio === true`: un movimiento que no movió nada no puede disparar mensajes.
// Va con import dinámico y best-effort —mover un cliente tiene que funcionar aunque
// la nutrición falle— y un cron barre `cliente_entrega` como RED, no como reemplazo:
// sin esa cohorte, un enrolamiento caído dejaría al cliente sin su secuencia para
// siempre y en silencio.
//
// ⚠️ EL EVENTO ES `'entrega'` Y NO EL `'etapa'` DE VENTA, A PROPÓSITO. Las dos
// razones, que es lo que no se puede perder si alguien algún día quiere unificarlos:
//
//   1. La CLAVE puede chocar. El matcheo es por IGUALDAD DE STRING, y entre los dos
//      defaults —venta: lead, agenda, agendaj2, facturando, ganado · entrega:
//      onboarding, arranque, hito1, hito2, entregado— el choque medido el 05/10/2026
//      es CERO. Pero las dos listas las edita el cliente: el día que alguien llame
//      `facturando` a una etapa de entrega, mover un cliente en el kanban de Customer
//      Success dispararía una secuencia de VENTA. Un evento propio lo cierra por
//      construcción; un string más adentro del de etapa, no.
//   2. Acá hay un `productoId`, NO un `funnelId`. `CtxEvento.funnelId` dice «el
//      embudo del lead, o sea su PRODUCTO», y del producto al embudo hay dos saltos
//      (`producto ──oferta_productos──> oferta ──funnel_ofertas──> funnel`): pasarle
//      el id del producto como si fuera el del embudo es un número correcto sobre la
//      pregunta equivocada. Por eso el ámbito de una secuencia de entrega vive en su
//      propia columna (`nutricion_secuencias.producto_id`, mig 0189) y el filtro es
//      `secuenciasDeEntrega` (lib/nutricion-etapa.ts), no `secuenciasDeEtapa`.
//
// ⚠️ Y EL GUARD DE ESTO SON DOS, de los dos lados, porque ninguno solo alcanza:
// `tests/cs-mover-etapa.test.ts` fija que desde acá NO se llame con `'etapa'`, y
// `tests/nutricion-etapa.test.ts` fija que la llamada EXISTA, lleve `productoId` y
// `etapa`, y vaya después del upsert y del historial. «No uses el evento de venta»
// también se cumple cuando no hay ninguna llamada.
//
// ⚠️ EL DESHACER DEL KANBAN VUELVE A PASAR POR ACÁ. El toast de `/customer-success`
// revierte llamando a esta misma función con la etapa anterior —revertir sólo la
// pantalla mentiría hasta el próximo F5—, así que deshacer dispara un SEGUNDO evento
// de entrega, hacia atrás. Este módulo no puede distinguirlo de un movimiento normal
// y no debería: un flag de «esto es un deshacer» sería un dato de la interfaz metido
// adentro del modelo. Si una secuencia no tiene que salir cuando alguien se arrepiente
// a los tres segundos, eso se decide en la nutrición.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { entregaDeProducto } from './entrega-servicio';
import { campoEntrega, etapaValida, etapaDe, etapaInicial, relojDeVuelta } from './servicio-etapas';

/** Quién mueve, con el mismo vocabulario que `lead_audit.autor`. */
export const POR_PERSONA = 'CRM';
export const POR_MAKO = 'MaKo';

export type PedidoMovimiento = {
  leadId: number;
  productoId: number;
  /**
   * La CLAVE de la etapa destino. `null` = la primera columna de la entrega, que es
   * lo que quiere decir «metelo a la entrega» sin elegir dónde.
   */
  etapa?: string | null;
  /** Quién lo movió. Default: una persona desde la pantalla. */
  por?: string;
  /**
   * SÓLO PARA UN DESHACER: el `etapa_desde` que la fila tenía antes del movimiento que se
   * deshace. Sin él, volver a la etapa anterior arranca el reloj hoy (ver `relojDeVuelta`).
   * Un movimiento normal no lo manda.
   */
  relojPrevio?: string | null;
};

export type Movimiento = {
  ok: boolean;
  /** Por qué no se pudo. Se MUESTRA: un movimiento que no pasa y no dice nada se lee como que la app está rota. */
  motivo?: string;
  leadId: number;
  productoId: number;
  /** El nombre del producto, para el texto que lee una persona. */
  producto: string;
  /** La clave anterior. `null` = no estaba en esta entrega. */
  desde: string | null;
  /** La clave destino, ya validada contra el catálogo. */
  hacia: string;
  /** El rótulo de la etapa destino, para el texto que lee una persona. */
  rotulo: string;
  /** Primera vez que este cliente entra a la entrega de este producto. */
  entro: boolean;
  /** De verdad cambió de columna. `false` = ya estaba ahí y NO se escribió nada. */
  cambio: boolean;
  por: string;
};

function fallo(p: PedidoMovimiento, motivo: string, producto = ''): Movimiento {
  return {
    ok: false, motivo, leadId: p.leadId, productoId: p.productoId, producto,
    desde: null, hacia: '', rotulo: '', entro: false, cambio: false, por: p.por ?? POR_PERSONA,
  };
}

/**
 * Mueve a un cliente a una etapa de la entrega de un producto, y deja el hecho
 * registrado: quién, a qué etapa, cuándo y de qué servicio.
 *
 * Idempotente: si ya está en esa etapa devuelve `cambio: false` y **no escribe
 * nada**. No es una optimización — pisar la fila resetearía `etapa_desde`, que es el
 * reloj de «hace cuánto que no se mueve», así que un segundo click (o un reintento,
 * o dos pestañas) convertiría un cliente trabado hace tres semanas en uno que acaba
 * de llegar. Y escribiría una línea de historial de un movimiento que no ocurrió.
 */
export async function moverClienteDeEtapa(pedido: PedidoMovimiento): Promise<Movimiento> {
  const por = pedido.por ?? POR_PERSONA;
  if (!Number.isFinite(pedido.leadId) || pedido.leadId <= 0) return fallo(pedido, 'Falta el cliente.');
  if (!Number.isFinite(pedido.productoId) || pedido.productoId <= 0) return fallo(pedido, 'Falta el servicio.');

  const db = await getTenantDb();

  // ── 1. El producto existe y es de este workspace ───────────────────────────
  // El `.eq` lo pone el proxy de inquilino; sin este paso, un productoId de otro
  // cliente fallaría recién en la FK, con un mensaje de Postgres en la pantalla.
  const { data: prods, error: errProd } = await db
    .from('productos').select('id, nombre').eq('id', pedido.productoId).limit(1);
  if (errProd) {
    console.error(`[cs-mover-etapa] no pude leer el producto ${pedido.productoId}: ${errProd.message}`);
    return fallo(pedido, 'No pude leer el servicio.');
  }
  const prod = ((prods ?? []) as Array<{ id: number; nombre: string }>)[0];
  if (!prod) return fallo(pedido, 'Ese servicio no existe.');

  // ── 2. La etapa destino es una COLUMNA de este producto ────────────────────
  // ⚠️ Esto es lo que el guard protege: una clave que no está en el catálogo deja al
  // cliente en una columna que el kanban no dibuja. No es un error visible — es un
  // cliente que desaparece del tablero y sigue contando en la base.
  const entrega = await entregaDeProducto(pedido.productoId);
  const hacia = (pedido.etapa ?? '').trim() || etapaInicial(entrega.etapas) || '';
  if (!etapaValida(entrega.etapas, hacia)) {
    return fallo(pedido, `«${hacia || '—'}» no es una etapa de la entrega de ${prod.nombre}.`, prod.nombre);
  }
  const rotulo = etapaDe(entrega.etapas, hacia)?.label ?? hacia;

  // ── 3. Dónde estaba ────────────────────────────────────────────────────────
  const { data: previas, error: errPrev } = await db
    .from('cliente_entrega').select('id, etapa')
    .eq('lead_id', pedido.leadId).eq('producto_id', pedido.productoId)
    .order('id', { ascending: true }).limit(1);
  if (errPrev) {
    console.error(`[cs-mover-etapa] no pude leer la entrega previa del cliente ${pedido.leadId}: ${errPrev.message}`);
    // Fail-closed: sin saber de dónde viene no se puede escribir el historial, y una
    // línea «— → Hito 2» sobre un cliente que venía de Hito 1 es un dato falso.
    return fallo(pedido, 'No pude leer en qué etapa estaba.', prod.nombre);
  }
  const previa = ((previas ?? []) as Array<{ id: number; etapa: string }>)[0] ?? null;
  const desde = previa?.etapa ?? null;
  const entro = !previa;

  const base: Movimiento = {
    ok: true, leadId: pedido.leadId, productoId: pedido.productoId, producto: prod.nombre,
    desde, hacia, rotulo, entro, cambio: false, por,
  };

  if (desde === hacia) return base;   // ya estaba ahí: no se escribe NADA

  // ── 4. Si ENTRA a la entrega, el cliente tiene que existir ─────────────────
  // Sólo al entrar: entre columnas la fila ya prueba que el lead existe, y cobrarle
  // una consulta a cada arrastre del kanban por un hecho que no cambió es caro al
  // vicio. «Un cliente es un lead ganado» (app/customer-success/BarraClientes.tsx),
  // pero el estado NO se exige: la entrega puede arrancar antes de que alguien marque
  // el cierre, y bloquear por eso dejaría a quien ya pagó afuera de su propio
  // onboarding. Lo que se exige es que el lead exista.
  if (entro) {
    const { data: leads, error: errLead } = await db
      .from('leads').select('id').eq('id', pedido.leadId).limit(1);
    if (errLead) {
      console.error(`[cs-mover-etapa] no pude leer el cliente ${pedido.leadId}: ${errLead.message}`);
      return fallo(pedido, 'No pude leer el cliente.', prod.nombre);
    }
    if (!((leads ?? []) as Array<{ id: number }>)[0]) return fallo(pedido, 'Ese cliente no existe.', prod.nombre);
  }

  // ── 5. Se fija la COLUMNA, y recién después se escribe la línea ─────────────
  // Este orden es el de lib/etapa-historial.ts y por la misma razón: si algo falla en
  // el medio, el peor caso es perder una línea del historial — nunca mover al cliente
  // dos veces ni dejar una línea de un movimiento que no ocurrió.
  const ahora = new Date().toISOString();
  const { error: errUp } = await db.from('cliente_entrega').upsert(
    {
      lead_id: pedido.leadId, producto_id: pedido.productoId,
      etapa: hacia, etapa_desde: relojDeVuelta(pedido.relojPrevio) ?? ahora, por, updated_at: ahora,
    },
    { onConflict: 'workspace_id,lead_id,producto_id' },
  );
  if (errUp) {
    console.error(`[cs-mover-etapa] no pude mover el cliente ${pedido.leadId} a ${hacia}: ${errUp.message}`);
    return fallo(pedido, 'No pude guardar el movimiento.', prod.nombre);
  }

  // El historial no rompe el movimiento: ya está guardado. Mismo criterio que
  // `logLeadChanges`, y queda el log por si la línea no sale.
  const { error: errAudit } = await db.from('lead_audit').insert([{
    lead_id: pedido.leadId,
    campo: campoEntrega(prod.nombre),
    valor_anterior: desde ? (etapaDe(entrega.etapas, desde)?.label ?? desde) : null,
    valor_nuevo: rotulo,
    autor: por,
  }]);
  if (errAudit) console.error(`[cs-mover-etapa] el movimiento se guardó pero la línea de historial falló: ${errAudit.message}`);

  /**
   * LAS SECUENCIAS DE LA ENTREGA, enganchadas donde pide la cabecera: en el único
   * `return` de éxito y sólo con `cambio: true` — un movimiento que no movió nada no
   * puede disparar mensajes.
   *
   * Con el evento PROPIO (`'entrega'` → trigger `entrega_actual`) y con el PRODUCTO,
   * que son las dos cosas que esta sesión midió antes de que existiera el código: la
   * clave de una etapa de entrega puede chocar con una de venta el día que el cliente
   * las renombre, y del producto al embudo hay dos saltos. El filtro vive en
   * `secuenciasDeEntrega` (lib/nutricion-etapa.ts), puro y con test.
   *
   * Import dinámico y best-effort, por lo mismo que en `setBoardStageOverride`: mover un
   * cliente tiene que funcionar aunque la nutrición falle, y el cron barre
   * `cliente_entrega` como red si este enrolamiento se cayó.
   */
  try {
    const { enrolarPorEvento } = await import('./nutricion');
    // `desde` viaja para que el motor pueda CERRAR lo que la etapa anterior tenía
    // agendado: un mensaje de «onboarding» que sale cuando el cliente ya está en el
    // hito 2 habla de un momento que terminó. Y es lo que hace inofensivo al
    // «Deshacer» del toast, que llega acá como un movimiento de vuelta.
    await enrolarPorEvento(pedido.leadId, 'entrega', { etapa: hacia, productoId: pedido.productoId, desde });
  } catch (e) {
    console.error(`[cs-mover-etapa] el cliente ${pedido.leadId} se movió a «${hacia}» pero no pude enrolarlo:`, e instanceof Error ? e.message : String(e));
  }

  return { ...base, cambio: true };
}

/**
 * Saca a un cliente de la entrega de un producto.
 *
 * Devuelve la fila que sacó para que quien llama pueda OFRECER UN DESHACER que
 * reponga la MISMA etapa: volver a llamar a `moverClienteDeEtapa` sin ese dato lo
 * repondría en la primera columna, o sea que deshacer perdería el avance.
 *
 * ⚠️ Y DEJA RASTRO, igual que el movimiento. Borrar la fila y no escribir nada hace
 * indistinguibles dos cosas que no se parecen: «nunca estuvo en esta entrega» y «lo
 * sacamos». La primera es un hueco por llenar y la segunda una decisión, y seis meses
 * después nadie puede saber cuál fue — es la regla de la casa: una política puede
 * rechazar, no puede no dejar rastro.
 */
export async function sacarClienteDeEntrega(leadId: number, productoId: number): Promise<{ ok: boolean; etapa: string | null; motivo?: string }> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('cliente_entrega').delete().eq('lead_id', leadId).eq('producto_id', productoId).select('etapa');
  if (error) {
    console.error(`[cs-mover-etapa] no pude sacar al cliente ${leadId} de la entrega ${productoId}: ${error.message}`);
    return { ok: false, etapa: null, motivo: 'No pude sacarlo de la entrega.' };
  }
  const etapa = ((data ?? []) as Array<{ etapa: string }>)[0]?.etapa ?? null;

  // Sin fila borrada no pasó nada, así que no hay nada que registrar: una línea de
  // historial sobre un cliente que no estaba en la entrega es un hecho inventado.
  if (etapa) {
    // El nombre del producto y el rótulo de la etapa se leen DESPUÉS de borrar, a
    // propósito: lo que no se puede perder es el borrado, y el rastro no puede
    // frenarlo. Si alguna de las dos lecturas falla, la línea sale con la CLAVE —
    // menos legible, pero el hecho queda.
    try {
      const { data: prods } = await db.from('productos').select('nombre').eq('id', productoId).limit(1);
      const nombre = ((prods ?? []) as Array<{ nombre: string }>)[0]?.nombre ?? '';
      const entrega = await entregaDeProducto(productoId);
      const { error: errAudit } = await db.from('lead_audit').insert([{
        lead_id: leadId,
        campo: campoEntrega(nombre),
        valor_anterior: etapaDe(entrega.etapas, etapa)?.label ?? etapa,
        // ⚠️ `null` y no «Sin etapa»: es el mismo vacío con el que la ficha dibuja un
        // «—», y el texto de la pantalla no se inventa acá adentro.
        valor_nuevo: null,
        autor: POR_PERSONA,
      }]);
      if (errAudit) console.error(`[cs-mover-etapa] salió de la entrega pero la línea de historial falló: ${errAudit.message}`);
    } catch (e) {
      console.error('[cs-mover-etapa] salió de la entrega pero no pude escribir el historial:', e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * Y lo que esa etapa tenía AGENDADO se cierra, por la misma razón que al moverse de
   * columna: un mensaje de «¿cómo venís con el onboarding?» que sale cuando el cliente
   * ya no está en la entrega habla de algo que no existe. Acá no se enrola nada —salir
   * no es llegar a ninguna etapa— así que es sólo el cierre.
   */
  if (etapa) {
    try {
      const { cerrarEntregaDeEtapa } = await import('./nutricion');
      await cerrarEntregaDeEtapa(leadId, etapa, productoId);
    } catch (e) {
      console.error('[cs-mover-etapa] salió de la entrega pero no pude cerrar sus secuencias:', e instanceof Error ? e.message : String(e));
    }
  }

  return { ok: true, etapa };
}
