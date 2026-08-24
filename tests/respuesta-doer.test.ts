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
import { readFileSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// El link inventado: «este borrador ya no existe»
// ---------------------------------------------------------------------------
// 10/8/2026. El dueño mandó ideas al grupo y MaKo contestó «Listo, te armé el
// borrador» con un link. Al abrirlo: «este borrador ya no existe». No existía
// porque nunca se creó — la herramienta no corrió y el modelo escribió un id
// plausible. Éste es el link REAL que le llegó, y el real de al lado:
//
//   propmsn956x9qg48    ← inventado (16 caracteres)
//   propmsn7pbzb4bz48   ← de verdad (17)
//
// La señal `sin-borrador` no lo atajó porque el router había clasificado ese turno
// como (dato/acción) y no (plan). Por eso ésta NO mira la ruta: el link son 17
// caracteres al azar y su única fuente legítima es lo que devolvió la tool.

const LINK_FALSO = 'Listo, te armé el borrador. Revisalo y confirmalo acá 👇\nhttps://hola-mako.com/plan/revisar/propmsn956x9qg48';

test('EL CASO REAL: un link de borrador sin borrador NO se manda', () => {
  const v = validarRespuestaDoer(LINK_FALSO, { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.razon, 'link-inventado');
});

test('…y se ataja aunque el router se haya equivocado de ruta', () => {
  // Éste es el punto: el turno real vino como (dato/acción). Si la detección
  // dependiera de que el router acierte, seguiría saliendo el link roto.
  const v = validarRespuestaDoer(LINK_FALSO, { motivoRuta: 'mistral router:sonnet (dato/acción) «Investigar…»', linkBorrador: null });
  assert.equal(v.ok === false && v.razon, 'link-inventado');
  // Y en una charla cualquiera, lo mismo: no hay ruta donde esto sea legítimo.
  assert.equal(validarRespuestaDoer(LINK_FALSO, { motivoRuta: 'groq router:lean (charla) «hola»', linkBorrador: null }).ok, false);
});

test('el MISMO texto con el borrador creado de verdad, pasa', () => {
  const link = 'https://hola-mako.com/plan/revisar/propmsn956x9qg48';
  assert.deepEqual(validarRespuestaDoer(LINK_FALSO, { motivoRuta: RUTA_PLAN, linkBorrador: link }), { ok: true });
});

test('un texto sin link no dispara esta señal', () => {
  // La diferencia con `sin-borrador`: aquélla es blanda y mira la ruta; ésta exige
  // que el modelo haya ESCRITO un link. Sin link no hay promesa que romper.
  const v = validarRespuestaDoer('Tenés 14 tareas abiertas.', { motivoRuta: RUTA_PLAN, linkBorrador: null });
  assert.equal(v.ok === false && v.razon, 'sin-borrador');
});

// ---------------------------------------------------------------------------
// El mensaje del borrador NO lo escribe el modelo
// ---------------------------------------------------------------------------
// Pedido del dueño, y es la corrección de fondo de todo lo de arriba: «el modelo
// de IA jamás debe ser el responsable de mandar ese mensaje… si literalmente
// SIEMPRE es el mismo y lo único que cambia es la variable del link».
//
// Tenía razón. Las tres capas anteriores —pedirle la frase al modelo, corregirle
// el link cuando copiaba mal los 17 caracteres, y detectar cuando lo inventaba
// entero— eran red debajo de una decisión que no había que tomar: darle a un
// modelo una salida que no tiene ni una variable de libertad.
//
// `mensajeBorrador` es esa salida, y estos tests fijan sus dos propiedades: que
// solo dependa del link, y que lo que produce pase la propia compuerta.

test('el mensaje del borrador es UNA función del link y nada más', () => {
  const a = mensajeBorrador('https://hola-mako.com/plan/revisar/prop111');
  const b = mensajeBorrador('https://hola-mako.com/plan/revisar/prop222');
  // Lo único distinto entre dos mensajes son los ids. Si algún día alguien le mete
  // un contador, un nombre de proyecto o una hora, este test lo caza.
  assert.equal(a.replace('prop111', 'X'), b.replace('prop222', 'X'));
  assert.equal(mensajeBorrador('L'), mensajeBorrador('L'), 'tiene que ser determinista');
});

test('el mensaje canónico incluye el link EXACTO, sin recortarlo ni reescribirlo', () => {
  // El id son 17 caracteres al azar sin redundancia: si la función los toca, el
  // link resuelve a otro borrador o a ninguno.
  const link = 'https://hola-mako.com/plan/revisar/propmsn7pbzb4bz48';
  assert.ok(mensajeBorrador(link).includes(link));
});

test('lo que escribe el código siempre pasa la compuerta', () => {
  // Si no, reemplazar la respuesta por el mensaje canónico crearía un bloqueo
  // infinito: la guarda descartaría su propia salida.
  const link = 'https://hola-mako.com/plan/revisar/propmsn7pbzb4bz48';
  for (const ruta of [RUTA_PLAN, 'mistral router:sonnet (dato/acción) «x»', 'groq router:lean (charla) «hola»']) {
    assert.deepEqual(validarRespuestaDoer(mensajeBorrador(link), { motivoRuta: ruta, linkBorrador: link }), { ok: true }, ruta);
  }
});

// =============================================================================
// El error genérico que se presentaba como un error del plan
// =============================================================================

test('El aviso de «no pude» dice QUÉ falló, no la ruta que había a mano', async () => {
  const { avisoNoPude, AVISO_NO_PUDE } = await import('../lib/respuesta-doer');
  // Un turno que SÍ iba a crear un borrador: el texto de siempre.
  assert.equal(avisoNoPude(true), AVISO_NO_PUDE);
  // Un turno que no tenía nada que ver con el plan: NO puede hablar de borradores.
  const otro = avisoNoPude(false);
  assert.ok(!/borrador/i.test(otro),
    `un saludo o una pregunta siguen recibiendo un mensaje sobre borradores: «${otro}»`);
  assert.notEqual(otro, AVISO_NO_PUDE);
});

test('No se escala a Claude sin preguntar si el veto lo permite', () => {
  // `mako-doer-in` NO está en CLAUDE_PERMITIDO y el veto vive en el fetch, así
  // que la escalada tiraba SIEMPRE. Medido en anthropic_usage: 8 vetos entre el
  // 17/8 y el 24/8, cada uno terminando en un «no pude» para un cliente, y
  // ninguno visible. `evaluarPermiso` es puro: preguntar cuesta cero.
  const src = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
  const iPermiso = src.indexOf('evaluarPermiso({ feature:');
  const iEscalada = src.indexOf('escalado a Claude');
  assert.ok(iPermiso > 0, 'la escalada dejó de consultar el veto: vuelve a tirar una excepción garantizada');
  assert.ok(iEscalada > iPermiso,
    'el veto se consulta DESPUÉS de escalar: no sirve de nada preguntar cuando ya se pagó el error');
  assert.match(src, /if \(!permiso\.ok\)/, 'se perdió la rama que no escala cuando el veto dice que no');
});

test('mako-doer-in no está autorizado a pagar Claude, y eso es a propósito', async () => {
  // Este test es un CENTINELA de la contradicción, no una preferencia. Si algún
  // día se autoriza (una fila en CLAUDE_PERMITIDO con fecha y quién lo pidió),
  // este test falla y obliga a mirar la escalada de lib/mako-doer-in.ts, que hoy
  // está apagada por el veto. Las dos cosas tienen que moverse juntas.
  const { evaluarPermiso } = await import('../lib/veto-claude');
  const v = evaluarPermiso({ feature: 'mako-doer-in', model: 'claude-sonnet-5' });
  assert.equal(v.ok, false,
    'mako-doer-in quedó autorizado a pagar Claude: revisá la escalada de lib/mako-doer-in.ts, que se escribió cuando NO lo estaba');
});
