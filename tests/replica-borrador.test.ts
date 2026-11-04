// =============================================================================
// Ticket #54: lo leído para replicar queda como BORRADOR, y al volver se retoma (4/11/2026)
// =============================================================================
// Leandro (ws 10): «quise volver para atrás […] se me borró completamente la página analizada […] lo que haría no sería que se
// borre, sino de que quede en estado borrador». La lectura vivía sólo en la pantalla (app/web-generator/crear/Replicar.tsx) y
// volver al chat desde la lista del editor, ir a otra landing o el «atrás» se la llevaban. La regla: lib/editor-landing/
// replica-borrador.ts. Acá corre la regla pura y, en un hijo (tests/_replica-borrador-hijo.ts, con la sesión y la base de
// mentira), las rutas REALES: leer guarda, el borrador se retoma y se lista, lo elegido se guarda, otro negocio no lo ve, un
// closer no entra, descartar lo borra, la réplica que sale bien lo borra, y quedan los ocho más nuevos.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), base 8 / 0, una rotura por vez y restaurada:
//   · la ruta de lectura sin `guardarBorradorReplica`                                  → 6 / 2 (el 6 y el 8)
//   · la ruta de replicar sin `soltarBorrador` (las dos ramas)                          → 7 / 1 (el 8)
//   · `filasDelNegocio` sin el `.eq('workspace_id', ws)`                                → 7 / 1 (el 7)
//   · `esRelectura` que siempre dice true («Leer» nunca retoma)                         → 7 / 1 (el 3)
//   · `sanearDiseno` que deja pasar cualquier color                                     → 7 / 1 (el 2)
//   · `borradoresDeMas` sin el tope                                                     → 7 / 1 (el 4; la lista igual corta en 8)
// Correr: node --import tsx --test tests/replica-borrador.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  TOPE_BORRADORES_REPLICA, borradoresDeMas, claveDeBorrador, eleccionEnPantalla, esRelectura, sanearBorrador, sanearEleccion,
} from '../lib/editor-landing/replica-borrador';

const RAIZ = join(__dirname, '..');
const LECTURA = {
  url: 'https://leandro-ejemplo.com/curso', titulo: 'Aprende a vender',
  secciones: [{ titulo: 'Aprende a vender', subtitulos: 0, parrafos: 1, vinetas: 0, botones: 1, desplegables: 0, palabras: 8 }],
  angulos: null, diseno: { colores: ['#112233', 'url(https://otro.test/espia.png)', 'rgb(1, 2, 3)'], fuentes: ['Inter'], imagenes: 2 },
};
const guardado = (extra: Record<string, unknown> = {}) => ({
  v: 1, url: 'https://leandro-ejemplo.com/curso', lectura: LECTURA, fuente: { lectura: null, texto: null },
  eleccion: { partes: ['diseno', 'estructura', 'angulos'], formato: 'landing', oferta: 'Mi mentoría', tema: null, adaptar: true },
  creado: '2026-11-04T07:00:00.000Z', actualizado: '2026-11-04T07:10:00.000Z', ...extra,
});

test('1. la clave es la de la dirección, se escriba como se escriba', () => {
  assert.equal(claveDeBorrador('leandro-ejemplo.com/curso'), claveDeBorrador('https://leandro-ejemplo.com/curso'));
  assert.notEqual(claveDeBorrador('leandro-ejemplo.com/curso'), claveDeBorrador('leandro-ejemplo.com/otra'));
  assert.equal(claveDeBorrador('esto no es una página'), null);
  assert.match(claveDeBorrador('leandro-ejemplo.com')!, /^landing\.replica_borrador:[0-9a-f]{16}$/);
});

test('2. lo guardado se vuelve a leer saneado, y sólo para su dirección', () => {
  const b = sanearBorrador(JSON.stringify(guardado()), 'leandro-ejemplo.com/curso');
  assert.ok(b);
  assert.deepEqual(b!.lectura.diseno?.colores, ['#112233', 'rgb(1, 2, 3)'], 'un color que es una imagen de afuera no se pinta');
  assert.equal(b!.eleccion.oferta, 'Mi mentoría');
  assert.equal(sanearBorrador(guardado(), 'otra-pagina.com'), null, 'el borrador de otra página no se retoma');
  assert.equal(sanearBorrador({ ...guardado(), lectura: { ...LECTURA, secciones: [] } }), null, 'sin secciones no hay qué retomar');
  assert.equal(sanearBorrador('no es json'), null);
});

