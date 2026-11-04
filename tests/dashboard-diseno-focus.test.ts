// =============================================================================
// La hoja Focus con su DISEÑO PROPIO (la copia de Pane): de dónde sale cada número (lib/focus-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «Carga los de FOCUS que ya teníamos». La hoja dibuja (app/dashboard/disenos/HojaFocus.tsx) lo que
// arma `vistaFocus` con los datos de los bloques de General. Estos tests EJECUTAN esa función con datos armados acá
// (ficticios) y miran lo que sale; no leen el fuente salvo para el cableado del final.
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes:
//   · `vencidas` contando las de hoy (`<=` en vez de `<` en semanaDe) → 1 fallo («La semana»);
//   · el resumen con `?? 0` en vez de null cuando el Plan no se pudo leer → 1 fallo (lo que no se leyó no es un cero);
//   · «Lo que viene» sin el filtro de lo que ya terminó → 1 fallo;
//   · la lista de tareas sin el respaldo de las prioritarias → 1 fallo;
//   · `abiertas` contando también las completas → 1 fallo («Proyectos»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatosGeneral, TareaVista } from '../app/general/datos-tipos';
import type { Label } from '../app/plan/board/types';
import type { ItemCalendario } from '../lib/calendario-modelo';
import {
  cuandoVence, enCuanto, lineaProyecto, loQueViene, semanaDe, subtituloFocus, tareaFocus, vistaFocus,
} from '../lib/focus-diseno';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const HOY = '2026-11-04'; // miércoles
const TZ = 'America/Mexico_City';
// 11:10 en Ciudad de México (UTC-6).
const AHORA = Date.parse('2026-11-04T17:10:00Z');

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
const sinAvance = () => ({ pct: 0, total: 0 });

test('cuándo vence: Hoy, Ayer, Mañana o la fecha', () => {
  assert.equal(cuandoVence(HOY, HOY), 'Hoy');
  assert.equal(cuandoVence('2026-11-03', HOY), 'Ayer');
  assert.equal(cuandoVence('2026-11-05', HOY), 'Mañana');
  assert.equal(cuandoVence('2026-11-12', HOY), '12/11');
  assert.equal(cuandoVence('', HOY), '');
});

test('una tarea de «Mis tareas»: atrasada es Urgente, prioridad alta es Alta, y su proyecto sale de sus etiquetas', () => {
  const etiquetas = [proyecto({ id: 'v', name: 'Ventas', color: '#7C5CFB' })];
  const atrasada = tareaFocus(tarea({ id: '1', deadline: '2026-11-03', labels: ['v'], priority: 'baja' }), etiquetas, HOY);
  assert.equal(atrasada.prio, 'urgente');
  assert.deepEqual(atrasada.proyecto, { nombre: 'Ventas', color: '#7C5CFB' });
  assert.equal(atrasada.cuando, 'Ayer');
  assert.equal(tareaFocus(tarea({ id: '2', deadline: HOY, priority: 'alta' }), etiquetas, HOY).prio, 'alta');
  const comun = tareaFocus(tarea({ id: '3', deadline: HOY, labels: ['otro'] }), etiquetas, HOY);
  assert.equal(comun.prio, null);
  assert.equal(comun.proyecto, null, 'una etiqueta que no está en la lista no inventa un proyecto');
});

