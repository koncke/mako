// =============================================================================
// cs-cartera — los clientes de ESTE workspace y cómo va cada uno
// =============================================================================
// Customer Success es la pantalla donde el dueño de un workspace ve a SUS
// CLIENTES —los leads GANADOS del CRM— y cómo va la entrega de lo que les
// vendió. No es el CRM (eso es antes de la venta) ni el tablero (eso es el
// trabajo). Es «¿cómo va cada cliente que ya compró, y qué le debo?».
//
// ⚠️ ESTO SE REESCRIBIÓ DE CERO EL 26/09/2026, Y EL PORQUÉ IMPORTA. La versión
// anterior giraba alrededor del programa de 44 clases de UN cliente (el ws1):
// bloques contestados, clases vistas, el link de su cuestionario, el avance del
// temario. Nada de eso es universal —es SU sistema, no un molde vacío— y la
// pantalla entera estaba detrás de un guard que leía `OWNER_WS`. Medido: fuera
// de ese workspace hay 13 clientes en 2 workspaces más, y su perfil de señales
// es el OPUESTO (WhatsApp vivo, cero sesiones, cero proyectos).
//
// LO QUE SOBREVIVE A LOS TRES WORKSPACES, y por eso es lo que esta cartera lee:
// quién es · hace cuánto es cliente · qué se le prometió · cuándo fue la última
// conversación (sea sesión o WhatsApp, lo que haya) · qué le falta pagar. El
// trabajo del tablero se le enchufa después (ver `conTrabajo`, lib/cs-senal.ts):
// el cruce cliente ↔ proyecto necesita la lista de clientes, así que son dos pasos.
// ⚠️ QUIEN LO ENCHUFA ES MaKo (`carteraConTrabajo`, lib/api-mako/areas/cs.run.ts), que es
// el ÚNICO lector de esta función: la pantalla de Customer Success no la usa desde la poda
// del 26/09/2026. Hasta el 06/10/2026 este comentario decía que lo hacía la página, y no
// lo hacía nadie — `tareasAtrasadas` era null para todos por la API.
//
// ⚠️ CADA LECTURA PUEDE FALLAR, Y ESO NO ES UN CERO. `pagos`, `closing_analyses`
// y `wa_mensajes` vuelven con un `ok` propio: un error de consulta convertido en
// `[]` hace que la pantalla afirme «no debe nada» y «nadie le escribió» sobre
// datos que nunca se leyeron. Ya pasó acá (la columna de `pagos` es
// `fecha_esperada`, no `fecha_vencimiento`: la consulta fallaba entera y el
// catch juraba 0 cuotas vencidas para los 14).
//
// NADA DE HEALTH SCORE: ver el encabezado de lib/cs-senal.ts.

import 'server-only';
import { getTenantDb } from './workspace';
import { relojDe, promesaDe, type Reloj } from './cs-contrato';
import { leerTodo } from './supabase-paginado';
import { senalDe, ordenCartera, type HechosCliente, type Senal } from './cs-senal';

/** Dónde está el cliente en la entrega. `graduado` y `baja` son DECISIONES de
 *  una persona, no cálculos: que el plazo del contrato se haya cumplido no dice
 *  que el trabajo haya terminado. */
export type EstadoCliente = 'activo' | 'graduado' | 'baja' | 'pausado';

export type ClienteCartera = HechosCliente & {
  leadId: number;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;

  /** ¿Cuál necesita atención hoy? Es lo que ordena la lista. */
  senal: Senal;

  /** El reloj sale del CONTRATO de este cliente, no de una constante. Puede
   *  venir incompleto —y entonces la pantalla dice «—», no un número—. */
  reloj: Reloj;
  /** Lo que se le prometió: es lo primero que hay que tener a mano antes de
   *  hablar con él. Medido: es la única parte del deal que existe fuera del ws1
   *  (10 de 11 en ws11 contra 5 de 14 en ws1). */
  promesa: { resultado: string | null; garantia: string | null; queEs: string | null; sesiones: string | null };
  estado: EstadoCliente;

  /** Cuándo cerró la venta. El único campo que no falta nunca (27 de 27). */
  cierre: string | null;

  sesiones: number;
  ultimaSesionHace: number | null;
  ultimaSesionTitulo: string | null;

  /** Días desde el último WhatsApp, lo haya mandado quien lo haya mandado.
   *  ⚠️ NO hay un conteo de mensajes a propósito: medido en ws11, los mensajes
   *  huérfanos (sin `lead_id`, pero con el teléfono del cliente) no cambian la
   *  FECHA del último en ninguno de los 11, y sí achican el conteo. «Hace X
   *  días» es cierto; «N mensajes» quedaría corto y nadie lo notaría. */
  ultimoMensajeHace: number | null;
};

