// =============================================================================
// /configuraciones — hub de ajustes: Notificaciones · Identidades fiscales ·
// Teléfonos · Funnel · Onboarding · Equipo (TODO en el lugar, sin redirigir)
// =============================================================================
// Los paneles de Funnel/Onboarding/Equipo se resuelven acá (server) para que su
// data siga cargándose server-side y llegan embebidos a ConfigInnerTabs.

import { Icon } from '../_components/icons';
import { ConfigInnerTabs } from './ConfigInnerTabs';
import { FunnelEditor } from '../funnel/FunnelEditor';
import { OnboardingForm } from '../onboarding/OnboardingForm';
import { OnboardingWizard } from '../onboarding/OnboardingWizard';
import { EquipoView } from '../equipo/EquipoView';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnel } from '@/lib/leads';
import { getEstadoOnboarding } from '@/lib/onboarding-state';
import { getWorkspaceActual, OWNER_WS } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfiguracionesPage() {
  await requireRolWs([], { nav: 'configuraciones' });

  // Paneles embebidos (misma data que sus rutas propias, resuelta server-side).
  const { pipeline, suppressed } = await getFunnel();
  const funnelPanel = <FunnelEditor embedded initialPipeline={pipeline} initialSuppressed={suppressed} />;

  const ws = await getWorkspaceActual();
  let onboardingPanel: React.ReactNode;
  if (ws == null || ws === OWNER_WS) {
    onboardingPanel = <OnboardingForm embedded />;
  } else {
    const estado = await getEstadoOnboarding();
    onboardingPanel = estado.status === 'done' ? <OnboardingForm embedded /> : <OnboardingWizard />;
  }

  const equipoPanel = (
    <div>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 720 }}>Sumá a tu equipo y decidí qué ve cada uno. El <b>Closer</b> ve CRM, WhatsApp y Closing Analyst; el <b>Setter</b> ve CRM, WhatsApp y Email; el <b>Admin</b> ve todo tu negocio.</p>
      <EquipoView />
    </div>
  );

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="config" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Configuraciones</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Notificaciones, identidades fiscales, teléfonos y el resto de los ajustes en un solo lugar.</p>
      <ConfigInnerTabs funnelPanel={funnelPanel} onboardingPanel={onboardingPanel} equipoPanel={equipoPanel} />
    </main>
  );
}
