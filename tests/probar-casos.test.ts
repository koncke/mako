// =============================================================================
// «PROBAR»: LOS CASOS (15/10/2026, del 4 al 12 de las doce de Martín)
// =============================================================================
// Martín: «Pusiste una cantidad impresionante de chats en "Un lead agendó llamada", revisa por qué tantos casos... En
// ninguno de esos casos el LEAD responde para simular el AI Step... Los nombres de los contactos deberían ser mucho
// más cortos... tal vez "Caso 1" y... que al principio de la conversación se aclare cuando cae ese caso... Elimina lo
// de "Hay más caminos"... Ten presets de fotos de perfil en lugar de "1,2,3..."», y «Cuando ingreso a un contacto
// debería saltar la animación de la prueba, pero luego si me voy a otro contacto y vuelvo ya no debería».
//
// Medido en #213 (sólo lectura) antes: 8 escenarios y uno afuera, casi todos imposibles («No: Su reunión sigue en pie ·
// … · Su reunión sigue en pie»). Después: 3 por la salida, más uno por caso del AI Step en el que el lead contesta.
//
// Lo que fija este archivo:
//   · `escenariosDePrueba` (lib/simulador-grafo.ts): el MISMO hecho vale lo mismo en todo el flujo; dos combinaciones
//     que se ven igual en el chat son una; el primero es el del lead recién llegado; cada uno dice CUÁNDO cae; con un AI
//     Step, uno por caso en el que el lead contesta (y «Lo demás» si no tiene casos);
//   · la barra (`BarraEscenarios`): «Caso N», foto, sin «Hay más caminos», y una fila de fotos con poco ancho;
//   · el panel: la píldora de cuándo cae, el lead que escribe solo, y volver a un caso sin repetir la animación;
//   · `mensajeLeadDe` (lib/probar-lead.ts) y `muelles` con la lista de contactos.
//
// ⚠️ PROBADO ROMPIENDO (15/10/2026, scratchpad romper-casos.mjs, una rotura por vez y restaurada con sha1 igual; base 8
// pass / 0 fail). El resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizar, type PasoGrafo, type CasoRespuesta } from '../lib/flujo-grafo';
import { escenariosDePrueba, hechosDeLeadNuevo } from '../lib/simulador-grafo';
import { mensajeLeadDe, userMensajeLead } from '../lib/probar-lead';
import { muelles, MUELLE } from '../lib/lienzo-grafo';
import { BarraEscenarios } from '../app/automations/PanelProbar';

const msg = (id: string, siguiente: string | null = null): PasoGrafo => ({ id, canal: 'whatsapp', cuerpo: id, siguiente, delay_horas: 0 });
const cond = (id: string, si: string | null, siNo: string | null): PasoGrafo =>
  ({ id, nodo: 'condicion', ramas: [{ id: `${id}_si`, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: si }], si_no: siNo });
const wa = (p: PasoGrafo) => (p.canal ?? 'whatsapp') === 'whatsapp';

/** Como #213: DOS condiciones preguntan lo MISMO («Agendó») en el mismo camino. */
const DOS_IGUALES = normalizar([msg('m0', 'c1'), cond('c1', 'm1', 'm4'), msg('m1', 'c2'), cond('c2', 'm2', 'm3'), msg('m2'), msg('m3'), msg('m4')] as PasoGrafo[]);

// rotura 1 (cada condición vuelve a abrirse por su cuenta: la clave del hecho con el nodo): 5 pass / 3 fail, caen éste
// (sale el camino imposible «Agendó · No: Agendó»), el de juntar y el de la barra.
test('el mismo hecho vale lo mismo en todo el flujo: sin caminos imposibles', () => {
  const { escenarios } = escenariosDePrueba(DOS_IGUALES, { hechos: hechosDeLeadNuevo({}), cuenta: wa });
  assert.equal(escenarios.length, 2, escenarios.map((e) => e.pasos.join(' · ')).join(' | '));
  for (const e of escenarios) assert.ok(!(e.pasos.includes('Agendó') && e.pasos.includes('No: Agendó')), `imposible: ${e.pasos.join(' · ')}`);
  // El primero es el del lead recién llegado (no agendó), y dice cuándo cae.
  assert.deepEqual(escenarios[0].cuando, ['No agendó']);
  assert.deepEqual(escenarios[1].cuando, ['Agendó']);
});

