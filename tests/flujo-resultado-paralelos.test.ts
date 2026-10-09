// =============================================================================
// CUARTA TANDA, PUNTO 8: varias flechas por RESULTADO de una condición
// =============================================================================
// Pedido literal de Martín (09/10/2026): «dentro de las flechas que se despegan de una condición,
// se debería poder desplegar varias si se cumple y varias si no se cumple... En ambos casos, por
// ejemplo, se podría enviar un WhatsApp y un Email y eso son 2 flechas en cada resultado».
//
// El modelo (lib/flujo-grafo.ts): `paralelos` en cada rama y `paralelos_si_no` en la condición,
// expuestos como puertos `par:<destino>@<resultado>`. El motor (`resolverControl`) arranca los del
// resultado ELEGIDO; «Probar» (`elegir`) los abre; el lienzo (`grafoDeSecuencia`) ofrece el ＋ en la
// fila sólo donde Publicar lo aceptaría. Se EJECUTA todo lo puro; del motor que escribe (server-only)
// se lee el fuente, sin comentarios y con los \r\n normalizados.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie, con lo que cazó cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PasoGrafo, type HechosLead,
  TOPE_PARALELOS, TOPE_HILOS, RESULTADO_SI_NO,
  puertosDe, padreDe, descendientes, hiloDe, raicesSalida, normalizar, validarGrafo, conectarPuerto, insertarNodo,
  borrarNodo, nodoPorId, paralelosDeResultado, puertoParalelo, leerPuertoParalelo, contarParalelos, repartenEnBucle,
  totalDeParalelos,
} from '../lib/flujo-grafo';
import { resolverControl, camposDelFlujo, alcanzablesDesde, esPrimerPaso } from '../lib/nutricion-grafo-motor';
import { repartosDe, planDePosicion, estadoDeCierrePermanente, type Hilo } from '../lib/nutricion-hilos';
import { iniciar, siguiente, elegir, type EstadoSim, type EventoSim } from '../lib/simulador-grafo';
import { grafoDeSecuencia, insertarDesdeLienzo, lugarDesdeLienzo, filasConParalelo, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { yDePuerto, type NodoFlujo } from '../lib/lienzo-grafo';

const AHORA = Date.parse('2026-10-09T15:00:00Z');
const HORA = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const msg = (id: string, o: Partial<PasoGrafo> = {}): PasoGrafo => ({ id, canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: id, template_wa: null, siguiente: null, ...o });
const mail = (id: string, o: Partial<PasoGrafo> = {}): PasoGrafo => msg(id, { canal: 'email', asunto: 'Asunto', ...o });
const cond = (id: string, o: Partial<PasoGrafo> = {}): PasoGrafo => msg(id, { nodo: 'condicion', cuerpo: '', ramas: [{ id: `${id}r0`, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: null }], si_no: null, ...o });
const esperar = (id: string, siguiente: string | null, o: Partial<PasoGrafo> = {}): PasoGrafo => msg(id, { nodo: 'esperar', cuerpo: '', espera: { modo: 'tiempo', minutos: 60 }, siguiente, ...o });
const irA = (id: string, nodo: string): PasoGrafo => msg(id, { nodo: 'ir_a', cuerpo: '', destino: { nodo } });
const H = (x: Partial<HechosLead> = {}): HechosLead => ({
  etiquetas: new Set(), etapa: null, etapasPorProducto: new Map(), agendo: false, pago: false, yaContactado: false,
  respondio: false, creadoMs: AHORA - HORA, tieneTelefono: true, tieneEmail: true, ahoraMs: AHORA, ...x,
});
const con = (errs: readonly string[], trozo: string) => errs.some((e) => e.includes(trozo));

/**
 * EL EJEMPLO DEL PEDIDO: el CRON → «¿Agendó?» → «Sí»: un WhatsApp (ws) y un email (es) a la vez;
 * «Si no»: un WhatsApp (wn) y un email (en) a la vez. Dos flechas en cada resultado.
 */
const EJEMPLO: PasoGrafo[] = [
  cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['es'] }], si_no: 'wn', paralelos_si_no: ['en'] }),
  msg('ws'), mail('es'), msg('wn'), mail('en'),
];

// ── El modelo ──────────────────────────────────────────────────────────────────

test('el ejemplo del pedido: cada resultado es una salida más sus flechas en paralelo, y se puede publicar', () => {
  assert.deepEqual(validarGrafo(EJEMPLO), []);
  assert.deepEqual(puertosDe(EJEMPLO, 0), [
    { puerto: 'si', destino: 'ws' }, { puerto: 'par:es@si', destino: 'es' },
    { puerto: 'si_no', destino: 'wn' }, { puerto: 'par:en@si_no', destino: 'en' },
  ]);
  // Un puerto más: padre, descendientes y los hilos lo ven sin saber que existe.
  assert.deepEqual(padreDe(EJEMPLO, 'es'), { id: 'k', puerto: 'par:es@si' });
  assert.deepEqual(padreDe(EJEMPLO, 'en'), { id: 'k', puerto: 'par:en@si_no' });
  assert.deepEqual([...descendientes(EJEMPLO, 'k')].sort(), ['en', 'es', 'wn', 'ws']);
  assert.deepEqual(Object.fromEntries(hiloDe(EJEMPLO)), { k: 'p', ws: 'p', es: 'es', wn: 'p', en: 'en' });
  // No son raíces: no arrancan al inscribir, arrancan cuando la condición sale por su resultado.
  assert.deepEqual(raicesSalida(EJEMPLO), ['k']);
  // Dos flechas dibujadas, y UNA corre a la vez (sexta tanda: para un lead sale un solo resultado).
  assert.equal(totalDeParalelos(EJEMPLO), 2);
  assert.equal(contarParalelos(EJEMPLO), 1);
  assert.deepEqual(paralelosDeResultado(EJEMPLO[0], 'si'), ['es']);
  assert.deepEqual(paralelosDeResultado(EJEMPLO[0], RESULTADO_SI_NO), ['en']);
  assert.deepEqual(paralelosDeResultado(EJEMPLO[0], 'otra'), []);
  assert.deepEqual(paralelosDeResultado(EJEMPLO[1], 'si'), [], 'un mensaje no tiene resultados');
});

