// =============================================================================
// /configuraciones — hub de ajustes: Notificaciones · Funnel · Onboarding
// =============================================================================
// El editor de prompts de MaKo se movió a "Contexto de MaKo".

import { Icon } from '../_components/icons';
import { ConfigTabs } from '../_components/ConfigTabs';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ConfiguracionesPage() {
  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="config" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Configuraciones</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Notificaciones, funnel y onboarding en un solo lugar.</p>
      <div style={{ maxWidth: 720 }}>
        <ConfigTabs />
        <NotificacionesPanel />
      </div>
    </main>
  );
}
