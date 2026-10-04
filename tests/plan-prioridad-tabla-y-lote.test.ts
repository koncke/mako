// =============================================================================
// La PRIORIDAD se cambia donde se la está mirando: en la fila, y de a varias
// =============================================================================
// Dos pedidos de la llamada del 01/10/2026, los dos sobre la misma pantalla:
//
//   · 01:01:00 — «si estoy en la vista de tabla y quiero cambiar la prioridad, así como le
//     doy clic a la fecha, si puedo cambiar ahí, **si le doy clic al botoncito de prioridad
//     debería poder cambiar ahí mismo**… esto lo voy a poner como 75, tengo que recargarlo
//     para que esto me haga caso. Otra cosa: si le bajo la prioridad, que se baje
//     automáticamente, no que le tenga que refrescar la página.»
//   · 01:04:44 — «también debería poder subir prioridades desde ahí arriba. Pero como
//     solamente puedo subir deadlines por ahora… debería poder cambiar prioridades en
//     bucle, o sea, de varios juntos.»
//   · 00:57:43 — «que la barra de opciones en donde le puedo cambiar el deadline, cuando
//     estoy seleccionando varias cosas, baje con mi scroll, porque si no como que tengo que
//     subir hasta arriba.»
//
// Acá se prueban las dos mitades de siempre: la DECISIÓN con la función pura, y el
// CABLEADO leyendo los archivos — porque todo esto son props y condiciones de JSX, y de
// eso el typecheck no ve nada (una prop opcional que nadie pasa compila perfecto).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enOrdenParaLaBanda, enOrdenParaElNumero, prioFromScore, scoreFromPrio } from '../app/plan/board/types';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const TABLAS = leer('app/plan/board/Tablas.tsx');
const LOTE = leer('app/plan/board/AccionesLote.tsx');
const BOARD = leer('app/plan/board/useBoard.ts');
const SHELL = leer('app/plan/board/BoardShell.tsx');

const score = (t: { score: number }) => t.score;

// ── LA DECISIÓN: a quiénes mueve un cambio de banda en lote ──────────────────

test('SUBIR NO BAJA A NADIE: la que ya está en la banda no se toca', () => {
  // El caso que lo motiva: dos proyectos tildados, uno arriba de todo y otro en el fondo.
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 30 }];
  const mueven = enOrdenParaLaBanda(filas, 'alta', score).map((f) => f.id);
  assert.deepEqual(mueven, ['b'], 'se está moviendo al que ya estaba en Alta: pedir ALTA le baja la prioridad de 96 a 85');
});

test('…y bajar sí mueve a los que están arriba', () => {
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 80 }, { id: 'c', score: 30 }];
  const mueven = enOrdenParaLaBanda(filas, 'baja', score).map((f) => f.id);
  assert.deepEqual(mueven.sort(), ['a', 'b'], 'el de 30 ya estaba en Baja y no tenía que moverse');
});

test('EL ORDEN ES DE MENOR A MAYOR, para que la cascada no los dé vuelta', () => {
  // En proyectos la escalera no admite empates: el ÚLTIMO aplicado queda arriba, así que
  // el que venía más alto tiene que aplicarse último.
  const filas = [{ id: 'medio', score: 40 }, { id: 'top', score: 70 }, { id: 'fondo', score: 10 }];
  assert.deepEqual(enOrdenParaLaBanda(filas, 'alta', score).map((f) => f.id), ['fondo', 'medio', 'top']);
});

test('EL NÚMERO EXACTO NO FILTRA, Y FILTRAR LO DA VUELTA', () => {
  // El contraejemplo, trazado sobre la cascada del server con A=50, B=20, C=10 pidiendo
  // los tres a 50: filtrando a A (que ya está en 50) se aplica B —que toma 50 y empuja a A
  // a 49— y después C, que empuja a B a 49 y a A a 48. A, que YA estaba arriba, termina
  // última. Sin filtrar y de menor a mayor, A se aplica última y se queda con 50.
  const filas = [{ id: 'a', score: 50 }, { id: 'b', score: 20 }, { id: 'c', score: 10 }];
  assert.deepEqual(enOrdenParaElNumero(filas, score).map((f) => f.id), ['c', 'b', 'a'],
    'o filtra a la que ya tiene el número, o no ordena ascendente: las dos la dejan abajo');
  assert.equal(enOrdenParaElNumero(filas, score).length, 3, 'no se saca a nadie: el no-op real lo resuelve el server');
});

