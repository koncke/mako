// =============================================================================
// El lead en una automatización, en el CRM: el chip de la tarjeta, «Frenar» y la ficha (22/10/2026)
// =============================================================================
// Martín: «en el CRM debería indicar en la tarjeta o en algún lugar que esos leads están en una automatización activa, y
// que desde el CRM también se pueda frenar». Es para el Sprint de Mauricio (la #289 le escribe sola a quien entra a
// «Prospección activa»). Los datos y el frenar son de Automations; la pantalla, de acá (app/crm/automatizacion-lead.ts).
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · el chip en «mako» con la automatización en pausa (`corre` sin mirar `automatizacionActiva`)      → 3 / 1
//   · la pregunta de «Frenar» sin decir que no se deshace                                             → 3 / 1
//   · el tablero pidiendo las automatizaciones de a uno (sin las tandas de 500)                       → 3 / 1
//   · el chip de la tarjeta sólo si se eligió en «Personalizar tarjetas» (adentro de `chip(c)`)        → 3 / 1
//   · el lote frenando a TODOS los tildados en vez de a los que están en una automatización            → 3 / 1
//   · la ficha sin el «Frenar» de cada automatización                                                 → 3 / 1
// Correr: node --import tsx --test tests/crm-automatizacion-lead.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chipDeAutomatizacion, corre, enTandasDe, lineaDeAutomatizacion, preguntaDeFrenar, TANDA_AUTOMATIZACIONES } from '../app/crm/automatizacion-lead';
import { opcionesCrm, OPCION_CRM, type ContextoCrm } from '../app/crm/menu-contextual-crm';
import type { EnAutomatizacion } from '../lib/automatizaciones-del-lead-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const SPRINT: EnAutomatizacion = {
  secuenciaId: 289, nombre: 'Sprint · apertura', automatizacionActiva: true, estado: 'activa',
  paso: { numero: 2, titulo: '«Hola, soy Mauricio…»' }, proximoEnvioAt: '2026-10-23T13:00:00Z', link: '/automations?sec=289',
};

test('el chip: «En automatización» si le corre alguna; gris si está en pausa o frenada porque respondió; nada sin ninguna', () => {
  assert.equal(chipDeAutomatizacion(undefined), null);
  assert.equal(chipDeAutomatizacion([]), null);
  assert.deepEqual(chipDeAutomatizacion([SPRINT]), { texto: 'En automatización', tono: 'mako', detalle: '«Sprint · apertura» · «Hola, soy Mauricio…»' });
  assert.equal(chipDeAutomatizacion([SPRINT, { ...SPRINT, secuenciaId: 30, nombre: 'Reactivación' }])?.texto, 'En 2 automatizaciones');
  const pausada = { ...SPRINT, automatizacionActiva: false };
  assert.equal(corre(pausada), false, 'una pausada no le corre');
  assert.deepEqual(chipDeAutomatizacion([pausada]), { texto: 'Automatización en pausa', tono: 'gris', detalle: '«Sprint · apertura» · «Hola, soy Mauricio…» · la automatización está en pausa' });
  assert.equal(chipDeAutomatizacion([{ ...SPRINT, estado: 'respondio' }])?.texto, 'Respondió: frenada');
  // Sin dato, no se dice nada (24/10/2026; antes, «paso sin ubicar»: un «falta» que no ayuda a nadie).
  assert.equal(lineaDeAutomatizacion({ ...SPRINT, paso: null }), '«Sprint · apertura»');
});

test('«Frenar» pregunta antes, nombrando a quién y de dónde, y dice que no se deshace', () => {
  assert.deepEqual(preguntaDeFrenar({ leads: 1, nombre: 'Ana', auts: [SPRINT] }), {
    // 24/10/2026: decía «Para que vuelva, se lo inscribe a mano», y una frenada no se reabre ni a mano.
    titulo: '¿Frenar a Ana en «Sprint · apertura»?', mensaje: 'No le sale nada más, y no se puede volver a empezar.',
  });
  assert.deepEqual(preguntaDeFrenar({ leads: 12 }), { titulo: '¿Frenar a 12 leads?', mensaje: 'No les sale nada más, y no se puede volver a empezar.' });
  assert.equal(preguntaDeFrenar({ leads: 1, nombre: 'Ana', auts: [SPRINT, SPRINT] }).titulo, '¿Frenar a Ana en sus 2 automatizaciones?');
  // El clic derecho: «Frenar automatización» sólo si está en una; en el lote, si alguno de los tildados lo está.
  const uno: ContextoCrm = { sobre: 'tarjeta', conWhatsapp: false, conTelefono: false, conEmail: false, seleccionado: false, seleccionados: 0, hayEquipo: false, hayOtroFunnel: false };
  assert.ok(!opcionesCrm(uno).includes('frenar_automatizacion'));
  assert.ok(opcionesCrm({ ...uno, enAutomatizacion: true }).includes('frenar_automatizacion'));
  const lote: ContextoCrm = { ...uno, seleccionado: true, seleccionados: 5 };
  assert.ok(!opcionesCrm(lote).includes('lote_frenar'));
  assert.ok(opcionesCrm({ ...lote, loteEnAutomatizacion: 2 }).includes('lote_frenar'));
  assert.deepEqual(OPCION_CRM.frenar_automatizacion, { texto: 'Frenar automatización', icono: 'pausar', peligro: true });
});

