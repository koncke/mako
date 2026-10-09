// =============================================================================
// El modelo del flujo, sexta tanda: varias flechas a una tarjeta, tarjetas sueltas, guardar ≠ publicar
// =============================================================================
// Pedidos de Martín (09/10/2026, «General»):
//   · punto 13: «Aún no funciona poner o sacar más de una flecha a una tarjeta... si quiero luego de
//     una condición abrir 2 flechas. Debería poderse»;
//   · puntos 5-7: arrastrar la flecha del «+» a OTRA tarjeta, borrar una flecha sin borrar la tarjeta
//     («queda "flotando"») y «crear pasos sueltos en cualquier momento y lugar del tablero»; «lo que
//     no se puede es publicar o probar una automatización incompleta».
//
// Lo que fija este archivo (lib/flujo-grafo.ts, lib/nutricion-grafo-motor.ts, lib/nutricion-hilos.ts):
//   1. una tarjeta con VARIOS PADRES publica (ya no es «cuelga de N lugares»), salvo que la alcancen
//      dos caminos que corren A LA VEZ (`cruces`); dos resultados de una condición se excluyen;
//   2. un ciclo de flechas sin espera no publica; con una espera en el medio, sí;
//   3. el tope de caminos cuenta lo que corre A LA VEZ (`contarParalelos`), no la suma de las flechas
//      de los dos resultados de cada condición (el diagnóstico de «no puedo abrir 2 flechas»);
//   4. la raíz no se mueve a una suelta (`fijarRaiz` antes de toda edición) y «volver al principio»
//      con una flecha sigue teniendo raíz;
//   5. `conectar` / `desconectar` / `crearSuelta` / `destinosConectables` / `borrarNodo` con varios padres;
//   6. guardar (`validarParaGuardar`) deja pasar lo incompleto y publicar (`validarGrafo`) no;
//   7. los ayudantes del motor miran TODOS los padres y no cuentan la flecha que vuelve.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie.
//
// Correr: npx tsx --test tests/flujo-sexta-modelo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validarGrafo, validarParaGuardar, contarParalelos, totalDeParalelos, raizSalida, padresDe, descendientes,
  cruces, conectar, desconectar, crearSuelta, destinosConectables, borrarNodo, tarjetasSueltas, fijarRaiz,
  conectarPuerto, aristasDeVuelta, claveArista, hiloDe, idDe, normalizar, ID_INICIO, TOPE_HILOS,
  type PasoGrafo, type RamaCondicion,
} from '../lib/flujo-grafo';
import { esPrimerPaso, minutosAntesDeReunion } from '../lib/nutricion-grafo-motor';
import { mensajeAnteriorDe } from '../lib/nutricion-hilos';
import { iniciar } from '../lib/simulador-grafo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ── Tarjetas ──
const ini = (siguiente: string | null, paralelos?: string[]): PasoGrafo =>
  ({ id: ID_INICIO, nodo: 'inicio', siguiente, ...(paralelos ? { paralelos } : {}) } as PasoGrafo);
const msg = (id: string, siguiente: string | null = null, paralelos?: string[]): PasoGrafo =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: `hola ${id}`, delay_horas: 0, asunto: null, template_wa: null, siguiente, ...(paralelos ? { paralelos } : {}) } as PasoGrafo);
const esp = (id: string, siguiente: string | null, minutos = 60, modo: 'tiempo' | 'antes_reunion' = 'tiempo'): PasoGrafo =>
  ({ id, nodo: 'esperar', espera: { modo, minutos }, siguiente } as PasoGrafo);
const rama = (id: string, siguiente: string | null, paralelos?: string[]): RamaCondicion =>
  ({ id, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente, ...(paralelos ? { paralelos } : {}) } as RamaCondicion);
const cond = (id: string, ramas: RamaCondicion[], si_no: string | null, paralelos_si_no?: string[]): PasoGrafo =>
  ({ id, nodo: 'condicion', ramas, si_no, ...(paralelos_si_no ? { paralelos_si_no } : {}) } as PasoGrafo);
