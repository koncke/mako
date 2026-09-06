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

/** El aviso que MaKo pinta DENTRO de la app, que es la otra superficie de cliente. */
const aviso = readFileSync(
  resolve(import.meta.dirname, '..', 'app', 'video-generator', 'puente-avisos.tsx'), 'utf8',
);

/** Sin comentarios: ahí se explica el porqué y se NOMBRA la jerga a propósito. */
function sinComentarios(src: string): string {
  return src
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

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

/**
 * Sólo lo que se VE del aviso de MaKo: el texto del JSX y las frases sueltas.
 *
 * «Frase» = tiene un espacio: eso deja afuera los `import`, los `id` y las claves,
 * que son código aunque vivan entre comillas.
 */
function copyDelAviso(): string[] {
  const vivo = sinComentarios(aviso);
  const out: string[] = [];
  for (const m of vivo.matchAll(/>([^<>{}]{4,})</g)) out.push(m[1].replace(/\s+/g, ' ').trim());
  for (const m of vivo.matchAll(/'((?:[^'\\]|\\.)*)'/g)) if (/ /.test(m[1])) out.push(m[1]);
  return out.filter(Boolean);
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

test('el aviso de MaKo no relevé el `detalle` que escribe el navegador', () => {
  // ⚠️ ESTA ES LA CAUSA, NO EL SÍNTOMA. `detalle` es un campo LIBRE que la extensión
  // manda en cada latido: pintarlo convierte cualquier cosa que se escriba adentro en
  // copy de producto sin que nadie lo revise.
  //
  // Salió dos veces a la pantalla de un cliente. Una como un volcado de JSON del
  // espía cortado a la mitad. La otra como un párrafo nuestro: «Google reescribió
  // Flow y lo movió a flow.google.com; la forma en que MaKo se conectaba con la
  // versión anterior ya no existe ahí» — a alguien que no sabía qué era Flow.
  //
  // Recortar a 120 caracteres no arregla nada: el problema no es el largo.
  const vivo = sinComentarios(aviso);
  assert.ok(
    !/\bdetalle\b/.test(vivo),
    'El aviso de /video-generator vuelve a mostrar `detalle`.\n\n'
    + 'Es texto libre que escribe el navegador, no copy revisado. Si hace falta\n'
    + 'distinguir estados en la pantalla, se agrega un CÓDIGO cerrado al puente y\n'
    + 'se traduce acá — que es lo que hace `estadoDelPuente`.',
  );
});

test('ninguna pantalla de cliente cuenta lo que nos pasa a nosotros', () => {
  // El copy dice qué puede hacer la persona. Cómo hablamos con Google por dentro no
  // es de nadie más — y contarlo no es transparencia, es ruido: quien abre MaKo no
  // sabe qué es Flow, no usó la versión anterior y no tiene nada que hacer con eso.
  //
  // ⚠️ LOS DOMINIOS NO ESTÁN EN LA LISTA, A PROPÓSITO. «Borra las cookies de
  // google.com, labs.google y flow.google.com» es jerga que la persona SÍ necesita:
  // sin el nombre exacto no puede hacer lo que se le pide. La regla es sobre nuestra
  // maquinaria, no sobre toda palabra técnica.
  const JERGA = [
    'BOQ', 'rpcid', 'batchexecute', 'bearer', 'service worker', 'endpoint',
    'payload', 'protocolo', 'reescribió', 'plantilla', 'JSON', 'form-urlencoded',
  ];
  const fallos: string[] = [];
  const mirar = (donde: string, texto: string) => {
    for (const j of JERGA) {
      if (texto.toLowerCase().includes(j.toLowerCase())) fallos.push(`${donde} → «${j}» en «${texto}»`);
    }
  };
  for (const { campo, texto } of copyDelPopup()) mirar(`popup.js (${campo})`, texto);
  for (const texto of copyDelAviso()) mirar('puente-avisos.tsx', texto);
  assert.deepEqual(
    fallos, [],
    'Jerga nuestra en una pantalla de cliente:\n  ' + fallos.join('\n  ')
    + '\n\nSe dice qué puede hacer la persona, no qué nos pasó a nosotros.',
  );
});
