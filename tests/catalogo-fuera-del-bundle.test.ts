// =============================================================================
// El catálogo de credenciales NO puede viajar al navegador
// =============================================================================
// `lib/metodo-catalogo.ts` son 145 KB: los tutoriales de las 20 integraciones, los
// nombres de TODAS las envs y el copy interno de la agencia — incluida la entrada
// de GitHub, que es una credencial de PLATAFORMA que ningún cliente tiene por qué
// ver. No es un secreto; es información interna en el navegador de un cliente.
//
// Hasta el 25/08/2026 el módulo se importaba desde TRES componentes `'use client'`
// (IntegracionesBoard, OnboardingInstagram, MetodoWizard), así que el catálogo
// entero entraba al bundle. Y el filtro que existe para esto —`serviciosPara()`—
// no servía de nada: **filtrar al PINTAR no sirve si el dato ya viajó**.
//
// La defensa real es el `import 'server-only'` del módulo: importar un VALOR desde
// un `'use client'` rompe el build. Este test cuida las dos mitades de esa defensa,
// porque las dos se pueden quitar sin que nada más falle:
//   1. que el `server-only` siga puesto;
//   2. que ningún componente cliente lo importe como valor.
//
// (Los TIPOS sí se pueden importar: `import type` se borra en compilación y no
//  arrastra un solo byte.)
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/** Todos los .ts/.tsx bajo app/ y lib/, sin node_modules ni artefactos. */
function fuentes(): string[] {
  const out: string[] = [];
  const IGNORAR = new Set(['node_modules', '.next', 'graphify-out', 'plugin']);
  const caminar = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (IGNORAR.has(e)) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) caminar(p);
      else if (/\.tsx?$/.test(e)) out.push(p);
    }
  };
  for (const d of ['app', 'lib']) caminar(join(RAIZ, d));
  return out;
}

test('el catálogo declara `server-only`', () => {
  const s = leer(join(RAIZ, 'lib', 'metodo-catalogo.ts'));
  assert.ok(
    /^import 'server-only';$/m.test(s),
    'sin `import \'server-only\'`, un import desde un componente cliente vuelve a compilar en silencio ' +
    'y el catálogo entero vuelve al bundle. Es el único guard que lo impide.',
  );
});

test('ningún componente cliente importa un VALOR del catálogo', () => {
  const culpables: string[] = [];
  for (const p of fuentes()) {
    const s = leer(p);
    // 'use client' tiene que estar en las primeras líneas para valer como directiva.
    if (!/^\s*['"]use client['"]/m.test(s.slice(0, 400))) continue;
    for (const m of s.matchAll(/^import\s+(type\s+)?([^;]*?)\s+from\s+['"](?:@\/lib\/|\.\.?\/(?:\.\.\/)*lib\/)metodo-catalogo['"]/gm)) {
      const esTipoEnLinea = !!m[1];
      // `import { type X, algo }` mezcla los dos: solo es seguro si TODO lo
      // importado lleva `type`.
      const soloTipos = esTipoEnLinea
        || m[2].replace(/[{}]/g, '').split(',').filter((x) => x.trim()).every((x) => /^\s*type\s/.test(x));
      if (!soloTipos) culpables.push(`${p.slice(RAIZ.length)} → ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(
    culpables, [],
    'estos componentes cliente importan un valor del catálogo, y eso mete sus 145 KB en el bundle ' +
    `del navegador de cualquier cliente:\n${culpables.join('\n')}\n` +
    'Pasalo por props desde su server component —y ya filtrado con serviciosPara()— o usá `import type`.',
  );
});

test('los tres que lo importaban lo reciben por props', () => {
  // No alcanza con que no importen: hay que comprobar que el dato SIGUE llegando,
  // o el arreglo habría sido borrar la funcionalidad.
  const board = leer(join(RAIZ, 'app', 'integraciones', 'IntegracionesBoard.tsx'));
  assert.ok(/i\.soloServidor/.test(board) && /i\.paraQue/.test(board),
    'la grilla tiene que leer los dos campos de la Integracion que le llega del server');

  const ig = leer(join(RAIZ, 'app', 'instagram', 'OnboardingInstagram.tsx'));
  assert.ok(/tutorialZernio/.test(ig), 'el onboarding de Instagram tiene que recibir el tutorial por props');

  const wizard = leer(join(RAIZ, 'app', 'metodo', 'MetodoWizard.tsx'));
  assert.ok(/servicios: SERVICIOS_METODO/.test(wizard), 'el wizard tiene que recibir el catálogo por props');

  // ⚠️ Y la página se lo pasa FILTRADO. Sin esto el arreglo es solo de peso: el
  // cliente dejaría de cargar 145 KB pero seguiría recibiendo, en el JSON de la
  // página, las credenciales de plataforma que no le corresponden.
  const page = leer(join(RAIZ, 'app', 'metodo', 'page.tsx'));
  assert.ok(/serviciosPara\(/.test(page), 'el catálogo tiene que viajar filtrado, no entero');
  assert.ok(/wsSuperAdmin\(\)/.test(page),
    'el filtro se decide por WORKSPACE, no por sesión: el super admin sigue siéndolo dentro del workspace de un cliente');
});
