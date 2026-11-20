// LA PRUEBA POR WHATSAPP DE LOS DÍAS 3, 4 Y 5, CONTESTADA (20/11/2026, a la tarde; wa-02, d24-16, R57-10).
//
// El Cerebro lo decidió el 20/11 a la tarde: los días 3, 4 y 5 no esperan a que el bot 1 a 1 se mude de línea. Se contestan en
// lib/reto/respuestas.ts (`responderAlReto`), como el día 7: el audio del lead (3), la pregunta por su competencia (4) y el audio con
// la idea del guion (5), y cada uno marca su prueba. Lo puro en lib/reto/pruebas-whatsapp.ts; lo que habla con la base y la IA en
// lib/reto/pruebas-whatsapp-servidor.ts, que REUSA lo del bot (`proponer_lead`), Competitor Spy y las operaciones del Copywriter.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   P1 una prueba de un día que todavía no se abrió                → falla «qué prueba contesta»
//   P2 una prueba ya respondida se vuelve a contestar             → falla «qué prueba contesta»
//   P3 con el 3 y el 5 pendientes, el guion va al lead           → falla «qué prueba contesta»
//   P4 la pregunta por la competencia no se reconoce              → falla «qué prueba contesta»
//   P5 el lead dice «cargué» (queda para confirmar)               → falla «los textos»
//   P6 el título del guion se queda con «Quiero un guion sobre»   → falla «los textos»
//   P7 un dato del lead que la herramienta no tiene, adentro      → falla «el lead»
//   P8 los anuncios sin ordenar por días al aire                  → falla «la competencia»
//   P9 leerAvisos pierde `probando`                               → falla «las dos llegadas»
//   P10 se reclama sin mirar si otra llegada ya lo tiene          → falla «las dos llegadas»
//   P11 la prueba se marca aunque MaKo no la haya hecho           → falla «el orden»
//   P12 el guion que falla queda en Copywriting (no a la Papelera) → falla «reusa»
//   P13 «no pude leer» Spy contesta «no tienes competidores»      → falla «reusa»
//   P14 el lead por crearPropuesta directo, no por la herramienta → falla «reusa»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EstadoReto } from '../lib/reto/dias';
import type { Pieza } from '../lib/spy';
import { leerAvisos } from '../lib/reto/avisos';
import {
  LEIDO_COMPETENCIA, NO_TE_ESCUCHE, PIDE_EL_NOMBRE, SE_ME_CORTO, datosDelLead, diaDelAudio, esPreguntaDeCompetencia, instruccionDelGuion,
  leidoDelLead, loQueMasLeFunciona, pruebasDelMensaje, respuestaDeLaCompetencia, respuestaDelGuion, respuestaDelLead, sinCompetencia,
  sistemaDelLead, tituloDelGuion,
} from '../lib/reto/pruebas-whatsapp';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const h = (s: string) => Date.parse(s);
// Empezó el 19/11 a las 12:00 de Argentina, con la hora 9:00: el día N se abre a las 9:00 de Argentina (12:00 UTC) del 19+N-1.
const INICIO = '2026-11-19T15:00:00.000Z';
const reto = (x: Partial<EstadoReto> = {}): EstadoReto => ({ v: 1, inicio: INICIO, adelantado: 1, hechas: {}, horaWa: '9:00', ...x });
const DIA = { 2: h('2026-11-20T12:30:00Z'), 3: h('2026-11-21T12:30:00Z'), 4: h('2026-11-22T12:30:00Z'), 5: h('2026-11-23T12:30:00Z') };
const respondida = { en: INICIO };

