import 'server-only';

// =============================================================================
// plan-repriorizar — «Re-priorizar todo»: el trabajo en segundo plano (base, red y `after()`)
// =============================================================================
// 16/10/2026, decisión 9 de «hacer el kanban un kanban». El pedido, textual (Martín): «un botón en
// los 3 puntos de arriba del plan para "re-priorizar" todo, y eso puede correr en segundo plano y
// no impedir que el usuario siga utilizando todo».
//
// CÓMO CORRE. El botón (o `repriorizar_plan` de la API de MaKo) llama a `iniciarRepriorizacion`, que
// saca la FOTO de las tareas y deja una fila en `plan_repriorizaciones` (mig 0301). Desde ahí la
// procesan, de a una tanda de 20, DOS drenajes que comparten la fila:
//   · el SONDEO del tablero abierto: cada 4 s pregunta el avance y, si nadie la tiene tomada, empuja
//     la tanda siguiente en `after()` (rápido mientras alguien mira);
//   · el CRON /api/cron/plan-repriorizar, cada minuto, para que el trabajo termine aunque se cierre
//     la pestaña.
// Nunca procesan la misma tanda a la vez: tomar una tanda es un compare-and-set sobre `vuelta`, y
// quien la toma la tiene hasta `tomada_hasta` (el patrón de la 0186 y del candado de lectura de
// reuniones, lib/reunion-leyendo.ts).
//
// QUÉ LE HACE A CADA TAREA (la regla pura está en lib/plan-repriorizar-nucleo.ts):
//   · le pide el número al Perro de SIEMPRE (`puntuarNuevas`, la red gratis: el Plan nunca paga IA,
//     lib/veto-claude.ts → FEATURES_DEL_PLAN), contra la vara del resto del tablero;
//   · respeta lo FIJADO A MANO (`score_manual`): ni el número ni la razón;
//   · si está en la bandeja «Sin proyecto», le busca proyecto entre los que YA existen (el ruteo
//     del Perro, lista cerrada; un nombre inventado no abre nada);
//   · deja una entrada de historial con actor MaKo (`ia`), con un id que no se duplica si la tanda
//     se repite;
//   · y en el dueño, al final, el reparto (`recurvarPlanOwner`) y el juicio de los proyectos.
// NO toca deadlines: re-priorizar no es fechar, y una fecha que alguien sacó a propósito no se
// distingue de un hueco (AGENTS.md → «Un tablero auditado contra SÍ MISMO»). Ni el detalle.
//
// ⚠️ `after()` NO SACA EL TRABAJO DEL TECHO: vive dentro de la función que contestó, con su
// `maxDuration`. Por eso cada drenaje recibe `hasta` (su reloj) y no arranca una tanda que no entra.
// Y el workspace no viaja solo: se captura en la ruta y se re-envuelve (docs/hallazgos-infra.md).
// =============================================================================

import { after } from 'next/server';
import { getTenantDb, runWithWorkspace, wsEnContexto, getWorkspaceActual } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { puntuarNuevas, asignarTareasAProyectos, type GuardTaskIn, type GuardScore } from '@/lib/mako-guardian';
import { recurvarPlanOwner, priorizarProyectosOwner } from '@/lib/plan-board';
import { listCategorias, crearCategoria, editarTarea } from '@/lib/todo';
import { rutearTareasCliente } from '@/lib/todo-rutear';
import { delCatalogoTodo } from '@/lib/todo-proyectos-catalogo';
import { delCatalogo, nucleo } from '@/lib/plan-proyectos-catalogo';
import { esProyectoBandeja } from '@/lib/plan-bandeja';
import { faseNegocioTexto } from '@/lib/fase-store';
import { objetivosContextoTexto } from '@/lib/objectives';
import { esEstado, estaPendiente, estadoDeAvance } from '@/lib/todo-estados';
import { prioFromScore, sanearHist, type GuardPatch, type Hist } from '@/app/plan/board/types';
import {
  TANDA, CANDADO_MS, PAUSA_ENTRE_TANDAS_MS,
  idsDelTrabajo, fijadasFuera, planDeTanda, vara, idEntradaRP, textoEntradaRP, conEntrada, trasFalla,
  alcanzaElReloj, estaLibre, esDelPlanCliente, enBandeja, conHora, MAX_INTENTOS,
  type TableroRP, type EstadoRP, type FaseRP, type CambioRP, type Repriorizacion, type TareaRP,
} from './plan-repriorizar-nucleo';

export type { Repriorizacion, TableroRP, CambioRP } from './plan-repriorizar-nucleo';

const TABLA = 'plan_repriorizaciones';
type Row = Record<string, unknown>;
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const int = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
const norm = (s: string): string => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── La fila ──────────────────────────────────────────────────────────────────

