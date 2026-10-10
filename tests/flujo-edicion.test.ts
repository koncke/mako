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
// ⚠️ SEGUNDA PASADA (09/10/2026): lib/flujo-edicion.ts es LA PUERTA de las flechas. Acá viven también
// los casos que cubrían el `conectar` / `desconectar` / `crearSuelta` de lib/flujo-grafo.ts (se fueron,
// sin call site): la raíz fijada antes de editar, la suelta que no pasa a ser la entrada, la salida
// ocupada que abre una en paralelo, el tope y el CRON desconectado. Y lo que cambió de regla: un
// círculo CON una espera se conecta (se publica), y lo incompleto se conecta y se GUARDA
// (`validarParaGuardar`); lo frena Publicar.
//
// PROBADO ROMPIÉNDOLO (09/10/2026, segunda pasada; base en verde: 20 pasan, 0 fallan). Cada rotura de
// a una, aplicada y restaurada DE MEMORIA por un arnés con md5 (nunca con `git checkout`). Pasan / fallan:
//   E1.  `paraEditar` sin `fijarRaiz` (el CRON queda implícito)                       -> 13 / 7
//   E2.  `conectar` pisa la salida ocupada en vez de abrir una en paralelo            -> 17 / 3
//   E3.  sin la regla del círculo (`ciclosSinEspera`)                                 -> 19 / 1
//   E4.  la regla vieja: todo círculo se rechaza, aunque tenga una espera             -> 19 / 1
//   E5.  sin la regla de los caminos que se juntan (`cruces`)                        -> 19 / 1
//   E6.  «Si responde» con la salida dice lo mismo que dos caminos en paralelo        -> 19 / 1
//   E7.  `quitarPuerto` sin promover la primera flecha en paralelo                    -> 19 / 1
//   E8.  `eliminar` se lleva lo que colgaba                                            -> 17 / 3
//   E9.  `duplicar` copia el `siguiente` (la copia no sale suelta)                     -> 19 / 1
//   E10. `crearSuelta` sin fijar la raíz (en un flujo vacío sería la primera)          -> 18 / 2
//   E11. sin la red (`validarParaGuardar`)                                             -> 19 / 1
//   E12. vuelve `destinosConectables` a lib/flujo-grafo.ts (dos puertas)               -> 19 / 1
//
// Correr: node --import tsx --test tests/flujo-edicion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conectar, desconectar, eliminar, soltar, crearSuelta, duplicar, MOTIVO } from '../lib/flujo-edicion';
import {
  validarGrafo, validarParaGuardar, nodoPorId, raizSalida, raicesSalida, padreDe, padresDe, tarjetasSueltas, conectarPuerto,
  ID_INICIO, claseDe, type PasoGrafo,
} from '../lib/flujo-grafo';
import type { PasoParaGrafo } from '../lib/flujo-conversacion';
import { iniciar } from '../lib/simulador-grafo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const inicio = (siguiente: string | null, paralelos: string[] = []): PasoParaGrafo => ({ id: ID_INICIO, nodo: 'inicio', siguiente, ...(paralelos.length ? { paralelos } : {}), canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const esp = (id: string, siguiente: string | null): PasoParaGrafo => ({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '' });
const cond = (id: string, si: string | null, siNo: string | null, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({
  id, nodo: 'condicion', canal: 'whatsapp', delay_horas: 0, cuerpo: '',
  ramas: [{ id: `${id}_si`, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: si }], si_no: siNo, ...extra,
});
const n = (pasos: readonly PasoGrafo[], id: string) => { const x = nodoPorId(pasos, id); assert.ok(x, `no está ${id}`); return x!; };
const ok = <P>(r: { ok: boolean; pasos: P[]; motivo?: string }) => { assert.equal(r.ok, true, `no se aplicó: ${r.motivo}`); return r.pasos; };
const motivo = (r: { ok: boolean; motivo?: string }) => { assert.equal(r.ok, false, 'se aplicó y no tenía que'); return r.motivo; };
const inicioDe = (pasos: readonly PasoGrafo[]) => pasos.find((p) => claseDe(p) === 'inicio');

test('⚠️ toda edición FIJA LA RAÍZ: el CRON queda en el dato, al final del array, apuntando a la de siempre', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('m3')];
  const out = ok(conectar(pasos, 'm2', 'sig', 'm3'));
  assert.equal(n(out, 'm2').siguiente, 'm3');
  assert.equal(claseDe(out[out.length - 1]), 'inicio', 'el CRON no quedó en el dato (o no quedó al final: correría el índice de una inscripción)');
  assert.equal(inicioDe(out)!.siguiente, 'm1');
  assert.deepEqual(validarGrafo(out), []);
  // Y lo mismo desconectando, soltando, eliminando, creando y duplicando.
  for (const r of [
    desconectar(pasos, 'm1', 'sig', 'm2'), soltar(pasos, 'm2'), eliminar(pasos, 'm3'), duplicar(pasos, 'm1', rndDe(2)),
    { ok: true, ...crearSuelta(pasos, 'mensaje', rndDe(4)) },
  ]) assert.equal(inicioDe(ok(r))?.siguiente, 'm1');
});

