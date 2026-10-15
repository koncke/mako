// =============================================================================
// El clic derecho del tablero del CRM (Martín, 14/10/2026)
// =============================================================================
// Textual: «E implementa el click derecho en todo el CRM para diferentes acciones dependiendo donde
// clickee...» y «elimina todos los subtitulos de los botones de los 3 puntos». Esta tanda es el TABLERO
// (Kanban y tabla); la ficha va después.
// Piezas: la genérica app/_ui/MenuContextual.tsx, lo que sale según dónde en app/crm/menu-contextual-crm.ts
// (puro), y su cableado en app/crm/CrmBoard.tsx (`alClicDerecho`, `elegirContextual`), que pide las de
// lote a la barra (app/crm/AccionesLoteLeads.tsx, `ManijaLote`).
//
// Probado ROMPIÉNDOLO (14/10/2026, 25 roturas de a una, restaurando de la copia en memoria): lo que se rompió
// y cuántos fallaron, en el comentario de cada test. Ninguna rotura pasó en verde. Sano: 12/12.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EN_LINEA, OPCION_CRM, esLote, itemsCrm, opcionesCrm, tituloCrm,
  type ContextoCrm, type DatosMenuCrm, type IdOpcionCrm,
} from '../app/crm/menu-contextual-crm';
import { ListaMenuContextual, siguienteFoco, sinSeparadoresDeMas, ubicarEnVentana, ubicarSubmenu } from '../app/_ui/MenuContextual';
import type { ItemMenuContextual } from '../app/_ui/MenuContextual';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: la casa explica en el comentario lo que la línea hace, y un guard que no los saca se contesta solo. */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de `const <nombre> = ` hasta el cierre de su función (`\n  };`, el de 2 espacios). */
const cuerpo = (src: string, nombre: string) => {
  const ini = src.indexOf(`const ${nombre} = `);
  assert.ok(ini > 0, `no encontré ${nombre}`);
  return src.slice(ini, src.indexOf('\n  };', ini));
};

const lead = (o: Partial<Extract<ContextoCrm, { sobre: 'tarjeta' | 'fila' }>> = {}): ContextoCrm => ({
  sobre: 'tarjeta', conWhatsapp: false, conTelefono: false, conEmail: false,
  seleccionado: false, seleccionados: 0, hayEquipo: true, hayOtroFunnel: true, ...o,
});
const col = (o: Partial<Extract<ContextoCrm, { sobre: 'columna' }>> = {}): ContextoCrm => ({
  sobre: 'columna', mover: true, entrada: false, curso: null, borrable: true, ...o,
});
const finalEsBorrar = (xs: ReadonlyArray<IdOpcionCrm | null>, id: IdOpcionCrm) => {
  assert.equal(xs[xs.length - 1], id, `«${OPCION_CRM[id].texto}» va al final`);
  assert.equal(xs[xs.length - 2], null, 'y separado');
};

// ── Qué sale, según dónde ───────────────────────────────────────────────────────────────────

// Roturas: WhatsApp sin la condición `conWhatsapp` → 1 fallo. «Eliminar» antes de «Seleccionar» → 1 fallo.
test('una tarjeta: su menú, con WhatsApp y copiar sólo si hay el dato, y «Eliminar» al final y separado', () => {
  const pelado = opcionesCrm(lead());
  assert.deepEqual(pelado, ['abrir', 'mover_etapa', null, 'seleccionar', null, 'eliminar'], 'sin teléfono ni email no hay a dónde escribir ni qué copiar');
  const completo = opcionesCrm(lead({ conWhatsapp: true, conTelefono: true, conEmail: true }));
  assert.deepEqual(completo.slice(0, 6), ['abrir', 'mover_etapa', null, 'whatsapp', 'copiar_telefono', 'copiar_email']);
  finalEsBorrar(completo, 'eliminar');
  assert.deepEqual(opcionesCrm(lead({ sobre: 'fila' })), pelado, 'la fila de la tabla es el mismo lead: el mismo menú');
  assert.ok(sinSeparadoresDeMas(completo).length === completo.length, 'sin rayas de más');
});

