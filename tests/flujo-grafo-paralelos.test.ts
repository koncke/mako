// =============================================================================
// SEGUNDA TANDA del flujo con ramas (lib/flujo-grafo.ts): UN SOLO CRON y FLECHAS EN PARALELO
// =============================================================================
// Pedido de Martín (08/10/2026, noche), puntos 1 y 2: «No pueden haber 2 flujos por separado.
// Solo 1 CRON y de ahí desprende todo» y «Del CRON inicial debería poder sacar varias
// flechas... de un mismo cron puedo sacar todo una secuencia para WhatsApp y toda otra
// secuencia de email». El contrato, en docs/chatbot-flujo-ramas-diseno.md → «El contrato del
// modelo».
//
// ⚠️ PROBADOS ROMPIENDO LA PIEZA, 08/10/2026: 35 roturas sobre lib/flujo-grafo.ts,
// lib/nutricion-grafo-motor.ts y lib/flujo-legado.ts, una por vez, corriendo este archivo y
// tests/flujo-grafo.test.ts (54 tests): las 35 cazadas. La primera pasada dejó DOS en verde
// (esLineal y esFlujoExplicito, ver su test). Cada rotura, con sus fallos, al lado del test que la
// caza. El arnés restaura de memoria, nunca con git.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type PasoGrafo,
  ID_INICIO, TOPE_PARALELOS, TOPE_HILOS, puertosDe, padreDe, descendientes, raizSalida, raicesSalida, hiloDe,
  siguienteDe, normalizar, validarGrafo, insertarNodo, borrarNodo, conectarPuerto, nodoPorId, puedeTenerParalelos,
  antiguedadDeEntrada,
} from '../lib/flujo-grafo';
import { esFlujoExplicito, tieneLegado, puedePisarFlujo } from '../lib/flujo-legado';
import { camposDelFlujo, esLineal } from '../lib/nutricion-grafo-motor';

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const esp = (o: Partial<PasoGrafo> = {}): PasoGrafo => msg({ nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, cuerpo: '', ...o });
const cond = (o: Partial<PasoGrafo> = {}): PasoGrafo => msg({ nodo: 'condicion', cuerpo: '', ramas: [{ id: `${o.id}r0`, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], si_no: null, ...o });
const irA = (id: string, nodo: string): PasoGrafo => msg({ id, nodo: 'ir_a', cuerpo: '', destino: { nodo } });
const resp = (o: Partial<PasoGrafo> = {}): PasoGrafo => msg({ nodo: 'respuesta', cuerpo: '', casos: [], si_no: null, ...o });
const ini = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente: null, ...o });
const ids = (pasos: readonly PasoGrafo[]) => pasos.map((p) => p.id);
const con = (errs: string[], trozo: string) => errs.some((e) => e.includes(trozo));

// ── Los puertos `par:` ────────────────────────────────────────────────────────────

// Rotura «puertosDe sin los par:» → 10 fallos de 54 (éste, hilos, insertar y borrar por la
// flecha, y cuatro reglas de validar).
test('una flecha en paralelo es un PUERTO más: padre, descendientes y raíz la ven sin saber que existe', () => {
  const pasos = normalizar([msg({ id: 'a', siguiente: 'b', paralelos: ['c'] }), msg({ id: 'b', siguiente: null }), msg({ id: 'c', siguiente: null })]);
  assert.deepEqual(puertosDe(pasos, 0), [{ puerto: 'sig', destino: 'b' }, { puerto: 'par:c', destino: 'c' }]);
  assert.deepEqual(padreDe(pasos, 'c'), { id: 'a', puerto: 'par:c' });
  assert.deepEqual([...descendientes(pasos, 'a')].sort(), ['b', 'c']);
  assert.equal(raizSalida(pasos), 'a');
  assert.deepEqual(validarGrafo(pasos), []);
  // Una condición no los tiene: sus ramas se excluyen entre sí.
  assert.equal(puedeTenerParalelos(cond({ id: 'k' })), false);
  assert.deepEqual(puertosDe([cond({ id: 'k', paralelos: ['b'] })], 0).map((p) => p.puerto), ['kr0', 'si_no']);
  assert.equal(puedeTenerParalelos(esp()), true);
  assert.equal(puedeTenerParalelos(ini()), true);
});

