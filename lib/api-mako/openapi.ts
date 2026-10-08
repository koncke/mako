// =============================================================================
// api-mako/openapi — la descripción OpenAPI 3.1 de la API, GENERADA del registro
// =============================================================================
// GitHub publica la descripción OpenAPI de su API (repo github/rest-api-description) y de
// ahí salen sus SDKs, su documentación y las integraciones que la importan. Copiado el
// 08/10/2026 («copiá la API de GitHub tal cual»): la sirve `GET /api/v1/openapi.json` y la
// pantalla de API la deja bajar, para importarla en n8n, Postman o un generador de SDK.
//
// Describe las rutas REST (lib/api-mako/rest.ts), que son las «lindas»; cada operación
// lleva además su ruta de siempre en `x-mako-ruta`, su id como `operationId` (estable: es
// contrato, decisión C) y el permiso que pide en `x-mako-permiso`.
//
// No hay esquema de RESPUESTA por operación (el registro no lo declara): las respuestas
// describen el sobre común ({ ok, resultado } en las lecturas JSON, { ok, hecho, resumen }
// en una escritura directa, la pendiente o propuesta con 202, y el error de GitHub).
//
// SIN `server-only`: lo importan la ruta y los tests. Español neutro: lo lee un cliente.
// =============================================================================

import { porId } from './registro';
import { RUTAS_REST } from './rest';
import { esquemaJson } from './validar';
import { AREA_INFO, esAccion, esLectura, type OperacionDef, type Parametro } from './tipos';
import { permisoAceptado } from './permisos';
import { VERSION_API as VERSION } from './version';

type Json = Record<string, unknown>;


const tipoOpenApi = (p: Parametro): Json => {
  switch (p.tipo) {
    case 'number': return { type: p.entero ? 'integer' : 'number' };
    case 'boolean': return { type: 'boolean' };
    case 'string[]': return { type: 'array', items: { type: 'string', ...(p.enum ? { enum: [...p.enum] } : {}) } };
    case 'object': return { type: 'object' };
    case 'object[]': return { type: 'array', items: { type: 'object' } };
    default: return { type: 'string', ...(p.enum ? { enum: [...p.enum] } : {}) };
  }
};

const ERROR = { $ref: '#/components/responses/Error' };

function respuestas(d: OperacionDef): Json {
  const comunes = { '400': ERROR, '401': ERROR, '403': ERROR, '404': ERROR, '429': ERROR };
  if (esLectura(d)) {
    return {
      '200': { description: 'OK', content: d.salida === 'json' ? { 'application/json': { schema: { $ref: '#/components/schemas/Lectura' } } } : { [d.salida === 'markdown' ? 'text/markdown' : 'text/plain']: { schema: { type: 'string' } } } },
      '304': { description: 'No modificado (If-None-Match)' },
      ...comunes,
    };
  }
  if (esAccion(d)) {
    return {
      '200': { description: 'Hecho (token detallado con «Lectura y escritura»)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Hecho' } } } },
      '202': { description: d.costo === 'dinero' ? 'Propuesta: lo que gasta plata se confirma en una pantalla de MaKo' : 'Pendiente o propuesta (token clásico): la confirma una persona', content: { 'application/json': { schema: { $ref: '#/components/schemas/Propuesta' } } } },
      '422': ERROR,
      ...comunes,
    };
  }
  return { '200': { description: 'OK' }, ...comunes };
}

/** La descripción OpenAPI de lo que sale por HTTP. `base` es la URL de la app. */
export function especificacionOpenApi(base: string): Json {
  const paths: Record<string, Json> = {};
  const tags = new Map<string, string>();
  for (const [metodo, ruta, operacion] of RUTAS_REST) {
    const d = porId(operacion);
    if (!d || !d.canales.includes('http')) continue;
    const enRuta = [...ruta.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
    const parametros: Json[] = enRuta.map((nombre) => {
      const p = d.parametros.find((x) => x.nombre === nombre);
      return { name: nombre, in: 'path', required: true, description: p?.descripcion ?? '', schema: p ? tipoOpenApi(p) : { type: 'string' } };
    });
    const resto = d.parametros.filter((p) => !enRuta.includes(p.nombre));
    if (metodo === 'GET') {
      for (const p of resto) parametros.push({ name: p.nombre, in: 'query', required: !!p.obligatorio, description: p.descripcion, schema: tipoOpenApi(p) });
    }
    const tag = AREA_INFO[d.area].titulo;
    tags.set(tag, AREA_INFO[d.area].tab);
    const op: Json = {
      operationId: d.id,
      summary: d.titulo,
      description: d.descripcion,
      tags: [tag],
      parameters: parametros,
      ...(metodo !== 'GET' && resto.length ? { requestBody: { required: resto.some((p) => p.obligatorio), content: { 'application/json': { schema: esquemaJson(resto) } } } } : {}),
      responses: respuestas(d),
      'x-mako-permiso': permisoAceptado(d),
      'x-mako-ruta': `${esLectura(d) ? 'GET' : 'POST'} /api/v1/${d.area}/${d.id}`,
      'x-mako-costo': d.costo,
    };
    const clave = `/api/v1${ruta}`;
    paths[clave] = { ...(paths[clave] ?? {}), [metodo.toLowerCase()]: op };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'API de MaKo',
      version: VERSION,
      description: 'Todo lo que un agente o una integración puede leer y hacer en MaKo. Autenticación con un token de acceso personal (Authorization: Bearer). Versión por el header X-MaKo-Api-Version.',
    },
    servers: [{ url: base.replace(/\/+$/, '') }],
    security: [{ bearer: [] }],
    tags: [...tags].map(([name, description]) => ({ name, description: `Tab ${description}` })),
    paths,
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Token de acceso personal: detallado (mako_pat_…) o el clásico de la skill de Claude (mkoag_…).' } },
      schemas: {
        Lectura: { type: 'object', properties: { ok: { type: 'boolean', const: true }, resultado: {} }, required: ['ok', 'resultado'] },
        Hecho: { type: 'object', properties: { ok: { type: 'boolean' }, hecho: { type: 'boolean' }, sinCambios: { type: 'boolean' }, resumen: { type: 'string' }, datos: { type: 'object', description: 'lo que la escritura devuelve además del resumen, como el id de lo que creó' } }, required: ['ok', 'hecho', 'resumen'] },
        Propuesta: { type: 'object', properties: { ok: { type: 'boolean' }, propuesta: { type: 'string' }, url: { type: 'string' }, pendiente: { type: 'object' }, mensaje: { type: 'string' } } },
        Error: { type: 'object', properties: { message: { type: 'string' }, documentation_url: { type: 'string' }, status: { type: 'string' }, ok: { type: 'boolean', const: false }, error: { type: 'string' }, faltan: { type: 'array', items: { type: 'string' } } }, required: ['message', 'status'] },
      },
      responses: { Error: { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    },
  };
}
