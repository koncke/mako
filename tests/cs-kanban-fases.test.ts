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
// Las dos reglas puras del arrastre en lote. Se importan del archivo de la BARRA y no del
// kanban porque el kanban no se puede importar desde node: arrastra módulos con
// `server-only` (medido: «This module cannot be imported from a Client Component»).
import { quienesViajan, dondeCae } from '../app/customer-success/LoteClientes';

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
/** El cuerpo del componente, sin la hoja de estilos ni los chips. */
const RENDER = bloque(KANBAN, '  const { porEtapa, huerfanos } = useMemo(', 'function FasesChips');
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
  assert.ok(RENDER.length > 3_000 && RENDER.length < 24_000, `el render mide ${RENDER.length}`);
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
  // ⛔ ACÁ SE FIJABA QUE LA ALTURA DEL CURSOR SUMARA EL `scrollTop` DE LA COLUMNA, y se
  // fue el 05/10/2026 con la idea que cuidaba: el hueco ya NO sigue al cursor. En el Plan
  // el lugar donde soltás se respeta (el número sale de ahí); acá una etapa no tiene orden
  // propio —la columna se dibuja en el orden de la lista—, así que un hueco que siguiera
  // la altura prometía «acá» y la tarjeta aparecía «allá». Lo que se fija ahora es lo
  // contrario: el índice sale de los DATOS (`dondeCae`) y no se lee layout de tarjetas.
  // ROTO: el índice calculado con un número fijo en vez de `dondeCae` → 14 pass / 1 fail.
  assert.match(over, /dondeCae\(e\.key, mano\.ids, etapaActual,/, 'el hueco va donde la tarjeta VA a aparecer');
  assert.doesNotMatch(sinComentarios(KANBAN), /medidas\.current/, 'sin puntos medios: no se mide la altura de ninguna tarjeta');
});

// ── La selección y el arrastre en LOTE ────────────────────────────────────────

// PROBADOS ROMPIÉNDOLOS (05/10/2026), cada rotura cazada por el test que le toca:
//   · `quienesViajan` sin el `seleccion.has(agarrado)` (arrastrar una SUELTA se llevaba
//     la selección entera) → 14 pass / 1 fail.
//   · `quienesViajan` devolviendo la selección sin filtrar por la lista (movía ids que la
//     búsqueda escondió) → 14 pass / 1 fail.
//   · `dondeCae` sin el filtro de los que ya están en el destino (la columna de origen
//     abría hueco y prometía un movimiento que no ocurre) → 14 pass / 1 fail.
//   · `soltarEn` mandando un lote por `onMover` (doce toasts, el de arriba deshace UNO)
//     → 14 pass / 1 fail.
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

test('dónde cae: donde la tarjeta VA a aparecer, o en ningún lado', () => {
  const pos = new Map([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]);
  const posicion = (id: number) => pos.get(id) ?? Number.MAX_SAFE_INTEGER;
  const etapa = new Map([[1, 'a'], [2, 'b'], [3, 'a'], [4, 'b'], [5, 'a']]);
  const etapaDe = (id: number) => etapa.get(id) ?? 'a';
  // La 3 (posición 2) entra a «b», donde están la 2 (pos 1) y la 4 (pos 3): cae en el medio.
  assert.equal(dondeCae('b', [3], etapaDe, [2, 4], posicion), 1);
  // La 5 (pos 4) entra a «b»: cae al final.
  assert.equal(dondeCae('b', [5], etapaDe, [2, 4], posicion), 2);
  // Soltar en su propia etapa no mueve a nadie: no hay hueco que dibujar.
  assert.equal(dondeCae('a', [3], etapaDe, [1, 3, 5], posicion), null);
  // En un lote cuenta el PRIMERO que de verdad se mueve: la 2 ya está en «b».
  assert.equal(dondeCae('b', [1, 2, 5], etapaDe, [2, 4], posicion), 0);
  assert.equal(dondeCae('b', [2, 4], etapaDe, [2, 4], posicion), null);
});

test('soltar un lote va por onMoverLote, y sólo con los que cambian de etapa', () => {
  const fn = bloque(KANBAN, '  function soltarEn(', '\n  }');
  assert.match(fn, /const mueven = mano\.ids\.filter\(\(id\) => etapaActual\(id\) !== key\);/);
  assert.match(fn, /if \(mano\.ids\.length > 1\) onMoverLote\(mueven, key\);/,
    'un lote es UN deshacer, aunque al final cambie uno solo');
  assert.match(fn, /else onMover\(mueven\[0\], key\);/);
  // Y lo que viaja se decide al AGARRAR, con la selección de afuera.
  const agarrar = bloque(KANBAN, '  function agarrar(', '\n  }');
  assert.match(agarrar, /quienesViajan\(leadId, seleccion, clientes\.map\(\(c\) => c\.leadId\)\)/);
});

test('la casilla vive en el ENVOLTORIO y se ve al hover o con algo marcado', () => {
  // Adentro de la tarjeta no se podría apretar: `TarjetaEntidad` apaga los clicks de
  // todo menos `.cl-acc`.
  const tarjeta = bloque(RENDER, '<div data-tarjeta', '<ClienteCard');
  assert.match(tarjeta, /<input type="checkbox" checked=\{elegida\} onChange=\{\(\) => alternar\(c\.leadId\)\}/);
  assert.match(RENDER, /className=\{`ke\$\{seleccion\.size > 0 \? ' ke-hay-sel' : ''\}`\}/);
  assert.match(HOJA, /\.ke-card:hover \.ke-sel, \.ke-hay-sel \.ke-sel \{ display: inline-flex; \}/);
  // Y el hueco es el del Plan: 64 de alto, no el alto entero de una tarjeta.
  assert.match(bloque(HOJA, '.ke-hueco {', '}'), /height: 64px/);
});

