// =============================================================================
// Offer v2 (lib/offer-reglas.ts), EJECUTADO: el árbol, el diagnóstico de fase en el chat y el arranque
// =============================================================================
// Pedido de Martín (11/10/2026): las ofertas atadas a los funnels del CRM con un selector en árbol, el chat
// que arranca pidiendo un documento o el link, y «El diagnóstico» preguntado adentro del chat con opciones
// personalizadas, sin mostrar el resultado y con el resultado en el PDF.
//
// Lo que se fija acá es lo que decide el CÓDIGO y ningún compilador ve:
//   · cada conversación aparece UNA vez en el árbol, colgada de la oferta correcta;
//   · la opción N adaptada por la IA sigue siendo la N original (y el idx que vuelve es el original);
//   · el diagnóstico sale de `diagnosticar` (el mismo del onboarding) con las respuestas del chat;
//   · cuándo una pregunta del diagnóstico es obligatoria, y que el chat no se traba si la IA no la adapta.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (11/10/2026, arnés romper-v2.mjs en el scratchpad de la sesión: rompe
// UNA cosa de lib/offer-reglas.ts, corre este archivo y restaura DE MEMORIA). La base, en verde antes de cada
// rotura (12 de 12); 20 roturas, las 20 cazadas, cada una con su número al lado de su test.
// Revisión adversarial (11/10/2026, arnés romper-revision.mjs, mismo método): la base en verde (19 de 19);
// 11 roturas más sobre lo puro que arregló la revisión, las 11 cazadas con «1 fallo, 18 pases». Las 20 de
// arriba se volvieron a correr con las anclas al día (romper-v2.mjs) sobre la base de 19.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOJOS_ANTES_DE_CORTAR, INTENTOS_CAS, N_OPCIONES_DIAG, OPCION_ARMAR, OPCION_SIN_DOCUMENTO, PEDIDO_DOCUMENTO, PREGUNTA_CANAL,
  canalParaElNegocio, conRespuestaInferida, construirArbol, conversacionParaPrompt, diagnosticoFaltante, diagnosticoParaPrompt,
  esperaCAS, estadoDiagnostico, faseDeSetting, faseVigenteDe, ligadaParaVista, linkParaLeer, mensajeDeMako, mensajeParaVista,
  ofertaYaAnotada, opcionesDiagnostico, parseTurno, parseTurnoConDiagnostico, planDiagnostico, preguntasDiagnostico,
  primerMensajeFunnel, repartirTranscripcion, respuestaDiagnostico, sanearMensajes, semillaDeProducto, urlAudio, validadorConRespaldo,
  type MensajeGuardado, type SesionParaArbol, type TurnoOffer,
} from '../lib/offer-reglas';
import { CANALES, PREGUNTAS, VOLUMEN_POR_CANAL, diagnosticar } from '../lib/fase-diagnostico';
import type { PiezasSabidas } from '../lib/offer-marco';

const AT = '2026-10-11T12:00:00.000Z';
const pieza = (valor: string, fuente: 'negocio' | 'chat' | 'doc' = 'chat') => ({ valor, fuente, at: AT });
const MINIMAS: PiezasSabidas = {
  cliente: pieza('Coaches'), problema: pieza('Sin clientes'), resultado: pieza('10 clientes en 90 días'),
  entregables: pieza('12 sesiones'), precio: pieza('2.500 USD'),
  // Desde el 12/10/2026 también son mínimas cuántos pagaron y cuántos lograron el resultado.
  ventas: pieza('8 personas'), prueba: pieza('sin dato: no lleva la cuenta'),
};

// ── El árbol ─────────────────────────────────────────────────────────────────

const ses = (id: number, over: Partial<SesionParaArbol> = {}): SesionParaArbol => ({
  id, titulo: `S${id}`, estado: 'conversando', total: null, updatedAt: `2026-10-${String(10 + (id % 10)).padStart(2, '0')}T00:00:00Z`,
  funnelId: null, ofertaId: null, ofertaBaseId: null, ...over,
});

