'use client';

// =============================================================================
// DashboardTabs — nav de tabs del dashboard, compartido
// =============================================================================
// Cada link conserva el rango de fecha activo (?desde&hasta) para que el
// filtro global (Fase C) PERSISTA al cambiar de tab.
// =============================================================================

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export type TabKey = 'marketing' | 'comercial' | 'revenue' | 'general';

// Orden 8A: Vista General primero — es el panel de salud, lo demás es detalle.
const TABS: Array<{ key: TabKey; label: string; href: string }> = [
  { key: 'general', label: 'Vista General', href: '/general' },
  { key: 'marketing', label: 'Marketing', href: '/' },
  { key: 'comercial', label: 'Comercial', href: '/comercial' },
  { key: 'revenue', label: 'Revenue', href: '/revenue' },
];

export function DashboardTabs({ active }: { active: TabKey }) {
  const searchParams = useSearchParams();

  // Conservamos solo el rango de fecha al saltar de tab (no params propios de
  // una página, como ?pendientes, que no aplican a las demás).
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const sufijo =
    desde && hasta
      ? `?${new URLSearchParams({ desde, hasta }).toString()}`
      : '';

  return (
    <nav
      className="flex items-center gap-1 mb-8 border-b overflow-x-auto whitespace-nowrap"
      style={{ borderColor: 'var(--card-border)' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`${tab.href}${sufijo}`}
            className={`shrink-0 px-4 py-3 text-lg font-medium transition-colors ${isActive ? '-mb-px border-b-2' : ''}`}
            style={{
              borderColor: isActive ? 'var(--accent-yellow)' : 'transparent',
              color: isActive ? 'var(--accent-yellow)' : 'var(--text-dim)',
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
