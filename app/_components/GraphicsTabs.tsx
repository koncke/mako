'use client';

// =============================================================================
// GraphicsTabs — sub-tabs de la sección "Graphics" (Marketing · Comercial)
// =============================================================================
// Marketing y Comercial se unificaron bajo "Graphics" en el sidebar. Esta barra
// va arriba de ambos dashboards y navega entre ellos, conservando el filtro de
// fecha global (?desde&hasta).

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const SANS = "'Geist', sans-serif";

const TABS = [
  { label: 'Marketing', href: '/marketing' },
  { label: 'Comercial', href: '/comercial' },
];

export function GraphicsTabs() {
  const pathname = usePathname() || '';
  const sp = useSearchParams();
  const desde = sp.get('desde');
  const hasta = sp.get('hasta');
  const q = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '';

  return (
    <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
      {TABS.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link key={t.href} href={t.href + q}
            style={{ padding: '10px 18px', fontFamily: SANS, fontSize: 16, fontWeight: on ? 600 : 500, color: on ? 'var(--accent)' : 'var(--dim)', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, textDecoration: 'none' }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
