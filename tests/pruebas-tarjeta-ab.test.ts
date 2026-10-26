// =============================================================================
// La tarjeta «A/B TEST» con TODAS sus puertas (tanda A3 de las pruebas A/B, 25/10/2026)
// =============================================================================
// El Cerebro (25/10): «A3. La clase `ab` con TODAS sus puertas en un commit. Es transparente para `condicionDeArriba`,
// `minutosAntesDeReunion` y las reglas de forma (si no, un recordatorio pierde su guarda). Lleva `esBifurcacion()` y la lista
// de los ~70 `=== 'condicion'` revisados. Sin prueba corriendo, todo va a A». La lista revisada está en
// docs/hallazgos-chatbot.md («La tarjeta «A/B TEST»: las puertas»). Lo que fija este test, puerta por puerta:
//   · el MODELO: la clase, sus puertos (la letra), sin `siguiente`, ramas que se excluyen (dos que se juntan no «chocan»),
//     lo que no se publica (suma, letras, de a 5, 10 o más, una por automatización, nunca en «Si responde») y la quinta
//     puerta (`camposDelFlujo` y `normalizar` no la dejan sin ramas);
//   · el MOTOR: sin la rama del lead pide `falta_rama_ab`, con ella sigue por ahí (una letra que ya no está: la A), y es
//     TRANSPARENTE para la condición de arriba, el ancla de la reunión, el carril y «Contestó»;
//   · la FORMA: CONDITION → A/B → CONDITION son dos pegadas;
//   · «PROBAR»: la tarjeta da a elegir, el escenario por rama, y sin escenario la A;
//   · el LIENZO: se crea en una flecha con la B copiando lo que se prueba y juntándose después; una por automatización y
//     nunca en «Si responde»; quitar una rama no se lleva lo compartido; borrar la tarjeta es quedarse con A;
//   · copiar y pegar: las flechas de las ramas (y de los botones) se rehacen; un evento de MaKo la rechaza;
//   · la IA: la lee, la arma con su regla sólo si el pedido habla de una prueba A/B;
//   · la API y la firma de cada rama (lo que abre una época nueva).
// Correr: node --import tsx --test tests/pruebas-tarjeta-ab.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada): ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  claseDe, esBifurcacion, puertosDe, siguienteDe, validarGrafo, validarParaGuardar, cruces, normalizar, conectarPuerto, borrarNodo,
  indicePorId, nodoPorId, type PasoGrafo,
} from '../lib/flujo-grafo';
import {
  resolverControl, condicionDeArriba, condicionSigueLlevando, minutosAntesDeReunion, necesitaHechos, esHiloDelCarril, camposDelFlujo,
  esLineal, esNodoDeControl, ramaDeQuienContesto,
} from '../lib/nutricion-grafo-motor';
import { problemasDeForma } from '../lib/flujo-forma';
import { iniciar, siguiente, escenariosDePrueba, elegirComoLead } from '../lib/simulador-grafo';
import { opcionesDelMas, opcionesSueltas, insertarDesdeLienzo, quitarRamaAB, agregarRamaAB, repartirPcts, grafoDeSecuencia, ID_ENTRADA } from '../lib/flujo-conversacion';
import { pegarTarjetas, copiaDeTarjetas } from '../lib/flujo-copia';
import { aIA, deIA, deIAEdicion, userDeCrear, PRUEBA_AB_IA, disparadoresParaIA, LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
import { opcionesCronIA } from '../lib/disparadores';
import { catalogosDe, etapasDeCondicion } from '../lib/condiciones-catalogos';
import { porId } from '../lib/api-mako/registro';
import { cambiosDeLaPrueba, firmaDeRama, ramasParaLaPrueba, tarjetaABDe, metricaDeLaAutomatizacion } from '../lib/pruebas/tarjeta-ab';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const msg = (id: string, siguiente: string | null, cuerpo = id): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo, siguiente } as PasoGrafo);
const AB = (a: string | null, b: string | null, extra: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ id: 'ab', nodo: 'ab', ramas_ab: [{ clave: 'A', pct: 50, siguiente: a, nombre: 'Sin cambio' }, { clave: 'B', pct: 50, siguiente: b, nombre: 'Con audio' }], ...extra } as PasoGrafo);
/** m1 → A/B → (A: m2a | B: m2b) → m3: las ramas se juntan en m3. */
const F: PasoGrafo[] = [msg('m1', 'ab'), AB('m2a', 'm2b'), msg('m2a', 'm3'), msg('m2b', 'm3', 'Con audio'), msg('m3', null)];

