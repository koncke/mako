// =============================================================================
// agencia-cobro — el cobro de un cliente de AGENCIA: el link del primer mes y la renovación (#866 y #867, 17/10/2026)
// =============================================================================
// Las reglas y el porqué, en lib/agencia-cobro-reglas.ts. Acá está lo que necesita base y pasarela:
//   · el precio (app_settings de la PLATAFORMA);
//   · `linkPrimerMes`: lo crea `crearCuentaMakoAction` (app/customer-success/actions.ts) al abrirle la cuenta;
//   · `renovacionesDeAgencia`: el cron de cobros (cada 30 min) crea la suscripción mensual cuando el cliente termina el
//     onboarding, y anota cuando la agencia la autorizó;
//   · `cobrosDeClientesDeAgencia`: lo que la pantalla de la agencia muestra en cada cliente.
//
// ⚠️ TODO COBRO ES DE LA PLATAFORMA (`wsSuperAdmin()`), con su Mercado Pago: lo que se cobra es el lugar en MaKo. Un
//    negocio no se cobra a sí mismo; `crearCobro` rechaza `paraCliente` fuera de la plataforma.
// ⚠️ SIN LA MERCADO PAGO DE MAKO O SIN EL PRECIO EN PESOS NO HAY LINK, y no es un error: la cuenta queda como siempre,
//    esperando que el super admin la apruebe (lib/agencia.ts). Lo dice `motivo`, para la agencia y para el log.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSetting, setSetting } from './settings';
import { anotarAutorizacionMp, crearCobro, linkDelCobro, pasarelasConectadas } from './cobros';
import { COLS_COBRO, cobroDeFila } from './cobros-tipos';
import { estadoDeLoGuardado } from './onboarding-contrato';
import { ONBOARDING_KEY } from './onboarding-state';
import {
  KEY_PRECIO_CLIENTE_AGENCIA, cobrosParaLaAgencia, desdeDelMes, inicioDeRenovacion, sanearPrecioClienteAgencia,
  type CobroDeCliente, type PrecioClienteAgencia,
} from './agencia-cobro-reglas';

export async function precioClienteDeAgencia(): Promise<PrecioClienteAgencia> {
  const plataforma = await wsSuperAdmin();
  return runWithWorkspace(plataforma, async () => sanearPrecioClienteAgencia(await getSetting(KEY_PRECIO_CLIENTE_AGENCIA)));
}

/** Lo guarda el super admin (/admin/cobros). Devuelve lo que QUEDÓ, saneado. */
export async function guardarPrecioClienteDeAgencia(p: unknown): Promise<PrecioClienteAgencia> {
  const limpio = sanearPrecioClienteAgencia(p);
  const plataforma = await wsSuperAdmin();
  await runWithWorkspace(plataforma, () => setSetting(KEY_PRECIO_CLIENTE_AGENCIA, JSON.stringify(limpio)));
  return limpio;
}

/** La ficha de la agencia en el CRM de MaKo: el lead de la plataforma que apunta a su cuenta (`leads.cliente_ws`). */
async function leadDeLaAgencia(plataforma: number, agenciaWs: number): Promise<number | null> {
  const { data, error } = await getSupabaseServer().from('leads').select('id')
    .eq('workspace_id', plataforma).eq('cliente_ws', agenciaWs).order('id').limit(1).maybeSingle();
  if (error) throw new Error(`No pude leer la ficha de la agencia en el CRM de MaKo: ${error.message}`);
  return data ? Number((data as { id: number }).id) : null;
}

export type ResultadoLinkCliente = { ok: true; link: string; yaEstaba: boolean } | { ok: false; motivo: string };

/** Lo que falta para que MaKo pueda cobrar el lugar de un cliente (`motivo`), o el precio con el que se cobra. */
async function faltaParaCobrar(plataforma: number): Promise<{ motivo: string } | { precio: PrecioClienteAgencia & { mp: NonNullable<PrecioClienteAgencia['mp']> } }> {
  const conectadas = await pasarelasConectadas(plataforma);
  if (!conectadas.includes('mercadopago')) return { motivo: 'MaKo todavía no tiene su Mercado Pago conectado.' };
  const precio = await precioClienteDeAgencia();
  if (!precio.mp) return { motivo: 'Falta el precio en pesos del cliente de agencia (en /admin/cobros).' };
  return { precio: { ...precio, mp: precio.mp } };
}

/**
 * El link del PRIMER MES de un cliente de agencia (#866): pago único, de la Mercado Pago de MaKo, a la ficha de la agencia
 * en el CRM de MaKo. Al pagarse, el cliente queda habilitado (`habilitarClienteDeAgencia`). Si ya hay uno vivo, ése.
 * `email` es el de quien lo abre en la agencia: el de quien paga, y el que pide la suscripción del mes siguiente.
 */
