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
// =============================================================================
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const { NextRequest } = await import('next/server');
const rutas = {
  emparejar: await imp('app/api/ia-pc/emparejar/route.ts'),
  latido: await imp('app/api/ia-pc/latido/route.ts'),
  turno: await imp('app/api/ia-pc/turno/route.ts'),
  contestar: await imp('app/api/ia-pc/turno/[id]/route.ts'),
  mcp: await imp('app/api/ia-pc/mcp/route.ts'),
};
const { crearCodigo, pcDe, desconectar } = await imp('lib/ia-pc.ts');
const { turnoApp, nuevaSesion } = await imp('lib/mako-turno-app.ts');
const { chartKeyDePersona } = await imp('lib/mako-turno-app-reglas.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');

// ── 1. Las rutas reales, en un servidor local ────────────────────────────────
const PUERTO = 4319;
const servidor = http.createServer(async (req, res) => {
  const cuerpo = await new Promise<Buffer>((ok) => { const b: Buffer[] = []; req.on('data', (c) => b.push(c)).on('end', () => ok(Buffer.concat(b))); });
  const url = `http://localhost:${PUERTO}${req.url}`;
  const r = new NextRequest(url, { method: req.method, headers: req.headers as Record<string, string>, ...(cuerpo.length ? { body: cuerpo } : {}) });
  const p = new URL(url).pathname;
  const m = /^\/api\/ia-pc\/turno\/(\d+)$/.exec(p);
  const resp: Response = p === '/api/ia-pc/emparejar' ? await rutas.emparejar.POST(r)
    : p === '/api/ia-pc/latido' ? await rutas.latido.POST(r)
      : p === '/api/ia-pc/turno' ? await rutas.turno.GET(r)
        : m ? await rutas.contestar.POST(r, { params: Promise.resolve({ id: m[1] }) })
          : p === '/api/ia-pc/mcp' ? await (req.method === 'GET' ? rutas.mcp.GET() : rutas.mcp.POST(r))
            : new Response('no', { status: 404 });
  res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
  res.end(Buffer.from(await resp.arrayBuffer()));
});
await new Promise<void>((ok) => servidor.listen(PUERTO, ok));
console.log(`1. Rutas de /api/ia-pc en http://localhost:${PUERTO}`);

// ── 2. Emparejar una PC de prueba ────────────────────────────────────────────
const actor = 'prueba-ia-pc@hola-mako.com';
const persona = { ws: WS, rol: 'admin' as const, actor, chartKey: chartKeyDePersona({ email: actor })! };
const { codigo } = await crearCodigo(WS, actor);
const DIR_PC = path.join(tmpdir(), `mako-pc-prueba-${Date.now()}`);
mkdirSync(DIR_PC, { recursive: true });
const PROGRAMA = path.join(REPO, 'scripts', 'ia-pc', 'mako-pc.mjs');
const correr = (args: string[], fondo = false): Promise<string> | ChildProcess => {
  const p = spawn(process.execPath, [PROGRAMA, ...args], { env: { ...process.env, MAKO_PC_DIR: DIR_PC }, stdio: fondo ? 'inherit' : 'pipe' });
  if (fondo) return p;
  return new Promise((ok) => { let s = ''; p.stdout!.on('data', (b) => { s += b; }); p.stderr!.on('data', (b) => { s += b; }); p.on('close', () => ok(s.trim())); });
};
console.log(`2. ${await correr(['emparejar', codigo, '--servidor', `http://localhost:${PUERTO}`, '--nombre', 'Prueba ws3'])}`);
const cfg = JSON.parse(readFileSync(path.join(DIR_PC, 'config.json'), 'utf8'));
writeFileSync(path.join(DIR_PC, 'config.json'), JSON.stringify({ ...cfg, configDir: CLAUDE_DIR }, null, 2));

// ── 3. El programa corriendo ─────────────────────────────────────────────────
const pc = correr([], true) as ChildProcess;
let enLinea = false;
for (let i = 0; i < 40 && !enLinea; i++) { await new Promise((ok) => setTimeout(ok, 500)); enLinea = !!(await pcDe(WS, actor))?.enLinea; }
console.log(`3. La PC está ${enLinea ? 'EN LÍNEA' : 'sin conexión (falló el latido)'}`);
const dispositivo = await pcDe(WS, actor);

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
if (enLinea) {
  await resumen('Una lectura', '¿Cuántos leads tengo en el CRM? Usa tus herramientas para contarlos.');
  await resumen('Una acción (tiene que quedar en tarjeta)', process.env.MENSAJE_ACCION ?? 'Agrega un lead nuevo: Juan Pérez, teléfono +54 9 11 5555 1234, viene de Instagram.');
}

// ── 5. Limpieza ──────────────────────────────────────────────────────────────
pc.kill();
if (dispositivo) await desconectar(WS, dispositivo.id);
servidor.close();
console.log('\n5. La PC de prueba quedó desconectada.');
process.exit(0);
