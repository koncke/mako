// La curva de retención del VSL. Los casos de acá no son hipotéticos: cada uno
// es un modo de falla que este dominio YA produjo en producción.
//
// El más caro: del 15/jul al 5/ago de 2026 el beacon mandó 'exit' con
// porcentaje 0 porque el player nunca le dijo la duración al navegador. Los
// números salían igual — 266 abandonos "en el segundo cero" — y nadie se dio
// cuenta de que no se estaba midiendo nada. De ahí la regla que más se testea
// acá: sin avance positivo el resultado es hayDatos:false, nunca 0%.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  avanceDe,
  avancePorPersona,
  curvaRetencion,
  histogramaAbandono,
  corteDeSegundo,
  esEventoDeVideo,
  type EventoVsl,
} from '../lib/vsl-retencion';

const ev = (o: Partial<EventoVsl>): EventoVsl => ({
  visitor_id: 'v1',
  tipo_evento: 'play',
  porcentaje: null,
  segundos: null,
  video_id: null,
  ...o,
});

// ── La frontera entre el VIDEO y la PÁGINA ──────────────────────────────────
// Desde la v14 el snippet manda por el mismo canal, y a la misma columna
// `segundos`, el tiempo en la PÁGINA: 'salio', 'volvio', 'cierre'. Como los
// consumidores filtraban «todo menos play», esos segundos se dividían por la
// duración del video y salían convertidos en retención.
//
// Medido en producción el 25/08/2026, antes del filtro: 3.416 filas producían un
// avance inventado, y el ws13 —landing SIN video, con el cartel «Video
// próximamente»— reportaba 30 personas que reprodujeron el video.

test('el tiempo en la PÁGINA no es avance del VIDEO', () => {
  // 166 s con la pestaña abierta, sobre un video de 1419 s, daba 11,7%.
  for (const t of ['salio', 'volvio', 'cierre']) {
    assert.equal(avanceDe(ev({ tipo_evento: t, segundos: 166 }), 1419), null, t);
  }
});

test('un clic, un agendo o un opt-in bloqueado tampoco son avance', () => {
  for (const t of ['click', 'agendo', 'optin_bloqueado', 'desconocido', null]) {
    assert.equal(avanceDe(ev({ tipo_evento: t, segundos: 300, porcentaje: 42 }), 1419), null, String(t));
  }
});

test('los hitos de video siguen midiendo igual', () => {
  assert.equal(avanceDe(ev({ tipo_evento: 'p50', porcentaje: 50 }), 1419), 50);
  assert.equal(avanceDe(ev({ tipo_evento: 's300', segundos: 300 }), 600), 50);
  assert.equal(avanceDe(ev({ tipo_evento: 'exit', segundos: 300 }), 600), 50);
  assert.equal(avanceDe(ev({ tipo_evento: 'fin', porcentaje: 100 }), 1419), 100);
  assert.equal(avanceDe(ev({ tipo_evento: 'retoma', segundos: 150 }), 600), 25);
});

test('quien solo estuvo en la página NO entra al conteo de espectadores', () => {
  // Es el bug del ws13: `porPersona.size` alimenta «personas que reprodujeron el
  // video» en lib/landing-analyst.ts. Sin el corte, la persona entra al mapa con
  // valor null y suma igual — así una landing sin video reportaba 30 espectadores.
  const soloPagina = avancePorPersona([
    ev({ visitor_id: 'a', tipo_evento: 'salio', segundos: 90 }),
    ev({ visitor_id: 'b', tipo_evento: 'click', segundos: 5 }),
    ev({ visitor_id: 'c', tipo_evento: 'cierre', segundos: 200 }),
  ], 1419);
  assert.equal(soloPagina.size, 0);

  // Y quien SÍ dio play sigue contando, con su avance intacto.
  const mixto = avancePorPersona([
    ev({ visitor_id: 'a', tipo_evento: 'salio', segundos: 90 }),
    ev({ visitor_id: 'b', tipo_evento: 'play' }),
    ev({ visitor_id: 'b', tipo_evento: 'p40', porcentaje: 40 }),
  ], 1419);
  assert.deepEqual([...mixto], [['b', 40]]);
});

