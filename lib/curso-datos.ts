import 'server-only';

// =============================================================================
// curso-datos — leer y escribir el curso, el avance y el acceso de un cliente
// =============================================================================
// Lo usan la tab Curso, la ficha del cliente, el portal del alumno (rutas públicas, sin sesión)
// y el cron de las llamadas. Las reglas puras viven en lib/curso.ts; el modelo, en la cabecera
// de supabase/migrations/0202_curso.sql.
//
// ⚠️ TODO LO DE ACÁ CORRE ADENTRO DE UN WORKSPACE: usa `getTenantDb()`, que pone el `.eq` del
// inquilino. Desde una ruta pública (el portal del alumno) no hay sesión, así que quien llama
// envuelve en `runWithWorkspace(acceso.ws, …)` con el workspace QUE SALE DE LA FIRMA del link,
// nunca de un parámetro del pedido. Sin eso, `getTenantDb` cae al workspace por defecto.

import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { linkApp } from './app-url';
import { firmarAccesoCurso, leerAccesoCurso, type AccesoCurso } from './curso-acceso';
import { pctVisto, sanearValores, respuestaCompleta, type Clase, type Progreso, type Campo, type Valores, type EstadoTarea, type TipoClase, type VideoTipo } from './curso';

type FilaClase = {
  id: number; producto_id: number; etapa: string; orden: number; titulo: string; descripcion: string;
  tipo: TipoClase; minutos: number | null; video_tipo: VideoTipo; video_url: string | null; video_path: string | null;
  tarea: string; campos: Campo[] | null; obligatoria: boolean;
};
type FilaProgreso = {
  clase_id: number; segundos_max: number | string; duracion_seg: number | string | null; pct: number;
  visto_at: string | null; valores: Valores | null; estado: EstadoTarea; enviada_at: string | null;
};

export const COLUMNAS_CLASE = 'id, producto_id, etapa, orden, titulo, descripcion, tipo, minutos, video_tipo, video_url, video_path, tarea, campos, obligatoria';

export const aClase = (f: FilaClase): Clase => ({
  id: Number(f.id), productoId: Number(f.producto_id), etapa: f.etapa, orden: f.orden ?? 0,
  titulo: f.titulo, descripcion: f.descripcion ?? '', tipo: f.tipo, minutos: f.minutos ?? null,
  videoTipo: f.video_tipo, videoUrl: f.video_url ?? null, videoPath: f.video_path ?? null,
  tarea: f.tarea ?? '', campos: Array.isArray(f.campos) ? f.campos : [], obligatoria: f.obligatoria === true,
});

const aProgreso = (f: FilaProgreso): Progreso => ({
  claseId: Number(f.clase_id), segundosMax: Number(f.segundos_max) || 0,
  duracionSeg: f.duracion_seg == null ? null : Number(f.duracion_seg), pct: f.pct ?? 0,
  vistoAt: f.visto_at ?? null, valores: f.valores ?? {}, estado: f.estado, enviadaAt: f.enviada_at ?? null,
});

/** Las clases de un producto, en el orden de cada etapa. Tira si no puede leer. */
export async function clasesDelProducto(productoId: number): Promise<Clase[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE)
    .eq('producto_id', productoId).order('etapa').order('orden').order('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaClase[]).map(aClase);
}

/** Una clase por id (del workspace en curso). `null` = no existe o es de otro inquilino. */
export async function claseDeId(claseId: number): Promise<Clase | null> {
  if (!Number.isInteger(claseId) || claseId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_clases').select(COLUMNAS_CLASE).eq('id', claseId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? aClase(data as FilaClase) : null;
}

/** El avance de un cliente: claseId → progreso. Las clases que nunca abrió no están. */
export async function progresoDelCliente(leadId: number): Promise<Map<number, Progreso>> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_progreso')
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at').eq('lead_id', leadId);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as FilaProgreso[]).map((f) => [Number(f.clase_id), aProgreso(f)]));
}

