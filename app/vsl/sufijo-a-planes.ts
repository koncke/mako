// =============================================================================
// Lo que la URL de una página de venta le pasa a los botones de cada plan: el origen de la campaña y el código de partner
// =============================================================================
// Puro y SIN React (15/11/2026): lo usan la landing de Web Generator (app/vsl/PreciosLanding.tsx, que lo reexporta) y la
// portada (app/page.tsx, para que sus columnas pasen lo mismo que las de /planes). Vivía adentro de PreciosLanding.tsx, que
// importa `useState` y `useEffect`: una página del servidor que lo importara de ahí metería en el servidor un módulo con hooks,
// y el compilador de Next lo corta («You're importing a component that needs useState»).
// =============================================================================

/** Lo que se pasa de la URL de la landing a la página del plan. Sólo estas claves (las mismas que /planes). */
export const CLAVES_A_PLANES = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ref'] as const;

/** El sufijo para los botones: las claves de la URL actual que pasan, recortadas. Puro (lo prueba el test). */
export function sufijoDesdeUrl(search: string, landing: string | null): string {
  const de = new URLSearchParams(search);
  const qs = new URLSearchParams();
  for (const k of CLAVES_A_PLANES) {
    const v = de.get(k)?.trim();
    if (v) qs.set(k, v.slice(0, 250));
  }
  if (landing && !qs.has('landing')) qs.set('landing', landing);
  const s = qs.toString();
  return s ? `?${s}` : '';
}
