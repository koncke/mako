#!/usr/bin/env node
// =============================================================================
// typecheck-lock.mjs — corre `tsc --noEmit` de a UNO por máquina
// =============================================================================
// POR QUE EXISTE: `tsc --noEmit` sobre este repo pide entre 1 y 2,4 GB. En esta
// máquina (16 GB) hay 3-4 sesiones de Claude Code sobre el MISMO clon, y cada
// `git push` dispara su propio typecheck desde el pre-push. Dos o tres a la vez
// no tardan el doble: agotan la RAM, el sistema empieza a paginar y un chequeo
// de ~7 segundos queda 15 o 20 minutos. Medido el 08/10/2026: tres typechecks
// simultáneos (2.329 + 1.283 + 474 MB) con 0,8 GB libres, uno de ellos corriendo
// hacía 21 minutos.
//
// Serializarlos no los hace más lentos EN TOTAL: los hace más rápidos. Tres de 7
// segundos en fila son 21; tres peleándose por la RAM fueron más de 20 minutos.
//
// EL LOCK ES POR MAQUINA, no por repo: el otro proyecto que vive en C:\dev\mako-api
// también corre su typecheck y también pesa 2,4 GB. Si algún día se cablea allá el
// mismo script, los dos se turnan solos.

import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir, freemem, homedir } from 'node:os';

const LOCK = join(tmpdir(), 'mako-typecheck.lock');
const ESPERA_MAX_MS = 10 * 60 * 1000;  // 10 min
const SONDEO_MS = 400;

// ⚠️ EL HEAP DE tsc VA ACOTADO, y no es prolijidad: es lo que decide si lo MATAN.
// V8 crece el old space hasta ~4 GB en una máquina de 16, así que un tsc suelto
// llega a 3,7 GB (medido el 13/10/2026: 3.765 MB) aunque pueda trabajar en 1,6 —
// y ahí el vigía de RAM (~/.claude/guardia/vigia.ps1) lo mata por zona roja. Con
// el cap, V8 colecta antes: medido el mismo día, pico 1.571 MB con cap de 1.500.
// Un cap NO esconde nada: si de verdad no alcanza, node lo dice ruidoso
// («Reached heap limit»), que es lo contrario del fallo mudo que se arregla abajo.
// Se declara acá arriba porque el piso de RAM se DERIVA de él.
const CAP_HEAP_MB = 2048;

/**
 * ¿El dueño del lock sigue vivo? `process.kill(pid, 0)` no mata: pregunta.
 * Un lock huérfano (la sesión se cerró, el proceso murió) no puede bloquear
 * para siempre — es la regla de la casa: una guarda bloquea sólo lo que se
 * arregla haciendo lo que ella pide, y acá no hay nada que hacer.
 */
function vivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** Escritura ATOMICA: 'wx' falla si el archivo existe. Es el test-and-set. */
function tomar() {
  try { writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); return true; }
  catch { return false; }
}

function duenoDelLock() {
  try { return Number.parseInt(readFileSync(LOCK, 'utf8').trim(), 10); }
  catch { return NaN; }
}

function soltar() {
  // Sólo si sigue siendo MIO: si el lock se declaró huérfano y lo tomó otro,
  // borrarlo acá le sacaría el turno al que está trabajando.
  try { if (duenoDelLock() === process.pid) unlinkSync(LOCK); } catch {}
}

async function esperarTurno() {
  const hasta = Date.now() + ESPERA_MAX_MS;
  let aviso = false;
  while (Date.now() < hasta) {
    if (tomar()) return true;
    const pid = duenoDelLock();
    if (!vivo(pid)) {
      // huérfano: lo saco y vuelvo a intentar por la puerta atómica, para que
      // dos que lo detecten a la vez no se pisen.
      try { unlinkSync(LOCK); } catch {}
      continue;
    }
    if (!aviso) {
      process.stderr.write(`  [typecheck] otro typecheck está corriendo (pid ${pid}); espero mi turno…\n`);
      aviso = true;
    }
    await new Promise((r) => setTimeout(r, SONDEO_MS));
  }
  return false;
}

const turno = await esperarTurno();
if (!turno) {
  // No tomar de rehén a quien empuja: si el lock no se liberó en 10 minutos,
  // corro igual y lo digo. Bloquear un push para siempre por un lock trabado
  // es peor que dos typechecks a la vez.
  process.stderr.write('  [typecheck] el lock no se liberó en 10 min: corro igual (puede ir lento)\n');
}