/** El avance de VARIOS clientes (la tab Curso): leadId → claseId → progreso. */
export async function progresoDeClientes(leadIds: readonly number[]): Promise<Map<number, Map<number, Progreso>>> {
  const out = new Map<number, Map<number, Progreso>>();
  if (!leadIds.length) return out;
  const db = await getTenantDb();
  // ⚠️ PAGINADO: son clientes × clases (14 × 107 en el ws1 ya pasan las 1000 filas), y PostgREST
  // corta en 1000 SIN error — la tabla Avance mostraría tareas enviadas como pendientes.
  const filas = await leerTodo<FilaProgreso & { lead_id: number }>(db, 'curso_progreso',
    'id, lead_id, clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at',
    { filtros: (q) => q.in('lead_id', [...leadIds]), orden: 'id' });
  for (const f of filas) {
    const lead = Number(f.lead_id);
    if (!out.has(lead)) out.set(lead, new Map());
    out.get(lead)!.set(Number(f.clase_id), aProgreso(f));
  }
  return out;
}

/**
 * Registra hasta dónde vio un video. Guarda el MÁXIMO (volver atrás no resta) y el % lo calcula
 * acá con la duración — nunca se cree un % que llega armado del navegador.
 */
export async function guardarVisto(leadId: number, clase: Clase, segundos: number, duracion: number | null): Promise<Progreso> {
  const db = await getTenantDb();
  const { data: previa, error: errPrevia } = await db.from('curso_progreso')
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at')
    .eq('lead_id', leadId).eq('clase_id', clase.id).maybeSingle();
  // Sin leer el error, una lectura caída daba `previa = null` y el upsert PISABA lo ya visto.
  if (errPrevia) throw new Error(errPrevia.message);
  const p = previa ? aProgreso(previa as FilaProgreso) : null;
  const seg = Math.max(p?.segundosMax ?? 0, Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, 24 * 3600) : 0);
  // ⚠️ LA DURACIÓN SE FIJA CON LA PRIMERA QUE LLEGA, y no se pisa. Los dos números vienen del
  // navegador: si cada pedido pudiera traer su duración, `{seg: 1, dur: 1}` dejaba cualquier clase
  // en 100% de un golpe (lo armó la revisión del 06/10/2026). Con la clase declarando sus minutos,
  // una duración de menos del 80% de lo declarado no se cree.
  const piso = clase.minutos && clase.minutos > 0 ? clase.minutos * 60 * 0.8 : 0;
  const nueva = duracion && Number.isFinite(duracion) && duracion > 0 ? Math.min(Math.max(duracion, piso), 24 * 3600) : null;
  const dur = p?.duracionSeg ?? nueva;
  const ahora = new Date().toISOString();
  const fila = {
    lead_id: leadId, clase_id: clase.id, segundos_max: seg, duracion_seg: dur,
    pct: pctVisto(seg, dur), visto_at: p?.vistoAt ?? ahora, updated_at: ahora,
  };
  const { data, error } = await db.from('curso_progreso')
    .upsert([fila], { onConflict: 'workspace_id,lead_id,clase_id' })
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at').single();
  if (error) throw new Error(error.message);
  return aProgreso(data as FilaProgreso);
}

/**
 * Guarda lo que contestó en la tarea de una clase. Con `enviar`, la marca como ENVIADA sólo si
 * lo contestado alcanza (`respuestaCompleta`): enviar un formulario vacío no es hacer la tarea.
 * Una tarea ya aprobada que se vuelve a editar queda enviada (la revisa Mauricio de nuevo).
 */
export async function guardarTarea(leadId: number, clase: Clase, raw: unknown, enviar: boolean): Promise<{ progreso: Progreso; faltaCompletar: boolean }> {
  const valores = sanearValores(clase.campos, raw);
  const completo = respuestaCompleta(clase, valores);
  const db = await getTenantDb();
  const { data: previa, error: errPrevia } = await db.from('curso_progreso').select('estado, enviada_at')
    .eq('lead_id', leadId).eq('clase_id', clase.id).maybeSingle();
  if (errPrevia) throw new Error(errPrevia.message);
  const antes = previa as { estado: EstadoTarea; enviada_at: string | null } | null;
  const ahora = new Date().toISOString();
  const pasaAEnviada = enviar && completo;
  const fila: Record<string, unknown> = { lead_id: leadId, clase_id: clase.id, valores, updated_at: ahora };
  if (pasaAEnviada) { fila.estado = 'enviada'; fila.enviada_at = antes?.enviada_at ?? ahora; fila.aprobada_at = null; }
  const { data, error } = await db.from('curso_progreso').upsert([fila], { onConflict: 'workspace_id,lead_id,clase_id' })
    .select('clase_id, segundos_max, duracion_seg, pct, visto_at, valores, estado, enviada_at').single();
  if (error) throw new Error(error.message);
  return { progreso: aProgreso(data as FilaProgreso), faltaCompletar: enviar && !completo };
}

