// =============================================================================
// El DELAY con segundos y minutos, y la precisión que tiene DE VERDAD (quinta tanda, punto 3)
// =============================================================================
// Literal de Martín: «En Delay, falta la opción de minutos y segundos...». Hasta acá el DELAY ofrecía
// horas y días porque «el motor corre una vez por hora, así que ofrecer minutos sería prometer una
// precisión que no existe». Las dos cosas siguen siendo ciertas, y este test fija las dos mitades:
//
//   1. el DATO: `espera.minutos` con decimales para los segundos, y el saneo de `setSecuenciaPasos`
//      redondea al SEGUNDO (antes, al minuto: 10 s se guardaba como 0 y la espera desaparecía);
//   2. la PANTALLA: la unidad que eligió la persona se recuerda mientras el número entre en ella, y el
//      texto de la píldora da lo mismo que antes para los minutos enteros;
//   3. el MOTOR: la espera se agenda al segundo exacto, y la de hasta 120 s se cumple EN LA MISMA
//      EJECUCIÓN que llegó al DELAY: la corrida del cron (la ruta le da el tope a
//      `procesarEnvios({ esperarHastaMs })`, que duerme al final de la vuelta) y la vía rápida de un
//      evento, que no duerme adentro del webhook sino DESPUÉS de contestar (`after()`,
//      `seguirDespuesDeResponder`);
//   4. la CADENCIA: desde la sexta tanda (09/10/2026) el motor mira lo vencido cada minuto, las 24 h
//      (el tick, más la corrida de cada hora), así que ya no hay aviso que dar: «Sigue a la hora en
//      punto» se fue. Si alguien cambia el cron, este test frena hasta que las constantes digan lo
//      mismo;
//   5. la PÍLDORA y «Probar»: «Esperar 30 s», no «Esperar 1 min» (`textoEspera` redondeaba a minutos).
//
// PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez y restaurada DE MEMORIA (arnés en el
// scratchpad, nunca `git checkout`). Con todo puesto: ver el pie del archivo.
//
// Correr: npx tsx --test tests/espera-duracion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNIDADES_ESPERA, SEGUNDOS_DE, rotuloUnidad, segundosDeMinutos, minutosDeSegundos, unidadDe, unidadMostrada,
  textoDuracion, esperaEnLaCorrida, desdeFresco,
  ESPERA_EN_CORRIDA_MAX_S, ESPERA_CORRIDA_HASTA_MS, CADENCIA_MOTOR_MIN, VENTANA_FRESCA_MIN,
} from '../lib/espera-duracion';
import { camposDelFlujo, resolverControl } from '../lib/nutricion-grafo-motor';
import { textoEspera, type PasoGrafo } from '../lib/flujo-grafo';
import { iniciar, siguiente } from '../lib/simulador-grafo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const AHORA = Date.parse('2026-10-09T15:00:07Z');

test('el dato: segundos ↔ minutos con decimales, y los minutos enteros vuelven EXACTOS', () => {
  assert.equal(minutosDeSegundos(10), 10 / 60);
  assert.equal(segundosDeMinutos(minutosDeSegundos(10)), 10, '10 s ida y vuelta');
  assert.equal(segundosDeMinutos(minutosDeSegundos(90)), 90);
  for (const m of [1, 5, 59, 60, 90, 1440, 2880, 366 * 1440]) {
    assert.equal(minutosDeSegundos(m * 60), m, `${m} min no vuelve exacto: lo guardado cambiaría en un decimal`);
  }
  assert.equal(segundosDeMinutos(0), 0);
  assert.equal(segundosDeMinutos('x'), 0);
  assert.equal(segundosDeMinutos(-3), 0);
  assert.equal(minutosDeSegundos(0), 0);
});