// rotura (`destino` sin mirar la oferta analizada): 1 fallo, 11 pases. rotura (las de un funnel archivado se
// descartan en vez de ir a sueltas): 1 fallo, 11 pases. rotura (el nombre del funnel sin el producto): 1 fallo, 11 pases.
test('el árbol: cada conversación UNA vez, colgada de la oferta que guardó, si no de la que analizaba, si no de «nuevas»', () => {
  const arbol = construirArbol({
    funnels: [{ id: 1, nombre: 'Funnel principal', producto: 'Mentoría Pro' }, { id: 2, nombre: 'Webinar', producto: null }],
    ofertas: [{ id: 10, nombre: 'Oferta A' }, { id: 11, nombre: 'Oferta B' }, { id: 12, nombre: 'Oferta C' }],
    ligas: [
      { funnel_id: 1, oferta_id: 11, es_principal: false, orden: 0 },
      { funnel_id: 1, oferta_id: 10, es_principal: true, orden: 5 },
      { funnel_id: 2, oferta_id: 12, es_principal: false, orden: 0 },
      { funnel_id: 1, oferta_id: 99, es_principal: false, orden: 1 }, // oferta inactiva/borrada: no se dibuja
    ],
    sesiones: [
      ses(1, { funnelId: 1, ofertaId: 11 }),                    // guardó B
      ses(2, { funnelId: 1, ofertaBaseId: 10 }),                // analiza A
      ses(3, { funnelId: 1 }),                                  // nueva
      ses(4, { funnelId: 1, ofertaId: 12 }),                    // guardó C, que no está en este funnel → nuevas
      ses(5),                                                   // v1 → sueltas
      ses(6, { funnelId: 77, ofertaBaseId: 10 }),               // funnel archivado → sueltas
      ses(7, { funnelId: 2, ofertaId: 99, ofertaBaseId: 12 }),  // guardó una que no se ve → la que analizaba
    ],
  });
  assert.deepEqual(arbol.funnels.map((f) => f.nombre), ['Mentoría Pro', 'Webinar']);
  const f1 = arbol.funnels[0];
  assert.deepEqual(f1.ofertas.map((o) => [o.nombre, o.principal]), [['Oferta A', true], ['Oferta B', false]]);
  assert.deepEqual(f1.ofertas[0].sesiones.map((s) => s.id), [2]);
  assert.deepEqual(f1.ofertas[1].sesiones.map((s) => s.id), [1]);
  assert.deepEqual(f1.sesionesNuevas.map((s) => s.id).sort(), [3, 4]);
  assert.deepEqual(arbol.funnels[1].ofertas[0].sesiones.map((s) => s.id), [7]);
  assert.deepEqual(arbol.sueltas.map((s) => s.id).sort(), [5, 6]);
  // Cada una, una sola vez.
  const todas = [
    ...arbol.sueltas, ...arbol.funnels.flatMap((f) => [...f.sesionesNuevas, ...f.ofertas.flatMap((o) => o.sesiones)]),
  ].map((s) => s.id).sort((a, b) => a - b);
  assert.deepEqual(todas, [1, 2, 3, 4, 5, 6, 7]);
  // El resumen no lleva los campos internos.
  assert.deepEqual(Object.keys(f1.ofertas[0].sesiones[0]).sort(), ['estado', 'id', 'titulo', 'total', 'updatedAt']);
});

// ── El diagnóstico de fase en el chat ────────────────────────────────────────

/** Un mensaje de MaKo con una pregunta del diagnóstico. */
const preguntaDe = (id: string, opciones?: string[]): MensajeGuardado => ({
  id: `p-${id}`, de: 'mako', texto: '¿?', at: AT, pregunta: { tipo: 'diagnostico', id }, ...(opciones ? { opciones } : {}),
});
const respuestaA = (id: string, idx: number): MensajeGuardado => ({ id: `r-${id}`, de: 'yo', texto: 'x', at: AT, respuesta: { preguntaId: id, idx } });

// rotura (preguntasDiagnostico ignorando el canal respondido en la de volumen): 1 fallo, 11 pases.
test('las preguntas: las seis del onboarding, todas de 5 opciones; sin canal conocido, el canal va primero y adapta el volumen', () => {
  const conCanal = preguntasDiagnostico('carrito');
  assert.deepEqual(conCanal.map((q) => q.id), PREGUNTAS.map((q) => q.id));
  assert.deepEqual(conCanal.find((q) => q.id === 'volumen')?.opciones, VOLUMEN_POR_CANAL.carrito.opciones);
  const sinCanal = preguntasDiagnostico(null);
  assert.equal(sinCanal[0].id, PREGUNTA_CANAL);
  assert.equal(sinCanal[0].opciones.length, CANALES.length);
  for (const q of [...sinCanal, ...preguntasDiagnostico('webinar')]) assert.equal(q.opciones.length, N_OPCIONES_DIAG, q.id);
  // El canal que contestó el dueño (webinar = índice 3) adapta la pregunta de volumen.
  const e = estadoDiagnostico([preguntaDe(PREGUNTA_CANAL), respuestaA(PREGUNTA_CANAL, 3)], { canal: null, yaGuardado: false });
  assert.equal(e.canal, 'webinar');
  assert.deepEqual(e.pendientes.find((q) => q.id === 'volumen')?.opciones, VOLUMEN_POR_CANAL.webinar.opciones);
});

