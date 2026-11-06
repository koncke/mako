import 'server-only';

// =============================================================================
// El correo de AVANCE de un ticket, por Resend (4/11/2026)
// =============================================================================
// Joan, el 2/11, por WhatsApp: «¿cómo van esos tickets?». Martín: «que se le envíe por email los avances. Y solamente
// cuando ya esté 100 % finalizado, ahí sí el mensaje de WhatsApp que ya tenemos».
//
// La regla (qué hito avisa, a quién y en qué orden) es PURA y está en lib/tickets-avance.ts, con su test. Acá sólo se
// enchufa a la base y a Resend. Lo corre el cron de tickets (app/api/cron/tickets/route.ts), cada 15 minutos, DESPUÉS del
// cierre y del aviso final (lib/tickets-cierre.ts), que siguen igual: esto no los reemplaza ni los repite.
//
// ⚠️ LO FIRMA MaKo (`from: REMITENTE_MAKO`) y sale por la key de la PLATAFORMA, con el contexto del workspace de la
// plataforma, como el aviso de cambio de plan (lib/aviso-plan.ts). Un correo de soporte de MaKo no sale por el Resend de
// un cliente ni con su remitente.
//
// ⚠️ «NO PUDE LEER» NO MANDA. Si no se puede leer a la persona (y con ella si apagó los correos), la vuelta corta: un
// correo a quien lo apagó es peor que un correo de menos.
// =============================================================================

import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { correoDeMakoListo, linkBajaTickets, renderEmailHtml, sendEmail } from './resend';
import { APP_BASE_URL, EMAIL_MAKO, REMITENTE_MAKO } from './app-url';
import { anotarDelCerebro } from './tickets-db';
import {
  HORAS_DEL_AVANCE, TIPO_BAJA_TICKETS, avisarAvances,
  type CorreoDelAvance, type PersonaDelAvance, type TicketDelAvance, type VueltaAvance,
} from './tickets-avance';

/** La columna de la mig 0364 que falta: la vuelta no hace nada (y lo dice una vez por instancia). */
const FALTA_COLUMNA = new Set(['42703', 'PGRST204']);
let avisoSinColumna = false;

/** La TABLA de la mig 0410 que falta (`correo_bajas`): PostgREST no la encuentra en su esquema. */
const FALTA_TABLA = new Set(['42P01', 'PGRST205']);
let avisoSinTabla = false;

/**
 * De las direcciones de esta vuelta, las que pidieron la baja (`correo_bajas`, mig 0410).
 *
 * ⚠️ TIRA SI NO PUEDE LEER, y con eso la vuelta entera no manda nada. Es la regla de la cabecera: un correo a quien pidió
 * la baja es peor que un correo de menos. Sin la tabla, lo mismo: no se sabe quién pidió la baja, así que no se escribe.
 */
async function bajasDe(emails: string[]): Promise<string[]> {
  const { data, error } = await getSupabaseServer().from('correo_bajas')
    .select('email').eq('tipo', TIPO_BAJA_TICKETS).in('email', emails);
  if (error && FALTA_TABLA.has(error.code ?? '')) {
    if (!avisoSinTabla) { avisoSinTabla = true; console.error('[tickets:avance] falta la migración 0410 (correo_bajas): no sale ningún correo de avance'); }
    throw new Error('falta la migración 0410');
  }
  if (error) throw new Error(`no pude leer las bajas: ${error.message}`);
  return (data ?? []).map((f) => String((f as { email?: unknown }).email ?? '').trim().toLowerCase()).filter(Boolean);
}

