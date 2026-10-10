// Las piezas del lienzo que estaban COPIADAS en varios editores viven en un lugar (restos de versiones
// anteriores, 10/10/2026): `BotonPila` estaba carácter por carácter en una automatización y en un mensaje de
// MaKo, y el recordatorio no tenía sus botones porque no se exportaba. Una copia no recibe los arreglos del
// original. Esto barre app/ y frena una copia nueva.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 2 / 0:
//   U1. una `function BotonPila` de vuelta en FlujoAviso                 → 1 / 1
//   U2. (el recordatorio era un lienzo propio sin los botones; desde el 10/10/2026 es una automatización
//       más, con los de SecuenciaPerfil)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const archivos = execFileSync('git', ['ls-files', 'app'], { encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f));
const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('`BotonPila` se define UNA vez (app/automations/BotonPila.tsx)', () => {
  const donde = archivos.filter((f) => /function BotonPila\(/.test(leer(f)));
  assert.deepEqual(donde, ['app/automations/BotonPila.tsx'], 'hay una copia de BotonPila');
});

test('el lienzo de una automatización (el recordatorio incluido) tiene los botones de la pila', () => {
  const r = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(r, /import \{ BotonPila \} from '\.\/BotonPila';/);
  assert.match(r, /onClick=\{deshacer\} activo=\{puedeDeshacer\}[\s\S]*?onClick=\{rehacer\} activo=\{puedeRehacer\}/);
});
