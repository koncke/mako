// =============================================================================
// Webhook: Fathom → leads
// =============================================================================
// Endpoint público que recibe el webhook "new-meeting-content-ready" de Fathom.
// Seguridad: verifica la firma Svix con FATHOM_WEBHOOK_SECRET.
//
// Qué hace: matchea el invitado EXTERNO de la reunión (su email) con un lead,
// decide si fue R1 o R2 (por la fecha de la grabación contra fecha_junta_1/2) y
// marca la asistencia (solo si estaba sin marcar) + guarda el link de la
// grabación. Esto es el disparador "asistencia" del funnel: el lead avanza solo.
//
// Y desde el 16/10/2026 también le avisa al PLAN: dispara la lectura de esa reunión (la misma del
// cron de cada hora, lib/reunion-auto.ts) para que el borrador aparezca al terminar la junta.
// Desde el 26/10/2026 eso (el Plan, el CRM y el seguimiento) es lib/grabadores/al-terminar.ts, lo mismo para todos los
// grabadores que avisan; acá queda lo de Fathom: la firma Svix y de qué negocio es.
//
// Inerte hasta registrar la URL en Fathom (Settings → API → Add Webhook).
// =============================================================================

import type { NextRequest } from 'next/server';
import { verifyFathomSignature, FathomSignatureError, type FathomWebhookPayload } from '@/lib/fathom';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta, envCred } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { deFathom } from '@/lib/grabadores/reunion';
import { alTerminarReunion } from '@/lib/grabadores/al-terminar';

