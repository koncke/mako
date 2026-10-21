// =============================================================================
// La IA del cliente, ola 2: «Tus cuentas de IA», el instalador de una línea y varias cuentas (docs/ia-del-cliente.md)
// =============================================================================
// Martín (21/10/2026): «que puedan conectarlo, que haya un tutorial, que este 100% funcional». Lo que fija este archivo:
//   1. EL PROGRAMA: lo único del comando que viene del servidor es el modelo, y pasa por una lista; el % usado sale del
//      `rate_limit_event` del stream; de varias cuentas usa la de más cupo; encuentra a Claude aunque falte el PATH; y las
//      copias del programa son idénticas a las del servidor;
//   2. EL INSTALADOR: sólo lleva valores validados (código, servidor, URL firmadas); no gasta el código; es GET y público;
//   3. «TUS CUENTAS DE IA»: las rutas son con sesión, el miembro ve sólo las suyas y desconecta sólo las suyas, el modelo
//      lo elige el admin; la pantalla le habla de «tú» y conecta la clave sin salir de la tab.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-ia-pc-ola2.mjs`: una rotura por vez, restaurada de
// memoria y comprobada con sha256; base 5 / 0). Trece roturas, todas con su rojo: `modeloPc` aceptando cualquiera en el
// servidor (4 / 1) y en el programa (3 / 2) · la cuenta siempre la primera · el % mal leído · Claude sólo por el PATH ·
// el instalador sin validar el código · sin validar las URL · instalar aceptando escrituras · el miembro viendo todas las
// PC · cualquiera desconectando cualquiera · el modelo cambiado por un miembro · emparejar sin tope · la pantalla de vos
// (cada una 4 / 1). Restaurado: 5 / 0.
// Y DE PUNTA A PUNTA en esta PC (scripts/ia-pc/probar-punta-a-punta.mts --instalador): la línea de PowerShell bajó el
// ejecutable del bucket, lo conectó con el código, lo dejó en Inicio, contestó un turno con herramientas, y la limpieza
// sacó el proceso, el arranque y la carpeta. La Mac no se probó (no hay una a mano).
//
// Correr: npx tsx --test tests/ia-pc-ola2.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ARGS_CLAUDE, MODELOS_PC, VERSION_PC, cuentaConCupo, limitesDelEvento, lineaDeInstalacion, modeloPc, scriptDeInstalacion,
} from '../lib/ia-pc-reglas';
import * as programa from '../scripts/ia-pc/mako-pc.mjs';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que trae de verdad el stream de Claude Code 2.1.301 (medido el 21/10/2026, sin el texto). */
const EVENTO = { type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', unifiedWindows: { five_hour: { utilization: 0.42, resetsAt: 1792576200 }, seven_day: { utilization: 0.98, resetsAt: 1792573200 } } } };
const STREAM = [
  JSON.stringify({ type: 'system', subtype: 'init' }),
  JSON.stringify(EVENTO),
  JSON.stringify({ type: 'assistant', message: {} }),
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Tienes 3 tareas.', usage: { input_tokens: 9, output_tokens: 6 } }),
].join('\n');

test('el programa: las copias son idénticas, y del servidor sólo entra el modelo, por su lista', () => {
  assert.deepEqual([...programa.ARGS_CLAUDE], [...ARGS_CLAUDE]);
  assert.deepEqual([...programa.MODELOS_PC], [...MODELOS_PC]);
  assert.equal(programa.VERSION, VERSION_PC, 'el instalador sirve la misma versión que dice el programa');
  // Rota: aceptar cualquier modelo → este test falla (un `--model` del servidor podría meter otro argumento).
  for (const m of ['--dangerously-skip-permissions', 'sonnet --tools Bash', 'gpt-5', null]) {
    assert.equal(programa.modeloPc(m), 'sonnet', `«${m}» no pasa`);
    assert.equal(modeloPc(m), 'sonnet');
  }
  assert.equal(programa.modeloPc('opus'), 'opus');
  assert.ok(ARGS_CLAUDE.includes('stream-json') && ARGS_CLAUDE.includes('--verbose'), 'el % usado viene en el stream');
});

test('el % usado sale del rate_limit_event, y de varias cuentas se usa la de más cupo', () => {
  const esperado = { usado5h: 42, usadoSemana: 98, repone: new Date(1792576200 * 1000).toISOString() };
  assert.deepEqual(limitesDelEvento(EVENTO), esperado);
  assert.deepEqual(programa.limitesDelEvento(EVENTO), esperado, 'la copia del programa lee igual');
  assert.deepEqual(programa.leerStream(STREAM).limites, esperado);
  assert.equal(programa.leerStream(STREAM).resultado.result, 'Tienes 3 tareas.');
  assert.deepEqual(limitesDelEvento({ basura: 1 }), {});
  const cuentas = [{ email: 'a', usado5h: 80 }, { email: 'b', usado5h: 10 }, { email: 'c', usado5h: 99 }];
  // Rota: tomar siempre la primera → este test falla.
  assert.equal(cuentaConCupo(cuentas)?.email, 'b');
  assert.equal(programa.cuentaConCupo(cuentas)?.email, 'b');
  assert.equal(cuentaConCupo([{ usado5h: 96 }, { usado5h: 99 }]), null, 'todas al tope: ninguna');
  assert.equal(cuentaConCupo([{}])?.usado5h, undefined, 'sin medir, se usa');
});

test('el programa pasa el modelo validado, y encuentra a Claude aunque falte el PATH', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-ola2-'));
  let visto: { cmd: string; args: string[] } | null = null;
  const falso = (cmd: string, args: string[]) => {
    const p = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; stdin: { end: (s: string) => void }; kill: () => void };
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => {};
    p.stdin = { end: () => { visto = { cmd, args }; setImmediate(() => { p.stdout.emit('data', STREAM); p.emit('close', 0); }); } };
    return p;
  };
  const r = await programa.pensar({ dir, system: 's', prompt: 'p', mcp: {}, modelo: 'rm -rf /' }, falso as never, 'C:/x/claude.exe');
  assert.deepEqual(r, { texto: 'Tienes 3 tareas.', uso: { entrada: 9, salida: 6 }, limites: { usado5h: 42, usadoSemana: 98, repone: new Date(1792576200 * 1000).toISOString() } });
  const v = visto as unknown as { cmd: string; args: string[] };
  assert.equal(v.cmd, 'C:/x/claude.exe');
  const i = v.args.indexOf('--model');
  assert.equal(v.args[i + 1], 'sonnet', 'un modelo raro cae a sonnet');
  // La ruta conocida del instalador oficial, si existe; si no, `claude` del PATH.
  assert.match(programa.rutaDeClaude({}, () => true), /[\\/]\.local[\\/]bin[\\/]claude(\.exe)?$/);
  assert.equal(programa.rutaDeClaude({}, () => false), 'claude');
  assert.equal(programa.rutaDeClaude({ MAKO_PC_CLAUDE: 'D:/claude.exe' }, () => true), 'D:/claude.exe');
});

