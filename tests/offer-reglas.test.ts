// =============================================================================
// La segunda capa de la tab Offer (lib/offer-reglas.ts), EJECUTADA
// =============================================================================
// Cada regla del marco que el código puede verificar se prueba acá con datos, no leyendo el fuente:
// el turno (una pregunta, opciones cerradas, piezas válidas), el cierre que decide el código, el
// diagnóstico (9 notas enteras, 1 a 3 cambios), el cálculo (total, cuello, lista), la alerta de foco y
// lo que la propuesta NO puede afirmar si el dueño no lo dio.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (11/10/2026, arnés romper-offer.mjs en el scratchpad de la sesión:
// rompe UNA cosa de lib/offer-reglas.ts, corre este archivo y restaura DE MEMORIA). La base, en verde
// (15 de 15) antes de cada rotura; las 21 roturas cazadas, cada una con su número al lado de su test.
// 12/10/2026 («A definir»): las roturas de la urgencia, la prueba, los bonos y el foco se re-anclaron al código
// nuevo (las reglas pasaron a ir por cifra) y vuelven a dar lo mismo que dice cada comentario. Las dos del
// turno (`unaSolaPregunta`) quedaron sin ancla desde la v2: el parse se reescribió y no se volvieron a correr.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPCION_ARMAR, TOPE_RESPUESTA, URGENCIA_SIN_DATO, alertaFoco, calcularDiagnostico, conversacionParaPrompt,
  documentosParaPrompt, mergePiezas, ofertaDesdePropuesta, opcionesConCierre, parseDiagnostico, parsePropuesta, parseTurno,
  primerMensaje, semillaDePiezas, unaSolaPregunta,
} from '../lib/offer-reglas';
import { MARCA_COMPLETAR, PREGUNTAS_GUIA, type NotaDimension, type OfferMensaje, type PiezasSabidas } from '../lib/offer-marco';

const AT = '2026-10-11T12:00:00.000Z';
const pieza = (valor: string, fuente: 'negocio' | 'chat' | 'doc' = 'chat') => ({ valor, fuente, at: AT });
/** Las mínimas con algo anotado (desde el 12/10/2026 son siete: también cuántos pagaron y cuántos lograron el resultado). */
const MINIMAS: PiezasSabidas = {
  cliente: pieza('Coaches de salud que facturan 3.000 USD al mes'),
  problema: pieza('No consiguen clientes constantes'),
  resultado: pieza('10 clientes nuevos en 90 días'),
  entregables: pieza('12 sesiones grupales y plantillas'),
  precio: pieza('2.500 USD en dos pagos'),
  ventas: pieza('8 personas pagaron'),
  prueba: pieza('sin dato: no lleva la cuenta'),
};

// rotura (sacar `unaSolaPregunta` de parseTurno): 1 fallo, 14 pases. rotura (tope de opción 60 → 600): 1 fallo, 14 pases.
test('el turno: una sola pregunta, opciones cerradas y cortas, sólo piezas válidas', () => {
  const t = parseTurno(JSON.stringify({
    respuesta: 'Perfecto, ya veo a quién le vendes. ¿Cuánto cobras? ¿Y cómo te pagan?',
    opciones: ['Menos de 1.000 USD', 'Entre 1.000 y 3.000 USD', 'menos de 1.000 usd', 'Una opción larguísima que no entra en un botón porque tiene muchas palabras', 'Más de 3.000 USD', 'Otra', 'Y otra más'],
    piezas: { cliente: 'Coaches de salud', inventada: 'x', precio: { valor: '2.500 USD' }, resultado: '' },
    listo: true,
  }));
  assert.ok(t);
  assert.equal(t.respuesta, 'Perfecto, ya veo a quién le vendes. ¿Cuánto cobras?');
  assert.deepEqual(t.opciones, ['Menos de 1.000 USD', 'Entre 1.000 y 3.000 USD', 'Más de 3.000 USD', 'Otra']);
  assert.deepEqual(t.piezas, { cliente: 'Coaches de salud', precio: '2.500 USD' });
  assert.equal(t.listo, true);
  assert.equal(unaSolaPregunta('¿Una? Sí.'), '¿Una? Sí.');
});

