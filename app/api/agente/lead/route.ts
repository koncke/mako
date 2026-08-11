// =============================================================================
// POST /api/agente/lead — meter un lead al CRM desde afuera
// =============================================================================
// Auth: `Authorization: Bearer <token de /integraciones>`, igual que el resto de
// /api/agente/*. El workspace lo resuelve el token: no hay forma de pedir el de otro.
//
// POR QUÉ EXISTE. El agente ya podía LEER el negocio y proponer tareas, pero no tenía
// ninguna forma de meter un contacto. El caso que lo pidió es el más común que hay: un
// formulario de landing que le manda los leads a una planilla, y el dueño querría que
// además entren al CRM. Sin esto, el agente probaba `/leads`, `/crm`, `/contactos` y
// `/webhook` —los nombres obvios— y todos contestaban 401, con lo cual el diagnóstico
// que sacaba era «el token no tiene permisos de CRM». No era un permiso que faltaba:
// era una ruta que no existía.
//
// ⚠️ NO CREA EL LEAD: DEJA UNA PROPUESTA Y DEVUELVE UN LINK. Es la regla del producto
// —nada que venga de un canal escribe directo— y acá se estrenó al revés: la primera
// versión insertaba en `leads`. El porqué está pagado y escrito en AGENTS.md: «un DATO
// EXACTO que pasa por las manos de un LLM deja de ser exacto». Un teléfono con un
// dígito cambiado entra al CRM, no matchea su chat de WhatsApp ni su Calendly, y no se
// nota hasta que falta una conversación. La confirmación es el único momento en que un
// humano ve el dato antes de que valga.
//
// ES IDEMPOTENTE por `ref`, y no es un lujo: un formulario de landing dispara dos veces
// con una conexión mala y un Apps Script reintenta. Sin eso quedan dos propuestas del
// mismo lead y el dueño confirma un duplicado creyendo que son dos personas. Si el
// emisor no manda `ref`, se arma una con el contacto: es lo que identifica a la persona.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { crearPropuesta } from '@/lib/propuestas';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

export async function POST(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }

  const nombre = txt(body.nombre);
  const email = txt(body.email)?.toLowerCase() ?? null;
  const telefono = txt(body.telefono);
  const empresaTxt = txt(body.empresa);
  const origenTxt = txt(body.origen);

  // El nombre es lo único obligatorio, igual que en el alta manual del CRM. Y se pide
  // al menos una forma de contactarlo: un lead sin mail ni teléfono no se puede
  // trabajar, y entra al tablero solo para ensuciarlo.
  if (!nombre) return NextResponse.json({ ok: false, error: 'falta "nombre"' }, { status: 400 });
  if (!email && !telefono) {
    return NextResponse.json({ ok: false, error: 'falta "email" o "telefono": un lead sin forma de contacto no se puede trabajar' }, { status: 400 });
  }

  try {
    // La ref por defecto sale del CONTACTO, no del nombre: dos personas se llaman igual,
    // pero un teléfono o un mail identifican a una.
    const ref = txt(body.ref) ?? `lead:${telefono ?? email}`;

    const { id, nueva } = await crearPropuesta({
      ws,
      tipo: 'lead',
      origen: 'claude',
      ref,
      resumen: `${nombre}${empresaTxt ? ` · ${empresaTxt}` : ''}${origenTxt ? ` · ${origenTxt}` : ''}`,
      datos: {
        nombre, email, telefono,
        empresa: empresaTxt,
        origen: origenTxt,
        utm_source: txt(body.utm_source),
        utm_medium: txt(body.utm_medium),
        utm_campaign: txt(body.utm_campaign),
        utm_content: txt(body.utm_content),
      },
    });

    // El link va ENTERO y absoluto. Un path suelto no es clicable en un chat, y este
    // repo ya pagó que un link armado a medias resolviera a otra cosa.
    return NextResponse.json({
      ok: true,
      propuesta: id,
      nueva,
      url: `${APP_BASE_URL}/crm/revisar/${id}`,
      mensaje: 'Quedó para confirmar. Pasale el link al usuario: el lead entra al CRM recién cuando lo confirma.',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
