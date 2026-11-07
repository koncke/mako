// =============================================================================
// Un choque en una bitácora que es sólo «los dos agregaron un hito al final» se resuelve solo (scripts/unir-bitacora.mjs)
// =============================================================================
// Lo que fija este archivo, y cada caso CORRE el código (la función pura, y git de verdad con el driver):
//   · dos lados que agregan un hito distinto en el mismo lugar → los dos, separados, primero el de main, y el archivo
//     sigue siendo TypeScript válido con un elemento más por lado (lo que `merge=union` rompía: un objeto con dos mitades);
//   · el mismo hito agregado en los dos lados → queda una vez;
//   · editar un hito que ya estaba, borrar uno o agregar en lugares distintos → NO se toca: es el choque de siempre;
//   · git con el atributo y el driver mezcla limpio; con el atributo y SIN el driver, choca como siempre (la PC sin config);
//   · el paso de punta.yml configura el driver copiándolo de main, y va ANTES de la primera mezcla.
// Probado rompiéndolo (4/11/2026):
//   · `a.en !== b.en` sacado → cae «en lugares distintos»;
//   · el orden de `medio` invertido → cae «primero el de main»;
//   · `sonElementosCompletos` contestando siempre true → caen «un bloque que no cierra» y «el objeto partido».
// Probado rompiéndolo (7/11/2026, en Windows; en Linux nada de esto cae):
//   · el `.replace(/\\/g, '/')` de DRIVER sacado → caen los tres casos de «git con el driver»;
//   · el `sh()` del entorno de correrPaso (_workflow.ts) sacado → cae el del paso de punta.yml;
//   · MSYS_NO_PATHCONV sacado de ese entorno → cae el del paso también, pero por el `git show origin/main:…`.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { unirAgregados, insercion, sonElementosCompletos } from '../scripts/unir-bitacora.mjs';
import { correrPaso, leerWorkflow } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ Barras normales, no las de Windows: el valor va a un `git config`, que lee la barra invertida como escape y la
// borra — `C:\dev\…\scripts\unir-bitacora.mjs` se guarda `C:dev…scriptsunir-bitacora.mjs` y el driver no existe
// («Cannot find module»): rojo en TODA PC con Windows, verde en el CI porque es Linux. Vale para TODA ruta en un config.
const DRIVER = join(RAIZ, 'scripts', 'unir-bitacora.mjs').replace(/\\/g, '/');
const hayGit = !spawnSync('git', ['--version']).error;

const hito = (titulo: string, extra = '') => [
  '  {',
  `    fecha: '4 nov', hora: '08:00', chat: 'Infra', cuenta: 'nube',`,
  `    actor: 'claude', tipo: 'implementacion',`,
  `    titulo: '${titulo}',`,
  `    puntos: ['Un punto con {llaves} y una coma, adentro de la cadena.'${extra}],`,
  '  },',
].join('\n');

const archivo = (...hitos: string[]) => [
  "import type { Hito } from '../_registro/tipos';",
  '',
  'export const HITOS: Hito[] = [',
  ...hitos,
  '];',
  '',
  '// el registro del área',
  '',
].join('\n');

/** Los títulos de los elementos del array, leídos con el parser de TypeScript; tira si el archivo no parsea. */
function titulosDe(src: string): string[] {
  const sf = ts.createSourceFile('bitacora.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diag = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
  assert.equal(diag.length, 0, `el resultado no es TypeScript válido: ${diag.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' · ')}`);
  const titulos: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isArrayLiteralExpression(n)) {
      for (const el of n.elements) {
        assert.ok(ts.isObjectLiteralExpression(el), 'cada elemento del array es un objeto');
        const t = el.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'titulo') as ts.PropertyAssignment | undefined;
        titulos.push(t && ts.isStringLiteral(t.initializer) ? t.initializer.text : '(sin título)');
      }
      return;
    }
    ts.forEachChild(n, visitar);
  };
  const decl = sf.statements.find(ts.isVariableStatement);
  assert.ok(decl, 'el archivo declara el array');
  visitar(decl);
  return titulos;
}

const BASE = archivo(hito('Uno'), hito('Dos'));

