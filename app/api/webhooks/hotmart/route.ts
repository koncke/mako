// =============================================================================
// Webhook: Hotmart → cada compra y cada carrito abandonado entran solos al CRM
// =============================================================================
// El productor pega en Hotmart («Ferramentas» → «Webhook») la dirección de esto y la MISMA
// en todas las cuentas: lo que dice de quién es el aviso es el `hottok`, el secreto de la cuenta
// de Hotmart que llega en el header `X-HOTMART-HOTTOK` y que el negocio pegó en /integraciones.
// El contrato completo, en docs/diseno-leads-scraper.md; la forma del cuerpo, en lib/hotmart-evento.ts.
//
// El orden, y cada paso tiene su porqué:
//   1. EL SECRETO del header, saneado (≤200). Sin él, 401: no hay a quién preguntarle nada.
//   2. DE QUIÉN ES, ESTRICTO: sha256(hottok) → `wsPorIdentificadorEstricto('hotmart', …)` (la fila
//      guarda el hash, nunca el secreto: lib/ruteo-hash.ts) → la credencial de ESE workspace con
//      `credWsEstricta`. «No pude leer» no es «no es de nadie»: va por `responderFalloDeRuteo`.
//   3. LA PRUEBA: el header tiene que ser IGUAL a la credencial de ese workspace (`igualesSeguro`,
//      tiempo constante). Sin workspace, o distinto: el MISMO 401, para no dejar saber qué hottok
//      es de un cliente de MaKo.
//   4. EL EVENTO (lib/hotmart-evento.ts) y la PUERTA (lib/fuentes-leads.ts), adentro de
//      `runWithWorkspace(ws, …)`: sin el contexto, getTenantDb cae al ws1 (Mauricio, un cliente).
//
// ⚠️ 5xx SÓLO A LO TRANSITORIO: lo que va a fallar igual en el próximo intento se contesta 200 con
// el motivo. No medido qué hace Hotmart con un no-2xx (si reintenta y cuánto): por eso un evento que
// no entra al CRM —un cambio de plan, un afiliado sin comprador— también es 200, con `ignorado`.
// ⚠️ Y LA DEDUPLICACIÓN es de la puerta: un reintento arma la misma línea del historial y no la
// repite (`anotarUnaVez`), y el lead se busca por contacto antes de crearse.

import type { NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { hashDeRuteo, igualesSeguro, secretoDelHeader } from '@/lib/ruteo-hash';
import { leerEventoHotmart, lineaDelHistorial } from '@/lib/hotmart-evento';
import { ingresarDeFuente } from '@/lib/fuentes-leads';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Un cuerpo más grande que esto no es un aviso de Hotmart (los de ejemplo pesan ~3 KB). */
const TOPE_CUERPO = 256 * 1024;

export async function GET() {
  return Response.json({ ok: true, endpoint: 'hotmart webhook', usage: 'POST con X-HOTMART-HOTTOK' });
}

export async function POST(req: NextRequest) {
  // ── 1. El secreto ──
  const hottok = secretoDelHeader(req.headers.get('x-hotmart-hottok'));
  if (!hottok) return Response.json({ ok: false, error: 'hottok' }, { status: 401 });

  // ── 2. De quién es: ESTRICTO ──
  let ws: number | null = null;
  let guardado: string | null = null;
  try {
    ws = await wsPorIdentificadorEstricto('hotmart', hashDeRuteo(hottok));
    guardado = ws == null ? null : await credWsEstricta('HOTMART_HOTTOK', ws);
  } catch (err) {
    // El identificador que se anota es un prefijo del HASH: el secreto no va a ningún log.
    return responderFalloDeRuteo('hotmart', err, `sha256:${hashDeRuteo(hottok).slice(0, 12)}`);
  }

  // ── 3. La prueba: el MISMO 401 para «no te conozco» y para «no coincide» ──
  if (ws == null || !igualesSeguro(guardado, hottok)) {
    console.warn(`[webhook:hotmart] hottok rechazado (ws ${ws ?? '—'})`);
    return Response.json({ ok: false, error: 'hottok' }, { status: 401 });
  }
  const wsFinal = ws;

  const raw = await req.text();
  if (raw.length > TOPE_CUERPO) return Response.json({ ok: false, error: 'demasiado_grande' }, { status: 413 });
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // ── 4. El evento y la puerta ──
  const ev = leerEventoHotmart(cuerpo);
  if ('ignorado' in ev) {
    console.log(`[webhook:hotmart] ws ${wsFinal}: ignorado — ${ev.ignorado}`);
    return Response.json({ ok: true, ignorado: ev.ignorado });
  }
  try {
    const r = await runWithWorkspace(wsFinal, () => ingresarDeFuente({
      fuente: 'hotmart',
      contacto: ev.contacto,
      linea: lineaDelHistorial(ev),
      creaLead: ev.creaLead,
      // Comprar, dejar un pago pendiente o abandonar el carrito ES la entrada «carrito» (decisión 9).
      // Un reembolso o una cancelación no meten a nadie en un funnel: sólo se anotan.
      ...(ev.tipo === 'compra' || ev.tipo === 'abandono' || ev.tipo === 'pendiente' ? { entrada: 'carrito' as const } : {}),
      utm: { source: ev.origen.src, content: ev.origen.sck },
    }));
    console.log(`[webhook:hotmart] ${ev.evento} ${ev.id} ws=${wsFinal}: ${r.estado}${'motivo' in r ? ` (${r.motivo})` : ''}`);
    return Response.json({ ok: true, evento: ev.evento, ...r });
  } catch (e) {
    const motivo = mensajeDeError(e).slice(0, 300);
    if (esErrorTransitorio(e)) {
      console.error(`[webhook:hotmart] ${ev.evento} ${ev.id} ws=${wsFinal} (TRANSITORIO) → 503: ${motivo}`);
      return Response.json({ ok: false, error: 'proceso', reintentar: true }, { status: 503 });
    }
    // El motivo va al log y NO al cuerpo: un error de la base puede traer el email del comprador.
    console.error(`[webhook:hotmart] ${ev.evento} ${ev.id} ws=${wsFinal} → 200, reintentar no lo arregla: ${motivo}`);
    return Response.json({ ok: false, error: 'proceso', reintentar: false });
  }
}
