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
];
