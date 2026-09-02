// =============================================================================
// El mensaje de "la IA no pudo" tiene que decir la VERDAD, y vivir en un solo lado
// =============================================================================
// Caso real: una clienta con TRES cuentas de Gemini conectadas vio «No hay IA para
// generar las razones. Conecta tu API key de Gemini (gratis) en Integraciones.» Las
// dos mitades de la frase eran falsas. Lo que falló no fue el análisis —dos de los
// cuatro call-sites YA distinguían «no hay key» de «hay key y falló»— sino que la
// corrección se aplicó a mano y quedó a mitad de camino.
//
// Por eso la guarda de abajo: mientras la frase se pueda escribir en cualquier
// archivo, en algún archivo va a quedar la versión que miente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FRASE_PROHIBIDA, mensajeIAFallo, resumirErrores, motivoDeErroresCascada, esErrorDeIA } from '../lib/ia-mensajes';

test('sin ninguna IA conectada: pedir una key es la respuesta correcta', () => {
  const m = mensajeIAFallo({ hayIA: false, motivo: null, tema: 'generar las razones' });
  assert.match(m, /No hay ninguna IA conectada/);
  assert.match(m, /generar las razones/);
});

test('CON IA conectada NUNCA dice que no hay IA — es el bug que originó esto', () => {
  const casos = [
    { hayIA: true, motivo: 'Se quedó sin cuota / límite de uso alcanzado por ahora.', errores: ['gemini · cuenta 1: HTTP 429'] },
    { hayIA: true, motivo: 'La API key parece inválida o vencida.', errores: ['gemini: 401'] },
    { hayIA: true, motivo: null, errores: ['gemini · cuenta 2: HTTP 503 high demand'] },
    { hayIA: true, motivo: null, errores: [] },
  ];
  for (const c of casos) {
    const m = mensajeIAFallo({ ...c, tema: 'generar las razones' });
    assert.doesNotMatch(m, /No hay ninguna IA/, `dijo "no hay IA" con IA conectada: ${m}`);
    assert.doesNotMatch(m, new RegExp(FRASE_PROHIBIDA, 'i'), `mandó a pegar una key de Gemini: ${m}`);
  }
});

test('un 503 del proveedor NO se reporta como cuota agotada', () => {
  // Caso real del 16/08, con un cliente esperando: 4 documentos, Gemini devolvió 503
  // «This model is currently experiencing high demand», y el usuario leyó «Se quedó sin
  // cuota / límite de uso alcanzado». Se perdió el tiempo buscando una cuota que no
  // existía: la MISMA key contestaba 200 tres de tres minutos después.
  //
  // Son dos cosas opuestas y la diferencia es accionable: la cuota se arregla cargando
  // otra key o pagando; la saturación se arregla ESPERANDO. Mandar a alguien a comprar
  // créditos por un bache del proveedor es el peor consejo posible.
  
  for (const err of [
    'gemini: HTTP 503 This model is currently experiencing high demand.',
    'gemini · cuenta 2: 503 UNAVAILABLE',
    'gemini: overloaded',
    'openrouter: 502 Bad Gateway',
  ]) {
    const m = motivoDeErroresCascada([err]);
    assert.ok(m, `no clasificó "${err}"`);
    assert.doesNotMatch(m!, /sin cuota|límite de uso/i, `reportó saturación como cuota: ${err}`);
    assert.match(m!, /saturado/i, `no dijo que el proveedor está saturado: ${err}`);
  }
  // Y una cuota de verdad sigue diciendo cuota.
  assert.match(motivoDeErroresCascada(['gemini: HTTP 429 RESOURCE_EXHAUSTED'])!, /sin cuota|límite de uso/i);
  // Cuando en la MISMA tanda hay 503 y 429, manda el 503: es lo que explica la tanda.
  // (4 documentos seguidos contra un proveedor caído dan las dos cosas mezcladas.)
  assert.match(motivoDeErroresCascada(['gemini: 503 high demand', 'gemini: 429 rate limit'])!, /saturado/i);
});

