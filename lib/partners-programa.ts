// =============================================================================
// partners-programa — MaKo Partners: el código, los referidos, el libro y la acreditación automática (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «el sistema de referidos con la página de MaKo Partners... que se gestione de manera
// automática... las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero tenés acumulado...
// y también si es que te ganaste meses gratuitos». Las reglas (DECIDIDAS el 10/10, docs/referidos.md) viven en
// lib/partners-reglas.ts; acá lo que lee y escribe:
//
//   · `codigoDe`: el código de cada negocio (se crea la primera vez, único, a partir de su nombre).
//   · `tableroDe`: lo que ve el partner — su link, sus referidos (en qué va cada uno), lo acumulado, lo usado, los meses
//     gratis y, si es revendedor, la plata a cobrar.
//   · `acreditarReferidos` (cron de la pasarela, idempotente): un referido es un negocio cuyo plan se COMPRÓ con el
//     código (`cobros.ref_codigo`, el link /r/<código>). Al llegar a su 2º mes pagado, un renglón en `partner_creditos`
//     por el primer mes de su plan a precio de lista; el índice único impide acreditarlo dos veces. Además deja el
//     referido en el negocio (`workspaces.referido_por_ws`, el primero vale) y manda las dos bienvenidas: al referido
//     («llegaste con el link de…») y al partner («se sumó…»).
//
// LO QUE QUEDA PARA DESPUÉS (docs/hallazgos-partners.md): APLICAR el crédito en la suscripción del partner (Stripe: saldo
// del cliente; Mercado Pago: el monto de la cuota) y el beneficio del que llega. El primer crédito madura con el 2º pago
// del primer referido: no antes de un mes del lanzamiento.
//
// ⚠️ Las tablas son de la PLATAFORMA (RLS sin acceso para anon/authenticated): todo con el cliente de servicio, y un
// negocio sólo lee SU tablero (`tableroDe(ws)` con el ws de la sesión).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { APP_BASE_URL, linkApp } from './app-url';
import { avisarDePlataforma } from './invitaciones';
import { formatoMonto } from './pasarela-moneda';
import {
  codigoDesdeNombre, contarPrograma, correspondeAcreditar, creditoDelReferido, estadoDelReferido, linkDePartner, resumenDelLibro,
  type EstadoReferido, type Resumen,
} from './partners-reglas';
import { cuotasDeLugares, cobrosDeLugares, vigenciaDe } from './plan-acceso';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** El código del negocio: el que tiene, o uno nuevo (único) a partir de su nombre. null si no se pudo (sin la mig 0330). */
export async function codigoDe(ws: number): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('partner_codigos').select('codigo').eq('workspace_id', ws).maybeSingle();
  if (error) { console.warn(`[partners] no pude leer el código del negocio ${ws}: ${error.message}`); return null; }
  if (data) return (data as { codigo: string }).codigo;
  const { data: w } = await db.from('workspaces').select('nombre').eq('id', ws).maybeSingle();
  const nombre = String((w as { nombre?: string } | null)?.nombre ?? 'partner');
  for (let i = 0; i < 6; i++) {
    const codigo = codigoDesdeNombre(nombre, i === 0 ? '' : String(ws * 7 + i).slice(-4));
    const { error: e } = await db.from('partner_codigos').insert({ workspace_id: ws, codigo });
    if (!e) return codigo;
    if (e.code !== '23505') { console.warn(`[partners] no pude crear el código del negocio ${ws}: ${e.message}`); return null; }
    // 23505: o ese código es de otro negocio (se prueba con sufijo), o este negocio ganó otra carrera (se relee).
    const { data: otra } = await db.from('partner_codigos').select('codigo').eq('workspace_id', ws).maybeSingle();
    if (otra) return (otra as { codigo: string }).codigo;
  }
  return null;
}

