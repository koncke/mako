// La GRILLA de horarios (app/crm/horarios-respuesta.ts): de qué horas se compone un
// día, cuáles se descartan por pasadas y cuáles quedan ocupadas.
//
// Por qué existe este archivo: la lógica vivía adentro de horariosLibresDeGoogle(),
// que es `server-only` y habla con Google — o sea, intesteable. Se movió al módulo
// puro del contrato, que es el mismo que importa el cliente para dibujar la grilla
// cuando la agenda no se pudo leer. Estos tests son el candado de las tres reglas
// que el dueño pidió de frente: el día entero de 24 h (00:00-23:45), los cuartos de
// hora, y que un hueco solo sirva si la reunión entra ENTERA.
// Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirGrilla, filtrarPasados, marcarOcupados, normalizarRango, horaAMinutos, hhmm,
  HORA_DESDE_DEFECTO, HORA_HASTA_DEFECTO, MINUTO_HASTA_DEFECTO, PASO_MIN_DEFECTO, DURACION_DEFECTO_MIN, MARGEN_MIN_DEFECTO,
  type Ocupado,
} from '../app/crm/horarios-respuesta';

// Tijuana en agosto = PDT (UTC-7). Fecha fija: los tests no pueden depender de hoy.
const TZ = 'America/Tijuana';
const DIA = '2026-08-10';
const rango = normalizarRango();

// ── El rango ────────────────────────────────────────────────────────────────────

test('el dia entero: la grilla va de 00:00 a 23:45', () => {
  // El pedido, textual y repetido dos veces: "No pongas limitacion, abrilo a 24 hs
  // te lo habia dicho". Se habia recortado a 07:00-22:00 con el argumento de que la
  // madrugada es ruido; el dueno lo rechazo. Este CRM atiende husos que no son el
  // suyo, y una lista que no ofrece una hora vuelve IMPOSIBLE lo que era infrecuente.
  assert.equal(HORA_DESDE_DEFECTO, 0);
  assert.equal(HORA_HASTA_DEFECTO, 23);
  const g = construirGrilla(DIA, TZ, rango);
  assert.equal(g[0].hora, '00:00', 'el dia arranca a medianoche');
  assert.equal(g[g.length - 1].hora, '23:45', 'y el ultimo cuarto tambien se puede agendar');
  for (const h of ['03:00', '06:30', '20:00', '23:00']) {
    assert.ok(g.some((s2) => s2.hora === h), `${h} tiene que existir`);
  }
  // 24 h con paso de 15' = 96 horarios. Lo que hace usable el desplegable no es
  // recortarlo (ver ANCLA_DEFECTO y que los ocupados no se listan).
  assert.equal(g.length, 96);
});

test('existen los cuartos de hora', () => {
  // "¿Qué pasa si se quiere agendar y cuarto?"
  assert.equal(PASO_MIN_DEFECTO, 15);
  const horas = construirGrilla(DIA, TZ, rango).map((s) => s.hora);
  for (const h of ['09:15', '09:30', '09:45', '18:15']) assert.ok(horas.includes(h), `falta ${h}`);
});

test('la grilla completa tiene el largo esperado y no se repite ninguna hora', () => {
  const g = construirGrilla(DIA, TZ, rango);
  const esperados = (rango.hastaMin - rango.desdeMin) / rango.pasoMin + 1;
  assert.equal(g.length, esperados);
  assert.equal(new Set(g.map((s) => s.hora)).size, g.length);
});

test('el inicioIso es el instante REAL de esa hora local, no el del navegador', () => {
  // 09:00 en Tijuana en agosto (PDT, UTC-7) = 16:00 UTC. Si esto se rompe, un closer
  // en otro huso ve un horario y guarda otro momento.
  const g = construirGrilla(DIA, TZ, rango);
  const nueve = g.find((s) => s.hora === '09:00');
  assert.equal(nueve?.inicioIso, '2026-08-10T16:00:00.000Z');
});

test('fecha inválida = grilla vacía, no una grilla inventada', () => {
  for (const f of ['', '2026-13-40', 'mañana', '2026-02-30']) {
    assert.deepEqual(construirGrilla(f, TZ, rango), []);
  }
});

// ── La normalización de parámetros ──────────────────────────────────────────────

