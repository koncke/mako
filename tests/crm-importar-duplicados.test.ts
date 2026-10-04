// =============================================================================
// La importación hace lo que la pantalla dice: ni crea de más ni descarta de más
// =============================================================================
// MEDIDO EL 03/10/2026, vivo desde el 14/08 (commit 2dfa4bab). Cuatro piezas
// correctas por separado y tres respuestas distintas a la misma pregunta:
//
//   · `filasDesdeCsv` pone `incluir: true` en TODAS las filas.
//   · `recalcular` escribe `motivo` y NUNCA toca `incluir`.
//   · la tabla dibujaba la fila repetida gris, sin tilde, con el cartel «ya existe»
//     y con la casilla DESHABILITADA (`tildar` exigía `!f.motivo`).
//   · el server salteaba con `!f.incluir || chocaAcá` y a ESA MISMA fila le pasaba
//     `permitirDuplicado: !!f.motivo` → true justo para las marcadas.
//
// O sea: la fila que la pantalla mostraba como descartada se creaba igual Y con la
// guarda anti-duplicado apagada. Y el contador no lo delataba porque medía bien:
// el botón decía «Crear 80 leads» contando sólo las limpias mientras el server
// creaba 80 MÁS las repetidas. Dos números correctos sobre preguntas distintas.
//
// ⚠️ LO QUE NO SE REVIRTIÓ, Y POR QUÉ. El camino obvio era que el server respetara
// el motivo y no creara nunca un duplicado. Está DESCARTADO: la decisión del 14/08
// («el anti-duplicado avisa en vez de decidir») está fijada por un guard de otro
// archivo —tests/leads-duplicados.test.ts: «el tilde de la persona es la
// autorización» y «volvió el descarte del duplicado tildado»—, así que reescribirla
// de este lado habría dejado ese guard rojo y una decisión ajena revertida en
// silencio. Lo que estaba roto no era la decisión: era que la pantalla no la podía
// tomar. Un tilde que la persona no puede mover no es una decisión, es un default —
// y el default era duplicar.
//
// Lo que este archivo fija es que los TRES lectores contesten con la MISMA función
// (`entra`, en app/crm/leads-importar.ts): la casilla que se dibuja, el número que
// promete el botón y el portón del server.
//
// ⚠️ PROBADO ROMPIÉNDOLO, las diez. Con el arreglo puesto: 19 pases, 0 fallos.
//   · el portón del server vuelve a `!f.incluir || chocaAcá` ....... 2 FALLOS, 17 pases
//   · `entra` ignora el motivo (`f.incluir` pelado) ................. 2 FALLOS, 17 pases
//   · `entra` rechaza TODO motivo (el duplicado tildado no entra) ... 2 FALLOS, 17 pases
//   · `contar` cuenta `tildadas` sólo entre las filas sin motivo .... 1 FALLO, 18 pases
//   · la casilla vuelve a exigir `!f.motivo` para tildarse .......... 1 FALLO, 18 pases
//   · el duplicado vuelve a nacer TILDADO en el modal ............... 1 FALLO, 18 pases
//   · el modal deja de recalcular en cada edición ................... 1 FALLO, 18 pases
//   · `recalcular` deja de marcar 'duplicado' con `yaExiste` ........ 2 FALLOS, 17 pases
//   · se le saca el pegado del apellido a `filasDesdeCsv` ........... 6 FALLOS, 13 pases
//   · la columna de apellido puede elegirse a sí misma .............. 1 FALLO, 18 pases
//
// ⚠️ Y LA PRIMERA ROTURA ENCONTRÓ UN AGUJERO EN ESTE ARCHIVO, no en el código: daba
// un fallo menos de los que tenía que dar, porque el test que compara lo prometido
// con lo creado usaba un ESPEJO de la condición del portón escrito a mano acá. El
// espejo seguía verde sobre el bug — estaba midiendo mi transcripción. Ahora la
// condición se COMPILA desde el fuente y se le inyecta el `entra` de verdad.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MOTIVO_DECIDIBLE, contar, entra, filasDesdeCsv, filasDesdePlanilla, recalcular,
  type FilaImport,
} from '../app/crm/leads-importar';

const raiz = (p: string) => join(import.meta.dirname, '..', p);
const leer = (p: string) => readFileSync(raiz(p), 'utf8');

