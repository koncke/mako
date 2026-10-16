import 'server-only';


// =============================================================================
// reunion-auto — las reuniones del equipo se leen SOLAS (ya no hay que apretar nada)
// =============================================================================
// Cae una grabación nueva en Fathom, MaKo la lee y saca los compromisos. Dos reglas
// que definen todo el comportamiento:
//
//   1) NO CREA NADA. Deja un BORRADOR pendiente (plan_propuestas). La próxima vez que
//      la persona entra a su plan le salta el modal y confirma. Nunca aparecen tareas
//      en el tablero que nadie aprobó.
//   2) EQUIPO Y ENTREGA. Una llamada de VENTAS deja tareas de seguimiento del lead y
//      no del plan, así que sigue descartada. Las de ENTREGA no: son las juntas con
//      un cliente ya ganado, y sus compromisos son justamente el trabajo que hay que
//      seguir. Entraban al mismo filtro que las de ventas y se tiraban enteras.
//
//      Y no hacía falta construirles un destino: `resolverClienteDeReunion` ya manda
//      sus tareas al proyecto «Cliente: X» (más abajo, ~66 líneas después del filtro
//      que impedía llegar hasta acá). El diagnóstico de que «el destino no existe»
//      era el equivocado: existía y era inalcanzable.
//
// Y avisa por WhatsApp al grupo de MaKo del workspace: "tuviste una reunión con X,
// salieron N tareas, te las dejé en el plan para que las confirmes".
//
// Corre por workspace (cron-workspaces con la integración 'fathom'), así que cada
// negocio lee SU Fathom con SU key y escribe en SU tablero.
// =============================================================================

import { listReunionesRecientes, extraerTareasDeReunion, cacheKeyReunion, ROL_CONSULTOR, ROL_DESCONOCIDO, type ProyectoRef, type ReunionMeta, type Yo } from './plan-fathom';
import { crearPropuesta, existePropuestaRef, type PropuestaTarea } from './plan-propuesta';
import { criterioDelWorkspace } from './plan-criterio';
import { juzgarConCriterio, type SalidaJuez } from './plan-criterio-juez';
import { normCita, type Veredicto } from './plan-criterio-reglas';
import { glosarioTexto } from './glosario';
import { getSetting, setSetting } from './settings';
import { emitirDelCatalogo } from './avisos';
import { listarUsuarios } from './usuarios';
import { emailsConCuenta, repartoDeTarea, cuantasSonMias, resumenDelReparto } from './reunion-reparto';
import { wsEnContexto, getWorkspace } from './workspace';
import { zonaDelNegocio } from './timezone';
import { fechaHoraEnTz } from './date-utils';
import { listPlanBoard } from './plan-board';
import { listCategorias } from './todo';
import { resolverClienteDeReunion, nombreDeProyectoPara } from './reunion-cliente';
import type { TipoReunion } from './reunion-clasificar';
import { linkApp, APP_BASE_URL as APP_URL } from './app-url';
import { tableroDeCapa } from './tablero-de-capa';
import { cruzarBorrador } from './reunion-cruce';
import { registrarDescartadas, registrarNoLeida } from './reunion-descartadas';
import { tomarLectura, soltarLectura } from './reunion-leyendo';

/**
 * Marca que YA miramos esta grabación, sin importar si dejó tareas o no.
 * El candado no puede ser solo "existe el borrador": una reunión que no dejó ningún
 * compromiso no genera borrador, así que sin esta marca el cron la volvía a leer
 * ENTERA cada hora durante toda la ventana (medido: una corrida se comió la cuota
 * gratis de Gemini y cayó a Claude, US$0,26 para devolver cero tareas).
 */
/** Qué tipos de reunión llegan al plan.
 *
 *  'ventas' NO entra: sus compromisos son seguimiento del LEAD (los maneja el CRM),
 *  no trabajo del plan de ejecución. 'otra' tampoco: por definición no se sabe qué es.
 *  'entrega' sí, y es el arreglo: son las juntas con un cliente ya ganado, sus
 *  compromisos son el trabajo, y `resolverClienteDeReunion` ya las archiva solas en
 *  el proyecto «Cliente: X». Estaban cayendo en el mismo filtro que las de ventas. */
const TIPOS_AL_PLAN: readonly TipoReunion[] = ['equipo', 'entrega'];

const KEY_VISTA = (recordingId: number): string => `mako.reunion.auto.${recordingId}`;

/** Una reunión ya procesada en esta corrida (para redactar el aviso al final). */
type ReunionHecha = { titulo: string; fecha: string | null; conQuien: string; mias: number; otras: number;
  /**
   * Cuántas dejó AFUERA el criterio (descartadas + acuerdos internos), que llegan al
   * borrador destildadas y con su razón.
   *
   * ⚠️ VIAJA HASTA EL MENSAJE Y SE DICE. El aviso contaba sólo lo tildado, así que un
   * criterio que descarta 32 de 40 manda «sacé 8 compromisos tuyos» — y nadie abre un
   * modal por 8. Las 32 quedaban «auditables» en una pantalla que nadie iba a abrir, que
   * es justo lo contrario de lo que la tercera cubeta viene a hacer.
   */
  descartadas?: number;
  partesFallidas?: number; recordingId: number; propId: string };