test('el puerto: `par:<destino>@<resultado>` se escribe y se lee igual; lo de siempre no cambia', () => {
  assert.equal(puertoParalelo('es', 'si'), 'par:es@si');
  assert.equal(puertoParalelo(null, 'si_no'), 'par@si_no');
  assert.equal(puertoParalelo('w'), 'par:w');
  assert.equal(puertoParalelo(null), 'par');
  assert.deepEqual(leerPuertoParalelo('par:es@si'), { destino: 'es', resultado: 'si' });
  assert.deepEqual(leerPuertoParalelo('par@si_no'), { destino: null, resultado: 'si_no' });
  assert.deepEqual(leerPuertoParalelo('par:w'), { destino: 'w', resultado: null });
  assert.deepEqual(leerPuertoParalelo('par'), { destino: null, resultado: null });
  for (const p of ['sig', 'si_no', 'kr0', 'parche']) assert.equal(leerPuertoParalelo(p), null, `«${p}» no es una flecha en paralelo`);
});

test('⚠️ lo guardado SIN el campo nuevo se lee igual: los mismos puertos y el mismo dato normalizado', () => {
  const viejo = [cond('k', { ramas: [{ id: 'kr0', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'a' }], si_no: 'b' }), msg('a'), msg('b')];
  assert.deepEqual(puertosDe(viejo, 0).map((p) => p.puerto), ['kr0', 'si_no']);
  const n = normalizar(viejo);
  assert.equal('paralelos' in n[0].ramas![0], false, 'apareció un `paralelos` en una rama que nunca lo tuvo');
  assert.equal('paralelos_si_no' in n[0], false);
  assert.deepEqual(normalizar(n), n);
  // Y el motor no arranca nada nuevo por ninguno de los dos resultados.
  assert.deepEqual(resolverControl(viejo, 0, { hechos: H({ agendo: true }), ahoraMs: AHORA, reunionMs: null }), { tipo: 'nodo', idx: 1, via: ['k'], repartos: [] });
  assert.deepEqual(resolverControl(viejo, 0, { hechos: H(), ahoraMs: AHORA, reunionMs: null }), { tipo: 'nodo', idx: 2, via: ['k'], repartos: [] });
});

test('normalizar: limpia cada resultado, promueve la primera si no tiene principal, y saca los ids colgados', () => {
  const sucio: PasoGrafo[] = [
    cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'a', paralelos: ['b', 'b', '', 'k', 'a', 'fantasma'] }], si_no: null, paralelos_si_no: ['c', 'd'] }),
    msg('a'), msg('b'), msg('c'), msg('d'),
    // Sólo una condición tiene «Si no» con flechas.
    msg('x', { paralelos_si_no: ['a'] } as Partial<PasoGrafo>),
    // Y una tarjeta de siempre con una flecha a una tarjeta que no está (lo que prometía el
    // comentario de `paralelosDe` desde la segunda tanda y el código no hacía).
    msg('m', { paralelos: ['fantasma', 'b2'] }), msg('b2'),
  ];
  const out = normalizar(sucio);
  const k = nodoPorId(out, 'k')!;
  // Sin repetidos, sin vacíos, sin la propia condición, sin repetir la principal, sin colgados.
  assert.deepEqual(k.ramas![0].paralelos, ['b']);
  // «Si no» sin principal y con flechas: la primera PASA a ser la principal.
  assert.equal(k.si_no, 'c');
  assert.deepEqual(k.paralelos_si_no, ['d']);
  assert.equal('paralelos_si_no' in nodoPorId(out, 'x')!, false);
  assert.deepEqual(nodoPorId(out, 'm')!.paralelos, ['b2']);
  assert.deepEqual(normalizar(out), out, 'normalizar no es idempotente');
});

test('⚠️ borrar la tarjeta destino de una flecha de un resultado no deja ids colgados (ni por el lienzo ni por otro escritor)', () => {
  // Por el lienzo (`borrarNodo`): el padre se reconecta POR ESA flecha.
  const conCola = normalizar([...EJEMPLO.map((p) => (p.id === 'es' ? { ...p, siguiente: 'es2' } : p)), mail('es2')]);
  const sinEs = borrarNodo(conCola, 'es');
  assert.deepEqual(nodoPorId(sinEs, 'k')!.ramas![0].paralelos, ['es2']);
  assert.deepEqual(validarGrafo(sinEs), []);
  // La última de su lista: la lista se va con ella, sin un `[]` guardado.
  const sinEn = borrarNodo(EJEMPLO, 'en');
  assert.equal('paralelos_si_no' in nodoPorId(sinEn, 'k')!, false);
  assert.deepEqual(validarGrafo(sinEn), []);
  // Borrar la PRINCIPAL de un resultado que tiene flechas: la primera pasa a ser la principal.
  const sinWs = borrarNodo(EJEMPLO, 'ws');
  const k = nodoPorId(sinWs, 'k')!;
  assert.equal(k.ramas![0].siguiente, 'es');
  assert.equal('paralelos' in k.ramas![0], false);
  assert.deepEqual(validarGrafo(sinWs), []);
  // Borrar la condición se lleva los dos resultados con todas sus flechas.
  assert.deepEqual(borrarNodo(EJEMPLO, 'k'), []);
  // Otro escritor que saca la tarjeta del array sin tocar la lista: `normalizar` la limpia, y lo
  // que guarda `setSecuenciaPasos` (que normaliza antes de validar) no queda colgado.
  const filtrado = normalizar(EJEMPLO.filter((p) => p.id !== 'es'));
  assert.equal('paralelos' in nodoPorId(filtrado, 'k')!.ramas![0], false);
  assert.deepEqual(validarGrafo(filtrado), []);
});

