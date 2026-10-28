// =============================================================================
// POST /api/copywriter/ia — MaKo en el Copywriter: «Discutir» (y «Editar», que escribe en el guion)
// =============================================================================
// El trabajo vive en lib/copywriter/ia.ts; acá la puerta, los archivos y el pase de campos. La puerta es la de
// /api/copywriter (`soloAdminDeTab('copywriter')` + `veCopywriter`): sin eso, quien no ve la tab usaba por acá la IA del
// negocio. Los archivos del mensaje llegan en multipart y se leen con el lector compartido de los chats
// (lib/adjuntos-del-chat.ts): al modelo va lo leído, nunca el archivo.
// maxDuration 120: «Discutir» corta a los 60 s y leer los archivos, a los 90 (lo de antes de llamar a la IA).
// =============================================================================

import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { veCopywriter } from '@/app/copywriter/acceso';
import { cuerpoYArchivos, leerLosArchivos } from '@/lib/adjuntos-del-chat';
import { discutir, FEATURE_COPY } from '@/lib/copywriter/ia';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const cerrada = await soloAdminDeTab('copywriter');
  if (cerrada) return cerrada;
  if (!(await veCopywriter())) return falla(404, 'No existe');

  const c = await cuerpoYArchivos(req);
  if (!c.ok) return falla(c.status, c.error);
  const b = c.body;
  const guion = (b.guion && typeof b.guion === 'object' ? b.guion : {}) as Record<string, unknown>;

  try {
    const leidos = c.adjuntos.length ? await leerLosArchivos(c.adjuntos, FEATURE_COPY) : { lecturas: [], noLeidos: [] };
    switch (b.accion) {
      case 'discutir': {
        const r = await discutir({ pregunta: b.pregunta, guion, charla: b.charla, lecturas: leidos.lecturas });
        if (!r.ok) return falla(r.status, r.error);
        return Response.json({ ...r, noLeidos: leidos.noLeidos }, { headers: { 'Cache-Control': 'no-store' } });
      }
      default:
        return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    console.error(`[copywriter/ia:${String(b.accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
