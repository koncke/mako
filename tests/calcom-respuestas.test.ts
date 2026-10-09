// =============================================================================
// Cal.com — las respuestas del formulario y el aviso «Nuevo agendado»
// =============================================================================
// Código Inmobiliario (ws13) agenda por Cal.com y pidió (su automatización vacía «Nueva Agenda
// VSL» del 30/09 y su documento de deadlines) «un único WhatsApp al inmobiliario con nombre,
// teléfono y resumen de lo completado en el formulario». Ya les llegaba uno, «Nuevo agendado»,
// SIN teléfono y SIN respuestas: `normalizarReserva` las tiraba. Se enriquece ese aviso (no se crea
// otro: serían dos WhatsApp por agenda) y las respuestas se guardan en `lead_respuestas` como las
// de Calendly.
//
// DE DÓNDE SALE LA FORMA DEL PAYLOAD (medido el 08/10/2026, no inventado):
//  - en la base NO hay ningún payload de Cal.com guardado (las columnas `payload`/`raw`/`body` de
//    `public` son de otras cosas, y `app_settings` no tiene ninguno): por eso se arma acá;
//  - los CAMPOS son los del formulario real de ws13, leídos de la API pública
//    (`GET api.cal.com/v2/event-types?username=codigo-inmobiliario&eventSlug=auditoria`): name,
//    email, attendeePhoneNumber, location, instagram (text), agente-inmo / cierres /
//    comprometo-horario (multiselect Si/No) y `-Hace-cu-nto-que-formas-parte-del-rubro-inmobiliario`
//    (select), con sus rótulos textuales;
//  - el SOBRE de cada campo es el que arma Cal.com para el webhook (`getCalEventResponses`):
//    `{ label, value, isHidden }`, con `responses` = todos los campos y `userFieldsResponses` =
//    sólo los que agregó el dueño; los de sistema traen una clave de traducción como rótulo
//    («additional_notes») y un multiselect llega como lista.
//  Los nombres, emails y teléfonos son de mentira (un ejemplo nunca lleva datos de un lead real).
//
// Probado ROMPIENDO lo que persigue (08/10/2026), el resultado en cada test.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizarReserva,
  preguntasDeReserva,
  textoNuevoAgendado,
  detalleDelAviso,
  rotuloCorto,
  TOPE_AVISO,
  type CalcomReservaPayload,
} from '../lib/calcom';

const ROT = {
  agente: 'Actualmente soy agente o tengo una inmobiliaria en funcionamiento',
  cierres: 'Cuento con propiedades en cartera, cierres en curso y mi prioridad es aumentar las captaciones/ventas en los proximos 30 dias',
  horario: 'Valoramos mucho nuestro tiempo tanto como el suyo, si selecciona un dia y horario asegurese de poder asistir a la reunion y estar dispuesto a compartir informacion precisa sobre su negocio para que el analisis sea lo mas completo posible',
  rubro: '¿Hace cuánto que formas parte del rubro inmobiliario?',
};
const CLAVE_RUBRO = '-Hace-cu-nto-que-formas-parte-del-rubro-inmobiliario';

const CAMPOS_DEL_DUENO = {
  instagram: { label: 'Tu Instagram', value: '@lucia.prueba', isHidden: false },
  'agente-inmo': { label: ROT.agente, value: ['Si'], isHidden: false },
  cierres: { label: ROT.cierres, value: ['Si'], isHidden: false },
  'comprometo-horario': { label: ROT.horario, value: ['Si, me comprometo a asistir a la reunion'], isHidden: false },
  [CLAVE_RUBRO]: { label: ROT.rubro, value: '3 a 6 años', isHidden: false },
};

