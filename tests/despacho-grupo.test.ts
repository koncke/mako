// =============================================================================
// MaKo en el grupo es un DESPACHANTE (29/10/2026, lib/despacho-grupo.ts) — las piezas puras, sin red ni base
// =============================================================================
// Martín, 29/10/2026: «Si al fin y al cabo sólo tiene que DELEGAR todo… A menos que sea una tarea muy simple, como cambiar algo del CRM,
// agendar una reu o algo así, que lo haga directamente». Lo que fija este archivo (la entrada real, en tests/clase-del-grupo.test.ts):
//   1. la lista de escrituras SIMPLES es cerrada y cada nombre es una herramienta de verdad (un nombre mal escrito la achica callado);
//   2. cuándo se delega: sin proponer ni hacer nada y sin preguntar un dato; la respuesta la escribe el código;
//   3. el DEBUG: qué dice MaKo según lo que leyó `diagnosticar_negocio`, y los 2 o 3 hechos que nombra;
//   4. una consulta no afirma un número que no vio (`numerosSinFuente`), sin marcar las horas, las fechas ni los teléfonos reescritos;
//   5. el «listo» de un pedido delegado dice QUÉ quedó hecho; el texto al Cerebro es el MISMO en el cartero y en el servidor;
//   6. un pedido delegado del ws1 lo dice en su ticket.
//
// Probado rompiéndolo (29/10/2026, `roturas-despacho.mjs` del scratchpad, base verde; restaurado con .rotura-bak): la delegación sin
// mirar si pregunta un dato → 2 · la delegación sin la red de la lectura → 2 · los teléfonos sin los últimos 8 dígitos → 4 · el
// «listo» del delegado como el de un ticket → 5 · el cartero sin reconocer su aviso de delegado → 5 · (el #30) `SIN_HACER` sin mirar
// `noLoPuedeHacer` → 7 · el bloque de pedidos sin lo que salió en producción → 8.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCIONES_CON_PANTALLA, ACCIONES_SIMPLES, MIN_SIN_TOMAR, WS_CON_CUIDADO, delegaLaAccion, delegadosParaAvisar, esAccionSimple, faltaAlgunaParte,
  lineaApruebaEnLaApp, lineaDeLoQueFalta, negocioLeido, preguntaUnDato, respuestaDeLaDelegacion, respuestaDelDebug, textoDelegadoSinTomar,
  viajaEnLaAccion, type DelegadoSinTomar,
} from '../lib/despacho-grupo';
import { rechazoSiNoEsConfirmacionPura } from '../lib/confirmacion-pura';
import { leerClase } from '../lib/mako-intencion-ia';
import { hechosDelDiagnostico } from '../lib/diagnostico-negocio';
import { numerosSinFuente, noLoPuedeHacer, sanearSalida, SIN_HACER, SIN_HACER_SIN_PROMESA } from '../lib/doer-salida';
import { hitosDeLosTickets, textoDelAviso, sanearContexto } from '../lib/tickets-reglas';
import { bloqueDePedidos } from '../lib/pedidos-del-negocio';
import { mensajePedidoDelegado, mensajeTicketNuevo } from '../lib/tickets-aviso';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. las escrituras SIMPLES: una lista cerrada, y cada una es una herramienta de verdad', () => {
  // Por el código fuente: el registro (`id: '…'` en lib/api-mako/areas/*.def.ts) o las acciones del doer (`name: '…'`). Importarlos
  // no se puede acá: lib/mako-doer-acciones.ts es `server-only` y tests-afectados corre sin `--conditions=react-server`.
  const dir = 'lib/api-mako/areas';
  const defs = readdirSync(join(RAIZ, dir)).filter((f) => f.endsWith('.def.ts')).map((f) => leer(`${dir}/${f}`)).join('\n');
  const acciones = leer('lib/mako-doer-acciones.ts');
  const fantasmas = [...ACCIONES_SIMPLES].filter((n) => !defs.includes(`id: '${n}'`) && !acciones.includes(`name: '${n}'`));
  assert.deepEqual(fantasmas, [], 'nombres que no son ninguna herramienta (la lista se achica callada)');
  // Lo que mueve plata, cancela o toca varias cosas NO es simple: se delega.
  for (const n of ['crear_link_pago', 'reembolsar_pago', 'dar_de_baja', 'crear_automatizacion', 'pausar_campana', 'borrar_lead']) assert.ok(!esAccionSimple(n), `${n} no es simple`);
  assert.ok(esAccionSimple('agregar_nota_lead') && esAccionSimple('proponer_agendar_reunion'));
});