test('⚠️ conectar una salida OCUPADA agrega una flecha EN PARALELO (punto 13), no la reemplaza', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('m3')];
  const out = ok(conectar(pasos, 'm1', 'sig', 'm3'));
  assert.equal(n(out, 'm1').siguiente, 'm2', 'se perdió la flecha de antes');
  assert.deepEqual(n(out, 'm1').paralelos, ['m3']);
  // Y desde un RESULTADO de una condición, en paralelo de ESE resultado (el «Sí» y el «Si no»).
  const c = [cond('c', 'a', 'b'), msg('a'), msg('b'), msg('x'), inicio('c')];
  const outC = ok(conectar(c, 'c', 'c_si', 'x'));
  assert.equal(n(outC, 'c').ramas![0].siguiente, 'a');
  assert.deepEqual(n(outC, 'c').ramas![0].paralelos, ['x']);
  assert.deepEqual(n(ok(conectar(c, 'c', 'si_no', 'x')), 'c').paralelos_si_no, ['x']);
});

test('⚠️ VARIOS PADRES: dos ramas que llegan a la misma tarjeta (punto 13) se publican', () => {
  const pasos = [cond('c', 'a', 'b'), msg('a', { siguiente: 'fin' }), msg('b'), msg('fin'), inicio('c')];
  const out = ok(conectar(pasos, 'b', 'sig', 'fin'));
  assert.equal(n(out, 'b').siguiente, 'fin');
  assert.equal(n(out, 'a').siguiente, 'fin');
  assert.deepEqual(validarGrafo(out), [], 'juntar ramas de una condición tiene que poder publicarse');
});

test('no conecta: a sí misma, al CRON, a «Si responde», lo ya conectado', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2', { siguiente: 'm3' }), msg('m3'), { id: 'r', nodo: 'respuesta', casos: [], si_no: null } as PasoGrafo];
  assert.equal(motivo(conectar(pasos, 'm1', 'sig', 'm1')), MOTIVO.consigo);
  assert.equal(motivo(conectar(pasos, 'm3', 'sig', ID_INICIO)), MOTIVO.alCron);
  assert.equal(motivo(conectar(pasos, 'm3', 'sig', 'r')), MOTIVO.aRespuesta);
  assert.equal(motivo(conectar(pasos, 'm1', 'sig', 'm2')), MOTIVO.yaEstan);
});