function bloque(src: string, desde: string, hasta?: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = hasta ? src.indexOf(hasta, i + desde.length) : src.length;
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('qué prueba contesta un mensaje: la de un día abierto y sin responder; el audio dice si es el lead o el guion', () => {
  const e = reto();
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[2], esAudio: true, competencia: false }), [], 'el día 2 un audio no es de ninguna prueba: al bot');
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[3], esAudio: true, competencia: false }), [3]);
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[3], esAudio: false, competencia: true }), [], 'la del 4, todavía no');
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[4], esAudio: false, competencia: true }), [4]);
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[4], esAudio: false, competencia: false }), [], 'un texto cualquiera sigue al bot');
  assert.deepEqual(pruebasDelMensaje({ e, ahora: DIA[5], esAudio: true, competencia: false }), [5, 3], 'las dos de audio, la más nueva primero');
  assert.deepEqual(pruebasDelMensaje({ e: reto({ pruebas: { 3: respondida } }), ahora: DIA[5], esAudio: true, competencia: false }), [5]);
  assert.deepEqual(pruebasDelMensaje({ e: reto({ pruebas: { 4: respondida } }), ahora: DIA[5], esAudio: false, competencia: true }), [], 'ya respondida');
  assert.deepEqual(pruebasDelMensaje({ e: reto({ pruebas: { 3: respondida, 5: respondida } }), ahora: DIA[5], esAudio: true, competencia: false }), []);
  // Con el 3 y el 5 pendientes, lo que dice el audio.
  assert.equal(diaDelAudio('Quiero un guion sobre por qué las dietas fallan y qué hacemos distinto.', [5, 3]), 5);
  assert.equal(diaDelAudio('MaKo, carga a Juan Pérez en mi CRM: me escribió por Instagram y quiere el programa.', [5, 3]), 3);
  assert.equal(diaDelAudio('Hablemos de mis clientas de los martes', [5, 3]), 5, 'si no dice, la más nueva');
  assert.equal(diaDelAudio('Un guion sobre lo que sea', [3]), 3, 'con una sola, ésa');
  assert.equal(diaDelAudio('lo que sea', []), null);
  // La pregunta del día 4 (la de la maqueta) y nada más que lo que nombra a su competencia.
  assert.equal(esPreguntaDeCompetencia('¿Qué le está funcionando a mi competencia?'), true);
  assert.equal(esPreguntaDeCompetencia('qué hacen mis COMPETIDORES'), true);
  assert.equal(esPreguntaDeCompetencia('Hola MaKo, prefiero que me escribas a las 9:00 sobre el reto.'), false);
  assert.equal(esPreguntaDeCompetencia('¿cuánto compito con el precio?'), false);
});

test('los textos: los de la maqueta, salvo el lead, que queda para confirmar (la regla de la casa)', () => {
  const url = 'https://mako.app/crm/revisar/42?ws=3';
  assert.equal(respuestaDelLead('Juan Pérez', url), `Listo: te dejé los datos de Juan Pérez para tu CRM ✓ Revísalos y confírmalos aquí: ${url}`);
  assert.doesNotMatch(respuestaDelLead('Juan Pérez', url), /cargu[eé]/i, 'no está cargado: falta que lo confirme');
  assert.equal(leidoDelLead('Juan Pérez'), 'Te dejé los datos de Juan Pérez para tu CRM.');
  assert.match(PIDE_EL_NOMBRE, /su nombre/);
  // El guion, como la maqueta (d5), con el link a su página.
  assert.equal(respuestaDelGuion('https://mako.app/copywriter/g1?ws=3'), 'Listo: escribí tu guion con tu idea ✓ Lo tienes en Copywriting: https://mako.app/copywriter/g1?ws=3');
  assert.ok(instruccionDelGuion('  por qué las dietas fallan ').endsWith('«por qué las dietas fallan»'));
  assert.equal(tituloDelGuion('Quiero un guion sobre por qué las dietas fallan y qué hacemos distinto.'), 'Por qué las dietas fallan y qué hacemos distinto');
  assert.equal(tituloDelGuion('Hola MaKo, escríbeme un guion de mi método'), 'Mi método');
  assert.equal(tituloDelGuion('   '), 'Tu guion del reto');
  assert.ok(tituloDelGuion('a'.repeat(200)).length <= 61, 'corto');
  // La competencia.
  assert.equal(respuestaDeLaCompetencia(['Uno.', 'Dos.'], 'L'), 'Esto es lo que mejor le está funcionando a tu competencia:\n• Uno.\n• Dos.\nLo tienes en Competitor Spy: L');
  assert.match(sinCompetencia('L'), /Agrega a 3 competidores en Competitor Spy.*: L$/);
  assert.equal(LEIDO_COMPETENCIA, 'Te conté lo que mejor le funciona a tu competencia.');
  // Neutros en género (la regla de la casa): nada de «listo/a», «bienvenido».
  for (const t of [respuestaDelLead('Ana', url), PIDE_EL_NOMBRE, NO_TE_ESCUCHE, SE_ME_CORTO, sinCompetencia('L')]) assert.doesNotMatch(t, /\b(listo\/a|bienvenid[oa]|atent[oa])\b/i);
});

