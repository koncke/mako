import 'server-only';

// =============================================================================
// trabajo — lo que el TABLERO ya sabe de un cliente de Customer Success
// =============================================================================
// La ficha de un cliente vive en Customer Success, y hasta hoy contestaba «¿cómo va
// con el programa?» y nada más. Lo que falta es «¿qué trabajo hay con él?», que ya
// está cargado y vive en otra pantalla: sus PROYECTOS («Cliente: X»), sus TAREAS y
// sus RECURRENTES.
//
// ⚠️ ES EL TABLERO QUE LE TOCA A QUIEN MIRA, Y ANTES ERA SIEMPRE EL DEL CLIENTE. Acá
// había un comentario que decía, con todas las letras, que esto lee `experimento_tareas`
// «no `plan_tareas`, que además es del super-admin y para el ws1 está vacío». Era cierto
// para el ws1 y falso para el workspace del super-admin, que es justamente donde viven
// los clientes de MaKo. Medido el 26/09/2026 contra producción:
//
//     ws   experimento_tareas   tarea_categorias   plan_tareas   plan_proyectos
//      1         212                   19                0             0
//      9           0                    0              396            71   ← el super-admin
//     11          68                    9                0             0
//     13          19                    6                0             0
//
// O sea que su tab de clientes decía «sin trabajo suyo en el tablero» para los tres
// clientes: no fallaba el cruce, estaba leyendo la tabla vacía. La elección la hace ahora
// `lib/tablero-actual.ts`, que es la MISMA condición que usa `/plan` para decidir qué
// tablero te muestra — dos criterios distintos serían una tab que muestra un tablero y un
// link «abrir en el tablero» que lleva al otro.
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
import { rowTo, catRow, type Tarea, type Categoria } from '@/lib/todo';
import type { BoardTask, Label } from '@/app/plan/board/types';
import { rowToTask, rowToLabel, type Row } from '@/lib/plan-board';
import { tableroActual, type QueTablero } from '@/lib/tablero-actual';
import { estaPendiente, type EstadoTarea } from '@/lib/todo-estados';
import { esRecurrente } from '@/lib/plan-recurrentes';
import { clienteDe } from '@/lib/plan-clientes';
import { atar, type ClienteCruce, type ComoAto } from './cruce';

export type { ComoAto };

/** Una tarea del tablero, recortada a lo que la ficha muestra. Viaja al navegador:
 *  no lleva historial ni fuente (no se leen acá y son la mitad del peso). */
