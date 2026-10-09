// =============================================================================
// Los BORDES del paso «⚡ Acción»: lo que lo rodea y asumía que todo paso es un mensaje
// =============================================================================
// Decisión de Martín (08/10/2026): un paso de un flujo «que pueda hacer todo, sin
// limitaciones» (lib/api-mako/flujo.ts). El paso existe en los dos lienzos; estos guards
// cuidan a los vecinos que lo trataban como un mensaje vacío o lo perdían:
//   · la PRUEBA de una secuencia mandaba un WhatsApp «[PRUEBA n/N] » en blanco por cada acción;
//   · el GENERADOR le pedía copy al modelo para un paso sin texto;
//   · las tools de MaKo que reescriben pasos (chat y email) los perdían o les ponían audio;
//   · un «ya está así» alarmaba al dueño en cada evento repetido;
//   · un paso de acción de la plataforma se heredaba y corría en el negocio de cada cliente.
//
// Verificado rompiéndolo (08/10/2026), cada rotura de a una y restaurada de memoria:
//   · probarSecuencia vuelve a recorrer sec.pasos: 1 fallo.
//   · el generador vuelve a mandar sec.pasos al modelo: 1 fallo.
//   · asignar_audio_paso sin el rechazo de la acción: 1 fallo.
//   · editar_pasos_secuencia_mensajes sin conservar la acción: 1 fallo.
//   · editar_pasos_secuencia_email sin el rechazo: 1 fallo.
//   · el ejecutor de flujos vuelve a `ok: false` en un «ya está»: 1 fallo.
//   · ejecutarOperacion deja de propagar `yaEstaba`: 1 fallo.
//   · la herencia vuelve a copiar el flujo entero: 1 fallo.
//   · (08/10/2026, flujo con ramas) la acción vuelve a esperar el borrador SÓLO si la secuencia no
//     sale sola (`!sec.envio_automatico`): 1 fallo (15/1).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de un bloque: desde `ini` hasta el primer `fin` que viene después. */
const bloque = (src: string, ini: string, fin: string): string => {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» después de «${ini}»`);
  return src.slice(i, j);
};

test('la prueba de una secuencia manda sólo los MENSAJES: una acción no se prueba', () => {
  const src = sinComentarios(leer('../lib/setting-secuencias.ts'));
  const prueba = bloque(src, 'export async function probarSecuencia', '\n}\n');
  // Desde el 08/10/2026 tampoco las tarjetas de CONTROL (condición, espera, «Si responde», «Ir a»):
  // llevan `cuerpo: ''` de relleno y, sin el filtro, cada una era otro «[PRUEBA n/N] » en blanco.
  assert.match(prueba, /const mensajes = sec\.pasos\.filter\(\(p\) => !esPasoAccion\(p\) && !esNodoDeControl\(p\)\)/);
  assert.match(prueba, /for \(const paso of mensajes\)/, 'el bucle vuelve a recorrer las acciones y manda un WhatsApp en blanco por cada una');
  assert.match(prueba, /mensajes\.every\(\(p\) => p\.canal === 'whatsapp'\)/);
});

test('el generador no le pide copy al modelo para un paso de acción, y lo devuelve tal cual', () => {
  const src = sinComentarios(leer('../lib/nutricion-generator.ts'));
  const gen = bloque(src, 'export async function generarSecuencia', '\n}\n');
  assert.match(gen, /pasos: JSON\.stringify\(aEscribir\.map\(pasoParaPrompt\)/, 'el modelo vuelve a recibir los pasos de acción');
  assert.match(gen, /if \(esPasoAccion\(orig\)\) return orig;/);
});

test('las tools de MaKo que tocan pasos no pierden ni rompen una acción', () => {
  const chat = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  const audio = bloque(chat, '  asignar_audio_paso: {', '\n  },\n');
  assert.match(audio, /esPasoAccion\(s\.pasos\.find\(\(p\) => p\.orden === orden\)\)\) return \{ error:/, 'un paso de acción recibe un audio que el saneo tira en silencio');
  const editar = bloque(chat, '  editar_pasos_secuencia_mensajes: {', '\n  },\n');
  assert.match(editar, /if \(previo && esPasoAccion\(previo\)\) \{\n\s+pasos\.push\(\{ \.\.\.previo,/, 'la acción no se conserva al reescribir por chat');
  assert.match(editar, /conAcciones && entrada\.length !== s\.pasos\.length/, 'agregar o quitar un paso corre las acciones a otro lugar (el merge es posicional)');
  const ficha = bloque(chat, '  ficha_secuencia_mensajes: {', '\n  },\n');
  assert.match(ficha, /esPasoAccion\(p\) \? \(\{[\s\S]*?tipo: 'accion'[\s\S]*?accion: p\.accion,/, 'MaKo ve la acción como un texto vacío');
  const email = sinComentarios(leer('../lib/api-mako/areas/email.run.ts'));
  const pasosEmail = bloque(email, '  editar_pasos_secuencia_email: {', '\n  },\n');
  assert.match(pasosEmail, /if \(s\.pasos\.some\(esPasoAccion\)\) return \{ error:/, 'la tool de email arma los pasos de cero y borra las acciones');
});

test('«ya está así» es un éxito para un flujo: no le manda una alarma al dueño', () => {
  const flujo = sinComentarios(leer('../lib/api-mako/flujo.ts'));
  assert.match(flujo, /if \(!r\.ok\) return \{ ok: r\.yaEstaba === true, resumen: r\.error, via: 'ninguna' \};/);
  const ejecutar = sinComentarios(leer('../lib/api-mako/ejecutar.ts'));
  assert.match(ejecutar, /\.\.\.\(prep\.yaEstaba \? \{ yaEstaba: true \} : \{\}\)/, 'ejecutarOperacion se come la marca y el flujo vuelve a alarmar');
  // Y las operaciones que un flujo pide más seguido la ponen.
  const crm = sinComentarios(leer('../lib/api-mako/areas/crm.run.ts'));
  for (const op of ['agregar_lead_a_producto', 'quitar_lead_de_producto', 'mover_lead_en_producto']) {
    assert.match(bloque(crm, `  ${op}: {`, '    ejecutar:'), /yaEstaba: true/, `${op} no marca su «ya está»`);
  }
  const chat = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  assert.match(bloque(chat, '  inscribir_lead_secuencia: {', '    ejecutar:'), /v\.porque === 'en_curso' \? \{ yaEstaba: true \}/);
});

test('un paso de acción de la plataforma NO se hereda: el cliente hereda los mensajes', () => {
  const src = sinComentarios(leer('../lib/plantillas.ts'));
  const par = bloque(src, 'async function leerPar', '\n}\n');
  assert.match(par, /if \(!propio\[id\]\?\.flujo && heredable\.flujo\?\.pasos\?\.some\(\(x\) => x\.tipo === 'accion'\)\) \{\n\s+heredable\.flujo = \{ \.\.\.heredable\.flujo, pasos: heredable\.flujo\.pasos\.filter\(\(x\) => x\.tipo !== 'accion'\) \};/);
  // Y se saca ANTES de armar lo efectivo, no después: el orden de la línea importa.
  assert.ok(par.indexOf("heredable.flujo.pasos.filter") < par.indexOf('efectivo[id] = { ...heredable'), 'el filtro corre después de armar lo efectivo y no saca nada');
});

// ── Lo que cazó la revisión adversarial (08/10/2026, `wf_d229086b-56f`: 20 confirmados) ──
// Verificado rompiéndolo, cada rotura de a una y restaurada de memoria (1 fallo cada una):
//   · dispararEvento sin reclamar la clave del evento · un webhook de agenda sin dedupKey ·
//   · el filtro de prendido vuelve a `enabled !== false` · la línea de fallo sin espaciar ·
//   · el motor de avisos corre un paso al que le falta un dato · avanzar DESPUÉS de ejecutar ·
//   · el deshacer sin tomar lo pendiente · agregar un paso sin tomarlo · sin visibilitychange ·
//   · el editor vuelve a guardar '' para «Otro lead» · el key del campo sin la acción ·
//   · un string[] con opciones en un Select de un valor · el JSON sin mirar la forma ·
//   · la acción de una secuencia sin la espera del borrador · guardar sin mirar lo obligatorio ·
//   · el cron vuelve a cortar en 'off' · los avisos de WhatsApp cuentan acciones ·
//   · el id de un link con su ?ws= · el cierre de tareas sin sus ids · el alta de leads que
//     reclama después de crear.

test('avisos: una REENTREGA del webhook no corre el flujo otra vez', () => {
  const src = sinComentarios(leer('../lib/flujos.ts'));
  const disparar = bloque(src, 'export async function dispararEvento', '\n}\n');
  assert.match(disparar, /if \(ctx\.dedupKey && !\(await reclamarEspaciado\(ws, `flujo:\$\{id\}`, 180, ctx\.dedupKey\)\)\) continue;\n\s+await runWithWorkspace\(ws, \(\) => ejecutarPasos/, 'el reclamo tiene que ir ANTES de correr los pasos');
  const calcom = leer('../app/api/webhooks/calcom/route.ts');
  const calendly = leer('../app/api/webhooks/calendly/route.ts');
  assert.equal((calcom.match(/dispararEvento\('lead\.agendo', \{[^}]*dedupKey: `calcom:/g) ?? []).length, 2, 'Cal.com reentrega: sus dos dispararEvento llevan la clave');
  assert.equal((calendly.match(/dispararEvento\('lead\.(agendo|cancelo)', \{[^}]*dedupKey: `calendly/g) ?? []).length, 3, 'Calendly reentrega: sus tres dispararEvento llevan la clave');
});

test('avisos: un flujo corre sólo si su aviso está PRENDIDO, con la misma pregunta que la pantalla', () => {
  const src = sinComentarios(leer('../lib/plantillas.ts'));
  const listar = bloque(src, 'export async function listarFlujosActivos', '\n}\n');
  assert.match(listar, /return cat \? estaPrendida\(cat, e\) : e\.enabled !== false;/);
});

test('avisos: un paso a medio configurar no corre, y la línea de fallo se espacia', () => {
  const src = sinComentarios(leer('../lib/flujos.ts'));
  const paso = bloque(src, "  if (paso.tipo === 'accion') {", '\nfunction nombreDelAviso');
  assert.ok(paso.indexOf('faltanEnPaso(') > 0 && paso.indexOf('faltanEnPaso(') < paso.indexOf('ejecutarDesdeFlujo(operacion'), 'lo obligatorio se mira ANTES de correr');
  assert.match(paso, /if \(await reclamarEspaciado\(ws, `flujo-fallo:\$\{flujoId\}`, 60, operacion\)\) \{\n\s+await enviarAlGrupoMaKo/);
});

test('avisos: con corrida, el paso se RECLAMA antes de ejecutarlo', () => {
  const src = sinComentarios(leer('../lib/flujos.ts'));
  const pasos = bloque(src, 'async function ejecutarPasos', '\n}\n');
  const reclamo = pasos.lastIndexOf('const mio = await avanzar(ws, corridaId, i, d.siguiente, null);');
  const corre = pasos.indexOf('await ejecutarPaso(flujoId, d.paso, ws, ctx)');
  assert.ok(reclamo > 0 && corre > reclamo, 'avanzar va antes de ejecutarPaso');
  assert.equal(pasos.indexOf('await avanzar(ws, corridaId, i, d.siguiente, null)', corre), -1, 'no queda un avanzar DESPUÉS de ejecutar');
});

test('el panel de un «⚡ Acción» entrega lo pendiente antes de que el tablero cambie', () => {
  const src = sinComentarios(leer('../app/agencia/FlujoAviso.tsx'));
  const foto = bloque(src, 'const aplicarFoto = (foto: FotoTablero): FotoTablero => {', '\n  };\n');
  assert.ok(foto.indexOf('panelPendiente.current?.tomar()') > 0 && foto.indexOf('panelPendiente.current?.tomar()') < foto.indexOf('guardarFlujo(foto.flujo'), 'el deshacer toma (y descarta) lo pendiente antes de guardar');
  const agregar = bloque(src, 'async function agregarTras(nodoId: string, que: string) {', 'insertarPasoTras(');
  assert.match(agregar, /panelPendiente\.current\?\.tomar\(\)/);
  assert.match(agregar, /setSel\(null\)/, 'el panel se cierra: el paso nuevo corre los índices');
  assert.match(agregar, /p === pend\.original \? pend\.nuevo : p/, 'lo pendiente entra en el MISMO guardado');
  const panel = bloque(src, 'function EditorPasoAccion(', '\nfunction Opcion(');
  assert.match(panel, /panelPendiente\.current = yo;/);
  assert.match(panel, /addEventListener\('visibilitychange'/, 'cerrar la pestaña también es salir del panel');
});

test('el editor del paso: «Otro lead» se puede elegir, y los campos guardan la forma correcta', () => {
  const src = sinComentarios(leer('../app/_components/EditorAccionMako.tsx'));
  assert.match(src, /e\.target\.value \? Number\(e\.target\.value\) : LEAD_A_ELEGIR/, '«Otro lead» sin id vuelve como LEAD_A_ELEGIR, no como un vacío que se borra');
  assert.match(src, /typeof valor === 'number' \? valor : LEAD_A_ELEGIR/);
  assert.match(src, /key=\{`\$\{valor\.operacion \?\? ''\}:\$\{p\.nombre\}`\}/, 'el JSON crudo de un campo se queda de la acción anterior');
  assert.match(src, /if \(p\.tipo === 'string\[\]' && p\.enum\?\.length\) \{[\s\S]*?varios=\{lista\}/);
  assert.match(src, /const ok = p\.tipo === 'object' \? esObjeto\(v\) : Array\.isArray\(v\) && v\.every\(esObjeto\);/);
});

test('secuencias: la acción espera si el mensaje anterior quedó como borrador sin mandar', () => {
  const src = sinComentarios(leer('../lib/nutricion.ts'));
  const rama = bloque(src, '      if (esPasoAccion(paso)) {', 'const r = await correrPasoAccion(');
  // Desde el 08/10/2026 sin `!sec.envio_automatico`: «sale sola» pasó a ser POR TARJETA
  // (`revisar`), así que en una secuencia que sale sola el mensaje de antes igual pudo quedar
  // como borrador. La pregunta es si HAY uno pendiente, no qué dice la secuencia.
  // (Segunda tanda, 08/10/2026: con hilos en paralelo espera el borrador de SU mensaje anterior;
  // con un solo cursor, cualquier borrador del lead, como siempre.)
  assert.match(rama, /const delPadre = sanearHilos\(insc\.hilos\) \? await tieneBorradorPendienteDePaso\(insc\.id, mensajeAnteriorDe\(sec\.pasos, insc\.paso_actual\) \+ 1\) : null;/);
  assert.match(rama, /if \(lead && \(delPadre \?\? await tieneBorradorNutriPendiente\(lead\.id\)\) && !\(await esLeadCliente\(lead\.id\)\)\) \{/);
  assert.doesNotMatch(rama, /!sec\.envio_automatico && await tieneBorradorNutriPendiente/);
  assert.match(rama, /continue;/);
});

test('secuencias: «Publicar» no guarda un paso de acción al que le falta un dato obligatorio', () => {
  const src = sinComentarios(leer('../lib/nutricion.ts'));
  const guardar = bloque(src, 'export async function setSecuenciaPasos', '\n}\n');
  assert.match(guardar, /faltanEnPaso\(d\.parametros, a\.accion\.params, \{ leadId: 1 \}\)/);
  // `PasosInvalidosError` (08/10/2026): la ruta lo contesta 400, no la pantalla genérica.
  assert.match(guardar, /if \(incompletas\.length\) throw new PasosInvalidosError/);
});

test('secuencias: sin canales, el cron corre igual las acciones', () => {
  const src = sinComentarios(leer('../app/api/cron/nutricion/route.ts'));
  assert.match(src, /if \(!conAcciones\) return \{ ws: w\.id, modo: 'off'/);
  assert.match(src, /const proc = await procesarEnvios\(\{ ignorarVentana \}\);\n\s+return \{ ws: w\.id, modo: 'off \(sólo acciones\)'/);
});

test('las pantallas de /chatbot cuentan como WhatsApp sólo los MENSAJES', () => {
  // Desde el 08/10/2026 (el flujo con ramas) «no es un mensaje» es más que una acción: una
  // espera, una condición o un salto tampoco le mandan nada al lead. El perfil pregunta
  // con `esNodoMensaje` (lib/flujo-grafo.ts), que es la clase del nodo y no una copia.
  // Probado rompiéndolo: volver a `!esPasoAccion(p)` → 1 rojo.
  const perfil = sinComentarios(leer('../app/chatbot/SecuenciaPerfil.tsx'));
  assert.match(perfil, /const mensajes = pasos\.filter\(\(p\) => esNodoMensaje\(p\)\);\n\s+const soloWa = mensajes\.length > 0 && mensajes\.every/);
  const app = sinComentarios(leer('../app/chatbot/ChatAgentApp.tsx'));
  assert.match(app, /p\.canal === 'whatsapp' && !esPasoAccion\(p\)/);
});

test('el ejecutor: el id de un borrador sale SIN la query, y cada forma propia se aplica entera', () => {
  for (const f of ['../lib/api-mako/areas/plan.run.ts', '../lib/api-mako/areas/crm.run.ts']) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\.(link|url)\.split\('\/'\)\.pop\(\)/, `${f}: el id queda con el ?ws= pegado`);
  }
  const flujo = sinComentarios(leer('../lib/api-mako/flujo.ts'));
  assert.match(flujo, /aplicarPropuesta\(id, undefined, undefined, undefined, cerrarIds\)/, 'un borrador de cierres se aplica con sus ids');
  const leads = bloque(flujo, 'async function crearLeadsDePropuesta', '\n}\n');
  assert.ok(leads.indexOf('marcarAplicada(') > 0 && leads.indexOf('marcarAplicada(') < leads.indexOf('createLead('), 'se reclama ANTES de crear');
});
