// =============================================================================
// La puerta de /newsletters: mientras siga en PRONTO, sólo la plataforma
// =============================================================================
// La revisión de envíos y privacidad (30/10/2026, M1): `adminOnly` en app/_components/nav.ts sólo esconde la fila de la barra.
// La puerta del server era `requireRolWs([], { nav: 'newsletters' })`, y `[]` deja pasar al admin de CADA negocio con capa
// completo o agencia: escribiendo /newsletters entraba a la tab entera. Acá se cierra de verdad, con el mismo guard de las
// demás pantallas de la plataforma (`getSesionAdmin`, ver lib/tab-access.ts) y sin impersonar: mirando a un cliente, lo que se
// escribe es de ESE negocio. La API la cierra `soloPlataforma` (lib/api-mako/areas/email.def.ts).
// Sacarla de PRONTO para todos es la decisión del go-live del email, que es de Martín: se saca esto y aquello.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { requireRolWs } from '@/lib/tab-access';

export async function puertaNewsletter(): Promise<void> {
  await requireRolWs([], { nav: 'newsletters' });
  if (!(await getSesionAdmin()) || (await estaImpersonando())) redirect('/');
}
