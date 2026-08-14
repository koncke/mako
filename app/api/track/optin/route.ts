// =============================================================================
// POST /api/track/optin — el formulario de una landing entra al CRM
// =============================================================================
// El caso: una clienta tiene una landing con un formulario de opt-in y después
// contacta a esa gente por WhatsApp. Los registros no llegaban al CRM porque las
// únicas entradas cableadas eran el formulario instantáneo de Meta y una agenda
// de Calendly — las de un funnel de VSL con llamadas, que no es su negocio.
//
// AUTH: el mismo `landing_token` del beacon (`/api/track/vsl`), en el body. No es
// un secreto —viaja en el HTML de una página pública, como cualquier pixel— y no
// autoriza a leer nada: solo IDENTIFICA el workspace. El ruteo es fail-closed
// (`wsPorIdentificador`): sin mapeo no se toca un dato.
//
// ⚠️ NO CREA EL LEAD: DEJA UNA PROPUESTA. Es la regla del producto —un canal
// PROPONE, una persona confirma— y acá cubre justo el riesgo de un endpoint
// abierto: un formulario con un campo raro, un bot o un doble submit se
// convierten en algo para revisar, nunca en un lead corrupto adentro del CRM.
//
// ⚠️ Y NO INGESTA SI EL NEGOCIO NO LO DECLARÓ. La puerta es `entradas` del
// funnel del workspace (`funnel_config.data.entradas`, que se configura en
// /funnel): si ese cliente no declaró que sus leads entran por una landing, el
// opt-in se ACEPTA y se ignora. Así el mismo snippet se le puede dar a todos sin
// que a nadie se le empiecen a llenar el CRM de contactos que no esperaba — la
// política la decide el server, y el código pegado en la página no decide nada.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { emitirDelCatalogo } from '@/lib/avisos';
import { APP_BASE_URL } from '@/lib/app-url';
import { crearPropuesta } from '@/lib/propuestas';
import { LANDING_SERVICIO } from '@/lib/landing-token';
import { wsPorIdentificador } from '@/lib/webhook-routing';
import { getFunnel } from '@/lib/leads';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// El snippet corre en el dominio del cliente (Lovable, Framer, WordPress…), así
// que el navegador exige CORS. Mismo criterio que el beacon: abierto, porque el
// token ya identifica y la ruta no devuelve nada de nadie.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, 300) : null;
};

