// =============================================================================
// mako-grupo — el grupo de WhatsApp "MaKo <> {cliente}" por workspace
// =============================================================================
// Cada cliente tiene UN grupo de WhatsApp donde MaKo deja recordatorios, el
// pulso y las alertas. Convención de nombre SIEMPRE: "MaKo <> {Nombre del
// cliente}". El JID del grupo se guarda en app_settings (key mako.grupo_jid) por
// workspace, para que el ruteo de avisos sepa a dónde mandar.
//
// VOZ de MaKo: la instancia de Evolution desde la que MaKo habla (grupos +
// avisos). Se resuelve en runtime con instanciaVoz() (setting mako.voz.instancia):
// hoy por defecto es el número de Martín en ws1, y al conectar el canal propio de
// SuperAdmin (mako_superadmin) por QR se cambia a esa línea dedicada. El cliente
// es un participante más del grupo, así que a él sí le NOTIFICA.

import 'server-only';
import { esSesionCaida } from './evolution';
import sharp from 'sharp';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS, getWorkspace } from './workspace';
import { leerResultadoParticipante, jidCanonico } from './participantes-grupo';
import { detalleEvolution, enviarPartesPorEv, type EnvioPartes, type EvFn, type PartePreparada } from './mako-tarjeta';
import { reclamarEspaciado, salioReciente } from './espaciado';
import { reclamarContactoLinea, SIN_CUPO_LINEA, VENTANA_LINEA_MIN, type AlmacenTope } from './mako-linea-tope';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Instancia de Evolution que le pone la voz a MaKo por defecto (número de Martín
 *  cargado en ws1). El canal propio de SuperAdmin (mako_superadmin) la reemplaza
 *  al conectarse por QR — se elige en runtime con la setting mako.voz.instancia. */
export const INSTANCIA_VOZ_DEFAULT = 'mako_ws1';
export const KEY_VOZ_INSTANCIA = 'mako.voz.instancia';

/**
 * Instancia que MaKo usa para hablar (grupos + avisos). Configurable en runtime.
 *
 * `estricto`: un error leyendo el setting TIRA en vez de caer al default. El default es la
 * línea de un CLIENTE (mako_ws1): para mandar un aviso es un mal menor, pero para decidir «la
 * voz está muerta, mandá la alarma» o «esta línea es de MaKo» es un error con consecuencias
 * (revisión adversarial del 11/09/2026).
 */
export async function instanciaVoz(opts?: { estricto?: boolean }): Promise<string> {
  return runWithWorkspace(OWNER_WS, async () => {
    const v = opts?.estricto ? await getSettingEstricto(KEY_VOZ_INSTANCIA) : await getSetting(KEY_VOZ_INSTANCIA);
    return v || INSTANCIA_VOZ_DEFAULT;
  });
}
/** Fija qué instancia usa la voz de MaKo (ej. al conectar el canal SuperAdmin). */
export async function setInstanciaVoz(instancia: string): Promise<void> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_VOZ_INSTANCIA, instancia));
}

/** Key de app_settings donde vive el JID del grupo de cada workspace (cliente). */
export const KEY_GRUPO_JID = 'mako.grupo_jid';
/** Número del dueño del cliente (destinatario del grupo), por workspace. */
export const KEY_NUMERO_DUENO = 'mako.numero_dueno';
/** JID del grupo de SuperAdmin (global, guardado en OWNER_WS). */
export const KEY_GRUPO_SUPERADMIN = 'mako.superadmin.grupo_jid';

export function grupoConfigurado(): boolean {
  return !!BASE && !!KEY;
}

// La estrella de MaKo (SPARK sobre badge oscuro) — mismo vector que
// app/_components/MakoBrand.tsx. NO usar /public/mako.svg (logo viejo).
//   'gold' → grupos con clientes (marca dorada de MaKo).
//   'blue' → grupo del SuperAdmin (azul de acción #2F6FED, para distinguirlo).
const SPARK = 'M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z';
export type VarianteEstrella = 'gold' | 'blue';
const PALETA: Record<VarianteEstrella, { a: string; b: string; glow: string }> = {
  gold: { a: '#F6D365', b: '#EF9F27', glow: '#EF9F27' },
  blue: { a: '#6BA0FF', b: '#2F6FED', glow: '#2F6FED' },
};
function estrellaSvg(v: VarianteEstrella): string {
  const p = PALETA[v];
  return `<svg width="640" height="640" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2A251C"/><stop offset="100%" stop-color="#171511"/></linearGradient>
    <linearGradient id="spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.b}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="52%"><stop offset="0%" stop-color="${p.glow}" stop-opacity="0.38"/><stop offset="62%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#glow)"/>
  <g transform="translate(320 320) scale(19)"><path d="${SPARK}" fill="url(#spark)"/></g>
</svg>`;
}

