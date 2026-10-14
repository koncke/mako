// =============================================================================
// La TOPBAR del Dashboard (tanda del 11/10/2026: «La topbar se tiene que ver igual a la de looker»; tanda v5 del
// 12/10/2026, puntos 3, 4, 5, 10 y 16) y el contrato del modo COMPARTIDO (el link sin sesión).
// =============================================================================
// Pedido de Martín, textual en app/admin/dev/dashboard/bitacora.ts. Lo que este archivo fija, porque ninguno de
// esos errores da un error:
//   · El contrato de lectura (app/dashboard/lectura-compartida.ts): sin link, el cuerpo de SIEMPRE a
//     /api/graficos; con link, la ruta del link con el token, la hoja y el id de cada cosa. Se EJECUTA.
//   · Que la pantalla lea SÓLO por ese contrato (los valores de una lista también: ./valores.ts) y que el link
//     no ofrezca lo que su endpoint no contesta: el detalle de un número, Editar, Compartir, el AI Analyst, la
//     guía, «Nueva hoja».
//   · La topbar: sin pestañas, «Nueva hoja» PRIMERA en el desplegable, el título y el subtítulo editables sin
//     entrar a Editar (sólo si se puede guardar), sin ▾ cuando no hay a dónde ir.
//   · v5: la búsqueda SIEMPRE a la vista y UN botón «Filtro» (también sin filtros), «Compartir» adentro del ⋮
//     con el modal de la casa, «Editar» en azul, la fila de una hoja pintada entera con su ⋮ al costado, y
//     editando la franja de arriba separada del lienzo.
//   · La barra de inserción en el orden de Looker, cada tipo del catálogo en UN lugar, sin «Formas».
//   · Los botones de MaKo chicos: sólo el logo, sin texto.
// Correr: npx tsx --test tests/dashboard-topbar.test.ts
//
// ⚠️ EL CABLEADO DE app/dashboard/EditorInforme.tsx LO HACE OTRO PAQUETE (P5 en la tanda v5): los asserts de
//    «el link compartido no guarda…» y «el «Filtro» de cada tarjeta…» fijan la interfaz que ese paquete monta
//    (I1 y el ⋮ con Compartir). Hasta que lo monte, esos dos dan ROJO, y es correcto: dicen qué falta enchufar.
//
// ── Roturas (11/10/2026, scratchpad/romper-topbar.mjs) — las que siguen valiendo para lo que no cambió:
//   · el link sin el id del componente en cada pedido     -> «con link, la ruta del link…»
//   · la hoja en el cuerpo de /api/graficos (sin link)     -> «sin link, cada lectura va a /api/graficos…»
//   · `guardable` sin `!compartido`                        -> «el link compartido no guarda…»
//   · volvió el texto «Restablecer el informe»             -> «lo que se fue…»
//   · el título no editable con un clic                    -> «la topbar: el título y el subtítulo…»
//   · «Nueva hoja» después de las hojas                    -> «el desplegable de las hojas…»
//   · el botón de MaKo con la palabra «MaKo» al lado       -> «los botones de MaKo…»
// ── Roturas de la tanda v5 (12/10/2026, scratchpad/p4v5-romper.mjs: una por vez, restaurada de MEMORIA y
//    comparada byte a byte, nunca con git). Base: 16 pasan / 1 falla (la que falla es «el link compartido no
//    guarda…»: el ⋮ con Compartir todavía no estaba enchufado en EditorInforme, de otro paquete). Cada rotura
//    tumbó UNA más (15 / 2), salvo las dos marcadas (14 / 3):
//   · sin la barra de búsqueda · el Filtro escondido sin filtros · sin «Esta hoja no tiene filtros»
//   · la búsqueda de un campo vuelve a «Búsqueda» · la ruta escrita a mano en ./valores.ts · la lista del link
//     sin su control · el submenú de una hoja sin ir al costado · el de abajo se cierra con un clic en el de
//     arriba · el submenú no se da vuelta · la fila abierta sin pintar · la fila sin la marca de la abierta · la
//     acción no cierra el submenú antes · editando, la topbar no se separa · la barra de edición sin filete · la
//     topbar salta al apretar Editar · el PDF imprime la franja · el rótulo mono vuelve a 12 · vuelve
//     var(--fs-meta) · una letra de 12 px · vuelve una regla de la tabla vieja · vuelven las formas · el
//     Desplegable no se pliega · «Conclusiones de MaKo» sin tope · «Conectar» sin onConectar · «Conectar» en un
//     pop-up · vuelven los bloques a la galería · vuelve la vista que reemplazaba la lista de hojas
//   · la Ficha también en la hoja (14 / 3) · un tipo del catálogo en dos lugares (14 / 3)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearElemento, sanearHoja, TIPOS_ELEMENTO, type Componente, type Hoja } from '../lib/graficos-catalogo';
import { marcasDeVoseo } from '../lib/puestas-data';
import { pedidoDeLectura, RUTA_LECTURA, RUTA_LECTURA_COMPARTIDA } from '../app/dashboard/lectura-compartida';
import { BarraSuperior, MenuHojas } from '../app/dashboard/Cabecera';
import { BARRA_INSERTAR, MenuElementos, MenuInsertar, lugaresInsertar } from '../app/dashboard/Galeria';
import { ChatMakoGrafico } from '../app/dashboard/PanelAnalista';
import { BarraControles } from '../app/dashboard/BarraControles';
import { CSS } from '../app/dashboard/editor-css';
import { CSS_CONTROLES } from '../app/dashboard/MenuFiltro';
import type { PedidoGrafico } from '../app/dashboard/exportar';

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
/** Una regla de CSS entera (`selector { … }`), por su selector exacto. */
const regla = (css: string, selector: string) => {
  const i = css.indexOf(`${selector} {`);
  assert.ok(i >= 0, `no encontré la regla «${selector}»`);
  return css.slice(i, css.indexOf('}', i) + 1);
};

