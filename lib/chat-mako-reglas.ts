// =============================================================================
// La pieza única de chat con MaKo — las reglas, sin React y sin server (16/10/2026)
// =============================================================================
// Etapa 2 de docs/diseno-mako-ai-native.md: todos los chats con MaKo con la cara del Centro de Operaciones. Martín,
// por el coordinador: «Termina con todo, faltan mis pedidos del Second Brain». Esta es la primera tanda: el Second
// Brain (/second-brain) pasa a ser el chat con MaKo, con su barra de chats a la izquierda.
//
// EL JEFE «SECOND BRAIN» SON LAS SESIONES DEL TELÉFONO (`mako-movil:u<id>`, lib/mako-turno-app-reglas.ts →
// chartKeyDePersona): las mismas conversaciones que la persona ya tiene en /m/mako, sin migrar nada. La más VIEJA es el
// jefe; las demás son sus sub-chats («Second Brain › <título>»), como los hilos de un canal de Discord.
// ⚠️ La más vieja y no la más reciente: con la más reciente el jefe cambiaba de fila cada vez que se escribía en otro.
//
// SIN imports de valores: lo usan la pantalla ('use client') y los tests.

import type { MensajeChat, SesionChat } from './mako-turno-app-reglas';
import { asesorPorId, type IdAsesor } from './asesores/catalogo';
import type { MensajeChatMako } from './automatizacion-chat';

/** El nombre del jefe del chat con MaKo: «Cerebro», con la estrella de MaKo (lib/centro-munecos.ts → esCriaturaDeMako), como el
 *  del Ops Center del super admin (21/10/2026, Martín: «El chat principal, al igual que SuperAdmin, debe ser "Cerebro" y tener la
 *  criatura de MaKo»). Hasta ese día era «Second Brain», con la gota. El nombre de la constante quedó de antes. */
export const JEFE_SECOND_BRAIN = 'Cerebro';
/** Lo que se LEE en la fila y en la cabecera (1/11/2026, Martín: «el chat principal de Ops Center, que ya no se llama cerebro»).
 *  `JEFE_SECOND_BRAIN` sigue siendo de qué nombre sale la estrella (lib/centro-munecos.ts → esCriaturaDeMako). */
export const NOMBRE_JEFE = 'Ops Center';
/** El título de una conversación que todavía no tiene: el modelo se lo pone después del primer turno. */
export const SIN_TITULO = 'Chat nuevo';

export type ArbolDelJefe = {
  /** La conversación que ES el jefe (la más vieja); null = la persona todavía no tiene ninguna. */
  jefe: SesionChat | null;
  /** Las demás, la que se movió último arriba (como la barra de Claude y ChatGPT). */
  subs: SesionChat[];
};

/** El jefe y sus sub-chats. Los ids son correlativos: el más chico es el más viejo, y no cambia al escribir. */
export function arbolDelJefe(sesiones: readonly SesionChat[]): ArbolDelJefe {
  if (!sesiones.length) return { jefe: null, subs: [] };
  const jefe = sesiones.reduce((a, b) => (b.id < a.id ? b : a));
  const subs = sesiones.filter((s) => s.id !== jefe.id)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id - a.id);
  return { jefe, subs };
}

/** El título que se dibuja de un sub-chat (el del jefe es siempre «Cerebro»). */
export const tituloDe = (s: Pick<SesionChat, 'titulo'>): string => s.titulo?.trim() || SIN_TITULO;

/** El nombre completo de un sub-chat, con la convención del jefe («Cerebro › Precios»). */
export const nombreDeSub = (s: Pick<SesionChat, 'titulo'>): string => `${NOMBRE_JEFE} › ${tituloDe(s)}`;

/** La búsqueda de la barra: sin mayúsculas ni tildes. El jefe se ve siempre (es la casa). */
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export function filtrarSubs(subs: readonly SesionChat[], busca: string): SesionChat[] {
  const b = normal(busca);
  return b ? subs.filter((s) => normal(tituloDe(s)).includes(b)) : [...subs];
}

/** La edad de una fila, corta como en Codex: «ahora», «12 min», «3 h», «2 d». */
export function edadCorta(t: number | null, ahora: number): string {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
}

/** Cuántos sub-chats se ven antes de «Mostrar N más» (los de la barra del Centro son 14). */
export const SUBS_VISIBLES = 12;

/**
 * Lo que el turno sabe de DÓNDE está la persona (va al final del system y manda sobre la voz del teléfono:
 * lib/mako-turno-app.ts → `contexto`). Sin esto, MaKo contesta en la computadora como si fuera el celular: «2-5 líneas».
 */
// El nombre que el negocio ve es «Ops Center» (18/10/2026): MaKo lo nombra así. La constante y la ruta siguen siendo «second brain».
export const CONTEXTO_SECOND_BRAIN = `EN ESTE CHAT (el Ops Center de MaKo, en la COMPUTADORA), y esto manda sobre la voz del teléfono: la persona está en su escritorio, con la pantalla entera. Responde completo pero sin relleno: puedes usar listas cortas y negritas cuando ordenan, nunca tablas largas ni JSON. Es el chat central del negocio: si lo que pide se hace en otra pantalla de MaKo, dilo y nombra la pantalla.`;

/**
 * De quién es un chat del Second Brain: la base `mako-movil:<persona>` de su clave. Un sub-chat de otra tab lleva un
 * sufijo (`mako-movil:u5:crm:12`), y su persona es la misma. null = no es un chat del Second Brain.
 */
export function baseDeLaPersona(chartKey: string | null | undefined): string | null {
  const m = /^mako-movil:[^:]+/.exec(String(chartKey ?? ''));
  return m ? m[0] : null;
}

