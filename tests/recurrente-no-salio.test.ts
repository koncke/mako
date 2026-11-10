// =============================================================================
// «Leila configuró una automatización recurrente y me dijo que no salió» (20/10/2026)
// =============================================================================
// Martín, 20/10/2026 (texto entero en docs/relevo/chatbot.md). Medido en el ws11 (sólo lectura): lo que «no salió» eran
// DOS cosas. #282 «Recordatorio clase reactivación» NO es un Recurrente: es «Está en la etapa» (reactivacion, funnel 4)
// sin horario; inscribió a 31 leads en la corrida de las 21:00Z y los 31 mensajes quedaron como BORRADOR (WhatsApp no
// oficial a leads sin pago: la regla anti-baneo del motor). El Recurrente de verdad era el d2 de #284 («martes 16:15»,
// 21:15Z), un CRON extra en `disparadores`: el tick no inscribía y salía a la hora en punto. Y #282 y el d2 de #284 iban
// a la misma etapa con casi el mismo recordatorio. ⛔ #282, #284 y sus borradores NO se tocan: lo decide Martín.
//
// Lo que fija:
//   (6) la pantalla dice «N mensajes esperando que los apruebes», por qué y a dónde (Chats › Borradores, que abre con
//       `?vista=borradores`), con el conteo del server; y el chat lo dice al activarla, con la MISMA regla del motor;
//   (7) un Recurrente sale a su minuto: el tick lee todos los CRON (las columnas y `disparadores`), corre el negocio con
//       uno que acaba de vencer e inscribe SÓLO los CRON con horario, con el compare-and-set de siempre, antes de mover
//       lo vencido;
//   (8) al activar, o al publicar una activa, avisa si otra activa le escribe a la misma gente: lo deciden los HECHOS (la
//       cohorte, el canal, los horarios), no el parecido del texto, y el aviso muestra el arranque de los dos (21/10/2026).
//
// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-no-salio.json`): ver el pie.
//
// Correr: node --import tsx --test tests/recurrente-no-salio.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  textoPorAprobar, contarPorAprobar, dejaBorradores, POR_QUE_SE_APRUEBAN, POR_QUE_CORTO, RUTA_APROBAR,
} from '../lib/mensajes-por-aprobar';
import { rutaChatsDeVista, vistaDeLink } from '../lib/chats-links';
import { saleSolo } from '../lib/nutricion-grafo-motor';
import { negociosConRecurrenteVencido, negociosDelTick, type FilaRecurrente } from '../lib/motor-tick';
import { duplicadaDe, mismaCohorte, primerMensaje, avisoDuplicada, type AutoParaComparar } from '../lib/automatizacion-duplicada';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { SecuenciaPerfil } from '../app/automations/SecuenciaPerfil';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import { muelles } from '../lib/lienzo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// Los primeros mensajes de verdad (ws11, leídos el 20/10/2026).
const TEXTO_282 = '¡Holaa {{nombre}}! Paso a recordarte que mañana miércoles nos vemos en la clase presencial de LíderMente en Gnius Huayacán (7.30pm a 9.30 pm) 🔥\n\n¿Contamos contigo mañana? 😊';
const TEXTO_284 = 'Holaa {{nombre}}! Mañana miércoles tenemos la sesión presencial de LíderMente a las 7:30 pm en Huayacán. ¿Cuento contigo?';
const msg = (id: string, cuerpo: string, extra: Record<string, unknown> = {}): PasoGrafo =>
  ({ id, canal: 'whatsapp', cuerpo, delay_horas: 0, asunto: null, template_wa: null, siguiente: null, ...extra }) as unknown as PasoGrafo;

// ── (6) Los mensajes que esperan que los apruebes ─────────────────────────────────────────────

