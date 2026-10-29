// =============================================================================
// La clase del mensaje del grupo, por la entrada REAL (29/10/2026, Martín: «Que sepa cuándo es un ticket, cuándo es una pregunta, o
// una acción dentro de MaKo»; tests/_clase-del-grupo-hijo.ts)
// =============================================================================
// El clasificador es Claude con el crédito de los grupos (lib/mako-intencion-ia.ts) y el turno el GPT del negocio, los dos de mentira
// con lo que pone cada escena. Lo que fija este archivo:
//   1. TICKET: lo abre el código con los pasos y la clase en su contexto, la respuesta es FIJA («Abrí el ticket #N: … Lo toma el
//      equipo y te aviso por aquí cuando esté») y el modelo del turno no corre; lo que sigue a un ticket recién nombrado se SUMA;
//   2. CHARLA y NO_REPLY: ni una palabra (la charla, el 👍; lo que no es para MaKo, nada), y el turno no corre;
//   3. PREGUNTA: el turno corre SÓLO con lecturas y con su bloque, y la muletilla no sale; si además reporta algo, se contesta y el
//      ticket se abre igual; una respuesta que era todo relleno no sale;
//   4. el clasificador va con el crédito de los grupos (la cuenta 2, Haiku) y, si se cae, mandan las reglas;
//   5. una PREGUNTA no afirma un número que no está en nada de lo que recibió (`numerosSinFuente`);
//   6. ACCIÓN (lib/despacho-grupo.ts): sólo las escrituras simples; si no propuso ni hizo nada y no pregunta un dato, se DELEGA como
//      «pedido» marcado `delegado`, con la respuesta fija;
//   7. DEBUG: sólo en el grupo de SuperAdmin, lo resuelve el código (sin turno); afuera es una PREGUNTA;
//   8. el #30 de Leandro: la pregunta por un arreglo ve lo que salió en producción, y «pídemelo otra vez y lo hago» no sale ante
//      lo que MaKo no puede hacer;
//   9. la llamada con Thiago (docs/promesas/2910-llamada-thiago.md): replicar una landing la hace MaKo (corre la herramienta, deja
//      la pendiente, no delega); pausar/prender y el presupuesto viajan en la ACCIÓN; un pedido compuesto delega lo que no hace.
//
// Probado rompiéndolo (29/10/2026, `roturas-despacho.mjs` del scratchpad, base 7/7; restaurado con .rotura-bak): sin la delegación
// → 6 · la ACCIÓN con todas las escrituras → 6 · sin el chequeo de los números → 5 · el DEBUG sin el deny → 7 · el DEBUG con el turno
// del modelo → 7 · la delegación sin mirar si pregunta un dato → 6 · (el #30) `SIN_HACER` sin mirar `noLoPuedeHacer` → 8 · el bloque
// de pedidos sin lo desplegado → 8 · el turno sin los hitos de los resueltos → 8 · (la llamada con Thiago) replicar_landing fuera
// de las simples → 9 · el presupuesto sin su pantalla → 9 · sin la delegación de lo que falta de un pedido compuesto → 9 · el filtro
// de la ACCIÓN sin `viajaEnLaAccion` → 6. (Las del veredicto, en tests/mako-intencion-ia.test.ts: el TICKET
// principal contestado primero → 2; sin la guarda del «sí» suelto → 2.)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ACCIONES_SIMPLES } from '../lib/despacho-grupo';

type Escena = { r: { engaged?: boolean; skip?: string; reply?: string }; salio: string[]; turno: Array<{ system: string; tools: string[] }>; clasificador: Array<{ modelo: string; clave?: string; mensaje: string }>; reacciones: number; pendientes: Array<{ tipo: string; resumen: string }>; tickets: Array<{ id: number; tipo: string | null; titulo: string; descripcion: string; contexto: { clasificacion?: { clase: string; porque: string; fuente: string } } }> };
let cache: Record<string, Escena> | null = null;
function escena(k: string): Escena {
  if (!cache) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_clase-del-grupo-hijo.ts', import.meta.url))], { encoding: 'utf8', timeout: 400_000 });
    const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@CLASE@@'));
    assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
    cache = JSON.parse(linea.slice('@@CLASE@@'.length));
    assert.equal((cache as { error?: string }).error, undefined, String((cache as { error?: string }).error));
  }
  assert.ok(cache![k], `no corrió la escena ${k}`);
  return cache![k];
}
const ESCRIBEN = /^(crear|mover|cambiar|editar|borrar|eliminar|agendar|pausar|activar|confirmar|cancelar|levantar|proponer|enviar|mandar|cargar|agregar|guardar|actualizar|marcar)_/;
const FIJA = /^Abrí el ticket #(\d+): Arreglar los dos problemas de la automatización 680\. Lo toma el equipo y te aviso por aquí cuando esté\.$/;

