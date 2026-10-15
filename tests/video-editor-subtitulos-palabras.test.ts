// =============================================================================
// Los tiempos por palabra de un subtítulo: se guardan, sobreviven y no mienten
// =============================================================================
// Pedido de Martín (15/10/2026): terminar los subtítulos de CapCut. Hasta ese día Whisper
// devolvía cada palabra con su tiempo y `armarSubtitulos` los tiraba; sin ellos no hay
// dividir donde cae la palabra, ni muletillas fuera del video, ni edición por
// transcripción. Acá se prueba la parte pura (subtitles/palabras.ts, transcription/caption.ts).
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codificarPalabras, leerCodificadas, palabrasDe, rehacerPalabras, dividirEnCursor, combinar, reemplazarEnTexto,
  tokens, MITAD_MINIMA_S, type PalabrasGuardadas,
} from '../app/video-editor/_opencut/subtitles/palabras';
import { armarSubtitulos, conMuletillas, palabrasDeLinea } from '../app/video-editor/_opencut/transcription/caption';

const palabra = (texto: string, inicio: number, fin: number) => ({ texto, inicio, fin });
/** «hola mundo cruel» de 10 a 11,5 s. */
const tres = () => [palabra('hola', 10, 10.4), palabra('mundo', 10.5, 11), palabra('cruel', 11.1, 11.5)];

test('1: armarSubtitulos deja las palabras pegadas a su subtítulo, una por palabra del texto', () => {
  const subs = armarSubtitulos({ palabras: [palabra(' Hola', 0, 0.3), palabra(' mundo.', 0.4, 0.8), palabra(' Adiós', 2, 2.4)], maxCaracteres: 40 });
  assert.equal(subs.length, 2);
  assert.deepEqual(subs[0].palabras?.map((p) => p.texto), ['Hola', 'mundo.']);
  assert.deepEqual(subs[1].palabras?.map((p) => p.texto), ['Adiós']);
  assert.deepEqual(tokens(subs[0].text), subs[0].palabras?.map((p) => p.texto));
});

test('2: una «palabra» de Whisper con un espacio adentro se parte, y las vacías no cuentan', () => {
  const ps = palabrasDeLinea([palabra(' o sea', 1, 2), palabra('  ', 2, 2.1), palabra('listo', 2.2, 2.5)]);
  assert.deepEqual(ps.map((p) => p.texto), ['o', 'sea', 'listo']);
  assert.ok(ps[1].inicio > ps[0].inicio && ps[1].fin <= 2);
});

test('3: guardar y leer devuelve lo mismo, relativo al origen del recorte', () => {
  const c = codificarPalabras({ palabras: tres(), origen: 10, precision: 'palabra' });
  const g = leerCodificadas(c);
  assert.equal(g?.precision, 'palabra');
  assert.deepEqual(g?.palabras.map((p) => [p.texto, p.inicio]), [['hola', 0], ['mundo', 0.5], ['cruel', 1.1]]);
  assert.equal(leerCodificadas('no es json'), null);
  assert.equal(leerCodificadas(JSON.stringify({ v: 2, p: 'palabra', w: [] })), null);
});

test('4: leídas en la línea de tiempo, siguen al subtítulo si se mueve', () => {
  const param = codificarPalabras({ palabras: tres(), origen: 10, precision: 'palabra' });
  const movido = palabrasDe({ contenido: 'hola mundo\ncruel', param, inicio: 20, recorteInicio: 0, duracion: 1.5 });
  assert.deepEqual(movido?.palabras.map((p) => p.inicio), [20, 20.5, 21.1]);
});

test('5: después de «Dividir» de la línea de tiempo, cada mitad ve sólo sus palabras, donde se dijeron', () => {
  const param = codificarPalabras({ palabras: tres(), origen: 10, precision: 'palabra' });
  // La mitad derecha de un corte en 10,45: empieza ahí y su recorte corre lo mismo (SplitElementsCommand).
  const der = palabrasDe({ contenido: 'hola mundo cruel', param, inicio: 10.45, recorteInicio: 0.45, duracion: 1.05 });
  assert.deepEqual(der?.palabras.map((p) => [p.texto, p.inicio]), [['mundo', 10.5], ['cruel', 11.1]]);
});

