// =============================================================================
// El lead QUIETO: el plazo de cada etapa y el aviso de cuando nadie lo movió (#800)
// =============================================================================
// Lo que se prueba, y por qué cada cosa tiene su test:
//   · Qué etapa puede tener plazo: las abiertas sí, las terminales y el cierre no.
//   · Desde cuándo está el lead en su etapa: el historial contesta, y cuando no contesta
//     se devuelve null — un aviso que sale solo no puede afirmar «lleva más de 5 días»
//     sobre un lead que cambió ayer.
//   · Quiénes pasaron el plazo, con DOS embudos: un plazo de un embudo no vale en el otro.
//   · El texto: la etapa como la ve el dueño, el plazo y nunca un número exacto de días.
//   · El cableado: el cron lo llama SIN mirar crm_auto_enabled, después del motor.
//
// ⚠️ PROBADO ROMPIÉNDOLO (15 tests, 09/10/2026), restaurando de memoria:
//   · `entradaALaEtapa` sin el corte por `etapaVista` distinta        → 1 fallo, 14 pases
//   · `entradaALaEtapa` creyéndole a la última fila aunque sea de otra → 1 fallo, 14 pases
//   · `plazosValidos` aceptando plazo en una terminal                 → 1 fallo, 14 pases
//   · `puedeTenerPlazo` devolviendo true para el cierre               → 1 fallo, 14 pases
//   · el texto con los días exactos en vez del plazo                  → 2 fallos, 13 pases
//   · `leadsQuietos` con el plazo de un embudo fijo (el 18)           → 2 fallos, 13 pases
//   · `relojDesde` ignorando la fecha de la reunión                   → 1 fallo, 14 pases
//   · el server sin pasarle la fecha de la reunión a `relojDesde`     → 1 fallo, 14 pases
//   · la operación «plazo» pisando las otras claves de `umbrales`     → 1 fallo, 14 pases
//   · el aviso redactado por un modelo (`contexto`)                    → 1 fallo, 14 pases
// ⚠️ Y una lección del arnés: la primera vez que se rompió el cableado de `relojDesde` dio
// «1 fallo», y ese fallo era el de OTRO test que ya estaba rojo. Una rotura se lee contra la
// línea de base en VERDE, nunca contra una que ya tenía un rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  puedeTenerPlazo, sanearPlazo, plazosValidos, entradaALaEtapa, relojDesde, leadsQuietos, textoLeadsQuietos,
  PLAZO_MAX_DIAS, type EnEtapa,
} from '../lib/lead-quieto';

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-09T15:00:00Z');
const haceDias = (d: number) => new Date(AHORA - d * DIA).toISOString();

test('puedeTenerPlazo: las etapas abiertas sí; las terminales y el cierre no', () => {
  for (const e of [{ key: 'lead', kind: 'entrada' }, { key: 'agenda', kind: 'reunion' }, { key: 'st0', kind: 'paso' }, { key: 'facturando', kind: 'pago' }, { key: 'st3' }]) {
    assert.equal(puedeTenerPlazo(e), true, `${e.key} es abierta`);
  }
  for (const e of [{ key: 'ganado', kind: 'cierre' }, { key: 'perdido' }, { key: 'descal' }, { key: 'noresp' }, { key: 'st9', kind: 'cierre' }]) {
    assert.equal(puedeTenerPlazo(e), false, `${e.key} ya terminó: no está quieto`);
  }
});

test('sanearPlazo: días enteros de 1 al techo; lo demás es «sin plazo»', () => {
  assert.equal(sanearPlazo(5), 5);
  assert.equal(sanearPlazo('7'), 7);
  assert.equal(sanearPlazo(2.9), 2);
  assert.equal(sanearPlazo(PLAZO_MAX_DIAS), PLAZO_MAX_DIAS);
  for (const v of [0, -3, '', null, undefined, 'abc', PLAZO_MAX_DIAS + 1, NaN]) assert.equal(sanearPlazo(v), null, String(v));
});

