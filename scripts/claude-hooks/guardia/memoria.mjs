#!/usr/bin/env node
// =============================================================================
// memoria.mjs — hook PreToolUse: no dejar ARRANCAR lo pesado sin RAM para eso
// =============================================================================
// POR QUE EXISTE: el 11/10/2026 05:07 la app de Claude se colgó y murió con 7
// chats adentro. No fue el bug de la GPU (no hubo `GPU process gone`): fue RAM.
// Había 4 workflows en paralelo, un `tsc` de 3 GB, un `npm ci` y un `next dev`
// sobre una máquina de 16 GB; el log muestra `memory pressure (critical)` y el
// main process de Electron trabado hasta que dejó de escribir. Cuando la RAM se
// agota no se cae UN chat: se caen TODOS.
//
// QUE HACE: antes de un Workflow, un Agent o un comando pesado (tsc, tests,
// build, npm ci, git push — el pre-push corre tsc) mira la RAM disponible. Si no
// alcanza, ESPERA a que se libere; si no se libera, NIEGA con una razón que el
// modelo entiende ("esperá y reintentá, o hacelo sin fan-out").
//
// Reglas de la casa:
//  - Un error de este script NUNCA bloquea: ante cualquier excepción, exit 0.
//  - Lo liviano no se toca (sólo se demora unos segundos en zona roja).
//  - Dos que miran la RAM en el mismo instante ven lo mismo y arrancan juntos:
//    por eso hay un ENFRIAMIENTO entre admisiones (el `tsc` tarda ~15 s en
//    llegar a su pico; la RAM medida antes de eso miente).
// =============================================================================

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const GB = 1024 ** 3;
const DIR = path.join(os.homedir(), '.claude', 'guardia');
const LOG = path.join(DIR, 'guardia.log');
const PROYECTOS = path.join(os.homedir(), '.claude', 'projects');

// Umbrales en GB DISPONIBLES (os.freemem en Windows = ullAvailPhys: libre +
// standby, lo mismo que "Disponible" en el Administrador de tareas).
// 12/10/2026: Martín pidió trabajar MÁS AL LÍMITE («libera más RAM para que los demás puedan seguir trabajando...
// que se trabaje aún más al límite... Yo ya cerré todo lo que no sea Claude, sobre todo Chrome»). Un escalón abajo:
// workflow 3,5→2,5 · pesado 2,0→1,5 · agente 1,5→1,0 · liviano 0,8→0,6 · tope de workflows 2→3. El de antes quedó
// en memoria.mjs.antes-12-10. Si vuelve a colgarse la app, esto es lo primero que se sube.
const REGLAS = {
  workflow: { minGb: 2.5, esperaS: 120, enfriamientoS: 45 },
  pesado:   { minGb: 1.5, esperaS: 240, enfriamientoS: 20 },
  agente:   { minGb: 1.0, esperaS: 60,  enfriamientoS: 0 },
  liviano:  { minGb: 0.6, esperaS: 20,  enfriamientoS: 0, dejarPasar: true },
};
// Más de esto a la vez y la RAM no alcanza aunque cada uno arranque con margen:
// los agentes crecen DESPUÉS de la admisión.
const MAX_WORKFLOWS = 3;
const SONDEO_MS = 3000;

// Lo que pide GBs: tsc directo, la suite de tests, builds, instalaciones.
// NO van `git push` ni `npm run typecheck`: los dos terminan en
// scripts/typecheck-lock.mjs, que desde el 11/10 espera RAM él mismo (con el
// lock tomado). Frenarlos acá también era doble freno — y medido ese día, el
// patrón suelto `typecheck` agarraba el NOMBRE de un test liviano
// (`npx tsx --test tests/typecheck-lock.test.ts`).
const PESADO = new RegExp([
  String.raw`\btsc\b`, String.raw`\bvitest\b`, String.raw`\bjest\b`,
  String.raw`\bplaywright\b`, String.raw`\beslint\b`, String.raw`\bnext\s+build\b`,
  String.raw`\bnpm\s+(ci|install|i|test|t)\b`, String.raw`\bnpm\s+run\s+(build|test|lint|check)\b`,
  String.raw`\b(pnpm|yarn)\s+(install|test|build)\b`,
].join('|'), 'i');

const libreGb = () => os.freemem() / GB;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function log(linea) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(LOG, `${new Date().toISOString()} [memoria] ${linea}\n`);
  } catch {}
}

function leerEntrada() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function clasificar(ent) {
  const tool = ent.tool_name || '';
  if (tool === 'Workflow') return 'workflow';
  if (tool === 'Agent' || tool === 'Task') return 'agente';
  if (tool === 'Bash' || tool === 'PowerShell') {
    const cmd = String(ent.tool_input?.command || '');
    return PESADO.test(cmd) ? 'pesado' : 'liviano';
  }
  return null;
}