const estrellaCache: Partial<Record<VarianteEstrella, string>> = {};
/** La estrella de MaKo como base64 CRUDO de PNG (sin prefijo data:). Cacheada por variante. */
async function estrellaPngBase64(v: VarianteEstrella = 'gold'): Promise<string> {
  if (estrellaCache[v]) return estrellaCache[v]!;
  const png = await sharp(Buffer.from(estrellaSvg(v))).png().toBuffer();
  estrellaCache[v] = png.toString('base64');
  return estrellaCache[v]!;
}

export function descripcionGrupoMaKo(nombreCliente: string): string {
  const quien = nombreCliente?.trim() ? ` con ${nombreCliente.trim()}` : '';
  return (
    `Soy MaKo, tu copiloto de marketing${quien}. Aquí te dejo los recordatorios de ` +
    `reuniones, el pulso del día, las alertas y todo lo que necesites saber para no ` +
    `perderte nada. Escríbeme cuando quieras.`
  );
}

/** Mensaje de bienvenida que MaKo manda al crear el grupo de un cliente. */
export function mensajeBienvenidaMaKo(nombreCliente: string): string {
  const quien = nombreCliente?.trim() ? `, ${nombreCliente.trim().split(/\s+/)[0]}` : '';
  return (
    `¡Hola${quien}! 🌟 Soy MaKo, tu copiloto de marketing. Desde este grupo te voy a ` +
    `dejar los recordatorios de tus reuniones, el pulso del día, las alertas de tus ` +
    `anuncios y todo lo importante para que no se te escape nada. Cuando te avise algo, ` +
    `me puedes responder aquí mismo. ¡Arrancamos! 🚀`
  );
}

const DESC_SUPERADMIN =
  'Panel del dueño de la agencia. Aquí MaKo te resume el estado de todos tus clientes, ' +
  'te avisa lo urgente (semáforo en rojo, cuotas, fatiga de ads) y te deja tus pendientes. ' +
  'Es tu vista de comando: lo importante de toda la operación, en un solo lugar.';

// ── Fetch mínimo a Evolution (self-contained: usa la instancia de voz de MaKo,
//    no la del request, así que no depende de wsEstricto) ─────────────────────
type EvOut = { ok: boolean; status: number; body: unknown };
async function ev(path: string, init?: RequestInit): Promise<EvOut> {
  if (!grupoConfigurado()) return { ok: false, status: 0, body: 'Evolution no configurado' };
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const txt = await r.text();
    let body: unknown = txt;
    try { body = txt ? JSON.parse(txt) : {}; } catch { /* deja texto */ }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');
// Extrae el JID de grupo (…@g.us) de las varias formas que devuelve Evolution.
function extraerJid(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const cand = b.id ?? b.groupJid ?? b.jid ?? (b.key as Record<string, unknown> | undefined)?.remoteJid;
  return typeof cand === 'string' && cand.includes('@g.us') ? cand : null;
}

// ── JID del grupo por workspace (app_settings) ───────────────────────────────
export async function getGrupoJidMaKo(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSetting(KEY_GRUPO_JID));
}
async function guardarGrupoJid(ws: number, jid: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_GRUPO_JID, jid));
}

// ── Retoques de un grupo existente (best-effort) ─────────────────────────────
async function ponerFoto(jid: string, v: VarianteEstrella = 'gold'): Promise<void> {
  const image = await estrellaPngBase64(v);
  await ev(`/group/updateGroupPicture/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ image }),
  });
}
// Envía texto a un JID (grupo o número) por la voz de MaKo. Best-effort.
// delayMs: override del "escribiendo…" (default = anti-ban proporcional al texto).
async function enviarTextoVozMaKo(jidONumero: string, texto: string, delayMs?: number): Promise<{ ok: boolean; id: string }> {
  const delay = delayMs ?? Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const r = await ev(`/message/sendText/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ number: jidONumero, text: texto, delay }),
  });
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  return { ok: r.ok, id };
}
async function ponerNombre(jid: string, subject: string): Promise<void> {
  await ev(`/group/updateGroupSubject/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ subject }),
  });
}
async function ponerDescripcion(jid: string, description: string): Promise<void> {
  await ev(`/group/updateGroupDescription/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    method: 'POST', body: JSON.stringify({ description }),
  });
}

export type AsegurarResult =
  | { ok: true; jid: string; creado: boolean }
  | { ok: false; error: string };

/**
 * Deja listo el grupo "MaKo <> {nombre}" del workspace: lo crea si no existe (o
 * adopta uno ya creado), le pone la estrella + descripción, y guarda el JID.
 * Idempotente: si ya hay JID guardado (o `adoptarJid`), solo refresca marca.
 *   participantes: números del cliente a sumar (la voz de MaKo ya es el creador).
 */
