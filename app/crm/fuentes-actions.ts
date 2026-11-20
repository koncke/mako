'use server';

// =============================================================================
// fuentes-actions — la pestaña «Formularios» de «Asignar fuentes» y sus reglas de calificación (20/11/2026)
// =============================================================================
// Martín, 20/11/2026: «formularios deberían poder ser de páginas web (creadas en MaKo o creadas en cualquier lado… Para eso
// tenemos el pixel de MaKo), o formularios de Meta, de anuncios. Y para lo que necesita Juanfran, que se pueda asignar los
// "calificados" o "descalificados" y que caigan correspondientemente en su etapa».
//
// Las campañas de Meta siguen en app/crm/campanas-actions.ts (la misma pestaña de antes, rediseñada). Acá:
//   · `formulariosAction`   — los tres tipos de formulario, con qué funnels los tienen y si tienen reglas;
//   · `alternarFormularioAction` — prender o apagar UN formulario en este funnel;
//   · `reglasAction` / `guardarReglasAction` — el editor de reglas;
//   · `reaplicarAction`     — pasar las reglas por los leads que ya entraron (primero cuenta, después mueve).
// Leer: cualquier sesión del negocio. Cambiar: sólo su admin (como las campañas).
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md). Los tipos, sí (se borran al compilar).
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getRolWsEfectivo, getTenantDb } from '@/lib/workspace';
import { exigirSesion } from '@/lib/sesion-accion';
import { TAG } from '@/lib/cache';
import { getSettingEstricto, setSetting } from '@/lib/settings';
import { productosAsignables } from '@/lib/landing-funnel';
import { CONFIG_KEY as CLAVE_LANDINGS, MAX_LANDINGS, conLanding, landingDe, parsearConfig } from '@/lib/landing-config';
import { normalizarUrl } from '@/lib/landing-paginas';
import { asignacionesDelNegocio, asignarPieza, landingsConPiezas } from '@/lib/piezas-web';
import { claveValida } from '@/lib/editor-landing/piezas';
import {
  claveMeta, claveWeb, claveFuenteValida, conReglas, reglasDe, tipoDeClave, alternarFormularioMeta,
} from '@/lib/fuentes-formularios';
import {
  REGLAS_VACIAS, sanearReglas, preguntasDeEnvios, type ReglasFormulario, type PreguntaVista,
} from '@/lib/calificacion-formulario';
import {
  leerMapaReglas, leerMapaReglasEstricto, guardarMapaReglas, enviosDeFormulario, aplicarCalificacion, type EnvioDeFormulario,
} from '@/lib/calificacion-aplicar';
import {
  formulariosDeMeta, leerAsignacionesMeta, leerAsignacionesMetaEstricto, guardarAsignacionesMeta, leadIdsDeFormularioMeta, preguntasDeFormularioMeta,
} from '@/lib/formulario-meta-funnel';

const SOLO_ADMIN = 'Sólo el administrador del negocio puede cambiar las fuentes.';

function bust() {
  try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
}

/** El id REAL del funnel que se mira (`null` = el del negocio) y su nombre. */
async function funnelReal(funnelId: number | null): Promise<{ id: number; nombre: string } | null> {
  const vivos = await productosAsignables();
  const f = funnelId == null ? vivos.find((x) => x.esDefault) : vivos.find((x) => x.id === funnelId);
  return f ? { id: f.id, nombre: f.nombre } : null;
}

export type FormularioFila = {
  clave: string;
  tipo: 'meta' | 'wg' | 'web';
  nombre: string;
  /** La página: la de Facebook (Meta) o la URL. */
  pagina: string | null;
  /** Cuántos leads o envíos tiene, si se sabe. */
  leads: number | null;
  /** El último envío (ISO), si se sabe. */
  ultimo: string | null;
  prendido: boolean;
  /** Los OTROS funnels a los que entra. */
  otros: string[];
  /** Sus reglas en este funnel. */
  reglas: { activa: boolean; n: number } | null;
};

export type EstadoFormularios = {
  ok: true;
  funnel: { id: number; nombre: string };
  meta: FormularioFila[] | null;
  /** `sin-meta` = el negocio no conectó Meta; otro texto = Meta no contestó. */
  metaError: string | null;
  web: FormularioFila[];
};