// EL TURNO NO ALCANZA: TAMBIÉN TIENE QUE HABER RAM. Medido el 11/10/2026: la app
// de Claude se colgó y murió con 7 chats adentro, con 5 typechecks en cola detrás
// de este lock y 0,8 GB libres. El que tomaba el turno arrancaba su tsc de 3 GB
// sobre una máquina que ya paginaba — y la guarda de RAM de las sesiones
// (~/.claude/guardia/memoria.mjs) no lo ve, porque el `git push` que lo disparó
// se admitió minutos antes, cuando todavía había memoria. Se espera CON el lock
// tomado: soltarlo dejaría arrancar a otro en el mismo hueco.
// Misma regla que el lock: después de 5 min se corre igual y se dice.
// 12/10/2026: 2,5 → 2,0 a pedido de Martín («que se trabaje aún más al límite»).
//
// ⚠️ 13/10/2026: EL UMBRAL NO SE ELIGE A MANO, SE DERIVA — si es menor que lo que
// el trabajo PIDE, la admisión es un permiso para que lo maten. Con 2,0 GB y un
// tsc sin cap pasó exactamente eso: 30 typechecks matados por el vigía en un día
// y ningún push posible desde el clon. El piso tiene que cubrir las tres cosas:
// el cap del heap (2,1 GB con overhead) + la zona roja del vigía (0,9) + margen.
// Bajarlo más no hace que se trabaje «al límite»: hace que no se trabaje.
const ZONA_ROJA_VIGIA_GB = 0.9;  // ~/.claude/guardia/vigia.ps1 → $ROJA_MB
const RAM_MIN_GB = CAP_HEAP_MB / 1024 + 0.1 + ZONA_ROJA_VIGIA_GB + 0.3;  // ≈ 3,3
const RAM_ESPERA_MAX_MS = 15 * 60 * 1000;

/**
 * ⚠️ SIN RAM NO SE CORRE IGUAL: SE AVISA Y SE FRENA.
 * Hasta el 13/10/2026, después de esperar 5 minutos esto arrancaba tsc «igual, puede
 * ir lento». Ese default era correcto cuando el riesgo era la lentitud; dejó de serlo
 * cuando apareció el vigía de RAM, que MATA al pesado más grande bajo 0,9 GB libres:
 * arrancar sin RAM no es ir lento, es un kill garantizado — y encima consume 2 GB que
 * le faltan a los otros 21 chats, que es lo que hacía matar al siguiente. Medido ese
 * día: 42 typechecks matados, y con 8 MB libres el vigía mataba a los 368 MB.
 *
 * Frenar acá SÍ cumple la regla de la casa («una guarda bloquea sólo lo que se arregla
 * haciendo lo que ella pide»): lo que pide se arregla cerrando chats o esperando, y lo
 * dice. Lo que NO se puede es seguir mintiendo con un kill mudo.
 *
 * La salida de emergencia es explícita y queda escrita: MAKO_TYPECHECK_SIN_ESPERA=1.
 */