// ── El acceso del cliente ─────────────────────────────────────────────────────

type FilaAcceso = {
  lead_id: number; version: number; revocado_at: string | null; ingresos: number; ultimo_ingreso_at: string | null;
  email: string | null; invitacion_enviada_at: string | null; invitado_por: string | null;
};
/**
 * El acceso de un cliente. ⚠️ «Tiene fila» NO es «lo invitaron» (mig 0206): lo que lo dice es
 * `invitacionEnviadaAt`, que se escribe sólo si el mail salió.
 */
export type EstadoAcceso = {
  version: number; revocado: boolean; ingresos: number; ultimoIngresoAt: string | null;
  email: string | null; invitacionEnviadaAt: string | null; invitadoPor: string | null;
};
const COLS_ACCESO = 'lead_id, version, revocado_at, ingresos, ultimo_ingreso_at, email, invitacion_enviada_at, invitado_por';

/** El acceso de un cliente, sin crearlo. `null` = nunca se le dio. */
export async function accesoDe(leadId: number): Promise<EstadoAcceso | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_accesos').select(COLS_ACCESO).eq('lead_id', leadId).maybeSingle();
  if (error) throw new Error(error.message);
  const f = data as FilaAcceso | null;
  return f ? {
    version: f.version, revocado: f.revocado_at != null, ingresos: f.ingresos ?? 0, ultimoIngresoAt: f.ultimo_ingreso_at,
    email: f.email ?? null, invitacionEnviadaAt: f.invitacion_enviada_at ?? null, invitadoPor: f.invitado_por ?? null,
  } : null;
}

/**
 * El link del cliente, creando su acceso si no lo tiene. `null` = está REVOCADO (no se le manda un
 * link que no abre) o no hay secreto para firmar.
 *
 * ⚠️ EL WORKSPACE DE LA FIRMA ES EL DEL CONTEXTO: quien llama tiene que estar adentro del
 * workspace del cliente (sesión, `runWithWorkspace`). Lo lee de `curso_accesos` recién escrito
 * para no deducirlo.
 */
export async function linkDeAcceso(leadId: number, ws: number, porQuien: string | null = null): Promise<string | null> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_accesos').upsert([{ lead_id: leadId, creado_por: porQuien }], { onConflict: 'workspace_id,lead_id', ignoreDuplicates: true });
  // Un upsert caído no es «acceso cortado»: es un fallo, y tira.
  if (error) throw new Error(error.message);
  const a = await accesoDe(leadId);
  if (!a || a.revocado) return null;
  const token = firmarAccesoCurso({ ws, leadId, version: a.version });
  return token ? urlDeToken(token) : null;
}

/** La URL pública del portal para un token. Sin `?ws=`: el workspace viaja adentro de la firma. */
export const urlDeToken = (token: string): string => linkApp(`/compartido/curso/${token}`, null);

/**
 * Deja escrito que la invitación SALIÓ: a qué dirección, cuándo y quién. Lo llama quien manda el
 * mail DESPUÉS de que el envío contestó bien — nunca antes, o «Invitado» mentiría sobre un mail que
 * no llegó (el falso éxito que tienen los avisos de aprobación de agencia).
 */
export async function marcarInvitacion(leadId: number, email: string, porQuien: string | null): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_accesos')
    .update({ email: email.trim().toLowerCase(), invitacion_enviada_at: new Date().toISOString(), invitado_por: porQuien })
    .eq('lead_id', leadId);
  if (error) throw new Error(error.message);
}

/** Corta el acceso: sube la versión (todos los links mandados dejan de abrir) y lo marca revocado. */
export async function revocarAcceso(leadId: number): Promise<void> {
  const db = await getTenantDb();
  const a = await accesoDe(leadId);
  if (!a) return;
  const { error } = await db.from('curso_accesos').update({ version: a.version + 1, revocado_at: new Date().toISOString() }).eq('lead_id', leadId);
  if (error) throw new Error(error.message);
}

/** Lo vuelve a habilitar con un link NUEVO (la versión ya subió al revocar). */
export async function reactivarAcceso(leadId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_accesos').update({ revocado_at: null }).eq('lead_id', leadId);
  if (error) throw new Error(error.message);
}

