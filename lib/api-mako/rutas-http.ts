// =============================================================================
// api-mako/rutas-http — lo que hacen las rutas de /api/v1 después de autenticar
// =============================================================================
// Dos formas de nombrar la misma operación, una sola ejecución:
//   · la de siempre:   GET|POST /api/v1/{area}/{operacion}
//   · la REST (alias): GET|POST|PATCH|PUT|DELETE /api/v1/{area}/{recurso}/… (lib/api-mako/rest.ts)
// Las dos terminan en `correr()`, que es el único lugar que decide CÓMO corre una
// operación para un token:
//   · LECTURA → `ejecutarOperacion`, con ETag (http.ts).
//   · ACCIÓN con un token CLÁSICO (el principal de la skill) → propone, como siempre: una
//     pendiente o una propuesta que confirma una persona.
//   · ACCIÓN con un token DETALLADO (que llegó hasta acá, o sea que tiene «Lectura y
//     escritura» en el área) → la ESCRIBE EN EL ACTO, como GitHub (decisión de Martín del
//     08/10/2026), por `aplicarEnElActo` (lib/api-mako/flujo.ts): el mismo camino con que la
//     confirma un flujo. No hay un segundo camino de escritura.
//   · ...salvo lo que cuesta PLATA (`costo: 'dinero'`): propone y devuelve el link a la
//     pantalla, también con un token detallado (la opción que Martín eligió: «lo que gasta
//     plata sigue yendo a una pantalla»).
//
// ⚠️ LA BITÁCORA VA EN TODAS LAS SALIDAS, no solo en la feliz. Un token válido que tantea
// operaciones inexistentes (404), verbos equivocados (405) o cuerpos rotos (400/413) es
// justo lo que contesta «¿me filtraron el token?».
// =============================================================================

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { ejecutarOperacion, vistaDe } from './ejecutar';
import { porId, esArea, visible, disponiblesEn, type Vista } from './registro';
import { bodyJson, errorJson, esRespuesta, responder, type Autenticado } from './http';
import { esAccion, esLectura, type Area, type Formato, type OperacionDef } from './tipos';
import { registrarLlamada } from './bitacora';
import { resolverRest } from './rest';
import { validarInput } from './validar';
import { aplicarEnElActo } from './flujo';
import { permisoAceptado } from './permisos';

const FORMATOS: readonly Formato[] = ['json', 'md', 'csv', 'texto'];
export const METODOS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;
export type Metodo = (typeof METODOS)[number];

/** Lo que vino por la query string, sin `formato` (que es un control, no un parámetro). */
const deQuery = (req: NextRequest): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  req.nextUrl.searchParams.forEach((v, k) => { if (k !== 'formato') out[k] = v; });
  return out;
};

/** Un texto de error que huele a infraestructura nuestra no viaja a un tercero. */
const esNuestro = (msg: string): boolean =>
  /api-mako:|fetch failed|ECONN|timeout|supabase|PGRST|permission denied|relation .* does not exist|column .* does not exist|violates .*constraint|duplicate key|syntax error/i.test(msg);

function registrar(req: NextRequest, auth: Autenticado, operacion: string, t0: number, res: NextResponse): NextResponse {
  registrarLlamada({
    ws: auth.ctx.ws, operacion: operacion.slice(0, 120), canal: 'http', ok: res.status < 400, status: res.status,
    ms: Date.now() - t0, req, token: auth.token.clase === 'detallado' ? auth.token.id : 'principal',
  });
  return res;
}

