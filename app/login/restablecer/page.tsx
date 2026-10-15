// =============================================================================
// /login/restablecer — el link de «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// El token viene en el FRAGMENTO del link (`#t=…`), así que el server nunca lo ve: esta página no
// lee nada y todo lo hace la pantalla (Restablecer), que habla con /api/auth/restablecer.
// Es pública por prefijo (`/login` en lib/rutas-publicas.ts) y sólo se LEE.

import type { Metadata } from 'next';
import { Restablecer } from './Restablecer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Restablecer la contraseña · MaKo', robots: { index: false } };

export default function RestablecerPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14161B', padding: '20px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#F5F7FA', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '30px 28px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#14161B', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#14161B', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        <Restablecer />
      </div>
    </div>
  );
}
