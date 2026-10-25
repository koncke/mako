// =============================================================================
// La app de escritorio pide SIEMPRE el login de la persona (25/10/2026)
// =============================================================================
// Martín: «la app de desktop jamás me pidió login, eso esta muy mal, entró directo a la cuenta de Mauricio cuando yo estaba en
// mi cuenta de super admin». Era una app web de Chrome en el perfil de Mauricio, con la sesión de ese perfil
// (docs/hallazgos-seguridad.md). Lo que fija este test:
//   1. qué es «la app» (la instalada de la computadora y el acceso «MaKo»; el teléfono no) y la decisión de la puerta: pasa sólo
//      quien entró en ESA ventana, o con una sesión emitida después de que la ventana empezó a esperar;
//   2. la sesión trae firmado cuándo se entró (`iat`), y /api/auth/entrada da eso y la hora del servidor, nada más;
//   3. las piezas: el layout monta la puerta, /login con `app=1` pide entrar aunque haya sesión (si no, da vueltas), la tapa
//      sólo en la app de la computadora, el acceso «MaKo» abre con `app=1`, y cerrar sesión no toca la PC conectada.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

process.env.AUTH_SECRET = 'secreto-de-prueba-de-la-puerta-de-la-app-0123456789';

import { crearToken, verificarToken } from '../lib/auth-session';
import { esPublica } from '../lib/rutas-publicas';
import { LINK_TUS_CUENTAS_IA } from '../lib/ia-pc-reglas';
import { servicioDeLink } from '../lib/integracion-en-tab';
import {
  CLAVE_PUERTA, MARGEN_PUERTA_S, decidirPuerta, destinoTrasLogin, escribirPuerta, esTelefono, esVentanaDeApp, leerPuerta, loginDeLaApp, pideLaApp,
} from '../lib/app-escritorio-reglas';

const RAIZ = path.join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

test('1. qué es la app, y la puerta: pasa sólo quien entró en ESA ventana', () => {
  assert.equal(esVentanaDeApp({ instalada: true, conParam: false, ua: WINDOWS }), true, 'la app instalada de Windows');
  assert.equal(esVentanaDeApp({ instalada: true, conParam: false, ua: MAC }), true, 'la de la Mac');
  assert.equal(esVentanaDeApp({ instalada: false, conParam: true, ua: WINDOWS }), true, 'el acceso «MaKo» (?app=1)');
  assert.equal(esVentanaDeApp({ instalada: false, conParam: false, ua: WINDOWS }), false, 'una pestaña común');
  // La ventana que ya empezó a esperar el login sigue siendo de la app aunque vuelva sin ?app=1 (medido en el navegador).
  assert.equal(esVentanaDeApp({ instalada: false, conParam: false, marcada: true, ua: WINDOWS }), true, 'la del acceso, de vuelta del login');
  for (const ua of [ANDROID, IPHONE]) {
    assert.equal(esTelefono(ua), true);
    assert.equal(esVentanaDeApp({ instalada: true, conParam: true, ua }), false, 'el teléfono tiene su app: no es esta regla');
  }
  // Lo guardado en la ventana.
  assert.equal(leerPuerta(null), null);
  assert.equal(leerPuerta(''), null);
  assert.equal(leerPuerta('basura'), null);
  assert.equal(leerPuerta(escribirPuerta('adentro')), 'adentro');
  assert.deepEqual(leerPuerta(escribirPuerta({ desde: 1_800_000_000 })), { desde: 1_800_000_000 });
  // La decisión. Rota: dejar pasar una sesión de ANTES de abrir la ventana (la del perfil, la de otro) → esto falla.
  const desde = 1_800_000_000;
  assert.equal(decidirPuerta({ puerta: 'adentro', emitida: null }), 'pasar');
  assert.equal(decidirPuerta({ puerta: null, emitida: desde + 999 }), 'pedir-login', 'una ventana nueva siempre pregunta');
  assert.equal(decidirPuerta({ puerta: { desde }, emitida: null }), 'pedir-login', 'sin iat (una sesión de antes del 25/10) es vieja');
  assert.equal(decidirPuerta({ puerta: { desde }, emitida: desde - 3600 }), 'pedir-login', 'la sesión que ya estaba en el perfil');
  assert.equal(decidirPuerta({ puerta: { desde }, emitida: desde - MARGEN_PUERTA_S - 1 }), 'pedir-login');
  assert.equal(decidirPuerta({ puerta: { desde }, emitida: desde - MARGEN_PUERTA_S }), 'entro', 'el margen del reloj');
  assert.equal(decidirPuerta({ puerta: { desde }, emitida: desde + 40 }), 'entro');
  // Vuelve a la misma pantalla, sin el ?app=1.
  assert.equal(destinoTrasLogin('/second-brain', '?app=1'), '/second-brain');
  assert.equal(destinoTrasLogin('/perfil/ia', '?computadora=1&app=1'), '/perfil/ia?computadora=1');
  assert.equal(loginDeLaApp('/perfil/ia?computadora=1'), '/login?app=1&next=%2Fperfil%2Fia%3Fcomputadora%3D1');
  assert.equal(CLAVE_PUERTA, 'mako-app-entrada');
  // `app=1` arriba, o adentro del `next` (el login nuevo de Zernio: `denegar` manda la dirección ENTERA en `next`).
  assert.equal(pideLaApp('?app=1'), true);
  assert.equal(pideLaApp('?next=%2Fsecond-brain%3Fapp%3D1'), true, 'el acceso «MaKo» sin sesión, pasado por el proxy');
  assert.equal(pideLaApp('?next=%2Fperfil%2Fia%3Fcomputadora%3D1%26app%3D1'), true);
  assert.equal(pideLaApp('?next=%2Fsecond-brain'), false);
  assert.equal(pideLaApp('?next=%2Fx%3Fapp%3D0'), false);
  assert.equal(pideLaApp(''), false);
});

