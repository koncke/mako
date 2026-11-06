// =============================================================================
// La hoja General con su DISEÑO PROPIO (la copia de Orvel): de dónde sale cada número (lib/general-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaGeneral.tsx con lo que arma `vistaGeneral` de los datos de General y de
// dos piezas de la hoja. Estos tests EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el
// último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatosGeneral, TareaVista } from '../app/general/datos-tipos';
import type { Label } from '../app/plan/board/types';
import type { ItemCalendario } from '../lib/calendario-modelo';
import type { CobroM } from '../app/m/dashboard/modelo';
import type { Resultado } from '../lib/graficos-agregar';
import { cambio, diaDeLlamada, escalaGeneral, etapasDelFunnel, faltaParaLlamada, fraseGeneral, mesesGeneral, vistaGeneral } from '../lib/general-diseno';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { instanciarPlantilla } from '../lib/graficos-plantillas';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04';
const TZ = 'America/Mexico_City'; // UTC-6
const AHORA = Date.parse('2026-11-04T17:10:00Z'); // 11:10 en Ciudad de México
const mx = (hhmm: string, dia = HOY) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${dia}T00:00:00Z`) + ((h + 6) * 60 + m) * 60_000).toISOString();
};
const falla = { ok: false as const, error: 'No se pudo leer.' };

function tarea(o: Partial<TareaVista> & { id: string }): TareaVista {
  return {
    num: 1, emoji: '', title: `Tarea ${o.id}`, detalle: '', priority: 'media', score: 50, progress: 0, deadline: '', labels: [],
    checklist: [], historial: [], origen: 'user', enPrioridad: false, ...o,
  };
}
function proyecto(o: Partial<Label> & { id: string }): Label {
  return { emoji: '🚀', name: `Proyecto ${o.id}`, color: '#2F6FED', score: 50, detalle: '', historial: [], ...o };
}
function evento(o: Partial<ItemCalendario> & { id: string; inicio: string }): ItemCalendario {
  return { fuente: 'crm', capa: 'llamadas', titulo: `Llamada ${o.id}`, fin: null, diaCompleto: false, href: null, ...o };
}
const cobro = (leadId: number, urgencia: CobroM['urgencia']): CobroM => ({ leadId, pagoId: leadId * 10, nombre: `Cliente ${leadId}`, linea: 'US$100 · vence el 9/11', urgencia });
type Plan = Extract<DatosGeneral['plan'], { ok: true }>['d'];
function plan(o: Partial<Plan> = {}): Plan {
  return {
    prioridades: [], top: [], deadlines: { tareas: [], proyectos: [] }, hoy: HOY, deHoy: { cerradas: 0, total: 0 }, vencidas: 0,
    objetivo: null, proyectos: [], etiquetas: [], tareasDeProyectos: [], tablero: 'cliente', ...o,
  };
}
function datos(o: Partial<DatosGeneral> = {}): DatosGeneral {
  return {
    cabecera: falla, okrs: falla, kpis: falla, semaforo: falla, pendientes: falla, mes: falla, plan: falla, calendario: falla,
    funnels: falla, cobranza: falla, ...o,
  };
}
const res = (columnas: string[], filas: Array<{ clave: string; etiqueta?: string; valores: Array<number | null> }>, totales: Array<number | null> = []): Resultado =>
  ({ columnas: columnas.map((id) => ({ id, nombre: id, formato: 'numero' })), filas: filas.map((f) => ({ etiqueta: f.clave, ...f })), totales, fuera: 0, clase: null }) as unknown as Resultado;
const HOJA = { diseno: { id: 'general' as const, piezas: { meses: 'g-meses', deben: 'g-deben' } } };
const comparativo = {
  cash_usd: { actual: 12480, anterior: 9460, proyeccion: 18500 }, inversion_usd: { actual: 2140, anterior: 1980, proyeccion: 3200 },
  agendas: { actual: 27, anterior: 24, proyeccion: 42 }, cierres: { actual: 6, anterior: 7, proyeccion: 0 }, etiqueta_anterior: 'mismo período de octubre',
};

test('la frase de arriba: sólo lo que se leyó, en una oración', () => {
  const texto = (t: ReturnType<typeof fraseGeneral>) => t.map((x) => x.s).join('');
  assert.equal(texto(fraseGeneral(12480, 2, 5)), 'Entraron US$12,480 este mes, 2 cuotas están vencidas y 5 leads esperan que los marques.');
  assert.equal(texto(fraseGeneral(12480, 1, 0)), 'Entraron US$12,480 este mes y 1 cuota está vencida.');
  assert.equal(texto(fraseGeneral(null, 0, 1)), '1 lead espera que lo marques.');
  assert.equal(texto(fraseGeneral(null, 0, 0)), 'Nada te está esperando ahora.');
  assert.equal(texto(fraseGeneral(null, null, null)), 'No pude leer cómo viene el mes.');
  assert.equal(fraseGeneral(12480, 2, 5).filter((t) => t.tipo === 'link').length, 2, 'las cuotas y los leads llevan al CRM');
});

test('el cambio contra el mes pasado: con signo, y sin un cero para comparar no hay porcentaje', () => {
  assert.equal(cambio(12480, 9460), '+32%');
  assert.equal(cambio(6, 7), '−14%');
  assert.equal(cambio(5, 5), '0%');
  assert.equal(cambio(5, 0), null);
});

test('las dos líneas por mes: lo cobrado y la inversión de la pieza, con el mes corto del eje', () => {
  const m = mesesGeneral(res(['cobrado', 'gasto'], [{ clave: '2026-10', valores: [9000, 1500] }, { clave: '2026-11', valores: [12000, null] }]));
  assert.deepEqual(m, [{ clave: '2026-10', corto: 'Oct', cobrado: 9000, gasto: 1500 }, { clave: '2026-11', corto: 'Nov', cobrado: 12000, gasto: 0 }]);
  assert.equal(mesesGeneral(res(['gasto'], [{ clave: '2026-11', valores: [1] }])), null, 'sin lo cobrado no hay gráfico');
  assert.equal(mesesGeneral(null), null);
});

test('la escala del gráfico: tres rayas, con lo más alto entre la mitad y el tope', () => {
  for (const alto of [450, 3000, 9999, 12480, 33000, 61000, 250000]) {
    const { tope, paso } = escalaGeneral([{ clave: 'a', corto: 'A', cobrado: alto, gasto: alto / 10 }]);
    assert.equal(tope, 2 * paso, `${alto}: el tope son dos pasos`);
    assert.ok(alto <= tope && alto >= paso, `${alto}: queda entre ${paso} y ${tope}`);
  }
  assert.deepEqual(escalaGeneral([{ clave: 'a', corto: 'A', cobrado: 0, gasto: 0 }]), { tope: 1, paso: 0.5 });
});

test('el funnel: las etapas con gente en su orden, «Sin etapa», y pasadas las seis, «Otras» con el resto', () => {
  const e = (label: string, n: number) => ({ key: label, label, dot: null, n });
  assert.deepEqual(etapasDelFunnel({ etapas: [e('Nuevo', 5), e('Vacía', 0), e('Agendó', 3)], total: 10, sinEtapa: 2 }).map((x) => [x.nombre, x.n]),
    [['Nuevo', 5], ['Agendó', 3], ['Sin etapa', 2]]);
  const muchas = etapasDelFunnel({ etapas: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((l, i) => e(l, i + 1)), total: 28, sinEtapa: 0 });
  assert.equal(muchas.length, 6);
  assert.equal(muchas[5].nombre, 'Otras');
  assert.equal(muchas.reduce((s, x) => s + x.n, 0), 28, 'la suma es el total');
});

test('lo que no se leyó es null, nunca un cero', () => {
  const v = vistaGeneral(datos(), HOJA, {}, AHORA);
  for (const k of ['mes', 'meta', 'flujo', 'meses', 'necesita', 'vence', 'deben', 'funnel', 'llamadas', 'salud'] as const) assert.equal(v[k], null, k);
  const sinComparar = vistaGeneral(datos({ mes: { ok: true, d: { comparativo: null, desgloses: {} } } }), HOJA, {}, AHORA);
  assert.equal(sinComparar.mes, null, 'un mes que no se pudo comparar no se dibuja en cero');
});

test('«Este mes»: lo cobrado contra el mismo período, la proyección y los cuatro renglones', () => {
  const v = vistaGeneral(datos({ mes: { ok: true, d: { comparativo, desgloses: {} } } }), HOJA, {}, AHORA);
  assert.equal(v.mes?.cobrado, 12480);
  assert.equal(v.mes?.delta, 3020);
  assert.equal(v.mes?.proyeccion, 18500);
  assert.deepEqual(v.mes?.renglones.map((r) => [r.id, r.valor, r.cambio]), [['cobrado', 'US$12,480', '+32%'], ['inversion', 'US$2,140', '+8%'], ['agendas', '27', '+13%'], ['cierres', '6', '−14%']]);
  assert.equal(v.mes?.renglones[3].detalle, 'sin proyección todavía');
  assert.equal(v.flujo?.cobrado, 12480);
  assert.equal(v.flujo?.inversion, 2140);
});

test('«Te necesita»: cuotas vencidas, leads por marcar, tareas vencidas y alertas en rojo, sólo si hay', () => {
  const v = vistaGeneral(datos({
    cobranza: { ok: true, d: { cobros: [cobro(1, 'vencida'), cobro(1, 'vencida'), cobro(2, 'vencida'), cobro(3, 'pronto')], tz: TZ, deQuien: null } },
    pendientes: { ok: true, d: { total: 5, porTipo: { A: 0, B: 3, C: 2, M: 0, R: 0 }, aviso: null } as never },
    plan: { ok: true, d: plan({ vencidas: 2, deadlines: { tareas: [tarea({ id: 't1', deadline: '2026-10-28' }), tarea({ id: 't2', deadline: '2026-11-02' })], proyectos: [] } }) },
    semaforo: { ok: true, d: { alertas: [{ nivel: 'ambar', titulo: 'Algo', href: '/x', hrefLabel: 'Ver' }, { nivel: 'rojo', titulo: 'La asistencia bajó', href: '/crm', hrefLabel: 'Ver' }] } as never },
  }), HOJA, {}, AHORA);
  assert.deepEqual(v.necesita?.map((n) => [n.id, n.n, n.detalle]), [
    ['cuotas', 3, 'De 2 clientes'], ['leads', 5, '3 sin R2 ni resolución'], ['tareas', 2, 'La más vieja, del 28/10'], ['alertas', 1, 'La asistencia bajó'],
  ]);
  const nada = vistaGeneral(datos({ cobranza: { ok: true, d: { cobros: [cobro(3, 'pronto')], tz: TZ, deQuien: null } } }), HOJA, {}, AHORA);
  assert.deepEqual(nada.necesita, [], 'leído y sin nada: la lista vacía, no null');
});

test('«Lo que vence»: las tres semanas que vienen y lo vencido, por fecha, hasta seis', () => {
  const tareas = ['2026-11-30', '2026-11-04', '2026-10-28', '2026-11-20', '2026-11-06', '2026-11-12', '2026-11-25'].map((d, i) => tarea({ id: `t${i}`, deadline: d }));
  const v = vistaGeneral(datos({ plan: { ok: true, d: plan({ deadlines: { tareas, proyectos: [proyecto({ id: 'p', deadline: '2026-11-08' })] } }) } }), HOJA, {}, AHORA);
  assert.equal(v.vence?.total, 7, 'el 30/11 queda afuera (más de 21 días)');
  assert.equal(v.vence?.vencidas, 1);
  assert.deepEqual(v.vence?.lista.map((x) => `${x.dia}/${x.mes}`), ['28/Oct', '4/Nov', '6/Nov', '8/Nov', '12/Nov', '20/Nov']);
  assert.equal(v.vence?.lista[0].cuando, 'Vencida');
  assert.equal(v.vence?.lista[3].que, 'Proyecto');
});

test('«Te deben»: el total y los tramos de la pieza (las cuentas de Cobranza), y las tres cuotas más urgentes', () => {
  const pieza = res(['pendiente', 'pagos'], [{ clave: 'Al día', valores: [3000, 4] }, { clave: '1-30 días', valores: [800, 1] }, { clave: '60+ días', valores: [1200, 2] }]);
  const v = vistaGeneral(datos({
    cobranza: { ok: true, d: { cobros: [cobro(1, null), cobro(2, 'pronto'), cobro(3, 'vencida'), cobro(4, null)], tz: TZ, deQuien: null } },
  }), HOJA, { 'g-deben': { resultado: pieza } }, AHORA);
  assert.equal(v.deben?.total, 5000);
  assert.deepEqual(v.deben?.tramos?.map((t) => [t.nombre, t.monto]), [['Al día', 3000], ['1-30 días', 800], ['31-60 días', 0], ['60+ días', 1200]]);
  assert.deepEqual(v.deben?.cuotas?.map((c) => c.leadId), [3, 2, 1], 'lo vencido primero, después lo que vence pronto');
  const sinPieza = vistaGeneral(datos({ cobranza: { ok: true, d: { cobros: [], tz: TZ, deQuien: null } } }), HOJA, {}, AHORA);
  assert.equal(sinPieza.deben?.total, null, 'sin la pieza, el total no se sabe');
});

test('«Próximas llamadas»: sólo las del CRM que no terminaron, la más cercana arriba, con hoy y mañana', () => {
  const v = vistaGeneral(datos({
    calendario: { ok: true, d: { tz: TZ, hoy: HOY, falla: false, items: [
      evento({ id: 'm', titulo: 'Paola', inicio: mx('10:00', '2026-11-05') }),
      evento({ id: 'paso', inicio: mx('09:00'), fin: mx('09:30') }),
      evento({ id: 'h', titulo: 'Laura', inicio: mx('12:30'), fin: mx('13:00'), detalle: 'R2' }),
      evento({ id: 'otro', inicio: mx('12:00'), fuente: 'propio', capa: 'entregas' }),
    ] } },
  }), HOJA, {}, AHORA);
  assert.deepEqual(v.llamadas?.map((l) => l.id), ['h', 'm']);
  assert.equal(v.llamadas?.[0].detalle, 'Hoy 12:30 · R2');
  assert.equal(v.llamadas?.[0].cuando, 'en 1 h');
  assert.match(v.llamadas?.[1].detalle ?? '', /^Mañana 10:00/);
  assert.equal(v.llamadas?.[1].cuando, '5/11', 'otro día: la fecha, no las horas que faltan');
});

test('el día y lo que falta de una llamada, como en la maqueta', () => {
  assert.equal(diaDeLlamada(HOY, HOY), 'Hoy');
  assert.equal(diaDeLlamada('2026-11-05', HOY), 'Mañana');
  assert.equal(diaDeLlamada('2026-11-06', HOY), 'Viernes');
  assert.equal(diaDeLlamada('2026-11-09', HOY), 'Lunes');
  assert.equal(diaDeLlamada('2026-11-11', HOY), '11/11', 'pasada la semana, la fecha');
  const en = (min: number) => faltaParaLlamada(AHORA + min * 60_000, HOY, HOY, AHORA);
  assert.equal(en(40), 'en 40 min');
  assert.equal(en(80), 'en 1 h');
  assert.equal(en(415), 'en 6 h');
  assert.equal(en(0), 'Ahora');
  assert.equal(faltaParaLlamada(AHORA + 30 * 3_600_000, '2026-11-05', HOY, AHORA), '5/11');
});

test('cableado: la plantilla General trae su diseño con sus dos piezas, y el editor lo dibuja mirando', () => {
  assert.ok(DISENOS_HOJA.includes('general'));
  const p = PLANTILLAS_GENERAL.find((x) => x.id === 'general')!;
  const h = instanciarPlantilla(p);
  assert.equal(h.diseno?.id, 'general');
  const porId = new Map(h.componentes.map((c) => [c.id, c]));
  const meses = porId.get(h.diseno!.piezas.meses) as { metricas?: string[]; dimension?: string } | undefined;
  const deben = porId.get(h.diseno!.piezas.deben) as { metricas?: string[]; dimension?: string } | undefined;
  assert.deepEqual(meses?.metricas, ['cobrado', 'gasto'], 'la pieza de los meses trae lo cobrado y la inversión');
  assert.equal(meses?.dimension, 'mes');
  assert.equal(deben?.dimension, 'atraso', 'lo que te deben, por tramo de atraso (como Cobranza)');
  cableadoDelDiseno(h, 'general', 'GeneralVivo', ['conGeneral ?', 'datos={datos}']);
  assert.match(leer('app/dashboard/EditorInforme.tsx'), /<BloqueDeDiseno[\s\S]{0,600}conGeneral=\{!!general\?\.datos\}/, 'sólo con los datos de General');
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes:
//   · «Lo que vence» hasta 30 días en vez de 21 → 1 fallo («Lo que vence»);
//   · las llamadas sin sacar las que ya terminaron → 1 fallo («Próximas llamadas»);
//   · un mes sin comparar dibujado en cero en vez de null → 1 fallo (lo que no se leyó);
//   · «Te deben» sin ordenar por urgencia → 1 fallo;
//   · la escala con el tope en un paso → 1 fallo;
//   · el funnel sin «Sin etapa» → 1 fallo.
