// =============================================================================
// El editor web como Automations: la tarjeta lista ↔ chat, UNA barra, el Panel sólo sin landings
// =============================================================================
// Pedidos de Martín (24/10/2026): «Hay 2 topbar de edición, debería haber solo 1», «2 veces el titulo, no tiene sentido»,
// «que sea el mismo sistema de "Automations" con el chat flotando y con la flecha para atras... que no me redirija», «Ese
// "panel" principal, solo sale si un usuario no ha creado nunca ninguna landing», «"Compartir y exportar" podrían ser el
// mismo botón» y «los botones se superponen». Plan: docs/diseno-editor-web-como-automations.md.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landingMasReciente, landingsDeLaLista, RUTA_NUEVA_LANDING } from '../app/web-generator/panel-reglas';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';

const leer = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const doc = (id: number, actualizado: string, extra: Partial<LandingResumen> = {}) =>
  ({ id, titulo: `L${id}`, tema: 't', creado: actualizado, actualizado, creadoPor: null, favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, ...extra }) as LandingResumen;

// ⚠️ 11/11/2026 (Martín: «lo mismo que venimos haciendo con el resto de tabs, de outliers»): /web-generator ya NO salta a la
// última landing; es la portada de outliers (tests/web-generator-outliers.test.ts). `landingMasReciente` queda para la lista.
test('la landing más reciente (sin la papelera); /web-generator pelada es la portada de outliers, sin salto', () => {
  assert.equal(landingMasReciente([doc(1, '2026-10-01'), doc(2, '2026-10-20'), doc(3, '2026-10-10')])?.id, 2);
  assert.equal(landingMasReciente([doc(1, '2026-10-01'), doc(2, '2026-10-20', { papelera: true })])?.id, 1, 'la papelera no se abre');
  assert.equal(landingMasReciente([doc(2, '2026-10-20', { papelera: true })]), null);
  assert.equal(landingMasReciente([]), null);
  const page = sinComentarios(leer('app/web-generator/page.tsx'));
  assert.match(page, /if \(esPanelPelado\(sp\)\) \{\s*return \(/, 'la pelada dibuja la portada');
  assert.doesNotMatch(page, /redirect\(await rutaConWs\(`\/web-generator\/\$\{ultima\.id\}`\)\)/, 'ya no salta a la última');
});

test('la lista de la tarjeta: sin la papelera, la más tocada primero, y buscar filtra por título', () => {
  const docs = [doc(1, '2026-10-01', { titulo: 'Coaches' }), doc(2, '2026-10-20', { titulo: 'Inmobiliarias' }), doc(3, '2026-10-10', { titulo: 'Borrada', papelera: true })];
  assert.deepEqual(landingsDeLaLista(docs, '').map((d) => d.id), [2, 1]);
  assert.deepEqual(landingsDeLaLista(docs, 'coach').map((d) => d.id), [1]);
  assert.deepEqual(landingsDeLaLista(docs, 'borr'), []);
  // El Panel de verdad (sin ?panel=1, /web-generator saltaría a una landing). Desde el editor ya no se navega a él: el test de abajo.
  assert.equal(RUTA_NUEVA_LANDING, '/web-generator?panel=1');
});

test('«Nueva landing» NO navega: «¿Qué vas a crear hoy?» ocupa la barra y el lienzo, y la tarjeta de la izquierda no cambia', () => {
  // Martín, 24/10/2026: «Cuando le doy a "Nueva landing" NO me debe redireccionar a otra ruta... Y la sidebar no debe
  // cambiar... Solamente debe aparecer el "¿Qué vas a crear hoy?" con los templates en lugar de la topbar de edición y el
  // lienzo». Lo entregado antes ese día era un <Link> al Panel (/web-generator?panel=1): otra ruta y otra barra lateral.
  const lista = sinComentarios(leer('app/web-generator/editor/paneles/PanelLandings.tsx'));
  assert.match(lista, /<button type="button" className="gma-ls-item gma-ls-nueva" aria-current=\{nueva \? 'true' : undefined\} onClick=\{\(\) => setNueva\(true\)\}>/);
  assert.doesNotMatch(lista, /<Link href=\{RUTA_NUEVA_LANDING\} className="gma-ls-item gma-ls-nueva"/, '«Nueva landing» volvió a navegar al Panel');
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  // El cuadro de crear (el del Panel, embebido) en lugar de la barra y el lienzo; la landing abierta queda montada y oculta.
  assert.match(editor, /\{creando \? \(\s*<div className="gma-centro" role="region" aria-label=\{panelEntero \? 'Panel' : 'Nueva landing'\}>[\s\S]{0,400}<InicioEmbebido\s+embebido/);
  assert.match(editor, /<main className="gma-centro" style=\{creando \? \{ display: 'none' \} : undefined\}>/);
  // La tarjeta de la izquierda sigue siendo la lista: «Nueva landing» la deja en 'landings', y salir de la lista lo cierra.
  assert.match(editor, /const setNueva = useCallback\(\(v: boolean\) => \{\s*if \(v\) \{\s*void guardarAhora\(\);\s*setPanelDer\(null\);\s*setPanelIzqEstado\('landings'\);/);
  assert.match(editor, /const creando = nueva && panelIzq === 'landings';/);
  // El Panel embebido no dibuja su barra de documentos ni reescribe la URL (la de la landing abierta).
  const inicio = sinComentarios(leer('app/web-generator/Inicio.tsx'));
  assert.match(inicio, /\{\(!props\.embebido \|\| props\.conLista\) && <aside className="gp-lateral"/);
  assert.match(inicio, /useEffect\(\(\) => \{\s*if \(props\.embebido\) return;\s*const s = queryDeDerecha\(window\.location\.search, derecha\)/);
});

test('UN solo botón azul que dice «Compartir», con el ▾ de la vista previa y las demás; el panel Compartir copiado de Canva', () => {
  // Martín, 24/10/2026: «Te pedí que "Compartir" y "publicar" sean un solo botón, azul y que diga "compartir"... Con el
  // desplegable de la vista previa y las otras opciones, claro... Y mejora el diseño del pop-up de "Compartir y exportar"».
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  const barra = editor.slice(editor.indexOf('className="gma-herramientas"'), editor.indexOf('className="gma-area"'));
  const primarios = barra.match(/className="gma-boton gma-boton--primario[^"]*"/g) ?? [];
  assert.equal(primarios.length, 2, 'el botón partido: Compartir y su ▾, nada más azul');
  assert.match(barra, /<Ico n="compartir" t=\{15\} \/> <span className="gma-partido-texto">Compartir<\/span>\s*<\/button>/);
  assert.doesNotMatch(barra, /\/> Publicar\s*<\/button>/, 'volvió el botón Publicar al lado de Compartir');
  assert.doesNotMatch(barra, /gma-boton--secundario/, 'volvió el Compartir gris de al lado');
  // El ▾: Publicar, Vista previa, la publicada, Descargar y Presentar.
  const menu = editor.slice(editor.indexOf('{menuPublicar ? ('), editor.indexOf('{menuZoom ? ('));
  for (const item of ['Vista previa', "setDialogo('publicar')", "setDialogo('exportar')", "setDialogo('presentar')"]) {
    assert.ok(menu.includes(item), `el ▾ de Compartir tiene que llevar ${item}`);
  }
  // El panel: debajo del botón (Flotante con su ancla), sin pestañas ni modal; el enlace con UN botón y la fila de atajos.
  const cp = sinComentarios(leer('app/web-generator/editor/dialogos/DialogoCompartir.tsx'));
  assert.match(cp, /<Flotante ancla=\{ancla\} onCerrar=\{cerrar\} alinear="fin" rol="dialog"/);
  assert.doesNotMatch(cp, /ModalGma|Pestanas|Quién puede editar/, 'volvió el modal con pestañas y tres bloques');
  for (const a of ["atajo('descargar', 'Descargar'", "atajo('ojo', 'Vista previa'", "atajo('enlace', 'Enlace privado'", "atajo('presentar', 'Presentar'"]) {
    assert.ok(cp.includes(a), `falta el atajo ${a}`);
  }
  // Descargar se abre ADENTRO del panel (con «←»), no en otro modal encima.
  assert.match(cp, /if \(vista === 'descargar'\) \{\s*cuerpo = <>\{cabecera\('Descargar', true\)\}<CuerpoExportar \/><\/>;/);
});

test('sin «Guardado» al lado del título, y el título con lugar para leerse', () => {
  // Martín, 24/10/2026: «Elimina "Guardado", ya que no deja ver bien el título de la pagina... Y extiende mas la sección del
  // titulo para que se lea» (se veía «Landin…»).
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  const indicador = editor.slice(editor.indexOf('function IndicadorGuardado('), editor.indexOf('function DeshacerRehacer('));
  assert.match(indicador, /if \(estado === 'guardando' \|\| estado === 'guardado' \|\| estado === 'sin-guardar'\) return null;/);
  assert.doesNotMatch(indicador, /> Guardado</, 'volvió «Guardado»');
  // Lo que no se puede callar sigue: no se guardó, con Reintentar.
  assert.match(indicador, /No se guardó/);
  const css = leer('app/web-generator/gamma.css');
  // No baja de 160 px, pero SÍ cede hasta ahí (25/10/2026: con `flex: 0 0 auto` la barra no entraba a 1280 y el «⋯» quedaba
  // afuera; tests/editor-web-ui-25-10.test.ts).
  assert.match(css, /\.gma-herramientas \.gma-titulo \{ flex: 0 1 auto; max-width: 320px; min-width: 160px; \}/);
});

test('la «←» del chat va a la LISTA de la tarjeta sin navegar, y la cabecera dice «MaKo», no el título', () => {
  const agente = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.match(agente, /titulo: 'MaKo', criatura: 'MaKo'/);
  assert.match(agente, /antes: <button type="button" className="gma-pb-iconbtn gma-ag-volver" onClick=\{\(\) => setPanelIzq\('landings'\)\}/);
  assert.doesNotMatch(agente, /antes: <Link href="\/web-generator"/, 'volvió la casa que navega al Panel');
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(editor, /panelIzq === 'landings' \? \(\s*<section role="complementary" className="gma-izq" data-panel="landings"/);
});

test('UNA sola barra: el título, Compartir y el ⋯ viven en la de herramientas', () => {
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  // En el editor (fuera de la pantalla de error) ya no hay <header className="gma-barra">.
  assert.equal((editor.match(/<header className="gma-barra">/g) ?? []).length, 0, 'volvió la segunda barra');
  assert.doesNotMatch(editor, /gma-avatar/, 'el avatar está en la barra lateral de la app');
  const barra = editor.slice(editor.indexOf('className="gma-herramientas"'), editor.indexOf('className="gma-area"'));
  for (const pieza of ['className="gma-titulo"', '<IndicadorGuardado', "setDialogo(dialogo === 'compartir' ? null : 'compartir')", 'aria-label="Menú del documento"']) {
    assert.ok(barra.includes(pieza), `la barra única tiene que llevar ${pieza}`);
  }
});

test('la columna del bloque no tapa sus propios botones: tooltip de la casa a la derecha, sin title nativo', () => {
  const t = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  assert.doesNotMatch(t, /title=\{`Opciones · arrastra/, 'el title nativo sale abajo del cursor y tapa la columna');
  assert.doesNotMatch(t, /title="Ask Agent"/);
  assert.match(t, /className="gmc-btn gmc-tip"\s*data-asa=""\s*data-tip=\{`Opciones · arrastra/);
  const css = leer('app/web-generator/editor/extensiones/estilos-nodos.ts');
  assert.match(css, /\.gmc-tip::before \{ content: attr\(data-tip\); position: absolute; left: calc\(100% \+ 6px\)/);
});

test('la columna de la sección es UN botón en una landing: sin «Editar con IA», y las notas sólo en una presentación', () => {
  // Martín, 24/10/2026: «Hay un botón que dice "Editar con IA" eso eliminalo... Por defecto siempre esta el editor de IA».
  const t = sinComentarios(leer('app/web-generator/editor/nodos/TarjetaVista.tsx'));
  const lado = t.slice(t.indexOf('className="gma gmc gmc-lado"'), t.indexOf('className="gma gmc gmc-entre"'));
  assert.ok(lado.length > 200, 'no encontré la columna');
  assert.doesNotMatch(lado, /data-tip="Editar con IA"|abrir\('agente', e\.currentTarget, 'editar'\)/, 'volvió ✨ «Editar con IA» a la columna');
  assert.match(lado, /\{esPresentacion\(ctx\?\.config \?\? \{\}\) && \(\s*<button[^>]*data-tip="Notas del orador"/);
});

test('la barra de «Texto» (la fija) no trae «Editar con IA»; la que aparece al elegir un texto, sí', () => {
  // Martín, 25/10/2026: «elimina el botón de "Editar con IA" que aparece arriba en el desplegable de "texto"». La IA queda
  // en el chat de la izquierda, en ⌘E y en la barra flotante sobre la selección.
  const b = sinComentarios(leer('app/web-generator/editor/BarraFormato.tsx'));
  const i = b.indexOf('<BotonBarra titulo="Editar con IA"');
  assert.ok(i > 0, 'no encontré el botón de la barra flotante');
  assert.match(b.slice(i - 120, i), /\{modo !== 'fija' && \(\s*<>\s*<span className="gmx-bf-sep" \/>\s*$/, 'el botón volvió a la barra de «Texto»');
  assert.equal(b.split('titulo="Editar con IA"').length, 2, 'hay otro «Editar con IA» en la barra');
  assert.match(leer('app/web-generator/editor/EditorLanding.tsx'), /<div className="gma-herramientas gma-formato">\s*<BarraFormato modo="fija" \/>/);
});

test('«Abrir tira de imágenes» es un botón de la barra y la tira se abre en la tarjeta del chat; nada flota en la esquina del lienzo', () => {
  // Martín, 24/10/2026: «"Abrir tira de imagenes" debería ser un botón en la topbar, y se debería abrir donde está el chat».
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.doesNotMatch(editor, /gma-tira-abrir/, 'volvió el botón flotante de la tira');
  const area = editor.slice(editor.indexOf('<div className="gma-area">'), editor.indexOf('ref={lienzoRef}'));
  assert.doesNotMatch(area, /<TiraSecciones/, 'la tira volvió a ser una columna al lado del lienzo');
  const barra = editor.slice(editor.indexOf('className="gma-herramientas"'), editor.indexOf('className="gma-area"'));
  assert.match(barra, /aria-label="Abrir tira de imágenes"\s*aria-pressed=\{panelIzq === 'tira'\} onClick=\{\(\) => \(panelIzq === 'tira' \? cerrarPaginas\(\) : setPanelIzqEstado\('tira'\)\)\}/);
  assert.match(editor, /<section role="complementary" className="gma-izq" data-panel="tira" aria-label="Secciones">\s*<TiraSecciones revision=\{revision\} onCerrar=\{cerrarPaginas\} \/>/);
});

test('el chat de MaKo no se pliega nunca: sin botón de plegar, sin «Abrir MaKo», y la tarjeta nunca queda vacía', () => {
  // Martín, 24/10/2026: «La sidebar del chat de MaKo NO se debe poder cerrar nunca. Elimina el boton de plegar».
  const agente = sinComentarios(leer('app/web-generator/editor/paneles/PanelAgente.tsx'));
  assert.doesNotMatch(agente, /Cerrar el panel|setPanelIzq\(null\)|chevron-doble-izquierda/, 'volvió el botón de plegar el chat');
  const ctx = sinComentarios(leer('app/web-generator/editor/contexto.ts'));
  assert.match(ctx, /export type PanelIzq = 'agente' \| 'paginas' \| 'landings' \| 'tira';/, 'la tarjeta de la izquierda volvió a poder quedar en null');
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.doesNotMatch(editor, /data-tip="Abrir MaKo"|agentePlegado/);
  // Mod+E lleva al chat; ya no lo cierra.
  assert.match(editor, /\(e\.key === 'e' \|\| e\.key === 'E'\)\) \{\s*e\.preventDefault\(\);\s*setPanelIzqEstado\('agente'\);/);
  // El placeholder entra en un renglón.
  assert.match(agente, /placeholder="Escribe a MaKo"/);
  assert.doesNotMatch(agente, /Envía un mensaje al agente/);
});

test('el placeholder de un texto vacío es UN renglón dentro de su caja: no se derrama debajo de la sección siguiente', () => {
  // Martín, 24/10/2026: «Muchos placeholder como el de la captura se ponen por detras de otras secciones y no se llegan a
  // leer». Flotaba con alto 0 (no ocupa lugar): si no entraba en un renglón, lo que sobraba caía debajo de la sección
  // siguiente (cada sección es su capa, `isolation: isolate`, y pinta su fondo encima).
  const css = leer('app/web-generator/editor/extensiones/estilos-nodos.ts');
  assert.ok(css.includes(`'.ProseMirror :is(p, h1, h2, h3, h4).is-empty[data-placeholder]:not([data-placeholder=""]) { position: relative; }'`));
  const regla = css.split('\n').find((l) => l.includes(':is(p, h1, h2, h3, h4).is-empty[data-placeholder]:not([data-placeholder=""])::before'));
  assert.ok(regla, 'falta la regla del placeholder de párrafos y títulos');
  for (const d of ['float: none', 'height: auto', 'position: absolute', 'left: 0', 'right: 0', 'white-space: nowrap', 'overflow: hidden', 'text-overflow: ellipsis']) {
    assert.ok(regla.includes(d), `al placeholder le falta «${d}»`);
  }
  const esquema = leer('app/web-generator/editor/extensiones/esquema.ts');
  const general = esquema.match(/export const PLACEHOLDER_GENERAL = '([^']+)';/)?.[1] ?? '';
  assert.ok(general && general.length <= 36, `el placeholder general es largo (${general.length}): en una columna no se lee`);
});

test('el editor de texto es UN botón que abre una segunda barra con todas las opciones, sin scroll', () => {
  // Martín, 24/10/2026: «El editor de texto quedó en un scroll muy chiquito, lo que te propongo es que sea un botón el
  // editor de texto y se abra otra topbar tipo edición de texto con todas las opciones».
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  const barra = editor.slice(editor.indexOf('className="gma-herramientas" role="toolbar"'), editor.indexOf('{formatoAbierto ? ('));
  assert.ok(barra.length > 500, 'no encontré la barra de herramientas');
  assert.doesNotMatch(barra, /<BarraFormato modo="fija" \/>/, 'el formato volvió a la barra de arriba, en un scroll');
  assert.match(barra, /data-tip="Editor de texto" aria-label="Editor de texto"\s*aria-pressed=\{formatoAbierto\}[\s\S]{0,200}onClick=\{\(\) => cambiarFormato\(!formatoAbierto\)\}/);
  assert.match(editor, /\{formatoAbierto \? \(\s*<div className="gma-herramientas gma-formato">\s*<BarraFormato modo="fija" \/>/);
  const css = leer('app/web-generator/gamma.css');
  assert.match(css, /\.gma-formato \.gmx-bf-fija \{ flex-wrap: wrap; overflow-x: visible;/, 'la segunda barra volvió a tener scroll');
});

// Medido en un banco con el editor real (30/10/2026): a 1024 la barra pedía 712 px en 660 y cortaba Compartir y el ⋯, y un panel
// de la derecha la achica igual a cualquier ancho de ventana. Roturas: mudar el contenedor a `.gma-centro` → 1 fallo. Que el
// ⋯ o el ▾ entren entre lo plegable → 1 fallo.
test('la barra se pliega por lo que ella mide, y Compartir y el ⋯ son lo último que se va', () => {
  const css = leer('app/web-generator/gamma.css');
  assert.match(css, /\.gma-herramientas \{ container: gma-barra \/ inline-size; \}/);
  // `.gma-dispositivos { display: flex }` viene más abajo: sin la barra adelante, le gana al pliegue (medido: no se iban).
  assert.match(css, /\.gma-herr-der \.gma-dispositivos, \.gma-herr-der \.gma-dispositivos \+ \.gma-sep \{ display: none; \}/);
  assert.doesNotMatch(css, /\.gma-centro \{[^}]*container/, 'adentro de .gma-centro hay cosas fijas: el contenedor las cambiaría de lugar');
  for (const ancho of [770, 640, 560, 480]) assert.match(css, new RegExp(`@container gma-barra \\(max-width: ${ancho}px\\)`));
  const editor = leer('app/web-generator/editor/EditorLanding.tsx');
  assert.doesNotMatch(editor, /gma-herr-plegable[^>]*(?:Menú del documento|Más opciones para compartir)/);
  assert.equal((editor.match(/gma-herr-plegable/g) ?? []).length, 4, 'Agregar bloque, Animar, Deshacer y Rehacer');
});

// El 30/10/2026, sobre lo que Martín pidió el 24/10: si queda un camino que navega al Panel, es el que va a tocar. Roturas:
// volver al <Link> → 1 fallo. Ofrecer la landing abierta en la columna → 1 fallo (se podría eliminar la que se está editando).
// Una raya en el medio de Compartir → 1 fallo.
test('«Ver todo en el Panel» tampoco navega, y Compartir se ve como un solo botón', () => {
  const lista = sinComentarios(leer('app/web-generator/editor/paneles/PanelLandings.tsx'));
  assert.match(lista, /<button type="button" className="gma-ls-ver"[^>]*onClick=\{verPanel\}>Ver todo en el Panel<\/button>/);
  assert.doesNotMatch(lista, /<Link href=\{RUTA_NUEVA_LANDING\}/);
  const inicio = sinComentarios(leer('app/web-generator/Inicio.tsx'));
  assert.match(inicio, /f\.tipo === 'analizada' \|\| f\.doc\.id !== props\.docAbierto/);
  const css = leer('app/web-generator/gamma.css');
  const flecha = css.replace(/\r\n/g, '\n').match(/\.gma-partido > \.gma-partido-flecha \{[^}]*\}/)![0];
  assert.doesNotMatch(flecha, /border-left/);
  // El fondo es del contenedor: dos fondos pegados dejan una línea cuando el ancho cae entre dos píxeles.
  assert.match(css, /\.gma-partido \{[^}]*background: var\(--gma-primario\); \}/);
  assert.match(css, /\.gma-partido:hover \{ background: var\(--gma-primario-hover\); \}/);
  assert.match(css, /\.gma-partido > \.gma-boton--primario,\s*\.gma-partido > \.gma-boton--primario:hover,\s*\.gma-partido > \.gma-boton--primario:active \{ background: transparent; \}/);
});

// Lo que encontró la revisión (30/10/2026).
test('el Panel adentro del editor: no navega al Diagnóstico, no pierde lo analizado y vuelve a leer la landing abierta', () => {
  const inicio = sinComentarios(leer('app/web-generator/Inicio.tsx'));
  assert.match(inicio, /onAbrirDiagnostico=\{props\.embebido \?/);
  assert.match(inicio, /if \(props\.embebido && !props\.conLista\) return;/, 'Ctrl K anda con la columna');
  const panel = sinComentarios(leer('app/web-generator/diagnostico/PanelDiagnostico.tsx'));
  assert.match(panel, /if \(onAbrirDiagnostico\) onAbrirDiagnostico\(id\);\s*else irDuro/);
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(editor, /analizadas=\{analizadasVivas\}/);
  assert.doesNotMatch(editor, /<InicioEmbebido[\s\S]{0,120}key=/, 'remontarlo tira lo escrito en el cuadro');
  assert.match(editor, /seDiagnosticoLaAbierta\.current = false;\s*void recargar\(\);/);
  const css = leer('app/web-generator/gamma.css');
  assert.match(css, /@container gma-barra \(max-width: 910px\) \{[^}]*\.gma-herr-texto \{ display: none; \}/);
});
