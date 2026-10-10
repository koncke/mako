// =============================================================================
// /admin/estrategia — la estrategia de MaKo en UNA tab, sólo super admin
// =============================================================================
// Pedido de Martín (10/10/2026): «tenemos runway, tenemos una de análisis de
// costos, y mucha info desparramada» → todo en una sola tab, gráfico, simple y con
// poco texto, «como está la de estrategia». Reemplaza a /vsl/estrategia (que
// redirige acá) y lee los números del runway y del modelo de costos, sin copiarlos.
//
// ⚠️ EL GUARD ES EL MISMO QUE /admin/runway: el rol de AGENCIA (getSesionAdmin),
// no `rol_ws` —que vale 'admin' para el dueño de CADA workspace y abriría esto a
// todos los clientes—. Y el proxy ya cierra /admin/* para quien no es admin
// (SOLO_ADMIN en proxy.ts): son dos cerrojos, y éste es el que no depende de la ruta.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader } from '@/app/_ui';
import Estrategia from './Estrategia';
import { MEDIDO, hoyAR } from './datos';

export const dynamic = 'force-dynamic';

export default async function EstrategiaPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  // ⚠️ «Hoy» se calcula ACÁ, en cada request, y en la hora de Argentina. A nivel
  // módulo (como runway/page.tsx:60) una instancia caliente se queda con la fecha
  // de su primera carga, y en UTC después de las 21 h ya es mañana.
  const hoy = hoyAR();

  return (
    <Pagina>
      <PageHeader
        titulo="Strategy"
        estado={
          <span style={{
            fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11.5, color: 'var(--faint)',
            border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap',
          }}>Runway al {MEDIDO}</span>
        }
      />
      <Estrategia hoy={hoy} />
    </Pagina>
  );
}
