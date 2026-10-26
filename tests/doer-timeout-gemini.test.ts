// =============================================================================
// Un timeout de Gemini a mitad del turno: un reintento con SU key, con plazo, y un cartel que diga lo que pasó
// =============================================================================
// EL CASO (23/10/2026 14:05 UTC, grupo de Brigitte, ws15, UNA key: la de Gemini). «Si contacte Eli», contestando el
// recordatorio de las 13:51 («Entró ELi, lo contactaron?»). Medido en la base:
//   · +23 s y +34 s del mensaje, dos pasos con 200 de `flash-lite` (`flash-latest`, el modelo fijado en /modelos-ia,
//     no dejó fila: falló rápido, y no por cuota —no hay marca de 429—). El tercero no volvió y a los +83 s salió el
//     cartel `sin_respaldo`: «chatCheapTools(gemini): The operation was aborted due to timeout» · 1 key · 0 contestaron.
//   · +83 s = +34 + 45 (el timeout) + ~4: el timeout NO tuvo reintento. Con el código de entonces eso sólo pasa si el
//     reintento del paso ya estaba gastado: un fallo rápido de saturación (503 o «fetch failed») + 1,2 s de pausa +
//     el reintento colgado 45 s. El timeout compartía con el 503 el ÚNICO reintento del paso, y no había ningún plazo.
//   · El cartel decía «Tu proveedor de IA se cayó justo ahora… Carga una segunda (son gratis)». No se cayó, y a los 33
//     minutos ella cargó una segunda key de GEMINI, que no cubre a un Gemini lento.
//   · Y el segundo paso había dejado la pendiente #381 «Mover a ELi → etapa "Seguimiento 1"»: el cartel no la nombró,
//     quedó viva dos horas (a las 15:14 su «Bien» a otro mensaje se ruteó como confirmación por ella) y venció sola.
// Lo que fija este archivo (lib/ia-rotacion-modelo.ts, lib/ai-cheap.ts, lib/mako-doer-in.ts, lib/fallo-ia-texto.ts,
// lib/respuesta-doer.ts):
//   1. un timeout va a otro modelo de la misma key, y si no queda, al MISMO una vez por turno;
//   2. los reintentos tienen plazo (100 s por proveedor en WhatsApp); el primer pedido de cada paso, no;
//   3. nunca un respaldo de la plataforma: todo sale de las keys del negocio;
//   4. el cartel `ia_lenta` dice qué IA tardó, que lo cortamos, que lo mande de nuevo y qué IA suya le da respaldo (su GPT;
//      nunca su Gemini, Martín 25/10/2026: con su GPT lento no hay otra que ofrecerle);
//   5. un cartel nombra lo que el turno dejó esperando un «sí» (nada por detrás).
//
// Correr: node --import tsx --test tests/doer-timeout-gemini.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  crearRotacion, tipoDeFallo, hayTiempoParaOtroIntento, MIN_REINTENTO_MS, PLAZO_REINTENTOS_TURNO_MS, PAUSA_SATURACION_MS,
} from '../lib/ia-rotacion-modelo';
import { causaDelFallo, textoFalloIA, fraseDelFallo, linkKeysIA, proveedoresDeLosErrores } from '../lib/fallo-ia-texto';
import { propuestaDeLaSalida, conLoQueQuedoPropuesto } from '../lib/respuesta-doer';
import { marcasDeVoseo } from '../lib/puestas-data';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, firma: string, fin: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const f = src.indexOf(fin, i + firma.length);
  assert.ok(f > i, `no encontré el fin «${fin}»`);
  return src.slice(i, f);
};

const F = 'gemini-flash-latest', L = 'gemini-flash-lite-latest';
const sat = { tipo: 'saturacion' as const, esperaMs: null, porDia: false };
const tout = { tipo: 'timeout' as const, esperaMs: null, porDia: false };
/** El error tal cual lo dejó el cartel del 23/10. */
const ERR_WS15 = 'chatCheapTools(gemini): The operation was aborted due to timeout';
const LINK = linkKeysIA('https://hola-mako.com');

// ── 1. la rotación ──────────────────────────────────────────────────────────

