// =============================================================================
// Agency Dashboard — el lado servidor: sumarse, quién paga cada cliente y el cartel de pago del cliente (25/10/2026)
// =============================================================================
// Las reglas, en lib/agency-reglas.ts (sin `server-only`, para los tests). La cartera y su guard siguen donde estaban
// (lib/agencia.ts, lib/agencia-cartera.ts) y el cobro del lugar de cada cliente también (lib/agencia-cobro.ts): esto no
// es otra máquina, es lo que faltaba para que una agencia se SUME sola y para que el cliente pueda pagar su cuenta.
//
// ⚠️ LO QUE CRUZA DE INQUILINO se lee con el cliente de servicio y SÓLO lo que la pantalla necesita: quién paga (una
//    palabra) y si terminó el onboarding. Nada del negocio del cliente viaja a la agencia por acá.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getWorkspace, runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSetting, setSetting } from './settings';
import { anotarAgency, esAgencia, seSumoComoAgency, agenciaDeCliente } from './agencia';
import { cobrosDeClientesDeAgencia, precioClienteDeAgencia } from './agencia-cobro';
import { estadoDeLoGuardado } from './onboarding-contrato';
import { ONBOARDING_KEY } from './onboarding-state';
import { esWsValido } from './agencia-cartera';
import {
  KEY_PERFIL_AGENCY, KEY_QUIEN_PAGA, TEXTO_NO_AGENCY, cartelDePago, puedeSumarseComoAgency, quienPagaDe, sanearPerfilAgency,
  type CartelDePago, type MotivoNoAgency, type PerfilAgency, type QuienPaga,
} from './agency-reglas';

export type EstadoAgency = {
  /** Tiene el plan Pro activo y se sumó: abre cuentas y ve su dashboard. */
  esAgency: boolean;
  /** Se sumó alguna vez (la fila). `null` = no se pudo leer. */
  sumada: { desde: string } | false | null;
  /** Si puede sumarse hoy, o por qué no. */
  puede: { ok: true } | { ok: false; motivo: MotivoNoAgency };
  perfil: PerfilAgency | null;
};

/** Lo que la tab necesita saber de un negocio para decidir entre la landing y el dashboard. */
export async function estadoAgency(ws: number): Promise<EstadoAgency> {
  const [w, plataforma, esAg, sumada, perfil] = await Promise.all([
    getWorkspace(ws).catch(() => null),
    wsSuperAdmin().catch(() => null),
    esAgencia(ws),
    seSumoComoAgency(ws),
    perfilAgency(ws),
  ]);
  return {
    esAgency: esAg,
    sumada,
    puede: puedeSumarseComoAgency({ capa: w?.capa ?? null, estado: w?.estado ?? null, esPlataforma: plataforma === ws }),
    perfil,
  };
}

async function perfilAgency(ws: number): Promise<PerfilAgency | null> {
  try {
    const crudo = await runWithWorkspace(ws, () => getSetting(KEY_PERFIL_AGENCY));
    return crudo == null ? null : sanearPerfilAgency(crudo);
  } catch {
    return null;
  }
}

export type ResultadoSumarse = { ok: true; yaEstaba: boolean } | { ok: false; error: string; motivo?: MotivoNoAgency };

/**
 * SUMARSE COMO AGENCY: lo que contó (las preguntas del alta) y la fila en `agencias`. El plan se repregunta acá: esconder
 * el botón no protege nada. Lo contado se guarda ANTES de la fila: si la fila falla, sumarse otra vez no pierde nada.
 */
