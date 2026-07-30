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
//   2) SOLO REUNIONES DE EQUIPO. Una llamada de ventas o de entrega de servicio deja
//      tareas de seguimiento del lead, no del plan de ejecución (reunion-clasificar).
//
// Y avisa por WhatsApp al grupo de MaKo del workspace: "tuviste una reunión con X,
// salieron N tareas, te las dejé en el plan para que las confirmes".
//
// Corre por workspace (cron-workspaces con la integración 'fathom'), así que cada
// negocio lee SU Fathom con SU key y escribe en SU tablero.
// =============================================================================

import { listReunionesRecientes, extraerTareasDeReunion, preguntasDeContexto, cacheKeyReunion, type ProyectoRef, type ReunionMeta, type Yo } from './plan-fathom';
import { crearPropuesta, existePropuestaRef, type PropuestaTarea } from './plan-propuesta';
import { glosarioTexto } from './glosario';
import { getSetting, setSetting } from './settings';
import { emitirDelCatalogo } from './avisos';
import { listarUsuarios } from './usuarios';
import { getWorkspace } from './workspace';
import { tzDeWorkspace } from './timezone';
import { fechaHoraEnTz } from './date-utils';
import { listPlanBoard } from './plan-board';
import { listCategorias } from './todo';

const APP_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');

/**
 * Marca que YA miramos esta grabación, sin importar si dejó tareas o no.
 * El candado no puede ser solo "existe el borrador": una reunión que no dejó ningún
 * compromiso no genera borrador, así que sin esta marca el cron la volvía a leer
 * ENTERA cada hora durante toda la ventana (medido: una corrida se comió la cuota
 * gratis de Gemini y cayó a Claude, US$0,26 para devolver cero tareas).
 */
const KEY_VISTA = (recordingId: number): string => `mako.reunion.auto.${recordingId}`;

/** Una reunión ya procesada en esta corrida (para redactar el aviso al final). */
type ReunionHecha = { titulo: string; fecha: string | null; conQuien: string; mias: number; otras: number };

/**
 * El mensaje al grupo. Dos formas: una reunión (frase suelta) o varias (viñetas con
 * fecha y hora). Tope de 4 viñetas para que no sea un ladrillo en el teléfono.
 *
 * REGLA: el número grande es el de TAREAS PROPIAS, porque es exactamente el que va a
 * ver en el botón "Agregar N al plan". Las de los demás se mencionan aparte y no se
 * suman: si no, el mensaje promete más de lo que la pantalla muestra.
 */
function textoAviso(hechas: ReunionHecha[], tz: string): string {
  const link = `${APP_URL}/plan`;
  const totalMias = hechas.reduce((s, h) => s + h.mias, 0);
  const totalOtras = hechas.reduce((s, h) => s + h.otras, 0);
  const tuyas = `*${totalMias} ${totalMias === 1 ? 'tarea tuya' : 'tareas tuyas'}*`;
  const deOtros = totalOtras > 0 ? ` (y ${totalOtras} de los demás, para repartir)` : '';

  if (hechas.length === 1) {
    const h = hechas[0];
    const cuando = fechaHoraEnTz(h.fecha, tz);
    return `📝 Leí tu reunión${h.conQuien ? ` con *${h.conQuien}*` : ''}${h.titulo ? ` — *${h.titulo}*` : ''}${cuando ? `\n🗓️ ${cuando}` : ''}\n\nSaqué ${tuyas}${deOtros} y te las dejé en el plan para que las confirmes:\n${link}\n\nEntrás, revisás y con un toque quedan cargadas. — MaKo`;
  }

  const filas = hechas.slice(0, 4).map((h) => {
    const cuando = fechaHoraEnTz(h.fecha, tz);
    return `• *${h.titulo || 'Reunión'}*${cuando ? ` — ${cuando}` : ''}\n   ${h.mias} ${h.mias === 1 ? 'tarea tuya' : 'tuyas'}${h.otras ? ` · ${h.otras} de otros` : ''}`;
  });
  const resto = hechas.length > 4 ? `\n…y ${hechas.length - 4} ${hechas.length - 4 === 1 ? 'reunión más' : 'reuniones más'}.` : '';
  return `📝 Leí tus *${hechas.length} reuniones* nuevas:\n\n${filas.join('\n')}${resto}\n\nEn total ${tuyas}${deOtros}, todas esperándote en la misma pantalla:\n${link}\n\nEntrás una vez, revisás todo junto y con un toque quedan cargadas. — MaKo`;
}

export type ResultadoReunionesAuto = {
  miradas: number; deEquipo: number; nuevas: number; conTareas: number; tareas: number; errores: number;
  /** avisos que SÍ salieron por WhatsApp, y el motivo del último que no. El borrador
   *  igual queda esperando en el plan: el aviso es el empujón, no el canal de la tarea. */
  avisados: number; sinAviso: number; avisoError?: string;
};

/**
 * Proyectos del tablero de ESTE workspace: el rico (plan_tareas) es SOLO del
 * super-admin; el resto usa el suyo. Misma regla que aplicarPropuesta — si acá se
 * eligiera mal, las tareas saldrían con proyectos de un tablero que no es el que
 * después las recibe.
 */
