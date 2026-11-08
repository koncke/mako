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
//   · y las que NO son idénticas se unen por entrada, porque una punta cortada antes del 6/11 trae las filas viejas y
//     git las devuelve al mezclar main (un lado borró, el otro conservó): tirarlas por clave perdería su cosecha;
//   · y si las dos TABLAS son distintas (main junta, la punta trae la vieja) se mezcla por ÁREA, no por renglón;
//   · el índice EN DISCO: una fila por área, tres columnas, ningún link muerto, la tabla sin cortar;
//   · el glob de .gitattributes lleva el guion, y el índice tiene su propio driver;
//   · el paso de punta.yml configura el driver copiándolo de main, y va ANTES de la primera mezcla.
//
// PROBADO ROMPIÉNDOLO (6/11/2026; base 8 / 0). Pasan / fallan:
//   · el orden de la celda invertido (primero la punta)                      → 7 / 1
//   · `prefijoNuevo` devolviendo la celda entera (acepta cualquier cambio)   → 6 / 2
//   · `sinFilasRepetidas` sin filtrar                                        → 6 / 2
//   · el glob de .gitattributes de vuelta en `docs/hallazgos*.md`            → 7 / 1
//
// Y la mezcla por ÁREA, de la misma noche (base 14 / 0). Pasan / fallan:
//   · `filaDeLaTabla` pidiendo el link de `hallazgos-*.md` otra vez          → 13 / 1
//   · las áreas que sólo tiene la punta, tiradas                             → 13 / 1
//   · el `|` del texto sin escapar a la salida                               → 13 / 1
//   · `unirPorFilas` apagado (vuelve a ser «resolvelo a mano»)                → 13 / 1
//   · la línea en blanco de la tabla vuelve a cortar el tramo                → 13 / 1
//   ⚠️ La red de `unirCeldas` (si una entrada no sobrevive textual, no se junta) NO la mueve ningún test: con el corte
//   en `**Título (fecha)**:` cada entrada se emite entera, así que no se la pudo hacer fallar. Queda como seguro de un
//   cambio futuro del corte, no como algo probado.
// Correr: node --import tsx --test tests/unir-indice-hallazgos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entradasDeCelda, filaDelIndice, sinFilasRepetidas, unaFilaPorClave, unirCeldas, unirPorCelda, unirPorFilas } from '../scripts/unir-indice-hallazgos.mjs';
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

// ── Juntar DOS FILAS de la misma área que NO son idénticas ──────────────────────────────────────────────────────────
// Desde que main tiene UNA fila por área, una punta cortada antes trae las viejas y git las DEVUELVE al mezclar
// (un lado borró, el otro conservó). Tirarlas por clave perdería la cosecha propia de la punta: se unen por entrada.
test('el límite de una entrada es la negrita con DOS PUNTOS, no cualquier negrita', () => {
  const e = entradasDeCelda('**Uno (6/11)**: con **99** adentro, que es un énfasis. **Dos (5/11)**: lo otro.');
  assert.equal(e.length, 2, `«**99**» no abre entrada: cortar ahí parte la oración (dio ${e.length})`);
  assert.match(e[0], /^\*\*Uno \(6\/11\)\*\*: con \*\*99\*\* adentro/);
  assert.match(e[1], /^\*\*Dos \(5\/11\)\*\*/);
  // la prosa de antes de la primera entrada no se pierde
  assert.deepEqual(entradasDeCelda('lo de siempre. **Uno (6/11)**: x'), ['lo de siempre.', '**Uno (6/11)**: x']);
});

test('dos filas de la misma área se unen por entrada, lo más nuevo adelante y sin repetir', () => {
  // la de main tiene la entrada del 6/11; la de la punta, la del 4/11. Las dos comparten la del 5/11.
  const unido = unirCeldas([
    '**Seis (6/11)**: a. **Cinco (5/11)**: b.',
    '**Cinco (5/11)**: b. **Cuatro (4/11)**: c.',
  ]);
  assert.equal(unido, '**Seis (6/11)**: a. **Cinco (5/11)**: b. **Cuatro (4/11)**: c.');

  // una celda CONTENIDA en otra no aporta nada: queda la larga
  assert.equal(unirCeldas(['**Seis (6/11)**: a. **Cinco (5/11)**: b.', '**Cinco (5/11)**: b.']),
    '**Seis (6/11)**: a. **Cinco (5/11)**: b.');

  // y una entrada que la celda ya traía DOS VECES queda una sola (daño viejo de las cosechas sobre una fila duplicada)
  const larga = `**Una entrada bien larga para que pase el piso de los cuarenta caracteres (6/11)**: el cuerpo.`;
  assert.equal(unirCeldas([`${larga} ${larga}`]), larga);
});