test('3. «Leer» retoma; «Leer de nuevo» sobre lo que está a la vista lee de verdad', () => {
  assert.equal(esRelectura(null, 'leandro-ejemplo.com/curso'), false, 'nada a la vista: busca el borrador');
  assert.equal(esRelectura('https://leandro-ejemplo.com/curso', 'leandro-ejemplo.com/curso'), true, 'la misma página: lee de nuevo');
  assert.equal(esRelectura('https://leandro-ejemplo.com/curso', 'otra-pagina.com'), false, 'otra página: busca su borrador');
});

test('4. lo elegido vuelve con un formato que va con las partes', () => {
  const adaptada = eleccionEnPantalla(sanearEleccion({ partes: ['diseno', 'estructura', 'angulos'], formato: 'presentacion', adaptar: true }), 'landing');
  assert.equal(adaptada.formato, 'presentacion');
  assert.equal(adaptada.partes.texto, false);
  const todas = eleccionEnPantalla(sanearEleccion({ partes: ['diseno', 'estructura', 'angulos', 'texto'], formato: 'landing' }), 'landing');
  assert.equal(todas.formato, 'web', 'todas las partes = la copia idéntica');
  const sinPartes = sanearEleccion({ adaptar: true });
  assert.deepEqual(sinPartes.partes, ['diseno', 'estructura', 'angulos'], 'sin partes, las de adaptar');
  assert.equal(sanearEleccion({ tema: 'x"><script>' }).tema, null, 'un tema que no es un id no pasa');
  // El tope: los que pasan de ocho se van, los más viejos.
  const filas = Array.from({ length: TOPE_BORRADORES_REPLICA + 2 }, (_, i) => ({ clave: `k${i}`, actualizado: new Date(Date.now() - i * 60_000).toISOString() }));
  assert.deepEqual(borradoresDeMas(filas), ['k8', 'k9']);
  assert.deepEqual(borradoresDeMas([{ clave: 'viejo', actualizado: '2026-01-01T00:00:00Z' }], Date.parse('2026-11-04T00:00:00Z')), ['viejo'], 'uno vencido también');
});

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--import', 'tsx', join(RAIZ, 'tests', '_replica-borrador-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 240_000,
  env: { ...process.env, NODE_TEST_CONTEXT: undefined },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('5. el hijo corrió entero y no salió a la red', () => {
  assert.equal(R.error, undefined, String(R.error));
  assert.deepEqual(R.red, []);
});

test('6. leer guarda el borrador, y al volver se retoma con lo elegido', () => {
  assert.equal(R.leer.status, 200);
  assert.equal(R.leer.cuerpo.borrador, true);
  assert.equal(R.filas.length, 1);
  assert.equal(R.filas[0].ws, 30, 'en el negocio de la sesión');
  const b = R.retomar.cuerpo.borrador;
  assert.equal(b.url, 'https://leandro-ejemplo.com/curso');
  assert.equal(b.lectura.secciones.length, 3, 'la lectura entera, sin volver a leer');
  assert.equal(b.eleccion.oferta, 'Mentoría de 8 semanas');
  assert.equal(b.eleccion.adaptar, true);
  assert.ok(b.fuente.texto.startsWith('# Aprende a vender'), 'lo pegado vuelve: la réplica no tiene que pedirlo otra vez');
  assert.deepEqual(R.lista.cuerpo.borradores.map((x: { host: string }) => x.host), ['leandro-ejemplo.com']);
  assert.equal(R.cambiar.cuerpo.guardado, true);
  assert.equal(R.trasCambiar.cuerpo.borrador.eleccion.oferta, 'Mentoría de 12 semanas');
  assert.equal(R.trasCambiar.cuerpo.borrador.eleccion.formato, 'presentacion');
  assert.equal(R.cambiarSinBorrador.cuerpo.guardado, false, 'cambiar lo elegido no crea un borrador');
});

test('7. es del negocio: otro no lo ve, y un closer no entra', () => {
  assert.equal(R.otroNegocio.cuerpo.borrador, null);
  assert.deepEqual(R.otroLista.cuerpo.borradores, []);
  assert.equal(R.closer, 403);
});

test('8. descartar lo borra, la réplica que sale bien también, y quedan los ocho más nuevos', () => {
  assert.equal(R.descartar.status, 200);
  assert.equal(R.trasDescartar.cuerpo.borrador, null);
  assert.deepEqual(R.replicar, { antes: 1, despues: 0, status: 200 });
  assert.deepEqual(R.replicarEnVivo, { antes: 1, despues: 0, status: 200 });
  assert.deepEqual(R.tope, ['pagina-8.com', 'pagina-7.com', 'pagina-6.com', 'pagina-5.com', 'pagina-4.com', 'pagina-3.com', 'pagina-2.com', 'pagina-1.com']);
});
