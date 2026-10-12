// =============================================================================
// pago-comprobante — ¿a esta cuota cobrada le falta el comprobante?
// =============================================================================
// Puro y SIN `server-only`: lo leen el server (la ficha, el worklist del CRM, la API de MaKo) y los
// tests. Antes eran CINCO copias del mismo predicado (`p.pagado && !p.comprobante_path`) en
// lib/queries.ts, app/crm/actions.ts, app/crm/[id]/page.tsx y lib/api-mako/areas/crm.helpers.ts, y
// lib/stage-requirements.ts consume la cuenta («Datos sin marcar: Comprobante de pago»).
//
// ⚠️ UN COBRO CONFIRMADO POR LA PASARELA NO PIDE COMPROBANTE SUBIDO (11/10/2026). La cuota que escribe
// Stripe o Mercado Pago (`registrarCobroDeProveedor`, lib/pagos.ts) trae `proveedor` y no trae archivo:
// la prueba del pago es el aviso firmado de la pasarela, no una foto. Con el predicado viejo, CADA
// lead que pagaba por link quedaba para siempre en «Datos sin marcar: Comprobante de pago» — un
// pendiente que nadie puede cerrar, porque no hay comprobante que subir.
//
// Los `select` que alimentan esto tienen que traer `proveedor` (mig 0255): sin la columna, el
// predicado vuelve a pedirle el comprobante a todo cobro de pasarela, sin ningún error.

export type CuotaConComprobante = {
  pagado: boolean;
  comprobante_path?: string | null;
  /** 'stripe' | 'mercadopago' si la confirmó una pasarela; null/ausente = cargada a mano. */
  proveedor?: string | null;
};

/** true = la cuota está cobrada, a mano, y nadie subió el comprobante. */
export const faltaComprobante = (p: CuotaConComprobante): boolean =>
  !!p.pagado && !p.comprobante_path && !p.proveedor;
