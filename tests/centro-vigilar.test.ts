// =============================================================================
// `vigilar`: lo que manda Martín sale en SEGUNDOS, no en 2 minutos (Ops Center, 17/10/2026, cartero 1.12.0)
// =============================================================================
// Martín: «Envié un mensaje y no pasó nada por varios segundos... Debería automáticamente comenzar a trabajar». Medido: el
// Runner daba una vuelta cada 2 minutos. Ahora su cron corre `vigilar`: la vuelta completa, una consulta LIVIANA cada
// pocos segundos (`?hay=`, un número) y, apenas hay algo, la vuelta completa y sale. Lo que se fija acá, contra un MaKo de
// mentira, es lo que roto NO da error:
//   · sale apenas aparece un trabajo (no espera al final);
//   · sin nada, no repite la vuelta completa en cada consulta (eso sube chats y turnos cada 4 s);
//   · si la consulta falla, cae a la vuelta completa, no al silencio;
//   · con MaKo lento termina a tiempo (el Bash del Runner corta a los 120 s);
//   · la consulta devuelve SÓLO un número, y sólo con el token del cartero.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 6 pases:
//   · `vigilar` sin la consulta (sólo la vuelta del principio) → 4 fallos;
//   · la vuelta completa en cada consulta, aunque `hay` sea 0 → 2 fallos;
//   · sin caer a la vuelta completa cuando la consulta falla → 1 fallo;
//   · sin mirar si la vuelta entra en el tiempo que queda → 1 fallo;
//   · `hay` contando los «nuevo» sin mirar `abre` → 1 fallo.
//   Restaurado de memoria (no con git checkout): 6 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { armarFirmable, nuevoPayload } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const CARTERO = join(RAIZ, 'scripts/operaciones/cartero.mjs');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const DESTINO = 'cli_11111111-2222-4333-8444-555555555555';

/** Una PC con un chat vivo y un MaKo de mentira que cuenta las vueltas (POST) y las consultas (GET ?hay=). */
async function pc(opciones: { hay: (n: number) => number | 'falla'; pedidoEnVuelta?: number; lento?: number; entreVueltas?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-vigilar-'));
  const cfgDir = join(dir, 'cfg');
  mkdirSync(join(cfgDir, 'sessions'), { recursive: true });
  writeFileSync(join(cfgDir, 'sessions', `${process.pid}.json`), JSON.stringify({
    pid: process.pid, sessionId: DESTINO.slice(4), name: 'CRM', cwd: 'C:\\dev\\x', entrypoint: 'cli', status: 'idle', messagingSocketPath: '\\\\.\\pipe\\LOCAL\\cc-msg-crm',
  }));
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  writeFileSync(join(dir, 'claves.txt'), `${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}\n`);
  const ID = 'aaaaaaaa-0000-4000-8000-0000000000f1';
  const firmado = armarFirmable(nuevoPayload({ id: ID, texto: 'hola', destino: DESTINO, cuenta: 'claude2', titulo: 'CRM', alcance: 'solo_esto' }, Date.now()));
  const pedido = { id: ID, firmado, firma: sign('sha256', Buffer.from(firmado, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64') };
  const cuenta = { vueltas: 0, consultas: 0, urls: [] as string[] };
  const srv = createServer((req, res) => {
    if (req.method === 'GET') {
      cuenta.consultas++;
      cuenta.urls.push(req.url ?? '');
      const h = opciones.hay(cuenta.consultas);
      if (h === 'falla') { res.statusCode = 503; res.end('{}'); return; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ hay: h }));
      return;
    }
    req.resume().on('end', () => {
      cuenta.vueltas++;
      const dar = opciones.pedidoEnVuelta === cuenta.vueltas;
      setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ pedidos: dar ? [pedido] : [], vencidos: 0, acuses: 0, cierres: 0 })); }, opciones.lento ?? 0);
    });
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', () => ok()));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, token: `mkop_${'x'.repeat(30)}`, cwds: ['C:\\dev\\'],
    carteros: { claude2: { fuente: 'cli', configDir: cfgDir } }, carpetas: {},
  }));
  const vigilar = (maxSeg: number) => {
    const t = Date.now();
    return new Promise<{ salida: { entregar: Array<{ id: string }>; vigilo: number; consultas: number }; ms: number }>((ok, mal) => execFile(process.execPath, [CARTERO, 'vigilar', '--cuenta', 'claude2', '--max-seg', String(maxSeg)], {
      env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: cfgDir, CARTERO_VIGILAR_MS: '150', CARTERO_ENTRE_VUELTAS_MS: String(opciones.entreVueltas ?? 30_000) },
    }, (e, so, se) => (e ? mal(new Error(se || e.message)) : ok({ salida: JSON.parse(so), ms: Date.now() - t }))));
  };
  return { cuenta, vigilar, ID, cerrar: () => srv.close() };
}

