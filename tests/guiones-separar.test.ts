// =============================================================================
// Separar un pegote de texto en guiones
// =============================================================================
// El caso real que lo produjo: el dueño trajo un .md con CINCO guiones adentro y
// dos de ellos idénticos. Lo dijo como regla: «cualquier usuario puede hacer eso,
// cargar algo así de desordenado, MaKo lo tiene que ordenar y separar».
//
// Un separador que se equivoca no rompe nada visible —guarda algo, y ese algo
// parece un guion—, así que esto es lo único que puede decir que funciona.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separarGuiones } from '../lib/guiones-separar';

/** Un párrafo de ~30 palabras, para pasar el piso sin llenar el archivo. */
const parrafo = (semilla: string) =>
  `${semilla}. ` + Array.from({ length: 30 }, (_, i) => `palabra${i}`).join(' ');

test('parte por encabezados de markdown que dicen «Guion»', () => {
  const md = [
    '# Guion 1: El día que el dueño dejó de preguntar',
    parrafo('Un empresario me dijo algo'),
    '',
    '# Guion 2: El incendio del viernes',
    parrafo('El viernes vas a terminar'),
  ].join('\n');

  const g = separarGuiones(md);
  assert.equal(g.length, 2);
  assert.equal(g[0].titulo, 'El día que el dueño dejó de preguntar');
  assert.match(g[0].texto, /Un empresario me dijo algo/);
  assert.doesNotMatch(g[0].texto, /^#/, 'el encabezado NO va en el cuerpo');
  assert.match(g[1].texto, /El viernes vas a terminar/);
});

test('marca el DUPLICADO en vez de tirarlo', () => {
  // Es el caso literal del archivo del dueño: el guion 1 y el 4 son idénticos.
  // Que sean iguales puede ser un copy-paste al armar el archivo —lo más
  // probable— o dos versiones que quiere tener. Decide él; lo que no puede pasar
  // es que se carguen dos veces sin que nadie se entere.
  const cuerpo = parrafo('Un empresario me dijo algo que me dio risa');
  const md = [
    '# Guion 1: El día que el dueño dejó de preguntar', cuerpo, '',
    '# Guion 2: Otro distinto', parrafo('El viernes vas a terminar'), '',
    '# Guion 4: El día que el dueño dejó de preguntar', cuerpo,
  ].join('\n');

  const g = separarGuiones(md);
  assert.equal(g.length, 3, 'los tres se devuelven');
  assert.equal(g[0].duplicado, false);
  assert.equal(g[1].duplicado, false);
  assert.equal(g[2].duplicado, true, 'el tercero repite al primero');
});

test('el duplicado se detecta aunque cambien acentos, comillas o markdown', () => {
  // Dos textos que se ven distintos byte a byte y son el mismo guion. La huella
  // normaliza para COMPARAR, nunca para guardar.
  const uno = '# Guion 1\n' + parrafo('El **día** que el dueño dejó de preguntar');
  const dos = '# Guion 2\n' + parrafo('El dia que el dueno dejo de preguntar');
  const g = separarGuiones(uno + '\n' + dos);
  assert.equal(g.length, 2);
  assert.equal(g[1].duplicado, true);
});

test('un texto SIN encabezados es UN guion, no un error', () => {
  // Devolver vacío acá sería decirle a alguien que su guion no existe.
  const t = parrafo('Hola, te cuento algo que me pasó');
  const g = separarGuiones(t);
  assert.equal(g.length, 1);
  assert.equal(g[0].texto, t);
  assert.equal(g[0].titulo, '');
});

test('parte por separadores cuando no hay encabezados', () => {
  const md = [parrafo('Primero'), '', '---', '', parrafo('Segundo')].join('\n');
  const g = separarGuiones(md);
  assert.equal(g.length, 2);
  assert.match(g[0].texto, /Primero/);
  assert.match(g[1].texto, /Segundo/);
});

test('un encabezado con dos líneas debajo NO es un guion', () => {
  // Un título huérfano no es una pieza. Sin el piso, cargar un índice produciría
  // diez «guiones» de una línea.
  const md = ['# Guion 1', 'Nota suelta.', '', '# Guion 2', parrafo('Este sí')].join('\n');
  const g = separarGuiones(md);
  assert.equal(g.length, 1);
  assert.match(g[0].texto, /Este sí/);
});

test('el texto ANTES del primer encabezado no se pierde', () => {
  // Un archivo que arranca sin encabezado y recién después los usa. Hacen falta
  // DOS encabezados para que se parta (ver el test de abajo).
  const md = [
    parrafo('Esto va suelto arriba'), '',
    '# Guion 1', parrafo('Y esto después'), '',
    '# Guion 2', parrafo('Y esto al final'),
  ].join('\n');
  const g = separarGuiones(md);
  assert.equal(g.length, 3);
  assert.match(g[0].texto, /Esto va suelto arriba/);
  assert.equal(g[0].titulo, '', 'lo de arriba no tiene título: no lo había');
});

test('UN solo encabezado NO parte nada: es un título, no un separador', () => {
  // La regla es conservadora a propósito. Un «# Mi guion» arriba de un texto es
  // cómo se titula un documento, no cómo se separan dos piezas — y partir ahí
  // dejaría el guion cortado en dos, con la mitad de arriba huérfana.
  //
  // Para partir hace falta EVIDENCIA de repetición: dos encabezados, o un
  // separador explícito. Con uno solo, la lectura correcta es «un guion titulado».
  const md = ['# El día que el dueño dejó de preguntar', parrafo('Un empresario me dijo')].join('\n');
  const g = separarGuiones(md);
  assert.equal(g.length, 1);
  assert.match(g[0].texto, /Un empresario me dijo/);
});

test('un texto vacío devuelve vacío, no un guion en blanco', () => {
  assert.deepEqual(separarGuiones(''), []);
  assert.deepEqual(separarGuiones('   \n\n  '), []);
});

test('los párrafos de un mismo guion NO se parten', () => {
  // El error obvio sería cortar por línea en blanco. Un guion tiene párrafos.
  const md = ['# Guion 1', 'Primer párrafo del guion.', '', 'Segundo párrafo.', '', 'Tercero, y cierra.'].join('\n');
  const g = separarGuiones(md, 5);
  assert.equal(g.length, 1);
  assert.match(g[0].texto, /Primer párrafo/);
  assert.match(g[0].texto, /Tercero, y cierra/);
});
