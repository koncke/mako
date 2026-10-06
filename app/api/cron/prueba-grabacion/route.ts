// =============================================================================
// Cron: prueba-grabacion — avisa cuando la grabación de una prueba ya se puede ver
// =============================================================================
// Al terminar una prueba del Pixel, quien probó suele cerrar la pantalla. La
// grabación de esa visita queda guardándose —el cuerpo se sella en el cron
// `replay-purga`, cada 10 minutos— y para cuando está lista ya no hay nadie
// mirando. Por eso el aviso, y por eso por WhatsApp: es el único canal que llega
// cuando la pantalla ya no está abierta.
//
// ⚠️ HASTA EL 06/10/2026 ESTE CRON ERA DE CLARITY, y por eso esperaba 45 minutos:
// Microsoft procesaba las sesiones en lote, tardaba entre 30 minutos y 2 horas y
// no tenía webhook. Con la grabación PROPIA no hay que adivinar: una sesión está
// lista cuando tiene `storage_path`, que es lo que escribe el sellado. Se avisa en
// el primer tick después de eso, y con un link que lleva DIRECTO a mirarla — la
// ficha del lead PRUEBA de esa página (`lib/lead-de-prueba.ts`), donde vive el
// reproductor. El de Clarity mandaba a un panel ajeno con login aparte.
//
// ⚠️ CADA 15 MINUTOS Y NO UNA VEZ POR DÍA. Los otros vigilantes de landing corren
// a las 13:50 porque contestan preguntas de días («¿el código quedó viejo?»). Este
// contesta una de minutos: una prueba hecha a las 15:00 avisada al día siguiente es
// un aviso que no sirve — para entonces ya se probó de nuevo, o se dio por roto.
// =============================================================================

import { type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { asegurarLeadDePrueba } from '@/lib/lead-de-prueba';
import { linkApp } from '@/lib/app-url';
import { emitirDelCatalogo } from '@/lib/avisos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Qué pruebas ya se avisaron. Sin esto, el aviso se repetiría cada 15 minutos. */
export const AVISADAS_KEY = 'landing.pruebas_avisadas';

/**
 * Hasta cuándo se mira para atrás. Una prueba de hace dos días ya no le importa
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

type Fila = { prueba: string | null; landing_url: string | null; inicio: string };
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
        // La grabación está siempre prendida desde el 06/10/2026 (ya no hay apagador
        // que mirar): lo que decide si hay algo que avisar es si llegó una sesión.
        const db = await getTenantDb();
        const desde = new Date(Date.now() - VENTANA_H * 3_600_000).toISOString();
        const { data, error } = await db
          .from('replay_sesiones')
          .select('prueba, landing_url, inicio')
          .not('prueba', 'is', null)
          // ⚠️ LISTA = SELLADA. Una sesión sin `storage_path` está grabando o
          // esperando el sellado: el link abriría una ficha con la sesión en la
          // lista y nada que reproducir, que es exactamente lo que este aviso
          // existe para no hacer.
          .not('storage_path', 'is', null)
          .gte('inicio', desde)
          .order('inicio', { ascending: false })
          .limit(200);
        if (error) throw new Error(`replay_sesiones: ${error.message}`);

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

        // ⚠️ DE LA MÁS VIEJA A LA MÁS NUEVA, y no al revés. El lead PRUEBA de una
        // página se REUSA y a cada prueba se le repunta el visitante: procesando la
        // más nueva primero, la última en escribir sería la más vieja, y la ficha
        // mostraría una prueba anterior a la que se está avisando.
        //
        // ⚠️ Y UN LINK POR LEAD, no por prueba: dos pruebas de la misma página
        // terminan en el mismo PRUEBA, y dos links iguales en un mensaje se leen
        // como un error de quien lo armó.
        const porLead = new Map<number, string>();
        for (const [marcador, fila] of [...pendientes].reverse()) {
          const lead = await asegurarLeadDePrueba(w.id, marcador);
          if (!lead.ok) continue;
          porLead.set(lead.leadId, dominio(fila.landing_url));
        }
        const links = [...porLead.entries()].map(([id, donde]) => ({ donde, url: linkApp(`/crm/${id}`, w.id) }));
        if (!links.length) return null;

        // El texto lo arma el CÓDIGO: acá viajan links con un id, y un dato exacto
        // que pasa por un modelo deja de ser exacto.
        const texto = links.length === 1
          ? `Ya puedes ver la grabación de tu prueba en *${links[0].donde}* 👉 ${links[0].url}`
          : `Ya puedes ver las grabaciones de tus pruebas:${NL}${links.map((l) => `• *${l.donde}* 👉 ${l.url}`).join(NL)}`;

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
