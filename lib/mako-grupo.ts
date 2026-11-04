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
import { cambiarSettingSi, getSetting, getSettingEstricto, setSetting } from './settings';
import { runWithWorkspace, OWNER_WS, getWorkspace, wsSuperAdmin } from './workspace';
import { leerResultadoParticipante, jidCanonico } from './participantes-grupo';
import { detalleEvolution, enviarPartesPorEv, type EnvioPartes, type EvFn, type PartePreparada } from './mako-tarjeta';
import { linksConWs, partesConLinksDeWs } from './links-con-ws';
import { APP_BASE_URL } from './app-url';
import { reclamarEspaciado, salioReciente } from './espaciado';
import { reclamarContactoLinea, SIN_CUPO_ALTAS_LINEA, SIN_CUPO_LINEA, TOPE_ALTAS_DIA_LINEA, TOPE_ALTAS_POR_LINEA, VENTANA_ALTAS_DIA_LINEA_MIN, VENTANA_ALTAS_LINEA_MIN, VENTANA_LINEA_MIN, type AlmacenTope } from './mako-linea-tope';
import { ALTAS_FRENADAS, AUTOMATICO_APAGADO, KEY_ALTAS_EN_GRUPOS, KEY_GRUPOS_AUTOMATICO, SIN_INVITACION, altasFrenadas, automaticoPrendido } from './altas-en-grupos';
import { getSupabaseServer } from './supabase';
import { agenciasAprobadasDe } from './agencia';
import { KEY_VOZ_INSTANCIA } from './linea-plataforma';
import { lineaDeLaAgencia, quienesFaltan, telefonoDeParticipante, telefonosDelEquipo, type MiembroAgencia } from './agencia-equipo-grupo';
import { MINUTOS_ENTRANTE, codigoDelTexto, codigoNuevo, decidirCodigoTipeado, decidirLlegada, linkWaMe, textoParaMandar, vistaDeEntrante, type EstadoVerificacion, type VistaEntrante } from './verificacion-entrante';
import { chatDelMensaje } from './mako-bot-reglas';
import { MISMO_TEXTO_A_MUCHOS, NO_LE_ESCRIBE_PRIMERO, TOPE_MISMO_TEXTO, VENTANA_MISMO_TEXTO_MIN, huellaDeTexto, pausaDeEscritura, puedeEscribirleAPersona } from './mako-salida-reglas';
import { antesDeEscribir, trasEscribir } from './linea-freno';

const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EVOLUTION_API_KEY || '';

/** Instancia de Evolution que le pone la voz a MaKo por defecto (número de Martín
 *  cargado en ws1). El canal propio de SuperAdmin (mako_superadmin) la reemplaza
 *  al conectarse por QR — se elige en runtime con la setting mako.voz.instancia. */
export const INSTANCIA_VOZ_DEFAULT = 'mako_ws1';
export { KEY_VOZ_INSTANCIA };

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

/** El freno de emergencia. Sin el setting, o sin poder leerlo, MaKo crea grupos y suma gente (lib/altas-en-grupos.ts). */
export async function altasEnGrupos(): Promise<boolean> {
  try {
    const ws = await wsSuperAdmin();
    return !altasFrenadas(await runWithWorkspace(ws, () => getSettingEstricto(KEY_ALTAS_EN_GRUPOS)));
  } catch (e) {
    console.error(`[mako-grupo] no pude leer el freno de las altas en grupos, sigo sin freno: ${e instanceof Error ? e.message : String(e)}`);
    return true;
  }
}

