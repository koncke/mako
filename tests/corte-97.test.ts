// El corte del 97% (scripts/claude-hooks/guardia/corte-97.mjs, la copia versionada de ~/.claude/guardia/corte-97.mjs).
// 28/10/2026, Martín: «al llegar al 97% deben frenar y asegurarse de que esté todo el contexto de todo el trabajo desde que
// se inició en esa cuenta... Así yo paso a la siguiente y le digo "Continua"», y «No frenes la investigación de pedidos
// perdidos». Se corre el script de verdad, con una casa de mentira (MAKO_CORTE_CASA), y se mira lo que contesta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'claude-hooks', 'guardia', 'corte-97.mjs');
const EN_UNA_HORA = new Date(Date.now() + 3600_000).toISOString();
const HACE_UNA_HORA = new Date(Date.now() - 3600_000).toISOString();

function casa(cinco: string | null, semanal: string | null = null) {
  const dir = mkdtempSync(join(tmpdir(), 'corte-97-'));
  writeFileSync(join(dir, 'cuenta-activa.txt'), 'claude9\n');
  if (cinco) writeFileSync(join(dir, 'uso-cinco.txt'), cinco);
  if (semanal) writeFileSync(join(dir, 'uso-semanal.txt'), semanal);
  return dir;
}

function correr(dir: string, modo: 'turno' | 'herramienta', entrada: Record<string, unknown> = {}) {
  const salida = execFileSync(process.execPath, [SCRIPT, modo], {
    input: JSON.stringify({ session_id: 'ses-1', cwd: dir, transcript_path: '/t/ses-1.jsonl', ...entrada }),
    env: { ...process.env, MAKO_CORTE_CASA: dir, MAKO_CORTE_PCT: '' },
    encoding: 'utf8',
  }).trim();
  return salida ? JSON.parse(salida).hookSpecificOutput : null;
}

const lleno = `97 ${EN_UNA_HORA} ${new Date().toISOString()} claude9`;

test('por debajo del 97% no dice nada y no niega nada', () => {
  const dir = casa(`96 ${EN_UNA_HORA} x claude9`, `80 ${EN_UNA_HORA} x claude9`);
  try {
    assert.equal(correr(dir, 'turno'), null);
    assert.equal(correr(dir, 'herramienta', { tool_name: 'Workflow' }), null);
    assert.equal(existsSync(join(dir, 'relevos-cuenta')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('al 97% pide el relevo de TODA la cuenta, el journal de lo que corre, y nombra el registro', () => {
  const dir = casa(lleno);
  try {
    const r = correr(dir, 'turno');
    assert.equal(r.hookEventName, 'UserPromptSubmit');
    assert.match(r.additionalContext, /TODO el trabajo de esta cuenta/);
    assert.match(r.additionalContext, /journal\.jsonl/);
    assert.match(r.additionalContext, /NO lo frenes/);
    assert.match(r.additionalContext, /Continua/);
    assert.match(r.additionalContext, /relevos-cuenta/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el registro anota UNA vez por sesión: carpeta, rama y transcript', () => {
  const dir = casa(lleno);
  try {
    correr(dir, 'turno');
    correr(dir, 'herramienta', { tool_name: 'Workflow' });
    correr(dir, 'turno');
    const filas = readFileSync(join(dir, 'relevos-cuenta', 'claude9.tsv'), 'utf8').trim().split('\n');
    assert.equal(filas.length, 2, 'la cabecera y una sola fila para ses-1');
    assert.match(filas[1], /\/t\/ses-1\.jsonl/);
    assert.ok(filas[1].includes(dir), 'la carpeta de la sesión');
    correr(dir, 'turno', { session_id: 'ses-2' });
    assert.equal(readFileSync(join(dir, 'relevos-cuenta', 'claude9.tsv'), 'utf8').trim().split('\n').length, 3, 'otra sesión, otra fila');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('niega lanzar lo que gasta y deja guardar', () => {
  const dir = casa(null, lleno);
  try {
    for (const tool of ['Workflow', 'Agent', 'Task']) assert.equal(correr(dir, 'herramienta', { tool_name: tool })?.permissionDecision, 'deny', tool);
    assert.equal(correr(dir, 'herramienta', { tool_name: 'Bash', tool_input: { command: 'npm test' } })?.permissionDecision, 'deny');
    for (const command of ['git commit -- docs/relevo/crm.md -F m.txt', 'git -C C:/dev/wt-x add docs/relevo/x.md', 'cd C:/dev/wt-x && git status', 'cat docs/relevo/x.md']) {
      assert.equal(correr(dir, 'herramienta', { tool_name: 'Bash', tool_input: { command } }), null, command);
    }
    for (const tool of ['Write', 'Edit', 'Read', 'SendMessage']) assert.equal(correr(dir, 'herramienta', { tool_name: tool }), null, tool);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a un subagente que ya corre no lo corta: «No frenes la investigación»', () => {
  const dir = casa(lleno);
  try {
    assert.equal(correr(dir, 'herramienta', { tool_name: 'Bash', tool_input: { command: 'npm test' }, agent_id: 'a-1' }), null);
    assert.equal(correr(dir, 'herramienta', { tool_name: 'Bash', tool_input: { command: 'npm test' }, agent_type: 'general-purpose' }), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('no cuenta un número de otra cuenta, una ventana ya renovada, ni con el interruptor puesto', () => {
  const otra = casa(`99 ${EN_UNA_HORA} x claude3`);
  const vieja = casa(`99 ${HACE_UNA_HORA} x claude9`);
  const apagado = casa(lleno);
  try {
    assert.equal(correr(otra, 'turno'), null);
    assert.equal(correr(vieja, 'turno'), null);
    mkdirSync(join(apagado, 'guardia'));
    writeFileSync(join(apagado, 'guardia', 'sin-corte'), 'apagado');
    assert.equal(correr(apagado, 'herramienta', { tool_name: 'Workflow' }), null);
  } finally { for (const d of [otra, vieja, apagado]) rmSync(d, { recursive: true, force: true }); }
});
