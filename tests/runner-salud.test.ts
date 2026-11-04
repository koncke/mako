// =============================================================================
// runner-salud.mjs: la cuenta sale de la app, y un Runner muerto se levanta o se dice solo (4/11/2026)
// =============================================================================
// Corre el script de verdad contra una PC de mentira (carpetas temporales), como lo corre el hook.
//
// Probado rompiéndolo (4/11/2026), cada una cae:
//   - sin mirar `carpetas` (cuenta siempre null) → marcador, Runner de otra cuenta, cuenta sin declarar;
//   - corregirMarcador sin escribir → «corrige el marcador»;
//   - runnerDeLaCuenta sin filtrar por cuenta → «el Runner de la otra cuenta no cuenta»;
//   - runnerDeLaCuenta sin mirar el latido → «un chat llamado Runner sin latido»;
//   - tomarUnaVez sin `wx` → «sólo el primer chat» y «dos corridas»;
//   - alAbrir sin mirar el nombre → «un Runner no se encarga a sí mismo»;
//   - contar toda corrida de la guardia como Runner → «la corrida de la guardia, con su nombre»;
//   - no anotar quién tomó el puesto → «la corrida que tomó el puesto»;
//   - alAbrir sin mirar el origen → «al compactar» y «por el hook de verdad»;
//   - el hook sin pasarle el origen → «por el hook de verdad».
// Y un cambio sin efecto (renombrar una variable local) lo deja verde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/operaciones/runner-salud.mjs', import.meta.url));
const HOOK = fileURLToPath(new URL('../scripts/claude-hooks/bitacora-sesion.sh', import.meta.url));
const UUID_5 = '312b5641-9983-4467-8552-afd981fb1e85';
const UUID_1 = '68eda2ab-d55d-41a3-be37-7780d56c55ce';
const ORG = 'f0944816-d385-4896-b4eb-d4cb06ebe987';
const pidMuerto = () => spawnSync(process.execPath, ['-e', '0']).pid;

function pc() {
  const raiz = mkdtempSync(join(tmpdir(), 'runner-salud-'));
  const dir = join(raiz, 'operaciones');
  const app = join(raiz, 'app');
  const sesiones = join(raiz, 'sessions');
  const marcador = join(raiz, 'cuenta-activa.txt');
  for (const d of [dir, join(dir, 'uso'), sesiones, join(app, UUID_5, ORG), join(app, UUID_1, ORG)]) mkdirSync(d, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ carpetas: { [UUID_5]: 'claude5', [UUID_1]: 'claude1' } }));
  writeFileSync(marcador, 'claude1\n');
  const correr = (cmd: string, env: Record<string, string> = {}, origen = 'startup') => {
    const r = spawnSync(process.execPath, [SCRIPT, cmd, ...(cmd === 'al-abrir' ? [origen] : [])], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        NODE_ENV: 'test', PATH: process.env.PATH ?? '', CARTERO_DIR: dir, CARTERO_APP_DIR: app, RUNNER_SESIONES_DIR: sesiones, CUENTA_MARCADOR: marcador,
        CLAUDE_CODE_ACCOUNT_UUID: UUID_5, CLAUDE_CODE_ORGANIZATION_UUID: ORG, ...env,
      },
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  /** Un chat abierto: su registro de sesión y su archivo en la carpeta de la cuenta. */
  const chat = (n: number, nombre: string, uuid = UUID_5, pid = process.pid + n) => {
    const local = `local_00000000-0000-4000-8000-00000000000${n}`;
    writeFileSync(join(sesiones, `${n}.json`), JSON.stringify({ pid, name: nombre, hostSessionId: local }));
    writeFileSync(join(app, uuid, ORG, `${local}.json`), '{}');
    return local;
  };
  /** Con el pid de este proceso: el único que este test sabe que está vivo. */
  const chatVivo = (n: number, nombre: string, uuid = UUID_5) => chat(n, nombre, uuid, process.pid);
  const latido = (hace: number) => {
    const f = join(dir, 'continuo.latido');
    writeFileSync(f, '');
    const t = new Date(Date.now() - hace);
    utimesSync(f, t, t);
  };
  const guardia = (cuenta = 'claude5', uuid = UUID_5) => writeFileSync(join(app, uuid, ORG, 'scheduled-tasks.json'), JSON.stringify({ scheduledTasks: [{ id: `runner-guardia-${cuenta}`, enabled: true }] }));
  const leerMarcador = () => readFileSync(marcador, 'utf8').trim();
  return { correr, chat, chatVivo, latido, guardia, leerMarcador, dir };
}