// rotura 2 (sin juntar los que se ven igual: `vistos` nunca tiene la clave): 7 pass / 1 fail, cae éste.
test('dos combinaciones que en el chat se ven igual son UN caso', () => {
  // Las dos salidas de la condición mandan lo mismo (m1): para quien prueba es un solo chat.
  const F = normalizar([cond('c', 'm1', 'm1'), msg('m1')] as PasoGrafo[]);
  const { escenarios } = escenariosDePrueba(F, { hechos: hechosDeLeadNuevo({}), cuenta: wa });
  assert.equal(escenarios.length, 1);
});

const caso = (id: string, titulo: string): CasoRespuesta => ({ id, titulo, cuando: `cuando ${titulo}`, siguiente: null, responder: 'Contesta' });
const conAIStep = (casos: CasoRespuesta[], objetivo = 'Que agende') => normalizar([
  msg('m0'),
  { id: 'ai', canal: 'whatsapp', cuerpo: '', nodo: 'respuesta', paso_ia: true, objetivo, casos, si_no: null, delay_horas: 0 },
] as PasoGrafo[]);

// rotura 3 (sin los escenarios de respuesta): 6 pass / 2 fail, caen éste y el de «Lo demás».
test('con un AI Step, un caso más por cada uno de sus casos, en el que el lead CONTESTA', () => {
  const { escenarios } = escenariosDePrueba(conAIStep([caso('k1', 'Pregunta el precio'), caso('k2', 'Quiere cambiar el día')]), { hechos: hechosDeLeadNuevo({}), cuenta: wa });
  const resp = escenarios.filter((e) => e.respuesta);
  assert.deepEqual(resp.map((e) => e.respuesta!.titulo), ['Pregunta el precio', 'Quiere cambiar el día']);
  assert.ok(resp.every((e) => e.cuando.at(-1)?.startsWith('Contesta: ')), 'dice que el lead contesta');
  assert.equal(new Set(escenarios.map((e) => e.id)).size, escenarios.length, 'sin ids repetidos');
});

test('un AI Step sin casos con nombre: un caso «Lo demás», con su objetivo', () => {
  const { escenarios } = escenariosDePrueba(conAIStep([], 'Que cuente a qué se dedica'), { hechos: hechosDeLeadNuevo({}), cuenta: wa });
  const r = escenarios.find((e) => e.respuesta)?.respuesta;
  assert.deepEqual(r, { casoId: '', titulo: 'Lo demás', cuando: 'Que cuente a qué se dedica' });
});

// rotura 4 (la barra con el texto del camino en vez de «Caso N»): 7 pass / 1 fail, cae éste.
test('la barra: «Caso N» con foto, sin «Hay más caminos», y en fila con poco ancho', () => {
  const { escenarios } = escenariosDePrueba(DOS_IGUALES, { hechos: hechosDeLeadNuevo({}), cuenta: wa });
  const props = { escenarios, elegido: escenarios[0].id, previas: {}, faltan: 3, canal: 'whatsapp' as const, onElegir: () => {} };
  const col = renderToStaticMarkup(createElement(BarraEscenarios, props));
  assert.match(col, /data-barra-escenarios="columna"/);
  assert.match(col, />Caso 1</);
  assert.match(col, />Caso 2</);
  assert.match(col, /src="https:\/\/randomuser\.me\/api\/portraits\/[a-z]+\/\d+\.jpg"/);
  assert.doesNotMatch(col, /Hay más caminos/);
  const fila = renderToStaticMarkup(createElement(BarraEscenarios, { ...props, fila: true }));
  assert.match(fila, /data-barra-escenarios="fila"/);
  assert.match(fila, />Caso 1</);
});

