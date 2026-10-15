// =============================================================================
// El Centro de Operaciones — los cerrojos que no se ven en la pantalla
// =============================================================================
// Pedido de Martín (15/10/2026): «continua y termina el centro de operaciones». Una fila de la cola
// es un prompt que corre en su PC (docs/diseno-centro-de-operaciones.md §3.1), así que lo que se
// fija acá es lo que, roto, NO da error y abre la puerta:
//
//   1. Una acción sin `getSesionAdmin()` + `puedeOperar` arriba de todo: Next ejecuta una server
//      action por cualquier puerta que tenga su id.
//   2. `puedeOperar` dejando pasar una sesión de desarrollo, una legacy, una sin segundo factor o
//      una de otro workspace.
//   3. El pedido firmado leído distinto en el servidor y en el cartero de la PC (test DIFERENCIAL:
//      las dos implementaciones sobre la misma batería), o una firma que se acepta alterada.
//   4. La ruta del cartero fuera de PUBLICOS (el cartero no tiene cookie) o la pantalla adentro.
//   5. Una tabla nueva sin su revoke a anon y authenticated.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  armarFirmable, claveIdDe, leerFirmable, motivoDeEspera, nuevoPayload, puedeOperar,
  sanearChats, todosLosChats, type PayloadPedido, type VistaCartero,
} from '../lib/operaciones-reglas';
import { esPublica } from '../lib/rutas-publicas';
import { ADMIN_FAMILIAS, itemsDe } from '../app/_components/nav';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. Las acciones ─────────────────────────────────────────────────────────────────────────
function acciones(src: string): Array<{ nombre: string; cuerpo: string }> {
  const out: Array<{ nombre: string; cuerpo: string }> = [];
  for (const m of src.matchAll(/^export async function (\w+)\s*\(/gm)) {
    let i = m.index! + m[0].length;
    let par = 1;
    while (par > 0 && i < src.length) { if (src[i] === '(') par++; else if (src[i] === ')') par--; i++; }
    let ang = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '<') ang++;
      else if (c === '>' && src[i - 1] !== '=') ang--;
      else if (c === '{' && ang === 0) break;
      i++;
    }
    const ini = i + 1;
    let llaves = 1;
    i = ini;
    while (llaves > 0 && i < src.length) { if (src[i] === '{') llaves++; else if (src[i] === '}') llaves--; i++; }
    out.push({ nombre: m[1], cuerpo: src.slice(ini, i - 1) });
  }
  return out;
}

const ACCIONES = ['fotoCentroAction', 'encolarPedidoAction', 'cancelarPedidoAction', 'crearTokenCarteroAction'];

test('cada acción pregunta por Martín con su segundo factor ANTES de hacer cualquier otra cosa', () => {
  const as = acciones(sinComentarios(leer('app/admin/operaciones/acciones.ts')));
  for (const n of ACCIONES) assert.ok(as.some((a) => a.nombre === n), `no encontré ${n}`);
  assert.equal(as.length, ACCIONES.length, 'una acción nueva tiene que entrar a esta lista (y a la guarda)');
  for (const a of as) {
    assert.match(
      a.cuerpo.trimStart(),
      /^const (\w+) = await getSesionAdmin\(\);\s*if \(!puedeOperar\(\1, await wsSuperAdmin\(\)\)\) return /,
      `${a.nombre}: las dos primeras líneas son getSesionAdmin() y el puedeOperar con wsSuperAdmin()`,
    );
  }
});

test('la página también pasa por puedeOperar antes de leer la cola', () => {
  const src = sinComentarios(leer('app/admin/operaciones/page.tsx'));
  const guarda = src.indexOf('puedeOperar(admin, await wsSuperAdmin())');
  const lectura = src.indexOf('listarPedidos()');
  assert.ok(guarda > 0 && lectura > guarda, 'la guarda va antes de listarPedidos');
});

