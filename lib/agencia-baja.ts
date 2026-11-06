// =============================================================================
// agencia-baja — DAR DE BAJA la cuenta de un cliente de una agencia (29/10/2026)
// =============================================================================
// Lo que Martín le prometió a Thiago (llamada del 29/10, 10:07, docs/promesas/2910-llamada-thiago.md): la agencia puede
// «darlo de baja cuando vos quieras». Hasta hoy la ficha sólo tenía «Pagar su mes», «Activar renovación» e «Inspeccionar»:
// la suscripción le seguía cobrando a la agencia hasta que la cancelara ella en la pasarela, y la cuenta quedaba abierta.
//
// Hace cuatro cosas, en este orden (la plata primero: si no se pudo dejar de cobrar, no se sigue):
//   1. Deja de COBRAR: cancela en la pasarela toda suscripción viva (Mercado Pago o Stripe, `cancelarSuscripcionCobro`: la
//      pagada, la autorizada sin cobrar, la fallida y la del primer pago devuelto) y anula los links que todavía se podían
//      pagar (el primer mes, una renovación sin autorizar). Las reglas, en `queHacerEnLaBaja` (lib/agencia-cobro-reglas.ts).
//      ⚠️ SI LA PAGABA EL CLIENTE (revisión de plata, hallazgo 5): su suscripción NO se cancela, pasa a ser SU plan
//      (`alta_ws`), y la cuenta sigue abierta. Si no tenía una viva, se pausa recién al fin de lo que ya pagó.
//   2. La cartera pasa a REVOCADA: desde ahí la agencia no entra más («Inspeccionar» pregunta `puedeEntrar`, que sólo deja
//      las aprobadas) y la cuenta sale de su lista de activas.
//   3. LO QUE PASA CON LOS DATOS (lo decidió el Cerebro el 29/10, hasta que Martín diga otra cosa): NO SE BORRA NADA. La cuenta
//      queda del cliente, sin la agencia y PAUSADA (el corte `sin-agencia`); si quiere seguir, elige su plan y paga él
//      (/cuenta-pausada → «Elegir mi plan»). El corte vale aunque el corte general por pago esté apagado (lib/workspace.ts →
//      `negocioPausado`, hallazgo 1), y lo levanta sólo un plan suyo al día (lib/plan-acceso.ts).
//   4. Le AVISA al cliente (a los admins de su cuenta), por mail.
//
// ⚠️ Sólo la agencia DUEÑA de esa fila de la cartera (agencia_ws + cliente_ws): una agencia nunca da de baja a otra.
// ⚠️ Idempotente: dar de baja dos veces no cancela dos veces ni manda dos mails (la segunda ve la cartera ya revocada).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { linkApp } from './app-url';
import { anularCobro, cancelarSuscripcionCobro } from './cobros';
import { avisarDePlataforma } from './invitaciones';
import { CLAVE_CORTE, type CorteGuardado } from './plan-acceso-reglas';
import { clienteDeAgenciaTocable, finDeLoQuePago, queHacerEnLaBaja, type CobroEnLaBaja } from './agencia-cobro-reglas';
import { KEY_QUIEN_PAGA, quienPagaDe } from './agency-reglas';
import { estadoDeLoGuardado } from './onboarding-contrato';
import { ONBOARDING_KEY } from './onboarding-state';

export type ResultadoBajaCliente = { ok: true; resumen: string; yaEstaba?: true } | { ok: false; error: string };

type FilaCobro = CobroEnLaBaja & { id: number };

/** Los cobros de la plataforma del lugar de ESE cliente de ESA agencia (los cerrados no: anulados, ni de otra agencia). */
async function cobrosDelLugar(plataforma: number, agenciaWs: number, clienteWs: number): Promise<FilaCobro[]> {
  const { data, error } = await getSupabaseServer().from('cobros').select('id, tipo, estado, suscripcion_estado, pagado_at')
    .eq('workspace_id', plataforma).eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs)
    .in('estado', ['pendiente', 'fallido', 'pagado', 'reembolsado']).limit(50);
  if (error) throw new Error(`No pude leer los cobros del cliente: ${error.message}`);
  return (data ?? []) as FilaCobro[];
}

