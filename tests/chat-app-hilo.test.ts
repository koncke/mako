// =============================================================================
// Los chats de la app conversan como un chat con Claude (lib/chat-app-hilo.ts, 12/11/2026)
// =============================================================================
// Martín, 11/11: «El chat de MaKo tiene que funcionar exactamente igual que un chat acá contigo en Claude. Tiene que guardar todo el
// contexto, tiene que todo el tiempo saber… Todos los chats de MaKo tienen que funcionar exactamente igual». El Ops Center, la
// estrella de cada tab y el Marketing CoPilot (`turnoApp`) le mandaban al modelo 12 mensajes, sólo el texto. Lo que fija:
//   1. EL CASO REAL, por la entrada real (tests/_conversacion-app-hijo.ts): una entrevista del CoPilot de anoche, larga, con el ticket
//      dicho al principio y una lectura de cobros al final. Hoy la persona vuelve y MaKo sigue el hilo: el ticket está (en el resumen
//      o entero), lo que leyó vuelve, y nada se pierde por la ventana de 14 h de los grupos. El resumen se arma con candado, se
//      descarta si pierde un monto y queda guardado con compare-and-set;
//   2. el adaptador: de `chart_chats` al módulo, con «lo que leí» como oculto, y la apertura de MaKo que antes se tiraba;
//   3. «lo que leí»: lo que trajeron las herramientas, hasta 400 letras, como una marca que la pantalla no dibuja;
//   4. el Second Brain se busca con el mensaje y los anteriores de la persona;
//   5. una clave por vista del hilo (el Ops Center, una tab común, el CoPilot);
//   6. el cableado en lib/mako-turno-app.ts y en Offer.
// Correr: node --import tsx --test tests/chat-app-hilo.test.ts
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { aTurno, VENTANA_MS } from '../lib/conversacion-reglas';
import { cortarConResumen } from '../lib/conversacion-resumen-reglas';
import { bloquesGuardados } from '../lib/chat-bloques';
import { conDesde } from '../lib/chat-desde';
import { historialParaModelo } from '../lib/mako-turno-app-reglas';
import {
  MARCA_APERTURA, TOPE_LEIDO, anterioresDeLaPersona, busquedaConLoAnterior, claveDeLaApp, entradasDeLaApp, historialDeTurnos, leidoDeBloques,
  loQueLei, marcaLeido, vistaDelHilo, type FilaDelChat,
} from '../lib/chat-app-hilo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. EL CASO REAL: volver al CoPilot al otro día y que MaKo siga el hilo (la base, el candado y el resumen de verdad)', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_conversacion-app-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CONV@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@CONV@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  assert.equal(o.clave, 'app:77:marketing-copilot');
  // Anoche: la charla no entra entera y lo que queda afuera, desde la apertura, es lo que se resume.
  assert.ok(o.ayer.porResumir > 0, 'una charla del doble del tope no dejó nada para resumir');
  assert.equal(o.ayer.primeroPorResumir, 'app:1', 'lo que se resume no arranca por la apertura');
  // El candado: con otra corrida andando, no se paga un segundo resumen.
  assert.equal(o.conCandado, 'ocupado', 'con el candado tomado se resumió igual');
  // El validador: el modelo que se olvidó del ticket no deja nada guardado, y el candado se suelta.
  assert.equal(o.sinMonto.r, 'descartado');
  assert.match(o.sinMonto.razon, /monto/);
  assert.deepEqual(o.trasSinMonto, { resumen: false, candado: false }, 'un resumen descartado quedó guardado, o el candado no se soltó');
  // El que cumple: guardado, con lo que tenía que quedar, y el candado suelto.
  assert.equal(o.bueno, 'hecho');
  assert.ok(o.pedidoTieneElTicket, 'el pedido al modelo no le exige el ticket');
  assert.match(o.guardado?.texto ?? '', /US\$1\.500/);
  assert.ok(o.candadoSuelto, 'el candado quedó tomado después de resumir');
  assert.equal(o.otraVez, 'no-toca', 'lo ya resumido se volvió a resumir');
  // HOY: el ticket está, lo que MaKo leyó vuelve, el hilo arranca con la persona y no queda nada sin cubrir.
  assert.ok(o.hoy.sabeElTicket, 'al otro día MaKo ya no sabe cuánto deja una venta');
  assert.match(o.hoy.resumen ?? '', /US\$1\.500/, 'el resumen no llegó al turno');
  assert.ok(o.hoy.conLoLeido, 'lo que MaKo leyó de los cobros no volvió en la historia');
  assert.equal(o.hoy.primerRol, 'user');
  assert.ok(o.hoy.turnos > 4, `casi sin historia: ${o.hoy.turnos} turnos`);
  assert.equal(o.hoy.porResumir, 0, 'quedó algo sin cubrir entre el resumen y los turnos');
  // Por qué sin ventana y por qué no los 12: con la de los grupos, nada de anoche; con los 12 de antes, sin el ticket.
  assert.equal(o.conLaVentanaDeLosGrupos, 0);
  assert.equal(o.losDoceDeAntes, false);
  assert.deepEqual(o.red, [], 'el turno salió a la red (Evolution, un modelo) con la conversación ya armada');
});

