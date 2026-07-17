// =============================================================================
// /ads-manager — réplica de Meta Ads Manager (Campañas · Conjuntos · Anuncios)
// =============================================================================
// La pantalla vive en AdsManagerView (la comparte con /ads-manager/<ad_id>).
// =============================================================================

import { AdsManagerView } from './AdsManagerView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdsManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  return <AdsManagerView searchParams={searchParams} />;
}