test('la salida propuesta coincide con la causa', () => {
  const cuota = mensajeIAFallo({ hayIA: true, motivo: 'Se quedó sin cuota / límite de uso alcanzado por ahora.', tema: 'x' });
  // A una cuota agotada la arregla esperar o sumar otra cuenta, NO pegar otra key igual.
  assert.match(cuota, /reinicie|otra cuenta|otra IA/i);
  const vencida = mensajeIAFallo({ hayIA: true, motivo: 'La API key parece inválida o vencida.', tema: 'x' });
  // A una key vencida NO la arregla esperar.
  assert.match(vencida, /Peg[aá] una nueva/);
  assert.doesNotMatch(vencida, /reinicie/i);
});

test('el detalle dice QUÉ contestó cada cuenta (sin eso, la captura no sirve)', () => {
  const m = mensajeIAFallo({
    hayIA: true, motivo: null, tema: 'x',
    errores: ['gemini · cuenta 1: chatCheap(gemini · cuenta 1): HTTP 503 high demand', 'gemini · cuenta 2: HTTP 429 quota'],
  });
  assert.match(m, /cuenta 1/);
  assert.match(m, /cuenta 2/);
  assert.match(m, /503/);
});

test('resumirErrores no repite, corta y saca el prefijo redundante', () => {
  const r = resumirErrores(['gemini: chatCheap(gemini): HTTP 503', 'gemini: chatCheap(gemini): HTTP 503', 'groq: HTTP 413', 'mistral: x', 'openai: y']);
  assert.doesNotMatch(r, /chatCheap/);
  assert.equal(r.split(' · ').length, 3, `debería quedarse con 3: ${r}`);
  assert.match(r, /\+\d+ más/);
});

/** Todo el código de lib/ y app/ (sin tests), para buscar el literal de verdad. */
function fuentes(): Array<{ ruta: string; texto: string }> {
  const raiz = new URL('../', import.meta.url);
  const out: Array<{ ruta: string; texto: string }> = [];
  const rec = (dir: URL, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      const hijo = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) rec(hijo, `${rel}${e.name}/`);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        // CRLF normalizado: en Windows, si no, los cortes por '\n' no encuentran nada.
        out.push({ ruta: `${rel}${e.name}`, texto: readFileSync(hijo, 'utf8').replace(/\r\n/g, '\n') });
      }
    }
  };
  rec(new URL('lib/', raiz), 'lib/');
  rec(new URL('app/', raiz), 'app/');
  return out;
}