const AYER = Date.parse('2026-11-11T22:00:00Z');
const fila = (id: number, role: 'user' | 'assistant', content: string, minutos: number, bloques?: unknown): FilaDelChat =>
  ({ id, role, content, created_at: new Date(AYER + minutos * 60_000).toISOString(), ...(bloques ? { bloques } : {}) });
const copiloto = (t: string) => conDesde(t, { tab: 'Marketing CoPilot', entidad: null, modo: null });

test('2. el adaptador: la apertura de MaKo no se tira, lo leído va oculto y sin ventana entra lo de anoche', () => {
  const filas: FilaDelChat[] = [
    fila(1, 'assistant', '¿Cuánto te deja una venta, en dólares?', 0),
    fila(2, 'user', copiloto('Unos US$1.500'), 1),
    ...Array.from({ length: 14 }, (_, i) => fila(3 + i, i % 2 ? 'user' : 'assistant', `mensaje ${i}`, 2 + i)),
    fila(17, 'assistant', 'Te entraron dos pagos.', 20, [{ k: 'bloque', b: { t: 'creado', titulo: 'x' } }, marcaLeido('ver_cobros: total US$3.000')]),
  ];
  const e = entradasDeLaApp(filas);
  assert.equal(e[0].id, 'app:1');
  assert.equal(e[16].oculto, 'Lo que leí: ver_cobros: total US$3.000');
  assert.equal(aTurno(e[16]).content, 'Te entraron dos pagos.\n[Lo que leí: ver_cobros: total US$3.000]');
  const ahora = AYER + 16 * 3_600_000;
  const turnos = historialDeTurnos(cortarConResumen(e, { ahoraMs: ahora, presupuesto: 8000, ventanaMs: Number.POSITIVE_INFINITY, resumen: null }).turnos);
  assert.deepEqual(turnos.slice(0, 2).map((t) => t.content), [MARCA_APERTURA, '¿Cuánto te deja una venta, en dólares?'], 'la pregunta que la persona contestó se tiró');
  assert.ok(turnos.some((t) => t.content.includes('US$1.500')));
  // Lo de antes: los 12 sin el ticket, y la ventana de 14 h sin nada.
  assert.ok(!historialParaModelo(filas.map(({ role, content }) => ({ role, content })), 12).some((m) => m.content.includes('US$1.500')));
  assert.equal(cortarConResumen(e, { ahoraMs: ahora, presupuesto: 8000, ventanaMs: VENTANA_MS, resumen: null }).turnos.length, 0);
  // Dos de la persona seguidos (un turno que falló) se juntan; nunca dos del mismo rol.
  assert.deepEqual(historialDeTurnos([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }]), [{ role: 'user', content: 'a\nb' }, { role: 'assistant', content: 'c' }]);
});