/** Lo que sale sin que nadie lo pida para esa persona. Apagado salvo que Martín lo prenda; sin poder leerlo, apagado (lib/altas-en-grupos.ts). */
async function gruposAutomaticos(): Promise<boolean> {
  try {
    const ws = await wsSuperAdmin();
    return automaticoPrendido(await runWithWorkspace(ws, () => getSettingEstricto(KEY_GRUPOS_AUTOMATICO)));
  } catch (e) {
    console.error(`[mako-grupo] no pude leer si lo automático de los grupos está prendido: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

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
  // ⛔ La línea frenada no escribe (4/11/2026, lib/linea-freno.ts), y una señal de riesgo la frena: la misma regla que `evFetch`.
  const frenada = await antesDeEscribir(path).catch(() => null);
  if (frenada) return { ok: false, status: 0, body: frenada };
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
    if (!r.ok) await trasEscribir(path, r.status, body).catch(() => null);
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

/**
 * EL GRUPO, CON «NO PUDE LEER» DISTINTO DE «NO TIENE» (17/10/2026): un error de lectura TIRA. `getGrupoJidMaKo` lo
 * convierte en null (`getSetting`), y desde que la tarjeta MaKo hace algo cuando el negocio no tiene grupo (por email,
 * `SinGrupo`, lib/mako-tarjeta.ts), un bache de la base mandaría un correo por cada aviso de cada negocio. Lo leen los
 * dos envíos al grupo del negocio, y de ahí sale el marcador `sinGrupo`.
 */
export async function grupoJidEstricto(ws: number): Promise<string | null> {
  return runWithWorkspace(ws, () => getSettingEstricto(KEY_GRUPO_JID));
}

/** El motivo de un envío sin grupo. Se decide por el marcador `sinGrupo`, nunca comparando este texto. */
export const SIN_GRUPO_MAKO = 'el negocio no tiene grupo de MaKo';
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
/**
 * EL MISMO TEXTO A MUCHOS CHATS (4/11/2026, regla 4 de lib/mako-salida-reglas.ts): por la línea de MaKo, un texto idéntico no sale a
 * más de `TOPE_MISMO_TEXTO` chats distintos por hora. El FAQ de WhatsApp sugiere los anuncios de una comunidad en vez de repetir lo
 * mismo en varios grupos. Sin poder contar, sale: esto es una red y no la puerta (la línea frenada sí corta).
 */
async function cupoMismoTexto(destino: string, texto: string): Promise<boolean> {
  const huella = huellaDeTexto(texto);
  if (!huella) return true;
  try {
    const ws = await wsSuperAdmin();
    const linea = await instanciaVoz();
    const alm: AlmacenTope = {
      tocadoReciente: (d) => salioReciente(ws, `linea-texto:${linea}:${huella}`, VENTANA_MISMO_TEXTO_MIN, d),
      reclamarCasillero: (i) => reclamarEspaciado(ws, `linea-texto:${linea}:${huella}:${i}`, VENTANA_MISMO_TEXTO_MIN),
      marcar: async (d) => { await reclamarEspaciado(ws, `linea-texto:${linea}:${huella}`, VENTANA_MISMO_TEXTO_MIN, d); },
    };
    return await reclamarContactoLinea(alm, destino, { tope: TOPE_MISMO_TEXTO });
  } catch (e) {
    console.error(`[mako-grupo] no pude contar el mismo texto: ${e instanceof Error ? e.message : String(e)}`);
    return true;
  }
}

async function enviarTextoVozMaKo(jidONumero: string, texto: string, delayMs?: number): Promise<{ ok: boolean; id: string; error?: string }> {
  // ⛔ REGLA 1: la línea de MaKo no le escribe primero a una persona que nunca le escribió (lib/mako-salida-reglas.ts).
  if (!jidONumero.endsWith('@g.us') && !puedeEscribirleAPersona({ leEscribio: await leEscribioALaLinea(jidONumero).catch(() => null) })) {
    console.warn(`[mako-grupo] no salió a ${jidONumero}: ${NO_LE_ESCRIBE_PRIMERO}`);
    return { ok: false, id: '', error: NO_LE_ESCRIBE_PRIMERO };
  }
  if (!(await cupoMismoTexto(jidONumero, texto))) {
    console.warn(`[mako-grupo] no salió a ${jidONumero}: ${MISMO_TEXTO_A_MUCHOS}`);
    return { ok: false, id: '', error: MISMO_TEXTO_A_MUCHOS };
  }
  const delay = delayMs ?? pausaDeEscritura(texto.length);
  const r = await ev(`/message/sendText/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ number: jidONumero, text: texto, delay }),
  });
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  // Lo que sale a un GRUPO, al anillo anti-eco (`anotarEnviadosAlGrupo`): por acá pasan `enviarAGrupoJid`, el grupo SuperAdmin y la
  // bienvenida (la verificación de 96e7840e8: esos dos quedaban afuera). Un número suelto no es un grupo del doer.
  if (r.ok && id && jidONumero.endsWith('@g.us')) await anotarEnviadosConTope(OWNER_WS, jidONumero, [id]);
  return { ok: r.ok, id, ...(r.ok ? {} : { error: `Evolution ${r.status}` }) };
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

  // Un jid que no es de grupo, guardado como «el grupo», haría que todos los avisos del negocio le lleguen a esa persona (4/11/2026).
  if (opts.adoptarJid && !opts.adoptarJid.trim().endsWith('@g.us')) return { ok: false, error: 'Eso no es un grupo de WhatsApp (termina en @g.us).' };
  let jid = opts.adoptarJid?.trim() || (await getGrupoJidMaKo(ws));

  if (jid) {
    // Ya existe → refrescar marca (nombre + foto + descripción), best-effort.
    await ponerNombre(jid, subject);
    await ponerDescripcion(jid, desc);
    await ponerFoto(jid);
    await guardarGrupoJid(ws, jid);
    return { ok: true, jid, creado: false };
  }

  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS };

  // Crear el grupo desde la voz de MaKo.
  const participants = (opts.participantes ?? []).map(soloDigitos).filter(Boolean);
  // Sumar a alguien al crear el grupo es un alta más. Quien vino por `setNumeroDuenoYSync` ya está contado y no gasta otra vez.
  for (const p of participants) {
    const cupo = await cupoAltaDeLinea(p);
    if (!cupo.ok) return cupo;
  }
  const r = await ev(`/group/create/${await instanciaVoz()}`, {
    method: 'POST',
    body: JSON.stringify({ subject, description: desc, participants }),
  });
  if (!r.ok) return { ok: false, error: `Evolution ${r.status}: ${typeof r.body === 'string' ? r.body : JSON.stringify(r.body).slice(0, 200)}` };
  jid = extraerJid(r.body);
  if (!jid) return { ok: false, error: 'grupo creado pero sin JID en la respuesta' };
  await ponerFoto(jid, 'gold');
  await guardarGrupoJid(ws, jid);
  // El cliente de una agencia: su equipo entra al grupo que acaba de nacer (nunca tira: el grupo ya está creado y es del cliente).
  const equipo = await sumarEquipoDeAgenciaAlGrupo(ws, jid, { adentro: participants, cliente: opts.nombre });
  const deLaAgencia = lineaDeLaAgencia(equipo.agencias.map((a) => a.nombre), { entraron: equipo.entraron.length, invitados: equipo.invitados.length });
  // Mensaje de bienvenida (best-effort: no rompe si el envío falla).
  if (opts.bienvenida !== false) await enviarTextoVozMaKo(jid, deLaAgencia ? `${mensajeBienvenidaMaKo(opts.nombre)}\n\n${deLaAgencia}` : mensajeBienvenidaMaKo(opts.nombre));
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
    if (!(await reclamarContactoLinea(almacenTope(ws), soloDigitos(num), { siempre }))) return { ok: false, error: SIN_CUPO_LINEA };
  } catch (e) {
    console.error(`[mako-grupo] no pude contar el tope de la línea (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude comprobar el tope de mensajes. Prueba de nuevo en un momento.' };
  }
  return siempre ? { ok: true } : cupoAltaDeLinea(num);
}

/**
 * El tope de altas de TODA la línea, sumando todos los negocios (lib/mako-linea-tope.ts). Vive en el workspace de la plataforma y por nombre de línea:
 * si la voz cambia de número, el otro número no hereda ni libera el cupo. Sin poder contar, no sale: es la línea de todos.
 */
export async function cupoAltaDeLinea(num: string, instancia?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ws = await wsSuperAdmin();
    const linea = instancia ?? (await instanciaVoz());
    const alm: AlmacenTope = {
      tocadoReciente: (n) => salioReciente(ws, `linea-altas-numero:${linea}`, VENTANA_ALTAS_LINEA_MIN, n),
      reclamarCasillero: (i) => reclamarEspaciado(ws, `linea-altas:${linea}:${i}`, VENTANA_ALTAS_LINEA_MIN),
      marcar: async (n) => { await reclamarEspaciado(ws, `linea-altas-numero:${linea}`, VENTANA_ALTAS_LINEA_MIN, n); },
    };
    if (!(await reclamarContactoLinea(alm, soloDigitos(num), { tope: TOPE_ALTAS_POR_LINEA }))) return { ok: false, error: SIN_CUPO_ALTAS_LINEA };
    // Y por día (4/11/2026): 2 cada 10 minutos dejaba sumar 288 personas en un día. El mismo número no gasta dos veces.
    const dia: AlmacenTope = {
      tocadoReciente: (n) => salioReciente(ws, `linea-altas-dia-numero:${linea}`, VENTANA_ALTAS_DIA_LINEA_MIN, n),
      reclamarCasillero: (i) => reclamarEspaciado(ws, `linea-altas-dia:${linea}:${i}`, VENTANA_ALTAS_DIA_LINEA_MIN),
      marcar: async (n) => { await reclamarEspaciado(ws, `linea-altas-dia-numero:${linea}`, VENTANA_ALTAS_DIA_LINEA_MIN, n); },
    };
    return (await reclamarContactoLinea(dia, soloDigitos(num), { tope: TOPE_ALTAS_DIA_LINEA })) ? { ok: true } : { ok: false, error: SIN_CUPO_ALTAS_LINEA };
  } catch (e) {
    console.error(`[mako-grupo] no pude contar las altas de la línea: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude comprobar el tope de mensajes. Prueba de nuevo en un momento.' };
  }
}

