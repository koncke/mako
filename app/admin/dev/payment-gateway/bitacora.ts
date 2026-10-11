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
  { titulo: 'El cobro y su link estable', detalle: '`cobros` (mig 0250) · /pagar/<token> abre el checkout vivo: la sesión de Stripe vence y el link no', estado: 'hecha' },
  { titulo: 'Los avisos de la pasarela', detalle: 'Firma propia de cada una (Stripe no es Svix) · ruteo estricto · se relee el pago al proveedor antes de aplicar · dedup por evento · cron cada 30 min como red', estado: 'hecha' },
  { titulo: 'Alta automática al pagar un plan de MaKo', detalle: 'Sólo si el cobro es del workspace de la plataforma, en positivo · reclamo antes de crear (dos avisos no dan dos altas) · un email que ya es usuario no se toca solo', estado: 'hecha' },
  { titulo: 'Vender un plan desde /admin/cobros', detalle: 'Plan → pasarela (si hay dos) → monto → a quién → link · la lista con el estado del cobro y el de la cuenta', estado: 'hecha' },
  { titulo: 'Cobrar desde la ficha del lead y por la API de MaKo', detalle: 'La tab Pagos de la ficha (las tres puertas) y el área `cobros` de la API', estado: 'sigue' },
  { titulo: 'El primer cobro real, de punta a punta', detalle: 'Aplicar la migración 0250 y conectar la cuenta de MaKo en /integraciones del workspace de la plataforma', estado: 'cola' },
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
];