/** Los formularios de los tres tipos, para la pestaña «Formularios». Ninguna lectura tumba a las otras. */
export async function formulariosAction(funnelId: number | null): Promise<EstadoFormularios | { ok: false; error: string }> {
  await exigirSesion();
  try {
    const f = await funnelReal(funnelId);
    if (!f) return { ok: false, error: 'Ese funnel ya no existe.' };
    const [vivos, mapa, meta, asigMeta, landings, asigPiezas, paginas, envios] = await Promise.all([
      productosAsignables(), leerMapaReglas(), formulariosDeMeta().catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'Meta no contestó' })),
      leerAsignacionesMeta(), landingsConPiezas().catch(() => []), asignacionesDelNegocio().catch(() => ({})),
      paginasConEnvios(), enviosPorFormularioWeb(),
    ]);
    const nombreDe = (id: number) => vivos.find((x) => x.id === id)?.nombre ?? 'otro funnel';
    const reglasFila = (clave: string) => {
      const r = reglasDe(mapa, f.id, clave);
      return r ? { activa: r.activa, n: r.rutas.length } : null;
    };

    const filasMeta: FormularioFila[] | null = meta.ok
      ? meta.formularios.map((x) => {
        const funnels = asigMeta[x.id]?.funnels ?? [];
        return {
          clave: claveMeta(x.id), tipo: 'meta', nombre: x.nombre, pagina: meta.pagina, leads: x.leads, ultimo: x.ultimo,
          prendido: funnels.includes(f.id), otros: funnels.filter((id) => id !== f.id).map(nombreDe), reglas: reglasFila(claveMeta(x.id)),
        };
      })
      : null;

    // Los de Web Generator: formularios, encuestas y quizzes (la agenda y el pago no son formularios que se califiquen).
    const web: FormularioFila[] = [];
    const urlsWg = new Set<string>();
    for (const l of landings) {
      if (l.url) { const u = normalizarUrl(l.url); if (u) urlsWg.add(u); }
      for (const p of l.piezas) {
        if (p.tipo !== 'formulario' && p.tipo !== 'encuesta' && p.tipo !== 'quiz') continue;
        const asignados = (asigPiezas as Record<string, number[]>)[p.clave] ?? [];
        const e = p.formularioId ? envios?.get(p.formularioId) : undefined;
        web.push({
          clave: p.clave, tipo: 'wg', nombre: p.nombre, pagina: l.url, leads: envios ? e?.n ?? 0 : null, ultimo: e?.ultimo ?? null,
          prendido: asignados.includes(f.id), otros: asignados.filter((id) => id !== f.id).map(nombreDe), reglas: reglasFila(p.clave),
        });
      }
    }
    // Las páginas de afuera con el Pixel: las que ya mandaron algo, y las declaradas en /integraciones aunque no.
    const config = parsearConfig(await getSettingEstricto(CLAVE_LANDINGS).catch(() => null));
    const externas = new Map<string, { n: number; ultimo: string | null }>();
    for (const [pag, e] of paginas) if (!urlsWg.has(pag)) externas.set(pag, e);
    for (const c of config) if (!urlsWg.has(c.url) && !externas.has(c.url)) externas.set(c.url, { n: 0, ultimo: null });
    for (const [pag, e] of [...externas].sort((a, b) => String(b[1].ultimo ?? '').localeCompare(String(a[1].ultimo ?? '')))) {
      const asignados = landingDe(config, pag)?.funnelIds ?? [];
      web.push({
        clave: claveWeb(pag), tipo: 'web', nombre: pag.replace(/^https?:\/\//, '').replace(/\/$/, ''), pagina: pag, leads: e.n, ultimo: e.ultimo,
        prendido: asignados.includes(f.id), otros: asignados.filter((id) => id !== f.id).map(nombreDe), reglas: reglasFila(claveWeb(pag)),
      });
    }
    return { ok: true, funnel: f, meta: filasMeta, metaError: meta.ok ? null : meta.error, web };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer' };
  }
}

/** Las páginas de las que llegaron leads por el Pixel (`leads.pagina_registro`), con cuántos y el último. */
async function paginasConEnvios(): Promise<Map<string, { n: number; ultimo: string | null }>> {
  const out = new Map<string, { n: number; ultimo: string | null }>();
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('pagina_registro, created_at').not('pagina_registro', 'is', null)
      .order('created_at', { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as Array<{ pagina_registro: string | null; created_at: string | null }>) {
      const p = r.pagina_registro ? normalizarUrl(r.pagina_registro) : null;
      if (!p) continue;
      const e = out.get(p);
      if (e) e.n += 1; else out.set(p, { n: 1, ultimo: r.created_at });
    }
  } catch (e) {
    console.error('[fuentes] no se pudieron leer las páginas con envíos:', e instanceof Error ? e.message : e);
  }
  return out;
}

