'use client';

// =============================================================================
// ConfigTabs — sub-tabs de Configuraciones (Notificaciones · Onboarding · Equipo · Método)
// =============================================================================
// El sub-tab Método solo aparece para admins (gestiona credenciales del
// workspace); /metodo igual redirige a los no-admin, esto solo oculta el link.

import Link from '@/app/_ui/Link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const SANS = "'Geist', sans-serif";

const TABS = [
  { label: 'Notificaciones', href: '/configuraciones' },
  // ⚠️ ACÁ HABÍA UNA SUB-TAB «Funnel» y se retiró el 28/09/2026 con la ruta: las etapas
  // se editan en el pop-up del CRM, y el resto del embudo (cómo entra la gente, las
  // transiciones, las nutriciones) vive en Onboarding → El funnel. Dejar la pastilla
  // apuntando a un redirect sería un destino que rebota.
  { label: 'Onboarding', href: '/onboarding' },
  { label: 'Equipo', href: '/equipo' },
  { label: 'Método', href: '/metodo', adminOnly: true },
];

export function ConfigTabs() {
  const pathname = usePathname() || '';
  const [esAdmin, setEsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.autenticado) setEsAdmin(j.rol === 'admin'); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
      {TABS.filter((t) => !t.adminOnly || esAdmin).map((t) => {
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
