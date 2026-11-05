// =============================================================================
// El horario de fábrica para las que ya estaban prendidas, y el horario del negocio que manda (5/11/2026, Black November)
// =============================================================================
// Las automatizaciones nuevas nacen con 9 a 21 al prenderlas (`naceConHorario`, desde el 31/10/2026); las de antes no tenían
// ninguno y le escribían a los leads a cualquier hora. Y Leila quiere de 10 a 20 para su negocio: con el 9 a 21 guardado en cada
// automatización nueva, el horario del negocio no le llegaba a ninguna. Lo que se fija, EJECUTADO:
//   · el 9 a 21 que pone MaKo queda MARCADO (`horarioDeFabrica`) y cede ante el horario del negocio; uno que eligió la persona,
//     no; cambiarlo en la tuerca saca la marca;
//   · el plan del script (lib/horario-de-fabrica.ts): a quién se le pone, a quién se marca, a quién no y por qué, y que DE NOCHE
//     no se pone (para no frenarla de golpe);
//   · la regla de a quién le toca es UNA (`leTocaPorSusDisparadores`): la del momento de prenderla, sin la fecha.
// La API (`configurar_horario_envio`) dice cuántas siguen con su propio horario; el panel muestra el que vale.
//
// PROBADO ROMPIÉNDOLO (5/11/2026), sobre una base de 5 / 0:
//   H1 `horarioDeLaAutomatizacion` sin la marca (el de fábrica no cede)            → 4 / 1
//   H2 `configParaGuardar` sin sacar la marca cuando la persona cambia el horario  → 4 / 1
//   H3 el plan sin el corte de la noche                                            → 4 / 1
//   H4 el plan marcando también lo que no es idéntico al de fábrica                → 4 / 1
//   H5 activar sin la marca (`poner` en lib/nutricion.ts)                           → 4 / 1
// Restaurado, 5 / 0.
//
// Correr: node --import tsx --test tests/horario-de-fabrica.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HORARIO_SUGERIDO, type HorarioEnvio } from '../lib/horario-envio';
import {
  configParaGuardar, horarioDeLaAutomatizacion, horarioParaMostrar, origenDelHorario, sanearConfigAutomatizacion, type ConfigAutomatizacion,
} from '../lib/config-automatizacion';
import { cambioDelPaso, esElDeFabrica, planDeHorarioDeFabrica, type AutoParaHorario } from '../lib/horario-de-fabrica';
import { DESDE_HORARIO_DE_FABRICA, leTocaPorSusDisparadores, naceConHorario } from '../lib/ritmo-al-activar';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const LEILA: HorarioEnvio = { activo: true, desde: 10, hasta: 20, dias: [0, 1, 2, 3, 4, 5, 6] };
const MIO: HorarioEnvio = { activo: true, desde: 8, hasta: 18, dias: [1, 2, 3, 4, 5] };

test('el 9 a 21 de fábrica cede ante el horario del negocio; el que eligió la persona, no', () => {
  const fabrica: ConfigAutomatizacion = { horario: HORARIO_SUGERIDO, horarioDeFabrica: true };
  assert.deepEqual(horarioDeLaAutomatizacion(fabrica, LEILA), LEILA, 'con los 10 a 20 del negocio, vale el del negocio');
  assert.deepEqual(horarioDeLaAutomatizacion(fabrica, null), HORARIO_SUGERIDO, 'sin horario del negocio, el de fábrica');
  assert.deepEqual(horarioDeLaAutomatizacion({ horario: MIO }, LEILA), MIO, 'el propio manda');
  assert.equal(horarioDeLaAutomatizacion({ horario: null }, LEILA), null, '«sin horario» elegido manda');
  assert.deepEqual(horarioDeLaAutomatizacion({}, LEILA), LEILA);
  // Lo que se muestra en la tuerca y de dónde sale (la API).
  assert.deepEqual(horarioParaMostrar(fabrica, LEILA), LEILA);
  assert.equal(horarioParaMostrar({}, null), undefined);
  assert.deepEqual(horarioParaMostrar({ horario: { ...MIO, activo: false } }, LEILA), { ...MIO, activo: false }, 'el propio apagado se muestra apagado');
  assert.deepEqual([origenDelHorario(fabrica, LEILA), origenDelHorario(fabrica, null), origenDelHorario({ horario: MIO }, LEILA), origenDelHorario({}, null)], ['negocio', 'fabrica', 'propio', 'negocio']);
});

