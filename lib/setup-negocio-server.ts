// =============================================================================
// setup-negocio-server — lo que MIDE cada paso del setup (27/10/2026)
// =============================================================================
// Las reglas puras viven en lib/setup-negocio.ts (con test). Acá se pregunta a la base, en el workspace del CONTEXTO
// (`getTenantDb`): lo leen el chat de arranque (/api/onboarding/arranque), su ruta del setup y la API de MaKo.
//
// ⚠️ CADA DETECTOR CON SU PROPIO `try`: una lectura caída deja ESE paso en «no pude comprobarlo» (`noPude`), nunca
//    en hecho, y no tumba a los otros cinco. Un setup que se da por terminado porque la base no contestó es el gate que
//    no frena nada (la regla de «una lectura que cae al default sirve para dibujar, nunca para DECIDIR»).
// ⚠️ SE USAN LAS PIEZAS DE CADA ÁREA, no una lectura propia de sus tablas (salvo la extensión, abajo):
//    · la computadora: `listarPcDelNegocio` (lib/ia-pc.ts): las confirmadas y sin revocar.
//    · Meta: `integracionConectada('meta')` (lib/credenciales.ts), que ya sabe de la conexión por Zernio.
//    · WhatsApp: `listarLineas` (lib/evolution.ts), una línea en «conectado».
//    · Google Calendar: `googleCalendarConectado` (lib/google-calendar.ts).
//    · su IA: su computadora con su Claude o su GPT (`negocioConPc`) o una clave propia (`claveDeIAPropia`), las dos de
//      lib/ia-pc.ts y lib/ia-del-negocio.ts. NO `negocioConSuIA`: ante la duda contesta «sí» (falla cerrada de D6b), y
//      acá la duda tiene que ser «no pude».
// ⚠️ LA EXTENSIÓN VIVE EN EL NAVEGADOR. El servidor la ve de dos formas: emparejada al puente de Flow (`flow_puentes`,
//    con su versión) o porque el navegador de quien hace el onboarding dijo qué versión tiene (`data-mako-puente` en el
//    `<html>`, guardado por la ruta en `onboarding.setup`). Se lee `flow_puentes` acá y no con `leerPuenteEstricto`
//    (lib/api-mako/areas/video.helpers.ts): ése trae medio Video Generator al grafo de esta ruta.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSettingEstricto, setSetting } from './settings';
import { listarPcDelNegocio, negocioConPc } from './ia-pc';
import { claveDeIAPropia } from './ia-del-negocio';
import { integracionConectada } from './credenciales';
import { listarLineas } from './evolution';
import { googleCalendarConectado } from './google-calendar';
import { esMasVieja } from './version-comparar';
import { EXTENSION_VERSION } from './extension-version';
import { capaDef, type CapaId } from './capas';
import { CLAVE_MODELO, modeloGuardado, type ModeloNegocio } from './modelo-negocio';
import {
  CLAVE_SETUP, VERSION_RE, aplicarSalto, estadoSetup, setupGuardado,
  type Deteccion, type Detectado, type EstadoSetup, type GuardadoSetup, type PasoSetup, type Salto,
} from './setup-negocio';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NO_PUDE = 'No pude comprobarlo ahora. Vuelve a intentarlo en un momento.';

