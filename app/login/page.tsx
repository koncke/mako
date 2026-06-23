'use client';

// =============================================================================
// Login — gate de acceso al dashboard (contraseña compartida)
// =============================================================================
// Overlay full-screen (cubre el layout/sidebar). Verifica contra /api/auth/login
// y, si ok, redirige a ?next (o a la home).
// =============================================================================

import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        const next = new URLSearchParams(window.location.search).get('next') || '/';
        window.location.href = next.startsWith('/') ? next : '/';
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
      <form onSubmit={submit} style={{ width: '100%', maxWidth: '380px', background: '#faf9f6', borderRadius: '18px', border: '1px solid rgba(0,0,0,.08)', padding: '34px 30px', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1c1917', fontSize: '18px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '22px', color: '#1c1917', letterSpacing: '-0.02em' }}>MaKo</div>
        </div>
        <div style={{ fontSize: '14px', color: '#6b6862', marginBottom: '22px' }}>Ingresá la contraseña para entrar al dashboard.</div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          style={{ width: '100%', padding: '12px 14px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.15)', background: '#fff', color: '#1c1917', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
        />

        {error && <div style={{ marginTop: '12px', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}

        <button
          type="submit"
          disabled={loading || !password}
          style={{ width: '100%', marginTop: '18px', padding: '12px', borderRadius: '11px', border: 'none', background: '#1c1917', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: (loading || !password) ? 'default' : 'pointer', opacity: (loading || !password) ? 0.6 : 1 }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
