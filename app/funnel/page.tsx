// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getPipelineStages, getFunnelTransitions } from '@/lib/leads';
import { DEFAULT_STAGES, DEFAULT_TRANSITIONS } from '@/lib/pipeline';
import { FunnelEditor } from './FunnelEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnelPage() {
  const [stages, transitions] = await Promise.all([
    getPipelineStages().catch(() => DEFAULT_STAGES),
    getFunnelTransitions().catch(() => DEFAULT_TRANSITIONS),
  ]);

  return <FunnelEditor initialStages={stages} initialTransitions={transitions} />;
}