/** Un detector: lo que devuelve, o «no pude» si tiró. */
async function medir(nombre: string, fn: () => Promise<Deteccion>): Promise<Deteccion> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[setup] ${nombre}: ${msg(e)}`);
    return { noPude: NO_PUDE };
  }
}

/** Lo guardado del setup, ESTRICTO (tira si no se pudo leer o no se entiende). */
export async function leerSetupGuardado(): Promise<GuardadoSetup> {
  return setupGuardado(await getSettingEstricto(CLAVE_SETUP));
}

/** La extensión: la que ve el puente de Flow o la que dijo el navegador. */
async function extension(guardado: GuardadoSetup | null): Promise<Deteccion> {
  const db = await getTenantDb();
  const { data, error } = await db.from('flow_puentes').select('version').maybeSingle();
  if (error) throw new Error(`flow_puentes: ${error.message}`);
  const delPuente = typeof data?.version === 'string' && VERSION_RE.test(data.version) ? data.version : null;
  const version = delPuente ?? guardado?.extension?.version ?? null;
  if (!version) return { hecho: false };
  return { hecho: true, detalle: esMasVieja(version, EXTENSION_VERSION) ? `Versión ${version} · hay una más nueva` : `Versión ${version}` };
}

/** Lo que mide el servidor de cada paso que pide la capa (los demás no se leen). */
export async function detectarSetup(ws: number, pasos: readonly PasoSetup[], guardado: GuardadoSetup | null): Promise<Detectado> {
  const quiere = new Set(pasos);
  const detectores: Record<PasoSetup, () => Promise<Deteccion>> = {
    desktop: async () => {
      const pcs = await listarPcDelNegocio(ws);
      if (!pcs.length) return { hecho: false };
      const una = pcs.find((p) => p.enLinea) ?? pcs[0];
      return { hecho: true, detalle: `${una.nombre || 'Tu computadora'}${una.enLinea ? ' · en línea' : ''}` };
    },
    extension: () => extension(guardado),
    meta: async () => ((await integracionConectada('meta', ws)) ? { hecho: true, detalle: 'Conectada' } : { hecho: false }),
    whatsapp: async () => {
      const lineas = await listarLineas();
      const viva = lineas.find((l) => l.estado === 'conectado');
      return viva ? { hecho: true, detalle: viva.numero ? `+${String(viva.numero).replace(/\D/g, '')}` : 'Conectado' } : { hecho: false };
    },
    calendario: async () => ((await googleCalendarConectado()) ? { hecho: true, detalle: 'Conectado' } : { hecho: false }),
    ia: async () => {
      if (await negocioConPc(ws)) return { hecho: true, detalle: 'Con tu computadora' };
      return (await claveDeIAPropia(ws)) ? { hecho: true, detalle: 'Con tu clave' } : { hecho: false };
    },
  };
  const entradas = await Promise.all(
    (Object.keys(detectores) as PasoSetup[]).filter((p) => quiere.has(p)).map(async (p) => [p, await medir(p, detectores[p])] as const),
  );
  return Object.fromEntries(entradas) as Detectado;
}

/** El modelo de negocio guardado (o el que se está confirmando en el arranque, si quien llama lo pasa). Tolerante: sin él, null. */
export async function modeloDelNegocio(): Promise<ModeloNegocio | null> {
  return modeloGuardado(await getSettingEstricto(CLAVE_MODELO).catch(() => null));
}

/**
 * El estado del setup del negocio ACTUAL para su capa. `modelo`: el que ya se sabe (el arranque lo pasa antes de
 * guardarlo); sin él, el guardado. Lo guardado que no se pudo leer cuenta como vacío para MEDIR (los saltos no valen),
 * que es el lado seguro: un salto que no se pudo leer no deja pasar.
 */
export async function setupDelNegocio(ws: number, capa: CapaId, modelo?: ModeloNegocio | null): Promise<EstadoSetup> {
  const pasos = capaDef(capa).setup;
  if (!pasos.length) return estadoSetup([], {}, {}, null);
  const [guardado, m] = await Promise.all([
    leerSetupGuardado().catch((e) => { console.error(`[setup] lo guardado: ${msg(e)}`); return null; }),
    modelo !== undefined ? Promise.resolve(modelo) : modeloDelNegocio(),
  ]);
  const detectado = await detectarSetup(ws, pasos, guardado);
  return estadoSetup(pasos, detectado, guardado?.saltos ?? {}, m);
}

/**
 * Guarda lo que la persona decidió saltear (o vuelve a pedir el paso con `salto: null`). Lee ESTRICTO antes de escribir:
 * con la base caída, escribir sobre `{}` borraría la extensión que ya vio y los otros saltos.
 */
export async function guardarSalto(paso: PasoSetup, salto: Salto | null, modelo: ModeloNegocio | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const guardado = await leerSetupGuardado();
  const r = aplicarSalto(guardado.saltos ?? {}, paso, salto, modelo);
  if ('error' in r) return { ok: false, error: r.error };
  await setSetting(CLAVE_SETUP, JSON.stringify({ ...guardado, saltos: r.saltos } satisfies GuardadoSetup));
  return { ok: true };
}

/** Guarda la versión de la extensión que vio el navegador (sólo si es una versión: lo demás no se guarda). */
export async function guardarExtensionVista(version: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!VERSION_RE.test(version)) return { ok: false, error: 'Esa no es una versión de la extensión.' };
  const guardado = await leerSetupGuardado();
  if (guardado.extension?.version === version) return { ok: true };
  await setSetting(CLAVE_SETUP, JSON.stringify({ ...guardado, extension: { version, at: new Date().toISOString() } } satisfies GuardadoSetup));
  return { ok: true };
}
