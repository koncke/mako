// =============================================================================
// /configuraciones/notificaciones — redirige a Settings › Notificaciones (25/10/2026)
// =============================================================================
// Hasta el 25/10/2026 era su propia página («Configuración del negocio» › Notificaciones: a quién le avisa MaKo lo del negocio),
// y el índice de Settings mostraba «Notificaciones» DOS veces (Martín lo marcó). Ahora las dos partes viven en
// /perfil/notificaciones; ésta queda porque acá caen los 49 avisos que dicen `/configuraciones?tab=notif` (lib/ajustes-secciones.ts
// → rutaDeTabVieja) y los links ya mandados. Con el mismo guard del negocio de antes, y el resto de la query (el `?ws=` del
// cliente que se mira). Va a la lista de canales, donde están WhatsApp y Email del negocio (desde el rediseño copiado de
// Linear del 25/10/2026 ya no hay un apartado `#negocio`).

import { redirect } from 'next/navigation';
import { requireRolWs } from '@/lib/tab-access';
import { conLaQuery } from '@/lib/ajustes-secciones';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotificacionesNegocioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRolWs([], { nav: 'configuraciones' });
  redirect(conLaQuery('/perfil/notificaciones', await searchParams));
}
