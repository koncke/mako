// =============================================================================
// mako-doer-acciones — el catálogo de ESCRITURAS del doer (punto 11) + confirmación
// =============================================================================
// MaKo NO ejecuta escrituras directo: las PROPONE. Cada tool `proponer_*` deja
// una acción pendiente (mako_acciones_pendientes, mig 0085) con vencimiento y
// devuelve un resumen para que MaKo pida el OK en el grupo. El dueño confirma con
// `confirmar_accion` → ahí recién se ejecuta la escritura REAL (ejecutarAccion),
// por los callers ya gateados (setPipelineStage, setSecuenciaActiva, metaWrite).
// Modelo de seguridad elegido: "Ejecuta con confirmación" + "pendiente con
// vencimiento" — un "sí" viejo o de otra charla nunca dispara algo por accidente.

import 'server-only';import { MOLDE_DETALLE, MOLDE_ADVERTENCIA } from './detalle-contrato';


import type { ToolDef, ToolRunner } from '@/lib/anthropic';
import { REGLA_NOMBRE_PROYECTO, canonNombre } from '@/lib/plan-proyectos-catalogo';
import { wsEnContexto, runWithWorkspace, getTenantDb, OWNER_WS } from '@/lib/workspace';
import { crearPendiente, resolverPendiente, pendientesVigentes, reclamarPendiente } from '@/lib/mako-pendientes';
import { porId } from '@/lib/api-mako/registro';
import { esAccion } from '@/lib/api-mako/tipos';
import { getLead, setPipelineStage, faltantesParaMover, esRequisitosFaltantes, logLeadEvent } from '@/lib/leads';
import { getFunnelDeLead } from '@/lib/funnels';
import { eventTypeDeReunion, huecosDisponibles, reservarReunion, linkParaAgendar } from '@/lib/calendly-agenda';
import type { Step, StepId } from '@/lib/stage-requirements';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { hoyEnTz, diasAntes } from '@/lib/date-utils';
import { leerPorPaginas } from '@/lib/supabase-paginado';
import { TIPO_DE_CAMBIO_USD_MXN } from '@/lib/config';
import { monedaCuentaMeta } from '@/lib/moneda-meta';
import { conversorDeGasto } from '@/lib/presupuesto-cambio';
import { getSecuenciasConStats, setSecuenciaActiva, validarActivacion, PasosInvalidosError } from '@/lib/nutricion';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';
import { rutearTareasCliente } from './todo-rutear';
import { crearTarea, crearCategoria, listCategorias, type Prioridad } from '@/lib/todo';
import { agregarTareasPlanOwner, priorizarNuevasOwner } from '@/lib/plan-board';
import { decidirRecurrente } from '@/lib/plan-criterio-reglas';
import { crearPropuesta } from '@/lib/plan-propuesta';
// Base pública para armar los links que MaKo manda por WhatsApp (deep-links al plan).
import { linkApp, APP_BASE_URL as APP_URL } from '@/lib/app-url';
const PRIOS: Prioridad[] = ['alta', 'media', 'baja', 'futuro'];
const prioOk = (p: unknown): Prioridad => (PRIOS.includes(p as Prioridad) ? (p as Prioridad) : 'media');

// ── helpers de entrada ────────────────────────────────────────────────────────
function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : '';
}
/** Fecha para mostrar en el chat, en la zona del WORKSPACE (no la del dueño). */
function fmtFecha(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch { return iso; }
}

// ── requisitos de etapa por WhatsApp: qué se pide y qué se declara sin cargar ──

/**
 * Los requisitos que MaKo PUEDE conseguir preguntando por el chat: son
 * exactamente los dos que su tool sabe recibir (`monto` y `motivo`).
 *
 * Todo lo demás —la fecha de una reunión, la asistencia, el link de Fathom, los
 * Deal Details— vive en Calendly / Fathom / la ficha, y NINGUNA de las 11 tools
 * del doer lo escribe. Exigirlos por este canal era un CALLEJÓN SIN SALIDA: el
 * dueño pedía «mové a Juan a Agendado», MaKo contestaba «falta la Fecha de la
 * Reunión 1, pedí ese dato», el dueño la decía… y MaKo no tenía dónde
 * escribirla, así que volvía a rebotar para siempre. Un movimiento que la
 * pantalla sí permite (el wizard del CRM la carga en el mismo paso) quedaba
 * imposible por WhatsApp.
 *
 * La regla que queda: se PIDE lo que este canal puede cargar; lo que no puede
 * cargar no bloquea, pero tampoco se calla — se mueve con `{ omitir }`, que deja
 * en el historial del lead qué quedó sin cargar y por qué (lib/leads.ts).
 */
const REQUISITOS_PEDIBLES: ReadonlySet<StepId> = new Set<StepId>(['monto', 'motivo']);

const etiquetasDe = (pasos: readonly Step[]): string => pasos.map((p) => p.label).join(', ');

type VeredictoRequisitos =
  | { ok: false; pedir: Step[] }
  | { ok: true; requisitos: 'validar' | { omitir: string }; sinCargar: Step[] };

/** Qué hacer con lo que falta para mover: pedirlo, o moverse declarándolo. */
function veredictoRequisitos(faltan: Step[]): VeredictoRequisitos {
  const pedir = faltan.filter((f) => REQUISITOS_PEDIBLES.has(f.id));
  if (pedir.length) return { ok: false, pedir };
  // Nada que falte → 'validar', que revalida contra la base en el mismo momento
  // de escribir (entre la propuesta y el "sí" pasan horas y el dato pudo irse).
  if (!faltan.length) return { ok: true, requisitos: 'validar', sinCargar: [] };
  return {
    ok: true,
    sinCargar: faltan,
    requisitos: { omitir: `Movido desde WhatsApp con el OK del dueño. Sigue sin cargar: ${etiquetasDe(faltan)} (no hay forma de cargarlo por ese canal).` },
  };
}

// ── dispatcher de la escritura REAL (se corre al confirmar) ───────────────────

