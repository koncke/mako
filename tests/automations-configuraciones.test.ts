// =============================================================================
// «Configuraciones» de Automations: el horario de oficina y los LÍMITES (décima tanda, GENERAL 4, 11/10/2026)
// =============================================================================
// Pedido de Martín, textual: «Quiero agregar un botón de "Configuraciones", que se despliegue un modal, dentro
// se puede editar el horario de oficina... Pero también configuraciones sobre todo para limitaciones de todos
// los flujos, si estoy prospectando en frio con esto, que se tenga en cuenta las configuraciones que en su
// momento tuvimos en cuenta, como que no se envien más de X cantidad de mensajes... Que todo eso sea
// configurable.» Diseño: docs/diseno-automations-configuraciones.md §1.
//
// Reemplaza a tests/automations-horario.test.ts: el botón del horario con su panel anclado
// (HorarioLista + HorarioBoton) se fue, y «Configuraciones» se monta en los mismos dos lugares.
//
// Lo que se fija:
//   · lib/limites-envio.ts, EJECUTADO: lo de fábrica (env o constante), el saneo, el merge campo por campo,
//     el guardado que rechaza (nunca recorta) y guarda sólo lo que difiere;
//   · el motor lee los límites UNA vez por corrida, ESTRICTO, y los usa en los cuatro topes y en el freno;
//   · el setter: el tope y el horario por parámetro, y su call site los lee (el horario de oficina si está prendido);
//   · la pantalla: el menú en los dos lugares (desde la undécima tanda, antes del buscador), el Modal con
//     `onCerrar` fijo, los dos paneles montados.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  KEY_LIMITES_ENVIO, LIMITES_CONSTANTES, RANGOS_LIMITES, CAMPOS_LIMITES, BLOQUES_LIMITES, limitesDeFabrica, sanearLimites,
  limitesVigentes, limitesParaGuardar, difiereDeFabrica, lineaDeUso, leerNumero, type LimitesEnvio,
} from '../lib/limites-envio';
import { puedeContestarSolo, conversacionAbierta, type InscCharla } from '../lib/setter-conversacion';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
/** El cuerpo de una función: desde su apertura hasta lo que abre el bloque siguiente. */
const bloque = (src: string, desde: string, hasta: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré «${desde}»`);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(ini, fin);
};

const FAB = LIMITES_CONSTANTES;

// ── lib/limites-envio.ts ──────────────────────────────────────────────────────────────────

test('lo de fábrica es lo de hoy: el env si está puesto y es un entero positivo, si no la constante', () => {
  assert.deepEqual(limitesDeFabrica({}), FAB);
  // La rampa del email (arranqueDia, arranqueSube) se sumó el 4/11/2026: 50 el primer día y 50 más cada día que llega.
  assert.deepEqual(FAB, { wa: { dia: 40, hora: 6, personaHoras: 20 }, email: { dia: 100, personaHoras: 20, arranqueDia: 50, arranqueSube: 50 }, mako: { solasPor24h: 3, diasCharla: 7 } },
    'lo de fábrica tiene que ser lo que el motor tenía cableado el 11/10/2026 (y la rampa del 4/11)');
  const f = limitesDeFabrica({ NUTRICION_MAX_POR_DIA: '25', NUTRICION_MAX_POR_CORRIDA: '4', NUTRICION_MAX_EMAIL_POR_DIA: '300' });
  assert.equal(f.wa.dia, 25);
  assert.equal(f.wa.hora, 4);
  assert.equal(f.email.dia, 300);
  // Un env roto no se vuelve NaN (antes el tope dejaba de frenar): cae a la constante.
  assert.equal(limitesDeFabrica({ NUTRICION_MAX_POR_DIA: 'muchos' }).wa.dia, 40);
  assert.equal(limitesDeFabrica({ NUTRICION_MAX_POR_DIA: '0' }).wa.dia, 40);
  assert.equal(limitesDeFabrica({ NUTRICION_MAX_POR_DIA: ' ' }).wa.dia, 40);
});

test('el saneo: sólo lo que se entiende y está en rango; lo demás queda AUSENTE (= de fábrica)', () => {
  assert.deepEqual(sanearLimites(null), {});
  assert.deepEqual(sanearLimites('no es json'), {});
  assert.deepEqual(sanearLimites('[]'), {});
  assert.deepEqual(sanearLimites({ wa: { dia: 10, hora: 99, personaHoras: 2.5 }, email: 'x', mako: { solasPor24h: 0 } }),
    { wa: { dia: 10 }, mako: { solasPor24h: 0 } }, 'fuera de rango, no entero o sin grupo: ausente; el 0 de «solas» vale');
  assert.deepEqual(sanearLimites(JSON.stringify({ email: { dia: 500 } })), { email: { dia: 500 } }, 'el extremo del rango entra');
});

test('lo vigente: lo guardado encima de lo de fábrica, CAMPO POR CAMPO', () => {
  const fab = limitesDeFabrica({ NUTRICION_MAX_POR_DIA: '30' });
  const v = limitesVigentes({ wa: { hora: 3 } }, fab);
  assert.equal(v.wa.hora, 3, 'lo guardado manda');
  assert.equal(v.wa.dia, 30, 'un campo ausente es el de fábrica DE ESTE servidor, no la constante');
  assert.deepEqual(v.email, FAB.email);
  assert.deepEqual(limitesVigentes(null, fab), fab);
});

test('guardar: rechaza lo que está fuera de rango (nunca recorta) y escribe sólo lo que difiere', () => {
  const todo = (o: Partial<{ [G in keyof LimitesEnvio]: Partial<LimitesEnvio[G]> }>): LimitesEnvio => ({
    wa: { ...FAB.wa, ...o.wa }, email: { ...FAB.email, ...o.email }, mako: { ...FAB.mako, ...o.mako },
  });
  const r = limitesParaGuardar(todo({ wa: { dia: 10 } }), FAB);
  assert.deepEqual(r, { ok: true, valor: JSON.stringify({ wa: { dia: 10 } }) }, 'guarda sólo lo que difiere de fábrica');
  assert.deepEqual(limitesParaGuardar(todo({}), FAB), { ok: true, valor: '{}' }, 'todo de fábrica = «Restaurar»');
  for (const [o, nombre] of [
    [{ wa: { dia: 0 } }, /WhatsApp por día: entre 1 y 150/],
    [{ wa: { dia: 151 } }, /entre 1 y 150/],
    [{ wa: { personaHoras: 2 } }, /misma persona: entre 3 y 72/],
    [{ email: { dia: 2.5 } }, /Email por día/],
    [{ mako: { diasCharla: 31 } }, /entre 1 y 30/],
  ] as const) {
    const x = limitesParaGuardar(todo(o as never), FAB);
    assert.equal(x.ok, false, JSON.stringify(o));
    if (!x.ok) assert.match(x.error, nombre);
  }
  assert.equal(limitesParaGuardar({ wa: { dia: 10 } }, FAB).ok, false, 'un pedido incompleto no guarda la mitad');
  assert.equal(limitesParaGuardar(null, FAB).ok, false);
  assert.equal(difiereDeFabrica(FAB, FAB), false);
  assert.equal(difiereDeFabrica(todo({ mako: { solasPor24h: 0 } }), FAB), true);
});

test('los campos, los rangos y la pantalla son UNA lista: cada campo tiene su fila y su rango', () => {
  assert.equal(KEY_LIMITES_ENVIO, 'mako.limites_envio');
  const enPantalla = BLOQUES_LIMITES.flatMap((b) => b.filas.map((f) => `${f.grupo}.${f.campo}`));
  assert.deepEqual(enPantalla, CAMPOS_LIMITES.map((c) => `${c.grupo}.${c.campo}`), 'un límite sin fila no se puede cambiar');
  for (const { grupo, campo } of CAMPOS_LIMITES) {
    const [min, max] = (RANGOS_LIMITES[grupo] as Record<string, readonly [number, number]>)[campo];
    const def = (FAB[grupo] as Record<string, number>)[campo];
    assert.ok(def >= min && def <= max, `lo de fábrica de ${grupo}.${campo} no se podría elegir`);
  }
  // Los rótulos, de 1 a 3 palabras (AGENTS.md: el texto que se dibuja es corto).
  for (const b of BLOQUES_LIMITES) for (const f of b.filas) assert.ok(f.rotulo.split(/\s+/).length <= 3, `«${f.rotulo}» es largo`);
});

test('la línea de uso y el número escrito', () => {
  assert.equal(lineaDeUso('WhatsApp', { waDia: 6, waHora: 2, emailDia: 0 }, FAB), '24 h: 6 de 40 · Esta hora: 2 de 6');
  assert.equal(lineaDeUso('Email', { waDia: 6, waHora: 2, emailDia: 0 }, FAB), '24 h: 0 de 100');
  assert.equal(lineaDeUso('MaKo contesta sola', { waDia: 6, waHora: 2, emailDia: 0 }, FAB), null);
  assert.equal(lineaDeUso('WhatsApp', null, FAB), null, '«no pude contar» no se dibuja como cero');
  assert.deepEqual(leerNumero(' 12 ', 1, 150), { ok: true, n: 12 });
  assert.deepEqual(leerNumero('0', 1, 150), { ok: false, error: 'Entre 1 y 150.' });
  assert.deepEqual(leerNumero('', 0, 10), { ok: false, error: 'Entre 0 y 10.' });
  assert.deepEqual(leerNumero('0', 0, 10), { ok: true, n: 0 });
});

// ── El motor ──────────────────────────────────────────────────────────────────────────────

const NUTRI = fuente('lib/nutricion.ts');
const PROC = bloque(NUTRI, 'export async function procesarEnvios(', '\nexport ');

test('el motor lee los límites UNA vez por corrida, ESTRICTO, antes de cualquier tope', () => {
  const lector = bloque(NUTRI, 'async function limitesDeEnvio(', '\n}');
  assert.match(lector, /limitesVigentes\(await getSettingEstricto\(KEY_LIMITES_ENVIO\), limitesDeFabrica\(process\.env\)\)/, 'no se lee estricto, o sin lo de fábrica del server');
  assert.match(lector, /catch \{ return 'ilegible'; \}/);
  assert.equal(PROC.split('await limitesDeEnvio()').length - 1, 1, 'una lectura por corrida');
  const iLee = PROC.indexOf('const limites = await limitesDeEnvio();');
  // 20/10/2026: también lo propio de cada automatización (`configs`): «no pude leer» tampoco es «como el negocio».
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): lo propio ilegible no corta acá (el horario ya cerró la prospección: corre sólo
  // el carril y lo que no espera, con las horas del negocio).
  // Revisión del 20/10/2026, noche (tests/automations-aviso-todos-caminos.test.ts): y con `ignorar_ventana` lo propio ilegible corta acá.
  const iIlegible = PROC.indexOf("if (limites === 'ilegible' || (configs === 'ilegible' && fueraDeHorario == null)) return { ...res, saltado: 'limites-ilegibles' };");
  const iPresupuesto = PROC.indexOf('const presupuesto = ');
  assert.ok(iLee > 0 && iIlegible > iLee && iPresupuesto > iIlegible, '«no pude leer» no es «de fábrica»: la corrida no manda');
});

test('los cuatro topes y el freno salen de lo leído, no de una constante', () => {
  assert.match(PROC, /const presupuesto = limites\.wa\.dia - \(await enviosUltimas24h\('whatsapp'\)\);/);
  // El de email, con la rampa del dominio desde el 4/11/2026: el tope de HOY sale de lo leído (`limites.email`), y si no se
  // puede leer lo que ya mandó, el del primer día (menos, nunca más). tests/email-campana-topes.test.ts corre el motor.
  assert.match(PROC, /const presupuestoEmail = conEmail\.length \? topeEmailHoy - \(await enviosUltimas24h\('email'\)\) : 0;/);
  assert.match(PROC, /await topeEmailDeHoy\(supabase, limites\.email, await zonaParaArranque\(\)\)/, 'la rampa sale de los límites leídos');
  assert.match(PROC, /return Math\.min\(limites\.email\.dia, limites\.email\.arranqueDia\);/, 'sin leer lo mandado, el del primer día');
  assert.match(PROC, /const cupo = Math\.max\(0, Math\.min\(limites\.wa\.hora - enLaHora, presupuesto\)\);/);
  assert.match(PROC, /const LOTE = \(cupo > 0 \? cupo : limites\.wa\.hora\) \* 3;/);
  // 23/10/2026 (Martín: «elimina "Misma persona"»): el motor ya no lee horas a la misma persona, ni las del negocio ni las de cada
  // automatización. No hay ventana de la base: `conEnvioRecienteDe` devuelve SIN_VENTANA y sólo queda el freno de la MISMA corrida.
  assert.match(PROC, /const conEnvioRecienteDe = \(_secId: number\): RecientesPorCanal => SIN_VENTANA;/);
  assert.doesNotMatch(PROC, /ventanaDe|recientesPorVentana|leadsConEnvioReciente|personaHoras/);
  assert.doesNotMatch(NUTRI, /\b(MAX_POR_DIA|MAX_POR_CORRIDA|MAX_EMAIL_POR_DIA|HS_MIN_ENTRE_MSGS|HS_MIN_PREPARACION|HS_REUNION_CERCA)\b/, 'volvió una constante cableada');
  assert.doesNotMatch(NUTRI, /async function leadsConEnvioReciente\(/, 'volvió la lectura de la ventana de «Misma persona»');
  // El uso de la pantalla sale de los MISMOS contadores que el motor.
  const uso = bloque(NUTRI, 'export async function usoDelCupo(', '\n}');
  assert.match(uso, /enviosUltimas24h\('whatsapp'\), enviosEnLaHora\('whatsapp'\), enviosUltimas24h\('email'\)/);
});

// ── El setter ─────────────────────────────────────────────────────────────────────────────

const CONFIRMA = { titulo: 'Confirma', cuando: 'dice que sí', comoResponder: 'Confirma.', contestaSolo: true };
const BASE = { escenario: CONFIRMA, texto: '¡Perfecto! Nos vemos.', cierre: null, envioHabilitado: true, automaticasUltimas24h: 0, horaLocal: 11, bloqueado: false };

test('puedeContestarSolo: el tope y el horario por parámetro; sin ellos, lo de siempre', () => {
  assert.deepEqual(puedeContestarSolo(BASE), { ok: true });
  assert.deepEqual(puedeContestarSolo({ ...BASE, automaticasUltimas24h: 1, tope: 1 }), { ok: false, motivo: 'ya le contesté solo 1 vez hoy' });
  assert.deepEqual(puedeContestarSolo({ ...BASE, automaticasUltimas24h: 4, tope: 5 }), { ok: true }, 'el tope del negocio manda sobre el 3 de fábrica');
  assert.deepEqual(puedeContestarSolo({ ...BASE, tope: 0 }), { ok: false, motivo: 'elegiste que siempre quede en borrador' });
  // El horario de oficina (lo calcula el call site) manda sobre el 9 a 21.
  assert.deepEqual(puedeContestarSolo({ ...BASE, horaLocal: 22, enHorario: true }), { ok: true });
  assert.deepEqual(puedeContestarSolo({ ...BASE, horaLocal: 11, enHorario: false }), { ok: false, motivo: 'es fuera de horario' });
  assert.deepEqual(puedeContestarSolo({ ...BASE, horaLocal: 22 }), { ok: false, motivo: 'es fuera de horario' }, 'sin horario de oficina, 9 a 21');
});

test('conversacionAbierta: los días de la charla por parámetro', () => {
  const ahora = Date.parse('2026-10-11T12:00:00Z');
  const hace = (h: number) => new Date(ahora - h * 3_600_000).toISOString();
  const i: InscCharla = {
    id: 1, secuencia_id: 9, estado: 'respondio', desenlace: null, updated_at: hace(50), conversacion_ultima_at: hace(50),
    conversacion_cerrada_at: null, conversacion_cierre: null, tieneEnviado: true, asistida: true, pausada: false, reunionFutura: null,
  };
  assert.equal(conversacionAbierta([i], ahora).abierta, true, 'de fábrica, 7 días');
  const v = conversacionAbierta([i], ahora, 2);
  assert.deepEqual(v, { abierta: false, motivo: 'pasaron más de 2 días desde la última charla' });
  assert.equal(conversacionAbierta([i], ahora, 3).abierta, true);
});

test('el call site del setter lee el tope y el horario; con algo ilegible no sale solo', () => {
  const asistir = bloque(NUTRI, "const { puedeContestarSolo } = await import('@/lib/setter-conversacion');", 'if (d.ok) {');
  // Revisión del 20/10/2026 (tests/automations-config-revision.test.ts): «contesta sola» con el horario de ESA automatización (`horarioDeEnvioDe`).
  assert.match(asistir, /limitesDeEnvio\(\),\s*horarioDeEnvioDe\(secuencia\.id\),\s*\]\);/);
  assert.match(asistir, /const d = limites === 'ilegible' \|\| horario === 'ilegible'\s*\? \{ ok: false as const, motivo: 'no pude leer tus límites' \}/);
  assert.match(asistir, /tope: limites\.mako\.solasPor24h,/);
  // Revisión de la décima tanda (11/10/2026): en la zona de SIEMPRE de «Contesta sola» (`tz`, de `tzActual`), no en
  // la del motor (`dentroDeVentana`: Ciudad de México sin `mako.timezone`, que en el ws1 corría la ventana una hora).
  // La guarda de la zona, con su rotura, en tests/decima-revision.test.ts.
  assert.match(asistir, /enHorario: horario \? dentroDelHorario\(Date\.now\(\), tz, horario\) : undefined,/, 'el horario de oficina no manda sobre «contesta sola»');
  const seguir = bloque(NUTRI, 'async function seguirCharla(', '\n}');
  assert.match(seguir, /conversacionAbierta\(charla\.inscs, Date\.now\(\), lim === 'ilegible' \? undefined : lim\.mako\.diasCharla\)/);
});

// ── La pantalla ───────────────────────────────────────────────────────────────────────────

// ⚠️ UNDÉCIMA TANDA (11/10/2026, punto 9: «que los botones de "Configuraciones" y "Tutorial" estén en otro botón
// desplegable al inicio de la barra de busqueda»): el botón «Configuraciones» y el «?» del recorrido pasaron a ser
// UN menú (`MenuAutomations`), en los mismos dos lugares. El modal es el mismo, sin filetes (punto 1). Lo nuevo de la
// undécima lo fija tests/automations-undecima-ui.test.ts.
test('ChatAgentApp monta el menú de Configuraciones en los dos lugares del horario, y el horario de antes se fue', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  // 20/10/2026: y el modal de UNA automatización, que la tab le pasa a la lista y al lienzo como componente.
  assert.match(app, /import \{ MenuAutomations, ConfiguracionesModal, tieneConfigPropiaDe \} from '\.\/ConfiguracionesBoton';/);
  // Duodécima tanda (decisión 11): el cartel vacío se fue y la lista se dibuja también sin automatizaciones, así
  // que el menú vive en UN lugar, el de la lista.
  assert.equal(app.split('<MenuAutomations onTutorial={recorrido.reabrir} />').length - 1, 1, 'uno, en la lista');
  assert.match(app, /menu=\{<MenuAutomations onTutorial=\{recorrido\.reabrir\} \/>\}/, 'la tab no le pasa el menú a la lista');
  assert.doesNotMatch(app, /Todavía no hay automatizaciones/, 'volvió el cartel vacío');
  assert.doesNotMatch(app, /HorarioLista|<ConfiguracionesBoton|horario=\{/);
  for (const r of ['app/automations/HorarioLista.tsx', 'app/automations/HorarioBoton.tsx']) assert.equal(existsSync(new URL(`../${r}`, import.meta.url)), false, `${r} volvió`);
});

// ⚠️ 20/10/2026 (Martín, 16/10 punto 5: «"configuraciones" ya no viva para todo Automations, sino para cada chat en los 3
// puntos»): el modal es de UNA automatización (`secuenciaId`), lo abren la tuerca del título y el «⋯» de la fila, y el
// menú de la lista es sólo el «?». Lo nuevo, en tests/automations-chat-siempre.test.ts.
// 23/10/2026 (Martín: «Todo vive en UNA sola pantalla, sin pestañas»): sin pestañas; la pantalla es `AjustesDeLaAutomatizacion`.
test('el modal: una pantalla, `onCerrar` fijo que no cierra con un guardado en vuelo, por portal', () => {
  const src = fuente('app/automations/ConfiguracionesBoton.tsx');
  // (22/10/2026: sin el nombre de la automatización arriba: el modal no lo usa.)
  assert.match(src, /export function ConfiguracionesModal\(\{ secuenciaId, onCerrar \}: PropsConfiguraciones\) \{/);
  assert.match(src, /const cerrar = useCerrarEstable\(onCerrar, ocupado\);/, 'el Modal recibe una flecha nueva por render, o cierra con el guardado en vuelo');
  // Quien lo abre le pasa un `onCerrar` de identidad FIJA (el lienzo y la lista).
  assert.match(fuente('app/automations/SecuenciaPerfil.tsx'), /const cerrarConfig = useCallback\(\(\) => \{ setConfigAbierta\(false\); alCerrarConfig\.current\(\); \}, \[\]\);/);
  assert.match(fuente('app/automations/SimuladorWhatsApp.tsx'), /const cerrarConfigDe = useCallback\(\(\) => \{ setConfigDe\(null\); alCerrarConfigDe\.current\(\); \}, \[\]\);/);
  assert.match(src, /<Modal titulo="Configuraciones" onCerrar=\{cerrar\} ancho=\{600\} alto="[^"]+" sinFiletes>/, 'el modal salta de alto');
  assert.match(src, /createPortal\(\s*<Modal /);
  // El MISMO editor del horario, guardando en ESTA automatización (`fuente`).
  assert.match(fuente('app/automations/ConfigAutomatizacionPanel.tsx'), /return <HorarioEnvioPanel fuente=\{fuente\} onSucio=\{onSucio\} \/>;/, 'no es el MISMO editor del horario');
  // UNA pantalla, con los dos «sucio» (horario y lo de la automatización; la línea se fue el 23/10/2026).
  assert.match(src, /<AjustesDeLaAutomatizacion secuenciaId=\{secuenciaId\} onSucioHorario=\{alSucioHorario\} onSucioAntiban=\{alSucioAntiban\} \/>/);
  assert.doesNotMatch(src, /<Tabs |hidden=\{pestana/, 'volvieron las pestañas');
  for (const r of ['app/automations/ConfiguracionesBoton.tsx', 'app/automations/LimitesEnvioPanel.tsx', 'app/automations/ConfigAutomatizacionPanel.tsx']) {
    assert.doesNotMatch(fuente(r), /href=|<Link\b|router\.(push|replace)|window\.location|['"`]\/configuraciones/, `${r} manda a otro lado`);
  }
  // (Acá se miraba el `buttonStyle` del desplegable del menú: desde el 20/10/2026 el menú es el «?», un botón.)
  assert.doesNotMatch(src, /<Dropdown /, 'el menú volvió a ser un desplegable');
});

