// =============================================================================
// MaKo Partners — las cuentas de MaKo de los clientes de una agencia, y abrir una nueva (17/10/2026)
// =============================================================================
// Martín: «diseña la tab de "MaKo Partners" con todo lo que habíamos dicho y planeado... Y ahí deberían vivir los
// clientes de agencia, que no son los mismos que "client": podrían serlo como no... Eso se debe poder configurar en el
// CRM: si un usuario se unió al programa de "MaKo Partners", que le aparezca la opción en el CRM para llevarlos allí».
// El diseño, en docs/diseno-clients.md (D7-D10).
//
// Lo que vive acá es el lado del SERVER; lo puro (el juicio de la cartera, el saneo de un alta) sigue en
// lib/agencia-cartera.ts y lib/agencia-altas.ts, y el cobro en lib/agencia-cobro.ts (Pagos). Nada de esto es nuevo:
// es lo que la tab Clientes hacía para una agencia (app/customer-success/pantalla.tsx y crearCuentaMakoAction), mudado
// acá porque una cuenta de agencia no es un cliente de la entrega.
//
// ⚠️ «UNIRSE AL PROGRAMA» ES SER AGENCIA (`esAgencia`: la capa del workspace, que pone el super admin). No hay un
//    flag aparte: dos lugares para la misma pregunta es cómo un día dicen cosas distintas (lib/agencia.ts).
// ⚠️ EL PLAN Y EL EQUIPO DE CADA CUENTA, SÓLO DE LAS APROBADAS: son lecturas que CRUZAN de inquilino, con el mismo
//    corte que la entrada (`clientesAprobados`). Lo pendiente o revocado se ve por su nombre y su estado, nada más.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { getTenantDb, crearWorkspace, listarWorkspaces } from './workspace';
import { listarUsuarios, crearUsuario, buscarUsuarioPorEmail } from './usuarios';
import { carteraDeAgencia, altasDeAgencia, esAgencia, agenciasHabilitadas, type FilaAlta } from './agencia';
import { clientesAprobados, ESTADOS_CARTERA, type EstadoCartera } from './agencia-cartera';
import { emailNormalizado, emailUtilizable } from './agencia-altas';
import { cobrosDeClientesDeAgencia, linkPrimerMes, precioClienteDeAgencia, type ResultadoLinkCliente } from './agencia-cobro';
import { CAPA_DE_PLAN, KEY_PLAN_CAMBIADO, cobraPorPasarela, leerCambioDePlan, paisDeZona, planCuentaDe, planQueVeLaAgencia, type PlanCuenta, type PrecioClienteAgencia } from './agencia-cobro-reglas';
import { mensualidadPrendida } from './agencia-mes';
import { CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO } from './plan-esencial-reglas';
import { zonaDelNegocioDetalle } from './timezone';
import { caraDeUsuario } from './gravatar';
import { guardarQuienPaga, quienPagaDeClientes } from './agency';
import { quienPagaDe, type QuienPaga } from './agency-reglas';
import { invitarPorEmail } from './invitaciones';
import type { ResultadoInvitacion } from './invitacion-aviso';

/** Una persona del equipo de una cuenta, como la dibuja la ficha. */
export type MiembroCuenta = { id: number; nombre: string; email: string; rol: string; foto: string | null };

/** Lo que la agencia tiene que pagar por una cuenta (#866 y #867): lo arma lib/agencia-cobro.ts. */
export type CobroCuenta = { pagar: string | null; renovacion: { link: string; desde: string | null; activada: boolean } | null };

