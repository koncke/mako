'use client';

// =============================================================================
// LeadTabs — tabs del detalle del lead (Resumen / Editar / Cobranza / Actividad)
// =============================================================================
// Recibe el contenido de cada tab como ReactNode (server components incluidos).
// Texto con subrayado activo, mismo lenguaje que el resto del CRM.

import { useState, type CSSProperties, type ReactNode } from 'react';

const SANS = "'Geist', sans-serif";

export type LeadTabKey = 'resumen' | 'editar' | 'cobranza' | 'actividad';

const TABS: Array<{ key: LeadTabKey; label: string }> = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'editar', label: 'Editar' },
  { key: 'cobranza', label: 'Cobranza' },
  { key: 'actividad', label: 'Actividad' },
];

export function LeadTabs({ initial, resumen, editar, cobranza, actividad, badges }: {
  initial?: LeadTabKey;
  resumen: ReactNode;
  editar: ReactNode;
  cobranza: ReactNode;
  actividad: ReactNode;
  /** Numeritos opcionales por tab (ej. cuotas pendientes en Cobranza). */
  badges?: Partial<Record<LeadTabKey, number>>;
}) {
  const [tab, setTab] = useState<LeadTabKey>(initial && TABS.some((t) => t.key === initial) ? initial : 'resumen');

  const tabBtn = (active: boolean): CSSProperties => ({
    position: 'relative', padding: '11px 2px', marginRight: 26, border: 'none', background: 'transparent',
    fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer',
    color: active ? 'var(--primary)' : 'var(--dim)',
    borderBottom: '2px solid ' + (active ? 'var(--primary)' : 'transparent'),
    display: 'inline-flex', alignItems: 'center', gap: 7,
  });

  const content: Record<LeadTabKey, ReactNode> = { resumen, editar, cobranza, actividad };

  return (
    <div>
      <div role="tablist" style={{ borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = badges?.[t.key];
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => setTab(t.key)} style={tabBtn(active)}>
              {t.label}
              {badge != null && badge > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 6px', background: active ? 'rgba(47,111,237,.12)' : 'var(--surface-2)', color: active ? 'var(--primary)' : 'var(--dim)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)') }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 20 }}>
        {content[tab]}
      </div>
    </div>
  );
}
