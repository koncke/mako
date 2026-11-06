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
import { pathToFileURL } from 'node:url';

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
// 25/10/2026 (el Cerebro, cuenta 5): Martín, antes de dejar la PC trabajando de noche: «Cuida la ram para que no se crashee
// claude por la noche». Medido el 24/10 (vigia.csv): el vigía MATÓ 81 pesados ese día y 70 el 23/10, porque esta guardia los
// dejaba arrancar con 1,5 GB y cada uno pide 2-2,5 (tsc acotado, tandas de tests). Pesado 1,5→2,5 y su enfriamiento 20→40 s;
// tope de workflows 3→2; y las tandas grandes de `node --test` sin `--test-concurrency` cuentan como pesado (arrancan un
// proceso por núcleo: 11 en esta PC). El de antes quedó en memoria.mjs.antes-25-10. Informe: docs/hallazgos-infra.md.
// 29/10/2026 15:30 (el Cerebro, cuenta 3): la ventana de Claude quedó en negro («Main webview is unresponsive» en
// %LOCALAPPDATA%\Claude\Logs\main.log, con memory pressure critical y 9 chats trabajando). Los pesados entraban con 2,5 GB,
// justo lo que piden, y no quedaba piso. Pesado y workflow 2,5→3. El de antes quedó en memoria.mjs.antes-29-10-tarde.
// ⚠️ ESTE CAMBIO VIVÍA SÓLO EN ~/.claude Y NO ACÁ (lo sincronizó el 6/11/2026): reinstalar desde el repo bajaba los topes a
// 2,5 y devolvía la pantalla negra. Cualquier cambio a la guardia se hace en ESTA copia y después se reinstala.
const REGLAS = {
  workflow: { minGb: 3.0, esperaS: 120, enfriamientoS: 45 },
  pesado:   { minGb: 3.0, esperaS: 240, enfriamientoS: 40 },
  agente:   { minGb: 1.0, esperaS: 60,  enfriamientoS: 0 },
  liviano:  { minGb: 0.6, esperaS: 20,  enfriamientoS: 0, dejarPasar: true },
};
// Más de esto a la vez y la RAM no alcanza aunque cada uno arranque con margen:
// los agentes crecen DESPUÉS de la admisión.
const MAX_WORKFLOWS = 2;
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
  // 25/10/2026 ~19:20 (el Cerebro): los scripts del repo que corren por adentro tandas de tests o el chequeo de tipos. El
  // comando es un `node scripts/...` que no dice nada pesado: `tests-afectados` arrancó con la reserva del tren puesta y
  // levantó dos tandas de ~1 GB cada una (la RAM libre bajó de 2,9 a 1,1 GB). Sólo el script corriendo, no un `cat` de su test.
  String.raw`\bnode\b[^|;&]*\bscripts/(tests-afectados|antes-de-subir|tipos-por-tandas|tipos-respaldo-push)\.mjs\b`,
].join('|'), 'i');

// Los tests de este repo corren con `node --test` (o `tsx --test`), no con vitest: un archivo suelto es liviano, pero una
// tanda (3+ archivos o un comodín) sin `--test-concurrency` levanta un proceso por núcleo. Ésa cuenta como pesada.
function tandaDeTestsSinFreno(cmd) {
  if (!/(\bnode\b|\btsx\b)[^|;&]*\s--test\b/.test(cmd) || /--test-concurrency[= ]\d/.test(cmd)) return false;
  return (cmd.match(/\.test\.[cm]?[jt]sx?\b/g) || []).length >= 3 || /--test\b[^|;&]*\*/.test(cmd);
}

