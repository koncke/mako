// =============================================================================
// Offer: las 13 respuestas de Martín a «A definir» del Offer Playbook, EJECUTADAS
// =============================================================================
// Pedido (12/10/2026), textual: «1. A 2. A 3. B, nadie dijo que no la pudiesen pagar... 4. A 5. A, y también
// falta lo de escalera de valor... 6. A, y siempre debe preguntar si tiene más ofertas... 7. A 8. A 9. A
// 10. A 11. A 12. C, y sería bueno que MaKo en el mismo chat te proponga pulir la oferta, y que cuando se
// haya pulido te re-envie el PDF las veces que sea necesario con la versión final... 13. A». Las tarjetas
// viven en app/admin/offer-playbook/pendientes.ts; el dónde, en docs/hallazgos-offer.md.
//
// Lo de acá es lo PURO (lib/offer-marco.ts y lib/offer-reglas.ts), con datos. El cableado de la ruta, los
// prompts y GET /api/offer/pdf está en tests/offer-ia-cableado.test.ts; el PDF, en tests/offer-pdf.test.ts.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (12/10/2026, arnés romper-a-definir.mjs en el scratchpad de la sesión:
// rompe UNA cosa, corre el test que la persigue y restaura DE MEMORIA). La base en verde antes de cada
// rotura (10 de 10); 23 roturas, las 23 cazadas; los números, al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARCA_COMPLETAR, MARCO_OFERTA_TEXTO, DIMENSIONES, PIEZAS, PIEZAS_MINIMAS, PREGUNTAS_GUIA, faltanMinimas,
  type NotaDimension, type PiezasSabidas,
} from '../lib/offer-marco';
import {
  OPCION_ASI_ESTA_BIEN, OPCION_PULIR, TOPES_PROPUESTA, VALOR_TOTAL_SIN_DATO, alertaFoco, alertaMargen, alertasEmbudo,
  alertasPrecio, avisosAntesDelDiagnostico, calcularDiagnostico, cifrasDelNegocio, claveCifra, conclusionDeVersion,
  duracionEnDias, filtrarCifras, mensajePdf, ofertasDeclaradas, parseDiagnostico, parsePropuesta, porcentajeAlFirmar,
  provisionalDe, resultadoMedible, respuestaSinIA, sanearMensajes,
} from '../lib/offer-reglas';

const AT = '2026-10-12T12:00:00.000Z';
const pieza = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const notas = (ns: number[]): NotaDimension[] =>
  ns.map((n, i) => ({ id: `D${i + 1}` as NotaDimension['id'], nota: n, porque: 'p', mejora: 'm' }));

/** Un negocio con todo lo mínimo anotado y lo que el control final mira. */
const COMPLETAS: PiezasSabidas = {
  cliente: pieza('Dueños de clínicas dentales que facturan 20.000 USD al mes'),
  problema: pieza('Agenda con huecos todas las semanas'),
  resultado: pieza('Sumar 20 pacientes nuevos en 90 días'),
  entregables: pieza('Ruta de 3 fases, 12 sesiones grupales y plantillas'),
  precio: pieza('3.000 USD'),
  ventas: pieza('9 personas pagaron'),
  prueba: pieza('6 lograron el resultado, con 15 pacientes promedio'),
  garantia: pieza('Si asiste al 80% y no suma 10 pacientes, seguimos gratis'),
};

