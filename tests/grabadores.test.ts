// =============================================================================
// Los grabadores de reuniones: una reunión, venga de donde venga (lib/grabadores, 26/10/2026)
// =============================================================================
// Pedido de Martín: «implementa otras integraciones de grabadores de reuniones, como Loom, etc... Así no solo se puede
// grabar con fathom. Y revisa el plan y otras cosas que solo consumen fathom, que puedan consumir todos los grabadores».
//
// Lo que fija este archivo:
//   1. FATHOM SIGUE IGUAL (deprecar no es romper): su clave es su recording_id, su ref «fathom:<n>», la transcripción en
//      texto sale idéntica a la de antes y la asistencia se decide igual que `inviteeSpoke`.
//   2. La clave de los demás grabadores: negativa, estable y distinta por grabador (las tablas siguen siendo bigint).
//   3. Cada forma, sobre el ejemplo de SU documentación (medido el 26/10/2026): tl;dv, Fireflies, Zoom (VTT) y Otter.
//   4. Las firmas de los avisos, con vectores calculados aparte (Python hmac), no con el mismo código.
//   5. Lo que no da un grabador se DICE: Loom sin API, Zoom sin correos de afuera.
//   6. Los cuatro registros de cada tarjeta, y que las claves de la tarjeta son las que lee su lector.
//
// Probado rompiéndolo (26/10/2026), una rotura por vez y restaurando: ver el pie del archivo.
// Correr: node --import tsx --test tests/grabadores.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  claveDeReunion, deFathom, emailsExternos, esClaveDeFathom, esRefDeReunion, externoPorCorreo, invitadoHablo, leerRef,
  refDeReunion, transcripcionATexto, transcripcionConSegundos, GRABADORES,
} from '../lib/grabadores/reunion';
import { deFireflies, deOtter, deTldv, deZoom, turnosDeTextoOtter, turnosDeTldv, turnosDeVtt } from '../lib/grabadores/formas';
import { CATALOGO_GRABADORES, grabadorDelLink } from '../lib/grabadores/catalogo';
import { firmaFirefliesValida, firmaZoom, firmaZoomValida, respuestaValidacionZoom } from '../lib/grabadores/firmas';
import { inviteeSpoke, type FathomWebhookPayload } from '../lib/fathom';
import { clasificarReunion } from '../lib/reunion-clasificar';
import { recordingDeRef, refDelResto, leerMarca } from '../lib/lectura-por-partes';
import { DEFS_TEST } from '../lib/integraciones-catalogo';
import type { FathomMeeting } from '../lib/fathom-api';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ── 1. Fathom sigue igual ─────────────────────────────────────────────────────────────────────────

const FATHOM: FathomMeeting = {
  recording_id: 195129619,
  title: 'Junta 1 con Ana',
  url: 'https://fathom.video/calls/871165870',
  share_url: 'https://fathom.video/share/abcDEF',
  recording_start_time: '2026-10-20T15:00:00Z',
  recording_end_time: '2026-10-20T15:47:00Z',
  created_at: '2026-10-20T15:50:00Z',
  calendar_invitees: [
    { name: 'Martín', email: 'martin@mako.test', is_external: false },
    { name: 'Ana Gómez', email: 'Ana@Cliente.test', is_external: true },
  ],
  recorded_by: { name: 'Martín', email: 'martin@mako.test' },
  transcript: [
    { speaker: { display_name: 'Martín', matched_calendar_invitee_email: 'martin@mako.test' }, text: 'Hola Ana, ¿cómo estás?', timestamp: '00:00:05' },
    { speaker: { display_name: 'Ana Gómez', matched_calendar_invitee_email: 'ana@cliente.test' }, text: 'Bien, con ganas de arrancar.', timestamp: '00:01:23' },
    { speaker: { display_name: 'Martín', matched_calendar_invitee_email: null }, text: '  ', timestamp: '00:02:00' },
  ],
  default_summary: { markdown_formatted: '## Resumen\n- Arrancan el lunes' },
  action_items: [{ description: 'Mandar la propuesta', assignee: { name: 'Martín', email: 'martin@mako.test' } }],
};