export async function ejecutarAccion(ws: number, tipo: string, payload: Record<string, unknown>): Promise<{ ok: boolean; resumen: string }> {
  return runWithWorkspace(ws, async () => {
    // Nunca lanzamos: si algo falla, devolvemos {ok:false}. Si no, confirmar_accion
    // (que nos llama sin try/catch) dejaría la pendiente vigente y un "sí" repetido
    // la re-ejecutaría (duplicados).
    try {
    switch (tipo) {
      case 'lead_etapa': {
        const leadId = Number(payload.leadId);
        const etapa = String(payload.etapa);
        const monto = payload.monto != null ? Number(payload.monto) : undefined;
        const motivo = payload.motivo != null ? String(payload.motivo) : undefined;
        // MaKo mueve con los MISMOS requisitos que el wizard del CRM. Sin esto, un
        // "sí" por WhatsApp dejaba un Ganado sin monto o un Perdido sin motivo: una
        // etapa que la pantalla nunca habría permitido, y el lead volvía al worklist.
        // Se revalida acá (y no solo al proponer) porque entre la propuesta y el "sí"
        // pasan horas: el dato pudo cargarse o borrarse en el medio.
        //
        // El reparto es el mismo que al proponer (REQUISITOS_PEDIBLES): si falta
        // algo que este canal NO puede cargar, el movimiento igual pasa —
        // declarándolo en el historial— porque bloquearlo no le deja al dueño
        // ninguna salida. Esto además destraba las pendientes creadas ANTES de que
        // existiera la validación: sin el reparto, un "sí" sobre una propuesta que
        // el propio dueño pidió rebotaba.
        const lead = await getLead(leadId).catch(() => null);
        // DEL LEAD: lo que decide si el movimiento pasa son los requisitos de SU
        // recorrido. Sin lead no hay funnel que valga: queda en null y
        // setPipelineStage falla cerrado.
        const stages = lead ? (await getFunnelDeLead(lead).catch(() => null))?.stages ?? null : null;
        // Sin poder leer el lead no hay nada contra qué decidir: 'validar' hace que
        // setPipelineStage falle cerrado en vez de mover a ciegas.
        const v: VeredictoRequisitos = lead
          ? veredictoRequisitos(faltantesParaMover(lead, etapa, stages, { monto, motivo: motivo ?? null }))
          : { ok: true, requisitos: 'validar', sinCargar: [] };
        if (!v.ok) {
          return { ok: false, resumen: `No moví el lead #${leadId} a '${etapa}': falta cargar ${etiquetasDe(v.pedir)}.` };
        }
        try {
          await setPipelineStage(leadId, etapa, { monto: monto ?? null, motivo: motivo ?? null, requisitos: v.requisitos });
        } catch (e) {
          if (esRequisitosFaltantes(e)) {
            return { ok: false, resumen: `No moví el lead #${leadId} a '${etapa}': falta cargar ${etiquetasDe(e.faltan)}.` };
          }
          throw e;
        }
        const cola = v.sinCargar.length ? ` Quedó sin cargar: ${etiquetasDe(v.sinCargar)} — se completa en la ficha del lead.` : '';
        return { ok: true, resumen: `Lead #${leadId} movido a la etapa '${etapa}'.${cola}` };
      }
      case 'nutricion_toggle': {
        const id = Number(payload.secuenciaId);
        const activa = Boolean(payload.activa);
        await setSecuenciaActiva(id, activa);
        return { ok: true, resumen: `Secuencia de nutrición #${id} ${activa ? 'activada' : 'pausada'}.` };
      }
      case 'meta_nombre':
      case 'meta_presupuesto':
      case 'meta_estado': {
        // Con la cuenta de Meta de ESTE workspace (credWs adentro de metaWrite). Quién
        // puede confirmarlo lo decide el gating de la def (rolMinimo admin), que
        // gatingOk mira al proponer y al confirmar.
        const id = String(payload.campaignId);
        let body: MetaWriteBody;
        if (tipo === 'meta_nombre') body = { level: 'campaign', id, op: 'name', name: String(payload.nombre) };
        else if (tipo === 'meta_presupuesto') body = { level: 'campaign', id, op: 'budget', dailyBudgetMxn: Number(payload.montoMxn) };
        else body = { level: 'campaign', id, op: 'status', status: payload.estado === 'ACTIVE' ? 'ACTIVE' : 'PAUSED' };
        const r = await metaWrite(body, ws);
        if (!r.ok) return { ok: false, resumen: `Meta rechazó el cambio: ${r.message}` };
        if (tipo === 'meta_nombre') return { ok: true, resumen: `Campaña renombrada a "${payload.nombre}".` };
        // El monto está en la moneda de LA CUENTA de este ws, que ya no es siempre MXN.
        if (tipo === 'meta_presupuesto') return { ok: true, resumen: `Presupuesto de la campaña puesto en ${payload.montoMxn} por día (moneda de la cuenta).` };
        return { ok: true, resumen: `Campaña ${payload.estado === 'ACTIVE' ? 'activada' : 'pausada'}.` };
      }
      case 'tareas_plan': {
        // Agregar tareas al plan (punto 8). El super-admin (OWNER_WS) escribe DIRECTO al
        // board en la DB (mig 0093, antes iba a la bandeja localStorage); los clientes van
        // derecho a la base (todo.ts).
        const arr = Array.isArray(payload.tareas) ? (payload.tareas as Array<Record<string, unknown>>) : [];
        const items = arr
          .map((t) => {
            // ⚠️ SI VIENEN LAS DOS SEÑALES, GANA LA FECHA — y el desempate NO se escribe acá:
            // es `decidirRecurrente`, la misma que usa la extracción de reuniones. Dos
            // caminos que resuelven la misma contradicción con dos criterios distintos son
            // dos productos distintos según por dónde entró la tarea.
            //
            // Y gana la fecha por dos razones, la segunda decisiva: un booleano es un token
            // que el modelo tira sin pensar, mientras que una fecha concreta sólo se escribe
            // habiendo oído a alguien decirla (AGENTS.md: gana la señal más cara de
            // producir). Y sobre todo, el error NO es simétrico: una recurrente que todavía
            // compite se ve en el ranking y se arregla con el interruptor del detalle,
            // mientras que si ganara el flag, `taskToRow` le BORRA el deadline a una tarea
            // real — destruye el dato, en silencio y sin nada que lo diga.
            const deadline = typeof t.deadline === 'string' && t.deadline ? t.deadline : undefined;
            const { recurrente, conflicto } = decidirRecurrente(t.recurrente, deadline);
            // Un descarte sin rastro hace indistinguible «el modelo no la marcó» de «se la
            // tiramos nosotros».
            if (conflicto) console.warn('[mako-doer-acciones] «%s» vino marcada como que se repite Y con fecha %s: gana la fecha.', String(t.titulo ?? ''), deadline);
            return {
              titulo: String(t.titulo ?? '').trim(),
              prioridad: prioOk(t.prioridad),
              proyecto: t.proyecto ? String(t.proyecto).trim() : undefined,
              deadline,
              detalle: typeof t.detalle === 'string' && t.detalle ? String(t.detalle) : undefined,
              recurrente,
            };
          })
          .filter((t) => t.titulo);
        if (!items.length) return { ok: false, resumen: 'No había tareas válidas para agregar.' };
        const nN = `${items.length} tarea${items.length === 1 ? '' : 's'}`;
        const mirar = items.length === 1 ? 'Míralo aquí' : 'Míralas aquí';

        if (ws === OWNER_WS) {
          const { ids, proyectoIds } = await agregarTareasPlanOwner(
            items.map((it) => ({ titulo: it.titulo, prioridad: it.prioridad, proyecto: it.proyecto, deadline: it.deadline, detalle: it.detalle, recurrente: it.recurrente })),
            { tipo: 'whatsapp' },
          );
          const links = ids.map((id) => linkApp(`/plan/agencia?tarea=${id}`, wsEnContexto()));
          // El Perro Guardián trabaja las nuevas server-side (no depende de abrir el board):
          // puntúa + arma checklists + a los proyectos les pone emoji/detalle/score. Si falla,
          // las tareas quedan con su score inicial (no rompe la carga).
          let prioLinea = '';
          try {
            const c = await priorizarNuevasOwner(ids, proyectoIds);
            if (c) {
              const partes = [c.tareas.alta && `${c.tareas.alta} en Alta`, c.tareas.media && `${c.tareas.media} en Media`, c.tareas.baja && `${c.tareas.baja} en Baja`, c.tareas.futuro && `${c.tareas.futuro} a futuro`].filter(Boolean);
              const proj = c.proyectos ? ` y ordenó ${c.proyectos} proyecto${c.proyectos === 1 ? '' : 's'}` : '';
              if (partes.length || proj) prioLinea = `\n🐕 El Perro Guardián las priorizó (${partes.join(', ')})${proj}, y les armó la checklist.`;
            }
          } catch (e) { console.error('[mako-doer-acciones] priorizar nuevas:', e instanceof Error ? e.message : String(e)); }
          return { ok: true, resumen: `Agregué ${nN} a tu plan.${prioLinea} ${mirar}:\n${links.join('\n')}` };
        }

        // Cliente: ya estamos dentro de runWithWorkspace(ws) → la base scopea al cliente.
        // El nombre de categoría se guarda truncado a 40 (todo.ts) → usamos el MISMO
        // recorte como clave, si no un 2º lote con el mismo proyecto largo lo duplica.
        const cats = await listCategorias().catch(() => []);
        const catName = (p: string) => p.slice(0, 40).trim();
        // sin acentos (NFD), igual que el board: si no, "Vértice" y "Vertice" son dos proyectos
        const normNom = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
        const byName = new Map(cats.map((c) => [normNom(c.nombre), c.id]));
        const links: string[] = [];
        let fallidas = 0;
        // Mismo criterio que el resto de los orígenes, y de una sola pasada para TODO el
        // lote: cliente del CRM → proyecto que ya existe → área del catálogo. Ruteando
        // de a una, dos tareas del mismo tema del mismo mensaje caían en proyectos
        // distintos, porque cada llamada veía solo su tarea.
        const destinos = await rutearTareasCliente(items.map((it) => ({ titulo: it.titulo, detalle: it.detalle, proyectoSugerido: it.proyecto })))
          .catch((e) => { console.error('[mako-doer-acciones] rutear:', e instanceof Error ? e.message : String(e)); return items.map(() => ({ razon: '' } as { nombre?: string; razon: string; color?: string })); });
        for (let ii = 0; ii < items.length; ii++) {
          const it = items[ii];
          try {
            let catId: number | undefined;
            const d = destinos[ii] ?? { razon: '' };
            const proyFinal = d.nombre ?? it.proyecto;
            if (proyFinal) {
              const nombreCat = catName(proyFinal);
              const k = normNom(nombreCat);
              catId = byName.get(k);
              if (catId == null) { const c = await crearCategoria(nombreCat, d.color ?? '#2F6FED'); catId = c.id; byName.set(k, c.id); }
            }
            const tarea = await crearTarea({ titulo: it.titulo, prioridad: it.prioridad, deadline: it.deadline ?? null, detalle: it.detalle ?? null, categorias: catId != null ? [catId] : [], origen: 'mako' });
            links.push(linkApp(`/plan?tarea=${tarea.id}`, wsEnContexto()));
          } catch (e) {
            fallidas++;
            console.error('[mako-doer-acciones] tareas_plan item:', e instanceof Error ? e.message : String(e));
          }
        }
        // ok:true SIEMPRE (aunque falle alguna) para que la pendiente se resuelva y un
        // "sí" repetido NO re-cree las que ya entraron. Reportamos el parcial.
        if (!links.length) return { ok: false, resumen: `No pude agregar ninguna (fallaron ${fallidas}).` };
        const cola = fallidas ? ` (${fallidas} no pude)` : '';
        return { ok: true, resumen: `Agregué ${links.length} tarea${links.length === 1 ? '' : 's'} al plan${cola}. ${links.length === 1 ? 'Míralo aquí' : 'Míralas aquí'}:\n${links.join('\n')}` };
      }
      case 'agendar_reunion': {
        const leadId = Number(payload.leadId);
        const cual = payload.cual === 'R2' ? 'R2' as const : 'R1' as const;
        const startIso = String(payload.startIso ?? '');
        const lead = await getLead(leadId).catch(() => null);
        if (!lead) return { ok: false, resumen: `No existe el lead #${leadId}.` };
        if (!lead.email) return { ok: false, resumen: `${lead.nombre} no tiene email cargado y Calendly lo exige para reservar.` };

        const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
        const eventType = await eventTypeDeReunion(cual);
        // ⚠️ SE REVALIDA EL HUECO CONTRA CALENDLY, ACÁ Y AHORA.
        // El `startIso` viajó adentro de la propuesta, o sea que pasó por el
        // modelo, y entre la propuesta y el "sí" pueden pasar dos horas: en el
        // medio ese hueco se lo puede haber llevado otro. Las dos razones
        // apuntan al mismo chequeo — el que manda es el valor REAL de Calendly,
        // no el que quedó escrito (regla de la casa sobre datos exactos).
        const huecos = await huecosDisponibles(eventType.uri, { dias: 31 });
        if (!huecos.some((h) => h.startIso === startIso)) {
          const cerca = huecos.slice(0, 3).map((h) => fmtFecha(h.startIso, tz)).join(' · ');
          return { ok: false, resumen: `Ese horario ya no está libre en Calendly. Los próximos que sí: ${cerca || 'no quedan huecos en 31 días'}.` };
        }

        // Se intenta la reserva DIRECTA. Si Calendly la rechaza —hoy lo hace
        // siempre en los event types con videollamada, ver el encabezado de
        // lib/calendly-agenda.ts— se cae al formulario prellenado, que es la
        // misma jugada del popup del CRM y funciona igual. El orden importa: el
        // día que Calendly lo arregle, esto empieza a reservar solo.
        try {
          const reserva = await reservarReunion({
            eventType, startIso,
            invitado: { email: lead.email, nombre: lead.nombre, timezone: tz },
          });
          // NO se escribe fecha_junta_1/2 acá: reservar dispara el webhook
          // `invitee.created` de Calendly, que es el único que escribe esas
          // columnas (y de paso guarda las respuestas y el UTM). Escribirlo
          // también desde acá sería el mismo dato en dos lugares, con la versión
          // de acá quedándose vieja el día que el webhook cambie.
          await logLeadEvent(leadId, 'Reunión agendada', `MaKo agendó la ${cual} en Calendly para el ${fmtFecha(startIso, tz)} desde WhatsApp.`, 'MaKo');
          const link = reserva.joinUrl ? `\n${reserva.joinUrl}` : '';
          return { ok: true, resumen: `Listo: ${cual} con ${lead.nombre} el ${fmtFecha(startIso, tz)}. Calendly ya les mandó la invitación a los dos.${link}` };
        } catch (e) {
          const motivo = e instanceof Error ? e.message : String(e);
          console.warn(`[mako-doer-acciones] reserva directa rechazada (lead ${leadId}): ${motivo} — mando el formulario prellenado`);
          const url = await linkParaAgendar({ eventType, invitado: { nombre: lead.nombre, email: lead.email }, unUso: true });
          // ok:true a propósito: la pendiente SE RESUELVE. Dejarla vigente haría
          // que el próximo "sí" del dueño acuñe otro link de un solo uso, y
          // terminaría con tres links distintos en el chat para la misma reunión.
          await logLeadEvent(leadId, 'Link de agenda enviado', `MaKo mandó el formulario de Calendly de la ${cual} prellenado (la reserva directa la rechazó Calendly: ${motivo}).`, 'MaKo');
          return {
            ok: true,
            resumen: `Calendly no me dejó reservarlo directo, así que te dejo el formulario ya completado con los datos de ${lead.nombre} — eliges el horario y queda:\n${url}`,
          };
        }
      }

      default:
        return { ok: false, resumen: `Acción desconocida: ${tipo}` };
    }
    } catch (e) {
      console.error(`[mako-doer-acciones] ejecutarAccion ${tipo}:`, e instanceof Error ? e.message : String(e));
      return { ok: false, resumen: `No pude ejecutarlo (${e instanceof Error ? e.message : 'error'}).` };
    }
  });
}