test('el lead: la IA lo saca con la descripción de la herramienta del bot, y sólo con sus campos', () => {
  const s = sistemaDelLead('PROPONE dar de alta un lead en el CRM.', { nombre: { description: 'nombre y apellido' }, telefono: { description: 'teléfono' } });
  assert.ok(s.includes('LA HERRAMIENTA: PROPONE dar de alta un lead en el CRM.'));
  assert.ok(s.includes('- nombre: nombre y apellido') && s.includes('- telefono: teléfono'));
  assert.match(s, /Nunca inventes un dato/);
  assert.deepEqual(
    datosDelLead({ nombre: '  Juan   Pérez ', telefono: '', nota: 'Me escribió por Instagram', inventado: 'x', email: 5491100000000 }, ['nombre', 'telefono', 'email', 'nota']),
    { nombre: 'Juan Pérez', email: '5491100000000', nota: 'Me escribió por Instagram' },
  );
  assert.deepEqual(datosDelLead('no es un objeto', ['nombre']), {});
  assert.deepEqual(datosDelLead(null, ['nombre']), {});
});

test('la competencia: lo que más tiempo lleva al aire, de lo que guardó Competitor Spy; sin nada leído, nada', () => {
  const ahora = h('2026-11-22T12:30:00Z');
  const dias = (n: number) => new Date(ahora - n * 86_400_000).toISOString();
  let id = 0;
  const anuncio = (titulo: string | null, hace: number | null, termino: string | null = null): Pieza => ({
    id: ++id, competidor_id: 1, canal: 'anuncios', tipo: 'anuncio', ref: `a${id}`, titulo, texto: null, publicada_en: hace == null ? null : dias(hace),
    dejo_de_verse_en: termino, visto_primera_vez: dias(1), visto_ultima_vez: dias(0),
  }) as unknown as Pieza;
  const cs = [
    { nombre: 'Nutrición Ejemplo', piezas: [anuncio('Antes y después: 12 kilos', 40), anuncio(null, 90), anuncio('Sin fecha', null)] },
    { nombre: 'Clínica Ejemplo', piezas: [anuncio('Tu primera consulta', 60, dias(5)), anuncio('Promo de 3 días', 3)] },
  ];
  assert.deepEqual(loQueMasLeFunciona(cs, ahora), [
    'Nutrición Ejemplo: un anuncio lleva 90 días al aire.',
    'Clínica Ejemplo: su anuncio «Tu primera consulta» estuvo 55 días al aire.',
    'Nutrición Ejemplo: su anuncio «Antes y después: 12 kilos» lleva 40 días al aire.',
  ]);
  assert.deepEqual(loQueMasLeFunciona([{ nombre: 'X', piezas: [] }], ahora), [], 'sin piezas no se inventa nada');
  assert.deepEqual(loQueMasLeFunciona([{ nombre: 'X', piezas: [anuncio('Sin fecha', null)] }], ahora), [], 'sin fecha no es «0 días»');
});

test('las dos llegadas: el mensaje se reclama una vez (`probando`), y se lee de vuelta', () => {
  const e = reto();
  assert.equal(leerAvisos(JSON.stringify({ v: 1, dia: 3, probando: 'ABC123' }), e).probando, 'ABC123');
  assert.equal(leerAvisos(JSON.stringify({ v: 1, dia: 3, probando: '' }), e).probando, undefined);
  assert.equal(leerAvisos(JSON.stringify({ v: 1, dia: 3, probando: 7 }), e).probando, undefined);
  const r = fuenteSinComentarios('lib/reto/respuestas.ts');
  const reclamar = bloque(r, 'async function reclamarElMensaje(');
  const mira = reclamar.indexOf('if (a.probando === id) return false;');
  const cas = reclamar.indexOf('cambiarSettingSi(CLAVE_AVISOS, base, JSON.stringify({ ...a, probando: id }))');
  assert.ok(mira > 0 && cas > mira, 'mira si otra llegada ya lo tiene ANTES de reclamarlo');
});