const pid = (pasos: readonly PasoGrafo[], id: string) => pasos.find((p) => p.id === id)!;

test('⚠️ VARIOS PADRES: dos resultados de una condición que se juntan en una tarjeta publican', () => {
  // CRON → c: «Sí» → A → X · «Si no» → B → X. Hasta la quinta tanda: «la tarjeta X cuelga de 2 lugares».
  const pasos = [cond('c', [rama('r1', 'A')], 'B'), msg('A', 'X'), msg('B', 'X'), msg('X'), ini('c')];
  assert.deepEqual(validarGrafo(pasos), []);
  assert.equal(padresDe(pasos, 'X').length, 2);
  assert.ok(descendientes(pasos, 'c').has('X'));
  assert.equal(hiloDe(pasos).get('X'), 'p', 'la tarjeta de llegada es del camino principal');
  assert.deepEqual(cruces(pasos), [], 'el «Sí» y el «Si no» no corren a la vez para un lead');
});

test('⚠️ las flechas en paralelo del «Sí» y del «Si no» pueden juntarse: para un lead corre UN resultado', () => {
  // c: «Sí» → A, en paralelo P1 · «Si no» → B, en paralelo P2 · P1 → X · P2 → X. P1 y P2 son caminos
  // distintos, pero salen de resultados que se excluyen: X no le llega dos veces a nadie.
  const pasos = [cond('c', [rama('r1', 'A', ['P1'])], 'B', ['P2']), msg('A'), msg('B'), msg('P1', 'X'), msg('P2', 'X'), msg('X'), ini('c')];
  assert.deepEqual(cruces(pasos), []);
  assert.deepEqual(validarGrafo(pasos), []);
});

test('⚠️ dos caminos que corren A LA VEZ y caen en la misma tarjeta NO publican (sí se guardan)', () => {
  // CRON → a (en paralelo b) · a → X · b → X: al lead le llegaría X dos veces.
  const pasos = [msg('a', 'X', ['b']), msg('b', 'X'), msg('X'), ini('a')];
  assert.ok(validarGrafo(pasos).includes('a la tarjeta X llegan dos caminos que corren a la vez'));
  assert.deepEqual(validarParaGuardar(pasos), [], 'es un borrador a medio armar: se guarda');
});

test('⚠️ un ciclo de flechas sin espera no publica; con una espera en el medio, sí', () => {
  const sinEspera = [msg('a', 'b'), msg('b', 'a'), ini('a')];
  assert.ok(validarGrafo(sinEspera).some((e) => /vuelve atrás sin ninguna espera en el medio/.test(e)));
  assert.deepEqual(validarParaGuardar(sinEspera), []);
  const conEspera = [msg('a', 'e'), esp('e', 'a', 1440), ini('a')];
  assert.deepEqual(validarGrafo(conEspera), []);
  // La flecha que vuelve es UNA arista de vuelta, y no cuenta para subir a «lo de antes».
  assert.ok(aristasDeVuelta(conEspera).has(claveArista('e', 'sig')));
});

test('⚠️ «volver al principio» con una flecha, sin CRON en el dato: la raíz sigue siendo la primera', () => {
  assert.equal(raizSalida([msg('a', 'e'), esp('e', 'a', 60)]), 'a');
  // Con una SUELTA apuntando a la primera ya no se sabe: por eso toda edición fija la raíz antes.
  const fijada = fijarRaiz([msg('a', 'b'), msg('b')]);
  assert.deepEqual(fijada[fijada.length - 1], { id: ID_INICIO, nodo: 'inicio', siguiente: 'a' });
  assert.deepEqual(fijarRaiz(fijada), fijada, 'con CRON, igual');
});