const PANEL = readFileSync(new URL('../app/automations/PanelProbar.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// rotura 5 (sin la píldora de cuándo cae al arrancar): 7 pass / 1 fail, cae éste.
// rotura 6 (el lead nunca escribe: sin la rama de `escribirComoLead`): 7 pass / 1 fail, cae éste.
// rotura 7 (volver a un caso lo vuelve a correr: sin restaurar el hilo guardado): 7 pass / 1 fail, cae éste.
test('el panel: la píldora de cuándo cae, el lead que escribe, y volver a un caso sin repetir la animación', () => {
  const arrancar = PANEL.slice(PANEL.indexOf('const arrancarRefs = () => {'), PANEL.indexOf('const reiniciar = (deVerdad = false) => {'));
  assert.match(arrancar, /leadEscribio\.current = false;\n\s+pildoraDelCaso\(\);\n\s+luego\(150, avanzar\);/);
  assert.match(PANEL, /if \(conBarra && caso && k >= 0 && caso\.cuando\.length\) sistema\(`\$\{nombreDelCaso\(k\)\}: \$\{caso\.cuando\.join\(' · '\)\}`\);/);
  assert.match(PANEL, /if \(!evento\.enRespuesta && escRef\.current\?\.respuesta && !leadEscribio\.current\) \{\n\s+luego\(ENTRE_MS \+ resto \+ LEAD_PIENSA_MS, \(\) => \{ void escribirComoLead\(\); \}\);/);
  assert.match(PANEL, /const j = await postar\(\{ action: 'mensaje-lead', titulo: r\.titulo, cuando: r\.cuando, ultimo \}\);[\s\S]{0,300}await enviarTexto\(texto\);/);
  const elegir = PANEL.slice(PANEL.indexOf('const elegirEscenario = (id: string) => {'), PANEL.indexOf('// Su renglón de la barra dice lo último'));
  assert.match(elegir, /if \(guardado && guardado\.firma === firmaViva && !realRef\.current\) \{\n\s+cortar\(\);\n\s+msgsRef\.current = guardado\.mensajes;/);
  assert.match(PANEL, /<ChatHilo\n\s+key=\{escenarioSel\?\.id \?\? 'uno'\}/, 'el hilo se remonta por caso: lo restaurado no entra animado');
});

// rotura 8 (`mensajeLeadDe` sin respaldo): 7 pass / 1 fail, cae éste.
test('lo que escribe el lead: el JSON, y sin IA, el «cuándo» del caso', () => {
  assert.equal(mensajeLeadDe('{"mensaje":"  cuánto sale??  "}', { titulo: 'Precio', cuando: 'Pregunta el precio' }), 'cuánto sale??');
  assert.equal(mensajeLeadDe('', { titulo: 'Precio', cuando: 'Pregunta el precio' }), 'Pregunta el precio');
  assert.equal(mensajeLeadDe('no es json', { titulo: 'Precio', cuando: '' }), 'Precio');
  assert.match(userMensajeLead({ titulo: 'Precio', cuando: 'x', ultimo: 'Hola, te dejo el video' }), /<material>Hola, te dejo el video<\/material>/);
});

// rotura 9 (`muelles` sin el ancho de la lista de contactos): 7 pass / 1 fail, cae éste.
test('con la lista de contactos, «Probar» pide más ancho', () => {
  const caja = { w: 1500, h: 800 };
  const sin = muelles(caja, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
  const con = muelles(caja, { listaAbierta: true, probarAbierto: true, editorAbierto: true, probarConContactos: true });
  assert.ok(con.probar!.width > sin.probar!.width, `${con.probar!.width} ≤ ${sin.probar!.width}`);
  assert.ok(con.probar!.width <= MUELLE.probarAnchoContactos);
});
