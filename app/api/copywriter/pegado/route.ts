// =============================================================================
// POST /api/copywriter/pegado — replicar lo que TRAE la persona: un link, un texto o un archivo (14/11/2026)
// =============================================================================
// El Cerebro, de la llamada con Julio: Copywriting replica «guion de reels, de historias, secuencias de historias, de YouTube, VSL…
// de tu competencia», no sólo los outliers. El trabajo vive en lib/copywriter/pegado-servidor.ts; acá la puerta, los archivos y el
// pase de campos.
//   { accion: 'replicar', tipo, texto } (+ archivos en multipart) → la página nueva, vacía, que replica lo traído;
//   { accion: 'transcribir', outlier: 'pegado:<n>' } → { guion: VistaGuion }: la transcripción de su video, en un `after()`, como la
//     de Competitors Spy (app/api/competitor-spy/transcribir); la pantalla vuelve a preguntar hasta que queda
//     (app/copywriter/transcribir-original.ts).
// La puerta es la de /api/copywriter (`soloAdminDeTab('copywriter')` + `veCopywriter`). Los archivos se leen con el lector de los
// chats (lib/adjuntos-del-chat.ts): un PDF, un Word, una captura de las historias (la lee la IA del negocio).
// =============================================================================

import { after } from 'next/server';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { veCopywriter } from '@/app/copywriter/acceso';
import { cuerpoYArchivos, leerLosArchivos } from '@/lib/adjuntos-del-chat';
import { FEATURE_COPY } from '@/lib/copywriter/ia';
import { asegurarGuionPegado, replicarPegado } from '@/lib/copywriter/pegado-servidor';
import { numeroDePegado } from '@/lib/copywriter/pegado';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { provsDe } from '@/lib/ai-cheap';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Leer los archivos (hasta 90 s) o bajar la página; y la transcripción de su video, de a tramos, en el `after()` (como Spy). */
export const maxDuration = 800;

const sinCache = { 'Cache-Control': 'no-store' };
const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: sinCache });

export async function POST(req: Request) {
  const cerrada = await soloAdminDeTab('copywriter');
  if (cerrada) return cerrada;
  if (!(await veCopywriter())) return falla(404, 'No existe');
  const ws = await getWorkspaceActual();
  if (ws == null) return falla(401, 'No autorizado');

  const c = await cuerpoYArchivos(req);
  if (!c.ok) return falla(c.status, c.error);
  const b = c.body;
  try {
    if (b.accion === 'replicar') {
      const leidos = c.adjuntos.length ? await leerLosArchivos(c.adjuntos, FEATURE_COPY) : { lecturas: [], noLeidos: [] };
      if (c.adjuntos.length && !leidos.lecturas.length && !(typeof b.texto === 'string' && b.texto.trim())) {
        return falla(422, `No pude leer ${leidos.noLeidos.join(', ') || 'el archivo'}.`);
      }
      const r = await replicarPegado({ tipo: b.tipo, texto: b.texto, lecturas: leidos.lecturas });
      if (!r.ok) return falla(r.status, r.error);
      return Response.json({ ...r, noLeidos: leidos.noLeidos }, { headers: sinCache });
    }
    if (b.accion === 'transcribir') {
      const n = numeroDePegado(typeof b.outlier === 'string' ? b.outlier : '');
      if (n == null) return falla(400, 'Pedido inválido');
      const hayGemini = () => runWithWorkspace(ws, () => conSuIADelNegocio(ws, async () => (await provsDe('gemini')).length > 0));
      const r = await asegurarGuionPegado(n, hayGemini);
      if (!r) return falla(404, 'Ese original ya no está.');
      const { trabajo } = r;
      if (trabajo) {
        const correr = () => runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => trabajo()));
        try { after(correr); } catch { void correr(); }
      }
      return Response.json({ ok: true, guion: r.vista }, { headers: sinCache });
    }
    return falla(400, 'Acción desconocida');
  } catch (e) {
    console.error(`[copywriter/pegado:${String(b.accion ?? '?')}]`, e instanceof Error ? e.message : e);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
