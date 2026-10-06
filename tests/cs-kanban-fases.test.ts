// =============================================================================
// Las FASES del tablero de entrega, y las tres decisiones de scroll y color
// =============================================================================
// `lib/servicio-etapas.ts` ya tiene sus tests de modelo (tests/servicio-etapas.test.ts).
// Lo que acá se fija es lo que NINGUNA función pura puede fijar: dónde está cableado cada
// pedazo en la pantalla. Son guards de CABLEADO, y cada uno cuida una decisión que falla
// en silencio — ninguna de las cuatro tira un error, todas producen un número plausible o
// una pantalla que se ve bien:
//
//  · si el reparto recibiera las columnas FILTRADAS por fase, los clientes de las
//    columnas escondidas saldrían como HUÉRFANOS y el pie del tablero anunciaría «12
//    clientes están en una etapa que ya no existe» — falso, y producido por mirar una fase;
//  · si la línea de arriba de la columna leyera `e.dot` en vez de `colorDeEtapa`, las
//    cinco columnas de una fase saldrían de cinco colores distintos: agrupar no se vería,
//    que es lo único que las fases vienen a mostrar;
//  · si el cuerpo de la columna perdiera su `overflow-y` o su `min-height: 0`, la columna
//    crece con su contenido y vuelve el scroll de la TAB, que es el pedido del 05/10;
//  · si el editor volviera a tener un botón de guardar, o guardara al MONTAR, abrir la
//    pantalla y cerrarla marcaría el servicio como DECLARADO — o sea que mirar
//    convertiría el default en una configuración que nadie escribió.
//
// ⚠️ CADA GUARD EXTRAE SU BLOQUE Y RECIÉN AHÍ BUSCA. Un `match` contra el archivo entero
// contesta «la palabra aparece en algún lado» —en un comentario, en el tipo gemelo, en la
// hoja de estilos— y eso ya dio verde sobre cuatro de cinco roturas en esta casa. Y se
// afirma el LARGO del recorte: si mañana mide tres veces esto, está mirando otra cosa.
//
// PROBADOS ROMPIÉNDOLOS (05/10/2026), con el bug real y no un typo. ONCE roturas, cada
// una cazada por exactamente el guard que le toca, y las once dando 9 pass / 1 fail:
//   1. el reparto recibiendo `visibles` en vez de `etapas` (huérfanos falsos).
//   2. `borderTop: 3px solid ${e.dot}` en vez de `${color}`.
//   3. «Sin clientes.» de vuelta en la columna vacía.
//   4. `.ke-col` sin su `max-height: 68vh` (vuelve el scroll de la tab).
//   5. `.ke-cards` sin `min-height: 0` (el overflow no recorta nada).
//   6. `empujarColumna` sin call site: la capacidad escrita y el gesto muerto.
//   7. la medida del `dragover` sin el `scrollTop` de la columna (el hueco apunta mal).
//   8. el editor sin la guarda de `primera.current`: guarda al MONTAR.
//   9. `sacar` sin su `confirm`: se lleva clientes y secuencias en silencio.
//  10. el upsert escribiendo `{ etapas }` sin `fases`: borra el color de todas las columnas.
//  11. el botón de filtrar sin su `<span>`: vuelve a ser un embudo mudo.
//  12. el conteo del editor contando FILAS (`Object.values(asignacion)`) en vez de
//      clientes: es el bug MEDIDO en el navegador —8 clientes, 3 filas, el tablero con 5
//      tarjetas en la primera columna y el editor diciendo 0— y lo que se pierde es el
//      «¿seguro?» al sacar esa columna. 10 pass / 1 fail.
//  13. el mismo conteo sobre `visibles` en vez de `clientes`: con una búsqueda puesta,
//      el aviso deja de contar a los que el buscador escondió. 10 pass / 1 fail.
//   Restaurado: 11 pass / 0 fail.
//
// ⚠️ Y LA PRIMERA CORRIDA DE ESTE ARCHIVO FALLÓ TRES VECES por la trampa que `sinComentarios`
// documenta: los guards de «esto NO está» encontraban lo que el archivo dice DE SÍ.
//
// LA TANDA DE LA CASILLA DEL CRM, LA FASE EN «Filtrar» Y EL EMPUJE EN `document` (05/10/2026,
// noche). PROBADOS ROMPIÉNDOLOS con un arnés que muta en memoria y restaura de memoria. Se
// midió con la sección del EDITOR a medio reescribir por otra tanda en paralelo (base: 28
// pass / 2 fail, los dos del editor), así que lo que se fija es que cada rotura sume
// EXACTAMENTE el fallo de su test y ningún otro:
//   · el empuje en el riel y no en `document` / sin `montarEmpuje()` en `agarrar` / sin
//     soltarlo en `drop` / el riel con `onDragOver` otra vez → 27 / 3, cae «el empuje…».
//   · `visibles` con el filtro viejo `(e.fase ?? '') === fase` → 27 / 3, cae «el reparto…».
//   · `width: 15` en el style de la casilla / sin `data-marcada` / la tarjeta sin
//     `mk-tarjeta-sel` → 27 / 3, cae «la casilla es la del CRM…».
//   · `.cl-n-fila` con gap 7 / `.cl-n-antes` sin `pointer-events` / el nombre envuelto aunque
//     no haya slot → 27 / 3, cae «la tarjeta compartida…».
//   · «Sin fase» sin las columnas de una fase borrada → 27 / 3, cae «columnasVisibles…».
//   · `opcionesDeFase` sin el filtro de columnas → 26 / 4: caen «opcionesDeFase…» Y
//     «faseVigente…», y está bien que sean dos — ofrecer «Sin fase» sin sueltas es lo que
//     deja que lo vigente sea un riel vacío. Sin el mínimo de dos → 27 / 3.
//   · `faseVigente` devolviendo lo pedido → 27 / 3. El botón sin contar la fase / `limpiar`
//     sin `onFase(null)` → 27 / 3, cae «"Filtrar" cuenta la fase…».
//   · al kanban `fase={fasePedida}` / «Seleccionar todos» con `visibles` / la sección también
//     en la tabla → 27 / 3, cae «la fase vive en la PANTALLA…».
//   Restaurado: 28 / 2, la base. (El ancla del primero de la última línea tuvo que llevar el
//   `\r\n`: ClientesApp.tsx es CRLF en el árbol y LF en HEAD.)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Las dos reglas puras del arrastre en lote. Se importan del archivo de la BARRA y no del
// kanban porque el kanban no se puede importar desde node: arrastra módulos con
// `server-only` (medido: «This module cannot be imported from a Client Component»).
import { quienesViajan } from '../app/customer-success/LoteClientes';
// Las tres reglas de la sección «Fase» del filtro. BarraClientes sí se importa desde node
// (tests/filtros-cartera.test.ts ya lo hace): no arrastra nada con `server-only`.
import { columnasVisibles, opcionesDeFase, faseVigente } from '../app/customer-success/BarraClientes';
import type { EtapaEntrega, FaseEntrega } from '../lib/servicio-etapas';

// ⚠️ SIN LOS `\r`: las anclas de `bloque` llevan `\n`, y con `core.autocrlf=true` un clon
// nuevo o un worktree trae estos archivos en CRLF — ahí las anclas no calzan y el guard
// falla sobre un archivo idéntico (AGENTS.md: «toda guarda que compare texto normaliza»).
const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * El pedazo que va de `abre` hasta `cierra`.
 *
 * ⚠️ EL CIERRE ES UN ANCLA REAL, nunca una cantidad de caracteres. Un `slice(i, i + 800)`
 * elegido a ojo es el mismo bug con otra cara: el universo sigue siendo más grande que la
 * pregunta, y en este repo un recorte así ya dio verde sobre una condición borrada porque
 * llegaba hasta la función de al lado, que tenía la misma.
 */
/**
 * El mismo texto SIN SUS COMENTARIOS.
 *
 * ⚠️ HACE FALTA, Y LO DEMOSTRÓ ESTE PROPIO ARCHIVO: la primera corrida falló tres veces
 * seguidas porque los guards de «esto NO está» encontraban lo que el archivo dice DE SÍ
 * — el ⛔ que explica que «Sin clientes.» se fue, el ⚠️ que dice que no se lee `e.dot`, y
 * el encabezado del editor que CITA el pedido («no existe el botón de "No cambiar
 * nada"»). Los tres son prosa correcta y los tres hacían fallar un guard sano.
 *
 * ⚠️ Y EL ORDEN IMPORTA: primero las líneas de comentario y después los bloques. Al
 * revés, un `/*` que aparezca dentro de un comentario de línea abre un bloque que se
 * cierra páginas más abajo y se come el código del medio sin que nada avise.
 *
 * Sólo las líneas que ARRANCAN con `//` — así un `https://` dentro de una cadena sigue
 * entero.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function bloque(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no encontré el ancla de apertura: ${abre}`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no encontré el ancla de cierre: ${cierra}`);
  return src.slice(i, j);
}

// ── El tablero ──────────────────────────────────────────────────────────────

const KANBAN = leer('app/customer-success/KanbanEntrega.tsx');
/** El cuerpo del componente, sin la hoja de estilos. ⚠️ El cierre era `function
 *  FasesChips`, que se fue con los chips el 05/10/2026: ahora es el arranque de la hoja. */
const RENDER = bloque(KANBAN, '  const { porEtapa, huerfanos } = useMemo(', 'const CSS = `');
/** La hoja, sola. */
const HOJA = bloque(KANBAN, 'const CSS = `', '\n`;');

/** El render sin prosa: lo que de verdad se ejecuta. */
const CODIGO = sinComentarios(RENDER);

test('el recorte del render y el de la hoja son lo que digo que son', () => {
  // Si estos largos se van al doble, el guard está mirando otra cosa y los de abajo
  // dejan de significar lo que dicen.
  // ⚠️ El techo subió de 16.000 a 24.000 el 05/10/2026 con la SELECCIÓN y el arrastre en
  // LOTE (la casilla, `quienesViajan`, `dondeCae` y su prosa): el render medía ~19.000 y
  // el recorte sigue yendo de la misma ancla a la misma ancla. No es «mirar otra cosa».
  // ⚠️ Y de 24.000 a 30.000 el mismo día, con la casilla del CRM y el empuje del riel en
  // `document` (los dos con su porqué al lado): midió 23.488, pegado al techo viejo. Los
  // chips de fase salieron del archivo, así que el cierre del recorte pasó a ser la hoja.
  assert.ok(RENDER.length > 3_000 && RENDER.length < 30_000, `el render mide ${RENDER.length}`);
  assert.ok(HOJA.length > 2_000 && HOJA.length < 12_000, `la hoja mide ${HOJA.length}`);
  assert.doesNotMatch(RENDER, /const CSS/, 'el render no puede incluir la hoja');
  assert.doesNotMatch(HOJA, /useMemo/, 'la hoja no puede incluir el render');
});

