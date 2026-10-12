'use client';

// =============================================================================
// SalirDeLaVista — la salida de «estás viendo la cuenta de un cliente», en /m
// =============================================================================
// En /m no se dibuja el banner de impersonación de escritorio (va adentro del
// chrome que /m apaga), así que sin esto el super admin o la agencia que entra a
// un cliente desde el teléfono no tiene por dónde volver. «Si la única salida vive
// adentro de una pantalla condicional, no hay salida» (AGENTS.md).
//
// Es la MISMA lógica que `salir()` de app/_components/ImpersonationBanner.tsx
// (85-92), con los mismos dos datos (`salida` y `modoAgencia`, que el server de
// /m resuelve con `salidaDeVista()` de lib/movil-guard.ts):
//   · el cliente viene del `?ws=` de la pestaña y no es la agencia → irse a una URL
//     SIN `?ws=`, no hay nada que borrar;
//   · si no, borrar la cookie por la puerta que corresponde (la agencia sale por
//     /api/agencia/entrar, el super admin por /api/admin/impersonate) y recién ahí
//     navegar. Un DELETE a la puerta equivocada deja la cookie y el cartel vuelve.
// =============================================================================

import { useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';

export function SalirDeLaVista({ salida, modoAgencia, variante = 'secondary', rotulo = 'Salir de la vista' }: {
  salida: string;
  modoAgencia: boolean;
  variante?: 'secondary' | 'tertiary';
  /** Nombra a quién se deja de mirar («Salir de Código Inmobiliario») cuando se sabe. */
  rotulo?: string;
}) {
  const ws = useWs();
  const [saliendo, setSaliendo] = useState(false);
  const salir = async () => {
    if (!modoAgencia && ws != null) { window.location.href = salida; return; }
    setSaliendo(true);
    try {
      await fetch(modoAgencia ? '/api/agencia/entrar' : '/api/admin/impersonate', { method: 'DELETE' });
      window.location.href = salida;
    } catch {
      setSaliendo(false);
    }
  };
  return (
    <Button variant={variante} size="md" full onClick={salir} loading={saliendo}>
      {rotulo}
    </Button>
  );
}
