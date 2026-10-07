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

// ⚠️ ACÁ HUBO MÁS: `trabajoDeCliente`, `trabajoAsignado`, `filasDeCliente`, `catalogoAsignable`
// y sus tipos (`ProyectoCS`, `TrabajoCliente`, `ResultadoTrabajo`, `Asignable`, `Catalogo`).
// Quedaron sin un solo call site el 27/09/2026, al sacar el botón «Asignarle trabajo» y pasar la
// ficha a leer las filas con el HTML (`filasDeTodos`), y se borraron el 06/10/2026. Lo que vive
// es lo que usan la pantalla y MaKo: `tableroDeLaCartera` (la grilla), `filasDeTodos` (la
// ficha), `autoasignar` + `asignarTrabajo` (el botón de MaKo) y `clientesGanados`. El
// compilador es el guard: si algo de lo borrado volviera a hacer falta, `tsc` lo nombra.

/** Una tarea del tablero, recortada a lo que el CRUCE cuenta. No lleva historial ni fuente
 *  (no se leen acá y son la mitad del peso). */
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

/** Un proyecto «Cliente: …» que no cruzó con nadie de la cartera. No se esconde. */
export type ProyectoHuerfano = { id: string; nombre: string; abiertas: number; recurrentes: number; atrasadas: number };

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
const COLS_PROY_PLAN = 'id, pid, emoji, name, color, score, deadline, quarter, recurrente, recurrencia, cliente_lead_id, cliente_nombre, portada, orden';
const COLS_TAREA_CLIENTE = 'id, titulo, estado, prioridad, progreso, score, deadline, quarter, categorias, recurrente, recurrencia, cliente_lead_id, cliente_nombre, responsable, updated_at, created_at';
const COLS_PROY_CLIENTE = 'id, emoji, nombre, color, prioridad, deadline, quarter, recurrente, recurrencia, cliente_lead_id, cliente_nombre, portada, created_at';

// Las cuatro conversiones, una por tabla. Eran funciones sueltas para que las compartiera
// una segunda lectura (`trabajoAsignado`, borrada el 06/10/2026 por no tener call site); si
// vuelve a hacer falta otra, usa éstas — una copia aparte es un campo nuevo que se olvida.
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
  // `tableroDeLaCartera` las cuenta por `clienteLeadId`.
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
 *
 * ⚠️ `forzado` LO PASA MaKo (lib/api-mako/areas/cs.run.ts), no la pantalla. Por WhatsApp no
 * hay sesión que preguntarle a `tableroActual()`: sin decir cuál, el super-admin leería
 * `experimento_tareas` de su workspace —cero filas— y MaKo contestaría «0 atrasadas» para
 * todos sus clientes. MaKo lo decide por la CAPA del workspace del canal
 * (`tableroDeCapa`, lib/tablero-de-capa.ts), igual que el resto de la API; corre adentro de
 * `runWithWorkspace(ctx.ws)`, así que no puede leer el tablero de otro inquilino.
 */
