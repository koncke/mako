// =============================================================================
// Cron: reporte SEMANAL — lunes ~7:00 AM Tijuana (14:00 UTC) — POR WORKSPACE
// =============================================================================
// Resumen de la semana pasada (ads, wins, cobranza). Se despacha por WhatsApp +
// email (según prefs). Auth: Bearer CRON_SECRET.
//
// ⚠️ DESDE EL 06/10/2026 LE LLEGA A CADA CLIENTE, NO SÓLO AL DUEÑO. Hasta acá el cuerpo
// corría UNA vez y fuera de todo `runWithWorkspace`: `getWorkspaceActual()` caía al ws1
// (lib/notify.ts, lib/settings.ts), así que salía el de Mauricio y nadie más — con el
// semanal en la lista que ve cada cliente (AVISOS_DEL_CLIENTE) y prendido por defecto.
// Decisión de Martín: «b: solo el semanal para los clientes». Los crons diario y horario
// NO se tocan: siguen siendo sólo del dueño, a propósito.
//
// Cada workspace corre ADENTRO de `runWithWorkspace(w.id, …)`, y eso es lo que hace que
// cada lectura y cada envío sean de ESE cliente: las preferencias, los destinatarios
// (`getDestinatarios`) y los números del reporte (`getTenantDb`).
// El mail sale firmado por MaKo (`REMITENTE_MAKO`, en `despacharReporte`).
//
// ⛔ EL REPORTE YA NO SALE POR WHATSAPP. Salía por el Chatwoot del workspace (sólo el ws1 lo
// tenía completo), que se borró el 09/10/2026 con toda la integración (ver lib/notify.ts).
// `?dry=1` lo dice por workspace (`waSinCanal`) a quien lo tenga pedido.
//
// Modos:
//   ?dry=1[&ws=N] → lista a quién le mandaría (destinos enmascarados), sin armar el
//                   reporte ni mandar nada.
//   &ws=N         → sólo ese workspace (activo).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { estadoAviso, getContactoReportes, getNotifPrefs } from '@/lib/perfil';
import { getDestinatarios } from '@/lib/notif-destinatarios';
import { buildReporteSemanal } from '@/lib/reportes';
import { despacharReporte } from '@/lib/notify';
import { idDeMensaje } from '@/lib/disparador-mensaje';
import { decidirReporte, destinosDelReporte, enmascararDestino } from '@/lib/reporte-destino';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ResultadoWs = { ws: number; modo: 'enviado' | 'dry' | 'salteado' | 'error'; [k: string]: unknown };

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * El reporte de UN workspace. Se llama SÓLO adentro de `runWithWorkspace(ws, …)`: todo lo
 * que lee y manda resuelve el workspace por el contexto, no por parámetro.
 */
async function reporteDelWorkspace(ws: number, dry: boolean): Promise<ResultadoWs> {
  const [perfil, prefs, lista, mensaje] = await Promise.all([
    getContactoReportes(), getNotifPrefs(), getDestinatarios(),
    estadoAviso(ws, idDeMensaje('reporte_semanal')),
  ]);
  const destinos = destinosDelReporte(lista, perfil);
  const decision = decidirReporte({ activo: prefs.semanal.activo && mensaje.activo, canal: prefs.semanal, destinos });
  if (!decision.sale) return { ws, modo: 'salteado', motivo: decision.motivo };

  if (dry) {
    return {
      ws, modo: 'dry',
      wa: prefs.semanal.wa ? destinos.telefonos.map(enmascararDestino) : [],
      email: prefs.semanal.email ? destinos.emails.map(enmascararDestino) : [],
      waSinCanal: prefs.semanal.wa ? true : null,
    };
  }

  const rep = await buildReporteSemanal(prefs);
  const despacho = await despacharReporte(rep, prefs.semanal, perfil);
  return { ws, modo: 'enviado', despacho };
}

export async function GET(req: NextRequest) {
  const fail = checkCronAuth(req);
  if (fail) return fail;

  const t0 = Date.now();
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const wsParam = Number(url.searchParams.get('ws'));
  const wsExplicito = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : null;

  let activos: Array<{ id: number }>;
  try {
    activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (err) {
    console.error(`[cron:reporte-semanal] no pude listar workspaces: ${msg(err)}`);
    return Response.json({ ok: false, error: msg(err) }, { status: 500 });
  }
  const objetivo = wsExplicito ? activos.filter((w) => w.id === wsExplicito) : activos;
  if (wsExplicito && objetivo.length === 0) {
    return Response.json({ ok: false, error: `workspace ${wsExplicito} inexistente o pausado` }, { status: 404 });
  }

  const resultados: ResultadoWs[] = [];
  for (const w of objetivo) {
    try {
      resultados.push(await runWithWorkspace(w.id, () => reporteDelWorkspace(w.id, dry)));
    } catch (err) {
      // Un workspace que falla no corta a los demás.
      console.error(`[cron:reporte-semanal] ws ${w.id}: ${msg(err)}`);
      resultados.push({ ws: w.id, modo: 'error', error: msg(err) });
    }
  }

  // Si fallaron TODOS, 500: con 200 el monitoreo de Vercel no se entera.
  const errores = resultados.filter((r) => r.modo === 'error').length;
  const todoFallo = resultados.length > 0 && errores === resultados.length;
  return Response.json(
    {
      ok: !todoFallo, dry,
      total: resultados.length,
      enviados: resultados.filter((r) => r.modo === 'enviado').length,
      salteados: resultados.filter((r) => r.modo === 'salteado').length,
      errores,
      workspaces: resultados,
      ms: Date.now() - t0,
    },
    { status: todoFallo ? 500 : 200 },
  );
}
