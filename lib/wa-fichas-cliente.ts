// =============================================================================
// Pedirle a la extensión de MaKo las fichas de SU WhatsApp Web (24/10/2026) — lado de la página
// =============================================================================
// Martín: «lo que yo te pido es con la extensión de MaKo... que se extraiga los nombres y la información pública». La
// extensión (extension/wa-fichas.js) lee lo que el WhatsApp Web de la persona ya guardó en su navegador, sin clics ni red. Esto
// es el pedido desde la página de MaKo: un evento con los teléfonos (sólo los de leads que ya están en su CRM), y la respuesta
// por evento con el mismo `id` (extension/mako-puente.js hace de mensajero). Sin `server-only`: lo usa un client component.
//
// ⚠️ DESDE LA 0.71.0 (25/10/2026), Martín: «La extensión no contestó... no hay ninguna acción que el usuario vea para saber que
// está corriendo bien». El worker abre WhatsApp Web si no está, lo despierta, le pone el script y espera a que cargue, y cuenta
// cada paso (`MAKO_WA_FICHAS_AVANCE`): por eso esto ya no corta a los 20 s fijos, sino cuando pasan 30 s SIN noticias.

import { esMasVieja } from './version-comparar';

/**
 * La versión de la extensión que pide la pantalla para leer fichas. La 0.71.0 (25/10/2026) lee el nombre donde WhatsApp Web lo
 * guarda para un `@lid` (`displayNameLID`: en el WhatsApp de Martín, 6.252 nombres contra 786 en los campos de antes), busca por
 * `@lid` y por grupo, y abre WhatsApp Web sola. Con la 0.70 se completaba una fracción: se pide actualizarla.
 */
export const VERSION_FICHAS = '0.71.0';

/** ¿La extensión de ESTE navegador lee fichas? 'no' = no está; 'vieja' = está, sin esto (hay que actualizarla). */
export function extensionLeeFichas(): 'si' | 'vieja' | 'no' {
  if (typeof document === 'undefined') return 'no';
  const v = document.documentElement.getAttribute('data-mako-puente');
  if (!v) return 'no';
  return esMasVieja(v, VERSION_FICHAS) ? 'vieja' : 'si';
}

export type DiagnosticoFichas = { base: boolean; stores?: string[]; contactos?: number; grupos?: number; participantes?: number; pedidos?: number; conFicha?: number };
/** Un grupo que MaKo nombró, buscado en el WhatsApp Web de la persona: si está y cuántos son (nunca quiénes). */
export type GrupoEnWhatsapp = { nombre: string; encontrado: boolean; participantes: number | null; conNombre: number | null };
export type RespuestaFichas =
  | { ok: true; fichas: unknown[]; grupos: GrupoEnWhatsapp[]; diagnostico: DiagnosticoFichas | null }
  | { ok: false; motivo: string; error?: string };

/** Un teléfono, o un teléfono con el `@lid` del lead (con él se encuentra al que WhatsApp Web no tiene por su teléfono). */
export type PedidoFichaWa = string | { telefono: string; lid: string | null };

/** Sin noticias de la extensión por este tiempo, se da por muda (cada paso que cuenta el worker lo vuelve a contar). */
export const SILENCIO_FICHAS_MS = 30_000;
/** El tope total: abrir WhatsApp Web y esperar sus chats lleva hasta ~2 min en el peor caso del worker. */
export const TOPE_FICHAS_MS = 4 * 60_000;
/** Un «no encontré la extensión» se espera este rato antes de creerle: puede ser el puente huérfano de una versión vieja. */
const GRACIA_EXTENSION_MS = 1500;

/**
 * Le pide a la extensión las fichas de esos teléfonos. Nunca tira. `alAvanzar` recibe cada paso que cuenta el worker
 * («Abriendo WhatsApp Web…», «Buscando el grupo «X»…»); `grupos`, los nombres de los grupos de donde vinieron los leads.
 */
