import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * El typecheck de este repo pide entre 1 y 2,4 GB, y en esta máquina (16 GB) hay
 * 3-4 sesiones de Claude Code sobre el MISMO clon: cada `git push` dispara el suyo
 * desde el pre-push. Dos o tres a la vez no tardan el doble — agotan la RAM y un
 * chequeo de ~7 segundos queda 15 o 20 minutos. Por eso `npm run typecheck` pasa
 * por un lock de máquina (scripts/typecheck-lock.mjs).
 *
 * Sin este guard, volver a poner `tsc --noEmit` directo en package.json saca el
 * lock SIN QUE NADA FALLE: los pushes siguen saliendo y la máquina se vuelve a
 * trabar días después, que es la forma en que esto se descubrió la primera vez.
 *
 * Verificado rompiéndolo: con "typecheck": "tsc --noEmit" en package.json,
 * 1 fallo / 1 pase; con el lock cableado, 2 pases.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('npm run typecheck pasa por el lock, no llama a tsc directo', () => {
  const pkg = JSON.parse(leer('../package.json')) as { scripts: Record<string, string> };
  assert.match(
    pkg.scripts.typecheck,
    /typecheck-lock\.mjs/,
    'package.json → scripts.typecheck tiene que llamar a scripts/typecheck-lock.mjs: ' +
      'con `tsc --noEmit` directo, dos sesiones pusheando a la vez se comen la RAM de la máquina.',
  );
});

/**
 * Y el package.json NO alcanza: el `.git` de este clon lo comparten 20 checkouts, y
 * `npm run typecheck` resuelve el script del package.json DEL WORKTREE. Medido el
 * 09/10/2026: SEIS worktrees checkouteados antes del commit del lock (75314fc1) traían
 * `tsc --noEmit` crudo y los seis podían correrlo — o sea que el pre-push, que vive en el
 * `.git` común, les disparaba un tsc de 2,3 GB sin esperar a nadie. El lock se llama por la
 * ruta del clon principal desde el hook, que es el único lugar común a todos los árboles.
 *
 * Se SALTEA cuando no hay hook legible (un clon nuevo, o un worktree donde `.git` es un
 * archivo): una guarda frena sólo lo que se arregla haciendo lo que pide.
 *
 * Verificado rompiéndolo: con el hook llamando `npm run --silent typecheck` a secas,
 * 1 fallo / 2 pases; con el lock cableado, 3 pases.
 */
test('el pre-push de este clon pasa el typecheck por el lock', () => {
  let hook: string;
  try {
    hook = leer('../.git/hooks/pre-push');
  } catch {
    return; // sin hook (clon nuevo o worktree): nada que exigir acá
  }
  assert.match(
    hook,
    /typecheck-lock\.mjs/,
    '.git/hooks/pre-push tiene que llamar al lock por ruta del clon principal: ' +
      '`npm run typecheck` a secas resuelve el package.json del worktree, y hay worktrees ' +
      'con `tsc --noEmit` crudo. Ver AGENTS.md → «El typecheck NO corre en el build».',
  );
  assert.match(
    hook,
    /git rev-parse --git-common-dir/,
    'la ruta del lock sale de --git-common-dir (el clon principal), no cableada a mano: ' +
      'cableada, el hook deja de funcionar si alguien mueve o reclona el repo.',
  );
});

test('el lock suelta siempre y propaga el código de salida', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  // Sin el finally, un typecheck que falla deja el lock puesto y el próximo push
  // espera 10 minutos por nada.
  assert.match(src, /process\.on\('exit', soltar\)/, 'el lock se suelta pase lo que pase');
  // Y si no se propaga el código, un error de tipos saldría como push verde.
  assert.match(src, /hijo\.on\('exit'[\s\S]{0,80}cerrar\(code/, 'el exit code de tsc se propaga');
});

test('el lock espera RAM, con el turno tomado, antes de lanzar tsc', () => {
  // 11/10/2026: la app de Claude murió con 7 chats adentro y 5 typechecks en cola
  // detrás de este lock con 0,8 GB libres. El turno solo no alcanza: tsc pide ~3 GB.
  // Verificado rompiéndolo: sacar el `await esperarRam()` da 1 fallo; moverlo
  // debajo del `spawn` da 1 fallo.
  const src = leer('../scripts/typecheck-lock.mjs');
  const turno = src.indexOf('await esperarTurno()');
  const ram = src.indexOf('await esperarRam()');
  const lanza = src.indexOf('spawn(process.execPath');
  assert.ok(turno > 0 && lanza > 0, 'no encontré el turno o el spawn: el guard está mirando otra cosa');
  assert.ok(ram > turno && ram < lanza, 'esperarRam() tiene que correr DESPUÉS de tomar el turno y ANTES de lanzar tsc');
  assert.match(src, /freemem\(\)/, 'la espera mira la RAM disponible de la máquina');
});
