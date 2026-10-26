// =============================================================================
// /mako-partners — la página pública del programa de referidos de MaKo (23/10/2026; landing de ventas, 24 y 25/10/2026)
// =============================================================================
// El diseño y el texto viven en LandingPartners.tsx (lo que se promete y lo que NO, ahí). Su botón lleva al alta corta de
// /partners (`RUTA_ALTA_PARTNERS`). Sin sesión, el login vuelve a /partners (proxy.ts guarda sólo la ruta en `?next`, no el
// `?alta=1`): ahí está la misma landing con el mismo botón, un clic más.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense>; se lee entera sin JavaScript.
// =============================================================================

import type { Metadata } from 'next';
import { LandingPartners } from './LandingPartners';

export const metadata: Metadata = { title: 'MaKo Partners: llévate el 100% del primer mes de cada negocio que traigas', robots: { index: true, follow: true } };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MakoPartnersPage() {
  return <LandingPartners />;
}
