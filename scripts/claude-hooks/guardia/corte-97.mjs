#!/usr/bin/env node
// =============================================================================
// corte-97.mjs — al 97% de la ventana de 5 horas o de la semanal, cada chat GUARDA TODO y corta
// =============================================================================
// Pedido de Martín (17/10/2026): «Si estás por llegar al 100% de las 5 horas o el semanal, corta, tal vez en 97%».
// El 18/10 lo apagó («sacá el límite de 97%», guardia/sin-corte). El 28/10/2026 lo volvió a pedir, para TODAS las cuentas
// y con otro fin, escrito en la app (chat Cerebro):
//   «Para todas las cuentas, como regla, al llegar al 97% deben frenar y asegurarse de que esté todo el contexto de todo
//    el trabajo desde que se inició en esa cuenta... Así yo paso a la siguiente y le digo "Continua" y ya sabe».
// Y en el mismo mensaje: «No frenes la investigación de pedidos perdidos, porque cuando se acabe la cuota justamente eso
// me sirve para la próxima cuenta». Por eso lo que YA corre en un subagente (los agentes de un workflow, un Agent) no se
// corta: se corta LANZAR uno nuevo. Lo que el workflow devuelve queda en su journal.jsonl y el relevo dice dónde.
//
// De dónde sale el número: ~/.claude/uso-semanal.txt y ~/.claude/uso-cinco.txt, una línea cada uno:
//   <pct> <resetsAt ISO> <medido ISO> <cuenta>
// Los escribe el Runner en cada vuelta (cartero.mjs, cada 2 min) y los chats cuando bitacora-sesion.sh les pide medir.
// Un número de OTRA cuenta, o de una ventana que ya se renovó (resetsAt en el pasado), no cuenta.
//
// Tres piezas:
//   turno        (UserPromptSubmit) — le pide al chat el relevo de TODA la cuenta, el commit, y que termine el turno.
//   herramienta  (PreToolUse)       — NIEGA lanzar Workflow/Agent/Task y los comandos que gastan, con el mismo pedido como
//                                     motivo (un chat a mitad de un turno largo se entera por acá). Deja pasar git, leer y
//                                     escribir archivos: lo justo para el relevo y el commit. Un subagente no se toca.
//   registro     — la primera vez que una sesión cruza, anota en ~/.claude/relevos-cuenta/<cuenta>.tsv su carpeta, su rama
//                  y su transcript. Con eso la cuenta que viene, al «Continua», sabe qué chats cortaron y dónde está el
//                  relevo de cada uno, sin depender de que un chat se haya acordado de avisar.
// Regla de la casa (como memoria.mjs): un error de este script NUNCA bloquea: ante cualquier excepción, exit 0.
// =============================================================================
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CASA = process.env.MAKO_CORTE_CASA || path.join(os.homedir(), '.claude');
const TOPE = Number(process.env.MAKO_CORTE_PCT) || 97;
const modo = process.argv[2] || 'turno';

// Interruptor: con ~/.claude/guardia/sin-corte el corte no frena nada (así estuvo del 18/10 al 28/10). Se volvió a prender
// el 28/10 sacando ese archivo (quedó como sin-corte.apagado-28-10, con el porqué).
try { if (fs.existsSync(path.join(CASA, 'guardia', 'sin-corte'))) process.exit(0); } catch { /* sigue */ }

const leer = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; } };
const leerStdin = () => { try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; } };
const cuenta = leer(path.join(CASA, 'cuenta-activa.txt')).split(/\s+/)[0] || 'desconocida';

function ventanas() {
  const out = [];
  for (const [nombre, archivo] of [['5 horas', 'uso-cinco.txt'], ['semanal', 'uso-semanal.txt']]) {
    const [pct, resets, medido, deCuenta] = leer(path.join(CASA, archivo)).split(/\s+/);
    const p = Number(pct);
    const r = Date.parse(resets);
    if (!Number.isFinite(p) || deCuenta !== cuenta) continue;
    if (Number.isFinite(r) && r <= Date.now()) continue;            // ya se renovó
    out.push({ nombre, pct: p, resets, medido });
  }
  return out.filter((v) => v.pct >= TOPE);
}

