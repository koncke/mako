// =============================================================================
// Cron: prueba-grabacion — avisa cuando la grabación de una prueba ya está lista
// =============================================================================
// Al terminar una prueba del Pixel, la pantalla ofrece el link a la grabación de
// ESA sesión en Clarity. El link es correcto desde el primer segundo y no sirve
// para nada durante la primera media hora: Clarity procesa las sesiones en lote,
// tarda entre 30 minutos y 2 horas, y **no tiene webhook**. Quien prueba abre el
// link enseguida, no encuentra nada, y saca la conclusión más razonable —«esto no
// funciona»— sobre algo que sí funciona y todavía no llegó.
//
// Volver más tarde tampoco es una opción realista: para entonces la pantalla se
// cerró, el marcador de la prueba es una cadena al azar que nadie se aprendió, y
// esa sesión quedó mezclada con el tráfico real de todo el día.
//
// Por eso el aviso, y por eso por WhatsApp: es el único canal que llega cuando la
// pantalla ya no está abierta.
//
// ⚠️ CADA 15 MINUTOS Y NO UNA VEZ POR DÍA. Los otros vigilantes de landing corren
// a las 13:50 porque contestan preguntas de días («¿el código quedó viejo?»,
// «¿esta grabación se borra esta semana?»). Este contesta una de minutos: una
// prueba hecha a las 15:00 avisada al día siguiente es un aviso que no sirve —
// para entonces ya se probó de nuevo, o se dio por roto.
// =============================================================================

