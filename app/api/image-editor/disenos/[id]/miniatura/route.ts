// =============================================================================
// PUT /api/image-editor/disenos/<id>/miniatura — la miniatura de la primera página
// =============================================================================
// El cuerpo es la imagen cruda (WebP, PNG o JPG, hasta TOPE_MINIATURA_BYTES). Pesa decenas de KB:
// cabe en una función y no hace falta la subida firmada. Se verifica por magic bytes en el server.

import { guardarMiniatura, mal, puerta } from '@/lib/image-editor/server';
import { TOPE_MINIATURA_BYTES } from '@/lib/image-editor/reglas';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const declarado = Number(req.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > TOPE_MINIATURA_BYTES) return mal('La miniatura es demasiado grande', 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length) return mal('Falta la imagen');
  if (bytes.length > TOPE_MINIATURA_BYTES) return mal('La miniatura es demasiado grande', 413);
  const { status, ...r } = await guardarMiniatura(p.ws, (await params).id, bytes);
  return Response.json(r, { status: status ?? 200 });
}
