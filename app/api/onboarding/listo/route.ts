// =============================================================================
// /api/onboarding/listo — con qué se dibuja la pantalla final del onboarding
// =============================================================================
// GET → { ok, tareas, leads, retro, pendientes[], config[] }
//
// La pantalla que reemplazó al redirect a /plan ofrece caminos, y un camino solo
// sirve si dice CUÁNTO hay del otro lado: «revisá tu plan» es un link, «tenés 14
// tareas esperándote» es una razón. Todo lo que devuelve esto son números y
// estados REALES del workspace, nunca promesas.
//
// ⚠️ CERO PASOS RECORDADOS. `pendientes` y `config` salen de preguntar cómo está
// hoy el workspace (`pendientesOnboarding` ya cruza el flag `postergado` con la
// conexión real), no de un flag guardado el día que se cerró el wizard. Es la regla
// de la casa —estado vivo, no recordado— y acá pesa más que en ningún lado: esta
// pantalla se puede volver a ver, y ofrecerle a alguien «conectá Meta» cuando ya lo
// conectó es la forma más rápida de que deje de leer lo que MaKo le ofrece.
// =============================================================================

import { runWithWorkspace, getCapaActual, getTenantDb } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { capaDef, navEnCapa } from '@/lib/capas';
import { pendientesOnboarding } from '@/lib/onboarding-pendientes';
import { integracionConectada } from '@/lib/credenciales';
import { TAB_ONBOARDINGS } from '@/lib/tab-onboarding-catalogo';
import { onboardingTabPendiente } from '@/lib/tab-onboarding-state';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * El orden en que se le ofrece «terminar de configurar». No es alfabético ni el del
 * catálogo: es el orden en que las tabs se vuelven útiles una detrás de otra —
 * primero se escribe el guion (Copy Generator), después se filma (Video Generator),
 * y los canales al final porque sirven para repartir lo que ya se produjo.
 *
 * Una tab que no esté acá igual aparece, al final: la lista ORDENA, no filtra. Que
 * agregar un onboarding nuevo lo esconda de esta pantalla sería el peor default.
 */
const ORDEN_CONFIG = ['ads-writer', 'video-generator', 'whatsapp', 'setting', 'instagram', 'carousels', 'reels', 'stories', 'email'];

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });

  return runWithWorkspace(ws, async () => {
    const capa = capaDef(await getCapaActual());

    // Las tres cuentas van juntas y con `catch` propio: ninguna puede tumbar la
    // pantalla que le acaba de decir al cliente que ya terminó. Un cero es peor que
    // un error solo si miente, y acá el cero se lee como «todavía no hay», que es
    // exactamente lo que pasa cuando la consulta falla en un workspace recién creado.
    const db = await getTenantDb().catch(() => null);
    // Abiertas = lo que todavía tiene que hacer. Las `hecho` no cuentan: el número
    // que se le muestra es el trabajo que le espera, no el histórico.
    const contarTareas = async (): Promise<number> => {
      if (!db) return 0;
      try {
        const { count, error } = await db.from('experimento_tareas').select('id', { count: 'exact', head: true }).neq('estado', 'hecho');
        return error ? 0 : (count ?? 0);
      } catch { return 0; }
    };
    const contarLeads = async (): Promise<number> => {
      if (!db) return 0;
      try {
        const { count, error } = await db.from('leads').select('id', { count: 'exact', head: true });
        return error ? 0 : (count ?? 0);
      } catch { return 0; }
    };

    const [tareas, leads, retro, pendientes] = await Promise.all([
      contarTareas(),
      contarLeads(),
      // ¿Tiene con qué hacer una Retro? La Retro cruza ads, leads, llamadas y plata;
      // sin la fuente de los ads no hay informe, hay una hoja vacía.
      integracionConectada('meta').catch(() => false),
      pendientesOnboarding().catch(() => []),
    ]);

    // Lo que le falta configurar, solo de las tabs que su capa VE: ofrecerle
    // configurar Instagram a alguien que no compró Instagram es venderle otra cosa
    // en la pantalla donde acaba de terminar de comprar esta.
    const config: Array<{ key: string; titulo: string; href: string }> = [];
    for (const def of Object.values(TAB_ONBOARDINGS)) {
      if (!navEnCapa(def.key, capa.id)) continue;
      if (!(await onboardingTabPendiente(def.key).catch(() => false))) continue;
      // El nombre DECLARADO, no uno derivado del título. Recortarle el prefijo al
      // título con un regex daba «generador de video» y «email» — medido contra el
      // catálogo real. Ver el campo `nombre` en lib/tab-onboarding-catalogo.ts.
      config.push({ key: def.key, titulo: def.nombre ?? def.titulo, href: def.href ?? `/${def.key}` });
    }
    const rank = (k: string) => { const i = ORDEN_CONFIG.indexOf(k); return i < 0 ? ORDEN_CONFIG.length : i; };
    config.sort((a, b) => rank(a.key) - rank(b.key));

    return Response.json({ ok: true, tareas, leads, retro, pendientes, config });
  });
}
