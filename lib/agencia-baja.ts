// =============================================================================
// agencia-baja — DAR DE BAJA la cuenta de un cliente de una agencia (29/10/2026)
// =============================================================================
// Lo que Martín le prometió a Thiago (llamada del 29/10, 10:07, docs/promesas/2910-llamada-thiago.md): la agencia puede
// «darlo de baja cuando vos quieras». Hasta hoy la ficha sólo tenía «Pagar su mes», «Activar renovación» e «Inspeccionar»:
// la suscripción le seguía cobrando a la agencia hasta que la cancelara ella en la pasarela, y la cuenta quedaba abierta.
//
// Hace cuatro cosas, en este orden (la plata primero: si no se pudo dejar de cobrar, no se sigue):
//   1. Deja de COBRAR: cancela la renovación en la pasarela (Mercado Pago o Stripe, `cancelarSuscripcionCobro`) y anula los
//      links que todavía se podían pagar (el primer mes, una renovación sin autorizar).
//   2. La cartera pasa a REVOCADA: desde ahí la agencia no entra más («Inspeccionar» pregunta `puedeEntrar`, que sólo deja
//      las aprobadas) y la cuenta sale de su lista de activas.
//   3. LO QUE PASA CON LOS DATOS (lo decidió el Cerebro el 29/10, hasta que Martín diga otra cosa): NO SE BORRA NADA. La cuenta
//      queda del cliente, sin la agencia y PAUSADA (el corte `sin-agencia`); si quiere seguir, elige su plan y paga él
//      (/cuenta-pausada → «Elegir mi plan»).
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

export type ResultadoBajaCliente = { ok: true; resumen: string; yaEstaba?: true } | { ok: false; error: string };

type FilaCobro = { id: number; tipo: 'unico' | 'suscripcion'; estado: string; suscripcion_estado: string | null };

/** Los cobros de la plataforma que todavía le cobran (o se pueden pagar) el lugar de ESE cliente de ESA agencia. */
async function cobrosVivos(plataforma: number, agenciaWs: number, clienteWs: number): Promise<FilaCobro[]> {
  const { data, error } = await getSupabaseServer().from('cobros').select('id, tipo, estado, suscripcion_estado')
    .eq('workspace_id', plataforma).eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs)
    .in('estado', ['pendiente', 'fallido', 'pagado']).limit(50);
  if (error) throw new Error(`No pude leer los cobros del cliente: ${error.message}`);
  return ((data ?? []) as FilaCobro[]).filter((c) =>
    c.estado !== 'pagado' ? true : c.tipo === 'suscripcion' && c.suscripcion_estado !== 'cancelada');
}

/** Los emails de los admins de una cuenta. */
async function adminsDe(ws: number): Promise<string[]> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, rol_ws').eq('workspace_id', ws).limit(20);
  return [...new Set(((data ?? []) as Array<{ email: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => u.email!.toLowerCase()))];
}

