// =============================================================================
// /crm/new — form de creación de lead
// =============================================================================
// Mínimo: nombre + un canal de contacto (email o teléfono). Opcional: fechas.
// =============================================================================

import Link from '@/app/_ui/Link';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { NewLeadForm } from './NewLeadForm';

export const dynamic = 'force-dynamic';

const SANS = "'Geist', sans-serif";

export default async function NewLeadPage() {
  await requireCapa('crm');
  await guardOnboarding();
  return (
    <main style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: SANS, padding: 'clamp(20px,4vw,44px)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <Link href="/crm" style={{ fontSize: 14, color: 'var(--dim)', textDecoration: 'none' }}>← Volver a Leads</Link>
        <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '14px 0 22px' }}>Nuevo lead</h1>
        <NewLeadForm />
      </div>
    </main>
  );
}