/** GET|POST /api/v1/{area}/{operacion} — la ruta de siempre. */
export async function manejarOperacion(req: NextRequest, auth: Autenticado, area: string, operacion: string, metodo: Metodo): Promise<NextResponse> {
  const t0 = Date.now();
  const vista = await vistaDe(auth.ctx);
  const def = porId(operacion);
  const nombraBien = !!def && (def.id === operacion || (def.alias ?? []).includes(operacion));
  if (!esArea(area) || !def || !nombraBien || def.area !== area) {
    // ¿Es una ruta REST de dos segmentos (`/crm/leads`)? El router viejo gana si el segundo
    // segmento es una operación (el test de rest.ts fija que nunca choquen).
    if (esArea(area)) return manejarRest(req, auth, [area, operacion], metodo, t0, vista);
    return registrar(req, auth, `${area}/${operacion}`, t0, errorJson(404, `«${operacion}» no existe en «${area}». Pide el índice: GET /api/v1?compacto=1`, {}, auth.cabeceras));
  }
  if (!visible(def, vista)) return registrar(req, auth, `${area}/${operacion}`, t0, noVisible(auth, def, vista, `«${operacion}»`, area));
  if (metodo === 'GET' && !esLectura(def)) {
    return registrar(req, auth, `${area}/${operacion}`, t0, errorJson(405, `«${def.id}» va por POST con el cuerpo en JSON.`, {}, { ...auth.cabeceras, Allow: 'POST' }, def));
  }
  if (metodo === 'POST' && esLectura(def)) {
    return registrar(req, auth, `${area}/${operacion}`, t0, errorJson(405, `«${def.id}» es una lectura: va por GET con los parámetros en la URL.`, {}, { ...auth.cabeceras, Allow: 'GET' }, def));
  }
  if (metodo !== 'GET' && metodo !== 'POST') {
    return registrar(req, auth, `${area}/${operacion}`, t0, errorJson(405, `«${def.id}» va por ${esLectura(def) ? 'GET' : 'POST'}.`, {}, { ...auth.cabeceras, Allow: esLectura(def) ? 'GET' : 'POST' }, def));
  }
  let input: Record<string, unknown>;
  if (metodo === 'GET') input = deQuery(req);
  else {
    const b = await bodyJson(req, auth.cabeceras);
    if (esRespuesta(b)) return registrar(req, auth, `${area}/${operacion}`, t0, b);
    input = b;
  }
  return registrar(req, auth, `${def.area}/${def.id}`, t0, await correr(req, auth, def, vista, input, metodo === 'GET' ? 'query' : 'json'));
}

/** Cualquier ruta REST (lib/api-mako/rest.ts): /api/v1/{area}/{recurso}/… */
export async function manejarRest(req: NextRequest, auth: Autenticado, segmentos: string[], metodo: Metodo, t0 = Date.now(), vistaPrevia?: Vista): Promise<NextResponse> {
  const ruta = `/${segmentos.join('/')}`;
  const r = resolverRest(metodo, segmentos);
  if (!r) return registrar(req, auth, ruta, t0, errorJson(404, `No existe ${metodo} ${ruta}. Pide el índice: GET /api/v1?compacto=1`, {}, auth.cabeceras));
  // Un verbo que la ruta no acepta es 404, no 405: GitHub tampoco confirma qué existe.
  if ('metodosPermitidos' in r) return registrar(req, auth, ruta, t0, errorJson(404, `No existe ${metodo} ${ruta}. Pide el índice: GET /api/v1?compacto=1`, {}, auth.cabeceras));
  const def = porId(r.operacion);
  const vista = vistaPrevia ?? await vistaDe(auth.ctx);
  if (!def) return registrar(req, auth, ruta, t0, errorJson(404, `No existe ${metodo} ${ruta}. Pide el índice: GET /api/v1?compacto=1`, {}, auth.cabeceras));
  if (!visible(def, vista)) return registrar(req, auth, `${def.area}/${def.id}`, t0, noVisible(auth, def, vista, `${metodo} ${ruta}`));
  let input: Record<string, unknown>;
  if (metodo === 'GET') input = { ...deQuery(req), ...r.params };
  else {
    const b = await bodyJson(req, auth.cabeceras);
    if (esRespuesta(b)) return registrar(req, auth, `${def.area}/${def.id}`, t0, b);
    // Un DELETE con cuerpo lo descartan algunos clientes: también se aceptan los parámetros
    // por la query. Los de la ruta ganan siempre: son los que nombran el recurso.
    input = { ...(metodo === 'DELETE' ? deQuery(req) : {}), ...b, ...r.params };
  }
  return registrar(req, auth, `${def.area}/${def.id}`, t0, await correr(req, auth, def, vista, input, metodo === 'GET' ? 'query' : 'json'));
}