// ROTO: `repartirEnEtapas(visibles, …)` → 8 pass / 1 fail.
test('el reparto recibe las etapas ENTERAS, no las filtradas por fase', () => {
  const reparto = bloque(RENDER, 'repartirEnEtapas(', ')');
  assert.match(reparto, /repartirEnEtapas\(\s*etapas\s*,/, 'tiene que recibir `etapas`');
  assert.doesNotMatch(reparto, /visibles/, 'con las filtradas, los de las columnas escondidas son huérfanos');
  // Y el filtro existe, pero del lado del render: si no existiera, elegir una fase en
  // «Filtrar» no haría nada. Lo decide la MISMA función con la que el filtro arma sus
  // opciones, con la fase que llega por prop.
  assert.match(RENDER, /const visibles = columnasVisibles\(etapas, fases, fase\);/);
  assert.match(RENDER, /\{visibles\.map\(/, 'lo que se dibuja son las visibles');
});

// ROTO: `borderTop: 3px solid ${e.dot}` → 8 pass / 1 fail.
// ROTO: el punto de la cabecera con `e.dot` → 8 pass / 1 fail.
test('la línea y el punto de la columna salen de colorDeEtapa, no de e.dot', () => {
  const col = bloque(RENDER, '<section key={e.key}', '<ul className="ke-cards"');
  assert.match(RENDER, /const color = colorDeEtapa\(e, fases\);/, 'el color se resuelve UNA vez por columna');
  assert.match(col, /borderTop: `3px solid \$\{color\}`/);
  assert.match(col, /className="ke-dot" style=\{\{ background: color \}\}/);
  // ⚠️ Lo que se prohíbe es LEER `e.dot` en la pantalla, que es la rotura de verdad: el
  // campo sigue existiendo y es el respaldo de una etapa sin fase, pero quién gana se
  // decide en `colorDeEtapa` y en ningún otro lado.
  assert.doesNotMatch(CODIGO, /e\.dot/, 'el color propio no se lee acá: lo resuelve colorDeEtapa');
});

// ROTO: «Sin clientes.» de vuelta → 8 pass / 1 fail.
test('una columna vacía no escribe «Sin clientes.»', () => {
  assert.doesNotMatch(CODIGO, /Sin clientes/);
  assert.doesNotMatch(HOJA, /ke-vacia/, 'y la regla huérfana también se va');
  // Lo que queda diciendo que está vacía es el contador de la cabecera.
  assert.match(RENDER, /className="ke-n">\{cards\.length\}/);
});

// ROTO: sin `max-height: 68vh` en `.ke-col` → 8 pass / 1 fail.
// ROTO: sin `overflow-y: auto` en `.ke-cards` → 8 pass / 1 fail.
// ROTO: sin `min-height: 0` en `.ke-cards` → 8 pass / 1 fail.
test('la columna recorta y el cuerpo scrollea: la TAB no', () => {
  const col = bloque(HOJA, '.ke-col {', '}');
  assert.match(col, /max-height: 68vh/, 'sin tope, la columna crece y la tab vuelve a scrollear');
  const cuerpo = bloque(HOJA, '.ke-cards {', '}');
  assert.match(cuerpo, /overflow-y: auto/);
  // Sin esto el hijo flex no baja de su alto de contenido y el overflow no recorta NADA.
  assert.match(cuerpo, /min-height: 0/);
  // Y el riel sigue corriendo de costado, que es lo que el pedido SÍ quiere.
  assert.match(bloque(HOJA, '.ke-riel {', '}'), /overflow-x: auto/);
});

// ROTO: `empujarColumna` sin call site → 8 pass / 1 fail. Es el modo de falla de la casa:
// la capacidad escrita, el gesto muerto, el typecheck en verde.
test('el arrastre puede llegar al fondo de una columna que scrollea', () => {
  const fn = bloque(KANBAN, 'function empujarColumna(', '\n  }');
  assert.match(fn, /scrollHeight <= cuerpo\.clientHeight/, 'no empuja lo que no desborda');
  assert.match(fn, /cuerpo\.scrollTop \+= dir/);
  // El call site: adentro del `dragover`, que es el único evento que el navegador sigue
  // entregando durante un arrastre nativo.
  const over = bloque(RENDER, 'onDragOver={(ev) => {', 'onDragLeave');
  assert.match(over, /empujarColumna\(cuerpo, ev\.clientY\)/);
  // ⚠️ EL HUECO VOLVIÓ A SEGUIR AL CURSOR (06/10/2026): «si a un cliente lo arrastro abajo de
  // otro, no se ve esa animación», y la posición SE GUARDA (orden manual, mig 0196). Del 05 al
  // 06/10 el índice salía de los datos (`dondeCae`) porque la columna no tenía orden propio.
  // La altura del cursor se compara en las MISMAS coordenadas en que se midió: página +
  // scroll de la columna. Sin el `scrollTop`, después del auto-scroll el hueco apunta a otra
  // tarjeta.
  assert.match(over, /const y = ev\.clientY \+ window\.scrollY \+ \(cuerpo\?\.scrollTop \?\? 0\);/);
  assert.match(over, /indiceEnColumna\(medios\.current\[e\.key\] \?\? \[\], y\)/);
  // Y los puntos medios se miden UNA vez, al agarrar — nunca en el `dragover`.
  assert.doesNotMatch(sinComentarios(over), /getBoundingClientRect/, 'medir en cada dragover: el gesto se siente pegajoso y el índice oscila');
  const agarrar = sinComentarios(bloque(KANBAN, '  function agarrar(', '  function soltarGesto('));
  assert.match(agarrar, /medirColumnas\(\);/);
  const medir = bloque(KANBAN, '  function medirColumnas() {', '\n  }\n');
  assert.match(medir, /const dy = window\.scrollY \+ \(cuerpo\?\.scrollTop \?\? 0\);/);
});

// «Si lo muevo muy al costado, se sale del contenedor del kanban y deja de desplazar, eso
// no debe pasar» (Martín, 05/10/2026). El empuje colgaba del `onDragOver` del riel, y con
// el cursor fuera de su caja el navegador dejaba de mandarle el evento. Es el arreglo del
// CRM (`empujeDelRiel`, commit abbb7a12) con una diferencia que viene del gesto: allá vive
// en un estado y se monta con un efecto; acá vive en un ref y se monta en el `dragstart`.
// Ver el pie del archivo para las roturas medidas.
test('el empuje horizontal escucha en DOCUMENT, en captura, y se suelta al terminar', () => {
  const fn = bloque(KANBAN, '  function montarEmpuje() {', '\n  }\n');
  assert.ok(fn.length > 400 && fn.length < 2_600, `montarEmpuje mide ${fn.length}`);
  // ⚠️ Y ACEPTA EL `dragenter` adentro de una columna (06/10/2026): el hueco aparece debajo del
  // cursor quieto, y en esa vuelta Chromium manda `dragenter` sin `dragover` — sin cancelarlo,
  // soltar sobre el hueco recién abierto se pierde. Sólo en columnas, nunca en toda la página.
  assert.match(fn, /document\.addEventListener\('dragenter', aceptarEntrada, true\);/);
  assert.match(fn, /document\.removeEventListener\('dragenter', aceptarEntrada, true\);/);
  assert.match(fn, /closest\?\.\('\[data-etapa\]'\)\) e\.preventDefault\(\);/);
  assert.match(fn, /document\.addEventListener\('dragover', empujeDelRiel, true\);/,
    'en el riel, el evento se corta apenas el cursor sale de su caja');
  // Se suelta en `dragend` Y en `drop`, los dos: si no, queda empujando después de soltar.
  assert.match(fn, /document\.addEventListener\('dragend', fin, true\);/);
  assert.match(fn, /document\.addEventListener\('drop', fin, true\);/);
  assert.match(fn, /document\.removeEventListener\('dragover', empujeDelRiel, true\);/);
  // La cuenta del CRM, contra la caja del RIEL: pasado el borde sigue siendo verdadera.
  assert.match(fn, /e\.clientX < r\.left \+ BORDE \? -1 : e\.clientX > r\.right - BORDE \? 1 : 0/);
  assert.match(fn, /el\.scrollLeft \+= dir \* 18/);
  // ⚠️ El EMPUJE (el `dragover` de document) sin `preventDefault`: habilitaría soltar en
  // CUALQUIER punto de la página. (El `dragenter` de abajo sí lo lleva, y sólo en columnas.)
  const empuje = fn.slice(fn.indexOf('const empujeDelRiel'), fn.indexOf('const aceptarEntrada'));
  assert.ok(empuje.length > 100, `el empuje mide ${empuje.length}`);
  assert.doesNotMatch(sinComentarios(empuje), /preventDefault/);
  // Se monta al agarrar y se suelta con el gesto y al desmontar.
  const agarrar = sinComentarios(bloque(KANBAN, '  function agarrar(', '  function soltarGesto('));
  assert.match(agarrar, /montarEmpuje\(\);/, 'sin call site, la capacidad está escrita y el gesto muerto');
  const soltar = bloque(KANBAN, '  function soltarGesto() {', '\n  }');
  assert.match(soltar, /quitarEmpuje\.current\?\.\(\);/);
  assert.match(sinComentarios(KANBAN), /useEffect\(\(\) => \(\) => quitarEmpuje\.current\?\.\(\), \[\]\);/);
  // ⚠️ EL EMPUJE EN UN SOLO LUGAR: con el del riel también, correría al doble encima.
  assert.match(CODIGO, /<div className="ke-riel" ref=\{riel\}>/);
  assert.doesNotMatch(sinComentarios(KANBAN), /autoScroll/);
});

// ── La selección y el arrastre en LOTE ────────────────────────────────────────

// PROBADOS ROMPIÉNDOLOS (05/10/2026), cada rotura cazada por el test que le toca:
//   · `quienesViajan` sin el `seleccion.has(agarrado)` (arrastrar una SUELTA se llevaba
//     la selección entera) → 14 pass / 1 fail.
//   · `quienesViajan` devolviendo la selección sin filtrar por la lista (movía ids que la
//     búsqueda escondió) → 14 pass / 1 fail.
//   · (`dondeCae` y `soltarEn` por `onMoverLote` se fueron el 06/10/2026: soltar ahora
//     manda los que viajan y el vecino a la pantalla, `onSoltar`, que mueve y ordena — sus
//     guardas viven en tests/cs-orden-manual.test.ts.)
//   Restaurado: 15 pass / 0 fail.

test('qué viaja: la agarrada sola, salvo que esté MARCADA con otras', () => {
  const lista = [10, 20, 30, 40];
  // Suelta, aunque haya otras marcadas: viaja sola.
  assert.deepEqual(quienesViajan(20, new Set([10, 30]), lista), [20]);
  // Marcada pero única: sola.
  assert.deepEqual(quienesViajan(20, new Set([20]), lista), [20]);
  // Marcada con otras: todas, EN EL ORDEN DE LA LISTA (no el de la selección).
  assert.deepEqual(quienesViajan(30, new Set([40, 30, 10]), lista), [10, 30, 40]);
  // Una marcada que la búsqueda escondió no viaja: no está en pantalla.
  assert.deepEqual(quienesViajan(30, new Set([30, 99]), lista), [30]);
});

test('soltar manda lo que viaja y el VECINO del hueco; lo que viaja se decide al agarrar', () => {
  const fn = bloque(KANBAN, '  function soltarEn(', '\n  }');
  // El índice se lee ANTES de `soltarGesto()`, que borra el hueco.
  assert.ok(fn.indexOf('const idx = ins?.etapa === key') < fn.indexOf('soltarGesto();'), 'el índice se lee después de borrar el hueco');
  assert.match(fn, /onSoltar\(mano\.ids, key, antesDeQuien\(dibujadas, idx, mano\.ids\)\);/);
  const agarrar = bloque(KANBAN, '  function agarrar(', '\n  }');
  assert.match(agarrar, /quienesViajan\(leadId, seleccion, clientes\.map\(\(c\) => c\.leadId\)\)/);
});

// ⛔ ACÁ SE FIJABA LA CASILLA VIEJA —una pastilla absoluta en el envoltorio, a la vista en
// todas mientras hubiera algo marcado (`ke-hay-sel`)— y se reescribió el 05/10/2026 con el
// pedido de copiar la del CRM. Lo que se fija ahora son las tres cosas que, sin ellas, la
// del CRM se ve «arreglada» sin estarlo (tests/crm-casilla-tarjeta.test.ts las midió allá):
// el ancho NO va inline, la casilla es hija directa de una fila de gap 8, y la revela el
// hover de la tarjeta por la MISMA regla de globals.css.
test('la casilla es la del CRM: adelante del nombre, sin ancho inline y con la misma regla', () => {
  const casilla = bloque(RENDER, 'antesDelNombre={', 'chipExtra=');
  assert.match(casilla, /className="mk-sel-tarjeta"/);
  assert.match(casilla, /data-marcada=\{elegida \? '1' : '0'\}/, 'marcada, sigue a la vista sin el cursor');
  assert.match(casilla, /onClick=\{\(ev\) => \{ ev\.stopPropagation\(\); alternar\(c\.leadId\); \}\}/);
  assert.match(casilla, /onPointerDown=\{\(ev\) => ev\.stopPropagation\(\)\}/);
  const estilo = bloque(casilla, 'style={{', '}}');
  assert.doesNotMatch(estilo, /\bwidth\s*:/, 'un width inline le gana a .mk-sel-tarjeta y deja el nombre corrido');
  // La revela el hover de la tarjeta por el gancho GENÉRICO, no por un selector propio.
  assert.match(RENDER, /className=\{`ke-card mk-tarjeta-sel\$\{elegida \? ' ke-card-elegida' : ''\}`\}/);
  const css = leer('app/globals.css');
  const revela = bloque(css, '.mk-tarjeta-lead:hover .mk-sel-tarjeta,', '}');
  assert.match(revela, /\.mk-tarjeta-sel:hover \.mk-sel-tarjeta,/);
  assert.match(revela, /width: 15px; margin-right: 0; opacity: 1;/);
  // Y la vieja no vuelve: ni la pastilla ni la clase que la mostraba en todas.
  assert.doesNotMatch(sinComentarios(KANBAN), /ke-hay-sel|\bke-sel\b/);
  // Y el hueco es el del Plan: 64 de alto, no el alto entero de una tarjeta.
  assert.match(bloque(HOJA, '.ke-hueco {', '}'), /height: 64px/);
});

// La otra mitad de la casilla vive en la tarjeta COMPARTIDA (también la monta /admin). Lo
// que se fija: el slot va en una fila PROPIA de gap 8 —el `-8` de la regla lo cancela; con
// el 7 de `.cl-n` el nombre quedaría 1 px corrido en reposo— y le devuelve los clicks que
// el resto del contenido no recibe. Sin slot, el nombre no se envuelve en nada.
test('la tarjeta compartida hace lugar a la casilla sin tocar a quien no la pasa', () => {
  const src = leer('app/_components/TarjetaEntidad.tsx');
  const nombre = bloque(src, '<span className="cl-n">', '{chips &&');
  assert.match(nombre, /\{antesDelNombre != null \? \(/);
  assert.match(nombre, /<span className="cl-n-antes">\{antesDelNombre\}<\/span>/);
  assert.match(nombre, /\) : nombre\}/, 'sin slot, el nombre va pelado como siempre');
  const css = bloque(src, 'export const CSS_TARJETA = `', '\n`;');
  assert.match(bloque(css, '.cl-n-fila{', '}'), /gap:8px/);
  assert.match(bloque(css, '.cl-n-antes{', '}'), /display:contents; pointer-events:auto;/,
    'sin esto la casilla se ve y no se puede tildar');
  // Y el gap de `.cl-n`, que comparten TODAS las tarjetas, no se tocó.
  assert.match(bloque(css, '.cl-n{', '}'), /gap:7px/);
});

// El número que lleva la copia cuando viajan varios se cuelga como hijo DIRECTO de
// `.ke-card`, y `.ke-card > *` le da `width: 100%`. MEDIDO en el navegador (05/10/2026)
// arrastrando dos marcadas: con la regla, 27 px; sacándola de la hoja en vivo, 275 px —
// una barra negra con un «2» a la izquierda cruzando la tarjeta entera. Lo cubría a medias
// la regla de la casilla vieja (`.ke-card > .ke-sel`), que nombraba a la casilla y no al
// número; al irse la casilla quedó dicho para el que de verdad lo necesita.
// ROTO: sin `.ke-card > .ke-lleva { width: auto; }` → 35 pass / 1 fail sobre una base de
// 36 / 0; cae sólo éste.
test('el número de la copia no se estira al ancho de la tarjeta', () => {
  assert.match(HOJA, /\.ke-card > \* \{ width: 100%; \}/, 'si esta regla se va, este guard sobra');
  assert.match(HOJA, /\.ke-card > \.ke-lleva \{ width: auto; \}/);
});

// ── El editor ───────────────────────────────────────────────────────────────

const EDITOR = leer('app/customer-success/EtapasEntregaModal.tsx');
/** El editor sin prosa: lo que de verdad se ejecuta. */
const EDITOR_CODIGO = sinComentarios(EDITOR);

// ⚠️ ESTA SECCIÓN SE REESCRIBIÓ DOS VECES EL 05/10/2026. La segunda, con el editor
// REDISEÑADO («no me gusta el diseño de las fases y las etapas... es muy confuso, vuelve a
// diseñarlo... simple de entender, minimalista»): UNA lista, las fases como títulos, la ✕ y
// el asa sólo con el cursor, y ordenar y cambiar de fase como EL MISMO gesto (arrastrar, o
// Alt+↑/↓). Se fueron a propósito, y no hay que «devolverlas»: el selector de fase de cada
// fila, las flechas (`MoverPartido`), `mover`/`soltarEn`/`aFase` y el recuadro punteado.
// Lo que las reemplaza es PURO y se EJECUTA acá (`llevarEtapa`, `pasoDeEtapa`, `enOrden`,
// `llevarFase`), no sólo se busca en el texto.
//
// La primera reescritura (el editor copiado del CRM) dejó tres cosas que siguen valiendo:
//  · `if (primera.current)` era la guarda contra guardar al montar, y NO GUARDABA NADA:
//    Next 16 corre el App Router en Strict Mode y cada efecto corre DOS veces al montar —
//    la segunda ya encuentra la bandera en false—. MEDIDO con el editor de HEAD en
//    Chromium + Strict Mode: abrir y esperar 1,5 s → 1 guardado, o sea el servicio marcado
//    como DECLARADO por mirarlo (y bootear local escribe en la base de producción). Lo que
//    la reemplaza es comparar la FIRMA de lo que se mandaría contra la de lo último que se
//    mandó: no depende de cuántas veces corra el efecto. Con el editor nuevo: 0 guardados.
//  · «no hay `pie=`»: ahora hay uno, y es el «Eliminar producto» del CRM. Lo que esa regla
//    cuidaba —ningún botón de guardar ni de «No cambiar nada»— se sigue fijando, sobre el pie.
//  · `sacar` ya no es `async` con `await confirm(`: la pregunta es el `Confirm` declarativo
//    del CRM, porque el Escape de una pregunta abierta lo tiene que poder cerrar el editor
//    (ver el test del Escape) y el `useConfirm` con promesa no deja resolverla desde afuera.
//
// PROBADOS ROMPIÉNDOLOS (05/10/2026), cada rotura cazada por el test que le toca y por
// ninguno más (el resto del archivo, en verde):
//   1. sin `if (firma === enviada.current)` (guarda al montar).
//   2. `enviada` sembrada con '' en vez de la firma de las props (guarda al montar).
//   3. sin el `useEffect(() => () => enviar(), [enviar])` (cerrar pierde lo último).
//   4. los envíos en paralelo (`Promise.resolve().then` en vez de la cola).
//   5. `sacar` sin `if (!partes.length)` (pregunta aunque no haya nada que perder).
//   6-8. (eran `mover` / `aFase` / `soltarEn`, que se fueron con el rediseño: las guardas
//      de la entrada viven ahora en `llevarEtapa` y se prueban EJECUTÁNDOLA, abajo).
//   9. el Escape escuchado en burbuja (`false`): llega después del del Modal.
//  10. sin el `if (hayPregunta)`: el Escape de la pregunta cierra el editor.
//  11. `guardarNombre` mandando el nombre aunque no haya cambiado.
//  12. «+ Agregar fase» abajo de la lista.
//  13. el pie dibujado sin `onEliminar`.
//   Las de la primera reescritura dieron 20 pass / 1 fail con el archivo de entonces.
//
// Y LAS DEL REDISEÑO (05/10/2026, noche): DIECINUEVE roturas, cada una sola, cada una
// cazada por exactamente el test de su rótulo `ROTO`, y las diecinueve dieron 34 pass /
// 1 fail con el archivo de ese momento (35 tests, con las secciones de los otros paquetes).
// Restaurado de memoria y comparado byte a byte: 35 pass / 0 fail. El arnés que las corre
// es un script fuera del repo (scratchpad de la sesión), por la regla de los `tmp-`.
//
// ⚠️ Y LA TERCERA, EL 06/10/2026: «No hagas que el editor sea totalmente blanco que parezca
// que están flotando las cosas... que las fases sean contenedores grandes, y que el botón de
// nueva fase sea como una fase arriba del todo, así como hacemos lo de "Nuevo proyecto"». Cada
// fase pasó a ser una CAJA con sus filas adentro y «Nueva etapa» como última fila, y «Nueva
// fase» una caja de mentira punteada y apagada arriba de todo. Dos guards de acá abajo
// codificaban el dibujo anterior y se reescribieron: «nada punteado» (ahora: UN punteado, el
// de «Nueva fase») y «las filas salen de `g.etapas.forEach(`» (ahora un `map` adentro de la
// caja). Los de las cajas son nuevos, y el destino por caja (`destinoEn`) se EJECUTA.
//
// PROBADOS ROMPIÉNDOLOS (06/10/2026), cada rotura sola, con el resto restaurado. Se midieron
// con el archivo de ese momento (41 tests, con las secciones de los otros paquetes; la
// base, 41 pass / 0 fail), y las CATORCE dieron 40 pass / 1 fail cayendo EXACTAMENTE el test de su rótulo
// `ROTO (06/10)`. Restaurado de memoria y comparado byte a byte: 41 / 0.
//
// ⚠️ Y LA CUARTA, EL 06/10/2026 A LA TARDE: la LÍNEA que marcaba dónde cae lo arrastrado pasó
// a ser un HUECO que corre las filas (ver «El hueco», abajo). Un guard de acá codificaba el
// dibujo anterior y se reescribió: «un solo punteado» (ahora: las reglas punteadas son el
// hueco y «Nueva fase»). Los cuatro del hueco son nuevos. CATORCE roturas más, cada una sola
// sobre el archivo real (arnés `ed3/romper.cjs` del scratchpad), con la base en 44 / 0: las
// catorce dieron 43 pass / 1 fail cayendo exactamente su test, y restaurado de memoria y
// comparado byte a byte, 44 / 0.

// ROTO: 1 y 2 de la lista de arriba. Y del rediseño (05/10/2026), cada una sola → 34 pass /
// 1 fail: el efecto mandando `{ etapas: limpias, fases: tramos }` sin `enOrden`, y la firma
// inicial sin `enOrden` — ésta MEDIDA en el arnés (Chromium + Strict Mode, una lista con un
// grupo partido): rota, abrir y esperar 1,6 s → 1 guardado; restaurada → 0.
test('el editor guarda solo, y NO al montar', () => {
  const efecto = bloque(EDITOR, '    if (lista.length < MINIMO)', '  }, [lista, tramos, enviar]);');
  assert.ok(efecto.length > 300 && efecto.length < 1_500, `el efecto mide ${efecto.length}`);
  assert.match(efecto, /if \(firma === enviada\.current\) \{ pendiente\.current = null; return; \}/,
    'sin esto, abrir y cerrar marca el servicio como DECLARADO');
  assert.match(efecto, /setTimeout\(enviar, RESPIRO_MS\)/, 'con un respiro: renombrar es una tecla por letra');
  // Una lista que no se puede guardar lo DICE, pero eso se calcula al dibujar: un `setMal`
  // adentro del efecto quedaba puesto hasta el próximo guardado bueno (y es el error de
  // `react-hooks/set-state-in-effect`). ROTO (05/10/2026): el `setMal` de vuelta en el
  // efecto → 35 pass / 1 fail (el archivo ya tenía 36 tests); restaurado, 36 / 0.
  assert.doesNotMatch(efecto, /setMal\(/);
  assert.match(EDITOR_CODIGO, /const invalida = lista\.length < MINIMO/);
  assert.match(EDITOR_CODIGO, /\{\(invalida \|\| mal\) && <p style=\{ERROR\}>\{invalida \|\| mal\}<\/p>\}/);
  // Lo que se manda es EL ORDEN QUE SE VE (los grupos uno detrás del otro), y las fases
  // viajan en la MISMA llamada.
  assert.match(efecto, /const orden = enOrden\(limpias, tramos\);\s*const firma = firmaDe\(orden\.etapas, orden\.fases\);/);
  assert.match(efecto, /pendiente\.current = \{ etapas: orden\.etapas, fases: orden\.fases, firma \}/,
    'las fases viajan en la MISMA llamada');
  // La firma de partida es la de lo que vino del server: con una vacía, montar ya «cambió».
  // ⚠️ Y EN EL MISMO ORDEN: sin `enOrden` acá, una lista que llega con un grupo PARTIDO
  // «cambia» al abrir y se guarda sin que nadie toque nada (medido en el arnés: 1 guardado).
  const inicial = bloque(EDITOR, '  const [firmaInicial] = useState(() => {', '\n  });');
  assert.match(inicial, /const o = enOrden\(limpiar\(etapas\) \?\? etapas, fases\);\s*return firmaDe\(o\.etapas, o\.fases\);/);
  assert.match(EDITOR_CODIGO, /const enviada = useRef\(firmaInicial\);/);
  assert.doesNotMatch(EDITOR_CODIGO, /primera\.current/, 'una bandera de «primer render» no sobrevive a Strict Mode');
  const envio = bloque(EDITOR, '  const enviar = useCallback(', '  }, []);');
  assert.match(envio, /guardarRef\.current\(p\.etapas, p\.fases\)/);
  // Y ningún botón de guardar: el pie es sólo «Eliminar producto».
  assert.doesNotMatch(EDITOR_CODIGO, /No cambiar nada/);
  assert.doesNotMatch(EDITOR_CODIGO, /Guardar las etapas/);
});

// ROTO: 13 de la lista de arriba.
test('el pie es «Eliminar producto», y sólo si alguien lo puede hacer', () => {
  const pie = sinComentarios(bloque(EDITOR, '        pie={', '\n        }\n'));
  assert.match(pie, /onEliminar \? \(/, 'sin `onEliminar` no se dibuja: un «Eliminar» que contesta «no se puede» se lee como roto');
  assert.match(pie, /Eliminar producto/);
  assert.doesNotMatch(pie, /Guardar|Cancelar|No cambiar/);
  // Eliminar PREGUNTA: el botón abre la pregunta y nunca llama directo.
  const eliminar = bloque(EDITOR, '  const eliminar = () => {', '\n  };');
  assert.match(eliminar, /setConfirmar\(\{/);
  assert.doesNotMatch(eliminar, /onEliminar\(\)/);
});

// ROTO: 3 y 4 de la lista de arriba. Es el bug MEDIDO con el editor de HEAD: renombrar una
// columna y cerrar en el mismo medio segundo → 0 guardados; con el nuevo, 1.
test('cerrar no pierde lo que esperaba el respiro, y los guardados salen en fila', () => {
  assert.match(EDITOR_CODIGO, /useEffect\(\(\) => \(\) => enviar\(\), \[enviar\]\);/);
  // Dos upserts del objeto ENTERO que salen a la vez pueden llegar al revés: gana el viejo.
  const envio = bloque(EDITOR, '  const enviar = useCallback(', '  }, []);');
  assert.match(envio, /cola\.current = cola\.current\.then\(/);
});

// ROTO: 5 de la lista de arriba.
test('sacar una columna con gente adentro avisa ANTES, y con el número', () => {
  const fn = bloque(EDITOR, '  const sacar = (e: EtapaEntrega) => {', '\n  };');
  assert.match(fn, /conteo\[e\.key\]/, 'y dice cuántos clientes');
  assert.match(fn, /secuencias\?\.\[e\.key\]/, 'y cuántas secuencias');
  // «No pude revisar» no es «no hay»: con la lectura caída se avisa igual.
  assert.match(fn, /secuencias === null/);
  // Sin nada que perder no hay fricción —queda el «Deshacer», como en el CRM—; con algo,
  // la única salida es la que va ADENTRO de la pregunta.
  assert.match(fn, /if \(!partes\.length\) \{ hacer\(\); return; \}/);
  assert.match(fn, /setConfirmar\(\{[\s\S]*\bhacer,\s*\}\);/);
  assert.equal((fn.match(/hacer\(\)/g) ?? []).length, 1, 'preguntar después de sacar no es preguntar');
});

// ── El modelo de la lista del editor: se EJECUTA ────────────────────────────
// Se importa adentro de cada test y no arriba del archivo: los imports de arriba son de
// todo el archivo, y el modal se importa en node sin problema (medido: ~0,5 s, sin
// `server-only`). Los nombres llevan `Ed` porque otra sección ya declara `E` y `F`.
const modeloEditor = () => import('../app/customer-success/EtapasEntregaModal');
type EtapaEd = { key: string; label: string; tone: 'info'; dot: string; fase?: string };
const etEd = (key: string, fase?: string): EtapaEd => ({ key, label: key, tone: 'info', dot: '#000000', ...(fase ? { fase } : {}) });
const faEd = (key: string) => ({ key, label: key, tone: 'info' as const, dot: '#111111' });
/** La lista como se lee: «clave:fase», separadas por espacio. */
const verEd = (l: readonly { key: string; fase?: string }[]) => l.map((e) => e.key + (e.fase ? ':' + e.fase : '')).join(' ');
// La entrada en A, una más en A, dos en B y una suelta.
const LISTA_ED = [etEd('en', 'f_a'), etEd('a1', 'f_a'), etEd('b1', 'f_b'), etEd('b2', 'f_b'), etEd('s1')];
const FASES_ED = [faEd('f_a'), faEd('f_b')];

// ROTO (05/10/2026), cada una sola, con el resto restaurado:
//   · `llevarEtapa` con `const piso = 0` (algo cae ANTES de la entrada) → 34 pass / 1 fail.
//   · la entrada que cambia de grupo SIN subir su grupo (`return aplanar(grupos)`) → 34/1.
//   · `conFase` dejando `fase: undefined` en vez de borrarla → 34/1.
//   · `pasoDeEtapa` sin cruzar de grupo en el borde (`return [...lista]`) → 34/1.
test('ordenar y cambiar de fase son el MISMO gesto, y nada va antes de la entrada', async () => {
  const { llevarEtapa, pasoDeEtapa } = await modeloEditor();
  // Soltar adentro de OTRO grupo la pasa a esa fase, en el lugar donde se soltó.
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'b2', 'f_a', 1)), 'en:f_a b2:f_a a1:f_a b1:f_b s1');
  // En el grupo de la entrada, el lugar 0 no existe: cae después de ella.
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'b1', 'f_a', 0)), 'en:f_a b1:f_a a1:f_a b2:f_b s1');
  // Dentro del mismo grupo, el lugar se cuenta CON la arrastrada adentro (soltar «antes de
  // la fila 3» con la 1 agarrada).
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'b1', 'f_b', 2)), 'en:f_a a1:f_a b2:f_b b1:f_b s1');
  // «Sin fase» le SACA la clave, no la deja en `undefined`.
  const suelta = llevarEtapa(LISTA_ED, FASES_ED, 'a1', '', 1);
  assert.equal(verEd(suelta), 'en:f_a b1:f_b b2:f_b s1 a1');
  assert.equal('fase' in suelta.find((e) => e.key === 'a1')!, false);
  // Un grupo que no existe no se inventa.
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'a1', 'f_zz', 0)), verEd(LISTA_ED));
  // La ENTRADA no cambia de lugar: va PRIMERA de la otra fase y esa fase pasa arriba.
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'en', 'f_b', 2)), 'en:f_b b1:f_b b2:f_b a1:f_a s1');
  assert.equal(verEd(llevarEtapa(LISTA_ED, FASES_ED, 'en', 'f_a', 1)), verEd(LISTA_ED), 'en su propio grupo no tiene a dónde ir');

  // El teclado: un lugar por vez, y en el borde pasa al grupo de al lado.
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 'b1', -1)), 'en:f_a a1:f_a b1:f_a b2:f_b s1');
  // Al bajar del último de un grupo cae PRIMERO en el siguiente: en pantalla queda donde
  // estaba y lo que cambia es el título de arriba.
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 'a1', 1)), 'en:f_a a1:f_b b1:f_b b2:f_b s1');
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 'a1', -1)), verEd(LISTA_ED), 'no pasa por encima de la entrada');
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 's1', 1)), verEd(LISTA_ED), 'la última no tiene a dónde bajar');
  // La entrada recorre las fases: «Sin fase» primero, después cada una en su orden.
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 'en', 1)), 'en:f_b b1:f_b b2:f_b a1:f_a s1');
  assert.equal(verEd(pasoDeEtapa(LISTA_ED, FASES_ED, 'en', -1)), 'en s1 a1:f_a b1:f_b b2:f_b');
});

