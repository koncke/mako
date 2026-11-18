// =============================================================================
// O8 (18/11/2026): Zernio, tanda C — las lecturas de Meta que todavía pedían el token, por la Zernio del negocio
// =============================================================================
// Martín, 25/10/2026: «implementa zernio y depreca la conexión con API de Meta». Seguían con el token (docs/relevo/zernio-capi.md,
// «la tanda C»): el reproductor del anuncio, el Instagram de la página, las páginas de los ganadores y la aprobación de Meta. Un
// negocio que conectó por Zernio (sin token) no podía usarlas. Lo que fija este test, corriendo las funciones de verdad
// (tests/_meta-zernio-tanda-c-hijo.ts), con los endpoints que el repo YA usa (`/ads/{id}/media`, `/ads/instagram-accounts`,
// `/ads/{id}`, `/ads/{id}/review`):
//   1. un negocio por Zernio SIN token lee las cuatro por Zernio y no sale ningún pedido a graph.facebook.com;
//   2. lo que se lee es lo correcto: el .mp4 del video, el Instagram de SU página, qué ganador es de una página ajena, cuál espera
//      la aprobación (y que uno que no se pudo leer no cuenta como leído);
//   3. con Zernio caído y el token de antes, se lee por el token de respaldo;
//   4. un negocio sólo con el token sigue por la Graph API, como siempre.
//
// Probado rompiéndolo (18/11/2026, una rotura por vez, restaurada; base en verde: 4 de 4):
//   · el video por el token aunque haya Zernio (sin la rama de Zernio en videoDeAnuncio) → 3 en rojo (el 1, el 2 y el 3);
//   · sin el respaldo cuando Zernio falla (tira) → 1 en rojo (el 3);
//   · el Instagram de la PRIMERA página en vez del de la página del negocio → 1 en rojo (el 2; la del negocio va segunda a
//     propósito en el Zernio de mentira: primera, esta rotura pasaba en verde);
//   · la aprobación por Zernio contando como leído lo que falló → 2 en rojo (el 2 y el 3).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
type Corrida = { ok?: unknown; tira?: string; red: string[] };
type Negocio = { video: Corrida; imagen: Corrida; ig: Corrida; ganadores: Corrida; aprobacion: Corrida };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_meta-zernio-tanda-c-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
});
const S = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as { ws3: Negocio; ws4: Negocio; ws13: Negocio; error?: string };
const aGraph = (c: Corrida) => c.red.filter((x) => x.startsWith('graph '));
const aZernio = (c: Corrida) => c.red.filter((x) => x.startsWith('zernio '));

test('1. un negocio por Zernio y sin token lee las cuatro por Zernio, sin un pedido a la Graph API', () => {
  assert.equal(S.error, undefined, String(S.error));
  for (const k of ['video', 'imagen', 'ig', 'ganadores', 'aprobacion'] as const) {
    const c = S.ws3[k];
    assert.equal(c.tira, undefined, `${k}: ${c.tira}`);
    assert.deepEqual(aGraph(c), [], `${k} pidió a la Graph API`);
    assert.ok(aZernio(c).length > 0, `${k} no habló con Zernio`);
  }
});

test('2. lo que se lee por Zernio es lo correcto', () => {
  assert.deepEqual(S.ws3.video.ok, { reproductor: null, video: 'https://video.fbcdn.test/700.mp4', permalink: null }, 'el .mp4 del anuncio');
  assert.deepEqual(S.ws3.imagen.ok, { reproductor: null, video: null, permalink: null }, 'un anuncio de imagen no tiene video');
  assert.equal(S.ws3.ig.ok, '7111', 'el Instagram de la página del negocio, no el de la cuenta ni el de otra página');
  assert.deepEqual(S.ws3.ganadores.ok, {
    800: { pagina: '111', puede: true },
    801: { pagina: '333', puede: false },
    802: { pagina: null, puede: true },
  }, 'el post de una página que la conexión no tiene no se puede reusar; sin post, no se descarta');
  assert.deepEqual(S.ws3.aprobacion.ok, { pendientes: [{ id: '900', name: 'Esperando', mid: 'm-900' }], leidos: 2 }, 'el 902 no se pudo leer: no cuenta');
});

test('3. con Zernio caído y el token de antes, se lee por el token de respaldo', () => {
  assert.deepEqual(S.ws4.video.ok, { reproductor: 'https://www.facebook.com/plugins/video.php?href=x', video: null, permalink: 'https://www.facebook.com/negocio/videos/55/' });
  assert.ok(aZernio(S.ws4.video).length > 0 && aGraph(S.ws4.video).every((x) => x.endsWith('token=tok_ws4')), 'primero Zernio, después SU token');
  assert.equal(S.ws4.ig.ok, '7111');
  assert.ok(aGraph(S.ws4.ganadores).length > 0, 'las páginas de los ganadores por el token');
  assert.ok(aGraph(S.ws4.aprobacion).length > 0, 'Zernio no leyó ninguno: la aprobación por el token');
});

test('4. un negocio sólo con el token sigue por la Graph API', () => {
  for (const k of ['video', 'ig', 'ganadores', 'aprobacion'] as const) {
    assert.deepEqual(aZernio(S.ws13[k]), [], `${k} habló con Zernio sin tenerlo`);
    assert.ok(aGraph(S.ws13[k]).every((x) => x.endsWith('token=tok_ws13')), `${k}: con SU token`);
  }
  assert.equal(S.ws13.video.tira, undefined);
  assert.match(String((S.ws13.video.ok as { reproductor?: string }).reproductor), /^https:\/\/www\.facebook\.com\/plugins\/video\.php/);
});
