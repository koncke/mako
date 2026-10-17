// =============================================================================
// Un comando de PowerShell sólo para las cuentas que tienen su función en el $PROFILE (17/10/2026)
// =============================================================================
// La cuenta 4 corre sólo en la app de Claude (~/.claude). El panel de Uso le ofreció a Martín `claude4 -n Runner`, y
// PowerShell contestó «not recognized»: no hay función `claude4` en su perfil. A una cuenta de la app se le dice que
// abra su Runner en la app, sin comando (lib/runner.ts → tieneTerminal; docs/hallazgos-operaciones.md, «La cuenta 4»).
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 2 pases:
//   · tieneTerminal devolviendo siempre true → 1 fallo;
//   · Uso.tsx copiando `COMANDO_TERMINAL(k.cuenta)` con `onCopiar` directo, sin mirar la cuenta → 1 fallo;
//   · PanelRunner.tsx con `const comando = COMANDO_TERMINAL(k.cuenta);` sin la condición → 1 fallo.
//   Restaurado de memoria (no con git checkout): 2 pases.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CUENTAS_TERMINAL, tieneTerminal } from '../lib/runner';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('sólo las cuentas del perfil de PowerShell tienen terminal', () => {
  for (const c of CUENTAS_TERMINAL) assert.equal(tieneTerminal(c), true, c);
  assert.equal(tieneTerminal('claude4'), false, 'la 4 corre sólo en la app');
  assert.equal(tieneTerminal(''), false);
});

test('el panel de Uso y el de Runners no le ofrecen un comando a una cuenta sin terminal', () => {
  const uso = sinComentarios(leer('app/admin/operaciones/Uso.tsx'));
  assert.match(uso, /const copiable = onCopiar && tieneTerminal\(k\.cuenta\) \? onCopiar : null;/);
  assert.doesNotMatch(uso, /onCopiar\(COMANDO_TERMINAL\(/, 'el comando se copia sólo por `copiable`');
  const panel = sinComentarios(leer('app/admin/operaciones/PanelRunner.tsx'));
  assert.match(panel, /const comando = tieneTerminal\(k\.cuenta\) \? COMANDO_TERMINAL\(k\.cuenta\) : null;/);
  assert.match(panel, /\{comando && \(!vivo \|\| sinRunner > 0\) && \(/, 'sin comando no hay botón');
});
