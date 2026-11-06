// =============================================================================
// El ÍNDICE de hallazgos se une por CELDA: `merge=union` lo duplicaba (scripts/unir-indice-hallazgos.mjs, 6/11/2026)
// =============================================================================
// `docs/hallazgos*.md merge=union` (sin guion) también agarraba `docs/hallazgos.md`, que no es un documento que se le
// agregan secciones: es una TABLA con una fila por área que cada cosecha REESCRIBE metiendo su entrada adelante. Union
// dejaba LAS DOS filas. Medido el 6/11 en main: 199 filas para 69 áreas distintas (130 de más) y 53 documentos en disco.
//
// Lo que fija este archivo, y cada caso CORRE el código (la función pura, y git de verdad con el driver):
//   · dos cosechas en la celda de la MISMA área → quedan las dos entradas, primero la de main;
//   · la misma entrada de los dos lados → queda una vez;
//   · una fila nueva, una borrada o una celda reescrita de punta a punta → NO se toca: el choque de siempre;
//   · las filas byte a byte idénticas se tiran (sólo pueden ser daño de union), también cuando la mezcla salió limpia;
//   · el glob de .gitattributes lleva el guion, y el índice tiene su propio driver;
//   · el paso de punta.yml configura el driver copiándolo de main, y va ANTES de la primera mezcla.
//
// PROBADO ROMPIÉNDOLO (6/11/2026; base 8 / 0). Pasan / fallan:
//   · el orden de la celda invertido (primero la punta)                      → 7 / 1
//   · `prefijoNuevo` devolviendo la celda entera (acepta cualquier cambio)   → 6 / 2
//   · `sinFilasRepetidas` sin filtrar                                        → 6 / 2
//   · el glob de .gitattributes de vuelta en `docs/hallazgos*.md`            → 7 / 1
// Correr: node --import tsx --test tests/unir-indice-hallazgos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filaDelIndice, sinFilasRepetidas, unirPorCelda } from '../scripts/unir-indice-hallazgos.mjs';
import { leerWorkflow } from './_workflow';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠️ Con barras normales: `git config` trata la barra invertida como escape, así que `C:\dev\…` se guarda como `C:dev…`
// y el driver no se encuentra («Cannot find module …devwt-infra…»). En Windows, un valor de config con una ruta va así.
const DRIVER = join(RAIZ, 'scripts', 'unir-indice-hallazgos.mjs').replace(/\\/g, '/');
const RUTA = 'docs/hallazgos.md';
const hayGit = !spawnSync('git', ['--version']).error;
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

/** Un índice con dos áreas. `infra` y `crm` son el contenido de la celda «Qué cubre». */
const indice = (infra: string, crm: string) => [
  '# Hallazgos — índice',
  '',
  '| Área | Documento | Qué cubre |',
  '|---|---|---|',
  `| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | ${infra} |`,
  `| CRM | [hallazgos-crm.md](hallazgos-crm.md) | ${crm} |`,
  '',
].join('\n');

const BASE = indice('**Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');

test('una fila del índice se reconoce por sus dos primeras celdas; una línea cualquiera no', () => {
  const f = filaDelIndice('| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | lo que cubre |');
  assert.equal(f?.clave, 'Infraestructura|[hallazgos-infra.md](hallazgos-infra.md)');
  assert.equal(f?.celda, ' lo que cubre ');
  assert.equal(filaDelIndice('|---|---|---|'), null, 'el separador no es una fila');
  assert.equal(filaDelIndice('| Área | Documento | Qué cubre |'), null, 'el encabezado tampoco');
  assert.equal(filaDelIndice('texto suelto'), null);
  // La segunda celda tiene que ser el link a un documento de hallazgos: otra tabla del mismo archivo no se toca.
  assert.equal(filaDelIndice('| Mauricio | [reuniones.md](reuniones.md) | de dónde salió |'), null);
});

