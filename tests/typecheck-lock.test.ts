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
  assert.match(src, /hijo\.on\('exit'[\s\S]*?cerrar\(code \?\? 1\)/, 'el exit code de tsc se propaga');
});

/**
 * ⚠️ UN FALLO MUDO NO SE REPORTA COMO UN FALLO DE TIPOS.
 * Medido el 13/10/2026: el vigía de RAM (~/.claude/guardia/vigia.ps1) mató **30
 * typechecks en un día** con `taskkill /T /F`, que en Windows deja código 1 y
 * CERO salida. El lock lo devolvía como un exit 1 cualquiera, así que el pre-push
 * decía «hay errores de tipos» sobre un repo que compila. Costó una hora a dos
 * sesiones — y lo peor: cada sesión bloqueada corría `tsc` A MANO para
 * diagnosticar, fuera del lock, lo que pedía otros 3 GB y hacía matar al
 * siguiente. El fallo mudo ERA el que alimentaba la estampida.
 *
 * Verificado rompiéndolo: con `stdio: 'inherit'` (sin contar bytes) no se puede
 * distinguir, 1 fallo; sin el cap, 1 fallo; con el piso de RAM a mano, 1 fallo.
 * Y de punta a punta: `taskkill /T /F` al tsc hijo a mitad de camino imprime
 * «EL TYPECHECK NO TERMINÓ, Y NO SON ERRORES DE TIPOS» con la línea del log.
 */
test('un tsc que muere sin imprimir se reporta como lo que es, no como errores de tipos', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  // Para saber si imprimió algo hay que CONTAR: con stdio heredado no se puede.
  assert.match(src, /stdio:\s*\['inherit',\s*'pipe',\s*'pipe'\]/, 'la salida de tsc se canaliza para poder contarla');
  assert.match(src, /bytes \+= b\.length/, 'se cuentan los bytes que tsc escribió');
  assert.match(
    src,
    /\(code \?\? 1\) !== 0 && bytes === 0/,
    'un exit distinto de 0 con CERO salida es un fallo mudo, no un error de tipos',
  );
  assert.match(src, /guardia\.log/, 'el fallo mudo busca en el log del vigía quién lo mató');
  // ⚠️ El assert va sobre la línea que BUSCA, no sobre «aparece el pid en el archivo»:
  // `${hijo.pid}` sale tres veces, así que un match suelto pasa en verde con la
  // búsqueda ya rota (medido: esa versión del guard no cazó la rotura).
  assert.match(
    src,
    /\.find\(\(l\) => l\.includes\(`MATO pid \$\{hijo\.pid\} `\)\)/,
    'la búsqueda en el log es por el pid de SU hijo, no la última línea de cualquiera',
  );
});

test('el heap de tsc va acotado, y el piso de RAM se deriva de ese cap', () => {
  // V8 crece hasta ~4 GB en esta máquina: un tsc suelto llegó a 3.765 MB pudiendo
  // trabajar en 1.571. Capado es menos matable, y si no alcanza falla ruidoso.
  // Y el piso NO puede ser un número a mano menor que lo que el trabajo pide: con
  // 2,0 GB la admisión era un permiso para que el vigía lo matara.
  // Verificado rompiéndolo: sin el `--max-old-space-size`, 1 fallo; con
  // `const RAM_MIN_GB = 2.0`, 1 fallo.
  const src = leer('../scripts/typecheck-lock.mjs');
  assert.match(src, /--max-old-space-size=\$\{CAP_HEAP_MB\}/, 'tsc se lanza con el heap acotado');
  assert.match(
    src,
    /const RAM_MIN_GB = CAP_HEAP_MB/,
    'el piso de RAM se deriva del cap del heap (y de la zona roja del vigía), no se elige a mano',
  );
  assert.match(src, /ZONA_ROJA_VIGIA_GB/, 'el piso contempla la zona roja del vigía');
  const cap = src.indexOf('const CAP_HEAP_MB');
  const piso = src.indexOf('const RAM_MIN_GB');
  assert.ok(cap > 0 && piso > cap, 'CAP_HEAP_MB se declara ANTES de RAM_MIN_GB (un const no se hoistea: sería ReferenceError)');
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

/**
 * ⚠️ SIN RAM NO SE CORRE IGUAL. El fallback «espero 5 min y arranco lo mismo, puede ir
 * lento» era correcto cuando el riesgo era la lentitud. Con el vigía de RAM matando al
 * pesado más grande bajo 0,9 GB libres, arrancar sin RAM es un kill GARANTIZADO que
 * además consume 2 GB que le faltan a los otros 21 chats — o sea el mecanismo que hacía
 * matar al siguiente. Frenar y decir qué hacer es lo honesto; la salida de emergencia es
 * explícita (MAKO_TYPECHECK_SIN_ESPERA=1).
 *
 * Verificado rompiéndolo: devolviendo `true` al vencer la espera (el «corro igual» de
 * antes), 1 fallo; sacando la salida de emergencia, 1 fallo.
 */
test('sin RAM el lock FRENA con instrucciones, no arranca tsc hacia un kill', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  // Al vencer la espera tiene que devolver false (frenar), no true (correr igual).
  const esp = src.slice(src.indexOf('async function esperarRam'), src.indexOf('if (!(await esperarRam())'));
  assert.ok(esp.length > 200 && esp.length < 2500, `el recorte de esperarRam mide ${esp.length}: está mirando otra cosa`);
  assert.match(esp, /if \(Date\.now\(\) >= hasta\) return false;/, 'al vencer la espera FRENA (return false), no corre igual');
  assert.doesNotMatch(
    esp.replace(/^[ \t]*\/\/.*$/gm, ''),
    /corro igual \(puede ir lento\)/,
    'ya no existe el camino «corro igual» por falta de RAM',
  );
  // Y lo que frena tiene que decir que NO son errores de tipos, o se lee igual que antes.
  assert.match(src, /NO CORRÍ EL TYPECHECK/, 'el freno dice que no corrió, no que falló');
  assert.match(src, /Esto NO es un error de tipos/, 'y aclara que no es un error de tipos');
  assert.match(src, /Cerrá unos chats/, 'y dice qué hacer para destrabarlo');
  // Una guarda sin llave toma de rehén a quien empuja: la excepción va escrita.
  // ⚠️ El assert va sobre la LECTURA de la variable, no sobre que el nombre aparezca:
  // el nombre también está en el mensaje de ayuda, así que un match suelto pasa en verde
  // con la salida de emergencia ya rota (medido: esa versión no cazó la rotura).
  assert.match(
    src,
    /process\.env\.MAKO_TYPECHECK_SIN_ESPERA === '1'/,
    'la salida de emergencia se LEE del entorno (no basta con nombrarla en el mensaje)',
  );
});
