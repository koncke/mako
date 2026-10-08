// =============================================================================
// GET /api/v1 — el catálogo: qué puede pedir ESTE token
// =============================================================================
// Es la respuesta útil para quien llega sin saber qué hay: por área, cada operación
// con su verbo, su ruta, sus parámetros y cómo se confirma. Sale del registro, no
// se escribe. Lo que esta vista no puede pedir NO aparece (canal, alcance del
// token, capa del workspace, gating): a quien no le corresponde, no existe.
//
// ⚠️ ENTERO PESA ~360 mil caracteres (~90k tokens, medido el 08/10/2026): un agente
// que lo pide de una se queda sin contexto antes de hacer nada. Por eso los filtros,
// todos ADITIVOS (sin ninguno, la respuesta es la de siempre):
//   ?compacto=1        → solo id, tipo, método, ruta y título (~23k caracteres)
//   ?area=crm,ads      → solo esas áreas
//   ?operacion=<id>    → una sola, con todo (parámetros, confirmación, gating)
// El camino barato para un agente: el índice compacto, y después `?operacion=` de
// la que va a usar.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { catalogo, esArea, porId, resumenDeOperacion, visible } from '@/lib/api-mako/registro';
import { vistaDe } from '@/lib/api-mako/ejecutar';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import { registrarLlamada } from '@/lib/api-mako/bitacora';
import { AREAS } from '@/lib/api-mako/tipos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SI = new Set(['1', 'true', 'si', 'sí']);

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const fin = (res: NextResponse): NextResponse => {
    registrarLlamada({ ws: auth.ctx.ws, operacion: 'catalogo', canal: 'http', ok: res.status < 400, status: res.status, ms: Date.now() - t0, req });
    return res;
  };
  const vista = await vistaDe(auth.ctx);
  const sp = req.nextUrl.searchParams;

  const pedidas = (sp.get('area') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const malas = pedidas.filter((a) => !esArea(a));
  if (malas.length) {
    return fin(NextResponse.json({ ok: false, error: `área desconocida: «${malas.join('», «')}»`, disponibles: AREAS }, { status: 400 }));
  }

  const operacion = (sp.get('operacion') ?? '').trim();
  if (operacion) {
    const def = porId(operacion);
    // El MISMO 404 para la que no existe y para la que este token no ve: si no, la
    // respuesta distinguiría «invisible» de «inventada».
    if (!def || !visible(def, vista) || (pedidas.length && !pedidas.includes(def.area))) {
      return fin(NextResponse.json({ ok: false, error: `«${operacion}» no existe para este token. Pide el índice: GET /api/v1?compacto=1` }, { status: 404 }));
    }
    return fin(NextResponse.json({ ok: true, version: 'v1', operacion: { area: def.area, ...resumenDeOperacion(def) } }));
  }

  const elegidas = catalogo(vista).filter((a) => !pedidas.length || pedidas.includes(a.area));
  const areas = SI.has((sp.get('compacto') ?? '').toLowerCase())
    ? elegidas.map((a) => ({
        area: a.area, titulo: a.titulo,
        operaciones: a.operaciones.map((o) => ({ id: o.id, tipo: o.tipo, metodo: o.metodo, ruta: o.ruta, titulo: o.titulo })),
      }))
    : elegidas;

  return fin(NextResponse.json({
    ok: true,
    version: 'v1',
    workspace: auth.ctx.ws,
    alcance: { nivel: auth.ctx.alcance, ...TEXTO_ALCANCE[auth.ctx.alcance] },
    como: {
      lecturas: 'GET /api/v1/{area}/{operacion}?param=valor (y ?formato= donde la operación lo admite)',
      acciones: 'POST /api/v1/{area}/{operacion} con el cuerpo en JSON → queda pendiente (la confirma una persona) o propuesta con link',
      pendientes: 'GET /api/v1/mako/listar_pendientes · POST /api/v1/mako/cancelar_accion · POST /api/v1/mako/confirmar_accion (solo con alcance «ejecutar»)',
      catalogo: 'GET /api/v1?compacto=1 (índice liviano) · ?area=crm,ads (solo esas áreas) · ?operacion=<id> (una, con sus parámetros)',
      referencia: 'GET /api/v1/docs (markdown)',
    },
    areas,
  }));
}