test('⚠️ si una entrada no sobrevive textual, NO se junta: quedan las dos filas y lo mira una persona', () => {
  // unirCeldas devuelve null cuando no puede verificarse; unaFilaPorClave entonces deja las filas como estaban.
  const sinTitulos = ['prosa sin ninguna entrada', 'otra prosa distinta sin ninguna entrada'];
  const unido = unirCeldas(sinTitulos);
  if (unido != null) for (const c of sinTitulos) assert.ok(unido.includes(c), `se perdió «${c}»`);

  const dos = [
    '| Área | Documento | Qué cubre |', '|---|---|---|',
    '| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | **A (6/11)**: x. |',
    '| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | **B (5/11)**: y. |',
  ];
  // el script es un .mjs sin tipos, así que lo que devuelve llega como `any`: los parámetros se anotan a mano o es TS7006
  const r: { lineas: string[]; juntadas: number } = unaFilaPorClave(dos);
  assert.equal(r.juntadas, 1, 'las dos filas de infra quedan en una');
  assert.equal(r.lineas.filter((l: string) => filaDelIndice(l)).length, 1);
  assert.match(r.lineas.find((l: string) => filaDelIndice(l))!, /\*\*A \(6\/11\)\*\*: x\. \*\*B \(5\/11\)\*\*: y\./);
  // la fila queda DONDE ESTABA la primera, para no revolver el orden de la tabla
  assert.equal(r.lineas.indexOf(r.lineas.find((l: string) => filaDelIndice(l))!), 2);
});

// ── El choque de verdad: main tiene la tabla JUNTA y la punta la vieja ──────────────────────────────────────────────
test('tablas distintas: se mezcla por ÁREA, no por renglón', () => {
  // main junta las dos filas de infra en una y cosecha; la punta sigue teniendo las dos y cosechó en la suya.
  const tabla = (...filas: string[]) => ['# x', '', '| Área | Documento | Qué cubre |', '|---|---|---|', ...filas, '', 'prosa de abajo', ''].join('\n');
  const infra = (c: string) => `| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | ${c} |`;
  const otra = `| Mauricio | [recorrido-visual-30-10.md](recorrido-visual-30-10.md) | lo que cubre |`;
  // ⚠️ la fila que manda a otro documento va EN EL MEDIO, como en el índice de verdad, y DETRÁS de ella un área que
  // sólo tiene la punta: si el lector de filas no ve la del medio, el tramo parece cortado ahí y lo de atrás —el área
  // nueva de la punta— se va con «lo de después de la tabla», que lo resuelve el otro lado. Se pierde sin ruido.
  const nueva = `| Nueva | [hallazgos-nueva.md](hallazgos-nueva.md) | **N (6/11)**: sólo la trae la punta. |`;
  const base = tabla(infra('**Vieja (1/11)**: a.'), otra, infra('**Otra vieja (2/11)**: b.'));
  // y la punta vieja trae la LÍNEA EN BLANCO en medio de la tabla, que es otro pedazo del daño de `union`
  const ours = tabla(infra('**De la punta (6/11)**: nuevo. **Vieja (1/11)**: a.'), otra, '', infra('**Otra vieja (2/11)**: b.'), nueva);
  const theirs = tabla(infra('**De main (6/11)**: otro. **Vieja (1/11)**: a. **Otra vieja (2/11)**: b.'), otra);

  const unido = unirPorFilas(base, ours, theirs);
  assert.ok(unido, 'el choque «la tabla entera contra la tabla entera» se resuelve: es por área');
  const deInfra = unido!.split('\n').filter((l) => filaDelIndice(l)?.clave.startsWith('Infraestructura|'));
  assert.equal(deInfra.length, 1, `UNA fila de infra (quedaron ${deInfra.length})`);
  for (const t of ['**De main (6/11)**', '**De la punta (6/11)**', '**Vieja (1/11)**', '**Otra vieja (2/11)**']) {
    assert.ok(unido!.includes(t), `se perdió ${t}`);
  }
  // ⚠️ la fila que NO apunta a hallazgos-*.md también viaja, y el área que sólo tiene la punta no se tira
  assert.ok(unido!.includes('recorrido-visual-30-10.md'), 'la fila que manda a otro documento sigue en la tabla');
  assert.ok(unido!.includes('hallazgos-nueva.md'), 'el área que sólo tiene la punta sigue, detrás de las de main');
  assert.ok(unido!.includes('prosa de abajo'), 'lo de después de la tabla sigue');
  // y la tabla queda de una pieza: entre sus filas no se cuela una línea en blanco ni prosa
  const tramo = unido!.split('\n');
  const ini = tramo.findIndex((l) => /^\|\s*-+\s*\|/.test(l));
  const fin = tramo.length - 1 - [...tramo].reverse().findIndex((l) => l.startsWith('|'));
  assert.deepEqual(tramo.slice(ini + 1, fin + 1).filter((l) => !l.startsWith('|')), [], 'la tabla no quedó cortada');

  // y el `|` del texto queda escapado aunque un lado lo trajera pelado (si no, la fila se parte en markdown)
  const conPipe = unirPorFilas(base, tabla(infra('**P (6/11)**: un number | null. **Vieja (1/11)**: a.'), otra, infra('**Otra vieja (2/11)**: b.')), theirs);
  assert.ok(conPipe?.includes('number \\| null'), 'el | del texto sale escapado');
  assert.equal(conPipe!.split('\n').filter((l) => filaDelIndice(l) && l.split('\\|').join('\u0001').split('|').length !== 5).length, 0,
    'ninguna fila con columnas de más');
});

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
  const celda = (r! as string).split('\n').find((l: string) => l.includes('hallazgos-infra'))!;
  assert.match(celda, /\*\*De main\*\*: lo otro\. \*\*De la punta\*\*: lo nuevo\. \*\*Lo viejo de infra\*\*: ya estaba\./);
  assert.equal((r! as string).split('\n').filter((l: string) => l.includes('hallazgos-infra')).length, 1, 'UNA fila, no dos');
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