test('6: si el texto ya no dice lo que dicen las palabras, no valen (null, no tiempos de otro texto)', () => {
  const param = codificarPalabras({ palabras: tres(), origen: 10, precision: 'palabra' });
  assert.equal(palabrasDe({ contenido: 'otra cosa', param, inicio: 10, recorteInicio: 0, duracion: 1.5 }), null);
  assert.equal(palabrasDe({ contenido: 'hola mundo', param, inicio: 10, recorteInicio: 0, duracion: 1.5 }), null);
});

test('7: corregir una palabra conserva los tiempos; cambiar cuántas son, los pierde', () => {
  const g: PalabrasGuardadas = { precision: 'palabra', palabras: tres() };
  assert.deepEqual(rehacerPalabras(g, 'Hola mundo cruel.')?.palabras.map((p) => [p.texto, p.inicio]), [['Hola', 10], ['mundo', 10.5], ['cruel.', 11.1]]);
  assert.equal(rehacerPalabras(g, 'hola mundo muy cruel'), null);
});

test('8: dividir con palabras corta donde empieza la primera palabra de la derecha', () => {
  const r = dividirEnCursor({ texto: 'hola mundo cruel', cursor: 'hola mundo'.length, inicio: 10, fin: 11.5, palabras: { precision: 'palabra', palabras: tres() } });
  assert.ok(r);
  assert.deepEqual([r.izquierda.texto, r.izquierda.fin, r.derecha.texto, r.derecha.inicio], ['hola mundo', 11.1, 'cruel', 11.1]);
  assert.deepEqual(r.izquierda.palabras?.palabras.map((p) => p.texto), ['hola', 'mundo']);
  assert.deepEqual(r.derecha.palabras?.palabras.map((p) => p.texto), ['cruel']);
});

test('9: dividir en el medio de una palabra la parte, y el tiempo de la palabra se reparte por largo', () => {
  const r = dividirEnCursor({ texto: 'hola mundo', cursor: 'hola mu'.length, inicio: 10, fin: 11, palabras: { precision: 'palabra', palabras: tres().slice(0, 2) } });
  assert.ok(r);
  assert.deepEqual([r.izquierda.texto, r.derecha.texto], ['hola mu', 'ndo']);
  // «mundo» va de 10,5 a 11: «mu» se lleva 2/5.
  assert.equal(Math.round(r.izquierda.fin * 100) / 100, 10.7);
});

test('10: sin palabras, el tiempo se reparte por largo de texto; en un borde o muy corto, no se divide', () => {
  const r = dividirEnCursor({ texto: 'aaaa bbbb', cursor: 4, inicio: 0, fin: 2, palabras: null });
  assert.ok(r && Math.abs(r.izquierda.fin - 4 / 8 * 2) < 1e-9);
  assert.equal(dividirEnCursor({ texto: 'hola', cursor: 0, inicio: 0, fin: 1, palabras: null }), null);
  assert.equal(dividirEnCursor({ texto: 'hola', cursor: 4, inicio: 0, fin: 1, palabras: null }), null);
  assert.equal(dividirEnCursor({ texto: 'a bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', cursor: 1, inicio: 0, fin: 1, palabras: null }), null, `una mitad de menos de ${MITAD_MINIMA_S} s no se hace`);
});

test('11: combinar junta texto, tramo y palabras (sólo si las dos las tienen)', () => {
  const a = { texto: 'hola', inicio: 1, fin: 2, palabras: { precision: 'palabra' as const, palabras: [palabra('hola', 1, 1.5)] } };
  const b = { texto: 'mundo', inicio: 2.5, fin: 3, palabras: { precision: 'palabra' as const, palabras: [palabra('mundo', 2.5, 2.9)] } };
  const c = combinar(a, b);
  assert.deepEqual([c.texto, c.inicio, c.fin, c.palabras?.palabras.length], ['hola mundo', 1, 3, 2]);
  assert.equal(combinar(a, { ...b, palabras: null }).palabras, null);
});

