// =============================================================================
// El chat de MaKo ES la sidebar, la tuerca es de cada automatización y Configuraciones también (20/10/2026)
// =============================================================================
// Martín, 16/10/2026 (puntos 5 y 6 del «Feedback Automations») y otra vez el 20/10 (punto 5), textos enteros en
// docs/relevo/chatbot.md: «al abrir una automatización, toda la sidebar se transforme en el chat con MaKo y que esté
// permanentemente abierta. Y con la flecha para atrás para cambiar a otra automatización», «que se elimine el icono de
// MaKo ya que quedará siempre abierto, y en su lugar que allí vaya el ícono de configuraciones», «"configuraciones" ya no
// viva para todo Automations, sino para cada chat en los 3 puntos... como también el horario de oficina para cada
// automatización», «Solo cuando se selecciona etapas o algún funnel que esté catalogado como "Prospección", debe saltar
// un warning para configurar eso al momento de darle a publicar o probar» y «en el lugar donde hoy está el ícono de
// configuraciones que solo quede el "?" del tutorial».
//
// Lo que fija:
//   1. la sidebar dibuja el chat de la abierta (por portal, SIEMPRE montado, sin ✕ ni botón para abrirlo) y la «←»
//      vuelve a la lista; el muelle de la derecha es sólo de «Probar»;
//   2. en el título, la tuerca en lugar del logo de MaKo; el «⋯» de la fila también abre Configuraciones;
//   3. Configuraciones de UNA automatización: el horario propio o el del negocio, el goteo (de WhatsApp y de email; 23/10/2026: sin «Misma persona»), y el
//      motor y el tick que las respetan (cada automatización con el suyo);
//   4. el menú de la lista, sólo el «?»;
//   5. el aviso de Prospección al Publicar o Probar.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-chat-siempre.json`): ver el pie.
//
// Correr: node --import tsx --test tests/automations-chat-siempre.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  sanearConfigAutomatizacion, horarioDeLaAutomatizacion, configParaGuardar, cerradasAhora,
  abrioAlgunaPropia, cronDeProspeccion, tieneConfigPropia, textoDeHorario, claveConfigAutomatizacion, secuenciaDeClave,
  type ConfigAutomatizacion,
} from '../lib/config-automatizacion';
import type { HorarioEnvio } from '../lib/horario-envio';
import { BotonTuerca, TITULO_TUERCA } from '../app/automations/SecuenciaPerfil';
import { opcionesDeFila } from '../app/automations/SimuladorWhatsApp';
import { PASOS_AUTOMATIONS, PASOS_DEL_LIENZO, DONDE, OBJETIVO_AYUDA } from '../app/automations/recorrido-automations';
import { porId } from '../lib/api-mako/registro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const LISTA = () => sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
const PERFIL = () => sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));

const NEGOCIO_9_A_21: HorarioEnvio = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] };
const PROPIO_10_A_12: HorarioEnvio = { activo: true, desde: 10, hasta: 12, dias: [1, 2, 3, 4, 5] };
const TZ = 'America/Mexico_City';
/** Un martes a las 11:00 de Ciudad de México (17:00 UTC). */
const MARTES_11 = Date.parse('2026-10-20T17:00:00Z');
/** El mismo martes a las 13:00 (19:00 UTC): el negocio abierto, el propio de 10 a 12 cerrado. */
const MARTES_13 = Date.parse('2026-10-20T19:00:00Z');

// ── 1. El chat es la sidebar ─────────────────────────────────────────────────────

