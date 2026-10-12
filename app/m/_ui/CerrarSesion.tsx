'use client';

// =============================================================================
// CerrarSesion — el mismo cierre que el del Sidebar de escritorio
// (app/_components/Sidebar.tsx: POST /api/auth/logout y a /login)
// =============================================================================
// /login va SIN `?ws=`, a propósito: es la única navegación de la casa que no lo
// lleva (sin sesión no hay pestaña que preservar, y arrastrar el id de un cliente
// a una URL que se comparte sola diría a quién se estaba mirando).
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { soltarDeEstaCuenta } from '@/lib/push-cliente';

export function CerrarSesion({ variante = 'tertiary' }: { variante?: 'secondary' | 'tertiary' }) {
  const [saliendo, setSaliendo] = useState(false);
  const salir = async () => {
    setSaliendo(true);
    // ANTES del logout (necesita la sesión): este teléfono deja de recibir los avisos de quien
    // sale. Sin esto seguían llegando a la pantalla bloqueada de un teléfono sin sesión.
    await soltarDeEstaCuenta();
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* igual se va al login */ }
    window.location.href = '/login';
  };
  return (
    <Button variant={variante} size="md" full onClick={salir} loading={saliendo}>
      Cerrar sesión
    </Button>
  );
}
