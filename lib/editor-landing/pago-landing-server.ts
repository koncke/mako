// =============================================================================
// editor-landing/pago-landing-server — el «Botón de pago» contra la base y la pasarela
// =============================================================================
// Tanda 4 (14/10/2026). Lo que decide vive en pago-landing.ts y pago-pedido.ts (puros, con test); acá
// sólo se lee y se escribe: la landing PUBLICADA (por slug, cliente crudo), el catálogo y las pasarelas
// del workspace DE LA LANDING, el techo y el candado (`landing_pago_pedidos`, mig 0276), la propuesta
// cuando no se puede cobrar, el lead de ese email (o uno nuevo por el mismo camino que el opt-in), y el
// cobro (`crearCobro`, lib/cobros.ts: el único escritor de `cobros`).
//
// ⚠️ SIN SESIÓN: lo llaman el paso público (app/l/[slug]/pagar/[bloque]) y el POST público
//    (app/api/landing-generator/pagar). El workspace sale de la FILA de la landing, nunca de un
//    parámetro (nada de `?ws=`), y todo lo que lee o escribe del negocio corre adentro de
//    `runWithWorkspace(ws, …)`: sin el contexto, `getTenantDb` caería al ws1 (Mauricio, un cliente).
// ⚠️ LO QUE NUNCA SALE DEL PEDIDO: el monto, la moneda, el valor en dólares y el alta de MaKo
//    (`altaCapa`). Del pedido salen el slug, el producto (que la foto PUBLICADA tiene que ofrecer),
//    el nombre y el email. Y desde una landing NO se pasa `altaCapa` a `crearCobro`: un cobro de una
//    landing no da de alta una cuenta de MaKo, ni siquiera en la landing de la plataforma — vender un
//    plan de MaKo es /admin/cobros, donde el super admin elige el plan (decisión escrita, pendiente de
//    Martín si quisiera lo contrario).
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseServer } from '../supabase';
import { getTenantDb, runWithWorkspace } from '../workspace';
import { urlPublicaLanding } from '../app-url';
import { listProductos } from '../productos';
import { createLead, logLeadEvent } from '../leads';
import { emailComparable, esLeadDuplicado } from '../leads-duplicados';
import { idDelFunnelDefault } from '../funnels';
import { funnelPrincipalDeLanding } from '../landing-funnel';
import { casaParaEscribir } from '../lead-funnel-reglas';
import { crearCobro, linkDelCobro, listarCobros, pasarelasConectadas } from '../cobros';
import { crearPropuesta } from '../propuestas';
import { slugValido } from './doc';
import { leerFoto } from './server-reglas';
import { sanearConfig } from './validar';
import { temaPorId, estiloDeTema, type Tema } from './temas';
import { urlsDeFuentes } from './pagina-publica';
import { TEXTO_NO_COBRA, productosDeFoto, type EstadoCobroLanding, type MotivoNoCobra, type ProductoDePago } from './pago-landing';
import { creadoPorLanding, ejecutarPago, leadPorEmail, type DepCandado, type ResultadoPago } from './pago-pedido';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─────────────────────────────────────────────────────────────────────────────
// Lecturas
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que el paso y el POST necesitan de una landing publicada. */
export type LandingDePago = {
  ws: number;
  docId: number;
  slug: string;
  titulo: string;
  /** El nombre del sitio (o el título de la landing): la línea chica de arriba del paso. */
  sitio: string;
  temaId: string;
  fuentes: string[];
  /** Los productos que cobran sus botones, congelados al publicar. */
  productos: number[];
};

/**
 * La landing PUBLICADA de ese slug, o null si no se sirve (no existe, despublicada, pausada, en la
 * papelera). Estricto: un error de base TIRA (la ruta contesta 503, nunca 404: «no pude leer» no es
 * «no existe»). Lee la fila CRUDA porque `leerFoto` no copia `pagos` (como `htmlLibre`).
 */
export async function leerLandingDePago(slug: string): Promise<LandingDePago | null> {
  if (!slugValido(slug)) return null;
  const { data, error } = await getSupabaseServer().from('landing_docs')
    .select('id, workspace_id, titulo, publicado, sitio_activo, papelera_at')
    .eq('slug', slug).maybeSingle();
  if (error) throw new Error(`No pude leer la landing ${slug}: ${error.message}`);
  const f = data as { id: number; workspace_id: number; titulo: string | null; publicado: unknown; sitio_activo: boolean; papelera_at: string | null } | null;
  if (!f || !f.publicado || !f.sitio_activo || f.papelera_at) return null;
  const foto = leerFoto(f.publicado);
  if (!foto) return null;
  const config = sanearConfig(foto.config).config;
  const titulo = (f.titulo ?? '').trim() || slug;
  return {
    ws: Number(f.workspace_id),
    docId: Number(f.id),
    slug,
    titulo,
    sitio: (config.sitio.nombre ?? '').trim() || titulo,
    temaId: config.tema,
    fuentes: urlsDeFuentes(foto.fuentes),
    productos: productosDeFoto(f.publicado),
  };
}