// ── El modelo ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('el modelo: la clase, sus puertos (la letra), sin siguiente, y dos ramas que se juntan no «chocan»', () => {
  const ab = nodoPorId(F, 'ab')!;
  assert.equal(claseDe(ab), 'ab');
  assert.ok(esBifurcacion(ab) && esBifurcacion(nodoPorId([{ id: 'c', nodo: 'condicion', ramas: [] } as PasoGrafo], 'c')) && !esBifurcacion(nodoPorId(F, 'm1')));
  assert.deepEqual(puertosDe(F, indicePorId(F, 'ab')), [{ puerto: 'A', destino: 'm2a' }, { puerto: 'B', destino: 'm2b' }]);
  assert.equal(siguienteDe(F, indicePorId(F, 'ab')), null, 'una prueba no tiene «siguiente»: sin esto seguía al de abajo del array');
  assert.deepEqual(validarGrafo(F), []);
  assert.deepEqual(cruces(F), [], 'A y B se excluyen: juntarse en m3 no le manda dos veces');
  // Con una flecha en paralelo en la A que cae donde sigue la B: a un lead le toca UNA rama, así que no choca (sin el
  // contexto de la prueba, `cruces` frenaba Publicar por un mensaje doble que no existe).
  const conPar = [msg('m1', 'ab'), AB('ma', 'x'), { ...msg('ma', null), paralelos: ['x'] } as PasoGrafo, msg('x', null)];
  assert.deepEqual(cruces(conPar), []);
  assert.equal(esLineal(F), false);
  assert.equal(esNodoDeControl(ab), true);
  const con = conectarPuerto(F, 'ab', 'B', 'm3');
  assert.equal(nodoPorId(con, 'ab')!.ramas_ab![1].siguiente, 'm3', 'la fila B no se conecta');
});

test('lo que no se publica: la suma, las letras, de a 5, 10 o más, una por automatización, nunca en «Si responde»', () => {
  const con = (ab: PasoGrafo, resto: PasoGrafo[] = F.filter((p) => p.id !== 'ab')) => [resto[0], ab, ...resto.slice(1)];
  const err = (ab: Partial<PasoGrafo>) => validarGrafo(con({ ...AB('m2a', 'm2b'), ...ab } as PasoGrafo)).join(' | ');
  assert.match(err({ ramas_ab: [{ clave: 'A', pct: 60, siguiente: 'm2a' }, { clave: 'B', pct: 50, siguiente: 'm2b' }] }), /suman 110: tienen que sumar 100/);
  assert.match(err({ ramas_ab: [{ clave: 'A', pct: 93, siguiente: 'm2a' }, { clave: 'B', pct: 7, siguiente: 'm2b' }] }), /10 % o más/);
  assert.match(err({ ramas_ab: [{ clave: 'A', pct: 52, siguiente: 'm2a' }, { clave: 'B', pct: 48, siguiente: 'm2b' }] }), /van de a 5/);
  assert.match(err({ ramas_ab: [{ clave: 'A', pct: 50, siguiente: 'm2a' }, { clave: 'C', pct: 50, siguiente: 'm2b' }] }), /letras A, B, C y D en orden/);
  assert.match(err({ ramas_ab: [{ clave: 'A', pct: 100, siguiente: 'm2a' }] }), /al menos 2 ramas/);
  // Las letras y el tope rompen el DATO: tampoco se guarda un borrador.
  assert.match(validarParaGuardar(con({ ...AB('m2a', 'm2b'), ramas_ab: [{ clave: 'B', pct: 50, siguiente: 'm2a' }, { clave: 'A', pct: 50, siguiente: 'm2b' }] } as PasoGrafo)).join(' '), /en orden/);
  const dos = [msg('m1', 'ab'), AB('m2a', 'ab2'), { ...AB('m2b', 'm3'), id: 'ab2' } as PasoGrafo, msg('m2a', 'm3'), msg('m2b', 'm3'), msg('m3', null)];
  assert.match(validarParaGuardar(dos).join(' '), /UNA prueba A\/B \(tiene 2: ab, ab2\)/);
  const enRespuesta = [msg('m1', null), { id: 'r', nodo: 'respuesta', casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'ab' }], si_no: null } as PasoGrafo, AB('m2a', 'm2b'), msg('m2a', null), msg('m2b', null)];
  assert.match(validarGrafo(enRespuesta).join(' '), /la prueba A\/B ab cuelga de «Si responde»: va en la salida/);
});

