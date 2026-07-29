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

import { listReunionesRecientes, extraerTareasDeReunion, cacheKeyReunion, type ProyectoRef, type ReunionMeta, type Yo } from './plan-fathom';
import { crearPropuesta, existePropuestaRef, type PropuestaTarea } from './plan-propuesta';
import { glosarioTexto } from './glosario';
import { setSetting } from './settings';
import { emitirDelCatalogo } from './avisos';
import { listarUsuarios } from './usuarios';
import { getWorkspace } from './workspace';
import { listPlanBoard } from './plan-board';
import { listCategorias } from './todo';

const APP_URL = (process.env.APP_BASE_URL || 'https://dashboard-marketing-six.vercel.app').replace(/\/$/, '');

export type ResultadoReunionesAuto = {
  miradas: number; deEquipo: number; nuevas: number; conTareas: number; tareas: number; errores: number;
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
  const out: ResultadoReunionesAuto = { miradas: 0, deEquipo: 0, nuevas: 0, conTareas: 0, tareas: 0, errores: 0 };

  const desde = new Date(Date.now() - horas * 3600_000).toISOString();
  const { reuniones } = await listReunionesRecientes({ limit: 20, recordedAfter: desde });
  out.miradas = reuniones.length;

  const deEquipo = reuniones.filter((r) => r.tipo === 'equipo');
  out.deEquipo = deEquipo.length;
  if (!deEquipo.length) return out;

  const [proyectos, glosario] = await Promise.all([
    proyectosDelWorkspace(ws),
    glosarioTexto().catch(() => ''),
  ]);

  let procesadas = 0;
  for (const r of deEquipo) {
    if (procesadas >= max) break;
    const ref = `fathom:${r.recordingId}`;
    if (await existePropuestaRef(ref, ws).catch(() => true)) continue; // ya la vio (o no pudimos chequear: mejor no duplicar)
    out.nuevas += 1;
    procesadas += 1;
    try {
      const yo = await resolverYo(r, ws);
      const { tareas } = await extraerTareasDeReunion(r.recordingId, proyectos, yo, {
        glosario, participantes: r.participantes, usoMotivo: 'Reunión nueva → tareas al plan (automático)',
      });
      // El cache es también la lista blanca de a quién se le puede mandar algo de esta
      // reunión (/api/plan-reunion), y evita que re-abrirla en la app vuelva a cobrar.
      await setSetting(cacheKeyReunion(r.recordingId), JSON.stringify({ tareas, participantes: r.participantes, ts: Date.now() })).catch(() => {});
      if (!tareas.length) continue;

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

      await crearPropuesta({
        ws, ref, tareas: propuestas, origen: 'fathom',
        fuenteTitulo: r.titulo, fuenteUrl: r.url ?? undefined,
        resumen: `MaKo leyó tu reunión${r.titulo ? ` «${r.titulo}»` : ''}${conQuien ? ` con ${conQuien}` : ''} y sacó ${propuestas.length} ${propuestas.length === 1 ? 'compromiso' : 'compromisos'}.`,
      });
      out.conTareas += 1;
      out.tareas += propuestas.length;

      // El aviso al grupo del workspace: que se entere ahora, no cuando abra la app.
      const detalleOtros = propuestas.length - mias;
      await emitirDelCatalogo('reunion-tareas-al-plan', {
        ws,
        texto: `📝 Tuviste una reunión${conQuien ? ` con *${conQuien}*` : ''}${r.titulo ? ` (${r.titulo})` : ''}. Saqué *${mias} ${mias === 1 ? 'tarea' : 'tareas'}* tuyas${detalleOtros > 0 ? ` y ${detalleOtros} de los demás` : ''} y te las dejé en tu plan para que las confirmes:\n${APP_URL}/plan\n\nEntrás, revisás y con un toque quedan cargadas. — MaKo`,
      });
    } catch (e) {
      out.errores += 1;
      console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}
