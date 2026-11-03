// =============================================================================
// Second Brain — punto 13c del feedback del 17/10/2026: que el grafo sirva a los CHATS y ahorre tokens
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · las palabras de una pregunta son las que dicen algo (sin «qué», «cómo», «mi»…), sin tildes;
//   · las semillas: una palabra en el NOMBRE pesa más que en el detalle, y un sinónimo del negocio («cobro») lleva a
//     su área aunque ningún nodo diga esa palabra;
//   · sin semillas, el ÍNDICE (nunca un paquete vacío); con semillas, la VISTA LOCAL: las semillas con sus vecinos en
//     líneas cortas, sin la estructura, con el presupuesto de tokens respetado y lo que quedó afuera dicho;
//   · con ids y profundidad 0, esos datos ENTEROS;
//   · en un grafo de ~60 datos, una pregunta puntual cuesta menos de un tercio del grafo entero (lo que se quiere ahorrar);
//   · la API de MaKo tiene las dos operaciones, gratis y con la puerta del Second Brain, y sus rutas HTTP;
//   · la medición no corre sobre el ws 1 (el cliente real).
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (9 / 0) y restaurando después:
//   · `palabrasDe` sin sacar las palabras vacías: 7 / 2 (también se cae el de las semillas por «cobro»).
//   · sin los sinónimos del negocio (`SINONIMOS[w]` → nada): 8 / 1.
//   · el presupuesto ignorado (sin el `break` del empaquetado): 8 / 1.
//   · los vecinos con la línea larga de una semilla: 8 / 1.
//   · los vecinos que son estructura (la raíz, un área) como líneas: 8 / 1.
//   · sin semillas, un paquete vacío en vez del índice: 8 / 1.
//   · la operación `recuperar_del_segundo_cerebro` sin la puerta del Second Brain: 8 / 1.
//   · el script de medición aceptando el ws 1: 8 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, Cerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { indiceDelCerebro, palabrasDe, recuperar, semillasDe, tokensDe } from '../lib/cerebro-recuperar';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

const n = (id: string, area: NodoCerebro['area'], etiqueta: string, extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta, detalle: `Detalle de ${etiqueta}.`, fuente: '', autoria: 'mako', ...extra,
});

/** Un grafo de ~60 datos, con la forma del de un negocio real (raíz, áreas, una cadena de funnel, ofertas, avatares). */
function grafo(): Pick<Cerebro, 'negocio' | 'nodos' | 'aristas'> {
  const nodos: NodoCerebro[] = [
    n('raiz', 'norte', 'Coaching de ventas'),
    n('area:oferta', 'oferta', 'La oferta'), n('area:avatares', 'avatares', 'Avatares'),
    n('oferta:1', 'oferta', 'Programa Cierra Más', { tipo: 'Oferta principal', detalle: 'Duplicas tus cierres en 90 días.', datos: [{ k: 'Precio', v: 'USD 1.500 · pago único' }], cuerpo: 'Explicación larga de la oferta.' }),
    n('prod:7', 'productos', 'Mentoría Premium', { datos: [{ k: 'Precio', v: 'USD 900' }] }),
    n('voz', 'voz', 'Tu voz', { detalle: 'Cercana, directa, con humor.' }),
  ];
  for (let i = 0; i < 20; i++) nodos.push(n(`av:${i}`, 'avatares', `Avatar ${i}`, { detalle: `Un segmento con un dolor propio número ${i}, y una situación que lo describe en detalle para Meta.` }));
  for (let i = 0; i < 20; i++) nodos.push(n(`raz:${i}`, 'razones', `Razón ${i}`, { detalle: `Por qué compra el segmento ${i}: una motivación larga que se usa en los anuncios y en los guiones.` }));
  for (let i = 0; i < 12; i++) nodos.push(n(`etapa:e${i}`, 'funnel', `Etapa ${i}`, { detalle: `Una etapa del funnel. Desde aquí: avanza o se pierde.` }));
  const aristas: AristaCerebro[] = [
    { de: 'oferta:1', a: 'prod:7', motivo: 'Lo que vende esta oferta' },
    { de: 'oferta:1', a: 'area:oferta', motivo: 'Esto es parte de La oferta' },
    { de: 'raiz', a: 'oferta:1', motivo: 'Un dato del negocio' },
  ];
  for (let i = 0; i < 20; i++) aristas.push({ de: `av:${i}`, a: `raz:${i}`, motivo: 'Este segmento compra por esta razón' }, { de: `av:${i}`, a: 'area:avatares', motivo: 'Esto es parte de Avatares' });
  for (let i = 0; i < 11; i++) aristas.push({ de: `etapa:e${i}`, a: `etapa:e${i + 1}`, motivo: 'Avanza' });
  return { negocio: 'Coaching de ventas', nodos, aristas };
}

/** El grafo ENTERO, una línea por dato (lo que hoy manda /api/second-brain/buscar a la IA). */
const entero = (c: ReturnType<typeof grafo>) => c.nodos.filter((x) => x.id !== 'raiz' && !x.id.startsWith('area:'))
  .map((x) => `[${x.id}] ${x.etiqueta} — ${x.detalle} — ${(x.datos ?? []).map((d) => `${d.k}: ${d.v}`).join(' · ')}`).join('\n');

