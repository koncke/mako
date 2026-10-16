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
test('el pre-push pasa el typecheck por el lock', () => {
  // Se lee la copia VERSIONADA (scripts/claude-hooks/pre-push), que existe en todos lados.
  // Hasta el 15/10/2026 se leía .git/hooks/pre-push, que en GitHub Actions no existe: ahí el
  // test se salteaba y daba verde sin haber mirado nada. Que el instalado sea esa misma copia
  // lo fija el test de abajo.
  const hook = leer('../scripts/claude-hooks/pre-push');
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

const hookInstalado = (() => { try { return leer('../.git/hooks/pre-push'); } catch { return null; } })();

test('el pre-push instalado es la copia del repo', { skip: hookInstalado === null && 'sin hook instalado (GitHub Actions, un worktree o un clon nuevo)' }, () => {
  // Los hooks no se versionan: si alguien edita el instalado y no la copia (o al revés), los
  // tests de arriba miran un hook que no es el que corre. Verificado rompiéndolo: cambiar el 99
  // de la copia da 2 fallos (la regla del 99 y ésta).
  assert.equal(
    hookInstalado,
    leer('../scripts/claude-hooks/pre-push'),
    '.git/hooks/pre-push difiere de scripts/claude-hooks/pre-push: reinstalalo con la receta de AGENTS.md ' +
      '(avisándole antes al coordinador: lo comparten todos los chats), o subí el cambio a la copia.',
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

/**
 * ⚠️ «NO PUDE CHEQUEAR» Y «HAY ERRORES» SON DOS RESPUESTAS, CON DOS ACCIONES.
 * Medido el 13/10/2026 en un push real: el lock explicaba bien que al tsc lo había
 * matado el vigía, y el hook imprimía DEBAJO «✖ PUSH BLOQUEADO: hay errores de tipos».
 * La última línea que lee la persona volvía a mentir, con la explicación correcta tres
 * renglones más arriba. Un exit 1 no alcanza: hace falta un código propio (99) para que
 * el hook pueda decir «cerrá chats» en vez de «corregí los tipos».
 *
 * Verificado rompiéndolo: con `cerrar(code ?? 1)` en el camino mudo, 1 fallo; con el
 * freno por RAM saliendo con 1, 1 fallo.
 */
test('el lock distingue «no pude chequear» de «hay errores» con un código propio', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  assert.match(src, /const SALIDA_SIN_CHEQUEAR = 99;/, 'hay un código de salida propio para «no pude chequear»');
  // El camino mudo (lo mataron) sale con ESE código, no con 1.
  assert.match(
    src,
    /bytes === 0\) \{ explicarMudo\(\); cerrar\(SALIDA_SIN_CHEQUEAR\)/,
    'un tsc muerto sin imprimir sale con SALIDA_SIN_CHEQUEAR, no con 1',
  );
  // Y el freno por falta de RAM también: tampoco chequeó nada.
  assert.match(
    src,
    /soltar\(\);\s*\n\s*process\.exit\(SALIDA_SIN_CHEQUEAR\);/,
    'el freno por falta de RAM también sale con SALIDA_SIN_CHEQUEAR',
  );
  // Y el hook tiene que mirarlo, o el mensaje final vuelve a mentir. Se lee la copia
  // VERSIONADA: el hook instalado no existe en GitHub Actions y ahí esto se salteaba.
  const hook = leer('../scripts/claude-hooks/pre-push');
  assert.match(hook, /-eq 99/, 'el pre-push distingue el 99 y no dice «hay errores de tipos»');
  assert.match(hook, /NO es un error de tipos/, 'y lo dice con todas las letras');
});

/**
 * ⚠️ EL PISO DEPENDE DE SI EL VIGÍA ESTÁ VIVO, Y EL VIGÍA SE MUERE.
 * Medido el 14/10/2026: murió a las 23:03Z —justo después de matar un tsc con 259 MB
 * libres, o sea de la misma crisis que existe para prevenir— y estuvo caído SEIS HORAS,
 * porque su tarea programada sólo dispara al iniciar sesión. El push que finalmente
 * entró lo hizo con 4,68 GB, por debajo del piso de 5,3, justamente porque ya no había
 * quién matara nada. O sea que el piso no estaba de más: los 0,9 de la zona roja son un
 * impuesto que sólo se paga cuando el vigía está.
 *
 * Verificado rompiéndolo: con el piso fijo (sin el ternario), 1 fallo; con el fail-safe
 * devolviendo false ante la duda, 1 fallo.
 */
test('el piso de RAM descuenta la zona roja cuando el vigía NO está corriendo', () => {
  const src = leer('../scripts/typecheck-lock.mjs');
  assert.match(src, /function vigiaVivo\(\)/, 'el lock mira si el vigía está vivo');
  assert.match(
    src,
    /\(HAY_VIGIA \? ZONA_ROJA_VIGIA_GB : 0\)/,
    'la zona roja entra al piso SÓLO si el vigía está corriendo (5,3 con él, 4,4 sin él)',
  );
  // Ante la duda se asume que SÍ está: equivocarse al revés es arrancar hacia un kill.
  assert.match(
    src,
    /return \(r\.stdout \|\| ''\)\.trim\(\) !== 'no';/,
    'cualquier respuesta que no sea un "no" explícito cuenta como vigía vivo (piso alto)',
  );
  assert.match(src, /catch \{ return true; \}/, 'si la consulta falla, se asume vigía vivo');
});

test('el heap de tsc va acotado, y el piso de RAM se deriva de ese cap', () => {
  // V8 crece hasta ~4 GB en esta máquina: un tsc suelto llegó a 3.765 MB. Capado es
  // menos matable, y si no alcanza falla ruidoso. (El «trabaja en 1.571» que decía acá
  // era de un tsc que el vigía MATÓ a mitad: el chequeo completo pide más de 2 GB vivos.)
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

test('un «heap out of memory» sale con 99 («no pude chequear»), no como errores de tipos', () => {
  // 13/10/2026: con el tope en 2048, tsc murió con «FATAL ERROR: Ineffective mark-compacts
  // near heap limit … heap out of memory». node SÍ imprime cuando se queda sin heap, así que
  // el conteo de bytes del fallo mudo no lo veía y el pre-push decía «hay errores de tipos»
  // sobre un chequeo que no llegó a terminar. tsc escribe sus errores en stdout: el detector
  // mira sólo la cola de stderr.
  // Verificado rompiéndolo (base 9/0): cerrar esa rama con el código de tsc antes del 99,
  // 1 fallo; no alimentar la cola con stderr, 1 fallo; una regex que no reconoce el FATAL de
  // V8, 1 fallo; la rama apagada (`&& false`), 1 fallo. Y en un push real: salió con 99.
  const src = leer('../scripts/typecheck-lock.mjs');
  const m = src.match(/const sinHeap = \(\) => (\/.+\/[a-z]*)\.test\(colaErr\);/);
  assert.ok(m, 'no encontré sinHeap: el guard está mirando otra cosa');
  const lit = m![1];
  const re = new RegExp(lit.slice(1, lit.lastIndexOf('/')), lit.slice(lit.lastIndexOf('/') + 1));
  assert.ok(
    re.test('FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory'),
    'reconoce el FATAL de V8 tal como salió en el push',
  );
  assert.ok(!re.test("app/x.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'."), 'un error de tipos no cuenta');
  assert.match(src, /if \(flujo === hijo\.stderr\) colaErr = /, 'la cola se alimenta con stderr');
  const ini = src.indexOf("hijo.on('exit'");
  const fin = src.indexOf("hijo.on('error'", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el handler de salida');
  const handler = src.slice(ini, fin);
  const rama = handler.match(/if \(\(code \?\? 1\) !== 0 && sinHeap\(\)\) \{([\s\S]*?)\n  \}/);
  assert.ok(rama, 'el handler de salida pregunta por sinHeap()');
  assert.equal(
    rama![1].match(/cerrar\(([^)]*)\)/)?.[1],
    'SALIDA_SIN_CHEQUEAR',
    'sin heap sale con 99 (es lo PRIMERO que cierra esa rama), no con el código de tsc',
  );
});
