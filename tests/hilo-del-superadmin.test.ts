// =============================================================================
// «No guarda contexto de nada… No funciona como un chat contigo» (11/11/2026, Martín, grupo «MaKo · SuperAdmin»)
// =============================================================================
// EL CASO, en orden (horas de Argentina):
//   20:18 MaKo (un cron): «Comprobante de Código Inmobiliario para revisar… 15.67 USDT, orden 465149562572922880… Si está bien,
//         márcalo con marcar_mensualidad_pagada o marcar_entrada_pagada (con la orden).»
//   20:25 Martín: «Si perfecto, dalo de alta».                                        → MaKo: «¿a quién le doy de alta al CRM?»
//   20:26 Martín: «Y dime cuanto va a pagar codigo inmobiliario el mes entrante…».    → MaKo: «¿qué es "código inmobiliario"?»
// Las causas, medidas en producción (sólo lectura): el aviso nunca entró a la memoria del turno (`enviarAlGrupoSuperAdmin` no la
// escribía; en 7 días, ni un aviso de un cron); aunque entrara, `saneaHistorial` tiraba el turno de MaKo que quedaba primero; el
// aviso no terminaba en pregunta (el «sí» no seguía la oferta) y nombraba herramientas internas; «pagar»/«mensualidad» no eran
// del área de cobros; las que marcan el pago no viajaban en una ACCIÓN (se delegaba); y el turno no sabía qué negocio es Código.
// Lo que fija:
//   1. el texto del aviso: termina en «¿lo marco como pagado?», con la cuenta de la agencia y de cada cliente, sin herramientas;
//      y ningún texto que va a un grupo nombra una herramienta interna;
//   2. las áreas y lo que viaja en una ACCIÓN;
//   3. el bloque de la plataforma (los negocios, las agencias y sus clientes);
//   4. LA ENTRADA REAL con las líneas de esa noche (tests/_hilo-del-superadmin-hijo.ts): el aviso queda en la memoria del negocio de
//      la plataforma, y los dos turnos de Martín lo reciben en el historial, con las herramientas y los negocios;
//   5. el cableado: la memoria del grupo de SuperAdmin, la de `emitirAviso` con `alDueno`, el historial y el mes que viene;
//   6. EL MISMO BUG EN EL GRUPO DE CÓDIGO (11/11, 23:33 UTC): el equipo de MaKo le pidió a Joan por la línea de MaKo —sin pasar por
//      el turno— «¿Me pasan el correo bien escrito?», Joan contestó «ceo@sellersoficial.com» y MaKo: «No entiendo a qué se refiere».
//      El contexto sale del CHAT de la línea (lib/hilo-real.ts): la fusión pura, y la entrada real con esas líneas.
//
// Probado rompiéndolo (12/11/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { avisoDeComprobanteParaRevisar, cuentaDelMes, mesSiguiente, type ClienteDeAgencia } from '../lib/agencia-mes-reglas';
import { areasDelMensaje, makoPreguntoAlgo } from '../lib/mako-intencion';
import { viajaEnLaAccion } from '../lib/despacho-grupo';
import { areasDeLaPlataforma, bloqueDeLaPlataforma } from '../lib/doer-plataforma';
import { conElChatReal, MARCA_DEL_EQUIPO, textoDelMensajeDelChat } from '../lib/hilo-real';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AVISO = avisoDeComprobanteParaRevisar({
  agencia: 'Código Inmobiliario', agenciaWs: 13, porque: 'calza exacto con más de una cosa',
  lectura: 'Binance, 15.67 USDT, orden N.º 465149562572922880, del 11/11.',
  debe: 'mensualidad de noviembre US$125,34 · entrada de Nico Sellers (cuenta 34) US$15,67',
});

