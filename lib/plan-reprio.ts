// =============================================================================
// plan-reprio — cambiar UNA prioridad a mano, con lo que eso arrastra
// =============================================================================
// El pedido del dueño, textual:
//
//   «Lo que nos quedó abierto es la funcionalidad de cambiar prioridad por el usuario. Que
//    eso también debería re-priorizar el resto. Y es por eso que el perro debe ser muy
//    estricto y debe tener la capacidad de rechazar una re-priorización si los argumentos no
//    son fuertes. Y claro que para eso tiene que hacer buenas preguntas.»
//
// Son tres cosas encadenadas, y el orden importa: la cascada hace CARO aceptar, aceptar caro
// obliga a poder RECHAZAR, y rechazar bien obliga a PREGUNTAR. Acá viven las tres, en cuatro
// pasos que se pueden mirar por separado:
//
//   1. `exigenciaDe` + `cumpleLaCarga`  → ¿el argumento tiene forma de argumento?  0 tokens
//   2. `dictarAudiencia`                → el juicio del Perro                      1 llamada
//   3. `fijarYDesempatar` + auditorías  → qué números quedan, si es que quedan     0 tokens
//   4. `aplicarReprio`                  → recién acá se escribe
//
// ⚠️ EL PASO 4 ES UNA LLAMADA APARTE, Y ESO ES EL DISEÑO. Aceptar mueve decenas de filas
// (medido en ws 9: 71 proyectos ocupando 100..30 sin un solo hueco, así que fijar uno arriba
// corre a todos los de abajo). Un cambio de ese tamaño se VE antes de apretar, no después:
// mostrar la consecuencia de lo irreversible después del click es lo mismo que no mostrarla.
//
// ⚠️ Y LA ESCRITURA SALIÓ DEL NAVEGADOR. Antes el modal llamaba a `patchLabelLog`, que hace
// upsert de la fila ENTERA desde el estado de la pestaña: una pestaña abierta hace media hora
// pisaba con datos viejos todo lo que hubiera cambiado mientras tanto. Con una cascada de 68
// filas eso deja de ser un riesgo teórico. Acá se escriben COLUMNAS PUNTUALES, por id.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { enPlan, listPlanBoard } from '@/lib/plan-board';
import { prioFromScore, type Label, type BoardTask, type Hist, type Actor } from '@/app/plan/board/types';
import { fijarYDesempatar, mismoOrdenRelativo, noPisaManuales, respetaElReclamo, sinEmpates, type Falla, type Puntuado } from '@/app/plan/board/metodologia';
import { exigenciaDe, cumpleLaCarga, preguntaPorFaltante, type Prueba, type Exigencia } from '@/lib/plan-prueba';
import { dictarAudiencia, type Antecedente } from '@/lib/mako-guardian';
import type { UsageInfo } from '@/lib/anthropic-usage';

const genId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export type Pedido = {
  entidad: 'proyecto' | 'tarea';
  itemId: string;
  scorePedido: number;
  motivo: string;
  /** lo que el dueño ELIGIÓ de una lista. El id crudo: la etiqueta la pone la base. */
  pruebas: Array<{ clase: Prueba['clase']; ref: string }>;
  respuestas: Array<{ pregunta: string; respuesta: string }>;
};

export type Movimiento = { id: string; nombre: string; antes: number; despues: number; manualAntes: boolean };

export type Propuesta = {
  /** 'falta-prueba' no llegó a gastar un token: la carga no estaba cumplida */
  estado: 'falta-prueba' | 'rechazado' | 'propuesto' | 'error';
  reprioId?: string;
  veredicto?: 'acepta' | 'ajusta' | 'rechaza';
  scoreActual: number;
  scoreFinal?: number;
  razon?: string;
  respuesta?: string;
  repregunta?: string;
  /** las preguntas que salen del CÓDIGO cuando falta una prueba */
  preguntas?: Array<{ pregunta: string; tipo: string; opciones: string[]; sobre: string[] }>;
  exigencia?: Exigencia;
  falta?: string;
  /** la cascada, para mirarla ANTES de aplicarla */
  cascada?: Movimiento[];
  fallas?: string;
  error?: string;
  usage?: UsageInfo;
};

