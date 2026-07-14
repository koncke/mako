'use client';

// =============================================================================
// AgenciaTabs — el WhatsApp de MaKo (SuperAdmin): Canal · Chat · Plantillas
// =============================================================================
// NO es preview de ningún cliente. Es la línea propia de MaKo: conexión por QR
// (Canal), el chat de los grupos de MaKo (Chat) y la biblioteca de mensajes
// (Plantillas). El tab se recuerda en la URL (?tab=).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { MakoStar } from '../_components/MakoBrand';
import { CanalMaKoPanel } from './CanalMaKoPanel';
import { PlantillasView } from './PlantillasView';
import { ChatGruposPanel } from './ChatGruposPanel';

type TabKey = 'canal' | 'chat' | 'plantillas';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'canal', label: 'Canal' },
  { key: 'chat', label: 'Chat' },
  { key: 'plantillas', label: 'Plantillas' },
];

export function AgenciaTabs({ inicial = 'canal' }: { inicial?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(inicial);
  const paneles: Record<TabKey, ReactNode> = {
    canal: <CanalMaKoPanel />,
    chat: <ChatGruposPanel />,
    plantillas: <PlantillasView />,
  };
  const tabBtn = (on: boolean): CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)',
    fontSize: 14, fontWeight: on ? 600 : 500, boxShadow: on ? '0 1px 3px rgba(23,21,17,.08)' : 'none',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ maxWidth: tab === 'chat' ? 1080 : 860, margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <MakoStar size={24} color="var(--primary)" />
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>WhatsApp de MaKo</h1>
      </div>
      <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" style={tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {paneles[tab]}
    </div>
  );
}
