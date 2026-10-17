// =============================================================================
// La VOZ DE MAKO y el envío de la tarjeta «MaKo en WhatsApp» por partes (undécima tanda)
// =============================================================================
// Pedido de Martín (11/10/2026, decisión 2 de la décima): «en audios, que se pueda configurar con ElevenLabs que
// salga la voz de MaKo. La que usamos para crear los VSL de la landing.» Lo que fija este test:
//   1. `VOZ_MAKO` es la voz y los ajustes del VSL, uno por uno;
//   2. `textoParaVozMaKo`: sin datos, sin links, sin emojis, «MaKo» → «Máko», y el tope rechaza (no corta);
//   3. la key es la de la PLATAFORMA en su env propia, leída en UN lugar, y nunca la del cliente ni la env de
//      siempre (`hidratarCredenciales` la pisaría con la del ws1, un cliente); y el orden caché → key → tope →
//      reclamo → UNA llamada → guardar;
//   4. `enviarPartesPorEv` con el `ev` inyectado: un 201 sin `key.id` es un fallo, corta en la primera;
//   5. `emitirAviso` DE VERDAD (Evolution y la base de mentira, en un node aparte): SIN partes sale EXACTAMENTE
//      como hoy —es el choke point de ~48 avisos—; con partes, tal cual y en orden; a medias, guarda lo que salió;
//   6. `avisar_al_equipo` DE VERDAD (el runner del registro, con la base de mentira): un WhatsApp que no salió es
//      `ok:false`; la tarjeta tal cual no se deduplica; los binarios se bajan antes de avisar nada; el audio tiene
//      que ser la Voz de MaKo de ESTE negocio.
//
// Los hijos corren con `--conditions=react-server` (lib/avisos.ts y el registro llevan `server-only`, el
// precedente es tests/agenda-whatsapp.test.ts) y `--experimental-test-module-mocks`: se reemplaza SÓLO lo que
// toca la base o la red; el código que decide es el del repo.
//
// Probado rompiéndolo (11/10/2026, arnés del scratchpad `wf-undecima/w1-mako-envio/romper.mjs`: una rotura por
// vez, restaurada byte a byte y comprobada con md5; base 6 / 6):
//   1. contar un 201 sin `key.id` como salido (`enviarPartesPorEv` mira sólo `r.ok`)        → 2 rojos (4 y 5).
//   2. leer `ELEVENLABS_API_KEY` en `keyDeMaKo`                                             → 1 rojo (3).
//   3. dedup en la tarjeta tal cual (`dedupKey`/`dedupTtlMin` en la rama tal cual)          → 1 rojo (6).
//   4. no bajar los binarios antes: el runner sigue sin ellos y avisa igual                 → 1 rojo (6).
//   5. `resultadoDelAviso` sin mirar `waError` (el «Le avisé» falso)                        → 1 rojo (6).
//   6. `emitirAviso` con `!a.rotulo` (un aviso SIN partes pierde el rótulo)                 → 1 rojo (5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  VOZ_MAKO, DUENO_PUBLICO_VOZ_MAKO, ENV_VOZ_MAKO, ORIGEN_VOZ_MAKO, TOPE_VOZ_MAKO_MES, TOPE_TEXTO_AUDIO,
  textoParaVozMaKo, caracteresVoz, cabeEnElMes, inicioDelMes, textoFalloVozMaKo,
} from '../lib/voz-mako-reglas';
import { enviarPartesPorEv, type EvFn, type PartePreparada } from '../lib/mako-tarjeta';
import type { FalloEleven } from '../lib/elevenlabs-fallo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: un guard que lee el fuente también leería las citas de lo que prohíbe. */
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const bloque = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};

/** Corre `codigo` en un node aparte (react-server + mocks de módulos) y devuelve el JSON de su última línea. */
function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env:{ ...process.env, EVOLUTION_BASE_URL: 'http://evo.test', EVOLUTION_API_KEY: 'k-de-mentira' } });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

// ── 1-3. La voz ────────────────────────────────────────────────────────────────