// rotura (`diag` calculado con las respuestas en otro orden): 1 fallo, 11 pases. rotura (yaGuardado sin vaciar
// pendientes): 2 fallos, 10 pases (cae también el plan, que con uno guardado tiene que dar «no»).
test('el diagnóstico del chat es el de `diagnosticar` con las respuestas en el orden del onboarding; con uno guardado no se pregunta nada', () => {
  const resp = { facturacion: 1, inversion: 0, creativos: 1, volumen: 2, funnel: 1, cuello: 2 };
  const ms: MensajeGuardado[] = [];
  // En otro orden que el del onboarding, y una respuesta cambiada después (la última gana).
  for (const id of ['cuello', 'funnel', 'volumen', 'creativos', 'inversion', 'facturacion']) ms.push(preguntaDe(id), respuestaA(id, id === 'cuello' ? 4 : resp[id as keyof typeof resp]));
  ms.push(respuestaA('cuello', resp.cuello));
  const e = estadoDiagnostico(ms, { canal: 'llamadas', yaGuardado: false });
  assert.deepEqual(e.pendientes, []);
  assert.deepEqual(e.diag, diagnosticar([1, 0, 1, 2, 1, 2], 'llamadas'));
  // A medias: no hay diagnóstico, y la abierta es la del último mensaje de MaKo.
  const medio = estadoDiagnostico([preguntaDe('facturacion'), respuestaA('facturacion', 1), preguntaDe('inversion')], { canal: 'llamadas', yaGuardado: false });
  assert.equal(medio.diag, null);
  assert.equal(medio.abierta, 'inversion');
  assert.equal(medio.pendientes[0].id, 'inversion');
  // Con uno guardado en el negocio: nada pendiente, nada abierto.
  const guardado = estadoDiagnostico([preguntaDe('facturacion')], { canal: 'llamadas', yaGuardado: true });
  assert.deepEqual(guardado.pendientes, []);
  assert.equal(guardado.abierta, null);
});

// rotura (sin el chequeo de números): 1 fallo, 11 pases. rotura (sin el chequeo de cantidad): 1 fallo, 11 pases.
test('las opciones adaptadas: la N sigue siendo la N; la que cambia un número vuelve a su original, y con otra cantidad, todas', () => {
  const original = ['$0 – $3.000 (o todavía nada)', '$3.000 – $10.000', '$10.000 – $30.000', '$30.000 – $80.000', 'Más de $80.000'];
  const buenas = ['Menos de $3.000 al mes (o todavía nada)', 'Entre $3,000 y $10,000', 'Entre $10.000 y $30.000 al mes', '$30.000 – $80.000 mensuales', 'Más de $80.000 al mes'];
  assert.deepEqual(opcionesDiagnostico(original, buenas), buenas, 'el $0 no cuenta y «3,000» es 3000');
  const una = [...buenas];
  una[2] = 'Unos 20 mil al mes';
  const r = opcionesDiagnostico(original, una);
  assert.equal(r[2], original[2]);
  assert.equal(r[1], buenas[1]);
  assert.deepEqual(opcionesDiagnostico(original, buenas.slice(0, 4)), original);
  assert.deepEqual(opcionesDiagnostico(original, [...buenas.slice(0, 4), buenas[0]]), original, 'dos iguales: el orden ya no garantiza nada');
  assert.deepEqual(opcionesDiagnostico(original, null), original);
  // Las que no tienen números (funnel, cuello) se aceptan si vienen y no son larguísimas.
  const sinNumeros = PREGUNTAS.find((q) => q.id === 'funnel')!.opciones;
  const adaptadas = sinNumeros.map((_, i) => `Opción adaptada ${'abcde'[i]}`);
  assert.deepEqual(opcionesDiagnostico(sinNumeros, adaptadas), adaptadas);
  assert.equal(opcionesDiagnostico(sinNumeros, adaptadas.map((a, i) => (i === 0 ? 'x'.repeat(200) : a)))[0], sinNumeros[0]);
});

// rotura (respuestaDiagnostico sin exigir que MaKo haya hecho la pregunta): 1 fallo, 11 pases.
test('la respuesta tocada: vale si MaKo hizo esa pregunta y el índice es una opción; el texto es la opción que vio el dueño', () => {
  const ms = [preguntaDe('facturacion', ['a', 'b', 'Entre $3.000 y $10.000', 'd', 'e'])];
  const e = estadoDiagnostico(ms, { canal: 'llamadas', yaGuardado: false });
  assert.deepEqual(respuestaDiagnostico(ms, { preguntaId: 'facturacion', idx: 2 }, e), { preguntaId: 'facturacion', idx: 2, texto: 'Entre $3.000 y $10.000' });
  assert.equal(respuestaDiagnostico(ms, { preguntaId: 'inversion', idx: 0 }, e), null, 'MaKo nunca la preguntó');
  assert.equal(respuestaDiagnostico(ms, { preguntaId: 'facturacion', idx: 5 }, e), null);
  assert.equal(respuestaDiagnostico(ms, { preguntaId: 'facturacion', idx: 1.5 }, e), null);
  assert.equal(respuestaDiagnostico(ms, { preguntaId: 'inventada', idx: 0 }, e), null);
  assert.equal(respuestaDiagnostico(ms, { preguntaId: 'facturacion', idx: 0 }, estadoDiagnostico(ms, { canal: 'llamadas', yaGuardado: true })), null);
});