test('el instalador sólo lleva valores validados, y su línea es la del tutorial', () => {
  const urls = { 'windows-x64': 'https://x.supabase.co/storage/v1/object/sign/ia-pc/a.gz?token=abc', 'mac-arm64': 'https://x.supabase.co/a.gz?t=1', 'mac-x64': 'https://x.supabase.co/b.gz?t=1' };
  const win = scriptDeInstalacion({ sistema: 'windows', codigo: 'abc-234', servidor: 'https://hola-mako.com', urls });
  assert.match(win, /Invoke-WebRequest -UseBasicParsing -Uri 'https:\/\/x\.supabase\.co\/storage\/v1\/object\/sign\/ia-pc\/a\.gz\?token=abc'/);
  assert.match(win, /& \$exe emparejar 'ABC234' --servidor 'https:\/\/hola-mako\.com'/, 'el código normalizado');
  assert.match(win, /GZipStream/);
  assert.match(win, /GetFolderPath\('Startup'\)/, 'arranca solo al prender la computadora');
  const mac = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABC234', servidor: 'https://hola-mako.com', urls });
  assert.match(mac, /codesign --force --sign -/, 'en una Mac con chip de Apple, sin firma no corre');
  assert.match(mac, /LaunchAgents\/com\.hola-mako\.pc\.plist/);
  assert.match(mac, /gunzip/);
  // Rota: aceptar lo que venga → este test falla (un código o una URL con comillas cortarían el script).
  assert.throws(() => scriptDeInstalacion({ sistema: 'windows', codigo: "ABC'; rm", servidor: 'https://hola-mako.com', urls }));
  assert.throws(() => scriptDeInstalacion({ sistema: 'windows', codigo: 'ABC234', servidor: 'https://hola-mako.com; rm -rf', urls }));
  assert.throws(() => scriptDeInstalacion({ sistema: 'mac', codigo: 'ABC234', servidor: 'https://hola-mako.com', urls: { ...urls, 'mac-arm64': "https://x/a'; rm -rf ~" } }));
  assert.throws(() => scriptDeInstalacion({ sistema: 'mac', codigo: 'ABC234', servidor: 'http://evil.com', urls }), 'http sólo para localhost');
  assert.equal(lineaDeInstalacion('https://hola-mako.com/', 'windows', 'ABC234'), 'irm "https://hola-mako.com/api/ia-pc/instalar?os=windows&codigo=ABC234" | iex');
  assert.equal(lineaDeInstalacion('https://hola-mako.com', 'mac', 'ABC234'), 'curl -fsSL "https://hola-mako.com/api/ia-pc/instalar?os=mac&codigo=ABC234" | sh');
  const ruta = sinComentarios(leer('app/api/ia-pc/instalar/route.ts'));
  assert.match(ruta, /const codigo = normalizarCodigo\(req\.nextUrl\.searchParams\.get\('codigo'\)\);/);
  assert.match(ruta, /createSignedUrl\(archivoDelPrograma\(a\), 600\)/, 'URL firmadas de 10 minutos, bucket privado');
  assert.doesNotMatch(ruta, /emparejar|crearCodigo|\.update\(|\.insert\(/, 'no gasta el código: lo gasta el programa');
  const publicas = leer('lib/rutas-publicas.ts');
  assert.ok(publicas.includes("'/api/ia-pc/instalar',"), 'pública');
  assert.match(publicas, /PUBLICOS_SOLO_LECTURA = \[[^\]]*'\/api\/ia-pc\/instalar'/, 'y sólo de lectura');
  assert.match(leer('scripts/ia-pc/publicar-binarios.mts'), /createBucket\('ia-pc', \{ public: false \}\)/, 'el bucket es privado');
  // Contra adivinar códigos: tope por IP antes de tocar nada (tests/rutas-publicas-limite.test.ts pide un tope a todas).
  const emp = sinComentarios(leer('app/api/ia-pc/emparejar/route.ts'));
  assert.ok(emp.indexOf("limitePorIp(req, 'ia-pc-emparejar', 10, 10 * 60_000)") > 0 && emp.indexOf('limitePorIp(') < emp.indexOf('await emparejar('));
});

test('«Tus cuentas de IA»: con sesión, cada uno lo suyo, el modelo es del admin, y la pantalla habla de tú', () => {
  for (const r of ['estado', 'desconectar', 'modelo', 'codigo']) {
    assert.match(leer(`app/api/ia-pc/${r}/route.ts`), /personaDelRequest\(\)/, `${r}: con sesión`);
    assert.ok(!leer('lib/rutas-publicas.ts').includes(`'/api/ia-pc/${r}'`), `${r}: no es pública`);
  }
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  // Rota: el miembro ve las de todos → este test falla.
  assert.match(lib, /if \(!esAdmin\) q = q\.eq\('persona', persona\);/);
  assert.match(lib, /return !!data && \(esAdmin \|\| String\(data\.persona\) === persona\);/, 'desconecta la suya, o el admin');
  const desc = sinComentarios(leer('app/api/ia-pc/desconectar/route.ts'));
  assert.ok(desc.indexOf('puedeDesconectar(') > 0 && desc.indexOf('puedeDesconectar(') < desc.indexOf('await desconectar('));
  const modelo = sinComentarios(leer('app/api/ia-pc/modelo/route.ts'));
  assert.match(modelo, /if \(persona\.rol !== 'admin'\)/);
  assert.match(modelo, /\(MODELOS_PC as readonly unknown\[\]\)\.includes\(body\?\.modelo\)/);
  assert.match(sinComentarios(leer('app/api/ia-pc/estado/route.ts')), /\.\.\.\(esAdmin && !d\.esMia \? \{ de: d\.persona \} : \{\}\)/, 'de quién es, sólo para el admin');
  const pantalla = leer('app/integraciones/TusCuentasIA.tsx');
  assert.match(pantalla, /<BotonIntegracion servicio="anthropic"/, 'su clave, con el modal ahí mismo');
  assert.doesNotMatch(sinComentarios(pantalla), /href=["'{`]+\/integraciones/, 'nunca un link que saca de la tab');
  assert.doesNotMatch(pantalla, /\b(tenés|podés|elegí|instalá|iniciá|escribí|pegá|apretá|abrí|conectá|dejala|prendela)\b/i, 'de tú, no de vos');
  assert.match(leer('app/integraciones/page.tsx'), /<TusCuentasIA \/>/);
});