test('⚠️ EL TURNO DEL WS15, REPETIDO: con el reintento del paso gastado, el timeout tiene el suyo', () => {
  let reloj = 0;
  const r = crearRotacion([F, L], { esperaMaxMs: 30_000, hastaMs: 100_000, ahora: () => reloj });
  // Paso 0: `flash-latest` falla y se rota a `flash-lite` (las dos filas de ese turno son de flash-lite).
  reloj = 20_000;
  assert.equal(r.trasFallo(sat)?.accion, 'rotar');
  // Paso 2: un 503 rápido se come el reintento del paso…
  r.nuevoPaso();
  reloj = 36_000;
  assert.deepEqual(r.trasFallo(sat), { accion: 'reintentar', modelo: L, esperaMs: PAUSA_SATURACION_MS });
  // …y el reintento se cuelga 45 s. Antes, acá se tiraba el turno.
  reloj = 81_000;
  assert.deepEqual(r.trasFallo(tout), { accion: 'reintentar', modelo: L, esperaMs: 0 },
    'el timeout volvió a compartir el reintento con el 503: el turno del ws15 se vuelve a tirar');
  // Y sale cortado a lo que queda del plazo: 19 s, no otros 45.
  assert.equal(r.plazoDelIntentoMs(45_000), 19_000, 'el reintento no va cortado al plazo: el cliente espera de más');
  // Un segundo timeout ya no: es una vez por turno, y no fue el plazo el que cortó.
  assert.equal(r.trasFallo(tout), null);
  assert.equal(r.cortadoPorPlazo, false);
});

test('Un timeout va primero al OTRO modelo de la misma key, y al mismo una sola vez por turno (no por paso)', () => {
  const r = crearRotacion([F, L]);
  assert.deepEqual(r.trasFallo(tout), { accion: 'rotar', modelo: L, esperaMs: 0 }, 'el timeout no rota al otro modelo');
  assert.deepEqual(r.trasFallo(tout), { accion: 'reintentar', modelo: L, esperaMs: 0 });
  r.nuevoPaso();
  assert.equal(r.trasFallo(tout), null, 'el reintento del timeout volvió a ser por paso: un turno colgado no tiene techo');
  assert.equal(tipoDeFallo(0, 'The operation was aborted due to timeout'), 'timeout');
});

test('⏱ El plazo corta los REINTENTOS que no tienen 15 s por delante, y lo dice', () => {
  let reloj = 0;
  const r = crearRotacion([L], { hastaMs: 100_000, ahora: () => reloj });
  reloj = 90_000;
  assert.equal(r.trasFallo(tout), null, 'un reintento de 10 s arrancó: nace muerto y el cliente espera de más');
  assert.equal(r.cortadoPorPlazo, true, 'el corte por plazo no se distingue de «no quedaba qué probar»');
  // Una espera de cuota del minuto que no entra tampoco arranca.
  const c = crearRotacion([L], { esperaMaxMs: 30_000, hastaMs: 40_000, ahora: () => 10_000 });
  assert.equal(c.trasFallo({ tipo: 'cuota', esperaMs: 17_000, porDia: false }), null);
  assert.equal(c.cortadoPorPlazo, true);
  assert.equal(hayTiempoParaOtroIntento(100_000, 85_000), true);
  assert.equal(hayTiempoParaOtroIntento(100_000, 85_001), false);
});

test('⚠️ EL PRIMER PEDIDO DE CADA PASO NO SE CORTA: después de una herramienta, el cierre es lo que dice qué se hizo', () => {
  let reloj = 0;
  const r = crearRotacion([F, L], { hastaMs: 100_000, ahora: () => reloj });
  reloj = 50_000;
  r.trasFallo(sat);
  r.nuevoPaso();
  reloj = 99_000;
  assert.equal(r.plazoDelIntentoMs(45_000), 45_000, 'se cortó el primer pedido de un paso: una acción hecha queda sin decir');
  // Sin plazo, como siempre.
  const sinPlazo = crearRotacion([F, L]);
  sinPlazo.trasFallo(sat);
  assert.equal(sinPlazo.plazoDelIntentoMs(45_000), 45_000);
});

test('El plazo de WhatsApp deja el reintento del caso y no estira la espera sin pensarlo', () => {
  // El timeout volvió a los ~81 s del turno: tiene que quedar un reintento de verdad.
  assert.ok(PLAZO_REINTENTOS_TURNO_MS - 81_000 >= MIN_REINTENTO_MS, `con ${PLAZO_REINTENTOS_TURNO_MS} ms el caso del ws15 se vuelve a tirar`);
  assert.ok(PLAZO_REINTENTOS_TURNO_MS <= 120_000, 'el plazo pasó los 2 minutos: el cliente espera de más');
});

