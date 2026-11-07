// «Editar» un carrusel de ejemplo, el ORQUESTADOR corriendo de verdad (lib/carruseles/replica-servidor.ts, `replicarEjemplo`).
//
// Por qué existe este archivo además de tests/carruseles-replica.test.ts: ese prueba las funciones PURAS (el prompt, leer lo
// que devuelve el modelo, armar el documento) y sus 21 pruebas estaban en VERDE el 6/11/2026 mientras «Editar» le fallaba a
// Martín en producción. El bug no estaba en ninguna de ellas: estaba en las decisiones del orquestador —a qué puerta de la IA
// le pide el texto cuando no hay láminas, cuánto lugar le pide para la respuesta, de dónde puede bajar la portada y si el
// camino de guías manda sus láminas a la pantalla—, y ninguna se ve sin ejecutarlo. El hijo
// (tests/_carruseles-editar-hijo.ts) lo corre entero con la base, el bucket y la RED de la IA de mentira: la cascada
// (lib/ai-cheap.ts) corre de verdad, así que lo que se mira es el pedido que le LLEGA al proveedor.
//
// Probado rompiéndolo (6/11/2026), base 10/0 — cada rotura, los rojos MEDIDOS:
//   · volver `chatCheapCascade` a `chatCheap` en el camino sin imágenes → 1 rojo;
//   · dejar `TOKENS_DE_SALIDA` en 512, como antes del arreglo → 4 rojos;
//   · sacar los CDN de `esImagenPermitida` (sólo nuestro bucket) → 1 rojo;
//   · bajar un CDN ajeno con `fetch` pelado en vez de `fetchSeguro` → 1 rojo;
//   · sacar `maxOutputTokens` del pedido de visión de Gemini (como estaba hasta hoy) → 1 rojo;
//   · que el camino de guías no mande sus láminas a la pantalla (sacar `mostrar(doc)`) → 2 rojos;
//   · que el modo seco devuelva sin armar el documento (como estaba hasta hoy) → 2 rojos;
//   · no sanear el `@` que escribió el modelo (`conElArrobaDelNegocio`) → 1 rojo;
//   · tratar un 429 de su cuenta como un bache y reintentar (`vuelveASinVer`) → 1 rojo;
//   · y un cambio SIN efecto (renombrar `avisar`) → 10 verdes, como tiene que ser.
// Y con la foto de una lámina con gente (6/11/2026, encargos 25, 120, 193 y 387; la lista completa, con la base de los tres
// archivos del área, está en tests/carruseles-foto-lamina.test.ts):
//   · no reservar el lugar de la foto que la IA de imagen está armando → 1 rojo acá (y 2 en el área);
//   · que el prompt no pregunte QUIÉN está en la foto → 1 rojo acá (y 3 en el área).
//
// ⚠️ Dos de esas roturas no daban NINGÚN rojo con la primera versión de este archivo, y las dos enseñan algo:
//   · `chatCheap` y `chatCheapCascade` salen por el MISMO endpoint, así que con una sola clave cargada el pedido se ve igual.
//     Lo que distingue a la cascada es que prueba SU CLAUDE primero — que es justo lo que el 6/11 no se hacía. Sin dos claves
//     en la base, el test daba verde con el bug puesto (caso `dosClaves`).
//   · sacarle el `usuario` a `leerReplica` no cambia nada cuando el negocio no tiene ningún @ cargado (hoy, ninguno): el saneo
//     saca igual todo @ ajeno. Lo que hay que romper para ver el agujero es el saneo mismo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** Por dónde salió el pedido: el endpoint de visión de Gemini, su `/chat/completions`, o su Claude (el primero de la cascada). */
type PedidoIA = { via: 'vision-nativa' | 'chat' | 'claude'; modelo: string; imagenes: number; tope: number | null };
type Salida = {
  ok: boolean; sinIA?: boolean; aviso?: string | null; conectar?: string | null; vistas?: number; errores?: string[];
  laminasMostradas: number; textos: string[]; pedidos: PedidoIA[]; red: string[]; paginas: number; permitida: boolean;
};

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_carruseles-editar-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Salida> & { error?: string };

/** Lo que un carrusel de 9 láminas con sus textos en JSON necesita para entrar: `chatCheap` daba 512 y cortaba la respuesta. */
const TOPE_MINIMO = 4_000;

