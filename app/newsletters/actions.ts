'use server';

// =============================================================================
// /newsletters — las acciones de la tab (todas con la puerta de la tab: ./puerta.ts, sólo la plataforma mientras esté en PRONTO)
// =============================================================================
// UNA EDICIÓN ES UN BROADCAST: crear, guardar, la vista previa, la prueba, programar y enviar pasan por
// lib/email-marketing.ts, igual que desde /email. Lo propio del newsletter (el CRM, la config, la lectura) es
// lib/newsletter.ts.
//
// ⚠️ ENVIAR CON EL ENVÍO REAL APAGADO QUEMA LA EDICIÓN (lib/api-mako/areas/email.run.ts, la cabecera): `enviarBroadcast`
// la registra «simulado» y la marca «enviada» para siempre. Por eso «Enviar ahora» se niega acá con el envío apagado; se
// puede probar (a tu email) y programar (queda esperando: el cron la saltea hasta que el envío se prenda).
// =============================================================================

import { puertaNewsletter } from './puerta';
import { getUsuarioActual } from '@/lib/auth';
import { envioEmailHabilitado } from '@/lib/envio-flags';
import { setSetting } from '@/lib/settings';
import { CONFIG_KEY, conLanding, landingDe } from '@/lib/landing-config';
import { landingsDelWorkspace } from '@/lib/landing-config-leer';
import {
  actualizarBroadcast, eliminarBroadcast, enviarBroadcast, enviarBroadcastPrueba, vistaPreviaBroadcast,
} from '@/lib/email-marketing';
import {
  asegurarCrmNewsletter, crearEdicion, edicionDe, guardarConfigNewsletter, leerConfigNewsletter, ligarCopyDeEdicion, listarEdiciones,
  registrarPermiso, traerEdicionDelCopy,
} from '@/lib/newsletter';
import { proponerEdicion } from '@/lib/newsletter-ia';
import {
  ETAPAS_NEWSLETTER_KEYS, MAX_TEMA, frecuenciaDeTexto, segmentoDeNewsletter, type EtapaNewsletter,
} from '@/lib/newsletter-reglas';
import { docDeEdicion } from '@/lib/newsletter-copy';
import { crear as crearGuion } from '@/lib/copywriter/server';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { plantillaPorId } from '@/lib/copywriter/plantillas';
import { leerEstadoNewsletter, type EstadoNewsletter } from './estado';

type Ok<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const puerta = puertaNewsletter;
const mal = (e: unknown, def: string): { ok: false; error: string } => ({ ok: false, error: e instanceof Error && e.message ? e.message : def });
const idOk = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const EDITABLE = new Set(['borrador', 'programado', 'cancelado']);

async function conEstado<T extends object>(r: T): Promise<{ ok: true; estado: EstadoNewsletter } & T> {
  return { ok: true, ...r, estado: await leerEstadoNewsletter() };
}

/** La edición, si es de este negocio y se puede tocar. */
async function editable(id: unknown) {
  if (!idOk(id)) throw new Error('Falta la edición.');
  const e = await edicionDe(id);
  if (!e) throw new Error('Esa edición no existe.');
  return e;
}

export async function recargarAction(): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try { return { ok: true, estado: await leerEstadoNewsletter() }; } catch (e) { return mal(e, 'No pude leer tu newsletter.'); }
}

// ── La apertura: MaKo pregunta, sin IA ───────────────────────────────────────
/**
 * Lo que contestó la persona a la pregunta de MaKo. La frecuencia se lee de la pastilla o de sus palabras; el tema, tal
 * cual. Con las dos respuestas se crea el CRM «Newsletter» (si no estaba).
 */
export async function responderAperturaAction(paso: 'frecuencia' | 'tema', texto: string): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
    if (paso === 'frecuencia') {
      const f = frecuenciaDeTexto(t);
      if (!f) return { ok: false, error: 'Elige cada semana, cada 15 días o una vez al mes.' };
      await guardarConfigNewsletter({ frecuencia: f });
    } else {
      if (!t) return { ok: false, error: 'Cuéntame de qué trata.' };
      await guardarConfigNewsletter({ tema: t.slice(0, MAX_TEMA) });
    }
    const cfg = await leerConfigNewsletter();
    if (cfg.frecuencia && cfg.tema) await asegurarCrmNewsletter();
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude guardar tu respuesta.');
  }
}

/** La idea de la próxima edición, con la IA del negocio. Sin IA, el error dice por qué y la tab sigue sin ella. */
export async function proponerEdicionAction(): Promise<Ok<{ asunto: string; idea: string }>> {
  await puerta();
  try {
    const cfg = await leerConfigNewsletter();
    const anteriores = cfg.funnelId ? (await listarEdiciones(cfg.funnelId).catch(() => [])).map((e) => e.asunto) : [];
    return await proponerEdicion(cfg, anteriores);
  } catch (e) {
    return mal(e, 'MaKo no pudo proponer la edición.');
  }
}

