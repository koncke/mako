// =============================================================================
// GET /api/cron/vigia-grupos — el vigía de los grupos de MaKo, sin depender de un chat
// =============================================================================
// Pedido de Martín (17/10/2026): «que SIEMPRE se esté leyendo todos los grupos de MaKo
// en WhatsApp con clientes». Lo que ESTE archivo arregla no es el vigía: es de QUIÉN
// dependía que corriera.
//
// ⚠️ POR QUÉ EXISTE. Hasta el 24/10/2026 al vigía lo disparaba un `CronCreate`, que es
// session-only y vence a los 7 días, y vivía en la sesión de un chat de OTRA cuenta de
// Claude. Medido ese día: la marca había quedado en `2026-10-21T23:40Z` — TRES DÍAS
// parado, con 3 incidentes acumulados (dos vivos), y no lo avisó ningún sistema: lo notó
// Martín a ojo («veo que hay muchos errores»). Un guardia que depende de que un chat esté
// abierto no es un guardia. Un cron de Vercel corre sin que nadie tenga nada abierto.
//
// LO QUE NO HACE, y es la regla que el vigía lleva escrita desde el 17/10: NO escribe en
// los grupos, NO le manda nada a nadie y NO toca un dato de un cliente. Sólo lee. El
// aviso al grupo cuando algo se arregla es de quien arregla, nunca del vigía.
//
// QUÉ HACE CON LO QUE ENCUENTRA. Antes el informe lo leía una persona en la terminal de
// un chat; con el cron no hay nadie leyendo, así que cada incidente entra por la MISMA
// puerta que ya usan los errores de la app (regla del 17/10): un ticket de bug del
// sistema en la Ticketera, idempotente por `ref`. Así queda a la vista sin depender de
// ninguna sesión.
//
// ⚠️ LOS DE `error-app` NO LLEVAN TICKET ACÁ: ya lo tienen. `lib/errores-app.ts` abre el
// ticket cuando la huella es nueva, y `incidentesDeErrores` sólo los RELEE para el
// informe. Crearles otro sería duplicar el mismo bug en la Ticketera.
//
// LA MARCA. En Vercel no hay disco, así que donde el script guardaba
// `~/.claude/vigia-mako-grupos.json` va un setting del workspace de la PLATAFORMA. Dos
// cosas que no se tocan:
//   · `wsSuperAdmin()`, nunca el contexto. Sin cookies `getWorkspaceActual()` cae a
//     `OWNER_WS`, que es el ws1 y es un CLIENTE: la marca de la plataforma terminaría
//     guardada adentro de su workspace (AGENTS.md, «OWNER_WS NO es la plataforma»).
//   · si NO SE PUDO LEER, la marca NO avanza. «No pude leer» no es «no hubo nada»: con la
//     marca avanzada se pierden los incidentes de esa ventana para siempre. Es el código 2
//     del script, acá un 503. Que el setting FALTE es otra cosa —la primera vuelta— y ahí
//     sí se arranca con una ventana de una hora.
//
// EL INTERRUPTOR: `VIGIA_GRUPOS` = `off` (default) · `seco` · `on`.
//   · `off`     no hace nada, ni lee.
//   · `seco`    lee y cuenta lo que HARÍA, sin crear un ticket y sin mover la marca.
//               Es el modo para probarlo contra producción sin efectos.
//   · `on`      crea los tickets y mueve la marca.
// Default apagado a propósito: una ruta nueva que escribe en la Ticketera se prende
// después de verla en seco, no en el mismo deploy que la estrena.
//
// Auth por CRON_SECRET (`checkCronAuth`, primera sentencia), como todo /api/cron.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace, wsSuperAdmin } from '@/lib/workspace';
import { getSettingEstricto, setSetting } from '@/lib/settings';
import { leerTodo } from '@/lib/supabase-paginado';
import { crearTicket } from '@/lib/tickets-db';
import { identidadDelSistema } from '@/lib/errores-app';
import {
  ESPERA_RESPUESTA_MS, incidentesDe, incidentesDeErrores, lineaDe,
  type FilaConv, type FilaError, type FilaUso, type Incidente,
} from '@/lib/vigia-mako-grupos';
import { leerEstado, tituloDeTicket, vistosTrasLaVuelta, type EstadoVigia } from '@/lib/vigia-grupos-estado';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** El setting donde vive la marca, en el workspace de la plataforma. */
const CLAVE = 'mako.vigia.grupos';

type Modo = 'off' | 'seco' | 'on';

const modo = (): Modo => {
  const v = (process.env.VIGIA_GRUPOS ?? '').trim().toLowerCase();
  return v === 'on' || v === 'seco' ? v : 'off';
};