function aRepriorizacion(r: Row, desde = 0): Repriorizacion {
  const cambios = Array.isArray(r.cambios) ? (r.cambios as CambioRP[]) : [];
  const d = Math.max(0, Math.min(cambios.length, Math.floor(desde) || 0));
  return {
    id: int(r.id),
    tablero: r.tablero === 'dueno' ? 'dueno' : 'cliente',
    estado: (['corriendo', 'hecho', 'error'].includes(str(r.estado)) ? r.estado : 'error') as EstadoRP,
    fase: (r.fase === 'cierre' ? 'cierre' : 'tareas') as FaseRP,
    total: int(r.total), hechas: int(r.hechas), puntuadas: int(r.puntuadas), ruteadas: int(r.ruteadas),
    fijadas: int(r.fijadas), sinPuntuar: int(r.sin_puntuar),
    error: str(r.error) || null, modelo: str(r.modelo) || null, actor: str(r.actor),
    creada: str(r.created_at), terminada: str(r.terminado_at) || null,
    libre: estaLibre(str(r.tomada_hasta) || null),
    cambios: cambios.slice(d), nCambios: cambios.length,
  };
}

async function leerFila(id: number): Promise<Row | null> {
  const { data, error } = await (await getTenantDb()).from(TABLA).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`plan-repriorizar: no pude leer el trabajo ${id}: ${error.message}`);
  return (data as Row | null) ?? null;
}

/** El último trabajo de ESTE tablero (corriendo o no), con los cambios desde `desde`. */
export async function verRepriorizacion(tablero: TableroRP, desde = 0): Promise<Repriorizacion | null> {
  const { data, error } = await (await getTenantDb()).from(TABLA).select('*')
    .eq('tablero', tablero).order('id', { ascending: false }).limit(1);
  if (error) throw new Error(`plan-repriorizar: no pude leer el estado: ${error.message}`);
  const r = (data as Row[] | null)?.[0];
  return r ? aRepriorizacion(r, desde) : null;
}

// ── Los dos tableros ─────────────────────────────────────────────────────────

/** Una tarea con lo que hace falta para ESCRIBIRLA (sólo las de la tanda). */
type TareaCompleta = TareaRP & { detalle: string; historial: Hist[] };
type Destino = { proyectoId: string; nombre: string };

type Adaptador = {
  /** Todas las tareas (livianas: sin detalle ni historial) y los proyectos. */
  leer(): Promise<{ tareas: TareaRP[]; proyectos: Array<{ id: string; nombre: string }> }>;
  /** Las de la tanda, con detalle e historial, LEÍDAS DE NUEVO de la base (todo lo que decide:
   *  fijada, proyectos, abierta). Se llama antes del modelo y otra vez justo antes de escribir
   *  cada una: ver `procesarTanda`. */
  completas(ids: string[]): Promise<TareaCompleta[]>;
  /** El Perro: el número de cada una contra la vara. */
  puntuar(nuevas: GuardTaskIn[], existentes: Array<{ titulo: string; score: number }>, contexto: string): Promise<{ tareas: GuardScore[]; faltantes: string[]; modelo?: string }>;
  /** El proyecto de las que están en la bandeja (por id de tarea). Sólo destinos que existen o
   *  que se pueden crear con una señal dura (el catálogo, un cliente del CRM). */
  rutear(tareas: TareaCompleta[], proyectos: Array<{ id: string; nombre: string }>): Promise<Map<string, Destino>>;
  /** Escribe lo que cambió y devuelve el cambio para la pantalla. */
  escribir(t: TareaCompleta, w: { juicio?: GuardScore; destino?: Destino; entrada: Hist }): Promise<CambioRP>;
  /** Lo que va una vez al final. `publicar` deja cambios a la vista de la pantalla ANTES de que
   *  termine (el reparto del dueño, mientras el Perro juzga los proyectos). */
  cierre(ids: string[], ultimos: Map<string, number>, publicar: (cs: CambioRP[]) => Promise<void>): Promise<{ cambios: CambioRP[]; aviso?: string }>;
};

/** El norte del negocio y el objetivo del trimestre, como en `priorizarNuevasOwner`: sin eso el
 *  Perro ordena mirando sólo el tablero, que es una referencia circular. */
async function contextoDelNegocio(): Promise<string> {
  const [norte, objetivos] = await Promise.all([faseNegocioTexto().catch(() => ''), objetivosContextoTexto().catch(() => '')]);
  return [norte, objetivos].filter(Boolean).join('\n\n');
}

const pendienteDe = (estado: unknown, avance: number): boolean =>
  avance < 100 && estaPendiente(esEstado(estado) ? estado : estadoDeAvance(avance));

// ⚠️ ESTOS `select` ENUMERAN COLUMNAS: lo que no se nombra no llega, y `score_manual` y `estado`
// son justo las que deciden quién se toca (AGENTS.md → el reparto ya lo pagó con `recurrente`).
// Una lista por tablero, compartida por la lectura del tablero y la relectura de la tanda.
const COLS_DUENO = 'id, title, labels, score, score_manual, recurrente, progress, estado';
const COLS_CLIENTE = 'id, titulo, categorias, score, score_manual, recurrente, progreso, estado, origen, retro_id, experimento_id';