async function proyectosDelWorkspace(ws: number): Promise<ProyectoRef[]> {
  const usaPlanBoard = (await getWorkspace(ws))?.capa === 'superadmin';
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
export async function procesarReunionesNuevas(ws: number, opts: { horas?: number; max?: number } = {}): Promise<ResultadoReunionesAuto> {
  const horas = opts.horas ?? 26;
  const max = opts.max ?? 3;
  const out: ResultadoReunionesAuto = { miradas: 0, deEquipo: 0, nuevas: 0, conTareas: 0, tareas: 0, errores: 0, avisados: 0, sinAviso: 0 };

  // La ventana va por `created_after` (CUÁNDO APARECIÓ la grabación en Fathom), no por
  // la fecha de la reunión: el disparador es "cayó una grabación nueva", y una charla
  // de ayer que se sube hoy también es nueva para el plan.
  //
  // Y hay un motivo duro: `recorded_after` la API LO IGNORA (probado — devuelve las
  // mismas 10 reuniones con y sin el parámetro). Con eso la "ventana de 26h" nunca
  // existió: el cron levantaba reuniones de hace tres semanas y las anunciaba como
  // nuevas. `created_after` sí filtra de verdad.
  const desde = new Date(Date.now() - horas * 3600_000).toISOString();
  const { reuniones } = await listReunionesRecientes({ limit: 20, createdAfter: desde });
  out.miradas = reuniones.length;

  const deEquipo = reuniones.filter((r) => r.tipo === 'equipo');
  out.deEquipo = deEquipo.length;
  if (!deEquipo.length) return out;

  const [proyectos, glosario] = await Promise.all([
    proyectosDelWorkspace(ws),
    glosarioTexto().catch(() => ''),
  ]);

  const hechas: ReunionHecha[] = [];
  let procesadas = 0;
  for (const r of deEquipo) {
    if (procesadas >= max) break;
    const ref = `fathom:${r.recordingId}`;
    // Ya la vio: o dejó borrador, o la leímos y no había nada que anotar. En los dos
    // casos no se vuelve a gastar el análisis. (Ante un error de lectura, saltear:
    // mejor perderse una reunión que duplicarla o quemar tokens en loop.)
    if (await existePropuestaRef(ref, ws).catch(() => true)) continue;
    if (await getSetting(KEY_VISTA(r.recordingId)).catch(() => 'error')) continue;
    out.nuevas += 1;
    procesadas += 1;
    try {
      const yo = await resolverYo(r, ws);
      const { tareas } = await extraerTareasDeReunion(r.recordingId, proyectos, yo, {
        glosario, participantes: r.participantes, usoMotivo: 'Reunión nueva → tareas al plan (automático)',
      });
      // Quede o no algo, la reunión ya fue leída: que el próximo cron no la relea.
      await setSetting(KEY_VISTA(r.recordingId), new Date().toISOString()).catch(() => {});
      // El cache es también la lista blanca de a quién se le puede mandar algo de esta
      // reunión (/api/plan-reunion), y evita que re-abrirla en la app vuelva a cobrar.
      // SOLO si hubo tareas: cachear un resultado vacío le serviría ese vacío al botón
      // manual ("MaKo no encontró nada") escondiendo que fue una corrida fallida.
      if (tareas.length) {
        await setSetting(cacheKeyReunion(r.recordingId), JSON.stringify({ tareas, participantes: r.participantes, ts: Date.now() })).catch(() => {});
      }
      if (!tareas.length) { console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId} «${r.titulo}»: la IA no devolvió tareas`); continue; }

      const nombreProy = new Map(proyectos.map((p) => [p.id, p.nombre]));
      const propuestas: PropuestaTarea[] = tareas.map((t) => ({
        titulo: t.titulo,
        detalle: t.detalle || undefined,
        prioridad: t.prioridad,
        proyecto: t.proyectoId ? nombreProy.get(t.proyectoId) : undefined,
        dueno: t.dueño || undefined,
        duenoEmail: t.dueñoEmail || undefined,
        esDeOtro: t.esDeOtro || undefined,
      }));
      const mias = propuestas.filter((t) => !t.esDeOtro).length;
      const conQuien = r.participantes
        .filter((p) => p.email !== (r.host?.email ?? ''))
        .map((p) => p.nombre || p.email.split('@')[0])
        .slice(0, 3).join(', ');

      // Preguntas CERRADAS de contexto: lo que la reunión no dejó claro y el Perro
      // necesita para priorizar bien. Se responden en el modal, antes de cargar.
      const { preguntas } = await preguntasDeContexto(tareas, r.titulo, 'Preguntas de contexto (reunión nueva)').catch(() => ({ preguntas: [] }));
      await crearPropuesta({
        ws, ref, tareas: propuestas, preguntas, origen: 'fathom',
        fuenteTitulo: r.titulo, fuenteUrl: r.url ?? undefined, fuenteFecha: r.fecha ?? undefined,
        resumen: `MaKo leyó tu reunión${r.titulo ? ` «${r.titulo}»` : ''}${conQuien ? ` con ${conQuien}` : ''} y sacó ${propuestas.length} ${propuestas.length === 1 ? 'compromiso' : 'compromisos'}.`,
      });
      out.conTareas += 1;
      out.tareas += propuestas.length;
      hechas.push({ titulo: r.titulo, fecha: r.fecha, conQuien, mias, otras: propuestas.length - mias });
    } catch (e) {
      out.errores += 1;
      console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // UN SOLO aviso por corrida, al final. Antes salía uno por reunión: con tres
  // reuniones nuevas eran tres WhatsApps con el MISMO link, y al entrar se veía un
  // borrador solo — los números no cerraban ("me dijo 11 y veo 4"). Ahora el mensaje
  // resume todas, con la fecha y hora de cada una, y el total es exactamente el que
  // va a ver en la pantalla: SOLO las tareas propias.
  if (hechas.length) {
    const tz = await tzDeWorkspace(ws).catch(() => 'America/Tijuana');
    const aviso = await emitirDelCatalogo('reunion-tareas-al-plan', { ws, texto: textoAviso(hechas, tz) });
    if (aviso.wa) out.avisados += 1;
    else { out.sinAviso += 1; out.avisoError = aviso.waError ?? 'no se pudo mandar el WhatsApp'; }
  }
  return out;
}