test('2. se delega sin proponer ni hacer nada y sin preguntar un dato; el número lo escribe el código', () => {
  // Rota: `delegaLaAccion` sin mirar `preguntaUnDato` → la acción que pide la hora se delega.
  assert.ok(delegaLaAccion({ propuso: false, escribio: false, respuesta: 'Listo, ya quedó creada la automatización.' }));
  assert.ok(!delegaLaAccion({ propuso: true, escribio: false, respuesta: 'Te dejo la nota para confirmar.' }));
  assert.ok(!delegaLaAccion({ propuso: false, escribio: true, respuesta: 'Listo, le agregué la nota.' }));
  assert.ok(!delegaLaAccion({ propuso: false, escribio: false, respuesta: 'Encontré dos Juan.\n¿Cuál es, Juan Pérez o Juan Gómez?' }));
  // Un pedido de datos tomado por acción (conv:1563): leyó y contestó la lista, sin decir que algo quedó hecho. No se delega.
  assert.ok(!delegaLaAccion({ propuso: false, escribio: false, respuesta: 'Las 4 reuniones de hoy, con su teléfono: …', leyo: true, afirmaHecho: false }));
  // Leyó, pero dice que quedó hecho algo que no hizo: se delega.
  assert.ok(delegaLaAccion({ propuso: false, escribio: false, respuesta: 'Listo, ya quedó creada la automatización.', leyo: true, afirmaHecho: true }));
  assert.ok(preguntaUnDato('¿A qué hora la agendo?'));
  assert.ok(!preguntaUnDato('Ya quedó. ¿Algo más? Listo.'));
  assert.equal(respuestaDeLaDelegacion(41, 'Crear la automatización de bienvenida. '), 'Lo pasé al equipo de MaKo (pedido #41): Crear la automatización de bienvenida. Te aviso por aquí cuando esté.');
  assert.equal(respuestaDeLaDelegacion(41, ''), 'Lo pasé al equipo de MaKo (pedido #41). Te aviso por aquí cuando esté.');
});

const LEIDO = {
  negocio: { ws: 11, nombre: 'Leila Fittipaldi | Metacoach', plan: 'pro' },
  integraciones: { integraciones: [{ nombre: 'Fathom', estado: 'falta' }, { nombre: 'Google Calendar', estado: 'ok' }, { nombre: 'Zernio', estado: 'falta' }] },
  meta: { via: 'conexion_anterior', error: null },
  errores_7_dias: [{ titulo: 'No se pudo conectar Facebook', veces: 3 }],
};

