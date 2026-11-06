// =============================================================================
// Admin: un cobro de la plataforma ¿es un Checkout Link o un Checkout? (6/11/2026)
// =============================================================================
// En Polar, un Checkout Link es el LINK que alguien arma y comparte (Products › Checkout Links) y un Checkout es cada SESIÓN de
// pago (Sales › Checkouts). En MaKo, el link de «Vender un plan» (lib/vender-plan.ts) ES el cobro: tiene `alta_capa` y su
// `creado_por` es la persona que lo armó. Mostrarlo también en Checkouts era el mismo cobro dos veces (Martín: cada dato en UN
// lugar). Así que va SÓLO en Checkout Links, y en Checkouts los demás: lo que se compró desde /planes (`creado_por` «planes:…»),
// las renovaciones, los lugares de agencia, un cobro de una ficha.
//
// La regla vive acá y la usan las dos: `linksDeVenta` (productos.ts) y `checkoutsDe` (ventas.ts). Puro, con test.
// =============================================================================

/** ¿Lo armó una persona con «Vender un plan»? Los del checkout público de /planes llevan `creado_por` «planes:…». */
export const esDeVenderUnPlan = (c: { alta_capa: string | null; creado_por: string | null }): boolean =>
  !!c.alta_capa && !String(c.creado_por ?? '').startsWith('planes:')

/** Dónde vive un link de «Vender un plan» (Products › Checkout Links). */
export const rutaDeCheckoutLink = (id: number) => `/admin/products/checkout-links/${id}`
