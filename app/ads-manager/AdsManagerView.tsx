// =============================================================================
// La vista del Ads Manager, compartida por sus DOS rutas
// =============================================================================
// La renderizan igual /ads-manager y /ads-manager/<ad_id> (el deep link a un
// anuncio): mismo guard, mismos datos, misma pantalla. Vive acá para que agregar
// la ruta del anuncio no duplique 80 líneas de header + filtro + browser.
// =============================================================================
// Tabla estilo Meta: ordenable por columna, multiselección, columnas
// configurables, primera columna fija, encender/apagar y editar presupuesto
// (CBO/ABO) en la celda. El estado de entrega es live (Meta vía /api/meta-health);
// el rendimiento (senales) + CRM enriquecen las columnas.

import { getSenalesRecon, type SenalRecon } from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha } from '@/lib/date-utils';
import { CampanasBrowser } from './CampanasBrowser';
import { OnboardingAdsManager } from './OnboardingAdsManager';
import { onboardingAdsPendiente } from './onboarding-datos';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export async function AdsManagerView({
  searchParams,
  adInicial = null,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
  /** ad_id de Meta a abrir al entrar (viene de /ads-manager/<ad_id>). */
  adInicial?: string | null;
}) {
  await requireRolWs([], { nav: 'ads-manager' });
  const ayerReal = ayerEnTijuana();
  const hoyReal = hoyEnTijuana();
  const params = await searchParams;
  const desdeParam = params.desde;
  const hastaParam = params.hasta;
  const filtroActivo =
    !!desdeParam && !!hastaParam && esFechaValida(desdeParam) && esFechaValida(hastaParam) &&
    desdeParam <= hastaParam && hastaParam <= hoyReal;
  const rangoDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const rangoHasta = filtroActivo ? hastaParam! : ayerReal;

  // El núcleo es el ESTADO en vivo (browser → /api/meta-health). El rendimiento
  // (senales/Supabase) enriquece; si falla, degradamos a columnas "—".
  let senales: SenalRecon[] = [];
  let perfError: string | null = null;
  try {
    senales = await getSenalesRecon(rangoDesde, rangoHasta);
  } catch (err) {
    perfError = err instanceof Error ? err.message : String(err);
  }

  // Tarea #801: mientras falte la cuenta, la página o la primera campaña, la tab abre en
  // su onboarding (con salida). Los pasos se derivan de lo que hay: un cliente que ya
  // opera su cuenta no lo ve nunca. Si la derivación falla, se sirve la tabla.
  const onboarding = await onboardingAdsPendiente().catch(() => null);
  if (onboarding) {
    return <OnboardingAdsManager datos={onboarding} senales={senales} desde={rangoDesde} hasta={rangoHasta} adInicial={adInicial} hoyReal={hoyReal} />;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
      {perfError && (
        <div style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-fill)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 13.5, color: 'var(--warn)', fontWeight: 600 }}>Sin datos de rendimiento.</span>
          <span style={{ fontSize: 13, color: 'var(--dim)' }}> Mostrando solo el estado de entrega en vivo; las columnas de gasto/agendas/cierres quedan en “—”.</span>
        </div>
      )}
      {/* El título va ADENTRO del browser: el botón de «Nueva campaña» tiene que vivir en
          la misma fila que él (pedido del 05/10) y esa fila la dibuja un componente de
          cliente, porque los botones abren modales con estado. */}
      <CampanasBrowser senales={senales} desde={rangoDesde} hasta={rangoHasta} adInicial={adInicial} hoyReal={hoyReal} />
    </main>
  );
}