test('1. el aviso del comprobante termina en una pregunta y no nombra herramientas; ningún texto a un grupo las nombra', () => {
  assert.match(AVISO, /^Comprobante de Código Inmobiliario \(cuenta 13\) para revisar \(calza exacto con más de una cosa\): Binance, 15\.67 USDT, orden N\.º 465149562572922880/);
  assert.match(AVISO, /entrada de Nico Sellers \(cuenta 34\) US\$15,67\. Si está bien, ¿lo marco como pagado\?$/);
  assert.equal(makoPreguntoAlgo(AVISO), true, 'el aviso no pregunta: el «sí» de Martín no sigue la oferta');
  // Las herramientas del registro (las que tienen un «_», para no confundir palabras sueltas).
  const ids = new Set(readdirSync(new URL('../lib/api-mako/areas/', import.meta.url)).filter((f) => f.endsWith('.def.ts'))
    .flatMap((f) => [...leer(`lib/api-mako/areas/${f}`).matchAll(/\bid: '([a-z][a-z0-9]*_[a-z0-9_]+)'/g)].map((m) => m[1])));
  assert.ok(ids.size > 300, `leí ${ids.size} herramientas`);
  assert.deepEqual([...AVISO.matchAll(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g)].map((m) => m[0]).filter((w) => ids.has(w)), [], 'el aviso nombra una herramienta');
  // Y ninguna llamada que manda un texto a un grupo lo arma con el nombre de una herramienta.
  const malas: string[] = [];
  const llamada = /(avisarAMartin|enviarAlGrupoSuperAdmin|enviarAlGrupoMaKo|textoAlGrupoDeLaAgencia)\(([^\n]*)/g;
  for (const f of readdirSync(new URL('../lib/', import.meta.url), { recursive: true }).map(String).filter((x) => x.endsWith('.ts'))) {
    const src = sinComentarios(leer(`lib/${f.replace(/\\/g, '/')}`));
    for (const m of src.matchAll(llamada)) for (const w of m[2].match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g) ?? []) if (ids.has(w)) malas.push(`${f}: ${w}`);
  }
  assert.deepEqual(malas, [], 'un aviso a un grupo nombra una herramienta interna');
});

test('2. «pagar», «mensualidad» y el comprobante son de cobros; marcar el pago viaja en una ACCIÓN', () => {
  // «pagar» no es cobros en todas partes (son las cuotas de un lead, tests/api-mako-cobros.test.ts): lo suma la plataforma al nombrar el negocio.
  assert.deepEqual(areasDelMensaje('Y dime cuanto va a pagar codigo inmobiliario el mes entrante con todos los clientes'), []);
  const negocios = [{ ws: 9, nombre: 'MaKo', capa: 'superadmin' }, { ws: 13, nombre: 'Código Inmobiliario', capa: 'agencia' }];
  assert.deepEqual(areasDeLaPlataforma('Y dime cuanto va a pagar codigo inmobiliario el mes entrante con todos los clientes', negocios), ['cs', 'cobros']);
  assert.deepEqual(areasDeLaPlataforma('¿cómo está Código Inmobiliario?', negocios), ['cs']);
  assert.deepEqual(areasDeLaPlataforma('¿cuánto le falta pagar a Ana de sus pagos?', negocios), [], 'sin nombrar un negocio no suma nada');
  assert.ok(areasDelMensaje(AVISO).includes('cobros'), 'el aviso no lleva al área de cobros');
  assert.deepEqual(areasDelMensaje('la página de ventas'), ['landing'], '«página» se volvió cobros');
  assert.ok(viajaEnLaAccion('marcar_entrada_pagada') && viajaEnLaAccion('marcar_mensualidad_pagada'), 'marcar el pago se delega en vez de proponerse');
});

test('3. el bloque de la plataforma: los negocios, las agencias y sus clientes; la herramienta sólo si viaja', () => {
  const negocios = [{ ws: 9, nombre: 'MaKo', capa: 'superadmin' }, { ws: 13, nombre: 'Código Inmobiliario', capa: 'agencia' }, { ws: 34, nombre: 'Nico Sellers', capa: 'cliente' },
    { ws: 33, nombre: 'Marcela', capa: 'cliente' }, { ws: 10, nombre: 'Leila', capa: 'cliente' }, { ws: 35, nombre: 'Se fue', capa: 'cliente' }];
  const cartera = [{ agencia_ws: 13, cliente_ws: 34, estado: 'aprobado' }, { agencia_ws: 13, cliente_ws: 33, estado: 'pendiente' }, { agencia_ws: 13, cliente_ws: 35, estado: 'revocado' }];
  const b = bloqueDeLaPlataforma(negocios, cartera, { conMensualidades: true });
  assert.match(b, /· 13 Código Inmobiliario — AGENCIA; sus clientes: 33 Marcela, 34 Nico Sellers\n/);
  assert.match(b, /· 10 Leila\n/);
  assert.match(b, /· 35 Se fue/, 'un cliente que se fue de la agencia desapareció de la lista');
  assert.doesNotMatch(b, /· 9 MaKo/, 'la plataforma se lista como negocio');
  assert.match(b, /no una campaña ni un lead: no preguntes qué es/);
  assert.match(b, /ver_mensualidades_agencias/);
  assert.doesNotMatch(bloqueDeLaPlataforma(negocios, cartera, { conMensualidades: false }), /ver_mensualidades_agencias/, 'nombra una herramienta que no viajó');
  assert.equal(bloqueDeLaPlataforma([], []), '');
});