/** Workflows vivos en la máquina: carpetas de corrida con algún archivo tocado
 *  en los últimos 3 min (los agentes escriben su transcript mientras trabajan). */
function workflowsActivos() {
  const vivos = [];
  const corte = Date.now() - 3 * 60 * 1000;
  let proyectos = [];
  try { proyectos = fs.readdirSync(PROYECTOS); } catch { return vivos; }
  for (const p of proyectos) {
    let sesiones = [];
    try { sesiones = fs.readdirSync(path.join(PROYECTOS, p), { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { continue; }
    for (const s of sesiones) {
      const wfDir = path.join(PROYECTOS, p, s.name, 'subagents', 'workflows');
      let corridas = [];
      try { corridas = fs.readdirSync(wfDir); } catch { continue; }
      for (const c of corridas) {
        try {
          const dir = path.join(wfDir, c);
          const reciente = fs.readdirSync(dir).some((f) => {
            try { return fs.statSync(path.join(dir, f)).mtimeMs > corte; } catch { return false; }
          });
          if (reciente) vivos.push({ sesion: s.name, corrida: c });
        } catch {}
      }
    }
  }
  return vivos;
}

// Enfriamiento entre admisiones: archivo con la hora de la última, por tipo.
function marcaPath(tipo) { return path.join(DIR, `ultima-admision-${tipo}`); }
function segundosDesdeUltima(tipo) {
  try { return (Date.now() - fs.statSync(marcaPath(tipo)).mtimeMs) / 1000; } catch { return Infinity; }
}
function marcarAdmision(tipo) {
  try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(marcaPath(tipo), String(process.pid)); } catch {}
}

function negar(razon) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: razon },
  }));
  process.exit(0);
}

async function main() {
  const ent = leerEntrada();
  const tipo = clasificar(ent);
  // Traza para comprobar que el hook corre: `touch ~/.claude/guardia/traza`.
  if (fs.existsSync(path.join(DIR, 'traza'))) log(`traza ${ent.tool_name} -> ${tipo} libre=${libreGb().toFixed(1)} sesion=${String(ent.session_id || '?').slice(0, 8)}`);
  if (!tipo) return;
  const regla = REGLAS[tipo];
  const cmd = ent.tool_input?.command ? ` cmd=${JSON.stringify(String(ent.tool_input.command).replace(/\s+/g, ' ').slice(0, 90))}` : '';
  const sesion = String(ent.session_id || '?').slice(0, 8) + cmd;
  const hasta = Date.now() + regla.esperaS * 1000;
  const inicio = Date.now();
  let motivo = '';

  for (;;) {
    const libre = libreGb();
    // El enfriamiento existe porque la RAM medida no refleja todavía al que acaba
    // de arrancar. Si hay lugar para dos, no hace falta: con 7 sesiones, cada
    // admisión ajena renovaba la espera y había quien no entraba nunca.
    const enfriando = libre < regla.minGb + 2.5 && segundosDesdeUltima(tipo) < regla.enfriamientoS;
    let cupoOk = true;
    if (tipo === 'workflow') {
      const vivos = workflowsActivos();
      cupoOk = vivos.length < MAX_WORKFLOWS;
      if (!cupoOk) motivo = `hay ${vivos.length} workflows corriendo en la máquina (tope ${MAX_WORKFLOWS})`;
    }
    if (libre >= regla.minGb && !enfriando && cupoOk) {
      if (regla.enfriamientoS) marcarAdmision(tipo);
      const espero = Math.round((Date.now() - inicio) / 1000);
      if (espero > 0) log(`${tipo} ADMITIDO tras ${espero}s (libre ${libre.toFixed(1)} GB) sesion=${sesion}`);
      return;
    }
    if (libre < regla.minGb) motivo = `quedan ${libre.toFixed(1)} GB de RAM disponibles y esto necesita ${regla.minGb}`;
    else if (enfriando && cupoOk) motivo = 'otro proceso pesado acaba de arrancar';
    if (Date.now() >= hasta) break;
    await dormir(SONDEO_MS);
  }

  if (regla.dejarPasar) { log(`${tipo} pasa igual tras ${regla.esperaS}s: ${motivo} sesion=${sesion}`); return; }

  log(`${tipo} NEGADO: ${motivo} sesion=${sesion}`);
  const consejo = {
    workflow: 'No lances el workflow ahora. Esperá unos minutos y reintentá, o hacé el trabajo directo / con menos agentes en paralelo.',
    pesado: 'No lo corras ahora. Reintentá en un par de minutos (no es un error del código).',
    agente: 'Esperá un minuto y reintentá, o hacelo directo sin subagente.',
  }[tipo];
  negar(`Guardia de RAM: ${motivo}. Con la RAM agotada se cuelga la app de Claude y se caen TODOS los chats abiertos (pasó el 11/10). ${consejo}`);
}

main().catch((e) => { log(`error interno (dejo pasar): ${e?.message || e}`); process.exit(0); });