test('La semana: lo que vence cada día de lunes a domingo, hoy marcado, y las vencidas aparte', () => {
  const p = plan({
    deadlines: {
      tareas: [tarea({ id: '1', deadline: '2026-11-02' }), tarea({ id: '2', deadline: HOY }), tarea({ id: '3', deadline: HOY }), tarea({ id: '4', deadline: '2026-11-08' }), tarea({ id: '5', deadline: '2026-10-28' })],
      proyectos: [proyecto({ id: 'a', deadline: '2026-11-06' })],
    },
  });
  const s = semanaDe(p, HOY);
  assert.deepEqual(s.dias.map((d) => d.dia), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(s.dias.map((d) => d.n), [1, 0, 2, 0, 1, 0, 1]);
  assert.deepEqual(s.dias.map((d) => d.tipo), ['pasado', 'pasado', 'hoy', 'futuro', 'futuro', 'futuro', 'futuro']);
  assert.equal(s.total, 5, 'la de la semana pasada no cuenta en la semana');
  assert.equal(s.vencidas, 2, 'vencidas: las de antes de hoy (la del lunes y la de la semana pasada), no las de hoy');
});

test('Lo que viene: lo de hoy desde ahora, en orden; lo de día completo cuenta todo el día', () => {
  const items = [
    evento({ id: 'paso', inicio: '2026-11-04T15:00:00Z', fin: '2026-11-04T16:00:00Z' }),
    evento({ id: 'tarde', inicio: '2026-11-04T22:00:00Z' }),
    evento({ id: 'proxima', inicio: '2026-11-04T17:30:00Z', fin: '2026-11-04T18:15:00Z' }),
    evento({ id: 'todoeldia', inicio: '2026-11-04T06:00:00Z', diaCompleto: true }),
    evento({ id: 'manana', inicio: '2026-11-05T17:00:00Z' }),
    // 23:30 de hoy en México es 05:30 UTC de mañana: es de HOY en la zona del negocio.
    evento({ id: 'noche', inicio: '2026-11-05T05:30:00Z' }),
  ];
  const v = loQueViene(items, HOY, TZ, AHORA)!;
  assert.equal(v.proxima?.id, 'proxima', 'la primera es la que no es de día completo');
  assert.deepEqual(v.despues.map((e) => e.id), ['todoeldia', 'tarde', 'noche']);
  assert.ok(!v.despues.some((e) => e.id === 'paso'), 'lo que ya terminó no está');
});

test('vistaFocus: lo que no se pudo leer es null, nunca un cero', () => {
  const v = vistaFocus(datos(), AHORA, sinAvance);
  assert.equal(v.resumen.tareas, null);
  assert.equal(v.resumen.llamadas, null);
  assert.equal(v.resumen.vencidas, null);
  assert.equal(v.viene, null);
  assert.equal(v.meta, null);
  assert.equal(v.tareas, null);
  assert.equal(v.semana, null);
  assert.equal(v.proyectos, null);
  assert.deepEqual(v.espera, { cobros: null, leads: null });
});

test('vistaFocus: las cifras de arriba y los anillos salen del Plan, del Calendario y de los KPIs del día', () => {
  const v = vistaFocus(datos({
    plan: { ok: true, d: plan({ deHoy: { cerradas: 2, total: 7 }, vencidas: 3 }) },
    calendario: {
      ok: true, d: {
        tz: TZ, hoy: HOY, falla: false, items: [
          evento({ id: 'r1', fuente: 'crm', inicio: '2026-11-04T15:00:00Z' }),
          evento({ id: 'r2', fuente: 'crm', inicio: '2026-11-04T18:00:00Z' }),
          evento({ id: 'r3', fuente: 'crm', inicio: '2026-11-05T18:00:00Z' }),
          evento({ id: 'otro', inicio: '2026-11-04T15:30:00Z' }),
        ],
      },
    },
  }), AHORA, sinAvance);
  assert.deepEqual(v.resumen.tareas, { cerradas: 2, total: 7 });
  assert.equal(v.resumen.vencidas, 3);
  assert.deepEqual(v.resumen.llamadas, { pasaron: 1, total: 2 }, 'sólo las llamadas del CRM de hoy; pasó la de las 9');
  assert.deepEqual(v.anillos.map((a) => [a.id, a.v, a.de]), [['tareas', 2, 7], ['llamadas', 1, 2], ['kpis', 0, 0]]);
});

test('vistaFocus: «Mis tareas» son las de hoy y atrasadas; si no hay, las que más mueven la aguja', () => {
  const deHoy = plan({ deadlines: { tareas: [tarea({ id: '1', deadline: HOY }), tarea({ id: '2', deadline: '2026-11-01' }), tarea({ id: '3', deadline: '2026-11-09' })], proyectos: [] } });
  const a = vistaFocus(datos({ plan: { ok: true, d: deHoy } }), AHORA, sinAvance);
  assert.equal(a.tareas?.deHoy, true);
  assert.deepEqual(a.tareas?.lista.map((t) => t.id), ['1', '2']);
  const sinHoy = plan({ top: [tarea({ id: 'x' }), tarea({ id: 'y' })], deadlines: { tareas: [tarea({ id: '3', deadline: '2026-11-09' })], proyectos: [] } });
  const b = vistaFocus(datos({ plan: { ok: true, d: sinHoy } }), AHORA, sinAvance);
  assert.equal(b.tareas?.deHoy, false);
  assert.deepEqual(b.tareas?.lista.map((t) => t.id), ['x', 'y']);
});

test('vistaFocus: los proyectos con su avance y sus tareas abiertas, hasta cinco', () => {
  const proyectos = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => proyecto({ id }));
  const p = plan({
    proyectos,
    tareasDeProyectos: [tarea({ id: '1', labels: ['a'], progress: 40 }), tarea({ id: '2', labels: ['a'], progress: 100 }), tarea({ id: '3', labels: ['a', 'b'] })],
  });
  const v = vistaFocus(datos({ plan: { ok: true, d: p } }), AHORA, (id) => ({ pct: id === 'a' ? 47 : 0, total: 1 }));
  assert.equal(v.proyectos?.length, 5);
  assert.deepEqual(v.proyectos?.slice(0, 2).map((x) => [x.id, x.pct, x.abiertas]), [['a', 47, 2], ['b', 0, 1]]);
});