// rotura (conRespuestaInferida sin exigir que el último mensaje sea del dueño): 1 fallo, 11 pases.
test('la respuesta leída en las palabras del dueño se pega a SU último mensaje, marcada, sólo con una pregunta abierta', () => {
  const ms: MensajeGuardado[] = [preguntaDe('facturacion'), { id: 'yo1', de: 'yo', texto: 'facturamos como 5 mil al mes', at: AT }];
  const e = estadoDiagnostico(ms, { canal: 'llamadas', yaGuardado: false });
  const r = conRespuestaInferida(ms, e, 1);
  assert.equal(r.preguntaId, 'facturacion');
  assert.deepEqual(r.mensajes[1].respuesta, { preguntaId: 'facturacion', idx: 1, inferida: true });
  assert.equal(ms[1].respuesta, undefined, 'no muta la lista que recibió');
  assert.equal(conRespuestaInferida(ms, e, null).preguntaId, null);
  assert.equal(conRespuestaInferida(ms, e, 7).preguntaId, null);
  // La pregunta recién hecha, sin nada del dueño después: no hay a qué mensaje pegarla.
  const recien = [preguntaDe('facturacion')];
  assert.equal(conRespuestaInferida(recien, estadoDiagnostico(recien, { canal: 'llamadas', yaGuardado: false }), 1).preguntaId, null);
  const sinAbierta = [...ms, { id: 'mk', de: 'mako' as const, texto: '¿Y tu precio?', at: AT }];
  assert.equal(conRespuestaInferida(sinAbierta, estadoDiagnostico(sinAbierta, { canal: 'llamadas', yaGuardado: false }), 1).preguntaId, null);
});

// rotura (plan sin la red de las piezas mínimas): 2 fallos, 10 pases (cae también el del mensaje, que arma la
// obligatoria con las mínimas). rotura (plan forzando aunque el dueño saltó la abierta): 1 fallo, 11 pases.
// rotura (plan forzando en un turno con documentos nuevos): 1 fallo, 11 pases.
test('el plan: MaKo elige el momento, obligatoria con el diagnóstico empezado, con las mínimas o al tercer mensaje; si el dueño saltó la abierta, un turno libre', () => {
  const vacio = estadoDiagnostico([], { canal: 'llamadas', yaGuardado: false });
  assert.equal(planDiagnostico(vacio, { puedeConcluir: false, mensajesDelDueno: 1 }).modo, 'ofrecer');
  assert.equal(planDiagnostico(vacio, { puedeConcluir: true, mensajesDelDueno: 1 }).modo, 'forzar');
  assert.equal(planDiagnostico(vacio, { puedeConcluir: false, mensajesDelDueno: 3 }).modo, 'forzar');
  const empezado = estadoDiagnostico([preguntaDe('facturacion'), respuestaA('facturacion', 0)], { canal: 'llamadas', yaGuardado: false });
  const p = planDiagnostico(empezado, { puedeConcluir: false, mensajesDelDueno: 1 });
  assert.equal(p.modo, 'forzar');
  assert.ok(p.modo === 'forzar' && p.pregunta.id === 'inversion' && p.numero === 2 && p.total === 6, JSON.stringify(p));
  const saltada = estadoDiagnostico([preguntaDe('facturacion'), { id: 'y', de: 'yo', texto: 'otra cosa', at: AT }], { canal: 'llamadas', yaGuardado: false });
  assert.equal(planDiagnostico(saltada, { puedeConcluir: true, mensajesDelDueno: 9 }).modo, 'ofrecer');
  // Un turno con documentos nuevos es para leerlos: tampoco fuerza.
  assert.equal(planDiagnostico(empezado, { puedeConcluir: true, mensajesDelDueno: 9, conDocumentosNuevos: true }).modo, 'ofrecer');
  assert.equal(planDiagnostico(estadoDiagnostico([], { canal: 'llamadas', yaGuardado: true }), { puedeConcluir: true, mensajesDelDueno: 9 }).modo, 'no');
  // El bloque del prompt dice si es obligatoria y trae las 5 originales numeradas desde 0.
  const bloque = diagnosticoParaPrompt(planDiagnostico(vacio, { puedeConcluir: true, mensajesDelDueno: 1 }), vacio);
  assert.match(bloque, /^OBLIGATORIA EN ESTE TURNO — pregunta 1 de 6: «facturacion»/);
  assert.match(bloque, / {2}0\) \$0 – \$3\.000/);
  assert.match(bloque, / {2}4\) Más de \$80\.000/);
});

const turnoIA = (over: Partial<TurnoOffer> = {}): TurnoOffer => ({
  respuesta: '¿Cuánto cobras?', opciones: ['Menos de 1.000 USD'], piezas: {}, listo: false, diagnostico: null, diagnosticoRespuesta: null, ...over,
});

