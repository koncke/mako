// =============================================================================
// mako-salida-drivers — CÓMO sale un mensaje del bot: Evolution hoy, la API oficial mañana
// =============================================================================
// Una sola forma (`SalidaWhatsApp`) y un archivo por cañería. Cambiar a la API oficial es `mako.bot.salida` = `cloud` y cargar la credencial: el bot no se entera.
// Lo de cuándo se puede escribir NO vive acá: lo mira la puerta (lib/mako-salida.ts), para que una cañería nueva no nazca sin la ventana de 24 horas.
//
// ⚠️ La de la API oficial NO SE PROBÓ CONTRA META: no hay un número dado de alta. El test mira el pedido contra lo documentado. Falta también la ENTRADA por esa vía (su webhook y
// bajar los audios por su API): docs/hallazgos-comunicacion.md, «El bot 1 a 1».
//
// PURO y sin `server-only`: el fetch se inyecta (tests/mako-salida.test.ts).
// =============================================================================

import { pausaDeEscritura } from './mako-salida-reglas';

export type EnvioChat = { ok: true; id: string } | { ok: false; error: string; fueraDeVentana?: true };

export type SalidaWhatsApp = {
  nombre: 'evolution' | 'cloud';
  enviarTexto: (jid: string, texto: string, delayMs?: number) => Promise<EnvioChat>;
  reaccionar: (jid: string, mensajeId: string, emoji: string) => Promise<boolean>;
  /** Best-effort: mostrar «escribiendo…». La API oficial lo ata a un mensaje recibido: sin su id, no hace nada. */
  escribiendo: (jid: string, ms: number) => Promise<void>;
};

type Fetch = typeof fetch;
const TIMEOUT_MS = 30_000;

/** El número del jid: la API oficial sólo entiende dígitos, y un `@lid` no es un número. */
export function digitosDelJid(jid: string): string | null {
  return /^(\d{8,15})(?::\d+)?@(?:s\.whatsapp\.net|c\.us)$/.exec(jid.trim())?.[1] ?? null;
}

/** La demora «escribiendo» de la vía no oficial: la regla de la casa (lib/mako-salida-reglas.ts), proporcional al texto y con variación. */
export const demoraDeTexto = (texto: string): number => pausaDeEscritura(texto.length);

/**
 * `observar`: lo que contestó Evolution a cada escritura, para el freno de la línea (lib/linea-freno.ts). Se inyecta: este archivo es
 * puro, y la puerta (lib/mako-salida.ts) es la que lo enchufa.
 */
export function salidaEvolution(o: { base: string; clave: string; instancia: string; fetch?: Fetch; observar?: (ruta: string, status: number, cuerpo: unknown) => Promise<unknown> }): SalidaWhatsApp {
  const f = o.fetch ?? fetch;
  const base = o.base.replace(/\/$/, '');
  const pedir = async (ruta: string, cuerpo: unknown) => {
    const r = await f(`${base}${ruta}/${encodeURIComponent(o.instancia)}`, {
      method: 'POST', headers: { apikey: o.clave, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const texto = await r.text();
    let json: unknown = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { /* sigue con el texto */ }
    if (!r.ok && o.observar) await o.observar(`${ruta}/${encodeURIComponent(o.instancia)}`, r.status, json ?? texto).catch(() => null);
    return { ok: r.ok, status: r.status, json, texto };
  };
  return {
    nombre: 'evolution',
    enviarTexto: async (jid, texto, delayMs) => {
      try {
        const r = await pedir('/message/sendText', { number: jid, text: texto, delay: delayMs ?? demoraDeTexto(texto) });
        if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${r.texto.slice(0, 200)}` };
        return { ok: true, id: (r.json as { key?: { id?: string } } | null)?.key?.id ?? '' };
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    },
    reaccionar: async (jid, mensajeId, emoji) => {
      try { return (await pedir('/message/sendReaction', { key: { remoteJid: jid, fromMe: false, id: mensajeId }, reaction: emoji })).ok; } catch { return false; }
    },
    escribiendo: async (jid, ms) => {
      try { await pedir('/chat/sendPresence', { number: jid, delay: ms, presence: 'composing' }); } catch { /* best-effort */ }
    },
  };
}

/** 131047 es «pasaron más de 24 horas»: Meta tampoco deja escribir, y se dice con el mismo nombre que la puerta. */
const FUERA_DE_VENTANA_META = 131047;

export function salidaCloud(o: { phoneNumberId: string; token: string; version?: string; fetch?: Fetch }): SalidaWhatsApp {
  const f = o.fetch ?? fetch;
  const url = `https://graph.facebook.com/${o.version ?? 'v21.0'}/${encodeURIComponent(o.phoneNumberId)}/messages`;
  const pedir = async (cuerpo: Record<string, unknown>) => {
    const r = await f(url, {
      method: 'POST', headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...cuerpo }), cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = await r.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string } } | null;
    return { ok: r.ok, status: r.status, json };
  };
  return {
    nombre: 'cloud',
    enviarTexto: async (jid, texto) => {
      const to = digitosDelJid(jid);
      if (!to) return { ok: false, error: `la API oficial no puede escribirle a ${jid}: no es un número` };
      try {
        const r = await pedir({ recipient_type: 'individual', to, type: 'text', text: { body: texto, preview_url: true } });
        if (!r.ok) {
          const codigo = r.json?.error?.code;
          return { ok: false, error: `Meta ${r.status}: ${r.json?.error?.message ?? 'sin detalle'}`, ...(codigo === FUERA_DE_VENTANA_META ? { fueraDeVentana: true as const } : {}) };
        }
        return { ok: true, id: r.json?.messages?.[0]?.id ?? '' };
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    },
    reaccionar: async (jid, mensajeId, emoji) => {
      const to = digitosDelJid(jid);
      if (!to) return false;
      try { return (await pedir({ recipient_type: 'individual', to, type: 'reaction', reaction: { message_id: mensajeId, emoji } })).ok; } catch { return false; }
    },
    escribiendo: async () => { /* sin el id del mensaje recibido no hay indicador: no se inventa. */ },
  };
}
