// =============================================================================
// LA APLICACIÓN A MAKO ACCELERATOR, del lado del servidor (16/11/2026): el lead, su historial, «Quieren entrar» y el correo a Martín
// =============================================================================
// Martín, 16/11/2026: «El formulario evidentemente tiene que funcionar… deberías mandarme el formulario… para que lo pueda ver».
// Lo llama POST /api/accelerator/aplicar con la aplicación YA validada (`leerAplicacion`, lib/aplicacion-accelerator.ts). En orden:
//   1. El lead en el CRM de la PLATAFORMA (el de ese email, o uno nuevo): «Nombre Apellido», el email, el WhatsApp y la campaña.
//      Es el mismo `leadDelComprador` del checkout (lib/compra-plan.ts), firmado como el formulario (`DONDE`) y SIN VERIFICAR: en una
//      ficha que ya existía no completa ni pisa nada, lo distinto va a su historial (ver `DondeDelLead`).
//   2. La aplicación ENTERA en su historial (`aplicacionEnTexto`, con si califica arriba). `lead_audit.valor_nuevo` es TEXT, sin
//      tope (mig 0026): entra completa, cinco respuestas largas de hasta 2.000 caracteres incluidas. En una ficha que ya existía,
//      con `SIN_VERIFICAR_EN_LA_FICHA` arriba: cualquiera puede escribir el email de otra persona.
//   3. En «Quieren entrar» (`registrarPedido`), con `origen: 'planes'`: la tabla sólo acepta 'google' y 'planes' (CHECK de la mig
//      0354), y el detalle dice que aplicó y si califica (hasta 300 caracteres, `pedidoLimpio`). Una fila que ya existía sólo suma
//      el intento (`sinCompletar`).
//   4. EL CORREO A MARTÍN, a `EMAIL_MAKO` (equipo@hola-mako.com, la casilla donde le llegan los avisos): el asunto con el nombre y
//      si califica, el texto entero, de dónde vino, el link para escribirle por WhatsApp y el de su ficha (`linkApp`). Si no sale,
//      un aviso en la app de MaKo (la bandeja de avisos y el push a quien administra, `avisoSoloEnLaApp`): antes quedaba sólo un
//      `console.warn` y nadie se enteraba.
//
// ⚠️ NUNCA SE PIERDE UNA APLICACIÓN. Con el lead guardado, el correo es best effort: si no sale, quien aplicó igual ve su
//    pantalla final (y Martín la tiene en el CRM, y el aviso en la app). Y al revés: si la base no contestó pero el correo SALIÓ, la
//    aplicación también llegó (a su casilla, que lo dice); recién si no quedó en ningún lado se contesta el 503, y lo que escribió
//    sigue guardado en su navegador para mandarlo otra vez.
// ⚠️ LA MISMA APLICACIÓN DOS VECES NO SE GUARDA DOS VECES (revisión del 16/11/2026): si la respuesta se pierde (la red del
//    teléfono) y la persona vuelve a enviar, quedaban dos aplicaciones en la ficha y dos correos. La de ese lead en las últimas 24 h
//    con el MISMO texto es un reenvío: no se escribe otra vez (`yaLlego`). Con el texto y no con un id del envío: lo que se reenvía
//    con un cambio (corrigió algo después del error) sí llega, como la versión nueva.
// ⚠️ EL CORREO LLEVA SU `Idempotency-Key` (revisión de la tercera tanda, 16/11/2026, hallazgo 5): sin ella el envío de Resend no
//    tiene tiempo máximo (lib/resend.ts), y uno colgado frenaba la ruta hasta su `maxDuration` (60 s). La persona veía el error,
//    reenviaba, `yaLlego` contestaba «ok» SIN volver a mandar el correo, y a Martín no le llegaba nunca. Ahora: con la clave el envío
//    corta a los 15 s, y el reenvío vuelve a llamar al correo con la MISMA clave (`claveDelCorreo`, la huella de lo que se manda):
//    si la primera vez salió, Resend contesta lo de antes y no manda otro; si no salió, sale ahora.
// ⚠️ ES TEXTO DE UN FORMULARIO PÚBLICO QUE VA A UN CORREO: lo escapa el único lugar que arma el HTML de un mail
//    (`renderEmailHtml` → `bodyToHtml` → `escapeHtml`, lib/email-html.ts; el asunto y el preheader también). Lo fija
//    tests/aplicacion-accelerator.test.ts con un `<script>` en una respuesta.
// ⚠️ PÚBLICO: corre sin sesión y en el workspace de la PLATAFORMA (`runWithWorkspace(wsSuperAdmin)`): sin el contexto,
//    `getTenantDb` cae al ws1, Mauricio, un cliente.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { registrarPedido } from './pedidos-ingreso';
import { pedidoLimpio } from './pedidos-ingreso-reglas';
import { getTenantDb, runWithWorkspace, wsSuperAdmin } from './workspace';
import { logLeadEvent } from './leads';
import { leadDelComprador, type DondeDelLead } from './compra-plan';
import { avisarDePlataforma } from './invitaciones';
import { avisoSoloEnLaApp } from './aviso-en-la-app';
import { EMAIL_MAKO, linkApp } from './app-url';
import { PROGRAMA_ACELERADOR } from './planes-mako';
import { aplicacionEnTexto, linkDeLaAgenda, type AplicacionLimpia } from './aplicacion-accelerator';
import type { OrigenCompra } from './compra-plan-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const PROGRAMA = PROGRAMA_ACELERADOR.nombre;

