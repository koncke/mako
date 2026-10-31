// =============================================================================
// Hijo de tests/whatsapp-checkout.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El WhatsApp del checkout, sobre el PostgREST de mentira y un Stripe en memoria. Corren REALES la ruta POST /api/planes/comprar,
// `createLead`, `duplicadosDeLead`, `enriquecerLead`, `crearCobro` y `aplicarPagoAprobado` con el alta. Necesita
// `--conditions=react-server`. Lo que NO prueba: la pantalla (el selector de país se miró en un banco) ni una pasarela de verdad.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
const PLATAFORMA = 9;
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['credenciales', 'webhook_routing', 'cobros', 'leads', 'lead_audit', 'pagos', 'app_settings', 'workspaces', 'cobro_etapa_vinculos', 'productos', 'pasarela_eventos', 'tickets', 'ticket_eventos', 'usuarios', 'usuario_workspaces', 'cuentas_integracion', 'funnels', 'pedidos_ingreso', 'landing_visits'],
    orCompleto: true,
    defaults: (tabla: string, f: Fila) => {
      const ahora = new Date().toISOString();
      if (tabla === 'workspaces') return { id: ids++, created_at: ahora, ...f };
      if (tabla === 'cobros') return { id: ids++, created_at: ahora, updated_at: ahora, lead_id: null, cuenta: null, cuenta_ref: null, motivo: null, pago_id: null, alta_capa: null, alta_estado: null, suscripcion_estado: null, proveedor_pago_id: null, proveedor_suscripcion_id: null, pagado_at: null, reembolsado_at: null, ...f };
      if (tabla === 'leads') return { id: ids++, created_at: ahora, estado_lead: 'abierto', pipeline_stage: 'lead', ...f };
      if (tabla === 'pagos') return { id: ids++, pagado: false, nacio_cobrada: false, resto_de: null, es_mensualidad: false, ...f };
      if (['lead_audit', 'tickets', 'pedidos_ingreso'].includes(tabla)) return { id: ids++, created_at: ahora, ...f };
      return { ...f };
    },
    unicos: [
      { tabla: 'cobros', columnas: ['proveedor', 'proveedor_ref'], donde: (f: Fila) => f.proveedor_ref != null, nombre: 'cobros_ref_uk' },
      { tabla: 'pagos', columnas: ['workspace_id', 'proveedor', 'proveedor_pago_id'], donde: (f: Fila) => f.proveedor_pago_id != null, nombre: 'pagos_proveedor_uk' },
      { tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' },
    ],
  });
  const db = pg.db as Record<string, Fila[]>;
  let nSes = 0;
  const otrosHosts: string[] = [];

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') {
      // El `ilike` exacto y el de sufijo de `duplicadosDeLead`: el de mentira no tiene comodines.
      for (const [k, v] of [...u.searchParams]) {
        if (!v.startsWith('ilike.')) continue;
        if (v.startsWith('ilike.%')) u.searchParams.set(k, `like.${v.slice(6)}`);
        else u.searchParams.set(k, `eq.${v.slice(6).replace(/\\(.)/g, '$1')}`);
      }
      return pg.responder(u, init);
    }
    if (u.host === 'api.stripe.com') {
      if (u.pathname === '/v1/checkout/sessions') {
        const id = `cs_live_${++nSes}`;
        return json(200, { id, url: `https://checkout.stripe.com/${id}`, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      }
      return json(404, { error: { message: `sin doble: ${u.pathname}` } });
    }
    if (u.host === 'api.resend.com') return json(200, { id: 'mail' });
    otrosHosts.push(u.host);
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';

  const { cifrar } = await imp('lib/cripto-credenciales.ts');
  const { POST: comprarRuta } = await imp('app/api/planes/comprar/route.ts');
  const { NextRequest } = await import('next/server');
  const cobros = await imp('lib/cobros.ts');
  const { guardarWhatsappDelPago } = await imp('lib/origen-cuenta-server.ts');
  const { CLAVE_WHATSAPP_DEL_PAGO } = await imp('lib/origen-cuenta.ts');

  const cred = (clave: string, valor: string, servicio: string) => db.credenciales.push({ workspace_id: PLATAFORMA, clave, valor_enc: cifrar(valor, PLATAFORMA, clave), servicio });
  db.workspaces.push({ id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });
  cred('STRIPE_SECRET_KEY', 'rk_live_WHATSAPPaaaaaaaaaaaaaaa', 'stripe');
  cred('STRIPE_ACCOUNT_ID', 'acct_WA', 'stripe');
  cred('STRIPE_WEBHOOK_SECRET', 'whsec_WHATSAPP', 'stripe');

  let nIp = 0;
  const pedir = async (email: string, whatsapp: string | undefined, extra: Fila = {}) => {
    const req = new NextRequest('https://mako.test/api/planes/comprar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://mako.test', 'x-forwarded-for': `10.0.1.${++nIp}`, 'x-vercel-ip-country': 'MX' },
      body: JSON.stringify({ plan: 'pro', nombre: `Comprador ${email.split('@')[0]}`, email, pasarela: 'stripe', ...(whatsapp === undefined ? {} : { whatsapp }), ...extra }),
    });
    const r = await comprarRuta(req);
    const j = await r.json() as Fila;
    return { status: r.status, link: !!j.link, campo: j.campo ?? null, error: j.error ?? null };
  };
  const ficha = (id: number, datos: Fila) => {
    db.leads.push({ id, workspace_id: PLATAFORMA, estado_lead: 'abierto', pipeline_stage: 'lead', created_at: new Date().toISOString(), telefono: null, telefono_normalizado: null, cliente_ws: null, ...datos });
  };
  const leadDe = (email: string) => db.leads.find((l) => l.email === email);
  const cobroDe = (email: string) => db.cobros.filter((c) => c.email === email).at(-1);
  const notas = (id: unknown) => db.lead_audit.filter((a) => a.lead_id === id && a.campo === 'WhatsApp').map((a) => String(a.valor_nuevo));
  const pagar = async (email: string) => {
    const c = cobroDe(email)!;
    await cobros.aplicarPagoAprobado((await cobros.getCobroPorToken(c.token))!, { proveedorPagoId: `in_${email}`, monto: 97, moneda: 'USD', suscripcionId: `sub_${email}` });
    return db.cobros.find((x) => x.id === c.id)!;
  };
  const delPago = (ws: unknown) => db.app_settings.find((f) => f.workspace_id === ws && f.key === CLAVE_WHATSAPP_DEL_PAGO)?.value ?? null;
  const out: Record<string, unknown> = {};

  // ── Nuevo, con su número ──
  out.nuevo = await pedir('nuevo@ejemplo.com', '5491122334455');
  out.nuevoLead = { telefono: leadDe('nuevo@ejemplo.com')?.telefono, norm: leadDe('nuevo@ejemplo.com')?.telefono_normalizado };
  out.nuevoOrigen = cobroDe('nuevo@ejemplo.com')?.origen ?? null;

  // ── Nuevo, sin número: compra igual ──
  out.sinNumero = await pedir('sinnumero@ejemplo.com', '');
  out.sinNumeroLead = leadDe('sinnumero@ejemplo.com')?.telefono ?? null;
  out.sinCampo = await pedir('sincampo@ejemplo.com', undefined);

  // ── Mal escrito: se le dice, no se crea nada; vacío, sigue ──
  const [c0, l0] = [db.cobros.length, db.leads.length];
  out.mal = await pedir('mal@ejemplo.com', '5412');
  out.malNoCreo = db.cobros.length === c0 && db.leads.length === l0;
  out.malSigue = await pedir('mal@ejemplo.com', '');

  // ── Ya tiene ficha por su email ──
  ficha(10, { nombre: 'Vacía', email: 'vacia@ejemplo.com' });
  out.vacia = await pedir('vacia@ejemplo.com', '5215512345678');
  out.vaciaLead = { telefono: db.leads.find((l) => l.id === 10)!.telefono, norm: db.leads.find((l) => l.id === 10)!.telefono_normalizado };
  out.vaciaHistorial = db.lead_audit.filter((a) => a.lead_id === 10 && a.campo === 'Teléfono').length;

  ficha(11, { nombre: 'Con otro', email: 'conotro@ejemplo.com', telefono: '+5215500000001', telefono_normalizado: '5215500000001' });
  out.conOtro = await pedir('conotro@ejemplo.com', '5215599999999');
  out.conOtroLead = db.leads.find((l) => l.id === 11)!.telefono;
  out.conOtroNotas = notas(11);

  ficha(12, { nombre: 'Igual', email: 'igual@ejemplo.com', telefono: '5215500000002', telefono_normalizado: '5215500000002' });
  out.igual = await pedir('igual@ejemplo.com', '5215500000002');
  out.igualNotas = notas(12);

  // ── EL MISMO NÚMERO EN OTRA FICHA, CON OTRO EMAIL: la venta no se pierde y no se escribe sobre la otra persona ──
  ficha(13, { nombre: 'La otra persona', email: 'laotra@ejemplo.com', telefono: '+5215577777777', telefono_normalizado: '5215577777777', cliente_ws: 500 });
  out.otraPersona = await pedir('compradora@ejemplo.com', '5215577777777');
  const nueva = leadDe('compradora@ejemplo.com');
  out.otraPersonaLead = { nueva: !!nueva, tel: nueva?.telefono, cobroEnLaNueva: cobroDe('compradora@ejemplo.com')?.lead_id === nueva?.id };
  out.otraPersonaNotas = notas(nueva?.id);
  const pagoOtra = await pagar('compradora@ejemplo.com');
  const otra = db.leads.find((l) => l.id === 13)!;
  out.otraPersonaIntacta = { email: otra.email, cliente_ws: otra.cliente_ws, estado: otra.estado_lead };
  out.otraPersonaAlta = { estado: pagoOtra.alta_estado, delPago: delPago(pagoOtra.alta_ws) };

  // ── El mismo número y la ficha SIN email: es la misma persona ──
  ficha(14, { nombre: 'Del chat', email: null, telefono: '+5215566666666', telefono_normalizado: '5215566666666' });
  out.delChat = await pedir('delchat@ejemplo.com', '5215566666666');
  out.delChatLead = { email: db.leads.find((l) => l.id === 14)!.email, cobro: cobroDe('delchat@ejemplo.com')?.lead_id };

  // ── El pedido sin pasarela, por el mismo camino ──
  ficha(15, { nombre: 'Otro pedido', email: 'otropedido@ejemplo.com', telefono: '+5215555555555', telefono_normalizado: '5215555555555' });
  out.quiero = await pedir('quiero@ejemplo.com', '5215555555555', { quiero: true, plan: 'esencial' });
  out.quieroLead = !!leadDe('quiero@ejemplo.com');

  // ── Al pagar: el número llega a su cuenta nueva ──
  const pagoNuevo = await pagar('nuevo@ejemplo.com');
  out.altaConNumero = { estado: pagoNuevo.alta_estado, delPago: delPago(pagoNuevo.alta_ws) };
  const pagoSin = await pagar('sinnumero@ejemplo.com');
  out.altaSinNumero = { estado: pagoSin.alta_estado, delPago: delPago(pagoSin.alta_ws) };
  // Dejó el campo vacío, y su ficha ya tenía uno.
  ficha(16, { nombre: 'Con ficha', email: 'conficha@ejemplo.com', telefono: '+5215544444444', telefono_normalizado: '5215544444444' });
  await pedir('conficha@ejemplo.com', '');
  const pagoFicha = await pagar('conficha@ejemplo.com');
  out.altaDeLaFicha = delPago(pagoFicha.alta_ws);
  // Escribió otro: el de esta compra, aunque la ficha no se pise.
  const pagoOtro = await pagar('conotro@ejemplo.com');
  out.altaElQueEscribio = { ficha: db.leads.find((l) => l.id === 11)!.telefono, delPago: delPago(pagoOtro.alta_ws) };
  // Un reintento del alta no cambia lo que el onboarding ya ofreció.
  db.cobros.find((c) => c.id === pagoNuevo.id)!.origen = { whatsapp: '5215533333333' };
  await guardarWhatsappDelPago(pagoNuevo.alta_ws, pagoNuevo.lead_id, pagoNuevo.id);
  out.reintento = delPago(pagoNuevo.alta_ws);

  // Comprar no le escribe a nadie: ninguna llamada salió a un proveedor de mensajes.
  out.otrosHosts = [...new Set(otrosHosts)];

  console.log(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
