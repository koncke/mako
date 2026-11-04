// =============================================================================
// La IA del cliente: lo que pidió la SEGUNDA revisión del Cerebro sobre 71706061d (21/10/2026)
// =============================================================================
// La nota («revision-ia-cliente-v2-21-10.md», side-session-notes) cerró los cinco altos de la primera y abrió dos altos y
// seis medios nuevos. Lo que fija este archivo (el alto 1, confirmar una tarjeta fuera de «sólo su IA», está en
// tests/d6b-confirmar.test.ts; El Archivero y «Buscar con MaKo», en tests/d6b-rutas.test.ts):
//   ALTO 2. LA PC FANTASMA: nace PENDIENTE; cuenta como «su IA» recién ACTIVA (confirmada + un latido con una cuenta
//      con sesión); la que se dijo que no, o se abandonó en la pregunta, no cuenta y la purga la revoca — CORRIDO contra
//      un PostgREST de mentira (tests/_ia-pc-pendiente-hijo.ts);
//   MEDIOS 3 y 4. EL INSTALADOR: baja a un archivo aparte, pregunta, y recién con el «sí» para lo que corría (Kill +
//      WaitForExit, Move-Item con reintentos); con «no» o un error, lo de antes sigue andando (`finally` / `trap`);
//      el programa confirma con MaKo antes de soltar la conexión vieja — CORRIDO contra un servidor de mentira;
//   MEDIO 7. EL CÓDIGO GASTADO: el tutorial se entera y ofrece otro; el instalador no dice «pega la misma línea»;
//   y los bajos: la semana agotada, la cuenta agregada con el programa corriendo, el programa viejo que no borra la
//      conexión nueva, la PC sin Claude, la PC que no se pudo leer, la desconectada a mitad, El Archivero en pausa, el
//      título doble, el «¡Listo!» antes de tiempo y el reloj de la PC.
//
// PROBADO ROMPIÉNDOLO (21/10/2026, una rotura por vez, restaurada con sha256; base 16 / 0): 45 roturas de este archivo,
// todas con su rojo — emparejar confirmada · D6b con las confirmadas · el latido sin cuentas la activa · el token
// pendiente para todo · la purga sin las abandonadas · sin nombre del negocio · el código abandonado «eligiendo» ·
// confirmar sin la pendiente, el latido con ella, confirmar no pública · Windows: parar antes de preguntar, Stop-Process,
// sin `finally`, Move-Item sin reintentos, bajar sobre el .exe, confirmar antes de preguntar · Mac: descargar antes, sin
// `trap` · «pega esta línea» · Claude sólo en ~/.local/bin · confirmar sin el 200, sin reintentar el 503, con
// `process.exit` (0xC0000409) · el viejo borra la nueva · el latido sin «sin Claude» · la cuenta agregada · el tope con la
// hora de las 5 h (PC y servidor) · la semana repuesta llena · «el 24» por «el sábado» · el tutorial sin mirar el código,
// «Conectar» sin estado, el reloj del servidor, sin Claude al paso 3, el título doble, el estado sin «sin Claude» · no
// leer la PC = «conéctala», ni a la Ticketera · la desconectada como «tardó» · sin Claude como sin sesión · la herramienta
// sin tomarla, con el turno cortado · la PC ocupada en un hueco · El Archivero en pausa. Restaurado: 16 / 0.
//
// Correr: npx tsx --test tests/ia-pc-segunda-revision.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  AVISO_PC_DESCONECTADA, AVISO_PC_ILEGIBLE, AVISO_PC_SIN_CLAUDE, avisoDeLaPc, avisoTope, cuentaConCupo, estadoDeLaPc,
  limitesDelEvento, reponeDelTope, respuestaSinPc, scriptDeInstalacion,
} from '../lib/ia-pc-reglas';
import * as programa from '../scripts/ia-pc/mako-pc.mjs';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const URLS = { 'windows-x64': 'https://x.supabase.co/a.gz?t=1', 'mac-arm64': 'https://x.supabase.co/b.gz?t=1', 'mac-x64': 'https://x.supabase.co/c.gz?t=1' };
const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// ── ALTO 2. La PC fantasma ───────────────────────────────────────────────────

