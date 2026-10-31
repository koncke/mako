// =============================================================================
// El cartel de «Hoy» del Media Buyer: nunca «todo anda bien» sin haberlo medido (30/10/2026)
// =============================================================================
// El síntoma: una cuenta recién conectada, sin UNA campaña, sin gastar un peso, leía «Hoy no hay cambios — Todo anda dentro
// de tu objetivo. Vuelvo a mirar mañana.». La pantalla miraba dos cosas (que no hubiera decisiones de hoy y que el agente
// estuviera prendido) y nunca preguntaba si el negocio TIENE campañas.
// Lo que fija este test: cada caso dice algo distinto y verdadero, lleva al próximo paso, y la afirmación «no hay nada que
// mover» sale SÓLO con campañas prendidas y una corrida terminada. Y que las dos pantallas lo usen, en vez de volver a
// escribir la frase a mano.
// Correr: node --import tsx --test tests/media-buyer-cartel-hoy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PASO_EN_EL_TELEFONO, ROTULO_PASO, cartelDeHoy, loVisto,
  type CartelHoy, type EstadoHoy, type PasoHoy,
} from '../lib/media-buyer/cartel-hoy';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (p: string) => readFileSync(`${raiz}${p}`, 'utf8');

/** Lo que el cliente NO puede leer si no lo medimos. */
const MENTIRAS = ['todo anda dentro de tu objetivo', 'todo anda bien', 'todo está bien', 'todo en orden'];
const texto = (c: CartelHoy) => `${c.titulo} ${c.bajada}`.toLowerCase();

const cartel = (o: { encendido?: boolean; conectada?: boolean | null; corrida?: unknown }) => cartelDeHoy({
  encendido: o.encendido ?? true,
  conectada: o.conectada === undefined ? true : o.conectada,
  corrida: o.corrida ?? null,
});
const ok = (campanas: number, activas: number) => ({ estado: 'ok', campanas, activas, nuevas: 0 });

// ── EL CASO QUE IMPORTA ─────────────────────────────────────────────────────

test('cuenta conectada, CERO campañas y el agente prendido: la pantalla NO dice que todo está bien', () => {
  const c = cartel({ encendido: true, conectada: true, corrida: ok(0, 0) });
  assert.equal(c.estado, 'sin_campanas');
  assert.equal(c.titulo, 'Todavía no tienes campañas');
  assert.equal(c.bajada, 'Tu cuenta de Meta está vacía: no hay nada que medir. Lanza la primera y la sigo desde el primer día.');
  // Ni «no hay cambios» (no hay nada de qué no haber cambios) ni una palabra sobre el objetivo.
  assert.ok(!texto(c).includes('no hay cambios'), texto(c));
  for (const m of MENTIRAS) assert.ok(!texto(c).includes(m), `dice «${m}»: ${texto(c)}`);
  // Y lleva al próximo paso: lanzar la primera.
  assert.equal(c.paso, 'crear_campana');
});

test('la frase «no hay nada que mover» sale SÓLO con campañas prendidas y una corrida terminada', () => {
  const casos: Array<[string, CartelHoy]> = [
    ['sin cuenta', cartel({ conectada: false })],
    ['sin campañas', cartel({ corrida: ok(0, 0) })],
    ['todas en pausa', cartel({ corrida: ok(3, 0) })],
    ['apagado', cartel({ encendido: false, corrida: { estado: 'apagado' } })],
    ['nunca corrió', cartel({ corrida: null })],
    ['corrida a medias', cartel({ corrida: { estado: 'parcial' } })],
  ];
  for (const [que, c] of casos) {
    assert.notEqual(c.estado, 'sin_cambios', que);
    assert.ok(!texto(c).includes('nada que mover'), `${que}: ${texto(c)}`);
    for (const m of MENTIRAS) assert.ok(!texto(c).includes(m), `${que} dice «${m}»`);
    assert.ok(c.paso, `${que}: todo caso que no es «no hubo cambios» tiene próximo paso`);
  }
});

// ── CADA ESTADO, SU FRASE Y SU PASO ─────────────────────────────────────────

test('sin cuenta de anuncios: se pide conectarla, y gana sobre todo lo demás', () => {
  for (const c of [
    cartel({ conectada: false }),
    // El token está, pero la corrida no encontró cuenta publicitaria que operar.
    cartel({ conectada: true, corrida: { estado: 'sin_cuenta' } }),
    // Aunque el agente esté apagado y aunque hubiera campañas contadas antes: sin cuenta no hay nada más que decir.
    cartel({ encendido: false, conectada: false, corrida: ok(4, 2) }),
  ]) {
    assert.equal(c.estado, 'sin_cuenta');
    assert.equal(c.titulo, 'Conecta tu cuenta de Meta');
    assert.equal(c.bajada, 'Sin ella no veo tus anuncios ni puedo mover un peso.');
    assert.equal(c.paso, 'conectar');
  }
});

