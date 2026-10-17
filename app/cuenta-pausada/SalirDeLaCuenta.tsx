'use client';

// Las salidas de /cuenta-pausada (la barra lateral acá no se dibuja):
//   · la AGENCIA que miraba a un cliente pausado vuelve a lo suyo: borra la cookie de la vista de agencia (el mismo
//     pedido que «Salir del cliente», app/api/agencia/entrar) y va a /partners;
//   · cualquiera puede cerrar sesión (el mismo pedido que el menú de la barra lateral).
export function SalirDeLaCuenta({ esAgencia }: { esAgencia: boolean }) {
  const boton = { background: 'none', border: 'none', color: 'var(--dim)', fontSize: 'var(--fs-sm)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' } as const;
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
      {esAgencia && (
        <button type="button" style={boton}
          onClick={async () => { await fetch('/api/agencia/entrar', { method: 'DELETE' }).catch(() => null); window.location.href = '/partners'; }}>
          Volver a tu agencia
        </button>
      )}
      <button type="button" style={boton}
        onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null); window.location.href = '/login'; }}>
        Cerrar sesión
      </button>
    </div>
  );
}
