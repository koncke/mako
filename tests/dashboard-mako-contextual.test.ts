// =============================================================================
// El clic derecho en toda la tab, y el botón de MaKo selectivo y editable en el lugar (Dashboard, 13/10/2026)
// =============================================================================
// Martín, textual: «implementes el click derecho en toda la tab, con diferentes acciones... Y que el botón de la IA de
// MaKo NO se abra al estar en modo edición, sino que se pueda editar allí justamente... Que se pueda editar el prompt, lo
// que debe responder, eliminar el botón de IA de ese grafico, etc... Y por favor, borra ese botón de la mayoría de
// gráficos, es muy molesto que esté en todos. Se selectivo.»
// Piezas: `makoPorDefecto`/`conMako` y `makoIA` (lib/graficos-catalogo.ts), app/dashboard/EditorMako.tsx,
// app/dashboard/MenuContextual.tsx y su cableado en app/dashboard/EditorInforme.tsx.
// Probado ROMPIÉNDOLO: los números, en el comentario de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conMako, makoPorDefecto, sanearGrafico, MAX_SUGERENCIAS_MAKO, TOPE_PEDIDO_MAKO, type Grafico } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '../lib/graficos-plantillas';
import { contextoDeGrafico } from '../app/dashboard/exportar';
import { OPCION, opcionesContextuales, type ContextoMenu, type IdOpcion } from '../app/dashboard/MenuContextual';
import { sugerenciasDeTexto } from '../app/dashboard/EditorMako';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const g = (o: Record<string, unknown>) => sanearGrafico({ id: 'g1', clase: 'grafico', fuente: 'leads', metricas: ['leads'], ...o })!;

// ── Selectivo ────────────────────────────────────────────────────────────────────────────────

// Roturas: `makoPorDefecto` que devuelve true siempre → 2 fallos (éste y el de las plantillas). Sin la condición
// «en el tiempo» → 1 fallo (éste: las columnas por etapa lo llevaban).
test('el botón de MaKo de entrada: sólo tendencias en el tiempo, embudos y dispersión; lo elegido gana', () => {
  assert.equal(makoPorDefecto(g({ tipo: 'numero' })), false, 'un número suelto');
  assert.equal(makoPorDefecto(g({ tipo: 'tabla', dimension: 'etapa' })), false, 'una tabla');
  assert.equal(makoPorDefecto(g({ tipo: 'circular', dimension: 'etapa' })), false, 'una torta');
  assert.equal(makoPorDefecto(g({ tipo: 'columnas', dimension: 'etapa' })), false, 'columnas por una categoría');
  assert.equal(makoPorDefecto(g({ tipo: 'columnas', dimension: 'mes' })), true, 'columnas por mes: una tendencia');
  assert.equal(makoPorDefecto(g({ tipo: 'serie', dimension: 'dia' })), true);
  assert.equal(makoPorDefecto(g({ tipo: 'embudo', metricas: ['leads', 'agendas'] })), true);
  assert.equal(makoPorDefecto(g({ tipo: 'dispersion', dimension: 'campana', metricas: ['leads', 'agendas'] })), true);
  assert.equal(conMako(g({ tipo: 'numero', mako: true })), true, 'prendido a mano en un número');
  assert.equal(conMako(g({ tipo: 'serie', dimension: 'dia', mako: false })), false, 'apagado a mano en una tendencia');
});

test('en las plantillas, la MAYORÍA de los gráficos va sin botón (y alguno lo lleva)', () => {
  const graficos = PLANTILLAS_HOJA.flatMap((p) => instanciarPlantilla(p).componentes.filter((c): c is Grafico => c.clase === 'grafico'));
  const con = graficos.filter(conMako).length;
  assert.ok(con > 0, 'ninguno lo lleva: «se selectivo» no es «sacalo de todos»');
  assert.ok(con / graficos.length < 0.4, `${con} de ${graficos.length} lo llevan: no es la minoría`);
});

// ── Lo que responde ──────────────────────────────────────────────────────────────────────────

// Rotura: `sanearGrafico` sin copiar `makoIA` → 2 fallos (éste y el del contexto).
test('lo que responde y las sugerencias se guardan con su tope; vacío del todo, nada', () => {
  const largo = 'x'.repeat(TOPE_PEDIDO_MAKO + 50);
  const c = g({ tipo: 'serie', dimension: 'dia', mako: true, makoIA: { pedido: `  ${largo}  `, sugerencias: ['¿Por qué?', '¿Por qué?', ' ', 'a', 'b', 'c', 'd'] } });
  assert.equal(c.mako, true);
  assert.equal(c.makoIA?.pedido.length, TOPE_PEDIDO_MAKO);
  assert.deepEqual(c.makoIA?.sugerencias, ['¿Por qué?', 'a', 'b', 'c'].slice(0, MAX_SUGERENCIAS_MAKO));
  assert.equal(g({ tipo: 'numero', makoIA: { pedido: ' ', sugerencias: [] } }).makoIA, undefined);
  assert.deepEqual(sugerenciasDeTexto('uno\n\n uno \ndos\ntres\ncuatro\ncinco'), ['uno', 'dos', 'tres', 'cuatro']);
});

