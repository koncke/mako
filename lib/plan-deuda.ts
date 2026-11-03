// =============================================================================
// plan-deuda — la deuda del plan de MaKo: confirmarla con la pasarela, pagarla y avisar la pausa (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien no paga que se le expulse de la app... le tiene que quedar una deuda
// pendiente... apenas tenés plata en tu cuenta ya te lo cobran de manera automática». Las reglas (cuándo hay mora,
// cuándo se pausa, cuánto se debe) viven en lib/plan-acceso-reglas.ts; acá lo que habla con la pasarela:
//
//   · `confirmarImpago`: antes de pausar, ¿la pasarela de verdad no cobró? Un aviso de renovación perdido dejaba afuera
//     a quien pagó. Si cobró, la renovación que faltaba se asienta (`aplicarPagoAprobado`, idempotente) y no se corta.
//   · `pagarDeuda`: el link para pagar lo que se debe y volver a entrar:
//       – Stripe con la suscripción viva: la FACTURA ABIERTA más vieja (su página de Stripe acepta otra tarjeta). Al
//         pagarla llega su `invoice.paid`, entra como renovación y el negocio se reabre en el acto.
//       – Mercado Pago dentro de los 10 días en que MP reintenta la cuota: cambiar la tarjeta en Mercado Pago (pagar
//         aparte acá sería cobrar dos veces si el reintento entra).
//       – Si no (MP pasó los reintentos, o la suscripción ya no cobra): un cobro ÚNICO por los meses debidos (`meses`,
//         mig 0330), atado al negocio (`alta_ws`). Y si la suscripción ya no cobra, después se reactiva el plan.
//   · `avisarSuspension`: el mail a los admins del negocio cuando se pausa.
//   · `agenciaDelCobro`: la cuenta del cliente de una agencia (31/10/2026, ticket #37). A la agencia le llegan el rechazo y la pausa;
//     si la paga ELLA, al cliente no le llega ninguno y /cuenta-pausada no le ofrece pagar: no es suya. Si la paga él, los dos.
//     El cartel de la mora no hace falta tocarlo: un cobro de agencia nunca da `mora` (`vigenciaDeClienteDeAgencia`).
//
// ⚠️ TODO EN EL WORKSPACE DE LA PLATAFORMA (los cobros son de MaKo) y con `credDelCliente` (nunca el env: lib/cobros.ts).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { credDelCliente } from './credenciales';
import { linkApp } from './app-url';
import { anularCobro, aplicarPagoAprobado, credCreemDelCobro, crearCobro, getCobro, linkDelCobro } from './cobros';
import { buscarTransaccionesCreem, leerSuscripcionCreem, portalDeClienteCreem } from './creem-api';
import { buscarPagosMp, leerCuentaMp } from './mercadopago-api';
import { facturasStripe, suscripcionStripe } from './pasarela-plan-api';
import { formatoMonto } from './pasarela-moneda';
import { avisarDePlataforma } from './invitaciones';
import { KEY_QUIEN_PAGA, quienPagaDe, type QuienPaga } from './agency-reglas';
import { NOMBRE_PASARELA, type Pasarela } from './cobros-tipos';
import { vigenciaDe, corteDe, type FilaCobroLugar } from './plan-acceso';
import { diaDeSuspension, mesesDespuesDe, type CorteGuardado, type Deuda } from './plan-acceso-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
/** Lo que Mercado Pago tarda en dar por perdida una cuota rechazada (4 reintentos en 10 días), con un día de margen. */
const DIAS_REINTENTO_MP = 14;

/** Cuántos de los `ciclos` debidos desde `desde` ya pasaron su ventana de reintentos en MP (cada ciclo, la suya). */
export function ciclosPerdidosMp(desde: string, ciclos: number, ahoraMs: number): number {
  let n = 0;
  for (let k = 0; k < ciclos; k++) if (Date.parse(`${mesesDespuesDe(desde, k)}T00:00:00Z`) + DIAS_REINTENTO_MP * 86_400_000 <= ahoraMs) n++;
  return n;
}

