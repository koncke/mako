// =============================================================================
// ComingSoon — vista para features todavía no desarrolladas
// =============================================================================
// MaKo "flotando" con un glow + el mensaje. Se usa en todas las rutas que están
// en el roadmap pero aún no existen (Offer/Landing/VSL/Market Analyst, los
// Writers, Instagram, CS Analyst…).

import { MakoLogo } from './MakoBrand';
import { Icon } from './icons';

const MONO = "'Geist Mono', monospace";

export function ComingSoon({ title, icon }: { title: string; icon?: string }) {
  return (
    <main style={{ flex: 1, minWidth: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <style>{'@keyframes mako-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes mako-glow{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.65;transform:scale(1.18)}}'}</style>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 28px' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-soft)', filter: 'blur(32px)', animation: 'mako-glow 2.8s ease-in-out infinite' }} />
          <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'mako-float 3s ease-in-out infinite' }}>
            <MakoLogo size={92} />
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
          {icon && <Icon name={icon} size={15} />}
          <span>{title}</span>
        </div>
        <h1 style={{ fontWeight: 600, fontSize: 34, letterSpacing: '-0.02em', margin: '0 0 12px', color: 'var(--ink)' }}>Coming soon</h1>
        <p style={{ fontSize: 15.5, color: 'var(--dim)', lineHeight: 1.6, margin: 0 }}>
          MaKo está construyendo esta función. <span style={{ color: 'var(--faint)' }}>We’re building this feature</span> — muy pronto la vas a poder usar aquí.
        </p>
      </div>
    </main>
  );
}