test('13c · las palabras que cuentan de una pregunta', () => {
  assert.deepEqual(palabrasDe('¿Qué es lo que más cobro en mi Mentoría?'), ['cobro', 'mentoria']);
  assert.deepEqual(palabrasDe('¿cómo?'), []);
  assert.deepEqual(palabrasDe('el avatar 3'), ['avatar', '3'], 'un número corto sí cuenta');
});

test('13c · las semillas: el nombre pesa más, y un sinónimo lleva a su área', () => {
  const c = grafo();
  assert.equal(semillasDe(c, 'la mentoría premium')[0]?.id, 'prod:7', 'por el nombre');
  const porCobro = semillasDe(c, '¿cuánto cobro?').map((x) => x.id);
  assert.ok(porCobro.includes('oferta:1') && porCobro.includes('prod:7'), `«cobro» no está en ningún nodo y lleva a la oferta: ${porCobro}`);
});

test('13c · sin semillas, el índice; con semillas, la vista local', () => {
  const c = grafo();
  const sin = recuperar(c, { pregunta: '¿y entonces?' });
  assert.equal(sin.modo, 'indice');
  assert.match(sin.texto, /el índice del Second Brain/);
  const con = recuperar(c, { pregunta: '¿cuánto cobro por la mentoría?' });
  assert.equal(con.modo, 'vista-local');
  assert.ok(con.nodos.includes('prod:7') && con.nodos.includes('oferta:1'));
  assert.ok(!con.nodos.some((id) => id === 'raiz' || id.startsWith('area:')), 'la estructura no es una línea');
  // El Avatar 3 tiene un vecino que no es estructura (su razón): va en la línea corta.
  const local = recuperar(c, { pregunta: 'el avatar 3' });
  assert.ok(local.nodos.includes('raz:3'), 'el vecino entra');
  const vecinos = local.texto.split('\n').filter((l) => l.startsWith('  - '));
  assert.ok(vecinos.length > 0, 'los vecinos van en su línea corta (con sangría)');
  assert.ok(vecinos.every((l) => !l.includes('↔')), 'la línea de un vecino es corta: sin sus vecinos');
});

test('13c · el presupuesto se respeta y lo que quedó afuera se dice', () => {
  const c = grafo();
  const p = recuperar(c, { pregunta: 'avatar razón etapa', presupuesto: 300, profundidad: 2 });
  assert.ok(p.tokens <= 300 + 30, `${p.tokens} tokens con un presupuesto de 300`);
  assert.ok(p.quedaronAfuera > 0);
  assert.match(p.texto, /Quedaron afuera \d+ nodos/);
});

test('13c · con ids y profundidad 0, esos datos enteros', () => {
  const p = recuperar(grafo(), { ids: ['oferta:1'], profundidad: 0 });
  assert.deepEqual(p.nodos, ['oferta:1']);
  assert.match(p.texto, /Explicación larga de la oferta\./, 'con su cuerpo');
});

test('13c · una pregunta puntual cuesta menos de un tercio del grafo entero', () => {
  const c = grafo();
  const todo = tokensDe(entero(c));
  const p = recuperar(c, { pregunta: '¿cuánto cobro por la mentoría?' });
  assert.ok(p.tokens * 3 < todo, `${p.tokens} contra ${todo}`);
  assert.ok(tokensDe(indiceDelCerebro(c)) < todo, 'y el índice también es más chico que el entero');
});

test('13c · la API de MaKo: dos operaciones gratis, con la puerta del Second Brain, y sus rutas', () => {
  const def = leer('lib/api-mako/areas/negocio.def.ts');
  for (const id of ['indice_segundo_cerebro', 'recuperar_del_segundo_cerebro']) {
    const i = def.indexOf(`id: '${id}'`);
    assert.ok(i > 0, id);
    const bloque = def.slice(i, def.indexOf('\n  },', i));
    assert.match(bloque, /costo: 'gratis'/, `${id}: sin IA`);
    assert.match(bloque, /gating: \{ tab: 'second-brain', rolMinimo: 'admin' \}/, `${id}: la puerta del Second Brain`);
  }
  const run = leer('lib/api-mako/areas/negocio.run.ts');
  // Desde el 28/10/2026, sobre el grafo de los chats (lib/cerebro-para-chat.ts: sin física, en caché, con las funciones).
  assert.match(run, /indice_segundo_cerebro: \{\s*leer: async \(\) => indiceDelCerebro\(await grafoParaChat\(\)\),/);
  assert.match(run, /const p = recuperar\(await conLosCursosDe\(await grafoParaChat\(\), ids\), \{/);
  const rest = leer('lib/api-mako/rest.ts');
  assert.match(rest, /\['GET', '\/negocio\/segundo-cerebro\/recuperar', 'recuperar_del_segundo_cerebro'\]/);
  const snap = leer('tests/api-mako-http.snapshot.txt');
  assert.ok(/^indice_segundo_cerebro$/m.test(snap) && /^recuperar_del_segundo_cerebro$/m.test(snap), 'la lista de HTTP regenerada');
});

test('13c · la medición nunca corre sobre el ws 1', () => {
  const m = leer('scripts/medir-recuperacion.ts');
  assert.match(m, /if \(ws === 1\) \{ console\.error\('el ws 1 es el cliente real: se mide en el 3 o en el 9'\); process\.exit\(2\); \}/);
});

test('13c · el índice nombra cada área con su conteo y sus ids', () => {
  const t = indiceDelCerebro(grafo());
  assert.match(t, /## Oferta/);
  assert.match(t, /- Avatares \(20\): /);
  assert.match(t, /Avatar 0 \[av:0\]/);
});