/** ¿La cuenta la paga el cliente (`agency.quien_paga`, en SU cuenta)? Sin poder leerlo, la baja no sigue: decide qué se cancela. */
async function laPagaElCliente(clienteWs: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', KEY_QUIEN_PAGA).maybeSingle();
  if (error) throw new Error(`No pude leer quién paga la cuenta: ${error.message}`);
  return quienPagaDe((data as { value?: unknown } | null)?.value) === 'cliente';
}

/** ¿El cliente ya tiene un plan PROPIO vivo (`alta_ws`)? Lo tiene si se le pasó en una baja anterior que se cortó a mitad. */
async function tienePlanPropioVivo(plataforma: number, clienteWs: number): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('cobros').select('id').eq('workspace_id', plataforma).eq('alta_ws', clienteWs)
    .eq('tipo', 'suscripcion').eq('suscripcion_estado', 'activa').limit(1);
  if (error) throw new Error(`No pude leer su plan: ${error.message}`);
  return !!data?.length;
}

/** Cuándo terminó el onboarding del cliente (de ahí corre su primer mes), o null. */
async function onboardingCompletoDe(clienteWs: number): Promise<string | null> {
  const { data } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', ONBOARDING_KEY).maybeSingle();
  const crudo = (data as { value: unknown } | null)?.value ?? null;
  const e = estadoDeLoGuardado(crudo == null ? null : typeof crudo === 'string' ? crudo : JSON.stringify(crudo));
  return e.status === 'done' ? e.completedAt ?? null : null;
}

/** Los emails de los admins de una cuenta (también avisa el cambio de plan, lib/agencia-plan.ts). */
export async function adminsDeCuenta(ws: number): Promise<string[]> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, rol_ws').eq('workspace_id', ws).limit(20);
  return [...new Set(((data ?? []) as Array<{ email: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => u.email!.toLowerCase()))];
}

