'use client';

// =============================================================================
// Login — Google SSO (principal) + contraseña compartida (fallback)
// =============================================================================
// Overlay full-screen (cubre el layout/sidebar). Google → /api/auth/google.
// Contraseña → /api/auth/login. Ambos setean la misma cookie de sesión.
// =============================================================================

import { useEffect, useState, type FormEvent } from 'react';

const ERRORES: Record<string, string> = {
  'no-autorizado': 'Esa cuenta de Google no está autorizada para entrar.',
  oauth: 'No se pudo verificar el inicio de sesión. Probá de nuevo.',
  token: 'No se pudo completar el login con Google.',
  exchange: 'No se pudo completar el login con Google.',
  config: 'El login con Google no está configurado.',
};

export default function LoginPage() {
  const [next, setNext] = useState('/');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const n = sp.get('next');
    if (n && n.startsWith('/')) setNext(n);
    const e = sp.get('error');
    if (e) setOauthError(ERRORES[e] ?? 'No se pudo entrar.');
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (j.ok) {
        window.location.href = next;
      } else {
        setError(j.error || 'No se pudo entrar.');
      }
    } catch {
      setError('Error de red. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1917', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px', background: '#faf9f6', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '34px 30px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1c1917', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#1c1917', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        <div style={{ fontSize: '14px', color: '#6b6862', marginBottom: '22px' }}>Entrá al dashboard.</div>

        {oauthError && <div style={{ marginBottom: '16px', fontSize: '13px', color: '#b91c1c', background: '#fdecec', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '10px 12px' }}>{oauthError}</div>}

        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.18)', background: '#fff', color: '#1c1917', fontSize: '15px', fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.8 38 46.5 31.8 46.5 24.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.3-5.7c-2 1.4-4.7 2.3-8.2 2.3-6.3 0-11.6-3.7-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          Continuar con Google
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0', color: '#9a968e', fontSize: '12px' }}>
          <span style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,.1)' }} />o<span style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,.1)' }} />
        </div>

        <form onSubmit={submit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            style={{ width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.15)', background: '#fff', color: '#1c1917', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
          />
          {error && <div style={{ marginTop: '12px', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{ width: '100%', marginTop: '14px', padding: '11px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.15)', background: 'transparent', color: '#1c1917', fontSize: '14px', fontWeight: 600, cursor: (loading || !password) ? 'default' : 'pointer', opacity: (loading || !password) ? 0.5 : 1 }}
          >
            {loading ? 'Entrando…' : 'Entrar con contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
