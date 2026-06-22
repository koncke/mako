// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getFunnel } from '@/lib/leads';
import { FunnelEditor } from './FunnelEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnelPage() {
  const { pipeline, suppressed } = await getFunnel();
  return <FunnelEditor initialPipeline={pipeline} initialSuppressed={suppressed} />;
}