test('la quinta puerta: guardar no la deja sin ramas (camposDelFlujo y normalizar), y sanea letra y porcentaje', () => {
  const c = camposDelFlujo({ id: 'ab', nodo: 'ab', ramas_ab: [{ clave: 'A', pct: '50', siguiente: 'm2a', nombre: '  Sin cambio  ' }, { clave: 'Z', pct: 50, siguiente: 'x' }, { clave: 'B', pct: 150.4, siguiente: 'm2b' }] });
  assert.equal(c.nodo, 'ab');
  assert.deepEqual(c.ramas_ab, [{ clave: 'A', pct: 50, siguiente: 'm2a', nombre: 'Sin cambio' }, { clave: 'B', pct: 100, siguiente: 'm2b' }]);
  const n = normalizar(F);
  assert.deepEqual(nodoPorId(n, 'ab')!.ramas_ab, nodoPorId(F, 'ab')!.ramas_ab);
  assert.equal('siguiente' in nodoPorId(n, 'ab')!, false);
  // En otra clase el campo no significa nada y se va.
  assert.equal('ramas_ab' in nodoPorId(normalizar([{ ...msg('x', null), ramas_ab: [] } as PasoGrafo]), 'x')!, false);
});

// ── El motor ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const ctx0 = { hechos: null, ahoraMs: Date.parse('2026-11-01T12:00:00Z'), reunionMs: null };
test('el motor: sin la rama pide falta_rama_ab; con ella sigue por ahí; una letra que ya no está va a la A', () => {
  const i = indicePorId(F, 'ab');
  assert.deepEqual(resolverControl(F, i, ctx0), { tipo: 'falta_rama_ab', nodo: 'ab' });
  const b = resolverControl(F, i, { ...ctx0, ramasAB: { ab: 'B' } });
  assert.ok(b.tipo === 'nodo' && F[b.idx].id === 'm2b');
  const z = resolverControl(F, i, { ...ctx0, ramasAB: { ab: 'D' } });
  assert.ok(z.tipo === 'nodo' && F[z.idx].id === 'm2a', 'una letra que la tarjeta no tiene: la A');
  const sinB = [msg('m1', 'ab'), AB('m2a', null), msg('m2a', null)];
  const fin = resolverControl(sinB, 1, { ...ctx0, ramasAB: { ab: 'B' } });
  assert.ok(fin.tipo === 'fin' && /la rama B de la prueba A\/B termina aquí/.test(fin.motivo));
  // Detrás de cualquier rama puede haber una condición: hay que leer los hechos.
  const conCond = [AB('c', 'm2b'), { id: 'c', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm2b' }], si_no: null } as PasoGrafo, msg('m2b', null)];
  assert.equal(necesitaHechos(conCond, 0), true);
});

test('el motor: TRANSPARENTE para la condición de arriba, el ancla de la reunión, el carril y «Contestó»', () => {
  // «Su reunión sigue en pie» → A/B → «Mañana es tu reunión»: la guarda sigue siendo la condición.
  const R = [
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'reunion_en_pie' }], siguiente: 'ab' }], si_no: null } as PasoGrafo,
    AB('m', 'mb'), msg('m', null, 'Mañana es tu reunión'), msg('mb', null),
  ];
  assert.equal(condicionDeArriba(R, indicePorId(R, 'm')), 0, 'el recordatorio perdió su guarda');
  assert.equal(condicionDeArriba(R, indicePorId(R, 'mb')), 0);
  // Antes de mandar, la condición se vuelve a mirar POR la tarjeta A/B: «Agendó» → A/B → mensaje. Con la agenda, sigue
  // llevando al mensaje (por cualquier rama); sin ella, no (sale por el «Si no», que termina).
  const G = [
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ab' }], si_no: null } as PasoGrafo,
    AB('m', 'mb'), msg('m', null), msg('mb', null),
  ];
  const hechos = (agendo: boolean) => ({ etiquetas: new Set<number>(), etapa: null, agendo, pago: false, yaContactado: false } as never);
  assert.equal(condicionDeArriba(G, indicePorId(G, 'mb')), 0);
  assert.equal(condicionSigueLlevando(G, 0, indicePorId(G, 'mb'), hechos(true)), true, 'por la tarjeta A/B la condición dejó de llevar al mensaje');
  assert.equal(condicionSigueLlevando(G, 0, indicePorId(G, 'mb'), hechos(false)), false, 'sin la agenda el mensaje salía igual');
  const E = [{ id: 'e', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 60 }, siguiente: 'ab' } as PasoGrafo, AB('m', 'mb'), msg('m', null), msg('mb', null)];
  assert.equal(minutosAntesDeReunion(E, indicePorId(E, 'm')), 60, 'el mensaje dejó de ser un recordatorio');
  assert.equal(esHiloDelCarril(E, indicePorId(E, 'ab')), true, 'la prueba bajo un DELAY de la reunión salió del carril');
  // Lo de quien CONTESTÓ: las dos ramas.
  const C = [
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'ab' }], si_no: null } as PasoGrafo,
    AB('m', 'mb'), msg('m', null), msg('mb', null),
  ];
  const q = ramaDeQuienContesto(C);
  assert.ok(q.has('m') && q.has('mb'), 'un mensaje detrás de la prueba se cortaba al contestar');
});

