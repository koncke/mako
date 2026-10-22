// =============================================================================
// La IA del cliente: lo que pidió la TERCERA revisión del Cerebro sobre af8f42baf (21/10/2026)
// =============================================================================
// La nota («revision-ia-cliente-v3-21-10.md», side-session-notes) cerró el alto 1 y los medios 5 y 6, y confirmó cuatro
// medias y tres bajas. Lo que fija este archivo (la guarda de las rutas y el cron del AI Analyst, en tests/d6b-rutas.test.ts):
//   1. «SU IA» SON SUS CLAVES PROPIAS: una copia de la de la plataforma (el ws1) no cuenta; una guardada e ilegible sí
//      (falla cerrada), y también si la de la plataforma no se puede leer;
//   2. REINSTALAR NO ABRE D6b: confirmar la nueva con el token de la de antes le pasa la activación ANTES de soltarla;
//   3. CERRAR LA VENTANA NO DEJA LA PC APAGADA: el instalador la prende antes de la sesión, y la purga no da de baja una
//      confirmada que todavía no latió;
//   4. SIN LA MIG 0322, un negocio sin ninguna PC registrada no pasa a «sólo su IA» (antes: todos sin IA);
//   y el código recién usado sin su PC anotada es «eligiendo», no «se usó sin conectar».
// Todo lo de la base, CORRIDO contra un PostgREST de mentira (tests/_ia-pc-tercera-hijo.ts).
//
// PROBADO ROMPIÉNDOLO (21/10/2026, una por vez, restaurada con sha256; base 8 / 0): 24 roturas, todas con su rojo —
// contar las copias · la ilegible no cuenta · saltear la de la plataforma ilegible · sin las cuentas extra · la copia con
// espacios · tirar con el error de esquema (negocioConPc y pcDe) · sin 0322 «no» aunque tenga PC · confirmar sin pasar la
// activación, o pasándola sin mirar persona, negocio o si estaba activa · la ruta o el programa sin la de antes · soltar
// antes de guardar · la purga con las confirmadas · la lista que las esconde · el código recién usado «cancelado» · el
// 503 que pide la misma línea · Windows: parar antes de confirmar, prender sólo en el finally, el finally que prende
// otro · Mac: cargar sólo en el trap, descargar antes de confirmar. Restaurado: 8 / 0.
//
// Correr: npx tsx --test tests/ia-pc-tercera-revision.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { scriptDeInstalacion } from '../lib/ia-pc-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const URLS = { 'windows-x64': 'https://x.supabase.co/a.gz?t=1', 'mac-arm64': 'https://x.supabase.co/b.gz?t=1', 'mac-x64': 'https://x.supabase.co/c.gz?t=1' };
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const NO = { suIA: false, conPc: false };
const SI = { suIA: true, conPc: false };

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-pc-tercera-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const V = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, unknown> & {
  error?: string; claves: Record<string, unknown>; sin0322: Record<string, unknown>;
};

test('«su IA» son sus claves PROPIAS: la copia de la plataforma no cuenta; la ilegible sí (falla cerrada)', () => {
  assert.equal(V.error, undefined, String(V.error));
  // Rota: contar cualquier fila que se lea → este test falla (el ws1, con copias de MaKo, perdía Buscar y El Archivero).
  assert.deepEqual(V.claves.copiaDelWs1, NO, 'una copia de la OpenAI de MaKo no es «su IA»');
  assert.deepEqual(V.claves.copiaDeLaSegundaCuenta, NO, 'tampoco una copia de su SEGUNDA cuenta, ni con espacios');
  // Rota: tratar la ilegible como «no tiene» → este test falla (con el secreto rotado, su Ops Center volvía a Gemini).
  assert.deepEqual(V.claves.ilegible, SI, 'guardada e ilegible: es suya');
  assert.deepEqual(V.claves.propia, SI);
  assert.deepEqual(V.claves.placeholder, NO, 'un «PENDING…» no es una clave');
  assert.deepEqual(V.claves.plataforma, NO, 'la plataforma misma queda afuera');
  // IA6 (revisión): la falla cerrada dice que es INCIERTA, para que la puerta de D6b no la recuerde 60 s.
  assert.deepEqual(V.plataformaIlegible, { ...SI, incierto: true }, 'sin poder leer la de la plataforma, no se sabe si es copia: falla cerrada');
});

test('sin la mig 0322, un negocio sin ninguna PC registrada sigue con su IA de siempre (no todos sin IA)', () => {
  // Rota: tirar con el 42703 → este test falla (la falla cerrada pasaba a «sólo su IA» a TODOS los negocios sin clave).
  assert.deepEqual(V.sin0322.sinPcNiClave, NO);
  assert.deepEqual(V.sin0322.conPcRegistrada, { suIA: true, conPc: true }, 'con una PC registrada no se sabe si está activa: falla cerrada');
  assert.deepEqual(V.sin0322.conSuOpenAI, SI);
  assert.equal(V.sin0322.pcDe, null, 'la PC de la persona: «sin PC», no un error en cada turno');
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  assert.match(lib, /\['42703', '42P01', 'PGRST204', 'PGRST205'\]/);
  // Sólo el error de ESQUEMA: cualquier otro sigue tirando.
  const neg = lib.slice(lib.indexOf('export async function negocioConPc('), lib.indexOf('export async function desconectar('));
  assert.match(neg, /if \(esErrorDeEsquema\(r\.error\)\) \{[\s\S]*\}\s*const data = sinError\(r, 'las PC del negocio'\);/);
});

