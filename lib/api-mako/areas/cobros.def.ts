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
import { CAPAS_VENDIBLES } from '../../capas';
// Los medios de un recibo (lib/recibos-reglas.ts: puro, sin server-only).
import { MEDIOS } from '../../recibos-reglas';
// Puro (lib/pagos-campo.ts no tiene server-only): los datos del deal salen del mismo catálogo que la escritura.
import { CAMPOS_DEAL, CAMPOS_LEAD_DEAL, SECCIONES_DEAL } from '../../pagos-campo';

const TODOS = ['whatsapp', 'app', 'http'] as const;

const G_TAB: Gating = { tab: 'crm' };
/** Lo que mueve plata del cliente: sólo el admin del negocio (el test lo exige con `dinero`). */
const G_ADMIN: Gating = { tab: 'crm', rolMinimo: 'admin' };

const leadId = (desc: string, obligatorio = true): Parametro =>
  ({ nombre: 'leadId', rotulo: 'Lead', tipo: 'number', descripcion: desc, entero: true, minimo: 1, ...(obligatorio ? { obligatorio: true } : {}) });

const cobroId = (desc = 'id del cobro en MaKo (de listar_cobros o ver_cobro). No es el id de Stripe ni el de Mercado Pago, ni el pagoId de una cuota del CRM.'): Parametro =>
  ({ nombre: 'cobroId', rotulo: 'Cobro', tipo: 'number', obligatorio: true, entero: true, minimo: 1, fijoAlRevisar: true, descripcion: desc });

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
    titulo: 'Cobros de Stripe, Mercado Pago y Creem',
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
    id: 'crear_link_pago', aTerceros: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Crear un link de pago',
    descripcion: 'PROPONE crear un link de pago de Stripe o Mercado Pago, con la cuenta del negocio, para que UN lead pague un producto del catálogo de ofertas. El precio sale del catálogo (listar_productos), nunca se escribe a mano: un monto libre se carga desde la ficha del lead. Pide antes el leadId (buscar_leads) y el productoId (listar_productos). Al confirmar, el link le llega a la persona por aparte y queda en la ficha del lead: NO lo escribas ni lo copies. Si el lead ya tiene un link pendiente de ese producto, no crea otro.',
    escribe: 'crea el cobro en `cobros` y su checkout (Stripe) o su preferencia (Mercado Pago) con la cuenta del negocio, y deja historial en el lead',
    parametros: [
      leadId('id del lead que va a pagar (de buscar_leads).'),
      { nombre: 'productoId', rotulo: 'Producto del catálogo', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del producto del catálogo de ofertas (de listar_productos), con su precio. NO es el embudoId del CRM.' },
      { nombre: 'pasarela', rotulo: 'Pasarela', tipo: 'string', enum: PASARELAS, descripcion: 'stripe, mercadopago o creem. Sin valor: la única conectada, o Stripe si hay varias (el precio del catálogo está en dólares).' },
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
    // Leila (26/10/2026, Fabi Pedraza): mandó la constancia al chat del lead y MaKo contestó «Desde este chat no puedo
    // adjuntar ni guardar el documento en su ficha». Sólo la app: es la que guarda el archivo del mensaje (`ctx.adjuntos`).
    id: 'guardar_documento_fiscal', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Guardar el documento fiscal de un lead',
    descripcion: 'PROPONE guardar en la ficha de un lead, como su documento fiscal (la constancia de situación fiscal, el RFC, el CUIT…), el archivo que la persona adjuntó en ESTE mensaje, y completar los datos fiscales que estén VACÍOS con lo que leíste en el documento (razon, id_fiscal, domicilio, correo): lo ya cargado no se pisa. Si ya tenía un documento, queda el nuevo. El archivo de un mensaje anterior no sirve: que lo vuelva a adjuntar con el pedido. Para cambiar un dato fiscal ya cargado, editar_dato_deal.',
    escribe: 'sube el archivo a la ficha del lead (deal_fiscal.doc_path y doc_nombre) y completa los datos fiscales vacíos, cada uno con el antes y el después en el historial',
    parametros: [
      leadId('id del lead (de buscar_leads).'),
      { nombre: 'archivo', rotulo: 'Archivo', tipo: 'string', max: 200, descripcion: 'el nombre del archivo, sólo si adjuntó más de uno.' },
      { nombre: 'razon', rotulo: 'Razón social', tipo: 'string', max: 2000, descripcion: 'la razón social o el nombre que dice el documento.' },
      { nombre: 'id_fiscal', rotulo: 'Identificación fiscal', tipo: 'string', max: 2000, descripcion: 'el RFC, CUIT, NIT… tal cual lo dice el documento.' },
      { nombre: 'domicilio', rotulo: 'Domicilio fiscal', tipo: 'string', max: 2000, descripcion: 'el domicilio fiscal, en una línea.' },
      { nombre: 'correo', rotulo: 'Correo de facturación', tipo: 'string', max: 2000, descripcion: 'el correo de facturación, si aparece.' },
    ],
    canales: ['app'], costo: 'gratis', gating: G_TAB,
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
    id: 'editar_venta_lead', plata: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
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
    id: 'editar_cuota', plata: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
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
    id: 'crear_link_cuota', aTerceros: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cobrar una cuota con un link',
    descripcion: 'PROPONE crear un link de pago de Stripe, con la cuenta del negocio, que cobra UNA cuota sin cobrar de un lead por su monto exacto en USD (el pago_id de cobranza_lead). Al pagarse, la cuota queda cobrada y se cortan sus recordatorios. Si la cuota ya tiene un link sin pagar, devuelve ése. Mercado Pago cobra en la moneda de su cuenta: ese link se crea desde la ficha del lead. El link le llega a la persona por aparte: NO lo escribas ni lo copies.',
    escribe: 'crea el cobro en `cobros` atado a la cuota y su checkout de Stripe con la cuenta del negocio, y deja historial en el lead',
    parametros: [
      leadId('id del lead dueño de la cuota.'),
      cuotaId(),
      { nombre: 'pasarela', rotulo: 'Pasarela', tipo: 'string', enum: PASARELAS, descripcion: 'stripe o creem (la cuota está en dólares; Mercado Pago cobra en la moneda de su cuenta). Sin valor, Stripe.' },
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
    id: 'baja_del_cliente', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Baja del cliente',
    descripcion: 'PROPONE marcar que un cliente se dio de baja y dejó de pagar su plan de cuotas: lo que NO pagó deja de ser deuda (sale del Outstanding, de «A quién cobrarle», de lo vencido y de los recordatorios de cobro) y lo cobrado queda como está. Las cuotas siguen en su ficha como «baja del cliente», se anulan sus links sin pagar y se cortan sus recordatorios. Úsala cuando digan «se dio de baja», «dejó el servicio» o «ya no va a pagar el resto». Con deshacer: true, las cuotas vuelven a ser deuda con su vencimiento. Una suscripción no se da de baja así: se cancela (estado_suscripcion_manual o cancelar_suscripcion).',
    escribe: 'marca baja_at en las cuotas impagas del lead y les guarda el vencimiento en baja_vencia (o se lo devuelve al deshacer), anula sus links sin pagar, corta sus recordatorios y deja historial',
    parametros: [
      leadId('id del lead que se dio de baja.'),
      { nombre: 'deshacer', rotulo: 'Deshacer', tipo: 'boolean', descripcion: 'true para deshacer una baja: las cuotas vuelven a ser deuda.' },
    ],
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
  // ── Vender un plan de MaKo (23/10/2026, P0-8 de la auditoría de la API) ──────────────────────────────
  // «Vender un plan» de /admin/cobros por el chat del super admin: el MISMO camino que la pantalla (`venderPlan`,
  // lib/vender-plan.ts; Cobros pidió no armar otro). `crear_link_pago` no sirve para esto: exige un producto del catálogo
  // y no pone `altaCapa`, así que al pagarse no se crea la cuenta. Sólo la plataforma (`soloPlataforma` + admin) y sin
  // HTTP; el workspace sale de `wsSuperAdmin()` adentro del runner, nunca del input. Se confirma en PANTALLA
  // (/mako/revisar, decisión del Cerebro del 23/10/2026: lo que mueve plata va con pantalla y admin): el precio lo tipea
  // una persona y el link cobra eso. El email y el plan quedan fijos al revisar: el resumen se armó con ellos.
  {
    id: 'vender_plan_mako', area: 'cobros', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Vender un plan de MaKo',
    descripcion: 'Sólo para la plataforma: PROPONE crear el link de pago de un plan de MaKo para una persona (se confirma en una pantalla, donde se puede corregir el monto), como «Vender un plan» de Cobros. Al pagarlo, se le crea su cuenta de MaKo con ese plan. La busca por su email entre los leads de la plataforma (o la crea); con dos leads del mismo email, no elige. Confirmar sólo crea el link: queda en Cobros, para pasárselo a la persona. Se anula con anular_link_pago.',
    escribe: 'crea el lead del comprador en el CRM de la plataforma si no estaba, y el cobro que da de alta la cuenta al pagarse (cobros.alta_capa), con su checkout de Stripe o su preferencia de Mercado Pago',
    parametros: [
      { nombre: 'capa', rotulo: 'Plan', tipo: 'string', obligatorio: true, fijoAlRevisar: true, enum: CAPAS_VENDIBLES.map((c) => c.id), descripcion: 'el plan que compra.' },
      { nombre: 'email', rotulo: 'Email', tipo: 'string', obligatorio: true, fijoAlRevisar: true, max: 200, descripcion: 'el email de quien paga: con él se crea su cuenta.' },
      { nombre: 'nombre', rotulo: 'Nombre', tipo: 'string', obligatorio: true, max: 200, descripcion: 'nombre y apellido de quien paga.' },
      { nombre: 'monto', rotulo: 'Monto', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'cuánto cobra el link, en la moneda.' },
      { nombre: 'tipo', rotulo: 'Tipo', tipo: 'string', obligatorio: true, enum: ['suscripcion', 'unico'], descripcion: 'suscripcion (cobra cada mes) o unico.' },
      { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', max: 3, descripcion: 'código de 3 letras (USD, MXN, ARS…). Sin ella, la de la cuenta de la pasarela.' },
      { nombre: 'montoUsd', rotulo: 'Valor en dólares', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'cuánto es en dólares, si la moneda no es USD: sin él el cobro no entra a la plata del CRM.' },
      { nombre: 'pasarela', rotulo: 'Pasarela', tipo: 'string', enum: PASARELAS, descripcion: 'stripe, mercadopago o creem. Hace falta sólo si la plataforma tiene más de una conectada.' },
      // 29/10/2026: el partner que lo trajo, como el campo de la pantalla; tiene que ser el código de un partner.
      { nombre: 'codigoPartner', rotulo: 'Código de partner', tipo: 'string', max: 40, descripcion: 'el código de MaKo Partners de quien lo trajo, si lo trajo alguien: ese partner gana su primer mes.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'externo', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  // ── Customers del super admin (25/10/2026, docs/feedback-25-10-tarde.md puntos 10 y 12) ─────────────────────────
  // La vista Customers (app/customers) por chat: los clientes de MaKo por segmento con su MRR, y en qué trabajan en su
  // Claude Code (lo que era /admin/agente). Sólo la plataforma y, en la app, el super admin global (el runner lo pregunta); sin HTTP: son datos de todos los negocios.
  {
    id: 'ver_clientes_de_mako', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver los clientes de MaKo',
    descripcion: 'Sólo para la plataforma: los clientes de MaKo, como la vista Customers. Arriba, los números: el ingreso mensual (MRR: lo que cada negocio paga como su mensualidad, registrado a mano o por la pasarela, en dólares; sin las pruebas gratis ni los planes dados a mano), cuántos pagan, lo que entró cada mes (6 meses) y las cuotas vencidas, los clientes activos, los nuevos en 30 días y los que están en riesgo (pausados, con un cobro que falló, o sin que nadie de su equipo entre hace 14 días). Después, cada negocio con su segmento: partner (tiene su link de MaKo Partners), agency (plan Pro y se sumó como Agency), cliente (el resto) o de-agencia (cliente de una agencia: lo factura su agencia), su plan, su estado, su MRR, por qué está en riesgo, cuántos días hace que no entra nadie, cuántos leads tiene y cuándo llegó el último, si terminó su onboarding, sus sesiones del agente en 30 días, si tiene un pago esperando y desde cuándo es cliente. Con segmento, sólo ese.',
    parametros: [
      { nombre: 'segmento', rotulo: 'Segmento', tipo: 'string', enum: ['partner', 'agency', 'cliente', 'de-agencia'], descripcion: 'sólo los de ese segmento. Sin esto, todos.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'ver_quieren_entrar', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver quién quiere entrar a MaKo',
    descripcion: 'Sólo para la plataforma: la bandeja «Quieren entrar» de Admin › Accounts: quien intentó entrar con Google sin tener cuenta y quien pidió un plan desde la página de planes, y todavía no tiene usuario. De cada uno, su correo, su nombre, si Google confirmó el correo, qué pidió y cuántas veces. Para darle de alta se usa esa pantalla: esto sólo lee.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'ver_agentes_de_clientes', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver en qué trabajan los clientes',
    descripcion: 'Sólo para la plataforma: las últimas sesiones que los clientes cerraron en SU Claude Code con el plugin de MaKo (al pie de Admin › Activity): de cada una, el negocio, cuándo, el título y el resumen del acta, y cuántos mensajes escribió. Sirve para ver qué piden más y si usan bien Claude. Los mensajes textuales no vienen: están al pie de Admin › Activity.',
    parametros: [
      { nombre: 'limite', rotulo: 'Cuántas', tipo: 'number', entero: true, minimo: 1, maximo: 50, descripcion: 'cuántas sesiones, las más nuevas primero. Sin esto, 20.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  // ── El plan por TRAMOS (29/10/2026; ticket #26 de Mauricio: «7500 dólares en 3 pagos… cada uno de 2,500», y MaKo contestó que
  // sus herramientas no creaban el plan). Lo que arma «Armar el plan» de la ficha, por la MISMA regla (lib/pagos-campo.ts,
  // `planPorTramosDelServer`) y la misma escritura (lib/pagos.ts, `guardarPlanPorTramos`). Por chat: es UN lead y el resumen dice
  // cada cuota con su fecha y su monto antes del «sí».
  {
    id: 'armar_plan_por_tramos', plata: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Armar el plan de cuotas por tramos',
    // ⚠️ CORTA A PROPÓSITO (29/10/2026): el chat junta herramientas hasta 12.000 caracteres, y con la descripción larga esta
    // sacaba a editar_cuota de «las fechas y las cantidades de pago de Ana están mal» (tests/mako-no-puedo-falsos.test.ts).
    descripcion: 'PROPONE el plan de cuotas de una venta de pago único, como «Armar el plan» de la ficha: uno o varios tramos seguidos, cada uno con el monto de cada cuota, su moneda, cada cuánto (mes, quincena o semana) y cuántas cuotas o hasta qué fecha. Ej.: «7500 dólares en 3 pagos de 2500, el 28 de octubre, noviembre y diciembre» = un tramo de 2500, día 28, 3 cuotas, primera el 28/10. Rehace por su id las cuotas sin cobrar; las cobradas y las que tienen un link o un recordatorio quedan, y se dice. Una suscripción se pasa antes a pago único con editar_venta_lead, que también cambia el monto de la venta.',
    escribe: 'rehace por su id las cuotas sin cobrar del plan del lead, escribe las columnas del plan y deja el historial',
    parametros: [
      leadId('id del lead (de buscar_leads).'),
      { ...fechaIso('primeraCuota', 'Primera cuota', 'AAAA-MM-DD de la primera cuota.'), obligatorio: true },
      {
        nombre: 'tramos', rotulo: 'Tramos', tipo: 'object[]', obligatorio: true, max: 10, descripcion: 'en orden, hasta 10. Un plan parejo es UN tramo.',
        campos: [
          { nombre: 'monto', rotulo: 'Monto de cada cuota', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'lo que vale cada cuota, en su moneda.' },
          { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', max: 3, descripcion: 'USD (sin valor), MXN, ARS…' },
          { nombre: 'montoUsd', rotulo: 'Cada cuota en dólares', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'en otra moneda, obligatorio: cada cuota en dólares.' },
          { nombre: 'cada', rotulo: 'Cada', tipo: 'string', enum: ['mes', 'quincena', 'semana'], descripcion: 'sin valor, mes.' },
          { nombre: 'dia', rotulo: 'Día de pago', tipo: 'number', entero: true, minimo: 1, maximo: 31, descripcion: 'mes: el día (sin valor, el de la primera cuota). Quincena: el primer día (sin valor, 1).' },
          { nombre: 'dia2', rotulo: 'Segundo día', tipo: 'number', entero: true, minimo: 1, maximo: 31, descripcion: 'quincena: el segundo día (sin valor, 15).' },
          { nombre: 'cuotas', rotulo: 'Cuántas cuotas', tipo: 'number', entero: true, minimo: 1, maximo: 60, descripcion: 'cuántas cuotas (o «hasta»).' },
          fechaIso('hasta', 'Hasta', 'AAAA-MM-DD: cobra hasta esa fecha, incluida.'),
        ],
      },
      { nombre: 'anticipo', rotulo: 'Anticipo', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'cobro inicial aparte, en su moneda. Sin él, queda el que ya tenga sin cobrar.' },
      { nombre: 'anticipoMoneda', rotulo: 'Moneda del anticipo', tipo: 'string', max: 3, descripcion: 'sin ella, USD.' },
      { nombre: 'anticipoUsd', rotulo: 'Anticipo en dólares', tipo: 'number', minimo: 0.01, maximo: 100000000, descripcion: 'si no es USD: en dólares.' },
      fechaIso('anticipoFecha', 'Fecha del anticipo', 'AAAA-MM-DD; sin ella, hoy.'),
      { nombre: 'sinAnticipo', rotulo: 'Sin anticipo', tipo: 'boolean', descripcion: 'true: quita el anticipo sin cobrar.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  // ── La suscripción mes a mes (5/11/2026, docs/investigacion-suscripciones.md) ─────────────────────────────────────────
  // Lo mismo que la tab Pagos de una suscripción: leerla mes a mes, y cambiar el monto desde un mes, cortarla y retomarla
  // (lib/suscripcion-cambios.ts, la MISMA implementación). Van después del plan por tramos y antes de las de la plataforma
  // (recibos y Admin), para que lo que se sume al final del área no choque con ellas; con palabras que no repiten las del área.
  {
    id: 'ver_suscripcion_lead', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver una suscripción mes a mes',
    descripcion: 'La suscripción de un lead mes a mes, como la tab Pagos: cuánto paga hoy (o el estimado si nadie cargó la mensualidad), el día de cobro, el próximo vencimiento, lo pagado en total y los ajustes, y cada mes con lo que tocaba, lo que entró, sus pagos y lo que cambió (empezó, subió, bajó, se cortó, volvió). Trae también los cambios guardados con su id.',
    parametros: [leadId('id del lead de la suscripción.')],
    salida: 'json', canales: TODOS, costo: 'gratis', gating: G_TAB,
  },
  {
    id: 'cambiar_suscripcion', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Cambiar el monto, cortar o retomar',
    descripcion: 'PROPONE un cambio de la suscripción de un lead que se cobra a mano, desde un mes: tipo=monto (la mensualidad nueva, sube o baja; los meses de antes quedan como estaban), corte (deja de pagar desde ese mes) o vuelta (vuelve desde ese mes, con otro monto si cambió). También para cargar la mensualidad que falta: tipo=monto desde el primer mes. Sólo el administrador. La que cobra la pasarela se cambia en su cobro.',
    escribe: 'agrega el cambio a suscripcion_movimientos (y el monto de antes la primera vez), deja suscripcion_monto_usd en la mensualidad de hoy, cancela o reactiva si el corte o la vuelta son de este mes, y deja historial',
    parametros: [
      leadId('id del lead de la suscripción.'),
      { nombre: 'tipo', rotulo: 'Cambio', tipo: 'string', obligatorio: true, enum: ['monto', 'corte', 'vuelta'], descripcion: 'monto, corte o vuelta.' },
      { nombre: 'desde', rotulo: 'Desde', tipo: 'string', obligatorio: true, max: 10, descripcion: 'AAAA-MM: el mes desde el que vale.' },
      { nombre: 'montoUsd', rotulo: 'Mensualidad', tipo: 'number', minimo: 0.01, maximo: 10000000, descripcion: 'en dólares. Obligatoria con tipo=monto.' },
      { nombre: 'dia', rotulo: 'Día de cobro', tipo: 'number', entero: true, minimo: 1, maximo: 31, descripcion: 'desde ese mes; sin valor, el de siempre.' },
    ],
    canales: TODOS, costo: 'gratis', gating: G_ADMIN,
  },
  // ── Los RECIBOS de MaKo (5/11/2026, lib/recibos.ts; Martín: «que se envíe siempre por email [...] y también por WhatsApp
  // [...] guardando dentro de SuperAdmin»). El libro de la plataforma: sólo el super admin, y sin HTTP (son los pagos de todos
  // los negocios). Las dos que escriben proponen y se confirman en pantalla, como vender_plan_mako, y no van en un flujo.
  {
    id: 'ver_recibos', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver los recibos de MaKo',
    descripcion: 'Sólo para la plataforma: el libro de recibos (Admin › Billing › Recibos). De cada uno, el N.º, a nombre de quién, lo recibido por moneda, el medio y la orden, la fecha, el estado (emitido, devuelto, contracargo, anulado) y cómo salió por correo y por WhatsApp. Con filtros de mes, cuenta, medio, estado o sólo los que no salieron.',
    parametros: [
      { nombre: 'mes', rotulo: 'Mes', tipo: 'string', max: 7, descripcion: 'AAAA-MM: sólo los pagados ese mes.' },
      { nombre: 'cuenta', rotulo: 'Cuenta', tipo: 'number', entero: true, minimo: 1, descripcion: 'el número de la cuenta (ws) a la que le llega.' },
      { nombre: 'medio', rotulo: 'Medio', tipo: 'string', enum: [...MEDIOS], descripcion: 'sólo los de ese medio.' },
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', enum: ['emitido', 'devuelto', 'devuelto_parcial', 'contracargo', 'anulado'], descripcion: 'sólo los de ese estado.' },
      { nombre: 'soloFallas', rotulo: 'Sólo los que no salieron', tipo: 'boolean', descripcion: 'true: sólo los que fallaron, rebotaron o no tienen destino.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'cargar_pago_a_mano', area: 'cobros', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: true,
    titulo: 'Cargar un pago a mano',
    descripcion: 'Sólo para la plataforma: PROPONE el recibo de plata que entró por fuera de la pasarela (Binance, transferencia, efectivo), como «Cargar pago» de Billing. Se confirma en una pantalla. Lleva la cuenta, a nombre de quién, qué se pagó (renglones en una sola moneda) y cómo (cada pago con su orden, fecha, monto y moneda). Una orden que ya está en otro recibo no entra. Si la cuenta la paga su agencia, se rechaza: va a la de la agencia. No marca meses pagados. La foto del comprobante se sube en la pantalla.',
    escribe: 'emite el recibo con su número en el libro de recibos de la plataforma y, si se pide, lo manda por correo y al grupo de MaKo de la cuenta',
    parametros: [
      { nombre: 'cuenta', rotulo: 'Cuenta', tipo: 'number', entero: true, minimo: 1, obligatorio: true, fijoAlRevisar: true, descripcion: 'el número de la cuenta (ws) que pagó.' },
      { nombre: 'aNombre', rotulo: 'A nombre de', tipo: 'string', obligatorio: true, max: 200, descripcion: 'cómo sale en el recibo, con tildes y apellidos bien escritos.' },
      {
        nombre: 'lineas', rotulo: 'Qué se pagó', tipo: 'object[]', obligatorio: true, max: 30, descripcion: 'un renglón por concepto, todos en la misma moneda.',
        campos: [
          { nombre: 'concepto', rotulo: 'Concepto', tipo: 'string', obligatorio: true, max: 200, descripcion: 'qué se pagó.' },
          { nombre: 'mes', rotulo: 'Mes', tipo: 'string', max: 40, descripcion: 'el mes que cubre, en palabras (noviembre).' },
          { nombre: 'monto', rotulo: 'Importe', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'en la moneda del renglón.' },
          { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', obligatorio: true, max: 5, descripcion: 'USD, USDT, ARS…' },
        ],
      },
      {
        nombre: 'pagos', rotulo: 'Cómo se pagó', tipo: 'object[]', obligatorio: true, max: 10, descripcion: 'cada entrada de plata.',
        campos: [
          { nombre: 'medio', rotulo: 'Medio', tipo: 'string', obligatorio: true, enum: [...MEDIOS], descripcion: 'binance, transferencia, efectivo…' },
          { nombre: 'referencia', rotulo: 'Referencia', tipo: 'string', obligatorio: true, max: 200, descripcion: 'en Binance, los 18 dígitos del «Order ID».' },
          { nombre: 'fecha', rotulo: 'Fecha y hora', tipo: 'string', obligatorio: true, max: 40, descripcion: 'AAAA-MM-DDTHH:MM, en la hora de la plataforma.' },
          { nombre: 'monto', rotulo: 'Monto', tipo: 'number', obligatorio: true, minimo: 0.01, maximo: 100000000, descripcion: 'lo que entró.' },
          { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', obligatorio: true, max: 5, descripcion: 'USDT, USD, ARS…' },
          { nombre: 'de', rotulo: 'De', tipo: 'string', max: 120, descripcion: 'quién lo mandó, si se ve en el comprobante.' },
        ],
      },
      { nombre: 'notaPdf', rotulo: 'Nota del PDF', tipo: 'string', max: 500, descripcion: 'sale en el recibo (ej.: «Cubre hasta el 4/12»).' },
      { nombre: 'notaInterna', rotulo: 'Nota interna', tipo: 'string', max: 500, descripcion: 'sólo se ve en Billing.' },
      { nombre: 'enviar', rotulo: 'Enviar', tipo: 'boolean', descripcion: 'false: lo emite sin mandarlo. Sin valor, lo manda.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'reenviar_recibo', area: 'cobros', tipo: 'accion', confirmacion: 'pantalla', pantalla: '/mako/revisar', reversible: false,
    titulo: 'Reenviar un recibo de MaKo',
    descripcion: 'Sólo para la plataforma: PROPONE volver a mandar un recibo (por su N.º) por correo y al grupo de su cuenta, o a otro correo. Se confirma en una pantalla. Un recibo anulado o devuelto no se reenvía.',
    escribe: 'vuelve a mandar el recibo por correo (y al grupo de MaKo de la cuenta, si va) y lo anota en su historial',
    parametros: [
      { nombre: 'numero', rotulo: 'N.º', tipo: 'number', entero: true, minimo: 1, obligatorio: true, fijoAlRevisar: true, descripcion: 'el número del recibo (de ver_recibos).' },
      { nombre: 'correo', rotulo: 'Otro correo', tipo: 'string', max: 200, descripcion: 'si va a otra dirección. Sin valor, a los de siempre.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  // ── LA TARJETA «Leer comprobante» de Automations (5/11/2026, lib/comprobantes.ts; Martín: «un lector de comprobantes
  // de pago o recibos de pago»). Es una ⚡ Acción dibujada como lo que hace, como la etiqueta. Lo que leyó lo pregunta la
  // CONDITION «Su comprobante» (lib/condiciones-catalogo.ts). Nunca marca nada cobrado.
  {
    id: 'leer_comprobante', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Leer el comprobante de un lead',
    descripcion: 'PROPONE leer con la IA del negocio la última foto o PDF que un lead mandó por WhatsApp en las últimas 48 horas: monto, moneda, fecha, medio, a quién se pagó y el N.º de operación. Lo compara con la cuota que le toca y dice si la cubre, si pagó menos, si el N.º de operación ya se había usado o si hay que revisarlo. NUNCA marca nada cobrado: eso lo hace una persona. Es la tarjeta «Leer comprobante» de Automations.',
    escribe: 'guarda la lectura del comprobante (comprobantes_leidos) y deja historial en el lead',
    parametros: [leadId('id del lead que mandó el comprobante.')],
    canales: ['whatsapp', 'app'], costo: 'ia', gating: G_TAB,
  },
  // ── LA TARJETA «Emitir recibo» de Automations (5/11/2026, lib/recibos-negocio.ts; Martín: «varios templates [...] que
  // el usuario pueda elegir»). La ⚡ Acción dibujada como lo que hace. Un recibo por pago, numerado por negocio (mig 0399).
  {
    id: 'emitir_recibo', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: false, aTerceros: true,
    titulo: 'Emitir el recibo de un pago',
    descripcion: 'PROPONE emitir el recibo de pago (un PDF con número propio del negocio) de una cuota YA cobrada de un lead, con la plantilla elegida, y mandarlo al lead por WhatsApp o por correo, o al grupo de MaKo. Sin pagoId, la última cuota cobrada. Un pago tiene un solo recibo: pedirlo otra vez no crea otro número. Es un recibo de pago, no una factura fiscal. El correo sale con el dominio del negocio. Es la tarjeta «Emitir recibo» de Automations.',
    escribe: 'emite el recibo con su número (recibos_negocio), guarda el PDF y lo manda por el canal elegido',
    parametros: [
      leadId('id del lead que pagó.'),
      { nombre: 'plantilla', rotulo: 'Plantilla', tipo: 'string', enum: ['clasico', 'compacto', 'marca'], descripcion: 'clasico (completo), compacto (una hoja corta) o marca (con una franja con el nombre del negocio). Sin valor, clasico.' },
      { nombre: 'canal', rotulo: 'Por dónde sale', tipo: 'string', enum: ['whatsapp', 'email', 'grupo'], descripcion: 'whatsapp o email: al lead; grupo: al grupo de MaKo del negocio. Sin valor, whatsapp.' },
      { nombre: 'cuotaId', rotulo: 'Cuota', tipo: 'number', entero: true, minimo: 1, descripcion: 'el id de la cuota cobrada (el pagoId de cobranza_lead). Sin valor, la última cobrada.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: G_TAB,
  },
  // Admin › Revenue por chat (5/11/2026; Martín: «¿Cuánto es lo que me pagaron totalmente? ¿Cuánto me van pagando mes a mes?»).
  // Lo MISMO que la pantalla (lib/admin-ingresos.ts). Sólo la plataforma y, en la app, el super admin global (el runner lo
  // pregunta); sin HTTP: son datos de todos los negocios. AL FINAL del área y sin las palabras de las demás (AGENTS.md).
  {
    id: 'ver_ingresos_de_mako', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver los ingresos de MaKo',
    descripcion: 'Sólo para la plataforma: lo que entró a MaKo, como Admin › Revenue. El MRR de hoy y al cierre del mes pasado, lo de este mes y desde siempre, y mes a mes (12) el MRR, la plata que entró y sus movimientos: nuevos, volvieron, subieron, bajaron, se cortaron. Cada cliente con lo que paga por mes, lo que pagó en total, su estado y su próximo vencimiento; y lo que vence en 31 días. Sale de lo registrado a mano en el CRM de la plataforma y de la pasarela.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  // Admin › Users y Admin › Errors por chat (5/11/2026). Sólo LEEN: suspender a alguien apaga sus tokens de la API, y eso queda
  // en la pantalla (una persona, con su «¿seguro?»), no en un chat. Sin HTTP: son datos de todos los negocios.
  {
    id: 'ver_personas_de_mako', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver las personas de MaKo',
    descripcion: 'Sólo para la plataforma: como Admin › Users, las personas de todos los negocios con su estado de alta (activo: entró en 30 días; inactivo; invitado: nunca entró, y si se le mandó el acceso; suspendido), su rol, su negocio y cuándo entró. Con estado, sólo ésas.',
    parametros: [
      { nombre: 'estado', rotulo: 'Estado', tipo: 'string', enum: ['activo', 'inactivo', 'invitado', 'suspendido'], descripcion: 'sólo las de ese estado. Sin esto, todas.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'ver_errores_de_mako', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver los errores de la app',
    descripcion: 'Sólo para la plataforma: como Admin › Errors, los errores de la app agrupados (sin resolver, nuevos de 7 días, los que volvieron después de resueltos), cuántas veces pasaron, dónde, a cuántos negocios y su ticket; y los últimos reportes de las personas.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'ver_actividad_de_mako', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver quién usa la app',
    descripcion: 'Sólo para la plataforma: como Admin › Activity, cuántas personas de los negocios usaron la app hoy, en 7 y en 30 días; quién entra cada semana (nuevos, siguen, volvieron, dejaron); qué tabs se usan y cuáles nadie abrió; cada negocio con su uso; quién dejó de entrar, y lo último que hizo MaKo.',
    parametros: [],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  // ── LA MENSUALIDAD DE UNA AGENCIA, por fuera de MaKo (Martín, 5/11/2026, sobre el acuerdo del 30/10; lib/agencia-mes.ts) ──
  // MaKo no cobra por la pasarela: manda el PDF al grupo de WhatsApp con la agencia, lee el comprobante de Binance que mandan
  // ahí y pausa a quien no paga. Lo que va a Martín (un comprobante dudoso) lo anota él con estas operaciones. Sólo la plataforma y, en la app, el super admin GLOBAL (lo preguntan el runner y `faltaParaConfirmar`); sin
  // HTTP; y las tres que escriben van en NO_EN_FLUJOS (lib/api-mako/flujo.ts): un paso de una automatización se confirma solo.
  // Al final del área (AGENTS.md: una operación nueva no le saca el lugar a otra).
  {
    id: 'ver_mensualidades_agencias', area: 'cobros', tipo: 'lectura',
    titulo: 'Ver las mensualidades de las agencias',
    descripcion: 'Sólo para la plataforma: las agencias con la mensualidad por fuera de MaKo prendida y, de cada una, el total de este mes (cubre del 5 al 5), hasta qué día se paga, cuánto entró, qué se debe hoy, quién está en pausa y los meses anteriores sin pagar. Con agenciaWs, el detalle de una: cada renglón, lo que se debe hoy (meses y entradas, con sus días y el precio por día), en qué está cada cliente (cuenta, sin costo, debe su entrada, paga para entrar, de baja) y desde qué día corre su reloj. Una agencia con la mensualidad apagada sale con apagada: true y cómo quedaría este mes.',
    parametros: [
      { nombre: 'agenciaWs', rotulo: 'Agencia', tipo: 'number', entero: true, minimo: 1, descripcion: 'el número de cuenta de la agencia. Sin esto, todas.' },
    ],
    salida: 'json', canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'marcar_mensualidad_pagada', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Marcar pagada la mensualidad de una agencia',
    descripcion: 'Sólo el super admin: anota que una agencia pagó su mensualidad de un mes, con el día en que entró (por ejemplo, un comprobante que MaKo mandó a revisar). Con la orden de Binance (18 dígitos) sale el recibo al grupo de la agencia; sin ella queda anotado sin recibo. Si la agencia o sus clientes estaban en pausa por ese mes, vuelven a entrar. Con quitar: true, saca la marca y anula su recibo. Sólo meses desde que se prendió y hasta el actual.',
    escribe: 'el pago del mes de esa agencia (app_settings de la plataforma, agencia.mensualidad.<agencia>.pago.<mes> y .orden.<orden>), su recibo y la pausa de sus cuentas',
    parametros: [
      { nombre: 'agenciaWs', rotulo: 'Agencia', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta de la agencia (de ver_mensualidades_agencias).' },
      { nombre: 'mes', rotulo: 'Mes', tipo: 'string', obligatorio: true, max: 7, descripcion: 'AAAA-MM, el mes que pagó.' },
      { nombre: 'pagadoEl', rotulo: 'Día del pago', tipo: 'string', max: 10, descripcion: 'AAAA-MM-DD en que entró el pago. Sin esto, hoy.' },
      { nombre: 'quitar', rotulo: 'Quitar la marca', tipo: 'boolean', descripcion: 'true: saca la marca de pagado de ese mes.' },
      { nombre: 'orden', rotulo: 'Orden de Binance', tipo: 'string', max: 40, descripcion: 'los 18 dígitos del «Order ID» del comprobante. Con esto sale el recibo.' },
      { nombre: 'montoPagado', rotulo: 'Monto pagado', tipo: 'number', minimo: 0.01, maximo: 100000, descripcion: 'lo que dice el comprobante, en dólares. Sin esto, lo que se debía.' },
      { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', max: 5, descripcion: 'USD, USDT o USDC (sin esto, USDT).' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'corregir_reloj_mensualidad', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Corregir el reloj de un cliente',
    descripcion: 'Sólo el super admin: corrige el día desde el que corren los 14 días sin costo de un cliente de una agencia (por ejemplo, una cuenta que nació antes como prueba). Empieza a contar 14 días después de esa fecha. Con dia vacío, vuelve a la fecha en que la agencia lo invitó.',
    escribe: 'la fecha del reloj del cliente en la cartera de la agencia (agencia_clientes.cobra_desde)',
    parametros: [
      { nombre: 'agenciaWs', rotulo: 'Agencia', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta de la agencia.' },
      { nombre: 'clienteWs', rotulo: 'Cliente', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta del cliente (de ver_mensualidades_agencias con agenciaWs).' },
      { nombre: 'dia', rotulo: 'Desde', tipo: 'string', max: 10, descripcion: 'AAAA-MM-DD desde el que corren sus 14 días. Sin esto, desde la invitación.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    // aTerceros: prenderla hace que MaKo les escriba a los admins de la agencia (la app y el correo) cada mes.
    id: 'prender_mensualidad_agencia', aTerceros: true, area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Prender o apagar la mensualidad de una agencia',
    descripcion: 'Sólo el super admin: prende la mensualidad por fuera de MaKo de una agencia: desde qué mes MaKo manda el PDF del mes al grupo de WhatsApp con la agencia (del 1 al 5), desde qué día se cobra la entrada de cada cliente (sus días hasta el próximo 5; los que empezaron antes entraron a mano) y por qué medio paga (sin esto, Binance). Desde ahí MaKo lee el comprobante que mandan al grupo, saca el recibo y pausa sola a quien no paga («Paga para entrar»): el cliente que no pagó su entrada y, el día 6 sin el total, la agencia y sus clientes. Con apagar: true, deja de avisar y de pausar; lo pagado queda anotado. Apagada, la agencia sigue con el cobro por su link.',
    escribe: 'la mensualidad de la agencia (app_settings de la plataforma, agencia.mensualidad.<agencia>.config)',
    parametros: [
      { nombre: 'agenciaWs', rotulo: 'Agencia', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta de la agencia.' },
      { nombre: 'desde', rotulo: 'Desde', tipo: 'string', max: 7, descripcion: 'AAAA-MM, el primer mes que se factura así. Sin esto, el actual.' },
      { nombre: 'entradasDesde', rotulo: 'Entradas desde', tipo: 'string', max: 10, descripcion: 'AAAA-MM-DD: los clientes cuyos 14 días terminan desde ese día pagan su entrada. Sin esto, hoy.' },
      { nombre: 'medio', rotulo: 'Medio de pago', tipo: 'string', max: 40, descripcion: 'por dónde paga (sin esto, Binance).' },
      { nombre: 'apagar', rotulo: 'Apagar', tipo: 'boolean', descripcion: 'true: la apaga.' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
  {
    id: 'marcar_entrada_pagada', area: 'cobros', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Marcar pagada la entrada de un cliente',
    descripcion: 'Sólo el super admin: anota que una agencia pagó la entrada de un cliente (sus días hasta el próximo 5), con el día en que entró (por ejemplo, un comprobante que MaKo mandó a revisar). Si estaba en pausa, sus días se cuentan desde ese día y vuelve a entrar. Con la orden de Binance (18 dígitos) sale el recibo al grupo de la agencia.',
    escribe: 'la entrada del cliente (app_settings de la plataforma, agencia.mensualidad.<agencia>.entrada.<cliente>), su recibo y su pausa',
    parametros: [
      { nombre: 'agenciaWs', rotulo: 'Agencia', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta de la agencia.' },
      { nombre: 'clienteWs', rotulo: 'Cliente', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta del cliente (de ver_mensualidades_agencias con agenciaWs).' },
      { nombre: 'pagadoEl', rotulo: 'Día del pago', tipo: 'string', max: 10, descripcion: 'AAAA-MM-DD en que entró el pago. Sin esto, hoy.' },
      { nombre: 'orden', rotulo: 'Orden de Binance', tipo: 'string', max: 40, descripcion: 'los 18 dígitos del «Order ID». Con esto sale el recibo.' },
      { nombre: 'montoPagado', rotulo: 'Monto pagado', tipo: 'number', minimo: 0.01, maximo: 100000, descripcion: 'lo que dice el comprobante, en dólares. Sin esto, lo que se debía.' },
      { nombre: 'moneda', rotulo: 'Moneda', tipo: 'string', max: 5, descripcion: 'USD, USDT o USDC (sin esto, USDT).' },
    ],
    canales: ['whatsapp', 'app'], costo: 'gratis', gating: { rolMinimo: 'admin', soloPlataforma: true },
  },
];
