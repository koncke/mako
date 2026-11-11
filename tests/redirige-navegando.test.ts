// =============================================================================
// Un layout que redirige DEBAJO de sí mismo lo hace sólo en la CARGA del documento (28/10/2026, el blanco del Web Generator)
// =============================================================================
// Martín: «Cada vez que entro a web generator, hay un bug que aparece todo en blanco, le tengo que dar a refresh para que me
// cargue la tab» («Me pasa en la cuenta de superadmin entrando desde cualquier dispositivo»). Medido con el build de
// producción (23b329b5e) en un Chrome sin ventana: desde el menú, /web-generator → el layout redirige a la última landing
// → el router pide /web-generator/<id> UNA Y OTRA VEZ, cada segundo, y la pantalla queda en blanco; directo (= refresh),
// el editor. Navegando, el `redirect()` de un layout viaja ADENTRO del RSC, en el nodo del layout
// (`NEXT_REDIRECT;replace;/web-generator/72?ws=9;307;`), y el router guarda ese nodo: al llegar a /web-generator/<id>, que es
// el MISMO layout, el redirect se vuelve a tirar. Sólo pasaba donde hay landings (el negocio de la plataforma, el 9).
// Lo que fija:
//   1. La regla pura: navegación del cliente = `Next-Url` o `Sec-Fetch-Dest` de un fetch; sin ninguno, documento.
//   2. /web-generator, /plan (/plan ↔ /plan/agencia, el mismo layout) y el resumen de /crm (al mismo resumen en el negocio
//      del lead) redirigen así; sus páginas, siempre.
//   3. TODO `app/`: un layout que redirige a una ruta LITERAL debajo de sí mismo pregunta `esNavegacionDelCliente`.
// Probado rompiéndolo: docs/hallazgos-infra.md («El blanco del Web Generator»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { esNavegacionDelClienteDe } from '../lib/pedido-actual-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. navegación del cliente: el router manda Next-Url y el navegador Sec-Fetch-Dest de un fetch; una carga, no', () => {
  // Lo que mandó el Chrome de la prueba al entrar por el menú (y al precargar el link).
  assert.equal(esNavegacionDelClienteDe('/perfil', 'empty'), true);
  assert.equal(esNavegacionDelClienteDe('/web-generator/72', null), true, 'sólo Next-Url alcanza');
  assert.equal(esNavegacionDelClienteDe(null, 'empty'), true, 'sólo el fetch alcanza');
  // Una carga: la del navegador (document), adentro de un iframe, o sin encabezados (curl, un navegador viejo).
  assert.equal(esNavegacionDelClienteDe(null, 'document'), false);
  assert.equal(esNavegacionDelClienteDe(null, 'iframe'), false);
  assert.equal(esNavegacionDelClienteDe(null, null), false, 'sin señales se redirige como siempre');
  assert.equal(esNavegacionDelClienteDe('', 'DOCUMENT'), false);
  // headers() no deja ver el `RSC: 1` (Next lo saca): por eso estas dos, que sí llegan.
  const helper = sinComentarios(leer('lib/pedido-actual.ts'));
  assert.match(helper, /return esNavegacionDelClienteDe\(h\.get\('next-url'\), h\.get\('sec-fetch-dest'\)\);/);
});

test('2. /web-generator, /plan y el resumen de /crm: el layout redirige SÓLO en la carga; navegando, la página', () => {
  const wg = sinComentarios(leer('app/web-generator/layout.tsx'));
  assert.match(wg, /if \(cual && !\(await esNavegacionDelCliente\(\)\)\) \{/);
  // Desde el 11/11/2026 /web-generator pelada no salta (es la portada de outliers): el layout sólo redirige /analizar y /crear.
  assert.doesNotMatch(sinComentarios(leer('app/web-generator/page.tsx')), /redirect\(/, 'la página ya no salta');
  const plan = sinComentarios(leer('app/plan/layout.tsx'));
  const antes = (destino: string) => new RegExp(`if \\(await esNavegacionDelCliente\\(\\)\\) return children;\\n\\s*redirect\\(await rutaConWs\\(\`${destino}`);
  assert.match(plan, antes('\\/plan\\/agencia'), '/plan → /plan/agencia');
  assert.match(plan, antes('\\/plan\\$'), '/plan/agencia → /plan');
  assert.match(sinComentarios(leer('app/plan/page.tsx')), /redirect\(await rutaConWs\(`\/plan\/agencia/);
  assert.match(sinComentarios(leer('app/plan/agencia/page.tsx')), /redirect\(await rutaConWs\(`\/plan\$/);
  // El destino no es literal (`destinoDelResumen`): el recorrido de abajo no lo ve. /crm/<id>/resumen → el mismo ?ws=<dueño>.
  const crm = sinComentarios(leer('app/crm/layout.tsx'));
  assert.match(crm, /if \(await esNavegacionDelCliente\(\)\) return children;\n\s*const \[wsDueno, wsActual\]/, '/crm/<id>/resumen → el de su negocio');
  assert.match(sinComentarios(leer('app/crm/[id]/resumen/page.tsx')), /redirect\(destinoDelResumen\(leadId, wsDueno\)\)/);
});

test('3. ningún layout redirige a una ruta LITERAL debajo de sí mismo sin preguntar si es una navegación', () => {
  const layouts: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${n}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) recorrer(rel);
      else if (n === 'layout.tsx') layouts.push(rel);
    }
  };
  recorrer('app');
  const malos: string[] = [];
  for (const rel of layouts) {
    const ruta = '/' + rel.replace(/^app\//, '').replace(/\/layout\.tsx$/, '').split('/').filter((s) => !/^\(.*\)$/.test(s)).join('/');
    if (ruta === '/') continue;
    const src = sinComentarios(leer(rel));
    // El destino de cada redirect, si es literal ('…' o `…`), con o sin rutaConWs.
    const destinos = [...src.matchAll(/redirect\((?:await rutaConWs\()?\s*[`'"]([^`'"$]*)/g)].map((m) => m[1]);
    const adentro = destinos.filter((d) => d === ruta || d.startsWith(ruta + '/') || d.startsWith(ruta + '?'));
    if (adentro.length && !/esNavegacionDelCliente\(\)/.test(src)) malos.push(`${rel} → ${adentro.join(', ')}`);
  }
  assert.deepEqual(malos, [], `redirigen debajo de sí mismos sin la regla (lib/pedido-actual.ts): ${malos.join(' · ')}`);
});
