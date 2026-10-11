// =============================================================================
// /configuraciones — hub de ajustes: Notificaciones · Identidades fiscales · Equipo
// =============================================================================
// El Archivero, el Funnel y los Ángulos y avatares se mudaron a "Onboarding"
// (menú de la foto de perfil). Acá quedan los ajustes de la cuenta.

import { Icon } from '../_components/icons';
import { ConfigInnerTabs } from './ConfigInnerTabs';
import { EquipoView } from '../equipo/EquipoView';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ConfiguracionesPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  // (Acá se preguntaba si el negocio tiene /automations, para el link de cada mensaje de Notificaciones.
  // Se fue el 11/10/2026: esa lista no existe más; los mensajes de MaKo son automatizaciones.)

  const equipoPanel = (
    <div>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 18px', maxWidth: 720 }}>Suma a tu equipo y decide qué ve cada uno. El <b>Closer</b> ve CRM, WhatsApp y Closing Analyst; el <b>Setter</b> ve CRM, WhatsApp y Email; el <b>Admin</b> ve todo tu negocio.</p>
      <EquipoView />
    </div>
  );

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="config" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Configuraciones</h1>
      </header>
      <ConfigInnerTabs equipoPanel={equipoPanel} />
    </main>
  );
}
