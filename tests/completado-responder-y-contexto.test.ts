// =============================================================================
// El «Completado»: «Responder sobre esto» cita, y lo que dijo Martín va en varias cajitas (26/10/2026)
// =============================================================================
// Martín, desde el Centro (08:54 y 08:55): «El "Completado" le falta el botón de "Responder sobre esto". Y cuando le doy, que no
// escriba en el chat, que se mencione arriba en el chat, como cuando le doy a responder cualquier mensaje.» y «si necesitas
// poner más de 1 mensaje mio, para que se entienda el contexto, hazlo. No todo en el mismo mensaje, sino varias cajitas de
// mensaje con mi foto de perfil.» Esto fija:
//   1. lo que respondía es TODO lo que dijo Martín en ese tramo, cada mensaje por su lado, del más viejo al más nuevo (un turno
//      que trajo un trabajo no cuenta: el trabajo ya está); sin nada suyo en el tramo, lo de antes (`pedidoDelCompletado`);
//   2. el bloque dibuja cada uno en su globo con su foto, en la computadora y en el teléfono (el mismo componente);
//   3. «Responder sobre esto» está en el bloque y en la tarjeta del hilo, y CITA el mensaje arriba de la caja (la cita «↩» de
//      responder un mensaje): no escribe en el campo;
//   4. la API trae ese mismo contexto.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver el registro al final del archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TOPE_PEDIDOS_DEL_COMPLETADO, pedidosDelCompletado, type LineaChat } from '../lib/centro-chats';
import { BloqueCompletado } from '../app/admin/operaciones/BloqueCompletado';
import type { TurnoChat } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LOCAL = 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8';
const turno = (uuid: string, at: string, texto: string, rol: TurnoChat['rol'] = 'el', trabajo: string | null = null): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: rol === 'otro' ? 'Cerebro' : null, texto, at, trabajo } });
const trabajo = (id: string, at: string, texto: string): LineaChat =>
  ({ tipo: 'trabajo', instante: Date.parse(at), trabajo: { id, destino: LOCAL, destino_titulo: 'Cerebro', destino_cuenta: 'claude5', created_at: at, texto, estado: 'entregado', motivo: null, cierre: null } });
const W = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
const M1 = 'El "Completado" le falta el botón de "Responder sobre esto".';
const M2 = 'Y en "completado" si necesitas poner más de 1 mensaje mio, hazlo.';
const lineas: LineaChat[] = [
  turno('m0', '2026-10-26T11:30:00.000Z', 'Lo de antes del otro «Ya está».', 'yo'),
  turno('y0', '2026-10-26T11:40:00.000Z', 'Ya está: el bloque de las preguntas'),
  turno('m1', '2026-10-26T11:54:00.000Z', M1, 'yo'),
  trabajo(W, '2026-10-26T11:55:00.000Z', M2),
  turno('m2', '2026-10-26T11:55:05.000Z', M2, 'yo', W), // el turno que la PC guardó del trabajo: no se repite
  turno('u1', '2026-10-26T12:30:00.000Z', 'Ya está: el «Completado» con tus mensajes\n\nPruébalo en /admin/operaciones'),
];
const YA = (lineas[5] as Extract<LineaChat, { tipo: 'turno' }>).turno;

test('1. lo que respondía es TODO lo que dijo Martín en el tramo, cada mensaje por su lado, del más viejo al más nuevo', () => {
  assert.deepEqual(pedidosDelCompletado(lineas, YA), [{ texto: M1, de: null }, { texto: M2, de: null }]);
  // Los últimos `TOPE_PEDIDOS_DEL_COMPLETADO`.
  const muchos: LineaChat[] = [
    ...Array.from({ length: TOPE_PEDIDOS_DEL_COMPLETADO + 2 }, (_, i) => turno(`x${i}`, `2026-10-26T12:0${i}:00.000Z`, `mensaje ${i}`, 'yo')),
    turno('u', '2026-10-26T12:30:00.000Z', 'Ya está: listo'),
  ];
  const r = pedidosDelCompletado(muchos, { at: '2026-10-26T12:30:00.000Z' });
  assert.equal(r.length, TOPE_PEDIDOS_DEL_COMPLETADO);
  assert.equal(r[r.length - 1].texto, `mensaje ${TOPE_PEDIDOS_DEL_COMPLETADO + 1}`, 'los últimos, no los primeros');
  // Sin nada suyo en el tramo: lo del otro chat (uno solo), y si tampoco, lo último de Martín de antes.
  const delCerebro: LineaChat[] = [turno('y', '2026-10-26T10:00:00.000Z', 'Ya está: algo'), turno('c', '2026-10-26T10:10:00.000Z', 'Arregla el contador.', 'otro'), turno('u', '2026-10-26T10:30:00.000Z', 'Ya está: el contador')];
  assert.deepEqual(pedidosDelCompletado(delCerebro, { at: '2026-10-26T10:30:00.000Z' }), [{ texto: 'Arregla el contador.', de: 'Cerebro' }]);
  assert.deepEqual(pedidosDelCompletado([lineas[0], turno('u', '2026-10-26T11:45:00.000Z', 'Ya está: otra vez')], { at: '2026-10-26T11:45:00.000Z' }),
    [{ texto: 'Lo de antes del otro «Ya está».', de: null }]);
});