// ── ToolDefs de acciones (lo que ve Claude) ───────────────────────────────────

export const MAKO_ACCION_TOOLS: ToolDef[] = [
  {
    name: 'listar_secuencias_nutricion',
    description: 'Lista las secuencias de nutrición del negocio con su id, nombre, etapa y si están activas o pausadas. Úsala para saber el id antes de proponer activar/pausar una.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_campanas_meta',
    description: 'Lista las campañas de Meta Ads con datos sincronizados en los ÚLTIMOS 30 DÍAS: id, nombre y gasto de ESE período en la moneda de la cuenta publicitaria (el campo lleva su nombre: `gasto_usd`, `gasto_mxn`…) y, si la cuenta no cobra en dólares y hay tasa, su equivalente en USD a un tipo de cambio fijo del código. La respuesta trae la ventana de fechas exacta que cubre: no es el gasto histórico de la campaña. Úsala para conseguir el id de una campaña antes de proponer renombrarla, cambiar su presupuesto o pausarla/activarla.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    // ⚠️ NO escribe el lead: deja una PROPUESTA y devuelve el link a la pantalla
    // donde se revisa y se confirma (AGENTS.md — «un canal PROPONE; una persona
    // confirma»). Es la misma tabla y la misma pantalla que ya usa el agente de
    // Claude (`/api/agente/lead` → /crm/revisar/<id>), no un segundo camino.
    //
    // El motivo es concreto y ya está pagado en este repo: un teléfono con un
    // dígito cambiado entra al CRM, no matchea su chat de WhatsApp ni su
    // Calendly, y nadie se entera hasta que falta una conversación. La
    // confirmación es el único momento en que un humano ve el dato antes de que
    // valga.
    name: 'proponer_lead',
    description: 'PROPONE dar de alta un lead en el CRM (deja una propuesta y devuelve un LINK para revisarla y confirmarla; NO lo crea). Úsala cuando te pidan agregar/cargar a alguien al CRM. Si te compartieron una tarjeta de contacto, los datos vienen en el mensaje. Necesitas al menos el nombre; el teléfono es lo que después permite cruzarlo con su WhatsApp. La tool te devuelve el link: pásaselo tal cual y NO pidas confirmación por el chat.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'nombre y apellido de la persona, como lo diría un humano.' },
        telefono: { type: 'string', description: 'teléfono, solo dígitos con código de país si lo tienes.' },
        email: { type: 'string', description: 'email, si lo tienes.' },
        empresa: { type: 'string', description: 'nombre del negocio, si lo dijeron.' },
        nota: { type: 'string', description: 'el contexto que dio el dueño en sus palabras (ej. «asistió a la primera sesión»). Va a la ficha: es lo que después explica de dónde salió este lead.' },
      },
      required: ['nombre'],
    },
  },
  {
    // Es una tool de LECTURA (no propone ni escribe nada), y está acá porque es
    // el paso obligatorio antes de `proponer_agendar_reunion`: los horarios que
    // devuelve son los ÚNICOS que Calendly va a aceptar. Sin esto el modelo
    // inventaría una hora redonda plausible y la reserva rebotaría siempre.
    name: 'listar_horarios_reunion',
    description: 'Lista los horarios REALES que tienes libres en Calendly para una R1 o una R2, en los próximos días. Úsala SIEMPRE antes de proponer agendar: los "startIso" que devuelve son los únicos que Calendly acepta, y hay que pasarlos TAL CUAL, sin redondear ni reescribir. Muéstrale al dueño la fecha y hora legibles, no el startIso.',
    input_schema: {
      type: 'object',
      properties: {
        cual: { type: 'string', enum: ['R1', 'R2'], description: 'qué reunión: R1 (primera) o R2 (seguimiento).' },
        dias: { type: 'number', description: 'cuántos días para adelante mirar (1 a 31; default 7).' },
      },
      required: ['cual'],
    },
  },
  {
    name: 'proponer_agendar_reunion',
    description: 'PROPONE reservar una reunión en Calendly con un lead (deja la acción pendiente de confirmación del dueño; NO la reserva). Al confirmar, Calendly crea el evento y le manda la invitación al lead y al dueño. Conseguí el leadId con buscar_leads y el startIso con listar_horarios_reunion — el startIso tiene que ser EXACTAMENTE uno de los que devolvió esa tool. El lead necesita email cargado.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'number', description: 'id del lead (de buscar_leads).' },
        cual: { type: 'string', enum: ['R1', 'R2'], description: 'qué reunión agendar.' },
        startIso: { type: 'string', description: 'el "startIso" COPIADO TAL CUAL de listar_horarios_reunion. No lo reescribas ni lo redondees: si no coincide carácter por carácter, Calendly lo rechaza.' },
      },
      required: ['leadId', 'cual', 'startIso'],
    },
  },
  {
    name: 'proponer_cambio_etapa',
    description: 'PROPONE mover un lead a otra etapa del funnel (deja la acción pendiente de confirmación del dueño; NO la ejecuta). Conseguí el leadId con buscar_leads y la etapa con ver_funnel. Para etapas de cierre pasá monto; para perdido/descalificado, motivo.',
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'number', description: 'id del lead (de buscar_leads).' },
        etapa: { type: 'string', description: "key de la etapa destino (de ver_funnel), p.ej. 'agenda', 'manual', 'ganado', 'perdido'." },
        monto: { type: 'number', description: 'monto de cierre en USD (solo para etapa ganada).' },
        motivo: { type: 'string', description: 'motivo (solo para perdido/descalificado).' },
      },
      required: ['leadId', 'etapa'],
    },
  },
  {
    name: 'proponer_toggle_nutricion',
    description: 'PROPONE activar o pausar una secuencia de nutrición (deja la acción pendiente de confirmación; NO la ejecuta). Conseguí el secuenciaId con listar_secuencias_nutricion.',
    input_schema: {
      type: 'object',
      properties: {
        secuenciaId: { type: 'number', description: 'id de la secuencia (de listar_secuencias_nutricion).' },
        activa: { type: 'boolean', description: 'true para activar, false para pausar.' },
      },
      required: ['secuenciaId', 'activa'],
    },
  },
  {
    name: 'proponer_renombrar_campana',
    description: 'PROPONE renombrar una campaña de Meta Ads (deja la acción pendiente de confirmación; NO la ejecuta). Conseguí el campaignId con listar_campanas_meta.',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'id numérico de la campaña (de listar_campanas_meta).' },
        nombre: { type: 'string', description: 'nombre nuevo.' },
      },
      required: ['campaignId', 'nombre'],
    },
  },
  // proponer_presupuesto_campana YA NO ESTÁ ACÁ: mueve plata y se confirma en una
  // PANTALLA (lib/api-mako/areas/ads.def.ts), nunca con un «sí» por el chat. El doer
  // la recibe del registro, con el mismo nombre, cuando el mensaje habla de ads.
  {
    name: 'proponer_estado_campana',
    description: 'PROPONE pausar o activar una campaña de Meta Ads (deja la acción pendiente de confirmación; NO la ejecuta).',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'id numérico de la campaña (de listar_campanas_meta).' },
        estado: { type: 'string', enum: ['ACTIVE', 'PAUSED'], description: 'ACTIVE para activar, PAUSED para pausar.' },
      },
      required: ['campaignId', 'estado'],
    },
  },
  {
    name: 'proponer_tareas_plan',
    description: 'PROPONE agregar TAREAS al plan del negocio. Úsala cuando te pasan una lista de cosas para el plan (aunque venga desordenada). Cada tarea necesita al menos un título. Resuelve tú lo DEDUCIBLE (a qué proyecto va, dedup con ver_plan). Lo que NO puedes deducir va escrito en el "detalle" de la tarea: NO hagas el ida-y-vuelta por WhatsApp y NO armes preguntas — el alta no pregunta nada, y la fecha y la prioridad las decide el Perro Guardián. La tool te devuelve un LINK a la pantalla de revisión de la app: pásaselo tal cual, NO pidas "sí" ni repitas la lista por el chat.',
    input_schema: {
      type: 'object',
      properties: {
        tareas: {
          type: 'array',
          description: 'Las tareas a agregar, ya con lo deducible resuelto (proyecto asignado).',
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string', description: 'qué hay que hacer, corto e imperativo.' },
              prioridad: { type: 'string', enum: ['alta', 'media', 'baja', 'futuro'], description: 'opcional; default media.' },
              recurrente: { type: 'boolean', description: 'opcional; true SOLO si se repite para siempre y no tiene un final: asistir a la junta de los miércoles, el seguimiento diario a los leads. NO lo pongas en algo que se hace UNA vez aunque monte un ritual — «diseñar la estructura de la junta semanal» se completa y se termina, así que es false. Si es true, NO mandes deadline: una recurrente no tiene fecha de fin.' },
              proyecto: { type: 'string', description: `opcional; NOMBRE LEGIBLE del proyecto (NUNCA un slug ni un id tipo "agente-de-ads"). Para asignar a uno que YA existe, pon su nombre EXACTO como aparece en ver_plan (campo "nombre"), así no se duplica. Si el tema NO tiene proyecto todavía, pon igual el nombre que le pondrías: es una PROPUESTA que revisa el Perro Guardián antes de crear nada. ⛔ NUNCA le digas al dueño en qué proyecto quedó la tarea: todavía no está decidido.

CÓMO SE LLAMA UN PROYECTO NUEVO (la misma regla que aplica el Perro — si propones un nombre que no la cumple, no lo va a reconocer como proyecto nuevo y va a reusar el más parecido):
${REGLA_NOMBRE_PROYECTO}

Y el nombre va en INGLÉS: «${'Feature: '}AI Agents», no «Agentes IA». Los proyectos que YA existen en español se dejan como están.` },
              deadline: { type: 'string', description: 'opcional; fecha límite YYYY-MM-DD.' },
              detalle: { type: 'string', description: `EL CAMPO MAS IMPORTANTE. ${MOLDE_ADVERTENCIA}

${MOLDE_DETALLE}

Lo que no escribas aca SE PERDIO: nadie vuelve a leer el WhatsApp, y el Perro decide el proyecto leyendo esto.` },
            },
            required: ['titulo'],
          },
        },
        eliminar: {
          type: 'array',
          description: 'Opcional. Tareas EXISTENTES del plan (las viste en ver_plan) que esta lista deja OBSOLETAS o que están DUPLICADAS, para proponer borrarlas CON CRITERIO (no borres por borrar; solo lo que de verdad ya no aplica o se fusiona). Cada una con el "id" exacto de ver_plan y un "motivo" corto. El dueño/cliente confirma cada una en la app.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'id EXACTO de la tarea a borrar (el que te dio ver_plan).' },
              motivo: { type: 'string', description: 'por qué borrarla/fusionarla, 1 frase.' },
            },
            required: ['id'],
          },
        },
      },
      required: ['tareas'],
    },
  },
  {
    name: 'listar_pendientes',
    description: 'Lista las acciones que dejaste pendientes de confirmación en este grupo y que siguen vigentes (no vencidas). No requiere parámetros.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'confirmar_accion',
    description: 'EJECUTA una acción que estaba pendiente de confirmación, cuando el dueño te dio el OK ("sí", "dale", "confirmo"). Si hay una sola pendiente vigente puedes omitir el id; si hay varias, pasa el id exacto (de listar_pendientes).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id de la acción pendiente a ejecutar (opcional si hay una sola).' } },
    },
  },
  {
    name: 'cancelar_accion',
    description: 'Cancela una acción pendiente (el dueño dijo que no, o cambió de idea). Si hay una sola vigente puedes omitir el id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'number', description: 'id de la acción pendiente a cancelar (opcional si hay una sola).' } },
    },
  },
];