const tareaDueno = (r: Row): TareaRP => ({
  id: str(r.id), titulo: str(r.title) || 'Tarea',
  proyectos: Array.isArray(r.labels) ? (r.labels as unknown[]).map(String) : [],
  score: int(r.score), fijada: r.score_manual === true, recurrente: !!r.recurrente,
  pendiente: pendienteDe(r.estado, int(r.progress)), delPlan: true,
});
const tareaCliente = (r: Row): TareaRP => ({
  id: String(r.id), titulo: str(r.titulo) || 'Tarea',
  proyectos: Array.isArray(r.categorias) ? (r.categorias as unknown[]).map((c) => String(Number(c))) : [],
  score: int(r.score), fijada: r.score_manual === true, recurrente: !!r.recurrente,
  pendiente: pendienteDe(r.estado, int(r.progreso)),
  delPlan: esDelPlanCliente({ origen: str(r.origen) || null, retro_id: r.retro_id == null ? null : int(r.retro_id), experimento_id: r.experimento_id == null ? null : int(r.experimento_id) }),
});

const DUENO: Adaptador = {
  async leer() {
    const db = await getTenantDb();
    const [tRes, pRes] = await Promise.all([
      db.from('plan_tareas').select(COLS_DUENO),
      db.from('plan_proyectos').select('id, name'),
    ]);
    if (tRes.error) throw new Error(`plan_tareas: ${tRes.error.message}`);
    if (pRes.error) throw new Error(`plan_proyectos: ${pRes.error.message}`);
    const tareas = ((tRes.data ?? []) as Row[]).map(tareaDueno);
    const proyectos = ((pRes.data ?? []) as Row[]).map((p) => ({ id: str(p.id), nombre: str(p.name) }));
    return { tareas, proyectos };
  },
  async completas(ids) {
    if (!ids.length) return [];
    const { data, error } = await (await getTenantDb()).from('plan_tareas').select(`${COLS_DUENO}, detalle, historial`).in('id', ids);
    if (error) throw new Error(`plan_tareas (la tanda): ${error.message}`);
    return ((data ?? []) as Row[]).map((r) => ({ ...tareaDueno(r), detalle: str(r.detalle), historial: sanearHist(r.historial) }));
  },
  async puntuar(nuevas, existentes, contexto) {
    // `conCapacidades: false`: las tareas del dueño son de CONSTRUIR el producto, no de usarlo (ver
    // `puntuarNuevas`). El mismo motivo de uso que el Perro de siempre, con el nombre de este trabajo.
    const r = await puntuarNuevas(nuevas, existentes, contexto, 'Re-priorizar todo', { conCapacidades: false });
    return { tareas: r.tareas, faltantes: r.faltantes, modelo: r.usage?.model };
  },
  async rutear(tareas, proyectos) {
    const out = new Map<string, Destino>();
    // LISTA CERRADA: los proyectos que YA existen, sin la bandeja (una tarea no «va» a «Sin
    // proyecto»: cae ahí cuando nada la reclama, y esto es lo que la saca).
    const reales = proyectos.filter((p) => !esProyectoBandeja(p.nombre));
    if (!tareas.length || !reales.length) return out;
    const r = await asignarTareasAProyectos(
      tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle })),
      reales.map((p) => ({ nombre: p.nombre, que: delCatalogo(p.nombre)?.que || '' })),
      'Re-priorizar todo: sacar tareas de la bandeja',
    );
    const porNombre = new Map(reales.map((p) => [nucleo(p.nombre), p]));
    // Sólo lo que resuelve a un proyecto que EXISTE: los `nuevos` del modelo no abren nada acá.
    for (const a of r.asign ?? []) {
      const t = tareas[a.i];
      const p = t ? porNombre.get(nucleo(str(a.destino))) : undefined;
      if (t && p) out.set(t.id, { proyectoId: p.id, nombre: p.nombre });
    }
    return out;
  },
  async escribir(t, { juicio, destino, entrada }) {
    const upd: Row = { updated_at: new Date().toISOString(), historial: conEntrada(t.historial, entrada) };
    const cambio: CambioRP = { k: 't', id: t.id, historialEntry: entrada };
    if (juicio) {
      const s = Math.max(1, Math.min(100, Math.round(juicio.score)));
      // `score_base` es EL JUICIO (mig 0141): el reparto del cierre lo usa de base. Y `score_manual`
      // NO se escribe nunca: una corrida no pone candados (AGENTS.md).
      Object.assign(upd, { score: s, score_base: s, score_razon: juicio.razon || null, impacto: juicio.impacto ?? null, esfuerzo: juicio.esfuerzo ?? null, priority: prioFromScore(s) });
      Object.assign(cambio, { score: s, scoreBase: s, scoreRazon: juicio.razon || '', priority: prioFromScore(s), impacto: juicio.impacto, esfuerzo: juicio.esfuerzo });
    }
    if (destino) { upd.labels = [destino.proyectoId]; Object.assign(cambio, { labels: [destino.proyectoId] }); }
    const { error } = await (await getTenantDb()).from('plan_tareas').update(upd).eq('id', t.id);
    if (error) throw new Error(`plan_tareas ${t.id}: ${error.message}`);
    return cambio;
  },
  async cierre(ids, ultimos, publicar) {
    // EL REPARTO, recién ahora: con todos los juicios nuevos escritos, la pirámide se rehace sobre
    // el tablero entero (aritmética, cero tokens). Respeta lo fijado y no reparte las libres.
    await recurvarPlanOwner();
    const db = await getTenantDb();
    // Lo que el reparto movió, para la pantalla: sin esto, la pestaña abierta tiene el número de la
    // tanda y el próximo guardado (el upsert de la fila entera) deshace el reparto.
    const delReparto: CambioRP[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await db.from('plan_tareas').select('id, score').in('id', ids.slice(i, i + 100));
      for (const r of (data ?? []) as Row[]) {
        const s = int(r.score);
        if (ultimos.get(str(r.id)) !== s) delReparto.push({ k: 't', id: str(r.id), score: s, priority: prioFromScore(s) });
      }
    }
    // ⚠️ SE PUBLICA YA, ANTES DE JUZGAR LOS PROYECTOS (16/10/2026, revisión adversarial). El juicio
    // de los proyectos es UNA llamada al Perro de hasta ~90 s, y hasta el 16/10 estos números
    // viajaban recién después: durante ese minuto la base tenía el reparto y la pestaña no, y
    // cualquier guardado de una tarjeta lo deshacía.
    await publicar(delReparto);
    // Y los PROYECTOS: entraron números nuevos, así que la comparación entre proyectos cambió. Si
    // el Perro no contesta, los proyectos quedan como estaban y se dice (no corta el trabajo: las
    // tareas ya están).
    let aviso: string | undefined;
    const p = await priorizarProyectosOwner('Re-priorizar todo').catch((e) => ({ error: msg(e) } as { error?: string }));
    if (p.error) aviso = `Los proyectos quedaron como estaban: ${p.error}`.slice(0, 480);
    const cambios: CambioRP[] = [];
    if (!p.error) {
      const { data } = await db.from('plan_proyectos').select('id, score, score_razon');
      for (const r of (data ?? []) as Row[]) cambios.push({ k: 'p', id: str(r.id), score: int(r.score), scoreRazon: str(r.score_razon) || undefined });
    }
    return { cambios, aviso };
  },
};

