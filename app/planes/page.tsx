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
import { ofertasDeLosPlanes } from '@/lib/compra-plan';
import { codigoRefLimpio, origenLimpio } from '@/lib/compra-plan-reglas';
import { VitrinaPlanes } from './Vitrina';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = { title: 'Planes de MaKo', robots: { index: true, follow: true } };

/** Lo que se pasa de la URL al plan elegido (el origen y el código de partner). Sólo estas claves, sin tocarlas. */
const CLAVES_QUE_PASAN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'ref'];

export default async function PlanesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of CLAVES_QUE_PASAN) {
    const v = sp[k];
    if (typeof v === 'string' && v.trim()) qs.set(k, v.trim().slice(0, 250));
  }
  const sufijo = qs.toString() ? `?${qs.toString()}` : '';
  // SIN PASARELA (23/10/2026): un plan que no se puede pagar en línea no dice «Empezar»: lleva a la agenda, con las UTM
  // de la campaña (lib/compra-plan-reglas.ts). Se decide por plan, con la misma cuenta que el checkout.
  const ofertas = await ofertasDeLosPlanes();
  const origen = origenLimpio(Object.fromEntries(qs.entries()));
  const ref = codigoRefLimpio(qs.get('ref'));
  return <VitrinaPlanes ofertas={ofertas} sufijo={sufijo} origen={origen} refCodigo={ref} />;
}
