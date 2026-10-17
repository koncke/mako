// =============================================================================
// «Si no sé de qué negocio es, lo tiro al de Mauricio»: cero en el código vivo (17/10/2026)
// =============================================================================
// `OWNER_WS` vale 1 y el ws1 es Mauricio, un CLIENTE. Había 40 `(await getWorkspaceActual()) ??
// OWNER_WS` escritos a mano (44 contando comentarios) y una docena de primos (`.catch(() =>
// OWNER_WS)`, `catch { return OWNER_WS; }`, `? OWNER_WS : null`): cualquier olvido era una fuga
// de datos de un cliente real, sin un error. `getWorkspaceActual()` devuelve null SÓLO cuando hay
// una cookie de sesión que no resuelve contra la base (suspendido, borrado, firma viva) — medido
// el 17/10/2026: los 14 usuarios de producción tienen workspace—, o sea justo el caso que no puede
// caer en el negocio de nadie. Ahora:
//   · lo que ESCRIBE, MANDA o GASTA usa `wsObligatorio()` (lib/workspace.ts), que TIRA;
//   · lo que sólo LEE usa `?? WS_NINGUNO` (-1: vuelve vacío, como `getTenantDb` con null).
// Un cron o un webhook SIN cookie no cambia: el default del resolver (`resolverDesdeCookies`) sigue
// en el ws1, y eso es otra decisión (anotada en docs/relevo/seguridad-aislamiento.md).
//
// Barre lib/, app/ y proxy.ts SIN comentarios ni strings (las bitácoras de /admin/dev citan el
// patrón viejo en sus textos). Una forma nueva de caer al ws1 que no esté acá no la caza: por eso
// la lista nombra las formas, y una que aparezca se suma.
//
// Probado rompiéndolo (17/10/2026), sobre los 2 de este archivo (base 2 / 0): devolviendo un
// `?? OWNER_WS` a lib/settings.ts → 1 / 1; con `.catch(() => OWNER_WS)` en lib/canal-vigilante.ts →
// 1 / 1; con `wsObligatorio` que devuelve el null en vez de tirar → 1 / 1 (el segundo).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/** Saca comentarios y literales de string (simple, comilla doble y template de una línea). */
function soloCodigo(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\\n$]|\\.)*`/g, '``');
}

const FORMAS: Array<[RegExp, string]> = [
  [/\?\?\s*OWNER_WS\b/, '?? OWNER_WS'],
  [/\.catch\(\s*\(\)\s*=>\s*(?:[\w.]+\s*\?\?\s*)?OWNER_WS\s*\)/, '.catch(() => OWNER_WS)'],
  [/catch\s*(?:\([^)]*\))?\s*\{\s*return\s+OWNER_WS\s*;?\s*\}/, 'catch { return OWNER_WS }'],
  [/==\s*null\)\s*return\s+OWNER_WS\b/, 'if (ws == null) return OWNER_WS'],
  [/\?\s*OWNER_WS\s*:\s*null\b/, '? OWNER_WS : null'],
];

test('ningún archivo cae al ws1 cuando no sabe de qué negocio es algo', () => {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app', 'proxy.ts'], { encoding: 'utf8' })
    .split('\n').filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 1000, `el barrido dejó de ver el código (vio ${archivos.length})`);
  const hallados: string[] = [];
  for (const f of archivos) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('OWNER_WS')) continue;
    const codigo = soloCodigo(src);
    for (const [re, nombre] of FORMAS) if (re.test(codigo)) hallados.push(`${f}: ${nombre}`);
  }
  assert.deepEqual(hallados, [], `caen al ws1 (Mauricio, un cliente) cuando no saben de quién es algo. Escribir/mandar/gastar → wsObligatorio(); leer → ?? WS_NINGUNO:\n${hallados.join('\n')}`);
});

test('wsObligatorio TIRA sin workspace y WS_NINGUNO no es un negocio', () => {
  const src = soloCodigo(readFileSync('lib/workspace.ts', 'utf8'));
  const cuerpo = src.slice(src.indexOf('export async function wsObligatorio'));
  assert.match(cuerpo, /if \(ws == null\) throw new SinWorkspaceError\(\);/);
  assert.match(src, /export const WS_NINGUNO = -1;/);
  // El proxy de getTenantDb usa el mismo «ningún negocio» para un workspace null.
  assert.match(src, /const wsId = ws \?\? WS_NINGUNO;/);
});
