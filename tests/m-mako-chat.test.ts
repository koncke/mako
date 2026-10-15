// =============================================================================
// /m/mako — el chat de MaKo en el teléfono: lo que decide la pantalla
// =============================================================================
// Probado ROMPIENDO cada pieza (11/10/2026, base en verde: 11 de 11) con un arnés que restaura
// de memoria; cada rotura dio 1 fallo y 10 pases:
//   · leerRespuesta con `reintentable: true` en la red caída / el 5xx.
//   · leerRespuesta sin mirar el 413 (texto plano de Vercel).
//   · itemsDeRespuesta sin saltear el mensaje de la persona (burbuja duplicada).
//   · trasTarjeta tratando `ejecutada` como reintentable.
//   · gestoDelMic con bloquear antes que cancelar.
//   · ChatMako sin `conWs` en la URL del XMLHttpRequest.
//   · page.tsx con maxDuration 60.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  leerRespuesta, itemsDeRespuesta, itemsDeSesion, trasTarjeta, gestoDelMic, medidasAchicadas,
  problemaDeSeleccion, restanteNota, esMicBloqueado, fuenteDelTurno, rotuloPrimario, ERROR_INCIERTO,
  PILL_PROPUESTA, TOPE_NOTA_S,
} from '../app/m/mako/chat-ui';
import { ERROR_ADJUNTO, TOPE_TOTAL_BYTES } from '../lib/mako-adjuntos';
import { GRAMATICA } from '../lib/mako-gramatica';
import type { RespuestaTurno, TarjetaPendiente } from '../lib/mako-turno-app-reglas';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const tarjeta = (id: number): TarjetaPendiente => ({
  pendienteId: id, titulo: 'Agregar una nota a un lead', resumen: 'Nota a Ana: llamó', consecuencia: 'Se puede deshacer',
  escribe: 'leads.notas', deshacer: true, venceAt: '2026-10-11T20:00:00Z', vence: '11-oct, 01:00 p.m.', detalle: [],
});

test('leerRespuesta: el 413 de Vercel (texto plano) se dice como «pesa demasiado»', () => {
  const l = leerRespuesta(413, 'Request Entity Too Large');
  assert.deepEqual(l, { ok: false, error: ERROR_ADJUNTO.pesado, reintentable: true });
});

test('leerRespuesta: un 4xx con su error se puede reintentar; un 500, la red caída o un cuerpo raro, NO', () => {
  assert.deepEqual(leerRespuesta(400, '{"ok":false,"error":"Escribe algo."}'), { ok: false, error: 'Escribe algo.', reintentable: true });
  const cinco = leerRespuesta(500, '{"ok":false,"error":"Algo falló de nuestro lado."}');
  assert.equal(cinco.ok, false);
  assert.equal(!cinco.ok && cinco.reintentable, false);
  const red = leerRespuesta(0, '');
  assert.deepEqual(red, { ok: false, error: ERROR_INCIERTO, reintentable: false });
  assert.equal(leerRespuesta(200, '<html>').ok, false);
});

test('leerRespuesta: un turno que MaKo no pudo contestar (ok:false con 200) es DATO, no error HTTP', () => {
  const l = leerRespuesta<RespuestaTurno>(200, JSON.stringify({ ok: false, aviso: 'No pude contestar.', mensajes: [], paraLaPersona: [], propuestas: [], pantallas: [] }));
  assert.equal(l.ok, true);
});

test('itemsDeRespuesta: no repite el mensaje de la persona; aviso y agenda van aparte; no duplica una propuesta ya vista', () => {
  const r: RespuestaTurno = {
    ok: true, sesion: { id: 1, titulo: null, pinned: false, updatedAt: '' },
    mensajes: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'Te dejé la nota lista.' }],
    aviso: 'No pude leer el archivo.', paraLaPersona: ['Mañana: 10:00 con Ana'],
    propuestas: [tarjeta(7), tarjeta(8)],
    pantallas: [{ clase: 'borrador', titulo: 'Borrador del plan', href: '/m/inbox', escritorio: '/plan/revisar/x' }],
  };
  const xs = itemsDeRespuesta(r, new Set([8]));
  assert.equal(xs.filter((x) => x.k === 'msg').length, 1);
  assert.equal(xs.find((x) => x.k === 'msg' && x.role === 'user'), undefined);
  assert.equal(xs.filter((x) => x.k === 'aviso').length, 2);
  assert.deepEqual(xs.filter((x) => x.k === 'propuesta').map((x) => x.k === 'propuesta' && x.t.pendienteId), [7]);
  assert.equal(xs.filter((x) => x.k === 'pantalla').length, 1);
});

test('itemsDeSesion: las propuestas vigentes van al final del hilo, pendientes', () => {
  const xs = itemsDeSesion([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], [tarjeta(3)]);
  assert.equal(xs.length, 3);
  const ult = xs[2];
  assert.equal(ult.k === 'propuesta' && ult.estado, 'pendiente');
});

