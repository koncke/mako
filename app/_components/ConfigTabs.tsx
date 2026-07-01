'use client';

// =============================================================================
// ConfigTabs — sub-tabs de Configuraciones (Notificaciones · Funnel · Onboarding)
// =============================================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SANS = "'Geist', sans-serif";

const TABS = [
  { label: 'Notificaciones', href: '/configuraciones' },
  { label: 'Funnel', href: '/funnel' },
  { label: 'Onboarding', href: '/onboarding' },
];

export function ConfigTabs() {
  const pathname = usePathname() || '';
  return (
    <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
      {TABS.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link key={t.href} href={t.href}
            style={{ padding: '10px 16px', fontFamily: SANS, fontSize: 14.5, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--dim)', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, textDecoration: 'none' }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