test('la forma: CONDITION → A/B → CONDITION son dos pegadas (la prueba no le hace nada al lead)', () => {
  const P = [
    { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ab' }], si_no: null } as PasoGrafo,
    AB('c2', 'm'), { id: 'c2', nodo: 'condicion', ramas: [{ id: 'r2', modo: 'todas', filas: [{ campo: 'pago' }], siguiente: 'm' }], si_no: null } as PasoGrafo, msg('m', null),
  ];
  assert.ok(problemasDeForma(P).some((x) => x.regla === 'condicion_pegada' && x.tarjeta === 'c2'));
});

// ── «Probar» ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('«Probar»: la tarjeta da a elegir; un escenario por rama; sin escenario, la A', () => {
  let st = iniciar(F);
  let ev = siguiente(F, st);
  for (let k = 0; k < 6 && ev.evento?.t !== 'ab'; k++) { st = ev.estado; ev = siguiente(F, st); }
  assert.ok(ev.evento?.t === 'ab', 'la prueba no frenó a elegir');
  assert.deepEqual(ev.evento.t === 'ab' && ev.evento.opciones.map((o) => [o.puerto, o.texto]), [['A', 'A · 50 % — Sin cambio'], ['B', 'B · 50 % — Con audio']]);
  const elegida = elegirComoLead(F, ev.estado, {} as never);
  assert.equal(elegida.opcion?.puerto, 'A', 'sin escenario, la A');
  const { escenarios } = escenariosDePrueba(F);
  assert.deepEqual(escenarios.map((e) => e.elecciones.ab), ['A', 'B']);
  assert.ok(escenarios[1].cuando.includes('Le toca B · 50 % — Con audio'), JSON.stringify(escenarios[1].cuando));
});

// ── El lienzo ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('el lienzo: en una flecha, A es lo que seguía y la B copia lo que se prueba y se junta después', () => {
  const L = [msg('m1', 'm2'), msg('m2', 'm3', 'El mensaje que pruebo'), msg('m3', null)];
  let k = 0;
  const r = insertarDesdeLienzo(L, 'm1', 'sig', 'ab', () => ((k++ * 0.37) % 1));
  assert.ok(r.id);
  const ab = nodoPorId(r.pasos, r.id!)!;
  assert.equal(nodoPorId(r.pasos, 'm1')!.siguiente, r.id);
  const [a, b] = ab.ramas_ab!;
  assert.equal(a.siguiente, 'm2', 'la A es el camino de antes');
  const copia = nodoPorId(r.pasos, b.siguiente)!;
  assert.ok(copia && copia.id !== 'm2' && copia.cuerpo === 'El mensaje que pruebo' && copia.siguiente === 'm3', 'la B no copió lo que se prueba o no se juntó en m3');
  assert.deepEqual(validarGrafo(r.pasos), []);
  // Una por automatización, y nunca debajo de «Si responde».
  assert.ok(!opcionesDelMas(r.pasos, 'm3', false).some((o) => o.value === 'ab'));
  assert.ok(!opcionesSueltas(r.pasos).some((o) => o.value === 'ab'));
  assert.equal(insertarDesdeLienzo(r.pasos, 'm3', 'sig', 'ab').id, null);
  assert.ok(opcionesDelMas(L, 'm1', false).some((o) => o.value === 'ab' && o.label === 'Prueba A/B' && o.icono?.startsWith('data:image/svg+xml')));
  // La tarjeta dibujada: una fila por rama, y arriba lo que dice la prueba.
  const g = grafoDeSecuencia(F, { disparador: 'Llega' });
  const t = g.nodos.find((n) => n.id === 'ab')!;
  assert.equal(t.tipo, 'ab');
  assert.deepEqual(t.puertos?.map((p) => p.rotulo), ['A · 50 % — Sin cambio', 'B · 50 % — Con audio']);
  assert.equal(t.detalle, 'Sin prueba: todos van a A.');
  const conDatos = grafoDeSecuencia(F, { disparador: 'Llega', pruebaAB: { texto: 'Midiendo · día 3 de 60 · A 4 / B 5', filas: { B: 'B · 50 % — 5 entraron' } } });
  assert.equal(conDatos.nodos.find((n) => n.id === 'ab')!.puertos?.[1].rotulo, 'B · 50 % — 5 entraron');
  void ID_ENTRADA;
});

