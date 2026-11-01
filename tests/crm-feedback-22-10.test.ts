// =============================================================================
// El feedback de Martín sobre el CRM del 22/10/2026 (con dos capturas): el tablero, la casilla de la columna y las reuniones
// =============================================================================
// Textual (C:/dev/cerebro-herramientas/feedback-crm-martin-22-10.md):
//   1. «Las columnas siempre el mismo largo... Y podrían ir mucho más abajo».
//   2. «La barra de scroll a la derecha podría estar debajo del botón de "A revisar"».
//   4. «En la selección multiple, me falta el checkox en la columna, para poder seleccionar a todos los de esa columna».
//   5. «En SuperAdmin el botón de "Tienes 2 reuniones cerca" aparece el bloque azul, pero en los demás como Mauricio aún
//      aparece el pop-up antiguo... Quiero siempre unificar las cosas en todos lados... me gustaría que salga un pop-up si,
//      pero con el bloque azul. Y me falta un botón para poder ver el detalle».
// (El 3, «Vincular cobro» en Ganado, espera las acciones de Cobros; el 6 es de Offer.)
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 3 / 0, una rotura por vez y restaurada:
//   · la columna con su tope de vuelta (`maxHeight: '68vh'`)                                     → 2 / 1
//   · el <main> del Kanban sin el alto de la pantalla                                            → 2 / 1
//   · la casilla tildando todo lo filtrado del tablero (`filtered.map`) en vez de la columna       → 2 / 1
//   · `alternarColumna` que, con todos tildados, limpia la selección entera                       → 2 / 1
//   · el rótulo sin «que se ven» con un filtro puesto                                            → 2 / 1
//   · el bloque azul sin «Ver detalle»                                                           → 2 / 1
//   · la ficha que no abre en «Reuniones»                                                        → 2 / 1
//   · el <main> del Kanban sin `maxHeight` (en producción medía 21.285 px: el flex en columna lo estira) → 3 / 1
//   · el bloque azul del teléfono sin «Ver detalle» (sólo «Abrir ficha» sin teléfono)             → 2 / 1
// Y el 6 (Instagram, «no estaba buscando bien a los @»), con el archivo en 4 / 0:
//   · el tablero sin el Instagram entre los campos                                             → 3 / 1
//   · un link del perfil que no se vuelve `@usuario`                                            → 3 / 1
//   · el buscador del teléfono sin el Instagram                                                 → 3 / 1
//   · el server del teléfono (`buscarLeads`) sin pasarle el Instagram                           → 3 / 1
// Correr: node --import tsx --test tests/crm-feedback-22-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alternarColumna, estadoDeColumna, rotuloDeColumna } from '../app/crm/seleccion-columna';
import { arrobaInstagram, linksDeInstagramComoArroba } from '../app/crm/campo-inline';
import { coincideBusqueda } from '../lib/buscar-texto';
import { buscarEnCartera } from '../app/m/crm/reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));
const columna = () => { const i = BOARD.indexOf('const renderColumn = '); return BOARD.slice(i, BOARD.indexOf('<div data-carril', i)); };

