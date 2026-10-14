// =============================================================================
// editor-landing/pago-landing-server — el «Botón de pago» contra la base y la pasarela
// =============================================================================
// Tanda 4 (14/10/2026). Lo que decide vive en pago-landing.ts (puro, con test); acá sólo se lee y se
// escribe, en este orden: la landing PUBLICADA (por slug, cliente crudo), el catálogo y las pasarelas
// del workspace DE LA LANDING, el lead de ese email (o uno nuevo por el mismo camino que el opt-in),
// y el cobro (`crearCobro`, lib/cobros.ts: el único escritor de `cobros`).
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
import { getSupabaseServer } from '../supabase';
import { getTenantDb, runWithWorkspace } from '../workspace';
import { APP_BASE_URL } from '../app-url';
import { listProductos } from '../productos';
import { createLead, logLeadEvent } from '../leads';
import { esLeadDuplicado } from '../leads-duplicados';
import { idDelFunnelDefault } from '../funnels';
import { funnelPrincipalDeLanding } from '../landing-funnel';
import { casaParaEscribir } from '../lead-funnel-reglas';
import { crearCobro, linkDelCobro, listarCobros, pasarelasConectadas } from '../cobros';
import { slugValido, urlPublica } from './doc';
import { leerFoto } from './server-reglas';
import { sanearConfig } from './validar';
import { temaPorId, estiloDeTema, type Tema } from './temas';
import { urlsDeFuentes } from './pagina-publica';
import {
  TEXTO_NO_COBRA, motivoNoCobra, pasarelaDeLanding, productosDeFoto, type EstadoCobroLanding, type MotivoNoCobra, type ProductoDePago,
} from './pago-landing';
import { cobroPendienteReusable, creadoPorLanding, leadPorEmail } from './pago-pedido';

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
 * ⚠️ Y SE CREA AUNQUE EL NEGOCIO NO HAYA DECLARADO LA LANDING COMO ENTRADA DE LEADS (la puerta de
 * `entradas` del opt-in): acá la persona escribió su nombre y su email para PAGAR un producto que el
 * negocio puso en su página. Sin ficha no hay cobro, y perder a alguien con la tarjeta en la mano es
 * lo único peor que un lead de más.
 */
export async function leadDeQuienPaga(l: Pick<LandingDePago, 'ws' | 'slug'>, p: { nombre: string; email: string; autor: string }): Promise<{ leadId: number; nuevo: boolean }> {
  return runWithWorkspace(l.ws, async () => {
    const ya = await leadDeEmail(p.email);
    if (ya) {
      if (ya.ambiguo) await logLeadEvent(ya.id, 'Pago desde la landing', `Hay más de una ficha con ${p.email}: el pago quedó en ésta (la más vieja).`, p.autor);
      return { leadId: ya.id, nuevo: false };
    }
    const defaultId = await idDelFunnelDefault().catch(() => null);
    const principal = await funnelPrincipalDeLanding(l.ws, urlPublica(APP_BASE_URL, l.slug));
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

export type ResultadoPago =
  | { tipo: 'redirigir'; url: string; reusado: boolean }
  /** No se puede cobrar ese producto hoy: el motivo quedó en el historial del lead. */
  | { tipo: 'no-disponible'; motivo: MotivoNoCobra }
  /** Falló la pasarela o la base: el motivo quedó en el historial (si hay lead) y en el log. */
  | { tipo: 'fallo' };

/**
 * El cobro de un producto de la landing para quien escribió su nombre y email. El producto YA está
 * validado contra la foto publicada (lo hace la ruta). Tira si la base no contesta antes de tener lead.
 */
export async function pagarDesdeLanding(l: Pick<LandingDePago, 'ws' | 'slug' | 'titulo'>, p: { productoId: number; nombre: string; email: string }): Promise<ResultadoPago> {
  const autor = creadoPorLanding(l.titulo, l.slug);
  const estado = await estadoCobroLanding(l.ws);
  const producto = estado.productos.find((x) => x.id === p.productoId) ?? null;
  const motivo = motivoNoCobra({ conectadas: estado.conectadas, producto });
  const { leadId } = await leadDeQuienPaga(l, { nombre: p.nombre, email: p.email, autor });
  const quePide = producto ? `«${producto.nombre}»` : `el producto #${p.productoId}`;

  if (motivo) {
    await runWithWorkspace(l.ws, () => logLeadEvent(leadId, 'Pago desde la landing', `Quiso pagar ${quePide} y no se pudo: ${TEXTO_NO_COBRA[motivo]}`, autor));
    console.warn(`[landing-pagar] ws=${l.ws} /l/${l.slug} producto=${p.productoId} no cobra: ${motivo}`);
    return { tipo: 'no-disponible', motivo };
  }
  const pasarela = pasarelaDeLanding(estado.conectadas)!;
  const buscado = { productoId: p.productoId, pasarela, monto: producto!.montoUsd!, moneda: 'USD', tipo: producto!.tipo, email: p.email, slug: l.slug };

  try {
    // El pendiente del MISMO lead Y producto (y precio): un doble clic, un «atrás» y otra vez, o la
    // misma persona dos días después, siguen en el mismo checkout. `listarCobros` y no
    // `cobroPendienteDelLead`: ése devuelve el más nuevo de CUALQUIER producto.
    const pendientes = await listarCobros(l.ws, { leadId, estado: 'pendiente', limite: 50 });
    const ya = cobroPendienteReusable(pendientes, buscado);
    if (ya) return { tipo: 'redirigir', url: linkDelCobro(ya.token), reusado: true };

    // Sin `monto`, `moneda`, `montoUsd` ni `altaCapa`: el precio lo pone el catálogo (`crearCobro` lo
    // lee del producto) y una landing no da de alta cuentas de MaKo (ver la cabecera).
    const r = await crearCobro(l.ws, { leadId, productoId: p.productoId, pasarela, email: p.email, nombre: p.nombre, creadoPor: autor });
    if (r.ok) return { tipo: 'redirigir', url: r.link, reusado: false };
    // El error de `crearCobro` está escrito para el DUEÑO: va a su historial, nunca a la pantalla del visitante.
    await runWithWorkspace(l.ws, () => logLeadEvent(leadId, 'Pago desde la landing', `No se pudo abrir el pago de ${quePide}: ${r.error}`, autor));
    console.error(`[landing-pagar] ws=${l.ws} /l/${l.slug} producto=${p.productoId} lead=${leadId}: ${r.error}`);
    return { tipo: 'fallo' };
  } catch (e) {
    await runWithWorkspace(l.ws, () => logLeadEvent(leadId, 'Pago desde la landing', `No se pudo abrir el pago de ${quePide}: falló la conexión. Prueba el link desde la ficha.`, autor));
    console.error(`[landing-pagar] ws=${l.ws} /l/${l.slug} producto=${p.productoId} lead=${leadId} (excepción): ${msg(e)}`);
    return { tipo: 'fallo' };
  }
}