test('esEventoDeVideo: la lista es blanca, no una lista de excepciones', () => {
  for (const t of ['play', 'pausa', 'retoma', 'fin', 'exit', 'p5', 'p100', 's3', 's1200']) {
    assert.equal(esEventoDeVideo(t), true, t);
  }
  // Lo importante no es que estos den false, es que CUALQUIER tipo nuevo lo dé:
  // el día que el snippet emita un evento de página más, no hay que acordarse
  // de sumarlo a ninguna lista de exclusión.
  for (const t of ['salio', 'volvio', 'cierre', 'click', 'agendo', 'pageview', 'inventado_manana', '', null, undefined]) {
    assert.equal(esEventoDeVideo(t), false, String(t));
  }
});

// ── El cero medido vs. el cero por no medir ─────────────────────────────────

test('todo en porcentaje 0 → hayDatos:false, jamás una curva en cero', () => {
  const eventos = [
    ev({ visitor_id: 'a', tipo_evento: 'play', porcentaje: 0 }),
    ev({ visitor_id: 'a', tipo_evento: 'exit', porcentaje: 0 }),
    ev({ visitor_id: 'b', tipo_evento: 'play', porcentaje: 0 }),
    ev({ visitor_id: 'b', tipo_evento: 'exit', porcentaje: 0 }),
  ];
  const r = curvaRetencion(eventos, 1800);
  assert.equal(r.hayDatos, false, 'con cero medición no puede haber datos');
  assert.equal(r.curva.length, 0, 'no se dibuja ninguna curva');
  assert.equal(r.arrancaron, 2);
  assert.equal(r.medidos, 0);
  assert.equal(r.sinMedicion, 2);
});

test('duración desconocida y solo segundos → tampoco se inventa un cero', () => {
  const eventos = [ev({ visitor_id: 'a', segundos: 300 }), ev({ visitor_id: 'b', segundos: 120 })];
  const r = curvaRetencion(eventos, null);
  assert.equal(r.hayDatos, false, 'sin duración no se puede convertir a %');
  assert.equal(r.medianaPct, null);
});

test('el % se deriva de segundos cuando el navegador no lo pudo calcular', () => {
  assert.equal(avanceDe(ev({ segundos: 900, porcentaje: null }), 1800), 50);
  assert.equal(avanceDe(ev({ segundos: 1800, porcentaje: null }), 1800), 100);
  assert.equal(avanceDe(ev({ segundos: 0, porcentaje: 0 }), 1800), null, 'cero no es medición');
  assert.equal(avanceDe(ev({ segundos: null, porcentaje: null }), 1800), null);
  assert.equal(avanceDe(ev({ segundos: 900 }), null), null, 'sin duración no hay derivación');
});

test('el porcentaje del navegador le gana a la derivación por segundos', () => {
  assert.equal(avanceDe(ev({ porcentaje: 73, segundos: 100 }), 1800), 73);
});

// ── Personas, no filas ──────────────────────────────────────────────────────

test('un visitante con tres plays es UNA persona, no tres', () => {
  const eventos = [
    ev({ visitor_id: 'a', porcentaje: 10 }),
    ev({ visitor_id: 'a', porcentaje: 40 }),
    ev({ visitor_id: 'a', porcentaje: 25 }),
  ];
  const mapa = avancePorPersona(eventos, 1800);
  assert.equal(mapa.size, 1);
  assert.equal(mapa.get('a'), 40, 'se queda con el avance MÁXIMO');
  assert.equal(curvaRetencion(eventos, 1800).arrancaron, 1);
});

test('los eventos sin visitor_id se descartan (inflarían el denominador)', () => {
  const eventos = [ev({ visitor_id: null, porcentaje: 50 }), ev({ visitor_id: '  ', porcentaje: 50 })];
  assert.equal(avancePorPersona(eventos, 1800).size, 0);
});