/** Cambia la frecuencia, el tema o cuántas sin abrir lo duermen (desde «Ajustes» de la tab). */
export async function guardarAjustesAction(p: { frecuencia?: string; tema?: string; dormidoTras?: number }): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const patch: Parameters<typeof guardarConfigNewsletter>[0] = {};
    if (p.frecuencia !== undefined) {
      const f = frecuenciaDeTexto(p.frecuencia);
      if (!f) return { ok: false, error: 'Esa frecuencia no la conozco.' };
      patch.frecuencia = f;
    }
    if (p.tema !== undefined) patch.tema = p.tema;
    if (p.dormidoTras !== undefined) patch.dormidoTras = p.dormidoTras;
    await guardarConfigNewsletter(patch);
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude guardar.');
  }
}

// ── Cómo entran ──────────────────────────────────────────────────────────────
/**
 * Prende o apaga «los que dejan su email en esta landing entran al Newsletter»: el CRM se suma a los de la página en el
 * Pixel (`landing.config`, el mismo lugar que /integraciones). Los CRM que ya tenía la página se conservan; sin ninguno
 * (iban al del negocio), pasan a ir sólo al Newsletter. Apagarlo saca sólo el Newsletter.
 */
export async function landingAlNewsletterAction(url: string, prender: boolean): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const crm = await asegurarCrmNewsletter();
    const actuales = await landingsDelWorkspace();
    const previos = landingDe(actuales, url)?.funnelIds ?? [];
    const funnelIds = prender ? [...new Set([...previos, crm.id])] : previos.filter((id) => id !== crm.id);
    const nuevas = conLanding(actuales, url, { funnelIds });
    if (!nuevas) return { ok: false, error: 'Esa dirección no parece una página web.' };
    await setSetting(CONFIG_KEY, JSON.stringify(nuevas));
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude guardar la landing.');
  }
}

/**
 * Antes de importar o traer de otro CRM, quien suma dice que le dieron permiso. Queda escrito en la config del newsletter
 * con quién y cuándo (los últimos 50): el registro del consentimiento de lo que se sumó a mano.
 */
export async function permisoParaSumarAction(origen: 'importar' | 'otro-crm'): Promise<Ok<{ crmId: number }>> {
  await puerta();
  try {
    const crm = await asegurarCrmNewsletter();
    const quien = (await getUsuarioActual())?.email ?? 'alguien del equipo';
    await registrarPermiso({ origen, quien });
    return { ok: true, crmId: crm.id };
  } catch (e) {
    return mal(e, 'No pude abrir la importación.');
  }
}

// ── Las ediciones ────────────────────────────────────────────────────────────
export async function nuevaEdicionAction(p: { asunto?: string; idea?: string } = {}): Promise<Ok<{ id: number; estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const crm = await asegurarCrmNewsletter();
    const id = await crearEdicion(crm.id, { asunto: p.asunto, cuerpo: p.idea ?? '' });
    return conEstado({ id });
  } catch (e) {
    return mal(e, 'No pude crear la edición.');
  }
}

export async function guardarEdicionAction(id: number, p: { asunto?: string; preheader?: string | null; cuerpo?: string; etapa?: string | null }): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (!EDITABLE.has(e.estado)) return { ok: false, error: 'Una edición enviada ya no se cambia.' };
    const crm = await asegurarCrmNewsletter();
    let segmento: string | undefined;
    if (p.etapa !== undefined) {
      const etapa = p.etapa && (ETAPAS_NEWSLETTER_KEYS as readonly string[]).includes(p.etapa) ? (p.etapa as EtapaNewsletter) : null;
      segmento = segmentoDeNewsletter(crm.id, etapa);
    }
    await actualizarBroadcast(id, {
      asunto: p.asunto?.slice(0, 200), preheader: p.preheader === undefined ? undefined : (p.preheader?.slice(0, 200) || null),
      cuerpo: p.cuerpo?.slice(0, 20_000), segmento,
    });
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude guardar la edición.');
  }
}

export async function eliminarEdicionAction(id: number): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (e.estado !== 'borrador' && e.estado !== 'cancelado') return { ok: false, error: 'Sólo se borra un borrador. Si está programada, desprográmala antes.' };
    await eliminarBroadcast(id);
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude borrar la edición.');
  }
}

/**
 * Escribir la edición en el Copywriter: crea su guion la primera vez (la plantilla «Newsletter» si el Copywriter ya la
 * tiene; si no, la de email) con lo que la edición ya traía, y devuelve a dónde ir.
 */