// ── El inicio y las raíces ─────────────────────────────────────────────────────────

// Rotura «raizSalida devuelve el inicio» → 4 fallos (éste, crear el inicio, «al principio» con
// inicio y la antigüedad).
// Rotura «siguienteDe del inicio cae al de abajo del array» → 1 fallo (éste).
test('con inicio, raizSalida es la PRIMERA TARJETA REAL y raicesSalida suma las flechas del CRON', () => {
  const pasos = [msg({ id: 'a', siguiente: null }), msg({ id: 'w', siguiente: null }), ini({ siguiente: 'a', paralelos: ['w'] })];
  assert.equal(raizSalida(pasos), 'a');
  assert.deepEqual(raicesSalida(pasos), ['a', 'w']);
  assert.deepEqual(validarGrafo(pasos), []);
  // El inicio NUNCA sigue «en el de abajo del array»: su salida es la explícita o ninguna.
  assert.equal(siguienteDe([ini({ siguiente: undefined }), msg({ id: 'x' })], 0), null);
  // Sin inicio, la regla de siempre.
  assert.deepEqual(raicesSalida([msg(), msg()]), ['o0']);
  assert.deepEqual(raicesSalida([]), []);
  // Un inicio sin principal y con paralelos: la principal queda vacía hasta normalizar.
  const sinPrincipal = [msg({ id: 'w', siguiente: null }), ini({ siguiente: null, paralelos: ['w'] })];
  assert.equal(raizSalida(sinPrincipal), null);
  assert.deepEqual(raicesSalida(sinPrincipal), ['w']);
});

// Rotura «hiloDe no abre hilo en un par:» → 3 fallos (éste, el ＋ del medio y el «Ir a» a otro camino).
// Rotura «hiloDe sin "Si responde"» → 3 fallos (éste, el «Ir a» a la respuesta y los vigentes de
// tests/flujo-grafo.test.ts).
test('hiloDe: el principal es «p», cada flecha en paralelo abre el hilo de su primera tarjeta, «Si responde» es «r»', () => {
  const pasos = normalizar([
    msg({ id: 'a', siguiente: 'b' }),
    msg({ id: 'b', siguiente: null, paralelos: ['y'] }),
    msg({ id: 'y', siguiente: null }),
    msg({ id: 'w', siguiente: 'x' }),
    msg({ id: 'x', siguiente: null }),
    resp({ id: 'R', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'm' }] }),
    msg({ id: 'm', siguiente: null }),
    msg({ id: 'suelta', siguiente: null }),
    ini({ siguiente: 'a', paralelos: ['w'] }),
  ]);
  const h = hiloDe(pasos);
  assert.deepEqual(Object.fromEntries(h), { entrada: 'p', a: 'p', b: 'p', y: 'y', w: 'w', x: 'w', R: 'r', m: 'r' });
  assert.equal(h.has('suelta'), false);
});

// ── Insertar ───────────────────────────────────────────────────────────────────────

