'use client';

// =============================================================================
// ConfigInnerTabs — sub-tabs dentro de /configuraciones
// =============================================================================
// Notificaciones · Identidades fiscales · Integraciones (Google Calendar). Antes
// los tres paneles venían apilados; ahora cada uno es su propia solapa.

import { Suspense, useState, type CSSProperties } from 'react';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';
import { IdentidadesFiscalesPanel } from './IdentidadesFiscalesPanel';
import { TelefonosPanel } from './TelefonosPanel';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';

const SANS = "'Geist', sans-serif";

type TabKey = 'notif' | 'fiscal' | 'telefonos' | 'integraciones';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'notif', label: 'Notificaciones' },
  { key: 'fiscal', label: 'Identidades fiscales' },
  { key: 'telefonos', label: 'Teléfonos' },
  { key: 'integraciones', label: 'Integraciones' },
];

export function ConfigInnerTabs() {
  const [tab, setTab] = useState<TabKey>('notif');
  const tabBtn = (on: boolean): CSSProperties => ({
    padding: '9px 15px', fontFamily: SANS, fontSize: 14, fontWeight: on ? 600 : 500,
    color: on ? 'var(--ink)' : 'var(--dim)', background: 'none', border: 'none',
    borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, cursor: 'pointer',
  });
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 22, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === 'notif' && <NotificacionesPanel />}
      {tab === 'fiscal' && <IdentidadesFiscalesPanel />}
      {tab === 'telefonos' && <TelefonosPanel />}
      {tab === 'integraciones' && (
        <Suspense fallback={null}><GoogleCalendarPanel /></Suspense>
      )}
    </div>
  );
}
