// =============================================================================
// /mako-partners — la página pública del programa de referidos de MaKo (23/10/2026; landing de ventas, 24/10/2026)
// =============================================================================
// El diseño y el texto viven en LandingPartners.tsx (lo que se promete y lo que NO, ahí). Acá sólo se averigua si MaKo
// cobra en línea, con la MISMA cuenta que /planes y el panel del partner (`ofertasDeLosPlanes`): sin eso, un referido no
// se registra solo y la página lo dice. «No pude leer» no afirma que no cobra (cae al texto de siempre).
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense>; se lee entera sin JavaScript.
// =============================================================================

import type { Metadata } from 'next';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { EMAIL_MAKO } from '@/lib/app-url';
import { LandingPartners } from './LandingPartners';

export const metadata: Metadata = { title: 'MaKo Partners: suma el primer mes de cada negocio que traigas', robots: { index: true, follow: true } };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MakoPartnersPage() {
  const cobraEnLinea = await ofertasDeLosPlanes().then((o) => o.some((x) => x.cobrable)).catch(() => true);
  return <LandingPartners cobraEnLinea={cobraEnLinea} emailMako={EMAIL_MAKO} />;
}
