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
  ACCIONES_SIMPLES, WS_CON_CUIDADO, delegaLaAccion, esAccionSimple, negocioLeido, preguntaUnDato, respuestaDeLaDelegacion, respuestaDelDebug,
} from '../lib/despacho-grupo';
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
