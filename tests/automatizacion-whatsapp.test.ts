// =============================================================================
// «Pídeselo a MaKo» por el grupo de WhatsApp: el pedido de crear una automatización llega con su herramienta
// =============================================================================
// Décima tanda (11/10/2026, NUEVA AUTOMATIZACIÓN 8), Martín: «por el grupo de WhatsApp con MaKo si escribo o envio un
// audio pidiendo que cree una automatización, lo haga llamando justamente a esta función de "Pídeselo a MaKo"». La
// herramienta es `crear_automatizacion_con_ia` (lib/api-mako/areas/chatbot.def.ts); el diseño, en
// docs/diseno-automations-galeria-v2.md §4.
//
// ⚠️ EL TURNO SE ARMA CON LO QUE CORRE (molde: tests/agenda-whatsapp.test.ts, que el 08/10/2026 daba verde sobre el bug
// por armar el turno a mano): `clasificarIntencion` + `herramientasDelTurno`, con los nombres reales de las herramientas
// de siempre. Medido el 11/10/2026 antes del arreglo: `AREA_KEYWORDS.chatbot` no conocía «automatización» (la tab se
// renombró a Automations), así que «créame una automatización…» no traía NINGUNA herramienta del área.
//
// Lo que fija:
//   1. cada frase como la escribe (o la dicta) Martín llega como acción, con el área `chatbot` y la herramienta;
//   2. una PREGUNTA por las automatizaciones no se toma como pedido de crear (MaKo ofrece, no crea);
//   3. el INFINITIVO de una lista («Crear automatización de cobranza») no es el pedido: así se dicta una tarea del plan;
//   4. la herramienta no sale por HTTP y la ve un admin por WhatsApp.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, areasDelMensaje, esPedidoAutomatizacion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { porId, visible, type Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const OP = 'crear_automatizacion_con_ia';

/** Los NOMBRES de las herramientas de siempre (viven con `server-only`: se piden a un node con la condición del server). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));

// El doer del grupo corre como admin, con alcance ejecutar (como en tests/agenda-whatsapp.test.ts).
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

/** El turno como lo arma el doer (lib/mako-doer-in.ts), con las mismas dos funciones. */
function turno(mensaje: string) {
  const veredicto = clasificarIntencion(mensaje, {});
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, contextoDelSi: null });
  return { veredicto, nombres: t.tools.map((x) => x.name), areas: t.areas };
}

// ── 1. Las frases como las escribe Martín ────────────────────────────────────────────

const PEDIDOS = [
  'Mako, créame una automatización que le escriba a los que no vinieron a la reunión',
  'creame una automatizacion para los leads nuevos que les mande un audio de bienvenida',
  'Crea una automatización para los que no vinieron a la llamada y mándales un mensaje para reagendar',
  'Armame un flujo que salude por DM a quien comenta en Instagram',
  'Quiero una automatización que me avise en el grupo cuando alguien agenda',
  '¿Me puedes crear una automatización para cobrar las cuotas vencidas?',
  // Un audio transcripto: sin signos, todo seguido.
  'hola mako necesito que me armes una automatizacion que cuando alguien deja sus datos en la landing le escriba por whatsapp y si no contesta en dos dias le mande un email',
];

test('cada pedido de crear una automatización llega como acción, con el área chatbot y `crear_automatizacion_con_ia`', () => {
  for (const m of PEDIDOS) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'actuar', `«${m}» no es una acción: ${r.veredicto.porque}`);
    assert.ok(r.areas.includes('chatbot'), `«${m}» no trae el área chatbot (llegaron: ${r.areas.join(', ')})`);
    assert.ok(r.nombres.includes(OP), `«${m}» no trae ${OP} (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 12).join(', ')}…)`);
  }
});

test('«automatización», «automations» y «flujo» nombran el área (AREA_KEYWORDS), con y sin tilde', () => {
  for (const m of ['la automatización de bienvenida', 'las automatizaciones', 'en Automations', 'ese flujo', 'los flujos']) {
    assert.ok(areasDelMensaje(m).includes('chatbot'), `«${m}» no se reconoce como del área chatbot`);
  }
});

// ── 2 y 3. Lo que NO es el pedido ───────────────────────────────────────────────────

test('una pregunta por las automatizaciones no es el pedido de crear, y en ella no viaja la herramienta', () => {
  for (const m of ['¿Cómo funciona la automatización de bienvenida?', '¿Qué automatizaciones tengo prendidas?', '¿Cuántos flujos hay activos?']) {
    assert.equal(esPedidoAutomatizacion(m.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')), false, `«${m}» se toma como pedido de crear`);
    const r = turno(m);
    assert.ok(!r.nombres.includes(OP), `«${m}» es una pregunta y trae ${OP}: MaKo la OFRECE, no la crea`);
  }
});

test('el infinitivo de una lista («Crear automatización de cobranza») no es el pedido: así se dicta una tarea', () => {
  assert.equal(esPedidoAutomatizacion('crear automatizacion de cobranza'), false);
  assert.equal(esPedidoAutomatizacion('crea una automatizacion de cobranza'), true);
});

// ── 4. La herramienta ──────────────────────────────────────────────────────────────

test('la herramienta la ve un admin por WhatsApp y NO sale por HTTP (tarda minutos y /api/v1 corta a 60 s)', () => {
  const def = porId(OP);
  assert.ok(def, `${OP} no está en el registro`);
  assert.ok(visible(def, vista), 'un admin del grupo no la ve');
  assert.ok(!visible(def, { ...vista, canal: 'http' }), 'sale por HTTP');
  // Un setter es un `miembro` (`Rol`, lib/api-mako/tipos.ts: 'admin' | 'miembro'); 'setter' no tipaba.
  assert.ok(!visible(def, { ...vista, rol: 'miembro' }), 'la ve un miembro (un setter): crear es de un admin');
});

// ROTURAS (11/10/2026), una por vez y restaurada DE MEMORIA con sha1 igual (arnés `galeria10-roturas.mjs` del scratchpad).
//   R1. la agenda le gana al pedido de automatización (`!pedidoAgenda && esPedidoAutomatizacion(…)`, el orden de antes del
//       11/10) → base 5 / 0, roto 4 / 1 («créame una automatización que le escriba a los que no vinieron a la REUNIÓN»
//       llega con las herramientas de Google Calendar y sin la de crear). Restaurado: 5 / 0.