test('validar: el tope es POR RESULTADO, y los caminos son los que corren A LA VEZ (sexta tanda)', () => {
  const hijos = (n: number, pre: string) => Array.from({ length: n }, (_, j) => msg(`${pre}${j}`));
  const conLista = (enSi: number, enNo: number): PasoGrafo[] => [
    cond('k', {
      ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: hijos(enSi, 's').map((p) => p.id!) }],
      si_no: 'wn', paralelos_si_no: hijos(enNo, 'n').map((p) => p.id!),
    }),
    msg('ws'), msg('wn'), ...hijos(enSi, 's'), ...hijos(enNo, 'n'),
  ];
  assert.deepEqual(validarGrafo(conLista(TOPE_PARALELOS, 0)), []);
  assert.ok(con(validarGrafo(conLista(TOPE_PARALELOS + 1, 0)), `más de ${TOPE_PARALELOS} flechas en paralelo en un resultado`));
  // ⚠️ SEXTA TANDA, PUNTO 13: hasta acá 1 + 3 + 3 = 7 «caminos» no entraban, aunque a un lead le corre
  // UNO solo de los dos resultados: era la regla que frenaba «abrir 2 flechas» en la tercera condición.
  // Ahora cuenta el resultado que más abre: 1 + máx(3, 3) = 4.
  assert.equal(TOPE_HILOS, 6);
  assert.deepEqual(validarGrafo(conLista(3, 2)), []);
  assert.deepEqual(validarGrafo(conLista(3, 3)), []);
  // Lo que sí corre a la vez: el WhatsApp del «Sí» saca otras 3 en paralelo → 1 + 3 + 3 = 7.
  const aLaVez = conLista(3, 0).map((p) => (p.id === 'ws' ? { ...p, paralelos: ['x0', 'x1', 'x2'] } : p));
  aLaVez.push(msg('x0'), msg('x1'), msg('x2'));
  assert.ok(con(validarGrafo(aLaVez), `como mucho ${TOPE_HILOS} caminos`));
});

test('validar: repetidas, ids reservados, adentro de «Si responde» y dentro de un bucle', () => {
  const rama = (paralelos: string[], siguiente = 'a') => [{ id: 'si', modo: 'todas' as const, filas: [{ campo: 'agendo' }], siguiente, paralelos }];
  assert.ok(con(validarGrafo([cond('k', { ramas: rama(['b', 'b']) }), msg('a'), msg('b')]), 'repite'));
  assert.ok(con(validarGrafo([cond('k', { ramas: rama(['p']) }), msg('a'), msg('p')]), 'id reservado'));
  // Adentro de «Si responde» todo corre en el momento y en UN hilo.
  const enResp: PasoGrafo[] = [
    msg('m'),
    msg('R', { nodo: 'respuesta', cuerpo: '', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'k' }], si_no: null }),
    cond('k', { ramas: rama(['b']) }), msg('a'), msg('b'),
  ];
  assert.ok(con(validarGrafo(enResp), '«Si responde» no puede sacar flechas en paralelo'));
  // Una condición que reparte DENTRO de un bucle abriría hilos en cada vuelta.
  const bucle: PasoGrafo[] = [cond('k', { ramas: rama(['w'], 'm1') }), msg('m1', { siguiente: 'e' }), esperar('e', 'j'), irA('j', 'k'), msg('w')];
  assert.deepEqual([...repartenEnBucle(bucle)], ['k']);
  assert.ok(con(validarGrafo(bucle), 'dentro de un bucle'));
  // Sin la flecha en paralelo, el mismo bucle se puede publicar.
  assert.deepEqual(validarGrafo([cond('k', { ramas: rama([], 'm1') }), msg('m1', { siguiente: 'e' }), esperar('e', 'j'), irA('j', 'k')]), []);
});

test('conectarPuerto: `par@<resultado>` agrega, `par:<id>@<resultado>` reemplaza o saca', () => {
  const k = (pasos: PasoGrafo[]) => nodoPorId(pasos, 'k')!;
  assert.deepEqual(k(conectarPuerto(EJEMPLO, 'k', 'par@si', 'z')).ramas![0].paralelos, ['es', 'z']);
  assert.deepEqual(k(conectarPuerto(EJEMPLO, 'k', 'par@si', 'es')).ramas![0].paralelos, ['es'], 'repitió una flecha');
  assert.deepEqual(k(conectarPuerto(EJEMPLO, 'k', 'par@si_no', 'z')).paralelos_si_no, ['en', 'z']);
  assert.deepEqual(k(conectarPuerto(EJEMPLO, 'k', 'par:es@si', 'z')).ramas![0].paralelos, ['z']);
  assert.equal('paralelos' in k(conectarPuerto(EJEMPLO, 'k', 'par:es@si', null)).ramas![0], false);
  // Sin resultado en el puerto, el que tiene ese destino (un id cuelga de un solo lugar).
  assert.equal('paralelos_si_no' in k(conectarPuerto(EJEMPLO, 'k', 'par:en', null)), false);
  // Lo que no es de esa tarjeta no la toca.
  assert.deepEqual(conectarPuerto(EJEMPLO, 'k', 'par@nada', 'z'), EJEMPLO);
  assert.deepEqual(conectarPuerto(EJEMPLO, 'k', 'par', 'z'), EJEMPLO, 'una condición no tiene flechas de la tarjeta');
  assert.deepEqual(conectarPuerto(EJEMPLO, 'ws', 'par@si', 'z'), EJEMPLO, 'un mensaje no tiene resultados');
});

