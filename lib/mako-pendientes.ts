// =============================================================================
// mako-pendientes — confirmaciones seguras del doer de MaKo (punto 10)
// =============================================================================
// Cuando MaKo va a EJECUTAR algo, primero crea una "acción pendiente" con un
// vencimiento y le pide el OK al dueño. El "sí" se matchea con la pendiente MÁS
// RECIENTE vigente del grupo; si hay varias, MaKo re-pregunta (lo decide la capa
// conversacional). Las vencidas se invalidan solas. Así un "sí" nunca dispara
// algo viejo. Scopeado por workspace (tabla en TENANT_TABLES, mig 0085).

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { getSupabaseServer } from './supabase';
import { pendienteRepetida, MARGEN_RELOJ_MS } from './turno-sin-duplicar';
import { datosSinMediosEmojis } from './unicode-seguro';
import { conQuienPidio, sinQuienPidio } from './confirmacion-pura';
import { salidaDelGrupo } from './grupo-salida';
import { conColumnaNueva, cortesDeColgadas, faltaLaColumna, RESULTADO_COLGADA } from './pendientes-colgadas';

export type EstadoPendiente = 'pendiente' | 'confirmada' | 'ejecutada' | 'cancelada' | 'vencida' | 'error';
export type Pendiente = {
  id: number; grupoJid: string; tipo: string; payload: Record<string, unknown>;
  resumen: string; estado: EstadoPendiente; venceAt: string; origen: string | null; createdAt: string;
  /** Quién la pidió en el grupo (lib/confirmacion-pura.ts, `elSiEsDeQuienPidio`); null fuera de un grupo o si no se sabe. */
  pidio?: string | null;
  /** Nació en un turno sólo de la app: un «sí» por WhatsApp no la confirma (`rechazoSiNoEsConfirmacionPura`). */
  soloApp?: boolean;
};

