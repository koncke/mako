'use client';

// =============================================================================
// La barra de secciones de las tabs unificadas (Video, Image, Copywriting)
// =============================================================================
// 12/10/2026, Martín: «Que no exista "video generator" y luego "Editor"... que todo
// sea lo mismo». Cada tab unificada agrupa herramientas que eran tabs sueltas
// (nav.ts → `secciones`). Esta barra va UNA vez en el layout: aparece arriba de
// cualquier ruta que sea sección de una tab unificada y ofrece las secciones que
// esa persona puede ver — con la MISMA regla que el Sidebar
// (lib/nav-visibilidad.ts) —, así ninguna pantalla tiene que acordarse de dibujarla.
//
// No se mueve ninguna ruta ni ningún guard: cada sección sigue siendo su page, con
// su key de siempre. Con una sola sección visible no se dibuja nada (una barra con
// un botón no le sirve a nadie). Mientras está, deja su alto en
// `--alto-secciones`, para que una pantalla de alto fijo (el inicio del Video
// Editor) le reste ese alto.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/app/_ui/Link';
import { FAMILIAS, type NavItem } from './nav';
import { seccionesVisibles, type VistaNav } from '@/lib/nav-visibilidad';

const ALTO = 40;

/** La tab unificada de la que esta ruta es sección, o null. */
function tabDe(pathname: string): NavItem | null {
  for (const f of FAMILIAS) {
    for (const it of f.bloques.flat()) {
      if (it.secciones?.some((s) => s.match(pathname))) return it;
    }
  }
  return null;
}

/** Una sola lectura por pestaña: es la misma que hace el Sidebar al montar. */
let vistaPromesa: Promise<VistaNav | null> | null = null;
function leerVista(): Promise<VistaNav | null> {
  vistaPromesa ??= fetch('/api/auth/me')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? {
      adminShell: j.rol === 'admin' && !j.impersonando,
      rolWs: (j.rolWs as string) || '',
      capa: (j.capa as string) || '',
    } : null))
    .catch(() => null);
  return vistaPromesa;
}

export function SeccionesTab() {
  const pathname = usePathname() ?? '';
  const tab = tabDe(pathname);
  const [vista, setVista] = useState<VistaNav | null>(null);

  useEffect(() => {
    if (!tab) return;
    let vivo = true;
    void leerVista().then((v) => { if (vivo) setVista(v); });
    return () => { vivo = false; };
  }, [tab]);

  const secciones = tab && vista ? seccionesVisibles(tab, vista) : [];
  const visible = secciones.length > 1;

  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty('--alto-secciones', `${ALTO}px`);
    return () => { document.documentElement.style.removeProperty('--alto-secciones'); };
  }, [visible]);

  if (!tab || !visible) return null;

  return (
    <nav
      aria-label={tab.label}
      style={{
        height: ALTO, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginRight: 12 }}>{tab.label}</span>
      {secciones.map((s) => {
        const activa = s.match(pathname);
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={activa ? 'page' : undefined}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
              color: activa ? 'var(--primary)' : 'var(--dim)',
              background: activa ? 'var(--primary-bg)' : 'transparent',
              fontWeight: activa ? 600 : 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {s.seccion ?? s.label}
            {/* Una sección que todavía no está se ve, pero lo dice: el mismo chip que la barra lateral (Sidebar.tsx). */}
            {s.comingSoon && (
              <span style={{ fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', border: '1px solid currentColor', borderRadius: 5, padding: '1px 5px', opacity: 0.6 }}>pronto</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