/** Quién firma lo que se anota en la ficha, cómo se cuenta un WhatsApp distinto, y que nada de esto está verificado. */
const DONDE: DondeDelLead = { autor: `Formulario de ${PROGRAMA}`, al: `al aplicar a ${PROGRAMA}`, sinVerificar: true };

/** El campo del historial donde va la aplicación entera. */
export const CAMPO_APLICACION = 'Aplicación';

/** Lo que va arriba de la aplicación en una ficha que ya existía: la escribió alguien con su email, y nadie lo verificó. */
export const SIN_VERIFICAR_EN_LA_FICHA = 'Sin verificar: esta ficha ya existía y la aplicación llegó del formulario público, que cualquiera puede llenar con el email de otra persona. Lo que escribió no cambió la ficha.';

/** Cuánto atrás se mira si la misma aplicación ya llegó (un reenvío porque se perdió la respuesta). */
export const VENTANA_REPETIDA_MS = 24 * 3600_000;

/** Lo que lee quien aplica si su aplicación no quedó en ningún lado (ni en el CRM ni en el correo). */
export const TEXTO_NO_SE_GUARDO = 'No se pudo enviar tu aplicación. Prueba otra vez en un minuto: lo que escribiste sigue guardado.';

export type ResultadoAplicacion =
  | { ok: true; califica: boolean; leadId: number | null; avisado: boolean; repetida?: true }
  | { ok: false; status: number; error: string };

/** De dónde vino, para el correo: la landing y la campaña. El fbclid no se copia (es un número largo): dice que vino de Meta. */
export function origenEnTexto(o: OrigenCompra | null): string {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(o ?? {})) {
    if (!v) continue;
    if (k === 'fbclid') partes.push('un anuncio de Meta (fbclid)');
    else if (k === 'landing') partes.push(`la landing «${v}»`);
    else partes.push(`${k}: ${v}`);
  }
  return partes.length ? `De dónde vino: ${partes.join(' · ')}.` : 'De dónde vino: entró directo, sin campaña.';
}

/** El asunto del correo: el nombre y si califica (lo primero que Martín ve en la bandeja). */
export const asuntoDeLaAplicacion = (a: Pick<AplicacionLimpia, 'nombre' | 'apellido' | 'califica'>): string =>
  `${`${a.nombre} ${a.apellido}`.trim()} aplicó a ${PROGRAMA} · ${a.califica ? 'califica' : 'no califica'}`;

/** El asunto del correo de una aplicación con el campo trampa lleno (`avisarDeLaTrampa`). */
export const asuntoDeLaTrampa = (a: Pick<AplicacionLimpia, 'nombre' | 'apellido' | 'califica'>): string => `Posible bot · ${asuntoDeLaAplicacion(a)}`;

/**
 * La `Idempotency-Key` del correo (hallazgo 5 de la revisión): la huella de TODO lo que se manda (a quién, el tipo, el asunto, el
 * preheader y el cuerpo). La misma aplicación reenviada arma el mismo correo y la misma clave, y Resend no lo manda dos veces; uno
 * que cambió en algo es otro correo, con otra clave (con la misma y otro cuerpo, Resend contestaría 409). Dura 24 h, como la
 * ventana del reenvío (`VENTANA_REPETIDA_MS`).
 */
