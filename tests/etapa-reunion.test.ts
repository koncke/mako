// =============================================================================
// «Es una reunión» en el editor de etapas del CRM
// =============================================================================
// Pedido de Martín (09/10/2026, vía el chat de Chatbot): «dentro del editor de etapas en el CRM,
// debería poder seleccionarse qué etapas hacen referencia a una REUNIÓN». Ver
// lib/etapa-reunion.ts.
//
// Verificado en ws3 el 09/10 (scratchpad/reunion-ws3.mts, con la misma transformación que la
// action): desmarcar «Agenda R2» guardó `kind: 'paso'`, bajó el nivel de Facturando de 4 a 2 y
// el de Ganado de 5 a 3, y sacó 6 transiciones (las de no-show y «asistió, no compró» de la R2).
// Volver a marcarla dejó el embudo IDÉNTICO al de antes y las demás etapas intactas.
//
// Correr: npx tsx --test tests/etapa-reunion.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez, 5 tests: dejar marcar cualquier
// etapa salvo el cierre, dejar marcar las terminales, desmarcar a `undefined` en vez de
// `'paso'`, no contar las reuniones que se corren, no avisar la tercera sin lugar, sacar el
// guardia de la action y marcar sin preguntar cuando una reunión se corre: 4 / 1 cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puedeSerReunion, tipoAlMarcar, cambioDeReuniones, reunionSinLugar, pareceReunion, tieneEtapaDeReunion,
  tipoDeEtapa, conTipo, reunionPorNombre } from '../lib/etapa-reunion';