// rotura (recortar la respuesta desde el principio, sin cuidar la pregunta): 1 fallo, 14 pases.
test('una respuesta demasiado larga se recorta ANTES de la pregunta, nunca la pregunta', () => {
  const larga = `${'Entiendo lo que me cuentas de tu negocio y de cómo trabajas con tus clientes hoy. '.repeat(12)}¿Cuánto cobras hoy por el programa completo?`;
  const t = parseTurno(JSON.stringify({ respuesta: larga }));
  assert.ok(t);
  assert.ok(t.respuesta.length <= TOPE_RESPUESTA, `${t.respuesta.length} caracteres`);
  assert.ok(t.respuesta.endsWith('¿Cuánto cobras hoy por el programa completo?'), t.respuesta.slice(-80));
  // «el usuario» en el medio de una pregunta legítima no es razonamiento filtrado.
  assert.ok(parseTurno(JSON.stringify({ respuesta: '¿Quién es el usuario final de tu app?' })));
});

// rotura (`pareceRazonamiento` devolviendo siempre false): 1 fallo, 14 pases.
test('el turno se rechaza si viene vacío, sin JSON o con el razonamiento del modelo', () => {
  assert.equal(parseTurno('no es json'), null);
  assert.equal(parseTurno(JSON.stringify({ respuesta: '   ', opciones: [] })), null);
  assert.equal(parseTurno(JSON.stringify({ respuesta: 'We need to ask about the price first.' })), null);
  assert.equal(parseTurno(JSON.stringify({ respuesta: 'El usuario quiere saber el precio, debo preguntar.' })), null);
  // Con cercas de markdown y una coma de más, igual se lee (lo repara parseJsonObject).
  assert.ok(parseTurno('```json\n{"respuesta":"¿Qué vendes hoy?","opciones":[],}\n```'));
});

// rotura (opcionesConCierre devolviendo las opciones tal cual): 1 fallo, 14 pases.
test('«Armar mi oferta» la decide el código: va con las mínimas completas y se saca sin ellas', () => {
  assert.deepEqual(opcionesConCierre(['A', 'B', 'C', 'D'], true), ['A', 'B', 'C', OPCION_ARMAR]);
  assert.deepEqual(opcionesConCierre([], true), [OPCION_ARMAR]);
  assert.deepEqual(opcionesConCierre(['A', 'armar mi oferta'], false), ['A']);
  assert.deepEqual(opcionesConCierre(['Armar mi oferta', 'A'], true), ['A', OPCION_ARMAR]);
});

// rotura (sacar la guarda de «sin dato» en mergePiezas): 1 fallo, 14 pases.
test('mergePiezas: lo nuevo gana, un «sin dato» no pisa un dato real, y las keys inválidas no entran', () => {
  const antes: PiezasSabidas = { precio: pieza('2.500 USD', 'negocio'), garantia: pieza('sin dato: no sabe') };
  const despues = mergePiezas(antes, { precio: 'sin dato: no se acuerda', garantia: '30 días si hace las tareas', cliente: 'Coaches', inventada: 'x' } as never, 'chat', AT);
  assert.equal(despues.precio?.valor, '2.500 USD');
  assert.equal(despues.precio?.fuente, 'negocio');
  assert.equal(despues.garantia?.valor, '30 días si hace las tareas');
  assert.equal(despues.cliente?.fuente, 'chat');
  assert.equal((despues as Record<string, unknown>).inventada, undefined);
  assert.equal(mergePiezas({}, { cliente: 'x'.repeat(900) }, 'doc', AT).cliente?.valor.length, 400);
});

// rotura (semillaDePiezas sin el precio): 1 fallo, 14 pases.
test('la semilla copia la oferta del negocio tal cual: el precio es TEXTO y no se parsea', () => {
  const s = semillaDePiezas({
    campos: { precio: 'Entre USD 5.000 y USD 10.000', promesa: 'Duplicar ventas en 90 días', incluye: '', garantia: null },
    oferta: { para_quien: 'Dueños de clínicas', bonos: [{ nombre: 'Guion de cierre' }, { nombre: '' }], urgencia_dato: null },
  }, AT);
  assert.equal(s.precio?.valor, 'Entre USD 5.000 y USD 10.000');
  assert.equal(s.resultado?.valor, 'Duplicar ventas en 90 días');
  assert.equal(s.cliente?.valor, 'Dueños de clínicas');
  assert.equal(s.bonos?.valor, 'Guion de cierre');
  assert.equal(s.entregables, undefined);
  assert.equal(s.urgencia, undefined);
  assert.equal(s.precio?.fuente, 'negocio');
});

