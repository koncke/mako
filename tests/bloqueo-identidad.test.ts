// =============================================================================
// La identidad de un bloqueo: UNA regla para bloquear, desbloquear, preguntar y mostrar (21/10/2026)
// =============================================================================
// EL CASO (cuarta revisión de la 2.1, ws11, en producción desde el 20/10): el dueño bloquea a Juan desde /chats y se
// guarda 542233550684 (el número del espejo); el CRM lo tiene como 2233550684. `estaBloqueado` comparaba EXACTO: la
// secuencia, el AI Step, la rama y los recordatorios de reunión le seguían escribiendo, y desde que el envío completa el
// país (lib/numero-whatsapp.ts, 20/10) el mensaje le LLEGA. Acá se fija:
//   1. la regla pura (`TelefonosDe` / `mismoContacto`): 10 dígitos o más → los últimos 10; 9 (España, Chile, Perú) → el
//      mismo número o ese número con el país adelante; menos de 9 → igual;
//   2. EJECUTANDO (tests/_bloqueo-hijo.ts, un PostgREST de mentira): bloquear con una forma y preguntar con las otras;
//      desbloquear con una forma libera TODAS; la lista de /whatsapp y /chats marca con la misma regla; los ocultos igual;
//   3. cada camino que le escribe a un contacto pregunta a `estaBloqueado` (la regla vive ahí y la heredan sin tocar
//      cada llamada), y nadie más lee `wa_bloqueados` con su propia comparación.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   · `estaBloqueado` exacto otra vez (el de producción)                                → 2 / 1
//   · desbloquear sólo la forma exacta                                                  → 2 / 1
//   · los 9 dígitos comparados exacto (España con y sin el 34)                          → 1 / 2
//   · un 9 contra unos últimos 10 que coinciden (un 10 de México tomado por España)     → 2 / 1
//   · la lista de /whatsapp con un Set exacto                                           → 2 / 1
//   · el recordatorio de reunión con su propia comparación                              → 2 / 1
// Correr: node --import tsx --test tests/bloqueo-identidad.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TelefonosDe, mismoContacto, sufijoDeBusqueda } from '../lib/numero-whatsapp';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('la regla: 10 o más por los últimos 10; 9 con su país; menos de 9, igual', () => {
  // Argentina y México: el mismo contacto con y sin país, con el 9 de los celulares o el 1 de México.
  for (const [a, b] of [['542233550684', '2233550684'], ['5492233550684', '2233550684'], ['542233550684', '5492233550684'],
    ['+54 9 223 355-0684', '2233550684'], ['5215512345678', '5512345678'], ['525512345678', '5215512345678'], ['0034612345678', '34612345678']]) {
    assert.ok(mismoContacto(a, b) && mismoContacto(b, a), `${a} y ${b} son el mismo`);
  }
  // España (9 dígitos): el número sin país es el mismo que con el 34; un 10 que termina igual NO.
  assert.ok(mismoContacto('612345678', '34612345678') && mismoContacto('34612345678', '612345678'));
  assert.ok(mismoContacto('912345678', '56912345678'), 'Chile también es de 9');
  assert.ok(!mismoContacto('612345678', '4612345678'), 'un 10 de otro país que termina en los mismos 9 es otro');
  assert.ok(!mismoContacto('612345678', '525612345678'), 'un número con país que no es de 9 + esos 9, es otro');
  assert.ok(!mismoContacto('612345678', '612345679'));
  // Menos de 9: sólo igual.
  assert.ok(mismoContacto('12345678', '12345678') && !mismoContacto('12345678', '912345678'));
  assert.ok(!mismoContacto('', '') && !mismoContacto(null, '2233550684'), 'vacío no es nadie');
  // Lo que se le pide a la base: los últimos 9 alcanzan a todas las formas.
  assert.equal(sufijoDeBusqueda('5492233550684'), '233550684');
  assert.equal(sufijoDeBusqueda('612345678'), '612345678');
  assert.equal(sufijoDeBusqueda('1234567'), null, 'corto: se busca el número igual');
  const lista = new TelefonosDe(['542233550684', '612345678', null, '']);
  assert.equal(lista.size, 2);
  assert.ok(lista.has('2233550684') && lista.has('34612345678') && !lista.has('4612345678'));
});

