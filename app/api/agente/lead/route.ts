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

type LeadCrudo = Record<string, unknown>;

/** Un lead saneado, o el motivo por el que no se puede ni proponer. */
function aFila(c: LeadCrudo, i: number): { fila: Record<string, unknown> } | { error: string } {
  const nombre = txt(c.nombre);
  const email = txt(c.email)?.toLowerCase() ?? null;
  const telefono = txt(c.telefono);
  if (!nombre) return { error: `el lead #${i + 1} no tiene "nombre"` };
  if (!email && !telefono) return { error: `"${nombre}" no tiene "email" ni "telefono": sin forma de contacto no se puede trabajar` };
  return {
    fila: {
      nombre, email, telefono,
      empresa: txt(c.empresa),
      utm_source: txt(c.utm_source),
      utm_medium: txt(c.utm_medium),
      utm_campaign: txt(c.utm_campaign),
      utm_content: txt(c.utm_content),
    },
  };
}

/** El tope por propuesta. El mismo criterio que el importador: una revisión de 500
 *  filas no la hace nadie, y partirla en dos es trabajo de quien la manda. */
const TOPE = 200;

export async function POST(req: NextRequest) {
  const ws = await wsPorAgenteToken(bearerDe(req));
  if (ws == null) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }

  // UNO O VARIOS, misma ruta. `leads: [...]` para un lote; los campos sueltos siguen
  // valiendo para uno. Dos endpoints para lo mismo obligan al que llama a elegir, y el
  // caso de «uno» es literalmente el lote de largo 1.
  const crudos: LeadCrudo[] = Array.isArray(body.leads)
    ? (body.leads as LeadCrudo[])
    : [body];

  if (!crudos.length) return NextResponse.json({ ok: false, error: 'no llegó ningún lead' }, { status: 400 });
  if (crudos.length > TOPE) {
    return NextResponse.json({ ok: false, error: `son ${crudos.length} y el tope por propuesta es ${TOPE}. Partilo en dos.` }, { status: 400 });
  }

  const filas: Array<Record<string, unknown>> = [];
  const errores: string[] = [];
  crudos.forEach((c, i) => {
    const r = aFila(c ?? {}, i);
    if ('error' in r) errores.push(r.error); else filas.push(r.fila);
  });

  // Si NINGUNO sirve, es un 400: no se deja una propuesta vacía que el usuario abra
  // para encontrarse con nada.
  if (!filas.length) {
    return NextResponse.json({ ok: false, error: errores.join(' · ') || 'ningún lead válido' }, { status: 400 });
  }

  const origenTxt = txt(body.origen);

  try {
    // La ref por defecto sale de los CONTACTOS, no de los nombres: dos personas se
    // llaman igual, pero un teléfono o un mail identifican a una.
    const ref = txt(body.ref) ?? `lead:${filas.map((f) => f.telefono ?? f.email).join(',')}`.slice(0, 200);

    const { id, nueva } = await crearPropuesta({
      ws,
      tipo: 'lead',
      origen: 'claude',
      ref,
      resumen: filas.length === 1
        ? `${filas[0].nombre}${origenTxt ? ` · ${origenTxt}` : ''}`
        : `${filas.length} contactos${origenTxt ? ` · ${origenTxt}` : ''}`,
      datos: { leads: filas, origen: origenTxt },
    });

    // El link va ENTERO y absoluto. Un path suelto no es clicable en un chat, y este
    // repo ya pagó que un link armado a medias resolviera a otra cosa.
    return NextResponse.json({
      ok: true,
      propuesta: id,
      nueva,
      leads: filas.length,
      // Lo que NO entró se devuelve: un lead que se cae en silencio es peor que un error.
      descartados: errores.length ? errores : undefined,
      url: `${APP_BASE_URL}/crm/revisar/${id}`,
      mensaje: 'Quedó para confirmar. Pasale el link al usuario: los contactos entran al CRM recién cuando los confirma.',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