/** Los ids de pago de la pasarela que YA tienen su cuota en el CRM de la plataforma (para no re-avisar uno viejo). */
async function yaAsentados(plataforma: number, proveedor: string, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await getSupabaseServer().from('pagos').select('proveedor_pago_id')
    .eq('workspace_id', plataforma).eq('proveedor', proveedor).in('proveedor_pago_id', [...ids]);
  if (error) throw new Error(`No pude leer las cuotas asentadas: ${error.message}`);
  return new Set(((data ?? []) as Array<{ proveedor_pago_id: string | null }>).map((r) => String(r.proveedor_pago_id)));
}

/**
 * ¿La pasarela de verdad NO cobró esta suscripción? 'impago' (se puede pausar), 'pagado' (cobró: lo que faltaba se
 * asentó con `reparar`, y no se corta) o 'no-se-sabe' (no contestó: no se corta en esta vuelta).
 * ⚠️ Sólo se asientan los pagos que NO estaban: repasar uno viejo re-avisaría «Entró un pago» pasados los 3 días del dedup.
 */
export async function confirmarImpago(c: FilaCobroLugar, opts: { reparar: boolean }): Promise<'impago' | 'pagado' | 'no-se-sabe'> {
  const plataforma = await wsSuperAdmin();
  const cobro = await getCobro(plataforma, c.id);
  if (!cobro) return 'no-se-sabe';
  if (c.proveedor === 'stripe') {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const subId = c.proveedor_suscripcion_id;
    if (!key || !subId) return 'no-se-sabe';
    const [s, f] = await Promise.all([suscripcionStripe(key, subId), facturasStripe(key, subId, 'paid')]);
    if (!s.ok || !f.ok) return 'no-se-sabe';
    const deSuscripcion = f.facturas.filter((x) => x.motivo === 'subscription_cycle' || x.motivo === 'subscription_create');
    const ya = await yaAsentados(plataforma, 'stripe', deSuscripcion.map((x) => x.id));
    const faltan = deSuscripcion.filter((x) => !ya.has(x.id));
    // ⚠️ Una factura de $0 (saldo o cupón) no es plata que entró: no se asienta (asentaría el monto del cobro como cash),
    // pero dice que el mes está cubierto (revisión del 23/10, media 9).
    if (faltan.length && opts.reparar) {
      for (const x of faltan.filter((f) => (f.monto ?? 0) > 0).reverse()) {
        await aplicarPagoAprobado(cobro, { proveedorPagoId: x.id, monto: x.monto, moneda: x.moneda, suscripcionId: subId, pagadoAt: x.pagadaAt, autor: 'Stripe (reparado)' });
      }
    }
    if (faltan.length) return 'pagado';
    // Activa y con el período en curso: cobró (o está en prueba). Lo demás (past_due, unpaid, canceled…) es impago.
    return s.estado === 'active' || s.estado === 'trialing' ? 'pagado' : 'impago';
  }
  // ⚠️ POR EL `else` SE LE PREGUNTABA A MERCADO PAGO (31/10/2026): que nunca oyó hablar de este cobro y contestaba «sin pagos». Un
  // aviso de renovación perdido dejaba afuera a un cliente de Creem que SÍ había pagado, que es justo lo que esto existe para evitar.
  if (c.proveedor === 'creem') {
    const subId = c.proveedor_suscripcion_id;
    const creem = subId ? await credCreemDelCobro(cobro) : null;
    if (!creem || !subId) return 'no-se-sabe';
    const s = await leerSuscripcionCreem(creem.key, subId);
    if (!s.ok) return 'no-se-sabe';
    const tx = await buscarTransaccionesCreem(creem.key, subId, s.clienteId);
    if (!tx.ok) return 'no-se-sabe';
    const pagadas = tx.transacciones.filter((x) => x.estado === 'paid');
    const ya = await yaAsentados(plataforma, 'creem', pagadas.map((x) => x.id));
    const faltan = pagadas.filter((x) => !ya.has(x.id));
    if (faltan.length && opts.reparar) {
      // La más vieja primero, y una en cero no es plata que entró: como Stripe.
      for (const x of faltan.filter((f) => (f.monto ?? 0) > 0).sort((a, b) => Date.parse(a.fecha ?? '') - Date.parse(b.fecha ?? ''))) {
        await aplicarPagoAprobado(cobro, { proveedorPagoId: x.id, monto: x.monto ?? undefined, moneda: x.moneda ?? undefined, suscripcionId: subId, pagadoAt: x.fecha ?? undefined, autor: 'Creem (reparado)' });
      }
    }
    if (faltan.length) return 'pagado';
    return s.estado === 'active' || s.estado === 'trialing' ? 'pagado' : 'impago';
  }
  if (c.proveedor !== 'mercadopago') return 'no-se-sabe';
  const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
  const userId = await credDelCliente('MERCADOPAGO_USER_ID', plataforma);
  if (!token || !userId) return 'no-se-sabe';
  const b = await buscarPagosMp(token, c.token);
  if (!b.ok) return 'no-se-sabe';
  const aprobados = b.pagos.filter((x) => x.estado === 'approved' && x.cobradorId === userId && x.referencia === c.token);
  const ya = await yaAsentados(plataforma, 'mercadopago', aprobados.map((x) => x.id));
  const faltan = aprobados.filter((x) => !ya.has(x.id));
  if (faltan.length && opts.reparar) {
    for (const x of faltan.reverse()) {
      await aplicarPagoAprobado(cobro, { proveedorPagoId: x.id, monto: x.monto, moneda: x.moneda, suscripcionId: x.preapprovalId, pagadoAt: x.fecha, autor: 'Mercado Pago (reparado)' });
    }
  }
  return faltan.length ? 'pagado' : 'impago';
}