/** Una cuenta de MaKo de un cliente de la agencia. */
export type CuentaPartner = {
  ws: number;
  nombre: string;
  estado: EstadoCartera;
  /** Cuándo se abrió (la fila de la cartera). */
  desde: string;
  /** El plan de MaKo de la cuenta: de las aprobadas, su capa; de las pendientes, lo que eligió la agencia; de las dadas de baja, nada (`planQueVeLaAgencia`). */
  plan: string | null;
  planId: PlanCuenta;
  /** ¿La agencia ya le eligió el plan? Las de antes del 29/10, no: siguen como Pro (H1, lib/plan-esencial-reglas.ts). */
  planElegido: boolean;
  /** Su equipo, sólo de las aprobadas. `null` = no se pudo leer (no es «nadie»). */
  equipo: MiembroCuenta[] | null;
  /** Lo que la agencia pidió sumar a su equipo (mig 0178). */
  altas: FilaAlta[];
  cobro: CobroCuenta | null;
  /** El lead del CRM de la agencia del que salió (`leads.cliente_ws`). Puede no haber: «podrían serlo como no». */
  lead: { id: number; nombre: string } | null;
  /** Quién paga su cuenta (Agency Dashboard, 25/10/2026): la agencia con su tarjeta, o el cliente al terminar su onboarding. */
  paga: QuienPaga;
};

export type CarteraPartner =
  | { ok: true; cuentas: CuentaPartner[]; precio: PrecioClienteAgencia }
  | { ok: false; error: string };

const estadoValido = (e: string): EstadoCartera => ((ESTADOS_CARTERA as readonly string[]).includes(e) ? e as EstadoCartera : 'pendiente');

/**
 * Las cuentas de una agencia, con todo lo que la pantalla dibuja. ⚠️ SI LA CARTERA NO SE PUEDE LEER, FALLA VISIBLE
 * (`ok: false`): una lista vacía se leería como «todavía no tienes clientes».
 */
