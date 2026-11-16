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
import { PieGlobal } from '../vsl/_sitio/Barra';

export const metadata: Metadata = { title: 'MaKo Partners: llévate el 100% del primer mes de cada negocio que traigas', robots: { index: true, follow: true } };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Con el pie del sitio abajo (15/11/2026, Martín: «la bottom bar… debería estar en todas las landing, todas las rutas»). Claro, como la
 * página. Su renglón chico «Planes de MaKo · Términos» (`.mp-pie`, el pie que tenía antes) se oculta: no es un <footer> y `PieGlobal`
 * no lo ve, y quedaban dos pies uno encima del otro (16/11/2026). Precios y Términos ya están en el del sitio.
 */
export default function MakoPartnersPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: '.mp-publica .mp-pie{display:none}' }} />
      <LandingPartners />
      <PieGlobal claro />
    </>
  );
}
