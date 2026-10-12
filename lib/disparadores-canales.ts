// =============================================================================
// disparadores-canales — ¿están conectados Instagram, Messenger y el email? (para el CRON)
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026): los eventos de Instagram, Messenger y Email se ofrecen en el
// CRON «con los que ManyChat apaga apagados, y todos apagados con su motivo si el canal no está
// conectado». Un evento de un canal que no puede llegar es una automatización que no arranca nunca,
// sin un error: por eso la pantalla pregunta antes de ofrecerlo.
//
// ⚠️ ES UNA LECTURA, Y «NO PUDE LEER» NO ES «NO ESTÁ»: `conectado: null` cuando la consulta (o Zernio)
// falla. La pantalla lo dice así y tampoco ofrece los eventos, pero no le dice al dueño que conecte
// algo que puede estar perfectamente conectado.
//
// Las preguntas, y lo que contestan HOY (12/10/2026):
//   · Instagram y Messenger: ZERNIO configurado y una cuenta de esa plataforma (`estadoMedios`, más abajo: la
//     MISMA lectura que la tarjeta, «Probar» y Publicar, con tope de 8 s). Los eventos de los dos llegan SÓLO por
//     el webhook de Zernio (app/api/webhooks/zernio/route.ts).
//     ⚠️ HASTA LA DUODÉCIMA TANDA ESTO MIRABA LA PÁGINA DE FACEBOOK (Graph: `META_PAGE_ID` y la cuenta de
//     Instagram vinculada a la página). Eran DOS verdades de «conectado»: el CRON decía «conectado» a un negocio
//     con página y sin Zernio, que no recibe un solo evento (ws 1, 9 y 15), y la tarjeta decía «Sin cuenta». El
//     CRON y la tarjeta abren además el MISMO modal (`ConectarMedio`). docs/diseno-duodecima-tanda.md §2.11.
//   · Email: el remitente PROPIO del negocio conectado (`emailConectado`, lib/resend.ts). Recibir un
//     email necesita además el buzón de entrada, que es de la parte «canales».
//   · Pagos (11/10/2026): Stripe o Mercado Pago conectados en ESTE workspace (`pasarelasConectadas`,
//     lib/cobros.ts: la clave más lo que MaKo deriva — sin el aviso registrado, un pago nunca llegaría).
//
// INTEGRACIÓN: si la parte «canales» guarda otra señal de conexión (un webhook suscripto, un buzón),
// esta función es el lugar donde se suma — no una segunda lectura en otra pantalla.

import 'server-only';
import { emailConectado } from './resend';
import { SIN_EMAIL_PROPIO } from './email-remitente';
import { disparadoresDe, type Disparador, type EstadoCanal, type EstadoCanales, type FilaDisparadores } from './disparadores';
import { pasarelasConectadas } from './cobros';
import { NOMBRE_PASARELA } from './cobros-tipos';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { listarLineas, type LineaRow } from './evolution';
import { lineaPorDefault } from './lineas-whatsapp';
import { asegurarWebhook, cuentasConectadas, zernioConfigurado } from './zernio';
import { esColumnaInexistente } from './nutricion-grafo-motor';
import { plataformaDe } from './canal-social';
import type { PasoGrafo } from './flujo-grafo';
import {
  MOTIVO_MEDIO, avisoSinWebhook, medioQueFrena, mediosQueUsa, socialesConectados,
  type CronDeMedio, type EstadoMedio, type EstadoMedios, type Medio,
} from './medios-automatizacion';

const MOTIVO_EMAIL = SIN_EMAIL_PROPIO;
const MOTIVO_PAGOS = 'Conecta Stripe o Mercado Pago';
const MOTIVO_NO_SE = 'No pude comprobarlo';

