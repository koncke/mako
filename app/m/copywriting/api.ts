// =============================================================================
// /m/copywriting — las escrituras, por las MISMAS rutas que escritorio
// =============================================================================
//   · escribir un guion: POST /api/onboarding/razones { action: 'guion-auto', id } — lo que hacen
//     «Escribir el próximo guion» (AdsWriterApp.tsx) y la celda sin guion de la matriz (MatrizView.tsx);
//   · valorar un guion: POST /api/ads-analyst/valorar { guion } — «Valorar guion» (AnalizarGuion.tsx).
// Las dos miran el rol en la ruta (resolverWsAdmin y soloAdminAdsAnalyst: sólo el admin del negocio),
// así que el teléfono no le suma puerta (docs/hallazgos-mobile.md, «La revisión de la tanda 2»).
// ⚠️ Cada `fetch` lleva su tope (maxDuration de la ruta + margen): sin `signal`, un corte de red deja
//    el botón girando para siempre.
// ⚠️ La respuesta de la matriz trae TODO el estado (razones y avatares): se adopta entero, nunca se
//    arma a mano (escritorio pagó eso: un guardado con una copia vieja borraba guiones).
// =============================================================================

import type { GuionItem } from '@/lib/guion-estado';
import type { Valoracion } from '@/lib/ads-analyst';
import { TOPE_VALORAR_MS, mensajeDeFallo } from '@/app/ads-writer/analizar';
import { avatarLite, celdaM, type AvatarLite, type CeldaM } from './modelo';

/** `maxDuration` de /api/onboarding/razones (120 s) más un margen: más allá, la respuesta ya no llega. */
export const TOPE_ESCRIBIR_MS = 125_000;

export type ResultadoEscribir =
  | { ok: true; celdas: CeldaM[]; avatares: AvatarLite[]; guionNuevo: GuionItem | null }
  | { ok: false; error: string };

type Crudo = { ok?: boolean; error?: string; razones?: unknown; avatares?: unknown; guionNuevo?: unknown; valoracion?: unknown };

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Que MaKo escriba un guion para esta celda (elige el ángulo y la estructura solo). */
export async function escribirGuion(celdaId: string): Promise<ResultadoEscribir> {
  try {
    const r = await fetch('/api/onboarding/razones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'guion-auto', id: celdaId }),
      signal: AbortSignal.timeout(TOPE_ESCRIBIR_MS),
    });
    const j = (await r.json().catch(() => null)) as Crudo | null;
    if (!j?.ok) return { ok: false, error: String(j?.error || 'No se pudo generar el guion.') };
    const razones = Array.isArray(j.razones) ? j.razones.filter(esObj) : [];
    const avatares = Array.isArray(j.avatares) ? j.avatares.filter(esObj) : [];
    return {
      ok: true,
      celdas: razones.map((c) => celdaM(c as unknown as CeldaM)),
      avatares: avatares.map((a) => avatarLite(a as unknown as AvatarLite)),
      guionNuevo: esObj(j.guionNuevo) ? (j.guionNuevo as unknown as GuionItem) : null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ResultadoValorar = { ok: true; valoracion: Valoracion } | { ok: false; error: string };

/** La valoración de un guion que todavía no corrió en Meta. La ruta lo guarda en el historial. */
export async function valorarGuion(guion: string): Promise<ResultadoValorar> {
  try {
    const r = await fetch('/api/ads-analyst/valorar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guion }),
      signal: AbortSignal.timeout(TOPE_VALORAR_MS),
    });
    const j = (await r.json().catch(() => null)) as Crudo | null;
    if (!j?.ok || !esObj(j.valoracion)) return { ok: false, error: String(j?.error || 'No se pudo valorar el guion.') };
    return { ok: true, valoracion: j.valoracion as unknown as Valoracion };
  } catch (e) {
    return { ok: false, error: mensajeDeFallo('valorar', e) };
  }
}

/**
 * Copiar al portapapeles. Devuelve si copió DE VERDAD (escritorio lo aprendió: sin clipboard el catch
 * se tragaba el error y el botón decía «Copiado» igual). Sin la API (un navegador viejo, un contexto
 * que no la da), el camino de siempre: un textarea seleccionado y `execCommand('copy')`.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* cae al camino viejo */ }
  try {
    const t = document.createElement('textarea');
    t.value = texto;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed'; t.style.opacity = '0'; t.style.top = '0'; t.style.left = '0';
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch {
    return false;
  }
}