// ── 2. chatCheapTools y el doer la usan ──────────────────────────────────────

const AICHEAP = sinComentarios(bloque(leer('../lib/ai-cheap.ts'), 'export async function chatCheapTools(', '\nasync function cerrarSinTools('));
const DOER = sinComentarios(leer('../lib/mako-doer-in.ts'));

test('chatCheapTools le pasa el plazo a la rotación y corta el pedido con ella', () => {
  assert.match(AICHEAP, /crearRotacion\([^\n]*hastaMs: opts\.hastaMs/, 'chatCheapTools no le pasa el plazo a la rotación');
  assert.match(AICHEAP, /signal: AbortSignal\.timeout\(rotacion\.plazoDelIntentoMs\(opts\.timeoutMs \?\? 45000\)\)/,
    'el pedido volvió a ir con 45 s fijos: un reintento no se corta al plazo');
  assert.match(AICHEAP, /rotacion\.cortadoPorPlazo \? `\$\{detalle\} · sin tiempo para otro intento`/,
    'un corte por plazo no queda escrito en el error');
});

test('⚠️ EL DOER: plazo POR PROVEEDOR, la segunda cuenta del mismo no arranca sin tiempo, y nada de la plataforma', () => {
  const loop = bloque(DOER, 'const plazoDe = new Map<string, number>();', 'if (!respuesta && suIA && !linkBorrador');
  assert.match(loop, /if \(plazoCorriendo != null && !hayTiempoParaOtroIntento\(plazoCorriendo\)\) \{[\s\S]{0,200}?continue;/,
    'una segunda cuenta del mismo proveedor arranca con el plazo comido');
  assert.match(loop, /const hastaMs = plazoCorriendo \?\? Date\.now\(\) \+ PLAZO_REINTENTOS_TURNO_MS;\s*plazoDe\.set\(prov, hastaMs\);\s*probadasCliente\+\+;/,
    'el plazo dejó de ser por proveedor (o se cuenta como probada una cuenta que no se probó)');
  const llamadas = loop.match(/await chatCheapTools\([^\n]*\)/g) ?? [];
  assert.equal(llamadas.length, 3, 'cambió cuántas veces el loop llama a chatCheapTools: revisar que todas lleven el plazo');
  for (const l of llamadas) assert.match(l, /hastaMs \}\)$/, `una llamada del loop va sin plazo: ${l.slice(0, 120)}`);
  // ⛔ Las keys del NEGOCIO y nada más (Martín, 22/10/2026: la plataforma no presta IA).
  assert.ok(!/provsGratisDePlataforma|wsSuperAdmin|wsKey/.test(loop), 'el loop de las keys del cliente usa algo de la plataforma');
});

test('El cartel del doer se elige y se escribe con los errores DEL NEGOCIO', () => {
  // `cartel` desde el arreglo del cartel sin IA (24/10/2026, `cartelDelFallo`): la misma causa, y la fila del vigía.
  assert.match(DOER, /textoFalloIA\(cartel, linkKeysIA\(APP_URL\), eraDePlan \? 'armar el borrador' : 'contestar', nKeys, errsIA[,)]/,
    'el cartel no recibe los errores: `ia_lenta` no puede decir qué IA tardó');
});

// ── 3. el cartel ────────────────────────────────────────────────────────────

test('⚠️ UN TIMEOUT NO ES «SE CAYÓ TU PROVEEDOR, CARGA UNA SEGUNDA»', () => {
  assert.equal(causaDelFallo([ERR_WS15], 1, { probadas: 1, contestaron: 0 }), 'ia_lenta', 'el caso del ws15 vuelve a ser `sin_respaldo`');
  // Con la segunda key de Gemini que cargó por el cartel viejo, lo mismo: otra key del mismo no lo cubre.
  assert.equal(causaDelFallo([ERR_WS15, 'chatCheapTools(gemini · cuenta 2): The operation was aborted due to timeout'], 2), 'ia_lenta');
  assert.equal(causaDelFallo([`${ERR_WS15} · sin tiempo para otro intento`], 1), 'ia_lenta');
  assert.equal(causaDelFallo([ERR_WS15, 'chatCheapTools(gemini): HTTP 503 · high demand'], 1), 'ia_lenta');
  // Lo que ya estaba decidido no se mueve.
  assert.equal(causaDelFallo(['chatCheapTools(gemini): HTTP 503 · high demand'], 1), 'proveedor_caido');
  assert.equal(causaDelFallo([ERR_WS15, 'chatCheapTools(gemini · cuenta 2): HTTP 429'], 2), 'sin_cuota', 'la cuota manda sobre el timeout');
  assert.equal(causaDelFallo(['HTTP 500 internal'], 1), 'sin_respaldo');
  assert.equal(causaDelFallo([ERR_WS15], 1, { probadas: 1, contestaron: 1 }), 'fallo_nuestro');
});