test('la portada de NUESTRO bucket llega a la IA, y el tope de salida que se pidió LLEGA al proveedor', () => {
  assert.equal(R.error, undefined, String(R.error));
  const c = R.nuestra;
  assert.equal(c.ok, true);
  assert.equal(c.vistas, 1, 'la portada de nuestro bucket tenía que llegar a la IA');
  assert.deepEqual(c.pedidos.map((p) => p.via), ['vision-nativa'], 'con una lámina para mirar va por visión');
  assert.equal(c.pedidos[0].imagenes, 1, 'la imagen viaja en el pedido, no sólo en nuestras variables');
  assert.ok((c.pedidos[0].tope ?? 0) >= TOPE_MINIMO, `el pedido salió con maxOutputTokens=${c.pedidos[0].tope}`);
  assert.equal(c.sinIA, undefined, 'con la IA contestando no se cae a las guías');
  assert.equal(c.paginas, 9);
});

test('una portada que quedó en el CDN de Instagram está permitida, y NUNCA se baja con `fetch` pelado', () => {
  const c = R.cdn;
  assert.equal(c.ok, true);
  assert.equal(c.permitida, true, 'la portada de Instagram, Meta o YouTube se puede mirar (`esImagenPermitida`)');
  // El `fetch` de mentira le CONTESTARÍA la imagen: si hubiera salido por ahí, se vería entre las vistas y en la red.
  assert.ok(!c.red.some((h) => /cdninstagram|fbcdn/.test(h)), `un CDN ajeno sólo se baja con fetchSeguro: ${c.red.join(' ')}`);
  assert.equal(c.vistas, 0, 'en el test no hay DNS: lo que se prueba acá es por qué camino NO salió');
});

test('sin ninguna imagen que se pueda bajar, el texto va por la CASCADA del negocio y con lugar para el JSON entero', () => {
  const c = R.sinImagen;
  assert.equal(c.ok, true);
  assert.equal(c.permitida, false, 'un CDN que no es de las fuentes no se baja ni con fetchSeguro');
  assert.equal(c.vistas, 0);
  assert.deepEqual(c.pedidos.map((p) => p.via), ['chat'], 'el respaldo llama a la MISMA puerta que el principal');
  assert.ok((c.pedidos[0].tope ?? 0) >= TOPE_MINIMO, `el pedido salió con un tope de ${c.pedidos[0].tope} tokens`);
  assert.equal(c.sinIA, undefined, 'sin láminas igual sale el diseño de la IA, no las guías');
  assert.equal(c.paginas, 9, 'las 9 láminas que pedía el original');
});

test('el camino sin imágenes prueba SU CLAUDE primero: eso es la cascada, y `chatCheap` no lo hacía', () => {
  const c = R.dosClaves;
  assert.equal(c.ok, true);
  assert.equal(c.pedidos[0]?.via, 'claude', `el primer pedido salió por ${c.pedidos[0]?.via}`);
  assert.ok((c.pedidos[0].tope ?? 0) >= TOPE_MINIMO, `el pedido a su Claude salió con un tope de ${c.pedidos[0].tope}`);
  assert.equal(c.paginas, 9);
});

test('si la IA que MIRA se cae por un bache del proveedor, se prueba sin mirar antes de dejar guías', () => {
  const c = R.reintentaSinVer;
  assert.deepEqual([...new Set(c.pedidos.map((p) => p.via))], ['vision-nativa', 'chat'], 'primero mirando, después sin mirar');
  assert.ok(c.pedidos.filter((p) => p.via === 'chat').every((p) => (p.tope ?? 0) >= TOPE_MINIMO), 'el reintento también necesita lugar');
  assert.equal(c.sinIA, true, 'si tampoco sale sin mirar, quedan las guías');
  assert.ok(c.laminasMostradas > 0, 'y sus láminas igual se muestran');
});

test('con la cuota de SU cuenta agotada no se reintenta sin mirar, y el aviso dice de quién es', () => {
  const c = R.sinCuota;
  assert.ok(!c.pedidos.some((p) => p.via === 'chat'), 'otro pedido a la misma cuenta sin cuota no arregla nada');
  assert.equal(c.sinIA, true);
  assert.match(String(c.aviso), /Gemini/, 'el aviso nombra la IA que falló');
  assert.match(String(c.aviso), /cuota|crédito/);
  assert.ok(c.conectar, 'una clave sin cuota se arregla en Integraciones');
});