export async function asegurarGrupoMaKo(
  ws: number,
  opts: { nombre: string; participantes?: string[]; adoptarJid?: string; bienvenida?: boolean },
): Promise<AsegurarResult> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const subject = `MaKo <> ${opts.nombre.trim()}`;
  const desc = descripcionGrupoMaKo(opts.nombre);

  let jid = opts.adoptarJid?.trim() || (await getGrupoJidMaKo(ws));

  if (jid) {
    // Ya existe → refrescar marca (nombre + foto + descripción), best-effort.
    await ponerNombre(jid, subject);
    await ponerDescripcion(jid, desc);
    await ponerFoto(jid);
    await guardarGrupoJid(ws, jid);
    return { ok: true, jid, creado: false };
  }

  // Crear el grupo desde la voz de MaKo.
  const participants = (opts.participantes ?? []).map(soloDigitos).filter(Boolean);
  const r = await ev(`/group/create/${await instanciaVoz()}`, {
    method: 'POST',
    body: JSON.stringify({ subject, description: desc, participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid, 'gold');
  await guardarGrupoJid(ws, jid);
  // Mensaje de bienvenida (best-effort: no rompe si el envío falla).
  if (opts.bienvenida !== false) await enviarTextoVozMaKo(jid, mensajeBienvenidaMaKo(opts.nombre));
  return { ok: true, jid, creado: true };
}

/** Agrega un número al grupo de MaKo del workspace (cambio de número del dueño). */
/**
 * ¿Este número existe en WhatsApp? Es la pregunta que separa un teléfono de una
 * cadena de dígitos, y la respuesta es barata (`POST /chat/whatsappNumbers`).
 *
 * Medido el 21/8/2026 contra la API real:
 *   542233550684 → exists:true    ·    2233550684 → exists:false
 * O sea: el MISMO teléfono sin el código de país no existe.
 *
 * `consultado: false` = no se pudo preguntar (Evolution caído, sin configurar).
 * Se devuelve aparte de `existe` a propósito: «no pude averiguarlo» NO es «no
 * existe», y quien llama tiene que poder intentar igual en vez de rechazar a
 * alguien por una caída nuestra.
 */
export async function numeroTieneWhatsApp(
  numero: string,
): Promise<{ consultado: boolean; existe: boolean; canonico: string | null }> {
  const num = soloDigitos(numero);
  if (!num) return { consultado: true, existe: false, canonico: null };
  const r = await ev(`/chat/whatsappNumbers/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ numbers: [num] }),
  });
  if (!r.ok || !Array.isArray(r.body)) return { consultado: false, existe: false, canonico: null };
  const fila = (r.body as Array<{ exists?: boolean; jid?: string }>)[0];
  // ⚠️ EL DATO QUE ESTA CONSULTA REGALA Y ANTES SE TIRABA: el jid con el que
  // WhatsApp conoce de verdad a esa persona. Medido el 24/8/2026, las TRES formas
  // del mismo teléfono resuelven al mismo jid:
  //
  //   5402233550684  ┐
  //    542233550684  ├─→  5492233550684@s.whatsapp.net   (exists: true)
  //   5492233550684  ┘
  //
  // `whatsappNumbers` normaliza (le saca el 0 de tránsito, le pone el 9 móvil de
  // Argentina) y `updateParticipant` NO: mandarle el crudo `5402233550684`
  // contesta HTTP 400. O sea que se verificaba con una forma y se actuaba con
  // otra — exactamente el bug del prefijo `act_` de Meta, con otro proveedor.
  const canonico = typeof fila?.jid === 'string' ? soloDigitos(fila.jid.split('@')[0]) : null;
  return { consultado: true, existe: Boolean(fila?.exists), canonico: canonico || null };
}

// ── El TOPE de la línea de MaKo (auditoría de seguridad del 14/10/2026) ──────────
// La línea es UNA para toda la plataforma y cualquier admin la hacía escribirle a cualquier
// número, sin tope. Todo lo que TOCA un número nuevo —código por DM, alta en el grupo, invitación—
// pasa por acá: el número tiene que existir en WhatsApp y el workspace tiene que tener cupo
// (lib/mako-linea-tope.ts, con el porqué de los números). Sin poder contar, no sale.

const almacenTope = (ws: number): AlmacenTope => ({
  tocadoReciente: (num) => salioReciente(ws, 'linea-mako-numero', VENTANA_LINEA_MIN, num),
  reclamarCasillero: (i) => reclamarEspaciado(ws, `linea-mako:${i}`, VENTANA_LINEA_MIN),
  marcar: async (num) => { await reclamarEspaciado(ws, 'linea-mako-numero', VENTANA_LINEA_MIN, num); },
});

async function cupoLinea(ws: number, num: string, siempre = false): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return (await reclamarContactoLinea(almacenTope(ws), soloDigitos(num), { siempre })) ? { ok: true } : { ok: false, error: SIN_CUPO_LINEA };
  } catch (e) {
    console.error(`[mako-grupo] no pude contar el tope de la línea (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude comprobar el tope de mensajes. Prueba de nuevo en un momento.' };
  }
}

type ContactoListo = { ok: true; num: string; destino: string } | { ok: false; error: string };

/**
 * Antes de que la línea de MaKo toque un número: que no sea uno que WhatsApp dice que NO existe
 * —y con la forma que WhatsApp reconoce— y que el workspace tenga cupo. `siempre`: gasta cupo
 * aunque el número ya se haya tocado en la ventana (el código: reenviarlo es otro mensaje a esa
 * persona).
 *
 * Si la consulta no se pudo hacer, se intenta igual: «no pude averiguarlo» no es «no existe», y
 * una caída nuestra no deja afuera a gente real (lo fija tests/destinatarios-telefono.test.ts).
 * Pero el intento CUENTA en el tope igual: el cupo es lo que frena el bucle, no la consulta.
 */
async function prepararContacto(ws: number, numero: string, opts: { siempre?: boolean } = {}): Promise<ContactoListo> {
  const crudo = soloDigitos(numero);
  if (!crudo) return { ok: false, error: 'número inválido' };
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const chequeo = await numeroTieneWhatsApp(crudo);
  if (chequeo.consultado && !chequeo.existe) {
    return { ok: false, error: 'Ese número no tiene WhatsApp. Revisa que esté con el código de país.' };
  }
  // Se ACTÚA con la forma que WhatsApp reconoce, no con la que se tipeó (ver numeroTieneWhatsApp).
  const num = chequeo.canonico ?? crudo;
  const cupo = await cupoLinea(ws, num, opts.siempre);
  if (!cupo.ok) return cupo;
  // Como jid COMPLETO cuando lo dio WhatsApp: crudo, Evolution le borra el 9 de Argentina y el 1
  // de México y el pedido va a otro número (`jidCanonico`, lib/participantes-grupo.ts).
  const destino = chequeo.canonico ? jidCanonico(chequeo.canonico) : num;
  return { ok: true, num, destino };
}

/** Lo que contesta `enviarInvitacionGrupo` cuando a ese número ya se le mandó dentro de la ventana. */
const YA_INVITADO = 'ya se le mandó la invitación hace un rato';

/** El link `chat.whatsapp.com/…` del grupo de un workspace. null si no se pudo. */
export async function linkInvitacionGrupo(ws: number): Promise<string | null> {
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return null;
  const r = await ev(`/group/inviteCode/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`);
  if (!r.ok) return null;
  const b = r.body as { inviteUrl?: string; inviteCode?: string };
  return b?.inviteUrl ?? (b?.inviteCode ? `https://chat.whatsapp.com/${b.inviteCode}` : null);
}

/**
 * Le MANDA por WhatsApp el link de invitación al grupo.
 *
 * ⚠️ Esto es lo que hay que llamar para que a alguien «le llegue una invitación».
 * El `add_request` que viene adentro del 403 de `updateParticipant` NO es un
 * envío: es un token que WhatsApp ofrece por si querés usarlo. Se leyó como si
 * fuera un envío y la pantalla llegó a decirle a un cliente «le llegó una
 * invitación para entrar al grupo» cuando MaKo no había mandado nada. Afirmar un
 * envío que no ocurrió es peor que no poder hacerlo: manda a esperar algo que no
 * va a llegar.
 */
export async function enviarInvitacionGrupo(ws: number, numero: string): Promise<{ ok: boolean; error?: string }> {
  // Un jid completo viaja tal cual (ver `jidCanonico`); un número suelto, en dígitos.
  const num = numero.includes('@') ? numero.trim() : soloDigitos(numero);
  const jid = await getGrupoJidMaKo(ws);
  if (!num || !jid) return { ok: false, error: 'sin número o sin grupo' };
  // Es un DM desde la línea de MaKo: cuenta en el tope del workspace (gratis si a ese número ya se
  // lo tocó en la ventana, que es el caso de `agregarParticipanteGrupo`) y sale UNA vez por número
  // y ventana — reintentar el alta no puede ser una invitación por intento al mismo desconocido.
  const cupo = await cupoLinea(ws, num);
  if (!cupo.ok) return cupo;
  let primera: boolean;
  try { primera = await reclamarEspaciado(ws, 'linea-mako-invitacion', VENTANA_LINEA_MIN, soloDigitos(num)); }
  catch { return { ok: false, error: 'No pude comprobar el tope de mensajes. Prueba de nuevo en un momento.' }; }
  if (!primera) return { ok: false, error: YA_INVITADO };
  const r = await ev(`/group/sendInvite/${await instanciaVoz()}`, {
    method: 'POST',
    body: JSON.stringify({
      groupJid: jid,
      description: 'Te sumo al grupo donde MaKo deja los avisos de tu negocio.',
      numbers: [num],
    }),
  });
  return r.ok ? { ok: true } : { ok: false, error: `Evolution ${r.status}` };
}

// El lector del resultado POR PARTICIPANTE vive en `lib/participantes-grupo.ts`, sin
// `server-only`, para que tenga test y lo compartan las dos puntas que agregan gente a un
// grupo (acá y `lib/mako-chat.ts`). Ahí está también el porqué: Evolution contesta HTTP 200
// con el fallo adentro del body.

export type AltaParticipante = {
  ok: boolean;
  error?: string;
  /** Se le mandó el link de invitación por WhatsApp (porque no se pudo agregar directo). */
  invitado?: boolean;
  /** El link del grupo, para poder pasárselo a mano si el envío tampoco salió. */
  link?: string | null;
};

export async function agregarParticipanteGrupo(ws: number, numero: string): Promise<AltaParticipante> {
  const crudo = soloDigitos(numero);
  if (!crudo) return { ok: false, error: 'número inválido' };
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, error: 'este negocio todavía no tiene grupo de MaKo' };

  // Preguntar ANTES sale más barato que un intento que contesta 200 y no hace
  // nada, y sobre todo permite decir POR QUÉ. Y cuenta en el tope de la línea
  // (`prepararContacto`): sin cupo, no se toca a nadie.
  const c = await prepararContacto(ws, crudo);
  if (!c.ok) return { ok: false, error: c.error };
  return sumarAlGrupo(ws, jid, c.destino);
}

/** El alta en sí, con el número YA validado y contado (`prepararContacto`). */
async function sumarAlGrupo(ws: number, jid: string, destino: string): Promise<AltaParticipante> {
  const r = await ev(`/group/updateParticipant/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`, {
    // `destino` llega como jid COMPLETO cuando lo dio WhatsApp (ver `prepararContacto`).
    method: 'POST', body: JSON.stringify({ action: 'add', participants: [destino] }),
  });
  if (!r.ok) return { ok: false, error: `No se pudo hablar con WhatsApp (Evolution ${r.status}).` };

  const res = leerResultadoParticipante(r.body);
  if (res.ok) return res;

  // ── No se pudo agregar directo: entonces se INVITA de verdad ────────────────
  // Que WhatsApp no nos deje sumarlo no significa que no se pueda hacer nada; lo
  // que no se puede es hacerlo en silencio y contarlo como si hubiera pasado.
  const envio = await enviarInvitacionGrupo(ws, destino);
  const link = await linkInvitacionGrupo(ws);
  return {
    ok: false,
    invitado: envio.ok,
    link,
    error: envio.ok
      ? `${res.error} Le mandé el link de invitación por WhatsApp.`
      : envio.error === YA_INVITADO
        ? `${res.error} Ya le mandé la invitación hace un rato; si no le llegó, pásale el link tú.`
        : `${res.error} Tampoco pude mandarle la invitación, así que pásale el link tú.`,
  };
}

// ── Número del dueño por workspace (destinatario del grupo) ───────────────────
export async function getNumeroDueno(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSetting(KEY_NUMERO_DUENO));
}
async function guardarNumeroDueno(ws: number, numero: string): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_NUMERO_DUENO, numero));
}

