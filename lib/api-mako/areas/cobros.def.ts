// =============================================================================
// api-mako/areas/cobros.def — las operaciones del área `cobros` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// cobros.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// La pasarela de pagos (pedido de Martín del 11/10/2026; el contrato entero está en
// docs/diseno-pasarela-pagos.md): un COBRO es UN pago que el negocio le pide a UN lead
// con Stripe o Mercado Pago, con las claves del propio negocio. Vive en la tabla `cobros`
// y lo escribe sólo lib/cobros.ts.
//
// ⚠️ UN COBRO NO ES UNA CUOTA. Las cuotas del CRM son la tabla `pagos` (cobranza_lead,
// marcar_pago_cobrado, área crm) y su id es `pagoId`. El de un cobro es `cobroId`: dos
// nombres distintos para que un modelo no cruce los ids, y para que el paso «⚡ Acción»
// no rotule «Cuota» lo que es un cobro.
//
// Las decisiones de esta área (11/10/2026):
//   · Las LECTURAS leen nuestra tabla (la alimentan los webhooks): gratis, rápidas y andan
//     aunque la pasarela esté caída. Nunca devuelven el link ni la URL del proveedor: un
//     link que lee un modelo lo escribe el código (AGENTS.md), y el checkout abre el
//     recibo con datos del cliente.
//   · crear_link_pago va por CHAT y con precio SÓLO del catálogo: es UNA entidad ya
//     identificada (el lead y el producto, por id) y el monto no pasa por el modelo. Un
//     monto libre es un dato exacto que un modelo puede transcribir mal: vive en la ficha.
//     Cuesta `externo` (no `dinero`): crear un link no mueve plata, y así un token
//     detallado lo crea en el acto y un flujo lo puede usar.
//   · reembolsar_cobro y cancelar_suscripcion mueven plata del cliente: pantalla, `dinero`
//     y sólo el admin. El reembolso es TOTAL, sin campo de monto: la pantalla genérica no
//     sigue un monto editado (docs/hallazgos-api-mako.md, las trampas de /mako/revisar).
//   · Los ids van SIN el prefijo `proponer_`: RECETA_ACCIONES (lib/doer-recetas.ts) se
//     dispara con él y pide un «sí», que en una de pantalla es lo que NO hay que pedir.
// =============================================================================

import type { Gating, OperacionDef, Parametro } from '../tipos';
// Puros y sin server-only (lib/cobros-tipos.ts lo dice en su cabecera): el enum sale de la
// misma lista que la base, no de una copia escrita a mano.
import { ESTADOS_COBRO, PASARELAS } from '../../cobros-tipos';

const TODOS = ['whatsapp', 'app', 'http'] as const;

const G_TAB: Gating = { tab: 'crm' };
/** Lo que mueve plata del cliente: sólo el admin del negocio (el test lo exige con `dinero`). */
const G_ADMIN: Gating = { tab: 'crm', rolMinimo: 'admin' };

const leadId = (desc: string, obligatorio = true): Parametro =>
  ({ nombre: 'leadId', rotulo: 'Lead', tipo: 'number', descripcion: desc, entero: true, minimo: 1, ...(obligatorio ? { obligatorio: true } : {}) });

const cobroId = (desc = 'id del cobro en MaKo (de listar_cobros o ver_cobro). No es el id de Stripe ni el de Mercado Pago, ni el pagoId de una cuota del CRM.'): Parametro =>
  ({ nombre: 'cobroId', rotulo: 'Cobro', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: desc });