// ── El editor ───────────────────────────────────────────────────────────────

const EDITOR = leer('app/customer-success/EtapasEntregaModal.tsx');
/** El editor sin prosa: lo que de verdad se ejecuta. */
const EDITOR_CODIGO = sinComentarios(EDITOR);

// ⚠️ ESTA SECCIÓN SE REESCRIBIÓ EL 05/10/2026, con el editor copiado del CRM («fijate el
// diseño de ese editable en el CRM y copialo tal cual»). Dos cosas que se fijaban antes
// dejaron de ser ciertas A PROPÓSITO, y conviene saber por qué antes de «arreglarlas»:
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
//   6. `mover` sin la guarda de la entrada (otra columna pasa por encima de la primera).
//   7. `aFase` moviendo la entrada de lugar al cambiarle la fase.
//   8. `mover` intercambiando con el vecino de la lista GLOBAL (la flecha no hace nada).
//   9. el Escape escuchado en burbuja (`false`): llega después del del Modal.
//  10. sin el `if (hayPregunta)`: el Escape de la pregunta cierra el editor.
//  11. `guardarNombre` mandando el nombre aunque no haya cambiado.
//  12. «+ Agregar fase» abajo de la lista.
//  13. el pie dibujado sin `onEliminar`.
//   Las trece dieron 20 pass / 1 fail, y el que cae es siempre el de su rótulo `ROTO:`.
//   Restaurado (de memoria, nunca con `git checkout`): 21 pass / 0 fail.

// ROTO: 1 y 2 de la lista de arriba.
test('el editor guarda solo, y NO al montar', () => {
  const efecto = bloque(EDITOR, '    if (lista.length < MINIMO)', '  }, [lista, tramos, enviar]);');
  assert.ok(efecto.length > 300 && efecto.length < 1_500, `el efecto mide ${efecto.length}`);
  assert.match(efecto, /if \(firma === enviada\.current\) \{ pendiente\.current = null; return; \}/,
    'sin esto, abrir y cerrar marca el servicio como DECLARADO');
  assert.match(efecto, /setTimeout\(enviar, RESPIRO_MS\)/, 'con un respiro: renombrar es una tecla por letra');
  assert.match(efecto, /pendiente\.current = \{ etapas: limpias, fases: tramos, firma \}/,
    'las fases viajan en la MISMA llamada');
  // La firma de partida es la de lo que vino del server: con una vacía, montar ya «cambió».
  assert.match(EDITOR_CODIGO, /const \[firmaInicial\] = useState\(\(\) => firmaDe\(limpiar\(etapas\) \?\? etapas, fases\)\);/);
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

// ROTO: 6, 7 y 8 de la lista de arriba.
test('la primera etapa es la ENTRADA, y mover es DENTRO del grupo que se ve', () => {
  // «Un cliente sin fila está en la PRIMERA etapa» es DERIVADO: mover otra columna arriba
  // pasaba a todos esos clientes a ella, en silencio. Ni se mueve ni se le pasa por encima.
  const mover = bloque(EDITOR, '  const mover = (key: string, d: -1 | 1) => setLista((v) => {', '\n  });');
  assert.match(mover, /if \(lugares\[p\] === 0 \|\| lugares\[q\] === 0\) return v;/);
  const soltar = bloque(EDITOR, '  const soltarEn = (key: string, grupo: string, destino: number) => setLista((v) => {', '\n  });');
  assert.match(soltar, /if \(v\[0\]\?\.key === key\) return v;/);
  assert.match(soltar, /const piso = lugares\[0\] === 0 \? 1 : 0;/);
  const aFase = bloque(EDITOR, '  const aFase = (key: string, fase: string | undefined) => setLista((v) => {', '\n  });');
  assert.match(aFase, /if \(i === 0\) return v\.map/, 'cambiarle la fase a la entrada no la mueve de lugar');
  // Ni flechas ni ✕ en la entrada.
  assert.match(EDITOR_CODIGO, /\{!entra && \(k > piso \|\| k < g\.etapas\.length - 1\) \? \(\s*<MoverPartido/);
  assert.match(EDITOR_CODIGO, /\{!entra \? \(\s*<AccionFila/);
  // Y la flecha permuta DENTRO del grupo: con el vecino de la lista global, bajar una
  // etapa cuyo vecino es de otra fase no movía nada en pantalla.
  assert.match(mover, /const lugares = lugaresDe\(v, grupoDe\(e, tramos\), tramos\);/);
  const agregar = bloque(EDITOR, '  const agregarEtapa = (label: string, fase?: string) => {', '\n  };');
  assert.match(agregar, /lugaresDe\(v, fase \?\? '', tramos\)/, 'una etapa nueva cae al final de SU grupo');
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
  assert.ok(EDITOR_CODIGO.indexOf('<NuevoRenglon tipo="etapa"') > EDITOR_CODIGO.indexOf('{g.etapas.map('));
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
  assert.match(tabla, /columns=\{menuEtapa\.columns\} alContenido/);
  assert.match(lote, /columns=\{menu\.columns\}\s*alContenido/);
  // Y la tabla no vuelve a armar su propia lista con la fase como subtítulo.
  assert.doesNotMatch(tabla, /sub: faseDe\(/);
});
