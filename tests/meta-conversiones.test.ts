// =============================================================================
// Qué mide de verdad una conversión, y el aviso de la agenda que no se mide
// =============================================================================
// Todo con los datos REALES de Código Inmobiliario (ws13), leídos de Meta y de la
// base el 2026-09-11: la regla de «AGENDA», su last_fired_time, los eventos de 30
// días del pixel, el canal que declaró en su diagnóstico y las piezas de sus dos
// landings. Ver la cabecera de lib/meta-conversiones.ts.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoAgendaSinMedir, describirRegla, estadoConversion, motivosVentaPorLlamada } from '../lib/meta-conversiones';

const REGLA_AGENDA = '{"and":[{"event":{"eq":"PageView"}},{"or":[{"URL":{"i_contains":"\\/gracias"}},{"URL":{"i_contains":"name"}},{"URL":{"i_contains":"email"}}]}]}';
const EVENTOS_PIXEL_WS13 = ['PageView', 'ViewContent', 'CompleteRegistration', 'agendar llamada 1 arriba', 'Lead'];
const SNAPSHOTS_WS13 = {
  'https://landingvsl.vercel.app': { piezas: ['botones', 'embed-agenda'] },
  'https://v0-joandowd.vercel.app': { piezas: ['botones', 'embed-agenda'] },
};

test('la regla de «AGENDA» se dice como lo que cuenta: visitas a una URL, no agendas', () => {
  assert.equal(describirRegla(REGLA_AGENDA), 'Visitas a una URL que contiene «/gracias», «name» o «email»');
  assert.equal(describirRegla('{"and":[{"event":{"eq":"Schedule"}}]}'), 'Cada evento «Schedule»');
  assert.equal(describirRegla('{"and":[{"event":{"eq":"Lead"}},{"URL":{"i_starts_with":"https://x.com/gracias"}}]}'), 'Cada evento «Lead» en una URL que empieza con «https://x.com/gracias»');
  // Lo que no se sabe traducir NO se traduce a medias: la pantalla dice «regla propia».
  assert.equal(describirRegla('{"and":[{"event":{"eq":"Purchase"}},{"value":{"gt":100}}]}'), null);
  //   ROTO A PROPÓSITO (2026-09-11): ignorando los campos desconocidos, esa regla
  //   salía como «Cada evento «Purchase»» — actual 'Cada evento «Purchase»',
  //   expected null. Afirmaba que cuenta TODA compra cuando sólo cuenta las de más
  //   de 100: una traducción a medias es una mentira con buena ortografía.
  assert.equal(describirRegla('{"and":[{"URL":{"operador_nuevo":"x"}}]}'), null);
  assert.equal(describirRegla('no es json'), null);
  assert.equal(describirRegla(null), null);
});

test('activa/inactiva/nunca sale de last_fired_time, con el huso como lo manda Meta', () => {
  const ahora = new Date('2026-09-11T20:00:00Z');
  assert.equal(estadoConversion('2026-09-11T19:29:01+0000', ahora), 'activa');
  assert.equal(estadoConversion('2026-08-13T19:29:01+0000', ahora), 'activa'); // 29 días
  assert.equal(estadoConversion('2026-08-11T19:29:01+0000', ahora), 'inactiva'); // 31 días
  assert.equal(estadoConversion(null, ahora), 'nunca');
  assert.equal(estadoConversion('basura', ahora), 'nunca');
  //   ⚠️ ROTO A PROPÓSITO Y NO FALLÓ: sacando la normalización del huso
  //   («+0000» → «+00:00») este test sigue 5 de 5, porque V8 acepta «+0000». O sea
  //   que acá NO prueba la normalización. Se queda porque el mismo formato se parsea
  //   en el NAVEGADOR (`fechaCorta` del paso de conversión) y Safari es estricto con
  //   ISO — eso no está medido acá, y por eso lo dice este renglón y no un assert.
});

test('los motivos citan hechos: lo declarado y lo medido en la landing', () => {
  assert.deepEqual(motivosVentaPorLlamada({ canal: 'llamadas', entradas: [], snapshots: SNAPSHOTS_WS13 }), [
    'declaraste que vendes por llamada',
    'tus landings landingvsl.vercel.app y v0-joandowd.vercel.app tienen una agenda para reservar',
  ]);
  assert.deepEqual(motivosVentaPorLlamada({ canal: null, entradas: ['agenda_sola'], snapshots: {} }), ['tu funnel dice que agendan solos desde un link']);
  // Un carrito sin agenda en la landing: no hay con qué decir que vende por llamada.
  assert.deepEqual(motivosVentaPorLlamada({ canal: 'carrito', entradas: ['landing'], snapshots: { 'https://x.com': { piezas: ['formulario'] } } }), []);
});

test('el aviso sale en ws13 tal como está, y se abstiene cuando no hay con qué afirmarlo', () => {
  const motivos = motivosVentaPorLlamada({ canal: 'llamadas', entradas: [], snapshots: SNAPSHOTS_WS13 });
  const aviso = avisoAgendaSinMedir(motivos, EVENTOS_PIXEL_WS13);
  assert.ok(aviso, 'ws13 vende por llamada y su pixel no recibió ningún Schedule en 30 días');
  assert.match(aviso!.detalle, /^Es un error: declaraste que vendes por llamada/);
  assert.match(aviso!.detalle, /«Schedule»/);
  assert.match(aviso!.detalle, /nunca te va a traer llamadas/);

  // Con el Schedule llegando, no hay error que avisar.
  assert.equal(avisoAgendaSinMedir(motivos, [...EVENTOS_PIXEL_WS13, 'Schedule']), null);
  // listPixelEvents devuelve [] también cuando NO PUDO leer: eso no autoriza a afirmar.
  assert.equal(avisoAgendaSinMedir(motivos, []), null);
  //   ROTO A PROPÓSITO (2026-09-11): sin la abstención ante la lista vacía, este
  //   assert falló con el aviso entero como `actual` — «Es un error: … tu pixel no
  //   recibió ningún evento «Schedule»…» — sobre un pixel que no se pudo leer. Es
  //   exactamente la acusación sin medir que este archivo viene a sacar.
  assert.equal(avisoAgendaSinMedir(motivos, null), null);
  // Sin motivos, tampoco: no se le dice a un carrito que le faltan agendas.
  assert.equal(avisoAgendaSinMedir([], EVENTOS_PIXEL_WS13), null);
});

test('ninguna conversión vuelve a salir con un «que ya mides» que nadie midió', () => {
  const codigo = readFileSync(join(process.cwd(), 'app/ads-manager/NuevaCampanaModal.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(codigo, /que ya mides/i);
  // El rótulo de una conversión personalizada sale del estado que contestó Meta.
  assert.match(codigo, /c\.estado === 'activa'/);
  //   ROTO SIN QUERER, antes de arreglar: corrido sobre el modal todavía sin editar,
  //   falló en el primer assert — el «Conversión que ya mides» fijo seguía vivo.
});
