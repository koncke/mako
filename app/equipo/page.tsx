// =============================================================================
// /equipo — Panel de Equipo del cliente (sub-tab de Configuraciones)
// =============================================================================
// El admin-del-cliente arma su equipo: invita Closers y Setters, cambia roles y
// da de baja. Vive en el cluster de Configuraciones. requireRolWs([]) bloquea a
// closer/setter (solo el admin-cliente y la agencia lo ven); el enforcement fino
// por-acción está en /api/equipo.

import { Icon } from '../_components/icons';
import { ConfigTabs } from '../_components/ConfigTabs';
import { EquipoView } from './EquipoView';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EquipoPage() {
  await requireRolWs([], { nav: 'configuraciones' });
  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="perfil" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Equipo</h1>
      </header>
      <p style={{ fontSize: 14, color: 'var(--dim)', margin: '0 0 22px', maxWidth: 720 }}>Suma a tu equipo y decide qué ve cada uno. El <b>Closer</b> ve CRM, WhatsApp y Closing Analyst; el <b>Setter</b> ve CRM, WhatsApp y Email; el <b>Admin</b> ve todo tu negocio.</p>
      <div style={{ maxWidth: 720 }}>
        <ConfigTabs />
        <EquipoView />
      </div>
    </main>
  );
}
