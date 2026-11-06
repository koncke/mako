// =============================================================================
// La hoja «Mi día» con su DISEÑO PROPIO (la copia de Lumora): de dónde sale cada número (lib/mi-dia-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «Carga los de FOCUS que ya teníamos». Lumora es la segunda referencia de Focus; la hoja la dibuja
// app/dashboard/disenos/HojaMiDia.tsx con lo que arma `vistaMiDia` de los datos de General. Estos tests EJECUTAN esas
// funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes:
//   · el hueco «Libre» desde 30 minutos en vez de una hora → 1 fallo (la cinta);
//   · las llamadas contando todo el día y no sólo lo del CRM → 1 fallo (los cuatro números);
//   · un número que no se leyó como 0 en vez de null (`?? 0`) → 1 fallo (lo que no se leyó no es un cero);
//   · «Lo que vence» sin ordenar por fecha → 1 fallo;
//   · el mes arrancando en domingo y no en lunes → 1 fallo;
//   · la dona sin juntar en «Otras» lo que pasa de cuatro etapas → 1 fallo;
//   · la próxima llamada contando la que está corriendo (`!== 'paso'`) → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatosGeneral, TareaVista, OkrVista } from '../app/general/datos-tipos';
import type { KpiVista } from '../app/general/KpisCard';
import type { Label } from '../app/plan/board/types';
import type { ItemCalendario } from '../lib/calendario-modelo';
import type { CobroM } from '../app/m/dashboard/modelo';
import { cintaDelDia, duracion, etapasDeLaDona, mesDe, resumenDelDia, tonoDe, vistaMiDia } from '../lib/mi-dia-diseno';
import { cableadoDelDiseno } from './_diseno-cableado';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { instanciarPlantilla } from '../lib/graficos-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04'; // miércoles
const TZ = 'America/Mexico_City'; // UTC-6
// 11:10 en Ciudad de México.
const AHORA = Date.parse('2026-11-04T17:10:00Z');
// La hora de Ciudad de México en ISO (UTC).
const mx = (hhmm: string, dia = HOY) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.parse(`${dia}T00:00:00Z`) + ((h + 6) * 60 + m) * 60_000).toISOString();
};

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
  return { fuente: 'propio', capa: 'entregas', titulo: `Evento ${o.id}`, fin: null, diaCompleto: false, href: null, ...o };
}
function kpi(o: Partial<KpiVista> & { id: string }): KpiVista {
  return {
    nombre: `KPI ${o.id}`, cadencia: 'diaria', compromiso: 10, unidad: 'numero', fuente: 'manual', fuenteId: null, objectiveId: null,
    valor: 5, estado: 'verde', pct: 50, umbralVerde: 90, umbralAmbar: 70, funnelIds: [], ...o,
  } as KpiVista;
}
function okr(o: Partial<OkrVista> & { id: string }): OkrVista {
  return {
    titulo: `OKR ${o.id}`, metrica: 'facturacion', metricaLabel: 'Facturación', unidad: 'usd', metaValor: 1000, quarter: 4,
    avanceManual: null, funnelIds: [], actual: 500, pct: 50, atrasado: false, fraccion: 0.4, principal: false, ...o,
  } as OkrVista;
}
const cobro = (leadId: number, urgencia: CobroM['urgencia']): CobroM => ({ leadId, pagoId: leadId * 10, nombre: `Cliente ${leadId}`, linea: 'US$100', urgencia });
const falla = { ok: false as const, error: 'No se pudo leer.' };

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
const cal = (items: ItemCalendario[]) => ({ ok: true as const, d: { items, tz: TZ, hoy: HOY, falla: false } });

test('la duración se dice en horas y minutos', () => {
  assert.equal(duracion(45), '45 min');
  assert.equal(duracion(60), '1 h');
  assert.equal(duracion(75), '1 h 15 min');
});

test('el tono: las llamadas en verde, lo del Plan en amarillo, lo publicado en arcilla, lo demás cielo', () => {
  assert.equal(tonoDe({ fuente: 'crm', capa: 'llamadas' }), 'pine');
  assert.equal(tonoDe({ fuente: 'plan', capa: 'entregas' }), 'lemon');
  assert.equal(tonoDe({ fuente: 'propio', capa: 'publicaciones' }), 'clay');
  assert.equal(tonoDe({ fuente: 'google', capa: 'llamadas' }), 'sky');
});