export async function darDeBajaClienteDeAgencia(p: { agenciaWs: number; clienteWs: number; autor: string }): Promise<ResultadoBajaCliente> {
  const { agenciaWs, clienteWs } = p;
  if (!Number.isInteger(agenciaWs) || !Number.isInteger(clienteWs) || agenciaWs <= 0 || clienteWs <= 0 || agenciaWs === clienteWs) return { ok: false, error: 'Cuenta inválida.' };
  const db = getSupabaseServer();
  const { data: fila, error: eFila } = await db.from('agencia_clientes').select('estado').eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).maybeSingle();
  if (eFila) return { ok: false, error: `No pude leer tu cartera: ${eFila.message}` };
  if (!fila) return { ok: false, error: 'Esa cuenta no es de tu agencia.' };
  if ((fila as { estado: string }).estado === 'revocado') return { ok: true, resumen: 'Esa cuenta ya estaba dada de baja.', yaEstaba: true };

  // 1. Dejar de cobrar. Si una cancelación falla, se corta acá: la cartera sigue como estaba y la agencia reintenta.
  const plataforma = await wsSuperAdmin();
  let vivos: FilaCobro[];
  try { vivos = await cobrosVivos(plataforma, agenciaWs, clienteWs); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  for (const c of vivos) {
    const r = c.estado === 'pagado'
      ? await cancelarSuscripcionCobro(plataforma, c.id, p.autor)
      : await anularCobro(plataforma, c.id, p.autor).then((x) => ({ ok: x.ok, resumen: x.error ?? '' }));
    if (!r.ok) return { ok: false, error: `No pude cancelar su cobro: ${r.resumen || 'la pasarela no contestó'}. Prueba otra vez en un minuto.` };
  }

  // 2. La cartera, revocada (compare-and-set: dos bajas a la vez no hacen dos veces lo de abajo).
  const ahora = new Date().toISOString();
  const { data: rev, error: eRev } = await db.from('agencia_clientes')
    .update({ estado: 'revocado', decidido_por: p.autor.slice(0, 120), decidido_at: ahora, motivo: 'La agencia lo dio de baja.' })
    .eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).neq('estado', 'revocado').select('cliente_ws');
  if (eRev) return { ok: false, error: `Se canceló su cobro, pero no pude sacarlo de tu cartera: ${eRev.message}` };
  if (!rev?.length) return { ok: true, resumen: 'Esa cuenta ya estaba dada de baja.', yaEstaba: true };

  // 3. Sin la agencia y pausada, con los datos intactos. El corte guardado dice por qué (/cuenta-pausada) y lo reabre su pago.
  const corte: CorteGuardado = { cobroId: 0, hasta: ahora.slice(0, 10), motivo: 'sin-agencia', desde: ahora, vigente: true };
  const { error: eCorte } = await db.from('app_settings')
    .upsert({ workspace_id: clienteWs, key: CLAVE_CORTE, value: JSON.stringify(corte), updated_at: ahora }, { onConflict: 'workspace_id,key' });
  if (eCorte) console.error(`[agencia-baja] cliente ${clienteWs}: no pude guardar el corte: ${eCorte.message}`);
  else {
    const { error: ePausa } = await db.from('workspaces').update({ estado: 'pausado', updated_at: ahora }).eq('id', clienteWs).eq('estado', 'activo');
    if (ePausa) console.error(`[agencia-baja] cliente ${clienteWs}: no pude pausarlo: ${ePausa.message}`);
  }

  // 4. El aviso al cliente. Best effort: la baja ya está hecha.
  const { data: ag } = await db.from('workspaces').select('nombre').eq('id', agenciaWs).maybeSingle();
  const agencia = String((ag as { nombre?: string } | null)?.nombre ?? 'Tu agencia');
  for (const to of await adminsDe(clienteWs).catch(() => [] as string[])) {
    await avisarDePlataforma({
      to, asunto: 'Tu agencia dejó de administrar tu cuenta de MaKo', preheader: 'Tus datos están guardados.', tag: 'agencia-baja',
      cuerpo: [
        'Hola,', '',
        `${agencia} dejó de administrar tu cuenta de MaKo, y ya no la paga.`, '',
        'Tus datos están guardados y no se borra nada. Si quieres seguir usando MaKo, elige tu plan y vuelves a entrar en el acto:',
        linkApp('/cuenta-pausada', clienteWs),
      ].join('\n'),
    }).catch((e) => console.warn(`[agencia-baja] cliente ${clienteWs}: no pude avisarle: ${e instanceof Error ? e.message : String(e)}`));
  }
  const cobrosTxt = vivos.length ? ' Su cobro quedó cancelado.' : '';
  return { ok: true, resumen: `Listo: diste de baja la cuenta.${cobrosTxt} Ya no entras a ella y a tu cliente le avisamos; sus datos quedan guardados.` };
}
