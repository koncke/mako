// =============================================================================
// partners-programa — MaKo Partners: el alta, el código, los referidos, el libro y la acreditación automática (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «el sistema de referidos con la página de MaKo Partners... que se gestione de manera
// automática... las bienvenidas de las personas que vos referiste con el dashboard de cuánto dinero tenés acumulado». Desde
// el 25/10/2026 Partners paga SÓLO PLATA y, desde el 18/11/2026, una PARTE DE CADA PAGO de cada negocio que trae, todos los meses
// (30 % por Binance o transferencia, 25 % por pasarela: lib/partners-reglas.ts). Acá lo que lee y escribe:
//
//   · `altaDePartner` / `hacermePartner`: hacerse partner es terminar el alta (el setting `partners.alta`, con lo que
//     contestó: a cuántos quiere referir, cómo, y dónde se le transfiere). Ahí nace (o se reusa) su código.
//   · `tableroDe`: el panel del partner — su link y su código, las visitas al link, lo ganado, lo que tiene a cobrar, lo
//     ganado por mes, sus negocios (en qué va cada uno) y lo que MaKo ya le transfirió.
//   · `acreditarReferidos` (cron de la pasarela, idempotente): un referido es un negocio cuyo plan se COMPRÓ con el código
//     (`cobros.ref_codigo`: el link /r/<código> o el código escrito al pagar). UN renglón en `partner_creditos` por CADA pago
//     cobrado del negocio (`pagos`), con su canal; el índice único por pago (mig 0421) impide ganarlo dos veces. Lo ganado con la
//     regla vieja (el 100% del primer mes, al 2º pago) queda como está. Además deja el referido en el negocio (`workspaces.referido_por_ws`, el primero vale) y manda las dos bienvenidas.
//   · `resumenDelPrograma` / `registrarPagoAPartner`: el panel del super admin y su «Marcar pagado» (lo que MaKo transfirió,
//     un renglón `uso` en el libro).
//
// ⚠️ Las tablas son de la PLATAFORMA (RLS sin acceso para anon/authenticated): todo con el cliente de servicio, y un
// negocio sólo lee SU panel (`tableroDe(ws)` con el ws de la sesión).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { esClienteDeAgencia } from './agencia';
import { APP_BASE_URL, linkApp } from './app-url';
import { avisarDePlataforma } from './invitaciones';
import { formatoMonto } from './pasarela-moneda';
import { PLANES_MAKO_DEFAULT } from './planes-mako';
import {
  CLAVE_ALTA_PARTNERS, CLAVE_VISITAS_PARTNERS, COMISION_PARTNER_DIRECTO, COMISION_PARTNER_PASARELA, TEXTO_CODIGO_INVALIDO, altaLimpia, cadaMes,
  canalDelPago, codigoDesdeNombre, codigoNuevoValido, cobroLimpio, comisionDelPago, contarPrograma, creditosDeUnReferido, estadoDelReferido, esRobot,
  ganadoPorMes, leerAlta, leerVisitas, linkDePartner, precioDeListaPorMes, resumenDelLibro, seFueSegunSusCobros, sumarVisita,
  type AltaPartner, type EstadoReferido, type PagoDeReferido, type Renglon, type Resumen,
} from './partners-reglas';
import { cobrosDeLugares } from './plan-acceso';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const mesDe = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

/** El precio de lista por mes de un plan del catálogo (null = no es un plan conocido). */
const listaDe = (plan: string): number | null => PLANES_MAKO_DEFAULT.find((p) => p.id === plan)?.precioUsd ?? null;
const nombreDelPlan = (plan: string | null | undefined): string | null => (plan ? PLANES_MAKO_DEFAULT.find((p) => p.id === plan)?.nombre ?? null : null);
/**
 * La compra con SU plan de lista: el anotado (`plan_mako`) o, si no lo tiene (la venta a mano de /admin/cobros), el MÁS BARATO de
 * la capa que se vendió (`alta_capa`). Sin esto se acreditaba lo cobrado: un pago único de US$1.500 o un precio especial, entero
 * (revisión de plata del 29/10/2026, hallazgo 6). Así un partner nunca gana más que la lista.
 */
function conPlanDeLista<T extends { plan_mako: string | null; alta_capa?: string | null }>(c: T): T {
  if (c.plan_mako || !c.alta_capa) return c;
  // Una capa sin plan en el catálogo (p. ej. `pm`) se topea al plan más barato de todos (tercera pasada de la revisión).
  const porPrecio = [...PLANES_MAKO_DEFAULT].sort((a, b) => a.precioUsd - b.precioUsd);
  const plan = porPrecio.find((p) => p.capa === c.alta_capa) ?? porPrecio[0];
  return plan ? { ...c, plan_mako: plan.id } : c;
}

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
    // El de un partner que se fue y ya trajo compras no se hereda por el nombre (`codigoConCompras`): se prueba con sufijo.
    if (await codigoConCompras(codigo).catch(() => false)) continue;
    const { error: e } = await db.from('partner_codigos').insert({ workspace_id: ws, codigo });
    if (!e) return codigo;
    if (e.code !== '23505') { console.warn(`[partners] no pude crear el código del negocio ${ws}: ${e.message}`); return null; }
    // 23505: o ese código es de otro negocio (se prueba con sufijo), o este negocio ganó otra carrera (se relee).
    const { data: otra } = await db.from('partner_codigos').select('codigo').eq('workspace_id', ws).maybeSingle();
    if (otra) return (otra as { codigo: string }).codigo;
  }
  return null;
}

/** El código del negocio si ya lo tiene. SÓLO lee: nunca crea. Si no se puede leer, tira. */
export async function codigoSiExiste(ws: number): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('codigo').eq('workspace_id', ws).maybeSingle();
  if (error) throw new Error(`No pude leer el código del negocio ${ws}: ${error.message}`);
  return data ? (data as { codigo: string }).codigo : null;
}