const CLIENTE: Adaptador = {
  async leer() {
    const db = await getTenantDb();
    // Las columnas que deciden, nombradas (ver el del dueño). `origen`, `retro_id` y
    // `experimento_id`: qué es del Plan y qué de la Retro o de un experimento (`esDelPlanCliente`).
    const [tRes, cats] = await Promise.all([
      db.from('experimento_tareas').select(COLS_CLIENTE),
      listCategorias(),
    ]);
    if (tRes.error) throw new Error(`experimento_tareas: ${tRes.error.message}`);
    const tareas = ((tRes.data ?? []) as Row[]).map(tareaCliente);
    return { tareas, proyectos: cats.map((c) => ({ id: String(c.id), nombre: c.nombre })) };
  },
  async completas(ids) {
    const nums = ids.map(Number).filter(Number.isFinite);
    if (!nums.length) return [];
    const { data, error } = await (await getTenantDb()).from('experimento_tareas').select(`${COLS_CLIENTE}, detalle, historial`).in('id', nums);
    if (error) throw new Error(`experimento_tareas (la tanda): ${error.message}`);
    return ((data ?? []) as Row[]).map((r) => ({ ...tareaCliente(r), detalle: str(r.detalle), historial: sanearHist(r.historial) }));
  },
  async puntuar(nuevas, existentes, contexto) {
    const r = await puntuarNuevas(nuevas, existentes, contexto, 'Re-priorizar todo (cliente)');
    return { tareas: r.tareas, faltantes: r.faltantes, modelo: r.usage?.model };
  },
  async rutear(tareas, proyectos) {
    const out = new Map<string, Destino>();
    if (!tareas.length) return out;
    // El ruteo del cliente de siempre (lib/todo-rutear.ts): el CRM, el proyecto que el texto nombra
    // y, si no, el Perro contra sus áreas. `via` dice qué se puede CREAR.
    const destinos = await rutearTareasCliente(tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle })));
    const porNombre = new Map(proyectos.filter((p) => !esProyectoBandeja(p.nombre)).map((p) => [norm(p.nombre), p.id]));
    for (let i = 0; i < tareas.length; i++) {
      const d = destinos[i];
      const nombre = (d?.nombre ?? '').slice(0, 40).trim();
      if (!nombre || esProyectoBandeja(nombre)) continue;
      let id = porNombre.get(norm(nombre));
      if (id == null) {
        // Se CREA sólo con una señal dura: un área del catálogo, o un cliente que sale del CRM. Lo
        // que propuso el modelo (`nuevo`) o quien cargó la tarea (`sugerido`) no abre un proyecto
        // en un trabajo que corre sin nadie mirando: la tarea se queda en la bandeja.
        const cat = delCatalogoTodo(nombre);
        if (!cat && d?.via !== 'cliente') continue;
        const c = await crearCategoria(cat?.nombre ?? nombre, cat?.color ?? '#2F6FED', cat?.emoji);
        id = String(c.id);
        porNombre.set(norm(nombre), id);
      }
      out.set(tareas[i].id, { proyectoId: id, nombre });
    }
    return out;
  },
  async escribir(t, { juicio, destino, entrada }) {
    const patch: Parameters<typeof editarTarea>[1] = { historial: conEntrada(t.historial, entrada) };
    const cambio: CambioRP = { k: 't', id: t.id, historialEntry: entrada };
    if (juicio) {
      const s = Math.max(1, Math.min(100, Math.round(juicio.score)));
      Object.assign(patch, { score: s, score_razon: juicio.razon || null, prioridad: prioFromScore(s), impacto: juicio.impacto ?? null, esfuerzo: juicio.esfuerzo ?? null });
      Object.assign(cambio, { score: s, scoreRazon: juicio.razon || '', priority: prioFromScore(s), impacto: juicio.impacto, esfuerzo: juicio.esfuerzo });
    }
    if (destino) { patch.categorias = [Number(destino.proyectoId)]; Object.assign(cambio, { labels: [destino.proyectoId] }); }
    await editarTarea(Number(t.id), patch);
    return cambio;
  },
  // El tablero del cliente no tiene reparto ni juicio de proyectos: su Perro ubica, no curva.
  async cierre() { return { cambios: [] as CambioRP[] }; },
};

