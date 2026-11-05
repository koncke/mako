// =============================================================================
// Payment Gateway — el registro de construcción del área
// =============================================================================
// Alcance: cobrar con Stripe y Mercado Pago, para MaKo (vender sus planes, con el alta de la cuenta
// al pagar) y para cada cliente que conecta su propia cuenta (BYOK). El contrato entre las piezas
// está en docs/diseno-pasarela-pagos.md; lo aprendido, en docs/hallazgos-planes-y-cobro.md.
//
// Vive en: lib/cobros*.ts (el único escritor de `cobros`), lib/stripe-api.ts y
// lib/mercadopago-api.ts (fetch crudo, sin SDK), lib/pasarela-firma.ts, los webhooks de
// app/api/webhooks/{stripe,mercadopago}, el cron de reconciliación, /pagar/<token> y /admin/cobros.
//
// NO es un changelog: va el motivo, la trampa y el pedido textual.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Conectar pegando la clave (BYOK)', detalle: 'Categoría «Pagos» en /integraciones · MaKo deriva el id de la cuenta y, en Stripe, registra el aviso solo · nada se guarda si el proveedor no acepta la clave', estado: 'hecha' },
  { titulo: 'El cobro y su link estable', detalle: '`cobros` (mig 0255) · /pagar/<token> abre el checkout vivo: la sesión de Stripe vence y el link no', estado: 'hecha' },
  { titulo: 'Los avisos de la pasarela', detalle: 'Firma propia de cada una (Stripe no es Svix) · ruteo estricto · se relee el pago al proveedor antes de aplicar · dedup por evento · cron cada 30 min como red', estado: 'hecha' },
  { titulo: 'Alta automática al pagar un plan de MaKo', detalle: 'Sólo si el cobro es del workspace de la plataforma, en positivo · reclamo antes de crear (dos avisos no dan dos altas) · un email que ya es usuario no se toca solo', estado: 'hecha' },
  { titulo: 'Vender un plan desde /admin/cobros', detalle: 'Plan → pasarela (si hay dos) → monto → a quién → link · la lista con el estado del cobro y el de la cuenta', estado: 'hecha' },
  { titulo: 'Cobrar desde la ficha del lead y por la API de MaKo', detalle: 'La tab Pagos de la ficha (las tres puertas) y el área `cobros` de la API', estado: 'sigue' },
  { titulo: 'Baja del cliente en las cuotas', detalle: 'Lo que no pagó quien se fue deja de ser deuda en todos lados; lo cobrado queda · se deshace', estado: 'hecha' },
  { titulo: 'El cliente de una agencia se paga al cargarlo', detalle: 'Link de Mercado Pago del primer mes al abrir su cuenta · el pago lo habilita · la suscripción nace al terminar el onboarding. Falta la Mercado Pago de MaKo y el precio en pesos', estado: 'sigue' },
  { titulo: 'El primer cobro real, de punta a punta', detalle: 'Aplicar la migración 0255 y conectar la cuenta de MaKo en /integraciones del workspace de la plataforma', estado: 'cola' },
  { titulo: 'Revisar /terminos y /reembolsos', detalle: 'Quedaron en BORRADOR de mínima: plazo de respuesta, garantía del grupal y cancelar sin escribir los decide Martín', estado: 'cola' },
  { titulo: '«Pagos» en el CRON de Automations', detalle: 'Botón propio (grilla 4+3) con aprobado · rechazado · reembolsado · suscripción cancelada, y el aviso al dueño. Fase 2, después del commit de Automations', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '11 oct', hora: '—', chat: '—', cuenta: 'claude3',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Cobrar con Stripe y Mercado Pago, para MaKo y para cada cliente',
    pedido: 'Esta tab se llama "Integraciones". Quiero que implementes end-to-end la integración con Mercado Pago y con Stripe, tipo pasarela de pagos... Lo voy a utilizar yo como superadmin para vender MaKo, pero también los usuarios pueden alojarlo... Obvio revisa si hay que meterlo en diferentes lugares, como la API de MaKo, como automatios, como el CRM, etc...',
    puntos: [
      'Y tres decisiones suyas del mismo día, que no se vuelven a preguntar:',
      '**Alta automática.** Al pagar un plan de MaKo se crea la cuenta con ese plan y le llega el mail de acceso; en la página de retorno se le ofrece cambiar la cuenta de Google con la que va a entrar (el login es sólo Google). Contradice a propósito el precedente de las agencias, donde «la aprobación del super admin manda el acceso»: para el que compra solo, esperar mata la venta.',
      '**Cada cliente conecta pegando sus claves (BYOK)**, no OAuth ni Stripe Connect.',
      '**En Automations, «Pagos» es un botón propio del CRON** (grilla 4+3). Va en una fase 2, después del commit de Automations: esos archivos los estaba editando otra sesión.',
    ],
  },
  {
    fecha: '11 oct', hora: '—', chat: '—', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La pasarela, y Martín vendiendo MaKo con la MISMA que conecta un cliente',
    puntos: [
      '**No hay una máquina de cobro de la plataforma.** MaKo cobra con la integración que conecta cualquier cliente, desde /integraciones del workspace `wsSuperAdmin()`. Lo único propio de la plataforma es una rama en `lib/cobros.ts`: si el cobro es de ESE workspace y trae plan, al pagarse da de alta la cuenta. Escrita en positivo: un cliente que vende con su Stripe no crea inquilinos en MaKo.',
      '⚠️ **El diagnóstico viejo estaba equivocado:** docs/hallazgos-planes-y-cobro.md decía «envolverlo con verificarFirmaSvix». Svix le saca el prefijo al secreto y lo decodifica en base64; Stripe firma con el `whsec_…` ENTERO. Habría rechazado el 100% de los avisos con «no coincide», que se lee igual que un secreto mal pegado.',
      '⚠️ **Las claves se leen con `credDelCliente(clave, ws)` y con nada más.** `credWs` y `envCred` caen al ws1 (Mauricio, un cliente): la venta de un plan de MaKo se habría cobrado en su cuenta, sin un error.',
      '**En «Vender un plan» la pasarela va ANTES del monto**, no al final: Mercado Pago sólo cobra en la moneda de su cuenta, así que preguntar «¿cuánto?» sin saber con qué era ofrecer «97 USD» a una cuenta argentina que lo rechaza.',
      '**Dos leads con el mismo email no se eligen solos.** `findLeadByContacto` se queda con el más viejo y lo dice sólo en un log: un cobro atado al lead equivocado deja el alta en la ficha de otra persona.',
    ],
    archivos: [
      'docs/diseno-pasarela-pagos.md — el contrato entre las piezas',
      'lib/cobros.ts — el único escritor de `cobros`, y la rama del alta de la plataforma',
      'app/admin/cobros/actions.ts — vender un plan: el lead del comprador + `crearCobro` en `wsSuperAdmin()`',
      'tests/admin-cobros.test.ts — guard primero en cada action, el ws de la plataforma, la capa superadmin fuera',
    ],
  },
  {
    fecha: '16 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'El cliente de una agencia se paga al cargarlo, y su mes corre desde el onboarding',
    pedido: 'yo lo que voy a hacer es, vos al momento de, en la vista de clientes, de cargar nuevo cliente, te va a aparecer ahí directamente el link de mercado pago para pagar la suscripción de ese cliente... ya se habilita automáticamente y ahí se renueva mensualmente la misma fecha que lo cargaste... yo ya ni siquiera lo voy a tener que aceptar',
    puntos: [
      'Llamada «Revisión de MaKo» con Código Inmobiliario (1:51:21, tarjeta #866): 47 dólares por cliente y 97 la suscripción de agencia.',
      'En la misma llamada (1:59:00, tarjeta #867), Martín ofreció y Joan aceptó: «se paga la suscripción de ese cliente, pero se pausa el tiempo, y empieza a contabilizar una vez que terminó el onboarding».',
    ],
  },
  {
    fecha: '16 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Una opción «baja del cliente» en las cuotas',
    pedido: 'yo voy a agregar ahora, también me llevo como fido agregar una opción de el cliente se dio de baja o algo así, baja del cliente',
    puntos: ['Llamada «Mau <> Martin» (28:34, tarjeta #871): Francisco Javier Hernández pagó unos 4.000 de 6.000 y dejó el servicio; la ficha sólo ofrecía «pagado» o «quitar».'],
  },
  {
    fecha: '17 oct', hora: '05:35', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: «Baja del cliente» en las cuotas de un lead',
    puntos: [
      'En la tab Pagos de la ficha, el bloque de cuotas tiene «Baja del cliente». Lo que no pagó deja de ser deuda en el Outstanding, en «A quién cobrarle», en lo vencido y en los recordatorios por WhatsApp; lo cobrado queda. Se deshace con «Deshacer la baja».',
      'Las cuotas siguen en la ficha como «baja del cliente · vencía el …», y el estado de cuenta dice «Se dio de baja · quedó sin cobrar $X». Se anulan sus links sin pagar y se cortan sus recordatorios. Una suscripción no se da de baja así: se cancela.',
      '⚠️ **La forma que lo resolvió:** la cuota de baja queda SIN vencimiento (el que tenía se guarda aparte). Así las doce lecturas de lo vencido, en áreas de otros chats, la dejan afuera solas, sin tocar cada una.',
      'MaKo también lo hace: `baja_del_cliente` en la API. Mig 0307.',
    ],
    commits: [
      { sha: '88be542a5', msg: 'Pagos: «Baja del cliente» en las cuotas (#871)', lineas: 542, archivos: 20 },
      { sha: '05f288bac', msg: 'Pagos: la baja del cliente tolera una base sin la migración 0307', lineas: 31, archivos: 4 },
    ],
    archivos: [
      'lib/pagos-baja.ts — el único que escribe la baja',
      'lib/cobrado-lead.ts — `noEsDeuda` (devuelta o de baja)',
      'app/crm/lead-view/ficha/pagos/bloques-cobro.tsx — el botón y el renglón',
      'tests/pagos-baja.test.ts — probado rompiéndolo',
    ],
    revisar: '/crm',
  },
  {
    fecha: '17 oct', hora: '05:35', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: el cliente de una agencia se paga al cargarlo',
    puntos: [
      'Al abrirle la cuenta a un cliente, la agencia ve en el acto el link de Mercado Pago de su primer mes («Pagar su mes» en su tarjeta de Customer Success). Pagarlo lo habilita solo y le manda el acceso, sin la aprobación del super admin.',
      'Su mes corre desde que termina el onboarding: ahí MaKo crea la suscripción mensual, que empieza a cobrar un mes después, y la agencia la autoriza una vez («Activar renovación»). Desde ahí renueva sola en esa fecha.',
      '⚠️ **Dos links y no una suscripción pausada:** Mercado Pago documenta la fecha de inicio al CREAR la suscripción, pero no qué cobra al reactivar una pausada. Si cobrara, la agencia pagaba dos veces el primer mes.',
      '**Para que cobre falta lo de Martín:** conectar la Mercado Pago de MaKo en /integraciones?ws=9 y cargar el precio en pesos de los US$47 en /admin/cobros → «Cliente de agencia». Sin eso, la cuenta espera la aprobación como antes.',
      'MaKo lo lee: `ver_pagos_clientes_agencia` en la API. Mig 0308.',
    ],
    commits: [{ sha: 'b6dd0a6be', msg: 'Pagos: el cliente de una agencia se paga al cargarlo y su mes corre desde el onboarding (#866, #867)', lineas: 983, archivos: 22 }],
    archivos: [
      'lib/agencia-cobro.ts — el link, la renovación y lo que ve la agencia',
      'lib/agencia-habilitar.ts — el pago aprueba la cartera, con el mismo aviso que la firma del super admin',
      'app/customer-success/CuentaDeMaKo.tsx — «Pagar su mes» y «Activar renovación»',
      'app/admin/cobros/PrecioClienteAgencia.tsx — el precio',
      'tests/agencia-cobro.test.ts — probado rompiéndolo',
    ],
    revisar: '/admin/cobros',
  },
  {
    fecha: '16 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: '«Quitar» un pago no se aplicó al primer intento',
    pedido: 'Se me hace que no la quitaste... Eso es un error',
    puntos: ['Llamada «Mau <> Martin» (27:42, tarjeta #891), en Pagos del lead de Francisco Javier Hernández; al rato, «ahí sí se quitó».'],
  },
  {
    fecha: '17 oct', hora: '09:24', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: «Quitar» una cuota se ve en el acto',
    puntos: [
      'Al confirmar «Quitar», la confirmación se cierra en el acto, el renglón dice «Quitando…» y desaparece apenas el server confirma. Si no se pudo quitar, vuelve y lo dice.',
      '⚠️ **No falló la primera vez: tardó.** En el lead de Francisco (ws1) quedó UNA sola baja registrada y no había nada que la frenara. La confirmación se cerraba recién al volver la acción, que actualiza cinco pantallas, y la fila se iba con la relectura de la ficha: segundos sin una señal.',
      'Lo mismo en «Baja del cliente»: su «guardando» se ve mientras corre.',
    ],
    commits: [{ sha: '344503de7', msg: 'Pagos: «Quitar» una cuota se ve en el acto (#891)', lineas: 133, archivos: 3 }],
    archivos: [
      'app/crm/lead-view/ficha/pagos/bloques-cobro.tsx — `quitar`, `quitando` y `quitadas`',
      'tests/pagos-quitar-al-instante.test.ts — probado rompiéndolo',
    ],
    revisar: '/crm/2739?ws=3&tab=pagos',
  },
  {
    fecha: '19 oct', hora: '—', chat: '—', cuenta: 'claude4', actor: 'martin', tipo: 'prompt',
    titulo: 'La cuota sin nombre, y las suscripciones que no se ven por cobrar',
    pedido: 'cuota ausente por cobrar',
    puntos: [
      'Llamada con Leila (24:15), pasada por el Cerebro: en el teléfono sale un aviso de cuota por cobrar que no dice de quién es, ni cuánto, ni lleva a la ficha.',
      'En la misma llamada: «Clientes por cobrar» no muestra las suscripciones (docs/investigacion-ops-center-19-10.md).',
    ],
  },
  {
    fecha: '21 oct', hora: '00:30', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: el aviso de la cuota dice de quién es, y «Clientes por cobrar» lista las suscripciones',
    puntos: [
      'El aviso nombra al cliente en el título («Francisco · Cuota vencida → cobrar»), dice la cuota, cuánto y cuándo venció, y lleva a la ficha del lead: en la lista de avisos, en el push y en el correo.',
      '⚠️ **Más amplio que la cobranza:** todo aviso sobre un lead llevaba a Configuraciones. El lead llegaba hasta el envío y nadie lo usaba para el link.',
      '«Clientes por cobrar» suma las suscripciones: un mes sin registrar, una renovación rechazada o la próxima mensualidad manual. En el Dashboard, General, el teléfono y la API. Su fila abre la ficha, donde se registra el mes. El número de Outstanding no cambia.',
    ],
    commits: [{ sha: '908d73d9f', msg: 'Avisos y cobranza: la cuota dice de quién es, y «Clientes por cobrar» lista las suscripciones', lineas: 659, archivos: 23 }],
    archivos: [
      'lib/aviso-lead.ts — el link, el texto y el título de un aviso sobre un lead',
      'lib/suscripciones-por-cobrar.ts — qué suscripción se cobra, con la regla de cobradoDelLead',
      'lib/pagos.ts — `getPorCobrar`: las cuotas y las suscripciones',
      'tests/aviso-lead.test.ts y tests/suscripciones-por-cobrar.test.ts — probados rompiéndolos',
    ],
    revisar: '/general?ws=3',
  },
  {
    fecha: '21 oct', hora: '01:30', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: marcar un cobro dos veces ya no lo cambia, y la ficha cuenta «hoy» con la zona del negocio',
    pedido: 'cobro idempotente y hoy del negocio (Cerebro, 20/10)',
    puntos: [
      'Marcar como cobrada una cuota que ya estaba cobrada (una lista vieja, otra pestaña, una tarjeta de MaKo confirmada tarde) ya no le cambia la fecha, el monto ni la moneda al cobro, y el historial no lo anota dos veces.',
      'La pantalla dice «Ya estaba cobrada» y no ofrece «Deshacer»: deshacer habría desmarcado el cobro de otra persona. Pasa en General, el teléfono, el Dashboard, la ficha y MaKo.',
      'La ficha, Clients y «Marcar pagada» cuentan el día con la zona del negocio: de noche, una cuota que vence hoy ya no sale vencida en la ficha, y un cobro de las 20 h queda en el día correcto.',
    ],
    commits: [{ sha: 'a34a63769', msg: 'Pagos: marcar un cobro dos veces no lo cambia, y «hoy» es el día del negocio en la ficha y en Clients', lineas: 405, archivos: 21 }],
    archivos: [
      'lib/pagos.ts — `marcarPago` y `cobrarCuota` devuelven `yaEstaba`',
      'app/crm/lead-view/ficha/FichaPorBloques.tsx y app/customer-success/PagosCliente.tsx — el día del negocio',
      'tests/pagos-cobro-idempotente.test.ts — probado rompiéndolo',
    ],
    revisar: '/crm/2739?ws=3&tab=pagos',
  },
  {
    fecha: '21 oct', hora: '02:30', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: dos cobros a la vez ya no se pisan, y la cartera y el asistente de Ganado usan el día del negocio',
    pedido: 'revisión adversarial del cobro (Cerebro, 20/10 noche)',
    puntos: [
      'Si dos personas (o MaKo y alguien en la ficha) cobran la misma cuota en el mismo momento, gana una sola: la otra ve «Ya estaba cobrada», y la cuota queda con los datos de quien la cobró, sin mezclar montos ni monedas.',
      'La cartera de Clients y la deuda vencida del Dashboard ya no dan por vencida una cuota que vence hoy, y cuentan con el día del negocio, como la ficha y General.',
      'El asistente de Ganado propone la primera cuota con el día del negocio (de noche, ya no la pone para mañana).',
      'La hora de un cobro anotado a mano es la del negocio, no la de quien lo anota.',
    ],
    commits: [{ sha: '0f55e9abd', msg: 'Pagos: el cobro se reserva con una escritura condicional, y la cartera y el asistente de Ganado cuentan el día del negocio', lineas: 351, archivos: 16 }],
    archivos: [
      'lib/pagos.ts — `siSigue` y `trasCobrar`: la escritura condicional del cobro',
      'lib/cs-cartera.ts y lib/graficos-datos-extra.ts — vencida con el día del negocio y `<`',
      'app/crm/StageMoveDialog.tsx — el asistente de Ganado',
      'tests/pagos-cobro-idempotente.test.ts — con dos carreras de verdad, probado rompiéndolo',
    ],
    revisar: '/clients?ws=3',
  },
  {
    fecha: '21 oct', hora: '13:00', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: el chat con MaKo muestra el estado de cuenta del cliente y lee el comprobante que le mandas',
    pedido: 'la 2.28 de Ops Center = lo principal (Pagos), con tres revisiones del Cerebro',
    puntos: [
      'Le preguntas a MaKo cómo está de pagos un cliente y te muestra el estado de cuenta en el chat: el mismo de la pestaña Pagos de su ficha, con «Cobrar la cuota».',
      'Si le mandas el comprobante en el mismo mensaje, al cobrar la cuota lo lee solo: monto, fecha y hora quedan cargados para revisar y guardar. Sólo para la cuota de ese cliente; si no está claro de quién es, te pregunta.',
      'El monto del comprobante se lee en SU moneda: unos pesos no se convierten con un tipo de cambio inventado. En un negocio en pesos, un «$» sin código no se toma por dólares, y te avisa si el monto no cuadra con la cuota.',
      'Un comprobante ya no le cambia el recibo a una cuota que ya estaba cobrada.',
    ],
    commits: [{ sha: '1b6fc9ad8', msg: 'Pagos: el estado de cuenta y el comprobante en el chat con MaKo (entró con 83d0c1ddb, run 209)', lineas: 1454, archivos: 36 }],
    archivos: [
      'app/_chat/bloques/EstadoCuentaHilo.tsx y app/crm/lead-view/ficha/pagos/comprobante-del-chat.ts — el estado de cuenta y el comprobante en el hilo',
      'lib/pagos-bloque.ts — `comprobanteDelPedido`: el comprobante va atado al cliente y a su cuota',
      'app/api/extract-receipt/route.ts y app/crm/lead-view/ficha/pagos/recibo-leido.ts — monto y moneda tal cual, sin convertir',
      'tests/chat-bloque-estado-cuenta.test.ts y tests/pagos-recibo-leido.test.ts — con la ruta real, probados rompiéndolos',
    ],
    revisar: '/second-brain?ws=3',
  },
  {
    fecha: '21 oct', hora: '13:45', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: leer un contrato ya no inventa un tipo de cambio',
    pedido: 'revisión de los bloques de Pagos (Cerebro, 21/10): el lector del contrato convertía como el del comprobante',
    puntos: [
      'Al pasar un cliente a Ganado y leer su contrato, el total y las cuotas se leen en SU moneda. Si el contrato está en pesos, te muestra «el contrato dice MX$72.000» y los dólares los cargas tú: ya no salen de una tasa que inventaba la IA.',
      'Si el contrato es en dólares, las cuotas se cargan solas sólo si suman el total. Un «US$4.000 en 12 mensualidades de $6.000 M.N.» ya no arma un plan de 72.000 dólares.',
      'Un lector de contratos viejo guardado en Configuraciones que convertía no deja sus montos, y te lo dice.',
      'La página pública (/vsl) ya no promete la conversión.',
    ],
    commits: [{ sha: 'b23ce2a9c', msg: 'Pagos: el lector del contrato lee montos y moneda tal cual, y las cuotas valen si suman el total (entró con 26b44e063, deploy 42efe1713)', lineas: 318, archivos: 10 }],
    archivos: [
      'lib/contrato-montos.ts — `montosDelContrato`: qué montos van según la moneda, y la tolerancia del asistente',
      'lib/prompt-defaults.ts — CONTRACT_EXTRACT_DEFAULT: el total y las cuotas tal como figuran, con su moneda',
      'app/crm/StageMoveDialog.tsx — el asistente de Ganado dice qué falta cargar',
      'tests/pagos-contrato-moneda.test.ts — con la ruta real, probado rompiéndolo',
    ],
    revisar: '/crm?ws=3',
  },
  {
    fecha: '21 oct', hora: '07:00', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: un cobro por menos deja su diferencia sin cuotas fantasma, y el asistente de Ganado no cobra dos veces un mes',
    pedido: 'revisiones adversariales del cobro, tercera a quinta (Cerebro, 21/10)',
    puntos: [
      'Cobrar una cuota por menos (300 de 500) deja la cuota cobrada y la diferencia pendiente juntas o ninguna: si algo falla en el medio, no queda una cuota fantasma que la cobranza le reclame al cliente, y reintentar no la duplica.',
      'El asistente de Ganado ya no rehace un plan que existe: volver a confirmar una suscripción cerrada no le agrega cuotas.',
      'Un pago suelto ya cobrado cuenta como el primer mes de la suscripción: la cuota de hoy no duplica el mes pagado.',
      'Lo que el asistente no hizo (un plan que ya estaba, pagos ya cobrados, una cuota con un link sin pagar) se dice en una pantalla antes de cerrar.',
      'La primera cuota de una suscripción es el día del cierre, y «+ Agregar cuota» propone el mes siguiente en el día pactado.',
      'Si el webhook de la pasarela falla a medias, su reintento corta los recordatorios del cliente que ya pagó.',
    ],
    commits: [
      { sha: '2a04fc94f', msg: 'Pagos: el cobro de menos en una transacción (mig 0318), y el asistente de Ganado arma el plan una vez desde el día del cierre', lineas: 471, archivos: 15 },
      { sha: '3b739200a', msg: 'Pagos: un pago suelto SÍ es parte del plan, lo que el asistente no hace lo muestra, y la 0318 cerrada a la clave pública (cuarta revisión)', lineas: 350, archivos: 11 },
    ],
    archivos: [
      'supabase/migrations/0318_cobrar_cuota_con_resto.sql — el cobro por menos en una transacción (aplicada antes del deploy)',
      'lib/pagos.ts — `cobrarConResto` y `curarDespues`',
      'lib/pagos-campo.ts — `planDelAsistente`',
      'app/crm/StageMoveDialog.tsx y app/crm/actions.ts — el asistente de Ganado y su aviso',
    ],
    revisar: '/crm/2739?ws=3&tab=pagos',
  },
  {
    fecha: '21 oct', hora: '17:40', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: cambiar el plan ya no deja deuda de más ni de menos, y cada mensualidad registrada cuenta un mes',
    pedido: 'revisiones de plan-sueltos (Cerebro, 21/10): dos altas y una media',
    puntos: [
      'Cambiar el plan en la pestaña Pagos (la cuota, la cantidad o el día) ya no deja deuda de más ni de menos cuando hay una seña cobrada por link o un cobro por menos: cada cuota queda en su mes.',
      'Una mensualidad registrada con «Registrar el mes cobrado» cuenta un mes, sea del monto que sea: el tipo de cambio del día o un precio que cambió ya no dejan a un cliente al día en «Falta registrar», ni esconden un mes que debe.',
      'Un pago que cubre varios meses (un adelanto) los cuenta todos, cobrado a mano o por link.',
      'Una cuota que alguien cambió mientras otro la cobraba no se cobra por el monto de antes: avisa que cambió y no guarda nada.',
    ],
    commits: [
      { sha: 'c4ebeca9c', msg: 'Pagos: «es cuota del plan» es UNA regla y la fila nace marcada, lo cobrado se cuenta de a una cobrada, y la 0323', lineas: 573, archivos: 12 },
      { sha: 'c16c6156f', msg: 'Pagos: lo que se registró como la mensualidad vale un mes siempre, y la pasarela cuenta como la mano', lineas: 143, archivos: 11 },
    ],
    archivos: [
      'lib/cobrado-lead.ts — `esCuotaDelPlan` y `mesesDeUnaCobrada`: qué es del plan y cuántos meses cubre cada cobrada',
      'lib/pagos-campo.ts — el lugar de cada cuota en el plan uniforme',
      'supabase/migrations/0323_cobrar_cuota_original_y_resto.sql — la marca de la diferencia, la de la mensualidad y el monto leído (aplicada antes del deploy)',
      'tests/pagos-plan-sueltos.test.ts y tests/pagos-cobro-idempotente.test.ts — con la ficha de verdad, probados rompiéndolos',
    ],
    revisar: '/crm?ws=3',
  },
  {
    fecha: '21 oct', hora: '17:40', chat: 'Pagos', sesion: 'local_d0cd6fc8-e2f9-4ee9-b76a-19264ced015f', cuenta: 'claude4', actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: el comprobante del chat se lee con la moneda del negocio, y el plan del contrato cuadra con el cierre',
    pedido: 'bajas de las revisiones de bloques y del contrato (Cerebro, 21/10)',
    puntos: [
      'El comprobante que le mandas a MaKo se lee recién cuando se sabe la moneda del negocio: ya no se toma por dólares un pago en pesos.',
      'El plan de cuotas que trae un contrato se da por bueno sólo si suma el monto de cierre; si no, el paso queda a la vista y dice cuánto suman.',
      'Si el contrato no dice su total, lo dice; y una cuota en 0 se saca en vez de dejar el plan sin montos.',
    ],
    commits: [
      { sha: 'e98adf779', msg: 'Pagos (bloques): el comprobante del chat se lee con la moneda del negocio ya cargada', lineas: 85, archivos: 6 },
      { sha: '7b2088efa', msg: 'Pagos (contrato): el plan se resuelve sólo si cuadra con el cierre que queda, y cada aviso dice lo que pasó', lineas: 140, archivos: 6 },
    ],
    archivos: [
      'app/crm/lead-view/ficha/pagos/datos.ts y piezas.tsx — la moneda del negocio, null hasta saberla',
      'lib/contrato-montos.ts — `planDelContrato` y los avisos del contrato',
    ],
    revisar: '/second-brain?ws=3',
  },
  {
    fecha: '22 oct', hora: '—', chat: '—', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Varias cuentas de Stripe, MP y Calendly o Cal en un negocio',
    pedido: 'Medilo en producción en el ws3, sólo leyendo: ¿un negocio puede conectar 2 cuentas de Stripe, 2 de MP y 2 de Calendly o Cal a la vez? ¿el «Vincular cobro» y el «Asignar evento» dejan elegir de cuál? Si no se puede, hacelo ahora: varias cuentas por proveedor, con un nombre para cada una, elegir la cuenta en «Vincular cobro» y en «Asignar evento», y desconectar cada una. Toca plata, así que va con su revisión adversarial antes de la punta.',
    puntos: [
      'Llegó por el Cerebro (punto 3 del feedback del CRM: «que pueda tener varias cuentas de Stripe y MP conectadas»). Medido: no se podía; cada pasarela tenía UNA cuenta, la de las claves sin sufijo.',
      'Calendly y Cal.com (la fase B) los hace este chat del lado del servidor; la pantalla y la API de «Asignar evento», el CRM.',
    ],
  },
  {
    fecha: '23 oct', hora: '00:27', chat: 'Cobros', sesion: 'local_460ff1f0-0675-4371-b228-594a9bd828e3', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Varias cuentas de Stripe y Mercado Pago: cada una con su nombre, y cada cobro con la suya',
    puntos: [
      'En Integraciones, el modal de Stripe y el de Mercado Pago listan «Tus cuentas»: conectar otra con un nombre, cambiarle el nombre, volver a conectarla y desconectar una sola.',
      '«Vincular cobro» y el link de la ficha dejan elegir la cuenta por su nombre; un producto vinculado cobra por la cuenta de su vínculo.',
      '⚠️ **El sufijo no es la identidad de una cuenta**: la primera versión ataba cada cobro a «c2», y una cuenta que se desconecta y vuelve cae en otro sufijo: sus renovaciones se ignoraban con un 200. Cada cobro guarda también su id en el proveedor (`cuenta_ref`), y todo lo que se hace con él la busca por ahí.',
      '⚠️ **Sin hacer:** la fase B (Calendly y Cal por cuenta); y la 0328 se aplica ANTES del deploy.',
    ],
    commits: [
      { sha: '9b30c3197', msg: 'Cobros: varias cuentas de Stripe y de Mercado Pago en un negocio (mig 0328)', lineas: 2081, archivos: 37 },
    ],
    archivos: [
      'lib/cuentas-integracion.ts (puro) y lib/cuentas-pago-server.ts — el modelo de las cuentas y sus lecturas',
      'app/api/integraciones/cuentas/route.ts y app/integraciones/CuentasDePago.tsx — la lista de cuentas en Integraciones',
      'lib/cobros.ts (`cuentaVivaDelCobro`), lib/cobros-webhook.ts (`deOtraCuenta`) — cada cobro con su cuenta',
      'supabase/migrations/0328_cobro_por_cuenta.sql — antes del deploy',
      'tests/cuentas-pago.test.ts — 17, probado con 29 roturas',
    ],
    revisar: '/integraciones?ws=3',
  },
  {
    fecha: '23 oct', hora: '00:56', chat: 'Cobros', sesion: 'local_460ff1f0-0675-4371-b228-594a9bd828e3', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Varias cuentas de Calendly y Cal.com: la reserva de cada una entra, y «Asignar evento» las lista con su nombre',
    puntos: [
      'En Integraciones, el modal de Calendly y el de Cal.com listan «Tus cuentas», como Stripe y MP: conectar otra con un nombre (la clave se prueba antes de guardarla), renombrar y desconectar una sola.',
      'La reserva de la segunda cuenta se verifica con SU secreto: con uno solo por negocio daba «firma rechazada», y Calendly apaga la suscripción después de varios rechazos.',
      '«Asignar evento» trae los tipos de evento de todas las cuentas, cada uno con el nombre de su cuenta; crear va a la cuenta elegida y editar usa la que tiene el evento. Cancelar la reunión de un lead la busca en todas.',
      '⚠️ **Sin hacer:** la pantalla de «Asignar evento» agrupada por cuenta es del CRM (los datos ya llegan); el link de la R1/R2 y las herramientas de agenda del doer siguen con la principal.',
    ],
    commits: [
      { sha: 'ee1abc6a9', msg: 'Agenda: varias cuentas de Calendly y Cal.com en un negocio (fase B, parte 1)', lineas: 679, archivos: 16 },
    ],
    archivos: [
      'lib/cuentas-agenda-server.ts — las cuentas de agenda, sus tokens y sus secretos',
      'app/api/webhooks/calendly y calcom — cada aviso con el secreto de su cuenta (`cuentaQueFirmo`)',
      'lib/agenda-evento-etapa-server.ts — «Asignar evento» por cuenta (`cuenta`, `cuentaNombre`)',
      'tests/cuentas-agenda.test.ts — 6, probado con 17 roturas',
    ],
    revisar: '/integraciones?ws=3',
  },
  {
    fecha: '23 oct', hora: '02:45', chat: 'Cobros', sesion: 'local_460ff1f0-0675-4371-b228-594a9bd828e3', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: '«Vincular cobro» muestra los productos de Stripe con su precio',
    puntos: [
      'En la llamada, Mauricio conectó Stripe y su producto de US$270 no aparecía en «Vincular cobro». MaKo nunca leía los productos de Stripe: la clave andaba bien.',
      'Ahora aparecen los productos de cada cuenta de Stripe con su precio, y «Volver a leer» los trae sin recargar. Elegir uno lo suma al catálogo y lo vincula a Ganado.',
      'Si en MaKo hay un producto con el mismo nombre y sin precio, recibe el de Stripe. Si ya cobra otra cosa, no se toca y se dice.',
      '⚠️ **Sin hacer:** los pagos que entran por el link de pago propio de Stripe (el de su landing) todavía no pasan a Ganado.',
    ],
    commits: [
      { sha: '5ddbaf1aa', msg: 'Cobros: los productos de Stripe en «Vincular cobro», en vivo, y traer uno al catálogo con su precio', lineas: 548, archivos: 6 },
    ],
    archivos: [
      'lib/stripe-catalogo.ts y lib/stripe-catalogo-reglas.ts — leer los precios y traer uno',
      'app/crm/cobro-etapa-actions.ts — las dos acciones del pop-up (la pantalla es del CRM)',
      'tests/stripe-catalogo.test.ts — 7, probado con 20 roturas',
    ],
    revisar: '/crm?ws=3',
  },
  {
    fecha: '24 oct', hora: '21:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Los planes tienen que VENDER: sin lenguaje interno, el acompañamiento diferencial y el personalizado con promesa',
    pedido: 'La sección de planes no se entiende para nada... Lo hiciste con lenguaje interno, las personas no saben que es "Ops Center" y muchas otras cosas... Tienes que VENDER, Revisa como lo hacen otras paginas... Y sobre todo el acompañamiento debe tener mas beneficios y verse diferencial, porque sino no tiene sentido. El personalizado tiene que tener un factor de PROMESA de resultados, ya no solo software.',
    puntos: [
      'Punto 2 de «Partners y Planes» de docs/feedback-24-10.md.',
    ],
    revisar: '/planes',
  },
  {
    fecha: '24 oct', hora: '21:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Planes que venden: sin lenguaje interno, y el acompañamiento en un bloque distinto con todo lo que trae',
    puntos: [
      'La página de planes y la sección de precios de la landing muestran los MISMOS tres bloques, copiados de ClickFunnels y Kajabi.',
      'Arriba de cada plan, cómo se trabaja: «Lo haces tú, con MaKo» (Esencial y Pro) o «Lo armamos contigo» (el Acelerador). Una frase dice para qué etapa es cada uno.',
      'Ya no aparece «Ops Center», «Offer», «Closing Analyst», «funnel» ni «leads»: cada renglón dice lo que la persona consigue.',
      'El Acelerador va en un bloque oscuro con «Con acompañamiento» y todo lo que trae: el embudo armado en la primera semana, la IA conectada, tu asesoría semanal, las grabaciones, las plantillas, el grupo y MaKo Pro.',
      'Abajo, la comparación por grupos y las preguntas de siempre («¿qué plan me conviene?»).',
      'Falta lo tuyo: «el personalizado» no existe en MaKo. Te pregunté por el Ops Center si es el 1 a 1 de US$4.000 y qué resultado promete; con tu respuesta se suma el bloque o la promesa.',
      'No puse la «garantía de 14 días» del documento de ofertas: la política publicada dice que el mes pagado no se devuelve.',
    ],
    commits: [
      { sha: '276b0f81b', msg: 'Planes que venden: sin lenguaje interno, el acompañamiento distinto y con todo lo que trae', lineas: 514, archivos: 7 },
    ],
    archivos: [
      'app/planes/Tarjetas.tsx — los tres bloques, los mismos en /planes y en la landing',
      'app/planes/Vitrina.tsx — /planes: arriba, los bloques, la comparación y las preguntas',
      'lib/planes-mako.ts — lo que incluye cada plan, dicho para el cliente; la promesa del programa (vacía)',
      'lib/planes-comparacion.ts — la comparación por grupos, sin nombres de tabs',
      'tests/planes-tres-bloques.test.ts — la guarda del lenguaje interno; 10 roturas, cada una cae',
    ],
    revisar: '/planes',
  },
  {
    fecha: '25 oct', hora: '06:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El Acelerador con promesa, garantía de entrega y un diagnóstico de 2 minutos antes de la llamada',
    puntos: [
      'Lo pediste el 24/10: «El personalizado tiene que tener un factor de PROMESA de resultados». El Cerebro decidió que el personalizado es el Acelerador.',
      'La tarjeta dice la promesa arriba del botón: en 90 días, tu embudo andando en MaKo, con tus primeras llamadas agendadas desde ahí.',
      'Abajo del botón, la garantía de entrega: si en la primera semana el embudo no está armado, se devuelve la cuota y no se pagan las que siguen. Es sobre lo que armamos, no sobre lo que vende.',
      'Cada entregable lleva su tope: hasta 10 horas de nuestro equipo en la semana 1 y 12 asesorías grupales. Las 10 horas salen de Mercately; si quieres otro número, es una línea.',
      'La página de reembolsos dice la misma garantía, qué cuenta como «armado» y cómo se pide.',
      'Antes de dejar sus datos, quien pide el Acelerador contesta 3 preguntas, una por pantalla: cuánto factura, cuánto invierte y qué lo traba. Las respuestas te llegan en el mail del pedido y quedan en su ficha.',
    ],
    commits: [
      { sha: '34b09f6b2', msg: 'Planes › el Acelerador con promesa, garantía de entrega y el diagnóstico como puerta', lineas: 330, archivos: 14 },
    ],
    archivos: [
      'lib/planes-mako.ts — la promesa, la garantía y los topes del programa',
      'app/planes/Tarjetas.tsx — la promesa arriba del botón y la garantía abajo',
      'app/reembolsos/page.tsx — §2, la garantía de entrega',
      'app/planes/[plan]/QuieroPlan.tsx — el diagnóstico, una pregunta por pantalla',
      'lib/compra-plan-reglas.ts y lib/compra-plan.ts — las respuestas, al historial del lead y al mail',
      'tests/planes-tres-bloques.test.ts y tests/planes-sin-pasarela.test.ts — 11 roturas, cada una cae',
    ],
    revisar: '/planes/acelerador',
  },
  {
    fecha: '25 oct', hora: '08:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El plan anual con 2 meses gratis, garantía de 14 y 30 días, pago en pesos y el media buyer en Esencial',
    puntos: [
      'Arriba de los planes, el selector Mensual / Anual: el anual son 2 meses gratis (US$470 Esencial, US$970 Pro). Está en /planes y en la landing.',
      'El anual se pide siempre (el cobro en línea es por mes): deja el pedido en el CRM diciendo «anual», y se da de alta a mano.',
      'Debajo de cada botón, la garantía: 14 días en el mensual y 30 en el anual. La página de reembolsos dice lo mismo; antes decía que el mes pagado no se devolvía.',
      'Abajo: «Desde Argentina pagas en pesos, con Mercado Pago». El precio en pesos aparece cuando le cargues uno al plan: no se calcula con ningún cambio.',
      'Esencial suma tu media buyer con IA: 2 recomendaciones por día para los anuncios, y el negocio decide si las aplica. Está en la comparación.',
      'Sin plan Agencia aparte, como decidiste el 10/10.',
      'Ojo: la garantía vale para el primer pago de cada negocio, una vez. Eso lo agregué yo; si no lo quieres, es una frase.',
    ],
    commits: [
      { sha: 'a64dfcb67', msg: 'Planes › el anual con 2 meses gratis, la garantía de 14 y 30 días, los pesos y el media buyer de Esencial', lineas: 353, archivos: 18 },
    ],
    archivos: [
      'app/planes/Tarjetas.tsx — el selector, la garantía de cada período y la línea de los pagos',
      'app/planes/[plan]/page.tsx — el anual, siempre por pedido',
      'app/reembolsos/page.tsx — §1, la garantía de 14 y 30 días',
      'lib/topes-plan.ts — las 2 recomendaciones por día del media buyer de Esencial',
      'tests/planes-tres-bloques.test.ts — 17 roturas, cada una cae',
    ],
    revisar: '/planes',
  },
  {
    fecha: '25 oct', hora: '10:20', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'La prueba gratis de 7 días con tarjeta, en lugar de la garantía de devolución',
    pedido: 'quiero implementar la prueba gratuita de 7 días, y eliminar la garantia de devolución que pusiste "Garantía de 14 días en el plan mensual y de 30 en el anual." y claro, para darte de alta en la prueba gratuita debes poner la tarjeta, tal cual como una suscripción, y se te cobra automático luego de esos 7 días... Lo único es que hay que evaluar que funciones le damos acceso en esos 7 días, porque de pronto se vienen y generan un montón de videos o cosas así y se dan de baja antes',
    puntos: ['Lo trajo el Cerebro, con los topes de la prueba, la regla de una prueba por negocio, tarjeta y email, y el aviso 2 días antes.'],
    revisar: '/planes',
  },
  {
    fecha: '25 oct', hora: '13:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: '7 días gratis con tarjeta: el cobro solo el día 8, el aviso, la baja sin cobro y los topes de la prueba',
    puntos: [
      'Se fue la garantía de 14/30 días. Junto a cada precio dice «7 días gratis», y debajo del botón «Después US$ 97/mes. Cancela cuando quieras antes del día 8».',
      'La prueba es una suscripción de Mercado Pago: la tarjeta se carga al empezar, la cuenta se crea en ese momento y Mercado Pago cobra solo el día 8. Dos días antes le llega un email.',
      'Darse de baja desde «Tu plan» durante la prueba no cobra nada, y usa MaKo hasta el día 8.',
      'Una prueba por negocio, email y tarjeta. Quien ya la usó lo lee claro y puede empezar sin prueba.',
      'En la prueba: hasta 3 videos armados (y 30 tomas sueltas), 1 video con avatar, 20 imágenes y 1 página publicada. Exportar los leads espera al primer cobro. CRM, chats, automatizaciones y Plan, enteros.',
      'Al llegar a un tope: «Disponible al terminar tu prueba» y «Empezar mi plan ya», que cobra desde hoy y cierra la prueba cuando ese pago entra.',
      'Ojo: las 30 tomas las puse yo (un anuncio usa unas 10). Falta aplicar la migración 0334, y que el Media Buyer niegue el piloto automático en la prueba.',
    ],
    commits: [
      { sha: '167f9299f', msg: 'Planes › 7 días gratis en lugar de la garantía de 14 y 30 días', lineas: 147, archivos: 9 },
      { sha: '3e59515a4', msg: 'Planes › la prueba gratis de 7 días: tarjeta al empezar, alta al autorizar, cobro el día 8, aviso y baja', lineas: 786, archivos: 24 },
      { sha: 'bb07232f5', msg: 'Planes › los topes de la prueba gratis y «Empezar mi plan ya»', lineas: 656, archivos: 24 },
    ],
    archivos: [
      'lib/prueba-plan-reglas.ts y lib/prueba-plan.ts — qué es una prueba, la huella, el aviso',
      'lib/cobros.ts — la prueba al autorizar, la baja, «empezar ya»',
      'lib/topes-plan.ts y lib/prueba-uso.ts — los topes de la prueba',
      'app/configuraciones/plan — «Tu plan» en prueba, con «Empezar mi plan ya»',
      'tests/prueba-plan.test.ts y tests/prueba-topes.test.ts — 39 roturas, cada una cae',
    ],
    revisar: '/planes',
  },
  {
    fecha: '25 oct', hora: '15:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El cartel de «versión limitada» de Madgicx, para la prueba gratis de MaKo',
    pedido: 'Me gusta el cartel de "limited version" de 7 días de madgicx para implementar en la prueba gratuita de MaKo',
    puntos: ['Lo trajo el Cerebro con las capturas de Media Buyer, y la regla del mismo día: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API».'],
    revisar: '/planes',
  },
  {
    fecha: '25 oct', hora: '15:30', chat: 'Planes', sesion: 'local_fbd605d7-daed-4eae-9368-02bd8708764c', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El cartel de la versión de prueba, la franja de cada tope, y la prueba en la API',
    puntos: [
      'Al pie de la barra lateral, en todas las pantallas: «Versión de prueba · quedan 5 días», lo que se cobra después y «Pasar al plan ya». Con los colores de MaKo, claro y oscuro.',
      'Arriba de Video Generator, AI Avatar y Web Generator: «Usaste 1 de 3 videos armados de la prueba», con su botón. Como en Madgicx, la prueba limita cantidades, no pantallas.',
      'En el teléfono: el cartel en «Más», un aviso corto arriba de cada pantalla y «Empezar mi plan ya» en «Tu plan».',
      'Por la API de MaKo: ver la prueba (días, qué se cobra, topes usados), empezar el plan ya (se confirma en pantalla) y cancelarla sin cobro.',
      'De paso: la guarda de la doc de la API frenaba el push con la doc al día (pasó 1 MB). Ya no.',
    ],
    commits: [
      { sha: '2be1805b9', msg: 'Planes › el cartel de la versión de prueba (como Madgicx) y la prueba en la API', lineas: 645, archivos: 26 },
    ],
    archivos: [
      'app/_components/CartelPrueba.tsx — el cartel de la barra lateral',
      'app/_ui/FranjaPrueba.tsx — la franja de cada pantalla con tope',
      'app/m/_prueba/PruebaM.tsx — el cartel y el aviso del teléfono',
      'lib/api-mako/areas/negocio.def.ts y .run.ts — ver_mi_prueba y empezar_mi_plan_ya',
      'tests/prueba-cartel.test.ts — 17 roturas, cada una cae',
    ],
    revisar: '/video-generator',
  },
  {
    fecha: '5 nov', hora: '17:00', chat: 'Creem › Revisión', sesion: 'cli_a3ba5ed6-c0ff-5a7c-bc38-e7c9878ab62b', cuenta: 'nube',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Dejar el sitio listo para la revisión de Creem',
    pedido: 'Dejá el sitio listo para la revisión de Creem. Leé docs/creem-retiros.md y estas páginas oficiales: docs.creem.io/merchant-of-record/account-reviews/account-reviews, .../re-review-guide, .../rejected-accounts y .../ai-wrapper-compliance. 1. Revisá contra esos requisitos, uno por uno, lo que sirve hola-mako.com: dominio, producto, /terminos, /privacidad, /planes, /reembolsos, /soporte, el correo de contacto. El nombre del responsable tiene que coincidir en todas (lib/titular-mako.ts). 2. /aup redirige a /login: hace falta una política de uso aceptable pública, enlazada desde el pie del sitio y de los términos, sin sesión, escrita para lo que MaKo hace de verdad (imagen, video, AI Avatar, copy, mensajes a leads). 3. Integrá el Moderation API de Creem donde se genera imagen o video desde un prompt, si su documentación lo exige para este caso: Image Editor, Video, AI Avatar, carruseles. Mirá lib/model-catalogo.ts. Un prompt rechazado muestra un mensaje claro. Si la moderación falla por un error de Creem, no se cae la generación. Hay que proteger la clave y no gastar de más: cada llamada, medida. 4. Medí si AI Avatar puede leerse como «manipulación de rostros», que Creem prohíbe, y qué haría falta. No lo apagues: es una decisión de Martín. Dejá el análisis y un borrador de la consulta a soporte de Creem en tu relevo.',
    puntos: ['Llegó como encargo a una sesión de la nube, que entrega por punta/creem-revision.'],
    revisar: '/aup',
  },
  {
    fecha: '5 nov', hora: '18:00', chat: 'Creem › Revisión', sesion: 'cli_a3ba5ed6-c0ff-5a7c-bc38-e7c9878ab62b', cuenta: 'nube',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La política de uso aceptable pública, Creem en las legales y la moderación antes de generar imagen o video',
    puntos: [
      '/aup: la política de uso aceptable, pública y sin cuenta, escrita para lo que MaKo hace (imagen, video, AI Avatar, mensajes a contactos). Enlazada desde el pie de la landing, el de cada página legal, los términos y el soporte.',
      'Cada página legal termina con las demás, el correo y la razón social: el mismo responsable en todas.',
      'Términos, privacidad, reembolsos y soporte nombran a Creem, que cobra desde Latinoamérica.',
      'Antes de generar una imagen o un video, el texto pasa por la moderación de Creem. Si lo rechaza, no se genera, no se gasta nada y la persona ve por qué. Si Creem no contesta, se genera igual y queda anotado.',
      'Cada llamada a Creem queda medida en el uso de la plataforma; el mismo pedido no se paga dos veces.',
      'AI Avatar no se tocó: el análisis y la consulta a soporte de Creem están en el relevo.',
    ],
    archivos: [
      'lib/creem-moderacion-reglas.ts — lo que decide la moderación (puro, con test)',
      'lib/creem-moderacion.ts — la clave de la plataforma, el recuerdo y la medición',
      'lib/flow-cola.ts — `encolar` modera todo lo que genera imagen o video',
      'app/aup/page.tsx — la política de uso aceptable',
      'app/_legal/LegalShell.tsx — el pie compartido de las legales',
      'docs/relevo/nube-creem-revision.md — los requisitos con su estado, lo que le toca a Martín y el análisis de AI Avatar',
      'tests/creem-moderacion.test.ts y tests/creem-revision-sitio.test.ts — 11 roturas, cada una cae',
    ],
    revisar: '/aup',
  },
];
