'use client';

// =============================================================================
// /api-mako — la pantalla de la API de MaKo, con el aspecto de GitHub
// =============================================================================
// Decisión de Martín (08/10/2026): «Me gusta como hace la API GitHub, con su diseño,
// permisos, presentación, etc… Copialo todo, tal cual» y, de las opciones, «que se vea
// igual a GitHub». Por eso esta tab NO usa el PageHeader ni los Tabs de app/_ui: usa el
// encabezado y el UnderlineNav de GitHub, con su CSS (github.css), limitado a `.gh`. Lo que
// no cambia son las reglas de la casa que no son de aspecto: la vista viaja en `?tab=`
// (leída en el server), los links preservan el `?ws=` (app/_ui/Link) y el registro no
// viaja al navegador.
//
// Tres vistas, como en GitHub viven en tres lugares: la Documentación (docs.github.com/en/
// rest), los Tokens (Settings → Developer settings → Personal access tokens) y el Registro
// (el Security log).
// =============================================================================

import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Icono, type NombreIcono } from './piezas';
import './github.css';

export type TabApi = 'docs' | 'tokens' | 'registro';

const TABS: { id: TabApi; label: string; icono: NombreIcono }[] = [
  { id: 'docs', label: 'Documentación', icono: 'book' },
  { id: 'tokens', label: 'Tokens', icono: 'key' },
  { id: 'registro', label: 'Registro', icono: 'pulse' },
];

export function ApiMako({ tab, tokens, children }: { tab: TabApi; tokens: number; children: ReactNode }) {
  return (
    <div className="gh" style={{ minHeight: '100%' }}>
      <div className="gh-encabezado" style={{ padding: '24px 24px 0' }}>
        <div className="gh-titulo-app">
          <Icono n="code" size={20} />
          <span>MaKo</span><span style={{ color: 'var(--gh-fg-muted)' }}>/</span><strong>API</strong>
        </div>
        <nav className="gh-underline-nav" aria-label="API">
          {TABS.map((t) => (
            <Link key={t.id} href={`/api-mako?tab=${t.id}`} className="gh-underline-item" aria-current={tab === t.id ? 'page' : undefined}>
              <Icono n={t.icono} />{t.label}
              {t.id === 'tokens' && tokens > 0 && <span className="gh-counter">{tokens}</span>}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ padding: tab === 'docs' ? 0 : '0 24px 48px' }}>{children}</div>
    </div>
  );
}