/** Un BOOKING_CREATED del formulario de ws13, en la forma que Cal.com lo manda al webhook. */
const PAYLOAD: { triggerEvent: string; createdAt: string; payload: CalcomReservaPayload & Record<string, unknown> } = {
  triggerEvent: 'BOOKING_CREATED',
  createdAt: '2026-10-08T18:50:12.000Z',
  payload: {
    type: 'auditoria',
    title: 'Auditoria personalizada entre Inmobiliaria Ejemplo y Lucía Prueba',
    description: '',
    additionalNotes: '',
    customInputs: {},
    startTime: '2026-10-13T13:15:00Z',
    endTime: '2026-10-13T14:00:00Z',
    organizer: { name: 'Inmobiliaria Ejemplo', email: 'equipo@inmobiliaria-ejemplo.test', timeZone: 'America/Argentina/Buenos_Aires' },
    responses: {
      name: { label: 'Tu nombre', value: 'Lucía Prueba', isHidden: false },
      email: { label: 'Tu email', value: 'Lucia.Prueba@ejemplo.test', isHidden: false },
      attendeePhoneNumber: { label: 'Numero de telefono', value: '+5491100001111', isHidden: false },
      location: { label: 'location', value: { optionValue: '', value: 'integrations:google:meet' }, isHidden: false },
      ...CAMPOS_DEL_DUENO,
      notes: { label: 'additional_notes', isHidden: false },
      guests: { label: 'additional_guests', value: [], isHidden: false },
      rescheduleReason: { label: 'reason_for_reschedule', isHidden: true },
    },
    userFieldsResponses: { ...CAMPOS_DEL_DUENO },
    attendees: [{ name: 'Lucía Prueba', email: 'Lucia.Prueba@ejemplo.test', timeZone: 'America/Argentina/Buenos_Aires', phoneNumber: '+5491100001111' }],
    location: 'integrations:google:meet',
    eventTypeId: 3383056,
    uid: 'bk_lucia_1',
    bookingId: 12345678,
    metadata: { videoCallUrl: 'https://meet.google.com/abc-defg-hij' },
    status: 'ACCEPTED',
  },
};

const sinCR = (s: string) => s.replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '') // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después

// ── Las respuestas ──────────────────────────────────────────────────────────

test('las respuestas del formulario de ws13 salen todas, en su orden y con su rótulo', () => {
  // Rotura: con `respuestas: []` en vez de `respuestasDe(...)` en normalizarReserva → este test
  // y 9 más fallan (10 de los 18 de este archivo), y el aviso sale sin un solo renglón de formulario.
  const r = normalizarReserva(PAYLOAD.payload)!;
  assert.deepEqual(r.respuestas.map((x) => x.clave), ['instagram', 'agente-inmo', 'cierres', 'comprometo-horario', CLAVE_RUBRO]);
  const rubro = r.respuestas.find((x) => x.clave === CLAVE_RUBRO)!;
  assert.equal(rubro.rotulo, ROT.rubro, 'el rótulo es el que escribió el dueño, entero: lo abrevia el aviso, no lo que se guarda');
  assert.equal(rubro.valor, '3 a 6 años');
  assert.equal(r.respuestas.find((x) => x.clave === 'agente-inmo')!.valor, 'Si', 'un multiselect llega como lista');
  assert.equal(r.respuestas.find((x) => x.clave === 'instagram')!.valor, '@lucia.prueba');
});

test('no se repite como respuesta lo que ya es un campo de la reserva, ni lo vacío ni lo oculto', () => {
  // Rotura: sacando 'attendeePhoneNumber' y 'location' de CAMPOS_DE_LA_RESERVA → falla este y 4
  // más (5 de 18): aparecen el teléfono como respuesta y «integrations:google:meet». El corte de
  // `oculta` lo cubre el test de los campos de sistema (sin él, 1 de 18: se cuela el motivo oculto).
  const r = normalizarReserva(PAYLOAD.payload)!;
  const claves = r.respuestas.map((x) => x.clave);
  for (const c of ['name', 'email', 'attendeePhoneNumber', 'location', 'notes', 'guests', 'rescheduleReason']) {
    assert.ok(!claves.includes(c), `«${c}» no es una respuesta`);
  }
  // Y los campos de la reserva siguen saliendo de donde salían.
  assert.equal(r.telefono, '+5491100001111');
  assert.equal(r.email, 'lucia.prueba@ejemplo.test');
  assert.equal(r.nombre, 'Lucía Prueba');
});

test('responses y userFieldsResponses traen los mismos campos: no se duplican', () => {
  // Rotura: sin el `vistas.has(clave)` → falla este y 3 más (4 de 18): 10 respuestas en vez de 5.
  assert.equal(normalizarReserva(PAYLOAD.payload)!.respuestas.length, 5);
});

