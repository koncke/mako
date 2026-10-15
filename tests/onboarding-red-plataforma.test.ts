// =============================================================================
// La cuota de un proveedor no puede frenar el arranque: el onboarding tiene red
// =============================================================================
// Tarea #734. Pedido del dueño con un cliente trabado en vivo (16/08/2026): «no
// puede ser que se exceda la quota durante el onboarding, y en dicho caso debería
// ahí mismo saltar la opción de dejarle otra key».
//
// Son DOS cosas distintas y las dos estaban a medias:
//
//   1. LA RED. AGENTS.md lo dice desde el 07/10: «todo camino de IA que use un
//      cliente necesita su red de plataforma». La tenía `transcribirAudio` y NO
//      la tenía ninguno de los caminos del arranque — medido el 10/10:
//      `provsGratisDePlataforma()` tenía tres llamadores y ninguno era del
//      onboarding. Un cliente con UNA sola key no tiene cascada, así que su
//      arranque se cae con cualquier bache de su proveedor.
//   2. LA SALIDA. El paso de Productos pintaba el error sin el botón para cargar
//      otra key, teniendo la pieza `ErrorIA` escrita desde agosto.
//
// Correr: npx tsx --test tests/onboarding-red-plataforma.test.ts
//
// PROBADO ROMPIÉNDOLO el 15/10/2026, cada rotura restaurada DE MEMORIA (nunca
// `git checkout`, que en este clon borra trabajo ajeno). Base: 8 pasan, 0 fallan.
//   - sacar `redDePlataforma` del panorama del Archivero (1 de los 4) → 7/1
//   - sacarlo de la imagen del Archivero (visión, 1 de los 2 de la ruta) → 7/1
//   - sacarlo de la cara de marca (lib/persona.ts) → 7/1
//   - que los errores de la red caigan en `erroresOut` del cliente → 7/1
//   - borrar la guarda «el super admin no se reintenta» en la cascada → 7/1
//   - sacar el <ErrorIA> de ProductosView (vuelve el error crudo) → 7/1
//   - que chatCheap deje de pasar wsKey → daba 8/0: NO la cazaba, porque la misma
//     línea vive en chatCheapTools y el assert leía el archivo entero. Ahora mira
//     el cuerpo de chatCheap, y la misma rotura da 7/1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\*.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const AI = leer('lib/ai-cheap.ts');

/**
 * El cuerpo de una función exportada, hasta la PRÓXIMA declaración de nivel cero.
 *
 * ⚠️ No alcanza con cortar en el próximo `export`: las funciones privadas de abajo
 * (leerConGemini, leerConOpenAI) no lo son, así que el recorte se llevaba sus
 * DEFINICIONES y el conteo de llamadas daba 2 donde hay 1. Medido el 13/10/2026.
 */
function bloque(src: string, nombre: string): string {
  const ini = src.indexOf(`export async function ${nombre}`);
  assert.ok(ini > 0, `no existe ${nombre}`);
  const cortes = ['\nexport ', '\nasync function ', '\nfunction ', '\nconst ', '\ntype ']
    .map((c) => src.indexOf(c, ini + 10))
    .filter((i) => i > 0);
  const fin = cortes.length ? Math.min(...cortes) : src.length;
  const b = src.slice(ini, fin);
  // El tope es contra un recorte desbocado, no una medida fina. Medido el
  // 13/10/2026: chatCheapCascade son 13.384 caracteres y leerDocumentoIA 4.213.
  // Con el tope en 9.000 —el número que se me ocurrió primero— este test salía
  // ROJO sobre un recorte correcto, y en un clon compartido eso es un test rojo
  // para todas las sesiones.
  assert.ok(b.length < 20_000, `el recorte de ${nombre} salió enorme: está mirando otra cosa`);
  return b;
}

test('los caminos del ARRANQUE piden la red de plataforma', () => {
  // Los cuatro del Archivero (brief, campos, panorama, huecos), el catálogo de
  // productos, los avatares y la cara de marca. Si un camino nuevo del arranque
  // no la pide, un cliente con una sola key se queda sin arranque.
  for (const f of ['lib/onboarding.ts', 'lib/productos-ia.ts', 'lib/avatares.ts', 'lib/persona.ts']) {
    assert.match(leer(f), /redDePlataforma: true/, `${f} no tiene red: un bache del proveedor del cliente lo deja sin arranque`);
  }
  // El Archivero lee los documentos por VISIÓN, que es el camino que falló de
  // verdad (la cara de marca son fotos y el free tier de visión son 20 requests).
  const ruta = leer('app/api/onboarding/archivero/route.ts');
  assert.equal((ruta.match(/redDePlataforma: true/g) || []).length, 2, 'el PDF y la imagen van los dos con red');
  // Los cuatro del Archivero, uno por uno.
  assert.equal((leer('lib/onboarding.ts').match(/redDePlataforma: true/g) || []).length, 4);
});