test('3. «lo que leí»: lo que trajeron las herramientas, con sus ids y sus montos, hasta 400 letras, y la pantalla no lo dibuja', () => {
  const cobros = { content: JSON.stringify({ ok: true, instruccion: 'Di en una línea…', cobros: [{ id: 81, nombre: 'Nico Sellers', monto: 'US$1.500' }, { id: 82, nombre: 'Ana Gómez', monto: 'US$1.500' }] }) };
  const t = loQueLei([{ herramienta: 'ver_cobros', salida: cobros }, { herramienta: 'ver_agenda', salida: JSON.stringify({ resumen: 'Mañana a las 10, llamada con Ana.' }) }]);
  assert.ok(t);
  assert.match(t, /^ver_cobros: 81 «Nico Sellers», 82 «Ana Gómez» — .*US\$1\.500/);
  assert.match(t, /ver_agenda: Mañana a las 10, llamada con Ana\./);
  assert.ok(!/instruccion|Di en una línea/.test(t), 'la instrucción de la tarjeta se guardó como algo leído');
  assert.equal(loQueLei([]), null);
  const largo = loQueLei(Array.from({ length: 9 }, (_, i) => ({ herramienta: `h${i}`, salida: { resumen: 'x'.repeat(500) } })));
  assert.ok(largo && largo.length <= TOPE_LEIDO, `pasó el tope: ${largo?.length}`);
  // La marca se guarda junto a los bloques y la pantalla la saltea.
  const guardado = [{ k: 'bloque', b: { t: 'porque' } }, marcaLeido(t)];
  assert.equal(bloquesGuardados(guardado).length, 1, 'la marca se dibuja como un bloque');
  assert.equal(leidoDeBloques(guardado), t);
  assert.equal(leidoDeBloques([{ k: 'adjunto', path: 'x' }]), null);
});

test('4. el Second Brain se busca con el mensaje y los anteriores de la persona', () => {
  const filas: FilaDelChat[] = [
    fila(1, 'user', copiloto('¿Cuánto va a pagar Código Inmobiliario el mes que viene?'), 0),
    fila(2, 'assistant', 'Lo miro.', 1),
    fila(3, 'user', 'Y el comprobante de Nico Sellers', 2),
  ];
  const ant = anterioresDeLaPersona(filas);
  assert.deepEqual(ant, ['Y el comprobante de Nico Sellers', '¿Cuánto va a pagar Código Inmobiliario el mes que viene?'], 'sin el chip, el más nuevo primero');
  const q = busquedaConLoAnterior('Si perfecto, dalo de alta', ant);
  assert.ok(q.startsWith('Si perfecto, dalo de alta'), 'el mensaje no va primero (el grafo usa las primeras letras)');
  assert.match(q, /Código Inmobiliario/, '«dalo de alta» solo no nombra a nadie');
  const largo = busquedaConLoAnterior('x '.repeat(500), ant);
  assert.ok(largo.length <= 600 && largo.includes('Nico Sellers'), 'un mensaje largo se comió los anteriores o pasó las 600 letras');
  assert.equal(busquedaConLoAnterior('hola', []), 'hola');
});

test('5. una clave por vista del hilo: el Ops Center ve todo, una tab común lo común y el CoPilot lo suyo', () => {
  assert.equal(vistaDelHilo(null), 'todo');
  assert.equal(vistaDelHilo('CRM'), 'comun');
  assert.equal(vistaDelHilo('Image'), 'comun');
  assert.equal(vistaDelHilo('Marketing CoPilot'), 'marketing-copilot');
  assert.equal(claveDeLaApp(5, undefined), 'app:5:todo');
});