test('⚠️ EL TOPE DE CAMINOS cuenta lo que corre a la vez: tres condiciones con una flecha en cada resultado', () => {
  // Cada condición abre una flecha en paralelo en el «Sí» y otra en el «Si no». Para un lead corre UN
  // resultado por condición: 1 + 3 caminos. La suma de antes daba 1 + 6 = 7 > 6 y la tercera no podía.
  const pasos = [
    cond('c1', [rama('r1', 'c2', ['x1'])], 'c2', ['y1']),
    cond('c2', [rama('r2', 'c3', ['x2'])], 'c3', ['y2']),
    cond('c3', [rama('r3', 'z', ['x3'])], 'z', ['y3']),
    msg('x1'), msg('y1'), msg('x2'), msg('y2'), msg('x3'), msg('y3'), msg('z'), ini('c1'),
  ];
  assert.equal(totalDeParalelos(pasos), 6);
  assert.equal(contarParalelos(pasos), 3);
  assert.ok(!validarGrafo(pasos).some((e) => /caminos a la vez/.test(e)), validarGrafo(pasos).join(' · '));
});

test('el tope de caminos SIGUE frenando lo que de verdad corre a la vez', () => {
  // a reparte en b, c y d; b en e y f; c en g: 1 + 6 caminos a la vez.
  const pasos = [msg('a', null, ['b', 'c', 'd']), msg('b', null, ['e', 'f']), msg('c', null, ['g']), msg('d'), msg('e'), msg('f'), msg('g'), ini('a')];
  assert.equal(contarParalelos(pasos), 6);
  assert.ok(1 + contarParalelos(pasos) > TOPE_HILOS);
  assert.ok(validarParaGuardar(pasos).includes(`una automatización corre como mucho ${TOPE_HILOS} caminos a la vez`), 'un tope frena hasta el borrador');
});

test('⚠️ una tarjeta SUELTA: se crea sin mover la raíz, no publica (nombrada) y el motor no la corre', () => {
  const r = crearSuelta([msg('a', 'b'), msg('b')], msg('s'));
  assert.equal(r.id, 's');
  assert.equal(raizSalida(r.pasos), 'a', 'la suelta no pasa a ser la entrada');
  assert.deepEqual(tarjetasSueltas(r.pasos), ['s']);
  assert.ok(validarGrafo(r.pasos).includes('tarjetas sueltas: s'));
  assert.deepEqual(validarParaGuardar(r.pasos), []);
  assert.deepEqual(iniciar(r.pasos).hilos.map((h) => h.cursor), ['a'], '«Probar» arranca por la raíz, no por la suelta');
  // Un id que ya existe se cambia.
  const otra = crearSuelta(r.pasos, msg('a'));
  assert.notEqual(otra.id, 'a');
});

test('⚠️ conectar una suelta a la PRIMERA tarjeta no la vuelve la entrada (con conectarPuerto pelado, sí)', () => {
  const sin = [msg('a', 'b'), msg('b'), msg('s')];
  // Sin fijar la raíz: la suelta «s» apunta a «a» → «a» queda apuntada y la raíz pasa a ser «s».
  assert.equal(raizSalida(conectarPuerto(sin, 's', 'sig', 'a')), 's');
  const r = conectar(sin, 's', 'sig', 'a');
  assert.equal(r.hecho, 'principal');
  assert.equal(raizSalida(r.pasos), 'a');
  assert.equal(padresDe(r.pasos, 'a').length, 2, 'el CRON y la suelta');
  assert.ok(validarGrafo(r.pasos).includes('tarjetas sueltas: s'), 'la suelta sigue suelta: nadie llega a ella');
});