// Roturas: `esLote` sin `c.seleccionado` (lote con el clic en uno sin tildar) → 1 fallo. `seleccionados > 0`
// en vez de `> 1` → 1 fallo (con uno solo tildado salía el lote).
test('con selección, el clic sobre un tildado actúa sobre TODOS; sobre uno sin tildar, sobre ése', () => {
  const sobreTildado = lead({ seleccionado: true, seleccionados: 12 });
  assert.equal(esLote(sobreTildado), true);
  const ids = opcionesCrm(sobreTildado);
  assert.deepEqual(ids, ['lote_etapa', 'lote_etiqueta', 'lote_closer', 'lote_setter', 'lote_funnel', null, 'lote_limpiar', null, 'lote_eliminar']);
  assert.equal(tituloCrm(sobreTildado), '12 leads', 'con doce tildados, «Eliminar» dice cuántos');
  assert.ok(!ids.includes('eliminar') && !ids.includes('abrir'), 'nada de un solo lead en el menú de doce');
  const sinTildar = lead({ seleccionado: false, seleccionados: 12 });
  assert.equal(esLote(sinTildar), false);
  assert.equal(opcionesCrm(sinTildar)[0], 'abrir', 'el clic sobre uno sin tildar es el menú de ése');
  assert.equal(tituloCrm(sinTildar), undefined);
  const unoSolo = opcionesCrm(lead({ seleccionado: true, seleccionados: 1 }));
  assert.ok(unoSolo.includes('quitar_seleccion') && !unoSolo.includes('seleccionar') && !unoSolo.includes('lote_etapa'), 'con uno solo tildado, es su menú');
  // Lo que la barra no dibuja, el menú tampoco: sin equipo no hay closer; sin otro funnel, no hay a dónde agregar.
  assert.deepEqual(opcionesCrm(lead({ seleccionado: true, seleccionados: 3, hayEquipo: false, hayOtroFunnel: false })),
    ['lote_etapa', 'lote_etiqueta', null, 'lote_limpiar', null, 'lote_eliminar']);
});

// Roturas: las campañas sin la condición `entrada` → 1 fallo. «Eliminar etapa» sin `borrable` → 1 fallo.
test('la columna: flechas si se arrastra, campañas en la entrada, el curso en Ganado, «Eliminar etapa» si el server la borra', () => {
  const comun = opcionesCrm(col());
  assert.deepEqual(comun, ['col_izquierda', 'col_derecha', null, 'col_nuevo_lead', null, 'col_renombrar', 'col_agregar', null, 'col_eliminar']);
  finalEsBorrar(comun, 'col_eliminar');
  // La entrada: no se mueve ni se borra (el server la fuerza primera), y es donde viven las campañas de Meta.
  assert.deepEqual(opcionesCrm(col({ mover: false, entrada: true, borrable: false })), ['col_nuevo_lead', null, 'col_campanas', 'col_renombrar', 'col_agregar']);
  assert.ok(!comun.includes('col_campanas'), 'las campañas sólo en la entrada');
  // Ganado: el rótulo dice lo que va a pasar al tocarlo (sin subtítulo «Prendido»/«Apagado»).
  assert.ok(opcionesCrm(col({ curso: true })).includes('col_curso_apagar'));
  assert.ok(opcionesCrm(col({ curso: false })).includes('col_curso_prender'));
  assert.ok(!comun.some((x) => x === 'col_curso_apagar' || x === 'col_curso_prender'), 'sin curso, ni la opción');
});

// Rotura: «Quitar la selección» sin la condición → 1 fallo.
test('el fondo: lo del «⋯» de la barra, y «Quitar la selección» sólo con selección', () => {
  assert.deepEqual(opcionesCrm({ sobre: 'fondo', seleccionados: 0 }), ['nuevo_lead', null, 'importar', 'exportar', null, 'editar_etapas']);
  assert.deepEqual(opcionesCrm({ sobre: 'fondo', seleccionados: 4 }).slice(-2), [null, 'lote_limpiar']);
});

// ── Los renglones ───────────────────────────────────────────────────────────────────────────

const DATOS: DatosMenuCrm = {
  etapas: [{ key: 'lead', label: 'Lead entrante', color: '#111' }, { key: 'agenda', label: 'Reunión 1', color: '#222' }, { key: 'ganado', label: 'Ganado', color: '#333' }],
  etapaActual: 'agenda',
  equipo: [{ nombre: 'Leila', foto: null }, { nombre: 'Mauricio', foto: 'https://x/y.png' }],
  etiquetas: null,
  funnels: [{ fid: null, nombre: 'Principal' }, { fid: 7, nombre: 'Curso' }],
  flechas: { izquierda: false, derecha: true },
};
const porId = (xs: ReturnType<typeof itemsCrm>, id: string) => xs.find((x): x is ItemMenuContextual => !!x && x.id === id);

