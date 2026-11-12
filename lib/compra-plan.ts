// =============================================================================
// compra-plan — el checkout público de los planes de MaKo (/planes): pagar y quedar adentro, sin nadie en el medio
// =============================================================================
// Pedido de Martín (22/10/2026): «si alguien paga se ingresa automáticamente a la app con el email de bienvenida».
// El alta automática ya existía (lib/cobros.ts, `altaSiCorresponde` → lib/alta-cliente.ts → `invitarPorEmail`), pero
// su ÚNICO disparador era un link armado a mano en /admin/cobros. Esto es la puerta pública: el comprador elige un
// plan, deja sus datos, y sale al checkout de la pasarela con un cobro de SUSCRIPCIÓN que al pagarse da el alta.
//
// QUÉ HACE, en orden:
//   1. El plan sale de lib/planes-mako.ts (con el setting `planes.mako` de la plataforma): la capa y el precio NUNCA
//      salen del pedido.
//   2. La pasarela: las conectadas en el workspace de la plataforma, y de esas las que tienen precio en su moneda (MP
//      cobra en la del sitio de su cuenta: sin precio en ARS, una cuenta argentina no se ofrece). Y según el PAÍS de quien
//      compra (27/10/2026): Mercado Pago sólo en el de su cuenta, Stripe en el resto (`pasarelasDelPais`).
//   3. El lead del comprador en el CRM de la plataforma: el de ese email (se reusa) o uno nuevo, con la campaña y su WhatsApp.
//   4. Si ya tiene un link VIVO de ese plan por esa pasarela (de las últimas 23 h), se devuelve ése: dos clics o
//      volver atrás no crean otro checkout.
//   5. `crearCobro` con `altaCapa` (sólo la plataforma puede: lib/cobros.ts lo valida en positivo).
//   6. Se anotan en el cobro el plan, el origen (de qué landing vino: lo lee el onboarding) y el código de MaKo
//      Partners. Best effort: sin la mig 0330 el cobro sigue y lo dice el log.
//
// ⚠️ PÚBLICO: lo llama POST /api/planes/comprar sin sesión. Todo lo del negocio corre en `runWithWorkspace` con el ws
// de la PLATAFORMA (sin el contexto, `getTenantDb` cae al ws1, Mauricio, un cliente).
// =============================================================================

import 'server-only';
import { registrarPedido } from './pedidos-ingreso';
import { pedidoLimpio } from './pedidos-ingreso-reglas';
import { getSupabaseServer } from './supabase';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { credDelCliente } from './credenciales';
import { createLead, enriquecerLead, getLead, logLeadEvent } from './leads';
import { esLeadDuplicado, porMotivo } from './leads-duplicados';
import { leadPorEmail } from './editor-landing/pago-pedido';
import { anularCobro, crearCobro, linkDelCobro, pasarelasConectadas } from './cobros';
import { leerCuentaMp } from './mercadopago-api';
import { modoDeClaveStripe } from './stripe-api';
import { modoDeClaveCreem } from './creem-api';
import { COLS_COBRO, cobroDeFila, type Cobro, type Pasarela } from './cobros-tipos';
import { CLAVE_PLANES, conceptoDelPlan, planesDeSetting, PLANES_MAKO_DEFAULT, precioEn, PROGRAMA_ACELERADOR, PRUEBA_GRATIS_PRENDIDA, type PlanMako } from './planes-mako';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import { diagnosticoEnTexto, leadDeLaCompra, pasarelaDeLaCompra, pasarelasDelPais, pasarelasParaOfrecer, TEXTO_SIN_PASARELA, type PedidoCompra } from './compra-plan-reglas';
import { creadoPorPrueba, finDeLaPrueba, PASARELAS_CON_PRUEBA, TEXTO_PRUEBA_USADA_CUENTA, TEXTO_PRUEBA_USADA_EMAIL } from './prueba-plan-reglas';
import { creadoPorPrimerMes, TEXTO_PROMO_CUENTA, TEXTO_PROMO_USADA, TEXTO_PROMO_VENCIDA } from './primer-mes-reglas';
import { PROMO_ENTRADA } from './promo-entrada-reglas';
import { listarUsuarios } from './usuarios';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Los planes que valen hoy (el setting de la plataforma, o los de siempre). Nunca tira: sin base, los de siempre. */
export async function planesMako(): Promise<PlanMako[]> {
  try {
    const ws = await wsSuperAdmin();
    const crudo = await runWithWorkspace(ws, () => getSetting(CLAVE_PLANES));
    return planesDeSetting(crudo);
  } catch (e) {
    console.warn('[compra-plan] no pude leer los planes del setting:', msg(e));
    return planesDeSetting(null);
  }
}

/**
 * La moneda en que cobraría HOY cada pasarela conectada de la plataforma (Stripe: USD; MP: la de su sitio), y si está en
 * modo PRUEBA (la clave sk_test_/rk_test_ de Stripe; la cuenta de prueba o el token TEST- de Mercado Pago).
 */