test('la cinta del día: lo de hoy en orden, «Libre» desde una hora, pausa desde 15 minutos, y el estado contra el reloj', () => {
  const items = [
    evento({ id: 'b', inicio: mx('11:00'), fin: mx('11:30'), fuente: 'crm', capa: 'llamadas' }),
    evento({ id: 'a', inicio: mx('09:00'), fin: mx('10:30') }), // 30 min antes de b: pausa
    evento({ id: 'c', inicio: mx('11:40'), fin: mx('12:00') }), // 10 min después de b: sin hueco
    evento({ id: 'd', inicio: mx('12:30') }), // sin fin: 30 min; 30 min después de c: pausa
    evento({ id: 'e', inicio: mx('15:00'), fin: mx('16:00') }), // 2 h después de d: libre
    evento({ id: 'todo', inicio: mx('00:00'), diaCompleto: true }),
    evento({ id: 'manana', inicio: mx('09:00', '2026-11-05') }),
  ];
  const cinta = cintaDelDia(items, HOY, TZ, AHORA);
  assert.deepEqual(cinta.map((b) => (b.tipo === 'evento' ? b.id : b.tipo)), ['a', 'pausa', 'b', 'c', 'pausa', 'd', 'libre', 'e']);
  const ev = (id: string) => cinta.find((b) => b.tipo === 'evento' && b.id === id) as Extract<(typeof cinta)[number], { tipo: 'evento' }>;
  assert.equal(ev('a').estado, 'paso');
  assert.equal(ev('b').estado, 'ahora');
  assert.equal(ev('e').estado, 'viene');
  assert.equal(ev('b').tono, 'pine');
  assert.equal(ev('d').fin - ev('d').inicio, 30 * 60_000, 'un evento sin fin dura 30 minutos');
  const libre = cinta.find((b) => b.tipo === 'libre') as Extract<(typeof cinta)[number], { tipo: 'libre' }>;
  assert.equal(libre.dura, '2 h');
  assert.equal(libre.desde, '13:00');
});

test('el mes: de lunes a domingo, con hoy marcado, los días de afuera y hasta tres puntos por día', () => {
  const items = [
    evento({ id: '1', inicio: mx('09:00'), fuente: 'crm', capa: 'llamadas' }),
    evento({ id: '2', inicio: mx('10:00'), fuente: 'crm', capa: 'llamadas' }),
    evento({ id: '3', inicio: mx('11:00'), fuente: 'plan' }),
    evento({ id: '4', inicio: mx('12:00'), capa: 'publicaciones' }),
    evento({ id: '5', inicio: mx('13:00'), fuente: 'google' }),
  ];
  const m = mesDe(items, HOY, TZ);
  assert.equal(m.titulo, 'Noviembre 2026');
  assert.equal(m.dias[0].dia, '2026-10-26', 'noviembre de 2026 arranca un domingo: la grilla abre el lunes anterior');
  assert.equal(m.dias.length, 42, 'noviembre de 2026 toca seis semanas (el 30 es lunes)');
  assert.equal(m.dias.at(-1)?.dia, '2026-12-06');
  const octubre = mesDe([], '2026-10-15', TZ);
  assert.equal(octubre.dias.length, 35, 'octubre toca cinco: la sexta fila, toda de noviembre, no se dibuja');
  assert.equal(octubre.dias.at(-1)?.dia, '2026-11-01');
  assert.ok(m.dias[0].fuera && m.dias[0].n === 26);
  assert.ok(m.dias[5].finde && m.dias[6].finde && !m.dias[4].finde);
  const hoy = m.dias.find((d) => d.hoy)!;
  assert.equal(hoy.dia, HOY);
  assert.deepEqual(hoy.puntos, ['pine', 'lemon', 'clay'], 'sin repetir y hasta tres');
});

test('lo que no se pudo leer es null, nunca un cero, y el pie lo dice', () => {
  const v = vistaMiDia(datos(), AHORA);
  assert.equal(v.semana, null);
  assert.deepEqual(v.resumen, { llamadas: null, tareas: null, vencidas: null });
  for (const k of ['cinta', 'vence', 'funnel', 'okrs', 'deben', 'semaforo', 'mes', 'dia', 'recordatorios', 'aTildar'] as const) {
    assert.equal(v[k], null, k);
  }
  for (const n of v.numeros) {
    assert.equal(n.valor, null, n.id);
    assert.match(n.pie, /No pude leer/, n.id);
  }
});

