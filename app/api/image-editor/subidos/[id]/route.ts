// DELETE /api/image-editor/subidos/<id> — saca un archivo de «Subidos» (el archivo queda en el
// bucket: un diseño lo puede estar usando). Ver lib/image-editor/server.ts.

import { borrarSubido, puerta } from '@/lib/image-editor/server';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const { status, ...r } = await borrarSubido(p.ws, (await params).id);
  return Response.json(r, { status: status ?? 200 });
}