/**
 * ¿Este token abre? Verifica la firma y, ADENTRO del workspace que dice la firma, que la versión
 * siga vigente, que no esté revocado y que el lead siga siendo un cliente ganado.
 *
 * ⚠️ Quien llama envuelve en `runWithWorkspace(leerAccesoCurso(token).ws, …)`: acá se usa
 * `getTenantDb`, así que fuera de ese contexto miraría otro inquilino y contestaría que no.
 */
export async function resolverAcceso(token: string): Promise<AccesoCurso | null> {
  const a = leerAccesoCurso(token);
  if (!a) return null;
  const db = await getTenantDb();
  const [{ data: acc, error: e1 }, { data: lead, error: e2 }] = await Promise.all([
    db.from('curso_accesos').select('version, revocado_at').eq('lead_id', a.leadId).maybeSingle(),
    db.from('leads').select('id').eq('id', a.leadId).eq('estado_lead', 'ganado').maybeSingle(),
  ]);
  // ⚠️ Un error de base no es «este link ya no está activo»: tira, y la página muestra su fallo.
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  const f = acc as { version: number; revocado_at: string | null } | null;
  if (!f || f.revocado_at || f.version !== a.version || !lead) return null;
  return a;
}

/** Cuenta un ingreso al portal. No tira: un contador que falla no puede cerrarle la puerta. */
export async function contarIngreso(leadId: number): Promise<void> {
  try {
    const db = await getTenantDb();
    const a = await accesoDe(leadId);
    if (!a) return;
    await db.from('curso_accesos').update({ ingresos: a.ingresos + 1, ultimo_ingreso_at: new Date().toISOString() }).eq('lead_id', leadId);
  } catch (e) {
    console.warn('[curso] no pude contar el ingreso:', e instanceof Error ? e.message : e);
  }
}

// ── Las llamadas de la entrega ────────────────────────────────────────────────

export type Sesion = { id: number; leadId: number; productoId: number | null; fecha: string; nota: string | null; avisoPrevioAt: string | null; avisoPosteriorAt: string | null; avisoMotivo: string | null };

/** Las llamadas de un cliente, de la más próxima a la más vieja. */
export async function sesionesDe(leadId: number): Promise<Sesion[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_sesiones')
    .select('id, lead_id, producto_id, fecha, nota, aviso_previo_at, aviso_posterior_at, aviso_motivo')
    .eq('lead_id', leadId).order('fecha', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: Number(f.id), leadId: Number(f.lead_id), productoId: f.producto_id == null ? null : Number(f.producto_id),
    fecha: String(f.fecha), nota: (f.nota as string | null) ?? null,
    avisoPrevioAt: (f.aviso_previo_at as string | null) ?? null, avisoPosteriorAt: (f.aviso_posterior_at as string | null) ?? null,
    avisoMotivo: (f.aviso_motivo as string | null) ?? null,
  }));
}

/** Anota una llamada de la entrega. De acá salen el aviso del día antes y el de después (cron). */
export async function agendarSesion(leadId: number, productoId: number | null, fechaIso: string, nota: string | null = null): Promise<Sesion> {
  const t = Date.parse(fechaIso);
  if (!Number.isFinite(t)) throw new Error('La fecha de la llamada no se entiende.');
  const db = await getTenantDb();
  const { data, error } = await db.from('curso_sesiones')
    .insert([{ lead_id: leadId, producto_id: productoId, fecha: new Date(t).toISOString(), nota: nota?.trim() || null }])
    .select('id, lead_id, producto_id, fecha, nota, aviso_previo_at, aviso_posterior_at, aviso_motivo').single();
  if (error) throw new Error(error.message);
  const f = data as Record<string, unknown>;
  return {
    id: Number(f.id), leadId: Number(f.lead_id), productoId: f.producto_id == null ? null : Number(f.producto_id),
    fecha: String(f.fecha), nota: (f.nota as string | null) ?? null, avisoPrevioAt: null, avisoPosteriorAt: null, avisoMotivo: null,
  };
}

/** Borra una llamada anotada (sólo de ese cliente: el id solo no alcanza). */
export async function borrarSesion(leadId: number, sesionId: number): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_sesiones').delete().eq('id', sesionId).eq('lead_id', leadId);
  if (error) throw new Error(error.message);
}

