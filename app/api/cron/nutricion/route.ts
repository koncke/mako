// =============================================================================
// Cron: motor de nutrición (VSL funnel) — POR WORKSPACE
// =============================================================================
// Cada corrida itera los workspaces ACTIVOS y, dentro de cada uno: (1) inscribe
// leads que cayeron en la cohorte de una secuencia activa, (2) procesa los
// envíos vencidos con rate-limiting anti-baneo (ventana horaria, tope
// diario/por-corrida POR WORKSPACE, 1 msg/lead cada 20h).
//
// El envío real se decide por workspace con lib/envio-flags.ts (setting
// envio_whatsapp_enabled / envio_email_enabled; el dueño hereda el env si no
// tiene setting). Un workspace SIN ningún canal habilitado no se toca (modo
// 'off': no inscribe ni consume pasos — los flags globales de deploy ya no
// comprometen a todos los clientes a la vez).
//
// Modos manuales (para probar la máquina):
//   ?dry=1[&ws=N]     → dry-run del workspace N (default dueño): lista qué
//                       inscribiría/enviaría, sin escribir.
//   ?commit=1[&ws=N]  → fuerza el commit del workspace N (default dueño) aunque
//                       no tenga canales habilitados; los pasos de canales
//                       apagados avanzan como 'simulado' (semántica histórica).
//   &ignorar_ventana=1 → ignora la ventana horaria (tests).
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  planificarInscripciones,
  planificarEnvios,
  comprometerInscripciones,
  procesarEnvios,
  getSecuenciasActivas,
} from '@/lib/nutricion';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { evaluarDesenlaces } from '@/lib/nutricion-desenlace';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { listarWorkspaces, runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { ESPERA_CORRIDA_HASTA_MS } from '@/lib/espera-duracion';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(request: NextRequest): Response | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET no configurado' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

type ResultadoWs = { ws: number; modo: string; [k: string]: unknown };

export async function GET(request: NextRequest) {
  const unauth = checkAuth(request);
  if (unauth) return unauth;

  const url = new URL(request.url);
  const ignorarVentana = url.searchParams.get('ignorar_ventana') === '1';
  /**
   * HASTA CUÁNDO PUEDE DORMIR ESTA CORRIDA para cumplir una espera corta adentro (quinta tanda, punto
   * 3: un DELAY de 30 s sale a los 30 s y no en la corrida de la hora siguiente; la decisión, en la
   * cabecera de lib/espera-duracion.ts). UNO para toda la ruta, contado desde que arrancó: los
   * workspaces corren de a uno y `maxDuration` es 300, así que entre todos no se duerme más de 150 s.
   *
   * ⚠️ SIN ESTO EL MOTOR NO DUERME NUNCA: `procesarEnvios` sin tope no espera (a propósito: la vía
   * rápida corre adentro de un webhook). La primera versión del motor ya sabía dormir y esta ruta no
   * le pasaba el tope, así que la espera corta «adentro de la corrida» no corría en ningún lado.
   */
  const esperarHastaMs = Date.now() + ESPERA_CORRIDA_HASTA_MS;
  const wsParam = Number(url.searchParams.get('ws'));
  const wsExplicito = Number.isFinite(wsParam) && wsParam > 0 ? wsParam : null;

  try {
    const activos = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
    const activosIds = new Set(activos.map((w) => w.id));
    // Los modos manuales también exigen un workspace ACTIVO (no operar pausados).
    const resolverManual = (): number | Response => {
      const ws = wsExplicito ?? OWNER_WS;
      if (!activosIds.has(ws)) return Response.json({ ok: false, error: `workspace ${ws} inexistente o pausado` }, { status: 404 });
      return ws;
    };

    // ── Modo manual: dry-run de UN workspace (default dueño) ──────────────────
    if (url.searchParams.get('dry') === '1') {
      const ws = resolverManual();
      if (ws instanceof Response) return ws;
      const [inscribiria, enviaria] = await runWithWorkspace(ws, () =>
        Promise.all([planificarInscripciones(), planificarEnvios()]),
      );
      return Response.json({
        ok: true, ws, modo: 'dry-run',
        inscribiria_count: inscribiria.length, enviaria_count: enviaria.length,
        inscribiria, enviaria,
      });
    }

    // ── Modo manual: commit forzado de UN workspace (default dueño) ───────────
    if (url.searchParams.get('commit') === '1') {
      const ws = resolverManual();
      if (ws instanceof Response) return ws;
      const r = await runWithWorkspace(ws, async () => {
        // Los desenlaces TAMBIÉN acá. Esta rama es la que usa una persona para
        // probar un workspace a mano, y sin esto mentía por omisión: cerraba y
        // enrolaba, pero nunca evaluaba si una secuencia terminó ni encadenaba
        // a la siguiente — así que probar la cadena por acá daba "no funciona"
        // cuando en la corrida real del cron funciona.
        const desenlaces = await evaluarDesenlaces().catch((e) => {
          console.error(`[cron:nutricion] desenlaces (commit) ws ${ws}:`, e);
          return null;
        });
        const inscriptas = await comprometerInscripciones();
        const proc = await procesarEnvios({ ignorarVentana, simularApagados: true, esperarHastaMs });
        return {
          inscriptas,
          ...proc,
          ...(desenlaces ? { logrados: desenlaces.logrados, fallidos: desenlaces.fallidos, movidos: desenlaces.movidos, encadenados: desenlaces.encadenados } : {}),
        };
      });
      return Response.json({ ok: true, ws, modo: 'commit (forzado, apagados=simulado)', ...r });
    }

    // ── Corrida normal del cron: todos los workspaces activos ─────────────────
    const objetivo = wsExplicito ? activos.filter((w) => w.id === wsExplicito) : activos;

    const resultados: ResultadoWs[] = [];
    for (const w of objetivo) {
      try {
        const r = await runWithWorkspace(w.id, async (): Promise<ResultadoWs> => {
          // Acá se sembraban las secuencias por defecto EN CADA CORRIDA. Por eso
          // borrarlas a mano no servía de nada: volvían solas. Ya no se siembra
          // nada — lo que falta se AVISA (lib/secuencias-huecos.ts), no se
          // inventa con copy de relleno que el dueño no escribió.
          // Los desenlaces se evalúan SIEMPRE, incluso con el envío apagado: son
          // secuencias que ya mandaron sus mensajes y hay que cerrarlas. Si
          // dependiera del flag de envío, un cliente con el canal en pausa
          // acumularía inscripciones abiertas para siempre.
          const desenlaces = await evaluarDesenlaces().catch((e) => {
            console.error(`[cron:nutricion] desenlaces ws ${w.id}:`, e);
            return null;
          });
          const cerradas = desenlaces ? { logrados: desenlaces.logrados, fallidos: desenlaces.fallidos, movidos: desenlaces.movidos } : undefined;

          const [waOn, emailOn] = await Promise.all([envioWhatsappHabilitado(), envioEmailHabilitado()]);
          if (!waOn && !emailOn) {
            // ⚠️ SIN CANALES, LAS ACCIONES IGUAL CORREN. Un paso «⚡ Acción» no es un mensaje y el
            // canal apagado no le aplica (lib/nutricion.ts), pero cortar acá dejaba vencida para
            // siempre la segunda acción de una secuencia —la primera sale por la vía rápida del
            // evento— y el día que se prendía un canal corrían todas juntas, semanas tarde. Con los
            // dos canales apagados, el motor hace esperar 24 h a cada MENSAJE sin mandarlo, así que
            // correrlo sólo mueve las acciones. No inscribe por cohorte: eso sigue en 'off'.
            const conAcciones = (await getSecuenciasActivas()).some((s) => s.pasos.some(esPasoAccion));
            if (!conAcciones) return { ws: w.id, modo: 'off', ...(cerradas ?? {}) };
            const proc = await procesarEnvios({ ignorarVentana, esperarHastaMs });
            return { ws: w.id, modo: 'off (sólo acciones)', ...proc, ...(cerradas ?? {}) };
          }
          const inscriptas = await comprometerInscripciones();
          const proc = await procesarEnvios({ ignorarVentana, esperarHastaMs });
          return { ws: w.id, modo: `commit (wa:${waOn ? 'on' : 'off'} email:${emailOn ? 'on' : 'off'})`, inscriptas, ...proc, ...(cerradas ?? {}) };
        });
        resultados.push(r);
      } catch (err) {
        // Un workspace que falla no corta a los demás.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron:nutricion] ws ${w.id} error: ${msg}`);
        resultados.push({ ws: w.id, modo: 'error', error: msg });
      }
    }

    // Si TODOS los workspaces fallaron, el cron debe reportar fallo (500) para
    // que el monitoreo de Vercel lo marque — con 200 nadie se entera.
    const errores = resultados.filter((r) => r.modo === 'error').length;
    const todoFallo = resultados.length > 0 && errores === resultados.length;
    return Response.json(
      { ok: !todoFallo, total: resultados.length, errores, workspaces: resultados },
      { status: todoFallo ? 500 : 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
