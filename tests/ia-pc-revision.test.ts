// =============================================================================
// La IA del cliente: lo que pidió la revisión adversarial del Cerebro sobre b93a280f1 (21/10/2026)
// =============================================================================
// La nota de la revisión (side-session-notes, «revision-ia-cliente-21-10.md») encontró que la pieza andaba en el camino
// feliz y se rompía en los demás. Lo que fija este archivo, un bloque por hallazgo:
//   1. EL ARRANQUE (alto): sin .vbs (Defender lo ponía en cuarentena como troyano); la clave Run de HKCU, en Unicode; el
//      programa «de ventana»; en la Mac, launchd no relanza una PC desconectada;
//   2. EL CUPO (alto): una cuenta que pasó el 95 % vuelve a servir cuando la ventana se repone;
//   3. LA SESIÓN (alto): «en línea» es un Claude CON sesión; el paso 3 con la ruta completa; el programa la vuelve a mirar;
//   4. EL 401 (alto): un error de la base es 503 y el programa reintenta; sólo se apaga con un 401 `revocado` — y eso se
//      prueba CORRIENDO el programa contra un servidor de mentira, como lo vivía una PC de verdad;
//   5. SIN RED (medio): el programa espera (antes ~1000 pedidos por segundo), también corrido de verdad;
//   6. y los bajos: EPIPE, la PC que se apaga a mitad del turno, el plazo de la ruta, el cupo que se dice, su clave que
//      falla, el MCP de más de 60 s, desconectar que corta el turno, la conexión que no se pisa en silencio, el código que
//      vence, la tarjeta fantasma, la limpieza de los turnos, el tope por negocio y el del código.
// D6b (por negocio, falla cerrada) está en tests/solo-su-ia.test.ts.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, arnés del scratchpad `romper-revision.mjs`: una rotura por vez, restaurada y comprobada
// con sha256; base 14 / 0). Treinta y seis roturas, todas con su rojo: el .vbs de Inicio · emparejar sin `| Out-Host` ·
// conectar sin preguntar · KeepAlive en true · la pregunta leyendo del script · publicar sin marcarlo «de ventana» · Claude
// sin windowsHide · el cupo sin mirar `repone` (servidor y PC) · todas al tope, ninguna · el % de una ventana repuesta ·
// el tope sin reconocer · el tope dicho como sesión · en línea sin sesión · «escribe claude» · «¡Listo!» sin sesión · el
// latido sin mirar la sesión · cualquier 401 apaga · desconectada sin borrar su token (12 / 2) · sin red, sin espera · un
// error de base como 401 · la PC del token sin mirar el error · la espera sin mirar el latido · 240 s fijos · su clave sin
// crédito como bug · «Conectar» abriendo Gemini · desconectar sin cortar el turno · el token del turno sin mirar su PC ·
// el MCP que dice «no se corrió» y la corre · emparejar pisando · el código viejo vivo · sin tope por negocio · la purga sin
// agendar · instalar con un 400 · la clave de API para un closer → cada una 13 / 1. Y EPIPE sin escucha: el 'error' tira
// el proceso del test entero, que es lo que protege. Restaurado: 14 / 0.
//
// Correr: npx tsx --test tests/ia-pc-revision.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  AVISO_PC_APAGADA, AVISO_PC_MUCHOS, AVISO_PC_SIN_SESION, ESPERA_RESPUESTA_MS, MARGEN_RUTA_MS, avisoDeLaPc, avisoTope, cuentaConCupo,
  esperaDelTurno, estadoDeLaPc, falloDeClaude, marcarDeVentana, pcUsable, respuestaSinPc, scriptDeInstalacion, subsistemaPe, yaPaso,
} from '../lib/ia-pc-reglas';
import { esDeConfiguracion } from '../lib/errores-app-reglas';
import { AVISO_SU_CLAVE, falloDeSuClave, iaParaConectar } from '../lib/mako-turno-app-reglas';
import * as programa from '../scripts/ia-pc/mako-pc.mjs';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const URLS = { 'windows-x64': 'https://x.supabase.co/a.gz?t=1', 'mac-arm64': 'https://x.supabase.co/b.gz?t=1', 'mac-x64': 'https://x.supabase.co/c.gz?t=1' };
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// ── 1. El arranque ───────────────────────────────────────────────────────────