test('4. la entrada real: el aviso queda en la memoria y los dos turnos de Martín lo ven, con las herramientas y los negocios', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_hilo-del-superadmin-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@HILO@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const o = JSON.parse(linea.slice('@@HILO@@'.length));
  assert.equal(o.error, undefined, String(o.error));
  // 20:18: el aviso queda como turno de MaKo, en el negocio de la plataforma (el que lee el turno de ese grupo).
  assert.deepEqual(o.aviso.enLaMemoria.map((f: { ws: number; jid: string; role: string }) => [f.ws, f.jid, f.role]), [[9, '120363413270045136@g.us', 'assistant']], 'el aviso del cron no quedó en la memoria del grupo');
  // 20:25: «Si perfecto, dalo de alta» — con el aviso en el historial y lo que marca el pago.
  const si = o.siDalo.alTurno[0];
  assert.ok(si, `el «sí» no llegó al turno: ${JSON.stringify(o.siDalo.r)}`);
  assert.match(si.mensajes, /Comprobante de Código Inmobiliario \(cuenta 13\) para revisar[\s\S]*¿lo marco como pagado\?[\s\S]*Si perfecto, dalo de alta/, 'el turno del «sí» no vio el aviso');
  for (const t of ['marcar_entrada_pagada', 'marcar_mensualidad_pagada', 'ver_mensualidades_agencias']) assert.ok(si.tools.includes(t), `el «sí» no trae ${t}: ${si.tools.join(', ')}`);
  assert.match(o.siDalo.clases[0], /reglas: actuar/, 'el «sí» no sigue lo que MaKo ofreció');
  assert.deepEqual(o.siDalo.salio, ['¿Marco pagada la entrada de Nico Sellers, US$15,67, con la orden 465149562572922880?'], 'se delegó o no salió');
  // 20:26: «cuánto va a pagar Código el mes entrante» — sabe qué es Código y tiene de dónde sacarlo.
  const cuanto = o.cuantoPaga.alTurno[0];
  assert.ok(cuanto, `la pregunta no llegó al turno: ${JSON.stringify(o.cuantoPaga.r)}`);
  assert.ok(cuanto.tools.includes('ver_mensualidades_agencias'), `la pregunta no trae ver_mensualidades_agencias: ${cuanto.tools.join(', ')}`);
  assert.match(cuanto.system, /· 13 Código Inmobiliario — AGENCIA; sus clientes: 31 Giselle, 32 Pablo Chavez, 33 Marcela, 34 Nico Sellers/);
  assert.match(cuanto.mensajes, /Comprobante de Código Inmobiliario[\s\S]*Si perfecto, dalo de alta[\s\S]*¿Marco pagada la entrada de Nico Sellers/, 'la charla de antes no llegó a la pregunta');
  // El aviso está en la memoria Y en el chat de la línea (con el mismo id): una sola vez en el historial.
  assert.equal((si.mensajes.match(/¿lo marco como pagado\?/g) ?? []).length, 1, 'el aviso se repitió en el historial');
  // La memoria queda como un chat: el aviso, Martín, MaKo, Martín, MaKo (y después lo de Código, en su grupo).
  assert.deepEqual(o.memoriaFinal.filter((f: { ws: number }) => f.ws === 9).map((f: { role: string }) => f.role), ['assistant', 'user', 'assistant', 'user', 'assistant']);
  // 23:33 UTC, Código: el turno del correo de Joan ve lo que el equipo le pidió por la línea de MaKo, justo antes, y lo firmado va
  // marcado como del equipo. Su propio mensaje no se repite como contexto.
  const joan = o.correoDeJoan.alTurno[0];
  assert.ok(joan, `el correo de Joan no llegó al turno: ${JSON.stringify(o.correoDeJoan.r)}`);
  assert.match(joan.mensajes, /\[Equipo de MaKo\] Listo: entró el pago de la entrada de Sellers[\s\S]*¿Me pasan el correo bien escrito\?[\s\S]*\nuser: ceo@sellersoficial\.com$/, 'el turno de Joan no vio lo que le pidió el equipo');
  assert.equal((joan.mensajes.match(/ceo@sellersoficial\.com(?!\S)/g) ?? []).length, 1, 'el mensaje de Joan entró también como contexto');
  // Código (ws13) arranca con la conversación del módulo común (lib/conversacion.ts): lo del equipo entra como user, nunca como MaKo.
  assert.match(joan.mensajes, /user: \[Equipo de MaKo\] Listo: entró el pago/, 'Código no arma el turno con el módulo común');
});