test('una versión que manda sólo userFieldsResponses también las trae', () => {
  const { responses: _fuera, ...soloDelDueno } = PAYLOAD.payload;
  void _fuera;
  assert.deepEqual(normalizarReserva(soloDelDueno)!.respuestas.map((x) => x.valor), ['@lucia.prueba', 'Si', 'Si', 'Si, me comprometo a asistir a la reunion', '3 a 6 años']);
});

test('valores pelados (versión vieja, sin el sobre): el rótulo sale del nombre del campo', () => {
  const r = normalizarReserva({
    uid: 'bk_viejo',
    attendees: [{ name: 'Lucía Prueba', email: 'lucia@ejemplo.test' }],
    responses: { [CLAVE_RUBRO]: '+10 años', acepta_terminos: true, cuantas_captaciones: 4, nombre_partido: { firstName: 'Lucía', lastName: 'Prueba' } },
  })!;
  assert.deepEqual(r.respuestas, [
    { clave: CLAVE_RUBRO, rotulo: 'Hace cu nto que formas parte del rubro inmobiliario', valor: '+10 años' },
    { clave: 'acepta_terminos', rotulo: 'Acepta terminos', valor: 'Sí' },
    { clave: 'cuantas_captaciones', rotulo: 'Cuantas captaciones', valor: '4' },
    // Repite el nombre de la reserva: no es una respuesta nueva.
  ]);
});

test('los campos de sistema con contenido salen con un rótulo legible, no con la clave de traducción', () => {
  // Rotura: sin ROTULO_DE_SISTEMA → falla (1 de 18) con «Additional notes».
  const r = normalizarReserva({
    ...PAYLOAD.payload,
    responses: {
      notes: { label: 'additional_notes', value: 'Prefiero que me llamen por la tarde', isHidden: false },
      rescheduleReason: { label: 'reason_for_reschedule', value: 'Me surgió un viaje', isHidden: true },
    },
    userFieldsResponses: {},
  })!;
  assert.deepEqual(r.respuestas, [{ clave: 'notes', rotulo: 'Notas', valor: 'Prefiero que me llamen por la tarde' }]);
});

test('un campo propio que repite el teléfono (un «WhatsApp») no se repite como respuesta', () => {
  // Rotura: sin el corte de `repetidos` → falla este, el de los valores pelados y el del teléfono
  // con guiones (3 de 18): el número aparece dos veces en el aviso.
  const r = normalizarReserva({
    uid: 'bk_wa',
    attendees: [{ name: 'Lucía Prueba', email: 'lucia@ejemplo.test' }],
    responses: { whatsapp: { label: 'Tu WhatsApp', value: '+5491122223333' }, rubro: { label: 'Rubro', value: 'Inmobiliario' } },
  })!;
  assert.equal(r.telefono, '+5491122223333');
  assert.deepEqual(r.respuestas.map((x) => x.clave), ['rubro']);
});

test('el mismo teléfono tipeado con espacios y guiones en un campo propio tampoco se repite', () => {
  // El de sistema llega pelado (`attendees[0].phoneNumber`) y el campo propio como lo tipeó la
  // persona. Rotura (08/10/2026): volviendo a comparar tal cual (minúsculas, sin la huella, en los
  // dos lados) → falla este (1 de 18) con el número dos veces; los otros 17 siguen verdes.
  const r = normalizarReserva({
    uid: 'bk_wa2',
    attendees: [{ name: 'Lucía Prueba', email: 'lucia@ejemplo.test', phoneNumber: '+5491122223333' }],
    responses: { whatsapp: { label: 'Tu WhatsApp', value: '+54 9 11 2222-3333' }, rubro: { label: 'Rubro', value: 'Inmobiliario' } },
  })!;
  assert.equal(r.telefono, '+5491122223333');
  assert.deepEqual(r.respuestas.map((x) => x.clave), ['rubro']);
});

test('un payload raro no rompe: corre ANTES de la firma, sobre lo que mande cualquiera', () => {
  const raro = { uid: 'bk_raro', responses: 'no soy un objeto', userFieldsResponses: ['tampoco'] } as unknown as CalcomReservaPayload;
  assert.deepEqual(normalizarReserva(raro)!.respuestas, []);
  // Y el tope: 200 campos se guardan 30, con el valor cortado.
  const muchos: Record<string, unknown> = {};
  for (let i = 0; i < 200; i++) muchos[`campo-${i}`] = { label: `Pregunta ${i}`, value: 'x'.repeat(5000) };
  const r = normalizarReserva({ uid: 'bk_muchos', responses: muchos })!;
  assert.equal(r.respuestas.length, 30);
  assert.ok(r.respuestas.every((x) => x.valor.length <= 500));
});

