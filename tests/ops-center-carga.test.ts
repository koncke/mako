// =============================================================================
// La carga del Ops Center en la computadora: lo que trababa, y la criatura que entra (23/10/2026, feedback 5b)
// =============================================================================
// Martín: «al entrar al Ops Center en la computadora tarda, y el diseño se traba uno o dos segundos. Poné la animación de la
// criatura de MaKo que ya tenemos en el teléfono: aparece y se acomoda en su lugar mientras carga. Y medí qué tarda, y bajalo».
// Medido en producción (el super admin, 23/10/2026): el HTML llegaba a los 1,3 s y después React trabajaba ~1,9 s seguidos
// (tareas de 300 a 620 ms) y volvía cada pocos segundos. Medido con los datos de producción en Node:
//   1. el historial de los 57 chats (`lineasDe`) costaba 247 ms en CADA refresco, 141 de ellos en `respuestasDelChat`, que
//      resolvía la sesión de cada tarjeta contra todos los carteros una vez POR CHAT; ahora una vez por (decisiones, carteros):
//      5 ms;
//   2. abrir un chat con un «Completado» sin ✓ dibujaba TODO su historial (`verTodo`); ahora hasta ese «Ya está» y unos de antes;
//   3. los lotes de lo último de cada chat (`leerUltimosTurnos`) se leían en serie: en paralelo;
//   4. la criatura de MaKo (la entrada del teléfono) nace y flota sobre el Ops Center mientras carga, y vuela a su lugar.
//
// Correr: node --import tsx --test tests/ops-center-carga.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { preguntasDelChat, respuestasDelChat } from '../lib/centro-preguntas';
import { tandaHasta, type LineaChat } from '../lib/centro-chats';
import { DESTINO_ENTRADA_OPS, EntradaOps, MS_TOPE_SIN_HILO, listaParaSalir } from '../app/second-brain/EntradaOps';
import type { Decision } from '../app/admin/runway/decisiones';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const L1 = 'local_11111111-1111-4111-8111-111111111111', L2 = 'local_22222222-2222-4222-8222-222222222222';
const dec = (id: number, chat: string, respondida = true, destino: string | null = null) => ({
  id, ref: `d-${id}`, chat, pregunta: '¿Sí?', opciones: [{ clave: 'A', texto: 'Sí' }], destraba: null, contexto: null, recomendada: 'A',
  urgencia: 'criterio', href: null, orden: 100, respuesta: respondida ? 'A' : null, respuestaTexto: null, respondidaAt: respondida ? '2026-10-23T00:00:00Z' : null,
  recogidaAt: null, creadaAt: '2026-10-22T00:00:00Z', destino,
}) as unknown as Decision;

test('1. la sesión de cada tarjeta, una vez por (decisiones, carteros): el mismo resultado, sin repetirla por chat', () => {
  const carteros = [{ cuenta: 'claude3', chats: [{ local: L1, titulo: 'CRM', cuenta: 'claude3' }, { local: L2, titulo: 'Offer', cuenta: 'claude3' }] }] as never;
  const decisiones = [dec(1, 'CRM'), dec(2, 'Offer'), dec(3, 'CRM', false), dec(4, 'x', true, L2)];
  const crm = { miembros: [L1] }, offer = { miembros: [L2] };
  assert.deepEqual(respuestasDelChat(crm, decisiones, carteros).map((d) => d.id), [1], 'las contestadas de ESE chat');
  assert.deepEqual(respuestasDelChat(offer, decisiones, carteros).map((d) => d.id), [2, 4], 'por su nombre o por su destino');
  assert.deepEqual(preguntasDelChat(crm, decisiones, carteros).map((d) => d.id), [3], 'las abiertas');
  // Con los MISMOS arreglos, los carteros se recorren una sola vez para todos los chats (antes, una vez por chat).
  let recorridos = 0;
  const contados = new Proxy([...(carteros as unknown as unknown[])], { get(t, k, r) { if (k === 'flatMap') recorridos++; return Reflect.get(t, k, r); } }) as never;
  for (let i = 0; i < 57; i++) { respuestasDelChat(i % 2 ? crm : offer, decisiones, contados); preguntasDelChat(crm, decisiones, contados); }
  assert.equal(recorridos, 1, 'una vez, no 114');
  // Otro arreglo (otro refresco) es otra cuenta: nunca una vieja.
  const otras = [...decisiones, dec(5, 'CRM')];
  assert.deepEqual(respuestasDelChat(crm, otras, contados).map((d) => d.id), [1, 5]);
});