test('el orden: el día 7 primero; la prueba se marca sólo si MaKo la hizo, y siempre le contesta algo', () => {
  const r = fuenteSinComentarios('lib/reto/respuestas.ts');
  assert.ok(r.includes('const competencia = !baja && !hora && !esAudio && esPreguntaDeCompetencia(texto);'));
  assert.ok(r.includes('if (!baja && !hora && !esAudio && !competencia) return null;'), 'sin uno de sus mensajes no toca la base');
  assert.ok(r.includes('if (!esElAudioDelCierre({ e, a, ahora: Date.now(), esAudio })) return pruebaDeLosDias('), 'el audio del día 7 va primero');
  const p = bloque(r, 'async function pruebaDeLosDias(', 'async function reclamarElMensaje(');
  assert.ok(p.includes('if (!dias.length) return null;'), 'si no es una prueba, al bot');
  const reclama = p.indexOf('await reclamarElMensaje(ws, e, p.crudo, key.id)');
  const responde = p.indexOf('responder: async () => {');
  assert.ok(reclama > 0 && responde > reclama, 'se reclama ANTES de contestarle al webhook');
  const marca = p.indexOf('if (r.leido && !(await pruebaRespondida(ws, dia, r.leido)))');
  const contesta = p.indexOf('await enviarAPersonaMaKo(destino, r.texto)');
  assert.ok(marca > responde && contesta > marca, 'la prueba (si la hizo) y después la respuesta');
  assert.ok(p.includes("r = dia === 5 ? await s.escribirElGuion(ws, jid, idea) : await s.proponerElLead(ws, jid, idea);"));
  assert.ok(p.includes('if (!idea) r = { texto: NO_TE_ESCUCHE };'), 'sin poder escuchar, se lo dice');
});

test('reusa lo que ya hace MaKo, no lo copia: la herramienta del bot, Competitor Spy y las operaciones del Copywriter', () => {
  const s = fuenteSinComentarios('lib/reto/pruebas-whatsapp-servidor.ts');
  // Escuchar: lo mismo que la nota de voz del bot.
  const bot = fuenteSinComentarios('lib/mako-bot.ts');
  assert.ok(bot.includes("feature: 'MaKo · nota de voz'") && s.includes("feature: 'MaKo · nota de voz'"));
  // Día 3: la herramienta `proponer_lead` del doer, con su descripción; nunca un crearPropuesta propio.
  const lead = bloque(s, 'export async function proponerElLead(', 'export async function leerLaCompetencia(');
  assert.ok(lead.includes("MAKO_ACCION_TOOLS.find((t) => t.name === 'proponer_lead')"));
  assert.ok(lead.includes("await crearRunnerAcciones(ws, jid)('proponer_lead', datos)"));
  assert.ok(lead.includes('if (!datos.nombre) return { texto: PIDE_EL_NOMBRE };'));
  assert.doesNotMatch(s, /crearPropuesta\(/, 'una segunda forma de proponer un lead');
  // Día 4: «no pude leer» no es «no tienes competidores».
  const spy = bloque(s, 'export async function leerLaCompetencia(', 'export async function escribirElGuion(');
  assert.ok(spy.includes('if (r.error === AUN_SIN_TABLAS) return { texto: sinCompetencia(link) };'));
  assert.ok(spy.includes('throw new Error(r.error);'));
  const atrapa = spy.slice(spy.indexOf('} catch (e) {'));
  assert.ok(atrapa.includes('return { texto: SE_ME_CORTO };') && !atrapa.includes('sinCompetencia'), 'si no pudo leer, que se cortó');
  // Día 5: las operaciones del Copywriter de la API; lo que falla va a la Papelera (vacío contaría como guion escrito).
  const guion = bloque(s, 'export async function escribirElGuion(');
  assert.ok(guion.includes("runnerDe('crear_documento_copywriter')") && guion.includes("runnerDe('editar_documento_copywriter')"));
  assert.ok(guion.includes('leido: GUION_POR_WHATSAPP'), 'la tarjeta y la tarea del guion (lib/reto/pruebas.ts)');
  const falla = guion.slice(guion.indexOf('} catch (e) {'));
  assert.ok(falla.includes('await papelera(id)'), 'la página que no se escribió va a la Papelera');
  // Todo en el workspace del negocio: la IA la paga ese negocio.
  for (const f of ['escucharAudio', 'proponerElLead', 'leerLaCompetencia', 'escribirElGuion']) {
    assert.ok(bloque(s, `export async function ${f}(`).slice(0, 400).includes('return runWithWorkspace(ws, async () => {'), `${f} fuera del workspace`);
  }
});
