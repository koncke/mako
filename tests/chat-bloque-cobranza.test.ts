// =============================================================================
// «A quién cobrar» en el hilo con MaKo (20/10/2026, Ops Center = lo principal, la 2.27, Pagos)
// =============================================================================
// docs/ops-center-principal.md: «¿quién me debe plata?» dibuja la lista y marca cobrada en un clic; un test con una
// suscripción sin cuotas la muestra (la falla de la llamada con Leila del 19/10). Lo que se fija:
//   1. una suscripción SIN cuotas sale en la lista del chat, y se abre en su ficha (no tiene cuota que marcar); la cuota
//      trae «Cobrada»; la foto guardada se ve SIN acciones hasta que llega la lista viva;
//   2. el saneo del bloque: una fila que marcaría otra cuota, una zona o una ventana inválidas no pasan;
//   3. la lectura `a_quien_cobrar` dibuja SÓLO en el chat de la app, con las MISMAS filas que lee, y el modelo no recibe el
//      bloque (va por `ctx.aDibujar`, saneado);
//   4. el turno de la app lo guarda con la respuesta de MaKo, y la pantalla lo suma debajo sin recargar (y al recargar);
//   5. se dibuja con la pieza de General, y la lista viva es la misma lectura que General, sólo para el admin;
//   6. (21/10/2026, revisión adversarial) la foto guardada dice cuántos son de verdad (30 guardadas de 35), y la zona del
//      negocio se valida como la valida el motor de fechas: con 'UTC' el bloque se caía y MaKo igual decía «está abajo».
// El paso 1 dibuja en un node aparte (tests/_bloques-pagos-hijo.ts): las acciones de servidor traen `server-only`.
//
// Probado rompiéndolo (20/10/2026, una rotura por vez, restaurando byte a byte): los números, en ROTURAS al final.
//
// Correr: node --import tsx --test tests/chat-bloque-cobranza.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemDeSuscripcion } from '../lib/suscripciones-por-cobrar';
import { bloqueACobrar } from '../lib/pagos-bloque';
import { MAX_FILAS_COBRANZA, sanearBloque, type BloqueCobranza } from '../lib/chat-bloques';
import { itemsDeRespuesta, itemsDeSesion } from '../app/m/mako/chat-ui';
import type { RespuestaTurno } from '../lib/mako-turno-app-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const HOY = '2026-10-20';

// Una suscripción manual cerrada el 1/10 y SIN ninguna fila en `pagos`: la que la lista no veía.
const SUSCRIPCION = itemDeSuscripcion({
  lead: { id: 2741, nombre: 'Lucía Mensual', fecha_cierre: '2026-10-01', suscripcion_monto_usd: 800, suscripcion_meses: null, suscripcion_cancelada_at: null },
  pagos: [], cobros: [], hoy: HOY, ventana: { desde: null, hasta: null },
});
const CUOTA = {
  lead_id: 7, lead_nombre: 'Ana López', vendido_usd: 3000, cobrado_usd: 1000, pendiente_usd: 500,
  proxima_cuota: { pago_id: 99, numero: 2, monto_usd: 500, fecha_esperada: '2026-10-25' }, dias_desde_cierre: 40, fecha_cierre: '2026-09-10',
};

/** Dibuja el bloque en el hijo: `hilo` = la foto guardada (antes de la lista viva), `viva` = la pieza con la lista viva. */
function dibujar(b: BloqueCobranza): { hilo: string; viva: string } {
  const out = execFileSync(process.execPath, ['--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_bloques-pagos-hijo.ts'), JSON.stringify(b)], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024,
  });
  const r = JSON.parse(out) as { hilo: string; viva: string };
  const sinCss = (h: string) => h.replace(/<style[\s\S]*?<\/style>/g, '');
  return { hilo: sinCss(r.hilo), viva: sinCss(r.viva) };
}

