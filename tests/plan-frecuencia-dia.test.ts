// =============================================================================
// ¿QUÉ DÍA? — el ancla de la frecuencia: contrato, invariantes y CADENA (mig 0166)
// =============================================================================
// «La frecuencia debe poder configurarse como Google Calendar, es decir, si es 1 vez a la
// semana ¿qué día? y así» (26/09/2026).
//
// La 0165 dejó el RITMO y le faltaba el ANCLA. Lo que este test fija son TRES cosas, y las
// dos primeras son las que no se ven compilando:
//
//  1. EL CONTRATO, Y QUE SEA UNO SOLO. Una lista de días (`DIAS_SEMANA`), un saneo
//     (`frecuenciaDiaOk`), una pregunta por el ancla (`pideDia`) y UNA función que arma la
//     frase (`textoCuando`, con `textoDia` como su recorte). La columna de la 0166 NO tiene
//     `check`, igual que la de la 0165: el saneo del código es la única guarda que existe.
//  2. LAS DOS INVARIANTES. (a) Cambiar la frecuencia INVALIDA el día que ya no corresponde
//     —«cada semana, los lunes» → «cada mes» deja un `'lun'` que leído como día del mes no
//     es ningún día—. (b) Sin `recurrente` no hay día, y esa NO se escribe dos veces: se
//     hereda pasándole `frecuenciaDe(t)` al saneo, que es la regla que ya existía para la
//     frecuencia.
//  3. LA CADENA, ENTERA Y EN LAS DOS MITADES. Cada `upd` que se arma campo por campo, cada
//     payload que enumera claves y cada mapper que castea una fila es una puerta donde el
//     campo se cae en SILENCIO. La mitad del CLIENTE ya se olvidó dos veces con
//     `recurrente` (migs 0163 y 0164) y una con `frecuencia` (0165).
//
// ⚠️ PROBADO ROMPIÉNDOLO, UNA ROTURA POR VEZ, CON LOS NÚMEROS DE CADA UNA. Base: **21
// pasan, 0 fallan** (`node --import tsx --test tests/plan-frecuencia-dia.test.ts`). Cada
// línea es un cambio hecho a propósito en el código de producción, corrido y revertido:
//
//  #  Qué se rompió                                                    Result.  Qué cayó
//  1  `frecuenciaDiaOk` devolviendo `v == null ? null : String(v)`        16 / 5  el saneo del día de semana, el del día del mes, «no es una fecha», la INVARIANTE 1 y la frase
//  2  `pideDia` con `mensual: null` en `ANCLA`                            17 / 4  «cada frecuencia declara su ancla», el saneo del día del mes, la frase y «el recorte y la frase»
//  3  `textoCuando` devolviendo `base` a secas, sin el ancla               19 / 2  «la frase la arma UNA sola función» + «el recorte y la frase dicen lo mismo»
//  4  `textoDia` devolviendo `textoCuando(f, dia)`                         19 / 2  «el recorte y la frase dicen lo mismo» + «el techo del toast son 3-4 palabras»
//  5  quitar `frecuencia_dia: frecuenciaDiaOk(…)` de `taskToRow`           20 / 1  «los cuatro mappers del DUEÑO»
//  6  `rowTo` guardando `r.frecuencia_dia` crudo, sin saneo                20 / 1  «los seis puntos del CLIENTE»
//  7  el día en su propio `if` en `editarTarea`                            20 / 1  «cambiar la frecuencia RE-VALIDA el día, y por eso van en UN solo `if`»
//  8  `else { upd.frecuencia = null; }` en `editarTarea` (sin el día)      20 / 1  «sin recurrente no hay día: al desmarcar se BORRA»
//  9  quitar `frecuencia_dia: t.frecuencia_dia` de la rama «crear»         20 / 1  «las CUATRO ramas de /api/todo»
// 10  quitar `frecuenciaDia: t.frecuencia_dia` de `toBoard`                20 / 1  «el board del CLIENTE lo manda en los dos sentidos»
// 11  sacar `setFrecuenciaDia` del `return` de `useBoard`                  20 / 1  «las dos acciones están en el `return`»
// 12  los 4 `board.set*FrecuenciaDia(` de la UI → la acción de al lado     20 / 1  «las dos acciones TIENEN call site» — medido APARTE, ver abajo
// 13  `textoCuando(t.frecuencia)` sin el día en `leerTablero`              20 / 1  «el día viaja en la API de MaKo ADENTRO de la frase»
//
// ⚠️ TRES COSAS QUE LA ROTURA ENSEÑÓ Y NO SE VEÍAN ESCRIBIENDO EL TEST:
//
//  · **La rotura 1 tumbó cinco tests, y LA QUE NO CAYÓ es la que más dice.** Con el saneo
//    del día reventado entero, «INVARIANTE 2: sin `recurrente` no hay día» siguió en
//    VERDE. No es un agujero del test: es la prueba de que esa regla NO vive adentro de
//    `frecuenciaDiaOk` sino en el `frecuenciaDe(t)` que le pasan los call sites — o sea que
//    de verdad se HEREDA y no hay una segunda copia. Si algún día esa rotura la tumba,
//    significa que alguien escribió la regla dos veces.
//  · **Las roturas 3 y 4 tumbaron LAS DOS el mismo test**, «el recorte y la frase dicen lo
//    mismo», una desde cada lado. Ese test existe porque `textoDia` y `textoCuando` son
//    dos superficies del mismo dato —`sub` y `titulo` apuntando al mismo renglón, otra
//    vez—, y es el único que cae en las dos direcciones.
//  · **La rotura 12 no se pudo hacer en el árbol y se midió aparte.** `BoardShell.tsx` y
//    `AccionesLote.tsx` son de otro paquete de esta misma corrida y se estaban escribiendo
//    mientras esto corría: tocarlos, aunque fuera para revertir, es pisarle el trabajo a
//    otra sesión. Se mutó el TEXTO de los dos en memoria y se contó: `board.setFrecuenciaDia(`
//    pasa de 2 a 0 y `board.setLabelFrecuenciaDia(` de 2 a 0, con lo cual las dos
//    aserciones (`>= 1`) fallan. ⚠️ Y hay que romper LOS DOS archivos: el selector del
//    detalle y la barra de selección múltiple llaman a la misma acción, así que cambiar uno
//    solo deja el test en verde con razón — el otro call site sigue guardando.
//
// ⚠️ `lib/plan-board.ts`, `lib/todo.ts` y `app/api/todo/route.ts` son `server-only` y
// `useBoard`/`BoardShell`/`AccionesLote`/`TodoBoard` son `'use client'` con React adentro:
// los siete se leen como TEXTO. `lib/plan-recurrentes.ts` sí se importa — no lleva
// `server-only` a propósito, justamente para esto.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FRECUENCIAS, DIAS_SEMANA, DIA_MES_MAX, frecuenciaOk, frecuenciaDe, frecuenciaDiaOk, pideDia,
  textoFrecuencia, textoCuando, textoDia, type Frecuencia, type DiaSemana,
} from '../lib/plan-recurrentes';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Sin los `\r`: en Windows el árbol de trabajo es CRLF y el repo guarda LF, así que una
// búsqueda que cruce de renglón pasa en un clon y falla en el otro.
const leer = (...p: string[]): string => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r/g, '');
const cuenta = (src: string, aguja: string): number => src.split(aguja).length - 1;

