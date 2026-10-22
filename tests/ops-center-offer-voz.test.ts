// =============================================================================
// La nota de voz y el «+» en una conversación de Offer, desde el Ops Center (22/10/2026, OC7)
// =============================================================================
// El micrófono del Ops Center del cliente sólo dictaba (CajaDelCliente no le pasaba `voz` a la caja). Y el «+» de una
// conversación de Offer estaba APAGADO (`puede: idOffer == null`): OC7 había hecho la lectura de sus documentos y dejado la
// puerta cerrada, y su test miraba el motor, no la puerta. En una conversación de Offer, ahora:
//   1. la nota de voz va en MP3 a Storage y viaja con el turno como `audio` (la escucha el servidor de Offer con la IA del
//      negocio); el reintento de la misma grabación no la vuelve a subir;
//   2. cómo termina, como la tab: guardada aunque MaKo no contestó → se dibuja lo guardado; rechazada (un audio sin voz) → se
//      tira; cortada → vuelve a la barra. Y lo que NO quedó guardado no se tapa con la conversación leída en el camino;
//   3. la caja: el «+» abierto, la grabación sólo acá, y la nota que espera no viaja a otra conversación.
//
// Correr: node --import tsx --test tests/ops-center-offer-voz.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { turnoOffer, type ParaLeer } from '../app/second-brain/motor-offer';
import { ErrorOfferApi } from '../app/offer/offer-api';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SESION = { id: 14, mensajes: [] };
/** Offer de mentira: anota lo que se subió y lo que se pidió; `turno` decide cómo contesta el turno. */
function offer(turno: (cuerpo: Record<string, unknown>) => unknown = () => ({ sesion: SESION })) {
  const subidos: Array<[string, string]> = [];
  const pedidos: Array<Record<string, unknown>> = [];
  const con: ParaLeer = {
    subir: async (f, mime) => { subidos.push([f.name, mime]); return `ws3/offer/${subidos.length}.mp3`; },
    llamar: (async (cuerpo: Record<string, unknown>) => {
      pedidos.push(cuerpo);
      if (cuerpo.action === 'leer') return { sesion: SESION, doc: { id: 'doc-1' } };
      return turno(cuerpo);
    }) as unknown as ParaLeer['llamar'],
  };
  return { con, subidos, pedidos };
}
const nota = (secs = 4.4) => ({ blob: new Blob(['ID3'], { type: 'audio/mpeg' }), secs });
const conEstado = (status: number, sesion?: unknown) => Object.assign(new ErrorOfferApi('no'), { status, ...(sesion ? { sesion } : {}) });

test('1. la nota va en MP3 a Storage y viaja con el turno; el reintento de la misma grabación no la vuelve a subir', async () => {
  const o = offer();
  const n = nota();
  const r = await turnoOffer(14, '', [], null, [], n, o.con);
  assert.equal(r.ok, true);
  assert.deepEqual(o.subidos, [['nota-de-voz.mp3', 'audio/mpeg']]);
  assert.deepEqual(o.pedidos.map((p) => [p.action, p.sesionId, p.texto, p.audio]), [['turno', 14, '', { path: 'ws3/offer/1.mp3', mime: 'audio/mpeg', secs: 4 }]]);
  const o2 = offer();
  await turnoOffer(14, '', [], null, [], n, o2.con);
  assert.deepEqual(o2.subidos, [], 'la misma grabación: ya está subida');
  assert.equal((o2.pedidos[0].audio as { path: string }).path, 'ws3/offer/1.mp3');
  // Un audio que el navegador no puede pasar a MP3: se graba de nuevo (no se reintenta lo mismo).
  const r3 = await turnoOffer(14, '', [], null, [], { blob: new Blob(['x'], { type: 'audio/webm' }), secs: 2 }, offer().con);
  assert.deepEqual(r3, { ok: false, error: 'No se pudo procesar el audio. Grábalo de nuevo.', guardado: false, definitivo: true });
});

test('2. cómo termina, como la tab; y lo que no quedó guardado no se tapa con la conversación leída en el camino', async () => {
  // Guardada aunque MaKo no contestó: viene la conversación en el error.
  const guardada = await turnoOffer(14, '', [], null, [], nota(), offer(() => { throw conEstado(502, SESION); }).con);
  assert.deepEqual(guardada.ok ? null : [guardada.guardado, guardada.definitivo, !!guardada.sesion], [true, false, true]);
  // Escuchada y sin voz (422): se tira, sin releer.
  const sinVoz = await turnoOffer(14, '', [], null, [], nota(), offer(() => { throw conEstado(422); }).con);
  assert.deepEqual(sinVoz.ok ? null : [sinVoz.guardado, sinVoz.definitivo], [false, true]);
  // Cortada, con un documento ya leído en el camino: no se devuelve esa conversación (dibujarla borraba el «Reintentar»).
  const pdf = new File(['%PDF'], 'oferta.pdf', { type: 'application/pdf' });
  const cortada = await turnoOffer(14, 'mira esto', [], null, [pdf], null, offer(() => { throw new Error('Se cortó la conexión.'); }).con);
  assert.deepEqual(cortada.ok ? null : [cortada.guardado, cortada.definitivo, 'sesion' in cortada], [false, false, false]);
});

test('3. la caja: el «+» abierto en Offer, la grabación sólo acá, y la nota que espera no viaja a otra conversación', () => {
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(motor, /items: elegidos, puede: cargado && !errorCarga, onSumar:/, 'el «+» no depende de que no sea Offer');
  assert.match(motor, /const vozCaja = idOffer != null \? \{/);
  assert.match(motor, /pendiente: notaEnEspera && notaEnEspera\.offer === idOffer/);
  assert.match(motor, /if \(fin === 'volver'\) setNotaEnEspera\(a\); else URL\.revokeObjectURL\(a\.url\);/);
  // Lo que no salió no se dibuja con la conversación de vuelta: se saca la nota (vuelve a la barra) o el texto queda con «Reintentar».
  assert.match(motor, /if \(r\.ok \|\| r\.guardado\) \{\n\s*if \(r\.sesion && offerRef\.current\?\.id === s\.id\) await ponerOffer\(r\.sesion\);/);
  assert.match(motor, /if \(nota\) \{ setItems\(\(xs\) => xs\.filter\(\(x\) => x\.id !== idU\)\); setFaltaMic\(r\.error\); \}\n\s*else marcar\(idU, \{ estado: 'error', error: r\.error \}\);/);
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /adjuntos=\{k\.adjuntosCaja\} voz=\{k\.vozCaja\}/, 'la caja recibe la nota de voz');
  // El servidor de Offer la escucha con la IA del negocio antes de guardar nada (lo de siempre de la tab).
  assert.match(sinComentarios(leer('app/api/offer/route.ts')), /const audio = leerAudio\(ws, body\.audio\);/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · la nota no viaja con el turno                 → 2/1 (1)
//   · el reintento la vuelve a subir                → 2/1 (1)
//   · un 422 se reintenta                           → 2/1 (2)
//   · lo no guardado vuelve con la conversación     → 2/1 (2)
//   · el «+» cerrado en Offer                       → 2/1 (3)
//   · la nota de otra conversación se ofrece acá    → 2/1 (3)