export async function tableroDeLaCartera(clientes: ClienteCruce[], forzado?: QueTablero): Promise<TableroCartera> {
  let lectura: Lectura;
  try { lectura = await leerTablero(forzado); }
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

/**
 * El trabajo de UN cliente, YA MAPEADO al modelo del tablero.
 *
 * ⚠️ MAPEADO ACÁ Y NO EN LA PANTALLA. `FichaCliente` es `'use client'`, y los mappers
 * (`rowToTask`, `catRow`…) viven en `lib/plan-board.ts` y `lib/todo.ts`, que son
 * `server-only`: importarlos desde un componente de navegador arrastra su grafo ENTERO al
 * bundle —`ai-cheap`, `anthropic`, `getTenantDb`— y rompe el build. Pasó al escribir esto,
 * y AGENTS.md lo tiene documentado con todas las letras.
 *
 * Los TIPOS sí viajan gratis: `import type` se borra en compilación.
 */
export type TrabajoDeCliente =
  | { dueno: true; tareas: BoardTask[]; proyectos: Label[] }
  | { dueno: false; tareas: Tarea[]; categorias: Categoria[] };

/** Las FILAS crudas de un cliente, antes de mapearlas al modelo del tablero. */
type FilasCrudas = { proyectos: Record<string, unknown>[]; tareas: Record<string, unknown>[] };

/**
 * EL TRABAJO DE TODOS LOS CLIENTES, EN UNA PASADA, para que la grilla lo baje con su HTML.
 *
 * ⚠️ EXISTE PARA QUE EL MODAL NO TENGA ESTADO DE CARGA. «Sigue diciendo Leyendo lo suyo»
 * se reportó dos veces, y las dos veces lo ataqué por el lado de la velocidad: primero
 * partiendo la lectura en dos (1.284 ms contra 13.604), después sacándole el texto largo
 * al cruce (54 KB contra 2.105). Las dos mejoras eran reales y el síntoma no se movió,
 * porque un modal que pide sus datos AL ABRIRSE tiene un estado de carga por más rápida
 * que sea la consulta. Lo único que lo saca es que los datos ya estén.
 *
 * ⚠️ Y ES UNA PASADA, NO UNA POR CLIENTE. Leer cliente por cliente (lo que hacía la
 * `filasDeCliente` borrada) eran 22 consultas para 14 clientes (una por cliente más una por
 * proyecto suyo); acá son 2 + una por proyecto
 * ASIGNADO, que hoy son 8 en el workspace más grande. Medido el 26/09/2026: 515 KB y
 * ~1,8 s para los 14 clientes del ws1, 78 KB y ~0,6 s para los 3 del ws9.
 *
 * El costo se paga UNA vez al entrar a la grilla, en vez de cada vez que se abre una
 * tarjeta. Abrir un cliente es lo que se hace todo el tiempo; entrar, una sola.
 */
export async function filasDeTodos(): Promise<{ dueno: boolean; porCliente: Record<number, TrabajoDeCliente> }> {
  const db = await getTenantDb();
  const dueno = (await tableroActual()) === 'dueno';
  const tablaProy = dueno ? 'plan_proyectos' : 'tarea_categorias';
  const tablaTarea = dueno ? 'plan_tareas' : 'experimento_tareas';
  const col = dueno ? 'labels' : 'categorias';

  const [ps, ts] = await Promise.all([
    db.from(tablaProy).select('*').not('cliente_lead_id', 'is', null),
    db.from(tablaTarea).select('*').not('cliente_lead_id', 'is', null),
  ]);
  if (ps.error) throw new Error(`${tablaProy}: ${ps.error.message}`);
  if (ts.error) throw new Error(`${tablaTarea}: ${ts.error.message}`);

  const lead = (r: unknown) => Number((r as { cliente_lead_id: unknown }).cliente_lead_id);
  const porCliente: Record<number, FilasCrudas> = {};
  const caja = (id: number) => (porCliente[id] ??= { proyectos: [], tareas: [] });
  // Por cliente y por id, para que una tarea que está en su proyecto Y declara al cliente
  // no entre dos veces.
  const vistas = new Map<number, Set<string>>();
  const sumarTarea = (id: number, f: Record<string, unknown>) => {
    const s = vistas.get(id) ?? new Set<string>();
    const k = String(f.id);
    if (s.has(k)) return;
    s.add(k); vistas.set(id, s);
    caja(id).tareas.push(f);
  };

  for (const p of ps.data ?? []) caja(lead(p)).proyectos.push(p as Record<string, unknown>);
  for (const t of ts.data ?? []) sumarTarea(lead(t), t as Record<string, unknown>);

  // Las tareas de cada proyecto asignado. JSON y no un array de JS: la columna es `jsonb`
  // y el literal de Postgres hace fallar la consulta entera (ver `lib/plan-board.ts`).
  const deProyectos = await Promise.all((ps.data ?? []).map(async (p) => {
    const raw = (p as { id: unknown }).id;
    const pid = dueno ? String(raw) : Number(raw);
    const r = await db.from(tablaTarea).select('*').contains(col, JSON.stringify([pid]));
    if (r.error) throw new Error(`${tablaTarea}: ${r.error.message}`);
    return { leadId: lead(p), filas: (r.data ?? []) as Record<string, unknown>[] };
  }));
  for (const { leadId, filas } of deProyectos) for (const f of filas) sumarTarea(leadId, f);

  const mapeado: Record<number, TrabajoDeCliente> = {};
  for (const [id, x] of Object.entries(porCliente)) {
    mapeado[Number(id)] = dueno
      ? { dueno: true, tareas: x.tareas.map((f) => rowToTask(f as Row)), proyectos: x.proyectos.map((p) => rowToLabel(p as Row)) }
      : { dueno: false, tareas: x.tareas.map((f) => rowTo(f)), categorias: x.proyectos.map((p) => catRow(p)) };
  }
  return { dueno, porCliente: mapeado };
}
