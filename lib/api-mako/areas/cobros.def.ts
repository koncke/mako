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
// Puro (lib/pagos-campo.ts no tiene server-only): los datos del deal salen del mismo catálogo que la escritura.
import { CAMPOS_DEAL, CAMPOS_LEAD_DEAL, SECCIONES_DEAL } from '../../pagos-campo';

const TODOS = ['whatsapp', 'app', 'http'] as const;

const G_TAB: Gating = { tab: 'crm' };
/** Lo que mueve plata del cliente: sólo el admin del negocio (el test lo exige con `dinero`). */
const G_ADMIN: Gating = { tab: 'crm', rolMinimo: 'admin' };

const leadId = (desc: string, obligatorio = true): Parametro =>
  ({ nombre: 'leadId', rotulo: 'Lead', tipo: 'number', descripcion: desc, entero: true, minimo: 1, ...(obligatorio ? { obligatorio: true } : {}) });

const cobroId = (desc = 'id del cobro en MaKo (de listar_cobros o ver_cobro). No es el id de Stripe ni el de Mercado Pago, ni el pagoId de una cuota del CRM.'): Parametro =>
  ({ nombre: 'cobroId', rotulo: 'Cobro', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: desc });

/** El id de UNA cuota del CRM (fila de `pagos`): el pago_id de cobranza_lead. Acá se llama cuotaId a propósito. */
const cuotaId = (): Parametro =>
  ({ nombre: 'cuotaId', rotulo: 'Cuota', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id de la cuota del CRM: el pago_id de cobranza_lead. No es un cobroId.' });

const fechaIso = (nombre: string, rotulo: string, desc: string): Parametro =>
  ({ nombre, rotulo, tipo: 'string', max: 10, descripcion: desc });

/** Todos los datos que edita editar_dato_deal (la sección dice cuál vale), sin repetir. */
const CAMPOS_DE_DEAL: readonly string[] = [
  ...new Set([...SECCIONES_DEAL.flatMap((s) => Object.keys(CAMPOS_DEAL[s])), ...Object.keys(CAMPOS_LEAD_DEAL)]),
];

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
    descripcion: 'PROPONE anular un link de pago que todavía no se pagó: deja de poder pagarse desde MaKo, y se cierra también en Stripe o Mercado Pago. Pide antes el cobroId (listar_cobros). Un cobro pagado no se anula: se reembolsa con reembolsar_cobro.',
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

  // ── Pagos CAMPO POR CAMPO (14/10/2026, docs/diseno-ficha-bloques.md §3 Pagos) ──────────────────────
  // Lo mismo que escriben los bloques de la tab Pagos (app/crm/[id]/pagos-campo-actions.ts), por la MISMA
  // escritura (lib/pagos.ts): un dato del deal con merge, un renglón de las obligaciones, un dato de la venta con
  // compare-and-set sobre el tipo, una cuota por su id, el link de UNA cuota, cortar su recordatorio, el estado de
  // una suscripción manual y la moneda del negocio. Todo por chat: es UNA entidad ya identificada y el resumen
  // dice el valor exacto antes del «sí». El id de una cuota acá se llama `cuotaId` (es el pago_id de
  // cobranza_lead): en esta área `pagoId` no se usa, para que un modelo no lo cruce con un cobroId.
  // Armar el plan uniforme ya existe (guardar_plan_pagos, área crm, en pantalla) y desde el 14/10 reconcilia
  // por id: no se duplica acá.
  {
    id: 'ver_moneda_negocio', area: 'cobros', tipo: 'lectura',
    titulo: 'Moneda del negocio',
    descripcion: 'La moneda en que el negocio carga lo que cobra a mano (pagos registrados en la ficha o por registrar_pago_suelto): código ISO de 3 letras. Sin configurar es USD. No es la moneda de Stripe ni la de Mercado Pago, que la define cada cuenta. Los totales del CRM siguen en dólares.',
    parametros: [],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'cambiar_moneda_negocio', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar la moneda del negocio',
    descripcion: 'PROPONE cambiar la moneda en que el negocio carga lo que cobra a mano (el valor inicial al registrar un pago). Sólo el administrador. No cambia nada de lo ya cobrado ni la moneda de Stripe o Mercado Pago.',
    escribe: 'guarda la moneda del negocio en su configuración (app_settings)',
    parametros: [
      { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', obligatorio: true, max: 3, descripcion: 'código ISO de 3 letras: USD, MXN, ARS, COP, CLP, EUR…' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  {
    id: 'editar_dato_deal', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Editar un dato del deal',
    descripcion: 'PROPONE cambiar UN dato del trato de un lead: los datos fiscales (razón social, identificación fiscal, domicilio, correo de facturación), el servicio vendido (qué es, inicio, término, duración, frecuencia, modalidad, sesiones), la promesa (resultado y garantía), el inicio del servicio cargado a mano o quién factura (facturado_por_id, una identidad fiscal del negocio). Sólo cambia ese dato: los demás y el documento fiscal subido quedan. valor vacío lo borra. Para las obligaciones usa editar_obligacion_deal; para el monto, el tipo o la fecha de cierre, editar_venta_lead.',
    escribe: 'cambia ese campo del deal en el lead (merge del jsonb, o la columna) y deja el antes y el después en el historial',
    parametros: [
      leadId('id del lead (de buscar_leads).'),
      { nombre: 'seccion', rotulo: 'Sección', tipo: 'string', obligatorio: true, enum: [...SECCIONES_DEAL, 'lead'], descripcion: 'fiscal, servicio, promesa, o lead para fecha_inicio_servicio y facturado_por_id.' },
      { nombre: 'campo', rotulo: 'Dato', tipo: 'string', obligatorio: true, enum: CAMPOS_DE_DEAL, descripcion: 'el dato de esa sección: fiscal → razon, id_fiscal, domicilio, correo; servicio → que_es, fecha_inicio, fecha_termino, duracion, frecuencia, modalidad, sesiones; promesa → resultado, garantia; lead → fecha_inicio_servicio, facturado_por_id.' },
      { nombre: 'valor', rotulo: 'Valor', tipo: 'string', max: 2000, descripcion: 'el valor nuevo. Las fechas en AAAA-MM-DD; facturado_por_id es el id de la identidad fiscal. Vacío lo borra.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'editar_obligacion_deal', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Editar una obligación del deal',
    descripcion: 'PROPONE agregar, editar o quitar UN renglón de las obligaciones del trato de un lead: lo que tiene que hacer el cliente o lo que tiene que hacer el prestador. Los demás renglones quedan. Pide renglon (empezando en 1) para editar o quitar; si la lista cambió antes del «sí», no se escribe.',
    escribe: 'cambia ese renglón de deal_obligaciones del lead y deja el antes y el después en el historial',
    parametros: [
      leadId('id del lead (de buscar_leads).'),
      { nombre: 'parte', rotulo: 'De quién', tipo: 'string', obligatorio: true, enum: ['cliente', 'prestador'], descripcion: 'cliente (lo que tiene que hacer el cliente) o prestador (lo que tiene que hacer el negocio).' },
      { nombre: 'accion', rotulo: 'Acción', tipo: 'string', obligatorio: true, enum: ['agregar', 'editar', 'quitar'], descripcion: 'agregar un renglón al final, editar uno o quitar uno.' },
      { nombre: 'renglon', rotulo: 'Renglón', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'el número del renglón a editar o quitar, empezando en 1.' },
      { nombre: 'texto', rotulo: 'Texto', tipo: 'string', max: 500, descripcion: 'el texto del renglón (para agregar o editar).' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'editar_venta_lead', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Editar la venta de un lead',
    descripcion: 'PROPONE cambiar la venta de un lead: el tipo (unico = pago único, suscripcion, sin_cobro = becado), el monto en USD (en una suscripción es la mensualidad), el plazo de una suscripción en meses (vacío = mes a mes) o la fecha de cierre. Pasar a suscripción deja la mensualidad por cargar; pasar a becado no se puede si ya hay cuotas cobradas; tipo=unico sobre un becado lo saca de «Sin cobro». No gana ni mueve el lead de etapa. Si el tipo cambió antes del «sí», no se escribe.',
    escribe: 'cambia venta_tipo, monto_cierre_usd o suscripcion_monto_usd, suscripcion_meses o fecha_cierre del lead (compare-and-set sobre el tipo) y deja el antes y el después en el historial',
    parametros: [
      leadId('id del lead (de buscar_leads).'),
      { nombre: 'tipo', rotulo: 'Tipo de venta', tipo: 'string', enum: ['unico', 'suscripcion', 'sin_cobro'], descripcion: 'unico (pago único), suscripcion o sin_cobro (becado o bonificado).' },
      { nombre: 'montoUsd', rotulo: 'Monto (USD)', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'el monto de cierre en USD; en una suscripción, la mensualidad.' },
      { nombre: 'plazoMeses', rotulo: 'Plazo (meses)', tipo: 'number', entero: true, minimo: 1, maximo: 120, descripcion: 'sólo una suscripción: cuántos meses dura. Sin valor queda como estaba.' },
      fechaIso('fechaCierre', 'Fecha de cierre', 'AAAA-MM-DD de la fecha de cierre.'),
    ],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'editar_cuota', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Editar una cuota del plan',
    descripcion: 'PROPONE cambiar el monto en USD o el vencimiento de UNA cuota sin cobrar de un lead, por su id (el pago_id de cobranza_lead). No borra ni recrea la cuota: su link de pago y sus recordatorios siguen apuntando a ella. No se puede: una cuota cobrada (se corrige desmarcándola con marcar_pago_cobrado); el monto de una cuota con un link sin pagar (anula el link primero); nada de una cuota con un recordatorio de cobro en curso (córtalo con cortar_recordatorio_cuota).',
    escribe: 'cambia monto_usd o fecha_esperada de esa fila de pagos y deja el antes y el después en el historial',
    parametros: [
      leadId('id del lead dueño de la cuota.'),
      cuotaId(),
      { nombre: 'montoUsd', rotulo: 'Monto (USD)', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'el monto nuevo de la cuota, en USD.' },
      fechaIso('vence', 'Vencimiento', 'AAAA-MM-DD del vencimiento nuevo.'),
    ],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'crear_link_cuota', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cobrar una cuota con un link',
    descripcion: 'PROPONE crear un link de pago de Stripe, con la cuenta del negocio, que cobra UNA cuota sin cobrar de un lead por su monto exacto en USD (el pago_id de cobranza_lead). Al pagarse, la cuota queda cobrada y se cortan sus recordatorios. Si la cuota ya tiene un link sin pagar, devuelve ése. Mercado Pago cobra en la moneda de su cuenta: ese link se crea desde la ficha del lead. El link le llega a la persona por aparte: NO lo escribas ni lo copies.',
    escribe: 'crea el cobro en `cobros` atado a la cuota y su checkout de Stripe con la cuenta del negocio, y deja historial en el lead',
    parametros: [
      leadId('id del lead dueño de la cuota.'),
      cuotaId(),
      { nombre: 'pasarela', rotulo: 'Pasarela', tipo: 'string', enum: PASARELAS, descripcion: 'stripe (la cuota está en dólares). Sin valor, Stripe.' },
    ],
    canales: TODOS, costo: 'externo', gating: G_TAB,
  },
  {
    id: 'cortar_recordatorio_cuota', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Cortar el recordatorio de una cuota',
    descripcion: 'PROPONE cortar los recordatorios de cobro que están corriendo para UNA cuota de un lead (el pago_id de cobranza_lead): MaKo deja de recordársela. Es lo mismo que pasa solo al marcarla cobrada. No se deshace: un recordatorio cortado no se reabre. Úsala cuando digan «no le recuerdes más la cuota 3» o antes de editar una cuota con un recordatorio en curso.',
    escribe: 'cierra como cortadas las corridas de cobranza pendientes de esa cuota (flujo_corridas) y deja historial en el lead',
    parametros: [leadId('id del lead dueño de la cuota.'), cuotaId()],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'estado_suscripcion_manual', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cancelar o reactivar una suscripción manual',
    descripcion: 'PROPONE cancelar o reactivar la suscripción de un lead que se registra a mano (la que NO cobra Stripe ni Mercado Pago). Cancelarla la cuenta hasta hoy: deja de sumar al MRR y la ficha la dice cancelada. Sólo el administrador. Una suscripción que cobra la pasarela se cancela con cancelar_suscripcion (deja de cobrarle la tarjeta).',
    escribe: 'marca suscripcion_cancelada_at y ajusta suscripcion_meses del lead (o los devuelve al reactivar) y deja historial',
    parametros: [
      leadId('id del lead de la suscripción.'),
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', obligatorio: true, enum: ['cancelada', 'activa'], descripcion: 'cancelada o activa (reactivar).' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
];
