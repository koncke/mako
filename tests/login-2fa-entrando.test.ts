// =============================================================================
// El 2FA del login: «No coincide» después de un código BUENO (25/10/2026)
// =============================================================================
// Martín (25/10 ~12:55): «me logee con SuperAdmin y me dijo "No coincide" el codigo de la app de verificacion y luego me dejo
// entrar igual». No era un bypass: mfa_eventos tenía un solo intento, y bueno. El primer envío (el automático a los 6 dígitos)
// entraba; `correr` volvía a habilitar «Entrar» y el Enter mientras la página cargaba; un segundo envío llegaba sin el paso
// intermedio (lo cierra `ponerSesion`), el servidor contestaba 401 «vencido» y la pantalla pintaba el comodín «No coincide.».
// Lo que fija este test (docs/hallazgos-seguridad.md → «El 2FA del login»):
//   1. ningún «No coincide» inventado: el texto del servidor, o «No se pudo. Vuelve a probar.»; el 401 no pinta nada;
//   2. con una respuesta buena la pantalla queda trabada hasta irse: ni el botón, ni el Enter, ni un segundo envío;
//   3. el servidor ya dice qué pasó con un código malo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SIN_TEXTO, textoDelFallo } from '../app/login/2fa/respuesta-2fa';

const RAIZ = path.join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(path.join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('1. ningún «No coincide» inventado: el texto del servidor, el genérico, y el 401 no pinta nada', () => {
  assert.equal(textoDelFallo({ ok: true }), null);
  assert.equal(textoDelFallo({ ok: false, vencido: true }), null, 'el paso venció: ya se está yendo, no hay nada que decir');
  assert.equal(textoDelFallo({ ok: false, vencido: true, error: 'vencido' }), null);
  assert.equal(textoDelFallo({ ok: false, error: 'Ese código no coincide.' }), 'Ese código no coincide.');
  assert.equal(textoDelFallo({ ok: false }), SIN_TEXTO);
  assert.equal(textoDelFallo({ ok: false, error: '  ' }), SIN_TEXTO);
  assert.equal(SIN_TEXTO, 'No se pudo. Vuelve a probar.');
  const p = sinComentarios(leer('app/login/2fa/SegundoPaso.tsx'));
  assert.doesNotMatch(p, /No coincide/, 'volvió un «No coincide» que no dijo el servidor');
  assert.doesNotMatch(p, /setError\([a-z]\.error \?\?/, 'un comodín propio en vez de textoDelFallo');
  assert.match(p, /if \(r\.status === 401\) \{ window\.location\.href = '\/login\?error=mfa-vencido'; return \{ ok: false, vencido: true \}; \}/);
});

test('2. con una respuesta buena la pantalla queda trabada hasta irse', () => {
  const p = sinComentarios(leer('app/login/2fa/SegundoPaso.tsx'));
  // Irse marca «entrando» (el ref, para un doble toque antes del próximo dibujo) y traba lo que se dibuja.
  assert.match(p, /const irA = \(url: string\) => \{ entrando\.current = true; setYendo\(true\); window\.location\.href = url; \};/);
  assert.match(p, /const trabado = ocupado \|\| yendo;/);
  // Rota: volver a habilitar en el finally aunque ya se esté yendo → el segundo envío de Martín.
  assert.match(p, /const correr = async \(fn: \(\) => Promise<void>\) => \{\n\s*if \(entrando\.current\) return;\n\s*setOcupado\(true\);/);
  assert.match(p, /\} finally \{ if \(!entrando\.current\) setOcupado\(false\); \}/);
  // Toda salida a la app pasa por irA (sólo el 401 navega aparte, y ése no pinta nada).
  const navegaciones = p.match(/window\.location\.href = /g) ?? [];
  assert.equal(navegaciones.length, 3, 'una salida que no traba la pantalla (irA + los dos 401)');
  assert.match(p, /\n\s*irA\(next\);\n\s*\};/, 'terminar no pasa por irA');
  // Ni el botón ni el Enter (CampoCodigo lo mira por `ocupado`) mientras se va.
  assert.doesNotMatch(p, /disabled=\{ocupado/);
  assert.match(p, /onCompleto=\{onEnter\} ocupado=\{trabado\}/);
  assert.match(sinComentarios(leer('app/login/2fa/CampoCodigo.tsx')), /if \(e\.key === 'Enter' && valor && !ocupado\)/);
});

test('3. el servidor ya dice qué pasó con un código malo', () => {
  const r = sinComentarios(leer('app/api/auth/2fa/route.ts'));
  assert.match(r, /return no\(metodo === 'recuperacion' \? 'Ese código de recuperación no vale o ya se usó\.' : 'Ese código no coincide\.'\);/);
  assert.match(r, /if \(!q\) return no\('vencido', 401\);/);
});