async function esperarRam() {
  const hasta = Date.now() + RAM_ESPERA_MAX_MS;
  let aviso = false;
  for (;;) {
    const libre = freemem() / 1024 ** 3;
    if (libre >= RAM_MIN_GB) return true;
    if (process.env.MAKO_TYPECHECK_SIN_ESPERA === '1') {
      process.stderr.write(`  [typecheck] MAKO_TYPECHECK_SIN_ESPERA=1 con ${libre.toFixed(1)} GB: corro igual, puede matarlo el vigía\n`);
      return true;
    }
    if (Date.now() >= hasta) return false;
    if (!aviso) {
      process.stderr.write(`  [typecheck] quedan ${libre.toFixed(1)} GB de RAM y tsc necesita ${RAM_MIN_GB.toFixed(1)}: espero hasta 15 min…\n`);
      aviso = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

if (!(await esperarRam())) {
  const libre = (freemem() / 1024 ** 3).toFixed(1);
  process.stderr.write('\n  ✖ NO CORRÍ EL TYPECHECK: NO HAY RAM, Y ARRANCARLO ASÍ ES UN KILL SEGURO.\n');
  process.stderr.write(`    Quedan ${libre} GB disponibles y hace falta ${RAM_MIN_GB.toFixed(1)} (tsc capado pide ~2,1 y el\n`);
  process.stderr.write('    vigía mata al pesado más grande por debajo de 0,9). Esto NO es un error de tipos.\n');
  process.stderr.write('    Cerrá unos chats de Claude (cada uno son ~0,2-0,3 GB) y volvé a pushear. Si hace\n');
  process.stderr.write('    falta empujar igual: MAKO_TYPECHECK_SIN_ESPERA=1 git push (y puede morir mudo).\n\n');
  soltar();
  process.exit(1);
}

// Se llama al tsc de node_modules con el MISMO node, sin npx y sin shell:
// npx agrega un proceso y ~1 s de arranque, y `shell: true` con argumentos
// sueltos dispara un DeprecationWarning (DEP0190) en cada push.
const TSC = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'typescript', 'bin', 'tsc');

const hijo = spawn(process.execPath, [`--max-old-space-size=${CAP_HEAP_MB}`, TSC, '--noEmit'], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

// Se cuentan los bytes que tsc escribió, porque un tsc que falla SIEMPRE imprime:
// exit != 0 con CERO salida no es un error de tipos, es alguien que lo mató.
let bytes = 0;
for (const [flujo, salida] of [[hijo.stdout, process.stdout], [hijo.stderr, process.stderr]]) {
  flujo.on('data', (b) => { bytes += b.length; salida.write(b); });
}

/**
 * ⚠️ UN FALLO MUDO NO SE REPORTA COMO UN FALLO DE TIPOS.
 * En Windows, `taskkill /F` deja al proceso con código 1 y sin una línea de
 * salida, y `code ?? 1` lo volvía indistinguible de «hay errores de tipos».
 * Costó una hora el 13/10/2026: el vigía de RAM mató 30 typechecks en un día
 * —con 15 sesiones abiertas no queda 0,9 GB libres— y cada sesión bloqueada
 * volvía a correr `tsc` A MANO para diagnosticar, fuera del lock, lo que pedía
 * otros 3 GB y hacía matar al siguiente. El fallo mudo ERA el que alimentaba la
 * estampida. Ahora se nombra, con la línea del log que lo probó.
 */
function explicarMudo() {
  process.stderr.write('\n  ✖ EL TYPECHECK NO TERMINÓ, Y NO SON ERRORES DE TIPOS.\n');
  process.stderr.write('    Salió con error sin imprimir una sola línea, y un tsc que falla siempre imprime.\n');
  let linea = '';
  try {
    const log = join(homedir(), '.claude', 'guardia', 'guardia.log');
    const matanzas = readFileSync(log, 'utf8').split('\n').filter((l) => l.includes('MATO pid'));
    const mia = matanzas.reverse().find((l) => l.includes(`MATO pid ${hijo.pid} `));
    linea = mia || matanzas[0] || '';
  } catch {}
  if (linea.includes(`MATO pid ${hijo.pid} `)) {
    process.stderr.write(`    LO MATÓ EL VIGÍA DE RAM:\n      ${linea.trim()}\n`);
  } else if (linea) {
    process.stderr.write(`    El vigía está matando procesos pesados; su última línea:\n      ${linea.trim()}\n`);
  } else {
    process.stderr.write('    Mirá ~/.claude/guardia/guardia.log (el vigía mata lo pesado bajo 0,9 GB libres).\n');
  }
  process.stderr.write('    NO corras `tsc` a mano para diagnosticar: son otros 2-3 GB fuera del lock,\n');
  process.stderr.write('    y es lo que hace matar al próximo. Cerrá chats o esperá y volvé a pushear.\n\n');
}

// El lock se suelta pase lo que pase: si queda puesto, el próximo push espera
// 10 minutos por nada.
const cerrar = (code) => { soltar(); process.exit(code); };
hijo.on('exit', (code, signal) => {
  if ((code ?? 1) !== 0 && bytes === 0) explicarMudo();
  else if (signal) process.stderr.write(`  [typecheck] tsc murió por señal ${signal}\n`);
  cerrar(code ?? 1);
});
hijo.on('error', (e) => { process.stderr.write(`  [typecheck] no pude lanzar tsc: ${e.message}\n`); cerrar(1); });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { try { hijo.kill(); } catch {} cerrar(1); });
}
process.on('exit', soltar);