/**
 * ¿El negocio ya se unió a MaKo Partners? (24/10/2026, Martín: «La pagina de MaKo Partners DEBE ser siempre la landing al
 * menos que el usuario ya se haya registrado como partner, solo cuando se registre ahi aparece el dashboard»). Unirse ES
 * tener código: lo crea `codigoDe` cuando el admin toca «Unirme» (antes nacía con sólo abrir el tablero). Esto SÓLO lee:
 * nunca crea. null = todavía no se unió; si no se puede leer, tira (la página muestra la landing, y unirse otra vez no
 * duplica nada: `codigoDe` devuelve el que ya tiene).
 */
export async function codigoSiExiste(ws: number): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('codigo').eq('workspace_id', ws).maybeSingle();
  if (error) throw new Error(`No pude leer el código del negocio ${ws}: ${error.message}`);
  return data ? (data as { codigo: string }).codigo : null;
}

/** El negocio dueño de un código. */
async function wsDelCodigo(codigo: string): Promise<number | null> {
  const { data } = await getSupabaseServer().from('partner_codigos').select('workspace_id').eq('codigo', codigo).maybeSingle();
  return data ? Number((data as { workspace_id: number }).workspace_id) : null;
}

type Referido = { ws: number; nombre: string; desde: string; mesesPagados: number; estado: EstadoReferido; precioUsd: number | null };

export type Tablero = {
  codigo: string | null;
  link: string | null;
  referidos: Referido[];
  resumen: Resumen;
  /** Su propio plan (para contar los meses gratis); null = MaKo no se lo cobra por la pasarela. */
  precioPropioUsd: number | null;
  revendedor: boolean;
};

/** Los cobros de la plataforma comprados con ESTE código, ya con su negocio (los referidos). */
async function comprasConCodigo(plataforma: number, codigo: string): Promise<Array<{ alta_ws: number; monto_usd: number | null; created_at: string }>> {
  const { data, error } = await getSupabaseServer().from('cobros').select('alta_ws, monto_usd, created_at')
    .eq('workspace_id', plataforma).eq('ref_codigo', codigo).eq('alta_estado', 'hecha').not('alta_ws', 'is', null).order('created_at', { ascending: true }).limit(500);
  if (error) throw new Error(`No pude leer los referidos: ${error.message}`);
  return (data ?? []) as Array<{ alta_ws: number; monto_usd: number | null; created_at: string }>;
}

/** Meses pagados (cuotas cobradas) de cada negocio, con los cobros de la plataforma que pagan su lugar. */
async function mesesPagadosDe(plataforma: number, wss: readonly number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!wss.length) return out;
  const cobros = (await cobrosDeLugares(plataforma)).filter((c) => c.alta_ws != null && wss.includes(Number(c.alta_ws)));
  const cuotas = await cuotasDeLugares(plataforma, cobros.map((c) => c.id));
  const dueno = new Map(cobros.map((c) => [c.id, Number(c.alta_ws)]));
  for (const p of cuotas) {
    const ws = dueno.get(p.cobro_id);
    if (ws != null) out.set(ws, (out.get(ws) ?? 0) + 1);
  }
  return out;
}