import { type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { clarityProjectId, urlSesionesDePrueba } from '@/lib/clarity';
import { emitirDelCatalogo } from '@/lib/avisos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Qué pruebas ya se avisaron. Sin esto, el aviso se repetiría cada 15 minutos. */
export const AVISADAS_KEY = 'landing.pruebas_avisadas';

/**
 * Cuántos minutos hay que esperar antes de prometer que la grabación está.
 *
 * Microsoft documenta «hasta 2 horas» para que una sesión aparezca en el panel, y
 * en la práctica son ~30. Se toma el piso alto (45) a propósito: **el costo de los
 * dos errores no es el mismo.** Avisar tarde cuesta media hora de espera; avisar
 * temprano manda a alguien a una lista vacía, que es exactamente el problema que
 * este cron viene a resolver — y esa persona no vuelve a intentar.
 */
const PROCESADO_MIN = 45;

/**
 * Y hasta cuándo se mira para atrás. Una prueba de hace dos días ya no le importa
 * a nadie, y avisar por ella —después de un despliegue, por ejemplo— sería sacar
 * del cajón algo que la persona ya dio por terminado.
 */
const VENTANA_H = 12;

/** Cuántos marcadores se recuerdan. Es una lista de anti-repetición, no un log. */
const RECORDAR = 40;

/** El salto de línea de WhatsApp, sin escaparlo dentro de un template literal. */
const NL = String.fromCharCode(10);

/** Lo guardado puede ser cualquier cosa: lo escribe este cron, pero el setting es
 *  texto libre y una lista corrupta no puede hacer que el cron deje de correr. */
function leerMarcadores(crudo: string | null): string[] {
  try {
    const v: unknown = JSON.parse(crudo ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

type Fila = { prueba: string | null; landing_url: string | null; created_at: string };
type Resultado = { ws: number; avisadas: number };

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:prueba-grabacion] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const hechos: Resultado[] = [];
  const errores: Array<{ ws: number; error: string }> = [];

  for (const w of workspaces) {
    try {
      const r = await runWithWorkspace(w.id, async (): Promise<Resultado | null> => {
        // Sin Clarity conectado no hay grabación que prometer. El resto de la
        // prueba (los eventos en vivo) funciona igual y no se avisa por nada.
        if (!(await clarityProjectId(w.id))) return null;

        const db = await getTenantDb();
        const desde = new Date(Date.now() - VENTANA_H * 3_600_000).toISOString();
        const hasta = new Date(Date.now() - PROCESADO_MIN * 60_000).toISOString();
        const { data } = await db
          .from('landing_visits')
          .select('prueba, landing_url, created_at')
          .not('prueba', 'is', null)
          .gte('created_at', desde)
          // ⚠️ El corte va sobre el ÚLTIMO evento de la prueba, no sobre el
          // primero: la sesión se sigue grabando mientras la persona navega, así
          // que el reloj de Clarity arranca cuando la sesión TERMINA. Como se
          // pide `<= hasta` y después se agrupa quedándose con el más nuevo de
          // cada marcador, una prueba que todavía está en curso no entra: su
          // último evento es reciente y la excluye la misma condición.
          .lte('created_at', hasta)
          .order('created_at', { ascending: false })
          .limit(200);

        const filas = (data ?? []) as Fila[];
        if (!filas.length) return null;

        // Una entrada por marcador (la más nueva primero, que es la que ordenó la
        // consulta), con la dirección que la prueba visitó.
        const porPrueba = new Map<string, Fila>();
        for (const f of filas) {
          if (!f.prueba) continue;
          if (!porPrueba.has(f.prueba)) porPrueba.set(f.prueba, f);
        }

        const yaAvisadas = leerMarcadores(await getSetting(AVISADAS_KEY).catch(() => null));
        const pendientes = [...porPrueba.entries()].filter(([m]) => !yaAvisadas.includes(m));
        if (!pendientes.length) return null;

        // ⚠️ UN SOLO AVISO CON LA LISTA, igual que en clarity-vigilante y por la
        // misma razón dura: el dedup de `emitirDelCatalogo` es por TIPO, así que
        // dos pruebas seguidas mandarían el primer mensaje y perderían el segundo
        // en silencio. Acá además es lo normal: probar dos veces seguidas —una,
        // corregir, otra— es exactamente cómo se usa esto.
        const links: Array<{ url: string; donde: string }> = [];
        for (const [marcador, fila] of pendientes) {
          const url = await urlSesionesDePrueba(marcador, w.id);
          if (!url) continue;
          links.push({ url, donde: dominio(fila.landing_url) });
        }
        if (!links.length) return null;

        const texto = links.length === 1
          ? `Ya está lista la grabación de la prueba que hiciste en *${links[0].donde}*. Puedes ver el video de lo que hiciste y el mapa de calor 👉 ${links[0].url}`
          : `Ya están listas las grabaciones de tus ${links.length} pruebas del Pixel:${NL}${links.map((l) => `• *${l.donde}* 👉 ${l.url}`).join(NL)}`;

        // El texto lo arma el CÓDIGO: acá viajan URLs con un marcador al azar, y
        // un dato exacto que pasa por un modelo deja de ser exacto.
        const r = await emitirDelCatalogo('prueba-grabada', { ws: w.id, texto });

        // ⚠️ SE MARCAN AVISADAS PASE LO QUE PASE con el envío. Si el aviso falló
        // —WhatsApp caído, plantilla apagada— reintentar cada 15 minutos durante
        // 12 horas son 48 intentos por la misma prueba: cuando el canal vuelva,
        // llega una ráfaga sobre algo que ya no le importa a nadie. Es la elección
        // correcta para un aviso de conveniencia; para uno que no se puede perder,
        // sería la equivocada.
        const nuevas = [...pendientes.map(([m]) => m), ...yaAvisadas].slice(0, RECORDAR);
        await setSetting(AVISADAS_KEY, JSON.stringify(nuevas));

        return { ws: w.id, avisadas: r.ok && !r.deduped ? links.length : 0 };
      });
      if (r) hechos.push(r);
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return Response.json({ ok: true, hechos, errores });
}

/**
 * Cómo se nombra la página en el mensaje: el dominio, no la URL entera. Un link de
 * Netlify con hash de deploy ocupa dos renglones de WhatsApp y no dice nada más
 * que el dominio. Si no se puede parsear, se dice «tu página» — que es cierto.
 */
function dominio(u: string | null): string {
  if (!u) return 'tu página';
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'tu página'; }
}
