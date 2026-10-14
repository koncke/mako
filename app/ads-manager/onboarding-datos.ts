// =============================================================================
// onboarding-datos — qué le falta al Ads Manager de ESTE workspace (tarea #801)
// =============================================================================
// Los tres pasos del onboarding (lib/tab-onboarding-catalogo.ts → 'ads-manager') no
// se marcan con un botón: se DERIVAN de lo que hay. La page llama esto al abrir, y
// sólo mientras el onboarding esté pendiente — una vez cerrado, la tab no vuelve a
// pagar las lecturas.
//
//   am_cuenta   Meta conectado y la cuenta publicitaria se LEE (no alcanza el token
//               guardado: la prueba de vida es que Meta conteste con la cuenta).
//   am_pagina   la página que firma los anuncios: `META_PAGE_ID`, la misma que usa la
//               creación (`pageId()` en lib/meta-ads-create.ts). El nombre sale de
//               /me/accounts y es sólo para mostrarlo.
//   am_campana  la cuenta tiene al menos una campaña: un cliente que ya opera su cuenta
//               no tiene nada que ensayar.
//
// Sólo MARCA, nunca desmarca: un error de lectura de hoy no deshace lo que ya se vio
// andar (la regla de reels_contexto). Y marca en orden: `marcarPasoTab` no deja
// cerrar un paso con el anterior abierto.
// =============================================================================

import 'server-only';
import { getWorkspaceActual } from '@/lib/workspace';
import { credWs, integracionConectada } from '@/lib/credenciales';
import { getMetaHealth } from '@/lib/meta-health';
import { identidadesMeta } from '@/lib/meta-ads-create';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { pasoInicialAds, pasosCumplidos } from './onboarding-reglas';

export type CuentaOnboarding =
  | { ok: true; accountId: string | null; moneda: string; estado: string }
  | { ok: false; motivo: 'sin-conexion' | 'permisos' | 'lectura'; detalle: string | null };

export type OnboardingAds = {
  cuenta: CuentaOnboarding;
  pagina: { ok: boolean; nombre: string | null; instagram: string | null };
  campanas: number;
  /** El primer paso sin hacer, para retomar donde quedó. */
  pasoInicial: 'cuenta' | 'pagina' | 'campana';
};

/**
 * null = el onboarding está hecho (o no hay workspace del que leer): la tab abre
 * normal. Si no, lo que el wizard necesita para dibujar cada paso.
 */
export async function onboardingAdsPendiente(): Promise<OnboardingAds | null> {
  const ws = await getWorkspaceActual();
  if (ws == null) return null; // agencia sin impersonar: no hay cuenta propia que configurar
  const estado = await getEstadoTab('ads-manager');
  if (estado.status === 'done') return null;

  // ── am_cuenta ──
  let cuenta: CuentaOnboarding;
  let campanas = 0;
  if (!(await integracionConectada('meta', ws))) {
    cuenta = { ok: false, motivo: 'sin-conexion', detalle: null };
  } else {
    try {
      const h = await getMetaHealth();
      cuenta = { ok: true, accountId: h.account.accountId, moneda: h.account.currency, estado: h.account.statusLabel };
      campanas = h.campaigns.length;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      cuenta = e.name === 'MetaHealthPermisoError'
        ? { ok: false, motivo: 'permisos', detalle: null }
        : { ok: false, motivo: 'lectura', detalle: e.message };
    }
  }

  // ── am_pagina ── (sólo con la cuenta leída: sin ella no se puede anunciar igual)
  const pageId = cuenta.ok ? await credWs('META_PAGE_ID', ws) : null;
  let pagina: OnboardingAds['pagina'] = { ok: !!pageId, nombre: null, instagram: null };
  if (pageId) {
    try {
      const ids = await identidadesMeta();
      const p = ids.paginas.find((x) => x.id === pageId);
      pagina = { ok: true, nombre: p?.nombre ?? null, instagram: p?.instagram?.username ?? null };
    } catch { /* el nombre es para mostrar: sin él, el paso vale igual */ }
  }

  // Marcar lo que ya está, en orden. Best-effort: si settings falla, se dibuja igual.
  let s = estado;
  try {
    for (const paso of pasosCumplidos({ cuentaOk: cuenta.ok, paginaOk: pagina.ok, campanas })) {
      if (!s.steps[paso]?.done) s = await marcarPasoTab('ads-manager', paso);
    }
  } catch { /* el marcado es accesorio a servir la página */ }
  if (s.status === 'done') return null;

  const pasoInicial = pasoInicialAds({ am_cuenta: s.steps.am_cuenta?.done, am_pagina: s.steps.am_pagina?.done });
  return { cuenta, pagina, campanas, pasoInicial };
}
