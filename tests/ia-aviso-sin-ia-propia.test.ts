// AU3 · el aviso de IA del lienzo dice la verdad y apunta a Claude (22/10/2026)
// =============================================================================
// Mauricio (ws1) leyó en el chat de su automatización «No tienes ninguna IA gratis conectada.», con el link a Gemini. Era
// falso dos veces: el ws1 no conecta IA gratis (la red de la plataforma va sola) y lo que pasó fue que esa red llegó a su
// tope de hoy (el 429 por día de Gemini). La frase salía de `falloDeIA` con la lista vacía, porque los errores de la red
// (`erroresRed`) no entraban (lo midió el chat «IA del cliente»). Ahora: sin keys propias, se dice qué le pasó a la IA
// gratis de MaKo y la salida es SU Claude (/integraciones?abrir=anthropic), que es lo primero que prueba esta cascada.
// Con keys propias, la red no cambia nada: un 429 de la agencia nunca es de las keys del negocio.
//
// ⚠️ Y DESDE EL 6/11/2026 EL AVISO NO HABLA MÁS DE LA IA GRATIS DE MaKo: no puede pasarle nada, porque esa red ya no
// corre para nadie — y no por una guarda sino por DOS que se excluyen entre sí (el porqué medido está en `sinIAPropia`,
// lib/flujo-ia.ts). Las cuatro frases («llegó a su tope de hoy», «está al tope», «está saturada», «no contestó») le
// pedían al cliente esperar un rato por un tope que no existe para él, en vez de conectar su IA. El ancla que las traería
// de vuelta es el test de las dos guardas, que mira al revés que los demás: fija la RAZÓN, no el texto.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { falloDeIA, sinIAPropia, LINK_CONECTA_CLAUDE, PROVS_CREAR_IA, SU_IA, SU_CLAVE } from '../lib/flujo-ia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

/** Los errores de la red con la forma de `erroresPlataformaOut` (lib/ai-cheap.ts: «<prov>/<clave>: <detalle>»). */
const GEMINI_DIA = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 429: You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 250, model: gemini-2.5-flash. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const GROQ_TPD = 'groq/CHEAP_API_KEY: chatCheap(groq): Rate limit reached for model `openai/gpt-oss-120b` in organization org_x service tier on_demand on tokens per day (TPD): Limit 200000, Used 199870, Requested 4120. Please try again in 28m. Visit https://console.groq.com/docs/rate-limits';
const GEMINI_MINUTO = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 429';
const GEMINI_SATURADO = 'gemini/GEMINI_API_KEY: chatCheap(gemini): HTTP 503: This model is currently experiencing high demand';

test('sin keys propias: la salida es conectar SU IA, pase lo que pase con la red (6/11/2026)', () => {
  // ⚠️ Hasta el 6/11 esto afirmaba «La IA gratis de MaKo llegó a su tope de hoy»: un motivo que el cliente no puede tener
  // (ver `sinIAPropia`, lib/flujo-ia.ts). Le decía «prueba en un rato» por un tope que no existe para él, en vez de
  // mandarlo a conectar su IA, que es lo único que lo desbloquea.
  for (const red of [[GEMINI_DIA], [GROQ_TPD], [GEMINI_DIA, GROQ_TPD], [GEMINI_MINUTO], [GEMINI_SATURADO], ['groq/CHEAP_API_KEY: chatCheap(groq): socket hang up']]) {
    const f = falloDeIA([], false, red);
    assert.deepEqual(f, { error: 'No tienes una IA conectada: conecta tu Claude o tu GPT.', link: '/integraciones?abrir=anthropic' });
  }
  assert.equal(LINK_CONECTA_CLAUDE, '/integraciones?abrir=anthropic');
});