// ── 2. La guarda de plataforma ──────────────────────────────────────────────────────────────
test('puedeOperar: sólo el admin global de la plataforma, con fila y segundo factor de verdad', () => {
  const WS = 9;
  const martin = { sub: '1', rol: 'admin', ws: 9, mfa: 'totp' };
  assert.equal(puedeOperar(martin, WS), true);
  assert.equal(puedeOperar({ ...martin, mfa: 'passkey' }, WS), true);
  assert.equal(puedeOperar(null, WS), false);
  assert.equal(puedeOperar({ ...martin, sub: 'dev', mfa: 'dev' }, WS), false, 'la sesión de /api/auth/dev-login');
  assert.equal(puedeOperar({ ...martin, mfa: 'dev' }, WS), false);
  assert.equal(puedeOperar({ ...martin, mfa: undefined }, WS), false, 'sin segundo factor');
  assert.equal(puedeOperar({ ...martin, legacy: true }, WS), false);
  assert.equal(puedeOperar({ ...martin, sub: 'password' }, WS), false);
  assert.equal(puedeOperar({ ...martin, ws: 1 }, WS), false, 'el ws1 es Mauricio, un cliente');
  assert.equal(puedeOperar({ ...martin, ws: null }, WS), false);
  assert.equal(puedeOperar({ ...martin, rol: 'usuario' }, WS), false);
});

// ── 3. El pedido firmado: el servidor y el cartero leen lo mismo ────────────────────────────
const AHORA = Date.parse('2026-10-15T12:00:00Z');
const ID = '0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';
const LOCAL = 'local_5cc6190d-8390-4df1-b215-849f5590ee30';
const base = (): PayloadPedido => nuevoPayload(
  { id: ID, texto: 'Revisá el CRM', destino: LOCAL, cuenta: 'claude1', titulo: 'CRM', alcance: 'solo_esto' }, AHORA,
);
const variante = (cambio: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(armarFirmable(base())), ...cambio });

const BATERIA: Array<[string, string]> = [
  ['el bueno', armarFirmable(base())],
  ['de terminal', variante({ destino: 'cli_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601' })],
  ['de ahora en más', variante({ alcance: 'de_ahora_en_mas' })],
  ['cuenta null', variante({ cuenta: null, titulo: null })],
  ['no JSON', '{roto'],
  ['un array', '[]'],
  ['versión 2', variante({ v: 2 })],
  ['id raro', variante({ id: 'abc' })],
  ['texto vacío', variante({ texto: '   ' })],
  ['texto largo', variante({ texto: 'x'.repeat(8001) })],
  ['destino por nombre', variante({ destino: 'CRM' })],
  ['cuenta rara', variante({ cuenta: 'mauricio' })],
  ['alcance raro', variante({ alcance: 'siempre' })],
  ['fecha rota', variante({ creado: 'ayer' })],
  ['en el futuro', variante({ creado: new Date(AHORA + 3_600_000).toISOString(), vence: new Date(AHORA + 86_400_000).toISOString() })],
  ['vencido', variante({ creado: new Date(AHORA - 20 * 86_400_000).toISOString(), vence: new Date(AHORA - 6 * 86_400_000).toISOString() })],
  ['vence de más', variante({ vence: new Date(AHORA + 40 * 86_400_000).toISOString() })],
];

test('el servidor y el cartero dan el MISMO veredicto sobre cada texto firmado', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  let buenos = 0;
  for (const [nombre, texto] of BATERIA) {
    const a = leerFirmable(texto, AHORA);
    const b = cartero.leerFirmable(texto, AHORA) as { ok: boolean; motivo?: string };
    assert.equal(b.ok, a.ok, `${nombre}: servidor ${a.ok}, cartero ${b.ok}`);
    if (!a.ok) assert.equal(b.motivo, a.motivo, `${nombre}: motivos distintos`);
    else buenos++;
  }
  assert.equal(buenos, 4, 'la batería tiene cuatro textos válidos');
});