test('⚠️ conectar: salida vacía → principal; ocupada → EN PARALELO (también de un resultado de una condición)', () => {
  const base = [msg('a', 'b'), msg('b'), msg('c'), ini('a')];
  const p1 = conectar(base, 'b', 'sig', 'c');
  assert.equal(p1.hecho, 'principal');
  assert.equal(pid(p1.pasos, 'b').siguiente, 'c');
  const p2 = conectar(base, 'a', 'sig', 'c');
  assert.equal(p2.hecho, 'paralelo');
  assert.deepEqual(pid(p2.pasos, 'a').paralelos, ['c']);
  // Desde el «Sí» ocupado de una condición: una flecha en paralelo DE ESE resultado.
  const conC = [cond('k', [rama('r1', 'A')], 'B'), msg('A'), msg('B'), msg('C'), ini('k')];
  const p3 = conectar(conC, 'k', 'r1', 'C');
  assert.equal(p3.hecho, 'paralelo');
  assert.deepEqual(pid(p3.pasos, 'k').ramas![0].paralelos, ['C']);
  const p4 = conectar(conC, 'k', 'si_no', 'C');
  assert.deepEqual(pid(p4.pasos, 'k').paralelos_si_no, ['C']);
});

test('conectar NO: a sí misma, al CRON, a «Si responde», ni pisar un caso ocupado; el tope lo dice', () => {
  const resp = { id: 'R', nodo: 'respuesta', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'm' }], si_no: null } as PasoGrafo;
  const base = [msg('a', 'b'), msg('b'), resp, msg('m'), msg('n'), ini('a')];
  assert.equal(conectar(base, 'a', 'sig', 'a').hecho, null);
  assert.equal(conectar(base, 'a', 'sig', ID_INICIO).motivo, 'Nada sigue en el CRON');
  assert.equal(conectar(base, 'a', 'sig', 'R').hecho, null);
  assert.equal(conectar(base, 'R', 'c1', 'n').motivo, 'Esa salida ya va a otra tarjeta');
  const lleno = [msg('a', 'b', ['c', 'd', 'e']), msg('b'), msg('c'), msg('d'), msg('e'), msg('f'), ini('a')];
  const r = conectar(lleno, 'a', 'sig', 'f');
  assert.equal(r.hecho, null);
  assert.match(r.motivo ?? '', /más de 3 flechas en paralelo/);
  // Lo que se ofrece al arrastrar sale de la MISMA regla.
  const d = destinosConectables(base, 'b', 'sig');
  assert.ok(d.has('m') && d.has('n') && d.has('a'));
  assert.ok(!d.has('b') && !d.has(ID_INICIO) && !d.has('R'));
});

test('⚠️ desconectar deja la tarjeta FLOTANDO (no la borra); sin flecha del CRON, «el CRON no lleva a ninguna tarjeta»', () => {
  const base = [msg('a', 'b'), msg('b'), ini('a')];
  const r = desconectar(base, 'a', 'sig');
  assert.equal(r.length, 3);
  assert.deepEqual(tarjetasSueltas(r), ['b']);
  assert.deepEqual(validarParaGuardar(r), []);
  const sinCron = desconectar(base, ID_INICIO, 'sig');
  assert.equal(validarGrafo(sinCron)[0], 'el CRON no lleva a ninguna tarjeta', 'va PRIMERO: lo demás es consecuencia');
  assert.equal(validarGrafo([ini(null)]).length, 0, 'una automatización vacía no tiene nada que correr');
  // Una flecha en paralelo, por su puerto.
  const par = desconectar([msg('a', 'b', ['c']), msg('b'), msg('c'), ini('a')], 'a', 'par:c');
  assert.equal(pid(par, 'a').paralelos, undefined);
  assert.deepEqual(tarjetasSueltas(par), ['c']);
});

test('⚠️ borrarNodo con VARIOS PADRES: todos siguen en lo que seguía', () => {
  const pasos = [cond('c', [rama('r1', 'A')], 'B'), msg('A', 'X'), msg('B', 'X'), msg('X', 'Y'), msg('Y'), ini('c')];
  const r = borrarNodo(pasos, 'X');
  assert.equal(pid(r, 'A').siguiente, 'Y');
  assert.equal(pid(r, 'B').siguiente, 'Y');
  assert.deepEqual(validarGrafo(r), []);
});