test('ningún texto le dice al cliente que espere por la IA gratis de MaKo', () => {
  const REDES = [[GEMINI_DIA], [GROQ_TPD], [GEMINI_MINUTO], [GEMINI_SATURADO], ['groq/CHEAP_API_KEY: socket hang up'], []];
  for (const red of REDES) {
    const e = sinIAPropia(red).error;
    assert.doesNotMatch(e, /IA gratis de MaKo/, `«${e}» nombra un motivo que el cliente no puede tener`);
    assert.doesNotMatch(e, /tope de hoy|est[áa] al tope|saturada|prueba en un rato/i, `«${e}» le pide esperar por algo que no se arregla esperando`);
  }
  // Sin red que probar: no tiene IA, y se dice así (es lo único que lo desbloquea).
  assert.deepEqual(sinIAPropia([]), { error: 'No tienes una IA conectada: conecta tu Claude o tu GPT.', link: LINK_CONECTA_CLAUDE });
  // La red salteada a propósito: con su propio Claude (D6b), o porque el pedido lleva datos de clientes.
  assert.equal(sinIAPropia(['red gratis salteada: el negocio usa su propia IA (su Claude o su GPT)']).error,
    // Desde IA6 la IA propia también puede ser su GPT: «tu propia IA», y el link ya lleva a Integraciones.
    'Con tu propia IA, para armar el flujo necesito tu clave de Claude o de OpenAI.');
  assert.match(sinIAPropia(['red gratis salteada: el pedido lleva datos de clientes y el plan gratis entrena con lo que recibe']).error, /^Conecta tu Claude en Integraciones: lleva datos de tus clientes/);
  // Todos llevan el link a Claude, y ninguno vuelve a «IA gratis conectada» ni al link de Gemini.
  for (const red of [[GEMINI_DIA], [GEMINI_MINUTO], [GEMINI_SATURADO], [], ['red gratis salteada: x']]) {
    const f = sinIAPropia(red);
    assert.equal(f.link, LINK_CONECTA_CLAUDE);
    // 25/10/2026 (Martín): ningún texto OFRECE Gemini, ni la gratis ni «tu Gemini».
    assert.doesNotMatch(f.error, /ninguna IA gratis conectada|gemini/i);
  }
});

test('con keys propias, la red no cambia el mensaje: un 429 de la agencia no es de las keys del negocio', () => {
  // Sus keys fallaron: manda lo de SUS keys.
  assert.equal(falloDeIA(['gemini: chatCheap(gemini): Your project has been denied access. Please contact support.'], false, [GEMINI_DIA]).error,
    'Gemini rechazó tu key. Cámbiala en Integraciones.');
  // Tiene keys y nada contestó: lo de siempre, sin hablar de la IA gratis de MaKo.
  assert.deepEqual(falloDeIA([], true, [GEMINI_DIA]), { error: 'Ninguna IA contestó. Prueba de nuevo.' });
  // «Tu IA llegó a su tope» (sus keys con 429) sigue siendo «al tope, prueba en un rato».
  assert.deepEqual(falloDeIA(['gemini: chatCheap(gemini): HTTP 429'], true, [GEMINI_DIA]), { error: 'Gemini está al tope. Prueba en un rato.' });
});

test('la clave de Claude del negocio se nombra «Claude», y sin saldo no se la manda a cambiar ni a esperar', () => {
  assert.deepEqual(falloDeIA(['anthropic/ANTHROPIC_API_KEY: invalid x-api-key'], false), { error: 'Claude rechazó tu key. Cámbiala en Integraciones.', link: LINK_CONECTA_CLAUDE });
  assert.deepEqual(falloDeIA(['anthropic/ANTHROPIC_API_KEY: Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'], false),
    { error: 'Claude se quedó sin crédito. Cárgale crédito en tu cuenta de Anthropic.' });
  assert.equal(falloDeIA(['anthropic/ANTHROPIC_API_KEY: chatCheap(x): Algo raro'], false).error, 'Claude falló: Algo raro. Prueba de nuevo.');
});