// ── resolver las pruebas contra la base ──────────────────────────────────────────────
/**
 * Convierte lo que el dueño eligió en un hecho verificado, o lo marca como que no lo es.
 *
 * La etiqueta SIEMPRE sale de la base, nunca de lo que viajó en el request. Es la regla de
 * que un dato exacto que pasa por las manos de un LLM deja de ser exacto, aplicada un paso
 * antes: si la etiqueta la escribiera el navegador, el modelo estaría juzgando contra un
 * nombre que el dueño podría haber tipeado él mismo — y entonces la prueba no prueba nada.
 */
async function resolverPruebas(crudas: Pedido['pruebas'], proyectos: Label[], tareas: BoardTask[]): Promise<Prueba[]> {
  const db = await getTenantDb();
  const out: Prueba[] = [];
  const leadIds = crudas.filter((p) => p.clase === 'cliente').map((p) => p.ref);
  let leads: Array<{ id: string; nombre: string; pipeline_stage: string | null }> = [];
  if (leadIds.length) {
    const { data } = await db.from('leads').select('id, nombre, pipeline_stage').in('id', leadIds);
    leads = (data ?? []) as typeof leads;
  }
  for (const c of crudas) {
    const base: Prueba = { clase: c.clase, ref: String(c.ref ?? '').slice(0, 200), etiqueta: '', estado: 'no-existe' };
    if (c.clase === 'proyecto') {
      const p = proyectos.find((x) => x.id === c.ref);
      out.push(p ? { ...base, etiqueta: p.name, nota: `hoy en ${p.score}/100`, estado: 'ok' } : { ...base, etiqueta: `proyecto ${c.ref}` });
    } else if (c.clase === 'tarea') {
      const t = tareas.find((x) => x.id === c.ref);
      out.push(t ? { ...base, etiqueta: t.title, nota: `hoy en ${t.score}/100`, estado: 'ok' } : { ...base, etiqueta: `tarea ${c.ref}` });
    } else if (c.clase === 'cliente') {
      const l = leads.find((x) => String(x.id) === String(c.ref));
      out.push(l ? { ...base, etiqueta: l.nombre, nota: l.pipeline_stage ? `etapa: ${l.pipeline_stage}` : undefined, estado: 'ok' } : { ...base, etiqueta: `lead ${c.ref}` });
    } else if (c.clase === 'fecha') {
      const t = Date.parse(String(c.ref));
      // Una fecha que ya pasó no es un compromiso: es un dato viejo que el modelo leería
      // como urgencia. Se acepta, pero llega diciendo lo que es.
      out.push(Number.isNaN(t)
        ? { ...base, etiqueta: String(c.ref), estado: 'formato' }
        : { ...base, etiqueta: new Date(t).toISOString().slice(0, 10), nota: t < Date.now() ? 'YA PASÓ' : `faltan ${Math.round((t - Date.now()) / 86400000)} días`, estado: 'ok' });
    } else if (c.clase === 'plata') {
      const n = Number(String(c.ref).replace(/[^\d.-]/g, ''));
      out.push(Number.isFinite(n) && n > 0 ? { ...base, etiqueta: `US$ ${n.toLocaleString('es-AR')}`, estado: 'ok' } : { ...base, etiqueta: String(c.ref), estado: 'formato' });
    } else {
      const n = Math.round(Number(c.ref));
      out.push(n >= 1 && n <= 5 ? { ...base, etiqueta: `escalón ${n}`, estado: 'ok' } : { ...base, etiqueta: String(c.ref), estado: 'formato' });
    }
  }
  return out;
}


/**
 * Los clientes que se pueden nombrar como prueba.
 *
 * Se ELIGEN de una lista, no se escriben. Un nombre tipeado a mano no prueba nada: el que
 * argumenta puede poner cualquier cosa, y el modelo la leería como un hecho verificado. Con
 * un id, la etiqueta sale de la tabla y «no existe» es una respuesta posible.
 */
export async function clientesParaPrueba(): Promise<Array<{ id: string; nombre: string; etapa: string }>> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data } = await db.from('leads').select('id, nombre, pipeline_stage').order('updated_at', { ascending: false }).limit(40);
    return (data ?? []).map((r: Record<string, unknown>) => ({ id: String(r.id), nombre: String(r.nombre ?? '(sin nombre)'), etapa: String(r.pipeline_stage ?? '') }));
  });
}

