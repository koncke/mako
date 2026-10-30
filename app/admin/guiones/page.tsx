// =============================================================================
// /admin/guiones — redirige al Copywriter (29/10/2026)
// =============================================================================
// Martín (29/10/2026): «Elimina esto […], no quiero ninguna mención en todo MaKo»: la pantalla de las bibliotecas de
// ángulos y estructuras se fue, sin fila ni link. La ruta queda (está en tareas, docs y links viejos) y lleva al
// Copywriter. Lo que la IA lee de esas bibliotecas (lib/guion-angulos-store.ts, lib/guion-estructuras-store.ts, con sus
// overrides guardados) sigue igual. docs/diseno-copywriter.md, D15.
// =============================================================================

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function GuionesAdminPage() {
  redirect(await rutaConWs('/copywriter'));
}