test('(6) el texto: «N mensajes esperando que los apruebes», con el singular, y nada sin ninguno o sin leer', () => {
  assert.equal(textoPorAprobar(31), '31 mensajes esperando que los apruebes');
  assert.equal(textoPorAprobar(1), '1 mensaje esperando que lo apruebes');
  for (const n of [0, null, undefined, Number.NaN, -3]) assert.equal(textoPorAprobar(n), null, String(n));
  assert.equal(POR_QUE_SE_APRUEBAN, 'Por WhatsApp no oficial, los mensajes a leads que no pagaron quedan para que los apruebes');
  // Donde se aprueban: la bandeja «Borradores» de Chats, por el link que ChatsApp entiende.
  assert.equal(RUTA_APROBAR, '/chats?vista=borradores');
  assert.equal(rutaChatsDeVista('borradores'), RUTA_APROBAR);
  assert.equal(vistaDeLink('borradores'), 'borradores');
  assert.equal(vistaDeLink(' borradores '), 'borradores');
  for (const v of ['mios', '', null, 'BORRADORES']) assert.equal(vistaDeLink(v), null, String(v));
});

test('(6) el conteo, por automatización (31 de #282, 11 de #241, 1 de #284), sin las filas sin automatización', () => {
  const filas = [
    ...Array.from({ length: 31 }, () => ({ secuencia_id: '282' })),
    ...Array.from({ length: 11 }, () => ({ secuencia_id: 241 })),
    { secuencia_id: 284 }, { secuencia_id: null }, { secuencia_id: 'x' }, { secuencia_id: 0 },
  ];
  const c = contarPorAprobar(filas);
  assert.deepEqual([...c.entries()].sort((a, b) => a[0] - b[0]), [[241, 11], [282, 31], [284, 1]]);
});

test('(6) ¿quedan para aprobar? La MISMA regla del motor (`saleSolo`), sólo WhatsApp y sin las respuestas de «Si responde»', () => {
  // La regla del motor, con su tabla entera: `revisar` gana; ausente, la de la automatización.
  for (const revisar of [true, false, undefined] as const) for (const auto of [true, false]) {
    assert.equal(dejaBorradores([msg('a', 'Hola', revisar === undefined ? {} : { revisar })], auto), !saleSolo({ revisar }, auto), `revisar=${revisar} auto=${auto}`);
  }
  // El #282 de verdad: WhatsApp, sin `revisar`, la automatización sin «sale sola». Desde el 23/10/2026 un mensaje de una
  // automatización SALE (`saleSolo`): ya no deja borradores.
  assert.equal(dejaBorradores([msg('n063a54', TEXTO_282)], false), false);
  // Un email no es WhatsApp no oficial.
  assert.equal(dejaBorradores([msg('a', 'Hola', { canal: 'email' })], false), false);
  // Una respuesta de «Si responde» tiene su regla propia y no sale al activar.
  const conRespuesta = [
    msg('m1', 'Hola', { revisar: false, siguiente: 'r1' }),
    { id: 'r1', nodo: 'respuesta', canal: 'whatsapp', casos: [{ id: 'c1', titulo: 'Sí', cuando: '', siguiente: 'ia1' }] },
    msg('ia1', 'Felicítalo', { tipo: 'ia' }),
  ] as unknown as PasoGrafo[];
  assert.equal(dejaBorradores(conRespuesta, false), false, 'una respuesta de IA contó como mensaje que queda para aprobar');
  // Y el motor sigue decidiendo así: si cambia la regla, cambia acá.
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /const saleSoloEste = saleSolo\(paso, sec\.envio_automatico\);/);
  assert.match(motor, /\} else if \(saleSoloEste \|\| await esLeadCliente\(lead\.id\)\) \{/);
});