/** Una pausa entre correos: Resend topea los pedidos por segundo, y un 429 es un correo de menos. */
const PAUSA_MS = 400;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function avisarAvancesPorEmail(ahoraMs = Date.now()): Promise<VueltaAvance & { motivo?: string }> {
  const plataforma = await wsSuperAdmin();
  return runWithWorkspace(plataforma, async () => {
    const vacia: VueltaAvance = { enviados: 0, fallidos: 0, salteados: {} };
    // Sin la key o con el remitente de prueba, Resend contesta OK y no le llega nada a nadie (lib/aviso-plan.ts): no se
    // reclama ningún hito, así sale el día que se configure.
    if (!(await correoDeMakoListo())) return { ...vacia, motivo: 'el correo de MaKo no está configurado' };
    const db = getSupabaseServer();
    const desde = new Date(ahoraMs - HORAS_DEL_AVANCE * 3_600_000).toISOString();

    let sinColumna = false;

    // Un fallo de LECTURA no es un 500 del cron: la vuelta no manda nada y lo dice en su renglón, como con la 0364. Así
    // el cron sigue con sus otros pasos (el cierre y el aviso final) en vez de cortarse entero por esto.
    const vuelta = await avisarAvancesConBajas({
      wsPlataforma: plataforma,
      base: APP_BASE_URL,
      bajaDe: linkBajaTickets,
      candidatos: async () => {
        const { data, error } = await db.from('tickets')
          .select('id, titulo, estado, workspace_id, usuario_id, canal, ref, avance_email')
          .not('usuario_id', 'is', null).neq('canal', 'sistema').gte('updated_at', desde)
          .or('avance_email.is.null,avance_email.neq.resuelto')
          .order('updated_at', { ascending: false }).limit(200);
        if (error && FALTA_COLUMNA.has(error.code ?? '')) { sinColumna = true; return []; }
        if (error) throw new Error(`no pude leer los tickets: ${error.message}`);
        return (data ?? []) as TicketDelAvance[];
      },
      personas: async (ids) => {
        const { data, error } = await db.from('usuarios').select('id, email, workspace_id, estado, perfil').in('id', ids);
        if (error) throw new Error(`no pude leer a quién escribirle: ${error.message}`);
        return (data ?? []) as PersonaDelAvance[];
      },
      bajas: bajasDe,
      reclamar: async (id, antes, hito) => {
        let q = db.from('tickets').update({ avance_email: hito, avance_email_at: new Date().toISOString() }).eq('id', id);
        q = antes == null ? q.is('avance_email', null) : q.eq('avance_email', antes);
        const { data, error } = await q.select('id');
        if (error) { console.error(`[tickets:avance] no pude marcar #${id}: ${error.message}`); return false; }
        return !!data?.length;
      },
      mandar: async (c: CorreoDelAvance) => {
        const r = await mandarCorreo(c);
        await dormir(PAUSA_MS);
        return r;
      },
      anotar: (id, texto) => anotarDelCerebro(id, texto, 'sistema'),
    });
    if (sinColumna) {
      if (!avisoSinColumna) { avisoSinColumna = true; console.error('[tickets:avance] falta la migración 0364 (tickets.avance_email): no sale ningún correo de avance'); }
      return { ...vuelta, motivo: 'falta la migración 0364' };
    }
    return vuelta;
  });
}

/**
 * `avisarAvances`, pero un fallo al leer las bajas no se propaga: devuelve la vuelta vacía con el motivo.
 *
 * ⚠️ NO ENVUELVE CUALQUIER ERROR: sólo los de `bajas` (lo demás ya se maneja adentro, y un throw de `candidatos` o de
 * `personas` tiene que seguir siendo un rojo del cron). Y lo que NO hace es seguir sin las bajas: eso sería mandarle un
 * correo a quien pidió que no le escribieran.
 */
async function avisarAvancesConBajas(d: Parameters<typeof avisarAvances>[0]): Promise<VueltaAvance & { motivo?: string }> {
  let fallo: string | null = null;
  const bajas = d.bajas;
  const vuelta = await avisarAvances({
    ...d,
    bajas: bajas && (async (emails) => {
      try { return await bajas(emails); } catch (e) {
        fallo = e instanceof Error ? e.message : String(e);
        // Tira igual: `avisarAvances` corta la vuelta y no manda nada. El motivo lo pone el caller.
        throw e;
      }
    }),
  }).catch((e: unknown) => {
    if (fallo) return { enviados: 0, fallidos: 0, salteados: {} } as VueltaAvance;
    throw e;
  });
  return fallo ? { ...vuelta, motivo: `no pude leer las bajas de correo: ${fallo}` } : vuelta;
}

function mandarCorreo(c: CorreoDelAvance) {
  return sendEmail({
    to: c.a,
    from: REMITENTE_MAKO,
    replyTo: EMAIL_MAKO,
    subject: c.asunto,
    html: renderEmailHtml({
      subject: c.asunto,
      bodyText: c.cuerpo,
      preheader: c.previa,
      fromName: 'MaKo',
      marca: 'mako',
      cta: { texto: 'Ver mi ticket', url: c.link },
      unsubscribeUrl: c.baja,
    }),
    text: c.texto,
    // La baja de un toque (RFC 8058): Gmail y Outlook la muestran arriba del correo, y sin ella lo mandan a spam.
    headers: { 'List-Unsubscribe': `<${c.baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    tags: [{ name: 'tipo', value: 'ticket-avance' }],
  });
}