export async function linkPrimerMes(p: { agenciaWs: number; clienteWs: number; nombreCliente: string; email: string | null; creadoPor: string }): Promise<ResultadoLinkCliente> {
  try {
    const plataforma = await wsSuperAdmin();
    const falta = await faltaParaCobrar(plataforma);
    if ('motivo' in falta) return { ok: false, motivo: falta.motivo };
    const leadId = await leadDeLaAgencia(plataforma, p.agenciaWs);
    if (!leadId) return { ok: false, motivo: 'La agencia no tiene su ficha en el CRM de MaKo.' };
    const r = await crearCobro(plataforma, {
      leadId, pasarela: 'mercadopago', tipo: 'unico',
      monto: falta.precio.mp.monto, moneda: falta.precio.mp.moneda, montoUsd: falta.precio.usd,
      concepto: `MaKo · ${p.nombreCliente.trim() || `cliente ${p.clienteWs}`} · primer mes`.slice(0, 200),
      email: p.email, paraCliente: { agenciaWs: p.agenciaWs, clienteWs: p.clienteWs }, creadoPor: p.creadoPor,
    });
    return r.ok ? { ok: true, link: r.link, yaEstaba: !!r.yaEstaba } : { ok: false, motivo: r.error };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}

type FilaPrimerMes = { id: number; lead_id: number | null; agencia_ws: number; cliente_ws: number; email: string | null; pagado_at: string | null; concepto: string };

/**
 * El cron (#867): por cada cliente de agencia con el primer mes PAGADO y sin renovación, si ya terminó el onboarding,
 * crea la suscripción mensual con su primer cobro un mes después de que arrancó su mes. Y anota las renovaciones que la
 * agencia ya autorizó. Sólo en la plataforma; nunca tira por un cliente (lo cuenta en `errores`).
 */
export async function renovacionesDeAgencia(): Promise<{ creadas: number; autorizadas: number; errores: number }> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const [primeros, renov] = await Promise.all([
    db.from('cobros').select('id, lead_id, agencia_ws, cliente_ws, email, pagado_at, concepto')
      .eq('workspace_id', plataforma).eq('tipo', 'unico').eq('estado', 'pagado').not('cliente_ws', 'is', null).limit(200),
    db.from('cobros').select(`${COLS_COBRO}, cliente_ws`)
      .eq('workspace_id', plataforma).eq('tipo', 'suscripcion').not('cliente_ws', 'is', null)
      .in('estado', ['pendiente', 'fallido', 'pagado']).limit(500),
  ]);
  if (primeros.error) throw new Error(`No pude leer los primeros meses de los clientes de agencia: ${primeros.error.message}`);
  if (renov.error) throw new Error(`No pude leer las renovaciones de los clientes de agencia: ${renov.error.message}`);
  const renovaciones = (renov.data ?? []).map((x) => ({ cobro: cobroDeFila(x as Record<string, unknown>), clienteWs: Number((x as { cliente_ws: number }).cliente_ws) }));
  const conRenovacion = new Set(renovaciones.filter((r) => r.cobro.suscripcion_estado !== 'cancelada').map((r) => r.clienteWs));

  let creadas = 0;
  let autorizadas = 0;
  let errores = 0;
  const falta = await faltaParaCobrar(plataforma);
  for (const f of (primeros.data ?? []) as FilaPrimerMes[]) {
    const clienteWs = Number(f.cliente_ws);
    if (conRenovacion.has(clienteWs) || !f.lead_id) continue;
    try {
      const { data: on, error } = await db.from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', ONBOARDING_KEY).maybeSingle();
      if (error) throw new Error(error.message);
      const crudo = (on as { value: unknown } | null)?.value ?? null;
      const estado = estadoDeLoGuardado(crudo == null ? null : typeof crudo === 'string' ? crudo : JSON.stringify(crudo));
      if (estado.status !== 'done') continue; // su mes todavía no arrancó
      const desde = desdeDelMes({ onboardingCompletoAt: estado.completedAt, pagadoAt: f.pagado_at });
      if (!desde) continue;
      if ('motivo' in falta) { console.warn(`[agencia-cobro] el cliente ${clienteWs} terminó el onboarding y no hay renovación: ${falta.motivo}`); continue; }
      const r = await crearCobro(plataforma, {
        leadId: f.lead_id, pasarela: 'mercadopago', tipo: 'suscripcion',
        monto: falta.precio.mp.monto, moneda: falta.precio.mp.moneda, montoUsd: falta.precio.usd,
        concepto: f.concepto.replace(/ · primer mes$/, ' · mensual').slice(0, 200),
        email: f.email, paraCliente: { agenciaWs: Number(f.agencia_ws), clienteWs },
        inicioAt: inicioDeRenovacion(desde, Date.now()), creadoPor: 'MaKo · fin del onboarding',
      });
      if (r.ok) { if (!r.yaEstaba) creadas++; }
      else { errores++; console.error(`[agencia-cobro] no pude crear la renovación del cliente ${clienteWs}: ${r.error}`); }
    } catch (e) {
      errores++;
      console.error(`[agencia-cobro] renovación del cliente ${clienteWs}:`, e instanceof Error ? e.message : String(e));
    }
  }
  for (const { cobro } of renovaciones) {
    if (await anotarAutorizacionMp(cobro)) autorizadas++;
  }
  return { creadas, autorizadas, errores };
}

/**
 * Lo que la pantalla de la AGENCIA muestra en cada cliente suyo: el link del primer mes o el de la renovación. Lee los
 * cobros de la plataforma con el cliente de servicio, y SÓLO los de esta agencia (`agencia_ws`): una agencia nunca ve
 * los links de otra. Sin la migración 0308 (o si falla), `{}`: la pantalla queda como era.
 */
export async function cobrosDeClientesDeAgencia(agenciaWs: number): Promise<ReturnType<typeof cobrosParaLaAgencia>> {
  try {
    const plataforma = await wsSuperAdmin();
    const { data, error } = await getSupabaseServer().from('cobros')
      .select('cliente_ws, tipo, estado, suscripcion_estado, token, inicio_at, created_at')
      .eq('workspace_id', plataforma).eq('agencia_ws', agenciaWs).not('cliente_ws', 'is', null)
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as Array<Omit<CobroDeCliente, 'link'> & { token: string }>;
    return cobrosParaLaAgencia(filas.map(({ token, ...f }) => ({ ...f, cliente_ws: Number(f.cliente_ws), link: linkDelCobro(token) })));
  } catch (e) {
    console.error(`[agencia-cobro] cobros de los clientes de la agencia ${agenciaWs}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