test('sin ninguna IA conectada: el diseño con guías igual se ARMA y se MUESTRA, nunca un modal en blanco', () => {
  const c = R.sinIA;
  assert.equal(c.ok, true);
  assert.equal(c.sinIA, true);
  assert.ok(c.laminasMostradas > 0, 'el camino de guías tiene que mandar sus láminas a la pantalla');
  assert.equal(c.paginas, c.laminasMostradas, 'se muestran TODAS las que tiene el diseño');
  assert.ok(c.textos.length > 0, 'cada lámina trae su guía escrita, no un cuadro vacío');
  assert.match(String(c.aviso), /Conecta tu/);
  assert.ok(c.conectar);
  // Sin foto del cliente no hay recuadro gris «Tu foto» (el pulido del 6/11/2026).
  assert.ok(!c.textos.some((t) => /tu foto/i.test(t)), `no va un recuadro de «Tu foto»: ${c.textos.join(' · ')}`);
});

test('el @ que inventa la IA no llega a la pantalla; el mail del negocio, intacto', () => {
  // La IA de mentira firma «Sonrisa Llena @sonrisallena · hola@sonrisallena.com» y el negocio no tiene ningún usuario cargado.
  const todos = [R.nuestra, R.cdn, R.sinImagen].flatMap((c) => c.textos);
  assert.ok(todos.length > 0, 'las láminas de la IA también se muestran mientras se arman');
  assert.ok(todos.some((t) => t.includes('Sonrisa Llena')), 'la firma lleva el NOMBRE del negocio');
  // El `@` suelto, no el del mail: si se busca `@sonrisallena` a secas, `hola@sonrisallena.com` lo contiene y el test da verde
  // con el bug puesto (medido escribiéndolo).
  const arrobaSuelta = (t: string) => /(^|[^\w.])@sonrisallena\b/.test(t);
  assert.ok(!todos.some(arrobaSuelta), `el @ inventado tiene que salir: «${todos.find(arrobaSuelta)}»`);
  assert.ok(todos.some((t) => t.includes('hola@sonrisallena.com')), 'un mail NO es un @ de Instagram: no se toca');
});

test('el ejemplo muestra a OTRA persona: esa foto se le pide a la IA de IMAGEN del negocio y su lugar queda reservado', () => {
  const c = R.personaAjena;
  assert.equal(c.ok, true);
  assert.equal(c.preguntaQuien, true, 'al prompt le llegó la pregunta de QUIÉN está en cada foto');
  assert.equal(c.aGenerar.length, 1, `se le pide una foto: ${JSON.stringify(c.aGenerar)}`);
  assert.equal(c.aGenerar[0].lamina, 1, 'la lámina que tenía la persona');
  assert.equal(c.aGenerar[0].quien, 'otra');
  assert.equal(c.aGenerar[0].conCara, false, 'no es el dueño: su cara no va de referencia');
  assert.match(c.aGenerar[0].escena, /sala de espera/, 'la escena es la que la IA de texto VIO');
  // Y el titular de esa lámina se queda en su columna: cuando la foto llegue, cae al lado y no encima.
  assert.ok(c.anchos[1] <= Math.round(0.45 * 1080), `la lámina 2 reservó el lugar de la foto: ancho ${c.anchos[1]}`);
  assert.ok(c.anchos[0] > 900, `la portada, sin foto, llena la lámina: ancho ${c.anchos[0]}`);
});

test('sin la IA de imagen del negocio no se le promete ninguna foto: el texto llena la lámina', () => {
  const c = R.personaAjenaSinFlow;
  assert.equal(c.ok, true);
  assert.deepEqual(c.aGenerar, [], 'sin su extensión no hay quién genere: no se reserva un lugar vacío');
  assert.ok(c.anchos[1] > 900, `el titular toma el ancho de la lámina: ${c.anchos[1]}`);
  // Sin su foto Y sin IA de imagen no hay nada que poner, así que el prompt directamente pide que no ponga fotos.
  assert.equal(c.preguntaQuien, false);
  // Y si el modelo igual contesta una foto (lo hace: este caso devuelve la misma respuesta con la persona), el documento la
  // IGNORA. Lo que no puede pasar nunca es que ahí aparezca un recuadro, ni la cara del dueño pegada encima.
  assert.ok(!c.textos.some((t) => /tu foto/i.test(t)), `sin foto no va un recuadro: ${c.textos.join(' · ')}`);
});