test('⚠️ el saneo de `setSecuenciaPasos` CONSERVA los segundos (antes redondeaba a minutos y 10 s desaparecía)', () => {
  const diez = camposDelFlujo({ id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 10 / 60 } });
  assert.ok(diez.espera, 'la espera de 10 s se perdió en el saneo');
  assert.equal(segundosDeMinutos(diez.espera!.minutos), 10);
  // Lo de siempre, igual: un día sigue siendo 1440, entero.
  assert.deepEqual(camposDelFlujo({ id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 } }).espera, { modo: 'tiempo', minutos: 1440 });
  // Medio segundo no es una espera: se redondea al segundo y 0 no viaja.
  assert.equal(camposDelFlujo({ id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 0.4 / 60 } }).espera, undefined);
  // «Antes de la reunión» también lleva segundos si los trae (el modo no los descarta).
  assert.equal(segundosDeMinutos(camposDelFlujo({ id: 'e', nodo: 'esperar', espera: { modo: 'antes_reunion', minutos: 1.5 } }).espera!.minutos), 90);
});

test('⚠️ el motor agenda la espera al SEGUNDO exacto (10 s y 5 min), no a la hora del cron', () => {
  const pasos: PasoGrafo[] = [
    { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: minutosDeSegundos(10) }, siguiente: 'm', canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as PasoGrafo,
    { id: 'm', canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'el link', template_wa: null } as PasoGrafo,
  ];
  const r = resolverControl(pasos, 0, { hechos: null, ahoraMs: AHORA, reunionMs: null });
  assert.equal(r.tipo, 'esperar');
  assert.equal(r.tipo === 'esperar' ? r.proximoMs : 0, AHORA + 10_000);
  const cinco = pasos.map((p) => (p.id === 'e' ? { ...p, espera: { modo: 'tiempo' as const, minutos: 5 } } : p));
  const r5 = resolverControl(cinco, 0, { hechos: null, ahoraMs: AHORA, reunionMs: null });
  assert.equal(r5.tipo === 'esperar' ? r5.proximoMs : 0, AHORA + 5 * 60_000);
});

test('la unidad: la natural de un valor, y la que eligió la persona mientras el número entre en ella', () => {
  assert.equal(unidadDe(10), 's');
  assert.equal(unidadDe(90), 's');
  assert.equal(unidadDe(120), 'min');
  assert.equal(unidadDe(3600), 'h');
  assert.equal(unidadDe(86400), 'dias');
  assert.equal(unidadDe(0), 's');
  // ⚠️ Con «segundos» elegido, tipear 120 NO salta a «2 minutos» con el cursor adentro.
  assert.equal(unidadMostrada(120, 's'), 's');
  assert.equal(unidadMostrada(60, 's'), 's');
  // Si no entra entera (un deshacer trajo 90 s con «minutos» elegido), la natural.
  assert.equal(unidadMostrada(90, 'min'), 's');
  assert.equal(unidadMostrada(7200, null), 'h');
  assert.deepEqual([...UNIDADES_ESPERA], ['s', 'min', 'h', 'dias'], 'segundos, minutos, horas y días (punto 3)');
  assert.equal(rotuloUnidad('s', 1), 'segundo');
  assert.equal(rotuloUnidad('s', 10), 'segundos');
  assert.equal(rotuloUnidad('dias', 1), 'día');
  assert.equal(rotuloUnidad('h', 2), 'horas');
  assert.equal(SEGUNDOS_DE.dias, 86400);
});

test('⚠️ el ancho del desplegable de la unidad se mide con la más LARGA del conjunto («segundos»)', () => {
  // AGENTS.md: «Un layout se prueba con el valor MÁS LARGO del conjunto». La unidad va en un
  // desplegable con `flex: 1 1 150px` y el campo grande (16 px, 600, relleno de 14 por lado, la flecha).
  const largo = Math.max(...UNIDADES_ESPERA.flatMap((u) => [rotuloUnidad(u, 1), rotuloUnidad(u, 2)]).map((t) => t.length));
  assert.equal(largo, 'segundos'.length);
  // Geist a 16 px semibold: ~0,6 em por letra. 8 letras ≈ 77 px + 28 de relleno + 18 de la flecha y su aire.
  const necesita = Math.ceil(largo * 16 * 0.6) + 28 + 18;
  const flujo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  const ed = bloque(flujo, 'function EditorEspera(', '\n}\n', 4_200);
  const base = Number(/flex: '1 1 (\d+)px', minWidth: 0 \}\}>\s*<Dropdown value=\{unidad\}/.exec(ed)?.[1]);
  assert.ok(base >= necesita, `el desplegable de la unidad nace con ${base} px y «segundos» pide ${necesita}`);
});

