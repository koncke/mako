// =============================================================================
// /api/v1/{area}/{operacion} — UNA ruta para todas las operaciones de MaKo
// =============================================================================
// GET  → lectura, parámetros por query string (`?formato=` si la operación lo admite).
// POST → acción (queda pendiente o propuesta con link) o control (confirmar/cancelar).
//
// Es el choke point del transporte HTTP: resuelve el workspace por el bearer, arma
// el contexto y delega en `ejecutarOperacion`. Nada de lógica de negocio acá.
//
// Auth por bearer y sin cookie → está en `PUBLICOS` (lib/rutas-publicas.ts) como
// `/api/v1`. Ver lib/api-mako/http.ts. Es la ÚNICA ruta dinámica bajo /api/v1: las
// pendientes se listan, confirman y cancelan por las operaciones del área `mako`
// (`/api/v1/mako/listar_pendientes`, `/confirmar_accion`, `/cancelar_accion`), no
// por una carpeta aparte — dos puertas a lo mismo son dos formatos que divergen.
//
// ⚠️ LA BITÁCORA VA EN TODAS LAS SALIDAS, no solo en la feliz. Un token válido que
// tantea operaciones inexistentes (404), verbos equivocados (405) o cuerpos rotos
// (400/413) es justo lo que contesta «¿me filtraron el token?», y registrar después
// del último early-return mide cuántas veces funcionó, nunca cuántas se intentó.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { ejecutarOperacion, vistaDe } from '@/lib/api-mako/ejecutar';
import { porId, esArea, visible, disponiblesEn } from '@/lib/api-mako/registro';
import { autenticar, esRespuesta, responder, bodyJson, type Autenticado } from '@/lib/api-mako/http';
import { esLectura, type Formato, type OperacionDef } from '@/lib/api-mako/tipos';
import { registrarLlamada } from '@/lib/api-mako/bitacora';
import type { Vista } from '@/lib/api-mako/registro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Hay lecturas que salen a Meta, Chatwoot, Calendly o Fathom, y análisis que
// invocan un modelo. 60 s, el techo de la casa para lo que no es un cron.
export const maxDuration = 60;

type Params = Promise<{ area: string; operacion: string }>;

const FORMATOS: readonly Formato[] = ['json', 'md', 'csv', 'texto'];

type Resuelto = { def: OperacionDef; vista: Vista } | { respuesta: NextResponse };

/** La operación de la URL, o el 404. Se acepta el id o un alias declarado, y tiene
 *  que vivir en el área de la URL: un mismo dato por dos carpetas es dos formatos. */
async function resolver(auth: Autenticado, area: string, operacion: string): Promise<Resuelto> {
  const vista = await vistaDe(auth.ctx);
  const def = porId(operacion);
  const nombraBien = !!def && (def.id === operacion || (def.alias ?? []).includes(operacion));
  if (!esArea(area) || !def || !nombraBien || def.area !== area || !visible(def, vista)) {
    return {
      respuesta: NextResponse.json(
        { ok: false, error: `«${operacion}» no existe en «${area}». Pide el catálogo (GET /api/v1).`, ...(esArea(area) ? { disponibles: disponiblesEn(area, vista) } : {}) },
        { status: 404 },
      ),
    };
  }
  return { def, vista };
}

async function manejar(req: NextRequest, params: Params, metodo: 'GET' | 'POST'): Promise<NextResponse> {
  const t0 = Date.now();
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const { area, operacion } = await params;

  const fin = (res: NextResponse): NextResponse => {
    registrarLlamada({ ws: auth.ctx.ws, operacion: `${area}/${operacion}`.slice(0, 120), canal: 'http', ok: res.status < 400, status: res.status, ms: Date.now() - t0, req });
    return res;
  };

  const r = await resolver(auth, area, operacion);
  if ('respuesta' in r) return fin(r.respuesta);
  const { def, vista } = r;

  if (metodo === 'GET') {
    if (!esLectura(def)) return fin(NextResponse.json({ ok: false, error: `«${def.id}» va por POST con el cuerpo en JSON.` }, { status: 405 }));
    const input: Record<string, unknown> = {};
    req.nextUrl.searchParams.forEach((v, k) => { if (k !== 'formato') input[k] = v; });
    const formatoPedido = req.nextUrl.searchParams.get('formato');
    let formato: Formato | undefined;
    if (formatoPedido) {
      if (!def.formatos?.includes(formatoPedido as Formato) || !FORMATOS.includes(formatoPedido as Formato)) {
        return fin(NextResponse.json({ ok: false, error: `formato desconocido: «${formatoPedido}»`, disponibles: def.formatos ?? [] }, { status: 400 }));
      }
      formato = formatoPedido as Formato;
    }
    return fin(responder(await ejecutarOperacion(def.id, input, { ...auth.ctx, formato }, 'query', vista)));
  }

  if (esLectura(def)) return fin(NextResponse.json({ ok: false, error: `«${def.id}» es una lectura: va por GET con los parámetros en la URL.` }, { status: 405 }));
  const body = await bodyJson(req);
  if (esRespuesta(body)) return fin(body);
  return fin(responder(await ejecutarOperacion(def.id, body, auth.ctx, 'json', vista)));
}

export async function GET(req: NextRequest, ctx: { params: Params }) {
  return manejar(req, ctx.params, 'GET');
}

export async function POST(req: NextRequest, ctx: { params: Params }) {
  return manejar(req, ctx.params, 'POST');
}