export async function GET(request: NextRequest) {
  const fail = checkCronAuth(request);
  if (fail) return fail;

  const m = modo();
  if (m === 'off') return Response.json({ ok: true, modo: 'off', nota: 'VIGIA_GRUPOS no está en seco ni en on' });

  const ahora = Date.now();
  const db = getSupabaseServer();

  return runWithWorkspace(await wsSuperAdmin(), async () => {
    // 1. La marca. Un error de lectura corta acá: sin saber desde dónde mirar, cualquier
    //    ventana que elija puede saltear incidentes, y escribir una marca nueva los pierde.
    let estado: EstadoVigia;
    try {
      estado = leerEstado(await getSettingEstricto(CLAVE), ahora);
    } catch (e) {
      return Response.json(
        { ok: false, motivo: 'no-pude-leer-la-marca', error: e instanceof Error ? e.message : String(e), marcaAvanzo: false },
        { status: 503 },
      );
    }

    // Se relee un tramo ANTES de la marca: el mensaje que MaKo contestaba y el silencio que
    // se cumple recién ahora. Lo ya contado lo descarta `vistos`.
    const leerDesde = new Date(Date.parse(estado.marca) - ESPERA_RESPUESTA_MS - 5 * 60_000).toISOString();

    let conv: FilaConv[];
    let usos: FilaUso[];
    let errs: FilaError[];
    try {
      conv = await leerTodo<FilaConv>(db, 'mako_doer_conv', 'id, workspace_id, grupo_jid, role, content, created_at', {
        orden: ['created_at', 'id'], filtros: (q) => q.gte('created_at', leerDesde),
      });
      usos = await leerTodo<FilaUso>(db, 'anthropic_usage', 'id, workspace_id, created_at, feature, model, provider, motivo', {
        orden: ['created_at', 'id'],
        filtros: (q) => q.gte('created_at', leerDesde).in('feature', ['mako-doer-in', 'cartel-ia', 'saneo-doer']),
      });
      errs = await leerTodo<FilaError>(db, 'errores_app', 'id, origen, titulo, veces, primera_vez, ultima_vez, afectados, ticket_id', {
        orden: ['primera_vez', 'id'], filtros: (q) => q.gte('primera_vez', leerDesde),
      });
    } catch (e) {
      // El código 2 del script: no pude leer, y por eso la marca se queda donde estaba.
      return Response.json(
        { ok: false, motivo: 'no-pude-leer', error: e instanceof Error ? e.message : String(e), marcaAvanzo: false },
        { status: 503 },
      );
    }

    const nuevos: Incidente[] = [...incidentesDe(conv, usos, ahora), ...incidentesDeErrores(errs)]
      .filter((i) => !estado.vistos.includes(i.clave));

    const ultimo = [...conv, ...usos].map((f) => f.created_at).sort().pop();
    const marca = ultimo && ultimo > estado.marca ? ultimo : estado.marca;

    const { data: wss } = await db.from('workspaces').select('id, nombre');
    const nombre = new Map<number, string>(((wss ?? []) as Array<{ id: number; nombre: string }>).map((w) => [w.id, w.nombre]));
    const nombreWs = (ws: number) => nombre.get(ws) ?? 'sin nombre';

    // Los de la app ya tienen su ticket (lib/errores-app.ts): acá sólo viajan al informe.
    const paraTicket = nuevos.filter((i) => !i.tipos.includes('error-app'));

    if (m === 'seco') {
      return Response.json({
        ok: true, modo: 'seco', desde: estado.marca, leidos: { conv: conv.length, usos: usos.length, errores: errs.length },
        incidentes: nuevos.length, abririaTickets: paraTicket.length, marcaAvanzo: false,
        muestra: nuevos.slice(0, 10).map((i) => ({ clave: i.clave, titulo: tituloDeTicket(i, nombreWs), linea: lineaDe(i, nombreWs) })),
      });
    }

    // 2. Los tickets, ANTES de mover la marca. `crearTicket` es idempotente por `ref`, así
    //    que si esto se corta a mitad la próxima vuelta lo retoma sin duplicar nada; con la
    //    marca movida primero, lo que no alcanzó a abrir ticket se perdería.
    const abiertos: Array<{ clave: string; ticket: number | null }> = [];
    const identidad = await identidadDelSistema();
    for (const i of paraTicket) {
      try {
        const c = await crearTicket({
          identidad, tipo: 'bug', declaradoPor: 'sistema', sistema: true,
          titulo: tituloDeTicket(i, nombreWs),
          descripcion: lineaDe(i, nombreWs),
          canal: 'sistema',
          contexto: { origen: 'vigia-mako-grupos', tipos: i.tipos, ws: i.ws, grupo: i.grupo, at: i.at, marcas: i.marcas },
          ref: `vigia:${i.clave}`,
        });
        abiertos.push({ clave: i.clave, ticket: c.ok ? c.id : null });
      } catch (e) {
        // Uno que falla no se lleva al resto NI mueve la marca: su clave no entra a `vistos`,
        // así que la próxima vuelta lo vuelve a intentar (y el `ref` evita el duplicado).
        console.error(`[vigia-grupos] ${i.clave}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. La marca avanza, y sólo se recuerda lo que de verdad quedó asentado esta vuelta
    //    (lib/vigia-grupos-estado.ts: lo que abrió ticket y lo de `error-app`, que ya lo tenía).
    const vistos = vistosTrasLaVuelta(estado.vistos, nuevos, abiertos.map((a) => a.clave));
    await setSetting(CLAVE, JSON.stringify({ marca, vistos } satisfies EstadoVigia));

    return Response.json({
      ok: true, modo: 'on', desde: estado.marca, hasta: marca,
      leidos: { conv: conv.length, usos: usos.length, errores: errs.length },
      incidentes: nuevos.length, tickets: abiertos.length, sinTicket: paraTicket.length - abiertos.length,
      marcaAvanzo: marca !== estado.marca,
    });
  });
}
