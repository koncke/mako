// =============================================================================
// Las ediciones del lienzo con el mouse (sexta tanda): conectar, desconectar, sueltas, duplicar
// =============================================================================
// Pedido literal de Martín (09/10/2026, sexta tanda):
//   5. «si apreto y mantengo el click en el "+" debería poder arrastrar esa flecha a otra tarjeta»
//   6. «Al lado del "+" en cada tarjeta, pon el icono de basura, así se puede eliminar esa flecha.»
//   7. «Que se elimine una flecha no significa que se elimine la tarjeta posterior, sino que queda
//      "flotando"... también puedo crear pasos sueltos en cualquier momento y lugar del tablero»
//   2. «si hago click derecho en una tarjeta, opciones, como eliminar, duplicar...»
//  13. «Aún no funciona poner o sacar más de una flecha a una tarjeta»
// Se EJECUTAN las funciones de lib/flujo-edicion.ts sobre flujos de verdad y se mira el DATO que
// queda (`siguiente`, ramas, `paralelos`, el inicio) con las mismas funciones que lee el motor.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; base en verde: 16 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. `conRaiz` no hace nada (el CRON implícito no queda explícito)               -> 12 / 4
//   2. `conectar` reemplaza la salida ocupada en vez de agregar en paralelo          -> 14 / 2
//   3. sin el chequeo de círculo                                                     -> 15 / 1
//   4. sin el chequeo de caminos que se juntan                                       -> 15 / 1
//   5. `quitarPuerto` sin promover la primera flecha en paralelo                     -> 15 / 1
//   6. `eliminar` borra también lo que colgaba (como `borrarNodo`)                   -> 14 / 2
//   7. `duplicar` copia el `siguiente` (la copia no sale suelta)                     -> 15 / 1
//   8. `crearSuelta` sin `siguiente: null` (sigue en la de abajo del array)          -> 15 / 1
//
// Correr: node --import tsx --test tests/flujo-edicion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conectar, desconectar, eliminar, soltar, crearSuelta, duplicar, tarjetasDondeSeJuntan, MOTIVO } from '../lib/flujo-edicion';
import { validarGrafo, nodoPorId, raizSalida, raicesSalida, padreDe, ID_INICIO, claseDe, type PasoGrafo } from '../lib/flujo-grafo';
import type { PasoParaGrafo } from '../lib/flujo-conversacion';

const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const inicio = (siguiente: string | null, paralelos: string[] = []): PasoParaGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente, ...(paralelos.length ? { paralelos } : {}), canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const cond = (id: string, si: string | null, siNo: string | null, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({
  id, nodo: 'condicion', canal: 'whatsapp', delay_horas: 0, cuerpo: '',
  ramas: [{ id: `${id}_si`, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: si }], si_no: siNo, ...extra,
});
const n = (pasos: readonly PasoGrafo[], id: string) => { const x = nodoPorId(pasos, id); assert.ok(x, `no está ${id}`); return x!; };
const ok = <P>(r: { ok: boolean; pasos: P[]; motivo?: string }) => { assert.equal(r.ok, true, `no se aplicó: ${r.motivo}`); return r.pasos; };
/** Los errores de forma, sin los dos que estas ediciones producen a propósito (ver `errorPropio`). */
const errores = (pasos: readonly PasoGrafo[]) => validarGrafo(pasos).filter((e) => !e.startsWith('tarjetas sueltas') && !/ cuelga de \d+ lugares/.test(e));
const sueltas = (pasos: readonly PasoGrafo[]) => (validarGrafo(pasos).find((e) => e.startsWith('tarjetas sueltas')) ?? '').replace('tarjetas sueltas: ', '').split(', ').filter(Boolean);

test('conectar una salida VACÍA: la flecha pasa a ser su salida, y un flujo sin desconexiones no gana un inicio', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('m3')];
  const out = ok(conectar(pasos, 'm2', 'sig', 'm3'));
  assert.equal(n(out, 'm2').siguiente, 'm3');
  assert.equal(out.some((p) => claseDe(p) === 'inicio'), false, 'se agregó un inicio sin hacer falta');
  assert.deepEqual(errores(out), []);
});