test('Fathom: la clave ES su recording_id y la ref es la de siempre (ninguna marca vieja cambia de nombre)', () => {
  const r = deFathom(FATHOM);
  assert.equal(r.clave, 195129619);
  assert.equal(refDeReunion(r), 'fathom:195129619');
  assert.equal(esClaveDeFathom(r.clave), true);
  assert.deepEqual(leerRef('fathom:195129619'), { grabador: 'fathom', id: '195129619' });
  assert.equal(recordingDeRef('fathom:195129619:partes-3-4'), 195129619, 'el borrador que completa sigue siendo de la misma reunión');
  assert.equal(refDelResto(950, [3, 2]), 'fathom:950:partes-3-4', 'un número suelto sigue siendo de Fathom');
});

test('Fathom: la transcripción en texto sale IDÉNTICA a la de antes (la leen el Plan y su juez)', () => {
  const r = deFathom(FATHOM);
  // Lo que devolvía `transcriptToText` (lib/fathom-api.ts) para este mismo transcript: «[HH:MM:SS] Hablante: texto».
  assert.equal(transcripcionATexto(r.transcripcion), '[00:00:05] Martín: Hola Ana, ¿cómo estás?\n[00:01:23] Ana Gómez: Bien, con ganas de arrancar.');
  // Y la del Closing (`transcriptWithSeconds`): «[123s · 2:03] Hablante: texto».
  assert.equal(transcripcionConSegundos(r.transcripcion), '[5s · 0:05] Martín: Hola Ana, ¿cómo estás?\n[83s · 1:23] Ana Gómez: Bien, con ganas de arrancar.');
  assert.equal(r.resumen, '## Resumen\n- Arrancan el lunes');
  assert.deepEqual(r.acciones, [{ descripcion: 'Mandar la propuesta', responsable: { nombre: 'Martín', email: 'martin@mako.test' } }]);
  assert.deepEqual(emailsExternos(r), ['ana@cliente.test']);
});

test('Fathom: la asistencia se decide EXACTAMENTE como `inviteeSpoke` (la R1 de 64 minutos no vuelve a No Show)', () => {
  const casos: Array<[string, Partial<FathomWebhookPayload>, string]> = [
    ['habló con su correo', FATHOM as unknown as FathomWebhookPayload, 'ana@cliente.test'],
    ['casilla genérica: nadie matchea → no se sabe', { ...FATHOM, transcript: [{ speaker: { matched_calendar_invitee_email: null } }] } as unknown as FathomWebhookPayload, 'contacto@prosesamed.com'],
    ['sólo habló gente de casa → no vino', { ...FATHOM, transcript: [{ speaker: { matched_calendar_invitee_email: 'martin@mako.test' } }] } as unknown as FathomWebhookPayload, 'ana@cliente.test'],
    ['sin transcript → no se sabe', { ...FATHOM, transcript: [] } as unknown as FathomWebhookPayload, 'ana@cliente.test'],
    // Un Meet sin evento de calendario: el anfitrión NO está entre los invitados, y que sólo hable él prueba la ausencia.
    ['sólo habló quien grabó, que no figura como invitado → no vino', { ...FATHOM, calendar_invitees: [{ name: 'Ana', email: 'ana@cliente.test', is_external: true }], transcript: [{ speaker: { matched_calendar_invitee_email: 'martin@mako.test' } }] } as unknown as FathomWebhookPayload, 'ana@cliente.test'],
  ];
  for (const [nombre, p, email] of casos) {
    assert.equal(invitadoHablo(deFathom(p as FathomMeeting), email), inviteeSpoke(p as FathomWebhookPayload, email), nombre);
  }
});

// ── 2. La clave de los demás ──────────────────────────────────────────────────────────────────────

