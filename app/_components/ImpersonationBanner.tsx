'use client';

// =============================================================================
// ImpersonationBanner — barra fija cuando un admin está "viendo como" cliente
// =============================================================================
// Aparece arriba de todo con el nombre del cliente y un botón para salir. Se
// alimenta de /api/auth/me (impersonando + clienteNombre).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const MONO = "'Geist Mono', monospace";

export function ImpersonationBanner() {
  const pathname = usePathname() || '';
  const [cliente, setCliente] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me').then((r) => r.json())
      .then((j) => { if (alive && j?.ok && j.impersonando) setCliente(j.clienteNombre as string); else if (alive) setCliente(null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  if (!cliente) return null;

  const salir = async () => {
    setSaliendo(true);
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
      window.location.href = '/admin';
    } catch { setSaliendo(false); }
  };

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 18px', background: '#14161B', color: '#F3F0E7',
      borderBottom: '1px solid rgba(200,135,12,.4)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent-soft)', flex: 'none' }} />
      <span style={{ fontSize: 13.5 }}>
        Estás viendo el dashboard de <b style={{ fontWeight: 700 }}>{cliente}</b> como administrador.
      </span>
      <button type="button" onClick={salir} disabled={saliendo}
        style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)', background: 'transparent',
          color: '#F3F0E7', cursor: saliendo ? 'default' : 'pointer', opacity: saliendo ? 0.6 : 1 }}>
        {saliendo ? 'Saliendo…' : 'Salir de la vista'}
      </button>
    </div>
  );
}