test('el lienzo: quitar una rama no se lleva lo compartido; sumar reparte; borrar la tarjeta es quedarse con A', () => {
  const con3 = agregarRamaAB(F, 'ab');
  assert.deepEqual(nodoPorId(con3, 'ab')!.ramas_ab!.map((r) => [r.clave, r.pct]), [['A', 40], ['B', 30], ['C', 30]]);
  assert.deepEqual(repartirPcts([{ clave: 'A', pct: 0, siguiente: null }, { clave: 'B', pct: 0, siguiente: null }, { clave: 'C', pct: 0, siguiente: null }, { clave: 'D', pct: 0, siguiente: null }]).map((r) => r.pct), [25, 25, 25, 25]);
  // Con tres ramas (A, B, C), quitar la B: se va lo que era SÓLO de B, se queda lo compartido, y la C pasa a ser la B.
  const F3 = [msg('m1', 'ab'), { ...AB('m2a', 'm2b'), ramas_ab: [{ clave: 'A', pct: 40, siguiente: 'm2a' }, { clave: 'B', pct: 30, siguiente: 'm2b' }, { clave: 'C', pct: 30, siguiente: 'm2c' }] } as PasoGrafo,
    msg('m2a', 'm3'), msg('m2b', 'm3'), msg('m2c', 'm3'), msg('m3', null)];
  const sinB = quitarRamaAB(F3, 'ab', 'B');
  assert.equal(nodoPorId(sinB, 'm2b'), null, 'lo que era sólo de B se queda colgado');
  assert.ok(nodoPorId(sinB, 'm3'), 'quitar B se llevó lo compartido (m3)');
  assert.deepEqual(nodoPorId(sinB, 'ab')!.ramas_ab!.map((r) => [r.clave, r.pct, r.siguiente]), [['A', 50, 'm2a'], ['B', 50, 'm2c']]);
  assert.deepEqual(validarGrafo(sinB), []);
  assert.equal(quitarRamaAB(F3, 'ab', 'A').length, F3.length, 'la A no se quita');
  // Con lo de B PRIMERO en la lista: las raíces se miran ANTES de soltarla (después, la suelta sería la primera raíz).
  const F3b = [F3[3], ...F3.filter((p) => p.id !== 'm2b')];
  assert.equal(nodoPorId(quitarRamaAB(F3b, 'ab', 'B'), 'm2b'), null, 'con lo de B primero en la lista, quedó colgado');
  assert.equal(quitarRamaAB(F, 'ab', 'B').length, F.length, 'con dos ramas no se quita ninguna');
  const borrada = borrarNodo(F, 'ab');
  assert.equal(nodoPorId(borrada, 'm1')!.siguiente, 'm2a', 'borrar la prueba no se quedó con A');
  assert.equal(nodoPorId(borrada, 'm2b'), null);
  assert.ok(nodoPorId(borrada, 'm3'));
});

