// =============================================================================
// Cuando MaKo no puede pensar: de QUIÉN fue y qué se hace
// =============================================================================
// Pedido del dueño (25/8/2026): «Si la culpa es DEL CLIENTE, porque no cargó sus
// key, el mensaje tiene que reflejar eso. No un "He fallado en la transcripción"…
// Ahí MaKo queda mal, queda como el culpable. Tiene que decir "Te quedaste sin
// Tokens, cargá tus otras key aquí" y enviar el link.»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { causaDelFallo, textoFalloIA, linkKeysIA } from '../lib/fallo-ia-texto';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const LINK = linkKeysIA('https://hola-mako.com');

test('Sin ninguna key cargada, la causa es esa y no otra', () => {
  assert.equal(causaDelFallo(['Sin proveedor de IA barata (falta GROQ_API_KEY u OPENAI_API_KEY).'], 0), 'sin_keys');
  // Y manda incluso si además hubo otros errores: sin keys no hay nada que discutir.
  assert.equal(causaDelFallo(['HTTP 503 high demand'], 0), 'sin_keys');
});

test('Un 429 es CUOTA del cliente, y el mensaje lo dice con el link', () => {
  for (const e of ['chatCheapTools(gemini): HTTP 429', 'RESOURCE_EXHAUSTED', 'rate limit exceeded', 'quota']) {
    assert.equal(causaDelFallo([e], 2), 'sin_cuota', e);
  }
  const t = textoFalloIA('sin_cuota', LINK);
  assert.match(t, /sin cuota/i, 'dejó de decir que se quedó sin cuota');
  assert.ok(t.includes(LINK), 'no manda el link para cargar otra key');
  assert.ok(!/se me cayó|no pude armar el borrador/i.test(t),
    'volvió a echarse la culpa MaKo de la cuota del cliente');
});

test('El 429 se busca con borde de palabra, no adentro de cualquier número', () => {
  // Sin el borde, un id o un timestamp con «429» adentro clasificaría un bache de
  // red como cuota agotada y mandaría al cliente a cargar una key que no necesita.
  assert.equal(causaDelFallo(['fetch failed en request 1042999'], 2), 'proveedor_caido');
  assert.equal(causaDelFallo(['HTTP 429'], 2), 'sin_cuota');
});

test('Una sola key es «no tenés respaldo», no «se cayó el proveedor»', () => {
  // El hecho técnico es el mismo —el proveedor tuvo un bache— y lo que el cliente
  // puede hacer NO. Es el caso exacto del ws13: una key, un bache, sin MaKo.
  assert.equal(causaDelFallo(['HTTP 503 high demand'], 1), 'sin_respaldo');
  const t = textoFalloIA('sin_respaldo', LINK);
  assert.match(t, /una sola/i, 'no explica que el problema es tener una sola key');
  assert.ok(t.includes(LINK));
});

test('Con varias keys en orden, NO se culpa al cliente', () => {
  // La contracara, y es igual de importante: mandarlo a revisar algo que está bien
  // es el mismo error con el signo cambiado.
  assert.equal(causaDelFallo(['HTTP 503', 'fetch failed'], 5), 'proveedor_caido');
  const t = textoFalloIA('proveedor_caido', LINK);
  assert.match(t, /no es nada tuyo/i, 'dejó de aclarar que el fallo no es del cliente');
  assert.ok(!t.includes(LINK), 'manda a cargar keys a quien ya las tiene bien');
});

test('El link abre la pantalla donde se cargan las keys', () => {
  assert.equal(LINK, 'https://hola-mako.com/integraciones?abrir=gemini');
  // `?abrir=` es el deep-link real del board (app/integraciones/IntegracionesBoard.tsx).
  assert.ok(leer('../app/integraciones/IntegracionesBoard.tsx').includes("searchParams.get('abrir')"),
    'se perdió el deep-link ?abrir=: el link del mensaje cae en la pantalla sin abrir nada');
});

test('El audio ya no dice «se me cayó la transcripción» y a otra cosa', () => {
  const doer = leer('../lib/mako-doer-in.ts');
  // Sin comentarios: el comentario de al lado CITA la frase vieja para explicar por
  // qué se fue, así que buscarla sobre el texto crudo se dispara contra su propia
  // explicación. (Es el mismo tropiezo que ya tuvo el test de la alerta crítica.)
  const codigo = doer.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/se me cayó la transcripción/.test(codigo),
    'volvió el mensaje donde MaKo se come la culpa de la cuota del cliente');
  assert.ok(/causaDelFallo\(\[detalle\]/.test(codigo),
    'el fallo del audio dejó de clasificarse: vuelve a ser un mensaje genérico');
});

