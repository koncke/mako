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
  CLAVE_ESTADO, leerGuardado, listaDeAprobaciones, mensajeDeAvisos, vuelta, type Aviso, type FilaLista, type Lectura,
} from './vigia-aprobaciones';
import {
  CLAVE_CWS_PUBLISHER, CLAVE_GOOGLE, CLAVES_ASC, leerTodo, type CredencialesVigia, type DominiosResend,
} from './vigia-aprobaciones-fuentes';

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

/** Lee todas las fuentes AHORA, sin escribir ni avisar nada: la vuelta y la prueba de la consola (`--probar`). */
export async function leerAhora(ws: number): Promise<Record<string, Lectura>> {
  const { creds, sinLeer } = await credenciales(ws);
  return leerTodo({
    fetch: globalThis.fetch.bind(globalThis),
    ahoraMs: () => Date.now(),
    creds,
    credsSinLeer: sinLeer,
    versionExtension: EXTENSION_VERSION,
    extensionId: EXTENSION_ID,
    metaApiVersion: process.env.META_API_VERSION,
    dominiosResend: () => dominios(ws),
  });
}

/** Una lectura en una línea, sin claves: para el log del cron y la consola. */
export function resumenDeLectura(l: Lectura): string {
  return l.tipo === 'leido' ? `${l.estado}${l.version ? ` ${l.version}` : ''} (${l.fuente})${l.detalle ? ` — ${l.detalle}` : ''}`
    : l.tipo === 'no_pude' ? `no pude: ${l.motivo}` : l.tipo === 'sin_credencial' ? `falta ${l.faltan.join(', ')}` : 'a mano';
}

/** Una vuelta entera: lee todo, guarda el estado y, si algo cambió, le avisa a Martín. */
export async function correrVigiaAprobaciones(): Promise<ResultadoVigia> {
  const ws = await wsSuperAdmin();
  return runWithWorkspace(ws, async (): Promise<ResultadoVigia> => {
    const crudo = await getSettingEstricto(CLAVE_ESTADO);
    const previo = leerGuardado(crudo);
    const lecturas = await leerAhora(ws);
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
