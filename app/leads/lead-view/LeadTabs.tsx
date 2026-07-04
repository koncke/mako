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

export function LeadTabs({ tabs, initial, onChange, actions }: {
  tabs: LeadTabDef[];
  initial?: string;
  onChange?: (key: string) => void;
  /** Contenido extra a la derecha de la fila de tabs (ej. botón Editar). */
  actions?: ReactNode;
}) {
  const initKey = initial && tabs.some((t) => t.key === initial) ? initial : tabs[0]?.key ?? '';
  const [tab, setTab] = useState<string>(initKey);
  // Las tabs ya visitadas quedan MONTADAS (ocultas con display:none): cambiar de
  // tab no descarta estado del cliente (insight recién generado, chat cargado).
  const [visitadas, setVisitadas] = useState<string[]>([initKey]);

  const tabBtn = (active: boolean): CSSProperties => ({
    position: 'relative', padding: '11px 2px', marginRight: 22, border: 'none', background: 'transparent',
    fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
    color: active ? 'var(--primary)' : 'var(--dim)',
    borderBottom: '2px solid ' + (active ? 'var(--primary)' : 'transparent'),
    display: 'inline-flex', alignItems: 'center', gap: 7,
  });

  const activeKey = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? '';

  return (
    <div>
      {/* Fila única: las tabs scrollean en horizontal si no entran (nunca doble
          fila) y las acciones (dropdown de etapa) quedan en la MISMA línea. */}
      <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div role="tablist" className="lead-tabs-scroll" style={{ display: 'flex', flexWrap: 'nowrap', minWidth: 0, flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={active} onClick={() => { setTab(t.key); setVisitadas((v) => (v.includes(t.key) ? v : [...v, t.key])); onChange?.(t.key); }} style={tabBtn(active)}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span style={{ fontSize: 11.5, fontWeight: 700, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, padding: '0 6px', background: active ? 'rgba(47,111,237,.12)' : 'var(--surface-2)', color: active ? 'var(--primary)' : 'var(--dim)', border: '1px solid ' + (active ? 'var(--primary)' : 'var(--border)') }}>{t.badge}</span>
              )}
            </button>
          );
        })}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flex: 'none' }}>{actions}</div>}
      </div>
      <div role="tabpanel" style={{ marginTop: 20 }}>
        {tabs
          .filter((t) => t.key === activeKey || visitadas.includes(t.key))
          .map((t) => (
            <div key={t.key} style={{ display: t.key === activeKey ? 'flex' : 'none', flexDirection: 'column', gap: 18 }}>
              {t.content}
            </div>
          ))}
      </div>
    </div>
  );
}