test('⚠️ borrar una condición se lleva SÓLO lo que cuelga de ella: lo que también se alcanza por otro lado se queda', () => {
  // X se alcanza por la condición (A → X) y por «Si responde» (caso → X).
  const resp = { id: 'R', nodo: 'respuesta', casos: [{ id: 'k1', titulo: 'Precio', cuando: 'precio', siguiente: 'X' }], si_no: null } as PasoGrafo;
  const pasos = [cond('c', [rama('r1', 'A')], 'B'), msg('A', 'X'), msg('B'), msg('X'), resp, ini('c')];
  const r = borrarNodo(pasos, 'c');
  const ids = r.map((p, i) => idDe(p, i));
  assert.ok(!ids.includes('A') && !ids.includes('B'), 'lo que colgaba sólo de la condición se va');
  assert.ok(ids.includes('X'), 'X sigue: «Si responde» también llega');
});

test('⚠️ GUARDAR ≠ PUBLICAR: lo incompleto se guarda; lo que rompe el dato, no', () => {
  const resp = { id: 'R', nodo: 'respuesta', casos: [{ id: 'k1', titulo: '', cuando: '', siguiente: null }], si_no: null } as PasoGrafo;
  const aMedias = [
    msg('a', 'k'),
    { id: 'k', nodo: 'condicion', ramas: [{ id: 'kr', modo: 'todas', filas: [], siguiente: null }], si_no: null } as PasoGrafo,
    { id: 'e', nodo: 'esperar', siguiente: null } as PasoGrafo,
    resp, msg('s'), ini('a'),
  ];
  assert.deepEqual(validarParaGuardar(aMedias), []);
  const pub = validarGrafo(aMedias);
  for (const e of ['una rama de la condición k no tiene ninguna condición', 'la espera e no dice cuánto', 'un caso de «Si responde» no tiene nombre o descripción']) {
    assert.ok(pub.includes(e), `falta «${e}» en ${pub.join(' · ')}`);
  }
  assert.ok(pub.some((e) => e.startsWith('tarjetas sueltas: ')));
  // Lo que rompe el dato: una flecha a una tarjeta que no existe (frena las dos).
  const roto = [msg('a', 'zz'), ini('a')];
  assert.ok(validarParaGuardar(roto).includes('la tarjeta a sigue en zz, que no existe'));
  assert.ok(validarGrafo(roto).includes('la tarjeta a sigue en zz, que no existe'));
  // Y una flecha AL CRON es imposible (no se arregla terminando de armar).
  assert.ok(validarParaGuardar([msg('a', ID_INICIO), ini('a')]).includes('ninguna tarjeta puede seguir en el CRON'));
});

test('«Su respuesta trata de» en una condición de la SALIDA no se guarda (no se evaluaría nunca)', () => {
  const pasos = [{ id: 'k', nodo: 'condicion', ramas: [{ id: 'kr', modo: 'todas', filas: [{ campo: 'respuesta_trata_de', valor: 'precio' }], siguiente: null }], si_no: null } as PasoGrafo, ini('k')];
  assert.ok(validarParaGuardar(pasos).some((e) => /va en la condición que escucha las respuestas, no en la condición k/.test(e)));
});

test('⚠️ el MOTOR con varios padres: es el primer paso sólo si por NINGÚN camino hay un mensaje antes', () => {
  // c → A (mensaje) → X · c «Si no» → X. X tiene un mensaje antes por un camino: no es la bienvenida.
  const pasos = normalizar([cond('c', [rama('r1', 'A')], 'X'), msg('A', 'X'), msg('X'), ini('c')]);
  const i = (id: string) => pasos.findIndex((p) => p.id === id);
  assert.equal(esPrimerPaso(pasos, i('X')), false);
  assert.equal(esPrimerPaso(pasos, i('A')), true);
  // La flecha de «volver al principio» no es «lo de antes».
  const bucle = normalizar([msg('a', 'e'), esp('e', 'a', 1440), ini('a')]);
  assert.equal(esPrimerPaso(bucle, 0), true);
});