export async function estadoCanalesDisparo(): Promise<EstadoCanales> {
  // Instagram y Messenger: Zernio, por la MISMA función que la tarjeta y Publicar (ver la cabecera). Arranca
  // primero y se espera al final: el tope de 8 s de Zernio corre junto con el email y los pagos.
  // `estadoMedios` no tira (lo que falla queda en «no pude comprobarlo»); el `catch` es por las dudas.
  const sociales = estadoMedios(['instagram', 'messenger']).catch((e: unknown) => {
    console.error('[disparadores-canales] Zernio:', e instanceof Error ? e.message : String(e));
    return {} as EstadoMedios;
  });
  let email: EstadoCanal;
  try {
    email = (await emailConectado()) ? { conectado: true } : { conectado: false, motivo: MOTIVO_EMAIL };
  } catch (e) {
    console.error('[disparadores-canales] el email:', e instanceof Error ? e.message : String(e));
    email = { conectado: null, motivo: MOTIVO_NO_SE };
  }
  let pagos: EstadoCanal;
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) throw new Error('sin workspace');
    const conectadas = await pasarelasConectadas(ws);
    pagos = conectadas.length ? { conectado: true, cuenta: conectadas.map((x) => NOMBRE_PASARELA[x]).join(' y ') } : { conectado: false, motivo: MOTIVO_PAGOS };
  } catch (e) {
    console.error('[disparadores-canales] las pasarelas de pago:', e instanceof Error ? e.message : String(e));
    pagos = { conectado: null, motivo: MOTIVO_NO_SE };
  }
  const medios = await sociales;
  const instagram: EstadoCanal = medios.instagram ?? { conectado: null, motivo: MOTIVO_NO_SE };
  const messenger: EstadoCanal = medios.messenger ?? { conectado: null, motivo: MOTIVO_NO_SE };
  return { instagram, messenger, email, pagos };
}

// ── Los MEDIOS de una automatización (décima tanda, GENERAL 6) ──────────────────────────────────────
// docs/diseno-automations-configuraciones.md §2: «esta función es el lugar donde se suma» (la cabecera de
// arriba). Lo que usa cada automatización y lo que le falta lo deciden las funciones puras de
// lib/medios-automatizacion.ts; acá sólo se MIDE, y sólo lo que se pide (Zernio y Meta tardan).

const NO_SE: EstadoMedio = { conectado: null, motivo: MOTIVO_NO_SE };

/** Una línea está conectada si su fila dice 'conectado' y tiene número (ws9/ws10: «conectando» sin número). */
const estadoDeLinea = (l: LineaRow | null): EstadoMedio =>
  l && l.estado === 'conectado' && l.numero ? { conectado: true, cuenta: l.numero } : { conectado: false, motivo: MOTIVO_MEDIO.whatsapp };

/** Con tope: un proveedor que no contesta no cuelga la pantalla ni el Publicar. */
function conTope<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('sin respuesta')), ms))]);
}

/**
 * ¿Están conectados los medios que se piden? Uno que no se pide queda AUSENTE (no se midió).
 * «No pude comprobarlo» es `conectado: null`: avisa y no frena (lib/medios-automatizacion.ts).
 */
export async function estadoMedios(usa: readonly Medio[]): Promise<EstadoMedios> {
  const out: EstadoMedios = {};
  const ws = usa.some((m) => m === 'instagram' || m === 'messenger') ? await getWorkspaceActual().catch(() => null) : null;
  await Promise.all(usa.map(async (m) => {
    try {
      if (m === 'whatsapp') {
        const lineas = await listarLineas();
        out.whatsapp = { porDefecto: estadoDeLinea(lineaPorDefault(lineas)), lineas: Object.fromEntries(lineas.map((l) => [l.instance_name, estadoDeLinea(l)])) };
      } else if (m === 'email') {
        out.email = (await emailConectado()) ? { conectado: true } : { conectado: false, motivo: MOTIVO_MEDIO.email };
      } else {
        if (ws == null) { out[m] = NO_SE; return; }
        if (!(await zernioConfigurado(ws))) { out[m] = { conectado: false, motivo: MOTIVO_MEDIO[m] }; return; }
        const cuentas = await conTope(cuentasConectadas(ws, plataformaDe(m)), 8000);
        const c = cuentas[0];
        out[m] = c ? { conectado: true, cuenta: c.username ? `@${c.username}` : (c.displayName ?? null) } : { conectado: false, motivo: MOTIVO_MEDIO[m] };
      }
    } catch (e) {
      console.error(`[disparadores-canales] el medio ${m}:`, e instanceof Error ? e.message : String(e));
      if (m === 'whatsapp') out.whatsapp = { porDefecto: NO_SE, lineas: {} };
      else out[m] = NO_SE;
    }
  }));
  return out;
}

/** Lo que Publicar y Activar miran de los medios. */
export type MediosAlPublicar = {
  /** El primer medio que se SABE sin conectar, con el texto de siempre. null = nada que frenar (incluido «no pude»). */
  falta: { medio: Medio; error: string } | null;
  /** Instagram y Messenger que usa (una tarjeta o el CRON) y están CONECTADOS: los que necesitan el webhook de Zernio. */
  sociales: Medio[];
};
/** Lo que vale cuando no se pudo mirar: «no pude comprobarlo» no frena. */
export const SIN_MEDIOS: MediosAlPublicar = { falta: null, sociales: [] };

