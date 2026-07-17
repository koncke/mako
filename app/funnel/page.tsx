// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getFunnel } from '@/lib/leads';
import { FunnelEditor } from './FunnelEditor';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnelPage() {
  await requireRolWs([], { nav: 'crm' });
  const { pipeline, suppressed } = await getFunnel();
  return <FunnelEditor initialPipeline={pipeline} initialSuppressed={suppressed} />;
}
