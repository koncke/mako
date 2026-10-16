// =============================================================================
// ficha/plantillas-pagos — las plantillas de la tab PAGOS para la galería «¿Qué vas a crear hoy?»
// =============================================================================
// Pedido de Martín (16/10/2026, por Cerebro): cada tab de la ficha tiene sus plantillas, y una tab que nunca se
// configuró las ofrece con «¿Qué vas a crear hoy?», con las «Sugerido» para el negocio primero. La galería es del
// CRM (lib/ficha/plantillas-tab.ts, su tanda que viene); el contenido de Pagos es de acá.
//
// El criterio de las cuatro es el del pedido: «que se entienda de un vistazo: qué debe este lead, qué pagó, qué hago
// ahora (un botón claro por acción)». Por eso TODAS arrancan con el estado de cuenta, y cada una suma sólo lo que su
// manera de vender necesita:
//   · «Cobrar una venta»: un pago (o pocos), sin contrato. Lo de vender por carrito, formulario o chat.
//   · «Mensualidad»: la suscripción manda (cuánto por mes, si está al día, los meses cobrados).
//   · «Venta con contrato»: el high-ticket de llamada, con el plan de cuotas y todo lo que se vendió.
//   · «De un vistazo» (épica): un número gigante y su botón, la próxima cuota y el link a mano.
// Un bloque sin datos se calla (./reglas-pagos.ts), así que un lead abierto ve la oferta y los links.
//
// ⚠️ EL TIPO es el de lib/ficha/plantillas-tab.ts (del CRM), importado: el contrato acordado el 16/10/2026. La galería
//    importa ESTA lista de vuelta (un ciclo sólo de tipos, que no existe en el JavaScript).
// ⚠️ tests/plantillas-pagos.test.ts fija que cada bloque tenga componente, su ancho sea uno de los del catálogo y su
//    diseño uno de los que el bloque sabe dibujar.
//
// Puro, sin `server-only` ni `'use client'`: lo leen la galería, la API de MaKo y los tests.
// =============================================================================

import type { PlantillaTab } from './plantillas-tab';

export type { PlantillaTab };

export const PLANTILLAS_TAB_PAGOS: PlantillaTab[] = [
  {
    id: 'pagos-cobrar-una-venta', tab: 'pagos', nombre: 'Cobrar una venta',
    bajada: 'Qué debe, el link para cobrarle y lo que ya pagó.',
    sugeridaPara: ['carrito', 'formulario-meta', 'landing', 'prospeccion'],
    bloques: [
      { id: 'cobrado', ancho: 6, diseno: 'numero' },
      { id: 'venta', ancho: 6, diseno: 'cajas' },
      { id: 'oferta', ancho: 12 },
      { id: 'links-de-pago', ancho: 12, diseno: 'lista' },
      { id: 'cuotas', ancho: 12, diseno: 'tabla' },
      { id: 'movimientos', ancho: 12, diseno: 'ultimos' },
    ],
  },
  {
    id: 'pagos-mensualidad', tab: 'pagos', nombre: 'Mensualidad',
    bajada: 'Cuánto paga por mes, si está al día y los meses cobrados.',
    sugeridaPara: ['evento', 'te-escriben'],
    bloques: [
      { id: 'cobrado', ancho: 6, diseno: 'numero' },
      { id: 'suscripcion', ancho: 6, diseno: 'numero' },
      { id: 'movimientos', ancho: 12, diseno: 'lista' },
      { id: 'links-de-pago', ancho: 12, diseno: 'pendiente' },
      { id: 'venta', ancho: 6, diseno: 'renglon' },
      { id: 'oferta', ancho: 6 },
    ],
  },
  {
    id: 'pagos-venta-con-contrato', tab: 'pagos', nombre: 'Venta con contrato',
    bajada: 'El plan de cuotas, el contrato y todo lo que se vendió.',
    sugeridaPara: ['una-llamada', 'dos-reuniones', 'respaldo'],
    bloques: [
      { id: 'cobrado', ancho: 6, diseno: 'numero' },
      { id: 'venta', ancho: 6, diseno: 'cajas' },
      { id: 'cuotas', ancho: 12, diseno: 'tabla' },
      { id: 'oferta', ancho: 12 },
      { id: 'links-de-pago', ancho: 12, diseno: 'lista' },
      { id: 'movimientos', ancho: 12, diseno: 'ultimos' },
      { id: 'contrato', ancho: 6, diseno: 'franja' },
      { id: 'promesa-y-garantia', ancho: 6, diseno: 'cajas' },
      { id: 'servicio-vendido', ancho: 12, diseno: 'grilla' },
      { id: 'obligaciones', ancho: 12, diseno: 'listas' },
      { id: 'datos-fiscales', ancho: 12, diseno: 'grilla' },
    ],
  },
  {
    id: 'pagos-de-un-vistazo', tab: 'pagos', nombre: 'De un vistazo', epico: true,
    bajada: 'Lo que debe, en grande, y el botón de lo que toca.',
    bloques: [
      { id: 'cobrado', ancho: 12, diseno: 'numero' },
      { id: 'cuotas', ancho: 12, diseno: 'proxima' },
      { id: 'links-de-pago', ancho: 12, diseno: 'pendiente' },
    ],
  },
];