import { generateFunnel, mergeFunnelData, etapasVisibles, type Stage } from '../lib/pipeline';
import { reunionesDe } from '../lib/funnel-etapas';
import { filaAFunnel } from '../lib/funnel-fila';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// El embudo de plantilla de ws3, con una etapa de paso sumada al medio.
const EMBUDO = [
  { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
  { key: 'st0', label: 'Calificado', kind: 'paso' },
  { key: 'agenda', label: 'Agenda R1', kind: 'reunion' },
  { key: 'agendaj2', label: 'Agenda R2', kind: 'reunion' },
  { key: 'st1', label: 'Propuesta', kind: 'paso' },
  { key: 'facturando', label: 'Facturando', kind: 'pago' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre' },
];

test('qué etapa se puede marcar: las de paso y las reuniones; nunca entrada, pago, cierre ni terminales', () => {
  assert.equal(puedeSerReunion({ key: 'st0', kind: 'paso' }), true);
  assert.equal(puedeSerReunion({ key: 'st9' }), true, 'una etapa sin tipo es un paso');
  assert.equal(puedeSerReunion({ key: 'agenda', kind: 'reunion' }), true, 'tiene que poder desmarcarse');
  for (const kind of ['entrada', 'pago', 'cierre', 'grupo']) {
    assert.equal(puedeSerReunion({ key: 'x', kind }), false, `una etapa de ${kind} perdería su tipo`);
  }
  for (const key of ['ganado', 'perdido', 'descal', 'noresp']) {
    assert.equal(puedeSerReunion({ key, kind: 'paso' }), false, `${key} está en todos los embudos`);
  }
  assert.equal(tipoAlMarcar(true), 'reunion');
  assert.equal(tipoAlMarcar(false), 'paso', 'apagada vuelve a ser un paso, como una etapa nueva');
});

test('marcar una etapa ANTES de una reunión la corre de número; después, no', () => {
  // «Calificado» va antes de la R1: las dos reuniones que había pasan a ser la 2 y la 3.
  const antes = cambioDeReuniones(EMBUDO, 'st0', true);
  assert.deepEqual(antes.corridas.map((r) => [r.key, r.de, r.a]), [['agenda', 1, 2], ['agendaj2', 2, 3]]);
  // «Propuesta» va después: nadie se corre, pero es la tercera y no tiene dónde.
  const despues = cambioDeReuniones(EMBUDO, 'st1', true);
  assert.deepEqual(despues.corridas, []);
  assert.deepEqual(despues.sinLugar, ['st1']);
  // Desmarcar la R1 corre a la R2 al primer lugar.
  assert.deepEqual(cambioDeReuniones(EMBUDO, 'agenda', false).corridas.map((r) => [r.key, r.de, r.a]), [['agendaj2', 2, 1]]);
  // Desmarcar la última no corre a nadie.
  assert.deepEqual(cambioDeReuniones(EMBUDO, 'agendaj2', false).corridas, []);
});

test('la tercera reunión no tiene dónde guardar fecha ni asistencia', () => {
  const con3 = EMBUDO.map((e) => (e.key === 'st1' ? { ...e, kind: 'reunion' } : e));
  assert.equal(reunionSinLugar(con3, 'st1'), true);
  assert.equal(reunionSinLugar(con3, 'agenda'), false);
  assert.equal(reunionSinLugar(con3, 'agendaj2'), false);
});

test('la action lo decide del lado del server, con la misma regla', () => {
  const src = sinComentarios(leer('app/crm/actions.ts'));
  // La op `reunion` queda por una pestaña con el bundle de antes; la que manda el pop-up desde el
  // 12/10/2026 es `tipo`. Las dos con la MISMA guarda y por la MISMA función (`conTipo`).
  const i = src.indexOf("} else if (op.op === 'reunion') {");
  assert.ok(i > 0, 'falta la op reunion en editarEtapaAction');
  const rama = src.slice(i, src.indexOf("} else if (op.op === 'tipo') {", i));
  assert.match(rama, /if \(!puedeSerReunion\(st\)\) return \{ ok: false/, 'la action guarda lo que mande el navegador');
  assert.match(rama, /conTipo\(x, op\.es \? 'reunion' : 'etapa'\)/);
  const j = src.indexOf("} else if (op.op === 'tipo') {");
  assert.ok(j > 0, 'falta la op tipo en editarEtapaAction');
  const ramaTipo = src.slice(j, src.indexOf("} else if (op.op === 'agregar') {", j));
  assert.match(ramaTipo, /if \(!TIPOS_ETAPA\.includes\(op\.tipo\)\) return \{ ok: false/, 'un tipo inventado se guardaría');
  // Desde el sexto feedback del 12/10/2026 el tipo decide la BANDA: lo resuelve `cambiarTipo`
  // (lib/etapa-banda.ts), que valida con `puedeTenerTipo` (la entrada, el cierre y las terminales no
  // llevan tipo; el pago sí, y conserva el suyo). Su comportamiento se prueba en
  // tests/crm-etapas-banda-12-10.test.ts.
  assert.match(ramaTipo, /const r = cambiarTipo\(\{ pipeline, suppressed: actual\.suppressed, labels, ordenNutricion: ordenAhora \}, op\.key, op\.tipo, at\);/);
  assert.match(ramaTipo, /if \(!r\.ok\) return r;/);
  assert.match(sinComentarios(leer('lib/etapa-banda.ts')), /if \(!puedeTenerTipo\(enPipeline\)\) return \{ ok: false/, 'la entrada y el cierre perderían su lugar');
});

test('la pantalla pregunta antes de correr una reunión de número, y muestra el tipo sólo donde se puede', () => {
  const src = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  // Desde el sexto feedback del 12/10/2026 el desplegable va en TODAS (también Facturando y las de
  // nutrición): `puedeTenerTipo`, no `puedeSerReunion`.
  assert.match(src, /\{puedeTenerTipo\(e\) && \(\s*<SelectorTipo/);
  assert.match(src, /<SelectorTipo etapa=\{e\.label\} tipo="nutricion"/, 'las nutriciones no tienen el desplegable');
  assert.doesNotMatch(src, /<BotonReunion/, 'volvió el botón «Reunión» suelto');
  const f = src.slice(src.indexOf('const elegirTipo'), src.indexOf('const quitarEtapa'));
  assert.ok(f.length > 100 && f.length < 2600, `el recorte mide ${f.length}: está mirando otra cosa`);
  // Las reuniones se cuentan sobre la lista como QUEDARÍA (con la etapa que entra del recorrido en su lugar).
  assert.match(f, /cambioDeReuniones\(lista, e\.key, es\)/);
  assert.match(f, /aplicar\(\{ op: 'tipo', key: e\.key, tipo, \.\.\.\(at != null \? \{ at \} : null\) \}/);
  assert.match(f, /if \(!c\.corridas\.length\) \{ hacer\(\); return; \}/, 'sin nada que se corra, se marca sin fricción');
  assert.match(f, /setConfirmar\(/, 'si una reunión se corre de número, se pregunta');
});

// Punto 13 del feedback del 12/10/2026: detectar una reunión por el nombre de la etapa.
// Verificado rompiéndolo (12/10): sin NO_ES_REUNION, «No-show» y «Post agenda» pasan por
// reuniones (pass 6 / fail 1). Con la barra-b de ASCII en vez de los límites Unicode NO falla: hoy
// ninguna palabra de la lista termina en vocal acentuada.
test('pareceReunion: las palabras de Martín, con y sin acento, y lo que NO es una reunión', () => {
  for (const si of ['Reunión', 'reunion', 'Agenda R1', 'R2', 'Llamada de venta', 'Sesión 1', 'Demo', 'Agendado', 'Primera reunión']) assert.equal(pareceReunion(si), true, si);
  for (const no of ['No-show', 'No asistió', 'Post agenda', 'Lead entrante', 'Facturando', 'Prospección', 'Recordar', 'Agendario', '']) assert.equal(pareceReunion(no), false, no);
});

// Revisión del 12/10/2026: «No contestó la llamada» dice «llamada» y se marcaba sola; después de la
// R1 pasaba a ser la R2 (Facturando pedía fecha y asistencia de la R2, y nacían sus nutriciones).
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 13 / 0 de base: NO_ES_REUNION sin las
// formas de «la llamada no pasó» → 12 / 1.
test('pareceReunion: el nombre de una llamada que NO pasó no es una reunión, y no se marca sola', () => {
  for (const no of ['No contestó la llamada', 'Llamada perdida', 'No atendió la llamada', 'Reagendar llamada', 'Re-agendar reunión', 'Sin respuesta a la llamada', 'No respondió la llamada']) {
    assert.equal(pareceReunion(no), false, no);
  }
  for (const si of ['Llamada de venta', 'Agenda R1', 'Reunión agendada', 'Primera llamada']) assert.equal(pareceReunion(si), true, si);
  // El embudo del caso: una etapa así después de la R1 no se vuelve la R2.
  const embudo = [
    { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
    { key: 'agenda', label: 'Agenda R1', kind: 'reunion' },
    { key: 'st0', label: 'No contestó la llamada', kind: 'paso' },
    { key: 'facturando', label: 'Facturando', kind: 'pago' },
    { key: 'ganado', label: 'Ganado', kind: 'cierre' },
  ];
  assert.equal(reunionPorNombre(embudo, 'st0'), false, 'una llamada que no pasó quedó como la R2');
});

test('tieneEtapaDeReunion: la marcada cuenta siempre; la que se llama como una, si puede serlo', () => {
  assert.equal(tieneEtapaDeReunion([{ key: 'lead', label: 'Lead', kind: 'entrada' }, { key: 'x', label: 'Prospección', kind: 'paso' }]), false);
  assert.equal(tieneEtapaDeReunion([{ key: 'x', label: 'Lo que sea', kind: 'reunion' }]), true, 'marcada');
  assert.equal(tieneEtapaDeReunion([{ key: 'x', label: 'Agenda R1', kind: 'paso' }]), true, 'por el nombre');
  assert.equal(tieneEtapaDeReunion([{ key: 'ganado', label: 'Reunión ganada', kind: 'cierre' }]), false, 'una terminal no puede ser reunión');
  assert.equal(tieneEtapaDeReunion(null), false);
  // Lo que la persona eligió en el desplegable le gana al nombre (12/10/2026).
  assert.equal(tieneEtapaDeReunion([{ key: 'x', label: 'Llamada de nutrición', kind: 'paso', marcadaComo: 'nutricion' }]), false, 'marcada Nutrición');
  assert.equal(tieneEtapaDeReunion([{ key: 'x', label: 'Agenda R1', kind: 'paso', marcadaComo: 'etapa' }]), false, 'dicho a mano que no es reunión');
  // Con el embudo ENTERO (`cfg.stages`): un embudo de carrito no tiene reuniones, y la nutrición
  // generada «Reunión excepcional» (sin `kind`, banda nutrición) no puede abrir la pestaña.
  const carrito = generateFunnel([
    { key: 'lead', label: 'Lead entrante', dot: '#2F6DDB', tone: 'info', kind: 'entrada' },
    { key: 'checkout', label: 'Checkout', dot: '#C8870C', tone: 'accent', kind: 'pago' },
  ]).stages;
  assert.ok(carrito.some((s) => s.key === 'reunion_excepcional'), 'el ejemplo dejó de traer la nutrición «Reunión excepcional»');
  assert.equal(tieneEtapaDeReunion(carrito), false, 'una nutrición generada contó como reunión por su nombre');
});

// ── El TIPO de una etapa: Etapa / Reunión / Nutrición (feedback del 12/10/2026, puntos 3 y 13) ──
//
// ⚠️ PROBADO ROMPIÉNDOLO (12/10/2026), una rotura por vez, con el archivo entero en 11 / 0 de base
// (pases / fallos), y restaurando de memoria:
//   · `conTipo` deja la marca de Nutrición al pasar a Reunión                 → 10 / 1
//   · Nutrición se guarda como `kind: 'nutricion'` en vez de la marca          → 10 / 1 (cae
//     `puedeSerReunion`: la etapa dejaría de ofrecer el desplegable. Las transiciones NO cambian,
//     porque `generateFunnel` trata un kind desconocido como un paso — el riesgo de un kind nuevo
//     está en los otros ~40 lectores, no en éste)
//   · `reunionPorNombre` sin mirar `cambioDeReuniones`                        → 10 / 1
//   · `reunionPorNombre` sin respetar `marcadaComo`                           → 10 / 1
//   · `sanearPipeline` reconstruyendo la etapa campo por campo (sin la marca)   → 10 / 1
//   · `tieneEtapaDeReunion` contando por el nombre aunque haya `marcadaComo`    → 10 / 1
//   · `tieneEtapaDeReunion` contando por el nombre las nutriciones generadas   → 10 / 1
//   · renombrar sin `marcarSiPareceReunion`                                   → 10 / 1
//   · la pantalla sin el toast «Quedó como reunión»                           → 10 / 1
/** La forma que reciben las funciones del tipo: la de una etapa del pipeline, sin el resto. */
type E = { key: string; label?: string; kind?: string; marcadaComo?: string };

test('tipoDeEtapa y conTipo: Reunión es el kind; Etapa y Nutrición, un paso con su marca', () => {
  assert.equal(tipoDeEtapa({ key: 'a', kind: 'reunion' }), 'reunion');
  assert.equal(tipoDeEtapa({ key: 'a', kind: 'paso', marcadaComo: 'nutricion' }), 'nutricion');
  assert.equal(tipoDeEtapa({ key: 'a', kind: 'paso' }), 'etapa');
  assert.equal(tipoDeEtapa({ key: 'a' }), 'etapa', 'una etapa sin tipo es una etapa');
  const nut = conTipo<E>({ key: 'agenda', label: 'Agenda R1', kind: 'reunion' }, 'nutricion');
  assert.deepEqual([nut.kind, nut.marcadaComo], ['paso', 'nutricion'], 'Nutrición deja de ser reunión y es un paso');
  const reu = conTipo<E>({ key: 'st0', label: 'X', kind: 'paso', marcadaComo: 'nutricion' }, 'reunion');
  assert.equal(reu.kind, 'reunion');
  assert.ok(!('marcadaComo' in reu), 'una reunión no lleva la marca de Nutrición');
  const eta = conTipo<E>({ key: 'st0', label: 'X', kind: 'reunion' }, 'etapa');
  assert.deepEqual([eta.kind, eta.marcadaComo], ['paso', 'etapa'], 'salir de reunión es `paso`, nunca undefined');
  // Una etapa marcada Nutrición se sigue pudiendo cambiar de tipo.
  assert.equal(puedeSerReunion(conTipo<E>({ key: 'st0', kind: 'paso' }, 'nutricion')), true);
});

// ⚠️ HASTA EL 12/10/2026 ESTA GUARDA DECÍA LO CONTRARIO: «marcar Nutrición NO cambia transiciones ni
// reuniones». Martín lo dio vuelta en el sexto feedback de ese día: «si se coloca "Etapa" se desplaza
// automáticamente hacia arriba, y viceversa». Una etapa marcada Nutrición SALE del recorrido.
test('marcar Nutrición SACA la etapa del recorrido: queda guardada con su marca y se dibuja en la banda', () => {
  const base: Stage[] = EMBUDO.map((e) => ({ ...e, dot: '#2F6DDB', tone: 'info' } as Stage));
  const conNut = base.map((e) => (e.key === 'st1' ? conTipo(e, 'nutricion') : e));
  const sinElla = base.filter((e) => e.key !== 'st1');
  assert.deepEqual(generateFunnel(conNut).transitions, generateFunnel(sinElla).transitions, 'la nutrición siguió en el recorrido');
  assert.deepEqual(reunionesDe(conNut), reunionesDe(sinElla), 'cambiaron las reuniones');
  const col = generateFunnel(conNut).stages.find((s) => s.key === 'st1');
  assert.deepEqual([col?.band, col?.kind], ['nutricion', 'paso'], 'no se dibuja en la banda Nutrición');
  // Y la marca SOBREVIVE al guardado: lo que se escribe es `mergeFunnelData` y lo que se lee,
  // `filaAFunnel` (que pasa por `sanearPipeline`). Ida y vuelta por JSON, como la base.
  const guardado = JSON.parse(JSON.stringify(mergeFunnelData({}, conNut, [])));
  const leido = filaAFunnel({ id: 1, nombre: 'X', canal: null, data: guardado, declarado: true });
  assert.equal(leido.pipeline.find((s) => s.key === 'st1')?.marcadaComo, 'nutricion', 'el guardado la borró');
  const vis = etapasVisibles(leido.stages);
  assert.equal(vis.nutricion.find((s) => s.key === 'st1')?.marcadaComo, 'nutricion', 'el pop-up no la recibe entre las nutriciones');
  assert.ok(!vis.propias.some((s) => s.key === 'st1'), 'el pop-up la sigue listando entre las etapas');
});

test('reunionPorNombre: al crear o renombrar, el nombre la marca sola — salvo que corra otra reunión', () => {
  const con = (key: string, label: string, extra: Record<string, string> = {}) =>
    EMBUDO.map((e) => (e.key === key ? { ...e, label, ...extra } : e));
  // «Propuesta» va después de las dos reuniones: renombrarla «Llamada de cierre» no corre a nadie.
  assert.equal(reunionPorNombre(con('st1', 'Llamada de cierre'), 'st1'), true);
  // «Calificado» va ANTES de la R1: marcarla sola mudaría las fechas ya cargadas de la R1 y la R2.
  assert.equal(reunionPorNombre(con('st0', 'Llamada inicial'), 'st0'), false, 'corrió de número a otra reunión');
  // Lo que la persona eligió le gana al nombre.
  assert.equal(reunionPorNombre(con('st1', 'Llamada de cierre', { marcadaComo: 'etapa' }), 'st1'), false, 'pisó un «Etapa» elegido a mano');
  assert.equal(reunionPorNombre(con('st1', 'Llamada de cierre', { marcadaComo: 'nutricion' }), 'st1'), false, 'pisó una Nutrición');
  // Lo que no puede ser reunión, lo que ya lo es y lo que no lo dice, no.
  assert.equal(reunionPorNombre(con('lead', 'Agenda directa'), 'lead'), false, 'la entrada perdería su tipo');
  assert.equal(reunionPorNombre(EMBUDO, 'agenda'), false, 'ya es reunión');
  assert.equal(reunionPorNombre(con('st1', 'No-show'), 'st1'), false);
  assert.equal(reunionPorNombre(con('st1', 'Propuesta enviada'), 'st1'), false);
});

// Revisión del 12/10/2026: la op vieja `reunion` con es:false (09/10 al 12/10) guardaba la etapa
// desmarcada como `kind: 'paso'` SIN `marcadaComo`; renombrarla la volvía a marcar sola.
// ROTO A PROPÓSITO (12/10/2026), restaurando de memoria, contra 13 / 0 de base:
//   · `reunionPorNombre` sin mirar `labelAnterior`                         → 12 / 1
//   · la action sin pasarle el nombre de ANTES al renombrar                → 12 / 1
test('renombrar NO vuelve a marcar Reunión una etapa cuyo nombre YA lo decía: sólo cuando PASA a decirlo', () => {
  const desmarcada = EMBUDO.map((e) => (e.key === 'agendaj2' ? { ...e, kind: 'paso' } : e));
  const renombrada = desmarcada.map((e) => (e.key === 'agendaj2' ? { ...e, label: 'Agenda R2 (no usamos)' } : e));
  assert.equal(reunionPorNombre(renombrada, 'agendaj2', 'Agenda R2'), false, 'revirtió una decisión explícita');
  // El nombre de antes no lo decía: renombrarla a uno que sí, la marca como siempre.
  const st1 = EMBUDO.map((e) => (e.key === 'st1' ? { ...e, label: 'Llamada de cierre' } : e));
  assert.equal(reunionPorNombre(st1, 'st1', 'Propuesta'), true);
  // Al crear no hay nombre de antes.
  assert.equal(reunionPorNombre(st1, 'st1'), true);
  const src = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(src, /if \(enPipeline\) pipeline = marcarSiPareceReunion\(pipeline\.map\(\(st\) => \(st\.key === op\.key \? \{ \.\.\.st, label \} : st\)\), op\.key, pipeline\.find\(\(st\) => st\.key === op\.key\)\?\.label\);/,
    'renombrar dejó de pasar el nombre de antes');
});

test('la action marca sola al crear y al renombrar, y la pantalla lo dice con su deshacer', () => {
  const src = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(src, /if \(enPipeline\) pipeline = marcarSiPareceReunion\(/, 'renombrar dejó de mirar el nombre');
  assert.match(src, /pipeline = marcarSiPareceReunion\(\[\.\.\.pipeline\.slice\(0, at\), nueva, \.\.\.pipeline\.slice\(at\)\], key\)/, 'crear dejó de mirar el nombre');
  assert.match(src, /if \(!reunionPorNombre\(pl, key, labelAnterior\)\) return pl;/);
  const md = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(md, /if \(sola\) show\('Quedó como reunión', \(\) => aplicar\(\{ op: 'tipo', key: sola, tipo: 'etapa' \}\)\)/,
    'un cambio de tipo que nadie eligió pasa callado');
});
