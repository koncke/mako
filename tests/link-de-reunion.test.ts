// =============================================================================
// link-de-reunion — los dos caminos que NO guardaban el link para entrar a la reunión
// =============================================================================
// El recordatorio al lead (lib/reunion-recordatorio.ts) manda el link de `junta_X_url` (mig
// 0204). Lo escribía sólo el webhook EN VIVO de Calendly. Quedaba afuera
// app/api/webhooks/calcom/route.ts: Cal.com no lo guardaba NUNCA, así que Código Inmobiliario
// (usa Cal.com) recibiría el recordatorio sin el renglón del link. Cal.com no lo manda donde
// Calendly: `location` es el NOMBRE de la integración («integrations:google:meet») y el link
// viaja en `metadata.videoCallUrl` (`linkDeReunionCalcom`).
//
// ⚠️ El backfill de Calendly ya NO está acá (09/10/2026). Esta rama lo arreglaba con su propia
// regla (`linkACompletar`), y en main la sesión del CRM ya lo había arreglado con otra
// (`guardarLinkDelEvento`, en el mismo script). Se quedó la de main, con sus tests.
//
// Los cuerpos de Cal.com son los ejemplos de la doc de webhooks (payload 2021-10-20,
// cal.com/docs/developing/guides/automation/webhooks), recortados a lo que importa. El de Meet
// sigue la misma forma con el host de Google, que es lo que usa el ws13 (medido con GET
// /v2/bookings: sus 5 reservas próximas son Meet).
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que rompe, corre y restaura DE MEMORIA (nunca con
// git checkout), verificando que cada archivo volviera idéntico. Sin romper: 12 pass / 0 fail.
// Las 15 roturas cayeron, cada una en el test que la persigue (11 / 1 salvo donde se dice):
//   · `linkDeReunionCalcom` sin leer `metadata.videoCallUrl` → 10 / 2 (el Meet del ws13 y el
//     reagendado salían sin link).
//   · sin excluir Cal Video (`daily_video` / `*.daily.co`) del fallback a `videoCallData.url`.
//   · sin el filtro del mapa en `location`; sin el fallback a `location` (la ubicación «Link»).
//   · el webhook de Cal.com sin guardar el link de la R1; sin el de la R2; borrándolo al cancelar
//     sin `soloSiInicio`.
// Las roturas del backfill y de `linkACompletar` se fueron con su código (ver arriba).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkDeReunionCalcom } from '../lib/recordatorio-lead';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: un `/*` adentro de un `//`
// abre un bloque que se come el código).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El texto entre dos marcas, exigiendo que las dos estén y en orden. */
function entre(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

// ── Cal.com: de dónde sale el link ─────────────────────────────────────────────

/** BOOKING_CREATED de la doc (Cal Video): `location` es la integración, el link va en metadata. */
const CREADA_DOC = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2024-01-01T00:00:00.000Z',
  payload: {
    title: 'Strategy Session between Organizer and Guest',
    startTime: '2024-01-01T10:00:00Z',
    endTime: '2024-01-01T10:15:00Z',
    type: 'standard-event-type',
    eventTypeId: 123,
    attendees: [{ email: 'guest@example.com', name: 'Guest User', timeZone: 'UTC' }],
    responses: { location: { label: 'location', value: { optionValue: '', value: 'integrations:video-provider' }, isHidden: false } },
    location: 'integrations:video-provider',
    uid: 'unique-booking-id',
    conferenceData: { createRequest: { requestId: '00000000-0000-0000-0000-000000000000' } },
    videoCallData: { type: 'video_provider', id: 'meeting-room-id', password: 'redacted_token', url: 'https://video.example.com/meeting-room-id' },
    bookingId: 100,
    metadata: { videoCallUrl: 'https://app.example.com/video/unique-booking-id' },
    status: 'ACCEPTED',
  },
};

/** BOOKING_RESCHEDULED de la doc: la reserva NUEVA, con su propio link. */
const REAGENDADA_DOC = {
  triggerEvent: 'BOOKING_RESCHEDULED',
  payload: {
    startTime: '2024-01-10T14:30:00Z',
    location: 'integrations:video-provider',
    uid: 'new-booking-unique-id',
    rescheduleUid: 'previous-booking-unique-id',
    rescheduleStartTime: '2024-01-05T14:30:00Z',
    videoCallData: { type: 'video_provider', id: 'meeting-room-id', password: 'redacted_jwt_token', url: 'https://video.example.com/meeting-room-id' },
    metadata: { videoCallUrl: 'https://app.example.com/video/new-booking-unique-id' },
    status: 'ACCEPTED',
  },
};

/** BOOKING_CANCELLED de la doc: no trae metadata ni videoCallData. */
const CANCELADA_DOC = {
  triggerEvent: 'BOOKING_CANCELLED',
  payload: {
    startTime: '2024-01-04T10:00:00+00:00',
    uid: 'unique-booking-identifier',
    location: 'integrations:video-provider',
    cancellationReason: 'I am no longer able to attend this session.',
    status: 'CANCELLED',
  },
};

const MEET = 'https://meet.google.com/abc-defg-hij';

test('Cal.com: el link sale de metadata.videoCallUrl, y le gana a videoCallData', () => {
  assert.equal(linkDeReunionCalcom(CREADA_DOC.payload), 'https://app.example.com/video/unique-booking-id');
  // Lo que usa el ws13: Google Meet. `location` dice la integración, el Meet viaja en metadata.
  assert.equal(linkDeReunionCalcom({ location: 'integrations:google:meet', metadata: { videoCallUrl: MEET } }), MEET);
});

test('Cal.com: la reagenda trae el link de la reserva NUEVA; la cancelación no trae ninguno', () => {
  assert.equal(linkDeReunionCalcom(REAGENDADA_DOC.payload), 'https://app.example.com/video/new-booking-unique-id');
  assert.equal(linkDeReunionCalcom(CANCELADA_DOC.payload), null);
});

test('Cal.com: sin metadata, videoCallData.url sirve — salvo el cuarto crudo de Cal Video', () => {
  const zoom = 'https://us02web.zoom.us/j/123456789?pwd=abc';
  assert.equal(linkDeReunionCalcom({ location: 'integrations:zoom', videoCallData: { type: 'zoom_video', url: zoom } }), zoom);
  // El de Daily pide un token para entrar: el link público es app.cal.com/video/<uid>, en metadata.
  assert.equal(linkDeReunionCalcom({ location: 'integrations:daily', videoCallData: { type: 'daily_video', url: 'https://cal.daily.co/abc123' } }), null);
  assert.equal(linkDeReunionCalcom({ location: 'integrations:daily', videoCallData: { type: 'video_provider', url: 'https://cal.daily.co/abc123' } }), null);
});

test('Cal.com: una ubicación que no es un link para entrar NO es un link', () => {
  // La ubicación «Link» fija del event type: ésa sí.
  assert.equal(linkDeReunionCalcom({ location: 'https://zoom.us/j/987654321' }), 'https://zoom.us/j/987654321');
  // Una integración sin URL, una presencial, un teléfono, un mapa.
  assert.equal(linkDeReunionCalcom({ location: 'integrations:google:meet' }), null);
  assert.equal(linkDeReunionCalcom({ location: 'Av. Reforma 222, Juárez, CDMX' }), null);
  assert.equal(linkDeReunionCalcom({ location: '+52 55 1234 5678' }), null);
  assert.equal(linkDeReunionCalcom({ location: 'https://maps.app.goo.gl/AbCdEf123' }), null);
  assert.equal(linkDeReunionCalcom({ location: 'https://www.google.com/maps/place/Reforma+222' }), null);
});

test('Cal.com: sólo https, y nada que no sea un objeto', () => {
  assert.equal(linkDeReunionCalcom({ metadata: { videoCallUrl: 'http://meet.google.com/x' } }), null);
  assert.equal(linkDeReunionCalcom({ metadata: { videoCallUrl: 'javascript:alert(1)' } }), null);
  assert.equal(linkDeReunionCalcom(undefined), null);
  assert.equal(linkDeReunionCalcom('https://meet.google.com/x'), null);
});

// ── El cableado ───────────────────────────────────────────────────────────────

const CALCOM = sinComentarios(leer('app/api/webhooks/calcom/route.ts'));

test('CABLEADO: Cal.com guarda el link de la R1 y de la R2, del payload y con su extractor', () => {
  const r2 = entre(CALCOM, "if (tipo === 'j2') {", 'return Response.json({ ok: true, trigger: body.triggerEvent, tipo: \'j2\', action: \'set_j2\'');
  // Entre las dos va `saveLeadRespuestas` (lo que completó en el formulario de la R2).
  assert.match(r2, /await setFechaJunta2\(lead\.id, fechaReunion, reserva\.inicio(, 'Cal\.com')?\);[\s\S]*?await guardarLinkDeReunion\(lead\.id, 'R2', linkDeReunionCalcom\(body\.payload\)\);/);
  const r1 = entre(CALCOM, 'const { lead, created } = await upsertLeadFromCalendly({', "await emitirDelCatalogo('reunion-nuevo-agendado'");
  assert.match(r1, /await guardarLinkDeReunion\(lead\.id, 'R1', linkDeReunionCalcom\(body\.payload\)\);/);
  // El de Calendly lee `location.join_url`, que Cal.com no tiene: daría null siempre.
  assert.doesNotMatch(CALCOM, /linkDeReunion\(/);
});

test('CABLEADO: la cancelación de Cal.com borra el link sólo si la fila sigue en ese horario', () => {
  const cancela = entre(CALCOM, "if (accion === 'cancela') {", 'const fechaReunion = isoToFechaTijuana(reserva.inicio);');
  assert.match(cancela, /const cualLink = juntaQueSeCancela\(lead, reserva\.inicio\);\s*if \(cualLink\) await guardarLinkDeReunion\(lead\.id, cualLink, null, \{ soloSiInicio: reserva\.inicio \}\);/,
    'sin soloSiInicio, una reagenda cuya reserva nueva llegó primero pierde el link nuevo');
});
