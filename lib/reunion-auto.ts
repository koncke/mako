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
import { resolverClienteDeReunion, nombreDeProyectoPara } from './reunion-cliente';
import type { TipoReunion } from './reunion-clasificar';
import { APP_BASE_URL as APP_URL } from './app-url';

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
type ReunionHecha = { titulo: string; fecha: string | null; conQuien: string; mias: number; otras: number; partesFallidas?: number };

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
  /** Las que entran al plan: equipo + entrega. Se llamaba `deEquipo`, y al sumar
   *  las de entrega el log decía «equipo=4» contando reuniones con clientes. Un
   *  nombre que miente cuesta el próximo diagnóstico. */
  miradas: number; alPlan: number; nuevas: number; conTareas: number; tareas: number; errores: number;
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
  const { reuniones } = await listReunionesRecientes({ limit: 20, createdAfter: desde });
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
      const { tareas, partesFallidas = 0, cabecera = '' } = await extraerTareasDeReunion(r.recordingId, proyectos, yo, {
        glosario, participantes: r.participantes, usoMotivo: 'Reunión nueva → tareas al plan (automático)',
      });
      // Lectura PARCIAL: se leyó parte del transcript y otra parte se perdió.
      const parcial = partesFallidas > 0;
      // El cache es también la lista blanca de a quién se le puede mandar algo de esta
      // reunión (/api/plan-reunion), y evita que re-abrirla en la app vuelva a cobrar.
      // SOLO si hubo tareas: cachear un resultado vacío le serviría ese vacío al botón
      // manual ("MaKo no encontró nada") escondiendo que fue una corrida fallida.
      if (tareas.length) {
        await setSetting(cacheKeyReunion(r.recordingId), JSON.stringify({ tareas, participantes: r.participantes, ts: Date.now() })).catch(() => {});
      }

      // "No devolvió tareas" NO es lo mismo que "no había compromisos": si algún tramo
      // del transcript falló (429, timeout, JSON inválido), la lista sale vacía igual.
      // Marcarla como vista ahí la quemaba PARA SIEMPRE — pasó de verdad ("no jaló la
      // IA, no hubo de Esquer") y no había forma de enterarse. Ahora, si hubo fallas,
      // la reunión NO se marca: el próximo cron la reintenta.
      // ⚠️ ESTO VA ANTES DEL `continue` DE ABAJO, Y ESE ES EL PUNTO.
      // Una sesión de entrega donde se afina el Norte y no queda un solo
      // compromiso accionable es el caso NORMAL del programa, no la excepción.
      // Con el bloque de CS después del `continue`, esa junta —la más típica—
      // no reescribía nada y el cliente nunca veía qué aprobar. Y peor: la
      // reunión quedaba marcada como vista, así que no se reintentaba nunca.
      //
      // Reescribir la tarea del cliente NO depende de que la junta haya dejado
      // tareas para el plan. Son dos cosas distintas que pasan en la misma
      // llamada.
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

      // ── El bucle de entrega: MaKo mejora la tarea que el cliente ya contestó ──
      // Solo en juntas de ENTREGA y con el cliente identificado. Va con `cabecera`
      // (el resumen y los action items de Fathom), NO con `tareas`: de una lista de
      // títulos sale una reescritura plausible y vacía.
      //
      // En su propio try/catch: si esto falla, el borrador de tareas —que es lo
      // que la persona está esperando— tiene que quedar igual. Misma disciplina
      // que el resto de la función.
      if (r.tipo === 'entrega' && cliente && cabecera) {
        try {
          const { reescribirBloquesDeLaJunta } = await import('./cs-reescritura');
          const cs = await reescribirBloquesDeLaJunta({
            leadId: cliente.leadId, conversacion: cabecera, fuenteReunion: ref,
          });
          if (cs.reescritos.length || cs.sinMaterial || cs.errores) {
            console.log(`[reunion-auto] CS ws=${ws} ${cliente.nombre}: ${cs.reescritos.length} bloque(s) reescrito(s), ` +
              `${cs.sinMaterial} sin material, ${cs.errores} con error`);
          }
        } catch (e) {
          console.error('[reunion-auto] la reescritura de bloques falló (el borrador sigue):', e);
        }
      }
      if (!tareas.length) {
        if (parcial) {
          out.errores += 1;
          console.error(`[reunion-auto] ws=${ws} recording=${r.recordingId} «${r.titulo}»: la lectura FALLÓ (${partesFallidas} tramo(s) sin leer) — queda para reintentar`);
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
      // La regla: se reparte SOLO a gente del workspace. Lo demás queda como tarea
      // propia con el nombre adentro del detalle, que es donde ya vive el contexto.
      // `listarUsuarios()` es cross-workspace (los admins tienen workspace_id null),
      // así que se filtra a mano: cuentan los de ESTE workspace y los admins, que
      // cruzan a propósito. Un email que no está en ninguno de los dos es de afuera.
      const delEquipo = new Set(
        (await listarUsuarios().catch(() => []))
          .filter((u) => u.workspace_id === ws || u.rol === 'admin')
          .map((u) => (u.email ?? '').trim().toLowerCase())
          .filter(Boolean),
      );
      const repartible = (email: string | undefined | null): boolean =>
        Boolean(email && delEquipo.has(email.trim().toLowerCase()));

      const propuestas: PropuestaTarea[] = tareas.map((t) => ({
        titulo: t.titulo,
        detalle: t.detalle || undefined,
        prioridad: t.prioridad,
        // …o el nombre que PROPUSO el modelo cuando el proyecto todavía no existe. Se
        // descartaba acá, así que las tareas del cron nacían sueltas aunque la reunión
        // hubiera dicho a qué proyecto iban (el server sabe crearlo por nombre).
        // Con cliente detectado MANDA el cliente: lo que haya elegido el modelo se
        // ignora (es justo lo que repartía una misma llamada en proyectos temáticos).
        proyecto: proyCliente || (t.proyectoId ? nombreProy.get(t.proyectoId) : (t.proyectoNombre?.trim() || undefined)),
        // El nombre se conserva SIEMPRE (es información de la reunión); lo que se
        // corta es el reparto a alguien que no está en el workspace.
        dueno: t.dueño || undefined,
        duenoEmail: repartible(t.dueñoEmail) ? t.dueñoEmail : undefined,
        esDeOtro: t.esDeOtro && repartible(t.dueñoEmail) ? true : undefined,
        // El MINUTO en que se dijo. Se perdía acá: la extracción lo trae, el borrador
        // lo declara y aplicarPropuestas lo usa para armar el link a la grabación
        // parada en ese segundo — pero este map no lo copiaba, así que toda tarea que
        // venía del cron nacía sin el deep-link (25 de la reunión de Leila, sin reloj).
        minuto: t.minuto,
        minutos: t.minutos,
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
        // El número que se promete es el de TUS compromisos, no el total: las de otras
        // personas no se crean acá (viajan a su tablero), así que anunciar 34 y crear 13
        // hace que la pantalla y el resultado no coincidan.
        resumen: `MaKo leyó tu reunión${r.titulo ? ` «${r.titulo}»` : ''}${conQuien ? ` con ${conQuien}` : ''} y sacó ${mias} ${mias === 1 ? 'compromiso tuyo' : 'compromisos tuyos'}${propuestas.length > mias ? ` (y ${propuestas.length - mias} de otras personas, para repartir)` : ''}.`,
      });
      // RECIÉN ACÁ se cierra la reunión: el borrador ya está guardado. Antes esto
      // corría ANTES de crearPropuesta (con otra llamada de IA en el medio), así que
      // un error de base o un corte del serverless dejaba la reunión marcada como
      // procesada y SIN borrador: las tareas se perdían para siempre, sin reintento
      // ni aviso. El candado tiene que escribirse después del efecto que protege.
      await setSetting(KEY_VISTA(r.recordingId), new Date().toISOString()).catch(() => {});
      if (parcial) console.warn(`[reunion-auto] ws=${ws} recording=${r.recordingId}: borrador creado con ${partesFallidas} tramo(s) SIN leer — puede faltar contenido`);
      out.conTareas += 1;
      out.tareas += propuestas.length;
      hechas.push({ titulo: r.titulo, fecha: r.fecha, conQuien, mias, otras: propuestas.length - mias, partesFallidas });
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