test('el tablero: una lectura en tandas de 500, el chip SIEMPRE, la fila de la ficha rápida y el clic derecho', () => {
  assert.equal(TANDA_AUTOMATIZACIONES, 500);
  assert.deepEqual(enTandasDe(Array.from({ length: 1142 }, (_, i) => i)).map((t) => t.length), [500, 500, 142]);
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(b, /for \(const tanda of enTandasDe\(ids\)\) \{\s*const r = await enAutomatizacionesAction\(tanda\)\.catch\(\(\) => null\);\s*if \(!vivo \|\| r === null\) return;/);
  assert.match(b, /\}, \[idsTablero, versionAut\]\);/, 'después de frenar no se vuelve a leer');
  // El chip va después de los elegidos: es un estado, no un dato que se elige mostrar.
  assert.match(b, /const aut = chipDeAutomatizacion\(enAut\.get\(l\.id\)\);/);
  assert.match(b, /\{csChicos\.map\(\(c\) => <Fragment key=\{c\}>\{chip\(c\)\}<\/Fragment>\)\}\{aut && <span className=\{`tk-chip tk-chip--\$\{aut\.tono\}`\} data-en-automatizacion title=\{aut\.detalle\}>\{aut\.texto\}<\/span>\}/);
  assert.match(b, /\.\.\.\(enAut\.get\(l\.id\) \?\? \[\]\)\.map\(\(a\) => \(\{ k: 'Automatización', v: lineaDeAutomatizacion\(a\) \}\)\),/, 'la ficha rápida no lo dice (el teléfono no tiene `title`)');
  assert.match(b, /enAutomatizacion: enAut\.has\(id\),\s*loteEnAutomatizacion: elegidos\.filter\(\(x\) => enAut\.has\(x\.id\)\)\.length,/);
  assert.match(b, /case 'frenar_automatizacion': if \(l\) setFrenarUno\(l\); return;/);
  assert.match(b, /const r = await frenarLeadsEnAutomatizacionesAction\(\[l\.id\]\);/);
  assert.match(b, /<Confirm title=\{q\.titulo\} message=\{q\.mensaje\} confirmLabel="Frenar" tone="danger"/);
});

test('la barra de lote frena a los tildados que están en una automatización; la ficha, cada una con su «Frenar»', () => {
  const lote = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  assert.match(lote, /const idsEnAut = elegidos\.filter\(\(l\) => l\.enAutomatizacion\)\.map\(\(l\) => l\.id\);/);
  assert.match(lote, /const r = await frenarLeadsEnAutomatizacionesAction\(idsEnAut\);/, 'el lote frena a quien no está en ninguna');
  assert.match(lote, /\{idsEnAut\.length > 0 && \(\s*<button type="button" className="mk-icon-btn" data-tone="bad" data-frenar-lote/);
  assert.match(lote, /frenar: \(\) => \{ if \(idsEnAut\.length\) setPide\(\{ tipo: 'frenar' \}\); \},/);
  // ⚠️ REESCRITO EL 23/10/2026: el bloque se mudó de ./charla.tsx a ./automatizaciones.tsx (Martín: «un bloque... relacionado a
  //    las automatizaciones... para tener más claridad de lo que pasa»), y lee y frena por ./automatizaciones-datos.ts.
  // (24/10/2026: la tarjeta, pura, en ./tarjeta-automatizacion.tsx; el bloque la arma y frena.)
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/resumen/automatizaciones.tsx') + '\n' + leer('app/crm/lead-view/ficha/resumen/tarjeta-automatizacion.tsx'));
  // 24/10/2026, el rediseño: «Frenar» es un texto rojo a la izquierda del pie (tests/ficha-automatizaciones-tarjeta.test.ts).
  assert.match(ficha, /<button type="button" className="fr-aut-frenar" onClick=\{onFrenar\}>Frenar<\/button>/);
  assert.match(ficha, /onFrenar=\{\(\) => \{ setError\(null\); setAccion\(\{ tipo: 'frenar', aut: a \}\); \}\}/);
  assert.match(ficha, /\? await frenarDelBloque\(ctx\.lead\.id, aut\.secuenciaId\)/);
  assert.match(sinComentarios(leer('app/crm/lead-view/ficha/resumen/automatizaciones-datos.ts')), /return frenarEnAutomatizacionAction\(leadId, secuenciaId\);/);
  // 24/10/2026 (Martín: «No es funcional», y después «rediseñala, no sólo el texto»): la tarjeta cuenta lo que le pasó en
  // un riel (`rielDeTarjeta`), no el «Paso 5 de 9: CRON» del lienzo. Ver tests/ficha-automatizaciones-tarjeta.test.ts.
  assert.match(ficha, /const riel = rielDeTarjeta\(a, en\.noEntro, \{ todo, ahoraMs: en\.ahora \}\);/, 'la ficha no dice qué le pasó al lead');
  assert.doesNotMatch(ficha, /lineaDelPaso\(a\)/, 'la ficha vuelve a mostrar el paso con el nombre del lienzo');
});