// Roturas: «Mover a etapa» sin sacar `etapaActual` → 1 fallo. Sin juntar las flechas (`EN_LINEA`) → 2 fallos
// (éste y el del dibujo). Las flechas sin `deshabilitado` → 2 fallos (éste y el del dibujo).
test('los renglones: «Mover a etapa» sin la etapa donde ya está, las flechas en UNA línea, los submenús con sus valores', () => {
  const uno = itemsCrm(opcionesCrm(lead({ conTelefono: true })), DATOS);
  const mover = porId(uno, 'mover_etapa');
  assert.deepEqual(mover?.hijos?.map((h) => h.id), ['lead', 'ganado'], 'soltarlo donde ya está no hace nada: no se ofrece');
  assert.equal(mover?.hijos?.[0].color, '#111', 'una etapa va con su color, no con un ícono');
  assert.equal(porId(uno, 'eliminar')?.peligro, true);
  assert.equal(porId(uno, 'eliminar')?.icono, 'borrar', 'el tacho de la casa');

  const lote = itemsCrm(opcionesCrm(lead({ seleccionado: true, seleccionados: 3 })), DATOS);
  assert.deepEqual(porId(lote, 'lote_etapa')?.hijos?.map((h) => h.id), ['lead', 'agenda', 'ganado'], 'en lote, todas: los tildados están en etapas distintas');
  assert.deepEqual(porId(lote, 'lote_closer')?.hijos?.map((h) => [h.id, h.avatar]), [['Leila', null], ['Mauricio', 'https://x/y.png']], 'una persona va con su avatar');
  assert.deepEqual(porId(lote, 'lote_funnel')?.hijos?.map((h) => h.id), ['default', '7'], 'el del negocio viaja como «default», igual que en la barra');
  assert.equal(porId(lote, 'lote_etiqueta')?.vacio, 'Cargando…', 'sin lista todavía, se dice');
  const conEtiquetas = itemsCrm(['lote_etiqueta'], { ...DATOS, etiquetas: [{ id: 4, nombre: 'VIP', color: '#f00' }] });
  assert.deepEqual(porId(conEtiquetas, 'lote_etiqueta')?.hijos?.map((h) => [h.id, h.label]), [['4', 'VIP']]);

  const columna = itemsCrm(opcionesCrm(col()), DATOS);
  assert.equal(columna.filter((x) => x && (x.id === 'col_izquierda' || x.id === 'col_derecha')).length, 0, 'las flechas no van sueltas');
  const linea = columna[0];
  assert.deepEqual(linea?.enLinea?.map((b) => [b.id, !!b.deshabilitado]), [['col_izquierda', true], ['col_derecha', false]], 'la que no tiene a dónde ir, apagada');
  assert.equal(EN_LINEA.length, 1);
});

// ── El cableado en el tablero ───────────────────────────────────────────────────────────────

const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));

// Rotura: sacar un `case` del switch de `elegirContextual` → 1 fallo (una opción que se dibuja y no hace nada).
test('cada opción tiene su `case` en el tablero (ninguna se dibuja muerta)', () => {
  const fn = cuerpo(BOARD, 'elegirContextual');
  assert.ok(fn.length > 500, 'no encontré elegirContextual');
  for (const id of Object.keys(OPCION_CRM) as IdOpcionCrm[]) assert.match(fn, new RegExp(`case '${id}':`), `«${OPCION_CRM[id].texto}» no hace nada`);
});

// Roturas: devolverle `sub: cursoPrendido ? 'Prendido' : 'Apagado'` al «⋯» → 1 fallo. Cambiar «Cambiar el
// nombre» del menú por «Renombrar» → 1 fallo.
test('los textos de la columna son LOS MISMOS del «⋯», y el «⋯» ya no lleva subtítulos', () => {
  const ini = BOARD.indexOf('ariaLabel={`Opciones de la etapa ${c.label}`}');
  const opciones = BOARD.slice(ini, BOARD.indexOf('onChange={(v) => {', ini));
  assert.ok(ini > 0 && opciones.length > 300, 'no encontré las opciones del «⋯» de la columna');
  assert.doesNotMatch(opciones, /\bsub:/, '«elimina todos los subtitulos de los botones de los 3 puntos» (14/10/2026)');
  for (const id of ['col_campanas', 'col_curso_prender', 'col_curso_apagar', 'col_renombrar', 'col_agregar', 'col_eliminar'] as const) {
    assert.ok(opciones.includes(`'${OPCION_CRM[id].texto}'`), `«${OPCION_CRM[id].texto}» del clic derecho no es el texto del «⋯»`);
  }
});