test('1. ⚠️ una suscripción SIN cuotas sale en la lista del chat y se abre en su ficha; la cuota trae «Cobrada»', () => {
  assert.ok(SUSCRIPCION, 'la suscripción sin cuotas es algo por cobrar');
  const b = bloqueACobrar([CUOTA, SUSCRIPCION], HOY, 'America/Tijuana');
  assert.deepEqual(b.filas.map((f) => [f.leadId, f.pagoId]), [[2741, null], [7, 99]], 'lo vencido (1/10) arriba; la suscripción sin cuota');
  assert.equal(b.filas[0].linea, 'US$800 · falta registrar 1 mes');
  assert.equal(b.total, 2);
  assert.deepEqual(sanearBloque(b), b, 'lo que arma la lectura pasa el saneo entero');

  const { hilo, viva } = dibujar(b);
  assert.match(hilo, /data-bloque="cobranza"/);
  assert.match(hilo, /Lucía Mensual/);
  assert.match(hilo, /falta registrar 1 mes/);
  // La foto guardada no marca: hasta que llega la lista viva, «Cobrada» está apagado (y lo dice).
  assert.match(hilo, /<button[^>]*disabled=""[^>]*aria-label="Marcar cobrada la cuota de Ana López"/);
  assert.match(hilo, /Actualizando la lista…/);
  // Con la lista viva: la cuota se marca en un clic; la suscripción abre su ficha en la tab Pagos.
  assert.match(viva, /<button type="button" class="[^"]*" aria-label="Marcar cobrada la cuota de Ana López">Cobrada<\/button>/);
  assert.match(viva, /<a class="[^"]*" href="\/crm\/2741\?tab=pagos">Abrir<\/a>/);
  assert.doesNotMatch(viva, /Marcar cobrada la cuota de Lucía Mensual/, 'una suscripción no tiene cuota que marcar');
});

test('2. el saneo: una fila que marcaría otra cuota, una zona o una ventana inválidas no pasan', () => {
  const fila = { leadId: 7, pagoId: 99, nombre: 'Ana', linea: 'US$500 · vence el dom', urgencia: 'pronto' as const };
  const base: BloqueCobranza = { t: 'cobranza', filas: [fila], total: 1, tz: 'America/Mexico_City', al: HOY };
  assert.deepEqual(sanearBloque(base), base);
  // Un `pagoId` que no es un id positivo marcaría OTRA cuota: la fila se cae entera (no queda como suscripción).
  for (const pagoId of ['99', 0, -1, 1.5]) {
    assert.deepEqual((sanearBloque({ ...base, filas: [{ ...fila, pagoId }] }) as BloqueCobranza).filas, [], `pagoId ${JSON.stringify(pagoId)}`);
  }
  assert.equal((sanearBloque({ ...base, filas: [{ ...fila, urgencia: 'roja' }] }) as BloqueCobranza).filas[0].urgencia, null);
  for (const tz of ['javascript:alert(1)', '', 'America/Mexico City', 'Marte/Olympus', 'America/'.padEnd(70, 'x')]) assert.equal(sanearBloque({ ...base, tz }), null, `zona «${tz}»`);
  // (21/10/2026: 'UTC' pasó al lado de las que valen. Lo decide `Intl`, como `hoyEnTz`: el regex con barra la tiraba.)
  for (const tz of ['UTC', 'CET', 'EST5EDT', 'Etc/UTC', 'America/Argentina/Buenos_Aires']) assert.equal((sanearBloque({ ...base, tz }) as BloqueCobranza | null)?.tz, tz, `zona «${tz}»`);
  assert.equal(sanearBloque({ ...base, al: '20/10/2026' }), null);
  assert.equal(sanearBloque({ ...base, ventana: { desde: HOY } }), null, 'una ventana a medias leería otra lista');
  assert.deepEqual((sanearBloque({ ...base, ventana: { desde: HOY, hasta: '2026-10-26' } }) as BloqueCobranza).ventana, { desde: HOY, hasta: '2026-10-26' });
  const muchas = sanearBloque({ ...base, filas: Array.from({ length: 40 }, (_, i) => ({ ...fila, leadId: i + 1, pagoId: i + 1 })), total: 40 }) as BloqueCobranza;
  assert.equal(muchas.filas.length, MAX_FILAS_COBRANZA);
  assert.equal(muchas.total, 40, 'el total sigue diciendo cuántos son');
  assert.equal((sanearBloque({ ...base, total: 0 }) as BloqueCobranza).total, 1, 'el total no dice menos que las filas');
});

