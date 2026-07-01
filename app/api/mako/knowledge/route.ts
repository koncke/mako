// =============================================================================
// /api/mako/knowledge — CRUD del conocimiento de MaKo (RAG) + cursos curados
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge, reindexKnowledge,
  setCursoActivo, cursoExiste,
} from '@/lib/mako-knowledge';
import { CURATED_CURSOS, getCuratedCurso } from '@/lib/mako-knowledge-seed';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  try {
    const entries = await listKnowledge();
    // Cursos curados listos para importar (con flag de si ya se bajaron a tierra).
    const curados = await Promise.all(
      CURATED_CURSOS.map(async (c) => ({
        clave: c.clave, curso: c.curso, autor: c.autor, area: c.area,
        descripcion: c.descripcion, cantidad: c.entradas.length,
        importado: await cursoExiste(c.curso),
      })),
    );
    return Response.json({ entries, curados });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: {
    action?: string; id?: number; clave?: string;
    titulo?: string; categoria?: string | null; cuerpo?: string;
    curso?: string | null; autor?: string | null; area?: string; fuente?: string;
    activo?: boolean;
  };
  try { body = await req.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  try {
    switch (body.action) {
      case 'create':
        if (!body.titulo?.trim()) return Response.json({ error: 'titulo requerido' }, { status: 400 });
        return Response.json({ entry: await createKnowledge({
          titulo: body.titulo, categoria: body.categoria, cuerpo: body.cuerpo ?? '',
          curso: body.curso, autor: body.autor, area: body.area, fuente: body.fuente, activo: body.activo,
        }) });
      case 'update': {
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        const entry = await updateKnowledge(body.id, body);
        if (!entry) return Response.json({ error: 'entrada no encontrada' }, { status: 404 });
        return Response.json({ entry });
      }
      case 'delete':
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        await deleteKnowledge(body.id);
        return Response.json({ ok: true });
      case 'reindex': {
        if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 });
        const entry = await reindexKnowledge(body.id);
        if (!entry) return Response.json({ error: 'entrada no encontrada' }, { status: 404 });
        return Response.json({ entry });
      }
      case 'set_curso_activo':
        if (!body.curso) return Response.json({ error: 'curso requerido' }, { status: 400 });
        await setCursoActivo(body.curso, body.activo !== false);
        return Response.json({ ok: true });
      case 'seed_curso': {
        // Importa (baja a tierra) un curso curado: crea + embebe cada entrada.
        const curado = getCuratedCurso(body.clave ?? '');
        if (!curado) return Response.json({ error: 'curso curado desconocido' }, { status: 400 });
        if (await cursoExiste(curado.curso)) return Response.json({ ok: true, yaExistia: true, importadas: 0 });
        let importadas = 0;
        for (const e of curado.entradas) {
          await createKnowledge({
            titulo: e.titulo, categoria: e.categoria, cuerpo: e.cuerpo,
            curso: curado.curso, autor: curado.autor, area: curado.area, fuente: 'manual', activo: true,
          });
          importadas++;
        }
        return Response.json({ ok: true, importadas });
      }
      default:
        return Response.json({ error: 'action inválida' }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}
