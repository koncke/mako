'use client';

// =============================================================================
// GraphicsTabs — sub-tabs de la sección "Graphics" (Marketing · Comercial)
// =============================================================================
// Marketing y Comercial se unificaron bajo "Graphics" en el sidebar. Esta barra
// va arriba de ambos dashboards y navega entre ellos, conservando el filtro de
// fecha global (?desde&hasta).

import Link from '@/app/_ui/Link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from './icons';

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

  // Solo las tabs (sin borde/margen propios): cada página las mete en su header,
  // que aporta el borde inferior y comparte fila con los botones (Ads Manager,
  // filtro de fecha).
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
      <span style={{ display: 'inline-flex', color: 'var(--accent)', marginBottom: 5 }} title="Dashboard"><Icon name="graphics" size={29} /></span>
      {TABS.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link key={t.href} href={t.href + q}
            style={{ padding: '6px 2px', fontFamily: SANS, fontSize: 30, fontWeight: on ? 600 : 500, letterSpacing: '-0.02em', color: on ? 'var(--ink)' : 'var(--faint)', borderBottom: on ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1, textDecoration: 'none' }}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
