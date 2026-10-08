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
import { causaDelFallo, textoFalloIA, linkKeysIA, esTopeDeTamano } from '../lib/fallo-ia-texto';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const LINK = linkKeysIA('https://hola-mako.com');
/** Sin comentarios: un guard que busca lo que NO tiene que estar se acusa solo. */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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
  assert.equal(causaDelFallo(['HTTP 500 internal'], 1), 'sin_respaldo');
  // ⚠️ SALVO QUE EL PROVEEDOR ESTÉ SATURADO (07/10/2026). Este mismo test fijaba que «HTTP
  // 503 high demand» con una key era `sin_respaldo`, o sea «carga una segunda (son gratis)».
  // Es Google sin capacidad para ese modelo: otra key de Gemini le pega al mismo Google. Se lo
  // mandó a un cliente esa noche, sobre una nota de voz perdida.
  assert.equal(causaDelFallo(['gemini/gemini-flash-latest: HTTP 503: This model is currently experiencing high demand.'], 1), 'proveedor_caido');
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
  // Desde el 07/10/2026 se clasifica con los errores de SUS keys: el audio tiene red de
  // plataforma, y el error trae también los de la agencia (`SttSinEscucha`).
  assert.ok(/causaDelFallo\(delNegocio, nKeysAudio\)/.test(codigo),
    'el fallo del audio dejó de clasificarse: vuelve a ser un mensaje genérico');
  assert.ok(/const delNegocio = e instanceof SttSinEscucha \? e\.errores : \[detalle\];/.test(codigo),
    'el texto del audio volvió a elegirse con los errores de las keys de la AGENCIA');
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

// ─────────────────────────────────────────────────────────────────────────────
// El 413: «no me entra» no es «no te queda cuota»
// ─────────────────────────────────────────────────────────────────────────────
// PROBADOS ROMPIÉNDOLOS (con todo puesto: 14 pasan, 0 fallan):
//   · el 413 vuelve a entrar a la bolsa de la cuota        -> 12 / 2
//   · el mensaje vuelve a contar las cuentas del cliente   -> 13 / 1

/** El 413 de Groq, textual (la URL de su documentación incluida: es la trampa). */
const G413 = 'chatCheapTools(groq): Request too large for model `openai/gpt-oss-20b` in '
  + 'organization org_01 service tier `on_demand` on tokens per minute (TPM): Limit 8000, '
  + 'Requested 12437, please reduce your message size and try again. Visit '
  + 'https://console.groq.com/docs/rate-limits for more information.';

test('⚠️ EL 413 DE GROQ NO ES CUOTA AGOTADA, y la regex vieja decía que sí', () => {
  // La trampa está en la URL: el mensaje trae `rate-limits` en el link a la
  // documentación, así que la regex de cuota matchea sobre un error que no tiene nada
  // que ver con la cuota. Esto es la PRUEBA de que la exclusión hace falta — si algún
  // día la regex de cuota deja de matchear acá, este assert lo cuenta.
  assert.match(G413, /rate.?limit/i, 'la regex de cuota ya no matchearía: revisar el filtro');
  assert.ok(esTopeDeTamano(G413), 'dejó de reconocerse como un tope de tamaño');
  // Y el veredicto: NUESTRO tope de entrada, no la cuota del cliente.
  assert.equal(causaDelFallo([G413], 4), 'mensaje_muy_largo');
  assert.equal(causaDelFallo([G413], 1), 'mensaje_muy_largo');
});

test('⚠️ Pero un 429 DE VERDAD al lado sigue ganando: se saca el 413, no la lista', () => {
  // El filtro saca de la bolsa los errores de tamaño y juzga con lo que queda. Si se
  // descartara la lista entera, un 429 real quedaría tapado por un 413 de otro
  // proveedor — que es el mismo bug con el signo cambiado.
  assert.equal(causaDelFallo([G413, 'chatCheapTools(gemini · cuenta 2): HTTP 429'], 4), 'sin_cuota');
  assert.equal(causaDelFallo([G413, 'HTTP 503 high demand'], 4), 'proveedor_caido');
  assert.equal(causaDelFallo([G413], 0), 'sin_keys', 'sin ninguna key cargada, eso manda');
});