/**
 * El mensaje al grupo. Dos formas: una reunión (frase suelta) o varias (viñetas con
 * fecha y hora). Tope de 4 viñetas para que no sea un ladrillo en el teléfono.
 *
 * REGLA: el número grande es el de TAREAS PROPIAS, porque es exactamente el que va a
 * ver en el botón "Agregar N al plan". Las de los demás se mencionan aparte y no se
 * suman: si no, el mensaje promete más de lo que la pantalla muestra.
 */
export type { ReunionHecha };
/** Exportada para poder REENVIAR el aviso de una reunión ya leída sin re-analizarla
 *  (scripts/reavisar-reunion.mts). El mensaje tiene que ser el MISMO que manda el cron:
 *  copiarlo en el script sería la segunda copia que se queda vieja. */
export function textoAviso(hechas: ReunionHecha[], tz: string): string {
  // EL LINK ES EL DE LA REVISIÓN DE ESE BORRADOR — `/plan/revisar/<id>`, el mismo
  // formato con el que MaKo manda cualquier otro borrador. Antes iba a `/plan` a secas:
  // del otro lado te dejaba parado en el tablero esperando que saltara solo un modal
  // —que con varias reuniones las mezcla, y si ya no te queda nada tuyo no salta—, así
  // que el mensaje prometía una revisión y el link no llevaba a ninguna. Con VARIAS,
  // cada reunión lleva el suyo en su viñeta: son borradores distintos y cada uno se
  // confirma por separado.
  const linkDe = (h: ReunionHecha) => linkApp(`/plan/revisar/${h.propId}`, wsEnContexto());
  const totalMias = hechas.reduce((s, h) => s + h.mias, 0);
  const totalOtras = hechas.reduce((s, h) => s + h.otras, 0);
  const tuyas = `*${totalMias} ${totalMias === 1 ? 'tarea tuya' : 'tareas tuyas'}*`;
  const deOtros = totalOtras > 0 ? ` (y ${totalOtras} de los demás, para repartir)` : '';
  // LO QUE EL CRITERIO DEJÓ AFUERA, dicho. No es un detalle técnico: es la única señal
  // de que hay algo que revisar. Sin esto, «sacé 8» sobre una reunión de 40 se lee como
  // una reunión chica y las otras 32 no las mira nadie.
  const totalFuera = hechas.reduce((s, h) => s + (h.descartadas ?? 0), 0);
  const dejadas = totalFuera > 0
    ? `\n\nOtras ${totalFuera} no las cargué porque tu criterio las deja afuera. Están ahí, destildadas y con el motivo, por si me equivoqué.`
    : '';

  // `partesFallidas` viajaba hasta acá dentro de `ReunionHecha` y NO SE USABA: el aviso
  // decía «saqué N tareas tuyas» con el mismo tono hubiera leído la reunión entera o la
  // mitad. Un aviso que no distingue las dos cosas es peor que no avisar, porque el dueño
  // la da por cerrada. Ahora lo dice, y dice qué va a pasar.
  const cojas = hechas.filter((h) => (h.partesFallidas ?? 0) > 0);
  const aviso = cojas.length
    ? `\n\n⚠️ ${cojas.length === 1 ? 'Una parte de la reunión no la pude leer' : `No pude leer algunos tramos de ${cojas.length} reuniones`} — puede faltar contenido. La dejo abierta y lo reintento solo.`
    : '';

  if (hechas.length === 1) {
    const h = hechas[0];
    const cuando = fechaHoraEnTz(h.fecha, tz);
    return `📝 Leí tu reunión${h.conQuien ? ` con *${h.conQuien}*` : ''}${h.titulo ? ` — *${h.titulo}*` : ''}${cuando ? `\n🗓️ ${cuando}` : ''}\n\nSaqué ${tuyas}${deOtros} y te las dejé en el plan para que las confirmes:\n${linkDe(h)}${dejadas}${aviso}\n\nEntras, revisas y con un toque quedan cargadas. — MaKo`;
  }

  const filas = hechas.slice(0, 4).map((h) => {
    const cuando = fechaHoraEnTz(h.fecha, tz);
    return `• *${h.titulo || 'Reunión'}*${cuando ? ` — ${cuando}` : ''}\n   ${h.mias} ${h.mias === 1 ? 'tarea tuya' : 'tuyas'}${h.otras ? ` · ${h.otras} de otros` : ''}\n   ${linkDe(h)}`;
  });
  const resto = hechas.length > 4 ? `\n…y ${hechas.length - 4} ${hechas.length - 4 === 1 ? 'reunión más' : 'reuniones más'}.` : '';
  return `📝 Leí tus *${hechas.length} reuniones* nuevas:\n\n${filas.join('\n\n')}${resto}\n\nEn total ${tuyas}${deOtros}. Cada una se revisa en su propio link, ahí arriba.${dejadas}${aviso}\n\nEntras, revisas y con un toque quedan cargadas. — MaKo`;
}

