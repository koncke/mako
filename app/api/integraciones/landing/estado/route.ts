// =============================================================================
// /api/integraciones/landing/estado — "Verificar" de la landing
// =============================================================================
// El equivalente al "Probar conexión" del wizard, para el único servicio que no
// se configura con credenciales: la landing. No hay nada que verificar contra
// una API ajena — la única prueba honesta de que el código está pegado y el
// ruteo funciona es que YA hayan llegado eventos a este workspace.
//
// GUARD (seguridad multi-tenant): mismo resolverContexto que
// /api/integraciones/credencial — super-admin de agencia (getSesionAdmin) o
// admin del propio workspace (getRolWsEfectivo === 'admin'); closer/setter/sin
// sesión → 403. El ws SIEMPRE sale del request (getWorkspaceActual), nunca del
// body/query, y se pinnea con runWithWorkspace para que getTenantDb scopee por
// el MISMO ws que resolvió el guard (un super-admin sin impersonar cae al dueño,
// igual que en credencial).
//
// GET → { ok, recibio, ultima } — ultima = ISO del último evento, o null.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual, OWNER_WS, runWithWorkspace } from '@/lib/workspace';
import { landingUltimoEvento, landingDiagnostico, videosDetectados, getVideosLanding, getVideosOcultos, verificarPagina } from '@/lib/landing-token';
import { replayDePrueba } from '@/lib/replay-leer';
import { configDeReplay } from '@/lib/replay-ingesta';
import type { SesionDeLead } from '@/lib/replay-ficha';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);

type Contexto = { ws: number };

/**
 * Resuelve el workspace objetivo y valida el permiso. El ws SIEMPRE sale del
 * request (getWorkspaceActual): jamás se acepta un ws del body/query. Devuelve
 * un error tipado en vez de lanzar, para que el handler responda con status.
 */
async function resolverContexto(): Promise<Contexto | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'solo admin', status: 403 };

  // super-admin de agencia (o legacy/dev/dueño) O admin del propio workspace.
  const esSuperAdmin = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuperAdmin && !esAdminWs) return { error: 'solo admin', status: 403 };

  const wsActual = await getWorkspaceActual();
  // ws null = admin sin impersonar: solo el super-admin cae al dueño; el resto
  // (p.ej. un admin-cliente sin workspace resuelto) → 403 fail-closed.
  if (wsActual == null) {
    if (!esSuperAdmin) return { error: 'workspace no resuelto', status: 403 };
    return { ws: OWNER_WS };
  }
  return { ws: wsActual };
}

/**
 * El chequeo de «¿se grabó esta prueba?».
 *
 * ⚠️ TRES RESPUESTAS, NO DOS, y el `na` es la que más importa: con la grabación
 * APAGADA en este espacio no falta nada —no se grabó porque nadie lo pidió— y
 * marcarlo en rojo mandaría a repegar un código que está perfecto. Es la regla
 * de la casa: «no puedo hacer X» no es «X está mal».
 *
 * Y una grabación que llegó pero todavía no se puede VER no es una falla: el
 * cuerpo se sella en el cron (cada 10 minutos). El chequeo mide que el grabador
 * ande, que es lo que la prueba puede afirmar ahora mismo; lo otro se dice en el
 * detalle en vez de inventarle un estado.
 */
function chequeoGrabacion(marcador: string | null, g: SesionDeLead | null, activo: boolean | null) {
  const base = { id: 'grabacion', label: 'Grabación de la sesión' };
  if (activo === false) return { ...base, estado: 'na' as const, detalle: 'Está apagada. Préndela arriba, en «Grabar las visitas».' };
  if (activo === null) return { ...base, estado: 'na' as const, detalle: 'No pude leer si está encendida.' };
  if (!marcador) return { ...base, estado: 'na' as const, detalle: 'Esta prueba no lleva marcador.' };
  if (!g) return { ...base, estado: 'falta' as const, detalle: 'Todavía no llegó la grabación de esta prueba.' };
  const seg = `${Math.round(g.segundos)}s`;
  return {
    ...base,
    estado: 'ok' as const,
    detalle: g.lista
      ? `Grabada: ${seg}, ${g.eventos} eventos. Ya se puede ver desde la ficha del lead.`
      : `Grabada: ${seg}. Se puede ver en unos minutos, cuando termine de guardarse.`,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolverContexto();
  if ('error' in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  // ?diag=1 → el probador en vivo (últimos eventos + los 4 chequeos). El GET pelado
  // sigue devolviendo el semáforo de siempre, que usa el board.
  const diag = req.nextUrl.searchParams.get('diag') === '1';
  // ?verificar=<url> → «¿ESTA página está midiendo, y con qué versión?». Es la
  // pregunta del botón que vive al lado del desplegable, y es distinta de la del
  // semáforo: esa mira el workspace entero.
  const verificar = req.nextUrl.searchParams.get('verificar');
  try {
    if (verificar) {
      const v = await runWithWorkspace(ctx.ws, () => verificarPagina(verificar));
      return NextResponse.json({ ok: true, verificacion: v });
    }
    if (diag) {
      // Los videos viajan con el diagnóstico y no en su propia ruta: la pantalla
      // los necesita JUNTOS —los detectados salen de los mismos eventos que los
      // chequeos— y dos requests para un panel es una condición de carrera que
      // se ve como «a veces aparece la lista vacía».
      const [d, detectados, guardados, ocultos] = await runWithWorkspace(ctx.ws, () =>
        Promise.all([
          landingDiagnostico(
            req.nextUrl.searchParams.get('prueba'),
            req.nextUrl.searchParams.get('landing'),
            // Las piezas vienen del analizador, que ya corrió en el cliente: se
            // reenvían en vez de volver a bajar el HTML. Bajarlo de nuevo por
            // cada refresco del poll sería una request a la página del cliente
            // cada 3 segundos.
            req.nextUrl.searchParams.get('piezas')?.split(',').filter(Boolean) ?? null,
          ),
          videosDetectados(),
          getVideosLanding(),
          getVideosOcultos(),
        ]),
      );
      // LA GRABACIÓN DE ESTA PRUEBA. Antes esto era un link a Clarity; ahora la
      // grabación es propia, así que la prueba puede DECIR si llegó en vez de
      // mandar a buscarla a otra pantalla. El marcador ya viaja en la URL de la
      // página y el grabador lo guarda en `replay_sesiones.prueba`.
      const marcador = req.nextUrl.searchParams.get('prueba');
      const [grabacion, cfgReplay] = await runWithWorkspace(ctx.ws, () =>
        Promise.all([
          replayDePrueba(marcador).catch(() => null),
          configDeReplay().catch(() => null),
        ]),
      );
      // Va como UN chequeo más de la misma lista: la pantalla ya sabe contar
      // cuántos aplican y cuántos no, y un bloque aparte sería un segundo lugar
      // donde el mismo diagnóstico puede decir otra cosa.
      const chequeos = [...(d.chequeos ?? []), chequeoGrabacion(marcador, grabacion, cfgReplay?.activo ?? null)];
      return NextResponse.json({ ok: true, ...d, chequeos, videosDetectados: detectados, videos: guardados, videosOcultos: ocultos, grabacion });
    }
    const estado = await runWithWorkspace(ctx.ws, () => landingUltimoEvento());
    return NextResponse.json({ ok: true, ...estado });
  } catch (e) {
    return NextResponse.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
