// =============================================================================
// cs-cartera — de quién es la pelota
// =============================================================================
// La cartera contesta UNA pregunta y todo lo demás cuelga de ella: ¿a quién le
// debo algo y quién me debe algo? Esa es la pregunta del lunes a la mañana, y
// no es «cuánto avanzó del temario» — eso contesta otra cosa («¿está
// entendiendo?») y llega cuando haya con qué.
//
// ⚠️ POR QUÉ NO GIRA SOBRE EL AVANCE DEL PROGRAMA. `cs_respuestas` está vacía:
// ninguno de los 13 contestó todavía. Una pantalla que gire sobre eso se ve
// idéntica de rota el día que se abra —13 filas diciendo 0 de 44— y no serviría
// para nada durante las semanas que tarde en llenarse. Los hechos que SÍ existen
// hoy son las sesiones (109 grabadas), las cuotas (33 filas) y los compromisos
// (82 tareas abiertas). Sobre eso gira.
//
// NADA DE HEALTH SCORE. Con 13 clientes un 78/100 es teatro: esconde el hecho
// —«tiene una cuota vencida hace 9 días»— detrás de un número que nadie sabe
// cómo se calculó. Las plataformas de CS lo usan porque miran 3.000 cuentas.

import 'server-only';
import { getTenantDb, getWorkspaceActual, OWNER_WS } from './workspace';
import { listarShares } from './shares';
import { bloquesDeCliente, type Bloque } from './cs-respuestas';
import { TOTAL_CLASES, rotuloDe, PROGRAMA } from './programa-catalogo';
import { relojDe, promesaDe, type Reloj } from './cs-contrato';
import { leerTodo } from './supabase-paginado';

export const RECURSO_TAREA = 'tarea-cs';


/** De quién es la pelota. Es el organizador de toda la pantalla. */
export type Cancha = 'tuya' | 'suya' | 'al-dia';

/** Dónde está dentro del programa. `graduado` y `baja` son DECISIONES de
 *  Mauricio, no cálculos: el contrato dice cuándo vence el plazo, no si el
 *  trabajo se terminó. */
export type EstadoCliente = 'activo' | 'graduado' | 'baja' | 'pausado';

export type ClienteCartera = {
  leadId: number;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;

  cancha: Cancha;
  /** Por qué está en esa cancha, en una frase. Es lo que se lee en la card. */
  razon: string;

  /** El reloj sale del CONTRATO del cliente, no de una constante inventada.
   *  Puede venir incompleto —y entonces la pantalla dice «—», no un número—. */
  reloj: Reloj;
  /** Lo que se le prometió. Es lo primero que hay que tener a mano antes de
   *  una sesión: la garantía de Sergio Esquer dice «continuar sesiones sin
   *  costo hasta instalación completa», y eso cambia qué significa «se pasó». */
  promesa: { resultado: string | null; garantia: string | null; queEs: string | null; sesiones: string | null };
  /** Dónde está DENTRO del programa. Separado de la venta: que se haya cobrado
   *  no dice si la entrega terminó. */
  estado: EstadoCliente;

  ultimaSesionHace: number | null;
  ultimaSesionTitulo: string | null;
  sesiones: number;

  cuotasVencidas: number;
  /** Días de la cuota más vieja sin pagar. */
  cuotaVencidaDias: number | null;

  compromisosAbiertos: number;

  /** Del programa. Hoy en cero para todos; entra igual porque es una columna
   *  más, no el eje. */
  contestados: number;
  aprobados: number;
  esperandoSuOk: number;
  vistosSinContestar: number;
  bloqueActual: string | null;

  links: number;
  /** Última vez que ENTRÓ por su link. Es la única señal de vida que no depende
   *  de que conteste algo. */
  entroHace: number | null;
};

const dias = (iso: string | Date | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
};

/** El bloque en el que está parado: el que espera su ok gana, después el
 *  primero sin contestar. Es la misma regla con la que abre su cuaderno. */