const adaptador = (t: TableroRP): Adaptador => (t === 'dueno' ? DUENO : CLIENTE);

// ── Arrancar ─────────────────────────────────────────────────────────────────

/** LA FOTO: qué tareas entran (en orden) y cuántas fijadas a mano quedan afuera. Una sola función
 *  para el arranque y para lo que la API de MaKo le anuncia a la persona antes del «sí». */
async function fotoDe(tablero: TableroRP): Promise<{ ids: string[]; fijadas: number }> {
  const { tareas, proyectos } = await adaptador(tablero).leer();
  const bandeja = new Set(proyectos.filter((p) => esProyectoBandeja(p.nombre)).map((p) => p.id));
  const esBandeja = (id: string) => bandeja.has(id);
  return { ids: idsDelTrabajo(tareas, esBandeja), fijadas: fijadasFuera(tareas, esBandeja) };
}

/** Cuántas tareas entrarían a un «Re-priorizar todo» AHORA, y cuántas fijadas se respetarían. */
export async function cuantasEntrarian(tablero: TableroRP): Promise<{ total: number; fijadas: number }> {
  const f = await fotoDe(tablero);
  return { total: f.ids.length, fijadas: f.fijadas };
}

/**
 * Arranca un «Re-priorizar todo» en el tablero del workspace en curso, o devuelve el que ya corre.
 * Saca la FOTO de las tareas y deja la fila; no procesa ninguna tanda (eso es `avanzar…`).
 */
export async function iniciarRepriorizacion(o: { tablero: TableroRP; actor: string; origen: 'tablero' | 'api' }): Promise<{ trabajo: Repriorizacion; yaCorria: boolean }> {
  const db = await getTenantDb();
  const enCurso = async (): Promise<Repriorizacion | null> => {
    const { data } = await db.from(TABLA).select('*').eq('tablero', o.tablero).eq('estado', 'corriendo').order('id', { ascending: false }).limit(1);
    const r = (data as Row[] | null)?.[0];
    return r ? aRepriorizacion(r) : null;
  };
  // UNO A LA VEZ: si ya hay uno, es ése (el botón muestra su progreso). La base lo garantiza igual
  // con el índice único (mig 0301); esto ahorra la foto cuando el caso es el normal.
  const ya = await enCurso();
  if (ya) return { trabajo: ya, yaCorria: true };

  const { ids, fijadas } = await fotoDe(o.tablero);
  const ahora = new Date().toISOString();
  const fila: Row = {
    tablero: o.tablero, ids, total: ids.length, fijadas,
    actor: o.actor.slice(0, 120), origen: o.origen,
    // Sin nada que hacer, nace TERMINADO: «no había nada» es un resultado, no un trabajo colgado.
    ...(ids.length ? { estado: 'corriendo' } : { estado: 'hecho', terminado_at: ahora }),
  };
  const { data, error } = await db.from(TABLA).insert(fila).select('*').single();
  if (error) {
    // 23505 = el índice único: otro clic (u otro canal) lo arrancó entre la lectura y el insert.
    if ((error as { code?: string }).code === '23505') {
      const otro = await enCurso();
      if (otro) return { trabajo: otro, yaCorria: true };
    }
    throw new Error(`plan-repriorizar: no pude arrancar: ${error.message}`);
  }
  const nuevo = aRepriorizacion(data as Row);
  // Los cambios de los trabajos anteriores ya no los lee nadie (el tablero pide los del último):
  // se vacían para que la tabla no acumule un tablero entero por corrida.
  await db.from(TABLA).update({ cambios: [] }).eq('tablero', o.tablero).neq('estado', 'corriendo').lt('id', nuevo.id)
    .then(({ error: e }) => { if (e) console.warn(`[plan-repriorizar] no pude vaciar los cambios viejos: ${e.message}`); });
  return { trabajo: nuevo, yaCorria: false };
}

// ── Avanzar ──────────────────────────────────────────────────────────────────

type ResultadoTanda = { cambios: CambioRP[]; puntuadas: number; ruteadas: number; fijadas: number; sinPuntuar: number; modelo?: string };