async function monedasDeLaPlataforma(ws: number): Promise<Array<{ pasarela: Pasarela; moneda: string; prueba: boolean }>> {
  const conectadas = await pasarelasConectadas(ws);
  const out: Array<{ pasarela: Pasarela; moneda: string; prueba: boolean }> = [];
  for (const p of conectadas) {
    // Sólo una pasarela que arma la PRUEBA GRATIS con tarjeta (25/10/2026, lib/prueba-plan-reglas.ts): la vitrina promete
    // 7 días gratis, y un plan que se cobrara desde el primer día sin avisarlo sería otro precio. Con otra, el plan se pide.
    if (!PASARELAS_CON_PRUEBA.includes(p)) continue;
    if (p === 'stripe') {
      out.push({ pasarela: 'stripe', moneda: 'USD', prueba: modoDeClaveStripe(await credDelCliente('STRIPE_SECRET_KEY', ws)) === 'prueba' });
      continue;
    }
    // ⚠️ RAMA PROPIA, NO EL `else` DE MERCADO PAGO (31/10/2026). Antes esto era `if (p === 'stripe') {…}` y después,
    // sin else, leía el token de Mercado Pago: con Creem conectado, o no se ofrecía nada (sin token de MP) o se
    // empujaba una opción con `pasarela: 'mercadopago'` escrito literal, o sea una opción DUPLICADA de Mercado Pago
    // con la moneda de su cuenta, mientras Creem quedaba invisible.
    if (p === 'creem') {
      const key = await credDelCliente('CREEM_API_KEY', ws);
      if (!key) continue;
      // Creem fija el precio del producto en USD o EUR (enum cerrado): MaKo cobra en USD, y el plan tiene que tener
      // precio en dólares o no se ofrece. No se inventa ninguna tasa (`precioEn` lo resuelve después).
      out.push({ pasarela: 'creem', moneda: 'USD', prueba: modoDeClaveCreem(key) === 'prueba' });
      continue;
    }
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', ws);
    if (!token) continue;
    const c = await leerCuentaMp(token);
    if (c.ok && c.moneda) out.push({ pasarela: 'mercadopago', moneda: c.moneda, prueba: c.modo === 'prueba' });
  }
  return out;
}

/**
 * Lo que la página /planes/<id> necesita para dibujar el formulario: el plan y con qué se puede pagar (y cuánto).
 *
 * ⚠️ UNA PASARELA EN MODO PRUEBA NO SE OFRECE AL PÚBLICO (revisión del 23/10/2026): el alta no mira el modo del cobro, así
 * que con las claves de prueba conectadas en el ws9 cualquiera sacaba una cuenta REAL pagando con la tarjeta 4242. Sólo
 * el super admin la ve (`conPrueba`), que es quien hace la prueba de humo antes de pasar a las claves reales.
 */
export async function ofertaDelPlan(planId: string, opts: { conPrueba?: boolean; pais?: string | null } = {}): Promise<{ plan: PlanMako; pasarelas: Array<{ pasarela: Pasarela; moneda: string; monto: number }> } | null> {
  const plan = (await planesMako()).find((p) => p.id === planId && p.activo);
  if (!plan) return null;
  try {
    const ws = await wsSuperAdmin();
    const monedas = await monedasDeLaPlataforma(ws);
    const conPrecio = (ms: typeof monedas) => ms.map((m) => ({ pasarela: m.pasarela, moneda: m.moneda, monto: precioEn(plan, m.moneda) })).filter((x): x is { pasarela: Pasarela; moneda: string; monto: number } => x.monto != null);
    const reales = conPrecio(monedas.filter((m) => !m.prueba));
    const deUnaPrueba = opts.conPrueba === true ? conPrecio(monedas.filter((m) => m.prueba)) : [];
    // Mercado Pago sólo en su país; afuera, Stripe (27/10/2026, `pasarelasDelPais`). Después del precio: en Argentina sin
    // precio en pesos, Mercado Pago no sirve y queda Stripe. Las de PRUEBA, sólo al super admin y sin el filtro del país
    // (11/11/2026, `pasarelasParaOfrecer`): si no, desde Argentina no se podía hacer la prueba de humo de Stripe.
    return { plan, pasarelas: pasarelasParaOfrecer(opts.pais ?? null, reales, deUnaPrueba) };
  } catch (e) {
    console.warn('[compra-plan] no pude leer las pasarelas de la plataforma:', msg(e));
    return { plan, pasarelas: [] };
  }
}

/**
 * Cada plan activo y si HOY se puede pagar en línea, con UNA lectura de las pasarelas (la misma cuenta que
 * `ofertaDelPlan`: una pasarela conectada con precio en su moneda). La usa /planes para no ofrecer «Empezar» donde el
 * checkout no puede cobrar (lib/compra-plan-reglas.ts, `botonDelPlan`). Una pasarela en modo prueba no cuenta. Sin poder leer las pasarelas, ninguno se cobra:
 * ofrecer la agenda de más es un llamado; ofrecer un pago que no existe es un callejón.
 */
export async function ofertasDeLosPlanes(pais: string | null = null): Promise<Array<{ plan: PlanMako; cobrable: boolean }>> {
  const planes = (await planesMako()).filter((p) => p.activo);
  let monedas: Array<{ pasarela: Pasarela; moneda: string }> = [];
  try {
    // Sin las de PRUEBA, como `ofertaDelPlan` para el público (revisión de Cobros, 23/10/2026): con sólo claves de prueba
    // conectadas, /planes ofrecería «Empezar» y el checkout, que no las ofrece, mandaría a la agenda: un callejón.
    monedas = (await monedasDeLaPlataforma(await wsSuperAdmin())).filter((m) => !m.prueba);
  } catch (e) {
    console.warn('[compra-plan] no pude leer las pasarelas de la plataforma:', msg(e));
  }
  // Por plan y por país, la misma cuenta que `ofertaDelPlan`: en México con sólo Mercado Pago no se ofrece «Empezar».
  return planes.map((plan) => ({
    plan,
    cobrable: pasarelasDelPais(pais, monedas.filter((m) => precioEn(plan, m.moneda) != null)).length > 0,
  }));
}

