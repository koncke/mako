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
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8');

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
/** El cuerpo del componente, sin la hoja de estilos ni los chips. */
const RENDER = bloque(KANBAN, '  const { porEtapa, huerfanos } = useMemo(', 'function FasesChips');
/** La hoja, sola. */
const HOJA = bloque(KANBAN, 'const CSS = `', '\n`;');

/** El render sin prosa: lo que de verdad se ejecuta. */
const CODIGO = sinComentarios(RENDER);

test('el recorte del render y el de la hoja son lo que digo que son', () => {
  // Si estos largos se van al doble, el guard está mirando otra cosa y los de abajo
  // dejan de significar lo que dicen.
  assert.ok(RENDER.length > 3_000 && RENDER.length < 16_000, `el render mide ${RENDER.length}`);
  assert.ok(HOJA.length > 2_000 && HOJA.length < 12_000, `la hoja mide ${HOJA.length}`);
  assert.doesNotMatch(RENDER, /const CSS/, 'el render no puede incluir la hoja');
  assert.doesNotMatch(HOJA, /useMemo/, 'la hoja no puede incluir el render');
});

// ROTO: `repartirEnEtapas(visibles, …)` → 8 pass / 1 fail.
test('el reparto recibe las etapas ENTERAS, no las filtradas por fase', () => {
  const reparto = bloque(RENDER, 'repartirEnEtapas(', ')');
  assert.match(reparto, /repartirEnEtapas\(\s*etapas\s*,/, 'tiene que recibir `etapas`');
  assert.doesNotMatch(reparto, /visibles/, 'con las filtradas, los de las columnas escondidas son huérfanos');
  // Y el filtro existe, pero del lado del render: si no existiera, los chips no harían nada.
  assert.match(RENDER, /const visibles = faseVista === null \? etapas : etapas\.filter/);
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
  // ⚠️ Y la medida suma el `scrollTop` de la columna, o el hueco apunta al lugar
  // equivocado en cuanto el cuerpo se corre: ver el porqué en `medidas`.
  assert.match(over, /ev\.clientY \+ window\.scrollY \+ \(cuerpo\?\.scrollTop \?\? 0\)/);
  assert.match(KANBAN, /scrollTop \?\? 0\);\s*$/m, 'y las midió en el mismo espacio');
});

// ── El editor ───────────────────────────────────────────────────────────────

const EDITOR = leer('app/customer-success/EtapasEntregaModal.tsx');

// ROTO: el `if (primera.current)` sacado → 8 pass / 1 fail.
// ROTO: un `pie=` con dos botones → 8 pass / 1 fail.
test('el editor guarda solo, y NO al montar', () => {
  const efecto = bloque(EDITOR, '  useEffect(() => {', '  }, [lista, tramos]);');
  assert.match(efecto, /if \(primera\.current\) \{ primera\.current = false; return; \}/,
    'sin esto, abrir y cerrar marca el servicio como DECLARADO');
  assert.match(efecto, /setTimeout\(/, 'con un respiro: renombrar es una tecla por letra');
  assert.match(efecto, /guardarRef\.current\(limpias, tramos\)/, 'las fases viajan en la MISMA llamada');
  // Y no hay pie: «no existe el botón de "No cambiar nada" o el de guardar».
  const editor = sinComentarios(EDITOR);
  assert.doesNotMatch(editor, /No cambiar nada/);
  assert.doesNotMatch(editor, /pie=/);
  assert.doesNotMatch(editor, /Guardar las etapas/);
});

// ROTO: el `confirm` sacado de `sacar` → 8 pass / 1 fail.
test('sacar una columna con gente adentro avisa ANTES, y con el número', () => {
  const fn = bloque(EDITOR, '  const sacar = async (e: EtapaEntrega) => {', '\n  };');
  assert.match(fn, /await confirm\(/, 'sin botón de guardar, el aviso va pegado al click');
  assert.match(fn, /conteo\[e\.key\]/, 'y dice cuántos clientes');
  assert.match(fn, /secuencias\?\.\[e\.key\]/, 'y cuántas secuencias');
  // «No pude revisar» no es «no hay»: con la lectura caída se avisa igual.
  assert.match(fn, /secuencias === null/);
  // El `setLista` que saca la etapa va DESPUÉS del `confirm`, no antes.
  assert.ok(fn.indexOf('await confirm(') < fn.indexOf('setLista((v) => v.filter'),
    'preguntar después de sacar no es preguntar');
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
test('el editor cuenta CLIENTES de la cartera entera, no filas', () => {
  const app = leer('app/customer-success/ClientesApp.tsx');
  const mount = bloque(app, '<EtapasEntregaModal', 'onCerrar=');
  const conteo = bloque(mount, 'conteo={conteoDeEtapas(', ')}');
  // Una entrada por CLIENTE: la regla «sin fila, primera etapa» es DERIVADA, así que a
  // quien no aparece en la lista no hay de dónde derivársela.
  assert.match(conteo, /clientes\.map\(\(c\) => asignacionDe\(servicio\.productoId\)\[c\.leadId\]\?\.etapa\)/);
  assert.doesNotMatch(sinComentarios(conteo), /Object\.values/, 'eso cuenta FILAS, no clientes');
  // ⚠️ Y sobre `clientes` (la cartera entera), nunca sobre `visibles`: con una búsqueda
  // puesta, el aviso al sacar una columna dejaría afuera a los que el buscador escondió.
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
