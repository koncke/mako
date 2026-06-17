'use client';

// =============================================================================
// DashboardTabs — nav de tabs del dashboard, compartido
// =============================================================================
// Cada link conserva el rango de fecha activo (?desde&hasta) para que el
// filtro global (Fase C) PERSISTA al cambiar de tab. El tab "Pendientes"
// (v3 Fase G) lleva un badge con el total de cosas por hacer, que se carga
// async desde /api/pendientes-count para no costarle a cada página.
// =============================================================================

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export type TabKey = 'marketing' | 'comercial' | 'revenue' | 'general' | 'pendientes';

// Orden 8A + v3 Fase G: Vista General (salud) → Pendientes (operativo) → detalle.
const TABS: Array<{ key: TabKey; label: string; href: string }> = [
  { key: 'general', label: 'Vista General', href: '/general' },
  { key: 'pendientes', label: 'Pendientes', href: '/pendientes' },
  { key: 'marketing', label: 'Marketing', href: '/' },
  { key: 'comercial', label: 'Comercial', href: '/comercial' },
  { key: 'revenue', label: 'Revenue', href: '/revenue' },
];

export function DashboardTabs({ active }: { active: TabKey }) {
  const searchParams = useSearchParams();
  const [pendientes, setPendientes] = useState<number | null>(null);

  // Conservamos solo el rango de fecha al saltar de tab (no params propios de
  // una página, como ?pendientes, que no aplican a las demás).
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const sufijo =
    desde && hasta
      ? `?${new URLSearchParams({ desde, hasta }).toString()}`
      : '';

  // Badge del tab Pendientes (Fase G): carga async, no bloquea el render.
  useEffect(() => {
    let vivo = true;
    fetch('/api/pendientes-count')
      .then((r) => r.json())
      .then((d) => { if (vivo && typeof d?.total === 'number') setPendientes(d.total); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <nav
      className="flex items-center gap-1 mb-8 border-b overflow-x-auto whitespace-nowrap"
      style={{ borderColor: 'var(--card-border)' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const badge = tab.key === 'pendientes' && pendientes !== null && pendientes > 0;
        return (
          <Link
            key={tab.key}
            href={`${tab.href}${sufijo}`}
            className={`shrink-0 px-4 py-3 text-lg font-medium transition-colors inline-flex items-center gap-2 ${isActive ? '-mb-px border-b-2' : ''}`}
            style={{
              borderColor: isActive ? 'var(--accent-yellow)' : 'transparent',
              color: isActive ? 'var(--accent-yellow)' : 'var(--text-dim)',
            }}
          >
            {tab.label}
            {badge && (
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-sm font-semibold tabular-nums"
                style={{ background: 'var(--accent-orange)', color: '#000' }}
              >
                {pendientes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