test('los cuatro números: las llamadas son lo del CRM de hoy, las tareas las de hoy, las cuotas y los KPIs diarios en verde', () => {
  const v = vistaMiDia(datos({
    calendario: cal([
      evento({ id: 'r1', titulo: 'Llamada con Ana', inicio: mx('09:00'), fin: mx('09:30'), fuente: 'crm', capa: 'llamadas' }),
      evento({ id: 'r2', titulo: 'Llamada con Beto', inicio: mx('14:00'), fin: mx('14:30'), fuente: 'crm', capa: 'llamadas', href: '/crm?lead=2' }),
      evento({ id: 'otro', inicio: mx('12:00'), fuente: 'google' }),
    ]),
    plan: { ok: true, d: plan({ deHoy: { cerradas: 1, total: 4 }, vencidas: 2 }) },
    cobranza: { ok: true, d: { cobros: [cobro(1, 'vencida'), cobro(1, 'pronto'), cobro(2, null)], tz: TZ, deQuien: null } },
    kpis: { ok: true, d: { kpis: [kpi({ id: 'a' }), kpi({ id: 'b', estado: 'rojo' }), kpi({ id: 'c', cadencia: 'semanal' })], candidatos: [], objetivos: [], objetivoPrincipalId: null } },
  }), AHORA);
  const n = Object.fromEntries(v.numeros.map((x) => [x.id, x]));
  assert.equal(n.llamadas.valor, 2);
  assert.equal(n.llamadas.meter, 0.5, 'una de dos ya pasó');
  assert.equal(n.llamadas.destacado, '14:00 · Llamada con Beto');
  assert.deepEqual(v.proxima, { titulo: 'Llamada con Beto', hora: '14:00', href: '/crm?lead=2' });
  assert.equal(n.tareas.valor, 4);
  assert.equal(n.tareas.meter, 0.25);
  assert.equal(n.tareas.destacado, '2 vencidas');
  assert.equal(n.cobros.valor, 3);
  assert.equal(n.cobros.pie, 'De 2 clientes');
  assert.equal(n.cobros.destacado, '1 vencida');
  assert.equal(n.kpis.valor, 1);
  assert.equal(n.kpis.pie, 'En verde, de 2');
  assert.deepEqual(v.deben?.map((c) => c.urgencia), ['vencida', 'pronto', null], 'los que deben, de lo más urgente');
});

test('la próxima llamada es la que todavía no empezó: la que corre ya se ve en la cinta con «Ahora»', () => {
  const v = vistaMiDia(datos({
    calendario: cal([
      evento({ id: 'corre', titulo: 'Llamada con Ana', inicio: mx('11:00'), fin: mx('11:30'), fuente: 'crm', capa: 'llamadas' }),
      evento({ id: 'viene', titulo: 'Llamada con Beto', inicio: mx('14:00'), fin: mx('14:30'), fuente: 'crm', capa: 'llamadas' }),
    ]),
  }), AHORA);
  assert.equal(v.proxima?.titulo, 'Llamada con Beto');
  assert.equal(v.recordatorios?.[0].titulo, 'Llamada con Beto');
});

test('lo que vence: tareas y proyectos juntos, por fecha, hasta cinco, y lo vencido en coral', () => {
  const etiquetas = [proyecto({ id: 'v', name: 'Ventas' })];
  const tareas = ['2026-11-09', '2026-11-02', HOY, '2026-11-20', '2026-11-12', '2026-11-30'].map((deadline, i) =>
    tarea({ id: `t${i}`, deadline, labels: ['v'] }));
  const v = vistaMiDia(datos({
    plan: { ok: true, d: plan({ etiquetas, deadlines: { tareas, proyectos: [proyecto({ id: 'p', name: 'Lanzamiento', deadline: '2026-11-06' })] } }) },
  }), AHORA);
  assert.deepEqual(v.vence?.map((x) => x.id), ['t1', 't2', 'p-p', 't0', 't4']);
  assert.equal(v.vence?.[0].tono, 'coral');
  assert.equal(v.vence![0].detalle, 'Ventas · 02/11 · Vencida');
  assert.equal(v.vence?.[1].tono, 'marigold');
  assert.equal(v.vence?.[2].tono, 'clay');
  assert.equal(v.vence?.[2].mes, 'Nov');
});