test('(6) el server cuenta los pendientes del MOTOR por automatización, tolerante (null = no se pudo leer)', () => {
  const src = sinComentarios(leer('lib/setting-secuencias.ts'));
  assert.match(src, /leerTodo<\{ secuencia_id: number \| null \}>\(supabase, 'wa_borradores', 'id, secuencia_id', \{\n\s+orden: 'id', eq: \{ estado: 'pendiente', origen: 'nutricion' \},\n\s+filtros: \(q\) => q\.not\('secuencia_id', 'is', null\),/);
  assert.match(src, /return contarPorAprobar\(filas\);\n\s+\} catch \(e\) \{\n[^\n]*\n\s+return null;/);
  assert.match(src, /por_aprobar: porAprobar \? \(porAprobar\.get\(s\.id\) \?\? 0\) : null,/);
});

const SEC_282 = {
  id: 282, clave: 'r', nombre: 'Recordatorio clase reactivación', etapa: 'reactivacion', trigger_tipo: 'etapa_actual', funnel_id: 4,
  activa: true, pasos: [msg('n063a54', TEXTO_282)], inscriptos: 31, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;
const dibujar = (sec: SecuenciaDto): string => renderToStaticMarkup(createElement(SecuenciaPerfil, {
  secuencia: sec, secuencias: [sec], productos: [], disparadores: [], onAbrirClave: () => {}, objetivos: [],
  etiquetaEtapa: (k: string) => k, rolAdmin: true, audios: [], negocio: 'LíderMente', canalCaido: false, tz: null,
  onAudioNuevo: () => {}, onCambio: () => {}, muelles: muelles({ w: 1440, h: 900 }, { listaAbierta: true, probarAbierto: false, editorAbierto: false }),
} as Parameters<typeof SecuenciaPerfil>[0]));

test('(6) dibujada: al lado de «Activar», «31 mensajes esperando que los apruebes», el porqué y el link a Borradores', () => {
  const html = dibujar({ ...SEC_282, por_aprobar: 31 });
  assert.match(html, /31 mensajes esperando que los apruebes →/);
  assert.ok(html.includes(POR_QUE_CORTO), 'falta el porqué corto');
  assert.match(html, /href="\/chats\?vista=borradores"/, 'el conteo no lleva a donde se aprueban');
  // Sin ninguno, o sin poder leerlos, no se dice nada.
  for (const n of [0, null, undefined]) assert.doesNotMatch(dibujar({ ...SEC_282, por_aprobar: n }), /esperando que lo/, String(n));
});

test('(6) Chats abre la bandeja del link, con «Todas», y la URL vuelve a /chats', () => {
  const src = sinComentarios(leer('app/chats/ChatsApp.tsx'));
  assert.match(src, /const vistaLink = vistaDeLink\(sp\.get\(PARAM_CHATS\.vista\)\);/);
  assert.match(src, /setFiltro\(\(f\) => \(\{ \.\.\.f, vista: vistaLink, canal: null, cuenta: null, etapa: null, mostrar: 'todas' \}\)\);\n\s+router\.replace\(RUTA_CHATS, \{ scroll: false \}\);/);
  // Después de lo recordado (los efectos corren en orden): si no, lo recordado pisaba «Todas».
  assert.ok(src.indexOf("filtroRecordado(leerLocal(st, ws, 'filtro'))") < src.indexOf('const vistaLink = vistaDeLink('), 'la vista del link va antes de lo recordado');
});

test('(6) al ACTIVARLA el chat dice por qué quedan para aprobar (sólo si quedan), y ChatMako lo agrega una vez', () => {
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  // Revisión del 20/10/2026, noche (tests/automations-aviso-todos-caminos.test.ts): con lo PUBLICADO: Activar prende la fila, no el borrador.
  assert.match(perfil, /if \(!activa && dejaBorradores\(abiertoPublicado, est\?\.envio_automatico === true\)\) \{\n\s+setNotaChat\(\{ id: `mako-aprobar-\$\{Date\.now\(\)\.toString\(36\)\}`, texto: `\$\{POR_QUE_SE_APRUEBAN\}\. Se aprueban en Chats › Borradores\.` \}\);/);
  // 25/10: después de alTerminarSinVer va la tuerca del título (f19, onAbrirConfiguraciones), con su comentario: la nota sigue yendo una vez.
  assert.match(perfil, /onListaCambio=\{onListaCambio\} nota=\{notaChat\}\n?\s*(?:alTerminarSinVer=\{guardarSinVer\}\s*)?(?:\/\/[^\n]*\n\s*)?(?:onAbrirConfiguraciones=\{[^}]*\}[^\n]*\s*)?\/>/);
  const chat = sinComentarios(leer('app/automations/ChatMako.tsx'));
  assert.match(chat, /if \(!nota \|\| notaDicha\.current === nota\.id\) return;\n\s+notaDicha\.current = nota\.id;\n\s+setMensajes\(\(ms\) => \[\.\.\.ms, \{ id: nota\.id, de: 'mako', texto: nota\.texto,/);
});

// ── (7) Un Recurrente sale a su minuto ────────────────────────────────────────────────────────

// El #284 de verdad: el primero (columnas) por etapa sin horario; el d2, Recurrente martes 16:15 = 21:15Z.
const FILA_284: FilaRecurrente = {
  workspace_id: '11', trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: null, funnel_id: '4', cron: null, cron_proxima_at: null,
  disparadores: [
    { id: 'd1', etapa: 'agenda', etapas: null, funnel_id: 4, trigger_tipo: 'etapa_actual', cron_proxima_at: null },
    { id: 'd2', cron: { cada: 1, hora: 16, minuto: 15, unidad: 'semana', diaSemana: 2 }, etapa: 'reactivacion', etapas: null, funnel_id: 4, trigger_tipo: 'etapa_actual', cron_proxima_at: '2026-10-20T21:15:00.000Z' },
  ],
};
const MIN = 60_000;
const T = Date.parse('2026-10-20T21:15:00.000Z');

test('(7) qué negocio tiene un Recurrente que ACABA de llegar a su hora: todos sus CRON, sólo lo fresco', () => {
  assert.deepEqual(negociosConRecurrenteVencido([FILA_284], T + MIN, T + MIN - 10 * MIN), [11], 'el d2 de #284 no se ve: el tick lo dejaba para las 22:00');
  // Todavía no llegó, o ya pasó la ventana fresca (lo viejo lo barre la corrida de cada hora).
  assert.deepEqual(negociosConRecurrenteVencido([FILA_284], T - MIN, T - 11 * MIN), []);
  assert.deepEqual(negociosConRecurrenteVencido([FILA_284], T + 11 * MIN, T + MIN), []);
  // El primero, en las columnas.
  const primero: FilaRecurrente = { workspace_id: 9, trigger_tipo: 'etapa_actual', etapa: 'nuevo', cron: { cada: 1, hora: 9, minuto: 30, unidad: 'dia' }, cron_proxima_at: new Date(T).toISOString() };
  assert.deepEqual(negociosConRecurrenteVencido([primero, FILA_284], T + MIN, T - 9 * MIN), [9, 11]);
  // Sin horario, o sin ocurrencia sembrada, no hay nada que reclamar.
  assert.deepEqual(negociosConRecurrenteVencido([{ ...primero, cron: null }], T + MIN, T - 9 * MIN), []);
  assert.deepEqual(negociosConRecurrenteVencido([{ ...primero, cron_proxima_at: null }], T + MIN, T - 9 * MIN), []);
  assert.deepEqual(negociosConRecurrenteVencido([{ ...primero, workspace_id: null }], T + MIN, T - 9 * MIN), []);
});

test('(7) el tick corre el negocio con el Recurrente sin pisar su motivo, y un pausado no corre', () => {
  const activos = new Set([1, 3, 11]);
  assert.deepEqual(negociosDelTick({ activos, conVencidoFresco: [1], abrieronConVencido: [3], conRecurrente: [11, 3, 7] }), [
    { ws: 1, motivo: 'vencio' }, { ws: 3, motivo: 'abrio', recurrente: true }, { ws: 11, motivo: 'recurrente', recurrente: true },
  ]);
  // Lo de siempre, sin Recurrentes, igual que antes.
  assert.deepEqual(negociosDelTick({ activos, conVencidoFresco: [1], abrieronConVencido: [] }), [{ ws: 1, motivo: 'vencio' }]);
});

test('(7) la ruta: lee los CRON de las activas, inscribe SÓLO los Recurrentes ANTES de mover lo vencido, y tolera la lectura', () => {
  const ruta = sinComentarios(leer('app/api/cron/nutricion-tick/route.ts'));
  assert.match(ruta, /\.from\('nutricion_secuencias'\)\n\s+\.select\('workspace_id, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at, disparadores'\)\n\s+\.eq\('activa', true\)\.is\('archivada_at', null\)/);
  assert.match(ruta, /if \(eSecs\) console\.error\(/, 'una lectura que falla tiraba el tick entero (y con él las esperas)');
  assert.match(ruta, /else conRecurrente = negociosConRecurrenteVencido\(\(secs \?\? \[\]\) as FilaRecurrente\[\], ahora, Date\.parse\(desde\)\);/);
  // Sin nada (tampoco un Recurrente), sale antes de leer los workspaces.
  const sale = ruta.indexOf('if (!conVencidoFresco.length && !abrieronConVencido.length && !conRecurrente.length) return');
  assert.ok(sale > 0 && sale < ruta.indexOf('listarWorkspaces()'));
  const inscribe = ruta.indexOf('const inscriptas = recurrente ? await comprometerInscripciones({ soloRecurrentes: true, ...(!waOn && !emailOn ? { soloGrupo: true } : {}) }) : null;');
  assert.ok(inscribe > 0, 'el tick no inscribe el Recurrente');
  assert.ok(inscribe < ruta.indexOf('const proc = await procesarEnvios('), 'inscribe DESPUÉS de mover lo vencido: el primer mensaje esperaba al minuto siguiente');
  // Lo recién inscripto cae en la ventana fresca: `recurrente` no barre entero.
  assert.match(ruta, /\.\.\.\(motivo !== 'abrio' \? \{ vencidasDesde: desde \} : \{\}\)/);
});

test('(7) el barrido `soloRecurrentes` salta lo que no tiene horario y reclama con el MISMO compare-and-set', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  const ini = motor.indexOf('export async function comprometerInscripciones(');
  const cuerpo = motor.slice(ini, motor.indexOf('\n}\n', ini));
  assert.ok(cuerpo.length > 500 && cuerpo.length < 6000, `el recorte mide ${cuerpo.length}`);
  assert.match(cuerpo, /opts\?: \{ soloGrupo\?: boolean; soloRecurrentes\?: boolean \}/);
  assert.match(cuerpo, /if \(opts\?\.soloRecurrentes && !sec\.cron\) continue;\n\s+const agenda = decidirAgenda\(/);
  assert.match(cuerpo, /: await q\.eq\('cron_proxima_at', sec\.cron_proxima_at\)\.select\('id'\);/);
  assert.match(cuerpo, /\} else reclamada = await reclamarOcurrenciaExtra\(supabase, sec\.id, lista, sec\.disparador\.id, agenda\.proxima\);/);
});

// ── (8) Otra automatización ya le escribe lo mismo a la misma gente ───────────────────────────

const cron = (etapa: string, funnel_id: number | null, extra: Record<string, unknown> = {}) => ({ trigger_tipo: 'etapa_actual', etapa, funnel_id, ...extra });
const A_282: AutoParaComparar = { id: 282, nombre: 'Recordatorio clase reactivación', activa: true, disparadores: [cron('reactivacion', 4)], pasos: [msg('n063a54', TEXTO_282)] };
const ESTA_284 = { id: 284, nombre: 'Recordatorio martes sesión LíderMente', disparadores: [cron('agenda', 4), cron('reactivacion', 4)], pasos: [msg('ntbqp1f', TEXTO_284)] };

test('(8) #282 y el d2 de #284: la misma etapa por el mismo canal → avisa con el nombre de la otra y el arranque de los dos', () => {
  const d = duplicadaDe(ESTA_284, [A_282]);
  assert.deepEqual(d, {
    id: 282, nombre: 'Recordatorio clase reactivación',
    suyo: '¡Holaa {{nombre}}! Paso a recordarte que mañana miércoles nos vemos…',
    mio: 'Holaa {{nombre}}! Mañana miércoles tenemos la sesión presencial de…',
  });
  assert.equal(avisoDuplicada(d!), 'A la misma gente ya le escribe «Recordatorio clase reactivación»: «¡Holaa {{nombre}}! Paso a recordarte que mañana miércoles nos vemos…». Ésta: «Holaa {{nombre}}! Mañana miércoles tenemos la sesión presencial de…»');
});

test('(8) los HECHOS que no avisan: otra etapa, otro funnel, la otra pausada, ella misma, otro canal, horarios que no se pisan', () => {
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: [cron('agenda', 4)] }, [A_282]), null, 'otra etapa');
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: [cron('reactivacion', 5)] }, [A_282]), null, 'otro funnel');
  assert.equal(duplicadaDe(ESTA_284, [{ ...A_282, activa: false }]), null, 'la otra está pausada');
  assert.equal(duplicadaDe({ ...ESTA_284, id: 282 }, [A_282]), null, 'ella misma');
  assert.equal(duplicadaDe({ ...ESTA_284, pasos: [msg('y', TEXTO_284, { canal: 'email' })] }, [A_282]), null, 'otro canal');
  // Dos Recurrentes que no comparten día no le escriben a la vez; el mismo día (aunque a otra hora) sí, y uno que escribe
  // al entrar se pisa con cualquiera.
  const R = (c: Record<string, unknown>) => [cron('reactivacion', 4, { cron: c })];
  const martes = { unidad: 'semana', cada: 1, hora: 16, minuto: 15, diaSemana: 2 };
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: R(martes) }, [{ ...A_282, disparadores: R({ ...martes, diaSemana: 4 }) }]), null, 'martes y jueves');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R(martes) }, [{ ...A_282, disparadores: R({ ...martes, hora: 10 }) }]), 'el mismo martes a otra hora');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R(martes) }, [A_282]), 'un Recurrente y uno que escribe al entrar');
  const mes = (diaMes: number) => R({ unidad: 'mes', cada: 1, hora: 9, minuto: 0, diaMes });
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: mes(5) }, [{ ...A_282, disparadores: mes(20) }]), null, 'el 5 y el 20 de cada mes');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: mes(5) }, [{ ...A_282, disparadores: mes(5) }]), 'el 5 de cada mes, las dos');
  // ⚠️ Cerca de la medianoche, dos días distintos se pisan igual; y con OTRA zona, los días no se comparan (revisión del
  // 21/10/2026: «lunes 23:30» de Tijuana y «martes 00:30» de Ciudad de México salen en el mismo instante).
  const lunes2330 = { ...martes, diaSemana: 1, hora: 23, minuto: 30 };
  const martes0030 = { ...martes, hora: 0, minuto: 30 };
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R(lunes2330) }, [{ ...A_282, disparadores: R(martes0030) }]), 'lunes 23:30 y martes 00:30');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R(lunes2330) }, [{ ...A_282, disparadores: R({ ...martes0030, hora: 12, tz: 'America/Mexico_City' }) }]), 'otra zona');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R({ ...lunes2330, diaSemana: 6 }) }, [{ ...A_282, disparadores: R({ ...martes0030, diaSemana: 0 }) }]), 'sábado 23:30 y domingo 00:30');
  const mesA = (diaMes: number, hora: number) => R({ unidad: 'mes', cada: 1, hora, minuto: 0, diaMes });
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: mesA(28, 23) }, [{ ...A_282, disparadores: mesA(1, 1) }]), 'el 28 a las 23 y el 1 a la 1 (en febrero, dos horas)');
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: mes(28) }, [{ ...A_282, disparadores: mes(1) }]), null, 'el 28 y el 1 a la misma hora');
  assert.ok(duplicadaDe({ ...ESTA_284, disparadores: R({ unidad: 'mes', cada: 1, hora: 23, minuto: 0, diaMes: 10 }) }, [{ ...A_282, disparadores: R({ unidad: 'mes', cada: 1, hora: 1, minuto: 0, diaMes: 11 }) }]), 'el 10 a las 23 y el 11 a la 1');
  // Un funnel sin elegir es «todos»: alcanza a la misma gente.
  assert.equal(duplicadaDe({ ...ESTA_284, disparadores: [cron('reactivacion', null)] }, [A_282])?.id, 282);
  // ⚠️ Por evento, el mismo disparador con el mismo evento ES la misma gente: el motor inscribe al lead en todas las activas
  // (revisión del 21/10/2026; «no hay cohorte que se pise» era falso). «A mano» no: ahí no entra nadie solo.
  assert.equal(mismaCohorte({ trigger_tipo: 'instagram', subtipo: 'dm' }, { trigger_tipo: 'instagram', subtipo: 'dm' }), true);
  assert.equal(mismaCohorte({ trigger_tipo: 'instagram', subtipo: 'dm' }, { trigger_tipo: 'instagram', subtipo: 'comentario' }), false);
  assert.equal(mismaCohorte({ trigger_tipo: 'manual' }, { trigger_tipo: 'manual' }), false);
  assert.equal(mismaCohorte({ trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 }, { trigger_tipo: 'etiqueta_puesta', etiqueta_id: '3' }), true);
});