/** El dominio de Mercado Pago del país de la cuenta (para «cambia tu tarjeta en Mercado Pago»). */
const DOMINIO_MP: Record<string, string> = {
  MLA: 'mercadopago.com.ar', MLM: 'mercadopago.com.mx', MLB: 'mercadopago.com.br', MCO: 'mercadopago.com.co',
  MLC: 'mercadopago.cl', MPE: 'mercadopago.com.pe', MLU: 'mercadopago.com.uy',
};

export type ComoPagar =
  | { tipo: 'link'; url: string; monto: number | null; moneda: string | null }
  | { tipo: 'tarjeta-mp'; url: string; texto: string }
  | { tipo: 'reactivar' }
  | { tipo: 'nada'; texto: string };

/** Lo que se debe HOY (la mora viva, o la que quedó guardada al pausar si la suscripción ya no cobra). */
export async function deudaDe(ws: number): Promise<{ deuda: Deuda | null; cobrando: FilaCobroLugar | null; hasta: string | null }> {
  const v = await vigenciaDe(ws);
  if (!v) return { deuda: null, cobrando: null, hasta: null };
  const vig = v.vigencia;
  const viva = vig.estado === 'mora' || (vig.estado === 'vencido' && vig.deuda) ? (vig as { deuda: Deuda }).deuda : null;
  const cobrando = viva ? v.cobros.find((c) => c.id === viva.cobroId) ?? null : null;
  if (viva) return { deuda: viva, cobrando, hasta: (vig as { hasta: string }).hasta };
  // La que quedó guardada al pausar, o al darse de baja en plena mora (`guardarDeudaAntesDeLaBaja`: la baja pisa el aviso de la
  // renovación fallida, revisión del 23/10, media 11), vale mientras lo cobrado no la cubra.
  const corte = await corteDe(ws);
  const { data: alBajar } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_DEUDA_BAJA).maybeSingle();
  const deBaja = leerDeuda((alBajar as { value?: string } | null)?.value ?? null);
  const g = corte?.vigente && corte.deuda ? corte.deuda : deBaja;
  const guardada = g && !(v.cubierto && v.cubierto >= mesesDespuesDe(g.desde, g.ciclos)) ? g : null;
  return { deuda: guardada, cobrando: guardada ? v.cobros.find((c) => c.id === guardada.cobroId) ?? null : null, hasta: corte?.hasta ?? null };
}

/**
 * Cómo pagar la deuda de este negocio (ver el orden arriba). `crear`: si hace falta un cobro único, crearlo (lo pide
 * el botón; la pantalla sólo pregunta). El cobro único se REUSA si ya hay uno vivo de las últimas 23 h por los mismos
 * meses: dos clics no abren dos.
 */
