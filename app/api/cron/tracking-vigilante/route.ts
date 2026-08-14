// =============================================================================
// Cron: ¿alguna landing dejó de mandar datos?
// =============================================================================
// El tracking del VSL falla EN SILENCIO por diseño ajeno: el beacon de la landing
// hace `fetch(...).catch(function(){})` y nuestro receptor devuelve 200 aunque
// descarte el evento. No hay error en consola, no hay 500, no hay nada.
//
// Precedente que justifica este cron: el tracking estuvo MUERTO 18 días
// (2026-07-15 → 08-03) con anuncios corriendo y 235 leads entrando a ritmo normal.
// Ninguna señal de negocio lo detectó — los leads seguían llegando por otras vías;
// lo que se perdió fue la atribución. Y el semáforo de /integraciones tampoco podía
// verlo: preguntaba "¿llegó algo ALGUNA VEZ?" sobre toda la historia.
//
// POR QUÉ NO USA correrPorWorkspace('landing', …): sería circular. Ese helper filtra
// por `integracionConectada`, y "landing conectada" se define justamente como "hay
// eventos recientes" — el workspace con el tracking muerto quedaría excluido y jamás
// se avisaría. (Además 'landing' no está en metodo-catalogo, así que devolvería false
// para todos.) Se itera por `landing_token` acuñado, que es la señal DURABLE de que
// ese workspace configuró el tracking alguna vez.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { getSetting } from '@/lib/settings';
import { LANDING_TOKEN_KEY, SNIPPET_VERSION, SNIPPET_VERSION_KEY } from '@/lib/landing-token';
import { emitirDelCatalogo } from '@/lib/avisos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Horas sin un solo evento a partir de las cuales se considera apagado. */
const HORAS_APAGADO = 48;
// Un día sin visitas puede ser un fin de semana con la pauta en pausa; dos días
// seguidos ya no. Se prefiere avisar tarde y seguro antes que quemar la alarma:
// un aviso que grita en falso se ignora, y entonces no sirve para nada.

/** Que no repita el mismo aviso todos los días mientras dura el apagón. */
const DEDUP_MIN = 60 * 24 * 3;

type Estado = { ws: number; ultima: string | null; horas: number | null; aviso: boolean; snippet?: number };

/**
 * Qué se pierde quien quedó con una versión vieja del snippet.
 *
 * Un aviso que solo dice «actualizá» es una tarea sin motivo, y una tarea sin
 * motivo no la hace nadie — menos todavía si lo que tiene puesto FUNCIONA. Acá se
 * le dice qué está dejando de recibir, que es lo único que la vuelve urgente.
 *
 * Al subir `SNIPPET_VERSION`, sumá su renglón. Sin renglón el aviso sale genérico.
 */
const NOVEDADES: Record<number, string> = {
  2: 'la captura automática del formulario de tu landing (quien lo completa te entra al CRM)',
};
const NOVEDADES_DESDE = (desde: number): string =>
  Object.entries(NOVEDADES)
    .filter(([v]) => Number(v) > desde)
    .map(([, t]) => t)
    .join(' · ') || 'mejoras de medición';

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const tStart = Date.now();
  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:tracking-vigilante] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const revisados: Estado[] = [];
  const errores: Array<{ ws: number; error: string }> = [];

  for (const w of workspaces) {
    try {
      const estado = await runWithWorkspace(w.id, async (): Promise<Estado | null> => {
        // Sin token acuñado, este workspace nunca configuró tracking: no hay nada
        // que vigilar y avisarle sería ruido.
        const token = (await getSetting(LANDING_TOKEN_KEY))?.trim();
        if (!token) return null;

        const supabase = await getTenantDb(); // scopea landing_visits al workspace
        const { data, error } = await supabase
          .from('landing_visits').select('created_at')
          .order('created_at', { ascending: false }).limit(1);
        if (error) throw new Error(error.message);

        const ultima = (data?.[0]?.created_at as string | undefined) ?? null;
        // Token acuñado pero CERO eventos en la historia: todavía no pegó el código.
        // Eso no es un apagón, es un onboarding a medias — lo dice el semáforo de
        // /integraciones, no una alarma roja.
        if (!ultima) return { ws: w.id, ultima: null, horas: null, aviso: false };

        const horas = (Date.now() - new Date(ultima).getTime()) / 3_600_000;
        if (horas < HORAS_APAGADO) {
          // El tracking está VIVO. Falta la otra pregunta, que es la que nadie
          // puede ver: ¿el código que tiene pegado es el ACTUAL? El snippet queda
          // congelado en el HTML del cliente el día que lo copió, así que una
          // mejora nuestra no le llega nunca — y no hay ningún síntoma, porque los
          // eventos del código viejo llegan igual y la integración sigue en verde.
          const instalada = Number(await getSetting(SNIPPET_VERSION_KEY)) || 1;
          if (instalada < SNIPPET_VERSION) {
            await emitirDelCatalogo('tracking-desactualizado', {
              ws: w.id,
              dedupTtlMin: DEDUP_MIN,
              contexto: `El snippet instalado es la versión ${instalada} y la actual es la ${SNIPPET_VERSION}. Lo que se está perdiendo: ${NOVEDADES_DESDE(instalada)}. Se arregla copiando el código de nuevo en Integraciones → Landing y volviéndolo a pegar.`,
            });
          }
          return { ws: w.id, ultima, horas, aviso: false, snippet: instalada };
        }

        const dias = Math.floor(horas / 24);
        await emitirDelCatalogo('tracking-apagado', {
          ws: w.id,
          dedupTtlMin: DEDUP_MIN,
          contexto: `La landing no registra visitas desde hace ${dias} día(s) (última: ${ultima}). Los anuncios pueden seguir corriendo: lo que se pierde es la atribución. Causa típica: el snippet de la landing quedó apuntando a una dirección vieja — se copia con la URL congelada y no se entera de un cambio de dominio.`,
        });
        return { ws: w.id, ultima, horas, aviso: true };
      });
      if (estado) revisados.push(estado);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[cron:tracking-vigilante] ws ${w.id}:`, msg);
      errores.push({ ws: w.id, error: msg });
    }
  }

  const ms = Date.now() - tStart;
  const avisados = revisados.filter((r) => r.aviso).length;
  console.log(`[cron:tracking-vigilante] revisados=${revisados.length} avisados=${avisados} errores=${errores.length} ms=${ms}`);

  // 500 solo si NINGUNO se pudo revisar: es un vigilante, tiene que gritar cuando
  // es él el que está ciego.
  const ok = errores.length === 0 || revisados.length > 0;
  return Response.json({ ok, revisados, avisados, errores, ms }, { status: ok ? 200 : 500 });
}
