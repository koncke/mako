// =============================================================================
// La charla de MaKo de un guion es del Copywriter: la ve y la escribe SÓLO quien pasa su puerta (28/10/2026)
// =============================================================================
// Verificación del Cerebro de 2f4df801e (MEDIA): `copywriter:<guion>` entró a PREFIJOS_HILO_DE_TAB y /api/hilo-de-tab sólo
// miraba el rol del workspace. El DUEÑO de un negocio (admin, no super admin) leía y escribía la charla que el super admin
// tuvo con MaKo sobre un guion de ese negocio, y le salía en su Ops Center; lo que escribía volvía a MaKo como charla.
// Fija: las reglas comunes (lib/chart-chats-reglas.ts) cierran esa charla a quien no dice que pasa la puerta (falla
// cerrado), y los CUATRO caminos lo dicen: el hilo de la tab, la lista y el hilo del Ops Center, y el doer.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveGuardada, esCharlaDelCopywriter, pasaLaPuertaDeSuTab, prefijoDePersona, puedeUsarSesion, type QuienChatea } from '../lib/chart-chats-reglas';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const DUENO: QuienChatea = { admin: true, persona: 'u7' };
const SUPER: QuienChatea = { admin: true, persona: 'u1', veCopywriter: true };
const CLOSER: QuienChatea = { admin: false, persona: 'u9' };

test('la charla de un guion: el dueño del negocio NO la abre ni la escribe; el super admin, sí', () => {
  const k = 'copywriter:gabc12345';
  assert.equal(esCharlaDelCopywriter(k), true);
  assert.equal(esCharlaDelCopywriter(`${prefijoDePersona('u9')}${k}`), true, 'también con el prefijo de una persona');
  assert.equal(claveGuardada(k, DUENO), null);
  assert.equal(puedeUsarSesion(k, DUENO), false);
  assert.equal(claveGuardada(k, SUPER), k);
  assert.equal(puedeUsarSesion(k, SUPER), true);
  assert.equal(claveGuardada(k, CLOSER), null);
  assert.equal(pasaLaPuertaDeSuTab(k, { ...DUENO, veCopywriter: false }), false);
});

test('las demás charlas siguen como siempre', () => {
  for (const k of ['dashboard:h1', 'landing:12', 'crm:lead:5']) {
    assert.equal(claveGuardada(k, DUENO), k, k);
    assert.equal(puedeUsarSesion(k, DUENO), true, k);
    assert.equal(claveGuardada(k, CLOSER), `${prefijoDePersona('u9')}${k}`, k);
  }
  assert.equal(esCharlaDelCopywriter('landing:copywriter'), false);
});

test('los cuatro caminos preguntan la puerta: el hilo de la tab, el Ops Center (lista y hilo) y el doer', () => {
  const hilo = leer('app/api/hilo-de-tab/route.ts');
  assert.match(hilo, /const \[rolWs, sesion, copy\] = await Promise\.all\(\[getRolWsEfectivo\(\), getUsuarioActual\(\), veCopywriter\(\)\]\);/);
  assert.match(hilo, /veCopywriter: copy \}/);
  const insights = leer('app/api/chart-insights/route.ts');
  assert.match(insights, /veCopywriter: copy \}/);
  assert.match(insights, /\.filter\(\(s\) => puedeUsarSesion\(s\.chart_key, q\)\)\.map\(ver\)/, 'la lista del Ops Center');
  const indice = leer('lib/chat-mako-indice.ts');
  assert.match(indice, /veCopywriter: copy, sub:/);
  assert.match(indice, /!esChatDelTelefono\(s\.chart_key\) && pasaLaPuertaDeSuTab\(s\.chart_key, q\)/, 'los chats de antes');
  const doer = leer('app/api/mako-doer/route.ts');
  assert.match(doer, /if \(q\.admin\) return !s \|\| !esCharlaDelCopywriter\(s\.chart_key\) \|\| q\.veCopywriter;/);
  assert.match(doer, /\.filter\(\(s\) => !esCharlaDelCopywriter\(s\.chart_key\) \|\| q\.veCopywriter\)/);
});

test('la regla de la puerta vive en UN lugar (lib), y la pantalla la re-exporta', () => {
  // Desde el 29/10/2026 la puerta es toda persona con sesión (Copywriting ES el Copywriter, D13): el rol y la capa los mira
  // la tab. Las cuatro rutas de arriba siguen preguntando, así que volver a cerrarla es cambiar ESTA línea.
  assert.match(leer('lib/copywriter/puerta.ts'), /return !!\(await getUsuarioActual\(\)\.catch\(\(\) => null\)\);/);
  const acceso = sinComentarios(leer('app/copywriter/acceso.ts'));
  assert.match(acceso, /import \{ veCopywriter \} from '@\/lib\/copywriter\/puerta';/);
  assert.doesNotMatch(acceso, /getSesionAdmin/, 'una sola copia de la regla');
});
