// =============================================================================
// Tab Pendientes — la operación diaria, fuera de Vista General (v3 Fase G)
// =============================================================================
// Cuatro bloques: datos sin marcar (los más viejos primero, para limpiar el
// atraso que infla el no-show), tus juntas, la cola de acción, y los
// formularios sin agenda con su flujo de nutrición.
// =============================================================================

import {
  getPendientesDeMarcar,
  getJuntasProximas,
  getColaDeAccion,
  getFormulariosSinAgenda,
  type Pendientes,
  type JuntaProxima,
  type ColaItem,
  type FormSinAgenda,
} from '@/lib/queries';
import { ayerEnTijuana, hoyEnTijuana } from '@/lib/date-utils';
import { DashboardHeader } from '../_components/DashboardHeader';
import { DashboardTabs } from '../_components/DashboardTabs';
import { TusJuntas } from '../_components/TusJuntas';
import { SinMarcarList, ColaList, FormulariosList } from './PendientesLists';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PendientesPage() {
  const ayerReal = ayerEnTijuana();
  const hoyReal = hoyEnTijuana();

  let pend: Pendientes = { items: [], total: 0, porTipo: { A: 0, B: 0, C: 0 } };
  let juntas: JuntaProxima[] = [];
  let cola: ColaItem[] = [];
  let forms: FormSinAgenda[] = [];
  let errorMsg: string | null = null;

  try {
    [pend, juntas, cola, forms] = await Promise.all([
      getPendientesDeMarcar(hoyReal),
      getJuntasProximas(hoyReal, 2),
      getColaDeAccion(hoyReal),
      getFormulariosSinAgenda(hoyReal),
    ]);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // Datos sin marcar: los más VIEJOS primero (limpiar el atraso, Fase G PASO 3).
  const sinMarcar = [...pend.items].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  // La cola muestra solo lo que NO es "marcar asistencia" (eso vive arriba).
  const colaOtros = cola.filter((i) => i.tipo !== 'pendiente_marcar' && i.tipo !== 'j1_sin_j2');

  const totalPendientes = sinMarcar.length + colaOtros.length + forms.length;

  return (
    <main className="min-h-screen w-full px-6 py-8 md:px-12 md:py-12 bg-[var(--bg)] text-[var(--text)]">
      <DashboardHeader fechaAyer={ayerReal} hoyReal={hoyReal} />
      <DashboardTabs active="pendientes" />

      {errorMsg ? (
        <div className="rounded-lg p-6 border" style={{ borderColor: 'var(--accent-orange)', background: '#2a1410' }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--accent-orange)' }}>Error consultando Supabase</p>
          <p className="text-base font-mono" style={{ color: 'var(--text-dim)' }}>{errorMsg}</p>
        </div>
      ) : (
        <div className="space-y-8 md:space-y-10">
          <header>
            <h1 className="text-[40px] md:text-[52px] tracking-tight leading-tight" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
              Pendientes
            </h1>
            <p className="mt-1 text-base" style={{ color: 'var(--text-dim)' }}>
              {totalPendientes === 0
                ? 'Todo al día — nada pendiente por ahora.'
                : `${totalPendientes} cosa${totalPendientes === 1 ? '' : 's'} por hacer. Marcá los datos viejos primero para corregir las tasas.`}
            </p>
          </header>

          {/* 1) DATOS SIN MARCAR (prioridad: limpia el atraso) */}
          <section>
            <h2 className="text-[28px] mb-1" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
              Datos sin marcar {sinMarcar.length > 0 && <span className="text-lg" style={{ color: 'var(--accent-orange)' }}>· {sinMarcar.length}</span>}
            </h2>
            <p className="text-base mb-3" style={{ color: 'var(--text-dim)' }}>
              Marcá asistencia (Sí/No) o la resolución. Los más viejos primero — cada marca corrige el no-show y las tasas.
            </p>
            <SinMarcarList items={sinMarcar} />
          </section>

          {/* 2) TUS JUNTAS */}
          <TusJuntas juntas={juntas} />

          {/* 3) COLA DE ACCIÓN */}
          <section>
            <h2 className="text-[28px] mb-3" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
              Cola de acción {colaOtros.length > 0 && <span className="text-lg" style={{ color: 'var(--text-dim)' }}>· {colaOtros.length}</span>}
            </h2>
            <ColaList items={colaOtros} />
          </section>

          {/* 4) FORMULARIOS SIN AGENDA (nutrición) */}
          <section>
            <h2 className="text-[28px] mb-1" style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500 }}>
              Formularios sin agenda {forms.length > 0 && <span className="text-lg" style={{ color: 'var(--text-dim)' }}>· {forms.length}</span>}
            </h2>
            <p className="text-base mb-3" style={{ color: 'var(--text-dim)' }}>
              Dejaron el instant form y no agendaron. Corré la nutrición (WhatsApp+email 7 días); si no responde, resolvé como “No responde”.
            </p>
            <FormulariosList items={forms} />
          </section>
        </div>
      )}
    </main>
  );
}