// ROTO (05/10/2026): `enOrden` sin ordenar las fases (`fases: [...fases]`) → 34 pass / 1 fail.
// ROTO: `gruposDe` sin el «Sin fase» vacío de `conSueltas` → 34 pass / 1 fail.
test('lo que se guarda es el orden que se VE, y «Sin fase» existe como destino', async () => {
  const { enOrden, gruposDe } = await modeloEditor();
  // Un grupo PARTIDO (lo que dejaba el selector de antes: b1 de B entre dos de A) se guarda
  // junto, y las fases en el orden en que aparecen las columnas.
  const partida = [etEd('en', 'f_a'), etEd('b1', 'f_b'), etEd('a1', 'f_a'), etEd('s1')];
  const o = enOrden(partida, [faEd('f_b'), faEd('f_a')]);
  assert.equal(verEd(o.etapas), 'en:f_a a1:f_a b1:f_b s1');
  assert.deepEqual(o.fases.map((f) => f.key), ['f_a', 'f_b']);
  // Sobre una lista que ya está en orden no cambia nada: abrir y cerrar no escribe.
  assert.equal(verEd(enOrden(LISTA_ED, FASES_ED).etapas), verEd(LISTA_ED));
  // Una fase VACÍA va al final (no tiene lugar en el tablero), y «Sin fase» aparece como
  // destino sólo si se pide y si no hay ninguna etapa suelta.
  const todas = [etEd('en', 'f_a'), etEd('b1', 'f_b')];
  assert.deepEqual(gruposDe(todas, [...FASES_ED, faEd('f_c')]).map((g) => g.clave), ['f_a', 'f_b', 'f_c']);
  assert.deepEqual(gruposDe(todas, FASES_ED, true).map((g) => g.clave), ['f_a', 'f_b', '']);
  assert.deepEqual(gruposDe(LISTA_ED, FASES_ED, true).map((g) => g.clave), ['f_a', 'f_b', ''], 'no lo duplica');
  assert.deepEqual(gruposDe([etEd('x'), etEd('y')], [], true).map((g) => g.clave), [''], 'sin fases, ni lo agrega');
});