// rotura (siguientePregunta ignorando las piezas anotadas): 1 fallo, 14 pases.
test('el primer mensaje: dos frases, UNA pregunta (la primera de la guía que falta) y sin IA', () => {
  const vacio = primerMensaje({}, { at: AT });
  assert.match(vacio.texto, /^Cuéntame de tu oferta/);
  assert.ok(vacio.texto.endsWith(PREGUNTAS_GUIA[0].pregunta), vacio.texto);
  assert.equal(vacio.opciones, undefined);
  const frases = vacio.texto.split(/(?<=[.?!])\s+/);
  assert.ok(frases.length <= 2, `${frases.length} frases: ${vacio.texto}`);
  assert.equal((vacio.texto.match(/\?/g) ?? []).length, 1);

  // Con lo que el negocio ya cargó: dice que lo leyó, y la pregunta salta lo anotado (incluido «sin dato»).
  const conNegocio = primerMensaje({ entregables: pieza('Mentoría', 'negocio'), otras: pieza('sin dato: no quiso decir') }, { at: AT });
  assert.match(conNegocio.texto, /^Ya leí lo que tengo de tu negocio/);
  assert.ok(conNegocio.texto.endsWith(PREGUNTAS_GUIA[2].pregunta), conNegocio.texto);

  // Con las mínimas: ofrece armarla.
  assert.deepEqual(primerMensaje(MINIMAS, { at: AT }).opciones, [OPCION_ARMAR]);
});

const dims = (notas: number[]): Array<Record<string, unknown>> =>
  notas.map((n, i) => ({ id: `D${i + 1}`, nota: n, porque: `Dijo «algo» sobre D${i + 1}.`, mejora: 'Sumar casos.' }));
const diag = (over: Record<string, unknown> = {}) => JSON.stringify({
  dimensiones: dims([6, 7, 5, 4, 6, 7, 5, 3, 8]), tesis: 'La promesa es clara pero no hay prueba.', fuerte: 'El cliente está bien elegido.',
  cambios: [{ titulo: 'Sumar casos', porque: 'No hay prueba', hipotesis: 'Si se muestran 3 casos, sube el cierre.' }], ...over,
});