// ⚠️ LO QUE SE CLASIFICA ES LO QUE CORRE, NO EL TEXTO QUE VIAJA ADENTRO (6/11/2026).
// `PESADO` se probaba contra el comando entero, así que un `git commit` cuyo MENSAJE nombra `tsc`, `npm test` o `eslint`
// quedaba clasificado pesado y la guardia lo NEGABA con 2 GB libres. Un commit no pide RAM: el chat se quedaba sin poder
// guardar su trabajo justo cuando la máquina estaba cargada, que es cuando más importa guardarlo. Lo encontré commiteando
// el arreglo de la alarma de minutos: el mensaje decía «el tsc entero lo corre la punta» y la guardia lo leyó como un tsc.
// El archivo ya tenía un caso de esta misma familia anotado arriba (el patrón `typecheck` agarraba el NOMBRE de un test):
// se arregló sacando ESA palabra, no la causa, así que volvió con otra.
//
// Lo que se saca antes de clasificar, porque es DATA y nunca ejecuta:
//   · el CUERPO de un heredoc — salvo que se lo coma un intérprete (`bash <<EOF … npm test … EOF` sí corre).
//   · el valor de `-m` / `--message` entre comillas (mensajes de commit, de tag, de stash).
//   · el cuerpo de un `node -e '…'` / `--eval`, y los PATRONES de un `grep`/`rg` entre comillas.
//
// ⚠️ ESTO VALE IGUAL PARA `tandaDeTestsSinFreno`, y me volvió a frenar mientras arreglaba lo de arriba: cuenta cuántos
// `.test.ts` NOMBRA el comando, y un `node -e "…tests/x.test.ts…" && grep tests/x.test.ts` los nombra tres veces sin correr
// ninguno. Tres menciones = «tanda» = pesado. Es la misma causa, en el otro camino a «pesado», así que las dos preguntas se
// hacen sobre `soloLoQueCorre(cmd)`.
// ⚠️ `cat` y `tee` NO van acá: `cat > notas.md <<EOF` ESCRIBE el cuerpo, no lo ejecuta. (Los puse y mi propio test los
// cazó.) Un `cat <<EOF | bash` igual se clasifica: la línea que abre el heredoc lleva el `| bash`.
const INTERPRETE = /(^|[\s|;&(])(ba|z|k|da|c)?sh\b|(^|[\s|;&(])(node|tsx|python3?|deno|bun|perl|ruby)\b/i;

export function soloLoQueCorre(cmd) {
  const txt = String(cmd ?? '');
  // 1. Heredocs. El tag puede venir entre comillas (<<'EOF') y con `-` (<<-EOF, cierre indentado).
  let out = txt.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1\r?\n([\s\S]*?)\r?\n[ \t]*\2(?=\s|$)/g, (todo, _q, tag, _cuerpo, pos) => {
    const antes = txt.slice(0, pos);
    const linea = antes.slice(antes.lastIndexOf('\n') + 1);
    return INTERPRETE.test(linea) ? todo : `<<${tag}\n${tag}`;
  });
  // 2. Lo que va entre comillas detrás de una bandera que lo toma como TEXTO, no como comando: el mensaje de un commit,
  //    el script de un `node -e`. `node -e` ejecuta su cuerpo, sí — pero lo que ejecuta es JS en ESTE proceso, no un `tsc`
  //    ni una tanda de tests, y lo que de verdad los arranca desde ahí (`execSync('npx tsc')`) es un caso que no vale la
  //    pena cazar acá: lo pesado se mide cuando ESE proceso arranca.
  for (const bandera of ['-m', '--message', '-e', '--eval', '-p', '--print']) {
    const b = bandera.replace(/-/g, '\\-');
    out = out.replace(new RegExp(`(^|\\s)(${b})(=|\\s+)(['"])[\\s\\S]*?\\4`, 'g'), '$1$2$3""');
  }
  // 3. Los que BUSCAN texto: su patrón nunca se ejecuta, y puede venir sin bandera (`grep -rn "npx tsc" .`). Se vacían las
  //    comillas de ESE tramo solamente, no de todo el comando: `sh -c "npx tsc"` sí ejecuta y tiene que seguir contándose.
  out = out.split(/(\||;|&&|&)/).map((tramo) => (
    /^\s*(sudo\s+)?(grep|rg|egrep|fgrep|findstr|ack|ag)\b/.test(tramo) ? tramo.replace(/(['"])[\s\S]*?\1/g, '""') : tramo
  )).join('');
  return out;
}

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

export function clasificar(ent) {
  const tool = ent.tool_name || '';
  if (tool === 'Workflow') return 'workflow';
  if (tool === 'Agent' || tool === 'Task') return 'agente';
  if (tool === 'Bash' || tool === 'PowerShell') {
    // Las DOS preguntas van sobre lo que CORRE: `tandaDeTestsSinFreno` cuenta menciones de `.test.ts`, y un `node -e` o un
    // `grep` que las nombra sin correrlas también daba «tanda».
    const cmd = soloLoQueCorre(ent.tool_input?.command || '');
    return PESADO.test(cmd) || tandaDeTestsSinFreno(cmd) ? 'pesado' : 'liviano';
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

// RESERVA DEL TREN (25/10/2026 ~19:10, el Cerebro, cuenta 5): con 10 chats trabajando la RAM libre no pasó de 3,5 GB en una hora
// y el tren esperó los 5,3 GB que pide cada tanda del chequeo de tipos del pre-push; cuando subió igual (18:14), la PC se trabó.
// Mientras exista `reserva-tren` (JSON {sesion, hasta, motivo}), lo PESADO y los WORKFLOWS de las OTRAS sesiones esperan: no se
// corta a nadie, sólo no arranca nada nuevo, y la RAM se libera sola a medida que terminan los de antes. Vence sola en `hasta`
// (un script caído no traba a nadie más de eso). La pone y la saca el script que sube el tren.
const RESERVA = path.join(DIR, 'reserva-tren');
function reservaVigente(ent) {
  try {
    const r = JSON.parse(fs.readFileSync(RESERVA, 'utf8'));
    if (!r || !(Number(r.hasta) > Date.now())) return null;
    if (r.sesion && String(ent.session_id || '').startsWith(String(r.sesion))) return null;
    return r;
  } catch { return null; }
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
    const reserva = tipo === 'pesado' || tipo === 'workflow' ? reservaVigente(ent) : null;
    if (reserva) {
      const hh = new Date(Number(reserva.hasta)).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      motivo = `${reserva.motivo || 'el Cerebro está subiendo el tren a main'} y reservó la RAM hasta las ${hh} (o hasta que termine)`;
      if (Date.now() >= hasta) break;
      await dormir(SONDEO_MS);
      continue;
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
    pesado: 'No lo corras ahora. Reintentá en un par de minutos (no es un error del código). Mientras tanto, seguí con lo que no pide RAM.',
    agente: 'Esperá un minuto y reintentá, o hacelo directo sin subagente.',
  }[tipo];
  negar(`Guardia de RAM: ${motivo}. Con la RAM agotada se cuelga la app de Claude y se caen TODOS los chats abiertos (pasó el 11/10). ${consejo}`);
}

// Corre sólo cuando lo invoca el hook (`node …/memoria.mjs`); importarlo desde un test no arranca nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { log(`error interno (dejo pasar): ${e?.message || e}`); process.exit(0); });
}