/** El tablero de MaKo Partners de un negocio. */
export async function tableroDe(ws: number): Promise<Tablero> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const codigo = await codigoDe(ws);
  const [{ data: capa }, propio, libro] = await Promise.all([
    db.from('workspaces').select('capa').eq('id', ws).maybeSingle(),
    vigenciaDe(ws),
    db.from('partner_creditos').select('tipo, monto_usd, referido_ws').eq('referidor_ws', ws).order('created_at', { ascending: true }).limit(1000),
  ]);
  const revendedor = (capa as { capa?: string } | null)?.capa === 'agencia';
  const ultimo = propio?.cobros.filter((c) => c.tipo === 'suscripcion').sort((a, b) => b.id - a.id)[0];
  const precioPropioUsd = ultimo?.monto_usd != null ? Number(ultimo.monto_usd) : null;
  const renglones = ((libro.data ?? []) as Array<{ tipo: 'referido' | 'uso' | 'ajuste'; monto_usd: number; referido_ws: number | null }>);
  const acreditados = new Set(renglones.filter((r) => r.tipo === 'referido' && r.referido_ws != null).map((r) => Number(r.referido_ws)));

  let referidos: Referido[] = [];
  if (codigo) {
    const compras = (await comprasConCodigo(plataforma, codigo).catch(() => [])).filter((c) => Number(c.alta_ws) !== ws);
    const porWs = new Map<number, { desde: string; precio: number | null }>();
    for (const c of compras) if (!porWs.has(Number(c.alta_ws))) porWs.set(Number(c.alta_ws), { desde: c.created_at, precio: c.monto_usd != null ? Number(c.monto_usd) : null });
    const wss = [...porWs.keys()];
    const [meses, nombres] = await Promise.all([
      mesesPagadosDe(plataforma, wss).catch(() => new Map<number, number>()),
      wss.length ? db.from('workspaces').select('id, nombre, estado').in('id', wss) : Promise.resolve({ data: [] }),
    ]);
    const filas = new Map(((nombres.data ?? []) as Array<{ id: number; nombre: string; estado: string }>).map((w) => [Number(w.id), w]));
    referidos = wss.map((rws) => {
      const m = meses.get(rws) ?? 0;
      const w = filas.get(rws);
      return {
        ws: rws, nombre: w?.nombre ?? 'Un negocio', desde: porWs.get(rws)!.desde, mesesPagados: m, precioUsd: porWs.get(rws)!.precio,
        estado: estadoDelReferido({ mesesPagados: m, acreditado: acreditados.has(rws), vigente: w?.estado === 'activo' }),
      };
    });
  }
  return {
    codigo, link: codigo ? linkDePartner(APP_BASE_URL, codigo) : null, referidos,
    resumen: resumenDelLibro(renglones, { precioPropioUsd, revendedor }), precioPropioUsd, revendedor,
  };
}

/** Los admins de un negocio (para las bienvenidas). */
async function adminsDe(ws: number): Promise<Array<{ email: string; nombre: string | null }>> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, nombre, rol_ws').eq('workspace_id', ws).limit(20);
  return ((data ?? []) as Array<{ email: string | null; nombre: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => ({ email: u.email!.toLowerCase(), nombre: u.nombre }));
}

/**
 * Lo automático de MaKo Partners (lo corre el cron de la pasarela). Idempotente: cada paso mira su propia marca.
 *   1. Cada compra con código y negocio: el referido queda en el negocio (`referido_por_ws`, si no tenía) y, la primera
 *      vez, las dos bienvenidas (la marca es haber escrito `referido_por_ws`: compare-and-set sobre null).
 *   2. Con el 2º mes pagado: el crédito al partner (el índice único lo hace una sola vez) y su aviso.
 */
/** El programa entero, para el super admin (24/10/2026, Martín: «…y luego el dashboard, tanto de SuperAdmin como clientes»). */
export type ResumenPrograma = {
  /** Negocios que ya tienen su link (el código nace al abrir su tablero). */
  conLink: number;
  /** Negocios nuevos que entraron con un link (la compra que CREÓ la cuenta, como cuenta `acreditarReferidos`). */
  referidos: number;
  /** Lo acreditado a partners por sus referidos, en dólares (el libro, renglones `referido`). */
  acreditadoUsd: number;
  /** Los partners con algún referido o crédito, el que más trajo primero. */
  partners: Array<{ ws: number; nombre: string; referidos: number; acreditadoUsd: number }>;
  /** Alguna lectura llegó al tope: los números son «al menos». */
  truncado: boolean;
};

