// =============================================================================
// /ads-manager/<ad_id> — el link viejo a un anuncio: lleva a /anuncio/<ad_id>
// =============================================================================
// Hasta el 25/10/2026 abría la réplica de Meta Ads Manager con ese anuncio abierto. La réplica se reemplazó por el Media
// Buyer (app/ads-manager/page.tsx), que no tiene tabla de anuncios, y los links que ya se mandaron (avisos, CRM, MaKo)
// siguen apuntando acá: van a la página del anuncio solo, que muestra lo mismo. Con el `?ws=` (rutaConWs): un link viejo
// abierto mirando a un cliente no puede sacar del cliente.
// =============================================================================

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function AnuncioViejoPage({ params }: { params: Promise<{ adId: string }> }) {
  const { adId } = await params;
  const id = /^\d{1,30}$/.test(adId) ? adId : '';
  redirect(await rutaConWs(id ? `/anuncio/${id}` : '/ads-manager'));
}
