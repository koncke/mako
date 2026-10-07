// =============================================================================
// Cron: la alerta de baja al dueño — clientes con 21 días sin contacto ni movimiento (#109)
// =============================================================================
// Una vez por día, temprano y ANTES del resumen de la mañana (vercel.json: `3 14 * * *`, o sea
// 14:03 UTC ≈ 8:03 en CDMX; el resumen sale 14:25), así un negocio que pidió juntar los avisos lo
// recibe en el resumen del mismo día. El minuto 3 no lo usa ningún otro cron diario ni el `*/5`.
// ⚠️ Sin esa entrada en vercel.json la alerta no corre NUNCA y nada falla: lo fija
// tests/cron-registrado.test.ts (el 07/10/2026 el route existía y la entrada no).
// La regla y el envío viven en lib/cs-sin-contacto.ts (lo puro, con test, en lib/cs-contacto.ts).
//
// ⚠️ NUNCA LE ESCRIBE A UN CLIENTE: el único envío es `emitirAviso` al grupo del dueño del
// negocio. Por eso no pasa por `envioWhatsappHabilitado` ni por el horario de mensajes, que
// gobiernan lo que se le escribe a un lead.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace` (la skill add-cron-job lo pide para la ingesta): ese
// helper itera los workspaces con una INTEGRACIÓN conectada, y Customer Success no tiene
// ninguna — un cliente sin WhatsApp ni Fathom puede tener clientes en silencio igual. Se recorre
// `listarWorkspaces` como objectives-vigilante y curso-sesiones, con la MISMA forma: secuencial,
// cada uno adentro de `runWithWorkspace` y con su propio `try`, así un workspace roto no le apaga
// la corrida a los demás.
//
// Y sólo los que TIENEN la tab (`tabEnCapa('customer-success', capa)`): avisarle a una capa que no
// compró Customer Success de clientes que no ve en ningún lado es venderle otra cosa. El super
// admin queda afuera: sus «clientes» son workspaces y su contacto con ellos no pasa por acá.
//
//   GET /api/cron/cs-sin-contacto          → corre y avisa (lo que agenda Vercel)
//   GET /api/cron/cs-sin-contacto?dry=1    → quiénes saldrían, sin mandar nada
//
// COSTO: cero tokens (lecturas de la base y aritmética). Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { avisarClientesSinContacto, type CorridaSinContacto } from '@/lib/cs-sin-contacto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const dry = req.nextUrl.searchParams.get('dry') === '1';

  let workspaces: Awaited<ReturnType<typeof listarWorkspaces>>;
  try {
    workspaces = await listarWorkspaces();
  } catch (e) {
    console.error('[cron:cs-sin-contacto] no pude listar workspaces:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }

  const conTab = workspaces.filter((w) =>
    w.estado === 'activo' && w.capa !== 'superadmin' && tabEnCapa('customer-success', w.capa));

  // UN `ahora` para toda la corrida: dos workspaces mirados con un minuto de diferencia no pueden
  // decidir distinto sobre el mismo umbral.
  const ahora = Date.now();
  const resultados: Array<{ ws: number; ok: boolean; resultado?: CorridaSinContacto; error?: string }> = [];
  for (const w of conTab) {
    try {
      const r = await runWithWorkspace(w.id, () => avisarClientesSinContacto(w.id, { ahora, dry }));
      resultados.push({ ws: w.id, ok: true, resultado: r });
      console.log(`[cron:cs-sin-contacto] ws=${w.id} clientes=${r.clientes} en_riesgo=${r.enRiesgo} ` +
        `avisados=${r.avisados} ya_avisados=${r.yaAvisados} en_espera=${r.enEspera}${r.apagado ? ' apagado' : ''}${dry ? ' (dry)' : ''}`);
    } catch (e) {
      console.error(`[cron:cs-sin-contacto] ws=${w.id} falló:`, msg(e));
      resultados.push({ ws: w.id, ok: false, error: msg(e) });
    }
  }

  // 500 sólo si fallaron TODOS los que había que mirar: que el monitoreo del cron lo vea. Sin
  // ninguno con la tab no hay nada roto.
  const ok = resultados.length === 0 || resultados.some((r) => r.ok);
  return Response.json({ ok, dry, workspaces: resultados }, { status: ok ? 200 : 500 });
}
