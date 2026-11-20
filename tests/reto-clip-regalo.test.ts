// =============================================================================
// El clip de 10 s que el reto regala el día 6 (20/11/2026, R57-02)
// =============================================================================
// Lo que fija este archivo (lib/reto/clip-regalo-reglas.ts, app/ai-avatar/regalo/clip.ts, lib/apimart-reglas.ts):
//   1. la frase: hasta 25 palabras (10 s), y la que no entra SE DICE, no se corta en silencio;
//   2. el prompt: la frase exacta, sin texto en pantalla, neutro;
//   3. el estado guardado se lee tolerante y vuelve igual;
//   4. una vez por prueba: sólo se pide sin pedido o con un fallo que tiene intento; el rechazo no cuenta como intento;
//   5. lo colgado se destraba sin volver a pagar;
//   6. lo que ve la tarjeta: «no se te cobró nada» en cada fallo, sin nombres de proveedores;
//   7. ApiMart sin saldo es un RECHAZO (no arrancó), no un «no sé»; un 500 sigue siendo «no sé»;
//   8. el pedido del Omni va como se generó el 17/11: 720p, 9:16, la foto como primer cuadro;
//   9. el camino: sin el candado de Pro, con la puerta del reto y la prueba, reserva ANTES de lanzar, no cobra MaKo Tokens y
//      anota lo que costó; y anotar el costo NO avisa al medidor;
//  10. el estimado es el clip de la tabla de costos (US$0,24).
//
// PROBADO ROMPIÉNDOLO (20/11/2026; una rotura por vez, restaurada): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAVE_CLIP_REGALO, MAX_INTENTOS_CLIP, MAX_PALABRAS_CLIP, SEGUNDOS_CLIP_REGALO, TEXTOS_CLIP, USD_ESTIMADO_CLIP_REGALO,
  GENERANDO_VENCE_MS, GUARDANDO_VENCE_MS, PIDIENDO_VENCE_MS,
  fraseDelClip, leerEstado, promptDelClip, publico, sePuedePedir, vencido, type EstadoGuardado,
} from '../lib/reto/clip-regalo-reglas';
import { comoQuedo, cuerpoDePedido, MODELO_OMNI, MODELO_VIDEO_POR_DEFECTO } from '../lib/apimart-reglas';
import { USD_POR_CLIP } from '../lib/mako-tokens-paquetes';

const RAIZ = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const T0 = Date.parse('2026-11-20T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const generando = (at = iso(T0)): Extract<EstadoGuardado, { e: 'generando' }> => ({
  e: 'generando', at, intentos: 1, frase: 'Hola, esto lo hice con MaKo', taskId: 'task_1', planId: 'p1',
  imagen: 'https://x.test/i.jpg', imagenId: 'm1', plantillaId: 'auto-testimonio', deDonde: 'personaje',
});

test('1. la frase: hasta 25 palabras, y la que no entra se dice (no se corta en silencio)', () => {
  const ok = fraseDelClip('  «Si vendes   high ticket,   esto te va a servir»  ');
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.frase, 'Si vendes high ticket, esto te va a servir'); assert.equal(ok.palabras, 9); }
  const justa = fraseDelClip(Array.from({ length: MAX_PALABRAS_CLIP }, () => 'hola').join(' '));
  assert.ok(justa.ok, `${MAX_PALABRAS_CLIP} palabras entran`);
  const larga = fraseDelClip(Array.from({ length: MAX_PALABRAS_CLIP + 3 }, () => 'hola').join(' '));
  assert.ok(!larga.ok, 'una frase de más de 25 palabras pasó: en 10 s queda cortada a la mitad');
  if (!larga.ok) assert.match(larga.error, /28/, 'el error no dice cuántas palabras tiene');
  assert.ok(!fraseDelClip('').ok);
  assert.ok(!fraseDelClip('hola').ok, 'una sola palabra no es un gancho');
  assert.ok(!fraseDelClip(undefined).ok);
});

