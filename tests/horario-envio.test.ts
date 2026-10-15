// =============================================================================
// El horario de envío: OPCIONAL, apagado por defecto, y lo vencido afuera sale al abrir
// =============================================================================
// Sexta tanda (09/10/2026). Martín, sobre el DELAY: «SI es que configuraste un "Horario de oficina"
// no deberías hacerlo... Eso se hace en todo caso en configuraciones, no aquí. No pongas esa
// limitación». Y el mismo día: «Sin límite, editable». Este test fija:
//
//   1. sin nada guardado (o apagado, o roto) NO hay horario: el motor manda a cualquier hora;
//   2. con horario, la hora y el DÍA son los del negocio, también el día del cambio de hora;
//   3. «sale al abrir»: `acabaDeAbrir` es verdad en los primeros minutos del horario y sólo ahí;
//   4. se guarda sólo lo que se sabe leer;
//   5. la pantalla existe (Configuraciones › Horario), la monta la fila de tabs y guarda un admin.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sanearHorario, horarioVigente, horarioParaGuardar, dentroDelHorario, acabaDeAbrir, relojEnZona,
  HORARIO_SUGERIDO, KEY_HORARIO_ENVIO, DIAS_PANTALLA, horaTexto,
} from '../lib/horario-envio';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const MX = 'America/Mexico_City';

test('sin horario guardado, apagado o roto: NO hay límite (la decisión de Martín)', () => {
  assert.equal(horarioVigente(null), null);
  assert.equal(horarioVigente(''), null);
  assert.equal(horarioVigente('no es json'), null);
  assert.equal(horarioVigente({ ...HORARIO_SUGERIDO, activo: false }), null, 'apagado no limita');
  assert.equal(horarioVigente(JSON.stringify({ activo: true, desde: 21, hasta: 9 })), null, 'cierra antes de abrir: no se entiende');
  assert.equal(horarioVigente({ activo: true, desde: 9, hasta: 21, dias: [] }), null, 'sin días: no se entiende');
  // Sin horario, cualquier instante está adentro: de día y de noche.
  for (const iso of ['2026-10-09T08:00:00Z', '2026-10-09T11:00:00Z', '2026-10-10T03:30:00Z']) {
    assert.equal(dentroDelHorario(Date.parse(iso), MX, null), true, `${iso} quedó afuera sin horario`);
  }
  // Y sin horario no hay apertura que barrer.
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:01:00Z'), MX, null, 10), false);
});

test('el saneo: lo que se guarda vuelve igual, los días sin repetir y en orden', () => {
  const h = sanearHorario(JSON.stringify({ activo: true, desde: 9, hasta: 18, dias: [5, 1, 1, 3, 9, 'x'] }));
  assert.deepEqual(h, { activo: true, desde: 9, hasta: 18, dias: [1, 3, 5], avisosAlEquipo: true });
  // Sin `dias` (una fila de antes de que existieran): todos.
  assert.deepEqual(sanearHorario({ activo: true, desde: 0, hasta: 24 })?.dias, [0, 1, 2, 3, 4, 5, 6]);
  // De media en media hora desde el 10/10/2026 (Martín: «Las horas debes ponerlas de media en media hora»).
  assert.deepEqual(sanearHorario({ activo: true, desde: 9.5, hasta: 18 }), { activo: true, desde: 9.5, hasta: 18, dias: [0, 1, 2, 3, 4, 5, 6], avisosAlEquipo: true });
  assert.equal(sanearHorario({ activo: true, desde: 9.25, hasta: 18 }), null, 'de media en media hora, nada más fino');
  assert.equal(sanearHorario({ activo: true, desde: -1, hasta: 18 }), null);
  assert.equal(sanearHorario({ activo: true, desde: 9, hasta: 25 }), null);
  assert.equal(KEY_HORARIO_ENVIO, 'mako.horario_envio');
});