test('plazosValidos: sólo etapas que EXISTEN en ese embudo y que pueden tenerlo; lo demás queda escrito', () => {
  const etapas = [{ key: 'lead', kind: 'entrada' }, { key: 'agenda', kind: 'reunion' }, { key: 'ganado', kind: 'cierre' }];
  const r = plazosValidos({ lead: 2, agenda: '5', ganado: 3, borrada: 4, roto: 'x' }, etapas);
  assert.deepEqual(r.plazos, { lead: 2, agenda: 5 });
  assert.equal(r.descartes.length, 3, 'la terminal, la etapa borrada y el número roto: los tres con motivo');
  assert.ok(r.descartes.some((d) => d.startsWith('borrada:')));
  assert.deepEqual(plazosValidos(null, etapas).plazos, {});
  assert.deepEqual(plazosValidos([1, 2], etapas).plazos, {}, 'un array no es un mapa de plazos');
});

test('entradaALaEtapa: la última fila del historial manda, si es de ESTA etapa', () => {
  assert.equal(
    entradaALaEtapa({ etapa: 'agenda', etapaVista: 'agenda', ultimaEtapa: { valor: 'agenda', at: haceDias(3) }, creadoEn: haceDias(40) }),
    haceDias(3),
  );
});

test('entradaALaEtapa: «no sé» es un tercer estado — null cuando el historial no contesta', () => {
  // El cambio todavía no se registró: la última fila es de la etapa ANTERIOR.
  assert.equal(entradaALaEtapa({ etapa: 'agenda', etapaVista: 'lead', ultimaEtapa: { valor: 'lead', at: haceDias(30) }, creadoEn: haceDias(40) }), null);
  // La vista está al día pero la última fila dice otra cosa.
  assert.equal(entradaALaEtapa({ etapa: 'agenda', etapaVista: 'agenda', ultimaEtapa: { valor: 'lead', at: haceDias(30) }, creadoEn: haceDias(40) }), null);
  // Nunca se registró.
  assert.equal(entradaALaEtapa({ etapa: 'lead', etapaVista: null, ultimaEtapa: null, creadoEn: haceDias(40) }), null);
});

test('entradaALaEtapa: sin filas y con la vista al día, está ahí desde que se creó', () => {
  assert.equal(entradaALaEtapa({ etapa: 'lead', etapaVista: 'lead', ultimaEtapa: null, creadoEn: haceDias(9) }), haceDias(9));
  assert.equal(entradaALaEtapa({ etapa: 'lead', etapaVista: 'lead', ultimaEtapa: null, creadoEn: null }), null);
});

test('relojDesde: en una etapa de reunión el reloj arranca el día de la reunión', () => {
  const entrada = haceDias(20);
  // Reunión dentro de 10 días: el lead está esperando, no quieto.
  const futura = new Date(AHORA + 10 * DIA).toISOString().slice(0, 10);
  const q = leadsQuietos([it(1, 18, 'agenda', relojDesde(entrada, futura))], plazoDe, AHORA);
  assert.equal(q.length, 0, 'con la reunión por delante no hay nada que avisar');
  // Reunión hace 6 días y sigue ahí: quieto, contando desde la reunión.
  const pasada = new Date(AHORA - 6 * DIA).toISOString().slice(0, 10);
  assert.equal(relojDesde(entrada, pasada), `${pasada}T00:00:00.000Z`);
  // Sin reunión, o con una fecha anterior a la entrada, vale la entrada.
  assert.equal(relojDesde(entrada, null), entrada);
  assert.equal(relojDesde(entrada, haceDias(40)), entrada);
  assert.equal(relojDesde(null, pasada), null, 'sin entrada no se afirma nada');
});

// DOS embudos con la MISMA clave de etapa y plazos distintos: con uno solo, una resolución que
// ignorara el embudo pasaría todas las pruebas.
const PLAZOS: Record<number, Record<string, number>> = { 18: { agenda: 5 }, 22: { agenda: 30, st0: 2 } };
const plazoDe = (f: number, e: string) => PLAZOS[f]?.[e] ?? null;
const it = (leadId: number, funnelId: number, etapa: string, desde: string | null, nombre = `L${leadId}`): EnEtapa =>
  ({ leadId, nombre, funnelId, etapa, desde });