// Rotura «el inicio se crea al PRINCIPIO del array» → 1 fallo (éste).
// Rotura «la tarjeta nueva hereda lo que colgaba (siguiente = la principal)» → 2 fallos (éste y «desde una tarjeta»).
test('la primera flecha en paralelo desde el CRON CREA el inicio al FINAL, con la salida de hoy como principal', () => {
  const base = normalizar([msg({ id: 'a', siguiente: 'b' }), msg({ id: 'b', siguiente: null })]);
  const out = insertarNodo(base, { nodo: ID_INICIO, puerto: 'par' }, msg({ id: 'n1' }));
  assert.deepEqual(ids(out), ['a', 'b', 'n1', ID_INICIO]);
  const inicio = nodoPorId(out, ID_INICIO)!;
  assert.equal(inicio.nodo, 'inicio');
  assert.equal(inicio.siguiente, 'a');
  assert.deepEqual(inicio.paralelos, ['n1']);
  assert.equal(nodoPorId(out, 'n1')!.siguiente, null);
  assert.deepEqual(raicesSalida(out), ['a', 'n1']);
  assert.deepEqual(validarGrafo(out), []);
  // La segunda ya no crea otro: se suma a las del inicio.
  const dos = insertarNodo(out, { nodo: ID_INICIO, puerto: 'par' }, msg({ id: 'n2' }));
  assert.equal(dos.filter((p) => p.nodo === 'inicio').length, 1);
  assert.deepEqual(nodoPorId(dos, ID_INICIO)!.paralelos, ['n1', 'n2']);
  assert.deepEqual(validarGrafo(dos), []);
});

// Rotura «sin salida principal igual se crea el inicio» → 1 fallo (éste).
test('desde el CRON SIN salida principal, la tarjeta nueva PASA a ser la principal y no se crea ningún inicio', () => {
  const vacio = insertarNodo([], { nodo: ID_INICIO, puerto: 'par' }, msg({ id: 'n1' }));
  assert.deepEqual(ids(vacio), ['n1']);
  assert.equal(raizSalida(vacio), 'n1');
  // Sólo «Si responde» (y su aviso): la salida está vacía.
  const soloResp = normalizar([resp({ id: 'R', si_no: 'av' }), msg({ id: 'av', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: {} } })]);
  const out = insertarNodo(soloResp, { nodo: ID_INICIO, puerto: 'par' }, msg({ id: 'n1' }));
  assert.equal(out.some((p) => p.nodo === 'inicio'), false);
  assert.equal(raizSalida(out), 'n1');
  assert.deepEqual(validarGrafo(out), []);
});

// Rotura «{ inicio: true } con inicio antepone en el array (lo de siempre)» → 1 fallo (éste).
test('con inicio, «al principio de la salida» inserta en SU salida principal', () => {
  const conIni = normalizar([msg({ id: 'a', siguiente: null }), msg({ id: 'w', siguiente: null }), ini({ siguiente: 'a', paralelos: ['w'] })]);
  const out = insertarNodo(conIni, { inicio: true }, msg({ id: 'n3' }));
  assert.equal(nodoPorId(out, ID_INICIO)!.siguiente, 'n3');
  assert.equal(nodoPorId(out, 'n3')!.siguiente, 'a');
  assert.equal(raizSalida(out), 'n3');
  assert.deepEqual(validarGrafo(out), []);
});

// Rotura «'par' sobre una condición se acepta» → 1 fallo (éste).
test('una flecha en paralelo desde una tarjeta: la nueva nace sin nada después; desde una condición no se puede', () => {
  const base = normalizar([msg({ id: 'a', siguiente: 'b' }), msg({ id: 'b', siguiente: null })]);
  const out = insertarNodo(base, { nodo: 'a', puerto: 'par' }, msg({ id: 'n1' }));
  assert.deepEqual(ids(out), ['a', 'n1', 'b']);
  assert.deepEqual(nodoPorId(out, 'a')!.paralelos, ['n1']);
  assert.equal(nodoPorId(out, 'a')!.siguiente, 'b');
  assert.equal(nodoPorId(out, 'n1')!.siguiente, null);
  assert.deepEqual(validarGrafo(out), []);
  const conCond = normalizar([cond({ id: 'k' })]);
  assert.deepEqual(insertarNodo(conCond, { nodo: 'k', puerto: 'par' }, msg({ id: 'n1' })), conCond);
});

