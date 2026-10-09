// =============================================================================
// El lienzo NO ofrece lo que `validarGrafo` rechaza por un BUCLE de «Ir a»
// =============================================================================
// Revisión de la segunda tanda (09/10/2026, frente modelo), medido ejecutando el código: en
// CRON → m1 → esperar → «Ir a» m1, `grafoDeSecuencia` marcaba `paralelo: true` en m1 y en la
// espera, porque `admiteParalelo` (lib/flujo-conversacion.ts) miraba la clase, «Si responde» y los
// topes y NO los bucles. `insertarDesdeLienzo(pasos, 'm1', 'par', …)` dejaba un flujo que Publicar
// rechazaba con «saca flechas en paralelo dentro de un bucle de «Ir a»». Y con m1 ya repartiendo,
// `tarjetasParaIrA` le ofrecía m1 a un «Ir a» puesto después de la espera: elegirla armaba ese mismo
// bucle. El comentario de al lado prometía lo contrario («ofrecerlas donde validarGrafo las rechaza
// sería un control que no se puede guardar»).
//
// La cura es UNA función para la regla y para lo que se ofrece: `nodosEnBucle` / `repartenEnBucle`
// (lib/flujo-grafo.ts), que usan `reglasDeHilos`, `admiteParalelo` y `tarjetasParaIrA`.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con todo puesto: 6 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con git). Pasan / fallan:
//   1. `admiteParalelo` sin `!enBucle.has(ids[i])`                              -> 4 / 2
//   2. `tarjetasParaIrA` sin `&& !armaBucle(id)`                                 -> 5 / 1
//   3. `armaBucle` contra un conjunto vacío (no contra el flujo sin destino)     -> 5 / 1
//   4. `nodosEnBucle` sin seguir los saltos de un «Ir a»                         -> 2 / 4
//      (y 1 fallo en tests/flujo-grafo-paralelos.test.ts: la regla de validar lee la misma función)
//
// Correr: node --import tsx --test tests/flujo-bucle-paralelos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  grafoDeSecuencia, insertarDesdeLienzo, tarjetasParaIrA, cambiarNodo, ID_ENTRADA,
  type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import { validarGrafo, nodosEnBucle, repartenEnBucle, ID_INICIO } from '../lib/flujo-grafo';

const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const mail = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => msg(id, { canal: 'email', asunto: 'Asunto', cuerpo: 'Cuerpo', ...extra });
const esp = (id: string, siguiente: string | null): PasoParaGrafo => ({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, canal: 'whatsapp', delay_horas: 0, cuerpo: '', siguiente });
const irA = (id: string, nodo?: string): PasoParaGrafo => ({ id, nodo: 'ir_a', canal: 'whatsapp', delay_horas: 0, cuerpo: '', ...(nodo ? { destino: { nodo } } : {}) });
const inicio = (siguiente: string | null, paralelos: string[] = []): PasoParaGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente, ...(paralelos.length ? { paralelos } : {}), canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };
const bucle = (errs: string[]) => errs.filter((e) => e.includes('dentro de un bucle'));

/** El caso medido: CRON → m1 → esperar 1 día → «Ir a» m1 (volver al principio, como ManyChat). */
const volverAlPrincipio = (): PasoParaGrafo[] => [inicio('m1'), msg('m1', { siguiente: 'w1' }), esp('w1', 'g1'), irA('g1', 'm1')];

test('⚠️ `nodosEnBucle`: el ciclo del grafo de EJECUCIÓN, incluidos dos saltos cruzados entre ramas', () => {
  assert.deepEqual(validarGrafo(volverAlPrincipio()), [], 'el fixture tiene que ser un flujo válido');
  assert.deepEqual([...nodosEnBucle(volverAlPrincipio())].sort(), ['g1', 'm1', 'w1']);
  // Dos ramas de una condición que saltan cada una a la otra: ningún salto vuelve a su propio
  // ancestro, y aun así es un bucle.
  const cruzados: PasoParaGrafo[] = [
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', delay_horas: 0, cuerpo: '', ramas: [{ id: 'cr0', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'a' }], si_no: 'b' },
    msg('a', { siguiente: 'wa' }), esp('wa', 'ja'), irA('ja', 'b'),
    msg('b', { siguiente: 'wb' }), esp('wb', 'jb'), irA('jb', 'a'),
  ];
  assert.deepEqual([...nodosEnBucle(cruzados)].sort(), ['a', 'b', 'ja', 'jb', 'wa', 'wb']);
  // Sin «Ir a» no hay bucle (los puertos solos forman un árbol).
  assert.equal(nodosEnBucle([msg('a', { siguiente: 'b' }), msg('b')]).size, 0);
  // Y la regla de validar lee la misma función: m1 repartiendo dentro del bucle se rechaza.
  const mal = [...volverAlPrincipio().map((p) => (p.id === 'm1' ? { ...p, paralelos: ['e1'] } : p)), mail('e1')];
  assert.deepEqual([...repartenEnBucle(mal)], ['m1']);
  assert.equal(bucle(validarGrafo(mal)).length, 1);
});