test('la red corre DESPUÉS de las keys del cliente, nunca antes', () => {
  const casc = sinComentarios(bloque(AI, 'chatCheapCascade'));
  const iCliente = casc.indexOf('const instancias = await provsDe(prov);');
  const iRed = casc.indexOf('if (opts.redDePlataforma) {');
  assert.ok(iCliente > 0, 'no encuentro el recorrido de las keys del cliente');
  assert.ok(iRed > 0, 'la cascada no tiene red de plataforma');
  assert.ok(iCliente < iRed, 'la red quedó ANTES de las keys del cliente: le gastaría la cuota de la agencia a todos');
});

test('la red usa la key de la PLATAFORMA, no la del cliente', () => {
  const casc = sinComentarios(bloque(AI, 'chatCheapCascade'));
  // Sin `wsKey`, `credWs` lee la fila del workspace en curso: la red reintentaría
  // con la MISMA key que acaba de fallar y no sería una red de nada.
  assert.match(casc, /wsKey: wsSA/, 'la red no pide la key del super admin');
  // Y chatCheap tiene que poder recibirlo. Se mira su CUERPO y no el archivo: la misma
  // línea existe también en chatCheapTools, así que leyendo el archivo entero la rotura
  // «chatCheap deja de pasar wsKey» daba 8 de 8 en verde (medido el 15/10/2026).
  assert.match(sinComentarios(bloque(AI, 'chatCheap(')), /const p = await proveedor\(opts\.provider, opts\.clave, opts\.wsKey\);/,
    'chatCheap no le pasa wsKey al proveedor: la red reintentaría con la key del cliente');
  assert.match(AI, /export async function chatCheap\(opts: \{[^}]*wsKey\?: number/);
});

test('el super admin no se reintenta a sí mismo', () => {
  for (const nombre of ['chatCheapCascade', 'leerDocumentoIA']) {
    const b = sinComentarios(bloque(AI, nombre));
    assert.match(b, /wsSA != null && wsActual !== wsSA/, `${nombre}: repetir las keys del dueño es gastar en lo que ya falló`);
  }
});

test('los errores de NUESTRAS keys no se mezclan con los del cliente', () => {
  // Es el bug del 01/10: tres keys de mistral DE LA AGENCIA con 429 le fabricaron
  // a un cliente un «te quedaste sin cuota» con la suya contestando HTTP 200.
  const casc = sinComentarios(bloque(AI, 'chatCheapCascade'));
  const iRed = casc.indexOf('if (opts.redDePlataforma) {');
  const red = casc.slice(iRed);
  assert.match(red, /erroresPlataformaOut\?\.push/, 'la red no tiene su propia lista de errores');
  assert.doesNotMatch(red, /erroresOut\?\.push/, 'los errores de la red caen en la lista con la que se le habla al cliente');

  const vis = sinComentarios(bloque(AI, 'leerDocumentoIA'));
  const iRedV = vis.indexOf('if (opts.redDePlataforma) {');
  assert.ok(iRedV > 0, 'visión no tiene red');
  assert.doesNotMatch(vis.slice(iRedV), /errores\.push/, 'visión mezcla los errores de la agencia con los del cliente');
});

test('la red deja RASTRO: el motivo dice que fue la plataforma', () => {
  // Sin esto, un respaldo que se vuelve permanente es indistinguible de uno que
  // nunca se usó — y el cliente que tiene que cargar su key no se entera nunca.
  assert.equal((AI.match(/⚠ red de plataforma/g) || []).length >= 3, true);
  const casc = bloque(AI, 'chatCheapCascade');
  assert.match(casc, /RED DE PLATAFORMA/, 'no queda nada en el log cuando la red salva un pedido');
  assert.match(casc, /red de plataforma \$\{r\.provider\}\/\$\{r\.clave\} falló/, 'un fallo de la red no se ve si el caller no pidió la lista');
});

test('visión prueba el MISMO intento con las dos clases de key', () => {
  const vis = sinComentarios(bloque(AI, 'leerDocumentoIA'));
  // Una sola copia del intento: con dos, el arreglo de la rotación de modelo que
  // costó un cliente trabado se aplica en una y la otra se queda vieja.
  assert.equal((vis.match(/leerConGemini\(/g) || []).length, 1, 'hay dos copias del intento de visión');
  assert.match(vis, /const probarCon = async/);
  // Y la red sólo prueba los que MIRAN: trae gemini y groq, y groq no tiene visión.
  assert.match(vis, /VISION_CASCADE\.includes\(x\.provider\)/);
});

test('cuando la IA falla en Productos, la salida está en la misma pantalla', () => {
  const src = leer('app/onboarding/ProductosView.tsx');
  assert.match(src, /from '\.\.\/_components\/ErrorIA'/, 'el paso de Productos volvió a pintar el error sin salida');
  assert.match(src, /<ErrorIA[\s\S]{0,120}error=\{err\}/);
  // Y después de conectar, se puede reintentar sin salir del paso.
  assert.match(src, /onConectada=\{\(\) => \{ setErr\(null\); void cargar\(\); \}\}/);
});