test('sale a los segundos de aparecer un trabajo, sin esperar al final', async () => {
  // Las dos primeras consultas: nada. La tercera: hay uno, y la segunda vuelta lo trae.
  const x = await pc({ hay: (n) => (n >= 3 ? 1 : 0), pedidoEnVuelta: 2 });
  try {
    const { salida, ms } = await x.vigilar(20);
    assert.deepEqual(salida.entregar.map((e) => e.id), [x.ID]);
    assert.equal(x.cuenta.vueltas, 2, 'una vuelta al empezar y otra cuando hubo algo');
    assert.ok(x.cuenta.consultas >= 3);
    assert.ok(ms < 8000, `salió en ${ms} ms, no a los 20 s`);
  } finally {
    x.cerrar();
  }
});

test('sin nada, consulta liviano y NO repite la vuelta completa', async () => {
  const x = await pc({ hay: () => 0 });
  try {
    const { salida } = await x.vigilar(6);
    assert.deepEqual(salida.entregar, []);
    assert.equal(x.cuenta.vueltas, 1, 'sólo la del principio');
    assert.ok(x.cuenta.consultas >= 3, `consultó ${x.cuenta.consultas} veces`);
    assert.match(x.cuenta.urls[0], /^\/api\/operaciones\/cartero\?hay=claude2&abre=$/);
  } finally {
    x.cerrar();
  }
});

test('si la consulta falla, cae a la vuelta completa (con su espera mínima), no al silencio', async () => {
  const x = await pc({ hay: () => 'falla', pedidoEnVuelta: 2, entreVueltas: 400 });
  try {
    const { salida } = await x.vigilar(5);
    assert.deepEqual(salida.entregar.map((e) => e.id), [x.ID], 'lo trajo la vuelta completa');
  } finally {
    x.cerrar();
  }
});

test('si `hay` dice que sí y la vuelta no reclama nada, no da una vuelta en cada consulta', async () => {
  const x = await pc({ hay: () => 1, entreVueltas: 1000 });
  try {
    await x.vigilar(8);
    // Consulta cada 150 ms durante ~5 s: sin la espera entre vueltas serían ~30; con ella, una por segundo como mucho.
    assert.ok(x.cuenta.vueltas >= 2 && x.cuenta.vueltas <= 7, `dio ${x.cuenta.vueltas} vueltas`);
  } finally {
    x.cerrar();
  }
});

test('con MaKo lento termina a tiempo: no arranca una vuelta que no entra', async () => {
  const x = await pc({ hay: () => 1, lento: 1500, entreVueltas: 0 });
  try {
    const { ms } = await x.vigilar(3);
    assert.ok(ms < 4500, `terminó en ${ms} ms con un tope de 3 s y vueltas de 1,5 s`);
    assert.equal(x.cuenta.vueltas, 1, 'la segunda vuelta no entraba');
  } finally {
    x.cerrar();
  }
});

