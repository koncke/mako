// =============================================================================
// Las rutas REST de la API (lib/api-mako/rest.ts), la documentación y la regla de los tokens
// =============================================================================
// Decisión de Martín (08/10/2026, «copialo todo de GitHub, tal cual»): además de la ruta por
// operación de siempre, cada operación que sale por HTTP tiene UNA ruta por recurso, con el
// verbo de GitHub. Es una tabla al costado del registro, y este test es lo que la mantiene
// pegada a él:
//   · cada operación HTTP tiene EXACTAMENTE una ruta (una op nueva con 'http' falla acá hasta
//     que alguien le diseña su URL);
//   · cada ruta apunta a una operación HTTP que existe;
//   · los parámetros de ruta son parámetros de la operación (con el mismo nombre; la ruta los
//     trae siempre, así que uno opcional en la operación —`cancelar_accion` sin `id` cancela la
//     última— pasa a ser obligatorio por esa ruta, y está bien);
//   · METODO + RUTA no se repite, y ninguna ruta de dos tramos pisa a una operación (el router
//     viejo gana con `/{area}/{operacion}`);
//   · el router prefiere lo literal a un parámetro, como GitHub.
// Y una regla de GitHub que el relevo trajo: un TOKEN NUNCA ADMINISTRA TOKENS. Ninguna
// operación del registro acuña, edita ni revoca credenciales: si lo hiciera, un token
// filtrado podría perpetuarse.
//
// Probado rompiéndolo (08/10/2026): sacando la fila de `agregar_nota_lead`, falla «cada operación
// HTTP tiene una ruta»; con `{lead}` en vez de `{leadId}` en su ruta, falla la de parámetros.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import { RUTAS_REST, paramsDeRuta, resolverRest, rutaRestDe } from '../lib/api-mako/rest';
import { recursoDe, tituloRecurso } from '../lib/api-mako/recursos';
import { ejemplosDe, marcador } from '../lib/api-mako/ejemplos';
import { especificacionOpenApi } from '../lib/api-mako/openapi';
import { esLectura } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTTP = REGISTRO.filter((d) => d.canales.includes('http'));

test('cada operación HTTP tiene exactamente UNA ruta REST', () => {
  const cuenta = new Map<string, number>();
  for (const [, , op] of RUTAS_REST) cuenta.set(op, (cuenta.get(op) ?? 0) + 1);
  const sinRuta = HTTP.filter((d) => !cuenta.has(d.id)).map((d) => d.id);
  assert.deepEqual(sinRuta, [], `estas operaciones salen por HTTP y no tienen ruta REST (súmalas a RUTAS_REST en lib/api-mako/rest.ts):\n${sinRuta.join('\n')}`);
  const repetidas = [...cuenta].filter(([, n]) => n > 1).map(([op]) => op);
  assert.deepEqual(repetidas, [], `estas operaciones tienen más de una ruta: ${repetidas.join(', ')}`);
});

test('cada ruta apunta a una operación HTTP que existe, por su id (no por un alias)', () => {
  const malas = RUTAS_REST.filter(([, , op]) => { const d = porId(op); return !d || d.id !== op || !d.canales.includes('http'); });
  assert.deepEqual(malas, []);
});

test('la ruta empieza con el área de la operación, y sus parámetros son parámetros de la operación', () => {
  for (const [metodo, ruta, op] of RUTAS_REST) {
    const d = porId(op)!;
    assert.ok(ruta.startsWith(`/${d.area}/`), `${metodo} ${ruta} (${op}) no empieza con /${d.area}/`);
    for (const p of paramsDeRuta(op)) {
      const par = d.parametros.find((x) => x.nombre === p);
      assert.ok(par, `${metodo} ${ruta}: {${p}} no es un parámetro de ${op}`);
    }
    assert.match(ruta, /^(\/([a-z0-9]+(-[a-z0-9]+)*|\{[A-Za-z_]+\}))+$/, `${ruta}: tramos en kebab-case o {parametro}`);
    if (esLectura(d)) assert.equal(metodo, 'GET', `${op} es una lectura y va por ${metodo}`);
    else assert.notEqual(metodo, 'GET', `${op} escribe y va por GET`);
  }
});

test('METODO + RUTA no se repite, y ninguna ruta de dos tramos pisa una operación', () => {
  const vistas = new Set<string>();
  for (const [metodo, ruta] of RUTAS_REST) {
    const k = `${metodo} ${ruta.replace(/\{[^}]+\}/g, '{}')}`;
    assert.ok(!vistas.has(k), `ruta repetida: ${k}`);
    vistas.add(k);
    const tramos = ruta.split('/').filter(Boolean);
    if (tramos.length === 2) {
      const d = porId(tramos[1]);
      assert.ok(!d || d.area !== tramos[0], `${ruta}: el segundo tramo es la operación «${tramos[1]}»; el router viejo la tomaría`);
    }
  }
});

