// =============================================================================
// Abrir un chat de terminal con un clic: lo que la PC abre y con qué (Ops Center, 17/10/2026)
// =============================================================================
// Martín: «un clic + el permiso de la PC», nunca pegar un comando en PowerShell (docs/diseno-nuevo-chat-un-clic.md, con
// la medición del 17/10). Un trabajo firmado con `destino: 'nuevo'` lo deja `ciclo` en la cola de aperturas, y `abrir`
// escribe un `.cmd` con `powershell.exe -EncodedCommand` y lo abre con el Explorador. Es abrir un proceso en la PC a
// partir de un trabajo remoto, así que lo que se fija acá es lo que pidió la revisión de seguridad del Cerebro:
//   1. el `.cmd` y el comando se arman SÓLO con valores que pasan una lista blanca (la cuenta, el nombre, la ruta);
//   2. el texto del primer mensaje nunca toca la línea de comandos (va a un archivo);
//   3. la firma se vuelve a verificar en `abrir`, sobre el mismo texto que se usa;
// y además: sin el permiso local no se abre nada, y un trabajo no se abre dos veces.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 6 pases:
//   · el nombre con la regla de antes («sin comillas dobles» y nada más) → 1 fallo;
//   · comandoDeApertura sin validar la cuenta → 1 fallo;
//   · el primer mensaje como argumento (`(Get-Content -Raw …)` en el comando) → 2 fallos (el del comando y el de punta a punta);
//   · `abrir` sin volver a verificar la firma → 1 fallo;
//   · `abrir` sin mirar el permiso local → 1 fallo;
//   · `abrir` sin su registro de lo ya abierto → 1 fallo;
//   · el servidor reclamando un «nuevo» sin mirar `abre` → 1 fallo.
//   Restaurado de memoria (no con git checkout): 6 pases.
// Lo que el test NO ve: la ventana de verdad (el abridor es un registrador; la medición con el Explorador está en
// docs/hallazgos-operaciones.md, «El clic, medido»).

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { DESTINO_NUEVO, armarFirmable, leerFirmable, nuevoPayload, problemaDeNombreNuevo, sanearAbre } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const NOMBRES_BUENOS = ['CRM', 'CRM › Lead Detail', 'Ops Center', 'Año 2026 (prueba)', 'Pagos: cobros-v2', 'Web Generator_3', 'Ñandú + Martín'];
const NOMBRES_MALOS = [
  '', ' CRM', 'CRM ', 'CRM"', 'CRM\'', "O'Brien", '`CRM`', 'CRM; Remove-Item C:\\', 'CRM & calc', 'CRM | calc', '$(calc)', '${env:PATH}',
  '-n x', '--dangerously-skip-permissions', 'CRM\nOtro', 'CRM\r', 'a'.repeat(81), 'CRM%PATH%', 'CRM<x', 'C:\\Windows', '«CRM»', 'CRM\u202e',
];

test('el nombre de un chat nuevo va por una LISTA BLANCA, igual en MaKo y en la PC', async () => {
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  for (const n of NOMBRES_BUENOS) {
    assert.equal(problemaDeNombreNuevo(n), null, `«${n}» vale`);
    assert.equal(cartero.problemaDeNombreNuevo(n), null, `«${n}» vale en la PC`);
  }
  for (const n of NOMBRES_MALOS) {
    assert.equal(problemaDeNombreNuevo(n), 'nombre inválido', `«${n}» no vale`);
    assert.equal(cartero.problemaDeNombreNuevo(n), 'nombre inválido', `«${n}» no vale en la PC`);
  }
  // Y adentro del texto firmado, los dos lo leen igual.
  const AHORA = Date.now();
  const base = { id: '6b2b7d32-9a51-4e43-9a43-2f3a4b5c6d7e', texto: 'Hola', destino: DESTINO_NUEVO, cuenta: 'claude2', titulo: 'CRM', alcance: 'solo_esto' as const };
  const variantes: Array<[string, Record<string, unknown>]> = [
    ['el bueno', {}], ['sin cuenta', { cuenta: null }], ['con comillas', { titulo: 'CRM"' }], ['sin nombre', { titulo: null }],
    ['con adjuntos', { adjuntos: [] }], ['otro destino', { destino: 'abrir' }],
  ];
  let buenos = 0;
  for (const [nombre, cambio] of variantes) {
    const texto = JSON.stringify({ ...JSON.parse(armarFirmable(nuevoPayload(base, AHORA))), ...cambio });
    const a = leerFirmable(texto, AHORA);
    const b = cartero.leerFirmable(texto, AHORA) as { ok: boolean; motivo?: string };
    assert.equal(b.ok, a.ok, `${nombre}: servidor ${a.ok}, PC ${b.ok}`);
    if (!a.ok) assert.equal(b.motivo, a.motivo, `${nombre}: motivos distintos`);
    else buenos++;
  }
  assert.equal(buenos, 1);
});