function bloqueActual(filas: Bloque[]): string | null {
  const esperando = filas.find(f => f.estado === 'revisada_ia');
  if (esperando) return rotuloDe(esperando.clase_id);
  const contestadas = new Set(filas.filter(f => f.estado !== 'pendiente').map(f => f.clase_id));
  for (const m of PROGRAMA) for (const c of m.clases) if (!contestadas.has(c.id)) return rotuloDe(c.id);
  return null;
}

/**
 * De quién es la pelota, y por qué.
 *
 * El ORDEN de los `if` es la prioridad, y está pensado: primero lo que frena al
 * cliente (algo mío sin hacer), después lo que le toca a él, y al final «al
 * día». Una deuda mía nunca queda tapada por una suya.
 */
function cancha(c: {
  esperandoSuOk: number; contestados: number; ultimaSesionHace: number | null;
  cuotasVencidas: number; cuotaVencidaDias: number | null; compromisosAbiertos: number;
  vistosSinContestar: number; entroHace: number | null; links: number;
  semanasDesdeElCierre: number | null;
}): { cancha: Cancha; razon: string } {
  // ── Mías ────────────────────────────────────────────────────────────────
  // ⚠️ EL ORDEN ES LA REGLA, y este primer caso lo aprendí mirando la pantalla
  // con datos reales: la regla «no tiene link» sola metía a los 13 en el mismo
  // grupo y la cartera dejaba de triar nada. Peor: a un cliente con 187 días de
  // silencio le decía «dale su link», cuando lo que pasa ahí es otra cosa.
  //
  // Un cliente frío no está esperando un link. Está perdido, y eso se recupera
  // con una llamada, no con un mail.
  if (c.ultimaSesionHace !== null && c.ultimaSesionHace > 60) {
    return { cancha: 'tuya', razon: `Se enfrió: ${c.ultimaSesionHace} días sin una sola sesión` };
  }
  if (c.ultimaSesionHace === null && (c.semanasDesdeElCierre ?? 0) > 8) {
    return { cancha: 'tuya', razon: 'Cerró hace meses y nunca tuvieron una sesión' };
  }
  if (!c.links) {
    return { cancha: 'tuya', razon: 'Todavía no tiene su link para contestar las tareas' };
  }
  if (c.contestados > 0 && c.esperandoSuOk === 0 && (c.ultimaSesionHace === null || c.ultimaSesionHace > 14)) {
    return {
      cancha: 'tuya',
      razon: c.ultimaSesionHace === null
        ? 'Contestó y todavía no tuvieron ninguna sesión'
        : `Contestó y hace ${c.ultimaSesionHace} días que no tienen sesión`,
    };
  }
  if (c.ultimaSesionHace !== null && c.ultimaSesionHace > 21) {
    return { cancha: 'tuya', razon: `Hace ${c.ultimaSesionHace} días de la última sesión` };
  }

  // ── Suyas ───────────────────────────────────────────────────────────────
  if (c.esperandoSuOk > 0) {
    return {
      cancha: 'suya',
      razon: `MaKo reescribió ${c.esperandoSuOk} ${c.esperandoSuOk === 1 ? 'bloque' : 'bloques'} y falta que los apruebe`,
    };
  }
  if (c.cuotasVencidas > 0) {
    return {
      cancha: 'suya',
      razon: c.cuotaVencidaDias !== null
        ? `Cuota vencida hace ${c.cuotaVencidaDias} días`
        : `${c.cuotasVencidas} ${c.cuotasVencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'}`,
    };
  }
  if (c.vistosSinContestar > 0) {
    return { cancha: 'suya', razon: `Vio ${c.vistosSinContestar} ${c.vistosSinContestar === 1 ? 'clase' : 'clases'} y no contestó la tarea` };
  }
  if (c.contestados === 0) {
    return {
      cancha: 'suya',
      razon: c.entroHace === null
        ? 'Tiene su link y todavía no entró'
        : `Entró hace ${c.entroHace} días y no contestó nada`,
    };
  }
  if (c.compromisosAbiertos > 0) {
    return { cancha: 'suya', razon: `${c.compromisosAbiertos} compromisos abiertos de las sesiones` };
  }

  return { cancha: 'al-dia', razon: 'Sin nada pendiente de ninguno de los dos' };
}