// Rotura «conectarPuerto ignora par:<id>» → 3 fallos (éste, borrar por la flecha y la promoción
// del inicio al borrar su principal).
test('el ＋ del MEDIO de una flecha en paralelo: la tarjeta nueva queda en el medio y apunta a la de antes', () => {
  const base = normalizar([msg({ id: 'a', siguiente: null, paralelos: ['w'] }), msg({ id: 'w', siguiente: null })]);
  const out = insertarNodo(base, { nodo: 'a', puerto: 'par:w' }, msg({ id: 'n' }));
  assert.deepEqual(nodoPorId(out, 'a')!.paralelos, ['n']);
  assert.equal(nodoPorId(out, 'n')!.siguiente, 'w');
  assert.deepEqual(validarGrafo(out), []);
  // El hilo pasa a llamarse como su PRIMERA tarjeta.
  assert.equal(hiloDe(out).get('w'), 'n');
  // conectarPuerto: 'par:<id>' con null la saca (y el campo se va), 'par' agrega sin repetir.
  const sin = conectarPuerto(base, 'a', 'par:w', null);
  assert.equal('paralelos' in nodoPorId(sin, 'a')!, false);
  assert.deepEqual(nodoPorId(conectarPuerto(base, 'a', 'par', 'w'), 'a')!.paralelos, ['w']);
  assert.deepEqual(nodoPorId(conectarPuerto(base, 'a', 'par', 'z'), 'a')!.paralelos, ['w', 'z']);
});

// ── Borrar ─────────────────────────────────────────────────────────────────────────

test('borrar una tarjeta que colgaba de una flecha en paralelo: el padre se reconecta POR ESA flecha', () => {
  const base = normalizar([msg({ id: 'a', siguiente: null, paralelos: ['w'] }), msg({ id: 'w', siguiente: 'x' }), msg({ id: 'x', siguiente: null })]);
  const out = borrarNodo(base, 'w');
  assert.deepEqual(nodoPorId(out, 'a')!.paralelos, ['x']);
  assert.deepEqual(validarGrafo(out), []);
  // La última de su flecha: la flecha se va con ella.
  const sola = borrarNodo(normalizar([msg({ id: 'a', siguiente: null, paralelos: ['w'] }), msg({ id: 'w', siguiente: null })]), 'w');
  assert.equal('paralelos' in nodoPorId(sola, 'a')!, false);
});

// Rotura «los paralelos de la borrada no se heredan» → 1 fallo (éste).
// Rotura «sin siguiente no se promueve el primer paralelo» → 1 fallo (éste).
test('borrar una tarjeta CON flechas en paralelo: pasan a la que la reemplaza (sin siguiente, el primer paralelo la reemplaza)', () => {
  const conSig = normalizar([msg({ id: 'a', siguiente: 'b', paralelos: ['w'] }), msg({ id: 'b', siguiente: null }), msg({ id: 'w', siguiente: null })]);
  const out = borrarNodo(conSig, 'a');
  assert.deepEqual(nodoPorId(out, 'b')!.paralelos, ['w']);
  assert.equal(raizSalida(out), 'b');
  assert.deepEqual(validarGrafo(out), []);
  const sinSig = normalizar([msg({ id: 'a', siguiente: null, paralelos: ['w', 'y'] }), msg({ id: 'w', siguiente: null }), msg({ id: 'y', siguiente: null })]);
  const out2 = borrarNodo(sinSig, 'a');
  assert.equal(raizSalida(out2), 'w');
  assert.deepEqual(nodoPorId(out2, 'w')!.paralelos, ['y']);
  assert.deepEqual(validarGrafo(out2), []);
});

// Rotura «si el reemplazo no puede tenerlas, igual se le pegan» → 1 fallo (éste).
test('si la que la reemplaza NO puede tener flechas en paralelo (una condición), se van con su subárbol', () => {
  const base = normalizar([msg({ id: 'a', siguiente: 'k', paralelos: ['w'] }), cond({ id: 'k' }), msg({ id: 'w', siguiente: 'x' }), msg({ id: 'x', siguiente: null })]);
  const out = borrarNodo(base, 'a');
  assert.deepEqual(ids(out), ['k']);
  assert.deepEqual(validarGrafo(out), []);
});

