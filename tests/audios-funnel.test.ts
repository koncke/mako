// Qué audios y qué escenarios le tocan a cada negocio, según cómo ENTRA su gente
// y dónde CIERRA la venta.
//
// El caso que esto protege ahora es más grande que el original. Antes el único
// eje era «¿tiene reuniones?» y protegía a la venta directa de que le pidieran un
// audio de «ya agendaste». Pero ese eje describe cómo TERMINA el embudo, y lo que
// distingue de verdad a un negocio de otro es cómo EMPIEZA: una clienta que
// prospecta en frío por WhatsApp grabó, porque el sistema se lo pidió, un audio
// que le dice a un desconocido «vi que dejaste tus datos en el anuncio». Sus 27
// leads tienen meta_lead_id = 0: ninguno dejó datos en ningún lado.
//
// ⚠️ EL TEST VIEJO CONSAGRABA EL BUG. Tenía un caso llamado «el default de
// escenariosDe no cambia el comportamiento viejo» que fijaba que llamar sin saber
// el funnel devolviera TODO — o sea, exigía por escrito el fail-open hacia el
// funnel del dueño de la agencia. Se eliminó a propósito: hoy los dos catálogos
// no tienen default, y sin declaración devuelven vacío.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audiosDe, AUDIOS_PASO, guionDe, defDeClave, cuandoTexto } from '../lib/audios-paso';
import { escenariosDe } from '../lib/chat-agent-escenarios';

// ── Lo que NO puede cambiarle a quien ya grabó ──────────────────────────────
// ws1 tiene sus tres audios grabados y el mapa chat_agent.audios_clave apunta a
// esos binarios. Estos asserts son de igualdad LITERAL a propósito: si alguien
// toca una de estas frases, el dueño tiene que regrabar, y eso se decide a mano,
// no como efecto colateral de un refactor.
test('el audio de bienvenida no cambió ni una palabra', () => {
  const def = defDeClave('bienvenida')!;
  assert.equal(def.situacion, 'Dejó sus datos en el anuncio y todavía no agendó. Es el primer mensaje que recibe de ti.');
  assert.equal(def.guion[1], 'Menciona de dónde llegó su dato: dejó sus datos en el anuncio.');
});

test('el funnel del dueño sigue pidiendo exactamente sus 3 audios', () => {
  const claves = audiosDe(['formulario_anuncio', 'agenda_sola'], 'llamadas').map((a) => a.clave);
  assert.deepEqual(claves, ['bienvenida', 'agenda_con_bienvenida', 'agenda_primer_contacto']);
});

// ── El caso que trajo todo esto ─────────────────────────────────────────────
test('quien prospecta en frío y cierra en persona NO recibe el audio del anuncio', () => {
  const claves = audiosDe(['chat_saliente', 'chat_entrante'], 'presencial').map((a) => a.clave);
  assert.deepEqual(claves, ['apertura_fria', 'respuesta_entrante', 'evento_confirmado']);
  assert.ok(!claves.includes('bienvenida'), 'el audio del anuncio no puede aparecer sin esa entrada');
});

test('sin entrada declarada no se pide NINGÚN audio (nunca los del dueño)', () => {
  assert.deepEqual(audiosDe([], null), []);
  // El caso peor del bug viejo: un caller que no sabe nada recibía todo.
  assert.deepEqual(audiosDe([], 'llamadas').map((a) => a.clave), []);
});

test('un negocio sin reuniones no recibe ningún audio de agendamiento', () => {
  const claves = audiosDe(['formulario_anuncio'], 'carrito').map((a) => a.clave);
  assert.deepEqual(claves, ['bienvenida']);
});

test('donde la fecha la pone el negocio no existe el audio de «agendaste»', () => {
  const claves = audiosDe(['chat_saliente'], 'presencial').map((a) => a.clave);
  assert.ok(!claves.some((c) => c.startsWith('agenda_')), `no puede haber audios de agenda: ${claves.join(', ')}`);
  assert.ok(claves.includes('evento_confirmado'));
});

test('todo audio del catálogo es alcanzable por alguna combinación', () => {
  const alcanzables = new Set([
    ...audiosDe(['formulario_anuncio', 'agenda_sola'], 'llamadas').map((a) => a.clave),
    ...audiosDe(['landing'], 'llamadas').map((a) => a.clave),
    ...audiosDe(['chat_saliente', 'chat_entrante'], 'presencial').map((a) => a.clave),
  ]);
  const huerfanos = AUDIOS_PASO.filter((a) => !alcanzables.has(a.clave)).map((a) => a.clave);
  assert.deepEqual(huerfanos, [], `hay audios que nadie puede recibir nunca: ${huerfanos.join(', ')}`);
});