test('el comando y el .cmd se arman SÓLO con valores validados, y el .cmd no lleva texto de nadie', async () => {
  const { comandoDeApertura, archivoCmd } = await import('../scripts/operaciones/cartero.mjs');
  const RUTA = 'C:\\Users\\marti\\.claude\\operaciones\\aperturas\\6b2b7d32-9a51-4e43-9a43-2f3a4b5c6d7e.txt';
  const cmd = comandoDeApertura('claude2', 'CRM › Lead Detail', RUTA);
  assert.equal(cmd, `claude2 -n 'CRM › Lead Detail' 'Lee el archivo ${RUTA} y haz lo que dice: es el primer mensaje de Martín.'`);
  for (const c of ['claude2; calc', 'claude', 'Claude2', 'claude2 ', 'powershell', '']) assert.throws(() => comandoDeApertura(c, 'CRM', RUTA), /cuenta inválida/, c);
  for (const n of NOMBRES_MALOS) assert.throws(() => comandoDeApertura('claude2', n, RUTA), /nombre inválido/, n);
  for (const r of ['C:\\Users\\Mi Usuario\\x.txt', "C:\\a'b.txt", 'C:\\a.txt"', '\\\\server\\x.txt', 'C:\\a.cmd', 'x.txt', 'C:\\a.txt & calc'])
    assert.throws(() => comandoDeApertura('claude2', 'CRM', r), /ruta inválida/, r);

  const archivo = archivoCmd(cmd);
  const m = /^@echo off\r\npowershell\.exe -NoExit -EncodedCommand ([A-Za-z0-9+/]+={0,2})\r\n$/.exec(archivo);
  assert.ok(m, 'el .cmd tiene dos renglones fijos y un base64');
  assert.equal(Buffer.from(m[1], 'base64').toString('utf16le'), cmd, 'el base64 es exactamente el comando validado');
});

/** Una PC de prueba: su carpeta, una clave de firma, un MaKo de mentira que da los trabajos, y un abridor que anota. */
async function pc(opciones: { abrir: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-abrir-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const firmar = (t: string) => sign('sha256', Buffer.from(t, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const registro = join(dir, 'abiertos.jsonl');
  const registrador = join(dir, 'registrador.mjs');
  writeFileSync(registrador, "import fs from 'node:fs'; fs.appendFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)) + '\\n');\n");
  let pedidos: unknown[] = [];
  const recibido: Array<{ abre?: string[] }> = [];
  const srv = createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }).on('end', () => {
      recibido.push(JSON.parse(b));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ pedidos, vencidos: 0, acuses: 0, cierres: 0 }));
      pedidos = [];
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  const config = (abrir: boolean) => writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'],
    carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {}, abrir,
  }));
  config(opciones.abrir);
  writeFileSync(join(dir, 'claves.txt'), `${spki}\n`);
  const correr = (args: string[]) => new Promise<string>((ok, mal) => execFile(process.execPath, [CARTERO, ...args], {
    env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir, CARTERO_ABRIDOR: JSON.stringify([process.execPath, registrador, registro]) },
  }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok(so))));
  const trabajo = (id: string, texto: string, titulo = 'CRM › Lead Detail', cuenta = 'claude2') => {
    const firmado = armarFirmable(nuevoPayload({ id, texto, destino: DESTINO_NUEVO, cuenta, titulo, alcance: 'solo_esto' }, Date.now()));
    return { id, firmado, firma: firmar(firmado) };
  };
  return {
    dir, recibido, registro, config, correr, trabajo, cerrar: () => srv.close(),
    dar: (xs: unknown[]) => { pedidos = xs; },
    abiertos: () => (existsSync(registro) ? readFileSync(registro, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as string[]) : []),
    acuse: (id: string) => JSON.parse(readFileSync(join(dir, 'claude2', 'acuses', `${id}.json`), 'utf8')) as { estado: string; motivo: string },
  };
}