test('1 y 2: el Kanban llena la pantalla, las columnas del mismo alto hasta abajo, y la barra del scroll debajo de «A revisar»', () => {
  assert.match(BOARD, /const ALTO_TABLERO = 'calc\(100dvh - var\(--barra-agencia, 0px\)\)';/);
  // Con `maxHeight` también (22/10/2026, medido en producción): el <main> es hijo de un flex en COLUMNA y su `flex: 1` le
  // gana a `height`; medía 21.285 px y la barra del scroll quedaba fuera de la pantalla.
  assert.match(BOARD, /\.\.\.\(view === 'kanban' \? \{ height: ALTO_TABLERO, maxHeight: ALTO_TABLERO, minHeight: 0 \} : \{\}\)/, 'el Kanban no mide la pantalla (sin maxHeight, el flex en columna lo estira)');
  // La barra del scroll queda en los últimos píxeles: el aire de abajo, más chico que el de «A revisar» (20 px del borde).
  const abajo = Number(/const ABAJO_KANBAN = (\d+);/.exec(BOARD)?.[1]);
  assert.ok(abajo >= 0 && abajo <= 6, `el Kanban deja ${abajo} px abajo`);
  assert.match(leer('app/_components/EsquinaAvisos.tsx'), /bottom: 'var\(--esquina-abajo, 20px\)'/, '«A revisar» cambió de lugar: revisar ABAJO_KANBAN');
  // La fila estira a cada columna al alto del tablero; ninguna topea ni mide lo de sus tarjetas.
  assert.match(BOARD, /style=\{\{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8 \}\}>\s*<div style=\{\{ display: 'flex', gap: 12, alignItems: 'stretch', width: 'max-content', height: '100%' \}\}>/);
  assert.doesNotMatch(columna(), /maxHeight|68vh/, 'la columna volvió a topear');
  // El que scrollea es el carril de tarjetas, que se queda con el resto de la columna.
  assert.match(BOARD, /<div data-carril style=\{\{ flex: 1, minHeight: 0, padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' \}\}>/);
  // El esqueleto de la carga, con las mismas medidas: si no, salta al llegar el tablero.
  const carga = leer('app/crm/loading.tsx');
  assert.match(carga, /padding: '16px 44px 4px', display: 'flex', flexDirection: 'column', height: 'calc\(100dvh - var\(--barra-agencia, 0px\)\)'/);
});

test('4: la casilla de la columna tilda lo que SE VE de esa columna, suma a lo tildado y dice cuántos son', () => {
  // Puro.
  const sel = new Set([1, 99]);
  assert.deepEqual(estadoDeColumna([1, 2, 3], sel), { n: 3, marcados: 1, todos: false, parcial: true });
  assert.deepEqual([...alternarColumna(sel, [1, 2, 3])].sort((a, b) => a - b), [1, 2, 3, 99], 'suma la columna a lo que ya estaba tildado');
  const todos = new Set([1, 2, 3, 99]);
  assert.deepEqual(estadoDeColumna([1, 2, 3], todos).todos, true);
  assert.deepEqual([...alternarColumna(todos, [1, 2, 3])], [99], 'quita sólo los de la columna');
  assert.equal(estadoDeColumna([], sel).todos, false, 'una columna vacía no está «toda tildada»');
  assert.equal(rotuloDeColumna(estadoDeColumna([1, 2, 3], new Set()), 'Círculo ROJO', false), 'Seleccionar los 3 de «Círculo ROJO»');
  assert.equal(rotuloDeColumna(estadoDeColumna([1, 2], new Set()), 'Agenda R2', true), 'Seleccionar los 2 que se ven de «Agenda R2»');
  assert.equal(rotuloDeColumna(estadoDeColumna([7], new Set([7])), 'Ganado', true), 'Quitar el lead que se ve de «Ganado»');
  // En el tablero: los ids son los de las tarjetas de ESTA columna (lo filtrado), y la casilla no arrastra la columna.
  const c = columna();
  // (Entre las dos va `dibujadas`, la tanda que se dibuja: la casilla mira la columna ENTERA, tests/crm-columna-por-tandas.test.ts.)
  assert.match(c, /const cards = enOrden\(filtered\.filter\(\(l\) => effStage\(l\) === c\.key\), c\.key\);[\s\S]{0,400}?const idsCol = cards\.map\(\(x\) => x\.id\);\s*const colSel = estadoDeColumna\(idsCol, selLeads\);/);
  assert.match(BOARD, /<input type="checkbox" data-nodrag className="mk-sel-columna"/);
  assert.match(BOARD, /onChange=\{\(\) => setSelLeads\(\(p\) => alternarColumna\(p, idsCol\)\)\}/);
  assert.match(BOARD, /title=\{rotuloDeColumna\(colSel, c\.label, hayFiltros\)\}/);
  assert.match(BOARD, /ref=\{\(el\) => \{ if \(el\) el\.indeterminate = colSel\.parcial; \}\}/);
  // Aparece como la de la tarjeta: al pasar por la columna, con algo tildado o marcada.
  const css = leer('app/globals.css');
  assert.match(css, /\.mk-col-crm:hover \.mk-sel-columna,\n\.mk-sel-columna:focus-visible,\n\.mk-sel-columna\[data-marcada='1'\],\n\.mk-sel-columna\[data-seleccionando='1'\] \{ width: 15px; margin-right: 0; opacity: 1; \}/);
  assert.match(BOARD, /className="mk-col-crm"/);
});

test('5: «Tienes N reuniones cerca» abre el MISMO pop-up para todos, con la tarjeta de cada reunión y «Ver detalle»', () => {
  const boton = sinComentarios(leer('app/crm/ReunionesProximas.tsx'));
  assert.match(boton, /onClick=\{\(\) => setAbierto\(true\)\}/, 'el calendario no abre el pop-up');
  assert.doesNotMatch(boton, /onAlternar|desplegado/, 'volvió el calendario que despliega «Próximo» arriba del tablero');
  // 640 desde la segunda vuelta (22/10/2026): una columna de tarjetas que se leen de arriba abajo.
  assert.match(boton, /<Modal titulo="Tus reuniones" ancho=\{640\} onCerrar=\{cerrar\}>\s*\{contenido\(cerrar\)\}/);
  // El tablero arma la tarjeta de CADA reunión; ya no hay «Próximo» desplegado arriba.
  assert.match(BOARD, /<BotonReuniones juntas=\{juntas\} contenido=\{bloquesDeReuniones\} \/>/);
  assert.doesNotMatch(BOARD, /verProximo|hayProxima/, 'volvió «Próximo» arriba del tablero');
  // Desde la segunda vuelta (22/10/2026) es la tarjeta que PREPARA la reunión (app/crm/TarjetaReunion.tsx; sus reglas, en
  // tests/crm-feedback-22-10-c.test.ts). «Ver detalle»: cierra el pop-up y abre la ficha en «Reuniones».
  assert.match(BOARD, /<ReunionesParaPreparar reuniones=\{reuniones\} onVerDetalle=\{\(id\) => \{/);
  assert.match(BOARD, /if \(!l\) return;\s*cerrar\(\);\s*openDetail\(l, 'reuniones'\);/);
  assert.match(BOARD, /const openDetail = \(l: CrmLead, foco\?: string\) => \{ setFocoFicha\(foco\); setSelectedId\(l\.id\); \};/);
  assert.match(BOARD, /<LeadEditModal leadId=\{selected\.id\} seed=\{\{ nombre: selected\.name, empresa: selected\.company \}\} focus=\{focoFicha\} onClose=\{closeDetail\} \/>/);
  assert.match(leer('app/crm/LeadEditModal.tsx'), /const initialTab = focus === 'plan-pagos' \? 'cobranza' : focus === 'reuniones' \? 'reuniones' : 'resumen';/);
  // En el teléfono la MISMA tarjeta va arriba de la lista (sin barra no hay calendario), con «Ver detalle».
  assert.match(sinComentarios(leer('app/m/crm/TableroCrm.tsx')), /\}\]\} onVerDetalle=\{\(\) => router\.push\(ficha\(px\.id\)\)\} \/>/);
});

test('6 (Instagram): el buscador encuentra al lead por su @, con o sin @, en mayúsculas o no, y por el link del perfil', () => {
  // Lo que guarda `leads.instagram`: sin @ y en minúsculas. El campo entra como `@usuario`.
  const campos = (ig: string | null) => [7, 'Ana Pérez', 'Estudio', 'ana@gmail.com', '+54 11 5555 5555', arrobaInstagram(ig)];
  const busca = (q: string, ig: string | null = 'martinkoncke') => coincideBusqueda(campos(ig), linksDeInstagramComoArroba(q));
  for (const q of ['@martinkoncke', 'martinkoncke', '@MartinKoncke', 'MARTINKONCKE', 'https://www.instagram.com/martinkoncke/?igsh=abc123', 'instagram.com/MartinKoncke', 'koncke']) {
    assert.ok(busca(q), `«${q}» no encontró a @martinkoncke`);
  }
  assert.equal(busca('@otra.cuenta'), false);
  assert.equal(busca('@martinkoncke', null), false, 'sin Instagram no aparece por un @');
  // Un link que no es un perfil (un post) no se vuelve un @, y «@gmail.com» sigue encontrando el email.
  assert.equal(linksDeInstagramComoArroba('https://www.instagram.com/p/Cx12/'), 'https://www.instagram.com/p/Cx12/');
  assert.ok(busca('@gmail.com'), '«@gmail.com» dejó de encontrar el email');
  assert.equal(arrobaInstagram('@@Ana_ok '), '@ana_ok');
  // El teléfono busca igual.
  const cartera = [{ id: 1, nombre: 'Ana', instagram: 'martinkoncke' }, { id: 2, nombre: 'Beto', instagram: null }];
  assert.deepEqual(buscarEnCartera(cartera, 'instagram.com/MartinKoncke/').filas.map((f) => f.id), [1]);
  assert.deepEqual(buscarEnCartera(cartera, '@martinkoncke').filas.map((f) => f.id), [1]);
  // Cableado: el tablero y el teléfono pasan el Instagram, y el mapa del tablero lo trae.
  assert.match(BOARD, /coincideBusqueda\(\[l\.id, l\.name, l\.company, l\.email, l\.phone, arrobaInstagram\(l\.instagram\)\], linksDeInstagramComoArroba\(search\)\)/);
  assert.match(leer('app/crm/crm-map.ts'), /instagram: l\.instagram \?\? null,/);
  assert.match(leer('lib/crm-movil.ts'), /telefono: l\.telefono, instagram: l\.instagram \}\)\), q\);/);
});