// 23/10/2026 (Martín: «No quiero nada para todas las automatizaciones»): los límites de la LÍNEA se fueron de la pantalla,
// con su hook y sus acciones. Los topes duros siguen por dentro (lib/limites-envio.ts) y frenan con su motivo en la tarjeta.
test('los límites de la línea ya no se ven ni se editan desde una automatización; queda el número', () => {
  const p = fuente('app/automations/LimitesEnvioPanel.tsx');
  assert.doesNotMatch(p, /useLimitesDeLaLinea|saveLimitesEnvioAction|getLimitesEnvioAction|data-restaurar/, 'volvió lo de la línea');
  // El número que usan las filas de la automatización: lo escrito que no vale NO se guarda, se dice al lado.
  assert.match(p, /if \(r\.ok\) \{ onInvalido\(null\); onCambio\(r\.n\); \} else onInvalido\(r\.error\);/);
  assert.ok(!existsSync(new URL('../app/configuraciones/limites-actions.ts', import.meta.url)), 'volvieron las acciones de la línea');
  // (Desde la undécima tanda también los nombres nuevos: el menú y el modal viven en ConfiguracionesBoton.tsx.)
  for (const r of ['app/automations/SimuladorWhatsApp.tsx']) assert.doesNotMatch(fuente(r), /ConfiguracionesBoton|MenuAutomations|ConfiguracionesModal|limites-actions|horario-actions/, `${r} arrastraría server-only a los tests`);
});