test('con horario: la hora y el día del NEGOCIO (de 9 a 18, de lunes a viernes)', () => {
  const h = horarioVigente({ activo: true, desde: 9, hasta: 18, dias: [1, 2, 3, 4, 5] })!;
  // Viernes 9/10/2026. 15:00 UTC = 9:00 en Ciudad de México (UTC−6): adentro.
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T15:00:00Z'), MX, h), true);
  // 14:59 UTC = 8:59: afuera.
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T14:59:00Z'), MX, h), false);
  // 23:59 UTC = 17:59: adentro; 00:00 UTC del sábado = 18:00 del viernes: afuera («hasta» excluido).
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T23:59:00Z'), MX, h), true);
  assert.equal(dentroDelHorario(Date.parse('2026-10-10T00:00:00Z'), MX, h), false);
  // ⚠️ El DÍA es el de la zona: 03:00 UTC del sábado es viernes 21:00 en México (afuera por hora) y
  // sábado 10:00 UTC es sábado 4:00 (afuera por día). Sábado 16:00 UTC = 10:00 del sábado: afuera.
  assert.equal(dentroDelHorario(Date.parse('2026-10-10T16:00:00Z'), MX, h), false, 'el sábado no manda');
  // Buenos Aires (UTC−3): 12:00 UTC = 9:00 allá, y 6:00 en México.
  const ba = 'America/Argentina/Buenos_Aires';
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T12:00:00Z'), ba, h), true);
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T12:00:00Z'), MX, h), false);
  // El reloj de la zona, con su día.
  assert.deepEqual(relojEnZona(Date.parse('2026-10-10T03:00:00Z'), MX), { hora: 21, minuto: 0, dia: 5 });
});

test('el día del cambio de hora el horario sigue a la zona (Tijuana, 1/11/2026)', () => {
  const tj = 'America/Tijuana';
  const h = horarioVigente(HORARIO_SUGERIDO)!;
  // Sábado 16:30 UTC = 9:30 PDT (adentro); domingo 16:30 UTC = 8:30 PST (afuera).
  assert.equal(dentroDelHorario(Date.parse('2026-10-31T16:30:00Z'), tj, h), true);
  assert.equal(dentroDelHorario(Date.parse('2026-11-01T16:30:00Z'), tj, h), false);
});

test('⚠️ «sale al abrir»: `acabaDeAbrir` en los primeros minutos del horario, y sólo ahí', () => {
  const h = horarioVigente({ activo: true, desde: 9, hasta: 18, dias: [1, 2, 3, 4, 5] })!;
  // Viernes: 9:00, 9:03 y 9:09 en México → sí (ventana de 10 min); 9:10 → no; 8:59 → no.
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:00:00Z'), MX, h, 10), true);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:03:00Z'), MX, h, 10), true);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:09:59Z'), MX, h, 10), true);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:10:00Z'), MX, h, 10), false);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T14:59:00Z'), MX, h, 10), false);
  // Un sábado a las 9:00 no abre: no es un día del horario.
  assert.equal(acabaDeAbrir(Date.parse('2026-10-10T15:00:00Z'), MX, h, 10), false);
  // A las 12 tampoco: está abierto, pero no «acaba» de abrir.
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T18:00:00Z'), MX, h, 10), false);
});

test('se guarda sólo lo que se sabe leer, con el motivo que lee la persona', () => {
  const ok = horarioParaGuardar({ activo: true, desde: 9, hasta: 18, dias: [1, 2] });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.ok ? sanearHorario(ok.valor) : null, { activo: true, desde: 9, hasta: 18, dias: [1, 2], avisosAlEquipo: true });
  // Apagado también se guarda, y conserva lo elegido para cuando se vuelva a prender.
  const off = horarioParaGuardar({ activo: false, desde: 10, hasta: 19, dias: [0] });
  assert.equal(off.ok && sanearHorario(off.valor)?.desde, 10);
  const mal = horarioParaGuardar({ activo: true, desde: 18, hasta: 9, dias: [1] });
  assert.equal(mal.ok, false);
  assert.match(mal.ok ? '' : mal.error, /después/);
  const sinDias = horarioParaGuardar({ activo: true, desde: 9, hasta: 18, dias: [] });
  assert.match(sinDias.ok ? '' : sinDias.error, /al menos un día/);
});

// Revisión de la sexta tanda (10/10/2026, hallazgo 11): prender, sacar todos los días (o cerrar antes de
// abrir) y apagar dejaba el «Guardar» habilitado y el server contestaba «Elige al menos un día» con los
// días escondidos: el horario guardado seguía limitando los envíos. Apagado se guarda SIEMPRE.
// PROBADO ROMPIÉNDOLO (10/10/2026, restaurando de memoria; base 8/0): sin la línea del apagado → 7/1;
// apagando con cualquier cosa que no sea `true` (no un `false` literal) → 7/1.
test('apagado se guarda SIEMPRE, aunque los días o las horas no cierren; un pedido roto no apaga nada', () => {
  for (const h of [{ activo: false, desde: 9, hasta: 18, dias: [] }, { activo: false, desde: 20, hasta: 9, dias: [1] }, { activo: false, desde: 'x', dias: [] }]) {
    const r = horarioParaGuardar(h);
    assert.equal(r.ok, true, `no se pudo apagar con ${JSON.stringify(h)}`);
    const leido = r.ok ? sanearHorario(r.valor) : null;
    assert.equal(leido?.activo, false);
    // Lo que no cerraba se rellena con lo sugerido (lo mismo que propone la pantalla sin nada guardado).
    assert.deepEqual(leido, { ...HORARIO_SUGERIDO, activo: false });
    assert.equal(horarioVigente(r.ok ? r.valor : null), null, 'apagado no limita');
  }
  // Lo apagado que SÍ cierra conserva lo elegido (el test de arriba), y lo que no es un `false` literal no apaga.
  for (const roto of [null, 'apagar', { desde: 9, hasta: 18, dias: [] }, { activo: 'no', desde: 9, hasta: 18, dias: [] }]) {
    assert.equal(horarioParaGuardar(roto).ok, false, `${JSON.stringify(roto)} apagó el horario`);
  }
});