test('leadsQuietos: el plazo es el del embudo de ESA etapa, y sin fecha no se afirma nada', () => {
  const q = leadsQuietos([
    it(1, 18, 'agenda', haceDias(6)),    // 6 ≥ 5 → quieto
    it(2, 22, 'agenda', haceDias(6)),    // misma etapa, otro embudo: 6 < 30 → no
    it(3, 22, 'st0', haceDias(2)),       // justo el plazo → quieto
    it(4, 18, 'agenda', null),           // no se sabe desde cuándo → nada
    it(5, 18, 'facturando', haceDias(90)), // sin plazo → nada
  ], plazoDe, AHORA);
  assert.deepEqual(q.map((x) => x.leadId), [1, 3], 'del que más lleva al que menos');
  assert.deepEqual(q.map((x) => x.plazo), [5, 2]);
});

test('textoLeadsQuietos: la etapa como la ve el dueño, el plazo, los nombres — y nunca los días exactos', () => {
  const q = leadsQuietos([
    it(1, 18, 'agenda', haceDias(40), 'Ana'),
    it(2, 18, 'agenda', haceDias(7), 'Pedro'),
    it(3, 22, 'st0', haceDias(3), 'Lucía'),
  ], plazoDe, AHORA);
  const etiq = (f: number, e: string) => ({ etapa: e === 'st0' ? 'Facturando' : 'Agenda R2' });
  const t = textoLeadsQuietos(q, etiq, 'https://x.test/crm')!;
  assert.match(t, /^⏳ \*3 leads\* llevan en su etapa/);
  assert.match(t, /2 en \*Agenda R2\* \(más de 5 días\) y 1 en \*Facturando\* \(más de 2 días\)/);
  assert.match(t, /Los que más esperan: Ana, Pedro y Lucía\./);
  assert.match(t, /https:\/\/x\.test\/crm/);
  assert.ok(!t.includes('st0'), 'una clave interna no es el nombre de la etapa');
  assert.ok(!/\b40\b/.test(t), 'los días exactos pueden salir de la fecha de alta: no se afirman');
  assert.equal(textoLeadsQuietos([], etiq), null, 'sin quietos no hay mensaje');
});

test('textoLeadsQuietos: con dos embudos dice de cuál, y un lead solo va en singular', () => {
  const q = leadsQuietos([it(1, 18, 'agenda', haceDias(9), 'Ana')], plazoDe, AHORA);
  const t = textoLeadsQuietos(q, () => ({ etapa: 'Agenda R2', embudo: 'Mentoría' }))!;
  assert.match(t, /^⏳ \*1 lead\* lleva/);
  assert.match(t, /1 en \*Agenda R2\* de \*Mentoría\* \(más de 5 días\)/);
});

test('textoLeadsQuietos: nombra a lo sumo tres, los que más esperan', () => {
  const q = leadsQuietos([1, 2, 3, 4, 5].map((n) => it(n, 18, 'agenda', haceDias(5 + n), `N${n}`)), plazoDe, AHORA);
  const t = textoLeadsQuietos(q, () => ({ etapa: 'Agenda R2' }))!;
  assert.match(t, /Los que más esperan: N5, N4 y N3\./);
  assert.ok(!t.includes('N2'));
});

