// «Editar»: la lámina que la IA no devolvió se pide sola, y si igual falta, se DICE (19/11/2026).
//
// Probando el ticket 119 en el ws 9 (carrusel de 12 láminas, `flash-lite`): volvieron 11. La plancha exige una lámina de la IA
// por cada original, así que el carrusel cayó CALLADO al armado de antes (sin las imágenes del original) y con una lámina menos.
// El Cerebro: «si vuelven 11 de 12 láminas, no se puede caer al armado viejo sin decirlo; que se reintente sólo la que falta».
//
// Fija lo puro (lib/carruseles/replica.ts):
//   1. cada lámina trae su `n` (el número de la lámina del original): van en su orden y se sabe CUÁLES faltan;
//   2. sin números (o repetidos) no se adivina: no hay `faltan`;
//   3. el pedido de UNA lámina dice cuál es, lo que ya dicen las otras, y no pide la acción si no es la última;
//   4. el aviso cuando igual faltan.
// El camino entero (el pedido de la que falta, con su imagen sola) lo fija tests/carruseles-editar.test.ts.
// Correr: node --import tsx --test tests/carruseles-lamina-que-falta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisoDeLaminasQueFaltan, leerReplica, promptDeReplica, type PedidoReplica } from '../lib/carruseles/replica';

const lamina = (n: number | undefined, texto: string) => ({ ...(n == null ? {} : { n }), fondo: '#101010', textos: [{ rol: 'titulo', texto, x: 0.1, y: 0.2, ancho: 0.8, tamano: 0.08, color: '#FFFFFF' }] });
const crudo = (laminas: unknown[]) => JSON.stringify({ proporcion: '4:5', titulo: 'x', laminas });

test('1 · cada lámina con su número: van en orden y se sabe cuáles faltan', () => {
  const r = leerReplica(crudo([lamina(3, 'tres'), lamina(1, 'uno'), lamina(4, 'cuatro')]), { laminas: 5 });
  assert.ok(!('error' in r));
  assert.deepEqual(r.laminas.map((l) => l.n), [1, 3, 4], 'en el orden del original');
  assert.deepEqual(r.laminas.map((l) => l.textos[0].texto), ['uno', 'tres', 'cuatro']);
  assert.deepEqual(r.faltan, [2, 5]);
  const enteras = leerReplica(crudo([lamina(1, 'a'), lamina(2, 'b')]), { laminas: 2 });
  assert.ok(!('error' in enteras) && enteras.faltan === undefined, 'con todas, no falta ninguna');
});

test('2 · sin números, o con uno repetido o fuera de rango, no se adivina cuál falta', () => {
  for (const ls of [[lamina(undefined, 'a'), lamina(undefined, 'b')], [lamina(1, 'a'), lamina(1, 'b')], [lamina(1, 'a'), lamina(9, 'b')]]) {
    const r = leerReplica(crudo(ls), { laminas: 3 });
    assert.ok(!('error' in r));
    assert.equal(r.faltan, undefined, JSON.stringify(ls.map((l) => l.n)));
    assert.equal(r.laminas.length, 2, 'lo que vino, se queda');
  }
  // La lámina que se pidió sola: su número es el del original (5 de 9), y no «faltan» las otras ocho.
  const una = leerReplica(crudo([lamina(5, 'cinco')]), { laminas: 1, de: 9 });
  assert.ok(!('error' in una));
  assert.equal(una.laminas[0].n, 5);
  assert.equal(una.faltan, undefined);
});

const base: PedidoReplica = { laminas: 9, vistas: 9, negocio: 'Una clínica dental.', voz: '', nombreNegocio: 'Sonrisa Llena', cta: 'METAS', conAvatar: false };

test('3 · el pedido entero pide el número de cada lámina; el de UNA, cuál es y lo que ya dicen las otras', () => {
  const entero = promptDeReplica(base);
  assert.match(entero, /"laminas":\[\{"n":1,"fondo"/);
  assert.match(entero, /Exactamente 9 elementos en "laminas", uno por lámina del original, cada uno con su "n"/);
  const escritas = 'Lámina 4: PASO 4\nLámina 6: PASO 6';
  const medio = promptDeReplica({ ...base, laminas: 1, vistas: 1, unaDe: { n: 5, de: 9, escritas } });
  assert.match(medio, /^Te muestro la lámina 5 de un carrusel de Instagram de 9 láminas/);
  assert.match(medio, /<<<ESCRITAS\nLámina 4: PASO 4\nLámina 6: PASO 6\nESCRITAS>>>/);
  assert.match(medio, /Esta lámina NO es la última: no pide la acción\./);
  assert.doesNotMatch(medio, /La última lámina pide comentar/);
  assert.match(medio, /Exactamente 1 elemento en "laminas", con "n": 5\./);
  const ultima = promptDeReplica({ ...base, laminas: 1, vistas: 1, unaDe: { n: 9, de: 9, escritas } });
  assert.match(ultima, /La última lámina pide comentar UNA palabra/, 'la última sí pide la acción');
});

test('4 · si igual faltan, el aviso lo dice; con todas, nada', () => {
  assert.equal(avisoDeLaminasQueFaltan({ laminas: 9, de: 9 }), null);
  assert.equal(avisoDeLaminasQueFaltan({ laminas: 11, de: 12, faltan: [7] }),
    'Tu IA escribió 11 de las 12 láminas (faltó la 7) y no pude completarlas: armé tu versión sin las imágenes del original. Vuelve a intentar para la versión fiel.');
  assert.match(avisoDeLaminasQueFaltan({ laminas: 9, de: 12, faltan: [2, 7, 11] }) ?? '', /\(faltaron las 2, 7 y 11\)/);
  assert.match(avisoDeLaminasQueFaltan({ laminas: 10, de: 12 }) ?? '', /^Tu IA escribió 10 de las 12 láminas y no pude/, 'sin saber cuáles, igual se dice');
});
