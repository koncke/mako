// =============================================================================
// Lo que Meta manda se guarda ENTERO, y una ingesta posterior no lo borra
// =============================================================================
// `parseLeadFields` saca CUATRO campos de `field_data` por palabra clave y hasta el
// 04/10/2026 tiraba el resto sin dejar ni un `console.warn`. Hoy no se pierde nada
// real —el único formulario que recibió leads pregunta exactamente esos cuatro—,
// pero el ws13 tiene CINCO formularios con preguntas personalizadas y cero leads:
// el día que entre el primero, esa respuesta no tiene columna y **Meta la borra a
// los 90 días**. Es el único dato de esta familia que no se vuelve a pedir.
//
// Este archivo fija las DOS mitades del arreglo, porque cada una se apaga sola sin
// que nada falle:
//
//   1. lo que entra se guarda entero (`meta_field_data`) con la fecha REAL de Meta
//      (`meta_created_at`), por los DOS caminos de ingesta — el webhook y el poll;
//   2. una ingesta posterior SIN respuestas no pisa lo guardado. El mecanismo es
//      que la clave no viaje en el payload: escrita como `input.x ?? null` —que es
//      la forma natural, y lo que hacen las otras cinco columnas de Meta de al
//      lado— el UPDATE le borra al lead lo que Meta ya no tiene.
//
// Y la tercera, que es la regla de la casa: lo que el saneador descarta queda
// ESCRITO, con motivo. Sin eso, «no llegó» y «lo tiramos nosotros» se ven iguales.
//
// ⚠️ PROBADO ROMPIÉNDOLO, cinco veces. Con el arreglo puesto: 12 pases, 0 fallos.
// Cada rotura da **1 fallo y 11 pases**, y cada una la caza un test distinto — que es
// lo que importa: un guard que junta todo dice que algo se rompió y no cuál.
//   · `columnasCrudasDeMeta` escribe la clave SIEMPRE (`entra.fieldData ?? null`)
//       → falla «sin respuestas, la clave NO viaja: lo guardado gana porque nadie lo pisa»
//   · en lib/leads.ts el spread se cambia por `meta_field_data: input.meta_field_data ?? null`
//       → falla «el choke point de escritura NO escribe las crudas a mano»
//   · al webhook se le saca `created_time` del `fields` de Graph
//       → falla «el webhook se lo PIDE a Graph»
//   · al poll se le saca la línea `meta_field_data: lr.field_data ?? null`
//       → falla «los dos caminos de ingesta pasan las crudas y los descartes al upsert»
//   · `parseLeadFields` devuelve `noReconocidos: []` fijo
//       → falla «el descarte queda NOMBRADO: las preguntas propias salen por noReconocidos»
//
// ⚠️ Y la primera corrida falló por SU PROPIA medición: el guard de que el módulo del
// parser no tenga `server-only` leía el archivo ENTERO, y el encabezado de ese módulo
// explica en prosa por qué no lo tiene. 11 pases y 1 fallo, con el código correcto.
// Ante un guard nuevo que acusa, la primera hipótesis es el guard.
//
// ⚠️ Y los guards que leen fuente RECORTAN el bloque de `upsertLeadFromMeta` antes
// de preguntar: un `readFileSync` del archivo entero encontraría la palabra
// `meta_field_data` en el tipo `Lead`, en la firma y en tres comentarios, y daría
// verde sobre el mapper roto.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseLeadFields,
  columnasCrudasDeMeta,
  fechaDeMeta,
  rastroDescartes,
  tieneRespuestas,
  TOPE_RASTRO,
  NOMBRE_SIN_NOMBRE,
  type MetaFieldData,
} from '../lib/meta-leads-campos';

const raiz = (p: string) => join(import.meta.dirname, '..', p);
const leer = (p: string) => readFileSync(raiz(p), 'utf8');

/** Sin la prosa: un guard que lee el archivo entero encuentra lo que el archivo dice de sí. */
const soloCodigo = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * El cuerpo de una función exportada, cortado en el `export` SIGUIENTE y no a N
 * caracteres: un recorte a ojo se come la función de al lado y contesta sobre otra
 * cosa. Se afirma además el largo, así que si mañana mide el triple, el guard
 * avisa en vez de mirar medio archivo.
 */
function bloqueExportado(src: string, nombre: string): string {
  const limpio = soloCodigo(src);
  const ini = limpio.indexOf(`export async function ${nombre}(`);
  assert.ok(ini >= 0, `no encontré export async function ${nombre}( : ¿se renombró?`);
  const sig = limpio.indexOf('\nexport ', ini + 1);
  const bloque = limpio.slice(ini, sig > 0 ? sig : undefined);
  assert.ok(bloque.length < 6000, `el bloque de ${nombre} mide ${bloque.length}: el guard está mirando otra cosa`);
  return bloque;
}

