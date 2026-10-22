// Mide qué cambia en los turnos de MaKo entre DOS COMMITS: extrae cada árbol por SHA (`git archive`, nunca un worktree vivo), corre
// scripts/volcar-turnos.mts UNA VEZ por árbol y en su propio proceso, y compara byte a byte. Lo que se mide es un commit, no el estado de
// una carpeta que alguien está editando ni un módulo cacheado por el otro árbol (docs/hallazgos-ia.md, «El arnés por SHA»).
//
// Uso (cwd = la raíz del repo):
//   node --import tsx scripts/medir-turnos-por-sha.mts <antes> <después> [--canal=app|whatsapp|ambos] [--frases=archivo.json] [--max=N] [--reusar] [--exigir-igual]
// · <antes> y <después> son cualquier ref de git (origin/main, un SHA, HEAD).
// · sin --frases, las frases son TODOS los literales de texto de tests/*.test.ts del cwd (decenas de miles).
// · --reusar: si ya existe el volcado de esos dos SHA (la misma carpeta de salida), sólo vuelve a comparar.
// · --exigir-igual: sale con código 1 si algún turno cambió (es la prueba de «WhatsApp no cambia»).
// Deja en <tmp>/turnos-por-sha/salida-<antes>-<después>/ el volcado de cada árbol y las diferencias completas.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const refs = args.filter((a) => !a.startsWith('--'));
const opcion = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (refs.length !== 2) throw new Error('uso: medir-turnos-por-sha.mts <antes> <después> [--canal=app|whatsapp|ambos] [--frases=archivo.json] [--max=N] [--exigir-igual]');

const RAIZ = process.cwd();
const git = (...a: string[]) => execFileSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const [antes, despues] = refs.map((r) => git('rev-parse', '--verify', `${r}^{commit}`));
const BASE = join(tmpdir(), 'turnos-por-sha');
const SALIDA = join(BASE, `salida-${antes.slice(0, 9)}-${despues.slice(0, 9)}`);
mkdirSync(SALIDA, { recursive: true });

/** El árbol de un commit en <tmp>/turnos-por-sha/<sha>: lib y app (lib importa de app en tiempo de ejecución), con node_modules enlazado. */
function extraer(sha: string): string {
  const dir = join(BASE, sha.slice(0, 9));
  if (existsSync(join(dir, '.extraido'))) return dir;
  mkdirSync(dir, { recursive: true });
  const tar = join(BASE, `${sha.slice(0, 9)}.tar`);
  execFileSync('git', ['archive', '--format=tar', '--output', tar, sha, 'lib', 'app', 'tsconfig.json', 'package.json'], { cwd: RAIZ });
  // Con rutas relativas: el tar de Git para Windows lee «C:» como un host remoto.
  execFileSync('tar', ['-xf', `../${sha.slice(0, 9)}.tar`], { cwd: dir });
  if (!existsSync(join(dir, 'node_modules'))) symlinkSync(join(RAIZ, 'node_modules'), join(dir, 'node_modules'), 'junction');
  writeFileSync(join(dir, '.extraido'), sha);
  return dir;
}

