// =============================================================================
// plan-recurrentes-generar — la plantilla PRODUCE su instancia (#813)
// =============================================================================
// «Es una tarea recurrente que es algo que vos tenés que hacer. Se agrega, es parte de
// tus tareas. Y que sea una tarea que se crea cada cierto tiempo» (Martín, 25/09/2026).
//
// La plantilla (una tarea con `recurrente = true` y su RRULE) no se completa: cuando
// toca, nace una tarea NORMAL con su fecha, que compite en el ranking y sí se completa.
// El modelo y por qué la FK lleva el workspace están en la mig 0185; el cálculo de la
// fecha, en `plan-recurrentes-fechas.ts`, sin base y con sus tests.
//
// ── LAS TRES DECISIONES QUE GOBIERNAN ESTO ──────────────────────────────────
//
// 1. UNA INSTANCIA ABIERTA POR VEZ. Si la del miércoles pasado sigue sin hacerse, el
//    miércoles que viene NO nace otra. Doce «grabar contenido» apiladas son exactamente
//    el tablero que nadie mira que la feature vino a evitar — y el trabajo pendiente ya
//    está a la vista en la tarjeta que quedó abierta.
//
// 2. SE SALTEAN LAS PERDIDAS. Con el cron caído tres días, un «todos los días» crea UNA
//    y sigue en su grilla, no tres de golpe. Es la regla que AGENTS.md ya tiene escrita
//    para los horarios que se repiten, y acá se aplica sola: se genera sólo la ocurrencia
//    MÁS RECIENTE que ya venció.
//
// 3. NO SE CREA NADA HACIA ADELANTE. Una instancia nace el día que toca y ni un día
//    antes: el «Listo cuando» de la tarjeta dice «aparece sola cuando toca», y una tarea
//    que aparece con fecha futura vuelve a llenar el tablero de trabajo que todavía no es.
//
// ⚠️ Y EL CANDADO CONTRA DUPLICADOS ESTÁ EN LA BASE, no acá: el índice único parcial
// `(workspace_id, recurrente_de, deadline)` de la 0185. Por eso este código puede correr
// dos veces, en dos instancias del serverless, con un reintento en el medio, y no hay
// forma de que salgan dos tarjetas para el mismo miércoles. Un `select` + `insert` con la
// carrera en el medio es lo que ya se pagó con los avisos duplicados del 27/09.

import 'server-only';
import { wsEnContexto, getTenantDb, getWorkspaceActual } from './workspace';
import { hoyEnWorkspace } from './timezone';
import { getWorkspace } from './workspace';
import { tableroDeCapa, tablasDe } from './tablero-de-capa';
import { proximaFecha, queGenerar } from './plan-recurrentes-fechas';
import { recurrenciaDe, textoRepeticion } from './plan-recurrentes';
import { linkApp, APP_BASE_URL } from './app-url';

export type ResultadoGeneracion = {
  plantillas: number;
  creadas: number;
  /** ya tenían una instancia abierta: no se crea otra hasta que se cierre. */
  conAbierta: number;
  /** ocurrencias vencidas que se saltearon por la regla 2, en total. */
  salteadas: number;
  errores: number;
};

const VACIO: ResultadoGeneracion = { plantillas: 0, creadas: 0, conAbierta: 0, salteadas: 0, errores: 0 };

type Plantilla = {
  id: string | number;
  titulo: string;
  detalle: string;
  recurrencia: string | null;
  desde: string | null;
  labels: unknown;
  score: number;
  clienteLeadId: number | null;
  clienteNombre: string | null;
};

/**
 * Corre la generación del workspace ACTUAL. Devuelve el conteo, nunca tira: esto corre en
 * un cron que itera clientes, y un workspace con una fila rara no puede frenar al resto.
 *
 * ⚠️ VA ENVUELTO EN `runWithWorkspace` POR QUIEN LLAMA. `getTenantDb` scopea por el
 * workspace del contexto, y sin contexto el cron le crearía a Mauricio las instancias de
 * los rituales de todos.
 */