const MIN = 60_000;

test('corrige el marcador con la cuenta de la app, y lo dice', () => {
  const p = pc();
  p.guardia(); p.chatVivo(1, 'Runner'); p.latido(0);
  const linea = p.correr('al-abrir');
  assert.equal(p.leerMarcador(), 'claude5');
  assert.match(linea, /decia claude1.*claude5/);
  assert.equal(p.correr('al-abrir'), '', 'con el marcador bien y un Runner vivo, ni una palabra');
});

test('al compactar o retomar, un chat con el uuid viejo no devuelve el marcador a la cuenta anterior', () => {
  for (const origen of ['compact', 'resume', 'clear', '']) {
    const p = pc();
    assert.equal(p.correr('al-abrir', {}, origen), '', origen);
    assert.equal(p.leerMarcador(), 'claude1', origen);
  }
});

/** El hook de verdad, con el script de verdad, en una casa de mentira: lo que corre al abrir cada chat. */
function porElHook(origen: string) {
  const casa = mkdtempSync(join(tmpdir(), 'runner-salud-hook-'));
  const claude = join(casa, '.claude');
  mkdirSync(join(claude, 'operaciones'), { recursive: true });
  copyFileSync(SCRIPT, join(claude, 'operaciones', 'runner-salud.mjs'));
  writeFileSync(join(claude, 'operaciones', 'config.json'), JSON.stringify({ carpetas: { [UUID_5]: 'claude5' } }));
  writeFileSync(join(claude, 'cuenta-activa.txt'), 'claude1\n');
  const r = spawnSync('bash', [HOOK, 'inicio'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    input: JSON.stringify({ session_id: 'prueba', source: origen }),
    env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', HOME: casa, USERPROFILE: casa, APPDATA: join(casa, 'AppData'), BITACORA_SESIONES: join(casa, 'bitacora.tsv'), CLAUDE_CODE_ACCOUNT_UUID: UUID_5 },
  });
  assert.equal(r.status, 0, r.stderr);
  return {
    contexto: JSON.parse(r.stdout).hookSpecificOutput.additionalContext as string,
    marcador: readFileSync(join(claude, 'cuenta-activa.txt'), 'utf8').trim(),
    bitacora: readFileSync(join(casa, 'bitacora.tsv'), 'utf8'),
  };
}

test('por el hook de verdad: el chat que arranca corrige el marcador, y el que compacta no', () => {
  const arranca = porElHook('startup');
  assert.equal(arranca.marcador, 'claude5');
  assert.match(arranca.contexto, /CUENTA DE CLAUDE ACTIVA: claude5/);
  assert.match(arranca.contexto, /decia claude1/);
  assert.match(arranca.bitacora, /inicio\tclaude5\tprueba/, 'el session_id se sigue leyendo de stdin');
  const compacta = porElHook('compact');
  assert.equal(compacta.marcador, 'claude1');
  assert.match(compacta.contexto, /CUENTA DE CLAUDE ACTIVA: claude1/);
  assert.doesNotMatch(compacta.contexto, /decia claude1/);
});

test('una cuenta que nadie declaró no toca el marcador, y se dice', () => {
  const p = pc();
  const nueva = 'aaaaaaaa-1111-4222-8333-444444444444';
  const linea = p.correr('al-abrir', { CLAUDE_CODE_ACCOUNT_UUID: nueva });
  assert.equal(p.leerMarcador(), 'claude1');
  assert.match(linea, /CUENTA SIN DECLARAR/);
  assert.ok(linea.includes(nueva));
});

test('un chat que no es de la app no toca nada', () => {
  const p = pc();
  assert.equal(p.correr('al-abrir', { CLAUDE_CODE_ACCOUNT_UUID: '' }), '');
  assert.equal(p.leerMarcador(), 'claude1');
});

test('el Runner de la otra cuenta no cuenta', () => {
  const p = pc();
  p.chatVivo(1, 'Runner', UUID_1); p.latido(0);
  const e = JSON.parse(p.correr('estado'));
  assert.equal(e.cuenta, 'claude5');
  assert.equal(e.runner.vivo, false);
  assert.match(e.runner.motivo, /no hay un chat Runner/);
});