// ── LOS CÓDIGOS ANTERIORES (27/10/2026, mig 0341): un partner puede cambiar su código, y lo de antes sigue contando ──────
// Los links /r/<viejo> que ya mandó, la cookie de quien ya entró y los cobros con `ref_codigo = <viejo>` son SUYOS: cada
// lectura que va de un código a un negocio mira primero el actual (`partner_codigos`) y después los que dejó
// (`partner_codigos_anteriores`). Sin la migración, la tabla no existe: los anteriores son ninguno y cambiar no se ofrece.

/**
 * El negocio que usaba ese código antes de cambiarlo, o null (también sin la mig 0341: la tabla que falta es «ninguno»).
 * ⚠️ OTRO ERROR TIRA (6/11/2026, la revisión del barrido): con el null de antes, una lectura caída hacía de un código viejo de un
 * partner un código MUERTO, y /r dejaba que el link de otro le pisara la cookie (`refQueVale`). «No pude leer» no es «no es de nadie».
 */
async function wsDeCodigoAnterior(codigo: string): Promise<number | null> {
  const { data, error } = await getSupabaseServer().from('partner_codigos_anteriores').select('workspace_id').eq('codigo', codigo).maybeSingle();
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null;
    throw new Error(`No pude leer los códigos anteriores (${codigo}): ${error.message}`);
  }
  return data ? Number((data as { workspace_id: number }).workspace_id) : null;
}

/** Los códigos que el negocio dejó de usar (ninguno sin la mig 0341). */
async function codigosAnterioresDe(ws: number): Promise<string[]> {
  const { data, error } = await getSupabaseServer().from('partner_codigos_anteriores').select('codigo').eq('workspace_id', ws).limit(50);
  return error ? [] : ((data ?? []) as Array<{ codigo: string }>).map((x) => x.codigo);
}

/**
 * ¿Ese código ya trajo COMPRAS (un cobro de la plataforma con `ref_codigo` = código)? (28/10/2026, la verificación de a196d5a93.)
 * `acreditarReferidos` resuelve el código en cada vuelta: un partner que tomaba el texto de otro que se fue (al borrar su negocio
 * se van sus códigos) heredaba sus referidos, las bienvenidas y el crédito. Con la 0341 ese texto se puede ELEGIR. Si no se puede
 * leer, tira.
 */
async function codigoConCompras(codigo: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('cobros').select('id').eq('workspace_id', await wsSuperAdmin()).eq('ref_codigo', codigo).limit(1);
  if (error) throw new Error(`No pude leer las compras con el código ${codigo}: ${error.message}`);
  return (data ?? []).length > 0;
}

/** ¿Es el código actual del negocio, o uno que dejó? Volver a uno suyo siempre se puede. */
async function esCodigoPropio(ws: number, codigo: string): Promise<boolean> {
  return (await codigoSiExiste(ws)) === codigo || (await codigosAnterioresDe(ws)).includes(codigo);
}

/** El negocio dueño de un código: el actual, o el que lo usaba antes de cambiarlo. */
async function wsDelCodigo(codigo: string): Promise<number | null> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('workspace_id').eq('codigo', codigo).maybeSingle();
  // «No pude leer» no es «no es de nadie» (6/11/2026): sin esto caía a los anteriores y daba null, y el referido se salteaba callado.
  if (error) throw new Error(`No pude leer el código ${codigo}: ${error.message}`);
  return data ? Number((data as { workspace_id: number }).workspace_id) : wsDeCodigoAnterior(codigo);
}

/**
 * El código que vale HOY para un link: el mismo si es el actual de alguien; el actual de su dueño si es uno que dejó; null si
 * no es de nadie. Lo usa /r/<código>: quien entra por un link viejo queda con la cookie del código nuevo.
 */
export async function codigoVigente(codigo: string): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error } = await db.from('partner_codigos').select('codigo').eq('codigo', codigo).maybeSingle();
  if (error) throw new Error(`No pude leer el código ${codigo}: ${error.message}`);
  if (data) return codigo;
  const ws = await wsDeCodigoAnterior(codigo);
  return ws == null ? null : codigoSiExiste(ws);
}

/**
 * Cambiar el código (Leila, Fathom 876470842-06): único entre los actuales y los anteriores de OTROS, atómico en la base
 * (`cambiar_codigo_partner`, mig 0341). El viejo sigue acreditándole. Sólo un partner (con alta) y nunca la plataforma.
 */
export async function cambiarCodigoPartner(ws: number, crudo: unknown): Promise<{ ok: true; codigo: string; link: string } | { ok: false; error: string }> {
  try {
    if (ws === (await wsSuperAdmin())) return { ok: false, error: 'MaKo no es partner de sí mismo.' };
    const v = codigoNuevoValido(crudo);
    if (!v.ok) return v;
    if (!(await altaDePartner(ws).catch(() => null))) return { ok: false, error: 'Todavía no eres partner: primero hazte partner en MaKo Partners.' };
    // Un código que ya trajo compras y no es suyo no se elige (`codigoConCompras`): heredaría referidos y crédito ajenos.
    if (!(await esCodigoPropio(ws, v.codigo)) && (await codigoConCompras(v.codigo))) return { ok: false, error: 'Ese código ya lo usa otro partner. Prueba con otro.' };
    const { data, error } = await getSupabaseServer().rpc('cambiar_codigo_partner', { p_ws: ws, p_nuevo: v.codigo });
    if (error) {
      // Sin la mig 0341 la función no existe: no se cambia nada (cambiar sin guardar el viejo le haría perder lo que ya mandó).
      console.warn(`[partners] no pude cambiar el código del negocio ${ws}: ${error.message}`);
      return { ok: false, error: 'Todavía no se puede cambiar el código. Prueba más tarde.' };
    }
    const r = String(data);
    if (r === 'ocupado') return { ok: false, error: 'Ese código ya lo usa otro partner. Prueba con otro.' };
    if (r === 'sin_codigo') return { ok: false, error: 'Todavía no tienes código. Prueba otra vez en un minuto.' };
    if (r !== 'ok' && r !== 'igual') return { ok: false, error: TEXTO_CODIGO_INVALIDO };
    return { ok: true, codigo: v.codigo, link: linkDePartner(APP_BASE_URL, v.codigo) };
  } catch (e) {
    console.warn(`[partners] no pude cambiar el código del negocio ${ws}: ${msg(e)}`);
    return { ok: false, error: 'No pudimos cambiar tu código. Prueba otra vez en un minuto.' };
  }
}