export function claveDelCorreo(m: { to: string; tag: string; asunto: string; preheader: string; cuerpo: string }): string {
  const huella = createHash('sha256').update([m.to, m.tag, m.asunto, m.preheader, m.cuerpo].join('\u0000')).digest('hex').slice(0, 48);
  return `${m.tag}:${huella}`;
}

/**
 * El cuerpo del correo, en texto (`renderEmailHtml` lo escapa y lo arma). `ficha`: el link a su lead, o null si no se guardó.
 * `trampa`: llegó con el campo trampa lleno y no se guardó a propósito (no es «no se pudo guardar»).
 */
export function correoDeLaAplicacion(a: AplicacionLimpia, origen: OrigenCompra | null, ficha: string | null, o: { trampa?: boolean } = {}): string {
  const nombre = `${a.nombre} ${a.apellido}`.trim();
  const pie = o.trampa
    ? []
    : ficha
      ? ['', 'Su ficha en el CRM de MaKo:', ficha]
      : ['', '⚠️ No se pudo guardar en el CRM de MaKo: este correo es la única copia de la aplicación.'];
  return [
    ...(o.trampa
      ? [
        'El campo trampa del formulario llegó lleno: puede ser un bot, o un autocompletado en el navegador de una persona de verdad.',
        'No se guardó en el CRM ni en «Quieren entrar», y a quien la mandó se le mostró «Recibí tu aplicación». Si es una persona, este correo es la única copia.',
        '',
      ]
      : []),
    `${nombre} aplicó a ${PROGRAMA}.`,
    '',
    `Email: ${a.email}`,
    a.whatsapp ? `WhatsApp: +${a.whatsapp} · https://wa.me/${a.whatsapp}` : 'WhatsApp: —',
    origenEnTexto(origen),
    '',
    aplicacionEnTexto(a),
    // Su agenda YA CONTESTADA (16/11/2026): nadie agenda solo al aplicar; si hay match, Martín se la manda y no escribe nada otra vez.
    ...(o.trampa ? [] : ['', 'Su agenda, ya contestada, para mandársela si hay match:', linkDeLaAgenda(a.valores)]),
    ...pie,
  ].join('\n');
}

/** El correo a Martín con su `Idempotency-Key` (`claveDelCorreo`): con la clave, Resend no lo manda dos veces y corta a los 15 s. */
async function mandarAMartin(m: { tag: string; asunto: string; preheader: string; cuerpo: string }) {
  const correo = { to: EMAIL_MAKO, ...m };
  return avisarDePlataforma({ ...correo, idempotencyKey: claveDelCorreo(correo) });
}

/**
 * ¿La MISMA aplicación ya quedó en la ficha de ese lead en las últimas 24 h? (un reenvío: la respuesta se perdió y volvió a tocar
 * «Enviar»). Termina con el mismo texto: arriba puede llevar `SIN_VERIFICAR_EN_LA_FICHA`. Sin poder leer, no: mejor dos que ninguna.
 */
async function yaLlego(leadId: number, texto: string): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const desde = new Date(Date.now() - VENTANA_REPETIDA_MS).toISOString();
    const { data, error } = await db.from('lead_audit').select('valor_nuevo')
      .eq('lead_id', leadId).eq('campo', CAMPO_APLICACION).gte('created_at', desde)
      .order('created_at', { ascending: false }).limit(5);
    if (error) return false;
    return ((data ?? []) as Array<{ valor_nuevo: string | null }>).some((f) => String(f.valor_nuevo ?? '').endsWith(texto));
  } catch {
    return false;
  }
}

/**
 * EL CAMPO TRAMPA LLENO CON UNA APLICACIÓN VÁLIDA (revisión del 16/11/2026): un autocompletado, un gestor de contraseñas o una
 * extensión pueden llenarlo en el navegador de una persona de verdad, y su aplicación se perdía sin rastro (200, nada guardado,
 * nada en el log). No se guarda (el bot no aprende nada: ve lo mismo que quien no califica), pero le llega a Martín como «Posible
 * bot». Nunca tira. true = el correo salió.
 */
export async function avisarDeLaTrampa(a: AplicacionLimpia, origen: OrigenCompra | null): Promise<boolean> {
  try {
    const ws = await wsSuperAdmin();
    return await runWithWorkspace(ws, async () => {
      const r = await mandarAMartin({
        tag: 'accelerator-aplicacion-trampa', asunto: asuntoDeLaTrampa(a),
        preheader: 'El campo trampa llegó lleno: no se guardó en el CRM.',
        cuerpo: correoDeLaAplicacion(a, origen, null, { trampa: true }),
      });
      if (!r.enviado) console.warn('[aplicacion-accelerator] el correo de la aplicación con la trampa llena no salió:', r.error);
      return r.enviado;
    });
  } catch (e) {
    console.warn('[aplicacion-accelerator] no pude avisar de la aplicación con la trampa llena:', msg(e));
    return false;
  }
}

