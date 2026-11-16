// =============================================================================
// LA APLICACIÓN A MAKO ACCELERATOR, del lado del servidor (16/11/2026): el lead, su historial, «Quieren entrar» y el correo a Martín
// =============================================================================
// Martín, 16/11/2026: «El formulario evidentemente tiene que funcionar… deberías mandarme el formulario… para que lo pueda ver».
// Lo llama POST /api/accelerator/aplicar con la aplicación YA validada (`leerAplicacion`, lib/aplicacion-accelerator.ts). En orden:
//   1. El lead en el CRM de la PLATAFORMA (el de ese email, o uno nuevo): «Nombre Apellido», el email, el WhatsApp y la campaña.
//      Es el mismo `leadDelComprador` del checkout (lib/compra-plan.ts), firmado como el formulario (`DONDE`).
//   2. La aplicación ENTERA en su historial (`aplicacionEnTexto`, con si califica arriba). `lead_audit.valor_nuevo` es TEXT, sin
//      tope (mig 0026): entra completa, cinco respuestas largas de hasta 2.000 caracteres incluidas.
//   3. En «Quieren entrar» (`registrarPedido`), con `origen: 'planes'`: la tabla sólo acepta 'google' y 'planes' (CHECK de la mig
//      0354), y el detalle dice que aplicó y si califica (hasta 300 caracteres, `pedidoLimpio`).
//   4. EL CORREO A MARTÍN, a `EMAIL_MAKO` (equipo@hola-mako.com, la casilla donde le llegan los avisos): el asunto con el nombre y
//      si califica, el texto entero, de dónde vino, el link para escribirle por WhatsApp y el de su ficha (`linkApp`).
//
// ⚠️ NUNCA SE PIERDE UNA APLICACIÓN. Con el lead guardado, el correo es best effort: si no sale, quien aplicó igual ve su
//    pantalla final (y Martín la tiene en el CRM). Y al revés: si la base no contestó pero el correo SALIÓ, la aplicación también
//    llegó (a su casilla, que lo dice); recién si no quedó en ningún lado se contesta el 503, y lo que escribió sigue guardado en
//    su navegador para mandarlo otra vez.
// ⚠️ ES TEXTO DE UN FORMULARIO PÚBLICO QUE VA A UN CORREO: lo escapa el único lugar que arma el HTML de un mail
//    (`renderEmailHtml` → `bodyToHtml` → `escapeHtml`, lib/email-html.ts; el asunto y el preheader también). Lo fija
//    tests/aplicacion-accelerator.test.ts con un `<script>` en una respuesta.
// ⚠️ PÚBLICO: corre sin sesión y en el workspace de la PLATAFORMA (`runWithWorkspace(wsSuperAdmin)`): sin el contexto,
//    `getTenantDb` cae al ws1, Mauricio, un cliente.
// =============================================================================

import 'server-only';
import { registrarPedido } from './pedidos-ingreso';
import { pedidoLimpio } from './pedidos-ingreso-reglas';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { logLeadEvent } from './leads';
import { leadDelComprador, type DondeDelLead } from './compra-plan';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO, linkApp } from './app-url';
import { PROGRAMA_ACELERADOR } from './planes-mako';
import { aplicacionEnTexto, type AplicacionLimpia } from './aplicacion-accelerator';
import type { OrigenCompra } from './compra-plan-reglas';

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const PROGRAMA = PROGRAMA_ACELERADOR.nombre;

/** Quién firma lo que se anota en la ficha, y cómo se cuenta un WhatsApp distinto del que ya tenía. */
const DONDE: DondeDelLead = { autor: `Formulario de ${PROGRAMA}`, al: `al aplicar a ${PROGRAMA}` };

/** Lo que lee quien aplica si su aplicación no quedó en ningún lado (ni en el CRM ni en el correo). */
export const TEXTO_NO_SE_GUARDO = 'No se pudo enviar tu aplicación. Prueba otra vez en un minuto: lo que escribiste sigue guardado.';

export type ResultadoAplicacion =
  | { ok: true; califica: boolean; leadId: number | null; avisado: boolean }
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

/** El cuerpo del correo, en texto (`renderEmailHtml` lo escapa y lo arma). `ficha`: el link a su lead, o null si no se guardó. */
export function correoDeLaAplicacion(a: AplicacionLimpia, origen: OrigenCompra | null, ficha: string | null): string {
  const nombre = `${a.nombre} ${a.apellido}`.trim();
  return [
    `${nombre} aplicó a ${PROGRAMA}.`,
    '',
    `Email: ${a.email}`,
    a.whatsapp ? `WhatsApp: +${a.whatsapp} · https://wa.me/${a.whatsapp}` : 'WhatsApp: —',
    origenEnTexto(origen),
    '',
    aplicacionEnTexto(a),
    '',
    ...(ficha
      ? ['Su ficha en el CRM de MaKo:', ficha]
      : ['⚠️ No se pudo guardar en el CRM de MaKo: este correo es la única copia de la aplicación.']),
  ].join('\n');
}

/**
 * Guarda la aplicación y le avisa a Martín. Ver el orden arriba. Nunca tira: lo que no se pudo, queda en el log y en lo que devuelve.
 */
export async function aplicarAlAccelerator(a: AplicacionLimpia, origen: OrigenCompra | null): Promise<ResultadoAplicacion> {
  const ws = await wsSuperAdmin();
  const nombre = `${a.nombre} ${a.apellido}`.trim();
  return runWithWorkspace(ws, async () => {
    let leadId: number | null = null;
    try {
      leadId = (await leadDelComprador({ nombre, email: a.email, whatsapp: a.whatsapp || null, origen }, DONDE)).leadId;
    } catch (e) {
      console.error('[aplicacion-accelerator] no pude guardar el lead de la aplicación:', msg(e));
    }
    if (leadId != null) await logLeadEvent(leadId, 'Aplicación', aplicacionEnTexto(a), DONDE.autor).catch(() => {});
    // «Quieren entrar»: best effort, nunca tira (lib/pedidos-ingreso.ts).
    await registrarPedido(pedidoLimpio({
      email: a.email, nombre, origen: 'planes', verificado: false, whatsapp: a.whatsapp, leadId,
      detalle: `Aplicó a ${PROGRAMA}: ${a.califica ? 'califica para agendar ya' : 'no califica para agendar ya'}`,
    }));
    let avisado = false;
    try {
      const r = await avisarDePlataforma({
        to: EMAIL_MAKO, tag: 'accelerator-aplicacion', asunto: asuntoDeLaAplicacion(a),
        preheader: a.califica ? 'Ya puede elegir el horario de su llamada en tu agenda.' : 'No se le abrió la agenda: si hay match, escríbele por WhatsApp.',
        cuerpo: correoDeLaAplicacion(a, origen, leadId != null ? linkApp(`/crm/${leadId}`, ws) : null),
      });
      avisado = r.enviado;
      if (!r.enviado) console.warn('[aplicacion-accelerator] el aviso de la aplicación no salió:', r.error);
    } catch (e) {
      console.warn('[aplicacion-accelerator] no pude avisar de la aplicación:', msg(e));
    }
    if (leadId == null && !avisado) return { ok: false as const, status: 503, error: TEXTO_NO_SE_GUARDO };
    return { ok: true as const, califica: a.califica, leadId, avisado };
  });
}
