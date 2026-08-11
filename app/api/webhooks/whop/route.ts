// =============================================================================
// Webhook: Whop → el avance del cliente en el programa
// =============================================================================
// Whop avisa acá apenas un cliente termina una clase
// (`course_lesson_interaction.completed`). Es lo que hace que el bucle sea del
// mismo día: sin esto el avance llega en la pasada del cron y ya no sirve para
// recordarle a alguien que se quedó, ni para armarle a Mauricio el resumen antes
// de la llamada.
//
// LO QUE ACÁ NO LLEGA, Y ES A PROPÓSITO: las respuestas de la tarea. La API de
// Whop no tiene endpoint para leerlas (ver el comentario de lib/whop.ts). De acá
// sale QUIÉN completó QUÉ clase, nada más.
//
// SEGURIDAD. `/api/webhooks` está en `lib/rutas-publicas.ts`, y su matcheo es por
// prefijo, así que esta ruta es pública desde que el archivo existe — sin que
// nadie la agregue a ninguna lista. El middleware hace early-return ANTES del
// gate de login y ANTES del chequeo CSRF de Origin: la firma es lo único que
// protege esto, y por eso es fail-closed desde la primera línea.
//
// ⚠️ Y en local no se ve: sin `AUTH_SECRET` el middleware es no-op, así que una
// ruta mal listada anda perfecto contra localhost y falla solo en producción.
// =============================================================================

import { type NextRequest } from 'next/server';
import { verificarFirmaSvix, headersSvix, MOTIVO_FIRMA } from '@/lib/standard-webhooks';
import { wsDeCompany } from '@/lib/whop';
import { leccionDelEvento, emailDelEvento, companyDelEvento, tipoDelEvento, type EventoWhop } from '@/lib/whop-evento';
import { credWs, envCred } from '@/lib/credenciales';
import { runWithWorkspace } from '@/lib/workspace';
import { registrarAvanceDeClase } from '@/lib/cs-avance';

export const dynamic = 'force-dynamic';

/** El único evento que hace falta. Los demás se contestan 200 y se ignoran: un
 *  4xx haría que Whop reintente para siempre algo que nunca vamos a procesar. */
const EVENTO = 'course_lesson_interaction.completed';

export async function POST(request: NextRequest) {
  // 1) El cuerpo CRUDO, primero. Un `request.json()` acá consume el stream y
  //    después no hay texto exacto para el HMAC — y la firma falla siempre.
  const crudo = await request.text();

  // 2) Parsear sin confiar todavía: solo sirve para saber CONTRA QUÉ SECRETO
  //    validar. Un payload forjado igual muere en la firma, porque el secreto
  //    que se prueba es el del workspace que el propio payload nombra.
  //    El chequeo de objeto no es de más: `JSON.parse('null')` no lanza.
  let evento: EventoWhop;
  try {
    const parsed: unknown = JSON.parse(crudo);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    evento = parsed as EventoWhop;
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  // 3) De quién es. Fail-CLOSED: sin mapeo no se toca un dato. Entregarle a ws1
  //    el avance de otro sería escribirle progreso falso a un cliente.
  const companyId = companyDelEvento(evento);
  const ws = await wsDeCompany(companyId);

  // 4) La firma, con el secreto DE ESE workspace. Cada cliente registra el
  //    webhook en SU cuenta de Whop y recibe SU propio `whsec_`.
  //
  //    Se verifica IGUAL cuando no hay workspace, y recién después se ignora.
  //    Parece redundante y no lo es: cortando antes, el código de respuesta
  //    delataría qué cuentas están dadas de alta (200 = no, 401 = sí), y
  //    cualquiera podría enumerar la cartera mandando payloads sin firmar.
  const secretoWs = ws == null ? null : await credWs('WHOP_WEBHOOK_SECRET', ws);
  const secreto = secretoWs ?? (await envCred('WHOP_WEBHOOK_SECRET'));
  const fallo = verificarFirmaSvix(crudo, headersSvix(request), secreto);
  if (fallo) {
    console.warn(`[webhook:whop] firma rechazada (${fallo}) company=${companyId ?? '—'}`);
    return Response.json({ ok: false, error: MOTIVO_FIRMA[fallo] }, { status: 401 });
  }

  if (ws == null) {
    // 200 y no 4xx: el evento llegó bien y está firmado; lo que falta es de
    // nuestro lado. Un error haría que Whop reintente para siempre.
    console.warn(`[webhook:whop] sin workspace para company=${companyId ?? '—'} — se descarta`);
    return Response.json({ ok: true, ignored: 'sin workspace' });
  }

  const tipo = tipoDelEvento(evento);
  if (tipo !== EVENTO) return Response.json({ ok: true, ignored: `evento ${tipo || 'sin nombre'}` });

  const leccionId = leccionDelEvento(evento);
  if (!leccionId) {
    // Devolver null en vez de inventar un id: marcar completado el bloque
    // equivocado es peor que no marcar nada.
    console.warn('[webhook:whop] evento sin id de lección reconocible');
    return Response.json({ ok: true, ignored: 'sin id de lección' });
  }


  // 5) TODO lo que escribe va adentro de runWithWorkspace: sin sesión,
  //    getWorkspaceActual() cae al dueño, y getTenantDb() estampa el
  //    workspace_id solo si el contexto está puesto.
  try {
    const r = await runWithWorkspace(ws, () => registrarAvanceDeClase({ ws, leccionId, email: emailDelEvento(evento) }));
    // 200 aunque no se haya podido atribuir: el evento llegó bien y firmado, lo
    // que falta es de nuestro lado. El motivo va en el cuerpo y en el log para
    // que se pueda ver, en vez de descartarse en silencio.
    if (!r.ok) console.warn(`[webhook:whop] avance sin atribuir (${r.motivo}) leccion=${leccionId}`);
    return Response.json(r.ok ? { ok: true, clase: r.claseId, lead: r.leadId } : { ok: true, ignored: r.motivo });
  } catch (e) {
    console.error('[webhook:whop] falló al registrar el avance:', e);
    // 500 a propósito: acá SÍ queremos el reintento de Whop.
    return Response.json({ ok: false, error: 'no se pudo registrar' }, { status: 500 });
  }
}

/** Healthcheck: pegarle con GET dice si la ruta existe y por dónde entra. Y si
 *  contesta «no autenticado», el que respondió fue el middleware y la ruta ni
 *  corrió (AGENTS.md → la tabla de la pista). */
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: 'whop webhook',
    evento: EVENTO,
    usage: 'POST con headers webhook-id / webhook-timestamp / webhook-signature',
  });
}