test('La causa se decide con TODOS los errores, no con el último', () => {
  // El último suele ser «falta OPENAI_API_KEY» —el quinto casillero vacío— cuando
  // lo que de verdad pasó fue el 429 del primero. Contar solo el último manda al
  // cliente a cargar la key equivocada.
  assert.equal(
    causaDelFallo(['chatCheapTools(gemini): HTTP 429', 'Sin proveedor de IA barata (falta OPENAI_API_KEY).'], 1),
    'sin_cuota',
  );
  assert.match(leer('../lib/mako-doer-in.ts'), /const erroresIA: string\[\] = \[\];/,
    'el doer volvió a quedarse solo con el último error');
});

test('⚠️ el mensaje de cuota no AFIRMA cuál límite fue ni cuándo se repone', () => {
  // Medido el 27/09/2026: el 22 y el 24/09 este texto le salió a un cliente diciendo
  // «Probé tus 2 cuentas de IA y las 2 llegaron al tope de hoy» en días en que su
  // workspace tiene CERO llamadas registradas, contra un tope de 250 por día. La causa se
  // elige con una regex sobre el TEXTO del error y nunca le pregunta a la cuota.
  //
  // Las dos afirmaciones eran inventadas: Gemini tiene tope por MINUTO y por día, y sólo
  // sabemos que contestó un error de límite. «Se reponen solas mañana» por un 429 de RPM
  // deja al cliente sin MaKo un día entero por algo que se destraba en un rato.
  //
  // ⚠️ Y NO se arregla mirando NUESTRO contador para concluir «entonces no es cuota»: las
  // keys son del cliente y puede gastarlas fuera de MaKo, así que nuestro cero no prueba
  // que le quede. Lo que se arregla es dejar de afirmar.
  for (const n of [1, 2, 3]) {
    const t = textoFalloIA('sin_cuota', LINK, undefined, n);
    assert.ok(
      !/tope de hoy|mañana/i.test(t),
      `con ${n} key(s) el texto vuelve a afirmar el tope del día o que se repone mañana: ${t}`,
    );
    assert.ok(t.includes(LINK), 'se perdió el link para cargar otra cuenta');
  }
  // Y sigue diciendo que puede ser el del minuto, que es la salida barata que existe.
  assert.match(textoFalloIA('sin_cuota', LINK, undefined, 2), /minuto/i,
    'el texto tiene que ofrecer reintentar: el límite por minuto se destraba solo');
});

test('⚠️ el doer prueba TODAS las cuentas del cliente, no sólo la primera', () => {
  // EL TERCER BUG de esta zona (los otros dos están arreglados y verificados aparte).
  // El doer de WhatsApp tenía su propio loop de PROVEEDORES y llamaba a chatCheapTools
  // sin `clave`, así que resolvía siempre la key base: un cliente con dos cuentas de
  // Gemini tenía la segunda muerta para el WhatsApp.
  //
  // Medido en `anthropic_usage` del ws13: feature='mako-doer-in' tiene 24 llamadas con la
  // cuenta 1 y CERO con la cuenta 2 en toda la historia — mientras esa misma key
  // funcionaba perfecto por otro camino (8 llamadas OK en 'campaign-suggest', que sí pasa
  // por la cascada). El cliente leía «te quedaste sin cuota» con una cuenta sin tocar, y
  // encima lo leía seguido, porque el peaje del 429 lo pagaba siempre la misma.
  //
  // Probado rompiéndolo (el archivo entero: con todo puesto, 10 pasan y 0 fallan):
  //   · la llamada del doer pierde `clave: inst.clave`  -> 9 / 1
  //   · el loop vuelve a recorrer sólo proveedores       -> 9 / 1
  //   · y el del mensaje, vuelve «tope de hoy / mañana»  -> 9 / 1
  const doer = leer('../lib/mako-doer-in.ts');
  assert.match(doer, /await provsDe\(prov\)/,
    'el loop del doer volvió a recorrer proveedores en vez de CUENTAS');
  assert.match(doer, /clave: inst\.clave/,
    'la llamada del doer no pasa la clave de esa cuenta: resuelve siempre la key base');
  // Y el motivo tiene que decir CUÁL cuenta fue, o la próxima medición no puede
  // distinguirlas: es lo que hizo visible este bug.
  assert.match(doer, /motivo: `\$\{rotulo\(inst\)\}/,
    'el motivo tiene que llevar el rótulo de la cuenta');
});