/**
 * Guarda la aplicación y le avisa a Martín. Ver el orden arriba. Nunca tira: lo que no se pudo, queda en el log y en lo que devuelve.
 */
export async function aplicarAlAccelerator(a: AplicacionLimpia, origen: OrigenCompra | null): Promise<ResultadoAplicacion> {
  const ws = await wsSuperAdmin();
  const nombre = `${a.nombre} ${a.apellido}`.trim();
  return runWithWorkspace(ws, async () => {
    let lead: { leadId: number; nuevo: boolean } | null = null;
    try {
      lead = await leadDelComprador({ nombre, email: a.email, whatsapp: a.whatsapp || null, origen }, DONDE);
    } catch (e) {
      console.error('[aplicacion-accelerator] no pude guardar el lead de la aplicación:', msg(e));
    }
    const leadId = lead?.leadId ?? null;
    const texto = aplicacionEnTexto(a);
    // Un reenvío (la respuesta se perdió): no se escribe otra vez, pero el correo SÍ se vuelve a pedir, con la misma clave (arriba).
    const repetida = !!lead && !lead.nuevo && await yaLlego(lead.leadId, texto);
    if (repetida) {
      console.info(`[aplicacion-accelerator] la misma aplicación otra vez (lead ${leadId}): no se guarda de nuevo; el correo va con la misma clave.`);
    } else {
      if (lead) await logLeadEvent(lead.leadId, CAMPO_APLICACION, lead.nuevo ? texto : `${SIN_VERIFICAR_EN_LA_FICHA}\n\n${texto}`, DONDE.autor).catch(() => {});
      // «Quieren entrar»: best effort, nunca tira (lib/pedidos-ingreso.ts). Una fila que ya existía sólo suma el intento.
      await registrarPedido(pedidoLimpio({
        email: a.email, nombre, origen: 'planes', verificado: false, whatsapp: a.whatsapp, leadId, sinCompletar: true,
        detalle: `Aplicó a ${PROGRAMA}: ${a.califica ? 'califica' : 'no califica'}`,
      }));
    }
    const ficha = leadId != null ? linkApp(`/crm/${leadId}`, ws) : null;
    let avisado = false;
    let porQue = '';
    try {
      const r = await mandarAMartin({
        tag: 'accelerator-aplicacion', asunto: asuntoDeLaAplicacion(a),
        preheader: a.califica ? 'Califica. Le prometiste responder en 24 horas.' : 'No califica. Igual le prometiste responder en 24 horas.',
        cuerpo: correoDeLaAplicacion(a, origen, ficha),
      });
      avisado = r.enviado;
      if (!r.enviado) { porQue = r.error ?? ''; console.warn('[aplicacion-accelerator] el aviso de la aplicación no salió:', r.error); }
    } catch (e) {
      porQue = msg(e);
      console.warn('[aplicacion-accelerator] no pude avisar de la aplicación:', porQue);
    }
    // EL CORREO NO SALIÓ: un aviso en la app (la bandeja y el push a quien administra la plataforma). Best effort.
    if (!avisado) {
      const donde = ficha ? `Está en su ficha: ${ficha}` : `Tampoco quedó en el CRM. Email: ${a.email} · WhatsApp: ${a.whatsapp ? `+${a.whatsapp}` : '—'}.`;
      await avisoSoloEnLaApp(ws, `${nombre} aplicó a ${PROGRAMA} (${a.califica ? 'califica' : 'no califica'}) y el correo a ${EMAIL_MAKO} no salió${porQue ? ` (${porQue})` : ''}. ${donde}`, {
        tipo: 'accelerator-aplicacion', titulo: `El correo de la aplicación de ${nombre} no salió`,
      }).catch((e) => { console.warn('[aplicacion-accelerator] tampoco pude dejar el aviso en la app:', msg(e)); });
    }
    if (leadId == null && !avisado) return { ok: false as const, status: 503, error: TEXTO_NO_SE_GUARDO };
    return { ok: true as const, califica: a.califica, leadId, avisado, ...(repetida ? { repetida: true as const } : {}) };
  });
}