/** La moneda de la Mercado Pago de MaKo (la de su sitio: ARS, MXN…), o null si no está conectada o no se pudo leer. */
export async function monedaDeMercadoPagoDeMako(): Promise<string | null> {
  try {
    const ws = await wsSuperAdmin();
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', ws);
    if (!token) return null;
    const c = await leerCuentaMp(token);
    return c.ok ? c.moneda : null;
  } catch (e) {
    console.warn('[compra-plan] no pude leer la moneda de la Mercado Pago de MaKo:', msg(e));
    return null;
  }
}

/**
 * Guarda el precio de un plan en una moneda LOCAL (la de la Mercado Pago de MaKo). null o 0 = lo saca (el plan deja de
 * ofrecerse por Mercado Pago). Lo pone Martín en /admin/cobros: MaKo no inventa una tasa (lib/planes-mako.ts).
 *
 * ⚠️ NO HABÍA DÓNDE CARGARLO (revisión del 23/10/2026): los documentos le pedían «cargar preciosLocales en planes.mako» y
 * ninguna pantalla lo escribía, así que con sólo Mercado Pago conectada /planes no vendía. Y el setting reemplaza la lista
 * ENTERA: se escribe con todos los planes vigentes, leídos con `getSettingEstricto` (si la lectura falla, NO se escribe:
 * con `getSetting` un error se leía como «no hay setting» y se pisaban los planes cargados con los de fábrica).
 */
export async function guardarPrecioLocal(planId: string, moneda: string, monto: number | null): Promise<{ ok: true; plan: PlanMako } | { ok: false; error: string }> {
  const m = String(moneda ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(m) || m === 'USD') return { ok: false, error: 'La moneda va en tres letras, y no USD (el precio en dólares es el del plan).' };
  if (monto != null && !(Number.isFinite(monto) && monto > 0 && monto < 1_000_000_000)) return { ok: false, error: 'El precio tiene que ser mayor a cero.' };
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    const planes = planesDeSetting(await getSettingEstricto(CLAVE_PLANES));
    const plan = planes.find((p) => p.id === planId);
    if (!plan) return { ok: false as const, error: 'Ese plan no existe.' };
    const locales = { ...plan.preciosLocales };
    if (monto == null) delete locales[m]; else locales[m] = Math.round(monto * 100) / 100;
    const nuevos = planes.map((p) => (p.id === planId ? { ...p, preciosLocales: locales } : p));
    const json = JSON.stringify(nuevos);
    // Lo que se escribe tiene que volver a leerse igual: si no, no se escribe (nunca un setting que se descarta en silencio).
    const releido = planesDeSetting(json);
    const vuelto = releido.find((p) => p.id === planId);
    if (releido.length !== nuevos.length || !vuelto || (vuelto.preciosLocales[m] ?? null) !== (locales[m] ?? null)) {
      return { ok: false as const, error: 'No pude guardar el precio: los planes no pasaron la validación.' };
    }
    await setSetting(CLAVE_PLANES, json);
    return { ok: true as const, plan: vuelto };
  });
}

/**
 * El WhatsApp de quien compra en una ficha que YA existe. Se completa sólo si está vacía: la ruta es pública, y cualquiera puede escribir el
 * email de otro. Si la ficha tiene otro número, no se pisa y queda en su historial. Nunca frena la compra.
 */
async function whatsappEnFicha(leadId: number, whatsapp: string | null | undefined): Promise<void> {
  if (!whatsapp) return;
  const tel = `+${whatsapp}`;
  try {
    if ((await enriquecerLead(leadId, { telefono: tel }, 'Checkout de MaKo')).length) return;
    const actual = await getLead(leadId);
    // Todos los dígitos: corregir sólo el país deja iguales los últimos 10, y eso también es otro número.
    if (String(actual?.telefono_normalizado ?? actual?.telefono ?? '').replace(/\D/g, '') === whatsapp) return;
    await logLeadEvent(leadId, 'WhatsApp', `Dejó este WhatsApp al comprar: ${tel}. No se cambió el de la ficha.`, 'Checkout de MaKo');
  } catch (e) {
    console.warn(`[compra-plan] no pude anotar el WhatsApp en el lead ${leadId}:`, msg(e));
  }
}

