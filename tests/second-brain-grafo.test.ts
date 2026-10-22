// =============================================================================
// Second Brain — la pantalla del grafo después del feedback de Martín del 17/10/2026 (puntos 11 y 12)
// =============================================================================
// Fija lo que se rompe sin un solo error, en la computadora (app/second-brain) y en el teléfono (app/m/second-brain):
//   11 · la pantalla sólo dibuja el grafo, SIEMPRE en oscuro, con «Second Brain» y «Todo lo que MaKo sabe de tu negocio.»
//        arriba; sin el título «Mapa» ni «Conectar a Claude»; la búsqueda a la izquierda y «Filtrar» pegado a ella;
//        «Exportar» adentro del lienzo arriba a la derecha y el zoom abajo a la izquierda;
//   12 · tocar un nodo NO abre nada abajo: el editor de un área se abre sólo con «Editar» y en una caja ENCIMA; la barra
//        lateral dice qué clase de cosa es (el tipo) y agrupa las conexiones por área con la MISMA regla en los dos.
//
// Verificado ROMPIÉNDOLO (17/10/2026), cada rotura contra la base en verde (6 / 0) y restaurando después:
//   · `irA` llamando otra vez a `onEditarArea(n.area)` al fijar (lo que abría la sección debajo): 5 / 1.
//   · AreasHub con `<Section` en vez de `<Modal` (el editor de vuelta debajo del grafo): 5 / 1.
//   · VistaCerebro sin `data-tema="oscuro"` en la raíz: 5 / 1.
//   · el título «Mapa» de vuelta en el panel de ChatSecondBrain.tsx: 5 / 1.
//   · FiltroMapa antes que BuscadorCerebro en la barra: 5 / 1.
//   · el zoom de vuelta adentro de `.cbg-barra` (arriba): 5 / 1.
//   · `agruparConexiones` sin ordenar por AREAS (agrupa en el orden de llegada): 5 / 1.
//   · `tipoDeNodo` ignorando el `tipo` explícito del nodo: 5 / 1.
//   · SecondBrainM con su propio agrupado (sin `agruparConexiones`): 5 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NodoCerebro } from '../lib/cerebro-modelo';
import { agruparConexiones, tipoDeNodo } from '../lib/cerebro-areas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const nodo = (id: string, area: NodoCerebro['area'], extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta: id, detalle: '', fuente: '', autoria: 'mako', ...extra,
});