/**
 * ¿Es el código de un partner? Para el código que se escribe AL PAGAR (25/10/2026, Martín: «en la compra, en el carrito, esté
 * la opción de poner código de referido»): uno que no es de nadie se rechaza con un texto claro, en vez de guardarse y no
 * contar nunca. La plataforma no es partner. Si no se puede leer, tira (la ruta decide: la compra no se frena por esto).
 */
export async function esCodigoDePartner(codigo: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('workspace_id').eq('codigo', codigo).maybeSingle();
  if (error) throw new Error(`No pude leer el código ${codigo}: ${error.message}`);
  // Un código que el partner DEJÓ (27/10/2026) también vale: quien lo tiene anotado de antes no se queda afuera.
  const ws = data ? Number((data as { workspace_id: number }).workspace_id) : await wsDeCodigoAnterior(codigo);
  return ws != null && ws !== (await wsSuperAdmin());
}

// ── El setting del negocio, con el cliente de servicio (/r/<código> no tiene sesión) ──────────────────────────────────
async function leerSetting(ws: number, key: string): Promise<string | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', key).maybeSingle();
  if (error) throw new Error(`No pude leer ${key} del negocio ${ws}: ${error.message}`);
  return ((data as { value?: string } | null)?.value) ?? null;
}
async function guardarSetting(ws: number, key: string, value: string): Promise<void> {
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key, value, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) throw new Error(`No pude guardar ${key} del negocio ${ws}: ${error.message}`);
}

/**
 * ¿El negocio se hizo partner? (25/10/2026, Martín: «si alguien no se hizo "Partner", no le debe saltar abajo nada... del
 * dashboard»). Hacerse partner es TERMINAR EL ALTA, no tener código: hasta el 24/10 el código nacía con sólo abrir el
 * tablero. null = todavía no. Si no se puede leer, tira (la página muestra la landing: hacerse partner otra vez no duplica).
 */
export async function altaDePartner(ws: number): Promise<AltaPartner | null> {
  return leerAlta(await leerSetting(ws, CLAVE_ALTA_PARTNERS));
}

export type ResultadoAlta = { ok: true; codigo: string; link: string; alta: AltaPartner } | { ok: false; error: string };

/**
 * Terminar el alta (el último paso del onboarding corto, o `hacerme_partner` por la API): guarda lo que contestó y le da su
 * link (`codigoDe`: lo crea la primera vez y devuelve el mismo después). Hacerlo dos veces no duplica nada: se queda con la
 * fecha del primer alta y con las respuestas nuevas. La plataforma nunca es partner.
 *
 * CUALQUIER PLAN (29/10/2026; del 27/10 al 29/10 fue sólo MaKo Pro): las landings dicen «gratis» y «cualquier plan». El
 * cliente de una agencia, no: su cuenta la maneja su agencia (docs/hallazgos-partners.md).
 */
export async function hacermePartner(ws: number, respuestas: unknown): Promise<ResultadoAlta> {
  try {
    if (ws === (await wsSuperAdmin())) return { ok: false, error: 'MaKo no es partner de sí mismo.' };
    // El cliente de una AGENCIA no ve el programa (29/10/2026), y tampoco se hace partner por la API (revisión de plata, hallazgo 13).
    // ⚠️ Comparado contra `false` (P15, 30/10/2026): con el `null` («no pude leer la cartera») NO se hace partner. Es la misma
    //    guarda de la revisión de plata, y un `false` por una base caída la abriría justo cuando no se puede comprobar nada.
    if ((await esClienteDeAgencia(ws)) !== false) return { ok: false, error: 'Tu cuenta la maneja tu agencia: MaKo Partners no está para tu cuenta.' };
    const antes = await altaDePartner(ws).catch(() => null);
    // CUALQUIERA ES PARTNER (29/10/2026, alineado con las landings: «gratis», «cualquier plan»): ya no se frena al Essential.
    const codigo = await codigoDe(ws);
    if (!codigo) return { ok: false, error: 'No pudimos crear tu link. Prueba otra vez en un minuto.' };
    const alta = altaLimpia({ ...(respuestas && typeof respuestas === 'object' ? respuestas : {}), at: antes?.at });
    await guardarSetting(ws, CLAVE_ALTA_PARTNERS, JSON.stringify(alta));
    return { ok: true, codigo, link: linkDePartner(APP_BASE_URL, codigo), alta };
  } catch (e) {
    console.warn(`[partners] no pude hacer partner al negocio ${ws}: ${msg(e)}`);
    return { ok: false, error: 'No pudimos terminar tu alta. Prueba otra vez en un minuto.' };
  }
}