test('⚠️ un círculo SIN espera no se conecta; CON una espera en el medio, sí (y se publica)', () => {
  const sin = [msg('m1', { siguiente: 'm2' }), msg('m2', { siguiente: 'm3' }), msg('m3')];
  const r = conectar(sin, 'm3', 'sig', 'm1');
  assert.equal(motivo(r), MOTIVO.circulo);
  assert.deepEqual(r.pasos.map((p) => p.siguiente ?? null), sin.map((p) => p.siguiente ?? null), 'un rechazo cambió el flujo');
  // «Volver al principio» después de un día: es un flujo que se publica (y el que deja `quitarIrA`).
  const con = [msg('m1', { siguiente: 'w' }), esp('w', 'm2'), msg('m2')];
  const out = ok(conectar(con, 'm2', 'sig', 'm1'));
  assert.equal(n(out, 'm2').siguiente, 'm1');
  assert.equal(raizSalida(out), 'm1', 'la vuelta le sacó la raíz al CRON');
  assert.deepEqual(validarGrafo(out), []);
});

test('⚠️ dos caminos EN PARALELO no se juntan, y la regla es UNA: la de Publicar (`cruces`)', () => {
  // CRON → m1 → m2, y en paralelo e1. Juntar e1 con m2 hace que m2 lo alcancen los dos hilos.
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('e1'), inicio('m1', ['e1'])];
  const r = conectar(pasos, 'e1', 'sig', 'm2');
  assert.equal(motivo(r), MOTIVO.juntaCaminos);
  // La MISMA regla frena a quien no pasa por el lienzo (Crear con IA, la API, un flujo viejo): todos
  // publican por `setSecuenciaPasos` → `validarGrafo`.
  const aMano = conectarPuerto(pasos, 'e1', 'sig', 'm2');
  assert.ok(validarGrafo(aMano).includes('a la tarjeta m2 llegan dos caminos que corren a la vez'), validarGrafo(aMano).join(' · '));
  // Y lo de «Si responde» tampoco se junta con la salida.
  const conResp = [msg('m1'), msg('x'), { id: 'r', nodo: 'respuesta', casos: [{ id: 'k', titulo: 'Precio', cuando: 'precio', siguiente: 'x' }], si_no: null } as PasoGrafo, inicio('m1')];
  assert.equal(motivo(conectar(conResp, 'm1', 'sig', 'x')), MOTIVO.conRespuesta);
});

test('⚠️ el CRON IMPLÍCITO: una suelta conectada a la PRIMERA no pasa a ser la entrada (con conectarPuerto pelado, sí)', () => {
  // Sin inicio, el CRON va a la primera que nadie apunta. Una suelta L que se conecta a m1 le quitaba
  // el lugar: m1 tenía padre y la «primera» pasaba a ser L (CRON → L → m1).
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2'), msg('L')];
  assert.equal(raizSalida(conectarPuerto(pasos, 'L', 'sig', 'm1')), 'L', 'el caso que esta regla evita');
  const out = ok(conectar(pasos, 'L', 'sig', 'm1'));
  assert.equal(raizSalida(out), 'm1', 'el CRON dejó de ir a m1');
  assert.equal(padresDe(out, 'm1').length, 2, 'el CRON y la suelta');
  assert.deepEqual(tarjetasSueltas(out), ['L'], 'L tenía que seguir suelta');
  // Y desde el CRON: con primera, la nueva va en paralelo; sin primera, es la salida.
  const conPrimera = ok(conectar(pasos, ID_INICIO, 'sig', 'L'));
  assert.deepEqual(raicesSalida(conPrimera), ['m1', 'L']);
  const vacio = ok(conectar([msg('x'), inicio(null)], ID_INICIO, 'sig', 'x'));
  assert.deepEqual(raicesSalida(vacio), ['x']);
});

test('el tope de flechas en paralelo de una salida lo dice con su motivo', () => {
  const lleno = [msg('a', { siguiente: 'b', paralelos: ['c', 'd', 'e'] }), msg('b'), msg('c'), msg('d'), msg('e'), msg('f'), inicio('a')];
  assert.equal(motivo(conectar(lleno, 'a', 'sig', 'f')), MOTIVO.topeParalelos);
});

