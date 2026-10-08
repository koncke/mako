// =============================================================================
// api-mako/ejemplos — los ejemplos de código de un endpoint, como los de docs.github.com
// =============================================================================
// Cada endpoint de la documentación de GitHub trae «Code samples»: el pedido en cURL (con
// `-L`, `Accept`, `Authorization: Bearer <YOUR-TOKEN>` y el header de versión), en
// JavaScript y en la CLI, con los parámetros de ruta como MAYÚSCULAS (OWNER, REPO), y la
// respuesta con su `Status:`. Copiado el 08/10/2026 («copialo todo, tal cual»): cURL,
// JavaScript (fetch, sin SDK) y Python (requests), sobre la ruta REST (lib/api-mako/rest.ts).
//
// Un lugar para los ejemplos: los usan la pantalla de API y la referencia en markdown.
// SIN `server-only`: puro. Español neutro: lo lee un cliente.
// =============================================================================

import { rutaRestDe, paramsDeRuta, type MetodoRest } from './rest';
import { esAccion, esLectura, type OperacionDef, type Parametro } from './tipos';
import { VERSION_API } from './version';

export const TOKEN_EJEMPLO = '<TU-TOKEN>';

/** El tipo de un parámetro como lo escribe GitHub (los tipos de JSON, en inglés). */
export function tipoJson(p: Pick<Parametro, 'tipo' | 'entero'>): string {
  switch (p.tipo) {
    case 'number': return p.entero ? 'integer' : 'number';
    case 'boolean': return 'boolean';
    case 'string[]': return 'array of strings';
    case 'object': return 'object';
    case 'object[]': return 'array of objects';
    default: return 'string';
  }
}

/** `leadId` → `LEAD_ID`: el marcador de un parámetro de ruta, como OWNER y REPO en GitHub. */
export const marcador = (nombre: string): string =>
  nombre.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();

/** Un valor de ejemplo para un parámetro: el declarado, o uno con la forma de su tipo. */
function valorDe(p: Parametro): unknown {
  if (p.ejemplo !== undefined) return p.ejemplo;
  if (p.enum?.length) return p.tipo === 'string[]' ? [p.enum[0]] : p.enum[0];
  switch (p.tipo) {
    case 'number': return p.minimo ?? 1;
    case 'boolean': return true;
    case 'string[]': return [];
    case 'object': return Object.fromEntries((p.campos ?? []).filter((c) => c.obligatorio).map((c) => [c.nombre, valorDe(c)]));
    case 'object[]': return [];
    default: return marcador(p.nombre);
  }
}

export type Ejemplos = {
  metodo: MetodoRest;
  /** la ruta con sus parámetros entre llaves, como la muestra GitHub: /crm/leads/{leadId} */
  ruta: string;
  /** la URL de ejemplo, con los parámetros de ruta como MAYÚSCULAS */
  url: string;
  curl: string;
  javascript: string;
  python: string;
  /** el status y el cuerpo de la respuesta de ejemplo */
  respuesta: { status: number; tipo: string; cuerpo: string; nota?: string };
  /** el esquema (JSON Schema) de la respuesta, como el «Response schema» de GitHub */
  esquema: string;
};

const json = (x: unknown) => JSON.stringify(x, null, 2);