test('se guardan con la forma de Calendly: la MISMA función escribe lead_respuestas', () => {
  // `saveLeadRespuestas` (lib/leads.ts) filtra por `question` y `answer` con texto: con otra
  // forma no guardaría nada y no daría error.
  const qa = preguntasDeReserva(normalizarReserva(PAYLOAD.payload)!.respuestas);
  assert.equal(qa.length, 5);
  assert.ok(qa.every((x) => x.question.trim() && x.answer.trim()));
  assert.deepEqual(qa[4], { question: ROT.rubro, answer: '3 a 6 años' });
});

// ── El aviso ────────────────────────────────────────────────────────────────

const AVISO = {
  nombre: 'Lucía Prueba',
  reunion: 'R1' as const,
  cuando: 'martes 13 a las 10:15',
  link: 'https://hola-mako.com/crm/9999/resumen?ws=13',
};

test('el aviso lleva el teléfono, el email y un renglón por respuesta, y el link al final', () => {
  // Rotura: armando el texto sin `detalleDelAviso` (el formato de antes) → falla este test y el de
  // la R2 (2 de 18). Con `rotuloCorto` sin el corte en la pausa o `cortar` sin cortar, también cae.
  const r = normalizarReserva(PAYLOAD.payload)!;
  const texto = textoNuevoAgendado({ ...AVISO, telefono: r.telefono, email: r.email, respuestas: r.respuestas });
  assert.equal(texto, [
    '🎯 *Nuevo agendado*: Lucía Prueba reservó una *R1 para el martes 13 a las 10:15*.',
    '📱 +5491100001111 · ✉️ lucia.prueba@ejemplo.test',
    '• Instagram: @lucia.prueba',
    '• Actualmente soy agente o tengo una…: Si',
    '• Cuento con propiedades en cartera: Si',
    '• Valoramos mucho nuestro tiempo tanto…: Si, me comprometo a asistir a la reunion',
    '• Hace cuánto que formas parte del rubro…: 3 a 6 años',
    '',
    '👉 Mira el resumen del lead:',
    'https://hola-mako.com/crm/9999/resumen?ws=13',
    '',
    '— MaKo',
  ].join('\n'));
});

test('sin teléfono, sin email y sin formulario, el aviso es el de siempre', () => {
  // Lo que una reserva sin nada que agregar mandaba antes, carácter por carácter.
  assert.equal(
    textoNuevoAgendado({ ...AVISO, telefono: null, email: null, respuestas: [] }),
    '🎯 *Nuevo agendado*: Lucía Prueba reservó una *R1 para el martes 13 a las 10:15*.\n\n👉 Mira el resumen del lead:\nhttps://hola-mako.com/crm/9999/resumen?ws=13\n\n— MaKo',
  );
  // Y con uno solo de los dos, no queda un separador colgando.
  assert.deepEqual(detalleDelAviso({ telefono: null, email: 'a@b.test', respuestas: [] }), ['✉️ a@b.test']);
});

test('el tope: más de seis respuestas se resumen y un valor largo se corta', () => {
  // Rotura: con `TOPE_AVISO.respuestas` en 99 → falla (1 de 18: salen 9 renglones y no «+3»). Con
  // `cortar` devolviendo el texto entero → falla este y 2 más (3 de 18): el valor de 319 caracteres
  // sale entero.
  const respuestas = Array.from({ length: 9 }, (_, i) => ({ clave: `c${i}`, rotulo: `Pregunta número ${i}`, valor: i === 0 ? 'palabra '.repeat(40).trim() : 'Si' }));
  const lineas = detalleDelAviso({ telefono: null, email: null, respuestas });
  assert.equal(lineas.length, TOPE_AVISO.respuestas + 1);
  assert.equal(lineas[lineas.length - 1], '• +3 en el resumen');
  assert.ok(lineas[0].endsWith('…'), 'el valor largo se corta y lo dice');
  assert.ok(lineas.every((l) => l.length <= 4 + TOPE_AVISO.rotulo + 2 + TOPE_AVISO.valor), `un renglón se pasó: ${lineas.map((l) => l.length)}`);
});

