// =============================================================================
// MaKo no puede mandarte el borrador: tiene que MANDARTE EL LINK
// =============================================================================
// El caso 1 es literal: el mensaje que MaKo le mandó al dueño por WhatsApp el
// 9/8/2026 cuando le pidió cargar dos tareas al plan. En vez de crear el borrador y
// contestar con el link, redactó el payload de la tool y se lo mandó — con las
// preguntas del formulario en el chat y un «Eliminar: nada por ahora» que no
// significa nada para quien lo lee.
//
// Sus tres quejas salen todas de ahí: «me comenzó a preguntar allí mismo en el
// chat», «me dice cosas que eliminar», «no entiendo qué hizo». La tercera es la más
// exacta: no hizo nada. No hubo INSERT, no hubo id, no hubo link.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarRespuestaDoer, esRutaPlan, mensajeBorrador, AVISO_NO_PUDE } from '../lib/respuesta-doer';

/** El mensaje REAL del 9/8, recortado pero con su forma intacta. */
const LA_MALA = [
  '---',
  '**Qué hay que hacer**',
  'Crear un proyecto nuevo llamado **"Meta Ads & Competencia"** y agregar 2 tareas.',
  '',
  '**Por qué**',
  'A) *"Qué reinicia el aprendizaje de Meta Ads"* → Necesitamos datos duros.',
  '',
  '**Detalles concretos**',
  '- **Proyecto propuesto**: "Meta Ads & Competencia" (nuevo).',
  '',
  '**Preguntas** *(para definir prioridad y deadlines)*',
  '1. **¿Para cuándo necesitás el informe de Meta Ads?** *(opcion)*',
  '   - Esta semana',
  '',
  '**Eliminar**',
  'Nada por ahora.',
].join('\n');

/** La buena, cuatro veces el día anterior. */
const LA_BUENA = 'Listo, te armé el borrador. Revisalo y confirmalo acá 👇\nhttps://hola-mako.com/plan/revisar/propmskimbc4s4b4h';

const RUTA_PLAN = 'mistral router:sonnet (plan) «Investigar: https://…»';