test('dos hitos distintos al final: quedan los dos, separados, primero el de main, y el archivo parsea', () => {
  const punta = archivo(hito('Uno'), hito('Dos'), hito('De la punta'));
  const main = archivo(hito('Uno'), hito('Dos'), hito('De main'));
  const r = unirAgregados(BASE, punta, main);
  assert.ok(r != null, 'es el caso de los dos hitos al final');
  assert.deepEqual(titulosDe(r), ['Uno', 'Dos', 'De main', 'De la punta'], 'primero el de main (lo que ya llegó), después el de la punta');
  assert.ok(r.endsWith('// el registro del área\n'), 'lo que viene después del array queda igual');
});

test('cada lado puede agregar VARIOS hitos, y el mismo hito en los dos lados queda una vez', () => {
  const punta = archivo(hito('Uno'), hito('Dos'), hito('P1'), hito('P2'));
  const main = archivo(hito('Uno'), hito('Dos'), hito('M1'));
  assert.deepEqual(titulosDe(unirAgregados(BASE, punta, main)!), ['Uno', 'Dos', 'M1', 'P1', 'P2']);
  const igual = archivo(hito('Uno'), hito('Dos'), hito('Igual'));
  assert.deepEqual(titulosDe(unirAgregados(BASE, igual, igual)!), ['Uno', 'Dos', 'Igual'], 'el mismo hito no se duplica');
});

test('lo que NO es «agregar un hito» no se toca: editar, borrar, lugares distintos, un bloque que no cierra', () => {
  const editado = archivo(hito('Uno'), hito('Dos, corregido'), hito('De la punta'));
  const main = archivo(hito('Uno'), hito('Dos'), hito('De main'));
  assert.equal(unirAgregados(BASE, editado, main), null, 'la punta editó un hito que ya estaba');
  assert.equal(unirAgregados(BASE, archivo(hito('Uno')), main), null, 'la punta borró uno');
  const alPrincipio = archivo(hito('Primero'), hito('Uno'), hito('Dos'));
  assert.equal(unirAgregados(BASE, alPrincipio, main), null, 'al principio: el bloque queda partido');
  // Dos arrays en el archivo, cada lado agrega un hito ENTERO al final de uno distinto: sólo lo frena comparar dónde entró
  // cada bloque (sin esa comparación, el hito de main se mudaba al primer array).
  const dos = (a: string[], b: string[]) => [archivo(...a), 'export const OTROS: Hito[] = [', ...b, '];', ''].join('\n');
  const base2 = dos([hito('Uno')], [hito('Otro')]);
  assert.equal(unirAgregados(base2, dos([hito('Uno'), hito('P')], [hito('Otro')]), dos([hito('Uno')], [hito('Otro'), hito('M')])), null, 'en lugares distintos');
  const sinCerrar = archivo(hito('Uno'), hito('Dos'), '  {', "    titulo: 'a medias',");
  assert.equal(unirAgregados(BASE, sinCerrar, main), null, 'un bloque que no cierra');
  assert.equal(unirAgregados(BASE, BASE, main), null, 'un lado que no agregó nada no es este choque');
});

test('sonElementosCompletos: cuenta afuera de las cadenas y pide elementos enteros, con su coma', () => {
  assert.equal(sonElementosCompletos(hito('a').split('\n')), true);
  assert.equal(sonElementosCompletos([...hito('a').split('\n'), ...hito('b').split('\n')]), true, 'dos seguidos');
  assert.equal(sonElementosCompletos(['  {', "    titulo: 'una } suelta en la cadena',", '  },']), true, 'la llave de la cadena no cuenta');
  assert.equal(sonElementosCompletos(['  {', "    titulo: 'x',", '  }']), false, 'sin la coma del final');
  assert.equal(sonElementosCompletos(["    titulo: 'x',", '  },', '  {', "    titulo: 'y',"]), false, 'el final de uno y el principio de otro: el objeto partido de merge=union');
  assert.equal(sonElementosCompletos(["  'una cadena suelta',"]), false);
  assert.equal(sonElementosCompletos([]), false);
});

test('insercion: dónde entró el bloque, aunque sus renglones se repitan en la base', () => {
  const B = BASE.split('\n');
  const r = insercion(B, archivo(hito('Uno'), hito('Dos'), hito('Tres')).split('\n'));
  assert.ok(r);
  assert.equal(B[r.en], '];', 'entra justo antes del cierre del array');
  assert.equal(r.bloque.join('\n'), hito('Tres'));
});