test('Windows: el arranque es la clave Run (nada en Inicio), cada llamada al programa se espera, y se pregunta «¿es tu negocio?»', () => {
  const win = scriptDeInstalacion({ sistema: 'windows', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  // Rota: volver al MaKo.vbs de Inicio → este test falla (Defender: «Trojan:VBS/AgentTesla», medido el 21/10/2026).
  assert.doesNotMatch(win, /WScript|Set-Content|-Encoding ASCII/, 'nada de .vbs ni de texto en ASCII');
  assert.match(win, /New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MaKo' -Value \('"' \+ \$exe \+ '"'\) -PropertyType String -Force/);
  assert.match(win, /Remove-Item -Force \(Join-Path \(\[Environment\]::GetFolderPath\('Startup'\)\) 'MaKo\.vbs'\)/, 'lo de la 0.2.0 se saca de Inicio');
  // El programa es «de ventana»: sin `| Out-Host`, PowerShell no lo espera y $LASTEXITCODE no es suyo (medido).
  const llamadas = win.split('\n').filter((l) => /& \$(exe|nuevo) /.test(l));
  assert.ok(llamadas.length >= 5);
  for (const l of llamadas) assert.match(l, /& \$(exe|nuevo) [^|]*\| Out-Host/, `sin Out-Host: ${l}`);
  // Rota: conectar sin preguntar → este test falla (el código de otro negocio se llevaba su suscripción en silencio).
  assert.match(win, /Read-Host '¿Es tu negocio\?/);
  assert.match(win, /if \(\$si -notmatch '\^\\s\*\[sS\]'\) \{ & \$nuevo cancelar \| Out-Host;/);
  assert.ok(win.indexOf('& $nuevo confirmar') > win.indexOf('Read-Host'), 'confirma DESPUÉS de preguntar');
  // La sesión: si falta, el login con la RUTA COMPLETA (esta ventana no tiene el PATH del instalador de Claude).
  assert.match(win, /\$claude = Join-Path \$env:USERPROFILE '\.local\\bin\\claude\.exe'/);
  assert.match(win, /if \(\$sesion -eq 2 -and \(Test-Path \$claude\)\) \{ [^}]*& \$claude auth login;/);
  assert.ok(win.indexOf('New-ItemProperty') > win.indexOf('& $nuevo confirmar'), 'el arranque se deja sólo si quedó conectada');
});

test('Mac: launchd relanza sólo si el programa se CAYÓ, y lo que pregunta lee de la terminal, no del script', () => {
  const mac = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  // Rota: `KeepAlive` en true → este test falla (una Mac desconectada se relanzaba cada 10 s para siempre).
  assert.match(mac, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>/);
  assert.doesNotMatch(mac, /<key>KeepAlive<\/key><true\/>/);
  assert.doesNotMatch(mac, /StandardOutPath/, 'el registro lo lleva el programa, con tope');
  assert.match(mac, /read -r SI < \/dev\/tty/, '`curl | sh` lee el script por la entrada: la pregunta va a la terminal');
  for (const c of ['emparejar', 'confirmar', 'cancelar', 'sesion']) assert.match(mac, new RegExp(`"\\$D/mako-pc(\\.nuevo)?" ${c}[^\\n]*< /dev/null`), `${c} no se come el script`);
  assert.match(mac, /"\$C" auth login < \/dev\/tty/);
});

test('el ejecutable de Windows se marca «de ventana» (Bun no lo hace), y publicar-binarios lo verifica', () => {
  // Una cabecera PE mínima: «MZ», el puntero a «PE\0\0» en 0x3c, y el subsistema a 24 + 68 de ahí.
  const pe = 0x80;
  const exe = new Uint8Array(0x200);
  exe[0] = 0x4d; exe[1] = 0x5a; exe[0x3c] = pe; exe[pe] = 0x50; exe[pe + 1] = 0x45;
  exe[pe + 24 + 68] = 3;
  assert.equal(subsistemaPe(exe), 3, 'de consola, como sale de Bun 1.2.21');
  const marcado = marcarDeVentana(exe);
  assert.equal(subsistemaPe(marcado), 2, 'de ventana');
  assert.equal(subsistemaPe(exe), 3, 'no toca el original');
  assert.equal(subsistemaPe(new Uint8Array(10)), null);
  assert.throws(() => marcarDeVentana(new Uint8Array(100)));
  // Rota: publicar sin marcarlo → este test falla.
  const pub = sinComentarios(leer('scripts/ia-pc/publicar-binarios.mts'));
  assert.match(pub, /bytes = marcarDeVentana\(bytes\);\s*if \(subsistemaPe\(bytes\) !== 2\)/);
  // Y como es «de ventana», cada Claude que corre va con windowsHide (sin eso, cada uno abría su ventana: medido).
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /correr\(claude, args, \{ cwd: dir, env, shell: false, windowsHide: true \}\)/);
  assert.match(p, /spawn\(rutaDeClaude\(\), \['auth', 'status'\], \{ shell: false, env, windowsHide: true \}\)/);
});

// ── 2. El cupo ───────────────────────────────────────────────────────────────

test('una cuenta que pasó el 95 % vuelve a servir cuando su ventana se repone (en el servidor y en la PC)', () => {
  const ahora = Date.parse('2026-10-21T16:00:00Z');
  const vieja = { email: 'a', usado5h: 96, repone: '2026-10-21T15:30:00Z' };
  const otra = { email: 'b', usado5h: 50 };
  for (const elegir of [cuentaConCupo, programa.cuentaConCupo] as Array<(c: unknown[], a?: number) => { email?: string } | null>) {
    // Rota: no mirar `repone` → este test falla (la cuenta quedaba descartada PARA SIEMPRE: nada la volvía a medir).
    assert.equal(elegir([vieja], ahora)?.email, 'a', 'repuesta, se usa');
    assert.equal(elegir([vieja, otra], ahora)?.email, 'a', 'repuesta cuenta como 0 %');
    assert.equal(elegir([{ ...vieja, repone: '2026-10-21T17:00:00Z' }, otra], ahora)?.email, 'b', 'al tope todavía: la otra');
    assert.equal(elegir([{ email: 'c', usado5h: 99, repone: '2026-10-21T17:00:00Z' }], ahora)?.email, 'c', 'sola y al tope: igual, que Claude diga su límite');
    assert.equal(elegir([{ email: 's', usado5h: 10, usadoSemana: 100 }, { email: 't', usado5h: 60 }], ahora)?.email, 't', 'la semana llena, la otra');
  }
  // Lo que se le cuenta a MaKo: sólo las cuentas con sesión, y el % de una ventana repuesta no (no se sabe: «Sin medir»).
  assert.deepEqual(programa.paraElLatido([{ conSesion: true, email: 'a@x.com', usado5h: 96, repone: '2026-10-21T15:30:00Z', usadoSemana: 40 }, { conSesion: false, email: 'b@x.com' }], ahora),
    [{ proveedor: 'claude', email: 'a@x.com', usadoSemana: 40 }]);
});

test('el cupo agotado se dice como cupo, con la hora en que se repone (no «revisa la sesión»)', () => {
  assert.equal(falloDeClaude('Claude AI usage limit reached|1792573200'), 'tope');
  assert.equal(falloDeClaude('algo', { usado5h: 100 }), 'tope');
  assert.equal(falloDeClaude('Invalid API key · Please run /login'), 'sesion');
  assert.equal(falloDeClaude('se cortó la conexión'), null);
  for (const e of ["You've hit your limit · resets 3pm", 'OAuth token has expired', 'otra cosa']) assert.equal(programa.falloDeClaude(e), falloDeClaude(e), `la copia de la PC: ${e}`);
  const ahora = Date.parse('2026-10-21T16:00:00Z');
  assert.equal(avisoTope('2026-10-21T18:30:00Z', 'America/Argentina/Buenos_Aires', ahora), 'Tu Claude llegó a su límite de uso: se repone a las 15:30.');
  assert.equal(avisoTope('2026-10-22T13:00:00Z', 'America/Argentina/Buenos_Aires', ahora), 'Tu Claude llegó a su límite de uso: se repone mañana a las 10:00.');
  assert.match(avisoTope(null, 'UTC', ahora), /se repone solo en unas horas/);
  assert.match(avisoDeLaPc('tope', false, { repone: '2026-10-21T18:30:00Z', tz: 'UTC' }) ?? '', /límite de uso/);
  assert.equal(avisoDeLaPc('sesion', false), AVISO_PC_SIN_SESION);
  assert.equal(avisoDeLaPc('apagada', false), AVISO_PC_APAGADA);
  assert.equal(avisoDeLaPc('muchos', false), AVISO_PC_MUCHOS);
  // La PC manda el tipo, y la puerta lo guarda y lo devuelve (lib/ia-pc.ts → contestarTurno y esperarALaPc).
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /cuerpo = \{ error: res\.error, \.\.\.\(tipo \? \{ tipo \} : \{\}\), \.\.\.\(repone \? \{ repone \} : \{\}\) \};/);
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  assert.match(lib, /uso: r\.tipo \? \{ tipo: r\.tipo, \.\.\.\(r\.repone \? \{ repone: r\.repone \} : \{\}\) \} : null/);
});

// ── 3. La sesión ─────────────────────────────────────────────────────────────

test('«en línea» es una PC con un Claude CON sesión, y el tutorial no dice «¡Listo!» sin eso', () => {
  // Rota: mandarle turnos a una PC en línea sin cuentas → este test falla (cada turno: «al tope», el chat muerto).
  assert.equal(pcUsable({ enLinea: true, cuentas: [] }), false);
  assert.equal(pcUsable({ enLinea: true, cuentas: [{}] }), true);
  assert.equal(pcUsable({ enLinea: false, cuentas: [{}] }), false);
  assert.equal(pcUsable(null), false);
  const hace = () => 'hace 2 min';
  assert.equal(estadoDeLaPc({ enLinea: true, ultimoLatido: 'x', cuentas: [] }, 0, hace), 'Sin sesión de Claude');
  assert.equal(estadoDeLaPc({ enLinea: true, ultimoLatido: 'x', cuentas: [{}] }, 0, hace), 'En línea');
  assert.equal(estadoDeLaPc({ enLinea: false, ultimoLatido: '2026-10-21T10:00:00Z', cuentas: [{}] }, 0, hace), 'Sin conexión · hace 2 min');
  assert.equal(yaPaso('2026-10-21T15:30:00Z', Date.parse('2026-10-21T16:00:00Z')), true, '«Se reinicia a las 15:30» pasadas las 15:30, no');
  assert.equal(yaPaso('2026-10-21T17:30:00Z', Date.parse('2026-10-21T16:00:00Z')), false);
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // Rota: «En la misma ventana escribe claude» → este test falla (no está en el PATH de esa ventana: «no se reconoce»).
  assert.match(ui, /windows: '& "\$env:USERPROFILE\\\\\.local\\\\bin\\\\claude\.exe" auth login'/);
  assert.match(ui, /mac: '~\/\.local\/bin\/claude auth login'/);
  assert.match(ui, /<Copiar texto=\{LOGIN_CLAUDE\[sistema\]\} \/>/);
  assert.doesNotMatch(ui, /escribe <code>claude<\/code>/);
  assert.match(ui, /if \(nueva && nueva\.cuentas\.length\) \{ setLista\(true\); setSinSesion\(null\); setPaso\(5\); return; \}\s*if \(nueva\) \{ setSinSesion\(/);
  assert.match(sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx')), /yaPaso\(repone, ahora\)/);
  // El programa la vuelve a mirar: en cada latido (las que no tienen sesión) y antes de rechazar un turno.
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /const latir = async \(\) => \{\s*if \(fuera\) return;\s*await revisarSesiones\(cuentas\)/);
  assert.match(p, /if \(!cuentas\.some\(\(x\) => x\.conSesion\)\) await revisarSesiones\(cuentas, true\);/);
  assert.match(p, /if \(!todas && x\.conSesion === true && ahora - \(x\.revisada \?\? 0\) < REVISAR_SESION_MS\) continue;/, 'las sin sesión, siempre');
});

// ── 4 y 5. El programa, corrido de verdad contra un servidor de mentira ─────────────────────────────────────────────

type Pedido = { ruta: string };
async function correrPrograma(responder: (ruta: string) => { status: number; cuerpo?: unknown } | 'cortar', ms: number) {
  const pedidos: Pedido[] = [];
  const servidor = http.createServer((req, res) => {
    const ruta = new URL(req.url ?? '/', 'http://x').pathname;
    pedidos.push({ ruta });
    const r = responder(ruta);
    if (r === 'cortar') { req.socket.destroy(); return; }
    res.writeHead(r.status, { 'content-type': 'application/json' });
    res.end(r.cuerpo === undefined ? '' : JSON.stringify(r.cuerpo));
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const puerto = (servidor.address() as AddressInfo).port;
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-rev-'));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ servidor: `http://127.0.0.1:${puerto}`, token: `mkopc_${'A'.repeat(43)}`, negocio: 'Prueba' }));
  const p = spawn(process.execPath, [join(RAIZ, 'scripts', 'ia-pc', 'mako-pc.mjs')], {
    env: { ...process.env, MAKO_PC_DIR: dir, MAKO_PC_CLAUDE: join(dir, 'no-existe-claude'), MAKO_PC_SIN_ARRANQUE: '1' }, stdio: 'ignore',
  });
  let salida: number | null = null;
  p.on('exit', (c) => { salida = c; });
  const fin = Date.now() + ms;
  while (Date.now() < fin && salida === null) await dormir(100);
  const vivo = salida === null;
  if (vivo) p.kill();
  await new Promise<void>((ok) => servidor.close(() => ok()));
  const config = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as Record<string, unknown>;
  const registro = existsSync(join(dir, 'registro.txt')) ? readFileSync(join(dir, 'registro.txt'), 'utf8') : '';
  return { pedidos, vivo, salida, config, registro };
}

test('MaKo desconectó la PC (401 `revocado`): el programa borra su token y sale con 0', async () => {
  const r = await correrPrograma(() => ({ status: 401, cuerpo: respuestaSinPc('revocado').cuerpo }), 8_000);
  assert.equal(r.vivo, false, 'se apagó');
  assert.equal(r.salida, 0, 'con 0: launchd (SuccessfulExit=false) no lo relanza');
  assert.equal(r.config.token, undefined, 'sin el token: no reintenta al próximo arranque');
  assert.match(r.registro, /MaKo desconectó esta computadora/);
});

test('un error de la base (503) o un 401 sin `revocado` NO apagan el programa: reintenta', async () => {
  // Rota: salir con cualquier 401 → este test falla (un bache de la base apagaba el de Windows hasta el próximo inicio).
  assert.deepEqual(respuestaSinPc('no-pude-leer'), { status: 503, cuerpo: { ok: false, error: 'MaKo no pudo leer ahora: reintenta en unos segundos.' } });
  assert.equal(programa.esRevocado({ status: 503, datos: respuestaSinPc('no-pude-leer').cuerpo }), false);
  assert.equal(programa.esRevocado({ status: 401, datos: {} }), false);
  assert.equal(programa.esRevocado({ status: 401, datos: respuestaSinPc('revocado').cuerpo }), true);
  const caido = await correrPrograma(() => ({ status: 503, cuerpo: respuestaSinPc('no-pude-leer').cuerpo }), 4_000);
  assert.equal(caido.vivo, true, 'con 503 sigue vivo');
  assert.ok(caido.pedidos.filter((x) => x.ruta === '/api/ia-pc/turno').length <= 2, 'y espera entre pedidos (5 s)');
  const raro = await correrPrograma(() => ({ status: 401, cuerpo: { ok: false } }), 4_000);
  assert.equal(raro.vivo, true, 'un 401 sin `revocado` no lo apaga');
  assert.equal(raro.config.token, `mkopc_${'A'.repeat(43)}`, 'y no borra su token');
  // Y las rutas de la PC contestan así: la PC sale de lib/ia-pc-ruta.ts, que distingue las dos.
  const ruta = sinComentarios(leer('lib/ia-pc-ruta.ts'));
  assert.match(ruta, /return d \? \{ d \} : \{ respuesta: respuestaDe\('revocado'\) \};\s*\} catch \(e\) \{[\s\S]*respuesta: respuestaDe\('no-pude-leer'\)/);
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  for (const f of ['dispositivoDelToken', 'pcDe', 'tomarTurno', 'contestarTurno', 'turnoDelToken', 'negocioConPc']) {
    const cuerpo = lib.slice(lib.indexOf(`export async function ${f}(`), lib.indexOf('\nexport ', lib.indexOf(`export async function ${f}(`) + 10));
    // Rota: leer sin mirar `error` → este test falla («no pude leer» volvía a ser «no hay»).
    assert.match(cuerpo, /sinError\((await db\(\)|r, )/, `${f}: una lectura que falla tira`);
  }
});

test('sin red, el programa espera (5 s, 10, 30, 60) en vez de girar', async () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(programa.esperaSinRed), [5_000, 10_000, 30_000, 60_000, 60_000]);
  // El servidor corta cada conexión: `fetch` falla al instante, como sin Wi-Fi. Antes: ~1000 pedidos por segundo.
  const r = await correrPrograma(() => 'cortar', 4_000);
  assert.equal(r.vivo, true);
  // Rota: sin el `await dormir(esperaSinRed(fallas++))` → este test falla (cientos en 4 s).
  assert.ok(r.pedidos.length <= 4, `${r.pedidos.length} pedidos en 4 s`);
  assert.equal(r.registro.match(/Sin conexión con MaKo/g)?.length, 1, 'se anota una vez, no en cada vuelta');
});

// ── 6. Los bajos ─────────────────────────────────────────────────────────────

test('EPIPE: si Claude sale sin leer el pedido, el turno falla y el programa NO se cae', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-epipe-'));
  const falso = () => {
    const p = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; stdin: EventEmitter & { end: (s: string) => void }; kill: () => void };
    p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => {};
    // Lo que pasa con un pedido de más de ~64 KB y un Claude que salió antes de leer: `write EOF` en la entrada.
    p.stdin = Object.assign(new EventEmitter(), { end: () => { setImmediate(() => { p.stdin.emit('error', Object.assign(new Error('write EOF'), { code: 'EOF' })); p.stderr.emit('data', 'bad option: --output-format'); p.emit('close', 9); }); } });
    return p;
  };
  // Rota: sin `p.stdin.on('error', …)` → este test falla (el 'error' sin escucha tira el proceso entero).
  const r = await programa.pensar({ dir, system: 's', prompt: 'x'.repeat(100_000), mcp: {} }, falso as never, 'claude');
  assert.deepEqual(r, { error: 'bad option: --output-format', limites: {} });
  const roto = await programa.pensar({ dir: join(dir, '\u0000no-se-puede'), system: 's', prompt: 'p', mcp: {} }, falso as never, 'claude');
  assert.match(String((roto as { error?: string }).error), /no pude correr Claude/, '«nunca tira» es cierto también si no puede escribir su carpeta');
});

test('el turno: la PC que se apaga a mitad se ve (no 4 minutos), y se espera lo que le queda a la ruta', () => {
  assert.equal(esperaDelTurno(300_000, 60_000), 300_000 - 60_000 - MARGEN_RUTA_MS, 'el Analyst del lead tiene 300 s, no 420');
  assert.equal(esperaDelTurno(420_000, 0), ESPERA_RESPUESTA_MS, 'el tope de siempre');
  assert.equal(esperaDelTurno(60_000, 59_000), 0);
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  const espera = lib.slice(lib.indexOf('export async function esperarALaPc('));
  // Rota: no mirar el latido ni si la tomó → este test falla (esperaba los 240 s y decía «tardó demasiado»).
  assert.match(espera, /t\.estado === 'tomado' && sinLatir\(SIN_LATIDO_MS\)\) \{ await vencer\(\); return \{ apagada: true \}; \}/);
  assert.match(espera, /t\.estado === 'esperando' && Date\.now\(\) - inicio > SIN_TOMAR_MS && sinLatir\(SIN_TOMAR_MS\)\)/);
  assert.match(espera, /if \(!eo && !count\) \{ await vencer\(\); return \{ apagada: true \}; \}/, 'apagada sólo si no está ocupada con otro turno');
  // Un error de lectura ya no es «tardó»: se sigue esperando (y lo que no volvió, vence antes de devolver).
  assert.match(espera, /const \{ data: t, error \} = await db\(\)\.from\('ia_pc_turnos'\)[\s\S]*if \(!error\) \{/);
  const rutas = { chat: leer('app/api/mako/chat/route.ts'), movil: leer('app/api/m/mako/route.ts') };
  for (const [n, r] of Object.entries(rutas)) assert.match(r, /plazoMs: maxDuration \* 1000/, `${n} dice su plazo`);
  // Con la PC apagada (o al tope, o sin sesión), su clave si la tiene (§5).
  assert.match(sinComentarios(leer('lib/mako-turno-app.ts')), /if \(!texto && falloDeLaPc !== 'tarde' && falloDeLaPc !== 'muchos' && ia\?\.cuenta !== 'pc'\) \{\s*try \{\s*const r = await chatClaudeTools\(/);
});

test('su clave de Claude que falla (sin crédito, revocada) o en pausa se le dice: no es un ticket de bug', () => {
  const sinCredito = 'falló la IA (tu clave de Claude: Your credit balance is too low to access the Anthropic API)';
  assert.equal(falloDeSuClave(sinCredito), true);
  assert.equal(falloDeSuClave('falló la IA (tu clave de Claude: invalid x-api-key)'), true);
  assert.equal(falloDeSuClave('falló la IA (tu clave de Claude: HTTP 400 messages.0.content: Field required)'), false, 'un 400 de NUESTRO pedido sí es un bug');
  assert.equal(esDeConfiguracion({ mensaje: sinCredito }), true);
  assert.equal(esDeConfiguracion({ mensaje: 'falló la IA (Tu Claude está conectado, pero MaKo lo tiene en pausa por un rato: no lo estoy usando. Vuelve a intentar más tarde.)' }), true);
  assert.equal(esDeConfiguracion({ mensaje: 'falló la IA (tu clave de Claude: HTTP 400 bad request)' }), false);
  assert.match(AVISO_SU_CLAVE, /Tu clave de Claude no funcionó/);
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /const deSuClave = fallo\?\.includes\(CLAUDE_EN_PAUSA\) \? \{ aviso: CLAUDE_EN_PAUSA, conectar: null \}\s*: falloDeSuClave\(fallo\) \? \{ aviso: AVISO_SU_CLAVE, conectar: 'anthropic' \} : null;/);
  // Con su propio Claude (D6b), «Conectar tu IA» abre su Claude o su OpenAI, nunca Gemini.
  assert.equal(iaParaConectar(['gemini'], true), 'anthropic');
  assert.equal(iaParaConectar(['gemini', 'openai'], true), 'openai');
  assert.equal(iaParaConectar(['gemini'], false), 'gemini', 'sin su IA, como siempre');
});

test('la puerta: desconectar corta el turno en curso, el MCP espera lo que le queda, y la conexión no se pisa en silencio', () => {
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  const cuerpo = (f: string) => lib.slice(lib.indexOf(`export async function ${f}(`), lib.indexOf('\nexport ', lib.indexOf(`export async function ${f}(`) + 10));
  // Rota: desconectar sin vencer sus turnos → este test falla (la PC seguía corriendo herramientas hasta 4 minutos).
  assert.match(cuerpo('desconectar'), /from\('ia_pc_turnos'\)\.update\(\{ estado: 'vencido' \}\)\.eq\('dispositivo_id', id\)\.eq\('workspace_id', ws\)\.in\('estado', \['esperando', 'tomado'\]\)/);
  assert.match(cuerpo('turnoDelToken'), /from\('ia_pc_dispositivos'\)\.select\('id'\)\.eq\('id', data\.dispositivo_id\)\.is\('revocado_at', null\)/, 'y el token del turno mira que su PC siga conectada');
  // El MCP: espera mientras el turno siga tomado, y si no se esperó, la saca de la fila (así «no se corrió» es cierto).
  assert.match(cuerpo('pedirLlamada'), /\.eq\('id', data\.id\)\.eq\('estado', 'esperando'\)\.select\('id'\)\.maybeSingle\(\);\s*if \(sacada\) return null;/);
  assert.match(sinComentarios(leer('app/api/ia-pc/mcp/route.ts')), /await pedirLlamada\(t\.id, nombre, entrada, Math\.max\(1_000, queda\)\)/);
  // Emparejar dice A QUÉ negocio y COMO QUIÉN; el programa suelta la conexión de antes al confirmar.
  assert.match(cuerpo('emparejar'), /return \{ token, ws, negocio, persona \};/);
  assert.match(sinComentarios(leer('app/api/ia-pc/emparejar/route.ts')), /return json\(\{ ok: true, token: r\.token, negocio: r\.negocio, persona: r\.persona \}\);/);
  const p = sinComentarios(leer('scripts/ia-pc/mako-pc.mjs'));
  assert.match(p, /if \(c\.token && c\.token !== p\.token\) await conReintentos\(\{ servidor: c\.servidor \?\? p\.servidor, token: c\.token \}, '\/api\/ia-pc\/soltar'\)/, 'sin tarjeta fantasma');
  assert.match(p, /guardarConfig\(\{ \.\.\.antes, pendiente: \{ servidor, token: r\.datos\.token, nombre, negocio, persona \} \}\);/, 'emparejar deja PENDIENTE: confirma la persona');
  // Un código nuevo anula los anteriores, y son 8 letras.
  assert.match(cuerpo('crearCodigo'), /update\(\{ vence_at: ahora \}\)\s*\.eq\('workspace_id', ws\)\.eq\('persona', persona\)\.is\('usado_at', null\)\.gt\('vence_at', ahora\)/);
});

test('los topes y la limpieza: por negocio, el del código, y los turnos (con datos de leads) no se guardan para siempre', () => {
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  // Rota: encolar sin contar → este test falla (§3, regla 6: el tope por NEGOCIO).
  assert.match(lib, /if \(\(count \?\? 0\) >= TOPE_TURNOS_POR_MINUTO\) throw new TopeDeTurnos\(/);
  assert.match(sinComentarios(leer('app/api/ia-pc/codigo/route.ts')), /limitePorClave\('ia-pc-codigo', `\$\{persona\.ws\}:\$\{persona\.actor\}`, 10, 10 \* 60_000\)/);
  assert.match(lib, /from\('ia_pc_turnos'\)\.delete\(\)\.lt\('creado_at', corte\)/);
  const cron = sinComentarios(leer('app/api/cron/ia-pc-purga/route.ts'));
  assert.match(cron, /checkCronAuth\(req\)/);
  assert.match(cron, /purgarTurnosViejos\(/);
  assert.ok((JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string }> }).crons.some((c) => c.path === '/api/cron/ia-pc-purga'), 'agendado');
  // La ruta de instalar mira que el código siga vivo antes de mandar a bajar 43 MB, y lo dice (no un 400 que nadie lee).
  const inst = sinComentarios(leer('app/api/ia-pc/instalar/route.ts'));
  assert.match(inst, /if \(!\(await codigoVivo\(codigo\)\.catch\(\(\) => true\)\)\) return aviso\(/);
  assert.doesNotMatch(inst, /, 4\d\d\)|, 5\d\d\)/, 'los avisos van con 200: `irm` y `curl -f` no muestran el cuerpo de un error');
  // La pantalla: el código que vence ofrece otro, sin volver a aceptar.
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  assert.match(ui, /const vencido = !!codigo && venceAt != null && ahora >= venceAt && delCodigo !== 'eligiendo';/);
  assert.match(ui, /\{\(error \|\| vencido \|\| delCodigo === 'gastado'\) && \(/);
  assert.match(ui, /esAdmin=\{!!estado\?\.esAdmin\}/, 'la clave de API es del negocio: sólo el admin (IA4: lib/conectar-ia-reglas.ts)');
  assert.match(sinComentarios(leer('lib/conectar-ia-reglas.ts')), /quien\.esAdmin\s*\?\s*\{ que: 'clave'/);
});
