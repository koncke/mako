// =============================================================================
// Los tokens DETALLADOS de la API (08/10/2026): la lista, los permisos, el vencimiento y la
// FRONTERA con /api/agente
// =============================================================================
// Primero fueron «tokens con nombre» con alcance global; a la tarde, «copialo todo de GitHub,
// tal cual»: tokens detallados (`mako_pat_`) con permisos por área y vencimiento.
// Dos cosas distintas se prueban acá:
//
// 1. La parte pura (lib/api-mako/tokens-lista.ts): que la lista guardada se lea con
//    tolerancia, que un nombre no se repita y que lo que baja a la pantalla no lleve
//    el hash.
//
// 2. LA FRONTERA, que es la que importa. Un token con nombre vale SOLO para /api/v1.
//    Si `/api/agente/*` lo aceptara, `/api/agente/skill` le devolvería al que pide el
//    archivo de la skill con el token PRINCIPAL adentro (`getAgenteToken(ws) ?? token`):
//    un token «Solo leer» se llevaba el de la skill, que propone. Y el reporte del
//    plugin (`/hook`, `/telemetria`) tiene el consentimiento atado al principal.
//    Se fija leyendo el FUENTE: las rutas de /api/agente no pueden nombrar el
//    resolvedor de /api/v1, y el de /api/agente no puede importar el módulo de tokens.
//
// Probado rompiéndolo (08/10/2026): con el resolvedor de http.ts cambiado y
// `wsPorTokenApi` importado en /api/agente/skill, fallan 2 de 10 (la frontera y el de
// /api/v1). Y de punta a punta contra el server local, con un token «Solo leer» real:
// /api/v1?compacto=1 200 (37.724 caracteres contra 194.449 entero), una acción 404,
// /api/agente/skill y /contexto 401, y revocado, /api/v1 401.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_TOKENS_KEY, MAX_DIAS_EXPIRACION, MAX_NOMBRE, MAX_TOKENS, PREFIJO_DETALLADO, SERVICIO_API,
  agregarALista, aPublico, cambiarEnLista, hashDeToken, parsearLista, parsearUsos, pistaDe, quitarDeLista,
  validarNombre, validarPermisos, vencido, vencimientoDe,
  type TokenGuardado,
} from '../lib/api-mako/tokens-lista';
import { alcanceDeToken, prefijoDeAlcance } from '../lib/api-mako/alcance';
import { permitePorArea, permisoAceptado, sanearPermisos } from '../lib/api-mako/permisos';
import { AREAS } from '../lib/api-mako/tipos';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const HEX = 'ab'.repeat(24);
const tok = (id: string, nombre: string, extra: Partial<TokenGuardado> = {}): TokenGuardado => ({
  id, nombre, descripcion: '', permisos: { crm: 'lectura' }, hash: hashDeToken(`${PREFIJO_DETALLADO}${id}${HEX}`), pista: 'mako_pat_…abab',
  creado: '2026-10-08T12:00:00.000Z', creadoPor: 'a@b.c', expira: null, ...extra,
});

test('el hash es sha256 hex, recorta espacios y no es el token', () => {
  const t = `${prefijoDeAlcance('ejecutar')}${HEX}`;
  const h = hashDeToken(t);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(hashDeToken(`  ${t}\n`), h, 'un bearer con espacios es el mismo token');
  assert.ok(!h.includes(HEX));
  assert.notEqual(hashDeToken(`${prefijoDeAlcance('lectura')}${HEX}`), h, 'el alcance está en el token, y por lo tanto en el hash');
});

test('la pista dice qué es y los cuatro últimos, nunca el token', () => {
  const t = `${prefijoDeAlcance('lectura')}${'0'.repeat(44)}9f3a`;
  assert.equal(pistaDe(t), 'mkoag_l_…9f3a');
  assert.equal(alcanceDeToken(t), 'lectura');
  assert.equal(pistaDe(`mkoag_${'0'.repeat(44)}beef`), 'mkoag_…beef', 'el formato viejo, sin letra');
  assert.equal(pistaDe(`${PREFIJO_DETALLADO}${'0'.repeat(56)}c0de`), 'mako_pat_…c0de', 'el detallado, como github_pat_');
});