test('EL CASO REAL: el molde del detalle NUNCA sale por WhatsApp', () => {
  const v = validarRespuestaDoer(LA_MALA, { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.razon, 'molde-volcado');
});

test('…y se bloquea aunque el borrador SÍ se haya creado: el texto igual es el payload', () => {
  // Este es el caso mixto: la tool corrió, pero el modelo además redactó el molde.
  // Se bloquea igual, y el caller manda el link en su lugar.
  const v = validarRespuestaDoer(LA_MALA, { motivoRuta: RUTA_PLAN, linkBorrador: 'https://hola-mako.com/plan/revisar/prop123' });
  assert.equal(v.ok === false && v.razon, 'molde-volcado');
});

test('la respuesta BUENA pasa', () => {
  assert.deepEqual(
    validarRespuestaDoer(LA_BUENA, { motivoRuta: RUTA_PLAN, linkBorrador: 'https://hola-mako.com/plan/revisar/propmskimbc4s4b4h' }),
    { ok: true },
  );
});

test('ruta de plan sin borrador: NO bloquea, pero deja rastro', () => {
  // Hay turnos legítimos en la ruta plan que no crean nada («¿qué tengo pendiente?»).
  // Por eso es señal blanda: el caller loguea y manda igual.
  const v = validarRespuestaDoer('Tenés 14 tareas abiertas en el plan.', { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.razon, 'sin-borrador');
});

test('una charla normal fuera de la ruta plan pasa sin ruido', () => {
  for (const t of [
    'Dale, lo miro y te aviso.',
    'El lead de Juan está en Reunión 1, agendada para el jueves.',
    'Pausé la campaña. ¿Confirmás que la dejo así?',
  ]) {
    assert.deepEqual(validarRespuestaDoer(t, { motivoRuta: 'groq router:lean (charla) «hola»', linkBorrador: null }), { ok: true }, t);
  }
});

test('con UN solo título no alcanza: una respuesta puede decir «por qué» sin ser el molde', () => {
  // `evaluarDetalle` pide 2 de 4 a propósito. Un solo título es lenguaje normal.
  const v = validarRespuestaDoer('Por qué: porque el cliente lo pidió el martes.', { motivoRuta: 'groq router:lean (dato) «x»', linkBorrador: null });
  assert.equal(v.ok, true);
});

test('el molde se detecta sin asteriscos y sin acentos', () => {
  // El modelo no siempre escribe markdown; la detección no puede depender de eso.
  const plano = 'Que hay que hacer:\nCargar dos tareas.\n\nDetalles concretos:\n- una\n- dos';
  assert.equal(validarRespuestaDoer(plano, { motivoRuta: RUTA_PLAN, linkBorrador: null }).ok, false);
});

test('la ruta se lee del paréntesis, no de la palabra suelta', () => {
  // El `motivo` lleva pegado un recorte del mensaje del usuario. Si «plan» se buscara
  // a secas, cualquiera que escriba «plan» activaría la señal.
  assert.equal(esRutaPlan('mistral router:sonnet (plan) «hola»'), true);
  assert.equal(esRutaPlan('groq router:lean (charla) «cuál es el plan de hoy?»'), false);
  assert.equal(esRutaPlan(''), false);
});

test('los dos mensajes de salida dicen algo útil', () => {
  const link = 'https://hola-mako.com/plan/revisar/prop123';
  assert.ok(mensajeBorrador(link).includes(link), 'el mensaje del borrador tiene que traer el link');
  assert.ok(!/qué hay que hacer/i.test(mensajeBorrador(link)), 'el mensaje del borrador no puede traer el molde');
  assert.ok(AVISO_NO_PUDE.length > 20 && !AVISO_NO_PUDE.includes('undefined'));
  // Y lo más importante: lo que la guarda manda tiene que PASAR la guarda, o el
  // bloqueo se volvería un bucle.
  assert.deepEqual(validarRespuestaDoer(mensajeBorrador(link), { motivoRuta: RUTA_PLAN, linkBorrador: link }), { ok: true });
  assert.deepEqual(validarRespuestaDoer(AVISO_NO_PUDE, { motivoRuta: 'x (charla) «y»', linkBorrador: null }), { ok: true });
});

test('una respuesta vacía no se manda', () => {
  assert.equal(validarRespuestaDoer('', { motivoRuta: RUTA_PLAN, linkBorrador: null }).ok, false);
  assert.equal(validarRespuestaDoer('   \n ', { motivoRuta: 'x (charla) «y»', linkBorrador: null }).ok, false);
});

// ---------------------------------------------------------------------------
// La regresión que causó la guarda: descartar lo bueno es peor que no guardar
// ---------------------------------------------------------------------------
// La primera versión miraba `.ok` a secas en el loop de proveedores, así que
// rotaba también por `sin-borrador` — la señal BLANDA. Una respuesta corta y
// correcta quemaba los cinco proveedores y el dueño recibía «falló la IA
// (cerebras: HTTP 404)». La distinción entre las dos razones no es cosmética:
// es lo que decide si se descarta una respuesta o solo se loguea.

test('REGRESIÓN: las dos razones NO se tratan igual — solo el molde descarta', () => {
  const corta = validarRespuestaDoer('Dale, ya lo anoto.', { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(corta.ok, false);
  assert.equal(corta.ok === false && corta.razon, 'sin-borrador', 'una respuesta corta NO es un volcado del molde');

  const volcada = validarRespuestaDoer(LA_MALA, { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(volcada.ok === false && volcada.razon, 'molde-volcado');

  // El caller descarta SOLO por 'molde-volcado'. Si alguna vez las razones se
  // colapsan en un booleano, este test es el que avisa.
  assert.notEqual(
    corta.ok === false && corta.razon,
    volcada.ok === false && volcada.razon,
    'si las dos razones fueran iguales, el loop volvería a descartar respuestas buenas',
  );
});
