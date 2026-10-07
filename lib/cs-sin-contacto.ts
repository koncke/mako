import 'server-only';

// =============================================================================
// cs-sin-contacto — la alerta de baja AL DUEÑO: clientes que se enfriaron (#109)
// =============================================================================
// Lo corre UNA vez por día el cron app/api/cron/cs-sin-contacto, adentro del workspace de cada
// negocio (`runWithWorkspace`). La regla de a quién se avisa es PURA y tiene test
// (`avisosSinContacto`, ./cs-contacto.ts); acá viven las lecturas y el envío.
//
// Decisión de Martín (06/10/2026, «Columnas + alerta»): sin IA, al DUEÑO y nunca al cliente.
// Un cliente ganado que no está dado de baja ni graduado y lleva 21 días sin contacto ni
// movimiento de etapa → un aviso con quién es, cuántos días y qué hacer.
//
// ⚠️ NUNCA LE ESCRIBE AL CLIENTE. El único envío de este archivo es `emitirAviso`, que va al grupo
// «MaKo <> negocio» del dueño (o a su mail, si lo prendió). No depende de `envioWhatsappHabilitado`
// ni del horario de mensajes: esos gobiernan lo que se le escribe a un LEAD, y acá no se le escribe
// a ninguno — lo fija tests/cs-sin-contacto.test.ts. Tampoco va `alDueno: true`, que es el grupo del
// SUPER ADMIN: el dueño de un negocio es quien atiende a esos clientes, no la plataforma.
//
// ⚠️ UNO POR CLIENTE Y POR RACHA: el `dedupKey` es el cliente + el instante en que empezó su
// silencio (`claveRacha`), con un TTL de un año. Correr el cron todos los días no repite nada.

import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { emitirAviso } from './avisos';
import { linkApp } from './app-url';
import { ultimoContactoDeClientes } from './cs-cartera';
import {
  avisosSinContacto, textoSinContacto, tituloSinContacto,
  TIPO_AVISO_SIN_CONTACTO, TOPE_AVISOS_POR_CORRIDA, DEDUP_RACHA_MIN,
  type ClienteParaAviso, type AvisoSinContacto,
} from './cs-contacto';

/** Lo que devuelve una corrida, para el log del cron. */
export type CorridaSinContacto = {
  clientes: number;
  /** Cuántos cumplen la regla HOY (avisados antes incluidos). */
  enRiesgo: number;
  /** Avisos que salieron en esta corrida. */
  avisados: number;
  /** Los que ya se habían avisado en esta misma racha (el dedup los saltea). */
  yaAvisados: number;
  /** Los que cumplen y quedan para mañana por el tope. */
  enEspera: number;
  /** El dueño apagó el aviso: no se sigue recorriendo la lista. */
  apagado: boolean;
  /** Con `dry`, quiénes habrían salido. No viaja nada más que esto. */
  lista?: Array<Pick<AvisoSinContacto, 'leadId' | 'nombre' | 'dias' | 'desde'>>;
};