test('⚠️ el MOTOR con varios padres: un recordatorio por CUALQUIER camino que cuelgue de «antes de la reunión»', () => {
  const pasos = normalizar([
    // La de «tiempo» va PRIMERO en el array: mirando un solo padre (el primero), no sería un recordatorio.
    cond('c', [rama('r1', 'e1')], 'e2'), esp('e2', 'X', 60, 'tiempo'), esp('e1', 'X', 1440, 'antes_reunion'), msg('X'), ini('c'),
  ]);
  const x = pasos.findIndex((p) => p.id === 'X');
  assert.equal(minutosAntesDeReunion(pasos, x), 1440);
  const soloTiempo = normalizar([esp('e2', 'X', 60, 'tiempo'), msg('X'), ini('e2')]);
  assert.equal(minutosAntesDeReunion(soloTiempo, 1), null);
});

test('el borrador que espera una acción: el mensaje de antes por el primer camino, sin la flecha que vuelve', () => {
  const pasos = normalizar([msg('m1', 'k'), cond('k', [rama('r1', 'acc')], 'acc'), { id: 'acc', accion: { operacion: 'avisar_al_equipo', params: {} }, siguiente: null } as unknown as PasoGrafo, ini('m1')]);
  assert.equal(mensajeAnteriorDe(pasos, pasos.findIndex((p) => p.id === 'acc')), 0);
  const bucle = normalizar([msg('a', 'e'), esp('e', 'a', 60), ini('a')]);
  assert.equal(mensajeAnteriorDe(bucle, 0), -1, 'la espera que vuelve a «a» no es lo de antes de «a»');
  assert.equal(mensajeAnteriorDe(bucle, 1), 0);
});

test('⚠️ PUBLICAR valida con validarGrafo (lo único que lee el motor): una suelta nunca corre', () => {
  const src = leer('lib/nutricion.ts');
  const ini = src.indexOf('export async function setSecuenciaPasos(');
  assert.ok(ini > 0, 'no encontré setSecuenciaPasos');
  const bloque = src.slice(ini, src.indexOf('\nexport ', ini + 10));
  assert.match(bloque, /validarGrafo\(/, 'setSecuenciaPasos tiene que validar con validarGrafo');
  assert.doesNotMatch(bloque, /validarParaGuardar\(/, 'Publicar no puede validar como un borrador');
  // Y ninguna lectura del motor mira el borrador.
  for (const f of ['lib/nutricion.ts', 'lib/nutricion-grafo-motor.ts', 'lib/nutricion-hilos.ts']) {
    assert.doesNotMatch(leer(f), /pasos_borrador/, `${f} no puede leer el borrador`);
  }
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (arnés en el scratchpad, tolera CRLF). Base: 20 / 0. Pasan / fallan:
//   M1. `contarParalelos` vuelve a SUMAR los dos resultados de cada condición          → 19 / 1
//   M2. `cruces` sin contexto (todo lo que llega por dos caminos choca)                 → 19 / 1
//   M3. `raizSalida` sin la regla de «volver al principio»                              → 19 / 1
//   M4. `conectar` sin `fijarRaiz`                                                      → 19 / 1
//   M5. `conectar` pisa la salida ocupada en vez de abrir una en paralelo               → 18 / 2
//   M6. `borrarNodo` reconecta sólo el PRIMER padre                                     → 19 / 1
//   M7. borrar una condición se lleva `descendientes` en vez de `soloDe`                → 19 / 1
//   M8. `validarParaGuardar` valida como Publicar                                       → 14 / 6
//   M9. `esPrimerPaso` mira sólo el primer padre                                        → 19 / 1
//   M10. `minutosAntesDeReunion` mira sólo el primer padre                              → 19 / 1
//   M11. `ciclosSinEspera` sin las flechas (sólo los «Ir a» de antes)                   → 19 / 1
//   M12. sin la guarda de «Su respuesta trata de» en una condición de la salida          → 19 / 1
//   M13. `mensajeAnteriorDe` cuenta la flecha que vuelve                                → 19 / 1