test('⚠️ conectar una salida OCUPADA agrega una flecha EN PARALELO (punto 13), no la reemplaza', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('m3')];
  const out = ok(conectar(pasos, 'm1', 'sig', 'm3'));
  assert.equal(n(out, 'm1').siguiente, 'm2', 'se perdió la flecha de antes');
  assert.deepEqual(n(out, 'm1').paralelos, ['m3']);
  // Y desde un RESULTADO de una condición, en paralelo de ESE resultado.
  const c = [cond('c', 'a', null), msg('a'), msg('b'), inicio('c')];
  const outC = ok(conectar(c, 'c', 'c_si', 'b'));
  assert.equal(n(outC, 'c').ramas![0].siguiente, 'a');
  assert.deepEqual(n(outC, 'c').ramas![0].paralelos, ['b']);
});

test('⚠️ VARIOS PADRES: dos ramas que llegan a la misma tarjeta (punto 13)', () => {
  const pasos = [cond('c', 'a', 'b'), msg('a', { siguiente: 'fin' }), msg('b'), msg('fin'), inicio('c')];
  const out = ok(conectar(pasos, 'b', 'sig', 'fin'));
  assert.equal(n(out, 'b').siguiente, 'fin');
  assert.equal(n(out, 'a').siguiente, 'fin');
  assert.deepEqual(errores(out), [], 'juntar ramas de una condición tiene que poder publicarse');
});

test('no conecta: a sí misma, al CRON, a «Si responde», lo ya conectado, ni armando un círculo', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2', { siguiente: 'm3' }), msg('m3'), { id: 'r', nodo: 'respuesta', casos: [], si_no: null } as PasoGrafo];
  assert.equal((conectar(pasos, 'm1', 'sig', 'm1') as { motivo: string }).motivo, MOTIVO.consigo);
  assert.equal((conectar(pasos, 'm3', 'sig', ID_INICIO) as { motivo: string }).motivo, MOTIVO.alCron);
  assert.equal((conectar(pasos, 'm3', 'sig', 'r') as { motivo: string }).motivo, MOTIVO.aRespuesta);
  assert.equal((conectar(pasos, 'm1', 'sig', 'm2') as { motivo: string }).motivo, MOTIVO.yaEstan);
  const circulo = conectar(pasos, 'm3', 'sig', 'm1');
  assert.equal(circulo.ok, false);
  assert.equal((circulo as { motivo: string }).motivo, MOTIVO.circulo);
  assert.deepEqual(circulo.pasos.map((p) => p.siguiente ?? null), pasos.map((p) => p.siguiente ?? null), 'un rechazo cambió el flujo');
});

test('⚠️ dos caminos EN PARALELO no se juntan: al lead le llegaría lo mismo dos veces', () => {
  // CRON → m1 → m2, y en paralelo e1. Juntar e1 con m2 hace que m2 lo alcancen los dos hilos.
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('e1'), inicio('m1', ['e1'])];
  const r = conectar(pasos, 'e1', 'sig', 'm2');
  assert.equal(r.ok, false);
  assert.equal((r as { motivo: string }).motivo, MOTIVO.juntaCaminos);
  assert.deepEqual([...tarjetasDondeSeJuntan(pasos)], []);
});

test('⚠️ el CRON IMPLÍCITO: conectar a su primera tarjeta deja la flecha del CRON explícita', () => {
  // Sin inicio, el CRON va a la primera que nadie apunta. Una suelta L que se conecta a m1 le quitaba
  // el lugar: m1 tenía padre y la «primera» pasaba a ser L (CRON → L → m1).
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('L')];
  const out = ok(conectar(pasos, 'L', 'sig', 'm1'));
  assert.equal(raizSalida(out), 'm1', 'el CRON dejó de ir a m1');
  assert.deepEqual(sueltas(out), ['L'], 'L tenía que seguir suelta');
  // Y desde el CRON: con primera, la nueva va en paralelo; sin primera, es la salida.
  const conPrimera = ok(conectar(pasos, ID_INICIO, 'sig', 'L'));
  assert.deepEqual(raicesSalida(conPrimera), ['m1', 'L']);
  const vacio = ok(conectar([msg('x'), inicio(null)], ID_INICIO, 'sig', 'x'));
  assert.deepEqual(raicesSalida(vacio), ['x']);
});

