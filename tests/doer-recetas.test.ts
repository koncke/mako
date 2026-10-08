// =============================================================================
// En una PREGUNTA, MaKo ofrece la acción; las recetas viajan sólo con su herramienta
// =============================================================================
// EL CASO (07/10/2026, grupo de Brigitte). Una pregunta al doer de WhatsApp son 6 a 8
// pedidos de ~14.500 tokens cada uno, porque el loop re-manda todo en cada paso. Medido
// sobre esa pregunta: viajaban las 7 `proponer_*` viejas más confirmar/cancelar (10.380
// caracteres de esquema) y el protocolo ENTERO de 8.642, con la receta de cargar tareas
// al plan (4.552) en una pregunta del CRM. Decisión de Martín del 08/10/2026: cuando MaKo
// contesta una pregunta, OFRECE la acción y espera el «sí», que llega como `actuar`.
// Medido después: −4.535 tokens por pedido en una pregunta (−31%).
//
// PROBADO ROMPIÉNDOLO (con todo puesto: 5 pasan, 0 fallan). Pasan / fallan:
//   · la receta del plan vuelve a viajar siempre                         -> 4 / 1
//   · RECETA_OFRECER no se agrega en una pregunta                         -> 4 / 1
//   · el «sí» a un ofrecimiento vuelve a caer en `charlar`                -> 4 / 1
//   · un «no» a un ofrecimiento pasa a `actuar`                           -> 4 / 1
//   · el doer deja de filtrar las escrituras en una pregunta              -> 4 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recetasDelTurno } from '../lib/doer-recetas';
import { clasificarIntencion, makoPreguntoAlgo } from '../lib/mako-intencion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Lo que viaja en una pregunta después del recorte: sólo lecturas.
const LECTURAS = new Set(['buscar_leads', 'ficha_lead', 'historial_whatsapp', 'reuniones_lead', 'ver_plan', 'listar_campanas_meta', 'listar_pendientes', 'listar_horarios_reunion']);

test('⚠️ EN UNA PREGUNTA NO VIAJA NINGUNA RECETA DE ESCRITURA, y sí la de ofrecer', () => {
  const r = recetasDelTurno(LECTURAS, true);
  assert.match(r, /OFRECE la acción/, 'en una pregunta MaKo tiene que ofrecer, no armar');
  for (const [que, re] of [
    ['plan', /LISTA DE TAREAS PARA EL PLAN/], ['lead', /CARGAR UNA PERSONA AL CRM/], ['agenda', /AGENDAR O REAGENDAR/],
    ['confirmar', /CUANDO EL DUEÑO CONFIRMA/], ['acciones', /CUANDO TE PIDEN ACCIONES/], ['presupuesto', /EL PRESUPUESTO de una campaña/],
  ] as const) {
    assert.doesNotMatch(r, re, `la receta de ${que} volvió a viajar en una pregunta`);
  }
  // Y que no se infle de vuelta: es lo que se paga en CADA pedido del turno.
  assert.ok(r.length < 1500, `las recetas de una pregunta pesan ${r.length} caracteres`);
});

test('Cada receta viaja con SU herramienta', () => {
  assert.match(recetasDelTurno(new Set(['proponer_tareas_plan']), false), /LISTA DE TAREAS PARA EL PLAN/);
  assert.match(recetasDelTurno(new Set(['proponer_lead']), false), /CARGAR UNA PERSONA AL CRM/);
  assert.match(recetasDelTurno(new Set(['proponer_agendar_reunion']), false), /AGENDAR O REAGENDAR/);
  assert.match(recetasDelTurno(new Set(['confirmar_accion']), false), /CUANDO EL DUEÑO CONFIRMA/);
  assert.match(recetasDelTurno(new Set(['proponer_cambio_etapa']), false), /CUANDO TE PIDEN ACCIONES/);
  assert.match(recetasDelTurno(new Set(['proponer_presupuesto_campana']), false), /EL PRESUPUESTO de una campaña/);
  // Las recetas de plan y lead no arrastran la genérica de acciones.
  assert.doesNotMatch(recetasDelTurno(new Set(['proponer_tareas_plan', 'proponer_lead']), false), /CUANDO TE PIDEN ACCIONES/);
  assert.doesNotMatch(recetasDelTurno(new Set(['proponer_cambio_etapa']), false), /OFRECE la acción/, 'en actuar no se ofrece: se hace');
});

test('makoPreguntoAlgo mira el FINAL del último mensaje de MaKo', () => {
  assert.equal(makoPreguntoAlgo('Rosana entró el 3/10 por el anuncio hook 5. ¿Quieres que la pase a Agendado?'), true);
  assert.equal(makoPreguntoAlgo('Listo, quedó.'), false);
  assert.equal(makoPreguntoAlgo(null), false);
  assert.equal(makoPreguntoAlgo('¿Rosana? ' + 'x'.repeat(400) + ' Eso es todo.'), false, 'una pregunta al principio de un mensaje largo no es un ofrecimiento');
});

test('⚠️ EL «SÍ» A LO QUE MaKo OFRECIÓ ES `actuar`; un «no», charla', () => {
  for (const s of ['sí', 'sí, dale', 'sí, movelo a agendado', 'dale, hacelo', 'ok']) {
    assert.equal(clasificarIntencion(s, { makoPregunto: true }).intencion, 'actuar', `«${s}» no llegó con las herramientas para hacerlo`);
  }
  assert.equal(clasificarIntencion('no, dejalo', { makoPregunto: true }).intencion, 'charlar');
  // Sin ofrecimiento, un «sí» suelto sigue sin herramientas (no puede parir tareas).
  assert.equal(clasificarIntencion('sí, dale', {}).intencion, 'charlar');
  // Con una pendiente, manda la confirmación.
  assert.equal(clasificarIntencion('sí', { hayPendientes: true, makoPregunto: true }).intencion, 'confirmar');
});

test('⚠️ el doer saca las herramientas que ESCRIBEN en una pregunta, y arma las recetas con lo que viajó', () => {
  const src = sinComentarios(leer('../lib/mako-doer-in.ts'));
  // La selección vive en lib/doer-herramientas.ts desde el 08/10/2026 (la misma que usa el
  // test de agenda); el doer la llama y arma las recetas con lo que devolvió.
  const sel = sinComentarios(leer('../lib/doer-herramientas.ts'));
  assert.match(sel, /const ofrece = v\.intencion === 'consultar' \|\| v\.intencion === 'pensar'/);
  assert.match(sel, /\.filter\(\(t\) => !ofrece \|\| !escribe\(t\.name\)/, 'en una pregunta vuelven a viajar las escrituras');
  assert.match(src, /const \{ tools, ofrece \} = turno;/, 'el doer dejó de usar lo que eligió la selección');
  assert.match(src, /recetasDelTurno\(permitidasDelTurno, ofrece\)/, 'las recetas dejaron de salir de lo que viajó');
  assert.match(src, /makoPregunto: makoPreguntoAlgo\(/, 'el clasificador no sabe si MaKo ofreció algo');
});
