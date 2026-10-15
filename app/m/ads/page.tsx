// =============================================================================
// /m/ads — «Ads Manager» en el teléfono: el período, el resumen y las campañas
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Ads Manager», y el prototipo (`data-ir="ads"`): segmentado de
// período, el resumen en tres filas (Importe gastado, Resultados, Coste por resultado), las
// campañas con su interruptor (prender / pausar con Deshacer), «Con problemas · N», y el sheet de
// una campaña con el presupuesto diario (+/−) y por qué no entrega. Crear y subir, en la computadora.
//
// Quién: la regla del Sidebar para `ads-manager` (sólo el admin del negocio). Quién ESCRIBE: el
// guard de las escrituras de escritorio (`wsDeAdsManager`, lib/ads-guard.ts), mirado aquí también
// para no ofrecer un interruptor que /api/meta-write va a rechazar. Y sólo si el workspace con el
// que escribiría es el MISMO que se está mirando: si no, el interruptor movería otra cuenta.
//
// ⚠️ El período sale de `?periodo=` (validado contra los tres); el workspace NUNCA de la URL.
// ⚠️ maxDuration 60: el rendimiento es una lectura paginada (getSenalesRecon) y el árbol de Meta
//    son varias páginas de la Graph API cuando la caché venció.
// =============================================================================

import { requireMovil } from '@/lib/movil-guard';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { hoyEnTijuana } from '@/lib/date-utils';
import { ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { AdsM } from './AdsM';
import { leerAds } from './datos';
import { periodoAdsDeParam } from './modelo';
import './ads.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdsPagina({ searchParams }: { searchParams: Promise<{ periodo?: string | string[] }> }) {
  const ctx = await requireMovil({ navKey: 'ads-manager' });
  const p = await searchParams;
  const periodo = periodoAdsDeParam(p.periodo);
  // El «hoy» de escritorio (AdsManagerView): los períodos terminan ayer, ver ./modelo.ts.
  const [lectura, op] = await Promise.all([leerAds(periodo.id, hoyEnTijuana()), wsDeAdsManager()]);
  const puedeOperar = typeof op === 'number' && op === ctx.ws;

  if (lectura.estado === 'sin_meta') {
    return (
      <PantallaM>
        <VacioM frase="Meta no está conectado en este negocio." />
        <ComputadoraM que="Conectar Meta en Integraciones" />
      </PantallaM>
    );
  }
  if (lectura.estado === 'token') {
    // Reintentar no lo arregla: la conexión se rehace en Integraciones.
    return (
      <PantallaM>
        <VacioM frase="La conexión con Meta venció." />
        <ComputadoraM que="Reconectar Meta en Integraciones" />
      </PantallaM>
    );
  }
  if (lectura.estado === 'error') {
    return (
      <PantallaM>
        <ErrorM frase="Meta no contestó. Vuelve a intentarlo en un momento." />
        <ComputadoraM que="Crear campañas y subir anuncios" />
      </PantallaM>
    );
  }

  return (
    <PantallaM>
      <AdsM periodo={periodo.id} lectura={lectura} puedeOperar={puedeOperar} />
      <ComputadoraM que="Crear campañas y subir anuncios" />
    </PantallaM>
  );
}
