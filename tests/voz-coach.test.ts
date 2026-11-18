// =============================================================================
// La voz de los coaches (Offer Coach, Funnel Coach): Martín, 18/11/2026
// =============================================================================
// «ponerle voz también a Offer Coach… una voz que no sea la mía… Si tarda muchísimo, no. Si es rápido, sí». Medido el 18/11 con
// streaming: primer audio 0,32–0,42 s (Flash v2.5) → va lo personalizado además de las preguntas fijas. Lo que fija:
//   1. la voz y el modelo: una de la biblioteca (no la de Martín, no «David» de los VSL), Flash v2.5;
//   2. lo que se lee: sin markdown, links ni emojis; lo que no tiene letras o es más largo que un audio, nada (no se corta);
//   3. el tope del mes por negocio y lo que recuerda el botón (suena solo una vez, y se puede apagar);
//   4. `audioDelCoach` REAL (tests/_voz-coach-hijo.ts): sin la key, nada; una fija se guarda y la segunda vez sale guardada, sin
//      pagarla; lo personalizado va por streaming y suma al mes; con el tope lleno no se pide nada;
//   5. la ruta y el botón: detrás del interruptor de la revisión y de la key; el botón no tapa el texto.
// Probado rompiéndolo (18/11/2026): sin la caché de la fija → falla 4; sin reservar el tope → falla 4; sin `veOnboardingV2` en la
// ruta → falla 5.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import {
  VOZ_COACH, TOPE_TEXTO_VOZ_COACH, TOPE_VOZ_COACH_MES, textoParaVozCoach, claveDelMesVozCoach, usadoDelMes, cabeEnElMesVozCoach,
  rutaDeLaFija, firmaDeLaFija, sueneSolo, leerSonados, conSonado, TOPE_SONADOS,
} from '../lib/voz-coach-reglas';
import { VOZ_MAKO } from '../lib/voz-mako-reglas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('1. la voz es de la biblioteca (ni la de Martín ni la de los VSL) y el modelo es el de baja latencia', () => {
  assert.equal(VOZ_COACH.modelo, 'eleven_flash_v2_5');
  assert.notEqual(VOZ_COACH.voiceId, VOZ_MAKO.voiceId, 'no es «David», la voz de los VSL');
  assert.match(leer('lib/voz-coach-reglas.ts'), /NO es la de Martín ni imita a Hormozi/);
  // Es una de la galería de voces en español (lib/ai-avatar/voces-galeria.ts), con acento latino neutro.
  const galeria = leer('lib/ai-avatar/voces-galeria.ts');
  assert.match(galeria, new RegExp(`id: '${VOZ_COACH.voiceId}'[^\\n]*acento: 'Latino neutro'`));
});

test('2. lo que se lee: sin markdown, links ni emojis; sin letras o demasiado largo, nada', () => {
  assert.equal(textoParaVozCoach('**Perfecto.** Ahora dime: ¿qué resultado consigue tu cliente? 🚀'), 'Perfecto. Ahora dime: ¿qué resultado consigue tu cliente?');
  assert.equal(textoParaVozCoach('Mira [tu oferta](https://hola-mako.com/oferta?ws=3) y dime.'), 'Mira tu oferta y dime.');
  assert.equal(textoParaVozCoach('Tres cosas:\n- el resultado\n- el tiempo\n- el esfuerzo'), 'Tres cosas: el resultado. el tiempo. el esfuerzo');
  assert.equal(textoParaVozCoach('🙂🙂'), null);
  assert.equal(textoParaVozCoach('https://hola-mako.com/x'), null);
  assert.equal(textoParaVozCoach(''), null);
  assert.equal(textoParaVozCoach('a'.repeat(TOPE_TEXTO_VOZ_COACH + 1)), null, 'más largo que un audio: no se corta a mitad de frase, no va');
  assert.equal(textoParaVozCoach('a'.repeat(TOPE_TEXTO_VOZ_COACH))?.length, TOPE_TEXTO_VOZ_COACH);
});

test('3. el tope del mes por negocio, la fija con su voz y su modelo, y lo que recuerda el botón', () => {
  assert.equal(claveDelMesVozCoach(new Date('2026-11-18T12:00:00Z')), 'mako.voz_coach.mes.2026-11');
  assert.equal(usadoDelMes('1200'), 1200);
  assert.equal(usadoDelMes('roto'), 0);
  assert.equal(usadoDelMes(null), 0);
  assert.ok(cabeEnElMesVozCoach(TOPE_VOZ_COACH_MES - 100, 100));
  assert.ok(!cabeEnElMesVozCoach(TOPE_VOZ_COACH_MES - 99, 100));
  assert.match(rutaDeLaFija('abc'), new RegExp(`^voz-coach/${VOZ_COACH.voiceId}/${VOZ_COACH.modelo}/abc\\.mp3$`));
  assert.ok(firmaDeLaFija('hola').startsWith(`${VOZ_COACH.voiceId}|${VOZ_COACH.modelo}|`), 'cambiar de voz no reproduce el audio viejo');
  // Suena solo: el último mensaje, sin apagar, y una sola vez.
  assert.equal(sueneSolo({ autoplay: true, apagado: false, yaSono: false }), true);
  assert.equal(sueneSolo({ autoplay: true, apagado: true, yaSono: false }), false, 'la persona lo apagó');
  assert.equal(sueneSolo({ autoplay: true, apagado: false, yaSono: true }), false, 'ya sonó');
  assert.equal(sueneSolo({ autoplay: false, apagado: false, yaSono: false }), false, 'un mensaje viejo no suena solo');
  assert.deepEqual(leerSonados('roto'), []);
  assert.deepEqual(leerSonados('["a", 3, "b"]'), ['a', 'b']);
  assert.deepEqual(conSonado(['a', 'b'], 'a'), ['b', 'a']);
  assert.equal(conSonado(Array.from({ length: TOPE_SONADOS }, (_, i) => `m${i}`), 'nuevo').length, TOPE_SONADOS);
});