// rotura (aceptar notas fuera de rango): 1 fallo, 14 pases. rotura (aceptar 8 dimensiones): 1 fallo, 14 pases.
test('el diagnóstico exige las 9 dimensiones con notas de 0 a 10 y de 1 a 3 cambios', () => {
  const ok = parseDiagnostico(diag());
  assert.ok(ok);
  assert.deepEqual(ok.dimensiones.map((d) => d.id), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']);
  // Un decimal en rango se redondea; fuera de rango (escala 0-100) invalida todo.
  assert.equal(parseDiagnostico(diag({ dimensiones: dims([6.6, 7, 5, 4, 6, 7, 5, 3, 8]) }))?.dimensiones[0].nota, 7);
  assert.equal(parseDiagnostico(diag({ dimensiones: dims([60, 7, 5, 4, 6, 7, 5, 3, 8]) })), null);
  assert.equal(parseDiagnostico(diag({ dimensiones: dims([6, 7, 5, 4, 6, 7, 5, 3]) })), null);
  assert.equal(parseDiagnostico(diag({ cambios: [] })), null);
  const cuatro = Array.from({ length: 4 }, (_, i) => ({ titulo: `C${i}`, porque: 'p', hipotesis: 'h' }));
  assert.equal(parseDiagnostico(diag({ cambios: cuatro }))?.cambios.length, 3);
  // Una dimensión repetida: vale la primera, y falta otra → null.
  const rep = dims([6, 7, 5, 4, 6, 7, 5, 3, 8]);
  rep[8] = { ...rep[0], nota: 1 };
  assert.equal(parseDiagnostico(diag({ dimensiones: rep })), null);
});

const notas = (ns: number[]): NotaDimension[] =>
  ns.map((n, i) => ({ id: `D${i + 1}` as NotaDimension['id'], nota: n, porque: 'p', mejora: 'm' }));

// rotura (el cuello con empate a la MÁS ABAJO: `<=` en vez de `<`): 1 fallo, 14 pases.
// rotura (lista sin mirar D4): 1 fallo, 14 pases.
test('el cálculo: total = promedio × 10, cuello con empate a la de más arriba, y «lista» con D1, D2 y D4 en 7', () => {
  const c = calcularDiagnostico(notas([6, 7, 5, 4, 6, 7, 5, 4, 8]));
  assert.equal(c.total, 58); // 52 / 9 × 10 = 57,8
  assert.equal(c.cuello, 'D4'); // D4 y D8 empatan en 4: gana la de más arriba
  assert.equal(c.lista, false);
  assert.equal(calcularDiagnostico(notas([7, 7, 5, 7, 5, 5, 5, 5, 5])).lista, true);
  assert.equal(calcularDiagnostico(notas([7, 7, 5, 6, 5, 5, 5, 5, 5])).lista, false); // D4 en 6
  assert.equal(calcularDiagnostico(notas([9, 9, 9, 9, 9, 9, 9, 9, 4])).lista, false); // una por debajo de 5
  const bajo = calcularDiagnostico(notas([3, 8, 8, 8, 8, 8, 8, 8, 8]), { foco: 'Tienes 6 productos activos.' });
  assert.equal(bajo.cuello, 'D1');
  assert.equal(bajo.alertas[0], 'Tienes 6 productos activos.');
  assert.match(bajo.alertas[1], /^Cliente ideal saca 3/);
});

// rotura (alertaFoco con banda ≤ 2): 1 fallo, 14 pases.
// 12/10/2026 (tarjeta «foco»): con la facturación desconocida sale desde 3 (antes, desde 6). Sus roturas, en
// tests/offer-a-definir.test.ts.
test('la alerta de foco: negocio chico (o sin facturación conocida) con 3 o más productos u ofertas', () => {
  assert.match(alertaFoco({ productosActivos: 3, ofertasActivas: 1, bandaFacturacion: 0 }) ?? '', /^Tienes 3 productos activos y tu negocio factura menos de \$3\.000 al mes/);
  assert.match(alertaFoco({ productosActivos: 1, ofertasActivas: 4, bandaFacturacion: 1 }) ?? '', /^Tienes 4 ofertas activas y tu negocio factura menos de \$10\.000/);
  assert.equal(alertaFoco({ productosActivos: 2, ofertasActivas: 2, bandaFacturacion: 1 }), null);
  assert.equal(alertaFoco({ productosActivos: 20, ofertasActivas: 3, bandaFacturacion: 2 }), null);
  assert.match(alertaFoco({ productosActivos: 6, ofertasActivas: 0, bandaFacturacion: null }) ?? '', /^Tienes 6 productos activos: en la fase 1/);
  assert.match(alertaFoco({ productosActivos: 3, ofertasActivas: 3, bandaFacturacion: null }) ?? '', /^Tienes 3 productos activos: en la fase 1/);
  assert.equal(alertaFoco({ productosActivos: 2, ofertasActivas: 2, bandaFacturacion: null }), null);
});

const propuestaCruda = (over: Record<string, unknown> = {}) => ({
  nombre: 'Clínica Llena', frase: 'Ayudo a dueños de clínicas a sumar 20 pacientes en 90 días con el Método Agenda sin pagar más anuncios.',
  mensajes: { corto: 'Clínica llena en 90 días', largo: 'x', entrada: 'y' },
  paraQuien: { perfil: 'Dueños de clínicas', minimo: 'Factura 5.000 USD', noEs: 'Recién empiezan' },
  problema: { hoy: 'Agenda vacía', despues: 'Agenda llena', obstaculos: ['Anuncios caros'], yaProbo: 'Agencias' },
  mecanismo: { nombres: ['Método Agenda Llena (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'No depende de anuncios' },
  ruta: [{ fase: 'Arranque', objetivo: 'Primer paciente', hito: 'Semana 1' }],
  incluye: [{ nombre: 'Sesiones', beneficio: 'Acompañamiento' }],
  formato: 'Grupal, 90 días', prueba: '37 clínicas sumaron 15 pacientes promedio y un 40% más de ingresos.',
  garantia: { nombre: 'Garantía Agenda', condiciones: 'Hacer las tareas', plazo: '90 días', siNoCumple: 'Seguimos gratis' },
  bonos: [{ nombre: 'Guion de llamada', objecion: 'No sé vender', valor: '500 USD' }, { nombre: 'Plantillas', objecion: 'No tengo tiempo', valor: 'Ahorra horas' }],
  inversion: { valorTotal: '9.000 USD', precio: '2.500 USD', contado: '2.200 USD', plan: '2 pagos de 1.250 USD', comoDecirlo: 'Primero el valor.' },
  urgencia: 'Solo 5 cupos esta semana',
  escenarios: { mejor: 'Agenda llena', peor: 'Aprendes el método' },
  ecuacion: [{ variable: 'Tiempo', antes: '6 meses', despues: '90 días' }, { variable: 'tiempo', antes: 'repetida', despues: 'x' }, { variable: 'otra', antes: 'x', despues: 'y' }],
  numeros: ['Margen 80%'], validar: ['3 ventas en 30 días'], siguiente: 'Programa anual',
  completar: ['Esto lo escribe el modelo y se ignora'],
  ...over,
});

// rotura (sin la regla de la urgencia): 1 fallo, 14 pases. rotura (sin la de la prueba): 2 fallos, 13 pases (cae también
// «Guardar como oferta», que espera la prueba como hueco).
// rotura (sin la de los bonos): 1 fallo, 14 pases.
test('la propuesta no afirma lo que el dueño no dio: urgencia, cifras de prueba y valores de bonos', () => {
  const sinNada = parsePropuesta(propuestaCruda(), MINIMAS);
  assert.ok(sinNada);
  assert.equal(sinNada.urgencia, URGENCIA_SIN_DATO);
  assert.equal(sinNada.prueba, `${MARCA_COMPLETAR} clínicas sumaron ${MARCA_COMPLETAR} pacientes promedio y un ${MARCA_COMPLETAR} más de ingresos.`);
  assert.equal(sinNada.bonos[0].valor, MARCA_COMPLETAR);
  assert.equal(sinNada.bonos[1].valor, 'Ahorra horas'); // sin dígitos: no hay cifra que inventar
  assert.deepEqual(sinNada.ecuacion.map((f) => f.variable), ['tiempo']);
  // completar: lo arma el código, sin duplicar y sin lo que escribió el modelo.
  assert.ok(sinNada.completar.some((c) => c.startsWith('Urgencia: Una razón real para decidir hoy')), sinNada.completar.join(' | '));
  assert.ok(sinNada.completar.some((c) => c.startsWith('Prueba')));
  assert.ok(sinNada.completar.includes('Bono 1: valor'));
  assert.ok(!sinNada.completar.includes('Esto lo escribe el modelo y se ignora'));
  assert.equal(new Set(sinNada.completar).size, sinNada.completar.length);

  // Con lo que dio el negocio (las piezas y lo que escribió), lo que escribió el modelo queda — cifra por cifra.
  const tres = [{ fase: 'Arranque', objetivo: 'Primer paciente', hito: 'Semana 1' }, { fase: 'Sistema', objetivo: 'Agenda', hito: 'Mes 1' }, { fase: 'Escala', objetivo: 'Llena', hito: 'Mes 3' }];
  const conTodo = parsePropuesta(propuestaCruda({ ruta: tres, mecanismo: { nombres: ['Método Agenda Llena (propuesta)', 'Ruta del Paciente (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'No depende de anuncios' } }), {
    ...MINIMAS, urgencia: pieza('Cohorte que arranca el 3/11, con 5 cupos'), prueba: pieza('37 clínicas, 15 pacientes promedio, 40% más de ingresos'),
    bonos: pieza('Guion de llamada (lo vendo a 500 USD)'),
  }, { fuentes: ['Los que entran suman 20 pacientes. El programa completo vale 9.000 USD.'] });
  assert.ok(conTodo);
  assert.equal(conTodo.urgencia, 'Solo 5 cupos esta semana');
  assert.match(conTodo.prueba, /^37 clínicas sumaron 15 pacientes promedio y un 40% más/);
  assert.equal(conTodo.bonos[0].valor, '500 USD');
  assert.equal(conTodo.inversion.valorTotal, '9.000 USD');
  assert.deepEqual(conTodo.completar, []);

  // «sin dato» cuenta como que NO lo dio.
  assert.equal(parsePropuesta(propuestaCruda(), { ...MINIMAS, urgencia: pieza('sin dato: no tiene fechas') })?.urgencia, URGENCIA_SIN_DATO);
});

// rotura (parsePropuesta sin exigir la frase): 1 fallo, 14 pases.
test('la propuesta sin nombre o sin frase no sirve, y lo que falta queda «[completar]» a la vista', () => {
  assert.equal(parsePropuesta(propuestaCruda({ nombre: '' }), MINIMAS), null);
  assert.equal(parsePropuesta(propuestaCruda({ frase: MARCA_COMPLETAR }), MINIMAS), null);
  const corta = parsePropuesta({ nombre: 'X', frase: 'Ayudo a Y a lograr Z.' }, MINIMAS);
  assert.ok(corta);
  assert.equal(corta.garantia.plazo, MARCA_COMPLETAR);
  assert.ok(corta.completar.includes('Garantía: plazo'));
  // Sin ruta, las tres fases del mínimo del marco quedan «[completar]» (tarjeta «topes», 12/10/2026).
  assert.equal(corta.ruta.length, 3);
  assert.ok(corta.ruta.every((f) => f.fase.startsWith(MARCA_COMPLETAR)));
});

// rotura (escribir en la fila los campos con «[completar]»): 1 fallo, 14 pases.
test('«Guardar como oferta»: los huecos no se escriben, el precio va como texto y nunca es la principal', () => {
  const p = parsePropuesta(propuestaCruda(), MINIMAS);
  assert.ok(p);
  const o = ofertaDesdePropuesta(p, 'Mi conversación');
  assert.equal(o.nombre, 'Clínica Llena');
  assert.equal(o.precio_nota, '2.500 USD · 2 pagos de 1.250 USD');
  assert.equal(o.prueba, null); // la prueba quedó con «[completar]» (no hay pieza de prueba)
  assert.equal(o.bonos[0].valor_usd, null);
  assert.equal(o.origen, 'offer');
  assert.equal((o as Record<string, unknown>).es_principal, undefined);
  assert.ok(!JSON.stringify(o).includes(MARCA_COMPLETAR), JSON.stringify(o));
  assert.equal(ofertaDesdePropuesta({ ...p, nombre: MARCA_COMPLETAR }, 'Mi conversación').nombre, 'Mi conversación');
});

// rotura (documentosParaPrompt sin priorizar los nuevos): 1 fallo, 14 pases. rotura (sin tope total): 1 fallo, 14 pases.
test('los documentos van al prompt con un tope TOTAL, los recién subidos primero y sin cortar los cortos', () => {
  const docs = [
    { id: 'a', nombre: 'web.txt', texto: 'w'.repeat(30_000), at: '2026-10-11T10:00:00Z' },
    { id: 'b', nombre: 'guion.pdf', texto: 'g'.repeat(30_000), at: '2026-10-11T09:00:00Z' },
    { id: 'c', nombre: 'nota.txt', texto: 'corta', at: '2026-10-11T08:00:00Z' },
  ];
  const s = documentosParaPrompt(docs, ['b'], 24_000);
  assert.ok(s.indexOf('«guion.pdf» (recién subido)') < s.indexOf('«web.txt»'));
  // Sólo los cuerpos (las corridas largas de w y g): los nombres de archivo también tienen esas letras.
  const cuerpos = (s.match(/w{20,}|g{20,}/g) ?? []).map((x) => x.length);
  const letras = cuerpos.reduce((a, b) => a + b, 0) + (s.includes('corta') ? 5 : 0);
  assert.ok(letras <= 24_000, `${letras} caracteres de documentos`);
  assert.ok(s.includes('corta'));
  assert.ok(s.includes('[…recortado'));
  assert.ok(((s.match(/g{20,}/) ?? [''])[0]).length >= 14_000, 'el recién subido recibe la parte grande');
  assert.equal(documentosParaPrompt([], []), '');
});

// rotura (sin el tope de 30 mensajes): 1 fallo, 14 pases.
test('la conversación va con rótulos de hablante y sólo los últimos 30 mensajes', () => {
  const msgs: OfferMensaje[] = Array.from({ length: 35 }, (_, i) => ({ id: `m${i}`, de: i % 2 ? 'yo' : 'mako', texto: `mensaje ${i}`, at: AT }));
  msgs.push({ id: 'adj', de: 'yo', texto: '', at: AT, adjuntos: [{ id: 'd', nombre: 'oferta.pdf', via: 'pdf', chars: 10 }] });
  const s = conversacionParaPrompt(msgs);
  const lineas = s.split('\n');
  assert.equal(lineas[0], '(Se omiten los 6 mensajes más viejos.)');
  assert.equal(lineas.length, 31);
  assert.ok(!s.includes('mensaje 5\n') && s.includes('mensaje 6'));
  assert.equal(lineas[lineas.length - 1], 'DUEÑO (adjuntó: oferta.pdf): (mandó documentos sin texto)');
  assert.match(s, /^MaKo: mensaje 6$/m);
});
