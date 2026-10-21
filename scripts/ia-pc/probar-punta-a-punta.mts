// =============================================================================
// probar-punta-a-punta — la IA del cliente en SU computadora, de punta a punta, en el ws3 (docs/ia-del-cliente.md, ola 1)
// =============================================================================
// ⚠️ ESCRIBE EN LA BASE de .env.local (PRODUCCIÓN), y SÓLO en el ws3, el cliente de prueba: se niega con otro.
//
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/ia-pc/probar-punta-a-punta.mts --ws 3 --claude-dir <carpeta> [--env <.env.local>]
//   (`--claude-dir`: la carpeta de una cuenta de Claude Code con la sesión iniciada; sale por CLAUDE_CONFIG_DIR)
//
// Lo que hace, con las piezas DE VERDAD:
//   1. levanta las rutas de /api/ia-pc (los mismos route.ts) en un servidor local;
//   2. pide un código para una persona de prueba del ws3 y empareja la PC con el programa real (scripts/ia-pc/mako-pc.mjs);
//   3. deja el programa corriendo: late, toma turnos y corre Claude Code oficial, restringido a las herramientas de MaKo;
//   4. llama a `turnoApp` (el turno del Ops Center) dos veces: una lectura y una acción, que tiene que quedar en tarjeta;
//   5. cuenta qué herramientas pidió la PC, y desconecta la PC de prueba.
//
// `--instalador` (Windows) corre la línea del tutorial con el ejecutable de verdad, en una carpeta con tilde y ñ
// («José Muñoz»: la ruta no puede pasar por ASCII), y verifica lo que la revisión del Cerebro pidió (21/10/2026):
//   · el arranque es la clave Run de HKCU con la ruta EXACTA, y SIGUE ahí unos segundos después (Defender ponía en
//     cuarentena el MaKo.vbs de la 0.2.0 apenas se escribía);
//   · nada de MaKo en la carpeta Inicio;
//   · al desconectar la PC desde MaKo, el programa se saca solo del arranque y se apaga (401 `revocado`).
// `--reinstalar` (con `--instalador`; la segunda revisión, 21/10/2026, y la mig 0322 aplicada): con la PC andando, pega
// la línea OTRA vez y contesta «no» (lo que andaba tiene que seguir: el mismo proceso, la misma PC en MaKo, y la nueva
// pendiente soltada), y después otra vez con «sí» (el .exe se reemplaza con el viejo corriendo, queda UNO corriendo, la
// vieja soltada y la nueva activa).
// La limpieza saca todo lo que escribió (la clave, la carpeta, el proceso), y lo verifica.
// =============================================================================
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
// Se corre DESDE este repo (tsx resuelve `@/` con su tsconfig); el .env.local puede venir de otro clon con `--env`.
(dotenv.default ?? dotenv).config({ path: arg('--env') ?? path.join(process.cwd(), '.env.local'), quiet: true });
const WS = Number(arg('--ws'));
const CLAUDE_DIR = arg('--claude-dir');
if (WS !== 3) { console.error('⛔ sólo en el ws3 (el cliente de prueba): --ws 3'); process.exit(1); }
if (!CLAUDE_DIR) { console.error('⛔ falta --claude-dir <carpeta de una cuenta de Claude Code con sesión>'); process.exit(1); }
// `--instalador` (Windows, ola 2): en vez de `node mako-pc.mjs`, la línea de PowerShell del tutorial, con el ejecutable
// de verdad que bajó del bucket. ⚠️ Deja el arranque automático en Inicio: la limpieza del final lo saca.
const INSTALADOR = process.argv.includes('--instalador');
const REINSTALAR = INSTALADOR && process.argv.includes('--reinstalar');
const PUERTO = 4319;
// El instalador apunta al servidor de la app: acá, al local (antes de importar las rutas, que lo leen al cargar).
if (INSTALADOR) process.env.APP_BASE_URL = `http://localhost:${PUERTO}`;
// La carpeta del programa, con tilde y ñ (`$env:LOCALAPPDATA` del instalador apunta acá).
const LOCAL_PRUEBA = path.join(tmpdir(), `mako-pc-e2e-${Date.now()}`, 'José Muñoz', 'AppData', 'Local');
/** La clave Run del programa, leída de verdad (vacía si no está). */
const CLAVE_RUN = "(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MaKo' -ErrorAction SilentlyContinue).MaKo";

