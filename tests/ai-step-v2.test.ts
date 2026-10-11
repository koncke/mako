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
//   · lo puro de la IA y la voz: `repararArmado`, `leerObjeciones`, `escenarioDeCaso`, `ejemplosDeCharla`,
//     `partirTextoParaVoz`, el bloque del redactor (`bloqueEscenario`) y la tabla de objetivos;
//   · el cableado del motor (lib/nutricion.ts es `server-only`): se fija leyendo el fuente sin comentarios.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PasoGrafo, type CasoRespuesta,
  expandirPasoIA, escenariosDeRespuesta, separarPasosIA, validarGrafo, validarParaGuardar, faltaEnCaso, escuchaPor,
  nodoPorId, raizRespuesta, raicesRespuesta, tarjetasSueltas, puedeSumarAIStep, esPasoIA, idDe,
  idRespuestaDeCaso, idAvisoDeCaso, idOtraCosa, AVISO_OTRA_COSA, AVISO_DE_CASO, TOPE_RESPONDER, TOPE_AI_STEP_POR_MEDIO,
  ROTULO_CUALQUIERA,
} from '../lib/flujo-grafo';
import { camposDelFlujo, agregarCasoAlGrafo } from '../lib/nutricion-grafo-motor';
import { planDeFila, loQueContesta } from '../lib/ai-step-migrar';
import { objetivoDeCaso, OBJETIVO_PRECIO } from '../lib/ai-step-objetivos';
import { repararArmado } from '../lib/ai-step-armar';
import { leerObjeciones, escenarioDeCaso, ejemplosDeCharla } from '../lib/ai-step-ensayo';
import { partirTextoParaVoz, vozQueFalta, TOPE_TEXTO_AUDIO } from '../lib/ai-step-voz';
import { bloqueEscenario as bloqueRedactor, REGLA_NOTA_DE_VOZ } from '../lib/setter-conversacion';
import { bloqueEscenario as bloqueLead } from '../lib/chat-agent-escenarios';
import { grafoDeSecuencia, ID_ENTRADA, opcionesDelMas, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { duplicar } from '../lib/flujo-edicion';
import { firmaPublicado } from '../lib/secuencia-borrador';

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

/** Una automatización v2: su salida (m1) y tres AI Step de WhatsApp —contesta solo, cualquiera que sólo avisa— y uno de Instagram. */
const v2 = (): PasoGrafo[] => [
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  tarjeta('A', caso('ca', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'En la llamada', objetivo: 'Que agende sin cifras', ejemplos: [{ lead: 'cuánto?', tu: 'lo vemos en la llamada' }], hasta: 'una' })),
  tarjeta('B', caso('cb', { titulo: 'Confirma', cuando: 'confirma', responder: 'Agradece', sola: true, audio: { voz: 'propia' } })),
  tarjeta('I', caso('ci', { titulo: 'Por IG', cuando: 'escribe por IG', responder: 'Hola' }), { medio: 'instagram' }),
  tarjeta('Q', caso('cq', { titulo: 'Lo demás', cuando: '', cualquiera: true, no_contesta: true, responder: 'guardado', avisar: true }), { otra_aviso: 'Revísalo' }),
];

// ── La expansión: varias tarjetas del medio en una ──────────────────────────────────

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

