'use server';

// =============================================================================
// servicio-actions — UNA integración, para abrir su modal desde otra pestaña
// =============================================================================
// Decimotercera tanda de Automations (12/10/2026, punto 5), Martín textual: «No crees un nuevo modal de conectar la
// API, reutiliza exactamente el mismo que ya tenemos en integraciones». Automations abre el `ServicioModal` de
// /integraciones para Zernio (app/integraciones/ServicioSuelto.tsx); el modal necesita la `Integracion` armada en el
// server (el catálogo de /metodo no viaja al navegador: lib/integraciones.ts, `delMetodo`).
//
// La cuenta es la de la grilla (`getIntegracion`, la misma `integracionDeDef`). El guard es el de quien GUARDA una
// credencial (app/api/integraciones/credencial/route.ts): el admin del workspace. Sin el gate del onboarding ni de la
// capa: una automatización que necesita Zernio lo necesita aunque la capa no liste la tarjeta.

import { requireRolWs } from '@/lib/tab-access';
import { getIntegracion, type Integracion } from '@/lib/integraciones';

export async function integracionAction(key: string): Promise<{ ok: true; integracion: Integracion } | { ok: false; error: string }> {
  try {
    await requireRolWs([], { gateOnboarding: false });
  } catch {
    return { ok: false, error: 'No tienes permiso para esto.' };
  }
  if (typeof key !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(key)) return { ok: false, error: 'Integración inválida.' };
  try {
    const i = await getIntegracion(key);
    return i ? { ok: true, integracion: i } : { ok: false, error: 'Esa integración no está.' };
  } catch (e) {
    console.error(`[integracionAction] ${key}: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude leer la integración.' };
  }
}