/** Dónde le transfiere MaKo (el panel, «Cambiar»; y la API). Sólo un partner: sin alta, no hay a quién pagarle. */
export async function cambiarCobroPartner(ws: number, cobro: unknown): Promise<{ ok: true; cobro: string | null } | { ok: false; error: string }> {
  try {
    const alta = await altaDePartner(ws);
    if (!alta) return { ok: false, error: 'Todavía no eres partner: primero hazte partner en MaKo Partners.' };
    const nuevo = { ...alta, cobro: cobroLimpio(cobro) };
    await guardarSetting(ws, CLAVE_ALTA_PARTNERS, JSON.stringify(nuevo));
    return { ok: true, cobro: nuevo.cobro };
  } catch (e) {
    console.warn(`[partners] no pude cambiar el cobro del negocio ${ws}: ${msg(e)}`);
    return { ok: false, error: 'No pudimos guardarlo. Prueba otra vez en un minuto.' };
  }
}

/**
 * Una visita al link (la cuenta /r/<código>, sin sesión). Sólo la primera vez que ese navegador lo abre (la ruta lo llama
 * cuando todavía no había cookie) y nunca un robot de vista previa (`esRobot`). Best-effort: si falla, el link igual lleva.
 * La suma no es atómica: dos visitas en el mismo instante pueden contar una (es un número del panel, no plata).
 */
export async function sumarVisitaAlLink(codigo: string, userAgent: string | null): Promise<void> {
  if (esRobot(userAgent)) return;
  const ws = await wsDelCodigo(codigo);
  if (ws == null) return;
  const v = leerVisitas(await leerSetting(ws, CLAVE_VISITAS_PARTNERS));
  await guardarSetting(ws, CLAVE_VISITAS_PARTNERS, JSON.stringify(sumarVisita(v, mesDe(Date.now()))));
}

type Referido = {
  ws: number; nombre: string; desde: string; mesesPagados: number; estado: EstadoReferido;
  /** Lo que le deja al partner CADA MES: su parte (30 % / 25 %) del precio de lista, con el canal de su último pago. null = no se sabe el precio. */
  mensualUsd: number | null;
  /** Lo que ya le dejó en total (los renglones `referido` de este negocio en el libro). */
  ganadoUsd: number;
  plan: string | null;
};

export type Tablero = {
  codigo: string | null;
  link: string | null;
  alta: AltaPartner | null;
  referidos: Referido[];
  resumen: Resumen & { cadaMesUsd: number };
  /** Quienes abrieron el link (la primera vez de cada navegador): el total y este mes. */
  visitas: { total: number; esteMes: number };
  /** Negocios que entraron este mes. */
  nuevosEsteMes: number;
  /** Lo ganado por mes, los últimos 6. */
  porMes: Array<{ mes: string; usd: number }>;
  /** Lo que MaKo ya le transfirió, lo último primero. */
  pagos: Array<{ fecha: string; montoUsd: number; nota: string | null }>;
};

type CompraConCodigo = { alta_ws: number; monto_usd: number | null; plan_mako: string | null; alta_capa?: string | null; meses?: number | null; created_at: string };

/**
 * La compra que TRAJO al negocio (filtro de PostgREST): la que creó la cuenta (alta 'hecha') o el cobro de «Empezar mi plan
 * ya» (lib/empezar-plan.ts), que reemplaza a esa prueba y hereda su código (25/10/2026, revisión del tren). Ése no crea la
 * cuenta ni se marca 'hecha' (le habilitaría el cambio de email del acceso), y al cobrarse la prueba queda 'anulado': sin
 * aceptarlo acá, el partner no cobraba nunca. Lo usan `acreditarReferidos` y `resumenDelPrograma`, con el MISMO filtro.
 */
const COMPRA_QUE_TRAJO = 'alta_estado.eq.hecha,creado_por.like.empezar-ya:*';

/** Los cobros de la plataforma comprados con ESTOS códigos (el actual y los que dejó), ya con su negocio (los referidos). */
async function comprasConCodigo(plataforma: number, codigos: readonly string[]): Promise<CompraConCodigo[]> {
  const { data, error } = await getSupabaseServer().from('cobros').select('alta_ws, monto_usd, plan_mako, alta_capa, meses, created_at')
    .eq('workspace_id', plataforma).in('ref_codigo', [...codigos]).eq('alta_estado', 'hecha').not('alta_ws', 'is', null).order('created_at', { ascending: true }).limit(500);
  if (error) throw new Error(`No pude leer los referidos: ${error.message}`);
  return (data ?? []) as CompraConCodigo[];
}

/**
 * Los PAGOS cobrados de cada negocio (`pagos` pagados de los cobros de la plataforma que pagan su lugar), con lo que entró en
 * dólares y por dónde: de acá sale cada crédito del partner y los meses pagados. Con `idos`, anota ahí los que se FUERON según
 * esos mismos cobros (`seFueSegunSusCobros`, 25/10/2026, ronda 2: con el corte de acceso apagado, `workspaces.estado` sigue
 * 'activo' aunque haya cancelado la prueba sin pagar, y el tablero lo contaba «en camino»).
 */
