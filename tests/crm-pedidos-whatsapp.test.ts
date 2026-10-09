// =============================================================================
// Los pedidos sobre un lead del CRM llegan al turno con su herramienta
// =============================================================================
// Pedido de Martín (08/10/2026): «Revisa el grupo con Brigitte, Joan le pidió que cargue una
// NOTA a ese lead y creó una tarea... Cuando justamente creamos toda una documentación API para
// que MaKo en WhatsApp pueda hacer todas las acciones dentro de la app».
//
// Lo que pasó (ws15, mako_doer_conv #1274): Joan dijo por audio «Macu, anotá en el lead…
// Nicolás como una nota que ya tiene su propiedad con Remax… Solo agregá esa nota al lead
// Nicolás». «Anotá» era «cargalo al plan» en TRES puertas —el clasificador, el router y
// `esCargaDePlan` del doer—, el turno llegó con las tres herramientas del plan, Gemini dio 503
// y el pedido se guardó crudo como borrador del plan. Y #1267, «okay, movelo a "calificado"
// dentro del CRM», cayó al default: el lead nunca se movió. Ver `esPedidoSobreLead`
// (lib/mako-intencion.ts).
//
// El turno se arma con lo MISMO que corre (el molde de tests/agenda-whatsapp.test.ts): el
// clasificador + `herramientasDelTurno` (lib/doer-herramientas.ts) con los nombres reales de
// las herramientas de siempre. Medido el 08/10 antes del arreglo: de los 21 pedidos de abajo,
// 19 llegaban SIN su herramienta. Sobre los 178 mensajes reales de mako_doer_conv, el arreglo
// cambia la clasificación de 4 y los 4 eran pedidos perdidos (#349 ws11, #1095 ws13, #1267 y
// #1274 ws15).
//
// Correr: npx tsx --test tests/crm-pedidos-whatsapp.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (09/10/2026), una rotura por vez, con los 6 en verde antes y después:
//   - sacar la regla 3-quater del clasificador → 2 pases / 4 fallos;
//   - que PEDIDO_ANOTAR vuelva a quedarse con «anotá en el lead» → 3 / 3;
//   - el router sin la pregunta (vuelve el `(plan)`) → 5 / 1;
//   - `esCargaDePlan` sin la pregunta → 5 / 1;
//   - sacar la exclusión de lo del plan (ES_DEL_PLAN) → 5 / 1;
//   - sacar la exclusión de los volcados (encabezado, infinitivo, lista) → 5 / 1;
//   - que la regla del «sí» con pendiente se quede con el pedido → 5 / 1;
//   - sin la relevancia del tipo → 5 / 1 («dejale dicho en la ficha…» pierde la herramienta);
//   - sin el verbo de anotar como señal de nota → 4 / 2;
//   - aceptar «agrega»/«marca» sueltos en el medio de la frase (tercera persona) → 5 / 1.
// Antes del 09/10 la exclusión de volcados y la relevancia daban 6 / 0: no había caso que las
// pidiera. Se sumaron «Idea: cuando el dueño dice "movelo a calificado"…» y «dejale dicho…».

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, esPedidoSobreLead } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { rutearDoer } from '../lib/mako-router';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Los nombres de las herramientas de siempre, pedidos a un node con la condición del server
 *  (viven en módulos con `server-only`): una lista a mano se queda vieja. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 15, rol: 'admin', tabs: null };