test('la pantalla: Configuraciones › Horario, la monta la fila de tabs y guarda un admin', () => {
  const tabs = sinComentarios(leer('app/configuraciones/ConfigInnerTabs.tsx'));
  assert.match(tabs, /import \{ HorarioEnvioPanel \} from '\.\/HorarioEnvioPanel';/);
  assert.match(tabs, /\.\.\.\(esAdmin \? \[\{ key: 'horario' as TabKey, label: 'Horario', panel: <HorarioEnvioPanel \/> \}\] : \[\]\)/, 'el panel existe y nadie lo monta');
  const acc = sinComentarios(leer('app/configuraciones/horario-actions.ts'));
  assert.match(acc, /^'use server';/m);
  // En un 'use server' sólo funciones async (AGENTS.md): los tipos y constantes viven en lib/.
  assert.doesNotMatch(acc, /export (const|type|function [^(]*\([^)]*\)\s*:\s*(?!Promise))/);
  assert.match(acc, /if \(rol !== 'admin'\) return \{ ok: false, error: 'Solo un admin puede cambiar el horario\.' \};/);
  assert.match(acc, /horarioParaGuardar\(h\)/, 'se guarda lo que el módulo sabe leer');
  assert.match(acc, /getSettingEstricto\(KEY_HORARIO_ENVIO\)/, '«no pude leer» no se dibuja como «sin horario»');
  // Lo que se dibuja: corto (AGENTS.md) y de tú (los leads y los clientes son de México).
  const panel = leer('app/configuraciones/HorarioEnvioPanel.tsx');
  // 10/10/2026: el título es «Horario de oficina», con un interruptor; sin la frase de arriba ni la de abajo.
  assert.ok(panel.includes('Horario de oficina'), 'falta el título «Horario de oficina»');
  assert.match(panel, /role="switch"/, 'el horario se prende con un interruptor, no con una casilla');
  for (const t of ['Limitar el horario', 'Lo que vence afuera sale al abrir.', 'Tus automatizaciones mandan a cualquier hora. Si quieres, ponles un horario.']) {
    assert.ok(!sinComentarios(panel).includes(t), `volvió «${t}»`);
  }
  assert.equal(DIAS_PANTALLA.length, 7);
  assert.equal(DIAS_PANTALLA[0].dia, 1, 'la semana arranca el lunes');
  assert.equal(horaTexto(24), '24:00');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (nunca `git checkout`), con este archivo solo. Base: 7 / 0.
//   H1. `horarioVigente` sin mirar `activo` (apagado limita)                  → 6 / 1
//   H2. `dentroDelHorario` sin los días (el sábado manda)                     → 5 / 2
//   H3. `relojEnZona` en la hora del servidor (UTC) en vez de la zona          → 4 / 3
// Restaurado: 7 / 0.
//   H4. `acabaDeAbrir` sin el tope de minutos (abre todo el horario)          → 6 / 1
//   H5. ConfigInnerTabs sin la tab «Horario»                                  → 6 / 1

// LA CASILLA «Los avisos al equipo salen igual» (14/10/2026, «nada por detrás» §2.4-h). Rotura: `avisosAlEquipo: true` fijo
// en el saneo → este test cae (y el del motor, tests/automations-avisos-fuera.test.ts).
test('los avisos al equipo fuera del horario: prendido de fábrica, y un false se guarda y vuelve', () => {
  assert.equal(sanearHorario({ activo: true, desde: 9, hasta: 18 })?.avisosAlEquipo, true, 'lo guardado antes del 14/10 apagaba los avisos');
  const off = horarioParaGuardar({ activo: true, desde: 9, hasta: 18, dias: [1], avisosAlEquipo: false });
  assert.equal(off.ok && sanearHorario(off.valor)?.avisosAlEquipo, false, 'apagar la casilla no se guardaba');
  // Sólo un false literal la apaga.
  assert.equal(sanearHorario({ activo: true, desde: 9, hasta: 18, avisosAlEquipo: 'no' })?.avisosAlEquipo, true);
});