async function pagosDeLosReferidos(plataforma: number, wss: readonly number[], idos?: Set<number>): Promise<Map<number, PagoDeReferido[]>> {
  const out = new Map<number, PagoDeReferido[]>();
  if (!wss.length) return out;
  const cobros = (await cobrosDeLugares(plataforma)).filter((c) => c.alta_ws != null && wss.includes(Number(c.alta_ws)));
  const dueno = new Map(cobros.map((c) => [c.id, Number(c.alta_ws)]));
  const mesesDe = new Map(cobros.map((c) => [c.id, c.meses ?? null]));
  const db = getSupabaseServer();
  const ids = cobros.map((c) => c.id);
  // De a tandas y paginado (PostgREST corta en 1.000), como `cuotasDeLugares`.
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.from('pagos').select('id, cobro_id, monto_usd, fecha_pago, metodo, proveedor')
        .eq('workspace_id', plataforma).in('cobro_id', tanda).eq('pagado', true).order('id', { ascending: true }).range(desde, desde + 999);
      if (error) throw new Error(`No pude leer los pagos de los referidos: ${error.message}`);
      for (const p of (data ?? []) as Array<{ id: number; cobro_id: number; monto_usd: number | string | null; fecha_pago: string | null; metodo: string | null; proveedor: string | null }>) {
        const ws = dueno.get(p.cobro_id);
        if (ws == null) continue;
        const lista = out.get(ws) ?? [];
        lista.push({ id: Number(p.id), montoUsd: p.monto_usd == null ? null : Number(p.monto_usd), fecha: String(p.fecha_pago ?? '').slice(0, 10), metodo: p.metodo, proveedor: p.proveedor, meses: mesesDe.get(p.cobro_id) ?? null });
        out.set(ws, lista);
      }
      if ((data ?? []).length < 1000) break;
    }
  }
  if (idos) for (const ws of wss) if (seFueSegunSusCobros(cobros.filter((c) => Number(c.alta_ws) === ws))) idos.add(ws);
  return out;
}

/** El panel de MaKo Partners de un negocio. */
export async function tableroDe(ws: number): Promise<Tablero> {
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const [codigo, alta, visitasRaw, libro] = await Promise.all([
    codigoSiExiste(ws),
    altaDePartner(ws).catch(() => null),
    leerSetting(ws, CLAVE_VISITAS_PARTNERS).catch(() => null),
    db.from('partner_creditos').select('tipo, monto_usd, referido_ws, nota, created_at').eq('referidor_ws', ws).order('created_at', { ascending: true }).limit(2000),
  ]);
  if (libro.error) throw new Error(`No pude leer lo ganado: ${libro.error.message}`);
  const renglones = (libro.data ?? []) as Array<Renglon & { referido_ws: number | null; nota: string | null; created_at: string }>;
  // Lo que cada negocio le dejó al partner (todos sus renglones `referido`: el viejo y los de cada pago).
  const ganadoDe = new Map<number, number>();
  for (const r of renglones) if (r.tipo === 'referido' && r.referido_ws != null) ganadoDe.set(Number(r.referido_ws), (ganadoDe.get(Number(r.referido_ws)) ?? 0) + (Number(r.monto_usd) || 0));

  let referidos: Referido[] = [];
  if (codigo) {
    // Con los códigos que dejó (27/10/2026): lo que trajo antes de cambiarlo sigue siendo suyo.
    const compras = (await comprasConCodigo(plataforma, [codigo, ...(await codigosAnterioresDe(ws))])).filter((c) => Number(c.alta_ws) !== ws);
    const porWs = new Map<number, CompraConCodigo>();
    for (const c of compras) if (!porWs.has(Number(c.alta_ws))) porWs.set(Number(c.alta_ws), c);
    const wss = [...porWs.keys()];
    const idos = new Set<number>();
    const [pagosDe, nombres] = await Promise.all([
      pagosDeLosReferidos(plataforma, wss, idos).catch(() => new Map<number, PagoDeReferido[]>()),
      wss.length ? db.from('workspaces').select('id, nombre, estado').in('id', wss) : Promise.resolve({ data: [] }),
    ]);
    const filas = new Map(((nombres.data ?? []) as Array<{ id: number; nombre: string; estado: string }>).map((w) => [Number(w.id), w]));
    referidos = wss.map((rws) => {
      const pagos = pagosDe.get(rws) ?? [];
      const m = pagos.length;
      const w = filas.get(rws);
      const c = porWs.get(rws)!;
      const precio = precioDeListaPorMes(conPlanDeLista(c), listaDe);
      // El canal de su ÚLTIMO pago decide qué porcentaje deja cada mes; sin pagos, el menor (no se promete de más).
      const ultimo = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)[0];
      return {
        ws: rws, nombre: w?.nombre ?? 'Un negocio', desde: c.created_at, mesesPagados: m, plan: nombreDelPlan(c.plan_mako),
        mensualUsd: precio != null ? comisionDelPago(precio, ultimo ? canalDelPago(ultimo) : 'pasarela') : null,
        ganadoUsd: Math.round((ganadoDe.get(rws) ?? 0) * 100) / 100,
        // Vigente: su negocio sin pausar Y sus cobros vivos (`idos`): con el corte apagado, nadie pausa al que se fue sin pagar.
        estado: estadoDelReferido({ mesesPagados: m, vigente: w?.estado === 'activo' && !idos.has(rws) }),
      };
    }).sort((a, b) => b.desde.localeCompare(a.desde));
  }
  const v = leerVisitas(visitasRaw);
  const esteMes = mesDe(Date.now());
  return {
    codigo, link: codigo ? linkDePartner(APP_BASE_URL, codigo) : null, alta, referidos,
    resumen: { ...resumenDelLibro(renglones), cadaMesUsd: cadaMes(referidos) },
    visitas: { total: v.total, esteMes: v.meses[esteMes] ?? 0 },
    nuevosEsteMes: referidos.filter((r) => r.desde.slice(0, 7) === esteMes).length,
    porMes: ganadoPorMes(renglones, esteMes),
    pagos: renglones.filter((r) => r.tipo === 'uso').map((r) => ({ fecha: r.created_at, montoUsd: Math.abs(Number(r.monto_usd) || 0), nota: r.nota })).reverse(),
  };
}

/** Los admins de un negocio (para las bienvenidas y los avisos). */
async function adminsDe(ws: number): Promise<Array<{ email: string; nombre: string | null }>> {
  const { data } = await getSupabaseServer().from('usuarios').select('email, nombre, rol_ws').eq('workspace_id', ws).limit(20);
  return ((data ?? []) as Array<{ email: string | null; nombre: string | null; rol_ws: string | null }>)
    .filter((u) => u.email && (u.rol_ws === 'admin' || u.rol_ws == null)).map((u) => ({ email: u.email!.toLowerCase(), nombre: u.nombre }));
}