export async function darDeBajaClienteDeAgencia(p: { agenciaWs: number; clienteWs: number; autor: string }): Promise<ResultadoBajaCliente> {
  const { agenciaWs, clienteWs } = p;
  // ⚠️ LA PLATAFORMA NO ES CLIENTE DE NADIE (6/11/2026, #495): antes de leer la cartera, porque lo que viene después
  // CANCELA suscripciones y ANULA links. Con una fila `agencia_clientes` apuntando al ws de la plataforma, esto le
  // cancelaba sus cobros y la dejaba pausada. Ver `clienteDeAgenciaTocable`.
  const tocable = clienteDeAgenciaTocable({ agenciaWs, clienteWs, plataformaWs: await wsSuperAdmin() });
  if (!tocable.ok) return { ok: false, error: tocable.error };
  const db = getSupabaseServer();
  const { data: fila, error: eFila } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).maybeSingle();
  if (eFila) return { ok: false, error: `No pude leer tu cartera: ${eFila.message}` };
  if (!fila) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  if ((fila as { estado: string }).estado === 'revocado') return { ok: true, resumen: 'Esa cuenta ya estaba dada de baja.', yaEstaba: true };

  // 1. Dejar de cobrar. Si una cancelación falla, se corta acá: la cartera sigue como estaba y la agencia reintenta.
  const plataforma = await wsSuperAdmin();
  let cobros: FilaCobro[];
  let pagaCliente: boolean;
  try { [cobros, pagaCliente] = await Promise.all([cobrosDelLugar(plataforma, agenciaWs, clienteWs), laPagaElCliente(clienteWs)]); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  // El último pago de cada suscripción (H8 de la verificación independiente): de ahí cuenta lo que ya pagó quien paga él.
  if (pagaCliente) {
    const subs = cobros.filter((c) => c.tipo === 'suscripcion').map((c) => c.id);
    const { data: pagos } = subs.length ? await db.from('pagos').select('cobro_id, fecha_pago').eq('workspace_id', plataforma).in('cobro_id', subs).eq('pagado', true).limit(500) : { data: [] };
    for (const x of (pagos ?? []) as Array<{ cobro_id: number; fecha_pago: string | null }>) {
      const c = cobros.find((y) => y.id === Number(x.cobro_id));
      if (c && x.fecha_pago && (!c.ultimo_pago || x.fecha_pago > c.ultimo_pago)) c.ultimo_pago = x.fecha_pago;
    }
  }
  let cancelados = 0;
  let pasados = 0;
  for (const c of cobros) {
    const que = queHacerEnLaBaja(c, pagaCliente);
    if (que === 'cancelar') {
      const r = await cancelarSuscripcionCobro(plataforma, c.id, p.autor);
      if (!r.ok) return { ok: false, error: `No pude cancelar su cobro: ${r.resumen || 'la pasarela no contestó'}. Prueba otra vez en un minuto.` };
      cancelados++;
    } else if (que === 'pasar') {
      // Su suscripción pasa a ser SU plan: `alta_ws` la hace suya (Tu plan, darse de baja, los topes) y sin `cliente_ws` se mide
      // como cualquier plan propio. Sólo si sigue siendo de ESTA agencia (compare-and-set).
      const { data: pasada, error: ePasar } = await db.from('cobros').update({ alta_ws: clienteWs, agencia_ws: null, cliente_ws: null })
        .eq('id', c.id).eq('workspace_id', plataforma).eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).select('id');
      if (ePasar) return { ok: false, error: `No pude pasarle su plan: ${ePasar.message}` };
      if (pasada?.length) pasados++;
    } else if (que === 'anular') {
      const r = await anularCobro(plataforma, c.id, p.autor);
      if (!r.ok) return { ok: false, error: `No pude cancelar su link de pago: ${r.error ?? 'sin detalle'}. Prueba otra vez en un minuto.` };
      cancelados++;
    }
  }

  // 2. Sin la agencia y pausada, con los datos intactos. El corte guardado dice por qué (/cuenta-pausada) y lo reabre su pago.
  //    ANTES de revocar (segunda pasada de la revisión de plata): si guardar el corte falla, la baja se frena y se reintenta
  //    entera; revocada primero, el reintento contestaba «ya estaba» y la cuenta quedaba abierta y gratis.
  //    Si la pagaba el cliente y su plan pasó a ser suyo, no se pausa. Si la pagaba él sin una suscripción viva (sólo el primer
  //    mes), la pausa queda PROGRAMADA para el fin de lo que pagó (`cobroId: -1` y `desde`): la pone el cron ese día
  //    (lib/plan-acceso.ts). Marcarla pausada ya apagaba los crons de la cuenta los días que había pagado (hallazgo D).
  const ahora = new Date().toISOString();
  let usaHasta: string | null = null;
  // Un reintento (la cartera no se dejó revocar la primera vez) ya no ve la suscripción que se le pasó: se mira su plan propio.
  // Sin poder leerlo, no se sigue: pausar a quien ya paga su plan es peor que reintentar.
  let conPlanPropio = pasados > 0;
  if (!conPlanPropio && pagaCliente) {
    try { conPlanPropio = await tienePlanPropioVivo(plataforma, clienteWs); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }
  if (!conPlanPropio) {
    const fin = pagaCliente ? finDeLoQuePago(cobros, await onboardingCompletoDe(clienteWs).catch(() => null)) : null;
    const desde = fin && fin > ahora ? fin : ahora;
    const programada = desde > ahora;
    if (programada) usaHasta = desde;
    const corte: CorteGuardado = { cobroId: programada ? -1 : 0, hasta: desde.slice(0, 10), motivo: 'sin-agencia', desde, vigente: true };
    const { error: eCorte } = await db.from('app_settings')
      .upsert({ workspace_id: clienteWs, key: CLAVE_CORTE, value: JSON.stringify(corte), updated_at: ahora }, { onConflict: 'workspace_id,key' });
    if (eCorte) return { ok: false, error: `Se canceló su cobro, pero no pude cerrar su cuenta: ${eCorte.message}. Prueba otra vez en un minuto.` };
    if (!programada) {
      // Si esto falla, se frena acá y se reintenta entera (la cartera sigue sin revocar): el cron no pausa un corte que no es el programado.
      const { error: ePausa } = await db.from('workspaces').update({ estado: 'pausado', updated_at: ahora }).eq('id', clienteWs).eq('estado', 'activo');
      if (ePausa) return { ok: false, error: `Se canceló su cobro, pero no pude pausar su cuenta: ${ePausa.message}. Prueba otra vez en un minuto.` };
    }
  }

  // 3. La cartera, revocada (compare-and-set: dos bajas a la vez no hacen dos veces lo de abajo).
  const { data: rev, error: eRev } = await db.from('agencia_clientes')
    .update({ estado: 'revocado', decidido_por: p.autor.slice(0, 120), decidido_at: ahora, motivo: 'La agencia lo dio de baja.' })
    .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).neq('estado', 'revocado').select('cliente_ws');
  if (eRev) return { ok: false, error: `Se canceló su cobro, pero no pude sacarlo de tu cartera: ${eRev.message}` };
  if (!rev?.length) return { ok: true, resumen: 'Esa cuenta ya estaba dada de baja.', yaEstaba: true };
  // Lo que el cron haya abierto entre la cancelación y la revocación (hallazgo 11), anulado. Best effort: ya no se renueva.
  for (const c of await cobrosDelLugar(plataforma, agenciaWs, clienteWs).catch(() => [] as FilaCobro[])) {
    if (queHacerEnLaBaja(c, pagaCliente) === 'anular') await anularCobro(plataforma, c.id, p.autor).catch(() => {});
  }

  // 4. El aviso al cliente. Best effort: la baja ya está hecha.
  const { data: ag } = await db.from('workspaces').select('nombre').eq('id', agenciaWs).maybeSingle();
  const agencia = String((ag as { nombre?: string } | null)?.nombre ?? 'Tu agencia');
  for (const to of await adminsDeCuenta(clienteWs).catch(() => [] as string[])) {
    await avisarDePlataforma({
      to, asunto: 'Tu agencia dejó de administrar tu cuenta de MaKo', preheader: 'Tus datos están guardados.', tag: 'agencia-baja',
      cuerpo: (conPlanPropio
        ? ['Hola,', '', `${agencia} dejó de administrar tu cuenta de MaKo.`, '',
          'Tu plan sigue igual: lo pagas tú, como hasta ahora, y lo ves en «Tu plan»:', linkApp('/configuraciones/plan', clienteWs)]
        : ['Hola,', '', usaHasta
          ? `${agencia} dejó de administrar tu cuenta de MaKo. La usas hasta el ${usaHasta.slice(8, 10)}/${usaHasta.slice(5, 7)}, que es lo que ya pagaste.`
          : `${agencia} dejó de administrar tu cuenta de MaKo, y ya no la paga.`, '',
        'Tus datos están guardados y no se borra nada. Si quieres seguir usando MaKo, elige tu plan y vuelves a entrar en el acto:',
        linkApp('/cuenta-pausada', clienteWs)]).join('\n'),
    }).catch((e) => console.warn(`[agencia-baja] cliente ${clienteWs}: no pude avisarle: ${e instanceof Error ? e.message : String(e)}`));
  }
  const cobrosTxt = conPlanPropio ? ' Su plan sigue: lo paga tu cliente, como hasta ahora.' : cancelados ? ' Su cobro quedó cancelado.' : '';
  return { ok: true, resumen: `Listo: diste de baja la cuenta.${cobrosTxt} Ya no entras a ella y a tu cliente le avisamos; sus datos quedan guardados.` };
}
