// =============================================================================
// /api/chart-insights: cada chat es de quien lo habló, y un closer no recibe la plata del trimestre
// =============================================================================
// Auditoría del 16/10/2026 (docs/diseno-mako-ai-native.md, «una fuga activa hoy»; docs/hallazgos-seguridad.md):
//   1. la ruta armaba el system con `objetivosContextoTexto` (USD vendidos y cobrados del trimestre) para cualquiera: un
//      closer o setter en /mako se los oía decir a MaKo. Ahora va `sinNumerosDelNegocio: !q.admin` en los TRES armados;
//   2. cualquier miembro leía y escribía cualquier sesión del workspace por id (correlativos) y las listaba todas. Ahora la
//      regla del doer: los chats de un admin son del workspace, los de los demás SUYOS (lib/chart-chats-reglas.ts), y a
//      quien no le corresponde, 404.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 9/0):
//   · un armado del system (send) sin el corte de la plata          -> 8 / 1
//   · todos cuentan como admin                                     -> 8 / 1
//   · GET por id sin mirar de quién es                             -> 8 / 1
//   · la lista de un closer es la del workspace                    -> 8 / 1
//   · POST por id sin mirar de quién es                            -> 8 / 1
//   · un closer guarda en la clave del workspace                   -> 8 / 1
//   · un closer abre cualquier sesión                              -> 7 / 2
//   · la lista del workspace trae los chats de cada persona        -> 8 / 1
//   · el LIKE sin escapar sus comodines                            -> 8 / 1
//   · la pantalla recibe la clave guardada                         -> 8 / 1
//
// Correr: npx tsx --test tests/chart-insights-privacidad.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PREFIJO_CHAT_PERSONA, claveGuardada, claveLogica, claveVisible, personaDeSesion, prefijoDePersona, puedeUsarSesion,
  type QuienChatea,
} from '../lib/chart-chats-reglas';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));
const RUTA = leer('app', 'api', 'chart-insights', 'route.ts');
const entre = (src: string, desde: string, hasta: string) => src.slice(src.indexOf(desde), src.indexOf(hasta, src.indexOf(desde)));

const ADMIN: QuienChatea = { admin: true, persona: 'u1' };
const CLOSER: QuienChatea = { admin: false, persona: 'u5' };
const OTRO: QuienChatea = { admin: false, persona: 'u6' };

// ── La regla ─────────────────────────────────────────────────────────────────────────────────

test('la persona: el id de usuario si lo hay, si no el email', () => {
  assert.equal(personaDeSesion({ sub: '5', email: 'X@Y.com' }), 'u5');
  assert.equal(personaDeSesion({ sub: 'dev', email: 'X@Y.com' }), 'x@y.com');
  assert.equal(personaDeSesion({ sub: '', email: '' }), null);
});

test('un closer guarda y busca SUS chats; el admin, los del workspace como siempre', () => {
  assert.equal(claveGuardada('mako-general', ADMIN), 'mako-general');
  assert.equal(claveGuardada('mako-general', CLOSER), `${PREFIJO_CHAT_PERSONA}u5:mako-general`);
  assert.equal(claveGuardada(`${PREFIJO_CHAT_PERSONA}u5:mako-general`, CLOSER), `${PREFIJO_CHAT_PERSONA}u5:mako-general`, 'la suya no se prefija dos veces');
  assert.equal(claveGuardada(`${PREFIJO_CHAT_PERSONA}u5:mako-general`, OTRO), null, 'la clave de otro no le corresponde');
});

test('LA FUGA: un closer no abre un chat del workspace ni el de otro; el admin, cualquiera', () => {
  assert.equal(puedeUsarSesion('mako-general', CLOSER), false, 'el chat del dueño, por id');
  assert.equal(puedeUsarSesion('dashboard:h1:g2', CLOSER), false);
  assert.equal(puedeUsarSesion(`${PREFIJO_CHAT_PERSONA}u6:mako-general`, CLOSER), false, 'el de otro closer');
  assert.equal(puedeUsarSesion(`${PREFIJO_CHAT_PERSONA}u5:mako-general`, CLOSER), true);
  assert.equal(puedeUsarSesion('mako-general', ADMIN), true);
  assert.equal(puedeUsarSesion(`${PREFIJO_CHAT_PERSONA}u5:x`, ADMIN), true);
});