type Foto = { estadoDelCodigo: string; delToken: boolean; delTokenPendiente: boolean; pcDe: boolean; listadas: number; negocioConPc: boolean };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_ia-pc-pendiente-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const V = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, unknown> & {
  error?: string; pendiente: Foto; confirmada: Foto; sinClaude: Foto & { claudeFalta: boolean; activa: unknown }; activa: Foto & { claudeFalta: boolean; activa: boolean };
};

test('una PC emparejada nace PENDIENTE: ni turnos, ni lista, ni «su IA» hasta el «sí»', () => {
  assert.equal(V.error, undefined, String(V.error));
  assert.deepEqual(V.emparejado, { negocio: 'Negocio de Prueba', persona: 'ana@negocio.com', confirmado: null, activa: null });
  // Rota: emparejar dejándola confirmada → este test falla (la instalación abandonada en la pregunta sacaba la IA al negocio).
  assert.deepEqual(V.pendiente, { estadoDelCodigo: 'eligiendo', delToken: false, delTokenPendiente: true, pcDe: false, listadas: 0, negocioConPc: false });
});

test('confirmada todavía no es «su IA»: recién con un latido con una cuenta con sesión (sin Claude, tampoco)', () => {
  assert.equal(V.confirmar, true);
  assert.deepEqual(V.confirmada, { estadoDelCodigo: 'conectado', delToken: true, delTokenPendiente: true, pcDe: true, listadas: 1, negocioConPc: false });
  // Rota: activar con cualquier latido → este test falla (una PC sin Claude Code pasaba el negocio a «sólo su IA»).
  assert.equal(V.sinClaude.negocioConPc, false);
  assert.equal(V.sinClaude.claudeFalta, true, 'el latido dijo que no hay Claude: MaKo manda al paso 2');
  assert.equal(V.sinClaude.activa, null);
  assert.equal(V.activa.negocioConPc, true);
  assert.equal(V.activa.activa, true);
  assert.equal(V.activa.claudeFalta, false);
  assert.equal(V.confirmarDeNuevo, true, 'confirmar dos veces no falla (el programa reintenta)');
});

test('«no es mi negocio» y la abandonada en la pregunta: el código queda gastado SIN conectar, y la purga la revoca', () => {
  assert.deepEqual(V.dijoQueNo, { estadoDelCodigo: 'cancelado', delTokenPendiente: false });
  assert.equal(V.eligiendo, 'eligiendo');
  assert.equal(V.abandonadaCodigo, 'cancelado', 'pasados 15 minutos sin contestar, el tutorial ofrece otro código');
  assert.deepEqual(V.purga, { turnos: 0, codigos: 0, abandonadas: 1 });
  assert.deepEqual(V.abandonada, { revocada: true, delTokenPendiente: false });
  assert.equal(V.activaSigue, true, 'la purga no toca una PC que late');
});

test('un negocio sin nombre: emparejar tira ANTES de gastar el código (la pregunta no dice «tu negocio»)', () => {
  assert.match(String(V.sinNombre), /no tiene nombre/);
  assert.equal(V.sinNombreCodigo, 'vivo');
  assert.equal(V.sinNombrePcs, 0);
});

