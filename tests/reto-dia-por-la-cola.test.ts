// =============================================================================
// Lo de adentro de un día del reto sale por la cola de salida (20/11/2026, el Cerebro)
// =============================================================================
// El Cerebro, con Martín probando el reto: «lo que aparece dentro de un día (la extensión, las integraciones, la hora, el perfil, la
// prueba por WhatsApp, "¡Hiciste todo…!" y el clip del día 6) tiene que pasar por useColaDeSalida, con sus puntitos y la tarjeta
// después del texto». Antes cada paso entraba de golpe apenas /api/reto daba la tarea anterior por hecha.
// QUÉ sale y en qué orden: lib/reto/en-el-dia.ts (lo usan la cola del chat y `Dia`, para que no se separen). El cableado:
// app/second-brain/reto/ChatDelReto.tsx.
// Correr: node --import tsx --test tests/reto-dia-por-la-cola.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIAS_RETO, RETO_D2_EXT, RETO_D2_HORA, RETO_D2_INT, RETO_D2_INT_LISTAS, RETO_D2_PERFIL, claveTarea, type EstadoReto } from '../lib/reto/dias';
import { diaDelPaso, idEnElDia, pasosEnElDia } from '../lib/reto/en-el-dia';

const fuente = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const dia = (n: number) => DIAS_RETO.find((x) => x.n === n)!;
const D2 = dia(2);
const AT = '2026-11-19T12:00:00Z';
const estado = (hechas: readonly string[], o: Partial<EstadoReto> = {}): EstadoReto =>
  ({ v: 1, inicio: '2026-11-18T12:00:00Z', adelantado: 2, hechas: Object.fromEntries(hechas.map((k) => [k, AT])), ...o });
const todasDe = (n: number) => dia(n).tareas.map((t) => claveTarea(n, t.id));
const FALTA = [{ conectada: false }];
const LISTAS = [{ conectada: true }];
const ques = (xs: ReadonlyArray<{ que: string }>) => xs.map((x) => x.que);

test('el día 2 de HOY, de a un paso: nada hasta la app; la extensión; las integraciones; la hora; y el perfil recién con la hora', () => {
  const hoy = { hoy: true, integraciones: FALTA };
  assert.deepEqual(pasosEnElDia(D2, estado([]), hoy), [], 'con la app sin instalar, sólo el mensaje del día y su tarjeta (el QR)');
  assert.deepEqual(pasosEnElDia(D2, estado(['2:app']), hoy), [{ id: 'en:2:ext', que: 'ext', texto: RETO_D2_EXT, pieza: true }], 'la extensión, con su tarjeta después');
  assert.deepEqual(ques(pasosEnElDia(D2, estado(['2:app', '2:extension']), hoy)), ['ext', 'int']);
  assert.equal(pasosEnElDia(D2, estado(['2:app', '2:extension']), hoy)[1].texto, RETO_D2_INT);
  assert.equal(pasosEnElDia(D2, estado(['2:app', '2:extension']), { hoy: true, integraciones: LISTAS })[1].texto, RETO_D2_INT_LISTAS, 'con todas conectadas, sin «te falta»');
  const tres = estado(['2:app', '2:extension', '2:integraciones']);
  assert.deepEqual(pasosEnElDia(D2, tres, hoy).slice(2), [{ id: 'en:2:hora', que: 'hora', texto: RETO_D2_HORA, pieza: true }], 'la hora, y el perfil todavía no');
  // La hora guardada: su mensaje queda sin la tarjeta, la confirmación llega como mensaje nuevo, y recién ahí el perfil.
  const conHora = pasosEnElDia(D2, { ...tres, horaWa: '9:00' }, hoy);
  assert.deepEqual(ques(conHora), ['ext', 'int', 'hora', 'hora-ok', 'perfil']);
  assert.equal(conHora[2].pieza, false, 'guardada, sin la tarjeta del selector');
  assert.equal(conHora[3].texto, '✓ MaKo te escribe cada día a las 9:00, por WhatsApp.');
  assert.deepEqual(conHora[4], { id: 'en:2:perfil', que: 'perfil', texto: RETO_D2_PERFIL, pieza: true });
  // La hora para después también deja pasar al perfil.
  assert.deepEqual(ques(pasosEnElDia(D2, { ...tres, despues: ['2:hora'] }, hoy)), ['ext', 'int', 'hora', 'perfil']);
  // Con todo hecho, «¡Hiciste todo…!», al final.
  const todo = pasosEnElDia(D2, estado(todasDe(2), { horaWa: '9:00' }), hoy);
  assert.deepEqual(todo.at(-1), { id: 'en:2:todo', que: 'todo', texto: '¡Hiciste todo lo del día 2!', pieza: false });
});

test('un día 2 que ya pasó se ve entero (sin la extensión aparte: va en la tarjeta del día); sin integraciones, ninguna tarjeta suya', () => {
  assert.deepEqual(ques(pasosEnElDia(D2, estado([]), { hoy: false, integraciones: FALTA })), ['int', 'hora', 'perfil']);
  assert.deepEqual(ques(pasosEnElDia(D2, estado([]), { hoy: false, integraciones: [] })), ['hora', 'perfil']);
});