test('el panel del horario avisa si hay un guardado en vuelo ANTES de todo return (lo usa el modal)', () => {
  const src = fuente('app/configuraciones/HorarioEnvioPanel.tsx');
  const iEfecto = src.indexOf('useEffect(() => { onSucio?.(enVuelo); }, [enVuelo, onSucio]);');
  const iReturn = src.indexOf('if (!h) return');
  assert.ok(iEfecto > 0 && iReturn > iEfecto);
});

// Undécima tanda, punto 9: el renglón de «Chatbot» se fue, y el menú va ANTES del buscador.
test('la lista dibuja el menú que le pasa la tab antes del buscador, arriba de «＋ Nueva»', () => {
  const secuencia = {
    id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
    activa: true, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
  } as unknown as SecuenciaDto;
  const html = renderToStaticMarkup(createElement(SimuladorWhatsApp, {
    secuencias: [secuencia], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
    rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
    productos: [], disparadores: [], tz: null,
    menu: createElement('span', { 'data-prueba-config': '' }, 'C'),
  } as Parameters<typeof SimuladorWhatsApp>[0]));
  const iConfig = html.indexOf('data-prueba-config');
  const iBuscar = html.indexOf('aria-label="Buscar por nombre"');
  const iNueva = html.indexOf('>Nueva automatización</span>');
  assert.ok(iConfig >= 0 && iConfig < iBuscar && iBuscar < iNueva, 'el menú no va antes del buscador, arriba de «＋ Nueva»');
  assert.doesNotMatch(html, />Chatbot</, 'volvió el renglón de «Chatbot»');
});