// EL BUG DE LAS 0 CONSULTAS (1.15.1, 17/10/2026). El Runner: tres `vigilar --max-seg 100` seguidos sin una consulta liviana, el
// último de 78 s. La guarda pedía que entrara una consulta MÁS una vuelta completa ×1,5 con `dura` la de la primera vuelta (la
// que sube los chats de cada cuenta de la carpeta, 30-80 s): el bucle no corría nunca. Contra un MaKo lento (vueltas de 2,5 s y
// un tope de 6 s) se reproduce igual.
// Probado ROMPIÉNDOLO (17/10/2026, base en 9 pases): la guarda de antes (`ahora() + CADA_VIGILAR_MS + dura * 1.5 > fin`) → 2
// fallos (0 consultas en el primero; el segundo sale al final sin `otraVez`); `otraVez` sin la base (cualquier `hay` > 0) → 1
// fallo (el pendiente trabado).
test('con la primera vuelta lenta, IGUAL consulta liviano: el bug de las 0 consultas', async () => {
  const x = await pc({ hay: () => 0, lento: 2500 });
  try {
    const { salida } = await x.vigilar(6);
    assert.ok(salida.consultas >= 3, `consultó ${salida.consultas} veces`);
    assert.equal(x.cuenta.vueltas, 1);
  } finally {
    x.cerrar();
  }
});

test('si llega algo nuevo y la vuelta completa no entra, sale YA con `otraVez` (el Runner lo corre de nuevo)', async () => {
  const x = await pc({ hay: (n) => (n >= 3 ? 1 : 0), lento: 2500 });
  try {
    const { salida, ms } = await x.vigilar(6);
    assert.equal((salida as { otraVez?: boolean }).otraVez, true);
    assert.ok(ms < 4800, `salió a los ${ms} ms, no al final`);
    assert.equal(x.cuenta.vueltas, 1, 'la segunda no entraba: la da el próximo vigilar');
  } finally {
    x.cerrar();
  }
});

test('un pendiente que esta PC no reclama no hace correr al Runner sin parar', async () => {
  const x = await pc({ hay: () => 1, lento: 2500 });
  try {
    const { salida } = await x.vigilar(6);
    assert.equal((salida as { otraVez?: boolean }).otraVez, undefined, 'ya estaba antes de la primera consulta: no es nuevo');
  } finally {
    x.cerrar();
  }
});

test('la consulta devuelve sólo un número, con el token, y los «nuevo» sólo de quien abre; el Runner corre `vigilar`', async () => {
  const ruta = sinComentarios(leer('app/api/operaciones/cartero/route.ts'));
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  assert.ok(get.indexOf('tokenDelCarteroValido') < get.indexOf("q.has('hay')"), 'el token antes');
  assert.match(get, /return NextResponse\.json\(\{ hay \}/, 'sólo el número');
  const lib = sinComentarios(leer('lib/operaciones.ts'));
  const hay = lib.slice(lib.indexOf('export async function hayParaElCartero'), lib.indexOf('export async function tokenDelCarteroValido'));
  assert.match(hay, /const abren = validas\.filter\(\(c\) => abre\.includes\(c\)\);/);
  assert.match(hay, /\.eq\('destino', DESTINO_NUEVO\)\.in\('destino_cuenta', abren\)/);
  assert.doesNotMatch(hay, /\.(update|insert|upsert|delete)\(/, 'no escribe nada');
  const { INSTRUCCIONES_RUNNER, COMANDO_RUNNER } = await import('../lib/runner');
  assert.ok(INSTRUCCIONES_RUNNER.includes(`${COMANDO_RUNNER} vigilar --max-seg 100`));
  assert.match(INSTRUCCIONES_RUNNER, /otraVez: true`.*córrelo de nuevo en el acto/, 'el Runner sabe qué hacer con `otraVez`');
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(cartero.TOPE_VIGILAR_SEG <= 105, 'bajo los 120 s del Bash, con margen');
});
