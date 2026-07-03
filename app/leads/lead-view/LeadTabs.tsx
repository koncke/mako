'use client';

// =============================================================================
// LeadTabs — tabs del detalle del lead (texto con subrayado activo)
// =============================================================================
// Genérico: recibe la lista de tabs con su contenido (ReactNode, server
// components incluidos). Lo usan la ruta /leads/[id] y el modal de preview.

import { useState, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";

export type LeadTabDef = {
  key: string;
  label: string;
  content: ReactNode;
  badge?: number;
};

export function LeadTabs({ tabs, initial, onChange }: {
  tabs: LeadTabDef[];
  initial?: string;
  onChange?: (key: string) => void;
}) {
  const [tab, setTab] = useState<string>(initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '');

  const tabBtn = (active: boolean): CSSProperties => ({
    position: 'relative', padding: '11px 2px', marginRight: 26, border: 'none', background: 'transparent',
    fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer',
    color: active ? 'var(--primary)' : 'var(--dim)',
    borderBottom: '2px solid ' + (active ? 'var(--primary)' : 'transparent'),
    display: 'inline-flex', alignItems: 'center', gap: 7,
  });

  const activeTab = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <div>
      <div role="tablist" style={{ borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => { setTab(t.key); onChange?.(t.key); }} style={tabBtn(active)}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 6px', background: active ? 'rgba(47,111,237,.12)' : 'var(--surface-2)', color: active ? 'var(--primary)' : 'var(--dim)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)') }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
        {activeTab?.content}
      </div>
    </div>
  );
}