/** Procesa UNA tanda. Tira si el Perro no contesta (la tanda se reintenta entera). */
async function procesarTanda(trabajoId: number, ad: Adaptador, idsTanda: string[]): Promise<ResultadoTanda> {
  const { tareas, proyectos } = await ad.leer();
  const bandeja = new Set(proyectos.filter((p) => esProyectoBandeja(p.nombre)).map((p) => p.id));
  const esBandeja = (id: string) => bandeja.has(id);
  const plan = planDeTanda(idsTanda, tareas, esBandeja);
  const enJuego = [...new Set([...plan.puntuar, ...plan.rutear].map((t) => t.id))];
  const completas = new Map((await ad.completas(enJuego)).map((t) => [t.id, t]));
  const nombreProy = new Map(proyectos.map((p) => [p.id, p.nombre]));

  // 1) EL PROYECTO PRIMERO, para que el Perro puntúe sabiendo dónde vive cada una.
  const aRutear = plan.rutear.map((t) => completas.get(t.id)).filter((t): t is TareaCompleta => !!t);
  const ruteo = aRutear.length ? await ad.rutear(aRutear, proyectos) : new Map<string, Destino>();

  // 2) EL NÚMERO, contra la vara del resto del tablero.
  const aPuntuar = plan.puntuar.map((t) => completas.get(t.id)).filter((t): t is TareaCompleta => !!t);
  const nuevas: GuardTaskIn[] = aPuntuar.map((t) => {
    const destino = ruteo.get(t.id);
    const actual = t.proyectos.find((p) => !esBandeja(p));
    return { id: t.id, titulo: t.titulo, detalle: t.detalle, proyecto: destino?.nombre ?? (actual ? nombreProy.get(actual) : undefined) };
  });
  let juicios: GuardScore[] = [];
  let faltantes: string[] = [];
  let modelo: string | undefined;
  if (nuevas.length) {
    const r = await ad.puntuar(nuevas, vara(tareas, new Set(idsTanda)), await contextoDelNegocio());
    // «No contestó nada» es un FALLO de la tanda, no «no había nada que cambiar»: sin esto, una
    // tanda entera quedaba sin número y el trabajo seguía como si nada (la de abajo es la regla).
    if (!r.tareas.length) throw new Error(`el Perro no devolvió ningún puntaje (${nuevas.length} tareas)`);
    juicios = r.tareas; faltantes = r.faltantes; modelo = r.modelo;
  }
  const porId = new Map(juicios.map((j) => [j.id, j]));

  // 3) ESCRIBIR, de a una (son 20): cada una con su entrada de historial de MaKo.
  //
  // ⚠️ CONTRA LA FILA RELEÍDA JUSTO ANTES DE ESCRIBIRLA, no contra la foto de arriba (16/10/2026,
  // revisión adversarial). Entre esa foto y este momento pasa la llamada al Perro —de 30 a 90 s—, y
  // la persona sigue usando el tablero: decidir con la foto le ponía el número de la IA a una tarea
  // que ella acababa de fijar a mano (y con su candado puesto, como si lo hubiera elegido ella),
  // borraba la entrada de historial de un arrastre hecho en ese minuto, y le cambiaba el proyecto a
  // una que ella ya había sacado de la bandeja. Releída, lo fijado no se toca, la que se cerró se
  // saltea, el proyecto sólo cambia si sigue en la bandeja, y el historial es el de AHORA. Lo que
  // queda es el instante entre esta lectura y la escritura, el mismo de cualquier lectura-y-escritura
  // del tablero (`editarTarea`, `moverTarea`).
  const cambios: CambioRP[] = [];
  let puntuadas = 0, ruteadas = 0, fijadasEnElMedio = 0;
  for (const id of enJuego) {
    if (!completas.has(id)) continue;
    const [t] = await ad.completas([id]);
    if (!t || !t.pendiente || !t.delPlan) continue;
    if (t.fijada && !plan.fijadas.some((f) => f.id === id)) fijadasEnElMedio++;
    const juicio = t.fijada || t.recurrente ? undefined : porId.get(id);
    const destino = enBandeja(t, esBandeja) ? ruteo.get(id) : undefined;
    if (!juicio && !destino) continue;
    const entrada: Hist = {
      id: idEntradaRP(trabajoId, id), ts: Date.now(), actor: 'ia',
      text: textoEntradaRP({ antes: t.score, score: juicio ? Math.max(1, Math.min(100, Math.round(juicio.score))) : undefined, razon: juicio?.razon, proyecto: destino?.nombre }),
    };
    cambios.push(await ad.escribir(t, { juicio, destino, entrada }));
    if (juicio) puntuadas++;
    if (destino) ruteadas++;
  }
  return { cambios, puntuadas, ruteadas, fijadas: plan.fijadas.length + fijadasEnElMedio, sinPuntuar: faltantes.length, modelo };
}

/**
 * Avanza el trabajo `id` todo lo que entre en el reloj (`hasta`): toma una tanda, la procesa, la
 * suelta con el avance, y sigue. Corre ADENTRO del workspace del trabajo. Nunca tira: un fallo de
 * la tanda queda en la fila (`trasFalla`), y un fallo de la base se loguea.
 */
