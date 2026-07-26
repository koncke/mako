'use client';

// =============================================================================
// ConfigInnerTabs — UNA sola fila de tabs de /configuraciones
// =============================================================================
// Notificaciones · Identidades fiscales · Equipo cargan EN EL LUGAR (sin
// redirigir). El panel de Equipo se renderiza en el server (page.tsx) y llega
// como prop. Método sigue siendo una ruta propia (admin de agencia). El Archivero,
// el Funnel y los Ángulos se mudaron a "Onboarding" (menú de la foto de perfil).

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { NotificacionesPanel } from '../perfil/NotificacionesPanel';
import { IdentidadesFiscalesPanel } from './IdentidadesFiscalesPanel';

const SANS = "'Geist', sans-serif";

type TabKey = 'notif' | 'fiscal' | 'equipo';

export function ConfigInnerTabs({ equipoPanel }: {
  /** Panel server-rendered embebido (data cargada en page.tsx). */
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

  const TABS: Array<{ key: TabKey; label: string; panel: ReactNode }> = [
    { key: 'notif', label: 'Notificaciones', panel: <NotificacionesPanel /> },
    { key: 'fiscal', label: 'Identidades fiscales', panel: <IdentidadesFiscalesPanel /> },
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
      {activo?.panel}
    </div>
  );
}