export async function cuentasDePartner(agenciaWs: number): Promise<CarteraPartner> {
  if (!(await esAgencia(agenciaWs))) return { ok: false, error: 'Tu cuenta no es parte de MaKo Partners.' };
  let cartera: Awaited<ReturnType<typeof carteraDeAgencia>>;
  try {
    const { data, error } = await getSupabaseServer().from('agencia_clientes')
      .select('agencia_ws, cliente_ws, estado, decidido_por, decidido_at, motivo, created_at').eq('agencia_ws', agenciaWs);
    if (error) throw error;
    cartera = (data ?? []) as typeof cartera;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude leer tus clientes.' };
  }
  const aprobados = new Set(clientesAprobados(agenciaWs, cartera));
  const todos = new Set(cartera.map((f) => Number(f.cliente_ws)));

  const [wss, usuarios, altas, cobros, leads, precio, pagan, mensualidad] = await Promise.all([
    listarWorkspaces().catch(() => []),
    // `null` = no se pudo leer, que no es «nadie» (ver abajo).
    aprobados.size ? listarUsuarios().catch(() => null) : Promise.resolve([]),
    altasDeAgencia(agenciaWs).catch(() => [] as FilaAlta[]),
    cobrosDeClientesDeAgencia(agenciaWs).catch(() => ({} as Record<number, CobroCuenta>)),
    leadsConCuenta(),
    precioClienteDeAgencia().catch(() => ({ usd: 47, mp: null }) as PrecioClienteAgencia),
    quienPagaDeClientes([...todos]),
    // Con la mensualidad prendida la agencia paga por fuera de MaKo: el link de la pasarela no se le ofrece (#85, abajo).
    mensualidadPrendida(agenciaWs),
  ]);
  const porPasarela = cobraPorPasarela(mensualidad);
  // Qué cuentas ya tienen el plan elegido, y cuál (la marca `agency.plan_cambiado`). Sin poder leerlo, todas «elegidas»: de las aprobadas se muestra su capa.
  const elegidas = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', KEY_PLAN_CAMBIADO).in('workspace_id', [...todos])
    .then(({ data, error }) => (error ? null : new Map(((data ?? []) as Array<{ workspace_id: number; value: unknown }>).map((x) => [Number(x.workspace_id), leerCambioDePlan(x.value)?.plan ?? null]))), () => null);
  const nombreWs = new Map(wss.filter((w) => todos.has(w.id)).map((w) => [w.id, w]));
  const equipoPorWs = new Map<number, MiembroCuenta[]>();
  // Cada aprobada arranca con su lista vacía SÓLO si la lectura anduvo: así se distingue «cero personas» (nadie puede
  // entrar) de «no pude mirar» (el estado de Brigitte del 28/09, que la tarjeta no decía).
  if (usuarios) for (const ws of aprobados) equipoPorWs.set(ws, []);
  for (const u of usuarios ?? []) {
    const ws = u.workspace_id;
    if (ws == null || !aprobados.has(ws)) continue;
    equipoPorWs.get(ws)?.push({
      id: u.id, nombre: (u.nombre ?? '').trim() || u.email, email: u.email, rol: u.rol_ws ?? 'admin', foto: caraDeUsuario(u, 96),
    });
  }
  const altasPorWs = new Map<number, FilaAlta[]>();
  for (const a of altas) {
    const l = altasPorWs.get(a.cliente_ws) ?? [];
    l.push(a);
    altasPorWs.set(a.cliente_ws, l);
  }

  const sinElegir = (ws: number) => CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO && elegidas != null && !elegidas.has(ws);
  const cuentas: CuentaPartner[] = cartera.map((f) => {
    const ws = Number(f.cliente_ws);
    const w = nombreWs.get(ws);
    const aprobada = aprobados.has(ws);
    return {
      ws,
      nombre: w?.nombre?.trim() || leads.get(ws)?.nombre || `Cliente ${ws}`,
      estado: estadoValido(f.estado),
      desde: f.created_at,
      // El plan de MaKo de la cuenta (29/10/2026: «son los mismos planes, de 47 y 97»). La capa, SÓLO de las aprobadas.
      ...planQueVeLaAgencia({ estado: estadoValido(f.estado), capa: aprobada ? w?.capa : null, hayCuenta: !!w, elegido: elegidas?.get(ws) ?? null, sinElegir: sinElegir(ws) }),
      equipo: aprobada ? (equipoPorWs.get(ws) ?? null) : null,
      altas: altasPorWs.get(ws) ?? [],
      // ⚠️ Sin esto, un link de pasarela PENDIENTE de una agencia con mensualidad tapaba «Inspeccionar» con «Pagar su mes»
      // (`accionDeCuenta`) en una cuenta ya habilitada y pagada por la mensualidad (ticket #85, Sellers).
      cobro: porPasarela ? ((cobros as Record<number, CobroCuenta>)[ws] ?? null) : null,
      lead: leads.get(ws) ?? null,
      paga: pagan.get(ws) ?? 'agencia',
    };
  });
  // Lo que espera algo de la agencia primero (pagar, autorizar), después las aprobadas por nombre.
  const peso = (c: CuentaPartner) => (c.cobro?.pagar ? 0 : c.cobro?.renovacion && !c.cobro.renovacion.activada ? 1 : c.estado === 'aprobado' ? 2 : c.estado === 'pendiente' ? 3 : 4);
  cuentas.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, 'es'));
  return { ok: true, cuentas, precio };
}

/** Los leads de ESTE workspace que tienen cuenta de MaKo (`leads.cliente_ws`), por cuenta. Nunca tira. */
async function leadsConCuenta(): Promise<Map<number, { id: number; nombre: string }>> {
  const out = new Map<number, { id: number; nombre: string }>();
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id, nombre, cliente_ws').not('cliente_ws', 'is', null).limit(1000);
    if (error) throw error;
    for (const l of (data ?? []) as Array<{ id: number; nombre: string | null; cliente_ws: number }>) {
      out.set(Number(l.cliente_ws), { id: Number(l.id), nombre: (l.nombre ?? '').trim() || `Lead ${l.id}` });
    }
  } catch (e) {
    console.warn('[partners] no pude leer qué leads tienen cuenta:', e instanceof Error ? e.message : e);
  }
  return out;
}