test('insertarNodo: una flecha NUEVA desde un resultado, el ＋ del medio de una, y nada de tarjetas sueltas', () => {
  const ids = (pasos: PasoGrafo[]) => pasos.map((p) => p.id);
  // Una flecha nueva desde el «Sí»: nace sin nada después y abre su propio hilo.
  const out = insertarNodo(EJEMPLO, { nodo: 'k', puerto: 'par@si' }, mail('n1'));
  assert.deepEqual(nodoPorId(out, 'k')!.ramas![0].paralelos, ['es', 'n1']);
  assert.equal(nodoPorId(out, 'k')!.ramas![0].siguiente, 'ws', 'pisó la flecha de siempre');
  assert.equal(nodoPorId(out, 'n1')!.siguiente, null);
  assert.equal(ids(out).indexOf('n1'), 1, 'la tarjeta nueva va justo después de su condición');
  assert.equal(hiloDe(out).get('n1'), 'n1');
  assert.deepEqual(validarGrafo(out), []);
  // El ＋ del MEDIO de la flecha en paralelo del «Si no»: queda en el medio y apunta a la de antes.
  const medio = insertarNodo(EJEMPLO, { nodo: 'k', puerto: 'par:en@si_no' }, msg('n2'));
  assert.deepEqual(nodoPorId(medio, 'k')!.paralelos_si_no, ['n2']);
  assert.equal(nodoPorId(medio, 'n2')!.siguiente, 'en');
  assert.deepEqual(validarGrafo(medio), []);
  // Un resultado VACÍO: la flecha nueva ES su principal.
  const vacio = [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws' }], si_no: null }), msg('ws')];
  const n3 = insertarNodo(vacio, { nodo: 'k', puerto: 'par@si_no' }, msg('n3'));
  assert.equal(nodoPorId(n3, 'k')!.si_no, 'n3');
  assert.equal('paralelos_si_no' in nodoPorId(n3, 'k')!, false);
  // ⚠️ Un puerto que esa tarjeta no tiene NO inserta (antes la dejaba en el array, suelta).
  assert.deepEqual(ids(insertarNodo(EJEMPLO, { nodo: 'ws', puerto: 'par@si' }, msg('n4'))), ids(EJEMPLO));
  assert.deepEqual(ids(insertarNodo(EJEMPLO, { nodo: 'k', puerto: 'par@nada' }, msg('n5'))), ids(EJEMPLO));
  assert.deepEqual(ids(insertarNodo(EJEMPLO, { nodo: 'k', puerto: 'inexistente' }, msg('n6'))), ids(EJEMPLO));
});

// ── El motor ───────────────────────────────────────────────────────────────────

test('⚠️ el motor: al resolver la condición sigue por la principal del resultado y ARRANCA sus paralelos, no los del otro', () => {
  const si = resolverControl(EJEMPLO, 0, { hechos: H({ agendo: true }), ahoraMs: AHORA, reunionMs: null });
  assert.deepEqual(si, { tipo: 'nodo', idx: 1, via: ['k'], repartos: [{ destino: 'es', desdeMs: AHORA }] });
  const no = resolverControl(EJEMPLO, 0, { hechos: H(), ahoraMs: AHORA, reunionMs: null });
  assert.deepEqual(no, { tipo: 'nodo', idx: 3, via: ['k'], repartos: [{ destino: 'en', desdeMs: AHORA }] });
  // Sin hechos no decide nada: no arranca ningún hilo.
  assert.deepEqual(resolverControl(EJEMPLO, 0, { hechos: null, ahoraMs: AHORA, reunionMs: null }), { tipo: 'faltan_hechos' });
  // Con una espera detrás del resultado, la flecha arranca AHORA y el principal espera.
  const conEspera = [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'e', paralelos: ['es'] }] }), esperar('e', 'ws'), msg('ws'), mail('es')];
  assert.deepEqual(validarGrafo(conEspera), []);
  assert.deepEqual(resolverControl(conEspera, 0, { hechos: H({ agendo: true }), ahoraMs: AHORA, reunionMs: null }),
    { tipo: 'esperar', idx: 2, proximoMs: AHORA + HORA, via: ['k', 'e'], repartos: [{ destino: 'es', desdeMs: AHORA }] });
  // Lo que queda después de la condición incluye las flechas (el canal apagado lo pregunta), y el
  // primer mensaje de una flecha de la primera condición es «el primero» (el tope de antigüedad).
  assert.deepEqual(alcanzablesDesde(EJEMPLO, 0), [1, 2, 3, 4]);
  assert.equal(esPrimerPaso(EJEMPLO, 2), true);
});

test('una condición no «termina»: `repartosDe` no le devuelve las flechas de sus resultados', () => {
  // Si las devolviera, al lead le saldría lo del «Sí» y lo del «Si no».
  assert.deepEqual(repartosDe(EJEMPLO, 0), []);
  assert.deepEqual(repartosDe([msg('a', { paralelos: ['b'] }), msg('b')], 0), ['b'], 'las de una tarjeta, como siempre');
});

