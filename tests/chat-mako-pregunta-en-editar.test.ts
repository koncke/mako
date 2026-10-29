// =============================================================================
// Una PREGUNTA en «Editar», con o sin signos, se CONTESTA y no toca el lienzo (27/10/2026, 874749710-11)
// =============================================================================
// Martín (24/10, la llamada con Leandro): «Mako debería detectar si vos en realidad quisiste discutir o editar y responderte
// igualmente». El 24/10 entró la pregunta DICTADA (`esPreguntaDictada`, f18); el 26/10 le volvió a pasar con Aaron. Lo que
// quedaba afuera, medido con los chats reales del lienzo (sólo lectura): «y en instagram? porque no me aparece en la
// configuración.» (Leandro, ws10, 25/10) iba al modelo de EDITAR, porque el «?» estaba en el medio; una pregunta con un
// saludo adelante («Hola MaKo, …», «Una pregunta: …») tampoco se reconocía. Y al revés: «¿Le agregás un audio al final?»
// empezaba con «¿» y se CONTESTABA en vez de hacerse.
// En la ruta, lo que va a explicar sólo puede devolver {"respuesta"} y vuelve el borrador tal cual: con el camino bien
// elegido el lienzo no se puede tocar. Probado con el modelo real (Claude y Gemini): el arnés del scratchpad
// arnes-pregunta-en-editar.mts, en docs/hallazgos-chatbot.md.
// Correr: node --import tsx --test tests/chat-mako-pregunta-en-editar.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { esPreguntaDirecta, vaAExplicar, errorDeRespuestaEnEditar, ERROR_EDITAR_SIN_CAMBIOS, LO_QUE_NO_ES_TARJETA } from '../lib/flujo-ia-intencion';
import { esPreguntaConSignos, esConsulta } from '../lib/flujo-ia-consulta';

/** El camino de la ruta en «Editar» (app/api/chat-agent/secuencias/ia/route.ts): true = contesta, sin tocar el lienzo. */
const contesta = (p: string) => vaAExplicar('editar', false, esConsulta(p), esPreguntaDirecta(p));

test('las preguntas reales y sus formas se contestan en «Editar»', () => {
  for (const p of [
    // Leandro, ws10, 25/10 (los chats del lienzo).
    'y en instagram? porque no me aparece en la configuración.', 'existe un tope de comentarios que se puede responder por día?', 'como levanto un ticket',
    // Con algo adelante, con los signos en el medio, sin signos.
    'Hola MaKo, ¿qué hace esta automatización? Gracias', 'MaKo, a cuántos les llega esto', 'una pregunta, por qué no salió el segundo mensaje',
    'Che, cuándo sale el primero?', 'quiero saber cuántos leads entraron', 'desde qué número sale', 'Explícame qué hace esta automatización',
    'qué dice el segundo mensaje', 'a quién le llega', 'cómo lo hago para que no salgan todos juntos',
  ]) assert.equal(contesta(p), true, p);
});

test('un pedido no se contesta: con signos, con un texto citado que pregunta, o con una pregunta y un pedido juntos', () => {
  for (const p of [
    '¿Le agregás un audio al final?', '¿Se puede agregar un audio al final?', '¿Qué hace? Y agregale un audio',
    'Que el último diga «¿Te late que platiquemos?»', 'Órale, ponle al final uno que diga «¿Te late que platiquemos 10 minutos esta semana?» y que espere un día, ¿sale?',
    'Explicale al lead que el precio subió', 'como te dije, el segundo tiene que ir primero', 'que no salgan todos juntos', 'hola',
    'MaKo, agrégale una notificación por WhatsApp diciéndole el LID que su cuota venció.',
  ]) assert.equal(contesta(p), false, p);
  // Lo citado no cuenta: sus signos son del texto para el lead.
  assert.equal(esPreguntaConSignos('Que diga «¿Te late?»'), false);
  assert.equal(esPreguntaConSignos('Hola, ¿qué hace? Gracias'), true);
});

test('en «Editar», «no tengo» con su motivo vale como respuesta (no se manda a armar otra cosa)', () => {
  // El arnés con el modelo real: «¿Le agregás un audio al final?» sin audios guardados; Gemini contestó esto y se rechazaba.
  const o = { esPregunta: false, charlaConTextos: false };
  assert.equal(errorDeRespuestaEnEditar('¿Le agregás un audio al final?', 'No tengo audios guardados. Sube el audio a Archivos y dime su título.', o), null);
  // Delegar sigue siendo un error: «no tengo cómo, hazlo tú».
  assert.equal(errorDeRespuestaEnEditar('agregale un audio', 'No tengo cómo: agrégalo tú desde el lienzo.', o), ERROR_EDITAR_SIN_CAMBIOS);
});

test('MaKo sabe contestar a quién le escriben las automatizaciones (el número compartido de Leandro)', () => {
  // Va en explicar Y en editar (`extrasDelUser`): «¿le contestaría a los clientes de la distribuidora?» se contesta con esto.
  assert.match(LO_QUE_NO_ES_TARJETA, /sólo a los leads del CRM de este negocio/);
  assert.match(LO_QUE_NO_ES_TARJETA, /no es un lead[^.]*no entra en ninguna/);
  assert.match(LO_QUE_NO_ES_TARJETA, /SÍ está en el CRM[^.]*entra en las de su etapa/);
});

// ROTURAS (27/10/2026, una por vez y restaurada; scratchpad romper-pregunta.cjs): ver docs/hallazgos-chatbot.md.

test('⚠️ un pedido en VOSEO o en subjuntivo se EDITA, aunque traiga un «?» o arranque con «Está bien» (la revisión del Cerebro, 28/10)', () => {
  // Los 7 de 8 que antes se editaban y la entrega mandaba a contestar (r3-pregunta-en-editar del refutador).
  for (const p of [
    'El segundo mensaje no tiene emoji? poné uno al principio', 'Está bien, poné el audio primero', 'Se entiende? escribí el segundo más corto',
    'Queda largo? hacé el primero más corto', 'Está bien, subí la espera a 2 horas', 'El primer mensaje que diga hola, ¿cómo estás? y después el link',
    'Está bien, que salga a las 10',
    // El voseo con el pronombre pegado, y el «Que diga» que ya iba a contestar en la base.
    'Queda raro? ponelo al final', 'hacele un audio más corto', 'Que el último diga ¿te quedó alguna duda?',
  ]) assert.equal(contesta(p), false, p);
  // Lo de tú y de -ar sigue editando, y lo prometido se sigue contestando.
  for (const p of ['El segundo mensaje no tiene emoji? pon uno al principio', 'Está bien, agregá el audio primero', '¿Le agregás un audio al final?'])
    assert.equal(contesta(p), false, p);
  for (const p of [
    'y en instagram? porque no me aparece en la configuración.', 'Hola MaKo, ¿a cuántos les llega?', 'desde qué número sale',
    '¿qué hace esta automatización?', 'Está bien así?', '¿Hace falta que tenga teléfono?', 'por qué sale que diga hola',
  ]) assert.equal(contesta(p), true, p);
});
