// =============================================================================
// La guardia de RAM clasifica LO QUE CORRE, no el texto que viaja adentro (6/11/2026)
// =============================================================================
// scripts/claude-hooks/guardia/memoria.mjs es la copia versionada de ~/.claude/guardia/memoria.mjs: el hook PreToolUse que
// no deja arrancar lo pesado sin RAM. Clasificaba probando `PESADO` contra el comando ENTERO, así que un `git commit` cuyo
// mensaje nombra `tsc`, `npm test` o `eslint` salía «pesado» y la guardia lo NEGABA. Un commit no pide RAM: el chat se
// quedaba sin poder guardar su trabajo justo cuando la máquina estaba cargada.
//
// Se corre el código de verdad (`clasificar` y `soloLoQueCorre`, importados; el script no arranca al importarse).
//
// PROBADO ROMPIÉNDOLO (6/11/2026; base 5 / 0). Pasan / fallan:
//   · `clasificar` vuelve a probar `PESADO` contra el comando entero        → 2 / 3
//   · `soloLoQueCorre` saca el cuerpo de TODO heredoc (también el de bash)  → 4 / 1
//   · `soloLoQueCorre` no saca el valor de `-m`                             → 4 / 1
//   · los topes de pesado/workflow vuelven a 2,5 GB                         → 4 / 1
// Correr: node --import tsx --test tests/memoria-guardia.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Es un `.mjs` (la copia de un hook, no código de la app) y el tsconfig lo resuelve con `allowJs`, igual que
// tests/minutos-actions.test.ts con scripts/minutos-actions.mjs. ⚠️ SIN `@ts-expect-error`: no hay ningún error que esperar,
// y un directivo sin usar ES un error de tipos (TS2578). Ningún test del repo lo usa.
import { clasificar, soloLoQueCorre } from '../scripts/claude-hooks/guardia/memoria.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = readFileSync(join(RAIZ, 'scripts', 'claude-hooks', 'guardia', 'memoria.mjs'), 'utf8');
const bash = (command: string) => clasificar({ tool_name: 'Bash', tool_input: { command } });

test('un commit cuyo MENSAJE nombra algo pesado es liviano: un commit no pide RAM', () => {
  // El caso real del 6/11: el mensaje decía «el tsc entero lo corre la punta» y la guardia lo leyó como un tsc.
  const commit = [
    "git commit -q -F - <<'EOF'",
    'La alarma de minutos deja de mentir',
    '',
    'Guardas del push en verde. El tsc entero lo corre la punta, y npm test queda para Actions.',
    'De paso se sacó un eslint que no servía.',
    'EOF',
  ].join('\n');
  assert.equal(bash(commit), 'liviano', 'un git commit con un heredoc nunca es pesado');
  assert.equal(bash('git commit -m "arreglo del tsc acotado"'), 'liviano');
  assert.equal(bash("git commit -m 'no corre npm ci'"), 'liviano');
  assert.equal(bash('git tag -m "despues del eslint" v1'), 'liviano');
});

test('lo que SÍ pide RAM sigue siendo pesado', () => {
  for (const cmd of ['npx tsc --noEmit', 'npm ci --no-audit', 'npm test', 'npx eslint .', 'next build', 'npx playwright test', 'npm run build']) {
    assert.equal(bash(cmd), 'pesado', `«${cmd}» tiene que seguir siendo pesado`);
  }
  // Y una tanda de tests sin freno, que es el otro camino a «pesado».
  assert.equal(bash('node --import tsx --test tests/a.test.ts tests/b.test.ts tests/c.test.ts'), 'pesado');
  assert.equal(bash('node --import tsx --test tests/*.test.ts'), 'pesado');
  // Un archivo suelto no.
  assert.equal(bash('node --import tsx --test tests/a.test.ts'), 'liviano');
});

// Me volvió a frenar mientras arreglaba lo de arriba: `tandaDeTestsSinFreno` cuenta cuántos archivos de test NOMBRA el
// comando, y uno que los nombra dentro de un `node -e` y de un `grep` los nombra tres veces sin correr ninguno.
test('nombrar archivos de test en un node -e o un grep no es una tanda de tests', () => {
  const t = 'tests/x.' + 'test.ts';
  assert.equal(bash(`node -e "const p='${t}'; console.log(p)" && grep -n algo ${t}`), 'liviano',
    'tres menciones sin correr ninguna no son una tanda');
  assert.equal(bash(`grep -rn --include='*.${'test.ts'}' "npx tsc" tests/`), 'liviano', 'buscar la palabra no es correrla');
  // Pero correr tres de verdad sigue siendo una tanda.
  assert.equal(bash(`node --import tsx --test ${t} tests/y.${'test.ts'} tests/z.${'test.ts'}`), 'pesado');
});

test('un heredoc que se come un INTÉRPRETE sí se clasifica: ahí el cuerpo corre', () => {
  const corriendo = ["bash <<'EOF'", 'npx tsc --noEmit', 'EOF'].join('\n');
  assert.equal(bash(corriendo), 'pesado', 'el cuerpo de un heredoc a bash son comandos de verdad');
  assert.equal(bash(["sh <<'X'", 'npm ci', 'X'].join('\n')), 'pesado');
  assert.equal(bash(['node <<EOF', 'require("child_process").execSync("npx tsc")', 'EOF'].join('\n')), 'pesado');
  // Pero el mismo cuerpo escrito a un archivo es data.
  assert.equal(bash(["cat > /tmp/notas.md <<'EOF'", 'hay que correr npx tsc algun dia', 'EOF'].join('\n')), 'liviano');
});

test('soloLoQueCorre deja el comando y vacía la data', () => {
  const r = soloLoQueCorre("git commit -F - <<'EOF'\nmensaje con tsc\nEOF");
  assert.ok(!/mensaje con tsc/.test(r), `el cuerpo del heredoc quedó adentro: ${r}`);
  assert.ok(/git commit -F -/.test(r), 'el comando tiene que quedar');
  assert.equal(soloLoQueCorre('git commit -m "con tsc"').includes('tsc'), false);
  // Un comando sin heredoc ni -m vuelve igual.
  assert.equal(soloLoQueCorre('npx tsc --noEmit'), 'npx tsc --noEmit');
  assert.equal(soloLoQueCorre(null), '');
});

test('la copia versionada tiene los topes que de verdad corren (3 GB, no 2,5)', () => {
  // 29/10/2026: subieron de 2,5 a 3 por la pantalla negra con 9 chats, y el cambio vivía SÓLO en ~/.claude.
  // Reinstalar desde el repo los bajaba de nuevo, en silencio.
  assert.match(FUENTE, /workflow: \{ minGb: 3(\.0)?,/);
  assert.match(FUENTE, /pesado:\s+\{ minGb: 3(\.0)?,/);
  assert.doesNotMatch(FUENTE, /minGb: 2\.5/, 'volvieron los topes viejos');
  // Y no arranca al importarse: si no, cualquier test que lo lea se queda esperando RAM.
  assert.match(FUENTE, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/);
});