test('⚠️ lo INCOMPLETO se conecta y se GUARDA; lo frena Publicar (`validarParaGuardar` vs `validarGrafo`)', () => {
  // Un caso de «Si responde» a una espera: «Si responde» se contesta en el momento. Es un borrador.
  const pasos = [
    msg('m1'), esp('w', null),
    { id: 'r', nodo: 'respuesta', casos: [{ id: 'k', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: null }], si_no: null } as PasoGrafo,
  ];
  const out = ok(conectar(pasos, 'r', 'k', 'w'));
  assert.deepEqual(validarParaGuardar(out), [], 'el borrador no se puede guardar');
  assert.ok(validarGrafo(out).some((e) => /esperas/.test(e)), 'Publicar dejó pasar una espera adentro de «Si responde»');
});

test('la red: lo que rompe el DATO no se conecta (`validarParaGuardar`), con su motivo', () => {
  // Una flecha en paralelo a una tarjeta que se llama «r»: el motor llama así al hilo de «Si responde»
  // (sólo pasa con ids escritos a mano, la API). No se arregla terminando de armar: no se guarda.
  const pasos = [msg('a', { siguiente: 'b' }), msg('b'), msg('r'), inicio('a')];
  assert.match(motivo(conectar(pasos, 'a', 'sig', 'r')) ?? '', /id reservado/);
});

test('desconectar: la de después queda SUELTA (punto 7), y la primera en paralelo toma el lugar', () => {
  const pasos = [msg('m1', { siguiente: 'm2', paralelos: ['e1'] }), msg('m2'), msg('e1'), inicio('m1')];
  const out = ok(desconectar(pasos, 'm1', 'sig', 'm2'));
  assert.ok(nodoPorId(out, 'm2'), 'desconectar BORRÓ la tarjeta de después');
  assert.equal(padreDe(out, 'm2'), null);
  assert.equal(n(out, 'm1').siguiente, 'e1', 'la flecha en paralelo no pasó a ser la salida');
  assert.equal(n(out, 'm1').paralelos, undefined);
  assert.deepEqual(validarParaGuardar(out), [], 'una suelta tiene que poder guardarse');
  // Por la flecha en paralelo, se va sólo ella.
  const sinPar = ok(desconectar(pasos, 'm1', 'par:e1', 'e1'));
  assert.equal(n(sinPar, 'm1').siguiente, 'm2');
  assert.equal(n(sinPar, 'm1').paralelos, undefined);
  assert.deepEqual(tarjetasSueltas(sinPar), ['e1']);
  assert.equal(motivo(desconectar(pasos, 'm2', 'sig', 'm1')), MOTIVO.noConectadas);
});

test('⚠️ desconectar el CRON: la primera queda suelta, no la reemplaza la de abajo, y Publicar lo dice PRIMERO', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const out = ok(desconectar(pasos, ID_INICIO, 'sig', 'm1'));
  assert.equal(raizSalida(out), null);
  assert.deepEqual(tarjetasSueltas(out).sort(), ['m1', 'm2']);
  assert.equal(validarGrafo(out)[0], 'el CRON no lleva a ninguna tarjeta', 'va PRIMERO: lo demás es consecuencia');
  assert.equal(validarGrafo([inicio(null)]).length, 0, 'una automatización vacía no tiene nada que correr');
});

test('⚠️ eliminar NO se lleva lo que colgaba: queda suelto (punto 7)', () => {
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2', { siguiente: 'm3' }), msg('m3'), inicio('m1')];
  const out = ok(eliminar(pasos, 'm2'));
  assert.equal(nodoPorId(out, 'm2'), null);
  assert.ok(nodoPorId(out, 'm3'), 'se borró lo que colgaba');
  assert.equal(n(out, 'm1').siguiente, null);
  assert.deepEqual(tarjetasSueltas(out), ['m3']);
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
  assert.deepEqual(tarjetasSueltas(out), ['m2']);
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
  // La flecha del CRON implícito también es una flecha que le llega.
  const primera = ok(soltar([msg('m1', { siguiente: 'm2' }), msg('m2')], 'm1'));
  assert.equal(raizSalida(primera), null);
});