export async function sumarseComoAgency(p: { ws: number; quien: string | null; perfil: unknown }): Promise<ResultadoSumarse> {
  if (!esWsValido(p.ws)) return { ok: false, error: 'Ese negocio no existe.' };
  const estado = await estadoAgency(p.ws);
  if (estado.esAgency) return { ok: true, yaEstaba: true };
  if (!estado.puede.ok) return { ok: false, error: TEXTO_NO_AGENCY[estado.puede.motivo], motivo: estado.puede.motivo };
  const perfil = { ...sanearPerfilAgency(p.perfil), desde: new Date().toISOString() };
  try {
    await runWithWorkspace(p.ws, () => setSetting(KEY_PERFIL_AGENCY, JSON.stringify(perfil)));
    await anotarAgency(p.ws, p.quien, 'Se sumó desde Agency Dashboard.');
    return { ok: true, yaEstaba: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude sumarte como Agency.' };
  }
}


// ── Quién paga ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quién paga cada cuenta (de una lista de clientes), en una consulta. Lo que no se pudo leer, 'agencia' (lo de siempre). */
export async function quienPagaDeClientes(clientes: readonly number[]): Promise<Map<number, QuienPaga>> {
  const out = new Map<number, QuienPaga>();
  const ids = clientes.filter(esWsValido);
  for (const id of ids) out.set(id, 'agencia');
  if (!ids.length) return out;
  try {
    const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value')
      .in('workspace_id', ids).eq('key', KEY_QUIEN_PAGA);
    if (error) throw error;
    for (const f of (data ?? []) as Array<{ workspace_id: number; value: unknown }>) out.set(Number(f.workspace_id), quienPagaDe(f.value));
  } catch (e) {
    console.warn('[agency] no pude leer quién paga cada cuenta:', e instanceof Error ? e.message : e);
  }
  return out;
}

/** Lo escribe el alta (lib/partners.ts) en la cuenta del CLIENTE. */
export async function guardarQuienPaga(clienteWs: number, quien: QuienPaga): Promise<void> {
  await runWithWorkspace(clienteWs, () => setSetting(KEY_QUIEN_PAGA, quien));
}

/** ¿Este negocio terminó el onboarding? (lo mismo que mira el cron de las renovaciones, lib/agencia-cobro.ts). */
export async function onboardingTerminado(ws: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', ONBOARDING_KEY).maybeSingle();
  if (error) throw new Error(error.message);
  const crudo = (data as { value: unknown } | null)?.value ?? null;
  return estadoDeLoGuardado(crudo == null ? null : typeof crudo === 'string' ? crudo : JSON.stringify(crudo)).status === 'done';
}

export type CartelDelCliente = NonNullable<CartelDePago> & { agencia: string; usd: number };

/**
 * EL CARTEL DE PAGO DEL CLIENTE (punto 9: «al finalizar el onboarding de ese cliente debe saltar el cartel de pago»):
 * lo que ve el admin de una cuenta que paga él mismo. `null` si no le toca nada. Nunca tira: un cartel que no se pudo
 * armar no se muestra (la plata no se pierde: la agencia ve en su dashboard que falta el pago).
 *
 * ⚠️ ES EL TERCER LUGAR QUE DECIDE CON EL `null` DE `agenciaDeCliente`, y queda ANOTADO y SIN ARREGLAR (P15,
 * 30/10/2026). Con DOS dueños vigentes la línea de abajo devuelve `null` y el cliente que paga él mismo **no ve su
 * cartel de pago**. A diferencia de las dos pantallas de /agency, acá el `null` NO abre nada: esconde. Y no se arregla
 * cambiando a `esClienteDeAgencia`, porque lo que sigue necesita UN dueño de verdad —el nombre para el texto y
 * `cobrosDeClientesDeAgencia(agencia.ws)` para saber si ya pagó—: con dos, hay que decidir de cuál se leen los cobros
 * (o de las dos) y cómo se lo nombra sin inventar un padre («tu agencia»). Es una decisión de producto, no un cambio
 * mecánico. Mientras tanto el daño es acotado y conocido: el cliente no ve el cartel y la agencia sí ve que falta el
 * pago en su dashboard. Hoy ningún cliente tiene dos agencias. Está en docs/hallazgos-agencias.md → «Lo que quedó SIN
 * hacer».
 */
export async function cartelDelCliente(ws: number): Promise<CartelDelCliente | null> {
  try {
    if (!esWsValido(ws)) return null;
    const quien = quienPagaDe(await runWithWorkspace(ws, () => getSetting(KEY_QUIEN_PAGA)));
    if (quien !== 'cliente') return null;
    const agencia = await agenciaDeCliente(ws);
    if (!agencia) return null;
    const [terminado, cobros, precio] = await Promise.all([
      onboardingTerminado(ws),
      cobrosDeClientesDeAgencia(agencia.ws),
      precioClienteDeAgencia().catch(() => ({ usd: 47, mp: null })),
    ]);
    const cartel = cartelDePago({ quienPaga: quien, onboardingTerminado: terminado, pendiente: cobros[ws] ?? null });
    return cartel ? { ...cartel, agencia: agencia.nombre, usd: precio.usd } : null;
  } catch (e) {
    console.warn(`[agency] no pude armar el cartel de pago del negocio ${ws}:`, e instanceof Error ? e.message : e);
    return null;
  }
}
