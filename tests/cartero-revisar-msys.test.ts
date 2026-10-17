// =============================================================================
// `cartero.mjs cierre … --revisar "/ruta"` desde Git Bash (cartero 1.15.1, 17/10/2026)
// =============================================================================
// Lo vieron el Runner y el Cerebro: `cierre <id> --hecho … --revisar "/admin/operaciones"` fallaba en Git Bash, porque
// MSYS convierte todo argumento que empieza con `/` en una ruta de la carpeta de Git (`C:/Program Files/Git/admin/…`) y el
// cierre rechazaba lo que no empieza con `/`. Los chats no podían dejar su «Ya está» con la página donde se prueba.
// Se arregla en `cierre()` (scripts/operaciones/cartero.mjs → rutaDesdeMsys): se recupera la `/ruta` de lo que va después
// de `…/Git/`. No se le pide al chat `MSYS_NO_PATHCONV=1` en el mensaje: en PowerShell esa línea no corre.
//
// Probado ROMPIÉNDOLO (17/10/2026, base en 2 pases): `cierre()` sin `rutaDesdeMsys` (el `--revisar` crudo) → 1 fallo (el
// de punta a punta); `rutaDesdeMsys` devolviendo lo que recibe → 2 fallos.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';

const CARTERO = join(import.meta.dirname, '..', 'scripts/operaciones/cartero.mjs');

test('la ruta que convirtió Git Bash vuelve a ser la de MaKo; lo demás queda tal cual', async () => {
  const { rutaDesdeMsys } = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(rutaDesdeMsys('C:/Program Files/Git/admin/operaciones'), '/admin/operaciones');
  assert.equal(rutaDesdeMsys('C:\\Program Files\\Git\\crm?lead=12'), '/crm?lead=12');
  assert.equal(rutaDesdeMsys('D:/herramientas/Git/m/operaciones?centro=nombre:crm'), '/m/operaciones?centro=nombre:crm');
  assert.equal(rutaDesdeMsys('/crm?lead=12'), '/crm?lead=12');
  assert.equal(rutaDesdeMsys('https://otro.com/x'), 'https://otro.com/x', 'lo de afuera sigue rechazándose en cierre()');
  assert.equal(rutaDesdeMsys(''), '');
});

test('de punta a punta: el cierre con la ruta convertida queda guardado con la ruta de MaKo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cartero-msys-'));
  const id = 'aaaaaaaa-0000-4000-8000-0000000000c1';
  await new Promise<void>((ok, mal) => execFile(process.execPath, [CARTERO, 'cierre', id, '--hecho', 'listo', '--revisar', 'C:/Program Files/Git/admin/operaciones'], {
    env: { ...process.env, CARTERO_DIR: dir, CARTERO_APP_DIR: join(dir, 'app'), CARTERO_CONFIG_DIR: join(dir, 'cfg') },
  }, (e, _so, se) => (e ? mal(new Error(se || e.message)) : ok())));
  const guardado = JSON.parse(readFileSync(join(dir, 'cierres', `${id}.json`), 'utf8'));
  assert.equal(guardado.cierre.revisar, '/admin/operaciones');
});