test('el camino real: `generar` le pasa los errores de la red, y el aviso nombra sólo la IA propia que arma flujos', () => {
  const crear = leer('lib/flujo-ia-crear.ts');
  assert.match(crear, /return falloDeIA\(errores, hayIA, erroresRed\);/, 'el mensaje no se entera de qué le pasó a la red');
  // Hoy, una clave de OpenAI no arma flujos: no está en `PROVS_CREAR_IA` (cobra) y la cascada no usa `PROVS_SU_IA` por su
  // cuenta. Con el IA6 (lote 2 de IA, el chat «IA del cliente») la cascada corre con SU OpenAI: entonces el aviso dice GPT.
  const gptArmaFlujos = PROVS_CREAR_IA.includes('openai') || /PROVS_SU_IA/.test(leer('lib/ai-cheap.ts'));
  // Lo que se OFRECE no es lo que se usa (Martín, 25/10/2026): su Gemini sigue armando flujos para quien lo tiene
  // (`PROVS_SU_IA`), pero el aviso ofrece su Claude o su GPT. Antes (IA16) nombraba las tres.
  assert.doesNotMatch(`${SU_IA} ${SU_CLAVE}`, /gemini/i, 'ningún texto le ofrece Gemini a un negocio como «su IA»');
  if (gptArmaFlujos) {
    assert.equal(SU_IA, 'tu Claude o tu GPT', 'una clave de OpenAI ya arma flujos (IA6): cambia SU_IA y SU_CLAVE en lib/flujo-ia.ts');
    assert.equal(SU_CLAVE, 'tu clave de Claude o de OpenAI');
  } else {
    assert.equal(SU_IA, 'tu Claude', 'el aviso promete un GPT que todavía no arma flujos');
    assert.equal(SU_CLAVE, 'tu clave de Claude');
  }
  for (const red of [[GEMINI_DIA], [GEMINI_MINUTO], [GEMINI_SATURADO], []]) assert.ok(sinIAPropia(red).error.includes(SU_IA));
  // Todo corto: es una línea que se dibuja en el chat.
  for (const red of [[GEMINI_DIA], [GEMINI_MINUTO], [GEMINI_SATURADO], [], ['red gratis salteada: el negocio usa su propia IA']]) {
    assert.ok(sinIAPropia(red).error.length <= 95, `«${sinIAPropia(red).error}» es largo para una línea`);
  }
});