test('2. el prompt lleva la frase exacta, sin texto en pantalla, y es neutro', () => {
  const p = promptDelClip('Si vendes high ticket, esto te va a servir');
  assert.ok(p.includes('«Si vendes high ticket, esto te va a servir»'), 'la frase no va exacta');
  assert.match(p, /IN SPANISH/);
  assert.match(p, /No on-screen text, no subtitles/);
  assert.match(p, /9:16/);
  assert.doesNotMatch(p, /\b(man|woman|he|she|his|her)\b/i, 'el prompt le pone género a una persona que no conocemos');
});

test('3. el estado guardado se lee tolerante y vuelve igual', () => {
  const g = generando();
  assert.deepEqual(leerEstado(JSON.stringify(g)), g);
  const listo: EstadoGuardado = { e: 'listo', at: iso(T0), intentos: 1, planId: 'p1', url: 'https://x.test/v.mp4', usd: 0.24 };
  assert.deepEqual(leerEstado(JSON.stringify(listo)), listo);
  const sinSaldo: EstadoGuardado = { e: 'fallo', at: iso(T0), intentos: 0, porque: 'Insufficient balance', sinSaldo: true };
  assert.deepEqual(leerEstado(JSON.stringify(sinSaldo)), sinSaldo);
  for (const basura of [null, '', '{', '[]', '{"e":"otro"}', '{"e":"generando"}', '{"e":"listo"}']) {
    assert.equal(leerEstado(basura), null, `«${basura}» no es un estado`);
  }
  assert.equal(CLAVE_CLIP_REGALO, 'reto.clip-regalo');
});

test('4. una vez por prueba: sólo sin pedido o con un fallo que tiene intento', () => {
  assert.equal(sePuedePedir(null), true);
  assert.equal(sePuedePedir({ e: 'fallo', at: iso(T0), intentos: 0, porque: 'x' }), true, 'un rechazo (no arrancó) cerró el regalo');
  assert.equal(sePuedePedir({ e: 'fallo', at: iso(T0), intentos: MAX_INTENTOS_CLIP - 1, porque: 'x' }), true);
  assert.equal(sePuedePedir({ e: 'fallo', at: iso(T0), intentos: MAX_INTENTOS_CLIP, porque: 'x' }), false, 'se puede pedir sin límite después de fallos pagados');
  for (const g of [generando(), { ...generando(), e: 'guardando', desde: iso(T0) } as EstadoGuardado,
    { e: 'pidiendo', at: iso(T0), intentos: 0, frase: 'a b' } as EstadoGuardado,
    { e: 'listo', at: iso(T0), intentos: 1, planId: 'p', url: 'u', usd: 0.24 } as EstadoGuardado,
    { e: 'revisar', at: iso(T0), intentos: 1, porque: 'x' } as EstadoGuardado]) {
    assert.equal(sePuedePedir(g), false, `con «${g.e}» se puede pedir otro: se paga dos veces`);
  }
});

test('5. lo colgado se destraba sin volver a pagar', () => {
  const pidiendo: EstadoGuardado = { e: 'pidiendo', at: iso(T0), intentos: 0, frase: 'a b' };
  assert.equal(vencido(pidiendo, T0 + PIDIENDO_VENCE_MS - 1000), null);
  const v1 = vencido(pidiendo, T0 + PIDIENDO_VENCE_MS + 1000);
  assert.equal(v1?.e, 'revisar', 'un pedido a medio camino volvió a quedar pedible: podía estar corriendo en ApiMart');
  const guardando: EstadoGuardado = { ...generando(), e: 'guardando', desde: iso(T0) };
  assert.equal(vencido(guardando, T0 + GUARDANDO_VENCE_MS + 1000)?.e, 'generando', 'un «guardando» muerto no se suelta');
  assert.equal(vencido(generando(), T0 + 60_000), null);
  assert.equal(vencido(generando(), T0 + GENERANDO_VENCE_MS + 1000)?.e, 'revisar');
  assert.equal(vencido({ e: 'listo', at: iso(T0 - 9e9), intentos: 1, planId: 'p', url: 'u', usd: 0 }, T0), null);
});

