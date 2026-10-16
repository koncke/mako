// =============================================================================
// ficha/reglas-pagos — las reglas PURAS de los bloques de la tab Pagos
// =============================================================================
// Los componentes van en ./registro-pagos.tsx. Son del frente de Pagos (ver ./tipos.ts).
//
// HOY (14/10/2026) `venta` es DealDetailsCard ENTERA (la venta, lo cobrado, las cuotas, la suscripción, los
// links de pago, el contrato y el resto del deal), con su «Editar deal →» abajo. El diseño saca ese link
// cuando cada bloque escriba su propio campo (§3, Pagos): guardar el deal hoy reemplaza sus datos enteros.
// La tarjeta ya decide sola qué dibujarle a un lead sin compra (sólo los links, `tieneDeal`).
// =============================================================================

import type { ReglasDeTab } from './tipos';

export const REGLAS_PAGOS = {
  oferta: {},
  venta: {
    incluye: ['links-de-pago', 'cobrado', 'cuotas', 'suscripcion', 'contrato', 'datos-fiscales', 'servicio-vendido', 'promesa-y-garantia', 'obligaciones'],
  },
} satisfies ReglasDeTab;
