// =============================================================================
// La agenda embebida: el ÚNICO camino que tiene una reserva para llegar a MaKo
// =============================================================================
// Cuando el CTA de una landing es una agenda embebida, la reserva ocurre DENTRO de
// un iframe de otro dominio. El capturador de opt-in del snippet escucha `submit`
// sobre el documento del cliente, y ahí no hay ningún `<form>`: nunca se dispara.
// Lo único que cruza la frontera es el `postMessage` que el embed le manda al padre.
//
// El 24/08/2026 un cliente (ws13) se agendó en su propia landing y MaKo no registró
// nada: el handler entendía un solo proveedor de agendas y el otro moría en la
// primera línea del guard.
//
// Y al arreglarlo apareció el problema opuesto: ese embed manda DOS mensajes por la
// MISMA reserva (el evento viejo y el `...V2`), así que un filtro por `indexOf`
// contaba cada agenda dos veces. Estos tests corren el handler EMITIDO contra los
// dos payloads reales.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);

/** El snippet tal cual sale, con los escapes del template ya aplicados. */
function snippetEmitido(): string {
  const s = readFileSync(new URL('../lib/landing-token.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const desde = s.indexOf('return ' + BT + '<script>');
  const hasta = s.indexOf('</script>' + BT + ';', desde);
  const tpl = s.slice(desde + ('return ' + BT).length, hasta);
  const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', [BS]: BS, [BT]: BT, $: '$' };
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === BS && i + 1 < tpl.length) { out += mapa[tpl[i + 1]] ?? tpl[i + 1]; i++; }
    else out += tpl[i];
  }
  return out;
}

/**
 * Corre SOLO el handler de `message` del snippet, con `enviar` y `mandarOptin`
 * espiados.
 *
 * Se recorta el handler en vez de ejecutar el snippet entero porque el resto
 * necesita un DOM, cookies y un player de video: lo que estos tests cuidan es la
 * decisión de ese bloque, y esa se puede aislar. El recorte va por marcas del
 * propio código, así que si el handler se muda o se renombra, el test falla ruidoso
 * en vez de pasar sobre algo que ya no existe.
 */
function correrHandler(mensajes: unknown[]) {
  const gen = snippetEmitido();
  const desde = gen.indexOf('var AGENDADOS = {};');
  const marca = "window.addEventListener('pagehide', alSalir);";
  const hasta = gen.indexOf(marca, desde);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró el handler de la agenda en el snippet emitido');
  const cuerpo = gen.slice(desde, hasta);

  const eventos: Array<Record<string, unknown>> = [];
  const optins: Array<Record<string, unknown>> = [];
  const oyentes: Array<(ev: { data: unknown }) => void> = [];
  const ventana = { addEventListener: (t: string, fn: (ev: { data: unknown }) => void) => { if (t === 'message') oyentes.push(fn); } };

  new Function('window', 'enviar', 'mandarOptin', cuerpo)(
    ventana,
    (e: Record<string, unknown>) => { eventos.push(e); },
    (d: Record<string, unknown>) => { optins.push(d); },
  );
  assert.equal(oyentes.length, 1, 'el handler tiene que registrarse una sola vez');
  for (const data of mensajes) oyentes[0]({ data });
  return { eventos, optins };
}

// Los dos mensajes que ese embed manda por UNA reserva. El viejo es el único que
// trae los datos de quien reserva; el nuevo llega igual y describe lo mismo.
const RESERVA = { uid: 'bk_abc123', attendees: [{ name: 'Codigo Inmobiliario', email: 'codigoinmobiliarioia@gmail.com' }] };
const MSG_VIEJO = { originator: 'CAL', type: 'bookingSuccessful', data: { booking: RESERVA } };
const MSG_NUEVO = { originator: 'CAL', fullType: 'CAL:bookingSuccessfulV2', data: { booking: RESERVA } };

test('una reserva es UN evento, aunque el embed mande dos mensajes', () => {
  const { eventos } = correrHandler([MSG_VIEJO, MSG_NUEVO]);
  assert.equal(eventos.length, 1, 'contó la misma reserva dos veces: el CRM vería el doble de agendas que las que hubo');
  assert.equal(eventos[0].tipo_evento, 'agendo');
});

test('y llega el lead UNA vez, con el nombre y el mail de quien reservó', () => {
  const { optins } = correrHandler([MSG_VIEJO, MSG_NUEVO]);
  assert.equal(optins.length, 1, 'dos opt-ins por una reserva son dos leads para la misma persona');
  assert.equal(optins[0].email, 'codigoinmobiliarioia@gmail.com');
  assert.equal(optins[0].nombre, 'Codigo Inmobiliario');
  assert.equal(optins[0].origen, 'agenda', 'el origen distingue la agenda del formulario, y el server lo usa para el motivo del bloqueo');
});

test('el orden no importa: si llega primero el nuevo, tampoco se duplica', () => {
  const { eventos } = correrHandler([MSG_NUEVO, MSG_VIEJO]);
  assert.equal(eventos.length, 1);
});

test('dos reservas DISTINTAS sí son dos eventos', () => {
  // El dedupe es por reserva, no un «una sola vez por página»: alguien puede
  // agendar dos llamadas seguidas, y perder la segunda sería el error opuesto.
  const otra = { originator: 'CAL', type: 'bookingSuccessful', data: { booking: { uid: 'bk_zzz999', attendees: [{ email: 'otra@example.com' }] } } };
  const { eventos, optins } = correrHandler([MSG_VIEJO, otra]);
  assert.equal(eventos.length, 2);
  assert.equal(optins.length, 2);
});

test('no se cuenta lo que NO es una reserva confirmada', () => {
  // El embed avisa de todo el ciclo (abrió, eligió fecha…). Contar eso convertiría
  // «agendó» en «miró el calendario», que es justo la diferencia que importa.
  const { eventos } = correrHandler([
    { originator: 'CAL', type: 'linkReady' },
    { originator: 'CAL', type: '__routeChanged' },
    { originator: 'OTRO', type: 'bookingSuccessful', data: { booking: { uid: 'x' } } },
    'un string suelto',
    null,
  ]);
  assert.equal(eventos.length, 0);
});

test('el proveedor que YA andaba sigue andando', () => {
  const { eventos } = correrHandler([{ event: 'calendly.event_scheduled' }]);
  assert.equal(eventos.length, 1, 'no se puede perder el soporte que ya existía');
  assert.equal(eventos[0].detalle, 'calendly');
});

test('y su ciclo de vida no cuenta como reserva', () => {
  const { eventos } = correrHandler([{ event: 'calendly.date_and_time_selected' }, { event: 'calendly.profile_page_viewed' }]);
  assert.equal(eventos.length, 0);
});