// ── paso 1-3: proponer (NO escribe scores) ───────────────────────────────────────────

export async function proponerReprio(pedido: Pedido): Promise<Propuesta> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { proyectos, tareas } = await listPlanBoard();
    const esProy = pedido.entidad === 'proyecto';
    const item = esProy ? proyectos.find((p) => p.id === pedido.itemId) : tareas.find((t) => t.id === pedido.itemId);
    if (!item) return { estado: 'error', scoreActual: 0, error: 'No encontré eso en el tablero.' };

    const scoreActual = item.score || 0;
    const scorePedido = Math.max(1, Math.min(100, Math.round(pedido.scorePedido)));
    // El universo es del MISMO NIVEL. Mezclar proyectos con tareas es justo lo que hacía
    // pasar la razón que originó todo el problema: «vale lo que su mejor tarea» citaba una
    // tarea REAL, así que la validación la daba por buena.
    const universo: Puntuado[] = esProy
      ? proyectos.filter((p) => p.id !== item.id).map((p) => ({ id: p.id, titulo: p.name, score: p.score || 0 }))
      : tareas.filter((t) => t.id !== item.id && t.progress < 100).map((t) => ({ id: t.id, titulo: t.title, score: t.score || 0 }));
    const nombre = esProy ? (item as Label).name : (item as BoardTask).title;
    const topes = universo.slice().sort((a, b) => b.score - a.score);
    const esNorteHoy = topes.length > 0 && scoreActual > topes[0].score;

    // ── PASO 1: la carga de la prueba. Determinista, 0 tokens, y es el camino más frecuente.
    const exigencia = exigenciaDe(pedido.entidad, scoreActual, scorePedido, esNorteHoy);
    const pruebas = await resolverPruebas(pedido.pruebas ?? [], proyectos, tareas);
    const carga = cumpleLaCarga(exigencia, pruebas);
    if (!carga.ok) {
      const preguntas = carga.faltan
        .map((g) => preguntaPorFaltante(g, { norteActual: topes[0]?.titulo, segundo: topes[1]?.titulo, enDebate: nombre }))
        .filter(Boolean) as NonNullable<Propuesta['preguntas']>;
      return { estado: 'falta-prueba', scoreActual, exigencia, falta: carga.detalle, preguntas };
    }

    // ── PASO 2: el juicio. Con los rechazos anteriores adentro del prompt.
    const { data: previas } = await db.from('plan_reprios')
      .select('created_at, score_pedido, razon, respuesta')
      .eq('item_id', pedido.itemId).eq('estado', 'rechazado')
      .order('created_at', { ascending: false }).limit(3);
    const antecedentes: Antecedente[] = (previas ?? []).map((r: Record<string, unknown>) => ({
      cuando: String(r.created_at ?? '').slice(0, 10),
      scorePedido: Number(r.score_pedido) || 0,
      razon: String(r.razon || r.respuesta || '').slice(0, 200),
    }));

    const detalle = esProy ? (item as Label).detalle : (item as BoardTask).detalle;
    const ver = await dictarAudiencia({
      entidad: pedido.entidad,
      item: `${nombre}${detalle ? `\n\n${String(detalle).slice(0, 1200)}` : ''}`,
      scoreActual, scorePedido,
      motivo: String(pedido.motivo ?? '').slice(0, 1500),
      pruebas,
      respuestas: (pedido.respuestas ?? []).slice(0, 6),
      antecedentes,
      universo: universo.map((p) => ({ titulo: p.titulo, score: p.score })),
      usoMotivo: `Audiencia de prioridad · ${nombre.slice(0, 60)}`,
    });

    const fila = {
      tablero: 'plan', entidad: pedido.entidad, item_id: pedido.itemId, item_nombre: nombre,
      score_antes: scoreActual, score_pedido: scorePedido, motivo: String(pedido.motivo ?? '').slice(0, 2000),
      pruebas, preguntas: pedido.respuestas ?? [],
      veredicto: ver.veredicto, score_final: ver.score, razon: ver.razon, respuesta: ver.respuesta,
      fallas: ver.fallas ?? '',
    };

    // ── EL RECHAZO. No escribe el score. Ni `score_manual`, ni `score_razon`. Solo la fila
    // de la audiencia y una entrada de historial, para que exista mañana.
    if (ver.veredicto === 'rechaza') {
      // Un error de parseo NO es un rechazo: el Perro no juzgó nada. Se dice que falló.
      if (ver.fallas?.startsWith('ERROR')) {
        return { estado: 'error', scoreActual, error: 'MaKo no pudo responder ahora. Prueba de nuevo.', usage: ver.usage };
      }
      const { data } = await db.from('plan_reprios').insert({ ...fila, estado: 'rechazado' }).select('id').single();
      await escribirHistorial(pedido.entidad, pedido.itemId, `El Perro rechazó moverlo a ${scorePedido} — queda en ${scoreActual}${ver.razon ? ` · ${ver.razon.slice(0, 200)}` : ''}`, 'ia');
      return { estado: 'rechazado', reprioId: data?.id, veredicto: 'rechaza', scoreActual, scoreFinal: scoreActual, razon: ver.razon, respuesta: ver.respuesta, repregunta: ver.repregunta, fallas: ver.fallas, usage: ver.usage };
    }

    // ── PASO 3: LA CASCADA. Aritmética, sin modelo. Arregla la ESCALA, no vuelve a juzgar.
    const todos: Puntuado[] = [...universo, { id: item.id, titulo: nombre, score: scoreActual }];
    const manuales = esProy
      ? proyectos.filter((p) => p.scoreManual).map((p) => p.id)
      : tareas.filter((t) => t.scoreManual).map((t) => t.id);
    const despues = fijarYDesempatar(todos, { [item.id]: ver.score, ...Object.fromEntries(manuales.filter((id) => id !== item.id).map((id) => [id, todos.find((x) => x.id === id)?.score ?? 50])) });

    const duras = [
      respetaElReclamo({ id: item.id, scorePedido, scoreActual }, despues),
      sinEmpates(todos.map((p) => ({ ...p, score: despues[p.id] ?? p.score }))),
      mismoOrdenRelativo(todos, despues, item.id),
      noPisaManuales(todos, despues, manuales, item.id),
    ].filter(Boolean) as Falla[];
    if (duras.length) {
      const txt = duras.map((f) => `${f.regla} — ${f.detalle}`).join(' · ');
      await db.from('plan_reprios').insert({ ...fila, estado: 'error', fallas: txt });
      console.error(`[plan-reprio] cascada rechazada por auditoría: ${txt}`);
      return { estado: 'error', scoreActual, error: 'La re-priorización no cumple las reglas del tablero, así que no la escribí.', fallas: txt, usage: ver.usage };
    }

    const nombreDe = (id: string) => todos.find((x) => x.id === id)?.titulo ?? id;
    const manualSet = new Set(manuales);
    const cascada: Movimiento[] = todos
      .filter((p) => (despues[p.id] ?? p.score) !== p.score)
      .map((p) => ({ id: p.id, nombre: nombreDe(p.id), antes: p.score, despues: despues[p.id], manualAntes: manualSet.has(p.id) }))
      .sort((a, b) => b.despues - a.despues);

    const { data } = await db.from('plan_reprios').insert({
      ...fila, estado: 'propuesto', movidos: cascada.length,
      ripple: Object.fromEntries(cascada.map((m) => [m.id, { nombre: m.nombre, antes: m.antes, despues: m.despues, manualAntes: m.manualAntes }])),
    }).select('id').single();

    return { estado: 'propuesto', reprioId: data?.id, veredicto: ver.veredicto, scoreActual, scoreFinal: ver.score, razon: ver.razon, respuesta: ver.respuesta, cascada, fallas: ver.fallas, usage: ver.usage };
  });
}

