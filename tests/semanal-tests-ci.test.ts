// =============================================================================
// La suite entera y AISLADA corre UNA vez por semana, y gasta lo mínimo de los minutos de Actions (17/10/2026)
// =============================================================================
// El Cerebro lo decidió (docs/relevo/cerebro.md, «15:40 UTC»): `integracion` corre los tests compartiendo proceso, y un test que
// ensucia el estado global puede dar un falso verde por contagio. Una vez por semana corre `npm test` con cada archivo en su proceso.
// La cuenta es Free (2.000 min/mes, sin medio de pago y ya gastados en gran parte): lo que se fija acá es lo que, roto, convierte
// una pasada de 11 minutos por semana en un agujero en el mes, sin que nada falle:
//   · que no se dispare por push ni por pull request (cada commit pagaría 11 minutos);
//   · que corra `npm test` SIN `--compartir` (si no, no es "aislado" y no caza lo que debe cazar);
//   · que tenga un techo duro de minutos, y que no baje el repo ni instale nada si la semana no tuvo commits;
//   · que no pueda escribir en el repo ni avanzar `main`.
//
// Probado ROMPIÉNDOLO (17/10/2026; base 5 / 0). Una rotura por vez, restaurada y comprobada con `git diff --stat`:
//   · `push:` agregado a `on:`                                            → 4 / 1
//   · `--compartir` en el comando de los tests                            → 4 / 1
//   · `timeout-minutes: 20` → `timeout-minutes: 360` (el default de GitHub) → 4 / 1
//   · el paso "¿Hubo cambios?" sacado del `if:` del checkout              → 4 / 1
//   · `contents: write` en los permisos                                   → 4 / 1
//
// ⚠️ 3/11/2026: el techo de 20 min CANCELÓ la corrida del 2/11 a los 1.165 s: la suite casi se duplicó. Sin veredicto y sin mail, y
// desde `punta.yml` esta corrida es la única que ve «los demás». Este archivo fijaba «<= 25», o sea que fijaba la red muerta.
// Probado rompiéndolo: el job en 20 → rojo · el paso sin su tope → rojo · el paso con el mismo tope que el job → rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const wf = () => sinComentarios(leer('.github/workflows/semanal-tests.yml'));

test('corre UNA vez por semana y a mano; nunca por push ni por pull request', () => {
  const src = wf();
  const on = src.slice(src.indexOf('\non:'), src.indexOf('\nconcurrency:'));
  const crons = [...on.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(crons.length, 1, 'una sola programación: cada una suma minutos');
  const [min, hora, diaMes, mes, diaSemana] = crons[0].split(/\s+/);
  assert.ok(/^\d+$/.test(min) && /^\d+$/.test(hora), 'una hora fija');
  assert.equal(diaMes, '*');
  assert.equal(mes, '*');
  assert.match(diaSemana, /^[0-6]$/, 'UN solo día de la semana: con una lista o un * correría varias veces por semana');
  assert.match(on, /workflow_dispatch:/, 'se puede correr a mano');
  assert.doesNotMatch(on, /\bpush:|\bpull_request/, 'por push o PR, cada commit pagaría ~11 minutos de los 2.000 del mes');
});

test('corre `npm test` aislado: cada archivo en su proceso, sin compartir', () => {
  const src = wf();
  assert.match(src, /npm test -- --test-concurrency=2/);
  assert.doesNotMatch(src, /--compartir|tests-afectados/, 'compartir proceso es lo que corre `integracion`: la semanal existe para NO hacerlo');
  assert.doesNotMatch(src, /tsc|guardas-push|next typegen/, 'tipos y guardas ya corren en cada subida: acá sería pagar dos veces');
});

test('tiene un techo duro de minutos', () => {
  const m = /timeout-minutes:\s*(\d+)/.exec(wf());
  assert.ok(m, 'sin timeout-minutes el techo de GitHub es de 360 minutos: un test colgado se come el mes');
  assert.ok(Number(m[1]) <= 60, `el techo es de ${m[1]} minutos: con 5 lunes al mes son ${Number(m[1]) * 5}`);
});

test('el techo le alcanza a la suite, y un cuelgue es un rojo y no un job cancelado', () => {
  const src = wf();
  const job = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(src)?.[1]);
  const paso = Number(/^ {8}timeout-minutes: (\d+)$/m.exec(src)?.[1]);
  assert.ok(job >= 45, `el job tiene ${job} min: el 2/11 lo cortaron 20 sin veredicto, y --resto solo ya tarda 22`);
  assert.ok(paso > 0 && paso < job, `el paso tiene ${paso} min y el job ${job}: con un cuelgue, el que corta tiene que ser el paso`);
});

test('si la semana no tuvo commits no baja el repo ni instala nada', () => {
  const src = wf();
  assert.match(src, /id: cambios/);
  assert.match(src, /commits\?sha=main&since=/, 'mira la API de commits de main');
  // Cada paso caro depende de ese `if`: se parte por pasos (cada uno arranca con «- » a la altura de los pasos).
  const pasos = src.split(/\n {6}- /).slice(1);
  assert.equal(pasos.length, 5, 'los cinco pasos: cambios, checkout, node, instalar, suite');
  for (const clave of ['actions/checkout@v4', 'actions/setup-node@v4', 'npm ci', 'npm test']) {
    const paso = pasos.find((p) => p.includes(clave));
    assert.ok(paso, `no encuentro el paso «${clave}»`);
    assert.match(paso, /if: steps\.cambios\.outputs\.correr == 'si'/, `«${clave}» corre aunque la semana no tuvo commits`);
  }
});

test('no puede escribir en el repo ni avanzar main', () => {
  const src = wf();
  assert.match(src, /permissions:\n\s+contents: read\n/, 'permisos de sólo lectura');
  assert.doesNotMatch(src, /contents:\s*write|git push|--force/, 'la semanal avisa, no cambia nada');
  // Y la que sí avanza main sigue siendo la otra: este archivo no la reemplaza.
  assert.match(sinComentarios(leer('.github/workflows/integracion.yml')), /git push origin "HEAD:refs\/heads\/main"/);
});