test('la clave de otro grabador es NEGATIVA, estable y distinta por grabador (nunca choca con una de Fathom)', () => {
  const a = claveDeReunion('tldv', '6530a1b2c3d4e5f6a7b8c9d0');
  assert.ok(a < 0 && Number.isSafeInteger(a), `clave ${a}`);
  assert.equal(claveDeReunion('tldv', '6530a1b2c3d4e5f6a7b8c9d0'), a, 'la misma reunión, la misma clave');
  assert.notEqual(claveDeReunion('fireflies', '6530a1b2c3d4e5f6a7b8c9d0'), a, 'el mismo id en otro grabador es otra reunión');
  assert.notEqual(claveDeReunion('tldv', '6530a1b2c3d4e5f6a7b8c9d1'), a);
  // Mil ids parecidos no chocan entre sí.
  const vistas = new Set<number>();
  for (let i = 0; i < 1000; i++) vistas.add(claveDeReunion('fireflies', `01HX${String(i).padStart(6, '0')}`));
  assert.equal(vistas.size, 1000);
  assert.equal(recordingDeRef('loom:abc'), claveDeReunion('loom', 'abc'));
  assert.equal(esRefDeReunion('archivo:12'), false, 'un archivo no es una reunión');
  assert.equal(leerRef('fathom:-3'), null, 'una clave negativa no es un recording_id de Fathom');
  assert.equal(leerMarca(JSON.stringify({ partes: 2, leidas: [0], refs: ['tldv:x', 'otra'], ts: '' }))?.refs.join(','), 'tldv:x');
});

// ── 3. Cada forma, sobre el ejemplo de su documentación ──────────────────────────────────────────

test('tl;dv: el ejemplo de MeetingReady de su doc, en la forma común (duración en segundos, externo inferido)', () => {
  const r = deTldv({
    id: 'meeting-123', name: 'Team Standup Meeting', happenedAt: '2024-01-15T10:00:00Z',
    organizer: { name: 'John Doe', email: 'john@example.com' },
    invitees: [{ name: 'Jane Smith', email: 'jane@example.com' }, { name: 'Prospecto', email: 'pro@otra.test' }],
    url: 'https://app.tldv.io/meetings/meeting-123', duration: 1800,
  });
  assert.equal(r.clave, claveDeReunion('tldv', 'meeting-123'));
  assert.equal(r.fin, '2024-01-15T10:30:00.000Z');
  assert.deepEqual(emailsExternos(r), ['pro@otra.test'], 'el del mismo dominio es de la casa; el de otro, de afuera');
  assert.deepEqual(turnosDeTldv({ data: [{ speaker: 'John Doe', text: 'Hello everyone', startTime: 0, endTime: 5 }] }),
    [{ hablante: 'John Doe', email: null, texto: 'Hello everyone', segundo: 0 }]);
});

test('Fireflies: fecha en ms, duración en MINUTOS, el equipo (`workspace_users`) es de la casa', () => {
  const r = deFireflies({
    id: 'ASxwZxCstx', title: 'Discovery', date: Date.parse('2026-10-20T15:00:00Z'), duration: 45,
    organizer_email: 'ana@gmail.com', participants: ['ana@gmail.com', 'socio@gmail.com, cliente@empresa.test'],
    workspace_users: ['socio@gmail.com'], transcript_url: 'https://app.fireflies.ai/view/ASxwZxCstx',
    sentences: [{ text: 'Arrancamos', speaker_name: 'Ana', start_time: '12.5' }],
    summary: { overview: 'Hablaron del plan', short_summary: null, action_items: '- Mandar la propuesta\n- Agendar R2' },
  });
  assert.equal(r.fin, '2026-10-20T15:45:00.000Z');
  // Quien graba usa un gmail: un gmail no dice de qué empresa es nadie, así que el resto es de afuera… salvo su equipo.
  assert.deepEqual(emailsExternos(r), ['cliente@empresa.test']);
  assert.deepEqual(r.transcripcion, [{ hablante: 'Ana', email: null, texto: 'Arrancamos', segundo: 12.5 }]);
  assert.equal(r.resumen, 'Hablaron del plan');
  assert.deepEqual(r.acciones?.map((a) => a.descripcion), ['Mandar la propuesta', 'Agendar R2']);
});