test('la marca: la pone sólo el de fábrica, la saca la persona, y sin horario no vive', () => {
  const r = configParaGuardar({}, { horario: HORARIO_SUGERIDO, horarioDeFabrica: true });
  assert.ok(r.ok);
  assert.equal(r.ok && r.config.horarioDeFabrica, true);
  // Se guarda y se vuelve a leer igual.
  assert.deepEqual(r.ok && sanearConfigAutomatizacion(r.valor), { horario: HORARIO_SUGERIDO, horarioDeFabrica: true });
  // La persona lo cambia en la tuerca (`{ horario }` sin marca): pasa a ser suyo.
  const suyo = configParaGuardar({ horario: HORARIO_SUGERIDO, horarioDeFabrica: true }, { horario: { ...HORARIO_SUGERIDO } });
  assert.equal(suyo.ok && suyo.config.horarioDeFabrica, undefined, 'el mismo 9 a 21, elegido por la persona, ya no cede');
  const vuelve = configParaGuardar({ horario: HORARIO_SUGERIDO, horarioDeFabrica: true }, { horario: null });
  assert.deepEqual(vuelve.ok && vuelve.config, {}, 'volver al del negocio saca las dos cosas');
  // Otro cambio (el goteo) no la toca.
  const goteo = configParaGuardar({ horario: HORARIO_SUGERIDO, horarioDeFabrica: true }, { goteo: { minutos: 5 } });
  assert.equal(goteo.ok && goteo.config.horarioDeFabrica, true);
  assert.deepEqual(sanearConfigAutomatizacion({ horarioDeFabrica: true }), {}, 'una marca sin horario no vive');
});

const NOCHE = Date.parse('2026-11-05T05:00:00Z'); // 23:00 del 4/11 en Ciudad de México
const DIA = Date.parse('2026-11-05T18:00:00Z');   // 12:00 del 5/11
const auto = (o: Partial<AutoParaHorario>): AutoParaHorario => ({
  id: 1, nombre: 'X', clave: 'x', activa: true, creadaAt: '2026-09-01T10:00:00Z', triggers: ['etapa_actual'], config: {}, ...o,
});