/**
 * Setea/cambia el número del dueño de un workspace y sincroniza el grupo:
 *   · sin grupo aún  → crea el grupo "MaKo <> {cliente}" con ese número + bienvenida.
 *   · grupo ya hecho → agrega el nuevo número al grupo (no recrea).
 * Guarda el número en app_settings. Devuelve qué hizo.
 *
 * ⚠️ SE VALIDA Y SE CUENTA ANTES DE GUARDAR NADA (auditoría del 14/10/2026). Antes el número se
 * guardaba como dueño en la primera línea, sin mirar nada, y se lo sumaba al grupo: con un bucle
 * de números distintos, cada uno era un desconocido agregado (o invitado por DM) por la línea de
 * MaKo. Ahora el número tiene que existir en WhatsApp y el workspace tener cupo
 * (`prepararContacto`); recién ahí se guarda, en la forma que WhatsApp reconoce.
 */
export async function setNumeroDuenoYSync(
  ws: number, numero: string, nombreCliente: string,
): Promise<{ ok: true; accion: 'grupo_creado' | 'numero_agregado' | 'sin_cambios'; jid?: string } | { ok: false; error: string }> {
  const crudo = soloDigitos(numero);
  if (!crudo) return { ok: false, error: 'número inválido' };
  const anterior = soloDigitos((await getNumeroDueno(ws)) ?? '');
  const jid = await getGrupoJidMaKo(ws);
  // El mismo número con el grupo ya hecho: no hay a quién tocar.
  if (jid && crudo === anterior) return { ok: true, accion: 'sin_cambios', jid };

  const c = await prepararContacto(ws, crudo);
  if (!c.ok) return { ok: false, error: c.error };
  await guardarNumeroDueno(ws, c.num);

  if (!jid) {
    const r = await asegurarGrupoMaKo(ws, { nombre: nombreCliente, participantes: [c.num] });
    return r.ok ? { ok: true, accion: 'grupo_creado', jid: r.jid } : { ok: false, error: r.error };
  }
  // Tipeado distinto, pero WhatsApp dice que es el mismo de antes.
  if (c.num === anterior) return { ok: true, accion: 'sin_cambios', jid };
  const a = await sumarAlGrupo(ws, jid, c.destino);
  return a.ok ? { ok: true, accion: 'numero_agregado', jid } : { ok: false, error: a.error ?? 'no se pudo agregar' };
}

