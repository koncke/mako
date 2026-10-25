// =============================================================================
// /admin/operaciones — lo que REDIRIGE va acá, ANTES del loader (25/10/2026, React #310)
// =============================================================================
// El caso de los tickets #7 y #9 (docs/hallazgos-infra.md): `./loading.tsx` es un Suspense que envuelve a la página, y un
// `redirect()` de ahí adentro va en el stream (200 + meta refresh, no 307), en carrera con la hidratación del router. La página
// redirige en dos casos de una carga directa: sin sesión de admin (a /inicio) y con el `?ws=` de un cliente (a SU Ops Center:
// un link del Ops Center de la plataforma abierto en la pestaña de un cliente). Este layout queda AFUERA del loader y hace lo
// mismo antes (307). La página conserva sus dos redirect para cuando se llega navegando (el layout no se vuelve a dibujar).
// La carpeta no tiene subrutas: no hace falta mirar qué ruta se pidió.
// =============================================================================

import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { RUTA_OPS_CENTER_NEGOCIO } from '@/lib/ops-center-ruta';
import { puedeOperar } from '@/lib/operaciones-reglas';

export default async function OperacionesLayout({ children }: { children: ReactNode }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  const propio = await wsSuperAdmin();
  // Quien no opera ve el cartel de permiso de la página: no se lo manda a ningún lado.
  if (puedeOperar(admin, propio)) {
    const ws = await getWorkspaceActual();
    if (ws != null && ws !== propio) redirect(await rutaConWs(RUTA_OPS_CENTER_NEGOCIO));
  }
  return children;
}