test('normalizarRango acota lo absurdo en vez de generar una grilla infinita', () => {
  const r = normalizarRango({ desdeMin: -500, hastaMin: 99 * 60, pasoMin: 0, duracionMin: 9999, margenMin: -3 });
  assert.equal(r.desdeMin, 0);
  assert.equal(r.hastaMin, 24 * 60 - 1);
  assert.equal(r.pasoMin, 5, 'el paso mínimo evita la grilla infinita');
  assert.equal(r.duracionMin, 480);
  assert.equal(r.margenMin, 0);
  // Y con eso acotado, la grilla sigue siendo finita y chica.
  assert.ok(construirGrilla(DIA, TZ, r).length <= 24 * 12);
});

test('normalizarRango sin nada devuelve los defaults del contrato', () => {
  const r = normalizarRango();
  assert.deepEqual(r, {
    desdeMin: HORA_DESDE_DEFECTO * 60,
    hastaMin: HORA_HASTA_DEFECTO * 60 + MINUTO_HASTA_DEFECTO,
    pasoMin: PASO_MIN_DEFECTO,
    duracionMin: DURACION_DEFECTO_MIN,
    margenMin: MARGEN_MIN_DEFECTO,
  });
});

test('margen 0 sobrevive: no puede caer al default', () => {
  // Un `|| DEFECTO` acá haría que pedir "sin margen" devuelva 30 minutos.
  assert.equal(normalizarRango({ margenMin: 0 }).margenMin, 0);
});

test('un hasta por debajo del desde deja un horario, no cero', () => {
  // Cero sería indistinguible de "ese día no tiene horarios configurados".
  const r = normalizarRango({ desdeMin: 600, hastaMin: 300 });
  assert.equal(r.hastaMin, 600);
  assert.equal(construirGrilla(DIA, TZ, r).length, 1);
});

test('la jornada admite medias horas (8.5 = 8:30)', () => {
  const r = normalizarRango({ desdeMin: horaAMinutos(8.5), hastaMin: horaAMinutos(9.5) });
  assert.deepEqual(construirGrilla(DIA, TZ, r).map((s) => s.hora), ['08:30', '08:45', '09:00', '09:15', '09:30']);
});

// ── Lo que ya pasó, y el margen ─────────────────────────────────────────────────

test('los horarios pasados se van de la grilla', () => {
  const g = construirGrilla(DIA, TZ, rango);
  // 18:00 Tijuana = 01:00 UTC del 11.
  const ahora = Date.parse('2026-08-11T01:00:00Z');
  const q = filtrarPasados(g, ahora, 0);
  assert.ok(!q.some((s) => s.hora < '18:00'));
  assert.equal(q[0].hora, '18:00', 'con margen 0 el borde exacto sigue siendo elegible');
});

test('el margen evita ofrecer una reunión "en dos minutos"', () => {
  const g = construirGrilla(DIA, TZ, rango);
  // 10:14 Tijuana. Sin margen ofrecería las 10:15.
  const ahora = Date.parse('2026-08-10T17:14:00Z');
  assert.equal(filtrarPasados(g, ahora, 0)[0].hora, '10:15');
  assert.equal(filtrarPasados(g, ahora, MARGEN_MIN_DEFECTO)[0].hora, '10:45');
});

test('con el rango nuevo, a las 19:30 TODAVÍA quedan horarios hoy', () => {
  // Con la jornada vieja (tope 19:00) a esta hora el día quedaba vacío y había que
  // mandar al usuario a otro día. Ese era el reclamo.
  const g = construirGrilla(DIA, TZ, rango);
  const ahora = Date.parse('2026-08-11T02:30:00Z'); // 19:30 en Tijuana
  const q = filtrarPasados(g, ahora, MARGEN_MIN_DEFECTO);
  assert.ok(q.length > 0, 'las 20:00 y las 21:00 siguen siendo opciones válidas');
  assert.equal(q[0].hora, '20:00');
});

test('pasada la última hora del día no queda nada (y ahí sí se avisa)', () => {
  const g = construirGrilla(DIA, TZ, rango);
  const ahora = Date.parse('2026-08-11T07:00:00Z'); // medianoche en Tijuana
  assert.deepEqual(filtrarPasados(g, ahora, MARGEN_MIN_DEFECTO), []);
});

// ── El solapamiento con la duración: el caso que preguntó el dueño ──────────────

const ocupado = (desde: string, hasta: string): Ocupado => ({ ini: Date.parse(desde), fin: Date.parse(hasta) });

