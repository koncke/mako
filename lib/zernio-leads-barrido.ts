// =============================================================================
// zernio-leads-barrido — la red de seguridad de los leads de Meta por Zernio (29/10/2026)
// =============================================================================
// Martín, en la llamada con Thiago (29/10, [15:12]): «le entran acá los leads» de los formularios de Meta. Por Zernio entran con el
// webhook (`lead.received`, app/api/webhooks/zernio): si un evento se pierde (Zernio reintenta 7 veces y lo descarta), el lead no
// entra nunca. El poll de Meta (lib/meta-leads.ts) no sirve acá: usa el token de página propio, y un negocio que sólo conectó por
// Zernio no lo tiene. Esto lee `GET /v1/ads/leads` (OpenAPI v1.416: la caché de Zernio, que además relee las páginas cada 15 minutos
// para recuperar lo que el webhook perdió) y carga lo que falta por la MISMA puerta del webhook (`cargarLeadDeZernio`).
//
// ⚠️ LO QUE YA ESTÁ NO SE TOCA: `upsertLeadFromMeta` también ACTUALIZA un lead existente (los nombres de campaña quedan en null:
//    docs/hallazgos-integraciones.md, «Los leads de Meta por Zernio», punto 4). Se carga sólo el `meta_lead_id` que no está.
// ⚠️ UN LEAD DE MENOS DE 5 MINUTOS ES DEL WEBHOOK (`esDelWebhookTodavia`, la regla del poll de Meta): si el barrido lo toma primero,
//    el webhook lo encuentra y se saltea en silencio lo inmediato.
// ⚠️ SÓLO LAS CUENTAS DEL NEGOCIO, Y SE MIRA LEAD POR LEAD (revisión de privacidad, 29/10, M1 y M2): el pedido lleva `accountIds`
//    (las cuentas de Facebook y de anuncios de SU perfil) con cualquier clave, y además cada lead que vuelve se descarta en memoria
//    si su `accountId` no es una de ellas (o no trae ninguna). El filtro del pedido solo no alcanza: si Zernio lo ignora, la clave de
//    la plataforma traería los leads de todos los negocios prestados; y una clave propia lista el equipo ENTERO (páginas que el
//    negocio desconectó, otros perfiles, la clave de MaKo pegada como «propia»). Es la misma regla del webhook, que rutea cada lead
//    por su cuenta y descarta el ajeno.
// ⚠️ SÓLO CREA (M3): una persona que YA es un lead (por teléfono o email) no se toca, ni se le manda otra conversión ni otro aviso.
// ⚠️ LA PAPELERA SE LEE ENTERA O NO SE BARRE (M4): paginada (PostgREST corta en 1000 sin avisar) y, si no se puede leer, el barrido
//    corta: un lead borrado que vuelve recibe otra vez su primer WhatsApp.
//
// Corre adentro de `runWithWorkspace(ws)`: lo llama el cron de leads (app/api/cron/meta-leads-poll).

import 'server-only';
import { getTenantDb } from './workspace';
import { clavesZernio, zFetch, ZernioError, type ClaveZernio } from './zernio';
import { conexionesViaZernio } from './zernio-conectar';
import { leerLeadDelRest, type LeadDeZernio } from './zernio-lead';
import { alNacerLeadDeZernio, cargarLeadDeZernio } from './zernio-leads';
import { esDelWebhookTodavia } from './meta-leads-poll-reglas';
import { leerTodo } from './supabase-paginado';

/** Hasta cuántas páginas de 100 por clave y por pasada (la pasada diaria de 7 días con un negocio con muchos leads). */
const MAX_PAGINAS = 10;
/** De a cuántos `meta_lead_id` se pregunta a la base (un `in.(…)` de 1000 ids no entra en una URL). */
const TANDA_IDS = 150;

export type ResultadoBarridoZernio = {
  vistos: number;
  cargados: number;
  yaEstaban: number;
  delWebhook: number;
  ignorados: number;
  /** Los que volvieron de una cuenta que NO es del negocio (o sin cuenta): se descartan sin mirarlos. */
  ajenos: number;
  errores: number;
  /** Por qué no se pudo barrer una clave: sin el complemento de anuncios de Zernio (403), o sin ninguna página conectada. */
  motivo: 'sin-complemento' | 'sin-paginas' | null;
};

type AdLeads = { leads?: unknown[]; pagination?: { hasMore?: boolean; cursor?: string | null } };

/** Las cuentas de Facebook y de anuncios del negocio, por clave (las únicas que tienen formularios). */
async function cuentasPorClave(ws: number): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (const c of await conexionesViaZernio(ws)) {
    if (!c.activa || (c.plataforma !== 'facebook' && c.plataforma !== 'metaads')) continue;
    const k = c.clave ?? 1;
    out.set(k, [...(out.get(k) ?? []), c.accountId]);
  }
  return out;
}

async function leadsDeUnaClave(k: ClaveZernio, cuentas: string[], desdeSeg: number): Promise<unknown[]> {
  const todos: unknown[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    // Con cualquier clave (también la propia): pedir sólo lo del negocio. La red de verdad es el descarte en memoria de abajo.
    const q = new URLSearchParams({ platform: 'meta', since: String(desdeSeg), limit: '100', accountIds: cuentas.join(',') });
    if (cursor) q.set('cursor', cursor);
    const r = await zFetch<AdLeads>(k.apiKey, `/ads/leads?${q.toString()}`);
    if (Array.isArray(r.leads)) todos.push(...r.leads);
    cursor = r.pagination?.hasMore ? r.pagination.cursor ?? null : null;
    if (!cursor) break;
  }
  return todos;
}