export const dynamic = 'force-dynamic';
// El follow-up post-llamada (Closing Analyst + redacción con Claude) corre en
// background con after(); necesita margen más allá de la respuesta al webhook.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const tStart = Date.now();
  const rawBody = await request.text();

  // ORDEN: parsear → resolver workspace → verificar firma CON EL SECRETO DE ESE
  // WORKSPACE. Antes se verificaba primero contra un secreto GLOBAL de process.env,
  // y eso tenía un efecto que nadie veía: cada cliente registra el webhook en SU
  // cuenta de Fathom y recibe SU propio `whsec_`, que jamás se leía. Su webhook
  // devolvía 401 el 100% de las veces mientras la UI se lo pintaba en verde.
  //
  // Parsear antes de verificar es seguro: el JSON sin firmar solo se usa para elegir
  // CONTRA QUÉ SECRETO validar. Un payload forjado sigue muriendo en la firma, porque
  // el secreto que se prueba es el del workspace que el propio payload nombra.

  // 1) Parsear (todavía sin confiar en el contenido)
  // El chequeo de objeto NO es de más: `JSON.parse('null')` no lanza, devuelve null, y
  // el optional chaining de abajo protege el segundo nivel pero no el primero
  // (`body.recorded_by` sobre null tira TypeError → 500 sin autenticar). Antes era
  // inalcanzable porque la firma mataba el request primero.
  let body: FathomWebhookPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as FathomWebhookPayload;
  } catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // 2) Resolver el workspace por el email de la cuenta que grabó (recorded_by).
  //    Fail-CLOSED: sin mapeo (webhook_routing), NO tocamos datos — nunca cae al
  //    dueño (evita matchear la grabación de un cliente contra leads ajenos).
  //
  //    ⚠️ «NO PUDE LEER» NO ES «NO ESTÁ MAPEADO» (07/10/2026, el molde es Calendly). Con
  //    `wsPorIdentificador`, que no lee el `error` de supabase-js, la base caída daba null y la
  //    grabación de un cliente caía en «sin workspace» → 200 y perdida. Fathom entrega por Svix,
  //    que reintenta durante días y DESHABILITA el endpoint si falla 5 días seguidos: por eso el
  //    fallo pasa por el clasificador —503 sólo si reintentar lo arregla— y queda anotado
  //    (lib/webhook-fallo-ruteo.ts). Con el tope de largo: esto corre antes de la firma.
  const hostEmail = body.recorded_by?.email && body.recorded_by.email.length <= 300 ? body.recorded_by.email : null;
  let ws: number | null;
  try {
    ws = await wsPorIdentificadorEstricto('fathom', hostEmail);
  } catch (err) {
    return responderFalloDeRuteo('fathom', err, hostEmail);
  }

  // 3) Verificar la firma con el secreto DE ESE workspace. Si el workspace no tiene
  //    el suyo cargado, se cae al de plataforma (compatibilidad: es lo que hacía
  //    antes para todos). Ese fallback es el que hay que ir vaciando: mientras se
  //    use, dos inquilinos comparten secreto.
  //
  //    Sin workspace se verifica igual, contra el de plataforma, y RECIÉN DESPUÉS se
  //    ignora. Parece redundante y no lo es: si acá se cortara antes de la firma, el
  //    código de respuesta delataría qué emails están dados de alta (200 = no está,
  //    401 = sí está) y cualquiera podría enumerar la cartera de clientes mandando
  //    payloads sin firmar. Verificando siempre, un request sin firma válida recibe
  //    401 sin importar a quién nombre.
  //
  //    El secreto se lee ESTRICTO por lo mismo: con `credWs`, una base caída daba null, se caía al
  //    de plataforma y la firma de un negocio con secreto propio daba 401 — un no-2xx que Svix
  //    cuenta, con un mensaje que culpa a la firma.
  let secretWs: string | null;
  try {
    secretWs = ws == null ? null : await credWsEstricta('FATHOM_WEBHOOK_SECRET', ws);
  } catch (err) {
    return responderFalloDeRuteo('fathom', err, hostEmail);
  }
  const secret = secretWs ?? (await envCred('FATHOM_WEBHOOK_SECRET'));
  if (ws != null && !secretWs) {
    console.warn(`[webhook:fathom] ws ${ws} sin FATHOM_WEBHOOK_SECRET propio — usando el de plataforma`);
  }
  try {
    verifyFathomSignature(
      rawBody,
      {
        id: request.headers.get('webhook-id'),
        timestamp: request.headers.get('webhook-timestamp'),
        signature: request.headers.get('webhook-signature'),
      },
      secret ?? '',
    );
  } catch (err) {
    if (err instanceof FathomSignatureError) {
      console.warn(`[webhook:fathom] firma rechazada (ws ${ws ?? '—'}): ${err.message}`);
      return Response.json({ ok: false, error: 'signature', message: err.message }, { status: 401 });
    }
    throw err;
  }

  // Firma válida pero sin ruteo: 200 para que Fathom no reintente eternamente algo
  // que nunca vamos a poder atribuir. Fail-CLOSED igual — no se toca un solo dato.
  if (ws == null) {
    console.warn(`[webhook:fathom] sin workspace para recorded_by=${hostEmail ?? '—'} — ignorado`);
    return Response.json({ ok: true, ignored: 'sin workspace' });
  }

  // 3') LO QUE PASA AL TERMINAR UNA REUNIÓN — el Plan la lee, el CRM la engancha al lead y sale el seguimiento — vive
  //     desde el 26/10/2026 en lib/grabadores/al-terminar.ts: es lo MISMO para todos los grabadores que avisan (tl;dv,
  //     Fireflies, Zoom, Read AI). Acá queda lo propio de Fathom: la firma Svix y el ruteo por quien grabó.
  //
  //     Lo que se escribió acá y sigue valiendo allá:
  //     · EL PLAN SE ENTERA AL TERMINAR LA REUNIÓN (16/10/2026, «Fathom sin fricción»): la MISMA lectura del cron
  //       (`procesarReunionesNuevas`), acotada a esta grabación, ANTES de matchear el lead y por su cuenta (una reunión de
  //       EQUIPO no tiene invitado externo ni lead), en `after()` (Svix reintenta si la respuesta tarda) y con la misma
  //       vara que el cron (`wsEnLaRonda`: activo y con un grabador conectado).
  //     · ⚠️ UNA SESIÓN DE ENTREGA NO ES UNA R2 (06/10/2026). Este era el ÚNICO escritor de las «Reunión 2» de más: el
  //       fallback «R1 ya resuelta → es la R2» le ponía esa etiqueta a CADA reunión de un cliente que ya había tenido su
  //       R2 — 45 links en 6 clientes del ws1, todos posteriores al cierre. La guarda va ANTES de escribir nada.
  //     · ⚠️ EL `ws` VA EXPLÍCITO a `dispararEvento` (06/10/2026): sin él, la grabación de un cliente corría los flujos
  //       del ws1 —Mauricio, otro cliente— en SU grupo de MaKo. `ws` es el que resolvió `recorded_by`, el de abajo.
  //     · ⚠️ EL AVISO AL DUEÑO VA ADENTRO DEL `after()`, DESPUÉS del análisis, y sale SIEMPRE aunque el análisis falle.
  //     · La asistencia sólo se AFIRMA cuando la transcripción la prueba (lib/fathom.ts, `inviteeSpoke`; en la capa
  //       común, `invitadoHablo`): leer «no matcheó» como «no vino» mandó a No Show una R1 de 64 minutos.
  try {
    const res = await alTerminarReunion(ws, deFathom(body), { hasta: tStart + 280_000, log: '[webhook:fathom]' });
    return Response.json({ ...res, ms: Date.now() - tStart });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook:fathom] error procesando: ${message}`);
    return Response.json({ ok: false, error: 'processing', message }, { status: 500 });
  }
}

// Healthcheck por GET.
export async function GET() {
  return Response.json({ ok: true, endpoint: 'fathom webhook', usage: 'POST con headers webhook-id/webhook-timestamp/webhook-signature' });
}
