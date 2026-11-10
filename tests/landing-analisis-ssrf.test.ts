// =============================================================================
// El análisis de una landing ya no sigue redirecciones sin validar el destino (17/10/2026)
// =============================================================================
// `analizarLanding` (lib/landing-analisis.ts) bajaba la página con `fetch` + `redirect: 'follow'`
// —su default era `fetch`—: a lo sumo se validaba la primera dirección y cada redirect se seguía
// sin mirarlo. Una landing pública que redirige a 169.254.169.254 o a 127.0.0.1 se leía entera
// desde nuestro servidor, y desde el 16/09 lo dispara también la API de MaKo
// (`detectar_piezas_landing`). Lo mismo hacía «Cargar guiones desde un link» del Video Generator.
//
// Ahora el `fetch` del analizador es OBLIGATORIO y en el servidor es `fetchSeguro`
// (lib/fetch-seguro.ts): `validarDestino` en cada salto, IP clavada y techo de tamaño — la bajada
// del Archivero, que ya tiene sus pruebas de comportamiento en tests/seguridad-tokens-linea-ssrf
// (el salto a una IP interna NO se pide, la conexión va a la IP validada, el techo de 3 MB).
// Acá se fija el CABLEADO, leyendo el fuente:
//   1. `analizarLanding` no tiene default (el tipo no deja olvidarse de elegir la bajada).
//   2. Todo llamador de producción le pasa `fetchSeguro`.
//   3. Ningún archivo que valida un destino con `validarDestino` hace después un `fetch` pelado
//      (la forma exacta del agujero: validar el primer salto y dejar que `fetch` siga el resto).
//
// Probado rompiéndolo (17/10/2026), una rotura por vez: con `fetchImpl: Buscador = fetch` vuelve
// el default → 2 / 1; con landing-vigilancia llamando `analizarLanding(url)` → 2 / 1; con
// cargar-guiones-action volviendo a `fetch(url, …)` → 2 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios de línea ni de bloque: un `fetch(` dentro de un comentario no cuenta. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('analizarLanding no tiene un fetch por default', () => {
  const src = leer('lib/landing-analisis.ts');
  const firma = /export async function analizarLanding\(([^)]*)\)/.exec(src);
  assert.ok(firma, 'no encontré la firma de analizarLanding');
  assert.doesNotMatch(firma[1], /=/, `analizarLanding volvió a tener un default: ${firma[1]}`);
  assert.doesNotMatch(sinComentarios(src), /redirect:\s*'follow'/);
});

test('todo llamador de producción de analizarLanding le pasa fetchSeguro', () => {
  const archivos = execFileSync('git', ['grep', '-l', 'landing-analisis', '--', 'lib', 'app'], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  let llamadas = 0;
  for (const f of archivos) {
    const src = sinComentarios(leer(f));
    const imp = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*landing-analisis['"]/.exec(src);
    if (!imp) continue;
    const m = /analizarLanding(?:\s+as\s+(\w+))?/.exec(imp[1]);
    if (!m) continue;
    const nombre = m[1] ?? 'analizarLanding';
    for (const c of src.matchAll(new RegExp(`\\b${nombre}\\(([^;]*?)\\)`, 'g'))) {
      llamadas++;
      assert.match(c[1], /fetchSeguro/, `${f}: ${nombre}(${c[1]}) sin fetchSeguro`);
    }
  }
  assert.ok(llamadas >= 2, `el guard dejó de ver los llamadores (vio ${llamadas})`);
});

// Los que llaman `fetch` con hosts FIJOS (no con la dirección que escribió alguien). Cada uno con
// su porqué; un archivo nuevo acá es una decisión, no un descuido.
const FETCH_A_HOSTS_FIJOS: Record<string, string> = {
  'lib/imagenes-stock.ts': 'picsum, MyMemory y Openverse: hosts escritos en el código; lo del usuario va por su bajada con validarDestino',
  // 10/11/2026, los videos del B-roll: el video pide 4 MB y 30 s (fetchSeguro topea en 3 MB y 12 s), así que va por
  // bajarWebSegura con validarDestino; el `fetch` pelado es sólo a la API, un host fijo.
  'lib/pexels.ts': 'api.pexels.com: host escrito en el código (ORIGEN_API_PEXELS); fotos y videos se bajan con fetchSeguro o bajarWebSegura + validarDestino',
};

test('quien valida un destino con validarDestino no hace después un fetch pelado', () => {
  const archivos = execFileSync('git', ['grep', '-l', 'validarDestino', '--', 'lib', 'app'], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  assert.ok(archivos.length >= 5, `el guard dejó de ver los archivos (vio ${archivos.length})`);
  for (const f of archivos) {
    if (FETCH_A_HOSTS_FIJOS[f]) continue;
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /(^|[^\w.])fetch\(/m, `${f} valida el destino y después usa fetch (sigue redirects sin mirarlos): usá fetchSeguro`);
  }
});
