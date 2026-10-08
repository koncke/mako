// =============================================================================
// Una transcripción que es un BUCLE cuenta como fallo de esa cuenta, no como el texto del audio
// =============================================================================
// Medido el 08/10/2026: el tramo 0:00-7:00 de un audio de feedback del curso, por la cascada de
// siempre (`transcribirAudio`), volvió de Gemini con HTTP 200, `finishReason: STOP` y un minuto de
// habla seguido de «1 2 3 … 699». La cascada lo devolvía como la transcripción. Whisper (Groq)
// transcribió bien el mismo tramo. El detector vive en lib/stt-degenerado.ts y el corte, en
// `transcribirAudio` (lib/ai-cheap.ts).
//
// LOS UMBRALES SE MIDIERON CONTRA DATOS REALES, y los números van acá porque acá se re-miden:
//   · public/cono-tx, las 9.719 transcripciones enteras: cae UNA, y es un acierto (un archivo que
//     es 100% «Thank you. Thank you.» sobre un video sin voz). Falsos positivos: 0.
//   · Los mismos 392.939 párrafos sueltos, que tienen el largo de una nota de voz: caen 51. Leídos
//     uno por uno, 48 son bucles de verdad del decodificador («me ha tocado» ×19, «la posibilidad
//     de que» ×19, «no no no» ×57) y 3 no: una canción («La, la, la» ×36) y dos dudosos con ×8
//     justo en el borde (un estribillo en inglés y «me voy a bañar»). O sea 3 de 392.939.
//   · La corrida de enteros más larga del corpus es de 32, y ésa misma parece una alucinación; las
//     cuentas de verdad llegan a 20. El umbral es 50; el bucle medido tenía 699.
//   · Las tres partes del mismo tramo transcriptas por Whisper y las otras tres partes del audio
//     transcriptas bien por Gemini: pasan las seis.
// El barrido completo tarda entre 2 y 4 minutos y no corre en `npm test`: `STT_BARRIDO=1 node
// --import tsx --test tests/stt-degenerado.test.ts` lo repite y falla si una transcripción entera
// cae sin estar en la lista de aciertos clasificados a mano (corrido el 08/10/2026: verde).
//
// Probado rompiéndolo (08/10/2026), una rotura por vez, restaurando desde memoria y corriendo
// este archivo solo. Base: 10 pass / 0 fail (+1 barrido saltado). Cada rotura, pass / fail:
//   lib/stt-degenerado.ts
//     · umbral de conteo en 700 (el bucle medido no cae) ........................ 7 / 3
//     · umbral de conteo en 20 (las cuentas reales del corpus caen) .............. 8 / 2
//     · sin la fracción (un «Thank you» chico al final tira la transcripción) .... 8 / 2
//     · `veces` en 4 (los ejercicios de idiomas caen) ............................ 9 / 1
//     · el motivo con los números del conteo ..................................... 9 / 1
//     · sin limpiar la puntuación («1, 2, 3,» y «me ha tocado,» no se ven) ....... 8 / 2
//     · cualquier número creciente cuenta como consecutivo ....................... 9 / 1
//   lib/ai-cheap.ts (`transcribirAudio`)
//     · sin el corte en las keys del negocio ..................................... 9 / 1
//     · `break` en vez de `continue` (no prueba la otra cuenta) .................. 9 / 1
//     · el bucle de la red anotado en los errores del cliente .................... 9 / 1
//     · sin el corte en la red de plataforma ..................................... 9 / 1
//     · recortar lo de antes del bucle ........................................... 8 / 2
//     · mirar el bucle DESPUÉS de dar el audio por escuchado ..................... 9 / 1
// Restaurado: 10 / 0.
//
// Correr: node --import tsx --test tests/stt-degenerado.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { salidaDegenerada, medirDegeneracion, UMBRAL_DEGENERADO } from '../lib/stt-degenerado';
import { causaDelFallo, esSaturacion, esTopeDeTamano } from '../lib/fallo-ia-texto';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── La muestra medida, reconstruida EXACTA: el prefijo que Gemini transcribió bien + el conteo ──
const PREFIJO_GEMINI = 'Bueno, ahora vamos a ver feedback y preguntas del proceso de de cursos dentro de MaKo. Bueno, mi caso es, acá tengo el curso de Service Delivery Ops, que me encanta, porque si yo tuviese un infoproducto de Service Delivery Ops, o sea, sería ideal porque ya tengo el nombre y todo. Y no me gustaría cambiar esto, sino que me gustaría agregar otro curso de un cliente que yo tengo. No sé si yo tengo que tener o cuenta de agencia con ese cliente específico o eh cómo lo agrego esto? A ver, vos, si querés agregar un nuevo producto, tenés que irte hoy en día, eso es algo que tengo que poner ahí el botón, pero hoy en día tenés que irte al CRM y en el CRM ponés nuevo producto y cuando pones un nuevo producto ahí, ahí se crea también en cursos tus pues puedes seleccionar tu nuevo producto. Sin embargo, eh ';
const MUESTRA_GEMINI = PREFIJO_GEMINI + Array.from({ length: 699 }, (_, i) => i + 1).join(' ');
// El mismo tramo, de Whisper (Groq), hasta el mismo punto del habla.
const WHISPER_MISMO_TRAMO = 'Bueno, a ver, vamos a ver feedback y preguntas del proceso de cursos dentro de Maco. Bueno, mi caso es, acá tengo el curso de Service Delivery Ops, que me encanta, porque si yo tuviese un infoproducto de Service Delivery Ops, o sea, sería ideal porque ya tengo el nombre y todo. Y no me gustaría cambiar esto, sino que me gustaría agregar otro curso de un cliente que yo tengo. no sé si yo tengo que tener o cuenta de agencia con ese cliente específico o cómo lo agrego esto. A ver, vos si querés agregar un nuevo producto tenés que irte hoy en día, eso es algo que tengo que poner ahí el botón, pero hoy en día tenés que irte al CRM y en el CRM pones nuevo producto. Y cuando pones un nuevo producto ahí, ahí se crea también en cursos, podés seleccionar tu nuevo producto. Sin embargo, eso yo también lo voy a poner ahí en el mismo curso, que vos puedas agregar un nuevo producto.';

