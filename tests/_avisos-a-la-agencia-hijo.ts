// =============================================================================
// Hijo de tests/avisos-a-la-agencia.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, sobre el PostgREST de mentira y un Evolution en memoria, `emitirEventoDePlataforma` (con las filas que salen de las
// plantillas), `aplicarPagoFallido` y `avisarSuspension`. Mira lo único que importa: a qué GRUPO y a qué CORREO llega cada cosa.
// Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const PLATAFORMA = 9, AGENCIA = 13, OTRA_AGENCIA = 14, NATALIA = 19, DIRECTO = 30, DE_DOS = 31, REVOCADO = 32, PENDIENTE = 33, SE_PAGA_SOLO = 34, SIN_NOMBRE = 35, AGENCIA_PAUSADA = 15, DE_LA_PAUSADA = 36, AGENCIA_SIN_GRUPO = 16, DE_LA_SIN_GRUPO = 37;
const jid = (ws: number) => `${ws}@g.us`;

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['app_settings', 'workspaces', 'agencia_clientes', 'nutricion_secuencias', 'notificaciones', 'cobros', 'leads', 'lead_audit', 'pagos', 'usuarios', 'avisos_cola', 'flujo_corridas', 'push_suscripciones', 'tickets'],
    orCompleto: true,
    defaults: (tabla: string, f: Fila) => (['notificaciones', 'leads', 'lead_audit', 'flujo_corridas', 'tickets'].includes(tabla) ? { id: ids++, created_at: new Date().toISOString(), ...f } : { ...f }),
    unicos: [{ tabla: 'app_settings', columnas: ['workspace_id', 'key'], donde: () => true, nombre: 'app_settings_uk' }],
  });
  const db = pg.db as Record<string, Fila[]>;
  const grupos: Array<{ jid: string; texto: string }> = [];
  const correos: Array<{ to: string; asunto: string; cuerpo: string }> = [];
  let carteraCaida = false, nombreCaido = false, filasCaidas = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Fila : null;
    if (u.host === 'supa.test') {
      if (carteraCaida && u.pathname.endsWith('/agencia_clientes')) return json(500, { message: 'base caída' });
      if (filasCaidas && u.pathname.endsWith('/nutricion_secuencias')) return json(500, { message: 'base caída' });
      if (nombreCaido && u.pathname.endsWith('/workspaces') && u.searchParams.get('select')?.includes('nombre')) return json(500, { message: 'base caída' });
      return pg.responder(u, init);
    }
    if (u.host === 'evo.test') {
      const number = String(body?.number ?? '');
      if (number) grupos.push({ jid: number, texto: String(body?.text ?? body?.caption ?? '') });
      return json(200, { key: { id: `m${grupos.length}` } });
    }
    if (u.host === 'api.resend.com') {
      const para = body?.to;
      correos.push({ to: Array.isArray(para) ? String(para[0]) : String(para), asunto: String(body?.subject ?? ''), cuerpo: String(body?.text ?? body?.html ?? '') });
      return json(200, { id: 'mail' });
    }
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.EVOLUTION_BASE_URL = 'http://evo.test';
  process.env.EVOLUTION_API_KEY = 'clave-evo';

  const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
  db.workspaces.push(
    negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(AGENCIA, 'Codigo Inmobiliario', 'agencia'), negocio(OTRA_AGENCIA, 'Otra Agencia', 'agencia'),
    negocio(NATALIA, 'Natalia'), negocio(DIRECTO, 'Cliente Directo'), negocio(DE_DOS, 'De Dos'), negocio(REVOCADO, 'Se Fue'), negocio(PENDIENTE, 'Sin Firmar'), negocio(SE_PAGA_SOLO, 'Se Paga Solo'), negocio(SIN_NOMBRE, '  '),
    { ...negocio(AGENCIA_PAUSADA, 'Pausada', 'agencia'), estado: 'pausado' }, negocio(DE_LA_PAUSADA, 'De La Pausada'),
    negocio(AGENCIA_SIN_GRUPO, 'Agencia Sin Grupo', 'agencia'), negocio(DE_LA_SIN_GRUPO, 'De La Sin Grupo'),
  );
  const cart = (agencia_ws: number, cliente_ws: number, estado = 'aprobado') => ({ agencia_ws, cliente_ws, estado });
  db.agencia_clientes.push(cart(AGENCIA, NATALIA), cart(AGENCIA, DE_DOS), cart(OTRA_AGENCIA, DE_DOS), cart(AGENCIA, REVOCADO, 'revocado'), cart(AGENCIA, PENDIENTE, 'pendiente'), cart(AGENCIA, SE_PAGA_SOLO), cart(AGENCIA, SIN_NOMBRE), cart(AGENCIA_PAUSADA, DE_LA_PAUSADA), cart(AGENCIA_SIN_GRUPO, DE_LA_SIN_GRUPO));
  for (const ws of [AGENCIA, OTRA_AGENCIA, NATALIA, DIRECTO, DE_DOS, REVOCADO, PENDIENTE, SE_PAGA_SOLO, SIN_NOMBRE, AGENCIA_PAUSADA, DE_LA_PAUSADA, DE_LA_SIN_GRUPO]) db.app_settings.push({ workspace_id: ws, key: 'mako.grupo_jid', value: jid(ws) });
  db.app_settings.push({ workspace_id: SE_PAGA_SOLO, key: 'agency.quien_paga', value: 'cliente' });
  db.app_settings.push({ workspace_id: AGENCIA_SIN_GRUPO, key: 'notif_emails', value: JSON.stringify(['singrupo@x.test']) });
  const admin = (workspace_id: number, email: string) => ({ workspace_id, email, rol_ws: 'admin' });
  db.usuarios.push(admin(AGENCIA, 'agencia@x.test'), admin(NATALIA, 'natalia@x.test'), admin(SE_PAGA_SOLO, 'solo@x.test'), admin(DIRECTO, 'directo@x.test'), admin(AGENCIA_SIN_GRUPO, 'singrupo@x.test'));

  const { plantillaPorId, pasosDePlantilla } = await imp('lib/plantillas-automatizaciones.ts');
  const { normalizar } = await imp('lib/flujo-grafo.ts');
  const { TRIGGER_AVISO_MAKO } = await imp('lib/disparadores.ts');
  let fila = 500;
  const conFila = (plantilla: string, evento: string) => db.nutricion_secuencias.push({
    id: fila++, workspace_id: PLATAFORMA, nombre: plantillaPorId(plantilla).nombre, activa: true, trigger_tipo: TRIGGER_AVISO_MAKO, archivada_at: null,
    disparadores: [{ id: 'd1', subtipo: evento, trigger_tipo: TRIGGER_AVISO_MAKO }], pasos: normalizar(pasosDePlantilla(plantillaPorId(plantilla))),
  });
  conFila('mako-meta-cuenta-frenada', 'meta_cuenta_frenada');
  conFila('mako-meta-cuenta-recuperada', 'meta_cuenta_recuperada');

  const { emitirEventoDePlataforma } = await imp('lib/avisos.ts');
  const { datosCuentaFrenada } = await imp('lib/alerta-critica-texto.ts');
  const { aplicarPagoFallido } = await imp('lib/cobros.ts');
  const { avisarSuspension, agenciaDelCobro } = await imp('lib/plan-deuda.ts');
  const { runWithWorkspace } = await imp('lib/workspace.ts');

  const datos = datosCuentaFrenada({ statusLabel: 'En período de gracia', disableReason: null, entregaFrenada: true, confirmado: true }, 35, 0);
  const emitir = async (ws: number, id = 'meta-cuenta-frenada') => {
    grupos.length = 0;
    const r = await runWithWorkspace(ws, () => emitirEventoDePlataforma(id, { ws, ...(id === 'meta-cuenta-frenada' ? { datos } : {}) }));
    return { ok: r.ok, llegaron: r.llegaron ?? 0, grupos: grupos.map((g) => g.jid), texto: grupos[0]?.texto ?? null };
  };
  const out: Record<string, unknown> = {};

  // ⚠️ PRIMERO SIN LAS FILAS DE LA AGENCIA: lo que pasaría con el deploy antes que la mudanza.
  out.sinFilaDeLaAgencia = await emitir(NATALIA);
  db.notificaciones.length = 0;

  conFila('mako-meta-cuenta-frenada-agencia', 'meta_cuenta_frenada_agencia');
  conFila('mako-meta-cuenta-recuperada-agencia', 'meta_cuenta_recuperada_agencia');
  out.natalia = await emitir(NATALIA);
  out.nataliaFeed = db.notificaciones.filter((n) => Number(n.workspace_id) === NATALIA).length;
  out.agenciaFeed = db.notificaciones.filter((n) => Number(n.workspace_id) === AGENCIA).map((n) => n.tipo);
  out.nataliaVolvio = await emitir(NATALIA, 'meta-cuenta-recuperada');
  out.directo = await emitir(DIRECTO);
  out.directoVolvio = await emitir(DIRECTO, 'meta-cuenta-recuperada');
  out.deDos = await emitir(DE_DOS);
  out.revocado = await emitir(REVOCADO);
  out.pendiente = await emitir(PENDIENTE);
  carteraCaida = true;
  out.carteraCaida = await emitir(NATALIA);
  carteraCaida = false;
  nombreCaido = true;
  out.nombreCaido = await emitir(NATALIA);
  nombreCaido = false;
  out.sinNombre = await emitir(SIN_NOMBRE);
  out.dePausada = await emitir(DE_LA_PAUSADA);
  correos.length = 0;
  out.agenciaSinGrupo = await emitir(DE_LA_SIN_GRUPO);
  out.agenciaSinGrupoCorreos = correos.map((c) => ({ ...c }));
  filasCaidas = true;
  out.filasCaidas = await emitir(NATALIA);
  filasCaidas = false;
  // Otro aviso del negocio, de otra clase, sigue siendo suyo: es su WhatsApp.
  conFila('mako-whatsapp-caido', 'whatsapp_caido');
  out.suWhatsapp = await emitir(NATALIA, 'wa-desconectado');

  // ── El plan ──
  const cobro = (id: number, extra: Fila) => {
    db.leads.push({ id: id + 5000, workspace_id: PLATAFORMA, nombre: 'Lead', estado_lead: 'abierto', pipeline_stage: 'lead' });
    const c = { id, workspace_id: PLATAFORMA, lead_id: id + 5000, tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', proveedor: 'mercadopago', proveedor_ref: `ref${id}`, concepto: 'MaKo Pro', monto: 97, moneda: 'USD', motivo: null, agencia_ws: null, cliente_ws: null, alta_ws: null, ...extra };
    db.cobros.push(c);
    return c;
  };
  const mails = async (fn: () => Promise<unknown>) => { correos.length = 0; await fn(); return correos.map((c) => ({ ...c })); };

  const deNatalia = cobro(1, { agencia_ws: AGENCIA, cliente_ws: NATALIA });
  out.quien = await agenciaDelCobro(1);
  out.rechazo = await mails(() => aplicarPagoFallido({ ...deNatalia }, 'tarjeta rechazada'));
  out.reintento = await mails(() => aplicarPagoFallido({ ...db.cobros[0] }, 'tarjeta rechazada'));
  const primera = cobro(2, { estado: 'pendiente', agencia_ws: AGENCIA, cliente_ws: NATALIA });
  out.primeraRenovacion = await mails(() => aplicarPagoFallido({ ...primera }, 'tarjeta rechazada'));
  const sinAutorizar = cobro(8, { estado: 'pendiente', suscripcion_estado: null, agencia_ws: AGENCIA, cliente_ws: NATALIA });
  out.renovacionSinAutorizar = await mails(() => aplicarPagoFallido({ ...sinAutorizar }, 'el pago diferido no se completó'));
  const unico = cobro(3, { tipo: 'unico', suscripcion_estado: null, estado: 'pendiente', agencia_ws: AGENCIA, cliente_ws: NATALIA });
  out.primerMes = await mails(() => aplicarPagoFallido({ ...unico }, 'tarjeta rechazada'));
  const propio = cobro(4, { alta_ws: DIRECTO });
  out.propio = await mails(() => aplicarPagoFallido({ ...propio }, 'tarjeta rechazada'));
  cobro(5, { agencia_ws: AGENCIA, cliente_ws: REVOCADO });
  out.quienRevocado = await agenciaDelCobro(5);
  const deSoloCobro = cobro(6, { agencia_ws: AGENCIA, cliente_ws: SE_PAGA_SOLO, proveedor: 'creem' });
  out.rechazoPagaElCliente = await mails(() => aplicarPagoFallido({ ...deSoloCobro }, 'tarjeta rechazada'));

  const corte = (cobroId: number, motivo = 'baja') => ({ cobroId, hasta: '2026-10-10', motivo, desde: '2026-10-15T00:00:00Z', vigente: true });
  out.pausaPagaLaAgencia = await mails(() => avisarSuspension(NATALIA, corte(1)));
  out.pausaPagaElCliente = await mails(() => avisarSuspension(SE_PAGA_SOLO, corte(6)));
  out.pausaPropia = await mails(() => avisarSuspension(DIRECTO, corte(4, 'impago')));
  out.pausaSinCobro = await mails(() => avisarSuspension(DIRECTO, corte(0)));
  carteraCaida = true;
  out.pausaSinSaber = await mails(() => avisarSuspension(NATALIA, corte(1)));
  const sinSaber = cobro(7, { agencia_ws: AGENCIA, cliente_ws: NATALIA });
  out.rechazoSinSaber = await mails(() => aplicarPagoFallido({ ...sinSaber }, 'tarjeta rechazada'));
  out.rechazoSinSaberAnotado = db.cobros.find((c) => c.id === 7)?.motivo;
  carteraCaida = false;

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