export type ResultadoReunionesAuto = {
  /** Las que entran al plan: equipo + entrega. Se llamaba `deEquipo`, y al sumar
   *  las de entrega el log decía «equipo=4» contando reuniones con clientes. Un
   *  nombre que miente cuesta el próximo diagnóstico. */
  miradas: number; alPlan: number; nuevas: number; conTareas: number; tareas: number; errores: number;
  /** avisos que SÍ salieron por WhatsApp, y el motivo del último que no. El borrador
   *  igual queda esperando en el plan: el aviso es el empujón, no el canal de la tarea. */
  avisados: number; sinAviso: number; avisoError?: string;
  /** Reuniones que no se intentaron porque no entraban en el reloj de esta corrida.
   *  Quedan SIN candado: la próxima las agarra. Se cuentan porque «no entró» y «no
   *  había» son respuestas distintas. */
  sinTiempo?: number;
  /** Las que otro ya estaba leyendo (el webhook, el botón del modal): se saltean sin pagar dos veces. */
  enCurso?: number;
  /** Los descartes por tipo que quedaron ANOTADOS (mig 0296). `null` = no se pudieron escribir. */
  descartadasAnotadas?: number | null;
  /** Borradores nuevos que salieron ya cruzados contra el tablero (sellados). */
  cruzados?: number;
};

/**
 * Proyectos del tablero de ESTE workspace: el rico (plan_tareas) es SOLO del
 * super-admin; el resto usa el suyo. Misma regla que aplicarPropuesta — si acá se
 * eligiera mal, las tareas saldrían con proyectos de un tablero que no es el que
 * después las recibe.
 */
/**
 * Por que el criterio puso esta tarea donde la puso, para que se LEA en la revision.
 *
 * Lleva la cita siempre que haya: la regla 5 del criterio dice que un compromiso que
 * no se puede citar no existe, y al reves, una tarea descartada con su frase al lado
 * es la unica forma de que la persona pueda desmentir al juez sin volver a la
 * grabacion. Es literalmente lo que el criterio pide de la tercera cubeta: «se
 * registra con la regla que lo excluyo y con su cita, para que la decision sea
 * auditable».
 */
function porQueDelVeredicto(v: Veredicto): string {
  const cabeza = v.cubeta === 'compromiso'
    ? 'Compromiso'
    : v.cubeta === 'acuerdo_interno'
      ? 'Acuerdo entre los otros: no es un compromiso tuyo'
      : `Descartada${v.regla ? ` por la regla ${v.regla}` : ''}`;
  return [
    `${cabeza}${v.razon ? ` — ${v.razon}` : ''}`,
    v.cita ? `«${v.cita}»` : '',
  ].filter(Boolean).join('\n');
}

/**
 * El dueño DEL TABLERO, como lo nombra el criterio.
 *
 * ⚠️ NO es `resolverYo`. Esa resuelve al HOST de la reunión y cae a su nombre de
 * Fathom cuando no tiene cuenta acá: en una sesión grabada por el cliente, el juez
 * recibiría al CLIENTE como dueño del tablero y clasificaría al revés toda la
 * reunión — la regla 4 del criterio es, entera, «¿el dueño es parte?».
 */
async function duenoDelTablero(ws: number, yo: Yo): Promise<string> {
  const usuarios = await listarUsuarios().catch(() => []);
  const admin = usuarios.find((u) => u.workspace_id === ws && u.estado !== 'suspendido' && u.rol_ws === 'admin');
  return (admin?.nombre || yo.nombre || '').trim() || 'el dueño del tablero';
}

async function proyectosDelWorkspace(ws: number): Promise<ProyectoRef[]> {
  const usaPlanBoard = tableroDeCapa((await getWorkspace(ws))?.capa) === 'dueno';
  if (usaPlanBoard) {
    const b = await listPlanBoard().catch(() => ({ proyectos: [] as Array<{ id: string; emoji: string; name: string }> }));
    return b.proyectos.map((p) => ({ id: p.id, emoji: p.emoji, nombre: p.name }));
  }
  const cats = await listCategorias().catch(() => [] as Array<{ id: number; emoji: string; nombre: string }>);
  return cats.map((c) => ({ id: String(c.id), emoji: c.emoji, nombre: c.nombre }));
}

/**
 * De quién es el plan al que van estas tareas: el que GRABÓ la reunión. Si su email
 * tiene cuenta en este workspace usamos su nombre real; si no, el que dijo Fathom.
 * Último recurso: el admin del workspace (alguien tiene que ser el "yo" del reparto).
 */
async function resolverYo(r: ReunionMeta, ws: number): Promise<Yo> {
  const usuarios = await listarUsuarios().catch(() => []);
  const delWs = usuarios.filter((u) => u.workspace_id === ws && u.estado !== 'suspendido');
  const host = r.host?.email ?? '';
  const cuenta = host ? delWs.find((u) => u.email.trim().toLowerCase() === host) : undefined;
  if (cuenta) return { nombre: cuenta.nombre || r.host?.nombre || '', email: cuenta.email };
  if (host) return { nombre: r.host?.nombre ?? '', email: host };
  const admin = delWs.find((u) => u.rol_ws === 'admin') ?? delWs[0];
  return { nombre: admin?.nombre ?? '', email: admin?.email ?? '' };
}

/**
 * Lee las reuniones de equipo NUEVAS del workspace actual y deja un borrador por cada
 * una. `horas` = ventana hacia atrás (el cron corre seguido y el candado por `ref`
 * evita re-analizar). `max` = tope de reuniones por corrida (cada una es un análisis
 * caro sobre el transcript completo).
 */
/**
 * `soloRecording` (16/10/2026): el webhook de Fathom avisa que terminó UNA reunión; se procesa ésa
 * y no se re-mira el resto de la ventana (eso lo sigue haciendo el cron).
 */