const dias = (iso: string | Date | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
};

/** El menor de dos «hace cuántos días», ignorando los que no existen. */
const masReciente = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.min(a, b);

// ─────────────────────────────────────────────────────────────────────────────

type LeadGanado = {
  id: number; nombre: string | null; email: string | null; telefono: string | null;
  empresa: string | null; fecha_inicio_servicio: string | null; fecha_cierre: string | null;
  duracion_meses: number | null; deal_servicio: unknown; deal_promesa: unknown;
};
type Ses = { recording_id: number; lead_id: number; call_date: string | null; title: string | null };
type Cuo = { lead_id: number; fecha_vencimiento: string | null };
type Wa = { lead_id: number; from_me: boolean; wa_timestamp: string | null };
type Est = { lead_id: number; estado: EstadoCliente };

/** Una lectura que sabe si pudo leer. `[]` y «falló» son dos respuestas. */
type Leida<T> = { ok: boolean; filas: T[] };

const porLead = <T extends { lead_id: number }>(xs: T[]) => {
  const m = new Map<number, T[]>();
  for (const x of xs) { const a = m.get(x.lead_id) ?? []; a.push(x); m.set(x.lead_id, a); }
  return m;
};

/**
 * La cartera del workspace ACTUAL. Sin excepciones para nadie: el super-admin
 * que abre a un cliente lo hace con la pestaña puesta, igual que en cualquier
 * otra tab, y `getTenantDb()` resuelve el inquilino por dentro.
 */