test('3. la lectura dibuja SÓLO en el chat de la app, con las MISMAS filas que lee; el modelo no recibe el bloque', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/metricas.run.ts'));
  const aq = run.slice(run.indexOf('a_quien_cobrar: {'), run.indexOf('cuotas_pendientes: {'));
  assert.match(aq, /leer: async \(input, ctx\) =>/);
  // (21/10/2026: el bloque se arma y se SANEA antes de las notas: «ya se dibuja» sólo si sobrevive.)
  assert.match(aq, /const bloque = ctx\.aDibujar\s*\? sanearBloque\(bloqueACobrar\(items, hoy, await tzDeWorkspace\(ctx\.ws\)\.catch\(\(\) => TZ_DEFAULT\), filtra \? \{ desde: d, hasta: h \} : null\)\)\s*: null;/,
    'el bloque sale de los MISMOS `items` que la lista que lee el modelo, y se sanea antes de prometerlo');
  // (21/10/2026, segunda revisión: «ya se dibuja» va por `siSeDibuja`, que `ejecutarOperacion` agrega SÓLO si el bloque entró
  // en el mensaje; con el tope de bloques lleno, MaKo decía «la lista está abajo» y no había nada.)
  assert.doesNotMatch(aq, /notas\.unshift\('En este chat la lista YA SE DIBUJA/, 'no va adentro de lo que se lee siempre');
  assert.match(aq, /const siSeDibuja = '\(En este chat la lista YA SE DIBUJA/);
  assert.match(aq, /return bloque \? \{ content: contenido, bloque, siSeDibuja \} : contenido;/, 'en WhatsApp o por HTTP, la salida de siempre');
  const ej = sinComentarios(leer('lib/api-mako/ejecutar.ts'));
  const lectura = ej.slice(ej.indexOf('if (esLectura(def)) {'), ej.indexOf('if (esControl(def)) {'));
  assert.match(lectura, /const bloque = cruda\.bloque && ctx\.aDibujar \? sanearBloque\(cruda\.bloque\) : null;\s*const dibujado = bloque \? ctx\.aDibujar\?\.\(bloque\) !== false : false;/);
  assert.match(lectura, /const resultado = dibujado && cruda\.siSeDibuja \? `\$\{cruda\.content\}\\n\\n\$\{cruda\.siSeDibuja\}` : cruda\.content;/, 'la nota, sólo si entró');
  assert.doesNotMatch(lectura, /resultado: [^}]*bloque/, 'el bloque no viaja en el resultado');
});

test('4. el turno lo guarda con la respuesta de MaKo, y la pantalla lo suma debajo (sin recargar y al recargar)', () => {
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  // (21/10/2026: con la ola 1 el turno es el de Ops Center 3, con los mismos nombres: `dibujar` no repite un bloque igual
  // aunque el turno se re-arranque, y lo guardado con el mensaje es lo dibujado más la pregunta, si la hay.)
  assert.match(turno, /aDibujar: dibujar,/);
  // (21/10/2026: `dibujar` devuelve si entró; el repetido cuenta como dibujado.)
  assert.match(turno, /if \(bloquesDelTurno\.some\(\(x\) => JSON\.stringify\(x\.b\) === JSON\.stringify\(b\)\)\) return true;/, 'un turno re-arrancado no repite lo dibujado');
  // Desde el 12/11/2026 va con «lo que leí» al final (una marca que la pantalla no dibuja, tests/chat-app-hilo.test.ts): los bloques, igual.
  assert.match(turno, /const conLoLeido = \[\.\.\.conElMensaje\.map\(aGuardar\), \.\.\.\(leido \? \[marcaLeido\(leido\)\] : \[\]\)\];\s*await appendMessage\(s\.id, 'assistant', respuesta, conLoLeido\.length \? conLoLeido : undefined\);/);
  assert.match(turno, /guardados\.push\(\{ role: 'assistant', content: respuesta, \.\.\.\(conElMensaje\.length \? \{ bloques: conElMensaje \} : \{\}\) \}\);/);

  const b = bloqueACobrar([CUOTA], HOY, 'America/Tijuana');
  const respuesta = {
    ok: true, sesion: { id: 1, titulo: null, pinned: false, updatedAt: HOY },
    mensajes: [{ role: 'user', content: '¿quién me debe plata?' }, { role: 'assistant', content: 'Ana te debe US$500.', bloques: [b] }],
    aviso: null, paraLaPersona: [], propuestas: [], pantallas: [],
  } as RespuestaTurno;
  const vivo = itemsDeRespuesta(respuesta);
  assert.deepEqual(vivo.map((x) => x.k), ['msg', 'bloque'], 'el bloque, debajo de lo que dijo MaKo');
  assert.deepEqual((vivo[1] as { b: unknown }).b, b);
  const recargado = itemsDeSesion(respuesta.mensajes, []);
  assert.deepEqual(recargado.map((x) => x.k), ['msg', 'msg', 'bloque'], 'al recargar vuelve en el mismo lugar');
});

test('5. se dibuja con la pieza de General, y la lista viva es la lectura de General, sólo para el admin', () => {
  assert.match(sinComentarios(leer('app/_chat/BloqueHilo.tsx')), /if \(b\.t === 'cobranza'\) return <CobranzaHilo b=\{b\} \/>;/);
  const hilo = sinComentarios(leer('app/_chat/bloques/CobranzaHilo.tsx'));
  assert.match(hilo, /import \{ Cobranza \} from '@\/app\/general\/Cobranza';/);
  assert.match(hilo, /muestra=\{!viva\} total=\{viva \? undefined : b\.total\} alCambiar=\{releer\}/, 'sin la lista viva no se marca; después de marcar se vuelve a leer');
  const acciones = sinComentarios(leer('app/_chat/bloques/cobranza-actions.ts'));
  const rol = acciones.indexOf("if ((await getRolWsEfectivo()) !== 'admin')");
  assert.ok(rol > 0 && rol < acciones.indexOf('getWorkspaceActual()'), 'el rol va antes que el workspace (sin sesión cae al ws1)');
  assert.match(acciones, /return \{ ok: true, filas: cobrosDeFilas\(armarCobranza\(items, hoy\)\.filas\), tz \};/);
  assert.match(sinComentarios(leer('lib/pagos-bloque.ts')), /const c = cobroDeFila\(f, \(n\) => fmtValor\(n, 'usd'\)\);/, 'el renglón de General (tests/general-cobranza.test.ts)');
  assert.match(sinComentarios(leer('app/general/Cobranza.tsx')), /const refrescar = alCambiar \?\? \(\(\) => router\.refresh\(\)\);/);
});

test('6. ⚠️ la foto guardada dice cuántos son de verdad: 30 guardadas de 35', () => {
  const items = Array.from({ length: 35 }, (_, i) => ({
    ...CUOTA, lead_id: 100 + i, lead_nombre: `Cliente ${i + 1}`,
    proxima_cuota: { ...CUOTA.proxima_cuota, pago_id: 500 + i },
  }));
  const b = bloqueACobrar(items, HOY, 'America/Tijuana');
  assert.deepEqual([b.filas.length, b.total], [MAX_FILAS_COBRANZA, 35]);
  const { hilo, viva } = dibujar(b);
  assert.match(hilo, /<span class="gb-p">35<\/span>/, 'la cabecera de la foto dice 35, como MaKo');
  assert.match(hilo, /Ver 30 de 35/);
  // La lista viva trae todas: sin `total`, cuenta lo que tiene (la del hijo trae 30).
  assert.match(viva, /<span class="gb-p">30<\/span>/);
  assert.match(viva, /Ver las 30/);
});

// ROTURAS (20/10/2026). Base: 5 pases, 0 fallos. Rota (pases / fallos):
//   · el saneo deja pasar un `pagoId` que no es un id (la fila queda como suscripción)   → 4 / 1 (2)
//   · `a_quien_cobrar` nunca dibuja                                                   → 4 / 1 (3)
//   · `ejecutarOperacion` pasa el bloque sin sanear                                   → 4 / 1 (3)
//   · re-arrancar el turno arrastra lo dibujado en el intento anterior                → 4 / 1 (4)
//     (re-probado el 21/10 sobre el turno de la ola 1: `dibujar` sin el «no repite» → 4 / 1 (4))
//   · la pantalla no suma el bloque de la respuesta (`itemsDeRespuesta`)              → 4 / 1 (4)
//   · la foto guardada marca sin esperar la lista viva (`muestra={false}`)            → 3 / 2 (1 y 5)
//   · el bloque deja afuera las suscripciones                                         → 4 / 1 (1)
//   · General ignora `alCambiar` (el chat refrescaría la página entera)               → 4 / 1 (5)
//
// ROTURAS de la revisión de los bloques (21/10/2026). Base: 6 pases, 0 fallos. Rota (pases / fallos):
//   · la zona vuelve al regex con barra ('UTC' se cae)                                → 5 / 1 (2)
//   · la zona no se le pregunta al motor de fechas                                    → 5 / 1 (2)
//   · «ya se dibuja» antes de saber si el bloque sobrevive                            → 5 / 1 (3)
//   · la foto sin el total                                                            → 4 / 2 (5 y 6)
//   · la cabecera cuenta las filas guardadas                                          → 5 / 1 (6)
//
// ROTURAS de la segunda revisión (21/10/2026). Base: 6 pases, 0 fallos. Rota (pases / fallos):
//   · «la lista está abajo» aunque el bloque no entre                                → 5 / 1 (3)
