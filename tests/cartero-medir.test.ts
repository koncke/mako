// =============================================================================
// `cartero.mjs medir`: el Runner de la app anota las dos ventanas de uso (17/10/2026)
// =============================================================================
// Pedido de Martín: «comienza a medir el % de la ventana de 5 hs». La app no tiene barra de estado, así que el Ops Center
// decía «Sesión de 5 horas: Sin medir» para la cuenta 4. Ahora el Runner llama a get_usage en cada vuelta y pasa las dos
// ventanas a `medir`, que escribe:
//   - USO/<cuenta>.json, lo que sube `cuotaDe` al Ops Center;
//   - uso-cinco.txt y uso-semanal.txt, lo que lee el corte del 97% (~/.claude/guardia/corte-97.mjs).
//
// Probado rompiéndolo (17/10/2026):
//   - sin escribir uso-cinco.txt → 1 / 1 (el corte del 97% se queda sin la ventana de 5 h);
//   - aceptando un % que no es número → 1 / 1.
//
// LA HUELLA DE LA SEMANA (20/10/2026, la SEGUNDA vez que el Uso mostró los números de una cuenta en otra; la primera, el
// 17/10, docs/hallazgos-operaciones.md). Un chat puso ~/.claude/cuenta-activa.txt en claude1 con la app en la cuenta 4, y a
// las 20:14 UTC `medir` anotó a nombre de claude1 la semana de la 4 (6% y 2%, reinicio 2026-10-27T20:00:00.496Z). Cada
// cuenta reinicia su semana siempre a la misma hora: el reinicio dice de quién es. `medir` ya no escribe si es de OTRA
// cuenta vigente (A) o si mueve la semana de ESTA antes de vencer (B, salvo `--renovada`); MaKo tampoco lo guarda.
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   - `problemaDeHuella` sin mirar las otras cuentas (A) → 1 fallo;
//   - `problemaDeHuella` sin mirar la semana propia (B) → 1 fallo;
//   - `cuentaDeLaSemana` (MaKo) siempre null → 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const casa = mkdtempSync(join(tmpdir(), 'cartero-medir-'));
mkdirSync(join(casa, '.claude'), { recursive: true });
process.env.CARTERO_HOME = casa;
process.env.CARTERO_DIR = join(casa, '.claude', 'operaciones');

const cargar = async () => import(pathToFileURL(join(process.cwd(), 'scripts/operaciones/cartero.mjs')).href) as Promise<{
  medir: (cuenta: string, args: string[], ahora?: number, opciones?: { renovada?: boolean }) => { cinco: { pct: number } | null; semana: { pct: number } | null; medido: string };
}>;

test('medir anota las dos ventanas para el Ops Center y para el corte del 97%', async () => {
  const { medir } = await cargar();
  const ahora = Date.parse('2026-10-17T12:00:00Z');
  const r = medir('claude4', ['41.6', '2026-10-17T14:40:00Z', '26', '2026-10-20T20:00:00Z'], ahora);
  assert.equal(r.cinco?.pct, 42);
  assert.equal(r.semana?.pct, 26);
  const json = JSON.parse(readFileSync(join(casa, '.claude', 'operaciones', 'uso', 'claude4.json'), 'utf8'));
  assert.equal(json.cinco.pct, 42);
  assert.equal(json.cinco.reinicia, '2026-10-17T14:40:00.000Z');
  assert.equal(readFileSync(join(casa, '.claude', 'uso-cinco.txt'), 'utf8').trim(), '42 2026-10-17T14:40:00.000Z 2026-10-17T12:00:00.000Z claude4');
  assert.equal(readFileSync(join(casa, '.claude', 'uso-semanal.txt'), 'utf8').trim(), '26 2026-10-20T20:00:00.000Z 2026-10-17T12:00:00.000Z claude4');
});

test('sin ningún número no anota nada: no inventa una medición', async () => {
  const { medir } = await cargar();
  assert.throws(() => medir('claude4', ['cuarenta', 'x', '', '']), /uso: medir/);
});

const USO = join(casa, '.claude', 'operaciones', 'uso');
const anotar = (cuenta: string, reinicia: string) => {
  mkdirSync(USO, { recursive: true });
  writeFileSync(join(USO, `${cuenta}.json`), JSON.stringify({ cinco: null, semana: { pct: 40, reinicia }, medido: '2026-10-20T19:00:00.000Z', api: null }));
};
const leerUso = (cuenta: string) => JSON.parse(readFileSync(join(USO, `${cuenta}.json`), 'utf8'));