test('(8) el texto NUNCA decide: dos mensajes distintos, dos saludos cortos o un audio a la misma gente avisan', () => {
  // Tres rondas de reglas sobre el texto (umbral, firma de «la mayoría», firma al arranque) dejaron pasar duplicados de
  // verdad. Que le escriban a la misma gente es un hecho: la persona compara los dos arranques y decide.
  const otra = { ...A_282, pasos: [msg('x', 'Te dejo el link de la grabación de la clase para que la veas cuando puedas')] };
  assert.ok(duplicadaDe({ ...ESTA_284, pasos: [msg('y', '¿Pudiste ver la clase? Cuéntame qué te pareció')] }, [otra]), 'dos textos distintos');
  const corto = (t: string) => ({ ...A_282, pasos: [msg('c', t)] });
  assert.ok(duplicadaDe({ ...ESTA_284, pasos: [msg('d', 'Hola {{nombre}}, ¿cómo estás?')] }, [corto('Hola, ¿qué tal?')]), 'dos saludos cortos');
  assert.equal(duplicadaDe({ ...ESTA_284, pasos: [msg('d', '')] }, [A_282])?.mio, '(un audio o un archivo, sin texto)');
});

test('(8) el primer mensaje es el de la SALIDA (saltando esperas), no una respuesta de «Si responde»', () => {
  // `m2` va antes en el orden pero no es el camino: el primero es el que sigue a la espera.
  const pasos = [
    { id: 'i', nodo: 'inicio', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', espera: { cantidad: 1, unidad: 'horas' }, siguiente: 'm1' },
    msg('m2', 'Otro mensaje que no es el primero'),
    msg('m1', 'Mañana es la clase presencial'),
  ] as unknown as PasoGrafo[];
  assert.equal(primerMensaje(pasos), 'Mañana es la clase presencial');
  assert.equal(primerMensaje([msg('a', '', { siguiente: 'b' }), msg('b', 'El de verdad')]), 'El de verdad');
});

test('(8) la pantalla pregunta al ACTIVAR, y al PUBLICAR sólo si ya está activa; no frena', () => {
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  // Revisión del 20/10/2026, noche (tests/automations-aviso-todos-caminos.test.ts): Activar compara lo PUBLICADO (`abiertoPublicado`).
  // Desde el 10/11/2026 el clic pregunta antes `motivoParaNoActivar` (tests/activar-vacia.test.ts); la cadena es la misma.
  assert.match(perfil, /onClick=\{\(\) => \{\s*if \(activa\) \{ void toggle\(\); return; \}[\s\S]{0,400}?conAvisoDuplicada\(true, 'Activar igual', \(\) => void conExistentes\(\(\) => void conRitmo\(\(\) => void toggle\(\)\)\), abiertoPublicado\);\s*\}\}/);
  assert.match(perfil, /onClick=\{\(\) => conAvisoProspeccion\(\(\) => conAvisoDuplicada\(activa, 'Publicar igual', \(\) => void publicar\(\)\)\)\}/);
  assert.match(perfil, /if \(!rolAdmin \|\| !vaAMandar\) \{ seguir\(\); return; \}/);
  // Lo de AHORA de ésta (el lienzo y sus CRON) contra lo PUBLICADO de las otras.
  // (Revisión del 20/10/2026, noche: lo que se compara de ésta es `queManda`: el lienzo al publicar, lo publicado al activar.)
  assert.match(perfil, /\{ id: secuencia\.id, nombre, disparadores: crons\.lista, pasos: queManda \},\n\s+secuencias\.map\(\(s\) => \(\{ id: s\.id, nombre: s\.nombre, activa: s\.activa, disparadores: disparadoresDeSecuencia\(s\), pasos: s\.pasos \?\? \[\] \}\)\),/);
  // (21/10/2026: «… igual» marca la respuesta, `respondioIgual`, que el pedido que sigue manda al server como `aunqueDuplique`.)
  assert.match(perfil, /onConfirm=\{\(\) => \{ const s = avisoDup\.seguir; setAvisoDup\(null\); respondioIgual\.current = true; s\(\); \}\}\n\s+onCancel=\{\(\) => setAvisoDup\(null\)\} \/>/);
});

// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-no-salio.json`, una rotura por vez y restaurada con
// md5 igual). Base 15 / 0. Pasan / fallan:
//    1. sin el singular                                   → 14 / 1     17. corre el Recurrente de un pausado       → 14 / 1
//    2. con cero también dice                             → 13 / 2     18. el tick inscribe todo por cohorte       → 14 / 1
//    3. cuenta las filas sin automatización               → 14 / 1     19. la lectura que falla tira el tick       → 14 / 1
//    4. `dejaBorradores` sin el `revisar` del mensaje      → 14 / 1     20. sin el Recurrente en el early return    → 14 / 1
//    5. `dejaBorradores` cuenta las respuestas             → 14 / 1     21. el barrido ignora `soloRecurrentes`     → 14 / 1
//    6. `dejaBorradores` cuenta el email                   → 14 / 1     22. `recurrente` barre entero               → 14 / 1
//    7. el server sin el origen del motor                 → 14 / 1     23. un funnel sin elegir no es «todos»      → 14 / 1
//    8. «no pude leer» = ninguno                          → 14 / 1     24. sin mirar el funnel                     → 14 / 1
//    9. la pantalla no lo dibuja                          → 14 / 1     25. cuenta las pausadas                     → 14 / 1
//   10. el link a Chats sin la bandeja                    → 14 / 1     26. se avisa de sí misma                    → 14 / 1
//   11. Chats sin «Mostrar: Todas»                        → 14 / 1     27. el umbral en 0,7                        → 13 / 2
//   12. el chat lo dice aunque salgan solos               → 14 / 1     28. los saludos cortos por parecido         → 14 / 1
//   13. ChatMako repite la nota                           → 14 / 1     29. el primero sin saltar las esperas       → 14 / 1
//   14. el tick mira sólo el primer CRON                  → 14 / 1     30. Activar sin el aviso                    → 14 / 1
//   15. el tick sin la ventana fresca                     → 14 / 1     31. Publicar avisa aunque esté pausada      → 14 / 1
//   16. el Recurrente pisa el motivo                      → 14 / 1     32. «Activar igual» no sigue                → 14 / 1
// Restaurado: 15 / 0. (27 y 28 se fueron con la regla de texto el 21/10/2026: el (8) se rompe ahora en el bloque de abajo.)
//
// La red por HECHOS (21/10/2026, `roturas-hechos.json`, md5 igual al restaurar). Base 16 / 0. Cada una → 15 / 1 (salvo
// donde se dice):
//   H1. vuelve un umbral de parecido                    H7. el arranque parte una palabra
//   H2. sin mirar el canal                              H8. un mensaje sin texto no avisa
//   H3. sin mirar los horarios                          H10. la otra pausada cuenta
//   H4. un horario sin leer no se pisa       → 13 / 3   H14. dos mensuales no miran el día del mes
//   H5. el aviso sin los dos arranques
// Restaurado: 16 / 0. (H6, H9, H11–H13 y H15–H17 caen en los otros dos tests del aviso.)
//
// Por evento, por la API y los bajos (21/10/2026, `roturas-eventos.json`, md5 igual). Base 16 / 0. Cada una → 15 / 1:
//   E1. por evento vuelve a no compararse     Z2. semanal sin la medianoche
//   E2. sin mirar el evento (`subtipo`)       Z3. semanal sin la vuelta de la semana
//   E5. «a mano» cuenta como misma gente      Z4. mensual sin la vuelta del mes
//   Z1. sin mirar la zona                     Z5. mensual sin la medianoche
// Restaurado: 16 / 0. (Z4 no caía con la primera versión: la regla miraba «el 31 contra el 1», y el día del mes va
// hasta el 28; se rehízo con la vuelta de 28 días y se rompió de nuevo.)