test('3. el DEBUG: sin negocio lo pregunta, con varios nombra los candidatos, encontrado da el ticket y los hechos', () => {
  assert.equal(respuestaDelDebug({ pedido: '', leido: null, crudo: '', hechos: [] }), '¿De qué negocio es? Dime su nombre y lo miro.');
  assert.equal(
    respuestaDelDebug({ pedido: 'Juan', leido: { encontrado: false, candidatos: [{ ws: 4, nombre: 'Juan Pérez' }, { ws: 7, nombre: 'Juan Gómez' }] }, crudo: '', hechos: [] }),
    '«Juan» calza con más de un negocio: Juan Pérez (4), Juan Gómez (7). ¿Cuál es?',
  );
  assert.equal(respuestaDelDebug({ pedido: 'Pepe', leido: { encontrado: false, negocios: [] }, crudo: '', hechos: [] }), 'No encontré un negocio que se llame «Pepe». ¿Cuál es?');
  assert.equal(respuestaDelDebug({ pedido: 'Leila', leido: null, crudo: 'Diagnosticar otro negocio es sólo de la plataforma.', hechos: [] }), 'No pude mirar Leila ahora (Diagnosticar otro negocio es sólo de la plataforma.).');
  const hechos = hechosDelDiagnostico(LEIDO);
  assert.deepEqual(hechos, [
    'Meta con la conexión anterior (el token), no por Facebook/Zernio',
    'le falta conectar: Fathom, Zernio',
    '1 error de la app en 7 días (el último: «No se pudo conectar Facebook»)',
  ]);
  assert.equal(negocioLeido(LEIDO), 'Leila Fittipaldi | Metacoach');
  assert.equal(negocioLeido({ encontrado: false, candidatos: [] }), null);
  assert.equal(
    respuestaDelDebug({ pedido: 'Leila', leido: LEIDO, crudo: JSON.stringify(LEIDO), hechos, ticket: 52 }),
    'Lo pasé al Cerebro (ticket #52) con lo que veo de Leila Fittipaldi | Metacoach: Meta con la conexión anterior (el token), no por Facebook/Zernio; le falta conectar: Fathom, Zernio; 1 error de la app en 7 días (el último: «No se pudo conectar Facebook»).',
  );
  assert.match(respuestaDelDebug({ pedido: 'Leila', leido: LEIDO, crudo: '', hechos, ticket: null }), /^Miré Leila Fittipaldi \| Metacoach: .*\. No pude abrir el ticket ahora: pásaselo al Cerebro a mano\.$/);
  // Sin datos, ningún hecho inventado.
  assert.deepEqual(hechosDelDiagnostico({ negocio: { nombre: 'X' } }), []);
  assert.deepEqual(hechosDelDiagnostico(null), []);
});

test('4. una consulta no afirma un número que no vio; las horas, las fechas y los teléfonos reescritos no cuentan', () => {
  // Rota: comparar los teléfonos sin sus últimos 8 dígitos → «+54 11 2345-6789» sale como inventado (el caso 1563 del banco).
  assert.deepEqual(numerosSinFuente('Entraron 12 leads hoy.', ['{"total":12}']), []);
  assert.deepEqual(numerosSinFuente('Entraron 137 leads hoy.', ['{"total":12}']), ['137']);
  assert.deepEqual(numerosSinFuente('Cobraste $1.500 y $4235.', ['{"monto":1500}']), ['4235']);
  assert.deepEqual(numerosSinFuente('La reunión es a las 13:00 del 29/10.', ['{"inicio":"2026-10-29T16:00:00Z"}']), []);
  assert.deepEqual(numerosSinFuente('Su teléfono es +54 11 2345-6789.', ['{"tel":"5491123456789"}']), []);
  assert.deepEqual(numerosSinFuente('Su teléfono es +54 11 9999-6789.', ['{"tel":"5491123456789"}']), ['54', '11', '9999-6789']);
  assert.deepEqual(numerosSinFuente('Lo pasé al equipo (pedido #44) y quedó el ticket #12.', []), []);
  assert.deepEqual(numerosSinFuente('1. uno\n2. dos\n[[no-pude: 99 cosas]]', []), []);
  assert.deepEqual(numerosSinFuente('El 09 de noviembre.', ['vence el 9/11']), []);
});