test('el router resuelve método + tramos, prefiere lo literal y separa 404 de verbo equivocado', () => {
  for (const [metodo, ruta, op] of RUTAS_REST) {
    const tramos = ruta.split('/').filter(Boolean).map((t) => (t.startsWith('{') ? '123' : t));
    const r = resolverRest(metodo, tramos);
    assert.ok(r && 'operacion' in r && r.operacion === op, `${metodo} ${ruta} no resuelve a ${op}`);
    for (const p of paramsDeRuta(op)) assert.equal((r as { params: Record<string, string> }).params[p], '123');
  }
  assert.equal(resolverRest('GET', ['crm', 'no-existe', 'nada']), null);
  const primera = RUTAS_REST[0];
  const otro = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].find((m) => !RUTAS_REST.some(([mm, rr]) => mm === m && rr === primera[1]))!;
  const r = resolverRest(otro, primera[1].split('/').filter(Boolean));
  assert.ok(r && 'metodosPermitidos' in r, 'una ruta que existe con otro verbo no es «no existe»');
});

test('cada operación HTTP tiene recurso con título, y ejemplos de código sin huecos', () => {
  for (const d of HTTP) {
    const recurso = recursoDe(d.id);
    assert.ok(recurso, `${d.id} sin recurso`);
    const t = tituloRecurso(recurso!);
    assert.ok(!t.includes('-') && t[0] === t[0].toUpperCase(), `${recurso} → «${t}»: falta su título en lib/api-mako/recursos.ts`);
    const e = ejemplosDe(d, 'https://app.ejemplo.com')!;
    assert.ok(e, `${d.id} sin ejemplos`);
    assert.equal(e.metodo, rutaRestDe(d.id)!.metodo);
    assert.ok(!/undefined|NaN/.test(e.curl + e.javascript + e.python), `${d.id}: el ejemplo tiene un hueco`);
    assert.ok(!e.url.includes('{'), `${d.id}: la URL de ejemplo deja un parámetro sin marcador`);
    assert.doesNotThrow(() => JSON.parse(e.esquema));
  }
  assert.equal(marcador('leadId'), 'LEAD_ID');
  assert.equal(marcador('fuenteId'), 'FUENTE_ID');
});

test('el OpenAPI describe cada ruta REST con su operationId y su permiso', () => {
  const spec = especificacionOpenApi('https://app.ejemplo.com') as { paths: Record<string, Record<string, { operationId: string; 'x-mako-permiso': string }>> };
  let n = 0;
  for (const [metodo, ruta, op] of RUTAS_REST) {
    const o = spec.paths[`/api/v1${ruta}`]?.[metodo.toLowerCase()];
    assert.ok(o, `${metodo} ${ruta} no está en el OpenAPI`);
    assert.equal(o.operationId, op);
    assert.match(o['x-mako-permiso'], /^[a-z]+=(read|write)$/);
    n++;
  }
  assert.equal(n, RUTAS_REST.length);
});

test('UN TOKEN NUNCA ADMINISTRA TOKENS: ninguna operación del registro toca credenciales', () => {
  // La regla de GitHub: los endpoints que administran tokens no se pueden llamar con un token.
  // Si una operación (que corre por HTTP o por WhatsApp) acuñara, editara o revocara tokens,
  // un token filtrado podría acuñarse otro y sobrevivir a que lo eliminen.
  const dir = join(RAIZ, 'lib', 'api-mako', 'areas');
  const archivos = readdirSync(dir).filter((f) => /\.ts$/.test(f));
  assert.ok(archivos.length >= 10, 'el test no está mirando las áreas');
  const culpables = archivos.filter((f) => {
    const s = readFileSync(join(dir, f), 'utf8');
    // Leer si existe el de la skill (ver_estado_agente_claude) no administra nada: lo que no
    // puede aparecer es lo que ACUÑA, CAMBIA o REVOCA, ni la lista de los detallados.
    return /api-mako\/tokens|['"]\.\.\/tokens|api_tokens|crearToken|editarToken|revocarToken|regenerarToken|rotarAgenteToken|revocarAgenteToken/.test(s);
  });
  assert.deepEqual(culpables, [], `estas áreas tocan credenciales: ${culpables.join(', ')}`);
});