type Row = {
  id: number; grupo_jid: string; tipo: string; payload: unknown; resumen: string;
  estado: string; vence_at: string; origen: string | null; created_at: string;
};
const toP = (r: Row): Pendiente => {
  // Quién la pidió viaja en el payload y sale acá: ni la bandeja lo muestra ni la acción lo recibe.
  const { payload, pidio, soloApp } = sinQuienPidio((r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>);
  return {
    id: r.id, grupoJid: r.grupo_jid, tipo: r.tipo, payload,
    resumen: r.resumen, estado: r.estado as EstadoPendiente, venceAt: r.vence_at, origen: r.origen, createdAt: r.created_at, pidio, ...(soloApp ? { soloApp } : {}),
  };
};

/**
 * Crea una acción pendiente de confirmación (ttl por default 2h). Devuelve el id.
 *
 * Con `mismoTurnoDesde` (el `turnStart` del doer), si ESTE turno ya dejó una pendiente
 * igual —mismo grupo, tipo y payload— devuelve ésa en vez de crear otra: cuando el doer
 * rota de proveedor vuelve a correr el turno, y una segunda pendiente igual es un «Hay 2
 * acciones pendientes» o, confirmadas las dos, dos invitaciones (lib/turno-sin-duplicar.ts).
 * Si la búsqueda falla, se crea igual: es lo que pasaba siempre, y perder la propuesta
 * sería peor.
 *
 * ⚠️ SI NO ENTRA, DEVUELVE EL MOTIVO (23/10/2026, el ws13): devolvía `null` y la causa vivía
 * sólo en un `console.error` que nadie lee. Diez días de avisos perdidos con «No se pudo
 * registrar la acción pendiente.» en cada fila, y la base diciendo otra cosa. Y lo que entra
 * va sin mitades de emoji (`datosSinMediosEmojis`): un resumen cortado con `slice` en el
 * medio de un emoji era exactamente lo que la base rechazaba.
 */
export type PendienteCreada = { id: number } | { error: string };
export async function crearPendiente(
  ws: number,
  dataCruda: {
    grupoJid: string; tipo: string; payload?: Record<string, unknown>; resumen: string; origen?: string; ttlMin?: number; mismoTurnoDesde?: number;
    /** Quién la pidió en el grupo (lib/confirmacion-pura.ts, `quienEnElGrupo`): va en el payload y sale al leerla (`toP`). */
    pidio?: string | null;
  },
): Promise<PendienteCreada> {
  const payloadCrudo = conQuienPidio(dataCruda.payload ?? {}, dataCruda.pidio, salidaDelGrupo()?.soloApp);
  const data = { ...dataCruda, ...datosSinMediosEmojis({ grupoJid: dataCruda.grupoJid, tipo: dataCruda.tipo, payload: payloadCrudo, resumen: dataCruda.resumen, origen: dataCruda.origen }) };
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    if (data.mismoTurnoDesde && data.mismoTurnoDesde > 0) {
      const { data: previas, error: e } = await db.from('mako_acciones_pendientes')
        .select('id, payload, created_at')
        .eq('grupo_jid', data.grupoJid).eq('tipo', data.tipo).eq('estado', 'pendiente')
        .gte('created_at', new Date(data.mismoTurnoDesde - MARGEN_RELOJ_MS).toISOString());
      if (e) console.error('[pendientes] buscar la del turno:', e.message);
      const repetida = e ? null : pendienteRepetida((previas ?? []) as Array<{ id: number; payload: unknown; created_at: string }>, data.payload ?? {}, data.mismoTurnoDesde);
      if (repetida != null) {
        console.warn(`[pendientes] ${data.tipo}: este turno ya dejó la #${repetida} igual; no se crea otra`);
        return { id: repetida };
      }
    }
    const venceAt = new Date(Date.now() + (data.ttlMin ?? 120) * 60_000).toISOString();
    const { data: row, error } = await db.from('mako_acciones_pendientes')
      .insert({ grupo_jid: data.grupoJid, tipo: data.tipo, payload: data.payload ?? {}, resumen: data.resumen, origen: data.origen ?? null, vence_at: venceAt })
      .select('id').single();
    if (error) {
      console.error('[pendientes] crear:', error.message);
      return { error: [error.message, error.details, error.code ? `(${error.code})` : ''].filter(Boolean).join(' ').slice(0, 300) };
    }
    const id = (row as { id: number }).id;
    // El push va SÓLO acá, después del insert que salió bien: la rama de la repetida (arriba)
    // devuelve una pendiente que ya avisó cuando nació.
    await avisarPendiente(ws, id, data.resumen, data.origen ?? null, data.ttlMin ?? 120);
    return { id };
  });
}

/**
 * «MaKo te pide confirmar», al teléfono de los ADMIN del workspace (MaKo Mobile).
 *
 * NO se manda cuando quien la originó la está mirando, o cuando se confirma sola:
 *   · `app`      → nació en el chat de MaKo de la app: la persona tiene la tarjeta adelante.
 *   · `flujo:…`  → la dejó un paso de una automatización, que la confirma EN EL ACTO
 *                  (`aplicarEnElActo`, lib/api-mako/flujo.ts): avisar sería una alarma falsa.
 * Y se re-pregunta antes de mandar (`pushPorDetras`): una pendiente que se confirmó en el
 * mismo pedido —un token con escritura directa por /api/v1— o que ya venció no espera a nadie.
 *
 * TTL = lo que le queda a la pendiente, con techo de 2 h: después vence y el aviso miente.
 * Tag fijo: varias pendientes seguidas se juntan en UNA notificación (el Inbox las lista).
 */