/**
 * La operación no existe para este token. Dos respuestas, como GitHub:
 *   · si el ÚNICO motivo es el permiso del área de un token detallado → 403 «Recurso no
 *     accesible con un token de acceso personal detallado», con `X-Accepted-MaKo-Permissions`
 *     diciendo qué permiso falta (el catálogo de operaciones es público para el workspace: no
 *     hay nada que esconder, y saber qué pedir es lo que destraba al integrador);
 *   · si no (capa, rol, canal, alcance del clásico) → 404, sin confirmar que existe.
 */
function noVisible(auth: Autenticado, def: OperacionDef, vista: Vista, nombre: string, area?: string): NextResponse {
  const cab = { ...auth.cabeceras, 'X-Accepted-MaKo-Permissions': permisoAceptado(def) };
  if (auth.token.clase === 'detallado' && vista.permisos) {
    const { permisos: _p, ...sinPermisos } = vista;
    if (visible(def, sinPermisos)) return errorJson(403, 'Recurso no accesible con un token de acceso personal detallado: le falta el permiso que dice X-Accepted-MaKo-Permissions.', {}, cab, def);
  }
  return errorJson(404, `${nombre} no existe para este token. Pide el índice: GET /api/v1?compacto=1`, area ? { disponibles: disponiblesEn(area as Area, vista) } : {}, cab);
}

/** El único lugar que decide CÓMO corre una operación para un token (ver la cabecera). */
async function correr(req: NextRequest, auth: Autenticado, def: OperacionDef, vista: Vista, input: Record<string, unknown>, origen: 'query' | 'json'): Promise<NextResponse> {
  const cab = auth.cabeceras;
  if (esLectura(def)) {
    const formatoPedido = req.nextUrl.searchParams.get('formato');
    let formato: Formato | undefined;
    if (formatoPedido) {
      if (!def.formatos?.includes(formatoPedido as Formato) || !FORMATOS.includes(formatoPedido as Formato)) {
        return errorJson(400, `Formato desconocido: «${formatoPedido}».`, { disponibles: def.formatos ?? [] }, cab, def);
      }
      formato = formatoPedido as Formato;
    }
    return responder(await ejecutarOperacion(def.id, input, { ...auth.ctx, formato }, origen, vista), { req, cabeceras: cab, def });
  }

  const directo = auth.token.clase === 'detallado' && esAccion(def) && def.costo !== 'dinero';
  if (!directo) return responder(await ejecutarOperacion(def.id, input, auth.ctx, origen, vista), { req, cabeceras: cab, def });

  // ── Escritura directa (token detallado con «Lectura y escritura») ──
  // Se valida ANTES para devolver el 400 con `faltan`: aplicarEnElActo lo resume en una frase.
  const v = validarInput(def.parametros, input, origen);
  if ('error' in v) return errorJson(400, v.error, v.faltan ? { faltan: v.faltan } : {}, cab, def);
  const ws = auth.ctx.ws;
  const res = await runWithWorkspace(ws, () => aplicarEnElActo(def as Parameters<typeof aplicarEnElActo>[0], input, auth.ctx, { ws, origen: `api:${auth.token.clase === 'detallado' ? auth.token.id : 'principal'}` }));
  const conPermiso = { ...cab, 'X-Accepted-MaKo-Permissions': permisoAceptado(def) };
  if (res.ok) {
    // `via: 'ninguna'` con ok es «ya estaba así» (aplicarEnElActo): éxito sin cambios.
    const sinCambios = res.via === 'ninguna';
    return NextResponse.json({ ok: true, hecho: !sinCambios, ...(sinCambios ? { sinCambios: true } : {}), resumen: res.resumen }, { status: 200, headers: conPermiso });
  }
  if (esNuestro(res.resumen)) {
    console.error(`[api-v1] escritura directa de ${def.id} (ws ${ws}) falló de nuestro lado: ${res.resumen}`);
    return errorJson(500, 'Falló de nuestro lado. Reintenta en un momento.', {}, conPermiso, def);
  }
  return errorJson(422, res.resumen, {}, conPermiso, def);
}
