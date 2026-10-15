// =============================================================================
// /api/meta-health — estado de entrega en vivo de Meta (cuenta + campañas +
// conjuntos + anuncios + sugerencias). Live, sin tocar Supabase.
// =============================================================================
// Lo consume la vista /marketing/salud para el botón "Actualizar" (refetch del
// lado cliente). El Semáforo de /general NO pasa por acá: llama la lib directo.

//
// ⚠️ SÓLO QUIEN ADMINISTRA EL WORKSPACE (guardAdsWs, auditoría de seguridad, 14/10/2026). Trae el
// balance, el gasto, el tope y el MEDIO DE PAGO de la cuenta (`fundingCard`), y las pantallas que
// lo muestran (/ads-manager, /integraciones, /anuncio, /general) son sólo admin. La ruta sólo
// miraba que Meta estuviera conectada: un closer o un setter lo pedía con su cookie. Las cuatro
// hermanas de insights (ad-, account-, entity-insights y meta-recommendations) llevan el mismo
// corte, igual que el resto de Ads Manager.

import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { integracionConectada } from '@/lib/credenciales';
import { MONEDA_META_POR_DEFECTO } from '@/lib/presupuesto-cambio';
import { guardAdsWs } from '@/lib/ads-guard';

export const dynamic = 'force-dynamic';

// Fase 1: Meta es la integración global del dueño. Para un cliente nuevo
// devolvemos un MetaHealth vacío y benigno (cuenta "gris"/sin conexión, sin
// campañas) para que /marketing/salud muestre "sin conexión" en vez de romper.
// No lleva key `error` a propósito: el cliente solo entra en estado de error si
// la respuesta trae `error`.
const HEALTH_SIN_CONEXION: MetaHealth = {
  account: {
    accountId: null,
    status: 0,
    statusLabel: 'Sin conexión',
    disableReason: 0,
    disableReasonLabel: null,
    balanceMxn: 0,
    balanceUsd: 0,
    amountSpentMxn: 0,
    spendCapMxn: null,
    isPrepay: false,
    fundingCard: null,
    timezoneName: null,
    country: null,
    currency: MONEDA_META_POR_DEFECTO,
    severidad: 'gris',
    entregaFrenada: false,
  },
  campaigns: [],
  adsets: [],
  ads: [],
  resumen: { activos: 0, aprendizaje: 0, enRevision: 0, pausados: 0, rechazados: 0 },
  recomendaciones: [],
  recosMetaDisponibles: false,
  parcial: false,
  fetchedAtISO: new Date().toISOString(),
};

export async function GET() {
  const no = await guardAdsWs();
  if (no) return no;
  if (!(await integracionConectada('meta'))) {
    return Response.json({ ...HEALTH_SIN_CONEXION, fetchedAtISO: new Date().toISOString() });
  }
  try {
    const health = await getMetaHealth();
    return Response.json(health);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