test('la lista guardada se lee con tolerancia: lo que no tiene forma se descarta, no tumba a todos', () => {
  assert.deepEqual(parsearLista(null, AREAS), []);
  assert.deepEqual(parsearLista('basura', AREAS), []);
  assert.deepEqual(parsearLista('{"a":1}', AREAS), []);
  const bueno = tok('t_1', 'n8n');
  const { permisos: _sin, ...sinPermisos } = tok('t_3', 'y');
  const lista = parsearLista(JSON.stringify([
    bueno,
    { ...bueno, nombre: 'repetido' }, // mismo id: gana el primero
    { ...tok('t_2', 'x'), hash: 'no-es-hex' },
    sinPermisos, // de la primera versión (alcance global): no gana acceso por un default
    { ...tok('t_4', 'z'), permisos: { crm: 'admin', inventada: 'escritura', ads: 'escritura' } },
    null, 7, 'x',
  ]), AREAS);
  assert.deepEqual(lista.map((t) => t.id), ['t_1', 't_4']);
  assert.deepEqual(lista[1].permisos, { ads: 'escritura' }, 'un nivel o un área inventados no dan acceso');
});

test('los permisos por área: lectura alcanza para leer, escritura para todo lo demás', () => {
  const p = sanearPermisos({ crm: 'lectura', ads: 'escritura', plan: 'ninguno' }, AREAS);
  assert.deepEqual(p, { crm: 'lectura', ads: 'escritura' }, '«ninguno» no se guarda: ausente ya lo significa');
  assert.ok(permitePorArea(p, { tipo: 'lectura', area: 'crm' }));
  assert.ok(!permitePorArea(p, { tipo: 'accion', area: 'crm' }), 'Solo lectura no escribe');
  assert.ok(!permitePorArea(p, { tipo: 'control', area: 'crm' }), 'un control (confirmar una pendiente) es escritura');
  assert.ok(permitePorArea(p, { tipo: 'accion', area: 'ads' }));
  assert.ok(permitePorArea(p, { tipo: 'lectura', area: 'ads' }), 'escritura incluye lectura');
  assert.ok(!permitePorArea(p, { tipo: 'lectura', area: 'plan' }), 'sin acceso no lee');
  assert.equal(permisoAceptado({ tipo: 'accion', area: 'crm' }), 'crm=write');
  assert.equal(permisoAceptado({ tipo: 'lectura', area: 'crm' }), 'crm=read');
  assert.ok('error' in validarPermisos({}, AREAS), 'un token sin ningún permiso no sirve para nada');
  assert.ok('error' in validarPermisos({ crm: 'ninguno' }, AREAS));
});

test('el vencimiento: las opciones de GitHub, la personalizada hasta un año, y vencido es vencido', () => {
  const ahora = Date.UTC(2026, 9, 8, 12);
  const a30 = vencimientoDe('30', undefined, ahora);
  assert.ok('expira' in a30 && a30.expira === new Date(ahora + 30 * 86_400_000).toISOString());
  assert.deepEqual(vencimientoDe('sin', undefined, ahora), { expira: null });
  const p = vencimientoDe('personalizada', '2026-12-31', ahora);
  assert.ok('expira' in p && p.expira === '2026-12-31T23:59:59.000Z', 'vence al final del día elegido');
  assert.ok('error' in vencimientoDe('personalizada', '2026-10-01', ahora), 'una fecha pasada no');
  const lejos = new Date(ahora + (MAX_DIAS_EXPIRACION + 2) * 86_400_000).toISOString().slice(0, 10);
  assert.ok('error' in vencimientoDe('personalizada', lejos, ahora), 'más de un año no');
  assert.ok('error' in vencimientoDe('personalizada', 'mañana', ahora));
  assert.ok('error' in vencimientoDe('365', undefined, ahora), 'una opción inventada no');
  assert.ok(vencido({ expira: '2026-10-08T11:59:59.000Z' }, ahora));
  assert.ok(!vencido({ expira: '2026-10-08T12:00:01.000Z' }, ahora));
  assert.ok(!vencido({ expira: null }, ahora), 'sin vencimiento no vence nunca');
});

test('un nombre se recorta, tiene tope y no se repite (sin mirar mayúsculas)', () => {
  const lista = [tok('t_1', 'n8n')];
  assert.deepEqual(validarNombre('  Zapier   Prod ', lista), { nombre: 'Zapier Prod' });
  assert.ok('error' in validarNombre('', lista));
  assert.ok('error' in validarNombre('   ', lista));
  assert.ok('error' in validarNombre(42, lista));
  assert.ok('error' in validarNombre('x'.repeat(MAX_NOMBRE + 1), lista));
  assert.ok('error' in validarNombre('N8N', lista), 'dos «n8n» son una adivinanza al revocar');
});