test('dos cosechas en la celda de la misma área: quedan las dos, primero la de main', () => {
  const ours = indice('**De la punta**: lo nuevo. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');
  const theirs = indice('**De main**: lo otro. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');
  const r = unirPorCelda(BASE, ours, theirs);
  assert.ok(r, 'tendría que unirse');
  const celda = r!.split('\n').find((l) => l.includes('hallazgos-infra'))!;
  assert.match(celda, /\*\*De main\*\*: lo otro\. \*\*De la punta\*\*: lo nuevo\. \*\*Lo viejo de infra\*\*: ya estaba\./);
  assert.equal(r!.split('\n').filter((l) => l.includes('hallazgos-infra')).length, 1, 'UNA fila, no dos');
  assert.ok(r!.includes('**Lo viejo del CRM**'), 'la fila que nadie tocó queda igual');
});

test('cada lado cosecha en SU área: las dos filas quedan con su entrada', () => {
  const ours = indice('**De la punta**: lo nuevo. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');
  const theirs = indice('**Lo viejo de infra**: ya estaba.', '**Del CRM**: otra cosa. **Lo viejo del CRM**: ya estaba.');
  const r = unirPorCelda(BASE, ours, theirs);
  assert.ok(r);
  assert.match(r!, /\*\*De la punta\*\*: lo nuevo\./);
  assert.match(r!, /\*\*Del CRM\*\*: otra cosa\./);
});

test('la misma entrada de los dos lados queda una vez', () => {
  const x = indice('**Lo mismo**: igual. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');
  const r = unirPorCelda(BASE, x, x);
  assert.ok(r);
  assert.equal((r!.match(/\*\*Lo mismo\*\*/g) ?? []).length, 1);
});

test('lo que NO se entiende queda como choque: una fila nueva, una borrada, o una celda reescrita', () => {
  // Una celda reescrita de punta a punta (lo viejo no quedó adentro): no se adivina.
  const reescrita = indice('**Otra cosa entera**.', '**Lo viejo del CRM**: ya estaba.');
  const conPrefijo = indice('**De main**: lo otro. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.');
  assert.equal(unirPorCelda(BASE, reescrita, conPrefijo), null);
  // Una fila de más en un lado: cambia el esqueleto.
  const conFilaNueva = `${indice('**Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.').trimEnd()}\n| Plan | [hallazgos-plan.md](hallazgos-plan.md) | nueva |\n`;
  assert.equal(unirPorCelda(BASE, conFilaNueva, conPrefijo), null);
  // Una fila borrada.
  const sinCrm = BASE.split('\n').filter((l) => !l.includes('hallazgos-crm')).join('\n');
  assert.equal(unirPorCelda(BASE, sinCrm, conPrefijo), null);
});

test('las filas byte a byte idénticas se tiran: sólo pueden ser daño de union', () => {
  const fila = '| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | lo mismo |';
  const { lineas, sacadas } = sinFilasRepetidas(['# x', fila, fila, fila, '| CRM | [hallazgos-crm.md](hallazgos-crm.md) | otra |']);
  assert.equal(sacadas, 2);
  assert.equal(lineas.filter((l) => l === fila).length, 1);
  // Una línea repetida que NO es fila del índice no se toca (un separador, una línea en blanco).
  assert.equal(sinFilasRepetidas(['|---|---|---|', '|---|---|---|']).sacadas, 0);
});

test('.gitattributes: el glob de los documentos lleva el guion, y el índice tiene su propio driver', () => {
  const attrs = leer('.gitattributes');
  assert.match(attrs, /^docs\/hallazgos-\*\.md merge=union$/m, 'los documentos por área, por líneas');
  assert.match(attrs, /^docs\/hallazgos\.md merge=indice-hallazgos$/m, 'el índice, por celda');
  assert.doesNotMatch(attrs, /^docs\/hallazgos\*\.md merge=union$/m, 'volvió el glob sin guion, que duplica el índice');
  // El orden importa: en .gitattributes gana la última regla que coincide.
  assert.ok(attrs.indexOf('docs/hallazgos-*.md merge=union') < attrs.indexOf('docs/hallazgos.md merge=indice-hallazgos'),
    'la regla del índice va DESPUÉS de la de los documentos, o union se la gana');
});