function turno(mensaje: string, ctx: { hayPendientes?: boolean; makoPregunto?: boolean } = {}) {
  const veredicto = clasificarIntencion(mensaje, ctx);
  const t = herramientasDelTurno({
    veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista,
    hayPendientes: !!ctx.hayPendientes, contextoDelSi: null, sinCalendly: true,
  });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

const JOAN = 'Macu, anotá en el lead que llegó Nicolás lo que dijo Bright. Anotá en el en el lead Nicolás como una nota que ya tiene su casa, su propiedad con Remax y no quiere dar exclusiva. Solo agregá esa nota al lead Nicolás.';

/** [el mensaje, la herramienta que tiene que viajar]. Los literales de los grupos van primero. */
const PEDIDOS: ReadonlyArray<readonly [string, string]> = [
  [JOAN, 'agregar_nota_lead'],                                                         // ws15 #1274
  ['okay, movelo a "calificado" dentro del CRM', 'proponer_cambio_etapa'],             // ws15 #1267
  ['agrega el link a notas del lead del CRM franco: https://www.loom.com/share/x', 'agregar_nota_lead'], // ws13 #1095
  ['Me agregas a lead para respuesta a German Gudiño', 'proponer_lead'],               // ws11 #349
  ['anotá en el lead de Rosana que la llamé y no atendió', 'agregar_nota_lead'],
  ['anota en la ficha de Juan que quiere vender en diciembre', 'agregar_nota_lead'],
  ['agregale una nota a Nicolás: tiene la casa con Remax', 'agregar_nota_lead'],
  ['agrega una nota al lead Omar: no quiere exclusividad', 'agregar_nota_lead'],
  ['dejá una nota en Miguel que lo llamo el lunes', 'agregar_nota_lead'],
  ['ponele una nota a Mariana que ya vendió', 'agregar_nota_lead'],
  ['sumale al lead de Jose que es departamento en San Cristóbal', 'agregar_nota_lead'],
  ['movelo a calificado', 'proponer_cambio_etapa'],
  ['pasalo a pre listing', 'proponer_cambio_etapa'],
  ['pasá a Nicolás a Calificado', 'proponer_cambio_etapa'],
  ['mueve a Omar a la etapa En Revisión', 'proponer_cambio_etapa'],
  ['ponelo en descartado', 'proponer_cambio_etapa'],
  ['marcalo como calificado', 'marcar_calificado'],
  ['marca a Nicolás como calificado', 'marcar_calificado'],
  ['asignale a Rosana el closer Juan', 'asignar_closer_setter'],
  ['ponele la etiqueta caliente a Nicolás', 'poner_etiqueta_lead'],
  ['cargalo como lead nuevo: Ana Pérez 1155554444', 'proponer_lead'],
  // Sin la relevancia del tipo, agregar_nota_lead queda afuera de los 12.000 caracteres: no
  // dice «nota» y «dejale dicho» no comparte raíz con el título (medido el 09/10).
  ['dejale dicho en la ficha a Miguel que lo llamo el lunes', 'agregar_nota_lead'],
  ['marcalo como que asistió a la reunión', 'marcar_asistencia_reunion'],
  ['agregalo también al producto Mentoría', 'agregar_lead_a_producto'],
];

test('cada pedido sobre un lead llega como `actuar`, con el área del CRM y su herramienta', () => {
  const faltan: string[] = [];
  for (const [m, id] of PEDIDOS) {
    const r = turno(m);
    if (r.veredicto.intencion !== 'actuar' || !r.nombres.includes(id)) {
      faltan.push(`«${m.slice(0, 60)}» → ${r.veredicto.intencion}${r.veredicto.dudosa ? ' (dudosa)' : ''}, ${r.nombres.length} herramientas, sin ${id}`);
    }
  }
  assert.deepEqual(faltan, [], `llegan sin su herramienta:\n${faltan.join('\n')}`);
});

test('la nota de Joan no es del plan: ni el clasificador, ni el router, ni el doer la toman como carga', () => {
  const v = clasificarIntencion(JOAN);
  assert.equal(v.intencion, 'actuar');
  assert.deepEqual(esPedidoSobreLead(JOAN), { tipo: 'nota' });
  // La del plan viaja igual (en `actuar` van todas las de siempre: «anotá en el lead que lo
  // llame y creame la tarea» pide las dos). Lo que cambia es que ya no es la ÚNICA.
  assert.ok(turno(JOAN).nombres.includes('agregar_nota_lead'));
  // El router pone `(plan)` en la ruta, y con eso el doer exige un borrador del plan.
  assert.doesNotMatch(rutearDoer(JOAN).motivo, /\(plan\)/);
  // `esCargaDePlan` vive en un módulo con `server-only`: se fija que pregunte PRIMERO lo mismo.
  const src = leer('lib/mako-doer-in.ts');
  const cuerpo = src.slice(src.indexOf('function esCargaDePlan('), src.indexOf('function esCargaDePlan(') + 900);
  const pregunta = cuerpo.indexOf('if (esPedidoSobreLead(texto)) return false;');
  assert.ok(pregunta > 0 && pregunta < cuerpo.indexOf('anot[aá]'), 'esCargaDePlan vuelve a leer «anotá en el lead» como una carga del plan');
});

test('lo que SÍ es del plan sigue siendo del plan', () => {
  for (const m of [
    'anotá: llamar a Nicolás el lunes',
    'anota esto para el plan: revisar la landing',
    'anotame que tengo que llamar al contador',
    'Idea: que el lead se mueva solo a calificado cuando contesta',
    // ws13 #713, literal: nombra «notas», pero pide una TAREA.
    'anotame una nueva tarea para la entrega del servicio, notas: campaña a formularios + automatizacion o campaña a mensajes',
    'anotá en el plan que tengo que llamar al lead Nicolás',
  ]) {
    assert.equal(esPedidoSobreLead(m), null, `«${m}» se leyó como un pedido sobre un lead`);
    assert.equal(clasificarIntencion(m).intencion, 'capturar', `«${m}» dejó de ir al plan`);
  }
  assert.match(rutearDoer('anotá: llamar a Nicolás el lunes').motivo, /\(plan\)/);
});

test('un volcado de ideas que nombra el CRM no se vuelve una orden', () => {
  for (const m of [
    'Tengo ideas...\n\n- ¿Qué pasa si un cliente tiene varias cuentas publicitarias?\n- Mover el lead a calificado solo',
    'Idea: si el closer marca al lead como calificado, que MaKo avise',
    'Investigar: cómo mueve Kommo los leads entre etapas',
    // Un pedido citado ADENTRO de una idea: el «movelo» es del ejemplo, no una orden.
    'Idea: cuando el dueño dice "movelo a calificado", que MaKo lo mueva solo',
    // Tercera persona en el medio de una frase: no es a MaKo.
    'si el closer agrega una nota al lead, que se vea en la ficha',
    'la nota de voz del lead no se escucha',
  ]) {
    assert.equal(esPedidoSobreLead(m), null, `«${m.slice(0, 60)}» se leyó como un pedido sobre un lead`);
  }
});

test('con una pendiente abierta, un pedido nuevo sobre un lead no se lee como «sí» o «no»', () => {
  const r = turno('no, pasalo a descartado', { hayPendientes: true });
  assert.equal(r.veredicto.intencion, 'actuar');
  assert.ok(r.nombres.includes('proponer_cambio_etapa'));
  // Y un «sí» pelado sigue confirmando.
  assert.equal(clasificarIntencion('sí, dale', { hayPendientes: true }).intencion, 'confirmar');
});

test('la descripción de la herramienta y el clasificador dicen lo mismo', () => {
  // agregar_nota_lead le dice al modelo «úsala cuando el dueño diga "anota en X que…"»: si el
  // clasificador manda esa frase al plan, la descripción promete algo que el turno no trae.
  assert.match(leer('lib/api-mako/areas/crm.def.ts'), /id: 'agregar_nota_lead'[\s\S]{0,400}anota en X que/);
  const r = turno('anota en Rosana que no atendió, es un lead');
  assert.ok(r.nombres.includes('agregar_nota_lead'), `«anota en X que…» llega sin la herramienta: ${r.veredicto.intencion}`);
});