// rotura (mensajeDeMako sumando «Armar mi oferta» a las opciones del diagnóstico): 1 fallo, 11 pases.
// rotura (sin la red de la pregunta ORIGINAL cuando la IA no contestó): 1 fallo, 11 pases.
test('el mensaje de MaKo: la pregunta del diagnóstico va marcada, con sus 5 opciones y sin «Armar mi oferta»; sin IA sale la original', () => {
  const e = estadoDiagnostico([], { canal: 'llamadas', yaGuardado: false });
  const forzar = planDiagnostico(e, { puedeConcluir: true, mensajesDelDueno: 1 });
  const original = PREGUNTAS[0];
  // La IA no contestó: la pregunta original, tal cual.
  const sinIA = mensajeDeMako({ turno: null, plan: forzar, piezas: MINIMAS, puedeConcluir: true, id: 'm', at: AT });
  assert.equal(sinIA.texto, original.texto);
  assert.deepEqual(sinIA.opciones, original.opciones);
  assert.deepEqual(sinIA.pregunta, { tipo: 'diagnostico', id: 'facturacion' });
  // La IA la adaptó: el texto adaptado, con el puente si no trae pregunta, y nunca «Armar mi oferta».
  const adaptadas = ['Menos de $3.000', 'Entre $3.000 y $10.000', 'Entre $10.000 y $30.000', 'Entre $30.000 y $80.000', 'Más de $80.000'];
  const conIA = mensajeDeMako({
    turno: turnoIA({ respuesta: 'Perfecto, eso me ayuda.', diagnostico: { texto: '¿Cuánto factura tu consultorio al mes?', opciones: adaptadas } }),
    plan: forzar, piezas: MINIMAS, puedeConcluir: true, id: 'm', at: AT, diagPara: 'facturacion',
  });
  assert.equal(conIA.texto, 'Perfecto, eso me ayuda. ¿Cuánto factura tu consultorio al mes?');
  assert.deepEqual(conIA.opciones, adaptadas);
  assert.ok(!conIA.opciones?.includes(OPCION_ARMAR));
  // Obligatoria y la IA hizo OTRA pregunta: se descarta la suya y sale la del diagnóstico.
  const ignoro = mensajeDeMako({ turno: turnoIA(), plan: forzar, piezas: MINIMAS, puedeConcluir: true, id: 'm', at: AT });
  assert.equal(ignoro.pregunta?.id, 'facturacion');
  // La adaptación era para otra pregunta (el dueño ya la contestó con sus palabras): no se usa.
  const otra = mensajeDeMako({ turno: turnoIA({ diagnostico: { texto: '¿Otra?', opciones: adaptadas } }), plan: forzar, piezas: MINIMAS, puedeConcluir: true, id: 'm', at: AT, diagPara: 'canal' });
  assert.equal(otra.texto, original.texto);
  // Sin diagnóstico pendiente: el mensaje normal, con «Armar mi oferta» si están las mínimas.
  const normal = mensajeDeMako({ turno: turnoIA(), plan: { modo: 'no' }, piezas: MINIMAS, puedeConcluir: true, id: 'm', at: AT });
  assert.equal(normal.pregunta, undefined);
  assert.deepEqual(normal.opciones, ['Menos de 1.000 USD', OPCION_ARMAR]);
});

// rotura (parseTurno exigiendo siempre la respuesta): 1 fallo, 11 pases.
test('el turno con la pregunta del diagnóstico: la respuesta puede venir vacía, el índice leído se valida, y el validar estricto la exige', () => {
  const crudo = JSON.stringify({
    respuesta: '', opciones: [], piezas: {}, listo: false,
    diagnostico: { texto: '¿Cuánto inviertes por día en anuncios?', opciones: ['a', 'b', 'c', 'd', 'e'] }, diagnostico_respuesta: '2',
  });
  const t = parseTurno(crudo);
  assert.ok(t);
  assert.equal(t.respuesta, '');
  assert.equal(t.diagnostico?.texto, '¿Cuánto inviertes por día en anuncios?');
  assert.equal(t.diagnosticoRespuesta, 2);
  assert.ok(parseTurnoConDiagnostico(crudo));
  assert.equal(parseTurnoConDiagnostico(JSON.stringify({ respuesta: '¿Y tu precio?' })), null);
  assert.equal(parseTurno(JSON.stringify({ respuesta: '', diagnostico: { texto: 'sin signo de pregunta', opciones: [] } })), null);
  assert.equal(parseTurno(JSON.stringify({ respuesta: '¿Precio?', diagnostico_respuesta: 9 }))?.diagnosticoRespuesta, null);
});

// ── El arranque y los mensajes ───────────────────────────────────────────────

// rotura (primerMensajeFunnel sin la línea de lo que ya sabe): 1 fallo, 11 pases.
test('el primer mensaje v2: pide el documento o el link, dice en una línea lo que ya sabe, y ofrece «No tengo»', () => {
  const vacio = primerMensajeFunnel({}, { modo: 'crear', at: AT });
  assert.equal(vacio.texto, PEDIDO_DOCUMENTO);
  assert.deepEqual(vacio.opciones, [OPCION_SIN_DOCUMENTO]);
  const analiza = primerMensajeFunnel({ precio: pieza('2.500 USD', 'negocio'), resultado: pieza('x', 'negocio'), garantia: pieza('sin dato: no tiene') }, { modo: 'analizar', ofertaBaseNombre: 'Mentoría Pro', at: AT });
  assert.equal(analiza.texto, `De «Mentoría Pro» ya tengo resultado y precio. ${PEDIDO_DOCUMENTO}`);
  assert.equal((analiza.texto.match(/\?/g) ?? []).length, 1, 'una sola pregunta');
  assert.deepEqual(primerMensajeFunnel(MINIMAS, { modo: 'crear', at: AT }).opciones, [OPCION_SIN_DOCUMENTO, OPCION_ARMAR]);
  assert.ok(OPCION_SIN_DOCUMENTO.length <= 60);
});