test('mientras no se sabe si la cuenta está conectada, no se le dice «conéctala» a quien ya la tiene', () => {
  // El teléfono no le pregunta a Zernio al abrir, y en la computadora el estado de Zernio llega después del primer dibujo.
  const c = cartel({ conectada: null, corrida: ok(2, 1) });
  assert.equal(c.estado, 'sin_cambios');
});

test('hay campañas pero ninguna prendida: se pide prenderla, antes que prender el agente', () => {
  const varias = cartel({ corrida: ok(3, 0) });
  assert.equal(varias.estado, 'campanas_en_pausa');
  assert.equal(varias.titulo, 'Tus campañas están en pausa');
  assert.equal(varias.bajada, 'Nada está gastando, así que no hay nada que ajustar. Prende una y la sigo.');
  assert.equal(varias.paso, 'prender_campana');

  const una = cartel({ corrida: ok(1, 0) });
  assert.equal(una.titulo, 'Tu campaña está en pausa');
  assert.equal(una.bajada, 'Nada está gastando, así que no hay nada que ajustar. Préndela y la sigo.');

  // Apagado Y en pausa: prender el agente no mueve nada si nada está gastando.
  assert.equal(cartel({ encendido: false, corrida: ok(3, 0) }).estado, 'campanas_en_pausa');
});

test('el agente apagado lo dice, y lleva al interruptor', () => {
  const c = cartel({ encendido: false, corrida: { estado: 'apagado' } });
  assert.equal(c.estado, 'agente_apagado');
  assert.equal(c.titulo, 'Estoy apagado');
  assert.equal(c.bajada, 'Mientras no me prendas no miro tu cuenta ni te aviso de nada.');
  assert.equal(c.paso, 'prender_agente');
  // Apagado con campañas prendidas contadas: sigue siendo el interruptor lo que falta.
  assert.equal(cartel({ encendido: false, corrida: ok(2, 2) }).estado, 'agente_apagado');
});

test('campañas prendidas y un día de verdad sin cambios: lo dice con el número que midió', () => {
  const varias = cartel({ corrida: ok(5, 3) });
  assert.equal(varias.estado, 'sin_cambios');
  assert.equal(varias.titulo, 'Hoy no hay cambios');
  assert.equal(varias.bajada, 'Miré tus 3 campañas activas y no hay nada que mover. Vuelvo a mirar mañana.');
  assert.equal(varias.paso, null, 'el único caso sin próximo paso: no hay nada que hacer');

  const una = cartel({ corrida: ok(1, 1) });
  assert.equal(una.bajada, 'Miré tu campaña activa y no hay nada que mover. Vuelvo a mirar mañana.');
});

test('el agente nunca corrió: no afirma nada, pide la pasada', () => {
  const c = cartel({ corrida: null });
  assert.equal(c.estado, 'sin_medir');
  assert.equal(c.titulo, 'Todavía no miré tu cuenta');
  assert.equal(c.bajada, 'Dame una pasada y te digo qué conviene mover.');
  assert.equal(c.paso, 'analizar');
});

test('una corrida que no dejó lectura completa no se lee como «todo bien»', () => {
  // Las abstenciones del agente (corrida.ts): se abstiene, así que la pantalla también.
  for (const estado of ['parcial', 'datos_viejos', 'moneda_sin_tasa', 'cuenta_compartida', 'error', 'sin_tabla']) {
    const c = cartel({ corrida: { estado } });
    assert.equal(c.estado, 'sin_lectura', estado);
    assert.equal(c.paso, 'analizar', estado);
  }
  const c = cartel({ corrida: { estado: 'parcial' } });
  assert.equal(c.titulo, 'Todavía no sé cómo vienes');
  // Ni siquiera NEGADA entra la frase: una guardia que se puede engañar con un «no» no sirve de guardia.
  assert.equal(c.bajada, 'No tengo una lectura completa de tu cuenta, y no te digo nada que no haya medido.');
  // Un resumen VIEJO (de antes de contar las campañas) dice «ok» y no trae los números: tampoco alcanza para afirmar.
  assert.equal(cartel({ corrida: { estado: 'ok', nuevas: 0 } }).estado, 'sin_lectura');
});

// ── EL RESUMEN VIENE DE UN JSONB: NO SE LE CREE NADA ────────────────────────

