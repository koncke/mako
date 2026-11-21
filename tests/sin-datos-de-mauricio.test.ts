// =============================================================================
// «DATOS DE MAURICIO» YA NO EXISTE (21/11/2026, el Cerebro con la decisión de Martín)
// =============================================================================
// «Esa parte ya no debería existir», y además traía datos de un cliente (Mauricio) a una cuenta de prueba. Se borró /api/datos-mau, sus
// acciones (traer, devolver, «todo»), lib/datos-mau.ts y el componente que la llamaba. Lo único que servía de ahí, el borrado total de un
// negocio de prueba («Borrar todos los datos», en /admin/customers/<ws>) y el «Probar tema» del Cliente de Diseño, van por su propia
// ruta, con la MISMA puerta: /api/admin/negocio-de-prueba.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fuente = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) out.push(...archivos(r));
    else if (/\.(ts|tsx|mjs|js)$/.test(n)) out.push(r);
  }
  return out;
}

test('1. la ruta, la lib y el componente ya no están', () => {
  for (const f of ['app/api/datos-mau/route.ts', 'lib/datos-mau.ts', 'app/_components/DatosDeMau.tsx']) assert.equal(existsSync(join(RAIZ, f)), false, `${f} sigue`);
});

test('2. nada del producto la llama ni la importa (los comentarios pueden contar la historia)', () => {
  const malos = [...archivos('app'), ...archivos('lib')].filter((f) => {
    const s = sinComentarios(fuente(f));
    return /['"`]\/api\/datos-mau|from ['"][^'"]*datos-mau['"]|DatosDeMau/.test(s);
  });
  assert.deepEqual(malos, []);
});

test('3. lo que servía va por su ruta, con la MISMA puerta: super admin y un negocio de prueba que no es de una agencia', () => {
  const r = sinComentarios(fuente('app/api/admin/negocio-de-prueba/route.ts'));
  const i = r.indexOf('async function wsDePrueba');
  const cuerpo = r.slice(i, r.indexOf('\n}\n', i));
  assert.match(cuerpo, /if \(!\(await getSesionAdmin\(\)\)\) return null;/);
  assert.match(cuerpo, /if \(ws == null \|\| !esClienteDePrueba\(ws\)\) return null;/);
  assert.match(cuerpo, /if \(\(await agenciasDeCliente\(ws\)\)\.some\(esCarteraVigente\)\) return null;/);
  assert.match(r, /if \(body\.action === 'borrar'\) \{[\s\S]{0,200}resetearWorkspace\(ws\)/);
  const h = sinComentarios(fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx'));
  assert.match(h, /fetch\(conWs\('\/api\/admin\/negocio-de-prueba', negocio\.ws\), \{[\s\S]{0,200}JSON\.stringify\(\{ action: 'borrar' \}\)/);
  assert.match(sinComentarios(fuente('app/_components/PanelAgencia.tsx')), /fetch\('\/api\/admin\/negocio-de-prueba', \{ cache: 'no-store' \}\)/);
  // La lista de lo que el RESET le saca a la gente vive con el RESET.
  assert.match(fuente('lib/reset-workspace.ts'), /export const PERFIL_EXTRA = \[/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · un fetch a /api/datos-mau de vuelta en PanelAgencia          → 2, 3
//   · la ruta nueva sin la lista blanca                            → 3
//   · la ruta nueva sin mirar la cartera de las agencias            → 3
// ─────────────────────────────────────────────────────────────────────────────