// ── El guion se resuelve en CÓDIGO, no en el prompt ─────────────────────────
test('sin link de video el guion no menciona ningún video', () => {
  const def = defDeClave('bienvenida')!;
  assert.deepEqual(guionDe(def, { linkVideo: null }), def.guion);
  assert.ok(guionDe(def, { linkVideo: 'https://x.com/v' }).some((b) => b.includes('link del video')));
});

test('sin lugar declarado el guion NO inventa una dirección: dice que la pasa por acá', () => {
  const def = defDeClave('evento_confirmado')!;
  const sin = guionDe(def, { evento: null });
  assert.ok(sin.some((b) => b.includes('pasas por acá la dirección')));
  assert.ok(!sin.some((b) => /Huayac|calle|avenida/i.test(b)));
});

test('con lugar y día declarados, el guion los dice textuales', () => {
  const def = defDeClave('evento_confirmado')!;
  const con = guionDe(def, { evento: { lugar: 'Huayacán, Cancún', dias: [3], hora: '19:00', cupo: 20 } });
  const txt = con.join(' | ');
  assert.ok(txt.includes('Huayacán, Cancún'));
  assert.ok(txt.includes('los miércoles'));
  assert.ok(txt.includes('19:00'));
  // El cupo pide avisar si no va, y va ANTES del cierre, nunca al final.
  assert.equal(con[con.length - 1], def.guion[def.guion.length - 1]);
});

test('el cupo solo aparece si está declarado', () => {
  const def = defDeClave('evento_confirmado')!;
  const sin = guionDe(def, { evento: { lugar: 'Cancún', dias: [], hora: null, cupo: null } });
  assert.ok(!sin.some((b) => b.includes('lugares son limitados')));
});

test('cuandoTexto solo dice lo que está declarado', () => {
  assert.equal(cuandoTexto(null), null);
  assert.equal(cuandoTexto({ dias: [], hora: null }), null);
  assert.equal(cuandoTexto({ dias: [3], hora: null }), 'los miércoles');
  assert.equal(cuandoTexto({ dias: [], hora: '19:00' }), 'a las 19:00');
  assert.equal(cuandoTexto({ dias: [1, 3], hora: '19:00' }), 'los lunes y miércoles a las 19:00');
});

// ── Los escenarios del ensayo siguen al audio ───────────────────────────────
test('quien prospecta en frío ensaya contra un lead que NO dejó datos', () => {
  const ids = escenariosDe(false, ['chat_saliente'], 'presencial').map((e) => e.id);
  assert.ok(ids.length > 0, 'un negocio en frío no puede quedarse sin ensayo');
  assert.ok(!ids.some((id) => id.startsWith('bienvenida_')), `quedaron escenarios de anuncio: ${ids.join(', ')}`);
  assert.ok(!ids.some((id) => id.startsWith('agenda_')), `quedaron escenarios de agenda: ${ids.join(', ')}`);
});

test('el dueño conserva sus escenarios de agenda', () => {
  const ids = escenariosDe(true, ['formulario_anuncio', 'agenda_sola'], 'llamadas').map((e) => e.id);
  assert.ok(ids.some((id) => id.startsWith('agenda_')));
  assert.ok(ids.some((id) => id.startsWith('bienvenida_')));
});

test('sin declaración no queda ningún escenario', () => {
  assert.deepEqual(escenariosDe(true, [], null), []);
});

test('el escenario del video sigue dependiendo del link', () => {
  const con: EntradaId[] = ['formulario_anuncio', 'agenda_sola'];
  assert.ok(!escenariosDe(false, con, 'llamadas').some((e) => e.requiereVideo));
  assert.ok(escenariosDe(true, con, 'llamadas').some((e) => e.requiereVideo));
});

test('todo escenario cuelga de un audio que existe', () => {
  const { ESCENARIOS } = require('../lib/chat-agent-escenarios') as typeof import('../lib/chat-agent-escenarios');
  const claves = new Set(AUDIOS_PASO.map((a) => a.clave));
  for (const e of ESCENARIOS) {
    assert.ok(claves.has(e.audio), `el escenario ${e.id} cuelga de un audio inexistente: ${e.audio}`);
  }
});

import type { EntradaId } from '../lib/pipeline';
