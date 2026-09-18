// =============================================================================
// El informe del trimestre lo ofrece el CÓDIGO (08-T13)
// =============================================================================
// Llamada del 8/9/2026: Mauricio le pidió a MaKo por WhatsApp «un reporte de mis
// resultados de marketing de junio, julio y agosto». El informe existe desde el 10/9
// (/analisis/trimestre, leído en dólares) y nada del doer lo sabía. Ahora, si una tool de
// números pide un rango que cubre el trimestre, el link lo agrega el código al final de la
// respuesta —como el del tutorial: una ruta es un dato exacto y no la transporta el
// modelo— y solo en el workspace dueño, porque los números son de Mauricio.
//
// PROBADO ROMPIÉNDOLO: contra el doer de HEAD (antes del arreglo) falla el test de
// CABLEADO, 1 de 4; los tres puros no dependen del doer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { informeParaRango, INFORMES_DEL_DUENO } from '../lib/informe-congelado';

test('el pedido de junio a agosto encuentra el informe del trimestre', () => {
  assert.equal(informeParaRango('2026-06-01', '2026-08-31')?.ruta, '/analisis/trimestre');
  // Un rango que lo contiene también lo encuentra (junio a mediados de septiembre).
  assert.equal(informeParaRango('2026-06-01', '2026-09-15')?.ruta, '/analisis/trimestre');
});

test('un mes suelto, otro período o sin fechas NO ofrecen el informe', () => {
  assert.equal(informeParaRango('2026-08-01', '2026-08-31'), null, 'agosto solo no es el trimestre');
  assert.equal(informeParaRango('2026-09-01', '2026-09-17'), null);
  // Sin «desde» la tool cae a los últimos 90 días: eso no es un pedido del trimestre.
  assert.equal(informeParaRango(null, '2026-08-31'), null);
  assert.equal(informeParaRango('basura', 'x'), null);
});

test('el período sale del informe, no se escribe dos veces', () => {
  const src = readFileSync(new URL('../lib/informe-congelado.ts', import.meta.url), 'utf8');
  assert.match(src, /from '\.\.\/app\/analisis\/trimestre\/datos'/, 'el período dejó de salir del propio informe');
  assert.ok(!/'2026-06-01'|'2026-08-31'/.test(src.replace(/^\s*\/\/.*$/gm, '')),
    'las fechas del trimestre volvieron a escribirse a mano: un informe nuevo las deja viejas');
  assert.ok(INFORMES_DEL_DUENO.length > 0);
});

test('CABLEADO: el doer anota los rangos de las tools de números y el link lo pone el código, solo al dueño', () => {
  const doer = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.match(doer, /name === 'metricas_negocio' \|\| name === 'analisis_negocio'/,
    'el doer dejó de anotar qué rango pidieron las tools de números');
  assert.match(doer, /esWorkspaceDueno\(\)/, 'el link del informe dejó de restringirse al workspace dueño');
  // Lo agrega el código DESPUÉS de la respuesta del modelo, como el tutorial.
  const iTutorial = doer.indexOf('if (textoTutorialSalida) {');
  const iInforme = doer.indexOf('informeParaRango(r.desde, r.hasta)');
  assert.ok(iTutorial > 0 && iInforme > iTutorial, 'el link del informe dejó de agregarse por código al final');
});