// ── Dos videos son dos curvas, y el corte se hace AGRUPANDO AFUERA ──────────
// Hasta el 6/11/2026 estas tres funciones tomaban un `videoId` y filtraban adentro.
// Nadie se lo pasó nunca en app/ ni en lib/ —sólo este test— y además filtraba MAL.
// El corte por video vive en `videosDelPeriodo` (lib/graficos-datos-extra.ts), que es
// lo que lee el VSL Analyst; el test de abajo usa SU agrupado.
//
// PROBADO ROMPIÉNDOLO (6/11/2026; base 18 / 0, cayeron las SEIS). Pasan / fallan:
//   R1 vuelve el `videoId` muerto a `avancePorPersona`            → 17 / 1
//   R2 `videosDelPeriodo` deja de agrupar por `video_id`          → 17 / 1
//   R3 se va el selector de video del VSL Analyst                 → 17 / 1
//   R4 la curva «Dónde se van» deja de leer `retencion_vsl/corte` → 17 / 1
//   R5 la tabla «Por video» deja de desglosar por video           → 17 / 1
//   R6 `arrancaron` deja de contar la gente que arrancó           → 16 / 2
// R6 es la que mide el test de abajo y no el guard: sin ella, el «1 → 2 personas» que
// deja ver el agujero del parámetro viejo podría estar midiendo nada.

test('dos videos no se mezclan, y el evento sin video_id va a su PROPIO grupo', () => {
  const eventos = [
    ev({ visitor_id: 'a', porcentaje: 90, video_id: 'vsl-A' }),
    ev({ visitor_id: 'b', porcentaje: 10, video_id: 'vsl-B' }),
    // ⚠️ EL CASO QUE EL PARÁMETRO VIEJO NO VEÍA: un evento que no dice de qué video es.
    ev({ visitor_id: 'c', porcentaje: 100, video_id: null }),
  ];
  // El agrupado del único camino vivo: la clave es el `video_id` o '' (lib/graficos-datos-extra.ts).
  const porVideo = new Map<string, EventoVsl[]>();
  for (const e of eventos) {
    const k = (e.video_id ?? '').trim();
    (porVideo.get(k) ?? porVideo.set(k, []).get(k)!).push(e);
  }
  assert.deepEqual([...porVideo.keys()].sort(), ['', 'vsl-A', 'vsl-B'], 'el que no dice su video tiene que tener grupo propio');

  const a = curvaRetencion(porVideo.get('vsl-A')!, 1800);
  assert.equal(a.arrancaron, 1, 'solo la gente del video A');
  assert.equal(a.curva.find((p) => p.corte === 90)?.vivos, 1, 'llegó al 90%');
  assert.equal(a.curva.find((p) => p.corte === 95)?.vivos, 0, 'pero no al 95%');
  const b = curvaRetencion(porVideo.get('vsl-B')!, 1800);
  assert.equal(b.arrancaron, 1);
  assert.equal(b.curva.find((p) => p.corte === 10)?.vivos, 1, 'el de B llegó al 10%');
  // Cada persona aparece en UNA curva, y la suma cierra con la gente que hubo.
  assert.equal([...porVideo.values()].reduce((s, es) => s + curvaRetencion(es, 1800).arrancaron, 0), 3);

  // ⚠️ Y ESTO ES LO QUE MEDÍA MAL EL `videoId` QUE SE FUE, con su condición textual
  // (`if (videoId && ev.video_id && ev.video_id !== videoId) continue`): el evento sin
  // `video_id` no se descartaba, así que «c» entraba en la curva de los DOS videos y su
  // 100% se contaba dos veces. Queda medido para que nadie lo reponga creyendo que filtra.
  const comoAntes = (vid: string) => curvaRetencion(eventos.filter((e) => !(vid && e.video_id && e.video_id !== vid)), 1800);
  assert.equal(comoAntes('vsl-A').arrancaron, 2, 'el parámetro viejo metía a «c» en la curva de A');
  assert.equal(comoAntes('vsl-B').arrancaron, 2, 'y en la de B también: el mismo 100% contado dos veces');
});

