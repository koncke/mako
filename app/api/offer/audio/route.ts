// =============================================================================
// GET /api/offer/audio?id=<sesionId>&m=<mensajeId> — reproduce el audio de un mensaje de la tab Offer
// =============================================================================
// Redirige (302) a una URL firmada de Storage del binario del mensaje, que vive en el bucket privado
// `archivero` en `<ws>/offer/<uuid>` (molde: app/api/doc/route.ts). La URL es lo que va en
// `OfferMensaje.audio.url` (lib/offer-reglas.ts → urlAudio): la ruta interna de Storage nunca baja al
// navegador.
//
// ⚠️ GATE: `adminDeWorkspaceActual()` + `runWithWorkspace`, igual que POST /api/offer. La conversación se
//    lee con `getTenantDb` (offer_sesiones está en TENANT_TABLES): una sesión de otro negocio no existe acá.
//    Y además el path tiene que empezar con el workspace propio: aunque la fila es del negocio, el `path`
//    salió del navegador cuando se mandó el turno (se validó ahí también; acá se vuelve a mirar, porque lo
//    que se firma es lo que decide).
// ⚠️ Un `<audio src>` no es un fetch: el parche de WsFetch no le pega el `?ws=`. La pantalla lo agrega con
//    `conWs(url, useWs())`; sin él, el super admin que mira a un cliente recibe 403.
// =============================================================================

import type { NextRequest } from 'next/server';
import { adminDeWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { leerFila } from '@/lib/offer-sesiones';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Lo que dura la URL firmada: alcanza para reproducir un audio largo sin volver a pedirla. */
const SEGUNDOS_FIRMA = 600;

const no = (status: number, error: string) => Response.json({ ok: false, error }, { status });

export async function GET(req: NextRequest) {
  const ws = await adminDeWorkspaceActual();
  if (ws == null) return no(403, 'Sólo el admin del negocio puede escuchar los audios de Offer.');
  const sp = req.nextUrl.searchParams;
  const id = Number(sp.get('id'));
  const mensajeId = (sp.get('m') ?? '').trim();
  if (!Number.isInteger(id) || id <= 0) return no(400, 'Falta qué conversación.');
  if (!mensajeId) return no(400, 'Falta qué mensaje.');

  return runWithWorkspace(ws, async () => {
    try {
      const fila = await leerFila(id);
      if (!fila) return no(404, 'No encontré esa conversación. Puede que la hayan borrado.');
      const path = fila.mensajes.find((m) => m.id === mensajeId)?.audio?.path ?? null;
      if (!path) return no(404, 'Ese mensaje no tiene audio.');
      if (!new RegExp(`^${ws}/offer/[0-9a-f-]{36}$`).test(path)) return no(404, 'Ese mensaje no tiene audio.');
      const { data, error } = await getSupabaseServer().storage.from('archivero').createSignedUrl(path, SEGUNDOS_FIRMA);
      if (error || !data?.signedUrl) {
        console.error('[offer:audio] no pude firmar', path, error?.message);
        return no(502, 'No pude abrir el audio (falló el almacenamiento de MaKo, no es tu audio). Prueba de nuevo en un momento.');
      }
      return Response.redirect(data.signedUrl, 302);
    } catch (e) {
      console.error('[offer:audio]', e);
      return no(500, `Algo falló de nuestro lado al abrir el audio: ${e instanceof Error ? e.message : String(e)}.`);
    }
  });
}
