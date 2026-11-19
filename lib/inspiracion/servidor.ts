// =============================================================================
// INSPIRACIÓN, del lado del servidor (19/11/2026, docs/inspiracion/diseno.md)
// =============================================================================
// Guardar los links que llegan por WhatsApp, leerlos (Apify, un post), ordenarlos (la IA barata) y la bandeja de Copywriting.
// Todo por negocio: `getTenantDb()` dentro de `runWithWorkspace(ws)` (las dos tablas están en TENANT_TABLES, mig 0422).
// Todo gasta MaKo Tokens: `inspiracion-leer` (Apify) e `inspiracion-clasificar` (la IA), lib/mako-tokens-costos.ts.
// =============================================================================
import 'server-only';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from '../workspace';
import { clavesApifyDeSpy } from '../instagram-perfil-server';
import { piezasDeApify } from '../instagram-perfil';
import { conLaPrimeraConCredito } from '../spy-claves';
import { APIFY_ACTOR_PUBLICACIONES, entradaDeUnaPublicacion } from '../spy-todo-reglas';
import { reservarDelDia } from '../spy-todo';
import { chatCheapCascade } from '../ai-cheap';
import { conMedidorDeMt, esSinSaldoDeMt, reportarCostoReal } from '../mako-tokens-medidor';
import { contenidoNoConfiable, renderPrompt } from '../prompt-render';
import { destinoDe } from './reglas';
import { PROMPTS_INSPIRACION, leerVeredicto, textoDeLaPieza, textoDeLasCarpetas, type CarpetaParaIA, type Guardado } from './clasificar';
import type { LinkDeInstagram } from './links';

export const T_CARPETAS = 'inspiracion_carpetas';
export const T_PIEZAS = 'inspiracion_piezas';
/** Cuántos links lee un negocio por día (el tope de gasto de Apify, como `TRAIDOS_POR_DIA` de «Traer tu outlier»). */
export const LEIDOS_POR_DIA = 40;
/** Cuántos links de UN mensaje se leen en el momento; el resto se guarda y espera en la bandeja sin leer. */
export const LEIDOS_POR_MENSAJE = 5;
const TECHO_USD = 0.01;
const API = 'https://api.apify.com/v2';

export interface Carpeta { id: number; nombre: string; descripcion: string; orden: number; creada_por: string }
export interface Pieza {
  id: number; ref: string; url: string; tipo_link: 'reel' | 'post' | 'cuenta'; cuenta: string | null; pie: string | null;
  miniatura_url: string | null; metricas: Record<string, unknown>; lectura: Record<string, unknown>;
  carpeta_id: number | null; sugerida_id: number | null; carpeta_nueva: string | null; confianza: number | null; por_que: string | null;
  estado: 'leyendo' | 'ordenada' | 'por_revisar' | 'sin_leer'; nota: string | null; origen: string; creada_en: string; revisada_en: string | null;
  /** Cuándo se leyó el post en Instagram; null = todavía no (se guardó igual). */
  leida_en: string | null;
}
const COLUMNAS = 'id, ref, url, tipo_link, cuenta, pie, miniatura_url, metricas, lectura, carpeta_id, sugerida_id, carpeta_nueva, confianza, por_que, estado, nota, origen, creada_en, revisada_en, leida_en';
/** Cuántas piezas viejas sin leer se releen cuando una lectura vuelve a andar. */
export const RELEIDAS_POR_MENSAJE = 3;

// ── Leer UN post de Instagram (Apify) ─────────────────────────────────────────────────────────────────────────────
interface LeidoDeInstagram { cuenta: string | null; pie: string | null; miniatura: string | null; metricas: Record<string, unknown> }

/**
 * Lee UN post. null si no se pudo (sin clave, tope del día, Apify caído o la clave vencida: el 19/11/2026 la única daba 401).
 * Una lectura que FALLA no se cobra: el costo se reporta (`reportarCostoReal`) sólo cuando Apify contestó, y el `finally` del
 * medidor devuelve entera la reserva de lo que no reportó costo. La falla tira adentro y se vuelve null afuera, con su registro.
 */