/** Nombres de los tools de acción (para rutear en el runner combinado del doer). */
export const NOMBRES_ACCION = new Set(MAKO_ACCION_TOOLS.map((t) => t.name));

// ── runner: crea/lista/confirma pendientes (cerrado sobre ws + grupoJid) ──────

const TTL_MIN = 120; // 2h de vigencia para el "sí".

// `turnStart` = Date.now() del arranque del turno. Sirve para bloquear el auto-confirm:
// una pendiente creada EN ESTE turno (createdAt >= turnStart) no puede confirmarse en el
// mismo turno; el "sí" del dueño siempre llega en un mensaje aparte (otro turno posterior).
// Un "sí", "dale", "cargalo" pelado NO puede parir tareas. Es el candado del caso que
// rompió todo: MaKo preguntó "saqué 97 compromisos, ¿los cargo?" desde otra ruta (un
// aviso, que no quedaba registrado), Martín contestó "Si cargalo con lujo de detalle
// cada una", y el doer —sin ese turno en su historial— agarró la conversación anterior
// que encontró y recreó DOS tareas de cuatro días antes. Con este guard, en vez de
// inventar, MaKo tiene que pedir la lista.
const CONFIRMACION_PELADA = /^(s[ií]|dale|ok(ey)?|listo|perfecto|obvio|claro|va|hacelo|cargalo|carg[áa]lo|agregalo|agreg[áa]lo|confirmo|adelante|de una|correcto|exacto|as[ií] es|todas?|todos)\b/i;
const pareceConfirmacion = (msg: string): boolean => {
  const t = (msg || '').trim();
  if (!t) return true;                       // sin mensaje no hay de dónde sacar tareas
  if (t.length > 160) return false;          // un mensaje largo trae contenido propio
  if (/\n\s*[-*\d]/.test(t)) return false;   // trae una lista → hay material real
  return CONFIRMACION_PELADA.test(t);
};