test('5. el «listo» del pedido delegado dice QUÉ quedó hecho; el texto al Cerebro es el mismo en los dos lados', async () => {
  // Rota: `textoDelAviso` sin mirar `delegado` → «Listo: tu ticket #8 («…») está resuelto.».
  const base = { id: 8, titulo: 'Crear la automatización de bienvenida', estado: 'resuelto', duplicado_de: null };
  assert.equal(textoDelAviso({ ...base, respuesta: 'Quedó la automatización de bienvenida → https://hola-mako.com/chatbot/81', contexto: { delegado: true } }),
    'Listo: Quedó la automatización de bienvenida → https://hola-mako.com/chatbot/81');
  assert.equal(textoDelAviso({ ...base, respuesta: null, contexto: { delegado: true } }), 'Listo: ya quedó lo que pediste (pedido #8).');
  assert.equal(textoDelAviso({ ...base, respuesta: null, contexto: {} }), 'Listo: tu ticket #8 («Crear la automatización de bienvenida») está resuelto.');
  // La marca sobrevive al saneo del contexto, y sólo `true`.
  assert.equal(sanearContexto({ delegado: true }).delegado, true);
  assert.equal(sanearContexto({ delegado: 'true' }).delegado, undefined);
  // El cartero (1.24.0) y el servidor dicen lo mismo, y es distinto del de un ticket.
  const cartero = await import('../scripts/operaciones/cartero.mjs');
  for (const [n, repo] of [[1, '/repo'], [987654, '/otro/clon']] as const) {
    assert.equal(cartero.mensajePedidoDelegado(n, repo), mensajePedidoDelegado(n, repo), `el pedido #${n} difiere entre los dos lados`);
    assert.match(mensajePedidoDelegado(n, repo), new RegExp(`^Pedido delegado #${n}: `));
    assert.notEqual(mensajePedidoDelegado(n, repo).split('\n')[0], mensajeTicketNuevo(n, repo).split('\n')[0]);
    assert.ok(cartero.esAvisoDeDelegado(mensajePedidoDelegado(n, repo)), 'el aviso se subiría como lo que dijo un chat');
  }
  for (const malo of [0, -3, 2.5, Number.NaN, 2e9, '12']) {
    assert.throws(() => cartero.mensajePedidoDelegado(malo, '/r'), `el cartero acepta ${String(malo)}`);
    assert.throws(() => mensajePedidoDelegado(malo as number, '/r'), `el servidor acepta ${String(malo)}`);
  }
});

test('6. el pedido delegado del ws1 lo dice en su ticket; el Runner lo marca por su contexto', () => {
  assert.equal(WS_CON_CUIDADO, 1);
  const g = sinComentarios(leer('lib/tickets-del-grupo.ts'));
  assert.match(g, /t\.ws === WS_CON_CUIDADO \? '⚠️ Es del ws1 \(Mauricio\): se ejecuta con el cuidado del ws1\.'/);
  assert.match(g, /tipo: t\.delegado \? 'pedido' : null/);
  assert.match(g, /\.\.\.\(t\.delegado \? \{ delegado: true \} : \{\}\)/);
  const r = sinComentarios(leer('lib/tickets-runner.ts'));
  // Los dos lados del Runner (los bugs y los nuevos) leen el contexto y pasan la marca.
  assert.equal(r.split("...(esDelegado(f.contexto) ? { delegado: true as const } : {})").length - 1, 2);
  assert.match(r, /select\('id, estado, despacho, aviso_id, aviso_estado, aviso_at, aviso_intentos, triage, contexto'\)/);
  assert.match(r, /select\('id, estado, despacho, cerebro_id, cerebro_estado, cerebro_at, cerebro_intentos, contexto'\)/);
});

