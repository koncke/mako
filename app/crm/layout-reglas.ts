// =============================================================================
// Qué rutas del CRM REDIRIGEN, para que lo haga app/crm/layout.tsx ANTES del loader (25/10/2026)
// =============================================================================
// `app/crm/loading.tsx` es un Suspense que envuelve a TODAS las páginas de /crm. Un `redirect()` de una página no es un
// 307: va adentro del stream (200 + meta refresh) y queda en carrera con la hidratación del router de Next, que a veces se
// cae con «Minified React error #310» (ticket #7 en /general, ticket #9 en /web-generator; docs/hallazgos-infra.md). El
// layout queda AFUERA del loader: lo que redirige ahí sale con el 307 de siempre.
//
// ⚠️ NO SÓLO LOS `redirect()` A LA VISTA: las puertas de lib/tab-access.ts también redirigen por dentro —`requireCapa`
// (no está en tu plan), `guardOnboarding` (a terminar el onboarding), `requireRolWs` (a la casa del plan)—, y un
// guard que busca `redirect(` en la página no las ve. Cada ruta, con LA MISMA puerta de su página:
//   · /crm, /crm/new y la ficha /crm/<id>: el CRM en el plan y el onboarding terminado;
//   · /crm/prospectos: closer o setter (o admin), con el CRM;
//   · /crm/<id>/resumen: el CRM en el plan, SIN onboarding (se abre desde un WhatsApp con la reunión encima), y el super
//     admin que abre un lead de OTRO negocio va al negocio del lead (`?ws=`);
//   · /crm/revisar y /crm/revisar/<id>: sin sesión, a /inicio.
// Las páginas conservan sus puertas: si se llega navegando, el layout no se vuelve a dibujar. Es puro: lo ejecuta
// tests/crm-redirige-antes-del-loader.test.ts.

export type RedireccionCrm =
  | { tipo: 'tab' }
  | { tipo: 'prospectos' }
  | { tipo: 'resumen'; leadId: number }
  | { tipo: 'pide-sesion' }
  | null;

/** La ruta la pone el proxy (lib/pedido-actual.ts); sin ella no se adivina: null, el layout no hace nada. */
export function redireccionDelLayoutCrm(ruta: string | null): RedireccionCrm {
  if (!ruta) return null;
  if (ruta === '/crm' || ruta === '/crm/new' || /^\/crm\/\d+$/.test(ruta)) return { tipo: 'tab' };
  if (ruta === '/crm/prospectos') return { tipo: 'prospectos' };
  if (ruta === '/crm/revisar' || /^\/crm\/revisar\/[^/]+$/.test(ruta)) return { tipo: 'pide-sesion' };
  const m = /^\/crm\/(\d+)\/resumen$/.exec(ruta);
  return m ? { tipo: 'resumen', leadId: Number(m[1]) } : null;
}

/** El resumen del lead en el negocio del lead. Lo usan el layout y la página: el mismo destino. */
export const destinoDelResumen = (leadId: number, ws: number): string => `/crm/${leadId}/resumen?ws=${ws}`;
