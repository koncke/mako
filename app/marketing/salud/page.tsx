// =============================================================================
// /marketing/salud — Estado de Meta (salud de entrega, live)
// =============================================================================
// Responde "¿el sistema está entregando?" (account_status, effective_status de
// campañas/conjuntos/anuncios, aprendizaje, rechazos, recomendaciones). NO es la
// vista de "Anuncios ganadores" (esa responde "¿qué anuncio convierte mejor?":
// agendas/leads/cierres/ROAS). Cero solape: acá no van leads, cierres ni ROAS.

import Link from 'next/link';
import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { SaludBoard } from './SaludBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

export default async function SaludMetaPage() {
  let health: MetaHealth | null = null;
  let errorMsg: string | null = null;
  try {
    health = await getMetaHealth();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <Link href="/marketing" style={{ fontSize: 13.5, color: 'var(--dim)', textDecoration: 'none' }}>← Marketing</Link>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', margin: '10px 0 8px' }}>
            Estado de entrega · en vivo
          </div>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Estado de Meta</h1>
        </div>
      </header>

      {errorMsg || !health ? (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 16, padding: '24px 28px' }}>
          <p style={{ fontWeight: 600, fontSize: 18, margin: '0 0 4px', color: 'var(--bad)' }}>No se pudo leer el estado de Meta</p>
          <p style={{ fontFamily: MONO, fontSize: 14, margin: 0, color: 'var(--dim)' }}>{errorMsg ?? 'Sin datos'}</p>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '12px 0 0' }}>Revisá el token de Meta y la conexión. El resto del tablero sigue funcionando.</p>
        </div>
      ) : (
        <SaludBoard health={health} />
      )}
    </main>
  );
}
