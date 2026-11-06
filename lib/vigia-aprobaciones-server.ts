// =============================================================================
// vigia-aprobaciones-server — la vuelta del vigía con la red enchufada (4/11/2026)
// =============================================================================
// Lo que decide está en lib/vigia-aprobaciones.ts (puro) y lo que lee, en lib/vigia-aprobaciones-fuentes.ts. Acá se conectan:
// las credenciales de la PLATAFORMA, el estado guardado y el aviso a Martín.
//
// DÓNDE CORRE: en el servidor, cada hora (/api/cron/vigia-aprobaciones, vercel.json). No en la PC ni en el Runner: no gasta un
// token de Claude, no depende de que un chat esté abierto (AGENTS.md, «un cron de SESIÓN no es infraestructura») y las
// credenciales viven donde ya viven las de la plataforma.
//
// LO QUE GOBIERNA ESTE MÓDULO:
//   · LAS CREDENCIALES SON DEL WORKSPACE DE LA PLATAFORMA (`wsSuperAdmin()`), leídas con `credDelClienteEstricta`: su fila,
//     nunca `process.env` (que para casi todo es del ws1, un CLIENTE). Las carga Martín en Integraciones (las tarjetas
//     «App Store Connect» y «Google Play y Chrome Web Store»). La de Meta es el secreto de la app que ya está en Vercel, el mismo
//     que usa el callback de «Conectar con Meta» (lib/meta-login.ts, `ENV_SECRETO_APP`).
//   · «NO PUDE LEER» UNA CREDENCIAL NO ES «NO ESTÁ»: va a `credsSinLeer` y su fuente da «no pude leer», que no cambia nada.
//   · EL ESTADO SE MARCA ANTES DE AVISAR, con compare-and-set (AGENTS.md, «Un horario que se repite…»): de dos vueltas a la
//     vez, avisa una. Si el aviso falla después, se pierde ese aviso y no se repite: es lo que se elige para no mandar dos.
//   · NADA DE RUTINA: sin novedades no se escribe ni manda nada a Martín (la fila del estado sí se actualiza).
// =============================================================================

import 'server-only';
import { credDelClienteEstricta } from './credenciales';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { avisoSoloEnLaApp } from './aviso-en-la-app';
import { listResendDomains } from './resend-dominios';
import { KEY_SOLO_ENVIO_DE_MAKO, SIN_CLAVE_DE_DOMINIOS } from './resend-errores';
import { EXTENSION_VERSION } from './extension-version';
import { EXTENSION_ID } from './extension-tienda';
import { ENV_SECRETO_APP } from './meta-login';
import {
  CLAVE_ESTADO, CLAVE_PANELES, anotarPanel, leerGuardado, leerPaneles, listaDeAprobaciones, mensajeDeAvisos, vuelta,
  type Aviso, type FilaLista, type Lectura, type LecturaPanel, type PanelesGuardados,
} from './vigia-aprobaciones';
import {
  CLAVE_CWS_PUBLISHER, CLAVE_GOOGLE, CLAVES_ASC, leerTodo, tokenGoogle, type CredencialesVigia, type DominiosResend, type Entorno,
  type TokenGoogle,
} from './vigia-aprobaciones-fuentes';
import {
  CLAVE_PUBLICACION, conLaPublicacion, decidirPublicacion, guardarPaso, leerEstadoTienda, leerPublicacion, marcaDeSubida, publicar,
  subir, versionDelZip, type Dependencias, type ResumenPublicacion,
} from './extension-publicar';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** El tipo del aviso en la bandeja y en el push. Sólo lo reciben los admin del workspace de la plataforma. */
export const TIPO_AVISO_VIGIA = 'vigia-aprobaciones';

const CLAVES_DE_LA_BASE = [...CLAVES_ASC, CLAVE_GOOGLE, CLAVE_CWS_PUBLISHER] as const;

export type ResultadoVigia = {
  ok: boolean;
  /** Otra vuelta escribió primero: ésta no avisó nada. */
  otraVuelta?: boolean;
  avisos: Aviso[];
  /** Salió el aviso (a la bandeja o al teléfono). */
  avisado?: boolean;
  /** Por ítem, qué se leyó, en una palabra (sin claves): para el log del cron. */
  lecturas: Record<string, string>;
  error?: string;
};

async function credenciales(ws: number): Promise<{ creds: CredencialesVigia; sinLeer: string[] }> {
  const creds: CredencialesVigia = {};
  const sinLeer: string[] = [];
  await Promise.all(CLAVES_DE_LA_BASE.map(async (c) => {
    try { creds[c] = await credDelClienteEstricta(c, ws, { ilegibleTira: true }); } catch { sinLeer.push(c); }
  }));
  creds.MAKO_META_APP_SECRET = process.env[ENV_SECRETO_APP]?.trim() || null;
  return { creds, sinLeer };
}