test('copiar y pegar: las flechas de las ramas (y de los botones) se rehacen; una segunda prueba no entra', () => {
  const copia = copiaDeTarjetas(F as never, ['ab', 'm2a', 'm2b'])!;
  let k = 0;
  const L = [msg('x1', null)];
  const p = pegarTarjetas(L, copia, () => ((k++ * 0.29) % 1));
  const ab = p.pasos.find((q) => claseDe(q) === 'ab')!;
  assert.deepEqual(ab.ramas_ab!.map((r) => r.siguiente), [p.mapa.get('m2a'), p.mapa.get('m2b')], 'las ramas pegadas apuntan a las tarjetas del original');
  const conBoton = [{ ...msg('i1', null), canal: 'instagram', botones: [{ id: 'b1', titulo: 'Obtener', siguiente: 'i2' }] } as PasoGrafo, { ...msg('i2', null), canal: 'instagram' } as PasoGrafo];
  const pb = pegarTarjetas(L, copiaDeTarjetas(conBoton as never, ['i1', 'i2'])!, () => ((k++ * 0.29) % 1));
  const b = pb.pasos.find((q) => q.id === pb.mapa.get('i1'))!;
  assert.equal(b.botones![0].siguiente, pb.mapa.get('i2'), 'el botón pegado apunta a la tarjeta del original');
  const otra = pegarTarjetas(F, copia, () => ((k++ * 0.29) % 1));
  assert.equal(otra.pasos.filter((q) => claseDe(q) === 'ab').length, 1, 'se pegó una segunda prueba');
  assert.match(leer('lib/aviso-evento.ts'), /if \(clase === 'ab'\) return mal\(MOTIVO_EVENTO\.ab, id\);/, 'un evento de MaKo no la rechaza');
});

// ── La IA ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PRODUCTOS = [{ funnelId: 2, productoId: 10, nombre: 'Fiesta Music', esDefault: true, etapas: [{ value: 'nuevo', label: 'Lead entrante' }], etapasEntrega: [] }];
const ctxIA = (pedido: string): CtxIA => ({
  etiquetas: [], productos: PRODUCTOS,
  disparadores: disparadoresParaIA(opcionesCronIA({ productos: PRODUCTOS, etiquetas: [], conectados: { instagram: false, messenger: false, email: false, pagos: false } })),
  audios: [], archivos: [], acciones: LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; }),
  links: {}, catalogoCondicion: catalogosDe({ etapas: etapasDeCondicion(PRODUCTOS), productos: PRODUCTOS, remotos: null }), pedido, perfil: 'Fiesta Music.',
});
test('la IA: la lee, la arma, y su regla va sólo si el pedido habla de una prueba A/B', () => {
  const leida = aIA(F).tarjetas.find((t) => t.tipo === 'prueba_ab');
  assert.deepEqual(leida, { id: 'ab', tipo: 'prueba_ab', ramas: [{ letra: 'A', pct: 50, nombre: 'Sin cambio', sigue: 'm2a' }, { letra: 'B', pct: 50, nombre: 'Con audio', sigue: 'm2b' }] });
  const c = ctxIA('Quiero una prueba A/B: la mitad recibe un audio y la otra mitad un texto');
  let k = 0;
  const r = deIA({ disparador: 'd1', inicio: 't0', tarjetas: [
    { id: 't0', tipo: 'mensaje', texto: 'Hola {{nombre}}', sigue: 'tab' },
    { id: 'tab', tipo: 'prueba_ab', ramas: [{ pct: 50, sigue: 't1' }, { pct: 40, nombre: 'Con audio', sigue: 't2' }] },
    { id: 't1', tipo: 'mensaje', texto: 'Te cuento por texto', sigue: 't3' },
    { id: 't2', tipo: 'mensaje', texto: 'Te cuento con otro texto', sigue: 't3' },
    { id: 't3', tipo: 'mensaje', texto: 'Cualquier duda, escríbeme' },
  ] }, c, () => ((k++ * 0.31) % 1));
  const ab = r.pasos.find((p) => claseDe(p) === 'ab')!;
  assert.ok(ab, 'la IA no armó la prueba');
  assert.deepEqual(ab.ramas_ab!.map((x) => [x.clave, x.pct, x.nombre ?? null]), [['A', 50, 'Sin cambio'], ['B', 50, 'Con audio']], 'los porcentajes que no suman 100 se reparten parejo');
  assert.deepEqual(validarGrafo(r.pasos), []);
  assert.ok(userDeCrear(c, { perfil: 'Fiesta Music', voz: null, pedido: c.pedido! }).includes(PRUEBA_AB_IA));
  const normal = ctxIA('Cuando llega un lead, mandale un WhatsApp de bienvenida');
  assert.ok(!userDeCrear(normal, { perfil: 'Fiesta Music', voz: null, pedido: normal.pedido! }).includes(PRUEBA_AB_IA), 'la regla pesa en el presupuesto de Groq: sólo si se pide');
  // Editar con IA: un mensaje no se vuelve prueba A/B (se quita y se agrega otra). Sin `prueba_ab` en CLASE_DE_TIPO (lib/flujo-ia.ts,
  // lo cazó el tsc acotado el 25/10) el cambio se ignoraba en silencio.
  const aMensaje = deIAEdicion({ cambiar: [{ id: 'm2a', tipo: 'prueba_ab' }] }, F, ctxIA('cambia el mensaje por una prueba A/B'), () => 0.5);
  assert.ok(aMensaje.avisos.includes('Esa tarjeta no cambia de tipo: quítala y agrega otra'), JSON.stringify(aMensaje.avisos));
});