/** El lead de ese email en el CRM de la plataforma (exacto), o uno nuevo. Corre adentro de runWithWorkspace. */
async function leadDelComprador(p: PedidoCompra): Promise<{ leadId: number; nuevo: boolean }> {
  const db = await getTenantDb();
  const buscar = async () => {
    const patron = p.email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await db.from('leads').select('id, email').ilike('email', patron).limit(20);
    if (error) throw new Error(`No pude buscar el lead por email: ${error.message}`);
    return leadPorEmail((data ?? []) as Array<{ id: number; email: string | null }>, p.email);
  };
  const ya = await buscar();
  if (ya) {
    await whatsappEnFicha(ya.id, p.whatsapp);
    return { leadId: ya.id, nuevo: false };
  }
  const o = p.origen ?? {};
  const datos = {
    nombre: p.nombre, email: p.email, telefono: p.whatsapp ? `+${p.whatsapp}` : null, origen_lead: 'landing',
    utm_source: o.utm_source, utm_medium: o.utm_medium, utm_campaign: o.utm_campaign, utm_content: o.utm_content, fbclid: o.fbclid,
  };
  try {
    const lead = await createLead(datos);
    return { leadId: Number(lead.id), nuevo: true };
  } catch (e) {
    if (!esLeadDuplicado(e)) throw e;
    const otro = await buscar();
    if (otro) {
      await whatsappEnFicha(otro.id, p.whatsapp);
      return { leadId: otro.id, nuevo: false };
    }
    // ⚠️ UN DUPLICADO NUNCA FRENA UNA COMPRA (30/10/2026): `createLead` también frena por NOMBRE, y acá eso era «No pudimos registrar tu
    // compra» a quien se llama igual que otro lead (la plataforma tiene 219 traídos de grupos). El mismo contacto, o uno cargado a
    // mano sin email, es el mismo lead (`leadDeLaCompra`) y se completa. Un homónimo con otro email es otra persona: se crea, y la
    // ficha lo marca en «Posibles duplicados».
    const mismo = leadDeLaCompra(e.coincidencias, p.email);
    if (mismo != null) {
      await enriquecerLead(mismo, { email: p.email, telefono: datos.telefono }, 'Checkout de MaKo').catch((x) => console.warn(`[compra-plan] no pude completar el lead ${mismo}: ${msg(x)}`));
      await whatsappEnFicha(mismo, p.whatsapp);
      return { leadId: mismo, nuevo: false };
    }
    const lead = await createLead({ ...datos, permitirDuplicado: true });
    const mismoNumero = porMotivo(e.coincidencias, 'telefono').map((c) => c.lead.id);
    if (mismoNumero.length) await logLeadEvent(Number(lead.id), 'WhatsApp', `Ese WhatsApp también está en la ficha ${mismoNumero.join(', ')}.`, 'Checkout de MaKo').catch(() => {});
    return { leadId: Number(lead.id), nuevo: true };
  }
}

/**
 * «LO QUIERO» SIN PASARELA (24/10/2026, Martín: «No voy a usar Calendly, te dije que pongas las columnas de pricing»). Quien
 * elige un plan que todavía no se cobra en línea (o el Acelerador, que nunca pasa por la pasarela: docs/ofertas-mako.md,
 * docs/estrategia-financiera-mako.md §1.7) deja su nombre, email y WhatsApp, y queda como lead en el CRM de MaKo con el
 * plan, de dónde vino y el código de MaKo Partners en su historial. El equipo recibe el aviso en el momento. Se le da de
 * alta a mano (el alta del super admin), y un referido se reconstruye con el renglón «referido por».
 */
export async function pedirPlanSinPasarela(p: PedidoCompra): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const elegido = p.plan === PROGRAMA_ACELERADOR.id ? null : (await planesMako()).find((x) => x.id === p.plan && x.activo) ?? null;
  const nombre = p.plan === PROGRAMA_ACELERADOR.id ? PROGRAMA_ACELERADOR.nombre : elegido?.nombre ?? null;
  if (!nombre) return { ok: false, status: 404, error: 'Ese plan no existe.' };
  // El anual (25/10/2026) sólo de un plan que lo tiene: el equipo lo da de alta con el precio del año.
  const anual = p.periodo === 'anual' ? elegido?.precioAnualUsd ?? null : null;
  if (p.periodo === 'anual' && !anual) return { ok: false, status: 404, error: 'Ese plan no tiene pago anual.' };
  const nombrePlan = anual ? `${nombre} anual (US$ ${anual.toLocaleString('es-AR')} por año)` : nombre;
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    let lead: { leadId: number; nuevo: boolean };
    try {
      lead = await leadDelComprador(p);
    } catch (e) {
      console.error('[compra-plan] no pude registrar el pedido de plan:', msg(e));
      return { ok: false, status: 503, error: 'No pudimos registrar tu pedido. Prueba otra vez en un minuto.' };
    }
    const de = p.origen?.landing ? ` desde la landing «${p.origen.landing}»` : '';
    const ref = p.ref ? ` (referido por ${p.ref})` : '';
    const wa = p.whatsapp ? ` WhatsApp: +${p.whatsapp}.` : '';
    // El diagnóstico de la puerta del Acelerador (lib/compra-plan-reglas.ts): con eso arranca la llamada.
    const diag = p.diagnostico ? ` Diagnóstico: ${diagnosticoEnTexto(p.diagnostico)}.` : '';
    await logLeadEvent(lead.leadId, 'Pedido de plan', `Quiere ${nombrePlan}${de}${ref}.${wa}${diag}`, 'Planes de MaKo').catch(() => {});
    // También en «Quieren entrar» (30/10/2026), para darle de alta sin ir a buscarlo al CRM. Con el rótulo de correo sin verificar.
    await registrarPedido(pedidoLimpio({ email: p.email, nombre: p.nombre, origen: 'planes', verificado: false, detalle: `Quiere ${nombrePlan}`, whatsapp: p.whatsapp, leadId: lead.leadId }));
    // El aviso al equipo, en el momento: el domingo nadie tiene que estar mirando el CRM para enterarse. Best effort.
    await avisarDePlataforma({
      to: EMAIL_MAKO, tag: 'planes-pedido', asunto: `${p.nombre} quiere ${nombrePlan}`, preheader: 'Pedido desde la página de planes.',
      cuerpo: [`${p.nombre} (${p.email}) quiere ${nombrePlan}${de}${ref}.`, '', `WhatsApp: +${p.whatsapp ?? '—'}`, '',
        ...(p.diagnostico ? ['Su diagnóstico:', ...p.diagnostico.map((x) => `· ${x.rotulo}: ${x.respuesta}`), ''] : []),
        'Su ficha en el CRM de MaKo:', linkApp(`/crm/${lead.leadId}`, ws)].join('\n'),
    }).catch((e) => console.warn('[compra-plan] no pude avisar del pedido:', msg(e)));
    return { ok: true };
  });
}

