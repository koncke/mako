// =============================================================================
// Hijo de tests/plan-kanban-server.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/todo.ts y lib/plan-board.ts llevan `server-only`, así que node:test no los puede importar:
// este archivo corre en un node aparte con `--conditions=react-server` (el precedente es
// tests/_cobros-conexion-hijo.ts) y le contesta al test con un JSON.
//
// No hay base: `fetch` es de mentira y contesta como PostgREST sobre tres tablas en memoria
// (experimento_tareas, plan_tareas, plan_dependencias). Lo que se prueba es lo que decide el
// código de ESTE repo al escribir el kanban (16/10/2026): qué columna, qué avance, qué motivo y
// qué lugar quedan en la FILA después de crear, mover, editar y guardar — en las DOS mitades.
//
// El PostgREST de mentira entiende lo que estas funciones usan y nada más: filtros `eq.`,
// `order` (varias columnas), `limit`, `select` (devuelve la fila entera), GET / POST (insert o
// upsert con `on_conflict`) / PATCH, y `Accept: application/vnd.pgrst.object+json` (`.single()`).

type Fila = Record<string, unknown>;

const db: Record<string, Fila[]> = { experimento_tareas: [], plan_tareas: [], plan_proyectos: [], plan_dependencias: [] };
let siguienteId = 1000;
/** Lo que se escribió, en orden: «PATCH plan_tareas estado,orden,…». */
let escrituras: string[] = [];

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function filtros(u: URL): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'order', 'limit', 'columns', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push([k, v.slice(3)]);
    else throw new Error(`filtro sin mock: ${k}=${v}`);
  }
  return out;
}
const cumple = (f: Fila, fs: Array<[string, string]>) => fs.every(([k, v]) => String(f[k]) === v);

function ordenar(filas: Fila[], order: string | null): Fila[] {
  if (!order) return filas;
  const claves = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' }; });
  return filas.slice().sort((a, b) => {
    for (const { col, desc } of claves) {
      const x = a[col] as number | string, y = b[col] as number | string;
      if (x === y) continue;
      return (x < y ? -1 : 1) * (desc ? -1 : 1);
    }
    return 0;
  });
}

const defaults = (tabla: string, f: Fila): Fila => {
  const ahora = new Date().toISOString();
  if (tabla === 'experimento_tareas') {
    return { id: siguienteId++, estado: 'por_hacer', progreso: 0, orden: 0, score: 0, prioridad: 'media', categorias: [], checklist: [], historial: [], recurrente: false, motivo_atorada: null, hecho_at: null, notas: '', created_at: ahora, updated_at: ahora, ...f };
  }
  if (tabla === 'plan_tareas') return { estado: 'por_hacer', orden: 0, motivo_atorada: null, created_at: ahora, ...f };
  return { ...f };
};