test('lo del caso VIAJA al redactor: objetivo, ejemplos, audio (sólo WhatsApp) y «1 vez»', () => {
  const esc = escenariosDeRespuesta(v2(), { medio: 'whatsapp' });
  assert.deepEqual(esc.map((e) => [e.titulo, e.objetivo ?? null, e.ejemplos?.length ?? 0, e.audio?.voz ?? null, e.hasta ?? null, e.contestaSolo === true]), [
    ['Precio', 'Que agende sin cifras', 1, null, 'una', false],
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
  assert.equal((nodoPorId(g, idAvisoDeCaso('A', 'ca')) ?? null), null);
  assert.equal(AVISO_DE_CASO.length > 0, true);
});

// ── La puerta para lo viejo: separar ────────────────────────────────────────────────

/** Un AI Step v1: tres casos y un tono, en el medio del array (la 202 de la #213 está en `o1`). */
const v1 = (): PasoGrafo[] => [
  msg({ id: 'o0', siguiente: 'o1' }),
  msg({ id: 'o1', siguiente: null }),
  { ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, instrucciones: 'Cercano', otra_aviso: 'Mira', si_no: null, casos: [
    caso('A', { titulo: 'Confirma', responder: 'Agradece', sola: true }),
    caso('B', { titulo: 'Pregunta el precio', responder: 'En la llamada', avisar: true }),
    caso('C', { titulo: 'Puede no calificar', avisar: true }),
  ] },
];

test('separar: N casos en N tarjetas, la primera conserva el id y su caso, las nuevas AL FINAL, el tono plegado — y contesta IGUAL', () => {
  const s = separarPasosIA(v1(), rndDe());
  assert.equal(s.cambio, true);
  assert.deepEqual(s.noEntra, []);
  assert.deepEqual(s.pasos.slice(0, 3).map((p) => p.id), ['o0', 'o1', 'R'], 'corrió el índice de lo que estaba');
  assert.equal(s.pasos.length, 5);
  assert.deepEqual(s.pasos.slice(2).map((p) => p.casos!.map((c) => c.id)), [['A'], ['B'], ['C']]);
  assert.ok(s.pasos.slice(2).every((p) => esPasoIA(p) && p.instrucciones === undefined));
  assert.equal(s.pasos[2].casos![0].responder, 'Tono: Cercano\nAgradece');
  assert.equal(s.pasos[2].otra_aviso, 'Mira');
  assert.equal(s.pasos[3].otra_aviso, undefined);
  // LA EQUIVALENCIA: los mismos casos, guía, «sale sola» y «Otra cosa».
  assert.equal(loQueContesta(s.pasos), loQueContesta(v1()));
  assert.deepEqual(validarGrafo(s.pasos), []);
  // Idempotente: ya separado, no cambia.
  assert.equal(separarPasosIA(s.pasos, rndDe()).cambio, false);
});

test('separar: un tono que no entra NO se corta (la tarjeta lo conserva y se avisa); sin casos = «Cualquier respuesta» que sólo avisa', () => {
  const largo = v1().map((p) => (p.id === 'R' ? { ...p, instrucciones: 'x'.repeat(900), casos: [caso('A', { responder: 'y'.repeat(TOPE_RESPONDER - 100) })] } : p));
  const s = separarPasosIA(largo, rndDe());
  assert.deepEqual(s.noEntra, ['Caso A']);
  assert.equal(s.pasos[2].instrucciones, 'x'.repeat(900));
  assert.equal(s.pasos[2].casos![0].responder, 'y'.repeat(TOPE_RESPONDER - 100));
  const vacio = separarPasosIA(v1().map((p) => (p.id === 'R' ? { ...p, casos: [] } : p)), rndDe());
  const c = vacio.pasos[2].casos![0];
  assert.deepEqual([c.titulo, c.cualquiera, c.no_contesta, c.avisar], [ROTULO_CUALQUIERA, true, true, true]);
  assert.equal(loQueContesta(vacio.pasos), loQueContesta(v1().map((p) => (p.id === 'R' ? { ...p, casos: [] } : p))));
});

test('el plan de la migración: SIN objetivos (sólo sugeridos), la inscripción en su tarjeta, el borrador re-firmado; un tono que no entra FRENA', () => {
  const fila = { pasos: v1(), trigger_tipo: 'agendado_primer_contacto', pasos_borrador: { pasos: v1(), base: firmaPublicado(v1()), guardado_at: '2026-10-10T00:00:00Z' } };
  // El borrador tiene que DIFERIR de lo publicado para ser vigente.
  (fila.pasos_borrador.pasos[0] as PasoGrafo).cuerpo = 'hola cambiado';
  const p = planDeFila(fila, { rnd: rndDe(), evitar: new Set(['nzzzzzz']), inscs: [{ id: 202, paso_actual: 1, nodo_actual: 'o1' }] });
  assert.deepEqual(p.frenos, []);
  assert.equal(p.cambia, true);
  // REVISIÓN DEL 11/10/2026: el objetivo viaja al redactor, así que la migración NO lo escribe (§10-A): la tabla de
  // §8.4 queda como sugerencia impresa. Antes ponía los dos de abajo y la #213 contestaba otra cosa.
  const obj = p.pasos.filter((x) => esPasoIA(x)).map((x) => [x.casos![0].titulo, x.casos![0].objetivo ?? null]);
  assert.deepEqual(obj, [['Confirma', null], ['Pregunta el precio', null], ['Puede no calificar', null]]);
  assert.deepEqual(p.sugeridos, [{ titulo: 'Confirma', objetivo: 'Que confirme que viene a la reunión' }, { titulo: 'Pregunta el precio', objetivo: OBJETIVO_PRECIO.despues }]);
  assert.ok(p.borrador, 'no convirtió el borrador vigente');
  assert.equal(p.borrador!.base, firmaPublicado(p.pasos));
  assert.ok(p.borrador!.pasos.filter((x) => esPasoIA(x)).every((x) => x.casos!.length === 1));
  // Un nombre que no está en la tabla: sin objetivo, listado, no frena.
  const otro = planDeFila({ pasos: v1().map((x) => (x.id === 'R' ? { ...x, casos: [caso('A', { titulo: 'Algo raro', responder: 'x' }), caso('B', { titulo: 'Confirma', responder: 'y' })] } : x)), trigger_tipo: 'etapa_actual' }, { rnd: rndDe(), evitar: new Set(), inscs: [] });
  assert.deepEqual(otro.sinObjetivo, ['Algo raro']);
  assert.deepEqual(otro.frenos, []);
  // Un tono que no entra: freno.
  const largo = planDeFila({ pasos: v1().map((x) => (x.id === 'R' ? { ...x, instrucciones: 'x'.repeat(900), casos: [caso('A', { responder: 'y'.repeat(TOPE_RESPONDER - 50) }), caso('B', { responder: 'z' })] } : x)), trigger_tipo: 'x' }, { rnd: rndDe(), evitar: new Set(), inscs: [] });
  assert.ok(largo.frenos.some((f) => f.includes('pasan el tope')), largo.frenos.join(' | '));
  // Ya en la forma v2 (sin objetivo): nada que hacer — un caso sin objetivo NO es motivo para migrar.
  assert.equal(planDeFila({ pasos: p.pasos, trigger_tipo: 'agendado_primer_contacto' }, { rnd: rndDe(), evitar: new Set(), inscs: [] }).cambia, false);
});

// ── Las reglas y el saneo ───────────────────────────────────────────────────────────────

test('Publicar: un caso por tarjeta, un «Cualquier respuesta» por medio, audio sólo por WhatsApp; el objetivo NO frena', () => {
  assert.deepEqual(validarGrafo(v2()), []);
  assert.deepEqual(validarGrafo(v2().map((p) => (p.id === 'A' ? { ...p, casos: [...p.casos!, caso('x', { responder: 'y' })] } : p))), ['la tarjeta A tiene más de un caso']);
  const dosQ = [...v2(), tarjeta('Q2', caso('q2', { titulo: 'Otra', cuando: '', cualquiera: true, responder: 'x' }))];
  assert.ok(validarGrafo(dosQ).includes(`hay dos AI Step con «${ROTULO_CUALQUIERA}» en WhatsApp`), validarGrafo(dosQ).join(' | '));
  // Uno suelto no cuenta (no escucha).
  assert.ok(!validarGrafo(dosQ.map((p) => (p.id === 'Q2' ? { ...p, suelta: true } : p))).some((e) => e.startsWith('hay dos AI Step')));
  const audioIG = v2().map((p) => (p.id === 'I' ? { ...p, casos: [{ ...p.casos![0], audio: { voz: 'propia' } }] } : p));
  assert.ok(validarGrafo(audioIG).includes('en la tarjeta I, el audio sale sólo por WhatsApp'));
  assert.deepEqual(validarGrafo(v2().map((p) => (p.id === 'A' ? { ...p, casos: [{ ...p.casos![0], objetivo: undefined }] } : p))), [], 'el objetivo frenó');
  // «Cualquier respuesta» no pide cuándo; «Sólo te avisa» pide el aviso.
  assert.equal(faltaEnCaso({ titulo: 'x', cuando: '', cualquiera: true, responder: 'y' }), null);
  assert.equal(faltaEnCaso({ titulo: 'x', cuando: 'z', responder: 'y', no_contesta: true }), 'que_hace');
  // No se mezcla con un «Si responde» de los de siempre; hasta 10 por medio.
  assert.ok(validarParaGuardar([...v2(), { ...msg(), id: 'S', nodo: 'respuesta', casos: [], si_no: null }]).includes('un AI Step no va con un «Si responde»'));
  const muchos = [msg({ id: 'm1', siguiente: null }), ...Array.from({ length: TOPE_AI_STEP_POR_MEDIO + 1 }, (_, k) => tarjeta(`t${k}`, caso(`c${k}`, { responder: 'x' })))];
  assert.ok(validarParaGuardar(muchos).includes(`hay más de ${TOPE_AI_STEP_POR_MEDIO} AI Step de WhatsApp`));
  assert.equal(puedeSumarAIStep(muchos.slice(0, -1)), false);
  assert.equal(puedeSumarAIStep(v2()), true);
  // Todas las que escuchan son raíces: ninguna es «suelta».
  assert.deepEqual(raicesRespuesta(v2()), ['A', 'B', 'I', 'Q']);
  assert.deepEqual(tarjetasSueltas(v2()), []);
});

test('el saneo (`camposDelFlujo`, la quinta puerta) CONSERVA el medio y lo nuevo del caso, y descarta lo que no sirve', () => {
  const f = camposDelFlujo({
    id: 'X', nodo: 'respuesta', paso_ia: true, medio: 'instagram', si_no: null,
    casos: [{ id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', objetivo: '  Que agende  ', cualquiera: true, no_contesta: true, hasta: 'una',
      audio: { voz: 'propia' }, ejemplos: [{ lead: 'a', tu: 'b' }, { lead: '', tu: 'c' }, 'basura'] }],
  });
  assert.equal(f.medio, 'instagram');
  assert.deepEqual(f.casos![0], { id: 'c', titulo: 't', cuando: 'w', siguiente: null, responder: 'r', objetivo: 'Que agende', cualquiera: true, no_contesta: true, hasta: 'una', audio: { voz: 'propia' }, ejemplos: [{ lead: 'a', tu: 'b' }] });
  // WhatsApp no se escribe (ausente = WhatsApp); una voz que no es un id, tampoco; un `hasta` desconocido, tampoco.
  const g = camposDelFlujo({ id: 'X', nodo: 'respuesta', paso_ia: true, medio: 'whatsapp', casos: [{ id: 'c', titulo: 't', cuando: 'w', audio: { voz: '<script>' }, hasta: 'siempre' }] });
  assert.equal(g.medio, undefined);
  assert.equal(g.casos![0].audio, undefined);
  assert.equal(g.casos![0].hasta, undefined);
});

test('enseñar un caso nuevo crea una TARJETA (del medio), duplicar una AI Step la deja suelta y sin «Cualquier respuesta»', () => {
  const r = agregarCasoAlGrafo(v2(), { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18' }, rndDe());
  assert.ok('pasos' in r);
  const nueva = r.pasos.at(-1)!;
  assert.ok(esPasoIA(nueva));
  assert.deepEqual(nueva.casos!.map((c) => c.titulo), ['Horario']);
  const d = duplicar(v2(), 'Q', rndDe());
  assert.ok(d.ok && d.id);
  const copia = nodoPorId(d.pasos, d.id!)!;
  assert.equal(copia.suelta, true);
  assert.equal(copia.casos![0].cualquiera, undefined);
  assert.equal(d.pasos.at(-1)!.id, d.id, 'la copia corrió el índice de alguien');
});

test('el lienzo: una flecha del CRON por cada AI Step que escucha, y el ＋ ofrece otro', () => {
  const g = grafoDeSecuencia(v2() as PasoParaGrafo[], { disparador: 'Llega' });
  for (const id of ['A', 'B', 'I', 'Q']) assert.ok(g.aristas.some((a) => a.desde === ID_ENTRADA && a.hasta === id), id);
  assert.ok(opcionesDelMas(v2(), 'm1', false).some((o) => o.value === 'ai_step'));
  assert.ok(g.nodos.filter((n) => n.tipo === 'paso-ia').every((n) => n.alto === g.nodos.find((x) => x.id === 'A')!.alto), 'el alto no es fijo');
  assert.ok(v2().every((p, i) => idDe(p, i)));
});

// ── La IA, el ensayo y la voz (lo puro) ───────────────────────────────────────────────

test('armar el resto: nunca «Sola» si habla de plata, «Cualquier respuesta» sólo si no la tiene otro, sin nombre no sirve', () => {
  const sin = { titulos: ['Confirma'], hayCualquiera: false };
  assert.deepEqual(repararArmado({ titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'Dile que en la llamada', libertad: 'sola' }, sin),
    { titulo: 'Pregunta el precio', cuando: 'pregunta cuánto cuesta', responder: 'Dile que en la llamada' });
  assert.equal(repararArmado({ titulo: 'Confirma', cuando: 'dice que sí', responder: 'Agradece', libertad: 'sola' }, sin)!.titulo, 'Confirma 2');
  assert.equal(repararArmado({ titulo: 'Agenda', cuando: 'quiere', responder: 'Ok', libertad: 'sola' }, sin)!.sola, true);
  assert.deepEqual(repararArmado({ titulo: 'Lo demás', cualquiera: true, responder: '' , libertad: 'avisa' }, sin), { titulo: 'Lo demás', cuando: '', responder: '', cualquiera: true, no_contesta: true, avisar: true });
  assert.equal(repararArmado({ titulo: 'Lo demás', cualquiera: true, cuando: '', responder: 'x' }, { titulos: [], hayCualquiera: true }), null, 'sin «cuándo» y sin poder ser «Cualquier respuesta» no sirve');
  assert.equal(repararArmado({ cuando: 'x' }, sin), null);
});

test('el ensayo: objeciones saneadas, un escenario SIN audio (no le miente al modelo) y los ejemplos son lead → tu respuesta', () => {
  assert.equal(leerObjeciones({ primer: 'hola', objeciones: ['una'] }), null, 'con una sola objeción no hay ensayo');
  const ob = leerObjeciones({ primer: ' cuánto sale? ', objeciones: ['Es caro', 'es caro', 'No tiene tiempo', 'Duda del resultado', 'Quiere pensarlo', 'Otra más'] })!;
  assert.deepEqual(ob, { primer: 'cuánto sale?', objeciones: ['Es caro', 'No tiene tiempo', 'Duda del resultado', 'Quiere pensarlo'] });
  const esc = escenarioDeCaso({ titulo: 'Precio', cuando: 'pregunta el precio', objetivo: 'Que agende' }, ob, 'whatsapp');
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
  // El freno de Publicar/Activar: «Tu voz» sin clon, u otra voz que ya no está (sólo si el caso contesta).
  assert.equal(vozQueFalta(v2(), { propia: true, otras: [] }), null);
  assert.equal(vozQueFalta(v2(), { propia: false, otras: [] }), '«Confirma» contesta en audio y todavía no clonaste tu voz');
  const otraVoz = v2().map((p) => (p.id === 'B' ? { ...p, casos: [{ ...p.casos![0], audio: { voz: 'abc12345XYZ' } }] } : p));
  assert.equal(vozQueFalta(otraVoz, { propia: true, otras: ['otra9999'] }), '«Confirma» contesta en audio y esa voz ya no está');
  assert.equal(vozQueFalta(v2().map((p) => (p.id === 'B' ? { ...p, suelta: true } : p)), { propia: false, otras: [] }), null, 'una suelta no escucha');
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(fn(nut, 'export async function validarActivacion('), /const sinVoz = await vozDeAIStepQueFalta\(/);
  assert.match(sinComentarios(leer('app/api/whatsapp/secuencias/route.ts')), /const sinVoz = await vozDeAIStepQueFalta\(body\.pasos as PasoSecuencia\[\]\)[\s\S]{0,120}if \(sinVoz\) return Response\.json\(/);
});

test('los objetivos de lo que ya existía salen de UNA tabla (§8.4), por nombre y sin acentos', () => {
  assert.deepEqual(objetivoDeCaso('Quiere cambiar el dia', { postAgenda: true }), { objetivo: 'Que proponga otro día y horario' });
  assert.deepEqual(objetivoDeCaso('Pregunta el precio', { postAgenda: false }), { objetivo: OBJETIVO_PRECIO.antes });
  assert.deepEqual(objetivoDeCaso('Puede no calificar', { postAgenda: true }), { objetivo: null });
  assert.equal(objetivoDeCaso('Algo que no está', { postAgenda: true }), null);
});

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
  assert.match(red, /if \(sugerida && lead\?\.telefono && clas\.escenario\.audio\) \{\s*const r = await notaDeVozDeRespuesta\(/);
  assert.match(red, /if \(!sinAudio && borradorOk && borradorId != null/, 'sin el audio salía sola igual');
  assert.match(red, /const unaVez = !cierre && borradorOk && clas\.escenario\.hasta === 'una';/);
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
