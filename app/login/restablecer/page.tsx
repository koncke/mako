// =============================================================================
// /login/restablecer — el link de «Olvidé mi contraseña» (15/10/2026)
// =============================================================================
// El token viene en el FRAGMENTO del link (`#t=…`), así que el server nunca lo ve: esta página no
// lee nada y todo lo hace la pantalla (Restablecer), que habla con /api/auth/restablecer.
// Es pública por prefijo (`/login` en lib/rutas-publicas.ts) y sólo se LEE.
//
// La tarjeta es la MISMA de /login y /login/2fa (../_ui/TarjetaLogin): acá estaba copiada por
// tercera vez, con su propio logo y sus propios hexes. El título lo pone Restablecer, que es quien
// sabe si el link sirve, si hay que crear la contraseña o si ya está.

import type { Metadata } from 'next';
import { TarjetaLogin } from '../_ui/TarjetaLogin';
import { Restablecer } from './Restablecer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Restablecer la contraseña · MaKo', robots: { index: false } };

export default function RestablecerPage() {
  return (
    <TarjetaLogin>
      <Restablecer />
    </TarjetaLogin>
  );
}