test('⚠️ los hilos que arrancan: la primera conversión del cursor, y el ÚLTIMO que cierra decide (en los dos órdenes)', () => {
  // La fila estaba en la condición (un cursor, `hilos` NULL). Resuelve por el «Sí»: el cursor pasa a
  // ser el hilo «p» en ws y arranca el hilo «es» — lo que escribe `escribir` con `nuevos`.
  const nuevos: Hilo[] = [{ h: 'es', nodo: 'es', proximo: iso(AHORA) }];
  const leido = { hilos: null, h: null, nodo: 'k', proximo_envio_at: iso(AHORA) };
  const plan = planDePosicion(EJEMPLO, leido, { paso_actual: 1, nodo_actual: 'ws' }, { nuevos });
  assert.equal(plan.modo, 'hilos');
  if (plan.modo !== 'hilos') return;
  assert.deepEqual(plan.hilos, [{ h: 'p', nodo: 'ws', proximo: iso(AHORA) }, { h: 'es', nodo: 'es', proximo: iso(AHORA) }]);
  assert.equal(plan.update.estado, 'activa');
  const hs = plan.hilos!;
  const cerrar = (hilos: readonly Hilo[], h: string, estado: 'completada' | 'cancelada') => {
    const p = planDePosicion(EJEMPLO, { hilos, h, nodo: hilos.find((x) => x.h === h)!.nodo, proximo_envio_at: iso(AHORA) }, { estado, proximo_envio_at: null });
    assert.equal(p.modo, 'hilos');
    return p as Extract<typeof p, { modo: 'hilos' }>;
  };
  // Orden A: termina el WhatsApp y después el email se cancela → la inscripción, cancelada.
  const a1 = cerrar(hs, 'p', 'completada');
  assert.equal(a1.update.estado, 'activa', 'cerró la inscripción con un hilo vivo');
  assert.equal(cerrar(a1.hilos!, 'es', 'cancelada').update.estado, 'cancelada');
  // Orden B: el email se cancela primero y después termina el WhatsApp → completada.
  const b1 = cerrar(hs, 'es', 'cancelada');
  assert.equal(b1.update.estado, 'activa');
  assert.equal(cerrar(b1.hilos!, 'p', 'completada').update.estado, 'completada');
  // Y el cierre de un email que no puede salir nunca (sin email), con hilos, es «completada» en
  // los dos órdenes: el mismo lead no termina distinto según qué hilo cierre último.
  const perm = estadoDeCierrePermanente(hs);
  assert.equal(perm, 'completada');
  assert.equal(cerrar(cerrar(hs, 'es', perm).hilos!, 'p', 'completada').update.estado, 'completada');
  assert.equal(cerrar(cerrar(hs, 'p', 'completada').hilos!, 'es', perm).update.estado, 'completada');
});

test('lo que guarda setSecuenciaPasos (la quinta puerta): las flechas de cada resultado viajan', () => {
  const c = camposDelFlujo({
    id: 'k', nodo: 'condicion', si_no: 'wn', paralelos_si_no: ['en', 'en', 'mal id!'],
    ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['es', 'es', '', 3] }],
  });
  assert.deepEqual(c.ramas![0].paralelos, ['es']);
  assert.deepEqual(c.paralelos_si_no, ['en']);
  // Una rama sin flechas no gana un campo, y fuera de una condición el «Si no» con flechas no viaja.
  assert.equal('paralelos' in camposDelFlujo({ id: 'k', nodo: 'condicion', ramas: [{ id: 'si', modo: 'todas', filas: [], siguiente: null }] }).ramas![0], false);
  assert.equal('paralelos_si_no' in camposDelFlujo({ id: 'm', paralelos_si_no: ['x'] }), false);
});

test('el lazo del motor: las flechas del resultado arrancan por la puerta, y un camino que termina con hilos no deja «cerró sin mandar»', () => {
  const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const NUTRI = sinComentarios(readFileSync(join(__dirname, '..', 'lib', 'nutricion.ts'), 'utf8').replace(/\r\n/g, '\n'));
  const ini = NUTRI.indexOf('if (esNodoDeControl(pasoLeido)) {');
  const fin = NUTRI.indexOf("if (r.tipo === 'esperar') {", ini);
  assert.ok(ini > 0 && fin > ini, 'no encontré el bloque de los nodos de control');
  const ctl = NUTRI.slice(ini, fin);
  assert.ok(ctl.length < 6000, `el recorte mide ${ctl.length}: está mirando otra cosa`);
  assert.match(ctl, /const nuevos = r\.tipo === 'faltan_hechos' \? \[\] : nuevosDe\(sec, r\.repartos, lead\);/);
  assert.match(ctl, /const cerroElFlujo = porCondicion && !nuevos\.length;/);
  assert.match(ctl, /await cerrar\(cerroElFlujo \? 'la condición cerró el flujo sin mandar nada' : r\.motivo, cerroElFlujo && esPrimerPaso\(sec\.pasos, idxLeido\)\);/);
  // El cierre de ESTE camino pasa los hilos que arrancan a la puerta (que hace el compare-and-set).
  assert.match(ctl, /escribir\(insc, \{ estado: 'completada', proximo_envio_at: null \}, \{ modo: 'cas', alcance, nuevos \}\)/);
});

// ── «Probar» ───────────────────────────────────────────────────────────────────

/** Corre la prueba como el panel: en una condición sigue sola por la PRIMERA rama (el «Sí»). */
function probar(pasos: PasoGrafo[], porSiNo = false): string[] {
  const vistos: string[] = [];
  let e: EstadoSim = iniciar(pasos);
  for (let k = 0; k < 100; k++) {
    const r = siguiente(pasos, e);
    e = r.estado;
    const ev: EventoSim | null = r.evento;
    if (!ev) break;
    if (ev.t === 'condicion') { e = elegir(e, (porSiNo ? ev.opciones[ev.opciones.length - 1] : ev.opciones[0]).puerto); continue; }
    vistos.push(ev.t === 'mensaje' ? `${ev.paso.canal === 'email' ? '✉' : '💬'}${ev.paso.id}` : ev.t === 'fin' ? `■${ev.texto}` : ev.t);
    if (ev.t === 'fin') break;
  }
  return vistos;
}