// ── git de verdad ──────────────────────────────────────────────────────────────────────────────────────────

const RUTA = 'app/admin/dev/infra/bitacora.ts';

/** Un repo con la bitácora base en main y una rama `punta`; cada lado escribe su versión y commitea. */
function repoConChoque(punta: string, main: string) {
  const dir = mkdtempSync(join(tmpdir(), 'unir-bitacora-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_NOSYSTEM: '1', HOME: dir };
  const g = (...a: string[]) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  const escribir = (s: string) => { mkdirSync(join(dir, dirname(RUTA)), { recursive: true }); writeFileSync(join(dir, RUTA), s); };
  g('init', '-q', '-b', 'main');
  g('config', 'core.autocrlf', 'false');
  escribir(BASE); g('add', '.'); g('commit', '-qm', 'base');
  g('checkout', '-qb', 'punta'); escribir(punta); g('commit', '-qam', 'punta');
  g('checkout', '-q', 'main'); escribir(main); g('commit', '-qam', 'main');
  g('checkout', '-q', 'punta');
  return { dir, g, leer: () => readFileSync(join(dir, RUTA), 'utf8') };
}

function conDriver(r: ReturnType<typeof repoConChoque>) {
  r.g('config', 'merge.bitacora.driver', `node ${DRIVER} %O %A %B %P`);
  mkdirSync(join(r.dir, '.git', 'info'), { recursive: true });
  writeFileSync(join(r.dir, '.git', 'info', 'attributes'), 'app/admin/dev/*/bitacora.ts merge=bitacora\n');
}

test('git con el driver: dos hitos al final se mezclan limpio y quedan los dos', { skip: !hayGit && 'sin git' }, () => {
  const r = repoConChoque(archivo(hito('Uno'), hito('Dos'), hito('De la punta')), archivo(hito('Uno'), hito('Dos'), hito('De main')));
  conDriver(r);
  const m = r.g('merge', '--no-edit', 'main');
  assert.equal(m.status, 0, `la mezcla salió limpia: ${m.stdout}${m.stderr}`);
  assert.deepEqual(titulosDe(r.leer()), ['Uno', 'Dos', 'De main', 'De la punta']);
  assert.match(m.stderr, /quedan los dos/, 'el log dice qué hizo');
});

test('git con el driver: editar el mismo hito sigue siendo un choque, con sus marcas', { skip: !hayGit && 'sin git' }, () => {
  const r = repoConChoque(archivo(hito('Uno'), hito('Dos según la punta')), archivo(hito('Uno'), hito('Dos según main')));
  conDriver(r);
  const m = r.g('merge', '--no-edit', 'main');
  assert.notEqual(m.status, 0, 'un choque de verdad no se resuelve solo');
  assert.match(r.leer(), /<<<<<<< la punta[\s\S]*=======[\s\S]*>>>>>>> main/, 'quedan las marcas de siempre');
});

test('git con el atributo y SIN el driver configurado: choca como siempre (la PC que no lo configuró)', { skip: !hayGit && 'sin git' }, () => {
  const r = repoConChoque(archivo(hito('Uno'), hito('Dos'), hito('De la punta')), archivo(hito('Uno'), hito('Dos'), hito('De main')));
  mkdirSync(join(r.dir, '.git', 'info'), { recursive: true });
  writeFileSync(join(r.dir, '.git', 'info', 'attributes'), 'app/admin/dev/*/bitacora.ts merge=bitacora\n');
  const m = r.g('merge', '--no-edit', 'main');
  assert.notEqual(m.status, 0, 'sin el driver, git usa su mezcla de texto');
  assert.match(r.leer(), /<<<<<<</);
});

test('git con el driver: un cambio que git ya mezcla limpio sale igual que sin el driver', { skip: !hayGit && 'sin git' }, () => {
  const r = repoConChoque(archivo(hito('Uno, corregido'), hito('Dos')), archivo(hito('Uno'), hito('Dos'), hito('De main')));
  conDriver(r);
  const m = r.g('merge', '--no-edit', 'main');
  assert.equal(m.status, 0, `${m.stdout}${m.stderr}`);
  assert.deepEqual(titulosDe(r.leer()), ['Uno, corregido', 'Dos', 'De main']);
  assert.doesNotMatch(m.stderr, /quedan los dos/, 'no hizo falta el caso especial');
});

// ── punta.yml ────────────────────────────────────────────────────────────────────────────────────────────

test('punta.yml configura el driver copiándolo de main, ANTES de la primera mezcla, y la mezcla queda limpia', { skip: !hayGit && 'sin git' }, () => {
  const yml = leerWorkflow(RAIZ, 'punta.yml');
  const paso = yml.indexOf('- name: Las bitácoras se unen solas al mezclar');
  const mezcla = yml.indexOf('- name: Mezclar main en la punta');
  assert.ok(paso > 0 && mezcla > 0, 'los dos pasos existen');
  assert.ok(paso < mezcla, 'el driver se configura antes de mezclar');

  // Un clon donde la punta NO tiene el script ni las reglas de mezcla y main sí: el paso los toma de origin/main.
  const r = repoConChoque(archivo(hito('Uno'), hito('Dos'), hito('De la punta')), archivo(hito('Uno'), hito('Dos'), hito('De main')));
  const indice = (...l: string[]) => ['# Hallazgos', '', ...l, ''].join('\n');
  r.g('checkout', '-q', 'main');
  mkdirSync(join(r.dir, 'scripts'), { recursive: true });
  writeFileSync(join(r.dir, 'scripts', 'unir-bitacora.mjs'), readFileSync(DRIVER, 'utf8'));
  mkdirSync(join(r.dir, 'docs'), { recursive: true });
  writeFileSync(join(r.dir, 'docs', 'hallazgos.md'), indice('- uno'));
  r.g('add', 'scripts', 'docs'); r.g('commit', '-qm', 'el driver y el índice en main');
  r.g('checkout', '-q', 'punta'); r.g('merge', '-q', '--no-edit', '-X', 'theirs', 'main'); // la punta ya tenía el índice
  writeFileSync(join(r.dir, 'docs', 'hallazgos.md'), indice('- uno', '- de la punta')); r.g('commit', '-qam', 'la punta suma una fila');
  r.g('checkout', '-q', 'main');
  writeFileSync(join(r.dir, 'docs', 'hallazgos.md'), indice('- uno', '- de main'));
  writeFileSync(join(r.dir, '.gitattributes'), 'docs/hallazgos*.md merge=union\n');
  writeFileSync(join(r.dir, RUTA), archivo(hito('Uno'), hito('Dos'), hito('De main'), hito('Más de main')));
  r.g('add', '.'); r.g('commit', '-qm', 'main suma su fila, la regla de mezcla y otro hito');
  r.g('update-ref', 'refs/remotes/origin/main', 'main');
  r.g('checkout', '-q', 'punta');
  writeFileSync(join(r.dir, RUTA), archivo(hito('Uno'), hito('Dos'), hito('De main'), hito('Más de la punta'))); r.g('commit', '-qam', 'otro hito de la punta');
  const p = correrPaso(yml, 'Las bitácoras se unen solas al mezclar', { cwd: r.dir, env: { GIT_CONFIG_NOSYSTEM: '1' } });
  assert.equal(p.codigo, 0, p.salida);
  const m = r.g('merge', '--no-edit', 'origin/main');
  assert.equal(m.status, 0, `con el driver y las reglas de main, la punta vieja mezcla limpio: ${m.stdout}${m.stderr}`);
  assert.deepEqual(titulosDe(r.leer()), ['Uno', 'Dos', 'De main', 'Más de main', 'Más de la punta']);
  assert.match(readFileSync(join(r.dir, 'docs', 'hallazgos.md'), 'utf8'), /- de la punta[\s\S]*- de main|- de main[\s\S]*- de la punta/, 'el índice se unió con la regla de main');
});

test('.gitattributes nombra el driver para las bitácoras, y dice cómo configurarlo en la PC', () => {
  const ga = readFileSync(join(RAIZ, '.gitattributes'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ga, /^app\/admin\/dev\/\*\/bitacora\.ts merge=bitacora$/m);
  assert.match(ga, /git config merge\.bitacora\.driver "node scripts\/unir-bitacora\.mjs %O %A %B %P"/);
});