export async function pagarDeuda(ws: number, opts: { crear: boolean; ahoraMs?: number }): Promise<ComoPagar> {
  const ahora = opts.ahoraMs ?? Date.now();
  const plataforma = await wsSuperAdmin();
  const { deuda, cobrando, hasta } = await deudaDe(ws);
  if (!deuda || !cobrando) {
    // Sin deuda: si el plan terminó (baja, o la pasarela dejó de cobrar) lo que sigue es reactivarlo.
    const v = await vigenciaDe(ws);
    return v && (v.vigencia.estado === 'vencido' || v.vigencia.estado === 'cubierto') ? { tipo: 'reactivar' } : { tipo: 'nada', texto: 'No hay nada para pagar.' };
  }
  // 1. Stripe con la suscripción viva: la factura abierta más vieja.
  if (cobrando.proveedor === 'stripe' && cobrando.proveedor_suscripcion_id) {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    // ⚠️ Si Stripe no contesta, NO se abre un cobro aparte: Smart Retries puede cobrar la factura después, y serían dos.
    if (!key) return { tipo: 'nada', texto: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    const f = await facturasStripe(key, cobrando.proveedor_suscripcion_id, 'open');
    if (!f.ok) return { tipo: 'nada', texto: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    const abierta = f.facturas.filter((x) => x.urlPagar).at(-1);
    if (abierta?.urlPagar) return { tipo: 'link', url: abierta.urlPagar, monto: abierta.monto, moneda: abierta.moneda };
    // ⚠️ Con la suscripción VIVA y sin factura abierta, NO se abre un cobro aparte (revisión del 23/10, alta 2): la próxima
    // factura la cobra Stripe sola y serían dos. Si la pasarela ya la dio de baja, sí (abajo).
    if (cobrando.suscripcion_estado === 'activa') return { tipo: 'nada', texto: 'Tu pago está en proceso: lo reintentamos solos. Si cambiaste la tarjeta, entra en unos minutos.' };
  }
  // Creem, igual: reintenta solo hasta cancelarla (`past_due`/`unpaid`), y un cobro aparte mientras tanto serían dos. Lo que puede
  // hacer quien debe es cambiar la tarjeta en su portal. Si Creem ya la canceló (el aviso se pudo perder), sigue por el cobro aparte.
  if (cobrando.proveedor === 'creem' && cobrando.suscripcion_estado === 'activa') {
    const enProceso: ComoPagar = { tipo: 'nada', texto: 'Tu pago está en proceso: lo reintentamos solos. Si cambiaste la tarjeta, entra en unos minutos.' };
    const fila = await getCobro(plataforma, cobrando.id);
    const creem = fila ? await credCreemDelCobro(fila) : null;
    const s = creem && cobrando.proveedor_suscripcion_id ? await leerSuscripcionCreem(creem.key, cobrando.proveedor_suscripcion_id) : null;
    if (!creem || !s?.ok) return enProceso;
    if (s.estado !== 'canceled') {
      const portal = s.clienteId ? await portalDeClienteCreem(creem.key, s.clienteId) : null;
      return portal?.ok ? { tipo: 'tarjeta-mp', url: portal.url, texto: 'Creem reintenta el cobro solo. Para que entre, cambia la tarjeta de tu suscripción a MaKo en Creem.' } : enProceso;
    }
  }
  // 2. Mercado Pago todavía reintentando la cuota: cambiar la tarjeta allá.
  const sigueCobrando = cobrando.tipo === 'suscripcion' && cobrando.suscripcion_estado === 'activa';
  // ⚠️ CADA CICLO TIENE SU VENTANA (revisión del 23/10, media 8): la del último ciclo, no la del primero impago. El cobro aparte
  // paga SÓLO los ciclos que MP ya dio por perdidos; uno que MP todavía reintenta se cobraría dos veces.
  const perdidos = cobrando.proveedor === 'mercadopago' && sigueCobrando && hasta ? ciclosPerdidosMp(hasta, deuda.ciclos, ahora) : deuda.ciclos;
  if (cobrando.proveedor === 'mercadopago' && sigueCobrando && perdidos === 0) {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    const cuenta = token ? await leerCuentaMp(token) : null;
    const dominio = (cuenta?.ok && cuenta.sitio && DOMINIO_MP[cuenta.sitio]) || 'mercadopago.com';
    return { tipo: 'tarjeta-mp', url: `https://www.${dominio}/subscriptions`, texto: 'Mercado Pago reintenta el cobro solo. Para que entre, cambia la tarjeta de tu suscripción a MaKo en Mercado Pago.' };
  }
  // 3. Un cobro único por los meses debidos.
  if (deuda.monto == null || !deuda.moneda || !cobrando.lead_id || perdidos < 1) return { tipo: 'nada', texto: 'No pudimos calcular tu deuda: escríbenos y lo resolvemos.' };
  const porCiclo = deuda.monto / deuda.ciclos;
  const usdPorCiclo = deuda.montoUsd != null ? deuda.montoUsd / deuda.ciclos : null;
  const aPagar = { ciclos: perdidos, monto: Math.round(porCiclo * perdidos * 100) / 100, montoUsd: usdPorCiclo != null ? Math.round(usdPorCiclo * perdidos * 100) / 100 : null };
  const desde = new Date(ahora - 23 * 3600_000).toISOString();
  const { data: vivo } = await getSupabaseServer().from('cobros').select('token, monto, moneda')
    .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'unico').eq('meses', aPagar.ciclos)
    .in('estado', ['pendiente', 'fallido']).gte('created_at', desde).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (vivo) { const v = vivo as { token: string; monto: number; moneda: string }; return { tipo: 'link', url: linkDelCobro(v.token), monto: Number(v.monto), moneda: v.moneda }; }
  if (!opts.crear) return { tipo: 'link', url: '', monto: aPagar.monto, moneda: deuda.moneda };
  const r = await crearCobro(plataforma, {
    leadId: cobrando.lead_id, pasarela: cobrando.proveedor, tipo: 'unico',
    concepto: `MaKo · ${aPagar.ciclos === 1 ? 'el mes adeudado' : `${aPagar.ciclos} meses adeudados`}`,
    monto: aPagar.monto, moneda: deuda.moneda, montoUsd: aPagar.montoUsd, creadoPor: `deuda:${ws}`,
  });
  if (!r.ok) { console.error(`[plan-deuda] ws=${ws} no pude crear el cobro de la deuda: ${r.error}`); return { tipo: 'nada', texto: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' }; }
  // ⚠️ ANTES DE DEVOLVER EL LINK (nadie pudo pagarlo todavía): atado al negocio y con sus meses. Sin esto el pago
  // entraría como plata suelta del lead y no le devolvería el acceso a nadie.
  const { error } = await getSupabaseServer().from('cobros').update({ alta_ws: ws, meses: aPagar.ciclos }).eq('id', r.cobro.id).eq('workspace_id', plataforma);
  if (error) {
    console.error(`[plan-deuda] ws=${ws} no pude atar el cobro ${r.cobro.id} de la deuda: ${error.message}`);
    // Sin atarlo, ese link no le devuelve el acceso a nadie: se anula (con su checkout) en vez de dejarlo vivo (baja 15).
    await anularCobro(plataforma, r.cobro.id, 'MaKo (no se pudo atar la deuda)').catch(() => {});
    return { tipo: 'nada', texto: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
  }
  return { tipo: 'link', url: r.link, monto: aPagar.monto, moneda: deuda.moneda };
}

/** Los emails de los admins de un negocio (a quién avisarle de su plan). */
async function adminsDe(ws: number): Promise<string[]> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, rol_ws').eq('workspace_id', ws).limit(20);
  return [...new Set(((data ?? []) as Array<{ email: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => u.email!.toLowerCase()))];
}

/**
 * El cobro del plan de un cliente de una agencia APROBADA: cuál, de quién y quién lo paga (`agency.quien_paga`). null si no lo es:
 * un cobro propio, o una agencia que ya lo soltó. ⚠️ TIRA si no se pudo leer: «no sé» no es «no es de agencia», y lo otro le manda
 * al cliente una deuda ajena.
 */
export async function agenciaDelCobro(cobroId: number): Promise<{ agenciaWs: number; clienteWs: number; paga: QuienPaga; proveedor: Pasarela } | null> {
  if (!(cobroId > 0)) return null; // El `cobroId` 0 / -1 de un corte que no viene de un cobro (lib/plan-acceso.ts).
  const db = getSupabaseServer();
  const { data: c, error: e1 } = await db.from('cobros').select('agencia_ws, cliente_ws, proveedor').eq('id', cobroId).maybeSingle();
  if (e1) throw new Error(e1.message);
  const fila = c as { agencia_ws?: number | null; cliente_ws?: number | null; proveedor: Pasarela } | null;
  if (fila?.agencia_ws == null || fila.cliente_ws == null) return null;
  const [agenciaWs, clienteWs] = [Number(fila.agencia_ws), Number(fila.cliente_ws)];
  const [cart, quien] = await Promise.all([
    db.from('agencia_clientes').select('estado').eq('agencia_ws', agenciaWs).eq('cliente_ws', clienteWs).maybeSingle(),
    db.from('app_settings').select('value').eq('workspace_id', clienteWs).eq('key', KEY_QUIEN_PAGA).maybeSingle(),
  ]);
  if (cart.error) throw new Error(cart.error.message);
  if (quien.error) throw new Error(quien.error.message);
  if ((cart.data as { estado?: string } | null)?.estado !== 'aprobado') return null;
  return { agenciaWs, clienteWs, paga: quienPagaDe((quien.data as { value?: unknown } | null)?.value), proveedor: fila.proveedor };
}

/**
 * Le avisa a los admins de la agencia lo que le pasó a la cuenta de su cliente, con su nombre. ⚠️ MaKo Partners es donde ve sus cuentas,
 * NO donde se resuelve: de una renovación rechazada no ofrece ningún botón (`cobrosParaLaAgencia`). Por eso la frase dice qué hacer.
 */
async function avisarALaAgencia(a: { agenciaWs: number; clienteWs: number }, m: { asunto: (cliente: string) => string; preheader: string; frase: (cliente: string) => string; tag: string }): Promise<void> {
  const { data } = await getSupabaseServer().from('workspaces').select('nombre').eq('id', a.clienteWs).maybeSingle();
  const cliente = String((data as { nombre?: string | null } | null)?.nombre ?? '').trim() || `la cuenta ${a.clienteWs}`;
  const cuerpo = ['Hola,', '', m.frase(cliente), '', 'Tus cuentas están en MaKo Partners:', linkApp('/partners', a.agenciaWs)].join('\n');
  const admins = await adminsDe(a.agenciaWs);
  // Quien llama ya no lo vuelve a intentar: lo que no salió tiene que quedar dicho.
  if (!admins.length) console.error(`[plan-deuda] agencia ${a.agenciaWs}: sin admins para avisarle de la cuenta ${a.clienteWs} (${m.tag})`);
  for (const to of admins) {
    const r = await avisarDePlataforma({ to, asunto: m.asunto(cliente), preheader: m.preheader, cuerpo, tag: m.tag })
      .catch((e) => ({ enviado: false, error: msg(e) }));
    if (!r.enviado) console.error(`[plan-deuda] agencia ${a.agenciaWs}: no salió el aviso de la cuenta ${a.clienteWs}: ${r.error ?? 'sin detalle'}`);
  }
}

/**
 * La renovación de un cliente de agencia se rechazó: que la agencia lo sepa antes de la pausa, y no por el cliente. Lo llama
 * `aplicarPagoFallido`, una vez por rechazo de cada período. Nunca tira: el aviso del pago sigue su camino.
 */
export async function avisarRechazoALaAgencia(cobroId: number): Promise<void> {
  try {
    const a = await agenciaDelCobro(cobroId);
    if (!a) return;
    await avisarALaAgencia(a, {
      tag: 'agencia-rechazo', preheader: 'Si no entra, su cuenta se va a pausar.',
      asunto: (cliente) => `No entró el pago de ${cliente}`,
      frase: (cliente) => `No pudimos cobrar la renovación de MaKo de ${cliente}. ${NOMBRE_PASARELA[a.proveedor]} lo reintenta solo: ${a.paga === 'cliente' ? 'la paga tu cliente, avísale que cambie ahí la tarjeta de esa suscripción' : 'para que entre, cambia ahí la tarjeta de esa suscripción'}. Si no entra, se va a pausar su cuenta.`,
    });
  } catch (e) {
    console.error(`[plan-deuda] el cobro ${cobroId}: no pude avisarle a la agencia: ${msg(e)}`);
  }
}

/** El mail de la pausa a los admins del negocio. Una vez por corte (lo llama quien cortó, que ganó el compare-and-set). */
export async function avisarSuspension(ws: number, c: CorteGuardado): Promise<void> {
  if (c.motivo === 'renovacion-sin-autorizar') return; // eso lo resuelve la agencia, que ya lo ve en MaKo Partners
  let deAgencia: Awaited<ReturnType<typeof agenciaDelCobro>>;
  try { deAgencia = await agenciaDelCobro(c.cobroId); } catch (e) {
    // Este aviso sale UNA vez por corte, así que no se puede dejar para la próxima: va uno que no habla de plata, porque esa deuda
    // puede ser de su agencia, y /cuenta-pausada le dice el resto.
    console.error(`[plan-deuda] ws=${ws} pausado: no sé si lo paga una agencia: ${msg(e)}`);
    for (const to of await adminsDe(ws)) {
      await avisarDePlataforma({ to, asunto: 'Tu cuenta de MaKo está pausada', preheader: 'Tus datos están guardados.', tag: 'plan-pausado', cuerpo: ['Hola,', '', 'Tu cuenta de MaKo quedó pausada. Tus datos están guardados y no se borra nada. Aquí ves cómo volver a entrar:', linkApp('/cuenta-pausada', ws)].join('\n') })
        .catch((e2) => console.warn(`[plan-deuda] ws=${ws} no pude avisar la pausa a un admin: ${msg(e2)}`));
    }
    return;
  }
  if (deAgencia) {
    await avisarALaAgencia(deAgencia, {
      tag: 'agencia-pausa', preheader: 'Sus datos están guardados.',
      asunto: (cliente) => `La cuenta de ${cliente} quedó pausada`,
      frase: (cliente) => `La cuenta de ${cliente} quedó pausada porque se terminó lo pagado de su plan de MaKo. Sus datos están guardados y no se borra nada.`,
    });
    if (deAgencia.paga === 'agencia') return;
  }
  const a = await adminsDe(ws);
  if (!a.length) return;
  const debe = c.deuda?.monto != null && c.deuda.moneda ? ` Lo que quedó pendiente es ${formatoMonto(c.deuda.monto, c.deuda.moneda)}.` : '';
  const cuerpo = [
    'Hola,',
    '',
    c.motivo === 'impago'
      ? `No pudimos cobrar la renovación de tu plan de MaKo, así que tu cuenta quedó pausada.${debe}`
      : 'Tu plan de MaKo terminó, así que tu cuenta quedó pausada.',
    '',
    'Tus datos están guardados y no se borra nada. Apenas pagues, vuelves a entrar en el acto:',
    linkApp('/cuenta-pausada', ws),
  ].join('\n');
  for (const to of a) {
    await avisarDePlataforma({ to, asunto: 'Tu cuenta de MaKo está pausada', preheader: 'Paga y vuelves a entrar en el acto.', cuerpo, tag: 'plan-pausado' })
      .catch((e) => console.warn(`[plan-deuda] ws=${ws} no pude avisar la pausa a un admin: ${msg(e)}`));
  }
}

/** Para el aviso de la mora en la app: qué se debe y cuándo se pausa. null si está al día (o no se pudo leer). */
export async function avisoDeMora(ws: number): Promise<{ monto: number | null; moneda: string | null; pausaEl: string } | null> {
  const v = await vigenciaDe(ws);
  if (!v || v.vigencia.estado !== 'mora') return null;
  return { monto: v.vigencia.deuda.monto, moneda: v.vigencia.deuda.moneda, pausaEl: diaDeSuspension(v.vigencia.hasta) };
}

/** La deuda que había al darse de baja en plena mora (la baja pisa el `motivo` de la renovación fallida). */
export const CLAVE_DEUDA_BAJA = 'plan.deuda_al_bajar';

function leerDeuda(crudo: string | null): Deuda | null {
  try {
    const d = crudo ? (JSON.parse(crudo) as Deuda) : null;
    return d && typeof d.cobroId === 'number' && typeof d.ciclos === 'number' && typeof d.desde === 'string' ? d : null;
  } catch { return null; }
}

/** Antes de la baja: si hay mora, se guarda lo que se debe (revisión del 23/10, media 11: darse de baja borraba la deuda). */
export async function guardarDeudaAntesDeLaBaja(ws: number): Promise<void> {
  const v = await vigenciaDe(ws);
  const vig = v?.vigencia;
  const d = vig && (vig.estado === 'mora' || (vig.estado === 'vencido' && vig.deuda)) ? (vig as { deuda: Deuda }).deuda : null;
  if (!d) return;
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_DEUDA_BAJA, value: JSON.stringify(d), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) console.warn(`[plan-deuda] ws=${ws} no pude guardar la deuda antes de la baja: ${error.message}`);
}
