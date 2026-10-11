// =============================================================================
// Un server component no puede IMPORTAR UN VALOR de un `'use client'`
// =============================================================================
// El 29/09/2026 esto dejó `/onboarding` entero en «Esta pantalla se rompió al
// dibujarse», en PRODUCCIÓN. La causa: `tabDeUrl` —una función de tres líneas—
// vivía exportada desde `OnboardingTabs.tsx`, que lleva `'use client'`, y la
// llamaba el `page.tsx`, que es server.
//
// Para el grafo del server, un export de un módulo de cliente NO es lo que dice
// ser: es una REFERENCIA de cliente. No falla al importar. Falla al USARLO, con
// un digest y sin nombrar ni el archivo ni la línea.
//
// ⚠️ POR QUÉ NO LO CAZÓ NADA DE LO QUE YA HABÍA. Las tres redes miraron para otro
// lado, y cada una por una razón distinta:
//
//   · `npm run typecheck` → `tsx` IGNORA la directiva `'use client'`. Para el
//     compilador es una función normal, perfectamente tipada. Verde.
//   · `npm test` → los guards de la casa leen los fuentes como TEXTO. Verde.
//   · la verificación en el navegador → esa tanda abrió /crm, no /onboarding.
//
// Lo caza `npm run build` (que NO corre en el pre-push, a propósito), mirar la
// pantalla, o nadie. Este test es el «o nadie»: son ~200 ms y corre con `npm test`.
//
// ⚠️ LO QUE SÍ SE PUEDE, y es la mitad que hace falta no romper: un server
// component IMPORTA COMPONENTES de cliente y los monta. `<OnboardingTabs />` es
// legítimo y es el patrón de todo el repo. Lo que no se puede es traerse una
// FUNCIÓN o una CONSTANTE y usarla del lado del server.
//
// La regla para distinguirlos es la convención de nombres de React, que este repo
// cumple sin excepción: un componente va en PascalCase, todo lo demás no. Así que
// se persigue el import de un nombre que NO empiece con mayúscula.
//
// Y `import type` viaja gratis: TypeScript lo borra en compilación, así que no
// existe en runtime y no puede romper nada.
//
// Probado rompiéndolo (con el arreglo puesto, 3 pasan y 0 fallan):
//   · page.tsx vuelve a importar `tabDeUrl` de OnboardingTabs   -> 2 / 1  ← EL BUG REAL
//   · un `use client` importa un valor de un módulo server-only -> 2 / 1
//   · el parser deja de sacar los comentarios                   -> 2 / 1
//
// ⚠️ Y UNA CUARTA ROTURA QUE NO HIZO FALTA PROVOCAR, porque pasó sola: el parser sin
// la limpieza de comentarios dio DOS falsos positivos cuyo «nombre importado» era la
// prosa del comentario de al lado, palabra por palabra. La cláusula de un import se
// captura con `[^;]*?` y en TypeScript el `;` no es obligatorio, así que un párrafo
// entre dos imports hace que el match arranque en el de arriba y se lo coma.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(import.meta.dirname, '..');

function archivosDelRepo(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 300, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

const leer = (f: string): string => {
  try { return readFileSync(join(RAIZ, f), 'utf8'); } catch { return ''; }
};

/** ¿Este módulo se envía al navegador? La directiva va en las primeras líneas. */
const esCliente = (src: string): boolean => /^\s*['"]use client['"]/m.test(src.slice(0, 400));

/**
 * Carpetas que son cliente por su ÚNICA puerta de entrada, no por la directiva. El guard
 * de la otra mitad (tests/video-editor-integracion.test.ts) LEE esta línea —no la
 * importa: importar un test lo vuelve a correr— y vigila esa puerta: si una carpeta se
 * suma acá sin que nadie la vigile, la excepción tapa justo el bug que este test caza.
 */
const CLIENTE_POR_FRONTERA = ['app/video-editor/_opencut/', 'app/video-editor/ce/'];

/** ¿Este módulo está marcado como exclusivo del server? */
const esServerOnly = (src: string): boolean => /^\s*import\s+['"]server-only['"]/m.test(src);

/**
 * Los imports de un fuente, ya separados en «qué nombres» y «de dónde».
 *
 * ⚠️ Se saltean los `import type`, y también los especificadores marcados `type`
 * adentro de las llaves (`import { type Foo, bar }`): un tipo se borra en
 * compilación, así que cruzar la frontera con uno no cuesta nada.
 */
function importsDe(crudo: string): Array<{ nombres: string[]; desde: string }> {
  // ⚠️ LOS COMENTARIOS SE SACAN PRIMERO, y esto no es prolijidad: la cláusula de un
  // import se captura con `[^;]*?`, y en TypeScript un import no lleva `;` obligatorio.
  // Con un bloque de comentarios entre dos imports, el match arranca en el `import` de
  // arriba y se come el párrafo entero — el guard reportó dos falsos positivos cuyo
  // «nombre importado» era la prosa del comentario, palabra por palabra.
  //
  // Y el ORDEN importa: los de línea ANTES que los de bloque. Al revés, un `//` que
  // contenga un `/*` abre un bloque que se come el resto del archivo — el mismo bug
  // que ya tuvo el guard de voseo, donde dejó 71 líneas sin mirar.
  const src = crudo.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ nombres: string[]; desde: string }> = [];
  const re = /import\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    if (m[1]) continue;                       // `import type { … } from`
    const clausula = m[2];
    const llaves = clausula.match(/\{([^}]*)\}/);
    const nombres: string[] = [];
    // El default y el namespace (`import X from`, `import * as X from`) son, casi
    // siempre, el componente — y de todos modos el nombre decide igual que abajo.
    const suelto = clausula.replace(/\{[^}]*\}/g, '').replace(/,/g, ' ').trim();
    for (const n of suelto.split(/\s+/)) {
      if (n && n !== '*' && n !== 'as') nombres.push(n);
    }
    if (llaves) {
      for (const bruto of llaves[1].split(',')) {
        const pieza = bruto.trim();
        if (!pieza || /^type\s/.test(pieza)) continue;   // `{ type Foo }`
        // `{ foo as bar }` — lo que se usa acá es el alias, pero lo que decide si
        // es un componente es cómo se llama del lado de allá. Se miran los dos.
        const [orig, alias] = pieza.split(/\s+as\s+/).map((x) => x.trim());
        nombres.push(orig);
        if (alias) nombres.push(alias);
      }
    }
    out.push({ nombres, desde: m[3] });
  }
  return out;
}

