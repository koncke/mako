// =============================================================================
// /login/2fa — el segundo paso del login
// =============================================================================
// Llega acá quien pasó Google y necesita segundo factor: el super admin siempre, y
// cualquiera que lo haya activado. Sin el paso intermedio (`mako_preauth`, 15 minutos)
// no hay nada que hacer acá: vuelve a /login. La pantalla en sí es SegundoPaso, que
// habla con /api/auth/2fa.
//
// Es pública por prefijo (`/login` en lib/rutas-publicas.ts) y sólo se LEE: la página
// no escribe nada, todo lo que escribe es la ruta de la API.
//
// El envoltorio es el MISMO que /login y /login/restablecer (./../_ui/TarjetaLogin):
// las tres eran la misma tarjeta copiada a mano y ya se habían ido corriendo entre
// ellas (380 px acá, 400 allá; el mismo logo dibujado de dos formas). El título de
// cada sub-pantalla lo pone SegundoPaso, que es quien sabe en cuál está.

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PREAUTH_COOKIE, verificarPreauth } from '@/lib/auth-session';
import { TarjetaLogin } from '../_ui/TarjetaLogin';
import { SegundoPaso } from './SegundoPaso';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Segundo paso · MaKo', robots: { index: false } };

export default async function SegundoPasoPage() {
  const pre = verificarPreauth((await cookies()).get(PREAUTH_COOKIE)?.value);
  if (!pre) redirect('/login?error=mfa-vencido');
  return (
    // De quién es la sesión que se está abriendo va DEBAJO de la tarjeta: es contexto,
    // no el título. Arriba competía con «App de autenticación», que es lo que hay que hacer.
    <TarjetaLogin pie={<>Entrando como <strong>{pre.email}</strong></>}>
      <SegundoPaso cuenta={pre.email} />
    </TarjetaLogin>
  );
}
