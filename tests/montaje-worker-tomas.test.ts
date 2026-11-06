// =============================================================================
// Una toma más larga que la primera no pierde lo que se dice al final
// =============================================================================
// La pantalla del Video Generator le promete al cliente «Se fue el silencio, no
// una palabra» (app/video-generator/PasoMontaje.tsx). Era falso por la ruta del
// contenedor: `worker/montar-cola.mjs` le pasaba al plan de cortes SÓLO la
// duración de la PRIMERA toma —`DURVID: String(seg[0] ?? 10.005)`, con un
// comentario que afirmaba que todas duraban lo mismo— y
// `scripts/plan-cortes-anuncio.mjs` topea cada toma en el número que recibe. Con
// tomas de 10, 8 y 10, lo dicho después del segundo 10 de la tercera no entraba en
// ningún tramo y se iba del anuncio SIN UN ERROR. El mismo supuesto armaba el «De X
// a Y»: tomas × el largo de la primera, no la suma real.
//
// La ruta de Vercel (lib/montaje/pipeline.ts) ya mandaba la lista entera y la fija
// tests/montaje-cola.test.ts. Este archivo fija la del worker, eslabón por eslabón:
//   1. la cuenta: `duracionesDeTomas` devuelve una duración POR toma;
//   2. el bash: una lista con comas llega al script como UN argumento;
//   3. el script: topea cada toma con la suya — y con un número solo, pierde la toma;
//   4. el cableado del worker y la imagen que lo lleva.
//
// PROBADO ROMPIÉNDOLO (06/11/2026, con el ffmpeg del PATH; base 5 / 0, y cayeron
// las OCHO). Pasan / fallan:
//   R1 el worker manda sólo la duración de la primera toma              → 4 / 1
//   R2 el «antes» vuelve a ser tomas × el largo de la primera           → 4 / 1
//   R3 el largo lo manda la LISTA, no la cantidad de tomas              → 4 / 1
//   R4 `duracionesDeTomas` devuelve la primera duración para todas      → 4 / 1
//   R5 un 0 o un null pasan como duración de una toma                   → 4 / 1
//   R6 el Dockerfile deja de copiar worker/duraciones.mjs               → 4 / 1
//   R7 el bash vuelve a pasar $DURVID sin comillas                      → 4 / 1
//   R8 plan-cortes topea TODAS las tomas con la duración de la primera  → 4 / 1
// R8 es la que importa: el eslabón 3 corre el script de verdad, así que si mañana
// `durDe` vuelve a ignorar la lista, este archivo lo dice.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DUR_POR_DEFECTO, duracionesDeTomas } from '../worker/duraciones.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. La cuenta ─────────────────────────────────────────────────────────────

test('duracionesDeTomas da una duración POR toma, y completa con el default sin inventar ceros', () => {
  // El caso medido: tres tomas de 10, 8 y 10.
  assert.deepEqual(duracionesDeTomas([10, 8, 10], 3), [10, 8, 10]);
  // El largo lo manda la cantidad de TOMAS, no la lista.
  assert.deepEqual(duracionesDeTomas([10, 8, 10], 2), [10, 8]);
  assert.deepEqual(duracionesDeTomas([10, 8], 3), [10, 8, DUR_POR_DEFECTO]);
  assert.deepEqual(duracionesDeTomas([], 2), [DUR_POR_DEFECTO, DUR_POR_DEFECTO]);
  // Un agujero en el medio no corre a las que siguen.
  assert.deepEqual(duracionesDeTomas([10, null, 10], 3), [10, DUR_POR_DEFECTO, 10]);
  // ⚠️ UN CERO TOPEARÍA LA TOMA EN NADA Y LA PERDERÍA ENTERA: nada que no sea un
  // número positivo pasa.
  for (const malo of [0, -5, NaN, Infinity, '', null, undefined, 'ocho', {}]) {
    assert.deepEqual(duracionesDeTomas([malo, 8], 2), [DUR_POR_DEFECTO, 8], JSON.stringify(malo) ?? String(malo));
  }
  // Lo que no es una lista tampoco explota: el pedido viene de la base.
  for (const basura of [null, undefined, 'tres', 7, {}]) {
    assert.deepEqual(duracionesDeTomas(basura, 1), [DUR_POR_DEFECTO], String(basura));
  }
  // Un número decimal se respeta tal cual: el plan topea con él.
  assert.deepEqual(duracionesDeTomas(['4.5', 3], 2), [4.5, 3]);
  // Sin tomas, no hay duraciones (y el pipeline ya falla antes por otro lado).
  for (const n of [0, -1, NaN, 1.7]) assert.equal(duracionesDeTomas([10, 8], n).length, Math.max(0, Math.floor(n) || 0), String(n));
});