test('GUARDA: «Conecta tu API key de Gemini» solo puede vivir en lib/ia-mensajes.ts', () => {
  const culpables = fuentes()
    .filter((f) => f.ruta !== 'lib/ia-mensajes.ts')
    // Se busca en el CÓDIGO, no en los comentarios: esta misma frase se cita en
    // varios comentarios para explicar el bug, y eso está bien.
    .filter((f) => f.texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').includes(FRASE_PROHIBIDA))
    .map((f) => f.ruta);
  assert.deepEqual(culpables, [],
    `Estos archivos escriben el mensaje a mano y van a quedar viejos: ${culpables.join(', ')}. Usá errorDeCascada(errores, tema).`);
});

test('GUARDA: si el vacío de la cascada se convierte en un MENSAJE, hay que pedir erroresOut', () => {
  // El corte no es "mira el vacío" sino "le habla al usuario". Devolver '' y caer a
  // un default seguro (`return base`, `no_se`) es legítimo y no necesita el detalle:
  // nadie lee nada. Lo que no se puede es ESCRIBIR UN MOTIVO sin haberlo pedido —
  // ahí es donde sale una frase inventada, que es lo que pasó en `generarRazones`.
  const malos: string[] = [];
  for (const f of fuentes()) {
    const codigo = f.texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Cada llamada a la cascada, desde `chatCheapCascade({` hasta su `})`.
    for (const m of codigo.matchAll(/chatCheapCascade\(\{[\s\S]*?\n\s*\}\)/g)) {
      const despues = codigo.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const leElHabla = /if\s*\(!\s*\w+(\.trim\(\))?\s*\)[^\n]*\berror:/.test(despues);
      if (leElHabla && !m[0].includes('erroresOut')) malos.push(f.ruta);
    }
  }
  assert.deepEqual([...new Set(malos)], [],
    `Estos le explican al usuario por qué falló la IA sin haber pedido los errores: ${[...new Set(malos)].join(', ')}`);
});

test('el error CRUDO de Google dispara la salida (llega en INGLÉS)', () => {
  // El regex viejo vivía suelto en MatrizView y buscaba «cuota». Lo que Google manda es
  // «quota», así que con este error —el que vio un cliente en pleno onboarding— no
  // aparecía ninguna salida ni aunque el componente hubiera estado puesto.
  const crudo = 'No se pudo leer el documento con ninguna IA. gemini: You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.7-flash Please retry in 47.396659524s.';
  assert.ok(esErrorDeIA(crudo), 'el error real de Google no dispara la salida');
  // Y los otros que ya se vieron en producción.
  for (const e of [
    'Tu IA está conectada pero no pudo analizar "Documento Madre CI.docx" ahora mismo.',
    'No pude analizar "Avatar para ADS.docx": Se quedó sin cuota / límite de uso alcanzado por ahora.',
    'El proveedor de IA está saturado en este momento (no es tu cuota ni tu key).',
    'gemini: 503 This model is currently experiencing high demand.',
    'La API key parece inválida o vencida.',
  ]) assert.ok(esErrorDeIA(e), `no dispara la salida: ${e}`);
  // Y NO se ofrece conectar una IA por cualquier cosa: un error que no es de IA no lleva
  // la caja. Una salida que aparece siempre es una salida que nadie lee.
  for (const e of ['No encontré el archivo subido. Reintentá.', '"foto.bmp": formato no soportado (subí .txt, .md, .docx, .pdf o una imagen).', 'Datos de archivo inválidos.']) {
    assert.ok(!esErrorDeIA(e), `ofrece conectar IA donde no corresponde: ${e}`);
  }
});

test('GUARDA: el error de IA se dibuja con ErrorIA, no a mano', () => {
  // La salida existía y estaba enchufada en UNA pantalla. Mientras cada una decida por
  // su cuenta si la muestra, alguna no la va a mostrar — y va a ser la del onboarding,
  // que es donde más duele. Estas tres son las que le hablan al cliente cuando la IA
  // falla: si alguna deja de importar ErrorIA, es que volvió a quedarse sin salida.
  for (const ruta of ['app/onboarding/PersonaView.tsx', 'app/onboarding/Archivero.tsx']) {
    const src = readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
    assert.ok(/from '\.\.\/_components\/ErrorIA'/.test(src), `${ruta} dejó de ofrecer la salida cuando la IA falla`);
  }
});


test('un modelo MUERTO no se reporta como saturacion (ni manda a esperar)', () => {
  // Caso real del 16/08: un cliente con CUATRO proveedores cargados no podia subir un
  // documento. Los cuatro fallaban por razones DISTINTAS y ninguna era saturacion:
  //   groq       -> «The model \`llama-3.3-70b-versatile\` does not exist»
  //   openrouter -> «This model is unavailable for free»
  //   cerebras   -> HTTP 402 «Payment required» (la cuenta, no el modelo)
  //   gemini     -> HTTP 429 (cuota de verdad)
  //
  // Y la pantalla decia «el proveedor esta saturado, reintenta en un par de minutos»,
  // porque el clasificador tenia la palabra `unavailable` suelta y matcheaba «unavailable
  // FOR FREE». Como ese caso corre antes que el de cuota, tapaba el 429 real.
  //
  // Las dos mitades importan: un id vencido no se arregla esperando NI conectando otra IA
  // — se arregla en el catalogo, o sea de nuestro lado.
  const muerto = motivoDeErroresCascada(['groq: The model llama-3.3-70b-versatile does not exist or you do not have access to it.']);
  assert.ok(muerto, 'no clasifico un modelo inexistente');
  assert.doesNotMatch(muerto, /saturado/i, 'un id vencido se reporto como saturacion');
  assert.doesNotMatch(muerto, /sin cuota/i, 'un id vencido se reporto como cuota');
  assert.match(muerto, /configuraci/i, 'no dice que el problema es de configuracion nuestra');

  const nofree = motivoDeErroresCascada(['openrouter: This model is unavailable for free. The paid version is available now']);
  assert.ok(nofree); assert.doesNotMatch(nofree, /saturado/i, 'la palabra «unavailable» volvio a disparar saturacion');

  // Y el 429 REAL deja de quedar tapado cuando viene junto con un modelo muerto.
  const mezcla = motivoDeErroresCascada([
    'openrouter: This model is unavailable for free',
    'gemini: HTTP 429 RESOURCE_EXHAUSTED',
  ]);
  assert.ok(mezcla); assert.doesNotMatch(mezcla, /saturado/i, 'sigue ganando saturacion sobre un error de config');

  // La saturacion de verdad (5xx) se sigue reconociendo.
  assert.match(motivoDeErroresCascada(['gemini: HTTP 503 high demand']) ?? '', /saturado/i);
});

test('los ids de modelo del catalogo no son los que ya se cayeron', () => {
  // Cada uno de estos estuvo en el catalogo y dejo de existir en silencio. Un proveedor
  // con la key cargada y el id vencido se ve IGUAL que uno sano hasta que se lo llama.
  const ai = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8');
  for (const id of ['llama-3.3-70b-versatile', 'nvidia/nemotron-3-nano-30b-a3b:free', 'gemini-2.0-flash', 'gemini-2.5-flash']) {
    assert.ok(!ai.includes("'" + id + "'"), 'volvio un id de modelo que ya no existe: ' + id);
  }
});


test('VISION tiene un respaldo GRATIS, no solo el que cobra', () => {
  // ⚠️ ERA EL UNICO PASO DEL ONBOARDING SIN RESPALDO REAL. La cascada de vision era
  // [gemini, openai] y OpenAI es el unico que COBRA: un cliente con las cuatro IA gratis
  // cargadas tenia, para mirar una foto, exactamente UNA. Cuando Gemini se cayo, la cara
  // de marca no se pudo analizar y el wizard se trabo ahi, con el cliente probando.
  //
  // El texto tenia seis proveedores de respaldo y vision uno. Esa asimetria no se ve
  // leyendo el codigo: hay que preguntarse "que pasa si el primero no esta".
  const ai = readFileSync(new URL('../lib/ai-cheap.ts', import.meta.url), 'utf8');
  const m = ai.match(/VISION_CASCADE: ProvName\[\] = \[([^\]]+)\]/);
  assert.ok(m, 'no encontre VISION_CASCADE');
  const lista = m[1];
  assert.ok(/openrouter/.test(lista), 'vision se quedo sin respaldo gratis');
  // Y el que cobra va ULTIMO: es la regla de la casa para toda la capa barata.
  assert.ok(lista.indexOf('openai') > lista.indexOf('openrouter'),
    'el proveedor que cobra dejo de ir ultimo en la cascada de vision');

  // El lector OpenAI-compat no puede volver a estar clavado a un host: es lo que impedia
  // usar el respaldo gratis que el cliente YA tenia cargado.
  assert.ok(!/fetch\('https:\/\/api\.openai\.com/.test(ai),
    'el lector de vision volvio a apuntar fijo a api.openai.com');
});