export const DEFS: readonly OperacionDef[] = [
  {
    id: 'listar_cobros', area: 'cobros', tipo: 'lectura',
    titulo: 'Cobros de Stripe y Mercado Pago',
    descripcion: 'Los cobros que el negocio pidió por Stripe o Mercado Pago (links de pago y suscripciones), más recientes primero: id, lead, concepto, monto y moneda, estado (pendiente, pagado, rechazado, reembolsado, anulado), pasarela, si es de prueba, fechas y qué acciones admite cada uno. Con leadId, sólo los de ese lead. NO trae el link de pago ni datos de tarjeta. No son las cuotas del CRM (eso es cobranza_lead).',
    parametros: [
      leadId('filtra por lead (de buscar_leads).', false),
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', enum: ESTADOS_COBRO, descripcion: 'filtra por estado. «fallido» es un pago rechazado.' },
      { nombre: 'limite', rotulo: 'Cuántos', tipo: 'number', entero: true, minimo: 1, maximo: 100, descripcion: 'cuántos devolver (default 30).' },
    ],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'ver_cobro', area: 'cobros', tipo: 'lectura',
    titulo: 'Detalle de un cobro',
    descripcion: 'UN cobro de Stripe o Mercado Pago por su id: lead, producto, concepto, monto, moneda y su valor en dólares, estado, pasarela, si es una suscripción y si sigue activa, fechas de pago y de reembolso, el motivo si algo falló, y qué se puede hacer con él (anular el link, reembolsar, cancelar la suscripción). NO trae el link de pago.',
    parametros: [cobroId()],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'crear_link_pago', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Crear un link de pago',
    descripcion: 'PROPONE crear un link de pago de Stripe o Mercado Pago, con la cuenta del negocio, para que UN lead pague un producto del catálogo de ofertas. El precio sale del catálogo (listar_productos), nunca se escribe a mano: un monto libre se carga desde la ficha del lead. Pide antes el leadId (buscar_leads) y el productoId (listar_productos). Al confirmar, el link le llega a la persona por aparte y queda en la ficha del lead: NO lo escribas ni lo copies. Si el lead ya tiene un link pendiente de ese producto, no crea otro.',
    escribe: 'crea el cobro en `cobros` y su checkout (Stripe) o su preferencia (Mercado Pago) con la cuenta del negocio, y deja historial en el lead',
    parametros: [
      leadId('id del lead que va a pagar (de buscar_leads).'),
      { nombre: 'productoId', rotulo: 'Producto del catálogo', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del producto del catálogo de ofertas (de listar_productos), con su precio. NO es el embudoId del CRM.' },
      { nombre: 'pasarela', rotulo: 'Pasarela', tipo: 'string', enum: PASARELAS, descripcion: 'stripe o mercadopago. Sin valor: la única conectada, o Stripe si están las dos (el precio del catálogo está en dólares).' },
    ],
    canales: TODOS, costo: 'externo', gating: G_TAB,
  },
  {
    id: 'anular_link_pago', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Anular un link de pago',
    descripcion: 'PROPONE anular un link de pago que todavía no se pagó: deja de poder pagarse desde MaKo (en Stripe además vence el checkout). Pide antes el cobroId (listar_cobros). Un cobro pagado no se anula: se reembolsa con reembolsar_cobro.',
    escribe: 'marca el cobro anulado en `cobros`, vence el checkout de Stripe y deja historial en el lead',
    parametros: [cobroId()],
    // Pega a Stripe (vence la sesión del checkout): `externo`, no `gratis`.
    canales: TODOS, costo: 'externo', gating: G_TAB,
  },
  {
    id: 'reembolsar_cobro', area: 'cobros', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Reembolsar un cobro',
    descripcion: 'PROPONE devolverle a un cliente un cobro pagado por Stripe o Mercado Pago, ENTERO, con la cuenta del negocio. Mueve dinero real y no se puede deshacer: se confirma en una pantalla, nunca por el chat. Pide antes el cobroId (listar_cobros). En una suscripción devuelve el primer pago y no la cancela (para eso, cancelar_suscripcion). Un cobro ya reembolsado se rechaza.',
    escribe: 'pide el reembolso total a Stripe o Mercado Pago con la cuenta del negocio, marca el cobro reembolsado, desmarca la cuota del CRM y deja historial en el lead',
    parametros: [
      cobroId(),
      { nombre: 'motivo', rotulo: 'Motivo', tipo: 'string', max: 300, descripcion: 'por qué se devuelve (va al historial del lead).' },
    ],
    canales: TODOS, costo: 'dinero', gating: G_ADMIN,
  },
  {
    id: 'cancelar_suscripcion', area: 'cobros', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Cancelar una suscripción',
    descripcion: 'PROPONE cancelar una suscripción de Stripe o Mercado Pago: deja de cobrarle al cliente en el acto y el CRM la cuenta hasta hoy. Se confirma en una pantalla, nunca por el chat, y no se puede deshacer. Pide antes el cobroId de la suscripción (listar_cobros). Una suscripción que nadie pagó todavía no se cancela: se anula su link con anular_link_pago.',
    escribe: 'cancela la suscripción en Stripe o Mercado Pago con la cuenta del negocio, la marca cancelada en `cobros`, cierra la suscripción del lead y deja historial',
    parametros: [cobroId('id del cobro de la suscripción en MaKo (de listar_cobros). No es el id de la suscripción en Stripe ni en Mercado Pago.')],
    canales: TODOS, costo: 'dinero', gating: G_ADMIN,
  },
];