test('…y la que venía más alta se aplica ÚLTIMA, que es lo que la deja arriba', () => {
  const filas = [{ id: 'medio', score: 40 }, { id: 'top', score: 70 }, { id: 'fondo', score: 10 }];
  assert.equal(enOrdenParaElNumero(filas, score).at(-1)?.id, 'top');
});

test('una selección entera que ya está en la banda no mueve nada', () => {
  const filas = [{ id: 'a', score: 96 }, { id: 'b', score: 80 }];
  assert.equal(enOrdenParaLaBanda(filas, 'alta', score).length, 0);
});

test('el número de cada banda es el MISMO que usa el pop-up al soltar en una columna', () => {
  // Dos escalas para la misma pregunta es cómo se separan: el lote y el arrastre salen de
  // `scoreFromPrio`, y el representativo tiene que caer DENTRO de su propia banda.
  for (const p of ['alta', 'media', 'baja', 'futuro'] as const) {
    assert.equal(prioFromScore(scoreFromPrio[p]), p, `el representativo de ${p} cae en otra banda`);
  }
});

// ── EL CABLEADO: la fila (pedidos #3 y #4) ───────────────────────────────────

test('CABLEADO: el chip de prioridad de CADA tabla abre el pop-up, y las dos lo hacen', () => {
  // ⚠️ SE CUENTAN LOS DOS LADOS, no se busca la palabra en el archivo. `TablaProyectos` y
  // `TablaTareas` dibujan su propio `<Score>`: con uno solo enchufado, la mitad de la
  // pantalla sigue sin poder cambiar la prioridad y el test daría verde igual.
  const chips = (TABLAS.match(/<Score score=/g) ?? []).length;
  const clicables = (TABLAS.match(/onCambiar=\{onSoltar/g) ?? []).length;
  assert.ok(chips >= 2, `esperaba los dos chips de fila y encontré ${chips}`);
  assert.equal(clicables, chips, `${chips} chips dibujados y sólo ${clicables} clicables`);
});

test('CABLEADO: el chip NO inventa un camino de escritura propio', () => {
  // El pedido #4 («que se baje automáticamente, no que le tenga que refrescar la página»)
  // se cumple SOLO porque esto entra por `onSoltar` → `MoverPrioridadModal` →
  // `aplicarCascadaManual`, que parchea el estado. Cualquier `fetch` o `repo.` adentro de
  // la tabla sería el otro camino, el que recarga.
  const cuerpo = TABLAS.slice(TABLAS.indexOf('function Score({'), TABLAS.indexOf('export function TablaProyectos'));
  assert.doesNotMatch(cuerpo, /fetch\(|repo\./, 'el chip está escribiendo por su cuenta en vez de abrir el pop-up de siempre');
});

// ── EL CABLEADO: la barra de lote (pedidos #5 y #6) ──────────────────────────

test('CABLEADO: la barra de lote va PEGADA y AFUERA de la caja que recorta', () => {
  // La mitad que no se ve: `cajaStyle` declara `overflow-x: auto`, así que el valor usado
  // del eje Y pasa a `auto` y la caja ES un contenedor de scroll. Un `sticky` adentro se
  // posiciona contra ella —que nunca scrollea en vertical— y queda clavado igual que
  // antes, con el `position: sticky` puesto y sin un solo error.
  assert.match(TABLAS, /const cajaStyle[^;]*overflowX: 'auto'/, 'si `cajaStyle` dejó de recortar, este guard hay que reescribirlo');
  assert.match(TABLAS, /function BarraPegada[\s\S]{0,300}?position: 'sticky'/, 'la barra dejó de ser sticky');
  for (const tabla of ['export function TablaProyectos', 'export function TablaTareas']) {
    const desde = TABLAS.indexOf(tabla);
    assert.ok(desde > 0, `no encontré ${tabla}`);
    const chunk = TABLAS.slice(desde, TABLAS.indexOf('export function Tabla', desde + 10) + 1 || undefined);
    const barra = chunk.indexOf('<BarraPegada>');
    const caja = chunk.indexOf('style={cajaStyle}');
    assert.ok(barra >= 0, `${tabla} dejó de usar BarraPegada`);
    assert.ok(caja >= 0, `${tabla} dejó de usar cajaStyle`);
    assert.ok(barra < caja, `en ${tabla} la barra quedó ADENTRO de cajaStyle: el sticky no se va a disparar`);
  }
});

/**
 * EL CUERPO DE LA ESCRITURA EN LOTE, recortado.
 *
 * ⚠️ EL ANCLA ES `escribirPrioridad` Y NO `ponerPrioridad`, y el motivo es el que hizo
 * fallar a este test el 04/10/2026: al agregarse el camino del número exacto quedaron DOS
 * funciones entre las anclas viejas, y `indexOf('const ponerPrioridad')` además matchea
 * `const ponerPrioridadExacta`. Un recorte que abarca de más mide dos cosas como si fueran
 * una; uno con un ancla ambigua mide la que no es.
 */
const cuerpoDeLaEscritura = () => {
  const ini = LOTE.indexOf('const escribirPrioridad');
  assert.ok(ini > 0, 'desapareció `escribirPrioridad`: si la escritura se partió, este guard hay que reescribirlo');
  const fin = LOTE.indexOf('/** POR BANDA', ini);
  assert.ok(fin > ini, 'cambió el cierre de `escribirPrioridad`');
  return LOTE.slice(ini, fin);
};

test('CABLEADO: el lote de prioridad deja UN solo deshacer', () => {
  // Cada `aplicarCascadaManual` ofrece el suyo y el toast vive en un casillero único, así
  // que N llamadas dejan un cartel que deshace UNA. Acá van todas con `false` y el lote
  // pisa con el suyo. Y es UNA sola escritura para los DOS caminos (banda y número): si
  // mañana hay dos cuerpos, este guard mide la mitad.
  const cuerpo = cuerpoDeLaEscritura();
  const cascadas = (cuerpo.match(/aplicarCascadaManual\(/g) ?? []).length;
  const sinDeshacer = (cuerpo.match(/, false\);/g) ?? []).length;
  assert.ok(cascadas >= 2, `esperaba la ida y la vuelta y encontré ${cascadas}`);
  assert.equal(sinDeshacer, cascadas, `${cascadas} cascadas y sólo ${sinDeshacer} sin su propio deshacer`);
  assert.match(cuerpo, /prioridadAlPerro/, 'al deshacer hay que devolverle la decisión al Perro: el candado lo puso este cambio');
  // Los DOS caminos entran por la misma función, así que el deshacer es uno por acción.
  assert.match(LOTE, /const ponerPrioridad = \(p: Prio\) => \{[\s\S]{0,260}escribirPrioridad\(/, 'el camino de la banda dejó de pasar por `escribirPrioridad`');
  assert.match(LOTE, /const ponerNumeroExacto = \(num: number\) => \{[\s\S]{0,320}escribirPrioridad\(/, 'el camino del número exacto dejó de pasar por `escribirPrioridad`');
});

test('CABLEADO: el deshacer del lote escribe en el SERVER, no sólo en la pantalla', () => {
  const cuerpo = cuerpoDeLaEscritura();
  const i = cuerpo.indexOf('board.showUndo(texto(');
  assert.ok(i > 0, 'cambió el toast del lote de prioridad');
  assert.match(cuerpo.slice(i, i + 900), /await fijar\(/, 'el deshacer revierte sólo la pantalla: eso miente hasta el próximo F5');
});

test('UN LOTE A MEDIAS NO SE ANUNCIA COMO ENTERO', () => {
  // `repo.prioridadManual` TIRA cuando el server rechaza, así que el `for` se puede cortar
  // a la mitad. Antes el `catch` era un `console.error` pelado y el `showUndo` quedaba
  // AFUERA del try: la persona no veía nada y el cartel ofrecía deshacer las N, incluidas
  // las que nunca se escribieron. Encontrado y arreglado el 04/10/2026.
  const cuerpo = cuerpoDeLaEscritura();
  assert.match(cuerpo, /const hechas/, 'se perdió la lista de las que DE VERDAD se escribieron');
  assert.match(cuerpo, /if \(!hechas\.length\)/, 'con cero escritas el cartel tiene que decirlo, no callarse');
  // El número del toast y el universo del deshacer salen de `hechas`, nunca de lo pedido.
  assert.match(cuerpo, /showUndo\(texto\(hechas\.length\)/, 'el toast vuelve a contar lo que se PIDIÓ en vez de lo que se escribió');
  assert.match(cuerpo, /for \(const a of hechas\)/, 'el deshacer vuelve a recorrer lo pedido: ofrecería revertir lo que nunca se escribió');
});

test('EL CENTINELA DEL NÚMERO EXACTO SE INTERCEPTA ANTES DEL CAST', () => {
  // `v as Prio` no chequea nada: con el centinela pasando de largo, `scoreFromPrio['@numero']`
  // es `undefined` → el server recibe NaN; y `enOrdenParaLaBanda` no filtra a nadie porque
  // ninguna banda es igual al centinela, así que movería la selección ENTERA. Dos fallas
  // mudas del mismo descuido.
  assert.ok(LOTE.includes("VALOR_NUMERO_EXACTO = '@"), 'el centinela tiene que empezar con @: `` ya significa otra cosa en esta barra');
  const i = LOTE.indexOf('if (v === VALOR_NUMERO_EXACTO)');
  const j = LOTE.indexOf('ponerPrioridad(v as Prio)');
  assert.ok(i > 0 && j > 0, 'no encontré el onChange del desplegable de prioridad');
  assert.ok(i < j, 'el centinela se evalúa DESPUÉS del cast: eso escribe un score NaN');
});

test('EL POP-UP DEL LOTE VA EN UN PORTAL, O LO TAPA EL STICKY DE LA BARRA', () => {
  // Las dos envolturas de la barra son `position: sticky` con z-index 20, y un sticky con
  // z-index distinto de `auto` CREA un contexto de apilamiento: el z-index 150 del pop-up
  // queda clampeado contra ese 20 y el modal se dibuja debajo, sin un error.
  const i = LOTE.indexOf('{numeroAbierto &&');
  assert.ok(i > 0, 'no se monta el pop-up del número exacto');
  const cuerpo = LOTE.slice(i, i + 1600);
  assert.match(cuerpo, /createPortal\(/, 'sin portal, el sticky de la barra clampea el z-index del pop-up');
  assert.match(cuerpo, /document\.body/, 'el portal tiene que salir al body');
  // Montado condicionalmente: su slider se siembra con `useState(sugerido)` y un estado
  // sembrado de props NO se resiembra — escondido en vez de desmontado, la segunda
  // apertura muestra el número de la selección anterior.
  assert.doesNotMatch(cuerpo, /display: 'none'/, 'el pop-up se esconde en vez de desmontarse: la próxima apertura miente');
  // Ni audiencia ni abrir un vecino: las dos contestan sobre UNA tarjeta.
  assert.doesNotMatch(cuerpo, /onDebate/, 'la audiencia recibe UN item: con N tildadas discute el número de una cualquiera');
  assert.doesNotMatch(cuerpo, /onAbrir/, 'abrir un vecino cierra el pop-up y tira el número que la persona estaba eligiendo');
});

test('«CONSECUTIVOS» SALE DEL REPO, NO DE LA ENTIDAD', () => {
  // Derivarlo de `entidad === 'proyecto'` es FALSO en el tablero del cliente: allá
  // `prioridadManual` escribe el número pelado, sin cascada, así que las N sí quedan todas
  // en el mismo número y mostrar un rango sería inventar. Lo que decide es quién ESCRIBE.
  assert.match(LOTE, /consecutivos=\{!!board\.repo\.prioridadDesempata/, 'el rango dejó de colgar de la capacidad del repo');
  assert.doesNotMatch(LOTE, /consecutivos=\{[^}]*entidad/, 'el rango se derivó de la entidad: miente en el tablero del cliente');
  const REPO = leer('app/plan/board/repo-plan.ts');
  assert.match(REPO, /prioridadDesempata: true/, 'el tablero del dueño dejó de declarar que desempata');
  const CLIENTE = leer('app/plan/TodoBoard.tsx');
  assert.doesNotMatch(CLIENTE, /prioridadDesempata/, 'el tablero del cliente NO desempata: declararlo sería mentir');
});

test('CABLEADO: la prioridad en lote es una CAPACIDAD, no un botón suelto', () => {
  // Dos condiciones y las dos hacen falta: que la entidad compita (`cfg.prioridad`) y que
  // ESTE tablero pueda escribirla (`repo.prioridadManual`). Y nunca sobre una selección de
  // puras recurrentes: el server rebota cada llamada con PORQUE_NO_COMPITE.
  assert.match(LOTE, /\{cfg\.prioridad && board\.repo\.prioridadManual && compiten\.length > 0 && \(/,
    'el desplegable de prioridad se dibuja sin mirar la capacidad o sin excluir a las recurrentes');
  assert.match(LOTE, /const compiten = conFecha;/, 'lo que se repite no compite ni termina: es el mismo conjunto que el deadline');
});

test('CABLEADO: `aplicarCascadaManual` sabe NO ofrecer su deshacer', () => {
  const ini = BOARD.indexOf('const aplicarCascadaManual');
  assert.ok(ini > 0, 'desapareció `aplicarCascadaManual`');
  const cuerpo = BOARD.slice(ini, BOARD.indexOf('const soltarCandadoManual'));
  assert.match(cuerpo, /conDeshacer = true/, 'el parámetro se fue: el lote vuelve a disparar N toasts');
  assert.match(cuerpo, /if \(conDeshacer && scorePrevio/, 'el parámetro existe pero no gobierna el toast');
  assert.match(cuerpo, /fijado\.texto \? \{ id: uid\(\)/, 'un texto vacío tiene que NO escribir entrada de historial: un cambio deshecho no es historia');
});

// ── EL DEADLINE EN LOTE: un desplegable, y «Quitar» adentro (pedido 2) ───────

test('QUITAR EL DEADLINE VIVE DENTRO DEL DESPLEGABLE, Y ES TEXTO', () => {
  // «El botón de quitar deadline en lote debe estar dentro del desplegable de fechas, no
  // al lado, no es intuitivo… y debe ser un texto, no un "—"» (04/10/2026).
  //
  // ⚠️ SE RECORTA EL TERNARIO DE LA FECHA, no se busca en el archivo entero: `<button` y
  // `—` aparecen legítimamente en otras veinte líneas de esta barra, y un `match` sobre el
  // fuente completo daría verde con el botón de al lado todavía puesto.
  const ini = LOTE.indexOf('{puedeFechar ? (');
  assert.ok(ini > 0, 'cambió la ranura temporal de la barra');
  const cuerpo = LOTE.slice(ini, LOTE.indexOf('{cfg.prioridad &&', ini));
  assert.ok(cuerpo.length > 500, 'el recorte de la ranura de fecha salió vacío: el ancla de cierre cambió');
  assert.match(cuerpo, /placeholder="Deadline"/, 'la fecha dejó de ser un desplegable');
  assert.match(cuerpo, /label: 'Quitar deadline'/, 'la opción de quitar no está en el menú');
  assert.match(cuerpo, /sutil: true/, 'la opción de quitar compite con la de elegir: va separada y apagada');
  // La mitad que de verdad pidió: NINGÚN botón hermano del input abierto. Ahí vivía el «—».
  assert.doesNotMatch(cuerpo, /<button/, 'volvió un botón al lado del input: eso es «al lado», que es lo que se sacó');
  assert.doesNotMatch(cuerpo, />—</, 'volvió el «—»: en este tablero ese glifo ya significa otras dos cosas');
  // Una opción dibujada cuyo `onChange` no la contempla compila perfecto y no hace nada.
  assert.match(cuerpo, /if \(v === VALOR_QUITAR_FECHA\)/, 'la opción de quitar está dibujada y el onChange no la maneja');
  assert.match(cuerpo, /if \(v === VALOR_ELEGIR_FECHA\)/, 'la opción de elegir está dibujada y el onChange no la maneja');
});

test('los centinelas de los menús de acción empiezan con @', () => {
  // `''` ya significa dos cosas en esta barra: es «Indefinida» para la repetición y es el
  // estado de reposo de todo `Dropdown` con `resetAfterSelect`. Un centinela vacío se
  // dispara solo al cerrar un menú.
  for (const c of ['VALOR_NUMERO_EXACTO', 'VALOR_ELEGIR_FECHA', 'VALOR_QUITAR_FECHA', 'VALOR_PERSONALIZADO']) {
    const m = new RegExp(`export const ${c} = '([^']+)'`).exec(LOTE);
    assert.ok(m, `desapareció ${c}`);
    assert.ok(m[1].startsWith('@'), `${c} vale «${m[1]}»: un centinela sin @ puede chocar con un valor real`);
  }
});

test('«Quitar deadline» no se ofrece si no hay ninguna fecha que quitar', () => {
  // Una opción que no puede hacer nada se lee como que la app está rota, y el toast diría
  // «Sin deadline en 4» sobre cuatro que ya no tenían ninguna.
  assert.match(LOTE, /hayFecha \? \[\{ value: VALOR_QUITAR_FECHA/, 'la opción de quitar se ofrece siempre');
  assert.match(LOTE, /const hayFecha = conFecha\.some\(\(t\) => cfg\.tieneFecha\(t\)\)/, 'cambió cómo se decide si hay fecha que quitar');
  // Y la capacidad la declara cada configuración, no se adivina del tipo: se recortan las
  // DOS funciones, porque contar sobre el archivo entero suma también la del contrato.
  for (const [cual, abre] of [['tareas', 'export function AccionesLote('], ['proyectos', 'export function AccionesLoteProyectos(']] as const) {
    const i = LOTE.indexOf(abre);
    assert.ok(i > 0, `no encontré la configuración de ${cual}`);
    assert.match(LOTE.slice(i, LOTE.indexOf('\n}\n', i)), /tieneFecha: \(/, `la configuración de ${cual} no declara tieneFecha`);
  }
});

// ── LA SELECCIÓN SOBREVIVE AL CAMBIO DE FORMATO (pedido 4) ──────────────────

test('LAS DOS FORMAS DE CADA VISTA COMPARTEN LA MISMA SELECCIÓN', () => {
  // «Si estoy seleccionando en lote desde una vista, como la de tarjetas, y paso a la de
  // tabla, debería seguir la selección tal cual» (04/10/2026).
  //
  // ⚠️ UNA PROP OPCIONAL QUE NADIE PASA COMPILA PERFECTO. Esto es «escribir la salida no es
  // ofrecerla»: sin este guard, la capacidad queda en Tablas.tsx y el pedido sin cumplir.
  const pares: Array<[string, string, string]> = [
    ['tareas', 'sel={selTareasVista} setSel={setSelTareasVista}', 'ids: selTareasVista, set: setSelTareasVista'],
    ['recurrentes · proyectos', 'elegido={selProy.has(l.id)}', 'ids: selProy, set: setSelProy'],
    ['recurrentes · tareas', 'elegida={selTareas.has(t.id)}', 'ids: selTareas, set: setSelTareas'],
  ];
  for (const [vista, enTarjetas, enTabla] of pares) {
    assert.ok(SHELL.includes(enTarjetas), `${vista}: no encontré la selección en la vista de tarjetas`);
    assert.ok(SHELL.includes(enTabla), `${vista}: la TABLA no recibe la misma selección — se pierde al conmutar formato`);
  }
  // La vista Proyectos usa `selProy` en las dos formas; la tabla lo recibe explícitamente.
  assert.equal((SHELL.match(/seleccion=\{\{ ids: selProy, set: setSelProy \}\}/g) ?? []).length, 2,
    'las DOS tablas de proyectos (la tab Proyectos y la de Recurrentes) tienen que recibir la selección de su vista');
  // Y el estado de Tareas vive en BoardShell, que es lo único que lo salva del desmonte.
  assert.match(SHELL, /const \[selTareasVista, setSelTareasVista\] = useState/, 'la selección de Tareas volvió adentro de un componente que se desmonta');
  assert.match(SHELL, /useEffect\(\(\) => \{ setSelTareasVista\(new Set\(\)\); \}, \[view\]\)/, 'sin limpiar al cambiar de VISTA, la barra reaparece con lo tildado hace media hora');
});

test('…y el tablero de un proyecto NO recibe selección: ahí no hay con qué conmutar', () => {
  // La mitad en negativo, que es la que evita que alguien la enchufe «porque la prop ya
  // estaba»: adentro del detalle de un proyecto hay UNA sola forma, así que una selección
  // controlada sería estado que nadie puede ver ni limpiar.
  const i = SHELL.indexOf('Es la MISMA `TablaTareas` de la vista principal');
  assert.ok(i > 0, 'cambió el montaje de la tabla dentro del detalle de un proyecto');
  const cuerpo = SHELL.slice(i, i + 900);
  assert.doesNotMatch(cuerpo, /seleccion=/, 'la tabla del detalle de un proyecto recibió una selección controlada');
});

test('el `useState` de la selección se llama SIEMPRE, aunque el padre la controle', () => {
  // Un hook detrás de un `if (seleccion)` para «no gastarlo» es el «Minified React error
  // #300»: pantalla entera en blanco, sin archivo ni línea, y el typecheck no lo ve.
  assert.equal((TABLAS.match(/const \[selPropia, setSelPropia\] = useState/g) ?? []).length, 2,
    'las dos tablas tienen que seguir llamando su `useState` incondicionalmente');
  assert.equal((TABLAS.match(/const sel = seleccion\?\.ids \?\? selPropia;/g) ?? []).length, 2, 'cambió cómo se elige entre la propia y la del padre');
  assert.doesNotMatch(TABLAS, /if \([^)]*\)\s*\{?\s*const \[sel/, 'apareció un useState de selección detrás de una condición');
});

// ── EL «VER MÁS» Y LAS BARRAS PEGADAS DE LAS TARJETAS (pedido 1) ────────────

test('EL «VER MÁS» SE DESPLIEGA CON LA SELECCIÓN Y SE PLIEGA AL SOLTARLA', () => {
  // «Primero se tienen que desplegar todas las del "ver más", si no, no tiene sentido… y
  // cuando dejo de seleccionar el lote, volver a plegar» (04/10/2026).
  //
  // ⚠️ SE DERIVA, NO SE DISPARA, y lo decidió el NAVEGADOR. La primera versión abría y
  // cerraba desde un `cambiarSel()` por el que pasaban los dos caminos que cambian la
  // selección, y era correcta para los dos… y dejaba un tercero afuera: desde que la
  // selección sobrevive al cambio de formato se puede tildar en la TABLA y conmutar a
  // tarjetas. Medido con el arnés: tres tildados y CINCO tarjetas dibujadas, o sea una
  // barra actuando sobre lo que no está en pantalla. Ningún guard de texto podía verlo.
  assert.match(SHELL, /const desplegadoPorSeleccion = selProy\.size > 0;/, 'el despliegue dejó de derivarse de la selección');
  assert.match(SHELL, /const visibles = \(verTodos \|\| needle \|\| desplegadoPorSeleccion\) \? shown : shown\.slice\(0, REALES\);/,
    'lo que se DIBUJA dejó de mirar la selección: se puede tildar lo que no está en pantalla');
  // Y el botón no se dibuja mientras hay selección: no podría plegar nada.
  assert.match(SHELL, /shown\.length > REALES && !desplegadoPorSeleccion && \(/, 'el «Ver más» se sigue dibujando con la selección viva, y ahí no puede hacer nada');
  // El arrastre no marca su ref sobre una grilla que la selección ya abrió: al soltar la
  // plegaría con la selección todavía viva.
  assert.match(SHELL, /!verTodos && !needle && !desplegadoPorSeleccion && shown\.length > REALES/, 'el arrastre volvió a poder plegar lo que abrió la selección');
  // ⚠️ Y NO VUELVE EL CAMINO POR EVENTO: es el que dejaba el tercer camino afuera.
  assert.doesNotMatch(SHELL, /abrioPorSeleccion/, 'volvió el despliegue por evento, que no cubre tildar en la tabla y conmutar');
});

test('LAS TRES BARRAS DE LAS VISTAS DE TARJETAS ESTÁN PEGADAS', () => {
  // El Kanban ya lo estaba desde el 24/09; las tres de tarjetas no. Medido en la grilla
  // real el 04/10/2026: tanto el ítem de grilla (`gridColumn: 1/-1`) como la hermana del
  // grid se pegan — y=8 desde scrollY=400 hasta 10.000.
  //
  // ⚠️ ESTE GUARD NO PUEDE VER SI EL STICKY SE DISPARA. Con `scrollY = 0` uno roto se ve
  // igual que uno sano; eso se mira SCROLLEANDO. Lo que sí fija es que ninguna de las
  // cuatro vuelva a quedarse sin `position: sticky`, que es como estaban.
  const barras = [...SHELL.matchAll(/<AccionesLote(?:Proyectos)? /g)].map((m) => m.index ?? 0);
  assert.ok(barras.length >= 4, `esperaba las cuatro barras del tablero y encontré ${barras.length}`);
  for (const i of barras) {
    const antes = SHELL.slice(Math.max(0, i - 420), i);
    assert.match(antes, /position: 'sticky'/, `una barra de lote quedó sin pegar (caracter ${i}): se va con el scroll`);
  }
  // Las dos de Recurrentes pueden estar vivas a la vez: con las dos en `top: 8` se tapan.
  assert.match(SHELL, /position: 'sticky', top: 66/, 'las dos barras de Recurrentes volvieron al mismo `top`: se pisan');
});

// ── Verificado rompiéndolo (04/10/2026), con los números ─────────────────────
// Base: 26 pases, 0 fallos. Cada rotura, aplicada sola y revertida después:
//
//   LA PRIORIDAD EN LOTE
//   · `enOrdenParaElNumero` FILTRA a la que ya tiene el número   → 25 · 1
//   · `enOrdenParaElNumero` sin el `sort`                        → 24 · 2
//   · el toast vuelve a contar lo PEDIDO y no lo escrito         → 25 · 1
//   · el deshacer vuelve a recorrer lo pedido                    → 25 · 1
//   · el centinela se evalúa DESPUÉS del `as Prio`               → 25 · 1
//   · el pop-up del lote sin `createPortal`                      → 25 · 1
//   · `consecutivos` derivado de la ENTIDAD                      → 25 · 1
//   · el repo del dueño deja de declarar que desempata           → 25 · 1
//
//   EL DEADLINE
//   · vuelve un botón al lado del input abierto                  → 25 · 1
//   · la opción de quitar dibujada y el `onChange` sin manejarla → 25 · 1
//   · un centinela sin `@`                                       → 25 · 1
//   · «Quitar deadline» ofrecido sin ninguna fecha que quitar    → 25 · 1
//
//   LA SELECCIÓN COMPARTIDA
//   · la tabla de Tareas deja de recibir la selección            → 25 · 1
//   · la selección de Tareas vuelve adentro del Kanban           → 25 · 1
//   · no se limpia al cambiar de vista                           → 25 · 1
//   · el detalle de un proyecto RECIBE selección                 → 25 · 1
//   · un `useState` de selección detrás de una condición         → 25 · 1
//
//   EL «VER MÁS» Y LAS BARRAS PEGADAS
//   · lo dibujado deja de mirar la selección                     → 25 · 1
//   · el «Ver más» se dibuja con la selección viva               → 25 · 1
//   · el arrastre puede plegar lo que abrió la selección         → 25 · 1
//   · vuelve el despliegue por EVENTO                            → 25 · 1
//   · la barra de la grilla de Proyectos deja de estar pegada    → 25 · 1
//   · las dos barras de Recurrentes vuelven al mismo `top`       → 25 · 1
//
// ⚠️ LA PRIMERA CORRIDA DE ESTA TANDA DEJÓ CUATRO ROTURAS EN VERDE, que es la razón por la
// que este paso existe y no es ceremonia:
//   · las dos de `enOrdenParaElNumero` pasaban porque la función NO TENÍA NI UN TEST: los
//     guards de cableado leen el archivo, no la ejecutan. Se escribieron los dos de arriba.
//   · las dos del «Ver más» pasaban por dos defectos del mismo guard. Uno medía que el
//     TEXTO del cuerpo existiera, así que cambiar la condición por `if (false)` lo dejaba
//     intacto; el otro recortaba 800 caracteres a ojo y se comía el `!verTodos && !needle`
//     del ARRASTRE, que está pegado y dice lo mismo. Los dos son el mismo defecto: un guard
//     que busca una palabra en un universo que eligió de más.
//
// ⚠️ Y LO QUE DE VERDAD CAMBIÓ EL DISEÑO NO LO ENCONTRÓ NINGÚN TEST, LO ENCONTRÓ EL
// NAVEGADOR. El «Ver más» se desplegaba desde un `cambiarSel()` por el que pasaban los dos
// caminos que cambian la selección, y los dos estaban bien cubiertos. Tildar en la TABLA y
// conmutar a tarjetas es un TERCER camino —que existe desde hoy, por el pedido 4— y dejaba
// tres tildados con cinco tarjetas dibujadas. Medido con el arnés: 3 y 5. Derivarlo de
// `selProy.size > 0` no deja ningún camino que olvidar, tampoco el que se invente mañana.
//
// ⚠️ LO QUE NINGUNO DE ESTOS PUEDE VER sigue siendo si el `sticky` se dispara: con
// `scrollY = 0` uno roto se ve igual que uno sano. Medido scrolleando el 04/10/2026:
// Proyectos-tarjetas y Kanban quedan en y=8 a 500, 800, 2.000 y 4.000. En Recurrentes el
// sticky queda confinado a SU grupo (son dos grillas, una por grupo), así que con un solo
// ítem por grupo no hay nada que scrollear adentro y no se puede observar; el `top: 66`
// escalonado está para cuando los dos grupos sean altos.
