// =============================================================================
// /admin/guiones — Copywriting › Angles & Structures: las dos bibliotecas globales de Ads Writer (sólo el super admin)
// =============================================================================
// Los ángulos y las estructuras con que escribe Ads Writer. Del 27/09 al 25/10/2026 vivían como sub-tabs de la página de
// Dev de Ads Writer (/admin/dev/ads-writer) y esta ruta redirigía ahí. Dev se fue: se dibujan acá, y la barra las ofrece
// como sección de Copywriting (nav.ts → HERRAMIENTAS.guiones). La ruta es la de siempre: está en tareas, docs y links.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { rutaConWs } from '@/lib/workspace';
import { GuionesAdminView } from './GuionesAdminView';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Angles & Structures · Copywriting' };

// Hasta el 25/10/2026 redirigía a la página de Dev de Ads Writer, el ÚNICO lugar donde se editaban estas dos bibliotecas.
// Dev se fue (Martín: «Elimina "dev", ya no lo necesitamos»): se dibujan acá, como sección de Copywriting (nav.ts →
// HERRAMIENTAS.guiones), con la misma puerta que el resto de la plataforma. Las rutas de datos son las de siempre.
export default async function GuionesAdminPage() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs('/inicio'));
  return <GuionesAdminView />;
}
