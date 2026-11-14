// =============================================================================
// Hijo de tests/pixel-por-pagina.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `sinTrackingDelLead` (lib/pixel-por-pagina.ts) contra `landing_visits` y los ajustes de mentira (tests/_grupos-ops-arnes.ts),
// en el negocio 13. La tarjeta se dibuja en el test (react-dom/server no corre con --conditions=react-server).

import { db, decirResultado } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

async function main() {
  db.landing_visits = [
    { id: 1, workspace_id: 13, created_at: hace(2), landing_url: 'https://www.mauricio.com/vsl?utm_source=fb' },
    { id: 2, workspace_id: 13, created_at: hace(1), landing_url: 'https://mauricio.com/vsl/gracias' },
    // La página del formulario SÍ mide, pero en OTRO negocio: la lectura va por el negocio del lead.
    { id: 3, workspace_id: 11, created_at: hace(1), landing_url: 'https://mauricio.com/form' },
  ];
  db.app_settings.push({ id: 50, workspace_id: 13, key: 'landing.config', value: JSON.stringify([{ url: 'https://mauricio.com/webinar', funnelIds: [5] }, { url: 'https://mauricio.com/vsl', funnelIds: [6] }]) });
  const { runWithWorkspace } = await import('../lib/workspace');
  const { sinTrackingDelLead } = await import('../lib/pixel-por-pagina');
  const en13 = <T>(f: () => Promise<T>) => runWithWorkspace(13, f);
  const out: Record<string, unknown> = {};
  out.formulario = await en13(() => sinTrackingDelLead({ pagina_registro: 'https://mauricio.com/form', origen_lead: 'landing', funnel_id: 6, created_at: hace(3) }));
  out.vsl = await en13(() => sinTrackingDelLead({ pagina_registro: 'https://mauricio.com/vsl', origen_lead: 'landing', funnel_id: 6, created_at: hace(3) }));
  out.webinar = await en13(() => sinTrackingDelLead({ pagina_registro: null, origen_lead: 'calendly', funnel_id: 5, created_at: hace(3) }));
  out.funnelQueMide = await en13(() => sinTrackingDelLead({ pagina_registro: null, origen_lead: null, funnel_id: 6, created_at: hace(3) }));
  out.meta = await en13(() => sinTrackingDelLead({ pagina_registro: null, origen_lead: 'instant_form', meta_lead_id: '123', funnel_id: 5 }));
  out.sinFunnel = await en13(() => sinTrackingDelLead({ pagina_registro: null, origen_lead: 'landing', funnel_id: 99, created_at: hace(3) }));

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