// =============================================================================
// Y el ÍNDICE QUE HAY EN DISCO: una fila por área, los links vivos, la tabla entera
// =============================================================================
// `merge=union` ya no lo duplica, pero lo de arriba fija el DRIVER, no el documento. El daño que dejó se juntó a mano el
// 6/11/2026 (217 filas → 77) y nada impedía que volviera: una cosecha que agrega una fila en vez de reescribir la celda
// de su área, un `|` sin escapar en el texto —que le inventa columnas y parte la fila— o un documento que se borra y
// deja su link colgado (pasó con `auditoria-aislamiento-workspace.md`, borrado el 17/10/2026). Esto lo mira en disco.
//
// PROBADO ROMPIÉNDOLO sobre el índice de verdad (6/11/2026; base 10 / 0). Pasan / fallan:
//   · una fila repetida                                  → 9 / 1
//   · un `|` sin escapar en el texto de una celda         → 9 / 1
//   · el link de una fila a un documento que no existe    → 9 / 1
//   · una línea en blanco en medio de la tabla            → 9 / 1
test('el índice en disco: una fila por área, tres columnas y ningún link muerto', () => {
  const lineas = leer(RUTA).split('\n');
  const ini = lineas.findIndex((l) => /^\|\s*Área\s*\|/.test(l));
  assert.ok(ini > 0, 'la tabla principal arranca en `| Área | Documento | Qué cubre |`');
  let fin = ini;
  for (let i = ini + 1; i < lineas.length; i++) {
    if (lineas[i].startsWith('|')) fin = i;
    else break; // ⚠️ una línea en blanco CORTA la tabla en markdown: lo de abajo deja de ser tabla
  }
  const filas = lineas.slice(ini + 2, fin + 1);
  assert.ok(filas.length > 50, `la tabla tiene ${filas.length} filas: o se cortó con una línea en blanco, o algo se borró`);

  const claves = new Map<string, number>();
  for (const l of filas) {
    // los `|` del texto van escapados, o markdown le da columnas de más a la fila
    const trozos = l.split('\\|').join('\u0001').split('|');
    assert.equal(trozos.length, 5, `esta fila no tiene tres columnas (un \`|\` sin escapar en el texto): ${l.slice(0, 90)}`);
    const [, rotulo, doc] = trozos;
    const clave = `${rotulo.trim()}|${doc.trim()}`;
    claves.set(clave, (claves.get(clave) ?? 0) + 1);
    const ruta = /\]\(([^)#]+)/.exec(doc)?.[1];
    assert.ok(ruta, `la 2.ª celda lleva el link al documento del área: ${l.slice(0, 90)}`);
    assert.ok(existsSync(join(RAIZ, 'docs', ruta!)), `el índice manda a \`docs/${ruta}\`, que no existe: la cosecha va al documento del área, y si se borró, se repunta`);
  }
  const repetidas = [...claves.entries()].filter(([, v]) => v > 1);
  assert.deepEqual(repetidas, [], `hay ${repetidas.length} área(s) con más de una fila: ${repetidas.map(([k, v]) => `${k} x${v}`).join(', ')}.
Si cosechaste: la entrada nueva va ADELANTE en la celda de tu área, no en una fila nueva.
Si NO cosechaste en el índice, es la mezcla: una punta cortada antes del 6/11/2026 trae las filas viejas y git las devuelve
al mezclar main (un lado borró, el otro conservó). Se arregla con:
  node scripts/unir-indice-hallazgos.mjs --consolidar docs/hallazgos.md --aplicar`);
});