const PLAN_BOARD = leer('lib', 'plan-board.ts');
const TODO = leer('lib', 'todo.ts');
const RUTA_TODO = leer('app', 'api', 'todo', 'route.ts');
const TODO_BOARD = leer('app', 'plan', 'TodoBoard.tsx');
const USE_BOARD = leer('app', 'plan', 'board', 'useBoard.ts');
const SHELL = leer('app', 'plan', 'board', 'BoardShell.tsx');
const LOTE = leer('app', 'plan', 'board', 'AccionesLote.tsx');
const HELPERS = leer('lib', 'api-mako', 'areas', 'plan.helpers.ts');

/** El cuerpo de una función del fuente, desde su firma hasta la siguiente declaración de
 *  primer nivel. Alcanza para preguntar «¿esta función nombra el campo?», que es lo único
 *  que la capa de texto puede contestar y justo lo que se cae en silencio. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |function |async function )/);
  return fin >= 0 ? resto.slice(0, fin) : resto;
}

// ── 1. EL CONTRATO ───────────────────────────────────────────────────────────────────

test('DIAS_SEMANA es UNA lista, y sus ids son claves ASCII', () => {
  assert.equal(DIAS_SEMANA.length, 7);
  const ids = DIAS_SEMANA.map((d) => d.id);
  assert.deepEqual(ids, ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'], 'el orden de la semana no es decorativo: lo usa el selector');
  assert.equal(new Set(ids).size, 7, 'ids repetidos');
  assert.equal(new Set(DIAS_SEMANA.map((d) => d.label)).size, 7, 'dos días con la misma etiqueta');
  // ⚠️ SIN ACENTO NI MAYÚSCULAS EN EL ID. Es la CLAVE que se guarda en la columna, y una
  // clave con acento se compara distinto según cómo la normalice quien la escriba (NFC vs
  // NFD): dos filas que se ven idénticas en cualquier listado y no matchean. El acento vive
  // en `label`, que es lo que se lee.
  for (const d of DIAS_SEMANA) {
    assert.ok(/^[a-z]{3}$/.test(d.id), `«${d.id}» no es una clave ASCII de 3 letras`);
    assert.ok(d.corto.length <= 3, `«${d.corto}» no entra en una columna angosta`);
  }
});

test('cada frecuencia declara QUÉ ancla pide, y ninguna se queda sin respuesta', () => {
  assert.equal(pideDia('semanal'), 'semana');
  assert.equal(pideDia('quincenal'), 'semana');
  assert.equal(pideDia('mensual'), 'mes');
  assert.equal(pideDia('trimestral'), 'mes');
  assert.equal(pideDia('anual'), 'mes');
  // «Todos los días» no tiene ancla: preguntar qué día sería una pregunta sin respuesta.
  assert.equal(pideDia('diaria'), null);
  assert.equal(pideDia(null), null);
  assert.equal(pideDia('cada tanto'), null, 'lo que no está en FRECUENCIAS no pide nada');
  // ⚠️ Y EL CONJUNTO ENTERO, no las seis sueltas: el día que `FRECUENCIAS` sume una, este
  // test dice si alguien decidió su ancla o si entró muda. `undefined` no es una respuesta.
  for (const f of FRECUENCIAS) {
    const a = pideDia(f.id);
    assert.ok(a === 'semana' || a === 'mes' || a === null, `«${f.id}» no declara su ancla`);
  }
});

test('frecuenciaDiaOk sanea el DÍA DE SEMANA contra la lista', () => {
  for (const d of DIAS_SEMANA) {
    assert.equal(frecuenciaDiaOk(d.id, 'semanal'), d.id);
    assert.equal(frecuenciaDiaOk(d.id, 'quincenal'), d.id);
  }
  // La etiqueta NO es el id: lo que se guarda es la clave, y `Lunes` no matchea nada.
  for (const d of DIAS_SEMANA) assert.equal(frecuenciaDiaOk(d.label, 'semanal'), null, `«${d.label}» es la etiqueta, no el id`);
  for (const basura of ['LUN', 'lunes', 'Lun', 'monday', '', ' ', '1', 15, true, {}, ['lun'], null, undefined]) {
    assert.equal(frecuenciaDiaOk(basura, 'semanal'), null, `«${JSON.stringify(basura)}» no es un día de la semana`);
  }
});

test('frecuenciaDiaOk sanea el DÍA DEL MES por rango, y lo canoniza', () => {
  assert.equal(frecuenciaDiaOk(15, 'mensual'), '15', 'del selector llega número');
  assert.equal(frecuenciaDiaOk('15', 'mensual'), '15', 'de Postgres llega string');
  assert.equal(frecuenciaDiaOk('015', 'trimestral'), '15', 'el mismo día no puede tener dos escrituras: es una clave');
  assert.equal(frecuenciaDiaOk(1, 'anual'), '1');
  assert.equal(frecuenciaDiaOk(DIA_MES_MAX, 'mensual'), String(DIA_MES_MAX), 'el 31 existe: qué hace febrero es del calendario, no del campo');
  for (const basura of [0, -1, 32, 1.5, '1.5', '12abc', 'lun', '', ' ', true, null, undefined, NaN]) {
    assert.equal(frecuenciaDiaOk(basura, 'mensual'), null, `«${JSON.stringify(basura)}» no es un día del mes`);
  }
});

test('un día NO se puede escribir como una fecha', () => {
  // El mismo modo de falla que el enum cerrado de la frecuencia corta un escalón más
  // arriba: si acá entrara un `YYYY-MM-DD`, el ancla se vuelve un plazo y el motor de
  // vencimientos tiene otra vez algo que declarar «atrasado».
  for (const fecha of ['2026-07-05', '05/07/2026', '2026-07', 'lunes 5']) {
    for (const f of FRECUENCIAS) assert.equal(frecuenciaDiaOk(fecha, f.id), null, `«${fecha}» con «${f.id}»`);
  }
});

test('INVARIANTE 1: cambiar la frecuencia INVALIDA el día que ya no corresponde', () => {
  // De «cada semana, los lunes» a «cada mes»: `'lun'` leído como día del mes no es ningún
  // día. Se borra — el porqué, y las tres alternativas descartadas, en `frecuenciaDiaOk`.
  assert.equal(frecuenciaDiaOk('lun', 'mensual'), null);
  assert.equal(frecuenciaDiaOk('lun', 'trimestral'), null);
  assert.equal(frecuenciaDiaOk('lun', 'anual'), null);
  // Y al revés: un día del mes no sobrevive a pasar a «cada semana».
  assert.equal(frecuenciaDiaOk('15', 'semanal'), null);
  assert.equal(frecuenciaDiaOk(15, 'quincenal'), null);
  // «Todos los días» no tiene ancla, así que se lleva puesto cualquiera de las dos.
  assert.equal(frecuenciaDiaOk('lun', 'diaria'), null);
  assert.equal(frecuenciaDiaOk('15', 'diaria'), null);
  // Y lo que SÍ sigue valiendo no se toca: pasar de semanal a quincenal conserva el día.
  assert.equal(frecuenciaDiaOk('mie', 'quincenal'), 'mie');
  assert.equal(frecuenciaDiaOk('15', 'anual'), '15');
});

test('INVARIANTE 2: sin `recurrente` no hay día, y se HEREDA de la frecuencia', () => {
  // ⚠️ NO HAY UNA SEGUNDA REGLA. El día se sanea contra `frecuenciaDe(t)`, que ya devuelve
  // null para lo que no se repite: una copia propia de «sin recurrente no existe» sería la
  // que se queda vieja el día que la primera cambie.
  const conDia = { recurrente: true, frecuencia: 'semanal' as Frecuencia };
  assert.equal(frecuenciaDiaOk('lun', frecuenciaDe(conDia)), 'lun');
  assert.equal(frecuenciaDiaOk('lun', frecuenciaDe({ ...conDia, recurrente: false })), null, 'lo que no se repite no tiene día');
  assert.equal(frecuenciaDiaOk('lun', frecuenciaDe({ frecuencia: 'semanal' })), null, 'sin el flag (tarjeta optimista, fila vieja)');
  assert.equal(frecuenciaDiaOk('lun', frecuenciaDe({ recurrente: true })), null, 'se repite y no se dijo cada cuánto');
  assert.equal(frecuenciaDiaOk('lun', frecuenciaDe({ recurrente: 1 as unknown as boolean, frecuencia: 'semanal' })), null, '`=== true`, no truthy');
});

test('la frase la arma UNA sola función, y el plural se DERIVA', () => {
  assert.equal(textoCuando('semanal', 'lun'), 'Cada semana, los lunes');
  assert.equal(textoCuando('quincenal', 'sab'), 'Cada dos semanas, los sábados');
  assert.equal(textoCuando('mensual', 15), 'Cada mes, el 15');
  assert.equal(textoCuando('trimestral', '1'), 'Cada trimestre, el 1');
  assert.equal(textoCuando('anual', 31), 'Cada año, el 31');
  // Sin ancla, o con una que no corresponde, la frase es el ritmo solo — nunca el ritmo
  // con un día inventado ni un «Cada mes, el lun».
  assert.equal(textoCuando('diaria', 'lun'), 'Todos los días');
  assert.equal(textoCuando('semanal', null), 'Cada semana');
  assert.equal(textoCuando('mensual', 'lun'), 'Cada mes');
  assert.equal(textoCuando(null, 'lun'), null, 'sin frecuencia no hay frase: `null` ≠ «no se repite»');
  assert.equal(textoCuando('cada tanto', 'lun'), null);
  // ⚠️ EL PLURAL SALE DE `label`, NO DE UNA CUARTA COLUMNA. Los que terminan en `s` son
  // invariables (lunes … viernes) y los otros dos suman una: una lista escrita a mano sería
  // la segunda lista que `DIAS_SEMANA` viene a evitar.
  for (const d of DIAS_SEMANA) {
    const esperado = d.label.toLowerCase() + (d.label.endsWith('s') ? '' : 's');
    assert.equal(textoCuando('semanal', d.id), `Cada semana, los ${esperado}`, `el plural de «${d.label}»`);
  }
});

test('el recorte y la frase dicen lo mismo: `textoDia` es un pedazo de `textoCuando`', () => {
  // Dos superficies del mismo dato que se escriben por separado divergen a la primera
  // corrección — es `sub` y `titulo` apuntando al mismo renglón, otra vez. Acá se exige que
  // una sea literalmente el final de la otra.
  for (const f of FRECUENCIAS) {
    for (const dia of [...DIAS_SEMANA.map((d) => d.id as string), '1', '15', '31', 'basura', null]) {
      const corto = textoDia(f.id, dia);
      const largo = textoCuando(f.id, dia);
      if (corto == null) { assert.equal(largo, textoFrecuencia(f.id), `«${f.id}»/«${dia}»: sin ancla la frase es el ritmo solo`); continue; }
      assert.equal(largo, `${textoFrecuencia(f.id)}, ${corto[0].toLowerCase()}${corto.slice(1)}`, `«${f.id}»/«${dia}»`);
    }
  }
  assert.equal(textoDia('semanal', 'mie'), 'Los miércoles');
  assert.equal(textoDia('mensual', 15), 'El 15');
  assert.equal(textoDia('diaria', 'lun'), null);
  assert.equal(textoDia(null, 'lun'), null);
});

test('el techo del toast son 3-4 palabras, y por eso `textoDia` existe', () => {
  // La regla de la casa, pedida tres veces el mismo día: «el mensaje del botón de deshacer
  // es MUY largo». `textoCuando('quincenal','mie')` son CINCO palabras, y el ritmo es justo
  // lo que la persona NO acaba de tocar cuando cambia el día.
  for (const f of FRECUENCIAS) {
    for (const d of [...DIAS_SEMANA.map((x) => x.id as string), '31']) {
      const t = textoDia(f.id, d);
      if (t) assert.ok(t.split(/\s+/).length <= 4, `«${t}» no entra en un toast`);
    }
  }
  // Y las etiquetas no repiten el rótulo de al lado: «Se repite» ya lo dice el interruptor.
  for (const d of DIAS_SEMANA) assert.ok(!/se repite/i.test(textoDia('semanal', d.id) ?? ''), 'la etiqueta repite «Se repite»');
});

// ── 2. LA CADENA: EL DUEÑO ───────────────────────────────────────────────────────────

test('los cuatro mappers del DUEÑO nombran el campo, y lo sanean contra la frecuencia', () => {
  // ⚠️ `frecuenciaDiaOk(` Y NO `frecuenciaDia` A SECAS: la prosa que explica la regla es
  // justo lo que sobrevive a que alguien borre la regla (medido en la 0165).
  assert.equal(cuenta(PLAN_BOARD, 'frecuenciaDia: frecuenciaDiaOk('), 2, 'las dos LECTURAS: rowToTask y rowToLabel');
  assert.equal(cuenta(PLAN_BOARD, 'frecuencia_dia: frecuenciaDiaOk('), 2, 'las dos ESCRITURAS: taskToRow y labelToRow');
  // Y el segundo argumento es la frecuencia YA saneada, que es lo que hace que las dos
  // invariantes se apliquen sin escribirse: si fuera `r.frecuencia` cruda, una fila con
  // `recurrente: false` y `frecuencia: 'semanal'` dejaría pasar el día.
  for (const fn of ['rowToTask', 'taskToRow', 'rowToLabel', 'labelToRow']) {
    assert.ok(/frecuenciaDiaOk\([^)]*frecuenciaDe\(/.test(cuerpo(PLAN_BOARD, `function ${fn}(`)), `${fn} no sanea el día contra frecuenciaDe`);
  }
});

test('el tipo del board declara el campo, en las DOS entidades', () => {
  const TYPES = leer('app', 'plan', 'board', 'types.ts');
  assert.equal(cuenta(TYPES, 'frecuenciaDia?: string | null'), 2, 'BoardTask y Label');
});

// ── 3. LA CADENA: EL CLIENTE (la mitad que ya se olvidó tres veces) ──────────────────

test('los dos tipos del CLIENTE declaran la columna', () => {
  assert.equal(cuenta(TODO, 'frecuencia_dia: string | null;'), 2, 'Tarea y Categoria');
});

test('los seis puntos del CLIENTE nombran el día: 2 lecturas, 2 altas, 2 ediciones', () => {
  assert.ok(/t\.frecuencia_dia = frecuenciaDiaOk\(/.test(TODO), 'rowTo (tarea) no sanea el día');
  assert.ok(/c\.frecuencia_dia = frecuenciaDiaOk\(/.test(TODO), 'catRow (proyecto) no sanea el día');
  assert.ok(cuerpo(TODO, 'export async function crearTarea(').includes('frecuencia_dia: frecuenciaDiaOk(input.frecuencia_dia'), 'el alta de una tarea');
  assert.ok(TODO.includes('frecuencia_dia: frecuenciaDiaOk(frecuencia_dia,'), 'el alta de un proyecto');
  for (const fn of ['export async function editarTarea(', 'export async function editarCategoria(']) {
    assert.ok(/upd\.frecuencia_dia = frecuenciaDiaOk\(/.test(cuerpo(TODO, fn)), `${fn} no guarda el día elegido`);
  }
  // Una sola lectura de la fila para los tres campos: son un solo estado, y tres helpers
  // distintos son tres consultas y tres chances de leer estados distintos.
  assert.ok(TODO.includes('async function ritmoTarea('), 'falta el respaldo del ritmo de una tarea');
  assert.ok(TODO.includes('async function ritmoCategoria('), 'falta el respaldo del ritmo de un proyecto');
  assert.equal(cuenta(TODO, "select('recurrente, frecuencia, frecuencia_dia')"), 2, 'el respaldo tiene que traer los TRES campos');
});

test('cambiar la frecuencia RE-VALIDA el día, y por eso van en UN solo `if`', () => {
  // ⚠️ EL CASO QUE SE PIERDE CON DOS `if` ES EL MÁS COMÚN: el patch cambia la frecuencia y
  // NO nombra el día, así que un bloque propio del día ni corre — y queda un «los lunes»
  // guardado bajo «cada mes», que es exactamente lo que la invariante 1 prohíbe.
  for (const fn of ['export async function editarTarea(', 'export async function editarCategoria(']) {
    const src = cuerpo(TODO, fn);
    assert.ok(src.includes('if (patch.frecuencia !== undefined || patch.frecuencia_dia !== undefined) {'), `${fn}: el día no entra por el mismo if que la frecuencia`);
  }
  // Y en el navegador, el mismo corte: `setFrecuencia` re-valida el día de la tarjeta, o la
  // pantalla seguiría mostrando el ancla vieja hasta el próximo F5 (el éxito falso).
  assert.ok(/const dia = frecuenciaDiaOk\(t\.frecuenciaDia, next\);/.test(USE_BOARD), 'setFrecuencia no re-valida el día de una tarea');
  assert.ok(/frecuenciaDia: frecuenciaDiaOk\(l\.frecuenciaDia, next\)/.test(USE_BOARD), 'setLabelFrecuencia no re-valida el día de un proyecto');
});

test('sin recurrente no hay día: al desmarcar se BORRA, en las dos mitades', () => {
  assert.equal(cuenta(TODO, 'else { upd.frecuencia = null; upd.frecuencia_dia = null; }'), 2, 'el editar de la tarea Y el de la categoría');
  assert.ok(/patchLogExplicit\(id, 'frecuenciaDia', null, t\.frecuenciaDia/.test(USE_BOARD), 'la tarea no suelta el día al desmarcarse');
  assert.ok(/recurrente: false, frecuencia: null, frecuenciaDia: null/.test(USE_BOARD), 'el proyecto no suelta el día al desmarcarse');
});

test('las CUATRO ramas de /api/todo lo dejan pasar', () => {
  // La ruta arma cada payload enumerando claves, así que una rama que no lo nombre lo tira
  // en silencio. Va CRUDO: si el día vale depende de la frecuencia efectiva, que se resuelve
  // adentro de `lib/todo.ts` — sanearlo acá sería la segunda copia de la regla.
  assert.ok(/frecuencia_dia\?: unknown;/.test(RUTA_TODO), 'el tipo del body no declara el día');
  assert.ok(/frecuencia_dia: t\.frecuencia_dia,/.test(RUTA_TODO), 'la rama «crear»');
  assert.ok(/frecuencia_dia: patch\.frecuencia_dia,/.test(RUTA_TODO), 'la rama «editar»: `undefined` viaja y significa «no lo toques»');
  assert.ok(/const frecuenciaDia = body\.frecuencia_dia;/.test(RUTA_TODO), 'la rama «categoria-crear» no lo lee');
  assert.ok(/quarter, recurrente, frecuencia, frecuenciaDia\)/.test(RUTA_TODO), 'la rama «categoria-crear» no lo pasa');
  assert.ok(/recurrente\?: boolean; frecuencia\?: unknown; frecuencia_dia\?: unknown \}\) \?\? \{\};/.test(RUTA_TODO), 'la rama «categoria-editar»: el tipo es la puerta');
});

test('el board del CLIENTE lo manda en los dos sentidos', () => {
  // `toBoard`/`toLabel` son la puerta de ENTRADA: sin ellas el selector nace vacío en cada
  // carga aunque la fila tenga el dato — elegir un día «no hace nada» al recargar.
  assert.ok(/frecuenciaDia: t\.frecuencia_dia/.test(TODO_BOARD), 'toBoard');
  assert.ok(/frecuenciaDia: c\.frecuencia_dia/.test(TODO_BOARD), 'toLabel');
  // Y los cuatro payloads de SALIDA (editar y alta de tarea, alta y editar de proyecto).
  assert.equal(cuenta(TODO_BOARD, 'frecuencia_dia: d.frecuenciaDia ?? null'), 2, 'los dos payloads de una tarea');
  assert.equal(cuenta(TODO_BOARD, 'frecuencia_dia: l.frecuenciaDia ?? null'), 2, 'los dos payloads de un proyecto');
});

// ── 4. EL FINAL DE LA CADENA: QUE EXISTA EN PANTALLA ─────────────────────────────────

test('las dos acciones están en el `return` de useBoard: si no, no existen', () => {
  const ret = USE_BOARD.slice(USE_BOARD.lastIndexOf('\n  return {'));
  for (const accion of ['setFrecuenciaDia', 'setLabelFrecuenciaDia']) {
    assert.ok(new RegExp(`[,{\\s]${accion}[,\\s]`).test(ret), `${accion} no está en el objeto que devuelve useBoard`);
  }
});

test('las dos acciones TIENEN call site, y es el suyo', () => {
  // Contar los call sites es lo único que separa «lo escribí» de «se puede usar». Son DOS
  // superficies: el selector del detalle (BoardShell) y la barra de selección múltiple
  // (AccionesLote), que aplica el mismo cambio a varias tarjetas con UN solo deshacer.
  const ui = SHELL + LOTE;
  assert.ok(cuenta(ui, 'board.setFrecuenciaDia(') >= 1, 'nadie llama a board.setFrecuenciaDia: el día de una TAREA no guarda');
  assert.ok(cuenta(ui, 'board.setLabelFrecuenciaDia(') >= 1, 'nadie llama a board.setLabelFrecuenciaDia: el de un PROYECTO no guarda');
  // Y el control se dibuja SÓLO si la frecuencia pide ancla: «todos los días» no tiene día,
  // y un control que no aplica es un control que no hace nada.
  assert.ok(SHELL.includes('pideDia('), 'el detalle dibuja el día sin preguntar si esa frecuencia lo pide');
});

// ── 5. LO QUE LEE UN AGENTE ──────────────────────────────────────────────────────────

test('el día viaja en la API de MaKo ADENTRO de la frase, nunca como id', () => {
  // Lo que un agente hace con el dato es decírselo a una persona, y traducir es donde
  // inventa. Con un `frecuencia_dia: 'lun'` al lado tendría que juntar dos campos, que es
  // otra oportunidad de inventar — y serían dos campos para el mismo renglón.
  assert.equal(cuenta(HELPERS, 'textoCuando('), 4, 'las dos mitades del tablero, tareas y proyectos');
  assert.ok(/textoCuando\(t\.frecuencia, t\.frecuenciaDia\)/.test(HELPERS), 'la tarea del DUEÑO manda el día');
  assert.ok(/textoCuando\(p\.frecuencia, p\.frecuenciaDia\)/.test(HELPERS), 'el proyecto del DUEÑO manda el día');
  assert.ok(/textoCuando\(t\.frecuencia, t\.frecuencia_dia\)/.test(HELPERS), 'la tarea del CLIENTE manda el día');
  assert.ok(/textoCuando\(c\.frecuencia, c\.frecuencia_dia\)/.test(HELPERS), 'el proyecto del CLIENTE manda el día');
  // Y NO sale un campo con el id crudo: `textoCuando(…, x.frecuencia_dia)` es un argumento,
  // `frecuencia_dia:` sería una clave del JSON que lee el modelo.
  assert.equal(cuenta(HELPERS, 'frecuencia_dia:'), 0, 'el id del día no puede salir por la API');
  assert.equal(cuenta(leer('lib', 'api-mako', 'areas', 'plan.run.ts'), 'frecuencia_dia'), 0, 'el id del día no puede salir por la API');
});