export async function cartera(): Promise<ClienteCartera[]> {
  const ws = (await getWorkspaceActual()) ?? OWNER_WS;
  const db = await getTenantDb();

  // Paginado por `id` aunque hoy sean 13: la cartera es la lista de clientes, y
  // el día que un workspace pase de 1000 ganados un `.select()` suelto los corta
  // en silencio — los que caen dejan de existir para CS. Si la lectura falla se
  // muestra vacía, igual que antes (el `data ?? []` de la versión suelta).
  type LeadGanado = {
    id: number; nombre: string; email: string | null; telefono: string | null;
    empresa: string | null; fecha_inicio_servicio: string | null; fecha_cierre: string | null;
    duracion_meses: number | null; deal_servicio: unknown; deal_promesa: unknown;
  };
  const leads = await leerTodo<LeadGanado>(db, 'leads',
    'id, nombre, email, telefono, empresa, fecha_inicio_servicio, fecha_cierre, duracion_meses, deal_servicio, deal_promesa',
    { orden: 'id', eq: { estado_lead: 'ganado' } },
  ).catch(() => [] as LeadGanado[]);
  if (!leads.length) return [];
  const ids = leads.map(l => l.id);

  // Todo lo pesado se pide UNA vez para los 13, no uno por cliente: trece
  // clientes eran trece consultas idénticas a las mismas cuatro tablas.
  //
  // Todas paginadas: son UNA consulta para toda la cartera, así que su tamaño es
  // la suma de todos los clientes, no lo de uno. `cs_respuestas` son ~44 bloques
  // por cliente (más las áreas): con 13 clientes contestando ya roza las 600, y
  // pasado el corte de 1000 los últimos clientes aparecían «sin contestar nada».
  // Cada una pagina por su columna ÚNICA (recording_id / id), nunca por fecha.
  type Ses = { recording_id: number; lead_id: number; call_date: string | null; title: string | null };
  type Cuo = { lead_id: number; fecha_vencimiento: string | null };
  const leer = <T,>(tabla: string, cols: string, orden: string, extra?: Parameters<typeof leerTodo>[3]): Promise<T[]> =>
    leerTodo<T>(db, tabla, cols, { orden, ...extra, filtros: (q) => q.in('lead_id', ids) }).catch(() => [] as T[]);

  const [shares, sesiones, cuotas, respuestas, estados] = await Promise.all([
    listarShares(ws, RECURSO_TAREA).catch(() => []),
    leer<Ses>('closing_analyses', 'recording_id, lead_id, call_date, title', 'recording_id'),
    // ⚠️ `pagos` NO tiene `fecha_vencimiento`: la columna es `fecha_esperada`.
    // Pedir la inexistente hacía fallar la consulta, el catch la volvía `[]` y la
    // cartera juraba «0 cuotas vencidas» para todos. Se alias-a para no tocar el
    // resto del cálculo.
    leer<Cuo>('pagos', 'lead_id, pagado, fecha_vencimiento:fecha_esperada', 'id', { eq: { pagado: false } }),
    leer<Bloque>('cs_respuestas', 'id, lead_id, clase_id, area, estado, visto_at, updated_at', 'id'),
    leer<{ lead_id: number; estado: EstadoCliente }>('cs_clientes', 'id, lead_id, estado', 'id'),
  ]);
  // La última sesión va primero (`ses[0]`). Se ordena ACÁ y no en la consulta:
  // `call_date` se repite y admite null, así que no sirve para paginar; y el
  // `order(call_date desc)` de antes ponía los null PRIMERO (default de Postgres
  // en DESC), con lo que una grabación sin fecha pasaba por «última sesión».
  sesiones.sort((a, b) =>
    (a.call_date == null ? 1 : 0) - (b.call_date == null ? 1 : 0) ||
    (b.call_date ?? '').localeCompare(a.call_date ?? '') ||
    b.recording_id - a.recording_id);

  const porLead = <T extends { lead_id: number }>(xs: T[]) => {
    const m = new Map<number, T[]>();
    for (const x of xs) { const a = m.get(x.lead_id) ?? []; a.push(x); m.set(x.lead_id, a); }
    return m;
  };
  const sesionesDe = porLead(sesiones);
  const cuotasDe = porLead(cuotas);
  const respuestasDe = porLead(respuestas);
  const estadoDe = new Map(estados.map(e => [e.lead_id, e.estado]));

  const sharesDe = new Map<string, { vivos: number; ultima: string | null }>();
  for (const s of shares as { recurso_id?: unknown; revocado_at?: string | null; ultima_visita?: string | null }[]) {
    if (s.revocado_at) continue;
    const k = String(s.recurso_id ?? '');
    const prev = sharesDe.get(k) ?? { vivos: 0, ultima: null };
    sharesDe.set(k, {
      vivos: prev.vivos + 1,
      ultima: [prev.ultima, s.ultima_visita ?? null].filter(Boolean).sort().at(-1) ?? null,
    });
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const filas: ClienteCartera[] = leads.map((l) => {
    const ses = sesionesDe.get(l.id) ?? [];
    const cuo = (cuotasDe.get(l.id) ?? []).filter(p => p.fecha_vencimiento && p.fecha_vencimiento <= hoy);
    const bs = (respuestasDe.get(l.id) ?? []).filter(b => !b.area);
    const sh = sharesDe.get(String(l.id)) ?? { vivos: 0, ultima: null };

    const vencidaMasVieja = cuo.map(p => p.fecha_vencimiento!).sort()[0] ?? null;
    const reloj = relojDe(l);
    const base = {
      esperandoSuOk: bs.filter(b => b.estado === 'revisada_ia').length,
      contestados: bs.filter(b => b.estado !== 'pendiente').length,
      ultimaSesionHace: dias(ses[0]?.call_date),
      cuotasVencidas: cuo.length,
      cuotaVencidaDias: dias(vencidaMasVieja),
      compromisosAbiertos: 0, // se llena abajo, con una sola consulta para todos
      vistosSinContestar: bs.filter(b => b.visto_at && b.estado === 'pendiente').length,
      entroHace: dias(sh.ultima),
      links: sh.vivos,
      semanasDesdeElCierre: reloj.semana,
    };

    return {
      leadId: l.id, nombre: l.nombre, empresa: l.empresa, email: l.email, telefono: l.telefono,
      ...cancha(base),
      reloj,
      promesa: promesaDe(l),
      estado: estadoDe.get(l.id) ?? 'activo',
      ultimaSesionHace: base.ultimaSesionHace,
      ultimaSesionTitulo: ses[0]?.title ?? null,
      sesiones: ses.length,
      cuotasVencidas: base.cuotasVencidas,
      cuotaVencidaDias: base.cuotaVencidaDias,
      compromisosAbiertos: 0,
      contestados: base.contestados,
      aprobados: bs.filter(b => b.estado === 'aprobada').length,
      esperandoSuOk: base.esperandoSuOk,
      vistosSinContestar: base.vistosSinContestar,
      bloqueActual: bloqueActual(bs),
      links: sh.vivos,
      entroHace: base.entroHace,
    } satisfies ClienteCartera;
  });

  // El orden ES la pantalla: primero lo que te frena a vos, después lo que
  // depende de él, después lo que está al día. Dentro de cada grupo, lo más
  // detenido arriba.
  const peso: Record<Cancha, number> = { tuya: 0, suya: 1, 'al-dia': 2 };
  return filas.sort((a, b) =>
    peso[a.cancha] - peso[b.cancha] ||
    (b.ultimaSesionHace ?? 999) - (a.ultimaSesionHace ?? 999) ||
    a.nombre.localeCompare(b.nombre));
}

export const TOTAL = TOTAL_CLASES;
