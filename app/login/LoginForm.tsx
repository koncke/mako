'use client';

// =============================================================================
// LoginForm — el botón de Google, y nada más
// =============================================================================
// Vive aparte de page.tsx porque usa useSearchParams (lee ?next= y ?error=), y
// eso obliga a un boundary de Suspense: /login se prerenderiza, y sin el
// boundary el build falla con "missing-suspense-with-csr-bailout".
//
// Acá había además un login con contraseña compartida. Se fue, y no por prolijo:
// abría una sesión de admin sin pasar por la tabla usuarios, y la cookie que
// dejaba tenía como valor el mismo secreto que firmaba las sesiones — o sea que
// quien la tuviera podía fabricarse un token de admin a mano. Quién entra ahora
// lo decide la tabla usuarios, y nada más.
// =============================================================================

import { useSearchParams } from 'next/navigation';

const ERRORES: Record<string, string> = {
  'no-autorizado': 'Esa cuenta de Google no está autorizada para entrar.',
  oauth: 'No se pudo verificar el inicio de sesión. Prueba de nuevo.',
  token: 'No se pudo completar el login con Google.',
  exchange: 'No se pudo completar el login con Google.',
  config: 'El login con Google no está configurado.',
};

/**
 * Destino post-login: SOLO rutas internas. '/inicio' sí, '//evil.com' no
 * (protocol-relative → open redirect). Se rechazan los caracteres de control
 * (tab/LF/CR) porque el navegador los strippea y '/\t//evil.com' se escaparía a
 * un host externo. Mismo criterio que destinoSeguro() en lib/auth-session.ts.
 *
 * Sin ?next= se cae a /inicio, el repartidor por rol. NO a '/': la raíz es la
 * landing de venta, y terminar ahí después de loguearse es quedarse afuera.
 */
function destinoInterno(raw: string): string {
  const n = raw.replace(/\\/g, '/');
  const ok = !/[\x00-\x1f\x7f]/.test(raw) && n.startsWith('/') && !n.startsWith('//');
  return ok ? n : '/inicio';
}

export function LoginForm() {
  // Derivado de la URL, sin estado ni efecto: no hay nada que sincronizar.
  const sp = useSearchParams();
  const next = destinoInterno(sp.get('next') ?? '');
  const err = sp.get('error');
  const oauthError = err ? (ERRORES[err] ?? 'No se pudo entrar.') : null;

  return (
    <>
      {oauthError && <div style={{ marginBottom: '16px', fontSize: '13px', color: '#b91c1c', background: '#fdecec', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '10px 12px' }}>{oauthError}</div>}

      <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.18)', background: '#fff', color: '#14161B', fontSize: '15px', fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.8 38 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.3-5.7c-2 1.4-4.7 2.3-8.2 2.3-6.3 0-11.6-3.7-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        Continuar con Google
      </a>
    </>
  );
}
