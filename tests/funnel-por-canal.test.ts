// El funnel es, por decisión de producto, la fuente de verdad del CRM: de él salen los
// requisitos para mover un lead, la nutrición, los huecos de secuencias y hasta qué
// audios se le piden al dueño. Sembrar el equivocado no es cosmético.
//
// Todo lo de acá es la SEGUNDA CAPA de la regla de AGENTS.md: `Record<CanalId, …>` hace
// que el compilador exija la fila de un canal nuevo, pero no puede ver que el id que hay
// adentro exista de verdad, ni que la plantilla tenga la forma que el canal promete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CANALES, type CanalId } from '../lib/fase-diagnostico';
import {
  FUNNEL_TEMPLATES, TEMPLATE_POR_CANAL, templateDeCanal, mismoPipeline,
  DEFAULT_PIPELINE, generateFunnel,
} from '../lib/pipeline';

test('todo canal tiene plantilla, y esa plantilla existe', () => {
  for (const c of CANALES) {
    const id = TEMPLATE_POR_CANAL[c.id];
    assert.ok(id, `el canal «${c.id}» no tiene plantilla`);
    assert.ok(FUNNEL_TEMPLATES.some((t) => t.id === id), `la plantilla «${id}» del canal «${c.id}» no existe`);
    assert.ok(templateDeCanal(c.id), `templateDeCanal('${c.id}') devolvió null`);
  }
  // Y al revés: que no queden filas apuntando a canales que ya no están.
  for (const k of Object.keys(TEMPLATE_POR_CANAL)) {
    assert.ok(CANALES.some((c) => c.id === k), `«${k}» no es un canal`);
  }
});

test('un canal desconocido NO cae a una plantilla por default', () => {
  // Falla CERRADO a propósito: el endpoint del hub (/api/onboarding/fase) NO valida el
  // canal contra CANALES —hace un cast—, así que puede haber un canal inventado
  // guardado en el diagnóstico. Mapear un string desconocido a «la primera» es
  // exactamente como nació este problema.
  for (const malo of ['', 'llamada', 'CARRITO', 'inventado', null, undefined]) {
    assert.equal(templateDeCanal(malo as string), null, `«${malo}» devolvió una plantilla`);
  }
});

test('la cantidad de reuniones de cada plantilla es la que promete su canal', () => {
  // Es la propiedad que de verdad se consume: `reunionesDe()` y `funnelReqInfo()` leen
  // solo `kind === 'reunion'`, y de ahí salen los requisitos para cerrar un lead, la
  // nutrición de No Show y los audios del Chat Agent.
  const reuniones = (canal: CanalId) =>
    (templateDeCanal(canal)?.pipeline ?? []).filter((s) => s.kind === 'reunion').length;

  assert.equal(reuniones('llamadas'), 1, '«Agendas una llamada y cierras la venta ahí» = UNA reunión');
  assert.equal(reuniones('conversaciones'), 0, '«sin llamada» = CERO reuniones');
  assert.equal(reuniones('carrito'), 0, '«sin que hables con ellos» = CERO reuniones');
  assert.equal(reuniones('webinar'), 1, 'el webinar ES la reunión');
});

test('ninguna plantilla sin reuniones genera nutrición de No Show de reunión', () => {
  // El daño concreto de sembrar mal: un e-commerce con tres etapas de No Show y avisos
  // de «La Reunión 2 ya pasó» para reuniones que no existen.
  for (const canal of ['conversaciones', 'carrito'] as CanalId[]) {
    const tpl = templateDeCanal(canal)!;
    const { stages } = generateFunnel(tpl.pipeline, []);
    const noShowDeReunion = stages.filter((s) => /^noshow_r[12]$/.test(s.key));
    assert.equal(noShowDeReunion.length, 0, `«${canal}» generó ${noShowDeReunion.map((s) => s.key).join(', ')}`);
  }
});

test('la plantilla de conversaciones tiene dónde parar la charla', () => {
  // La razón de que exista: es el único canal cuya operación ENTERA es la conversación,
  // y sin una etapa propia todos los leads en charla quedan mezclados con los que nadie
  // tocó, en «lead».
  const tpl = templateDeCanal('conversaciones')!;
  const claves = tpl.pipeline.map((s) => s.key);
  assert.ok(claves.includes('conversando'), `no tiene etapa de conversación: ${claves.join(' > ')}`);
  // `kind: 'paso'` es lo que impide que invente nutrición y que dispare requisitos.
  assert.equal(tpl.pipeline.find((s) => s.key === 'conversando')?.kind, 'paso');
});

test('mismoPipeline distingue un funnel intacto de uno editado', () => {
  // Es el guard que impide pisar el funnel de alguien que ya lo tocó. No hay historial
  // de funnel en ningún lado, así que comparar contra lo que se le habría dado es la
  // única forma honesta de preguntarlo.
  assert.ok(mismoPipeline(DEFAULT_PIPELINE, DEFAULT_PIPELINE));
  assert.ok(mismoPipeline([...DEFAULT_PIPELINE], DEFAULT_PIPELINE.map((s) => ({ ...s }))));

  // Sacar una etapa (lo que hizo un cliente real con su R2) cuenta como editado.
  assert.equal(mismoPipeline(DEFAULT_PIPELINE.filter((s) => s.key !== 'agendaj2'), DEFAULT_PIPELINE), false);
  // Cambiar una etiqueta a mano, también.
  const conLabel = DEFAULT_PIPELINE.map((s, i) => (i === 1 ? { ...s, label: 'Mi reunión' } : s));
  assert.equal(mismoPipeline(conLabel, DEFAULT_PIPELINE), false);
  // Reordenar, también.
  assert.equal(mismoPipeline([...DEFAULT_PIPELINE].reverse(), DEFAULT_PIPELINE), false);
  // Y el caso borde: nada contra algo.
  assert.equal(mismoPipeline(null, DEFAULT_PIPELINE), false);
  assert.ok(mismoPipeline(null, []));
});

test('ninguna plantilla queda con una etapa que no se pueda cerrar', () => {
  // Toda plantilla necesita una entrada y un cierre: sin cierre no hay Ganado, y
  // `funnelReqInfo` deriva el nivel de venta del `kind: 'cierre'`.
  for (const t of FUNNEL_TEMPLATES) {
    const kinds = t.pipeline.map((s) => s.kind);
    assert.ok(kinds.includes('entrada'), `«${t.id}» no tiene etapa de entrada`);
    assert.ok(kinds.includes('cierre'), `«${t.id}» no tiene etapa de cierre`);
    assert.equal(t.pipeline[0].kind, 'entrada', `«${t.id}» no arranca por la entrada`);
    assert.equal(t.pipeline[t.pipeline.length - 1].kind, 'cierre', `«${t.id}» no termina en el cierre`);
  }
});