test('un email con «_» no alcanza a otro email (el prefijo se compara entero)', () => {
  const a: QuienChatea = { admin: false, persona: 'a_b@x.com' };
  assert.equal(puedeUsarSesion(`${prefijoDePersona('axb@x.com')}mako-general`, a), false);
  assert.match(leer('lib', 'chart-chats.ts'), /prefijo\.replace\(\/\[\\\\%_\]\/g, \(c\) => `\\\\\$\{c\}`\)/, 'el LIKE escapa sus comodines');
  assert.match(leer('lib', 'chart-chats.ts'), /\.filter\(\(s\) => s\.chart_key\.startsWith\(prefijo\)\)/, 'y se filtra por el prefijo exacto');
});

test('la pantalla ve la clave de siempre, y el resto de MaKo también', () => {
  assert.equal(claveVisible(`${PREFIJO_CHAT_PERSONA}u5:mako-general`, CLOSER), 'mako-general');
  assert.equal(claveVisible(`${PREFIJO_CHAT_PERSONA}u5:mako-general`, ADMIN), `${PREFIJO_CHAT_PERSONA}u5:mako-general`, 'el admin ve de quién es');
  assert.equal(claveLogica(`${PREFIJO_CHAT_PERSONA}u5:dashboard:h1:g2`), 'dashboard:h1:g2');
  assert.equal(claveLogica('dashboard:h1:g2'), 'dashboard:h1:g2');
});

// ── La ruta ──────────────────────────────────────────────────────────────────────────────────

test('los TRES armados del system van sin la plata del trimestre para quien no es admin', () => {
  const armados = RUTA.split('buildSystemPrompt(').length - 1;
  assert.equal(armados, 3, `son ${armados}: si cambió, cada uno lleva el corte`);
  assert.equal(RUTA.split('sinNumerosDelNegocio: !q.admin').length - 1, armados, 'un armado del system le cuenta la plata a un closer');
  assert.match(RUTA, /return persona \? \{ admin: rolWs === 'admin', persona \} : null;/, 'admin = el rol del workspace, nada más');
});

test('GET: sin sesión 401; la lista de un closer es la suya; por id y por clave, 404 si no le corresponde', () => {
  const g = entre(RUTA, 'export async function GET(', 'export async function POST(');
  assert.ok(g.indexOf('if (!q) return SIN_SESION();') > 0 && g.indexOf('if (!q) return SIN_SESION();') < g.indexOf("sp.get('all')"));
  assert.match(g, /q\.admin \? await listAllSessions\(arch\) : await listSessionsDePersona\(prefijoDePersona\(q\.persona\), arch\)/);
  const corte = g.indexOf('if (!s || !puedeUsarSesion(s.chart_key, q)) return NO_EXISTE();');
  assert.ok(corte > 0 && corte < g.indexOf('getSessionMessages(Number(sessionId))'), 'por id: el corte va ANTES de leer los mensajes');
  assert.ok(g.indexOf('if (!guardada) return NO_EXISTE();') < g.indexOf('listSessions(guardada, arch)'), 'por clave: la de otro no se lista');
});

test('POST: quién pide, la clave y el id se miran ANTES de cualquier acción', () => {
  const p = RUTA.slice(RUTA.indexOf('export async function POST('));
  const primera = p.indexOf("action === 'open'");
  for (const corte of ['if (!q) return SIN_SESION();', 'if (chartKey && !clave) return NO_EXISTE();', 'if (!s || !puedeUsarSesion(s.chart_key, q)) return NO_EXISTE();']) {
    const i = p.indexOf(corte);
    assert.ok(i > 0 && i < primera, `«${corte}» tiene que ir antes de las acciones`);
  }
  assert.doesNotMatch(p, /listSessions\(chartKey\)|createSession\(chartKey/, 'nada se lista ni se crea con la clave cruda de la pantalla');
});

test('lo que vuelve a la pantalla lleva la clave visible; y la lista del workspace no mezcla los chats de cada persona', () => {
  assert.doesNotMatch(RUTA, /sessions: await listSessions\(/, 'una lista sin pasar por `ver`');
  assert.match(RUTA, /const paraPantalla = \(q: QuienChatea\) => \(s: ChartSession\): ChartSession => \(\{ \.\.\.s, chart_key: claveVisible\(s\.chart_key, q\) \}\);/);
  const todas = entre(leer('lib', 'chart-chats.ts'), 'export async function listAllSessions(', 'export async function listSessionsDePersona(');
  assert.match(todas, /\.not\('chart_key', 'like', `\$\{PREFIJO_CHAT_PERSONA\}%`\)/);
});
