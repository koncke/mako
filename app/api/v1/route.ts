// =============================================================================
// GET /api/v1 — el catálogo: qué puede pedir ESTE token
// =============================================================================
// Es la respuesta útil para quien llega sin saber qué hay: por área, cada operación
// con su verbo, su ruta, sus parámetros y cómo se confirma. Sale del registro, no
// se escribe. Lo que esta vista no puede pedir NO aparece (canal, alcance del
// token, capa del workspace, gating): a quien no le corresponde, no existe.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { catalogo } from '@/lib/api-mako/registro';
import { vistaDe } from '@/lib/api-mako/ejecutar';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const vista = await vistaDe(auth.ctx);
  return NextResponse.json({
    ok: true,
    version: 'v1',
    workspace: auth.ctx.ws,
    alcance: { nivel: auth.ctx.alcance, ...TEXTO_ALCANCE[auth.ctx.alcance] },
    como: {
      lecturas: 'GET /api/v1/{area}/{operacion}?param=valor (y ?formato= donde la operación lo admite)',
      acciones: 'POST /api/v1/{area}/{operacion} con el cuerpo en JSON → queda pendiente (la confirma una persona) o propuesta con link',
      pendientes: 'GET /api/v1/mako/listar_pendientes · POST /api/v1/mako/cancelar_accion · POST /api/v1/mako/confirmar_accion (solo con alcance «ejecutar»)',
      referencia: 'GET /api/v1/docs (markdown)',
    },
    areas: catalogo(vista),
  });
}
