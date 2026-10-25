// =============================================================================
// Las preguntas de un chat son un FORMULARIO en su conversación (17/10/2026)
// =============================================================================
// Martín: «Ops Center me está preguntando algo y me pide que responda, en lugar de darme las opciones tipo multiple
// select». Lo que se fija (lib/centro-preguntas-chat.ts, lib/centro-chats.ts → historialDelChat, acciones.ts):
//   1. lo que sube la PC se valida y se RECHAZA entero si no vale (nunca se recorta), y nunca llega contestado;
//   2. una pregunta contestada no se pisa con la misma que la PC vuelve a subir;
//   3. la recomendada va primera, con su índice ORIGINAL (el que viaja en la respuesta);
//   4. la respuesta firmada lleva la marca de su pregunta, y la conversación la dibuja ADENTRO de la pregunta;
//   5. el servidor marca contestada sólo con el trabajo firmado que dice EXACTAMENTE lo elegido.
//
// Probado rompiéndolo (17/10/2026, con la base en 0 fallos):
//   · `sanearPreguntas` sin forzar `respuesta: null` → 1 fallo (1);
//   · `unirPreguntas` dejando ganar a la nueva → 1 fallo (2);
//   · `opcionesEnOrden` reindexando → 1 fallo (3);
//   · `historialDelChat` sin esconder el trabajo de la respuesta → 1 fallo (4);
//   · la acción sin comparar el texto firmado → 1 fallo (5).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_TITULO_OPCION, eleccionValida, opcionesEnOrden, preguntaDeTrabajo, resumenDeRespuesta, sanearPregunta, sanearPreguntas,
  textoDeRespuesta, unirPreguntas, type PreguntaChat,
} from '../lib/centro-preguntas-chat';
import { chatsDelCentro, historialDelChat, lineasDeConversacion, vistaPrevia, type CarteroP, type TrabajoP } from '../lib/centro-chats';

const S1 = 'local_11111111-1111-4111-8111-111111111111';
const ID = 'aaaaaaaa-1111-4222-8333-444444444444';
const T1 = 'bbbbbbbb-1111-4222-8333-444444444444';
const subida = (extra: Record<string, unknown> = {}) => ({
  id: ID, local: S1, pregunta: '¿Abro la ventana?', contexto: 'Abre una ventana en tu pantalla.',
  opciones: [{ titulo: 'No, después', detalle: 'Lo hago cuando estés' }, { titulo: 'Sí, ábrela' }], recomendada: 1, at: '2026-10-17T12:00:00Z', ...extra,
});

test('1. lo que sube la PC: se valida entero, se rechaza si no vale, y nunca llega contestado', () => {
  const p = sanearPregunta(subida())!;
  assert.equal(p.pregunta, '¿Abro la ventana?');
  assert.deepEqual(p.opciones, [{ titulo: 'No, después', detalle: 'Lo hago cuando estés' }, { titulo: 'Sí, ábrela', detalle: null }]);
  assert.equal(p.varias, false);
  for (const [mal, por] of [
    [{ opciones: [{ titulo: 'Una sola' }] }, 'menos de dos opciones'],
    [{ opciones: Array.from({ length: 7 }, (_, i) => ({ titulo: `O${i}` })) }, 'más de seis'],
    [{ opciones: [{ titulo: 'x'.repeat(MAX_TITULO_OPCION + 1) }, { titulo: 'b' }] }, 'un título de más: se rechaza, no se recorta'],
    [{ opciones: [{ titulo: 'Sí' }, { titulo: 'sí' }] }, 'dos iguales'],
    [{ recomendada: 2 }, 'una recomendada que no existe'],
    [{ local: 'nombre:crm' }, 'una sesión que no es sesión'],
    [{ id: 'no-es-uuid' }, 'un id que no es uuid'],
  ] as const) assert.equal(sanearPregunta(subida(mal as Record<string, unknown>)), null, por);
  const contestada = { elegidas: [1], otra: null, at: '2026-10-17T12:01:00Z', trabajo: T1 };
  assert.equal(sanearPreguntas([subida({ respuesta: contestada })])[0].respuesta, null, 'la respuesta la pone MaKo, nunca la PC');
  assert.equal(sanearPreguntas([subida(), subida()]).length, 1, 'sin repetir el id');
});

test('2. la que ya se contestó no se pisa con la misma que la PC vuelve a subir', () => {
  const p = sanearPregunta(subida())!;
  const contestada: PreguntaChat = { ...p, respuesta: { elegidas: [1], otra: null, at: '2026-10-17T12:01:00Z', trabajo: T1 } };
  const juntas = unirPreguntas([contestada], sanearPreguntas([subida()]));
  assert.equal(juntas.length, 1);
  assert.deepEqual(juntas[0].respuesta?.elegidas, [1]);
});

test('3. la recomendada primero, con su índice ORIGINAL; y lo elegido se valida', () => {
  const p = sanearPregunta(subida())!;
  assert.deepEqual(opcionesEnOrden(p).map((o) => [o.i, o.titulo, o.recomendada]), [[1, 'Sí, ábrela', true], [0, 'No, después', false]]);
  assert.equal(eleccionValida(p, [0, 1], '').ok, false, 'una sola, si no es «varias»');
  assert.equal(eleccionValida(p, [], '').ok, false, 'algo hay que elegir');
  assert.deepEqual(eleccionValida(p, [], '  mañana  '), { ok: true, elegidas: [], otra: 'mañana' }, 'lo escrito sólo también vale');
  assert.deepEqual(eleccionValida({ ...p, varias: true }, [1, 0, 1], ''), { ok: true, elegidas: [0, 1], otra: null });
});