/**
 * Lo que un bloque EJECUTA, sin su prosa.
 *
 * ⚠️ ESTO NO ES PROLIJIDAD, es el bug que este archivo tuvo en su primera corrida: el
 * assert de `permitirDuplicado` falló contra el COMENTARIO que explicaba por qué ya no
 * se pasaba. Un guard que lee el archivo entero encuentra lo que el archivo dice de SÍ
 * MISMO, y la convención de esta casa es justamente explicar en el comentario lo que se
 * sacó del código — o sea que todo guard que busque una ausencia la iba a encontrar en
 * su propia explicación.
 *
 * Sólo se van los comentarios de línea COMPLETOS: uno al final de una línea de código
 * no se puede sacar con un regex sin comerse el `//` de una URL dentro de una cadena. Y
 * el orden es el de siempre —los de línea ANTES que los de bloque—, porque un `/*`
 * adentro de un `//` abriría un bloque que se cierra páginas después y dejaría
 * invisible todo lo del medio.
 */
function soloCodigo(src: string): string {
  return src
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * El cuerpo de `importarLeadsRevisadosAction`, no el archivo entero: `permitirDuplicado`
 * aparece también en el alta manual, donde es correcto porque ahí una persona vio con
 * quién choca.
 */
function bloqueImportacion(): string {
  const src = leer('app/crm/actions.ts');
  const desde = src.indexOf('export async function importarLeadsRevisadosAction');
  assert.ok(desde > 0, 'no encontré importarLeadsRevisadosAction: ¿se renombró?');
  const hasta = src.indexOf('\nexport ', desde + 10);
  assert.ok(hasta > desde, 'no encontré el final del bloque');
  return src.slice(desde, hasta);
}

/** La condición EXACTA con la que el server saltea una fila, leída del fuente. */
function condicionDelPorton(): string {
  const porton = soloCodigo(bloqueImportacion()).match(/if \(([^)]*\)?[^)]*)\) \{ omitidos\+\+; continue; \}/);
  assert.ok(porton, 'no encontré el portón `if (…) { omitidos++; continue; }`');
  return porton[1];
}

/**
 * El portón del server, EJECUTABLE y con el `entra` DE VERDAD inyectado.
 *
 * ⚠️ Se compila desde el fuente en vez de copiarse acá, y la diferencia se midió: con
 * el espejo escrito a mano, romper el portón hacía fallar un test menos — el que
 * comparaba lo prometido con lo creado seguía verde sobre el bug, porque comparaba
 * contra mi propia transcripción. Una verificación que no vuelve a la fuente es una
 * tautología (AGENTS.md). app/crm/actions.ts no se puede importar desde un test
 * (arrastra next/headers), así que esto es lo más cerca de la función real que se llega:
 * la condición es la del archivo, carácter por carácter, y `entra` es el del módulo.
 */
function porton(f: FilaImport, chocaAca = false): boolean {
  const fn = new Function('f', 'chocaAcá', 'entra', `return (${condicionDelPorton()});`) as
    (f: FilaImport, c: boolean, e: typeof entra) => boolean;
  return fn(f, chocaAca, entra);
}

const fila = (p: Partial<FilaImport>): FilaImport => ({
  id: 'x', nombre: 'Juan Pérez', email: '', telefono: '', empresa: '',
  incluir: true, yaExiste: false, ...p,
});

test('el portón del server decide con `entra`, la misma función que dibuja la casilla', () => {
  const cond = condicionDelPorton();
  assert.match(cond, /entra\(f\)/,
    'EL PORTÓN TIENE SU PROPIA CONDICIÓN: es como la pantalla, el botón y el server '
    + 'llegaron a contestar tres cosas distintas sobre la misma fila');
  assert.match(cond, /chocaAc/,
    'el portón dejó de frenar dos filas del MISMO archivo, que `marcarExistentes` no '
    + 'puede ver porque miró la base antes de empezar');
});

test('`entra` es la única respuesta a «¿esta fila se va a crear?»', () => {
  // Las cuatro combinaciones que importan, sobre la función real.
  assert.equal(entra(fila({ incluir: true })), true, 'una fila limpia y tildada entra');
  assert.equal(entra(fila({ incluir: false })), false, 'destildada no entra');
  assert.equal(entra(recalcular([fila({ incluir: true, nombre: '' })])[0]), false,
    'una fila sin nombre no entra NI tildada: createLead la rechazaría');
  assert.equal(entra(recalcular([fila({ incluir: true, email: '', telefono: '' })])[0]), false,
    'una fila incontactable no entra NI tildada: el alta manual lo prohíbe desde siempre');
});

