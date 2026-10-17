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
];