export function pedirFichasDeWhatsappWeb(
  pedidos: readonly PedidoFichaWa[],
  o: { grupos?: readonly string[]; alAvanzar?: (texto: string, paso: string) => void; silencioMs?: number } = {},
): Promise<RespuestaFichas> {
  return new Promise((resolve) => {
    const id = `w${Date.now()}${Math.random()}`;
    const silencio = o.silencioMs ?? SILENCIO_FICHAS_MS;
    let terminado = false;
    let gracia: ReturnType<typeof setTimeout> | null = null;
    const fin = (r: RespuestaFichas) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(mudo); clearTimeout(total); if (gracia) clearTimeout(gracia);
      window.removeEventListener('MAKO_WA_FICHAS', al);
      window.removeEventListener('MAKO_WA_FICHAS_AVANCE', avance);
      resolve(r);
    };
    let mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
    const total = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), TOPE_FICHAS_MS);
    const avance = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== id || terminado) return;
      // Una extensión viva contó algo: el «no encontré la extensión» que haya llegado era del puente huérfano.
      if (gracia) { clearTimeout(gracia); gracia = null; }
      clearTimeout(mudo);
      mudo = setTimeout(() => fin({ ok: false, motivo: 'sin_respuesta' }), silencio);
      if (typeof d.texto === 'string') o.alAvanzar?.(d.texto, typeof d.paso === 'string' ? d.paso : '');
    };
    const al = (ev: Event) => {
      const d = ((ev as CustomEvent).detail ?? {}) as Record<string, unknown>;
      if (d.id !== id || terminado) return;
      const r: RespuestaFichas = d.ok === true
        ? { ok: true, fichas: Array.isArray(d.fichas) ? d.fichas : [], grupos: gruposDe(d.grupos), diagnostico: (d.diagnostico as DiagnosticoFichas) ?? null }
        : { ok: false, motivo: typeof d.motivo === 'string' ? d.motivo : 'error', ...(typeof d.error === 'string' ? { error: d.error } : {}) };
      if (!r.ok && r.motivo === 'extension') {
        if (!gracia) gracia = setTimeout(() => fin(r), GRACIA_EXTENSION_MS);
        return;
      }
      fin(r);
    };
    window.addEventListener('MAKO_WA_FICHAS', al);
    window.addEventListener('MAKO_WA_FICHAS_AVANCE', avance);
    const telefonos = pedidos.map((p) => (typeof p === 'string' ? p : p.telefono));
    const conLid = pedidos.map((p) => (typeof p === 'string' ? { telefono: p, lid: null } : p));
    window.dispatchEvent(new CustomEvent('MAKO_WA_FICHAS_PIDO', { detail: { id, telefonos, pedidos: conLid, grupos: [...(o.grupos ?? [])] } }));
  });
}

/** Los grupos que contestó la extensión, leídos como texto ajeno. */
function gruposDe(v: unknown): GrupoEnWhatsapp[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((g) => {
    const o = (g ?? {}) as Record<string, unknown>;
    if (typeof o.nombre !== 'string') return [];
    return [{
      nombre: o.nombre.slice(0, 120), encontrado: o.encontrado === true, participantes: typeof o.participantes === 'number' ? o.participantes : null,
      conNombre: typeof o.conNombre === 'number' ? o.conNombre : null,
    }];
  });
}

/** «Ir a WhatsApp Web»: la extensión pone esa pestaña al frente, o abre una (para iniciar la sesión). */
export function enfocarWhatsappWeb(): void {
  window.dispatchEvent(new CustomEvent('MAKO_WA_ENFOCAR'));
}

/** Qué hacer, dicho, para cada motivo de la extensión. */
export function motivoDeFichas(motivo: string): string {
  switch (motivo) {
    case 'sin_whatsapp_web': return 'Abre WhatsApp Web en otra pestaña de este navegador y vuelve a tocar.';
    case 'recargar_whatsapp_web': return 'Recarga la pestaña de WhatsApp Web (la extensión se actualizó) y vuelve a tocar.';
    case 'sin_base': return 'WhatsApp Web todavía no terminó de cargar tus chats: espera un momento y vuelve a tocar.';
    case 'sin_sesion': return 'Inicia sesión en WhatsApp Web (te la abrí en otra pestaña) y vuelve a tocar.';
    case 'sin_respuesta_wa': return 'WhatsApp Web no contestó. Recarga esa pestaña y vuelve a tocar.';
    case 'extension': return 'No encontré la extensión de MaKo en este navegador.';
    case 'sin_respuesta': return 'La extensión no contestó. Recarga esta página y vuelve a tocar.';
    default: return 'No pude leer tu WhatsApp Web.';
  }
}

/** ¿El motivo se arregla en la pestaña de WhatsApp Web? (La pantalla ofrece «Ir a WhatsApp Web».) */
export const motivoEnWhatsapp = (motivo: string): boolean => motivo === 'sin_sesion' || motivo === 'sin_respuesta_wa' || motivo === 'sin_whatsapp_web';