test('el duplicado TILDADO entra, y el duplicado destildado no', () => {
  // Es la decisión del 14/08 y ahora existe de verdad: la casilla de esas filas se
  // puede mover, nacen destildadas, y el server respeta lo que quedó.
  const [dup] = recalcular([fila({ email: 'ya@x.com', yaExiste: true })]);
  assert.equal(dup.motivo, MOTIVO_DECIDIBLE, 'una fila que ya existe queda marcada');
  assert.equal(entra({ ...dup, incluir: false }), false, 'destildado NO se crea');
  assert.equal(entra({ ...dup, incluir: true }), true, 'tildado a sabiendas SÍ se crea');
  // Y el portón del server contesta igual, con su condición compilada del fuente.
  assert.equal(porton({ ...dup, incluir: false }), true, 'el server saltea el destildado');
  assert.equal(porton({ ...dup, incluir: true }), false, 'el server respeta el tilde');
});

test('`permitirDuplicado` sale del MOTIVO, no de la verdad de `f.motivo`', () => {
  // La diferencia es la que producía el bug: `!!f.motivo` es true para las CUATRO
  // razones de descarte, así que apagaba la guarda de `createLead` también para una
  // fila sin nombre o sin contacto — filas que no son una decisión de nadie.
  const codigo = soloCodigo(bloqueImportacion());
  assert.match(codigo, /const duplicado = f\.motivo === 'duplicado';/,
    '`permitirDuplicado` tiene que colgar del motivo exacto, no de que haya ALGÚN motivo');
  assert.match(codigo, /permitirDuplicado: duplicado/,
    'sin esto `createLead` vuelve a frenar al duplicado que la persona tildó, y el '
    + 'tilde vuelve a ser un control que no hace nada');
});

test('lo que el botón promete crear es lo que el server crea', () => {
  const filas = recalcular([
    fila({ id: 'a', email: 'ana@x.com' }),                                  // entra
    fila({ id: 'b', email: 'ya@x.com', yaExiste: true, incluir: false }),   // ya existe, destildado
    fila({ id: 'c', email: 'otro@x.com', yaExiste: true, incluir: true }),  // ya existe, tildado
    fila({ id: 'd', nombre: '', email: 'sin@x.com' }),                      // sin nombre
    fila({ id: 'e', nombre: 'Sin Contacto' }),                              // incontactable
    fila({ id: 'f', email: 'ana@x.com' }),                                  // repetida en el archivo
  ]);

  const c = contar(filas);
  // El rótulo del botón es `Crear ${c.tildadas} leads` (ImportarLeadsModal).
  // Son dos: la única fila limpia (la 'f' repite el email de la 'a', así que queda
  // 'repetido-archivo') más el que ya existe en el CRM y alguien tildó.
  assert.equal(c.tildadas, 2, 'la fila limpia más el repetido que alguien tildó');
  assert.equal(c.listas, 1, 'y sólo UNA no tiene ningún motivo');
  assert.equal(c.aProposito, 1, 'uno de los dos es un repetido a propósito');

  // Y lo que el server crearía, contado con SU portón —el del archivo, compilado—, no
  // con una copia de su condición escrita acá.
  assert.equal(filas.filter((f) => !porton(f)).length, c.tildadas,
    'la pantalla y el server tienen que contar lo MISMO: cuando divergen, el que se '
    + 've es el número de la pantalla y el que pasa es el del server');

  assert.deepEqual(
    { dup: c.duplicado, sinNombre: c['sin-nombre'], sinContacto: c['sin-contacto'], rep: c['repetido-archivo'] },
    { dup: 2, sinNombre: 1, sinContacto: 1, rep: 1 },
  );
});

test('dos filas del mismo archivo no se pisan aunque las dos estén tildadas', () => {
  // `chocaAcá` no es una decisión que respetar: es el archivo con la misma persona dos
  // veces, y la segunda se frena contra lo ya insertado EN ESTA corrida.
  const [f] = recalcular([fila({ email: 'ana@x.com' })]);
  assert.equal(porton(f, true), true, 'con choque en la corrida, se saltea');
  assert.equal(porton(f, false), false, 'sin choque, entra');
});