test('Zoom: el VTT a turnos («Nombre: texto»), y `internal_user` decide quién es de afuera', () => {
  const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nMartín Koncke: Hola, ¿me escuchan?\n\n2\n00:01:02.500 --> 00:01:05.000\nSí, perfecto\n';
  assert.deepEqual(turnosDeVtt(vtt), [
    { hablante: 'Martín Koncke', email: null, texto: 'Hola, ¿me escuchan?', segundo: 1 },
    { hablante: null, email: null, texto: 'Sí, perfecto', segundo: 62 },
  ]);
  const r = deZoom({ uuid: '/aBc//d==', topic: 'R1 Ana', start_time: '2026-10-20T15:00:00Z', duration: 30, host_email: 'yo@mako.test', share_url: 'https://us02web.zoom.us/rec/share/x' },
    [{ name: 'Yo', user_email: 'yo@mako.test', internal_user: true }, { name: 'Ana', user_email: '', internal_user: false }]);
  assert.equal(r.invitados[1].externo, true);
  assert.deepEqual(emailsExternos(r), [], 'el correo de uno de afuera viene vacío en Zoom: no se inventa');
  assert.equal(CATALOGO_GRABADORES.zoom.queDa.emails, false, 'y la tarjeta lo dice');
});

test('Otter: la transcripción es texto («Nombre  mm:ss» por bloque)', () => {
  assert.deepEqual(turnosDeTextoOtter('Jane Doe  00:00\nThanks everyone for joining.\n\nAlex Taylor  01:07\nHappy to be here.\nLet us start.'), [
    { hablante: 'Jane Doe', email: null, texto: 'Thanks everyone for joining.', segundo: 0 },
    { hablante: 'Alex Taylor', email: null, texto: 'Happy to be here. Let us start.', segundo: 67 },
  ]);
  const r = deOtter({ id: 'conv1', title: 'product launch', url: 'https://otter.ai/u/conv1', owner: { name: 'Jane', email: 'jane@empresa.test' }, created_at: '2025-07-31T12:00:00Z',
    calendar_guests: [{ name: 'John', email: 'john@test.com' }], abstract_summary: 'This meeting discussed…', relationships: { transcript: { content: 'Jane  00:05\nHola', format: 'txt' } } });
  assert.deepEqual(emailsExternos(r), ['john@test.com']);
  assert.equal(r.transcripcion?.[0].segundo, 5);
});

test('externoPorCorreo: el mismo correo y el mismo dominio son de la casa; un gmail no dice de qué empresa es nadie', () => {
  assert.equal(externoPorCorreo('a@empresa.test', 'yo@empresa.test'), false);
  assert.equal(externoPorCorreo('a@otra.test', 'yo@empresa.test'), true);
  assert.equal(externoPorCorreo('amigo@gmail.com', 'yo@gmail.com'), true);
  assert.equal(externoPorCorreo('yo@gmail.com', 'YO@gmail.com'), false);
  assert.equal(externoPorCorreo('a@otra.test', null), null, 'sin saber quién grabó, no se sabe');
  assert.equal(externoPorCorreo(null, 'yo@empresa.test'), null);
});

test('el clasificador del Plan lee una reunión de tl;dv igual que una de Fathom', () => {
  const r = deTldv({ id: 'm1', name: 'R1', happenedAt: '2026-10-20T10:00:00Z', organizer: { email: 'yo@mako.test' }, invitees: [{ email: 'pro@cliente.test' }] });
  assert.equal(clasificarReunion(r, new Map([['pro@cliente.test', { estado_lead: 'abierto' }]]), new Set()), 'ventas');
});

// ── 4. Las firmas ─────────────────────────────────────────────────────────────────────────────────