const EDITOR = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
const CONTROLES = sinComentarios(leer('app/dashboard/BarraControles.tsx'));
const FILTRO = sinComentarios(leer('app/dashboard/MenuFiltro.tsx'));
const VALORES = sinComentarios(leer('app/dashboard/valores.ts'));
const CABECERA = sinComentarios(leer('app/dashboard/Cabecera.tsx'));
const GALERIA = sinComentarios(leer('app/dashboard/Galeria.tsx'));
const hoja = (id: string, nombre: string, extra: Record<string, unknown> = {}): Hoja => sanearHoja({ id, nombre, componentes: [], ...extra }, 0)!;

// ── 1. El contrato de lectura (lo ejecuta) ────────────────────────────────────

const PG = { grafico: { id: 'g1' }, desde: '2026-10-01', hasta: '2026-10-11', filtros: [], agrupar: null } as unknown as PedidoGrafico;

test('sin link, cada lectura va a /api/graficos con el cuerpo de SIEMPRE (ni token, ni hoja, ni ids de más)', () => {
  const d = pedidoDeLectura({ accion: 'datos', hojaId: 'h1', pedidos: [{ id: 'g1', pedido: PG }] }, null);
  assert.equal(d.ruta, RUTA_LECTURA);
  assert.deepEqual(d.cuerpo, { accion: 'datos', pedidos: [PG] }, 'el closer pasa por `closerPuedePedir`, que mira el cuerpo entero');
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
  // (La lectura de `bloques` se fue el 13/10/2026 con el código de los bloques: desde v5 no llegaba ninguno.)
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
  // Los datos salen de `pedidoDeLectura` con el link (desde v5 no hay bloques que leer: los migra el saneo).
  assert.equal((EDITOR.match(/pedidoDeLectura\(\{ accion: 'datos', hojaId: hoja\.id,[^\n]*\}, link\)/g) ?? []).length, 1);
  // Los valores de una lista, también: UN hook (./valores.ts) para con sesión y para el link, sin la ruta a mano.
  for (const [nombre, src] of [['BarraControles', CONTROLES], ['MenuFiltro', FILTRO], ['valores', VALORES]] as const) {
    assert.doesNotMatch(src, /'\/api\/(compartido\/)?graficos'/, `${nombre} escribe la ruta a mano`);
  }
  assert.match(VALORES, /pedidoDeLectura\(\s*\{ accion: 'valores', hojaId: link\?\.hojaId \?\? '', controlId: link\?\.controlId \?\? '', componenteId: link\?\.componenteId,/);
  assert.match(VALORES, /link\?\.compartido \?\? null,/);
  assert.doesNotMatch(CONTROLES + FILTRO, /useValoresCompartidos/, 'volvió la copia del pedido para el link');
  // La lista del desplegable le pasa SU control al link.
  assert.match(FILTRO, /const link: LecturaLink \| null = ctx\.lectura \? \{ \.\.\.ctx\.lectura, controlId: c\.id \} : null;/);
});

test('el link compartido no guarda, ni edita, ni comparte, ni abre el detalle de un número, ni el AI Analyst, ni la guía', () => {
  assert.match(EDITOR, /const guardable = !lecturaFallo && !soloLectura && !compartido;/);
  assert.match(EDITOR, /const soloMirar = soloLectura \|\| !!compartido;/);
  // El detalle de un número: sin `onDetalle`, el clic no lo ofrece (son listas de personas; el link lo contesta 403).
  assert.match(EDITOR, /onDetalle=\{editando \|\| soloMirar \? undefined :/);
  // v5 (punto 3): Compartir es un renglón del ⋮ y el modal va montado AFUERA de los menús (adentro, cerrar el
  // menú lo desmontaría), los dos con la guarda de guardable. «Editar» vuelve al azul.
  assert.match(EDITOR, /\{guardable && <BotonCompartir hojaId=\{hoja\.id\} titulo=\{hoja\.nombre\} abierto=\{compartir\} onCerrar=\{cerrarCompartir\} \/>\}/,
    'el modal de Compartir sin la guarda, o sin el modo controlado');
  assert.match(EDITOR, /\{!soloMirar && \(\s*<button type="button" className="lk-pill lk-pill--azul" data-recorrido=\{editando \? 'dash-ver' : 'dash-editar'\}/,
    '«Editar» no es el azul (punto 3)');
  const mas = bloque(EDITOR, "{menu?.tipo === 'mas' && (", '</Flotante>');
  // 14/10/2026: en la tab General (el mismo editor con otro informe) no se comparte: Compartir habla del informe del Dashboard.
  assert.match(mas, /\{guardable && !esGeneral && \(\s*<>\s*<RenglonCompartir onClick=\{abrirCompartir\} \/>/, 'Compartir no está en el ⋮ (o sin la guarda)');
  assert.doesNotMatch(mas, /<BotonCompartir/, 'el modal adentro del menú se desmonta al cerrarlo');
  assert.match(EDITOR, /const capaAbierta = [^;]*\bcompartir\b/, 'con el modal abierto, Suprimir borraría la tarjeta de atrás');
  assert.match(mas, /\{!soloMirar && \(\s*<>\s*<button[^>]*lk-opcion--mako/, 'el AI Analyst sin la guarda');
  assert.match(mas, /\{conGuia && \(/, 'la guía sin la guarda');
  assert.match(mas, /onClick=\{exportarCsv\}[\s\S]*onClick=\{exportarPdf\}/, 'Exportar se fue del ⋮');
  // «Nueva hoja» y las acciones de una hoja cuelgan de poder guardar; la ficha de una llamada, de no ser un link.
  assert.match(EDITOR, /const puedeNuevaHoja = guardable && tablero\.hojas\.length < MAX_HOJAS;/);
  // Y los filtros (de la hoja y de cada tarjeta) reciben el link para leer sus valores.
  assert.match(EDITOR, /<BarraControles\s[^>]*compartido=\{compartido\}/);
});

test('el «Filtro» de cada tarjeta es el MISMO de la topbar (interfaz I1), con el link; los chips sueltos se fueron', () => {
  assert.match(EDITOR, /<MenuFiltro modo="tarjeta" [^\n]*compartido=\{compartido\}/, 'la tarjeta no monta el MenuFiltro');
  assert.doesNotMatch(EDITOR, /<ChipsControles\b/, 'volvieron los chips de la tarjeta (punto 1: se cortaban)');
  assert.doesNotMatch(CONTROLES, /export function ChipsControles\b/);
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
  const acciones = { onRenombrar: () => {}, onDuplicar: () => {}, onCopiar: () => {}, onMover: () => {}, onEliminar: () => {} };
  const con = renderToStaticMarkup(createElement(MenuHojas, { hojas, activa: 'h2', puedeNueva: true, acciones, onIr: () => {}, onNueva: () => {} }));
  const iNueva = con.indexOf('Nueva hoja');
  assert.ok(iNueva > 0 && iNueva < con.indexOf('Marketing'), '«Nueva hoja» no es la primera opción (punto 1)');
  assert.equal((con.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(con, /aria-checked="true"[^>]*title="Comercial"/);
  assert.equal((con.match(/class="lk-hoja-mas"/g) ?? []).length, 3, 'cada hoja con su ⋮');
  // La FILA lleva la marca de la abierta (la que se pinta entera, punto 5 de v5).
  assert.match(con, /class="lk-hoja-fila" data-activa="true"/);
  const sin = renderToStaticMarkup(createElement(MenuHojas, { hojas, activa: 'h1', puedeNueva: false, acciones: null, onIr: () => {}, onNueva: () => {} }));
  assert.doesNotMatch(sin, /Nueva hoja|lk-hoja-mas/);
  // Pasadas siete, el buscador de la casa.
  const muchas = Array.from({ length: 8 }, (_, i) => hoja(`h${i}`, `Hoja ${i}`));
  assert.match(renderToStaticMarkup(createElement(MenuHojas, { hojas: muchas, activa: 'h0', puedeNueva: false, acciones: null, onIr: () => {}, onNueva: () => {} })), /aria-label="Buscar una hoja"/);
});

test('el ⋮ de una hoja abre un SEGUNDO desplegable al costado (no reemplaza la lista), y la fila se pinta entera', () => {
  const menu = bloque(CABECERA, 'export function MenuHojas(', '\n}\n');
  assert.match(menu, /<Flotante ancla=\{opciones\.ancla\} onCerrar=\{cerrarOpciones\} ancho=\{210\} lado="derecha" anidado>/, 'el submenú no es un Flotante al costado');
  assert.doesNotMatch(menu, /Volver a las hojas|lk-hojas-cab/, 'volvió la vista que reemplazaba la lista');
  // Cada acción cierra el submenú ANTES de actuar: Subir y Bajar mueven la fila a la que está anclado.
  assert.match(menu, /onClick=\{\(\) => \{ setOpciones\(null\); fn\(\); \}\}/);
  // El de abajo no se cierra con un clic adentro del de arriba.
  const flot = bloque(GALERIA, 'export function Flotante(', 'export function Galeria(');
  assert.match(flot, /if \(!anidado && el\?\.closest\('\[data-lk-anidado\]'\)\) return;/);
  assert.match(flot, /data-lk-anidado=\{anidado \|\| undefined\}/);
  // Y se da vuelta a la izquierda si no entra.
  assert.match(flot, /if \(left \+ w > vw - 8\) left = r\.left - w - 4;/);
  // La fila, no sólo el botón: el hover, la abierta y la que tiene su submenú abierto; el botón de adentro sin fondo.
  assert.match(regla(CSS, '.lk-hoja-fila:hover, .lk-hoja-fila[data-opciones]'), /background: var\(--velo-hover\)/);
  assert.match(regla(CSS, '.lk-hoja-fila[data-activa]'), /background: var\(--primary-bg\)/);
  assert.match(regla(CSS, '.lk-hoja-fila .lk-hoja-op, .lk-hoja-fila .lk-hoja-op:hover:not(:disabled), .lk-hoja-fila .lk-hoja-op[aria-checked="true"]'), /background: transparent/);
  assert.match(regla(CSS, '.lk-hoja-mas:hover, .lk-hoja-mas[aria-expanded="true"]'), /box-shadow: inset 0 0 0 999px var\(--velo-hover\)/);
});

test('lo que se fue: «Restablecer el informe», el ícono de la tab, los botones sueltos de AI Analyst y Exportar, y los bloques', () => {
  for (const [que, re] of [
    ['Restablecer el informe', /Restablecer el informe|tableroInicial\(|const restablecer = /], ['el ícono de la tab', /<Icon name="graphics"/],
    ['el botón suelto de AI Analyst', /<BotonAnalista\b|className="lk-analista"/], ['la pastilla de Exportar', /data-recorrido="dash-exportar"/],
    ['el «?» suelto', /<BotonRecorrido\b/],
  ] as const) {
    assert.doesNotMatch(EDITOR, re, `volvió ${que}`);
    assert.doesNotMatch(CABECERA, re, `volvió ${que}`);
  }
  // La galería sin «Bloques de MaKo» (v5: los bloques se migran a gráficos del catálogo).
  assert.doesNotMatch(GALERIA, /Bloques de MaKo|onBloque|BLOQUES/);
});

// ── 4. La búsqueda y el «Filtro» de la topbar ─────────────────────────────────

const barraDe = (h: Hoja, editando: boolean, guardable = true) => {
  const f = () => {};
  return renderToStaticMarkup(createElement(BarraControles, {
    hoja: h, vista: {}, editando, guardable, hoy: '2026-10-11', onVista: f, onAgregar: f, onCambiar: f, onQuitar: f, onRestablecer: f,
  })).replace(/<style[\s\S]*?<\/style>/g, '');
};

test('la barra de búsqueda y el «Filtro» están SIEMPRE (también en una hoja sin filtros); agregar, sólo editando', () => {
  for (const h of [hoja('h2', 'Vacía'), hoja('h1', 'Marketing', { controles: [{ id: 'cp', tipo: 'periodo', preset: 'todo' }] })]) {
    const mirando = barraDe(h, false);
    assert.match(mirando, /role="search"[^>]*data-recorrido="dash-buscar"/, 'la barra de búsqueda no está a la vista');
    assert.match(mirando, /aria-label="Buscar en la hoja"/);
    assert.match(mirando, /aria-label="Filtro"/, 'el botón «Filtro» no está (contrato v5: una hoja sin filtros lo muestra igual)');
    // La búsqueda a la IZQUIERDA del Filtro.
    assert.ok(mirando.indexOf('role="search"') < mirando.indexOf('aria-label="Filtro"'), 'la búsqueda va a la izquierda del Filtro');
    assert.doesNotMatch(mirando, /dash-filtro/, 'mirando se ofrece agregar un filtro');
    // Un botón por control se fue: el período está ADENTRO del desplegable.
    assert.doesNotMatch(mirando, /class="bc-btn"/, 'volvió un botón suelto por control en la topbar');
  }
  assert.match(barraDe(hoja('h2', 'Vacía'), true), /data-recorrido="dash-filtro"/, 'editando no se puede agregar un filtro');
  assert.doesNotMatch(barraDe(hoja('h2', 'Vacía'), true, false), /dash-filtro/, 'sin poder guardar se ofrece agregar');
});

test('adentro del «Filtro»: el período PRIMERO, «Esta hoja no tiene filtros» y el panel del período con el diseño de FechaFiltro', () => {
  const menu = bloque(FILTRO, 'export function MenuFiltro(', 'export function EstilosControles(');
  assert.match(menu, /Esta hoja no tiene filtros/);
  assert.match(menu, /\{!enTarjeta && !visibles\.length && !agrega && <div className="mf-vacio">/, 'el vacío sólo mirando (editando está «Agregar filtro»)');
  assert.match(FILTRO, /return \[\.\.\.controles\.filter\(\(c\) => c\.tipo === 'periodo'\), \.\.\.controles\.filter\(\(c\) => c\.tipo !== 'periodo'\)\];/);
  // El panel vive en un popover que sólo se monta abierto: se mira el fuente.
  const panel = bloque(FILTRO, 'export function PanelPeriodo(', 'export function PanelLista(');
  assert.match(panel, /className="bc-presets"/);
  assert.match(panel, /className="bc-preset"/);
  assert.match(panel, /Aplicar rango/);
  assert.doesNotMatch(panel, /className="bc-dim"/, 'volvió el rango escrito al lado de cada período (lo «muy confuso»)');
  assert.match(FILTRO, /\.bc-presets \{ display: grid; grid-template-columns: 1fr 1fr;/);
  // Y la búsqueda de un campo se llama «Contiene…» (la barra de la hoja es otra cosa).
  assert.match(FILTRO, /o\.id === 'texto' \? 'Contiene…' : o\.nombre/);
});

test('los pisos de letra: nada por debajo de 13 px en lo que dibujan los filtros, y el rótulo de una KPI en mono a 13', () => {
  const sinCom = CSS_CONTROLES.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(sinCom, /var\(--fs-meta\)/, 'var(--fs-meta) son 12 px: el piso es 13');
  // La única excepción es el número de la burbuja (18 px de alto, como la del Plan y la del CRM).
  for (const m of sinCom.matchAll(/([^{}]+)\{[^}]*font-size: (\d+(?:\.\d+)?)px/g)) {
    if (m[1].trim() === '.mf-num') continue;
    assert.ok(Number(m[2]) >= 13, `${m[1].trim()}: ${m[2]} px`);
  }
  assert.match(regla(CSS, '.lk-comp--mono .lk-comp-tit'), /font-size: 13px/);
  assert.doesNotMatch(CSS, /\.lk-tabla|\.lk-celda-/, 'volvieron las reglas de la tabla vieja (no las usa nadie)');
});

// ── 5. La franja de arriba editando (punto 10 de v5) ──────────────────────────

test('editando, la topbar y la barra de edición se separan del lienzo; mirando, la topbar es la de siempre', () => {
  assert.match(regla(CSS, '.lk-top'), /background: var\(--bg\)/, 'mirando, una sola superficie con el lienzo');
  assert.match(regla(CSS, '.lk--editando .lk-top'), /background: var\(--surface\)/);
  const barra = regla(CSS, '.lk--editando .lk-barra');
  assert.match(barra, /background: var\(--surface\)/);
  assert.match(barra, /border-bottom: 1px solid var\(--border\)/);
  assert.match(barra, /box-shadow: /);
  // La topbar NO cambia de padding: no salta al apretar Editar.
  assert.doesNotMatch(regla(CSS, '.lk--editando .lk-top'), /padding/);
  // Y el PDF no imprime la franja.
  assert.match(bloque(CSS, '@media print', '\n}\n'), /\.lk-top \{ padding: 0 0 10px; background: transparent !important; box-shadow: none !important;/);
});

// ── 6. La barra de inserción en el orden de Looker ─────────────────────────────

test('la barra de inserción: cada tipo del catálogo en UN lugar, en el orden de Looker, sin «Formas»', () => {
  const lugaresDe = new Map<string, number[]>();
  BARRA_INSERTAR.forEach((l, i) => {
    const tipos = l.clase === 'suelto' ? [l.tipo] : [...new Set(l.opciones.map((o) => o.tipo))];
    for (const t of tipos) lugaresDe.set(t, [...(lugaresDe.get(t) ?? []), i]);
  });
  // El bloque de General (14/10/2026) no va en esta barra: tiene su botón propio, «Bloques de General», que sólo existe en
  // la tab General (app/dashboard/EditorInforme.tsx, `esGeneral`). En el Dashboard no hay de dónde sacar lo que dibuja.
  assert.deepEqual([...lugaresDe.keys()].sort(), TIPOS_ELEMENTO.map((t) => t.id).filter((t) => t !== 'general').sort(), 'un tipo del catálogo sin lugar en la barra');
  for (const [t, ls] of lugaresDe) assert.equal(ls.length, 1, `«${t}» está en ${ls.length} lugares`);
  const pos = (t: string) => lugaresDe.get(t)![0];
  const orden = ['insertado', 'imagen', 'texto', 'linea', 'seccion', 'ia'].map(pos);
  assert.deepEqual([...orden].sort((a, b) => a - b), orden, `fuera del orden de Looker: ${orden.join(', ')}`);
  assert.deepEqual(BARRA_INSERTAR.filter((l) => l.clase === 'menu').map((l) => (l.clase === 'menu' ? l.menu : '')), ['lineas', 'estructura', 'mako']);
  assert.doesNotMatch(GALERIA, /'rectangulo'|'circulo'|menu: 'formas'|nombre: 'Formas'/, 'volvieron las formas');
  // El Desplegable es la MISMA sección, plegable (decisión 2 de Martín).
  const est = BARRA_INSERTAR.find((l) => l.clase === 'menu' && l.menu === 'estructura');
  assert.deepEqual(est?.clase === 'menu' ? est.opciones.map((o) => [o.nombre, o.tipo, o.inicial?.seccion?.plegable ?? false]) : [], [['Sección', 'seccion', false], ['Desplegable', 'seccion', true]]);
  // La Ficha, sólo en un pop-up.
  assert.ok(!lugaresInsertar(false).some((l) => l.clase === 'suelto' && l.tipo === 'entidad'));
  assert.ok(lugaresInsertar(true).some((l) => l.clase === 'suelto' && l.tipo === 'entidad'));
});

test('los menús de inserción: «Conclusiones de MaKo» apagado con 4 cajas, y «Conectar» sólo en una hoja y si alguien lo implementa', () => {
  const ia = (id: string) => sanearElemento({ id, tipo: 'ia' }) as Componente;
  const mako = (componentes: Componente[]) => renderToStaticMarkup(createElement(MenuElementos, { menu: 'mako', componentes, onElegir: () => {} }));
  assert.match(mako([ia('a'), ia('b'), ia('c')]), /<button type="button" role="menuitem" class="lk-opcion">[^]*?Conclusiones de MaKo/, 'con 3 cajas se puede');
  assert.match(mako([ia('a'), ia('b'), ia('c'), ia('d')]), /disabled=""[^>]*title="Hasta 4 por hoja"[^>]*>[^]*?Conclusiones de MaKo/, 'con 4 cajas, apagado y con su motivo');
  const lineas = (p: { onConectar?: () => void; enPopup?: boolean }) => renderToStaticMarkup(createElement(MenuElementos, { menu: 'lineas', onElegir: () => {}, ...p }));
  assert.match(lineas({ onConectar: () => {} }), /Conectar dos bloques/);
  assert.doesNotMatch(lineas({}), /Conectar/, 'sin onConectar: un renglón que no hace nada');
  assert.doesNotMatch(lineas({ onConectar: () => {}, enPopup: true }), /Conectar/, 'un pop-up no tiene conectores');
  // El del celular: todo lo de la barra, sin la Ficha en una hoja.
  const cel = renderToStaticMarkup(createElement(MenuInsertar, { onElegir: () => {} }));
  const nombres = [...cel.matchAll(/<span>([^<]+)<\/span><\/button>/g)].map((m) => m[1]);
  assert.deepEqual(nombres, ['Texto', 'Enlace', 'Insertar', 'Video', 'Imagen', 'Línea', 'Flecha', 'Sección', 'Desplegable', 'Conclusiones de MaKo', 'Acción']);
  assert.match(renderToStaticMarkup(createElement(MenuInsertar, { onElegir: () => {}, enPopup: true })), />Ficha</);
});

// ── 7. Los botones de MaKo, chicos ───────────────────────────────────────────

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
  // 13/10/2026: el pedido de «Nueva hoja» es la caja de «¿Qué vas a crear hoy?»; el que crea es su ↑ (tests/graficos-copia.test.ts).
  assert.match(nueva, /<CajaPedido titulo=\{\{ texto: TITULO_CAJA, nivel: 2 \}\}/);
  // El de la casa sigue con su texto para las otras tabs (Ads Manager, Marketing): la variante es local.
  assert.match(sinComentarios(leer('app/_components/ChartIA.tsx')), /<MakoStar size=\{14\} \/><MakoWord>MaKo<\/MakoWord>/);
});

// ── 8. Sin voseo en lo que se dibuja ─────────────────────────────────────────

// «cobré» es primera persona («Lo que cobré este mes», un ejemplo del pedido de «Nueva hoja»), no voseo. «encontré»
// también («No encontré ese dashboard», el mismo texto que «No encontré ese flujo» de Automations).
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país', 'cobré', 'encontré']);
test('sin voseo en el texto nuevo de la topbar (el guard del repo no ve un archivo sin git add)', () => {
  for (const ruta of ['app/dashboard/Cabecera.tsx', 'app/dashboard/EditorInforme.tsx', 'app/dashboard/Galeria.tsx', 'app/dashboard/lectura-compartida.ts', 'app/dashboard/NuevaHoja.tsx', 'app/dashboard/CompartirInforme.tsx', 'app/dashboard/BuscarEnHoja.tsx']) {
    const codigo = sinComentarios(leer(ruta)).replace(/([\s;,)}\]])\/\/.*$/gm, '$1');
    assert.deepEqual(marcasDeVoseo(codigo), [], `${ruta}: voseo`);
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    assert.deepEqual(raras, [], `${ruta}: palabras con forma de voseo («elegí», «tocá»…)`);
  }
});