test('la casilla se puede mover en el duplicado y NO en las filas inválidas', () => {
  // El control vive en la tabla (TablaRevisionLeads) y es la mitad que faltaba: sin
  // esto el server respeta un tilde que la persona no puede poner ni sacar.
  const tabla = soloCodigo(leer('app/crm/TablaRevisionLeads.tsx'));
  const i = tabla.indexOf('const tildar =');
  assert.ok(i > 0, 'no encontré `tildar` en la tabla de revisión');
  const cuerpo = tabla.slice(i, tabla.indexOf('\n  const', i + 5));
  assert.match(cuerpo, /MOTIVO_DECIDIBLE/,
    'volvió el `!f.motivo` pelado: la única fila cuyo descarte es una DECISIÓN es '
    + 'justo la que no se puede decidir');
  // Y la casilla de una fila inválida sigue deshabilitada: ofrecer un tilde que el
  // server va a ignorar es la misma mentira con el signo cambiado.
  assert.match(tabla, /disabled=\{invalido\}/, 'la casilla de una fila inválida tiene que estar apagada');
});

test('el duplicado nace DESTILDADO: el default no puede ser duplicar en silencio', () => {
  // `filasDesdeCsv` pone `incluir: true` en todas las filas, así que el default de «ya
  // existe en el CRM» era crearlo. Para el que importa tres bases que se solapan, una
  // ficha de más por persona repetida deja a los DOS leads inalcanzables para Calendly,
  // Meta y Fathom: dos filas con el mismo `telefono_normalizado` rompen sus
  // `.maybeSingle()` con PGRST116.
  const modal = soloCodigo(leer('app/crm/ImportarLeadsModal.tsx'));
  assert.match(modal, /recalcular\(data\.filas\)\.map\(\(f\) => \(f\.motivo \? \{ \.\.\.f, incluir: false \} : f\)\)/,
    'las filas con motivo tienen que nacer destildadas al leer el archivo');
  // Y el default se aplica UNA vez: dentro de `recalcular` correría en cada edición y
  // le borraría el tilde a la persona que lo acaba de poner.
  const importador = soloCodigo(leer('app/crm/leads-importar.ts'));
  const r = importador.indexOf('export function recalcular');
  const cuerpoRecalcular = importador.slice(r, importador.indexOf('\n}', r));
  assert.doesNotMatch(cuerpoRecalcular, /incluir/,
    '`recalcular` corre en cada edición: si toca `incluir`, le borra el tilde a la '
    + 'persona que acaba de tildar un repetido a propósito');
});