test('⚠️ «Probar» muestra las DOS flechas del resultado elegido (y nunca las del otro)', () => {
  assert.deepEqual(probar(EJEMPLO), ['💬ws', '✉es', '■Fin']);
  assert.deepEqual(probar(EJEMPLO, true), ['💬wn', '✉en', '■Fin']);
  // La opción trae sus flechas: las lee la MISMA función que el motor.
  const r = siguiente(EJEMPLO, iniciar(EJEMPLO));
  assert.equal(r.evento?.t, 'condicion');
  if (r.evento?.t !== 'condicion') return;
  assert.deepEqual(r.evento.opciones.map((o) => [o.puerto, o.paralelos ?? []]), [['si', ['es']], ['si_no', ['en']]]);
  // Adentro de «Si responde» no se reparte, como en el motor.
  const e = elegir({ ...r.estado, rama: 'respuesta' }, 'si');
  assert.deepEqual(e.hilos.map((h) => h.cursor), ['ws']);
});

// ── El lienzo ──────────────────────────────────────────────────────────────────

const nodo = (pasos: PasoGrafo[], id: string): NodoFlujo => {
  const n = grafoDeSecuencia(pasos as PasoParaGrafo[], { disparador: 'X' }).nodos.find((x) => x.id === id);
  assert.ok(n, `no está el nodo ${id}`);
  return n;
};

test('⚠️ el lienzo: cada fila de resultado ofrece el ＋ en paralelo, y sus flechas salen de ELLA, pegadas a su fila', () => {
  const g = grafoDeSecuencia(EJEMPLO as PasoParaGrafo[], { disparador: 'X' });
  const k = g.nodos.find((n) => n.id === 'k')!;
  assert.deepEqual(k.puertos!.map((p) => [p.id, p.vacio, p.paralelo ?? false]), [['si', false, true], ['si_no', false, true]]);
  // Las flechas en paralelo: punteadas, y con el resultado en el puerto (de qué fila salen).
  const a = (hasta: string) => g.aristas.find((x) => x.hasta === hasta)!;
  assert.deepEqual([a('es').puerto, a('es').tono], ['par:es@si', 'condicional']);
  assert.deepEqual([a('en').puerto, a('en').tono], ['par:en@si_no', 'condicional']);
  assert.deepEqual([a('ws').puerto, a('ws').tono], ['si', 'normal']);
  // Los hijos se apilan en el orden de los puertos: las del «Sí» antes que el «Si no».
  const y = (id: string) => g.nodos.find((n) => n.id === id)!.y;
  assert.ok(y('ws') < y('es') && y('es') < y('wn') && y('wn') < y('en'), 'las flechas de un resultado no quedaron pegadas a su fila');
  // El ＋ de la fila pide `par@<fila>`, y viaja tal cual hasta el modelo.
  assert.deepEqual(lugarDesdeLienzo('k', 'par@si_no'), { nodo: 'k', puerto: 'par@si_no' });
  assert.deepEqual(lugarDesdeLienzo('k', 'par:en@si_no'), { nodo: 'k', puerto: 'par:en@si_no' });
});

test('el ＋ de una fila de resultado inserta en ESA fila, y el del medio de su flecha queda en el medio', () => {
  const r = insertarDesdeLienzo(EJEMPLO as PasoParaGrafo[], 'k', 'par@si_no', 'email', () => 0.42);
  assert.ok(r.id);
  assert.deepEqual(nodoPorId(r.pasos, 'k')!.paralelos_si_no, ['en', r.id]);
  assert.equal(nodoPorId(r.pasos, r.id!)!.canal, 'email');
  assert.deepEqual(validarGrafo(r.pasos), []);
  const m = insertarDesdeLienzo(r.pasos, 'k', `par:${r.id}@si_no`, 'esperar', () => 0.17);
  assert.deepEqual(nodoPorId(m.pasos, 'k')!.paralelos_si_no, ['en', m.id]);
  assert.equal(nodoPorId(m.pasos, m.id!)!.siguiente, r.id);
  assert.deepEqual(validarGrafo(m.pasos), []);
});