test('el texto de la píldora: igual que antes para los minutos enteros, y con los segundos', () => {
  // Los de tests/flujo-grafo.test.ts y tests/simulador-*.test.ts, que fijaba `textoEspera`.
  assert.equal(textoDuracion(1440 * 60), '1 día');
  assert.equal(textoDuracion(2880 * 60), '2 días');
  assert.equal(textoDuracion(90 * 60), '90 min');
  assert.equal(textoDuracion(15 * 60), '15 min');
  assert.equal(textoDuracion(60 * 60), '1 h');
  assert.equal(textoDuracion(24 * 60 * 60), '1 día');
  assert.equal(textoDuracion(10), '10 s', '«Probar» dice «Esperar 10 s»');
  assert.equal(textoDuracion(90), '90 s');
});

test('⚠️ la píldora y «Probar» dicen los SEGUNDOS: `textoEspera` redondeaba a minutos («Esperar 0 min» para 10 s)', () => {
  // El editor decía «10 segundos» y la tarjeta y «Probar», al lado, «Esperar 0 min»; 30 s, «1 min».
  assert.equal(textoEspera({ modo: 'tiempo', minutos: minutosDeSegundos(10) }), 'Esperar 10 s');
  assert.equal(textoEspera({ modo: 'tiempo', minutos: minutosDeSegundos(30) }), 'Esperar 30 s');
  assert.equal(textoEspera({ modo: 'tiempo', minutos: minutosDeSegundos(90) }), 'Esperar 90 s');
  // Lo de siempre, idéntico (lo fijan también tests/flujo-grafo.test.ts y tests/simulador-*.test.ts).
  assert.equal(textoEspera({ modo: 'tiempo', minutos: 1440 }), 'Esperar 1 día');
  assert.equal(textoEspera({ modo: 'tiempo', minutos: 90 }), 'Esperar 90 min');
  assert.equal(textoEspera({ modo: 'antes_reunion', minutos: 15 }), '15 min antes de la reunión');
  // «Probar» no espera: dice cuánto con el MISMO texto y sigue (lib/simulador-grafo.ts).
  const f: PasoGrafo[] = [
    { id: 'e', nodo: 'esperar', espera: { modo: 'tiempo', minutos: minutosDeSegundos(30) }, siguiente: 'm', canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null } as PasoGrafo,
    { id: 'm', canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: 'el link', template_wa: null } as PasoGrafo,
  ];
  let st = iniciar(f);
  const vistos: string[] = [];
  for (let i = 0; i < 12 && !st.terminado; i++) {
    const r = siguiente(f, st);
    if (r.evento?.t === 'espera') vistos.push(r.evento.texto);
    if (r.evento?.t === 'mensaje') vistos.push(`💬${r.evento.paso.cuerpo}`);
    st = r.estado;
  }
  assert.deepEqual(vistos, ['⏳ Esperar 30 s', '💬el link']);
});

test('⚠️ adentro de la corrida: hasta 120 s, antes del tope que dio la ruta, y NUNCA sin tope', () => {
  const tope = AHORA + ESPERA_CORRIDA_HASTA_MS;
  assert.equal(esperaEnLaCorrida(AHORA + 10_000, AHORA, tope), 10_000, '«audio y 10 s después el link»');
  assert.equal(esperaEnLaCorrida(AHORA + ESPERA_EN_CORRIDA_MAX_S * 1000, AHORA, tope), ESPERA_EN_CORRIDA_MAX_S * 1000);
  assert.equal(esperaEnLaCorrida(AHORA + ESPERA_EN_CORRIDA_MAX_S * 1000 + 1, AHORA, tope), null, 'más de 120 s: la cumple el cron');
  assert.equal(esperaEnLaCorrida(AHORA - 5, AHORA, tope), 0, 'ya vencida: no se duerme');
  // ⚠️ Sin tope (la vía rápida de un evento, adentro de un webhook): no se duerme NUNCA.
  assert.equal(esperaEnLaCorrida(AHORA + 10_000, AHORA, undefined), null);
  assert.equal(esperaEnLaCorrida(AHORA + 10_000, AHORA, null), null);
  // Que termine DESPUÉS del tope de la ruta: tampoco (le comería el tiempo al resto de los workspaces).
  assert.equal(esperaEnLaCorrida(AHORA + 30_000, AHORA, AHORA + 20_000), null);
  assert.ok(ESPERA_CORRIDA_HASTA_MS + ESPERA_EN_CORRIDA_MAX_S * 1000 < 300_000 + 1, 'el tope y la espera no pasan el `maxDuration` de la ruta');
});