test('loVisto no se cree nada de lo que haya en ultima_corrida_info', () => {
  assert.deepEqual(loVisto(null), { estado: null, campanas: null, activas: null });
  assert.deepEqual(loVisto('ok'), { estado: null, campanas: null, activas: null });
  assert.deepEqual(loVisto([1, 2]), { estado: null, campanas: null, activas: null });
  assert.deepEqual(loVisto({ estado: '', campanas: '3', activas: 1.5 }), { estado: null, campanas: null, activas: null });
  assert.deepEqual(loVisto({ estado: 'ok', campanas: -1, activas: NaN }), { estado: 'ok', campanas: null, activas: null });
  // Más prendidas que vivas es un resumen roto: se descarta el número antes de dibujar un estado inventado.
  assert.deepEqual(loVisto({ estado: 'ok', campanas: 2, activas: 7 }), { estado: 'ok', campanas: 2, activas: null });
  assert.equal(cartel({ corrida: { estado: 'ok', campanas: 2, activas: 7 } }).estado, 'sin_lectura');
});

// ── TODO ESTADO, CON TEXTO; TODO PASO, CON ROTULO EN LAS DOS PANTALLAS ──────

test('cada estado tiene título y bajada cortos, en primera persona, y ningún paso queda sin rótulo', () => {
  const todos: Array<[EstadoHoy, CartelHoy]> = [
    ['sin_cuenta', cartel({ conectada: false })],
    ['sin_campanas', cartel({ corrida: ok(0, 0) })],
    ['campanas_en_pausa', cartel({ corrida: ok(2, 0) })],
    ['agente_apagado', cartel({ encendido: false, corrida: { estado: 'apagado' } })],
    ['sin_cambios', cartel({ corrida: ok(2, 2) })],
    ['sin_medir', cartel({ corrida: null })],
    ['sin_lectura', cartel({ corrida: { estado: 'parcial' } })],
  ];
  const vistos = new Set<EstadoHoy>();
  for (const [esperado, c] of todos) {
    assert.equal(c.estado, esperado);
    vistos.add(c.estado);
    assert.ok(c.titulo.length > 0 && c.titulo.length <= 40, `${esperado}: título de ${c.titulo.length}`);
    assert.ok(c.bajada.length > 0 && c.bajada.length <= 160, `${esperado}: bajada de ${c.bajada.length}`);
    // Sin jerga: nada de nombres internos del motor en la cara del cliente.
    for (const jerga of ['corrida', 'resumen', 'workspace', 'api', 'parcial', 'táctica', 'kpi']) {
      assert.ok(!texto(c).includes(jerga), `${esperado} dice «${jerga}»`);
    }
  }
  assert.equal(vistos.size, 7, 'los siete estados, todos distintos');

  const pasos: PasoHoy[] = ['conectar', 'crear_campana', 'prender_campana', 'prender_agente', 'analizar'];
  for (const p of pasos) {
    assert.ok(ROTULO_PASO[p]?.length, `sin rótulo de computadora: ${p}`);
    assert.ok(PASO_EN_EL_TELEFONO[p]?.length, `sin dónde-se-hace del teléfono: ${p}`);
  }
  assert.equal(Object.keys(ROTULO_PASO).length, pasos.length);
  assert.equal(Object.keys(PASO_EN_EL_TELEFONO).length, pasos.length);
});

// ── LAS DOS PANTALLAS, CON EL MISMO CRITERIO ────────────────────────────────

test('la computadora y el teléfono sacan el cartel de acá, y ninguna repite la frase vieja', () => {
  for (const p of ['app/ads-manager/MediaBuyer.tsx', 'app/m/ads/MediaBuyerM.tsx']) {
    const src = leer(p);
    assert.ok(/from '@\/lib\/media-buyer\/cartel-hoy'/.test(src), `${p} no usa cartel-hoy`);
    assert.ok(/cartelDeHoy\(/.test(src), `${p} no llama a cartelDeHoy`);
    assert.ok(!src.includes('Todo anda dentro de tu objetivo'), `${p} volvió a escribir la frase a mano`);
    assert.ok(!src.includes('titulo="Hoy no hay cambios"'), `${p} fija el título sin mirar si hay campañas`);
    assert.ok(!src.includes('<h1>Hoy no hay cambios</h1>'), `${p} fija el título sin mirar si hay campañas`);
  }
});

test('la corrida deja contadas las campañas que vio, sólo cuando terminó', () => {
  const src = leer('lib/media-buyer/corrida.ts');
  // Los números van en el return del estado `ok`: una cuenta vista a medias no dice cuántas campañas hay.
  assert.ok(/campanas\?: number;/.test(src) && /activas\?: number;/.test(src), 'ResumenCorrida sin los números');
  assert.ok(/campanas: vivas\.length, activas: vivas\.filter\(/.test(src), 'la corrida no cuenta las campañas del árbol');
  const retornosParciales = src.match(/return \{ estado: '(parcial|datos_viejos|moneda_sin_tasa|cuenta_compartida|apagado|sin_tabla)'/g) ?? [];
  assert.ok(retornosParciales.length >= 4, 'cambiaron las abstenciones de la corrida: revisa que ninguna cuente campañas');
  for (const r of retornosParciales) assert.ok(!r.includes('campanas:'), `una abstención cuenta campañas: ${r}`);
});
