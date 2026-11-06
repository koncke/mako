// =============================================================================
// Qué se construye en Vercel (6/11/2026): cada build de mako cuesta unos US$0,32
// =============================================================================
// El gasto se multiplicó por 30 entre el 20/10 y el 4/11: docs/hallazgos-infra.md, «El gasto de Vercel». Dos llaves viven
// en el repo: las ramas que no se miran no construyen (vercel.json), y lo que sólo cambia documentos o tests tampoco
// (scripts/vercel-saltar-build.sh). Corre el script de verdad contra un repo de git armado acá. Ante la duda, construye.
// PROBADO ROMPIÉNDOLO (6/11/2026), con el archivo en verde (5 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · un archivo de la app no construye                → 4 / 1
//   · los dos documentos de producto se saltean        → 4 / 1
//   · sin el deploy anterior, saltea                   → 4 / 1
//   · con un commit que no llegó al clon, saltea       → 4 / 1
//   · un redeploy sin cambios, saltea                  → 4 / 1
//   · `claude/**` vuelve a construir previews          → 4 / 1
// Correr: node --import tsx --test tests/vercel-saltar-build.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(RAIZ, 'scripts', 'vercel-saltar-build.sh');

function repoCon(cambios: readonly string[]): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vercel-saltar-'));
  const git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...a], { cwd: dir, encoding: 'utf8' }).trim();
  const escribir = (f: string, texto: string) => { mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), texto); };
  git('init', '-q');
  escribir('lib/x.ts', 'export const x = 1;\n');
  escribir('docs/a.md', 'a\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  for (const f of cambios) escribir(f, `cambió ${f}\n`);
  if (cambios.length) { git('add', '-A'); git('commit', '-qm', 'cambio'); }
  return { dir, base };
}

/** true = construye (exit 1); false = se saltea (exit 0). Cualquier otro código hace fallar el test. */
function construye(cambios: readonly string[], base?: (real: string) => string | undefined): boolean {
  const r = repoCon(cambios);
  try {
    const previo = base ? base(r.base) : r.base;
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.VERCEL_GIT_PREVIOUS_SHA;
    if (previo !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previo;
    const s = spawnSync('bash', [SCRIPT], { cwd: r.dir, env, encoding: 'utf8' });
    assert.ok(s.status === 0 || s.status === 1, `salió con ${s.status}: ${s.stderr}`);
    return s.status === 1;
  } finally {
    rmSync(r.dir, { recursive: true, force: true });
  }
}

test('lo que sólo cambia documentos, tests o Actions no construye', () => {
  assert.equal(construye(['docs/relevo/x.md']), false);
  assert.equal(construye(['tests/x.test.ts', '.github/workflows/y.yml', 'AGENTS.md', 'docs/z.md']), false);
});

test('un archivo de la app entre los cambios construye', () => {
  assert.equal(construye(['lib/x.ts']), true);
  assert.equal(construye(['docs/a.md', 'app/page.tsx']), true);
  assert.equal(construye(['vercel.json']), true);
  assert.equal(construye(['scripts/x.mjs']), true, 'hay scripts que entran al deploy');
});

test('los dos documentos que son pantallas de producto construyen', () => {
  assert.equal(construye(['docs/offer-marco.md']), true);
  assert.equal(construye(['docs/estrategia-financiera-mako.md']), true);
  const next = readFileSync(join(RAIZ, 'next.config.ts'), 'utf8');
  const traidos = [...next.matchAll(/'\.\/docs\/([a-z0-9-]+\.md)'/g)].map((m) => m[1]);
  const script = readFileSync(SCRIPT, 'utf8');
  assert.ok(traidos.length >= 2, 'no encontré los documentos que traza next.config.ts');
  for (const d of traidos) assert.ok(script.includes(`docs/${d}`), `${d} entra al deploy de una pantalla y el script lo saltearía`);
});

test('ante la duda construye: sin el deploy anterior, con un commit que no llegó, o sin cambios', () => {
  assert.equal(construye(['docs/x.md'], () => undefined), true);
  assert.equal(construye(['docs/x.md'], () => ''), true);
  assert.equal(construye(['docs/x.md'], () => '0123456789012345678901234567890123456789'), true);
  assert.equal(construye([]), true, 'un redeploy sin cambios es a propósito');
});

test('vercel.json: las ramas de trabajo no construyen, main sí, y el paso de saltear está puesto', () => {
  const v = JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { ignoreCommand?: string; git?: { deploymentEnabled?: Record<string, boolean> } };
  const ramas = v.git?.deploymentEnabled ?? {};
  for (const r of ['claude/**', 'punta/**', 'integracion', 'ci-rojo/**', 'espera-main/**']) assert.equal(ramas[r], false, `${r} construiría un preview en cada push`);
  assert.notEqual(ramas.main, false, 'main es producción');
  assert.equal(v.ignoreCommand, 'bash scripts/vercel-saltar-build.sh');
});