test('1. TICKET: lo abre el código, con la respuesta fija, sin turno; lo que sigue se suma', () => {
  const e = escena('ticket');
  assert.equal(e.turno.length, 0, 'el modelo del turno corrió para un ticket');
  assert.equal(e.salio.length, 1);
  assert.match(e.salio[0], FIJA);
  assert.equal(e.tickets.length, 1, 'no quedó el ticket');
  const t = e.tickets[0];
  assert.equal(t.titulo, 'Arreglar los dos problemas de la automatización 680');
  assert.match(t.descripcion, /Lo que escribió en el grupo de WhatsApp, tal cual: «no entiendo eso, solamente soluciona estos problemas porfa»/, 'sin los pasos de la persona');
  assert.equal(t.contexto.clasificacion?.clase, 'TICKET', 'sin la clase en el contexto del ticket');
  assert.equal(t.contexto.clasificacion?.fuente, 'ia');
  assert.equal(String(FIJA.exec(e.salio[0])?.[1]), String(t.id), 'el número lo escribe el código, el del ticket de verdad');
  const s = escena('sumado');
  assert.equal(s.turno.length, 0);
  assert.equal(s.salio[0], `Lo sumé al ticket #${t.id}: El DM de rechazo tampoco sale. Lo toma el equipo y te aviso por aquí cuando esté.`);
  assert.equal(s.tickets.length, 1, 'abrió otro en vez de sumarlo');
});

test('2. CHARLA y NO_REPLY: ni una palabra, y el turno no corre', () => {
  for (const k of ['charla', 'noReply']) {
    const e = escena(k);
    assert.deepEqual([e.salio, e.turno.length], [[], 0], `${k}: ${JSON.stringify(e)}`);
    assert.equal(e.clasificador.length, 1, `${k}: no pasó por el clasificador`);
  }
  assert.equal(escena('charla').r.skip, 'charla: la reacción alcanza');
  assert.equal(escena('noReply').r.engaged, false);
});

