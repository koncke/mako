'use client';

// =============================================================================
// ConfigInnerTabs — UNA sola fila de tabs de /configuraciones
// =============================================================================
// Notificaciones · Identidades fiscales · Teléfonos · Funnel · Onboarding ·
// Equipo cargan EN EL LUGAR (sin redirigir). Los paneles de Funnel/Onboarding/
// Equipo se renderizan en el server (page.tsx) y llegan como props para que su
// data (getFunnel/onboarding) siga cargándose server-side. Método sigue siendo
// una ruta propia (admin de agencia). "Integraciones" vive en su propia tab.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';
import { IdentidadesFiscalesPanel } from './IdentidadesFiscalesPanel';
import { TelefonosPanel } from './TelefonosPanel';
import { EtiquetasWhatsAppPanel } from './EtiquetasWhatsAppPanel';

const SANS = "'Geist', sans-serif";

type TabKey = 'notif' | 'fiscal' | 'telefonos' | 'etiquetas' | 'funnel' | 'onboarding' | 'equipo';

export function ConfigInnerTabs({ funnelPanel, onboardingPanel, equipoPanel }: {
  /** Paneles server-rendered embebidos (data cargada en page.tsx). */
  funnelPanel: ReactNode;
  onboardingPanel: ReactNode;
  equipoPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>('notif');
  const [esAdmin, setEsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.autenticado) setEsAdmin(j.rol === 'admin'); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Cada tab con su panel embebido (todas EN EL LUGAR, sin navegar).
  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'notif', label: 'Notificaciones', panel: <NotificacionesPanel /> },
    { key: 'fiscal', label: 'Identidades fiscales', panel: <IdentidadesFiscalesPanel /> },
    { key: 'telefonos', label: 'Teléfonos', panel: <TelefonosPanel /> },
    { key: 'etiquetas', label: 'Etiquetas WhatsApp', panel: <EtiquetasWhatsAppPanel /> },
    { key: 'funnel', label: 'Funnel', panel: funnelPanel },
    { key: 'onboarding', label: 'Onboarding', panel: onboardingPanel },
    { key: 'equipo', label: 'Equipo', panel: equipoPanel },
  ];
  // Solo el Método (agencia) sigue siendo ruta aparte.
  const LINKS: Array<{ href: string; label: string; adminOnly?: boolean }> = [
    { href: '/metodo', label: 'Método', adminOnly: true },
  ];

  const base: CSSProperties = { padding: '9px 15px', fontFamily: SANS, fontSize: 14, textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: -1 };
  const tabBtn = (on: boolean): CSSProperties => ({ ...base, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', background: 'none', border: 'none', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' });

  const activo = TABS.find((t) => t.key === tab);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 22, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
        {LINKS.filter((l) => !l.adminOnly || esAdmin).map((l) => (
          <Link key={l.href} href={l.href} style={{ ...base, fontWeight: 500, color: 'var(--dim)' }}>{l.label} <span aria-hidden style={{ fontSize: 10, opacity: 0.5 }}>↗</span></Link>
        ))}
      </div>
      {/* TODO a full width (paneles anchos y formularios por igual). */}
      {activo?.panel}
    </div>
  );
}