test('12: las muletillas que se sacaron del texto quedan guardadas, marcadas, en su subtítulo', () => {
  const subs = armarSubtitulos({ palabras: [palabra('Hola', 0, 0.3), palabra('mundo.', 0.4, 0.8)], maxCaracteres: 40 });
  const con = conMuletillas(subs, [palabra('eh,', 0.32, 0.38)]);
  assert.deepEqual(con[0].palabras?.map((p) => [p.texto, !!(p as { muletilla?: boolean }).muletilla]), [['Hola', false], ['eh,', true], ['mundo.', false]]);
  // Y no rompen el cotejo contra el texto.
  const param = codificarPalabras({ palabras: con[0].palabras!, origen: 0, precision: 'palabra' });
  assert.ok(palabrasDe({ contenido: con[0].text, param, inicio: 0, recorteInicio: 0, duracion: 0.8 }));
});

test('13: reemplazar no distingue mayúsculas, cuenta las veces y no toma la búsqueda como regex', () => {
  assert.deepEqual(reemplazarEnTexto('Hola hola HOLA', 'hola', 'chau'), { texto: 'chau chau chau', veces: 3 });
  assert.deepEqual(reemplazarEnTexto('cuesta $10 (diez)', '$10 (diez)', 'diez pesos'), { texto: 'cuesta diez pesos', veces: 1 });
  assert.equal(reemplazarEnTexto('nada', '', 'x').veces, 0);
});

// Lo que no se puede importar en node (el armado del elemento y el panel cargan el wasm del
// motor): se fija leyendo el fuente.
import { readFileSync } from 'node:fs';
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('14: generar guarda las palabras en el subtítulo, con su precisión y sus muletillas', () => {
  const armado = sinComentarios(leer('app/video-editor/_opencut/subtitles/build-subtitle-text-element.ts'));
  assert.match(armado, /\[PARAM_PALABRAS\]: codificarPalabras\(\{ palabras: caption\.palabras, origen: caption\.startTime/);
  const generar = sinComentarios(leer('app/video-editor/_opencut/subtitles/generar.ts'));
  assert.match(generar, /conMuletillas\(\s*armarSubtitulos\(/);
  assert.match(generar, /precision: resultado\.precision/);
  assert.match(generar, /muletillas = sin\.sacadas/);
});

test('15: los atajos del panel son los de CapCut (Enter divide, Retroceso y Supr combinan)', () => {
  const src = sinComentarios(leer('app/video-editor/_opencut/subtitles/components/pestana-subtitulos.tsx'));
  assert.match(src, /e\.key === "Enter" && \(e\.ctrlKey \|\| e\.metaKey\)/, 'Ctrl+Enter es un salto de línea');
  assert.match(src, /if \(alPrincipio \|\| alFinal \|\| !sinSeleccion\) t\.blur\(\);\s*else dividir\(t\);/);
  assert.match(src, /e\.key === "Backspace" && alPrincipio\) \{\s*e\.preventDefault\(\);\s*combinarCon\(t, "arriba"\)/);
  assert.match(src, /e\.key === "Delete" && alFinal\) \{\s*e\.preventDefault\(\);\s*combinarCon\(t, "abajo"\)/);
  // Dividir o combinar usaron lo escrito: el blur que sigue no lo vuelve a escribir encima.
  assert.match(src, /if \(saltarConfirmar\.current\) \{\s*saltarConfirmar\.current = false;\s*return;/);
});

// Roturas (15/10/2026), cada una sola y restaurada desde memoria; base 13 de 13 (antes de 14 y 15):
// · armarSubtitulos tira las palabras                → 2 fallos (1, 12)
// · no se parte una «palabra» con un espacio         → 1 fallo (2)
// · el origen es el inicio y no el del recorte       → 1 fallo (5)
// · no se cotejan las palabras contra el texto       → 1 fallo (6)
// · rehacer ignora cuántas palabras son              → 1 fallo (7)
// · el corte cae al FIN de la palabra                → 1 fallo (8)
// · sin el mínimo de cada mitad                      → 1 fallo (10)
// · las muletillas no se guardan                     → 1 fallo (12)
// · la búsqueda se toma como regex                   → 1 fallo (13)
// Y con 14 y 15, base 15 de 15:
// · el elemento no guarda las palabras               → 1 fallo (14)
// · Retroceso al principio no combina                → 1 fallo (15)
// · el blur pisa lo que se acaba de dividir          → 1 fallo (15)
// Lo que NO cubre: que el panel divida y combine en pantalla. Eso se mira en el navegador.