// rotura (semillaDeProducto sin el plazo de la suscripción): 1 fallo, 11 pases.
test('la semilla de un funnel: lo que vende su producto, con el precio y su plazo', () => {
  const s = semillaDeProducto({ tipo: 'suscripcion', monto_usd: 1500, suscripcion_meses: 6, promesa: 'Agenda llena', incluye: 'Sesiones semanales', garantia: null }, AT);
  assert.equal(s.precio?.valor, '1,500 USD al mes durante 6 meses');
  assert.equal(s.resultado?.valor, 'Agenda llena');
  assert.equal(s.entregables?.valor, 'Sesiones semanales');
  assert.equal(s.garantia, undefined);
  assert.equal(s.precio?.fuente, 'negocio');
  assert.deepEqual(semillaDeProducto(null), {});
  assert.equal(semillaDeProducto({ tipo: 'unico', monto_usd: 0 }).precio, undefined);
});

// rotura (sanearMensajes descartando el audio): 1 fallo, 11 pases. rotura (mensajeParaVista dejando la ruta
// interna): 1 fallo, 11 pases.
test('el audio: se guarda la ruta, la pantalla recibe la URL; las marcas del diagnóstico sobreviven al saneo', () => {
  const path = '13/offer/0f0e0d0c-0b0a-4908-8706-050403020100';
  const crudo = [
    { id: 'a1', de: 'yo', texto: 'lo que dije', at: AT, audio: { path, mime: 'audio/webm', secs: 12.4 } },
    { id: 'a2', de: 'yo', texto: 'x', at: AT, audio: { path: '../otro/archivo', mime: 'audio/webm', secs: 3 } },
    { id: 'p1', de: 'mako', texto: '¿Cuánto facturas?', at: AT, opciones: ['a', 'b', 'c', 'd', 'e'], pregunta: { tipo: 'diagnostico', id: 'facturacion' } },
    { id: 'r1', de: 'yo', texto: 'b', at: AT, respuesta: { preguntaId: 'facturacion', idx: 1, inferida: true } },
    { id: 'r2', de: 'yo', texto: 'c', at: AT, respuesta: { preguntaId: 'facturacion', idx: 9 } },
    { id: 'mudo', de: 'yo', texto: '', at: AT, audio: { path, mime: 'audio/webm', secs: 1 } },
  ];
  const ms = sanearMensajes(crudo);
  assert.deepEqual(ms[0].audio, { path, mime: 'audio/webm', secs: 12 });
  assert.equal(ms[1].audio, undefined, 'una ruta que no es de Offer no se guarda como audio');
  assert.deepEqual(ms[2].pregunta, { tipo: 'diagnostico', id: 'facturacion' });
  assert.deepEqual(ms[3].respuesta, { preguntaId: 'facturacion', idx: 1, inferida: true });
  assert.equal(ms[4].respuesta, undefined);
  assert.ok(ms.some((m) => m.id === 'mudo'), 'un audio sin texto igual se dibuja');
  const vista = mensajeParaVista(42, ms[0]);
  assert.deepEqual(vista.audio, { url: urlAudio(42, 'a1'), secs: 12 });
  assert.equal(vista.audio?.url, '/api/offer/audio?id=42&m=a1');
  assert.ok(!JSON.stringify(vista).includes('/offer/0f0e'), 'la ruta de Storage no baja a la pantalla');
  // El prompt sabe que el texto es una transcripción.
  assert.match(conversacionParaPrompt(ms.slice(0, 1)), /^DUEÑO \(por audio\): lo que dije$/);
});

// ── Revisión adversarial del 11/10/2026 ─────────────────────────────────────

// rotura (volver al chequeo de SUBCONJUNTO: la adaptada sólo tiene que CONTENER los números de su original):
// 1 fallo, 18 pases
test('las opciones corridas un lugar (la 0 con el rango de la 1) vuelven a su original: la N conserva los números de la N, uno a uno', () => {
  const fact = PREGUNTAS.find((q) => q.id === 'facturacion')!.opciones;
  const corrida = ['Entre $3.000 y $10.000 al mes', 'Entre $10.000 y $30.000', 'Entre $30.000 y $80.000', 'Entre $80.000 y $150.000', 'Más de $150.000'];
  assert.deepEqual(opcionesDiagnostico(fact, corrida), [...fact], 'la lista corrida se guardaría en el diagnóstico del NEGOCIO');
  // Una sola corrida (la 0 trae {3000, 10000} sobre el {3000} de su original): vuelve, y no quedan dos rangos iguales.
  const una = [...fact];
  una[0] = 'Entre $3.000 y $10.000 al mes';
  assert.equal(opcionesDiagnostico(fact, una)[0], fact[0]);
  // Un número de MÁS también la devuelve (antes alcanzaba con contener los de la original).
  const deMas = [...fact];
  deMas[1] = '$3.000 – $10.000 (unos $5.000 de promedio)';
  assert.equal(opcionesDiagnostico(fact, deMas)[1], fact[1]);
  // El volumen se rompía igual.
  const vol = VOLUMEN_POR_CANAL.llamadas.opciones;
  assert.deepEqual(opcionesDiagnostico(vol, ['Entre 5 y 25 llamadas', 'Entre 25 y 75', 'Entre 75 y 250', 'Entre 250 y 500', 'Más de 500']), [...vol]);
});