test('reinstalar no abre D6b: la activación pasa a la nueva al confirmarla, antes de soltar la de antes', () => {
  // [antes, tras confirmar la nueva, tras soltar la vieja]
  assert.deepEqual(V.conAnterior, [true, true, true]);
  assert.equal(V.sinAnterior, false, 'el control: sin pasar la de antes, el negocio salía de «sólo su IA»');
  // Rota: pasar la activación sin mirar de quién era la de antes → este test falla.
  assert.deepEqual(V.anteriorAjena, { deOtraPersona: false, deOtroNegocio: false, noActiva: false });
  assert.match(sinComentarios(leer('app/api/ia-pc/confirmar/route.ts')), /ok = await confirmar\(d, body\?\.anterior\)/);
});

test('la purga no da de baja una PC confirmada que todavía no latió, y la lista la muestra', () => {
  assert.deepEqual(V.purga, { turnos: 0, codigos: 0, abandonadas: 1 });
  // Rota: revocar las que no latieron (sin mirar `confirmado_at`) → este test falla (la de las 03:40 la daba de baja).
  assert.deepEqual(V.trasLaPurga, { confirmadaSigue: true, pendienteRevocada: true, listada: 1 });
});

test('el código recién usado, sin su PC anotada todavía, es «eligiendo» (la ventana está preguntando)', () => {
  assert.equal(V.recienUsado, 'eligiendo');
  assert.equal(V.usadoHaceDos, 'cancelado');
  assert.match(sinComentarios(leer('app/api/ia-pc/emparejar/route.ts')), /pide otro código en MaKo y pega la línea nueva/);
});

// ── El instalador: prende antes de la sesión, y confirma con lo de antes corriendo ────────────────────────────────

test('Windows: confirma con lo de antes corriendo, y PRENDE el programa antes de la sesión (cerrar la ventana no lo apaga)', () => {
  const win = scriptDeInstalacion({ sistema: 'windows', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  const i = (s: string) => { const n = win.indexOf(s); assert.ok(n >= 0, `falta: ${s}`); return n; };
  // Rota: confirmar después de parar lo de antes → este test falla (un 503 dejaba la PC sin programa).
  assert.ok(i('& $nuevo confirmar') < i('Kill()'), 'confirma ANTES de parar lo que corre');
  // Rota: prender recién en el `finally` → este test falla (WM_CLOSE durante el login no corre el `finally`).
  const prende = win.indexOf('  Start-Process -FilePath $exe');
  assert.ok(prende > i('New-ItemProperty') && prende < i('} finally {'), 'se prende adentro del try, con el arranque ya puesto');
  assert.ok(prende < i('& $exe sesion'), 'antes de la sesión y del login');
  assert.ok(i('} finally {') < i('& $exe sesion'), 'la sesión, afuera del try');
  // Rota: el `finally` que prende sin mirar → este test falla (dos programas tomando turnos).
  assert.match(win, /if \(\(Test-Path \$exe\) -and -not \(Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue\)\) \{ Start-Process -FilePath \$exe \}/);
});

test('Mac: confirma con el agente cargado, y lo CARGA antes de la sesión', () => {
  const mac = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  const i = (s: string) => { const n = mac.indexOf(s); assert.ok(n >= 0, `falta: ${s}`); return n; };
  assert.ok(i('"$D/mako-pc.nuevo" confirmar') < i('launchctl unload'));
  // Rota: cargarlo sólo en el `trap` → este test falla (cerrar la terminal durante el login lo dejaba descargado).
  const carga = mac.indexOf('\nlaunchctl load "$P" 2>/dev/null || true\n');
  assert.ok(carga > mac.lastIndexOf('\nPLIST\n') && carga < i('"$D/mako-pc" sesion'), 'se carga con el plist escrito, antes de la sesión y del login');
});

// ── El programa: manda la de antes al confirmar, y guarda la nueva ANTES de soltarla ─────────────────────────────

test('el programa confirma con el token de la de antes, guarda la nueva, y RECIÉN DESPUÉS suelta la de antes', async () => {
  const VIEJO = `mkopc_${'V'.repeat(43)}`;
  const NUEVO = `mkopc_${'N'.repeat(43)}`;
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-r3-'));
  const pedidos: Array<{ ruta: string; cuerpo: unknown; tokenGuardado: unknown }> = [];
  const servidor = http.createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as { token?: string };
      pedidos.push({ ruta: new URL(req.url ?? '/', 'http://x').pathname, cuerpo: b ? JSON.parse(b) : null, tokenGuardado: cfg.token });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ servidor: url, token: VIEJO, pendiente: { servidor: url, token: NUEVO, nombre: 'PC', negocio: 'Prueba', persona: 'ana' } }));
  const p = spawn(process.execPath, [join(RAIZ, 'scripts', 'ia-pc', 'mako-pc.mjs'), 'confirmar'], { env: { ...process.env, MAKO_PC_DIR: dir, MAKO_PC_SIN_ARRANQUE: '1' }, stdio: 'ignore' });
  let fin: number | null = null;
  p.on('exit', (c) => { fin = c; });
  for (let n = 0; n < 80 && fin === null; n++) await dormir(100);
  await new Promise<void>((ok) => servidor.close(() => ok()));
  assert.equal(fin, 0);
  // Rota: confirmar sin la de antes → este test falla (MaKo no puede pasarle la activación).
  assert.deepEqual(pedidos[0], { ruta: '/api/ia-pc/confirmar', cuerpo: { anterior: VIEJO }, tokenGuardado: VIEJO });
  // Rota: soltar antes de guardar → este test falla (el programa viejo, con el 401, borraba la conexión nueva).
  assert.deepEqual(pedidos[1], { ruta: '/api/ia-pc/soltar', cuerpo: null, tokenGuardado: NUEVO });
});