// Rotura «el inicio se puede borrar» → 1 fallo (éste).
// Rotura «borrar la principal del inicio no promueve» → 1 fallo (éste).
test('el inicio no se borra; si se borra su principal, la primera flecha en paralelo PASA a ser la principal', () => {
  const base = normalizar([msg({ id: 'a', siguiente: null }), msg({ id: 'w', siguiente: null }), ini({ siguiente: 'a', paralelos: ['w'] })]);
  assert.deepEqual(borrarNodo(base, ID_INICIO), base);
  const out = borrarNodo(base, 'a');
  const inicio = nodoPorId(out, ID_INICIO)!;
  assert.equal(inicio.siguiente, 'w');
  assert.equal('paralelos' in inicio, false);
  assert.deepEqual(validarGrafo(out), []);
  // Una principal con algo después: el inicio sigue en eso.
  const conB = normalizar([msg({ id: 'a', siguiente: 'b' }), msg({ id: 'b', siguiente: null }), ini({ siguiente: 'a' })]);
  assert.equal(nodoPorId(borrarNodo(conB, 'a'), ID_INICIO)!.siguiente, 'b');
});

// ── validarGrafo: las reglas nuevas (una que pasa y una que falla cada una) ───────────

// Rotura «sin la regla de clases» → 1 fallo (éste).
test('validar: flechas en paralelo en una clase que no las admite', () => {
  const mal = [cond({ id: 'k', paralelos: ['w'], ramas: [{ id: 'kr0', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'b' }] }), msg({ id: 'b', siguiente: null }), msg({ id: 'w', siguiente: null })];
  assert.ok(con(validarGrafo(mal), 'no puede sacar flechas en paralelo'));
  const bien = [msg({ id: 'a', siguiente: 'b', paralelos: ['w'] }), msg({ id: 'b', siguiente: null }), msg({ id: 'w', siguiente: null })];
  assert.deepEqual(validarGrafo(bien), []);
});

// Rotura «sin la regla de "Si responde"» → 1 fallo (éste).
test('validar: «Si responde» no saca flechas en paralelo', () => {
  const caso = (m: PasoGrafo) => [msg({ id: 'a', siguiente: null }), resp({ id: 'R', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'm' }] }), m, msg({ id: 'z', siguiente: null })];
  assert.ok(con(validarGrafo(caso(msg({ id: 'm', siguiente: null, paralelos: ['z'] }))), '«Si responde» no puede sacar flechas en paralelo'));
  assert.deepEqual(validarGrafo(caso(msg({ id: 'm', siguiente: 'z' }))), []);
});

// Rotura «sin la regla de "Si responde" sin padre» → 1 fallo (éste).
test('validar: «Si responde» no tiene padre (cuelga del CRON)', () => {
  const mal = [msg({ id: 'a', siguiente: 'R' }), resp({ id: 'R' })];
  assert.ok(con(validarGrafo(mal), '«Si responde» cuelga del CRON'));
  assert.deepEqual(validarGrafo([msg({ id: 'a', siguiente: null }), resp({ id: 'R' })]), []);
});