test('⚠️ el ＋ en paralelo NO se ofrece en una tarjeta de un bucle; afuera del bucle, sí', () => {
  const g = grafoDeSecuencia(volverAlPrincipio(), { disparador: 'X' });
  assert.equal(nodo(g, 'm1').puertos![0].paralelo, undefined, 'se ofreció «En paralelo» en m1, dentro del bucle');
  // Sexta tanda (DELAY 1): la espera de m1 al «Ir a» va SOBRE la flecha, sin salida propia: no ofrece nada.
  assert.equal(nodo(g, 'w1').enFlecha, true);
  assert.deepEqual(nodo(g, 'w1').puertos, [], 'se ofreció «En paralelo» en la espera, dentro del bucle');
  // Una tarjeta ANTES del bucle (m0 no vuelve a sí misma) sigue pudiendo repartir.
  const conM0 = [inicio('m0'), msg('m0', { siguiente: 'm1' }), msg('m1', { siguiente: 'w1' }), esp('w1', 'g1'), irA('g1', 'm1')];
  assert.deepEqual(validarGrafo(conM0), []);
  const g0 = grafoDeSecuencia(conM0, { disparador: 'X' });
  assert.equal(nodo(g0, 'm0').puertos![0].paralelo, true, 'm0 está fuera del bucle y no ofrece «En paralelo»');
  assert.equal(nodo(g0, ID_ENTRADA).puertos![0].paralelo, true, 'el CRON no ofrece «En paralelo»');
});

test('⚠️ TODO ＋ en paralelo que el lienzo ofrece se puede publicar (la propiedad, sobre varios flujos)', () => {
  const flujos: Array<[string, PasoParaGrafo[]]> = [
    ['volver al principio', volverAlPrincipio()],
    ['con una tarjeta antes del bucle', [inicio('m0'), msg('m0', { siguiente: 'm1' }), msg('m1', { siguiente: 'w1' }), esp('w1', 'g1'), irA('g1', 'm1')]],
    ['bucle adentro de un hilo paralelo', [inicio('a', ['w']), msg('a'), msg('w', { siguiente: 'e' }), esp('e', 'j'), irA('j', 'w')]],
    ['sin bucles', [inicio('a'), msg('a', { siguiente: 'b' }), esp('b', 'c'), msg('c')]],
  ];
  for (const [nombre, pasos] of flujos) {
    assert.deepEqual(validarGrafo(pasos), [], `«${nombre}» tiene que ser un flujo válido`);
    const g = grafoDeSecuencia(pasos, { disparador: 'X' });
    const ofrecidos = g.nodos.filter((n) => n.puertos?.some((p) => p.paralelo));
    for (const n of ofrecidos) {
      const r = insertarDesdeLienzo(pasos, n.id, 'par', 'mensaje', rndDe(7));
      assert.ok(r.id, `«${nombre}»: el ＋ en paralelo de ${n.id} no insertó nada`);
      assert.deepEqual(validarGrafo(r.pasos), [], `«${nombre}»: el ＋ en paralelo de ${n.id} se ofrece y no se puede publicar`);
    }
  }
});

test('⚠️ el «Ir a» no ofrece el destino que arma un bucle con una tarjeta que reparte', () => {
  // CRON → m1 (en paralelo e1) → esperar → «Ir a» sin destino todavía.
  const pasos = [inicio('m1'), msg('m1', { siguiente: 'w1', paralelos: ['e1'] }), esp('w1', 'g1'), irA('g1'), mail('e1')];
  const ofrece = tarjetasParaIrA(pasos, 'g1');
  assert.ok(!ofrece.includes('m1'), 'ofreció m1: elegirla arma el bucle que Publicar rechaza');
  assert.ok(ofrece.includes('w1'), 'la espera (que no reparte) se puede elegir: el bucle w1 → «Ir a» → w1 es válido');
  // Cada destino que se ofrece se puede publicar sin el error del bucle.
  for (const d of ofrece) assert.deepEqual(bucle(validarGrafo(cambiarNodo(pasos, 'g1', { destino: { nodo: d } }))), [], `ofreció ${d} y arma un bucle`);
  // Y el que tiene puesto, si es válido, sigue en la lista (si no, el desplegable diría otra cosa).
  assert.ok(tarjetasParaIrA(cambiarNodo(pasos, 'g1', { destino: { nodo: 'w1' } }), 'g1').includes('w1'));
});

test('un bucle que YA estaba mal por otro lado no esconde todas las opciones del «Ir a»', () => {
  // a reparte dentro de un bucle (mal, y Publicar lo va a decir). En el hilo de x, un «Ir a» sin
  // destino: volver a x o a su espera es válido y se tiene que poder elegir.
  const pasos = [
    inicio('a', ['x']), msg('a', { siguiente: 'ea', paralelos: ['p'] }), esp('ea', 'ja'), irA('ja', 'a'), msg('p'),
    msg('x', { siguiente: 'ex' }), esp('ex', 'k'), irA('k'),
  ];
  assert.deepEqual([...repartenEnBucle(pasos)], ['a']);
  const ofrece = tarjetasParaIrA(pasos, 'k');
  assert.ok(ofrece.includes('x') && ofrece.includes('ex'), `el «Ir a» quedó sin opciones válidas: ${JSON.stringify(ofrece)}`);
});

test('desde «Si responde» el «Ir a» sigue ofreciendo la tarjeta que reparte (la respuesta no arma bucle)', () => {
  // «Si responde» no tiene padre: nada de la salida vuelve a él, así que saltar de ahí a m1 no es un ciclo.
  const pasos: PasoParaGrafo[] = [
    inicio('m1'), msg('m1', { siguiente: 'w1', paralelos: ['e1'] }), esp('w1', null), mail('e1'),
    { id: 'R', nodo: 'respuesta', canal: 'whatsapp', delay_horas: 0, cuerpo: '', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'j' }], si_no: null },
    irA('j'),
  ];
  assert.ok(tarjetasParaIrA(pasos, 'j').includes('m1'));
  assert.deepEqual(bucle(validarGrafo(cambiarNodo(pasos, 'j', { destino: { nodo: 'm1' } }))), []);
});