// ── La API y la firma de cada rama ───────────────────────────────────────────────────────────────────────────────────
test('la API: ver, empezar (de pantalla) y detener, por HTTP, con su ruta; la ficha dice las ramas', () => {
  const ver = porId('ver_prueba_ab')!;
  const empezar = porId('empezar_prueba_ab')! as { confirmacion?: string; canales: readonly string[] };
  const detener = porId('detener_prueba_ab')! as { confirmacion?: string; canales: readonly string[] };
  assert.ok(ver.canales.includes('http') && empezar.canales.includes('http') && detener.canales.includes('http'));
  assert.equal(empezar.confirmacion, 'pantalla');
  assert.equal(detener.confirmacion, 'chat');
  const rest = leer('lib/api-mako/rest.ts');
  for (const r of ["['GET', '/chatbot/secuencias/{secuenciaId}/prueba-ab', 'ver_prueba_ab']", "['POST', '/chatbot/secuencias/{secuenciaId}/prueba-ab', 'empezar_prueba_ab']", "['DELETE', '/chatbot/secuencias/{secuenciaId}/prueba-ab', 'detener_prueba_ab']"]) assert.ok(rest.includes(r), r);
  const snap = leer('tests/api-mako-http.snapshot.txt').split('\n');
  for (const id of ['ver_prueba_ab', 'empezar_prueba_ab', 'detener_prueba_ab']) assert.ok(snap.includes(id), `${id} no está en el snapshot`);
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /\.\.\.\(p\.nodo === 'ab' \? \{ ramas_ab: \(p\.ramas_ab \?\? \[\]\)\.map\(\(r\) => \(\{ letra: r\.clave, pct: r\.pct, nombre: r\.nombre \?\? null, sigue: r\.siguiente \?\? null \}\)\) \} : \{\}\),/);
});

test('la firma de cada rama: cambia con lo SUYO, no con lo compartido; y lo que hace con la prueba que corre', () => {
  const guardadas = ramasParaLaPrueba(F, 'ab');
  assert.equal(tarjetaABDe(F), 'ab');
  const tocoB = F.map((p) => (p.id === 'm2b' ? { ...p, cuerpo: 'Otro audio' } : p));
  const tocoCola = F.map((p) => (p.id === 'm3' ? { ...p, cuerpo: 'Otro cierre' } : p));
  const a0 = guardadas.find((r) => r.clave === 'A')!.firma;
  const b0 = guardadas.find((r) => r.clave === 'B')!.firma;
  assert.notEqual(firmaDeRama(tocoB, 'ab', nodoPorId(tocoB, 'ab')!.ramas_ab![1]), b0, 'cambiar lo de B no cambió su firma');
  assert.equal(firmaDeRama(tocoB, 'ab', nodoPorId(tocoB, 'ab')!.ramas_ab![0]), a0, 'cambiar B cambió la de A');
  assert.equal(firmaDeRama(tocoCola, 'ab', nodoPorId(tocoCola, 'ab')!.ramas_ab![1]), b0, 'lo compartido (m3) no es de ninguna rama');
  assert.deepEqual(cambiosDeLaPrueba(F, 'ab', guardadas), { que: 'nada' });
  const e = cambiosDeLaPrueba(tocoB, 'ab', guardadas);
  assert.ok(e.que === 'epoca' && e.porque === 'Cambiaste B.');
  const pct = F.map((p) => (p.id === 'ab' ? { ...p, ramas_ab: [{ ...p.ramas_ab![0], pct: 70 }, { ...p.ramas_ab![1], pct: 30 }] } : p));
  assert.equal(cambiosDeLaPrueba(pct, 'ab', guardadas).que, 'epoca', 'cambiar el porcentaje no abrió una época');
  assert.equal(cambiosDeLaPrueba(F.filter((p) => p.id !== 'ab'), 'ab', guardadas).que, 'detener');
  assert.equal(cambiosDeLaPrueba(agregarRamaAB(F, 'ab'), 'ab', guardadas).que, 'detener', 'sumar una rama no la detuvo');
  assert.equal(metricaDeLaAutomatizacion({ desenlace: { logrado: 'agendo' } }), 'agendo');
  assert.equal(metricaDeLaAutomatizacion({ desenlace: { logrado: 'pago' } }), 'respondio', '«pagó» no decide');
});