// ── paso 4: aplicar ──────────────────────────────────────────────────────────────────

export async function aplicarReprio(reprioId: string): Promise<{ movidos: number; error?: string }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    // Idempotente en la punta que importa: dos pestañas o un doble click no aplican dos
    // veces. Es el mismo `.eq('estado', …)` con el que el repo aplica propuestas.
    const { data: fila } = await db.from('plan_reprios')
      .update({ estado: 'aplicado', aplicado_at: new Date().toISOString() })
      .eq('id', reprioId).eq('estado', 'propuesto')
      .select('*').maybeSingle();
    if (!fila) return { movidos: 0, error: 'Esa re-priorización ya se aplicó o no existe.' };

    const tabla = fila.entidad === 'proyecto' ? 'plan_proyectos' : 'plan_tareas';
    const ripple = (fila.ripple ?? {}) as Record<string, { nombre: string; antes: number; despues: number }>;
    const ids = Object.keys(ripple);
    const ahora = new Date().toISOString();
    const TANDA = 20;
    for (let i = 0; i < ids.length; i += TANDA) {
      await Promise.all(ids.slice(i, i + TANDA).map((id) => {
        const esElDebatido = id === fila.item_id;
        // `score_manual` SOLO al que se discutió y GANÓ. Los que se corrieron por aritmética
        // no ganaron nada: marcarlos congelaría el tablero entero contra la corrida diaria.
        const patch: Record<string, unknown> = { score: ripple[id].despues, updated_at: ahora };
        if (esElDebatido) { patch.score_manual = true; patch.score_razon = fila.razon || null; }
        // El scoreBase es EL JUICIO, separado del número que se muestra (mig 0141). Si no se
        // mueve, la próxima recurva reconstruye el score desde el juicio viejo y deshace esto.
        if (esElDebatido && fila.entidad === 'tarea') patch.score_base = ripple[id].despues;
        return db.from(tabla).update(patch).eq('id', id).then(() => undefined);
      }));
    }
    const mov = ids.length - 1;
    await escribirHistorial(fila.entidad, fila.item_id, `Le ganaste el debate al Perro — ${fila.score_antes} → ${fila.score_final}${mov > 0 ? ` · se corrieron ${mov} más` : ''}${fila.razon ? ` · ${String(fila.razon).slice(0, 180)}` : ''}`, 'user');
    console.log(`[plan-reprio] aplicado ${reprioId}: «${fila.item_nombre}» ${fila.score_antes} → ${fila.score_final}, ${ids.length} filas`);
    return { movidos: ids.length };
  });
}

