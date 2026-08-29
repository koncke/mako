'use client';

// =============================================================================
// YaLogueado — lo que ve alguien que abre /login con la sesión ya abierta
// =============================================================================
// Antes /login le mostraba "Entrá al dashboard" y el botón de Google a alguien que
// YA estaba adentro: parecía que se había deslogueado. Ahora se le avisa quién es
// y se lo lleva solo.
//
// El destino es /inicio, el repartidor por rol (admin sin impersonar → /admin;
// closer/setter → /crm; onboarding pendiente → /onboarding; el resto → /general).
// No se duplica esa lógica acá: si mañana cambia, cambia en un solo lugar.

import { useEffect, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';

const DESTINO = '/inicio';
const ESPERA_MS = 1200; // suficiente para leer el aviso, poco para no estorbar

export function YaLogueado({ nombre, email }: { nombre: string; email: string }) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    // Si tocó "entrar con otra cuenta", NO lo arrastremos al tablero.
    if (saliendo) return;
    const t = setTimeout(() => { setYendo(true); router.replace(DESTINO); }, ESPERA_MS);
    return () => clearTimeout(t);
  }, [router, saliendo]);

  const quien = nombre?.trim() || email;

  return (
    <>
      <div style={{ fontSize: '14px', color: '#5B6472', marginBottom: '6px' }}>
        Ya tienes la sesión abierta como <strong style={{ color: '#14161B' }}>{quien}</strong>.
      </div>
      <div style={{ fontSize: '13px', color: '#8A93A1', marginBottom: '20px' }}>
        {yendo ? 'Entrando…' : 'Te llevamos a tu tablero.'}
      </div>
      <button
        onClick={() => { setYendo(true); router.replace(DESTINO); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          padding: '12px', borderRadius: '11px', border: 'none', background: '#2F6FED',
          color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box',
        }}
      >
        Ir a mi tablero
      </button>
      {/* Salida para el caso real de "quiero entrar con otra cuenta". Sin esto, alguien
          con la sesión abierta no tendría forma de llegar al botón de Google.
          Ojo: /api/auth/logout devuelve JSON, no redirige — si esto fuera un <form>
          nativo el usuario terminaría mirando {"ok":true}. Se navega a mano, igual
          que el botón de cerrar sesión del sidebar. */}
      <button
        onClick={async () => {
          setSaliendo(true);
          try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* igual salimos */ }
          // location, no router: hay que releer la cookie borrada desde el server.
          window.location.href = '/login';
        }}
        disabled={saliendo}
        style={{
          marginTop: '12px', width: '100%', padding: '10px', borderRadius: '11px',
          border: '1px solid rgba(0,0,0,.14)', background: 'transparent', color: '#5B6472',
          fontSize: '13.5px', fontWeight: 600, cursor: saliendo ? 'default' : 'pointer',
          boxSizing: 'border-box', opacity: saliendo ? 0.6 : 1,
        }}
      >
        {saliendo ? 'Cerrando sesión…' : 'Entrar con otra cuenta'}
      </button>
    </>
  );
}
