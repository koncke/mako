// =============================================================================
// La red gratis del doer de WhatsApp no lleva datos de los clientes del negocio
// =============================================================================
// Regla del 16/10/2026 (AGENTS.md): los datos de los clientes de un cliente nunca van a un proveedor que entrena con
// lo que recibe, y las keys gratis de la agencia (el plan gratis de Gemini y de Groq) entrenan. La cascada tenía el
// corte; el bucle PROPIO del doer sobre `provsGratisDePlataforma` (lib/mako-doer-in.ts) no: con las keys de un negocio
// caídas, la conversación sobre sus leads iba a la key gratis de la agencia.
//
// El corte es POR TURNO (`turnoParaLaRed`, lib/doer-herramientas.ts) y la pregunta «¿lee datos de clientes?» la
// contesta el registro de la API (`leeDatosDeClientes`), no una lista de nombres. Los turnos se arman con lo MISMO
// que corre (molde: tests/agenda-whatsapp.test.ts): `clasificarIntencion` + `herramientasDelTurno`, con los nombres
// reales de las herramientas de siempre.
//
// ⚠️ Lo que fija y que no era obvio: «hola MaKo, ¿cómo estás?» se clasifica `consultar` y trae `buscar_leads` (las de
// siempre viajan en CUALQUIER consulta). Cortar «si viaja una herramienta que lee leads» dejaba sin MaKo a un negocio
// sin keys hasta para un saludo, con un aviso falso. Se corta si lo PEDIDO es de clientes o hay una pendiente con
// sus datos; si no, la red corre sin esas herramientas.
//
// Correr: npx tsx --test tests/doer-red-datos-clientes.test.ts
//
// PROBADO ROMPIÉNDOLO el 17/10/2026, una rotura por vez y restaurando (base: 9 pasan, 0 fallan; pasa/falla):
//   - el bucle de la red vuelve a `chatCheapTools(system, msgs, tools, …)`               → 8/1
//   - sin el `if (turnoRed?.cortar)` / `!turnoRed.cortar` (la red corre siempre)         → 8/1
//   - `turnoParaLaRed` sin el corte por pendientes                                       → 8/1
//   - `turnoParaLaRed` sin el corte por «todo lo pedido es de clientes»                  → 8/1
//   - `turnoParaLaRed` corta por cualquier herramienta con datos (el diagnóstico obvio)  → 8/1
//   - `crm` en `false` en DATOS_DE_CLIENTES_POR_AREA                                     → 4/5
//   - lo que el registro no conoce cuenta como SIN datos                                 → 8/1
//   - `ver_rechazos_pago_landing` sin su `datosDeClientes: false`                        → 8/1
//   - el aviso del catch vuelve a `textoFalloIA` aunque la red se haya cortado           → 8/1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno, turnoParaLaRed, llevaDatosDeClientes, SIN_DATOS_DE_CLIENTES } from '../lib/doer-herramientas';
import { REGISTRO, porId, type Vista } from '../lib/api-mako/registro';
import { DATOS_DE_CLIENTES_POR_AREA, type Area } from '../lib/api-mako/tipos';
import { textoSinRedPorDatos, sinRedPorDatos } from '../lib/fallo-ia-texto';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Los NOMBRES de las herramientas de siempre, pedidos a un node aparte con la condición del server (viven en módulos
 *  con `server-only`). Mismo arreglo que tests/agenda-whatsapp.test.ts. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

/** El turno como lo arma el doer, y lo que la red gratis haría con él. */
function red(mensaje: string, tiposPendientes: string[] = []) {
  const hayPendientes = tiposPendientes.length > 0;
  const veredicto = clasificarIntencion(mensaje, { hayPendientes });
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes });
  const r = turnoParaLaRed({ tools: t.tools, delRegistro: t.delRegistro, tiposPendientes });
  return { intencion: veredicto.intencion, nombres: t.tools.map((x) => x.name), r };
}
const corta = (mensaje: string, pend: string[] = []) => {
  const { intencion, r } = red(mensaje, pend);
  assert.ok(r.cortar, `«${mensaje}» (${intencion}) lleva datos de clientes y la red gratis corrió igual`);
};
const corre = (mensaje: string, pend: string[] = []) => {
  const x = red(mensaje, pend);
  assert.equal(x.r.cortar, null, `«${mensaje}» (${x.intencion}) no pide datos de clientes y la red se cortó: ${x.r.cortar?.join(', ')}`);
  return x;
};