test('⚠️ el ＋ en paralelo de una fila se ofrece SÓLO donde Publicar lo acepta (la misma regla, sobre el flujo hipotético)', () => {
  const hijos = (n: number, pre: string) => Array.from({ length: n }, (_, j) => msg(`${pre}${j}`));
  const fixtures: Record<string, PasoGrafo[]> = {
    ejemplo: EJEMPLO,
    'tope del resultado': [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['s0', 's1', 's2'] }], si_no: 'wn' }), msg('ws'), msg('wn'), ...hijos(3, 's')],
    // SEXTA TANDA: los dos resultados se excluyen, así que con 3 en el «Sí» el «Si no» todavía puede
    // sacar una más (hasta acá sumaban 1 + 3 + 2 = 6 y el lienzo no la ofrecía).
    'dos resultados se excluyen': [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['s0', 's1', 's2'] }], si_no: 'wn', paralelos_si_no: ['n0', 'n1'] }), msg('ws'), msg('wn'), ...hijos(3, 's'), ...hijos(2, 'n')],
    // El tope de caminos de verdad: en el «Si no» corren A LA VEZ sus 2 flechas y las 3 del WhatsApp.
    'tope de caminos': [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['s0', 's1', 's2'] }], si_no: 'wn', paralelos_si_no: ['n0', 'n1'] }), msg('ws'), msg('wn', { paralelos: ['y0', 'y1', 'y2'] }), ...hijos(3, 's'), ...hijos(2, 'n'), ...hijos(3, 'y')],
    'en «Si responde»': [msg('m'), msg('R', { nodo: 'respuesta', cuerpo: '', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'k' }], si_no: null }), cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'a' }], si_no: 'b' }), msg('a'), msg('b')],
    'en un bucle': [cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm1' }], si_no: 'b' }), msg('m1', { siguiente: 'e' }), esperar('e', 'j'), irA('j', 'k'), msg('b')],
    // Una regla que sólo ve el flujo HIPOTÉTICO (ningún chequeo explícito la mira): 60 tarjetas, el
    // tope. Una flecha más es una tarjeta más, y Publicar la rechazaría.
    'al tope de tarjetas': [
      cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws' }], si_no: 'wn' }),
      msg('ws', { siguiente: 'f0' }), msg('wn'),
      ...Array.from({ length: 57 }, (_, j) => msg(`f${j}`, { siguiente: j < 56 ? `f${j + 1}` : null })),
    ],
  };
  const esperado: Record<string, Array<[string, boolean]>> = {
    ejemplo: [['si', true], ['si_no', true]],
    'tope del resultado': [['si', false], ['si_no', true]],
    'dos resultados se excluyen': [['si', false], ['si_no', true]],
    'tope de caminos': [['si', false], ['si_no', false]],
    'en «Si responde»': [['si', false], ['si_no', false]],
    'en un bucle': [['si', false], ['si_no', false]],
    'al tope de tarjetas': [['si', false], ['si_no', false]],
  };
  for (const [nombre, pasos] of Object.entries(fixtures)) {
    assert.deepEqual(validarGrafo(pasos), [], `la base «${nombre}» tiene que poder publicarse`);
    const filas = nodo(pasos, 'k').puertos!.map((p) => [p.id, p.paralelo === true] as [string, boolean]);
    assert.deepEqual(filas, esperado[nombre], `«${nombre}»`);
    // Y la propiedad: ofrecido ⇔ el flujo con la flecha nueva se puede publicar.
    for (const [fila, ofrecido] of filas) {
      const r = insertarDesdeLienzo(pasos as PasoParaGrafo[], 'k', `par@${fila}`, 'mensaje', () => 0.33);
      const publicable = !!r.id && validarGrafo(r.pasos).length === 0;
      assert.equal(ofrecido, publicable, `«${nombre}», fila ${fila}: el lienzo ofrece ${ofrecido} y Publicar ${publicable ? 'acepta' : 'rechaza'}`);
    }
  }
});

test('⚠️ en un flujo que YA no se puede publicar, el ＋ tampoco se ofrece (un error repetido no se ve como nuevo)', () => {
  // El flujo hipotético se compara contra los errores de HOY: si el error que la flecha nueva
  // produciría ya está en la lista («corre como mucho 6 caminos», «"Si responde" no puede…»), no se
  // ve como nuevo. Por eso los topes, «Si responde» y el bucle se preguntan además a mano.
  const hijos = (n: number, pre: string) => Array.from({ length: n }, (_, j) => msg(`${pre}${j}`));
  const pasado: PasoGrafo[] = [
    msg('m', { siguiente: 'k', paralelos: ['p0', 'p1', 'p2'] }), ...hijos(3, 'p'),
    cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws', paralelos: ['s0', 's1', 's2'] }], si_no: 'wn' }),
    msg('ws'), msg('wn'), ...hijos(3, 's'),
  ];
  assert.ok(con(validarGrafo(pasado), `como mucho ${TOPE_HILOS} caminos`), 'la base tiene que estar YA pasada de caminos');
  assert.deepEqual(nodo(pasado, 'k').puertos!.map((p) => [p.id, p.paralelo === true]), [['si', false], ['si_no', false]]);
  const respYaMal: PasoGrafo[] = [
    msg('m'),
    msg('R', { nodo: 'respuesta', cuerpo: '', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'a0' }, { id: 'c2', titulo: 'Hora', cuando: 'pregunta la hora', siguiente: 'k' }], si_no: null }),
    msg('a0', { paralelos: ['a1'] }), msg('a1'),
    cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws' }], si_no: 'wn' }), msg('ws'), msg('wn'),
  ];
  assert.ok(con(validarGrafo(respYaMal), '«Si responde» no puede sacar flechas en paralelo'), 'la base tiene que estar YA mal en «Si responde»');
  assert.deepEqual(nodo(respYaMal, 'k').puertos!.map((p) => [p.id, p.paralelo === true]), [['si', false], ['si_no', false]]);
});

test('⚠️ lo que se ofrece se memoriza por la FORMA: tipear no lo recalcula, una flecha nueva sí', () => {
  // Medido el 09/10/2026: un `validarGrafo` hipotético por fila llevaba `grafoDeSecuencia` de 4,4 ms a
  // 75-110 ms (57 tarjetas, 19 condiciones), y corre en cada render del lienzo.
  const hoy = filasConParalelo(normalizar(EJEMPLO));
  assert.deepEqual([...hoy], [['k|si', true], ['k|si_no', true]]);
  const tecleado = normalizar(EJEMPLO.map((p) => (p.id === 'ws' ? { ...p, cuerpo: 'Hola, ¿cómo va?' } : p)));
  assert.equal(filasConParalelo(tecleado), hoy, 'cambiar el TEXTO de una tarjeta recalculó todo');
  // Dos flechas más en el «Sí» lo llevan al tope: la fila deja de ofrecer, aunque el texto sea igual.
  const lleno = normalizar([
    ...EJEMPLO.map((p) => (p.id === 'k' ? { ...p, ramas: [{ ...p.ramas![0], paralelos: ['es', 'x1', 'x2'] }] } : p)),
    msg('x1'), msg('x2'),
  ]);
  assert.deepEqual([...filasConParalelo(lleno)], [['k|si', false], ['k|si_no', true]], 'devolvió lo de la forma anterior');
  // Y mover flechas de una rama a otra (las mismas tarjetas, nada más cambia) también es otra forma.
  const dosRamas = (a: string[], b: string[]) => normalizar([
    cond('k', { ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'w1', paralelos: a }, { id: 'r2', modo: 'todas', filas: [{ campo: 'pago' }], siguiente: 'w2', paralelos: b }], si_no: 'wn' }),
    msg('w1'), msg('w2'), msg('wn'), msg('y1'), msg('y2'), msg('y3'),
  ]);
  assert.deepEqual([...filasConParalelo(dosRamas(['y1', 'y2', 'y3'], []))].slice(0, 2), [['k|r1', false], ['k|r2', true]]);
  assert.deepEqual([...filasConParalelo(dosRamas(['y1'], ['y2', 'y3']))].slice(0, 2), [['k|r1', true], ['k|r2', true]], 'la firma no vio que las flechas cambiaron de rama');
  // Lo mismo con las del «Si no»: sacarlas (las tarjetas quedan sueltas, y nada más cambia).
  const conSiNo = (par: string[]) => normalizar([
    cond('k', { ramas: [{ id: 'si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ws' }], si_no: 'wn', paralelos_si_no: par }),
    msg('ws'), msg('wn'), msg('y1'), msg('y2'), msg('y3'),
  ]);
  assert.equal(filasConParalelo(conSiNo(['y1', 'y2', 'y3'])).get('k|si_no'), false);
  assert.equal(filasConParalelo(conSiNo([])).get('k|si_no'), true, 'la firma no vio que el «Si no» perdió sus flechas');
});

