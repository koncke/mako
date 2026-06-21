// =============================================================================
// /api/mako/knowledge — CRUD del conocimiento de MaKo (RAG)
// =============================================================================

import type { NextRequest } from 'next/server';
import { listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, reindexKnowledge } from '@/lib/mako-knowledge';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    return Response.json({ entries: await listKnowledge() });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; id?: number; titulo?: string; categoria?: string | null; cuerpo?: string; activo?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  try {
    switch (body.action) {
      case 'create':
        if (!body.titulo?.trim()) return Response.json({ error: 'titulo requerido' }, { status: 400 });
        return Response.json({ entry: await createKnowledge({ titulo: body.titulo, categoria: body.categoria, cuerpo: body.cuerpo ?? '', activo: body.activo }) });
      case 'update':
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        return Response.json({ entry: await updateKnowledge(body.id, body) });
      case 'delete':
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        await deleteKnowledge(body.id);
        return Response.json({ ok: true });
      case 'reindex':
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        return Response.json({ entry: await reindexKnowledge(body.id) });
      default:
        return Response.json({ error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
