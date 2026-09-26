import 'server-only';

// =============================================================================
// trabajo — lo que el TABLERO ya sabe de un cliente de Customer Success
// =============================================================================
// La ficha de un cliente vive en Customer Success, y hasta hoy contestaba «¿cómo va
// con el programa?» y nada más. Lo que falta es «¿qué trabajo hay con él?», que ya
// está cargado y vive en otra pantalla: sus PROYECTOS («Cliente: X»), sus TAREAS y
// sus RECURRENTES.
//
// ⚠️ ES EL TABLERO DEL CLIENTE, NO EL DEL DUEÑO. /customer-success sólo corre con
// `esWorkspaceDueno()` (ws1 = Mauricio), y el ws1 es un CLIENTE de la plataforma: su
// trabajo vive en `experimento_tareas` / `tarea_categorias` (lib/todo.ts), no en
// `plan_tareas` / `plan_proyectos` (lib/plan-board.ts, que además es del super-admin y
// para el ws1 está vacío). Apuntar al otro par de tablas devuelve cero filas sin un
// solo error — el modo de falla que AGENTS.md ya tiene documentado dos veces.
//
// ⚠️ CERO NO ES «NO HAY». `listTareas` y `listCategorias` TIRAN cuando la consulta
// falla, y acá eso vuelve como error y no como lista vacía: «no pude leer el tablero»
// y «este cliente todavía no tiene trabajo» son dos pantallas distintas, y la segunda
// sobre la primera es la mentira tranquilizadora de siempre.
//
// ⚠️ LAS RECURRENTES VAN APARTE Y NO CUENTAN COMO ABIERTAS. Es el motivo por el que
// existe el flag: algo que se repite para siempre no tiene fin, así que sumarlo a
// «tiene 3 pendientes» es un aviso falso — y restarlo sin decirlo deja un proyecto
// atendido todas las semanas mostrando 0%. Acá se cuentan en su propio renglón y el
// avance de un proyecto sin trabajo-con-fin no es un porcentaje: es «En marcha».
// =============================================================================

import { getTenantDb } from '@/lib/workspace';
import { hoyEnWorkspace } from '@/lib/timezone';
import { leerTodo } from '@/lib/supabase-paginado';
import { listTareas, listCategorias, type Tarea, type Categoria } from '@/lib/todo';
import { estaPendiente, type EstadoTarea } from '@/lib/todo-estados';
import { esRecurrente } from '@/lib/plan-recurrentes';
import { atar, type ClienteCruce, type ComoAto } from './cruce';

export type { ComoAto };

/** Una tarea del tablero, recortada a lo que la ficha muestra. Viaja al navegador:
 *  no lleva historial ni fuente (no se leen acá y son la mitad del peso). */
export type TareaCS = {
  id: number;
  titulo: string;
  /** Tal cual lo guarda el tablero (markdown o el HTML del editor). Lo pinta la ficha. */
  detalle: string;
  estado: EstadoTarea;
  progreso: number;
  score: number;
  scoreRazon: string | null;
  deadline: string | null;
  recurrente: boolean;
  /** ids de los proyectos a los que pertenece (puede estar en más de uno). */
  proyectos: number[];
  responsable: string | null;
  /** El lead que la propia tarea declara (`cliente_lead_id`, mig 0159). Es la ÚNICA
   *  clave honesta que hay: el resto del cruce es el nombre del proyecto. */
  leadDeclarado: number | null;
  /** Entró por esa clave y no por el parecido del nombre. */
  porClave: boolean;
  abierta: boolean;
  actualizada: string;
};

export type ProyectoCS = {
  id: number;
  nombre: string;
  emoji: string;
  color: string;
  detalle: string;
  deadline: string | null;
  quarter: string | null;
  /** La prioridad del proyecto (1-100) y por qué. La escribe el Perro. */
  score: number;
  scoreRazon: string | null;
  /** Cómo se ató a este cliente. La ficha lo dice: un parecido no es una clave. */
  como: ComoAto;
  abiertas: number;
  hechas: number;
  recurrentes: number;
  atrasadas: number;
};

/** Un proyecto «Cliente: …» que no cruzó con nadie de la cartera. No se esconde. */
export type ProyectoHuerfano = { id: number; nombre: string; abiertas: number; recurrentes: number; atrasadas: number };

export type TrabajoCliente = {
  proyectos: ProyectoCS[];
  /** Las que tienen fin: abiertas y hechas, sin recurrentes. */
  tareas: TareaCS[];
  recurrentes: TareaCS[];
  huerfanos: ProyectoHuerfano[];
};

export type ResultadoTrabajo =
  | ({ ok: true } & TrabajoCliente)
  | { ok: false; error: string };

/** Lo que la GRILLA necesita de cada cliente: números, sin una sola tarea adentro.
 *  El detalle se pide al abrir la ficha; bajar las 158 tareas del ws1 en la cartera
 *  sería pagar el payload entero para una pantalla que quizá no abre ninguna. */
