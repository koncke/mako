// =============================================================================
// «Olvidé mi contraseña»: el link de un solo uso y lo que no se puede saltear (15/10/2026)
// =============================================================================
// Circuito 3 de docs/diseno-login-contrasena.md. El mail lo manda la automatización de SuperAdmin
// «Restablecer contraseña» (`avisarPedidoDeRestablecer`, chat de Automations); esto es la otra punta.
// Se lee el FUENTE porque la ruta y la lógica tocan la base (`server-only`): lo que se fija es el ORDEN
// de las guardas, que es donde se rompe esto.
//
// Probado ROMPIÉNDOLO (15/10/2026); los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/contrasena-restablecer.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esPublica } from '../lib/rutas-publicas';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const RUTA = sinComentarios(leer('app/api/auth/restablecer/route.ts'));
const LIB = sinComentarios(leer('lib/contrasena-restablecer.ts'));
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré ${desde}`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no encontré el fin de ${desde}`);
  return src.slice(i, f);
};

test('las dos puertas son públicas (se autentican solas) y la ruta chequea el Origin primero', () => {
  assert.equal(esPublica('/login/restablecer'), true);
  assert.equal(esPublica('/api/auth/restablecer'), true);
  assert.match(RUTA, /export async function POST\(req: NextRequest\) \{\s*if \(!origenValido\(req\)\) return no\('origen no permitido', 403\);/);
});

test('pedir: contesta SIEMPRE lo mismo y tarda lo mismo; el mail va fuera de la respuesta y el registro sin el link', () => {
  const p = bloque(RUTA, "if (accion === 'pedir') {", "if (accion === 'abrir') {");
  assert.equal(p.split('return ').length - 1, 1, 'pedir tiene más de una salida: alguna cuenta qué correos existen');
  assert.match(p, /return NextResponse\.json\(\{ ok: true, mensaje: RESPUESTA_PEDIDO \}\);\s*\}\s*$/);
  const espera = p.indexOf('if (falta > 0) await new Promise');
  assert.ok(espera > 0 && espera < p.indexOf('return NextResponse.json'), 'contesta sin la demora pareja');
  assert.match(p, /after\(async \(\) => \{\s*const res = await avisarPedidoDeRestablecer\(uid, link\)/, 'el mail va DENTRO de la respuesta');
  assert.match(p, /registrarEvento\(uid, 'restablecer-pedido', res === 'corrio', res\)/);
  assert.doesNotMatch(p, /registrarEvento\([^)]*,\s*(r\.)?link\s*[,)]/, 'el link va al registro');
  assert.doesNotMatch(p, /emitirDelCatalogo/, 'arma el evento a mano en vez de usar el contrato de Automations');
});

test('cambiar: la contraseña se valida sin gastar, el segundo factor va si la cuenta lo tiene, y se GASTA antes de guardar', () => {
  const c = bloque(RUTA, "if (accion === 'cambiar') {", "return no('acción inválida');");
  const politica = c.indexOf('problemaDeContrasena(body.contrasena, cuenta)');
  const factor = c.indexOf('if (cantidadFactores(e) > 0) {');
  const intento = c.indexOf('await intentar(l.usuarioId,');
  const gasta = c.indexOf('await gastarLink(l)');
  const guarda = c.indexOf('await guardarContrasena(l.usuarioId');
  assert.ok(politica >= 0 && factor > politica, 'gasta un intento antes de validar la contraseña');
  assert.ok(intento > factor && gasta > intento, 'gasta el link antes de probar el segundo factor');
  assert.ok(guarda > gasta, 'guarda antes de gastar: dos pestañas cambian la contraseña dos veces');
  assert.match(c.slice(intento, gasta), /if \(!vale\) \{\s*await sumarIntentoAlLink\(l\);/, 'un código malo no le suma intentos al link');
});

test('el link: en el fragmento, un solo uso, 30 minutos, el anterior se cierra, y en la base sólo su HMAC', () => {
  assert.match(LIB, /return `\$\{APP_BASE_URL\}\/login\/restablecer#t=\$\{token\}`;/, 'el token va en la query (logs, Referer)');
  assert.match(LIB, /update\(`restablecer:\$\{token\}`\)/, 'el HMAC sin prefijo propio se confunde con un código');
  assert.match(LIB, /export const VENCE_MINUTOS = 30;/);
  assert.match(LIB, /export const MAX_PEDIDOS = 3;/);
  const crear = bloque(LIB, 'export async function crearLinkDeRestablecer(', 'export type LinkVivo');
  const cierra = crear.indexOf("update({ usado_at: ahora }).eq('usuario_id', usuarioId).is('usado_at', null)");
  assert.ok(cierra >= 0 && cierra < crear.indexOf('.insert('), 'el link viejo sigue vivo');
  assert.match(crear, /if \(\(count \?\? 0\) >= MAX_PEDIDOS\) return \{ frenado: true \};/);
  assert.doesNotMatch(crear, /insert\(\{[^}]*token:/, 'guarda el token en claro');
  const leerL = bloque(LIB, 'export async function leerLinkDeRestablecer(', 'export async function sumarIntentoAlLink(');
  assert.match(leerL, /if \(f\.usado_at \|\| Date\.parse\(f\.expira_at\) <= Date\.now\(\) \|\| f\.intentos >= MAX_INTENTOS_LINK\) return null;/);
  assert.match(LIB, /\.eq\('id', l\.id\)\.is\('usado_at', null\)\.select\('id'\);/, 'gastar sin compare-and-set');
});

test('la pantalla lee el token del fragmento, lo borra de la barra y lo manda en el CUERPO', () => {
  const p = sinComentarios(leer('app/login/restablecer/Restablecer.tsx'));
  assert.match(p, /new URLSearchParams\(window\.location\.hash\.slice\(1\)\)\.get\('t'\)/);
  assert.match(p, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/, 'el token queda en la barra y en el historial');
  assert.doesNotMatch(p, /fetch\(`[^`]*\$\{t(oken)?\}/, 'el token viaja en la URL de un pedido');
  const page = sinComentarios(leer('app/login/restablecer/page.tsx'));
  assert.doesNotMatch(page, /searchParams|cookies\(/, 'la página lee algo del pedido (el token no llega al server)');
});

test('la tabla nace cerrada a la clave pública', () => {
  const m = leer('supabase/migrations/0287_contrasena_restablecer.sql');
  assert.match(m, /alter table contrasena_restablecer enable row level security;/);
  assert.match(m, /revoke all on contrasena_restablecer from anon, authenticated;/);
  assert.match(m, /revoke all on sequence contrasena_restablecer_id_seq from anon, authenticated;/);
});

// ROTURAS (15/10/2026), una por vez y restaurando de memoria. Base: 6 pases, 0 fallos. Cada una dio 5/1:
//   pedir sale antes si el correo no existe · pedir sin la demora pareja · el mail DENTRO de la respuesta ·
//   el link al registro · sin chequear el Origin · la política de la contraseña después del factor · gastar
//   el link antes del factor · guardar antes de gastar · un código malo no le suma al link · el token en la
//   query (`?t=`) · el HMAC sin su prefijo · el link viejo sigue vivo · sin tope de pedidos · leer ignora los
//   intentos · gastar sin compare-and-set · el token queda en la barra · la secuencia sin revoke · 60 minutos.
// Dos guardas pasaban en VERDE por la razón equivocada y las cazó romperlas: «el link al registro» matcheaba
// el texto 'no se pudo crear el link' (ahora busca el link como ARGUMENTO), y «el link viejo sigue vivo»
// comparaba un indexOf de -1 (borrar el cierre daba -1 < N: verde). Ahora exige que el cierre exista.