test('El cartel dice qué IA tardó, que lo cortamos, que lo mande de nuevo, y qué IA SUYA le da respaldo', () => {
  const t = textoFalloIA('ia_lenta', LINK, 'contestar', 1, [ERR_WS15]);
  assert.match(t, /Gemini, tu IA, tardó demasiado/, `no dice qué IA tardó: ${t}`);
  assert.match(t, /corté para no dejarte esperando/, 'no dice que lo cortamos nosotros (nada por detrás)');
  assert.match(t, /Mándamelo de nuevo/);
  assert.match(t, /Si conectas también tu GPT \(una clave de OpenAI\)/, `no le dice qué IA suya le da respaldo: ${t}`);
  // ⚠️ Su Claude no entra en un turno que ya corrió herramientas (WA1): ofrecérselo es prometer un respaldo que no está.
  assert.ok(!/Claude/.test(t), `le ofrece Claude de respaldo de un turno con herramientas: ${t}`);
  // El link abre el modal de la que se le sugiere: su GPT, ni su Claude ni otra Gemini.
  const LINK_GPT = 'https://hola-mako.com/integraciones?abrir=openai';
  assert.ok(t.includes(LINK_GPT) && !/abrir=(anthropic|gemini)/.test(t), `el link no abre su GPT: ${t}`);
  assert.ok(!/se cayó|carga una segunda|son gratis/i.test(t), `volvió el texto de una sola key: ${t}`);
  assert.deepEqual(marcasDeVoseo(t), [], 'voseo en el cartel');
  assert.ok(t.replace(LINK_GPT, '').length <= 260, `el cartel se alargó: ${t.length} caracteres`);
  // Con GPT lento no hay otra que ofrecerle (25/10/2026: decía «(tu Gemini)» con `?abrir=gemini`, y Gemini no se ofrece).
  const gpt = textoFalloIA('ia_lenta', LINK, 'contestar', 1, ['chatCheapTools(openai): The operation was aborted due to timeout']);
  assert.ok(/GPT, tu IA, tardó/.test(gpt) && /Mándamelo de nuevo en un rato/.test(gpt), gpt);
  assert.ok(!/gemini|\/integraciones|también tu/i.test(gpt), `con su GPT lento le ofrece otra IA: ${gpt}`);
  // Para un audio, Claude no escucha: no se lo ofrece.
  const a = textoFalloIA('ia_lenta', LINK, 'escuchar tu audio', 1, ['gemini: The operation was aborted due to timeout']);
  assert.match(a, /también tu GPT/);
  assert.ok(!/Claude/.test(a), `le ofrece Claude para escuchar un audio: ${a}`);
  // Con IA de dos marcas ya tiene respaldo: no se le pide nada.
  const dos = textoFalloIA('ia_lenta', LINK, 'contestar', 2, [ERR_WS15, 'chatCheapTools(openai): The operation was aborted due to timeout']);
  assert.ok(!dos.includes('/integraciones') && /no es nada tuyo/i.test(dos), `con dos marcas le pide conectar otra: ${dos}`);
  assert.equal(fraseDelFallo('ia_lenta'), 'la IA del negocio tardó demasiado en contestar');
  assert.deepEqual(proveedoresDeLosErrores([ERR_WS15, 'chatCheapTools(gemini · cuenta 2): x', 'anthropic/ANTHROPIC_API_KEY: y']), ['gemini', 'anthropic']);
});