/** Un lead de ESTE workspace (cualquier etapa), para llevarlo a Partners. `null` = no es de acá. */
export async function leadParaPartners(leadId: number): Promise<{ id: number; nombre: string; email: string | null; clienteWs: number | null } | null> {
  if (!Number.isInteger(leadId) || leadId <= 0) return null;
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, nombre, email, cliente_ws').eq('id', leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const l = data as { id: number; nombre: string | null; email: string | null; cliente_ws: number | null };
  return { id: Number(l.id), nombre: (l.nombre ?? '').trim(), email: l.email?.trim() || null, clienteWs: l.cliente_ws ?? null };
}

export type AbrirCuenta = {
  agenciaWs: number; nombre: string; email: string; leadId?: number | null; pagador: string | null;
  /** Quién paga su cuenta (25/10/2026). Sin esto, la agencia: lo que pasaba antes de que se pudiera elegir. */
  paga?: QuienPaga | null;
  /** Su plan (29/10/2026): Esencial o Pro, a su precio. Sin esto, Esencial. */
  plan?: PlanCuenta | null;
  /** El país de quien la abre (`x-vercel-ip-country`): decide la pasarela, como /planes. */
  pais?: string | null;
};
export type CuentaAbierta =
  | { ok: true; clienteWs: number; link: string | null; sinLink: string | null; paga: QuienPaga; acceso?: ResultadoInvitacion }
  | { ok: false; error: string; yaTiene?: number };

/**
 * ABRIR LA CUENTA DE MaKo DE UN CLIENTE DE LA AGENCIA: el workspace, su fila en la cartera ('pendiente'), su admin (sin
 * avisarle todavía) y el link del primer mes (#866). Desde un lead del CRM (cualquier etapa: «podrían serlo como no») o
 * desde cero, con un nombre y un email.
 *
 * Es lo que hacía `crearCuentaMakoAction` (app/customer-success/actions.ts) para un cliente ganado, con sus reglas:
 *   · ⚠️ EL EMAIL ES OBLIGATORIO: una cuenta sin él quedó con CERO usuarios el 28/09/2026.
 *   · ⚠️ NACE 'pendiente': la agencia la pide; la habilita el pago del primer mes o la firma del super admin.
 *   · ⚠️ EL EMAIL YA USADO SE MIRA ANTES DE CREAR: `usuarios.email` es único, y fallar después deja un workspace suelto.
 *   · ⚠️ SIN ROLLBACK, DICHO: si algo falla después de crear el workspace, el mensaje NOMBRA su número.
 *   · Sin link de pago no es un error: la cuenta queda esperando la firma, y `sinLink` dice por qué.
 * El guard de quién puede (admin de una agencia) lo hace quien llama; acá se repregunta `esAgencia`.
 */
