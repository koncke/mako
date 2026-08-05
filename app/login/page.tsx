// =============================================================================
// Login — Google SSO, y nada más
// =============================================================================
// Overlay full-screen (cubre el layout/sidebar). El botón vive en LoginForm
// (client, lee ?next= y ?error= con useSearchParams) y va envuelto en Suspense:
// sin el boundary el build falla.
// El fallback es la misma tarjeta sin el botón, así no parpadea el layout.
//
// Con la sesión YA abierta no se muestra el formulario: eso le decía "Entrá al
// dashboard" a alguien que estaba adentro, y parecía que se había deslogueado.
// Se le avisa quién es y se lo lleva a /inicio, el repartidor por rol.
//
// Por eso la página dejó de ser estática: leer la cookie de sesión exige render
// dinámico. Es una pantalla de baja frecuencia, así que el costo es despreciable.
// =============================================================================

import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { YaLogueado } from './YaLogueado';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const sesion = await getUsuarioActual();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#14161B', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#F5F7FA', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '34px 30px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#14161B', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#14161B', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        {sesion ? (
          <YaLogueado nombre={sesion.nombre} email={sesion.email} />
        ) : (
          <>
            <div style={{ fontSize: '14px', color: '#5B6472', marginBottom: '22px' }}>Entrá al dashboard.</div>
            <Suspense fallback={<div style={{ height: '46px', borderRadius: '11px', background: 'rgba(0,0,0,.05)' }} />}>
              <LoginForm />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