test('⚠️ crearSuelta: nace SIN flechas, también en un flujo vacío (ahí sería la primera), y «Probar» no la corre', () => {
  const vacia = crearSuelta([], 'mensaje', rndDe(3));
  assert.equal(raizSalida(vacia.pasos), null, 'la suelta pasó a colgar del CRON');
  assert.deepEqual(tarjetasSueltas(vacia.pasos), [vacia.id]);
  const pasos = [msg('m1', { siguiente: 'm2' }), msg('m2')];
  const r = crearSuelta(pasos, 'condicion', rndDe(5));
  assert.equal(raizSalida(r.pasos), 'm1');
  assert.equal(n(r.pasos, r.id).nodo, 'condicion');
  assert.equal(n(r.pasos, 'm2').siguiente, null, 'la de arriba pasó a seguir en la suelta');
  assert.deepEqual(tarjetasSueltas(r.pasos), [r.id]);
  assert.deepEqual(validarParaGuardar(r.pasos), [], 'una suelta tiene que poder guardarse');
  assert.ok(validarGrafo(r.pasos).includes(`tarjetas sueltas: ${r.id}`), 'Publicar dejó pasar una suelta');
  assert.deepEqual(iniciar(r.pasos).hilos.map((h) => h.cursor), ['m1'], '«Probar» arranca por la raíz, no por la suelta');
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
  assert.deepEqual(tarjetasSueltas(r.pasos), [id]);
  const m = duplicar([msg('m1', { siguiente: 'm2', cuerpo: 'Hola {{lead_nombre}}' }), msg('m2')], 'm1', rndDe(9));
  const mid = (m as { id: string }).id;
  assert.equal(n(m.pasos, mid).cuerpo, 'Hola {{lead_nombre}}');
  assert.equal(n(m.pasos, mid).siguiente, null);
  assert.equal(raizSalida(m.pasos), 'm1', 'la copia le ganó el lugar a la primera');
  assert.equal(duplicar([inicio('m1'), msg('m1')], ID_INICIO).ok, false);
});

test('una salida que no admite más flechas no se conecta en paralelo (un caso de «Si responde»)', () => {
  const pasos = [msg('m1'), msg('a'), msg('b'), { id: 'r', nodo: 'respuesta', casos: [{ id: 'k', titulo: 'Precio', cuando: 'x', siguiente: 'a' }], si_no: null } as PasoGrafo];
  assert.equal(motivo(conectar(pasos, 'r', 'k', 'b')), MOTIVO.ocupada);
});

test('⚠️ UNA PUERTA: el modelo no tiene otra implementación de las flechas, y ésta no filtra TEXTOS', () => {
  const grafo = sinComentarios(leer('lib/flujo-grafo.ts'));
  for (const f of ['conectar', 'desconectar', 'crearSuelta', 'destinosConectables']) {
    assert.doesNotMatch(grafo, new RegExp(`export function ${f}\\b`), `volvió \`${f}\` a lib/flujo-grafo.ts: dos puertas para lo mismo`);
  }
  const edicion = sinComentarios(leer('lib/flujo-edicion.ts'));
  assert.doesNotMatch(edicion, /validarGrafo\(/, 'la red de las ediciones volvió a ser Publicar (con un filtro de textos)');
  assert.doesNotMatch(edicion, /tarjetasDondeSeJuntan|cuelga de/, 'volvió una copia propia de las reglas de Publicar');
  assert.match(edicion, /validarParaGuardar\(/);
  assert.match(edicion, /cruces\(/);
  assert.match(edicion, /fijarRaiz\(/);
});