test('la firma de WebCrypto (r||s) la verifica el cartero, y un byte cambiado la rompe', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const otra = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const texto = armarFirmable(base());
  // `ieee-p1363` es el formato que devuelve crypto.subtle.sign con ECDSA: r||s, 64 bytes.
  const firma = sign('sha256', Buffer.from(texto, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  assert.equal(Buffer.from(firma, 'base64').length, 64);
  const id = claveIdDe(createHash('sha256').update(Buffer.from(spki, 'base64')).digest('hex'));
  assert.equal(cartero.quienFirmo(texto, firma, [otra, spki]), id, 'la reconoce entre varias claves y da el mismo id que la pantalla');
  assert.equal(cartero.quienFirmo(texto.replace('Revisá', 'Borrá'), firma, [spki]), null, 'texto alterado');
  assert.equal(cartero.quienFirmo(texto, firma, [otra]), null, 'clave que no firmó');
  assert.equal(cartero.quienFirmo(texto, firma, ['no-es-base64-de-una-clave']), null, 'clave mal pegada no tira');
});

// ── 4. Las puertas ──────────────────────────────────────────────────────────────────────────
test('la ruta del cartero es pública por su token, la pantalla no, y la ruta no mira la cookie', () => {
  assert.equal(esPublica('/api/operaciones/cartero'), true);
  assert.equal(esPublica('/admin/operaciones'), false);
  assert.equal(esPublica('/api/operaciones/otra'), false, 'es la ruta EXACTA, no el prefijo');
  const ruta = sinComentarios(leer('app/api/operaciones/cartero/route.ts'));
  assert.doesNotMatch(ruta, /cookies\(|getSesion|getUsuarioActual|getWorkspaceActual/, 'una ruta de PUBLICOS que lee la cookie es un CSRF');
  assert.match(ruta, /authorization/, 'se autentica con el bearer');
});

test('el Centro está en la barra de admin, y su key no se confunde con un registro de dev', () => {
  const it = ADMIN_FAMILIAS.flatMap(itemsDe).find((i) => i.href === '/admin/operaciones');
  assert.ok(it, 'falta el item de /admin/operaciones');
  assert.equal(it.key?.startsWith('dev-'), false);
});

// ── 5. La migración ─────────────────────────────────────────────────────────────────────────
test('cada tabla de la 0285 nace con RLS y sin permisos para anon ni authenticated', () => {
  const sql = sinComentarios(leer('supabase/migrations/0285_centro_operaciones.sql').replace(/^--.*$/gm, ''));
  const tablas = [...sql.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(tablas.sort(), ['operaciones_carteros', 'operaciones_pedidos', 'operaciones_token']);
  for (const t of tablas) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security;`), `${t} sin RLS`);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated;`), `${t} sin revoke`);
    assert.doesNotMatch(sql, new RegExp(`create table if not exists ${t} \\([^;]*workspace_id`), `${t} es de la plataforma: no lleva workspace_id`);
  }
});

// ── Lo que la pantalla dice de un pedido que espera ─────────────────────────────────────────
test('motivoDeEspera: cartero de esa cuenta, chat vivo o cerrado', () => {
  const chat = (local: string, vivo: boolean) => ({ local, titulo: 'CRM', cuenta: null, vivo, estado: null, actividad: null });
  const visto = new Date(AHORA - 30_000).toISOString();
  const viejo = new Date(AHORA - 3_600_000).toISOString();
  const carteros: VistaCartero[] = [
    { cuenta: 'claude1', vistoAt: visto, chats: [chat(LOCAL, true)] },
    { cuenta: 'claude2', vistoAt: viejo, chats: [chat('cli_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', true)] },
  ];
  const p = (destino: string, destino_cuenta: string | null, estado: 'escrito' | 'entregado' = 'escrito') => ({ estado, destino, destino_cuenta });
  assert.equal(motivoDeEspera(p(LOCAL, 'claude1'), carteros, AHORA), null, 'chat vivo y cartero vivo: sale');
  assert.equal(motivoDeEspera(p('cli_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601', 'claude2'), carteros, AHORA), 'Espera al cartero de la cuenta 2');
  assert.equal(motivoDeEspera(p('local_00000000-0000-4000-8000-000000000000', 'claude1'), carteros, AHORA), 'El chat está cerrado: sale cuando se abra');
  assert.equal(motivoDeEspera(p(LOCAL, 'claude3'), [], AHORA), 'Espera al cartero de la cuenta 3');
  assert.equal(motivoDeEspera(p(LOCAL, 'claude1', 'entregado'), carteros, AHORA), null, 'sólo un pedido escrito espera');
  // La cuenta la pone el cartero que lo subió, si el chat no trae la suya.
  assert.equal(todosLosChats(carteros).find((c) => c.local === LOCAL)?.cuenta, 'claude1');
  assert.equal(sanearChats([{ local: 'CRM' }, { local: LOCAL, titulo: 'x' }]).length, 1, 'un id que no es local_/cli_ no entra');
});