/** Los dominios de la cuenta de Resend de MaKo, con la clave que los administra (lib/resend-dominios.ts). */
async function dominios(ws: number): Promise<DominiosResend> {
  const r = await runWithWorkspace(ws, () => listResendDomains());
  if (r.ok) return { ok: true, domains: r.domains };
  return { ok: false, error: r.error, sinClave: r.error === SIN_CLAVE_DE_DOMINIOS || r.error === KEY_SOLO_ENVIO_DE_MAKO };
}

/** Lo que guardó la tarea del Cerebro de los paneles, o null si la base no contestó (eso es «no pude leer», no «vacío»). */
async function paneles(ws: number): Promise<PanelesGuardados | null> {
  try { return leerPaneles(await runWithWorkspace(ws, () => getSettingEstricto(CLAVE_PANELES))); } catch { return null; }
}

/** Lee todas las fuentes AHORA, sin escribir ni avisar nada: la vuelta y la prueba de la consola (`--probar`). */
export async function leerAhora(ws: number): Promise<Record<string, Lectura>> {
  return leerTodo(await entornoDe(ws));
}

/** El entorno de verdad de los lectores: la red, las credenciales de la plataforma y lo guardado de los paneles. */
async function entornoDe(ws: number): Promise<Entorno> {
  const [{ creds, sinLeer }, delPanel] = await Promise.all([credenciales(ws), paneles(ws)]);
  return {
    fetch: globalThis.fetch.bind(globalThis),
    ahoraMs: () => Date.now(),
    creds,
    credsSinLeer: sinLeer,
    versionExtension: EXTENSION_VERSION,
    extensionId: EXTENSION_ID,
    metaApiVersion: process.env.META_API_VERSION,
    dominiosResend: () => dominios(ws),
    paneles: delPanel,
  };
}

/** El zip de ESTE deploy (public/, sumado a la función en next.config.ts → outputFileTracingIncludes) y la versión que dice. */
async function zipDelDeploy(): Promise<{ bytes: Uint8Array; version: string | null } | { error: string }> {
  try {
    const bytes = new Uint8Array(await readFile(path.join(process.cwd(), 'public', `mako-puente-${EXTENSION_VERSION}.zip`)));
    return { bytes, version: await versionDelZip(bytes) };
  } catch {
    return { error: `no encontré el zip de la ${EXTENSION_VERSION} en este deploy` };
  }
}

/**
 * La extensión se publica sola (lib/extension-publicar.ts): si la versión de main es más nueva que la de la tienda, la sube y la
 * manda a revisión. Marca ANTES de tocar la tienda, con compare-and-set (regla 3). Nunca tira: lo que pase vuelve como resumen
 * para la fila de la extensión en Approvals. Sólo la corre la vuelta del cron (`--probar` no publica).
 */
async function publicarExtensionSiHaceFalta(ws: number, e: Entorno, token: () => Promise<TokenGoogle>): Promise<ResumenPublicacion> {
  const faltan = [...(e.creds.TIENDAS_GOOGLE_CUENTA_SERVICIO ? [] : [CLAVE_GOOGLE]), ...(e.creds.CWS_PUBLISHER_ID ? [] : [CLAVE_CWS_PUBLISHER])];
  if (e.credsSinLeer?.some((c) => c === CLAVE_GOOGLE || c === CLAVE_CWS_PUBLISHER)) return { tipo: 'no_pude', motivo: 'no pude leer las claves de la tienda' };
  if (faltan.length) return { tipo: 'falta', faltan };
  const t = await token();
  if ('lectura' in t) return { tipo: 'no_pude', motivo: t.lectura.tipo === 'no_pude' ? t.lectura.motivo : 'Google no dio un token' };
  const dep: Dependencias = {
    fetch: e.fetch, token: t.token, publisherId: String(e.creds.CWS_PUBLISHER_ID), extensionId: e.extensionId,
    versionMain: EXTENSION_VERSION, zip: zipDelDeploy,
  };
  const tienda = await leerEstadoTienda(dep);
  if ('error' in tienda) return { tipo: 'no_pude', motivo: tienda.error };
  return runWithWorkspace(ws, async (): Promise<ResumenPublicacion> => {
    let crudo: string | null;
    try { crudo = await getSettingEstricto(CLAVE_PUBLICACION); } catch { return { tipo: 'no_pude', motivo: 'no pude leer la última publicación' }; }
    const previa = leerPublicacion(crudo);
    const ahora = Date.now();
    const decision = decidirPublicacion(EXTENSION_VERSION, tienda, previa, ahora);
    if (decision.hacer !== 'subir' && decision.hacer !== 'publicar') return { tipo: 'decidido', decision, previa };
    const marca = JSON.stringify(marcaDeSubida(previa, EXTENSION_VERSION, ahora));
    if (!(await cambiarSettingSi(CLAVE_PUBLICACION, crudo, marca))) {
      return { tipo: 'decidido', decision: { hacer: 'esperar', motivo: `Otra vuelta está mandando la ${EXTENSION_VERSION}` }, previa };
    }
    let resultado = decision.hacer === 'subir' ? await subir(dep) : await publicar(dep);
    if (decision.hacer === 'subir' && resultado.paso === 'subida') resultado = await publicar(dep);
    const guardado = guardarPaso(previa, EXTENSION_VERSION, resultado, Date.now());
    // Si esto no se escribe, la marca de «subiendo» vence sola en `SUBIENDO_VENCE_MS` y la vuelta siguiente decide de nuevo.
    await cambiarSettingSi(CLAVE_PUBLICACION, marca, JSON.stringify(guardado)).catch(() => false);
    console.log(`[vigia-aprobaciones] extensión ${EXTENSION_VERSION}: ${resultado.paso}${resultado.error ? ` (${resultado.error})` : ''}`);
    return { tipo: 'hecho', resultado, guardado };
  });
}