test('el motor real: la rama se lee y se escribe al llegar a la tarjeta, y guardar revisa la prueba que corre', () => {
  const n = leer('lib/nutricion.ts');
  assert.match(n, /for \(let k = 0; r\.tipo === 'falta_rama_ab' && k < MAX_RAMAS_AB; k\+\+\) \{\n\s+const clave = wsCorrida != null \? await ramaABDe\(wsCorrida, sec\.id, r\.nodo, insc\.lead_id, \(lead \?\? null\) as Record<string, unknown> \| null\) : RAMA_SIN_PRUEBA;/);
  assert.match(n, /if \(error\) throw new Error\(`setSecuenciaPasos: \$\{error\.message\}`\);\n[\s\S]{0,400}await revisarLaPruebaAlGuardar\(id, grafo as unknown as PasoGrafo\[\]\);\n\}/);
  const auto = leer('lib/pruebas/automatizacion.ts');
  assert.match(auto, /if \(!p \|\| p\.superficie !== 'automatizacion' \|\| String\(p\.lugar\.nodo_id \?\? ''\) !== nodoId\) return RAMA_SIN_PRUEBA;/, 'sin prueba de ESA tarjeta, la A');
  assert.match(auto, /\} catch \(e\) \{\n\s+console\.error\(`\[pruebas\] la rama A\/B[^\n]+\n\s+return RAMA_SIN_PRUEBA;/, 'ante un error, la A');
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-a3.cjs`, una por vez y restaurada; base 14 / 0). En rojo las 38:
//   el modelo: claseDe sin «ab» (2 / 12) · siguienteDe sin ella · los puertos (9 / 5) · los cruces sin el contexto de la
//   prueba · sin la suma · dos pruebas · una en «Si responde» · normalizar se lleva las ramas (10 / 4) · borrar no se queda
//   con A · conectar sin la letra;
//   el motor: se la traga como un «Ir a» · la condición de arriba no la atraviesa · condicionSigueLlevando tampoco · el
//   ancla de la reunión tampoco · el carril sin ella · «Contestó» corta detrás · necesitaHechos se para · la quinta puerta
//   (NODOS sin «ab») · la forma no la atraviesa;
//   «Probar»: sin la tarjeta · los escenarios sin ella · sin escenario no es la A;
//   el lienzo: la B no copia lo que se prueba · el ＋ ofrece una segunda · quitar una rama con las raíces nuevas;
//   copiar: sin rehacer las ramas · sin rehacer los botones · pegar una segunda;
//   la IA: no la lee · no reparte los porcentajes · la regla va siempre · Editar con IA sin `prueba_ab` en CLASE_DE_TIPO
//   (sumada el 25/10 cuando la cazó el tsc acotado: el cambio de tipo se ignoraba en silencio);
//   la API sin http · la firma con lo compartido · sumar una rama no la detiene · el motor no pide la rama · guardar no revisa
//   la prueba · sin prueba de ESA tarjeta no va a la A. Cada una 13 / 1 salvo las marcadas.
// ⚠️ Las dos primeras corridas dejaron VERDES «los cruces» y «quitar con las raíces nuevas»: los casos no las ejercitaban
// (una flecha en paralelo de la A que cae donde sigue la B; lo de B primero en la lista). Se sumaron los dos casos.