export async function escribirEnCopywriterAction(id: number): Promise<Ok<{ href: string }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (e.copy_doc_id) return { ok: true, href: `/copywriter/${e.copy_doc_id}` };
    const cats = await catalogosDelCopywriter();
    const plantilla = plantillaPorId(cats, 'newsletter') ?? plantillaPorId(cats, 'email');
    const contenido = docDeEdicion(plantilla ? plantilla.esqueleto() : null, { asunto: e.asunto === 'Nueva edición' ? '' : e.asunto, preheader: e.preheader, cuerpo: e.cuerpo });
    const r = await crearGuion({ tipo: 'email', titulo: e.asunto, contenido, emoji: '📰', props: { plantilla: plantilla?.id ?? null } });
    if (!r.ok) return { ok: false, error: r.error };
    await ligarCopyDeEdicion(id, r.pagina.id);
    return { ok: true, href: `/copywriter/${r.pagina.id}` };
  } catch (e) {
    return mal(e, 'No pude abrir el Copywriter.');
  }
}

/** Lo que sale es lo que está escrito en el Copywriter (`traerEdicionDelCopy`, lib/newsletter.ts). */
const sincronizarDelCopywriter = traerEdicionDelCopy;

export async function traerDelCopywriterAction(id: number): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    await editable(id);
    await sincronizarDelCopywriter(id);
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude traer el texto del Copywriter.');
  }
}

export async function vistaPreviaAction(id: number): Promise<Ok<{ asunto: string; html: string }>> {
  await puerta();
  try {
    await editable(id);
    await sincronizarDelCopywriter(id);
    return await vistaPreviaBroadcast(id);
  } catch (e) {
    return mal(e, 'No pude armar la vista previa.');
  }
}

/** La prueba va SÓLO al email de quien la pide: con el envío apagado es la única forma de verla en una casilla. */
export async function pruebaAction(id: number): Promise<Ok<{ a: string }>> {
  await puerta();
  try {
    await editable(id);
    const a = ((await getUsuarioActual())?.email ?? '').trim();
    if (!a.includes('@')) return { ok: false, error: 'Tu usuario no tiene un email donde mandarte la prueba.' };
    await sincronizarDelCopywriter(id);
    const r = await enviarBroadcastPrueba(id, a);
    return r.ok ? { ok: true, a } : { ok: false, error: r.error ?? 'No salió la prueba.' };
  } catch (e) {
    return mal(e, 'No salió la prueba.');
  }
}

export async function programarAction(id: number, cuandoIso: string): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (!EDITABLE.has(e.estado)) return { ok: false, error: 'Esa edición ya salió.' };
    const t = Date.parse(cuandoIso);
    if (!Number.isFinite(t)) return { ok: false, error: 'Elige el día y la hora.' };
    if (t < Date.now() + 5 * 60_000) return { ok: false, error: 'Elige un momento al menos 5 minutos más adelante.' };
    await sincronizarDelCopywriter(id);
    const ya = await edicionDe(id);
    if (!ya?.asunto.trim() || !ya.cuerpo.trim()) return { ok: false, error: 'Antes de programarla, escribe el asunto y el cuerpo.' };
    await actualizarBroadcast(id, { programado_at: new Date(t).toISOString(), estado: 'programado' });
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude programarla.');
  }
}

export async function desprogramarAction(id: number): Promise<Ok<{ estado: EstadoNewsletter }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (e.estado !== 'programado') return { ok: true, estado: await leerEstadoNewsletter() };
    await actualizarBroadcast(id, { programado_at: null, estado: 'borrador' });
    return conEstado({});
  } catch (e) {
    return mal(e, 'No pude desprogramarla.');
  }
}

export async function enviarAction(id: number): Promise<Ok<{ estado: EstadoNewsletter; enviados: number }>> {
  await puerta();
  try {
    const e = await editable(id);
    if (!EDITABLE.has(e.estado)) return { ok: false, error: 'Esa edición ya salió.' };
    // ⚠️ PROGRAMADA NO SALE CON «ENVIAR AHORA» (la revisión del 30/10/2026, M2): si el cron la está tomando en ese momento, los
    // dos leen «nadie la recibió» antes de la primera tanda, y cada suscripto la recibe dos veces. La API se niega igual
    // (`enviar_broadcast`, lib/api-mako/areas/email.run.ts).
    if (e.estado === 'programado') return { ok: false, error: 'Está programada: mandarla ahora puede duplicar el envío. Primero desprográmala.' };
    if (!(await envioEmailHabilitado())) {
      return { ok: false, error: 'El envío de email de tu negocio está apagado: con él apagado no sale nada. Mándate una prueba.' };
    }
    await sincronizarDelCopywriter(id);
    const r = await enviarBroadcast(id);
    if (!r.ok) return { ok: false, error: r.error ?? 'No salió.' };
    return conEstado({ enviados: r.enviados });
  } catch (e) {
    return mal(e, 'No salió la edición.');
  }
}