/** Los ejemplos de una operación que sale por HTTP. Undefined si no tiene ruta REST. */
export function ejemplosDe(d: OperacionDef, base: string): Ejemplos | undefined {
  const r = rutaRestDe(d.id);
  if (!r) return undefined;
  const b = base.replace(/\/+$/, '');
  const enRuta = new Set(paramsDeRuta(d.id));
  const url = `${b}/api/v1${r.ruta.replace(/\{([^}]+)\}/g, (_, n: string) => marcador(n))}`;
  const resto = d.parametros.filter((p) => !enRuta.has(p.nombre));
  const usados = resto.filter((p) => p.obligatorio || p.ejemplo !== undefined);
  const datos: Record<string, unknown> = Object.fromEntries(usados.map((p) => [p.nombre, valorDe(p)]));
  const conCuerpo = r.metodo !== 'GET' && Object.keys(datos).length > 0;
  const query = r.metodo === 'GET' && usados.length
    ? `?${usados.map((p) => `${p.nombre}=${encodeURIComponent(typeof datos[p.nombre] === 'string' ? String(datos[p.nombre]) : JSON.stringify(datos[p.nombre]))}`).join('&')}`
    : '';

  const curl = [
    'curl -L \\',
    ...(r.metodo !== 'GET' ? [`  -X ${r.metodo} \\`] : []),
    '  -H "Accept: application/json" \\',
    `  -H "Authorization: Bearer ${TOKEN_EJEMPLO}" \\`,
    `  -H "X-MaKo-Api-Version: ${VERSION_API}" \\`,
    ...(conCuerpo ? ['  -H "Content-Type: application/json" \\'] : []),
    `  "${url}${query}"${conCuerpo ? ' \\' : ''}`,
    ...(conCuerpo ? [`  -d '${JSON.stringify(datos).replace(/'/g, "'\\''")}'`] : []),
  ].join('\n');

  const cabecerasJs = [
    "    Accept: 'application/json',",
    `    Authorization: 'Bearer ${TOKEN_EJEMPLO}',`,
    `    'X-MaKo-Api-Version': '${VERSION_API}',`,
    ...(conCuerpo ? ["    'Content-Type': 'application/json',"] : []),
  ];
  const javascript = [
    `const respuesta = await fetch('${url}${query}', {`,
    `  method: '${r.metodo}',`,
    '  headers: {',
    ...cabecerasJs,
    '  },',
    ...(conCuerpo ? [`  body: JSON.stringify(${JSON.stringify(datos, null, 2).replace(/\n/g, '\n  ')}),`] : []),
    '});',
    'const datos = await respuesta.json();',
  ].join('\n');

  const py = (x: unknown) => JSON.stringify(x, null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None').replace(/\n/g, '\n    ');
  const python = [
    'import requests',
    '',
    `respuesta = requests.${r.metodo.toLowerCase()}(`,
    `    "${url}",`,
    '    headers={',
    '        "Accept": "application/json",',
    `        "Authorization": "Bearer ${TOKEN_EJEMPLO}",`,
    `        "X-MaKo-Api-Version": "${VERSION_API}",`,
    '    },',
    ...(r.metodo === 'GET' && usados.length ? [`    params=${py(datos)},`] : []),
    ...(conCuerpo ? [`    json=${py(datos)},`] : []),
    ')',
    'print(respuesta.json())',
  ].join('\n');

  return { metodo: r.metodo, ruta: r.ruta, url, curl, javascript, python, respuesta: respuestaDe(d), esquema: esquemaDe(d) };
}

function respuestaDe(d: OperacionDef): Ejemplos['respuesta'] {
  if (esLectura(d)) {
    if (d.salida === 'json') return { status: 200, tipo: 'application/json', cuerpo: json({ ok: true, resultado: {} }), nota: '`resultado` es lo que devuelve la operación (ver la descripción).' };
    if (d.salida === 'markdown') return { status: 200, tipo: 'text/markdown', cuerpo: `# ${d.titulo}\n\n…` };
    return { status: 200, tipo: 'text/plain', cuerpo: '…' };
  }
  if (esAccion(d)) {
    if (d.costo === 'dinero') {
      return {
        status: 202, tipo: 'application/json',
        cuerpo: json({ ok: true, propuesta: 'prop_…', nueva: true, url: 'https://…/mako/revisar?p=…', mensaje: 'Quedó para confirmar. Pásale el link ENTERO a la persona: entra en MaKo recién cuando lo confirma ahí.' }),
        nota: 'Gasta dinero: también con un token detallado queda como propuesta, y una persona la confirma en la pantalla del link.',
      };
    }
    return { status: 200, tipo: 'application/json', cuerpo: json({ ok: true, hecho: true, resumen: d.titulo }), nota: 'Con un token detallado con «Lectura y escritura». Con el clásico, 202 y queda pendiente.' };
  }
  return { status: 200, tipo: 'application/json', cuerpo: json({ ok: true, resultado: {} }) };
}

function esquemaDe(d: OperacionDef): string {
  if (esLectura(d)) {
    if (d.salida !== 'json') return json({ type: 'string', description: d.salida === 'markdown' ? 'Markdown' : 'Texto plano' });
    return json({ type: 'object', properties: { ok: { type: 'boolean' }, resultado: {} }, required: ['ok', 'resultado'] });
  }
  if (esAccion(d)) {
    return json({
      oneOf: [
        { title: 'Hecho (200)', type: 'object', properties: { ok: { type: 'boolean' }, hecho: { type: 'boolean' }, sinCambios: { type: 'boolean' }, resumen: { type: 'string' }, datos: { type: 'object' } }, required: ['ok', 'hecho', 'resumen'] },
        { title: 'Propuesta o pendiente (202)', type: 'object', properties: { ok: { type: 'boolean' }, propuesta: { type: 'string' }, url: { type: 'string' }, pendiente: { type: 'object' }, mensaje: { type: 'string' } } },
      ],
    });
  }
  return json({ type: 'object', properties: { ok: { type: 'boolean' }, resultado: {} } });
}
