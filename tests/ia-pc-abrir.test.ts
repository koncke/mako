// =============================================================================
// «¿Cómo abro MaKo?» (25/10/2026, la llamada con Leandro, f02)
// =============================================================================
// El instalador dejaba el programa corriendo escondido y ningún acceso: recién instalado, no había nada que abrir. Esto fija:
//   1. `mako-pc abrir` lleva al Ops Center del negocio conectado, o a conectar la computadora si no lo está;
//   2. el instalador crea «MaKo» en el menú Inicio y en el escritorio, que corren ese comando.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): el destino sin mirar la conexión → 1 rojo (1); el instalador sin el acceso
// del escritorio → 1 rojo (2); la página sin «¿Otra cuenta de Claude?» → 1 rojo (3).
// Y f03 (la misma llamada): «Ahí te debería dejar elegir otra cuenta, no solamente detectar la que ya está abierta».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { abrirMaKo, destinoDeAbrir, paginaDeLogin } from '../scripts/ia-pc/mako-pc.mjs';

const RAIZ = join(__dirname, '..');

test('1. «MaKo» abre el Ops Center del negocio conectado; sin conexión, conectar la computadora', () => {
  assert.equal(destinoDeAbrir(null), 'https://hola-mako.com/perfil/ia?computadora=1');
  assert.equal(destinoDeAbrir({ pendiente: { token: 'x' } }), 'https://hola-mako.com/perfil/ia?computadora=1', 'pendiente no es conectada');
  assert.equal(destinoDeAbrir({ token: 't', servidor: 'https://hola-mako.com' }), 'https://hola-mako.com/second-brain');
  assert.equal(destinoDeAbrir({ token: 't' }), 'https://hola-mako.com/second-brain');
  assert.equal(destinoDeAbrir({ token: 't', servidor: 'javascript:alert(1)' }), 'https://hola-mako.com/second-brain', 'un servidor raro no se abre');
  const abiertos: string[] = [];
  assert.equal(abrirMaKo({ abrir: (u: string) => { abiertos.push(u); return true; }, config: { token: 't', servidor: 'https://hola-mako.com' } }), 0);
  assert.deepEqual(abiertos, ['https://hola-mako.com/second-brain']);
  assert.equal(abrirMaKo({ abrir: () => false, config: null }), 1);
  const src = readFileSync(join(RAIZ, 'scripts/ia-pc/mako-pc.mjs'), 'utf8');
  assert.match(src, /else if \(cmd === 'abrir'\) salir\(abrirMaKo\(\)\);/, 'el comando');
});

test('2. el instalador deja «MaKo» en el menú Inicio y en el escritorio', () => {
  const iss = readFileSync(join(RAIZ, 'installer/windows/mako.iss'), 'utf8');
  assert.match(iss, /^Name: "\{userprograms\}\\MaKo"; Filename: "\{app\}\\mako-pc\.exe"; Parameters: "abrir"/m);
  assert.match(iss, /^Name: "\{userdesktop\}\\MaKo"; Filename: "\{app\}\\mako-pc\.exe"; Parameters: "abrir"/m);
});

test('3. f03: la página para iniciar sesión ofrece entrar con OTRA cuenta de Claude (el mismo enlace, en incógnito)', () => {
  const url = 'https://claude.ai/oauth/authorize?code=true&client_id=abc&state=x"y';
  const h = paginaDeLogin({ estado: 'pedir', urlClaude: url });
  assert.match(h, /<details><summary>¿Otra cuenta de Claude\?<\/summary>/);
  assert.match(h, /ventana de incógnito/);
  assert.ok(h.includes('value="https://claude.ai/oauth/authorize?code=true&amp;client_id=abc&amp;state=x&quot;y"'), 'el enlace, escapado, para copiar');
  assert.doesNotMatch(paginaDeLogin({ estado: 'listo' }), /Otra cuenta/, 'ya con sesión no se ofrece');
});