/** Todos los literales de texto de los tests: lo que la gente escribe, lo que los tests fijan y bastante ruido que no hace daño. */
function frasesDeLosTests(): string[] {
  const vistos = new Set<string>();
  const RE = /(['"])((?:\\.|(?!\1)[^\\\n]){4,300})\1/g;
  for (const f of readdirSync(join(RAIZ, 'tests')).filter((x) => x.endsWith('.test.ts'))) {
    const texto = readFileSync(join(RAIZ, 'tests', f), 'utf8');
    for (const m of texto.matchAll(RE)) {
      const s = m[2].replace(/\\n/g, '\n').replace(/\\(['"\\])/g, '$1');
      if (/[a-záéíóúñ]/i.test(s) && /\s/.test(s) && !/^(?:\.{0,2}\/|@\/|lib\/|app\/|node:)/.test(s)) vistos.add(s);
    }
  }
  return [...vistos];
}

const archivoFrases = opcion('frases') ? resolve(opcion('frases')!) : join(SALIDA, 'frases.json');
if (!opcion('frases')) {
  let frases = frasesDeLosTests();
  const max = Number(opcion('max') ?? 0);
  if (max > 0) frases = frases.slice(0, max);
  writeFileSync(archivoFrases, JSON.stringify({ frases }));
  console.log(`${frases.length} frases de los tests → ${archivoFrases}`);
}

const VOLCAR = resolve(RAIZ, 'scripts', 'volcar-turnos.mts');
function volcar(dir: string, canal: string, salida: string): Promise<string> {
  return new Promise((ok, mal) => {
    const p = spawn(process.execPath, ['--conditions=react-server', '--import', 'tsx', VOLCAR, canal, archivoFrases, salida], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; let e = '';
    p.stdout.on('data', (d) => { o += d; }); p.stderr.on('data', (d) => { e += d; });
    p.on('close', (c) => (c === 0 ? ok(o.trim()) : mal(new Error(`volcar ${canal} en ${dir} terminó con ${c}:\n${e.slice(-1500)}`))));
  });
}

/**
 * Las líneas de un archivo, separadas SÓLO por «\n». No sirve `readline`: corta también en \r, U+2028 y U+2029, que `JSON.stringify`
 * deja sin escapar en el texto de una frase, y una línea del volcado quedaba partida en dos.
 */
async function* lineasDe(archivo: string): AsyncGenerator<string> {
  let resto = '';
  for await (const trozo of createReadStream(archivo, { encoding: 'utf8' })) {
    const partes = (resto + trozo).split('\n');
    resto = partes.pop() ?? '';
    for (const p of partes) yield p;
  }
  if (resto) yield resto;
}

type TurnoVolcado = { v?: { intencion?: string; dudosa?: boolean }; tools: string[]; error?: string };

/** Un volcado de WhatsApp pasa de los 500 MB (12 contextos × decenas de miles de frases): se lee en flujo y de cada turno sólo queda su hash. */
async function hashesDe(archivo: string): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for await (const l of lineasDe(archivo)) {
    if (!l) continue;
    const j = JSON.parse(l) as { k: string; r: unknown };
    m.set(j.k, createHash('md5').update(JSON.stringify(j.r)).digest('hex'));
  }
  return m;
}
/** Segunda pasada: sólo los turnos pedidos, completos. */
async function turnosDe(archivo: string, claves: ReadonlySet<string>): Promise<Map<string, unknown>> {
  const m = new Map<string, unknown>();
  if (!claves.size) return m;
  for await (const l of lineasDe(archivo)) {
    if (!l) continue;
    const j = JSON.parse(l) as { k: string; r: unknown };
    if (claves.has(j.k)) m.set(j.k, j.r);
  }
  return m;
}
const sinHash = (t: string): string => t.split('#')[0];

let hayDiferencias = false;
const canales = (opcion('canal') ?? 'ambos') === 'ambos' ? ['app', 'whatsapp'] : [opcion('canal')!];
const dirAntes = extraer(antes);
const dirDespues = extraer(despues);
console.log(`antes   ${antes.slice(0, 9)} → ${dirAntes}\ndespués ${despues.slice(0, 9)} → ${dirDespues}`);

for (const canal of canales) {
  const a = join(SALIDA, `${canal}-antes.jsonl`);
  const d = join(SALIDA, `${canal}-despues.jsonl`);
  // Un proceso por árbol, a la vez. Con --reusar, si el volcado de los dos SHA ya está en la carpeta de salida no se vuelve a hacer.
  if (args.includes('--reusar') && existsSync(a) && existsSync(d)) console.log(`  ${canal}: se reusa el volcado de ${SALIDA}`);
  else {
    const [oa, od] = await Promise.all([volcar(dirAntes, canal, a), volcar(dirDespues, canal, d)]);
    console.log(`  ${oa}\n  ${od}`);
  }
  const HA = await hashesDe(a);
  const HD = await hashesDe(d);
  const claves = [...new Set([...HA.keys(), ...HD.keys()])];
  const cambian = claves.filter((k) => HA.get(k) !== HD.get(k));
  const quienes = new Set(cambian);
  const A = await turnosDe(a, quienes);
  const D = await turnosDe(d, quienes);
  const transiciones = new Map<string, number>();
  const ganan = new Map<string, number>();
  const pierden = new Map<string, { n: number; ejemplos: string[] }>();
  const cambianDefinicion = new Map<string, number>();
  let unTurnoRoto = 0;
  const completo = join(SALIDA, `${canal}-diferencias.jsonl`);
  const filas: string[] = [];
  for (const k of cambian) {
    const ra = (A.get(k) ?? null) as TurnoVolcado | null;
    const rd = (D.get(k) ?? null) as TurnoVolcado | null;
    filas.push(JSON.stringify({ k, antes: ra, despues: rd }));
    if (!ra || !rd || ra.error || rd.error) { unTurnoRoto++; continue; }
    const t = `${ra.v?.intencion}${ra.v?.dudosa ? '(dudosa)' : ''} → ${rd.v?.intencion}${rd.v?.dudosa ? '(dudosa)' : ''}`;
    transiciones.set(t, (transiciones.get(t) ?? 0) + 1);
    const na = new Map<string, string>((ra.tools as string[]).map((x) => [sinHash(x), x]));
    const nd = new Map<string, string>((rd.tools as string[]).map((x) => [sinHash(x), x]));
    for (const [n, x] of nd) if (!na.has(n)) ganan.set(n, (ganan.get(n) ?? 0) + 1); else if (na.get(n) !== x) cambianDefinicion.set(n, (cambianDefinicion.get(n) ?? 0) + 1);
    for (const n of na.keys()) if (!nd.has(n)) {
      const e = pierden.get(n) ?? { n: 0, ejemplos: [] };
      e.n++; if (e.ejemplos.length < 3) e.ejemplos.push(k);
      pierden.set(n, e);
    }
  }
  writeFileSync(completo, `${filas.join('\n')}\n`);
  const top = (m: Map<string, number>, n = 12) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${v}\t${k}`).join('\n    ');
  const resumen = [
    `=== ${canal}: ${claves.length} turnos, ${cambian.length} cambian (${((100 * cambian.length) / Math.max(1, claves.length)).toFixed(1)}%)${unTurnoRoto ? `, ${unTurnoRoto} con error en alguno de los dos` : ''}`,
    `  intención antes → después:\n    ${top(transiciones) || '(ninguna)'}`,
    `  herramientas que GANAN (por cuántos turnos):\n    ${top(ganan, 15) || '(ninguna)'}`,
    `  herramientas que PIERDEN:\n    ${[...pierden.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 25).map(([n, e]) => `${e.n}\t${n}   p. ej. ${e.ejemplos.map((x) => `«${x.slice(0, 60)}»`).join(', ')}`).join('\n    ') || '(ninguna)'}`,
    `  herramientas que cambian de definición:\n    ${top(cambianDefinicion) || '(ninguna)'}`,
    `  diferencias completas: ${completo}`,
  ].join('\n');
  writeFileSync(join(SALIDA, `${canal}-resumen.txt`), resumen);
  console.log(resumen);
  if (cambian.length) hayDiferencias = true;
}
if (args.includes('--exigir-igual') && hayDiferencias) { console.error('HAY DIFERENCIAS y se pidió que no hubiera ninguna'); process.exit(1); }