test('1. la Voz de MaKo es «David» con los ajustes del VSL', () => {
  assert.deepEqual(VOZ_MAKO, {
    voiceId: 'id7LQ3n0ft94moeTT1ER',
    modelo: 'eleven_multilingual_v2',
    ajustes: { stability: 0.35, similarity_boost: 0.85, style: 0.5, use_speaker_boost: true, speed: 1.08 },
    formato: 'mp3_44100_128',
  });
  assert.equal(VOZ_MAKO.voiceId.length, 20, 'el «id» del principio es parte del id: el de 18 caracteres no existe');
  assert.equal(DUENO_PUBLICO_VOZ_MAKO, 'e340aad478e652ffe83f8412e6960d222773590b4d0638d4dbd31242460eed39');
  assert.equal(ENV_VOZ_MAKO, 'MAKO_ELEVENLABS_API_KEY');
  assert.equal(ORIGEN_VOZ_MAKO, 'voz_mako');
  assert.equal(TOPE_VOZ_MAKO_MES, 5000, 'decisión §9.20: ≈US$0,50 por negocio y por mes');
  // La migración que deja guardarla.
  const mig = leer('supabase/migrations/0257_setting_audios_voz_mako.sql');
  assert.match(mig, /check \(origen in \('biblioteca', 'ai_step', 'voz_mako'\)\)/);
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES o JUNTO/);
});

test('2. lo que dice la voz: sin datos, sin links, sin emojis, «Máko», y el tope rechaza', () => {
  assert.deepEqual(textoParaVozMaKo('  Hola equipo 👋, soy MaKo: entró una reunión nueva.  '), { ok: true, hablado: 'Hola equipo, soy Máko: entró una reunión nueva.' });
  assert.deepEqual(textoParaVozMaKo('Llámalo, {{nombre_completo}} agendó'), { ok: false, error: 'Un audio no lleva datos: van en un mensaje.' });
  assert.deepEqual(textoParaVozMaKo('Mira https://hola-mako.com/crm/5'), { ok: false, error: 'Un audio no lleva links: van en un mensaje.' });
  assert.deepEqual(textoParaVozMaKo('   '), { ok: false, error: 'Escribe qué tiene que decir.' });
  assert.deepEqual(textoParaVozMaKo('🎉🎉'), { ok: false, error: 'Escribe qué tiene que decir.' });
  assert.equal(textoParaVozMaKo('a'.repeat(TOPE_TEXTO_AUDIO)).ok, true, 'justo en el tope entra');
  const largo = textoParaVozMaKo('a'.repeat(TOPE_TEXTO_AUDIO + 1));
  assert.deepEqual(largo, { ok: false, error: `Muy largo para un audio (${TOPE_TEXTO_AUDIO + 1} de ${TOPE_TEXTO_AUDIO}).` }, 'se rechaza, no se corta a mitad de frase');
  // El tope del mes, por caracteres que cobra ElevenLabs.
  assert.equal(caracteresVoz('Máko'), 4);
  assert.ok(cabeEnElMes(4990, 10) && !cabeEnElMes(4990, 11));
  assert.equal(inicioDelMes(new Date('2026-10-11T21:00:00Z')), '2026-10-01T00:00:00.000Z');
  // Un fallo nombra a ElevenLabs y nunca manda al cliente a «su cuenta» (la voz la paga la plataforma).
  for (const m of ['sin_key', 'sin_permiso', 'impago', 'cuota', 'voz_muerta', 'proveedor', 'nuestra'] as FalloEleven[]) {
    const t = textoFalloVozMaKo(m);
    assert.match(t, /ElevenLabs/, `«${m}» no nombra a ElevenLabs`);
    assert.doesNotMatch(t, /tu cuenta|tu key/i, `«${m}» manda al cliente a una cuenta que no es suya`);
  }
});