// Rotura «el tope de flechas corrido en 1» → 1 fallo (éste). Rotura «sin el tope de hilos» → 1 fallo (éste).
test('validar: topes de flechas por tarjeta y de caminos a la vez', () => {
  const hijos = (n: number, pre: string) => Array.from({ length: n }, (_, k) => msg({ id: `${pre}${k}`, siguiente: null }));
  const porTarjeta = (n: number) => [msg({ id: 'a', siguiente: null, paralelos: hijos(n, 'w').map((p) => p.id!) }), ...hijos(n, 'w')];
  assert.deepEqual(validarGrafo(porTarjeta(TOPE_PARALELOS)), []);
  assert.ok(con(validarGrafo(porTarjeta(TOPE_PARALELOS + 1)), `más de ${TOPE_PARALELOS} flechas`));
  // 1 + 3 + 2 = 6 caminos: entra. 1 + 3 + 3 = 7: no.
  const total = (n: number) => [
    msg({ id: 'a', siguiente: null, paralelos: hijos(n, 'x').map((p) => p.id!) }), ...hijos(n, 'x'),
    ...hijos(3, 'w'), ini({ siguiente: 'a', paralelos: hijos(3, 'w').map((p) => p.id!) }),
  ];
  assert.equal(TOPE_HILOS, 6);
  assert.deepEqual(validarGrafo(total(2)), []);
  assert.ok(con(validarGrafo(total(3)), `como mucho ${TOPE_HILOS} caminos`));
});

// Rotura «sin la regla del bucle» → 1 fallo (éste).
test('validar: una tarjeta con flechas en paralelo dentro de un bucle de «Ir a» (abriría un camino por vuelta)', () => {
  const mal = [msg({ id: 'a', siguiente: 'e', paralelos: ['w'] }), esp({ id: 'e', siguiente: 'j' }), irA('j', 'a'), msg({ id: 'w', siguiente: null })];
  assert.ok(con(validarGrafo(mal), 'dentro de un bucle'));
  // El bucle vive ADENTRO del hilo paralelo y no pasa por la tarjeta que reparte: se puede.
  const bien = [msg({ id: 'a', siguiente: null, paralelos: ['w'] }), msg({ id: 'w', siguiente: 'e' }), esp({ id: 'e', siguiente: 'j' }), irA('j', 'w')];
  assert.deepEqual(validarGrafo(bien), []);
});

// Rotura «sin la regla de saltar entre hilos» → 1 fallo (éste).
// Rotura «la regla también frena desde "Si responde"» → 1 fallo (éste).
test('validar: un «Ir a» de la salida no salta a OTRO camino; desde «Si responde» sí a cualquiera', () => {
  const salida = [msg({ id: 'a', siguiente: 'b', paralelos: ['w'] }), msg({ id: 'b', siguiente: 'j' }), irA('j', 'w'), msg({ id: 'w', siguiente: null })];
  assert.ok(con(validarGrafo(salida), 'otro camino'));
  const desdeResp = [
    msg({ id: 'a', siguiente: 'b', paralelos: ['w'] }), msg({ id: 'b', siguiente: null }), msg({ id: 'w', siguiente: null }),
    resp({ id: 'R', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'j' }] }), irA('j', 'w'),
  ];
  assert.deepEqual(validarGrafo(desdeResp), []);
  // De la salida a una tarjeta de «Si responde» también es otro camino.
  const aResp = [msg({ id: 'a', siguiente: 'j' }), irA('j', 'm'), resp({ id: 'R', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'm' }] }), msg({ id: 'm', siguiente: null })];
  assert.ok(con(validarGrafo(aResp), 'otro camino'));
});

// Rotura «sin la regla de más de un inicio» → 1 fallo (éste).
test('validar: un solo inicio, llamado «entrada»; nadie sigue en él ni salta a él; «entrada» no es de otra tarjeta', () => {
  const a = msg({ id: 'a', siguiente: null });
  assert.ok(con(validarGrafo([a, ini({ siguiente: 'a' }), ini({ id: 'otro', siguiente: null })]), 'más de un inicio'));
  assert.ok(con(validarGrafo([a, ini({ id: 'cron', siguiente: 'a' })]), 'tiene que llamarse'));
  assert.ok(con(validarGrafo([msg({ id: ID_INICIO, siguiente: null })]), 'es del CRON'));
  assert.ok(con(validarGrafo([msg({ id: 'a', siguiente: 'j' }), esp({ id: 'j', siguiente: null }), msg({ id: 'b', siguiente: ID_INICIO }), ini({ siguiente: 'a' })]), 'seguir en el CRON'));
  assert.ok(con(validarGrafo([msg({ id: 'a', siguiente: 'e' }), esp({ id: 'e', siguiente: 'j' }), irA('j', ID_INICIO), ini({ siguiente: 'a' })]), 'no puede volver al CRON'));
  assert.deepEqual(validarGrafo([a, ini({ siguiente: 'a' })]), []);
});

