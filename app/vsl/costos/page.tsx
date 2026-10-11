import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import Costos from './Costos';

// Documento INTERNO de costos: qué paga MaKo por mes. Desde el 10/10/2026 es SÓLO
// para el super admin (decisión de Martín: «¿Hacemos privada /vsl/costos?» → «Privada»).
// Hasta ese día se abría sin login para mandárselo por link a Mauricio, que es un
// CLIENTE: el link que ya tiene deja de abrir.
//
// ⚠️ EL GUARD VIVE ACÁ, NO EN EL PROXY: la página cae bajo '/vsl', que está en PUBLICOS
// (lib/rutas-publicas.ts) por la landing, así que el proxy la deja pasar sin sesión.
// `getSesionAdmin` lee la cookie firmada, que llega igual en una ruta pública. Es el
// mismo guard que /admin/estrategia y /admin/runway: el rol de AGENCIA, no `rol_ws`
// (que vale 'admin' para el dueño de cada workspace y la abriría a todos los clientes).
//
// ⚠️ Los montos están escritos a mano, con la fecha de medición a la vista en el
// pie. NO se conectan a las APIs de facturación a propósito: esto es una foto
// fechada para una conversación, no un tablero en vivo. Si alguna vez se vuelve
// un tablero, el lugar es /admin/dev/pricing, que ya existe.
export const metadata: Metadata = {
  title: 'MaKo — Qué pagamos por mes · Interno',
  description:
    'Documento interno: todos los servicios que paga MaKo, qué cambió en agosto de 2026, quién paga qué y qué esperar cada mes.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  return <Costos />;
}