const propuesta = (over: Record<string, unknown> = {}) => ({
  nombre: 'Agenda Llena', frase: 'Ayudo a dueños de clínicas a sumar 20 pacientes en 90 días con 3 pasos.',
  mensajes: { corto: 'Agenda llena en 90 días', largo: 'x', entrada: 'y' },
  paraQuien: { perfil: 'Dueños de clínicas', minimo: 'Facturan', noEs: 'Recién empiezan' },
  problema: { hoy: 'Huecos', despues: 'Llena', obstaculos: ['Anuncios caros'], yaProbo: 'Agencias' },
  mecanismo: { nombres: ['Ruta del Paciente (propuesta)', 'Agenda en 3 Pasos (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'No depende de anuncios' },
  ruta: [{ fase: 'Arranque', objetivo: 'a', hito: 'b' }, { fase: 'Sistema', objetivo: 'a', hito: 'b' }, { fase: 'Escala', objetivo: 'a', hito: 'b' }],
  incluye: [{ nombre: 'Sesiones', beneficio: 'Acompañamiento' }],
  formato: 'Grupal, 90 días', prueba: '6 clínicas sumaron 15 pacientes.',
  garantia: { nombre: 'Garantía Agenda', condiciones: 'Hacer las tareas', plazo: '90 días', siNoCumple: 'Seguimos gratis' },
  bonos: [{ nombre: 'Guion de llamada', objecion: 'No sé vender', valor: '[completar]' }],
  inversion: { valorTotal: '[completar]', precio: '3.000 USD', contado: '2.700 USD', plan: '2 pagos de 1.500 USD', comoDecirlo: 'Primero el valor.' },
  urgencia: '[completar]', escenarios: { mejor: 'Agenda llena', peor: 'Aprendes el método' },
  ecuacion: [{ variable: 'tiempo', antes: '6 meses', despues: '90 días' }],
  numeros: ['Margen 80%'], validar: ['3 ventas'], siguiente: 'Programa anual',
  ...over,
});

// ── 1. cifras ────────────────────────────────────────────────────────────────

// rotura (filtrarCifras devolviendo el texto tal cual: el filtro todo o nada de antes): 1 fallo, 9 pases.
// rotura (claveCifra sin los decimales: «2,5» = 25): 1 fallo, 9 pases.
test('1 · cifras: por CIFRA, contra lo que dio el negocio; un plazo o un rótulo no son cifras del negocio', () => {
  assert.deepEqual(['3.000', '3,000', '3000'].map(claveCifra), ['3000', '3000', '3000']);
  assert.deepEqual(['2,5', '2.5', '10k', '10 mil', '40%'].map(claveCifra), ['2.5', '2.5', '10000', '10000', '40']);
  const dadas = cifrasDelNegocio(['Ya pagaron 37 clínicas', 'Cobro 3,000 dólares']);
  assert.equal(filtrarCifras('37 clínicas sumaron 15 pacientes y un 40% más.', dadas), `37 clínicas sumaron ${MARCA_COMPLETAR} pacientes y un ${MARCA_COMPLETAR} más.`);
  assert.equal(filtrarCifras('El precio: 3.000 USD.', dadas), 'El precio: 3.000 USD.');
  // Con `plazos`: «en 90 días» y «3 pasos» los propone MaKo; «20 pacientes» es un resultado.
  assert.equal(filtrarCifras('Suma 20 pacientes en 90 días con 3 pasos.', new Set(), { plazos: true }), `Suma ${MARCA_COMPLETAR} pacientes en 90 días con 3 pasos.`);
  // Un rótulo y un año nunca son cifras del negocio.
  assert.equal(filtrarCifras('Fase 1: arranca en noviembre de 2026.', new Set()), 'Fase 1: arranca en noviembre de 2026.');
  // En la propuesta: el valor total, el valor de un bono, el stack y los resultados de la frase.
  const p = parsePropuesta(propuesta({
    inversion: { valorTotal: '15.000 USD', precio: '3.000 USD', contado: '2.700 USD', plan: '2 pagos de 1.500 USD', comoDecirlo: 'Está valuado en 8.000; esta camada entra con 3.000.' },
    bonos: [{ nombre: 'Guion', objecion: 'No sé vender', valor: '700 USD' }],
  }), { precio: pieza('3.000 USD') });
  assert.ok(p);
  assert.equal(p.inversion.valorTotal, VALOR_TOTAL_SIN_DATO);
  assert.equal(p.bonos[0].valor, MARCA_COMPLETAR);
  assert.equal(p.inversion.comoDecirlo, `Está valuado en ${MARCA_COMPLETAR}; esta camada entra con 3.000.`);
  assert.equal(p.frase, `Ayudo a dueños de clínicas a sumar ${MARCA_COMPLETAR} pacientes en 90 días con 3 pasos.`);
  assert.equal(p.prueba, `${MARCA_COMPLETAR} clínicas sumaron ${MARCA_COMPLETAR} pacientes.`);
  // Lo que dijo el dueño en el chat o en un documento sí vale.
  const conFuentes = parsePropuesta(propuesta(), { precio: pieza('3.000 USD') }, { fuentes: ['Ya tengo 6 clínicas que sumaron 15 pacientes', 'sumar 20 pacientes'] });
  assert.equal(conFuentes?.prueba, '6 clínicas sumaron 15 pacientes.');
  assert.equal(conFuentes?.frase, 'Ayudo a dueños de clínicas a sumar 20 pacientes en 90 días con 3 pasos.');
});

// ── 2. lista ─────────────────────────────────────────────────────────────────

// rotura (lista sin mirar el control final): 1 fallo, 9 pases. rotura (resultadoMedible sin exigir el plazo): 1 fallo, 9 pases.
test('2 · lista: además de las notas, el control final del marco; cuando falla, dice qué punto falta', () => {
  const buenas = notas([8, 8, 7, 8, 7, 8, 8, 7, 8]);
  const ok = calcularDiagnostico(buenas, { piezas: COMPLETAS });
  assert.equal(ok.lista, true);
  assert.deepEqual(ok.controlFinal?.map((x) => x.punto), ['dolor', 'resultado', 'entregables', 'garantia', 'precio']);
  assert.ok(ok.controlFinal?.every((x) => x.ok));
  // Precio y cobro en 6: las notas ya no alcanzan para «lista» (ninguna baja de 5) pero falla el precio por valor.
  const sinPrecio = calcularDiagnostico(notas([8, 8, 7, 8, 7, 8, 6, 7, 8]), { piezas: COMPLETAS });
  assert.equal(sinPrecio.lista, false);
  assert.match(sinPrecio.controlFinal?.find((x) => x.punto === 'precio')?.porque ?? '', /Precio y cobro saca 6/);
  // El resultado sin plazo, y sin garantía.
  const flojo = calcularDiagnostico(buenas, { piezas: { ...COMPLETAS, resultado: pieza('Llenar la agenda'), garantia: pieza('sin dato: no da') } });
  assert.equal(flojo.lista, false);
  assert.deepEqual(flojo.controlFinal?.filter((x) => !x.ok).map((x) => x.punto), ['resultado', 'garantia']);
  assert.equal(resultadoMedible('10 clientes nuevos en 90 días'), true);
  assert.equal(resultadoMedible('Duplicar las ventas en 3 meses'), true);
  assert.equal(resultadoMedible('Más clientes'), false);
  assert.equal(resultadoMedible('20 pacientes nuevos'), false, 'sin plazo no es medible');
  // Sin piezas (la pestaña Criterio del Playbook) no hay control: decide sólo con notas.
  const soloNotas = calcularDiagnostico(buenas);
  assert.equal(soloNotas.lista, true);
  assert.equal(soloNotas.controlFinal, undefined);
});

// ── 3 · 4 · 8. lo que lee la IA ──────────────────────────────────────────────

// rotura (sacar las señales de alerta del texto de la rúbrica): 1 fallo, 9 pases. rotura (sacar la regla de las
// cuotas): 1 fallo, 9 pases.
test('3 · 4 · 8 · el marco que lee la IA: sin «10 a 15 casos», con los números del §4 y las reglas de cobro', () => {
  // 3: la garantía no exige los 10 a 15 casos de Molina (Martín: «nadie dijo que no la pudiesen pagar»).
  assert.doesNotMatch(MARCO_OFERTA_TEXTO, /10\s*(?:a|-|–)\s*15\s*casos/i);
  // 4: los números de las dimensiones, sus señales de alerta y la pregunta que las destraba.
  for (const ancla of ['Dinero × Dolor × Acceso de 75 o más', 'margen por debajo del 30%', 'margen entre 30% y 60%', 'de 70% a 80% o más',
    'entre 5 y 10 veces el precio', 'entre 50% y 75% al firmar', 'el plan de pagos no dura más que el programa']) {
    assert.ok(MARCO_OFERTA_TEXTO.includes(ancla), `falta «${ancla}»`);
  }
  for (const d of DIMENSIONES) {
    assert.ok(MARCO_OFERTA_TEXTO.includes(`Señales de alerta: ${d.alerta}`), `${d.id} sin señales de alerta`);
    assert.ok(MARCO_OFERTA_TEXTO.includes(`La destraba: «${d.destraba}»`), `${d.id} sin la pregunta que la destraba`);
  }
  // 8: las reglas de cobro y de bonos.
  for (const regla of ['al menos el 50% al inicio', 'primero se ofrecen 2 pagos', 'nunca duran más que el programa', 'de 4 a 5 veces el precio', 'Cada bono dice por qué se da', 'LTV:CAC']) {
    assert.ok(MARCO_OFERTA_TEXTO.includes(regla), `falta «${regla}»`);
  }
});

// ── 5 · 11. las preguntas y las mínimas ──────────────────────────────────────

// rotura (sacar la pregunta del valor anual de la guía): 1 fallo, 9 pases. rotura (la prueba deja de ser mínima): 1 fallo, 9 pases.
test('5 · 11 · la guía: las cuatro que destraban precio y entrega después de las mínimas, la escalera al final; ventas y prueba son mínimas', () => {
  const idx = (pieza: string) => PREGUNTAS_GUIA.findIndex((q) => q.pieza === pieza);
  const ultimaMinima = Math.max(...PIEZAS_MINIMAS.map(idx));
  for (const k of ['valor', 'costo', 'semana', 'cobro']) {
    assert.ok(idx(k) > ultimaMinima, `${k} va después de las mínimas`);
    assert.equal(PIEZAS.find((p) => p.key === k)?.minimo, false);
  }
  assert.equal(PREGUNTAS_GUIA[PREGUNTAS_GUIA.length - 1].pieza, 'escalera');
  assert.equal(PIEZAS.find((p) => p.key === 'escalera')?.label, 'Escalera');
  // Cada pieza mínima tiene su pregunta, y las dos de la prueba son preguntas DISTINTAS.
  for (const k of PIEZAS_MINIMAS) assert.ok(idx(k) >= 0, `${k} sin pregunta`);
  assert.ok(PIEZAS_MINIMAS.includes('ventas') && PIEZAS_MINIMAS.includes('prueba'));
  assert.match(PREGUNTAS_GUIA[idx('ventas')].pregunta, /pagaron/);
  assert.match(PREGUNTAS_GUIA[idx('prueba')].pregunta, /lograron el resultado/);
  // Un «no sé» cuenta (no traba el análisis) y queda como supuesto.
  const conNoSe: PiezasSabidas = { ...COMPLETAS, prueba: pieza('sin dato: no lleva la cuenta') };
  assert.deepEqual(faltanMinimas(conNoSe), []);
  const p = parsePropuesta(propuesta(), conNoSe);
  assert.deepEqual(p?.supuestos, ['Prueba: no lleva la cuenta']);
});

// ── 6 · 7. los avisos ────────────────────────────────────────────────────────

// rotura (alertaFoco sin sumar las otras ofertas): 1 fallo, 9 pases. rotura (alertaMargen con el corte en 50%): 1 fallo, 9 pases.
// rotura (alertasEmbudo sin el mínimo de asistencias): 1 fallo, 9 pases. rotura (sin el aviso de «más de 75% al firmar»): 1 fallo, 9 pases.
test('6 · los avisos: margen bajo 60%, dónde se cortan las ventas, cuándo subir el precio y las otras ofertas en el foco', () => {
  // La pregunta de las otras ofertas va temprano (MaKo la hace SIEMPRE).
  assert.ok(PREGUNTAS_GUIA.findIndex((q) => q.pieza === 'otras') <= 2);
  assert.equal(ofertasDeclaradas('2: un curso grabado y una mentoría'), 2);
  assert.equal(ofertasDeclaradas('No, sólo esta'), 0);
  assert.equal(ofertasDeclaradas('dos más'), 2);
  assert.equal(ofertasDeclaradas('sin dato: no quiso decir'), null);
  assert.match(alertaFoco({ productosActivos: 1, ofertasActivas: 1, bandaFacturacion: 1, otrasDeclaradas: 2 }) ?? '', /^Vendes 3 ofertas \(contando las que no están cargadas en MaKo\)/);
  // Margen: precio y costo leídos de lo que escribió el dueño; el aviso dice los números.
  assert.match(alertaMargen({ precio: pieza('2.000 USD'), costo: pieza('900 USD por cliente, atiendo 10 a la vez') }) ?? '', /2\.000 USD.*900 USD.*55%/);
  assert.equal(alertaMargen({ precio: pieza('2.000 USD'), costo: pieza('400 USD por cliente') }), null);
  assert.equal(alertaMargen({ precio: pieza('2.000 USD'), costo: pieza('15.000 pesos') }), null, 'monedas distintas: no se compara');
  // Embudo: contra los rangos del §6.4, con datos suficientes.
  const tasas = { show: 0.45, cierreCalificados: 0.18, cierreAsistencias: 0.15, asistieron: 40 };
  const emb = alertasEmbudo(tasas);
  assert.equal(emb.length, 2);
  assert.match(emb[0], /^Asiste el 45%/);
  assert.match(emb[1], /^Cierras el 18%/);
  assert.deepEqual(alertasEmbudo({ ...tasas, asistieron: 4 }), [], 'con 4 asistencias es ruido');
  // Precio: el % cobrado al firmar y el cierre.
  assert.equal(porcentajeAlFirmar('Me pagan el 100% al firmar'), 100);
  assert.equal(porcentajeAlFirmar('La mitad al firmar'), 50);
  assert.equal(porcentajeAlFirmar('Todo de contado'), 100);
  assert.match(alertasPrecio({ cobro: 90 })[0], /90% al firmar: más de 75%/);
  assert.match(alertasPrecio({ cobro: 30 })[0], /30% al firmar: menos de la mitad/);
  assert.deepEqual(alertasPrecio({ cobro: 60 }), []);
  assert.match(alertasPrecio({ cobro: null, tasas: { show: 0.7, cierreCalificados: 0.4, cierreAsistencias: 0.3, asistieron: 20 } })[0], /40% de las llamadas calificadas/);
  // Todo junto, en el orden en que lo lee la IA.
  const todo = avisosAntesDelDiagnostico({
    foco: { productosActivos: 1, ofertasActivas: 1, bandaFacturacion: null },
    piezas: { otras: pieza('3: dos cursos y una mentoría'), precio: pieza('1.000 USD'), costo: pieza('700 USD'), cobro: pieza('100%') },
    tasas,
  });
  assert.match(todo.foco ?? '', /^Vendes 4 ofertas/);
  assert.equal(todo.otras.length, 4);
});

// rotura (alertaFoco con el umbral viejo de 6 sin facturación): 2 fallos, 8 pases (cae también el 6, que cuenta las otras ofertas sin facturación). rotura (que salga con 10.000 o más): 1 fallo, 9 pases.
test('7 · foco: sin la facturación sale desde 3 ofertas; con 10.000 al mes o más no sale', () => {
  assert.match(alertaFoco({ productosActivos: 3, ofertasActivas: 0, bandaFacturacion: null }) ?? '', /^Tienes 3 productos activos: en la fase 1/);
  assert.equal(alertaFoco({ productosActivos: 2, ofertasActivas: 0, bandaFacturacion: null }), null);
  assert.equal(alertaFoco({ productosActivos: 8, ofertasActivas: 8, bandaFacturacion: 2 }), null);
  assert.equal(alertaFoco({ productosActivos: 1, ofertasActivas: 1, bandaFacturacion: 3, otrasDeclaradas: 5 }), null);
  assert.ok(alertaFoco({ productosActivos: 0, ofertasActivas: 3, bandaFacturacion: 1 }));
});

// ── 9. topes ─────────────────────────────────────────────────────────────────

// rotura (sin cortar las fases a 5): 1 fallo, 9 pases. rotura (sin completar los cambios del diagnóstico): 1 fallo, 9 pases.
test('9 · topes: 3 a 5 fases, 1 a 3 bonos, 2 o 3 nombres del método y 3 cambios; lo que falta queda «[completar]»', () => {
  const fase = (i: number) => ({ fase: `F${i}`, objetivo: 'a', hito: 'b' });
  const larga = parsePropuesta(propuesta({ ruta: [1, 2, 3, 4, 5, 6, 7].map(fase), bonos: [1, 2, 3, 4].map((i) => ({ nombre: `B${i}`, objecion: 'x', valor: '[completar]' })) }), COMPLETAS);
  assert.equal(larga?.ruta.length, TOPES_PROPUESTA.fasesMax);
  assert.equal(larga?.bonos.length, TOPES_PROPUESTA.bonosMax);
  const corta = parsePropuesta(propuesta({ ruta: [fase(1)], bonos: [], mecanismo: { nombres: ['Uno (propuesta)'], pasos: ['a'], distinto: 'b' } }), COMPLETAS);
  assert.ok(corta);
  assert.equal(corta.ruta.length, TOPES_PROPUESTA.fasesMin);
  assert.ok(corta.ruta.slice(1).every((f) => f.fase.startsWith(MARCA_COMPLETAR)));
  assert.equal(corta.bonos.length, 1);
  assert.ok(corta.bonos[0].nombre.startsWith(MARCA_COMPLETAR));
  assert.equal(corta.mecanismo.nombres.length, TOPES_PROPUESTA.nombresMin);
  assert.ok(corta.mecanismo.nombres[1].startsWith(MARCA_COMPLETAR));
  assert.ok(corta.completar.some((c) => c.startsWith('Fase 2')));
  // El diagnóstico: 3 cambios; con uno, los otros dos quedan «[completar]».
  const d = parseDiagnostico(JSON.stringify({
    dimensiones: notas([6, 7, 5, 4, 6, 7, 5, 3, 8]), tesis: 'La promesa es clara.', fuerte: 'f',
    cambios: [{ titulo: 'Sumar casos', porque: 'p', hipotesis: 'h' }],
  }));
  assert.equal(d?.cambios.length, 3);
  assert.ok(d?.cambios.slice(1).every((c) => c.titulo.startsWith(MARCA_COMPLETAR)));
});

// ── 10. lo que propuso MaKo ──────────────────────────────────────────────────

// rotura (sin lo que el código sabe con certeza: sólo lo que dijo el modelo): 1 fallo, 9 pases.
test('10 · lo que propuso MaKo: lo que dijo el modelo más lo que el código sabe (precio, garantía, nombres, fases, bonos, plazos)', () => {
  const p = parsePropuesta(propuesta({
    inversion: { valorTotal: '[completar]', precio: '4.500 USD', contado: '4.000 USD', plan: '2 pagos de 2.250 USD', comoDecirlo: 'x' },
    propuestoPorMako: [{ seccion: 'Urgencia', que: 'Una cohorte el primer lunes de cada mes' }, { seccion: 'Inversión', que: 'Precio: 4.500 USD' }],
  }), { ...COMPLETAS, precio: pieza('Todavía no lo sé'), garantia: pieza('sin dato: no da') });
  assert.ok(p);
  const que = (p.propuestoPorMako ?? []).map((x) => `${x.seccion} · ${x.que}`);
  assert.ok(que.includes('Inversión · Precio: 4.500 USD'), que.join(' | '));
  assert.ok(que.some((x) => x.startsWith('Garantía · Garantía Agenda')), que.join(' | '));
  assert.ok(que.some((x) => x.startsWith('Método · Nombres: Ruta del Paciente · Agenda en 3 Pasos')), que.join(' | '));
  assert.ok(que.some((x) => x.startsWith('Ruta · 3 fases')), que.join(' | '));
  assert.ok(que.includes('Bonos · Guion de llamada'), que.join(' | '));
  assert.ok(que.includes('Urgencia · Una cohorte el primer lunes de cada mes'), que.join(' | '));
  assert.equal(que.filter((x) => x.includes('Precio: 4.500 USD')).length, 1, 'sin repetir lo que también dijo el modelo');
  // El precio que dio el dueño no es una propuesta de MaKo.
  const delDueno = parsePropuesta(propuesta(), COMPLETAS);
  assert.ok(!(delDueno?.propuestoPorMako ?? []).some((x) => x.seccion === 'Inversión'));
});

// ── 12. rehacer: provisional y el PDF en el chat ─────────────────────────────

// rotura (provisionalDe sin mirar la promesa): 1 fallo, 9 pases. rotura (el mensaje del PDF sin la versión): 1 fallo, 9 pases.
// rotura (conclusionDeVersion cayendo a la última con una versión que no existe): 1 fallo, 9 pases.
test('12 · rehacer: precio y bonos provisionales con cliente o promesa en 3 o menos; el PDF de cada versión vuelve al chat', () => {
  assert.deepEqual(provisionalDe({ dimensiones: notas([3, 8, 8, 8, 8, 8, 8, 8, 8]) })?.partes, ['precio', 'bonos']);
  assert.match(provisionalDe({ dimensiones: notas([8, 2, 8, 8, 8, 8, 8, 8, 8]) })?.motivo ?? '', /^Promesa saca 2/);
  assert.equal(provisionalDe({ dimensiones: notas([4, 4, 8, 8, 8, 8, 8, 8, 8]) }), null);
  const m = mensajePdf({ version: 3, dimensiones: notas([3, 8, 8, 8, 8, 8, 8, 8, 8]), cuello: 'D1', lista: false, id: 'x', at: AT });
  assert.deepEqual(m.pdf, { version: 3 });
  assert.deepEqual(m.opciones, [OPCION_PULIR, OPCION_ASI_ESTA_BIEN]);
  assert.match(m.texto, /versión 3.*Empezaría por «Cliente ideal».*provisionales/);
  assert.match(mensajePdf({ version: 1, dimensiones: notas([8, 8, 5, 8, 8, 8, 8, 8, 8]), cuello: 'D3', lista: false, id: 'x', at: AT }).texto, /Empezaría por «Diferenciación», que es lo que más la frena/);
  // El PDF sobrevive al saneo de la base, sólo en mensajes de MaKo y con una versión entera.
  const s = sanearMensajes([{ ...m }, { id: 'y', de: 'yo', texto: 'hola', at: AT, pdf: { version: 2 } }, { id: 'z', de: 'mako', texto: 'x', at: AT, pdf: { version: 1.5 } }]);
  assert.deepEqual(s.map((x) => x.pdf), [{ version: 3 }, undefined, undefined]);
  // «Así está bien» después del PDF lo contesta el código; sin PDF antes, la IA.
  const tras = respuestaSinIA([m, { de: 'yo' }], 'así está bien', { id: 'r', at: AT });
  assert.match(tras?.texto ?? '', /la versión 3 es la final/);
  assert.equal(respuestaSinIA([{ de: 'mako' }, { de: 'yo' }], OPCION_ASI_ESTA_BIEN, { id: 'r', at: AT }), null);
  assert.equal(respuestaSinIA([m, { de: 'yo' }], 'Pulir la oferta', { id: 'r', at: AT }), null);
  // La versión del PDF: la que se pide, o la última; nunca otra.
  const vs = [{ version: 1 }, { version: 2 }, { version: 3 }];
  assert.equal(conclusionDeVersion(vs, 2)?.version, 2);
  assert.equal(conclusionDeVersion(vs, null)?.version, 3);
  assert.equal(conclusionDeVersion(vs, 7), null);
  assert.equal(conclusionDeVersion([], null), null);
});

// ── 13. las reglas que dependían de la IA ────────────────────────────────────

// rotura (sin el aviso de duración): 1 fallo, 9 pases. rotura (sin quitar la garantía incondicional): 1 fallo, 9 pases.
// rotura (sin el sufijo «(propuesta)»): 1 fallo, 9 pases.
test('13 · reglas-ia: duración de 90 a 180 días, precio desde 1.000 USD, garantía condicional y nombres del método como propuesta', () => {
  assert.deepEqual(['12 semanas', '6 meses', '90 días', '1 año', 'grupal'].map(duracionEnDias), [84, 180, 90, 365, null]);
  const p = parsePropuesta(propuesta({
    formato: 'Grupal, 12 semanas', inversion: { valorTotal: '[completar]', precio: '800 USD', contado: '700 USD', plan: '2 pagos de 400', comoDecirlo: 'x' },
    garantia: { nombre: 'Garantía incondicional', condiciones: 'Devolución sin preguntas', plazo: '30 días', siNoCumple: 'Te devolvemos todo' },
    mecanismo: { nombres: ['Ruta del Paciente', 'Método Sonrisa Plena'], pasos: ['a'], distinto: 'b' },
  }), COMPLETAS, { negocio: 'Sonrisa Plena' });
  assert.ok(p);
  assert.ok((p.avisos ?? []).some((a) => /84 días/.test(a)), (p.avisos ?? []).join(' | '));
  assert.ok((p.avisos ?? []).some((a) => /800 USD.*1\.000 USD/.test(a)), (p.avisos ?? []).join(' | '));
  assert.ok((p.avisos ?? []).some((a) => /incondicional/.test(a)));
  assert.ok(p.garantia.condiciones.startsWith(MARCA_COMPLETAR));
  assert.ok(p.garantia.nombre.startsWith(MARCA_COMPLETAR));
  assert.equal(p.mecanismo.nombres[0], 'Ruta del Paciente (propuesta)');
  assert.ok(p.mecanismo.nombres[1].startsWith(MARCA_COMPLETAR), 'el nombre del negocio no va en el del método');
  // Dentro de las reglas, ningún aviso.
  assert.deepEqual(parsePropuesta(propuesta(), COMPLETAS)?.avisos, []);
});