// ROTO (05/10/2026): `rangoDeFase` con `gi < 0` en vez de `gi <= 0` (el grupo de la entrada
// se puede mover) → 34 pass / 1 fail.
test('las fases se reordenan, pero el grupo de la entrada queda primero', async () => {
  const { llevarFase, pasoDeFase, rangoDeFase, gruposDe } = await modeloEditor();
  const g = gruposDe(LISTA_ED, FASES_ED);
  assert.equal(rangoDeFase(g, 'f_a'), null, 'el de la entrada no se mueve');
  assert.equal(rangoDeFase(g, ''), null, '«Sin fase» no se arrastra');
  assert.deepEqual(rangoDeFase(g, 'f_b'), [1, 3]);
  assert.equal(verEd(llevarFase(LISTA_ED, FASES_ED, 'f_b', 3).etapas), 'en:f_a a1:f_a s1 b1:f_b b2:f_b');
  assert.equal(verEd(pasoDeFase(LISTA_ED, FASES_ED, 'f_b', -1).etapas), verEd(LISTA_ED), 'no sube por encima de la entrada');
  // Una vacía se mueve entre las vacías: cambia el orden de las FASES, no de las etapas.
  const F4 = [...FASES_ED, faEd('f_c'), faEd('f_d')];
  assert.deepEqual(rangoDeFase(gruposDe(LISTA_ED, F4), 'f_d'), [3, 5]);
  assert.deepEqual(llevarFase(LISTA_ED, F4, 'f_d', 3).fases.map((f) => f.key), ['f_a', 'f_b', 'f_d', 'f_c']);
});

