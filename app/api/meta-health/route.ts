// =============================================================================
// /api/meta-health — estado de entrega en vivo de Meta (cuenta + campañas +
// conjuntos + anuncios + sugerencias). Live, sin tocar Supabase.
// =============================================================================
// Lo consume la vista /marketing/salud para el botón "Actualizar" (refetch del
// lado cliente). El Semáforo de /general NO pasa por acá: llama la lib directo.

import { getMetaHealth } from '@/lib/meta-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await getMetaHealth();
    return Response.json(health);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