export async function cartera(): Promise<ClienteCartera[]> {
  const db = await getTenantDb();

  // Paginado por `id`: el día que un workspace pase los 1000 ganados un
  // `.select()` suelto los corta en silencio, y los que caen dejan de existir
  // para Customer Success.
  //
  // ⚠️ Si ESTA lectura falla, no hay cartera y punto: sin la lista de clientes
  // no hay pantalla que armar, así que el error sube.
  const leads = await leerTodo<LeadGanado>(db, 'leads',
    'id, nombre, email, telefono, empresa, fecha_inicio_servicio, fecha_cierre, duracion_meses, deal_servicio, deal_promesa',
    { orden: 'id', eq: { estado_lead: 'ganado' } },
  );
  if (!leads.length) return [];
  const ids = leads.map((l) => l.id);

  // Todo lo pesado se pide UNA vez para toda la cartera, no cliente por cliente.
  // Cada una pagina por su columna ÚNICA (recording_id / id), nunca por fecha:
  // un orden con empates reparte distinto entre páginas y saltea filas.
  const leer = async <T,>(tabla: string, cols: string, orden: string,
    extra?: Parameters<typeof leerTodo>[3]): Promise<Leida<T>> => {
    try {
      const filas = await leerTodo<T>(db, tabla, cols, { orden, ...extra, filtros: (q) => q.in('lead_id', ids) });
      return { ok: true, filas };
    } catch {
      return { ok: false, filas: [] };
    }
  };

  const [sesiones, cuotas, mensajes, estados] = await Promise.all([
    leer<Ses>('closing_analyses', 'recording_id, lead_id, call_date, title', 'recording_id'),
    // ⚠️ `pagos` NO tiene `fecha_vencimiento`: la columna es `fecha_esperada`. Se
    // aliasa para no repetir el nombre en todo el cálculo. Pedir la inexistente
    // hacía fallar la consulta entera y la cartera juraba «0 vencidas».
    leer<Cuo>('pagos', 'lead_id, pagado, fecha_vencimiento:fecha_esperada', 'id', { eq: { pagado: false } }),
    // ⚠️ SE LEE EL HISTORIAL COMPLETO DE LOS GANADOS, no una ventana de tiempo.
    // Son 4 escalares por fila y está acotado a los clientes (ws1: 2.235 filas,
    // ws11: 561). Una ventana de N días haría que «nunca hablaron» y «hablaron
    // hace más de N» se vieran iguales, que es justo lo que no se puede afirmar.
    leer<Wa>('wa_mensajes', 'id, lead_id, from_me, wa_timestamp', 'id'),
    leer<Est>('cs_clientes', 'id, lead_id, estado', 'id'),
  ]);

  // La última sesión va primero. Se ordena ACÁ y no en la consulta: `call_date`
  // se repite y admite null, así que no sirve para paginar — y un `order(desc)`
  // pone los null PRIMERO (default de Postgres), con lo que una grabación sin
  // fecha pasaba por «última sesión».
  sesiones.filas.sort((a, b) =>
    (a.call_date == null ? 1 : 0) - (b.call_date == null ? 1 : 0) ||
    (b.call_date ?? '').localeCompare(a.call_date ?? '') ||
    b.recording_id - a.recording_id);

  const sesionesDe = porLead(sesiones.filas);
  const cuotasDe = porLead(cuotas.filas);
  const mensajesDe = porLead(mensajes.filas);
  const estadoDe = new Map(estados.filas.map((e) => [e.lead_id, e.estado]));

  const hoy = new Date().toISOString().slice(0, 10);
  // El contacto se afirma con las DOS lecturas: si una falló, «no hay
  // conversación» podría ser «no miré la mitad».
  const contactoLeido = sesiones.ok && mensajes.ok;

  const filas: ClienteCartera[] = leads.map((l) => {
    const ses = sesionesDe.get(l.id) ?? [];
    const impagas = cuotasDe.get(l.id) ?? [];
    const vencidas = impagas.filter((p) => p.fecha_vencimiento && p.fecha_vencimiento <= hoy);
    const vencidaMasVieja = vencidas.map((p) => p.fecha_vencimiento!).sort()[0] ?? null;

    // El último mensaje por FECHA, no por orden de inserción: un backfill mete
    // mensajes viejos con id nuevo.
    const wa = (mensajesDe.get(l.id) ?? [])
      .filter((m) => m.wa_timestamp)
      .sort((a, b) => (b.wa_timestamp ?? '').localeCompare(a.wa_timestamp ?? ''))[0] ?? null;

    const ultimaSesionHace = dias(ses[0]?.call_date);
    const ultimoMensajeHace = dias(wa?.wa_timestamp);
    const ultimoContactoHace = masReciente(ultimaSesionHace, ultimoMensajeHace);
    const ultimoContactoFue: 'sesion' | 'whatsapp' | null =
      ultimoContactoHace === null ? null
        : ultimoContactoHace === ultimaSesionHace ? 'sesion' : 'whatsapp';

    // Espera respuesta sólo si el último mensaje lo mandó ÉL y no hubo una
    // sesión después: hablar por teléfono también es contestar.
    const esperaRespuestaHace = wa && !wa.from_me && ultimoMensajeHace !== null
      && (ultimaSesionHace === null || ultimaSesionHace > ultimoMensajeHace)
      ? ultimoMensajeHace : null;

    const reloj = relojDe(l);
    const promesa = promesaDe(l);
    // «Tiene contrato» = hay algo escrito de lo que se le vendió. Un cliente sin
    // esto no está bien ni mal: no hay con qué saberlo (ver cs-senal.ts).
    const tieneContrato = Boolean(
      promesa.resultado || promesa.queEs || promesa.garantia || promesa.sesiones
      || reloj.semanasTotales,
    );

    const hechos: HechosCliente = {
      diasDesdeElCierre: dias(l.fecha_cierre),
      cobrosLeidos: cuotas.ok,
      cuotasVencidas: vencidas.length,
      cuotaVencidaDias: dias(vencidaMasVieja),
      cuotasImpagasSinFecha: impagas.filter((p) => !p.fecha_vencimiento).length,
      contactoLeido,
      ultimoContactoHace,
      ultimoContactoFue,
      esperaRespuestaHace,
      tieneContrato,
      contratoTerminado: reloj.terminado,
      // El tablero todavía no se leyó: lo enchufa `conTrabajo` quien lee la cartera
      // (MaKo, lib/api-mako/areas/cs.run.ts). `null` es «no lo sé», que es
      // exactamente lo que se sabe en este punto.
      tareasAbiertas: null,
      tareasAtrasadas: null,
    };

    return {
      ...hechos,
      leadId: l.id,
      nombre: (l.nombre ?? '').trim() || 'Sin nombre',
      empresa: l.empresa,
      email: l.email,
      telefono: l.telefono,
      senal: senalDe(hechos),
      reloj,
      promesa,
      estado: estadoDe.get(l.id) ?? 'activo',
      cierre: l.fecha_cierre,
      sesiones: ses.length,
      ultimaSesionHace,
      ultimaSesionTitulo: ses[0]?.title ?? null,
      ultimoMensajeHace,
    };
  });

  return filas.sort(ordenCartera);
}
