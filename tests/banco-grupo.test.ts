// =============================================================================
// El turno del grupo de WhatsApp, con el banco de casos REALES (28/10/2026, el diagnóstico del Cerebro: tanda 1, G1 + F1 + G2)
// =============================================================================
// Se calificaron 58 respuestas de MaKo en los grupos del 21 al 28/10: 9 BIEN, 21 FLOJAS, 28 MAL. Las tres causas de esta tanda:
//   G1. lo que ningún clasificador reconocía caía en `capturar` dudosa y llegaba con SÓLO ver_plan y listar_pendientes (el 35 %
//       de los turnos: el pedido de Leandro, todo el soporte de Leila, «Ya conteste», los saludos);
//   F1. el grupo usaba el system del DASHBOARD: la persona «consultor IA de Martín Koncke», «NUNCA termines con una pregunta»,
//       «CIERRA PROPONIENDO INICIAR UN EXPERIMENTO» y «chat general del dashboard» (15 de 49);
//   G2. la charla iba por `chatCheap`, sin historial ni el system del grupo.
// Lo que fija este test, sin modelo y sin base (el nivel 1 del diagnóstico, §5):
//   1. el banco (tests/_banco-grupo.ts): ningún turno llega con sólo el Plan; lo que no tiene señal es una consulta con el
//      catálogo de MaKo, sus tickets y el CRM; los saludos y acuses reales llevan el 👍 sin turno;
//   2. el system REAL del grupo (tests/_system-grupo-hijo.ts): NUCLEO_GRUPO primero, sin la persona, el núcleo ni el «chat
//      general del dashboard», tampoco con overrides guardados; la app, igual que antes;
//   3. el contexto del negocio sólo si el turno piensa o consulta sus números, su copy o sus anuncios;
//   4. sin camino barato, la voz del grupo (lo que no entiende se pregunta, no va al plan), el link sólo si lleva a lo concreto,
//      /automations, y el formato de WhatsApp al salir.
//
// Probado rompiéndolo (28/10/2026, una rotura por vez, restaurada): ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { conElHilo, enElGrupoSinSenal } from '../lib/doer-hilo';
import { esAcusePuro } from '../lib/doer-para-quien';
import { aFormatoWhatsapp } from '../lib/doer-salida';
import { NUCLEO_GRUPO, conElNegocio } from '../lib/nucleo-grupo';
import { rechazoSiNoEsConfirmacionPura } from '../lib/confirmacion-pura';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function hijo(archivo: string, marca: string): Record<string, any> {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL(archivo, import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith(marca));
  assert.ok(linea, `${archivo} no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  const out = JSON.parse(linea.slice(marca.length));
  assert.equal(out.error, undefined, String(out.error));
  return out;
}

let banco: Array<Record<string, any>> | null = null;
function elBanco() {
  if (banco) return banco;
  const codigo = `const { correrBanco, ticketTools } = await import(${JSON.stringify(new URL('./_banco-grupo.ts', import.meta.url).href)});
    const { MAKO_TOOLS } = await import(${JSON.stringify(new URL('../lib/mako-tools.ts', import.meta.url).href)});
    const { MAKO_ACCION_TOOLS } = await import(${JSON.stringify(new URL('../lib/mako-doer-acciones.ts', import.meta.url).href)});
    process.stdout.write('@@BANCO@@' + JSON.stringify(correrBanco([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...(await ticketTools())])) + '\\n');`;
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@BANCO@@'));
  assert.ok(linea, `el banco no corrió (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  banco = JSON.parse(linea.slice('@@BANCO@@'.length));
  return banco!;
}
const fila = (n: string) => elBanco().find((f) => f.n === n)!;

test('1. G1: ningún turno del banco llega con sólo el Plan; lo sin señal consulta con MaKo, sus tickets y el CRM', () => {
  const b = elBanco();
  const soloPlan = b.filter((f) => !f.pulgar && f.soloPlan).map((f) => `${f.n} «${f.texto}»`);
  assert.deepEqual(soloPlan, [], `llegan con sólo ver_plan y listar_pendientes: ${soloPlan.join(' · ')}`);
  // El pedido de Leandro, el soporte de Leila, el «ya lo contacté» de Brigitte.
  for (const n of ['1', '14', 'G1a', 'G1b', 'G1c', '7']) {
    const f = fila(n);
    assert.equal(f.intencion, 'consultar', `${n} «${f.texto}»: ${f.intencion} (${f.porque})`);
    for (const t of ['listar_capacidades_mako', 'mis_tickets', 'buscar_leads', 'ficha_lead']) assert.ok(f.tools.includes(t), `${n} «${f.texto}» sin ${t}`);
    assert.ok(!f.tools.includes('proponer_tareas_plan'), `${n}: una adivinanza puede crear una tarea`);
  }
});

test('1-bis. G1: los saludos y acuses reales llevan el 👍 sin turno; un pedido con un acuse adelante, no', () => {
  for (const n of ['17a', '17b', '17c', '17d', '17e', '17f']) assert.equal(fila(n).pulgar, true, `${n} «${fila(n).texto}» se contesta`);
  for (const t of ['bien, y el lead de Juan?', 'ok, mandale el link a Juan', 'Vamos a cargar la tarea', 'buen dia, me pasas los leads', 'Si', 'no']) {
    assert.equal(esAcusePuro(t), false, `«${t}» se toma por acuse`);
  }
  // Y con algo esperando respuesta, el acuse llega al turno (lib/doer-para-quien.ts, `noEsParaMaKo`), como charla.
  const v = enElGrupoSinSenal(clasificarIntencion('Excelente', { makoPregunto: true }), 'Excelente');
  assert.equal(v.intencion, 'charlar', v.porque);
});

test('1-ter. G1: el default va DESPUÉS del hilo: «pausala» sigue el pedido vivo, no la consulta', () => {
  // `conElHilo` usa la duda del default para seguir el pedido: si el default cambiara antes, el hilo no se seguiría.
  const v = clasificarIntencion('pausala');
  assert.equal(v.sinSenal, true, 'el default dejó de marcarse');
  const pedido = { texto: 'Mako pausá la campaña del webinar', veredicto: clasificarIntencion('Mako pausá la campaña del webinar'), areas: ['ads'] as never };
  const h = conElHilo(v, 'pausala', pedido as never, '¿La pauso?');
  assert.equal(h.veredicto.sigueElHilo, true, 'el hilo ya no se sigue');
  assert.equal(enElGrupoSinSenal(h.veredicto, 'pausala'), h.veredicto, 'el default pisó el hilo');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  // Desde el 29/10/2026 lo de las reglas es el PISO (`porReglas`) y la clase la decide la IA (lib/mako-intencion-ia.ts).
  assert.match(doer, /const correccion = laCorreccion\(conHilo\.veredicto, sinPrefijoDeLote\(texto\), loDeAntes\);\n\s*const (?:intencion|porReglas) = enElGrupoSinSenal\(correccion\.veredicto, texto, pedidoDelHilo\(historial\)\?\.areas \?\? \[\]\);/);
});

test('1-quater. el «sí» a una pendiente viva sigue entrando por la confirmación; la de plata, sólo de quien la pidió', () => {
  // La pregunta del Cerebro sobre 43ac63cc3: el default del grupo no toca el «sí» a una pendiente (es la regla 1, no el default).
  for (const n of ['P1', 'P2']) {
    const f = fila(n);
    assert.equal(f.pulgar, false, `${n}: un «sí» con una pendiente viva se tomó por acuse`);
    assert.equal(f.intencion, 'confirmar', `${n} «${f.texto}»: ${f.intencion} (${f.porque})`);
    assert.ok(f.tools.includes('confirmar_accion') && f.tools.includes('cancelar_accion'), `${n}: sin confirmar_accion`);
  }
  // Y quién confirma una de PLATA en el grupo (lib/confirmacion-pura.ts, lo usa `confirmarPendiente`): quien la pidió, sí.
  const plata = (confirma: string, aMaKo = false) => rechazoSiNoEsConfirmacionPura({
    canal: 'whatsapp', aTerceros: false, plata: true, mensaje: 'Si', titulo: 'Pausar una campaña', resumen: 'Pausar «Webinar»',
    enElGrupo: { pidio: 'Ana', confirma, aMaKo },
  });
  assert.equal(plata('Ana'), null, 'el «Si» de quien la pidió no la confirma');
  assert.match(plata('Pedro') ?? '', /NO la confirmes/, 'el «Si» de otra persona confirmó la de plata');
  assert.equal(plata('Pedro', true), null, '«sí, MaKo» de otra persona no la confirma');
});

test('2. F1: el system REAL del grupo empieza por NUCLEO_GRUPO, sin el dashboard; tampoco con overrides; la app, igual', () => {
  const s = hijo('./_system-grupo-hijo.ts', '@@SYSTEM@@');
  for (const k of ['grupo', 'grupoLean', 'grupoConOverrides']) {
    assert.ok(s[k].startsWith(NUCLEO_GRUPO), `${k}: NUCLEO_GRUPO no va primero`);
    for (const frase of ['NUNCA termines con una pregunta', 'EXPERIMENTO', 'consultor IA de Martín Koncke', 'Te voy a ser directo', 'chat general del dashboard', 'QUÉ TIENES QUE MIRAR Y HACER EN ESTA SECCIÓN', 'GUARDAD']) {
      assert.ok(!s[k].toLowerCase().includes(frase.toLowerCase()), `${k} trae «${frase}»`);
    }
    assert.match(s[k], /NUNCA DESCALIFIQUES LO QUE TE PIDEN/, `${k} sin la regla de no descalificar`);
  }
  assert.match(s.grupo, /SOBRE MAKO|CÓMO FUNCIONA MAKO|HECHOS/i, 'el grupo perdió lo que MaKo sabe de sí misma');
  // Y qué hace cada función (el catálogo de MaKo inteligente, compacto: F2c); la app no lo lleva así.
  assert.match(s.grupo, /LO QUE HACE MaKo \(sus funciones[^\n]*\n- [^\n]+\n[\s\S]*- Automations: /, 'el grupo no sabe qué hace cada función de MaKo');
  assert.doesNotMatch(s.app, /LO QUE HACE MaKo \(sus funciones/);
  // La app y los gráficos, igual que antes (y con sus overrides).
  assert.match(s.app, /consultor IA de Martín Koncke/);
  assert.match(s.app, /NUNCA termines con una pregunta/);
  assert.match(s.app, /chat general del dashboard/);
  assert.match(s.appConOverrides, /PERSONA GUARDADA/);
  assert.match(s.appConOverrides, /NUCLEO GUARDADO/);
});

test('3. F1: el contexto del negocio sólo si piensa o consulta sus números, su copy o sus anuncios', () => {
  assert.equal(conElNegocio({ intencion: 'pensar' }, []), true);
  assert.equal(conElNegocio({ intencion: 'consultar' }, ['metricas']), true);
  assert.equal(conElNegocio({ intencion: 'consultar' }, ['ads']), true);
  for (const [i, a] of [['consultar', ['mako', 'crm']], ['actuar', ['ads']], ['capturar', []], ['charlar', []], ['confirmar', []]] as const) {
    assert.equal(conElNegocio({ intencion: i }, [...a]), false, `${i} ${a.join(',')} lleva el contexto del negocio`);
  }
  const ctx = sinComentarios(leer('lib/mako-context.ts'));
  // Con la base de mentira esos bloques salen vacíos: lo que decide si van es esta línea.
  assert.match(ctx, /const negocio = !grupo \|\| !!opts\.conElNegocio;/, 'el grupo lleva siempre el contexto del negocio');
  for (const bloque of ['faseNegocioTexto', 'searchKnowledge', 'objetivosContextoTexto', 'resumenExperimentos', 'resumenFunnel', 'resumenCaraDeMarca', 'resumenOnboardingTabs']) {
    assert.match(ctx, new RegExp(`negocio \\? (?:await )?${bloque}\\(|opts\\.sinNumerosDelNegocio \\|\\| !negocio \\? '' : await ${bloque}\\(`), `${bloque} va sin mirar si el turno lo usa`);
  }
  assert.match(ctx, /grupo \? '' : getFaseInstruccion\(chartKey\)/, 'la fase de la SECCIÓN del dashboard volvió al grupo');
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /\{ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: consultaDelTurno\(texto, conHilo\.hilo\), canal: 'grupo', conElNegocio: negocio \}\)\)/);
  assert.match(doer, /buildSystemPrompt\(\{ chartKey: 'mako-doer', titulo: 'Hola MaKo', contexto: '', query: '', lean: true, canal: 'grupo' \}\)/, 'la red de la plataforma volvió al system del dashboard');
});

test('4. G2 y la voz: sin camino barato; lo que no entiende se pregunta; el link sólo si lleva a lo concreto; WhatsApp no es Markdown', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.doesNotMatch(doer, /ruta\.tier === 'cheap'/, 'volvió el camino barato');
  assert.doesNotMatch(doer, /\bchatCheap\(/);
  assert.doesNotMatch(doer, /te lo anoto como tarea/, 'lo que no entiende vuelve a ir al plan');
  assert.match(doer, /SI NO SABES A QUÉ SE REFIERE O QUÉ TE PIDE: pregúntalo, en una línea\./);
  assert.doesNotMatch(doer, /CIERRA con un link/, 'el link de relleno volvió');
  assert.match(doer, /un link sólo si lleva a lo concreto de lo que se habla/);
  assert.match(doer, /- Automations \(flujos, disparadores de Instagram y WhatsApp, botones en DM\): \$\{APP_URL\}\/automations/);
  assert.match(doer, /if \(respuesta\) respuesta = aFormatoWhatsapp\(respuesta\);/);
  assert.equal(aFormatoWhatsapp('**Eugenia** - **Contacto:** 123'), '*Eugenia* - *Contacto:* 123');
  assert.equal(aFormatoWhatsapp('## Tus leads\n- Ana'), '*Tus leads*\n- Ana');
  assert.equal(aFormatoWhatsapp('precio *x* ok https://hola-mako.com/crm/1?a=__b__'), 'precio *x* ok https://hola-mako.com/crm/1?a=__b__', 'tocó un link o una negrita bien escrita');
  assert.doesNotMatch(leer('lib/doer-recetas.ts'), /acuse automático \("recibí, lo proceso"\)/, 'la receta del plan volvió a hablar del acuse de texto');
});

// ── Probado rompiéndolo (28/10/2026; cada rotura sola, restaurada después) ──────────────────────────────────────────────
//   B1 sin `enElGrupoSinSenal` en el doer (vuelve el default de capturar)                → falla el 1-ter
//   B2 `enElGrupoSinSenal` devuelve capturar dudosa                                      → falla el 1
//   B3 lo sin señal sin el área `mako`                                                   → falla el 1
//   B4 el clasificador deja de marcar `sinSenal`                                         → falla el 1 y el 1-ter
//   B5 `esAcusePuro` sin estirar la letra final                                          → falla el 1-bis
//   B6 el doer sin `canal: 'grupo'`                                                      → falla el 3
//   B7 el grupo vuelve a la persona (`grupo ? '' :` fuera)                               → falla el 2
//   B8 el grupo vuelve al «chat general del dashboard» (sin el `if (grupo) return base`)  → falla el 2
//   B9 el contexto del negocio siempre (`negocio` = true)                                → falla el 3
//   B10 vuelve el camino barato                                                          → falla el 4
//   B11 sin `aFormatoWhatsapp` al salir                                                  → falla el 4
