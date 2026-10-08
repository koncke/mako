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
import { autenticar, esRespuesta, errorJson, VERSION_API } from '@/lib/api-mako/http';
import { rutaRestDe } from '@/lib/api-mako/rest';
import { permisoAceptado, CODIGO_NIVEL } from '@/lib/api-mako/permisos';
import { TEXTO_ALCANCE } from '@/lib/api-mako/alcance';
import { registrarLlamada } from '@/lib/api-mako/bitacora';
import { AREAS, type Area, type OperacionDef } from '@/lib/api-mako/tipos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SI = new Set(['1', 'true', 'si', 'sí']);

/** Lo que el catálogo suma a cada operación al estilo GitHub: su URL REST y el permiso que pide. */
const extras = (id: string, tipo: OperacionDef['tipo'], area: Area) => {
  const rest = rutaRestDe(id);
  return { ...(rest ? { rest: { metodo: rest.metodo, ruta: `/api/v1${rest.ruta}` } } : {}), permiso: permisoAceptado({ tipo, area }) };
};

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const fin = (res: NextResponse): NextResponse => {
    registrarLlamada({ ws: auth.ctx.ws, operacion: 'catalogo', canal: 'http', ok: res.status < 400, status: res.status, ms: Date.now() - t0, req, token: auth.token.clase === 'detallado' ? auth.token.id : 'principal' });
    for (const [k, v] of Object.entries(auth.cabeceras)) res.headers.set(k, v);
    return res;
  };
  const vista = await vistaDe(auth.ctx);
  const sp = req.nextUrl.searchParams;

  const pedidas = (sp.get('area') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const malas = pedidas.filter((a) => !esArea(a));
  if (malas.length) {
    return fin(errorJson(400, `Área desconocida: «${malas.join('», «')}».`, { disponibles: AREAS }));
  }

  const operacion = (sp.get('operacion') ?? '').trim();
  if (operacion) {
    const def = porId(operacion);
    // El MISMO 404 para la que no existe y para la que este token no ve: si no, la
    // respuesta distinguiría «invisible» de «inventada».
    if (!def || !visible(def, vista) || (pedidas.length && !pedidas.includes(def.area))) {
      return fin(errorJson(404, `«${operacion}» no existe para este token. Pide el índice: GET /api/v1?compacto=1`));
    }
    return fin(NextResponse.json({ ok: true, version: 'v1', operacion: { area: def.area, ...resumenDeOperacion(def), ...extras(def.id, def.tipo, def.area) } }));
  }

  const elegidas = catalogo(vista).filter((a) => !pedidas.length || pedidas.includes(a.area));
  const areas = SI.has((sp.get('compacto') ?? '').toLowerCase())
    ? elegidas.map((a) => ({
        area: a.area, titulo: a.titulo,
        operaciones: a.operaciones.map((o) => ({ id: o.id, tipo: o.tipo, metodo: o.metodo, ruta: o.ruta, titulo: o.titulo, ...extras(o.id, o.tipo, a.area) })),
      }))
    : elegidas.map((a) => ({ ...a, operaciones: a.operaciones.map((o) => ({ ...o, ...extras(o.id, o.tipo, a.area) })) }));

  return fin(NextResponse.json({
    ok: true,
    version: 'v1',
    workspace: auth.ctx.ws,
    version_api: VERSION_API,
    token: auth.token.clase === 'detallado'
      ? { clase: 'detallado', nombre: auth.token.nombre, expira: auth.token.expira, permisos: Object.fromEntries(Object.entries(auth.token.permisos).map(([k, v]) => [k, CODIGO_NIVEL[v as 'lectura' | 'escritura']])) }
      : { clase: 'clasico', alcance: { nivel: auth.ctx.alcance, ...TEXTO_ALCANCE[auth.ctx.alcance] } },
    alcance: { nivel: auth.ctx.alcance, ...TEXTO_ALCANCE[auth.ctx.alcance] },
    como: {
      lecturas: 'GET /api/v1/{area}/{operacion}?param=valor (y ?formato= donde la operación lo admite)',
      acciones: 'POST /api/v1/{area}/{operacion} con el cuerpo en JSON. Con un token detallado con escritura en el área se hace en el acto (lo que gasta plata deja una propuesta con link); con el token clásico queda pendiente o propuesta',
      rest: 'cada operación tiene además una URL por recurso con su verbo (campo `rest`): GET /api/v1/crm/leads/{leadId}, PUT /api/v1/crm/leads/{leadId}/etapa…',
      version: 'header X-MaKo-Api-Version (opcional; hoy ' + VERSION_API + ')',
      pendientes: 'GET /api/v1/mako/listar_pendientes · POST /api/v1/mako/cancelar_accion · POST /api/v1/mako/confirmar_accion (solo con alcance «ejecutar»)',
      catalogo: 'GET /api/v1?compacto=1 (índice liviano) · ?area=crm,ads (solo esas áreas) · ?operacion=<id> (una, con sus parámetros)',
      referencia: 'GET /api/v1/docs (markdown)',
    },
    areas,
  }));
}