test('⛔ ya no hay nada que avisar: ninguna espera dibuja «Sigue a la hora en punto» (sexta tanda)', () => {
  // Martín (09/10/2026): «No entiendo el texto "Sigue a la hora en punto", eso no tiene sentido,
  // eliminalo». Con el tick de cada minuto la espera dura lo que dice. Segunda pasada: los dos
  // cascarones que quedaban (`sinPrecision`, `avisoDePrecision`) se fueron, y nadie los importa.
  const mod = sinComentarios(leer('lib/espera-duracion.ts'));
  assert.doesNotMatch(mod, /export function (sinPrecision|avisoDePrecision)\b/, 'volvió un cascarón del aviso');
  assert.doesNotMatch(sinComentarios(leer('app/chatbot/FlujoLienzo.tsx')), /sinPrecision|avisoDePrecision/, 'el editor del DELAY volvió a importar el aviso');
  // Y el texto no vive en el código del módulo (en los comentarios sí: es el porqué).
  assert.doesNotMatch(mod, /hora en punto/i);
});

/** Las horas UTC en que corre un schedule de cron (el segundo campo). `null` = no se sabe contar. */
const horasDe = (campo: string): Set<number> | null => {
  if (campo === '*') return new Set(Array.from({ length: 24 }, (_, h) => h));
  const out = new Set<number>();
  for (const parte of campo.split(',')) {
    const r = /^(\d+)-(\d+)$/.exec(parte);
    if (r) for (let h = Number(r[1]); h <= Number(r[2]); h++) out.add(h);
    else if (/^\d+$/.test(parte)) out.add(Number(parte));
    else return null;
  }
  return out;
};

test('⚠️ CADENCIA_MOTOR_MIN dice lo mismo que vercel.json: el tick cada minuto y la corrida de la hora, las 24 h', () => {
  // Probado rompiéndolo (09/10/2026): el tick en «*/5 1-59 …» → cae acá; la corrida de la hora de
  // vuelta en «0 15-23 * * *» → cae acá (de noche no corría nada).
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { crons: Array<{ path: string; schedule: string }> };
  const tick = vercel.crons.find((c) => c.path === '/api/cron/nutricion-tick');
  const hora = vercel.crons.find((c) => c.path === '/api/cron/nutricion');
  assert.ok(tick, 'no encontré el tick de la nutrición');
  assert.ok(hora, 'no encontré el cron de la nutrición');
  const [minTick, horaTick, ...restoTick] = tick!.schedule.trim().split(/\s+/);
  const [minHora, horaHora, ...restoHora] = hora!.schedule.trim().split(/\s+/);
  assert.deepEqual(restoTick, ['*', '*', '*']);
  assert.deepEqual(restoHora, ['*', '*', '*']);
  // El tick, cada minuto salvo el 0 (que lo cubre la corrida de la hora): cadencia 1.
  assert.equal(minTick, '1-59', `el tick corre «${tick!.schedule}»: hay que medir la cadencia y actualizar CADENCIA_MOTOR_MIN`);
  assert.equal(minHora, '0', 'la corrida de la hora cubre el minuto 0 que el tick no corre');
  assert.equal(CADENCIA_MOTOR_MIN, 1);
  // Las 24 horas, las dos: «de día o de noche».
  assert.equal(horasDe(horaTick)?.size, 24, `el tick corre sólo en las horas «${horaTick}»`);
  assert.equal(horasDe(horaHora)?.size, 24, `la corrida de la hora corre sólo en «${horaHora}»: de noche no se barre nada`);
  // La ventana del tick cubre un minuto salteado y la corrida de la hora con el turno tomado.
  assert.ok(VENTANA_FRESCA_MIN >= 2 * CADENCIA_MOTOR_MIN && VENTANA_FRESCA_MIN < 60);
  assert.equal(desdeFresco(AHORA), new Date(AHORA - VENTANA_FRESCA_MIN * 60_000).toISOString());
});