test('la muestra medida cae, y en el lugar donde empezó el bucle', () => {
  assert.equal(MUESTRA_GEMINI.length, 3492, 'la reconstrucción tiene que ser carácter por carácter la que devolvió Gemini');
  const v = salidaDegenerada(MUESTRA_GEMINI);
  assert.ok(v, 'un minuto de habla y 699 números pasaban como la transcripción del audio');
  assert.match(v.detalle, /699 números seguidos \(1…699\)/);
  assert.equal(v.desde, PREFIJO_GEMINI.length, 'el bucle empieza donde termina el habla');
  // Lo de antes del bucle, solo, es una transcripción normal.
  assert.equal(salidaDegenerada(PREFIJO_GEMINI), null);
});

test('el mismo tramo bien transcripto por Whisper pasa', () => {
  assert.equal(salidaDegenerada(WHISPER_MISMO_TRAMO), null);
  assert.equal(salidaDegenerada(''), null, 'el vacío no es un bucle: lo trata la cascada como «no había voz»');
});

test('el conteo: hasta 49 es habla, desde 50 es un bucle, con o sin puntuación', () => {
  assert.equal(UMBRAL_DEGENERADO.conteo, 50);
  const contar = (hasta: number, sep = ' ') => Array.from({ length: hasta }, (_, i) => i + 1).join(sep);
  // Las cuentas de verdad del corpus llegan a 20 («1, 2, 3, 4, 5. 6, 7, … 20. Relajamos»).
  assert.equal(salidaDegenerada(`Inhalamos y contamos ${contar(20, ', ')}. Relajamos.`), null);
  assert.equal(salidaDegenerada(`Aquí tenemos ${contar(49)} productos.`), null);
  assert.ok(salidaDegenerada(`Aquí tenemos ${contar(50)} productos.`));
  assert.ok(salidaDegenerada(`Bueno, ${contar(80, ', ')}.`), 'las comas no esconden el conteo');
  // No cualquier lista de números: tienen que ser CONSECUTIVOS.
  const pares = Array.from({ length: 80 }, (_, i) => 2 * i).join(' ');
  assert.equal(medirDegeneracion(pares).conteo.largo, 1);
  assert.equal(salidaDegenerada(pares), null);
});