test('corregir una celda recalcula el motivo: la pantalla no se queda vieja', () => {
  // La cabecera de leads-importar.ts lo declara desde el día uno y lo cumplía sólo el
  // OTRO consumidor de esta tabla (`RevisarLead`). En el camino del archivo
  // `recalcular` corría una sola vez, al leer, así que corregir el nombre de una fila
  // «sin nombre» la dejaba atenuada y sin casilla en pantalla mientras el server —que
  // sí recalcula al confirmar— la creaba: la misma mentira, por el otro camino.
  const modal = soloCodigo(leer('app/crm/ImportarLeadsModal.tsx'));
  assert.match(modal, /onFilas=\{\(v\) => setFilas\(\(prev\) => recalcular\(/,
    'cada edición de la tabla tiene que volver a pasar por `recalcular`');
});

// =============================================================================
// Y EL APELLIDO, que entraba por el mismo parser y se TIRABA (#621)
// =============================================================================
// Vive acá y no en un archivo propio porque es el mismo parser y el mismo momento:
// qué filas entran y CON QUÉ NOMBRE entran. Se buscaban cuatro encabezados —nombre,
// email, teléfono, empresa— y ninguno era apellido, así que un archivo con las dos
// columnas separadas (la forma normal de exportar de cualquier CRM) entraba con media
// identidad: «Juan» a secas, imposible de distinguir del otro Juan de la lista, y
// saludando sin apellido en toda plantilla (todo el repo lo deriva partiendo `nombre`,
// lib/template-vars.ts). No hace falta columna nueva: la tabla `leads` no tiene
// apellido, así que se PEGA.
//
// ⚠️ Las dos roturas de esta mitad están medidas arriba, con las otras ocho.
// =============================================================================

/** El CSV de un caso, con su encabezado. Devuelve el `nombre` de cada fila. */
const nombresDe = (csv: string): string[] => {
  const { filas, error } = filasDesdeCsv(csv);
  assert.equal(error, undefined, `el parser rebotó el archivo: ${error}`);
  return filas.map((f) => f.nombre);
};

test('nombre y apellido en dos columnas entran PEGADOS, y en ese orden', () => {
  assert.deepEqual(
    nombresDe('Nombre,Apellido,Email\nJuan,Pérez,juan@x.com\nAna,Gómez,ana@x.com'),
    ['Juan Pérez', 'Ana Gómez'],
  );
});

test('el orden sale de QUÉ es cada columna, no de dónde está', () => {
  // «Apellido | Nombre» también es común, y pegarlo en el orden del archivo daría
  // «Pérez Juan»: el saludo al revés en toda plantilla.
  assert.deepEqual(
    nombresDe('Apellido,Nombre,Email\nPérez,Juan,juan@x.com'),
    ['Juan Pérez'],
  );
});

test('«Nombre y Apellido» en UNA columna no se duplica', () => {
  // Ese encabezado matchea las dos listas de tokens: sin el guard, la misma celda se
  // pegaría a sí misma y el lead entraría como «Juan Pérez Juan Pérez».
  assert.deepEqual(
    nombresDe('Nombre y Apellido,Email\nJuan Pérez,juan@x.com'),
    ['Juan Pérez'],
  );
});

test('«Last Name» como única columna de nombre no se pega a sí misma', () => {
  // 'last name' contiene 'name', así que ES la columna de nombre que encuentra el
  // parser. Sin el `i !== iNombre` se pegaría encima: «Pérez Pérez».
  assert.deepEqual(
    nombresDe('Last Name,Email\nPérez,juan@x.com'),
    ['Pérez'],
  );
});

test('los encabezados en inglés también se pegan', () => {
  assert.deepEqual(
    nombresDe('First Name,Last Name,Email\nJuan,Pérez,juan@x.com'),
    ['Juan Pérez'],
  );
});

test('los DOS apellidos entran: «Paterno» y «Materno» no es una columna, son dos', () => {
  // Es como exporta media Latinoamérica. Quedarse con la primera tira el segundo
  // apellido igual que antes se tiraba el único.
  assert.deepEqual(
    nombresDe('Nombre,Apellido Paterno,Apellido Materno,Email\nJuan,Pérez,García,juan@x.com'),
    ['Juan Pérez García'],
  );
});

test('un apellido vacío no deja el nombre con un espacio colgando', () => {
  // Un `nombre` que termina en espacio no se ve en ningún listado y rompe cualquier
  // comparación por nombre — incluida la de duplicados.
  const r = nombresDe('Nombre,Apellido,Email\nJuan,,juan@x.com\nAna,   ,ana@x.com');
  assert.deepEqual(r, ['Juan', 'Ana']);
  for (const n of r) assert.equal(n, n.trim(), `«${n}» tiene espacio de sobra`);
});

test('la planilla entra por el MISMO parser, así que también trae el apellido', () => {
  // El .xlsx y el .ods llegan como TSV por `filasDesdePlanilla`. Si el apellido se
  // hubiera arreglado sólo en el camino del CSV, el de la planilla seguiría tirándolo.
  const tsv = '===== Hoja: Contactos =====\nNombre\tApellido\tEmail\nJuan\tPérez\tjuan@x.com';
  const { filas, error } = filasDesdePlanilla(tsv);
  assert.equal(error, undefined);
  assert.deepEqual(filas.map((f) => f.nombre), ['Juan Pérez']);
});

test('el archivo sin columna de nombre sigue avisando qué encabezados se esperan', () => {
  const { filas, error } = filasDesdeCsv('Correo,Teléfono\njuan@x.com,555');
  assert.equal(filas.length, 0);
  assert.match(String(error), /Apellido/, 'el mensaje tiene que nombrar la columna nueva');
});

test('con el nombre de pila vacío, el apellido ES el nombre: la fila no se descarta', () => {
  // Antes esa fila llegaba con el campo vacío y `recalcular` la marcaba 'sin-nombre',
  // o sea que un contacto que SÍ traía cómo se llama se descartaba por mirar la
  // columna equivocada.
  const { filas } = filasDesdeCsv('Nombre,Apellido,Email\n,Pérez,x@x.com');
  const [f] = recalcular(filas);
  assert.equal(f.nombre, 'Pérez');
  assert.equal(f.motivo, null, 'con el apellido pegado el nombre NO queda vacío');
});