test('Fireflies firma el cuerpo crudo: «sha256=<hex>» (vector calculado con Python hmac)', () => {
  const cuerpo = '{"event":"meeting.transcribed","meeting_id":"ASxwZxCstx"}';
  const hex = '477d3961672f913f38fb4cea251a9e28941461173a4193c22723dd1a32979309';
  assert.equal(firmaFirefliesValida(cuerpo, `sha256=${hex}`, 'secreto-de-prueba'), true);
  assert.equal(firmaFirefliesValida(cuerpo, hex, 'secreto-de-prueba'), true, 'el hex solo también');
  assert.equal(firmaFirefliesValida(cuerpo, `sha256=${hex}`, 'otro-secreto'), false);
  assert.equal(firmaFirefliesValida(`${cuerpo} `, `sha256=${hex}`, 'secreto-de-prueba'), false, 'un byte de más en el cuerpo');
  assert.equal(firmaFirefliesValida(cuerpo, '', 'secreto-de-prueba'), false);
});

test('Zoom firma «v0:<timestamp>:<cuerpo>» y valida la dirección con el plainToken (vectores de Python hmac)', () => {
  const cuerpo = '{"event":"recording.completed"}';
  assert.equal(firmaZoom(cuerpo, '1729900000', 'tok'), 'v0=37d2000ee0ff5a45a151b674e043458bfc7a2d6101efb48bf940f379aa067e54');
  assert.equal(firmaZoomValida(cuerpo, '1729900000', 'v0=37d2000ee0ff5a45a151b674e043458bfc7a2d6101efb48bf940f379aa067e54', 'tok'), true);
  assert.equal(firmaZoomValida(cuerpo, '1729900001', 'v0=37d2000ee0ff5a45a151b674e043458bfc7a2d6101efb48bf940f379aa067e54', 'tok'), false, 'otro reloj');
  assert.deepEqual(respuestaValidacionZoom('qgg8vlvZRS6UYooatFL8Aw', 'tok'),
    { plainToken: 'qgg8vlvZRS6UYooatFL8Aw', encryptedToken: 'c03826888ff615aa1af254a715c8545a13159f7085d6813b4422edc606af56e6' });
});

// ── 5. Lo que no da, se dice ──────────────────────────────────────────────────────────────────────

test('Loom no tiene API: su tarjeta no pide nada, lo dice, y su link igual entra al lead', () => {
  const loom = CATALOGO_GRABADORES.loom;
  assert.equal(loom.conectable, false);
  assert.equal(loom.queDa.transcripcion, false);
  assert.match(loom.aviso ?? '', /no tiene API/);
  assert.deepEqual(DEFS_TEST.find((d) => d.key === 'loom')?.envs, [], 'la tarjeta de Loom no pide claves que no existen');
  assert.equal(grabadorDelLink('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184'), 'loom');
  assert.equal(grabadorDelLink('https://us02web.zoom.us/rec/share/abc'), 'zoom');
  assert.equal(grabadorDelLink('https://fathom.video.evil.tld/x'), null);
  assert.equal(grabadorDelLink('http://fathom.video/x'), null, 'sin https, no');
  // Los que no se conectan no tienen lector: nadie los lee haciendo de cuenta.
  const indice = leer('../lib/grabadores/index.ts');
  const lectores = indice.slice(indice.indexOf('const LECTORES'), indice.indexOf('};', indice.indexOf('const LECTORES')));
  for (const g of GRABADORES) {
    const tiene = new RegExp(`^\\s+'?${g}'?: lector`, 'm').test(lectores);
    assert.equal(tiene, CATALOGO_GRABADORES[g].conectable, `${g}: conectable=${CATALOGO_GRABADORES[g].conectable} y ${tiene ? 'tiene' : 'no tiene'} lector`);
  }
});

// ── 6. Los registros de cada tarjeta ──────────────────────────────────────────────────────────────