// ── la prioridad A MANO: la decide la persona, sin debate y sin peaje ────────────────

/**
 * Fija el score de un proyecto o de una tarea porque LO DECIDIÓ LA PERSONA, y corre a los
 * de abajo para hacerle lugar. Es el paso 3 + 4 de la audiencia sin el paso 2: no hay
 * juicio del Perro porque no hay nada que juzgar.
 *
 * ⚠️ POR QUÉ EXISTE. La audiencia era el ÚNICO camino al score, y el 22/09 eso trabó una
 * sesión entera: «ni siquiera me da la opción de cambiarlo… no hay maleabilidad, me obliga
 * a hacer algo que encima ni siquiera está bien». La regla que quedó en AGENTS.md es que la
 * IA propone la prioridad y la persona la cambia — así que el debate pasa a ser una OPCIÓN
 * (para cuando querés que te discutan el número), nunca el peaje para mover una tarjeta.
 *
 * Lo que NO cambia, y es lo que hace que esto no sea un agujero:
 *  - La cascada y sus auditorías son las mismas. Mover uno corre a los de abajo; lo que no
 *    puede pasar es que dos que nadie tocó se crucen entre sí.
 *  - Escribe el SERVER, columna por columna y por id. El navegador sigue sin tener ningún
 *    camino a `score`, que es lo que lo hace imposible de olvidar (ver la cabecera).
 *  - Queda una fila en `plan_reprios` con la cascada adentro, así que `deshacerReprio` la
 *    revierte igual que a un debate ganado.
 *
 * `score_manual` SÍ se marca acá, y es lo correcto: esa columna significa «esto lo decidió
 * la persona» (mig 0143). Lo que no puede marcarla es una corrida automática.
 */
export async function fijarPrioridadAMano(p: { entidad: 'proyecto' | 'tarea'; itemId: string; score: number }): Promise<
  { ok: true; score: number; antes: number; movidos: Movimiento[]; reprioId?: string } | { ok: false; error: string }
> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { proyectos, tareas } = await listPlanBoard();
    const esProy = p.entidad === 'proyecto';
    const item = esProy ? proyectos.find((x) => x.id === p.itemId) : tareas.find((x) => x.id === p.itemId);
    if (!item) return { ok: false as const, error: 'No encontré eso en el tablero.' };

    const nombre = esProy ? (item as Label).name : (item as BoardTask).title;
    const scoreActual = item.score || 0;
    const pedido = Math.max(1, Math.min(100, Math.round(p.score)));

    // Pedir el número que ya tiene, cuando además ya estaba fijado a mano, no es un cambio:
    // es un click de más. Sin esta salida queda una entrada de historial por cada vez que
    // alguien toca el slider y lo devuelve a su lugar.
    if (pedido === scoreActual && item.scoreManual) {
      return { ok: true as const, score: scoreActual, antes: scoreActual, movidos: [] };
    }

    // ⚠️ UNA TAREA NO ARRASTRA A NADIE, Y NO ES UN ATAJO: ES LA DIFERENCIA ENTRE LOS DOS
    // NIVELES. La cascada existe porque los 70 proyectos ocupan 100..2 SIN UN SOLO HUECO y
    // sin empates —hay un norte, y fijar uno arriba corre a los de abajo—. Las tareas no
    // funcionan así: medido el 23/09/2026, 241 abiertas ocupan 85 números distintos, o sea
    // 156 empatadas. Meterlas por el mismo camino tenía dos consecuencias, las dos malas:
    // `fijarYDesempatar` les reasigna un número único a las 241 (reescribe el tablero
    // entero para mover una tarjeta), y `sinEmpates` falla SIEMPRE —no entran 241 en 100—,
    // así que la respuesta habría sido «no cumple las reglas del tablero» cada vez. O sea:
    // exactamente la fricción que esto vino a sacar, con un mensaje que culpa al tablero.
    if (!esProy) {
      const final = pedido;
      const ahora = new Date().toISOString();
      const { data: fila } = await db.from('plan_reprios').insert({
        tablero: 'plan', entidad: 'tarea', item_id: item.id, item_nombre: nombre,
        score_antes: scoreActual, score_pedido: pedido, motivo: '', pruebas: [], preguntas: [],
        score_final: final, razon: 'Prioridad fijada a mano', respuesta: '', fallas: '',
        estado: 'aplicado', aplicado_at: ahora, movidos: 1,
        ripple: { [item.id]: { nombre, antes: scoreActual, despues: final, manualAntes: !!item.scoreManual } },
      }).select('id').single();
      await db.from('plan_tareas').update({
        score: final, score_base: final, score_manual: true, score_razon: 'Prioridad fijada a mano',
        priority: prioFromScore(final), // la columna se DERIVA del score, y el umbral vive en types.ts
        updated_at: ahora,
      }).eq('id', item.id);
      await escribirHistorial('tarea', item.id, final === scoreActual
        ? `Fijaste la prioridad en ${final}: MaKo ya no la mueve sola`
        : `Fijaste la prioridad en ${final} a mano — antes ${scoreActual}`, 'user');
      return { ok: true as const, score: final, antes: scoreActual, movidos: [], reprioId: fila?.id };
    }

    // El universo es del MISMO NIVEL, igual que en la audiencia: un proyecto se compara con
    // proyectos y una tarea con tareas abiertas.
    const universo: Puntuado[] = esProy
      ? proyectos.filter((x) => x.id !== item.id).map((x) => ({ id: x.id, titulo: x.name, score: x.score || 0 }))
      : tareas.filter((x) => x.id !== item.id && x.progress < 100).map((x) => ({ id: x.id, titulo: x.title, score: x.score || 0 }));
    const todos: Puntuado[] = [...universo, { id: item.id, titulo: nombre, score: scoreActual }];
    const manuales = (esProy ? proyectos.filter((x) => x.scoreManual) : tareas.filter((x) => x.scoreManual))
      .map((x) => x.id).filter((id) => id !== item.id);
    const despues = fijarYDesempatar(todos, {
      [item.id]: pedido,
      ...Object.fromEntries(manuales.map((id) => [id, todos.find((x) => x.id === id)?.score ?? 50])),
    });

    const duras = [
      respetaElReclamo({ id: item.id, scorePedido: pedido, scoreActual }, despues),
      sinEmpates(todos.map((x) => ({ ...x, score: despues[x.id] ?? x.score }))),
      mismoOrdenRelativo(todos, despues, item.id),
      noPisaManuales(todos, despues, manuales, item.id),
    ].filter(Boolean) as Falla[];
    if (duras.length) {
      const txt = duras.map((f) => `${f.regla} — ${f.detalle}`).join(' · ');
      console.error(`[plan-reprio] prioridad a mano rechazada por auditoría: ${txt}`);
      return { ok: false as const, error: 'Ese número deja el tablero inconsistente, así que no escribí nada.' };
    }

    const manualSet = new Set(manuales);
    const nombreDe = (id: string) => todos.find((x) => x.id === id)?.titulo ?? id;
    const cascada: Movimiento[] = todos
      .filter((x) => (despues[x.id] ?? x.score) !== x.score)
      .map((x) => ({ id: x.id, nombre: nombreDe(x.id), antes: x.score, despues: despues[x.id], manualAntes: manualSet.has(x.id) }))
      .sort((a, b) => b.despues - a.despues);
    // El ítem entra SIEMPRE, aunque su número no se mueva: lo que cambia igual es el candado
    // y la razón, y sin él adentro del ripple el deshacer no lo puede reponer.
    if (!cascada.some((m) => m.id === item.id)) {
      cascada.unshift({ id: item.id, nombre, antes: scoreActual, despues: despues[item.id] ?? scoreActual, manualAntes: !!item.scoreManual });
    }

    const razon = 'Prioridad fijada a mano';
    const ahora = new Date().toISOString();
    const { data: fila } = await db.from('plan_reprios').insert({
      tablero: 'plan', entidad: p.entidad, item_id: item.id, item_nombre: nombre,
      score_antes: scoreActual, score_pedido: pedido, motivo: '', pruebas: [], preguntas: [],
      // Sin veredicto a propósito: no hubo juicio. Los tres valores del enum son del Perro.
      score_final: despues[item.id], razon, respuesta: '', fallas: '',
      estado: 'aplicado', aplicado_at: ahora, movidos: cascada.length,
      ripple: Object.fromEntries(cascada.map((m) => [m.id, { nombre: m.nombre, antes: m.antes, despues: m.despues, manualAntes: m.manualAntes }])),
    }).select('id').single();

    const tabla = esProy ? 'plan_proyectos' : 'plan_tareas';
    const TANDA = 20;
    for (let i = 0; i < cascada.length; i += TANDA) {
      await Promise.all(cascada.slice(i, i + TANDA).map((m) => {
        const patch: Record<string, unknown> = { score: m.despues, updated_at: ahora };
        // El candado y la razón SOLO al que se tocó. Los que se corrieron por aritmética no
        // decidió nadie: marcarlos congelaría el tablero entero contra la corrida diaria.
        if (m.id === item.id) {
          patch.score_manual = true;
          patch.score_razon = razon;
          // El scoreBase es EL JUICIO, separado del número que se muestra (mig 0141). Sin
          // moverlo, la próxima recurva reconstruye el score desde el juicio viejo.
          if (!esProy) patch.score_base = m.despues;
        }
        return db.from(tabla).update(patch).eq('id', m.id).then(() => undefined);
      }));
    }

    const otros = cascada.length - 1;
    const final = despues[item.id];
    // Fijar el número que ya tenía es una decisión igual: lo que cambia es que MaKo deja
    // de moverlo. El historial lo dice con todas las letras en vez de «de 6 a 6».
    const texto = final === scoreActual
      ? `Fijaste la prioridad en ${final}: MaKo ya no la mueve sola`
      : `Fijaste la prioridad en ${final} a mano — antes ${scoreActual}${otros > 0 ? ` · se corrieron ${otros} más` : ''}`;
    await escribirHistorial(p.entidad, item.id, texto, 'user');
    console.log(`[plan-reprio] a mano: «${nombre}» ${scoreActual} → ${despues[item.id]}, ${cascada.length} filas`);
    return { ok: true as const, score: despues[item.id], antes: scoreActual, movidos: cascada.filter((m) => m.id !== item.id), reprioId: fila?.id };
  });
}

