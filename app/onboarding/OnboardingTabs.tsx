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
  // Tabs tipo píldora, mismo control segmentado que el board /plan.
  const pill = (on: boolean): CSSProperties => ({ border: 'none', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)', fontWeight: on ? 600 : 500, fontSize: 13.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: SANS });
  const activo = TABS.find((t) => t.key === tab);
  return (
    <div>
      <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} style={pill(tab === t.key)}>{t.label}</button>)}
      </div>
      {activo?.panel}
    </div>
  );
}