const bloque = (onResponderSobre?: (t: TurnoChat) => void) => renderToStaticMarkup(createElement(BloqueCompletado, {
  chat: { clave: 'nombre:cerebro', sesion: LOCAL, titulo: 'Cerebro' }, lineas, yaVisto: Date.parse('2026-10-26T11:40:00.000Z'),
  onYaVisto: () => {}, hayPreguntas: false, onResponderSobre,
}));

test('2. el bloque dibuja cada mensaje en su globo con su foto, del más viejo al más nuevo', () => {
  const html = bloque(() => {});
  const globos = [...html.matchAll(/<div class="co-preg__ya-pedido"><div class="co-yo"><div class="co-burbuja"><div class="co-preg__ya-pedido-texto">([^<]*)<\/div><\/div><span class="co-mifoto"/g)].map((m) => m[1]);
  assert.deepEqual(globos, [M1, M2].map((t) => t.replace(/"/g, '&quot;')), 'cada mensaje en su cajita con su foto, en orden');
  assert.match(html, /<div class="co-preg__ya-pedidos">/);
  // El mismo bloque en las dos pantallas.
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) assert.match(leer(f), /<BloqueCompletado /, f);
});

test('3. «Responder sobre esto» cita el mensaje arriba de la caja, en el bloque y en la tarjeta del hilo: no escribe en el campo', () => {
  assert.match(bloque(() => {}), /<button type="button" class="co-chip co-preg__ya-responder">.*Responder sobre esto<\/button>/);
  assert.doesNotMatch(bloque(), /co-preg__ya-responder/, 'sin con qué citar, no se ofrece');
  assert.match(sinComentarios(leer('app/admin/operaciones/BloqueCompletado.tsx')), /onClick=\{\(\) => onResponderSobre\(t\)\}/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Avance.tsx')), /onClick=\{\(\) => onFeedback\(t\)\}>Responder sobre esto/, 'la tarjeta del hilo');
  const compu = sinComentarios(leer('app/admin/operaciones/Conversacion.tsx'));
  assert.match(compu, /wa\.onCitar\(\{ de: chat\.titulo, texto: t\.texto, id: idDeLinea\(\{ tipo: 'turno', instante: Date\.parse\(t\.at\), turno: t \}\) \}\);/);
  assert.match(compu, /<BloqueCompletado [^/]*onResponderSobre=\{wa \? feedback : undefined\}/);
  const tel = sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx'));
  assert.match(tel, /k\.citar\(c\.clave, \{ de: c\.titulo, texto: t\.texto, id: idDeLinea\(\{ tipo: 'turno', instante: Date\.parse\(t\.at\), turno: t \}\) \}\);/);
  assert.match(tel, /<BloqueCompletado [^/]*onResponderSobre=\{feedback\}/);
  for (const [f, s] of [['Conversacion.tsx', compu], ['ChatsMovil.tsx', tel]] as const) {
    assert.doesNotMatch(s, /Sobre «\$\{/, `${f}: «Responder sobre esto» volvió a escribir en el campo`);
  }
});

test('4. la API trae el mismo contexto', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'));
  assert.match(run, /contexto: pedidosDelCompletado\(lineas, t\)\.map\(\(x\) => \(\{ de: x\.de \?\? 'Martín', texto: x\.texto \}\)\),/);
});

// PROBADO ROMPIÉNDOLO (26/10/2026, base 4/0): sólo el último mensaje de Martín → 2 rojos (1 y 2); contar el turno que trajo un
// trabajo → 2 rojos (1 y 2); los primeros del tramo en vez de los últimos → 1 rojo (1); el bloque con un solo pedido → 1 rojo (2);
// «Responder sobre esto» escribiendo en el campo (computadora) → 1 rojo (3); lo mismo en el teléfono → 1 rojo (3); el bloque
// sin el botón → 1 rojo (3); la API sin el contexto → 1 rojo (4).