async function leerDeInstagram(ws: number, url: string, ref: string): Promise<LeidoDeInstagram | null> {
  const claves = (await clavesApifyDeSpy(ws).catch(() => [])) ?? [];
  const pagan = claves.length ? claves : ((await clavesApifyDeSpy(await wsSuperAdmin()).catch(() => [])) ?? []);
  if (!pagan.length) return null;
  if (!(await runWithWorkspace(ws, () => reservarDelDia('inspiracion.leidos.dia', LEIDOS_POR_DIA)))) return null;
  return runWithWorkspace(ws, () => conMedidorDeMt('inspiracion-leer', async (): Promise<LeidoDeInstagram | null> => {
    const q = new URLSearchParams({ maxItems: '1', maxTotalChargeUsd: String(TECHO_USD), timeout: '45' });
    const r = await conLaPrimeraConCredito(pagan, async ({ token }) => {
      const res = await fetch(`${API}/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entradaDeUnaPublicacion(url)), signal: AbortSignal.timeout(55_000), cache: 'no-store',
      });
      return { status: res.status, cuerpo: await res.json().catch(() => null) };
    });
    if (!r || r.status < 200 || r.status >= 300 || !Array.isArray(r.cuerpo)) {
      throw new Error(`Apify no leyó ${url}: HTTP ${r?.status ?? '—'}`);
    }
    reportarCostoReal(0.0025);
    const items = (r.cuerpo as Array<Record<string, unknown>>).filter((it) => it && typeof it === 'object' && !('error' in it && it.error));
    const item = items.find((it) => it.shortCode === ref) ?? items[0];
    if (!item) return null;
    const [p] = piezasDeApify([item]);
    const dueno = typeof item.ownerUsername === 'string' ? item.ownerUsername : null;
    return {
      cuenta: dueno,
      pie: p?.texto ?? null,
      miniatura: p?.miniatura ?? null,
      metricas: { tipo: p?.tipo ?? null, vistas: p?.vistas ?? null, megusta: p?.megusta ?? null, comentarios: p?.comentarios ?? null },
    };
  })).catch((e) => {
    console.error(`[inspiracion] ${e instanceof Error ? e.message : String(e)} (ws=${ws})`);
    return null;
  });
}

// ── Ordenarla (la IA) ─────────────────────────────────────────────────────────────────────────────────────────────
async function carpetasParaIA(): Promise<{ carpetas: Carpeta[]; paraIA: CarpetaParaIA[]; confirmadas: Map<number, number> }> {
  const db = await getTenantDb();
  const [c, p] = await Promise.all([
    db.from(T_CARPETAS).select('id, nombre, descripcion, orden, creada_por').order('orden').order('id'),
    db.from(T_PIEZAS).select('carpeta_id, cuenta, lectura').not('revisada_en', 'is', null).not('carpeta_id', 'is', null).order('revisada_en', { ascending: false }).limit(300),
  ]);
  const carpetas = (c.data ?? []) as Carpeta[];
  const confirmadas = new Map<number, number>();
  const ejemplos = new Map<number, string[]>();
  for (const f of (p.data ?? []) as Array<{ carpeta_id: number; cuenta: string | null; lectura: Record<string, unknown> | null }>) {
    confirmadas.set(f.carpeta_id, (confirmadas.get(f.carpeta_id) ?? 0) + 1);
    const lista = ejemplos.get(f.carpeta_id) ?? [];
    if (lista.length < 3) lista.push(`@${f.cuenta ?? '?'}: ${String(f.lectura?.de_que_trata ?? f.lectura?.formato ?? '').slice(0, 140)}`);
    ejemplos.set(f.carpeta_id, lista);
  }
  return { carpetas, confirmadas, paraIA: carpetas.map((x) => ({ id: x.id, nombre: x.nombre, descripcion: x.descripcion, ejemplos: ejemplos.get(x.id) ?? [] })) };
}

/**
 * Lee y ordena una pieza ya guardada. Nunca tira: lo que falla deja la pieza en la bandeja.
 * Si Instagram no deja leerla, se ordena IGUAL con lo que hay (la nota del dueño, la cuenta) y queda `leida_en` null para
 * releerla después (`releerPendientes`). Lo que la persona ya decidió (`revisada_en`) no se mueve: sólo se completa la lectura.
 */
export async function leerYOrdenar(ws: number, piezaId: number): Promise<Guardado> {
  return runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from(T_PIEZAS).select(COLUMNAS).eq('id', piezaId).maybeSingle();
    const pieza = data as Pieza | null;
    if (!pieza) return { como: 'nueva', estado: 'sin_leer', carpeta: null, sinLeer: true };
    let leida = pieza.leida_en != null || pieza.tipo_link === 'cuenta';
    if (!leida) {
      const leido = await leerDeInstagram(ws, pieza.url, pieza.ref).catch(() => null);
      if (leido) {
        await db.from(T_PIEZAS).update({ cuenta: leido.cuenta ?? pieza.cuenta, pie: leido.pie, miniatura_url: leido.miniatura, metricas: leido.metricas, leida_en: new Date().toISOString() }).eq('id', piezaId);
        Object.assign(pieza, { cuenta: leido.cuenta ?? pieza.cuenta, pie: leido.pie });
        leida = true;
      }
    }
    if (pieza.revisada_en) return { como: 'nueva', estado: pieza.estado, carpeta: null, sinLeer: !leida };
    // Sin lectura, sin nota y sin cuenta no hay nada que leer: a la bandeja, sin pagar la IA.
    if (!leida && !pieza.nota && !pieza.cuenta) {
      await db.from(T_PIEZAS).update({ estado: 'por_revisar' }).eq('id', piezaId);
      return { como: 'nueva', estado: 'por_revisar', carpeta: null, sinLeer: true };
    }
    try {
      const { carpetas, paraIA, confirmadas } = await carpetasParaIA();
      const [sistema, usuario] = await Promise.all([
        renderPrompt(PROMPTS_INSPIRACION.sistema.key, PROMPTS_INSPIRACION.sistema.tpl, {}),
        renderPrompt(PROMPTS_INSPIRACION.usuario.key, PROMPTS_INSPIRACION.usuario.tpl, {
          pieza: contenidoNoConfiable(textoDeLaPieza({ tipoLink: pieza.tipo_link, cuenta: pieza.cuenta, pie: pieza.pie }), 'pieza'),
          nota: contenidoNoConfiable(pieza.nota || '(nada)', 'nota'),
          carpetas: contenidoNoConfiable(textoDeLasCarpetas(paraIA), 'carpetas'),
        }),
      ]);
      const texto = await chatCheapCascade({ system: sistema, user: usuario, json: true, maxTokens: 500, feature: 'inspiracion-clasificar', motivo: 'Ordenar un link de inspiración' });
      const v = leerVeredicto(texto, carpetas.map((c) => c.id));
      const destino = destinoDe(v ? { carpetaId: v.carpetaId, confianza: v.confianza, carpetaNueva: v.carpetaNueva } : null, carpetas, confirmadas);
      const fila = destino.estado === 'ordenada'
        ? { estado: 'ordenada', carpeta_id: destino.carpetaId, sugerida_id: destino.carpetaId, carpeta_nueva: null }
        : { estado: 'por_revisar', carpeta_id: null, sugerida_id: destino.sugeridaId, carpeta_nueva: destino.carpetaNueva };
      await db.from(T_PIEZAS).update({ ...fila, confianza: v?.confianza ?? null, por_que: v?.porQue ?? null, lectura: v?.lectura ?? {} }).eq('id', piezaId);
      const nombre = carpetas.find((c) => c.id === (destino.estado === 'ordenada' ? destino.carpetaId : -1))?.nombre ?? null;
      return { como: 'nueva', estado: destino.estado, carpeta: nombre, sinLeer: !leida };
    } catch (e) {
      // Sin saldo (o cualquier otra falla): la pieza queda guardada y espera en la bandeja. Nunca se pierde un link.
      if (!esSinSaldoDeMt(e)) console.error(`[inspiracion] no pude ordenar la pieza ${piezaId} (ws=${ws}): ${e instanceof Error ? e.message : String(e)}`);
      await db.from(T_PIEZAS).update({ estado: 'por_revisar' }).eq('id', piezaId).then(() => undefined, () => undefined);
      return { como: 'nueva', estado: 'por_revisar', carpeta: null, sinLeer: !leida };
    }
  });
}

/**
 * Cuando una lectura vuelve a andar, se releen hasta `RELEIDAS_POR_MENSAJE` piezas que quedaron sin leer (las más viejas
 * primero). Es la «lectura completa que llega después» que promete la respuesta: sin esto, una pieza guardada con Apify caído
 * se quedaba sin leer para siempre.
 */
export async function releerPendientes(ws: number, menos: readonly number[] = []): Promise<number> {
  const ids = await runWithWorkspace(ws, async () => {
    const db = await getTenantDb();
    const { data } = await db.from(T_PIEZAS).select('id').is('leida_en', null).neq('tipo_link', 'cuenta').order('creada_en', { ascending: true }).limit(RELEIDAS_POR_MENSAJE + menos.length);
    return ((data ?? []) as Array<{ id: number }>).map((f) => f.id).filter((id) => !menos.includes(id)).slice(0, RELEIDAS_POR_MENSAJE);
  });
  for (const id of ids) await leerYOrdenar(ws, id);
  return ids.length;
}

// ── Guardar lo que llegó por WhatsApp ─────────────────────────────────────────────────────────────────────────────
/**
 * Guarda los links (uno por `ref`: el repetido no se duplica) y ordena los nuevos, hasta `LEIDOS_POR_MENSAJE` en el momento.
 * Devuelve uno por link, en orden, para armar la respuesta (`respuestaWhatsApp`).
 */
export async function guardarDeWhatsApp(ws: number, links: readonly LinkDeInstagram[], o: { nota: string; mensajeId?: string | null }): Promise<Guardado[]> {
  const out: Guardado[] = [];
  const ids: number[] = [];
  let leidos = 0;
  for (const link of links) {
    const r = await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const ya = await db.from(T_PIEZAS).select('id, estado, carpeta_id').eq('ref', link.ref).maybeSingle();
      if (ya.data) {
        const f = ya.data as { carpeta_id: number | null; estado: Guardado['estado'] };
        const carpeta = f.carpeta_id ? ((await db.from(T_CARPETAS).select('nombre').eq('id', f.carpeta_id).maybeSingle()).data as { nombre: string } | null)?.nombre ?? null : null;
        return { repetida: true as const, g: { como: 'repetida' as const, estado: f.estado, carpeta } };
      }
      const ins = await db.from(T_PIEZAS).insert({
        ref: link.ref, url: link.url, tipo_link: link.tipo, cuenta: link.tipo === 'cuenta' ? link.ref.replace(/^@/, '') : null,
        nota: o.nota || null, origen: 'whatsapp', mensaje_id: o.mensajeId ?? null, estado: 'leyendo',
      }).select('id').single();
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'no se guardó');
      return { repetida: false as const, id: (ins.data as { id: number }).id };
    });
    if (r.repetida) { out.push(r.g); continue; }
    ids.push(r.id);
    if (leidos < LEIDOS_POR_MENSAJE) { leidos++; out.push(await leerYOrdenar(ws, r.id)); continue; }
    await runWithWorkspace(ws, async () => (await getTenantDb()).from(T_PIEZAS).update({ estado: 'sin_leer' }).eq('id', r.id));
    out.push({ como: 'nueva', estado: 'sin_leer', carpeta: null, sinLeer: true });
  }
  // Si Instagram dejó leer alguna de este mensaje, la lectura anda: se completan las que habían quedado sin leer.
  if (out.some((g, i) => g.como === 'nueva' && !g.sinLeer && links[i]?.tipo !== 'cuenta')) await releerPendientes(ws, ids).catch(() => 0);
  return out;
}

// ── La bandeja de Copywriting ─────────────────────────────────────────────────────────────────────────────────────
// Corren con el negocio de la sesión (`getTenantDb`): las llama app/copywriter/inspiracion/acciones.ts.

export async function leerInspiracion(): Promise<{ carpetas: Carpeta[]; piezas: Pieza[] }> {
  const db = await getTenantDb();
  const [c, p] = await Promise.all([
    db.from(T_CARPETAS).select('id, nombre, descripcion, orden, creada_por').order('orden').order('id'),
    db.from(T_PIEZAS).select(COLUMNAS).order('creada_en', { ascending: false }).limit(500),
  ]);
  if (c.error) throw new Error(c.error.message);
  if (p.error) throw new Error(p.error.message);
  return { carpetas: (c.data ?? []) as Carpeta[], piezas: (p.data ?? []) as Pieza[] };
}

export async function crearCarpeta(nombre: string, descripcion: string, creadaPor: 'persona' | 'mako' = 'persona'): Promise<Carpeta> {
  const limpio = nombre.trim().slice(0, 60);
  if (!limpio) throw new Error('La carpeta necesita un nombre.');
  const db = await getTenantDb();
  const ya = await db.from(T_CARPETAS).select('id, nombre, descripcion, orden, creada_por').ilike('nombre', limpio.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
  if (ya.data) return ya.data as Carpeta;
  const r = await db.from(T_CARPETAS).insert({ nombre: limpio, descripcion: descripcion.trim().slice(0, 200), creada_por: creadaPor }).select('id, nombre, descripcion, orden, creada_por').single();
  if (r.error || !r.data) throw new Error(r.error?.message ?? 'No se creó la carpeta.');
  return r.data as Carpeta;
}

/** La persona decide: la pieza va a esa carpeta, confirmada (lo que después le enseña al clasificador). */
export async function ponerEnCarpeta(piezaId: number, carpetaId: number): Promise<void> {
  const db = await getTenantDb();
  const c = await db.from(T_CARPETAS).select('id').eq('id', carpetaId).maybeSingle();
  if (!c.data) throw new Error('Esa carpeta no existe.');
  const r = await db.from(T_PIEZAS).update({ carpeta_id: carpetaId, estado: 'ordenada', revisada_en: new Date().toISOString() }).eq('id', piezaId);
  if (r.error) throw new Error(r.error.message);
}

/** «Volver»: la pieza vuelve a la bandeja con la sospecha que tenía. */
export async function devolverABandeja(piezaId: number): Promise<void> {
  const db = await getTenantDb();
  const r = await db.from(T_PIEZAS).update({ carpeta_id: null, estado: 'por_revisar', revisada_en: null }).eq('id', piezaId);
  if (r.error) throw new Error(r.error.message);
}

export async function borrarPieza(piezaId: number): Promise<void> {
  const db = await getTenantDb();
  const r = await db.from(T_PIEZAS).delete().eq('id', piezaId);
  if (r.error) throw new Error(r.error.message);
}