test('los OKRs: sin los que no tienen avance, el avance topeado y lo esperado a hoy', () => {
  const v = vistaMiDia(datos({
    okrs: { ok: true, d: { anio: 2026, quarter: 4, lista: [okr({ id: '1', pct: 130, fraccion: 0.43 }), okr({ id: '2', pct: null }), okr({ id: '3', pct: 12.4 })] } },
  }), AHORA);
  assert.deepEqual(v.okrs?.map((o) => [o.avance, o.esperado]), [[100, 43], [12, 40]]);
});

test('la semana del trimestre y los recordatorios: la próxima llamada, las vencidas con la más vieja y el próximo hueco', () => {
  const v = vistaMiDia(datos({
    cabecera: { ok: true, d: { quarter: 4, progreso: { diasTranscurridos: 35 } } as never },
    calendario: cal([
      evento({ id: 'r', titulo: 'Llamada con Ana', inicio: mx('12:00'), fin: mx('12:30'), fuente: 'crm', capa: 'llamadas' }),
      evento({ id: 'x', inicio: mx('15:00'), fin: mx('16:00') }),
    ]),
    plan: { ok: true, d: plan({ vencidas: 2, deadlines: { tareas: [tarea({ id: 'v1', deadline: '2026-10-28' }), tarea({ id: 'v2', deadline: '2026-11-01' })], proyectos: [] } }) },
  }), AHORA);
  assert.equal(v.semana, 'Semana 5 del Q4');
  assert.deepEqual(v.recordatorios?.map((r) => r.id), ['proxima', 'vencidas', 'hueco']);
  assert.match(v.recordatorios![1].detalle, /28\/10/);
  assert.equal(v.recordatorios![2].detalle, 'Hoy 12:30–15:00');
});

test('la dona del funnel: las etapas con gente, «Sin etapa» y, pasadas las cuatro, «Otras»; los tramos suman el total', () => {
  const pocas = etapasDeLaDona({ etapas: [{ label: 'Nuevo', n: 5 }, { label: 'Agendó', n: 0 }, { label: 'Asistió', n: 2 }], sinEtapa: 1, total: 8 });
  assert.deepEqual(pocas, [{ nombre: 'Nuevo', n: 5 }, { nombre: 'Asistió', n: 2 }, { nombre: 'Sin etapa', n: 1 }]);
  const muchas = etapasDeLaDona({ etapas: ['A', 'B', 'C', 'D', 'E'].map((label, i) => ({ label, n: i + 1 })), sinEtapa: 2, total: 17 });
  assert.deepEqual(muchas.map((e) => e.nombre), ['A', 'B', 'C', 'Otras']);
  assert.equal(muchas.reduce((s, e) => s + e.n, 0), 17);
});

test('la frase de arriba: lo que no se leyó no se nombra, y sin nada hoy se dice', () => {
  const texto = (r: Parameters<typeof resumenDelDia>[0]) => resumenDelDia(r).map((t) => t.s).join('');
  assert.equal(texto({ llamadas: 3, tareas: 5, vencidas: 0 }), 'Tienes 3 llamadas hoy y 5 tareas que vencen.');
  assert.equal(texto({ llamadas: 1, tareas: null, vencidas: null }), 'Tienes 1 llamada hoy.');
  assert.equal(texto({ llamadas: 0, tareas: 1, vencidas: null }), 'Tienes 1 tarea que vence hoy.');
  assert.equal(texto({ llamadas: 0, tareas: 0, vencidas: null }), 'Hoy no tienes llamadas ni tareas que venzan.');
  assert.equal(texto({ llamadas: null, tareas: null, vencidas: null }), 'No pude leer tu calendario ni tu Plan.');
  assert.deepEqual(resumenDelDia({ llamadas: 2, tareas: 4, vencidas: 0 }).find((t) => t.tipo === 'link'), { tipo: 'link', s: '4 tareas que vencen', href: '/plan' });
});

test('cableado: el diseño está en el catálogo, la plantilla lo lleva, y el editor lo dibuja con sus datos', () => {
  // `ok` y no `match`: con el archivo entero en el mensaje, un fallo no se lee.
  assert.ok(/DISENOS_HOJA = \[[^\]]*'mi-dia'/.test(leer('lib/graficos-catalogo.ts')), 'el diseño en el catálogo');
  assert.ok(/diseno: \{ id: 'mi-dia', piezas: \{\} \}/.test(leer('lib/general-plantillas.ts')), 'la plantilla con el diseño');
  cableadoDelDiseno(instanciarPlantilla(PLANTILLAS_GENERAL.find((p) => p.id === 'mi-dia')!), 'mi-dia', 'MiDiaVivo', ['conGeneral ?']);
});