test('la repetición: el bucle de Whisper cae; el ejercicio, la respuesta corta y el bucle chico al final de un texto largo, no', () => {
  const U = UMBRAL_DEGENERADO.repeticion;
  assert.deepEqual([U.veces, U.cubre, U.fraccion], [8, 30, 0.3]);
  // La alucinación clásica sobre silencio, sola: cae.
  assert.ok(salidaDegenerada('Gracias por ver el video. '.repeat(10).trim()));
  // Un ejercicio de pronunciación repite 4 o 5 veces (así están los cursos de idiomas): pasa.
  assert.equal(salidaDegenerada("I don't think I can. ".repeat(5).trim()), null);
  // Una respuesta de verdad: pasa.
  assert.equal(salidaDegenerada('Sí, sí, sí, sí, sí. Dale, mañana lo vemos.'), null);
  // ⚠️ A PROPÓSITO: un bucle chico al FINAL de un texto largo (el «Thank you» ×85 sobre el silencio
  // del cierre de una reunión) no tira la transcripción. Lo que había que transcribir está antes, y
  // tirarla deja al cliente sin nada si no hay otro proveedor. Ver UMBRAL_DEGENERADO.
  const largo = Array.from({ length: 1000 }, (_, i) => `palabra${i}`).join(' ');
  const conCola = `${largo} ${'Thank you. '.repeat(20).trim()}`;
  assert.ok(medirDegeneracion(conCola).repeticion.veces >= 20);
  assert.equal(salidaDegenerada(conCola), null);
});

test('el motivo que va a la lista de errores no se lee como cuota, saturación ni tamaño', () => {
  // La lista la clasifica `causaDelFallo` con regex. Un conteo «1…429» o «1…503» en el motivo se
  // leería como cuota agotada o proveedor saturado, y una frase en inglés que diga «quota» o
  // «insufficient», también. Por eso el motivo va sin números y sin la frase.
  const conteo = (hasta: number) => Array.from({ length: hasta }, (_, i) => i + 1).join(' ');
  const casos = [conteo(429), conteo(503), conteo(413), 'Your quota was exceeded, insufficient billing. '.repeat(12)];
  for (const texto of casos) {
    const v = salidaDegenerada(texto);
    assert.ok(v, `no cayó: ${texto.slice(0, 40)}`);
    assert.doesNotMatch(v.motivo, /\d/, 'un número en el motivo es una regex de causaDelFallo esperando');
    const error = `gemini · cuenta 2: ${v.motivo}`;
    assert.equal(esSaturacion(error), false);
    assert.equal(esTopeDeTamano(error), false);
    // Con una sola key: le falta un respaldo (otro proveedor lo habría escuchado). Con dos: no es suyo.
    assert.equal(causaDelFallo([error], 1), 'sin_respaldo');
    assert.equal(causaDelFallo([error], 2), 'proveedor_caido');
  }
});

// ── Casos del corpus con nombre: lo que tiene que pasar y lo que tiene que caer ──
const CORPUS = new URL('../public/cono-tx/', import.meta.url);
const doc = (f: string): string | null => {
  const u = new URL(f, CORPUS);
  return existsSync(u) ? (JSON.parse(readFileSync(u, 'utf8')) as string[]).join('\n') : null;
};
const parrafo = (f: string, i: number): string | null => {
  const u = new URL(f, CORPUS);
  return existsSync(u) ? (JSON.parse(readFileSync(u, 'utf8')) as string[])[i] ?? null : null;
};

