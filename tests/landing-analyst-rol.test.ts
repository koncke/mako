// =============================================================================
// Las rutas de /api/landing-analyst son SÓLO del admin (tanda 6 del editor de landings, 14/10/2026)
// =============================================================================
// Pendiente de la tanda 2 (docs/hallazgos-editor-landing.md): «Las rutas analyze, sync y pulso del
// Landing Analyst no miran el rol». `analyze` y `sync` gastan IA con las keys del negocio y `pulso` es la
// analítica de sus páginas; cualquier sesión del workspace (un closer, un setter) las podía llamar. /view
// y /mapa ya tenían la puerta (integración de la tanda 2 y v5 del Dashboard).
//
// Lo que fija: CADA ruta de app/api/landing-analyst (se barre la carpeta: una ruta nueva sin puerta
// también falla) abre CADA método con la puerta —admin del negocio o super admin, 403 si no—, y como
// PRIMERA instrucción: antes de leer el body o de cualquier trabajo. Se lee del fuente sin comentarios
// (las rutas importan módulos server-only).
//
// PROBADO ROMPIÉNDOLO (14/10/2026): base en verde (2 pasan / 0 fallan), una rotura por vez, restaurada
// de memoria (sha256 igual). Pasan / fallan:
//   · analyze sin la puerta (lo de antes)                                    -> 1 / 1
//   · sync con la puerta DESPUÉS de leer el body                             -> 1 / 1
//   · pulso con la puerta al revés (deja pasar a todo el que no es closer)   -> 1 / 1
//   · una ruta nueva (app/api/landing-analyst/zz-rotura) sin la puerta       -> 1 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..');
const CARPETA = join(RAIZ, 'app/api/landing-analyst');
const leer = (abs: string) => readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Todas las route.ts de la carpeta, recursivo. */
function rutas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const abs = join(dir, n);
    if (statSync(abs).isDirectory()) return rutas(abs);
    return n === 'route.ts' ? [abs] : [];
  });
}

/** La puerta, tal cual la tienen /view y /mapa. */
const PUERTA = /^if \(\(await getSesionAdmin\(\)\) == null && \(await getRolWsEfectivo\(\)\) !== 'admin'\) \{\s*return Response\.json\(\{ ok: false, error: 'solo admin' \}, \{ status: 403 \}\);\s*\}/;
/** O la misma puerta en un helper (`soloAdmin`, la forma de /view). */
const POR_HELPER = /^const cerrada = await soloAdmin\(\);\s*if \(cerrada\) return cerrada;/;

/** Cada método exportado con su cuerpo, desde la llave que lo abre. */
function metodos(src: string): Array<{ metodo: string; cuerpo: string }> {
  const out: Array<{ metodo: string; cuerpo: string }> = [];
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const desde = m.index + m[0].length;
    const hasta = src.indexOf('\nexport ', desde);
    out.push({ metodo: m[1], cuerpo: src.slice(desde, hasta < 0 ? src.length : hasta).trim() });
  }
  return out;
}

test('se barren las rutas de verdad (si el barrido no encuentra nada, el test de abajo no prueba nada)', () => {
  const nombres = rutas(CARPETA).map((r) => relative(CARPETA, r).replace(/\\/g, '/')).sort();
  for (const r of ['analyze/route.ts', 'sync/route.ts', 'pulso/route.ts', 'view/route.ts', 'mapa/route.ts', 'mapa/fondo/route.ts']) {
    assert.ok(nombres.includes(r), `falta ${r} en el barrido`);
  }
});

test('cada método de cada ruta abre con la puerta de admin, ANTES de leer el body o de trabajar', () => {
  let revisados = 0;
  for (const abs of rutas(CARPETA)) {
    const nombre = relative(RAIZ, abs).replace(/\\/g, '/');
    const src = sinComentarios(leer(abs));
    const ms = metodos(src);
    assert.ok(ms.length > 0, `${nombre}: no exporta ningún método`);
    for (const { metodo, cuerpo } of ms) {
      revisados++;
      if (PUERTA.test(cuerpo)) continue;
      assert.match(cuerpo, POR_HELPER, `${nombre} ${metodo}: la primera instrucción no es la puerta de admin`);
      const helper = src.slice(src.indexOf('async function soloAdmin('));
      const cuerpoHelper = helper.slice(helper.indexOf('{') + 1).trim();
      assert.match(cuerpoHelper, PUERTA, `${nombre}: soloAdmin no es la puerta de admin`);
    }
  }
  assert.ok(revisados >= 7, `revisó ${revisados} métodos`);
});
