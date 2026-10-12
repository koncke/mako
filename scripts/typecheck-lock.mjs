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
import { tmpdir, freemem } from 'node:os';

const LOCK = join(tmpdir(), 'mako-typecheck.lock');
const ESPERA_MAX_MS = 10 * 60 * 1000;  // 10 min
const SONDEO_MS = 400;

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
// 12/10/2026: 2,5 → 2,0 a pedido de Martín («que se trabaje aún más al límite»; ya no hay Chrome abierto).
const RAM_MIN_GB = 2.0;
const RAM_ESPERA_MAX_MS = 5 * 60 * 1000;
async function esperarRam() {
  const hasta = Date.now() + RAM_ESPERA_MAX_MS;
  let aviso = false;
  for (;;) {
    const libre = freemem() / 1024 ** 3;
    if (libre >= RAM_MIN_GB) return;
    if (Date.now() >= hasta) {
      process.stderr.write(`  [typecheck] la RAM no se liberó en 5 min (${libre.toFixed(1)} GB): corro igual (puede ir lento)\n`);
      return;
    }
    if (!aviso) {
      process.stderr.write(`  [typecheck] quedan ${libre.toFixed(1)} GB de RAM y tsc pide ~3: espero a que se libere…\n`);
      aviso = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
await esperarRam();

// Se llama al tsc de node_modules con el MISMO node, sin npx y sin shell:
// npx agrega un proceso y ~1 s de arranque, y `shell: true` con argumentos
// sueltos dispara un DeprecationWarning (DEP0190) en cada push.
const TSC = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'typescript', 'bin', 'tsc');
const hijo = spawn(process.execPath, [TSC, '--noEmit'], { stdio: 'inherit' });

// El lock se suelta pase lo que pase: si queda puesto, el próximo push espera
// 10 minutos por nada.
const cerrar = (code) => { soltar(); process.exit(code); };
hijo.on('exit', (code) => cerrar(code ?? 1));
hijo.on('error', (e) => { process.stderr.write(`  [typecheck] no pude lanzar tsc: ${e.message}\n`); cerrar(1); });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { try { hijo.kill(); } catch {} cerrar(1); });
}
process.on('exit', soltar);