// ROTO (05/10/2026), cada una sola:
//   · `medir` tratando a la entrada como a las demás (`grupo === grupoEntrada && slot === 0`
//     para todas): la entrada no podía cambiar de fase arrastrándola → 34 pass / 1 fail.
//   · `agregarEtapa` con `return [...v, nueva]` (la nueva al final de TODO) → 34/1.
//   · el soltar de la etapa sin `llevarEtapa` → 34/1.
test('la pantalla usa el modelo: soltar, el teclado, agregar y la entrada', () => {
  const soltar = bloque(EDITOR, '  const aplicarDestino = () => {', '\n  };');
  assert.match(soltar, /setLista\(llevarEtapa\(l, t, a\.key, d\.grupo, d\.slot\)\);/);
  assert.match(soltar, /const r = llevarFase\(l, t, a\.clave, d\.slot\);/);
  const tecla = bloque(EDITOR, '  const teclaEtapa = (', '\n  };');
  assert.match(tecla, /if \(!ev\.altKey \|\| \(ev\.key !== 'ArrowUp' && ev\.key !== 'ArrowDown'\)\) return;/);
  assert.match(tecla, /pasoDeEtapa\(lista, tramos, e\.key, ev\.key === 'ArrowUp' \? -1 : 1\)/);
  assert.match(bloque(EDITOR, '  const teclaFase = (', '\n  };'), /pasoDeFase\(lista, tramos, f\.key,/);
  // Dónde se puede soltar: la entrada SÓLO en el lugar 0 de un grupo (cambia de fase y queda
  // primera); lo demás, en cualquier lado menos antes de ella.
  const medir = bloque(EDITOR, '  const medir = useCallback(() => {', '\n  }, []);');
  assert.match(medir, /if \(agarroEntrada \? slot !== 0 : \(grupo === grupoEntrada && slot === 0\)\) continue;/);
  // Una etapa nueva cae al final de SU grupo.
  const agregar = bloque(EDITOR, '  const agregarEtapa = (label: string, fase?: string) => {', '\n  };');
  assert.match(agregar, /return aplanar\(gruposDe\(\[\.\.\.v, nueva\], tramos\)\);/);
  // La entrada no tiene ✕ (ni se quita), y su arrastre existe sólo si hay fases a las que ir.
  assert.match(EDITOR_CODIGO, /\{!entra \? \(\s*<AccionFila/);
  assert.match(EDITOR_CODIGO, /const arrastrable = \(!entra \|\| hayFases\) && !editando;/);
});

// ROTO (05/10/2026), cada una sola:
//   · la ✕ de la etapa sin `className="ee-oculto"` (dibujada siempre) → 34 pass / 1 fail.
//   · la regla `:focus-within` sacada de la hoja (con Tab, la ✕ no aparece nunca) → 34/1.
test('las filas van calladas: la ✕ y el asa aparecen sólo con el cursor o el foco', () => {
  const hoja = bloque(EDITOR, 'const CSS = [', "].join('\\n');");
  assert.match(hoja, /'\.ee-oculto\{opacity:0;/, 'con opacity y no display: guarda su lugar y recibe el foco');
  assert.match(hoja, /\.ee-fila:hover \.ee-oculto,\.ee-fila:focus-within \.ee-oculto/);
  assert.match(hoja, /@media \(hover:none\)\{\.ee-oculto\{opacity:1\}\}/, 'sin cursor no hay cómo descubrirlas');
  // La ✕ de la etapa y la de la fase.
  assert.equal((EDITOR_CODIGO.match(/<AccionFila className="ee-oculto"/g) ?? []).length, 2);
  // Lo que se fue con el rediseño no vuelve: el selector de fase por fila, las flechas, el
  // recuadro punteado POR GRUPO y los rótulos en versalitas.
  assert.doesNotMatch(EDITOR_CODIGO, /<select\b/);
  assert.doesNotMatch(EDITOR_CODIGO, /MoverPartido/);
  assert.doesNotMatch(EDITOR_CODIGO, /uppercase/);
  // ⚠️ En reposo el punteado es UNO, el de «Nueva fase» (06/10/2026): «dashed» no se prohíbe
  // entero, se cuenta. ROTO (06/10): `.ee-mas` con `border:1px dashed var(--border-strong)`
  // (vuelve el recuadro punteado al pie de cada caja) → 40 pass / 1 fail.
  // Desde el hueco (06/10, tarde) hay DOS reglas punteadas: «Nueva fase» y `.ee-hueco`, que
  // sólo existe durante un arrastre. Lo que se cuida es lo mismo: que el pie de cada caja no
  // vuelva a ser un recuadro. ROTO otra vez con el `.ee-mas` punteado → 43 pass / 1 fail.
  // Hasta la `}` de la regla y no hasta la comilla: varias se cortan para meter una constante
  // (`' + FILA + '`), y con `[^']*` el punteado de esas quedaba afuera (medido: `[]`).
  const punteadas = [...hoja.matchAll(/'(\.[^{']+)\{([^}]*)\}/g)].filter((m) => m[2].includes('dashed')).map((m) => m[1]);
  assert.deepEqual(punteadas, ['.ee-hueco', '.ee-fase-nueva'], 'punteados: el hueco y «Nueva fase», nada más');
  assert.equal((EDITOR_CODIGO.match(/dashed/g) ?? []).length, 2);
});

// ROTO (05/10/2026), cada una sola:
//   · el `drop` escuchado en la lista y no en `document` (soltar afuera se pierde) → 34/1.
//   · el empuje del scroll condicionado a `ev.clientX < rs.right` (de costado deja de
//     scrollear, que es el pedido 6 sobre el tablero) → 34 pass / 1 fail.
// Y MEDIDO en /customer-success?ws=1 (Chromium, los POST abortados): arrastrando «Criterio»
// con el cursor en x=1430 —afuera del modal de 760, por la derecha— la marca se dibujó y el
// cuerpo que se habría guardado la ponía en «Contexto y Norte»; con el cursor abajo y al
// costado, afuera, el cuerpo del modal scrolleó de 0 a 387 px.
test('el arrastre escucha en DOCUMENT y sólo le importa la ALTURA del cursor', () => {
  const agarrar = bloque(EDITOR, '  const agarrar = (e: DragReact<HTMLElement>, a: Agarre) => {', '\n  // Si el editor se cierra');
  assert.match(agarrar, /document\.addEventListener\('dragover', sobre, true\);/);
  assert.match(agarrar, /document\.addEventListener\('drop', alSoltar, true\);/);
  assert.doesNotMatch(EDITOR_CODIGO, /onDragOver=|onDrop=/, 'nada del gesto puede depender de estar ENCIMA de la lista');
  const empuje = bloque(EDITOR, '      const sc = scroller();\n      if (sc) {', '      const y = ev.clientY');
  assert.match(empuje, /if \(ev\.clientY < rs\.top \+ borde\)/);
  assert.match(empuje, /else if \(ev\.clientY > rs\.bottom - borde\)/);
  assert.doesNotMatch(empuje, /clientX/);
});

// ROTO: 9 y 10 de la lista de arriba. MEDIDO con el editor de HEAD: Escape en el nombre
// de una etapa → editor cerrado; Escape en el «¿seguro?» → editor cerrado. Con el nuevo,
// abierto las dos veces.
test('el Escape de un campo o de la pregunta no cierra el editor', () => {
  // `window` y en CAPTURA: es lo único que corre antes que el listener del Modal, que vive
  // en `document` en captura y además frena la propagación.
  assert.match(EDITOR_CODIGO, /window\.addEventListener\('keydown', alTeclear, true\);/);
  const tecla = bloque(EDITOR, '    const alTeclear = (ev: KeyboardEvent) => {', '\n    };');
  assert.match(tecla, /if \(hayPregunta\) \{ ev\.stopPropagation\(\); setConfirmar\(null\); return; \}/);
  // ROTO (05/10/2026): sin esta línea, Escape con la paleta de una fase abierta cerraba el
  // editor entero → 34 pass / 1 fail.
  assert.match(tecla, /if \(hayPaleta\) \{ ev\.stopPropagation\(\); setColorDe\(null\); return; \}/);
  assert.match(tecla, /if \(agarrada\.current\) \{ ev\.stopPropagation\(\); return; \}/, 'a mitad de un arrastre, tampoco');
  assert.match(tecla, /el\.value = el\.dataset\.eeEsc;\s*el\.blur\(\);/);
  // Los cuatro campos llevan la marca: el título, el nombre de una etapa, el de una fase y
  // el renglón nuevo.
  assert.equal((EDITOR_CODIGO.match(/data-ee-esc=/g) ?? []).length, 4);
});

// ROTO: 11 de la lista de arriba.
test('el título renombra el PRODUCTO, recortado y sólo si cambió', () => {
  const fn = bloque(EDITOR, '  const guardarNombre = async (valor: string) => {', '\n  };');
  assert.match(fn, /valor\.trim\(\)\.replace\(\/\\s\+\/g, ' '\)/);
  assert.match(fn, /if \(!limpio \|\| limpio === nombreOk\) \{/, 'vacío o igual no se manda');
  assert.match(fn, /await onRenombrar\(limpio\)/);
  assert.match(fn, /if \(err\) \{ setMalProducto\(err\); return; \}/, 'el error del server se muestra tal cual');
});

// ROTO: 12 de la lista de arriba.
test('«Agregar fase» va ARRIBA de todo; «Agregar etapa», al pie de cada grupo', () => {
  const fase = EDITOR_CODIGO.indexOf('<NuevoRenglon tipo="fase"');
  assert.notEqual(fase, -1);
  assert.equal(EDITOR_CODIGO.indexOf('<NuevoRenglon tipo="fase"', fase + 1), -1, 'uno solo');
  assert.ok(fase < EDITOR_CODIGO.indexOf('<div ref={listaRef}'), '«agregar fase debería estar arriba del todo, no abajo»');
  // ⚠️ El ancla se afirma ANTES de comparar: un `indexOf` que no encuentra da -1, y «algo
  // está después de -1» es verdad siempre (ROTO, 05/10/2026: `forEach` → `map` en el
  // editor → 34 pass / 1 fail con esta línea; sin ella, verde). Desde el 06/10 las filas
  // son un `map` ADENTRO de la caja: el ancla se mudó con ellas.
  const filas = EDITOR_CODIGO.indexOf('{g.etapas.map((e, k) => {');
  assert.notEqual(filas, -1);
  assert.ok(EDITOR_CODIGO.indexOf('<NuevoRenglon tipo="etapa"') > filas);
});

// ── Las cajas (06/10/2026) ──────────────────────────────────────────────────

/** El texto desde la apertura de la CAJA de un grupo hasta el primer `</Fragment>`.
 *  ⚠️ Desde el hueco (06/10) ése es el de la PRIMERA FILA, no el de la caja: alcanza para la
 *  apertura de la caja, que es lo único que se le pregunta; para lo de adentro, `cajaJsx`. */
const CAJA = () => bloque(EDITOR_CODIGO, "<div className={'ee-caja'", '</Fragment>');

/**
 * La CAJA como ELEMENTO, parseada con el compilador: lo que está ADENTRO de ella de verdad.
 *
 * ⚠️ NO SE PUEDE CONTESTAR CON TEXTO. La primera versión miraba que «Nueva etapa» estuviera
 * antes del último `</div>` del recorte. MEDIDO (06/10/2026, en memoria): con las filas
 * sacadas de la caja Y con «Nueva etapa» sacada de la caja, daba VERDE las dos veces — el
 * último `</div>` del recorte es el del propio renglón de «Nueva etapa», que siempre está
 * después de todo. Contar `<div` y `</div>` tampoco: los atributos llevan flechas (`=>`) y
 * un `>` no distingue una cosa de la otra.
 */
async function cajaJsx(): Promise<string> {
  const ts = (await import('typescript')).default;
  const sf = ts.createSourceFile('modal.tsx', EDITOR, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let out = '';
  const ver = (n: import('typescript').Node): void => {
    if (!out && ts.isJsxElement(n) && n.openingElement.getText(sf).startsWith("<div className={'ee-caja'")) out = n.getText(sf);
    ts.forEachChild(n, ver);
  };
  ver(sf);
  return out;
}

// ROTO (06/10), cada una sola → 40 pass / 1 fail:
//   · «Nueva etapa» afuera de la caja (el `</div>` de la caja arriba de su renglón): vuelve
//     a flotar suelto debajo del grupo, que es lo que se pidió que no pasara.
//   · las filas afuera de la caja (el `</div>` arriba del `map`).
//   Las dos daban VERDE con la versión de texto de este guard (ver `cajaJsx`).
test('cada fase es una CAJA: su título arriba, sus etapas adentro y «Nueva etapa» al final', async () => {
  const caja = await cajaJsx();
  assert.ok(caja.length > 3_000 && caja.length < 14_000, `la caja mide ${caja.length}`);
  // Lo de adentro, en orden: título, (paleta), filas, (vacía), «Nueva etapa».
  const titulo = caja.indexOf('{titulo}');
  const filas = caja.indexOf('{g.etapas.map((e, k) => {');
  const nueva = caja.indexOf('<NuevoRenglon tipo="etapa"');
  for (const [n, i] of Object.entries({ titulo, filas, nueva })) assert.notEqual(i, -1, `falta ${n} ADENTRO de la caja`);
  assert.ok(titulo < filas && filas < nueva, 'título → filas → «Nueva etapa»');
  // La caja dice de qué grupo es: es lo que mide el arrastre (`data-caja`) y lo que trae a
  // la vista una fase recién creada (`data-grupo-fase`).
  assert.match(caja, /data-caja=\{g\.clave\} data-grupo-fase=\{fase\?\.key\}/);
  // Un solo grupo por caja: las filas se dibujan de `g.etapas`, no de la lista entera.
  assert.doesNotMatch(caja, /lista\.map\(/);
});

// ROTO (06/10), cada una sola → 40 pass / 1 fail:
//   · `.ee-caja` con `background:#F5F7FA` (un hex: en oscuro queda una caja clara).
//   · `.ee-fila` sin su `background:var(--surface)` (las filas vuelven a flotar sobre gris).
//   · `.ee-fase-nueva` sin su regla de hover (no se ilumina con el cursor).
//   · `.ee-caja.ee-destino` con `border-width:2px` (la caja que se enciende ENGORDA y corre
//     todo lo de abajo, con los lugares del arrastre ya medidos).
test('las cajas son superficies de la casa, y «Nueva fase» se ilumina con el cursor', () => {
  const hoja = bloque(EDITOR, 'const CSS = [', "].join('\\n');");
  const regla = (sel: string) => {
    const m = hoja.match(new RegExp("'" + sel.replace(/\./g, '\\.') + "\\{([^}]*)\\}"));
    assert.ok(m, `falta la regla ${sel}`);
    return m[1];
  };
  // Tokens, nunca un hex: el modo oscuro y las paletas redefinen TOKENS (AGENTS.md).
  assert.doesNotMatch(hoja, /#[0-9a-fA-F]{3,8}\b/, 'ni un color escrito a mano en la hoja');
  assert.doesNotMatch(bloque(EDITOR_CODIGO, 'function NuevoRenglon(', '\n}\n'), /#[0-9a-fA-F]{3,8}\b/);
  const caja = regla('.ee-caja');
  assert.match(caja, /background:var\(--surface-2\)/);
  assert.match(caja, /border:1px solid var\(--border\)/);
  assert.match(caja, /border-radius:12px/);
  assert.match(regla('.ee-fila'), /background:var\(--surface\)/, 'las filas son BLANCAS adentro de la caja gris');
  // «Nueva fase»: apagada y punteada, como «Crear nuevo proyecto» del Plan…
  const nueva = regla('.ee-fase-nueva');
  assert.match(nueva, /border:1\.5px dashed var\(--border-strong\)/);
  assert.match(nueva, /color:var\(--faint\)/);
  assert.match(nueva, /opacity:\.85/);
  assert.match(nueva, /border-radius:12px/, 'con la forma de una caja de fase');
  // …y se ILUMINA con el cursor (y con el foco del teclado).
  assert.match(hoja, /'\.ee-fase-nueva:hover,\.ee-fase-nueva:focus-visible\{border-color:var\(--primary\);color:var\(--primary\);opacity:1\}'/);
  // La caja que se enciende como destino no cambia de TAMAÑO: color y anillo de sombra.
  const destino = regla('.ee-caja.ee-destino');
  assert.match(destino, /border-color:var\(--primary\)/);
  assert.match(destino, /box-shadow:/);
  assert.doesNotMatch(destino, /border(-width)?:|padding|margin/, 'nada que cambie la medida');
});

// ROTO (06/10), cada una sola → 40 pass / 1 fail:
//   · `NuevoRenglon` con `className="ee-mas"` también para la fase (vuelve el «+ Fase» de
//     texto suelto).
//   · la fase abierta sin su caja (`return renglon;` en los dos casos).
test('«Nueva fase» es una fase de mentira, y abierta sigue siendo una caja', () => {
  const nr = bloque(EDITOR_CODIGO, 'function NuevoRenglon(', '\n}\n');
  assert.match(nr, /className=\{fase \? 'ee-fase-nueva' : 'ee-mas'\}/);
  assert.match(nr, /return fase \? <div className="ee-caja">\{renglon\}<\/div> : renglon;/,
    'lo que se escribe aparece donde va a quedar');
  // Texto corto y neutro.
  assert.match(nr, /\{fase \? 'Nueva fase' : 'Nueva etapa'\}/);
});

// ROTO (06/10), cada una sola → 40 pass / 1 fail:
//   · `cajaDestino` sin `destino.grupo !== agarradaEn` (la caja de origen se enciende desde
//     el primer píxel del gesto).
//   · la caja sin `' ee-destino'` (soltar en otra fase no se ve hasta soltar).
//   · `medir` sin juntar las `[data-caja]` (las cajas quedan vacías y el destino vuelve al
//     lugar más cercano a secas).
// Y MEDIDO en /customer-success?ws=1 (Chromium, los POST abortados): arrastrando «Criterio»
// con el cursor sobre el TÍTULO de «Contexto y Norte», esa caja se encendió (fondo
// `--primary-bg`, borde `--primary`), la línea quedó arriba de «Contexto» y el cuerpo que se
// habría guardado la ponía primera de esa fase (`criterio:f_contexto contexto:f_contexto …`).
// El mismo gesto con el HUECO (06/10, tarde): la caja encendida, el hueco de 38 px antes de
// «Contexto», las filas de abajo +42 y el mismo guardado.
test('soltar en OTRA caja la ENCIENDE, y el destino sale primero de la caja', () => {
  assert.match(EDITOR_CODIGO, /const cajaDestino = destino\?\.tipo === 'etapa' && destino\.grupo !== agarradaEn \? destino\.grupo : null;/);
  assert.match(CAJA(), /className=\{'ee-caja' \+ \(cajaDestino === g\.clave \? ' ee-destino' : ''\)\}/);
  const medir = bloque(EDITOR, '  const medir = useCallback(() => {', '\n  }, []);');
  assert.match(medir, /querySelectorAll<HTMLElement>\('\[data-caja\]'\)/);
  assert.match(medir, /cajas\.current = cs;/);
  const sobre = bloque(EDITOR, '    const sobre = (ev: globalThis.DragEvent) => {', '\n    };');
  assert.match(sobre, /const mejor = destinoEn\(lugares\.current, cajas\.current, y\);/);
});

// ROTO (06/10), cada una sola → 40 pass / 1 fail:
//   · `destinoEn` ignorando las cajas (`return cercano(lugares)`): el título de la caja de
//     abajo apunta al final de la de arriba.
//   · sin el respaldo (`cercano(adentro)` a secas): una caja sin lugares deja el gesto sin
//     destino.
test('destinoEn: el título de la caja de abajo apunta a ESA caja, no al final de la de arriba', async () => {
  const { destinoEn } = await modeloEditor();
  // Dos cajas: A (0-100), con su fila en 10 y su «Nueva etapa» (el lugar «al final») en 74;
  // B (112-220), con su título de 112 a 152 y su primera fila en 160.
  const lugares = [
    { d: { tipo: 'etapa' as const, grupo: 'a', slot: 0 }, y: 10 },
    { d: { tipo: 'etapa' as const, grupo: 'a', slot: 1 }, y: 74 },
    { d: { tipo: 'etapa' as const, grupo: 'b', slot: 0 }, y: 160 },
  ];
  const cajas = [{ grupo: 'a', top: 0, bottom: 100 }, { grupo: 'b', top: 112, bottom: 220 }];
  // El cursor en 116 está sobre el TÍTULO de B. El lugar más cercano a secas es el final de
  // A (a 42 contra 44): sin mirar la caja, «meterla en B» la dejaba al final de A.
  assert.deepEqual(destinoEn(lugares, cajas, 116), { tipo: 'etapa', grupo: 'b', slot: 0 });
  assert.deepEqual(destinoEn(lugares, cajas, 90), { tipo: 'etapa', grupo: 'a', slot: 1 }, 'adentro de A, el más cercano de A');
  // En el hueco entre dos cajas, la caja más cercana (110: a 10 de A y a 2 de B, y otra vez
  // el lugar más cercano a secas sería el de A).
  assert.deepEqual(destinoEn(lugares, cajas, 104), { tipo: 'etapa', grupo: 'a', slot: 1 });
  assert.deepEqual(destinoEn(lugares, cajas, 110), { tipo: 'etapa', grupo: 'b', slot: 0 });
  // Arriba de todo y abajo de todo: la caja de la punta.
  assert.deepEqual(destinoEn(lugares, cajas, -40), { tipo: 'etapa', grupo: 'a', slot: 0 });
  assert.deepEqual(destinoEn(lugares, cajas, 400), { tipo: 'etapa', grupo: 'b', slot: 0 });
  // Una caja sin lugares válidos no deja el gesto sin destino: cae al más cercano de todos.
  assert.deepEqual(destinoEn(lugares.slice(0, 2), cajas, 150), { tipo: 'etapa', grupo: 'a', slot: 1 });
  // Sin cajas (el arrastre de una FASE, que cae ENTRE cajas) es el más cercano a secas.
  const huecos = [{ d: { tipo: 'fase' as const, slot: 1 }, y: 106 }, { d: { tipo: 'fase' as const, slot: 2 }, y: 226 }];
  assert.deepEqual(destinoEn(huecos, [], 150), { tipo: 'fase', slot: 1 });
  assert.equal(destinoEn([], [], 10), null);
});

// ── El hueco (06/10/2026, tarde) ────────────────────────────────────────────
// «En el editor de etapas, al arrastrar, copia la misma animación que tenemos en el CRM o
// ahí mismo en las tarjetas de clientes, ya que si lo estoy arrastrando se tiene que ver
// donde va a caer» (Martín). La línea de 2 px se fue: la tapaba la copia que sigue al cursor.
//
// MEDIDO en /customer-success?ws=1 (Chromium headless, los guardados abortados; arnés en el
// scratchpad, `ed3/verificar.cjs`), DURANTE el gesto:
//   · reordenar «contexto» a 3 px arriba de «norte»: UN hueco, en «Contexto y Norte» antes de
//     «norte», de 38 px (lo que una fila), `2px dashed` del color de la fase, radio 9; «norte»,
//     «criterio» e «instalado» corridos 42 px (38 + el gap de 4), «pas» y la fila de origen 0.
//     18 movimientos de 1 px sobre el mismo destino: el hueco no se mudó y la lista tuvo 0
//     mutaciones. Guardado abortado: `pas contexto norte`.
//   · «criterio» sobre el TÍTULO de «Contexto y Norte»: hueco antes de «contexto», la caja
//     encendida, todo lo de abajo +42; guardado `criterio:f_contexto contexto …`.
//   · «palancas» a la caja vacía de «Sin fase», llegando por el AUTO-SCROLL (421 → 523 px, el
//     fondo): el hueco en lugar del texto (`.ee-vacia` en `display:none`), del color PROPIO de
//     la etapa; guardado `… instalado:f_cierre palancas:` (sin fase).
//   · la fase «Tablero y Ritmo» al espacio entre «Inicio» y «Contexto»: hueco de 48 px, el
//     espacio de 12 a 72 y las cuatro cajas de abajo +60; guardado con las fases
//     `f_inicio f_tablero f_contexto f_criterio f_cierre`.
//   · en el primer píxel del gesto (etapa o fase), y con la entrada dentro de su caja: 0 huecos.
//   · después de soltar o de cancelar: 0 huecos, 0 cajas encendidas, la copia sacada.

// ROTO (06/10, tarde), cada una sola → 43 pass / 1 fail, cae este test:
//   · `cambiaAlSoltar` comparando la lista CRUDA (sin `enOrden` sobre lo que devuelve
//     `llevarEtapa`): con una lista que llega partida, el hueco se abre pegado a la fila de
//     origen como si soltarla ahí la moviera.
//   · `sobre` con `setDestino(mejor)` (sin preguntar si cambia algo): vuelve el hueco del
//     primer píxel, que corre la fila de origen debajo de la copia.
//   · `sobre` sin el `if (mismoDestino(destinoRef.current, mejor)) return;`: un `setState` y
//     un `cambiaAlSoltar` por evento, 60 por segundo.
test('el hueco se abre sólo donde soltar CAMBIA algo, y se repinta sólo si el destino cambia', async () => {
  const { cambiaAlSoltar, llevarEtapa } = await modeloEditor();
  const et = (key: string) => ({ tipo: 'etapa' as const, key });
  const en = (grupo: string, slot: number) => ({ tipo: 'etapa' as const, grupo, slot });
  // «b1» es la primera de B: arriba y abajo de sí misma no la mueven; más abajo, sí.
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('b1'), en('f_b', 0)), false, 'arriba de sí misma');
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('b1'), en('f_b', 1)), false, 'abajo de sí misma');
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('b1'), en('f_b', 2)), true);
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('b1'), en('f_a', 2)), true, 'a otra caja, siempre');
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('s1'), en('', 0)), false);
  // La entrada: su propio lugar no cambia nada; el primero de otra caja, sí.
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('en'), en('f_a', 0)), false);
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('en'), en('f_b', 0)), true);
  // Una fase: los dos espacios que la rodean no la mueven.
  const fb = { tipo: 'fase' as const, clave: 'f_b' };
  const entre = (slot: number) => ({ tipo: 'fase' as const, slot });
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, fb, entre(1)), false);
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, fb, entre(2)), false);
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, fb, entre(3)), true);
  assert.equal(cambiaAlSoltar(LISTA_ED, FASES_ED, et('b1'), entre(3)), false, 'tipos cruzados: nada');
  // Una lista que llega PARTIDA (b1 de B entre dos de A): `llevarEtapa` la devuelve agrupada
  // aunque b1 no se mueva, y eso NO es un cambio — lo que se guarda pasa por `enOrden` igual.
  const partida = [etEd('en', 'f_a'), etEd('b1', 'f_b'), etEd('a1', 'f_a'), etEd('s1')];
  assert.notEqual(verEd(llevarEtapa(partida, FASES_ED, 'b1', 'f_b', 0)), verEd(partida), 'la premisa');
  assert.equal(cambiaAlSoltar(partida, FASES_ED, et('b1'), en('f_b', 0)), false);

  // El cableado: el soltar usa el destino tal cual; lo que se DIBUJA pasa por el modelo, y
  // sólo cuando el destino cambia.
  const sobre = sinComentarios(bloque(EDITOR, '    const sobre = (ev: globalThis.DragEvent) => {', '\n    };'));
  const corte = sobre.indexOf('if (mismoDestino(destinoRef.current, mejor)) return;');
  assert.notEqual(corte, -1, 'sin esto, un setState por dragover');
  assert.ok(corte < sobre.indexOf('setDestino('), 'la salida temprana va ANTES del setState');
  assert.match(sobre, /setDestino\(mejor && cambiaAlSoltar\(l, t, a, mejor\) \? mejor : null\);/);
  assert.equal((sobre.match(/setDestino\(/g) ?? []).length, 1);
});

