'use client';

// =============================================================================
// OnboardingTabs — el hub de "Onboarding" (menú de la foto): cargar el negocio
// =============================================================================
// El Archivero (soltá tus docs) + Funnel (cómo vendés) + Ángulos y avatares (el
// vocabulario). Todo EN EL LUGAR. El panel de Funnel llega server-rendered desde
// la page; El Archivero y Ángulos son self-contained (se traen su data).

import { useState, type CSSProperties, type ReactNode } from 'react';
import { Archivero } from './Archivero';
import { AngulosPanel } from '../configuraciones/AngulosPanel';

const SANS = "'Geist', sans-serif";
type TabKey = 'archivero' | 'funnel' | 'angulos';

export function OnboardingTabs({ funnelPanel }: { funnelPanel: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('archivero');
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'archivero', label: 'El Archivero', panel: <Archivero /> },
    { key: 'funnel', label: 'Funnel', panel: funnelPanel },
    { key: 'angulos', label: 'Ángulos y avatares', panel: <AngulosPanel /> },
  ];
  const base: CSSProperties = { padding: '9px 15px', fontFamily: SANS, fontSize: 14, borderBottom: '2px solid transparent', marginBottom: -1 };
  const tabBtn = (on: boolean): CSSProperties => ({ ...base, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', background: 'none', border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' });
  const activo = TABS.find((t) => t.key === tab);
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 22, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>)}
      </div>
      {activo?.panel}
    </div>
  );
}