/**
 * LO QUE FRENA PUBLICAR Y ACTIVAR: el primer medio que usan estos pasos O SU CRON y se SABE sin conectar, con la
 * línea de la automatización. `falta: null` = nada que frenar (incluido «no pude comprobarlo»).
 *
 * ⚠️ EL CRON CUENTA (duodécima tanda, §2.11): sin `disparadores`, un CRON de Instagram con tarjetas de WhatsApp se
 * publicaba y se activaba sin Instagram conectado, y no arrancaba nunca, sin un error. Se mide UNA vez: lo mismo dice
 * qué frena y qué sociales están conectados (`asegurarAvisosSociales`, abajo).
 */
export async function medioSinConectar(
  pasos: readonly PasoGrafo[], linea: string | null, disparadores?: readonly CronDeMedio[] | null,
): Promise<MediosAlPublicar> {
  const usa = mediosQueUsa(pasos, disparadores);
  if (!usa.length) return { falta: null, sociales: [] };
  const estado = await estadoMedios(usa);
  // La MISMA cuenta que frena «Probar» en la pantalla (decimotercera tanda, punto 3): `medioQueFrena`.
  const f = medioQueFrena(pasos, linea, disparadores, estado);
  return { falta: f ? { medio: f.medio, error: f.error } : null, sociales: socialesConectados(usa, estado) };
}

/**
 * QUE ZERNIO LE AVISE A MAKO al publicar o activar algo que usa Instagram o Messenger conectado (duodécima tanda,
 * §2.11). `asegurarWebhook` (lib/zernio.ts) es idempotente.
 *
 * ⚠️ HASTA ACÁ EL WEBHOOK SE REGISTRABA SÓLO CON EL `estado` DE /api/zernio (el modal de conectar) con una cuenta:
 * medido el 12/10/2026, ws10, 11 y 13 tenían `webhook_ok=false` y 0 eventos. Sin webhook no llega ningún DM ni
 * ningún evento del CRON, y no da error.
 *
 * ⚠️ UNA FALLA NO FRENA: se loguea y vuelve el aviso corto (`avisoSinWebhook`); null = salió o no hacía falta. Sin
 * `ZERNIO_WEBHOOK_SECRET` en la plataforma queda sólo el log: el negocio no lo puede arreglar. Con tope de 8 s,
 * como la lectura de Zernio. El ws, explícito.
 */
export async function asegurarAvisosSociales(ws: number, sociales: readonly Medio[]): Promise<string | null> {
  if (!sociales.length) return null;
  try {
    const r = await conTope(asegurarWebhook(ws), 8000);
    if (r === 'sin_secreto') console.error(`[disparadores-canales] webhook de Zernio ws${ws}: falta ZERNIO_WEBHOOK_SECRET`);
    return null;
  } catch (e) {
    console.error(`[disparadores-canales] webhook de Zernio ws${ws}:`, e instanceof Error ? e.message : String(e));
    return avisoSinWebhook(sociales);
  }
}

const COLS_CRON = 'trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at';

/**
 * Los CRON de una automatización (`disparadoresDe`, la MISMA lista que lee la pantalla), para Publicar y Activar.
 * Sin la columna `disparadores` (mig 0241 sin aplicar), la de las columnas. Tira si no se puede leer.
 */
export async function disparadoresDeSecuencia(id: number): Promise<Disparador[]> {
  const db = await getTenantDb();
  const con = await db.from('nutricion_secuencias').select(`${COLS_CRON}, disparadores`).eq('id', id).maybeSingle();
  let fila = con.data as FilaDisparadores | null;
  if (con.error) {
    if (!esColumnaInexistente(con.error)) throw new Error(`disparadoresDeSecuencia: ${con.error.message}`);
    const sin = await db.from('nutricion_secuencias').select(COLS_CRON).eq('id', id).maybeSingle();
    if (sin.error) throw new Error(`disparadoresDeSecuencia: ${sin.error.message}`);
    fila = sin.data as FilaDisparadores | null;
  }
  return fila ? disparadoresDe(fila) : [];
}

/** La línea de una automatización (`instance_name`; null = la de por default). Tira si no se puede leer. */
export async function lineaDeSecuencia(id: number): Promise<string | null> {
  const supabase = await getTenantDb();
  const { data, error } = await supabase.from('nutricion_secuencias').select('instance_name').eq('id', id).maybeSingle();
  if (error) throw new Error(`lineaDeSecuencia: ${error.message}`);
  const l = (data as { instance_name?: string | null } | null)?.instance_name;
  return typeof l === 'string' && l ? l : null;
}