test('las herramientas de siempre están en el registro: si no, «no se sabe» decide solo', () => {
  assert.ok(DE_SIEMPRE.length >= 20, `llegaron ${DE_SIEMPRE.length} herramientas de siempre`);
  const sinDef = DE_SIEMPRE.map((t) => t.name).filter((n) => !porId(n));
  assert.deepEqual(sinDef, [], `sin def en el registro (cuentan como datos de clientes): ${sinDef.join(', ')}`);
});

test('las áreas de leads, conversaciones, llamadas y cobros cuentan como datos de clientes', () => {
  for (const a of ['crm', 'chats', 'whatsapp', 'email', 'chatbot', 'closing', 'cs', 'curso', 'cobros', 'metricas', 'equipo'] as Area[]) {
    assert.equal(DATOS_DE_CLIENTES_POR_AREA[a], true, `el área ${a} quedó como si no tuviera datos de clientes`);
  }
  // Y lo que el registro no conoce, también (no saber no es poder).
  assert.equal(llevaDatosDeClientes('una_herramienta_que_no_existe'), true);
  assert.equal(llevaDatosDeClientes('(no se pudieron leer las pendientes)'), true);
});

test('en un área sin datos de clientes, una operación con nombre sospechoso declara su marca: sumarla es decidir', () => {
  const SOSPECHOSO = /(^|_)(lead|leads|contacto|contactos|conversacion|conversaciones|llamada|llamadas|chat|chats|whatsapp|fathom|transcript|grabacion|grabaciones|cobro|cobros|pago|pagos|alumno|alumnos|cartera|reunion|reuniones|cliente|clientes|inbox|mensaje|mensajes)(_|$)/;
  const sinDecidir = REGISTRO
    .filter((d) => !DATOS_DE_CLIENTES_POR_AREA[d.area] && SOSPECHOSO.test(d.id) && d.datosDeClientes === undefined)
    .map((d) => `${d.area}/${d.id}`);
  assert.deepEqual(sinDecidir, [], `sin decidir: ${sinDecidir.join(', ')}. Si lee leads, conversaciones, llamadas o cobros de los clientes del negocio, \`datosDeClientes: true\`; si no, \`false\`.`);
  // Las dos que sí, dentro de áreas que no.
  assert.equal(llevaDatosDeClientes('listar_reuniones_fathom'), true);
  assert.equal(llevaDatosDeClientes('ver_grabaciones_lead'), true);
});

test('lo que se pide de clientes CORTA la red; lo demás corre sin las herramientas que los leen', () => {
  corta('¿qué leads entraron hoy?');
  corta('¿quién me escribió por WhatsApp hoy?');
  corta('agéndame una reunión con Juan mañana a las 10');
  // ⚠️ Una pregunta sobre MaKo es `consultar` y trae `buscar_leads`: no se corta, corre sin ella. (Hasta el 17/10 el
  // caso era «hola MaKo, ¿cómo estás?»; desde el arreglo de Pablo el saludo se pela y es `charlar`, sin herramientas.)
  const hola = corre('¿qué sabes hacer?');
  assert.ok(hola.nombres.includes('buscar_leads'), 'el caso dejó de servir: la pregunta ya no trae buscar_leads');
  if (hola.r.cortar) return;
  assert.ok(hola.r.sacadas.includes('buscar_leads') && !hola.r.tools.some((t) => t.name === 'buscar_leads'), 'buscar_leads viajó a la red gratis');
  for (const t of hola.r.tools) assert.equal(llevaDatosDeClientes(t.name), false, `${t.name} viajó a la red gratis`);
  const plan = corre('¿qué tengo pendiente en el plan?');
  if (!plan.r.cortar) assert.ok(plan.r.tools.some((t) => t.name === 'ver_plan'), 'el plan se quedó sin ver_plan');
  const campanas = corre('¿cómo van las campañas?');
  if (!campanas.r.cortar) assert.ok(campanas.r.tools.some((t) => t.name === 'listar_campanas_meta'), 'las campañas se quedaron sin listar_campanas_meta');
});

