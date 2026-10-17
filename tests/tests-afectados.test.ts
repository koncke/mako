// =============================================================================
// scripts/tests-afectados.mjs — elige los tests que un cambio PUEDE romper
// =============================================================================
// Cada caso de acá es un rojo REAL de un run de Actions que ningún jefe vio porque corrió sólo los
// tests de su área (17/10/2026: runs 80, 82, 85 y 89). El repo falso de abajo tiene la misma FORMA
// que los de verdad: si el selector deja de elegir alguno de esos tests, este archivo se pone rojo.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), con el repo falso de abajo:
//   · `seleccionar` sin la pasada transitiva (BFS que corta en el primer salto) → el caso del run 80 (editor-acciones,
//     a DOS saltos del cambio) y el del run 85 por la barra dejan de salir: 3 aserciones rojas de 24.
//   · `rutasNombradas` sin juntar los trozos del `join(...)` → medios-automatizacion (run 85) no sale: 2 rojas.
//   · `sinComentarios` apagado → `AGENTS.md` citado en un comentario vuelve a seleccionar al test: 1 roja.
//   · `motivoBarredora` sin `ls-files` → la guarda de voseo (run 80) y la de zona (run 82) ya no corren siempre: 2 rojas.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { sinModulo } from '../scripts/modulos-ts.mjs';
import { heapPara } from '../scripts/antes-de-subir.mjs';
import {
  alcanceTsc, clavesDe, especificadores, leerResultado, motivoBarredora, pisoRam, resolver, resolverNombre,
  rutasNombradas, rutasSinExtension, seleccionar, sinComentarios, UMBRAL_NOMBRA_MUCHOS,
} from '../scripts/tests-afectados.mjs';

const existeEn = (...rutas: string[]) => { const s = new Set(rutas); return (r: string) => s.has(r); };

// ---------------------------------------------------------------------------
// Las piezas
// ---------------------------------------------------------------------------