const TANDA_IDS = 150;
const tandas = <T,>(xs: readonly T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/**
 * Lee `lead_id` → algo de una tabla por cliente, paginado y de a tandas. `null` = no se pudo leer
 * (nunca un mapa vacío: «no tiene fila» y «no pude mirar» son dos respuestas).
 */
async function porCliente<F extends { lead_id: number }>(
  tabla: string, cols: string, ids: number[], juntar: (prev: string | undefined, f: F) => string | undefined,
): Promise<Record<number, string> | null> {
  try {
    const db = await getTenantDb();
    const filas = (await Promise.all(tandas(ids, TANDA_IDS).map((t) =>
      leerTodo<F>(db, tabla, cols, { orden: 'id', filtros: (q) => q.in('lead_id', t) })))).flat();
    const out: Record<number, string> = {};
    for (const f of filas) {
      const id = Number(f.lead_id);
      const v = juntar(out[id], f);
      if (v !== undefined) out[id] = v;
    }
    return out;
  } catch (e) {
    console.error(`[cs-sin-contacto] no pude leer ${tabla}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** El más nuevo de dos instantes ISO, por su valor y no por el texto. */
const masNuevo = (a: string | undefined, b: string | null): string | undefined => {
  if (!b || !Number.isFinite(Date.parse(b))) return a;
  if (!a) return b;
  return Date.parse(b) > Date.parse(a) ? b : a;
};

/**
 * Avisa al dueño del workspace ACTUAL por los clientes que se enfriaron. Tira si no se puede
 * leer la cartera o alguna de las tres señales: el cron lo cuenta como un workspace caído, que
 * es lo honesto — «no pude mirar» no es «nadie se enfrió».
 */
export async function avisarClientesSinContacto(ws: number, opts: { ahora: number; dry?: boolean }): Promise<CorridaSinContacto> {
  const db = await getTenantDb();
  // Los ganados, con la misma definición que la pantalla (`clientesGanados`): `estado_lead =
  // 'ganado'`, paginado por `id`. Si esta lectura falla no hay a quién mirar, y el error sube.
  const leads = await leerTodo<{ id: number; nombre: string | null; fecha_cierre: string | null }>(
    db, 'leads', 'id, nombre, fecha_cierre', { orden: 'id', eq: { estado_lead: 'ganado' } });
  const clientes: ClienteParaAviso[] = leads.map((l) => ({
    leadId: Number(l.id), nombre: (l.nombre ?? '').trim(), cierre: l.fecha_cierre,
  }));
  const base = { clientes: clientes.length, enRiesgo: 0, avisados: 0, yaAvisados: 0, enEspera: 0, apagado: false };
  if (!clientes.length) return base;
  const ids = clientes.map((c) => c.leadId);

  const [contacto, estado, movimiento] = await Promise.all([
    ultimoContactoDeClientes(ids),
    // `cs_clientes` tiene una fila por cliente (índice único): el estado es el de esa fila.
    porCliente<{ lead_id: number; estado: string | null }>('cs_clientes', 'id, lead_id, estado', ids,
      (_prev, f) => f.estado ?? undefined),
    // Un cliente puede estar en la entrega de VARIOS productos: cuenta el movimiento más nuevo.
    porCliente<{ lead_id: number; etapa_desde: string | null }>('cliente_entrega', 'id, lead_id, etapa_desde', ids,
      (prev, f) => masNuevo(prev, f.etapa_desde)),
  ]);

  const plan = avisosSinContacto(clientes, { contacto, estado, movimiento }, opts.ahora);
  if (!plan) {
    const falta = [!contacto && 'el contacto', !estado && 'cs_clientes', !movimiento && 'la entrega'].filter(Boolean).join(', ');
    throw new Error(`No pude leer ${falta}: no se avisa nada.`);
  }
  if (opts.dry) {
    return { ...base, enRiesgo: plan.length, lista: plan.map((a) => ({ leadId: a.leadId, nombre: a.nombre, dias: a.dias, desde: a.desde })) };
  }

  let avisados = 0;
  let yaAvisados = 0;
  let apagado = false;
  let recorridos = 0;
  for (const a of plan) {
    // ⚠️ EL TOPE CUENTA LOS QUE SALEN, NO LOS QUE SE MIRAN. Con «los primeros N de la lista», los
    // ya avisados ocuparían los N lugares para siempre y el resto no saldría nunca.
    if (avisados >= TOPE_AVISOS_POR_CORRIDA) break;
    recorridos++;
    const r = await emitirAviso({
      ws,
      tipo: TIPO_AVISO_SIN_CONTACTO,
      titulo: tituloSinContacto(a.nombre),
      texto: textoSinContacto({ nombre: a.nombre, dias: a.dias, link: linkApp(`/customer-success?cliente=${a.leadId}`, ws) }),
      categoria: 'aviso',
      semaforo: 'amarillo',
      link: `/customer-success?cliente=${a.leadId}`,
      dedupKey: a.clave,
      dedupTtlMin: DEDUP_RACHA_MIN,
      lead: { id: a.leadId, nombre: a.nombre },
    });
    // Apagado es del TIPO, no del cliente: los siguientes saldrían igual de apagados, y cada uno
    // dejaría otra fila en el feed. Se corta acá.
    if (r.apagado) { apagado = true; break; }
    if (r.deduped) { yaAvisados++; continue; }
    if (r.ok) avisados++;
  }
  // Los que no llegó a mirar: ni avisados ni ya avisados — quedan para la corrida de mañana.
  const enEspera = apagado ? 0 : plan.length - recorridos;
  return { ...base, enRiesgo: plan.length, avisados, yaAvisados, enEspera, apagado };
}