function repoConChoque(punta: string, main: string) {
  const dir = mkdtempSync(join(tmpdir(), 'unir-indice-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_NOSYSTEM: '1', HOME: dir };
  const g = (...a: string[]) => spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
  const escribir = (s: string) => { mkdirSync(join(dir, dirname(RUTA)), { recursive: true }); writeFileSync(join(dir, RUTA), s); };
  g('init', '-q', '-b', 'main');
  g('config', 'core.autocrlf', 'false');
  escribir(BASE); g('add', '.'); g('commit', '-qm', 'base');
  g('checkout', '-qb', 'punta'); escribir(punta); g('commit', '-qam', 'punta');
  g('checkout', '-q', 'main'); escribir(main); g('commit', '-qam', 'main');
  g('checkout', '-q', 'punta');
  mkdirSync(join(dir, '.git', 'info'), { recursive: true });
  writeFileSync(join(dir, '.git', 'info', 'attributes'), 'docs/hallazgos.md merge=indice-hallazgos\n');
  return { dir, g, leer: () => readFileSync(join(dir, RUTA), 'utf8') };
}

test('git con el driver: dos cosechas en la misma celda se mezclan limpio', { skip: !hayGit && 'sin git' }, () => {
  const r = repoConChoque(
    indice('**De la punta**: lo nuevo. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.'),
    indice('**De main**: lo otro. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.'),
  );
  r.g('config', 'merge.indice-hallazgos.driver', `node ${DRIVER} %O %A %B %P`);
  const m = r.g('merge', '--no-edit', 'main');
  assert.equal(m.status, 0, `la mezcla salió limpia: ${m.stdout}${m.stderr}`);
  const txt = r.leer();
  assert.equal(txt.split('\n').filter((l) => l.includes('hallazgos-infra')).length, 1, 'UNA fila de infra');
  assert.match(txt, /\*\*De main\*\*: lo otro\. \*\*De la punta\*\*: lo nuevo\./);

  // ⚠️ Y SIN el driver configurado (una PC sin `git config`), el atributo nombra un driver que no existe y git cae al suyo:
  // acá eso es un CHOQUE, que es lo correcto — mejor un choque que una fila duplicada en silencio.
  const s = repoConChoque(
    indice('**De la punta**: lo nuevo. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.'),
    indice('**De main**: lo otro. **Lo viejo de infra**: ya estaba.', '**Lo viejo del CRM**: ya estaba.'),
  );
  assert.notEqual(s.g('merge', '--no-edit', 'main').status, 0, 'sin el driver, choca');
});

test('punta.yml configura el driver del índice, copiándolo de main, antes de la primera mezcla', () => {
  const yml = leerWorkflow(RAIZ, 'punta.yml');
  assert.match(yml, /git config merge\.indice-hallazgos\.driver "node \$indice %O %A %B %P"/);
  assert.match(yml, /git show origin\/main:scripts\/unir-indice-hallazgos\.mjs > "\$indice"/, 'se copia de MAIN: una punta vieja no lo tiene');
  assert.match(yml, /echo 'docs\/hallazgos\.md merge=indice-hallazgos' >> "\$attrs"/);
  // El atributo del índice se agrega DESPUÉS de copiar las reglas de main, o `union` se lo gana (gana la última regla).
  assert.ok(yml.indexOf('git show origin/main:.gitattributes') < yml.indexOf("echo 'docs/hallazgos.md merge=indice-hallazgos'"));
  // Y el paso entero va antes de la primera mezcla.
  assert.ok(yml.indexOf('Las bitácoras se unen solas al mezclar') < yml.indexOf('MEZCLAR EL MAIN DE ESTE MOMENTO'));
});
