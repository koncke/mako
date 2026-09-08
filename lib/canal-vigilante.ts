// =============================================================================
// canal-vigilante — que la VOZ de MaKo no se muera en silencio
// =============================================================================
// EL CASO (2026-09-08). Martín: «MaKo en WhatsApp NO está funcionando». Medido:
//
//   · `mako_doer_conv`, últimas 48 h ................. 0 mensajes
//   · último mensaje entrante de cualquier cliente .... 2026-09-02
//   · `connectionState mako_superadmin` .............. "state": "open"
//   · cualquier operación REAL sobre ese socket ...... HTTP 428, Connection Closed
//
// La línea de voz de MaKo llevaba **seis días muerta** informando «open». No
// entraba nada y —peor— tampoco SALÍA nada: los avisos que los crons generaron
// esos días se escribieron, se pagó la IA que los redactó, y nunca llegaron.
// Mauricio y el cliente de Codigo Inmobiliario le escribieron a una pared.
//
// ── LO QUE NO FALTABA ───────────────────────────────────────────────────────
//
// La DETECCIÓN ya existía y era correcta. `socketVivo()` (lib/evolution.ts) hace
// una lectura que de verdad habla con WhatsApp, y `estadoCanalMaKo()` la usa con
// este comentario al lado, escrito el 16/08:
//
//   «"open" es la fila en la base de Evolution, no la sesión. Sin esta
//    confirmación el panel dice "conectado" con el socket muerto.»
//
// Sabíamos exactamente esto. Lo que faltaba es que alguien MIRARA:
// `estadoCanalMaKo()` tenía UN consumidor, la ruta del panel `/agencia`. Un
// estado correcto que solo se calcula cuando alguien abre una pantalla no es un
// control — es un dato disponible. Es la regla de AGENTS.md, otra vez: si el que
// se tiene que enterar es el dueño, el aviso va donde él mira, y nadie mira un
// panel que no tiene por qué abrir.
//
// ⚠️ Y LA PARTE QUE HACE ESTO DISTINTO A CUALQUIER OTRA ALARMA:
// **el aviso NO PUEDE VIAJAR POR EL CANAL QUE SE ROMPIÓ.** Mandar por WhatsApp
// «tu WhatsApp está caído» es no mandar nada. Por eso esto avisa por EMAIL, que
// es el único camino que no depende de lo que está fallando. Vale como regla
// general: la alarma de un canal sale por otro canal.
// =============================================================================

import 'server-only';
import { socketVivo } from './evolution';
import { instanciaVoz } from './mako-grupo';
import { getSetting, setSetting } from './settings';
import { runWithWorkspace, wsSuperAdmin, OWNER_WS } from './workspace';
import { sendEmail } from './resend';
import { APP_BASE_URL } from './app-url';

const KEY_ULTIMO_AVISO = 'mako.canal.caido.avisado';
/** Cada cuánto se repite el aviso mientras siga caído. */
const CADA_MIN = 60;

export type EstadoVoz = { instancia: string; viva: boolean };

/**
 * ¿La voz de MaKo puede hablar AHORA?
 *
 * ⚠️ No mira `connectionState`. Ese campo mintió en LAS DOS DIRECCIONES el
 * 8/9/2026, medido sobre las cuatro instancias del servidor:
 *
 *     mako_superadmin   state=open    operación real → 428 Connection Closed
 *     mako_ws1          state=close   operación real → funciona
 *     mako_ws13         state=close   operación real → funciona
 *
 * O sea que `open` no prueba que ande y `close` no prueba que no. La única
 * pregunta que se puede contestar es la que se hace HABLANDO con WhatsApp.
 */
export async function vozViva(): Promise<EstadoVoz> {
  const instancia = await instanciaVoz();
  return { instancia, viva: await socketVivo(instancia).catch(() => false) };
}

/**
 * Revisa la voz y, si está caída, avisa POR EMAIL. Devuelve qué hizo.
 *
 * Idempotente por hora: mientras siga caída repite cada `CADA_MIN` — es una
 * hemorragia, no una noticia (mismo criterio que `lib/alerta-critica.ts`), pero
 * sin llenar la casilla. Al recuperarse limpia la marca y avisa que volvió: una
 * alarma que no sabe decir «ya está» obliga a adivinar si se arregló o si se
 * rompió el aviso.
 */
export async function vigilarVozMaKo(): Promise<{ viva: boolean; aviso: 'ninguno' | 'caida' | 'recuperada' }> {
  const { instancia, viva } = await vozViva();
  const ws = await wsSuperAdmin().catch(() => OWNER_WS);
  const marca = await runWithWorkspace(ws, () => getSetting(KEY_ULTIMO_AVISO)).catch(() => null);

  if (viva) {
    if (!marca) return { viva: true, aviso: 'ninguno' };
    await runWithWorkspace(ws, () => setSetting(KEY_ULTIMO_AVISO, '')).catch(() => {});
    await avisarPorEmail(
      'MaKo volvió a WhatsApp',
      `La línea de voz (${instancia}) volvió a responder. MaKo ya puede recibir y mandar mensajes.`,
    ).catch(() => {});
    return { viva: true, aviso: 'recuperada' };
  }

  const desde = marca ? Date.parse(marca) : NaN;
  if (!Number.isNaN(desde) && Date.now() - desde < CADA_MIN * 60_000) {
    return { viva: false, aviso: 'ninguno' };
  }
  await runWithWorkspace(ws, () => setSetting(KEY_ULTIMO_AVISO, new Date().toISOString())).catch(() => {});
  await avisarPorEmail(
    '🚨 MaKo no puede hablar por WhatsApp',
    [
      `La línea de voz de MaKo (${instancia}) dice estar conectada pero su sesión está CAÍDA:`,
      'no entra ni sale un solo mensaje, y los avisos que MaKo genere se pierden.',
      '',
      'Se arregla volviendo a vincular el número (escanear el QR):',
      `${APP_BASE_URL}/agencia`,
      '',
      'Mientras tanto, ningún cliente puede escribirle a MaKo ni recibir sus avisos.',
    ].join('\n'),
  ).catch(() => {});
  return { viva: false, aviso: 'caida' };
}

/**
 * ⚠️ POR EMAIL, NUNCA POR WHATSAPP. Es lo que hace que este aviso exista: mandar
 * «tu WhatsApp está caído» por WhatsApp es no mandar nada.
 */
async function avisarPorEmail(asunto: string, cuerpo: string): Promise<void> {
  const ws = await wsSuperAdmin().catch(() => OWNER_WS);
  const { getDestinatariosDe } = await import('./notif-destinatarios');
  const dest = await getDestinatariosDe(ws).catch(() => null);
  const para = dest?.emails ?? [];
  if (!para.length) {
    console.error('[canal-vigilante] la voz está caída y NO hay email de destino para avisar');
    return;
  }
  await sendEmail({
    to: para,
    subject: asunto,
    text: cuerpo,
    html: `<pre style="font:14px/1.6 system-ui,sans-serif;white-space:pre-wrap">${cuerpo
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
  });
}