const PASAN: Array<[string, string]> = [
  ['1L3Wyk_WA8tMALtH-E0-DAqA4K-W2ZkXG.json', 'una clase de respiración que cuenta del 1 al 20'],
  ['1s5iPsXLAptlij2YPOcGlRKRVz3y6AM5I.json', 'alguien que cuenta 16 productos en pantalla'],
  ['1RzDwAa8UgwyXFWhXSVic7Ec2gbfNsSvf.json', 'la corrida más larga del corpus (32), en el medio de una llamada de ventas'],
  ['18G24vpj13GrdlBuBHjzi4yJG-kUSyxYo.json', 'una canción con «Ai, ai, ai» ×60 adentro de una clase larga'],
  ['1CmqBf0i-7yNDEEOpEkIoRzNCXkPePn7w.json', 'un curso de inglés que repite la frase del ejercicio ×12'],
  ['1QY1hvWfoKvcjy_iFKShUCuwsVwQ5eH_H.json', 'un trabalenguas repetido ×5'],
  ['1XY6TE4AW9qR2R0pRXjLzfeFBlf6lTgev.json', '«Thank you» ×85 sobre el silencio del final (2% del texto): decisión, ver el test de arriba'],
];

test('corpus: las transcripciones reales con números o repeticiones legítimas pasan', (t) => {
  let leidos = 0;
  for (const [f, que] of PASAN) {
    const texto = doc(f);
    if (texto == null) { t.diagnostic(`no está ${f} (${que}): se saltea`); continue; }
    leidos++;
    const v = salidaDegenerada(texto);
    assert.equal(v, null, `cayó ${que}: ${v?.detalle}`);
  }
  // Un chequeo que no encuentra nada que revisar no puede decir que está todo bien.
  assert.ok(leidos >= PASAN.length - 2, `sólo se pudieron leer ${leidos} de ${PASAN.length}: el corpus se movió`);
});

test('corpus: los bucles de verdad caen, y la canción corta también (falso positivo ACEPTADO)', (t) => {
  const casos: Array<[string | null, string, boolean]> = [
    [doc('1X6de_rpO6cP9UbS7T2ghN1J9TGjMnspf.json'), 'un archivo que es 100% «Thank you» sobre un video sin voz', true],
    [parrafo('1-c8cfVjgQrb-qELAWGsuZJBhIst2n4if.json', 165), '«me ha tocado» ×19 (51% del párrafo)', true],
    [parrafo('11HBNZzo8lx_zAOo6rED3q8JVFCVOv_gF.json', 135), '«es que te vas» ×19 (82%)', true],
    [parrafo('1GWQu-hD8S_2kMFkj8GVsScHXV2BsgOla.json', 3), 'un ejercicio de inglés ×4 que es el párrafo entero', false],
    // ⚠️ El falso positivo que se acepta: una canción de «La, la, la» ×36 como nota de voz entera
    // cae. Para que no cayera habría que subir `veces` arriba de 36, y con eso se escapan la
    // mitad de los bucles medidos. Si alguien manda una nota cantando, prueba el proveedor que
    // sigue, y si todos coinciden, le llega «no lo pude escuchar».
    [parrafo('1jeYy6EyS1nkIpgllNwYvw3YUaDkAJpnF.json', 1), 'la canción «La, la, la» ×36', true],
  ];
  for (const [texto, que, cae] of casos) {
    if (texto == null) { t.diagnostic(`no está: ${que}`); continue; }
    assert.equal(!!salidaDegenerada(texto), cae, `${que}: ${cae ? 'tenía que caer' : 'tenía que pasar'}`);
  }
});

// ── El corte en `transcribirAudio` (lib/ai-cheap.ts es `server-only`: se mira el fuente) ──
const AI = sinComentarios(leer('../lib/ai-cheap.ts'));
const bloque = (firma: string) => {
  const ini = AI.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const resto = AI.slice(ini + firma.length);
  const fin = resto.search(/\n(export |async function |function |const |type |class )/);
  return AI.slice(ini, ini + firma.length + (fin < 0 ? resto.length : fin));
};

