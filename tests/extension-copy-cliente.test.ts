// =============================================================================
// Lo que sale a la pantalla de un cliente no lleva jerga ni le falta un acento
// =============================================================================
// ⚠️ ESTE TEST EXISTE PORQUE LAS DOS COSAS LLEGARON A PRODUCCIÓN EL MISMO DÍA.
//
// El dueño lo reportó así: «¿qué onda con los mensajes que estás dejando dentro de
// MaKo y de la extensión que utilizarán clientes? Estás haciendo mal las cosas».
//
// ① UN VOLCADO DE JSON EN LA PANTALLA DEL CLIENTE. El campo `detalle` del puente es
//    el mensaje humano que la app pinta en `/video-generator`. Se le escribió encima
//    el JSON del espía, y un cliente terminó leyendo
//    `{"boq:cPZSdc":{"metodo":"POST","hayRespuesta":true,…` cortado a la mitad.
//
// ② IDENTIFICADORES DE CÓDIGO. El popup decía «Todavía no sé reconocer creditos,
//    estado_clips, subir_imagen» — nombres de variables. En la pantalla de alguien
//    eso no se lee como una explicación: se lee como que la app está a medio hacer.
//
// ③ Y ACENTOS COMIDOS: «ensenar», «creditos», «aprendi», «pestana». Se colaron
//    porque el texto pasó por una capa que se los llevó, y el resto del archivo
//    —escrito antes— está perfecto: «Google pausó tu sesión de Flow», «Te devolví a
//    tu proyecto». O sea que no fue una decisión de estilo, fue una regresión.
//
// El copy es la superficie que más se toca y la que menos se revisa. Un test es lo
// único que la mira todas las veces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERACIONES } from '../lib/flow-operaciones';

const popup = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'popup.js'), 'utf8',
);

/** Sólo el texto que la persona ve: los `titulo`, `tenue` y `boton` de cada pantalla. */
function copyDelPopup(): { campo: string; texto: string }[] {
  const out: { campo: string; texto: string }[] = [];
  const sinComentarios = popup
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of sinComentarios.matchAll(/\b(titulo|tenue|boton)\s*:\s*([^\n]+)/g)) {
    // Sólo los literales: lo que sale de una variable se prueba en su origen.
    for (const lit of m[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      if (lit[1].trim()) out.push({ campo: m[1], texto: lit[1] });
    }
  }
  return out;
}

test('ningún texto de pantalla trae un identificador de código', () => {
  // Los `op` del catálogo son nombres de variables: `subir_imagen`, `generar_clip`.
  // Su lugar es el código; para la pantalla existe `nombre`.
  const ids = OPERACIONES.map((o) => o.op);
  for (const { campo, texto } of copyDelPopup()) {
    for (const id of ids) {
      assert.ok(
        !texto.includes(id),
        `El ${campo} trae el identificador «${id}»:\n  «${texto}»\n\n`
        + 'Los `op` son nombres de variables. Para la pantalla está `nombre` en\n'
        + 'lib/flow-operaciones.ts.',
      );
    }
    // Y la forma general: nada con guion bajo entre palabras.
    assert.ok(
      !/\b[a-z]+_[a-z]+\b/.test(texto),
      `El ${campo} parece traer un identificador:\n  «${texto}»`,
    );
  }
});

test('ninguna palabra del copy perdió su acento', () => {
  // Las que se comieron de verdad, más las que rodean a este puente. Es una lista
  // corta a propósito: sólo las que ya pasaron y las vecinas obvias.
  const SIN_TILDE: Record<string, string> = {
    ensenar: 'enseñar', ensename: 'enséñame', ensenarme: 'enseñarme',
    creditos: 'créditos', aprendi: 'aprendí', pestana: 'pestaña',
    afirmacion: 'afirmación', simplificacion: 'simplificación',
    generacion: 'generación', sesion: 'sesión', conexion: 'conexión',
    version: 'versión', boton: 'botón', ultima: 'última', proximo: 'próximo',
    aca: 'acá', mas: 'más', esta: 'está', aun: 'aún', aqui: 'aquí',
  };
  // `mas`, `esta` y `aun` son homógrafos: existen sin tilde. Se miran sólo las que
  // no lo son, para no marcar texto correcto.
  const AMBIGUAS = new Set(['mas', 'esta', 'aun']);

  const fallos: string[] = [];
  for (const { campo, texto } of copyDelPopup()) {
    for (const p of texto.toLowerCase().match(/[a-záéíóúñü]+/g) || []) {
      if (AMBIGUAS.has(p)) continue;
      if (SIN_TILDE[p]) fallos.push(`${campo}: «${texto}» → «${p}» debería ser «${SIN_TILDE[p]}»`);
    }
  }
  assert.deepEqual(
    fallos, [],
    'Copy sin acentos en una pantalla de cliente:\n  ' + fallos.join('\n  ')
    + '\n\n⚠️ Suele ser una regresión, no una decisión: el texto pasó por una capa que\n'
    + 'se los llevó (un heredoc de bash, un script de reemplazo). El resto del archivo\n'
    + 'los tiene bien.',
  );
});

test('toda operación tiene un nombre para personas, distinto de su `op`', () => {
  for (const o of OPERACIONES) {
    assert.ok(o.nombre, `${o.op} no tiene nombre para personas`);
    assert.notEqual(o.nombre, o.op, `el nombre de ${o.op} es el identificador`);
    assert.ok(
      !/_/.test(o.nombre),
      `el nombre de ${o.op} tiene un guion bajo: «${o.nombre}»`,
    );
    // En minúscula y sin punto: se compone dentro de una frase.
    assert.ok(
      o.nombre === o.nombre.toLowerCase() && !o.nombre.endsWith('.'),
      `el nombre de ${o.op} no se puede componer en una frase: «${o.nombre}»`,
    );
  }
});