test('6. lo que ve la tarjeta: cada fallo dice que no se cobró nada, y nunca nombra al proveedor', () => {
  assert.deepEqual(publico(null, true), { estado: 'disponible', segundos: SEGUNDOS_CLIP_REGALO, maxPalabras: MAX_PALABRAS_CLIP });
  assert.equal(publico(null, false).estado, 'no-disponible', 'fuera de la prueba se ofreció el regalo');
  assert.equal(publico(generando(), true).estado, 'generando');
  assert.deepEqual(publico({ e: 'listo', at: iso(T0), intentos: 1, planId: 'p1', url: 'https://x.test/v.mp4', usd: 0.24 }, true), { estado: 'listo', url: 'https://x.test/v.mp4', planId: 'p1' });
  const sinSaldo = publico({ e: 'fallo', at: iso(T0), intentos: 0, porque: 'Insufficient balance', sinSaldo: true }, true);
  assert.equal(sinSaldo.estado, 'fallo');
  if (sinSaldo.estado === 'fallo') { assert.equal(sinSaldo.texto, TEXTOS_CLIP.sinSaldo); assert.equal(sinSaldo.puedeReintentar, true); }
  const agotado = publico({ e: 'fallo', at: iso(T0), intentos: MAX_INTENTOS_CLIP, porque: 'x' }, true);
  if (agotado.estado === 'fallo') assert.equal(agotado.puedeReintentar, false);
  const revisar = publico({ e: 'revisar', at: iso(T0), intentos: 1, porque: 'x' }, true);
  if (revisar.estado === 'fallo') assert.equal(revisar.puedeReintentar, false, 'un «no sé si arrancó» se ofreció reintentar: se paga dos veces');
  for (const [k, t] of Object.entries(TEXTOS_CLIP)) {
    assert.doesNotMatch(t, /apimart|omni|flow|gemini/i, `TEXTOS_CLIP.${k} nombra un proveedor`);
    assert.doesNotMatch(t, /\b(vos|tenés|podés|acá)\b/i, `TEXTOS_CLIP.${k} tiene voseo`);
    if (['sinSaldo', 'rechazado', 'fallo', 'falloSinIntento', 'revisar'].includes(k)) assert.match(t, /No se te cobró nada/, `TEXTOS_CLIP.${k} no dice que no se cobró`);
  }
});

test('7. ApiMart sin saldo es un RECHAZO (no arrancó); un 500 sigue siendo «no sé»', () => {
  const a = comoQuedo({ error: { message: 'Insufficient balance, please recharge', type: 'insufficient_user_quota' } }, 403);
  assert.equal(a.estado, 'rechazado', 'sin saldo quedó como «desconocido»: el regalo se traba para siempre');
  assert.equal(a.estado === 'rechazado' && a.sinSaldo, true);
  const b = comoQuedo({ error: { message: 'payment required' } }, 402);
  assert.equal(b.estado === 'rechazado' && b.sinSaldo, true, 'un 402 no se leyó como sin saldo');
  assert.equal(comoQuedo({ error: { message: 'internal error' } }, 500).estado, 'desconocido', 'un 500 se tomó como rechazo: se reintenta y se paga dos veces');
  assert.equal(comoQuedo({ data: { task_id: 'task_9' } }, 402).estado, 'aceptado', 'con task_id ARRANCÓ, diga lo que diga el código');
  const r = comoQuedo({ error: { message: 'invalid_request: duration' } }, 400);
  assert.equal(r.estado === 'rechazado' && !('sinSaldo' in r), true, 'un pedido mal armado se marcó como sin saldo');
});

test('8. el pedido del Omni: 720p, 9:16, la foto como primer cuadro, 10 s', () => {
  const c = cuerpoDePedido(MODELO_OMNI, 'https://x.test/f.jpg', 'p', SEGUNDOS_CLIP_REGALO);
  assert.equal(c.model, 'gemini-omni-1.2-flash-ext');
  assert.equal(c.resolution, '720p', 'sin 720p el precio no es el de la tabla');
  assert.equal(c.aspect_ratio, '9:16');
  assert.equal(c.first_frame_image, 'https://x.test/f.jpg');
  assert.equal(c.duration, 10);
  assert.equal(cuerpoDePedido(MODELO_OMNI, 'https://x.test/f.jpg', 'p', 40).duration, 15, 'el Omni no acepta más de 15 s');
  const otro = cuerpoDePedido(MODELO_VIDEO_POR_DEFECTO, 'https://x.test/f.jpg', 'p', 5);
  assert.equal(otro.resolution, undefined, 'el arreglo del Omni se coló en otro modelo');
});