test('sinComentarios borra los comentarios pero deja las cadenas (y las URL) enteras', () => {
  const src = [
    "const url = 'https://x.com/a.ts'; // ver AGENTS.md",
    '/* lib/viejo.ts */ const b = "a//b";',
    'const c = /\\/\\//;',
  ].join('\n');
  const limpio = sinComentarios(src);
  assert.doesNotMatch(limpio, /AGENTS\.md/, 'el comentario de línea se fue');
  assert.doesNotMatch(limpio, /viejo\.ts/, 'el comentario de bloque se fue');
  assert.match(limpio, /https:\/\/x\.com\/a\.ts/, 'la URL de una cadena quedó entera');
  assert.match(limpio, /"a\/\/b"/, 'un // dentro de una cadena no es un comentario');
  assert.match(limpio, /\/\\\/\\\/\//, 'un regex con \\/\\// no se come el resto de la línea');
});

test('especificadores: lo que se importa en tiempo de ejecución, y nada más', () => {
  const src = `
    import a from './a';
    import {
      b,
      c,
    } from '@/lib/b';
    import type { T } from './solo-tipos';
    export type { U } from './tambien-tipos';
    export * from './reexporta';
    export { z } from '../z';
    import './efecto';
    const d = await import('./dinamico');
    const e = require('./cjs');
    const f = new URL('./al-lado.json', import.meta.url);
    export const x = 'no es un import';
  `;
  assert.deepEqual(especificadores(src).sort(), ['./a', './al-lado.json', './cjs', './dinamico', './efecto', './reexporta', '../z', '@/lib/b'].sort());
});

test('resolver: @/, relativas, index, .js → .ts, paquetes y archivos BORRADOS', () => {
  const existe = existeEn('lib/b.ts', 'lib/c/index.tsx', 'app/x/y.ts', 'lib/viejo.ts', 'data/t.json');
  assert.equal(resolver('tests/t.test.ts', '@/lib/b', existe), 'lib/b.ts');
  assert.equal(resolver('tests/t.test.ts', '../lib/b', existe), 'lib/b.ts');
  assert.equal(resolver('lib/a.ts', './c', existe), 'lib/c/index.tsx');
  assert.equal(resolver('app/x/z.ts', './y.js', existe), 'app/x/y.ts', '`./y.js` en un fuente TS apunta a y.ts');
  assert.equal(resolver('lib/a.ts', '../data/t.json', existe), 'data/t.json');
  assert.equal(resolver('lib/a.ts', 'react', existe), null);
  assert.equal(resolver('lib/a.ts', 'node:fs', existe), null);
  assert.equal(resolver('tests/t.test.ts', '../lib/viejo', existe), 'lib/viejo.ts', 'un archivo que el cambio BORRÓ sigue siendo un destino: el que lo importa se rompe');
  assert.equal(resolver('lib/a.ts', './no-existe', existe), null);
});

test('rutasNombradas: junta los trozos del join(), saca ./ y ../, y no cuenta lo que no es ruta', () => {
  const src = `
    leer('app/automations/PanelProbar.tsx');
    readFileSync(join(raiz, 'app', 'admin', 'operaciones', 'nav.ts'));
    leer('../lib/' + 'nutricion.ts');
    const m = 'text/html'; const v = '1.5';
  `;
  const r = rutasNombradas(src);
  assert.ok(r.has('app/automations/PanelProbar.tsx'));
  assert.ok(r.has('app/admin/operaciones/nav.ts'), 'el join() con trozos sueltos nombra la ruta entera (medios-automatizacion, run 85)');
  assert.ok(r.has('lib/nutricion.ts'), 'la concatenación también');
  assert.ok(![...r].some((t) => t.includes('text/html') || t === '1.5'), 'lo que no lleva extensión de código no es una ruta');
});

test('rutasSinExtension + resolverNombre: `leer(\'lib/nutricion\')` apunta a lib/nutricion.ts, y \'text/html\' a nada', () => {
  const src = `leer('lib/nutricion'); fetch('/api/x'); const t = 'text/html'; join(raiz, 'lib', 'flujo');`;
  const sin = rutasSinExtension(src);
  const existe = existeEn('lib/nutricion.ts', 'lib/flujo/index.ts');
  const reales = [...sin].map((t) => resolverNombre(t, existe)).filter(Boolean);
  assert.deepEqual(reales.sort(), ['lib/flujo/index.ts', 'lib/nutricion.ts']);
});

test('clavesDe: la ruta entera, las colas de 2+ segmentos, y el nombre solo sólo si es distintivo', () => {
  const unico = (b: string) => b === 'PanelProbar.tsx' || b === 'nav.ts';
  assert.deepEqual(clavesDe('app/automations/PanelProbar.tsx', unico), ['app/automations/PanelProbar.tsx', 'automations/PanelProbar.tsx', 'PanelProbar.tsx']);
  assert.deepEqual(clavesDe('app/_components/nav.ts', unico), ['app/_components/nav.ts', '_components/nav.ts'], '`nav.ts` mide 6: muy corto para nombrar sólo');
  assert.deepEqual(clavesDe('app/x/page.tsx', () => false), ['app/x/page.tsx', 'x/page.tsx'], '`page.tsx` no es único');
  assert.deepEqual(clavesDe('package.json', () => true), ['package.json'], 'un archivo de la raíz sólo se llama de una manera');
});

test('motivoBarredora: ls-files, readdir, git grep y «nombra muchos» corren siempre; leer un archivo, no', () => {
  assert.equal(motivoBarredora("execFileSync('git', ['ls-files', 'app'])"), 'git ls-files');
  assert.equal(motivoBarredora('for (const n of readdirSync(join(raiz, dir))) {}'), 'recorre carpetas');
  assert.equal(motivoBarredora("execFileSync('git', ['grep', '-n', 'x'])"), 'git grep');
  const muchos = Array.from({ length: UMBRAL_NOMBRA_MUCHOS }, (_, i) => `leer('lib/f${i}.ts');`).join('\n');
  assert.match(motivoBarredora(muchos) ?? '', /^nombra 20 archivos/);
  assert.equal(motivoBarredora("readFileSync('lib/uno.ts', 'utf8')"), null);
  assert.equal(motivoBarredora("import { readdirSync } from 'node:fs'; // sólo importado"), null, 'importar readdirSync sin llamarlo no barre');
});

test('leerResultado: los totales del runner de node y los archivos rojos', () => {
  const salida = [
    '✔ algo (1ms)', '✖ failing tests:', '', 'test at tests\\zona-negocio.test.ts:2:971', '✖ el rojo (2ms)', '  AssertionError',
    'ℹ tests 29', 'ℹ suites 0', 'ℹ pass 28', 'ℹ fail 1', 'ℹ cancelled 0',
  ].join('\n');
  const r = leerResultado(salida);
  assert.deepEqual([r.tests, r.pasan, r.fallan, r.canceladas], [29, 28, 1, 0]);
  assert.deepEqual(r.rojos, ['tests/zona-negocio.test.ts'], 'las barras de Windows se normalizan');
  assert.match(r.detalle, /el rojo/);
});

test('el piso de RAM se DERIVA y sube con la concurrencia (no es un número a ojo)', () => {
  assert.ok(pisoRam(1) > 0.9, 'por debajo de la zona roja del vigía lo matan');
  assert.ok(pisoRam(2) > pisoRam(1));
  assert.ok(pisoRam(2) < 3, 'si pidiera más no correría nunca en esta máquina de 16 GB');
});

// ---------------------------------------------------------------------------
// La selección, sobre un repo falso con la FORMA de los cuatro runs
// ---------------------------------------------------------------------------

const REPO: Record<string, string> = {
  // run 80: la guarda de voseo barre el repo con git ls-files; editor-acciones lee el registro, que importa las áreas
  'tests/guarda-voseo.test.ts': "import { execFileSync } from 'node:child_process';\nexecFileSync('git', ['ls-files', 'app', 'lib']);",
  'tests/editor-acciones.test.ts': "import { REGISTRO } from '../lib/api-mako/registro';\nREGISTRO;",
  'lib/api-mako/registro.ts': "import { chatbot } from './areas/chatbot.def';\nexport const REGISTRO = [chatbot];",
  'lib/api-mako/areas/chatbot.def.ts': "export const chatbot = { opcionales: ['sinGrupo'] };",
  'lib/campanita.ts': 'export const campanita = 1;',
  // run 82: la guarda de zona recorre lib/ con readdir
  'tests/zona-negocio.test.ts': "import { readdirSync } from 'node:fs';\nfor (const n of readdirSync('lib')) { void n; }",
  'lib/lo-que-vendes-pdf.ts': "export const zona = zona || 'America/Mexico_City';",
  // run 85: nombra PanelProbar con un join(), e importa la barra (nav) directo
  'tests/medios-automatizacion.test.ts': "import { readFileSync } from 'node:fs';\nreadFileSync(join(raiz, 'app', 'automations', 'PanelProbar.tsx'), 'utf8');",
  'tests/centro-revisar.test.ts': "import { ADMIN_NAV } from '../app/_components/nav';\nADMIN_NAV;",
  'app/automations/PanelProbar.tsx': 'export const PanelProbar = 1;',
  'app/_components/nav.ts': 'export const ADMIN_NAV = [];',
  // run 89: lee lib/nutricion.ts como TEXTO (sin importarlo), con la extensión o sin ella
  'tests/plazo-etapa-automatizacion.test.ts': "import { readFileSync } from 'node:fs';\nreadFileSync('lib/nutricion.ts', 'utf8');",
  'tests/otro-lee-sin-extension.test.ts': "leer('lib/nutricion');",
  'lib/nutricion.ts': 'export const nutricion = 1;',
  // los que NO tienen que salir
  'tests/sin-relacion.test.ts': "import { x } from '../lib/otra';\nx;",
  'lib/otra.ts': 'export const x = 1;',
  'tests/cita-en-comentario.test.ts': "// ver AGENTS.md → «Si el pre-push da rojo»\nexport {};",
  'AGENTS.md': '# reglas',
  'tests/nombra-a-otro-test.test.ts': "// corre junto a 'tests/centro-revisar.test.ts'\nconst a = 'tests/centro-revisar.test.ts';",
  // un ayudante que un test lanza como proceso hijo: lo que importa el hijo también cuenta
  'tests/usa-hijo.test.ts': "spawnSync('node', ['--import', 'tsx', 'tests/_hijo.ts']);",
  'tests/_hijo.ts': "import { h } from '../lib/del-hijo';\nh;",
  'lib/del-hijo.ts': 'export const h = 1;',
  // un test que importa algo que el cambio BORRÓ
  'tests/importa-lo-borrado.test.ts': "import { v } from '../lib/viejo';\nv;",
};
const leer = (r: string) => REPO[r] ?? null;
const archivos = Object.keys(REPO);
const elegir = (cambiados: string[], hay = archivos) => seleccionar({ cambiados, archivos: hay, leer });
const tiposDe = (r: ReturnType<typeof elegir>, t: string) => (r.tests.get(t) ?? []).map((x: { tipo: string }) => x.tipo);

test('run 80 — la guarda de voseo (git ls-files) corre SIEMPRE, aunque el cambio no la mencione', () => {
  const r = elegir(['lib/campanita.ts']);
  assert.ok(tiposDe(r, 'tests/guarda-voseo.test.ts').includes('barre'), 'barre con git ls-files');
});

test('run 80 — editor-acciones sale por el registro que la punta cambió, a DOS saltos', () => {
  const r = elegir(['lib/api-mako/areas/chatbot.def.ts']);
  assert.ok(tiposDe(r, 'tests/editor-acciones.test.ts').includes('importa'));
  const cadena = r.tests.get('tests/editor-acciones.test.ts')!.find((x: { tipo: string }) => x.tipo === 'importa')!.detalle;
  assert.equal(cadena, 'tests/editor-acciones.test.ts → lib/api-mako/registro.ts → lib/api-mako/areas/chatbot.def.ts');
});

test('run 82 — la guarda de zona (readdir sobre lib/) corre SIEMPRE', () => {
  const r = elegir(['lib/lo-que-vendes-pdf.ts']);
  assert.ok(tiposDe(r, 'tests/zona-negocio.test.ts').includes('barre'));
});

test('run 85 — nombra PanelProbar con un join() de trozos, e importa la barra directo', () => {
  const a = elegir(['app/automations/PanelProbar.tsx']);
  assert.ok(tiposDe(a, 'tests/medios-automatizacion.test.ts').includes('nombra'));
  const b = elegir(['app/_components/nav.ts']);
  assert.ok(tiposDe(b, 'tests/centro-revisar.test.ts').includes('importa'));
});

test('run 89 — un test que LEE lib/nutricion.ts como texto sale aunque no lo importe, con o sin extensión', () => {
  const r = elegir(['lib/nutricion.ts']);
  assert.ok(tiposDe(r, 'tests/plazo-etapa-automatizacion.test.ts').includes('nombra'));
  assert.ok(tiposDe(r, 'tests/otro-lee-sin-extension.test.ts').includes('nombra'), '`leer(\'lib/nutricion\')`, sin .ts');
});

test('lo que NO tiene que salir: un test sin relación, una cita en un comentario, un test que nombra a otro test', () => {
  const r = elegir(['lib/nutricion.ts', 'AGENTS.md', 'app/_components/nav.ts']);
  assert.equal(r.tests.has('tests/sin-relacion.test.ts'), false, 'sin relación (lo único que elige son las barredoras)');
  assert.equal(r.tests.has('tests/cita-en-comentario.test.ts'), false, 'AGENTS.md en un comentario no es leerlo (medido: 167 falsos positivos)');
  assert.equal(r.tests.has('tests/nombra-a-otro-test.test.ts'), false, 'nombrar a otro test no es correrlo');
});

test('un test que lanza un ayudante (tests/_hijo.ts) depende de lo que el hijo importa', () => {
  const r = elegir(['lib/del-hijo.ts']);
  assert.ok(tiposDe(r, 'tests/usa-hijo.test.ts').includes('importa'));
});

test('un archivo BORRADO por el cambio todavía rompe a quien lo importa', () => {
  const sinViejo = archivos.filter((a) => a !== 'lib/viejo.ts');
  const r = elegir(['lib/viejo.ts'], sinViejo);
  assert.ok(tiposDe(r, 'tests/importa-lo-borrado.test.ts').includes('importa'));
});

test('un test que el cambio mismo toca corre, y un archivo que ningún test mira se avisa', () => {
  const r = elegir(['tests/sin-relacion.test.ts', 'lib/campanita.ts', 'AGENTS.md']);
  assert.ok(tiposDe(r, 'tests/sin-relacion.test.ts').includes('cambio'));
  assert.deepEqual(r.sinRed, ['AGENTS.md', 'lib/campanita.ts'], 'los dos cambiados que ningún test importa ni nombra');
});

// ---------------------------------------------------------------------------
// El tipo (scripts/antes-de-subir.mjs) y la guarda de módulos (scripts/modulos-ts.mjs)
// ---------------------------------------------------------------------------

test('alcanceTsc: lo cambiado y quienes lo importan, UN nivel; sin .d.ts, borrados ni lo que no es TS', () => {
  const repo: Record<string, string> = {
    'lib/firma.ts': 'export const f = (a: number) => a;',
    'tests/crm-campo-inline.test.ts': "import { f } from '../lib/firma';\nf(1, 2);",       // una firma que cambió: el test no se tocó
    'lib/consumidor.ts': "import { f } from './firma';\nexport const g = f;",
    'app/dos-saltos.tsx': "import { g } from '../lib/consumidor';\ng;",
    'lib/tipos.d.ts': 'export {};',
    'docs/nota.md': '# nota',
  };
  const r = seleccionar({ cambiados: ['lib/firma.ts', 'lib/tipos.d.ts', 'docs/nota.md', 'lib/borrado.ts'], archivos: Object.keys(repo), leer: (f: string) => repo[f] ?? null });
  assert.deepEqual(alcanceTsc({ cambiados: ['lib/firma.ts', 'lib/tipos.d.ts', 'docs/nota.md', 'lib/borrado.ts'], archivos: Object.keys(repo), importadoPor: r.importadoPor }),
    ['lib/consumidor.ts', 'lib/firma.ts', 'tests/crm-campo-inline.test.ts'],
    'el test que llama a la firma entra aunque no cambió; app/dos-saltos.tsx, a dos saltos, no');
});

test('sinModulo: un .ts sin import ni export es un script global (runs 51 y 52); `export {}` lo arregla', () => {
  const repo: Record<string, string> = {
    'tests/_hijo-malo.ts': "type Fila = Record<string, unknown>;\nconst db: Fila[] = [];",
    'tests/_hijo-bueno.ts': "export {};\ntype Fila = Record<string, unknown>;",
    'tests/_solo-comentario.ts': "// export const x = 1;\ntype Fila = number;",
    'tests/_con-import.ts': "import type { X } from '../lib/x';\nconst y = 1;",
    'lib/tipos.d.ts': 'declare const z: number;',
    'scripts/ai-step-v2.mts': 'console.log(1);',
    'README.md': 'sin export',
  };
  assert.deepEqual(sinModulo(Object.keys(repo), (f: string) => repo[f] ?? null), ['tests/_hijo-malo.ts', 'tests/_solo-comentario.ts']);
});

test('heapPara: el heap del tsc acotado sube con lo que hay que compilar, y nunca pasa del tope de typecheck-lock', () => {
  assert.ok(heapPara(10) <= heapPara(300) && heapPara(300) <= heapPara(900));
  assert.equal(heapPara(900), 5120, '5120 = CAP_HEAP_MB del typecheck completo: más no se le pide a la máquina');
});

test('alcanceTsc suma los archivos que AUMENTAN tipos de la misma carpeta (TipTap: `declare module` en otro archivo), y no los de otra', () => {
  const repo: Record<string, string> = {
    'app/web-generator/editor/insertar.ts': ["import { x } from './otro';", 'x;'].join('\n'),
    'app/web-generator/editor/otro.ts': 'export const x = 1;',
    'app/web-generator/editor/extensiones/marcas.ts': ["declare module '@tiptap/core' { interface Commands<R> { toggleEtiqueta: () => R } }", 'export {};'].join('\n'),
    'app/vsl/Landing.tsx': ['declare global { interface Window { fbq: unknown } }', 'export {};'].join('\n'),
  };
  const archivos = Object.keys(repo);
  const r = seleccionar({ cambiados: ['app/web-generator/editor/insertar.ts'], archivos, leer: (f: string) => repo[f] ?? null });
  assert.deepEqual([...r.aumentan].sort(), ['app/vsl/Landing.tsx', 'app/web-generator/editor/extensiones/marcas.ts']);
  assert.deepEqual(alcanceTsc({ cambiados: ['app/web-generator/editor/insertar.ts'], archivos, importadoPor: r.importadoPor, aumentan: r.aumentan }),
    ['app/web-generator/editor/extensiones/marcas.ts', 'app/web-generator/editor/insertar.ts'], 'la de app/vsl es de otra zona: no se suma');
});
