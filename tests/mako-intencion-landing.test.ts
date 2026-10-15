// =============================================================================
// Por WhatsApp: «publicá / despublicá / creame / replicá / analizá una landing» llegan al área landing
// =============================================================================
// El BLOQUEANTE de la tanda 4 del editor de landings (docs/hallazgos-editor-landing.md, «esPedidoDeLanding»):
// medido el 14/10/2026 con el turno que CORRE, «publicá la landing del webinar», «despublicá…», «sacá de
// internet…» y «creame una landing de webinar» salían `capturar` dudosa, con 2 herramientas del plan y
// ninguna de landing. La API tenía las operaciones; el clasificador no las dejaba llegar.
//
// Tanda 7 (15/10/2026): `esPedidoDeLanding` en lib/mako-intencion.ts. Este archivo arma el turno con lo
// MISMO que corre (AGENTS.md, «Una capacidad nueva del doer se prueba con el turno que CORRE»; molde:
// tests/agenda-whatsapp.test.ts): `clasificarIntencion` + `herramientasDelTurno` con los nombres REALES de
// las herramientas de siempre. Las frases van como las escribe una persona: con y sin voseo, con y sin
// tilde, con el link pegado, con el nombre adelante.
//
// MEDIDO ANTES (15/10/2026, con la primera versión de este archivo sobre el código sin la regla): las 31
// frases de pedido llegaban SIN su herramienta. Las que traían un imperativo conocido («armá», «hazme»,
// «analizá», «revisá») caían en `pensar` (ahí las que escriben no viajan: MaKo ofrece); las del link pegado,
// en «links sin instrucción: material para guardar»; los «¿me puedes…?», en «pregunta por un dato»; y el
// resto, en el default (`capturar` dudosa, con las 3 del plan).
//
// PROBADO ROMPIÉNDOLO (15/10/2026, arnés que restaura de memoria y compara el sha256): los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, esPedidoDeLanding } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');

/** Los NOMBRES de las herramientas de siempre (server-only), pedidos a un node aparte con la condición del
 *  server, como tests/agenda-whatsapp.test.ts: una lista escrita a mano mediría otra cosa. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const turno = (mensaje: string): string[] => {
  const veredicto = clasificarIntencion(mensaje, {});
  return herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false }).tools.map((t) => t.name);
};

/** [frase, la herramienta que tiene que viajar]. */
const PEDIDOS: Array<[string, string]> = [
  // Publicar
  ['publicá la landing de lista de espera', 'publicar_landing'],
  ['publica la landing del webinar', 'publicar_landing'],
  ['Mako, publícame la landing del webinar', 'publicar_landing'],
  ['publicala, la landing del webinar ya está', 'publicar_landing'],
  ['me puedes publicar la landing de webinar?', 'publicar_landing'],
  ['podés publicar mi landing de webinar', 'publicar_landing'],
  ['necesito que publiques la página de gracias', 'publicar_landing'],
  ['ya quedó lista, publicá la landing del webinar', 'publicar_landing'],
  // Despublicar
  ['despublicá la landing del webinar', 'despublicar_landing'],
  ['despublica la landing del webinar', 'despublicar_landing'],
  ['sacá de internet la landing del webinar', 'despublicar_landing'],
  ['saca de internet la landing del webinar', 'despublicar_landing'],
  ['puedes despublicar la página de gracias?', 'despublicar_landing'],
  // Crear
  ['creame una landing de webinar', 'crear_landing_desde_diseno'],
  ['créame una landing para mi curso', 'crear_landing_desde_diseno'],
  ['crea una landing para el lanzamiento', 'crear_landing_desde_diseno'],
  ['hazme una landing para agendar llamadas', 'crear_landing_desde_diseno'],
  ['quiero una landing para mi webinar', 'crear_landing_desde_diseno'],
  ['armá una landing de lista de espera', 'crear_landing_desde_diseno'],
  ['hacé una landing para el webinar', 'crear_landing_desde_diseno'],
  // Replicar (con el link pegado)
  ['replicá esta página https://ejemplo.com/oferta', 'replicar_landing'],
  ['replica esta landing https://ejemplo.com', 'replicar_landing'],
  ['cópiame esta página https://ejemplo.com/curso', 'replicar_landing'],
  ['clona https://ejemplo.com', 'replicar_landing'],
  ['puedes replicar esta landing? https://ejemplo.com', 'replicar_landing'],
  ['oye, cloná esta web https://ejemplo.com', 'replicar_landing'],
  // Analizar
  ['analizá esta landing https://ejemplo.com', 'analizar_landing'],
  ['analiza mi landing del webinar', 'analizar_landing'],
  ['revisá la página de gracias', 'analizar_landing'],
  ['hazme un diagnóstico de mi landing', 'analizar_landing'],
  ['podrías analizar https://ejemplo.com/oferta', 'analizar_landing'],
  ['porfa analizame la landing de webinar', 'analizar_landing'],
  ['audita esta página https://ejemplo.com', 'analizar_landing'],
];