test('3. la key es la de la PLATAFORMA, en su env propia, leída en UN lugar; y el orden que no paga dos veces', () => {
  const src = sinComentarios(leer('lib/voz-mako.ts'));
  const lineas = src.split('\n').filter((l) => l.includes('MAKO_ELEVENLABS_API_KEY'));
  assert.equal(lineas.length, 1, 'la key de la Voz de MaKo se lee en UN solo lugar (keyDeMaKo)');
  assert.match(lineas[0]!, /process\.env\.MAKO_ELEVENLABS_API_KEY/);
  assert.doesNotMatch(src, /credDelCliente\(|credWs\(|elevenKey\(/, 'la Voz de MaKo no es BYOK: no se resuelve con la key del cliente');
  assert.doesNotMatch(src, /(?<!MAKO_)ELEVENLABS_API_KEY/, 'la env de siempre la pisa hidratarCredenciales con la del ws1 (un cliente)');
  // Nadie más en lib/ ni en app/ lee la env de la plataforma.
  for (const rel of ['lib/elevenlabs.ts', 'lib/voz-mako-reglas.ts', 'lib/credenciales.ts', 'app/api/automations/voz-mako/route.ts']) {
    assert.doesNotMatch(sinComentarios(leer(rel)), /process\.env(\.|\[['"])MAKO_ELEVENLABS_API_KEY/, `${rel} lee la key de la Voz de MaKo`);
  }
  // El orden: caché (gratis) → key → tope del mes → reclamo contra el doble clic → UNA llamada → guardar.
  const f = bloque(src, 'export async function generarVozMaKo(', '\n}\n');
  const pos = (aguja: string): number => { const i = f.indexOf(aguja); assert.ok(i >= 0, `no está ${aguja}`); return i; };
  const orden = ['buscarAudioPorTranscript(', 'keyDeMaKo()', 'cabeEnElMes(', 'reclamarEspaciado(ws, \'voz-mako\', 2, hablado)', 'ttsConKey(key, VOZ_MAKO.voiceId', 'crearAudio('].map(pos);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'el orden caché → key → tope → reclamo → ElevenLabs → guardar cambió');
  assert.equal(f.split('ttsConKey(').length - 1, 1, 'ElevenLabs se llama UNA vez: nunca reintenta solo');
  assert.match(f, /origen: ORIGEN_VOZ_MAKO/);
  // La lista de «Audios guardados» sigue siendo sólo la biblioteca del dueño.
  assert.match(sinComentarios(leer('lib/setting-audios.ts')), /export async function listAudios[\s\S]*?\.eq\('origen', 'biblioteca'\)/);
});

// ── 4. El envío por partes, con el `ev` inyectado ─────────────────────────────────

const JID = '120363000000000000@g.us';
const partes3: PartePreparada[] = [
  { tipo: 'texto', texto: 'Nuevo agendado: Ana López' },
  { tipo: 'audio', base64: 'data:audio/mpeg;base64,QUJD', mime: 'audio/mpeg', pausaMs: 3000 },
  { tipo: 'media', base64: 'UERG', media: { tipo: 'document', mimetype: 'application/pdf', fileName: 'agenda.pdf' }, caption: 'La agenda', pausaMs: 2000 },
];
/** Un Evolution de mentira: contesta lo que diga la lista, en orden, y anota cada pedido. */
function evDeMentira(respuestas: Array<{ ok: boolean; status: number; body: unknown }>) {
  const pedidos: Array<{ ruta: string; cuerpo: Record<string, unknown> }> = [];
  const ev: EvFn = async (ruta, init) => {
    pedidos.push({ ruta, cuerpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    return respuestas.shift() ?? { ok: true, status: 201, body: { key: { id: `M${pedidos.length}` } } };
  };
  return { ev, pedidos };
}

test('4. enviarPartesPorEv: en orden y con su pausa; un 201 sin key.id es un fallo; corta en la primera', async () => {
  const esperas: number[] = [];
  const esperar = async (ms: number) => { esperas.push(ms); };
  const bien = evDeMentira([]);
  const r = await enviarPartesPorEv(JID, partes3, { ev: bien.ev, instancia: 'mako_test', esperar, azar: () => 0.5 });
  assert.deepEqual(r, { ok: true, salieron: 3, ids: ['M1', 'M2', 'M3'] });
  assert.deepEqual(bien.pedidos.map((p) => p.ruta), ['/message/sendText/mako_test', '/message/sendWhatsAppAudio/mako_test', '/message/sendMedia/mako_test']);
  assert.deepEqual(bien.pedidos.map((p) => p.cuerpo.number), [JID, JID, JID], 'el número es el JID del grupo, entero');
  assert.equal(bien.pedidos[0]!.cuerpo.text, 'Nuevo agendado: Ana López');
  assert.equal(bien.pedidos[0]!.cuerpo.delay, Math.round(Math.min(1500 + 'Nuevo agendado: Ana López'.length * 45, 9000)), 'el anti-ban de siempre');
  assert.deepEqual({ audio: bien.pedidos[1]!.cuerpo.audio, encoding: bien.pedidos[1]!.cuerpo.encoding }, { audio: 'QUJD', encoding: true }, 'nota de voz, sin el prefijo data:');
  assert.deepEqual(
    { t: bien.pedidos[2]!.cuerpo.mediatype, m: bien.pedidos[2]!.cuerpo.mimetype, f: bien.pedidos[2]!.cuerpo.fileName, c: bien.pedidos[2]!.cuerpo.caption },
    { t: 'document', m: 'application/pdf', f: 'agenda.pdf', c: 'La agenda' },
  );
  assert.deepEqual(esperas, [3000, 2000], 'las pausas de la tarjeta, entre parte y parte');

  // ⚠️ «res.ok no es salió bien»: un 201 sin `key.id` no salió.
  const sinId = evDeMentira([{ ok: true, status: 201, body: { status: 'PENDING' } }]);
  const r2 = await enviarPartesPorEv(JID, partes3, { ev: sinId.ev, instancia: 'mako_test', esperar });
  assert.equal(r2.ok, false, 'un 201 sin key.id se contó como salido');
  assert.equal(r2.salieron, 0);
  assert.match(r2.error ?? '', /^parte 1 de 3: Evolution 201 sin el id del mensaje en mako_test/);
  assert.equal(sinId.pedidos.length, 1, 'después de un fallo no sale nada más');

  // Corta en la primera que falla: la tercera no sale.
  const corta = evDeMentira([{ ok: true, status: 201, body: { key: { id: 'A' } } }, { ok: false, status: 400, body: { response: { message: ['Connection Closed'] } } }]);
  const r3 = await enviarPartesPorEv(JID, partes3, { ev: corta.ev, instancia: 'mako_test', esperar });
  assert.deepEqual(r3, { ok: false, salieron: 1, ids: ['A'], error: 'parte 2 de 3: Evolution 400 en mako_test: Connection Closed' });
  assert.equal(corta.pedidos.length, 2);
  // Sin grupo, nada.
  assert.equal((await enviarPartesPorEv('', partes3, { ev: corta.ev, instancia: 'x' })).ok, false);
});

// ── 5. emitirAviso de verdad (Evolution y la base de mentira) ─────────────────────

const HIJO_AVISO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { feed: [], turnos: [], estado: 0, fetch: [], push: [] };
let respuestas = [];
globalThis.fetch = async (u, init) => {
  const cuerpo = JSON.parse(String(init?.body ?? '{}'));
  log.fetch.push({ ruta: new URL(String(u)).pathname, cuerpo: { ...cuerpo, ...(cuerpo.audio ? { audio: cuerpo.audio } : {}), ...(cuerpo.media ? { media: cuerpo.media } : {}) } });
  const r = respuestas.shift() ?? { status: 201, body: { key: { id: 'W' + log.fetch.length } } };
  return new Response(JSON.stringify(r.body), { status: r.status });
};
const settings = await import(${url('lib/settings.ts')});
mock.module(${url('lib/settings.ts')}, { exports: { ...real(settings),
  getSetting: async (k) => (k === 'mako.grupo_jid' ? '${JID}' : k === 'mako.voz.instancia' ? 'mako_test' : null),
  // El grupo del negocio se lee ESTRICTO desde el 17/10/2026 (\`sinGrupo\`, lib/mako-grupo.ts).
  getSettingEstricto: async (k) => (k === 'mako.grupo_jid' ? '${JID}' : null), setSetting: async () => {},
} });
mock.module(${url('lib/notificaciones.ts')}, { exports: { crearNotificacion: async (x) => { log.feed.push(x.descripcion); return 1; }, anotarSalida: async () => {} } });
mock.module(${url('lib/espaciado.ts')}, { exports: { reclamarEspaciado: async () => true, salioReciente: async () => false } });
const perfil = await import(${url('lib/perfil.ts')});
mock.module(${url('lib/perfil.ts')}, { exports: { ...real(perfil), estadoAviso: async () => { log.estado++; return { activo: true, wa: true, email: false, frecuenciaMin: 0 }; }, resumenAvisosActivo: async () => false } });
mock.module(${url('lib/avisos-cola.ts')}, { exports: { encolarAviso: async () => false } });
mock.module(${url('lib/mako-doer-conv.ts')}, { exports: { guardarTurno: async (ws, jid, rol, texto, id) => { log.turnos.push({ jid, texto, id }); } } });
mock.module(${url('lib/push.ts')}, { exports: { enviarPush: async (_w, p) => { log.push.push(p.tag); return { enviados: 0, fallidos: 0, sinSuscripciones: 0 }; } } });
mock.module(${url('lib/plantillas.ts')}, { exports: { getFlujo: async () => null } });
const { emitirAviso } = await import(${url('lib/avisos.ts')});
const { encabezadoAviso } = await import(${url('lib/avisos-catalogo.ts')});
const { ESTADO_TARJETA } = await import(${url('lib/mako-tarjeta.ts')});
const corrida = async (a, resp = []) => {
  log.feed = []; log.turnos = []; log.estado = 0; log.fetch = []; log.push = []; respuestas = resp;
  const r = await emitirAviso(a);
  return { r, ...JSON.parse(JSON.stringify(log)) };
};
const base = { ws: 7, tipo: 'chatbot-aviso-equipo', titulo: 'T', categoria: 'accion', semaforo: 'amarillo' };
const partes = [
  { tipo: 'texto', texto: 'Nuevo agendado: Ana López' },
  { tipo: 'audio', base64: 'QUJD', mime: 'audio/mpeg', pausaMs: 5 },
  { tipo: 'media', base64: 'UERG', media: { tipo: 'document', mimetype: 'application/pdf', fileName: 'agenda.pdf' }, caption: 'La agenda', pausaMs: 5 },
];
const out = {
  encabezado: encabezadoAviso('chatbot-aviso-equipo'),
  sinPartes: await corrida({ ...base, texto: 'hola' }),
  talCual: await corrida({ ...base, texto: 'Nuevo agendado: Ana López\\n\\nLa agenda', rotulo: false, estado: ESTADO_TARJETA, partes, lead: { id: 5, nombre: 'Ana' } }),
  aMedias: await corrida({ ...base, texto: 'x', rotulo: false, estado: ESTADO_TARJETA, partes }, [{ status: 201, body: { key: { id: 'P1' } } }, { status: 201, body: { status: 'PENDING' } }]),
};
console.log(JSON.stringify(out));
`;

test('5. emitirAviso de verdad: SIN partes sale como hoy; con partes, tal cual y en orden; a medias, guarda lo que salió', () => {
  const o = hijo(HIJO_AVISO) as Record<string, any>;
  const enc = o.encabezado as string;
  assert.match(enc, /^━━ /);
  // SIN partes: EXACTAMENTE lo de hoy (un texto, con el rótulo, al JID del grupo, el historial con lo mandado).
  const s = o.sinPartes;
  assert.deepEqual(s.fetch.map((f: any) => f.ruta), ['/message/sendText/mako_test'], 'un aviso sin partes cambió de camino');
  assert.equal(s.fetch[0].cuerpo.number, JID);
  assert.equal(s.fetch[0].cuerpo.text, `${enc}\nhola`, 'el rótulo del choke point');
  assert.deepEqual(s.feed, ['hola'], 'el feed lleva el texto pelado');
  assert.deepEqual(s.turnos, [{ jid: JID, texto: `${enc}\nhola`, id: 'W1' }]);
  assert.equal(s.estado, 1, 'sin estado decidido, el interruptor se lee del store');
  assert.deepEqual(s.push, ['aviso:chatbot-aviso-equipo'], 'el tag del push de siempre');
  assert.equal(s.r.wa, true);
  assert.equal(s.r.waError, undefined);
  // Con partes, tal cual: tres pedidos, en orden, sin rótulo; el interruptor no se lee; el historial con los textos.
  const t = o.talCual;
  assert.deepEqual(t.fetch.map((f: any) => f.ruta), ['/message/sendText/mako_test', '/message/sendWhatsAppAudio/mako_test', '/message/sendMedia/mako_test']);
  assert.equal(t.fetch[0].cuerpo.text, 'Nuevo agendado: Ana López', 'la tarjeta tal cual salió con el rótulo');
  assert.equal(t.fetch[1].cuerpo.encoding, true);
  assert.equal(t.fetch[2].cuerpo.caption, 'La agenda');
  assert.equal(t.estado, 0, 'la tarjeta tal cual leyó el interruptor del store');
  assert.deepEqual(t.feed, ['Nuevo agendado: Ana López\n\nLa agenda']);
  assert.deepEqual(t.turnos, [{ jid: JID, texto: 'Nuevo agendado: Ana López\n\nLa agenda', id: 'W3' }]);
  assert.match(t.push[0], /^aviso:chatbot-aviso-equipo:5:/, 'sin dedupKey, cada aviso de la tarjeta reemplazaría al anterior en el teléfono');
  assert.equal(t.r.wa, true);
  // A medias: la segunda volvió 201 sin key.id → no salió, la tercera no se manda, y el historial guarda la primera.
  const m = o.aMedias;
  assert.equal(m.fetch.length, 2, 'después de la parte que falló se siguió mandando');
  assert.equal(m.r.wa, false, 'un 201 sin key.id se contó como salido');
  assert.match(m.r.waError, /^parte 2 de 3: Evolution 201 sin el id del mensaje/);
  assert.deepEqual(m.turnos, [{ jid: JID, texto: 'Nuevo agendado: Ana López', id: 'P1' }], 'el grupo vio la primera: el historial tiene que tenerla');
});

// ── 6. avisar_al_equipo de verdad (el runner del registro, con la base de mentira) ──

const HIJO_RUNNER = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { emitidos: [] };
let resultado = { ok: true, feedId: 1, wa: true, deduped: false };
let audios = {};
const avisos = await import(${url('lib/avisos.ts')});
mock.module(${url('lib/avisos.ts')}, { exports: { ...real(avisos), emitirAviso: async (a) => { log.emitidos.push(a); return resultado; } } });
mock.module(${url('lib/variables-resolver.ts')}, { exports: { ...real(await import(${url('lib/variables-resolver.ts')})), conVariables: async (t) => t.replaceAll('{{nombre_completo}}', 'Ana López') } });
const ws = await import(${url('lib/workspace.ts')});
const fila = { id: 5, nombre: 'Ana López', telefono: '+52 664 000 0000', empresa: null };
const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }) }) };
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(ws), getTenantDb: async () => db } });
const sa = await import(${url('lib/setting-audios.ts')});
mock.module(${url('lib/setting-audios.ts')}, { exports: { ...real(sa),
  getAudio: async (id) => (audios[id] ? { id, media_path: 'p', media_mime: 'audio/mpeg' } : null),
  getAudioConOrigen: async (id) => (audios[id] ? { id, media_path: 'p', media_mime: 'audio/mpeg', origen: audios[id] } : null),
  audioBase64: async () => 'QUJD',
} });
const adj = await import(${url('lib/setting-adjuntos.ts')});
mock.module(${url('lib/setting-adjuntos.ts')}, { exports: { ...real(adj), getAdjunto: async () => null, adjuntoBase64: async () => null } });
const { runnerDe } = await import(${url('lib/api-mako/runners.ts')});
const run = runnerDe('avisar_al_equipo');
const flujo = { ws: 14, canal: 'app', canalKey: 'app:flujo:secuencia:213:paso:4', alcance: 'ejecutar', rol: 'admin' };
const chat = { ws: 14, canal: 'whatsapp', canalKey: 'whatsapp:grupo', alcance: 'ejecutar', rol: 'admin' };
const corrida = async (payload, ctx, r, a = {}) => { log.emitidos = []; resultado = r; audios = a; const x = await run.ejecutar(payload, ctx); return { x, emitidos: JSON.parse(JSON.stringify(log.emitidos)) }; };
const sinGrupo = { ok: true, feedId: 1, wa: false, deduped: false, waError: 'el workspace no tiene grupo de MaKo todavía' };
const salio = { ok: true, feedId: 1, wa: true, deduped: false };
const talCual = { leadId: 5, mensaje: 'Nuevo agendado: {{nombre_completo}}', partes: [{ tipo: 'texto', cuerpo: 'Nuevo agendado: {{nombre_completo}}' }, { tipo: 'audio', audio_id: 31, pausa_s: 2 }] };
const out = {
  vieja: await corrida({ leadId: 5, titulo: 'no confirmó la reunión', mensaje: 'Agendó y no confirmó.' }, flujo, sinGrupo),
  talCual: await corrida(talCual, flujo, salio, { 31: 'voz_mako' }),
  sinAudio: await corrida(talCual, flujo, salio, {}),
  porChat: await corrida(talCual, chat, salio, { 31: 'voz_mako' }),
  prepVoz: await run.preparar({ ...talCual }, flujo),
  prepDueno: await (async () => { audios = { 31: 'biblioteca' }; return run.preparar({ ...talCual }, flujo); })(),
  prepAjeno: await (async () => { audios = {}; return run.preparar({ ...talCual }, flujo); })(),
  prepArchivo: await run.preparar({ leadId: 5, mensaje: 'x', partes: [{ tipo: 'media', media_id: 9 }] }, flujo),
  prepRota: await run.preparar({ leadId: 5, mensaje: 'x', partes: [{ tipo: 'audio' }] }, flujo),
};
console.log(JSON.stringify(out));
`;

test('6. avisar_al_equipo de verdad: WhatsApp que no salió = ok:false; tal cual sin dedup; binarios antes; sólo la Voz de MaKo', () => {
  const o = hijo(HIJO_RUNNER) as Record<string, any>;
  // La tarjeta de antes, con el grupo que no existe: un FALLO con su causa (hasta la décima, «Le avisé»).
  assert.equal(o.vieja.x.ok, false, '«Le avisé al equipo» con el WhatsApp sin salir');
  assert.match(o.vieja.x.resumen, /no tiene grupo de MaKo/);
  const v = o.vieja.emitidos[0];
  assert.equal(v.texto, ['🟡 *no confirmó la reunión*', '', 'Agendó y no confirmó.', '', 'Ana López · +52 664 000 0000', `👉 ${v.texto.split('👉 ')[1].split('\n')[0]}`, '', '— MaKo'].join('\n'));
  assert.match(v.texto, /👉 https?:\/\/[^\n]*\/crm\/5\?ws=14\n/, 'el link de la ficha con el ?ws=');
  assert.deepEqual({ ws: v.ws, dedupKey: v.dedupKey, dedupTtlMin: v.dedupTtlMin, rotulo: v.rotulo, partes: v.partes }, { ws: 14, dedupKey: 'lead:5', dedupTtlMin: 720, rotulo: undefined, partes: undefined });
  // La tarjeta tal cual: sin dedup, sin rótulo, con el estado fijo y las partes con los datos resueltos y el audio bajado.
  assert.deepEqual(o.talCual.x, { ok: true, resumen: 'Le avisé al equipo.' });
  const t = o.talCual.emitidos[0];
  assert.ok(!('dedupKey' in t) && !('dedupTtlMin' in t), 'la tarjeta tal cual se deduplica: la segunda tarjeta del mismo lead se perdería');
  assert.equal(t.rotulo, false);
  assert.deepEqual(t.estado, { activo: true, wa: true, email: false, frecuenciaMin: 0 });
  assert.deepEqual(t.partes, [{ tipo: 'texto', texto: 'Nuevo agendado: Ana López' }, { tipo: 'audio', base64: 'QUJD', mime: 'audio/mpeg', pausaMs: 2000 }]);
  assert.equal(t.texto, 'Nuevo agendado: Ana López');
  // ⚠️ Los binarios ANTES: sin el audio, no se avisa NADA (ni el feed), y es un fallo con su causa.
  assert.deepEqual(o.sinAudio.x, { ok: false, resumen: 'No salió el aviso: parte 2: el audio ya no existe' });
  assert.equal(o.sinAudio.emitidos.length, 0, 'se avisó antes de bajar los binarios');
  // Por el chat (no un flujo): como siempre, con el audio detrás del texto envuelto.
  const c = o.porChat.emitidos[0];
  assert.equal(c.dedupKey, 'lead:5');
  assert.deepEqual(c.partes.map((p: any) => p.tipo), ['texto', 'audio']);
  assert.ok(c.partes[0].texto.startsWith('🟡 *Ana López: hay que verlo*'));
  // preparar: sólo la Voz de MaKo, sólo de ESTE negocio, y una parte sin su archivo no pasa.
  assert.deepEqual(o.prepVoz.payload.partes, [{ tipo: 'texto', cuerpo: 'Nuevo agendado: {{nombre_completo}}' }, { tipo: 'audio', audio_id: 31, pausa_s: 2 }]);
  assert.match(o.prepVoz.resumen, /\(2 mensajes\)$/);
  assert.deepEqual(o.prepDueno, { error: 'El audio #31 no es la Voz de MaKo.' }, 'el grupo recibiría la voz del dueño');
  assert.deepEqual(o.prepAjeno, { error: 'No existe el audio #31 en este negocio.' });
  assert.deepEqual(o.prepArchivo, { error: 'No existe el archivo #9 en este negocio.' });
  assert.deepEqual(o.prepRota, { error: 'El aviso tiene una parte sin su texto o su archivo.' });
});