export function crearRunnerAcciones(ws: number, grupoJid: string, turnStart = 0, mensajeUsuario = ''): ToolRunner {
  const proponer = async (tipo: string, payload: Record<string, unknown>, resumen: string): Promise<string> => {
    // Si el turno ya dejó una igual (el doer rotó de proveedor y volvió a correr), ésa.
    // Un paso de un flujo (lib/api-mako/flujo.ts) corre las heredadas por acá con la clave
    // `app:flujo:<origen>`: la fila lleva el flujo de origen, no «hola-mako».
    const origen = grupoJid.startsWith('app:flujo:') ? grupoJid.slice('app:'.length) : 'hola-mako';
    const id = await crearPendiente(ws, { grupoJid, tipo, payload, resumen, origen, ttlMin: TTL_MIN, mismoTurnoDesde: turnStart });
    if (id == null) return JSON.stringify({ ok: false, error: 'No pude registrar la acción pendiente.' });
    return JSON.stringify({ ok: true, pendiente_id: id, resumen, vence_en_min: TTL_MIN, instruccion: 'Diles qué vas a hacer y pide que confirmen con un "sí" para ejecutarlo.' });
  };

  return async (name, input) => {
    switch (name) {
      case 'listar_secuencias_nutricion': {
        const secs = await runWithWorkspace(ws, () => getSecuenciasConStats());
        return JSON.stringify(secs.map((s) => ({ id: s.id, nombre: s.nombre, etapa: s.etapa, activa: s.activa })));
      }

      case 'listar_campanas_meta': {
        // ⚠️ DOS COSAS QUE ESTA TOOL DECÍA MAL (2026-09-02). Pesan porque es la
        // ÚNICA que le da números de Meta a MaKo por WhatsApp: las leía el dueño,
        // en un chat, sin ninguna pantalla que lo contradijera.
        //
        // 1) LA MONEDA. `spend` viene de Meta en la MONEDA DE LA CUENTA — MXN en
        //    las cuentas configuradas así, que son las que tenemos. El campo se
        //    llamaba `gasto_reciente_usd`: pesos etiquetados como dólares, 17,3x
        //    inflado. Ahora van los DOS números con el nombre que les corresponde,
        //    que es el contrato que el resto del repo ya usa para lo mismo
        //    (lib/metricas-modelo.ts: `meta_inversion` + `meta_inversion_usd` +
        //    bloque `moneda`). El USD es un DERIVADO de un tipo de cambio FIJO
        //    escrito a mano en lib/config.ts, no lo que cobró Meta.
        //
        // 2) LA VENTANA. Era `.limit(600)` sin filtro de fecha: como hay una fila
        //    por ANUNCIO por día, cuántos días entraban lo decidía cuántos anuncios
        //    estuvieran corriendo (~50 días con 12 anuncios, ~6 días con 100), y el
        //    campo se llamaba «reciente» sin decir de cuánto. MaKo sumaba una
        //    ventana que no conocía y no avisaba que estaba recortada. Ahora la
        //    ventana es FIJA, se lee ENTERA (paginada: `.limit()` no levanta el
        //    techo de 1000 filas de PostgREST, corta en silencio) y va DICHA en la
        //    respuesta para que MaKo la pueda repetir.
        const DIAS = 30;
        const hasta = hoyEnTz(await tzDeWorkspace(ws));
        const desde = diasAntes(hasta, DIAS - 1);
        // ⚠️ LA MONEDA ES LA DE LA CUENTA, y el campo lleva su nombre. Hasta el 08/10/2026 esto
        // devolvía `gasto_mxn` y `gasto_usd = spend / 17,3` para todos, y ws13, ws14 y ws15
        // cobran en USD: MaKo decía «1.336 MXN ≈ 77 USD» sobre 1.336 dólares. Un modelo sólo
        // ve este JSON, así que la unidad va en el NOMBRE (AGENTS.md, «Lo que le devuelve una
        // tool a un modelo…»). Sin moneda conocida, `gasto_moneda_cuenta` y sin USD.
        const moneda = await runWithWorkspace(ws, () => monedaCuentaMeta()).catch(() => null);
        const conv = conversorDeGasto(moneda);
        const campoGasto = moneda ? `gasto_${moneda.toLowerCase()}` : 'gasto_moneda_cuenta';
        const conUsd = moneda !== 'USD';
        const { campanas, omitidas } = await runWithWorkspace(ws, async () => {
          const db = await getTenantDb();
          const map = new Map<string, { id: string; nombre: string; gasto: number }>();
          await leerPorPaginas<{ campaign_id: string | null; campaign_name: string | null; spend: number | null }>(
            db, 'marketing_metrics_daily', 'campaign_id, campaign_name, spend, fecha',
            (filas) => {
              for (const r of filas) {
                if (!r.campaign_id) continue;
                const prev = map.get(r.campaign_id) ?? { id: r.campaign_id, nombre: r.campaign_name ?? '(sin nombre)', gasto: 0 };
                prev.gasto += Number(r.spend ?? 0);
                if (r.campaign_name) prev.nombre = r.campaign_name;
                map.set(r.campaign_id, prev);
              }
            },
            { filtros: (q) => q.not('campaign_id', 'is', null).gte('fecha', desde).lte('fecha', hasta) },
          );
          const todas = [...map.values()].sort((a, b) => b.gasto - a.gasto);
          return {
            campanas: todas.slice(0, 40).map((c) => {
              const usd = conUsd ? conv.aUsd(c.gasto) : null;
              return {
                id: c.id,
                nombre: c.nombre,
                [campoGasto]: Math.round(c.gasto),
                ...(usd != null ? { gasto_usd: Math.round(usd) } : {}),
              };
            }),
            omitidas: Math.max(0, todas.length - 40),
          };
        });
        const ventana = { desde, hasta, dias: DIAS };
        // Vacío NO es cero (misma regla que las `advertencias` del reporte de
        // métricas): con la ventana puesta, "no hay filas" puede ser "no corrió
        // nada" o "la sincronización está parada", y decir "no invirtió" es
        // inventar un dato.
        if (!campanas.length) {
          return JSON.stringify({
            ventana,
            campanas: [],
            nota: `No hay campañas de Meta con datos sincronizados entre el ${desde} y el ${hasta}. Eso NO significa que el negocio no haya invertido: puede que no haya corrido nada en estos ${DIAS} días, o que la sincronización esté parada. Dilo así y no des un cero por gasto.`,
          });
        }
        return JSON.stringify({
          ventana,
          moneda: moneda === 'USD'
            ? { gasto: 'USD — la moneda de la cuenta publicitaria de Meta', nota: 'La cuenta cobra en dólares: `gasto_usd` es lo que cobró Meta.' }
            : moneda === 'MXN'
              ? {
                  gasto: 'MXN — la moneda de la cuenta publicitaria de Meta',
                  tipo_cambio_usd_mxn: TIPO_DE_CAMBIO_USD_MXN,
                  nota: '`gasto_usd` es un DERIVADO con un tipo de cambio FIJO del código, no lo que cobró Meta. Si el monto en dólares importa de verdad, que lo verifiquen contra el resumen de facturación de Meta.',
                }
              : { gasto: moneda ? `${moneda} — la moneda de la cuenta publicitaria de Meta` : 'la moneda de la cuenta publicitaria (no se pudo saber cuál)', nota: 'No hay tipo de cambio para esta moneda: no conviertas el gasto por tu cuenta.' },
          campanas,
          ...(omitidas ? { campanas_omitidas: omitidas } : {}),
          instruccion: `Cuando digas un gasto, di SIEMPRE la moneda y el período ("X ${moneda ?? '(la moneda de la cuenta)'} entre el ${desde} y el ${hasta}"). Es el gasto de ESA ventana, no el histórico de la campaña.`,
        });
      }

      case 'proponer_lead': {
        const nombre = str(input, 'nombre');
        if (!nombre) return JSON.stringify({ ok: false, error: 'Falta el nombre. Pedíselo antes de proponer nada.' });
        const telefono = str(input, 'telefono').replace(/\D/g, '');
        const email = str(input, 'email');
        const empresa = str(input, 'empresa');
        const nota = str(input, 'nota');
        try {
          const { crearPropuesta } = await import('@/lib/propuestas');
          // `ref` = idempotencia. Sin esto, el buffer de WhatsApp (que junta los
          // mensajes que llegan seguidos) o un reintento del webhook dejan DOS
          // tarjetas del mismo lead, y el dueño confirma un duplicado creyendo
          // que son dos personas. La llave es lo que identifica a la persona,
          // no el momento: teléfono si hay, si no el nombre.
          const ref = `wa:lead:${telefono || nombre.toLowerCase().replace(/\s+/g, '-')}`;
          const { id, nueva } = await crearPropuesta({
            ws, tipo: 'lead', origen: 'whatsapp', ref,
            datos: { nombre, telefono: telefono || null, email: email || null, empresa: empresa || null, nota: nota || null },
            resumen: `${nombre}${empresa ? ` (${empresa})` : ''}${telefono ? ` · ${telefono}` : ''}`,
          });
          const url = linkApp(`/crm/revisar/${id}`, wsEnContexto());
          return JSON.stringify({
            ok: true, url, nueva,
            instruccion: nueva
              ? 'Pásale el link TAL CUAL para que lo revise y confirme. No pidas confirmación por el chat ni repitas los datos.'
              : 'Ya había una propuesta pendiente para esta persona: es el MISMO link, no se creó otra. Decíselo así y pasáselo.',
          });
        } catch (e) {
          return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      case 'listar_horarios_reunion': {
        const cual = str(input, 'cual').toUpperCase() === 'R2' ? 'R2' as const : 'R1' as const;
        const dias = num(input, 'dias') ?? 7;
        try {
          const { eventType, huecos, tz } = await runWithWorkspace(ws, async () => {
            const et = await eventTypeDeReunion(cual);
            return {
              eventType: et,
              huecos: await huecosDisponibles(et.uri, { dias }),
              tz: await tzDeWorkspace(ws).catch(() => TZ_DEFAULT),
            };
          });
          if (!huecos.length) return JSON.stringify({ ok: true, cual, horarios: [], nota: `No te queda ningún hueco libre para la ${cual} en los próximos ${dias} días.` });
          // Tope de 12: la lista entra en un WhatsApp y el modelo va a mostrar
          // tres o cuatro. Mandarle 200 huecos es pagar tokens por ruido.
          return JSON.stringify({
            ok: true, cual, reunion: eventType.nombre, duracion_min: eventType.duracionMin,
            horarios: huecos.slice(0, 12).map((h) => ({ startIso: h.startIso, cuando: fmtFecha(h.startIso, tz) })),
          });
        } catch (e) {
          // El error de Calendly sube TEXTUAL: «falta el token», «el event type
          // configurado no coincide», «reconectá Zoom». Un "no pude" genérico
          // manda a buscar el problema al lugar equivocado.
          return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      case 'proponer_agendar_reunion': {
        const leadId = num(input, 'leadId');
        const cual = str(input, 'cual').toUpperCase() === 'R2' ? 'R2' as const : 'R1' as const;
        const startIso = str(input, 'startIso');
        if (leadId == null || !startIso) return JSON.stringify({ ok: false, error: 'Faltan leadId o startIso.' });

        const lead = await runWithWorkspace(ws, () => getLead(leadId).catch(() => null));
        if (!lead) return JSON.stringify({ ok: false, error: `No existe el lead #${leadId} en este workspace.` });
        if (!lead.email) return JSON.stringify({ ok: false, error: `${lead.nombre} no tiene email cargado, y Calendly lo exige para reservar. Pídele el email antes.` });

        try {
          // El hueco se valida ANTES de pedirle el "sí" al dueño. Sin esto le
          // pediríamos confirmar algo que va a rebotar dos horas después, y la
          // acción pendiente ya estaría quemada.
          const { huecos, tz } = await runWithWorkspace(ws, async () => {
            const et = await eventTypeDeReunion(cual);
            return { huecos: await huecosDisponibles(et.uri, { dias: 31 }), tz: await tzDeWorkspace(ws).catch(() => TZ_DEFAULT) };
          });
          if (!huecos.some((h) => h.startIso === startIso)) {
            return JSON.stringify({
              ok: false,
              error: 'Ese horario no está entre los libres de Calendly. Copia un startIso EXACTO de listar_horarios_reunion.',
              horarios_libres: huecos.slice(0, 6).map((h) => ({ startIso: h.startIso, cuando: fmtFecha(h.startIso, tz) })),
            });
          }
          return proponer('agendar_reunion', { leadId, cual, startIso },
            `Agendar la ${cual} con ${lead.nombre} para el ${fmtFecha(startIso, tz)} (Calendly le manda la invitación a ${lead.email})`);
        } catch (e) {
          return JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      case 'proponer_cambio_etapa': {
        const leadId = num(input, 'leadId');
        const etapa = str(input, 'etapa');
        if (leadId == null || !etapa) return JSON.stringify({ ok: false, error: 'Faltan leadId o etapa.' });
        const { lead, label, stages } = await runWithWorkspace(ws, async () => {
          const l = await getLead(leadId).catch(() => null);
          // DEL LEAD: la etiqueta y los requisitos que ve el dueño son los del
          // recorrido de ESE lead.
          const f = l ? await getFunnelDeLead(l).catch(() => null) : null;
          const lbl = f?.stages?.find((s) => s.key === etapa)?.label ?? etapa;
          return { lead: l, label: lbl, stages: f?.stages ?? null };
        });
        if (!lead) return JSON.stringify({ ok: false, error: `No existe el lead #${leadId} en este workspace.` });
        const monto = num(input, 'monto');
        const motivo = str(input, 'motivo');
        // Los requisitos se chequean YA, al proponer: si falta el monto o el motivo,
        // MaKo lo pide en la misma respuesta en vez de proponer un movimiento que va
        // a rebotar recién después del "sí" del dueño.
        //
        // Pero SOLO se pide lo que este canal sabe cargar (ver REQUISITOS_PEDIBLES):
        // pedir una fecha de reunión o un link de Fathom por acá es pedir algo que
        // MaKo no tiene dónde escribir, y la conversación entra en bucle.
        const v = veredictoRequisitos(faltantesParaMover(lead, etapa, stages, { monto, motivo: motivo || null }));
        if (!v.ok) {
          return JSON.stringify({
            ok: false,
            faltan: v.pedir.map((f) => f.label),
            error: `Para mover a "${label}" falta cargar: ${etiquetasDe(v.pedir)}. Pide ese dato antes de proponer el movimiento.`,
          });
        }
        const payload: Record<string, unknown> = { leadId, etapa };
        if (monto != null) payload.monto = monto;
        if (motivo) payload.motivo = motivo;
        // Lo que va a quedar sin cargar viaja EN EL RESUMEN, que es lo que el dueño
        // lee antes de decir que sí: un movimiento que deja el lead incompleto no
        // puede anunciarse como si estuviera todo en orden.
        const pendiente = v.sinCargar.length ? ` — queda sin cargar: ${etiquetasDe(v.sinCargar)}` : '';
        return proponer('lead_etapa', payload, `Mover a ${lead.nombre ?? `lead #${leadId}`} → etapa "${label}"${monto != null ? ` ($${monto})` : ''}${motivo ? ` (motivo: ${motivo})` : ''}${pendiente}`);
      }

      case 'proponer_toggle_nutricion': {
        const secuenciaId = num(input, 'secuenciaId');
        if (secuenciaId == null) return JSON.stringify({ ok: false, error: 'Falta secuenciaId.' });
        const activa = Boolean((input as { activa?: unknown }).activa);
        const sec = await runWithWorkspace(ws, async () => (await getSecuenciasConStats()).find((s) => s.id === secuenciaId));
        if (!sec) return JSON.stringify({ ok: false, error: `No existe la secuencia #${secuenciaId}.` });
        // ⚠️ ACTIVAR SE VALIDA AL PROPONER, no sólo al confirmar (regla 3 de la API de MaKo): un flujo
        // que Publicar no dejaría guardar se sabe sin escribir. Validado sólo en `setSecuenciaActiva`,
        // el «sí» reclamaba la pendiente y después la rechazaba, y había que volver a pedirlo.
        if (activa) {
          try {
            await runWithWorkspace(ws, () => validarActivacion(secuenciaId));
          } catch (e) {
            if (e instanceof PasosInvalidosError) return JSON.stringify({ ok: false, error: e.message });
            throw e;
          }
        }
        return proponer('nutricion_toggle', { secuenciaId, activa }, `${activa ? 'Activar' : 'Pausar'} la secuencia de nutrición "${sec.nombre}"`);
      }

      case 'proponer_renombrar_campana': {
        const campaignId = str(input, 'campaignId');
        const nombre = str(input, 'nombre');
        if (!/^\d+$/.test(campaignId) || !nombre) return JSON.stringify({ ok: false, error: 'campaignId (numérico) y nombre son obligatorios.' });
        return proponer('meta_nombre', { campaignId, nombre }, `Renombrar la campaña ${campaignId} → "${nombre}"`);
      }

      case 'proponer_estado_campana': {
        const campaignId = str(input, 'campaignId');
        const estado = str(input, 'estado').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
        if (!/^\d+$/.test(campaignId)) return JSON.stringify({ ok: false, error: 'campaignId (numérico) es obligatorio.' });
        return proponer('meta_estado', { campaignId, estado }, `${estado === 'ACTIVE' ? 'Activar' : 'Pausar'} la campaña ${campaignId}`);
      }

      case 'proponer_tareas_plan': {
        const raw: unknown[] = Array.isArray((input as { tareas?: unknown }).tareas) ? (input as { tareas: unknown[] }).tareas : [];
        const tareas = raw
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((x) => ({ titulo: typeof x.titulo === 'string' ? x.titulo.trim().slice(0, 200) : '', prioridad: prioOk(x.prioridad), // `canonNombre`: si el modelo escribió «CRM», el proyecto se llama «Feature: CRM».
            // El prefijo no puede depender de que se acuerde de escribirlo. Para un nombre
            // que no está en el catálogo lo deja igual — ahí manda el Perro al aplicar.
            proyecto: x.proyecto ? canonNombre(String(x.proyecto).trim()).slice(0, 120) : undefined, deadline: typeof x.deadline === 'string' && x.deadline ? String(x.deadline) : undefined, detalle: typeof x.detalle === 'string' && x.detalle ? String(x.detalle).slice(0, 6000) : undefined }))
          .filter((t) => t.titulo);
        if (!tareas.length) return JSON.stringify({ ok: false, error: 'No hay ninguna tarea con título. Resuelve lo deducible con ver_plan; si falta info, escríbela en el "detalle" — no preguntes por aquí.' });
        // CANDADO: el mensaje era un "sí" pelado y no una lista → las tareas no salen
        // de lo que el dueño acaba de decir, salen de la memoria del modelo. Cortarlo acá
        // (no con una instrucción en el prompt) es lo único que evita que reviva
        // conversaciones viejas y duplique lo que ya está en el board.
        if (pareceConfirmacion(mensajeUsuario)) {
          return JSON.stringify({
            ok: false,
            error: 'CONFIRMACIÓN SIN LISTA: el último mensaje es un "sí/dale" y no trae las tareas. NO inventes ni las saques del historial — pueden ser de otra conversación. Pregunta a QUÉ lista se refiere, o si venía de una reunión dile que entre al plan a confirmarla, o pídele que te la pegue.',
          });
        }
        const eliminarRaw = (input as { eliminar?: unknown }).eliminar;
        const eliminar = Array.isArray(eliminarRaw)
          ? eliminarRaw.map((e) => { const o = (e ?? {}) as Record<string, unknown>; return { id: String(o.id ?? '').trim().slice(0, 80), motivo: o.motivo ? String(o.motivo).slice(0, 300) : undefined }; }).filter((e) => e.id).slice(0, 30)
          : [];
        const resumen = `Agregar ${tareas.length} tarea${tareas.length === 1 ? '' : 's'} al plan${eliminar.length ? ` y borrar ${eliminar.length}` : ''}`;

        // BORRADOR + link a /plan/revisar para TODOS (dueño y clientes): nada de ida-y-vuelta
        // ni "sí" por WhatsApp. Sin preguntas: el alta no pregunta nada desde el 05/10/2026.
        try {
          const id = await crearPropuesta({ tareas: tareas.map((t) => ({ titulo: t.titulo, proyecto: t.proyecto, deadline: t.deadline, detalle: t.detalle, prioridad: t.prioridad })), eliminar, resumen, origen: 'whatsapp' });
          const link = linkApp(`/plan/revisar/${id}`, wsEnContexto());
          // Los números van SIEMPRE, incluido el cero. Antes `extras` quedaba vacío cuando
          // no había preguntas y el modelo rellenaba el hueco inventando: se midió en prod
          // que anunciaba «y 3 preguntas» en los seis borradores de WhatsApp del día, y
          // los seis tenían cero. Un hueco en la instrucción se llena solo.
          const extras = `${eliminar.length} baja${eliminar.length === 1 ? '' : 's'} sugerida${eliminar.length === 1 ? '' : 's'}`;
          return JSON.stringify({ ok: true, borrador: true, link, tareas: tareas.length, eliminar: eliminar.length, // ⛔ El link es el punto FRÁGIL de todo esto: el id son 17 caracteres al azar
// («propmskimbc4s4b4h») y el modelo lo tiene que copiar en su mensaje. Se midió
// mal en prod —un link que apuntaba a otro borrador— así que la instrucción lo
// dice explícito. Y como una instrucción no es una garantía, /plan/revisar/[id]
// tiene la red: si el id no existe, ofrece los borradores pendientes que sí hay.
instruccion: `Armaste un BORRADOR con ${tareas.length} tarea${tareas.length === 1 ? '' : 's'}, ${extras}. Manda UNA línea corta + este link para que lo revisen y confirmen EN LA APP (NO pidas "sí" aquí, NO repitas la lista). ⛔⛔ EL LINK SE COPIA Y SE PEGA TAL CUAL, carácter por carácter — no lo reescribas de memoria ni lo acortes: un solo carácter cambiado lo manda a un borrador que no es, o a ninguno. ⛔ Si das un número, usa EXACTAMENTE estos — no inventes ninguno. ⛔ El proyecto de cada tarea lo decide el Perro Guardián al aplicar: NO lo menciones. Link: ${link}` });
        } catch (e) {
          return JSON.stringify({ ok: false, error: `No pude armar el borrador: ${e instanceof Error ? e.message : 'error'}` });
        }
      }

      case 'listar_pendientes': {
        const vig = await pendientesVigentes(ws, grupoJid);
        if (!vig.length) return 'No hay acciones pendientes de confirmar en este grupo.';
        // La hora se muestra en la zona del workspace: con Tijuana fijo, a un cliente
        // en Montevideo le decíamos que su acción vencía 4 h antes de lo que vence.
        const tz = await tzDeWorkspace(ws);
        return JSON.stringify(vig.map((p) => ({ id: p.id, resumen: p.resumen, vence: fmtFecha(p.venceAt, tz) })));
      }

      case 'confirmar_accion':
      case 'cancelar_accion': {
        const id = num(input, 'id');
        const vig = await pendientesVigentes(ws, grupoJid);
        if (!vig.length) return 'No hay ninguna acción pendiente vigente para ' + (name === 'confirmar_accion' ? 'confirmar' : 'cancelar') + '.';
        const target = id != null ? vig.find((p) => p.id === id) : (vig.length === 1 ? vig[0] : undefined);
        if (!target) {
          if (id != null) return `No encuentro la acción #${id} vigente. Vigentes: ${vig.map((p) => `#${p.id} (${p.resumen})`).join('; ')}`;
          return `Hay ${vig.length} acciones pendientes, aclara cuál: ${vig.map((p) => `#${p.id} (${p.resumen})`).join('; ')}`;
        }
        if (name === 'cancelar_accion') {
          await resolverPendiente(ws, target.id, 'cancelada');
          return `Cancelada: ${target.resumen}`;
        }
        // Guard anti auto-confirm: si la pendiente se creó en ESTE mismo turno, no la
        // ejecutamos. El "sí" del dueño es un mensaje aparte (turno posterior). 1.5s de
        // margen por el skew reloj-app/DB. Bloquea que el modelo proponga Y confirme solo.
        if (turnStart && target.createdAt && Date.parse(target.createdAt) >= turnStart - 1500) {
          return 'Recién propuse esa acción en este mismo mensaje. NO la confirmes tú: frena y espera a que el dueño mande un "sí" aparte.';
        }
        // RECLAMAR antes de ejecutar. Esta pendiente ahora también se ve en la bandeja
        // de la app (/mako/pendientes): sin esto, un «sí» acá y un click allá sobre la
        // misma fila la ejecutaban dos veces. Una sola confirmación gana.
        // Lo que el registro manda a PANTALLA (plata) tampoco se confirma por este
        // camino viejo. Misma guarda que lib/api-mako/acciones.ts#confirmarPendiente.
        const defReg = porId(target.tipo);
        if (defReg && esAccion(defReg) && defReg.confirmacion === 'pantalla') {
          await resolverPendiente(ws, target.id, 'error', 'se confirma en pantalla, no por chat');
          return 'Esa acción se confirma en su pantalla de revisión, no por el chat: la pendiente quedó cerrada sin ejecutar.';
        }
        if (!(await reclamarPendiente(ws, target.id))) {
          return 'Esa acción ya se estaba ejecutando o ya venció: no la vuelvo a correr.';
        }
        const res = await ejecutarAccion(ws, target.tipo, target.payload);
        await resolverPendiente(ws, target.id, res.ok ? 'ejecutada' : 'error', res.resumen);
        return res.ok ? `✅ Hecho: ${res.resumen}` : `❌ No se pudo: ${res.resumen}`;
      }

      default:
        return { content: `Acción desconocida: ${name}`, isError: true };
    }
  };
}