export type ResultadoCompra =
  | { ok: true; link: string }
  | { ok: false; status: number; error: string; elegir?: Array<{ pasarela: Pasarela; moneda: string; monto: number }>; sinPrueba?: true; sinPromo?: true };

/**
 * La compra PÚBLICA también puede terminar en un PEDIDO (5/11/2026): sin pasarela que cobre desde el país de quien compra, lo
 * que escribió queda como «Quiero» (`pedirPlanSinPasarela`), igual que el formulario de la página sin pasarela.
 */
export type ResultadoCompraPublica = ResultadoCompra | { ok: true; pedido: true };

/**
 * ¿Este email puede usar el 50% del primer mes? El reloj es por navegador, y otro navegador arranca el suyo (lib/promo-entrada-reglas.ts).
 * Lo que eso deja abierto lo cierra el email, para que no reaparezca infinitas veces (el Cerebro, 30/10; Martín lo dejó abierto y puede
 * cambiarlo): UN descuento por email. No, si ya tiene una cuenta (es para negocios nuevos), si ya lo pagó, o si lo abrió hace más de 24 h y
 * lo abandonó. Dentro de esas 24 h, puede rearmar el pago: se le cerró la pestaña, no lo perdió. Sin poder leer, deja pasar: un comprador
 * no pierde el descuento por una base caída.
 */
async function puedeUsarPromo(email: string, plataforma: number, ahoraMs: number): Promise<{ ok: true } | { ok: false; texto: string }> {
  try {
    if ((await listarUsuarios()).some((u) => u.email === email)) return { ok: false, texto: TEXTO_PROMO_CUENTA };
    const { data, error } = await getSupabaseServer().from('cobros').select('estado, created_at')
      .eq('workspace_id', plataforma).eq('email', email).like('creado_por', 'planes:%:primer-mes-%').limit(20);
    if (error) throw new Error(error.message);
    const yaUsado = ((data ?? []) as Array<{ estado: string; created_at: string }>)
      .some((c) => c.estado === 'pagado' || c.estado === 'reembolsado' || ahoraMs - Date.parse(c.created_at) > 24 * 3600_000);
    return yaUsado ? { ok: false, texto: TEXTO_PROMO_USADA } : { ok: true };
  } catch (e) {
    console.warn(`[compra-plan] no pude mirar si ${email.replace(/^(.).*@/, '$1…@')} ya usó su descuento; se lo dejo:`, msg(e));
    return { ok: true };
  }
}

/**
 * ¿Este email puede empezar una PRUEBA GRATIS? (25/10/2026, el Cerebro: «una prueba por negocio Y por tarjeta y por email»).
 * No, si ya tiene una cuenta de MaKo (es un negocio que ya existe: su plan va por «Tu plan»), o si alguna prueba con ese email
 * llegó a autorizarse (con la tarjeta cargada). La tarjeta se mira al autorizar (lib/cobros.ts, `activarPruebaSiAutorizo`).
 * Sin poder leer, deja pasar: el freno por tarjeta sigue en pie, y un comprador no se queda afuera por una base caída.
 */
async function puedeEmpezarPrueba(email: string, plataforma: number): Promise<{ ok: true } | { ok: false; motivo: 'cuenta' | 'email' }> {
  try {
    if ((await listarUsuarios()).some((u) => u.email === email)) return { ok: false, motivo: 'cuenta' };
    const { data, error } = await getSupabaseServer().from('cobros').select('id')
      .eq('workspace_id', plataforma).eq('email', email).like('creado_por', 'planes:%:prueba').not('suscripcion_estado', 'is', null).limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length ? { ok: false, motivo: 'email' } : { ok: true };
  } catch (e) {
    console.warn(`[compra-plan] no pude mirar si ${email.replace(/^(.).*@/, '$1…@')} ya usó su prueba; la dejo empezar:`, msg(e));
    return { ok: true };
  }
}

/**
 * El checkout de un plan. Ver el orden arriba. `conPrueba`: quien compra es el super admin (ver `ofertaDelPlan`). `pais`: de
 * dónde compra (el encabezado de Vercel): Mercado Pago sólo en su país (`pasarelasDelPais`).
 */