test('⚠️ WA1 SIGUE SIN CLAUDE DESPUÉS DE UNA HERRAMIENTA: si cambia, el cartel de `ia_lenta` puede ofrecerlo', () => {
  assert.match(DOER, /if \(!respuesta && suIA && !linkBorrador && corridasDelTurno === 0\) \{/,
    'cambió cuándo entra su Claude en WhatsApp: revisar CUBREN_EL_TURNO en lib/fallo-ia-texto.ts');
});

// ── 4. lo que el turno dejó esperando un «sí» ───────────────────────────────

/** La salida de `proponer` (lib/mako-doer-acciones.ts) en el segundo paso del turno del ws15. */
const OUT_381 = JSON.stringify({ ok: true, pendiente_id: 381, resumen: 'Mover a ELi → etapa "Seguimiento 1"', vence_en_min: 120, instruccion: 'Diles qué vas a hacer y pide que confirmen con un "sí" para ejecutarlo.' });

test('Qué salida de una herramienta es una pendiente que espera un «sí»', () => {
  assert.deepEqual(propuestaDeLaSalida(OUT_381), { id: 381, resumen: 'Mover a ELi → etapa "Seguimiento 1"', venceEnMin: 120 });
  assert.deepEqual(propuestaDeLaSalida({ content: OUT_381 }), { id: 381, resumen: 'Mover a ELi → etapa "Seguimiento 1"', venceEnMin: 120 }, 'la del registro viene como { content }');
  assert.equal(propuestaDeLaSalida({ content: OUT_381, isError: true }), null, 'un error del runner no es una pendiente');
  assert.equal(propuestaDeLaSalida(JSON.stringify({ ok: false, error: 'No pude registrar la acción pendiente.' })), null, 'una que no entró no se nombra');
  assert.equal(propuestaDeLaSalida(JSON.stringify({ ok: false, pendiente_id: 381, resumen: 'Mover a ELi' })), null, 'un `ok: false` con id no es una pendiente viva');
  assert.equal(propuestaDeLaSalida(JSON.stringify({ ok: true, pendiente_id: '381', resumen: 'x' })), null);
  assert.equal(propuestaDeLaSalida('[{"id":1,"nombre":"ELi"}]'), null, 'una lectura no es una pendiente');
  assert.equal(propuestaDeLaSalida('no es json "pendiente_id"'), null);
});

test('⚠️ EL CARTEL NOMBRA LO QUE QUEDÓ ESPERANDO TU «SÍ», Y NO MANDA A REPETIRLO', () => {
  const cartel = textoFalloIA('ia_lenta', LINK, 'contestar', 1, [ERR_WS15]);
  const p = propuestaDeLaSalida(OUT_381)!;
  const t = conLoQueQuedoPropuesto(cartel, [p]);
  assert.ok(t.startsWith(cartel), 'se perdió el cartel');
  assert.ok(t.includes('• Mover a ELi → etapa "Seguimiento 1"'), `no nombra la pendiente: ${t}`);
  assert.match(t, /respóndeme «sí» en vez de mandármelo de nuevo \(vale por 2 horas\)\./, `no le dice cómo seguir sin duplicarla: ${t}`);
  assert.deepEqual(marcasDeVoseo(t), [], 'voseo en el cartel');
  assert.equal(conLoQueQuedoPropuesto(cartel, []), cartel, 'sin pendientes, el cartel no cambia');
  // Dos pendientes: las dos, y vale lo de la que vence antes.
  const dos = conLoQueQuedoPropuesto('x', [p, { id: 382, resumen: 'Pausar la secuencia «Bienvenida»', venceEnMin: 60 }]);
  assert.ok(dos.includes('• Pausar la secuencia «Bienvenida»') && /vale por 1 hora\)/.test(dos), dos);
});

test('El doer junta las pendientes del turno y las dice sobre CUALQUIER cartel', () => {
  const run = bloque(DOER, 'const runTool = async (name: string, input: Record<string, unknown>) => {', '\n    };');
  assert.match(run, /memo\.anotar\(name, out\);\s*const propuesta = propuestaDeLaSalida\(out\);\s*if \(propuesta\) propuestasDelTurno\.set\(propuesta\.id, propuesta\);/,
    'runTool no junta las pendientes que dejan las herramientas');
  const envio = bloque(DOER, 'if (avisoDeSistema && respuesta && propuestasDelTurno.size) {', 'const enviar = ');
  assert.match(envio, /respuesta = conLoQueQuedoPropuesto\(respuesta, \[\.\.\.propuestasDelTurno\.values\(\)\]\);/,
    'el cartel no dice lo que quedó propuesto');
  // Va DESPUÉS del último lugar que prende un cartel (la bloqueada) y antes de mandar.
  const iBloq = DOER.indexOf('respuesta = AVISO_NO_PUDE;');
  const iProp = DOER.indexOf('if (avisoDeSistema && respuesta && propuestasDelTurno.size) {');
  const iEnv = DOER.indexOf('const enviar = [...partes, ...paraLaPersona]');
  assert.ok(iBloq > 0 && iBloq < iProp && iProp < iEnv, 'lo propuesto se agrega antes de la bloqueada o después de mandar');
});

