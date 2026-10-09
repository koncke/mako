import 'server-only';

// =============================================================================
// crm-curso-al-ganar — MaKo invita SOLO al curso cuando un lead pasa a Ganado
// =============================================================================
// Pedido de Martín (07/10/2026, por la sesión de Customer Success): «poder automatizar la
// invitación al curso cuando un lead cae a Ganado, así no se tiene que estar invitando
// manualmente... Pero que sea opcional, activar esa automatización». Las reglas, sin base, viven
// en lib/crm-curso-al-ganar-reglas.ts (con test).
//
// ⚠️ ACÁ NO SE INVITA: se DECIDE CUÁNDO. La invitación es UNA y es de Customer Success
// (`invitarAlCursoSinSesion`, lib/curso-invitar.ts): la misma que el botón «Invitar» de la ficha,
// con su idempotencia (reclama la fila antes del mail, así dos disparos del mismo Ganado no mandan
// dos), su «cortado gana» y su «nunca crea una cuenta». La primera versión de este archivo la
// armaba pieza por pieza, y eran dos invitaciones que iban a divergir. Lo que es del CRM: el
// interruptor por embudo, el enganche en los caminos que ganan, y la línea en el historial.
//
// ⚠️ NUNCA TIRA HACIA QUIEN MUEVE AL LEAD. Ganar es lo que importa; el mail es una consecuencia.
// Un fallo acá no puede deshacer un movimiento a Ganado que ya se escribió.
// =============================================================================

import { after } from 'next/server';
import { getWorkspaceActual, runWithWorkspace } from './workspace';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { clasesDelProducto } from './curso-datos';
import { logLeadEvent } from './leads';
import { idDelFunnelDefault, productoDeFunnel } from './funnels';
import { CURSO_AL_GANAR_KEY, conCursoAlGanar, lineaDelCurso, parsearCursoAlGanar } from './crm-curso-al-ganar-reglas';

const MAKO = 'MaKo';

/** Los embudos que invitan solos. Ilegible o caído = ninguno (lib/settings.ts no tira). */
export async function embudosQueInvitan(): Promise<number[]> {
  return parsearCursoAlGanar(await getSetting(CURSO_AL_GANAR_KEY));
}

/**
 * Prende o apaga UN embudo.
 *
 * ⚠️ LEE ESTRICTO: con la base caída, `getSetting` devuelve null, y escribir encima la lista
 * «vacía + éste» apagaría en silencio los otros embudos que alguien había prendido.
 */
export async function cambiarCursoAlGanar(funnelId: number, prendido: boolean): Promise<number[]> {
  const actuales = parsearCursoAlGanar(await getSettingEstricto(CURSO_AL_GANAR_KEY));
  const nuevos = conCursoAlGanar(actuales, funnelId, prendido);
  await setSetting(CURSO_AL_GANAR_KEY, JSON.stringify(nuevos));
  return nuevos;
}

/**
 * Lo que el tablero necesita para dibujar la opción en la columna Ganado. `null` = no se ofrece:
 * el producto del embudo no tiene clases (no hay curso al que invitar) o no se pudo leer. Nunca tira.
 */
export async function estadoCursoAlGanar(funnelId: number | null): Promise<{ prendido: boolean } | null> {
  try {
    const real = funnelId ?? (await idDelFunnelDefault());
    if (real == null) return null;
    const producto = (await productoDeFunnel([real])).get(real);
    if (!producto) return null;
    const [clases, prendidos] = await Promise.all([clasesDelProducto(producto.id), embudosQueInvitan()]);
    if (!clases.length) return null;
    return { prendido: prendidos.includes(real) };
  } catch (e) {
    console.error('[curso-auto] no pude leer si el embudo invita al ganar:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * El enganche «al ganar». Lo llaman los TRES lugares que pasan un lead a Ganado: updateLead
 * (lib/leads.ts), el plan de pagos (`saveLeadPlanManual`, lib/pagos.ts) y la etapa de un producto
 * agregado (`moverEtapaEnProducto`, lib/lead-funnel.ts). `funnelId` = el embudo donde ganó, real o
 * `null` (= el del negocio, como en `leads.funnel_id`).
 *
 * ⚠️ BARATO SI ESTÁ APAGADO, que es el caso de todos: una lectura de un setting y sale. Y el
 * trabajo va POR DETRÁS (`after`): el mail tarda, y quien movió al lead no puede quedarse
 * esperando. Fuera de un request —un script— `after` tira y se hace en línea. El molde es
 * lib/curso-avance.ts.
 *
 * ⚠️ NUNCA TIRA. Ver la cabecera.
 */
export async function alGanarInvitarAlCurso(p: { leadId: number; funnelId: number | null }): Promise<void> {
  try {
    const prendidos = await embudosQueInvitan();
    if (!prendidos.length) return;
    const real = p.funnelId ?? (await idDelFunnelDefault());
    if (real == null || !prendidos.includes(real)) return;
    const ws = await getWorkspaceActual();
    if (ws == null) return;
    const trabajo = async () => {
      try {
        const { invitarAlCursoSinSesion } = await import('./curso-invitar');
        // ⚠️ AL CURSO DEL PRODUCTO DONDE GANÓ (09/10/2026, punto 7 del audio del 08/10 a la noche). Sin
        // el producto, el acceso nacía en NULL = «todos sus productos», el mail nombraba todos los que
        // ve, y desde ahí ninguna invitación por producto lo podía acotar (un NULL ya usado no se
        // achica: `productosTrasInvitar`, lib/curso-invitar-reglas.ts). Un embudo sin producto sigue
        // como antes (null).
        const productoId = (await productoDeFunnel([real])).get(real)?.id ?? null;
        const r = await invitarAlCursoSinSesion({ ws, leadId: p.leadId, autor: MAKO, productoId });
        await logLeadEvent(p.leadId, 'Curso', lineaDelCurso(r), MAKO);
      } catch (e) {
        console.error(`[curso-auto] lead ${p.leadId}: la invitación automática falló:`, e instanceof Error ? e.message : e);
      }
    };
    try {
      after(() => runWithWorkspace(ws, trabajo));
      return;
    } catch { /* sin request: en línea */ }
    await runWithWorkspace(ws, trabajo);
  } catch (e) {
    console.error(`[curso-auto] lead ${p.leadId}: no pude decidir si invitarlo:`, e instanceof Error ? e.message : e);
  }
}
