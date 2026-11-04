import 'server-only';

// =============================================================================
// /newsletters — lo que dibuja la tab, leído de una vez (la página y cada acción lo vuelven a pedir)
// =============================================================================

import { getTenantDb } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { envioEmailHabilitado } from '@/lib/envio-flags';
import { remitenteEsSandbox } from '@/lib/resend';
import { listarFunnels } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { landingsDelWorkspace } from '@/lib/landing-config-leer';
import { landingDe, type LandingConfig } from '@/lib/landing-config';
import { urlPublicaLanding } from '@/lib/app-url';
import { tzActual } from '@/lib/timezone';
import {
  anclaDeLaProxima, conteoPorEtapa, crmDelNewsletter, leerConfigNewsletter, listarEdiciones, suscriptosDe,
  type CrmNewsletter, type Edicion,
} from '@/lib/newsletter';
import { proximaEdicion, type ConfigNewsletter } from '@/lib/newsletter-reglas';

export type LandingDelNewsletter = { url: string; titulo: string; enNewsletter: boolean };

export type EstadoNewsletter = {
  config: ConfigNewsletter;
  crm: CrmNewsletter | null;
  conteo: Record<string, number>;
  ediciones: Edicion[];
  /** La fecha que MaKo propone para la próxima (`proximaEdicion`), o null sin frecuencia. */
  proxima: string | null;
  /** El envío REAL de email de este negocio (lib/envio-flags.ts). Apagado: se prueba, se programa, no sale. */
  envioReal: boolean;
  /** ¿Tiene un remitente propio (su dominio verificado)? Sin él no sale nada, tampoco la prueba. */
  remitentePropio: boolean;
  landings: LandingDelNewsletter[];
  /** Los CRM del negocio: para «traer de otro CRM» en la importación. */
  funnels: Array<{ id: number; nombre: string; esDefault: boolean }>;
  /** A dónde va la prueba: el email de quien está mirando. */
  emailPrueba: string | null;
  zona: string;
  /** Lo que no se pudo leer, en palabras (la pantalla lo dice; no se dibuja «0» por un fallo). */
  fallos: string[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Las landings que pueden sumar suscriptos: las del Web Generator publicadas y las que el negocio declaró en el Pixel. */
async function landingsDe(crmId: number | null): Promise<LandingDelNewsletter[]> {
  const db = await getTenantDb();
  const [{ data, error }, declaradas] = await Promise.all([
    db.from('landing_docs').select('id, titulo, slug, publicado_at, papelera_at').not('publicado_at', 'is', null).is('papelera_at', null).order('id'),
    landingsDelWorkspace(),
  ]);
  if (error) throw new Error(error.message);
  const out: LandingDelNewsletter[] = [];
  const vistas = new Set<string>();
  const en = (cfg: LandingConfig | null) => crmId != null && !!cfg?.funnelIds?.includes(crmId);
  for (const d of (data ?? []) as Array<{ titulo: string | null; slug: string | null }>) {
    if (!d.slug) continue;
    const url = urlPublicaLanding(d.slug);
    const cfg = landingDe(declaradas, url);
    vistas.add(cfg?.url ?? url);
    out.push({ url, titulo: (d.titulo ?? '').trim() || d.slug, enNewsletter: en(cfg) });
  }
  for (const l of declaradas) if (!vistas.has(l.url)) out.push({ url: l.url, titulo: l.url.replace(/^https?:\/\//, ''), enNewsletter: en(l) });
  return out;
}

export async function leerEstadoNewsletter(): Promise<EstadoNewsletter> {
  const fallos: string[] = [];
  const config = await leerConfigNewsletter();
  const crm = await crmDelNewsletter(config);
  const [subs, ediciones, envioReal, sandbox, landings, funnels, sesion, zona] = await Promise.all([
    crm ? suscriptosDe(crm.id).catch((e) => { fallos.push(`los suscriptos (${msg(e)})`); return null; }) : Promise.resolve([]),
    crm ? listarEdiciones(crm.id).catch((e) => { fallos.push(`las ediciones (${msg(e)})`); return [] as Edicion[]; }) : Promise.resolve([] as Edicion[]),
    envioEmailHabilitado().catch(() => false),
    remitenteEsSandbox().catch(() => true),
    landingsDe(crm?.id ?? null).catch((e) => { fallos.push(`tus landings (${msg(e)})`); return [] as LandingDelNewsletter[]; }),
    listarFunnels(),
    getUsuarioActual().catch(() => null),
    tzActual().catch(() => 'America/Argentina/Buenos_Aires'),
  ]);
  return {
    config, crm,
    conteo: subs ? conteoPorEtapa(subs) : {},
    ediciones,
    proxima: proximaEdicion(config.frecuencia, anclaDeLaProxima(ediciones)),
    envioReal,
    remitentePropio: !sandbox,
    landings,
    funnels: funnels.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault })),
    emailPrueba: (sesion?.email ?? '').trim() || null,
    zona,
    fallos,
  };
}