test('2. la sesión trae cuándo se entró, y /api/auth/entrada da eso y la hora del servidor, nada más', () => {
  const antes = Math.floor(Date.now() / 1000);
  const s = verificarToken(crearToken({ sub: '7', email: 'ana@x.com', nombre: 'Ana', rol: 'usuario' }));
  assert.ok(s, 'la sesión no verifica');
  assert.ok(typeof s.iat === 'number' && s.iat >= antes && s.iat <= antes + 2, `iat: ${s.iat}`);
  assert.equal(s.exp - s.iat, 30 * 24 * 60 * 60, 'iat y exp salen de la misma hora');
  assert.equal(esPublica('/api/auth/entrada'), true, 'sin sesión tiene que contestar (el login de la app la llama)');
  const r = sinComentarios(leer('app/api/auth/entrada/route.ts'));
  assert.match(r, /\{ ok: true, ahora: Math\.floor\(Date\.now\(\) \/ 1000\), emitida: typeof sesion\?\.iat === 'number' \? sesion\.iat : null \}/);
  assert.doesNotMatch(r, /\b(email|nombre|rol|rolWs|mfa)\b|\.sub\b|\.ws\b/, 'la ruta pública dice algo de la persona');
  assert.match(r, /'cache-control': 'no-store'/);
});

test('3. las piezas: el layout la monta, /login con app=1 pide entrar, la tapa, el acceso «MaKo» y la PC conectada', () => {
  const layout = sinComentarios(leer('app/layout.tsx'));
  assert.match(layout, /<WsFetch \/>\s*<PuertaDeLaApp \/>/, 'la puerta va arriba de todo');
  const p = sinComentarios(leer('app/_components/PuertaDeLaApp.tsx'));
  assert.match(p, /const d = decidirPuerta\(\{ puerta, emitida: e\.emitida \?\? null \}\);/);
  assert.match(p, /esVentanaDeApp\(\{ instalada, conParam, marcada: puerta != null, ua: navigator\.userAgent \}\)/);
  assert.match(p, /window\.location\.replace\(loginDeLaApp\(destinoTrasLogin\(window\.location\.pathname, window\.location\.search\)\)\);/);
  // En el login y lo público NO manda a ningún lado (daría vueltas): sólo anota desde cuándo espera.
  assert.match(p, /if \(publica\) \{ if \(!puerta\) guardar\(escribirPuerta\(\{ desde: e\.ahora \}\)\); setAbierta\(true\); return; \}/);
  assert.ok(p.indexOf('if (publica)') < p.indexOf('window.location.replace('), 'manda al login desde una página pública');
  assert.equal(esPublica('/login'), true);
  // /login con app=1: el formulario aunque haya sesión. Rota: «Ya tienes la sesión abierta» → lleva adentro solo, y vuelta.
  const login = sinComentarios(leer('app/login/page.tsx'));
  assert.match(login, /const deLaApp = uno\(sp\[PARAM_APP\]\) === '1';/);
  assert.match(login, /\) : sesion && !deLaApp \? \(\s*<YaLogueado /);
  // La tapa, sólo en la app instalada de la computadora.
  const css = leer('app/_components/puerta-app.css');
  assert.match(css, /^\.puerta-app \{ display: none; \}$/m);
  for (const m of ['standalone', 'window-controls-overlay', 'minimal-ui']) assert.ok(css.includes(`(display-mode: ${m}) and (pointer: fine)`), m);
  // El acceso «MaKo» abre con app=1, y la conexión de la PC no viaja en el enlace.
  const pc = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(pc, /return `\$\{servidor\}\/second-brain\?app=1`;/);
  // Cerrar sesión no desconecta la IA: el logout no toca la PC.
  assert.doesNotMatch(sinComentarios(leer('app/api/auth/logout/route.ts')), /ia_pc|ia-pc|desconectar|revocar/i);
});

test('4. «Tus cuentas de IA» tiene link propio: /integraciones?abrir=ia abre su modal, y desde otra tab va hasta ahí', () => {
  assert.equal(LINK_TUS_CUENTAS_IA, '/integraciones?abrir=ia');
  const t = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tarjeta = t.slice(t.indexOf('export function TarjetaTusCuentasIA('));
  assert.match(tarjeta, /const pedida = params\?\.get\('abrir'\) === ABRIR_IA;/);
  assert.match(tarjeta, /if \(!pedida\) return;\s*setAbierto\(true\);/);
  assert.match(tarjeta, /q\.delete\('abrir'\);\s*router\.replace\(/, 'queda pegado: un F5 lo vuelve a abrir');
  // Un link desde un chat de otra tab no intenta abrir en el lugar una «integración ia» que no existe: va a /integraciones.
  assert.equal(servicioDeLink(LINK_TUS_CUENTAS_IA), null);
  assert.equal(servicioDeLink('/integraciones?abrir=fathom'), 'fathom', 'el resto sigue abriéndose en el lugar');
});