test('7. el #30 de Leandro: «pídemelo otra vez y lo hago» nunca ante lo que MaKo no puede hacer', () => {
  // Rota: sin `noLoPuedeHacer` en `sanearSalida` → «No tengo acceso…\n\nEso no lo llegué a hacer en este mensaje: pídemelo otra vez
  // y lo hago» (lo que salió en producción el 29/10 a las 20:17).
  const grupo = { corrioHerramientas: false, finDeTurno: true, enElGrupo: { respaldado: false, propuesto: false, leyo: false } };
  const real = 'No tengo acceso directo para editar la documentación de la API desde aquí. Ya quedó reportado al equipo de desarrollo para que actualicen los detalles de las palabras clave y los botones.';
  const s = sanearSalida(real, grupo);
  assert.equal(s.texto, 'No tengo acceso directo para editar la documentación de la API desde aquí.');
  assert.ok(s.sinRespaldo?.length, 'el «ya quedó reportado» falso no se sacó');
  // Una promesa en la misma oración que el «no puedo», y no queda nada: la línea que no promete.
  assert.equal(sanearSalida('No puedo editar eso desde aquí, déjame ver y te aviso.', { corrioHerramientas: false }).texto, SIN_HACER_SIN_PROMESA);
  assert.equal(sanearSalida('No tengo acceso a eso. Déjame ver y te aviso.', { corrioHerramientas: false }).texto, 'No tengo acceso a eso.');
  // Reportarlo al equipo SÍ lo hace MaKo (es abrir el ticket): el «He reportado el error al equipo» de Leila sigue con la verdad de
  // siempre (tests/doer-hecho-grupo.test.ts lo cazó cuando la primera versión también lo tapaba).
  assert.equal(sanearSalida('Ya quedó reportado al equipo de desarrollo.', grupo).texto, SIN_HACER);
  // Una promesa sin herramientas, con «no puedo» al lado: tampoco.
  const p = sanearSalida('Eso no puedo editarlo desde aquí. Déjame ver con el equipo técnico y te aviso.', { corrioHerramientas: false });
  assert.doesNotMatch(p.texto, /pídemelo/);
  // Lo que MaKo SÍ hace sigue llevando la verdad de siempre (no se tapa todo).
  assert.ok(sanearSalida('Déjame ver el plan y te cargo las tareas.', { corrioHerramientas: false }).texto.includes(SIN_HACER));
  assert.ok(noLoPuedeHacer('No tengo acceso directo para editar la documentación'));
  assert.ok(!noLoPuedeHacer('lo registré para que el equipo técnico lo corrija'), 'reportarlo al equipo es abrir el ticket: MaKo puede');
  assert.ok(!noLoPuedeHacer('Te cargo las tareas al plan.'));
});

test('8. lo que salió en producción para cada pedido: el hito de la bitácora, y el turno lo ve', async () => {
  // Rota: `bloqueDePedidos` sin `desplegado` → el turno no sabe que el #30 ya salió, y contesta «no tengo acceso».
  const m = hitosDeLosTickets([
    { bitacora: [{ titulo: '**A** se arregló', puntos: ['uno **dos**', 'tres', 'cuatro', 'cinco'], tickets: [30, 31] }, { titulo: 'B', tickets: [30] }] },
  ]);
  assert.deepEqual(m.get(30), { titulo: 'A se arregló', puntos: ['uno dos', 'tres', 'cuatro'] }, 'el primero gana, sin ** y con 3 puntos');
  assert.equal(m.get(32), undefined);
  const ahora = new Date('2026-10-29T21:00:00Z');
  const pedidos = [{ id: 30, titulo: 'Documentación', estado: 'resuelto' as const, respuesta: 'Ya está arreglado.', updated_at: '2026-10-29T20:30:00Z', desplegado: { titulo: 'La guía de palabras clave', puntos: ['está en /api-mako?art=instagram-palabras-botones'] } }];
  const b = bloqueDePedidos(pedidos, ahora, 'America/Argentina/Buenos_Aires');
  assert.match(b, /\n  En producción salió: «La guía de palabras clave»\n  · está en \/api-mako\?art=instagram-palabras-botones/);
  assert.match(b, /Si te preguntan si algo de éstos YA quedó hecho/);
  assert.doesNotMatch(bloqueDePedidos([{ ...pedidos[0], desplegado: undefined }], ahora, 'UTC'), /YA quedó hecho|En producción salió/);
  // Y el hito de este arreglo está en la bitácora de mako-doer con `tickets: [30]`: al desplegarse, el #30 se cierra solo.
  const { REGISTROS_SLUGS, registroDe } = await import('../app/admin/dev/registros');
  const reales = hitosDeLosTickets(REGISTROS_SLUGS.map((slug) => ({ bitacora: registroDe(slug).bitacora })));
  assert.match(reales.get(30)?.titulo ?? '', /^MaKo ya no te ofrece hacer lo que no puede/);
});