/** El resumen del programa entero. Sólo para el super admin: lee los libros de todos los negocios. */
export async function resumenDelPrograma(): Promise<ResumenPrograma> {
  const TOPE = 5000;
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const [codigos, compras, libro] = await Promise.all([
    db.from('partner_codigos').select('workspace_id, codigo').limit(TOPE),
    // El MISMO filtro que `acreditarReferidos`: la compra que creó la cuenta, pagada (o devuelta después).
    db.from('cobros').select('ref_codigo, alta_ws, created_at').eq('workspace_id', plataforma).not('ref_codigo', 'is', null)
      .eq('alta_estado', 'hecha').not('alta_ws', 'is', null).in('estado', ['pagado', 'reembolsado'])
      .order('created_at', { ascending: true }).limit(TOPE),
    db.from('partner_creditos').select('referidor_ws, tipo, monto_usd').eq('tipo', 'referido').limit(TOPE),
  ]);
  const error = codigos.error ?? compras.error ?? libro.error;
  if (error) throw new Error(`No pude leer el programa: ${error.message}`);
  // La cuenta es pura (lib/partners-reglas.ts, `contarPrograma`): un negocio nuevo cuenta UNA vez, para el primer código
  // que lo trajo, como `acreditarReferidos`, y nunca para sí mismo.
  const { conLink, referidos, acreditadoUsd, porPartner } = contarPrograma({
    plataforma,
    codigos: (codigos.data ?? []) as Array<{ workspace_id: number; codigo: string }>,
    compras: (compras.data ?? []) as Array<{ ref_codigo: string; alta_ws: number }>,
    creditos: (libro.data ?? []) as Array<{ referidor_ws: number; monto_usd: number }>,
  });
  const wss = [...porPartner.keys()];
  const { data: nombres } = wss.length ? await db.from('workspaces').select('id, nombre').in('id', wss) : { data: [] };
  const nombreDe = new Map(((nombres ?? []) as Array<{ id: number; nombre: string }>).map((w) => [Number(w.id), w.nombre]));
  const partners = wss
    .map((ws) => ({ ws, nombre: nombreDe.get(ws) ?? 'Un negocio', ...porPartner.get(ws)! }))
    .sort((a, b) => b.referidos - a.referidos || b.acreditadoUsd - a.acreditadoUsd);
  return {
    conLink,
    referidos,
    acreditadoUsd,
    partners,
    truncado: [codigos.data, compras.data, libro.data].some((d) => (d?.length ?? 0) >= TOPE),
  };
}

export async function acreditarReferidos(): Promise<{ vistos: number; atados: number; acreditados: number }> {
  const out = { vistos: 0, atados: 0, acreditados: 0 };
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const { data, error } = await db.from('cobros').select('alta_ws, ref_codigo, monto_usd, created_at')
    // Sólo clientes NUEVOS (docs/referidos.md): la compra que CREÓ la cuenta (alta hecha), nunca la de quien ya la tenía.
    .eq('workspace_id', plataforma).not('ref_codigo', 'is', null).not('alta_ws', 'is', null).eq('alta_estado', 'hecha')
    .in('estado', ['pagado', 'reembolsado']).order('created_at', { ascending: true }).limit(1000);
  if (error) { console.warn(`[partners] no pude leer las compras con código: ${error.message}`); return out; }
  // El PRIMERO vale: la compra más vieja de cada negocio decide quién lo refirió.
  const primero = new Map<number, { codigo: string; precio: number | null }>();
  for (const c of (data ?? []) as Array<{ alta_ws: number; ref_codigo: string; monto_usd: number | null }>) {
    if (!primero.has(Number(c.alta_ws))) primero.set(Number(c.alta_ws), { codigo: c.ref_codigo, precio: c.monto_usd != null ? Number(c.monto_usd) : null });
  }
  const meses = await mesesPagadosDe(plataforma, [...primero.keys()]).catch(() => new Map<number, number>());
  for (const [referido, { codigo, precio }] of primero) {
    out.vistos++;
    try {
      const referidor = await wsDelCodigo(codigo);
      if (referidor == null || referidor === referido || referidor === plataforma) continue;
      // 1. Atar y dar la bienvenida, una vez.
      const { data: atado } = await db.from('workspaces').update({ referido_por_ws: referidor }).eq('id', referido).is('referido_por_ws', null).select('id');
      if (atado?.length) {
        out.atados++;
        await bienvenidas(referidor, referido).catch((e) => console.warn(`[partners] bienvenidas ${referidor}→${referido}: ${msg(e)}`));
      }
      // 2. El crédito con el 2º mes pagado.
      const m = meses.get(referido) ?? 0;
      if (!correspondeAcreditar({ referidorWs: referidor, referidoWs: referido, mesesPagados: m, yaAcreditado: false }) || precio == null) continue;
      const monto = creditoDelReferido(precio);
      if (monto <= 0) continue;
      const { error: e2 } = await db.from('partner_creditos').insert({ referidor_ws: referidor, referido_ws: referido, tipo: 'referido', monto_usd: monto, nota: 'Su 2º mes pagado: el primer mes de su plan' });
      if (e2) { if (e2.code !== '23505') console.warn(`[partners] no pude acreditar ${referidor}←${referido}: ${e2.message}`); continue; }
      out.acreditados++;
      await avisarCredito(referidor, referido, monto).catch((e) => console.warn(`[partners] aviso del crédito ${referidor}: ${msg(e)}`));
    } catch (e) {
      console.warn(`[partners] referido ${referido}: ${msg(e)}`);
    }
  }
  return out;
}