async function postgrest(u: URL, init: RequestInit): Promise<Response> {
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (!(tabla in db)) return json(404, { message: `tabla sin mock: ${tabla}` });
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const devolver = (filas: Fila[], status = 200) => {
    if (!uno) return json(status, filas);
    if (filas.length !== 1) return json(406, { code: 'PGRST116', message: `JSON object requested, ${filas.length} rows returned` });
    return json(status, filas[0]);
  };
  const fs = filtros(u);
  if (metodo === 'GET') {
    let filas = ordenar(db[tabla].filter((f) => cumple(f, fs)), u.searchParams.get('order'));
    const limit = Number(u.searchParams.get('limit'));
    if (Number.isFinite(limit) && limit > 0) filas = filas.slice(0, limit);
    return devolver(filas.map((f) => ({ ...f })));
  }
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
  const representar = (h.get('Prefer') ?? '').includes('return=representation');
  if (metodo === 'PATCH') {
    const tocadas = db[tabla].filter((f) => cumple(f, fs));
    for (const f of tocadas) Object.assign(f, cuerpo);
    escrituras.push(`PATCH ${tabla} ${Object.keys(cuerpo as Fila).sort().join(',')}`);
    return representar ? devolver(tocadas.map((f) => ({ ...f }))) : json(204, undefined);
  }
  if (metodo === 'POST') {
    const conflicto = (u.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
    const out: Fila[] = [];
    for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
      const previa = conflicto.length ? db[tabla].find((f) => conflicto.every((c) => String(f[c]) === String(fila[c]))) : undefined;
      escrituras.push(`${previa ? 'UPSERT' : 'INSERT'} ${tabla} ${Object.keys(fila).sort().join(',')}`);
      if (previa) { Object.assign(previa, fila); out.push({ ...previa }); }
      else { const nueva = defaults(tabla, fila); db[tabla].push(nueva); out.push({ ...nueva }); }
    }
    return representar ? devolver(out, 201) : json(201, undefined);
  }
  return json(405, { message: `método sin mock: ${metodo}` });
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return postgrest(u, init);
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const WS = 9;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const todo = await import('../lib/todo');
  const plan = await import('../lib/plan-board');
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(WS, fn);
  const reset = () => { for (const t of Object.keys(db)) db[t] = []; escrituras = []; };
  const filaCli = (id: number) => ({ ...db.experimento_tareas.find((f) => f.id === id) });
  const filaPlan = (id: string) => ({ ...db.plan_tareas.find((f) => f.id === id) });
  const resumenCli = (f: Fila) => ({ estado: f.estado, progreso: f.progreso, motivo: f.motivo_atorada, orden: f.orden, hecho: f.hecho_at != null, score: f.score });
  const resumenPlan = (f: Fila) => ({ estado: f.estado, progress: f.progress, motivo: f.motivo_atorada, orden: f.orden, score: f.score });
  const out: Record<string, unknown> = {};

  // ── EL CLIENTE (experimento_tareas) ─────────────────────────────────────────
  // 1. Crear: sin prioridad nace «Sin priorizar» (0); con prioridad, su número; el score
  //    explícito manda; con estado «Completada» nace al 100% y sellada.
  reset();
  db.experimento_tareas.push({ ...defaults('experimento_tareas', { workspace_id: WS, titulo: 'vieja', estado: 'en_curso', orden: 5 }) });
  const libre = await enWs(() => todo.crearTarea({ titulo: 'libre' }));
  const conPrio = await enWs(() => todo.crearTarea({ titulo: 'alta', prioridad: 'alta' }));
  const scoreGana = await enWs(() => todo.crearTarea({ titulo: 'score', prioridad: 'media', score: 0 }));
  const enCurso = await enWs(() => todo.crearTarea({ titulo: 'en curso', estado: 'en_curso' }));
  const completa = await enWs(() => todo.crearTarea({ titulo: 'completa', estado: 'hecho' }));
  out.crearCli = {
    libre: resumenCli(filaCli(libre.id)), conPrio: resumenCli(filaCli(conPrio.id)), scoreGana: resumenCli(filaCli(scoreGana.id)),
    enCurso: resumenCli(filaCli(enCurso.id)), completa: resumenCli(filaCli(completa.id)),
  };

  // 2. EL RETROCESO (decisión 10): una tarjeta movida a mano a «En proceso» al 0% NO vuelve a
  //    «Por iniciar» cuando se edita el título — aunque el patch traiga el avance, como lo
  //    mandaba `editPatch` en cada guardado.
  reset();
  const t2 = await enWs(() => todo.crearTarea({ titulo: 'a mover' }));
  await enWs(() => todo.moverTarea(t2.id, 'en_curso'));
  await enWs(() => todo.editarTarea(t2.id, { titulo: 'título corregido', progreso: 0 }));
  const trasTitulo = resumenCli(filaCli(t2.id));
  await enWs(() => todo.editarTarea(t2.id, { progreso: 100 }));
  const trasCien = resumenCli(filaCli(t2.id));
  await enWs(() => todo.editarTarea(t2.id, { progreso: 40 }));
  out.retrocesoCli = { trasTitulo, trasCien, trasBajar: resumenCli(filaCli(t2.id)) };

  // 3. Mover: completar sella y pone 100; reabrir pone 0; Atorada con motivo; reordenar adentro
  //    conserva el motivo; salir de Atorada lo borra; el avance en Atorada no la saca.
  reset();
  const t3 = await enWs(() => todo.crearTarea({ titulo: 'flujo' }));
  await enWs(() => todo.editarTarea(t3.id, { progreso: 30 }));
  const aHecho = await enWs(() => todo.moverTarea(t3.id, 'hecho'));
  const hechoAt = filaCli(t3.id).hecho_at;
  await enWs(() => todo.moverTarea(t3.id, 'hecho', 7));
  const hechoAtReordenada = filaCli(t3.id).hecho_at;
  const aReabrirR = await enWs(() => todo.moverTarea(t3.id, 'en_curso'));
  const aReabrir = aReabrirR.ok ? resumenCli(filaCli(t3.id)) : aReabrirR;
  const aAtorada = await enWs(() => todo.moverTarea(t3.id, 'en_seguimiento', undefined, { motivo: '  el cliente   no manda el logo  ' }));
  await enWs(() => todo.moverTarea(t3.id, 'en_seguimiento', -50));
  const reordenada = resumenCli(filaCli(t3.id));
  await enWs(() => todo.editarTarea(t3.id, { progreso: 60 }));
  const atoradaConAvance = resumenCli(filaCli(t3.id));
  await enWs(() => todo.moverTarea(t3.id, 'por_hacer'));
  out.moverCli = {
    aHecho: aHecho.ok ? resumenCli(aHecho.tarea as unknown as Fila) : aHecho,
    hechoAtSeConserva: hechoAt != null && hechoAt === hechoAtReordenada,
    aReabrir,
    aAtorada: aAtorada.ok ? aAtorada.tarea.motivo_atorada : aAtorada,
    reordenada, atoradaConAvance,
    aPorIniciar: resumenCli(filaCli(t3.id)),
  };

  // 4. Lo que el server rechaza: un estado inventado, una que no existe, una recurrente a «Completada».
  reset();
  const rec = await enWs(() => todo.crearTarea({ titulo: 'reunión semanal', recurrente: true }));
  out.rechazosCli = {
    inventado: await enWs(() => todo.moverTarea(rec.id, 'Por hacer' as never)),
    noExiste: await enWs(() => todo.moverTarea(99999, 'en_curso')),
    recurrente: await enWs(() => todo.moverTarea(rec.id, 'hecho')),
    recurrenteSigue: resumenCli(filaCli(rec.id)),
  };

  // ── EL DUEÑO (plan_tareas) ──────────────────────────────────────────────────
  const borrador = (o: Record<string, unknown> = {}) => ({
    id: 'tmp', num: 0, emoji: '📌', title: 'tarea', detalle: '', priority: 'futuro', score: 0, progress: 0, deadline: '',
    labels: [], checklist: [], historial: [], origen: 'user', enPrioridad: false, recurrente: false, ...o,
  }) as never;

  // 5. Crear: con la columna del «＋», arriba de esa columna; con score 0, libre.
  reset();
  db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS, id: 'tv', num: 1, title: 'vieja', progress: 10, estado: 'en_seguimiento', orden: 3, score: 50 }));
  const p5 = await enWs(() => plan.crearPlanTarea(borrador({ estado: 'en_seguimiento', motivoAtorada: 'falta plata' })));
  const p5b = await enWs(() => plan.crearPlanTarea(borrador({ estado: 'hecho' })));
  out.crearPlan = { atorada: resumenPlan(filaPlan(p5.id)), hecha: resumenPlan(filaPlan(p5b.id)) };

  // 6. GUARDAR NO MUEVE: una pestaña con la tarjeta VIEJA (en «Por iniciar», en el lugar 999)
  //    guarda un título; la columna y el lugar que puso `moverPlanTarea` se quedan. Y si el avance
  //    cambió, ahí sí: 100% la completa.
  reset();
  const p6 = await enWs(() => plan.crearPlanTarea(borrador({ title: 'a mover' })));
  const vieja = (await enWs(() => plan.listPlanBoard())).tareas.find((t) => t.id === p6.id)!;
  await enWs(() => plan.moverPlanTarea(p6.id, 'en_seguimiento', 42, { motivo: 'el cliente no contesta' }));
  await enWs(() => plan.guardarPlanTarea({ ...vieja, title: 'título corregido', estado: 'por_hacer', orden: 999, motivoAtorada: null }));
  const trasGuardar = resumenPlan(filaPlan(p6.id));
  const titulo = filaPlan(p6.id).title;
  await enWs(() => plan.guardarPlanTarea({ ...vieja, progress: 100 }));
  out.guardarPlan = { trasGuardar, titulo, trasCien: resumenPlan(filaPlan(p6.id)) };

  // 7. Mover en el dueño: misma regla que el cliente.
  reset();
  const p7 = await enWs(() => plan.crearPlanTarea(borrador({ progress: 100, estado: 'hecho' })));
  const reabierta = await enWs(() => plan.moverPlanTarea(p7.id, 'en_curso'));
  const recP = await enWs(() => plan.crearPlanTarea(borrador({ recurrente: true })));
  out.moverPlan = {
    reabierta: reabierta.ok ? resumenPlan(filaPlan(p7.id)) : reabierta,
    inventado: await enWs(() => plan.moverPlanTarea(p7.id, 'nada' as never)),
    recurrente: await enWs(() => plan.moverPlanTarea(recP.id, 'hecho')),
  };

  // 8. El reparto de las 9:10 NO toca las «Sin priorizar» ni lo que el criterio no dejó pasar.
  reset();
  for (let i = 0; i < 24; i++) {
    db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS, id: `r${i}`, num: i + 1, title: `t${i}`, progress: 0, score: 90 - i * 3, score_base: 90 - i * 3, score_manual: false, labels: [], historial: [], recurrente: false, deadline: '' }));
  }
  db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS, id: 'libre1', num: 30, title: 'libre', progress: 0, score: 0, score_base: 0, score_manual: false, labels: [], historial: [], recurrente: false, deadline: '' }));
  db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS, id: 'libre2', num: 31, title: 'libre 2', progress: 0, score: 0, score_manual: false, labels: [], historial: [], recurrente: false, deadline: '' }));
  db.plan_tareas.push(defaults('plan_tareas', { workspace_id: WS, id: 'nocumple', num: 32, title: 'descartada', progress: 0, score: 40, score_base: 40, estado: 'no_cumple', score_manual: false, labels: [], historial: [], recurrente: false, deadline: '' }));
  escrituras = [];
  const rv = await enWs(() => plan.recurvarPlanOwner());
  out.recurvar = {
    r: rv,
    libre1: filaPlan('libre1').score, libre2: filaPlan('libre2').score, nocumple: filaPlan('nocumple').score,
    movidas: rv.movidas,
  };

  // 9. EL TELÉFONO (tanda 2, 16/10/2026): `moverEnTablero` mueve por el camino de cada tablero,
  //    deja UNA entrada en el historial, y el Deshacer vuelve a la columna de antes SACANDO esa
  //    entrada (no sumando otra). Lo que no es una columna, no se escribe.
  reset();
  const mv = await import('../lib/plan-mover');
  const textos = (f: Fila) => ((f.historial ?? []) as Array<{ text: string }>).map((h) => h.text);
  const c9 = await enWs(() => todo.crearTarea({ titulo: 'del teléfono' }));
  const histAntesCli = textos(filaCli(c9.id)).length;
  const m9 = await enWs(() => mv.moverEnTablero('cliente', String(c9.id), 'en_curso'));
  const trasMoverCli = { ...resumenCli(filaCli(c9.id)), hist: textos(filaCli(c9.id)) };
  const d9 = m9.ok ? await enWs(() => mv.moverEnTablero('cliente', String(c9.id), m9.antes, { entryId: m9.entryId })) : m9;
  const trasDeshacerCli = { ...resumenCli(filaCli(c9.id)), hist: textos(filaCli(c9.id)) };
  const yaEstaba = await enWs(() => mv.moverEnTablero('cliente', String(c9.id), 'por_hacer'));
  const invalida = await enWs(() => mv.moverEnTablero('cliente', String(c9.id), 'Completada'));
  const p9 = await enWs(() => plan.crearPlanTarea(borrador({ title: 'del teléfono' })));
  const m9p = await enWs(() => mv.moverEnTablero('dueno', p9.id, 'hecho'));
  const trasMoverPlan = { ...resumenPlan(filaPlan(p9.id)), hist: textos(filaPlan(p9.id)) };
  const d9p = m9p.ok ? await enWs(() => mv.moverEnTablero('dueno', p9.id, m9p.antes, { entryId: m9p.entryId })) : m9p;
  out.telefono = {
    histAntesCli, m9, trasMoverCli, d9, trasDeshacerCli, yaEstaba, invalida,
    m9p, trasMoverPlan, d9p, trasDeshacerPlan: { ...resumenPlan(filaPlan(p9.id)), hist: textos(filaPlan(p9.id)) },
  };

  // 10. LA REVISIÓN ADVERSARIAL (16/10/2026): el Deshacer vuelve al avance (y al motivo) de antes, en
  //     UNA escritura; y una pestaña vieja del dueño no reabre lo que se completó en otro lado.
  reset();
  // a) Teléfono, cliente: «En proceso» al 40% → Completada → Deshacer (con lo que devolvió el mover).
  const c10 = await enWs(() => todo.crearTarea({ titulo: 'al 40', estado: 'en_curso' }));
  await enWs(() => todo.editarTarea(c10.id, { progreso: 40 }));
  const m10 = await enWs(() => mv.moverEnTablero('cliente', String(c10.id), 'hecho'));
  if (m10.ok) await enWs(() => mv.moverEnTablero('cliente', String(c10.id), m10.antes, { entryId: m10.entryId, progreso: m10.antesAvance, motivo: m10.antesMotivo }));
  const telCli = resumenCli(filaCli(c10.id));
  // …y una «Atorada» con su motivo vuelve con el motivo.
  const a10 = await enWs(() => todo.crearTarea({ titulo: 'atorada', estado: 'en_seguimiento', motivo_atorada: 'el cliente no contesta' } as never));
  const ma10 = await enWs(() => mv.moverEnTablero('cliente', String(a10.id), 'hecho'));
  if (ma10.ok) await enWs(() => mv.moverEnTablero('cliente', String(a10.id), ma10.antes, { entryId: ma10.entryId, progreso: ma10.antesAvance, motivo: ma10.antesMotivo }));
  const telAtorada = resumenCli(filaCli(a10.id));
  // Teléfono, dueño: lo mismo.
  const p10 = await enWs(() => plan.crearPlanTarea(borrador({ title: 'al 40', estado: 'en_curso', progress: 40 })));
  const mp10 = await enWs(() => mv.moverEnTablero('dueno', p10.id, 'hecho'));
  if (mp10.ok) await enWs(() => mv.moverEnTablero('dueno', p10.id, mp10.antes, { entryId: mp10.entryId, progreso: mp10.antesAvance, motivo: mp10.antesMotivo }));
  const telPlan = resumenPlan(filaPlan(p10.id));
  // b) Escritorio: «Por iniciar» al 40% (arrastrada a mano) → Completada → Deshacer, que manda el
  //    avance de antes EN el mover (`progreso`). Hasta el 16/10 volvía por un segundo guardado y la
  //    base la pasaba a «En proceso». Un 100% fuera de «Completada» no se acepta.
  const e10 = await enWs(() => todo.crearTarea({ titulo: 'por iniciar al 40' }));
  await enWs(() => todo.editarTarea(e10.id, { progreso: 40 }));
  await enWs(() => todo.moverTarea(e10.id, 'por_hacer'));
  const antesEsc = resumenCli(filaCli(e10.id));
  await enWs(() => todo.moverTarea(e10.id, 'hecho'));
  await enWs(() => todo.moverTarea(e10.id, 'por_hacer', undefined, { progreso: 40 }));
  const escCli = resumenCli(filaCli(e10.id));
  await enWs(() => todo.moverTarea(e10.id, 'en_curso', undefined, { progreso: 100 }));
  const cienFuera = resumenCli(filaCli(e10.id));
  const ep10 = await enWs(() => plan.crearPlanTarea(borrador({ title: 'por iniciar al 40', estado: 'por_hacer', progress: 40 })));
  await enWs(() => plan.moverPlanTarea(ep10.id, 'hecho'));
  await enWs(() => plan.moverPlanTarea(ep10.id, 'por_hacer', undefined, { progreso: 40 }));
  const escPlan = resumenPlan(filaPlan(ep10.id));
  // c) Pestaña VIEJA del dueño: la tarea al 40% se completa desde el teléfono; la pestaña —que la
  //    tiene al 40% y la base le confirmó 40— le corrige el título.
  const v10 = await enWs(() => plan.crearPlanTarea(borrador({ title: 'vieja', estado: 'en_curso', progress: 40 })));
  const pestana = (await enWs(() => plan.listPlanBoard())).tareas.find((t) => t.id === v10.id)!;
  await enWs(() => mv.moverEnTablero('dueno', v10.id, 'hecho'));
  await enWs(() => plan.guardarPlanTarea({ ...pestana, title: 'vieja (tilde corregida)' }, { progresoGuardado: 40 }));
  const viejaNoTocoAvance = { ...resumenPlan(filaPlan(v10.id)), title: filaPlan(v10.id).title };
  // …y si la pestaña SÍ movió el avance (40 → 60), manda la persona: la reabre.
  await enWs(() => plan.guardarPlanTarea({ ...pestana, progress: 60 }, { progresoGuardado: 40 }));
  const viejaMovioAvance = resumenPlan(filaPlan(v10.id));
  out.revision = { telCli, telAtorada, telPlan, antesEsc, escCli, cienFuera, escPlan, viejaNoTocoAvance, viejaMovioAvance };

  process.stdout.write('@@RESULTADO@@' + JSON.stringify(out));
}

main().catch((e) => { console.error(e); process.exit(1); });

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