const { NextRequest } = await import('next/server');
const rutas = {
  emparejar: await imp('app/api/ia-pc/emparejar/route.ts'),
  latido: await imp('app/api/ia-pc/latido/route.ts'),
  turno: await imp('app/api/ia-pc/turno/route.ts'),
  contestar: await imp('app/api/ia-pc/turno/[id]/route.ts'),
  mcp: await imp('app/api/ia-pc/mcp/route.ts'),
  instalar: await imp('app/api/ia-pc/instalar/route.ts'),
  soltar: await imp('app/api/ia-pc/soltar/route.ts'),
  confirmar: await imp('app/api/ia-pc/confirmar/route.ts'),
};
const { crearCodigo, pcDe, desconectar } = await imp('lib/ia-pc.ts');
const { turnoApp, nuevaSesion } = await imp('lib/mako-turno-app.ts');
const { chartKeyDePersona } = await imp('lib/mako-turno-app-reglas.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');

// ── 1. Las rutas reales, en un servidor local ────────────────────────────────
const servidor = http.createServer(async (req, res) => {
  const cuerpo = await new Promise<Buffer>((ok) => { const b: Buffer[] = []; req.on('data', (c) => b.push(c)).on('end', () => ok(Buffer.concat(b))); });
  const url = `http://localhost:${PUERTO}${req.url}`;
  const r = new NextRequest(url, { method: req.method, headers: req.headers as Record<string, string>, ...(cuerpo.length ? { body: new Uint8Array(cuerpo) } : {}) });
  const p = new URL(url).pathname;
  const m = /^\/api\/ia-pc\/turno\/(\d+)$/.exec(p);
  const resp: Response = p === '/api/ia-pc/emparejar' ? await rutas.emparejar.POST(r)
    : p === '/api/ia-pc/latido' ? await rutas.latido.POST(r)
      : p === '/api/ia-pc/turno' ? await rutas.turno.GET(r)
        : m ? await rutas.contestar.POST(r, { params: Promise.resolve({ id: m[1] }) })
          : p === '/api/ia-pc/mcp' ? await (req.method === 'GET' ? rutas.mcp.GET() : rutas.mcp.POST(r))
            : p === '/api/ia-pc/instalar' ? await rutas.instalar.GET(r)
              : p === '/api/ia-pc/soltar' ? await rutas.soltar.POST(r)
                : p === '/api/ia-pc/confirmar' ? await rutas.confirmar.POST(r)
                  : new Response('no', { status: 404 });
  res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
  res.end(Buffer.from(await resp.arrayBuffer()));
});
await new Promise<void>((ok) => servidor.listen(PUERTO, ok));
console.log(`1. Rutas de /api/ia-pc en http://localhost:${PUERTO}`);

