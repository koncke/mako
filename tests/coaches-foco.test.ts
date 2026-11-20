// EL FOCO EN LOS COACHES (20/11/2026, Martín en la llamada con Leila, 01:17:00–01:30:28: «un paso de, che, ¿por qué querés hacer tantas
// cosas?» y «¿qué es lo máximo que podés hacer sin que te desenfoque el objetivo principal?»; la forma la cerró el Cerebro). En Offer
// Coach y en Funnel Coach (los del V2): quien trae TRES o más ideas, negocios, ofertas o funnels recibe cuatro preguntas DE A UNA, y
// MaKo le propone enfocarse en una con el porqué de sus respuestas. Si insiste, se respeta y no se vuelve a preguntar. Con una o dos,
// no aparece. Es una regla del coach (su contexto), sin un motor nuevo: el test mira que el contexto la diga entera.
// Roto a propósito el 20/11 (cada uno cae): el Offer Coach sin el paso (1), el Funnel Coach sin el paso (1), las preguntas juntas (2),
// sin «con una o dos, no» (2), sin respetar al que insiste (2), y HASTA_TRES preguntando «por qué» con dos funnels (3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASO_DEL_FOCO, PREGUNTAS_DEL_FOCO, contextoDelFunnelCoach, contextoDelFunnelCoachV2, contextoDelOfferCoach,
} from '../lib/asesores/contexto';

test('1. en Offer Coach y en Funnel Coach (V2) está el paso del foco; el coach único, sin cambios', () => {
  for (const [nombre, ctx] of [['Offer Coach', contextoDelOfferCoach(null)], ['Funnel Coach', contextoDelFunnelCoachV2()], ['Offer Coach sin gurú', contextoDelOfferCoach(null, true)], ['Funnel Coach sin gurú', contextoDelFunnelCoachV2(true)]] as const) {
    assert.ok(ctx.includes(PASO_DEL_FOCO), `${nombre}: sin el paso del foco`);
  }
  assert.ok(!contextoDelFunnelCoach(null).includes('EL FOCO'), 'el coach único no cambia');
});

test('2. con TRES o más: las cuatro preguntas, en orden y DE A UNA; con una o dos, no; si insiste, sigue y no se vuelve a preguntar', () => {
  assert.deepEqual([...PREGUNTAS_DEL_FOCO], [
    '¿Por qué quieres hacer tantas cosas a la vez?',
    'De todas, ¿cuál se conecta más con tu propósito y la harías todos los días aunque cueste?',
    '¿Qué es lo máximo que puedes sostener sin desenfocarte de tu objetivo principal?',
    '¿Qué puedes dejar de lado por ahora?',
  ]);
  // En el texto, numeradas y en ese orden.
  let desde = 0;
  PREGUNTAS_DEL_FOCO.forEach((q, i) => {
    const j = PASO_DEL_FOCO.indexOf(`${i + 1}) «${q}»`, desde);
    assert.ok(j >= desde, `la pregunta ${i + 1} no está, o no va en su orden`);
    desde = j;
  });
  assert.match(PASO_DEL_FOCO, /si la persona trae TRES O MÁS ideas, negocios, ofertas o funnels a la vez/);
  assert.match(PASO_DEL_FOCO, /DE A UNA, esperando cada respuesta \(nunca dos en el mismo mensaje\)/);
  assert.match(PASO_DEL_FOCO, /le propones enfocarse en UNA, con el porqué sacado de sus propias respuestas/);
  assert.match(PASO_DEL_FOCO, /Si insiste en seguir con varias, lo respetas y sigues, y no vuelves a preguntarlo en esta conversación\./);
  assert.match(PASO_DEL_FOCO, /Con una o dos, esto no va: sigue normal\./);
  // De tú y neutro en género (la cuarta decía «¿Qué estás dispuesto…?»: cambiada el 20/11).
  assert.doesNotMatch(PASO_DEL_FOCO, /dispuest[oa]|\b(querés|podés|tenés)\b/);
});

test('3. HASTA TRES funnels: con dos, se propone empezar por uno (sin interrogar); con tres, va el foco', () => {
  const f = contextoDelFunnelCoachV2();
  assert.match(f, /HASTA TRES: puede elegir hasta 3 funnels\. Si elige dos, proponle empezar por uno \(el que antes le trae clientes con lo que ya tiene\); si elige tres, va EL FOCO \(abajo\)\. Si insiste en varios, respétalo\./);
  assert.doesNotMatch(f, /Si elige varios, pregúntale por qué/, 'con dos, no se pregunta «por qué»');
});