test('el chat de MaKo recibe lo que quien armó el gráfico le pidió que responda', () => {
  const r = { columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' as const }], filas: [], totales: [12], fuera: 0, clase: null };
  const ef = { desde: '2026-10-01', hasta: '2026-10-13', filtros: [] };
  const con = contextoDeGrafico(g({ tipo: 'numero', makoIA: { pedido: 'Por qué bajó', sugerencias: [] } }), r, ef);
  assert.match(con, /pide que respondas, antes que nada: «Por qué bajó»/);
  assert.doesNotMatch(contextoDeGrafico(g({ tipo: 'numero' }), r, ef), /pide que respondas/);
});

// ── El clic derecho ──────────────────────────────────────────────────────────────────────────

const ctx = (o: Partial<ContextoMenu>): ContextoMenu => ({ sobre: 'lienzo', editando: false, guardable: true, soloMirar: false, compartido: false, ...o });

// Roturas: el link compartido con menú propio → 1 fallo. «Eliminar» mirando → 1 fallo. «Preguntarle a MaKo» sin datos
// → 1 fallo. «Conectar» adentro de un pop-up → 1 fallo.
test('qué opciones salen según dónde y en qué modo', () => {
  assert.deepEqual(opcionesContextuales(ctx({ compartido: true })), [], 'en un link compartido sale el menú del navegador');
  assert.deepEqual(opcionesContextuales(ctx({ soloMirar: true, sobre: 'grafico' })), ['csv', 'pdf'], 'el closer sólo exporta');
  const mirando = [...opcionesContextuales(ctx({ sobre: 'grafico', conMako: true, conDatos: true })), ...opcionesContextuales(ctx({ sobre: 'lienzo', puedeNuevaHoja: true }))];
  assert.ok(!mirando.includes('borrar') && !mirando.includes('duplicar'), 'mirando no se borra ni se cambia nada');
  assert.ok(mirando.includes('mako_chat') && mirando.includes('copiar_dashboard') && mirando.includes('nueva_hoja'));
  assert.ok(!opcionesContextuales(ctx({ sobre: 'grafico', conMako: true, conDatos: false })).includes('mako_chat'), 'sin datos no hay qué preguntar');
  const editandoG = opcionesContextuales(ctx({ sobre: 'grafico', editando: true, conMako: true }));
  assert.equal(editandoG[editandoG.length - 1], 'borrar', '«Eliminar» va al final');
  assert.equal(editandoG[editandoG.length - 2], null, 'y separado');
  assert.ok(editandoG.includes('mako_config') && editandoG.includes('mako_quitar') && !editandoG.includes('mako_agregar'));
  assert.ok(opcionesContextuales(ctx({ sobre: 'grafico', editando: true, conMako: false })).includes('mako_agregar'));
  assert.ok(!opcionesContextuales(ctx({ sobre: 'grafico', editando: true, enPopup: true })).includes('conectar'), 'en un pop-up no hay conectores');
  assert.deepEqual(opcionesContextuales(ctx({ editando: true })), ['agregar_grafico', 'insertar_texto', 'estilo', null, 'terminar']);
});

// Rotura: sacar un `case` del switch de `elegirContextual` → 1 fallo (una opción que se dibuja y no hace nada).
test('cada opción del menú tiene su acción en la pantalla (ninguna se dibuja muerta)', () => {
  const editor = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  const ini = editor.indexOf('const elegirContextual = ');
  const fn = editor.slice(ini, editor.indexOf('\n  };', ini));
  assert.ok(ini > 0 && fn.length > 200, 'no encontré elegirContextual');
  for (const id of Object.keys(OPCION) as IdOpcion[]) assert.match(fn, new RegExp(`case '${id}':`), `«${OPCION[id].texto}» no hace nada`);
});

// Roturas: sin la guarda de `defaultPrevented` → 1 fallo (el clic derecho de una hoja del desplegable abría el otro menú).
// Sin la de los campos de texto → 1 fallo.
test('el clic derecho cubre la tab entera y no le roba el suyo a un campo de texto ni a un menú que ya tiene el propio', () => {
  const editor = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(editor, /<div className=\{`lk lk-app[^`]*`\} onContextMenu=\{alClicDerecho\}>/);
  const fn = editor.slice(editor.indexOf('const alClicDerecho = '), editor.indexOf('const elegirContextual = '));
  assert.match(fn, /if \(e\.defaultPrevented \|\| t\.closest\('\[role="menu"\], \[role="dialog"\], \[role="listbox"\], \.lk-flotante'\)\) return;/);
  assert.match(fn, /if \(t\.closest\('input, textarea, select, \[contenteditable="true"\], \[contenteditable=""\]'\)\) return;/);
  assert.match(fn, /e\.preventDefault\(\);/);
});

// Rotura: «Quitar el botón» que escribe `makoIA` vacío en vez de `mako: false` → 1 fallo.
test('el editor del botón de MaKo: lo que responde, las sugerencias y quitarlo; el panel usa la misma regla', () => {
  const ed = sinComentarios(leer('app/dashboard/EditorMako.tsx'));
  assert.match(ed, /onCambiar\(\{ mako: false \}\)/);
  assert.match(ed, /onCambiar\(\{ makoIA: \{ pedido: a\.pedido\.trim\(\), sugerencias: sugerenciasDeTexto\(a\.sugerencias\) \} \}\)/);
  assert.match(sinComentarios(leer('app/dashboard/Propiedades.tsx')), /<Switch checked=\{conMako\(g\)\} onChange=\{\(v\) => onCambiar\(\{ mako: v \}\)\} label="Botón de MaKo" \/>/);
  // La API lee y escribe con la misma regla, y deja cambiar lo que responde.
  const run = sinComentarios(leer('lib/api-mako/areas/dashboard.run.ts'));
  assert.match(run, /mako: conMako\(g\)/);
  assert.doesNotMatch(run, /mako !== false|mako === false/, 'una lectura de `mako` sin `conMako`');
  assert.match(sinComentarios(leer('lib/api-mako/areas/dashboard.def.ts')), /nombre: 'pedido_mako'/);
});
