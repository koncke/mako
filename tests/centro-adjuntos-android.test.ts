// =============================================================================
// Ticket #8 (25/10/2026): «No pude subir los adjuntos: vuelve a mandarlo», desde el Android de Martín
// =============================================================================
// En Chrome de Android un archivo de la galería o de la cámara deja de poder leerse si la app pasa a segundo plano
// (`NotReadableError`), y la caja lo leía recién al «Firmar y mandar». Esto fija:
//   1. `enMemoria` deja una copia que se lee aunque el original ya no;
//   2. la caja la hace AL ELEGIR (useCentro.ts → sumarAdjuntos), y si no puede, dice cuál archivo;
//   3. las dos subidas dicen qué falló (leer, la red, la respuesta) en vez del genérico.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): `enMemoria` devolviendo el original → 1 rojo (1); la caja sin `enMemoria`
// → 1 rojo (2); la subida directa leyendo sin su try → 1 rojo (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ERROR_SUBIDA, enMemoria } from '../app/admin/operaciones/leer-adjunto';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la copia en memoria se lee aunque el original ya no (lo que hace Android con un content://)', async () => {
  const original = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], 'foto.jpg', { type: 'image/jpeg', lastModified: 1_700_000_000_000 });
  const copia = await enMemoria(original);
  // El original deja de poder leerse (el permiso del content:// se perdió con la app en segundo plano).
  Object.defineProperty(original, 'arrayBuffer', { value: () => Promise.reject(new DOMException('could not be read', 'NotReadableError')) });
  await assert.rejects(original.arrayBuffer());
  assert.notEqual(copia, original, 'devolvió el mismo archivo: al mandar se vuelve a leer el content://');
  assert.deepEqual([...new Uint8Array(await copia.arrayBuffer())], [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.equal(copia.name, 'foto.jpg');
  assert.equal(copia.type, 'image/jpeg');
  assert.equal(copia.lastModified, 1_700_000_000_000);
});

test('2. la caja lo lee AL ELEGIR, y si no puede dice cuál', () => {
  const motor = leer('app/admin/operaciones/useCentro.ts');
  const sumar = motor.slice(motor.indexOf('const sumarAdjuntos = async'), motor.indexOf('const quitarAdjunto = '));
  assert.match(sumar, /try \{ listos\.push\(await enMemoria\(listo\)\); \} catch \{ avisar\(ERROR_SUBIDA\.leer\(f\.name\), 'bad'\); \}/);
  assert.equal(ERROR_SUBIDA.leer('foto.jpg'), 'No pude leer «foto.jpg»: quítalo y vuelve a elegirlo.');
});

test('3. las dos subidas dicen qué falló: leer el archivo, la red o la respuesta de MaKo', () => {
  const m = leer('app/admin/operaciones/mandar.ts');
  const directo = m.slice(m.indexOf('async function subirDirecto'), m.indexOf('export async function copiar'));
  assert.match(directo, /try \{ b = new Uint8Array\(await f\.arrayBuffer\(\)\); \} catch \{ return \{ ok: false, error: ERROR_SUBIDA\.leer\(f\.name\) \}; \}/);
  assert.equal((directo.match(/catch \{ return \{ ok: false, error: ERROR_SUBIDA\.red \}; \}/g) ?? []).length, 2, 'la firma de la subida y el PUT al storage');
  assert.match(directo, /catch \{ return \{ ok: false, error: ERROR_SUBIDA\.servidor\(r\.status\) \}; \}/);
  const vercel = m.slice(m.indexOf('export async function subirAdjuntos'), m.indexOf('async function subirDirecto'));
  assert.match(vercel, /catch \{ return \{ ok: false, error: ERROR_SUBIDA\.leer\(f\.name\) \}; \}/);
  assert.match(vercel, /catch \{ return \{ ok: false, error: ERROR_SUBIDA\.red \}; \}/);
  assert.match(vercel, /catch \{ return \{ ok: false, error: ERROR_SUBIDA\.servidor\(r\.status\) \}; \}/);
});