export async function avanzarRepriorizacion(id: number, opts: { hasta: number; pausaMs?: number }): Promise<{ tandas: number; estado: EstadoRP | null }> {
  let tandas = 0;
  let estado: EstadoRP | null = null;
  const pausa = opts.pausaMs ?? PAUSA_ENTRE_TANDAS_MS;
  try {
    const db = await getTenantDb();
    for (;;) {
      const fila = await leerFila(id);
      if (!fila) return { tandas, estado: null };
      estado = fila.estado as EstadoRP;
      if (fila.estado !== 'corriendo') break;
      const fase: FaseRP = fila.fase === 'cierre' ? 'cierre' : 'tareas';
      if (!estaLibre(str(fila.tomada_hasta) || null)) break;
      if (!alcanzaElReloj(fase, opts.hasta)) break;
      const queTanda = fase === 'cierre' ? 'Cierre' : `Tanda ${Math.floor(int(fila.hechas) / TANDA) + 1}`;
      // ⚠️ UNA TANDA QUE SE TOMÓ `MAX_INTENTOS` VECES Y NUNCA SE SOLTÓ NO SE TOMA OTRA VEZ (16/10/2026,
      // revisión adversarial). Si la función se muere a mitad (Vercel la corta por `maxDuration`, un
      // deploy), no corre el `catch`: hasta ese día `intentos` no subía, el candado vencía a los 4
      // minutos, el sondeo de la pantalla la volvía a empujar, y la MISMA tanda se repetía para
      // siempre —gastando red gratis— sin que el trabajo pasara nunca a «error». Ahora el intento se
      // cuenta al TOMARLA (abajo), así que tres muertes seguidas cortan el trabajo como tres fallos.
      if (int(fila.intentos) >= MAX_INTENTOS) {
        await db.from(TABLA).update({
          estado: 'error', terminado_at: new Date().toISOString(), tomada_hasta: null, updated_at: new Date().toISOString(),
          error: `${queTanda}: no terminó ${int(fila.intentos)} veces seguidas (se cortó antes de soltarla)`.slice(0, 480),
        }).eq('id', id).eq('estado', 'corriendo').eq('vuelta', int(fila.vuelta));
        estado = 'error';
        break;
      }
      // TOMARLA: compare-and-set sobre `vuelta`. De dos drenajes que llegan juntos, gana uno. Y el
      // intento se cuenta ACÁ, no en el `catch` (ver arriba): soltarla bien lo vuelve a 0.
      const vuelta = int(fila.vuelta) + 1;
      const { data: tomada } = await db.from(TABLA)
        .update({ vuelta, intentos: int(fila.intentos) + 1, tomada_hasta: new Date(Date.now() + CANDADO_MS).toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id).eq('estado', 'corriendo').eq('vuelta', int(fila.vuelta)).select('id');
      if (!tomada || !(tomada as unknown[]).length) break;

      const ad = adaptador(fila.tablero === 'dueno' ? 'dueno' : 'cliente');
      const ids = Array.isArray(fila.ids) ? (fila.ids as unknown[]).map(String) : [];
      const total = int(fila.total);
      const hechas = int(fila.hechas);
      const cambiosPrevios = Array.isArray(fila.cambios) ? (fila.cambios as CambioRP[]) : [];
      // Soltarla exige la vuelta que se tomó: si el candado venció y la tomó otro, esto no pisa su avance.
      const soltar = async (cambios: Row) => {
        const { error } = await db.from(TABLA).update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).eq('vuelta', vuelta);
        if (error) console.error(`[plan-repriorizar] ${id}: no pude escribir el avance: ${error.message}`);
      };
      try {
        if (fase === 'tareas') {
          const idsTanda = ids.slice(hechas, hechas + TANDA);
          const r = idsTanda.length ? await procesarTanda(id, ad, idsTanda) : { cambios: [], puntuadas: 0, ruteadas: 0, fijadas: 0, sinPuntuar: 0 } as ResultadoTanda;
          const ya = hechas + idsTanda.length;
          const termino = ya >= total;
          // El dueño todavía tiene el cierre; el cliente termina acá.
          const fin = termino && fila.tablero !== 'dueno';
          await soltar({
            hechas: ya, puntuadas: int(fila.puntuadas) + r.puntuadas, ruteadas: int(fila.ruteadas) + r.ruteadas,
            fijadas: int(fila.fijadas) + r.fijadas, sin_puntuar: int(fila.sin_puntuar) + r.sinPuntuar,
            cambios: [...cambiosPrevios, ...conHora(r.cambios)], intentos: 0, tomada_hasta: null,
            ...(r.modelo ? { modelo: r.modelo.slice(0, 80) } : {}),
            ...(termino && !fin ? { fase: 'cierre' } : {}),
            ...(fin ? { estado: 'hecho', terminado_at: new Date().toISOString() } : {}),
          });
          tandas++;
        } else {
          const ultimos = new Map<string, number>();
          for (const c of cambiosPrevios) if (c.k === 't' && c.score != null) ultimos.set(c.id, c.score);
          // Lo que el cierre publica ANTES de terminar (el reparto del dueño): a la fila ya, con la
          // vuelta que se tomó, sin soltar el candado.
          let publicados: CambioRP[] = [];
          const publicar = async (cs: CambioRP[]) => {
            if (!cs.length) return;
            publicados = [...publicados, ...conHora(cs)];
            const { error } = await db.from(TABLA).update({ cambios: [...cambiosPrevios, ...publicados], updated_at: new Date().toISOString() }).eq('id', id).eq('vuelta', vuelta);
            if (error) console.warn(`[plan-repriorizar] ${id}: no pude publicar el reparto antes del cierre: ${error.message}`);
          };
          const r = await ad.cierre(ids, ultimos, publicar);
          await soltar({
            cambios: [...cambiosPrevios, ...publicados, ...conHora(r.cambios)], intentos: 0, tomada_hasta: null,
            estado: 'hecho', terminado_at: new Date().toISOString(), ...(r.aviso ? { error: r.aviso } : {}),
          });
          tandas++;
        }
      } catch (e) {
        // `fila.intentos` es el de ANTES de tomarla: `trasFalla` le suma uno, que es el que ya se
        // escribió al tomarla.
        const f = trasFalla(int(fila.intentos), `${queTanda}: ${msg(e)}`);
        console.warn(`[plan-repriorizar] ${id} · ${f.error} (intento ${f.intentos})`);
        await soltar({ intentos: f.intentos, error: f.error, estado: f.estado, tomada_hasta: f.tomadaHasta, ...(f.terminado ? { terminado_at: f.terminado } : {}) });
        // Un fallo no se reintenta en el MISMO drenaje: la espera (`tomada_hasta`) es justamente para
        // no volver a pegarle a una cuota que se acabó hace un segundo.
        break;
      }
      if (pausa > 0) await esperar(pausa);
    }
  } catch (e) {
    console.error(`[plan-repriorizar] ${id}: ${msg(e)}`);
  }
  return { tandas, estado };
}