/** La conversación de un turno de la app: su clave de canal es `app:<id>` (lib/mako-turno-app-reglas.ts). */
export function sesionDelCanal(canalKey: string | null | undefined): number | null {
  const m = /^app:(\d+)$/.exec(String(canalKey ?? ''));
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** El título de un chat de antes (de /mako): el suyo, o de qué era. */
export const SECCION_ANTES = 'Antes';
/** Las conversaciones de Offer en el Ops Center (20/10/2026): se leen acá y se siguen en su tab. */
export const SECCION_OFFER = 'Offer';
export const AVISO_OFFER = 'Esta conversación sigue en Offer.';
export const AVISO_ANTES = 'Este chat es de antes. Sigue en uno nuevo.';

/** Las preguntas de arranque, con el hilo vacío: lo que más se le pide al chat central. */
export const ARRANQUES_SECOND_BRAIN = ['¿Qué hago hoy?', '¿Cómo viene el mes?', '¿Qué sabes de mi negocio?'] as const;

// ── «Entender el pedido» en el Second Brain (tanda 10, 16/10/2026) ───────────────────────────────────────────────

/** Un link a la pantalla donde se hace algo que la persona pidió (`otra-tab` de /api/mako/pedidos). */
export type IrA = { titulo: string; link: string };
/** Como mucho, los links debajo de una respuesta. */
const MAX_IR_A = 3;

/**
 * Los links que el Second Brain deja debajo de la respuesta de MaKo: los pedidos de OTRA tab que entendió
 * /api/mako/pedidos (docs/diseno-mako-pedidos.md, «El punto de enganche»).
 *
 * ⚠️ EN EL SECOND BRAIN NO SE PARTE EL MENSAJE. En un editor, lo de otra tab se saca del mensaje y queda sólo el link;
 *    acá no hay nada abierto, así que TODO lo que nombra un área sería «otra tab», y el chat central dejaría de
 *    contestar. MaKo contesta el mensaje entero con sus herramientas (las de todas las áreas) y esto SUMA el link para
 *    ir a la pantalla («que el chat le deje ahí el link para ir a donde corresponde», Martín).
 * ⚠️ La respuesta es de la red: se lee como dato. Sólo links RELATIVOS de la app (ni `//` ni un esquema), sin repetir,
 *    y nunca el propio Second Brain.
 */
export function linksDePedidos(r: unknown): IrA[] {
  const pedidos = r && typeof r === 'object' && Array.isArray((r as { pedidos?: unknown }).pedidos) ? (r as { pedidos: unknown[] }).pedidos : [];
  const out: IrA[] = [];
  for (const p of pedidos) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    if (o.sobre !== 'otra-tab' || typeof o.link !== 'string' || typeof o.titulo !== 'string' || !o.titulo.trim()) continue;
    const link = o.link.trim();
    if (!link.startsWith('/') || link.startsWith('//') || link.includes('\\')) continue;
    const ruta = link.split(/[?#]/)[0];
    if (ruta === '/second-brain' || ruta.startsWith('/second-brain/')) continue;
    if (out.some((x) => x.link.split(/[?#]/)[0] === ruta)) continue;
    out.push({ titulo: o.titulo.trim().slice(0, 60), link });
    if (out.length >= MAX_IR_A) break;
  }
  return out;
}

/**
 * Cuelga los links de la respuesta de MaKo a UN mensaje de la persona (`despuesDe`, su id): del último mensaje de MaKo
 * entre ése y el siguiente de la persona (tanda 10, 17/10/2026). Los links llegan cuando llegan, y para entonces la
 * persona pudo haber escrito otra cosa: no se cuelgan de la respuesta equivocada. Si esa respuesta no trae un mensaje de
 * MaKo (sólo una tarjeta), o el mensaje ya no está (cambió de chat), no se dibujan: no se inventa una burbuja. Nada de la
 * respuesta se saca ni se cambia.
 */
export function colgarIrA<T extends { k: string; id: string; role?: string }>(items: readonly T[], links: readonly IrA[], despuesDe: string): T[] {
  const desde = items.findIndex((x) => x.id === despuesDe);
  let i = -1;
  if (links.length && desde >= 0) {
    for (let j = desde + 1; j < items.length; j++) {
      const x = items[j];
      if (x.k === 'msg' && x.role === 'user') break;
      if (x.k === 'msg' && x.role === 'assistant') i = j;
    }
  }
  return i < 0 ? [...items] : items.map((x, j) => (j === i ? { ...x, irA: [...links] } : x));
}

/** El grupo de WhatsApp de MaKo en la barra del Second Brain (tanda 8): se lee acá y se contesta allá. */
export const TITULO_GRUPO = 'MaKo en WhatsApp';
export const AVISO_GRUPO = 'Se contesta en el grupo de WhatsApp.';

/** ¿Es un momento válido para pedir la página anterior del grupo? (`?antes=` de la ruta: una fecha ISO, nada más). */
export function antesValido(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

// ── «Lo que hizo» (tanda 7) ──────────────────────────────────────────────────────────────────────────────────────

/** Cómo quedó una acción que MaKo dejó en el chat (lo que dibuja el riel). Los rótulos salen de PILL_PROPUESTA. */
export type EstadoHecho = 'pendiente' | 'aplicando' | 'hecho' | 'cancelada' | 'vencida' | 'fallo';
export type HechoChat = { id: number; tipo: string; resumen: string; estado: EstadoHecho; at: string; resueltoAt: string | null };

/**
 * El estado de una fila de `mako_acciones_pendientes`, en las palabras de la tarjeta del chat (`EstadoPropuesta` de
 * app/m/mako/chat-ui.ts). Una pendiente con el plazo pasado es «vencida» aunque la fila todavía diga 'pendiente':
 * nadie la venció (esto es una lectura; `vencerExpiradas` escribe).
 */
export function estadoDeLoHecho(estado: string, venceAt: string | null, ahora: number): EstadoHecho {
  if (estado === 'pendiente') {
    const t = venceAt ? Date.parse(venceAt) : NaN;
    return Number.isFinite(t) && t <= ahora ? 'vencida' : 'pendiente';
  }
  if (estado === 'confirmada') return 'aplicando';
  if (estado === 'ejecutada') return 'hecho';
  if (estado === 'cancelada') return 'cancelada';
  if (estado === 'vencida') return 'vencida';
  return 'fallo';
}

/** El texto de una nota de voz que no trae transcripción (sin él, la burbuja quedaba vacía). */
export const NOTA_DE_VOZ = 'Nota de voz';

/** Lo que lee el super admin antes de las preguntas del onboarding que se armaron después (lib/onboarding-historial.ts). */
export const AVISO_RECONSTRUIDO = 'Reconstruido: estas preguntas del onboarding se armaron después, con las respuestas que quedaron guardadas.';

/** Un mensaje de Offer como uno del chat (20/10/2026, lib/chat-mako-indice.ts → hiloDeOffer): 'yo' es la persona, 'mako' es
 *  MaKo; lo vacío no se dibuja. Un adjunto sin texto dice su nombre, como en el chat «Onboarding» (`mensajesDelHilo`): sin
 *  esto, el documento que Florencia mandó como respuesta (ws21) no se veía y quedaban dos preguntas de MaKo seguidas.
 *  Con `avisoReconstruido` (sólo el super admin), cada tramo armado después lleva `AVISO_RECONSTRUIDO` adelante.
 *  Una nota de voz viaja como `audio` (la URL ya armada por quien llama, lib/chat-mako-indice.ts), con la transcripción
 *  como texto: el Ops Center mostraba sólo la transcripción. Nada más del audio sale de acá (ni su ruta de Storage). */
export function mensajesDeOffer(
  ms: ReadonlyArray<{
    de: 'mako' | 'yo'; texto: string; at?: string; adjuntos?: ReadonlyArray<{ nombre: string }>; reconstruido?: boolean;
    audio?: { url: string; secs: number };
  }>,
  o: { avisoReconstruido?: boolean } = {},
): Array<{ role: 'user' | 'assistant'; content: string; created_at?: string; audio?: { url: string; secs: number } }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string; created_at?: string; audio?: { url: string; secs: number } }> = [];
  let enTramo = false;
  for (const m of ms) {
    const texto = typeof m.texto === 'string' && m.texto.trim() ? m.texto : '';
    const audio = m.audio && typeof m.audio.url === 'string' && m.audio.url ? { audio: { url: m.audio.url, secs: m.audio.secs } } : {};
    const content = texto || (m.adjuntos ?? []).map((a) => `Adjunto: ${a.nombre}`).join('\n') || ('audio' in audio ? NOTA_DE_VOZ : '');
    if (!content.trim()) continue;
    const at = m.at ? { created_at: m.at } : {};
    if (o.avisoReconstruido && m.reconstruido && !enTramo) out.push({ role: 'assistant', content: AVISO_RECONSTRUIDO, ...at });
    enTramo = !!m.reconstruido;
    out.push({ role: m.de === 'yo' ? 'user' : 'assistant', content, ...at, ...audio });
  }
  return out;
}

/**
 * La conversación de Offer del ONBOARDING que ya tiene su chat «Onboarding» (20/10/2026, acordado con el chat Onboarding):
 * `hiloDelOnboarding` (rama onboarding-v3) la COPIA a chart_sessions al terminar y guarda su id en `onboarding.arranque` →
 * `hiloChat`; la proyección de Offer la esconde, o saldría dos veces. Lee el setting crudo (`sesionId` y `hiloChat`).
 * Sólo para QUIEN TIENE LA COPIA (revisión del Cerebro, 20/10): el «Onboarding» es un chat de UNA persona (`hiloDe`, su
 * chart_key). El super admin mirando, otro admin o un closer con Offer no lo tienen: si se les escondía, la conversación
 * desaparecía de su Ops Center, justo lo que Martín pidió arreglar ese día.
 * Con `at`, la hora de la copia (`hiloAt`): la copia es una FOTO, y si la persona siguió esa conversación en Offer
 * después, se vuelve a listar (cuarta revisión, 21/10: lo nuevo no llegaba al Ops Center de nadie). `seEscondeDeOffer`.
 * null = no se esconde ninguna (sin onboarding, sin el chat todavía, o el chat es de otro).
 */
export function offerDelOnboardingCopiada(raw: unknown, chartKey: string | null): { id: number; at: string | null } | null {
  let o: unknown = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const { sesionId, hiloChat, hiloDe, hiloAt } = o as Record<string, unknown>;
  const entero = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
  const suya = !!chartKey && typeof hiloDe === 'string' && hiloDe === chartKey;
  return suya && entero(hiloChat) && entero(sesionId) ? { id: sesionId as number, at: typeof hiloAt === 'string' ? hiloAt : null } : null;
}

/** ¿Esta conversación de Offer se esconde porque ya está copiada en el «Onboarding», sin nada nuevo después de la copia? */
export function seEscondeDeOffer(s: { id: number; updatedAt: string }, copiada: { id: number; at: string | null } | null): boolean {
  if (!copiada || s.id !== copiada.id) return false;
  return !copiada.at || !(Date.parse(s.updatedAt) > Date.parse(copiada.at));
}

// ── La lista del Ops Center del cliente (21/10/2026) ─────────────────────────────────────────────────────────────────
// ⚠️ 22/10/2026, CON SUS ORÍGENES (Martín, con la captura del ws1: «Los chats de los clientes en el Ops Center están muy
// desacomodados... Deberías tener un orden como en Super Admin»): cada chat se llama «Origen › tema» («Offer › Mi oferta»,
// «Dashboard › El CAC está a $1,098») y la pantalla los agrupa por su origen con `porJefe` (lib/centro-chats.ts), el MISMO
// agrupado del super admin: el grupo sube con el más reciente de los suyos, y nada se pliega. Nunca «Chat de antes».
// Martín: «Jamás debes categorizar en desplegables los chats de la sidebar, como "offer" o "antes", y mucho menos "continuar
// en offer", las personas deberían poder continuar lo que quieran siempre desde el Ops Center». La lista es UNA, como la del
// super admin (lib/centro-chats.ts → seccionesDeChats): el Cerebro arriba y, debajo, todos los demás —los sub-chats con MaKo,
// las conversaciones de Offer y los chats de antes— por actividad, cada uno con su criatura. Sin secciones ni plegables.

/** Lo elegido en la barra: una conversación con MaKo, un chat que todavía no tiene (el jefe sin nada, o «Nuevo chat»), un
 *  chat de antes (de «Pregúntale a MaKo»), una conversación de Offer, o un chat de Claude Code (su clave del Centro). */
export type ElegidoChat = { id: number } | { virtual: 'jefe' | 'nuevo' } | { antes: number } | { centro: string } | { offer: number } | { grupo: true }
  | { automatizacion: number } | { editor: TipoEditor; clave: string } | { coach: 'funnel' };

/** De dónde sale un chat de la lista: a qué motor va lo que se escribe (MaKo, o el de Offer). El grupo no tiene motor: se lee. */
export type OrigenDeFila = 'mako' | 'offer' | 'antes' | 'grupo' | 'automations' | 'editor';

export type FilaDelCliente = {
  /** La key de React y la búsqueda del elegido. */
  clave: string;
  elegido: ElegidoChat;
  titulo: string;
  /** El nombre del que sale su criatura: el del Cerebro es la estrella; los de Offer, la familia de Offer. */
  criatura: string;
  /** Lo último que pasó (ms), para el orden y la hora de la fila. */
  actividad: number | null;
  origen: OrigenDeFila;
  /** La fila JEFE de un grupo que no tiene chat propio (`jefeDelGrupo`): abre el más reciente de los suyos, y no es «el abierto». */
  jefeDeGrupo?: true;
  /** La conversación con un gurú (`…:referente-<id>`): lleva su cara y se abre en su chat (ChatDelReferente.tsx). */
  guru?: IdAsesor;
};

/** `tema`: de qué se trata, para nombrar lo que no tiene título y distinguir dos que se llaman igual (lo pone el servidor:
 *  lib/chat-mako-indice.ts → `conTemas`, `chatsDeOffer`). */
type ConTitulo = { id: number; titulo: string | null; updatedAt: string; tema?: string | null };
/** Un chat de antes o de una tab: su clave (de ahí sale de dónde viene) o su origen ya dicho por el servidor («Ficha · Ana»). */
type DeAntes = ConTitulo & { clave?: string; origen?: string | null };
const ms = (iso: string | null | undefined): number | null => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? t : null; };
/**
 * De DÓNDE viene un chat, por su clave (22/10/2026, OC4: «cada chat dice de dónde viene»). Medido ese día en chart_sessions: 68
 * del CRM (`mako-movil:<persona>:crm:<id>`, que el Ops Center no listaba nunca), los de los gráficos del Dashboard
 * (`dashboard:…`, `comercial-…`, `marketing-…`), los de un anuncio o una campaña (`ad-detail-…`, `mkt-campaign-…`) y el de las
 * secuencias de WhatsApp. null = no se sabe (se muestra sólo el título).
 */
export function origenDeClave(clave: string | null | undefined): string | null {
  // La de un closer o un setter va con su persona adelante (`persona:<p>:dashboard:<hoja>`, lib/chart-chats-reglas.ts): el admin
  // la ve así, y sin sacarla no se reconocía el origen (22/10/2026, lo que midió TB1).
  const k = String(clave ?? '').replace(/^persona:[^:]+:/, '');
  // El agente del Web Generator de una landing (TB1, lib/hilo-de-tab-reglas.ts → claveDeLanding): salía suelto, sin grupo.
  if (/^landing:/.test(k)) return 'Web Generator';
  // «Pregúntale a MaKo» (/mako, que hoy redirige al Ops Center) y /mako-doer: medido el 22/10 en el ws1, eran sus «Chat de antes».
  if (/^mako-(general|doer)(:u\d+)?$/.test(k)) return ORIGEN_PREGUNTALE;
  if (/^mako-movil:[^:]+:crm:\d+$/.test(k)) return 'CRM';
  if (/^mako-movil:[^:]+:lead:\d+$/.test(k)) return 'Ficha';
  if (k.endsWith(`:${TAB_SECOND_BRAIN}`) && /^mako-movil:[^:]+:[a-z-]+$/.test(k)) return ORIGEN_SECOND_BRAIN;
  if (k.endsWith(`:${TAB_VIDEO_GENERATOR}`) && /^mako-movil:[^:]+:[a-z-]+$/.test(k)) return ORIGEN_VIDEO_GENERATOR;
  if (k.endsWith(`:${TAB_FUNNEL_COACH}`) && /^mako-movil:[^:]+:[a-z-]+$/.test(k)) return ORIGEN_FUNNEL_COACH;
  // La de un gurú: su nombre es el origen («Julián Alborna › tema»). Sin esto, `claveDeTab` la rechaza y no se puede escribir.
  if (/^mako-movil:[^:]+:referente-[a-z-]+$/.test(k)) { const a = asesorPorId(referenteDeTab(k)); if (a) return a.nombre; }
  if (/^(dashboard:|comercial-|marketing-(?!ad-))/.test(k)) return 'Dashboard';
  if (/^(ad-detail-|mkt-campaign-|marketing-ad-)/.test(k)) return 'Ads';
  if (/^whatsapp-/.test(k)) return 'Automations';
  return null;
}
export const ORIGEN_PREGUNTALE = 'Pregúntale a MaKo';

// ── La app de escritorio, primero (23/10/2026) ─────────────────────────────────────────────────────────────────────
// Martín: «si detecta MaKo que no tienes instalado la app de escritorio, antes de mostrarte nada, o dejarte usar cualquier chat,
// en cualquier tab, te debe aparecer el botón para que puedas descargar la app». Y ante la duda de bloquear a quien ya trabaja
// con su clave, DECIDIÓ (23/10/2026): «Bloqueá igual: aunque tenga su clave de IA, primero tiene que descargar la app de escritorio
// antes de usar cualquier chat». Por qué: el producto es MaKo en SU computadora con SU Claude (lib/ia-pc-reglas.ts); una clave
// sola no le da a MaKo lo que hace en la PC. Los cuidados (del Cerebro, para no romper lo que no es chat):
//   · sólo los CHATS con MaKo: las automatizaciones y lo que corre solo siguen igual (la PC del cliente nunca atiende leads);
//   · en el teléfono no se puede instalar: ahí NO se bloquea, se avisa «Descarga MaKo en tu computadora» (`en-la-computadora`);
//   · en cuanto la computadora se conecta, el chat se destraba solo (useChatCliente.ts relee mientras está bloqueado).
// EL NEGOCIO DE LA PLATAFORMA TAMBIÉN (25/10/2026). Hasta ese día quedaba afuera porque contesta su IA, y Martín lo vio desde su
// cuenta: «Ni en la cuenta de Mauricio ni en la mia tengo instalado aun la app de escritorio de MaKo y aún así me sigue dejando
// enviar mensajes... No debería. En ningun chat, no solo en Ops Center». Sin computadora, bloquea en cualquier negocio.

/** Qué hace el chat con la app de escritorio: nada (`tiene`), la descarga en lugar del chat (`bloquea`), o en el teléfono, el
 *  aviso de descargarla en la computadora sin tapar nada (`en-la-computadora`). */
export type AppDeEscritorio = 'tiene' | 'bloquea' | 'en-la-computadora';
export function appDeEscritorio(p: { conComputadora: boolean; telefono: boolean }): AppDeEscritorio {
  if (p.conComputadora) return 'tiene';
  return p.telefono ? 'en-la-computadora' : 'bloquea';
}

// ── El chat del Second Brain (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Martín: «quiero que Second Brain, la sidebar que tiene a la derecha sea reemplazada por un chat con MaKo, que tenga la criatura
// de MaKo... Que se guarde el historial claro, pero que si no hay nada que MaKo mande el mensaje "Hola NOMBRE. Este es tu Second
// Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?"». UNA conversación por persona y por negocio,
// guardada como las de las otras tabs (`mako-movil:<persona>:second-brain`, en chart_sessions del workspace): el Ops Center la
// lista y la sigue como a las del CRM (lib/chat-mako-indice.ts → chatsDeLasTabs, claveDeTab).

/** El sufijo de la clave de la conversación del Second Brain de una persona. */
export const TAB_SECOND_BRAIN = 'second-brain';
/** Su origen en la lista del Ops Center: el grupo «Second Brain». */
export const ORIGEN_SECOND_BRAIN = 'Second Brain';
/**
 * El chat al costado del estudio de Video Generator (27/10/2026, Martín: «implementar Video Generator… que se parezca a una
 * app que tomemos de referencia»): UNA conversación por persona y por negocio, como la del Second Brain, con el anuncio
 * abierto como entidad (lib/chat-desde.ts → `anuncio`). El Ops Center la lista en el grupo «Video Generator».
 */
export const TAB_VIDEO_GENERATOR = 'video-generator';
export const ORIGEN_VIDEO_GENERATOR = 'Video Generator';
/** Las tabs con una conversación propia por persona: lo único que acepta la ruta para crearla. */
/**
 * El Funnel Coach (1/11/2026, docs/funnel-coach.md): su fila está fija debajo del Ops Center, así que no se repite en el resto. Es el
 * ÚNICO coach desde el 4/11/2026 (Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach"»): trabaja la
 * oferta y el funnel, y las conversaciones de oferta cuelgan de su fila. ⚠️ NO HAY OTRO ORIGEN DE COACH: un «Offer Coach» que vuelva a
 * aparecer en una pantalla es una segunda puerta a lo mismo (tests/coaches-ops-center.test.ts lo frena).
 */
export const TAB_FUNNEL_COACH = 'funnel-coach';
export const ORIGEN_FUNNEL_COACH = 'Funnel Coach';
export const TABS_CON_CHAT_PROPIO: readonly string[] = [TAB_SECOND_BRAIN, TAB_VIDEO_GENERATOR, TAB_FUNNEL_COACH];

// ── El chat con un GURÚ (3/11/2026, #16: «elegir un gurú desde Nuevo chat») ─────────────────────────────────────────
// UNA conversación por persona, negocio y gurú (`mako-movil:<persona>:referente-<id>`), como la del Funnel Coach: elegir otra
// vez al mismo gurú la retoma. ⚠️ LO QUE LO HACE GURÚ ES LA CLAVE, NO LA PANTALLA: el servidor saca el referente de la clave
// de la conversación (app/api/mako/chat/route.ts → `contextoDelChat`), así que retomarla desde la lista del Ops Center sigue
// siendo con él. Si lo decidiera la pantalla, la misma conversación abierta desde la lista contestaría como MaKo a secas.
export const PREFIJO_TAB_REFERENTE = 'referente-';
export const tabDeReferente = (id: IdAsesor): string => `${PREFIJO_TAB_REFERENTE}${id}`;
/** El referente de una tab (`referente-<id>`) o del final de una clave (`…:referente-<id>`); null si no es de un gurú que existe. */
export function referenteDeTab(tab: string | null | undefined): IdAsesor | null {
  const t = String(tab ?? '').split(':').pop() ?? '';
  return t.startsWith(PREFIJO_TAB_REFERENTE) ? asesorPorId(t.slice(PREFIJO_TAB_REFERENTE.length))?.id ?? null : null;
}
/** ¿Esta tab tiene una conversación propia por persona? Las de la lista fija y la de cada gurú (lo único que acepta la ruta). */
export const esTabConChatPropio = (tab: string): boolean => TABS_CON_CHAT_PROPIO.includes(tab) || (!tab.includes(':') && referenteDeTab(tab) != null);

/** Un gurú con el que la persona ya habló: su conversación y cuándo fue lo último. */
export type GuruConCharla = { id: IdAsesor; at: string | null };

/**
 * Los gurús que van en la barra, debajo del coach, lo más reciente arriba: con los que ya habló y el que tiene abierto, aunque todavía no
 * le haya escrito (si no, abrirlo no se vería en la lista). ⚠️ NINGUNO SE ESCONDE (4/11/2026): hasta ese día se sacaba el del Offer Coach,
 * porque su fila ERA el chat con ese gurú. El coach único tiene su propia conversación, así que la charla con Hormozi que alguien tuvo
 * tocando el Offer Coach sale acá, con su cara y su nombre, y no se pierde ni se duplica.
 */
export function gurusDeLaBarra(o: { conCharla: readonly GuruConCharla[]; abierto: IdAsesor | null; busca: string }): GuruConCharla[] {
  const b = normal(o.busca);
  const yaEsta = o.conCharla.some((g) => g.id === o.abierto);
  return [...o.conCharla, ...(o.abierto && !yaEsta ? [{ id: o.abierto, at: null }] : [])]
    .filter((g) => !b || normal(asesorPorId(g.id)?.nombre ?? '').includes(b))
    .map((g, i) => ({ g, i, t: ms(g.at) ?? Number.MAX_SAFE_INTEGER }))
    .sort((x, y) => y.t - x.t || x.i - y.i)
    .map((x) => x.g);
}

/** El saludo del Second Brain con la conversación vacía, con el nombre de pila de quien mira (sin nombre, sin el «NOMBRE»). */
export function saludoDelSecondBrain(nombre: string | null | undefined): string {
  const pila = String(nombre ?? '').trim().split(/\s+/)[0] ?? '';
  return `Hola${pila ? ` ${pila}` : ''}. Este es tu Second Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?`;
}

/** Lo que el panel ofrece debajo del saludo: lo que antes se leía en la barra del grafo, ahora se le pregunta a MaKo. */
export const ARRANQUES_DEL_SECOND_BRAIN = ['¿Qué es lo último que sabes?', '¿Cuál es mi Norte?', '¿Qué te falta saber de mi negocio?'] as const;

// ── Las charlas del lienzo de Automations (22/10/2026, OC5) ─────────────────────────────────────────────────────────
export const ORIGEN_AUTOMATIONS = 'Automations';

// ── Los chats del Image Editor y del Video Editor (22/10/2026, OC8) ──────────────────────────────────────────────────
// Uno por persona y por diseño o proyecto (image_editor_chats, mig 0303; video_editor_chats, mig 0298). Se leen acá y se siguen
// en el editor, que es el que sabe aplicar lo que propone.
export type TipoEditor = 'imagen' | 'video';
export const EDITORES: Readonly<Record<TipoEditor, { origen: string; ruta: (id: string) => string }>> = {
  imagen: { origen: 'Image Editor', ruta: (id) => `/image-editor/${encodeURIComponent(id)}` },
  video: { origen: 'Video Editor', ruta: (id) => `/video-editor/${encodeURIComponent(id)}` },
};
/** La clave de un chat de un editor: de quién es y de qué diseño o proyecto (dos personas pueden tener uno del mismo). */
export const claveDeEditor = (persona: string, id: string): string => `${persona}|${id}`;
export function partesDeClaveDeEditor(clave: string): { persona: string; id: string } | null {
  const i = clave.lastIndexOf('|');
  const persona = i > 0 ? clave.slice(0, i) : '';
  const id = i > 0 ? clave.slice(i + 1) : '';
  return persona && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? { persona, id } : null;
}
/** Lo que dice la caja de un chat de un editor: se lee acá y se sigue allá. */
export const AVISO_EDITOR = 'Esta charla es del editor: se sigue ahí.';
/** La de otra persona del equipo: en el editor se abre la tuya, así que ésta sólo se lee acá (la revisión del 22/10/2026). */
export const AVISO_EDITOR_AJENO = 'Esta charla es de otra persona del equipo: se lee aquí.';
/** Los mensajes de un chat de un editor, para el hilo: lo de la persona y lo de MaKo, con su hora. Lo vacío no se dibuja. */
export function mensajesDeEditor(ms: ReadonlyArray<{ de: 'yo' | 'mako'; texto: string; c: number }>): MensajeChat[] {
  return ms.flatMap((m): MensajeChat[] => {
    const content = m.texto.trim();
    return content ? [{ role: m.de === 'yo' ? 'user' : 'assistant', content, ...(Number.isFinite(m.c) && m.c > 0 ? { created_at: new Date(m.c).toISOString() } : {}) }] : [];
  });
}
/** Dónde se SIGUE una charla del lienzo: el lienzo de esa automatización con su chat abierto (el que sabe editarla). */
export const rutaDelLienzo = (id: number): string => `/automations?sec=${id}&mako=1`;
/** Lo que dice la caja de una charla del lienzo: se lee acá y se sigue allá. */
export const AVISO_LIENZO = 'Esta charla es del lienzo de la automatización: se sigue ahí.';

/**
 * Los mensajes de una charla del lienzo, para el hilo del Ops Center: lo de la persona y lo de MaKo, con su hora. Una pregunta de
 * MaKo lleva sus opciones debajo; lo que salió de una tarjeta lo dice («Desde «Mensaje 1»: …»). Lo vacío no se dibuja.
 */
export function mensajesDeAutomatizacion(ms: readonly MensajeChatMako[]): MensajeChat[] {
  return ms.flatMap((m): MensajeChat[] => {
    const opciones = m.pregunta?.opciones.length ? `\n\n${m.pregunta.opciones.map((o) => `- ${o.label}`).join('\n')}` : '';
    const cuerpo = `${m.texto.trim()}${opciones}`.trim();
    if (!cuerpo) return [];
    const content = m.tarjeta ? `Desde «${m.tarjeta}»: ${cuerpo}` : cuerpo;
    return [{ role: m.de === 'yo' ? 'user' : 'assistant', content, created_at: m.at }];
  });
}
/** El chat «Onboarding» (lib/onboarding-arranque.ts → TITULO_HILO; acá sin imports de valores): es su propio origen. */
export const TITULO_ONBOARDING = 'Onboarding';

/**
 * EL TEMA DE UN CHAT, de su primer mensaje (22/10/2026, Martín: «Los chats de los clientes en el Ops Center están muy
 * desacomodados»): un renglón, sin el formato del markdown, un link dicho por su dominio, corto. '' = no dice nada.
 */
export function temaDe(texto: string | null | undefined): string {
  const renglon = String(texto ?? '').split('\n').map((l) => l.trim()).find((l) => /[\p{L}\p{N}]/u.test(l)) ?? '';
  const t = renglon
    .replace(/https?:\/\/(?:www\.)?([^/\s]+)\S*/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > 48 ? `${t.slice(0, 48).trimEnd()}…` : t;
}

/** «18 oct», con el reloj de Argentina. */
const fechaCorta = (t: number | null): string => (t == null ? ''
  : new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).replace('.', ''));

/**
 * DOS QUE SE LLAMAN IGUAL SE DISTINGUEN (22/10/2026, el ws1: «Mi oferta» dos veces, «Presentación de MaKo IA» dos veces): con su
 * tema («Mi oferta · sprint.mauriciobustos.com») o, si no lo tienen o también se repite, con su fecha; y si todavía, con un número.
 */
function distinguir(filas: FilaDelCliente[], temas: ReadonlyMap<string, string>): FilaDelCliente[] {
  const repetidos = (fs: readonly FilaDelCliente[]) => {
    const n = new Map<string, number>();
    for (const f of fs) n.set(normal(f.titulo), (n.get(normal(f.titulo)) ?? 0) + 1);
    return (f: FilaDelCliente) => (n.get(normal(f.titulo)) ?? 0) > 1;
  };
  let rep = repetidos(filas);
  let out = filas.map((f) => {
    const tema = temas.get(f.clave);
    return rep(f) && tema && !normal(f.titulo).endsWith(normal(tema)) ? { ...f, titulo: `${f.titulo} · ${tema}` } : f;
  });
  rep = repetidos(out);
  out = out.map((f) => {
    const fecha = fechaCorta(f.actividad);
    return rep(f) && fecha && !normal(f.titulo).endsWith(normal(fecha)) ? { ...f, titulo: `${f.titulo} · ${fecha}` } : f;
  });
  rep = repetidos(out);
  const vistos = new Map<string, number>();
  return out.map((f) => {
    if (!rep(f)) return f;
    const k = normal(f.titulo);
    const n = (vistos.get(k) ?? 0) + 1;
    vistos.set(k, n);
    return n > 1 ? { ...f, titulo: `${f.titulo} (${n})` } : f;
  });
}

/** El título de una fila con su origen adelante («CRM › Seguimiento de Ana»), con la forma «Origen › título» de la casa. */
export const conOrigen = (origen: string | null | undefined, titulo: string): string => (origen ? `${origen} › ${titulo}` : titulo);

/** La criatura de una conversación de Offer: la del área Offer (lib/centro-munecos.ts → EQUIPO), con su cara por el título. */
export const criaturaDeOffer = (titulo: string): string => `Offer › ${titulo}`;

/**
 * EL JEFE DE UN GRUPO QUE NO TIENE CHAT PROPIO (22/10/2026, Martín: «Que NO hayan "secciones" en la sidebar de chats, que estén los
 * chats JEFES que actúan como las secciones y los chats trabajadores que son los de abajo»). Los de Offer, del Dashboard o de
 * «Pregúntale a MaKo» iban bajo un TÍTULO (AUTOMATIONS, OFFER…); ahora, bajo una fila jefe con su criatura, como en el super admin
 * (PiezasCentro.tsx → GruposPorJefe). Tocarla abre su chat más reciente: el primero del grupo (la lista llega con lo más reciente
 * arriba). Su hora, la del más reciente. null = el grupo no tiene chats.
 */
export function jefeDelGrupo(g: { clave: string; jefe: string; subs: readonly FilaDelCliente[] }): FilaDelCliente | null {
  const primero = g.subs[0];
  if (!primero) return null;
  const actividad = g.subs.reduce<number | null>((m, f) => (f.actividad != null && (m == null || f.actividad > m) ? f.actividad : m), null);
  return { clave: g.clave, elegido: primero.elegido, titulo: g.jefe, criatura: g.jefe, actividad, origen: primero.origen, jefeDeGrupo: true };
}

/** La lista entera: el Cerebro primero (siempre, aunque no tenga conversación todavía) y el resto, lo más reciente arriba. La
 *  búsqueda no esconde al Cerebro (es la casa). `grupo`: el grupo de WhatsApp de MaKo del negocio, de SÓLO LECTURA y sólo del
 *  admin (22/10/2026, OC3: el lector existía y nadie lo llamaba; lib/chat-mako-indice.ts → grupoDeMaKo, que ya corta al resto). */
export function listaDelCliente(p: {
  sesiones: readonly SesionChat[]; offer: readonly ConTitulo[]; antes: readonly DeAntes[]; busca: string;
  grupo?: { titulo: string; ultimoAt: string | null } | null;
  /** Las charlas del lienzo de Automations (OC5): se leen acá y se siguen en el lienzo. */
  automations?: readonly ConTitulo[];
  /** Los chats del Image Editor y del Video Editor (OC8): se leen acá y se siguen en el editor. */
  editores?: ReadonlyArray<{ tipo: TipoEditor; clave: string; titulo: string | null; updatedAt: string; propio?: boolean }>;
}): FilaDelCliente[] {
  const { jefe, subs } = arbolDelJefe(p.sesiones);
  const cerebro: FilaDelCliente = {
    clave: 'jefe', elegido: jefe ? { id: jefe.id } : { virtual: 'jefe' }, titulo: NOMBRE_JEFE, criatura: JEFE_SECOND_BRAIN,
    actividad: ms(jefe?.updatedAt), origen: 'mako',
  };
  const b = normal(p.busca);
  const todas: FilaDelCliente[] = [
    ...subs.map((s): FilaDelCliente => ({ clave: `s${s.id}`, elegido: { id: s.id }, titulo: tituloDe(s), criatura: tituloDe(s), actividad: ms(s.updatedAt), origen: 'mako' })),
    ...p.offer.map((o): FilaDelCliente => {
      // «Offer › Mi oferta»; la del onboarding es su propio origen («Onboarding»).
      const base = o.titulo?.trim() || SECCION_OFFER;
      const titulo = base === TITULO_ONBOARDING || base === SECCION_OFFER ? base : conOrigen(SECCION_OFFER, base);
      return { clave: `o${o.id}`, elegido: { offer: o.id }, titulo, criatura: criaturaDeOffer(base), actividad: ms(o.updatedAt), origen: 'offer' };
    }),
    ...p.antes.filter((a) => (a.origen ?? origenDeClave(a.clave)) !== ORIGEN_FUNNEL_COACH).map((a): FilaDelCliente => {
      // La de un gurú es UNA por persona: se llama como él, sin «› tema», y no arma un grupo con una sola fila.
      const delGuru = asesorPorId(referenteDeTab(a.clave));
      if (delGuru) return { clave: `a${a.id}`, elegido: { antes: a.id }, titulo: delGuru.nombre, criatura: delGuru.nombre, actividad: ms(a.updatedAt), origen: 'antes', guru: delGuru.id };
      // Con su origen adelante (OC4): «CRM › …», «Dashboard › …», «Ficha · Ana › …». La criatura es la de su área.
      const origen = a.origen ?? origenDeClave(a.clave);
      // Sin título (medido el 22/10: la mitad de los del CRM, y los análisis de los gráficos), su tema: lo primero que se dijo. Sin
      // tema, su origen solo («CRM»); sin nada, su fecha. Nunca «Chat de antes».
      const nombre = a.titulo?.trim() || a.tema?.trim() || null;
      const titulo = nombre ? conOrigen(origen, nombre) : origen ?? `Chat del ${fechaCorta(ms(a.updatedAt)) || 'principio'}`;
      return { clave: `a${a.id}`, elegido: { antes: a.id }, titulo, criatura: origen ?? titulo, actividad: ms(a.updatedAt), origen: 'antes' };
    }),
    ...(p.grupo ? [{ clave: 'grupo', elegido: { grupo: true } as const, titulo: p.grupo.titulo, criatura: TITULO_GRUPO, actividad: ms(p.grupo.ultimoAt), origen: 'grupo' as const }] : []),
    ...(p.automations ?? []).map((a): FilaDelCliente => ({
      clave: `au${a.id}`, elegido: { automatizacion: a.id }, titulo: conOrigen(ORIGEN_AUTOMATIONS, a.titulo?.trim() || `Automatización ${a.id}`),
      criatura: ORIGEN_AUTOMATIONS, actividad: ms(a.updatedAt), origen: 'automations',
    })),
    ...(p.editores ?? []).map((e): FilaDelCliente => ({
      clave: `ed:${e.tipo}:${e.clave}`, elegido: { editor: e.tipo, clave: e.clave },
      titulo: conOrigen(EDITORES[e.tipo].origen, e.titulo?.trim() || 'Sin nombre'), criatura: EDITORES[e.tipo].origen,
      actividad: ms(e.updatedAt), origen: 'editor',
    })),
  ]
    .map((f, i) => ({ f, i }))
    .sort((x, y) => (y.f.actividad ?? 0) - (x.f.actividad ?? 0) || x.i - y.i)
    .map((x) => x.f);
  // Los repetidos se distinguen sobre la lista ENTERA y en su orden (buscar no les cambia el nombre); después, se busca.
  const temas = new Map<string, string>([
    ...p.offer.flatMap((o) => (o.tema?.trim() ? [[`o${o.id}`, o.tema.trim()] as [string, string]] : [])),
    ...p.antes.flatMap((a) => (a.titulo?.trim() && a.tema?.trim() ? [[`a${a.id}`, a.tema.trim()] as [string, string]] : [])),
  ]);
  return [cerebro, ...distinguir(todas, temas).filter((f) => !b || normal(f.titulo).includes(b))];
}

/** ¿Es la fila de lo elegido? (la de un chat nuevo no está en la lista). */
export const esFilaDe = (f: Pick<FilaDelCliente, 'elegido'>, e: ElegidoChat | null): boolean => e != null && JSON.stringify(f.elegido) === JSON.stringify(e);