export async function iniciarCompraDePlan(p: PedidoCompra, opts: { conPrueba?: boolean; pais?: string | null; promoVigente?: boolean } = {}): Promise<ResultadoCompraPublica> {
  const oferta = await ofertaDelPlan(p.plan, opts);
  if (!oferta) return { ok: false, status: 404, error: 'Ese plan no existe.' };
  const { plan, pasarelas } = oferta;
  const eleccion = pasarelaDeLaCompra({ pedida: p.pasarela, sirven: pasarelas.map((x) => x.pasarela) });
  if (!eleccion.ok) {
    // Pidió una que desde su país no cobra (Mercado Pago desde México) y hay otra: se le ofrece la que sirve, no «no cobramos».
    if (eleccion.motivo === 'elegir' || (eleccion.motivo === 'no-sirve' && pasarelas.length)) return { ok: false, status: 409, error: '¿Con qué quieres pagar?', elegir: pasarelas };
    // SIN NINGUNA PASARELA PARA SU PAÍS (5/11/2026): la página ya habría mostrado el pedido de datos, así que esto es una
    // pestaña abierta de antes —con Creem para LatAm, que cerró ese día— o una pasarela que se desconectó en el medio. Lo que
    // escribió (nombre, email, WhatsApp) es lo mismo que pide el «Quiero»: queda como pedido, nunca como un error.
    const q = await pedirPlanSinPasarela(p);
    return q.ok ? { ok: true, pedido: true } : q;
  }
  const via = pasarelas.find((x) => x.pasarela === eleccion.pasarela)!;
  const ws = await wsSuperAdmin();
  // LA PRUEBA GRATIS (25/10/2026): toda compra en línea empieza con 7 días gratis, salvo que pida empezar sin ella (quien ya la
  // usó). Una segunda prueba se rechaza con un texto claro ANTES de abrir el pago.
  // Con el interruptor apagado (30/10/2026, lib/planes-mako.ts), ninguna compra nueva empieza con prueba: se paga y recién ahí se
  // entra (el alta sale de `aplicarPagoAprobado`). A quien ya está en prueba no lo mira nadie acá: no pasa por este camino.
  const conPrueba = PRUEBA_GRATIS_PRENDIDA && !p.sinPrueba;
  if (conPrueba) {
    const puede = await puedeEmpezarPrueba(p.email, ws);
    if (!puede.ok) {
      return puede.motivo === 'cuenta'
        ? { ok: false, status: 409, error: TEXTO_PRUEBA_USADA_CUENTA }
        : { ok: false, status: 409, error: TEXTO_PRUEBA_USADA_EMAIL, sinPrueba: true };
    }
  }
  // EL 50% DEL PRIMER MES (30/10/2026): sólo con el reloj vivo (`promoVigente`, lo lee la ruta de su cookie) y en los planes del cartel.
  // Si la página se lo mostró y ya no vale, SE DICE y la persona elige seguir: nunca se le cobra lleno a quien venía viendo la mitad.
  // Quien nunca lo vio (sin reloj, o llegó directo a /planes), el precio de lista, sin preguntar.
  let conDescuento = false;
  if (!PRUEBA_GRATIS_PRENDIDA && !p.sinPromo && PROMO_ENTRADA.planes.includes(plan.id)) {
    if (opts.promoVigente) {
      const puede = await puedeUsarPromo(p.email, ws, Date.now());
      if (!puede.ok) return { ok: false, status: 409, error: puede.texto, sinPromo: true };
      conDescuento = true;
    } else if (p.promo) {
      return { ok: false, status: 409, error: TEXTO_PROMO_VENCIDA, sinPromo: true };
    }
  }

  return runWithWorkspace(ws, async () => {
    let lead: { leadId: number; nuevo: boolean };
    try {
      lead = await leadDelComprador(p);
    } catch (e) {
      console.error('[compra-plan] no pude crear el lead del comprador:', msg(e));
      return { ok: false, status: 503, error: 'No pudimos registrar tu compra. Prueba otra vez en un minuto.' };
    }
    // ⚠️ NO se devuelve un link vivo de ese email (revisión del 23/10, alta 1): el token de /pagar es la credencial del cambio
    // de email del acceso, y se lo daba a cualquiera que tipeara el email de otro. Cada pedido abre su propio checkout (con los
    // topes por IP y por email de la ruta).

    const r = await crearCobro(ws, {
      leadId: lead.leadId, pasarela: via.pasarela, tipo: 'suscripcion', concepto: conceptoDelPlan(plan),
      monto: via.monto, moneda: via.moneda, montoUsd: plan.precioUsd, email: p.email, nombre: p.nombre,
      altaCapa: plan.capa, creadoPor: conPrueba ? creadoPorPrueba(plan.id) : conDescuento ? creadoPorPrimerMes(plan.id) : `planes:${plan.id}`,
      // El primer cobro, 7 días después: el `start_date` de Mercado Pago. La persona carga la tarjeta ahora.
      inicioAt: conPrueba ? finDeLaPrueba(Date.now()) : null,
    });
    if (!r.ok) {
      console.error(`[compra-plan] crearCobro (${plan.id}, ${via.pasarela}): ${r.error}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    // Lo que el cobro tiene que recordar: el plan, de dónde vino y quién lo refirió. Antes de devolver el link: nadie
    // puede haber pagado todavía. Best effort (sin la mig 0330 el cobro vale igual).
    const { error } = await getSupabaseServer().from('cobros')
      // El WhatsApp viaja con el origen: lo que la persona escribió en ESTA compra, que es lo que su onboarding le ofrece (`guardarWhatsappDelPago`).
      .update({ plan_mako: plan.id, origen: p.whatsapp ? { ...p.origen, whatsapp: p.whatsapp } : p.origen, ref_codigo: p.ref })
      .eq('id', r.cobro.id).eq('workspace_id', ws);
    if (error) console.warn(`[compra-plan] no pude anotar plan/origen/ref en el cobro ${r.cobro.id}: ${error.message}`);
    if (lead.nuevo || !r.yaEstaba) {
      const de = p.origen?.landing ? ` desde la landing «${p.origen.landing}»` : '';
      const ref = p.ref ? ` (referido por ${p.ref})` : '';
      await logLeadEvent(lead.leadId, 'Compra de plan', `${conPrueba ? 'Abrió su prueba gratis' : conDescuento ? 'Abrió el pago con el descuento del primer mes' : 'Abrió el pago'} de ${plan.nombre}${de}${ref}.`, 'Checkout de MaKo').catch(() => {});
    }
    return { ok: true, link: r.link };
  });
}

/**
 * VOLVER A MaKo (23/10/2026): quien tuvo un plan que terminó (se dio de baja, o la pasarela dejó de cobrar) lo
 * reactiva desde /cuenta-pausada o «Tu plan», con su misma pasarela y el precio de HOY de su plan. Es una suscripción
 * nueva atada a SU negocio (`alta_ws`, sin `alta_capa`: no crea otra cuenta). Con deuda, primero la deuda
 * (lib/plan-deuda.ts): quien llama lo decide con `pagarDeuda`.
 */
export async function reactivarPlan(ws: number, p: { email: string; nombre: string | null; pais?: string | null }): Promise<ResultadoCompra> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma) return { ok: false, status: 400, error: 'La cuenta de MaKo no tiene plan.' };
  const db = getSupabaseServer();
  const { data, error } = await db.from('cobros').select(COLS_COBRO).eq('workspace_id', plataforma).eq('alta_ws', ws)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return { ok: false, status: 503, error: 'No pudimos leer tu plan. Prueba otra vez en un minuto.' };
  const cobros = (data ?? []).map((x) => cobroDeFila(x as Record<string, unknown>));
  // La base es la ÚLTIMA SUSCRIPCIÓN (revisión del 23/10, alta 7): un cobro único de deuda tiene N meses de precio y otro concepto.
  const base = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pagado' || c.estado === 'reembolsado'));
  // Nunca tuvo un plan PROPIO (la pagaba su agencia, que la dio de baja: lib/agencia-baja.ts): se le abre, con su plan de hoy.
  if (!base) return primerPlanPropio(ws, p, cobros);
  if (!base.lead_id) return { ok: false, status: 404, error: 'Tu plan no se cobra en línea: escríbenos y lo reactivamos.' };
  // Una suscripción que la pasarela SIGUE cobrando no se duplica: sería cobrar dos veces el mismo mes.
  if (cobros.some((c) => c.tipo === 'suscripcion' && (c.estado === 'pagado' || c.estado === 'reembolsado') && c.suscripcion_estado !== 'cancelada')) {
    return { ok: false, status: 409, error: 'Tu suscripción sigue activa: no hace falta reactivarla.' };
  }
  const desde = new Date(Date.now() - 23 * 3600_000).toISOString();
  const vivo = cobros.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pendiente' || c.estado === 'fallido') && c.created_at >= desde && c.creado_por === `reactivar:${ws}`);
  if (vivo) return { ok: true, link: linkDelCobro(vivo.token) };
  // El plan que tenía (mig 0330; sin ella, el precio del último cobro).
  const { data: conPlan } = await db.from('cobros').select('plan_mako').eq('workspace_id', plataforma).eq('alta_ws', ws)
    .not('plan_mako', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const planId = (conPlan as { plan_mako?: string | null } | null)?.plan_mako ?? null;
  const plan = planId ? (await planesMako()).find((x) => x.id === planId) ?? null : null;
  const monto = (plan ? precioEn(plan, base.moneda) : null) ?? base.monto;
  const montoUsd = plan?.precioUsd ?? base.monto_usd;
  return runWithWorkspace(plataforma, async () => {
    const r = await crearCobro(plataforma, {
      leadId: base.lead_id!, pasarela: base.proveedor, tipo: 'suscripcion', concepto: plan ? conceptoDelPlan(plan) : base.concepto,
      monto, moneda: base.moneda, montoUsd, email: p.email, nombre: p.nombre ?? base.nombre, creadoPor: `reactivar:${ws}`,
    });
    if (!r.ok) {
      console.error(`[compra-plan] reactivar ws=${ws}: ${r.error}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    // ⚠️ ATADO A SU NEGOCIO ANTES DE DEVOLVER EL LINK: sin `alta_ws` el pago no le devolvería el acceso.
    const { error: e2 } = await getSupabaseServer().from('cobros').update({ alta_ws: ws, ...(planId ? { plan_mako: planId } : {}) })
      .eq('id', r.cobro.id).eq('workspace_id', plataforma);
    if (e2) {
      console.error(`[compra-plan] reactivar ws=${ws}: no pude atar el cobro ${r.cobro.id}: ${e2.message}`);
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    await logLeadEvent(base.lead_id!, 'Compra de plan', 'Abrió el pago para reactivar su plan.', 'Checkout de MaKo').catch(() => {});
    return { ok: true, link: r.link };
  });
}

/**
 * Los planes como los dibujan las columnas de precios de la landing de venta (24/10/2026, app/vsl/PreciosLanding.tsx), con
 * si se cobran en línea (la misma cuenta que /planes). Si no se pudo leer, los de hoy y sin cobro en línea: el botón dice
 * «Quiero …» y se pide (nunca «Empezar» sin un cobro detrás), y la landing no se queda sin precios.
 */
export async function planesParaLanding(): Promise<Array<Pick<PlanMako, 'id' | 'nombre' | 'capa' | 'precioUsd' | 'resumen' | 'incluye' | 'destacado' | 'precioAnualUsd' | 'preciosLocales'> & { cobrable: boolean }>> {
  const ofertas = await ofertasDeLosPlanes().catch(() => PLANES_MAKO_DEFAULT.filter((p) => p.activo).map((plan) => ({ plan, cobrable: false })));
  return ofertas.map(({ plan, cobrable }) => ({
    id: plan.id, nombre: plan.nombre, capa: plan.capa, precioUsd: plan.precioUsd, resumen: plan.resumen, incluye: plan.incluye, destacado: !!plan.destacado,
    precioAnualUsd: plan.precioAnualUsd ?? null, preciosLocales: plan.preciosLocales, cobrable,
  }));
}

/**
 * EL PRIMER PLAN PROPIO de una cuenta que pagaba su agencia y la dio de baja (29/10/2026, lib/agencia-baja.ts: «la cuenta
 * queda del cliente, sin la agencia y pausada; si quiere seguir, paga él»). El plan es el de su capa (Pro si tenía Pro, si
 * no Esencial), con la pasarela con que la cobraba su agencia si sigue conectada y tiene precio en esa moneda (si no, la que
 * sirva). El cobro es de SU ficha en el CRM de MaKo (por su email, nunca la de la agencia) y nace atado a su negocio.
 */
async function primerPlanPropio(ws: number, p: { email: string; nombre: string | null; pais?: string | null }, propios: readonly Cobro[]): Promise<ResultadoCompra> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  // Sólo la cuenta que ya NO tiene agencia (revisión de plata, hallazgo 7): con la agencia pagándola, un plan propio la
  // cobraba dos veces (la renovación de la agencia seguía). La agencia la suelta con «Dar de baja» (lib/agencia-baja.ts).
  const { data: cart, error: eCart } = await db.from('agencia_clientes').select('estado').eq('cliente_ws', ws).neq('estado', 'revocado').limit(1);
  if (eCart) return { ok: false, status: 503, error: 'No pudimos leer tu plan. Prueba otra vez en un minuto.' };
  if (cart?.length) return { ok: false, status: 409, error: 'Tu cuenta la maneja tu agencia: tu plan lo cambia ella.' };
  const desde = new Date(Date.now() - 23 * 3600_000).toISOString();
  const vivo = propios.find((c) => c.tipo === 'suscripcion' && (c.estado === 'pendiente' || c.estado === 'fallido') && c.created_at >= desde && c.creado_por === `reactivar:${ws}`);
  if (vivo) return { ok: true, link: linkDelCobro(vivo.token) };
  const [{ data: w }, { data: deAgencia }] = await Promise.all([
    db.from('workspaces').select('capa, nombre').eq('id', ws).maybeSingle(),
    db.from('cobros').select('proveedor').eq('workspace_id', plataforma).eq('cliente_ws', ws).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const capa = (w as { capa?: string } | null)?.capa;
  const plan = (await planesMako()).find((x) => x.id === (capa === 'agencia' ? 'pro' : 'esencial'));
  if (!plan) return { ok: false, status: 404, error: 'No encontramos tu plan: escríbenos y lo activamos.' };
  // Con la pasarela de SU país (hallazgo 7): la de la agencia era de otro país, y Mercado Pago rechaza a quien no es del suyo.
  const opciones = pasarelasDelPais(p.pais ?? null, (await monedasDeLaPlataforma(plataforma)).filter((m) => !m.prueba).map((m) => ({ ...m, monto: precioEn(plan, m.moneda) }))
    .filter((x): x is { pasarela: Pasarela; moneda: string; prueba: boolean; monto: number } => x.monto != null));
  const antes = (deAgencia as { proveedor?: string } | null)?.proveedor;
  const via = opciones.find((o) => o.pasarela === antes) ?? opciones.find((o) => o.pasarela === 'stripe') ?? opciones[0];
  if (!via) return { ok: false, status: 503, error: TEXTO_SIN_PASARELA };
  const nombre = (p.nombre ?? '').trim() || String((w as { nombre?: string } | null)?.nombre ?? '').trim() || p.email.split('@')[0];
  return runWithWorkspace(plataforma, async () => {
    let lead: { leadId: number };
    try {
      lead = await leadDelComprador({ plan: plan.id, nombre, email: p.email.trim().toLowerCase(), pasarela: via.pasarela, origen: null, ref: null } as PedidoCompra);
    } catch (e) {
      console.error(`[compra-plan] primer plan propio ws=${ws}: no pude crear su ficha:`, e instanceof Error ? e.message : String(e));
      return { ok: false, status: 503, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    const r = await crearCobro(plataforma, {
      leadId: lead.leadId, pasarela: via.pasarela, tipo: 'suscripcion', concepto: conceptoDelPlan(plan),
      monto: via.monto, moneda: via.moneda, montoUsd: plan.precioUsd, email: p.email, nombre, creadoPor: `reactivar:${ws}`,
    });
    if (!r.ok) { console.error(`[compra-plan] primer plan propio ws=${ws}: ${r.error}`); return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' }; }
    // ⚠️ ATADO A SU NEGOCIO ANTES DE DEVOLVER EL LINK: sin `alta_ws` el pago no le devolvería el acceso.
    const { error } = await db.from('cobros').update({ alta_ws: ws, plan_mako: plan.id }).eq('id', r.cobro.id).eq('workspace_id', plataforma);
    if (error) {
      console.error(`[compra-plan] primer plan propio ws=${ws}: no pude atar el cobro ${r.cobro.id}: ${error.message}`);
      await anularCobro(plataforma, r.cobro.id, 'MaKo (no se pudo atar el plan)').catch(() => {});
      return { ok: false, status: 502, error: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    return { ok: true, link: r.link };
  });
}