// ── Verificación del teléfono de reportes (código por WhatsApp) ──────────────
// El onboarding no deja pasar a conectar Meta sin que el dueño confirme que ESE
// número recibe de verdad los mensajes de MaKo: se le manda un código de 6
// dígitos y tiene que cargarlo de vuelta.
//
// ⚠️ EL CÓDIGO VA POR DM, Y AL GRUPO SE ENTRA DESPUÉS (14/10/2026). Antes se creaba o
// sincronizaba el grupo con el número tipeado y el código se escribía ADENTRO del grupo: o sea
// que la línea de MaKo sumaba a su grupo —o invitaba por DM— a un número que nadie había
// probado que fuera de quien lo escribió (auditoría de seguridad). Ahora el código le llega por
// DM a ese número, y recién cuando vuelve bien `verificarCodigoContacto` lo suma al grupo.
// La pantalla ya decía «Te escribimos por WhatsApp a <número>»: sigue siendo cierto.
const KEY_VERIFICACION = 'mako.contacto.verificacion';
const MINUTOS_EXPIRA_CODIGO = 15;
/** `destino`: el número en la forma de WhatsApp (o su jid). `nombre`: el del negocio, para armar
 *  el grupo al verificar. Los dos faltan en un estado anterior al 14/10/2026. */
