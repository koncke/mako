// =============================================================================
// El candado del análisis on-demand: qué se pinta y cuándo se puede reintentar
// =============================================================================
// El análisis de una llamada corre en background y le paga a Claude por
// grabación. La fila de `closing_jobs` hace dos cosas a la vez —dice en qué anda
// y evita la corrida doble—, y las dos formas de romperla son simétricas:
// arrancar de más (se paga dos veces) o no dejar arrancar nunca (la pantalla
// queda en «Revisando» para siempre sobre un trabajo muerto).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoAPintar, puedeArrancar, resumenDeCorrida, VENCE_MS, type Corrida, type FilaJob } from '../lib/closing-job-estado';

const AHORA = Date.parse('2026-08-13T12:00:00Z');
const haceMin = (m: number) => new Date(AHORA - m * 60_000).toISOString();

const F = (p: Partial<FilaJob>): FilaJob =>
  ({ estado: 'corriendo', detalle: null, started_at: haceMin(1), finished_at: null, ...p });

test('sin fila: no hay nada que pintar y se puede arrancar', () => {
  assert.equal(estadoAPintar(null, AHORA), null);
  assert.equal(puedeArrancar(null, AHORA), true);
});

test('mientras corre de verdad, se pinta corriendo y NO se arranca otra', () => {
  const viva = F({ started_at: haceMin(2) });
  assert.equal(estadoAPintar(viva, AHORA)?.estado, 'corriendo');
  assert.equal(puedeArrancar(viva, AHORA), false, 'una segunda corrida paga dos veces la misma grabación');
});

test('UN CORRIENDO VENCIDO no deja la pantalla trabada: se pinta error y se puede reintentar', () => {
  // El caso que importa: la función se cayó (timeout, deploy en el medio) y nadie
  // cerró la fila. Sin vencimiento, el botón no vuelve nunca.
  const muerta = F({ started_at: new Date(AHORA - VENCE_MS - 1000).toISOString() });
  const pintado = estadoAPintar(muerta, AHORA);
  assert.equal(pintado?.estado, 'error');
  assert.match(pintado?.detalle ?? '', /se cortó/i, 'tiene que decir qué pasó, no quedarse mudo');
  assert.equal(puedeArrancar(muerta, AHORA), true);
});

test('el límite es el vencimiento, no un ratito antes', () => {
  const justoAntes = F({ started_at: new Date(AHORA - VENCE_MS + 1000).toISOString() });
  assert.equal(puedeArrancar(justoAntes, AHORA), false);
  assert.equal(estadoAPintar(justoAntes, AHORA)?.estado, 'corriendo');
});

test('terminado (listo o error) se pinta con su detalle y habilita otra corrida', () => {
  const listo = F({ estado: 'listo', detalle: '1 llamada analizada', started_at: haceMin(30), finished_at: haceMin(28) });
  assert.deepEqual(
    estadoAPintar(listo, AHORA),
    { estado: 'listo', detalle: '1 llamada analizada', startedAt: listo.started_at, finishedAt: listo.finished_at },
  );
  assert.equal(puedeArrancar(listo, AHORA), true, 'un listo viejo no puede bloquear un re-análisis');

  const err = F({ estado: 'error', detalle: 'No encontré esa llamada en Fathom.', started_at: haceMin(30), finished_at: haceMin(29) });
  assert.equal(estadoAPintar(err, AHORA)?.estado, 'error');
  assert.equal(puedeArrancar(err, AHORA), true);
});

test('un estado que no conocemos NO se pinta como corriendo', () => {
  // Si mañana alguien mete un valor nuevo en la columna, el default seguro es
  // «error» (que ofrece el botón), nunca «corriendo» (que traba la pantalla).
  const raro = F({ estado: 'pendiente', detalle: null });
  assert.equal(estadoAPintar(raro, AHORA)?.estado, 'error');
  assert.equal(puedeArrancar(raro, AHORA), true);
});

// ── Cómo se cuenta el desenlace ──────────────────────────────────────────────

const C = (p: Partial<Corrida>): Corrida =>
  ({ encontradas: 0, analizadas: 0, relinkeadas: 0, yaEstaban: 0, fallidas: 0, error: null, ...p });

test('EL CASO: encontró la grabación pero no pudo analizarla → NO se dice "no la encontré"', () => {
  // Pasó de verdad el 13/08 con el lead 1696: la llamada estaba en Fathom con sus
  // 540 turnos y lo que faltaba era saldo en la API de Anthropic. Con el mensaje
  // viejo, la pantalla mandaba a revisar el link de Fathom — el lugar equivocado.
  const r = resumenDeCorrida(C({
    encontradas: 1, fallidas: 1,
    error: 'Your credit balance is too low to access the Anthropic API.',
  }));
  assert.equal(r.estado, 'error');
  assert.match(r.detalle, /Encontré la grabación/);
  assert.match(r.detalle, /credit balance/, 'el error del proveedor va TEXTUAL: es lo único que dice qué hacer');
  assert.doesNotMatch(r.detalle, /No encontré/);
});

test('no encontrar nada y fallar analizando son mensajes DISTINTOS', () => {
  const vacia = resumenDeCorrida(C({ encontradas: 0 }));
  assert.equal(vacia.estado, 'error');
  assert.match(vacia.detalle, /No encontré esa llamada en Fathom/);
  // Los cuatro contadores en cero se ven iguales en los dos casos: lo que los
  // separa es `fallidas`. Si alguien lo saca, este test cae.
  assert.notEqual(vacia.detalle, resumenDeCorrida(C({ encontradas: 1, fallidas: 1 })).detalle);
});

test('una corrida con resultado se cuenta en singular y en plural', () => {
  assert.deepEqual(resumenDeCorrida(C({ encontradas: 1, analizadas: 1 })), { estado: 'listo', detalle: '1 llamada analizada' });
  assert.deepEqual(resumenDeCorrida(C({ encontradas: 3, analizadas: 3 })), { estado: 'listo', detalle: '3 llamadas analizadas' });
  // Un fallo no tapa lo que SÍ salió: 2 analizadas y 1 caída sigue siendo un éxito.
  const mixto = resumenDeCorrida(C({ encontradas: 3, analizadas: 2, fallidas: 1, error: 'timeout' }));
  assert.equal(mixto.estado, 'listo');
  assert.match(mixto.detalle, /2 llamadas analizadas/);
});

test('re-enganchar una llamada ya analizada también es un desenlace bueno', () => {
  const r = resumenDeCorrida(C({ encontradas: 1, relinkeadas: 1 }));
  assert.equal(r.estado, 'listo');
  assert.match(r.detalle, /enganchadas a este lead/);
});

test('una fecha ilegible no traba la pantalla', () => {
  // Date.parse de basura da NaN, y toda comparación con NaN es false: sin este
  // caso cubierto, una fila corrupta se leería como "corriendo para siempre".
  const rota = F({ started_at: 'no-es-una-fecha' });
  assert.equal(estadoAPintar(rota, AHORA)?.estado, 'corriendo');
  assert.equal(puedeArrancar(rota, AHORA), false);
});