test('las rutas: confirmar es de la PC (pública, con su token pendiente), y soltar acepta la pendiente', () => {
  const conf = sinComentarios(leer('app/api/ia-pc/confirmar/route.ts'));
  assert.match(conf, /pcDelPedido\(req, 'confirmar', \{ pendientesTambien: true \}\)/);
  assert.match(conf, /limitePorClave\('ia-pc-confirmar', d\.id, 5, 60_000\)/);
  assert.match(conf, /ok = await confirmar\(d(, body\?\.anterior)?\)/);
  assert.match(leer('lib/rutas-publicas.ts'), /'\/api\/ia-pc\/confirmar'/);
  assert.match(sinComentarios(leer('app/api/ia-pc/soltar/route.ts')), /pcDelPedido\(req, 'soltar', \{ pendientesTambien: true \}\)/);
  // Las demás rutas de la PC (latido, turno, mcp) NO aceptan una pendiente.
  for (const r of ['latido', 'turno']) assert.doesNotMatch(leer(`app/api/ia-pc/${r}/route.ts`), /pendientesTambien/, r);
  const mig = leer('supabase/migrations/0322_ia_pc_pendiente.sql');
  // Hasta que el Cerebro la aplique dice «SIN APLICAR»; después, «APLICADA» (con la fecha). Y siempre el orden.
  assert.match(mig, /SIN APLICAR|APLICADA/);
  assert.match(mig, /ORDEN DE DESPLIEGUE: esta migración ANTES de integrar/);
  for (const c of ['confirmado_at timestamptz', 'activa_at timestamptz', 'claude_falta boolean not null default false']) assert.ok(mig.includes(`add column if not exists ${c}`), c);
  assert.match(mig, /add column if not exists dispositivo_id bigint references ia_pc_dispositivos\(id\) on delete set null/);
  // Volver a correrla después del deploy no confirma una PC que espera el «sí» (revisión de la Ticketera, 21/10 noche): el
  // backfill de `confirmado_at` sólo toca las que latieron, y una pendiente no puede latir. Rota (sin el filtro) → este test
  // falla: probado sacando «and ultimo_latido is not null» de la 0322, 1 rojo; restaurado, verde.
  const backfill = mig.match(/update ia_pc_dispositivos set confirmado_at[^;]*;/)?.[0] ?? '';
  assert.match(backfill, /where confirmado_at is null and ultimo_latido is not null;/, 'el backfill de confirmado_at no confirma pendientes');
});

// ── MEDIOS 3 y 4. El instalador ──────────────────────────────────────────────