test('los reintentos del turno (tool forzada, prometió sin hacer) van con la MISMA cuenta y el mismo plazo', () => {
  // Medido en la revisión del 24/10: el de la tool forzada iba sin `clave` y caía en la cuenta 1 del proveedor aunque el
  // turno viniera de la 2 (la que tenía cuota).
  // Las del loop de las cuentas del negocio (`provider: prov`); la de la red gratis no tiene cuenta del negocio.
  const llamadas = DOER.match(/await chatCheapTools\(system, msgs, tools, nuevoIntento\(\), \{ provider: prov, [^\n]*\}\);/g) ?? [];
  assert.equal(llamadas.length, 3, 'cambió la cantidad de llamadas del loop del doer: revisar este test');
  for (const l of llamadas) {
    assert.match(l, /clave: inst\.clave/, `sin la cuenta del turno: ${l.slice(0, 120)}`);
    assert.match(l, /hastaMs \}\);$/, `sin el plazo de los reintentos: ${l.slice(0, 120)}`);
  }
});

// ── ROTURAS (24/10/2026) ────────────────────────────────────────────────────────────────────────────
// Una por vez (reemplazar el texto, correr este archivo, devolverlo de memoria con un script con `finally`).
// Base 15 pasan / 0 fallan (y 15 / 0 al devolver cada una).
//   R1.  `tipoDeFallo`: sin la rama `timeout` (vuelve a ser saturación)                          → 1 falla
//   R2.  rotación: el timeout mira `reintentoDelPaso` (comparte el reintento con el 503)          → 1 falla
//   R3.  rotación: `timeoutReintentado` se resetea en `nuevoPaso` (por paso, no por turno)        → 1 falla
//   R4.  rotación: sin el corte por plazo en `trasFallo`                                          → 1 falla
//   R5.  rotación: `plazoDelIntentoMs` corta también el primer pedido del paso                    → 1 falla
//   R6.  chatCheapTools: `AbortSignal.timeout(opts.timeoutMs ?? 45000)` fijo                       → 1 falla
//   R7.  doer: la segunda cuenta del mismo proveedor arranca sin mirar el plazo                   → 1 falla
//   R8.  doer: el cartel sin `errsIA`                                                             → 1 falla
//   R9.  `causaDelFallo`: sin la rama `ia_lenta`                                                  → 1 falla
//   R10. cartel: `CUBREN_EL_TURNO` con 'anthropic'                                                → 1 falla
//   R11. cartel: el link sigue abriendo el modal de Claude (`conAbrir` devuelve el link)          → 1 falla
//   R12. `propuestaDeLaSalida` acepta `ok: false`                                                  → 1 falla
//   R13. doer: runTool no junta las pendientes                                                    → 1 falla
//   R14. `conLoQueQuedoPropuesto` devuelve el cartel sin tocar                                    → 1 falla
//   R15. `PLAZO_REINTENTOS_TURNO_MS` a 75 s (el caso del ws15 se vuelve a tirar)                   → 1 falla
//   R16. `PLAZO_REINTENTOS_TURNO_MS` a 180 s (el cliente espera de más)                            → 1 falla
//   R17. doer: el reintento de la tool forzada sin `clave: inst.clave`                            → 1 falla
// 25/10/2026: el respaldo de `ia_lenta` es sólo su GPT (`CUBREN_EL_TURNO = ['openai']`) y `conAbrir` salió (el link de
// cada conexión lo arma `enlaceA`). Base 15 / 0; R10 con 'gemini' en vez de 'anthropic' → 1 falla (el cartel); el resto
// de lo que no ofrece Gemini lo fija tests/doer-cartel-sin-ia.test.ts (8).