test('4. la respuesta firmada lleva su marca, y se dibuja ADENTRO de la pregunta', () => {
  const p = sanearPregunta(subida())!;
  const texto = textoDeRespuesta(p, [1], 'y avísame');
  assert.equal(preguntaDeTrabajo(texto), ID);
  assert.match(texto, /^Respuesta a tu pregunta «¿Abro la ventana\?» \[pregunta [0-9a-f-]+\]:\n2\. Sí, ábrela\nOtra: y avísame$/);
  assert.equal(resumenDeRespuesta(p, { elegidas: [1], otra: 'y avísame' }), 'Sí, ábrela · y avísame');

  const carteros: CarteroP[] = [{ cuenta: 'claude1', vistoAt: '2026-10-17T12:05:00Z', chats: [{ local: S1, titulo: 'Ops Center', cuenta: 'claude1', vivo: true, estado: 'idle', actividad: '2026-10-17T12:00:00Z' }] }];
  const trabajo: TrabajoP = { id: T1, destino: S1, destino_titulo: 'Ops Center', destino_cuenta: 'claude1', created_at: '2026-10-17T12:01:00Z', texto, estado: 'entregado', motivo: null, cierre: null };
  const [chat] = chatsDelCentro({ carteros, areas: [], pedidos: [], trabajos: [trabajo], ahora: Date.parse('2026-10-17T12:05:00Z') });
  const lineas = lineasDeConversacion(historialDelChat(chat, new Map(), [trabajo], [], [], [p]));
  assert.deepEqual(lineas.map((l) => l.tipo), ['pregunta'], 'el trabajo de la respuesta no va aparte: con su marca sería ilegible');
  const linea = lineas[0];
  assert.equal(linea.tipo === 'pregunta' ? linea.trabajo?.id : null, T1, 'va adentro de su pregunta');
  assert.equal(vistaPrevia(lineas)?.texto, '¿Abro la ventana?', 'la fila de la lista muestra la pregunta');
});

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('5. el servidor marca contestada sólo con el trabajo firmado que dice lo elegido; la vuelta del Runner las guarda', () => {
  const acc = leer('app/admin/operaciones/acciones.ts');
  const cuerpo = acc.slice(acc.indexOf('export async function contestarPreguntaAction'));
  assert.match(cuerpo, /error: string \}> \{\s*const admin = await getSesionAdmin\(\);\s*if \(!puedeOperar\(/, 'la guarda en la primera línea');
  assert.match(cuerpo, /w\.destino !== local \|\| w\.texto\.trim\(\) !== textoDeRespuesta\(p, v\.elegidas, v\.otra\)/, 'compara lo firmado');
  const ciclo = leer('lib/operaciones.ts');
  assert.match(ciclo, /preguntasIds = await guardarPreguntas\(preguntas, cadena\)/);
  assert.match(ciclo, /cierresIds, turnosOk, preguntasIds \}/, 'la PC sabe cuáles entraron');
});

test('6. la PC y el servidor validan IGUAL: lo que arma `preguntar` lo acepta MaKo tal cual, y lo que una rechaza, la otra también', async () => {
  const { armarPregunta, sesionQuePregunta } = await import('../scripts/operaciones/cartero.mjs');
  assert.equal(sesionQuePregunta({ CLAUDE_CODE_HOST_SESSION_ID: S1 } as unknown as NodeJS.ProcessEnv), S1, 'en la app, su sesión');
  assert.equal(sesionQuePregunta({ CLAUDE_CODE_SESSION_ID: ID } as unknown as NodeJS.ProcessEnv), `cli_${ID}`, 'en la terminal, cli_<id>');
  assert.equal(sesionQuePregunta({} as unknown as NodeJS.ProcessEnv), null);
  const escrito = {
    pregunta: '  ¿Abro   la ventana?  ', contexto: 'Una línea.\r\nOtra línea.', varias: true, recomendada: 0,
    opciones: [{ titulo: 'Sí, ábrela', detalle: 'Ahora' }, { titulo: 'No' }],
  };
  const q = armarPregunta(escrito, S1, new Date('2026-10-17T12:00:00Z'));
  assert.deepEqual(sanearPregunta(q), { ...q, respuesta: null }, 'MaKo la acepta tal cual la armó la PC');
  for (const mal of [
    { ...escrito, opciones: [{ titulo: 'Una' }] },
    { ...escrito, opciones: [{ titulo: 'x'.repeat(MAX_TITULO_OPCION + 1) }, { titulo: 'b' }] },
    { ...escrito, opciones: [{ titulo: 'Sí' }, { titulo: 'SÍ' }] },
    { ...escrito, recomendada: 5 },
    { ...escrito, pregunta: '' },
  ]) {
    assert.throws(() => armarPregunta(mal, S1), Error, 'la PC la rechaza');
    assert.equal(sanearPregunta({ ...mal, id: ID, local: S1, at: '2026-10-17T12:00:00Z' }), null, 'y MaKo también');
  }
});