test(`no entran más de ${MAX_TOKENS}, y revocar uno que ya no está lo dice`, () => {
  let lista: TokenGuardado[] = [];
  for (let i = 0; i < MAX_TOKENS; i++) {
    const r = agregarALista(lista, tok(`t_${i}`, `t${i}`));
    assert.ok(Array.isArray(r));
    lista = r as TokenGuardado[];
  }
  assert.ok('error' in agregarALista(lista, tok('t_x', 'otro')));
  const sin = quitarDeLista(lista, 't_3');
  assert.ok(Array.isArray(sin) && sin.length === MAX_TOKENS - 1 && !sin.some((t) => t.id === 't_3'));
  assert.ok('error' in quitarDeLista(lista, 't_inexistente'));
  const cambiada = cambiarEnLista(lista, 't_4', (t) => ({ ...t, nombre: 'otro' }));
  assert.ok(Array.isArray(cambiada) && cambiada.find((t) => t.id === 't_4')?.nombre === 'otro' && cambiada.length === MAX_TOKENS);
  assert.ok('error' in cambiarEnLista(lista, 't_inexistente', (t) => t), 'editar uno que otra pestaña eliminó lo dice');
});

test('lo que baja a la pantalla NO lleva el hash, y trae el último uso', () => {
  const ahora = Date.UTC(2026, 9, 8, 14);
  const pub = aPublico([tok('t_1', 'n8n'), tok('t_2', 'viejo', { expira: '2026-10-01T00:00:00.000Z' })], parsearUsos('{"t_1":"2026-10-08T13:00:00.000Z","basura":3}'), ahora);
  assert.equal(pub.length, 2);
  assert.ok(!('hash' in pub[0]), 'el hash no viaja al navegador');
  assert.equal(pub[0].ultimoUso, '2026-10-08T13:00:00.000Z');
  assert.equal(pub[0].vencido, false);
  assert.equal(pub[1].vencido, true);
  assert.deepEqual(parsearUsos('[1,2]'), {});
});

test('las claves de los tokens con nombre no son las del principal', () => {
  const agente = leer('lib/agente-token.ts');
  const key = /AGENTE_TOKEN_KEY = '([^']+)'/.exec(agente)?.[1];
  const servicio = /AGENTE_SERVICIO = '([^']+)'/.exec(agente)?.[1];
  assert.ok(key && servicio, 'no encontré las constantes del principal en lib/agente-token.ts');
  assert.notEqual(API_TOKENS_KEY, key, 'la lista pisaría el token de la skill');
  assert.notEqual(SERVICIO_API, servicio, 'un hash en el índice del principal no lo resuelve nadie, y mezcla los dos');
});

// ── La frontera ──────────────────────────────────────────────────────────────

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

test('LA FRONTERA: ninguna ruta de /api/agente acepta un token con nombre', () => {
  const rutas = archivos(join(RAIZ, 'app', 'api', 'agente'));
  assert.ok(rutas.length >= 8, `esperaba las rutas de /api/agente y encontré ${rutas.length}: el test no está mirando nada`);
  const culpables = rutas
    .filter((p) => /wsPorTokenApi|api-mako\/tokens['"]/.test(sinComentarios(readFileSync(p, 'utf8'))))
    .map((p) => p.slice(RAIZ.length));
  assert.deepEqual(culpables, [], `estas rutas de /api/agente resuelven tokens con nombre: /api/agente/skill entregaría el principal a cualquiera:\n${culpables.join('\n')}`);
});

test('LA FRONTERA: el resolvedor del principal no conoce los tokens con nombre', () => {
  const src = sinComentarios(leer('lib/agente-token.ts'));
  assert.ok(!/api-mako\/tokens['"]/.test(src), 'lib/agente-token.ts importa lib/api-mako/tokens: /api/agente pasaría a aceptar tokens con nombre');
  assert.ok(!/wsPorTokenApi/.test(src));
});

test('/api/v1 sí los acepta: su resolvedor es resolverTokenApi, que cae al principal', () => {
  const http = sinComentarios(leer('lib/api-mako/http.ts'));
  assert.match(http, /resolver: \(token: string\) => Promise<TokenResuelto \| null> = resolverTokenApi/, '/api/v1 dejó de aceptar los tokens de la pantalla de API');
  const tokens = sinComentarios(leer('lib/api-mako/tokens.ts'));
  assert.match(tokens, /const ws = await wsPorAgenteToken\(t\);/, 'sin la caída al principal, la skill instalada deja de poder usar /api/v1');
  // Un vencido se resuelve (para decir «venció el …») pero autenticar() no lo deja pasar.
  assert.match(http, /\.vencido\)/, 'http.ts dejó de mirar el vencimiento: un token vencido seguiría entrando');
  // La lista decide, no el índice: el índice es append-only y un revocado sigue ahí.
  assert.match(tokens, /getSettingEstricto\(API_TOKENS_KEY\)/, 'con getSetting, la base caída da «revocado» sobre un token vigente');
});
