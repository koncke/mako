// =============================================================================
// /login/2fa — el segundo paso del login
// =============================================================================
// Llega acá quien pasó Google y necesita segundo factor: el super admin siempre, y
// cualquiera que lo haya activado. Sin el paso intermedio (`mako_preauth`, 15 minutos)
// no hay nada que hacer acá: vuelve a /login. La pantalla en sí es SegundoPaso, que
// habla con /api/auth/2fa.
//
// Es pública por prefijo (`/login` en lib/rutas-publicas.ts) y sólo se LEE: la página
// no escribe nada, todo lo que escribe es la ruta de la API.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PREAUTH_COOKIE, verificarPreauth } from '@/lib/auth-session';
import { SegundoPaso } from './SegundoPaso';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Segundo paso · MaKo', robots: { index: false } };

export default async function SegundoPasoPage() {
  const pre = verificarPreauth((await cookies()).get(PREAUTH_COOKIE)?.value);
  if (!pre) redirect('/login?error=mfa-vencido');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14161B', padding: '20px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: '#F5F7FA', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '30px 28px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#14161B', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#14161B', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        <div style={{ fontSize: '13px', color: '#5B6472', marginBottom: '18px' }}>{pre.email}</div>
        <SegundoPaso cuenta={pre.email} />
      </div>
    </div>
  );
}
