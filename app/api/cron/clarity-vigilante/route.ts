// =============================================================================
// Cron: clarity-vigilante — cachea el resumen y avisa antes de que se borre
// =============================================================================
// Hace dos cosas que NO se pueden hacer desde una pantalla:
//
//   1. TRAE EL RESUMEN de Clarity y lo cachea. Su Data Export API permite **10
//      requests por proyecto por día**: si lo consultara la pantalla, tres
//      personas abriendo la tab dos veces la agotan antes del mediodía y a partir
//      de ahí queda en blanco sin que nada explique por qué. Una vez por día, y
//      todo el mundo lee el caché.
//
//   2. AVISA ANTES DE QUE SE BORRE UNA GRABACIÓN. Clarity guarda las grabaciones
//      **30 días** y después las tira; las marcadas como favoritas sobreviven 13
//      meses. Pero marcarlas es una acción MANUAL en su panel: no hay endpoint.
//
//      Así que lo único que el sistema puede hacer —y es lo que convierte 30 días
//      en 13 meses para lo que importa— es avisar a tiempo, con el link a la
//      grabación de esa persona. Un aviso el día 25 sobre un lead que se está por
//      cerrar vale exactamente lo que vale esa venta.
//
// ⚠️ Y avisa SOLO por leads, no por sesiones. Las grabaciones anónimas son miles
// y ninguna importa; las de alguien que dejó sus datos son un puñado y son las
// únicas que alguien va a querer ver dentro de tres meses.
// =============================================================================

import { type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { setSetting } from '@/lib/settings';
import { clarityProjectId, resumenClarity, urlSesionesDeLead } from '@/lib/clarity';
import { emitirDelCatalogo } from '@/lib/avisos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Dónde queda el resumen cacheado. Lo lee la pantalla; lo escribe solo el cron. */
export const CLARITY_RESUMEN_KEY = 'clarity.resumen';

/**
 * Cuántos días tiene una grabación antes de que Clarity la borre.
 *
 * No es un número elegido: es el que Microsoft documenta («Playback data is
 * retained for 30 days»). Si algún día lo cambian, esto se queda viejo en
 * silencio — por eso el aviso dice los días que faltan y no una fecha absoluta.
 */
const DIAS_RETENCION = 30;

/**
 * A los cuántos días se avisa.
 *
 * ⚠️ Cinco días de margen, no uno. Un aviso el día 29 llega cuando la persona ya
 * no tiene tiempo de entrar a marcarla — y el aviso existe justamente para que
 * haga algo. Tampoco muy antes: al día 10 nadie sabe todavía si ese lead importa.
 */
const AVISAR_DESDE = DIAS_RETENCION - 5;

type Resultado = { ws: number; resumen: boolean; avisados: number };

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:clarity-vigilante] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const hechos: Resultado[] = [];
  const errores: Array<{ ws: number; error: string }> = [];

  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, async (): Promise<Resultado | null> => {
        // Sin proyecto conectado no hay nada que vigilar, y avisarle sería ruido
        // sobre una integración que este cliente nunca encendió.
        const pid = await clarityProjectId(w.id);
        if (!pid) return null;

        // ── 1. El resumen, cacheado ──────────────────────────────────────────
        const res = await resumenClarity(3, w.id);
        if (res.ok) {
          await setSetting(CLARITY_RESUMEN_KEY, JSON.stringify({ ...res, ts: new Date().toISOString() }));
        } else {
          // Un error de Clarity NO borra el caché: lo de ayer sigue siendo cierto
          // y es mejor que una pantalla vacía. Solo queda registrado.
          console.warn(`[cron:clarity-vigilante] ws=${w.id} resumen: ${res.error}`);
        }

        // ── 2. Las grabaciones por vencer ────────────────────────────────────
        const db = await getTenantDb();
        const desde = new Date(Date.now() - DIAS_RETENCION * 86_400_000).toISOString();
        const hasta = new Date(Date.now() - AVISAR_DESDE * 86_400_000).toISOString();
        // La ventana es la de los leads que entraron entre el día 25 y el 30. Se
        // filtra por `created_at` del LEAD y no por la fecha de la visita porque
        // es lo que tenemos indexado — y para un lead de landing las dos fechas
        // están a minutos.
        const { data } = await db
          .from('leads')
          .select('id, nombre, visitor_id, created_at')
          .not('visitor_id', 'is', null)
          .gte('created_at', desde)
          .lte('created_at', hasta)
          .limit(20);

        const leads = (data ?? []) as Array<{ id: number; nombre: string | null; visitor_id: string | null; created_at: string }>;

        // ⚠️ UN SOLO AVISO CON LA LISTA, no uno por lead. Dos razones, y la
        // primera es un bug que casi entra: el dedup de `emitirDelCatalogo` es
        // por TIPO, así que en una tanda de cinco leads solo habría sonado el
        // primero y los otros cuatro se habrían perdido en silencio.
        //
        // La segunda es que además es mejor: tres mensajes de WhatsApp seguidos
        // diciendo lo mismo sobre personas distintas se leen como spam y se
        // silencian; uno que dice «tres grabaciones se borran esta semana» con
        // los tres links se lee una vez y se resuelve de una sentada.
        const porVencer: Array<{ nombre: string; dias: number; url: string }> = [];
        for (const l of leads) {
          const url = await urlSesionesDeLead(l.visitor_id, w.id);
          if (!url) continue;
          const dias = Math.max(1, DIAS_RETENCION - Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86_400_000));
          porVencer.push({ nombre: l.nombre?.trim() || 'Un contacto sin nombre', dias, url });
        }

        let avisados = 0;
        if (porVencer.length) {
          // El más urgente primero: es el que decide si hay que entrar hoy.
          porVencer.sort((a, b) => a.dias - b.dias);
          const lineas = porVencer.map((v) => `• *${v.nombre}* — ${v.dias} ${v.dias === 1 ? 'día' : 'días'} 👉 ${v.url}`).join(String.fromCharCode(10));
          const r = await emitirDelCatalogo('clarity-grabacion-por-vencer', {
            ws: w.id,
            // El texto lo arma el CÓDIGO: acá viajan nombres y URLs exactos, y un
            // dato exacto que pasa por un modelo deja de serlo.
            texto: porVencer.length === 1
              ? `La grabación de *${porVencer[0].nombre}* se borra en ${porVencer[0].dias} ${porVencer[0].dias === 1 ? 'día' : 'días'}. Si te sirve para después, entra y márcala como favorita: así se guarda 13 meses en vez de 30 días 👉 ${porVencer[0].url}`
              : `Hay ${porVencer.length} grabaciones que Clarity va a borrar esta semana. Márcalas como favoritas y se guardan 13 meses en vez de 30 días:${String.fromCharCode(10)}${lineas}`,
            // Una vez al día. La ventana de aviso dura cinco días, así que sin
            // esto el mismo lead sonaría cinco veces.
            dedupTtlMin: 60 * 20,
          });
          if (r.ok && !r.deduped) avisados = porVencer.length;
        }

        return { ws: w.id, resumen: res.ok, avisados };
      });
      if (r) hechos.push(r);
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ ok: true, hechos, errores });
}