test('1: la sidebar dibuja el chat de la abierta por portal, siempre montado, y la «←» vuelve a la lista', () => {
  const lista = LISTA();
  // La ranura: escondida (no desmontada) con la lista a la vista.
  assert.match(lista, /<div ref=\{setRanuraChat\} data-ranura-chat="" style=\{\{ flex: 1, minHeight: 0, display: verLista \? 'none' : 'flex', flexDirection: 'column' \}\} \/>/);
  assert.match(lista, /const conChat = rolAdmin && !!sel && !creandoSel;\n\s+const verLista = !conChat \|\| enLaLista;/);
  assert.match(lista, /ranuraChat=\{conChat \? ranuraChat : null\} onVolverALista=\{\(\) => setEnLaLista\(true\)\}/);
  // Elegir una fila (también la abierta) vuelve al chat; `?mako=1` también.
  assert.match(lista, /if \(id === selId\) \{ setEnLaLista\(false\); return; \}/);
  assert.match(lista, /setPedidoPara\(null\); setEnLaLista\(false\);/);
  assert.match(lista, /if \(abrir\.mako\) setEnLaLista\(false\);/);
  // El muelle de la derecha es sólo de «Probar».
  assert.match(lista, /calcularMuelles\(caja, \{ listaAbierta: true, probarAbierto: probarVisible, editorAbierto: true,/);
  assert.doesNotMatch(lista, /makoVisible|setMakoAbierto|makoAlAbrir/);
  // El lienzo monta el chat ahí, SIEMPRE (sin `editandoIA`), sin ✕ y con la «←».
  const perfil = PERFIL();
  assert.match(perfil, /\{rolAdmin && ranuraChat && createPortal\(\n\s+<div data-crear-ia="editar" data-chat-sidebar=""/);
  const chat = perfil.slice(perfil.indexOf('<ChatMako secuenciaId={secuencia.id}'), perfil.indexOf('ranuraChat,\n'));
  assert.match(chat, /onVolver=\{onVolverALista\}/);
  assert.doesNotMatch(chat, /onCerrar=/, 'el chat volvió a tener ✕');
  assert.doesNotMatch(perfil, /editandoIA|abrirMako|data-muelle="mako"|chatAlCostado/);
  // ChatMako: la «←» sólo con `onVolver`.
  const cm = sinComentarios(leer('app/automations/ChatMako.tsx'));
  assert.match(cm, /\{p\.onVolver && \(\n\s+<button type="button" className="chm-x" data-volver-lista="" onClick=\{p\.onVolver\} aria-label=\{ROTULO_VOLVER\} title=\{ROTULO_VOLVER\}>←<\/button>/);
});

// ── 2. La tuerca y el «⋯» ────────────────────────────────────────────────────────

test('2: en el título va la tuerca (no el logo de MaKo), y el «⋯» de la fila también abre Configuraciones', () => {
  const perfil = PERFIL();
  assert.doesNotMatch(perfil, /<BotonLogoMako /, 'volvió el logo de MaKo al título');
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): la tuerca también para quien no es admin (el modal entra en sólo lectura).
  // (24/10/2026: mirando las métricas no va: tests/metricas-una-barra.test.ts.)
  assert.match(perfil, /\{Configuraciones && !verMetricas && \(\n\s+<BotonTuerca lado=\{ALTO_ACCION\} onClick=\{\(\) => setConfigAbierta\(true\)\} \/>/);
  assert.match(perfil, /\{configAbierta && Configuraciones && <Configuraciones secuenciaId=\{secuencia\.id\} nombre=\{nombre \|\| secuencia\.nombre\} onCerrar=\{cerrarConfig\} \/>\}/);
  const html = renderToStaticMarkup(createElement(BotonTuerca, { lado: 44, onClick: () => {} }));
  assert.match(html, new RegExp(`aria-label="${TITULO_TUERCA}"`));
  assert.match(html, /data-boton-tuerca/);
  // El «⋯»: «Configuraciones» abre el MISMO modal, para esa fila.
  assert.ok(opcionesDeFila(true).some((o) => o.value === 'configuraciones' && o.label === 'Configuraciones'));
  const lista = LISTA();
  assert.match(lista, /if \(accion === 'configuraciones'\) \{ setErrFila\(null\); setConfigDe\(\{ id: j\.id, nombre: j\.nombre \}\); return; \}/);
  assert.match(lista, /\{configDe && Configuraciones && <Configuraciones secuenciaId=\{configDe\.id\} nombre=\{configDe\.nombre\} onCerrar=\{cerrarConfigDe\} \/>\}/);
  // El modal llega de la tab como COMPONENTE (sus acciones no entran a los tests que dibujan la lista y el lienzo).
  assert.match(leer('app/automations/ChatAgentApp.tsx'), /Configuraciones=\{ConfiguracionesModal\} configPropia=\{tieneConfigPropiaDe\}/);
  assert.doesNotMatch(leer('app/automations/SecuenciaPerfil.tsx'), /^import \{[^}]*\} from '\.\/ConfiguracionesBoton';/m);
  assert.doesNotMatch(leer('app/automations/SimuladorWhatsApp.tsx'), /^import \{[^}]*\} from '\.\/ConfiguracionesBoton';/m);
});

// ── 3. La configuración de una automatización ────────────────────────────────────

test('3: sin nada propio, la del negocio; con horario propio (o «sin horario»), el suyo', () => {
  const vacia: ConfigAutomatizacion = {};
  assert.equal(horarioDeLaAutomatizacion(vacia, NEGOCIO_9_A_21), NEGOCIO_9_A_21);
  assert.equal(horarioDeLaAutomatizacion(vacia, null), null);
  assert.deepEqual(horarioDeLaAutomatizacion({ horario: PROPIO_10_A_12 }, NEGOCIO_9_A_21), PROPIO_10_A_12);
  // «Sin horario» propio: manda a cualquier hora aunque el negocio tenga uno.
  assert.equal(horarioDeLaAutomatizacion({ horario: { ...PROPIO_10_A_12, activo: false } }, NEGOCIO_9_A_21), null);
  assert.equal(horarioDeLaAutomatizacion({ horario: null }, NEGOCIO_9_A_21), null);
  // Lo propio que cuenta: el horario y el goteo (uno solo para todos los canales desde el 24/10/2026). «Misma persona» se
  // fue (23/10/2026): una clave vieja no cuenta.
  assert.equal(tieneConfigPropia(vacia), false);
  assert.equal(tieneConfigPropia({ goteo: { dia: 40 } }), true);
  assert.equal(tieneConfigPropia({ personaHoras: { email: 30 } } as ConfigAutomatizacion), false);
  assert.equal(textoDeHorario(NEGOCIO_9_A_21), 'de 09:00 a 21:00 · todos los días');
  assert.equal(textoDeHorario(null), 'sin horario: manda a cualquier hora');
  assert.equal(secuenciaDeClave(claveConfigAutomatizacion(284)), 284);
});

test('3: lo guardado se sanea y un cambio con `null` vuelve a lo del negocio; fuera de rango, un error', () => {
  assert.deepEqual(sanearConfigAutomatizacion('basura'), {});
  // El `goteoEmail` de antes del 24/10/2026 no se lee si hay un `goteo`: es UNO para todos (tests/goteo-un-interruptor.test.ts).
  assert.deepEqual(sanearConfigAutomatizacion(JSON.stringify({ horario: PROPIO_10_A_12, goteo: { minutos: 4, dia: 99999 }, goteoEmail: { minutos: 5, dia: 40 } })), { horario: PROPIO_10_A_12, goteo: { minutos: 4 } });
  const r = configParaGuardar({ horario: PROPIO_10_A_12, goteo: { minutos: 4 } }, { horario: null });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.config, { goteo: { minutos: 4 } });
  const r2 = configParaGuardar({ goteo: { minutos: 4, dia: 30 } }, { goteo: { minutos: null } });
  assert.deepEqual(r2.ok && r2.config, { goteo: { dia: 30 } });
  const mal = configParaGuardar({}, { goteo: { minutos: 0 } });
  assert.equal(mal.ok, false);
  assert.match(!mal.ok ? mal.error : '', /van de 1 a 240/);
});

test('3: el motor cierra cada automatización con SU horario (y el tick barre al abrir el propio)', () => {
  const configs = new Map<number, ConfigAutomatizacion>([[2, { horario: PROPIO_10_A_12 }], [3, { horario: null }]]);
  // A las 11: el negocio y el propio abiertos.
  assert.deepEqual([...cerradasAhora([1, 2, 3], configs, NEGOCIO_9_A_21, MARTES_11, TZ)], []);
  // A las 13: el negocio abierto; la #2 (de 10 a 12) cerrada; la #3 sin horario, abierta.
  assert.deepEqual([...cerradasAhora([1, 2, 3], configs, NEGOCIO_9_A_21, MARTES_13, TZ)], [2]);
  // Sin poder leer la zona: cerradas las que TIENEN horario.
  assert.deepEqual([...cerradasAhora([1, 2, 3], configs, NEGOCIO_9_A_21, MARTES_13, null)].sort(), [1, 2]);
  // El tick: el propio de 10 abre a las 10.
  assert.equal(abrioAlgunaPropia([{ horario: PROPIO_10_A_12 }], Date.parse('2026-10-20T16:01:00Z'), TZ, 5), true);
  assert.equal(abrioAlgunaPropia([{ horario: PROPIO_10_A_12 }], MARTES_11, TZ, 5), false);
});

test('3: el motor lee lo de cada automatización UNA vez, estricto, y lo usa por fila', () => {
  const m = sinComentarios(leer('lib/nutricion.ts'));
  const pe = m.slice(m.indexOf('export async function procesarEnvios('), m.indexOf('\n}\n', m.indexOf('export async function procesarEnvios(')));
  assert.match(pe, /const configs = await configsDeEnvio\(\);/);
  assert.match(pe, /if \(horario === 'ilegible' \|\| configs === 'ilegible'\) fueraDeHorario = 'horario-ilegible';/);
  assert.match(pe, /cerradas = cerradasAhora\(ids, configs, horario, Date\.now\(\), tz\);/);
  assert.match(pe, /const fuera = \(secId: number\): boolean => fueraDeHorario != null \|\| cerradas\.has\(secId\);/);
  assert.match(pe, /else if \(soloCerradas\.length\) q = q\.not\('secuencia_id', 'in', `\(\$\{soloCerradas\.join\(','\)\}\)`\);/);
  assert.match(pe, /const cerrada = fuera\(insc\.secuencia_id\);/);
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): lo propio ilegible ya no corta el carril de todas: corre sólo lo de afuera del horario.
  // Revisión del 20/10/2026, noche (tests/automations-aviso-todos-caminos.test.ts): con `ignorar_ventana` (sin corte del horario) lo propio ilegible corta.
  assert.match(pe, /if \(limites === 'ilegible' \|\| \(configs === 'ilegible' && fueraDeHorario == null\)\) return \{ \.\.\.res, saltado: 'limites-ilegibles' \};/);
  assert.match(pe, /const configsCorrida: ReadonlyMap<number, ConfigAutomatizacion> = configs === 'ilegible' \? new Map\(\) : configs;/);
  assert.match(pe, /frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioRecienteDe\(insc\.secuencia_id\), enviadoEnCorrida\)/);
  // Sin «Misma persona» (23/10/2026): ya no hay ventana por automatización; queda el freno de la misma corrida.
  assert.match(pe, /const conEnvioRecienteDe = \(_secId: number\): RecientesPorCanal => SIN_VENTANA;/);
  assert.doesNotMatch(pe, /ventanaDe|personaHorasDeLaAutomatizacion/);
  // «No pude leer» no es «no tiene nada propio».
  assert.match(m, /async function configsDeEnvio\(\): Promise<Map<number, ConfigAutomatizacion> \| 'ilegible'> \{\n\s+try \{ return await configsDelNegocio\(\); \} catch \{ return 'ilegible'; \}/);
  const tick = sinComentarios(leer('app/api/cron/nutricion-tick/route.ts'));
  assert.match(tick, /\.like\('key', `\$\{CLAVE_PREFIJO\}%`\)/);
  assert.match(tick, /abrioAlgunaPropia\(propiasDe\.get\(ws\) \?\? \[\], ahora, tz, VENTANA_FRESCA_MIN\)/);
  // La API de MaKo la declara (leer y configurar). Desde el 4/11/2026 también por http: la campaña de email de Mauricio
  // la arma su Claude con un token (tests/email-campana-secuencia.test.ts), y sin esto no puede elegir las columnas.
  for (const id of ['configuracion_automatizacion', 'configurar_automatizacion']) {
    const d = porId(id);
    assert.ok(d, `falta ${id}`);
    assert.ok((d!.canales as readonly string[]).includes('http'), `${id} no sale por http`);
  }
});

// ── 4. El menú de la lista, sólo el «?» ──────────────────────────────────────────

test('4: el menú de la lista es sólo el «?» del tutorial', () => {
  const boton = sinComentarios(leer('app/automations/ConfiguracionesBoton.tsx'));
  const menu = boton.slice(boton.indexOf('export function MenuAutomations('));
  assert.match(menu, /<button type="button" data-boton-tutorial="" onClick=\{onTutorial\} title=\{TITULO_TUTORIAL\} aria-label=\{TITULO_TUTORIAL\}/);
  assert.match(menu, />\?<\/button>/);
  assert.doesNotMatch(menu, /Dropdown|configuraciones/i, 'el menú volvió a tener Configuraciones');
  // El recorrido: el último paso es el «?», y suma el chat y la tuerca.
  assert.equal(PASOS_AUTOMATIONS.find((p) => p.objetivo === OBJETIVO_AYUDA)?.titulo, 'Tutorial');
  for (const o of ['au-chat', 'au-config']) {
    assert.ok(PASOS_AUTOMATIONS.some((p) => p.objetivo === o), `falta el paso ${o}`);
    assert.ok(DONDE[o]?.length, `falta dónde está ${o}`);
  }
  assert.equal(PASOS_DEL_LIENZO[0].objetivo, 'au-chat');
});

// ── 5. El aviso de Prospección ───────────────────────────────────────────────────

test('5: Publicar y Probar avisan si el CRON elige un funnel de Prospección y la automatización no tiene lo suyo', () => {
  const productos = [
    { funnelId: 4, esDefault: true, prospeccion: false },
    { funnelId: 7, esDefault: false, prospeccion: true },
  ];
  assert.equal(cronDeProspeccion([{ trigger_tipo: 'etapa_actual', funnel_id: 7 }], productos, null), true);
  assert.equal(cronDeProspeccion([{ trigger_tipo: 'etapa_actual', funnel_id: 4 }], productos, null), false);
  // Sin embudo propio: el de la fila; sin ése, el de por defecto.
  assert.equal(cronDeProspeccion([{ trigger_tipo: 'etapa_actual', funnel_id: null }], productos, 7), true);
  assert.equal(cronDeProspeccion([{ trigger_tipo: 'etapa_actual' }], productos, null), false);
  // Una etiqueta o un evento no eligen funnel.
  assert.equal(cronDeProspeccion([{ trigger_tipo: 'etiqueta_puesta' }, { trigger_tipo: 'instagram' }], productos, 7), false);
  const perfil = PERFIL();
  // 20/10/2026: y adentro, el aviso de una automatización duplicada (tests/recurrente-no-salio.test.ts).
  assert.match(perfil, /<button onClick=\{\(\) => conAvisoProspeccion\(\(\) => conAvisoDuplicada\(activa, 'Publicar igual', \(\) => void publicar\(\)\)\)\}/);
  assert.match(perfil, /conAvisoProspeccion\(\(\) => onProbar\(canal\)\);/);
  assert.match(perfil, /!cronDeProspeccion\(crons\.lista, productos, secuencia\.funnel_id \?\? null\)\) \{ seguir\(\); return; \}/);
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): la que ya tiene lo suyo queda avisada, y una consulta a la vez.
  assert.match(perfil, /\.then\(\(propia\) => \{ if \(propia\) \{ avisadaProspeccion\.add\(secuencia\.id\); seguir\(\); \} else setAvisoProspeccion\(\{ seguir \}\); \}\)/);
  // El funnel dice si es de Prospección (su tipo: `tipoDeFunnel`).
  assert.match(sinComentarios(leer('lib/setting-secuencias.ts')), /if \(tipoDeFunnel\(parseEntradas\(f\.entradas\)\)\?\.id === 'prospeccion'\) out\.add\(Number\(f\.id\)\);/);
});

// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-chat-siempre.json`, una rotura por vez y restaurada con
// md5 igual). Base 8 / 0. Pasan / fallan:
//    1. el muelle de la derecha vuelve a contar el chat            → 7 / 1
//    2. el chat con su ✕                                          → 7 / 1
//    3. tocar la abierta no vuelve al chat                        → 7 / 1
//    4. sin la tuerca                                             → 7 / 1
//    5. el «⋯» sin «Configuraciones»                              → 7 / 1
//    6. el horario propio no cuenta                               → 6 / 2
//    7. «sin horario» propio vuelve al del negocio                → 6 / 2
//    8. (era: las horas propias a la misma persona; se fue el 23/10/2026, ahora es el goteo propio)  → 7 / 1
//    9. `null` no vuelve a lo del negocio                         → 7 / 1
//   10. sin zona, abierta                                         → 7 / 1
//   11. el motor no mira la automatización de la fila             → 7 / 1
//   12. «no pude leer» = «nada propio»                            → 7 / 1
//   13. el tick sin los horarios propios                          → 7 / 1
//   14. el menú deja de ser el «?»                                → 7 / 1
//   15. Prospección sin el funnel de la fila                      → 7 / 1
//   16. Publicar sin el aviso                                     → 7 / 1
//   17. avisa aunque tenga lo suyo                                → 7 / 1
//   18. (era: el freno con las horas de otra automatización; se fue el 23/10/2026 con «Misma persona»)
//   19. la «←» sin `onVolver`                                     → 7 / 1