// ── El formulario del ws13, tal como Meta lo manda ──────────────────────────
// Dos campos de contacto que el parser SÍ reconoce y dos preguntas propias que no.
const FORM_WS13: MetaFieldData = [
  { name: 'full_name', values: ['Brigitte Alvarez'] },
  { name: 'phone_number', values: ['+5491122334455'] },
  { name: 'en_que_plazo_busca_vender', values: ['En 3 meses'] },
  { name: 'cual_es_su_situacion_actual', values: ['Ya tengo la propiedad publicada'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// 1) Lo que entra se guarda ENTERO
// ─────────────────────────────────────────────────────────────────────────────

test('una pregunta personalizada viaja entera a meta_field_data, con los 4 campos ya extraídos', () => {
  const contacto = parseLeadFields(FORM_WS13);
  assert.equal(contacto.nombre, 'Brigitte Alvarez');
  assert.equal(contacto.telefono, '+5491122334455');

  const columnas = columnasCrudasDeMeta({ fieldData: FORM_WS13, createdTime: '2026-08-05T14:02:00+0000' });
  assert.deepEqual(columnas.meta_field_data, FORM_WS13,
    'el field_data se guarda TAL COMO lo manda Meta: a los 90 días no se puede volver a pedir');
  assert.equal(columnas.meta_created_at, new Date('2026-08-05T14:02:00+0000').toISOString());
});

test('el descarte queda NOMBRADO: las preguntas propias salen por `noReconocidos`', () => {
  const { noReconocidos } = parseLeadFields(FORM_WS13);
  assert.deepEqual(noReconocidos, ['en_que_plazo_busca_vender', 'cual_es_su_situacion_actual'],
    'sin esto, «no llegó» y «lo tiramos nosotros» se ven iguales');

  // Lo que el parser SÍ usa no se acusa de descartado: con dos listas de keywords,
  // la que se queda vieja acusa a un campo que el parser leyó.
  assert.deepEqual(parseLeadFields([
    { name: 'email', values: ['a@b.com'] },
    { name: 'full_name', values: ['Ana'] },
    { name: 'phone_number', values: ['123'] },
    { name: 'company_name', values: ['ACME'] },
  ]).noReconocidos, []);
});

test('un formulario sin nombre sigue entrando, y no inventa un descarte', () => {
  const r = parseLeadFields([{ name: 'email', values: ['a@b.com'] }]);
  assert.equal(r.nombre, NOMBRE_SIN_NOMBRE);
  assert.deepEqual(r.noReconocidos, []);
  assert.deepEqual(parseLeadFields(undefined).noReconocidos, []);
});

test('la línea del historial nombra las preguntas y se topea; sin descartes NO hay línea', () => {
  assert.equal(rastroDescartes([]), null, 'no se escribe una línea para decir que no pasó nada');
  assert.equal(rastroDescartes(['  ', '']), null);
  assert.equal(
    rastroDescartes(['en_que_plazo_busca_vender', 'cual_es_su_situacion_actual']),
    'Sin columna: en_que_plazo_busca_vender, cual_es_su_situacion_actual',
  );
  const largo = rastroDescartes(Array.from({ length: 20 }, (_, i) => `pregunta_muy_larga_numero_${i}`));
  assert.ok(largo && largo.length <= TOPE_RASTRO, `una fila de una lista se topea en ${TOPE_RASTRO}`);
  assert.ok(largo!.endsWith('…'));
});

test('fechaDeMeta: ISO de Graph, entero del webhook, y una fecha ilegible es null', () => {
  assert.equal(fechaDeMeta('2026-08-05T14:02:00+0000'), new Date('2026-08-05T14:02:00+0000').toISOString());
  // El cuerpo del webhook manda created_time en SEGUNDOS, no en milisegundos.
  assert.equal(fechaDeMeta(1770300120), new Date(1770300120 * 1000).toISOString());
  for (const malo of [null, undefined, '', 'ayer']) {
    assert.equal(fechaDeMeta(malo), null,
      'un Invalid Date reventaría el insert del lead entero por un campo de atribución');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) Una ingesta posterior SIN respuestas no borra lo guardado
// ─────────────────────────────────────────────────────────────────────────────

test('sin respuestas, la clave NO viaja: lo guardado gana porque nadie lo pisa', () => {
  for (const vacio of [undefined, null, [] as MetaFieldData]) {
    const columnas = columnasCrudasDeMeta({ fieldData: vacio, createdTime: null });
    assert.equal('meta_field_data' in columnas, false,
      'con la clave presente (aunque sea null) el UPDATE le borra al lead lo que Meta ya no tiene');
    assert.equal('meta_created_at' in columnas, false);
  }
  // Y traerlas SÍ pisa: una ingesta con respuestas es información nueva.
  assert.deepEqual(columnasCrudasDeMeta({ fieldData: FORM_WS13 }).meta_field_data, FORM_WS13);
});

test('«no lo mandó» y «mandó vacío» son lo mismo para esta columna, y `[]` no cuenta', () => {
  assert.equal(tieneRespuestas(undefined), false);
  assert.equal(tieneRespuestas(null), false);
  assert.equal(tieneRespuestas([]), false);
  assert.equal(tieneRespuestas(FORM_WS13), true);
});

test('el choke point de escritura NO escribe las crudas a mano: pasa por columnasCrudasDeMeta', () => {
  const bloque = bloqueExportado(leer('lib/leads.ts'), 'upsertLeadFromMeta');
  assert.match(bloque, /\.\.\.columnasCrudasDeMeta\(/,
    'las dos columnas crudas entran por la función que decide si la clave viaja');
  assert.doesNotMatch(bloque, /meta_field_data\s*:/,
    'un `meta_field_data: input.meta_field_data ?? null` acá le BORRA al lead las respuestas en el UPDATE');
  assert.doesNotMatch(bloque, /meta_created_at\s*:/,
    'lo mismo con la fecha: pisarla con null es perder cuándo creó Meta el lead');
  // Y el descarte termina en el historial, no en una pantalla nueva.
  assert.match(bloque, /logLeadEvent\(/,
    'lo que el parser no reconoció queda escrito donde alguien lo lee: el historial del lead');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) Los DOS caminos de ingesta, no uno
// ─────────────────────────────────────────────────────────────────────────────

const CAMINOS: Array<{ archivo: string; como: string }> = [
  { archivo: 'app/api/webhooks/meta-leads/route.ts', como: 'el webhook (tiempo real)' },
  { archivo: 'lib/meta-leads.ts', como: 'el poll (la red de seguridad)' },
];

test('los dos caminos de ingesta pasan las crudas y los descartes al upsert', () => {
  for (const { archivo, como } of CAMINOS) {
    const src = soloCodigo(leer(archivo));
    assert.match(src, /meta_field_data:/, `${como} no manda meta_field_data: la respuesta se descarta igual (${archivo})`);
    assert.match(src, /meta_created_at:/, `${como} no manda meta_created_at: el lead nace con la fecha de la ingesta (${archivo})`);
    assert.match(src, /meta_campos_no_reconocidos:/, `${como} no manda los descartes: no quedan escritos (${archivo})`);
    assert.match(src, /noReconocidos/, `${como} no lee los descartes del parser (${archivo})`);
  }
});

test('el webhook se lo PIDE a Graph: sin `created_time` en los fields, la respuesta no lo trae', () => {
  const src = soloCodigo(leer('app/api/webhooks/meta-leads/route.ts'));
  const fields = src.match(/searchParams\.set\('fields',\s*'([^']+)'\)/);
  assert.ok(fields, 'no encontré el `fields` de la llamada a Graph: ¿se reescribió la request?');
  const pedidos = fields![1].split(',').map((x) => x.trim());
  for (const campo of ['field_data', 'created_time']) {
    assert.ok(pedidos.includes(campo), `el webhook no le pide ${campo} a Graph: la columna nace vacía por este camino`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) La migración y el módulo que la hace testeable
// ─────────────────────────────────────────────────────────────────────────────

test('la migración agrega las dos columnas sin default: «no aplica» no es «vacío»', () => {
  const sql = leer('supabase/migrations/0187_meta_field_data.sql')
    .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  assert.match(sql, /add column if not exists meta_field_data jsonb/);
  assert.match(sql, /add column if not exists meta_created_at timestamptz/);
  assert.doesNotMatch(sql, /\bdefault\b/i,
    'un default les pondría a los 1.500 leads que ya existen una respuesta vacía con cara de medida');
  assert.doesNotMatch(sql, /\bupdate leads\b/i,
    'está medido que no hay nada que rescatar: el único formulario con leads pregunta esos 4 campos');
});

test('el módulo del parser sigue SIN `server-only`, o este archivo no puede correr', () => {
  // Sin la prosa: el propio encabezado de ese módulo EXPLICA por qué no lo tiene,
  // así que un guard sobre el archivo entero se acusa a sí mismo. Pasó en la primera
  // corrida de este archivo: 11 pases y 1 fallo, y el que estaba mal era el guard.
  assert.doesNotMatch(soloCodigo(leer('lib/meta-leads-campos.ts')), /server-only/,
    'con `server-only` puesto, importarlo desde npm test revienta y estas 11 pruebas dejan de medir nada');
});