// ── 2. El bash: la lista llega como UN argumento ─────────────────────────────

const SH = leer('scripts/montar-anuncio-sin-silencios.sh');

test('el bash le pasa el DURVID entero como argv[4]: una lista con comas no se parte', (t) => {
  // La línea de verdad, para que este test mida la que corre y no una copia. Las que
  // arrancan con `#` son el comentario que la explica, y también la nombran.
  const linea = SH.split('\n').find((l) => !/^\s*#/.test(l) && l.includes('plan-cortes-anuncio.mjs')) ?? '';
  assert.match(linea, /plan-cortes-anuncio\.mjs" "\$T" "\$NTOMAS" "\$DURVID"/,
    `la invocación del plan cambió de forma: «${linea.trim()}»`);

  if (!spawnSync('bash', ['--version'], { encoding: 'utf8' }).stdout) { t.skip('sin bash'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'durvid-'));
  try {
    const argv = join(dir, 'argv.mjs');
    writeFileSync(argv, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));', 'utf8');
    // El mismo expandido que la línea de arriba, con el script reemplazado por uno
    // que imprime su argv. `set -euo pipefail` como el script real.
    const correr = (durvid: string) => {
      // ⚠️ `T` SIN BARRA ADELANTE: el bash de Git en Windows convierte un
      // `/trabajo` en `C:/Program Files/Git/trabajo` antes de que el proceso lo vea.
      const r = spawnSync('bash', ['-c', 'set -euo pipefail; "$NODE_BIN" "$ARGV_JS" "$T" "$NTOMAS" "$DURVID"'], {
        encoding: 'utf8',
        // ⚠️ `maxBuffer`: sin él, node corta la salida del hijo en 1 MB y el JSON llega PARTIDO
        // («Unterminated string in JSON», que no se parece a la causa). Lo exige una guarda del
        // repo, tests/tanda-no-la-mata-un-test-lento.test.ts, y acá el plan de un anuncio largo
        // puede pasarse de 1 MB — en el runner antes que en la PC, que es el peor caso.
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NODE_BIN: process.execPath, ARGV_JS: argv, T: 'carpeta', NTOMAS: '3', DURVID: durvid },
      });
      assert.equal(r.status, 0, `bash salió ${r.status}: ${r.stderr}`);
      return JSON.parse(r.stdout) as string[];
    };
    assert.deepEqual(correr('10,8,10'), ['carpeta', '3', '10,8,10'], 'la lista se partió en varios argumentos');
    assert.deepEqual(correr('10.005'), ['carpeta', '3', '10.005'], 'un número solo tiene que seguir funcionando');
    // Con comillas aguanta hasta un espacio: sin ellas, esto serían 4 argumentos y
    // el script leería «10,» → NaN, topeando TODAS las tomas en nada.
    assert.deepEqual(correr('10, 8, 10'), ['carpeta', '3', '10, 8, 10'], 'un espacio en la lista parte el argumento');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3. El script: cada toma se topea con la SUYA ─────────────────────────────

function ffmpegDePrueba(): string {
  const candidatos = [
    process.env.FFMPEG_PATH,
    join(RAIZ, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  ];
  const puesto = candidatos.find((c) => c && existsSync(c));
  if (puesto) return puesto;
  // ⚠️ Y EL DEL PATH TAMBIÉN: `ffmpeg-static` es una dependencia OPCIONAL (si su
  // descarga de GitHub falla, npm ci sigue sin el binario), así que en una máquina
  // sin ella este test se salteaba —y un test salteado no mide nada—.
  return spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0 ? 'ffmpeg' : '';
}

type Plan = { total: number; segs: Array<{ toma: number; ini: number; fin: number }> };

test('plan-cortes topea cada toma con SU duración: con un número solo, la toma larga se pierde', (t) => {
  const ffmpeg = ffmpegDePrueba();
  if (!ffmpeg) { t.skip('sin ffmpeg (FFMPEG_PATH o node_modules/ffmpeg-static)'); return; }

  // Tres voces. La del medio dura 4,5 s y habla AL FINAL (de 3,0 a 4,2 s): es la
  // toma que el tope de la primera (3 s) dejaba afuera entera.
  const DUR = [3, 4.5, 3];
  const dir = mkdtempSync(join(tmpdir(), 'tomas-durvid-'));
  try {
    for (const n of [1, 2, 3]) {
      const d = DUR[n - 1];
      const desde = n === 2 ? 3000 : 900;
      const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `sine=frequency=${300 + n * 100}:duration=1.2`,
        '-af', `adelay=${desde},apad=whole_dur=${d}`, '-t', String(d),
        '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', join(dir, `sts-${n}.mp3`)], { encoding: 'utf8' });
      assert.equal(r.status, 0, `no se pudo armar la voz ${n}: ${r.stderr}`);
    }
    // ⚠️ SIN ffprobe, como en el contenedor y en la función: el script cae a leer el
    // «Duration:» que imprime ffmpeg. Con ffprobe presente este test pasaría igual y
    // no estaría midiendo el camino que corre.
    const plan = (durvid: string): Plan => {
      const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'plan-cortes-anuncio.mjs'), dir, '3', durvid], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,  // ver arriba: un JSON cortado en 1 MB no se parece a su causa
        env: { ...process.env, FFMPEG: ffmpeg, FFPROBE: join(dir, 'no-hay-ffprobe'), CLAMP: '0.45' },
      });
      assert.equal(r.status, 0, `el plan salió ${r.status}: ${r.stderr.slice(0, 600)}`);
      return JSON.parse(r.stdout) as Plan;
    };
    const finDe = (p: Plan, toma: number) => {
      const s = p.segs.filter((x) => x.toma === toma);
      return s.length ? Math.max(...s.map((x) => x.fin)) : 0;
    };

    // Con la lista: la toma 2 llega hasta donde deja de hablar (4,2 s + la cola).
    const bien = plan(DUR.join(','));
    assert.ok(finDe(bien, 2) > 3.9, `la toma 2 se corta en ${finDe(bien, 2)} s: se pierde lo que se dice después del largo de la PRIMERA toma`);
    assert.deepEqual([...new Set(bien.segs.map((x) => x.toma))].sort(), [1, 2, 3], 'alguna toma quedó afuera del plan');

    // Con un número solo —lo que mandaba el worker— la toma 2 desaparece del plan:
    // esto es el síntoma del pendiente, medido.
    const mal = plan('3');
    assert.equal(finDe(mal, 2), 0, 'con el largo de la primera toma, la toma 2 debería quedar afuera: el caso bueno no prueba nada');
    assert.ok(bien.total > mal.total + 0.9, `el plan con la lista (${bien.total}s) tiene que traer el habla que el plan de un solo número (${mal.total}s) tira`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 4. El cableado del worker y la imagen ────────────────────────────────────

const WORKER = sinComentarios(leer('worker/montar-cola.mjs'));

test('el worker manda la lista entera y suma las duraciones reales para el «De X a Y»', () => {
  assert.match(WORKER, /import \{ duracionesDeTomas \} from '\.\/duraciones\.mjs';/);
  assert.match(WORKER, /const durs = duracionesDeTomas\(t\.segundosPorToma, t\.clips\.length\);/);
  assert.match(WORKER, /DURVID: durs\.join\(','\),/, 'el plan de cortes no recibe la lista');
  assert.match(WORKER, /const antes = durs\.reduce\(\(a, b\) => a \+ b, 0\);/, 'el «antes» no sale de la suma real');
  // El supuesto de que todas las tomas duran lo mismo, en cualquiera de sus formas.
  assert.doesNotMatch(WORKER, /seg\[0\]/, 'volvió la duración de la primera toma para todas');
  assert.doesNotMatch(WORKER, /clips\.length \* /, 'volvió el «antes» como tomas × una duración');
  // Y la pantalla sigue siendo la que lee ese número.
  assert.match(sinComentarios(leer('app/video-generator/PasoMontaje.tsx')), /reloj\(estado\.segundosAntes\)/);
});

test('todo lo que el worker importa viaja en la imagen: un import que falta mata el contenedor al arrancar', () => {
  const dockerfile = leer('worker/Dockerfile');
  const propios = [...WORKER.matchAll(/from '\.\/([\w-]+\.mjs)'/g)].map((m) => m[1]);
  assert.ok(propios.length >= 1, `el worker no importa ningún módulo propio (encontré ${propios.length})`);
  for (const f of new Set(propios)) {
    assert.ok(existsSync(join(RAIZ, 'worker', f)), `worker/montar-cola.mjs importa ./${f}, que no existe`);
    assert.match(dockerfile, new RegExp(`COPY[^\\n]*worker/${f.replace('.', '\\.')}`),
      `worker/${f} no se copia a la imagen: el contenedor moriría con ERR_MODULE_NOT_FOUND`);
  }
});