// ⚠️ BLOQUEANTE de lib/lienzo-grafo.ts (no es de esta parte): `yDePuerto` todavía manda TODA flecha
// `par:` a la PRIMERA fila con `paralelo`, así que la del «Si no» sale de la fila del «Sí». Este test
// queda como `todo` hasta que se aplique la línea del bloqueante (ver el informe de la parte
// «flechas»); al aplicarla, se le saca el `todo`.
test('la flecha en paralelo de un resultado sale de la fila de ESE resultado (yDePuerto)', () => {
  const k = nodo(EJEMPLO, 'k');
  assert.equal(yDePuerto(k, 'par:en@si_no'), yDePuerto(k, 'si_no'));
  assert.equal(yDePuerto(k, 'par:es@si'), yDePuerto(k, 'si'));
});

// ── ROTURAS ────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO el 09/10/2026: un arnés aplica UNA rotura por vez, corre este archivo y los de
// los paralelos y el lienzo (flujo-grafo-paralelos, flujo-grafo, flujo-lienzo-paralelos,
// flujo-conversacion, lienzo-puertos, nutricion-hilos, simulador-hilos, simulador-grafo,
// flujo-motor-grafo, flujo-bucle-paralelos: 193 tests, 0 rojos con todo puesto) y restaura DE MEMORIA,
// nunca con git. Rojos por rotura:
//   B1  puertosDe sin los puertos de los resultados ................................ 8
//   B2  resolverControl no arranca los paralelos del resultado ..................... 1
//   B3  resolverControl arranca siempre los del «Si no» ............................ 1
//   B4  normalizar sin la promoción del resultado sin principal .................... 2
//   B5  normalizar sin sacar los ids colgados de un resultado ...................... 2
//   B6  normalizar sin sacar los ids colgados de una tarjeta ....................... 1
//   B7  validarGrafo sin revisar las listas de los resultados ...................... 3
//   B8  la regla de «Si responde» mira sólo las de la tarjeta ...................... 2
//   B9  repartenEnBucle mira sólo las de la tarjeta ................................ 2
//   B10 conectarPuerto ignora los resultados ....................................... 6
//   B11 insertarNodo sin el `par@<resultado>` ...................................... 1
//   B12 insertarNodo inserta aunque el puerto no exista ............................ 1
//   B13 borrarNodo sin promover el resultado ....................................... 1
//   B14 sanearRama sin las flechas (la quinta puerta) .............................. 1
//   B15 camposDelFlujo sin las del «Si no» ......................................... 1
//   B16 repartosDe devuelve las de una condición ................................... 1
//   B17 «Probar»: elegir no abre las flechas ....................................... 1
//   B18 «Probar»: la opción no trae sus flechas .................................... 1
//   B19 el lienzo no ofrece el ＋ en las filas ...................................... 2
//   B20 el lienzo sin el flujo hipotético .......................................... 1
//       (la primera corrida dio 0: las cuatro reglas que aplican también las preguntan los
//       chequeos a mano. Lo cazó sumar el tope de 60 tarjetas, que sólo ve el hipotético.)
//   B21 el lienzo sin los chequeos a mano (sólo el hipotético) ..................... 1
//       (también 0 la primera vez: hizo falta el flujo que YA está mal, donde el error repetido
//       no se ve como nuevo.)
//   B22 el lienzo sin contar los caminos ........................................... 1
//   B23 el motor deja «cerró sin mandar» con hilos arrancando ...................... 1
//   B24 el ＋ de la fila pide 'par' a secas (lo caza tests/lienzo-puertos.test.ts) ... 1
//   B25 conectarPuerto acepta `par@<resultado>` en una tarjeta ..................... 1
//   B26 normalizar deja `paralelos_si_no` fuera de una condición ................... 1
//   B27 leerPuertoParalelo sin el resultado ........................................ 7
//   M1  la memoria de lo ofrecido sin las flechas de las ramas en su firma ......... 1 (0 la primera vez)
//   M2  la memoria no mira la firma ................................................ 3
//   M3  sin memoria (recalcula en cada render) ..................................... 1
//   M4  la firma sin las del «Si no» ............................................... 1 (0 la primera vez)
// Y al revés, APLICANDO el bloqueante de `yDePuerto`: el `todo` de arriba pasa y no cae ningún otro
// de los del lienzo (64 tests).