// rotura (canalParaElNegocio devolviendo siempre el canal del estado): 1 fallo, 18 pases
test('el canal que se guarda en el negocio: el contestado o el del funnel por defecto, nunca el propio de un funnel secundario', () => {
  const delFunnel = { respuestas: {}, canal: 'presencial' as const };
  assert.equal(canalParaElNegocio(delFunnel, { canal: 'presencial', esDefault: false }), undefined);
  assert.equal(canalParaElNegocio(delFunnel, { canal: 'presencial', esDefault: true }), 'presencial');
  // El funnel sin canal propio heredó el del negocio: ése se guarda.
  assert.equal(canalParaElNegocio(delFunnel, { canal: null, esDefault: false }), 'presencial');
  assert.equal(canalParaElNegocio(delFunnel, null), 'presencial');
  // Lo que el dueño contestó en el chat es sobre su negocio.
  assert.equal(canalParaElNegocio({ respuestas: { [PREGUNTA_CANAL]: 0 }, canal: 'llamadas' }, { canal: 'presencial', esDefault: false }), 'llamadas');
  assert.equal(canalParaElNegocio({ respuestas: {}, canal: null }, null), undefined);
});

// rotura (faseVigenteDe con el chat primero): 1 fallo, 18 pases. rotura (diagnosticoFaltante null también a medias):
// 1 fallo, 18 pases
test('el diagnóstico que vale y el que falta: el guardado gana sobre el del chat; a medias, la conclusión sabe cuántas faltan', () => {
  const fase1 = diagnosticar([0, 0, 0, 0, 0, 0], 'llamadas');
  const fase3 = diagnosticar([2, 2, 2, 2, 2, 2], 'llamadas');
  assert.equal(faseVigenteDe({ faseGuardada: fase3, faseSesion: fase1 }), fase3, 'el que rehízo el onboarding manda');
  assert.equal(faseVigenteDe({ faseGuardada: null, faseSesion: fase1 }), fase1);
  assert.equal(faseVigenteDe({ faseGuardada: null, faseSesion: null }), null);
  const medio = estadoDiagnostico([preguntaDe('facturacion'), respuestaA('facturacion', 1), preguntaDe('inversion'), respuestaA('inversion', 0)], { canal: 'llamadas', yaGuardado: false });
  assert.deepEqual(diagnosticoFaltante(medio), { contestadas: 2, total: 6 });
  assert.equal(diagnosticoFaltante(estadoDiagnostico([], { canal: 'llamadas', yaGuardado: true })), null);
  const completo: MensajeGuardado[] = [];
  for (const q of PREGUNTAS) completo.push(preguntaDe(q.id), respuestaA(q.id, 1));
  assert.equal(diagnosticoFaltante(estadoDiagnostico(completo, { canal: 'llamadas', yaGuardado: false })), null);
  // El setting leído: el diagnóstico, o null si no hay o no se entiende.
  assert.deepEqual(faseDeSetting(JSON.stringify(fase3)), fase3);
  for (const raw of [null, '', '{roto', '{"fase":1}', 'null']) assert.equal(faseDeSetting(raw), null, String(raw));
});

// rotura (repartirTranscripcion cortando como antes, sin documento): 1 fallo, 18 pases
test('la nota de voz larga: si no entra en el mensaje, la transcripción ENTERA va como documento; sin lugar para documentos, el corte queda escrito', () => {
  assert.deepEqual(repartirTranscripcion('hola', 'una nota corta', { tope: 100, topeDoc: 1_000, docsLibres: 3 }), { cuerpo: 'hola\n\nuna nota corta', doc: null });
  const larga = 'palabra '.repeat(50).trim();
  const r = repartirTranscripcion('', larga, { tope: 300, topeDoc: 1_000, docsLibres: 3, inicio: 40 });
  assert.ok(r.doc, 'no entra: va como documento');
  assert.equal(r.doc.texto, larga, 'el documento la lleva ENTERA');
  assert.equal(r.doc.chars, larga.length);
  assert.equal(r.doc.aviso, undefined);
  assert.ok(r.cuerpo.length <= 300);
  assert.match(r.cuerpo, /«Transcripción del audio»/);
  // Más larga que un documento: se guarda el principio y lo dice, con el número.
  const r2 = repartirTranscripcion('', larga, { tope: 100, topeDoc: 120, docsLibres: 1 });
  assert.equal(r2.doc?.texto.length, 120);
  assert.match(r2.doc?.aviso ?? '', /399/);
  // Sin lugar para otro documento: se recorta el mensaje, y el corte queda escrito en él.
  const r3 = repartirTranscripcion('', larga, { tope: 200, topeDoc: 1_000, docsLibres: 0 });
  assert.equal(r3.doc, null);
  assert.ok(r3.cuerpo.length <= 200);
  assert.match(r3.cuerpo, /quedaron afuera/);
});