test('trasTarjeta: vencida y resuelta se DICEN; lo que se ejecutó y falló no se ofrece de nuevo', () => {
  assert.equal(trasTarjeta({ ok: true, resumen: 'x', paraLaPersona: [] }, 'confirmar').estado, 'hecho');
  assert.equal(trasTarjeta({ ok: true, resumen: 'x', paraLaPersona: [] }, 'confirmar').haptico, 'success');
  assert.equal(trasTarjeta({ ok: true, resumen: 'x', paraLaPersona: [] }, 'cancelar').estado, 'cancelada');
  assert.equal(trasTarjeta({ ok: false, error: 'Ya no está vigente' }, 'confirmar').estado, 'vencida');
  assert.equal(trasTarjeta({ ok: false, error: 'Ya se resolvió' }, 'confirmar').estado, 'resuelta');
  const fallo = trasTarjeta({ ok: false, error: 'Meta rechazó el cambio', ejecutada: true }, 'confirmar');
  assert.equal(fallo.estado, 'fallo');
  assert.match(fallo.frase ?? '', /Se ejecutó y falló/);
  const otra = trasTarjeta({ ok: false, error: 'Solo la confirma un admin' }, 'confirmar');
  assert.equal(otra.estado, null);
  assert.match(otra.frase ?? '', /Solo la confirma un admin/);
});

test('las pills de MaKo salen de GRAMATICA, y el primario nombra la acción y su objeto', () => {
  assert.equal(PILL_PROPUESTA.pendiente.texto, GRAMATICA.aprobacion.rotulo);
  assert.equal(PILL_PROPUESTA.hecho.texto, GRAMATICA.completo.rotulo);
  assert.equal(rotuloPrimario(tarjeta(1)), 'Agregar una nota a un lead');
  assert.equal(rotuloPrimario({ titulo: '  ' }), 'Ejecutar la acción');
});

test('el gesto del micrófono: a la izquierda cancela, arriba bloquea, cancelar gana', () => {
  assert.equal(gestoDelMic(-10, -5), null);
  assert.equal(gestoDelMic(-90, 0), 'cancelar');
  assert.equal(gestoDelMic(0, -80), 'bloquear');
  assert.equal(gestoDelMic(-90, -90), 'cancelar');
  assert.equal(restanteNota(10), null);
  assert.equal(restanteNota(TOPE_NOTA_S - 5), 5);
  assert.equal(restanteNota(TOPE_NOTA_S + 9), 0);
});

test('la foto se achica a 1600 de lado mayor sin agrandar; los topes son los del route', () => {
  assert.deepEqual(medidasAchicadas(4032, 3024), { w: 1600, h: 1200 });
  assert.deepEqual(medidasAchicadas(800, 600), { w: 800, h: 600 });
  assert.deepEqual(medidasAchicadas(0, 600), { w: 0, h: 0 });
  assert.equal(problemaDeSeleccion([1, 2, 3, 4, 5]), ERROR_ADJUNTO.muchos);
  assert.equal(problemaDeSeleccion([TOPE_TOTAL_BYTES, 1]), ERROR_ADJUNTO.pesado);
  assert.equal(problemaDeSeleccion([1000, 2000]), null);
});

test('micrófono bloqueado: se reconoce el texto de los dos caminos (dictado y grabador)', () => {
  assert.equal(esMicBloqueado('El navegador no me dejó usar el micrófono. Habilítalo en el candado de la barra de direcciones.'), true);
  assert.equal(esMicBloqueado('No se pudo acceder al micrófono. Revisa los permisos.'), true);
  assert.equal(esMicBloqueado('No encontré ningún micrófono conectado.'), false);
  assert.equal(fuenteDelTurno([]), 'tus datos');
  assert.equal(fuenteDelTurno([{ tipo: 'document' }]), 'el PDF');
});

test('cableado: maxDuration 420, ?ws= a mano en el XHR, fetch con corte, nunca «escribiendo…»', () => {
  const page = sinComentarios(leer('app/m/mako/page.tsx'));
  // 420 y 425_000 desde la tanda 7 del Web Generator (confirmar replicar_landing por chat): tests/mako-doer-plazo.test.ts.
  assert.match(page, /export const maxDuration = 420;/);
  assert.match(page, /requireMovil\(\{ navKey: 'mako' \}\)/);
  const chat = sinComentarios(leer('app/m/mako/ChatMako.tsx'));
  assert.match(chat, /postConProgreso\(conWs\(RUTA, ws\)/);
  assert.match(chat, /signal: AbortSignal\.timeout\(TOPE_MS\)/);
  assert.match(chat, /const TOPE_MS = 425_000;/);
  assert.doesNotMatch(chat, /escribiendo/i);
  // El plan y el teléfono dictan con el MISMO hook.
  assert.match(sinComentarios(leer('app/plan/board/CrearTareaModal.tsx')), /useDictar\(valor, onValor, onError\)/);
  assert.match(sinComentarios(leer('app/m/mako/Composer.tsx')), /useDictar\(texto,/);
  // /api/plan-dictado devuelve el fallo con 200: se lee j.ok.
  assert.match(sinComentarios(leer('app/_components/useDictar.ts')), /if \(!j\?\.ok\)/);
});