/** Un partner del programa, como lo ve el super admin. */
export type PartnerDelPrograma = {
  ws: number; nombre: string;
  /** Cuándo se hizo partner (null: tiene referidos o pagos de antes del alta). */
  desde: string | null;
  referidos: number; ganadoUsd: number; pagadoUsd: number; aCobrarUsd: number;
  /** Dónde se le transfiere (lo que dejó en su alta). */
  cobro: string | null;
  codigo: string | null;
};

/** El programa entero, para el super admin (24/10/2026, Martín: «…y luego el dashboard, tanto de SuperAdmin como clientes»). */
export type ResumenPrograma = {
  /** Los negocios que se hicieron partner (terminaron el alta). */
  partners: number;
  /** Los que se hicieron partner este mes. */
  partnersEsteMes: number;
  /** Negocios nuevos que entraron con un link o un código (la compra que los trajo, `COMPRA_QUE_TRAJO`, como `acreditarReferidos`). */
  referidos: number;
  /** Lo que ganaron los partners, lo que MaKo ya les transfirió y lo que falta transferir. */
  ganadoUsd: number; pagadoUsd: number; aPagarUsd: number;
  /** Lo ganado por los partners, por mes (los últimos 6). */
  porMes: Array<{ mes: string; usd: number }>;
  /** Los partners: primero a quién hay que pagarle, después el que más trajo. */
  lista: PartnerDelPrograma[];
  /** Alguna lectura llegó al tope: los números son «al menos». */
  truncado: boolean;
};

/** El resumen del programa entero. Sólo para el super admin: lee los libros de todos los negocios. */
export async function resumenDelPrograma(): Promise<ResumenPrograma> {
  const TOPE = 5000;
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const [altas, codigos, anteriores, compras, libro] = await Promise.all([
    db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_ALTA_PARTNERS).limit(TOPE),
    db.from('partner_codigos').select('workspace_id, codigo').limit(TOPE),
    // Los que cada partner dejó (mig 0341): una compra con el código viejo sigue contando para él. Sin la migración, ninguno.
    db.from('partner_codigos_anteriores').select('workspace_id, codigo').limit(TOPE),
    // El MISMO filtro que `acreditarReferidos`: la compra que TRAJO al negocio (`COMPRA_QUE_TRAJO`: la que creó la cuenta o
    // la de «Empezar mi plan ya» que la reemplaza), pagada (o devuelta después).
    db.from('cobros').select('ref_codigo, alta_ws, created_at').eq('workspace_id', plataforma).not('ref_codigo', 'is', null)
      .or(COMPRA_QUE_TRAJO).not('alta_ws', 'is', null).in('estado', ['pagado', 'reembolsado'])
      .order('created_at', { ascending: true }).limit(TOPE),
    db.from('partner_creditos').select('referidor_ws, tipo, monto_usd, created_at').limit(TOPE),
  ]);
  const error = altas.error ?? codigos.error ?? compras.error ?? libro.error;
  if (error) throw new Error(`No pude leer el programa: ${error.message}`);
  const altaDe = new Map<number, AltaPartner>();
  for (const f of (altas.data ?? []) as Array<{ workspace_id: number; value: string }>) {
    const a = leerAlta(f.value);
    if (a) altaDe.set(Number(f.workspace_id), a);
  }
  const listaCodigos = (codigos.data ?? []) as Array<{ workspace_id: number; codigo: string }>;
  const renglones = (libro.data ?? []) as Array<Renglon & { referidor_ws: number; created_at: string }>;
  // La cuenta es pura (lib/partners-reglas.ts, `contarPrograma`): un negocio nuevo cuenta UNA vez, para el primer código
  // que lo trajo, como `acreditarReferidos`, y nunca para sí mismo.
  const listaAnteriores = anteriores.error ? [] : (anteriores.data ?? []) as Array<{ workspace_id: number; codigo: string }>;
  const c = contarPrograma({
    plataforma, altas: [...altaDe.keys()], codigos: [...listaCodigos, ...listaAnteriores],
    compras: (compras.data ?? []) as Array<{ ref_codigo: string; alta_ws: number }>, libro: renglones,
  });
  const wss = [...c.porPartner.keys()];
  const { data: nombres } = wss.length ? await db.from('workspaces').select('id, nombre').in('id', wss) : { data: [] };
  const nombreDe = new Map(((nombres ?? []) as Array<{ id: number; nombre: string }>).map((w) => [Number(w.id), w.nombre]));
  const codigoDeWs = new Map(listaCodigos.map((x) => [Number(x.workspace_id), x.codigo]));
  const lista = wss
    .map((ws) => ({
      ws, nombre: nombreDe.get(ws) ?? 'Un negocio', desde: altaDe.get(ws)?.at ?? null, cobro: altaDe.get(ws)?.cobro ?? null,
      codigo: codigoDeWs.get(ws) ?? null, ...c.porPartner.get(ws)!,
    }))
    .sort((a, b) => b.aCobrarUsd - a.aCobrarUsd || b.referidos - a.referidos || b.ganadoUsd - a.ganadoUsd);
  const esteMes = mesDe(Date.now());
  return {
    partners: c.partners,
    partnersEsteMes: [...altaDe.entries()].filter(([ws, a]) => ws !== plataforma && a.at.slice(0, 7) === esteMes).length,
    referidos: c.referidos, ganadoUsd: c.ganadoUsd, pagadoUsd: c.pagadoUsd, aPagarUsd: c.aPagarUsd,
    porMes: ganadoPorMes(renglones.filter((r) => Number(r.referidor_ws) !== plataforma), esteMes),
    lista,
    truncado: [altas.data, codigos.data, compras.data, libro.data].some((d) => (d?.length ?? 0) >= TOPE),
  };
}