// Rotura «las sueltas miden sólo desde raizSalida» → 8 fallos (todo flujo con inicio queda con
// tarjetas sueltas).
test('validar: las sueltas se miden desde CADA camino de la salida y «Si responde»; el inicio es alcanzable', () => {
  const pasos = [msg({ id: 'a', siguiente: null }), msg({ id: 'w', siguiente: 'x' }), msg({ id: 'x', siguiente: null }), ini({ siguiente: 'a', paralelos: ['w'] })];
  assert.deepEqual(validarGrafo(pasos), []);
  assert.ok(con(validarGrafo([...pasos, msg({ id: 'z', siguiente: null })]), 'tarjetas sueltas: z'));
});

test('validar: una flecha repetida, y una flecha a una tarjeta con un id de hilo reservado', () => {
  assert.ok(con(validarGrafo([msg({ id: 'a', siguiente: null, paralelos: ['w', 'w'] }), msg({ id: 'w', siguiente: null })]), 'repite'));
  assert.ok(con(validarGrafo([msg({ id: 'a', siguiente: null, paralelos: ['p'] }), msg({ id: 'p', siguiente: null })]), 'id reservado'));
});

// ── normalizar ─────────────────────────────────────────────────────────────────────

// Rotura «normalizar no conserva paralelos» → 11 fallos (éste y los que normalizan antes de mirar).
// Rotura «normalizar deja paralelos: [] en todo paso» → 2 fallos (éste y los vigentes de
// tests/flujo-grafo.test.ts).
test('normalizar conserva las flechas en paralelo donde se admiten y limpia lo demás', () => {
  const out = normalizar([
    msg({ id: 'a', siguiente: 'b', paralelos: ['w', 'w', '', 'a', 'b', 'y'] }),
    msg({ id: 'b', siguiente: null }),
    cond({ id: 'k', paralelos: ['w'] }),
    esp({ id: 'e', siguiente: null, paralelos: ['y'] }),
    msg({ id: 'w', siguiente: null }), msg({ id: 'y', siguiente: null }),
  ]);
  // Sin repetidos, sin vacíos, sin sí misma y sin repetir la principal.
  assert.deepEqual(nodoPorId(out, 'a')!.paralelos, ['w', 'y']);
  assert.equal('paralelos' in nodoPorId(out, 'k')!, false);
  assert.deepEqual(nodoPorId(out, 'e')!.paralelos, ['y']);
  assert.deepEqual(normalizar(out), out);
  // Un flujo que nunca tuvo paralelos queda IGUAL: ni siquiera un `paralelos: []`.
  const viejo = normalizar([msg(), msg()]);
  assert.equal(viejo.some((p) => 'paralelos' in p), false);
});

// Rotura «normalizar no promueve» → 1 fallo (éste).
test('normalizar: el inicio va explícito, sin id toma «entrada», y sin principal promueve su primera flecha', () => {
  const out = normalizar([msg({ id: 'w', siguiente: null }), msg({ id: 'y', siguiente: null }), { nodo: 'inicio', paralelos: ['w', 'y'] } as PasoGrafo]);
  const inicio = out[2];
  assert.equal(inicio.id, ID_INICIO);
  assert.equal(inicio.siguiente, 'w');
  assert.deepEqual(inicio.paralelos, ['y']);
  assert.deepEqual(validarGrafo(out), []);
  // Sin `siguiente` ni paralelos: null explícito, nunca «el de abajo».
  assert.equal(normalizar([ini({ siguiente: undefined }), msg({ id: 'x' })])[0].siguiente, null);
});