// ── 2. Emparejar una PC de prueba ────────────────────────────────────────────
const actor = 'prueba-ia-pc@hola-mako.com';
const persona = { ws: WS, rol: 'admin' as const, actor, chartKey: chartKeyDePersona({ email: actor })! };
// Como la pantalla: el código sale sólo con el texto aceptado (TEXTO_CONSENTIMIENTO, mig 0321).
const { VERSION_CONSENTIMIENTO } = await imp('lib/ia-pc-reglas.ts');
const { codigo } = await crearCodigo(WS, actor, VERSION_CONSENTIMIENTO);
const DIR_PC = path.join(tmpdir(), `mako-pc-prueba-${Date.now()}`);
mkdirSync(DIR_PC, { recursive: true });
const PROGRAMA = path.join(REPO, 'scripts', 'ia-pc', 'mako-pc.mjs');
const correr = (args: string[], fondo = false): Promise<string> | ChildProcess => {
  const p = spawn(process.execPath, [PROGRAMA, ...args], { env: { ...process.env, MAKO_PC_DIR: DIR_PC }, stdio: fondo ? 'inherit' : 'pipe' });
  if (fondo) return p;
  return new Promise((ok) => { let s = ''; p.stdout!.on('data', (b) => { s += b; }); p.stderr!.on('data', (b) => { s += b; }); p.on('close', () => ok(s.trim())); });
};
const ps = (comando: string, si = true) => new Promise<string>((ok) => {
  // `MAKO_PC_SI=1`: el «sí» a «¿Es tu negocio?» (lib/ia-pc-reglas.ts → scriptDeInstalacion), que acá no lo escribe nadie.
  // Sin él, `Read-Host` lee la entrada vacía: el «no».
  const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${comando}`], {
    env: { ...process.env, MAKO_PC_DIR: DIR_PC, CLAUDE_CONFIG_DIR: CLAUDE_DIR, LOCALAPPDATA: LOCAL_PRUEBA, ...(si ? { MAKO_PC_SI: '1' } : { MAKO_PC_SI: '' }) },
  });
  p.stdin.end();
  let s = ''; p.stdout.on('data', (b) => { s += b; }); p.stderr.on('data', (b) => { s += b; }); p.on('close', () => ok(s.trim()));
});
let pc: ChildProcess | null = null;
if (INSTALADOR) {
  // La MISMA línea que copia el cliente en el tutorial (lib/ia-pc-reglas.ts → lineaDeInstalacion).
  const { lineaDeInstalacion } = await imp('lib/ia-pc-reglas.ts');
  const linea = lineaDeInstalacion(`http://localhost:${PUERTO}`, 'windows', codigo);
  console.log(`2. ${linea}\n${(await ps(linea)).split('\n').map((l) => `   ${l}`).join('\n')}`);
  // El arranque: la clave Run con la ruta EXACTA (con la ñ), que sigue unos segundos después; y nada en Inicio.
  const exe = path.join(LOCAL_PRUEBA, 'MaKo', 'mako-pc.exe');
  const enInicio = async () => (await ps("Get-ChildItem ([Environment]::GetFolderPath('Startup')) -Filter 'MaKo*' -ErrorAction SilentlyContinue | ForEach-Object Name")).trim();
  const r0 = (await ps(CLAVE_RUN)).trim();
  await new Promise((ok) => setTimeout(ok, 15_000));
  const r1 = (await ps(CLAVE_RUN)).trim();
  const esperado = `"${exe}"`;
  console.log(`   arranque (clave Run): ${r0 === esperado ? 'OK, la ruta exacta' : `⛔ «${r0}» (esperaba «${esperado}»)`} · 15 s después: ${r1 === esperado ? 'SIGUE' : `⛔ «${r1}»`}`);
  console.log(`   carpeta Inicio: ${(await enInicio()) || 'nada de MaKo'}`);
} else {
  console.log(`2. ${await correr(['emparejar', codigo, '--servidor', `http://localhost:${PUERTO}`, '--nombre', 'Prueba ws3'])}`);
  console.log(`   ${await correr(['confirmar'])}`);
  const cfg = JSON.parse(readFileSync(path.join(DIR_PC, 'config.json'), 'utf8'));
  writeFileSync(path.join(DIR_PC, 'config.json'), JSON.stringify({ ...cfg, configDir: CLAUDE_DIR }, null, 2));
  // ── 3. El programa corriendo ───────────────────────────────────────────────
  pc = correr([], true) as ChildProcess;
}
let enLinea = false;
for (let i = 0; i < 40 && !enLinea; i++) { await new Promise((ok) => setTimeout(ok, 500)); enLinea = !!(await pcDe(WS, actor))?.enLinea; }
console.log(`3. La PC está ${enLinea ? 'EN LÍNEA' : 'sin conexión (falló el latido)'}`);
let dispositivo = await pcDe(WS, actor);

// ── 3b. Reinstalar sobre la que anda: con «no», y con «sí» (segunda revisión del Cerebro) ──────────────────────────
if (REINSTALAR && dispositivo) {
  const { lineaDeInstalacion } = await imp('lib/ia-pc-reglas.ts');
  const procesos = async () => (await ps("@(Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue | ForEach-Object Id) -join ','")).trim();
  const filas = async () => (await getSupabaseServer().from('ia_pc_dispositivos').select('id, revocado_at, confirmado_at, activa_at')
    .eq('workspace_id', WS).eq('persona', actor).order('id')).data ?? [];
  const antes = await procesos();
  const no = await crearCodigo(WS, actor, VERSION_CONSENTIMIENTO);
  const salidaNo = await ps(lineaDeInstalacion(`http://localhost:${PUERTO}`, 'windows', no.codigo), false);
  await new Promise((ok) => setTimeout(ok, 3_000));
  const trasNo = await procesos();
  const pcTrasNo = await pcDe(WS, actor);
  const fNo = await filas();
  const pendienteSoltada = fNo.length >= 2 && fNo.at(-1)?.revocado_at != null && fNo.at(-1)?.confirmado_at == null;
  console.log(`3b. Reinstalar y decir «no»: ${/No la conecté/.test(salidaNo) ? 'dijo «No la conecté»' : `⛔ dijo «${salidaNo.slice(-200)}»`}`);
  console.log(`    el programa: ${antes && trasNo === antes ? 'el MISMO proceso sigue' : `⛔ antes ${antes}, después ${trasNo || 'ninguno'}`} · la PC en MaKo: ${pcTrasNo?.id === dispositivo.id && pcTrasNo.enLinea ? 'la misma, en línea' : '⛔ cambió o se apagó'} · la nueva: ${pendienteSoltada ? 'soltada sin confirmar' : '⛔ quedó'}`);
  const si = await crearCodigo(WS, actor, VERSION_CONSENTIMIENTO);
  const salidaSi = await ps(lineaDeInstalacion(`http://localhost:${PUERTO}`, 'windows', si.codigo));
  let nueva: Awaited<ReturnType<typeof pcDe>> = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((ok) => setTimeout(ok, 1_000));
    nueva = await pcDe(WS, actor);
    if (nueva && nueva.id !== dispositivo.id && nueva.enLinea && nueva.activa) break;
  }
  const trasSi = await procesos();
  const fSi = await filas();
  const vieja = fSi.find((f: { id: number }) => f.id === dispositivo!.id);
  console.log(`3c. Reinstalar y decir «sí»: ${/está siendo utilizado|being used/i.test(salidaSi) ? '⛔ el .exe en uso' : 'sin «en uso»'} · procesos: ${trasSi && !trasSi.includes(',') && trasSi !== antes ? 'UNO, el nuevo' : `⛔ ${trasSi || 'ninguno'}`}`);
  console.log(`    la nueva: ${nueva && nueva.id !== dispositivo.id && nueva.activa ? 'confirmada, activa y en línea' : '⛔ no quedó activa'} · la vieja: ${vieja?.revocado_at ? 'soltada' : '⛔ sigue'}`);
  console.log(salidaSi.split('\n').map((l) => `    ${l}`).join('\n'));
  dispositivo = nueva ?? dispositivo;
}

// ── 4. Dos turnos del Ops Center ─────────────────────────────────────────────
const resumen = async (titulo: string, mensaje: string) => {
  const sesion = await nuevaSesion(persona);
  const t0 = Date.now();
  const r = await turnoApp(persona, sesion.id, { mensaje });
  const { data: turnos } = await getSupabaseServer().from('ia_pc_turnos').select('id, estado, cuenta').eq('sesion_id', sesion.id);
  const ids = (turnos ?? []).map((x: { id: number }) => x.id);
  const { data: llamadas } = ids.length ? await getSupabaseServer().from('ia_pc_llamadas').select('nombre, es_error').in('turno_id', ids) : { data: [] };
  const deMako = r?.mensajes?.find((m: { role: string }) => m.role === 'assistant')?.content ?? '';
  console.log(`\n4. ${titulo} («${mensaje}»), ${Math.round((Date.now() - t0) / 1000)} s:`);
  console.log(`   turno en la PC: ${JSON.stringify(turnos)}`);
  console.log(`   herramientas que pidió: ${(llamadas ?? []).map((l: { nombre: string; es_error: boolean }) => `${l.nombre}${l.es_error ? ' (error)' : ''}`).join(', ') || '—'}`);
  console.log(`   MaKo: ${String(deMako).replace(/\s+/g, ' ').slice(0, 300) || '—'}`);
  console.log(`   aviso: ${r?.aviso ?? '—'} · tarjetas: ${r?.propuestas?.length ?? 0}`);
};
if (enLinea && INSTALADOR) {
  await resumen('Una lectura, con el ejecutable instalado', '¿Qué tareas tengo en el plan? Usa tus herramientas.');
} else if (enLinea) {
  await resumen('Una lectura', '¿Cuántos leads tengo en el CRM? Usa tus herramientas para contarlos.');
  await resumen('Una acción (tiene que quedar en tarjeta)', process.env.MENSAJE_ACCION ?? 'Agrega un lead nuevo: Juan Pérez, teléfono +54 9 11 5555 1234, viene de Instagram.');
}

// ── 5. Desconectar y limpiar ─────────────────────────────────────────────────
if (dispositivo) await desconectar(WS, dispositivo.id);
if (INSTALADOR) {
  // Desconectada desde MaKo, el programa se tiene que sacar SOLO del arranque y apagarse (en el próximo latido, ≤ 30 s).
  const vivo = async () => (await ps("@(Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue).Count")).trim();
  let solo = false;
  for (let i = 0; i < 25 && !solo; i++) { await new Promise((ok) => setTimeout(ok, 2_000)); solo = (await vivo()) === '0' && !(await ps(CLAVE_RUN)).trim(); }
  console.log(`\n5. Desconectada desde MaKo: ${solo ? 'el programa se sacó del arranque y se apagó solo' : '⛔ el programa sigue (o la clave Run quedó)'}`);
  // Lo que haya quedado igual se saca, y se verifica.
  await ps("Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue | Stop-Process -Force; Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'MaKo' -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500");
  // Con reintentos: el .exe recién cerrado tarda en soltarse (medido el 21/10/2026: quedaban las carpetas vacías).
  rmSync(path.dirname(path.dirname(path.dirname(LOCAL_PRUEBA))), { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  const quedo = [(await vivo()) !== '0' ? 'el proceso' : '', (await ps(CLAVE_RUN)).trim() ? 'la clave Run' : '', existsSync(LOCAL_PRUEBA) ? 'la carpeta' : ''].filter(Boolean);
  console.log(`   limpieza: ${quedo.length ? `⛔ quedó ${quedo.join(', ')}` : 'no quedó nada (proceso, clave Run, carpeta)'}`);
} else {
  pc?.kill();
  console.log('\n5. La PC de prueba quedó desconectada.');
}
servidor.close();
process.exit(0);