/**
 * Le devuelve la decisión a MaKo: saca el candado de la mig 0143 y la razón vieja, así la
 * próxima corrida vuelve a puntuarlo.
 *
 * Existe porque un candado sin llave es lo que originó todo esto. Si fijar a mano congelara
 * para siempre, «cambiar la prioridad» sería una decisión irreversible tomada con un slider.
 */
export async function devolverPrioridadAlPerro(entidad: 'proyecto' | 'tarea', itemId: string): Promise<{ ok: boolean; error?: string }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const tabla = entidad === 'proyecto' ? 'plan_proyectos' : 'plan_tareas';
    const { error } = await db.from(tabla)
      .update({ score_manual: false, score_razon: null, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) return { ok: false, error: error.message };
    await escribirHistorial(entidad, itemId, 'Le devolviste la prioridad a MaKo: la vuelve a decidir en la próxima corrida', 'user');
    return { ok: true };
  });
}

// ── deshacer ─────────────────────────────────────────────────────────────────────────

/**
 * Repone SOLO las filas que siguen exactamente donde las dejamos.
 *
 * Un undo ciego es peor que no tener undo, y acá no es teórico: el cron de las 09:10 corre
 * todos los días y `priorizarProyectosOwner` se dispara sola cada vez que entran tareas
 * nuevas al plan. Cualquiera de las dos deja el snapshot viejo. Lo que se movió después se
 * deja donde está y se dice cuál, con nombre.
 */
