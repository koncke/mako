'use client';

// Cerrar sesión desde /cuenta-pausada: el mismo pedido que el menú de la barra lateral (que acá no se dibuja).
export function SalirDeLaCuenta() {
  return (
    <button type="button"
      onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null); window.location.href = '/login'; }}
      style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 'var(--fs-sm)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
      Cerrar sesión
    </button>
  );
}
