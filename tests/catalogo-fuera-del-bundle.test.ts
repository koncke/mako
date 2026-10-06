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

test('la rama de GitHub no viaja en el form genérico', () => {
  // ServicioConfigForm se monta para CUALQUIER integración, así que todo lo que
  // tenga adentro lo descarga quien abre el modal de Calendly o de Groq. Los
  // literales 'GITHUB_TOKEN', 'GITHUB_REPO' y 'descubrir-github' estaban ahí:
  // medido sobre el build de producción, 4 chunks.
  //
  // Lo que viajaba era el NOMBRE de la env, no el valor del token — el valor vive
  // cifrado y solo lo lee el server. Pero el nombre de la credencial de la
  // plataforma no tiene por qué estar en el navegador de un cliente: la superficie
  // que no se entrega es la que no hay que defender.
  //
  // ⚠️ ESTO NO ES EL GUARD DE SEGURIDAD. El guard es `servicioDelContexto()` en
  // app/api/integraciones/credencial/route.ts, que devuelve 404 a quien no le
  // corresponde. Esto es la capa de arriba.
  const form = leer(join(RAIZ, 'app', 'integraciones', 'ServicioConfigForm.tsx'));
  // Sin los comentarios: el de arriba nombra las tres cadenas para explicar el
  // porqué, y no viaja a ningún lado (el build los borra).
  const codigo = form.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const s of ['GITHUB_TOKEN', 'GITHUB_REPO', 'descubrir-github']) {
    assert.ok(!codigo.includes(s), `«${s}» volvió al form genérico: eso lo mete en el bundle de todas las integraciones`);
  }
  // Y sigue funcionando, cargado aparte.
  assert.ok(/dynamic\(\(\) => import\('\.\/GithubRepoPicker'\)/.test(form),
    'el picker tiene que cargarse con next/dynamic: un import estático lo devuelve al bundle común');
  assert.ok(/ssr: false/.test(form), 'sin ssr:false el componente se renderiza en el server y su código vuelve');
});

test('los que lo importaban lo reciben por props', () => {
  // No alcanza con que no importen: hay que comprobar que el dato SIGUE llegando,
  // o el arreglo habría sido borrar la funcionalidad.
  const board = leer(join(RAIZ, 'app', 'integraciones', 'IntegracionesBoard.tsx'));
  assert.ok(/i\.soloServidor/.test(board) && /i\.paraQue/.test(board),
    'la grilla tiene que leer los dos campos de la Integracion que le llega del server');

  // El tercero era app/instagram/OnboardingInstagram.tsx (el tutorial de Zernio por
  // props). Se borró el 06/10/2026 con la tab Instagram: tests/sin-instagram.test.ts.

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
