// =============================================================================
// /planes — los planes de MaKo, para comprar sin hablar con nadie (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida». Los
// planes y sus precios salen de lib/planes-mako.ts (el setting `planes.mako` de la plataforma, o los de hoy).
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): sólo GET, no lee cookies, sin <Suspense> (AGENTS.md: el contenido de una página
// pública se lee sin JavaScript). Lo que la landing manda en la URL (de dónde viene la persona y el código de MaKo
// Partners) pasa tal cual al plan elegido: la página no lo guarda, lo guarda el cobro al pagar.
// =============================================================================

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { entornoPromo, promoVigente } from '@/lib/promo-entrada';
import { COOKIE_PROMO } from '@/lib/promo-entrada-reglas';
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { paisDelVisitante } from '@/lib/compra-plan-reglas';
import { VitrinaPlanes } from './Vitrina';
import { BarraGlobal } from '../vsl/_sitio/Barra';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Planes de MaKo', robots: { index: true, follow: true } };

/** Lo que se pasa de la URL al plan elegido (el origen y el código de partner). Sólo estas claves, sin tocarlas. */
const CLAVES_QUE_PASAN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ref'];

/** ¿El reloj del 50% sigue vivo en este navegador? Sólo lo lee: lo arranca la landing. */
const relojVivo = (cookie: string | undefined) => promoVigente(cookie, Date.now(), entornoPromo());

export default async function PlanesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of CLAVES_QUE_PASAN) {
    const v = sp[k];
    if (typeof v === 'string' && v.trim()) qs.set(k, v.trim().slice(0, 250));
  }
  const sufijo = qs.toString() ? `?${qs.toString()}` : '';
  // SIN PASARELA (23/10/2026): un plan que no se puede pagar en línea no dice «Empezar»: lleva a su página, donde se pide
  // (desde el 24/10, sin agenda: lib/compra-plan-reglas.ts). Se decide por plan, con la misma cuenta que el checkout.
  // Y según el PAÍS (27/10/2026): Mercado Pago sólo en el suyo; desde México, «Empezar» sólo si Stripe cobra.
  const ofertas = await ofertasDeLosPlanes(paisDelVisitante((await headers()).get('x-vercel-ip-country')));
  // El origen de la campaña y el código de partner viajan en el sufijo al plan elegido, y de ahí al pedido o al pago.
  // Con la barra del sitio arriba (12/11/2026): «Precios» de la barra trae acá, y desde acá se sigue navegando.
  return (
    <>
      <BarraGlobal claro />
      <VitrinaPlanes ofertas={ofertas} sufijo={sufijo} promoVigente={relojVivo((await cookies()).get(COOKIE_PROMO)?.value)} />
    </>
  );
}