test('2. un chat con un «Completado» sin ✓ dibuja hasta ese «Ya está» y unos de antes, no todo su historial', () => {
  const turno = (uuid: string, i: number) => ({ tipo: 'turno', instante: i, turno: { uuid, rol: 'el', texto: `t${i}`, at: i } }) as unknown as LineaChat;
  const lineas = Array.from({ length: 200 }, (_, i) => turno(`u${i}`, i));
  assert.equal(tandaHasta(lineas, 'u190'), 10 + 5, 'las 10 de después del «Ya está», él y 4 de antes');
  assert.equal(tandaHasta(lineas, 'u199', 3), 1 + 3);
  assert.equal(tandaHasta(lineas, 'no-esta'), null);
  const conv = sinComentarios(leer('app/admin/operaciones/Conversacion.tsx'));
  const efecto = conv.slice(conv.indexOf('fueAlYaEsta.current = chat.clave;'), conv.indexOf('}, [chat.clave, sinVer, lineas]);'));
  assert.match(efecto, /const n = tandaHasta\(lineas, sinVer\);\n\s*setCuantos\(\(c\) => Math\.max\(c, n \?\? Number\.MAX_SAFE_INTEGER\)\);/);
  assert.doesNotMatch(efecto, /verTodo\(\)/, 'ya no dibuja todo para llegar');
});

test('3. lo último de cada chat se lee en paralelo, no lote por lote', () => {
  const db = sinComentarios(leer('lib/centro-turnos-db.ts'));
  const f = db.slice(db.indexOf('export async function leerUltimosTurnos('));
  assert.match(f, /const leidos = await Promise\.all\(lotes\.map\(\(lote\) => sb\.from\('app_settings'\)/);
  assert.doesNotMatch(f.slice(0, f.indexOf('const out')), /for \([^)]*\) \{\n\s*const lote[\s\S]*?await/, 'sin un await por lote');
});

test('4. la criatura de MaKo entra mientras carga y vuela a su lugar, la criatura de la cabecera', () => {
  // Se va con la página entera y la conversación dibujada; sin conversación, a los 3 s de la página.
  assert.deepEqual(listaParaSalir(false, true, 100, null), { lista: false, desde: null }, 'sin la página entera, no');
  assert.deepEqual(listaParaSalir(true, true, 100, null), { lista: true, desde: 100 });
  assert.deepEqual(listaParaSalir(true, false, 100, null), { lista: false, desde: 100 });
  assert.equal(listaParaSalir(true, false, 100 + MS_TOPE_SIN_HILO, 100).lista, true, 'sin conversación, como mucho 3 s');
  // Lo dibuja el server: la capa con la criatura de MaKo.
  const html = renderToStaticMarkup(createElement(EntradaOps));
  assert.match(html, /^<div class="eo-capa" role="presentation" aria-hidden="true"><div class="eo-vuelo"><div class="eo-cria"><svg/);
  // En la página (cliente y super admin) y en el loading.tsx, que espera.
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<div className="co" data-con-chat=\{conChat \? 'true' : 'false'\}>\n\s*(?:\{\}\n\s*)?<EntradaOps \/>/);
  assert.match(sinComentarios(leer('app/admin/operaciones/loading.tsx')), /<div className="co" aria-busy="true" aria-label="Cargando Ops Center">\n\s*(?:\{\}\n\s*)?<EntradaOps espera \/>/);
  // Su lugar: la criatura de la cabecera del chat.
  assert.equal(DESTINO_ENTRADA_OPS, '.co-cab__muneco');
  assert.match(leer('app/admin/operaciones/PanelChat.tsx'), /className="co-cab__muneco"/);
  const piezas = sinComentarios(leer('app/second-brain/EntradaOps.tsx'));
  assert.match(piezas, /trayecto\(cuerpo\.current\?\.getBoundingClientRect\(\), document\.querySelector\(DESTINO_ENTRADA_OPS\)\?\.getBoundingClientRect\(\), v\.getBoundingClientRect\(\)\)/);
  assert.match(piezas, /const terminar = \(\) => \{ yaEntro = true; if \(viva\) setVer\(false\); \};/, 'una vez por documento');
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co \{\n {2}position: relative;/, 'tapa el Ops Center');
  assert.match(css, /\.eo-capa \{\n {2}position: absolute; inset: 0;/);
  assert.match(css, /html\[data-eo-nacio\] \.eo-cria \{ animation: eo-flota/, 'la de la página no vuelve a nacer');
  assert.match(css, /@media \(max-width: 720px\) \{ \.eo-capa \{ display: none; \} \}/, 'en una columna entra la del teléfono');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0):
//   · la sesión se resuelve por chat otra vez          → 3/1 (1)
//   · vuelve el `verTodo` al «Ya está»                 → 3/1 (2)
//   · los lotes otra vez en serie                      → 3/1 (3)
//   · se va sin la conversación dibujada               → 3/1 (4)
//   · la entrada sin montar en la página               → 3/1 (4)
