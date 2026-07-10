'use client';

// =============================================================================
// MakoDoerTab — MaKo "doer": chat con herramientas de LECTURA
// =============================================================================
// Reusa MakoChat (sesiones + markdown + sugerencias) apuntándolo a /api/mako-doer.
// Ahí MaKo corre con tool-use: consulta leads, WhatsApp, reuniones, método real.

import { MakoChat } from '../_components/MakoChat';
import { Icon } from '../_components/icons';

const SUGERENCIAS = [
  '¿Por qué se enfrió un lead? (decime el nombre)',
  '¿Qué leads necesitan seguimiento?',
  'Resumime el WhatsApp de un lead',
  '¿Qué dice mi método sobre objeciones de precio?',
];

export function MakoDoerTab() {
  return (
    <main style={{ flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 28px 20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flex: 'none' }}>
        <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="mako" size={34} /></span>
        <h1 style={{ fontWeight: 600, fontSize: 38, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>MaKo · Doer</h1>
      </header>

      <section style={{ flex: 1, minHeight: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <MakoChat endpoint="/api/mako-doer" chartKey="mako-doer" titulo="MaKo · Doer" sugerencias={SUGERENCIAS} />
      </section>
    </main>
  );
}