test('el cron lo llama SIN mirar crm_auto_enabled, y DESPUÉS del CRM automático', () => {
  const src = sinComentarios(leer('../app/api/cron/crm-automatico/route.ts'));
  const iAuto = src.indexOf('aplicarAutoTodos(');
  // La llamada que MANDA (la del modo prueba, `dry: true`, va antes y no manda nada).
  const iQuietos = src.indexOf('avisarLeadsQuietosTodos({ soloWs, hastaMs');
  assert.ok(iAuto > 0 && iQuietos > 0, 'están las dos llamadas');
  assert.ok(iQuietos > iAuto, 'lo que el motor acaba de mover ya no está quieto: va después');
  const runner = sinComentarios(leer('../lib/lead-quieto-aviso.ts'));
  assert.ok(!/crmAutoHabilitado|crm_auto_enabled/.test(runner), 'el aviso no mueve a nadie: no depende del motor');
  assert.match(runner, /emitirDelCatalogo\('crm-lead-quieto', \{ ws, texto,/, 'va `texto` (código), nunca `contexto` (un modelo)');
  assert.match(runner, /desde: relojDesde\(\s*entradaALaEtapa\([\s\S]*?\),\s*fechaDeReunion\(l, /,
    'en una etapa de reunión el reloj arranca el día de la reunión');
});

test('el aviso existe en los cuatro registros, con su rótulo y su interruptor', async () => {
  const { CATALOGO_AVISOS, areaDeAviso } = await import('../lib/avisos-catalogo');
  const { AVISOS_WA_EN_VIVO } = await import('../lib/notif-catalogo');
  const { AVISOS_AGRUPABLES } = await import('../lib/avisos-agrupables');
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'crm-lead-quieto');
  assert.ok(cat, 'falta en CATALOGO_AVISOS');
  assert.equal(cat.categoria, 'aviso');
  assert.equal(areaDeAviso('crm-lead-quieto'), 'lead');
  assert.ok(AVISOS_WA_EN_VIVO.some((a) => a.id === 'crm-lead-quieto'), 'sin esto no se puede apagar');
  assert.ok(AVISOS_AGRUPABLES.has('crm-lead-quieto'));
  for (const real of ['Mauricio', 'Leila', 'Martín', 'Código Inmobiliario', 'Negocio que Escala']) {
    assert.ok(!cat.ejemplo.includes(real), `el ejemplo nombra a alguien real: ${real}`);
  }
});

test('la operación «plazo» se decide en el server y conserva las otras claves de umbrales', () => {
  const src = sinComentarios(leer('../app/crm/actions.ts'));
  const ini = src.indexOf("} else if (op.op === 'plazo') {");
  const fin = src.indexOf("} else if (op.op === 'mover') {", ini);
  assert.ok(ini > 0 && fin > ini, 'existe la rama');
  const rama = src.slice(ini, fin);
  assert.match(rama, /puedeTenerPlazo\(st\)/, 'una terminal no lleva plazo, lo diga la pantalla o no');
  assert.match(rama, /umbrales: \{ \.\.\.u, porEtapa: previos \}/, 'las perillas del CRM automático viven en el mismo objeto');
  assert.match(rama, /if \(u == null\) return \{ ok: false/, 'sin poder leer, no se escribe encima');
});

// ⚠️ HASTA EL 12/10/2026 ACÁ SE FIJABA CÓMO EL POP-UP DE ETAPAS DIBUJABA EL PLAZO. La pastilla se
// fue con el punto 4 del feedback de ese día: «Elimina lo de "Ponerle un plazo", para eso ya
// tenemos la tab de "Automations"». El test se dio vuelta: que no vuelva a ofrecerse, y que el
// pop-up no pague la lectura de un dato que no dibuja. El backend (la op `plazo`, el aviso) queda
// —lo fijan los tests de arriba— y lo que quedó, en la cabecera de lib/lead-quieto-aviso.ts.
//
// Probado rompiéndolo (12/10/2026; el archivo entero da 15 / 0): vuelve `plazoDe` al pop-up → 14 / 1;
// el detalle del embudo vuelve a leer los plazos (`plazosValidos` en `embudoEnDetalleAction`) → 14 / 1.
test('el pop-up de etapas ya no ofrece plazo, ni lee los plazos para dibujarlo', () => {
  const src = sinComentarios(leer('../app/crm/EtapasModal.tsx'));
  assert.doesNotMatch(src, /PlazoEtapa|plazoDe\(|op: 'plazo'/, 'volvió la pastilla «Plazo»');
  const ac = sinComentarios(leer('../app/crm/actions.ts'));
  const ini = ac.indexOf('export async function embudoEnDetalleAction');
  const fin = ac.indexOf('export type ExtrasDelEmbudo', ini);
  assert.ok(ini > 0 && fin > ini, 'existe el detalle del embudo');
  assert.doesNotMatch(ac.slice(ini, fin), /plazosValidos|umbralesDe/, 'el detalle volvió a leer los plazos que nadie dibuja');
});
