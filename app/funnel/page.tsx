// =============================================================================
// /funnel — editor del funnel (etapas + transiciones) que alimenta el CRM
// =============================================================================

import { getFunnel } from '@/lib/leads';
import { FunnelEditor } from './FunnelEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FunnelPage() {
  const { stages, transitions } = await getFunnel();
  return <FunnelEditor initialStages={stages} initialTransitions={transitions} />;
}