/** Envíos por formulario de Web Generator (`lead_formularios`, mig 0415). `null` = la tabla no está: no se sabe. */
async function enviosPorFormularioWeb(): Promise<Map<string, { n: number; ultimo: string | null }> | null> {
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('lead_formularios').select('formulario_id, created_at').not('formulario_id', 'is', null)
      .order('created_at', { ascending: false }).limit(5000);
    // Sin la tabla (la 0415 sin aplicar) o con la lectura caída: no se sabe cuántos, y la fila lo dice sin número.
    if (error) return null;
    const out = new Map<string, { n: number; ultimo: string | null }>();
    for (const r of (data ?? []) as Array<{ formulario_id: string; created_at: string }>) {
      const e = out.get(r.formulario_id);
      if (e) e.n += 1; else out.set(r.formulario_id, { n: 1, ultimo: r.created_at });
    }
    return out;
  } catch {
    return null;
  }
}

/** Prende o apaga UN formulario en este funnel: sus leads entran (o dejan de entrar) a su etapa de entrada. */
export async function alternarFormularioAction(funnelId: number | null, fuente: { clave: string; nombre: string }, prendido: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const clave = String(fuente?.clave ?? '');
  if (!claveFuenteValida(clave)) return { ok: false, error: 'Ese formulario no existe.' };
  try {
    const f = await funnelReal(funnelId);
    if (!f) return { ok: false, error: 'Ese funnel ya no existe.' };
    const tipo = tipoDeClave(clave);
    if (tipo === 'meta') {
      // Lectura ESTRICTA: con una caída leída como «nada», guardar borraría los otros formularios asignados.
      const antes = await leerAsignacionesMetaEstricto();
      await guardarAsignacionesMeta(alternarFormularioMeta(antes, clave.slice('meta:'.length), String(fuente.nombre ?? ''), f.id, prendido === true));
    } else if (tipo === 'wg') {
      if (!claveValida(clave)) return { ok: false, error: 'Ese formulario no existe.' };
      await asignarPieza(clave, f.id, prendido === true);
    } else {
      const pagina = normalizarUrl(clave.slice('web:'.length));
      if (!pagina) return { ok: false, error: 'Esa página no es una dirección válida.' };
      const actuales = parsearConfig(await getSettingEstricto(CLAVE_LANDINGS));
      const base = landingDe(actuales, pagina);
      if (!base && actuales.length >= MAX_LANDINGS) return { ok: false, error: `Ya tienes ${MAX_LANDINGS} páginas con el Pixel asignadas: quita una en Integraciones.` };
      const antes = base?.funnelIds ?? [];
      const funnelIds = prendido ? (antes.includes(f.id) ? antes : [...antes, f.id]) : antes.filter((x) => x !== f.id);
      const nueva = conLanding(actuales, base?.url ?? pagina, { funnelIds });
      if (!nueva) return { ok: false, error: 'Esa página no es una dirección válida.' };
      await setSetting(CLAVE_LANDINGS, JSON.stringify(nueva));
    }
    revalidatePath('/crm');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}

export type EstadoReglas = {
  ok: true;
  reglas: ReglasFormulario;
  preguntas: PreguntaVista[];
  etapas: Array<{ key: string; label: string; color: string }>;
  entrada: string;
  /** Lo que contestaron los últimos (hasta 200), para la vista previa en el navegador. */
  envios: Array<Record<string, string | string[]>>;
  /** Cuántos leads de este formulario hay en total (lo que «REAPLICAR» recorre). */
  total: number;
};

/** Los envíos de un formulario, con lo que hace falta para encontrarlos (los ids de Meta, la página de una landing). */
async function enviosDe(clave: string): Promise<EnvioDeFormulario[]> {
  const tipo = tipoDeClave(clave);
  if (tipo === 'meta') return enviosDeFormulario(clave, { leadIdsMeta: await leadIdsDeFormularioMeta(clave.slice('meta:'.length), 2000) });
  if (tipo === 'wg') {
    const landing = (await landingsConPiezas().catch(() => [])).find((l) => l.piezas.some((p) => p.clave === clave));
    return enviosDeFormulario(clave, { pagina: landing?.url ? normalizarUrl(landing.url) : null });
  }
  return enviosDeFormulario(clave);
}

/** Lo que necesita el editor de reglas de un formulario en este funnel. */
export async function reglasAction(funnelId: number | null, clave: string): Promise<EstadoReglas | { ok: false; error: string }> {
  await exigirSesion();
  if (!claveFuenteValida(clave)) return { ok: false, error: 'Ese formulario no existe.' };
  try {
    const f = await funnelReal(funnelId);
    if (!f) return { ok: false, error: 'Ese funnel ya no existe.' };
    const { etapasDeProducto } = await import('@/lib/lead-funnel');
    const { etapaDeEntrada } = await import('@/lib/lead-funnel-reglas');
    const [mapa, etapas, envios] = await Promise.all([leerMapaReglas(), etapasDeProducto(f.id), enviosDe(clave)]);
    let preguntas = preguntasDeEnvios(envios.slice(0, 500).map((e) => e.respuestas));
    if (!preguntas.length && tipoDeClave(clave) === 'meta') {
      preguntas = (await preguntasDeFormularioMeta(clave.slice('meta:'.length))).map((p) => ({ pregunta: p.pregunta, rotulo: p.rotulo, respuestas: p.opciones.map((o) => ({ valor: o, veces: 0 })) }));
    }
    return {
      ok: true,
      reglas: reglasDe(mapa, f.id, clave) ?? REGLAS_VACIAS,
      preguntas,
      etapas: etapas.map((s) => ({ key: s.key, label: s.label, color: s.dot ?? '#8A93A3' })),
      entrada: etapaDeEntrada(etapas) ?? 'lead',
      envios: envios.slice(0, 200).map((e) => e.respuestas as Record<string, string | string[]>),
      total: envios.length,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer' };
  }
}

/** Guarda las reglas de un formulario en este funnel (saneadas contra las etapas que el funnel tiene HOY). */
export async function guardarReglasAction(funnelId: number | null, clave: string, nombre: string, reglas: ReglasFormulario): Promise<{ ok: true; reglas: ReglasFormulario } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  if (!claveFuenteValida(clave)) return { ok: false, error: 'Ese formulario no existe.' };
  try {
    const f = await funnelReal(funnelId);
    if (!f) return { ok: false, error: 'Ese funnel ya no existe.' };
    const { etapasDeProducto } = await import('@/lib/lead-funnel');
    const etapas = await etapasDeProducto(f.id);
    const limpias = sanearReglas(reglas, etapas.map((s) => s.key));
    if (!limpias) return { ok: false, error: 'Esas reglas no se pueden leer.' };
    // ESTRICTA: con una lectura caída leída como «nada», guardar borraría las reglas de los demás formularios.
    const mapa = await leerMapaReglasEstricto();
    const vacias = !limpias.rutas.length && limpias.siNinguna == null;
    await guardarMapaReglas(conReglas(mapa, f.id, clave, vacias ? null : { ...limpias, nombre: String(nombre ?? '').slice(0, 160) }));
    return { ok: true, reglas: limpias };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}

/** Tope de leads por pasada: cada uno son unas pocas lecturas, y la acción corta al minuto. */
const TOPE_REAPLICAR = 400;

/**
 * Pasa las reglas GUARDADAS por los leads que ya entraron por este formulario y están en este funnel. Con `simular`, sólo
 * cuenta (la pregunta dice el número). Mueve sólo a los que están en la entrada o en una etapa que las reglas reparten.
 */
export async function reaplicarAction(funnelId: number | null, clave: string, simular: boolean): Promise<
  { ok: true; revisados: number; cambian: number; porEtapa: Array<{ etapa: string; label: string; n: number }>; tope: boolean } | { ok: false; error: string }
> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  if (!claveFuenteValida(clave)) return { ok: false, error: 'Ese formulario no existe.' };
  try {
    const f = await funnelReal(funnelId);
    if (!f) return { ok: false, error: 'Ese funnel ya no existe.' };
    const mapa = await leerMapaReglasEstricto();
    if (!reglasDe(mapa, f.id, clave)?.activa) return { ok: false, error: 'Prende la calificación automática y guarda las reglas primero.' };
    const envios = await enviosDe(clave);
    const lote = envios.slice(0, TOPE_REAPLICAR);
    const cuenta = new Map<string, { label: string; n: number }>();
    const cache = new Map<number, Array<{ key: string; label: string; kind?: string | null }>>();
    let cambian = 0;
    for (const e of lote) {
      const movs = await aplicarCalificacion(e.leadId, [clave], e.respuestas, { mapa, soloFunnel: f.id, simular: simular === true, cacheEtapas: cache });
      for (const m of movs) {
        cambian += 1;
        const c = cuenta.get(m.etapa);
        if (c) c.n += 1; else cuenta.set(m.etapa, { label: m.etiqueta, n: 1 });
      }
    }
    if (!simular && cambian) { bust(); revalidatePath('/crm'); }
    return { ok: true, revisados: lote.length, cambian, porEtapa: [...cuenta].map(([etapa, x]) => ({ etapa, ...x })), tope: envios.length > TOPE_REAPLICAR };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo reaplicar' };
  }
}