// ── ROTURAS (11/10/2026) ──────────────────────────────────────────────────────────────────
// Una por vez, con el arnés config10-roturas.mjs del scratchpad (guarda el original en memoria, lo reescribe y
// comprueba el sha1; nunca `git checkout`), este archivo solo. Base: 16 pass / 0 fail.
//   R1. el motor lee los límites con `getSetting` (tolerante: la base caída = de fábrica)   → 15 / 1
//   R2. guardar escribe TODO, también lo de fábrica                                          → 15 / 1
//   R3. el setter ignora el tope del negocio (`const tope = TOPE_RESPUESTAS_SOLAS_24H`)      → 15 / 1
//   R4. cambiar de pestaña DESMONTA Límites (tiraba el guardado de su respiro)               → 15 / 1
//   R5. `useCerrarEstable` sin `ocupado`: el modal cierra con un guardado en vuelo          → 15 / 1
// Undécima tanda (11/10/2026, el menú y el modal sin filetes; arnés wf-undecima/w1-lista-ui/romper.mjs). Base 16 / 0:
//   C1. el modal con `useCerrarEstable(onCerrar)` sin `ocupado`                              → 15 / 1
//   C2. el menú le pasa al modal una flecha nueva por render                                → 15 / 1
//   C3. el menú va DESPUÉS del buscador                                                     → 15 / 1
//   C4. cambiar de pestaña DESMONTA Límites                                                 → 15 / 1
//   R5'. el modal sin `sinFiletes`                                                          → 15 / 1
//   T2. el cartel vacío sin el menú                                                         → 15 / 1
// Restaurado: 16 / 0.