/**
 * Empuja el trabajo en `after()`: la respuesta sale ya y la tanda corre después, con el reloj de la
 * ruta (`hasta`). `false` si no hay pedido en curso (un cron, un script): ahí lo levanta el cron.
 */
export function seguirEnSegundoPlano(ws: number, id: number, hasta: number): boolean {
  try {
    after(() => runWithWorkspace(ws, () => avanzarRepriorizacion(id, { hasta })).then(() => undefined));
    return true;
  } catch (e) {
    console.warn(`[plan-repriorizar] sin after() (${msg(e)}): lo levanta el cron`);
    return false;
  }
}

/**
 * EL CRON: todos los trabajos corriendo de TODOS los negocios, uno detrás del otro mientras haya
 * reloj. Pregunta a la tabla (no itera workspaces): un minuto sin nada cuesta UNA consulta.
 */
export async function drenarRepriorizaciones(opts: { hasta: number; pausaMs?: number }): Promise<{ corriendo: number; tandas: number }> {
  const { data, error } = await getSupabaseServer().from(TABLA)
    .select('id, workspace_id, tomada_hasta').eq('estado', 'corriendo').order('id', { ascending: true }).limit(50);
  if (error) throw new Error(`plan-repriorizar (cron): ${error.message}`);
  let tandas = 0;
  const filas = (data ?? []) as Row[];
  for (const f of filas) {
    if (!estaLibre(str(f.tomada_hasta) || null)) continue;
    if (!alcanzaElReloj('tareas', opts.hasta)) break;
    const r = await runWithWorkspace(int(f.workspace_id), () => avanzarRepriorizacion(int(f.id), opts));
    tandas += r.tandas;
  }
  return { corriendo: filas.length, tandas };
}

// ── Las dos acciones del tablero ─────────────────────────────────────────────

/**
 * `repriorizar` (arrancar) y `repriorizar-estado` (el sondeo), IGUALES en las dos rutas del tablero
 * (/api/todo del cliente y /api/plan-board del dueño): cada una sólo dice cuál es su tablero. Si la
 * acción no es una de éstas, `null` (la ruta sigue con las suyas).
 *
 * El sondeo EMPUJA: si el trabajo está corriendo y nadie lo tiene tomado, la tanda siguiente sale en
 * `after()` con el reloj de la ruta. Así, con la pestaña abierta, las tandas van una detrás de otra;
 * cerrada, las sigue el cron.
 */
export async function accionDelTablero(
  tablero: TableroRP, accion: string, body: Record<string, unknown>,
  o: { inicio: number; relojMs: number; actor: () => Promise<string> },
): Promise<{ ok: boolean; trabajo?: Repriorizacion | null; yaCorria?: boolean; error?: string } | null> {
  if (accion !== 'repriorizar' && accion !== 'repriorizar-estado') return null;
  // El workspace se CAPTURA acá: `after()` corre fuera del contexto del pedido.
  const ws = wsEnContexto() ?? (await getWorkspaceActual());
  if (ws == null) return { ok: false, error: 'sin workspace' };
  const hasta = o.inicio + o.relojMs;
  return runWithWorkspace(ws, async () => {
    if (accion === 'repriorizar') {
      const r = await iniciarRepriorizacion({ tablero, actor: await o.actor().catch(() => ''), origen: 'tablero' });
      if (r.trabajo.estado === 'corriendo' && r.trabajo.libre) seguirEnSegundoPlano(ws, r.trabajo.id, hasta);
      return { ok: true, trabajo: r.trabajo, yaCorria: r.yaCorria };
    }
    const desde = Number(body.desde);
    const e = await verRepriorizacion(tablero, Number.isFinite(desde) ? desde : 0);
    if (e && e.estado === 'corriendo' && e.libre) seguirEnSegundoPlano(ws, e.id, hasta);
    return { ok: true, trabajo: e };
  });
}
