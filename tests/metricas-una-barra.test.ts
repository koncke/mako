// =============================================================================
// Las Métricas de una automatización: UNA barra, la del informe (24/10/2026)
// =============================================================================
// Martín, cuatro pedidos sobre las Métricas, textuales:
//   1. «"Llevar al Dashboard" dentro de los 3 puntitos».
//   2. «El título no debería duplicarse, debe ser el mismo, y sin desplegable, acá no hay muchas páginas como en Dashboard».
//   3. «El botón de "Analizar con MaKo" debería eliminarse completamente y también en el dashboard». Sale de la BARRA en las
//      dos pantallas; el AI Analyst queda en el ⋮, porque hace lo que la criatura todavía no hace. Sacarlo de ahí lo decide
//      él (docs/hallazgos-graficos.md).
//   4. «Si estoy viendo las métricas no debería estar más el botón de "Probar" o "Configuraciones"... En su lugar, los
//      botones de la barra de búsqueda, el filtro, los 3 puntitos... Bien arriba donde está hoy "Probar"».
// La barra del informe se dibuja (`BarraSuperior` con `propia`); el resto se lee del fuente.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearHoja, type Hoja } from '../lib/graficos-catalogo';
import { BarraSuperior } from '../app/dashboard/Cabecera';

const leer = (p: string) => readFileSync(join(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const H: Hoja = sanearHoja({ id: 'h1', nombre: 'Métricas', emoji: '📈', subtitulo: 'Esta automatización en el período.', componentes: [] }, 0)!;
const barra = (propia: Parameters<typeof BarraSuperior>[0]['propia']) => renderToStaticMarkup(createElement(BarraSuperior, {
  hoja: H, propia, editable: true, conHojas: true, hojasAbierto: false, emojiAbierto: false, periodo: 'Últimos 30 días',
  onHojas: () => {}, onEmoji: () => {}, onCambiar: () => {}, derecha: createElement('span', { id: 'der' }),
}));

test('2 · un informe sin hojas: el título es el de la pantalla, sin el de la hoja, sin ▾ y sin subtítulo', () => {
  const html = barra({ izquierda: createElement('span', { id: 'izq' }, 'Sprint · apertura'), titulo: 'Sprint · apertura' });
  assert.match(html, /id="izq"/, 'la izquierda de la automatización no está');
  assert.match(html, /id="der"/, 'la derecha del informe (buscar, filtrar, Editar, ⋮) no está');
  assert.doesNotMatch(html, /Cambiar de hoja|lk-top-hojas/, 'volvió el desplegable de las hojas');
  assert.doesNotMatch(html, /contenteditable/i, 'el título de la hoja se edita: hay dos títulos');
  assert.doesNotMatch(html, /Esta automatización en el período/, 'el subtítulo de la hoja');
  assert.doesNotMatch(html, />Métricas</, 'el nombre de la hoja («Métricas») sigue a la vista');
  // El del PDF: el de la automatización, sólo al imprimir.
  assert.match(html, /<div class="lk-top-izq lk-solo-imprimir"><div class="lk-top-textos"><h1 class="lk-top-tit">Sprint · apertura<\/h1>/);
  // Sin `propia`, la barra del Dashboard de siempre.
  const dash = barra(null);
  assert.match(dash, /aria-label="Cambiar de hoja"/);
  assert.doesNotMatch(dash, /id="izq"/);
});

const ED = leer('app/dashboard/EditorInforme.tsx');
const MET = leer('app/automations/MetricasAutomatizacion.tsx');
const SP = leer('app/automations/SecuenciaPerfil.tsx');

test('1 · «Llevar al Dashboard» va PRIMERO en el ⋮, y ya no es un botón suelto arriba del informe', () => {
  const mas = ED.slice(ED.indexOf("{menu?.tipo === 'mas' && ("), ED.indexOf("{menu?.tipo === 'hojas' && ("));
  const propio = mas.indexOf('{cabeceraPropia?.enMas && (');
  assert.ok(propio > 0 && propio < mas.indexOf('<RenglonCompartir'), 'lo de la pantalla no va primero en el ⋮');
  assert.match(MET, /cabeceraPropia=\{\{ izquierda, titulo, enMas \}\}/);
  assert.match(MET, /<button type="button" role="menuitem" className="lk-opcion" disabled=\{llevando\} onClick=\{\(\) => void llevar\(\)\} data-metricas-llevar>/);
  assert.match(MET, /role="menuitem" className="lk-opcion" data-metricas-llevada>/, 'después de llevarla, el link en el mismo renglón');
  assert.doesNotMatch(MET, /<Button\b/, 'volvió el botón suelto');
});

test('3 · «Analizar con MaKo» ya no está en la barra, y desde el 24/10/2026 tampoco el AI Analyst en el ⋮', () => {
  assert.doesNotMatch(ED, /title="Analizar con MaKo"/);
  // Martín, a «¿Sacamos también "Analizar con MaKo" del menú de los 3 puntos?»: «Sí, y que la criatura vea la hoja».
  assert.doesNotMatch(ED, /lk-opcion--mako|alternarAnalista|<PanelAnalista /, 'volvió el AI Analyst');
});

test('4 · mirando las métricas no van «Probar» ni la tuerca: la cabecera es la izquierda de la barra del informe', () => {
  assert.match(SP, /\{Configuraciones && !verMetricas && \(\s*<BotonTuerca lado=\{ALTO_ACCION\}/);
  assert.match(SP, /\{onProbar && !verMetricas && \(/);
  assert.match(SP, /<MetricasAutomatizacion secuenciaId=\{secuencia\.id\} izquierda=\{cabecera\} titulo=\{nombre \|\| secuencia\.nombre\} \/>/);
  // La prueba abierta se cierra al ir a las métricas: su «✕ Cerrar» vive en esta barra.
  assert.match(SP, /onClick=\{\(\) => \{ if \(!verMetricas && probarAbierto\) onCerrarProbar\?\.\(\); setVerMetricas\(\(v\) => !v\); \}\}/);
  // Y la barra está aunque el informe no: cargando (también mientras baja el código del editor), con un error o vacío.
  assert.match(MET, /if \(error\) return sinEditor\(/);
  assert.match(MET, /if \(!l\) return sinEditor\(<Cargando \/>\);/);
  assert.match(MET, /if \(!hoja\) return sinEditor\(/);
  assert.match(MET, /loading: \(\) => <CargandoEditor \/>/);
  assert.match(MET, /<IzquierdaDeCarga\.Provider value=\{izquierda\}>/);
});

test('un informe sin hojas no ofrece «Nueva hoja» con el clic derecho, y exporta con el nombre de la automatización', () => {
  assert.match(ED, /puedeNuevaHoja: puedeNuevaHoja && !cabeceraPropia/);
  assert.match(ED, /nombreArchivo\(cabeceraPropia\?\.titulo \?\? hoja\.nombre, hoy, 'csv'\)/);
  assert.match(ED, /propia=\{cabeceraPropia \? \{ izquierda: cabeceraPropia\.izquierda, titulo: cabeceraPropia\.titulo \} : null\}/);
});

// ── Las roturas (5 tests; sin romper nada: 5 pases, 0 fallos). Cada una: 1 fallo / 4 pases. ─────────────────────────
// 1. `BarraSuperior` ignora `propia` (vuelven el título de la hoja y su ▾).
// 2. Lo de la pantalla no va en el ⋮.
// 3. «Llevar al Dashboard» vuelve a ser un botón suelto.
// 4. Vuelve «Analizar con MaKo» a la barra.
// 5. La tuerca sigue mirando las métricas.
// 6. «Probar» sigue mirando las métricas.
// 7. La prueba abierta no se cierra al ir a las métricas (su «✕ Cerrar» desaparece con ella).
// 8. El loader del editor sin la barra («Flujo» desaparece mientras baja el código).
// 9. El clic derecho ofrece «Nueva hoja» en un informe sin hojas.
// 10. El CSV se llama «Métricas» y no como la automatización.