export type ResumenTrabajo = {
  proyectos: number;
  abiertas: number;
  hechas: number;
  recurrentes: number;
  /** Abiertas con el deadline ya pasado. Es lo que alimenta la SEÑAL de atención
   *  de la cartera (lib/cs-senal.ts): «le debo trabajo con fecha vencida» es un
   *  hecho, «tiene 12 tareas» no dice nada. Las recurrentes no cuentan — no
   *  llevan deadline y no terminan nunca. */
  atrasadas: number;
  /** El ato más fuerte que tiene. `null` = no cruzó con ningún proyecto. */
  como: ComoAto | null;
};

export type TableroCartera =
  | { ok: true; porLead: Record<number, ResumenTrabajo>; huerfanos: ProyectoHuerfano[]; sinProyecto: number }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────

type Lectura = { tareas: Tarea[]; proyectos: Categoria[]; esDeCliente: (n: string) => boolean };

/** El reconocedor de proyectos «Cliente: …», en DIFERIDO. Vive en `lib/todo-rutear.ts`
 *  —copiar su regex acá sería el segundo lugar donde vive la misma regla— y ese módulo
 *  arrastra al Perro entero: importarlo arriba lo metería en el grafo de la PÁGINA, que
 *  no lo necesita para dibujarse. */
const reconocedor = async () => (await import('@/lib/todo-rutear')).esProyectoDeCliente;

/** Las dos lecturas, en paralelo. Si cualquiera falla, falla todo: media foto del
 *  tablero se lee como un cliente sin trabajo, que es justo lo que no se puede decir. */
async function leerTablero(): Promise<Lectura> {
  const [tareas, proyectos, esDeCliente] = await Promise.all([listTareas(), listCategorias(), reconocedor()]);
  return { tareas, proyectos, esDeCliente };
}

const mensaje = (e: unknown): string =>
  `No pude leer el tablero: ${e instanceof Error ? e.message : String(e)}`;

/** leadId declarado por las tareas de cada proyecto. Es la vía dura del cruce. */
function leadsPorProyecto(tareas: Tarea[]): Map<number, Set<number>> {
  const m = new Map<number, Set<number>>();
  for (const t of tareas) {
    const lead = t.cliente_lead_id;
    if (!lead) continue;
    for (const c of t.categorias) {
      const s = m.get(c) ?? new Set<number>();
      s.add(lead);
      m.set(c, s);
    }
  }
  return m;
}

const aTareaCS = (t: Tarea): TareaCS => ({
  id: t.id,
  titulo: t.titulo,
  detalle: t.detalle ?? '',
  estado: t.estado,
  progreso: t.progreso,
  score: t.score,
  scoreRazon: t.score_razon,
  deadline: t.deadline,
  recurrente: esRecurrente({ recurrente: (t as { recurrente?: boolean }).recurrente }),
  proyectos: t.categorias,
  responsable: t.responsable,
  leadDeclarado: t.cliente_lead_id,
  porClave: false,
  abierta: estaPendiente(t.estado),
  actualizada: t.updated_at,
});

/** Los tres números de un conjunto de tareas. Las recurrentes NO entran en `abiertas`:
 *  el pedido entero existe para que no ensucien lo que se cuenta como pendiente. */
function contar(tareas: Array<{ recurrente: boolean; abierta: boolean; deadline: string | null }>, hoy: string) {
  let abiertas = 0, hechas = 0, recurrentes = 0, atrasadas = 0;
  for (const t of tareas) {
    if (t.recurrente) { recurrentes++; continue; }
    if (!t.abierta) { hechas++; continue; }
    abiertas++;
    // `hoy` es el del WORKSPACE, no el del servidor: una tarea que vence hoy no
    // está atrasada, y en qué día estamos depende de la zona del inquilino.
    if (t.deadline && t.deadline < hoy) atrasadas++;
  }
  return { abiertas, hechas, recurrentes, atrasadas };
}

function cruzar(clientes: ClienteCruce[], { tareas, proyectos, esDeCliente }: Lectura) {
  const cruce = atar(clientes, proyectos.map((p) => ({ id: p.id, nombre: p.nombre })), {
    esDeCliente,
    leadPorProyecto: leadsPorProyecto(tareas),
  });
  const deCS = tareas.map((t) => aTareaCS(t));
  const porProyecto = new Map<number, TareaCS[]>();
  for (const t of deCS) for (const c of t.proyectos) porProyecto.set(c, [...(porProyecto.get(c) ?? []), t]);
  return { cruce, deCS, porProyecto };
}

const huerfanoDe = (p: Categoria, tareas: TareaCS[], hoy: string): ProyectoHuerfano => {
  const n = contar(tareas, hoy);
  return { id: p.id, nombre: p.nombre, abiertas: n.abiertas, recurrentes: n.recurrentes, atrasadas: n.atrasadas };
};

/**
 * El resumen de TODA la cartera, para la grilla. Una sola lectura del tablero para los
 * 14 clientes: hacerla por cliente sería 14 veces la misma consulta.
 */