test('un chat llamado Runner sin latido no entrega: no está vivo', () => {
  const p = pc();
  p.chatVivo(1, 'Runner'); p.latido(20 * MIN);
  const e = JSON.parse(p.correr('estado'));
  assert.equal(e.runner.vivo, false);
  assert.match(e.runner.motivo, /no da vueltas hace 20 min/);
});

test('un chat con otro nombre, o con el proceso muerto, no es el Runner', () => {
  const p = pc();
  p.chatVivo(1, 'Cerebro'); p.chat(2, 'Runner', UUID_5, pidMuerto()); p.latido(0);
  assert.equal(JSON.parse(p.correr('estado')).runner.vivo, false);
});

test('Runner vivo: chat de esta cuenta y latido fresco, también bajo su jefe', () => {
  const p = pc();
  p.chatVivo(1, 'Cerebro › Runner'); p.latido(2 * MIN);
  const e = JSON.parse(p.correr('estado'));
  assert.equal(e.runner.vivo, true);
  assert.equal(e.runner.latidoMin, 2);
});

test('la corrida de la guardia, con su nombre, no se cuenta como el Runner que busca', () => {
  const p = pc();
  p.chatVivo(1, 'Guardia > Runner'); p.latido(0);
  assert.equal(JSON.parse(p.correr('estado')).runner.vivo, false);
});

test('la corrida que tomó el puesto sí es el Runner, aunque no la hayan dejado renombrarse', () => {
  const p = pc();
  const yo = p.chatVivo(1, 'Guardia > Runner'); p.latido(0);
  assert.equal(p.correr('tomar', { CLAUDE_CODE_HOST_SESSION_ID: yo }), 'TOMADO');
  assert.equal(JSON.parse(p.correr('estado')).runner.vivo, true);
});

test('medirYa: sin medición, o con una de más de 30 minutos', () => {
  const p = pc();
  assert.equal(JSON.parse(p.correr('estado')).medirYa, true);
  writeFileSync(join(p.dir, 'uso', 'claude5.json'), JSON.stringify({ medido: new Date(Date.now() - 5 * MIN).toISOString() }));
  assert.equal(JSON.parse(p.correr('estado')).medirYa, false);
  writeFileSync(join(p.dir, 'uso', 'claude5.json'), JSON.stringify({ medido: new Date(Date.now() - 45 * MIN).toISOString() }));
  assert.equal(JSON.parse(p.correr('estado')).medirYa, true);
});

test('sin Runner, se lo dice sólo al primer chat que abre', () => {
  const p = pc();
  p.guardia();
  const primero = p.correr('al-abrir');
  assert.match(primero, /NO HAY RUNNER EN claude5/);
  assert.match(primero, /Lo levanta sola la tarea runner-guardia-claude5/);
  assert.ok(!/["\\\n]/.test(primero), 'va adentro de un JSON armado a mano');
  assert.equal(p.correr('al-abrir'), '', 'el segundo chat no recibe el mismo aviso');
});

test('una cuenta sin su guardia recibe el encargo de crearla, aunque otra cuenta tenga la suya', () => {
  const p = pc();
  p.guardia('claude1', UUID_1);
  p.chatVivo(1, 'Runner'); p.latido(0);
  assert.match(p.correr('al-abrir'), /NO TIENE LA GUARDIA/);
});

test('un Runner o una corrida de la guardia no se encargan a sí mismos', () => {
  for (const nombre of ['Runner', 'Guardia > Runner']) {
    const p = pc();
    p.guardia();
    writeFileSync(join(p.dir, '..', 'sessions', '777.json'), JSON.stringify({ name: nombre }));
    assert.doesNotMatch(p.correr('al-abrir', { CLAUDE_PID: '777' }), /NO HAY RUNNER|NO TIENE LA GUARDIA/, nombre);
  }
});

test('dos corridas de la guardia no levantan dos Runners', () => {
  const p = pc();
  assert.equal(p.correr('tomar'), 'TOMADO');
  assert.equal(p.correr('tomar'), 'OCUPADO');
  const f = join(p.dir, 'guardia-toma');
  const viejo = new Date(Date.now() - 11 * MIN);
  utimesSync(f, viejo, viejo);
  assert.equal(p.correr('tomar'), 'TOMADO', 'una corrida que murió antes de armar nada no traba a la siguiente');
});