/**
 * «Marcar pagado» del super admin (25/10/2026): MaKo le transfirió a un partner lo que tenía a cobrar (o una parte). Es un
 * renglón `uso` (negativo) en su libro y un aviso por email al partner. NO mueve plata: anota la transferencia que ya se hizo
 * afuera. Nunca más de lo que tiene a cobrar.
 */
export async function registrarPagoAPartner(p: { ws: number; montoUsd?: number | null; nota?: string | null; autor: string }): Promise<
  { ok: true; montoUsd: number; resumen: string } | { ok: false; error: string }
> {
  try {
    if (p.ws === (await wsSuperAdmin())) return { ok: false, error: 'MaKo no es partner de sí mismo.' };
    const db = getSupabaseServer();
    const { data, error } = await db.from('partner_creditos').select('tipo, monto_usd').eq('referidor_ws', p.ws).limit(2000);
    if (error) return { ok: false, error: `No pude leer lo que tiene a cobrar: ${error.message}` };
    const { aCobrarUsd } = resumenDelLibro((data ?? []) as Renglon[]);
    if (!(aCobrarUsd > 0)) return { ok: false, error: 'Ese partner no tiene nada a cobrar.' };
    const monto = Math.round(Number(p.montoUsd ?? aCobrarUsd) * 100) / 100;
    if (!(monto > 0) || monto > aCobrarUsd) return { ok: false, error: `El pago tiene que ser de más de 0 y de hasta ${formatoMonto(aCobrarUsd, 'USD')}, lo que tiene a cobrar.` };
    const nota = [`Transferido por ${p.autor}`, cobroLimpio(p.nota)].filter(Boolean).join(' · ').slice(0, 300);
    const { error: e2 } = await db.from('partner_creditos').insert({ referidor_ws: p.ws, tipo: 'uso', monto_usd: -monto, nota });
    if (e2) return { ok: false, error: `No pude anotar el pago: ${e2.message}` };
    await avisarPago(p.ws, monto).catch((e) => console.warn(`[partners] aviso del pago a ${p.ws}: ${msg(e)}`));
    return { ok: true, montoUsd: monto, resumen: `Anotado: le transferiste ${formatoMonto(monto, 'USD')}.` };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Lo automático de MaKo Partners (lo corre el cron de la pasarela). Idempotente: cada paso mira su propia marca.
 *   1. Cada compra con código y negocio: el referido queda en el negocio (`referido_por_ws`, si no tenía) y, la primera
 *      vez, las dos bienvenidas (la marca es haber escrito `referido_por_ws`: compare-and-set sobre null).
 *   2. UN crédito por cada pago cobrado del negocio (18/11/2026): su parte, 30 % o 27 % según el canal del pago (el índice único
 *      por pago, mig 0421, lo hace una sola vez) y un aviso por referido con lo de esa corrida. Sin la 0421 no acredita nada.
 */
export async function acreditarReferidos(): Promise<{ vistos: number; atados: number; acreditados: number }> {
  const out = { vistos: 0, atados: 0, acreditados: 0 };
  const plataforma = await wsSuperAdmin();
  const db = getSupabaseServer();
  const { data, error } = await db.from('cobros').select('alta_ws, ref_codigo, monto_usd, plan_mako, alta_capa, meses, created_at')
    // Sólo clientes NUEVOS (docs/referidos.md): la compra que CREÓ la cuenta (alta hecha), nunca la de quien ya la tenía; o
    // la de «Empezar mi plan ya», que reemplaza a esa prueba con su mismo código (`COMPRA_QUE_TRAJO`, 25/10/2026).
    .eq('workspace_id', plataforma).not('ref_codigo', 'is', null).not('alta_ws', 'is', null).or(COMPRA_QUE_TRAJO)
    .in('estado', ['pagado', 'reembolsado']).order('created_at', { ascending: true }).limit(1000);
  if (error) { console.warn(`[partners] no pude leer las compras con código: ${error.message}`); return out; }
  // El PRIMERO vale: la compra más vieja de cada negocio decide quién lo refirió.
  const primero = new Map<number, { codigo: string; precio: number | null }>();
  for (const c of (data ?? []) as Array<CompraConCodigo & { ref_codigo: string }>) {
    // El precio de LISTA por mes de su plan: el tope de lo que cuenta de cada pago (`creditosDeUnReferido`).
    if (!primero.has(Number(c.alta_ws))) primero.set(Number(c.alta_ws), { codigo: c.ref_codigo, precio: precioDeListaPorMes(conPlanDeLista(c), listaDe) });
  }
  const pagosDe = await pagosDeLosReferidos(plataforma, [...primero.keys()]).catch((e) => { console.warn(`[partners] no pude leer los pagos de los referidos: ${msg(e)}`); return null; });
  // Lo ya acreditado, de una lectura. Si no se puede leer (o falta la 0421: sin `pago_id` no hay cómo no acreditar dos veces) no
  // se acredita NADA: nunca de más.
  let previo: Array<{ referidor_ws: number; referido_ws: number; pago_id: number | null }> | null = null;
  if (primero.size) {
    const r = await db.from('partner_creditos').select('referidor_ws, referido_ws, pago_id').eq('tipo', 'referido').in('referido_ws', [...primero.keys()]).limit(10000);
    if (r.error) console.warn(`[partners] no acredito por pago: no pude leer lo ya acreditado (${r.error.message}). ¿Falta la migración 0421?`);
    else previo = (r.data ?? []) as typeof previo;
  }
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
      // 2. Un crédito por cada pago cobrado que todavía no tiene el suyo.
      if (!pagosDe || !previo) continue;
      const suyos = previo.filter((f) => Number(f.referido_ws) === referido && Number(f.referidor_ws) === referidor);
      const { acreditar, sinMonto } = creditosDeUnReferido({
        pagos: (pagosDe.get(referido) ?? []).map((p) => ({ ...p, topeUsd: precio != null ? Math.round(precio * (p.meses && p.meses > 0 ? p.meses : 1) * 100) / 100 : null })),
        yaAcreditados: new Set(suyos.filter((f) => f.pago_id != null).map((f) => Number(f.pago_id))),
        teniaCreditoViejo: suyos.some((f) => f.pago_id == null),
      });
      if (sinMonto.length) console.warn(`[partners] el negocio ${referido} tiene pagos sin monto en dólares (${sinMonto.join(', ')}): no se acreditan hasta que lo tengan`);
      let ganado = 0;
      let cuantos = 0;
      for (const cr of acreditar) {
        if (!(cr.comisionUsd > 0)) continue;
        const pct = Math.round((cr.canal === 'directo' ? COMISION_PARTNER_DIRECTO : COMISION_PARTNER_PASARELA) * 100);
        const { error: e2 } = await db.from('partner_creditos').insert({
          referidor_ws: referidor, referido_ws: referido, tipo: 'referido', monto_usd: cr.comisionUsd, pago_id: cr.pagoId, canal: cr.canal,
          nota: `Su pago de ${formatoMonto(cr.pagoUsd, 'USD')}${cr.topado ? ' (tope: el precio de lista)' : ''} (${cr.canal === 'directo' ? 'Binance o transferencia' : 'pasarela'}): el ${pct} %`,
        });
        if (e2) { if (e2.code !== '23505') console.warn(`[partners] no pude acreditar ${referidor}←${referido} (pago ${cr.pagoId}): ${e2.message}`); continue; }
        out.acreditados++; ganado += cr.comisionUsd; cuantos++;
      }
      if (cuantos) await avisarGanado(referidor, referido, Math.round(ganado * 100) / 100, cuantos).catch((e) => console.warn(`[partners] aviso de lo ganado ${referidor}: ${msg(e)}`));
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

const hola = (nombre: string | null) => `Hola${nombre ? ` ${nombre.split(' ')[0]}` : ''},`;
const PCT_DIRECTO = `${Math.round(COMISION_PARTNER_DIRECTO * 100)} %`;
const PCT_PASARELA = `${Math.round(COMISION_PARTNER_PASARELA * 100)} %`;

/** Las dos bienvenidas: al que llegó («te recomendó…») y al partner («se sumó…»). */
async function bienvenidas(referidor: number, referido: number): Promise<void> {
  const [quien, nuevo, aRef, aNuevo] = await Promise.all([nombreDe(referidor), nombreDe(referido), adminsDe(referidor), adminsDe(referido)]);
  for (const a of aNuevo) {
    await avisarDePlataforma({
      to: a.email, asunto: `Te damos la bienvenida a MaKo de parte de ${quien}`, preheader: 'Llegaste con su link de MaKo Partners.', tag: 'partners-bienvenida',
      cuerpo: [hola(a.nombre), '', `Llegaste a MaKo con el link de ${quien}. ¡Qué bueno tenerte!`, '',
        `Si tú también recomiendas MaKo, te llevas el ${PCT_DIRECTO} de cada pago de cada negocio que traigas, todos los meses. Hazte partner aquí:`,
        linkApp('/partners', referido)].join('\n'),
    });
  }
  const gana = `te llevas el ${PCT_DIRECTO} de lo que pague si paga por Binance o transferencia, y el ${PCT_PASARELA} si paga con tarjeta o link de pago`;
  for (const a of aRef) {
    await avisarDePlataforma({
      to: a.email, asunto: `${nuevo} se sumó a MaKo con tu link`, preheader: 'Tu referido ya tiene su cuenta.', tag: 'partners-nuevo-referido',
      cuerpo: [hola(a.nombre), '', `${nuevo} se sumó a MaKo con tu link de MaKo Partners.`, '',
        `Cada vez que pague su mensualidad, ${gana}. Y se repite todos los meses mientras pague. Lo ves en tu panel:`, linkApp('/partners', referidor)].join('\n'),
    });
  }
}

async function avisarGanado(referidor: number, referido: number, monto: number, pagos: number): Promise<void> {
  const [nuevo, aRef] = await Promise.all([nombreDe(referido), adminsDe(referidor)]);
  for (const a of aRef) {
    await avisarDePlataforma({
      to: a.email, asunto: `Ganaste ${formatoMonto(monto, 'USD')} en MaKo Partners`, preheader: pagos === 1 ? 'Tu referido pagó su mensualidad.' : `Tu referido pagó ${pagos} mensualidades.`, tag: 'partners-credito',
      cuerpo: [hola(a.nombre), '', pagos === 1 ? `${nuevo} pagó su mensualidad: ganaste ${formatoMonto(monto, 'USD')}, tu parte de ese pago.` : `${nuevo} pagó ${pagos} mensualidades: ganaste ${formatoMonto(monto, 'USD')} en total, tu parte de esos pagos.`, '',
        'Ya está a cobrar en tu panel:', linkApp('/partners', referidor)].join('\n'),
    });
  }
}

async function avisarPago(ws: number, monto: number): Promise<void> {
  for (const a of await adminsDe(ws)) {
    await avisarDePlataforma({
      to: a.email, asunto: `Te transferimos ${formatoMonto(monto, 'USD')} de MaKo Partners`, preheader: 'Lo que ganaste recomendando MaKo.', tag: 'partners-pago',
      cuerpo: [hola(a.nombre), '', `Te transferimos ${formatoMonto(monto, 'USD')}: lo que ganaste recomendando MaKo.`, '',
        'Tus cobros están en tu panel:', linkApp('/partners', ws)].join('\n'),
    });
  }
}