test('cada grabador tiene tarjeta, logo y slides; los que se conectan, campos y ping; y sus claves son las que lee su lector', () => {
  const metodo = leer('../lib/metodo-catalogo.ts');
  const pings = leer('../lib/metodo-verificar.ts');
  const visual = leer('../app/_components/ServicioVisual.tsx');
  const slides = leer('../lib/servicio-slides.ts');
  for (const g of GRABADORES) {
    const def = DEFS_TEST.find((d) => d.key === g);
    // La Grabadora de MaKo (04/11/2026) graba DESDE MaKo: no es una integración, y tener tarjeta la ofrecería para «conectar».
    if (g === 'grabadora') { assert.equal(def, undefined, 'la Grabadora de MaKo no tiene tarjeta en Integraciones'); continue; }
    assert.ok(def, `${g}: falta la tarjeta`);
    assert.match(visual, new RegExp(`^\\s{2}${g}: \\{`, 'm'), `${g}: falta el logo`);
    assert.match(slides, new RegExp(`^\\s{2}${g}: \\[`, 'm'), `${g}: faltan las slides`);
    if (!CATALOGO_GRABADORES[g].conectable || g === 'fathom') continue;
    assert.match(metodo, new RegExp(`key: '${g}',`), `${g}: faltan los campos`);
    assert.match(pings, new RegExp(`async ${g}\\(v\\)`), `${g}: falta el ping`);
    // Las claves que pide la tarjeta (`envs`) son las que lee el lector: si se separan, conectar no trae nada.
    const fuente = leer(`../lib/grabadores/${g}.ts`);
    const leidas = new Set([...fuente.matchAll(/'([A-Z][A-Z0-9_]+)'/g)].map((m) => m[1]).filter((k) => k.startsWith(g.toUpperCase())));
    for (const env of def!.envs.filter((e) => !e.endsWith('_HOST_EMAIL'))) assert.ok(leidas.has(env), `${g}: la tarjeta pide ${env} y el lector no la lee`);
  }
});

test('los avisos: tl;dv rutea por el organizador; Fireflies y Zoom por la firma; ninguno lee contenido del aviso', () => {
  const ruteo = leer('../lib/webhook-routing.ts');
  assert.match(ruteo, /TLDV_HOST_EMAIL: 'tldv'/);
  assert.match(leer('../lib/metodo-catalogo.ts'), /\{ env: 'TLDV_HOST_EMAIL', label: 'Email de la cuenta que graba', placeholder/, 'el correo de ruteo de tl;dv no puede ser opcional');
  for (const w of ['tldv', 'fireflies', 'zoom']) {
    const src = leer(`../app/api/webhooks/${w}/route.ts`);
    assert.match(src, /leerYTerminar\(/, `${w}: la reunión se pide entera por la API`);
    assert.ok(!/alTerminarReunion\(/.test(src), `${w}: no arma la reunión con lo que dice el aviso`);
  }
  assert.match(leer('../app/api/webhooks/fireflies/route.ts'), /negocioPorFirma\('FIREFLIES_WEBHOOK_SECRET'/);
  assert.match(leer('../app/api/webhooks/zoom/route.ts'), /negocioPorFirma\('ZOOM_WEBHOOK_SECRET'/);
  assert.match(leer('../app/api/webhooks/tldv/route.ts'), /wsPorIdentificadorEstricto\('tldv', organizador\)/);
});

// Probado rompiéndolo (26/10/2026), una por vez y restaurando (15 tests):
//   · `deFathom` sin los segundos de cada turno ...................................... 1 fallo, 14 pases
//   · `invitadoHablo` sin el anfitrión entre los de casa ............................. 1 / 14 (con el primer juego de
//     casos NO caía: el anfitrión también era invitado; se sumó el Meet sin calendario, que es donde importa)
//   · la clave de los demás grabadores positiva ...................................... 1 / 14
//   · la firma de Zoom con «v0:<cuerpo>:<timestamp>» ................................. 1 / 14
//   · un gmail tomado como dominio de empresa ........................................ 1 / 14
//   · INVERTIDA: Loom `conectable: true` ............................................. 2 / 13
//   · INVERTIDA: un link sin exigir https ............................................ 1 / 14
//   · el lector de Zoom leyendo otra clave que la de la tarjeta ...................... 1 / 14
//   · la firma de Fireflies sin sacar el «sha256=» ................................... 1 / 14
//   · Fireflies sin `workspace_users` (el equipo cae como de afuera) ................. 1 / 14
//   · el aviso de tl;dv ruteado por el id y no por el organizador .................... 1 / 14
//   Restaurado: 15 / 0.