test('las DOS guardas de la red gratis se excluyen: si alguien las hace compatibles, vuelven los cuatro textos', () => {
  // ⚠️ ESTE ES EL ANCLA DEL 6/11/2026, y mira al REVÉS que los demás: no fija que los textos estén, fija la RAZÓN por la
  // que se fueron. Si la red gratis vuelve a poder correr, el cliente otra vez puede toparse con su tope y el aviso tiene
  // que volver a decírselo — y el que la reviva se entera acá, no por un cliente.
  const cheap = leer('lib/ai-cheap.ts');
  // (1) La red sólo devuelve proveedores DENTRO del workspace del super admin.
  const prov = cheap.slice(cheap.indexOf('export async function provsGratisDePlataforma('), cheap.indexOf('\n}\n', cheap.indexOf('export async function provsGratisDePlataforma(')));
  assert.match(prov, /if \(\(await getWorkspaceActual\(\)\.catch\(\(\) => null\)\) !== ws\) return \[\];/,
    'la red gratis volvió a correr para un negocio: `sinIAPropia` tiene que volver a decir qué le pasó');
  // (2) Y TODOS sus llamadores corren sólo cuando el workspace en curso NO es el del super admin: la condición contraria
  //     a la de (1). Medido el 6/11: son cuatro (`chatCheapCascade`, el contador `hayRed`, el lector de documentos y
  //     `transcribirAudio`) y los cuatro están detrás de esa guarda. Se chequean TODOS, no «el único»: la primera versión
  //     de este test decía «el único llamador» y había cuatro — lo cazó la rotura, no la lectura.
  const lineas = cheap.split('\n');
  const DECLARA = /^export async function provsGratisDePlataforma\($/;
  const RECURSIVA = /conD6bDelPedido\(null, \(\) => provsGratisDePlataforma\(uso\)\)/;
  const SOLO_FUERA_DEL_SA = /wsActual !== wsSA|\) !== sa\b/;
  const llamadas = lineas.map((l, i) => [l, i] as const)
    .filter(([l]) => /provsGratisDePlataforma\(/.test(l) && !DECLARA.test(l) && !RECURSIVA.test(l));
  assert.ok(llamadas.length >= 1, 'no quedó ningún llamador de la red: `provsGratisDePlataforma` es código muerto entero');
  /** Los `{` que ENCIERRAN a esa línea, de adentro hacia afuera, por sangría (no por distancia: la guarda de
   *  `chatCheapCascade` está 50 líneas arriba, detrás de un bloque de comentarios y del crédito de la plataforma). */
  const sangria = (l: string) => /^\s*/.exec(l)![0].length;
  const encierran = (i: number): string[] => {
    const out: string[] = [];
    let objetivo = sangria(lineas[i]!);
    for (let j = i - 1; j >= 0 && objetivo > 0; j--) {
      const l = lineas[j]!;
      if (!l.trim() || sangria(l) >= objetivo) continue;
      if (/\{\s*$/.test(l)) { out.push(l); objetivo = sangria(l); }
    }
    return out;
  };
  for (const [l, i] of llamadas) {
    // Las dos líneas de arriba entran porque la guarda puede ser parte de la MISMA expresión y no un `if` que encierra
    // (el contador `hayRed`: `sa != null && (await getWorkspaceActual()…) !== sa` y recién en el renglón siguiente la red).
    const cadena = [l, ...lineas.slice(Math.max(0, i - 2), i), ...encierran(i)].join('\n');
    assert.ok(SOLO_FUERA_DEL_SA.test(cadena),
      `la red gratis se llama SIN la guarda «no es el super admin» en lib/ai-cheap.ts:${i + 1} (${l.trim().slice(0, 60)}…): ahora PUEDE correr, y los cuatro textos de «La IA gratis de MaKo…» hacen falta de vuelta`);
  }
  // (3) Lo único que todavía puede llegar en `red` es el crédito de Claude de la plataforma, y no para el armador de flujos.
  const veto = leer('lib/veto-claude.ts');
  const lista = veto.slice(veto.indexOf('export const CREDITO_HABILITADO_PARA'), veto.indexOf('];', veto.indexOf('export const CREDITO_HABILITADO_PARA')));
  assert.doesNotMatch(lista, /chatbot-crear-ia/,
    'el armador de flujos entró a CREDITO_HABILITADO_PARA: un fallo del crédito de MaKo ahora llega al aviso y hay que decirlo con sus palabras, no «no tienes una IA conectada»');
});

// ── Probado rompiéndolo (22/10/2026, romper.mjs) ───────────────────────────────────────────────────────────────────
// Los números son «tests / fallan» de ESTE archivo con cada rotura.
//   R1. `falloDeIA` sin la red (vuelve «No tienes ninguna IA gratis conectada»)   → 5 / 1
//   R2. sin distinguir el tope POR DÍA                                              → 5 / 1
//   R3. `generar` sin pasarle `erroresRed`                                          → 5 / 1
//   R4. la red decide aunque el negocio tenga keys                                  → 5 / 1
//   R5. sin el veredicto «crédito»                                                  → 5 / 1
//   R6. el link vuelve a Gemini                                                     → 5 / 2
//   R7. el texto promete GPT antes del IA6                                          → 5 / 3
//   R8. entra el IA6 (la cascada usa `PROVS_SU_IA`) y el texto no cambia            → 5 / 1
//   R9. un texto pierde «conecta tu Claude»                                         → 5 / 2
//   R10. (25/10/2026) SU_IA vuelve a ofrecer «tu Gemini»                            → 2 / 3
//
// ── Probado rompiéndolo (6/11/2026, el arnés del scratchpad; base 6 / 0) ───────────────────────────────────────────
// Las 9 cayeron: vuelve «llegó a su tope de hoy» 4/2 · vuelve «está saturada, prueba en un rato» 4/2 · se cae el
// marcador de «usa su propia IA» 4/2 · se cae el de «datos de clientes» 5/1 · la red gratis vuelve a correr para un
// negocio (guarda 1 de `provsGratisDePlataforma`) 5/1 · la cascada llama la red FUERA de su guarda (guarda 2) 5/1 · el
// armador de flujos entra a `CREDITO_HABILITADO_PARA` 5/1 · el aviso vuelve a ofrecer Gemini 3/3 · `generar` deja de
// pasarle `erroresRed` 5/1.
// ⚠️ La PRIMERA versión del ancla de las guardas afirmaba que la red tenía UN llamador y tiene CUATRO; lo mostró la
// rotura, no la lectura. Y el cuarto no está detrás de un `if` que lo encierre sino de una condición de la MISMA
// expresión (`hayRed`), así que la cadena se mide por SANGRÍA más las dos líneas de arriba, no por distancia.