/**
 * El tema de la landing para el paso. Con los temas PROPIOS del workspace si se pueden leer; si la
 * lectura falla, el de la casa con ese id (o el default): el paso se dibuja igual, sólo que sin el tema.
 */
export async function temaDelPaso(ws: number, temaId: string): Promise<{ tema: Tema; estilo: string }> {
  let tema: Tema;
  try {
    const { temasPropiosDe } = await import('./server');
    tema = temaPorId(temaId, await temasPropiosDe(ws));
  } catch (e) {
    console.warn(`[landing-pagar] ws=${ws} no pude leer los temas propios: ${msg(e)}`);
    tema = temaPorId(temaId);
  }
  let estilo = '';
  try { estilo = String(estiloDeTema(tema) ?? ''); } catch { estilo = ''; }
  return { tema, estilo };
}

/**
 * Las pasarelas conectadas y los productos ACTIVOS del catálogo de ESE workspace. Lo usan el editor
 * (la acción `cobro` de /api/landing-generator: el control del botón y el aviso de Publicar), el paso
 * y el POST. Tira si no se puede leer.
 */
export async function estadoCobroLanding(ws: number): Promise<EstadoCobroLanding> {
  return runWithWorkspace(ws, async () => {
    const [conectadas, productos] = await Promise.all([pasarelasConectadas(ws), listProductos(true)]);
    return {
      conectadas,
      productos: productos.map((p): ProductoDePago => ({
        id: Number(p.id),
        nombre: String(p.nombre ?? '').trim() || `Producto #${p.id}`,
        tipo: p.tipo === 'suscripcion' ? 'suscripcion' : 'unico',
        montoUsd: Number.isFinite(Number(p.monto_usd)) && Number(p.monto_usd) > 0 ? Number(p.monto_usd) : null,
      })),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// El lead de quien paga
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El lead de ese email en el workspace, ESTRICTO (tira si la base falla: un «no lo encontré» por una
 * consulta caída crearía una segunda ficha de la misma persona). `ilike` con `%`, `_` y `\` escapados
 * trae los candidatos sin distinguir mayúsculas; la decisión es la igualdad EXACTA de `leadPorEmail`.
 * Corre adentro de `runWithWorkspace`.
 */
async function leadDeEmail(email: string): Promise<{ id: number; ambiguo: boolean } | null> {
  const db = await getTenantDb();
  const patron = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await db.from('leads').select('id, email').ilike('email', patron).limit(20);
  if (error) throw new Error(`No pude buscar el lead por email: ${error.message}`);
  return leadPorEmail((data ?? []) as Array<{ id: number; email: string | null }>, email);
}

/**
 * El lead de quien paga: el que ya tiene ese email (se REUSA, nunca uno nuevo) o uno nuevo por el
 * MISMO camino que el opt-in de una landing (app/api/track/optin: `createLead` con `origen_lead:
 * 'landing'` y la casa del producto principal de la página escrita con `casaParaEscribir`).
 *
 * ⚠️ NO CAE A PROPUESTA, A DIFERENCIA DEL OPT-IN. El opt-in, ante un duplicado, deja una propuesta y
 * no hay `leadId`; un cobro EXIGE un lead. Por eso el duplicado se resuelve ANTES (por email exacto) y,
 * si igual choca (otro pedido lo creó en el medio), se vuelve a buscar y se reusa.
 * ⚠️ SÓLO SE LLAMA CON EL CANDADO TOMADO (`ejecutarPago`): «buscar y, si no está, crear» sin candado
 * dejaba dos fichas de la misma persona ante un doble clic (revisión de la tanda 4, MEDIA). La red del
 * duplicado de abajo queda para lo que el candado no cubre (la mig 0276 sin aplicar, un alta a mano).
 * ⚠️ Y SE CREA AUNQUE EL NEGOCIO NO HAYA DECLARADO LA LANDING COMO ENTRADA DE LEADS (la puerta de
 * `entradas` del opt-in) — pero SÓLO cuando el producto se puede cobrar: acá la persona escribió su
 * nombre y su email para PAGAR, sin ficha no hay cobro, y perder a alguien con la tarjeta en la mano es
 * lo único peor que un lead de más. Si hoy no se puede cobrar, no se llama: queda una propuesta.
 */
export async function leadDeQuienPaga(l: Pick<LandingDePago, 'ws' | 'slug'>, p: { nombre: string; email: string; autor: string }): Promise<{ leadId: number; nuevo: boolean }> {
  return runWithWorkspace(l.ws, async () => {
    const ya = await leadDeEmail(p.email);
    if (ya) {
      if (ya.ambiguo) await logLeadEvent(ya.id, 'Pago desde la landing', `Hay más de una ficha con ${p.email}: el pago quedó en ésta (la más vieja).`, p.autor);
      return { leadId: ya.id, nuevo: false };
    }
    const defaultId = await idDelFunnelDefault().catch(() => null);
    // La dirección PÚBLICA de hoy (hola-mako.site en producción): una página declarada con la de antes
    // de la mudanza (`hola-mako.com/l/<slug>`) la reconoce `landingDe` (urlLandingVigente, las dos puntas).
    const principal = await funnelPrincipalDeLanding(l.ws, urlPublicaLanding(l.slug));
    try {
      const lead = await createLead({ nombre: p.nombre, email: p.email, origen_lead: 'landing', funnel_id: casaParaEscribir(principal, defaultId) });
      return { leadId: Number(lead.id), nuevo: true };
    } catch (e) {
      if (!esLeadDuplicado(e)) throw e;
      const otro = await leadDeEmail(p.email);
      if (otro) return { leadId: otro.id, nuevo: false };
      throw e;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagar
// ─────────────────────────────────────────────────────────────────────────────
// El ORDEN (el techo de la hora, el candado, la propuesta si no se puede cobrar, el lead y el cobro) vive
// en `ejecutarPago` (pago-pedido.ts, puro y con test). Acá sólo se enchufan las lecturas y las escrituras.

export type { ResultadoPago };

/**
 * `landing_pago_pedidos` (mig 0276): el candado por (negocio, email) y el techo por landing y hora. Sin la
 * migración aplicada, `ejecutarPago` corre como antes (sin candado ni techo) y lo dice en el log.
 */
const TABLA_PEDIDOS = 'landing_pago_pedidos';

/** La tabla no está: PostgREST la nombra con PGRST205 y Postgres con 42P01. Una columna que falta NO es esto. */
const faltaLaTabla = (e: { code?: string | null } | null | undefined): boolean => !!e && (e.code === 'PGRST205' || e.code === '42P01');

/**
 * La llave del candado: el NEGOCIO y el email comparable, en sha256 — la tabla no guarda el email. Por
 * negocio y no por landing: la ficha es del negocio, y dos landings suyas a la vez también la duplicarían.
 */
function claveDeCandado(ws: number, email: string): string {
  return createHash('sha256').update(`${ws}:${emailComparable(email) ?? email.trim().toLowerCase()}`).digest('hex');
}

/** Los pedidos de esta landing en la última hora (el techo). null = sin la tabla. Tira = la base falló. */
async function usosDeLaHora(docId: number): Promise<number | null> {
  const desde = new Date(Date.now() - 3_600_000).toISOString();
  // Sin `head: true`: un HEAD que falla vuelve sin cuerpo, y sin el código no se distingue la tabla que falta.
  const { count, error } = await getSupabaseServer().from(TABLA_PEDIDOS)
    .select('id', { count: 'exact' }).eq('doc_id', docId).gte('created_at', desde).limit(1);
  if (faltaLaTabla(error)) return null;
  if (error) throw new Error(`No pude contar los pedidos de la landing ${docId}: ${error.message}`);
  return count ?? 0;
}

/** El candado, contra la base: un INSERT que choca (23505) con el índice único parcial de los pedidos EN CURSO. */
function candadoDePago(docId: number, clave: string, log: DepCandado['log']): DepCandado {
  const db = () => getSupabaseServer().from(TABLA_PEDIDOS);
  const cerrar = (resultado: string) => ({ en_curso: false, resultado: resultado.slice(0, 40), terminado_at: new Date().toISOString() });
  return {
    tomar: async () => {
      const { data, error } = await db().insert({ doc_id: docId, clave }).select('id').single();
      if (!error && data) return { tipo: 'tomado', id: Number((data as { id: number }).id) };
      if (faltaLaTabla(error)) return { tipo: 'sin-tabla' };
      if (error?.code !== '23505') throw new Error(`No pude tomar el candado del pago: ${error?.message ?? 'sin respuesta'}`);
      const { data: otro, error: e2 } = await db().select('id, created_at').eq('clave', clave).eq('en_curso', true).maybeSingle();
      if (e2) throw new Error(`No pude leer el candado del pago: ${e2.message}`);
      // Lo soltaron entre el INSERT y esta lectura: se vuelve a intentar en el próximo paso.
      if (!otro) return { tipo: 'ocupado', id: 0, desde: Date.now() };
      const f = otro as { id: number; created_at: string };
      const desde = Date.parse(f.created_at);
      return { tipo: 'ocupado', id: Number(f.id), desde: Number.isFinite(desde) ? desde : Date.now() };
    },
    soltar: async (id, resultado) => {
      const { error } = await db().update(cerrar(resultado)).eq('id', id);
      if (error) throw new Error(error.message);
    },
    // Compare-and-set: sólo si SIGUE tomado (otro pedido pudo soltarlo o vencerlo en el medio).
    vencer: async (id) => {
      if (!id) return;
      const { error } = await db().update(cerrar('vencido')).eq('id', id).eq('en_curso', true);
      if (error) throw new Error(`No pude soltar el candado vencido ${id}: ${error.message}`);
    },
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    ahora: () => Date.now(),
    log,
  };
}

/**
 * Cuando hoy no se puede cobrar (sin Stripe, sin precio, el producto inactivo): una PROPUESTA de contacto,
 * nunca una ficha (revisión de la tanda 4, MEDIA). El dueño la ve en /crm/revisar con el motivo en el
 * resumen y le llega el aviso de siempre; al confirmarla, el lead nace en el producto principal de la
 * página. La `ref` hace que el mismo email pidiendo el mismo producto en la misma landing no se duplique.
 */
async function proponerQuienQuisoPagar(
  l: Pick<LandingDePago, 'ws' | 'docId' | 'slug'>,
  p: { productoId: number; nombre: string; email: string },
  motivo: MotivoNoCobra,
  quePide: string,
): Promise<void> {
  const pagina = urlPublicaLanding(l.slug);
  const principal = await funnelPrincipalDeLanding(l.ws, pagina);
  await crearPropuesta({
    ws: l.ws,
    tipo: 'lead',
    origen: 'landing',
    ref: `landing-pago:${l.docId}:${p.productoId}:${emailComparable(p.email) ?? p.email}`,
    resumen: `${p.nombre} quiso pagar ${quePide} y no se pudo: ${TEXTO_NO_COBRA[motivo]}`,
    datos: {
      leads: [{ nombre: p.nombre, email: p.email, origen: 'landing', pagina }],
      funnels: [principal],
      pago: { productoId: p.productoId, motivo },
    },
  });
}

/**
 * El cobro de un producto de la landing para quien escribió su nombre y email. El producto YA está
 * validado contra la foto publicada (lo hace la ruta). Tira si la base no contesta antes de tener lead.
 */
export async function pagarDesdeLanding(
  l: Pick<LandingDePago, 'ws' | 'docId' | 'slug' | 'titulo'>,
  p: { productoId: number; nombre: string; email: string },
): Promise<ResultadoPago> {
  const autor = creadoPorLanding(l.titulo, l.slug);
  const log: DepCandado['log'] = (nivel, texto) => console[nivel](`[landing-pagar] ws=${l.ws} /l/${l.slug} producto=${p.productoId} ${texto}`);
  return ejecutarPago({ productoId: p.productoId, email: p.email, slug: l.slug }, {
    usosDeLaHora: () => usosDeLaHora(l.docId),
    estado: () => estadoCobroLanding(l.ws),
    candado: candadoDePago(l.docId, claveDeCandado(l.ws, p.email), log),
    proponer: (motivo, quePide) => proponerQuienQuisoPagar(l, p, motivo, quePide),
    lead: async () => (await leadDeQuienPaga(l, { nombre: p.nombre, email: p.email, autor })).leadId,
    pendientes: (leadId) => listarCobros(l.ws, { leadId, estado: 'pendiente', limite: 50 }),
    crear: async (leadId, pasarela) => {
      const r = await crearCobro(l.ws, { leadId, productoId: p.productoId, pasarela, email: p.email, nombre: p.nombre, creadoPor: autor });
      return r.ok ? { ok: true, link: r.link } : { ok: false, error: r.error };
    },
    linkDe: linkDelCobro,
    historial: (leadId, texto) => runWithWorkspace(l.ws, () => logLeadEvent(leadId, 'Pago desde la landing', texto, autor)),
  });
}