// ROTO (06/10, tarde), cada una sola → 43 pass / 1 fail, cae este test:
//   · `.ee-hueco` con `height:12px` (el alto del espacio entre cajas que antes llevaba ese
//     nombre): el hueco no mide una fila y la copia lo tapa entero.
//   · el hueco de una fila DESPUÉS de la fila (`<div className="ee-fila" …>` y recién ahí
//     `{huecoEtapa(g.clave, k)}`): se dibuja una fila más abajo de donde cae.
//   · el hueco de la caja vacía DESPUÉS del texto: `.ee-hueco+.ee-vacia` deja de calzar y la
//     caja muestra el hueco Y «Arrastra etapas aquí», una fila más alta.
//   · el fondo con el sufijo hex del kanban (`color + '12'`): con el `var(--primary)` de
//     respaldo el navegador descarta el fondo en silencio.
//   · la línea de vuelta (`boxShadow: '0 -3px 0 -1px var(--primary)'` en la fila destino).
test('donde va a caer se abre un HUECO del alto de una fila (o de una caja chica), y no hay línea', async () => {
  const hoja = bloque(EDITOR, 'const CSS = [', "].join('\\n');");
  const regla = (sel: string) => {
    const m = hoja.match(new RegExp("'" + sel.replace(/[.>+]/g, (c) => '\\' + c) + "\\{([^}]*)\\}"));
    assert.ok(m, `falta la regla ${sel}`);
    return m[1];
  };
  // El hueco mide lo que una fila, con UNA constante para los dos: el patrón de `.ke-hueco`.
  const hueco = regla('.ee-hueco');
  assert.match(hueco, /height:' \+ FILA \+ 'px/);
  assert.match(hueco, /border:2px dashed /);
  assert.match(hueco, /border-radius:9px/);
  assert.match(hueco, /transition:height \.12s/);
  assert.match(regla('.ee-fila'), /min-height:' \+ FILA \+ 'px/);
  assert.match(EDITOR_CODIGO, /const FILA = 38;/);
  // El de una fase: lo que una caja chica (la de «Nueva fase»), con aire arriba y abajo.
  assert.match(regla('.ee-entre>.ee-hueco'), /height:' \+ CAJA_CHICA \+ 'px;border-radius:12px;margin:12px 0/);
  assert.match(regla('.ee-fase-nueva'), /min-height:' \+ CAJA_CHICA \+ 'px/);
  assert.match(regla('.ee-entre'), /display:flex/, 'en un bloque, el margen del hueco se escapa del espacio');
  // En una caja vacía va EN LUGAR del texto.
  assert.match(regla('.ee-hueco+.ee-vacia'), /^display:none$/);

  // Dónde se dibuja: ARRIBA de la fila del lugar, en el mismo `Fragment`… (La caja PARSEADA:
  // `CAJA()` corta en el primer `</Fragment>`, y desde el hueco ése es el de la fila.)
  const caja = await cajaJsx();
  const filas = bloque(caja, '{g.etapas.map((e, k) => {', 'className="ee-fila"');
  assert.match(filas, /<Fragment key=\{'e:' \+ e\.key\}>\s*\{huecoEtapa\(g\.clave, k\)\}\s*<div $/);
  // …justo antes del texto de una caja vacía, y arriba de «Nueva etapa» (el lugar «al final»)…
  assert.match(caja, /\{huecoEtapa\(g\.clave, 0\)\}\s*<div className="ee-vacia"/);
  const alFinal = caja.indexOf('{g.etapas.length > 0 && huecoEtapa(g.clave, g.etapas.length)}');
  assert.notEqual(alFinal, -1);
  assert.ok(alFinal < caja.indexOf('<NuevoRenglon tipo="etapa"'));
  // …y el de una fase ADENTRO del espacio entre dos cajas (y el de después de la última).
  assert.match(EDITOR_CODIGO, /<div className="ee-entre" aria-hidden data-fslot=\{sueltaDeMentira \? undefined : gi\}>\s*\{!sueltaDeMentira && huecoFase\(gi\)\}/);
  assert.match(EDITOR_CODIGO, /<div className="ee-entre" aria-hidden data-fslot=\{nGrupos\}>\s*\{huecoFase\(nGrupos\)\}/);

  // Del color que la etapa VA a tener ahí, y con un fondo que vale para cualquier color.
  assert.match(EDITOR_CODIGO, /colorDeEtapa\(conFase\(agarradaEtapa, grupo\), tramos\)/);
  assert.match(EDITOR_CODIGO, /background: 'color-mix\(in srgb, ' \+ color \+ ' 7%, transparent\)'/);
  assert.doesNotMatch(EDITOR_CODIGO, /color \+ '12'|\$\{color\}12/);

  // Y la línea no vuelve: ni la sombra de la fila ni el degradé del espacio entre cajas.
  assert.doesNotMatch(EDITOR_CODIGO, /0 -3px 0 -1px|linear-gradient\(var\(--primary\)/);
});

// MEDIDO (06/10, tarde): el `setTimeout(0)` del agarre —el que monta «Sin fase» y dispara la
// SEGUNDA medida— llega cuando quiere. En una corrida el timer salió a los 27 ms pero React
// recién lo pintó a los 80, EN EL MISMO RENDER que el primer hueco: `medir` corrió con el
// hueco abierto (`huecos=1` al tocar la clase). Para reproducirlo a voluntad, el arnés
// (`ed3/carrera.cjs`) atrasa ese timer a 400 ms —lo que AGENTS.md mide en un arrastre nativo,
// los timers congelados—: se agarra «contexto», el primer `dragover` abre el hueco antes de
// «norte», y después se baja a 3 px arriba de donde estaba «palancas».
//   · ROTO, sin `raiz.classList.add('ee-midiendo')`: la segunda medida leyó «palancas» en 558
//     en vez de 516 (+42, el hueco), y el hueco y el guardado cayeron UNA FILA ARRIBA, antes
//     de «criterio» (`norte contexto:f_criterio criterio palancas`). → y en este test,
//     43 pass / 1 fail.
//   · Sano: la misma lectura dio 516 con el hueco en `display:none`, y cayó antes de
//     «palancas» (`criterio contexto:f_criterio palancas`).
// ROTO también, cada una sola → 43 / 1: sin las reglas `.ee-midiendo` de la hoja, y sin
// devolver el `scrollTop` al prender el hueco otra vez.
test('los lugares se miden SIN el hueco, aunque la segunda medida llegue con él abierto', () => {
  const medir = sinComentarios(bloque(EDITOR, '  const medir = useCallback(() => {', '\n  }, []);'));
  const apaga = medir.indexOf("if (conHueco) raiz.classList.add('ee-midiendo');");
  const prende = medir.indexOf("raiz.classList.remove('ee-midiendo');");
  assert.notEqual(apaga, -1, 'se apaga el hueco antes de leer');
  assert.notEqual(prende, -1, 'y se prende después');
  const lecturas = [...medir.matchAll(/getBoundingClientRect\(\)/g)].map((m) => m.index!);
  assert.ok(lecturas.length >= 3);
  assert.ok(lecturas.every((i) => i > apaga && i < prende), 'TODAS las lecturas, con el hueco apagado');
  // La base del scroll se lee ya apagado (vale para esos rectángulos), y el scroll se devuelve.
  assert.ok(medir.indexOf('const base = sc?.scrollTop ?? 0;') > apaga);
  assert.match(medir.slice(prende), /if \(sc && sc\.scrollTop !== scroll\) sc\.scrollTop = scroll;/);
  const hoja = bloque(EDITOR, 'const CSS = [', "].join('\\n');");
  assert.match(hoja, /'\.ee-midiendo \.ee-hueco\{display:none\}'/);
  assert.match(hoja, /'\.ee-midiendo \.ee-hueco\+\.ee-vacia\{display:block\}'/, 'y el texto de la caja vacía, que es su lugar medido, vuelve');
  // La segunda medida sigue existiendo: «Sin fase» aparece un render después del agarre.
  assert.match(EDITOR_CODIGO, /useLayoutEffect\(\(\) => \{ if \(arrastrando\) medir\(\); \}, \[arrastrando, medir\]\);/);
});

// MEDIDO (06/10, tarde): soltar con el cursor QUIETO sobre el hueco recién abierto (el escenario
// de «tablero» sobre «Nueva etapa» de otra caja, `ed3/diag-c2.cjs`). ROTO, sin el listener de
// `dragenter`: 2 de 2 gestos terminaron en `dragend` sin `drop` —el log: `dragenter` al hueco,
// ningún `dragover` después— y 0 guardados; soltando 30 px más abajo, sobre «Nueva etapa»
// corrida, sí llegaba. Sano: 2 de 2 con `drop` y su guardado. → y en este test, 43 pass /
// 1 fail. ROTO también: el `dragenter` sin su `removeEventListener` → 43 / 1.
test('soltar ENCIMA del hueco no se pierde: el dragenter también se acepta', () => {
  const agarrar = sinComentarios(bloque(EDITOR, '  const agarrar = (e: DragReact<HTMLElement>, a: Agarre) => {', '\n  // Si el editor se cierra'));
  assert.match(agarrar, /document\.addEventListener\('dragenter', entra, true\);/);
  assert.match(agarrar, /document\.removeEventListener\('dragenter', entra, true\);/);
  const entra = bloque(agarrar, '    const entra = (ev: globalThis.DragEvent) => {', '\n    };');
  assert.match(entra, /if \(!agarrada\.current\) return;\s*ev\.preventDefault\(\);/);
});

// ── El write path ───────────────────────────────────────────────────────────

// ROTO: `data: { etapas: limpias }` (sin fases) → 8 pass / 1 fail. Es el bug que borra el
// color de todas las columnas en el próximo guardado de cualquier otra cosa.
test('las fases se escriben en el MISMO upsert que las etapas', () => {
  const fn = bloque(leer('lib/entrega-servicio.ts'),
    'export async function guardarEtapasEntrega(', '\n  return true;');
  assert.match(fn, /data: \{ etapas: limpias, fases: tramos \}/);
  assert.match(fn, /const tramos = normalizarFases\(fases\);/, 'y saneadas, como las etapas');
  // ⚠️ Y `fases` NO lleva default: un `= []` deja que un llamador se las olvide y, con el
  // `data` reemplazado entero, olvidarlas es BORRARLAS.
  assert.doesNotMatch(fn, /fases: readonly FaseEntrega\[\] = \[\]/);
  assert.match(fn, /fases: readonly FaseEntrega\[\],/);
});

// ── El conteo que el editor muestra ─────────────────────────────────────────

// ROTO: `Object.values(asignacionDe(...)).map((a) => a.etapa)` de vuelta → 9 pass / 1 fail.
// Es el bug medido en el navegador: 8 clientes, 3 filas, el tablero con 5 tarjetas en la
// primera columna y el editor diciendo 0 — o sea el «¿seguro?» que no se dispara.
test('el editor cuenta CLIENTES del producto, no filas', () => {
  const app = leer('app/customer-success/ClientesApp.tsx');
  const mount = bloque(app, '<EtapasEntregaModal', 'onCerrar=');
  const conteo = bloque(mount, 'conteo={conteoDeEtapas(', ')}');
  // Una entrada por CLIENTE: la regla «sin fila, primera etapa» es DERIVADA, así que a
  // quien no aparece en la lista no hay de dónde derivársela.
  assert.match(conteo, /listaServ\.map\(\(c\) => asigServicio\[c\.leadId\]\?\.etapa\)/);
  assert.doesNotMatch(sinComentarios(conteo), /Object\.values/, 'eso cuenta FILAS, no clientes');
  // ⚠️ Y sobre los clientes DEL PRODUCTO sin filtrar (`listaServ`, 06/10/2026), nunca sobre
  // `visibles`: con una búsqueda puesta, el aviso al sacar una columna dejaría afuera a los
  // que el buscador escondió. Ni sobre la cartera entera: un cliente de otro producto no
  // está en ninguna columna de éste (tests/cs-pertenencia.test.ts).
  assert.doesNotMatch(sinComentarios(conteo), /visibles/);
});

// ── La barra ────────────────────────────────────────────────────────────────

// ROTO: el `<span className="bc-btn-txt">` sacado → 8 pass / 1 fail.
test('el botón de filtrar DICE «Filtrar»', () => {
  const barra = leer('app/customer-success/BarraClientes.tsx');
  const btn = bloque(barra, '<button type="button" className={`bc-btn', '</button>');
  assert.match(btn, /className="bc-btn-txt">Filtrar</, 'un embudo de 15 px no se lee como un filtro');
  // Y el botón dejó de ser cuadrado, o el texto no entra.
  const css = bloque(barra, '.bc-btn{', '}');
  assert.doesNotMatch(css, /width:38px/);
  assert.match(css, /padding:0 13px/);
});

// ── La FASE, como una sección de «Filtrar» ──────────────────────────────────
//
// «Como terminaron siendo muchas fases, es mejor que lo pongas como un filtro directamente,
// porque no queda bien que estén todos esos botones» (Martín, 05/10/2026). Las tres
// funciones son la definición de la opción y se EJECUTAN acá: un guard de cableado contesta
// «¿está enchufado?», nunca «¿hace lo que dice?».

const E = (key: string, fase?: string) => ({ key, label: key, tone: 'neutral', dot: '#123456', ...(fase ? { fase } : {}) }) as unknown as EtapaEntrega;
const F = (key: string) => ({ key, label: key.toUpperCase(), tone: 'neutral', dot: '#abcdef' }) as unknown as FaseEntrega;

test('columnasVisibles: «Sin fase» incluye las que apuntan a una fase BORRADA', () => {
  const fases = [F('f1'), F('f2')];
  const etapas = [E('a', 'f1'), E('b', 'f2'), E('c'), E('d', 'f_borrada')];
  assert.deepEqual(columnasVisibles(etapas, fases, null).map((e) => e.key), ['a', 'b', 'c', 'd']);
  assert.deepEqual(columnasVisibles(etapas, fases, 'f1').map((e) => e.key), ['a']);
  // La rotura de los chips viejos: ofrecían «Sin fase» por `d` y filtraban por `fase === ''`.
  assert.deepEqual(columnasVisibles(etapas, fases, '').map((e) => e.key), ['c', 'd']);
});

test('opcionesDeFase: sólo lo que dibuja algo, y nada con menos de dos', () => {
  const fases = [F('f1'), F('f2'), F('vacia')];
  // `vacia` no tiene columnas: elegirla dejaría el riel en blanco. Y sin sueltas no hay «Sin fase».
  const op = opcionesDeFase([E('a', 'f1'), E('b', 'f2')], fases);
  assert.deepEqual(op.map((o) => o.valor), ['f1', 'f2']);
  assert.deepEqual(op[0], { valor: 'f1', label: 'F1', color: '#abcdef' });
  // Con una suelta, «Sin fase» va al final.
  assert.deepEqual(opcionesDeFase([E('a', 'f1'), E('c')], fases).map((o) => o.valor), ['f1', '']);
  // Una sola fase elige lo mismo que «Todas»: no hay sección.
  assert.deepEqual(opcionesDeFase([E('a', 'f1'), E('b', 'f1')], fases), []);
  // Sin fases, el caso normal: la barra sigue igual que siempre.
  assert.deepEqual(opcionesDeFase([E('a'), E('b')], []), []);
});

test('faseVigente: lo que el servicio no ofrece se mira como «todas»', () => {
  const op = opcionesDeFase([E('a', 'f1'), E('b', 'f2')], [F('f1'), F('f2')]);
  assert.equal(faseVigente(null, op), null);
  assert.equal(faseVigente('f2', op), 'f2');
  // La fase de OTRO servicio: la pantalla no se desmonta al cambiar de servicio.
  assert.equal(faseVigente('f9', op), null);
  // «Sin fase» elegida en un servicio que no tiene sueltas: nunca un riel vacío.
  assert.equal(faseVigente('', op), null);
});

test('la fase vive en la PANTALLA, entra por «Filtrar» y llega vigente al kanban', () => {
  const app = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  assert.match(app, /const \[fasePedida, setFasePedida\] = useState<string \| null>\(null\);/);
  assert.match(app, /const faseVista = faseVigente\(fasePedida, opcionesFase\);/);
  // La sección sólo en el kanban: la tabla no esconde columnas.
  assert.match(app, /fases=\{enKanban \? opcionesFase : undefined\} fase=\{faseVista\} onFase=\{setFasePedida\}/);
  const kanban = bloque(app, '<KanbanEntrega', '/>');
  assert.match(kanban, /fase=\{faseVista\}/, 'lo que se pidió, NO: lo que este servicio ofrece');
  // Y lo que se cuenta, se exporta y se elige en lote es lo que el riel dibuja.
  assert.match(app, /const elegidosVisibles = enPantalla\.filter\(/);
  assert.match(app, /onTodos=\{\(\) => setSel\(new Set\(enPantalla\.map\(/, '«Seleccionar todos» no puede elegir a los de una fase escondida');
  assert.match(app, /nVisibles=\{enPantalla\.length\}/);
  // Los chips no vuelven, ni su estado adentro del tablero.
  assert.doesNotMatch(sinComentarios(KANBAN), /FasesChips|ke-fases|fasePedida/);
});

test('«Filtrar» cuenta la fase SÓLO si ofrece la sección, y limpiar la devuelve a «Todas»', () => {
  const barra = leer('app/customer-success/BarraClientes.tsx');
  const menu = sinComentarios(bloque(barra, 'function MenuFiltro(', '\n/* Los dos íconos del menú'));
  assert.match(menu, /const hayFases = !!fases && fases\.length > 0 && !!onFase;/);
  assert.match(menu, /const faseOn = hayFases && fase != null \?/);
  assert.match(menu, /\+ \(faseOn \? 1 : 0\);/, 'una fase elegida es un filtro puesto: el botón lo dice');
  assert.match(menu, /\.\.\.\(hayFases \? \[\{ key: 'fase' as const, label: 'Fase'/, 'en /admin no hay fases');
  const limpiar = bloque(menu, 'const limpiar = () => {', '};');
  assert.match(limpiar, /onFase\?\.\(null\);/);
  assert.match(limpiar, /onCuando\?\.\('siempre'\);/);
  // El número del botón y «Limpiar filtros» llaman a la MISMA función.
  assert.match(menu, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); limpiar\(\); \}\}/);
  assert.match(menu, /onClick=\{limpiar\}>Limpiar filtros/);
});

// ── El menú de «mover a una etapa» es UNO ───────────────────────────────────

// La barra de lote y el chip de la columna Etapa de la tabla hacen la misma pregunta, y
// hasta el 05/10/2026 la contestaban con dos menús: uno agrupado por fase en 500 px (dos
// tercios vacíos, la última etapa cortada) y otro plano con la fase repetida en cada renglón.
// ROTO (05/10/2026): el chip de la tabla sin `columns`/`alContenido` → 21 pass / 1 fail; la
// barra sin `alContenido` → 21 pass / 1 fail. Restaurado: 22 pass / 0 fail.
test('la barra y el chip de la tabla usan el MISMO menú de etapas, del ancho de su contenido', () => {
  const lote = sinComentarios(leer('app/customer-success/LoteClientes.tsx'));
  const tabla = sinComentarios(leer('app/customer-success/TablaClientes.tsx'));
  assert.match(lote, /export function opcionesDeEtapas\(/);
  assert.match(tabla, /opcionesDeEtapas\(etapas \?\? \[\], fases\)/);
  assert.match(tabla, /options=\{menuEtapa\.options\} alContenido/);
  assert.match(lote, /options=\{menu\.options\}\s*alContenido/);
  // Y SIN GRUPOS POR FASE (06/10/2026): «que solo aparezcan las etapas». Ningún llamador
  // vuelve a pasar `columns`, que es lo que el primitive dibuja como títulos de grupo.
  for (const src of [lote, tabla, sinComentarios(leer('app/customer-success/FichaEntrega.tsx'))]) {
    assert.doesNotMatch(src, /columns=\{menu(Etapa)?\.columns\}/, 'volvió el menú agrupado por fase');
  }
  // Y la tabla no vuelve a armar su propia lista con la fase como subtítulo.
  assert.doesNotMatch(tabla, /sub: faseDe\(/);
});

// ── El modal de «Abrir cuenta» no puede quedar atrapado en la tarjeta ─────────

// `Modal` se dibuja donde lo montan, y TarjetaEntidad le da a cada hijo de la tarjeta
// `position: relative; z-index: 1`: montado desde la fila de acciones, la tarjeta de al lado
// pintaba encima del modal (captura de Martín, 05/10/2026). Va por portal al body, y el
// arrastre de la tarjeta ignora lo que no nació adentro de ella en el DOM (el portal no la
// saca del árbol de React, y el dragstart del email subía hasta la tarjeta).
// ROTO (05/10/2026): sin el createPortal → 22 pass / 1 fail; sin la guarda de `agarrar` →
// 22 pass / 1 fail. Restaurado: 23 pass / 0 fail.
test('el modal de «Abrir cuenta» va por portal, y la tarjeta no se agarra desde él', () => {
  const cuenta = sinComentarios(leer('app/customer-success/CuentaDeMaKo.tsx'));
  assert.match(cuenta, /pidiendoEmail && createPortal\(\s*<Modal/);
  assert.match(cuenta, /<\/Modal>,\s*document\.body,?\s*\)/);
  const agarrar = bloque(KANBAN, '  function agarrar(', '  function soltarGesto(');
  assert.match(sinComentarios(agarrar), /if \(!e\.currentTarget\.contains\(e\.target as Node\)\) return;/);
});