test('4. audioDelCoach real: sin key nada; la fija se guarda una vez; lo personalizado por streaming; el tope frena', () => {
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_voz-coach-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000,
  });
  assert.equal(r.status, 0, (r.stderr || '').slice(-2000));
  const e = new Map((r.stdout || '').split('\n').filter((l) => l.startsWith('@@VOZ@@')).map((l) => {
    const o = JSON.parse(l.slice(7)) as Record<string, unknown> & { nombre: string };
    return [o.nombre, o as Record<string, unknown>];
  }));
  const sin = e.get('sinKey') as unknown as { disponible: boolean; r: { ok: boolean; status: number }; llamadas: number };
  assert.equal(sin.disponible, false);
  assert.equal(sin.r.status, 503);
  assert.equal(sin.llamadas, 0, 'sin la key de la plataforma no se llama a ElevenLabs');

  const f = e.get('fija') as unknown as { disponible: boolean; primera: { guardado: boolean; bytes: number }; tras1: { llamadas: number; subidas: number }; segunda: { guardado: boolean; bytes: number }; llamadas: number; rutas: string[]; pedido: string };
  assert.equal(f.disponible, true);
  assert.equal(f.primera.guardado, false);
  assert.ok(f.primera.bytes > 0);
  assert.deepEqual([f.tras1.llamadas, f.tras1.subidas], [1, 1], 'la primera vez se pide y se guarda');
  assert.equal(f.segunda.guardado, true, 'la misma pregunta (con markdown y un emoji) sale guardada');
  assert.equal(f.llamadas, 1, 'la segunda vez no se paga');
  assert.ok(f.rutas.some((x) => x.includes(`voz-coach/${VOZ_COACH.voiceId}/${VOZ_COACH.modelo}/`)));
  assert.match(f.pedido, new RegExp(`^/v1/text-to-speech/${VOZ_COACH.voiceId}/stream\\|${VOZ_COACH.modelo}\\|`));

  const p = e.get('personalizado') as unknown as { ok: boolean; stream: boolean; llamadas: number; subidas: number; usado: string; largo: number };
  assert.equal(p.ok, true);
  assert.equal(p.stream, true, 'lo personalizado va por streaming');
  assert.deepEqual([p.llamadas, p.subidas], [1, 0], 'lo personalizado no se guarda');
  assert.equal(Number(p.usado), 79 + p.largo, 'cada audio pedido suma sus caracteres al mes');

  const t = e.get('tope') as unknown as { r: { ok: boolean; status?: number }; llamadas: number };
  assert.equal(t.r.status, 429);
  assert.equal(t.llamadas, 0, 'con el tope lleno no se pide nada');

  const v = e.get('vacio') as unknown as Record<string, { status: number }>;
  for (const k of ['emoji', 'link', 'largo']) assert.equal(v[k].status, 400, k);
  assert.deepEqual((e.get('red') as unknown as { otras: string[] }).otras, []);
});

test('5. la ruta y el botón: detrás de la revisión y de la key; el botón no tapa el texto y suena solo una vez', () => {
  const ruta = leer('app/api/voz-coach/route.ts');
  assert.match(ruta, /if \(ws == null \|\| !veOnboardingV2\(\{ email: s\.email, ws \}\)\) return null;/);
  assert.match(ruta, /disponible: !!q && vozCoachDisponible\(\)/);
  assert.match(ruta, /export async function POST/, 'POST: el texto del coach no viaja en la URL (los logs)');
  const boton = leer('app/_ui/voz-coach/BotonVozCoach.tsx');
  assert.match(boton, /if \(!dicho \|\| !ve\) return null;/, 'sin key o fuera de la revisión, el botón no se dibuja');
  assert.match(boton, /sueneSolo\(\{ autoplay, apagado: leer\(CLAVE_AUTO_VOZ_COACH\) === '0', yaSono \}\)/);
  assert.match(boton, /Que suene solo/);
  assert.match(boton, /aria-label=/);
  // Ningún hook después del return (la regla de los hooks de React).
  const cuerpo = boton.slice(boton.indexOf('export function BotonVozCoach'));
  const corte = cuerpo.indexOf('if (!dicho || !ve) return null;');
  assert.ok(!/\buse(State|Effect|Ref|Callback|Memo)\(/.test(cuerpo.slice(corte)), 'un hook detrás del return');
});