// rotura (linkParaLeer aceptando cualquier parámetro): 1 fallo, 18 pases
test('«pega el link»: se lee LA página pegada; uno que la elige por parámetro no se lee (sería otra), los de seguimiento sí', () => {
  assert.deepEqual(linkParaLeer('https://minegocio.com/oferta'), { ok: true, leida: 'https://minegocio.com/oferta', sinWww: false });
  const www = linkParaLeer('https://www.minegocio.com/');
  assert.ok(www.ok && www.sinWww && www.leida === 'https://minegocio.com', JSON.stringify(www));
  const utm = linkParaLeer('minegocio.com/landing?utm_source=fb&fbclid=xyz');
  assert.ok(utm.ok && utm.leida === 'https://minegocio.com/landing', JSON.stringify(utm));
  for (const u of ['https://www.minegocio.com/?page_id=245', 'https://pay.hotmart.com/X123?off=abc', 'https://drive.google.com/open?id=1AbC']) {
    const x = linkParaLeer(u);
    assert.equal(x.ok, false, u);
    if (!x.ok) assert.match(x.error, /pégalo aquí/);
  }
  assert.equal(linkParaLeer('http://no es un link').ok, false);
});

// rotura (esperaCAS fija, sin crecer): 1 fallo, 18 pases. rotura (ofertaYaAnotada sin mirar la versión): 1 fallo, 18 pases.
// rotura (ligadaParaVista con la lectura fallida como false): 1 fallo, 18 pases
test('el CAS espera cada vez más; «Guardar» dos veces gana la ya anotada de ESTA versión; y la vista sólo invita a ligar si la lectura lo dijo', () => {
  assert.ok(INTENTOS_CAS >= 10);
  assert.deepEqual([0, 1, 2, 3].map((i) => esperaCAS(i, 0)), [60, 120, 240, 480]);
  assert.equal(esperaCAS(9, 0), 1_500, 'con techo');
  assert.equal(esperaCAS(9, 1), 1_620, 'con azar');
  const total = Array.from({ length: INTENTOS_CAS }, (_, i) => esperaCAS(i, 0)).reduce((a, b) => a + b, 0);
  assert.ok(total >= 5_000, `aguanta una tanda de varios segundos (${total} ms)`);
  assert.equal(ofertaYaAnotada({ ofertaId: 7, ofertaVersion: 2 }, 2, 9), 7);
  assert.equal(ofertaYaAnotada({ ofertaId: 9, ofertaVersion: 2 }, 2, 9), null, 'la propia no es «otra»');
  assert.equal(ofertaYaAnotada({ ofertaId: 7, ofertaVersion: 1 }, 2, 9), null, 'la de otra versión no cuenta');
  assert.equal(ofertaYaAnotada({ ofertaId: null, ofertaVersion: null }, 2, 9), null);
  assert.equal(ligadaParaVista({ funnelId: 3, ofertaId: 7 }, false), false);
  assert.equal(ligadaParaVista({ funnelId: 3, ofertaId: 7 }, undefined), true, 'la lectura fallida no invita a reintentar');
  assert.equal(ligadaParaVista({ funnelId: 3, ofertaId: 7 }, true), true);
  assert.equal(ligadaParaVista({ funnelId: null, ofertaId: 7 }, false), true);
  assert.equal(ligadaParaVista({ funnelId: 3, ofertaId: null }, false), true);
});

// rotura (validadorConRespaldo sin respaldo: el flojo se tira): 1 fallo, 18 pases. rotura (sin cortar tras los flojos):
// 1 fallo, 18 pases
test('el turno con la obligatoria: uno que trae las piezas sin adaptar la pregunta se acepta de RESPALDO, y la cascada corta a la segunda', () => {
  const sinPregunta = JSON.stringify({ respuesta: 'Anotado.', opciones: [], piezas: { precio: '2.500 USD' }, listo: false, diagnostico: null, diagnostico_respuesta: null });
  const conPregunta = JSON.stringify({
    respuesta: '', opciones: [], piezas: {}, listo: false,
    diagnostico: { texto: '¿Cuánto facturas al mes?', opciones: ['a', 'b', 'c', 'd', 'e'] }, diagnostico_respuesta: null,
  });
  const v = validadorConRespaldo(parseTurnoConDiagnostico, parseTurno);
  assert.equal(v.validar('no es json'), false);
  assert.equal(v.validar(sinPregunta), false, 'el primero flojo se guarda y se sigue buscando');
  assert.equal(v.resultado()?.piezas.precio, '2.500 USD', 'las piezas que dio el dueño no se pierden');
  assert.equal(v.fueRespaldo(), true);
  assert.equal(v.validar(sinPregunta), true, `a la ${FLOJOS_ANTES_DE_CORTAR}ª floja se corta`);
  // Una que adapta la pregunta gana sobre el respaldo y corta en el acto.
  const w = validadorConRespaldo(parseTurnoConDiagnostico, parseTurno);
  w.validar(sinPregunta);
  assert.equal(w.validar(conPregunta), true);
  assert.equal(w.resultado()?.diagnostico?.texto, '¿Cuánto facturas al mes?');
  assert.equal(w.fueRespaldo(), false);
  // Sin flojo (los otros pedidos), lo de siempre.
  const z = validadorConRespaldo(parseTurnoConDiagnostico);
  assert.equal(z.validar(sinPregunta), false);
  assert.equal(z.resultado(), null);
});