test('Windows: nada de lo que corre se para antes del «sí»; con el sí, Kill + WaitForExit, Move-Item con reintentos y `finally`', () => {
  const win = scriptDeInstalacion({ sistema: 'windows', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  const pregunta = win.indexOf('Read-Host');
  const antes = win.slice(0, pregunta);
  // Rota: parar el programa antes de preguntar → este test falla («no es mi negocio» dejaba apagada la conexión que andaba).
  assert.doesNotMatch(antes, /Get-Process|Stop-Process|Kill|Move-Item|-OutFile \$exe|Create\(\$exe\)/, 'antes de preguntar no se toca lo que corre');
  assert.match(antes, /\$out = \[IO\.File\]::Create\(\$nuevo\)/, 'baja a un archivo aparte');
  assert.match(antes, /& \$nuevo emparejar '[^']+' --servidor '[^']+' --nombre \$env:COMPUTERNAME \| Out-Host/);
  assert.match(win, /if \(\$si -notmatch '\^\\s\*\[sS\]'\) \{ & \$nuevo cancelar \| Out-Host; Remove-Item -Force \$nuevo -ErrorAction SilentlyContinue; throw 'No la conecté: tu computadora sigue como estaba\.' \}/);
  // Rota: Stop-Process en vez de Kill + WaitForExit → este test falla (8 de 8: «está siendo utilizado por otro proceso»).
  assert.match(win, /Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue \| ForEach-Object \{ try \{ \$_\.Kill\(\); \[void\]\$_\.WaitForExit\(15000\) \} catch \{\} \}/);
  assert.match(win, /for \(\$i = 0; \$i -lt 20 -and -not \$movido; \$i\+\+\) \{ try \{ Move-Item -Force \$nuevo \$exe; \$movido = \$true \} catch \{ Start-Sleep -Milliseconds 500 \} \}/);
  // Rota: sin el `finally` → este test falla (si Move-Item falla, el de antes no volvía a arrancar).
  assert.match(win, /\} finally \{\n {2}if \(\(Test-Path \$exe\) -and -not \(Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue\)\) \{ Start-Process -FilePath \$exe \}/);
  const t = win.indexOf('try {');
  // Desde la tercera revisión confirma ANTES de parar lo de antes (tests/ia-pc-tercera-revision.test.ts).
  assert.ok(t > pregunta && win.indexOf('Kill()') > t && win.indexOf('& $nuevo confirmar') < t, 'confirma, y recién ahí para');
  assert.ok(win.indexOf('Move-Item') > win.indexOf('& $nuevo confirmar'), 'reemplaza sólo si MaKo la confirmó');
  assert.match(win, /& \$nuevo confirmar \| Out-Host\nif \(\$LASTEXITCODE -ne 0\) \{ Remove-Item -Force \$nuevo -ErrorAction SilentlyContinue; throw '[^']+' \}/);
  assert.ok(win.indexOf('New-ItemProperty') > win.indexOf('Move-Item'), 'el arranque, con el programa nuevo ya en su lugar');
  for (const l of win.split('\n').filter((x) => /& \$(exe|nuevo) /.test(x))) assert.match(l, /& \$(exe|nuevo) [^|]*\| Out-Host/, `sin Out-Host: ${l}`);
});

test('Mac: el agente se descarga recién con el «sí», y un `trap` lo vuelve a cargar salga por donde salga', () => {
  const mac = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  const pregunta = mac.indexOf('read -r SI < /dev/tty');
  assert.ok(pregunta > 0);
  assert.doesNotMatch(mac.slice(0, pregunta), /launchctl unload|mv -f/, 'antes de preguntar no se toca lo que corre');
  assert.match(mac.slice(0, pregunta), /gunzip > "\$D\/mako-pc\.nuevo"/);
  assert.match(mac, /\*\) "\$D\/mako-pc\.nuevo" cancelar < \/dev\/null \|\| true; rm -f "\$D\/mako-pc\.nuevo"; echo "No la conecté: tu computadora sigue como estaba\."; exit 1 ;;/);
  const trap = mac.indexOf("trap '[ -f \"$P\" ] && launchctl load \"$P\"");
  assert.ok(trap > pregunta && trap < mac.indexOf('launchctl unload'), 'el trap, antes de descargarlo');
  // Desde la tercera revisión confirma con el agente todavía cargado (tests/ia-pc-tercera-revision.test.ts).
  assert.ok(mac.indexOf('"$D/mako-pc.nuevo" confirmar') < mac.indexOf('launchctl unload'));
  assert.ok(mac.indexOf('mv -f "$D/mako-pc.nuevo" "$D/mako-pc"') > mac.indexOf('"$D/mako-pc.nuevo" confirmar'));
  for (const c of ['emparejar', 'confirmar', 'cancelar']) assert.match(mac, new RegExp(`"\\$D/mako-pc\\.nuevo" ${c}[^\\n]*< /dev/null`), `${c} no se come el script`);
  assert.match(mac, /"\$D\/mako-pc" sesion < \/dev\/null/);
});

test('Claude fuera de ~/.local/bin (winget, Homebrew) también se encuentra, y nadie pide «pega la misma línea»', () => {
  const win = scriptDeInstalacion({ sistema: 'windows', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  const mac = scriptDeInstalacion({ sistema: 'mac', codigo: 'ABCD2345', servidor: 'https://hola-mako.com', urls: URLS });
  assert.match(win, /if \(-not \(Test-Path \$claude\)\) \{ \$c = Get-Command claude -ErrorAction SilentlyContinue; if \(\$c\) \{ \$claude = \$c\.Source \} \}/);
  assert.match(mac, /C="\$HOME\/\.local\/bin\/claude"; \[ -x "\$C" \] \|\| C="\$\(command -v claude \|\| true\)"/);
  // Rota: «pega esta línea de nuevo» → este test falla (el código ya se gastó: la misma línea dice «pide otro código»).
  for (const s of [win, mac]) {
    assert.doesNotMatch(s, /pega (esta|la misma) línea/i);
    assert.match(s, /MaKo lo detecta solo/);
  }
});

type Pedido = { ruta: string; auth: string; cuerpo: unknown };
/** Corre el programa (`cmd`) con `config` contra un servidor de mentira. `responder` puede tocar la carpeta (`dir`). */
async function correr(cmd: string[], config: Record<string, unknown>, responder: (p: Pedido, dir: string) => { status: number; cuerpo?: unknown }, ms: number) {
  const pedidos: Pedido[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'mako-pc-r2-'));
  const servidor = http.createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const p = { ruta: new URL(req.url ?? '/', 'http://x').pathname, auth: String(req.headers.authorization ?? ''), cuerpo: b ? JSON.parse(b) : null };
      pedidos.push(p);
      const r = responder(p, dir);
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(r.cuerpo === undefined ? '' : JSON.stringify(r.cuerpo));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const conUrl = JSON.parse(JSON.stringify(config).replaceAll('SERVIDOR', url)) as Record<string, unknown>;
  writeFileSync(join(dir, 'config.json'), JSON.stringify(conUrl));
  const p = spawn(process.execPath, [join(RAIZ, 'scripts', 'ia-pc', 'mako-pc.mjs'), ...cmd], {
    env: { ...process.env, MAKO_PC_DIR: dir, MAKO_PC_CLAUDE: join(dir, 'no-existe-claude'), MAKO_PC_SIN_ARRANQUE: '1' }, stdio: 'ignore',
  });
  let fin: number | null = null;
  p.on('exit', (c) => { fin = c; });
  const tope = Date.now() + ms;
  while (Date.now() < tope && fin === null) await dormir(100);
  const vivo = fin === null;
  if (vivo) p.kill();
  await new Promise<void>((ok) => servidor.close(() => ok()));
  return { pedidos, vivo, salida: fin as number | null, config: JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as Record<string, unknown> };
}
const VIEJO = `mkopc_${'V'.repeat(43)}`;
const NUEVO = `mkopc_${'N'.repeat(43)}`;
const CON_PENDIENTE = { servidor: 'SERVIDOR', token: VIEJO, negocio: 'El de antes', pendiente: { servidor: 'SERVIDOR', token: NUEVO, nombre: 'PC', negocio: 'Prueba', persona: 'ana' } };

// ⚠️ CON LA MÁQUINA CARGADA ESTE TEST DA ROJO SIN UN BUG (24/10/2026): el programa no termina en los 8 s de `correr`, la
// salida llega `null` y el assert dice «sale con 1». Solo, verde. Antes de buscar el bug, correlo solo (docs/hallazgos-ia.md
// → «Tests que mienten con la máquina cargada»).
test('el programa: «confirmar» guarda la conexión nueva y suelta la vieja SÓLO si MaKo la confirmó', async () => {
  const bien = await correr(['confirmar'], CON_PENDIENTE, () => ({ status: 200, cuerpo: { ok: true } }), 8_000);
  assert.equal(bien.salida, 0);
  assert.deepEqual(bien.pedidos.map((x) => [x.ruta, x.auth.slice(-3)]), [['/api/ia-pc/confirmar', 'NNN'], ['/api/ia-pc/soltar', 'VVV']]);
  assert.equal(bien.config.token, NUEVO);
  assert.equal(bien.config.pendiente, undefined);
  // Rota: guardar sin esperar el 200 → este test falla (con el código ya inválido, la PC quedaba con un token muerto).
  const no = await correr(['confirmar'], CON_PENDIENTE, () => ({ status: 401, cuerpo: respuestaSinPc('revocado').cuerpo }), 8_000);
  assert.equal(no.salida, 1, 'sale con 1: el instalador deja corriendo lo de antes');
  assert.deepEqual(no.pedidos.map((x) => x.ruta), ['/api/ia-pc/confirmar'], 'ni suelta la vieja');
  assert.equal(no.config.token, VIEJO);
  const caido = await correr(['confirmar'], CON_PENDIENTE, () => ({ status: 503, cuerpo: respuestaSinPc('no-pude-leer').cuerpo }), 15_000);
  assert.equal(caido.salida, 1);
  assert.equal(caido.pedidos.filter((x) => x.ruta === '/api/ia-pc/confirmar').length, 3, 'reintenta un 503');
  assert.equal(caido.config.token, VIEJO);
});

test('el programa viejo que recibe el 401 NO borra la conexión nueva (reinstalar suelta la de antes)', async () => {
  // El servidor, al primer pedido, hace lo que hace el instalador nuevo: guarda OTRO token, y suelta el de este programa.
  const r = await correr([], { servidor: 'SERVIDOR', token: VIEJO }, (p, dir) => {
    if (p.auth.endsWith(VIEJO)) {
      writeFileSync(join(dir, 'config.json'), JSON.stringify({ servidor: 'http://127.0.0.1:1', token: NUEVO }));
      return { status: 401, cuerpo: respuestaSinPc('revocado').cuerpo };
    }
    return { status: 204 };
  }, 8_000);
  assert.equal(r.vivo, false);
  assert.equal(r.salida, 0);
  // Rota: `desconectada` sin mirar de quién es el token → este test falla (y sacaba también el arranque del nuevo).
  assert.equal(r.config.token, NUEVO);
});

test('el latido dice «sin Claude» cuando no hay Claude Code (el paso 2, no el 3)', async () => {
  const r = await correr([], { servidor: 'SERVIDOR', token: VIEJO }, (p) => (p.ruta === '/api/ia-pc/latido' ? { status: 200, cuerpo: { ok: true } } : { status: 204 }), 3_000);
  const latido = r.pedidos.find((x) => x.ruta === '/api/ia-pc/latido');
  // Desde la 0.4.0 la versión lleva el sistema (`0.4.0+windows`: varias computadoras, tests/ia-pc-enlace.test.ts).
  assert.deepEqual(latido?.cuerpo, { version: programa.versionConSistema(), cuentas: [], sinClaude: true });
  assert.deepEqual(programa.extrasDelLatido([{ falta: true }, { conSesion: true }]), {}, 'con una cuenta que anda, no');
  assert.deepEqual(programa.extrasDelLatido([]), {});
  // Y el estado de la PC lo dice así (escritorio y teléfono usan la misma regla).
  assert.equal(estadoDeLaPc({ enLinea: true, ultimoLatido: 'x', cuentas: [], sinClaude: true }, 0, () => ''), 'Falta instalar Claude');
  assert.equal(estadoDeLaPc({ enLinea: true, ultimoLatido: 'x', cuentas: [] }, 0, () => ''), 'Sin sesión de Claude');
  assert.match(sinComentarios(leer('app/api/ia-pc/estado/route.ts')), /\.\.\.\(d\.claudeFalta \? \{ sinClaude: true \} : \{\}\)/);
});

test('una cuenta agregada con el programa corriendo se suma sin reiniciar', () => {
  const cuentas: Array<{ dir: string | null; email?: string }> = [{ dir: null }];
  assert.equal(programa.sumarCuentasNuevas(cuentas, { cuentas: [{ dir: null }, { dir: '/c/2', email: 'b@x.com' }] }), 1);
  assert.deepEqual(cuentas.map((c) => c.dir), [null, '/c/2']);
  assert.equal(programa.sumarCuentasNuevas(cuentas, { cuentas: [{ dir: null }, { dir: '/c/2' }] }), 0, 'una vez');
  assert.equal(programa.sumarCuentasNuevas(cuentas, null), 0);
  // Rota: no llamarla al revisar → este test falla.
  assert.match(sinComentarios(leer('scripts/ia-pc/mako-pc.mjs')), /async function revisarSesiones\(cuentas, todas = false\) \{\s*if \(sumarCuentasNuevas\(cuentas\)\) todas = true;/);
});

test('la semana agotada se dice con la hora de la SEMANA (no la de las 5 horas), en el servidor y en la PC', () => {
  const evento = { rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.2, resetsAt: 1792573200 }, seven_day: { utilization: 1, resetsAt: 1792900000 } } } };
  assert.deepEqual(programa.limitesDelEvento(evento), limitesDelEvento(evento), 'la copia de la PC');
  const l = limitesDelEvento(evento);
  assert.equal(l.reponeSemana, new Date(1792900000 * 1000).toISOString());
  // Rota: la hora de las 5 horas con la semana llena → este test falla («se repone a las 15:30», y no se reponía).
  assert.equal(reponeDelTope(l), l.reponeSemana);
  assert.equal(programa.reponeDelTope(l), l.reponeSemana);
  assert.equal(reponeDelTope({ ...l, usadoSemana: 40 }), l.repone);
  assert.match(sinComentarios(leer('scripts/ia-pc/mako-pc.mjs')), /const repone = tipo === 'tope' \? reponeDelTope\(cuenta\) : undefined;/);
  const ahora = Date.parse('2026-10-21T16:00:00Z');
  assert.equal(avisoTope('2026-10-24T13:00:00Z', 'America/Argentina/Buenos_Aires', ahora), 'Tu Claude llegó a su límite de uso: se repone el sábado a las 10:00.');
  // Una semana que ya se repuso deja de contar como llena (en los dos lados).
  const llena = { email: 's', usado5h: 10, usadoSemana: 100, reponeSemana: '2026-10-21T15:00:00Z' };
  for (const elegir of [cuentaConCupo, programa.cuentaConCupo] as Array<(c: unknown[], a?: number) => { email?: string } | null>) {
    assert.equal(elegir([llena, { email: 't', usado5h: 60 }], ahora)?.email, 's');
    assert.equal(elegir([{ ...llena, reponeSemana: '2026-10-25T15:00:00Z' }, { email: 't', usado5h: 60 }], ahora)?.email, 't');
  }
  assert.deepEqual(programa.paraElLatido([{ conSesion: true, usadoSemana: 100, reponeSemana: '2026-10-21T15:00:00Z' }], ahora), [{ proveedor: 'claude' }], 'la semana repuesta: «Sin medir»');
});

// ── MEDIO 7 y los bajos de la pantalla ───────────────────────────────────────

test('el tutorial: el código gastado sin conectar ofrece otro, cuenta con SU reloj, y no dice «¡Listo!» antes de tiempo', () => {
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // Rota: no mirar el código → este test falla (seguía «Esperando…» con una línea que ya no servía).
  assert.match(ui, /fetch\(`\/api\/ia-pc\/codigo\?codigo=\$\{encodeURIComponent\(codigo\)\}`/);
  assert.match(ui, /setDelCodigo\(c\.estado === 'cancelado' \? 'gastado' : c\.estado === 'eligiendo' \? 'eligiendo' : null\)/);
  // Gastado sin conectar (dijo «No» o cerró la ventana): vuelve al botón con «No se conectó.», y «Conectar» pide otro. Mientras
  // espera, a los segundos, «Probar de nuevo» (25/10/2026: el «Pedir otro código» de antes, sin hablar de códigos).
  assert.match(ui, /\{!error && delCodigo === 'gastado' && <p className="tci-tutorial__aviso">No se conectó\.<\/p>\}/);
  assert.match(ui, /¿No se abrió\? <button type="button" className="tci-tutorial__enlace" onClick=\{conectar\}>Probar de nuevo<\/button>/, '«Probar de nuevo» mientras espera');
  assert.match(ui, /setVenceAt\(Date\.now\(\) \+ \(Number\(r\.duraMs\) \|\| 10 \* 60_000\)\)/, 'con su reloj');
  assert.match(sinComentarios(leer('app/api/ia-pc/codigo/route.ts')), /duraMs: CODIGO_MS/);
  assert.match(ui, /listo=\{!!estado\}/, 'hasta saber qué PC ya estaban');
  assert.match(ui, /const anda = o\.habilitada && \(o\.que !== 'pc' \|\| puedeComputadora\);/, '«Mi computadora» espera al estado (IA4)');
  // «Falta Claude Code» es sólo del tutorial de Claude (la ola 3).
  assert.match(ui, /setSinSesion\(conClaude && nueva\.sinClaude \? 'claude' : 'sesion'\)/);
  // Sin Claude Code (25/10/2026): en Windows, bajar MaKo de nuevo (el instalador lo instala); en la Mac, volver a abrirla.
  const falta = ui.slice(ui.indexOf("{paso === 4 && sinSesion === 'claude' && ("), ui.indexOf("{paso === 4 && sinSesion === 'sesion' && ("));
  assert.match(falta, /\{`Falta \$\{programa\}`\}/);
  assert.match(falta, /<a className="tci-instalar__boton" href=\{descarga\}>/);
  assert.match(falta, /`Vuelve a abrir MaKo: instala \$\{programa\}\.`/);
  // /perfil/ia ya tiene su título: el componente va sin cabecera.
  assert.match(leer('app/perfil/ia/page.tsx'), /<TusCuentasIA sinCabecera computadora=\{\(await searchParams\)\.computadora === '1'\} \/>/);
  assert.match(sinComentarios(leer('app/m/cuenta/ia/ia-ui.ts')), /Pick<PcIA, 'enLinea' \| 'ultimoLatido' \| 'cuentas' \| 'sinClaude'>/);
});

// ── Los bajos del turno ──────────────────────────────────────────────────────

test('el turno: la PC que no se pudo leer, la desconectada a mitad y la sin Claude dicen lo cierto', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // Rota: `pcDe(...).catch(() => null)` → este test falla (a la dueña con su PC conectada se le pedía «conecta tu computadora»).
  assert.doesNotMatch(t, /pcDe\(ws, persona\.actor\)\.catch\(\(\) => null\)/);
  assert.match(t, /const pcIlegible = leidaPc\.error;/);
  assert.match(t, /\? pcIlegible && negocio\.suIA\s*\? \{ aviso: AVISO_PC_ILEGIBLE, conectar: null \}/);
  assert.match(t, /\.\.\.\(pcIlegible && !texto \? \[\{ nombre: 'leer-la-pc'/, 'y va a la Ticketera');
  assert.match(t, /else if \('desconectada' in r\) \{ falloDeLaPc = 'desconectada';/);
  // «Falta Claude Code» es sólo de un turno de Claude (la ola 3): a su ChatGPT no le falta Claude Code.
  assert.match(t, /pc\.enLinea \? \(pc\.claudeFalta && iaDeLaPc === 'claude' \? 'sin-claude' : 'sesion'\) : 'apagada'/);
  assert.equal(avisoDeLaPc('sin-claude', false), AVISO_PC_SIN_CLAUDE);
  assert.equal(avisoDeLaPc('desconectada', false), AVISO_PC_DESCONECTADA);
  assert.match(AVISO_PC_ILEGIBLE, /No pude ver tu computadora/);
});

test('la puerta: desconectar frena la herramienta en la fila, y una PC ocupada no se da por apagada en un hueco', () => {
  const lib = sinComentarios(leer('lib/ia-pc.ts'));
  const espera = lib.slice(lib.indexOf('export async function esperarALaPc('));
  // Rota: correrla sin tomarla, o sin mirar el turno → este test falla (desconectada, la herramienta corría igual).
  assert.match(espera, /update\(\{ estado: 'corriendo' \}\)\.eq\('id', l\.id\)\.eq\('estado', 'esperando'\)\.select\('id'\)\.maybeSingle\(\);\s*if \(!tomada\) continue;/);
  assert.match(espera, /if \(!\(await turnoTomado\(\)\)\) \{\s*salida = 'El turno se cortó: no se corrió\.';/);
  assert.match(espera, /t\.estado === 'esperando' && Date\.now\(\) - inicio > SIN_TOMAR_MS && sinLatir\(SIN_TOMAR_MS\)/);
  assert.match(espera, /return pc\?\.revocado_at \? \{ desconectada: true \} : null;/);
  const pedir = lib.slice(lib.indexOf('export async function pedirLlamada('), lib.indexOf('export type Ejecutor'));
  assert.match(pedir, /if \(ev \|\| vivo\?\.estado !== 'tomado'\) return null;/, 'un turno cortado no recibe llamadas');
  assert.match(pedir, /return \{ salida: 'Se está corriendo y tarda: no la pidas de nuevo\.', esError: true \};/, 'la que corre no se saca');
  assert.match(leer('supabase/migrations/0322_ia_pc_pendiente.sql'), /'esperando', ?'corriendo', ?'lista'/);
});

test('El Archivero con su Claude en pausa dice la pausa, no «necesito tu clave»', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  // La pregunta se mudó a lib/archivero-ingesta.ts el 3/11/2026 (la API pregunta lo mismo, ticket #44).
  const ingesta = sinComentarios(leer('lib/archivero-ingesta.ts'));
  assert.match(ingesta, /async function puedeArchivarConSuIA\(\): Promise<'si' \| 'no' \| 'pausa'>/);
  assert.match(ingesta, /return claude && 'pausa' in claude \? 'pausa' : 'no';/);
  assert.match(t, /import \{ puedeArchivarConSuIA \} from '@\/lib\/archivero-ingesta';/);
  assert.match(t, /avisos\.push\(puede === 'pausa' \? AVISO_ARCHIVERO_EN_PAUSA : AVISO_SIN_ARCHIVERO\)/);
});