// Roturas: sin la guarda de `defaultPrevented` → 1 fallo (la ficha y los desplegables viven adentro del
// <main> en el árbol de React y su clic derecho sube por el portal). Sin la de los campos → 1 fallo. Sin
// `data-lead-id` en la fila → 1 fallo. Sin el `onContextMenu` del <main> → 1 fallo.
test('el clic derecho cuelga de la raíz del tablero, con sus guardas, y las marcas en tarjeta y fila', () => {
  assert.match(BOARD, /<main className="crm-hover" style=\{\{[^}]*\}\} onContextMenu=\{alClicDerecho\}>/);
  const fn = BOARD.slice(BOARD.indexOf('const alClicDerecho = '), BOARD.indexOf('const copiarDato = '));
  assert.match(fn, /if \(e\.defaultPrevented \|\| !\(t instanceof Element\)\) return;/);
  assert.match(fn, /t\.closest\('\[role="dialog"\], \[role="menu"\], \[role="listbox"\]'\) \|\| document\.querySelector\('\[aria-modal="true"\]'\)\) return;/);
  assert.match(fn, /t\.closest\('input:not\(\[type="checkbox"\]\), textarea, select, \[contenteditable="true"\], \[contenteditable=""\], a\[href\]'\)\) return;/);
  assert.match(fn, /e\.preventDefault\(\);/);
  assert.match(BOARD, /data-leadcard\s+data-lead-id=\{l\.id\}/, 'la tarjeta');
  assert.match(BOARD, /<div key=\{l\.id\} onClick=\{\(\) => openDetail\(l\)\}\s+data-lead-id=\{l\.id\}/, 'la fila de la tabla');
  // El menú se dibuja al nivel del <main>: colgado de una tarjeta, elegir le haría el `onClick` a la tarjeta.
  assert.match(BOARD, /\{menuCtx && \(opcionesCrm\(menuCtx\.ctx\)\.includes\('lote_etiqueta'\)/);
});