export async function abrirCuentaDePartner(p: AbrirCuenta): Promise<CuentaAbierta> {
  const correo = emailNormalizado(p.email);
  if (!emailUtilizable(correo)) return { ok: false, error: 'Hace falta su email: es por donde le llega el acceso.' };
  if (!(await esAgencia(p.agenciaWs))) return { ok: false, error: 'Tu cuenta no es parte de MaKo Partners.' };

  let lead: Awaited<ReturnType<typeof leadParaPartners>> = null;
  if (p.leadId != null) {
    lead = await leadParaPartners(Number(p.leadId));
    if (!lead) return { ok: false, error: 'Ese lead no es de tu CRM.' };
    // Idempotencia: dos clics, dos pestañas o una conexión mala no dejan dos cuentas para el mismo lead.
    if (lead.clienteWs) return { ok: false, error: 'Ya tiene cuenta en MaKo Partners.', yaTiene: lead.clienteWs };
  }
  const nombre = (p.nombre.trim() || lead?.nombre || '').slice(0, 120);
  if (!nombre) return { ok: false, error: 'Falta su nombre.' };
  if (await buscarUsuarioPorEmail(correo)) {
    return { ok: false, error: 'Ese email ya tiene una cuenta de MaKo. Usa otro.' };
  }

  const plan = planCuentaDe(p.plan);
  // El país decide la pasarela: el de quien la abre, o el de la zona horaria de la agencia (la API no trae encabezado).
  // Sin encabezado (la API), el de la zona del negocio, SÓLO si la guardó (revisión de plata, hallazgo 8): la de por defecto
  // es America/Tijuana y le cobraba como a México a una agencia de cualquier país. Sin país, Stripe primero.
  const zona = p.pais ? null : await zonaDelNegocioDetalle(p.agenciaWs).catch(() => null);
  const pais = p.pais ?? (zona?.guardada ? paisDeZona(zona.tz) : null);
  const ws = await crearWorkspace(nombre, CAPA_DE_PLAN[plan]);
  const { error: eCartera } = await getSupabaseServer()
    .from('agencia_clientes').insert({ agencia_ws: p.agenciaWs, cliente_ws: ws.id, estado: 'pendiente' });
  if (eCartera) return { ok: false, error: `La cuenta quedó creada (workspace ${ws.id}) pero sin pedir aprobación: ${eCartera.message}` };
  // El plan, ELEGIDO (H1 de la verificación independiente, lib/plan-esencial-reglas.ts): con la marca rigen sus topes y candados.
  // Sin ella la cuenta seguiría como Pro (las de antes del 29/10): si no se puede escribir, se dice y no se sigue.
  const { error: eMarca } = await getSupabaseServer().from('app_settings').upsert({ workspace_id: ws.id, key: KEY_PLAN_CAMBIADO, value: JSON.stringify({ at: new Date().toISOString(), plan, pendiente: false }), updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (eMarca) return { ok: false, error: `La cuenta quedó creada (workspace ${ws.id}) pero sin su plan anotado: ${eMarca.message}` };

  if (lead) {
    const db = await getTenantDb();
    const { error: eLead } = await db.from('leads').update({ cliente_ws: ws.id }).eq('id', lead.id);
    if (eLead) return { ok: false, error: `Se creó la cuenta (workspace ${ws.id}) pero no quedó ligada al lead: ${eLead.message}` };
    // El email queda en el lead si no tenía: es el mismo dato.
    if (!lead.email) await db.from('leads').update({ email: correo }).eq('id', lead.id);
  }

  // Su admin, creado ya. Si paga la agencia, SIN AVISARLE: el acceso se lo manda la habilitación (el pago o la firma).
  // Si paga el cliente, se le avisa más abajo.
  try {
    await crearUsuario({ email: correo, nombre, rol: 'usuario', workspace_id: ws.id, rol_ws: 'admin' });
  } catch (e) {
    return { ok: false, error: `La cuenta quedó creada (workspace ${ws.id}) pero sin su usuario: ${e instanceof Error ? e.message : String(e)}` };
  }

  // QUIÉN PAGA (Agency Dashboard, 25/10/2026: «puedes elegir si el cobro se realiza ahí mismo con tu tarjeta, o si
  // quieres que lo pague tu cliente, y en dicho caso, al finalizar el onboarding de ese cliente debe saltar el cartel de
  // pago»). Se guarda en la cuenta del CLIENTE, que es quien lo lee para su cartel (lib/agency.ts). Si no se pudo
  // guardar, se dice y se sigue como si pagara la agencia: el link es el mismo, sólo cambia quién lo ve.
  let paga: QuienPaga = quienPagaDe(p.paga);
  if (paga === 'cliente') {
    try { await guardarQuienPaga(ws.id, 'cliente'); } catch (e) {
      console.warn(`[partners] cuenta ${ws.id}: no pude anotar que paga el cliente; queda pagando la agencia:`, e instanceof Error ? e.message : e);
      paga = 'agencia';
    }
  }

  // El primer mes, en el acto (#866): pagarlo la habilita. Su mes corre desde que termina el onboarding (#867). Si paga el
  // cliente, el link sale a SU email (la renovación del mes siguiente se la pide a él) y él lo ve en su cartel.
  // ⚠️ CON LA MENSUALIDAD PRENDIDA, NINGUNO (ticket #85, 11/11/2026): la agencia paga la entrada de su cliente por fuera de
  // MaKo y la habilita el super admin con ese pago. El link de Sellers se creó igual, quedó vivo después de la habilitación
  // —tapando «Inspeccionar»— y seguía cobrable: pagarlo era pagar el mismo mes dos veces. Sin link, queda «Cuenta pedida».
  const porPasarela = cobraPorPasarela(await mensualidadPrendida(p.agenciaWs));
  const cobro: ResultadoLinkCliente = porPasarela
    ? await linkPrimerMes({
      agenciaWs: p.agenciaWs, clienteWs: ws.id, nombreCliente: nombre,
      email: paga === 'cliente' ? correo : p.pagador, creadoPor: paga === 'cliente' ? `agencia para ${correo}` : (p.pagador ?? 'agencia'),
      plan, pais,
    })
    : { ok: false, motivo: 'Tu agencia paga por su mensualidad, por fuera de MaKo: la cuenta se habilita con ese pago.' };
  if (!cobro.ok && porPasarela) console.warn(`[partners] cuenta ${ws.id} de la agencia ${p.agenciaWs} sin link del primer mes: ${cobro.motivo}`);

  // ⚠️ SI PAGA EL CLIENTE, SU ACCESO SALE YA: tiene que entrar para hacer su onboarding, que es cuando le aparece el pago.
  // La agencia sigue sin entrar a su cuenta hasta que se pague (la cartera queda 'pendiente'): abrir cuentas sin pagar no
  // le da una cuenta gratis. Si paga la agencia, el acceso sale con la habilitación, como siempre (lib/agencia-habilitar.ts).
  // ⚠️ `invitarPorEmail` devuelve SIEMPRE un objeto, también si el mail no salió: lo que se mira es `enviado` (el aviso de
  // la pantalla lo arma `avisoInvitacion`).
  // ⚠️ Y SÓLO CON LINK DEL PRIMER MES (25/10/2026): sin él (MaKo sin Mercado Pago, sin precio en pesos, la pasarela que
  // falló) no hay cartel de pago que le salte al terminar el onboarding, y nada lo crea después: mandarle el acceso era
  // darle MaKo completo gratis para siempre. Sin link, queda esperando la firma como si pagara la agencia, y
  // lib/agencia-habilitar.ts le manda el acceso al habilitarla (`invitacion_enviada_at` sigue sin marcar).
  let acceso: ResultadoInvitacion | undefined;
  if (paga === 'cliente' && cobro.ok) {
    acceso = await invitarPorEmail({ email: correo, nombre, workspace: nombre, rolWs: 'admin' })
      .catch((e) => ({ enviado: false, error: e instanceof Error ? e.message : String(e), enlace: '' }));
  }
  return { ok: true, clienteWs: ws.id, link: cobro.ok ? cobro.link : null, sinLink: cobro.ok ? null : cobro.motivo, paga, acceso };
}

/** Para el super admin sin cliente: las agencias del programa y cuántas cuentas tiene cada una, por estado. */
export async function partnersDeLaPlataforma(): Promise<Array<{ ws: number; nombre: string; cuentas: Record<EstadoCartera, number> }>> {
  const [agencias, wss] = await Promise.all([agenciasHabilitadas(), listarWorkspaces().catch(() => [])]);
  const nombres = new Map(wss.map((w) => [w.id, w.nombre]));
  return Promise.all(agencias.map(async ({ ws }) => {
    const cuentas: Record<EstadoCartera, number> = { pendiente: 0, aprobado: 0, revocado: 0 };
    for (const f of await carteraDeAgencia(ws)) cuentas[estadoValido(f.estado)] += 1;
    return { ws, nombre: nombres.get(ws) ?? `Workspace ${ws}`, cuentas };
  }));
}
