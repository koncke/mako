// =============================================================================
// /onboarding — cargar el negocio en MaKo (hub) o el wizard de alta (bloqueante)
// =============================================================================
// Cliente con onboarding pendiente/salteado → el WIZARD completo (overlay:
// integraciones → El Archivero → tabs → Retro). Onboarding terminado (o el dueño /
// super admin sin impersonar) → el HUB con las tabs El Archivero + Funnel +
// Ángulos y avatares. Se accede desde el menú de la foto de perfil ("Onboarding").

import { Icon } from '../_components/icons';
import { OnboardingTabs } from './OnboardingTabs';
import { OnboardingWizard } from './OnboardingWizard';
import { FunnelEditor } from '../funnel/FunnelEditor';
import { requireRolWs } from '@/lib/tab-access';
import { getFunnel } from '@/lib/leads';
import { getEstadoOnboarding, pasosDeCapaActual } from '@/lib/onboarding-state';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OnboardingPage() {
  // gateOnboarding:false — esta ES la página del wizard, no puede redirigirse sola.
  await requireRolWs([], { gateOnboarding: false });

  // Gating (pedido de Mauricio): mientras el onboarding NO esté 'done' se ve el MODAL
  // secuencial (wizard) — NINGUNA tab — y al terminar se desbloquea el hub. Aplica
  // TAMBIÉN al dueño (Mauricio usa MaKo para su propio negocio): /api/onboarding ahora
  // resuelve el dueño → OWNER_WS, así que el wizard carga bien, y esAdmin=true le da los
  // atajos (saltar sin conectar) para no quedar trabado. Una capa sin pasos → hub.
  const estado = await getEstadoOnboarding();
  const pasos = await pasosDeCapaActual();
  const done = pasos.length === 0 || estado.status === 'done';
  if (!done) return <OnboardingWizard />;

  // Dueño / cliente ya onboardeado → el hub para cargar/editar el negocio.
  const { pipeline, suppressed } = await getFunnel();
  const funnelPanel = <FunnelEditor embedded initialPipeline={pipeline} initialSuppressed={suppressed} />;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="contexto" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Onboarding</h1>
      </header>
      <OnboardingTabs funnelPanel={funnelPanel} />
    </main>
  );
}
