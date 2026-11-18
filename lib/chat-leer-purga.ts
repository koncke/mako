import 'server-only';

// =============================================================================
// Lo que un chat de MaKo subió para LEER y nunca leyó: se borra a las 24 horas (F96, 18/11/2026)
// =============================================================================
// `/api/chat/leer-archivo` arma `<ws>/chat-leer/<uuid>` en el bucket archivero, el navegador sube ahí y pide «leer», que lo
// borra en su `finally`. Si la pestaña se cerró entre subir y leer, el archivo quedaba para siempre (docs/hallazgos-second-brain.md:
// «lo subido para leer que nunca se lee… no hay purga»). La regla de la edad, en lib/subidas-colgadas.ts. Lo llama el cron
// /api/cron/limpieza-colgados.
// ⚠️ CRUZA NEGOCIOS a propósito (es limpieza de la plataforma): recorre la carpeta `chat-leer` de cada workspace por su número, y
//    nunca lee el contenido. Un negocio que falla no corta a los demás: queda en `fallas`.
// =============================================================================

import { getSupabaseServer } from './supabase';
import { listarWorkspaces } from './workspace';
import { CARPETA_LEER } from './chat-formatos';
import { viejosDeLaCarpeta } from './subidas-colgadas';

const BUCKET = 'archivero';
const POR_VUELTA = 100;
const VUELTAS = 10;

export async function barrerLecturasSinLeer(ahora = Date.now()): Promise<{ borrados: number; fallas: string[] }> {
  const storage = getSupabaseServer().storage.from(BUCKET);
  const fallas: string[] = [];
  let borrados = 0;
  for (const w of await listarWorkspaces()) {
    const carpeta = `${w.id}/${CARPETA_LEER}`;
    try {
      for (let v = 0; v < VUELTAS; v += 1) {
        // Siempre desde el principio: lo viejo se borra, así que la tanda siguiente ya es la de después.
        const { data, error } = await storage.list(carpeta, { limit: POR_VUELTA, sortBy: { column: 'created_at', order: 'asc' } });
        if (error) throw new Error(error.message);
        const viejos = viejosDeLaCarpeta(data ?? [], ahora);
        if (!viejos.length) break;
        const { error: noBorro } = await storage.remove(viejos.map((n) => `${carpeta}/${n}`));
        if (noBorro) throw new Error(noBorro.message);
        borrados += viejos.length;
        if (viejos.length < POR_VUELTA) break;
      }
    } catch (e) {
      fallas.push(`ws ${w.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { borrados, fallas };
}