test('6. el cableado: el turno de la app pasa por el módulo, guarda lo leído, busca con lo anterior y resume después; Offer también', () => {
  const t = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(t, /const deLaTab = delHiloDeLaTab\(previos, desde\?\.tab, origenDelMensaje\);/, 'el hilo del modelo no sale de `previos` filtrado a su tab');
  assert.match(t, /conversacionDelTurno\(\{ canal: 'app', ws, clave: claveConv, entradas: entradasDeLaApp\(deLaTab\), ventanaMs: null, conResumen: true \}\)/, 'el turno no pasa por el módulo, o con ventana, o sin resumen');
  assert.match(t, /const historial = conv \? historialDeTurnos\(conv\.turnos\) : historialParaModelo\(/, 'el historial no sale del módulo');
  assert.match(t, /paqueteParaElTurno\(busquedaConLoAnterior\(textoPersona \|\| textoMemoria, anterioresDeLaPersona\(deLaTab\)\),/, 'el Second Brain se busca sólo con el mensaje');
  assert.match(t, /const ctxResumen = conv\?\.resumen \? `\\n\\n\$\{bloqueDelResumen\(conv\.resumen\)\}` : '';/);
  assert.match(t, /\$\{ctxResumen\}\$\{segundoCerebro \?/, 'el resumen no va en el system');
  assert.match(t, /if \(\(out as \{ isError\?: unknown \}\)\.isError !== true\) salidasDelTurno\.push\(\{ herramienta: name, salida: out \}\);/);
  assert.match(t, /const conLoLeido = \[\.\.\.conElMensaje\.map\(aGuardar\), \.\.\.\(leido \? \[marcaLeido\(leido\)\] : \[\]\)\];\s*await appendMessage\(s\.id, 'assistant', respuesta, conLoLeido\.length \? conLoLeido : undefined\);/, 'lo leído no se guarda con la respuesta');
  assert.match(t, /if \(conv\?\.porResumir\.length\) resumirDespues\(\{ ws, clave: claveConv, porResumir: conv\.porResumir, pedir: pedirResumenDelChat \}\);/, 'lo que no entra no se resume');
  // El resumen nunca en `chart_sessions.contexto` (el onboarding lo usa de marca y borra sesiones por él).
  assert.doesNotMatch(sinComentarios(leer('lib/conversacion-resumen.ts')), /chart_sessions|contexto/);
  const offer = sinComentarios(leer('app/api/offer/route.ts'));
  assert.match(offer, /const resumen = await resumenDeLaConversacion\(p\.sesionId\);/);
  assert.match(offer, /referente: p\.arranque \? '' : await referenteDelOfferCoach\(fila\.mensajes\),\s*resumen,/, 'el turno de Offer no recibe el resumen');
  assert.match(offer, /await resumirLoViejo\(p\.sesionId, final\.mensajes, resumen\);\s*return ok\(/, 'Offer no resume lo que pasa los 30');
  assert.match(offer, /resumirDespues\(\{ ws, clave: claveDeOffer\(sesionId\), porResumir, pedir: pedirResumenDeOffer \}\);/);
  // Offer nunca paga: su resumen va por su propia cascada (`pedir`), no por `chatClaude`.
  const ia = sinComentarios(leer('lib/offer-ia.ts'));
  const r = ia.slice(ia.indexOf('export async function pedirResumenDeOffer('), ia.indexOf('export async function turnoOffer('));
  assert.match(r, /const r = await pedir\(\{/);
  assert.doesNotMatch(r, /chatClaude/);
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después; base 6/0) ──
//   · `ventanaMs: null` tratado como sin decir (la ventana de 14 h en la app), lib/conversacion.ts → falla 1.
//   · el validador sin el chequeo de montos → falla 1 (el resumen sin el ticket quedó guardado).
//   · el resumidor sin candado (`tomarCandado` siempre gana) → falla 1.
//   · `entradasDeLaApp` sin lo leído → fallan 1 y 2.
//   · `historialDeTurnos` tira la apertura de MaKo, como `historialParaModelo` → falla 2.
//   · `busquedaConLoAnterior` sin los anteriores → falla 4.
//   · el turno de la app sin `resumirDespues`, o el de Offer sin `resumen` → falla 6.
//   · el corte sin el umbral (con hueco): acá no cae, lo agarra tests/conversacion-resumen-reglas.test.ts (1).