// Roturas: «Mover a etapa» con un `setLeadStageAction` propio en vez de `handleDrop` → 1 fallo. La barra con
// una pregunta propia para el menú (`moverDeEtapa: (k) => setPide(...)`) → 1 fallo.
test('mover entra por `handleDrop`; las de lote, por la barra, con las MISMAS funciones que sus desplegables', () => {
  const fn = cuerpo(BOARD, 'elegirContextual');
  assert.match(fn, /case 'mover_etapa': if \(l && valor\) \{ idASoltar\.current = l\.id; handleDrop\(valor\); \} return;/);
  assert.doesNotMatch(fn, /Action\(/, 'el menú no escribe por su cuenta: llama a lo que el tablero ya hace');
  assert.match(fn, /case 'eliminar': if \(l\) setBorrarUno\(l\); return;/, 'la MISMA confirmación que el tacho de la fila');
  assert.match(BOARD, /<AccionesLoteLeads\s+ref=\{manijaLote\}/);
  const lote = sinComentarios(leer('app/crm/AccionesLoteLeads.tsx'));
  const manija = lote.slice(lote.indexOf('useImperativeHandle(ref'), lote.indexOf('if (n === 0) return null;'));
  assert.match(manija, /moverDeEtapa: pedirEtapa,/);
  assert.match(manija, /asignar: pedirPersona,/);
  assert.match(lote, /onChange=\{pedirEtapa\}/, 'el desplegable «Etapa» pregunta lo mismo');
  assert.match(lote, /onChange=\{\(v\) => pedirPersona\(campo, v\)\}/, 'y «Closer»/«Setter» también');
  assert.match(lote, /onChange=\{\(v\) => agregarAFunnel\(v === 'default' \? null : Number\(v\)\)\}/, 'y «Funnel»');
  assert.match(lote, /const destinos = destinosDeLote\(productos, funnelActivo\);/);
  assert.match(BOARD, /destinosDeLote\(funnels\.map/, 'el menú ofrece los MISMOS funnels que la barra');
});

// ── La pieza genérica ───────────────────────────────────────────────────────────────────────

// Roturas: `ubicarEnVentana` sin abrir hacia la izquierda (sólo el tope) → 1 fallo. `siguienteFoco` sin dar la
// vuelta → 1 fallo.
test('la pieza: se ubica sin salirse de la ventana, el foco da la vuelta, y no deja rayas de más', () => {
  assert.deepEqual(ubicarEnVentana(100, 100, 200, 300, 1280, 800), { x: 100, y: 100 }, 'entra: abre en el cursor');
  assert.deepEqual(ubicarEnVentana(1200, 100, 200, 300, 1280, 800), { x: 1000, y: 100 }, 'no entra a la derecha: abre hacia la izquierda del cursor');
  assert.deepEqual(ubicarEnVentana(100, 700, 200, 300, 1280, 800), { x: 100, y: 400 }, 'no entra abajo: abre hacia arriba');
  assert.deepEqual(ubicarEnVentana(150, 100, 200, 900, 300, 800), { x: 8, y: 8 }, 'más grande que la ventana: pegado al borde, nunca afuera');
  assert.deepEqual(ubicarSubmenu({ left: 1000, right: 1220, top: 50 }, 200, 100, 1280, 800), { x: 804, y: 44 }, 'el submenú que no entra a la derecha va a la izquierda');
  assert.deepEqual(ubicarSubmenu({ left: 100, right: 320, top: 50 }, 200, 100, 1280, 800), { x: 316, y: 44 });
  assert.equal(siguienteFoco(2, 3, 'ArrowDown'), 0, 'del último, al primero');
  assert.equal(siguienteFoco(0, 3, 'ArrowUp'), 2, 'del primero, al último');
  assert.equal(siguienteFoco(-1, 3, 'ArrowUp'), 2);
  assert.equal(siguienteFoco(1, 3, 'Home'), 0);
  assert.equal(siguienteFoco(0, 0, 'ArrowDown'), -1);
  assert.deepEqual(sinSeparadoresDeMas([null, 'a', null, null, 'b', null]), ['a', null, 'b']);
});

// Roturas: `useCapaModal(true)` sin `anidada` → 1 fallo. `stopPropagation` en vez de `stopImmediatePropagation` → 1 fallo.
test('la pieza: está en la pila como capa anidada (el Escape no cierra la ficha de abajo) y va al <body>', () => {
  const src = sinComentarios(leer('app/_ui/MenuContextual.tsx'));
  assert.match(src, /useCapaModal\(true, \{ anidada: true \}\)/);
  assert.match(src, /e\.stopImmediatePropagation\(\);/);
  assert.match(src, /if \(!esElDeArriba\(\)\) return;/, 'contesta sólo si es la capa de arriba');
  assert.match(src, /document\.addEventListener\('keydown', tecla, true\)/, 'en captura, sobre document, como todos los Escape de la casa');
  assert.match(src, /document\.body,\s*\);/, 'portal al <body>');
});

// Roturas: `itemsCrm` sin pasar `peligro` → 2 fallos (éste y el de los renglones; con el regex primero, que
// aceptaba el rojo del ícono, daba 1: éste pasaba). Las flechas sin `aria-label` → 1 fallo.
test('la pieza dibuja: rojo lo que borra, el submenú anunciado, la línea de flechas con sus nombres, apagado lo que no se puede', () => {
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, {
    items: itemsCrm(opcionesCrm(col()), DATOS).concat(itemsCrm(['mover_etapa'], DATOS)),
    onElegir: () => {},
  }));
  assert.match(html, /role="group" aria-label="Mover la etapa"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Mover a la izquierda"/, 'la flecha sin a dónde ir, apagada y con nombre');
  assert.match(html, /aria-label="Mover a la derecha"/);
  assert.match(html, /aria-haspopup="menu" aria-expanded="false"[^>]*>[\s\S]*?Mover a etapa/, 'el submenú se anuncia');
  // El RENGLÓN en rojo, no sólo el dibujo: el tacho de la casa (`icono: 'borrar'`) ya se pinta rojo solo, y un
  // regex que aceptara su color daba verde con el rótulo en negro.
  assert.match(html, /<button[^>]*style="[^"]*color:var\(--bad\)[^"]*"[^>]*>(?:(?!<\/button>)[\s\S])*Eliminar etapa<\/span><\/button>/, '«Eliminar» en rojo');
  assert.equal((html.match(/role="separator"/g) ?? []).length, 3, 'una raya entre cada grupo, ni una más');
});