test('11 · la pantalla: siempre en oscuro, «Second Brain» arriba, sin «Mapa» ni «Conectar a Claude»', () => {
  const vista = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(vista, /<div className="sb-vista" data-tema="oscuro">/, 'la raíz da vuelta los tokens a oscuro');
  assert.match(vista, /background: var\(--bg\)/, 'con su fondo escrito: sin él se ve el de atrás');
  assert.match(vista, /export const TITULO_SECOND_BRAIN = 'Second Brain';/);
  assert.match(vista, /export const SUBTITULO_SECOND_BRAIN = 'Todo lo que MaKo sabe de tu negocio\.';/);
  assert.ok(!/BotonClaude|PageHeader/.test(vista), 'sin «Conectar a Claude» y sin la cabecera de antes');
  assert.ok(!existsSync(join(RAIZ, 'app/second-brain/BotonClaude.tsx')), 'el botón se fue entero');

  const chat = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  const panel = chat.slice(chat.indexOf(') : mapa ? ('), chat.indexOf(') : centro && chatCentro ? ('));
  assert.ok(panel.length > 0, 'la rama del grafo en la pantalla del Ops Center');
  assert.ok(!/>Mapa</.test(panel), 'sin el título «Mapa»: el grafo trae su cabecera');
  assert.match(panel, /<VolverDelGrafo\.Provider value=\{/, 'el «volver» le llega al grafo por contexto');
});

test('11 · los controles: la búsqueda a la izquierda y «Filtrar» pegado; «Exportar» arriba a la derecha; el zoom abajo', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  const ini = g.indexOf('<div className="cbg-barra">');
  const fin = g.indexOf('<div className="cbg-lienzo">');
  assert.ok(ini > 0 && fin > ini, 'la barra va antes del lienzo');
  const barra = g.slice(ini, fin);
  const busca = barra.indexOf('<BuscadorCerebro');
  const filtra = barra.indexOf('<FiltroMapa');
  assert.ok(busca >= 0 && filtra > busca, 'el buscador primero, «Filtrar» después');
  assert.ok(!barra.slice(busca, filtra).includes('flex: 1'), 'nada que los separe');
  assert.match(barra, /<div className="cbg-barra__fin">[\s\S]*\{accion\}/, '«Exportar» al final de la barra (arriba a la derecha)');
  assert.ok(!/zoomPaso/.test(barra), 'el zoom ya no va arriba');
  assert.match(g, /<div className="cbg-zoom" role="toolbar"[^>]*>[\s\S]*zoomPaso\(1 \/ 1\.3\)[\s\S]*pantallaCompleta/, 'el zoom, ajustar y pantalla completa juntos');
  // Abajo a la izquierda, en la fila de abajo (`.cbg-pie`, 22/10/2026), que en el teléfono comparte con «Girar la pantalla».
  assert.match(g, /\.cbg \.cbg-pie \{\s*position: absolute; left: 10px; right: 10px; bottom: 10px;/, 'abajo, a todo el ancho');
  assert.match(g, /<div className="cbg-pie">\s*<div className="cbg-zoom"/, 'el zoom, primero: a la izquierda');
  const vista = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(vista, /accion=\{[^}]*<BotonExportar /, '«Exportar» entra al grafo por su slot');
});

test('12 · tocar un nodo no abre nada abajo: editar es «Editar», en una caja encima', () => {
  const g = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  const irA = g.slice(g.indexOf('const irA = useCallback('), g.indexOf('const marcoRef = useRef'));
  assert.ok(irA.length > 0, 'irA');
  assert.ok(!irA.includes('onEditarArea'), 'fijar un nodo no abre el editor');
  const soltar = g.slice(g.indexOf('const soltarNodo = useCallback('), g.indexOf('const irA = useCallback('));
  assert.ok(!soltar.includes('onEditarArea'), 'soltar tampoco');
  // onEditarArea sólo adentro de un onClick de un botón.
  const usos = g.split('\n').filter((l) => l.includes('onEditarArea') && !/onEditarArea\?: |onEditarArea, |\{ cerebro, onEditarArea|!!onEditarArea|\{onEditarArea (&& esAreaDeNegocio\(a\.id\) )?&& \(/.test(l));
  assert.ok(usos.length > 0 && usos.every((l) => l.includes('onClick')), `sólo en botones: ${usos.join(' | ')}`);
  assert.ok(!/areaAbierta|onAbrirArea/.test(g), 'sin la costura de la sección de abajo');

  const hub = sinComentarios(leer('app/second-brain/AreasHub.tsx'));
  assert.match(hub, /<Modal\s/, 'el editor es una caja');
  assert.ok(!/<Section[\s>]/.test(hub), 'y no una sección debajo del grafo');
  assert.match(hub, /contenedor\s*\n/, 'que deja abrir modales adentro (la Matriz)');
});

test('12 · el tipo de un nodo: gana el explícito, si no sale del prefijo, y nunca vacío', () => {
  assert.equal(tipoDeNodo(nodo('prod:7', 'productos')), 'Producto');
  assert.equal(tipoDeNodo(nodo('etapa:lead', 'funnel')), 'Etapa del funnel');
  assert.equal(tipoDeNodo(nodo('fase', 'norte')), 'Fase del negocio');
  assert.equal(tipoDeNodo(nodo('prod:7', 'productos', { tipo: 'Suscripción' })), 'Suscripción');
  assert.equal(tipoDeNodo(nodo('cosa-rara', 'norte')), 'Dato');
});

test('12 · las conexiones agrupadas por área, en el orden del lienzo, con tope', () => {
  const cs = [
    { nodo: nodo('etapa:a', 'funnel'), motivo: '1' },
    { nodo: nodo('prod:1', 'productos'), motivo: '2' },
    { nodo: nodo('fase', 'norte'), motivo: '3' },
    { nodo: nodo('prod:2', 'productos'), motivo: '4' },
  ];
  const todos = agruparConexiones(cs);
  assert.deepEqual(todos.map((g) => [g.area, g.items.map((c) => c.nodo.id)]), [
    ['norte', ['fase']], ['productos', ['prod:1', 'prod:2']], ['funnel', ['etapa:a']],
  ]);
  const dos = agruparConexiones(cs, 2);
  assert.deepEqual(dos.map((g) => [g.area, g.items.length]), [['norte', 1], ['productos', 1]], 'el tope corta en el orden del lienzo');
});

// 22/10/2026: el lienzo oscuro del teléfono ES el grafo (sin portada); el título queda para quien no lo ve.
test('11 y 12 en el teléfono: el grafo en oscuro con el mismo título, y la hoja con el tipo y las conexiones agrupadas', () => {
  const m = sinComentarios(leer('app/m/second-brain/SecondBrainM.tsx'));
  assert.match(m, /<div className="m-second-brain-grafo" data-tema="oscuro"/, 'el grafo del teléfono, en oscuro');
  assert.match(m, /<h1 className="m-sr">\{TITULO_SECOND_BRAIN\}<\/h1>/);
  assert.match(m, /from '@\/app\/second-brain\/VistaCerebro'/, 'los textos son los de la computadora, no una copia');
  assert.match(m, /agruparConexiones\(conexiones, /, 'la misma regla de agrupar que la barra lateral');
  assert.match(m, /tipoDeNodo\(n\)/, 'el mismo tipo arriba del dato');
  const pagina = leer('app/m/second-brain/mapa/page.tsx');
  assert.ok(!pagina.includes('Claude'), 'sin «Claude» en el aviso de la computadora');
  // Mientras se arma, el mismo lienzo oscuro: no la forma de la portada que ya no existe.
  assert.match(leer('app/m/second-brain/mapa/loading.tsx'), /<div className="m-second-brain-grafo" data-tema="oscuro" aria-busy="true"/);
});
