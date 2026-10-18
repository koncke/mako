// =============================================================================
// Adjuntos sin el tope de 4 MB ni el de 4 archivos, y arrastrar y soltar (18/10/2026, pedido 9a143455)
// =============================================================================
// Martín: «aquí en el chat del Center hay limitación de hasta 4mb de archivos, quita esa limitación... Y también debería
// funcionar si ARRASTRO una img o un doc al chat, debería tomarlo» y «dice "Máximo 4 archivos" elimina esa restricción».
// Medido ese día: el bucket `archivero` no tiene tope y el proyecto acepta ≥2 GB por archivo; el corte era Vercel (~4,5 MB
// por ruta, de ida y de vuelta). 20 MB subieron (PUT sin apikey, 2,8 s) y bajaron (GET sin token, 2,3 s) por URL firmada,
// idénticos. Lo que se fija:
//   1. con un Runner 1.16.0: hasta 20 archivos de hasta 100 MB; con uno de antes, los topes de siempre (4 y 4 MB);
//   2. el navegador sube DIRECTO al storage: tipo por los BYTES, sha256 de lo que sube, y una URL firmada por archivo;
//   3. arrastrar archivos a la conversación los adjunta (un texto arrastrado no se toca), y se avisa si el chat no recibe.
//
// Probado rompiéndolo (18/10/2026, con la base en 0 fallos):
//   · `problemaDeAdjuntosCaja` sin mirar si el Runner es nuevo (siempre grandes) → 1 fallo (1);
//   · `subirAdjuntos` sin pasar `grandesDe(c)` → 1 fallo (2);
//   · `alSoltar` sin mirar si trae archivos → 1 fallo (3).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_ADJUNTOS, MAX_BYTES_ADJUNTO, VERSION_ADJUNTOS_GRANDES, aceptaAdjuntosGrandes, problemaDeAdjuntosCaja,
} from '../lib/operaciones-reglas';
import { alSoltar, traeArchivos } from '../app/admin/operaciones/pegar';
import type { AdjuntosDeCaja } from '../app/admin/operaciones/AdjuntosCaja';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');
const MB = 1024 * 1024;

test('1. con un Runner 1.16.0, hasta 20 archivos de hasta 100 MB; con uno de antes, los topes de siempre', async () => {
  assert.equal(MAX_ADJUNTOS, 20);
  assert.equal(MAX_BYTES_ADJUNTO, 100 * MB);
  assert.equal(problemaDeAdjuntosCaja(Array(20).fill(90 * MB), true), null, 'veinte de 90 MB');
  assert.equal(problemaDeAdjuntosCaja(Array(21).fill(1), true), 'Máximo 20 archivos.');
  assert.equal(problemaDeAdjuntosCaja([100 * MB + 1], true), 'Hasta 100 MB cada uno.');
  assert.equal(problemaDeAdjuntosCaja([5 * MB], false), 'Hasta 4 MB con este Runner.', 'un Runner viejo lo baja por Vercel');
  assert.equal(problemaDeAdjuntosCaja([1, 1, 1, 1, 1], false), 'Máximo 4 archivos con este Runner.');
  assert.equal(problemaDeAdjuntosCaja([1, 1, 1, 1], false), null);
  assert.equal(aceptaAdjuntosGrandes('1.15.8'), false);
  assert.equal(aceptaAdjuntosGrandes(VERSION_ADJUNTOS_GRANDES), true);
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  assert.ok(aceptaAdjuntosGrandes(cartero.VERSION), 'el cartero de este árbol baja los grandes');
});

test('2. el navegador sube directo al storage: tipo por los bytes, su sha256 y una URL firmada por archivo', () => {
  const m = leer('app/admin/operaciones/mandar.ts');
  assert.match(m, /if \(grandes\) return subirDirecto\(archivos\);/);
  const d = m.slice(m.indexOf('async function subirDirecto'));
  assert.match(d, /const mime = tipoPorFirma\(b\.subarray\(0, 16\)\)\?\.mime;/, 'el tipo, por los primeros bytes');
  assert.match(d, /sha256: hex\(await crypto\.subtle\.digest\('SHA-256', b\)\)/, 'el hash, de lo que sube');
  assert.match(d, /fetch\(subidas\[i\]\.url, \{\n\s*method: 'PUT', body: f,/, 'directo a la URL firmada, sin pasar por Vercel');
  const motor = leer('app/admin/operaciones/useCentro.ts');
  assert.match(motor, /const s = await subirAdjuntos\(archivos\.map\(\(a\) => a\.file\), grandesDe\(c\)\);/);
  assert.match(motor, /const problema = problemaDeAdjuntosCaja\(\[[^\]]*\], grandes\);/, 'los topes de la caja, según el Runner');
  assert.doesNotMatch(motor, /problemaDeSeleccion\(/, 'no los del chat con MaKo');
});

test('3. arrastrar archivos a la conversación los adjunta; un texto arrastrado no se toca', () => {
  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'captura.png', { type: 'image/png' });
  const sumados: File[][] = [];
  let noPuede = 0;
  const caja = (puede: boolean): AdjuntosDeCaja => ({ items: [], puede, onSumar: (f) => sumados.push(f), onQuitar: () => {}, onNoPuede: () => { noPuede += 1; } });
  const evento = (types: string[], files: File[]) => {
    let prevenido = false;
    const e = { dataTransfer: { types, files, items: [] }, preventDefault: () => { prevenido = true; } };
    return { e: e as unknown as Parameters<typeof alSoltar>[0], prevenido: () => prevenido };
  };
  const a = evento(['Files'], [png]);
  alSoltar(a.e, caja(true));
  assert.equal(a.prevenido(), true, 'el navegador no lo abre en la pestaña');
  assert.deepEqual(sumados, [[png]], 'entra como adjunto');
  const t = evento(['text/plain'], []);
  alSoltar(t.e, caja(true));
  assert.equal(t.prevenido(), false, 'un texto arrastrado sigue su camino');
  alSoltar(evento(['Files'], [png]).e, caja(false));
  assert.equal(noPuede, 1, 'si el chat no recibe archivos, se dice');
  assert.equal(traeArchivos({ types: ['Files'] } as unknown as DataTransfer), true);
  const conv = leer('app/admin/operaciones/Conversacion.tsx');
  assert.match(conv, /onDrop=\{\(e\) => \{ setSoltando\(false\); alSoltar\(e, adjuntos\); \}\}/, 'la conversación de la computadora');
});