/**
 * ¿Este número le escribió alguna vez a la línea? Se lee de la base de Evolution, sin hablar con WhatsApp. Sin poder saberlo, no: la pantalla da el link.
 * Se mira cada fila aunque se pida `fromMe: false`: si Evolution ignorara ese filtro, alguien a quien sólo le escribió MaKo contaría como que escribió.
 * ⚠️ Quien escribió bajo un `@lid` que Evolution no resolvió cuenta como que no escribió: recibe el link. Es el error barato.
 */
async function leEscribioALaLinea(num: string): Promise<boolean> {
  const remoteJid = num.includes('@') ? num.trim() : `${soloDigitos(num)}@s.whatsapp.net`;
  const r = await ev(`/chat/findMessages/${await instanciaVoz()}`, {
    method: 'POST', body: JSON.stringify({ where: { key: { remoteJid, fromMe: false } }, page: 1, offset: 20 }),
  });
  const filas = (r.body as { messages?: { records?: Array<{ key?: { fromMe?: boolean; remoteJid?: string } }> } } | null)?.messages?.records;
  return r.ok && Array.isArray(filas) && filas.some((f) => f.key?.fromMe === false && f.key?.remoteJid === remoteJid);
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
export async function enviarInvitacionGrupo(ws: number, numero: string, opts: { descripcion?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS };
  // Un jid completo viaja tal cual (ver `jidCanonico`); un número suelto, en dígitos.
  const num = numero.includes('@') ? numero.trim() : soloDigitos(numero);
  const jid = await getGrupoJidMaKo(ws);
  if (!num || !jid) return { ok: false, error: 'sin número o sin grupo' };
  // Es lo que salió 2 min 40 s antes del ban: un link por DM a alguien que nunca le había escrito a la línea. Desde el 4/11/2026,
  // NUNCA a quien no escribió, esté o no prendido lo automático (regla 2 de lib/mako-salida-reglas.ts): la pantalla da el link.
  if (!puedeEscribirleAPersona({ leEscribio: await leEscribioALaLinea(num).catch(() => null) })) return { ok: false, error: SIN_INVITACION };
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
      description: opts.descripcion ?? 'Te sumo al grupo donde MaKo deja los avisos de tu negocio.',
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
  /** Qué contestó WhatsApp: '409' = ya estaba adentro (`leerResultadoParticipante`). */
  status?: string;
};

export async function agregarParticipanteGrupo(ws: number, numero: string): Promise<AltaParticipante> {
  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS, link: await linkInvitacionGrupo(ws).catch(() => null) };
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
async function sumarAlGrupo(ws: number, jid: string, destino: string, opts: { invitacion?: string } = {}): Promise<AltaParticipante> {
  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS };
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
  const envio = await enviarInvitacionGrupo(ws, destino, { descripcion: opts.invitacion });
  const link = await linkInvitacionGrupo(ws);
  return {
    ok: false,
    invitado: envio.ok,
    link,
    error: envio.ok
      ? `${res.error} Le mandé el link de invitación por WhatsApp.`
      : envio.error === SIN_INVITACION
        ? `${res.error} ${SIN_INVITACION}`
      : envio.error === YA_INVITADO
        ? `${res.error} Ya le mandé la invitación hace un rato; si no le llegó, pásale el link tú.`
        : `${res.error} Tampoco pude mandarle la invitación, así que pásale el link tú.`,
  };
}

// ── El equipo de la agencia en el grupo de un cliente suyo (3/11/2026) ────────
// Lo puro y el porqué de a quién: lib/agencia-equipo-grupo.ts. No van a la lista de destinatarios del cliente: entran al grupo y nada
// más, así que no le aparecen en Notificaciones ni reciben los reportes por DM.

export type AgenciaConEquipo = { ws: number; nombre: string; telefonos: string[] };

/** Las agencias APROBADAS del cliente, con los teléfonos de quienes las administran. Tira si no pudo leer: «no sé» no es «no tiene». */
export async function equipoDeAgenciasDe(clienteWs: number): Promise<AgenciaConEquipo[]> {
  const out: AgenciaConEquipo[] = [];
  for (const ws of await agenciasAprobadasDe(clienteWs)) {
    const { data, error } = await getSupabaseServer().from('usuarios').select('nombre, perfil, rol_ws, estado').eq('workspace_id', ws);
    if (error) throw new Error(`no pude leer el equipo de la agencia ${ws}: ${error.message}`);
    const nombre = (await getWorkspace(ws).catch(() => null))?.nombre?.trim() || '';
    out.push({ ws, nombre, telefonos: telefonosDelEquipo((data ?? []) as MiembroAgencia[], await getNumeroDueno(ws)) });
  }
  return out;
}