async function nombreDe(ws: number): Promise<string> {
  const { data } = await getSupabaseServer().from('workspaces').select('nombre').eq('id', ws).maybeSingle();
  return String((data as { nombre?: string } | null)?.nombre ?? 'un negocio');
}

/** Las dos bienvenidas: al que llegó («te recomendó…») y al partner («se sumó…»). */
async function bienvenidas(referidor: number, referido: number): Promise<void> {
  const [quien, nuevo, aRef, aNuevo] = await Promise.all([nombreDe(referidor), nombreDe(referido), adminsDe(referidor), adminsDe(referido)]);
  for (const a of aNuevo) {
    await avisarDePlataforma({
      to: a.email, asunto: `Te damos la bienvenida a MaKo de parte de ${quien}`, preheader: 'Llegaste con su link de MaKo Partners.', tag: 'partners-bienvenida',
      cuerpo: [`Hola${a.nombre ? ` ${a.nombre.split(' ')[0]}` : ''},`, '', `Llegaste a MaKo con el link de ${quien}. ¡Qué bueno tenerte!`, '',
        'Cuando quieras recomendar MaKo, tu propio link está en MaKo Partners:', linkApp('/partners/referidos', referido)].join('\n'),
    });
  }
  for (const a of aRef) {
    await avisarDePlataforma({
      to: a.email, asunto: `${nuevo} se sumó a MaKo con tu link`, preheader: 'Tu referido ya tiene su cuenta.', tag: 'partners-nuevo-referido',
      cuerpo: [`Hola${a.nombre ? ` ${a.nombre.split(' ')[0]}` : ''},`, '', `${nuevo} se sumó a MaKo con tu link de MaKo Partners.`, '',
        'Cuando pague su segundo mes, se te suma su primer mes como crédito. Lo ves en tu tablero:', linkApp('/partners/referidos', referidor)].join('\n'),
    });
  }
}

async function avisarCredito(referidor: number, referido: number, monto: number): Promise<void> {
  const [nuevo, aRef] = await Promise.all([nombreDe(referido), adminsDe(referidor)]);
  for (const a of aRef) {
    await avisarDePlataforma({
      to: a.email, asunto: `Sumaste ${formatoMonto(monto, 'USD')} en MaKo Partners`, preheader: 'Tu referido pagó su segundo mes.', tag: 'partners-credito',
      cuerpo: [`Hola${a.nombre ? ` ${a.nombre.split(' ')[0]}` : ''},`, '', `${nuevo} pagó su segundo mes: se te suman ${formatoMonto(monto, 'USD')} de crédito.`, '',
        'Mira cuánto llevas acumulado:', linkApp('/partners/referidos', referidor)].join('\n'),
    });
  }
}
