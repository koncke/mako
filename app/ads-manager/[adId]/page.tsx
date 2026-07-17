// =============================================================================
// /ads-manager/<ad_id> — el Ads Manager con UN anuncio abierto
// =============================================================================
// El deep link a un anuncio. El id es el ad_id de META (el mismo que usa la Graph
// API y el que ya viaja en senales.ad_id), y no un id interno: así el link se
// puede cruzar contra Meta y sobrevive a cualquier resync.
//
// Es la MISMA pantalla que /ads-manager, con el detalle del anuncio abierto: el
// browser ya trae el árbol entero, así que no hace falta una vista aparte ni una
// consulta distinta. Si el anuncio no está en el rango de fechas o no existe, el
// browser lo dice y te deja en la tabla (no rompe).
// =============================================================================

import { AdsManagerView } from '../AdsManagerView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdsManagerAdPage({
  params,
  searchParams,
}: {
  params: Promise<{ adId: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { adId } = await params;
  return <AdsManagerView searchParams={searchParams} adInicial={adId} />;
}