export async function generarRecurrentes(): Promise<ResultadoGeneracion> {
  const ws = await getWorkspaceActual();
  if (ws == null) {
    console.error('[recurrentes] sin workspace en contexto: no se genera nada');
    return VACIO;
  }
  const { tabla, esTexto } = await dondeViven(ws);
  const db = await getTenantDb();
  // El día del NEGOCIO, no el de la máquina. Un cron que corre a las 03:00 UTC está en
  // el día anterior para Tijuana, y la instancia del miércoles nacería el martes.
  const hoy = await hoyEnWorkspace();

  const { data, error } = await db.from(tabla)
    .select(COLUMNAS[tabla])
    .eq('recurrente', true);
  if (error) {
    console.error(`[recurrentes] ws=${ws}: no pude leer las plantillas (${error.message})`);
    return { ...VACIO, errores: 1 };
  }
  const plantillas = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => aPlantilla(r, tabla));
  const out: ResultadoGeneracion = { ...VACIO, plantillas: plantillas.length };

  for (const p of plantillas) {
    // «Se repite y nadie dijo cada cuánto» es un estado real y no se puede generar: sin
    // regla no hay fecha, y una inventada es peor que ninguna. No es un error.
    const rrule = recurrenciaDe({ recurrente: true, recurrencia: p.recurrencia });
    if (!rrule) continue;
    const ancla = p.desde ?? hoy;

    try {
      // Hasta dónde llegó la serie: la fecha de la última instancia que se creó. Si no
      // hay ninguna, el ancla — así la primera ocurrencia es la primera DESPUÉS de
      // arrancar la serie, y no el día mismo en que se creó la plantilla.
      // ⚠️ LA COLUMNA DEL AVANCE SE LLAMA DISTINTO EN CADA MITAD (`progress` en el
      // tablero del dueño, `progreso` en el del cliente) y NO se pueden pedir las dos:
      // PostgREST rechaza la consulta ENTERA si una no existe. Y el error no sube —
      // `data` vuelve `undefined`, las filas quedan en [], y con eso el generador cree
      // que la plantilla no tiene instancias: no ve la abierta y reintenta una fecha ya
      // creada. Lo tapaba el índice único de la 0185, que rebotaba el insert con 23505;
      // o sea que la prueba decía «no duplicó» y era cierto por la razón equivocada.
      // Lo delató el contador: `conAbierta: 0` sobre una plantilla que SÍ tenía una.
      const colAvance = esTexto ? 'progress' : 'progreso';
      const { data: hijas, error: eH } = await db.from(tabla)
        .select(`deadline, ${colAvance}`)
        .eq('recurrente_de', p.id);
      // Y el error se LEE. Sin esto, «no tiene instancias» y «no pude leerlas» son la
      // misma lista vacía, y la segunda hace que el generador trabaje sobre una foto
      // falsa del pasado de la plantilla.
      if (eH) throw new Error(`no pude leer las instancias: ${eH.message}`);
      const filas = (hijas ?? []) as unknown as Array<Record<string, unknown>>;
      const cursor = filas.map((h) => String(h.deadline ?? '')).filter(Boolean).sort().pop() ?? ancla;

      // LAS TRES REGLAS, en una función pura con sus tests (`queGenerar`). Acá queda
      // sólo lo que toca la base: la decisión no se puede probar si vive adentro de un
      // módulo con `server-only`.
      const q = queGenerar({ rrule, ancla, cursor, hayAbierta: filas.some((h) => avanceDe(h) < 100), hoy });
      out.salteadas += q.salteadas;
      // `=== null` y no `!q.crear`: con una union discriminada por `crear: string | null`,
      // el `!` no la angosta (un string vacio tambien es falsy) y el motivo no se puede
      // leer. Lo dice el compilador, y es la clase de linea que uno escribe en automatico.
      if (q.crear === null) { if (q.motivo === 'hay-una-abierta') out.conAbierta += 1; continue; }

      const fila = await nuevaInstancia(db, tabla, esTexto, p, q.crear, rrule, ws);
      if (fila === 'duplicada') continue;   // la creó otra corrida: el índice hizo su trabajo
      out.creadas += 1;
      console.log(`[recurrentes] ws=${ws} «${p.titulo.slice(0, 50)}» → instancia del ${q.crear}${q.salteadas ? ` (se saltearon ${q.salteadas} vencidas)` : ''}`);
    } catch (e) {
      out.errores += 1;
      console.error(`[recurrentes] ws=${ws} plantilla ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

/** CUÁNDO TOCA LA PRÓXIMA, para mostrarlo. Derivado del ancla y la regla: no hay columna
 *  que se pueda quedar vieja cuando alguien edita la frecuencia (ver la mig 0185). */
export const proximaDeLaPlantilla = (t: { recurrencia?: unknown; recurrenteDesde?: string | null }, hoy: string): string | null =>
  proximaFecha(t.recurrencia, hoy > (t.recurrenteDesde ?? hoy) ? hoy : (t.recurrenteDesde ?? hoy), t.recurrenteDesde ?? hoy);

// ── lo de la base ────────────────────────────────────────────────────────────

const COLUMNAS: Record<string, string> = {
  plan_tareas: 'id, title, detalle, recurrencia, recurrente_desde, labels, score, cliente_lead_id, cliente_nombre',
  experimento_tareas: 'id, titulo, detalle, recurrencia, recurrente_desde, categorias, score, cliente_lead_id, cliente_nombre',
};

/** Cuál de las dos mitades del tablero le toca a este workspace. Lo decide
 *  `tableroDeCapa`, que es donde se decide UNA vez para todo el producto. */
async function dondeViven(ws: number): Promise<{ tabla: 'plan_tareas' | 'experimento_tareas'; esTexto: boolean }> {
  // `tableroDeCapa` es la ÚNICA que decide esto en todo el producto, y decide por CAPA:
  // escribirlo acá a mano sería la segunda respuesta a la misma pregunta. Si la capa no
  // se puede leer cae a 'cliente', que es el caso normal (8 de los 9 workspaces).
  const capa = await getWorkspace(ws).then((w) => w?.capa ?? null).catch(() => null);
  const que = tableroDeCapa(capa);
  return { tabla: tablasDe(que).tareas as 'plan_tareas' | 'experimento_tareas', esTexto: que === 'dueno' };
}

/** El avance, que se llama distinto en cada mitad. */
const avanceDe = (h: Record<string, unknown>): number =>
  Number(h.progress ?? h.progreso ?? 0) || 0;

function aPlantilla(r: Record<string, unknown>, tabla: string): Plantilla {
  const esPlan = tabla === 'plan_tareas';
  return {
    id: (esPlan ? String(r.id) : Number(r.id)),
    titulo: String((esPlan ? r.title : r.titulo) ?? ''),
    detalle: String(r.detalle ?? ''),
    recurrencia: typeof r.recurrencia === 'string' ? r.recurrencia : null,
    desde: typeof r.recurrente_desde === 'string' ? r.recurrente_desde.slice(0, 10) : null,
    labels: esPlan ? r.labels : r.categorias,
    score: Number(r.score) || 50,
    clienteLeadId: r.cliente_lead_id == null ? null : Number(r.cliente_lead_id),
    clienteNombre: r.cliente_nombre == null ? null : String(r.cliente_nombre),
  };
}

/**
 * Crea la instancia. Devuelve `'duplicada'` si el índice único la rechazó — que NO es un
 * error: significa que otra corrida ya la creó, y es justamente para lo que está.
 *
 * ⚠️ LA INSTANCIA NACE `recurrente: false`. Es una tarea normal con fecha: compite, se
 * ordena y se completa. Heredar el flag la sacaría del ranking y la dejaría sin poder
 * cerrarse, o sea generaría una plantilla por semana en vez de una tarea.
 */
async function nuevaInstancia(
  db: Awaited<ReturnType<typeof getTenantDb>>,
  tabla: string, esTexto: boolean, p: Plantilla, fecha: string, rrule: string, ws: number,
): Promise<'ok' | 'duplicada'> {
  const ritmo = textoRepeticion(rrule);
  const comun = {
    detalle: p.detalle,
    deadline: fecha,
    score: p.score,
    score_razon: `Toca hoy: ${ritmo ? ritmo.toLowerCase() : 'se repite'}.`,
    recurrente: false,
    recurrente_de: p.id,
    cliente_lead_id: p.clienteLeadId,
    cliente_nombre: p.clienteNombre,
    // DE DÓNDE SALIÓ, con el chip que la pantalla ya sabe dibujar y el link a la
    // plantilla. Es lo que evita que la instancia se lea como una tarea que alguien
    // creó a mano y que nadie entienda por qué vuelve cada semana.
    fuente: { tipo: 'recurrente', etiqueta: ritmo ?? 'Se repite', url: linkApp(`/plan?tarea=${encodeURIComponent(String(p.id))}`, wsEnContexto()) },
    historial: [{ id: `h${Date.now().toString(36)}`, ts: Date.now(), actor: 'ia', text: `MaKo la creó desde «${p.titulo.slice(0, 60)}», que ${ritmo ? ritmo.toLowerCase() : 'se repite'}` }],
  };
  // ⚠️ LAS DOS MITADES NI SIQUIERA COMPARTEN LOS NOMBRES DE LAS COLUMNAS (`title` contra
  // `titulo`, `labels` contra `categorias`, `progress` contra `progreso`), así que son dos
  // objetos distintos y no uno con campos opcionales. El `Record<string, unknown>` es
  // porque supabase-js infiere el tipo del PRIMER literal de una unión y rechaza al otro
  // por «propiedades de más»; la forma la garantizan estas dos líneas, que se leen juntas.
  const fila: Record<string, unknown> = esTexto
    ? { ...comun, workspace_id: ws, id: `rec${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: p.titulo, labels: p.labels ?? [], progress: 0 }
    : { ...comun, titulo: p.titulo, categorias: p.labels ?? [], progreso: 0, estado: 'por_hacer', prioridad: 'media' };

  const { error } = await db.from(tabla).insert(fila);
  if (!error) return 'ok';
  // 23505 = unique_violation. El índice de la 0185 hizo exactamente lo que tiene que hacer.
  if (String(error.code) === '23505') return 'duplicada';
  throw new Error(`insert: ${error.message}`);
}