// Lo que alguien pondría para que el primer mensaje termine siendo una opción o un comando.
const VENENO = 'Hola " --dangerously-skip-permissions " \'; Remove-Item -Recurse C:\\ ; $(calc) `calc` & calc | calc\r\n%PATH%';

test('de punta a punta: el primer mensaje va a un archivo, nunca a la línea de comandos', async () => {
  const x = await pc({ abrir: true });
  try {
    const ID = 'aaaaaaaa-0000-4000-8000-0000000000d1';
    x.dar([x.trabajo(ID, VENENO)]);
    const vuelta = JSON.parse(await x.correr(['ciclo', '--cuenta', 'claude2'])) as { aperturas: number };
    const enCola = readFileSync(join(x.dir, 'aperturas', `${ID}.json`), 'utf8');
    assert.deepEqual(x.recibido[0].abre, ['claude2'], 'la PC declara la cuenta que abre');
    assert.equal(vuelta.aperturas, 1, '`ciclo` no abre: lo deja en la cola');
    assert.deepEqual(x.abiertos(), [], 'nada se abrió en la vuelta');

    const salida = JSON.parse(await x.correr(['abrir'])) as Array<{ id: string; estado: string; motivo: string }>;
    assert.equal(salida[0].estado, 'entregado');
    assert.match(salida[0].motivo, /^Se pidió abrir «CRM › Lead Detail» en la terminal de la cuenta 2/);
    const cmd = join(x.dir, 'aperturas', `${ID}.cmd`);
    assert.deepEqual(x.abiertos(), [[cmd]], 'al abridor le llega SÓLO la ruta del .cmd');
    assert.equal(readFileSync(join(x.dir, 'aperturas', `${ID}.txt`), 'utf8'), VENENO, 'el primer mensaje, tal cual, en su archivo');
    const b64 = /-EncodedCommand ([A-Za-z0-9+/=]+)/.exec(readFileSync(cmd, 'utf8'))![1];
    const comando = Buffer.from(b64, 'base64').toString('utf16le');
    for (const pedazo of ['dangerously', 'Remove-Item', 'calc', '%PATH%', 'Hola']) assert.ok(!comando.includes(pedazo), `«${pedazo}» no llega al comando`);
    assert.ok(!/\$\(|`|Get-Content/.test(comando), 'el comando no lee ni expande nada');
    assert.equal(x.acuse(ID).estado, 'entregado');

    // Una segunda vez el mismo id: MaKo lo devuelve otra vez, y alguien lo repone en la cola. No se abre dos veces.
    x.dar([x.trabajo(ID, 'otra vez')]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    writeFileSync(join(x.dir, 'aperturas', `${ID}.json`), enCola);
    await x.correr(['abrir']);
    assert.equal(x.abiertos().length, 1, 'una sola ventana');
    assert.match(x.acuse(ID).motivo, /no se abre dos veces/);
  } finally {
    x.cerrar();
  }
});

test('`abrir` vuelve a verificar la firma sobre el mismo texto que usa', async () => {
  const x = await pc({ abrir: true });
  try {
    const ID = 'aaaaaaaa-0000-4000-8000-0000000000d2';
    const OTRO = 'aaaaaaaa-0000-4000-8000-0000000000d3';
    x.dar([x.trabajo(ID, 'hola'), x.trabajo(OTRO, 'chau')]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    // Alguien con acceso a la carpeta cambia el texto de una apertura (otro nombre), y a la otra le pone el texto firmado
    // de OTRO trabajo: la firma es buena, pero no es la de ese id.
    const fA = join(x.dir, 'aperturas', `${ID}.json`);
    const a = JSON.parse(readFileSync(fA, 'utf8'));
    writeFileSync(fA, JSON.stringify({ ...a, firmado: a.firmado.replace('CRM › Lead Detail', 'Otro nombre') }));
    const fB = join(x.dir, 'aperturas', `${OTRO}.json`);
    const otroFirmado = x.trabajo('aaaaaaaa-0000-4000-8000-0000000000d4', 'x');
    writeFileSync(fB, JSON.stringify({ ...JSON.parse(readFileSync(fB, 'utf8')), firmado: otroFirmado.firmado, firma: otroFirmado.firma }));
    await x.correr(['abrir']);
    assert.deepEqual(x.abiertos(), [], 'no se abrió ninguno');
    assert.match(x.acuse(ID).motivo, /Pégale tu Token/);
    assert.match(x.acuse(OTRO).motivo, /no coincide con la firma/);
    assert.deepEqual(readdirSync(join(x.dir, 'aperturas')).filter((n) => /\.(cmd|txt)$/.test(n)), [], 'ni el .cmd ni el .txt se escribieron');
  } finally {
    x.cerrar();
  }
});

test('sin el permiso local de la PC no se abre nada, y el permiso se apaga', async () => {
  const x = await pc({ abrir: false });
  try {
    const ID = 'aaaaaaaa-0000-4000-8000-0000000000d5';
    // MaKo mintiendo: le da un «nuevo» a una PC que no lo declaró.
    x.dar([x.trabajo(ID, 'hola')]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    assert.deepEqual(x.recibido[0].abre, [], 'sin el permiso no declara nada');
    assert.match(x.acuse(ID).motivo, /Prende la apertura de chats/);
    assert.deepEqual(x.abiertos(), []);

    // Con el permiso, entra a la cola; si se apaga antes de `abrir`, tampoco se abre.
    await x.correr(['abrir-permitir']);
    const ID2 = 'aaaaaaaa-0000-4000-8000-0000000000d6';
    x.dar([x.trabajo(ID2, 'hola')]);
    await x.correr(['ciclo', '--cuenta', 'claude2']);
    assert.deepEqual(x.recibido[1].abre, ['claude2']);
    await x.correr(['abrir-permitir', 'off']);
    await x.correr(['abrir']);
    assert.deepEqual(x.abiertos(), []);
    assert.match(x.acuse(ID2).motivo, /Prende la apertura de chats/);
  } finally {
    x.cerrar();
  }
});

test('MaKo le da un chat nuevo sólo al cartero que dice que lo abre, y las instrucciones del Runner lo saben correr', async () => {
  assert.deepEqual(sanearAbre(['claude2', 'claude2', 'x', 3, 'claude12']), ['claude2', 'claude12']);
  const lib = sinComentarios(leer('lib/operaciones.ts'));
  const ciclo = lib.slice(lib.indexOf('export async function cicloCartero'));
  assert.match(ciclo, /if \(sanearAbre\(e\.abre\)\.includes\(cuenta\)/, 'sólo con `abre`');
  assert.match(ciclo, /\.eq\('destino', DESTINO_NUEVO\)\.eq\('destino_cuenta', cuenta\)/, 'y sólo los de SU cuenta');
  const { INSTRUCCIONES_RUNNER, COMANDO_RUNNER } = await import('../lib/runner');
  assert.ok(INSTRUCCIONES_RUNNER.includes(`${COMANDO_RUNNER} abrir\``) && INSTRUCCIONES_RUNNER.includes(`${COMANDO_RUNNER} abrir-permitir`));
});