test('por WhatsApp, cada pedido sobre una landing llega con SU herramienta (con y sin voseo, con y sin tilde)', () => {
  const sin: string[] = [];
  for (const [f, tool] of PEDIDOS) {
    const n = turno(f);
    if (!n.includes(tool)) sin.push(`«${f}» → sin ${tool} (${clasificarIntencion(f, {}).porque})`);
  }
  assert.deepEqual(sin, [], `\n${sin.join('\n')}`);
});

test('lo que NO es un pedido sobre una landing no se lee como uno', () => {
  // La tercera persona sin tilde en el medio de una frase, el infinitivo de una tarea dictada, una pregunta
  // de cómo se hace, otro objeto entre el verbo y la landing, el sustantivo «copia».
  const casos: Array<[string, string]> = [
    ['mi socio publica la landing el lunes', 'publicar_landing'],
    ['Publicar la landing del webinar', 'publicar_landing'],
    ['¿cómo publico la landing?', 'publicar_landing'],
    ['armame un anuncio para la landing', 'crear_landing_desde_diseno'],
    ['hazme un anuncio de landing', 'crear_landing_desde_diseno'],
    ['¿cómo puedes publicar la landing?', 'publicar_landing'],
    ['al plan: publicá la landing del webinar', 'publicar_landing'],
    ['anota: publicar la landing el lunes', 'publicar_landing'],
    ['copia de la landing quedó rara', 'replicar_landing'],
    ['crea una tarea para publicar la landing', 'publicar_landing'],
  ];
  for (const [f, tool] of casos) assert.ok(!turno(f).includes(tool), `«${f}» trajo ${tool}`);
  for (const f of casos.map((c) => c[0])) assert.equal(esPedidoDeLanding(f), null, f);
  // El de automatización sigue siendo de automatización (6-bis), con su herramienta. Que nombre «landing» suma el
  // área por la palabra (areasDelMensaje, como antes de esta regla), pero el pedido NO es de landing.
  const auto = 'creame una automatización para los que entran por la landing';
  assert.equal(esPedidoDeLanding(auto), null);
  assert.match(clasificarIntencion(auto, {}).porque, /automatizaci/);
  assert.ok(turno(auto).includes('crear_automatizacion_con_ia'));
});

test('esPedidoDeLanding: el tipo, y el turno es `actuar` con el área landing', () => {
  const tipos: Array<[string, string]> = [
    ['publicá la landing', 'publicar'], ['despublicá la landing', 'despublicar'], ['sacala de internet a la landing', 'despublicar'],
    ['creame una landing', 'crear'], ['replicá https://ejemplo.com', 'replicar'], ['analizá mi página', 'analizar'],
  ];
  for (const [f, tipo] of tipos) assert.equal(esPedidoDeLanding(f)?.tipo, tipo, f);
  const v = clasificarIntencion('publicá la landing del webinar', {});
  assert.equal(v.intencion, 'actuar');
  assert.equal(v.dudosa, false);
  assert.deepEqual(v.areas, ['landing']);
  // Con algo pendiente, «dale, publicá la landing» es el pedido, no un «sí» suelto.
  assert.equal(clasificarIntencion('dale, publicá la landing', { hayPendientes: true }).intencion, 'actuar');
});

// =============================================================================
// ROTURAS (15/10/2026). Arnés del scratchpad: rompe UNA cosa por vez en lib/mako-intencion.ts, corre este
// archivo y tests/api-mako-landing-editor.test.ts, restaura DE MEMORIA y compara el sha256. Base: 29 / 0.
//   L1  sin la regla 5-bis del clasificador ....................................... 26 / 3
//   L2  la 5-bis no toma un pedido con link (como si fuera después de la 6) ........ 28 / 1
//   L3  la forma suelta sin tilde vale en cualquier lado (sin el ^) ................ 28 / 1 («mi socio publica…»)
//   L4  sin marcar el voseo con tilde («ya quedó lista, publicá…», «hacé…») ........ 28 / 1
//   L5  sin el corte de otro objeto en el medio («hazme un anuncio de landing») .... 28 / 1
//   L6  sin ARRANCA_PREGUNTANDO («¿cómo puedes publicar…?») ......................... 28 / 1
//   L7  sin ES_DEL_PLAN («al plan: publicá…») ...................................... 28 / 1
//   L8  sin «sacá … de internet» ................................................... 26 / 3
//   L9  el «sí» con una pendiente se queda con «dale, publicá la landing» .......... 28 / 1
//   L10 el veredicto sin el área landing («clona https://…» no la nombra) .......... 27 / 2
//   L11 el veredicto sin la relevancia (una herramienta queda afuera del presupuesto) 28 / 1
//   L12 sin «quiero una landing…» .................................................. 28 / 1
// Restaurado: 29 / 0.
// =============================================================================