test('transcribirAudio: un bucle de las keys del negocio es un FALLO de esa cuenta, y se prueba la que sigue', () => {
  assert.match(AI, /import \{ salidaDegenerada \} from '@\/lib\/stt-degenerado';/);
  const t = bloque('export async function transcribirAudio(');
  const iEscucha = t.indexOf('const r = await escucharCon(p, base64, buf, mime, o, errores);');
  const iBucle = t.indexOf('salidaDegenerada(r.texto)');
  const iEscucho = t.indexOf('alguienEscuchó = true');
  const iDevuelve = t.indexOf('if (r.texto) return corregirMarca(r.texto)');
  assert.ok(iEscucha > 0 && iBucle > iEscucha, 'el resultado de cada cuenta no pasa por el detector');
  assert.ok(iEscucho > iBucle && iDevuelve > iBucle,
    'el bucle se mira DESPUÉS de dar por escuchado el audio: un bucle se devolvería, o cerraría la cascada como «no había voz»');
  assert.match(t, /if \(bucle\) \{\s*errores\.push\(`\$\{rotulo\(p\)\}: \$\{bucle\.motivo\}`\);(?:\s*console\.error\([^\n]*\);)?\s*continue;\s*\}/,
    'el bucle tiene que quedar en la lista de errores del negocio, con su motivo, y seguir con la cuenta que sigue');
});

test('transcribirAudio: la red de plataforma tiene el mismo corte, con sus errores aparte', () => {
  const t = bloque('export async function transcribirAudio(');
  assert.match(t, /const bucleRed = salidaDegenerada\(res\.texto\);\s*if \(bucleRed\) \{\s*erroresPlataforma\.push\(`\$\{rotulo\(p\)\}: \$\{bucleRed\.motivo\}`\);(?:\s*console\.error\([^\n]*\);)?\s*continue;\s*\}/,
    'un bucle de la red de la agencia se devolvería como la transcripción, o se anotaría como error del cliente');
  assert.ok(t.indexOf('salidaDegenerada(res.texto)') < t.indexOf('return res.texto ? corregirMarca(res.texto)'),
    'el corte de la red tiene que ir antes de devolver');
});

test('transcribirAudio: no recorta lo de antes del bucle', () => {
  // Decisión (08/10/2026): media transcripción se lee igual que una completa. En el caso medido lo
  // de antes era un minuto de siete. Si nadie más escucha, falla a la vista.
  assert.doesNotMatch(bloque('export async function transcribirAudio('), /\.desde\b/,
    'el corte se volvió un recorte: devolvería un pedazo del audio como si fuera el audio entero');
});

// ── El barrido completo, para recalibrar (no corre en `npm test`) ──
// Transcripciones enteras que caen y están clasificadas a mano como bucles de verdad.
const ACIERTOS_CLASIFICADOS = ['1X6de_rpO6cP9UbS7T2ghN1J9TGjMnspf.json'];

test('barrido de public/cono-tx: ninguna transcripción entera cae sin estar clasificada', { skip: !process.env.STT_BARRIDO }, (t) => {
  const dir = new URL('../public/cono-tx/', import.meta.url);
  const archivos = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(archivos.length > 5000, `hay ${archivos.length} transcripciones: el barrido no está mirando el corpus`);
  const caen: string[] = [];
  let parrafos = 0, parrafosQueCaen = 0, conteoMax = 0;
  for (const f of archivos) {
    const arr = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as string[];
    const texto = arr.join('\n');
    conteoMax = Math.max(conteoMax, medirDegeneracion(texto).conteo.largo);
    if (salidaDegenerada(texto)) caen.push(f);
    for (const p of arr) { parrafos++; if (salidaDegenerada(p)) parrafosQueCaen++; }
  }
  t.diagnostic(`${archivos.length} transcripciones · caen ${caen.length} · corrida de enteros más larga ${conteoMax} · párrafos ${parrafos}, caen ${parrafosQueCaen} (el 08/10/2026: 51, 48 bucles de verdad)`);
  assert.ok(conteoMax < UMBRAL_DEGENERADO.conteo, `una transcripción real cuenta hasta ${conteoMax}: el umbral perdió el aire`);
  const sinClasificar = caen.filter((f) => !ACIERTOS_CLASIFICADOS.includes(f));
  assert.deepEqual(sinClasificar, [], 'cayeron transcripciones enteras que nadie miró: leelas y, si son un bucle, sumalas a ACIERTOS_CLASIFICADOS');
});