test('vistaFocus: la meta, con lo esperado a hoy; sin el avance medido no se dice si va atrasada', () => {
  const cab = (pct: number | null) => ({
    ok: true as const,
    d: { objetivo: { titulo: 'US$30,000 de facturación', pct }, fraccion: 0.58, progreso: { diasRestantes: 57 } } as unknown as Extract<DatosGeneral['cabecera'], { ok: true }>['d'],
  });
  const a = vistaFocus(datos({ cabecera: cab(62.4) }), AHORA, sinAvance);
  assert.deepEqual(a.meta, { titulo: 'US$30,000 de facturación', pct: 62, esperado: 58, diasRestantes: 57, atrasado: false });
  assert.equal(vistaFocus(datos({ cabecera: cab(40) }), AHORA, sinAvance).meta?.atrasado, true);
  assert.equal(vistaFocus(datos({ cabecera: cab(null) }), AHORA, sinAvance).meta?.atrasado, null);
});

test('la línea de un proyecto y el subtítulo del día', () => {
  assert.equal(lineaProyecto({ pct: 47, deadline: '2026-11-30' }, HOY), 'En curso · vence el 30/11');
  assert.equal(lineaProyecto({ pct: 0, deadline: '2027-01-06' }, HOY), 'Por iniciar · vence el 6/1');
  assert.equal(lineaProyecto({ pct: 100, deadline: null }, HOY), 'Completo');
  assert.equal(lineaProyecto({ pct: 20, deadline: '2026-11-01' }, HOY), 'En curso · venció el 1/11');
  assert.equal(subtituloFocus('miércoles 4 de noviembre', 3, 5), 'Miércoles 4 de noviembre · 3 llamadas y 5 tareas para hoy');
  assert.equal(subtituloFocus('miércoles 4 de noviembre', 1, 0), 'Miércoles 4 de noviembre · 1 llamada para hoy');
  assert.equal(subtituloFocus('miércoles 4 de noviembre', 0, 0), 'Miércoles 4 de noviembre · Nada que vence hoy');
  assert.equal(subtituloFocus(undefined, null, null), '', 'lo que no se pudo leer no se cuenta como cero');
});

test('en cuánto empieza lo próximo', () => {
  assert.equal(enCuanto('2026-11-04T17:30:00Z', AHORA), 'en 20 min');
  assert.equal(enCuanto('2026-11-04T19:40:00Z', AHORA), 'en 2 h 30 min');
  assert.equal(enCuanto('2026-11-04T17:00:00Z', AHORA), 'ahora');
});

test('Focus es un diseño del catálogo, su plantilla lo trae, y el editor lo dibuja sólo con los datos de General', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('foco'));
  assert.match(leer('lib/general-plantillas.ts'), /id: 'foco'[\s\S]{0,900}diseno: \{ id: 'foco', piezas: \{\} \}/);
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.match(editor, /hoja\.diseno\?\.id === 'foco' && general\?\.datos && !enGrilla && !editando && !dueno \? \(/);
  assert.match(leer('app/general/ProveedorGeneral.tsx'), /\n\s+datos,\n\s+\}\), \[datos, variables\]\)/, 'General presta sus datos a la hoja');
});