export async function procesarReunionesNuevas(ws: number, opts: { horas?: number; max?: number; hasta?: number; soloRecording?: number } = {}): Promise<ResultadoReunionesAuto> {
  const horas = opts.horas ?? 26;
  const max = opts.max ?? 3;
  // ⚠️ EL RELOJ, Y NO ES DEFENSIVO: SIN ÉL LA FUNCIÓN SE MUERE A MITAD Y NO ESCRIBE NADA.
  //
  // Una reunión con criterio son el extractor (~36 s medidos) más TRES corridas del juez
  // capadas en 120 s cada una (`lib/anthropic.ts`), o sea hasta ~396 s contra el
  // `maxDuration = 300` del cron. Cuando Vercel mata la función en el medio, la muerte
  // cae ANTES de `crearPropuesta` y antes del candado: la próxima corrida vuelve a
  // extraer la MISMA reunión entera, y el cron corre 13 veces por día. Una reunión
  // atascada se come el extractor completo y ~40 llamadas del juez por día, para
  // siempre, sin producir una sola tarjeta.
  //
  // Con el reloj, lo que no entra no se intenta: queda sin candado y la próxima corrida
  // lo agarra. Perder una reunión hasta la corrida siguiente es barato; el bucle no.
  const hasta = opts.hasta ?? Number.MAX_SAFE_INTEGER;
  /** Lo que hay que tener libre para animarse a UNA reunión: el extractor y, si este
   *  workspace juzga, al menos una corrida del juez. Medido, no estimado: 120 s es el
   *  cap duro de una llamada y ~60 s es lo que midió el extractor en una de 2 h. */
  const ENTRA_UNA_MS = 180_000;
  let sinTiempo = 0;
  const out: ResultadoReunionesAuto = { miradas: 0, alPlan: 0, nuevas: 0, conTareas: 0, tareas: 0, errores: 0, avisados: 0, sinAviso: 0 };

  // La ventana va por `created_after` (CUÁNDO APARECIÓ la grabación en Fathom), no por
  // la fecha de la reunión: el disparador es "cayó una grabación nueva", y una charla
  // de ayer que se sube hoy también es nueva para el plan.
  //
  // Y hay un motivo duro: `recorded_after` la API LO IGNORA (probado — devuelve las
  // mismas 10 reuniones con y sin el parámetro). Con eso la "ventana de 26h" nunca
  // existió: el cron levantaba reuniones de hace tres semanas y las anunciaba como
  // nuevas. `created_after` sí filtra de verdad.
  const desde = new Date(Date.now() - horas * 3600_000).toISOString();
  const { reuniones: todas } = await listReunionesRecientes({ limit: 20, createdAfter: desde });
  const reuniones = opts.soloRecording != null ? todas.filter((r) => r.recordingId === opts.soloRecording) : todas;
  out.miradas = reuniones.length;

  const aProcesar = reuniones.filter((r) => TIPOS_AL_PLAN.includes(r.tipo));
  out.alPlan = aProcesar.length;
  // Las que quedan afuera se descartan — pero SE DICE CUÁLES y por qué. El log solo
  // imprimía el total (`equipo=0`), así que una reunión de trabajo mal clasificada
  // desaparecía sin dejar rastro y no había forma de notarlo.
  const descartadas = reuniones.filter((r) => !TIPOS_AL_PLAN.includes(r.tipo));
  if (descartadas.length) {
    console.log(`[reunion-auto] ws=${ws} descarté ${descartadas.length} reunión(es) por tipo: ` +
      descartadas.map((r) => `${r.recordingId} «${r.titulo}» → ${r.tipo}`).join(' · '));
    // ⚠️ Y QUEDAN ESCRITAS (mig 0296, 16/10/2026). El log de arriba era el ÚNICO rastro, y en el log
    // de Vercel no las busca nadie. Ahora el modal de Fathom las lista con su motivo y «Leer igual».
    // Best-effort: no poder anotarlas no frena las que sí hay que leer. (Y ojo: medido en el ws1 del
    // 08 al 15/10, el clasificador no descartó NINGUNA; las que desaparecieron fallaron al leerse —
    // ver `registrarNoLeida` abajo.)
    out.descartadasAnotadas = await registrarDescartadas(descartadas);
  }
  if (!aProcesar.length) return out;

  const [proyectos, glosario] = await Promise.all([
    proyectosDelWorkspace(ws),
    glosarioTexto().catch(() => ''),
  ]);

  const hechas: ReunionHecha[] = [];
  let procesadas = 0;
  for (const r of aProcesar) {
    if (procesadas >= max) break;
    if (Date.now() + ENTRA_UNA_MS > hasta) {
      // Se cuentan y se dicen: «no entró en el reloj» y «no había reuniones» son
      // respuestas distintas, y la primera hay que poder verla para saber si el cron
      // necesita correr más seguido o el tope de reuniones es muy alto.
      sinTiempo = aProcesar.length - procesadas;
      console.warn(`[reunion-auto] ws=${ws}: se acabó el reloj de esta corrida, ${sinTiempo} reunión(es) quedan para la próxima (sin candado, no se pierden)`);
      break;
    }
    const ref = `fathom:${r.recordingId}`;
    // Ya la vio: o dejó borrador, o la leímos y no había nada que anotar. En los dos
    // casos no se vuelve a gastar el análisis. (Ante un error de lectura, saltear:
    // mejor perderse una reunión que duplicarla o quemar tokens en loop.)
    if (await existePropuestaRef(ref, ws).catch(() => true)) continue;
    if (await getSetting(KEY_VISTA(r.recordingId)).catch(() => 'error')) continue;
    // EL CANDADO (16/10/2026): desde que el webhook y el botón del modal también leen, la misma
    // reunión puede estar leyéndose en otro lado AHORA. Se saltea sin pagar dos veces; si esa
    // lectura se murió, el candado vence solo y la próxima corrida la agarra.
    if (!(await tomarLectura(r.recordingId))) {
      out.enCurso = (out.enCurso ?? 0) + 1;
      console.log(`[reunion-auto] ws=${ws} recording=${r.recordingId}: ya la está leyendo otro (webhook o el modal) — la salteo`);
      continue;
    }
    out.nuevas += 1;
    procesadas += 1;
    try {
      const yo = await resolverYo(r, ws);
      // ¿QUÉ PAPEL JUEGA EL DUEÑO EN ESTA REUNIÓN? Sin decírselo, el prompt asume que es
      // el ASESORADO —«las recomendaciones son tareas del asesorado» es su regla más
      // fuerte— y en una reunión donde él es el consultor eso empuja para el lado
      // equivocado: 2h35 hablando en imperativo sobre acciones del otro, 6 tareas al
      // revés. La única señal DURA es que la reunión resuelva a un cliente del workspace:
      // si el otro es cliente suyo, él es el proveedor. Cuando no se sabe se manda «no lo
      // sé» y el modelo decide caso por caso, que es mejor que una etiqueta inventada.
      const clienteDeLaReunion = await resolverClienteDeReunion({
        titulo: r.titulo, participantes: r.participantes, emails: [r.host?.email ?? ''].filter(Boolean),
      }).catch(() => null);
      const { tareas, partesFallidas = 0, transcript } = await extraerTareasDeReunion(r.recordingId, proyectos, yo, {
        glosario, participantes: r.participantes, usoMotivo: 'Reunión nueva → tareas al plan (automático)',
        rolDelDueno: clienteDeLaReunion ? ROL_CONSULTOR : ROL_DESCONOCIDO,
      });
      // Lectura PARCIAL: se leyó parte del transcript y otra parte se perdió.
      const parcial = partesFallidas > 0;
      // El cache es también la lista blanca de a quién se le puede mandar algo de esta
      // reunión (/api/plan-reunion), y evita que re-abrirla en la app vuelva a cobrar.
      // SOLO si hubo tareas: cachear un resultado vacío le serviría ese vacío al botón
      // manual ("MaKo no encontró nada") escondiendo que fue una corrida fallida.
      //
      // ⚠️ Y SOLO SI SE LEYÓ ENTERA. Un `if (tareas.length)` a secas cachea la lectura
      // MUTILADA: con 2 de 7 tramos caídos el resultado parcial queda guardado y el modal
      // después lo sirve para siempre por la rama `cached:true`, sin que nada diga que
      // faltan dos tramos. El comentario de app/api/plan-fathom/route.ts dice textual
      // «mismo criterio que el cron» y era falso: la ruta sí exigía `!partesFallidas` y
      // acá no se miraba. Ahora sí, y son el mismo criterio de verdad.
      if (tareas.length && !parcial) {
        await setSetting(cacheKeyReunion(r.recordingId), JSON.stringify({ tareas, participantes: r.participantes, ts: Date.now() })).catch(() => {});
      }

      // "No devolvió tareas" NO es lo mismo que "no había compromisos": si algún tramo
      // del transcript falló (429, timeout, JSON inválido), la lista sale vacía igual.
      // Marcarla como vista ahí la quemaba PARA SIEMPRE — pasó de verdad ("no jaló la
      // IA, no hubo de Esquer") y no había forma de enterarse. Ahora, si hubo fallas,
      // la reunión NO se marca: el próximo cron la reintenta.
      // ¿ESTA REUNIÓN ES CON UN CLIENTE? Si lo es, TODAS sus tareas van al proyecto de
      // ese cliente y el tema de cada una deja de decidir dónde se archiva. Es la regla
      // que pidió el dueño ("si proviene de una llamada con cliente, clasificala al
      // cliente") y la que el modelo no puede aplicar: él ve un título, no el CRM.
      const cliente = await resolverClienteDeReunion({
        titulo: r.titulo,
        participantes: r.participantes,
        emails: [r.host?.email ?? ''].filter(Boolean),
      }).catch(() => null);
      const proyCliente = cliente ? await nombreDeProyectoPara(cliente) : '';
      if (cliente) console.log(`[reunion-auto] «${r.titulo}» es con ${cliente.nombre} → todo va a «${proyCliente}»`);

      // ── EL JUEZ DEL CRITERIO ────────────────────────────────────────────────
      // Solo en los workspaces que cargaron su criterio de compromisos. Sin el, todo
      // sigue EXACTAMENTE igual que antes (lib/plan-criterio.ts explica por que es un
      // solo interruptor). El juez no extrae: lee la lista que ya salio y pone cada
      // tarea en su cubeta, con la regla y la cita — y ademas devuelve lo que el
      // criterio encuentra y el extractor no saco (`faltantes`).
      //
      // ⚠️ VA ACA Y NO DESPUES DE `crearPropuesta`. Lo que el criterio descarta tiene
      // que llegar al borrador ya clasificado: si se juzgara despues, las setenta
      // tarjetas ya estarian creadas y el criterio seria una etiqueta sobre trabajo
      // que ya ensucio el tablero, que es justo lo que vino a evitar.
      const criterio = await criterioDelWorkspace().catch((e) => {
        console.error(`[reunion-auto] ws=${ws}: no pude leer el criterio (${e instanceof Error ? e.message : String(e)}) — sigo sin el`);
        return null;
      });
      let juicio: SalidaJuez | null = null;
      if (criterio && transcript.trim()) {
        const dueno = await duenoDelTablero(ws, yo);
        const j = await juzgarConCriterio({
          criterio, transcript, dueno,
          candidatas: tareas.map((t) => ({ titulo: t.titulo, detalle: t.detalle, dueño: t.dueño, esDeOtro: t.esDeOtro })),
          usoMotivo: 'Reunión nueva → criterio de compromisos (automático)',
          // El mismo reloj: el juez hace las corridas que quepan y no una más.
          hasta,
        }).catch((e) => {
          console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId}: el juez tiró (${e instanceof Error ? e.message : String(e)})`);
          return null;
        });
        // `fallo` = no contesto NINGUNA corrida. Ahi no hay juicio: las tareas entran
        // como siempre. Tratar un fallo de red como «el criterio no encontro nada»
        // vaciaria el borrador de una reunion entera sin que nadie se entere.
        juicio = j && !j.fallo ? j : null;
        if (!juicio) console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId}: hay criterio y el juez no se pronunció — las tareas entran sin juzgar`);
      }


      // ⚠️ ACÁ COLGABA EL BUCLE DE ENTREGA, Y SE FUE EL 26/09/2026. En las juntas
      // `entrega` con el cliente identificado, MaKo reescribía con lo que se había
      // afinado en la sesión las respuestas que ese cliente había dado en el
      // cuestionario del programa de 44 clases (`lib/cs-reescritura.ts` → `cs_respuestas`).
      // El programa era de UN cliente y se fue entero: no queda bloque que reescribir,
      // y dejarlo habría sido pagar un modelo en cada junta de entrega para escribir
      // en una tabla que ya nadie lee.
      // ⚠️ Y EL CORTE MIRA LAS DOS COSAS. El extractor pone el techo de lo que se
      // puede clasificar, pero no el de lo que se puede encontrar: el juez lee la
      // reunión entera y trae lo que la lista no traía. Con `!tareas.length` a secas,
      // una reunión con compromisos que el extractor no vio se cerraba como «leída
      // completa, sin compromisos» — y se cerraba PARA SIEMPRE, porque esa rama
      // escribe el candado.
      if (!tareas.length && !juicio?.faltantes.length) {
        if (parcial) {
          out.errores += 1;
          console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId} «${r.titulo}»: la lectura FALLÓ (${partesFallidas} tramo(s) sin leer) — queda para reintentar`);
          // Y QUEDA ESCRITO (16/10/2026): el `console.error` era todo el rastro, y así se perdieron
          // diez reuniones del ws1 entre el 08 y el 15/10 (la ventana de 26 h se termina y nadie
          // vuelve a mirarla). En el modal de Fathom, en «Sin leer», con «Leer igual».
          await registrarNoLeida(r, `No pude leer ${partesFallidas} tramo(s): la IA no contestó. La reintento sola.`);
        } else {
          // Vacío legítimo: leída entera y sin compromisos. Esa sí se cierra.
          await setSetting(KEY_VISTA(r.recordingId), new Date().toISOString()).catch(() => {});
          console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId} «${r.titulo}»: leída completa, sin compromisos`);
        }
        continue;
      }

      const nombreProy = new Map(proyectos.map((p) => [p.id, p.nombre]));


      // ⚠️ EN UNA REUNIÓN DE ENTREGA, «el otro» PUEDE SER EL CLIENTE.
      // `esDeOtro` + `dueñoEmail` es lo que después ofrece mandarle la tarea a esa
      // persona a su propio plan, y el cliente no tiene cuenta acá: el ofrecimiento
      // no lleva a ningún lado, y peor, invita a repartirle trabajo interno a alguien
      // de afuera. En una reunión de equipo todos los participantes son del
      // workspace, así que el problema no existía y aparece justo ahora, al empezar a
      // procesar las de entrega.
      //
      // A quién se le puede MANDAR algo: cualquiera con cuenta en la app. El criterio y
      // el porqué de que sean TRES preguntas distintas —de quién es, a dónde le escribo,
      // y si le puedo mandar— viven en lib/reunion-reparto.ts, que además se puede
      // testear. Acá vivía inline, adentro de esta función de 200 líneas sin un solo
      // test, y por eso el bug del 12/8 no lo cazó nadie.
      const conCuenta = emailsConCuenta(await listarUsuarios().catch(() => []));

      const propuestas: PropuestaTarea[] = tareas
        .map((t, i) => ({ t, v: juicio?.veredictos[i] ?? null }))
        // `fuera` no llega al borrador: no tiene forma de compromiso —una idea, un
        // diagnostico, algo ya hecho— y el criterio es explicito en que eso «no se
        // registra en ninguna parte». Si entrara como descartada, la lista de
        // descartes «se convertiria en un basurero y nadie la revisaria, que es
        // exactamente el fracaso que este diseno evita».
        .filter(({ v }) => v?.cubeta !== 'fuera')
        .map(({ t, v }) => ({
        titulo: t.titulo,
        detalle: t.detalle || undefined,
        prioridad: t.prioridad,
        // …o el nombre que PROPUSO el modelo cuando el proyecto todavía no existe. Se
        // descartaba acá, así que las tareas del cron nacían sueltas aunque la reunión
        // hubiera dicho a qué proyecto iban (el server sabe crearlo por nombre).
        // Con cliente detectado MANDA el cliente: lo que haya elegido el modelo se
        // ignora (es justo lo que repartía una misma llamada en proyectos temáticos).
        proyecto: proyCliente || (t.proyectoId ? nombreProy.get(t.proyectoId) : (t.proyectoNombre?.trim() || undefined)),
        ...repartoDeTarea(t, conCuenta),
        // El MINUTO en que se dijo. Se perdía acá: la extracción lo trae, el borrador
        // lo declara y aplicarPropuestas lo usa para armar el link a la grabación
        // parada en ese segundo — pero este map no lo copiaba, así que toda tarea que
        // venía del cron nacía sin el deep-link (25 de la reunión de Leila, sin reloj).
        minuto: t.minuto,
        minutos: t.minutos,
        // Y «se repite para siempre» (mig 0163), por la misma razón que el minuto: es el
        // camino por el que entra la MAYORÍA de las tareas de reunión, así que una
        // recurrente que no se copie acá nace compitiendo en el ranking y pidiendo una
        // fecha que nunca va a tener.
        //
        // Y con juez, manda EL JUEZ: es la cuarta pregunta del criterio y el juez la
        // contesta viendo la reunión entera, mientras que el extractor la marca
        // mirando un tramo. Sin juez, lo del extractor, como siempre.
        recurrente: v ? v.recurrente || undefined : t.recurrente,
        cubeta: v && v.cubeta !== 'fuera' ? v.cubeta : undefined,
        porQue: v ? porQueDelVeredicto(v) : undefined,
        // Tildada solo la que el criterio llamó compromiso. Las otras dos cubetas
        // VIAJAN igual, destildadas y con su razón escrita: el criterio pide que se
        // registren, no que se escondan, y promoverlas es tildar una casilla.
        // Sin juez, `undefined` = tildada, que es el default de siempre.
        incluir: v ? (v.cubeta === 'compromiso' ? undefined : false) : undefined,
      }));

      // LO QUE EL EXTRACTOR NO SACÓ. Es la mitad cara del juez y la que ataca el techo
      // de la extracción: por bien que clasifique, un compromiso que la lista no trae
      // no lo puede rescatar nadie más. Todos vienen con su cita ya verificada contra
      // la transcripción (`sanearFaltantes` descarta el que no se verifica), así que
      // acá no entra nada que el modelo no pueda respaldar con una frase dicha.
      if (juicio?.faltantes.length) {
        const duenoTab = normCita(await duenoDelTablero(ws, yo));
        for (const f of juicio.faltantes) {
          const mio = !!duenoTab && normCita(f.quien).includes(duenoTab.split(' ')[0]);
          propuestas.push({
            titulo: f.titulo,
            detalle: [f.producto ? `Producto: ${f.producto}` : '', f.tema ? `Tema: ${f.tema}` : ''].filter(Boolean).join('\n') || undefined,
            proyecto: proyCliente || undefined,
            // El dueño sale del nombre que el juez leyó en la transcripción. NO se le
            // busca email: `duenoEmail` es «a dónde le escribo» y adivinarlo desde un
            // nombre es justo la clase de dato exacto que un modelo no transporta.
            dueno: mio ? undefined : f.quien,
            esDeOtro: mio ? undefined : true,
            recurrente: f.recurrente || undefined,
            cubeta: f.cubeta,
            porQue: `Lo encontró el criterio y no estaba en la lista${f.razon ? ` — ${f.razon}` : ''}\n«${f.cita}»`,
            incluir: f.cubeta === 'compromiso' ? undefined : false,
          });
        }
      }

      // El número que se promete cuenta lo que se va a CREAR si se confirma, no todo
      // lo que viaja: con juez, el borrador lleva también los acuerdos internos y los
      // descartes, destildados. Anunciar 40 y crear 8 es el mismo bug que ya se
      // arregló una vez acá con las tareas de otras personas.
      const aCrear = propuestas.filter((t) => t.incluir !== false);
      const mias = cuantasSonMias(aCrear);
      const conQuien = r.participantes
        .filter((p) => p.email !== (r.host?.email ?? ''))
        .map((p) => p.nombre || p.email.split('@')[0])
        .slice(0, 3).join(', ');

      // ⛔ Acá se armaban preguntas de contexto para responder antes de cargar. El alta
      // dejó de preguntar el 05/10/2026: el Perro decide fecha y prioridad solo.
      const propId = await crearPropuesta({
        ws, ref, tareas: propuestas, origen: 'fathom',
        fuenteTitulo: r.titulo, fuenteUrl: r.url ?? undefined, fuenteFecha: r.fecha ?? undefined,
        // CON QUÉ CLIENTE fue (mig 0160). Antes se usaba para elegir el proyecto y se
        // tiraba: al confirmar ya no había reunión a la cual preguntarle, y las tareas
        // llegaban al tablero sin la etiqueta de origen que Mauricio filtra (08-T41).
        clienteNombre: cliente?.nombre, clienteLeadId: cliente?.leadId,
        // El número que se promete es el de TUS compromisos, no el total: las de otras
        // personas no se crean acá (viajan a su tablero), así que anunciar 34 y crear 13
        // hace que la pantalla y el resultado no coincidan.
        // El resumen sale del MISMO cálculo que la clasificación. Escrito aparte decía
        // «sacó 37 compromisos tuyos» sobre una reunión donde 26 eran de Mau: el aviso
        // confirmaba el bug en vez de delatarlo.
        resumen: `MaKo leyó tu reunión${r.titulo ? ` «${r.titulo}»` : ''}${conQuien ? ` con ${conQuien}` : ''} y sacó ${resumenDelReparto(aCrear)}.`,
      });
      // RECIÉN ACÁ se cierra la reunión: el borrador ya está guardado. Antes esto
      // corría ANTES de crearPropuesta (con otra llamada de IA en el medio), así que
      // un error de base o un corte del serverless dejaba la reunión marcada como
      // procesada y SIN borrador: las tareas se perdían para siempre, sin reintento
      // ni aviso. El candado tiene que escribirse después del efecto que protege.
      // ⚠️ Y NO SE CIERRA SI SE LEYÓ A MEDIAS. Esto era incondicional, con un
      // `console.warn` al lado — y ya sabemos cuánto vale un warn: la reunión quedaba
      // marcada como vista PARA SIEMPRE con dos tramos sin leer, sin reintento y sin que
      // nadie se enterara. El borrador parcial igual se crea (lo que se leyó sirve), pero
      // la reunión sigue abierta y el próximo cron completa lo que falta.
      if (!parcial) {
        await setSetting(KEY_VISTA(r.recordingId), new Date().toISOString()).catch(() => {});
      } else {
        console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId}: ${partesFallidas} tramo(s) SIN leer — borrador parcial, NO se cachea ni se cierra: el próximo cron reintenta`);
      }
      // EL CRUCE CONTRA EL TABLERO, ACÁ Y NO EN EL MODAL (16/10/2026, «Fathom sin fricción»). Lo
      // corría el modal al abrirse y no dejaba cargar mientras tanto («Cruzando con tu plan…», 20 a
      // 40 s). Ahora el borrador llega a la pantalla ya cruzado y SELLADO (`cruzado_at`): el modal
      // sólo dibuja lo que encontró. Con el MISMO reloj: si no entra, queda sin sellar y lo cruza el
      // barrido de la próxima corrida (`cruzarPendientes`); el modal no lo espera nunca.
      const cruce = await cruzarBorrador(propId, { hasta }).catch((e) => ({ sellado: false, marcadas: 0, conIA: false, motivo: e instanceof Error ? e.message : String(e) }));
      if (cruce.sellado) out.cruzados = (out.cruzados ?? 0) + 1;
      else console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId}: el borrador queda SIN cruzar (${cruce.motivo ?? 'sin motivo'}) — lo cruza el barrido`);
      out.conTareas += 1;
      // ⚠️ SE CUENTA LO MISMO QUE SE PROMETE. `mias` sale de `aCrear` (lo tildado) y
      // `otras` salía de `propuestas.length - mias`, o sea del TOTAL: con juez, ahí
      // adentro están también los descartes y los acuerdos internos, y el mensaje
      // anunciaba como «de otros» lo que el criterio había sacado. Mezclar una cifra
      // filtrada con una sin filtrar es el bug que este mismo archivo ya pagó una vez.
      out.tareas += aCrear.length;
      hechas.push({ titulo: r.titulo, fecha: r.fecha, conQuien, mias, otras: aCrear.length - mias, descartadas: propuestas.length - aCrear.length, partesFallidas, recordingId: r.recordingId, propId });
    } catch (e) {
      out.errores += 1;
      console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId}: ${e instanceof Error ? e.message : String(e)}`);
      await registrarNoLeida(r, `No pude leerla: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}. La reintento sola.`);
    } finally {
      await soltarLectura(r.recordingId);
    }
  }

  // UN SOLO aviso por corrida, al final. Antes salía uno por reunión: con tres
  // reuniones nuevas eran tres WhatsApps con el MISMO link, y al entrar se veía un
  // borrador solo — los números no cerraban ("me dijo 11 y veo 4"). Ahora el mensaje
  // resume todas, con la fecha y hora de cada una, y el total es exactamente el que
  // va a ver en la pantalla: SOLO las tareas propias.
  if (hechas.length) {
    const tz = await zonaDelNegocio(ws);
    const aviso = await emitirDelCatalogo('reunion-tareas-al-plan', { ws, texto: textoAviso(hechas, tz) });
    if (aviso.wa) out.avisados += 1;
    else { out.sinAviso += 1; out.avisoError = aviso.waError ?? 'no se pudo mandar el WhatsApp'; }
  }
  if (sinTiempo) out.sinTiempo = sinTiempo;
  return out;
}