export async function tableroDeLaCartera(clientes: ClienteCruce[]): Promise<TableroCartera> {
  let lectura: Lectura;
  try { lectura = await leerTablero(); }
  catch (e) { return { ok: false, error: mensaje(e) }; }

  const { cruce, porProyecto } = cruzar(clientes, lectura);
  const porNombre = new Map(lectura.proyectos.map((p) => [p.id, p]));
  const hoy = await hoyEnWorkspace();

  const porLead: Record<number, ResumenTrabajo> = {};
  for (const c of clientes) {
    const ataduras = cruce.porLead.get(c.leadId) ?? [];
    const vistas = new Set<number>();
    const suyas: TareaCS[] = [];
    for (const a of ataduras) {
      for (const t of porProyecto.get(a.proyectoId) ?? []) {
        if (vistas.has(t.id)) continue;
        vistas.add(t.id);
        suyas.push(t);
      }
    }
    const n = contar(suyas, hoy);
    porLead[c.leadId] = { proyectos: ataduras.length, ...n, como: ataduras[0]?.como ?? null };
  }

  return {
    ok: true,
    porLead,
    huerfanos: cruce.huerfanos
      .map((id) => porNombre.get(id))
      .filter((p): p is Categoria => !!p)
      .map((p) => huerfanoDe(p, porProyecto.get(p.id) ?? [], hoy)),
    sinProyecto: cruce.sinProyecto.length,
  };
}

/**
 * El trabajo de UN cliente, con el detalle adentro. Lo pide la ficha al abrirse.
 *
 * Cruza sobre la cartera ENTERA aunque devuelva uno solo: el cruce blando necesita
 * saber qué palabra comparten los demás para decidir si una es distintiva, y correrlo
 * con un solo cliente convertiría cualquier palabra suya en única.
 */
export async function trabajoDeCliente(leadId: number, clientes: ClienteCruce[]): Promise<ResultadoTrabajo> {
  let lectura: Lectura;
  try { lectura = await leerTablero(); }
  catch (e) { return { ok: false, error: mensaje(e) }; }

  const { cruce, deCS, porProyecto } = cruzar(clientes, lectura);
  const porId = new Map(lectura.proyectos.map((p) => [p.id, p]));
  const hoy = await hoyEnWorkspace();
  const ataduras = cruce.porLead.get(leadId) ?? [];

  const proyectos: ProyectoCS[] = [];
  const vistas = new Set<number>();
  const suyas: TareaCS[] = [];

  for (const a of ataduras) {
    const p = porId.get(a.proyectoId);
    if (!p) continue;
    const delProyecto = porProyecto.get(p.id) ?? [];
    const n = contar(delProyecto, hoy);
    proyectos.push({
      id: p.id, nombre: p.nombre, emoji: p.emoji, color: p.color,
      detalle: p.detalle, deadline: p.deadline, quarter: p.quarter,
      score: p.prioridad, scoreRazon: p.score_razon, como: a.como, ...n,
    });
    for (const t of delProyecto) {
      if (vistas.has(t.id)) continue;
      vistas.add(t.id);
      suyas.push(t);
    }
  }

  // La CLAVE alcanza sola: una tarea que declara este lead es suya aunque su proyecto
  // no haya cruzado (o aunque no tenga proyecto). Es el único dato duro que hay, y
  // marca la fila para que la ficha pueda decir por dónde entró.
  const yaEn = new Map(suyas.map((t) => [t.id, t]));
  for (const t of deCS) {
    if (t.leadDeclarado !== leadId) continue;
    const ya = yaEn.get(t.id);
    if (ya) { ya.porClave = true; continue; }
    vistas.add(t.id);
    suyas.push({ ...t, porClave: true });
  }

  // El orden es el del tablero: primero lo que más mueve la aguja, y lo hecho al final.
  const orden = (a: TareaCS, b: TareaCS) =>
    Number(a.abierta === false) - Number(b.abierta === false) || b.score - a.score || a.titulo.localeCompare(b.titulo);

  return {
    ok: true,
    proyectos,
    tareas: suyas.filter((t) => !t.recurrente).sort(orden),
    recurrentes: suyas.filter((t) => t.recurrente).sort((a, b) => a.titulo.localeCompare(b.titulo)),
    huerfanos: cruce.huerfanos
      .map((id) => porId.get(id))
      .filter((p): p is Categoria => !!p)
      .map((p) => huerfanoDe(p, porProyecto.get(p.id) ?? [], hoy)),
  };
}

/**
 * Los clientes contra los que se cruza: los leads GANADOS del workspace, que es el mismo
 * universo que `cartera()` (lib/cs-cartera.ts). Lo necesita la server action, que recibe
 * un `leadId` y nada más — la lista no puede venir del navegador, que es quien pregunta.
 *
 * Paginado por `id` por la misma razón que la cartera: un `.select()` suelto corta en 1000
 * sin un solo error, y lo que cae deja de existir para el cruce.
 */
export async function clientesGanados(): Promise<ClienteCruce[]> {
  type Fila = { id: number; nombre: string | null; empresa: string | null };
  const db = await getTenantDb();
  const filas = await leerTodo<Fila>(db, 'leads', 'id, nombre, empresa',
    { orden: 'id', eq: { estado_lead: 'ganado' } });
  return filas.map((l) => ({ leadId: l.id, nombre: (l.nombre ?? '').trim(), empresa: l.empresa }));
}
