// =============================================================================
// /leads — lista de todos los leads
// =============================================================================

import Link from 'next/link';
import { listLeads, estadoMadurezLead, type Lead } from '@/lib/leads';
import { getPendientesDeMarcar, getCampaignNameMap, resolverNombreCampana, type PendienteItem } from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';
import { PendienteActions } from './PendienteActions';
import { LeadsBrowser, type EnrichedLead, type LeadsParams } from './LeadsBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Origen SIEMPRE legible (Fase 12 + v3 Fase B): nombre del anuncio > campaña
// Meta > utm_campaign (resuelto a nombre si es ID numérico) > "Directo".
// Nunca un ID pelado.
function origenLegibleLista(
  lead: Lead,
  campMap: Record<string, string>,
): { texto: string; tooltip: string | null } {
  const nombreMeta = lead.meta_ad_name?.trim() || lead.meta_campaign_name?.trim();
  if (nombreMeta) return { texto: nombreMeta, tooltip: null };
  if (lead.utm_campaign?.trim()) {
    const r = resolverNombreCampana(lead.utm_campaign, campMap);
    if (r.texto) return { texto: r.texto, tooltip: r.tooltip };
  }
  if (lead.meta_lead_id || lead.meta_ad_id) {
    return { texto: 'Meta · sin nombre', tooltip: lead.meta_ad_id ?? lead.meta_lead_id };
  }
  return { texto: 'Directo', tooltip: null };
}

function origenClase(lead: Lead): EnrichedLead['_origenClase'] {
  if (lead.meta_lead_id) return 'instant_form';
  if (lead.fecha_agenda) return 'calendly';
  return 'otro';
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadsParams & { pendientes?: string }>;
}) {
  const sp = await searchParams;
  const soloPendientes = sp.pendientes === '1';

  let leads: Awaited<ReturnType<typeof listLeads>> = [];
  let pendientesItems: PendienteItem[] = [];
  let campMap: Record<string, string> = {};
  let errorMsg: string | null = null;
  try {
    [leads, campMap] = await Promise.all([listLeads(), getCampaignNameMap()]);
    if (soloPendientes) {
      pendientesItems = (await getPendientesDeMarcar(hoyEnTijuana())).items;
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // Modo "pendientes": vista dedicada con resolución en dos taps (Fase 9)
  if (soloPendientes && !errorMsg) {
    const porId = new Map(leads.map((l) => [l.id, l]));
    return (
      <main className="min-h-screen w-full px-6 py-8 md:px-12 md:py-12 bg-[var(--bg)] text-[var(--text)]">
        <header className="mb-8">
          <Link href="/general" className="text-base" style={{ color: 'var(--text-dim)' }}>
            ← Vista General
          </Link>
          <h1
            className="mt-2 text-[46px] md:text-[62px] tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
          >
            Pendientes de marcar
          </h1>
          <p className="mt-1 text-base" style={{ color: 'var(--text-dim)' }}>
            {pendientesItems.length === 0
              ? 'Nada pendiente — todos los datos manuales están al día.'
              : `${pendientesItems.length} dato${pendientesItems.length === 1 ? '' : 's'} sin marcar. Resolvé cada uno acá sin abrir la ficha.`}
            {'  '}
            <Link href="/leads" className="ml-2" style={{ color: 'var(--accent-yellow)' }}>
              Ver todos los leads →
            </Link>
          </p>
        </header>

        {pendientesItems.length === 0 ? (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <p className="text-lg" style={{ color: 'var(--accent-green)' }}>
              🟢 Todo marcado. El tablero está leyendo datos frescos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendientesItems.map((p) => {
              const lead = porId.get(p.lead_id);
              return (
                <div
                  key={`${p.lead_id}-${p.tipo}`}
                  className="rounded-xl border p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                >
                  <div>
                    <Link
                      href={`/leads/${p.lead_id}`}
                      className="text-lg font-medium"
                      style={{ color: 'var(--accent-yellow)' }}
                    >
                      {p.lead_nombre}
                    </Link>
                    <p className="text-base mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {p.mensaje}
                    </p>
                  </div>
                  <PendienteActions
                    leadId={p.lead_id}
                    tipo={p.tipo}
                    motivoActual={lead?.motivo_perdida ?? null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-6 py-8 md:px-12 md:py-12 bg-[var(--bg)] text-[var(--text)]">
      {/* HEADER */}
      <header className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/"
              className="text-base"
              style={{ color: 'var(--text-dim)' }}
            >
              ← Dashboard
            </Link>
          </div>
          <h1
            className="text-[46px] md:text-[62px] tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}
          >
            Leads
          </h1>
          <p className="mt-1 text-base" style={{ color: 'var(--text-dim)' }}>
            {leads.length === 0
              ? 'Aún sin leads. Crea el primero para empezar.'
              : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} en total`}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="px-5 py-3 rounded-lg font-medium text-base"
          style={{ background: 'var(--accent-yellow)', color: '#000' }}
        >
          + Nuevo lead
        </Link>
      </header>

      {errorMsg ? (
        <div
          className="rounded-lg p-6 border"
          style={{ borderColor: 'var(--accent-orange)', background: '#2a1410' }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--accent-orange)' }}>
            Error consultando Supabase
          </p>
          <p className="text-base font-mono" style={{ color: 'var(--text-dim)' }}>
            {errorMsg}
          </p>
        </div>
      ) : leads.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <p className="text-lg mb-4" style={{ color: 'var(--text-dim)' }}>
            No tienes leads todavía.
          </p>
          <Link
            href="/leads/new"
            className="inline-block px-5 py-3 rounded-lg font-medium text-base"
            style={{ background: 'var(--accent-yellow)', color: '#000' }}
          >
            Crear primer lead
          </Link>
        </div>
      ) : (
        <LeadsBrowser leads={leads.map((l) => enriquecer(l, campMap))} initial={sp} />
      )}
    </main>
  );
}

// Enriquece un lead con la madurez y el origen legible (lib/leads es
// server-only, así que esto se calcula acá y se pasa ya listo al cliente).
function enriquecer(lead: Lead, campMap: Record<string, string>): EnrichedLead {
  return {
    ...lead,
    _madurez: estadoMadurezLead(lead),
    _origen: origenLegibleLista(lead, campMap),
    _origenClase: origenClase(lead),
  };
}
