'use client';

// =============================================================================
// ConfigInnerTabs — UNA sola fila de tabs de /configuraciones
// =============================================================================
// Notificaciones · Identidades fiscales · Teléfonos cargan EN EL LUGAR. Funnel ·
// Onboarding · Equipo · Método son otras secciones (rutas propias): se navegan.
// "Integraciones" ya no está acá (vive en la tab real /integraciones).

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';
import { IdentidadesFiscalesPanel } from './IdentidadesFiscalesPanel';
import { TelefonosPanel } from './TelefonosPanel';

const SANS = "'Geist', sans-serif";

type TabKey = 'notif' | 'fiscal' | 'telefonos';
const INLINE: Array<{ key: TabKey; label: string }> = [
  { key: 'notif', label: 'Notificaciones' },
  { key: 'fiscal', label: 'Identidades fiscales' },
  { key: 'telefonos', label: 'Teléfonos' },
];
// Otras secciones de ajustes (rutas propias) — se muestran en la MISMA fila.
const LINKS: Array<{ href: string; label: string; adminOnly?: boolean }> = [
  { href: '/funnel', label: 'Funnel' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/equipo', label: 'Equipo' },
  { href: '/metodo', label: 'Método', adminOnly: true },
];

export function ConfigInnerTabs() {
  const [tab, setTab] = useState<TabKey>('notif');
  const [esAdmin, setEsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.autenticado) setEsAdmin(j.rol === 'admin'); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const base: CSSProperties = { padding: '9px 15px', fontFamily: SANS, fontSize: 14, textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: -1 };
  const tabBtn = (on: boolean): CSSProperties => ({ ...base, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', background: 'none', border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 22, flexWrap: 'wrap' }}>
        {INLINE.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
        {LINKS.filter((l) => !l.adminOnly || esAdmin).map((l) => (
          <Link key={l.href} href={l.href} style={{ ...base, fontWeight: 500, color: 'var(--dim)' }}>{l.label} <span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>↗</span></Link>
        ))}
      </div>
      {tab === 'notif' && <NotificacionesPanel />}
      {tab === 'fiscal' && <IdentidadesFiscalesPanel />}
      {tab === 'telefonos' && <TelefonosPanel />}
    </div>
  );
}