const hora = (iso) => {
  try { return new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

/** Desde cuándo trabaja esta cuenta: la fecha en que se anotó el marcador (lo reescribe Martín al cambiar de cuenta). */
function inicioDeLaCuenta() {
  try { return hora(fs.statSync(path.join(CASA, 'cuenta-activa.txt')).mtime.toISOString()); } catch { return 'que arrancó'; }
}

/** Anota UNA vez por sesión y por ventana llena dónde quedó ese chat. Devuelve la ruta del registro. */
function registrar(ent, llenas) {
  const dir = path.join(CASA, 'relevos-cuenta');
  const archivo = path.join(dir, `${cuenta}.tsv`);
  try {
    const sid = String(ent.session_id || '?');
    const clave = `${sid}|${llenas.map((v) => v.resets).join(',')}`;
    if (leer(archivo).split('\n').some((l) => l.endsWith(`\t${clave}`))) return archivo;
    const cwd = String(ent.cwd || process.cwd());
    let rama = '?';
    try { rama = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || '?'; } catch { /* no es un repo */ }
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, 'fecha\tventana\tcarpeta\trama\ttranscript\tclave\n');
    const ventana = llenas.map((v) => `${v.nombre} ${v.pct}%`).join(' + ');
    const limpio = (s) => String(s).replace(/[\t\r\n]+/g, ' ');
    fs.appendFileSync(archivo, [new Date().toISOString(), ventana, cwd, rama, ent.transcript_path || '?', clave].map(limpio).join('\t') + '\n');
  } catch { /* el registro nunca frena el corte */ }
  return archivo;
}

try {
  const llenas = ventanas();
  if (!llenas.length) process.exit(0);
  const ent = leerStdin();

  // Un subagente (los agentes de un workflow, un Agent) termina lo que está haciendo: «No frenes la investigación».
  if (modo === 'herramienta' && (ent.agent_id || ent.agent_type)) process.exit(0);

  const registro = registrar(ent, llenas);
  const que = llenas.map((v) => `la ventana ${v.nombre} está en ${v.pct}% (se renueva ${hora(v.resets)})`).join(' y ');
  const cierre = `CORTE AL ${TOPE}%: ${que}. Regla de Martín (28/10): antes de que se acabe la cuota, TODO el contexto queda guardado, para que la próxima cuenta siga con un «Continua». No arranques nada nuevo. Ahora, en este orden: `
    + `(1) escribí o actualizá tu docs/relevo/<tu-chat>.md con TODO el trabajo de esta cuenta (desde ${inicioDeLaCuenta()}), no sólo el de este turno: qué te pidieron (con sus palabras), qué quedó hecho y en qué commit y rama, qué quedó a medias con su archivo y su rama, qué verificación falta y qué espera una decisión de Martín; `
    + `(2) commitealo por ruta explícita en tu rama (git commit -- <ruta>), sin pushear lo que esté a medias; `
    + `(3) si tenés un workflow o un agente corriendo, NO lo frenes: anotá en el relevo su runId y la ruta de su journal.jsonl (~/.claude/projects/<proyecto>/<sesión>/subagents/workflows/<runId>/journal.jsonl), que es donde la próxima cuenta lee lo que devolvió; `
    + `(4) decile a Martín en UNA línea que cortaste y dónde quedó tu relevo, y terminá el turno. Esta sesión ya quedó anotada (carpeta, rama y transcript) en ${registro}.`;

  if (modo === 'turno') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: cierre } }) + '\n');
    process.exit(0);
  }

  // herramienta: deja pasar lo de guardar y mirar.
  const tool = String(ent.tool_name || '');
  const cmd = String(ent.tool_input?.command || '');
  const guardaOMira = /^\s*(cd\s+\S+\s*(&&|;)\s*)?(git(\s+-C\s+\S+)?\s+(status|add|commit|log|diff|show|stash|rev-parse|branch|worktree\s+list|hash-object|update-index)\b|cat\s|ls\b|head\s|tail\s|sed\s+-n|grep\s|wc\s|echo\s|date\b|pwd\b|mkdir\s|cp\s|Get-Content\b|Get-ChildItem\b)/;
  const gasta = /^(Workflow|Agent|Task)$/.test(tool)
    || ((tool === 'Bash' || tool === 'PowerShell') && !guardaOMira.test(cmd));
  if (!gasta) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: cierre } }) + '\n');
  process.exit(0);
} catch {
  process.exit(0);
}