test('6. la fusión con el chat de la línea: lo que la memoria no tiene, en orden, sin repetir, lo del equipo marcado', () => {
  const ahora = Date.parse('2026-11-11T23:33:30Z');
  const S = (iso: string) => Math.floor(Date.parse(iso) / 1000);
  const J = '120363429866357487@g.us';
  const memoria = [
    { role: 'assistant' as const, content: '🎯 *Nuevo agendado*: Romina Prus reservó su 1ª reunión', created_at: '2026-11-11T23:15:07Z', wa_message_id: '3EB0DD8CBB4C4038C1599F' },
    { role: 'user' as const, content: 'Juanfran: Nico sellers', created_at: '2026-11-11T23:16:20Z', wa_message_id: null },
    { role: 'assistant' as const, content: 'Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.\n\nCuando entre, te aviso.', created_at: '2026-11-11T23:18:07Z', wa_message_id: null },
  ];
  const chat = [
    { key: { id: '3EB0DD8CBB4C4038C1599F', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:15:06Z'), message: { conversation: '🎯 *Nuevo agendado*: Romina Prus reservó su 1ª reunión' } }, // ya está, por id
    { key: { id: 'A1', fromMe: false, remoteJid: J }, pushName: 'Juan Francisco', messageTimestamp: S('2026-11-11T23:16:13Z'), message: { conversation: 'Nico sellers' } }, // ya está: el lote
    { key: { id: 'R1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:16:15Z'), messageType: 'reactionMessage', message: { reactionMessage: { text: '👍' } } }, // un 👍 no es contexto
    { key: { id: 'P1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:18:06Z'), message: { conversation: 'Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.' } }, // una parte del turno guardado
    { key: { id: 'D1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:29:20Z'), messageType: 'documentMessage', message: { documentMessage: { fileName: 'Recibo-0004.pdf' } } },
    { key: { id: 'E1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:32:15Z'), message: { conversation: 'Listo: entró el pago de Sellers.' } }, // del equipo, por su id en el anillo
    { key: { id: 'T1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-11T23:33:01Z'), message: { conversation: '¿Me pasan el correo bien escrito?' } }, // a mano, sin firma
    { key: { id: 'V1', fromMe: true, remoteJid: J }, messageTimestamp: S('2026-11-10T08:00:00Z'), message: { conversation: 'de ayer a la mañana' } }, // fuera de la ventana
    { key: { id: 'J1', fromMe: false, remoteJid: J }, pushName: 'Joan Dowd', messageTimestamp: S('2026-11-11T23:33:19Z'), message: { conversation: 'ceo@sellersoficial.com' } }, // el que se atiende
  ];
  const h = conElChatReal(memoria, chat, { ahoraMs: ahora, idActual: 'J1', textoActual: 'ceo@sellersoficial.com', idsDelEquipo: new Set(['E1']) });
  assert.deepEqual(h.map((x) => `${x.role}: ${x.content.split('\n')[0]}`), [
    'assistant: 🎯 *Nuevo agendado*: Romina Prus reservó su 1ª reunión',
    'user: Juanfran: Nico sellers',
    'assistant: Recibí tu comprobante. Lo revisa el equipo de MaKo y te confirmo por aquí.',
    'assistant: [documento] Recibo-0004.pdf',
    `assistant: ${MARCA_DEL_EQUIPO}Listo: entró el pago de Sellers.`,
    'assistant: ¿Me pasan el correo bien escrito?',
  ]);
  // Sin la línea (el store no contestó), el turno sigue con su memoria: eso lo decide quien llama. Con el chat vacío, la memoria tal cual.
  assert.deepEqual(conElChatReal(memoria, [], { ahoraMs: ahora }).map((x) => x.content), memoria.map((x) => x.content));
  // Firmado por el equipo, aunque no esté en el anillo.
  assert.equal(conElChatReal([], [{ key: { id: 'F', fromMe: true }, messageTimestamp: S('2026-11-11T23:30:00Z'), message: { conversation: 'Ya quedó.\n\n— Equipo de MaKo' } }], { ahoraMs: ahora })[0].content.startsWith(MARCA_DEL_EQUIPO), true);
  assert.equal(textoDelMensajeDelChat({ messageType: 'audioMessage', message: { audioMessage: {} } }), '[audio]');
  assert.equal(textoDelMensajeDelChat({ message: { imageMessage: { caption: 'el comprobante' } } }), '[foto] el comprobante');
  // Y en el turno, lo del equipo no es la oferta de MaKo que un «sí» acepta.
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /const ultimoDeMako = conversacion \? conversacion\.ultimoDeMaKo\n\s*: historial\.slice\(-2\)\.reverse\(\)\.find\(\(r\) => r\.role === 'assistant' && !esDelEquipoEnElHilo\(r\.content\)\)/);
  assert.match(doer, /const conversacion = hayInvitado \|\| !\(await conversacionPrendida\(wsData\)/, 'un invitado lee la conversación del negocio');
  assert.match(doer, /const chatReal = hayInvitado \|\| conversacion \? null : await chatDelGrupo\(instance, jid\)\.catch\(\(\) => null\);/, 'un invitado lee el chat del negocio');
  assert.match(doer, /preguntaDelEquipo: preguntaDelEquipoEn\(historial\)/, 'la pregunta del equipo no llega al clasificador');
});

test('5. el cableado: la memoria del SuperAdmin, la del aviso al dueño, el historial y el mes que viene', () => {
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  assert.match(grupo, /if \(r\.ok && !o\.sinMemoria\) await anotarEnLaMemoriaDelSuperAdmin\(jid, texto, r\.id\);/, 'lo que sale al grupo de SuperAdmin no queda en la memoria');
  assert.match(grupo, /await guardarTurno\(ws, clave, 'assistant', texto,/);
  const avisos = sinComentarios(leer('lib/avisos.ts'));
  assert.match(avisos, /enviarAlGrupoSuperAdmin\(texto, \{ sinCopia: true, sinMemoria: true \}\)/, 'el aviso al dueño queda dos veces');
  assert.match(avisos, /guardarTurno\(a\.alDueno === true \? wsLector : ws, jid, 'assistant', textoTurno, idDelTurno\)/, 'el aviso al dueño queda en el negocio del cliente, donde no lo lee nadie');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const sanea = doer.slice(doer.indexOf('function saneaHistorial('), doer.indexOf('function saneaHistorial(') + 600);
  assert.doesNotMatch(sanea, /!out\.length && t\.role !== 'user'/, 'el historial vuelve a tirar lo que dijo MaKo al principio');
  assert.match(doer, /const laPlataforma = esElGrupoDeLaPlataforma && !hayInvitado \? await leerLaPlataforma\(\) : null;/);
  // El paso 2: en el privado, lo que termina en charla o en «no es para MaKo» también queda en la memoria (un «sí» que sólo tuvo 👍).
  assert.match(doer, /if \(!esGrupo && !hayInvitado\) await guardarTurno\(wsData, jid, 'user', sinPrefijoDeLote\(texto\), msgId \|\| undefined\)/);
  assert.match(doer, /if \(intencion\.intencion === 'no_reply' && !saludoDelChat\) \{ await guardarLoQueNoSeContesta\(\);/, 'lo que no es para MaKo no queda en el privado');
  assert.match(doer, /if \(intencion\.intencion === 'charlar' && !saludoDelChat\) \{ await guardarLoQueNoSeContesta\(\);/, 'la charla no queda en el privado');
  const mes = sinComentarios(leer('lib/agencia-mes.ts'));
  // El que viene desde HOY: con la mensualidad prendida desde diciembre, `actual` ya es diciembre, y desde `actual` daba enero.
  assert.match(mes, /const siguiente = armar\(mesSiguiente\(mesHoy\)\);/, 'el mes que viene se cuenta desde `actual`');
  assert.match(mes, /mes_que_viene: m\.siguiente \? \{/);
});

test('7. «¿cuánto paga Código el mes que viene?», con el dato real del 11/11: diciembre, US$426 (US$473 si Pablo pagara)', () => {
  // Medido en producción (sólo lectura, `mensualidadDeAgencia(13)`, 12/11/2026): la mensualidad prendida desde diciembre; Pro de la
  // agencia (97) y 7 clientes en Esencial (47): Brigitte, Giselle, Marcela, Natalia, Patricia, Sellers y Sergio. Pablo Chavez, en pausa
  // por su entrada («paga para entrar»): no cuenta. Es el mismo número que da Planes y cobros.
  const c = (ws: number, nombre: string, x: Partial<ClienteDeAgencia> = {}): ClienteDeAgencia => ({
    ws, nombre, estado: 'aprobado', invitado: '2026-10-20', corregido: null, baja: null, plan: 'esencial',
    entrada: { desde: '2026-11-01', pagadoEl: '2026-11-01', montoUsd: 47 }, ...x,
  });
  const clientes = [c(31, 'Brigitte Eberlin'), c(32, 'Giselle Belanti'), c(33, 'Marcela Fernandez'), c(34, 'Natalia'), c(35, 'Patricia Contreras'), c(36, 'Sellers'), c(37, 'Sergio Arriata'),
    c(38, 'Pablo Chavez', { entrada: null, fueraPorEntrada: true })];
  const cuenta = (cs: readonly ClienteDeAgencia[]) => cuentaDelMes({ mes: mesSiguiente('2026-11'), primerMes: '2026-12', planAgencia: 'pro', clientes: cs, precios: { esencial: 47, pro: 97 }, hoy: '2026-11-11', entradasDesde: '2026-11-01' });
  assert.equal(mesSiguiente('2026-11'), '2026-12');
  const dic = cuenta(clientes);
  assert.equal(dic?.mes, '2026-12');
  assert.equal(dic?.totalUsd, 426, 'el mes que viene no da lo de Planes y cobros');
  assert.ok(!dic?.lineas.some((l) => l.tipo !== 'agencia' && l.nombre === 'Pablo Chavez'), 'Pablo, en pausa, entró a la cuenta');
  assert.equal(cuenta(clientes.map((x) => (x.ws === 38 ? c(38, 'Pablo Chavez') : x)))?.totalUsd, 473, 'con Pablo al día no suma su mes');
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   H1 `enviarAlGrupoSuperAdmin` sin la memoria                                         → fallan el 4 y el 5
//   H2 `saneaHistorial` vuelve a tirar lo de MaKo al principio                           → fallan el 4 y el 5
//   H3 el aviso de antes (sin «?», con las herramientas)                                 → fallan el 1 y el 4
//   H4 cobros sin «pagar», «mensualidad» ni «comprobante»                                → fallan el 2 y el 4
//   H5 marcar el pago fuera de lo que viaja en una ACCIÓN                                → fallan el 2 y el 4
//   H6 el turno sin el bloque de la plataforma                                           → fallan el 4 y el 5
//   H7 el aviso al dueño otra vez en el negocio del cliente                              → falla el 5
//   H8 el turno sin el chat de la línea (sólo la memoria)                                → fallan el 4 y el 6
//   H9 la fusión sin mirar el id (lo de la memoria se repite)                             → fallan el 4 y el 6
//   H10 `ultimoDeMako` toma lo del equipo como una oferta de MaKo                        → fallan el 5 y el 6
//   H11 el mes que viene contado desde `actual` (con la mensualidad desde diciembre daba enero) → falla el 5