test('9. la llamada con Thiago: qué hace MaKo desde el grupo, qué confirma en pantalla y qué se aprueba en la app', async () => {
  // Directo: replicar y analizar una landing, pausar o prender una campaña o un anuncio. Con pantalla: el presupuesto. En la app: el
  // WhatsApp a un lead. Lo demás (crear una campaña, una automatización), delegado.
  for (const n of ['replicar_landing', 'analizar_landing', 'proponer_estado_campana', 'proponer_estado_anuncio']) assert.ok(esAccionSimple(n), `${n} no es directa`);
  for (const n of ['proponer_presupuesto_campana', 'proponer_presupuesto_conjunto']) {
    assert.ok(ACCIONES_CON_PANTALLA.has(n) && !esAccionSimple(n), `${n}: el presupuesto es plata, va por pantalla`);
    assert.ok(viajaEnLaAccion(n));
  }
  assert.ok(viajaEnLaAccion('enviar_borrador_whatsapp') && !esAccionSimple('enviar_borrador_whatsapp'));
  for (const n of ['crear_automatizacion', 'crear_campana', 'borrar_landing']) assert.ok(!viajaEnLaAccion(n), `${n} viaja en la ACCIÓN`);
  // Los de pantalla y el de la app son herramientas de verdad, y el presupuesto sigue con su pantalla en el registro.
  const ads = leer('lib/api-mako/areas/ads.def.ts');
  for (const n of ACCIONES_CON_PANTALLA) assert.match(ads, new RegExp(`id: '${n}', [^\\n]*confirmacion: 'pantalla', pantalla: '/mako/revisar'`));
  assert.match(leer('lib/api-mako/areas/chats.def.ts'), /id: 'enviar_borrador_whatsapp', aTerceros: true/);
});