// ── Lo que guarda setSecuenciaPasos (la quinta puerta) ───────────────────────────────

// Rotura «camposDelFlujo sin paralelos» → 1 fallo (éste). Rotura «NODOS sin 'inicio'» → 1 fallo (éste).
test('camposDelFlujo conserva las flechas en paralelo y el inicio (si no, el primer guardado los borra)', () => {
  assert.deepEqual(camposDelFlujo({ id: 'a', siguiente: 'b', paralelos: ['w', 'w', '', 'mal id!', 3, 'y'] }), { id: 'a', siguiente: 'b', paralelos: ['w', 'y'] });
  assert.deepEqual(camposDelFlujo({ id: ID_INICIO, nodo: 'inicio', siguiente: 'a', paralelos: ['w'] }), { id: ID_INICIO, nodo: 'inicio', siguiente: 'a', paralelos: ['w'] });
  assert.deepEqual(camposDelFlujo({ id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null, paralelos: ['w'] }).paralelos, ['w']);
  // En una condición no significan nada: no viajan.
  assert.equal('paralelos' in camposDelFlujo({ id: 'k', nodo: 'condicion', ramas: [], paralelos: ['w'] }), false);
  // Vacío = sin el campo.
  assert.equal('paralelos' in camposDelFlujo({ id: 'a', paralelos: [] }), false);
});

// Las dos fixtures son LINEALES en todo lo demás (cada `siguiente` es el de abajo del array): si
// no, `esLineal` y `esFlujoExplicito` contestan bien por otra razón. Así estaban en la primera
// versión, y las dos roturas de abajo pasaban en VERDE (0 fallos de 54).
// Rotura «esLineal ignora el inicio y los paralelos» → 1 fallo (éste).
// Rotura «esFlujoExplicito ignora el inicio y los paralelos» → 1 fallo (éste).
test('con inicio o flechas en paralelo ya no es una lista: ni «por orden» ni re-conversión ni pisarlo con una lista sin ids', () => {
  const lineal = normalizar([msg({ id: 'a' }), msg({ id: 'b' })]);
  assert.equal(esLineal(lineal), true);
  assert.equal(esFlujoExplicito(lineal), false);
  // Sin normalizar a propósito: lo ÚNICO que no es una lista es la flecha en paralelo / el inicio.
  const conPar = [msg({ id: 'a', paralelos: ['c'] }), msg({ id: 'b' }), msg({ id: 'c' })];
  const conIni = [msg({ id: 'a' }), msg({ id: 'b' }), ini({ siguiente: undefined })];
  for (const f of [conPar, conIni]) {
    assert.equal(esLineal(f), false);
    assert.equal(esFlujoExplicito(f), true);
    assert.equal(tieneLegado(f, { modo: 'asistido', escenarios: [] }), false);
    assert.equal(puedePisarFlujo(f, [msg(), msg()]), false);
  }
});

// Rotura «antiguedadDeEntrada ignora las raíces paralelas» → 1 fallo (éste).
test('la antigüedad de entrada: con el inicio sin flechas sigue valiendo; con un segundo camino desde el CRON, no', () => {
  const reciente = cond({ id: 'k', ramas: [{ id: 'kr0', modo: 'todas', filas: [{ campo: 'antiguedad', valor: 72 }], siguiente: 'a' }], si_no: null });
  const base = normalizar([reciente, msg({ id: 'a', siguiente: null })]);
  assert.equal(antiguedadDeEntrada(base), 72);
  const conIni = normalizar([...base, ini({ siguiente: 'k' })]);
  assert.equal(antiguedadDeEntrada(conIni), 72);
  const dosCaminos = insertarNodo(base, { nodo: ID_INICIO, puerto: 'par' }, msg({ id: 'email' }));
  assert.deepEqual(raicesSalida(dosCaminos), ['k', 'email']);
  assert.equal(antiguedadDeEntrada(dosCaminos), null);
});