test('ejecutando (tests/_bloqueo-hijo.ts): bloquear con una forma frena las otras, y desbloquear libera todas', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_bloqueo-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
  const r = JSON.parse(salida);
  assert.equal(r.error, undefined, r.error);
  // Bloqueado desde /chats con 542233550684: el CRM (2233550684), el 9 y el número con formato, también.
  assert.deepEqual(r.argentina, { '2233550684': true, '542233550684': true, '5492233550684': true, '+54 9 223 355-0684': true, '2233550685': false, '': false });
  assert.deepEqual(r.lista, { '2233550684': true, '5492233550684': true, '2233550685': false }, 'la lista de /whatsapp y /chats marca con la misma regla');
  // España, en los dos sentidos. El 4612345678 de la primera: dos países con los mismos 10 dígitos se bloquean entre sí
  // (falla CERRADO: no se le escribe a uno de más). Un 9 guardado no frena a un 10 que termina igual.
  assert.deepEqual(r.espanaConPais, { '612345678': true, '34612345678': true, '0034612345678': true, '4612345678': true, '612345679': false });
  assert.deepEqual(r.espanaSinPais, { '34612345678': true, '612345678': true, '4612345678': false, '525612345678': false });
  // Desbloquear con OTRA forma (el 9) borra las dos de Juan y no toca a nadie más.
  assert.deepEqual(r.desbloquear, { antes: ['2233550684', '542233550684', '5491100000000'], despues: ['5491100000000'], sigue: false });
  assert.deepEqual(r.ocultos, { ocultoAntes: true, despues: [] }, 'ocultar y volver a mostrar, con la misma regla');
});

test('cada camino que le escribe a un contacto pregunta a estaBloqueado, y nadie más compara por su cuenta', () => {
  // Los AUTOMÁTICOS: la secuencia, el AI Step que contesta solo, la rama, los recordatorios de reunión y los cursos.
  const nutricion = leer('lib/nutricion.ts');
  assert.match(nutricion, /import \{ estaBloqueado \} from '@\/lib\/evolution-block';/);
  assert.equal((nutricion.match(/estaBloqueado\(lead\.telefono\)/g) ?? []).length, 3, 'la secuencia, el AI Step y la rama');
  assert.match(leer('lib/reunion-recordatorio.ts'), /if \(await estaBloqueado\(telefono\)\) \{ omitir\('contacto bloqueado'\); continue; \}/);
  assert.match(leer('lib/curso-mensajes.ts'), /if \(await estaBloqueado\(telefono\)\) return \{ ok: false, motivo: 'contacto bloqueado' \};/);
  assert.match(leer('lib/curso-invitar.ts'), /import\('\.\/evolution-block'\)[\s\S]*if \(await bloqueos\.estaBloqueado\(telefono\)\)/);
  // Los que aprueba una persona: la puerta única de los borradores y la tarjeta de MaKo, con la versión que no calla errores.
  assert.match(leer('lib/borrador-camino.ts'), /if \(await estaBloqueadoEstricto\(b\.telefono\)\) return \{ ok: false, error: 'el contacto está bloqueado' \};/);
  assert.match(leer('lib/api-mako/areas/chats.run.ts'), /if \(await estaBloqueadoEstricto\(b\.telefono\)\) return \{ error:/);
  // La regla vive en UN lugar: evolution-block pregunta con `TelefonosDe`, y las listas también.
  const bloqueo = leer('lib/evolution-block.ts');
  assert.match(bloqueo, /const este = new TelefonosDe\(\[tel\]\);/);
  assert.match(bloqueo, /delete\(\)\.in\('telefono', filas\)/, 'desbloquear borra todas las formas');
  assert.doesNotMatch(bloqueo, /\.eq\('telefono', tel\)\.(?:limit|maybe|single)|count: 'exact'/, 'volvió la pregunta exacta');
  assert.match(leer('lib/nutricion-residuo-cohorte.ts'), /const bloqueados = new TelefonosDe\(bloq\.map\(\(b\) => b\.telefono\)\);/, 'el residuo de nutrición inscribe con la misma regla');
  const chats = leer('lib/chats.ts');
  assert.doesNotMatch(chats, /function por10\(/, '/chats volvió a su propia regla');
  assert.match(chats, /const bloqueado = bloqueados\.has\(tel\);/);
  // Nadie más lee la tabla con su propia comparación (MaKo, por los últimos 10 y con 10 dígitos mínimo, es la excepción
  // anotada en docs/hallazgos-comunicacion.md).
  const permitidos = new Set(['lib/evolution-block.ts', 'lib/api-mako/areas/whatsapp.helpers.ts', 'lib/nutricion-residuo-cohorte.ts']);
  const leen: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const rel = `${dir}/${n}`;
      if (statSync(join(RAIZ, rel)).isDirectory()) { if (n !== 'node_modules') recorrer(rel); continue; }
      if (/\.(ts|tsx)$/.test(n) && /'wa_bloqueados'/.test(leer(rel)) && !permitidos.has(rel)) leen.push(rel);
    }
  };
  for (const d of ['lib', 'app']) recorrer(d);
  assert.deepEqual(leen.filter((f) => /from\('wa_bloqueados'\)|leerTodo[^\n]*'wa_bloqueados'/.test(leer(f))), [], 'alguien lee wa_bloqueados por su cuenta');
});