/** Una lectura en una línea, sin claves: para el log del cron y la consola. */
export function resumenDeLectura(l: Lectura): string {
  return l.tipo === 'leido' ? `${l.estado}${l.version ? ` ${l.version}` : ''} (${l.fuente})${l.detalle ? ` — ${l.detalle}` : ''}`
    : l.tipo === 'no_pude' ? `no pude: ${l.motivo}` : `falta ${l.faltan.join(', ')}`;
}

/** Una vuelta entera: lee todo, guarda el estado y, si algo cambió, le avisa a Martín. */
export async function correrVigiaAprobaciones(): Promise<ResultadoVigia> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async (): Promise<ResultadoVigia> => {
    const crudo = await getSettingEstricto(CLAVE_ESTADO);
    const previo = leerGuardado(crudo);
    const e = await entornoDe(ws);
    const token = tokenGoogle(e);
    const lecturas = await leerTodo(e, token);
    let pub: ResumenPublicacion;
    try { pub = await publicarExtensionSiHaceFalta(ws, e, token); } catch { pub = { tipo: 'no_pude', motivo: 'la publicación falló' }; }
    lecturas['chrome-web-store'] = conLaPublicacion(lecturas['chrome-web-store'], pub, EXTENSION_VERSION);
    const resumen: Record<string, string> = {};
    for (const [id, l] of Object.entries(lecturas)) resumen[id] = resumenDeLectura(l);
    const { nuevo, avisos } = vuelta(previo, lecturas, Date.now());
    const gano = await cambiarSettingSi(CLAVE_ESTADO, crudo, JSON.stringify(nuevo));
    if (!gano) return { ok: true, otraVuelta: true, avisos: [], lecturas: resumen };
    const msg = mensajeDeAvisos(avisos);
    if (!msg) return { ok: true, avisos, lecturas: resumen };
    const avisado = await avisoSoloEnLaApp(ws, msg.texto, { tipo: TIPO_AVISO_VIGIA, titulo: msg.titulo });
    if (!avisado) console.error(`[vigia-aprobaciones] no pude avisar (${avisos.length} novedades): ni la bandeja ni el teléfono`);
    return { ok: true, avisos, avisado, lecturas: resumen };
  });
}

/**
 * La lista de lo que espera, de lo GUARDADO (no lee nada afuera): la pestaña Approvals (computadora y teléfono), la operación
 * de la API y la consola. Tira si la base no contesta: «no pude leer» no es una lista vacía.
 */
export async function listaGuardadaDeAprobaciones(ahoraMs: number = Date.now()): Promise<{ ultimaVuelta: string | null; filas: FilaLista[] }> {
  const ws = await wsSuperAdmin();
  const g = leerGuardado(await runWithWorkspace(ws, () => getSettingEstricto(CLAVE_ESTADO)));
  return { ultimaVuelta: g.ultimaVuelta ?? null, filas: listaDeAprobaciones(g, ahoraMs) };
}

/**
 * Guarda lo que se leyó del panel de una aprobación sin API (scripts/vigia-paneles.mts y `anotar_lectura_de_panel`). Con
 * compare-and-set: la tarea guarda varios paneles seguidos y una persona puede anotar uno a la vez. No avisa: el vigía lo toma
 * en su próxima vuelta y avisa si cambió algo, como con cualquier lectura.
 */
export async function anotarLecturaDePanel(
  id: string,
  lectura: { estado: string; nota?: string | null } | { noPude: string },
): Promise<{ ok: true; lectura: LecturaPanel } | { ok: false; error: string }> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async () => {
    for (let intento = 0; intento < 3; intento++) {
      const crudo = await getSettingEstricto(CLAVE_PANELES);
      const r = anotarPanel(leerPaneles(crudo), id, lectura, Date.now());
      if (!r.ok) return r;
      if (await cambiarSettingSi(CLAVE_PANELES, crudo, JSON.stringify(r.nuevo))) return { ok: true as const, lectura: r.lectura };
    }
    return { ok: false as const, error: 'Otra lectura se guardó al mismo tiempo, tres veces seguidas. Vuelve a guardarla.' };
  });
}