test('cargar al plan y confirmar corren enteros, salvo con una pendiente que nombra a un cliente', () => {
  const anota = corre('anota: revisar la landing el lunes');
  if (!anota.r.cortar) {
    assert.deepEqual(anota.r.sacadas, [], 'cargar al plan perdió herramientas');
    assert.ok(anota.r.tools.some((t) => t.name === 'proponer_tareas_plan'));
  }
  corre('sí, dale', ['meta_estado']);
  // La pendiente de mover un lead de etapa: su resumen («mover a Juan Pérez a Ganado») va en el system.
  corta('sí, dale', ['lead_etapa']);
  corta('anota: revisar la landing el lunes', ['lead_etapa']);
  corta('hola', ['proponer_agendar_reunion']);
});

test('el doer corre la red con lo que decide `turnoParaLaRed`, y no con el turno entero', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  const iDecide = doer.indexOf('turnoParaLaRed(');
  const iRed = doer.indexOf('provsGratisDePlataforma()');
  assert.ok(iDecide > 0 && iRed > iDecide, 'la red gratis se pide antes de decidir qué lleva el turno');
  const bloque = doer.slice(iDecide, doer.indexOf('respondió con la RED DE PLATAFORMA', iRed));
  assert.match(bloque, /if \(turnoRed\?\.cortar\) \{[^}]*erroresPlataforma\.push\(`red gratis salteada:/, 'el corte no deja la marca que lee `sinRedPorDatos`');
  assert.match(bloque, /if \(!respuesta && turnoRed && !turnoRed\.cortar\)/, 'la red corre aunque el turno se haya cortado');
  assert.match(bloque, /chatCheapTools\(systemRed, msgs, toolsRed,/, 'la red manda el system y las herramientas del turno entero');
  assert.doesNotMatch(bloque, /chatCheapTools\(system, msgs, tools,/, 'la red manda las herramientas del turno entero');
  assert.match(bloque, /armarSystem\(toolsRed, `\\n\\n\$\{SIN_DATOS_DE_CLIENTES\}`\)/, 'el system de la red nombra herramientas que no viajan');
});

test('sin keys propias y con la red cortada, el aviso dice por qué y adónde ir (y no manda a conectar Claude)', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /const sinRedPorSusDatos = sinRedPorDatos\(errsPlat\) && causa === 'sin_keys';/);
  assert.match(doer, /respuesta = sinRedPorSusDatos\s*\?\s*textoSinRedPorDatos\(linkApp\('\/integraciones\?abrir=gemini', wsData\)/);
  assert.ok(sinRedPorDatos(['red gratis salteada: el turno lleva datos de clientes (buscar_leads) y el plan gratis entrena con lo que recibe']));
  const txt = textoSinRedPorDatos('https://app/integraciones?abrir=gemini&ws=13', 'armar el borrador');
  assert.match(txt, /No puedo armar el borrador/);
  assert.match(txt, /https:\/\/app\/integraciones\?abrir=gemini&ws=13$/);
  // El turno con herramientas corre sólo con las keys baratas del negocio: su Claude no lo arreglaría.
  assert.doesNotMatch(txt, /Claude/);
});

test('la línea del system de la red no promete herramientas', () => {
  assert.match(SIN_DATOS_DE_CLIENTES, /NO PUEDES LEER LEADS, CONVERSACIONES, LLAMADAS NI COBROS/);
  assert.doesNotMatch(SIN_DATOS_DE_CLIENTES, /[a-z_]+_[a-z_]+\(/, 'nombra una herramienta');
});

test('el registro decide por la def y, si no dice nada, por su área', () => {
  // `listar_pendientes` (área mako, con datos) dice que no: lo suyo es lo de cada pendiente.
  assert.equal(llevaDatosDeClientes('listar_pendientes'), false);
  assert.equal(llevaDatosDeClientes('ver_pendiente'), true);
  assert.equal(llevaDatosDeClientes('ver_rechazos_pago_landing'), false);
  assert.equal(llevaDatosDeClientes('buscar_leads'), true);
  assert.equal(llevaDatosDeClientes('ver_plan'), false);
});