test('los otros días: el clip del 6; la prueba por WhatsApp al final, con el día terminado; el 7, nunca (va después del cierre)', () => {
  const sinInt = { hoy: true, integraciones: [] };
  assert.deepEqual(pasosEnElDia(dia(6), estado([]), sinInt).map((x) => x.id), ['en:6:clip']);
  assert.deepEqual(pasosEnElDia(dia(3), estado([]), sinInt), [], 'el día 3 sin terminar: nada todavía');
  const p3 = pasosEnElDia(dia(3), estado(todasDe(3)), sinInt);
  assert.deepEqual(p3, [{ id: 'en:3:prueba', que: 'prueba', texto: dia(3).whatsapp!.texto, pieza: false }]);
  assert.deepEqual(pasosEnElDia(dia(7), estado(todasDe(7)), sinInt), [], 'la del día 7 sale después del cierre del reto');
  assert.equal(diaDelPaso(idEnElDia(6, 'clip')), 6);
  assert.equal(diaDelPaso('fin:3'), null, 'una fila que no es de adentro de un día');
});

test('el chat: cada paso es una fila de la cola, retenida hasta que el día mostró lo suyo; `Dia` dibuja sólo lo que salió', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const enDia = pasosEnElDia(x, e, { hoy: x.n === d.abierto, integraciones: d.integraciones ?? [] })\n        .map((p): FilaDeCola => ({ id: p.id, de: 'mako', texto: p.texto, pieza: p.pieza }));"), 'las filas de MaKo, con su texto y su pieza');
  assert.ok(chat.includes("return [{ id: `dia:${x.n}`, de: 'dia', texto: '' }, ...enDia, ...fin];"), 'después del día y antes de su cierre');
  assert.ok(chat.includes('retenido: (id) => historia !== amb || !amb || !puerta || esperaSuDia(id),'));
  assert.ok(chat.includes('const esperaSuDia = (id: string) => { const n = diaDelPaso(id); return n != null && !diasListos.has(n); };'));
  assert.ok(chat.includes('useEffect(() => { if (conPieza) onListo?.(dia.n); }, [conPieza, onListo, dia.n]);'), 'el día avisa cuando su mensaje y su tarjeta ya se ven');
  assert.ok(chat.includes('ver={ver} conPiezaDe={cola.conPieza} onListo={diaListo} />'));
  // `Dia`: cada paso cuando sale su fila; la tarjeta, cuando sale su pieza.
  assert.ok(chat.includes("const sale = (q: QueEnElDia) => pasos.some((x) => x.que === q) && ver(idEnElDia(dia.n, q));"));
  for (const q of ['ext', 'perfil']) assert.ok(chat.includes(`{suTarjeta('${q}') && <Burbuja ancho>`), `la tarjeta de «${q}», después del texto`);
  assert.ok(chat.includes("conTarjeta={suTarjeta('int')} />"), 'la de las integraciones');
  assert.ok(chat.includes("conMensaje={sale('hora')} conTarjeta={suTarjeta('hora')} confirmada={sale('hora-ok')} />"), 'la de la hora y su confirmación');
  assert.ok(chat.includes("{p && sale('prueba') && <TarjetaPrueba"), 'la prueba por WhatsApp');
  assert.ok(fuente('../app/second-brain/reto/TarjetasDia2.tsx').includes('{conTarjeta && <Burbuja ancho>'));
  // Lo de un día que ya pasó, de una (al cargar y si aparece después); la marca de la tarea espera a que su tarjeta salga.
  assert.ok(chat.includes('enN != null ? enN < hoyN'), 'lo de adentro de los días anteriores, ya visto');
  assert.ok(chat.includes("useEffect(() => { if (atrasados) mostrarYa(atrasados.split('|')); }, [atrasados, mostrarYa]);"));
  assert.ok(chat.includes('}, [claveToca, correr, enDiaVisto]);'), 'la marca sola vuelve a mirar cuando sale la tarjeta');
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11): base 4/0; cada rotura, de a una, da 3/1, y al restaurar vuelve a 4/0.
//   - el perfil sin esperar la hora (en-el-dia: `(true)) poner('perfil'`) → «el día 2 de HOY…»
//   - la extensión sin su tarjeta después (`poner('ext', RETO_D2_EXT, false)`) → «el día 2 de HOY…»
//   - la prueba del día 7 adentro del día (sin `dia.n !== 7`) → «los otros días…»
//   - la hora guardada con su selector (`poner('hora', RETO_D2_HORA, true)`) → «el día 2 de HOY…»
//   - lo del día sin esperar al día (sin `esperaSuDia(id)` en `retenido`) → «el chat…»
//   - el día que no avisa (sin el `onListo` de `Dia`) → «el chat…»
//   - la tarjeta de la extensión con su texto (sin `suTarjeta('ext')`) → «el chat…»
//   - las integraciones con su tarjeta de una (sin `conTarjeta` en TarjetasDia2) → «el chat…»
//   - lo de un día pasado, con puntitos (sin `enN < hoyN` en `deAntes`) → «el chat…»
//   - la marca sola sin volver a mirar (sin `enDiaVisto` en las deps) → «el chat…»
//   - los pasos sin puntitos (filas `de: 'dia'` en vez de `'mako'`) → «el chat…»