test('⚠️ las DOS rutas del cron le dan el tope a TODAS sus corridas, y comparten el cupo de la hora', () => {
  // La primera versión ya sabía dormir y la ruta no le pasaba `esperarHastaMs`: la espera corta
  // «adentro de la corrida» no corría en ningún lado, y 30 s eran la corrida de la hora siguiente.
  // Desde la sexta tanda, además, `cupoPorHora` en todas: sin él, cada tick tendría su propio cupo
  // de 6 y la línea mandaría hasta 360 por hora.
  for (const [archivo, cuantas] of [['app/api/cron/nutricion/route.ts', 3], ['app/api/cron/nutricion-tick/route.ts', 1]] as const) {
    const ruta = sinComentarios(leer(archivo));
    assert.match(ruta, /const esperarHastaMs = Date\.now\(\) \+ ESPERA_CORRIDA_HASTA_MS;/, `${archivo}: el tope se cuenta UNA vez, desde que arrancó la ruta`);
    // Perezoso y sin cruzar un `;`: la del tick lleva un objeto adentro (`{ vencidasDesde }`).
    const llamadas = ruta.match(/procesarEnvios\(\{[^;]*?\}\)/g) ?? [];
    assert.equal(llamadas.length, cuantas, `${archivo} llama al motor ${llamadas.length} veces: hay que mirar la nueva`);
    for (const l of llamadas) {
      assert.match(l, /esperarHastaMs/, `«${l}» corre sin tope: sus esperas cortas van al minuto siguiente`);
      assert.match(l, /cupoPorHora: true/, `«${l}» tiene su propio cupo de WhatsApp: multiplica el anti-ban`);
    }
    // Y con el TURNO del negocio: dos corridas del motor a la vez mandan dos veces.
    assert.match(ruta, /conTurno(DelMotor)?\(/, `${archivo} corre el motor sin el turno del negocio`);
  }
  // El tick, sólo sobre lo que acaba de vencer (salvo al abrir el horario: barre entero).
  const tick = sinComentarios(leer('app/api/cron/nutricion-tick/route.ts'));
  assert.match(tick, /\.\.\.\(motivo === 'vencio' \? \{ vencidasDesde: desde \} : \{\}\)/);
});

test('⚠️ la VÍA RÁPIDA cumple la espera corta DESPUÉS de contestar (after), con su tope y su workspace', () => {
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  const proc = nutri.slice(nutri.indexOf('export async function procesarEnvios('), nutri.indexOf('\nexport async function pausarPorRespuesta('));
  assert.ok(proc.length > 10_000, 'no encontré procesarEnvios');
  // La rama de la espera anota la corta que no puede dormir (sin tope), medida con la MISMA función.
  const rama = bloque(proc, "if (r.tipo === 'esperar') {", '\n          continue;\n        }', 1_800);
  assert.match(rama, /const paraDespues = ok && !corta && opts\?\.esperarHastaMs == null\s*&& esperaEnLaCorrida\(r\.proximoMs, Date\.now\(\), Date\.now\(\) \+ ESPERA_CORRIDA_HASTA_MS\) != null;/);
  assert.match(rama, /if \(paraDespues\) cortaSinTope = Math\.min\(/);
  // Al terminar, sólo la de UN lead (la vía rápida) sigue después de contestar.
  assert.match(proc, /if \(cortaSinTope != null && opts\?\.soloLeadId\) \{\s*res\.esperaDespuesDeResponder = await seguirDespuesDeResponder\(opts\.soloLeadId, cortaSinTope\);/);
  // La continuación: after(), el workspace fijado, el tope (para las cortas encadenadas) y en fila.
  const seg = bloque(nutri, 'async function seguirDespuesDeResponder(', '\n}\n', 2_000);
  assert.match(seg, /after\(seguir\);/);
  assert.match(seg, /\} catch \{/, 'fuera de un pedido `after` tira: no puede tirar la vía rápida');
  assert.match(seg, /runWithWorkspace\(ws, \(\) => procesarEnvios\(\{ soloLeadId: leadId, esperarHastaMs: Date\.now\(\) \+ ESPERA_CORRIDA_HASTA_MS \}\)\)/);
  assert.match(seg, /colaDespuesDeResponder\.then\(/, 'las continuaciones corren el motor de a una');
  assert.match(seg, /if \(falta > 0\) await new Promise<void>\(\(listo\) => setTimeout\(listo, falta\)\);/);
  assert.match(nutri, /import \{ after \} from 'next\/server';/);
});

test('⚠️ `procesarEnvios` duerme las esperas cortas AL FINAL de la vuelta, en las DOS salidas del bucle', () => {
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  const proc = nutri.slice(nutri.indexOf('export async function procesarEnvios('), nutri.indexOf('\nexport async function pausarPorRespuesta('));
  assert.ok(proc.length > 10_000, 'no encontré procesarEnvios');
  // El tope lo da el que llama; sin él no se duerme (la regla vive en `esperaEnLaCorrida`).
  assert.match(proc, /soloLeadId\?: number; esperarHastaMs\?: number; cupoPorHora\?: boolean; vencidasDesde\?: string \}/);
  // El tick: sólo lo vencido desde `vencidasDesde`, en la MISMA consulta de la cola.
  assert.match(proc, /if \(opts\?\.vencidasDesde\) q = q\.gte\('proximo_envio_at', opts\.vencidasDesde\);/);
  // La rama de la espera escribe la hora exacta y ANOTA la corta (sólo si el compare-and-set la movió).
  const rama = bloque(proc, "if (r.tipo === 'esperar') {", '\n          continue;\n        }', 1_800);
  assert.match(rama, /proximo_envio_at: new Date\(r\.proximoMs\)\.toISOString\(\)/);
  assert.match(rama, /const corta = ok && esperaEnLaCorrida\(r\.proximoMs, Date\.now\(\), opts\?\.esperarHastaMs\) != null;/);
  assert.match(rama, /if \(corta\) esperasCortas\.set\(insc\.id, /);
  // Las dos salidas del bucle: «no vino nada vencido» y «la cola se drenó».
  assert.match(proc, /if \(due\.length === 0\) \{ if \(await dormirEsperaCorta\(\)\) continue; break; \}/);
  assert.match(proc, /if \(fetched\.length < LOTE && !otraVuelta && \(await dormirEsperaCorta\(\)\)\) continue;\s*if \(fetched\.length < LOTE && !otraVuelta\) break;/);
  // Al despertar, lo que venció vuelve a la cola (`vistos`), y la vuelta no cuenta para el tope de 6.
  const dormir = bloque(proc, 'const dormirEsperaCorta = async (): Promise<boolean> => {', '\n  };\n', 1_200);
  assert.match(dormir, /const ms = esperaEnLaCorrida\(proxima, Date\.now\(\), opts\?\.esperarHastaMs\);/);
  assert.match(dormir, /if \(ms == null\) \{ esperasCortas\.clear\(\); return false; \}/);
  assert.match(dormir, /for \(const \[id, vence\] of esperasCortas\) if \(vence <= ahora\) \{ vistos\.delete\(id\); esperasCortas\.delete\(id\); \}/);
  assert.match(dormir, /esperasHechas >= TOPE_ESPERAS_CORTAS/, 'sin tope de esperas, una corrida podría dormir sin fin');
  // ⚠️ El anti-ban sigue: lo que viene después de la espera pasa por TODAS las guardas de la vuelta.
  assert.match(proc, /frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioReciente, enviadoEnCorrida\)/);
  // La vía rápida (un evento) no da tope: no duerme ADENTRO del webhook (sigue después: el test de abajo).
  assert.match(nutri, /try \{ await procesarEnvios\(\{ soloLeadId: leadId \}\); \}/);
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// TERCERA PASADA (09/10/2026, sexta tanda: el tick de cada minuto, sin ventana y sin aviso). Arnés
// en el scratchpad, restaurado DE MEMORIA, corriendo este archivo con tests/motor-freno-ventana y
// tests/nutricion-residuo. Base: 53 / 0. Restaurado: 53 / 0.
//   X1. el tick en «*/5 * * * *»                                              → 52 / 1
//   X2. la corrida de la hora de vuelta en «0 15-23 * * *»                      → 52 / 1
//   X3. el tick sin `cupoPorHora` (su propio cupo de 6 por minuto)             → 51 / 2
//   X4. `avisoDePrecision` vuelve a decir «Sigue a la hora en punto»           → 52 / 1
//   X5. la cola del motor sin el corte `vencidasDesde`                         → 52 / 1
//   M1. el cupo sin `- enLaHora` (motor-freno-ventana)                         → 52 / 1
//   M2. el horario leído tolerante (`getSetting`: base caída = sin horario)    → 52 / 1
//   M3. sin horario, la ventana de 9 a 21 de antes                             → 52 / 1
//   R1. el residuo sin el techo del día (nutricion-residuo)                    → 52 / 1
// Lo que la pasada de antes medía del aviso (E5, E6, R3, R4, R5, R11) se fue con el aviso.
//
// Arnés en el scratchpad (romper.mjs): una rotura por vez, restaurada DE MEMORIA, corriendo este
// archivo junto con tests/editores-control.test.ts y tests/lienzo-muelles.test.ts. Base: 32 / 0.
// Pasan / fallan con cada una (las de este archivo):
//   E1. `sanearEspera` vuelve a redondear a minutos (10 s → 0)          → 31 / 1
//   E2. la unidad elegida no se recuerda (salta al tipear)              → 31 / 1
//   E3. `esperaEnLaCorrida` duerme sin el tope de la ruta               → 31 / 1
//   E4. la píldora sin segundos («0.1666 min»)                         → 31 / 1
//   E5. el aviso de precisión también en horas y días                  → 31 / 1
//   E6. CADENCIA_MOTOR_MIN = 30 con vercel.json en una por hora         → 30 / 2
//   E7. no duerme cuando la vuelta no trae nada vencido                 → 31 / 1
//   E8. la rama de la espera no anota la corta                          → 31 / 1
//   E10. el desplegable de la unidad nace con 80 px («segundos» pide 123) → 31 / 1
// (E9 —el DELAY sin segundos ni minutos— lo caza tests/editores-control.test.ts.)
// (E5 era «el aviso también en horas y días»: desde la segunda pasada eso es lo CORRECTO, ver R3.)
//
// SEGUNDA PASADA (09/10/2026, la que cableó la ruta, la vía rápida y la píldora). Mismo arnés
// (romper2.mjs), los mismos tres archivos. Base: 35 / 0. Restaurado: 35 / 0.
//   R1. `textoEspera` vuelve a redondear a minutos                       → 34 / 1
//   R2. la ruta corre el modo «sólo acciones» sin `esperarHastaMs`       → 34 / 1
//   R3. `sinPrecision` vuelve a «sólo de 2 a 59 min»                      → 34 / 1
//   R4. el aviso ignora la zona de quien mira (dice las horas en UTC)     → 34 / 1
//   R5. HORAS_MOTOR_UTC dice 14-23 con vercel.json en 15-23              → 33 / 2
//   R6. la rama de la espera no anota la corta para después de contestar → 34 / 1
//   R7. la vía rápida corre la continuación EN LÍNEA, sin `after`        → 34 / 1
//   R8. la continuación corre sin `runWithWorkspace`                      → 34 / 1
//   R9. la continuación corre SIN tope (la segunda corta no se cumple)   → 34 / 1
//   R10. la continuación también sin `soloLeadId` (o sea, desde el cron) → 34 / 1
//   R11. el editor dibuja el aviso sin la zona del navegador             → 34 / 1
//   R12. las continuaciones corren el motor a la vez (sin la fila)       → 34 / 1
