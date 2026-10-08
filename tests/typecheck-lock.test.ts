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

test('el lock suelta siempre y propaga el código de salida', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  // Sin el finally, un typecheck que falla deja el lock puesto y el próximo push
  // espera 10 minutos por nada.
  assert.match(src, /process\.on\('exit', soltar\)/, 'el lock se suelta pase lo que pase');
  // Y si no se propaga el código, un error de tipos saldría como push verde.
  assert.match(src, /hijo\.on\('exit'[\s\S]{0,80}cerrar\(code/, 'el exit code de tsc se propaga');
});
