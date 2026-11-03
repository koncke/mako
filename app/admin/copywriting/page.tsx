// =============================================================================
// /admin/copywriting — redirige al Copywriter (29/10/2026)
// =============================================================================
// Martín (29/10/2026): «Elimina esto […], no quiero ninguna mención en todo MaKo»: la pantalla del método de redacción
// se fue, sin fila ni link. La ruta queda (links viejos) y lleva al Copywriter. Lo que la IA lee de ese método (la
// metodología y el swipe de ejemplos, lib/copywriting-metodo.ts, con lo ya guardado) sigue igual.
// docs/diseno-copywriter.md, D15.
// =============================================================================

import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export default async function CopywritingPage() {
  redirect(await rutaConWs('/copywriter'));
}