type EstadoVerificacion = { telefono: string; codigo: string; expira: number; verificado: boolean; destino?: string; nombre?: string };

const MAKO_SIN_LINEA = 'MaKo no puede escribir por WhatsApp en este momento, y es de nuestro lado. Tu número sigue sin verificar por ahora — te queda pendiente y lo resuelves después.';

/** Un DM por la voz de MaKo, con el motivo si no sale (para distinguir la sesión caída). */
async function enviarDmVozMaKo(destino: string, texto: string): Promise<EnvioGrupo> {
  const delay = Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const instancia = await instanciaVoz();
  const r = await ev(`/message/sendText/${instancia}`, {
    method: 'POST', body: JSON.stringify({ number: destino, text: texto, delay }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status} en ${instancia}: ${detalleEv(r.body)}` };
  return { ok: true, id: (r.body as { key?: { id?: string } })?.key?.id ?? '' };
}

async function getVerificacion(ws: number): Promise<EstadoVerificacion | null> {
  const raw = await runWithWorkspace(ws, () => getSetting(KEY_VERIFICACION));
  if (!raw) return null;
  try { return JSON.parse(raw) as EstadoVerificacion; } catch { return null; }
}
async function guardarVerificacion(ws: number, v: EstadoVerificacion): Promise<void> {
  await runWithWorkspace(ws, () => setSetting(KEY_VERIFICACION, JSON.stringify(v)));
}

/** Estado actual (para hidratar el wizard: si ya está verificado no hay que re-pedir). */
export async function getEstadoVerificacionContacto(ws: number): Promise<{ telefono: string; verificado: boolean }> {
  const v = await getVerificacion(ws);
  return v ? { telefono: v.telefono, verificado: v.verificado } : { telefono: '', verificado: false };
}

/**
 * Le manda POR DM un código de 6 dígitos al número para verificarlo. NO toca el grupo: eso lo
 * hace `verificarCodigoContacto` cuando el código vuelve bien. Si el número YA está verificado
 * (revisita de la pantalla con el mismo teléfono), no reenvía nada.
 *
 * Cada envío GASTA cupo de la línea (`siempre`), aunque sea al mismo número: reenviar el código es
 * otro mensaje a esa persona.
 */
export async function enviarCodigoVerificacion(
  ws: number, telefono: string, nombreCliente: string,
): Promise<{ ok: true; yaVerificado: boolean } | { ok: false; error: string }> {
  const num = soloDigitos(telefono);
  if (!num) return { ok: false, error: 'El número no es válido.' };

  const actual = await getVerificacion(ws);
  if (actual?.verificado && soloDigitos(actual.telefono) === num) return { ok: true, yaVerificado: true };

  const c = await prepararContacto(ws, num, { siempre: true });
  if (!c.ok) return { ok: false, error: c.error };

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  await guardarVerificacion(ws, {
    telefono: num, destino: c.destino, nombre: nombreCliente,
    codigo, expira: Date.now() + MINUTOS_EXPIRA_CODIGO * 60_000, verificado: false,
  });

  const mensaje = `Tu código de verificación de MaKo es *${codigo}*. Vence en ${MINUTOS_EXPIRA_CODIGO} minutos — introdúcelo en la configuración para confirmar este número.`;
  const envio = await enviarDmVozMaKo(c.destino, mensaje);
  // ⚠️ DE QUIÉN ES EL PROBLEMA CAMBIA EL MENSAJE ENTERO. Con la sesión de WhatsApp de MaKo caída,
  // el cliente no tiene NADA que hacer, y un volcado de JSON —«Evolution 500: {"status":500…}»—
  // en el paso donde acaba de escribir su teléfono se lee como que lo escribió mal.
  if (!envio.ok) return { ok: false, error: esSesionCaida(envio.error) ? MAKO_SIN_LINEA : `No se pudo enviar el código por WhatsApp: ${envio.error}` };
  return { ok: true, yaVerificado: false };
}

/**
 * Compara el código cargado contra el vigente. Si coincide y no venció, RECIÉN AHÍ —con el
 * número probado— lo suma al grupo de MaKo (o arma el grupo con él) y lo marca verificado.
 * Si el grupo no sale, no queda verificado: el mismo código sirve para reintentar mientras no
 * venza (y si WhatsApp no lo dejó agregar, ya le llegó la invitación).
 */
export async function verificarCodigoContacto(ws: number, codigo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getVerificacion(ws);
  if (!v) return { ok: false, error: 'Todavía no se envió ningún código.' };
  if (Date.now() > v.expira) return { ok: false, error: 'El código expiró. Solicita uno nuevo.' };
  if (codigo.trim() !== v.codigo) return { ok: false, error: 'El código no coincide.' };
  if (!v.verificado) {
    const nombre = v.nombre?.trim() || (await getWorkspace(ws).catch(() => null))?.nombre || 'tu negocio';
    const sync = await setNumeroDuenoYSync(ws, v.destino || v.telefono, nombre);
    if (!sync.ok) {
      return {
        ok: false,
        error: esSesionCaida(sync.error) ? MAKO_SIN_LINEA : `El código es correcto, pero no pude sumarte al grupo de WhatsApp de MaKo: ${sync.error}`,
      };
    }
  }
  await guardarVerificacion(ws, { ...v, verificado: true });
  return { ok: true };
}

// ── Grupo del SuperAdmin (global, estrella AZUL) ──────────────────────────────
export async function getGrupoSuperAdminJid(): Promise<string | null> {
  return runWithWorkspace(OWNER_WS, () => getSetting(KEY_GRUPO_SUPERADMIN));
}
async function guardarGrupoSuperAdmin(jid: string): Promise<void> {
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_GRUPO_SUPERADMIN, jid));
}

/** Deja listo el grupo del SuperAdmin: nombre + estrella AZUL + descripción + JID. */
export async function asegurarGrupoSuperAdmin(
  opts: { nombre?: string; adoptarJid?: string } = {},
): Promise<AsegurarResult> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const subject = opts.nombre?.trim() || 'MaKo · SuperAdmin';
  const jid = opts.adoptarJid?.trim() || (await getGrupoSuperAdminJid());
  if (!jid) return { ok: false, error: 'no hay grupo de SuperAdmin para adoptar (pasa adoptarJid)' };
  await ponerNombre(jid, subject);
  await ponerDescripcion(jid, DESC_SUPERADMIN);
  await ponerFoto(jid, 'blue');
  await guardarGrupoSuperAdmin(jid);
  return { ok: true, jid, creado: false };
}

/** Manda un texto al grupo del SuperAdmin. */
export async function enviarAlGrupoSuperAdmin(texto: string): Promise<EnvioGrupo> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const jid = await getGrupoSuperAdminJid();
  if (!jid) return { ok: false, error: 'no hay grupo de SuperAdmin todavía' };
  const r = await enviarTextoVozMaKo(jid, texto);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

// ── Grupo suelto (pruebas): crear sin persistir + postear a un JID cualquiera ──
/** Crea un grupo (estrella dorada) SIN guardarlo como grupo de ningún workspace. */
export async function crearGrupoSuelto(
  subject: string, participantes: string[], descripcion?: string,
): Promise<{ ok: true; jid: string } | { ok: false; error: string }> {
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const participants = (participantes ?? []).map(soloDigitos).filter(Boolean);
  const r = await ev(`/group/create/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ subject, description: descripcion ?? '', participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  const jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid, 'gold');
  return { ok: true, jid };
}

/**
 * Manda un texto a UNA PERSONA (su número), con la voz de MaKo. Se usa para pasarle a
 * un colaborador las tareas que asumió en una reunión: le llega de MaKo, no del número
 * de ventas del negocio.
 */
export async function enviarAPersonaMaKo(telefono: string, texto: string): Promise<EnvioGrupo> {
  const num = soloDigitos(telefono);
  if (!num) return { ok: false, error: 'teléfono inválido' };
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const r = await enviarTextoVozMaKo(num, texto);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

/** Manda un texto a un JID de grupo cualquiera. delayMs opcional (demo = chico). */
export async function enviarAGrupoJid(jid: string, texto: string, delayMs?: number): Promise<EnvioGrupo> {
  if (!jid || !texto.trim()) return { ok: false, error: 'faltan jid o texto' };
  const r = await enviarTextoVozMaKo(jid, texto, delayMs);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

export type EnvioGrupo = { ok: true; id: string } | { ok: false; error: string };

/** Saca el mensaje útil del body de error de Evolution (viene anidado y variado). Vive en lib/mako-tarjeta.ts
 *  (puro): lo usa también el envío por partes. */
const detalleEv = detalleEvolution;

/** Manda un texto al grupo de MaKo del workspace (para el ruteo de avisos). */
export async function enviarAlGrupoMaKo(ws: number, texto: string): Promise<EnvioGrupo> {
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, error: 'el workspace no tiene grupo de MaKo todavía' };
  const delay = Math.round(Math.min(1500 + texto.length * 45, 9000) * (0.8 + Math.random() * 0.4));
  const instancia = await instanciaVoz();
  const r = await ev(`/message/sendText/${instancia}`, {
    method: 'POST', body: JSON.stringify({ number: jid, text: texto, delay }),
  });
  // El motivo, no solo el número: un 400 acá casi siempre es "la sesión de esa
  // instancia está caída" y con "Evolution 400" a secas eso no se deduce.
  if (!r.ok) return { ok: false, error: `Evolution ${r.status} en ${instancia}: ${detalleEv(r.body)}` };
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  return { ok: true, id };
}

/**
 * MANDA VARIAS PARTES (texto, nota de voz, archivo) AL GRUPO DE MAKO DEL WORKSPACE, en orden y por la línea
 * de MaKo (`instanciaVoz`). Es el envío de la tarjeta «MaKo en WhatsApp» por partes (undécima tanda,
 * lib/mako-tarjeta.ts): las partes llegan PREPARADAS (los datos resueltos y los binarios ya bajados).
 *
 * ⚠️ Las funciones de Evolution para LEADS no sirven acá (lib/evolution.ts): le sacan al número todo lo que
 * no es dígito —un JID de grupo deja de serlo— y salen por la línea del NEGOCIO, no por la de MaKo.
 * ⚠️ Una parte salió sólo con su `key.id`, y corta en la primera que falla (`enviarPartesPorEv`).
 *
 * `d.ev` se inyecta en el test; en producción es el `ev` de este archivo.
 */
export async function enviarPartesAlGrupoMaKo(
  ws: number, partes: readonly PartePreparada[], d: { ev?: EvFn; esperar?: (ms: number) => Promise<void> } = {},
): Promise<EnvioPartes> {
  const jid = await getGrupoJidMaKo(ws);
  if (!jid) return { ok: false, salieron: 0, ids: [], error: 'el workspace no tiene grupo de MaKo todavía' };
  return enviarPartesAJid(jid, partes, d);
}

/** Lo mismo, a un JID cualquiera (el chat de MaKo de /agencia manda un audio o un archivo suelto por acá). */
export async function enviarPartesAJid(
  jid: string, partes: readonly PartePreparada[], d: { ev?: EvFn; esperar?: (ms: number) => Promise<void>; delayMs?: number } = {},
): Promise<EnvioPartes> {
  if (!d.ev && !grupoConfigurado()) return { ok: false, salieron: 0, ids: [], error: 'Evolution no configurado' };
  return enviarPartesPorEv(jid, partes, { ev: d.ev ?? ev, instancia: await instanciaVoz(), esperar: d.esperar, delayMs: d.delayMs });
}

/**
 * Reacciona a un mensaje del grupo con un emoji.
 *
 * Pedido del dueño (25/8/2026): risa o corazón a los stickers, y un 👍 a cada
 * petición «para afirmar que la recibió». Una reacción es el acuse más barato que
 * hay — no ocupa un renglón del chat, no interrumpe y se ve al instante.
 *
 * Best-effort a propósito: si la reacción no sale, el turno sigue igual. Fallar en
 * el acuse no puede costar la respuesta.
 */
export async function reaccionarMensaje(
  jid: string,
  key: { id?: string; fromMe?: boolean; remoteJid?: string } | undefined,
  emoji: string,
): Promise<boolean> {
  if (!jid || !key?.id) return false;
  const r = await ev(`/message/sendReaction/${await instanciaVoz()}`, {
    method: 'POST',
    body: JSON.stringify({
      key: { remoteJid: key.remoteJid ?? jid, fromMe: Boolean(key.fromMe), id: key.id },
      reaction: emoji,
    }),
  });
  if (!r.ok) console.warn(`[mako-grupo] reacción ${emoji} falló: Evolution ${r.status}`);
  return r.ok;
}