const ok = (extra: Record<string, unknown>) => NextResponse.json({ ok: true, ...extra }, { headers: CORS });

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }

  const token = txt(body.token) ?? txt(body.landing_token);
  if (!token) return NextResponse.json({ ok: false, error: 'falta el token de la landing' }, { status: 400, headers: CORS });

  const ws = await wsPorIdentificador(LANDING_SERVICIO, token);
  // Fail-closed: un token que no mapea a nada no cae al dueño ni a ningún lado.
  if (ws == null) {
    console.warn(`[track:optin] token sin workspace — ignorado`);
    return ok({ ignorado: 'token desconocido' });
  }

  // La puerta del negocio. 200 y no 403: la página de un cliente que todavía no
  // declaró la landing como entrada no tiene por qué mostrar un error a SU
  // visitante — el formulario suyo tiene que seguir funcionando igual.
  // `getFunnel()` es el MISMO lector que usa /funnel: la puerta se lee de donde
  // el cliente la configura, no de una copia.
  const entradas = await runWithWorkspace(ws, () => getFunnel())
    .then((f) => f.entradas as string[])
    .catch(() => [] as string[]);
  if (!entradas.includes('landing')) {
    return ok({ ignorado: 'este negocio no tiene la landing declarada como entrada de leads' });
  }

  const nombre = txt(body.nombre) ?? txt(body.name) ?? txt(body.nombre_completo);
  const email = (txt(body.email) ?? txt(body.correo))?.toLowerCase() ?? null;
  const telefono = txt(body.telefono) ?? txt(body.phone) ?? txt(body.whatsapp) ?? txt(body.celular);

  // Sin forma de contacto no hay nada que trabajar: el lead nace muerto y el
  // dueño no puede hacer nada con esa tarjeta. Se rechaza acá y no en la
  // revisión, para no llenarle la bandeja de propuestas inservibles.
  if (!email && !telefono) {
    return NextResponse.json(
      { ok: false, error: 'hace falta al menos email o teléfono' },
      { status: 400, headers: CORS },
    );
  }

  // Idempotencia por `ref`. Un formulario dispara dos veces con mala conexión y
  // un submit se reintenta; sin esto quedan dos tarjetas de la misma persona y
  // quien revisa confirma un duplicado creyendo que son dos.
  // ⚠️ LA LLAVE SE NORMALIZA. Era el teléfono CRUDO del input, así que la MISMA
  // persona escribiendo «998 136 1529» y «9981361529» creaba dos propuestas —
  // justo lo que la idempotencia venía a evitar. Se queda con los dígitos y con
  // los últimos 10: el mismo número con y sin código de país es el mismo número.
  const clave = email ?? (telefono ? telefono.replace(/\D/g, '').slice(-10) : null);
  const ref = txt(body.ref) ?? `landing:${clave}`;

  const { id, nueva } = await crearPropuesta({
    ws,
    tipo: 'lead',
    origen: 'landing',
    ref,
    resumen: `${nombre ?? email ?? telefono} — dejó sus datos en tu página`,
    datos: {
      leads: [{
        nombre: nombre ?? email ?? telefono,
        email,
        telefono,
        empresa: txt(body.empresa) ?? txt(body.company),
        utm_source: txt(body.utm_source),
        utm_medium: txt(body.utm_medium),
        utm_campaign: txt(body.utm_campaign),
        utm_content: txt(body.utm_content),
        // De dónde salió, textual. Es lo que después distingue «llenó el
        // formulario de la landing» de «lo cargó alguien a mano».
        origen: 'landing',
        pagina: txt(body.pagina) ?? txt(body.url) ?? req.headers.get('referer'),
      }],
    },
  });

  // ⚠️ EL AVISO NO ES UN EXTRA: es lo que hace que la propuesta EXISTA para
  // alguien. La pantalla de revisión es /crm/revisar/<id> —por id, sin lista—, y
  // un formulario de landing no tiene canal de vuelta: quien lo completa ve la
  // página de gracias del cliente y el dueño no se entera de nada. Sin esto, la
  // propuesta queda en 'pendiente' para siempre. Medido el 14/08/2026 en el ws11:
  // OCHO leads reales, con nombre y teléfono, que nadie vio nunca.
  //
  // Solo si es NUEVA: un reintento del mismo formulario no puede volver a sonar.
  //
  // Y el LINK LO ARMA EL CÓDIGO, nunca el modelo. Por eso se pasa `texto` (que es
  // determinista) y no `contexto`: un id de 16 caracteres al azar transportado por
  // un LLM ya falló en este repo de las dos formas, y la silenciosa —un link que
  // resuelve a una propuesta REAL pero equivocada— es la peor.
  if (nueva) {
    const quien = nombre ?? email ?? telefono;
    const contacto = [telefono && `tel ${telefono}`, email].filter(Boolean).join(' · ');
    await runWithWorkspace(ws, () =>
      emitirDelCatalogo('lead-de-landing', {
        ws,
        texto: `*${quien}* dejó sus datos en tu landing${contacto ? ` — ${contacto}` : ''}. Todavía NO está en el CRM: lo confirmás vos, así revisás el dato antes de que valga. Abrilo acá 👉 ${APP_BASE_URL}/crm/revisar/${id}`,
        // Sin dedup por tiempo: cada persona que deja sus datos es un aviso
        // propio. Agrupar dos leads distintos en uno es perder el segundo.
      }),
    ).catch((e) => {
      // Un aviso caído NO puede tumbar la ingesta: el lead ya está guardado y eso
      // es el hecho. Lo que se pierde es la notificación, no la persona.
      console.error('[track:optin] el lead se guardó pero el aviso falló:', e instanceof Error ? e.message : e);
    });
  }

  console.log(`[track:optin] ws=${ws} propuesta=${id} ${nueva ? 'nueva' : 'ya existía'}`);
  return ok({ propuesta: id, nueva });
}