test('9. el camino: sin candado de Pro, puerta del reto y prueba, reserva antes de lanzar, sin cobrar y anotando', () => {
  const clip = fuente('app/ai-avatar/regalo/clip.ts');
  const codigo = clip.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /candadoDeAiAvatar|soloProParaGenerar|esEsencialDe/, 'el regalo pasa por el candado de Pro: una prueba de Essential no lo recibe');
  assert.match(codigo, /veOnboardingV2\(/, 'el regalo no respeta el interruptor del reto');
  assert.match(codigo, /estadoDePrueba\(/, 'el regalo no mira si está en prueba');
  assert.doesNotMatch(codigo, /cobrarMediosMt|gastarMt/, 'el regalo cobra MaKo Tokens');
  assert.match(codigo, /recordCostoDeMedio\(FEATURE_CLIP_REGALO/, 'lo que costó el regalo no queda anotado');
  const pedir = codigo.slice(codigo.indexOf('export async function pedirClipRegalo'), codigo.indexOf('// ── Cómo va'));
  const reserva = pedir.indexOf('cambiarSettingSi(CLAVE_CLIP_REGALO, leido.crudo');
  const lanza = pedir.indexOf('generarVideo(');
  assert.ok(reserva > 0 && lanza > reserva, 'se lanza el video ANTES de reservar: dos clics pagan dos clips');
  assert.match(pedir, /if \(!gano\)/, 'el que pierde la reserva igual lanza');
  assert.match(pedir, /MODELO_OMNI/, 'el clip no va con el Omni (la regla de Martín: una cara que habla, sólo Omni)');
  const avanzar = codigo.slice(codigo.indexOf('export async function avanzarClipRegalo'));
  assert.ok(avanzar.indexOf("e: 'guardando'") < avanzar.indexOf('guardarVideo('), 'se baja el video sin tomarlo: dos pestañas lo guardan dos veces');
  // anotar el costo no lo liquida contra los MaKo Tokens de nadie
  const uso = fuente('lib/anthropic-usage.ts');
  const f = uso.slice(uso.indexOf('export async function recordCostoDeMedio'));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.doesNotMatch(cuerpo.replace(/^\s*(\/\/|\*).*$/gm, ''), /reportarCostoReal/, 'anotar el regalo avisa al medidor: se lo cobraría a alguien');
  // las acciones son de la tarjeta y están decididas en la cobertura de la API
  const cob = fuente('lib/api-mako/cobertura.ts');
  assert.match(cob, /regalo\/actions\.ts#pedirClipDeRegaloAction/);
  assert.match(cob, /regalo\/actions\.ts#clipDeRegaloAction/);
});

test('10. el estimado es el clip de la tabla de costos (US$0,24)', () => {
  assert.equal(Math.round(USD_ESTIMADO_CLIP_REGALO * 1000), 240);
  assert.equal(Math.round(USD_POR_CLIP * 1000), Math.round(USD_ESTIMADO_CLIP_REGALO * 1000), 'el regalo y la tabla dicen precios distintos');
});

// PROBADO ROMPIÉNDOLO (20/11/2026, una rotura por vez y restaurada):
//   · MAX_PALABRAS_CLIP sin chequear en fraseDelClip                                → 1
//   · el prompt con «The young man» (el de Martín, sin neutralizar)                 → 2
//   · sePuedePedir devuelve true con «revisar»                                      → 4
//   · vencido devuelve pidiendo→null (sin destrabar)                                → 5
//   · TEXTOS_CLIP.sinSaldo sin «No se te cobró nada»                                → 6
//   · SIN_SALDO sacado de comoQuedo                                                 → 7
//   · cuerpoDePedido sin `resolution` para el Omni                                  → 8
//   · `candadoDeAiAvatar()` agregado a la puerta del regalo                         → 9
//   · `generarVideo` antes del compare-and-set                                      → 9
//   · `reportarCostoReal(costUsd)` agregado a recordCostoDeMedio                    → 9