/** Quiénes están en el grupo, por teléfono. null = no se pudo leer. Sólo lee: no le escribe a nadie. */
export async function telefonosEnElGrupo(jid: string): Promise<string[] | null> {
  const r = await ev(`/group/participants/${await instanciaVoz()}?groupJid=${encodeURIComponent(jid)}`);
  const lista = (r.body as { participants?: unknown } | null)?.participants;
  if (!r.ok || !Array.isArray(lista)) return null;
  return (lista as Array<Record<string, unknown>>).map(telefonoDeParticipante).filter(Boolean);
}

export type ResultadoEquipoAgencia = {
  agencias: Array<{ ws: number; nombre: string }>;
  entraron: string[];
  /** WhatsApp no dejó agregarlos y salió la invitación. */
  invitados: string[];
  fallaron: Array<{ telefono: string; motivo: string }>;
};

/**
 * Suma al grupo del cliente a quienes administran sus agencias. `adentro`: quienes se sabe que ya están. Lo llama la creación del grupo
 * y el comando para los grupos que ya existen (scripts/agencia-equipo-a-grupos.mts). NUNCA TIRA: una falla acá no puede dejar sin grupo
 * al cliente. Si no se puede leer la cartera no invita a nadie, y se dice en el log y en `fallaron`.
 */