/** Marca una tarea ENVIADA como revisada por el equipo. No cambia la etapa: la etapa cierra al enviar. */
export async function aprobarTarea(leadId: number, claseId: number, aprobada = true): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('curso_progreso')
    .update(aprobada ? { estado: 'aprobada', aprobada_at: new Date().toISOString() } : { estado: 'enviada', aprobada_at: null })
    .eq('lead_id', leadId).eq('clase_id', claseId).in('estado', aprobada ? ['enviada'] : ['aprobada']);
  if (error) throw new Error(error.message);
}

// ── Dónde está el cliente ────────────────────────────────────────────────────

/**
 * Los productos del cliente, con la MISMA regla que el kanban de Customer Success (su casa en
 * el CRM o una fila en `cliente_entrega`). El portal sólo muestra el curso de ésos: un link
 * válido no abre el curso de un producto que el cliente no compró.
 */
export async function productosDelAlumno(leadId: number): Promise<number[]> {
  const { productosDelCliente } = await import('@/app/customer-success/entrega');
  return (await productosDelCliente(leadId)).productos;
}

/**
 * La etapa en la que está HOY el cliente en la entrega de un producto. `null` = no es de ese
 * producto (o el producto no tiene etapas).
 *
 * ⚠️ SIN FILA ESTÁ EN LA PRIMERA ETAPA, no «en ninguna»: es la regla del kanban
 * (`repartirEnEtapas`). Preguntarle sólo a `cliente_entrega` contestaría «ninguna» para los
 * clientes que nunca se movieron — que al arrancar son todos.
 */
export async function etapaActualDe(leadId: number, productoId: number, productosYaLeidos?: readonly number[]): Promise<string | null> {
  return (await ubicacionEnEntregaDe(leadId, productoId, productosYaLeidos)).etapa;
}

/**
 * Lo mismo que `etapaActualDe`, y además si su fila apunta a una etapa BORRADA.
 *
 * `etapa` sigue la regla del curso y del portal: con la etapa borrada, la PRIMERA (el alumno
 * tiene que poder ver algo, y el paso automático decide desde ahí). `borrada` es la CLAVE que
 * dice su fila cuando el catálogo ya no la tiene; `null` si no es el caso.
 *
 * ⚠️ EXISTE PARA QUE LA FICHA NO SE CONTRADIGA. La cabecera de la ficha (FichaEntrega) dice
 * «Etapa borrada» para ese cliente y la pestaña Curso, leyendo sólo `etapaActualDe`, marcaba
 * «Actual» la primera etapa: la misma pantalla diciendo dos cosas del mismo cliente. El equipo
 * necesita ver el hecho (está en una etapa que ya no existe: hay que moverlo); el alumno, no.
 * Por eso son dos campos y no un cambio de la regla: la regla la usan el portal, los mensajes y
 * el paso automático, y ésos siguen igual.
 */
export async function ubicacionEnEntregaDe(leadId: number, productoId: number, productosYaLeidos?: readonly number[]): Promise<{ etapa: string | null; borrada: string | null }> {
  // `productosYaLeidos`: quien ya los tiene (la ficha, el portal) los pasa. Leerlos son dos
  // rondas de consultas (catálogo, embudos, filas), y repetirlas por producto alargaba la ficha.
  const [{ entregaDeProductoEstricta, entregaDeCliente }, { entregaPorDefecto }, productos] = await Promise.all([
    import('./entrega-servicio'),
    import('./servicio-etapas'),
    productosYaLeidos ?? productosDelAlumno(leadId),
  ]);
  if (!productos.includes(productoId)) return { etapa: null, borrada: null };
  const [leida, fila] = await Promise.all([entregaDeProductoEstricta(productoId), entregaDeCliente(leadId, productoId)]);
  // `leida ?? default` es EXACTAMENTE lo que contesta `entregaDeProducto`: la `etapa` sale igual
  // que siempre. La lectura estricta es para `borrada`, de abajo.
  const cfg = leida ?? entregaPorDefecto(productoId);
  if (fila && cfg.etapas.some((e) => e.key === fila.etapa)) return { etapa: fila.etapa, borrada: null };
  // ⚠️ «BORRADA» SÓLO CON EL CATÁLOGO LEÍDO. Con la lectura caída, `cfg` son las etapas de
  // fábrica y CUALQUIER clave declarada «no está»: se afirmaría una etapa borrada sobre un
  // cliente que está bien. No poder leer no es un valor del dato.
  return { etapa: cfg.etapas[0]?.key ?? null, borrada: fila && leida ? fila.etapa : null };
}
