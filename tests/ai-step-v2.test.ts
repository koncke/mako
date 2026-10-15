// =============================================================================
// AI Step v2 (décima tanda, Martín 11/10/2026, FEEDBACK AI STEP 1-8; docs/diseno-ai-step-v2.md)
// =============================================================================
// «solo permitir 1 caso por tarjeta de AI Step, y si quieren pueden crear otra tarjeta», «siempre va a estar
// vinculado a un medio», «lo primero es siempre definir el OBJETIVO», la libertad («no quiero que sea algo muy
// complejo de configurar»), responder con audio y el ensayo de objeciones. Lo que se EJECUTA acá:
//   · la expansión de VARIAS tarjetas por medio (`expandirPasoIA`), «Cualquier respuesta», «Sólo te avisa» y lo
//     que viaja al redactor (`DatosCasoIA` → `extrasDeCaso`);
//   · la puerta para lo viejo (`separarPasosIA`) y el plan de la migración (`planDeFila`, lib/ai-step-migrar.ts);
//   · las reglas (`validarGrafo`, `faltaEnCaso`), el saneo (`camposDelFlujo`, la quinta puerta);
//   · lo puro del ensayo y la voz: `leerObjeciones`, `escenarioDeAIStep`, `ejemplosDeCharla`,
//     `partirTextoParaVoz` y el bloque del redactor (`bloqueEscenario`). (El armado y la tabla de objetivos de la
//     décima se fueron en el cierre de la undécima: tests/ai-step-armar.test.ts cubre el armado de hoy.);
//   · el cableado del motor (lib/nutricion.ts es `server-only`): se fija leyendo el fuente sin comentarios.
//
// ⚠️ UNDÉCIMA TANDA (11/10/2026, docs/diseno-undecima-tanda.md §2 puntos 11-13): «Toda la cantidad de tarjetas de
// "AI Step" deberían ser una sola». Lo de este archivo que fijaba la forma de la décima se DIO VUELTA y se reescribió
// acá mismo: `separarPasosIA` es un alias que JUNTA, `planDeFila` y el script se retiraron, Publicar pide el objetivo
// y UN AI Step por medio, el saneo sube lo del objetivo a la tarjeta, «enseñar un caso» suma adentro, duplicar no
// y la voz se dice del AI Step. La expansión de varias tarjetas SIGUE (lo guardado así contesta igual hasta que se
// junte), y lo puro de la IA, el ensayo y la voz no cambió. Lo nuevo se prueba en tests/ai-step-unico.test.ts.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PasoGrafo, type CasoRespuesta,
  expandirPasoIA, escenariosDeRespuesta, juntarPasosIA, validarGrafo, validarParaGuardar, faltaEnCaso, escuchaPor,
  nodoPorId, raizRespuesta, raicesRespuesta, tarjetasSueltas, puedeSumarAIStep, esPasoIA, idDe,
  idRespuestaDeCaso, idAvisoDeCaso, idOtraCosa, AVISO_OTRA_COSA, AVISO_DE_CASO, TOPE_RESPONDER,
} from '../lib/flujo-grafo';
import { camposDelFlujo, agregarCasoAlGrafo } from '../lib/nutricion-grafo-motor';
import { loQueContesta } from '../lib/ai-step-migrar';
import { leerObjeciones, escenarioDeAIStep, ejemplosDeCharla } from '../lib/ai-step-ensayo';
import { partirTextoParaVoz, vozQueFalta, TOPE_TEXTO_AUDIO } from '../lib/ai-step-voz';
import { bloqueEscenario as bloqueRedactor, REGLA_NOTA_DE_VOZ } from '../lib/setter-conversacion';
import { bloqueEscenario as bloqueLead } from '../lib/chat-agent-escenarios';
import { grafoDeSecuencia, ID_ENTRADA, opcionesDelMas, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { duplicar, MOTIVO } from '../lib/flujo-edicion';
import { libertadDeCaso } from '../lib/ai-step-libertad';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** Una función del fuente, hasta la siguiente de primer nivel (su cierre real, no un número de caracteres). */
const fn = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${firma}`);
  const resto = src.slice(i + firma.length);
  const j = resto.search(/\n(?:export )?(?:async )?function |\nexport |\ntype |\nconst /);
  return src.slice(i, i + firma.length + (j >= 0 ? j : resto.length));
};

const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };
const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });
/** Una tarjeta AI Step v2: un caso. */
const tarjeta = (id: string, c: CasoRespuesta, o: Partial<PasoGrafo> = {}): PasoGrafo => ({ ...msg({ cuerpo: '' }), id, nodo: 'respuesta', paso_ia: true, casos: [c], si_no: null, ...o });

/** Una automatización v2 (la forma de la décima): su salida (m1) y tres AI Step de WhatsApp —contesta solo, cualquiera que sólo avisa— y uno de Instagram. */
const v2 = (): PasoGrafo[] => [
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  tarjeta('A', caso('ca', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada', objetivo: 'Que agende sin cifras', ejemplos: [{ lead: 'cuánto?', tu: 'lo vemos en la llamada' }], hasta: 'una' })),
  tarjeta('B', caso('cb', { titulo: 'Confirma', cuando: 'confirma', responder: 'Agradece', sola: true, audio: { voz: 'propia' } })),
  tarjeta('I', caso('ci', { titulo: 'Por IG', cuando: 'escribe por IG', responder: 'Hola' }), { medio: 'instagram' }),
  tarjeta('Q', caso('cq', { titulo: 'Lo demás', cuando: '', cualquiera: true, no_contesta: true, responder: 'guardado', avisar: true }), { otra_aviso: 'Revísalo' }),
];

// ── La expansión: varias tarjetas del medio en una (lo guardado en la forma de la décima, hasta que se junte) ──

test('expandir JUNTA las tarjetas del medio en la primera, deja las demás inertes EN SU ÍNDICE y deriva los ids de cada tarjeta', () => {
  const pasos = v2();
  const g = expandirPasoIA(pasos, { medio: 'whatsapp' });
  // Nada se corre: los cinco de antes en su lugar (`paso_actual`), lo nuevo al final.
  assert.deepEqual(g.slice(0, 5).map((p) => p.id), ['m1', 'A', 'B', 'I', 'Q']);
  const a = nodoPorId(g, 'A')!;
  assert.equal(a.paso_ia, undefined);
  // Los casos de A y de B (los de WhatsApp que no son «Cualquier respuesta»), cada uno con las tarjetas de SU tarjeta.
  assert.deepEqual(a.casos!.map((c) => [c.id, c.siguiente]), [['ca', idRespuestaDeCaso('A', 'ca')], ['cb', idRespuestaDeCaso('B', 'cb')]]);
  // «Cualquier respuesta» es el «Otra cosa»: no contesta (`no_contesta`), sólo avisa, con el aviso de «no sé contestar».
  assert.equal(a.si_no, idAvisoDeCaso('Q', 'cq'));
  assert.equal(nodoPorId(g, idRespuestaDeCaso('Q', 'cq')), null, '«Sólo te avisa» contestó');
  assert.deepEqual((nodoPorId(g, idAvisoDeCaso('Q', 'cq'))!.accion as { params: unknown }).params, { leadId: 'evento', titulo: 'Lo demás', mensaje: 'Revísalo' });
  // Las demás quedan inertes: sueltas, sin casos (la raíz es UNA).
  for (const id of ['B', 'I', 'Q']) assert.deepEqual([nodoPorId(g, id)!.suelta, nodoPorId(g, id)!.casos], [true, []], id);
  assert.equal(raizRespuesta(g), 'A');
  // Idempotente.
  assert.deepEqual(expandirPasoIA(g, { medio: 'whatsapp' }), g);
});

test('lo del caso de antes (sin juntar) VIAJA al redactor: objetivo, ejemplos y audio (sólo WhatsApp); «1 vez» ya NO (undécima)', () => {
  const esc = escenariosDeRespuesta(v2(), { medio: 'whatsapp' });
  assert.deepEqual(esc.map((e) => [e.titulo, e.objetivo ?? null, e.ejemplos?.length ?? 0, e.audio?.voz ?? null, e.hasta ?? null, e.contestaSolo === true]), [
    ['Precio', 'Que agende sin cifras', 1, null, null, false],
    ['Confirma', null, 0, 'propia', null, true],
  ]);
  // Por Instagram, la de Instagram (sin audio aunque lo dijera).
  const ig = escenariosDeRespuesta(v2().map((p) => (p.id === 'I' ? { ...p, casos: [{ ...p.casos![0], audio: { voz: 'propia' } }] } : p)), { medio: 'instagram' });
  assert.deepEqual(ig.map((e) => [e.titulo, e.audio ?? null]), [['Por IG', null]]);
});

test('sin AI Step del medio la automatización NO contesta por ahí; sin «Cualquier respuesta», «Otra cosa» es el aviso de siempre', () => {
  const soloIG = [msg({ id: 'm1', siguiente: null }), tarjeta('I', caso('ci', { responder: 'x' }), { medio: 'instagram' })];
  assert.equal(escuchaPor(soloIG, 'whatsapp'), false);
  assert.equal(escuchaPor(soloIG, 'instagram'), true);
  const sinQ = v2().filter((p) => p.id !== 'Q');
  const g = expandirPasoIA(sinQ);
  assert.equal(nodoPorId(g, 'A')!.si_no, idOtraCosa('A'));
  assert.equal((nodoPorId(g, idOtraCosa('A'))!.accion as { params: { mensaje: string } }).params.mensaje, AVISO_OTRA_COSA);
  // UNDÉCIMA: «Para aprobar» AVISA siempre (se deriva de la libertad, §9.15); en la décima hacía falta `avisar`.
  assert.equal((nodoPorId(g, idAvisoDeCaso('A', 'ca'))!.accion as { params: { mensaje: string } }).params.mensaje, AVISO_DE_CASO);
});

// ── La puerta para lo viejo: desde la undécima, JUNTAR (`juntarPasosIA`; el alias `separarPasosIA` se borró en la ola 4) ──

/** Un AI Step v1 (novena): tres casos y un tono, en el medio del array (la 202 de la #213 está en `o1`). */
const v1 = (): PasoGrafo[] => [
  msg({ id: 'o0', siguiente: 'o1' }),
  msg({ id: 'o1', siguiente: null }),
  { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, instrucciones: 'Cercano', otra_aviso: 'Mira', si_no: null, casos: [
    caso('A', { titulo: 'Confirma', responder: 'Agradece', sola: true }),
    caso('B', { titulo: 'Pregunta el precio', responder: 'En la llamada', avisar: true }),
    caso('C', { titulo: 'Puede no calificar', avisar: true }),
  ] },
];

test('la puerta para lo viejo JUNTA (undécima): un AI Step v1 queda UNO, con el tono plegado y sin `otra_aviso` — contesta igual salvo el texto de «Otra cosa», que se dice', () => {
  const s = juntarPasosIA(v1());
  const j = s;
  assert.equal(s.cambio, true);
  assert.deepEqual(s.perdidos.filter((x) => x.includes('no entra')), []);
  assert.deepEqual(s.pasos.map((p) => p.id), ['o0', 'o1', 'R'], 'corrió o partió algo');
  const r = s.pasos[2];
  assert.deepEqual(r.casos!.map((c) => c.id), ['A', 'B', 'C']);
  assert.deepEqual([r.instrucciones, r.otra_aviso], [undefined, undefined]);
  assert.equal(r.casos![0].responder, 'Tono: Cercano\nAgradece');
  assert.deepEqual(r.casos!.map((c) => libertadDeCaso(c)), ['sola', 'aprueba', 'avisa']);
  // LO QUE CONTESTA: los mismos casos, guía y «sale sola»; «Otra cosa» avisa con el texto de siempre (y se dice).
  const sinOtra = (x: string) => x.replace(/"otra":\{[^}]*\}/g, '');
  assert.equal(sinOtra(loQueContesta(s.pasos)), sinOtra(loQueContesta(v1())));
  assert.deepEqual(j.perdidos, [`«Otra cosa» avisaba «Mira»: ahora avisa «${AVISO_OTRA_COSA}»`]);
  // Con objetivo se publica; idempotente.
  assert.deepEqual(validarGrafo(s.pasos.map((p) => (esPasoIA(p) ? { ...p, objetivo: 'Que agende' } : p))), []);
  assert.equal(juntarPasosIA(s.pasos).cambio, false);
});

test('juntar: un tono que no entra NO se corta (la tarjeta lo conserva y se avisa); sin casos = un AI Step sin escenarios («Lo demás: Sólo te avisa»)', () => {
  const largo = v1().map((p) => (p.id === 'R' ? { ...p, otra_aviso: undefined, instrucciones: 'x'.repeat(900), casos: [caso('A', { responder: 'y'.repeat(TOPE_RESPONDER - 100) })] } : p));
  const s = juntarPasosIA(largo);
  assert.deepEqual(s.perdidos.filter((x) => x.includes('no entra')), ['«Caso A»: el tono no entra en la respuesta (queda en la tarjeta)']);
  assert.equal(s.pasos[2].instrucciones, 'x'.repeat(900));
  assert.equal(s.pasos[2].casos![0].responder, 'y'.repeat(TOPE_RESPONDER - 100));
  assert.equal(loQueContesta(s.pasos), loQueContesta(largo));
  const vacio = juntarPasosIA(v1().map((p) => (p.id === 'R' ? { ...p, otra_aviso: undefined, casos: [] } : p)));
  assert.deepEqual(vacio.pasos[2].casos, []);
  assert.equal(loQueContesta(vacio.pasos), loQueContesta(v1().map((p) => (p.id === 'R' ? { ...p, otra_aviso: undefined, casos: [] } : p))));
});

test('la migración de la décima se RETIRÓ: el script sale sin escribir y lib/ai-step-migrar.ts sólo compara', () => {
  const script = sinComentarios(leer('scripts/ai-step-v2.mts'));
  assert.match(script, /Retirado en la undécima: la forma vigente es UN AI Step por medio \(juntarPasosIA\)\. No se vuelve a correr\./);
  assert.match(script, /process\.exit\(1\);/);
  assert.doesNotMatch(script, /import|createClient|update\(/, 'el script retirado todavía lee o escribe');
  const mig = sinComentarios(leer('lib/ai-step-migrar.ts'));
  assert.deepEqual([...mig.matchAll(/^export (?:function|const|type) (\w+)/gm)].map((m) => m[1]), ['estable', 'loQueContesta']);
});

// ── Las reglas y el saneo ───────────────────────────────────────────────────────────────

test('Publicar (undécima): UN AI Step por medio y con objetivo; lo de la décima no se publica hasta juntarlo; la voz sólo por WhatsApp', () => {
  const err = validarGrafo(v2());
  assert.ok(err.includes('hay más de un AI Step de WhatsApp'), err.join(' | '));
  assert.ok(err.includes('falta el objetivo de la tarjeta B'), err.join(' | '));
  // Junto, con objetivo (el del caso de A sube a la tarjeta), se publica.
  const j = juntarPasosIA(v2());
  assert.deepEqual(validarGrafo(j.pasos.map((p) => (p.id === 'I' ? { ...p, objetivo: 'IG' } : p))), []);
  assert.equal(nodoPorId(j.pasos, 'A')!.objetivo, 'Que agende sin cifras');
  // La voz por Instagram (en la tarjeta o en un caso de antes) no.
  const audioIG = j.pasos.map((p) => (p.id === 'I' ? { ...p, objetivo: 'IG', audio: { voz: 'propia' } } : p));
  assert.ok(validarGrafo(audioIG).includes('en la tarjeta I, el audio sale sólo por WhatsApp'));
  // «Lo demás» no pide nombre ni cuándo; un escenario sin respuesta es «Sólo te avisa» (ya no hay «qué hace»).
  assert.equal(faltaEnCaso({ titulo: '', cuando: '', cualquiera: true }), null);
  assert.equal(faltaEnCaso({ titulo: 'x', cuando: 'z' }), null);
  assert.equal(faltaEnCaso({ titulo: 'x', cuando: '' }), 'cuando');
  // No se mezcla con un «Si responde» de los de siempre; UNO por medio.
  assert.ok(validarParaGuardar([...v2(), { ...msg(), id: 'S', nodo: 'respuesta', casos: [], si_no: null }]).includes('un AI Step no va con un «Si responde»'));
  assert.equal(puedeSumarAIStep(j.pasos), false);
  assert.equal(puedeSumarAIStep(j.pasos, 'messenger'), true);
  // Todas las que escuchan son raíces: ninguna es «suelta».
  assert.deepEqual(raicesRespuesta(v2()), ['A', 'B', 'I', 'Q']);
  assert.deepEqual(raicesRespuesta(j.pasos), ['A', 'I']);
  assert.deepEqual(tarjetasSueltas(j.pasos), []);
});

test('el saneo (`camposDelFlujo`, la quinta puerta) CONSERVA el medio, sube lo del objetivo a la tarjeta y el caso guarda sólo lo suyo', () => {
  const f = camposDelFlujo({
    id: 'X', nodo: 'respuesta', paso_ia: true, medio: 'instagram', si_no: null,
    casos: [{ id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', objetivo: '  Que agende  ', cualquiera: true, no_contesta: true, hasta: 'una',
      audio: { voz: 'propia' }, ejemplos: [{ lead: 'a', tu: 'b' }, { lead: '', tu: 'c' }, 'basura'] }],
  });
  assert.equal(f.medio, 'instagram');
  assert.deepEqual(f.casos![0], { id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', cualquiera: true, no_contesta: true });
  assert.deepEqual([f.objetivo, f.audio, f.ejemplos], ['Que agende', { voz: 'propia' }, [{ lead: 'a', tu: 'b' }]]);
  // WhatsApp no se escribe (ausente = WhatsApp); una voz que no es un id, tampoco.
  const g = camposDelFlujo({ id: 'X', nodo: 'respuesta', paso_ia: true, medio: 'whatsapp', audio: { voz: '<script>' }, casos: [{ id: 'c', titulo: 't', cuando: 'w', audio: { voz: '<script>' }, hasta: 'siempre' }] });
  assert.equal(g.medio, undefined);
  assert.equal(g.audio, undefined);
  assert.equal(g.casos![0].hasta, undefined);
});

test('enseñar un caso lo suma ADENTRO del AI Step (undécima); duplicar un AI Step ya no se puede (uno por medio)', () => {
  const r = agregarCasoAlGrafo(v2(), { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18' }, rndDe());
  assert.ok('pasos' in r);
  assert.equal(r.pasos.length, v2().length, 'creó una tarjeta');
  assert.deepEqual(nodoPorId(r.pasos, 'A')!.casos!.map((c) => c.titulo), ['Precio', 'Horario']);
  const d = duplicar(v2(), 'Q', rndDe());
  assert.deepEqual([d.ok, !d.ok && d.motivo], [false, MOTIVO.topeAIStep]);
});

test('el lienzo: una flecha del CRON por cada AI Step que escucha (lo de antes se ve hasta que se abre junto), y el ＋ ya no ofrece otro', () => {
  const g = grafoDeSecuencia(v2() as PasoParaGrafo[], { disparador: 'Llega' });
  for (const id of ['A', 'B', 'I', 'Q']) assert.ok(g.aristas.some((a) => a.desde === ID_ENTRADA && a.hasta === id), id);
  assert.ok(!opcionesDelMas(v2(), 'm1', false).some((o) => o.value === 'ai_step'));
  assert.ok(g.nodos.filter((n) => n.tipo === 'paso-ia').every((n) => n.alto === g.nodos.find((x) => x.id === 'A')!.alto), 'el alto no es fijo');
  assert.ok(v2().every((p, i) => idDe(p, i)));
});

// ── La IA, el ensayo y la voz (lo puro) ───────────────────────────────────────────────

// «Armar el resto» (el contrato de la décima: un caso por vez con `titulos`/`hayCualquiera`) se fue en la undécima: el
// armado devuelve { escenarios, lo_demas } y lo cubre tests/ai-step-armar.test.ts.

test('el ensayo: objeciones saneadas, un escenario SIN audio (no le miente al modelo) y los ejemplos son lead → tu respuesta', () => {
  assert.equal(leerObjeciones({ primer: 'hola', objeciones: ['una'] }), null, 'con una sola objeción no hay ensayo');
  const ob = leerObjeciones({ primer: ' cuánto sale? ', objeciones: ['Es caro', 'es caro', 'No tiene tiempo', 'Duda del resultado', 'Quiere pensarlo', 'Otra más'] })!;
  assert.deepEqual(ob, { primer: 'cuánto sale?', objeciones: ['Es caro', 'No tiene tiempo', 'Duda del resultado', 'Quiere pensarlo'] });
  const esc = escenarioDeAIStep({ objetivo: 'Que agende', escenarios: [{ titulo: 'Precio', cuando: 'pregunta el precio' }] }, ob, 'whatsapp');
  assert.equal(esc.evolucion.length, ob.objeciones.length + 2);
  const bloque = bloqueLead(esc, 0, '');
  assert.doesNotMatch(bloque, /nota de voz/, 'le dijo al modelo que el negocio mandó un audio');
  assert.match(bloque, /cuánto sale\?/);
  assert.deepEqual(ejemplosDeCharla([
    { de: 'lead', texto: 'cuánto?' }, { de: 'tu', texto: 'en la llamada' }, { de: 'lead', texto: 'ok' }, { de: 'mako', texto: 'genial' },
  ]), [{ lead: 'cuánto?', tu: 'en la llamada' }]);
});

test('la voz: dice el texto sin links ni emojis (los links van debajo), y el redactor sabe que es una nota de voz', () => {
  const p = partirTextoParaVoz('Hola 👋 te dejo el link: https://cal.com/x. Nos vemos! [tu link de agenda]');
  assert.equal(p.hablado, 'Hola te dejo el link: Nos vemos!');
  assert.deepEqual(p.pie.split('\n'), ['https://cal.com/x', '[tu link de agenda]']);
  assert.ok(TOPE_TEXTO_AUDIO >= 400);
  const b = bloqueRedactor({ titulo: 'Precio', cuando: 'x', comoResponder: 'En la llamada', objetivo: 'Que agende', ejemplos: [{ lead: 'a', tu: 'b' }], audio: { voz: 'propia' } });
  assert.match(b, /LO QUE ESTA RESPUESTA TIENE QUE LOGRAR[^\n]*: Que agende/);
  assert.match(b, /<ejemplos>\nLEAD: a\nNEGOCIO: b\n<\/ejemplos>/);
  assert.ok(b.includes(REGLA_NOTA_DE_VOZ));
  assert.ok(!bloqueRedactor({ titulo: 'x', cuando: 'y', comoResponder: 'z' }).includes(REGLA_NOTA_DE_VOZ));
  // El freno de Publicar/Activar: «Tu voz» sin clon, u otra voz que ya no está (sólo si contesta). UNDÉCIMA: la voz
  // es del AI Step (la de un caso de antes, sin juntar, también cuenta).
  assert.equal(vozQueFalta(v2(), { propia: true, otras: [] }), null);
  assert.equal(vozQueFalta(v2(), { propia: false, otras: [] }), 'El AI Step contesta en audio y todavía no clonaste tu voz');
  const otraVoz = v2().map((p) => (p.id === 'B' ? { ...p, casos: [{ ...p.casos![0], audio: undefined }], audio: { voz: 'abc12345XYZ' } } : p));
  assert.equal(vozQueFalta(otraVoz, { propia: true, otras: ['otra9999'] }), 'El AI Step contesta en audio y esa voz ya no está');
  assert.equal(vozQueFalta(v2().map((p) => (p.id === 'B' ? { ...p, suelta: true } : p)), { propia: false, otras: [] }), null, 'una suelta no escucha');
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(fn(nut, 'export async function validarActivacion('), /const sinVoz = await vozDeAIStepQueFalta\(/);
  // El atajo del freno async mira la voz del NODO (undécima) además de la de un caso de antes: con sólo la del caso,
  // un AI Step de hoy en audio con «Tu voz» sin clon se publicaba. Probado rompiéndolo (cierre de la ola 3,
  // wf-undecima/enchufador): sin `p.audio ||` → 12 / 1 (base 13 / 0).
  assert.match(fn(nut, 'export async function vozDeAIStepQueFalta('), /if \(!pasos\.some\(\(p\) => p && \(p\.audio \|\| \(p\.casos \?\? \[\]\)\.some\(\(c\) => c && c\.audio\)\)\)\) return null;/);
  assert.match(sinComentarios(leer('app/api/whatsapp/secuencias/route.ts')), /const sinVoz = await vozDeAIStepQueFalta\(body\.pasos as PasoSecuencia\[\]\)[\s\S]{0,120}if \(sinVoz\) return Response\.json\(/);
});

// La tabla de objetivos por caso de la décima (lib/ai-step-objetivos.ts) se borró en el cierre de la undécima: el
// objetivo es del AI Step (lo pone la persona, la plantilla o scripts/undecima-flujos.mts), no de cada caso.

// ── El cableado del motor (lib/nutricion.ts es `server-only`) ──────────────────────────

test('el motor: contesta por el MEDIO, le pasa lo del caso al redactor, y sin el audio pedido NO sale sola', () => {
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  const asistir = fn(nut, 'async function asistirRespuesta(');
  assert.match(asistir, /escuchaPor\(s\.pasos, medio\)/);
  assert.match(asistir, /if \(escuchaPor\(secuencia\.pasos, medio\)\) return responderConGrafo\(c, medio\);/);
  const grafo = fn(nut, 'async function responderConGrafo(');
  assert.match(grafo, /const pasos = expandirPasoIA\(secuencia\.pasos, \{ medio \}\);/);
  assert.match(grafo, /\.\.\.extrasDeCaso\(ia\),/);
  const red = fn(nut, 'async function redactarRespuesta(');
  // `!social` (TikTok fase 0, 14/10/2026): por las redes no hay audio (§6), tests/ai-step-redes.test.ts.
  assert.match(red, /if \(sugerida && !social && lead\?\.telefono && clas\.escenario\.audio\) \{\s*const r = await notaDeVozDeRespuesta\(/);
  assert.match(red, /if \(!social && !sinAudio && borradorOk && borradorId != null/, 'sin el audio salía sola igual');
  // Undécima tanda (punto 13): «Hasta» siempre es el objetivo. El corte «contestó una vez» se fue del redactor.
  assert.doesNotMatch(red, /unaVez|hasta === 'una'/, 'volvió el «Hasta: una respuesta»');
  // El tope de la voz: con `tope` no se corta, se rechaza.
  const ev = sinComentarios(leer('lib/elevenlabs.ts'));
  assert.match(fn(ev, 'export async function decirConVoz('), /if \(op\.tope != null && crudo\.length > op\.tope\) return \{ ok: false/);
  // Una respuesta en audio no cae en la biblioteca del dueño.
  assert.match(sinComentarios(leer('lib/setting-audios.ts')), /\.eq\('origen', 'biblioteca'\)/);
});

// ── ROTURAS (11/10/2026) ─────────────────────────────────────────────────────────────────
// Cada pieza rota a mano con un arnés que guarda el original en memoria y lo reescribe al final (scratchpad
// `aistep-roturas.mjs`, nunca `git checkout`; verifica que cada archivo vuelva byte a byte). Base: 15 / 0; al final,
// igual. «pass / fail» de este archivo:
//   R1 expandir sólo la PRIMERA tarjeta del medio (las demás dejan de contestar)  → 11 / 4
//   R2 `sanearCaso` sin `objetivo` (se borra al primer guardado)                   → 13 / 2 (también el plan: «el saneo cambiaría»)
//      — re-medido en el cierre (11/10): 14 / 1. El plan ya no escribe objetivos (revisión), así que lo caza sólo el test del saneo.
//   R3 `separarPasosIA` con las nuevas AL PRINCIPIO (corre el índice de todos)    → 13 / 2
//   R4 la voz que falla y la respuesta SALE SOLA igual (en texto, sin que nadie la mire) → 14 / 1
//   R5 dos «Cualquier respuesta» del mismo medio que se publican                  → 14 / 1
// UNDÉCIMA (11/10/2026, w1-aistep-modelo, mismo arnés de wf-undecima/w1-aistep-modelo/roturas.cjs). Base: 15 / 0.
//   R2, R3 y R5 rompían cosas que ya no existen (el saneo del objetivo del caso, `separarPasosIA` partiendo, dos
//   «Cualquier respuesta» en dos tarjetas). Lo que las reemplaza:
//   U1 `camposDelFlujo` sin subir el objetivo del caso al nodo                      → 14 / 1 (y ai-step-unico 11 / 1)
//   U2 el alias `separarPasosIA` vuelve a NO juntar (devuelve lo mismo)            → 13 / 2 (y ai-step-unico 11 / 1)
//   U3 `vozQueFalta` sin leer el audio del NODO                                   → 14 / 1 (sólo lo caza este archivo)