test('el plan: a quién se le pone, a quién se marca, y a quién no (con su porqué)', () => {
  const autos = [
    auto({ id: 1, nombre: 'Prospección' }),
    auto({ id: 2, nombre: 'Responde DMs', triggers: ['instagram'] }),
    auto({ id: 3, nombre: 'Difusión', clave: 'difusion-abc' }),
    auto({ id: 4, nombre: 'Pausada', activa: false }),
    auto({ id: 5, nombre: 'Con su horario', config: { horario: MIO } }),
    auto({ id: 6, nombre: 'Nueva', creadaAt: '2026-11-02T10:00:00Z', config: { horario: HORARIO_SUGERIDO } }),
    auto({ id: 7, nombre: 'Vieja con 9 a 21', creadaAt: '2026-10-01T10:00:00Z', config: { horario: HORARIO_SUGERIDO } }),
    auto({ id: 8, nombre: 'Ya marcada', config: { horario: HORARIO_SUGERIDO, horarioDeFabrica: true } }),
    auto({ id: 9, nombre: 'Nueva de 9 a 20', creadaAt: '2026-11-02T10:00:00Z', config: { horario: { ...HORARIO_SUGERIDO, hasta: 20 } } }),
  ];
  const plan = planDeHorarioDeFabrica({ delNegocio: null, zona: 'America/Mexico_City', ahoraMs: DIA, autos });
  assert.deepEqual(plan.map((p) => `${p.id}:${p.hace}`), ['1:poner', '2:nada', '3:nada', '4:nada', '5:nada', '6:marcar', '7:nada', '8:nada', '9:nada']);
  assert.match(plan[1].motivo, /contesta al momento/);
  // Con --pausadas, también la apagada.
  assert.equal(planDeHorarioDeFabrica({ delNegocio: null, zona: 'America/Mexico_City', ahoraMs: DIA, autos: [autos[3]], pausadas: true })[0].hace, 'poner');
  // DE NOCHE no se pone: lo que vence ahora se quedaría quieto hasta las 9. La marca sí (no cambia nada hoy).
  const noche = planDeHorarioDeFabrica({ delNegocio: null, zona: 'America/Mexico_City', ahoraMs: NOCHE, autos });
  assert.deepEqual(noche.filter((p) => p.hace !== 'nada').map((p) => `${p.id}:${p.hace}`), ['1:esperar', '6:marcar']);
  // Con el horario del negocio (los 10 a 20 de Leila), no se pone nada: lo siguen. La nueva de fábrica se marca para que lo siga.
  const conNegocio = planDeHorarioDeFabrica({ delNegocio: LEILA, zona: 'America/Mexico_City', ahoraMs: DIA, autos });
  assert.deepEqual(conNegocio.filter((p) => p.hace !== 'nada').map((p) => `${p.id}:${p.hace}`), ['6:marcar']);
  assert.match(conNegocio[0].motivo, /sigue el horario del negocio/);
  assert.match(conNegocio[1].motivo, /contesta al momento, y lo que llegue fuera de ese horario espera a que abra/, 'se avisa que el DM espera');
  // Lo que escribe cada paso.
  assert.deepEqual(cambioDelPaso(plan[0], {}), { horario: HORARIO_SUGERIDO, horarioDeFabrica: true });
  assert.deepEqual(cambioDelPaso(plan[5], autos[5].config), { horario: HORARIO_SUGERIDO, horarioDeFabrica: true });
  assert.equal(cambioDelPaso(plan[1], {}), null);
  assert.equal(esElDeFabrica({ ...HORARIO_SUGERIDO, dias: [1, 2, 3, 4, 5] }), false);
});

test('una regla, dos momentos: la de prenderla (con la fecha) y la del script (sin la fecha)', () => {
  const base = { triggers: ['etapa_actual'], horarioPropio: undefined, delNegocio: null };
  assert.equal(leTocaPorSusDisparadores(base), null);
  assert.equal(naceConHorario({ ...base, creadaAt: new Date(DESDE_HORARIO_DE_FABRICA + 1000).toISOString() }), true);
  assert.equal(naceConHorario({ ...base, creadaAt: '2026-09-01T00:00:00Z' }), false, 'al prenderla, las de antes no lo reciben');
  assert.match(leTocaPorSusDisparadores({ ...base, triggers: ['email_recibido'] }) ?? '', /contesta al momento/);
  assert.match(leTocaPorSusDisparadores({ ...base, triggers: [] }) ?? '', /no tiene disparador/);
});

test('el cableado: activar pone el de fábrica CON la marca, el panel muestra el que vale y la API lo dice', () => {
  const nutri = leer('lib/nutricion.ts');
  assert.match(nutri, /guardarConfigAutomatizacion\(id, \{ horario: HORARIO_SUGERIDO, horarioDeFabrica: true \}\)/, 'activar sin la marca: el horario del negocio no le llegaría');
  assert.match(leer('app/automations/ConfigAutomatizacionPanel.tsx'), /horarioParaMostrar\(d\.config, d\.horarioNegocio\)/);
  const equipo = leer('lib/api-mako/areas/equipo.run.ts');
  assert.match(equipo, /c\.horario !== undefined && !c\.horarioDeFabrica/, 'el «sí» del horario del negocio cuenta sólo los horarios propios');
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /de: origenDelHorario\(config, delNegocio\)/);
});