export async function deshacerReprio(reprioId: string): Promise<{ repuestos: number; conflictos: Array<{ nombre: string; ahora: number; esperaba: number }>; error?: string }> {
  return enPlan(async () => {
    const db = await getTenantDb();
    const { data: fila } = await db.from('plan_reprios')
      .update({ estado: 'deshecho', deshecho_at: new Date().toISOString() })
      .eq('id', reprioId).eq('estado', 'aplicado')
      .select('*').maybeSingle();
    if (!fila) return { repuestos: 0, conflictos: [], error: 'Eso no se puede deshacer: o ya se deshizo, o nunca se aplicó.' };

    const tabla = fila.entidad === 'proyecto' ? 'plan_proyectos' : 'plan_tareas';
    const ripple = (fila.ripple ?? {}) as Record<string, { nombre: string; antes: number; despues: number; manualAntes: boolean }>;
    const ids = Object.keys(ripple);
    const { data: vivos } = await db.from(tabla).select('id, score').in('id', ids);
    const ahoraPor = new Map((vivos ?? []).map((r: Record<string, unknown>) => [String(r.id), Number(r.score)]));

    const conflictos: Array<{ nombre: string; ahora: number; esperaba: number }> = [];
    const reponer = ids.filter((id) => {
      const ahora = ahoraPor.get(id);
      if (ahora === ripple[id].despues) return true;
      if (ahora != null) conflictos.push({ nombre: ripple[id].nombre, ahora, esperaba: ripple[id].despues });
      return false;
    });

    const ts = new Date().toISOString();
    const TANDA = 20;
    for (let i = 0; i < reponer.length; i += TANDA) {
      await Promise.all(reponer.slice(i, i + TANDA).map((id) => {
        const patch: Record<string, unknown> = { score: ripple[id].antes, updated_at: ts };
        // Sin esto el undo deja el candado de la mig 0143 puesto sobre un número que ya no es
        // el que se decidió, y la corrida de mañana no lo puede tocar nunca más.
        if (id === fila.item_id) { patch.score_manual = !!ripple[id].manualAntes; patch.score_razon = null; }
        if (id === fila.item_id && fila.entidad === 'tarea') patch.score_base = ripple[id].antes;
        return db.from(tabla).update(patch).eq('id', id).then(() => undefined);
      }));
    }
    await escribirHistorial(fila.entidad, fila.item_id, `Deshiciste la re-priorización — vuelve a ${fila.score_antes}${reponer.length > 1 ? ` y ${reponer.length - 1} más volvieron a su número` : ''}${conflictos.length ? ` · ${conflictos.length} se movieron después y los dejé como están` : ''}`, 'user');
    return { repuestos: reponer.length, conflictos };
  });
}

// ── historial, en la tabla que corresponda ───────────────────────────────────────────
async function escribirHistorial(entidad: 'proyecto' | 'tarea', id: string, texto: string, actor: Actor): Promise<void> {
  const db = await getTenantDb();
  const tabla = entidad === 'proyecto' ? 'plan_proyectos' : 'plan_tareas';
  const { data } = await db.from(tabla).select('historial').eq('id', id).maybeSingle();
  const previo = Array.isArray(data?.historial) ? (data.historial as Hist[]) : [];
  const hist = [{ id: genId('h'), ts: Date.now(), actor, text: texto }, ...previo].slice(0, 40);
  await db.from(tabla).update({ historial: hist }).eq('id', id);
}