test('⚠️ Y el texto del 413 NO lleva link ni manda a reintentar', () => {
  // Cargar otra key no cambia el tope de entrada y el mismo texto va a rebotar igual:
  // es la única de las cinco causas donde «reintenta en un rato» es mentira. Lo único
  // que lo destraba lo puede hacer la persona, así que es lo único que se dice.
  const t = textoFalloIA('mensaje_muy_largo', LINK, 'armar el borrador');
  assert.ok(!t.includes(LINK), `manda a cargar una key que no hace falta: ${t}`);
  assert.ok(!/reintenta|vuelve a intentar/i.test(t), `manda a repetir algo que va a fallar igual: ${t}`);
  assert.match(t, /partes/i, 'no dice lo único que se puede hacer');
  assert.match(t, /armar el borrador/, 'perdió qué era lo que estaba haciendo');
  assert.match(t, /tus keys están bien/i, 'no aclara que no es del cliente');
});

test('⚠️ EL MENSAJE DE CUOTA NO AFIRMA CUÁNTAS CUENTAS PROBÓ', () => {
  // Decía «Probé tus 4 cuentas de IA y las 4 me rebotaron por límite» con un número
  // que sale de CONTAR FILAS en `credenciales` (`contarKeysIA` mira gemini, groq,
  // cerebras, mistral y openrouter), no de intentos. El 30/09/2026 el dueño lo leyó y
  // preguntó «¿realmente se acabó de 4 cuentas con un par de mensajes?» — y tenía
  // razón en dudar: en ese turno la cascada del doer llega a DOS de esos cinco, y el
  // que contestó devolvió OCHO veces HTTP 200.
  //
  // `keysDelCliente` sigue eligiendo la RAMA (con dos o más, pedirle «cargá otra» es
  // un insulto: ya lo hizo) y deja de salir escrito. Son dos preguntas distintas.
  for (const n of [2, 3, 4, 7]) {
    const t = textoFalloIA('sin_cuota', LINK, 'contestar', n);
    assert.ok(!new RegExp(`\\b${n}\\b`).test(t), `vuelve a afirmar que probó ${n} cuentas: ${t}`);
    assert.ok(!/probé tus/i.test(t), `vuelve a contar las cuentas del cliente: ${t}`);
    // Y no se pierde nada de lo que el mensaje ya tenía que decir.
    assert.ok(t.includes(LINK), 'se perdió el link');
    assert.match(t, /minuto/i, 'se perdió la salida barata: el límite por minuto se destraba solo');
  }
  // Con UNA sola key el texto es otro —ahí «cargá otra» es el consejo correcto— y ésa
  // no cuenta nada, así que no se toca.
  assert.match(textoFalloIA('sin_cuota', LINK, 'contestar', 1), /sin cuota de IA/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// El veredicto se decide con las keys DEL CLIENTE, no con las nuestras
// ─────────────────────────────────────────────────────────────────────────────
// PROBADOS ROMPIÉNDOLOS (con todo puesto: 19 pasan, 0 fallan):
//   · el doer vuelve a meter la plataforma en la misma bolsa  -> 18 / 1
//   · el veredicto vuelve a decidirse sólo con el texto       -> 18 / 1
//   · se saca el caso de cero instancias probadas             -> 18 / 1
//   · el cartel vuelve a no dejar rastro                      -> 18 / 1

test('⚠️ UN 200 DEL CLIENTE MANDA SOBRE CUALQUIER TEXTO DE ERROR', () => {
  // Es la prueba más fuerte que hay de que del otro lado estaba todo bien. Medido el
  // 01/10/2026 en el ws13: su Gemini contestó HTTP 200 y el cliente leyó «te quedaste
  // sin cuota de IA» — un cartel que lo manda a cargar una key que no le hace falta.
  const errs = ['gemini: contestó pero sin texto final (pasos=1, fin=vacio:tool_calls)'];
  assert.equal(causaDelFallo(errs, 1, { probadas: 1, contestaron: 1 }), 'fallo_nuestro');
  // Y manda incluso si al lado hay un 429 de verdad de otra cuenta SUYA.
  assert.equal(causaDelFallo([...errs, 'HTTP 429'], 3, { probadas: 3, contestaron: 1 }), 'fallo_nuestro');
});

test('⚠️ Y SU TEXTO NO LLEVA LINK NI CULPA: no hay nada que el cliente pueda hacer', () => {
  const tx = textoFalloIA('fallo_nuestro', LINK, 'contestar');
  assert.ok(!tx.includes(LINK), `manda a tocar sus keys por un problema nuestro: ${tx}`);
  assert.ok(!/cuota|l[ií]mite|cargá|carga otra/i.test(tx), `sigue hablando de su cuota: ${tx}`);
  assert.match(tx, /fue m[ií]o|no es nada tuyo/i, 'no dice de quién fue');
});

test('⚠️ CERO INSTANCIAS PROBADAS NO ES «SE CAYÓ TU PROVEEDOR»', () => {
  // Pasa cuando hay filas en `credenciales` pero ninguna resuelve. El veredicto caía en
  // `sin_respaldo`, que afirma una caída que nadie vio.
  assert.equal(causaDelFallo([], 2, { probadas: 0 }), 'sin_keys');
  // Y con instancias probadas de verdad, la clasificación de siempre no se mueve.
  // (Un 500 y no un 503: desde el 07/10/2026 el 503 es «saturado», que tiene su propia rama.)
  assert.equal(causaDelFallo(['HTTP 500'], 1, { probadas: 1, contestaron: 0 }), 'sin_respaldo');
  assert.equal(causaDelFallo(['HTTP 429'], 3, { probadas: 3, contestaron: 0 }), 'sin_cuota');
});

test('⚠️ EL DOER SEPARA LAS DOS LISTAS EN EL ORIGEN, no por un prefijo en el texto', () => {
  // Medido el 01/10/2026: de las OCHO entradas de ese turno, SIETE eran de la red de
  // plataforma —keys de la AGENCIA— y los tres únicos 429 también, todos de mistral. O
  // sea que el «te quedaste sin cuota» que leyó un cliente lo fabricaron nuestras
  // propias keys. Se separan en el origen porque una convención adentro de una cadena
  // libre es justo lo que esta casa ya pagó dos veces.
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /const erroresPlataforma: string\[\] = \[\];/,
    'volvió a haber una sola bolsa de errores');
  // Ninguna línea de la red de plataforma puede empujar a la lista del cliente.
  const red = doer.slice(doer.indexOf('provsGratisDePlataforma()'));
  const hastaElFin = red.slice(0, red.indexOf('evaluarPermiso'));
  assert.ok(!/erroresIA\.push/.test(hastaElFin),
    'la red de plataforma volvió a escribir en la lista con la que se juzga al cliente');
  // Y el veredicto se pide con el contexto medido, no sólo con el texto.
  // (`apartadas`, desde el 07/10/2026: las cuentas suyas que no se probaron por llevar el
  // turno datos de Google — ver tests/datos-google-ia.test.ts.)
  assert.match(doer, /causaDelFallo\(errsIA, nKeys, \{ probadas: ee\?\.probadas, contestaron: ee\?\.contestaron, apartadas: ee\?\.apartadas \}\)/,
    'el veredicto volvió a decidirse sólo con el texto de los errores');
});

test('⚠️ Y EL CARTEL QUEDA REGISTRADO: desde el 30/09 no deja rastro en ningún lado', () => {
  // El arreglo del 30/09 sacó el cartel del historial del grupo —bien: de ahí salía el
  // «Ya estoy de vuelta»— y con eso se perdió la ÚNICA forma de contarlo. La pregunta
  // «¿cuántas veces salió?» se podía contestar hasta ese día (12 en 60 días) y desde
  // entonces no. Rechazar se registra.
  const doer = sinComentarios(leer('../lib/mako-doer-in.ts'));
  assert.match(doer, /recordUsage\('cartel-ia'/,
    'el cartel volvió a salir sin dejar una fila que se pueda contar');
});