test('desconectar: la de después queda SUELTA (punto 7), y la primera en paralelo toma el lugar', () => {
  const pasos = [msg('m1', { siguiente: 'm2', paralelos: ['e1'] }), msg('m2'), msg('e1'), inicio('m1')];
  const out = ok(desconectar(pasos, 'm1', 'sig', 'm2'));
  assert.ok(nodoPorId(out, 'm2'), 'desconectar BORRÓ la tarjeta de después');
  assert.equal(padreDe(out, 'm2'), null);
  assert.equal(n(out, 'm1').siguiente, 'e1', 'la flecha en paralelo no pasó a ser la salida');
  assert.equal(n(out, 'm1').paralelos, undefined);
  // Por la flecha en paralelo, se va sólo ella.
  const sinPar = ok(desconectar(pasos, 'm1', 'par:e1', 'e1'));
  assert.equal(n(sinPar, 'm1').siguiente, 'm2');
  assert.equal(n(sinPar, 'm1').paralelos, undefined);
  assert.equal((desconectar(pasos, 'm2', 'sig', 'm1') as { motivo: string }).motivo, MOTIVO.noConectadas);
});

test('⚠️ desconectar el CRON implícito: la primera queda suelta, no la reemplaza la de abajo', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const out = ok(desconectar(pasos, ID_INICIO, 'sig', 'm1'));
  assert.equal(raizSalida(out), null);
  assert.deepEqual(sueltas(out).sort(), ['m1', 'm2']);
});

test('⚠️ eliminar NO se lleva lo que colgaba: queda suelto (punto 7)', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2', { siguiente: 'm3' }), msg('m3'), inicio('m1')];
  const out = ok(eliminar(pasos, 'm2'));
  assert.equal(nodoPorId(out, 'm2'), null);
  assert.ok(nodoPorId(out, 'm3'), 'se borró lo que colgaba');
  assert.equal(n(out, 'm1').siguiente, null);
  assert.deepEqual(sueltas(out), ['m3']);
  // Una condición tampoco se lleva sus ramas.
  const c = [cond('c', 'a', 'b'), msg('a'), msg('b'), inicio('c')];
  const sinC = ok(eliminar(c, 'c'));
  assert.deepEqual(sinC.filter((p) => claseDe(p) !== 'inicio').map((p) => p.id), ['a', 'b']);
  assert.equal(eliminar(c, ID_INICIO).ok, false);
});

test('⚠️ eliminar la PRIMERA sin inicio: la de después no pasa sola a colgar del CRON', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const out = ok(eliminar(pasos, 'm1'));
  assert.equal(raizSalida(out), null, 'm2 pasó a ser la salida del CRON sin que nadie la conectara');
  assert.deepEqual(sueltas(out), ['m2']);
});

test('eliminar: un «Ir a» que saltaba ahí se queda, sin destino (Publicar lo frena)', () => {
  const pasos = [msg('m1', { siguiente: 'w' }), { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'ir' } as PasoGrafo, { id: 'ir', nodo: 'ir_a', destino: { nodo: 'm1' } } as PasoGrafo, msg('m0', { siguiente: 'm1' }), inicio('m0')];
  const out = ok(eliminar(pasos, 'm1'));
  assert.ok(nodoPorId(out, 'ir'));
  assert.equal(n(out, 'ir').destino, null);
});