export async function sumarEquipoDeAgenciaAlGrupo(clienteWs: number, jid: string, opts: { adentro?: readonly string[]; cliente?: string } = {}): Promise<ResultadoEquipoAgencia> {
  const res: ResultadoEquipoAgencia = { agencias: [], entraron: [], invitados: [], fallaron: [] };
  // Apagado por defecto: esto sale solo cuando nace un grupo, sin que nadie lo pida para esa persona (lib/altas-en-grupos.ts).
  if (!(await gruposAutomaticos()) || !(await altasEnGrupos())) return res;
  try {
    const equipos = await equipoDeAgenciasDe(clienteWs);
    res.agencias = equipos.map(({ ws, nombre }) => ({ ws, nombre }));
    const quien = opts.cliente?.trim();
    const invitacion = quien ? `Te sumo al grupo de MaKo de ${quien}.` : 'Te sumo al grupo de MaKo de tu cliente.';
    for (const t of quienesFaltan([...new Set(equipos.flatMap((e) => e.telefonos))], opts.adentro ?? [])) {
      const c = await prepararContacto(clienteWs, t);
      if (!c.ok) { res.fallaron.push({ telefono: t, motivo: c.error }); continue; }
      const a = await sumarAlGrupo(clienteWs, jid, c.destino, { invitacion });
      if (a.ok) { if (a.status !== '409') res.entraron.push(c.num); }
      else if (a.invitado) res.invitados.push(c.num);
      else res.fallaron.push({ telefono: c.num, motivo: a.error ?? 'no se pudo agregar' });
    }
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[mako-grupo] el equipo de la agencia no entró al grupo del ws ${clienteWs}: ${motivo}`);
    res.fallaron.push({ telefono: '', motivo });
  }
  if (res.fallaron.length) console.warn(`[mako-grupo] ws ${clienteWs}: ${res.fallaron.length} del equipo de la agencia sin entrar`);
  return res;
}

export type PlanEquipoAgencia = { jid: string | null; agencias: AgenciaConEquipo[]; adentro: string[] | null; faltan: string[] };

/** Lo que haría `aplicarEquipoDeAgencia`, SIN TOCAR NADA: sólo lee la base y la lista de participantes. */
export async function planEquipoDeAgencia(clienteWs: number): Promise<PlanEquipoAgencia> {
  const jid = await grupoJidEstricto(clienteWs);
  const agencias = await equipoDeAgenciasDe(clienteWs);
  const adentro = jid ? await telefonosEnElGrupo(jid) : null;
  const equipo = [...new Set(agencias.flatMap((a) => a.telefonos))];
  return { jid, agencias, adentro, faltan: adentro ? quienesFaltan(equipo, adentro) : equipo };
}

/**
 * Para un grupo que YA EXISTE: suma a quienes faltan y le dice al grupo quién entró. ⚠️ MANDA MENSAJES A CLIENTES REALES: sólo lo llama
 * `--aplicar` del comando, con el sí de Martín. Sin la lista de participantes no toca nada: agregaría a ciegas y contaría de más.
 * Volver a correrlo no repite: quien ya está no se agrega ni se anuncia.
 */
export async function aplicarEquipoDeAgencia(clienteWs: number): Promise<ResultadoEquipoAgencia | { ok: false; error: string }> {
  if (!(await gruposAutomaticos())) return { ok: false, error: AUTOMATICO_APAGADO };
  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS };
  const plan = await planEquipoDeAgencia(clienteWs);
  if (!plan.jid) return { ok: false, error: 'el cliente no tiene grupo: el equipo entra solo cuando se cree' };
  if (!plan.adentro) return { ok: false, error: 'no pude leer quién está en el grupo' };
  const cliente = (await getWorkspace(clienteWs).catch(() => null))?.nombre ?? undefined;
  const r = await sumarEquipoDeAgenciaAlGrupo(clienteWs, plan.jid, { adentro: plan.adentro, cliente });
  const linea = lineaDeLaAgencia(r.agencias.map((a) => a.nombre), { entraron: r.entraron.length, invitados: r.invitados.length });
  if (linea) await enviarTextoVozMaKo(plan.jid, linea);
  return r;
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
  // El WhatsApp de quien compró, a su lead del CRM de la plataforma (import dinámico: lib/compra-plan-llamada.ts arrastra el CRM). Nunca tira.
  await import('./compra-plan-llamada').then((m) => m.anotarTelefonoDelComprador(ws, c.num)).catch(() => {});

  if (!jid) {
    const r = await asegurarGrupoMaKo(ws, { nombre: nombreCliente, participantes: [c.num] });
    return r.ok ? { ok: true, accion: 'grupo_creado', jid: r.jid } : { ok: false, error: r.error };
  }
  // Tipeado distinto, pero WhatsApp dice que es el mismo de antes.
  if (c.num === anterior) return { ok: true, accion: 'sin_cambios', jid };
  const a = await sumarAlGrupo(ws, jid, c.destino);
  return a.ok ? { ok: true, accion: 'numero_agregado', jid } : { ok: false, error: a.error ?? 'no se pudo agregar' };
}

// ── Verificación del teléfono de reportes: la persona ESCRIBE PRIMERO (4/11/2026) ──────────────
// El onboarding no deja pasar sin que el dueño pruebe que ESE número es suyo. Hasta el 4/11 MaKo le mandaba un código por
// DM, o sea que la línea le escribía primero a un número que nunca le había escrito: lo que pesó en el ban del 3/11. Ahora la
// pantalla le da un link `wa.me` a la línea de MaKo con el texto escrito («Hola MaKo, mi código es K7P2QX»), la persona lo
// manda, y el webhook confirma el número de quien lo mandó (`confirmarPorMensajeEntrante`). MaKo no le contesta: se ve en la
// app. Las reglas son puras: lib/verificacion-entrante.ts. Recién con el número probado se lo suma al grupo de MaKo.
const KEY_VERIFICACION = 'mako.contacto.verificacion';

const MAKO_SIN_LINEA = 'MaKo no puede recibir mensajes de WhatsApp en este momento, y es de nuestro lado. Tu número sigue sin verificar por ahora — te queda pendiente y lo resuelves después.';

async function getVerificacion(ws: number): Promise<EstadoVerificacion | null> {
  const raw = await runWithWorkspace(ws, () => getSetting(KEY_VERIFICACION));
  return parseVerificacion(raw);
}
function parseVerificacion(raw: string | null | undefined): EstadoVerificacion | null {
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

/** Cómo va la verificación entrante, para la pantalla (el link, si ya llegó, si llegó de otro número). null si no hay una. */
export async function estadoVerificacionEntrante(ws: number): Promise<VistaEntrante | null> {
  return vistaDeEntrante(await getVerificacion(ws), Date.now());
}

/** La línea que recibe el mensaje y su número, sólo si está conectada. Lee la base de Evolution: no le habla a WhatsApp. */
async function lineaQueRecibe(): Promise<{ instancia: string; numero: string } | null> {
  const instancia = await instanciaVoz();
  const r = await ev(`/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`);
  const fila = Array.isArray(r.body)
    ? (r.body as Array<Record<string, unknown>>).find((i) => (i.name ?? i.instanceName) === instancia)
    : undefined;
  if (!fila || String(fila.connectionStatus ?? '').toLowerCase() !== 'open') return null;
  const numero = soloDigitos(String((fila.ownerJid as string) || (fila.owner as string) || (fila.number as string) || '').split('@')[0].split(':')[0]);
  return numero ? { instancia, numero } : null;
}

/**
 * Prepara la verificación: guarda un código y devuelve el link `wa.me` para que la persona le escriba a MaKo. NO manda
 * nada ni toca el grupo. Si el número YA está verificado (revisita con el mismo teléfono), no pide nada.
 */
export async function pedirMensajeDeVerificacion(
  ws: number, telefono: string, nombreCliente: string,
): Promise<{ ok: true; yaVerificado: true } | { ok: true; yaVerificado: false; link: string; numeroLinea: string } | { ok: false; error: string }> {
  const num = soloDigitos(telefono);
  if (num.length < 8) return { ok: false, error: 'El número no es válido.' };
  const actual = await getVerificacion(ws);
  if (actual?.verificado && soloDigitos(actual.telefono) === num) return { ok: true, yaVerificado: true };
  if (!grupoConfigurado()) return { ok: false, error: MAKO_SIN_LINEA };
  const linea = await lineaQueRecibe();
  if (!linea) return { ok: false, error: MAKO_SIN_LINEA };
  const codigo = codigoNuevo();
  const link = linkWaMe(linea.numero, textoParaMandar(codigo));
  if (!link) return { ok: false, error: MAKO_SIN_LINEA };
  await guardarVerificacion(ws, {
    telefono: num, destino: num, nombre: nombreCliente, codigo,
    expira: Date.now() + MINUTOS_ENTRANTE * 60_000, verificado: false,
    entrante: true, linea: linea.instancia, numeroLinea: linea.numero,
  });
  return { ok: true, yaVerificado: false, link, numeroLinea: linea.numero };
}

/**
 * El código ESCRITO EN LA APP. Sólo para un pedido de antes del 4/11 (MaKo ya le mandó el código por DM): una verificación
 * entrante no se confirma tipeando (`decidirCodigoTipeado`). Con el número probado lo suma al grupo y lo marca verificado.
 */
export async function verificarCodigoContacto(ws: number, codigo: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getVerificacion(ws);
  if (v?.verificado) return { ok: true };
  const d = decidirCodigoTipeado(v, codigo, Date.now());
  if (!d.ok) return d;
  const sync = await sincronizarConfirmado(ws, v!);
  if (!sync.ok) return sync;
  await guardarVerificacion(ws, { ...v!, verificado: true });
  return { ok: true };
}

/** El grupo con el número ya probado. Con el freno puesto el número igual queda probado: un cliente nuevo no se traba por un grupo que no se va a crear. */
async function sincronizarConfirmado(ws: number, v: EstadoVerificacion): Promise<{ ok: true } | { ok: false; error: string }> {
  const nombre = v.nombre?.trim() || (await getWorkspace(ws).catch(() => null))?.nombre || 'tu negocio';
  const sync = await setNumeroDuenoYSync(ws, v.destino || v.telefono, nombre);
  if (!sync.ok && sync.error !== ALTAS_FRENADAS) {
    return { ok: false, error: esSesionCaida(sync.error) ? MAKO_SIN_LINEA : `Tu número está bien, pero no pude sumarte al grupo de WhatsApp de MaKo: ${sync.error}` };
  }
  return { ok: true };
}

/**
 * EL WEBHOOK: un mensaje 1 a 1 que le llegó a una línea de MaKo. Si trae el código de una verificación vigente, desde el
 * número que se dio y por la línea del link, la confirma y suma a esa persona al grupo (ya escribió primero). Nunca
 * contesta por WhatsApp. Devuelve qué hizo, para el log, y el alta en el grupo para correr después; null si el mensaje no era
 * de esto (casi siempre, sin tocar la base).
 */
export async function confirmarPorMensajeEntrante(instancia: string, m: Record<string, unknown>): Promise<{ resultado: string; sumarAlGrupo?: () => Promise<void> } | null> {
  const key = (m?.key ?? {}) as { remoteJid?: string; fromMe?: boolean; remoteJidAlt?: string; senderPn?: string };
  const msg = (m?.message ?? {}) as Record<string, unknown>;
  const texto = typeof msg.conversation === 'string' ? msg.conversation : String((msg.extendedTextMessage as { text?: string } | undefined)?.text ?? '');
  const codigo = codigoDelTexto(texto);
  if (!codigo) return null;
  const chat = chatDelMensaje(key);
  if (!chat) return null;
  // Los candidatos: el código es de letras y números (no trae comodines). Quién es quién lo decide `decidirLlegada`.
  const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value')
    .eq('key', KEY_VERIFICACION).ilike('value', `%"codigo":"${codigo}"%`).limit(5);
  if (error) { console.error(`[mako-grupo] no pude buscar la verificación ${codigo}: ${error.message}`); return { resultado: 'sin-leer' }; }
  for (const fila of (data ?? []) as Array<{ workspace_id: number; value: string }>) {
    const v = parseVerificacion(fila.value);
    const d = decidirLlegada(v, { codigo, instancia, telefono: chat.telefono, ahora: Date.now() });
    if (d.tipo === 'ignorar') { if (d.porque !== 'no-es-este') return { resultado: `ws${fila.workspace_id}: ${d.porque}` }; continue; }
    const ws = Number(fila.workspace_id);
    if (d.tipo === 'otro-numero') {
      await runWithWorkspace(ws, () => cambiarSettingSi(KEY_VERIFICACION, fila.value, JSON.stringify({ ...v!, otroNumero: d.telefono }))).catch(() => false);
      return { resultado: `ws${ws}: escribió desde otro número` };
    }
    // `telefono` queda como lo dio (con él lo compara el onboarding); `destino`, en la forma con que lo mandó WhatsApp.
    const confirmado: EstadoVerificacion = { ...v!, destino: d.telefono, verificado: true, confirmadoAt: new Date().toISOString() };
    delete confirmado.otroNumero;
    // De dos llegadas del mismo mensaje (dos líneas de la misma cuenta), una sola suma al grupo.
    const gane = await runWithWorkspace(ws, () => cambiarSettingSi(KEY_VERIFICACION, fila.value, JSON.stringify(confirmado))).catch((e: unknown) => {
      console.error(`[mako-grupo] no pude confirmar la verificación de ws${ws}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    });
    if (!gane) return { resultado: `ws${ws}: ya confirmado por otra llegada` };
    // El grupo habla con WhatsApp (lento): lo corre quien llama después de contestarle a Evolution. Lo que importa ya quedó escrito.
    return {
      resultado: `ws${ws}: confirmado`,
      sumarAlGrupo: async () => {
        const sync = await sincronizarConfirmado(ws, confirmado);
        if (!sync.ok) console.error(`[mako-grupo] ws${ws} confirmó su número pero el grupo no salió: ${sync.error}`);
      },
    };
  }
  return null;
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
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar', fallaElEnvio: true };
}