async function avisarPendiente(ws: number, id: number, resumen: string, origen: string | null, ttlMin: number): Promise<void> {
  if (origen === 'app' || origen?.startsWith('flujo:')) return;
  try {
    const { pushPorDetras } = await import('./push');
    await pushPorDetras(ws, {
      tipo: 'mako-pendiente',
      titulo: 'MaKo te pide confirmar',
      cuerpo: resumen,
      ruta: '/mako/pendientes',
      tag: 'mako-pendiente',
      ttl: Math.max(60, Math.min(ttlMin, 120) * 60),
      urgencia: 'high',
      soloAdmins: true,
    }, async () => {
      const { data } = await getSupabaseServer().from('mako_acciones_pendientes')
        .select('estado, vence_at').eq('id', id).eq('workspace_id', ws).maybeSingle();
      const f = data as { estado?: string; vence_at?: string } | null;
      return f?.estado === 'pendiente' && !!f.vence_at && Date.parse(f.vence_at) > Date.now();
    });
  } catch (e) {
    // Que falle el push no puede tumbar la pendiente, que ya está creada.
    console.error(`[pendientes] push de la #${id}:`, e instanceof Error ? e.message : String(e));
  }
}

/** Marca como 'vencida' toda pendiente cuyo vence_at ya pasó (limpieza previa a leer). */
async function vencerExpiradas(ws: number): Promise<void> {
  await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    await db.from('mako_acciones_pendientes')
      .update({ estado: 'vencida', resuelto_at: new Date().toISOString() })
      .eq('estado', 'pendiente').lt('vence_at', new Date().toISOString());
  });
}

/** Pendientes VIGENTES (no vencidas, sin resolver) de un grupo, la más reciente primero. */
export async function pendientesVigentes(ws: number, grupoJid: string): Promise<Pendiente[]> {
  await vencerExpiradas(ws);
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_acciones_pendientes')
      .select('id, grupo_jid, tipo, payload, resumen, estado, vence_at, origen, created_at')
      .eq('grupo_jid', grupoJid).eq('estado', 'pendiente')
      .order('created_at', { ascending: false });
    return ((data ?? []) as Row[]).map(toP);
  });
}

export async function getPendiente(ws: number, id: number): Promise<Pendiente | null> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_acciones_pendientes')
      .select('id, grupo_jid, tipo, payload, resumen, estado, vence_at, origen, created_at').eq('id', id).maybeSingle();
    return data ? toP(data as Row) : null;
  });
}

/**
 * Cierra una pendiente con un estado final + resultado. Devuelve si tocó una fila.
 * Con `soloSiPendiente`, no pisa una que ya se resolvió (dos cancelaciones, un
 * cancelar sobre algo que ya se ejecutó).
 */
export async function resolverPendiente(ws: number, id: number, estado: EstadoPendiente, resultado?: string, opts?: { soloSiPendiente?: boolean }): Promise<boolean> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    let q = db.from('mako_acciones_pendientes')
      .update({ estado, resultado: resultado ?? null, resuelto_at: new Date().toISOString() }).eq('id', id);
    if (opts?.soloSiPendiente) q = q.eq('estado', 'pendiente');
    const { data } = await q.select('id');
    return (data ?? []).length > 0;
  });
}

/**
 * RECLAMA una pendiente para ejecutarla: la pasa a 'confirmada' SOLO si sigue
 * 'pendiente' y vigente. Devuelve false si otra confirmación ya la tomó o venció.
 *
 * ⚠️ Es lo que hace que dos «sí» seguidos, dos pestañas o un cliente HTTP que
 * reintenta ejecuten UNA sola vez. Antes se ejecutaba y recién después se resolvía,
 * y por WhatsApp lo tapaba el lock del grupo; por la app y por HTTP no lo tapaba
 * nada. El molde es `marcarAplicada` de lib/propuestas.ts.
 */