test('el rótulo se abrevia hasta la primera pausa, sin el «Tu» y con tope', () => {
  // Rotura: sin el corte en la pausa → falla este y el del aviso entero (2 de 18): «Cuento con
  // propiedades en cartera, cierres…» sale cortado por largo y no en la coma.
  assert.equal(rotuloCorto('Tu Instagram'), 'Instagram');
  assert.equal(rotuloCorto(ROT.cierres), 'Cuento con propiedades en cartera');
  assert.equal(rotuloCorto(ROT.rubro), 'Hace cuánto que formas parte del rubro…');
  assert.ok(rotuloCorto(ROT.horario).length <= TOPE_AVISO.rotulo);
  assert.equal(rotuloCorto('¿?'), 'Respuesta', 'un rótulo que queda vacío no deja «: valor» suelto');
});

test('la R2 sale por la MISMA función', () => {
  const texto = textoNuevoAgendado({ ...AVISO, reunion: 'R2', telefono: '+5491100001111', email: null, respuestas: [] });
  assert.match(texto, /^🎯 \*Nuevo agendado\*: Lucía Prueba reservó una \*R2 para el martes 13 a las 10:15\*\.\n📱 \+5491100001111\n\n👉/);
});

// ── El cableado del webhook ─────────────────────────────────────────────────

const RUTA = sinComentarios(sinCR(readFileSync(new URL('../app/api/webhooks/calcom/route.ts', import.meta.url), 'utf8')));

test('CABLEADO: los DOS avisos «Nuevo agendado» arman el texto con textoNuevoAgendado', () => {
  // Rotura: devolviendo el template literal viejo en la R2 → falla (1 de 18), que es exactamente
  // el caso del emisor que se queda sin el teléfono.
  const emisores = RUTA.match(/emitirDelCatalogo\('reunion-nuevo-agendado', \{[\s\S]*?\n\s*\}\);/g) ?? [];
  assert.equal(emisores.length, 2);
  for (const e of emisores) {
    assert.match(e, /texto: textoNuevoAgendado\(\{/);
    assert.match(e, /respuestas: reserva\.respuestas/);
    assert.match(e, /telefono: reserva\.telefono \?\? lead\.telefono/);
  }
  assert.doesNotMatch(RUTA, /texto: `🎯/, 'quedó un aviso armado a mano');
});

test('CABLEADO: las respuestas se guardan en las dos reuniones con saveLeadRespuestas', () => {
  // Rotura: borrando la llamada de la R1 → falla (1 de 18).
  assert.match(RUTA, /saveLeadRespuestas\(lead\.id, 'R1', preguntasDeReserva\(reserva\.respuestas\), fechaReunion\);/);
  assert.match(RUTA, /saveLeadRespuestas\(lead\.id, 'R2', preguntasDeReserva\(reserva\.respuestas\), fechaReunion\);/);
});

test('CABLEADO: la agenda R1 inscribe por evento, como Calendly, después de crear el lead', () => {
  // Rotura: borrando `enrolarPorEvento` → falla (1 de 18); moviéndolo antes del upsert → falla el
  // orden (1 de 18).
  const llamadas = RUTA.match(/await enrolarPorEvento\(lead\.id, 'agenda_nueva'\);/g) ?? [];
  assert.equal(llamadas.length, 1, 'una sola vez, en la R1 (Calendly tampoco inscribe por una R2)');
  const iUpsert = RUTA.indexOf('await upsertLeadFromCalendly(');
  const iEnrolar = RUTA.indexOf("await enrolarPorEvento(lead.id, 'agenda_nueva');");
  assert.ok(iUpsert > 0 && iEnrolar > iUpsert, 'se inscribe al lead que acaba de quedar creado');
  // Y no en la cancelación ni en la R2.
  const iCancela = RUTA.indexOf("if (accion === 'cancela')");
  const iR2 = RUTA.indexOf("if (tipo === 'j2')");
  assert.ok(iEnrolar > iCancela && iEnrolar > iR2);
});