test('18:30 con una reunión a las 19:00 y duración 45 está OCUPADO', () => {
  // Textual del pedido: "¿qué pasa si agendo 6:30 PM y había una reunión a las 7 PM?".
  // A las 18:30 no hay nada, pero la reunión terminaría 19:15 y pisa la de las 19:00.
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [ocupado('2026-08-11T02:00:00Z', '2026-08-11T03:00:00Z')]; // 19:00–20:00 TJ
  const m = marcarOcupados(g, busy, 45);
  const por = (h: string) => m.find((s) => s.hora === h)!;
  assert.equal(por('18:30').libre, false, 'la reunión no entra entera: está ocupado');
  assert.equal(por('18:15').libre, true, '18:15 + 45 = 19:00 exacto: NO se pisa');
  assert.equal(por('19:00').libre, false);
  assert.equal(por('19:45').libre, false, 'arranca dentro del bloque');
  assert.equal(por('20:00').libre, true, 'el bloque terminó justo: libre');
});

test('la misma hora cambia de estado según cuánto dure la reunión', () => {
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [ocupado('2026-08-11T02:00:00Z', '2026-08-11T03:00:00Z')]; // 19:00 TJ
  const a30 = marcarOcupados(g, busy, 30).find((s) => s.hora === '18:30')!;
  const a45 = marcarOcupados(g, busy, 45).find((s) => s.hora === '18:30')!;
  assert.equal(a30.libre, true, '18:30 + 30 termina 19:00: entra justa');
  assert.equal(a45.libre, false);
});

test('tocarse en el borde no es pisarse', () => {
  // Un evento que termina exactamente cuando arranca el slot (y viceversa) NO ocupa.
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [ocupado('2026-08-10T17:00:00Z', '2026-08-10T18:00:00Z')]; // 10:00–11:00 TJ
  const m = marcarOcupados(g, busy, 60);
  assert.equal(m.find((s) => s.hora === '11:00')!.libre, true, 'arranca cuando el otro termina');
  assert.equal(m.find((s) => s.hora === '09:00')!.libre, true, 'termina cuando el otro arranca');
  assert.equal(m.find((s) => s.hora === '09:15')!.libre, false);
});

test('un evento de DÍA COMPLETO marcado ocupado deja el día entero sin huecos', () => {
  // Google devuelve el all-day "Ocupado" como un intervalo de 24 h. Si se colara como
  // libre, el CRM ofrecería agendar encima de un día bloqueado.
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [ocupado('2026-08-10T07:00:00Z', '2026-08-11T07:00:00Z')];
  assert.ok(marcarOcupados(g, busy, DURACION_DEFECTO_MIN).every((s) => !s.libre));
});

test('sin nada ocupado, la grilla entera queda libre', () => {
  // El caso que importa distinguir: "no hay nada tachado porque el día está libre".
  const g = construirGrilla(DIA, TZ, rango);
  assert.ok(marcarOcupados(g, [], DURACION_DEFECTO_MIN).every((s) => s.libre));
});

test('marcarOcupados NO filtra: el dato honesto viaja entero', () => {
  // Esconder los ocupados es decisión de la UI. Si el server los borrara, la pantalla
  // no podría decir "3 horarios ocupados no se muestran".
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [ocupado('2026-08-10T17:00:00Z', '2026-08-10T18:00:00Z')];
  const m = marcarOcupados(g, busy, DURACION_DEFECTO_MIN);
  assert.equal(m.length, g.length);
  assert.ok(m.some((s) => !s.libre) && m.some((s) => s.libre));
});

test('varios bloques ocupados se cruzan todos, no solo el primero', () => {
  const g = construirGrilla(DIA, TZ, rango);
  const busy = [
    ocupado('2026-08-10T16:00:00Z', '2026-08-10T17:00:00Z'), // 09:00–10:00 TJ
    ocupado('2026-08-10T21:00:00Z', '2026-08-10T22:00:00Z'), // 14:00–15:00 TJ
  ];
  const m = marcarOcupados(g, busy, 30);
  assert.equal(m.find((s) => s.hora === '09:30')!.libre, false);
  assert.equal(m.find((s) => s.hora === '14:30')!.libre, false);
  assert.equal(m.find((s) => s.hora === '12:00')!.libre, true);
});

test('un slot con instante ilegible se marca ocupado, nunca libre', () => {
  // Ante la duda, no se ofrece: ofrecerlo termina en un agendado que no se puede
  // resolver a un momento real.
  const m = marcarOcupados([{ hora: '09:00', inicioIso: 'nope', libre: true }], [], 45);
  assert.equal(m[0].libre, false);
});