test('3. PREGUNTA: sólo lecturas, con su bloque y sin la muletilla; con un reporte, el ticket igual; todo relleno, nada', () => {
  const e = escena('pregunta');
  assert.equal(e.turno.length, 1, 'el turno no corrió');
  assert.match(e.turno[0].system, /ESTE MENSAJE ES UNA PREGUNTA\. Contéstala con lo que devuelven tus herramientas de lectura/);
  assert.deepEqual(e.turno[0].tools.filter((t) => ESCRIBEN.test(t)), [], 'una pregunta recibió herramientas que escriben');
  assert.match(e.turno[0].system, /te hicieron una PREGUNTA/, 'la consulta no fue con su voz corta');
  assert.doesNotMatch(e.turno[0].system, /NO PROMETAS LO QUE NO HACES EN ESTE MISMO MENSAJE/, 'la consulta llevó la voz larga de las acciones');
  assert.deepEqual(e.salio, ['Hoy no entró ningún lead nuevo.']);
  const t = escena('preguntaYTicket');
  assert.equal(t.turno.length, 1);
  assert.match(t.turno[0].system, /el ticket lo abre el código después de tu respuesta/);
  assert.match(t.salio[0], /^Hoy no entró ningún lead nuevo\.\n\nAbrí el ticket #\d+: El botón de pagar no anda\. Lo toma el equipo y te aviso por aquí cuando esté\.$/);
  assert.equal(t.tickets.length, 1);
  const r = escena('relleno');
  assert.deepEqual([r.salio, r.r.skip], [[], 'era todo relleno: la reacción alcanza']);
});

test('4. el clasificador va con el crédito de los grupos y, si se cae, mandan las reglas', () => {
  const e = escena('ticket');
  assert.equal(e.clasificador.length, 1);
  assert.match(e.clasificador[0].clave ?? '', /^sk-ant-api03-credito-cuenta2-/, 'no fue con el crédito de los grupos');
  assert.equal(e.clasificador[0].modelo, 'claude-haiku-4-5', 'el crédito va con Haiku (la regla de Martín del 22/10)');
  assert.match(e.clasificador[0].mensaje, /solamente soluciona estos problemas porfa/);
  const c = escena('caido');
  assert.ok(c.clasificador.length >= 1, 'no intentó clasificar');
  assert.equal(c.turno.length, 1, 'con el clasificador caído el turno no corrió');
  assert.doesNotMatch(c.turno[0].system, /ESTE MENSAJE ES UNA PREGUNTA/, 'con las reglas, el turno de siempre');
  assert.deepEqual(c.salio, ['Hoy entraron 3 leads.']);
});

test('5. una PREGUNTA no afirma un número que no vio: va «no lo vi» y su marca, nunca el número', () => {
  // Rota: sacar el chequeo de `numerosSinFuente` del saneo → sale «Hoy entraron 137 leads».
  const e = escena('inventado');
  assert.equal(e.turno.length, 1);
  assert.equal(e.salio.length, 1, JSON.stringify(e.salio));
  assert.match(e.salio[0], /^Ese dato no lo vi en lo que tengo a mano, así que no te lo doy inventado\./);
  assert.doesNotMatch(e.salio[0], /137|\[\[/, 'salió el número inventado o la marca');
});

test('6. ACCIÓN: sólo las escrituras simples; la pregunta de un dato sale; lo que no hizo se DELEGA como pedido', () => {
  const p = escena('accionPregunta');
  assert.equal(p.turno.length, 1);
  const escriben = p.turno[0].tools.filter((t) => ESCRIBEN.test(t));
  assert.deepEqual(escriben.filter((t) => !ACCIONES_SIMPLES.has(t)), [], 'una ACCIÓN recibió una escritura que no es simple');
  assert.deepEqual(p.salio, ['¿A qué hora la agendo?']);
  assert.equal(p.tickets.length, 0, 'delegó una acción que estaba preguntando un dato');
  // Rota: sacar la delegación → sale «Listo, ya quedó creada…» sin haber hecho nada.
  const d = escena('accionDelegada');
  assert.equal(d.turno.length, 1);
  assert.equal(d.tickets.length, 1, 'no quedó el pedido delegado');
  const t = d.tickets[0];
  assert.deepEqual(d.salio, [`Lo pasé al equipo de MaKo (pedido #${t.id}): Crear una automatización de bienvenida para los leads nuevos. Te aviso por aquí cuando esté.`]);
  assert.equal(t.tipo, 'pedido');
  assert.equal((t.contexto as { delegado?: unknown }).delegado, true, 'sin la marca de delegado: el Runner no lo lleva como «Pedido delegado #N»');
  assert.equal(t.contexto.clasificacion?.clase, 'ACCION');
  assert.match(t.descripcion, /^ACCIÓN DELEGADA: /);
  assert.match(t.descripcion, /«créame una automatización que le dé la bienvenida a los leads nuevos»/);
});

test('8. el #30 de Leandro: una pregunta por un arreglo ve lo que salió en producción, y nunca sale «pídemelo otra vez y lo hago»', () => {
  // Rota: sin `noLoPuedeHacer` en el saneo → «No tengo acceso…\n\nEso no lo llegué a hacer en este mensaje: pídemelo otra vez y lo
  // hago» (lo que salió en producción). Sin `hitosDesplegados` en el turno → el system no trae lo que salió para el #30.
  const e = escena('estadoArreglo');
  assert.equal(e.turno.length, 1);
  const sys = e.turno[0].system;
  assert.match(sys, /- #30 «MaKo no pudo hacer lo que le pidieron, en WhatsApp» — /, 'el pedido resuelto no llegó al turno');
  assert.match(sys, /\n  En producción salió: «MaKo ya no te ofrece hacer lo que no puede/, 'el turno no ve lo que salió en producción para el #30');
  assert.match(sys, /Si te preguntan si algo de éstos YA quedó hecho, arreglado o actualizado/);
  assert.match(sys, /Si te preguntan si algo YA quedó hecho, arreglado o actualizado, contesta con el estado de su pedido/, 'la voz de la consulta no lo dice');
  assert.equal(e.salio.length, 1, JSON.stringify(e.salio));
  assert.match(e.salio[0], /^No tengo acceso directo para editar la documentación de la API desde aquí\./);
  assert.doesNotMatch(e.salio[0], /pídemelo otra vez|lo llegué a hacer|Ya quedó reportado/, 'salió la promesa falsa');
});

test('7. DEBUG: lo resuelve el código en el grupo de SuperAdmin, sin turno; afuera es una PREGUNTA', () => {
  const s = escena('debugSinNegocio');
  assert.equal(s.turno.length, 0, 'el modelo del turno corrió en un DEBUG');
  assert.deepEqual(s.salio, ['¿De qué negocio es? Dime su nombre y lo miro.']);
  const n = escena('debugNegocio');
  assert.equal(n.turno.length, 0);
  assert.equal(n.salio.length, 1);
  // Con la base de mentira no hay negocios: lo dice el código, nunca un consejo genérico del modelo.
  assert.match(n.salio[0], /^(No encontré un negocio que se llame «Leila»\. ¿Cuál es\?|No pude mirar Leila ahora)/);
  const a = escena('debugAfuera');
  assert.equal(a.turno.length, 1, 'afuera del grupo de SuperAdmin, un DEBUG no es un DEBUG');
  assert.deepEqual(a.turno[0].tools.filter((t) => t === 'diagnosticar_negocio' || ESCRIBEN.test(t)), []);
});

test('9. la llamada con Thiago: replicar una landing y las campañas se hacen desde el grupo; un pedido compuesto no pierde una parte', () => {
  // Rota: sacar `replicar_landing` de ACCIONES_SIMPLES (lib/despacho-grupo.ts) → no viaja, el turno no la corre y se DELEGA (lo que
  // rompía lo que Martín mostró: «desde el grupo, lo que quieras»).
  const r = escena('replicarLanding');
  assert.ok(r.turno[0]?.tools.includes('replicar_landing'), `replicar_landing no viajó: ${r.turno[0]?.tools.join(', ')}`);
  assert.equal(r.turno.length, 2, 'el turno no corrió la herramienta (tool_call y respuesta)');
  assert.ok(r.pendientes.some((p) => p.tipo === 'replicar_landing'), 'la réplica no quedó propuesta');
  assert.equal(r.tickets.length, 0, 'se delegó lo que MaKo hace sola');
  assert.deepEqual(r.salio, ['Te dejo la réplica de la landing propuesta: respóndeme «sí» y la armo.']);
  // Pausar o prender, directo; el presupuesto, con su pantalla (/mako/revisar). Las cuatro viajan en la ACCIÓN.
  const c = escena('campanas');
  for (const t of ['proponer_estado_campana', 'proponer_estado_anuncio', 'proponer_presupuesto_campana', 'proponer_presupuesto_conjunto']) {
    assert.ok(c.turno[0]?.tools.includes(t), `${t} no viajó en la ACCIÓN: ${c.turno[0]?.tools.join(', ')}`);
  }
  // Rota: sin `faltaAlgunaParte` en procesarDoer → la automatización se pierde en silencio.
  const k = escena('compuesto');
  assert.equal(k.tickets.length, 1, 'la parte que MaKo no hace no quedó en ningún lado');
  const t = k.tickets[0];
  assert.equal(t.tipo, 'pedido');
  assert.equal((t.contexto as { delegado?: unknown }).delegado, true);
  assert.match(t.titulo, /^Lo que faltó de: replicar la landing https:\/\/ejemplo\.com\/oferta; crear una automatización de bienvenida/);
  assert.match(t.descripcion, /Lo que MaKo YA hizo o dejó propuesto en el grupo \(no lo repitas\): replicar_landing\./);
  assert.deepEqual(k.salio, [`Te dejo la réplica de la landing propuesta.\n\nLo demás que me pediste lo pasé al equipo de MaKo (pedido #${t.id}). Te aviso por aquí cuando esté.`]);
});