test('el 20/10: la semana de la cuenta 4 a nombre de la 1 NO se anota (es de otra cuenta vigente)', async () => {
  const { medir } = await cargar();
  const ahora = Date.parse('2026-10-20T20:14:00Z');
  anotar('claude4', '2026-10-27T19:59:59.509Z');
  anotar('claude1', '2026-10-24T16:00:00.000Z');
  const semanalAntes = readFileSync(join(casa, '.claude', 'uso-semanal.txt'), 'utf8');
  assert.throws(() => medir('claude1', ['6', '2026-10-21T01:00:00Z', '2', '2026-10-27T20:00:00.496Z'], ahora), /no anoté la cuota: es de claude4, no de claude1 \(el marcador está mal\)/);
  assert.equal(leerUso('claude1').semana.reinicia, '2026-10-24T16:00:00.000Z', 'el archivo de la 1 queda como estaba');
  assert.equal(readFileSync(join(casa, '.claude', 'uso-semanal.txt'), 'utf8'), semanalAntes, 'y la línea del corte del 97% también');
  assert.throws(() => medir('claude1', ['6', '2026-10-21T01:00:00Z', '2', '2026-10-27T20:00:00.496Z'], ahora, { renovada: true }), /es de claude4/, 'ni con --renovada: es de otra');
  // La medición de verdad de la 1, con su semana, sí entra.
  medir('claude1', ['7', '2026-10-21T01:00:00Z', '41', '2026-10-24T16:00:30Z'], ahora);
  assert.equal(leerUso('claude1').semana.pct, 41);
});

test('la semana de una cuenta no se mueve antes de vencer, salvo que Martín diga que se renovó', async () => {
  const { medir } = await cargar();
  const ahora = Date.parse('2026-10-20T20:30:00Z');
  anotar('claude4', '2026-10-27T19:59:59.509Z');
  anotar('claude1', '2026-10-24T16:00:00.000Z');
  assert.throws(() => medir('claude1', ['1', '2026-10-21T01:00:00Z', '1', '2026-10-27T09:00:00Z'], ahora), /la semana de claude1 se reinicia 2026-10-24T16:00:00\.000Z.*--renovada/);
  medir('claude1', ['1', '2026-10-21T01:00:00Z', '1', '2026-10-27T09:00:00Z'], ahora, { renovada: true });
  assert.equal(leerUso('claude1').semana.reinicia, '2026-10-27T09:00:00.000Z', 'con --renovada, la semana nueva');
  // Una semana ya vencida se reemplaza sola: es la siguiente.
  anotar('claude1', '2026-10-20T10:00:00.000Z');
  medir('claude1', ['1', '2026-10-21T01:00:00Z', '0', '2026-10-27T10:00:00Z'], ahora);
  assert.equal(leerUso('claude1').semana.reinicia, '2026-10-27T10:00:00.000Z');
});

test('MaKo tampoco guarda la cuota cuya semana es de otra cuenta vigente (frena a un cartero de antes)', async () => {
  const { cuentaDeLaSemana } = await import('../lib/centro-uso');
  const ahora = Date.parse('2026-10-20T20:14:00Z');
  const otras = [{ cuenta: 'claude4', cuota: { semana: { pct: 2, reinicia: '2026-10-27T19:59:59.509Z' } } }, { cuenta: 'claude2', cuota: null }];
  assert.equal(cuentaDeLaSemana('claude1', { semana: { pct: 2, reinicia: '2026-10-27T20:00:00.496Z' } }, otras, ahora), 'claude4');
  assert.equal(cuentaDeLaSemana('claude1', { semana: { pct: 41, reinicia: '2026-10-24T16:00:00.000Z' } }, otras, ahora), null, 'su semana');
  assert.equal(cuentaDeLaSemana('claude1', { semana: { pct: 2, reinicia: '2026-10-27T20:00:00Z' } }, [{ cuenta: 'claude4', cuota: { semana: { pct: 2, reinicia: '2026-10-19T20:00:00Z' } } }], ahora), null, 'la de otra ya vencida no cuenta');
  const ciclo = readFileSync(join(process.cwd(), 'lib/operaciones.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ciclo, /if \(de\) \{ console\.warn\(.*\); cuota = null; \}/, 'cicloCartero no la guarda');
  assert.ok(ciclo.includes('.upsert(escribir.fila,') && ciclo.indexOf('cuentaDeLaSemana(') < ciclo.indexOf('.upsert(escribir.fila,'), 'antes de guardar');
});