test('«Desconectar» una tarjeta: le saca TODAS las flechas que le llegan, de todos sus padres', () => {
  const pasos = [cond('c', 'a', 'b'), msg('a', { siguiente: 'fin' }), msg('b', { siguiente: 'fin' }), msg('fin', { siguiente: 'z' }), msg('z'), inicio('c')];
  const out = ok(soltar(pasos, 'fin'));
  assert.equal(n(out, 'a').siguiente, null);
  assert.equal(n(out, 'b').siguiente, null);
  assert.equal(n(out, 'fin').siguiente, 'z', 'se llevó lo suyo');
  assert.equal(soltar(out, 'fin').ok, false, 'sin flechas que le lleguen, no hay nada que desconectar');
});

test('⚠️ crearSuelta: nace SIN flechas, también en un flujo vacío (ahí sería la primera)', () => {
  const vacia = crearSuelta([], 'mensaje', rndDe(3));
  assert.equal(raizSalida(vacia.pasos), null, 'la suelta pasó a colgar del CRON');
  assert.deepEqual(sueltas(vacia.pasos), [vacia.id]);
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const r = crearSuelta(pasos, 'condicion', rndDe(5));
  assert.equal(raizSalida(r.pasos), 'm1');
  assert.equal(n(r.pasos, r.id).nodo, 'condicion');
  assert.equal(n(r.pasos, 'm2').siguiente, null, 'la de arriba pasó a seguir en la suelta');
  assert.deepEqual(sueltas(r.pasos), [r.id]);
});

test('duplicar: la copia sale SUELTA, con todo lo de adentro y ids nuevos (también los de las ramas)', () => {
  const pasos = [cond('c', 'a', 'b', { ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'a', paralelos: ['x'] }] }), msg('a'), msg('b'), msg('x'), inicio('c')];
  const r = duplicar(pasos, 'c', rndDe(7));
  assert.equal(r.ok, true);
  const id = (r as { id: string }).id;
  const copia = n(r.pasos, id);
  assert.notEqual(id, 'c');
  assert.deepEqual(copia.ramas!.map((x) => x.filas), [[{ campo: 'agendo' }]]);
  assert.notEqual(copia.ramas![0].id, 'r1');
  assert.equal(copia.ramas![0].siguiente, null);
  assert.equal(copia.ramas![0].paralelos, undefined);
  assert.equal(copia.si_no, null);
  assert.deepEqual(sueltas(r.pasos), [id]);
  const m = duplicar([msg('m1', { siguiente: 'm2', cuerpo: 'Hola {{lead_nombre}}' }), msg('m2')], 'm1', rndDe(9));
  const mid = (m as { id: string }).id;
  assert.equal(n(m.pasos, mid).cuerpo, 'Hola {{lead_nombre}}');
  assert.equal(n(m.pasos, mid).siguiente, null);
  assert.equal(raizSalida(m.pasos), 'm1', 'la copia le ganó el lugar a la primera');
  assert.equal(duplicar([inicio('m1'), msg('m1')], ID_INICIO).ok, false);
});

test('conectar NO puede dejar un error de forma que antes no estaba (la red con `validarGrafo`)', () => {
  // Una espera adentro de «Si responde» no se puede: conectar un caso a una espera lo armaría.
  const pasos = [
    msg('m1'), { id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: null } as PasoGrafo,
    { id: 'r', nodo: 'respuesta', casos: [{ id: 'k', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: null }], si_no: null } as PasoGrafo,
  ];
  const r = conectar(pasos, 'r', 'k', 'w');
  assert.equal(r.ok, false);
  assert.match((r as { motivo: string }).motivo, /esperas/);
});

test('una salida que no admite más flechas no se conecta en paralelo (un caso de «Si responde»)', () => {
  const pasos = [msg('m1'), msg('a'), msg('b'), { id: 'r', nodo: 'respuesta', casos: [{ id: 'k', titulo: 'Precio', cuando: 'x', siguiente: 'a' }], si_no: null } as PasoGrafo];
  assert.equal((conectar(pasos, 'r', 'k', 'b') as { motivo: string }).motivo, MOTIVO.ocupada);
});
