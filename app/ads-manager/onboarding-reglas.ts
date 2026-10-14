// =============================================================================
// onboarding-reglas — qué pasos del onboarding del Ads Manager ya están (#801)
// =============================================================================
// Sin `server-only`, a propósito: la regla la prueba un test ejecutándola. La lectura
// (Meta, la credencial de la página) vive en ./onboarding-datos.ts.

export const PASOS_ADS = ['am_cuenta', 'am_pagina', 'am_campana'] as const;
export type PasoAds = (typeof PASOS_ADS)[number];

/**
 * Los pasos que lo que hay ya cumple, EN ORDEN y cortando en el primero que falta:
 * `marcarPasoTab` no deja cerrar uno con el anterior abierto, y una página guardada
 * sin la cuenta leída no sirve para anunciar.
 */
export function pasosCumplidos(h: { cuentaOk: boolean; paginaOk: boolean; campanas: number }): PasoAds[] {
  // Cada paso mira SÓLO lo suyo: la dependencia entre ellos la pone el corte de abajo,
  // en un solo lugar (repetida en cada condición, ninguna de las dos copias se podía probar).
  const cumple: Record<PasoAds, boolean> = {
    am_cuenta: h.cuentaOk,
    am_pagina: h.paginaOk,
    am_campana: h.campanas > 0,
  };
  const out: PasoAds[] = [];
  for (const p of PASOS_ADS) {
    if (!cumple[p]) break;
    out.push(p);
  }
  return out;
}

/** Dónde retoma el wizard: el primer paso sin hacer. */
export function pasoInicialAds(hechos: Partial<Record<PasoAds, boolean>>): 'cuenta' | 'pagina' | 'campana' {
  if (!hechos.am_cuenta) return 'cuenta';
  if (!hechos.am_pagina) return 'pagina';
  return 'campana';
}