test('CABLEADO: la curva por video la agrupa videosDelPeriodo, y el videoId muerto no vuelve', () => {
  const leer = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  // ⚠️ SIN COMENTARIOS, y las líneas antes que los bloques: el comentario de
  // `avancePorPersona` explica por qué el parámetro se fue, así que NOMBRA lo que este
  // assert prohíbe. Un `doesNotMatch` sobre el archivo entero se acusaría a sí mismo.
  const sinComentarios = (x: string) => x.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sinComentarios(leer('../lib/vsl-retencion.ts')), /videoId/,
    'volvió el parámetro que nadie pasa y que deja entrar los eventos sin video_id en la curva de cualquier video');

  // El que SÍ agrupa, con la clave que les da grupo propio a los eventos sin video.
  const extra = leer('../lib/graficos-datos-extra.ts');
  assert.match(extra, /export async function videosDelPeriodo/, 'sin esto no hay curva por video en ningún lado');
  assert.match(sinComentarios(extra), /const k = \(r\.video_id \?\? ''\)\.trim\(\);/, 'sin esa clave, los eventos sin video no tienen grupo propio');

  // Y la pantalla, que es donde se ve: el selector, la curva y la tabla por video.
  const plant = sinComentarios(leer('../lib/graficos-plantillas-analysts.ts'));
  assert.match(plant, /lista\(id\('vs-video'\), 'video'\)/, 'sin el selector no se puede elegir de qué video es la curva');
  assert.match(plant, /id: id\('vs-curva'\)[^}]*fuente: 'retencion_vsl', dimension: 'corte'/, 'falta la curva «Dónde se van»');
  assert.match(plant, /id: id\('vs-videos'\)[^}]*dimension: 'video'/, 'falta la tabla «Por video»');
});

// ── Invariantes de la curva ─────────────────────────────────────────────────

test('la curva nunca sube', () => {
  const eventos = [
    ev({ visitor_id: 'a', porcentaje: 100 }),
    ev({ visitor_id: 'b', porcentaje: 55 }),
    ev({ visitor_id: 'c', porcentaje: 20 }),
    ev({ visitor_id: 'd', porcentaje: 5 }),
  ];
  const r = curvaRetencion(eventos, 1800);
  assert.equal(r.hayDatos, true);
  for (let i = 1; i < r.curva.length; i++) {
    assert.ok(
      r.curva[i].vivos <= r.curva[i - 1].vivos,
      `sube en el corte ${r.curva[i].corte}: ${r.curva[i - 1].vivos} → ${r.curva[i].vivos}`,
    );
  }
  assert.equal(r.curva[0].vivos, 4, 'los cuatro pasaron el 5%');
  assert.equal(r.curva[r.curva.length - 1].vivos, 1, 'solo uno llegó al 100%');
});

test('la mayor caída señala el tramo donde se va más gente', () => {
  // Ocho personas: siete abandonan entre el 20% y el 25%.
  const eventos = [
    ev({ visitor_id: 'z', porcentaje: 100 }),
    ...Array.from({ length: 7 }, (_, i) => ev({ visitor_id: 'p' + i, porcentaje: 22 })),
  ];
  const r = curvaRetencion(eventos, 1800);
  assert.ok(r.mayorCaida, 'tiene que haber una caída');
  assert.equal(r.mayorCaida?.desde, 20);
  assert.equal(r.mayorCaida?.hasta, 25);
  assert.equal(r.mayorCaida?.perdidos, 7);
});

test('la mediana es el corte donde sobrevive la mitad', () => {
  const eventos = [
    ev({ visitor_id: 'a', porcentaje: 80 }),
    ev({ visitor_id: 'b', porcentaje: 60 }),
    ev({ visitor_id: 'c', porcentaje: 20 }),
    ev({ visitor_id: 'd', porcentaje: 10 }),
  ];
  const r = curvaRetencion(eventos, 1800);
  assert.equal(r.medianaPct, 60, 'al 60% siguen 2 de 4');
});

// ── Abandono ────────────────────────────────────────────────────────────────

test('el histograma de abandono ignora los exit sin medición', () => {
  const eventos = [
    ev({ visitor_id: 'a', tipo_evento: 'exit', porcentaje: 0 }),
    ev({ visitor_id: 'b', tipo_evento: 'exit', segundos: 900 }),
    ev({ visitor_id: 'c', tipo_evento: 'play', porcentaje: 90 }),
  ];
  const h = histogramaAbandono(eventos, 1800);
  const total = h.reduce((s, x) => s + x.salidas, 0);
  assert.equal(total, 1, 'solo el exit medible cuenta; el play no es un abandono');
  assert.equal(h.find((x) => x.corte === 50)?.salidas, 1);
});

// ── El puente con el guion ──────────────────────────────────────────────────

test('un bloque del guion cae en el corte que le corresponde', () => {
  assert.equal(corteDeSegundo(0, 1800), 5, 'el arranque cae en el primer corte');
  assert.equal(corteDeSegundo(900, 1800), 50);
  assert.equal(corteDeSegundo(1800, 1800), 100);
  assert.equal(corteDeSegundo(500, null), null, 'sin duración no hay puente');
});
