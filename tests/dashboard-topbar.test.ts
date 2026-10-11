// =============================================================================
// La TOPBAR del Dashboard (tanda del 11/10/2026: «La topbar se tiene que ver igual a la de looker») y el
// contrato del modo COMPARTIDO (el link sin sesión que arma el paquete «Compartir»).
// =============================================================================
// Pedido de Martín (11/10/2026), los nueve puntos, textuales en app/dashboard/Cabecera.tsx y
// app/dashboard/BarraControles.tsx. Lo que este archivo fija, porque ninguno de esos errores da un error:
//   · El contrato de lectura (app/dashboard/lectura-compartida.ts): sin link, el cuerpo de SIEMPRE a
//     /api/graficos; con link, la ruta del link con el token, la hoja y el id de cada cosa. Se EJECUTA.
//   · Que la pantalla lea SÓLO por ese contrato (ningún `fetch('/api/graficos'` de lectura suelto) y que
//     el link no ofrezca lo que su endpoint no contesta: el detalle de un número, Editar, Compartir, el AI
//     Analyst, la guía, «Nueva hoja».
//   · La topbar: sin pestañas, «Nueva hoja» PRIMERA en el desplegable, el título y el subtítulo editables
//     sin entrar a Editar (sólo si se puede guardar), sin ▾ cuando no hay a dónde ir.
//   · Los filtros: agregar sólo EDITANDO; el período con el diseño de FechaFiltro.
//   · La barra de inserción en el orden de Looker, con cada tipo del catálogo una vez.
//   · Los botones de MaKo chicos: sólo el logo, sin texto.
// Correr: npx tsx --test tests/dashboard-topbar.test.ts
//
// ── Roturas (11/10/2026, scratchpad/romper-topbar.mjs: una por vez, restaurada de MEMORIA y comparada
//    byte a byte, nunca con git). Base: 13 pasan / 0 fallan. Cada rotura tumbó SU test (pasan / fallan):
//   · el link sin el id del componente en cada pedido     -> 12 / 1  «con link, la ruta del link…»
//   · la hoja en el cuerpo de /api/graficos (sin link)     -> 12 / 1  «sin link, cada lectura va a /api/graficos…»
//   · los datos de un link pedidos por la ruta con sesión  -> 12 / 1  «ninguna LECTURA de la pantalla va suelta…»
//   · `guardable` sin `!compartido`                        -> 33 / 2  «el link compartido no guarda…» y, con
//                                                             tests/graficos-analysts.test.ts, «…enchufado»
//   · el detalle de un número con `soloLectura` pelado     -> 33 / 2  los mismos dos
//   · Compartir sin la guarda de guardable                 -> 12 / 1  «el link compartido no guarda…»
//   · la guía del ⋮ también en un link                     -> 12 / 1  el mismo
//   · volvió el texto «Restablecer el informe»             -> 12 / 1  «lo que se fue…»
//   · el título no editable con un clic                    -> 12 / 1  «la topbar: el título y el subtítulo…»
//   · «Nueva hoja» después de las hojas                    -> 12 / 1  «el desplegable de las hojas…»
//   · el ▾ aunque no haya a dónde ir                       -> 12 / 1  «la topbar…»
//   · «＋ Filtro» también mirando                           -> 11 / 2  ««＋ Filtro» sólo EDITANDO…» y «el botón del
//                                                             período dice SÓLO el período…» (el «Filtro» de más)
//   · el rango al lado del período en el botón             -> 12 / 1  «el botón del período dice SÓLO…»
//   · la barra de inserción sin la flecha                  -> 12 / 1  «la barra de inserción…»
//   · el texto antes que la imagen (fuera del orden)       -> 12 / 1  el mismo
//   · el botón de MaKo con la palabra «MaKo» al lado       -> 12 / 1  «los botones de MaKo…»
//   · «Agregá un subtítulo» en la topbar                   -> 12 / 1  «sin voseo…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearHoja, TIPOS_ELEMENTO, type Hoja } from '../lib/graficos-catalogo';
import { marcasDeVoseo } from '../lib/puestas-data';
import { pedidoDeLectura, RUTA_LECTURA, RUTA_LECTURA_COMPARTIDA } from '../app/dashboard/lectura-compartida';
import { BarraSuperior, MenuHojas } from '../app/dashboard/Cabecera';
import { BARRA_INSERTAR } from '../app/dashboard/Galeria';
import { ChatMakoGrafico } from '../app/dashboard/PanelAnalista';
import { BarraControles } from '../app/dashboard/BarraControles';
import type { PedidoBloqueHoja, PedidoGrafico } from '../app/dashboard/exportar';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»: ¿se movió?`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  return src.slice(i, j);
};

const EDITOR = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
const CONTROLES = sinComentarios(leer('app/dashboard/BarraControles.tsx'));
const hoja = (id: string, nombre: string, extra: Record<string, unknown> = {}): Hoja => sanearHoja({ id, nombre, componentes: [], ...extra }, 0)!;

// ── 1. El contrato de lectura (lo ejecuta) ────────────────────────────────────

const PG = { grafico: { id: 'g1' }, desde: '2026-10-01', hasta: '2026-10-11', filtros: [], agrupar: null } as unknown as PedidoGrafico;
const PB: PedidoBloqueHoja = { id: 'b1', bloque: 'revenue', desde: '2026-10-01', hasta: '2026-10-11' };

test('sin link, cada lectura va a /api/graficos con el cuerpo de SIEMPRE (ni token, ni hoja, ni ids de más)', () => {
  const d = pedidoDeLectura({ accion: 'datos', hojaId: 'h1', pedidos: [{ id: 'g1', pedido: PG }] }, null);
  assert.equal(d.ruta, RUTA_LECTURA);
  assert.deepEqual(d.cuerpo, { accion: 'datos', pedidos: [PG] }, 'el closer pasa por `closerPuedePedir`, que mira el cuerpo entero');
  const b = pedidoDeLectura({ accion: 'bloques', hojaId: 'h1', pedidos: [{ id: 'b1', pedido: PB }] });
  assert.deepEqual(b, { ruta: RUTA_LECTURA, cuerpo: { accion: 'bloques', pedidos: [PB] } });
  const v = pedidoDeLectura({ accion: 'valores', hojaId: 'h1', controlId: 'c1', campo: 'campana', desde: '2026-10-01', hasta: '2026-10-11', fuentes: ['meta'] });
  assert.deepEqual(v, { ruta: RUTA_LECTURA, cuerpo: { accion: 'valores', campo: 'campana', desde: '2026-10-01', hasta: '2026-10-11', fuentes: ['meta'] } });
});

test('con link, la ruta del link con el token, el id de la HOJA y el id de CADA componente (o control)', () => {
  const link = { token: 'tk_123' };
  assert.equal(RUTA_LECTURA_COMPARTIDA, '/api/compartido/graficos');
  const d = pedidoDeLectura({ accion: 'datos', hojaId: 'h1', pedidos: [{ id: 'g1', pedido: PG }, { id: 'g2', pedido: { ...PG, grafico: { id: 'g2' } } as unknown as PedidoGrafico }] }, link);
  assert.equal(d.ruta, RUTA_LECTURA_COMPARTIDA);
  assert.equal(d.cuerpo.token, 'tk_123');
  assert.equal(d.cuerpo.hojaId, 'h1');
  assert.deepEqual((d.cuerpo.pedidos as Array<{ id: string }>).map((p) => p.id), ['g1', 'g2'], 'un pedido sin el id del componente: el server no lo puede reconstruir');
  // El estado de la VISTA viaja tal cual (es lo único que el server del link acepta del cliente).
  assert.deepEqual((d.cuerpo.pedidos as Array<Record<string, unknown>>)[0], { ...PG, id: 'g1' });
  const b = pedidoDeLectura({ accion: 'bloques', hojaId: 'h1', pedidos: [{ id: 'b1', pedido: PB }] }, link);
  assert.deepEqual(b.cuerpo, { accion: 'bloques', token: 'tk_123', hojaId: 'h1', pedidos: [{ ...PB, id: 'b1' }] });
  // Los valores de una lista: la hoja, el control y, si es de una tarjeta, el componente.
  const vh = pedidoDeLectura({ accion: 'valores', hojaId: 'h1', controlId: 'c1', campo: 'campana', desde: 'a', hasta: 'b' }, link);
  assert.deepEqual(vh, { ruta: RUTA_LECTURA_COMPARTIDA, cuerpo: { accion: 'valores', token: 'tk_123', hojaId: 'h1', controlId: 'c1', campo: 'campana', desde: 'a', hasta: 'b' } });
  const vc = pedidoDeLectura({ accion: 'valores', hojaId: 'h1', controlId: 'c9', componenteId: 'g1', campo: 'campana', desde: 'a', hasta: 'b' }, link);
  assert.equal(vc.cuerpo.componenteId, 'g1');
});

// ── 2. La pantalla lee SÓLO por el contrato, y el link no ofrece lo que no tiene ──

test('ninguna LECTURA de la pantalla va suelta a /api/graficos: sólo guardar (que el link no puede)', () => {
  const sueltos = [...EDITOR.matchAll(/fetch\('\/api\/graficos'/g)].map((m) => m.index!);
  assert.equal(sueltos.length, 1, `fetch a /api/graficos escritos a mano: ${sueltos.length}`);
  const mandar = bloque(EDITOR, 'const mandar = useCallback(', '}, [guardable, show]);');
  assert.ok(mandar.includes("fetch('/api/graficos'"), 'el único fetch a mano no es el de guardar');
  assert.match(mandar, /if \(!guardable \|\| json === ultimoGuardado\.current\) return;/, 'guardar sin la guarda de guardable');
  // Los datos y los bloques salen de `pedidoDeLectura` con el link.
  assert.equal((EDITOR.match(/pedidoDeLectura\(\{ accion: '(datos|bloques)', hojaId: hoja\.id,[^\n]*\}, link\)/g) ?? []).length, 2);
  // Los valores de una lista compartida, también (BarraControles no escribe la ruta a mano).
  assert.doesNotMatch(CONTROLES, /'\/api\/(compartido\/)?graficos'/);
  assert.match(CONTROLES, /pedidoDeLectura\(\{ accion: 'valores', hojaId: lectura\.hojaId, controlId, componenteId: lectura\.componenteId,/);
  assert.match(CONTROLES, /const est = ctx\.lectura \? delLink : conSesion;/);
});

test('el link compartido no guarda, ni edita, ni comparte, ni abre el detalle de un número, ni el AI Analyst, ni la guía', () => {
  assert.match(EDITOR, /const guardable = !lecturaFallo && !soloLectura && !compartido;/);
  assert.match(EDITOR, /const soloMirar = soloLectura \|\| !!compartido;/);
  // El detalle de un número: sin `onDetalle`, el clic no lo ofrece (son listas de personas; el link lo contesta 403).
  assert.match(EDITOR, /onDetalle=\{editando \|\| soloMirar \? undefined :/);
  assert.match(EDITOR, /\{guardable && <BotonCompartir hojaId=\{hoja\.id\} titulo=\{hoja\.nombre\} \/>\}/, 'Compartir sin la guarda (o con otra firma)');
  assert.match(EDITOR, /\{!soloMirar && \(\s*<button type="button" className="lk-pill" data-recorrido=\{editando \? 'dash-ver' : 'dash-editar'\}/);
  const mas = bloque(EDITOR, "{menu?.tipo === 'mas' && (", '</Flotante>');
  assert.match(mas, /\{!soloMirar && \(\s*<>\s*<button[^>]*lk-opcion--mako/, 'el AI Analyst sin la guarda');
  assert.match(mas, /\{conGuia && \(/, 'la guía sin la guarda');
  assert.match(mas, /onClick=\{exportarCsv\}[\s\S]*onClick=\{exportarPdf\}/, 'Exportar se fue del ⋮');
  // «Nueva hoja» y las acciones de una hoja cuelgan de poder guardar; la ficha de una llamada, de no ser un link.
  assert.match(EDITOR, /const puedeNuevaHoja = guardable && tablero\.hojas\.length < MAX_HOJAS;/);
  assert.match(EDITOR, /\{llamada != null && !compartido && <FichaLlamada /);
  // Y los filtros (de la hoja y de cada tarjeta) reciben el link para leer sus valores.
  assert.match(EDITOR, /<BarraControles\s[^>]*compartido=\{compartido\}/);
  assert.match(EDITOR, /<ChipsControles [^\n]*compartido=\{compartido\} \/>/);
});

// ── 3. La topbar (la renderiza) ─────────────────────────────────────────────

const H = hoja('h1', 'Marketing', { emoji: '📣', subtitulo: 'Lo de Meta' });
const topbar = (p: Partial<Parameters<typeof BarraSuperior>[0]> = {}) => renderToStaticMarkup(createElement(BarraSuperior, {
  hoja: H, editable: true, conHojas: true, hojasAbierto: false, emojiAbierto: false, periodo: 'Últimos 30 días',
  onHojas: () => {}, onEmoji: () => {}, onCambiar: () => {}, derecha: createElement('span', { id: 'der' }), ...p,
}));

test('la topbar: el título y el subtítulo se editan con un clic SIN entrar a Editar, sólo si se puede guardar; sin ícono ni pestañas', () => {
  const si = topbar();
  // (React lo escribe `contentEditable`, con mayúscula: la búsqueda va sin distinguir.)
  assert.equal((si.match(/contenteditable="true"/gi) ?? []).length, 2, 'el título y el subtítulo, editables en el lugar (punto 5)');
  assert.match(si, /aria-label="Cambiar el emoji"/, 'el emoji no se cambia con un clic');
  assert.match(si, /aria-label="Cambiar de hoja"[^>]*aria-haspopup="menu"/, 'falta el ▾ del desplegable');
  assert.match(si, /id="der"/);
  assert.doesNotMatch(si, /role="tablist"|role="tab"/, 'volvieron las pestañas (punto 1)');
  const no = topbar({ editable: false });
  assert.doesNotMatch(no, /contenteditable/i, 'sin poder guardar (el closer, un link) el título se editaría y no se guardaría');
  assert.doesNotMatch(no, /Cambiar el emoji/);
  assert.match(no, />Marketing</);
  assert.match(no, /data-recorrido="dash-hojas"/, 'sin poder editar, el título mismo abre las hojas');
  // Sin a dónde ir (una hoja, sin «Nueva hoja»): ningún ▾ (un desplegable de una opción no hace nada).
  const sola = topbar({ editable: false, conHojas: false });
  assert.doesNotMatch(sola, /aria-haspopup="menu"/);
  assert.match(sola, />Lo de Meta</, 'el subtítulo, donde Looker pone «Archivo · Vista…»');
});

test('el desplegable de las hojas: «Nueva hoja» PRIMERA siempre, la abierta marcada, y sin poder guardar ni ⋮ ni «Nueva hoja»', () => {
  const hojas = [hoja('h1', 'Marketing'), hoja('h2', 'Comercial'), hoja('h3', 'Closing')];
  const acciones = { onRenombrar: () => {}, onDuplicar: () => {}, onMover: () => {}, onEliminar: () => {} };
  const con = renderToStaticMarkup(createElement(MenuHojas, { hojas, activa: 'h2', puedeNueva: true, acciones, onIr: () => {}, onNueva: () => {} }));
  const iNueva = con.indexOf('Nueva hoja');
  assert.ok(iNueva > 0 && iNueva < con.indexOf('Marketing'), '«Nueva hoja» no es la primera opción (punto 1)');
  assert.equal((con.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(con, /aria-checked="true"[^>]*title="Comercial"/);
  assert.equal((con.match(/class="lk-hoja-mas"/g) ?? []).length, 3, 'cada hoja con su ⋮');
  const sin = renderToStaticMarkup(createElement(MenuHojas, { hojas, activa: 'h1', puedeNueva: false, acciones: null, onIr: () => {}, onNueva: () => {} }));
  assert.doesNotMatch(sin, /Nueva hoja|lk-hoja-mas/);
  // Pasadas siete, el buscador de la casa.
  const muchas = Array.from({ length: 8 }, (_, i) => hoja(`h${i}`, `Hoja ${i}`));
  assert.match(renderToStaticMarkup(createElement(MenuHojas, { hojas: muchas, activa: 'h0', puedeNueva: false, acciones: null, onIr: () => {}, onNueva: () => {} })), /aria-label="Buscar una hoja"/);
});

test('lo que se fue: «Restablecer el informe», el ícono de la tab y los botones sueltos de AI Analyst y Exportar', () => {
  const cab = sinComentarios(leer('app/dashboard/Cabecera.tsx'));
  for (const [que, re] of [
    ['Restablecer el informe', /Restablecer el informe|tableroInicial\(|const restablecer = /], ['el ícono de la tab', /<Icon name="graphics"/],
    ['el botón suelto de AI Analyst', /<BotonAnalista\b|className="lk-analista"/], ['la pastilla de Exportar', /data-recorrido="dash-exportar"/],
    ['el «?» suelto', /<BotonRecorrido\b/],
  ] as const) {
    assert.doesNotMatch(EDITOR, re, `volvió ${que}`);
    assert.doesNotMatch(cab, re, `volvió ${que}`);
  }
});

// ── 4. Los filtros ────────────────────────────────────────────────────────────

const barraDe = (h: Hoja, editando: boolean, guardable = true) => {
  const f = () => {};
  return renderToStaticMarkup(createElement(BarraControles, {
    hoja: h, vista: {}, editando, guardable, hoy: '2026-10-11', onVista: f, onAgregar: f, onCambiar: f, onQuitar: f, onRestablecer: f,
  })).replace(/<style[\s\S]*?<\/style>/g, '');
};

test('«＋ Filtro» sólo EDITANDO (punto 7: mirando no se agregan filtros), y la fila no se dibuja si no hay nada', () => {
  const conPeriodo = hoja('h1', 'Marketing', { controles: [{ id: 'cp', tipo: 'periodo', preset: 'todo' }] });
  const mirando = barraDe(conPeriodo, false);
  assert.match(mirando, /class="bc-btn"/, 'el filtro de la hoja no está mirando (punto 7: «que siempre estén allí»)');
  assert.doesNotMatch(mirando, /dash-filtro|>Filtro</, 'se ofrece agregar un filtro mirando');
  assert.match(barraDe(conPeriodo, true), /data-recorrido="dash-filtro"/, 'editando no se puede agregar un filtro');
  assert.doesNotMatch(barraDe(conPeriodo, true, false), /dash-filtro/, 'sin poder guardar se ofrece agregar');
  // Una hoja sin filtros, mirando: nada (ni un hueco en la topbar).
  assert.equal(barraDe(hoja('h2', 'Vacía'), false), '');
});

test('el botón del período dice SÓLO el período; el rango va en el title (con el rango al lado se leía como dos filtros)', () => {
  const html = barraDe(hoja('h1', 'Marketing', { controles: [{ id: 'cp', tipo: 'periodo', preset: 'todo' }] }), false);
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(texto, 'Todo', `el botón dice «${texto}»`);
  assert.match(html, /title="Todo: 1 ene 2020 – 11 oct 2026"/);
});

test('el panel del período con el diseño de FechaFiltro: pastillas en dos columnas y «Personalizado» con Aplicar rango', () => {
  // El panel vive en un popover que sólo se monta abierto: se mira el fuente.
  const panel = bloque(CONTROLES, 'function PanelPeriodo(', 'const TOPE_VALORES_MS');
  assert.match(panel, /className="bc-presets"/);
  assert.match(panel, /className="bc-preset"/);
  assert.match(panel, /Aplicar rango/);
  assert.doesNotMatch(panel, /className="bc-dim"/, 'volvió el rango escrito al lado de cada período (lo «muy confuso»)');
  assert.match(CONTROLES, /\.bc-presets \{ display: grid; grid-template-columns: 1fr 1fr;/);
});

// ── 5. La barra de edición en el orden de Looker ─────────────────────────────

test('la barra de inserción: cada tipo del catálogo UNA vez, en el orden de Looker (código, imagen, texto, línea, formas)', () => {
  const tipos = BARRA_INSERTAR.flatMap((l) => (l.clase === 'suelto' ? [l.tipo] : [...l.tipos]));
  assert.deepEqual([...tipos].sort(), TIPOS_ELEMENTO.map((t) => t.id).sort(), 'un tipo del catálogo sin lugar en la barra, o repetido');
  const pos = (t: string) => tipos.indexOf(t as never);
  const orden = ['insertado', 'imagen', 'texto', 'linea', 'rectangulo'].map(pos);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, `fuera del orden de Looker: ${orden.join(', ')}`);
  assert.deepEqual(BARRA_INSERTAR.filter((l) => l.clase === 'menu').map((l) => (l.clase === 'menu' ? l.menu : '')), ['lineas', 'formas']);
  // Y la barra los dibuja: deshacer, datos, un gráfico, lo que se inserta, y el estilo al final.
  const barra = bloque(EDITOR, '<div className="lk-barra"', '\n      )}');
  const marcas = ['dash-deshacer', 'dash-datos', 'dash-anadir-grafico', 'dash-insertar', 'dash-estilo'].map((m) => barra.indexOf(`data-recorrido="${m}"`));
  assert.ok(marcas.every((i) => i > 0), `falta una pieza en la barra: ${marcas.join(', ')}`);
  assert.deepEqual([...marcas].sort((a, b) => a - b), marcas, 'la barra fuera del orden de Looker');
  assert.match(barra, /BARRA_INSERTAR\.map\(/);
  assert.match(barra, /Estilo de la hoja/);
});

// ── 6. Los botones de MaKo, chicos ───────────────────────────────────────────

test('los botones de MaKo de la tab son el logo sobre negro, sin texto (punto 3), y el de toda la app no se tocó', () => {
  assert.doesNotMatch(EDITOR, /MakoButton/, 'volvió el «✦ MaKo» con texto en cada gráfico');
  // Dibujado: UN botón, con lo que hace en el aria-label y el title, y ni una letra visible adentro.
  const html = renderToStaticMarkup(createElement(ChatMakoGrafico, { chartKey: 'k', titulo: 'Leads', contexto: '' }));
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.match(html, /aria-label="Conclusiones con MaKo"/);
  const texto = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').trim();
  assert.equal(texto, '', `el botón de MaKo lleva texto: «${texto}»`);
  assert.match(html, /width:26px;height:26px/, 'el botón de MaKo no es el chico');
  const nueva = sinComentarios(leer('app/dashboard/NuevaHoja.tsx'));
  assert.doesNotMatch(nueva, /variant="mako"/, 'el «Crear» de MaKo volvió a ser una pastilla con texto');
  assert.match(nueva, /<BotonMako lado=\{36\} title="Crear la hoja con MaKo"/);
  // El de la casa sigue con su texto para las otras tabs (Ads Manager, Marketing): la variante es local.
  assert.match(sinComentarios(leer('app/_components/ChartIA.tsx')), /<MakoStar size=\{14\} \/><MakoWord>MaKo<\/MakoWord>/);
});

// ── 7. Sin voseo en lo que se dibuja ─────────────────────────────────────────

// «cobré» es primera persona («Lo que cobré este mes», un ejemplo del pedido de «Nueva hoja»), no voseo.
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país', 'cobré']);
test('sin voseo en el texto nuevo de la topbar (el guard del repo no ve un archivo sin git add)', () => {
  for (const ruta of ['app/dashboard/Cabecera.tsx', 'app/dashboard/EditorInforme.tsx', 'app/dashboard/Galeria.tsx', 'app/dashboard/lectura-compartida.ts', 'app/dashboard/NuevaHoja.tsx']) {
    const codigo = sinComentarios(leer(ruta)).replace(/([\s;,)}\]])\/\/.*$/gm, '$1');
    assert.deepEqual(marcasDeVoseo(codigo), [], `${ruta}: voseo`);
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    assert.deepEqual(raras, [], `${ruta}: palabras con forma de voseo («elegí», «tocá»…)`);
  }
});