/** Los `meta_lead_id` de esta lista que el negocio YA tiene, o que mandó a la PAPELERA (mig 0340: borrar no es «que vuelva solo»). */
async function yaCargados(ws: number, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const db = await getTenantDb();
  const estan = new Set<string>();
  // De a tandas: hasta 1000 ids por clave (10 páginas de 100) no entran en una URL.
  for (let i = 0; i < ids.length; i += TANDA_IDS) {
    const { data, error } = await db.from('leads').select('meta_lead_id').in('meta_lead_id', ids.slice(i, i + TANDA_IDS));
    if (error) throw new Error(`leads (barrido de Zernio): ${error.message}`);
    for (const f of (data ?? []) as Array<{ meta_lead_id: string | null }>) if (f.meta_lead_id) estan.add(f.meta_lead_id);
  }
  // ⚠️ Un lead en la papelera NO está en `leads` (la papelera guarda su FOTO y lo borra): sin esto, el barrido lo volvía a crear, con
  // su primer mensaje y sus automatizaciones. ENTERA (`leerTodo`: PostgREST corta en 1000 sin avisar, y una agencia que limpia 1.500
  // leads basura los veía volver) y, si no se puede leer, TIRA: el barrido de este negocio corta y el próximo lo vuelve a intentar.
  // Sólo el id de la foto (la proyección la hace la base: la foto entera puede ser grande).
  const pap = await leerTodo<{ mlid?: unknown; foto?: { filas?: { leads?: Array<{ meta_lead_id?: unknown }> } } }>(
    db, 'leads_papelera', 'id, mlid:foto->filas->leads->0->>meta_lead_id', { eq: { workspace_id: ws }, orden: 'id' },
  );
  const pedidos = new Set(ids);
  for (const f of pap) {
    // La proyección (`mlid`) o, si vino la fila entera, la foto: el mismo dato.
    const id = typeof f.mlid === 'string' ? f.mlid : f.foto?.filas?.leads?.[0]?.meta_lead_id;
    if (typeof id === 'string' && pedidos.has(id)) estan.add(id);
  }
  return estan;
}

/** `cargar` y `alNacer`: las de siempre; la prueba las cambia (la carga real escribe en decenas de tablas, y eso lo prueban sus tests). */
export async function barrerLeadsDeZernio(
  ws: number, dias: number, ahora: Date = new Date(),
  deps: { cargar?: typeof cargarLeadDeZernio; alNacer?: typeof alNacerLeadDeZernio } = {},
): Promise<ResultadoBarridoZernio> {
  const cargar = deps.cargar ?? cargarLeadDeZernio;
  const alNacer = deps.alNacer ?? alNacerLeadDeZernio;
  const res: ResultadoBarridoZernio = { vistos: 0, cargados: 0, yaEstaban: 0, delWebhook: 0, ignorados: 0, ajenos: 0, errores: 0, motivo: null };
  const porClave = await cuentasPorClave(ws);
  if (!porClave.size) return { ...res, motivo: 'sin-paginas' };
  const desdeSeg = Math.floor((ahora.getTime() - Math.max(1, dias) * 86_400_000) / 1000);
  const ahoraMs = ahora.getTime();
  const leidos: LeadDeZernio[] = [];
  for (const k of await clavesZernio(ws, { fresca: true })) {
    const cuentas = porClave.get(k.slot);
    if (!cuentas?.length) continue;
    const delNegocio = new Set(cuentas);
    let crudos: unknown[];
    try {
      crudos = await leadsDeUnaClave(k, cuentas, desdeSeg);
    } catch (e) {
      // Sin el complemento de anuncios, Zernio no da leads: se dice (el aviso de «Anuncios de Meta» lo lee) y se sigue con la otra clave.
      if (e instanceof ZernioError && e.status === 403) { res.motivo = 'sin-complemento'; continue; }
      throw e;
    }
    for (const item of crudos) {
      res.vistos++;
      const l = leerLeadDelRest(item);
      if ('ignorado' in l) { res.ignorados++; continue; }
      // ⚠️ El lead de una cuenta que no es del negocio (o que no dice de cuál es) no se mira: ver la cabecera.
      if (!l.cuentaId || !delNegocio.has(l.cuentaId)) { res.ajenos++; continue; }
      // `since` también va sólo en el pedido (B1): uno más viejo que la ventana no se carga (podría ser uno que la papelera ya purgó).
      if (l.creadoEn && Date.parse(l.creadoEn) < desdeSeg * 1000) { res.ignorados++; continue; }
      if (esDelWebhookTodavia(l.creadoEn, ahoraMs)) { res.delWebhook++; continue; }
      leidos.push(l);
    }
  }
  const unicos = [...new Map(leidos.map((l) => [l.leadgenId, l])).values()];
  const estan = await yaCargados(ws, unicos.map((l) => l.leadgenId));
  for (const l of unicos) {
    if (estan.has(l.leadgenId)) { res.yaEstaban++; continue; }
    // Uno que falla (la clave única GLOBAL de `meta_lead_id`: el mismo lead en otro negocio, o el webhook justo a la vez) no tumba
    // a los demás: se cuenta y se sigue. El próximo barrido lo vuelve a intentar.
    try {
      const c = await cargar(l, ahora, { soloCrear: true });
      // Uno que no se creó (la persona ya era un lead, o el webhook justo a la vez) no se toca: ni conversión ni aviso (M3).
      if (!c.creado) { res.yaEstaban++; continue; }
      res.cargados++;
      // La conversión y lo inmediato, con las reglas del webhook (`queHacerConElLead`: lo inmediato sólo si es de menos de 24 h).
      await alNacer(ws, c, l);
    } catch (e) {
      res.errores++;
      console.error(`[zernio-leads-barrido] ws${ws}: un lead no entró: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
    }
  }
  return res;
}