test('10. el WhatsApp a un lead no sale con un «sí» por WhatsApp: se aprueba con un toque en la app', () => {
  // Rota: sin `SE_APRUEBAN_EN_LA_APP` en la puerta → un «sí» puro en el grupo manda el WhatsApp al lead.
  const base = { canal: 'whatsapp', aTerceros: true, titulo: 'Enviar el WhatsApp', resumen: 'WhatsApp a Juan' };
  assert.match(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí', id: 'enviar_borrador_whatsapp' }) ?? '', /sale sólo cuando lo aprueban con un toque en la app/);
  assert.match(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'dale, mandalo', id: 'enviar_borrador_whatsapp' }) ?? '', /un «sí» por WhatsApp no alcanza/);
  // En la app (el toque ES la aprobación), pasa; y las otras de `aTerceros` siguen con el «sí» puro.
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'app', mensaje: null, id: 'enviar_borrador_whatsapp' }), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, titulo: 'Mandar el email', mensaje: 'sí', id: 'enviar_email_alumno' }), null);
  // Las dos puertas (la del registro y la del doer) le pasan el id.
  assert.match(sinComentarios(leer('lib/api-mako/acciones.ts')), /rechazoSiNoEsConfirmacionPura\(\{[\s\S]{0,600}?id: def\?\.id,/);
  assert.match(sinComentarios(leer('lib/mako-doer-acciones.ts')), /rechazoSiNoEsConfirmacionPura\(\{[\s\S]{0,600}?id: defReg\?\.id,/);
  // Y en el grupo, la línea con el link a Pendientes la escribe el código.
  assert.equal(lineaApruebaEnLaApp('https://hola-mako.com/mako/pendientes?ws=10'), 'Ese WhatsApp sale cuando lo apruebas con un toque aquí 👉 https://hola-mako.com/mako/pendientes?ws=10');
  assert.match(sinComentarios(leer('lib/mako-doer-in.ts')), /escriturasDelTurno\.some\(\(n\) => SE_APRUEBAN_EN_LA_APP\.has\(n\)\)[^\n]*\n\s*respuesta = `\$\{respuesta\}\\n\\n\$\{lineaApruebaEnLaApp\(linkApp\('\/mako\/pendientes', wsData\)\)\}`;/);
});

test('11. el pedido compuesto: la IA lista las partes, y si el turno hizo menos, lo demás se delega', () => {
  assert.deepEqual(leerClase('{"clase":"ACCION","resumen":"r","partes":["mover la reunión","mandarle un WhatsApp"]}')?.partes, ['mover la reunión', 'mandarle un WhatsApp']);
  assert.equal(leerClase('{"clase":"ACCION","resumen":"r","partes":["una sola"]}')?.partes, undefined, 'una sola parte no es compuesto');
  assert.equal(leerClase('{"clase":"ACCION","resumen":"r","partes":null}')?.partes, undefined);
  assert.deepEqual(leerClase('{"clase":"ACCION","resumen":"r","partes":["a",3,"","b"]}')?.partes, ['a', 'b']);
  // Rota: `faltaAlgunaParte` con `<=` → con las dos partes hechas, igual se delega.
  assert.ok(faltaAlgunaParte(['mover', 'whatsapp'], 1));
  assert.ok(!faltaAlgunaParte(['mover', 'whatsapp'], 2));
  assert.ok(!faltaAlgunaParte(['mover', 'whatsapp'], 0), 'sin nada hecho, se delega entero por `delegaLaAccion`');
  assert.ok(!faltaAlgunaParte(['una'], 0));
  assert.equal(lineaDeLoQueFalta(7), 'Lo demás que me pediste lo pasé al equipo de MaKo (pedido #7). Te aviso por aquí cuando esté.');
});

test('12. un pedido delegado que nadie tomó en 30 minutos: un aviso en su grupo, uno solo', () => {
  // Rota: sin el filtro de `yaAvisados` → el aviso sale cada 15 minutos.
  const ahora = Date.parse('2026-10-29T21:00:00Z');
  const hace = (min: number) => new Date(ahora - min * 60_000).toISOString();
  const f = (id: number, min: number, extra: Partial<DelegadoSinTomar> = {}): DelegadoSinTomar => ({ id, workspace_id: 10, titulo: 'Crear la automatización', estado: 'esperando_decision', created_at: hace(min), canal: 'whatsapp', contexto: { delegado: true }, ...extra });
  const filas = [
    f(1, 31), f(2, 29), f(3, 60, { estado: 'en_curso' }), f(4, 45, { contexto: {} }), f(5, 45, { canal: 'chat_app' }), f(6, 7 * 60), f(7, 40), f(8, 120, { estado: 'nuevo' }),
  ];
  assert.deepEqual(delegadosParaAvisar(filas, new Set([7]), ahora).map((x) => x.id), [1, 8]);
  assert.equal(MIN_SIN_TOMAR, 30);
  assert.equal(textoDelegadoSinTomar(12, 'Crear la automatización de bienvenida.'), 'Tu pedido #12 («Crear la automatización de bienvenida») todavía no lo tomó nadie del equipo: sigue en la fila. Cuando esté, te aviso por aquí.');
  // El cron de tickets lo corre, y cada aviso deja su renglón (`demora_avisada`) aunque no haya salido.
  assert.match(sinComentarios(leer('app/api/cron/tickets/route.ts')), /const demorados = await avisarDelegadosSinTomar\(\)\.catch\(/);
  const c = sinComentarios(leer('lib/tickets-cierre.ts'));
  assert.match(c, /export async function avisarDelegadosSinTomar\(/);
  assert.match(c, /await db\.from\('ticket_eventos'\)\.insert\(\{\n\s*ticket_id: f\.id, actor: 'sistema', tipo: TIPO_DEMORA_AVISADA,/);
});