export type TareaCS = {
  /** ⚠️ TEXTO, no número: los dos tableros numeran distinto (`experimento_tareas.id` es
   *  bigint, `plan_tareas.id` es texto). Un id de texto contiene a uno numérico; al revés
   *  hay que inventar una conversión que después miente. */
  id: string;
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
  proyectos: string[];
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
  id: string;
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
export type ProyectoHuerfano = { id: string; nombre: string; abiertas: number; recurrentes: number; atrasadas: number };

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

/**
 * UNA TAREA, COMO LA VE ESTE MÓDULO. Es el mínimo común de los dos tableros: lo que
 * `experimento_tareas` y `plan_tareas` contestan igual. Existe para que el cruce, el
 * conteo y el mapper de abajo no sepan de qué tabla salió cada fila — sin esto, cada uno
 * de ellos tendría dos versiones y una se quedaría vieja.
 */
type TareaTab = {
  id: string; titulo: string; detalle: string; estado: EstadoTarea; progreso: number;
  score: number; scoreRazon: string | null; deadline: string | null; recurrente: boolean;
  proyectos: string[]; responsable: string | null; clienteLeadId: number | null;
  actualizada: string;
};
/** Un proyecto, con el mismo criterio. `clienteLeadId` es la clave dura de la 0172. */
type ProyTab = {
  id: string; nombre: string; emoji: string; color: string; detalle: string;
  deadline: string | null; quarter: string | null; score: number; scoreRazon: string | null;
  clienteLeadId: number | null;
};

type Lectura = { tareas: TareaTab[]; proyectos: ProyTab[]; esDeCliente: (n: string) => boolean };

/** El reconocedor de proyectos «Cliente: …», en DIFERIDO. Vive en `lib/todo-rutear.ts`
 *  —copiar su regex acá sería el segundo lugar donde vive la misma regla— y ese módulo
 *  arrastra al Perro entero: importarlo arriba lo metería en el grafo de la PÁGINA, que
 *  no lo necesita para dibujarse. */
const reconocedor = async () => (await import('@/lib/todo-rutear')).esProyectoDeCliente;

/**
 * EL TABLERO QUE LE TOCA A QUIEN MIRA, normalizado.
 *
 * Si cualquier lectura falla, falla todo: media foto del tablero se lee como un cliente
 * sin trabajo, que es justo lo que no se puede decir.
 *
 * ⚠️ LA ELECCIÓN NO SE DECIDE ACÁ: sale de `tableroActual()`, que es la misma condición
 * de `/plan`. Ver el bloque del encabezado con los números medidos — este módulo leía
 * SIEMPRE el tablero del cliente y por eso la tab del super-admin salía vacía.
 */
async function leerTablero(forzado?: QueTablero): Promise<Lectura> {
  // ⚠️ `forzado` EXISTE PARA LOS SCRIPTS, no para las pantallas. `tableroActual()` lee la
  // sesión con `cookies()`, que fuera de un request TIRA — así que una corrida de
  // mantenimiento no puede preguntarle y tiene que decir cuál es. Las pantallas lo dejan
  // vacío, que es lo correcto: ahí sí hay una sesión y adivinarla sería un IDOR.
  const cual = forzado ?? await tableroActual();
  const esDeCliente = await reconocedor();

  const db = await getTenantDb();

  if (cual === 'dueno') {
    const [t, p] = await Promise.all([
      db.from('plan_tareas').select(COLS_TAREA_PLAN),
      db.from('plan_proyectos').select(COLS_PROY_PLAN),
    ]);
    if (t.error) throw new Error(`plan_tareas: ${t.error.message}`);
    if (p.error) throw new Error(`plan_proyectos: ${p.error.message}`);
    return {
      esDeCliente,
      tareas: (t.data ?? []).map((r) => deBoardTask(rowToTask(r as Row))),
      proyectos: (p.data ?? []).map((r) => deBoardLabel(rowToLabel(r as Row))),
    };
  }

  const [t, p] = await Promise.all([
    db.from('experimento_tareas').select(COLS_TAREA_CLIENTE),
    db.from('tarea_categorias').select(COLS_PROY_CLIENTE),
  ]);
  if (t.error) throw new Error(`experimento_tareas: ${t.error.message}`);
  if (p.error) throw new Error(`tarea_categorias: ${p.error.message}`);
  return {
    esDeCliente,
    tareas: (t.data ?? []).map((r) => deTarea(rowTo(r as Record<string, unknown>))),
    proyectos: (p.data ?? []).map((r) => deCategoria(catRow(r as Record<string, unknown>))),
  };
}

/**
 * LAS COLUMNAS QUE EL CRUCE NECESITA, Y NINGUNA MÁS.
 *
 * ⚠️ ESTO ERA `listPlanBoard()`, O SEA `select('*')`, Y ESE ERA EL COSTO ENTERO. Medido el
 * 26/09/2026 en el ws9: la lectura completa pesa **2.105 KB** y lo que el cruce mira son
 * **54 KB** — el 97% que sobra es `detalle` (hasta 6.000 caracteres por tarea, ×396),
 * `historial`, `checklist` y `notas`, que este camino no lee ni una vez.
 *
 * Se reportó dos veces como «cada vez que abro la card hace la búsqueda en el plan». La
 * primera respuesta —leer por clave y dejar el cruce en segundo plano— bajó lo que se
 * PINTA, y el cruce seguía bajando los dos megas igual, así que seguía viéndose buscar.
 *
 * ⚠️ Y LOS MAPPERS SON LOS MISMOS (`rowToTask`, `catRow`…): una fila sin `detalle` sale con
 * `detalle: ''` y nadie más se entera. Escribir mappers «livianos» aparte habría sido la
 * séptima y octava copia del mismo mapeo (AGENTS.md, «un campo nuevo son SEIS lugares»).
 * El texto completo se busca DESPUÉS y sólo de las tarjetas que resultaron ser de alguien.
 */
const COLS_TAREA_PLAN = 'id, num, emoji, title, priority, score, score_base, progress, deadline, quarter, labels, recurrente, recurrencia, cliente_lead_id, cliente_nombre, origen, created_at';
const COLS_PROY_PLAN = 'id, pid, emoji, name, color, score, deadline, quarter, recurrente, recurrencia, cliente_lead_id, cliente_nombre, orden';
const COLS_TAREA_CLIENTE = 'id, titulo, estado, prioridad, progreso, score, deadline, quarter, categorias, recurrente, recurrencia, cliente_lead_id, cliente_nombre, responsable, updated_at, created_at';
const COLS_PROY_CLIENTE = 'id, emoji, nombre, color, prioridad, deadline, quarter, recurrente, recurrencia, cliente_lead_id, cliente_nombre, created_at';

// ⚠️ LAS CUATRO CONVERSIONES SON FUNCIONES Y NO LAMBDAS ADENTRO DE `leerTablero`, para
// que las use también la lectura rápida (`trabajoAsignado`). Con una copia allá, cada
// campo nuevo habría que acordarse de ponerlo en dos lugares — y el que se olvide no
// falla: dibuja una tarjeta a la que le falta un dato, en la mitad de los casos.
const deBoardTask = (t: BoardTask): TareaTab => ({
  id: t.id, titulo: t.title, detalle: t.detalle ?? '',
  // El tablero del dueño no guarda un `estado` aparte: lo DERIVA del avance, igual que
  // lo hace `editarTarea` del otro lado. Se deriva acá con el mismo criterio para que
  // «abierta» signifique lo mismo en las dos mitades.
  estado: t.progress >= 100 ? 'hecho' : t.progress > 0 ? 'en_curso' : 'por_hacer',
  progreso: t.progress, score: t.score, scoreRazon: t.scoreRazon ?? null,
  deadline: t.deadline || null, recurrente: esRecurrente(t),
  proyectos: t.labels,
  // No existe el concepto de responsable en el tablero del dueño (verificado:
  // `grep -rni responsable app/plan/` da cero). `null` es la verdad.
  responsable: null,
  clienteLeadId: clienteDe(t)?.leadId ?? null,
  actualizada: new Date(t.creadaEn ?? Date.now()).toISOString(),
});

const deBoardLabel = (p: Label): ProyTab => ({
  id: p.id, nombre: p.name, emoji: p.emoji, color: p.color, detalle: p.detalle,
  deadline: p.deadline || null, quarter: p.quarter ?? null,
  score: p.score, scoreRazon: p.scoreRazon ?? null,
  clienteLeadId: clienteDe(p)?.leadId ?? null,
});

const deTarea = (t: Tarea): TareaTab => ({
  id: String(t.id), titulo: t.titulo, detalle: t.detalle ?? '', estado: t.estado,
  progreso: t.progreso, score: t.score, scoreRazon: t.score_razon,
  deadline: t.deadline, recurrente: esRecurrente({ recurrente: (t as { recurrente?: boolean }).recurrente }),
  proyectos: t.categorias.map(String), responsable: t.responsable,
  clienteLeadId: t.cliente_lead_id, actualizada: t.updated_at,
});

const deCategoria = (p: Categoria): ProyTab => ({
  id: String(p.id), nombre: p.nombre, emoji: p.emoji, color: p.color, detalle: p.detalle,
  deadline: p.deadline, quarter: p.quarter, score: p.prioridad, scoreRazon: p.score_razon,
  clienteLeadId: p.cliente_lead_id,
});

const mensaje = (e: unknown): string =>
  `No pude leer el tablero: ${e instanceof Error ? e.message : String(e)}`;

const aTareaCS = (t: TareaTab): TareaCS => ({
  id: t.id, titulo: t.titulo, detalle: t.detalle, estado: t.estado,
  progreso: t.progreso, score: t.score, scoreRazon: t.scoreRazon,
  deadline: t.deadline, recurrente: t.recurrente,
  proyectos: t.proyectos, responsable: t.responsable,
  leadDeclarado: t.clienteLeadId,
  porClave: false,
  abierta: estaPendiente(t.estado),
  actualizada: t.actualizada,
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
  // ⚠️ `clienteLeadId` VIAJA AL CRUCE O LA ASIGNACIÓN NO SIRVE DE NADA (mig 0172). Es el
  // campo que escribe el picker: sin pasarlo acá, se podría elegir el cliente de un
  // proyecto, guardarse bien en la base, y la tab seguiría cruzando sólo por el nombre —
  // una asignación que contesta 200 y no cambia nada de lo que se ve.
  // ⚠️ YA NO SE PASA `leadPorProyecto`, Y ES UN ARREGLO, NO UNA PODA. Esa vía decía «una
  // tarea que declara su lead ata el PROYECTO ENTERO», y era inofensiva mientras ninguna
  // tarea tuviera lead escrito (0 de 299 hasta la mig 0172). Desde que se pueden asignar
  // tareas sueltas es activamente falsa: al asignarle a Leila dos tareas, su ficha pasó a
  // mostrar **1 proyecto y 20 abiertas** — el proyecto completo de otro tema, con sus
  // otras 18 tareas adentro. Medido en el ws9 el 26/09/2026.
  //
  // Una tarea asignada es de ese cliente; su proyecto NO lo es. Quien quiera el proyecto
  // entero lo asigna, que para eso está el selector. Las tareas sueltas entran igual:
  // `trabajoDeCliente` las suma por `leadDeclarado` y `tableroDeLaCartera` las cuenta.
  const cruce = atar(clientes, proyectos.map((p) => ({ id: p.id, nombre: p.nombre, clienteLeadId: p.clienteLeadId })), { esDeCliente });
  const deCS = tareas.map((t) => aTareaCS(t));
  const porProyecto = new Map<string, TareaCS[]>();
  for (const t of deCS) for (const c of t.proyectos) porProyecto.set(c, [...(porProyecto.get(c) ?? []), t]);
  return { cruce, deCS, porProyecto };
}

const huerfanoDe = (p: ProyTab, tareas: TareaCS[], hoy: string): ProyectoHuerfano => {
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
    const vistas = new Set<string>();
    const suyas: TareaCS[] = [];
    for (const a of ataduras) {
      for (const t of porProyecto.get(a.proyectoId) ?? []) {
        if (vistas.has(t.id)) continue;
        vistas.add(t.id);
        suyas.push(t);
      }
    }
    // Y las tareas que declaran a ESTE cliente, aunque su proyecto sea de otro o de nadie.
    // Sin esto, el número de la tarjeta ignora justo lo que se acaba de asignar a mano.
    for (const t of lectura.tareas) {
      if (t.clienteLeadId !== c.leadId || vistas.has(t.id)) continue;
      vistas.add(t.id);
      suyas.push(aTareaCS(t));
    }
    const n = contar(suyas, hoy);
    porLead[c.leadId] = {
      proyectos: ataduras.length, ...n,
      // `como` dice CÓMO se ató. Con cero proyectos pero tareas propias, la vía es la
      // clave: alguien las eligió. `null` significaría «no cruzó con nada», que sería falso.
      como: ataduras[0]?.como ?? (suyas.length ? 'clave' : null),
    };
  }

  return {
    ok: true,
    porLead,
    huerfanos: cruce.huerfanos
      .map((id) => porNombre.get(id))
      .filter((p): p is ProyTab => !!p)
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
  let dueno: boolean;
  try {
    dueno = (await tableroActual()) === 'dueno';
    lectura = await leerTablero(dueno ? 'dueno' : 'cliente');
  } catch (e) { return { ok: false, error: mensaje(e) }; }

  const { cruce, deCS, porProyecto } = cruzar(clientes, lectura);
  const porId = new Map(lectura.proyectos.map((p) => [p.id, p]));
  const hoy = await hoyEnWorkspace();
  const ataduras = cruce.porLead.get(leadId) ?? [];

  const proyectos: ProyectoCS[] = [];
  const vistas = new Set<string>();
  const suyas: TareaCS[] = [];

  for (const a of ataduras) {
    const p = porId.get(a.proyectoId);
    if (!p) continue;
    const delProyecto = porProyecto.get(p.id) ?? [];
    const n = contar(delProyecto, hoy);
    proyectos.push({
      id: p.id, nombre: p.nombre, emoji: p.emoji, color: p.color,
      detalle: p.detalle, deadline: p.deadline, quarter: p.quarter,
      score: p.score, scoreRazon: p.scoreRazon, como: a.como, ...n,
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

  // ⚠️ EL `detalle` SE BUSCA ACÁ Y NO EN LA LECTURA. El cruce lee sin texto (ver
  // `COLS_TAREA_PLAN`), así que estas tarjetas vienen con `detalle: ''` y la ficha
  // mostraría «sin detalle cargado» sobre tareas que sí lo tienen — una mentira, y de las
  // silenciosas. Son un puñado de ids, así que es una consulta chica.
  await ponerleTexto(proyectos, suyas, dueno);

  return {
    ok: true,
    proyectos,
    tareas: suyas.filter((t) => !t.recurrente).sort(orden),
    recurrentes: suyas.filter((t) => t.recurrente).sort((a, b) => a.titulo.localeCompare(b.titulo)),
    huerfanos: cruce.huerfanos
      .map((id) => porId.get(id))
      .filter((p): p is ProyTab => !!p)
      .map((p) => huerfanoDe(p, porProyecto.get(p.id) ?? [], hoy)),
  };
}

/**
 * Los clientes contra los que se cruza: los leads GANADOS del workspace.
 *
 * ⚠️ SE RE-EXPORTA, NO SE REDEFINE. La consulta se mudó a `lib/clientes-ganados.ts` el
 * 26/09/2026 porque desde la 0172 también la necesitan las dos páginas del TABLERO, y
 * una página del tablero no puede importar de acá sin arrastrarse el cruce, el ruteador
 * y el Perro. La re-exportación mantiene vivos los call sites de esta tab (./actions.ts,
 * ./page.tsx) sin que haya dos definiciones de «quién es cliente»: si el picker ofreciera
 * un universo distinto del que lista esta pantalla, se podría asignar trabajo a alguien
 * que después no aparece en su propia tab.
 */
export { clientesGanados } from '@/lib/clientes-ganados';
import { clientesGanados } from '@/lib/clientes-ganados';

// ── ASIGNAR ──────────────────────────────────────────────────────────────────
// «No tengo forma de asignar proyectos o tareas a clientes. Debería desde allí mismo,
// buscando o filtrando y seleccionando los que quiera asignar» (26/09/2026).

/** Una tarjeta del tablero, como la ve el selector: qué es y de quién es HOY. */
export type Asignable = {
  id: string;
  tipo: 'proyecto' | 'tarea';
  titulo: string;
  /** El proyecto al que pertenece (una tarea) o cuántas tareas tiene (un proyecto). */
  sub: string;
  /** El lead que tiene hoy, si tiene. */
  clienteLeadId: number | null;
  clienteNombre: string | null;
  /** Para ordenar: lo que más mueve la aguja primero. */
  score: number;
};

export type Catalogo =
  | { ok: true; items: Asignable[] }
  | { ok: false; error: string };

/**
 * TODO lo que se le puede asignar a un cliente: los proyectos y las tareas del tablero
 * que le toca a quien mira.
 *
 * ⚠️ NO SE FILTRA LO QUE YA TIENE DUEÑO, se MARCA. Esconder lo asignado haría imposible
 * ver que una tarea está en el cliente equivocado, que es justamente el error que hay que
 * poder arreglar — y dejaría la lista vacía apenas se asigna, sin forma de deshacerlo.
 *
 * ⚠️ Y LAS TERMINADAS NO ENTRAN. Asignar trabajo cerrado no cambia nada de lo que la
 * pantalla muestra y triplica la lista: en el ws9 son 396 tareas, de las cuales la mayoría
 * están hechas.
 */
export async function catalogoAsignable(): Promise<Catalogo> {
  let lectura: Lectura;
  try { lectura = await leerTablero(); }
  catch (e) { return { ok: false, error: mensaje(e) }; }

  const nombrePorProyecto = new Map(lectura.proyectos.map((p) => [p.id, p.nombre]));
  const tareasDe = new Map<string, number>();
  for (const t of lectura.tareas) for (const p of t.proyectos) tareasDe.set(p, (tareasDe.get(p) ?? 0) + 1);

  const items: Asignable[] = [
    ...lectura.proyectos.map((p): Asignable => ({
      id: p.id, tipo: 'proyecto', titulo: p.nombre,
      sub: (() => { const n = tareasDe.get(p.id) ?? 0; return n === 1 ? '1 tarea' : `${n} tareas`; })(),
      clienteLeadId: p.clienteLeadId, clienteNombre: null, score: p.score,
    })),
    ...lectura.tareas
      .filter((t) => estaPendiente(t.estado))
      .map((t): Asignable => ({
        id: t.id, tipo: 'tarea', titulo: t.titulo,
        sub: t.proyectos.map((p) => nombrePorProyecto.get(p)).filter(Boolean).join(' · ') || 'Sin proyecto',
        clienteLeadId: t.clienteLeadId, clienteNombre: null, score: t.score,
      })),
  ];

  // Proyectos primero —asignar uno ata todas sus tareas de una vez— y dentro de cada
  // grupo, lo que más mueve la aguja arriba.
  return { ok: true, items: items.sort((a, b) =>
    (a.tipo === 'proyecto' ? 0 : 1) - (b.tipo === 'proyecto' ? 0 : 1)
    || b.score - a.score
    || a.titulo.localeCompare(b.titulo, 'es')) };
}

/**
 * Escribe de quién es cada tarjeta. `lead` en `null` la desasigna.
 *
 * ⚠️ ESCRIBE EN EL TABLERO QUE LE TOCA A QUIEN MIRA, por `tableroActual()`. Las dos
 * mitades tienen tablas distintas y hasta tipos de id distintos (texto en `plan_*`,
 * bigint en las del cliente): elegir una a mano acá escribiría cero filas sin un solo
 * error en el workspace de la otra mitad.
 *
 * ⚠️ Y NO ARRASTRA A LAS TAREAS DE UN PROYECTO. Un proyecto asignado ata a ese cliente
 * TODAS sus tareas a través del cruce (`atar`, ./cruce.ts), así que copiar el id en las
 * 53 filas no agregaría un dato: agregaría 53 escrituras por un click y, peor,
 * desasignar el proyecto dejaría las 53 marcadas.
 */
export async function asignarTrabajo(
  ids: { proyectos: string[]; tareas: string[] },
  lead: { leadId: number; nombre: string } | null,
  forzado?: QueTablero,
): Promise<{ ok: true; proyectos: number; tareas: number } | { ok: false; error: string }> {
  const db = await getTenantDb();
  const dueno = (forzado ?? await tableroActual()) === 'dueno';
  const tablaProy = dueno ? 'plan_proyectos' : 'tarea_categorias';
  const tablaTarea = dueno ? 'plan_tareas' : 'experimento_tareas';
  // Los ids de la mitad del cliente son NUMÉRICOS. Lo que no convierta se descarta acá y
  // no en la base: mandar un texto a un `bigint` hace fallar la consulta ENTERA, así que
  // un id raro se llevaría puesta la asignación de todos los demás.
  const idsPara = (xs: string[]) => (dueno ? xs : xs.map(Number).filter(Number.isFinite));

  const campos = { cliente_lead_id: lead?.leadId ?? null, cliente_nombre: lead?.nombre ?? null };
  let proyectos = 0, tareas = 0;

  if (ids.proyectos.length) {
    const lista = idsPara(ids.proyectos);
    const { error, count } = await db.from(tablaProy).update(campos, { count: 'exact' }).in('id', lista as string[]);
    if (error) return { ok: false, error: `proyectos: ${error.message}` };
    proyectos = count ?? lista.length;
  }
  if (ids.tareas.length) {
    const lista = idsPara(ids.tareas);
    const { error, count } = await db.from(tablaTarea).update(campos, { count: 'exact' }).in('id', lista as string[]);
    if (error) return { ok: false, error: `tareas: ${error.message}` };
    tareas = count ?? lista.length;
  }
  return { ok: true, proyectos, tareas };
}

// ── LA LECTURA RÁPIDA ────────────────────────────────────────────────────────
// «Cada vez que abro la card de un cliente hace la búsqueda en el plan… eso no es
// para nada eficiente» (26/09/2026). Y es literal: `leerTablero()` baja el tablero
// ENTERO —396 tareas y 71 proyectos en el ws9— y corre el cruce blando sobre todo,
// cada vez, para mostrar una o dos tarjetas. Medido: entre 0,5 y 9 segundos.
//
// ⚠️ LA CURA NO ES UN CACHÉ, ES LA CLAVE. Un caché del cruce guarda una RESPUESTA
// derivada y hay que decidir cuándo se ensucia (¿al crear una tarea? ¿al renombrar
// un proyecto? ¿al ganar un lead?), y el día que se ensucia sin que nadie lo note
// la ficha muestra trabajo que ya no es de ese cliente. `cliente_lead_id` (mig
// 0172) no es una respuesta guardada: es el DATO, y se consulta con un índice.
//
// Por eso la pantalla lee en dos tiempos, que es lo que se pidió:
//   1. `trabajoAsignado` → lo que TIENE dueño escrito. Dos consultas filtradas.
//   2. `trabajoDeCliente` → el cruce blando completo, que además propone lo que
//      todavía no está asignado. Llega después y se agrega abajo.

/** Lo que ya tiene dueño escrito, sin cruce y sin bajar el tablero entero. */
/** Las FILAS crudas del trabajo de un cliente, sin mapear a nada. */
export type FilasDeCliente = { dueno: boolean; proyectos: Record<string, unknown>[]; tareas: Record<string, unknown>[] };

/**
 * Todo lo que tiene el cliente escrito, en filas.
 *
 * ⚠️ DEVUELVE FILAS Y NO EL MODELO DE CUSTOMER SUCCESS porque tiene DOS consumidores con
 * formas distintas: la ficha (que las quiere como `TareaCS`) y el TABLERO embebido en la
 * página del cliente (que las quiere como `BoardTask`/`Tarea`, o sea la forma del board).
 * Mapear acá obligaría a des-mapear allá, que es cómo se pierde un campo.
 */
export async function filasDeCliente(leadId: number, forzado?: QueTablero): Promise<FilasDeCliente> {
  const db = await getTenantDb();
  const dueno = (forzado ?? await tableroActual()) === 'dueno';
  const tablaProy = dueno ? 'plan_proyectos' : 'tarea_categorias';
  const tablaTarea = dueno ? 'plan_tareas' : 'experimento_tareas';
  const col = dueno ? 'labels' : 'categorias';

  const { data: ps, error: e1 } = await db.from(tablaProy).select('*').eq('cliente_lead_id', leadId);
  if (e1) throw new Error(e1.message);
  const pids = (ps ?? []).map((p) => (dueno ? String((p as { id: unknown }).id) : Number((p as { id: unknown }).id)));

  // Las tareas suyas son las que lo declaran MÁS las de sus proyectos. Se piden por
  // separado y se funden por id: un `or` con `cs.` sobre jsonb se escribe mal una vez y
  // devuelve de más para siempre, y de más acá es el trabajo de otro cliente.
  const lotes = await Promise.all([
    db.from(tablaTarea).select('*').eq('cliente_lead_id', leadId),
    // JSON y no un array de JS: la columna es `jsonb` y el literal de Postgres la hace
    // fallar entera. Ver la nota larga en `lib/plan-board.ts`.
    ...pids.map((pid) => db.from(tablaTarea).select('*').contains(col, JSON.stringify([pid]))),
  ]);
  const filas = new Map<string, Record<string, unknown>>();
  for (const l of lotes) {
    if (l.error) throw new Error(l.error.message);
    for (const f of l.data ?? []) filas.set(String((f as { id: unknown }).id), f as Record<string, unknown>);
  }
  return { dueno, proyectos: (ps ?? []) as Record<string, unknown>[], tareas: [...filas.values()] };
}

export async function trabajoAsignado(leadId: number): Promise<ResultadoTrabajo> {
  try {
    const hoy = await hoyEnWorkspace();
    const { dueno, proyectos, tareas } = await filasDeCliente(leadId);
    return dueno
      ? armar(proyectos.map((p) => deBoardLabel(rowToLabel(p as Row))), tareas.map((f) => deBoardTask(rowToTask(f))), hoy)
      : armar(proyectos.map((p) => deCategoria(catRow(p))), tareas.map((f) => deTarea(rowTo(f))), hoy);
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * Le pone el `detalle` a un puñado de tarjetas, después de que el cruce decidió cuáles son.
 *
 * ⚠️ MUTA LOS OBJETOS QUE RECIBE, a propósito: ya están dentro de las listas que se van a
 * devolver y armar copias obligaría a rehacer los tres arrays y los dos índices que
 * apuntan a ellos. Es una función privada de este módulo y la mutación no sale de acá.
 */
async function ponerleTexto(proyectos: ProyectoCS[], tareas: TareaCS[], dueno: boolean): Promise<void> {
  if (!proyectos.length && !tareas.length) return;
  const db = await getTenantDb();
  const ids = (xs: Array<{ id: string }>) => (dueno ? xs.map((x) => x.id) : xs.map((x) => Number(x.id)));

  const [p, t] = await Promise.all([
    proyectos.length
      ? db.from(dueno ? 'plan_proyectos' : 'tarea_categorias').select('id, detalle').in('id', ids(proyectos) as string[])
      : Promise.resolve({ data: [], error: null }),
    tareas.length
      ? db.from(dueno ? 'plan_tareas' : 'experimento_tareas').select('id, detalle').in('id', ids(tareas) as string[])
      : Promise.resolve({ data: [], error: null }),
  ]);
  // Si falla, se sigue sin texto: la lista es correcta igual, y frenar la ficha entera
  // por el cuerpo de una tarjeta sería cambiar un hueco por una pantalla vacía.
  const mapa = (d: unknown) => new Map(((d ?? []) as Array<{ id: unknown; detalle: unknown }>)
    .map((r) => [String(r.id), typeof r.detalle === 'string' ? r.detalle : '']));
  const dp = mapa(p.data), dt = mapa(t.data);
  for (const x of proyectos) x.detalle = dp.get(x.id) ?? x.detalle;
  for (const x of tareas) x.detalle = dt.get(x.id) ?? x.detalle;
}

/** Arma el resultado con la MISMA forma que `trabajoDeCliente`, para que la pantalla
 *  no tenga que saber por cuál de los dos caminos llegó cada cosa. */
function armar(proys: ProyTab[], tars: TareaTab[], hoy: string): ResultadoTrabajo {
  const deCS = tars.map(aTareaCS);
  const porProyecto = new Map<string, TareaCS[]>();
  for (const t of deCS) for (const p of t.proyectos) porProyecto.set(p, [...(porProyecto.get(p) ?? []), t]);

  const proyectos: ProyectoCS[] = proys.map((p) => {
    const suyas = porProyecto.get(p.id) ?? [];
    return {
      id: p.id, nombre: p.nombre, emoji: p.emoji, color: p.color, detalle: p.detalle,
      deadline: p.deadline, quarter: p.quarter, score: p.score, scoreRazon: p.scoreRazon,
      como: 'clave' as const, ...contar(suyas, hoy),
    };
  });
  const orden = (a: TareaCS, b: TareaCS) =>
    Number(a.abierta === false) - Number(b.abierta === false) || b.score - a.score || a.titulo.localeCompare(b.titulo);
  return {
    ok: true,
    proyectos,
    tareas: deCS.filter((t) => !t.recurrente).sort(orden),
    recurrentes: deCS.filter((t) => t.recurrente).sort((a, b) => a.titulo.localeCompare(b.titulo)),
    huerfanos: [],
  };
}

// ── AUTO-ASIGNAR ─────────────────────────────────────────────────────────────

/**
 * Lo que MaKo puede decidir solo: qué proyectos y tareas son de qué cliente.
 *
 * ⚠️ DOS VÍAS Y SÓLO UNA LLEVA IA. El porqué, con los números medidos, está en el
 * encabezado de `lib/cs-autoasignar.ts`: el nombre del proyecto es determinista, y la
 * mención en un texto NO lo es — de las 43 tareas del ws9 que nombran a un cliente, las
 * que se ven son «probado con Mauricio» y «antes de que entre Leila», que lo mencionan
 * y no son trabajo para él.
 */
export async function autoasignar(forzado?: QueTablero): Promise<
  { ok: true; porNombre: number; porIA: number; consultadas: number; sinRespuesta: number } | { ok: false; error: string }
> {
  let lectura: Lectura;
  let clientes: ClienteCruce[];
  try {
    [lectura, clientes] = await Promise.all([leerTablero(forzado), clientesGanados()]);
  } catch (e) { return { ok: false, error: mensaje(e) }; }
  if (!clientes.length) return { ok: true, porNombre: 0, porIA: 0, consultadas: 0, sinRespuesta: 0 };

  const { planDeAsignacion, SYSTEM_JUEZ, userJuez, leerVeredicto } = await import('@/lib/cs-autoasignar');
  const plan = planDeAsignacion(
    clientes,
    lectura.proyectos.map((p) => ({ id: p.id, nombre: p.nombre, titulo: p.nombre, detalle: p.detalle, clienteLeadId: p.clienteLeadId })),
    lectura.tareas.map((t) => ({ id: t.id, titulo: t.titulo, detalle: t.detalle, proyectos: t.proyectos, clienteLeadId: t.clienteLeadId })),
    lectura.esDeCliente,
  );

  const escribir = async (xs: Array<{ id: string; tipo: 'proyecto' | 'tarea'; leadId: number; cliente: string }>) => {
    // Agrupado por cliente: una escritura por lead en vez de una por tarjeta.
    const porLead = new Map<number, { nombre: string; proyectos: string[]; tareas: string[] }>();
    for (const a of xs) {
      const g = porLead.get(a.leadId) ?? { nombre: a.cliente, proyectos: [], tareas: [] };
      (a.tipo === 'proyecto' ? g.proyectos : g.tareas).push(a.id);
      porLead.set(a.leadId, g);
    }
    for (const [leadId, g] of porLead) {
      const r = await asignarTrabajo({ proyectos: g.proyectos, tareas: g.tareas }, { leadId, nombre: g.nombre }, forzado);
      if (!r.ok) throw new Error(r.error);
    }
    return xs.length;
  };

  const porNombre = await escribir(plan.asignar);

  // ⚠️ SI NO HAY DUDAS NO SE LLAMA AL MODELO. Es el caso normal (ws11 y ws13 dieron 1 y 0)
  // y una llamada con la lista vacía cuesta plata y devuelve nada.
  if (!plan.dudas.length) return { ok: true, porNombre, porIA: 0, consultadas: 0, sinRespuesta: 0 };

  const { chatCheapCascade, CASCADA_DOCS } = await import('@/lib/ai-cheap');
  let porIA = 0;
  // ⚠️ «NO PUDE PREGUNTARLE» NO ES «NINGUNA ES SUYA», y ese fue MI error, no el del
  // modelo. La primera corrida reportó «0 de 43 que juzgó MaKo» y se leyó como un juicio
  // prolijo; la cascada había devuelto la cadena VACÍA —Groq no valida el JSON de este
  // prompt y el modelo gratis de OpenRouter dejó de existir— y `leerVeredicto('')` es `[]`.
  // Un fallo de lectura convertido en un veredicto, que es exactamente la falla que este
  // repo tiene documentada seis veces. Ahora se cuenta aparte y la pantalla lo dice.
  let sinRespuesta = 0;
  // De a 12: un lote más grande hace que el modelo empiece a contestar por patrón («las
  // que nombran a X son de X»), que es exactamente lo que se le está pidiendo que NO haga.
  for (let i = 0; i < plan.dudas.length; i += 12) {
    const lote = plan.dudas.slice(i, i + 12);
    try {
      // ⚠️ `CASCADA_DOCS` Y NO EL DEFAULT: el default arranca por Groq, que con este
      // prompt contesta «Failed to validate JSON» y arrastra a toda la fila. Gemini
      // primero es además lo que dice el registro para esta feature.
      const crudo = await chatCheapCascade({
        system: SYSTEM_JUEZ, user: userJuez(lote), json: true, provs: CASCADA_DOCS,
        feature: 'cs-autoasignar', motivo: 'de quién es este trabajo', maxTokens: 500,
      });
      if (!crudo.trim()) { sinRespuesta += lote.length; continue; }
      porIA += await escribir(leerVeredicto(crudo, lote));
    } catch {
      // Un lote que falla no frena a los demás ni tira lo ya escrito. Y se CUENTA: sin
      // eso, «no pude preguntar» y «pregunté y dijo que no» son el mismo número.
      sinRespuesta += lote.length;
    }
  }
  return { ok: true, porNombre, porIA, consultadas: plan.dudas.length, sinRespuesta };
}