export async function reclamarPendiente(ws: number, id: number): Promise<boolean> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const ahora = new Date().toISOString();
    // Con la hora del reclamo (mig 0420, F114): el barrido de las colgadas la cierra 30 minutos después. Sin la migración,
    // reclama igual sin anotarla (lib/pendientes-colgadas.ts → `conColumnaNueva`).
    const { data } = await conColumnaNueva((conHora) => db.from('mako_acciones_pendientes')
      .update(conHora ? { estado: 'confirmada', reclamada_at: ahora } : { estado: 'confirmada' })
      .eq('id', id).eq('estado', 'pendiente').gt('vence_at', ahora)
      .select('id'));
    return (data ?? []).length > 0;
  });
}

/**
 * Cierra como 'error' las pendientes que se reclamaron y nunca terminaron (F114, 18/11/2026): las 'confirmada' sin resultado
 * hace más de `COLGADA_TRAS_MS` desde su reclamo (mig 0420) o, si no se sabe cuándo se reclamaron, desde su vencimiento. CRUZA
 * NEGOCIOS: sólo la llama el cron (/api/cron/limpieza-colgados), con la clave de servicio. Devuelve cuántas cerró; tira si la
 * base no contestó (el cron lo dice).
 */
export async function cerrarConfirmadasColgadas(ahoraMs = Date.now()): Promise<number> {
  const db = getSupabaseServer();
  const corte = cortesDeColgadas(ahoraMs);
  const cerrar = () => db.from('mako_acciones_pendientes')
    .update({ estado: 'error', resultado: RESULTADO_COLGADA, resuelto_at: new Date(ahoraMs).toISOString() })
    .eq('estado', 'confirmada').is('resuelto_at', null);
  const porVencida = await cerrar().lt('vence_at', corte.vencidaAntesDe).select('id');
  if (porVencida.error) throw new Error(`mako_acciones_pendientes (por vencimiento): ${porVencida.error.message}`);
  const porReclamo = await cerrar().lt('reclamada_at', corte.reclamadaAntesDe).select('id');
  // Sin la 0420 no hay hora del reclamo: lo de arriba ya cerró lo que se puede saber.
  if (porReclamo.error && !faltaLaColumna(porReclamo.error)) throw new Error(`mako_acciones_pendientes (por reclamo): ${porReclamo.error.message}`);
  return (porVencida.data ?? []).length + (porReclamo.error ? 0 : (porReclamo.data ?? []).length);
}

/**
 * Lo que MaKo PROPUSO en un grupo los últimos `dias`, ya resuelto (hecho, cancelado, vencido o con error), lo más reciente
 * primero: el doer lo cuenta como hecho («LO QUE PROPUSISTE O HICISTE AHÍ», lib/doer-hilo.ts). Las vigentes no: ésas ya van
 * en «ACCIONES PENDIENTES DE CONFIRMACIÓN». Si la base no contesta, ninguna.
 */
export async function accionesDelGrupo(
  ws: number, grupoJid: string, dias = 7, limite = 12,
): Promise<Array<{ id: number; resumen: string; estado: string; resultado: string | null; created_at: string }>> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data, error } = await db.from('mako_acciones_pendientes')
      .select('id, resumen, estado, resultado, created_at')
      .eq('grupo_jid', grupoJid).neq('estado', 'pendiente')
      .gte('created_at', new Date(Date.now() - dias * 86_400_000).toISOString())
      .order('created_at', { ascending: false }).limit(limite);
    if (error) return [];
    return (data ?? []) as Array<{ id: number; resumen: string; estado: string; resultado: string | null; created_at: string }>;
  });
}

/** Todas las pendientes VIGENTES del workspace, vengan del canal que vengan. Para la
 *  bandeja /mako/pendientes, donde una persona logueada confirma o cancela. */
export async function pendientesDelWorkspace(ws: number): Promise<Pendiente[]> {
  await vencerExpiradas(ws);
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('mako_acciones_pendientes')
      .select('id, grupo_jid, tipo, payload, resumen, estado, vence_at, origen, created_at')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false }).limit(200);
    return ((data ?? []) as Row[]).map(toP);
  });
}