// ── Grupo suelto (pruebas): crear sin persistir + postear a un JID cualquiera ──
/** Crea un grupo (estrella dorada) SIN guardarlo como grupo de ningún workspace. */
export async function crearGrupoSuelto(
  subject: string, participantes: string[], descripcion?: string,
): Promise<{ ok: true; jid: string } | { ok: false; error: string }> {
  if (!(await altasEnGrupos())) return { ok: false, error: ALTAS_FRENADAS };
  if (!grupoConfigurado()) return { ok: false, error: 'Evolution no configurado' };
  const participants = (participantes ?? []).map(soloDigitos).filter(Boolean);
  for (const p of participants) {
    const cupo = await cupoAltaDeLinea(p);
    if (!cupo.ok) return cupo;
  }
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
  // Sólo a quien ya le escribió a la línea (regla 1): lo mira `enviarTextoVozMaKo`, y el motivo vuelve tal cual.
  const r = await enviarTextoVozMaKo(num, texto);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error ?? 'no se pudo enviar' };
}

// ── EL ANILLO ANTI-ECO: los ids que MaKo mandó a cada grupo (`mako.doer.sent.<jid>`, en OWNER_WS) ──────────────────────────
// Vivía en lib/mako-doer-in.ts y lo llenaban sólo la respuesta del doer y el aviso de arreglo. Los avisos, las insistencias, los
// flujos, el cierre de tickets y `enviarGrupoMaKo` salen por las dos funciones de abajo SIN anotarse, y su eco vuelve `fromMe`: el
// doer lo tomaba por el dueño escribiendo desde la línea (`esLineaDelDueno`, la verificación de 991abd4af), y desde ahí «@MaKo
// sí» dejaba de confirmar. Ahora lo que sale por acá se anota solo.
const KEY_ENVIADOS = (jid: string) => `mako.doer.sent.${jid}`;
/** Los últimos 40 ids que MaKo mandó a ese grupo (los settings operativos del doer van en OWNER_WS, keyeados por jid). */
export async function idsEnviadosAlGrupo(ws: number, jid: string): Promise<string[]> {
  return runWithWorkspace(ws, async () => delAnillo(await getSetting(KEY_ENVIADOS(jid))));
}
// VARIOS ids en UNA escritura. Importante con los mensajes separados (punto 10): antes eran N escrituras concurrentes sobre la
// misma key (lost-update → MaKo procesaba su propio eco); ahora la respuesta se registra de una.
// ⚠️ Y con COMPARE-AND-SET (la verificación de 96e7840e8): desde que se anotan los avisos, los flujos y el acuse, dos envíos a la
// vez al mismo grupo perdían un id. La lectura es ESTRICTA: con `getSetting`, un error al leer era «anillo vacío» y se pisaban los
// 39 anteriores; ahora no se escribe. Nunca tira: el mensaje ya salió, y el anillo es best effort.
export async function anotarEnviadosAlGrupo(ws: number, jid: string, ids: readonly string[]): Promise<void> {
  const nuevos = ids.filter(Boolean);
  if (!jid || !nuevos.length) return;
  try {
    await runWithWorkspace(ws, async () => {
      // Cada vuelta gana UNO de los que compiten: con 3 intentos, 4 envíos a la vez perdían un id (la verificación de tren-t). Seis,
      // con una espera al azar entre vuelta y vuelta para que no choquen otra vez.
      for (let intento = 0; intento < INTENTOS_DEL_ANILLO; intento++) {
        if (intento > 0) await new Promise((r) => setTimeout(r, 10 + Math.random() * 60));
        const raw = await getSettingEstricto(KEY_ENVIADOS(jid));
        const next = [...delAnillo(raw).filter((x) => !nuevos.includes(x)), ...nuevos].slice(-40); // ring buffer
        if (await cambiarSettingSi(KEY_ENVIADOS(jid), raw, JSON.stringify(next))) return;
      }
      console.warn(`[mako-grupo] anti-eco de ${jid}: otro envío ganó ${INTENTOS_DEL_ANILLO} veces; no se anotó ${nuevos.join(',')}`);
    });
  } catch (e) {
    console.error(`[mako-grupo] anti-eco de ${jid}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
const INTENTOS_DEL_ANILLO = 6;

/**
 * El anillo, CON TOPE: el mensaje ya salió y no espera a la base (la verificación de 2cb1cf67e). Con la base colgada en
 * `mako.doer.sent.*`, `enviarAGrupoJid` esperaba al anillo antes de volver: la respuesta en tres partes salía 1/3 y la espera no
 * salía, hasta el corte de undici (300 s), cinco minutos de MaKo mudo en el grupo. Se espera hasta `TOPE_DEL_ANILLO_MS` y la
 * anotación sigue sola; si el eco llega antes, entra como un mensaje (lo que pasaba antes del anillo). Nunca tira.
 */
export const TOPE_DEL_ANILLO_MS = 3000;
export async function anotarEnviadosConTope(ws: number, jid: string, ids: readonly string[]): Promise<void> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<void>((r) => { t = setTimeout(r, TOPE_DEL_ANILLO_MS); });
  try { await Promise.race([anotarEnviadosAlGrupo(ws, jid, ids), tope]); } finally { clearTimeout(t); }
}
const delAnillo = (raw: string | null): string[] => {
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []; } catch { return []; }
};

/** Manda un texto a un JID de grupo cualquiera. delayMs opcional (demo = chico). Lo que sale queda en el anillo anti-eco
 *  (`enviarTextoVozMaKo`). */
export async function enviarAGrupoJid(jid: string, texto: string, delayMs?: number): Promise<EnvioGrupo> {
  if (!jid || !texto.trim()) return { ok: false, error: 'faltan jid o texto' };
  const r = await enviarTextoVozMaKo(jid, texto, delayMs);
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: 'no se pudo enviar' };
}

/** `sinGrupo`: el negocio NO TIENE grupo de MaKo, leído (17/10/2026). Ausente en cualquier otro error, también «no pude leer». */
/** `fallaElEnvio`: se intentó y WhatsApp no lo tomó. No es «no pude leer cuál es el grupo», y de eso cuelga el mail de `emitirAviso`. */
export type EnvioGrupo = { ok: true; id: string } | { ok: false; error: string; sinGrupo?: true; fallaElEnvio?: true };

/** Saca el mensaje útil del body de error de Evolution (viene anidado y variado). Vive en lib/mako-tarjeta.ts
 *  (puro): lo usa también el envío por partes. */
const detalleEv = detalleEvolution;

/**
 * Dónde queda lo que se manda al grupo, para que el turno de MaKo lo vea (28/10/2026, el diagnóstico del Cerebro, F2a). Es
 * OBLIGATORIO: ninguna salida nueva queda afuera por omisión.
 *   · 'mako': lo dice MaKo (una automatización, una insistencia): queda en la conversación como suyo (`guardarTurno`);
 *   · 'equipo': lo dice el equipo de MaKo (el aviso de un arreglo, la respuesta de un ticket): va al anillo del equipo
 *     (lib/doer-equipo.ts), NUNCA como turno de MaKo: un «sí» del dueño a una pregunta del equipo no es una confirmación;
 *   · null: quien llama ya lo guarda (lib/avisos.ts, con sus partes).
 */
export type MemoriaDelEnvio = 'mako' | 'equipo' | { de: 'equipo'; ticket: number } | null;

/** Manda un texto al grupo de MaKo del workspace (para el ruteo de avisos). */
export async function enviarAlGrupoMaKo(ws: number, texto0: string, memoria: MemoriaDelEnvio): Promise<EnvioGrupo> {
  // ⚠️ Todo link a MaKo sale con el `?ws=` de ESTE negocio (27/10/2026, Leila: «Este lead no es de esta cuenta»;
  // lib/links-con-ws.ts): quien lo abre mirando otra cuenta llega al lead correcto. Uno que ya trae su `ws` no se toca.
  const texto = linksConWs(texto0, ws, APP_BASE_URL);
  if (!texto.trim()) return { ok: false, error: 'texto vacío' };
  let jid: string | null;
  try { jid = await grupoJidEstricto(ws); } catch (e) { return { ok: false, error: `no pude leer el grupo de MaKo: ${e instanceof Error ? e.message : String(e)}` }; }
  if (!jid) return { ok: false, error: SIN_GRUPO_MAKO, sinGrupo: true };
  // El mismo texto a muchos grupos no sale (regla 4): con `fallaElEnvio`, `emitirAviso` lo manda por mail y el aviso no se pierde.
  if (!(await cupoMismoTexto(jid, texto))) return { ok: false, error: MISMO_TEXTO_A_MUCHOS, fallaElEnvio: true };
  const delay = pausaDeEscritura(texto.length);
  const instancia = await instanciaVoz();
  const r = await ev(`/message/sendText/${instancia}`, {
    method: 'POST', body: JSON.stringify({ number: jid, text: texto, delay }),
  });
  // El motivo, no solo el número: un 400 acá casi siempre es "la sesión de esa
  // instancia está caída" y con "Evolution 400" a secas eso no se deduce.
  if (!r.ok) return { ok: false, error: `Evolution ${r.status} en ${instancia}: ${detalleEv(r.body)}`, fallaElEnvio: true };
  const id = (r.body as { key?: { id?: string } })?.key?.id ?? '';
  // Al anillo anti-eco: el eco de un aviso no es el dueño escribiendo (ver `anotarEnviadosAlGrupo`).
  if (id) await anotarEnviadosConTope(OWNER_WS, jid, [id]);
  // Lo que se mandó queda en lo que ve el turno (`MemoriaDelEnvio`). Si no se puede anotar, el mensaje ya salió: se loguea.
  if (memoria === 'mako') {
    const { guardarTurno } = await import('./mako-doer-conv');
    await guardarTurno(ws, jid, 'assistant', texto, id || undefined)
      .catch((e) => console.error(`[mako-grupo] ws${ws}: salió y no pude guardarlo en la conversación: ${e instanceof Error ? e.message : String(e)}`));
  } else if (memoria === 'equipo' || (memoria && typeof memoria === 'object')) {
    await anotarLoDelEquipo(ws, texto, id, typeof memoria === 'object' ? memoria.ticket : undefined)
      .catch((e) => console.error(`[mako-grupo] ws${ws}: salió y no pude anotarlo como del equipo: ${e instanceof Error ? e.message : String(e)}`));
  }
  return { ok: true, id };
}

/**
 * Lo que el equipo escribió en el grupo del negocio, a su anillo (lib/doer-equipo.ts). La llaman `enviarAlGrupoMaKo` y el doer
 * con el ECO de un mensaje firmado por el equipo (lo que escribe desde el panel o el teléfono, que no pasa por acá).
 */
export async function anotarLoDelEquipo(ws: number, texto: string, id: string, ticket?: number, para?: { jids?: string[]; nombre?: string }): Promise<void> {
  const { CLAVE_EQUIPO_EN_EL_GRUPO, conElNuevo } = await import('./doer-equipo');
  await runWithWorkspace(ws, async () => {
    // ESTRICTA: con `getSetting`, una lectura que falla daba null y el anillo se pisaba entero (la verificación de 5b7a1917d).
    const antes = await getSettingEstricto(CLAVE_EQUIPO_EN_EL_GRUPO);
    await setSetting(CLAVE_EQUIPO_EN_EL_GRUPO, JSON.stringify(conElNuevo(antes, { at: new Date().toISOString(), texto, ...(id ? { id } : {}), ...(ticket ? { ticket } : {}), ...(para ? { para } : {}) })));
  });
}

/** La pregunta del equipo `id` ya tiene su respuesta: su ventana se cierra (lib/doer-equipo.ts, `conLaRespondida`). */
export async function cerrarLaPreguntaDelEquipo(ws: number, id: string): Promise<void> {
  const { CLAVE_EQUIPO_EN_EL_GRUPO, conLaRespondida } = await import('./doer-equipo');
  await runWithWorkspace(ws, async () => {
    const antes = await getSettingEstricto(CLAVE_EQUIPO_EN_EL_GRUPO);
    await setSetting(CLAVE_EQUIPO_EN_EL_GRUPO, JSON.stringify(conLaRespondida(antes, id)));
  });
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
  let jid: string | null;
  try { jid = await grupoJidEstricto(ws); } catch (e) { return { ok: false, salieron: 0, ids: [], error: `no pude leer el grupo de MaKo: ${e instanceof Error ? e.message : String(e)}` }; }
  if (!jid) return { ok: false, salieron: 0, ids: [], error: SIN_GRUPO_MAKO, sinGrupo: true };
  // Los links del texto y del pie de un archivo, con el `?ws=` de este negocio (como `enviarAlGrupoMaKo`).
  const r = await enviarPartesAJid(jid, partesConLinksDeWs(partes, ws, APP_BASE_URL), d);
  return r.ok ? r : { ...r, fallaElEnvio: true };
}

/** Lo mismo, a un JID cualquiera (el chat de MaKo de /agencia manda un audio o un archivo suelto por acá). */
export async function enviarPartesAJid(
  jid: string, partes: readonly PartePreparada[], d: { ev?: EvFn; esperar?: (ms: number) => Promise<void>; delayMs?: number } = {},
): Promise<EnvioPartes> {
  if (!d.ev && !grupoConfigurado()) return { ok: false, salieron: 0, ids: [], error: 'Evolution no configurado' };
  // Regla 1 (lib/mako-salida-reglas.ts): a una persona, sólo si escribió antes. Lo de siempre es un grupo.
  if (!d.ev && !jid.endsWith('@g.us') && !puedeEscribirleAPersona({ leEscribio: await leEscribioALaLinea(jid).catch(() => null) })) {
    return { ok: false, salieron: 0, ids: [], error: NO_LE_ESCRIBE_PRIMERO };
  }
  const r = await enviarPartesPorEv(jid, partes, { ev: d.ev ?? ev, instancia: await instanciaVoz(), esperar: d.esperar, delayMs: d.delayMs });
  // Al anillo anti-eco, de una (`anotarEnviadosAlGrupo`). El test inyecta `ev` y no toca la base.
  if (!d.ev && r.ids.length) await anotarEnviadosConTope(OWNER_WS, jid, r.ids);
  return r;
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
  // Una reacción a una persona también es escribirle (regla 1): sólo en un grupo, o a quien escribió.
  if (!jid.endsWith('@g.us') && !puedeEscribirleAPersona({ leEscribio: await leEscribioALaLinea(jid).catch(() => null) })) return false;
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
