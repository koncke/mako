// =============================================================================
// Login — Google SSO, y nada más
// =============================================================================
// Overlay full-screen (cubre el layout/sidebar). El botón vive en LoginForm
// (client, lee ?next= y ?error= con useSearchParams) y va envuelto en Suspense:
// esta página se prerenderiza y sin el boundary el build falla.
// El fallback es la misma tarjeta sin el botón, así no parpadea el layout.
// =============================================================================

import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14161B', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#F5F7FA', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '34px 30px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#14161B', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#14161B', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        <div style={{ fontSize: '14px', color: '#5B6472', marginBottom: '22px' }}>Entrá al dashboard.</div>

        <Suspense fallback={<div style={{ height: '46px', borderRadius: '11px', background: 'rgba(0,0,0,.05)' }} />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
