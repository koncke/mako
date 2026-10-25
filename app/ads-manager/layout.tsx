// =============================================================================
// /ads-manager — el layout: lleva el link viejo de un anuncio a /anuncio/<ad_id>, ANTES del loader
// =============================================================================
// Hasta el 25/10/2026 /ads-manager/<ad_id> abría la réplica de Meta Ads Manager con ese anuncio abierto; desde ese día la
// tab es el Media Buyer, que no tiene tabla de anuncios. Los links que ya se mandaron (la ficha del lead, los avisos) van a
// la página del anuncio solo. El redirect va ACÁ y no en la página: adentro del loading.tsx un redirect sale en el stream
// (200 + meta refresh) y en una carga directa tira el React #310 (tests/redirige-antes-del-loader.test.ts). El layout no
// sabe la ruta: la pone el proxy (lib/pedido-actual.ts).
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { pedidoActual } from '@/lib/pedido-actual';

export default async function MediaBuyerLayout({ children }: { children: ReactNode }) {
  const { ruta } = await pedidoActual();
  const m = /^\/ads-manager\/(\d{1,30})\/?$/.exec(ruta ?? '');
  if (m) redirect(await rutaConWs(`/anuncio/${m[1]}`));
  return children;
}