/** Resuelve un import relativo o con `@/` a una ruta del repo, con su extensión. */
function resolver(desdeArchivo: string, spec: string, todos: Set<string>): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) {
    const dir = desdeArchivo.split('/').slice(0, -1);
    for (const parte of spec.split('/')) {
      if (parte === '.') continue;
      else if (parte === '..') dir.pop();
      else dir.push(parte);
    }
    base = dir.join('/');
  } else return null;   // un paquete de node_modules
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (todos.has(base + ext)) return base + ext;
  }
  return todos.has(base) ? base : null;
}

test('⚠️ ningún módulo del server importa un VALOR de un «use client»', () => {
  const todos = archivosDelRepo();
  const set = new Set(todos);
  const cache = new Map<string, string>();
  const src = (f: string) => { if (!cache.has(f)) cache.set(f, leer(f)); return cache.get(f)!; };

  const malos: string[] = [];
  for (const f of todos) {
    const t = src(f);
    if (esCliente(t)) continue;          // cliente → cliente es legítimo
    // El motor del Video Editor (OpenCut portado) es cliente ENTERO aunque sus módulos
    // no lleven la directiva: entra sólo por VideoEditorCliente ('use client', con
    // `dynamic(..., { ssr: false })`). Dio 12 falsos positivos el 11/10/2026 (hooks y
    // stores importados entre sí). La otra mitad —que ningún módulo del server importe
    // un valor del motor— la fija tests/video-editor-integracion.test.ts.
    if (CLIENTE_POR_FRONTERA.some((d) => f.startsWith(d))) continue;
    for (const imp of importsDe(t)) {
      const destino = resolver(f, imp.desde, set);
      if (!destino || !esCliente(src(destino))) continue;
      // Un componente va en PascalCase. Traerse eso y montarlo es el patrón normal.
      const valores = imp.nombres.filter((n) => n && !/^[A-Z]/.test(n));
      if (valores.length) malos.push(`${f} ← { ${valores.join(', ')} } de ${destino}`);
    }
  }

  assert.deepEqual(
    malos, [],
    'esto no falla al importar: falla al USARLO, en runtime y sin nombrar el archivo.\n'
    + 'El valor va a un `.ts` aparte que importen los dos lados (molde: app/onboarding/tabs-catalogo.ts).\n'
    + malos.join('\n'),
  );
});

test('⚠️ y un módulo `server-only` no lo importa nadie desde el navegador', () => {
  // La cara opuesta, que ya está escrita en AGENTS.md y no tenía guard propio: un
  // `'use client'` que importe un VALOR de un módulo con `server-only` rompe el
  // build. Los tipos siguen viajando gratis.
  const todos = archivosDelRepo();
  const set = new Set(todos);
  const cache = new Map<string, string>();
  const src = (f: string) => { if (!cache.has(f)) cache.set(f, leer(f)); return cache.get(f)!; };

  const malos: string[] = [];
  for (const f of todos) {
    const t = src(f);
    if (!esCliente(t)) continue;
    for (const imp of importsDe(t)) {
      const destino = resolver(f, imp.desde, set);
      if (!destino || !esServerOnly(src(destino))) continue;
      if (imp.nombres.length) malos.push(`${f} ← { ${imp.nombres.join(', ')} } de ${destino}`);
    }
  }
  assert.deepEqual(malos, [], 'un componente de cliente importa un valor de un módulo `server-only`:\n' + malos.join('\n'));
});

test('el detector reconoce las dos formas de la directiva y no se come los tipos', () => {
  // ⚠️ Un test sobre un detector se prueba con lo que TIENE que dejar pasar, no solo
  // con lo que tiene que cazar: un detector que marca todo también da «0 fallos»
  // cuando el repo está bien, y es indistinguible de uno que anda.
  assert.ok(esCliente("'use client';\nimport x from 'y';"), 'no reconoce la directiva con comilla simple');
  assert.ok(esCliente('"use client";\n'), 'no reconoce la directiva con comilla doble');
  assert.ok(!esCliente('// dice use client en un comentario\nimport x from "y";'), 'la directiva no puede salir de un comentario');

  const imps = importsDe([
    "import type { Solo } from './a';",
    "import { type Tipo, valor } from './b';",
    "import Comp, { otro as renombrado } from './c';",
    "import * as todo from './d';",
  ].join('\n'));
  assert.deepEqual(imps.map((i) => i.desde), ['./b', './c', './d'], 'el `import type` entero tiene que quedar afuera');
  assert.deepEqual(imps[0].nombres, ['valor'], 'un `{ type Foo }` adentro de las llaves también se borra en compilación');
  assert.deepEqual(imps[1].nombres.sort(), ['Comp', 'otro', 'renombrado'], 'el default y el alias cuentan los dos');
});
